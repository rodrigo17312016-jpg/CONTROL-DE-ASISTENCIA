import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { syncPendingRecords } from '@/lib/sync-engine';

export async function GET() {
  try {
    const [pending, synced, failed] = await Promise.all([
      prisma.syncLog.count({ where: { status: 'PENDING' } }),
      prisma.syncLog.count({ where: { status: 'SYNCED' } }),
      prisma.syncLog.count({ where: { status: 'FAILED' } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        pending,
        synced,
        failed,
        total: pending + synced + failed,
      },
    });
  } catch (error) {
    console.error('Error fetching sync status:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener estado de sincronizacion' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const result = await syncPendingRecords();

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error triggering sync:', error);
    return NextResponse.json(
      { success: false, error: 'Error al sincronizar registros' },
      { status: 500 }
    );
  }
}
