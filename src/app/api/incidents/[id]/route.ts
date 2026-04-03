import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { resolved, resolution, resolvedBy } = body;

    const existing = await prisma.incident.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Incidente no encontrado' },
        { status: 404 }
      );
    }

    const updateData: any = {};

    if (resolved !== undefined) {
      updateData.resolved = resolved;
      if (resolved) {
        updateData.resolvedAt = new Date();
        updateData.resolvedBy = resolvedBy || null;
      } else {
        updateData.resolvedAt = null;
        updateData.resolvedBy = null;
      }
    }

    if (resolution !== undefined) {
      updateData.resolution = resolution;
    }

    const updated = await prisma.incident.update({
      where: { id },
      data: updateData,
      include: {
        employee: {
          select: {
            id: true,
            code: true,
            firstName: true,
            lastName: true,
          },
        },
        plant: { select: { name: true, code: true } },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating incident:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar incidente' },
      { status: 500 }
    );
  }
}
