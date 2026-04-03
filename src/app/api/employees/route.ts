import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const plantCode = searchParams.get('plant');
  const shift = searchParams.get('shift');
  const type = searchParams.get('type');
  const active = searchParams.get('active');
  const search = searchParams.get('search');

  const where: any = {};

  if (plantCode) {
    const plant = await prisma.plant.findUnique({ where: { code: plantCode } });
    if (plant) where.plantId = plant.id;
  }
  if (shift) where.shift = shift;
  if (type) where.type = type;
  if (active !== null && active !== undefined) where.active = active === 'true';
  if (search) {
    where.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { dni: { contains: search } },
      { code: { contains: search } },
    ];
  }

  const employees = await prisma.employee.findMany({
    where,
    include: { plant: { select: { name: true, code: true } } },
    orderBy: { lastName: 'asc' },
  });

  return NextResponse.json({ success: true, data: employees, total: employees.length });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, lastName, dni, type, shift, plantCode, position, area, photoUrl } = body;

    if (!firstName || !lastName || !dni || !type || !shift || !plantCode) {
      return NextResponse.json({ success: false, error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const plant = await prisma.plant.findUnique({ where: { code: plantCode } });
    if (!plant) {
      return NextResponse.json({ success: false, error: 'Planta no encontrada' }, { status: 404 });
    }

    // Generar codigo unico para QR
    const code = `FTP-${plantCode}-${dni.slice(-4)}-${Date.now().toString(36).toUpperCase()}`;

    const employee = await prisma.employee.create({
      data: {
        code,
        firstName,
        lastName,
        dni,
        type,
        shift,
        plantId: plant.id,
        position,
        area,
        photoUrl,
      },
      include: { plant: { select: { name: true, code: true } } },
    });

    return NextResponse.json({ success: true, data: employee });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ success: false, error: 'DNI o código ya existe' }, { status: 409 });
    }
    console.error('Error creating employee:', error);
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
  }
}
