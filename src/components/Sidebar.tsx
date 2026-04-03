'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ScanLine, Users, UtensilsCrossed,
  FileBarChart, CreditCard, Leaf, BarChart3, Shield,
  CloudOff, Cloud, RefreshCw
} from 'lucide-react';
import { useState, useEffect } from 'react';

const navItems = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard', description: 'Vista general' },
  { href: '/dashboard', icon: BarChart3, label: 'Analytics', description: 'Dashboard avanzado' },
  { href: '/scan', icon: ScanLine, label: 'Escanear', description: 'Registro QR' },
  { href: '/kitchen', icon: UtensilsCrossed, label: 'Cocina', description: 'Control comidas' },
  { href: '/employees', icon: Users, label: 'Empleados', description: 'Gestion personal' },
  { href: '/incidents', icon: Shield, label: 'Incidentes', description: 'Emergencias' },
  { href: '/cards', icon: CreditCard, label: 'Tarjetas QR', description: 'Generar tarjetas' },
  { href: '/reports', icon: FileBarChart, label: 'Reportes', description: 'Informes' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [syncStatus, setSyncStatus] = useState({ pending: 0, synced: 0, failed: 0 });
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  useEffect(() => {
    const fetchSync = async () => {
      try {
        const res = await fetch('/api/sync');
        const data = await res.json();
        if (data.success) setSyncStatus(data.data);
      } catch {}
    };
    fetchSync();
    const interval = setInterval(fetchSync, 30000);
    return () => clearInterval(interval);
  }, []);

  const triggerSync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/sync', { method: 'POST' });
      const res = await fetch('/api/sync');
      const data = await res.json();
      if (data.success) setSyncStatus(data.data);
    } catch {} finally { setSyncing(false); }
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col min-h-screen shadow-sm">
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
            <Leaf className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-800 text-sm leading-tight">FRUTOS TROPICALES</h1>
            <p className="text-[10px] text-gray-400 font-medium tracking-wider">CONTROL DE PLANTA</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                isActive
                  ? 'bg-green-50 text-green-700 shadow-sm border border-green-100'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
              }`}>
              <item.icon className={`w-5 h-5 ${isActive ? 'text-green-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
              <div>
                <p className={`text-sm font-medium ${isActive ? 'text-green-700' : ''}`}>{item.label}</p>
                <p className="text-[10px] text-gray-400">{item.description}</p>
              </div>
              {item.href === '/incidents' && syncStatus.failed > 0 && (
                <span className="ml-auto w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Sync Status */}
      <div className="px-4 pb-2">
        <div className={`rounded-lg p-3 border ${isOnline ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              {isOnline ? <Cloud className="w-3.5 h-3.5 text-green-600" /> : <CloudOff className="w-3.5 h-3.5 text-red-500" />}
              <span className={`text-xs font-medium ${isOnline ? 'text-green-700' : 'text-red-600'}`}>
                {isOnline ? 'En linea' : 'Sin conexion'}
              </span>
            </div>
            {isOnline && syncStatus.pending > 0 && (
              <button onClick={triggerSync} disabled={syncing}
                className="p-1 hover:bg-green-100 rounded transition-colors">
                <RefreshCw className={`w-3 h-3 text-green-600 ${syncing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
          {syncStatus.pending > 0 && (
            <p className="text-[10px] text-amber-600">{syncStatus.pending} registros pendientes de sincronizar</p>
          )}
          {syncStatus.failed > 0 && (
            <p className="text-[10px] text-red-500">{syncStatus.failed} registros con error</p>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-green-700 font-medium">Sistema Activo</span>
          <span className="text-[10px] text-gray-400 ml-auto">v2.0 Premium</span>
        </div>
      </div>
    </aside>
  );
}
