import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, LayoutDashboard, Users, CreditCard, Search, X, Trash2, Plus, AlertTriangle, Shield, RefreshCcw } from 'lucide-react';
import { ApiService, Socio, Pago, EstadoSocio, TipoPlan, Perfil } from '../services/api';

const DEFAULT_PERMISSIONS = {
  admin: { p1: true, p2: true, p3: true, p4: true, p5: true, p6: true },
  operador: { p1: true, p2: true, p3: true, p4: true, p5: false, p6: false },
  visita: { p1: true, p2: false, p3: false, p4: true, p5: false, p6: false }
};

export default function Configuracion() {
  const { perfil } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'paneles'|'socios'|'usuarios'|'pagos'>('paneles');

  useEffect(() => {
    if (perfil && perfil.rol !== 'admin') {
      navigate('/');
    }
  }, [perfil, navigate]);

  if (perfil?.rol !== 'admin') return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 bg-white dark:bg-dark-800 rounded-2xl shadow-glass border border-slate-100 dark:border-dark-700 gap-4 relative">
        <button 
          onClick={() => navigate(-1)}
          className="absolute top-6 right-6 p-2 rounded-xl bg-slate-100 dark:bg-dark-700 hover:bg-slate-200 dark:hover:bg-dark-600 transition-colors flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Volver
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Configuración</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Panel exclusivo para administradores</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 flex flex-col gap-2 shrink-0">
          <button 
            onClick={() => setActiveTab('paneles')}
            className={`flex items-center p-4 rounded-xl font-semibold transition-all ${activeTab === 'paneles' ? 'bg-primary-600 text-white shadow-md' : 'bg-white dark:bg-dark-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-700 border border-slate-100 dark:border-dark-700/50'}`}
          >
            <LayoutDashboard className="w-5 h-5 mr-3" /> Configurar Paneles
          </button>
          <button 
            onClick={() => setActiveTab('socios')}
            className={`flex items-center p-4 rounded-xl font-semibold transition-all ${activeTab === 'socios' ? 'bg-primary-600 text-white shadow-md' : 'bg-white dark:bg-dark-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-700 border border-slate-100 dark:border-dark-700/50'}`}
          >
            <Users className="w-5 h-5 mr-3" /> Socios
          </button>
          <button 
            onClick={() => setActiveTab('usuarios')}
            className={`flex items-center p-4 rounded-xl font-semibold transition-all ${activeTab === 'usuarios' ? 'bg-primary-600 text-white shadow-md' : 'bg-white dark:bg-dark-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-700 border border-slate-100 dark:border-dark-700/50'}`}
          >
            <Shield className="w-5 h-5 mr-3" /> Usuarios (Perfiles)
          </button>
          <button 
            onClick={() => setActiveTab('pagos')}
            className={`flex items-center p-4 rounded-xl font-semibold transition-all ${activeTab === 'pagos' ? 'bg-primary-600 text-white shadow-md' : 'bg-white dark:bg-dark-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-700 border border-slate-100 dark:border-dark-700/50'}`}
          >
            <CreditCard className="w-5 h-5 mr-3" /> Anular Pagos
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white dark:bg-dark-800 rounded-2xl shadow-sm border border-slate-100 dark:border-dark-700 overflow-hidden min-h-[500px]">
          {activeTab === 'paneles' && <PanelesTab />}
          {activeTab === 'socios' && <SociosTab />}
          {activeTab === 'usuarios' && <UsuariosTab />}
          {activeTab === 'pagos' && <PagosTab />}
        </div>
      </div>
    </div>
  );
}

// --- SUB-TABS COMPONENTS ---

function PanelesTab() {
  const [permissions, setPermissions] = useState<any>(DEFAULT_PERMISSIONS);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('aacm_panel_permissions');
    if (stored) {
      setPermissions(JSON.parse(stored));
    }
  }, []);

  const handleToggle = (rol: string, panel: string) => {
    setPermissions((prev: any) => ({
      ...prev,
      [rol]: {
        ...prev[rol],
        [panel]: !prev[rol][panel]
      }
    }));
  };

  const saveConfig = () => {
    localStorage.setItem('aacm_panel_permissions', JSON.stringify(permissions));
    setSavedMsg('Configuración guardada exitosamente.');
    
    // Dispatch an event so if Dashboard is mounted or navigating back it picks it up immediately
    window.dispatchEvent(new Event('aacm_permissions_updated'));

    setTimeout(() => setSavedMsg(''), 3000);
  };

  const roles = ['admin', 'operador', 'visita'];
  const paneles = [
    { id: 'p1', name: 'Socios al Día' },
    { id: 'p2', name: 'Recaudación Anual' },
    { id: 'p3', name: 'Cobros Mes Actual' },
    { id: 'p4', name: 'Mix de Planes' },
    { id: 'p5', name: 'Proyección Próx. Mes' },
    { id: 'p6', name: 'Morosidad (>60d)' }
  ];

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-100">Visibilidad de Paneles (Dashboard)</h2>
      <p className="text-sm text-slate-500 mb-6 font-medium">Define qué roles pueden visualizar cada panel en el Resumen Financiero.</p>
      
      <div className="overflow-x-auto w-full border border-slate-200 dark:border-dark-700 rounded-xl">
        <table className="w-full text-left min-w-[600px] border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-dark-900 border-b border-slate-200 dark:border-dark-700 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <th className="p-4 border-r border-slate-200 dark:border-dark-700">Panel \ Rol</th>
              {roles.map(rol => (
                <th key={rol} className="p-4 text-center capitalize w-32 border-r border-slate-200 dark:border-dark-700 last:border-0">{rol}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paneles.map(panel => (
              <tr key={panel.id} className="border-b border-slate-100 dark:border-dark-700 hover:bg-slate-50/50 dark:hover:bg-dark-800/50">
                <td className="p-4 font-medium text-slate-700 dark:text-slate-200 border-r border-slate-100 dark:border-dark-700">
                  {panel.name}
                </td>
                {roles.map(rol => (
                  <td key={rol} className="p-4 text-center border-r border-slate-100 dark:border-dark-700 last:border-0">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 bg-slate-100 dark:bg-dark-900 cursor-pointer"
                      checked={permissions[rol][panel.id]}
                      onChange={() => handleToggle(rol, panel.id)}
                      disabled={rol === 'admin'} // Admin always sees everything ideally, but let's allow it per request logic, or just disable
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-center justify-end gap-4">
        {savedMsg && <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{savedMsg}</span>}
        <button onClick={saveConfig} className="btn-primary">Guardar Configuración</button>
      </div>
    </div>
  );
}

function SociosTab() {
  const [socios, setSocios] = useState<Socio[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Socio>>({
    nombre: '', apellido: '', email: '', telefono: '', estado: 'Activo', plan: 'Mensual'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { loadSocios(); }, []);

  async function loadSocios() {
    setIsLoading(true);
    try {
      const data = await ApiService.getSocios();
      setSocios(data);
    } catch(err) { console.error(err); }
    finally { setIsLoading(false); }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (formData.id_socio) await ApiService.updateSocio(formData.id_socio, formData);
      else await ApiService.createSocio(formData as any);
      setIsModalOpen(false);
      loadSocios();
    } catch(err) { alert('Error guardando socio.'); console.error(err); }
    finally { setIsSubmitting(false); }
  };

  const filtered = socios.filter(s => s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || s.apellido.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="p-6 flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Gestión Completa de Socios</h2>
          <p className="text-sm text-slate-500 font-medium">Creación, edición y baja definitiva de socios.</p>
        </div>
        <button onClick={() => { setFormData({ nombre: '', apellido: '', email: '', telefono: '', estado: 'Activo', plan: 'Mensual' }); setIsModalOpen(true); }} className="btn-primary shrink-0">
          <Plus className="w-5 h-5 mr-2" /> Alta de Socio
        </button>
      </div>

      <div className="relative mb-4 w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Buscar por nombre..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input-field pl-10 w-full" />
      </div>

      <div className="flex-1 overflow-auto rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50/30 dark:bg-dark-900/30">
        <table className="w-full text-left border-collapse min-w-full">
            <thead>
              <tr className="bg-slate-100 dark:bg-dark-800 border-b border-slate-200 dark:border-dark-700 text-sm font-semibold text-slate-600 dark:text-slate-300">
                <th className="p-3">Socio</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Plan</th>
                <th className="p-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td colSpan={4} className="p-4 text-center">Cargando...</td></tr> : filtered.map(s => (
                <tr key={s.id_socio} className="border-b border-slate-100 dark:border-dark-700 hover:bg-white dark:hover:bg-dark-800">
                  <td className="p-3 font-medium text-sm">{s.nombre} {s.apellido}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs font-bold ${s.estado === 'Baja' ? 'bg-red-200 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>{s.estado}</span></td>
                  <td className="p-3 text-sm text-slate-500 capitalize">{s.plan || 'Mensual'}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => { setFormData(s); setIsModalOpen(true); }} className="text-primary-600 hover:underline text-sm font-semibold">Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-lg p-6 my-auto">
            <h2 className="text-xl font-bold mb-4">{formData.id_socio ? 'Edición Avanzada' : 'Alta de Socio'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input required type="text" placeholder="Nombre" className="input-field" value={formData.nombre || ''} onChange={e => setFormData({...formData, nombre: e.target.value})} />
                <input required type="text" placeholder="Apellido" className="input-field" value={formData.apellido || ''} onChange={e => setFormData({...formData, apellido: e.target.value})} />
              </div>
              <input type="text" placeholder="DNI" className="input-field w-full" value={formData.dni || ''} onChange={e => setFormData({...formData, dni: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <input type="email" placeholder="Email" className="input-field w-full" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
                <input type="text" placeholder="Teléfono" className="input-field w-full" value={formData.telefono || ''} onChange={e => setFormData({...formData, telefono: e.target.value})} />
              </div>
              <div className="grid grid-cols-1 gap-4 p-4 border rounded-xl border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-900/50">
                <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-2">
                  <AlertTriangle className="w-4 h-4 inline mr-1 -mt-0.5" /> Opciones Avanzadas
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Estado</label>
                  <select className="input-field w-full border-amber-200 focus:ring-amber-500" value={formData.estado} onChange={e => setFormData({...formData, estado: e.target.value as EstadoSocio})}>
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                    <option value="Vitalicio">Vitalicio</option>
                    <option value="Suspendido">Suspendido</option>
                    <option value="Baja">Baja Definitiva</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary">{isSubmitting ? 'Guardando...' : 'Confirmar Cambios'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function UsuariosTab() {
  const { perfil } = useAuth();
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [roleMenuOpen, setRoleMenuOpen] = useState<string | null>(null);

  useEffect(() => { loadPerfiles(); }, []);

  async function loadPerfiles() {
    setIsLoading(true);
    try {
      const data = await ApiService.getPerfiles();
      // Filter out current user
      const filtered = perfil ? data.filter(p => p.id !== perfil.id) : data;
      setPerfiles(filtered);
    } catch(err) { console.error(err); }
    finally { setIsLoading(false); }
  }

  const handleDelete = async (p: Perfil) => {
    if (window.confirm(`¿Está seguro de que desea eliminar permanentemente al usuario ${p.full_name || p.email}?`)) {
      setIsUpdating(p.id);
      try {
        await ApiService.deletePerfil(p.id);
        setPerfiles(prev => prev.filter(x => x.id !== p.id));
      } catch (err) {
        alert('Error al eliminar usuario.');
        console.error(err);
      } finally {
        setIsUpdating(null);
      }
    }
  };

  const handleChangeRole = async (p: Perfil, newRol: 'admin'|'operador'|'visita') => {
    setIsUpdating(p.id);
    try {
      await ApiService.updatePerfilRol(p.id, newRol);
      setPerfiles(prev => prev.map(x => x.id === p.id ? { ...x, rol: newRol } : x));
      setRoleMenuOpen(null);
    } catch (err) {
      alert('Error al actualizar rol.');
      console.error(err);
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <div className="p-6 flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Cuentas de Acceso (Perfiles)</h2>
          <p className="text-sm text-slate-500 font-medium">Gestión de usuarios y sus niveles de acceso (Roles).</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded-xl border border-slate-200 dark:border-dark-700 bg-slate-50/30 dark:bg-dark-900/30">
        <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-slate-100 dark:bg-dark-800 border-b border-slate-200 dark:border-dark-700 text-sm font-semibold text-slate-600 dark:text-slate-300">
                <th className="p-4">Nombre y Avatar</th>
                <th className="p-4">Rol</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td colSpan={3} className="p-4 text-center">Cargando usuarios...</td></tr> : perfiles.length === 0 ? <tr><td colSpan={3} className="p-4 text-center text-slate-500">No hay otros usuarios.</td></tr> : perfiles.map(p => (
                <tr key={p.id} className="border-b border-slate-100 dark:border-dark-700 hover:bg-white dark:hover:bg-dark-800 transition-colors">
                  <td className="p-4 flex items-center gap-3">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="w-10 h-10 rounded-full border shadow-sm" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-dark-700 flex items-center justify-center text-slate-500 font-bold uppercase shadow-sm">
                        {(p.full_name || p.email || '?').charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{p.full_name || 'Sin Nombre'}</div>
                      <div className="text-xs text-slate-500">{p.email}</div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 bg-slate-100 dark:bg-dark-900 border border-slate-200 dark:border-dark-600 capitalize text-sm font-bold text-slate-600 dark:text-slate-300 rounded-lg shrink-0`}>
                      {p.rol}
                    </span>
                  </td>
                  <td className="p-4 text-center align-middle relative">
                    <div className="flex items-center justify-center gap-2">
                       {/* Change Role Button & Modal Overlay logic */}
                       <div className="relative">
                         <button 
                           onClick={() => setRoleMenuOpen(roleMenuOpen === p.id ? null : p.id)}
                           disabled={isUpdating === p.id}
                           className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 border border-blue-200 dark:border-blue-800/30"
                           title="Cambiar Rol"
                         >
                           <RefreshCcw className="w-3.5 h-3.5" /> Rol
                         </button>
                         
                         {roleMenuOpen === p.id && (
                           <div className="absolute top-full right-0 mt-2 bg-white dark:bg-dark-800 rounded-xl shadow-xl border border-slate-200 dark:border-dark-700 z-10 w-48 overflow-hidden animate-in fade-in zoom-in-95 origin-top-right">
                             <div className="p-2 border-b border-slate-100 dark:border-dark-700 text-xs font-semibold text-slate-500 bg-slate-50 dark:bg-dark-900/50">Seleccione el nuevo rol</div>
                             <button onClick={() => handleChangeRole(p, 'admin')} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-dark-700 capitalize text-slate-700 dark:text-slate-300">Admin</button>
                             <button onClick={() => handleChangeRole(p, 'operador')} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-dark-700 capitalize text-slate-700 dark:text-slate-300">Operador</button>
                             <button onClick={() => handleChangeRole(p, 'visita')} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-dark-700 capitalize text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-dark-700">Visita</button>
                             <button onClick={() => setRoleMenuOpen(null)} className="w-full text-center px-4 py-2 text-xs font-bold text-slate-400 bg-slate-50 hover:text-slate-600 dark:bg-dark-900 dark:hover:text-slate-300">Cancelar</button>
                           </div>
                         )}
                       </div>

                       <button 
                         onClick={() => handleDelete(p)}
                         disabled={isUpdating === p.id}
                         className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-800/30"
                         title="Eliminar Perfil"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
        </table>
      </div>
    </div>
  );
}

function PagosTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [socios, setSocios] = useState<Socio[]>([]);
  const [selectedSocio, setSelectedSocio] = useState<Socio | null>(null);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  useEffect(() => {
    ApiService.getSocios().then(res => setSocios(res));
  }, []);

  const handleSelectSocio = async (socio: Socio) => {
    setSelectedSocio(socio);
    setIsLoading(true);
    try {
      const data = await ApiService.getPagosBySocio(socio.id_socio);
      setPagos(data);
    } catch(err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnular = async (pago: Pago) => {
    if (window.confirm(`¿Está seguro de que desea ANULAR este pago de $${pago.monto} realizado el ${new Date(pago.fecha_pago).toLocaleDateString()}? Esta acción es irreversible.`)) {
      setIsDeleting(pago.id_pago);
      try {
        await ApiService.deletePago(pago.id_pago);
        setPagos(prev => prev.filter(p => p.id_pago !== pago.id_pago));
      } catch (err) {
        alert('Error al anular pago.');
        console.error(err);
      } finally {
        setIsDeleting(null);
      }
    }
  };

  const filtered = searchTerm.length > 2 ? socios.filter(s => s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || s.apellido.toLowerCase().includes(searchTerm.toLowerCase())) : [];

  return (
    <div className="p-6 flex flex-col md:flex-row gap-8 h-full">
      {/* Buscador */}
      <div className="w-full md:w-1/3 flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1">Anulación de Pagos</h2>
          <p className="text-sm font-medium text-slate-500 mb-4">Busque un socio para auditar y anular sus cobros procesados.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar asociado..." 
            value={searchTerm} 
            onChange={e => { setSearchTerm(e.target.value); setSelectedSocio(null); setPagos([]); }} 
            className="input-field pl-10 w-full" 
          />
        </div>
        <div className="flex-1 overflow-y-auto max-h-[400px] border border-slate-100 dark:border-dark-700 rounded-xl bg-slate-50 dark:bg-dark-900/50 custom-scrollbar">
          {searchTerm.length <= 2 ? (
            <div className="p-4 text-center text-sm text-slate-400 font-medium">Escriba al menos 3 letras para buscar...</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-400 font-medium">Sin resultados.</div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-dark-700">
              {filtered.map(s => (
                <li key={s.id_socio}>
                  <button onClick={() => handleSelectSocio(s)} className={`w-full text-left p-3 hover:bg-slate-100 dark:hover:bg-dark-700 transition-colors ${selectedSocio?.id_socio === s.id_socio ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-semibold' : 'text-slate-600 dark:text-slate-300'}`}>
                    <div className="font-medium text-sm">{s.nombre} {s.apellido}</div>
                    <div className="text-xs opacity-70 mt-0.5">ID: {s.id_socio} {s.dni && `· DNI: ${s.dni}`}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Resultados y Pagos */}
      <div className="flex-1 flex flex-col border border-slate-200 dark:border-dark-700 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-dark-900/30">
        <div className="p-4 border-b border-slate-200 dark:border-dark-700 bg-white dark:bg-dark-800">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">
            {selectedSocio ? `Listado de Pagos: ${selectedSocio.nombre} ${selectedSocio.apellido}` : 'Seleccione un socio'}
          </h3>
        </div>
        <div className="p-4 flex-1 overflow-y-auto">
          {!selectedSocio ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <CreditCard className="w-12 h-12 mb-4 opacity-50" />
              <p className="font-medium">Esperando selección...</p>
            </div>
          ) : isLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-16 bg-slate-200 dark:bg-dark-700 rounded-xl"></div>
              <div className="h-16 bg-slate-200 dark:bg-dark-700 rounded-xl"></div>
            </div>
          ) : pagos.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 font-medium">
              No hay pagos registrados para este socio.
            </div>
          ) : (
            <div className="space-y-3">
              {pagos.map(p => (
                <div key={p.id_pago} className="bg-white dark:bg-dark-800 p-4 rounded-xl border border-slate-200 dark:border-dark-600 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 text-lg">${p.monto.toLocaleString()}</div>
                    <div className="text-xs text-slate-500 font-medium mt-1">
                      {new Date(p.fecha_pago).toLocaleDateString()} · Cubre hasta {new Date(p.fin_cobertura).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-slate-100 dark:bg-dark-700 text-slate-600 dark:text-slate-400 rounded text-xs font-bold capitalize">{p.plan}</span>
                    <button 
                      onClick={() => handleAnular(p)}
                      disabled={isDeleting === p.id_pago}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-2 group"
                      title="Anular / Eliminar Pago"
                    >
                      <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
