'use client';

import { useState, useEffect, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import { CreditCard, Download, Printer, Search, Filter, QrCode, Users, Leaf } from 'lucide-react';

type Employee = {
  id: string; code: string; firstName: string; lastName: string;
  dni: string; type: string; shift: string; area?: string;
  plant?: { name: string; code: string };
};

export default function CardsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [filterPlant, setFilterPlant] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterPlant) params.set('plant', filterPlant);
    if (search) params.set('search', search);
    params.set('active', 'true');

    fetch(`/api/employees?${params}`)
      .then(r => r.json())
      .then(json => { if (json.success) setEmployees(json.data); });
  }, [filterPlant, search]);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === employees.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(employees.map(e => e.id)));
    }
  };

  const selectedEmployees = employees.filter(e => selected.has(e.id));

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !printRef.current) return;

    printWindow.document.write(`
      <html><head><title>Tarjetas QR - Frutos Tropicales</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; padding: 10mm; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8mm; }
        .card {
          border: 2px solid #16a34a; border-radius: 8px; padding: 12px;
          text-align: center; page-break-inside: avoid; width: 60mm; height: 90mm;
          display: flex; flex-direction: column; align-items: center; justify-content: space-between;
        }
        .card-header { background: linear-gradient(135deg, #16a34a, #059669); color: white; padding: 6px 12px; border-radius: 4px; width: 100%; }
        .card-header h3 { font-size: 7px; letter-spacing: 2px; }
        .qr-container { padding: 8px; }
        .qr-container img { width: 100px; height: 100px; }
        .name { font-size: 11px; font-weight: bold; color: #1a1a1a; }
        .info { font-size: 8px; color: #666; }
        .code { font-family: monospace; font-size: 9px; color: #16a34a; font-weight: bold; background: #f0fdf4; padding: 2px 8px; border-radius: 4px; }
        .badge { font-size: 7px; padding: 2px 6px; border-radius: 10px; font-weight: bold; }
        .badge-op { background: #dcfce7; color: #16a34a; }
        .badge-admin { background: #dbeafe; color: #2563eb; }
        @media print { body { padding: 5mm; } .grid { gap: 5mm; } }
      </style></head><body>
      <div class="grid">
    `);

    selectedEmployees.forEach(emp => {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(emp.code)}&color=16a34a`;
      printWindow.document.write(`
        <div class="card">
          <div class="card-header"><h3>FRUTOS TROPICALES DEL PERU</h3></div>
          <div class="qr-container"><img src="${qrUrl}" alt="QR" /></div>
          <div class="name">${emp.firstName} ${emp.lastName}</div>
          <div class="info">DNI: ${emp.dni} | ${emp.plant?.name || ''}</div>
          <div style="display:flex;gap:4px;align-items:center;">
            <span class="badge ${emp.type === 'OPERATIVO' ? 'badge-op' : 'badge-admin'}">${emp.type}</span>
            <span class="badge" style="background:#fef3c7;color:#d97706;">TURNO ${emp.shift}</span>
          </div>
          <div class="code">${emp.code}</div>
        </div>
      `);
    });

    printWindow.document.write('</div></body></html>');
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 1000);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Generador de Tarjetas QR</h1>
              <p className="text-sm text-gray-500">Genere e imprima tarjetas de identificacion con codigo QR</p>
            </div>
            {selected.size > 0 && (
              <button onClick={handlePrint}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors">
                <Printer className="w-4 h-4" /> Imprimir {selected.size} tarjeta{selected.size > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </header>

        <div className="p-6 space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-xl border shadow-sm p-4 flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input type="text" placeholder="Buscar empleado..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-500" />
            </div>
            <select value={filterPlant} onChange={(e) => setFilterPlant(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Todas las plantas</option>
              <option value="P1">Planta 1</option>
              <option value="P2">Planta 2</option>
            </select>
            <button onClick={selectAll}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 font-medium">
              {selected.size === employees.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
          </div>

          {/* Employee Grid with Card Previews */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" ref={printRef}>
            {employees.map((emp) => (
              <div key={emp.id}
                onClick={() => toggleSelect(emp.id)}
                className={`cursor-pointer rounded-xl border-2 p-4 transition-all duration-200 ${
                  selected.has(emp.id)
                    ? 'border-green-500 bg-green-50 shadow-md ring-2 ring-green-200'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }`}>
                {/* Mini Card Preview */}
                <div className="text-center">
                  <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg px-3 py-2 mb-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <Leaf className="w-3 h-3" />
                      <span className="text-[9px] font-bold tracking-wider">FRUTOS TROPICALES</span>
                    </div>
                  </div>
                  <div className="my-3">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(emp.code)}&color=16a34a`}
                      alt="QR Code"
                      className="w-24 h-24 mx-auto"
                      loading="lazy"
                    />
                  </div>
                  <p className="font-bold text-sm text-gray-800">{emp.firstName} {emp.lastName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">DNI: {emp.dni}</p>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      emp.type === 'OPERATIVO' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>{emp.type}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      {emp.shift}
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-green-600 mt-2 bg-green-50 rounded px-2 py-0.5">{emp.code}</p>
                </div>

                {/* Selection indicator */}
                {selected.has(emp.id) && (
                  <div className="mt-3 bg-green-500 text-white text-xs font-medium text-center py-1 rounded-lg">
                    Seleccionado para imprimir
                  </div>
                )}
              </div>
            ))}
          </div>

          {employees.length === 0 && (
            <div className="bg-white rounded-xl border p-12 text-center">
              <QrCode className="w-16 h-16 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No hay empleados para generar tarjetas</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
