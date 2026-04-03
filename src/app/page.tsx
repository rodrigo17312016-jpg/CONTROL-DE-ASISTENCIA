'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import {
  Users, Clock, LogIn, LogOut, AlertTriangle, UtensilsCrossed,
  TrendingUp, Building2, RefreshCw, Bell, CheckCircle2, XCircle, Timer
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DashboardData {
  date: string;
  globalStats: { totalActiveEmployees: number; totalPlants: number; todayRecords: number };
  plants: Array<{
    plant: { id: string; name: string; code: string };
    totalEmployees: number;
    attendance: any;
    meals: { almuerzo: any; cena: any };
  }>;
  alerts: Array<{
    id: string; type: string; severity: string; title: string;
    message: string; createdAt: string; resolved: boolean;
    employee?: { firstName: string; lastName: string };
  }>;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error('Error fetching dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const dataInterval = setInterval(fetchData, 15000);
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => { clearInterval(dataInterval); clearInterval(clockInterval); };
  }, [fetchData]);

  const resolveAlert = async (alertId: string) => {
    await fetch('/api/alerts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId, resolvedBy: 'Supervisor' }),
    });
    fetchData();
  };

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-50 border-red-200 text-red-800';
      case 'WARNING': return 'bg-amber-50 border-amber-200 text-amber-800';
      default: return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const severityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'WARNING': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default: return <Bell className="w-4 h-4 text-blue-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-500 font-medium">Cargando sistema...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Dashboard General</h1>
              <p className="text-sm text-gray-500">
                {format(currentTime, "EEEE, dd 'de' MMMM yyyy", { locale: es })}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-3xl font-bold text-green-700 tabular-nums">
                  {format(currentTime, 'HH:mm:ss')}
                </p>
                <p className="text-xs text-gray-400">
                  Turno activo: <span className="font-semibold text-green-600">
                    {currentTime.getHours() >= 7 && currentTime.getHours() < 19 ? 'DIA' : 'NOCHE'}
                  </span>
                </p>
              </div>
              <button onClick={fetchData} className="p-2 rounded-lg bg-green-50 hover:bg-green-100 transition-colors">
                <RefreshCw className="w-5 h-5 text-green-600" />
              </button>
            </div>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* Global Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard icon={<Users className="w-6 h-6" />} label="Empleados Activos" value={data?.globalStats.totalActiveEmployees || 0} color="green" />
            <StatCard icon={<Building2 className="w-6 h-6" />} label="Plantas Operativas" value={data?.globalStats.totalPlants || 0} color="blue" />
            <StatCard icon={<Clock className="w-6 h-6" />} label="Registros Hoy" value={data?.globalStats.todayRecords || 0} color="purple" />
            <StatCard icon={<AlertTriangle className="w-6 h-6" />} label="Alertas Pendientes" value={data?.alerts.length || 0} color={data?.alerts.length ? 'red' : 'gray'} />
          </div>

          {/* Plants Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {data?.plants.map((plant) => (
              <div key={plant.plant.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-6 h-6 text-white/80" />
                      <div>
                        <h2 className="text-lg font-bold text-white">{plant.plant.name}</h2>
                        <p className="text-green-100 text-xs">Codigo: {plant.plant.code}</p>
                      </div>
                    </div>
                    <div className="bg-white/20 backdrop-blur rounded-lg px-3 py-1.5">
                      <p className="text-white text-sm font-bold">{plant.totalEmployees} empleados</p>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <MiniStat icon={<LogIn className="w-5 h-5 text-green-600" />} value={plant.attendance?.currentlyInside || 0} label="DENTRO" bg="bg-green-50 border-green-100" />
                    <MiniStat icon={<TrendingUp className="w-5 h-5 text-blue-600" />} value={plant.attendance?.totalEntered || 0} label="INGRESARON" bg="bg-blue-50 border-blue-100" />
                    <MiniStat icon={<LogOut className="w-5 h-5 text-gray-500" />} value={plant.attendance?.totalExited || 0} label="SALIERON" bg="bg-gray-50 border-gray-200" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 bg-amber-400 rounded-full"></div>
                        <span className="text-xs font-semibold text-amber-700">TURNO DIA</span>
                      </div>
                      <p className="text-xl font-bold text-amber-800">
                        {plant.attendance?.byShift?.DIA?.inside || 0}
                        <span className="text-xs font-normal text-amber-600"> / {plant.attendance?.byShift?.DIA?.entered || 0}</span>
                      </p>
                    </div>
                    <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 bg-indigo-400 rounded-full"></div>
                        <span className="text-xs font-semibold text-indigo-700">TURNO NOCHE</span>
                      </div>
                      <p className="text-xl font-bold text-indigo-800">
                        {plant.attendance?.byShift?.NOCHE?.inside || 0}
                        <span className="text-xs font-normal text-indigo-600"> / {plant.attendance?.byShift?.NOCHE?.entered || 0}</span>
                      </p>
                    </div>
                  </div>

                  <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
                    <div className="flex items-center gap-2 mb-2">
                      <UtensilsCrossed className="w-4 h-4 text-orange-600" />
                      <span className="text-xs font-semibold text-orange-700">COMIDAS HOY</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-orange-600">Almuerzos</p>
                        <p className="text-lg font-bold text-orange-800">{plant.meals.almuerzo?.totalProgramados || 0}</p>
                        {(plant.meals.almuerzo?.totalCancelados || 0) > 0 && (
                          <p className="text-xs text-red-500">-{plant.meals.almuerzo.totalCancelados} cancelados</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-orange-600">Cenas</p>
                        <p className="text-lg font-bold text-orange-800">{plant.meals.cena?.totalProgramados || 0}</p>
                        {(plant.meals.cena?.totalCancelados || 0) > 0 && (
                          <p className="text-xs text-red-500">-{plant.meals.cena.totalCancelados} cancelados</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {(plant.attendance?.lateArrivals || 0) > 0 && (
                    <div className="flex items-center gap-2 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
                      <Timer className="w-4 h-4 text-red-500" />
                      <span className="text-xs text-red-700 font-medium">{plant.attendance.lateArrivals} tardanzas hoy</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Alerts */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <Bell className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-bold text-gray-800">Alertas Recientes</h2>
              {(data?.alerts.length || 0) > 0 && (
                <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{data?.alerts.length}</span>
              )}
            </div>
            <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
              {data?.alerts.length === 0 ? (
                <div className="p-8 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-300 mx-auto mb-2" />
                  <p className="text-gray-400 font-medium">Sin alertas pendientes</p>
                </div>
              ) : (
                data?.alerts.map((alert) => (
                  <div key={alert.id} className={`px-5 py-3 flex items-start gap-3 animate-fade-in border-l-4 ${severityColor(alert.severity)}`}>
                    {severityIcon(alert.severity)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{alert.title}</p>
                      <p className="text-xs mt-0.5 opacity-80">{alert.message}</p>
                      <p className="text-[10px] mt-1 opacity-60">{format(new Date(alert.createdAt), 'HH:mm:ss')}</p>
                    </div>
                    <button onClick={() => resolveAlert(alert.id)} className="text-xs px-2 py-1 rounded bg-white/50 hover:bg-white/80 font-medium transition-colors">
                      Resolver
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    green: 'bg-green-50 border-green-100 text-green-700',
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    purple: 'bg-purple-50 border-purple-100 text-purple-700',
    red: 'bg-red-50 border-red-100 text-red-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
  };
  const iconColors: Record<string, string> = {
    green: 'text-green-500', blue: 'text-blue-500', purple: 'text-purple-500', red: 'text-red-500', gray: 'text-gray-400',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium opacity-70">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        <div className={iconColors[color]}>{icon}</div>
      </div>
    </div>
  );
}

function MiniStat({ icon, value, label, bg }: { icon: React.ReactNode; value: number; label: string; bg: string }) {
  return (
    <div className={`rounded-lg p-3 text-center border ${bg}`}>
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-[10px] font-medium opacity-70">{label}</p>
    </div>
  );
}
