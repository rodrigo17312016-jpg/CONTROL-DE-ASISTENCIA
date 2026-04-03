'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import {
  UtensilsCrossed, Users, XCircle, CheckCircle2,
  RefreshCw, AlertTriangle, Clock, TrendingDown, ChefHat, Building2
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function KitchenPage() {
  const [data, setData] = useState<any>(null);
  const [plantCode, setPlantCode] = useState('P1');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const today = format(new Date(), 'yyyy-MM-dd');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/meals?plant=${plantCode}&date=${today}&view=kitchen`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [plantCode, today]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Cada 30s
    const clock = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => { clearInterval(interval); clearInterval(clock); };
  }, [fetchData]);

  const hour = currentTime.getHours();
  const activeMeal = hour >= 5 && hour < 15 ? 'ALMUERZO' : 'CENA';
  const mealData = activeMeal === 'ALMUERZO' ? data?.almuerzo : data?.cena;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                <ChefHat className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Control de Cocina</h1>
                <p className="text-sm text-gray-500">
                  {format(currentTime, "EEEE dd 'de' MMMM", { locale: es })} | {format(currentTime, 'HH:mm:ss')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={plantCode}
                onChange={(e) => setPlantCode(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="P1">Planta 1</option>
                <option value="P2">Planta 2</option>
              </select>
              <button onClick={fetchData} className="p-2 rounded-lg bg-orange-50 hover:bg-orange-100 transition-colors">
                <RefreshCw className="w-5 h-5 text-orange-600" />
              </button>
            </div>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* Active Meal Banner */}
          <div className={`rounded-2xl p-6 ${
            activeMeal === 'ALMUERZO'
              ? 'bg-gradient-to-r from-orange-500 to-amber-500'
              : 'bg-gradient-to-r from-indigo-600 to-purple-600'
          } text-white shadow-lg`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80 font-medium">COMIDA ACTIVA</p>
                <h2 className="text-4xl font-bold mt-1">{activeMeal}</h2>
                <p className="text-sm opacity-80 mt-1">
                  {activeMeal === 'ALMUERZO' ? '12:00 - 13:00 hrs' : '00:00 - 01:00 hrs'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-6xl font-bold">{mealData?.totalProgramados || 0}</p>
                <p className="text-sm opacity-80">raciones a preparar</p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-green-500" />
                <span className="text-xs font-semibold text-gray-500">PROGRAMADOS</span>
              </div>
              <p className="text-3xl font-bold text-green-700">{mealData?.totalProgramados || 0}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-blue-500" />
                <span className="text-xs font-semibold text-gray-500">SERVIDOS</span>
              </div>
              <p className="text-3xl font-bold text-blue-700">{mealData?.totalServidos || 0}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-5 h-5 text-red-500" />
                <span className="text-xs font-semibold text-gray-500">CANCELADOS</span>
              </div>
              <p className="text-3xl font-bold text-red-700">{mealData?.totalCancelados || 0}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-5 h-5 text-gray-500" />
                <span className="text-xs font-semibold text-gray-500">PENDIENTES</span>
              </div>
              <p className="text-3xl font-bold text-gray-700">
                {(mealData?.totalProgramados || 0) - (mealData?.totalServidos || 0)}
              </p>
            </div>
          </div>

          {/* By Area Breakdown */}
          {mealData?.byArea && Object.keys(mealData.byArea).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">Raciones por Area</h2>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(mealData.byArea).map(([area, count]: [string, any]) => (
                    <div key={area} className="bg-orange-50 rounded-lg p-3 border border-orange-100 text-center">
                      <p className="text-xs text-orange-600 font-medium">{area}</p>
                      <p className="text-2xl font-bold text-orange-800 mt-1">{count}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Cancellations Alert */}
          {mealData?.cancelaciones && mealData.cancelaciones.length > 0 && (
            <div className="bg-white rounded-xl border border-red-200 shadow-sm">
              <div className="px-5 py-4 border-b border-red-100 bg-red-50 rounded-t-xl">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <h2 className="text-lg font-bold text-red-800">Cancelaciones Recientes</h2>
                  <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {mealData.cancelaciones.length}
                  </span>
                </div>
                <p className="text-xs text-red-600 mt-1">Estas raciones ya NO se deben preparar</p>
              </div>
              <div className="divide-y divide-gray-50">
                {mealData.cancelaciones.map((cancel: any, idx: number) => (
                  <div key={idx} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{cancel.employee}</p>
                      <p className="text-xs text-gray-500">Motivo: {cancel.reason}</p>
                    </div>
                    {cancel.cancelledAt && (
                      <span className="text-xs text-gray-400">
                        {format(new Date(cancel.cancelledAt), 'HH:mm')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Both Meals Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Almuerzo */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100 bg-orange-50 rounded-t-xl">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="w-5 h-5 text-orange-600" />
                  <h3 className="font-bold text-orange-800">ALMUERZO</h3>
                </div>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-orange-700">{data?.almuerzo?.totalProgramados || 0}</p>
                    <p className="text-xs text-gray-500">Programados</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-700">{data?.almuerzo?.totalServidos || 0}</p>
                    <p className="text-xs text-gray-500">Servidos</p>
                  </div>
                </div>
                {(data?.almuerzo?.totalCancelados || 0) > 0 && (
                  <div className="mt-3 bg-red-50 rounded-lg px-3 py-2 text-center">
                    <p className="text-sm text-red-600 font-medium">-{data.almuerzo.totalCancelados} cancelados</p>
                  </div>
                )}
              </div>
            </div>

            {/* Cena */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100 bg-indigo-50 rounded-t-xl">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-indigo-800">CENA</h3>
                </div>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-indigo-700">{data?.cena?.totalProgramados || 0}</p>
                    <p className="text-xs text-gray-500">Programados</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-700">{data?.cena?.totalServidos || 0}</p>
                    <p className="text-xs text-gray-500">Servidos</p>
                  </div>
                </div>
                {(data?.cena?.totalCancelados || 0) > 0 && (
                  <div className="mt-3 bg-red-50 rounded-lg px-3 py-2 text-center">
                    <p className="text-sm text-red-600 font-medium">-{data.cena.totalCancelados} cancelados</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
