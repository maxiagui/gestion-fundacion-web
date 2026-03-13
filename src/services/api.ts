import { supabase } from '../lib/supabase';
import { addMonths, endOfYear, startOfYear, parseISO, isWithinInterval, startOfMonth } from 'date-fns';

export type EstadoSocio = 'Activo' | 'Inactivo' | 'Vitalicio' | 'Suspendido' | 'Baja';
export type TipoPlan = 'Mensual' | 'Semestral' | 'Anual';

export interface Socio {
  id_socio: number;
  nombre: string;
  apellido: string;
  email: string | null;
  telefono: string | null;
  estado: EstadoSocio | string;
  fecha_ingreso: string;
  vencimiento_actividad: string | null;
  dni?: string; // Appears not to be in the single row fetch, keeping optional
  plan?: TipoPlan | string; // Computed or keeping as 'Mensual' by default since it isn't in DB fetch
}

export interface Pago {
  id_pago: number;
  socio_id: number;
  monto: number;
  tipo_pago: TipoPlan | string;
  fecha_transaccion: string;
  inicio_cobertura: string;
  fin_cobertura: string;
}

// Configurable constants
export const VALORES_CUOTA = {
  Mensual: 7000,
  Semestral: 25000,
  Anual: 50000,
};

export const CURRENT_DATE_MOCK = new Date('2026-03-12T00:00:00');

// --- CALCULATION LOGIC ---

/**
 * Calcula la nueva fecha de fin de cobertura basada en el plan y la fecha actual o de pago.
 */
export function calcularNuevaCobertura(
  tipoPlan: TipoPlan,
  fechaPagoStr: string,
  coberturaActualFinStr: string | null
): { inicio: Date; fin: Date } {
  const fechaPago = new Date(fechaPagoStr);
  const coberturaActualFin = coberturaActualFinStr ? new Date(coberturaActualFinStr) : null;
  
  // Base calculation starts from either today/fecha_pago or the end of the current coverage (if active)
  const isCurrentlyCovered = coberturaActualFin && coberturaActualFin > fechaPago;
  const baseDate = isCurrentlyCovered ? coberturaActualFin : fechaPago;

  if (tipoPlan === 'Mensual') {
    // 1 mes calendario desde la base
    const inicio = isCurrentlyCovered ? new Date(baseDate) : new Date(baseDate);
    return { inicio, fin: addMonths(inicio, 1) };
  } else if (tipoPlan === 'Semestral') {
    // 6 meses desde el primer día del mes de pago (o base)
    const inicio = startOfMonth(baseDate);
    return { inicio, fin: addMonths(inicio, 6) };
  } else { // Anual
    // Desde el 1 de Enero al 31 de Diciembre del año base
    const year = baseDate.getFullYear();
    const inicio = startOfYear(new Date(year, 0, 1));
    const fin = endOfYear(new Date(year, 0, 1));
    return { inicio, fin };
  }
}

/**
 * Determina si el socio está al día en una fecha específica
 */
export function isSocioAlDia(socio: Socio, targetDate: Date = CURRENT_DATE_MOCK): boolean {
  if (socio.estado === 'Vitalicio') return true;
  if (!socio.vencimiento_actividad) return false;
  
  const end = parseISO(socio.vencimiento_actividad);
  return targetDate <= end;
}

// --- SUPABASE API CALLS ---

export const ApiService = {
  async getSocios(): Promise<Socio[]> {
    const { data, error } = await supabase
      .from('socios')
      .select('*')
      .order('apellido', { ascending: true });
    
    if (error) throw error;
    return data as Socio[];
  },

  async createSocio(socioData: Omit<Socio, 'id' | 'created_at'>): Promise<Socio> {
    const { data, error } = await supabase
      .from('socios')
      .insert([socioData])
      .select()
      .single();
    
    if (error) throw error;
    return data as Socio;
  },

  async updateSocio(id_socio: number, updates: Partial<Socio>): Promise<Socio> {
    const { data, error } = await supabase
      .from('socios')
      .update(updates)
      .eq('id_socio', id_socio)
      .select()
      .single();
    
    if (error) throw error;
    return data as Socio;
  },

  async getPagos(): Promise<Pago[]> {
    const { data, error } = await supabase
      .from('pagos')
      .select('*')
      .order('fecha_transaccion', { ascending: false });
    
    if (error) throw error;
    return data as Pago[];
  },

  async getPagosBySocio(socioId: number): Promise<Pago[]> {
    const { data, error } = await supabase
      .from('pagos')
      .select('*')
      .eq('socio_id', socioId)
      .order('fecha_transaccion', { ascending: false });
    
    if (error) throw error;
    return data as Pago[];
  },

  async registerPago(socioId: number, tipoPlan: TipoPlan, fechaPago: string): Promise<Pago> {
    const { data: socio, error: fetchError } = await supabase
      .from('socios')
      .select('*')
      .eq('id_socio', socioId)
      .single();
    
    if (fetchError) throw fetchError;

    const { inicio, fin } = calcularNuevaCobertura(tipoPlan, fechaPago, socio.vencimiento_actividad);
    const monto = VALORES_CUOTA[tipoPlan];

    const pagoData = {
      socio_id: socioId,
      monto,
      tipo_pago: tipoPlan.toLowerCase(),
      fecha_transaccion: fechaPago + 'T12:00:00Z', 
      inicio_cobertura: inicio.toISOString().split('T')[0],
      fin_cobertura: fin.toISOString().split('T')[0]
    };

    const { data: newPago, error: insertError } = await supabase
      .from('pagos')
      .insert([pagoData])
      .select()
      .single();

    if (insertError) throw insertError;

    const updateData: any = {
      vencimiento_actividad: fin.toISOString().split('T')[0],
    };

    const { error: updateError } = await supabase
      .from('socios')
      .update(updateData)
      .eq('id_socio', socioId);

    if (updateError) throw updateError;

    return newPago as Pago;
  }
};
