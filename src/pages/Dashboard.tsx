import React, { useState, useEffect, useMemo } from 'react';
import { Users, DollarSign, CalendarCheck, TrendingUp, PieChart, AlertTriangle } from 'lucide-react';
import { ApiService, Socio, Pago, CURRENT_DATE_MOCK, VALORES_CUOTA, isSocioAlDia } from '../services/api';
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
      .filter(p => new Date(p.fecha_transaccion).getFullYear() === 2026)
      .reduce((acc, p) => acc + p.monto, 0);
  }, [pagos]);

  // --- 3. Estado de Pago Mensual ---
  // Users who paid the current month vs pending (among "Mensual" plan active users)
  const estadoDePagoMensual = useMemo(() => {
    const currentMonth = CURRENT_DATE_MOCK.getMonth();
    const currentYear = CURRENT_DATE_MOCK.getFullYear();
    
    // In DB we don't naturally have 'plan' guaranteed. We'll fallback to 'Mensual' for analysis or consider all
    const monthlySocios = socios.filter(s => (s.estado === 'Activo' || s.estado === 'Suspendido') && (s.plan === 'Mensual' || !s.plan));
    const totalMonthly = monthlySocios.length;

    // Check how many have a payment that covers the current month/year
    // Based on actual DB structure from tests wait, DB actually has inicio_cobertura and fin_cobertura in pagos
    // Let's rely strictly on the `fecha_transaccion` month for the monthly dashboard simplicity or `inicio_cobertura`
    const paidByMonthly = pagos.filter(p => p.tipo_pago?.toLowerCase() === 'mensual' && new Date(p.fecha_transaccion).getMonth() === currentMonth && new Date(p.fecha_transaccion).getFullYear() === currentYear);
    const uniquePaidIds = new Set(paidByMonthly.map(p => p.socio_id));
    
    const pagados = uniquePaidIds.size;
    const pendientes = totalMonthly - pagados;

    return { total: totalMonthly, pagados, pendientes, porcentaje: totalMonthly ? Math.round((pagados / totalMonthly) * 100) : 0 };
  }, [socios, pagos]);

  // --- 4. Proyección Mensual ---
  // Estimated next month revenue based on monthly socios + semiannual/annual that renew next month
  const proyeccionMensual = useMemo(() => {
    // Basic projection: assume all active monthly users renew next month
    const activeMonthly = socios.filter(s => s.estado === 'Activo' && (s.plan === 'Mensual' || !s.plan)).length;
    return activeMonthly * VALORES_CUOTA['Mensual'];
  }, [socios]);

  // --- 5. Mix de Planes ---
  const mixData = useMemo(() => {
    let mensual = 0, semestral = 0, anual = 0;
    pagos.forEach(p => {
      const type = p.tipo_pago?.toLowerCase();
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
    const thresholdDate = new Date(CURRENT_DATE_MOCK);
    thresholdDate.setDate(thresholdDate.getDate() - 60);

    return socios.filter(s => {
      if (s.estado !== 'Activo') return false;
      if (!s.vencimiento_actividad) return true; // Activo pero nunca pagó? Crítico
      const finDate = new Date(s.vencimiento_actividad);
      return finDate < thresholdDate;
    });
  }, [socios]);


  if (error) {
    return <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium rounded-xl">{error}</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-glass border border-slate-100 dark:border-dark-700 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Dashboard Institucional</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Resumen financiero al {CURRENT_DATE_MOCK.toLocaleDateString()}</p>
        </div>
        <div className="flex w-full sm:w-auto shadow-sm rounded-xl px-4 py-2 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-semibold items-center justify-center border border-primary-100 dark:border-primary-800/30">
          <CalendarCheck className="w-5 h-5 mr-2" />
          Marzo 2026
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Panel 1: Socios al Día */}
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

        {/* Panel 2: Recaudación Anual */}
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

        {/* Panel 3: Estado de Pago Mensual */}
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

        {/* Panel 4: Mix de Planes */}
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

        {/* Panel 5: Proyección Mensual */}
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

        {/* Panel 6: Morosidad Crítica */}
        <div className="premium-card flex flex-col border-red-100 dark:border-red-900/30 w-full overflow-hidden">
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-slate-700 dark:text-slate-200 truncate pr-2">Morosidad (&gt;60d)</h3>
            </div>
            {!isLoading && (
              <span className="px-3 py-1 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 font-bold rounded-full text-sm flex-shrink-0">
                {morosidadCritica.length}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto max-h-[160px] pr-2 custom-scrollbar relative z-10">
            {isLoading ? (
              <div className="space-y-2">
                <div className="skeleton h-12 w-full"></div>
                <div className="skeleton h-12 w-full"></div>
              </div>
            ) : morosidadCritica.length > 0 ? (
              <ul className="space-y-2">
                {morosidadCritica.map((s) => (
                  <li key={s.id_socio} className="flex flex-col sm:flex-row justify-between sm:items-center p-3 bg-slate-50 dark:bg-dark-900/50 rounded-xl border border-slate-100 dark:border-dark-700/50 hover:bg-slate-100 dark:hover:bg-dark-700 transition-colors gap-2">
                    <div className="truncate">
                      <div className="font-medium text-slate-800 dark:text-slate-200 text-sm truncate">{s.nombre} {s.apellido}</div>
                      <div className="text-xs text-slate-500">Plan: {s.plan || 'Mensual'}</div>
                    </div>
                    <div className="text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded w-fit sm:w-auto">
                      Venció: {s.vencimiento_actividad ? new Date(s.vencimiento_actividad).toLocaleDateString() : 'Nunca'}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                Ningún socio crítico.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
