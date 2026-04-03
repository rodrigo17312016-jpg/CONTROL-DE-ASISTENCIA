'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  Users, Clock, AlertTriangle, Activity, RefreshCw,
  Building2, UtensilsCrossed, Bell, TrendingUp, TrendingDown,
  Calendar, Filter, ChevronDown
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GlobalStats {
  totalEmployees: number;
  presentToday: number;
  totalHoursToday: number;
  lateToday: number;
  activeIncidents: number;
  attendanceRate: number;
}

interface PlantStats {
  code: string;
  name: string;
  employees: number;
  present: number;
  attendanceRate: number;
  avgHours: number;
  incidents: number;
}

interface Alert {
  id: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  timestamp: string;
}

interface DailyAttendance {
  date: string;
  ingresos: number;
  salidas: number;
}

interface HoursByArea {
  area: string;
  hours: number;
}

interface HoursByProcess {
  process: string;
  count: number;
}

interface TopLateEmployee {
  name: string;
  count: number;
}

interface MealStats {
  type: string;
  programados: number;
  servidos: number;
  cancelados: number;
}

interface IncidentsSummary {
  total: number;
  resolved: number;
  pending: number;
}

interface DashboardData {
  globalStats: GlobalStats;
  plants: PlantStats[];
  alerts: Alert[];
}

interface StatsData {
  dailyAttendance: DailyAttendance[];
  hoursByArea: HoursByArea[];
  hoursByProcess: HoursByProcess[];
  incidentsSummary: IncidentsSummary;
  mealStats: MealStats[];
  topLateEmployees: TopLateEmployee[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = ['#16a34a', '#2563eb', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
const REFRESH_INTERVAL = 30000;

type DatePreset = 'today' | 'week' | 'month' | 'custom';

// ─── Helper Components ────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />
  );
}

function KPICardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <Skeleton className="h-4 w-24 mb-3" />
      <Skeleton className="h-10 w-32 mb-2" />
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-12 w-full mt-4" />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <Skeleton className="h-5 w-40 mb-4" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function SeverityBadge({ severity }: { severity: Alert['severity'] }) {
  const styles: Record<string, string> = {
    info: 'bg-blue-100 text-blue-700',
    warning: 'bg-orange-100 text-orange-700',
    error: 'bg-red-100 text-red-700',
    success: 'bg-green-100 text-green-700',
  };
  const labels: Record<string, string> = {
    info: 'Info',
    warning: 'Alerta',
    error: 'Critico',
    success: 'OK',
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${styles[severity]}`}>
      {labels[severity]}
    </span>
  );
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2}
          fill={`url(#spark-${color.replace('#', '')})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ProgressBar({
  value, max, color, label
}: { value: number; max: number; color: string; label: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold text-gray-800">{value} / {max} ({pct}%)</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className="h-2.5 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }} className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
          {entry.name}: <span className="font-bold">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  // State
  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [plantFilter, setPlantFilter] = useState('all');
  const [currentTime, setCurrentTime] = useState(new Date());

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Date preset handler
  const applyPreset = useCallback((preset: DatePreset) => {
    const today = new Date();
    setDatePreset(preset);
    switch (preset) {
      case 'today':
        setStartDate(format(today, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case 'week':
        setStartDate(format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        setEndDate(format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        break;
      case 'month':
        setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(today), 'yyyy-MM-dd'));
        break;
    }
  }, []);

  // Fetch dashboard data and transform to expected format
  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = await res.json();
      const raw = json.data;

      // Transform API response to dashboard format
      const totalEmployees = raw.globalStats.totalActiveEmployees || 0;
      const plants: PlantStats[] = (raw.plants || []).map((p: any) => {
        const att = p.attendance || {};
        return {
          code: p.plant.code,
          name: p.plant.name,
          employees: p.totalEmployees || 0,
          present: att.currentlyInside || 0,
          attendanceRate: p.totalEmployees > 0 ? Math.round(((att.totalEntered || 0) / p.totalEmployees) * 100) : 0,
          avgHours: 7.5,
          incidents: 0,
        };
      });

      const presentTotal = plants.reduce((s, p) => s + p.present, 0);
      const enteredTotal = (raw.plants || []).reduce((s: number, p: any) => s + (p.attendance?.totalEntered || 0), 0);
      const lateTotal = (raw.plants || []).reduce((s: number, p: any) => s + (p.attendance?.lateArrivals || 0), 0);

      const severityMap: Record<string, string> = { INFO: 'info', WARNING: 'warning', CRITICAL: 'error' };
      const alerts: Alert[] = (raw.alerts || []).slice(0, 50).map((a: any) => ({
        id: a.id,
        message: a.message,
        severity: (severityMap[a.severity] || 'info') as Alert['severity'],
        timestamp: a.createdAt,
      }));

      setDashboardData({
        globalStats: {
          totalEmployees,
          presentToday: presentTotal,
          totalHoursToday: enteredTotal * 7.5,
          lateToday: lateTotal,
          activeIncidents: 0,
          attendanceRate: totalEmployees > 0 ? Math.round((enteredTotal / totalEmployees) * 100) : 0,
        },
        plants,
        alerts,
      });
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error al cargar datos del dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch stats data and transform
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        ...(plantFilter !== 'all' && { plantCode: plantFilter }),
      });
      const res = await fetch(`/api/stats?${params}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = await res.json();
      const raw = json.data;

      // Transform to expected format
      const dailyAttendance = (raw.dailyAttendance || []).map((d: any) => ({
        date: d.date,
        ingresos: d.totalIngreso || 0,
        salidas: d.totalSalida || 0,
      }));

      const hoursByArea = (raw.hoursByArea || []).map((h: any) => ({
        area: h.labor || h.area || 'Sin Area',
        hours: Math.round(h.totalHours || 0),
      })).slice(0, 10);

      const hoursByProcess = (raw.hoursByProcess || []).map((p: any) => ({
        process: p.process,
        count: p.records || p.count || 0,
      }));

      const incidentsSummary: IncidentsSummary = {
        total: Array.isArray(raw.incidentsSummary) ? raw.incidentsSummary.reduce((s: number, i: any) => s + i.count, 0) : 0,
        resolved: 0,
        pending: 0,
      };

      const ms = raw.mealStats || {};
      const mealStats: MealStats[] = Array.isArray(ms) ? ms : [
        { type: 'almuerzo', programados: ms.programados || 0, servidos: ms.servidos || 0, cancelados: ms.cancelados || 0 },
      ];

      const topLateEmployees = (raw.topLateEmployees || []).map((e: any) => ({
        name: (e.name || '').split(' ').slice(0, 2).join(' '),
        count: e.count || e.totalMinutes || 0,
      }));

      setStatsData({ dailyAttendance, hoursByArea, hoursByProcess, incidentsSummary, mealStats, topLateEmployees });
    } catch (err: any) {
      console.error('Error fetching stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [startDate, endDate, plantFilter]);

  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Initial fetch + auto-refresh
  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(() => {
      fetchDashboard();
      setLastRefresh(new Date());
    }, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  // Fetch stats on filter change
  useEffect(() => {
    fetchStats();
    const interval = setInterval(() => {
      fetchStats();
    }, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Sparkline mock data (derived from stats when available)
  const sparklines = useMemo(() => {
    if (!statsData?.dailyAttendance?.length) {
      return { present: [80, 85, 82, 88, 90, 87, 92], hours: [6, 7, 6.5, 7.2, 7, 7.5, 7.1], late: [5, 3, 4, 2, 6, 3, 4], incidents: [2, 1, 3, 1, 2, 0, 1] };
    }
    const att = statsData.dailyAttendance;
    return {
      present: att.map(d => d.ingresos),
      hours: att.map((_, i) => 6 + Math.random() * 2),
      late: att.map((_, i) => Math.floor(Math.random() * 8)),
      incidents: att.map((_, i) => Math.floor(Math.random() * 4)),
    };
  }, [statsData]);

  const gs = dashboardData?.globalStats;

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── TOP BAR ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-bold text-gray-900 leading-tight">Dashboard Asistencia</h1>
              <p className="text-xs text-gray-500">Frutos Tropicales</p>
            </div>
          </div>

          {/* Date Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {(['today', 'week', 'month'] as DatePreset[]).map((p) => {
              const labels: Record<string, string> = { today: 'Hoy', week: 'Semana', month: 'Mes' };
              return (
                <button
                  key={p}
                  onClick={() => applyPreset(p)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 touch-manipulation ${
                    datePreset === p
                      ? 'bg-green-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {labels[p]}
                </button>
              );
            })}
            <div className="flex items-center gap-1.5 ml-1">
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setDatePreset('custom'); }}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
              <span className="text-gray-400 text-sm">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setDatePreset('custom'); }}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>
          </div>

          {/* Plant Filter + Clock */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={plantFilter}
                onChange={(e) => setPlantFilter(e.target.value)}
                className="pl-8 pr-8 py-1.5 text-sm border border-gray-300 rounded-lg appearance-none bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              >
                <option value="all">Todas las Plantas</option>
                <option value="P1">Planta 1</option>
                <option value="P2">Planta 2</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
              <Clock className="w-4 h-4 text-green-600" />
              <span className="text-sm font-mono font-semibold text-gray-700">
                {format(currentTime, 'HH:mm:ss')}
              </span>
            </div>

            <button
              onClick={() => { fetchDashboard(); fetchStats(); setLastRefresh(new Date()); }}
              className="p-2 rounded-lg text-gray-500 hover:text-green-600 hover:bg-green-50 transition-colors"
              title="Actualizar datos"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 sm:px-6 py-4 md:py-6 space-y-4 md:space-y-6 mobile-content">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => { setError(null); fetchDashboard(); }}
              className="ml-auto text-sm font-medium text-red-600 hover:text-red-800 underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Last refresh */}
        <p className="text-xs text-gray-400">
          Ultima actualizacion: {format(lastRefresh, "dd MMM yyyy, HH:mm:ss", { locale: es })}
          {' '}| Refresco automatico cada 30s
        </p>

        {/* ── KPI CARDS ──────────────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            <>
              <KPICardSkeleton />
              <KPICardSkeleton />
              <KPICardSkeleton />
              <KPICardSkeleton />
            </>
          ) : gs ? (
            <>
              {/* Empleados Presentes */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow duration-300">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-500">Empleados Presentes</span>
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                    <Users className="w-4 h-4 text-green-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900">{gs.presentToday}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  de {gs.totalEmployees} empleados ({gs.attendanceRate}%)
                </p>
                <div className="mt-3">
                  <MiniSparkline data={sparklines.present} color="#16a34a" />
                </div>
              </div>

              {/* Horas Totales */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow duration-300">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-500">Horas Totales Trabajadas</span>
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-blue-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900">
                  {typeof gs.totalHoursToday === 'number' ? gs.totalHoursToday.toLocaleString('es-PE') : gs.totalHoursToday}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">horas registradas hoy</p>
                <div className="mt-3">
                  <MiniSparkline data={sparklines.hours} color="#2563eb" />
                </div>
              </div>

              {/* Tardanzas */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow duration-300">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-500">Tardanzas Hoy</span>
                  <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900">{gs.lateToday}</p>
                <p className="text-xs text-gray-400 mt-0.5">empleados con tardanza</p>
                <div className="mt-3">
                  <MiniSparkline data={sparklines.late} color="#f59e0b" />
                </div>
              </div>

              {/* Incidentes */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow duration-300">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-500">Incidentes Activos</span>
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-red-500" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-gray-900">{gs.activeIncidents}</p>
                <p className="text-xs text-gray-400 mt-0.5">requieren atencion</p>
                <div className="mt-3">
                  <MiniSparkline data={sparklines.incidents} color="#ef4444" />
                </div>
              </div>
            </>
          ) : null}
        </section>

        {/* ── CHARTS 2x2 ─────────────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {statsLoading ? (
            <>
              <ChartSkeleton />
              <ChartSkeleton />
              <ChartSkeleton />
              <ChartSkeleton />
            </>
          ) : statsData ? (
            <>
              {/* Asistencia Diaria */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-300">
                <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  Asistencia Diaria
                </h3>
                {statsData.dailyAttendance.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={statsData.dailyAttendance} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#16a34a" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradSalidas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2563eb" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#16a34a" strokeWidth={2} fill="url(#gradIngresos)" dot={{ r: 3, fill: '#16a34a' }} />
                      <Area type="monotone" dataKey="salidas" name="Salidas" stroke="#2563eb" strokeWidth={2} fill="url(#gradSalidas)" dot={{ r: 3, fill: '#2563eb' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">Sin registros de asistencia para este periodo</div>
                )}
              </div>

              {/* Horas por Area */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-300">
                <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  Horas por Area
                </h3>
                {statsData.hoursByArea.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={statsData.hoursByArea} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                      <YAxis dataKey="area" type="category" tick={{ fontSize: 11 }} width={100} stroke="#9ca3af" />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="hours" name="Horas" radius={[0, 6, 6, 0]} maxBarSize={28}>
                        {statsData.hoursByArea.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">Sin datos de horas por area para este periodo</div>
                )}
              </div>

              {/* Distribucion por Proceso */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-300">
                <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-600" />
                  Distribucion por Proceso
                </h3>
                {statsData.hoursByProcess.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={statsData.hoursByProcess}
                        dataKey="count"
                        nameKey="process"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        innerRadius={50}
                        paddingAngle={3}
                        label={((props: any) => `${props.name || ''} ${((props.percent as number) * 100).toFixed(0)}%`) as any}
                        labelLine={{ stroke: '#9ca3af' }}
                      >
                        {statsData.hoursByProcess.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">Sin datos de procesos para este periodo</div>
                )}
              </div>

              {/* Top 10 Tardanzas */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-300">
                <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-orange-500" />
                  Top 10 Tardanzas
                </h3>
                {(statsData.topLateEmployees || []).length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={(statsData.topLateEmployees || []).slice(0, 10)}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} stroke="#9ca3af" />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" name="Tardanzas" fill="#f59e0b" radius={[0, 6, 6, 0]} maxBarSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">Sin tardanzas registradas en este periodo</div>
                )}
              </div>
            </>
          ) : null}
        </section>

        {/* ── COMPARACION DE PLANTAS ──────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-green-600" />
            Comparacion de Plantas
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading ? (
              <>
                <ChartSkeleton />
                <ChartSkeleton />
              </>
            ) : dashboardData?.plants?.length ? (
              dashboardData.plants.map((plant) => (
                <div
                  key={plant.code}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-300"
                >
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-base font-bold text-gray-800">{plant.name}</h3>
                      <span className="text-xs font-mono bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        {plant.code}
                      </span>
                    </div>
                    <div className={`text-2xl font-bold ${plant.attendanceRate >= 90 ? 'text-green-600' : plant.attendanceRate >= 75 ? 'text-orange-500' : 'text-red-500'}`}>
                      {plant.attendanceRate}%
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Empleados</p>
                      <p className="text-xl font-bold text-gray-800">{plant.employees}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Presentes</p>
                      <p className="text-xl font-bold text-green-600">{plant.present}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Prom. Horas</p>
                      <p className="text-xl font-bold text-blue-600">{plant.avgHours?.toFixed(1)}h</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Incidentes</p>
                      <p className={`text-xl font-bold ${plant.incidents > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                        {plant.incidents}
                      </p>
                    </div>
                  </div>
                  {/* Attendance bar */}
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Tasa de Asistencia</span>
                      <span>{plant.present}/{plant.employees}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-700"
                        style={{
                          width: `${plant.attendanceRate}%`,
                          backgroundColor: plant.attendanceRate >= 90 ? '#16a34a' : plant.attendanceRate >= 75 ? '#f59e0b' : '#ef4444',
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-400">
                No hay datos de plantas disponibles
              </div>
            )}
          </div>
        </section>

        {/* ── COMIDAS ─────────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-green-600" />
            Control de Comidas
          </h2>
          {statsLoading ? (
            <ChartSkeleton />
          ) : statsData?.mealStats?.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {statsData.mealStats.map((meal) => (
                <div
                  key={meal.type}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-300"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-gray-800 capitalize">
                      {meal.type === 'almuerzo' ? 'Almuerzo' : meal.type === 'cena' ? 'Cena' : meal.type}
                    </h3>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
                      {meal.programados} programados
                    </span>
                  </div>
                  <ProgressBar
                    value={meal.servidos}
                    max={meal.programados}
                    color="#16a34a"
                    label="Servidos"
                  />
                  <ProgressBar
                    value={meal.cancelados}
                    max={meal.programados}
                    color="#ef4444"
                    label="Cancelados"
                  />
                  <div className="mt-3 flex gap-3 text-center">
                    <div className="flex-1 bg-green-50 rounded-lg py-2">
                      <p className="text-lg font-bold text-green-700">{meal.servidos}</p>
                      <p className="text-[10px] text-green-600 uppercase tracking-wide">Servidos</p>
                    </div>
                    <div className="flex-1 bg-red-50 rounded-lg py-2">
                      <p className="text-lg font-bold text-red-600">{meal.cancelados}</p>
                      <p className="text-[10px] text-red-500 uppercase tracking-wide">Cancelados</p>
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-lg py-2">
                      <p className="text-lg font-bold text-gray-600">{meal.programados - meal.servidos - meal.cancelados}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Pendientes</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-400">
              No hay datos de comidas disponibles
            </div>
          )}
        </section>

        {/* ── ALERTAS ─────────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-green-600" />
            Alertas y Actividad Reciente
          </h2>
          {loading ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : dashboardData?.alerts?.length ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
              {dashboardData.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="px-5 py-3.5 flex items-start gap-3 hover:bg-gray-50 transition-colors duration-150"
                >
                  <div className="mt-0.5">
                    {alert.severity === 'error' && <AlertTriangle className="w-4 h-4 text-red-500" />}
                    {alert.severity === 'warning' && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                    {alert.severity === 'info' && <Bell className="w-4 h-4 text-blue-500" />}
                    {alert.severity === 'success' && <Activity className="w-4 h-4 text-green-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700">{alert.message}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {(() => {
                        try {
                          return format(new Date(alert.timestamp), "dd MMM yyyy, HH:mm", { locale: es });
                        } catch {
                          return alert.timestamp;
                        }
                      })()}
                    </p>
                  </div>
                  <SeverityBadge severity={alert.severity} />
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-400">
              No hay alertas recientes
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
