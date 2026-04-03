'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ScanLine, CheckCircle2, XCircle, LogIn, LogOut, Clock,
  UtensilsCrossed, AlertTriangle, User, Building2, Wifi, WifiOff,
  Edit3, X, Save, Shield, Camera, FileWarning, Keyboard, RotateCcw
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
  const [scanMode, setScanMode] = useState<'reader' | 'camera' | 'manual'>('reader');
  const [cameraActive, setCameraActive] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<any>(null);

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
    if (scanMode === 'reader') {
      const focusInterval = setInterval(() => {
        if (inputRef.current && document.activeElement !== inputRef.current && !editModal.show) {
          inputRef.current.focus();
        }
      }, 500);
      return () => clearInterval(focusInterval);
    }
  }, [editModal.show, scanMode]);

  // Camera QR scanner
  useEffect(() => {
    if (scanMode !== 'camera') {
      stopCamera();
      return;
    }

    let mounted = true;

    const startCamera = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!mounted || !cameraRef.current) return;

        const scanner = new Html5Qrcode('qr-camera-view');
        html5QrCodeRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
          (decodedText: string) => {
            processScan(decodedText);
            // Brief pause after scan
            scanner.pause(true);
            setTimeout(() => {
              try { scanner.resume(); } catch {}
            }, 2000);
          },
          () => {}
        );
        setCameraActive(true);
      } catch (err) {
        console.error('Camera error:', err);
        setCameraActive(false);
      }
    };

    startCamera();

    return () => {
      mounted = false;
      stopCamera();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanMode]);

  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch {}
      html5QrCodeRef.current = null;
    }
    setCameraActive(false);
  };

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

      if (!result.success) {
        setTimeout(() => setLastScan(null), 4000);
      }
    } catch {
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
    setEditModal({ show: false, reason: '', newTimestamp: '' });
  };

  const currentShift = currentTime.getHours() >= 7 && currentTime.getHours() < 19 ? 'DIA' : 'NOCHE';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Hidden input for QR reader device */}
      {scanMode === 'reader' && (
        <input ref={inputRef} type="text" value={scanInput} onChange={(e) => setScanInput(e.target.value)}
          onKeyDown={handleKeyDown} className="absolute opacity-0 w-0 h-0" autoFocus autoComplete="off" />
      )}

      {/* Top Bar - responsive */}
      <div className="bg-black/30 backdrop-blur border-b border-white/10 px-3 md:px-6 py-2 md:py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-7 h-7 md:w-8 md:h-8 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <ScanLine className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="font-bold text-xs md:text-sm">FRUTOS TROPICALES</h1>
              <p className="text-[9px] md:text-[10px] text-gray-400">Estacion de Registro</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <select value={plantCode} onChange={(e) => setPlantCode(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-lg px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm text-white touch-manipulation">
              <option value="P1" className="text-black">P1</option>
              <option value="P2" className="text-black">P2</option>
            </select>

            <button onClick={() => setEmergencyMode(!emergencyMode)}
              className={`flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-medium transition-all touch-manipulation ${
                emergencyMode ? 'bg-red-600 text-white animate-pulse' : 'bg-white/10 text-gray-400'
              }`}>
              <Shield className="w-3 h-3 md:w-3.5 md:h-3.5" />
              <span className="hidden sm:inline">{emergencyMode ? 'EMERGENCIA' : 'Emergencia'}</span>
            </button>

            <div className="hidden md:flex items-center gap-1.5">
              {isOnline ? <Wifi className="w-4 h-4 text-green-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
              <span className={`text-xs ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
                {isOnline ? 'En linea' : 'Offline'}
              </span>
            </div>

            {/* Mobile: small online indicator */}
            <div className="md:hidden">
              {isOnline ? <Wifi className="w-4 h-4 text-green-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
            </div>
          </div>

          <div className="text-right">
            <p className="text-xl md:text-3xl font-bold tabular-nums text-green-400">{format(currentTime, 'HH:mm:ss')}</p>
            <p className="text-[9px] md:text-xs text-gray-400">
              {format(currentTime, "dd MMM", { locale: es })} | <span className="text-green-400 font-semibold">{currentShift}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Scan Mode Selector - Mobile prominent */}
      <div className="max-w-7xl mx-auto px-3 md:px-6 pt-3 md:pt-4">
        <div className="flex gap-2 md:gap-3">
          <button onClick={() => setScanMode('reader')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-4 py-2.5 md:py-2 rounded-xl text-xs md:text-sm font-medium transition-all touch-manipulation ${
              scanMode === 'reader' ? 'bg-green-600 text-white shadow-lg shadow-green-600/30' : 'bg-white/10 text-gray-400 hover:text-white'
            }`}>
            <ScanLine className="w-4 h-4" />
            <span>Lector QR</span>
          </button>
          <button onClick={() => setScanMode('camera')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-4 py-2.5 md:py-2 rounded-xl text-xs md:text-sm font-medium transition-all touch-manipulation ${
              scanMode === 'camera' ? 'bg-green-600 text-white shadow-lg shadow-green-600/30' : 'bg-white/10 text-gray-400 hover:text-white'
            }`}>
            <Camera className="w-4 h-4" />
            <span>Camara</span>
          </button>
          <button onClick={() => setScanMode('manual')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-4 py-2.5 md:py-2 rounded-xl text-xs md:text-sm font-medium transition-all touch-manipulation ${
              scanMode === 'manual' ? 'bg-green-600 text-white shadow-lg shadow-green-600/30' : 'bg-white/10 text-gray-400 hover:text-white'
            }`}>
            <Keyboard className="w-4 h-4" />
            <span>Manual</span>
          </button>

          {/* Mobile: toggle recent panel */}
          <button onClick={() => setShowRecent(!showRecent)}
            className="md:hidden flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl text-xs font-medium bg-white/10 text-gray-400 touch-manipulation relative">
            <Clock className="w-4 h-4" />
            {recentScans.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full text-[9px] flex items-center justify-center text-white font-bold">
                {recentScans.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-3 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6">
          {/* Main Scan Area */}
          <div className="lg:col-span-2">
            <div className={`rounded-2xl border-2 p-4 md:p-8 transition-all duration-500 min-h-[300px] md:min-h-[500px] flex flex-col items-center justify-center ${
              lastScan === null
                ? emergencyMode ? 'border-red-500/50 bg-red-500/5' : 'border-white/20 bg-white/5'
                : lastScan.success
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-red-500 bg-red-500/10'
            }`}>
              {lastScan === null ? (
                <div className="text-center w-full">
                  {emergencyMode && (
                    <div className="mb-4 md:mb-6 bg-red-500/20 border border-red-500/30 rounded-xl px-4 md:px-6 py-2 md:py-3">
                      <div className="flex items-center gap-2 justify-center text-red-400">
                        <FileWarning className="w-4 h-4 md:w-5 md:h-5" />
                        <span className="font-bold text-xs md:text-sm">MODO EMERGENCIA ACTIVO</span>
                      </div>
                    </div>
                  )}

                  {/* Camera Mode */}
                  {scanMode === 'camera' && (
                    <div className="w-full max-w-sm mx-auto">
                      <div id="qr-camera-view" ref={cameraRef}
                        className="w-full rounded-xl overflow-hidden bg-black/50 border border-white/20" />
                      {!cameraActive && (
                        <div className="mt-3 text-gray-400 text-sm flex items-center justify-center gap-2">
                          <RotateCcw className="w-4 h-4 animate-spin" />
                          Iniciando camara...
                        </div>
                      )}
                      <p className="text-gray-400 text-xs mt-3">Apunte la camara al codigo QR del empleado</p>
                    </div>
                  )}

                  {/* Reader Mode */}
                  {scanMode === 'reader' && (
                    <>
                      <div className="w-20 h-20 md:w-32 md:h-32 mx-auto mb-4 md:mb-6 rounded-full border-4 border-dashed border-white/20 flex items-center justify-center animate-pulse">
                        <ScanLine className="w-10 h-10 md:w-16 md:h-16 text-white/40" />
                      </div>
                      <h2 className="text-lg md:text-2xl font-bold text-white/60 mb-2">Esperando Escaneo</h2>
                      <p className="text-gray-400 text-sm">Acerque su tarjeta QR al lector</p>
                      <div className="mt-3 flex items-center gap-2 justify-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-green-400">Lector activo</span>
                      </div>
                    </>
                  )}

                  {/* Manual Mode */}
                  {scanMode === 'manual' && (
                    <div className="w-full max-w-sm mx-auto">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-dashed border-white/20 flex items-center justify-center">
                        <Keyboard className="w-8 h-8 text-white/40" />
                      </div>
                      <h2 className="text-lg font-bold text-white/60 mb-4">Ingreso Manual</h2>
                      <div className="flex gap-2">
                        <input type="text" placeholder="Codigo o DNI..." value={scanInput}
                          onChange={(e) => setScanInput(e.target.value)} onKeyDown={handleKeyDown}
                          className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500 touch-manipulation"
                          autoFocus autoComplete="off" inputMode="text" />
                        <button onClick={() => processScan(scanInput)} disabled={!scanInput.trim()}
                          className="bg-green-600 hover:bg-green-700 disabled:opacity-40 px-5 py-3 rounded-xl text-sm font-medium transition-colors touch-manipulation">
                          <LogIn className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : lastScan.success && lastScan.data ? (
                <div className="text-center animate-fade-in w-full">
                  {/* Mobile: vertical layout, Desktop: horizontal */}
                  <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
                    {/* Employee Photo */}
                    <div className="flex-shrink-0">
                      {lastScan.data.employee.photoUrl ? (
                        <img src={lastScan.data.employee.photoUrl} alt={lastScan.data.employee.name}
                          className="w-24 h-24 md:w-40 md:h-40 rounded-2xl object-cover border-4 border-white/20 shadow-2xl" />
                      ) : (
                        <div className="w-24 h-24 md:w-40 md:h-40 rounded-2xl bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center border-4 border-white/10">
                          <User className="w-12 h-12 md:w-20 md:h-20 text-white/40" />
                        </div>
                      )}
                    </div>

                    <div className="text-center md:text-left">
                      {/* Action Badge */}
                      <div className={`inline-flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2 md:py-3 rounded-xl mb-2 md:mb-3 ${
                        lastScan.data.action === 'INGRESO'
                          ? 'bg-green-500/20 border border-green-500/30'
                          : 'bg-blue-500/20 border border-blue-500/30'
                      }`}>
                        {lastScan.data.action === 'INGRESO'
                          ? <LogIn className="w-5 h-5 md:w-8 md:h-8 text-green-400" />
                          : <LogOut className="w-5 h-5 md:w-8 md:h-8 text-blue-400" />}
                        <span className={`text-2xl md:text-4xl font-black ${
                          lastScan.data.action === 'INGRESO' ? 'text-green-400' : 'text-blue-400'
                        }`}>
                          {lastScan.data.action}
                        </span>
                      </div>

                      <h3 className="text-xl md:text-3xl font-bold text-white">{lastScan.data.employee.name}</h3>
                      {lastScan.data.employee.dni && (
                        <p className="text-gray-400 text-xs md:text-sm mt-1">DNI: {lastScan.data.employee.dni}</p>
                      )}

                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-2 md:mt-3">
                        <span className={`px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg text-xs md:text-sm font-bold ${
                          lastScan.data.employee.type === 'OPERATIVO'
                            ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}>{lastScan.data.employee.type}</span>
                        <span className={`px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg text-xs md:text-sm font-bold ${
                          lastScan.data.employee.shift === 'DIA'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        }`}>{lastScan.data.employee.shift}</span>
                        {lastScan.data.employee.mealEligible && (
                          <span className="px-2.5 py-1 rounded-lg text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30 flex items-center gap-1">
                            <UtensilsCrossed className="w-3 h-3" /> Comida
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-center md:justify-start gap-3 mt-2 text-gray-400 text-xs md:text-sm">
                        <span>{format(new Date(lastScan.data.timestamp), 'HH:mm:ss')}</span>
                        {lastScan.data.employee.area && (
                          <>
                            <span>|</span>
                            <span>{lastScan.data.employee.area}</span>
                          </>
                        )}
                      </div>

                      {lastScan.data.isLate && (
                        <div className="mt-2 md:mt-3 bg-red-500/20 text-red-300 px-3 md:px-4 py-1.5 md:py-2 rounded-lg inline-flex items-center gap-2 text-xs md:text-sm">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="font-bold">TARDANZA: {lastScan.data.minutesLate} min</span>
                        </div>
                      )}
                      {lastScan.data.isEarly && (
                        <div className="mt-2 md:mt-3 bg-amber-500/20 text-amber-300 px-3 md:px-4 py-1.5 md:py-2 rounded-lg inline-flex items-center gap-2 text-xs md:text-sm">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="font-bold">Salida anticipada: {lastScan.data.minutesEarly} min</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {emergencyMode && (
                    <button onClick={() => openEditModal({ ...lastScan, time: new Date() } as any)}
                      className="mt-4 bg-red-600/20 border border-red-500/30 hover:bg-red-600/30 text-red-300 px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all flex items-center gap-2 mx-auto touch-manipulation">
                      <Edit3 className="w-4 h-4" />
                      Editar (Emergencia)
                    </button>
                  )}

                  <button onClick={() => setLastScan(null)}
                    className="mt-4 md:mt-6 bg-white/10 hover:bg-white/20 active:bg-white/30 border border-white/20 text-white px-8 md:px-10 py-2.5 md:py-3 rounded-xl text-base md:text-lg font-bold transition-all flex items-center gap-3 mx-auto touch-manipulation">
                    <ScanLine className="w-5 h-5" />
                    Siguiente
                  </button>
                </div>
              ) : (
                <div className="text-center animate-fade-in">
                  <div className="w-16 h-16 md:w-24 md:h-24 mx-auto mb-3 md:mb-4 rounded-full bg-red-500 flex items-center justify-center">
                    <XCircle className="w-8 h-8 md:w-12 md:h-12 text-white" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-red-400 mb-2">ERROR</h2>
                  <p className="text-gray-300 text-sm md:text-lg">{lastScan.error}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - hidden on mobile unless toggled */}
          <div className={`space-y-3 md:space-y-4 ${showRecent ? 'block' : 'hidden lg:block'}`}>
            {/* Today counts */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 md:p-4">
              <h3 className="text-xs md:text-sm font-semibold text-gray-400 mb-2 md:mb-3">REGISTRO DE HOY</h3>
              <div className="grid grid-cols-2 gap-2 md:gap-3">
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2.5 md:p-3 text-center">
                  <LogIn className="w-4 h-4 md:w-5 md:h-5 text-green-400 mx-auto mb-1" />
                  <p className="text-xl md:text-2xl font-bold text-green-400">{todayCount.in}</p>
                  <p className="text-[9px] md:text-[10px] text-green-500/70">INGRESOS</p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5 md:p-3 text-center">
                  <LogOut className="w-4 h-4 md:w-5 md:h-5 text-blue-400 mx-auto mb-1" />
                  <p className="text-xl md:text-2xl font-bold text-blue-400">{todayCount.out}</p>
                  <p className="text-[9px] md:text-[10px] text-blue-500/70">SALIDAS</p>
                </div>
              </div>
            </div>

            {/* Connection */}
            <div className={`border rounded-xl p-2.5 md:p-3 flex items-center gap-2 md:gap-3 ${
              isOnline ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'
            }`}>
              {isOnline ? <Wifi className="w-4 h-4 md:w-5 md:h-5 text-green-400 flex-shrink-0" /> : <WifiOff className="w-4 h-4 md:w-5 md:h-5 text-red-400 flex-shrink-0" />}
              <div className="min-w-0">
                <p className={`text-xs md:text-sm font-medium ${isOnline ? 'text-green-300' : 'text-red-300'}`}>
                  {isOnline ? 'Sincronizado' : 'Modo offline'}
                </p>
                <p className="text-[9px] md:text-[10px] text-gray-500 truncate">
                  {isOnline ? 'Datos en Supabase' : 'Se sincronizara al reconectar'}
                </p>
              </div>
            </div>

            {/* Recent Scans */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 md:p-4">
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <h3 className="text-xs md:text-sm font-semibold text-gray-400">ULTIMOS REGISTROS</h3>
                {/* Mobile close button */}
                <button onClick={() => setShowRecent(false)} className="lg:hidden p-1 hover:bg-white/10 rounded">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div className="space-y-1.5 md:space-y-2 max-h-[300px] md:max-h-[450px] overflow-y-auto">
                {recentScans.length === 0 ? (
                  <p className="text-gray-500 text-xs md:text-sm text-center py-4">Sin registros aun</p>
                ) : (
                  recentScans.map((scan, idx) => (
                    <div key={idx} className={`flex items-center gap-2 md:gap-3 p-2 md:p-2.5 rounded-lg group ${
                      scan.data?.action === 'INGRESO' ? 'bg-green-500/10' : 'bg-blue-500/10'
                    }`}>
                      <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {scan.data?.employee.photoUrl ? (
                          <img src={scan.data.employee.photoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs md:text-sm font-medium text-white truncate">{scan.data?.employee.name}</p>
                        <p className="text-[9px] md:text-[10px] text-gray-400">
                          {scan.data?.action === 'INGRESO' ? '>' : '<'} {scan.data?.employee.shift} | {format(scan.time, 'HH:mm:ss')}
                        </p>
                      </div>
                      {scan.data?.isLate && (
                        <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold flex-shrink-0">TARDE</span>
                      )}
                      {emergencyMode && (
                        <button onClick={() => openEditModal(scan)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded touch-manipulation">
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-gray-800 border border-white/10 rounded-t-2xl md:rounded-2xl p-5 md:p-6 w-full md:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-red-400" />
                Edicion de Emergencia
              </h3>
              <button onClick={() => setEditModal({ show: false, reason: '', newTimestamp: '' })}
                className="p-2 hover:bg-white/10 rounded-lg touch-manipulation"><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <p className="text-gray-400 text-sm mb-4">
              Editando: <span className="text-white font-medium">{editModal.employeeName}</span>
              {' '}({editModal.currentAction})
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Motivo *</label>
                <select value={editModal.reason} onChange={(e) => setEditModal(p => ({ ...p, reason: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-sm text-white touch-manipulation">
                  <option value="" className="text-black">Seleccionar...</option>
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
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-sm text-white touch-manipulation" />
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <p className="text-amber-300 text-xs">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                  Esta accion sera notificada al supervisor.
                </p>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setEditModal({ show: false, reason: '', newTimestamp: '' })}
                  className="flex-1 bg-white/10 hover:bg-white/20 py-2.5 rounded-lg text-sm transition-colors touch-manipulation">
                  Cancelar
                </button>
                <button onClick={handleEmergencyEdit} disabled={!editModal.reason}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 touch-manipulation">
                  <Save className="w-4 h-4" />
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
