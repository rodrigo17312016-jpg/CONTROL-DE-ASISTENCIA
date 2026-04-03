import { prisma } from './db';
import { SHIFTS, EMPLOYEE_TYPES, ALERT_TYPES, ALERT_SEVERITY } from './constants';
import { format, differenceInMinutes, parseISO, startOfDay, addDays, subDays } from 'date-fns';

function getShiftConfig(shift: string) {
  return shift === 'DIA' ? SHIFTS.DIA : SHIFTS.NOCHE;
}

function getShiftDate(timestamp: Date, shift: string): string {
  const hour = timestamp.getHours();
  if (shift === 'NOCHE') {
    // Si es entre medianoche y las 7am, la fecha logica del turno es el dia anterior
    if (hour >= 0 && hour < 12) {
      return format(subDays(timestamp, 1), 'yyyy-MM-dd');
    }
  }
  return format(timestamp, 'yyyy-MM-dd');
}

function calculateLateness(timestamp: Date, shift: string): { isLate: boolean; minutesLate: number } {
  const config = getShiftConfig(shift);
  const hour = timestamp.getHours();
  const minutes = timestamp.getMinutes();
  const totalMinutes = hour * 60 + minutes;
  const shiftStartMinutes = config.startHour * 60;
  const graceEndMinutes = shiftStartMinutes + config.graceMinutes;

  if (totalMinutes > graceEndMinutes) {
    return { isLate: true, minutesLate: totalMinutes - shiftStartMinutes };
  }
  return { isLate: false, minutesLate: 0 };
}

function calculateEarlyDeparture(timestamp: Date, shift: string): { isEarly: boolean; minutesEarly: number } {
  const config = getShiftConfig(shift);
  const hour = timestamp.getHours();
  const minutes = timestamp.getMinutes();
  const totalMinutes = hour * 60 + minutes;

  if (shift === 'DIA') {
    const shiftEndMinutes = config.endHour * 60;
    if (totalMinutes < shiftEndMinutes - 30) { // 30 min antes = salida anticipada
      return { isEarly: true, minutesEarly: shiftEndMinutes - totalMinutes };
    }
  } else {
    // Turno noche: si sale antes de las 6:30am se considera anticipada
    const endMinutes = 7 * 60;
    if (hour >= 0 && hour < 7 && totalMinutes < endMinutes - 30) {
      return { isEarly: true, minutesEarly: endMinutes - totalMinutes };
    }
  }
  return { isEarly: false, minutesEarly: 0 };
}

export async function determineActionType(employeeId: string, shift: string, timestamp: Date) {
  const shiftDate = getShiftDate(timestamp, shift);

  // Buscar el ultimo registro del turno actual
  const lastRecord = await prisma.attendanceRecord.findFirst({
    where: {
      employeeId,
      shiftDate,
      shift,
    },
    orderBy: { timestamp: 'desc' },
  });

  if (!lastRecord || lastRecord.type === 'SALIDA') {
    return 'INGRESO';
  }
  return 'SALIDA';
}

export async function processAttendanceScan(employeeCode: string, plantCode: string, method: string = 'QR') {
  const now = new Date();

  // Buscar empleado por codigo o DNI
  let employee = await prisma.employee.findUnique({
    where: { code: employeeCode },
    include: { plant: true },
  });

  if (!employee) {
    employee = await prisma.employee.findUnique({
      where: { dni: employeeCode },
      include: { plant: true },
    });
  }

  if (!employee) {
    return { success: false, error: 'Empleado no encontrado', code: 'EMPLOYEE_NOT_FOUND' };
  }

  if (!employee.active) {
    return { success: false, error: 'Empleado inactivo', code: 'EMPLOYEE_INACTIVE' };
  }

  // Buscar planta
  const plant = await prisma.plant.findUnique({ where: { code: plantCode } });
  if (!plant) {
    return { success: false, error: 'Planta no encontrada', code: 'PLANT_NOT_FOUND' };
  }

  const shift = employee.shift;
  const shiftDate = getShiftDate(now, shift);
  const actionType = await determineActionType(employee.id, shift, now);

  let isLate = false;
  let minutesLate = 0;
  let isEarly = false;
  let minutesEarly = 0;

  if (actionType === 'INGRESO') {
    const lateness = calculateLateness(now, shift);
    isLate = lateness.isLate;
    minutesLate = lateness.minutesLate;
  } else {
    const earlyDep = calculateEarlyDeparture(now, shift);
    isEarly = earlyDep.isEarly;
    minutesEarly = earlyDep.minutesEarly;
  }

  // Crear registro de asistencia
  const record = await prisma.attendanceRecord.create({
    data: {
      employeeId: employee.id,
      plantId: plant.id,
      type: actionType,
      shift,
      shiftDate,
      timestamp: now,
      method,
      isLate,
      isEarly,
      minutesLate,
      minutesEarly,
    },
  });

  // Generar alertas si es necesario
  const alerts: string[] = [];

  if (actionType === 'INGRESO' && isLate) {
    const alert = await prisma.alert.create({
      data: {
        type: ALERT_TYPES.TARDANZA,
        severity: minutesLate > 30 ? ALERT_SEVERITY.CRITICAL : ALERT_SEVERITY.WARNING,
        title: 'Tardanza Detectada',
        message: `${employee.firstName} ${employee.lastName} llegó ${minutesLate} min tarde. Turno ${shift}.`,
        employeeId: employee.id,
        plantCode,
      },
    });
    alerts.push(alert.message);
  }

  if (actionType === 'SALIDA' && isEarly) {
    const alert = await prisma.alert.create({
      data: {
        type: ALERT_TYPES.SALIDA_ANTICIPADA,
        severity: ALERT_SEVERITY.WARNING,
        title: 'Salida Anticipada',
        message: `${employee.firstName} ${employee.lastName} salió ${minutesEarly} min antes. Turno ${shift}.`,
        employeeId: employee.id,
        plantCode,
      },
    });
    alerts.push(alert.message);

    // Verificar si debe cancelar su comida programada
    await cancelMealIfNeeded(employee, shiftDate, shift, plantCode);
  }

  // Si es ingreso y es operativo, programar comida
  if (actionType === 'INGRESO' && EMPLOYEE_TYPES[employee.type as keyof typeof EMPLOYEE_TYPES]?.mealEligible) {
    const shiftConfig = getShiftConfig(shift);
    const mealType = shiftConfig.mealType;

    await prisma.mealRecord.upsert({
      where: {
        employeeId_mealType_date: {
          employeeId: employee.id,
          mealType,
          date: shiftDate,
        },
      },
      create: {
        employeeId: employee.id,
        mealType,
        date: shiftDate,
        status: 'PROGRAMADO',
      },
      update: {
        status: 'PROGRAMADO',
        cancelledAt: null,
        cancelReason: null,
      },
    });
  }

  return {
    success: true,
    data: {
      employee: {
        id: employee.id,
        code: employee.code,
        dni: employee.dni,
        name: `${employee.firstName} ${employee.lastName}`,
        type: employee.type,
        shift: employee.shift,
        area: employee.area,
        position: employee.position,
        photoUrl: employee.photoUrl,
        mealEligible: EMPLOYEE_TYPES[employee.type as keyof typeof EMPLOYEE_TYPES]?.mealEligible || false,
      },
      action: actionType,
      timestamp: now.toISOString(),
      shiftDate,
      isLate,
      minutesLate,
      isEarly,
      minutesEarly,
      alerts,
      plantCode,
    },
  };
}

async function cancelMealIfNeeded(
  employee: { id: string; firstName: string; lastName: string; type: string; shift: string },
  shiftDate: string,
  shift: string,
  plantCode: string
) {
  if (!EMPLOYEE_TYPES[employee.type as keyof typeof EMPLOYEE_TYPES]?.mealEligible) return;

  const shiftConfig = getShiftConfig(shift);
  const now = new Date();
  const mealType = shiftConfig.mealType;

  // Verificar si la salida es ANTES de la hora de comida
  const hour = now.getHours();
  let isBeforeMeal = false;

  if (shift === 'DIA') {
    isBeforeMeal = hour < shiftConfig.mealHour;
  } else {
    isBeforeMeal = hour >= 19 && hour < 24; // Si sale antes de medianoche, no alcanza la cena
  }

  if (isBeforeMeal) {
    const meal = await prisma.mealRecord.findUnique({
      where: {
        employeeId_mealType_date: {
          employeeId: employee.id,
          mealType,
          date: shiftDate,
        },
      },
    });

    if (meal && meal.status === 'PROGRAMADO') {
      await prisma.mealRecord.update({
        where: { id: meal.id },
        data: {
          status: 'CANCELADO',
          cancelledAt: now,
          cancelReason: 'SALIDA_ANTICIPADA',
        },
      });

      await prisma.alert.create({
        data: {
          type: ALERT_TYPES.MEAL_CANCELLED,
          severity: ALERT_SEVERITY.INFO,
          title: `${mealType} Cancelado`,
          message: `${employee.firstName} ${employee.lastName} salió antes del ${mealType.toLowerCase()}. Se descontó del conteo de cocina.`,
          employeeId: employee.id,
          plantCode,
        },
      });
    }
  }
}

export async function getAttendanceSummary(plantCode: string, date: string) {
  const plant = await prisma.plant.findUnique({ where: { code: plantCode } });
  if (!plant) return null;

  const records = await prisma.attendanceRecord.findMany({
    where: { plantId: plant.id, shiftDate: date },
    include: { employee: true },
    orderBy: { timestamp: 'desc' },
  });

  // Calcular quienes estan actualmente dentro (tienen ingreso pero no salida)
  const employeeStatus = new Map<string, { employee: any; lastAction: string; timestamp: Date }>();

  for (const record of records) {
    const existing = employeeStatus.get(record.employeeId);
    if (!existing || record.timestamp > existing.timestamp) {
      employeeStatus.set(record.employeeId, {
        employee: record.employee,
        lastAction: record.type,
        timestamp: record.timestamp,
      });
    }
  }

  const insidePlant = Array.from(employeeStatus.values()).filter(e => e.lastAction === 'INGRESO');
  const leftPlant = Array.from(employeeStatus.values()).filter(e => e.lastAction === 'SALIDA');
  const lateArrivals = records.filter(r => r.type === 'INGRESO' && r.isLate);
  const earlyDepartures = records.filter(r => r.type === 'SALIDA' && r.isEarly);

  return {
    plantCode,
    date,
    totalRecords: records.length,
    currentlyInside: insidePlant.length,
    totalEntered: new Set(records.filter(r => r.type === 'INGRESO').map(r => r.employeeId)).size,
    totalExited: leftPlant.length,
    lateArrivals: lateArrivals.length,
    earlyDepartures: earlyDepartures.length,
    byShift: {
      DIA: {
        inside: insidePlant.filter(e => e.employee.shift === 'DIA').length,
        entered: new Set(records.filter(r => r.type === 'INGRESO' && r.shift === 'DIA').map(r => r.employeeId)).size,
      },
      NOCHE: {
        inside: insidePlant.filter(e => e.employee.shift === 'NOCHE').length,
        entered: new Set(records.filter(r => r.type === 'INGRESO' && r.shift === 'NOCHE').map(r => r.employeeId)).size,
      },
    },
    recentActivity: records.slice(0, 20).map(r => ({
      employee: `${r.employee.firstName} ${r.employee.lastName}`,
      type: r.type,
      shift: r.shift,
      timestamp: r.timestamp,
      isLate: r.isLate,
      minutesLate: r.minutesLate,
    })),
  };
}
