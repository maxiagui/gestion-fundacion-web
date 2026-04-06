import React, { useState, useEffect, useMemo } from 'react';
import { Users, DollarSign, CalendarCheck, TrendingUp, PieChart, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ApiService, Socio, Pago, CURRENT_DATE_MOCK, VALORES_CUOTA, isSocioAlDia } from '../services/api';
import { toCapitalCase } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// Simulated Pie Chart Component
const SimplePieChart = ({ data }: { data: { label: string; value: number; color: string }[] }) => {
  const total = data.reduce((acc, curr) => acc + curr.value, 0);
  if (total === 0) return <div className="h-40 flex items-center justify-center text-slate-400">Sin datos</div>;

  let currentGradient = 0;
  const stops = data.map(item => {
    const start = currentGradient;
    const end = start + (item.value / total) * 100;
    currentGradient = end;
    return `${item.color} ${start}% ${end}%`;
  }).join(', ');

  return (
    <div className="flex flex-col items-center justify-center h-48">
      <div 
        className="w-32 h-32 rounded-full mb-4 shadow-glass transition-transform hover:scale-105 duration-300"
        style={{ background: `conic-gradient(${stops})` }}
      />
      <div className="flex gap-4 text-xs font-medium text-slate-600 dark:text-slate-300">
        {data.map(item => (
          <div key={item.label} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }} />
            {item.label} ({Math.round((item.value / total) * 100)}%)
          </div>
        ))}
      </div>
    </div>
  );
};

export default function Dashboard() {
  const [socios, setSocios] = useState<Socio[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { perfil } = useAuth();
  
  const [permissions, setPermissions] = useState<any>({
    p1: true, p2: true, p3: true, p4: true, p5: true, p6: true
  });

  useEffect(() => {
    // Default Permissions
    const defaults: any = {
      admin: { p1: true, p2: true, p3: true, p4: true, p5: true, p6: true },
      operador: { p1: true, p2: true, p3: true, p4: true, p5: false, p6: false },
      visita: { p1: true, p2: false, p3: false, p4: true, p5: false, p6: false }
    };
    
    const loadPermissions = () => {
      const stored = localStorage.getItem('aacm_panel_permissions');
      const rol = perfil?.rol || 'visita';
      
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setPermissions(parsed[rol] || defaults[rol]);
        } catch (e) {
          setPermissions(defaults[rol]);
        }
      } else {
        setPermissions(defaults[rol]);
      }
    };

    loadPermissions();

    // Listen to storage events from other tabs
    window.addEventListener('storage', loadPermissions);
    
    // Also dispatch a custom event from Configuracion if needed, or simply re-read on mount.
    // We'll add a custom event listener just in case it's in the same window
    window.addEventListener('aacm_permissions_updated', loadPermissions);

    return () => {
      window.removeEventListener('storage', loadPermissions);
      window.removeEventListener('aacm_permissions_updated', loadPermissions);
    };
  }, [perfil]);

  useEffect(() => {
    async function loadData() {
      try {
        const [socs, pgs] = await Promise.all([
          ApiService.getSocios(),
          ApiService.getPagos()
        ]);
        setSocios(socs);
        setPagos(pgs);
      } catch (err: any) {
        setError(err.message || 'Error al cargar los datos.');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // --- 1. Socios al Día ---
  const sociosAlDiaCount = useMemo(() => {
    return socios.filter(s => isSocioAlDia(s)).length;
  }, [socios]);

  // --- 2. Recaudación Anual (2026) ---
  const recaudacionAnual = useMemo(() => {
    return pagos
      .filter(p => new Date(p.fecha_pago).getFullYear() === 2026)
      .reduce((acc, p) => acc + p.monto, 0);
  }, [pagos]);

  // --- 3. Estado de Pago Mensual ---
  const sociosActivosPendientesCount = useMemo(() => {
    const firstDayOfCurrentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    return socios.filter(s => {
      // 1. caracter = 'activo'
      if (s.caracter?.toLowerCase() !== 'activo') return false;
      
      // 2. NO debe tener un pago registrado cuyo fin_cobertura sea mayor o igual al mes actual
      if (!s.vencimiento_actividad) return true;
      
      const vencimiento = new Date(s.vencimiento_actividad + 'T12:00:00Z');
      return vencimiento < firstDayOfCurrentMonth;
    }).length;
  }, [socios]);

  const estadoDePagoMensual = useMemo(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

    // Numerador: Pagos realizados en el mes corriente
    const pagosMesActual = pagos.filter(p => {
      const pDate = new Date(p.fecha_pago);
      return pDate >= firstDay && pDate <= lastDay;
    });
    
    const pagados = pagosMesActual.length;
    // Denominador: Universo Esperado = Pagos + Pendientes
    const totalEsperado = pagados + sociosActivosPendientesCount;
    
    return {
      total: totalEsperado,
      pagados,
      pendientes: sociosActivosPendientesCount,
      porcentaje: totalEsperado > 0 ? Math.round((pagados / totalEsperado) * 100) : 0
    };
  }, [pagos, sociosActivosPendientesCount]);

  // --- 4. Proyección Mensual ---
  const proyeccionMensual = useMemo(() => {
    // Calculo: Total = (Socios_Activos_Pendientes * 7000)
    return sociosActivosPendientesCount * VALORES_CUOTA['Mensual'];
  }, [sociosActivosPendientesCount]);

  // --- 5. Mix de Planes ---
  const mixData = useMemo(() => {
    let mensual = 0, semestral = 0, anual = 0;
    pagos.forEach(p => {
      const type = p.plan?.toLowerCase();
      if (type === 'mensual') mensual += p.monto;
      if (type === 'semestral') semestral += p.monto;
      if (type === 'anual') anual += p.monto;
    });

    return [
      { label: 'Mensual', value: mensual, color: '#0ea5e9' }, // sky-500
      { label: 'Semestral', value: semestral, color: '#8b5cf6' }, // violet-500
      { label: 'Anual', value: anual, color: '#10b981' }, // emerald-500
    ];
  }, [pagos]);

  // --- 6. Morosidad Crítica ---
  const morosidadCritica = useMemo(() => {
    const today = new Date();
    const thresholdDate = new Date(today);
    thresholdDate.setDate(thresholdDate.getDate() - 60);

    return socios.filter(s => {
      if (s.caracter?.toLowerCase() !== 'activo') return false;

      const socioPagos = pagos.filter(p => p.id_socio === s.id_socio);
      const latestFinCobertura = socioPagos.length > 0
        ? socioPagos.reduce((max, p) => p.fin_cobertura && p.fin_cobertura > max ? p.fin_cobertura : max, socioPagos[0].fin_cobertura || '')
        : s.vencimiento_actividad;

      if (!latestFinCobertura) return true; // Activo pero nunca pagó? Crítico

      const finDate = new Date(latestFinCobertura + 'T12:00:00Z');
      return finDate < thresholdDate;
    });
  }, [socios, pagos]);


  if (error) {
    return <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium rounded-xl">{error}</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-glass border border-slate-100 dark:border-dark-700 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Reporte Institucional</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Informe financiero al {new Date().toLocaleDateString()}</p>
        </div>
        <div className="flex w-full sm:w-auto shadow-sm rounded-xl px-4 py-2 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-semibold items-center justify-center border border-primary-100 dark:border-primary-800/30 capitalize">
          <CalendarCheck className="w-5 h-5 mr-2" />
          {new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(new Date())}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Panel 1: Socios al Día */}
        {permissions.p1 && (
        <div className="premium-card relative overflow-hidden group w-full">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users className="w-24 h-24 text-primary-500" />
          </div>
          <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-slate-700 dark:text-slate-200">Socios al Día</h3>
          </div>
          {isLoading ? <div className="skeleton h-10 w-24 relative z-10"></div> : (
            <div className="relative z-10">
              <div className="text-4xl font-bold text-slate-900 dark:text-white">{sociosAlDiaCount}</div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Cobertura vigente hoy</p>
            </div>
          )}
        </div>
        )}

        {/* Panel 2: Recaudación Anual */}
        {permissions.p2 && (
        <div className="premium-card relative overflow-hidden group w-full">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <DollarSign className="w-24 h-24 text-primary-500" />
          </div>
          <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-slate-700 dark:text-slate-200">Recaudación 2026</h3>
          </div>
          {isLoading ? <div className="skeleton h-10 w-32 relative z-10"></div> : (
            <div className="relative z-10">
              <div className="text-4xl font-bold text-slate-900 dark:text-white">${recaudacionAnual.toLocaleString()}</div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Total ingresos del año</p>
            </div>
          )}
        </div>
        )}

        {/* Panel 3: Estado de Pago Mensual */}
        {permissions.p3 && (
        <div className="premium-card relative overflow-hidden group w-full">
          <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-xl">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-slate-700 dark:text-slate-200">Cobros Mes Actual</h3>
          </div>
          {isLoading ? <div className="skeleton h-16 w-full relative z-10"></div> : (
            <div className="relative z-10">
              <div className="flex justify-between items-end mb-2">
                <div className="text-3xl font-bold text-slate-900 dark:text-white">{estadoDePagoMensual.porcentaje}%</div>
                <div className="text-sm text-slate-500 font-medium">
                  {estadoDePagoMensual.pagados} / {estadoDePagoMensual.total} pagos
                </div>
              </div>
              <div className="w-full bg-slate-100 dark:bg-dark-700 rounded-full h-3 mb-1 overflow-hidden shadow-inner flex-shrink-0">
                <div 
                  className="bg-amber-500 h-3 rounded-full transition-all duration-1000 ease-out" 
                  style={{ width: `${estadoDePagoMensual.porcentaje}%` }}
                ></div>
              </div>
              <p className="text-xs text-slate-500 text-right">{estadoDePagoMensual.pendientes} pendientes</p>
            </div>
          )}
        </div>
        )}

        {/* Panel 4: Mix de Planes */}
        {permissions.p4 && (
        <div className="premium-card w-full col-span-1 md:col-span-2 lg:col-span-1 row-span-2 flex flex-col">
          <div className="flex items-center gap-4 mb-6 relative z-10">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-xl flex-shrink-0">
              <PieChart className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-slate-700 dark:text-slate-200">Mix de Planes</h3>
          </div>
          {isLoading ? <div className="skeleton h-48 w-full relative z-10"></div> : (
            <div className="flex-1 flex flex-col justify-center relative z-10">
              <SimplePieChart data={mixData} />
              <div className="mt-8 text-center px-4 py-3 bg-slate-50 dark:bg-dark-900/50 rounded-xl border border-slate-100 dark:border-dark-700/50 text-sm text-slate-600 dark:text-slate-400 font-medium">
                Distribución de ingresos generados por tipo de suscripción.
              </div>
            </div>
          )}
        </div>
        )}

        {/* Panel 5: Proyección Mensual */}
        {permissions.p5 && (
        <div className="premium-card relative overflow-hidden group w-full">
          <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl flex-shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-slate-700 dark:text-slate-200">Proyección Próx. Mes</h3>
          </div>
          {isLoading ? <div className="skeleton h-10 w-32 relative z-10"></div> : (
            <div className="relative z-10">
              <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400 break-words">${proyeccionMensual.toLocaleString()}</div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Ingresos garantizados est. plan Mensual</p>
            </div>
          )}
        </div>
        )}

        {/* Panel 6: Morosidad Crítica */}
        {permissions.p6 && (
        <div className="premium-card relative overflow-hidden group w-full">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <AlertTriangle className="w-24 h-24 text-red-500" />
          </div>
          <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className="p-3 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-slate-700 dark:text-slate-200">Morosidad (&gt;60d)</h3>
          </div>
          {isLoading ? <div className="skeleton h-10 w-24 relative z-10"></div> : (
            <div className="relative z-10">
              <div className="text-4xl font-bold text-red-600 dark:text-red-400">{morosidadCritica.length}</div>
              {morosidadCritica.length > 0 ? (
                <Link to="/socios?al_dia=no" className="text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 mt-2 inline-block transition-colors">
                  Ver en sección Socios &rarr;
                </Link>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Ningún socio crítico.</p>
              )}
            </div>
          )}
        </div>
        )}

      </div>
    </div>
  );
}
