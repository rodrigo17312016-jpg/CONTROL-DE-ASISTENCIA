import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAttendanceSummary } from '@/lib/attendance-engine';
import { getMealSummary } from '@/lib/meal-engine';
import { format, subDays } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');

  const plants = await prisma.plant.findMany();
  const plantSummaries = [];

  for (const plant of plants) {
    const attendance = await getAttendanceSummary(plant.code, date);
    const almuerzo = await getMealSummary(plant.code, date, 'ALMUERZO');
    const cena = await getMealSummary(plant.code, date, 'CENA');

    const totalEmployees = await prisma.employee.count({
      where: { plantId: plant.id, active: true },
    });

    plantSummaries.push({
      plant: { id: plant.id, name: plant.name, code: plant.code },
      totalEmployees,
      attendance,
      meals: { almuerzo, cena },
    });
  }

  // Alertas no resueltas
  const unresolvedAlerts = await prisma.alert.findMany({
    where: { resolved: false },
    include: { employee: { select: { firstName: true, lastName: true, code: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Stats globales
  const totalActiveEmployees = await prisma.employee.count({ where: { active: true } });
  const todayRecords = await prisma.attendanceRecord.count({ where: { shiftDate: date } });

  return NextResponse.json({
    success: true,
    data: {
      date,
      globalStats: {
        totalActiveEmployees,
        totalPlants: plants.length,
        todayRecords,
      },
      plants: plantSummaries,
      alerts: unresolvedAlerts,
    },
  });
  } catch (error: any) {
    console.error('Dashboard API error:', error);
    console.error('Dashboard API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
