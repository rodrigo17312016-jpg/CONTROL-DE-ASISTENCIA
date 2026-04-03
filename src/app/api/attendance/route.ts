import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { format } from 'date-fns';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const plantCode = searchParams.get('plant');
  const date = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');
  const shift = searchParams.get('shift');
  const employeeId = searchParams.get('employee');

  const where: any = { shiftDate: date };

  if (plantCode) {
    const plant = await prisma.plant.findUnique({ where: { code: plantCode } });
    if (plant) where.plantId = plant.id;
  }
  if (shift) where.shift = shift;
  if (employeeId) where.employeeId = employeeId;

  const records = await prisma.attendanceRecord.findMany({
    where,
    include: {
      employee: {
        select: {
          id: true, code: true, firstName: true, lastName: true,
          type: true, shift: true, area: true, position: true,
        },
      },
      plant: { select: { name: true, code: true } },
    },
    orderBy: { timestamp: 'desc' },
  });

  // Calcular horas trabajadas por empleado
  const employeeHours = new Map<string, { ingreso?: Date; salida?: Date; hours: number }>();
  const sortedRecords = [...records].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  for (const record of sortedRecords) {
    const key = record.employeeId;
    if (!employeeHours.has(key)) {
      employeeHours.set(key, { hours: 0 });
    }
    const entry = employeeHours.get(key)!;
    if (record.type === 'INGRESO') {
      entry.ingreso = record.timestamp;
    } else if (record.type === 'SALIDA' && entry.ingreso) {
      const diff = (record.timestamp.getTime() - entry.ingreso.getTime()) / (1000 * 60 * 60);
      entry.hours += diff;
      entry.salida = record.timestamp;
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      records,
      hoursWorked: Object.fromEntries(
        Array.from(employeeHours.entries()).map(([id, data]) => [id, {
          hours: Math.round(data.hours * 100) / 100,
          ingreso: data.ingreso,
          salida: data.salida,
        }])
      ),
    },
  });
}
