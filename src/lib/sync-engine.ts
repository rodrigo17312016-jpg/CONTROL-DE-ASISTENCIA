import { prisma } from './db';
import { supabase } from './supabase';

const SYNC_TABLES = ['Employee', 'AttendanceRecord', 'MealRecord', 'TareoRecord', 'Incident', 'Alert'] as const;

// Map Prisma model names to Supabase table names
const TABLE_MAP: Record<string, string> = {
  Employee: 'employees',
  AttendanceRecord: 'attendance_records',
  MealRecord: 'meal_records',
  TareoRecord: 'tareo_records',
  Incident: 'incidents',
  Alert: 'alerts',
};

export async function logSyncAction(tableName: string, recordId: string, action: string, payload: any) {
  await prisma.syncLog.create({
    data: {
      tableName,
      recordId,
      action,
      status: 'PENDING',
      payload: JSON.stringify(payload),
    },
  });
}

export async function syncPendingRecords(): Promise<{ synced: number; failed: number; errors: string[] }> {
  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  const pendingLogs = await prisma.syncLog.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  for (const log of pendingLogs) {
    try {
      const supabaseTable = TABLE_MAP[log.tableName];
      if (!supabaseTable) continue;

      const payload = JSON.parse(log.payload);

      if (log.action === 'INSERT') {
        const { error } = await supabase.from(supabaseTable).upsert(payload, { onConflict: 'id' });
        if (error) throw error;
      } else if (log.action === 'UPDATE') {
        const { error } = await supabase.from(supabaseTable).upsert(payload, { onConflict: 'id' });
        if (error) throw error;
      } else if (log.action === 'DELETE') {
        const { error } = await supabase.from(supabaseTable).delete().eq('id', payload.id);
        if (error) throw error;
      }

      await prisma.syncLog.update({
        where: { id: log.id },
        data: { status: 'SYNCED', syncedAt: new Date(), attempts: log.attempts + 1 },
      });
      synced++;
    } catch (err: any) {
      await prisma.syncLog.update({
        where: { id: log.id },
        data: { status: log.attempts >= 2 ? 'FAILED' : 'PENDING', error: err.message, attempts: log.attempts + 1 },
      });
      failed++;
      errors.push(`${log.tableName}/${log.recordId}: ${err.message}`);
    }
  }

  return { synced, failed, errors };
}

export async function getSyncStatus() {
  const pending = await prisma.syncLog.count({ where: { status: 'PENDING' } });
  const synced = await prisma.syncLog.count({ where: { status: 'SYNCED' } });
  const failed = await prisma.syncLog.count({ where: { status: 'FAILED' } });

  return { pending, synced, failed, total: pending + synced + failed };
}

export async function retryFailedSync() {
  await prisma.syncLog.updateMany({
    where: { status: 'FAILED' },
    data: { status: 'PENDING', attempts: 0 },
  });
}
