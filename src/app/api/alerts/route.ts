import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const plantCode = searchParams.get('plant');
  const resolved = searchParams.get('resolved');
  const limit = parseInt(searchParams.get('limit') || '50');

  const where: any = {};
  if (plantCode) where.plantCode = plantCode;
  if (resolved !== null && resolved !== undefined) where.resolved = resolved === 'true';

  const alerts = await prisma.alert.findMany({
    where,
    include: {
      employee: { select: { firstName: true, lastName: true, code: true, area: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return NextResponse.json({ success: true, data: alerts });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { alertId, resolvedBy } = body;

  if (!alertId) {
    return NextResponse.json({ success: false, error: 'Se requiere alertId' }, { status: 400 });
  }

  const alert = await prisma.alert.update({
    where: { id: alertId },
    data: { resolved: true, resolvedAt: new Date(), resolvedBy: resolvedBy || 'Sistema' },
  });

  return NextResponse.json({ success: true, data: alert });
}
