import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const weekNumber = searchParams.get('weekNumber');
    const plantCode = searchParams.get('plantCode');
    const labor = searchParams.get('labor');
    const activity = searchParams.get('activity');
    const process = searchParams.get('process');
    const employeeId = searchParams.get('employeeId');

    const where: any = {};

    if (date) where.date = date;
    if (weekNumber) where.weekNumber = parseInt(weekNumber, 10);
    if (labor) where.labor = labor;
    if (activity) where.activity = activity;
    if (process) where.process = process;
    if (employeeId) where.employeeId = employeeId;

    if (plantCode) {
      const plant = await prisma.plant.findUnique({ where: { code: plantCode } });
      if (plant) where.plantId = plant.id;
    }

    const records = await prisma.tareoRecord.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            code: true,
            firstName: true,
            lastName: true,
            type: true,
            shift: true,
            area: true,
            position: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    // Summary stats
    const totalRecords = records.length;
    const totalHours = records.reduce((sum, r) => sum + r.horasNetas, 0);
    const uniqueEmployees = new Set(records.map((r) => r.employeeId)).size;

    const byProcess: Record<string, number> = {};
    const byLabor: Record<string, number> = {};
    const byActivity: Record<string, number> = {};

    for (const r of records) {
      byProcess[r.process] = (byProcess[r.process] || 0) + 1;
      byLabor[r.labor] = (byLabor[r.labor] || 0) + 1;
      byActivity[r.activity] = (byActivity[r.activity] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      data: {
        records,
        summary: {
          totalRecords,
          totalHours: Math.round(totalHours * 100) / 100,
          uniqueEmployees,
          byProcess,
          byLabor,
          byActivity,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching tareo records:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener registros de tareo' },
      { status: 500 }
    );
  }
}
