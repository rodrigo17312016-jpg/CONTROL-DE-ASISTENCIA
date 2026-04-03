'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ScanLine, CheckCircle2, XCircle, LogIn, LogOut, Clock,
  UtensilsCrossed, AlertTriangle, User, Building2, Wifi, WifiOff,
  Edit3, X, Save, Shield, Camera, FileWarning
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type EmployeeData = {
  id: string;
  code: string;
  name: string;
  type: string;
  shift: string;
  area: string;
  position: string;
  mealEligible: boolean;
  photoUrl?: string;
  dni?: string;
};

type ScanResult = {
  success: boolean;
  error?: string;
  data?: {
    employee: EmployeeData;
    action: string;
    timestamp: string;
    shiftDate: string;
    isLate: boolean;
    minutesLate: number;
    isEarly: boolean;
    minutesEarly: number;
    alerts: string[];
  };
};

type EditModalData = {
  show: boolean;
  recordId?: string;
  employeeName?: string;
  currentAction?: string;
  reason: string;
  newTimestamp: string;
};

export default function ScanPage() {
  const [plantCode, setPlantCode] = useState('P1');
  const [scanInput, setScanInput] = useState('');
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [recentScans, setRecentScans] = useState<Array<ScanResult & { time: Date }>>([]);
  const [scanning, setScanning] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayCount, setTodayCount] = useState({ in: 0, out: 0 });
  const [isOnline, setIsOnline] = useState(true);
  const [editModal, setEditModal] = useState<EditModalData>({ show: false, reason: '', newTimestamp: '' });
  const [emergencyMode, setEmergencyMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  useEffect(() => {
    const focusInterval = setInterval(() => {
      if (inputRef.current && document.activeElement !== inputRef.current && !editModal.show) {
        inputRef.current.focus();
      }
    }, 500);
    return () => clearInterval(focusInterval);
  }, [editModal.show]);

  const processScan = useCallback(async (code: string) => {
    if (!code.trim() || scanning) return;
    setScanning(true);

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeCode: code.trim(), plantCode }),
      });
      const result: ScanResult = await res.json();
      setLastScan(result);

      if (result.success && result.data) {
        setRecentScans(prev => [{ ...result, time: new Date() }, ...prev].slice(0, 15));
        if (result.data.action === 'INGRESO') {
          setTodayCount(prev => ({ ...prev, in: prev.in + 1 }));
        } else {
          setTodayCount(prev => ({ ...prev, out: prev.out + 1 }));
        }
      }

      // Solo auto-ocultar errores, los exitosos esperan boton "Continuar"
      if (!result.success) {
        setTimeout(() => setLastScan(null), 4000);
      }
    } catch (err) {
      setLastScan({ success: false, error: 'Error de conexion' });
      setTimeout(() => setLastScan(null), 4000);
    } finally {
      setScanInput('');
      setScanning(false);
    }
  }, [plantCode, scanning]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processScan(scanInput);
    }
  };

  const openEditModal = (scan: ScanResult & { time: Date }) => {
    if (!scan.data) return;
    setEditModal({
      show: true,
      employeeName: scan.data.employee.name,
      currentAction: scan.data.action,
      reason: '',
      newTimestamp: format(scan.time, "yyyy-MM-dd'T'HH:mm"),
    });
  };

  const handleEmergencyEdit = async () => {
    if (!editModal.reason) return;
    // TODO: Call API to edit the attendance record
    setEditModal({ show: false, reason: '', newTimestamp: '' });
  };

  const currentShift = currentTime.getHours() >= 7 && currentTime.getHours() < 19 ? 'DIA' : 'NOCHE';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <input ref={inputRef} type="text" value={scanInput} onChange={(e) => setScanInput(e.target.value)}
        onKeyDown={handleKeyDown} className="absolute opacity-0 w-0 h-0" autoFocus autoComplete="off" />

      {/* Top Bar */}
      <div className="bg-black/30 backdrop-blur border-b border-white/10 px-6 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
              <ScanLine className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm">FRUTOS TROPICALES</h1>
              <p className="text-[10px] text-gray-400">Estacion de Registro</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <select value={plantCode} onChange={(e) => setPlantCode(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white">
              <option value="P1" className="text-black">Planta 1</option>
              <option value="P2" className="text-black">Planta 2</option>
            </select>

            {/* Emergency mode toggle */}
            <button onClick={() => setEmergencyMode(!emergencyMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                emergencyMode ? 'bg-red-600 text-white animate-pulse' : 'bg-white/10 text-gray-400 hover:text-white'
              }`}>
              <Shield className="w-3.5 h-3.5" />
              {emergencyMode ? 'EMERGENCIA ACTIVA' : 'Modo Emergencia'}
            </button>

            <div className="flex items-center gap-1.5">
              {isOnline ? <Wifi className="w-4 h-4 text-green-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
              <span className={`text-xs ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
                {isOnline ? 'En linea' : 'Sin conexion (modo local)'}
              </span>
            </div>
          </div>

          <div className="text-right">
            <p className="text-3xl font-bold tabular-nums text-green-400">{format(currentTime, 'HH:mm:ss')}</p>
            <p className="text-xs text-gray-400">
              {format(currentTime, "dd MMM yyyy", { locale: es })} | Turno <span className="text-green-400 font-semibold">{currentShift}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Scan Area */}
          <div className="lg:col-span-2">
            <div className={`rounded-2xl border-2 p-8 transition-all duration-500 min-h-[500px] flex flex-col items-center justify-center ${
              lastScan === null
                ? emergencyMode ? 'border-red-500/50 bg-red-500/5' : 'border-white/20 bg-white/5'
                : lastScan.success
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-red-500 bg-red-500/10'
            }`}>
              {lastScan === null ? (
                <div className="text-center">
                  {emergencyMode && (
                    <div className="mb-6 bg-red-500/20 border border-red-500/30 rounded-xl px-6 py-3">
                      <div className="flex items-center gap-2 justify-center text-red-400">
                        <FileWarning className="w-5 h-5" />
                        <span className="font-bold text-sm">MODO EMERGENCIA - Los registros se pueden editar despues del escaneo</span>
                      </div>
                    </div>
                  )}
                  <div className="w-32 h-32 mx-auto mb-6 rounded-full border-4 border-dashed border-white/20 flex items-center justify-center animate-pulse">
                    <ScanLine className="w-16 h-16 text-white/40" />
                  </div>
                  <h2 className="text-2xl font-bold text-white/60 mb-2">Esperando Escaneo</h2>
                  <p className="text-gray-400">Acerque su tarjeta QR al lector</p>
                  <div className="mt-4 flex items-center gap-2 justify-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-green-400">Lector activo</span>
                  </div>

                  <div className="mt-8 flex gap-2 max-w-md mx-auto">
                    <input type="text" placeholder="Codigo manual o DNI..." value={scanInput}
                      onChange={(e) => setScanInput(e.target.value)} onKeyDown={handleKeyDown}
                      className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500" />
                    <button onClick={() => processScan(scanInput)}
                      className="bg-green-600 hover:bg-green-700 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors">
                      Registrar
                    </button>
                  </div>
                </div>
              ) : lastScan.success && lastScan.data ? (
                <div className="text-center animate-fade-in w-full">
                  <div className="flex items-center justify-center gap-8">
                    {/* LARGE EMPLOYEE PHOTO */}
                    <div className="flex-shrink-0">
                      {lastScan.data.employee.photoUrl ? (
                        <img src={lastScan.data.employee.photoUrl} alt={lastScan.data.employee.name}
                          className="w-40 h-40 rounded-2xl object-cover border-4 border-white/20 shadow-2xl" />
                      ) : (
                        <div className="w-40 h-40 rounded-2xl bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center border-4 border-white/10">
                          <User className="w-20 h-20 text-white/40" />
                        </div>
                      )}
                    </div>

                    <div className="text-left">
                      {/* ACTION BADGE */}
                      <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-xl mb-3 ${
                        lastScan.data.action === 'INGRESO'
                          ? 'bg-green-500/20 border border-green-500/30'
                          : 'bg-blue-500/20 border border-blue-500/30'
                      }`}>
                        {lastScan.data.action === 'INGRESO'
                          ? <LogIn className="w-8 h-8 text-green-400" />
                          : <LogOut className="w-8 h-8 text-blue-400" />}
                        <span className={`text-4xl font-black ${
                          lastScan.data.action === 'INGRESO' ? 'text-green-400' : 'text-blue-400'
                        }`}>
                          {lastScan.data.action}
                        </span>
                      </div>

                      <h3 className="text-3xl font-bold text-white">{lastScan.data.employee.name}</h3>
                      {lastScan.data.employee.dni && (
                        <p className="text-gray-400 text-sm mt-1">DNI: {lastScan.data.employee.dni}</p>
                      )}

                      <div className="flex items-center gap-3 mt-3">
                        <span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${
                          lastScan.data.employee.type === 'OPERATIVO'
                            ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}>{lastScan.data.employee.type}</span>
                        <span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${
                          lastScan.data.employee.shift === 'DIA'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        }`}>Turno {lastScan.data.employee.shift}</span>
                        {lastScan.data.employee.area && (
                          <span className="px-3 py-1.5 rounded-lg text-sm bg-white/10 text-gray-300 border border-white/10">
                            {lastScan.data.employee.area}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-3">
                        {lastScan.data.employee.mealEligible ? (
                          <div className="flex items-center gap-2 text-orange-300">
                            <UtensilsCrossed className="w-4 h-4" />
                            <span className="text-sm font-medium">Comida incluida</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-gray-500">
                            <UtensilsCrossed className="w-4 h-4" />
                            <span className="text-sm">Sin comida</span>
                          </div>
                        )}

                        <span className="text-gray-500 text-sm">|</span>
                        <span className="text-gray-400 text-sm">{format(new Date(lastScan.data.timestamp), 'HH:mm:ss')}</span>
                      </div>

                      {lastScan.data.isLate && (
                        <div className="mt-3 bg-red-500/20 text-red-300 px-4 py-2 rounded-lg inline-flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="font-bold">TARDANZA: {lastScan.data.minutesLate} minutos</span>
                        </div>
                      )}
                      {lastScan.data.isEarly && (
                        <div className="mt-3 bg-amber-500/20 text-amber-300 px-4 py-2 rounded-lg inline-flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="font-bold">Salida anticipada: {lastScan.data.minutesEarly} min</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Emergency edit button */}
                  {emergencyMode && (
                    <button onClick={() => openEditModal({ ...lastScan, time: new Date() } as any)}
                      className="mt-6 bg-red-600/20 border border-red-500/30 hover:bg-red-600/30 text-red-300 px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 mx-auto">
                      <Edit3 className="w-4 h-4" />
                      Editar registro (Emergencia)
                    </button>
                  )}

                  {/* Boton Continuar */}
                  <button onClick={() => setLastScan(null)}
                    className="mt-6 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-10 py-3 rounded-xl text-lg font-bold transition-all flex items-center gap-3 mx-auto">
                    <ScanLine className="w-5 h-5" />
                    Siguiente Registro
                  </button>
                </div>
              ) : (
                <div className="text-center animate-fade-in">
                  <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-red-500 flex items-center justify-center">
                    <XCircle className="w-12 h-12 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-red-400 mb-2">ERROR</h2>
                  <p className="text-gray-300 text-lg">{lastScan.error}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel */}
          <div className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">REGISTRO DE HOY</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                  <LogIn className="w-5 h-5 text-green-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-400">{todayCount.in}</p>
                  <p className="text-[10px] text-green-500/70">INGRESOS</p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
                  <LogOut className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-blue-400">{todayCount.out}</p>
                  <p className="text-[10px] text-blue-500/70">SALIDAS</p>
                </div>
              </div>
            </div>

            {/* Connection Status */}
            <div className={`border rounded-xl p-3 flex items-center gap-3 ${
              isOnline ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'
            }`}>
              {isOnline ? <Wifi className="w-5 h-5 text-green-400" /> : <WifiOff className="w-5 h-5 text-red-400" />}
              <div>
                <p className={`text-sm font-medium ${isOnline ? 'text-green-300' : 'text-red-300'}`}>
                  {isOnline ? 'Sincronizado con la nube' : 'Modo offline activo'}
                </p>
                <p className="text-[10px] text-gray-500">
                  {isOnline ? 'Datos respaldados en Supabase' : 'Los datos se sincronizaran al reconectar'}
                </p>
              </div>
            </div>

            {/* Recent Scans */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">ULTIMOS REGISTROS</h3>
              <div className="space-y-2 max-h-[450px] overflow-y-auto">
                {recentScans.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">Sin registros aun</p>
                ) : (
                  recentScans.map((scan, idx) => (
                    <div key={idx} className={`flex items-center gap-3 p-2.5 rounded-lg group ${
                      scan.data?.action === 'INGRESO' ? 'bg-green-500/10' : 'bg-blue-500/10'
                    }`}>
                      {/* Mini photo */}
                      <div className="w-9 h-9 rounded-lg bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {scan.data?.employee.photoUrl ? (
                          <img src={scan.data.employee.photoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{scan.data?.employee.name}</p>
                        <p className="text-[10px] text-gray-400">
                          {scan.data?.action === 'INGRESO' ? '➡️' : '⬅️'} {scan.data?.employee.shift} | {format(scan.time, 'HH:mm:ss')}
                        </p>
                      </div>
                      {scan.data?.isLate && (
                        <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold">TARDE</span>
                      )}
                      {emergencyMode && (
                        <button onClick={() => openEditModal(scan)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded">
                          <Edit3 className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Edit Modal */}
      {editModal.show && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-red-400" />
                Edicion de Emergencia
              </h3>
              <button onClick={() => setEditModal({ show: false, reason: '', newTimestamp: '' })}
                className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <p className="text-gray-400 text-sm mb-4">
              Editando registro de <span className="text-white font-medium">{editModal.employeeName}</span>
              {' '}({editModal.currentAction})
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Motivo de edicion *</label>
                <select value={editModal.reason} onChange={(e) => setEditModal(p => ({ ...p, reason: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white">
                  <option value="" className="text-black">Seleccionar motivo...</option>
                  <option value="ACCIDENTE" className="text-black">Accidente laboral</option>
                  <option value="EMERGENCIA_MEDICA" className="text-black">Emergencia medica</option>
                  <option value="FALLA_LECTOR" className="text-black">Falla del lector QR</option>
                  <option value="ERROR_REGISTRO" className="text-black">Error de registro</option>
                  <option value="PERMISO_SUPERVISOR" className="text-black">Permiso de supervisor</option>
                  <option value="OTRO" className="text-black">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Hora corregida</label>
                <input type="datetime-local" value={editModal.newTimestamp}
                  onChange={(e) => setEditModal(p => ({ ...p, newTimestamp: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white" />
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <p className="text-amber-300 text-xs">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                  Esta accion quedara registrada en el sistema y sera notificada al supervisor.
                </p>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setEditModal({ show: false, reason: '', newTimestamp: '' })}
                  className="flex-1 bg-white/10 hover:bg-white/20 py-2 rounded-lg text-sm transition-colors">
                  Cancelar
                </button>
                <button onClick={handleEmergencyEdit} disabled={!editModal.reason}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" />
                  Guardar Edicion
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
