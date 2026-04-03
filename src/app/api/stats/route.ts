import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const plantCode = searchParams.get('plantCode');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'Se requiere startDate y endDate' },
        { status: 400 }
      );
    }

    // Resolve plant filter
    let plantId: string | undefined;
    if (plantCode) {
      const plant = await prisma.plant.findUnique({ where: { code: plantCode } });
      if (plant) plantId = plant.id;
    }

    const attendanceWhere: any = {
      shiftDate: { gte: startDate, lte: endDate },
    };
    if (plantId) attendanceWhere.plantId = plantId;

    const tareoWhere: any = {
      date: { gte: startDate, lte: endDate },
    };
    if (plantId) tareoWhere.plantId = plantId;

    const incidentWhere: any = {
      date: { gte: startDate, lte: endDate },
    };
    if (plantId) incidentWhere.plantId = plantId;

    const mealWhere: any = {
      date: { gte: startDate, lte: endDate },
    };

    // Fetch all data in parallel
    const [attendanceRecords, tareoRecords, incidents, mealRecords] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: attendanceWhere,
        include: { employee: { select: { id: true, firstName: true, lastName: true, code: true } } },
      }),
      prisma.tareoRecord.findMany({ where: tareoWhere }),
      prisma.incident.findMany({ where: incidentWhere }),
      prisma.mealRecord.findMany({ where: mealWhere }),
    ]);

    // 1. Daily attendance
    const dailyMap = new Map<string, {
      totalIngreso: number;
      totalSalida: number;
      totalLate: number;
      totalMinutesLate: number;
    }>();

    for (const r of attendanceRecords) {
      const day = r.shiftDate;
      if (!dailyMap.has(day)) {
        dailyMap.set(day, { totalIngreso: 0, totalSalida: 0, totalLate: 0, totalMinutesLate: 0 });
      }
      const entry = dailyMap.get(day)!;
      if (r.type === 'INGRESO') entry.totalIngreso++;
      if (r.type === 'SALIDA') entry.totalSalida++;
      if (r.isLate) {
        entry.totalLate++;
        entry.totalMinutesLate += r.minutesLate;
      }
    }

    const dailyAttendance = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        totalIngreso: data.totalIngreso,
        totalSalida: data.totalSalida,
        totalLate: data.totalLate,
        avgMinutesLate: data.totalLate > 0
          ? Math.round((data.totalMinutesLate / data.totalLate) * 100) / 100
          : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 2. Hours by area (labor) from tareo
    const laborMap = new Map<string, { totalHours: number; employees: Set<string> }>();
    for (const t of tareoRecords) {
      if (!laborMap.has(t.labor)) {
        laborMap.set(t.labor, { totalHours: 0, employees: new Set() });
      }
      const entry = laborMap.get(t.labor)!;
      entry.totalHours += t.horasNetas;
      entry.employees.add(t.employeeId);
    }

    const hoursByArea = Array.from(laborMap.entries()).map(([labor, data]) => ({
      labor,
      totalHours: Math.round(data.totalHours * 100) / 100,
      avgHours: data.employees.size > 0
        ? Math.round((data.totalHours / data.employees.size) * 100) / 100
        : 0,
      employees: data.employees.size,
    }));

    // 3. Hours by process from tareo
    const processMap = new Map<string, { totalHours: number; records: number }>();
    for (const t of tareoRecords) {
      if (!processMap.has(t.process)) {
        processMap.set(t.process, { totalHours: 0, records: 0 });
      }
      const entry = processMap.get(t.process)!;
      entry.totalHours += t.horasNetas;
      entry.records++;
    }

    const hoursByProcess = Array.from(processMap.entries()).map(([process, data]) => ({
      process,
      totalHours: Math.round(data.totalHours * 100) / 100,
      records: data.records,
    }));

    // 4. Incidents summary
    const incidentMap = new Map<string, number>();
    for (const inc of incidents) {
      incidentMap.set(inc.type, (incidentMap.get(inc.type) || 0) + 1);
    }
    const incidentsSummary = Array.from(incidentMap.entries()).map(([type, count]) => ({
      type,
      count,
    }));

    // 5. Meal stats
    let programados = 0;
    let servidos = 0;
    let cancelados = 0;
    for (const m of mealRecords) {
      if (m.status === 'PROGRAMADO') programados++;
      else if (m.status === 'SERVIDO') servidos++;
      else if (m.status === 'CANCELADO') cancelados++;
    }
    const mealStats = { programados, servidos, cancelados };

    // 6. Weekly comparison (current vs previous week)
    const endDateObj = new Date(endDate);
    const currentWeekStart = new Date(endDateObj);
    currentWeekStart.setDate(endDateObj.getDate() - endDateObj.getDay() + 1);
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const previousWeekEnd = new Date(currentWeekStart);
    previousWeekEnd.setDate(previousWeekEnd.getDate() - 1);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const prevAttendanceWhere: any = {
      shiftDate: { gte: formatDate(previousWeekStart), lte: formatDate(previousWeekEnd) },
    };
    if (plantId) prevAttendanceWhere.plantId = plantId;

    const prevAttendance = await prisma.attendanceRecord.findMany({
      where: prevAttendanceWhere,
    });

    const currentWeekRecords = attendanceRecords.filter(
      (r) => r.shiftDate >= formatDate(currentWeekStart) && r.shiftDate <= endDate
    );

    const weeklyComparison = {
      currentWeek: {
        start: formatDate(currentWeekStart),
        end: endDate,
        totalIngreso: currentWeekRecords.filter((r) => r.type === 'INGRESO').length,
        totalSalida: currentWeekRecords.filter((r) => r.type === 'SALIDA').length,
        totalLate: currentWeekRecords.filter((r) => r.isLate).length,
      },
      previousWeek: {
        start: formatDate(previousWeekStart),
        end: formatDate(previousWeekEnd),
        totalIngreso: prevAttendance.filter((r) => r.type === 'INGRESO').length,
        totalSalida: prevAttendance.filter((r) => r.type === 'SALIDA').length,
        totalLate: prevAttendance.filter((r) => r.isLate).length,
      },
    };

    // 7. Top late employees
    const lateMap = new Map<string, {
      employeeId: string;
      name: string;
      code: string;
      count: number;
      totalMinutes: number;
    }>();

    for (const r of attendanceRecords) {
      if (r.isLate && r.type === 'INGRESO') {
        if (!lateMap.has(r.employeeId)) {
          lateMap.set(r.employeeId, {
            employeeId: r.employeeId,
            name: `${r.employee.firstName} ${r.employee.lastName}`,
            code: r.employee.code,
            count: 0,
            totalMinutes: 0,
          });
        }
        const entry = lateMap.get(r.employeeId)!;
        entry.count++;
        entry.totalMinutes += r.minutesLate;
      }
    }

    const topLateEmployees = Array.from(lateMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      data: {
        dailyAttendance,
        hoursByArea,
        hoursByProcess,
        incidentsSummary,
        mealStats,
        weeklyComparison,
        topLateEmployees,
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener estadisticas' },
      { status: 500 }
    );
  }
}
