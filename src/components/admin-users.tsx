"use client";

import React, { useEffect, useState } from 'react';
import { Users as UsersIcon, UserPlus, Trash2, Edit2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

type UserRow = {
  id: string;
  nombre: string;
  usuario: string;
  rol: string;
  dpi?: string;
  numero_celular?: string;
  horario_entrada?: string;
  horario_salida?: string;
  horario_almuerzo?: string;
};

export default function AdminUsers(): JSX.Element {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [newPass, setNewPass] = useState('');
  const [showModal, setShowModal] = useState(false);

  const fetchUsers = async (q = '') => {
    setLoading(true);
    try {
      const url = `/api/admin/users${q ? `?search=${encodeURIComponent(q)}` : ''}`;
      const res = await fetch(url);
      const j = await res.json();
      if (j.ok) setUsers(j.users || []);
      else setUsers([]);
    } catch (e) {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSearch = async () => { fetchUsers(search); };

  const handleCreate = () => { setEditing({ id: '', nombre: '', usuario: '', rol: 'tecnico', dpi: '', numero_celular: '', horario_entrada: '06:30', horario_salida: '16:30', horario_almuerzo: '12:00' }); setNewPass(''); };

  const handleSave = async () => {
    if (!editing) return;
    const payload: any = {
      nombre: editing.nombre,
      usuario: editing.usuario,
      rol: editing.rol,
      dpi: editing.dpi,
      numero_celular: editing.numero_celular,
      horario_entrada: editing.horario_entrada,
      horario_salida: editing.horario_salida,
      horario_almuerzo: editing.horario_almuerzo
    };
    if (newPass) payload.contrasena = newPass;
    try {
      const method = editing.id ? 'PUT' : 'POST';
      if (editing.id) payload.id = editing.id;
      const res = await fetch('/api/admin/users', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (j.ok) {
        setEditing(null); setNewPass(''); setShowModal(false); fetchUsers();
      } else {
        const err = typeof j.error === 'string' ? j.error : (j.error && j.error.message) ? j.error.message : JSON.stringify(j.error);
        alert(err || 'Error');
      }
    } catch (e) {
      if (e instanceof Error) alert(e.message); else alert(JSON.stringify(e, null, 2));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar usuario?')) return;
    try {
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const j = await res.json();
      if (j.ok) fetchUsers(); else {
        const err = typeof j.error === 'string' ? j.error : (j.error && j.error.message) ? j.error.message : JSON.stringify(j.error);
        alert(err || 'Error');
      }
    } catch (e) {
      if (e instanceof Error) alert(e.message); else alert(JSON.stringify(e, null, 2));
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Section Header & Actions ─────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <UsersIcon className="h-5 w-5 text-[#1e3a5f]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Administrar Usuarios</h2>
            <p className="text-xs text-slate-400">Crear, editar y gestionar cuentas de usuario</p>
          </div>
        </div>
        <button onClick={() => { handleCreate(); setShowModal(true); }} className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 active:scale-95 transition-all shadow-sm">
          <UserPlus className="h-4 w-4" />Crear Usuario
        </button>
      </div>

      {/* ── Search Bar ───────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <UsersIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input placeholder="Buscar usuario..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 transition-all" />
        </div>
        <button onClick={handleSearch} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#264d73] active:scale-95 transition-all shadow-sm">Buscar</button>
      </div>

      {/* ── Users Table ──────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-100">
          <h4 className="font-semibold text-slate-800 text-sm">Usuarios Registrados</h4>
          <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full font-medium">{users.length} usuarios</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-3">
            <div className="h-5 w-5 border-2 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-500">Cargando usuarios...</span>
          </div>
        ) : (
          <>
            {/* Desktop View */}
            <div className="hidden md:overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Nombre</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Usuario</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">DPI</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Celular</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Horarios</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Rol</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-800">{u.nombre}</td>
                      <td className="py-3 px-4 text-slate-600 text-xs">{u.usuario}</td>
                      <td className="py-3 px-4 text-slate-500 text-xs font-mono">{u.dpi || '—'}</td>
                      <td className="py-3 px-4 text-slate-600 text-xs">{u.numero_celular || '—'}</td>
                      <td className="py-3 px-4 text-xs">
                        <span className="inline-flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md text-slate-600 font-medium">
                          {u.horario_entrada || '06:30'} / {u.horario_almuerzo || '12:00'} / {u.horario_salida || '16:30'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${u.rol === 'admin' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-blue-50 text-[#1e3a5f] border border-blue-200'}`}>
                          {u.rol === 'admin' ? 'Admin' : 'Técnico'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <button title="Editar" onClick={() => { setEditing(u); setNewPass(''); setShowModal(true); }} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#1e3a5f] bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-all active:scale-95">
                            <Edit2 className="h-3 w-3" />Editar
                          </button>
                          <button title="Eliminar" onClick={() => handleDelete(u.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 transition-all active:scale-95">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View - Card Layout */}
            <div className="md:hidden space-y-3 p-4">
              {users.map(u => (
                <div key={u.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50 hover:bg-slate-100 transition-colors space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-800 text-sm leading-tight">{u.nombre}</h3>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{u.usuario}</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${u.rol === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {u.rol === 'admin' ? 'Admin' : 'Técnico'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 block font-medium mb-0.5">DPI</span>
                      <span className="text-slate-700 font-mono block">{u.dpi || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-medium mb-0.5">Celular</span>
                      <span className="text-slate-700 block">{u.numero_celular || '—'}</span>
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-slate-500 font-medium mb-1 block text-xs">Horarios</span>
                    <span className="inline-flex items-center gap-1 bg-white px-2 py-1 rounded text-xs text-slate-600 font-medium">
                      {u.horario_entrada || '06:30'} / {u.horario_almuerzo || '12:00'} / {u.horario_salida || '16:30'}
                    </span>
                  </div>
                  
                  <div className="flex gap-2 pt-2 border-t border-slate-200">
                    <button title="Editar" onClick={() => { setEditing(u); setNewPass(''); setShowModal(true); }} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-[#1e3a5f] bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-all active:scale-95">
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>Editar</span>
                    </button>
                    <button title="Eliminar" onClick={() => handleDelete(u.id)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 transition-all active:scale-95">
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Eliminar</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Create / Edit Modal ──────────────────────── */}
      <Dialog open={showModal} onOpenChange={(open) => { setShowModal(open); if (!open) setEditing(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-center">{editing?.id ? 'Editar Usuario' : 'Crear Usuario'}</DialogTitle>
            <DialogDescription className="text-center">Completa los datos del usuario y sus horarios</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Nombre</label>
                  <input placeholder="Nombre completo" value={editing.nombre} onChange={(e) => setEditing({ ...editing, nombre: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Usuario (email)</label>
                  <input placeholder="correo@ejemplo.com" value={editing.usuario} onChange={(e) => setEditing({ ...editing, usuario: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">DPI</label>
                  <input placeholder="Documento de identidad" value={editing.dpi || ''} onChange={(e) => setEditing({ ...editing, dpi: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Celular</label>
                  <input placeholder="Número de celular" value={editing.numero_celular || ''} onChange={(e) => setEditing({ ...editing, numero_celular: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 transition-all" />
                </div>
              </div>

              {/* Schedule Section */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                <p className="text-xs font-semibold text-slate-600 mb-3 uppercase tracking-wider">Horarios (Formato 24h)</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-slate-500 font-medium mb-1 block">Entrada</label>
                    <input type="time" value={editing.horario_entrada || '06:30'} onChange={(e) => setEditing({ ...editing, horario_entrada: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm bg-white focus:outline-none focus:border-[#1e3a5f] transition-all" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-medium mb-1 block">Almuerzo</label>
                    <input type="time" value={editing.horario_almuerzo || '12:00'} onChange={(e) => setEditing({ ...editing, horario_almuerzo: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm bg-white focus:outline-none focus:border-[#1e3a5f] transition-all" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-medium mb-1 block">Salida</label>
                    <input type="time" value={editing.horario_salida || '16:30'} onChange={(e) => setEditing({ ...editing, horario_salida: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm bg-white focus:outline-none focus:border-[#1e3a5f] transition-all" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Rol</label>
                  <select value={editing.rol} onChange={(e) => setEditing({ ...editing, rol: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 transition-all cursor-pointer">
                    <option value="tecnico">Técnico</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Contraseña {editing.id ? '(opcional)' : ''}</label>
                  <input type="password" placeholder={editing.id ? 'Dejar vacío para no cambiar' : 'Contraseña'} value={newPass} onChange={(e) => setNewPass(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10 transition-all" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => { setShowModal(false); setEditing(null); }} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-all">Cancelar</button>
                <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-[#1e3a5f] rounded-lg hover:bg-[#264d73] active:scale-95 transition-all">Guardar</button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
