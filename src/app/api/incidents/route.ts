import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const plantCode = searchParams.get('plantCode');
    const type = searchParams.get('type');
    const resolved = searchParams.get('resolved');

    const where: any = {};

    if (date) where.date = date;
    if (type) where.type = type;
    if (resolved !== null && resolved !== undefined) {
      where.resolved = resolved === 'true';
    }

    if (plantCode) {
      const plant = await prisma.plant.findUnique({ where: { code: plantCode } });
      if (plant) where.plantId = plant.id;
    }

    const incidents = await prisma.incident.findMany({
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
          },
        },
        plant: { select: { name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: incidents });
  } catch (error) {
    console.error('Error fetching incidents:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener incidentes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      employeeId,
      plantId,
      type,
      severity,
      title,
      description,
      date,
      time,
    } = body;

    if (!employeeId || !plantId || !type || !severity || !title || !description || !date) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    const incident = await prisma.incident.create({
      data: {
        employeeId,
        plantId,
        type,
        severity,
        title,
        description,
        date,
        time: time || null,
      },
    });

    // Auto-create exit attendance record for ACCIDENTE or EMERGENCIA
    let autoExitRecord = null;
    if (type === 'ACCIDENTE' || type === 'EMERGENCIA') {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
      });

      if (employee) {
        autoExitRecord = await prisma.attendanceRecord.create({
          data: {
            employeeId,
            plantId,
            type: 'SALIDA',
            shift: employee.shift,
            shiftDate: date,
            timestamp: new Date(),
            method: 'AUTOMATICO',
            notes: `Salida automatica por ${type.toLowerCase()}: ${title}`,
          },
        });

        // Mark the incident as having auto-exit applied
        await prisma.incident.update({
          where: { id: incident.id },
          data: { autoExitApplied: true },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        incident,
        autoExitRecord,
      },
    });
  } catch (error) {
    console.error('Error creating incident:', error);
    return NextResponse.json(
      { success: false, error: 'Error al crear incidente' },
      { status: 500 }
    );
  }
}
