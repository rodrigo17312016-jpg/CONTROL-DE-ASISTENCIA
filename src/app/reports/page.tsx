'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import {
  FileBarChart, Calendar, Download, Clock, Users, AlertTriangle,
  UtensilsCrossed, LogIn, LogOut, Sun, Moon, Building2
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ReportsPage() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [plantCode, setPlantCode] = useState('P1');
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [mealData, setMealData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [attRes, mealRes] = await Promise.all([
      fetch(`/api/attendance?plant=${plantCode}&date=${date}`),
      fetch(`/api/meals?plant=${plantCode}&date=${date}&view=kitchen`),
    ]);
    const attJson = await attRes.json();
    const mealJson = await mealRes.json();
    if (attJson.success) setAttendanceData(attJson.data);
    if (mealJson.success) setMealData(mealJson.data);
    setLoading(false);
  }, [date, plantCode]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const exportCSV = () => {
    if (!attendanceData?.records) return;
    const headers = 'Empleado,DNI,Tipo,Turno,Area,Accion,Hora,Tarde,Min Tarde\n';
    const rows = attendanceData.records.map((r: any) =>
      `${r.employee.firstName} ${r.employee.lastName},${r.employee.code},${r.employee.type},${r.employee.shift},${r.employee.area || ''},${r.type},${format(new Date(r.timestamp), 'HH:mm:ss')},${r.isLate ? 'SI' : 'NO'},${r.minutesLate}`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asistencia_${plantCode}_${date}.csv`;
    a.click();
  };

  const records = attendanceData?.records || [];
  const hoursWorked = attendanceData?.hoursWorked || {};

  // Calculate stats
  const uniqueEmployees = new Set(records.map((r: any) => r.employeeId));
  const lateCount = records.filter((r: any) => r.isLate).length;
  const earlyCount = records.filter((r: any) => r.isEarly).length;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Reportes</h1>
              <p className="text-sm text-gray-500">Informes detallados de asistencia y comidas</p>
            </div>
            <button onClick={exportCSV} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors">
              <Download className="w-4 h-4" /> Exportar CSV
            </button>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-xl border shadow-sm p-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <select value={plantCode} onChange={(e) => setPlantCode(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="P1">Planta 1</option>
              <option value="P2">Planta 2</option>
            </select>
            <div className="flex gap-1">
              {[-2, -1, 0].map(offset => {
                const d = subDays(new Date(), -offset);
                const dStr = format(d, 'yyyy-MM-dd');
                return (
                  <button key={offset} onClick={() => setDate(dStr)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      date === dStr ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {offset === 0 ? 'Hoy' : offset === 1 ? 'Ayer' : format(d, 'dd MMM', { locale: es })}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <ReportStat icon={<Users className="w-5 h-5 text-green-500" />} label="Empleados" value={uniqueEmployees.size} />
            <ReportStat icon={<LogIn className="w-5 h-5 text-blue-500" />} label="Total Registros" value={records.length} />
            <ReportStat icon={<AlertTriangle className="w-5 h-5 text-red-500" />} label="Tardanzas" value={lateCount} />
            <ReportStat icon={<LogOut className="w-5 h-5 text-amber-500" />} label="Salidas Anticipadas" value={earlyCount} />
            <ReportStat icon={<UtensilsCrossed className="w-5 h-5 text-orange-500" />} label="Comidas Servidas"
              value={(mealData?.almuerzo?.totalServidos || 0) + (mealData?.cena?.totalServidos || 0)} />
          </div>

          {/* Meal Report */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MealReportCard title="ALMUERZO" data={mealData?.almuerzo} color="orange" />
            <MealReportCard title="CENA" data={mealData?.cena} color="indigo" />
          </div>

          {/* Hours Worked Table */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Detalle de Asistencia</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">EMPLEADO</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">TIPO</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">TURNO</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">ACCION</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">HORA</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">ESTADO</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">HORAS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {records.map((record: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <p className="text-sm font-medium text-gray-800">{record.employee.firstName} {record.employee.lastName}</p>
                        <p className="text-xs text-gray-400">{record.employee.area}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          record.employee.type === 'OPERATIVO' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}>{record.employee.type}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 text-xs ${
                          record.shift === 'DIA' ? 'text-amber-600' : 'text-indigo-600'
                        }`}>
                          {record.shift === 'DIA' ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
                          {record.shift}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          record.type === 'INGRESO' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {record.type === 'INGRESO' ? <LogIn className="w-3 h-3" /> : <LogOut className="w-3 h-3" />}
                          {record.type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-600 tabular-nums">
                        {format(new Date(record.timestamp), 'HH:mm:ss')}
                      </td>
                      <td className="px-4 py-2.5">
                        {record.isLate && <span className="text-xs text-red-600 font-medium">Tarde ({record.minutesLate}m)</span>}
                        {record.isEarly && <span className="text-xs text-amber-600 font-medium">Anticipada ({record.minutesEarly}m)</span>}
                        {!record.isLate && !record.isEarly && <span className="text-xs text-green-600">A tiempo</span>}
                      </td>
                      <td className="px-4 py-2.5 text-sm font-medium text-gray-700 tabular-nums">
                        {hoursWorked[record.employeeId]?.hours
                          ? `${hoursWorked[record.employeeId].hours}h`
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {records.length === 0 && (
                <div className="p-12 text-center">
                  <FileBarChart className="w-16 h-16 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400">Sin registros para esta fecha</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function ReportStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs font-semibold text-gray-500">{label}</span></div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  );
}

function MealReportCard({ title, data, color }: { title: string; data: any; color: string }) {
  const colors: Record<string, { bg: string; border: string; text: string; header: string }> = {
    orange: { bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-800', header: 'bg-orange-100' },
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-800', header: 'bg-indigo-100' },
  };
  const c = colors[color];

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden`}>
      <div className={`px-5 py-3 ${c.header}`}>
        <div className="flex items-center gap-2">
          <UtensilsCrossed className={`w-4 h-4 ${c.text}`} />
          <h3 className={`font-bold ${c.text}`}>{title}</h3>
        </div>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-4 gap-3 text-center">
          <div><p className="text-xl font-bold text-green-700">{data?.totalProgramados || 0}</p><p className="text-[10px] text-gray-500">Programados</p></div>
          <div><p className="text-xl font-bold text-blue-700">{data?.totalServidos || 0}</p><p className="text-[10px] text-gray-500">Servidos</p></div>
          <div><p className="text-xl font-bold text-red-700">{data?.totalCancelados || 0}</p><p className="text-[10px] text-gray-500">Cancelados</p></div>
          <div><p className="text-xl font-bold text-gray-700">{data?.totalNoPresentados || 0}</p><p className="text-[10px] text-gray-500">No Present.</p></div>
        </div>
      </div>
    </div>
  );
}
