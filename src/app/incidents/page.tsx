'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield, AlertTriangle, Ambulance, Clock, User, Building2,
  Plus, X, CheckCircle2, FileWarning, Search, Filter, CalendarDays
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type Incident = {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  date: string;
  time: string;
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolution: string | null;
  autoExitApplied: boolean;
  employee: { firstName: string; lastName: string; code: string; dni: string; area: string };
  plant: { name: string; code: string };
  createdAt: string;
};

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  ACCIDENTE: { label: 'Accidente', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', icon: Ambulance },
  EMERGENCIA: { label: 'Emergencia', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', icon: AlertTriangle },
  PERMISO: { label: 'Permiso', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: Clock },
  FALTA_JUSTIFICADA: { label: 'Falta Justificada', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', icon: FileWarning },
  ABANDONO: { label: 'Abandono', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', icon: Shield },
  OTRO: { label: 'Otro', color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20', icon: FileWarning },
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  LEVE: { label: 'Leve', color: 'text-green-400', dot: 'bg-green-400' },
  MODERADO: { label: 'Moderado', color: 'text-yellow-400', dot: 'bg-yellow-400' },
  GRAVE: { label: 'Grave', color: 'text-orange-400', dot: 'bg-orange-400' },
  CRITICO: { label: 'Critico', color: 'text-red-400', dot: 'bg-red-400' },
};

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('');
  const [filterResolved, setFilterResolved] = useState('false');
  const [searchTerm, setSearchTerm] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [resolution, setResolution] = useState('');

  const [newIncident, setNewIncident] = useState({
    employeeId: '', plantCode: 'P1', type: 'ACCIDENTE', severity: 'GRAVE',
    title: '', description: '', date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm'), autoExitApplied: true,
  });

  const fetchIncidents = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterType) params.set('type', filterType);
      params.set('resolved', filterResolved);
      const res = await fetch(`/api/incidents?${params}`);
      const data = await res.json();
      if (data.success) setIncidents(data.data);
    } catch (err) {
      console.error('Error fetching incidents:', err);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterResolved]);

  useEffect(() => { fetchIncidents(); }, [fetchIncidents]);

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(d => {
      if (d.success) setEmployees(d.data);
    });
  }, []);

  const handleCreate = async () => {
    if (!newIncident.employeeId || !newIncident.title) return;
    try {
      const res = await fetch('/api/incidents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newIncident),
      });
      const data = await res.json();
      if (data.success) {
        setShowNewModal(false);
        setNewIncident({ employeeId: '', plantCode: 'P1', type: 'ACCIDENTE', severity: 'GRAVE',
          title: '', description: '', date: format(new Date(), 'yyyy-MM-dd'),
          time: format(new Date(), 'HH:mm'), autoExitApplied: true });
        fetchIncidents();
      }
    } catch (err) { console.error(err); }
  };

  const handleResolve = async (id: string) => {
    try {
      await fetch(`/api/incidents/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: true, resolution, resolvedBy: 'Supervisor' }),
      });
      setShowResolveModal(null);
      setResolution('');
      fetchIncidents();
    } catch (err) { console.error(err); }
  };

  const filteredIncidents = incidents.filter(i => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return i.employee.firstName.toLowerCase().includes(term) ||
             i.employee.lastName.toLowerCase().includes(term) ||
             i.title.toLowerCase().includes(term);
    }
    return true;
  });

  const stats = {
    total: incidents.length,
    active: incidents.filter(i => !i.resolved).length,
    accidents: incidents.filter(i => i.type === 'ACCIDENTE').length,
    critical: incidents.filter(i => i.severity === 'CRITICO' || i.severity === 'GRAVE').length,
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Use existing sidebar from layout */}
      <div className="flex-1 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Shield className="w-7 h-7 text-red-500" />
              Incidentes y Emergencias
            </h1>
            <p className="text-gray-500 text-sm mt-1">Registro y seguimiento de incidentes en planta</p>
          </div>
          <button onClick={() => setShowNewModal(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-lg shadow-red-500/20">
            <Plus className="w-4 h-4" />
            Nuevo Incidente
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total', value: stats.total, color: 'text-gray-700', bg: 'bg-white' },
            { label: 'Activos', value: stats.active, color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'Accidentes', value: stats.accidents, color: 'text-orange-600', bg: 'bg-orange-50' },
            { label: 'Graves/Criticos', value: stats.critical, color: 'text-red-700', bg: 'bg-red-50' },
          ].map((s, i) => (
            <div key={i} className={`${s.bg} border rounded-xl p-4`}>
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="Buscar por nombre o titulo..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" />
          </div>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm">
            <option value="">Todos los tipos</option>
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
          <select value={filterResolved} onChange={(e) => setFilterResolved(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm">
            <option value="false">Activos</option>
            <option value="true">Resueltos</option>
            <option value="">Todos</option>
          </select>
        </div>

        {/* Incidents List */}
        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white border rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-gray-100 rounded w-2/3"></div>
              </div>
            ))
          ) : filteredIncidents.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No se encontraron incidentes</p>
            </div>
          ) : (
            filteredIncidents.map(inc => {
              const typeConfig = TYPE_CONFIG[inc.type] || TYPE_CONFIG.OTRO;
              const sevConfig = SEVERITY_CONFIG[inc.severity] || SEVERITY_CONFIG.LEVE;
              const Icon = typeConfig.icon;

              return (
                <div key={inc.id} className={`bg-white border rounded-xl p-4 hover:shadow-md transition-shadow ${
                  inc.resolved ? 'opacity-60' : ''
                }`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl ${typeConfig.bg} border flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-6 h-6 ${typeConfig.color}`} />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-800">{inc.title}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${typeConfig.bg} border ${typeConfig.color}`}>
                          {typeConfig.label.toUpperCase()}
                        </span>
                        <span className={`flex items-center gap-1 text-[10px] font-medium ${sevConfig.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sevConfig.dot}`}></span>
                          {sevConfig.label}
                        </span>
                        {inc.resolved && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-green-100 text-green-700 font-bold">
                            RESUELTO
                          </span>
                        )}
                      </div>

                      <p className="text-gray-600 text-sm">{inc.description}</p>

                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {inc.employee.firstName} {inc.employee.lastName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {inc.plant.code}
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {inc.date} {inc.time}
                        </span>
                        {inc.autoExitApplied && (
                          <span className="text-amber-500 font-medium">Salida automatica aplicada</span>
                        )}
                      </div>

                      {inc.resolution && (
                        <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-2">
                          <p className="text-xs text-green-700"><strong>Resolucion:</strong> {inc.resolution}</p>
                        </div>
                      )}
                    </div>

                    {!inc.resolved && (
                      <button onClick={() => setShowResolveModal(inc.id)}
                        className="bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                        Resolver
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* New Incident Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Ambulance className="w-5 h-5 text-red-500" />
                Registrar Incidente
              </h3>
              <button onClick={() => setShowNewModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Empleado *</label>
                <select value={newIncident.employeeId} onChange={(e) => setNewIncident(p => ({ ...p, employeeId: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Seleccionar empleado...</option>
                  {employees.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} - {emp.dni}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Tipo *</label>
                  <select value={newIncident.type} onChange={(e) => setNewIncident(p => ({ ...p, type: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Severidad *</label>
                  <select value={newIncident.severity} onChange={(e) => setNewIncident(p => ({ ...p, severity: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    {Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Planta</label>
                  <select value={newIncident.plantCode} onChange={(e) => setNewIncident(p => ({ ...p, plantCode: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="P1">Planta 1</option>
                    <option value="P2">Planta 2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Hora</label>
                  <input type="time" value={newIncident.time}
                    onChange={(e) => setNewIncident(p => ({ ...p, time: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Titulo *</label>
                <input type="text" value={newIncident.title} placeholder="Descripcion breve del incidente"
                  onChange={(e) => setNewIncident(p => ({ ...p, title: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Descripcion detallada</label>
                <textarea value={newIncident.description} rows={3}
                  placeholder="Detalles del incidente, circunstancias, testigos..."
                  onChange={(e) => setNewIncident(p => ({ ...p, description: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>

              {(newIncident.type === 'ACCIDENTE' || newIncident.type === 'EMERGENCIA') && (
                <label className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <input type="checkbox" checked={newIncident.autoExitApplied}
                    onChange={(e) => setNewIncident(p => ({ ...p, autoExitApplied: e.target.checked }))}
                    className="w-4 h-4 text-amber-600 rounded" />
                  <div>
                    <span className="text-sm font-medium text-amber-800">Registrar salida automatica</span>
                    <p className="text-xs text-amber-600">El empleado no pudo registrar su salida (ambulancia, emergencia)</p>
                  </div>
                </label>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowNewModal(false)}
                  className="flex-1 border py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleCreate}
                  disabled={!newIncident.employeeId || !newIncident.title}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                  Registrar Incidente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Resolver Incidente
            </h3>
            <textarea value={resolution} onChange={(e) => setResolution(e.target.value)}
              placeholder="Descripcion de la resolucion..." rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-4" />
            <div className="flex gap-3">
              <button onClick={() => { setShowResolveModal(null); setResolution(''); }}
                className="flex-1 border py-2 rounded-xl text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={() => handleResolve(showResolveModal)}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl text-sm font-medium">
                Marcar como Resuelto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
