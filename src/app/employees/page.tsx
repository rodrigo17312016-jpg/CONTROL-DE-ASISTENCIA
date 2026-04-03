'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import {
  Users, Plus, Search, Filter, Edit2, Trash2, X,
  Building2, Sun, Moon, UserCheck, UserX, Save
} from 'lucide-react';

type Employee = {
  id: string; code: string; firstName: string; lastName: string;
  dni: string; type: string; shift: string; plantId: string;
  position?: string; area?: string; active: boolean;
  plant?: { name: string; code: string };
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPlant, setFilterPlant] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState({
    firstName: '', lastName: '', dni: '', type: 'OPERATIVO',
    shift: 'DIA', plantCode: 'P1', position: '', area: '',
  });

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterPlant) params.set('plant', filterPlant);
    if (filterShift) params.set('shift', filterShift);
    if (filterType) params.set('type', filterType);
    if (search) params.set('search', search);

    const res = await fetch(`/api/employees?${params}`);
    const json = await res.json();
    if (json.success) setEmployees(json.data);
    setLoading(false);
  }, [filterPlant, filterShift, filterType, search]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingEmployee ? `/api/employees/${editingEmployee.id}` : '/api/employees';
    const method = editingEmployee ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (json.success) {
      setShowModal(false);
      setEditingEmployee(null);
      setForm({ firstName: '', lastName: '', dni: '', type: 'OPERATIVO', shift: 'DIA', plantCode: 'P1', position: '', area: '' });
      fetchEmployees();
    } else {
      alert(json.error);
    }
  };

  const handleEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setForm({
      firstName: emp.firstName, lastName: emp.lastName, dni: emp.dni,
      type: emp.type, shift: emp.shift, plantCode: emp.plant?.code || 'P1',
      position: emp.position || '', area: emp.area || '',
    });
    setShowModal(true);
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('¿Desactivar este empleado?')) return;
    await fetch(`/api/employees/${id}`, { method: 'DELETE' });
    fetchEmployees();
  };

  const stats = {
    total: employees.length,
    active: employees.filter(e => e.active).length,
    operativos: employees.filter(e => e.type === 'OPERATIVO').length,
    administrativos: employees.filter(e => e.type === 'ADMINISTRATIVO').length,
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Gestion de Empleados</h1>
              <p className="text-sm text-gray-500">{stats.total} empleados registrados</p>
            </div>
            <button
              onClick={() => { setEditingEmployee(null); setForm({ firstName: '', lastName: '', dni: '', type: 'OPERATIVO', shift: 'DIA', plantCode: 'P1', position: '', area: '' }); setShowModal(true); }}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Nuevo Empleado
            </button>
          </div>
        </header>

        <div className="p-6 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border p-3 flex items-center gap-3">
              <Users className="w-8 h-8 text-green-500" />
              <div><p className="text-2xl font-bold text-gray-800">{stats.total}</p><p className="text-xs text-gray-500">Total</p></div>
            </div>
            <div className="bg-white rounded-lg border p-3 flex items-center gap-3">
              <UserCheck className="w-8 h-8 text-blue-500" />
              <div><p className="text-2xl font-bold text-gray-800">{stats.active}</p><p className="text-xs text-gray-500">Activos</p></div>
            </div>
            <div className="bg-white rounded-lg border p-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center"><span className="text-green-700 font-bold text-xs">OP</span></div>
              <div><p className="text-2xl font-bold text-gray-800">{stats.operativos}</p><p className="text-xs text-gray-500">Operativos</p></div>
            </div>
            <div className="bg-white rounded-lg border p-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center"><span className="text-blue-700 font-bold text-xs">AD</span></div>
              <div><p className="text-2xl font-bold text-gray-800">{stats.administrativos}</p><p className="text-xs text-gray-500">Administrativos</p></div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text" placeholder="Buscar por nombre, DNI o codigo..."
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-500"
                />
              </div>
              <select value={filterPlant} onChange={(e) => setFilterPlant(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Todas las plantas</option>
                <option value="P1">Planta 1</option>
                <option value="P2">Planta 2</option>
              </select>
              <select value={filterShift} onChange={(e) => setFilterShift(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Todos los turnos</option>
                <option value="DIA">Turno Dia</option>
                <option value="NOCHE">Turno Noche</option>
              </select>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Todos los tipos</option>
                <option value="OPERATIVO">Operativo</option>
                <option value="ADMINISTRATIVO">Administrativo</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">CODIGO</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">EMPLEADO</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">DNI</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">TIPO</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">TURNO</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">PLANTA</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">AREA</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">ESTADO</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs font-mono text-gray-600">{emp.code}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-800">{emp.firstName} {emp.lastName}</p>
                        {emp.position && <p className="text-xs text-gray-400">{emp.position}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{emp.dni}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          emp.type === 'OPERATIVO' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {emp.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                          emp.shift === 'DIA' ? 'text-amber-600' : 'text-indigo-600'
                        }`}>
                          {emp.shift === 'DIA' ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
                          {emp.shift}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{emp.plant?.name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{emp.area || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${emp.active ? 'text-green-600' : 'text-red-500'}`}>
                          {emp.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleEdit(emp)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Editar">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeactivate(emp.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" title="Desactivar">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {employees.length === 0 && !loading && (
                <div className="p-12 text-center">
                  <Users className="w-16 h-16 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">No hay empleados registrados</p>
                  <p className="text-gray-300 text-sm mt-1">Haz clic en &quot;Nuevo Empleado&quot; para agregar</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg animate-fade-in">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h2 className="text-lg font-bold text-gray-800">
                  {editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">NOMBRES</label>
                    <input type="text" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">APELLIDOS</label>
                    <input type="text" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">DNI</label>
                  <input type="text" required value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">TIPO</label>
                    <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      <option value="OPERATIVO">Operativo</option>
                      <option value="ADMINISTRATIVO">Administrativo</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">TURNO</label>
                    <select value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      <option value="DIA">Dia</option>
                      <option value="NOCHE">Noche</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">PLANTA</label>
                    <select value={form.plantCode} onChange={(e) => setForm({ ...form, plantCode: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      <option value="P1">Planta 1</option>
                      <option value="P2">Planta 2</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">CARGO</label>
                    <input type="text" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">AREA</label>
                    <input type="text" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
                  </div>
                </div>

                {form.type === 'ADMINISTRATIVO' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs text-blue-700 font-medium">Personal administrativo NO tiene derecho a comida de empresa</p>
                  </div>
                )}
                {form.type === 'OPERATIVO' && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs text-green-700 font-medium">Personal operativo SI tiene derecho a comida de empresa</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)}
                    className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors">
                    Cancelar
                  </button>
                  <button type="submit"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
                    <Save className="w-4 h-4" /> {editingEmployee ? 'Actualizar' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
