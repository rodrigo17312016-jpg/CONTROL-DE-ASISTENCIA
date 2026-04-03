import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: { plant: true },
  });

  if (!employee) {
    return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: employee });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  try {
    const { plantCode, ...rest } = body;

    // Resolve plantCode to plantId if provided
    let plantId: string | undefined;
    if (plantCode) {
      const plant = await prisma.plant.findUnique({ where: { code: plantCode } });
      if (!plant) {
        return NextResponse.json({ success: false, error: 'Planta no encontrada' }, { status: 400 });
      }
      plantId = plant.id;
    }

    const updateData: any = {
      firstName: rest.firstName,
      lastName: rest.lastName,
      dni: rest.dni,
      type: rest.type,
      shift: rest.shift,
      position: rest.position || null,
      area: rest.area || null,
    };
    if (plantId) updateData.plantId = plantId;

    const employee = await prisma.employee.update({
      where: { id },
      data: updateData,
      include: { plant: true },
    });
    return NextResponse.json({ success: true, data: employee });
  } catch (err: any) {
    console.error('Error updating employee:', err);
    return NextResponse.json({ success: false, error: err.message || 'Error actualizando' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.employee.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ success: true, message: 'Empleado desactivado' });
}
