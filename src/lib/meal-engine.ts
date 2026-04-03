import { prisma } from './db';
import { SHIFTS, EMPLOYEE_TYPES } from './constants';
import { format } from 'date-fns';

export async function getMealSummary(plantCode: string, date: string, mealType: 'ALMUERZO' | 'CENA') {
  const plant = await prisma.plant.findUnique({ where: { code: plantCode } });
  if (!plant) return null;

  // Obtener empleados operativos de esta planta que tienen comida programada
  const meals = await prisma.mealRecord.findMany({
    where: {
      date,
      mealType,
      employee: {
        plantId: plant.id,
        active: true,
      },
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          code: true,
          type: true,
          shift: true,
          area: true,
        },
      },
    },
  });

  const programados = meals.filter(m => m.status === 'PROGRAMADO');
  const servidos = meals.filter(m => m.status === 'SERVIDO');
  const cancelados = meals.filter(m => m.status === 'CANCELADO');
  const noPresentados = meals.filter(m => m.status === 'NO_PRESENTADO');

  // Agrupar por area
  const byArea = new Map<string, number>();
  for (const meal of programados) {
    const area = meal.employee.area || 'Sin Area';
    byArea.set(area, (byArea.get(area) || 0) + 1);
  }

  return {
    plantCode,
    date,
    mealType,
    totalProgramados: programados.length,
    totalServidos: servidos.length,
    totalCancelados: cancelados.length,
    totalNoPresentados: noPresentados.length,
    byArea: Object.fromEntries(byArea),
    cancelaciones: cancelados.map(m => ({
      employee: `${m.employee.firstName} ${m.employee.lastName}`,
      reason: m.cancelReason,
      cancelledAt: m.cancelledAt,
    })),
    detalle: programados.map(m => ({
      employee: `${m.employee.firstName} ${m.employee.lastName}`,
      code: m.employee.code,
      area: m.employee.area,
      status: m.status,
    })),
  };
}

export async function serveMeal(employeeCode: string, mealType: 'ALMUERZO' | 'CENA', date: string) {
  const employee = await prisma.employee.findUnique({ where: { code: employeeCode } });
  if (!employee) {
    return { success: false, error: 'Empleado no encontrado' };
  }

  // Verificar si es administrativo
  if (employee.type === 'ADMINISTRATIVO') {
    return {
      success: false,
      error: 'Personal administrativo no tiene derecho a comida de empresa',
      employeeName: `${employee.firstName} ${employee.lastName}`,
      employeeType: 'ADMINISTRATIVO',
    };
  }

  const meal = await prisma.mealRecord.findUnique({
    where: {
      employeeId_mealType_date: {
        employeeId: employee.id,
        mealType,
        date,
      },
    },
  });

  if (!meal) {
    return {
      success: false,
      error: `No tiene ${mealType.toLowerCase()} programado para hoy`,
      employeeName: `${employee.firstName} ${employee.lastName}`,
    };
  }

  if (meal.status === 'CANCELADO') {
    return {
      success: false,
      error: `${mealType} fue cancelado. Motivo: ${meal.cancelReason}`,
      employeeName: `${employee.firstName} ${employee.lastName}`,
    };
  }

  if (meal.status === 'SERVIDO') {
    return {
      success: false,
      error: `${mealType} ya fue servido anteriormente`,
      employeeName: `${employee.firstName} ${employee.lastName}`,
    };
  }

  await prisma.mealRecord.update({
    where: { id: meal.id },
    data: { status: 'SERVIDO', servedAt: new Date() },
  });

  return {
    success: true,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    mealType,
    message: `${mealType} servido correctamente`,
  };
}

export async function cancelMealManually(
  employeeCode: string,
  mealType: 'ALMUERZO' | 'CENA',
  date: string,
  reason: string,
  plantCode: string
) {
  const employee = await prisma.employee.findUnique({ where: { code: employeeCode } });
  if (!employee) return { success: false, error: 'Empleado no encontrado' };

  const meal = await prisma.mealRecord.findUnique({
    where: {
      employeeId_mealType_date: {
        employeeId: employee.id,
        mealType,
        date,
      },
    },
  });

  if (!meal || meal.status !== 'PROGRAMADO') {
    return { success: false, error: 'No hay comida programada para cancelar' };
  }

  await prisma.mealRecord.update({
    where: { id: meal.id },
    data: {
      status: 'CANCELADO',
      cancelledAt: new Date(),
      cancelReason: reason,
    },
  });

  await prisma.alert.create({
    data: {
      type: 'MEAL_CANCELLED',
      severity: 'INFO',
      title: `${mealType} Cancelado Manualmente`,
      message: `${employee.firstName} ${employee.lastName}: ${mealType.toLowerCase()} cancelado. Motivo: ${reason}`,
      employeeId: employee.id,
      plantCode,
    },
  });

  return {
    success: true,
    message: `${mealType} cancelado para ${employee.firstName} ${employee.lastName}`,
  };
}

export async function getKitchenReport(plantCode: string, date: string) {
  const almuerzo = await getMealSummary(plantCode, date, 'ALMUERZO');
  const cena = await getMealSummary(plantCode, date, 'CENA');

  return {
    plantCode,
    date,
    generatedAt: new Date().toISOString(),
    almuerzo,
    cena,
  };
}
