import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import path from 'path';
import * as XLSX from 'xlsx';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

function now() { return new Date(); }

const PROCESS_MAP: Record<string, string> = {
  'PROCESO DE MANGO': 'MANGO',
  'PROCESO DE GRANADA': 'GRANADA',
  'PROCESO DE PALTA': 'PALTA',
  'PROCESO DE UVA': 'UVA',
};

const AREAS_ADMIN = ['INSP CALIDAD', 'INSP DE TAREO', 'INSP PRODUCCI', 'INSPECTOR CONGELADO'];

function timeToStr(val: any): string | null {
  if (!val) return null;
  if (typeof val === 'number') {
    const totalMinutes = Math.round(val * 24 * 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  if (typeof val === 'string') {
    const match = val.match(/(\d{1,2}):(\d{2})/);
    if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;
  }
  return null;
}

async function main() {
  // ===== CLEAN =====
  console.log('Limpiando base de datos...');
  await prisma.tareoRecord.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.mealRecord.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.syncLog.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.plant.deleteMany();
  await prisma.systemConfig.deleteMany();

  // ===== PLANTS =====
  const plantP1 = await prisma.plant.create({
    data: { name: 'Frutos Tropicales - Planta Principal', code: 'P1', address: 'Barranca, Lima' },
  });
  const plantP2 = await prisma.plant.create({
    data: { name: 'Frutos Tropicales - Planta 2', code: 'P2', address: 'Barranca, Lima' },
  });
  console.log('Plantas creadas');

  // ===== SYSTEM CONFIG =====
  await prisma.systemConfig.createMany({
    data: [
      { key: 'company_name', value: 'Frutos Tropicales S.A.C.' },
      { key: 'timezone', value: 'America/Lima' },
      { key: 'sync_enabled', value: 'true' },
    ],
  });

  // ===== READ EXCEL TAREO =====
  const possiblePaths = [
    path.resolve(process.cwd(), '..', 'PORTAL PRODUCCION', 'PORTAL PRODUCCION', 'REPORTES DE PRODUCCION', 'tareo', 'TAREO SEM 13.xlsx'),
    'C:\\Users\\ARES\\Desktop\\FRUTOS TROPICALES\\PORTAL PRODUCCION\\PORTAL PRODUCCION\\REPORTES DE PRODUCCION\\tareo\\TAREO SEM 13.xlsx',
    path.join('C:', 'Users', 'ARES', 'Desktop', 'FRUTOS TROPICALES', 'PORTAL PRODUCCION', 'PORTAL PRODUCCION', 'REPORTES DE PRODUCCION', 'tareo', 'TAREO SEM 13.xlsx'),
  ];

  let workbook: XLSX.WorkBook | null = null;
  for (const p of possiblePaths) {
    try {
      workbook = XLSX.readFile(p);
      console.log('Tareo cargado desde:', p);
      break;
    } catch { /* try next */ }
  }

  if (!workbook) {
    console.error('No se encontro el archivo de tareo. Continuando sin datos de tareo...');
  }

  // Track employees by DNI
  const employeeMap = new Map<string, string>(); // dni -> id
  let totalEmployees = 0;
  let totalTareo = 0;

  if (workbook) {
    for (const sheetName of workbook.SheetNames) {
      const ws = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

      // Find process
      let processName = 'DESCONOCIDO';
      for (let r = 0; r < Math.min(5, data.length); r++) {
        for (let c = 0; c < 13; c++) {
          const val = data[r]?.[c];
          if (typeof val === 'string' && val.includes('PROCESO')) {
            processName = PROCESS_MAP[val.trim()] || val.replace('PROCESO DE ', '').trim();
          }
        }
      }

      // Find header row
      let headerRow = -1;
      for (let r = 0; r < Math.min(10, data.length); r++) {
        if (data[r]?.[0] === 'ITEM' || data[r]?.[1] === 'DNI') {
          headerRow = r;
          break;
        }
      }
      if (headerRow === -1) continue;

      // Date from sheet name
      const [dd, mm] = sheetName.split('-').map(Number);
      const dateStr = `2026-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;

      let sheetCount = 0;
      for (let r = headerRow + 1; r < data.length; r++) {
        const row = data[r];
        if (!row || !row[0] || !row[1]) continue;
        if (isNaN(Number(row[0]))) continue;

        const dni = String(row[1]).trim();
        const fullName = String(row[2] || '').trim();
        if (!dni || !fullName || dni === 'DNI') continue;

        const labor = String(row[3] || '').trim();
        const activity = String(row[4] || '').trim();

        // Create employee if needed
        if (!employeeMap.has(dni)) {
          const nameParts = fullName.split(' ');
          let firstName: string, lastName: string;
          if (nameParts.length >= 3) {
            lastName = nameParts.slice(0, 2).join(' ');
            firstName = nameParts.slice(2).join(' ');
          } else {
            lastName = nameParts[0] || '';
            firstName = nameParts.slice(1).join(' ') || fullName;
          }

          const isAdmin = AREAS_ADMIN.some(a => labor.toUpperCase().includes(a));
          const empCode = `FTP-P1-${String(totalEmployees + 1).padStart(4, '0')}`;

          const emp = await prisma.employee.create({
            data: {
              code: empCode, firstName, lastName, dni,
              type: isAdmin ? 'ADMINISTRATIVO' : 'OPERATIVO',
              shift: 'DIA', plantId: plantP1.id,
              position: activity || null, area: labor || null,
            },
          });

          employeeMap.set(dni, emp.id);
          totalEmployees++;
        }

        const empId = employeeMap.get(dni)!;

        await prisma.tareoRecord.create({
          data: {
            employeeId: empId, plantId: plantP1.id, date: dateStr,
            weekNumber: 13, process: processName,
            labor: labor || 'SIN ASIGNAR', activity: activity || 'SIN ASIGNAR',
            horaInicio: timeToStr(row[5]), horaFin: timeToStr(row[8]),
            hIngRefrigerio: timeToStr(row[6]), hSalRefrigerio: timeToStr(row[7]),
            horasReloj: timeToStr(row[11]), horasNetas: Number(row[12]) || 0,
          },
        });
        sheetCount++;
      }

      totalTareo += sheetCount;
      console.log(`  ${sheetName}: ${processName} - ${sheetCount} registros`);
    }
  }

  console.log(`\nEmpleados importados: ${totalEmployees}`);
  console.log(`Registros tareo: ${totalTareo}`);

  // ===== ATTENDANCE FOR TODAY =====
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const allEmployees = await prisma.employee.findMany({ where: { active: true } });

  let attCount = 0, mealCount = 0, alertCount = 0;

  for (const emp of allEmployees) {
    if (Math.random() > 0.85) continue;

    const isLate = Math.random() < 0.3;
    const minsLate = isLate ? Math.floor(Math.random() * 45) + 5 : 0;
    const entry = new Date(today);
    entry.setHours(7, minsLate, Math.floor(Math.random() * 60));

    await prisma.attendanceRecord.create({
      data: {
        employeeId: emp.id, plantId: emp.plantId, type: 'INGRESO',
        shift: 'DIA', shiftDate: todayStr, timestamp: entry,
        method: 'QR', isLate, minutesLate: minsLate,
      },
    });
    attCount++;

    if (emp.type === 'OPERATIVO') {
      await prisma.mealRecord.create({
        data: {
          employeeId: emp.id, mealType: 'ALMUERZO',
          date: todayStr, status: 'PROGRAMADO',
        },
      });
      mealCount++;
    }

    if (isLate && minsLate > 10) {
      await prisma.alert.create({
        data: {
          type: 'TARDANZA', severity: minsLate > 30 ? 'CRITICAL' : 'WARNING',
          title: 'Tardanza Detectada',
          message: `${emp.firstName} ${emp.lastName} llego ${minsLate} min tarde.`,
          employeeId: emp.id, plantCode: 'P1',
        },
      });
      alertCount++;
    }

    if (Math.random() < 0.25) {
      const exit = new Date(today);
      exit.setHours(12 + Math.floor(Math.random() * 5), Math.floor(Math.random() * 60));
      await prisma.attendanceRecord.create({
        data: {
          employeeId: emp.id, plantId: emp.plantId, type: 'SALIDA',
          shift: 'DIA', shiftDate: todayStr, timestamp: exit, method: 'QR',
        },
      });
      attCount++;
    }
  }

  // ===== INCIDENTS =====
  const sample = allEmployees.slice(0, 3);
  if (sample[0]) {
    await prisma.incident.create({
      data: {
        employeeId: sample[0].id, plantId: sample[0].plantId,
        type: 'ACCIDENTE', severity: 'GRAVE',
        title: 'Accidente en linea de empaque',
        description: 'Trabajador sufrio corte en mano. Trasladado por ambulancia.',
        date: todayStr, time: '10:30', autoExitApplied: true,
      },
    });
  }
  if (sample[1]) {
    await prisma.incident.create({
      data: {
        employeeId: sample[1].id, plantId: sample[1].plantId,
        type: 'PERMISO', severity: 'LEVE',
        title: 'Permiso por cita medica',
        description: 'Salio a las 11:00 por cita medica programada.',
        date: todayStr, time: '11:00', resolved: true,
      },
    });
  }
  if (sample[2]) {
    await prisma.incident.create({
      data: {
        employeeId: sample[2].id, plantId: sample[2].plantId,
        type: 'EMERGENCIA', severity: 'MODERADO',
        title: 'Malestar en planta',
        description: 'Trabajador presento mareos. Se retiro con acompanamiento.',
        date: todayStr, time: '14:15', autoExitApplied: true,
      },
    });
  }

  console.log(`\nAsistencia: ${attCount} registros`);
  console.log(`Comidas: ${mealCount}`);
  console.log(`Alertas: ${alertCount}`);
  console.log(`Incidentes: ${Math.min(3, sample.length)}`);
  console.log('\nSeed completado!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
