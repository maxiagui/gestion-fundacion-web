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

export interface Perfil {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  rol: 'admin' | 'operador' | 'visita';
  email: string | null;
}

export interface Pago {
  id_pago: number;
  id_socio: number;
  monto: number;
  plan: TipoPlan | string;
  fecha_pago: string;
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
  // Parse without timezone issues by grabbing the year directly from the string YYYY-MM-DD
  const paymentYear = parseInt(fechaPagoStr.split('-')[0], 10);
  const coberturaActualFin = coberturaActualFinStr ? new Date(coberturaActualFinStr + 'T12:00:00Z') : null;
  
  let baseDate: Date;
  
  if (coberturaActualFin) {
    if (coberturaActualFin.getUTCFullYear() < paymentYear) {
      // Si el año de su última cobertura es anterior al año de pago, empezamos a cobrarle desde Enero de este año
      baseDate = new Date(`${paymentYear}-01-01T12:00:00Z`);
    } else {
      // Su cobertura actual cubre parte o todo este año (o años futuros), entonces continuamos desde ahí
      baseDate = coberturaActualFin;
    }
  } else {
    // Si nunca pagó o no tiene cobertura previa, empezamos desde Enero del año actual (1 de Enero)
    baseDate = new Date(`${paymentYear}-01-01T12:00:00Z`);
  }

  if (tipoPlan === 'Mensual') {
    return { inicio: baseDate, fin: addMonths(baseDate, 1) };
  } else if (tipoPlan === 'Semestral') {
    return { inicio: baseDate, fin: addMonths(baseDate, 6) };
  } else { // Anual
    return { inicio: baseDate, fin: addMonths(baseDate, 12) };
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
    const { plan, ...dbData } = socioData as any;
    const { data, error } = await supabase
      .from('socios')
      .insert([dbData])
      .select()
      .single();
    
    if (error) throw error;
    return data as Socio;
  },

  async updateSocio(id_socio: number, updates: Partial<Socio>): Promise<Socio> {
    const { plan, ...dbData } = updates as any;
    const { data, error } = await supabase
      .from('socios')
      .update(dbData)
      .eq('id_socio', id_socio)
      .select()
      .single();
    
    if (error) throw error;
    return data as Socio;
  },

  async deleteSocio(id_socio: number): Promise<void> {
    const { error } = await supabase
      .from('socios')
      .delete()
      .eq('id_socio', id_socio);
    
    if (error) throw error;
  },

  async getPagos(): Promise<Pago[]> {
    const { data, error } = await supabase
      .from('pagos')
      .select('*')
      .order('fecha_pago', { ascending: false });
    
    if (error) throw error;
    return data as Pago[];
  },

  async getPagosBySocio(socioId: number): Promise<Pago[]> {
    const { data, error } = await supabase
      .from('pagos')
      .select('*')
      .eq('id_socio', socioId)
      .order('fecha_pago', { ascending: false });
    
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
      id_socio: socioId,
      monto,
      plan: tipoPlan,
      fecha_pago: fechaPago + 'T12:00:00Z', 
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
  },

  async deletePago(id_pago: number): Promise<void> {
    const { error } = await supabase
      .from('pagos')
      .delete()
      .eq('id_pago', id_pago);
    if (error) throw error;
  },

  async getPerfiles(): Promise<Perfil[]> {
    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .order('full_name', { ascending: true });
    if (error) throw error;
    return data as Perfil[];
  },

  async updatePerfilRol(id: string, rol: 'admin' | 'operador' | 'visita'): Promise<void> {
    const { error } = await supabase
      .from('perfiles')
      .update({ rol })
      .eq('id', id);
    if (error) throw error;
  },

  async deletePerfil(id: string): Promise<void> {
    const { error } = await supabase
      .from('perfiles')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};
