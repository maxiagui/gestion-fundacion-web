import React, { useState, useEffect, useMemo } from 'react';
import { ApiService, Socio, Pago, CaracterSocio, TipoPlan, isSocioAlDia, CURRENT_DATE_MOCK, VALORES_CUOTA } from '../services/api';
import { normalizeSearch, toCapitalCase, LOCALIDADES } from '../lib/utils';
import { Search, Plus, UserCheck, UserX, X, Calendar as CalendarIcon, DollarSign, History, Smartphone, ArrowUp, ArrowDown } from 'lucide-react';
import { useLocation, useSearchParams } from 'react-router-dom';
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
  const [filterAlDia, setFilterAlDia] = useState<'Todos'|'Si'|'No'>('Todos');
  const [sortColumn, setSortColumn] = useState<'id_socio' | 'nombre'>('id_socio');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [searchParams] = useSearchParams();
  
  // ABM Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Socio>>({
    nombre: '', apellido: '', email: '', telefono: '', caracter: 'activo', estado: '', plan: 'Mensual', fecha_nacimiento: '', nacionalidad: 'Argentina', domicilio: '', localidad: '', fecha_ingreso: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pagos Modal component state
  const [pagosModalSocio, setPagosModalSocio] = useState<Socio | null>(null);
  const [sociosPagos, setSociosPagos] = useState<Pago[]>([]);
  const [isLoadingPagos, setIsLoadingPagos] = useState(false);
  const [nuevoPagoPlan, setNuevoPagoPlan] = useState<TipoPlan | string>('Mensual');
  const [nuevoPagoMedio, setNuevoPagoMedio] = useState<'efectivo' | 'virtual'>('efectivo');
  const [nuevoPagoLink, setNuevoPagoLink] = useState<string>('');
  const [isComprobanteModalOpen, setIsComprobanteModalOpen] = useState(false);
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null);
  const [isRegisteringPago, setIsRegisteringPago] = useState(false);

  const location = useLocation();

  useEffect(() => {
    if (location.pathname === '/socios/nuevo') setIsModalOpen(true);
    if (searchParams.get('al_dia') === 'no') setFilterAlDia('No');
    loadSocios();
  }, [location.pathname, searchParams]);

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
      await ApiService.registerPago(pagosModalSocio.id_socio, nuevoPagoPlan as TipoPlan, fechaPagoStr, nuevoPagoMedio, nuevoPagoMedio === 'virtual' ? nuevoPagoLink : null);
      
      setNuevoPagoLink('');
      setNuevoPagoMedio('efectivo');
      
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
  const getGrillaMeses = (socio: Socio): { meses: string[]; matrix: ('inactivo'|'cubierto'|'pendiente')[] } => {
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const matrix = new Array(12).fill('pendiente' as const);
    
    if (socio.estado === 'Vitalicio' || socio.caracter === 'vitalicio') {
      return { meses, matrix: new Array(12).fill('cubierto' as const) };
    }

    const derivedVencimiento = sociosPagos.length > 0 
      ? sociosPagos.reduce((max, p) => p.fin_cobertura && p.fin_cobertura > max ? p.fin_cobertura : max, sociosPagos[0].fin_cobertura || '') 
      : socio.vencimiento_actividad;
    
    // Si no hay fecha de ingreso, asumimos principio de año
    const start = socio.fecha_ingreso ? new Date(socio.fecha_ingreso + 'T00:00:00Z') : new Date('2026-01-01T00:00:00Z');
    const startYear = start.getUTCFullYear();
    const startMonth = startYear < 2026 ? 0 : (startYear > 2026 ? 11 : start.getUTCMonth());
    
    if (!derivedVencimiento) {
       // Sin pagos marcamos todo en base al inicio
       meses.forEach((_, index) => {
         matrix[index] = index < startMonth ? 'inactivo' : 'pendiente';
       });
       return { meses, matrix };
    }

    const end = new Date(derivedVencimiento + 'T23:59:59Z');
    const endYear = end.getUTCFullYear();
    const endMonth = endYear < 2026 ? 0 : (endYear > 2026 ? 11 : end.getUTCMonth());
    
    meses.forEach((_, index) => {
      if (index < startMonth) {
        matrix[index] = 'inactivo';
      } else if (index > endMonth) {
        matrix[index] = 'pendiente';
      } else {
        matrix[index] = 'cubierto';
      }
    });

    return { meses, matrix };
  };

  const normalizedSearchTerm = searchTerm.length >= 3 ? normalizeSearch(searchTerm) : searchTerm.toLowerCase();

  const filteredAndSortedSocios = useMemo(() => {
    let result = socios.filter(s => {
      // 1. Text Search
      let matchesSearch = true;
      if (searchTerm.length >= 3) {
        matchesSearch = normalizeSearch(s.nombre).includes(normalizedSearchTerm) ||
               normalizeSearch(s.apellido).includes(normalizedSearchTerm) ||
               (s.dni && s.dni.includes(searchTerm)) ||
               s.id_socio.toString().includes(searchTerm);
      } else if (searchTerm.length > 0) {
        matchesSearch = s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
              s.apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (s.dni && s.dni.includes(searchTerm)) ||
              s.id_socio.toString().includes(searchTerm);
      }
      
      if (!matchesSearch) return false;

      // 2. Al Día Filter
      if (filterAlDia !== 'Todos') {
        const alDia = isSocioAlDia(s);
        if (filterAlDia === 'Si' && !alDia) return false;
        if (filterAlDia === 'No' && alDia) return false;
      }

      return true;
    });

    // 3. Sorting
    result.sort((a, b) => {
       if (sortColumn === 'id_socio') {
         return sortDirection === 'asc' ? a.id_socio - b.id_socio : b.id_socio - a.id_socio;
       } else {
         const nameA = `${a.apellido} ${a.nombre}`.toLowerCase();
         const nameB = `${b.apellido} ${b.nombre}`.toLowerCase();
         if (nameA < nameB) return sortDirection === 'asc' ? -1 : 1;
         if (nameA > nameB) return sortDirection === 'asc' ? 1 : -1;
         return 0;
       }
    });

    return result;
  }, [socios, searchTerm, normalizedSearchTerm, filterAlDia, sortColumn, sortDirection]);

  const totalPages = Math.ceil(filteredAndSortedSocios.length / itemsPerPage);
  const paginatedSocios = filteredAndSortedSocios.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
            onClick={() => { setFormData({ nombre: '', apellido: '', email: '', telefono: '', caracter: 'activo', estado: '', plan: 'Mensual', fecha_nacimiento: '', nacionalidad: 'Argentina', domicilio: '', localidad: '', fecha_ingreso: new Date().toISOString().split('T')[0] }); setIsModalOpen(true); }}
            className="btn-primary w-full sm:w-auto justify-center"
          >
            <Plus className="w-5 h-5 mr-2" /> Nuevo Socio
          </button>
        )}
      </div>

      <div className="premium-card !p-0 overflow-hidden flex flex-col shadow-sm w-full">
        <div className="p-4 border-b border-slate-100 dark:border-dark-700 bg-slate-50/50 dark:bg-dark-900/50 flex flex-col sm:flex-row justify-between gap-4 items-center">
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Buscar por nombre, Nro de Socio o DNI..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="input-field pl-10 w-full" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">Al Día:</span>
              <select value={filterAlDia} onChange={e => setFilterAlDia(e.target.value as any)} className="input-field py-1.5 px-3 min-w-[100px]">
                <option value="Todos">Todos</option>
                <option value="Si">Sí</option>
                <option value="No">No</option>
              </select>
            </div>
          </div>
          <div className="text-sm font-medium text-slate-500 whitespace-nowrap flex items-center">{filteredAndSortedSocios.length} encontrados</div>
        </div>
        
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-dark-800 border-b border-slate-200 dark:border-dark-700 text-sm font-semibold text-slate-600 dark:text-slate-300">
                <th className="p-3 sm:p-4 text-center cursor-pointer hover:bg-slate-200 dark:hover:bg-dark-700 transition-colors select-none group w-20 sm:w-28" onClick={() => { setSortColumn('id_socio'); setSortDirection(sortColumn === 'id_socio' && sortDirection === 'asc' ? 'desc' : 'asc') }}>
                  <div className="flex items-center justify-center gap-1">
                    Nro. <span className="opacity-0 group-hover:opacity-100 transition-opacity"><ArrowUp className={cn("w-3 h-3", sortColumn === 'id_socio' && sortDirection === 'desc' && "rotate-180")} /></span>
                  </div>
                </th>
                <th className="p-3 sm:p-4 cursor-pointer hover:bg-slate-200 dark:hover:bg-dark-700 transition-colors select-none group" onClick={() => { setSortColumn('nombre'); setSortDirection(sortColumn === 'nombre' && sortDirection === 'asc' ? 'desc' : 'asc') }}>
                  <div className="flex items-center gap-1">
                    Asociado <span className="opacity-0 group-hover:opacity-100 transition-opacity"><ArrowUp className={cn("w-3 h-3", sortColumn === 'nombre' && sortDirection === 'desc' && "rotate-180")} /></span>
                  </div>
                </th>
                <th className="p-3 sm:p-4 text-center w-28 sm:w-32">Acciones</th>
                <th className="p-3 sm:p-4 text-center w-[80px]">Al Día</th>
                <th className="p-3 sm:p-4 text-center w-[100px]">Carácter</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="p-8 text-center"><div className="skeleton mx-auto h-6 w-32" /></td></tr>
              ) : paginatedSocios.map((s) => (
                <tr key={s.id_socio} className="border-b border-slate-100 dark:border-dark-700 hover:bg-slate-50/80 dark:hover:bg-dark-800/80 transition-colors">
                  <td className="p-3 sm:p-4 text-center">
                    <span className="font-mono text-slate-500 dark:text-slate-400 font-semibold">{s.id_socio}</span>
                  </td>
                  <td className="p-3 sm:p-4 truncate max-w-[150px] sm:max-w-none">
                    <div className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={`${toCapitalCase(s.nombre)} ${toCapitalCase(s.apellido)}`}>
                      {toCapitalCase(s.nombre)} {toCapitalCase(s.apellido)}
                    </div>
                  </td>
                  <td className="p-3 sm:p-4">
                    <div className="flex flex-row justify-center items-center gap-1 sm:gap-2">
                    <button onClick={() => openPagosModal(s)} className="btn-primary py-1 px-2 sm:py-1.5 sm:px-3 text-xs min-h-0 min-w-16">
                      {perfil?.rol === 'visita' ? 'Info' : 'Pagos'}
                    </button>
                    {perfil?.rol !== 'visita' && (
                      <button onClick={() => { 
                        setFormData({
                          ...s, 
                          nombre: toCapitalCase(s.nombre), 
                          apellido: toCapitalCase(s.apellido),
                          nacionalidad: toCapitalCase(s.nacionalidad),
                          domicilio: toCapitalCase(s.domicilio),
                          localidad: toCapitalCase(s.localidad),
                          estado: toCapitalCase(s.estado)
                        }); 
                        setIsModalOpen(true); 
                      }} className="btn-secondary py-1 px-2 sm:py-1.5 sm:px-3 text-xs min-h-0 min-w-16">
                        Editar
                      </button>
                    )}
                    </div>
                  </td>
                  <td className="p-3 sm:p-4 text-center">
                    {isSocioAlDia(s) ? 
                      <span className="inline-flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-medium text-xs sm:text-sm"><UserCheck className="w-3 h-3 sm:w-4 sm:h-4 mr-0.5 sm:mr-1"/> Sí</span> : 
                      <span className="inline-flex items-center justify-center text-red-600 dark:text-red-400 font-medium text-xs sm:text-sm"><UserX className="w-3 h-3 sm:w-4 sm:h-4 mr-0.5 sm:mr-1"/> No</span>
                    }
                  </td>
                  <td className="p-3 sm:p-4 text-center">
                    <span className={`px-2 py-1 ${
                      s.caracter === 'activo' || s.caracter === 'vitalicio' ? 'bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 
                      s.caracter === 'inactivo' ? 'bg-slate-100 text-slate-700 dark:bg-dark-700 dark:text-slate-400' :
                      s.caracter === 'suspendido' ? 'bg-amber-100/80 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      s.caracter === 'baja' ? 'bg-red-100/80 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-slate-100 text-slate-700 dark:bg-dark-700'
                    } rounded-lg text-xs font-bold whitespace-nowrap`}>
                      {toCapitalCase(s.caracter) || '-'}
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
          <div className="bg-white dark:bg-dark-800 rounded-3xl shadow-2xl w-full max-w-2xl p-6 md:p-8 my-auto relative animate-in zoom-in-95 duration-200">
            <button type="button" onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-700 rounded-full transition-colors"><X className="w-5 h-5"/></button>
            <h2 className="text-2xl font-bold mb-6 text-slate-800 dark:text-slate-100">{formData.id_socio ? 'Editar' : 'Alta de'} Socio</h2>
            <form onSubmit={handleSubmitSocio} className="space-y-6">
              
              {/* Identidad */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-dark-700 pb-1">Identidad</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <input required type="text" placeholder="Nombre" className="input-field w-full" value={formData.nombre || ''} onChange={e => setFormData({...formData, nombre: e.target.value})} />
                  </div>
                  <div className="md:col-span-2">
                    <input required type="text" placeholder="Apellido" className="input-field w-full" value={formData.apellido || ''} onChange={e => setFormData({...formData, apellido: e.target.value})} />
                  </div>
                  <div className="md:col-span-2">
                    <input type="text" placeholder="DNI (Opcional)" className="input-field w-full" value={formData.dni || ''} onChange={e => setFormData({...formData, dni: e.target.value})} />
                  </div>
                  <div className="md:col-span-2 relative">
                    <label className="absolute -top-2 left-2 bg-white dark:bg-dark-800 px-1 text-[10px] text-slate-500 font-semibold">F. Nacimiento</label>
                    <input type="date" title="Fecha de Nacimiento" className="input-field w-full" value={formData.fecha_nacimiento || ''} onChange={e => setFormData({...formData, fecha_nacimiento: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* Contacto */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-dark-700 pb-1">Contacto</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <input type="email" placeholder="Email" className="input-field w-full" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>
                  <div>
                    <input type="text" placeholder="Teléfono" className="input-field w-full" value={formData.telefono || ''} onChange={e => setFormData({...formData, telefono: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* Ubicación */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-dark-700 pb-1">Ubicación</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <input type="text" placeholder="Domicilio" className="input-field w-full" value={formData.domicilio || ''} onChange={e => setFormData({...formData, domicilio: e.target.value})} />
                  </div>
                  <div>
                    <select className="input-field w-full capitalize" value={formData.localidad || ''} onChange={e => setFormData({...formData, localidad: e.target.value})}>
                      <option value="">Seleccione Localidad...</option>
                      {LOCALIDADES.map(loc => <option key={loc} value={loc.toLowerCase()}>{loc}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Nacionalidad */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-dark-700 pb-1">Nacionalidad</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <input type="text" placeholder="Nacionalidad" className="input-field w-full" value={formData.nacionalidad || ''} onChange={e => setFormData({...formData, nacionalidad: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* Opciones Avanzadas */}
              <div className="mt-8 bg-amber-50/50 dark:bg-amber-900/10 rounded-2xl p-4 sm:p-5 border border-amber-100 dark:border-amber-900/20 space-y-4">
                <h4 className="text-sm font-bold text-amber-700 dark:text-amber-500 mb-2 flex items-center gap-2">Opciones Avanzadas</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Estado (Carácter)</label>
                    <select className="input-field w-full capitalize font-medium bg-white dark:bg-dark-800" value={formData.caracter || 'activo'} onChange={e => setFormData({...formData, caracter: e.target.value as CaracterSocio})}>
                      <option value="activo">Activo</option><option value="inactivo">Inactivo</option><option value="vitalicio">Vitalicio</option><option value="suspendido">Suspendido</option>
                      {(formData.caracter === 'baja' || !!formData.id_socio) && <option value="baja">Baja</option>}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Estado Civil / Situación</label>
                    <input type="text" placeholder="Ej: Soltero, Casado, etc." className="input-field w-full bg-white dark:bg-dark-800" value={formData.estado || ''} onChange={e => setFormData({...formData, estado: e.target.value})} />
                  </div>
                  <div className="sm:col-span-3 relative mt-2">
                     <label className="absolute -top-2 left-3 bg-white dark:bg-dark-800 px-1 text-[10px] text-amber-600 dark:text-amber-500 font-bold z-10">Fecha de Ingreso</label>
                     <input required type="date" className="input-field w-full bg-white dark:bg-dark-800" value={formData.fecha_ingreso || ''} onChange={e => setFormData({...formData, fecha_ingreso: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 w-full">
                {perfil?.rol === 'admin' && formData.id_socio && (
                  <button type="button" onClick={handleDeleteSocio} className="btn-secondary w-full sm:w-auto justify-center text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 mr-auto transition-colors">Eliminar Socio</button>
                )}
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary w-full sm:w-auto justify-center">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary w-full sm:w-auto justify-center min-w-[140px]">{isSubmitting ? 'Guardando...' : 'Confirmar Cambios'}</button>
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
                  {toCapitalCase(pagosModalSocio.nombre)} {toCapitalCase(pagosModalSocio.apellido)}
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
                      const isFullyCovered = pagosModalSocio.vencimiento_actividad && pagosModalSocio.vencimiento_actividad >= '2026-12-31';
                      if (isFullyCovered) {
                         return <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-lg">El año está completamente cubierto.</p>;
                      }
                      return (
                        <form onSubmit={handleRegisterPago} className="space-y-4">
                          <div>
                            <label className="text-xs font-semibold text-slate-500 mb-1 block">Tipo de Plan a Pagar</label>
                            <select 
                              className="input-field shadow-sm w-full font-medium"
                              value={nuevoPagoPlan}
                              onChange={(e) => setNuevoPagoPlan(e.target.value as TipoPlan)}
                            >
                              <option value="Mensual">Mensual (${VALORES_CUOTA.Mensual.toLocaleString()})</option>
                              <option value="Semestral">Semestral (${VALORES_CUOTA.Semestral.toLocaleString()})</option>
                              <option value="Anual">Anual (${VALORES_CUOTA.Anual.toLocaleString()})</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-500 mb-1 block mt-3">Medio de Pago</label>
                            <select 
                              className="input-field shadow-sm w-full font-medium"
                              value={nuevoPagoMedio}
                              onChange={(e) => setNuevoPagoMedio(e.target.value as 'efectivo' | 'virtual')}
                            >
                              <option value="efectivo">Efectivo</option>
                              <option value="virtual">Virtual</option>
                            </select>
                          </div>
                          {nuevoPagoMedio === 'virtual' && (
                            <div>
                               <label className="text-xs font-semibold text-slate-500 mb-1 block mt-3">Enlace al Comprobante</label>
                               <input required type="url" placeholder="https://" value={nuevoPagoLink} onChange={e => setNuevoPagoLink(e.target.value)} className="input-field shadow-sm w-full text-sm" />
                            </div>
                          )}
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
                          <div key={p.id_pago} className="p-3 bg-white dark:bg-dark-800 rounded-xl border border-slate-100 dark:border-dark-700 shadow-sm flex items-center justify-between text-sm gap-2">
                            <div className="flex items-center gap-3 truncate">
                              <div className="bg-slate-50 dark:bg-dark-900 p-2 rounded-full flex-shrink-0">
                                {p.medio_pago === 'virtual' ? 
                                  (p.link_comprobante ? 
                                    <button onClick={() => { setComprobanteUrl(p.link_comprobante!); setIsComprobanteModalOpen(true); }} className="text-blue-500 hover:text-blue-600 transition-colors" title="Ver comprobante"><Smartphone className="w-4 h-4" /></button> 
                                    : <Smartphone className="w-4 h-4 text-slate-400" />
                                  ) 
                                  : <DollarSign className="w-4 h-4 text-emerald-500" />
                                }
                              </div>
                              <div className="truncate">
                                <div className="font-semibold text-slate-700 dark:text-slate-300 truncate">${p.monto.toLocaleString()}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">{p.fecha_pago.split('T')[0].split('-').reverse().join('/')} - <span className="capitalize">{p.medio_pago || 'efectivo'}</span></div>
                              </div>
                            </div>
                            <span className="px-2 py-1 bg-slate-100 dark:bg-dark-900/50 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-dark-600 rounded text-xs font-semibold flex-shrink-0 capitalize">{p.plan}</span>
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
                      {(() => {
                        if (pagosModalSocio.estado === 'Vitalicio' || pagosModalSocio.caracter === 'vitalicio') return 'Permanente';
                        const maxFin = sociosPagos.length > 0 
                          ? sociosPagos.reduce((max, p) => p.fin_cobertura && p.fin_cobertura > max ? p.fin_cobertura : max, sociosPagos[0].fin_cobertura || '')
                          : pagosModalSocio.vencimiento_actividad;
                        return maxFin ? maxFin.split('T')[0].split('-').reverse().join('/') : 'N/A';
                      })()}
                    </div>
                  </div>
                </div>

                {/* 12-Month Calendar Grid */}
                <div>
                  <h3 className="font-bold text-slate-800 mb-4 text-base sm:text-lg">Grilla de Pagos (Meses Cubiertos 2026)</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    {getGrillaMeses(pagosModalSocio).meses.map((mes: string, index: number) => {
                      const state = getGrillaMeses(pagosModalSocio).matrix[index];
                      const isCurrentMonth = CURRENT_DATE_MOCK.getMonth() === index;
                      
                      return (
                        <div 
                          key={mes} 
                          className={cn(
                            "relative overflow-hidden p-3 sm:p-4 rounded-xl border flex flex-col items-center justify-center transition-all shadow-sm",
                            state === 'cubierto' && "bg-emerald-50 border-emerald-400 text-emerald-700",
                            state === 'pendiente' && "bg-emerald-50/50 border-emerald-200/50 text-emerald-700/50",
                            state === 'inactivo' && "bg-red-50/50 border-red-200/50 text-red-700/50",
                            isCurrentMonth && state !== 'cubierto' && "ring-2 ring-amber-300 ring-offset-2",
                            isCurrentMonth && state === 'cubierto' && "ring-2 ring-emerald-400 ring-offset-2"
                          )}
                        >
                          <span className="font-bold text-base sm:text-lg mb-1">{mes}</span>
                          {state === 'cubierto' && <span className="text-[10px] sm:text-xs bg-emerald-200 text-emerald-800 px-2 rounded-full font-semibold">CUBIERTO</span>}
                          {state === 'pendiente' && <span className="text-[10px] sm:text-xs opacity-50">Pendiente</span>}
                          {state === 'inactivo' && <span className="text-[10px] sm:text-xs opacity-50">Inactivo</span>}
                          {isCurrentMonth && (
                            <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Mes Actual"></div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-start sm:items-center justify-start sm:justify-end gap-3 sm:gap-6 text-xs sm:text-sm">
                    <div className="flex items-center text-slate-800 dark:text-slate-200 font-medium">
                        <div className="w-4 h-4 rounded bg-emerald-50 border border-emerald-400 mr-2 opacity-100"></div> Mes cubierto
                    </div>
                    <div className="flex items-center text-slate-800 dark:text-slate-200 font-medium">
                        <div className="w-4 h-4 rounded bg-emerald-50 border border-emerald-200 mr-2 opacity-100"></div> Pendiente
                    </div>
                    <div className="flex items-center text-slate-800 dark:text-slate-200 font-medium">
                        <div className="w-4 h-4 rounded bg-red-50 border border-red-300 mr-2 opacity-100"></div> Inactivo
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comprobante Modal */}
      {isComprobanteModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm shadow-2xl">
          <div className="bg-white dark:bg-dark-800 rounded-3xl w-full max-w-lg p-6 relative animate-in zoom-in-95 duration-200 shadow-2xl">
            <button onClick={() => setIsComprobanteModalOpen(false)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-dark-700 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500"/></button>
            <h3 className="text-xl font-bold mb-4 flex items-center text-slate-800 dark:text-slate-100">Comprobante de Pago</h3>
            <div className="w-full flex items-center justify-center bg-slate-50 dark:bg-dark-900 rounded-2xl overflow-hidden min-h-[300px] border border-slate-100 dark:border-dark-700 shadow-inner">
              {comprobanteUrl ? (
                <img src={comprobanteUrl} alt="Comprobante" className="max-w-full max-h-[60vh] object-contain rounded-xl" />
              ) : (
                <div className="text-slate-400 font-medium flex flex-col items-center gap-2">
                  <Smartphone className="w-10 h-10 opacity-30" />
                  <span>Imagen no disponible</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
