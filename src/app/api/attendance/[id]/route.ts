import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { editedBy, editReason, ...updates } = body;

    if (!editedBy || !editReason) {
      return NextResponse.json(
        { success: false, error: 'Se requiere editedBy y editReason para ediciones manuales' },
        { status: 400 }
      );
    }

    const existing = await prisma.attendanceRecord.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Registro de asistencia no encontrado' },
        { status: 404 }
      );
    }

    // Only allow safe fields to be updated
    const allowedFields = [
      'type', 'shift', 'shiftDate', 'timestamp', 'method',
      'isLate', 'isEarly', 'minutesLate', 'minutesEarly', 'notes',
    ];
    const safeUpdates: any = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        safeUpdates[key] = key === 'timestamp' ? new Date(updates[key]) : updates[key];
      }
    }

    const updated = await prisma.attendanceRecord.update({
      where: { id },
      data: {
        ...safeUpdates,
        isManualEdit: true,
        editedBy,
        editedAt: new Date(),
        editReason,
      },
      include: {
        employee: {
          select: {
            id: true,
            code: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Create alert about manual edit
    await prisma.alert.create({
      data: {
        type: 'EDICION_MANUAL',
        severity: 'MEDIA',
        title: 'Edicion manual de asistencia',
        message: `Registro de ${updated.employee.firstName} ${updated.employee.lastName} editado por ${editedBy}. Razon: ${editReason}`,
        employeeId: updated.employeeId,
        plantCode: null,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating attendance record:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar registro de asistencia' },
      { status: 500 }
    );
  }
}
