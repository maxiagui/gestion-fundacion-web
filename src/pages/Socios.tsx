import React, { useState, useEffect, useMemo } from 'react';
import { ApiService, Socio, Pago, EstadoSocio, TipoPlan, isSocioAlDia, CURRENT_DATE_MOCK, VALORES_CUOTA } from '../services/api';
import { Search, Plus, UserCheck, UserX, X, Calendar as CalendarIcon, DollarSign, History } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function Socios() {
  const { perfil } = useAuth();
  const [socios, setSocios] = useState<Socio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  // ABM Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Socio>>({
    nombre: '', apellido: '', email: '', telefono: '', estado: 'Activo', plan: 'Mensual'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pagos Modal component state
  const [pagosModalSocio, setPagosModalSocio] = useState<Socio | null>(null);
  const [sociosPagos, setSociosPagos] = useState<Pago[]>([]);
  const [isLoadingPagos, setIsLoadingPagos] = useState(false);
  const [nuevoPagoPlan, setNuevoPagoPlan] = useState<TipoPlan | string>('Mensual');
  const [isRegisteringPago, setIsRegisteringPago] = useState(false);

  const location = useLocation();

  useEffect(() => {
    if (location.pathname === '/socios/nuevo') setIsModalOpen(true);
    loadSocios();
  }, [location.pathname]);

  async function loadSocios() {
    setIsLoading(true);
    try {
      const data = await ApiService.getSocios();
      setSocios(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  const openPagosModal = async (socio: Socio) => {
    setPagosModalSocio(socio);
    setIsLoadingPagos(true);
    setNuevoPagoPlan('Mensual');
    try {
      const pagos = await ApiService.getPagosBySocio(socio.id_socio);
      setSociosPagos(pagos);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingPagos(false);
    }
  };

  const handleRegisterPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pagosModalSocio) return;

    if (nuevoPagoPlan === 'Semestral' && pagosModalSocio.vencimiento_actividad) {
      const currentEnd = new Date(pagosModalSocio.vencimiento_actividad);
      if (currentEnd > CURRENT_DATE_MOCK) {
         // si tiene 7 meses cubiertos o mas -> actual payment extends beyond June (month >= 6)
         if (currentEnd.getMonth() >= 6 && currentEnd.getFullYear() === CURRENT_DATE_MOCK.getFullYear()) {
             const extra = (currentEnd.getMonth() + 6) - 11; 
             const proceed = window.confirm(`Con este pago, paga ${extra > 0 ? extra : 1} cuota(s) mas de las correspondientes al año. ¿Desea continuar y topar la cobertura al 31/12?`);
             if (!proceed) return;
         }
      }
    }

    setIsRegisteringPago(true);
    try {
      // Register payment mocked to today (CURRENT_DATE_MOCK)
      const fechaPagoStr = CURRENT_DATE_MOCK.toISOString().split('T')[0];
      await ApiService.registerPago(pagosModalSocio.id_socio, nuevoPagoPlan as TipoPlan, fechaPagoStr);
      
      // Reload everything to reflect new end dates
      await loadSocios();
      const pagos = await ApiService.getPagosBySocio(pagosModalSocio.id_socio);
      setSociosPagos(pagos);
      
      // Update the reference object for the modal
      const updatedSocio = await ApiService.getSocios().then(res => res.find(s => s.id_socio === pagosModalSocio.id_socio));
      if(updatedSocio) setPagosModalSocio(updatedSocio);

    } catch (error) {
      console.error(error);
      alert('Error registrando el pago');
    } finally {
      setIsRegisteringPago(false);
    }
  };

  // Helper calculating coverage matrix for 2026
  const getGrillaMeses = (socio: Socio): { meses: string[]; matrix: boolean[] } => {
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const matrix = new Array(12).fill(false);
    
    // We check month by month for Year 2026.
    // A month is marked green if its start date is within coverages or starting a new coverage span
    const start2026 = new Date('2026-01-01T00:00:00');
    // For simplicity, if they have an active coverage span that covers the 15th of that month, we mark it green
    
    // We determine this just by the socio's global range for this simple simulation, or 
    // strictly by the pagos to be perfectly robust.
    // Let's use the socio's total coverage limits for now as it's continuous
    if (socio.estado === 'Vitalicio') return { meses, matrix: new Array(12).fill(true) };
    
    if (socio.fecha_ingreso && socio.vencimiento_actividad) {
      const start = new Date(socio.fecha_ingreso);
      const end = new Date(socio.vencimiento_actividad);
      
      meses.forEach((_, index) => {
        // mid of the month
        const targetDate = new Date(2026, index, 15);
        if (targetDate >= start && targetDate <= end) {
          matrix[index] = true;
        }
      });
    }

    // Additionally, color specific manual bounds if needed, but socio's own date range usually encompasses the contiguous payments
    return { meses, matrix };
  };

  const filteredSocios = socios.filter(s => 
    s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.dni && s.dni.includes(searchTerm))
  );

  const totalPages = Math.ceil(filteredSocios.length / itemsPerPage);
  const paginatedSocios = filteredSocios.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleDeleteSocio = async () => {
    if (!formData.id_socio) return;
    if (window.confirm('¿Está seguro que desea eliminar a este socio definitivamente?')) {
      setIsSubmitting(true);
      try {
        await ApiService.deleteSocio(formData.id_socio);
        setIsModalOpen(false);
        loadSocios();
      } catch (error) {
        console.error(error);
        alert('Error al eliminar el socio.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleSubmitSocio = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (formData.id_socio) await ApiService.updateSocio(formData.id_socio, formData);
      else await ApiService.createSocio(formData as any);
      setIsModalOpen(false);
      loadSocios();
    } catch (error) { console.error(error); alert('Error.'); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Gestión de Socios</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Administración y estado de pagos</p>
        </div>
        {perfil?.rol !== 'visita' && (
          <button 
            onClick={() => { setFormData({ nombre: '', apellido: '', email: '', telefono: '', estado: 'Activo', plan: 'Mensual' }); setIsModalOpen(true); }}
            className="btn-primary w-full sm:w-auto justify-center"
          >
            <Plus className="w-5 h-5 mr-2" /> Nuevo Socio
          </button>
        )}
      </div>

      <div className="premium-card !p-0 overflow-hidden flex flex-col shadow-sm w-full">
        <div className="p-4 border-b border-slate-100 dark:border-dark-700 bg-slate-50/50 dark:bg-dark-900/50 flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Buscar por nombre o DNI..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="input-field pl-10 w-full" />
          </div>
          <div className="text-sm font-medium text-slate-500 flex items-center justify-end">{filteredSocios.length} asociados encontrados</div>
        </div>
        
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-dark-800 border-b border-slate-200 dark:border-dark-700 text-sm font-semibold text-slate-600 dark:text-slate-300">
                <th className="p-3 sm:p-4">Asociado</th>
                <th className="p-3 sm:p-4 text-center">Acciones</th>
                <th className="p-3 sm:p-4 text-center">Al Día</th>
                <th className="p-3 sm:p-4 text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="p-8 text-center"><div className="skeleton mx-auto h-6 w-32" /></td></tr>
              ) : paginatedSocios.map((s) => (
                <tr key={s.id_socio} className="border-b border-slate-100 dark:border-dark-700 hover:bg-slate-50/80 dark:hover:bg-dark-800/80 transition-colors">
                  <td className="p-3 sm:p-4 truncate max-w-[150px] sm:max-w-none">
                    <div className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={`${s.nombre} ${s.apellido}`}>{s.nombre} {s.apellido}</div>
                  </td>
                  <td className="p-3 sm:p-4 flex flex-col sm:flex-row justify-center items-center gap-1 sm:gap-2">
                    <button onClick={() => openPagosModal(s)} className="btn-primary py-1 px-2 sm:py-1.5 sm:px-3 text-[10px] sm:text-xs min-h-0 min-w-16">
                      {perfil?.rol === 'visita' ? 'Info' : 'Pagos'}
                    </button>
                    {perfil?.rol !== 'visita' && (
                      <button onClick={() => { setFormData(s); setIsModalOpen(true); }} className="btn-secondary py-1 px-2 sm:py-1.5 sm:px-3 text-[10px] sm:text-xs min-h-0 min-w-16">
                        Editar
                      </button>
                    )}
                  </td>
                  <td className="p-3 sm:p-4 text-center">
                    {isSocioAlDia(s) ? 
                      <span className="inline-flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-medium text-xs sm:text-sm"><UserCheck className="w-3 h-3 sm:w-4 sm:h-4 mr-0.5 sm:mr-1"/> Sí</span> : 
                      <span className="inline-flex items-center justify-center text-red-600 dark:text-red-400 font-medium text-xs sm:text-sm"><UserX className="w-3 h-3 sm:w-4 sm:h-4 mr-0.5 sm:mr-1"/> No</span>
                    }
                  </td>
                  <td className="p-3 sm:p-4 text-center">
                    <span className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 ${s.estado === 'Activo' || s.estado === 'Vitalicio' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' : 'bg-red-100 text-red-700 dark:bg-red-900/30'} rounded-lg text-[10px] sm:text-xs font-semibold whitespace-nowrap`}>
                      {s.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-dark-700 bg-slate-50/50 dark:bg-dark-900/50 flex flex-wrap justify-center items-center gap-2">
            <button 
              disabled={currentPage === 1} 
              onClick={() => setCurrentPage(1)} 
              className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Primero
            </button>
            <button 
              disabled={currentPage === 1} 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
              className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Anterior
            </button>
            <span className="px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">
              Página {currentPage} de {totalPages}
            </span>
            <button 
              disabled={currentPage === totalPages} 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
              className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente
            </button>
            <button 
              disabled={currentPage === totalPages} 
              onClick={() => setCurrentPage(totalPages)} 
              className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Último
            </button>
          </div>
        )}
      </div>

      {/* ABM Socio Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-lg p-6 my-auto">
            <h2 className="text-xl font-bold mb-4">{formData.id_socio ? 'Editar' : 'Nuevo'} Socio</h2>
            <form onSubmit={handleSubmitSocio} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input required type="text" placeholder="Nombre" className="input-field" value={formData.nombre || ''} onChange={e => setFormData({...formData, nombre: e.target.value})} />
                <input required type="text" placeholder="Apellido" className="input-field" value={formData.apellido || ''} onChange={e => setFormData({...formData, apellido: e.target.value})} />
              </div>
              <input type="text" placeholder="DNI (Opcional)" className="input-field w-full" value={formData.dni || ''} onChange={e => setFormData({...formData, dni: e.target.value})} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input type="email" placeholder="Email" className="input-field w-full" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
                <input type="text" placeholder="Teléfono" className="input-field w-full" value={formData.telefono || ''} onChange={e => setFormData({...formData, telefono: e.target.value})} />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <select className="input-field w-full" value={formData.estado} onChange={e => setFormData({...formData, estado: e.target.value as EstadoSocio})}>
                  <option value="Activo">Activo</option><option value="Inactivo">Inactivo</option><option value="Vitalicio">Vitalicio</option><option value="Suspendido">Suspendido</option>
                  {formData.estado === 'Baja' && <option value="Baja">Baja</option>}
                </select>
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t w-full">
                {perfil?.rol === 'admin' && formData.id_socio && (
                  <button type="button" onClick={handleDeleteSocio} className="btn-secondary w-full sm:w-auto justify-center text-red-600 border-red-200 hover:bg-red-50 mr-auto">Eliminar Socio</button>
                )}
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary w-full sm:w-auto justify-center">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary w-full sm:w-auto justify-center">{isSubmitting ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pagos & Grilla Modal */}
      {pagosModalSocio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-dark-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 my-auto">
            {/* Header */}
            <div className="flex justify-between items-center p-4 sm:p-6 border-b border-slate-100 dark:border-dark-700 bg-slate-50 dark:bg-dark-900/50">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                  <CalendarIcon className="text-primary-500 w-5 h-5 sm:w-6 sm:h-6" />
                  Estado de Cuenta 2026
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-sm sm:text-base">
                  {pagosModalSocio.nombre} {pagosModalSocio.apellido}
                </p>
              </div>
              <button onClick={() => setPagosModalSocio(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-dark-700 rounded-full transition-colors flex-shrink-0">
                <X className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
              {perfil?.rol !== 'visita' && (
                <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-slate-100 dark:border-dark-700 flex flex-col bg-slate-50/30 dark:bg-dark-900/20 md:overflow-y-auto shrink-0">
                  <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-dark-700">
                    <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center">
                      <Plus className="w-4 h-4 mr-2 text-emerald-500" /> Registrar Pago
                    </h3>
                    {(() => {
                      const isFullyCovered = pagosModalSocio.vencimiento_actividad && new Date(pagosModalSocio.vencimiento_actividad) >= new Date(CURRENT_DATE_MOCK.getFullYear(), 11, 31);
                      if (isFullyCovered) {
                         return <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-lg">El año está completamente cubierto.</p>;
                      }
                      return (
                        <form onSubmit={handleRegisterPago} className="space-y-4">
                          <div>
                            <label className="text-xs font-semibold text-slate-500 mb-1 block">Tipo de Plan a Pagar</label>
                            <select 
                              className="input-field bg-white shadow-sm w-full font-medium"
                              value={nuevoPagoPlan}
                              onChange={(e) => setNuevoPagoPlan(e.target.value as TipoPlan)}
                            >
                              <option value="Mensual">Mensual (${VALORES_CUOTA.Mensual.toLocaleString()})</option>
                              <option value="Semestral">Semestral (${VALORES_CUOTA.Semestral.toLocaleString()})</option>
                              <option value="Anual">Anual (${VALORES_CUOTA.Anual.toLocaleString()})</option>
                            </select>
                          </div>
                          <button type="submit" disabled={isRegisteringPago || pagosModalSocio.estado === 'Baja'} className="btn-primary w-full shadow-md bg-emerald-600 hover:bg-emerald-700 justify-center">
                            {isRegisteringPago ? 'Procesando...' : 'Confirmar Cobro'}
                          </button>
                        </form>
                      );
                    })()}
                  </div>

                  <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
                    <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center text-sm">
                      <History className="w-4 h-4 mr-2" /> Historial de Pagos
                    </h3>
                    {isLoadingPagos ? (
                      <div className="flex flex-col gap-2">
                        <div className="skeleton w-full h-10 rounded-xl" />
                        <div className="skeleton w-full h-10 rounded-xl" />
                      </div>
                    ) : sociosPagos.length === 0 ? (
                      <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-6 bg-slate-50 dark:bg-dark-900 border border-slate-100 dark:border-dark-700 border-dashed rounded-xl">
                        No hay pagos registrados.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {sociosPagos.map(p => (
                          <div key={p.id_pago} className="p-3 bg-white dark:bg-dark-800 rounded-xl border border-slate-100 dark:border-dark-700 shadow-sm flex justify-between items-center text-sm gap-2">
                            <div className="truncate">
                              <div className="font-semibold text-slate-700 dark:text-slate-300 truncate">${p.monto.toLocaleString()}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">{new Date(p.fecha_pago).toLocaleDateString()}</div>
                            </div>
                            <span className="px-2 py-1 bg-slate-100 dark:bg-dark-900/50 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-dark-600 rounded text-xs font-semibold flex-shrink-0">{p.plan}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Right Column: Information & Grid */}
              <div className={cn("w-full p-4 sm:p-8 flex flex-col bg-white dark:bg-dark-800 md:overflow-y-auto", perfil?.rol !== 'visita' && "md:w-2/3")}>
                
                {/* Status Box */}
                <div className="mb-6 sm:mb-8 p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-inner gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-500 mb-1">Estado de Cobertura actual</h4>
                    {isSocioAlDia(pagosModalSocio) ? (
                      <div className="flex items-center text-emerald-600 text-lg font-bold">
                        <UserCheck className="w-5 h-5 mr-2" /> AL DÍA
                      </div>
                    ) : (
                      <div className="flex items-center text-red-600 text-lg font-bold">
                        <UserX className="w-5 h-5 mr-2" /> VENCIDO / MOROSO
                      </div>
                    )}
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="text-xs font-semibold text-slate-400 mb-1 block">Fin de cobertura</div>
                    <div className="text-slate-800 font-bold">
                      {pagosModalSocio.estado === 'Vitalicio' ? 'Permanente' : 
                       pagosModalSocio.vencimiento_actividad ? new Date(pagosModalSocio.vencimiento_actividad).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                </div>

                {/* 12-Month Calendar Grid */}
                <div>
                  <h3 className="font-bold text-slate-800 mb-4 text-base sm:text-lg">Grilla de Pagos (Meses Cubiertos 2026)</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    {getGrillaMeses(pagosModalSocio).meses.map((mes: string, index: number) => {
                      const isCovered = getGrillaMeses(pagosModalSocio).matrix[index];
                      const isCurrentMonth = CURRENT_DATE_MOCK.getMonth() === index;
                      
                      return (
                        <div 
                          key={mes} 
                          className={cn(
                            "relative overflow-hidden p-3 sm:p-4 rounded-xl border flex flex-col items-center justify-center transition-all shadow-sm",
                            isCovered 
                              ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                              : "bg-slate-50 border-slate-200 text-slate-400",
                            isCurrentMonth && !isCovered && "ring-2 ring-amber-300 ring-offset-2",
                            isCurrentMonth && isCovered && "ring-2 ring-emerald-400 ring-offset-2"
                          )}
                        >
                          <span className="font-bold text-base sm:text-lg mb-1">{mes}</span>
                          {isCovered ? (
                            <span className="text-[10px] sm:text-xs bg-emerald-200 text-emerald-800 px-2 rounded-full font-semibold">CUBIERTO</span>
                          ) : (
                            <span className="text-[10px] sm:text-xs opacity-50">Pendiente</span>
                          )}
                          {isCurrentMonth && (
                            <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Mes Actual"></div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-start sm:items-center justify-start sm:justify-end gap-3 sm:gap-6 text-xs sm:text-sm">
                    <div className="flex items-center text-slate-500"><div className="w-4 h-4 rounded bg-emerald-100 border border-emerald-200 mr-2"></div> Mes cubierto</div>
                    <div className="flex items-center text-slate-500"><div className="w-4 h-4 rounded bg-slate-50 border border-slate-200 mr-2"></div> Pendiente</div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
