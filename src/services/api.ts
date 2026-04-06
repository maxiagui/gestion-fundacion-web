import { supabase } from '../lib/supabase';
import { addMonths, endOfYear, startOfYear, parseISO, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';

export type CaracterSocio = 'activo' | 'inactivo' | 'suspendido' | 'vitalicio' | 'baja';
export type TipoPlan = 'Mensual' | 'Semestral' | 'Anual';

export interface Socio {
  id_socio: number;
  nombre: string;
  apellido: string;
  email: string | null;
  telefono: string | null;
  caracter: CaracterSocio | string;
  estado: string;
  fecha_nacimiento?: string;
  nacionalidad?: string;
  domicilio?: string;
  localidad?: string;
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
  medio_pago: 'efectivo' | 'virtual' | string;
  link_comprobante?: string | null;
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

  async createSocio(socioData: Omit<Socio, 'id_socio' | 'id' | 'created_at'>): Promise<Socio> {
    const { plan, ...dbDataRaw } = socioData as any;
    
    const dbData = {
      ...dbDataRaw,
      nombre: dbDataRaw.nombre?.toLowerCase(),
      apellido: dbDataRaw.apellido?.toLowerCase(),
      nacionalidad: dbDataRaw.nacionalidad?.toLowerCase(),
      domicilio: dbDataRaw.domicilio?.toLowerCase(),
      localidad: dbDataRaw.localidad?.toLowerCase(),
      estado: dbDataRaw.estado?.toLowerCase()
    };

    const { data: maxIdData } = await supabase
      .from('socios')
      .select('id_socio')
      .order('id_socio', { ascending: false })
      .limit(1);
    
    const nextId = maxIdData && maxIdData.length > 0 ? (maxIdData[0].id_socio + 1) : 1;
    dbData.id_socio = nextId;

    const { data, error } = await supabase
      .from('socios')
      .insert([dbData])
      .select()
      .single();
    
    if (error) throw error;
    return data as Socio;
  },

  async updateSocio(id_socio: number, updates: Partial<Socio>): Promise<Socio> {
    const { plan, ...dbDataRaw } = updates as any;
    
    const dbData = { ...dbDataRaw };
    if (dbData.nombre) dbData.nombre = dbData.nombre.toLowerCase();
    if (dbData.apellido) dbData.apellido = dbData.apellido.toLowerCase();
    if (dbData.nacionalidad) dbData.nacionalidad = dbData.nacionalidad.toLowerCase();
    if (dbData.domicilio) dbData.domicilio = dbData.domicilio.toLowerCase();
    if (dbData.localidad) dbData.localidad = dbData.localidad.toLowerCase();
    if (dbData.estado) dbData.estado = dbData.estado.toLowerCase();

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

  async registerPago(socioId: number, tipoPlan: TipoPlan, _fechaPago: string, medioPago: string = 'efectivo', linkComprobante: string | null = null): Promise<Pago> {
    // 1. Obtener la fecha de fin_cobertura más lejana en el año 2026
    const { data: pagos, error: pagosError } = await supabase
      .from('pagos')
      .select('fin_cobertura')
      .eq('id_socio', socioId)
      .gte('fin_cobertura', '2026-01-01')
      .lte('fin_cobertura', '2026-12-31')
      .order('fin_cobertura', { ascending: false })
      .limit(1);

    if (pagosError) throw pagosError;

    let mesesSuma = 0;
    if (tipoPlan === 'Mensual') mesesSuma = 1;
    else if (tipoPlan === 'Semestral') mesesSuma = 6;
    else if (tipoPlan === 'Anual') mesesSuma = 12;

    let finCoberturaStr = '';

    if (tipoPlan === 'Anual') {
      finCoberturaStr = '2026-12-31';
    } else {
      if (pagos && pagos.length > 0) {
        // Ya tiene pagos, sumar a la fecha existente
        const baseFecha = parseISO(pagos[0].fin_cobertura);
        const nuevaFecha = endOfMonth(addMonths(baseFecha, mesesSuma));
        const yyyy = nuevaFecha.getFullYear();
        const mm = String(nuevaFecha.getMonth() + 1).padStart(2, '0');
        const dd = String(nuevaFecha.getDate()).padStart(2, '0');
        finCoberturaStr = `${yyyy}-${mm}-${dd}`;
      } else {
        // No tiene pagos previos en 2026
        // Inicia el conteo desde el 1 de enero
        const baseFecha = parseISO('2026-01-01');
        const nuevaFecha = endOfMonth(addMonths(baseFecha, mesesSuma - 1));
        const yyyy = nuevaFecha.getFullYear();
        const mm = String(nuevaFecha.getMonth() + 1).padStart(2, '0');
        const dd = String(nuevaFecha.getDate()).padStart(2, '0');
        finCoberturaStr = `${yyyy}-${mm}-${dd}`;
      }
    }

    const inicioCoberturaStr = '2026-01-01';
    
    // fecha_pago como el momento exacto de la transacción
    const fechaPagoExacta = new Date().toISOString();
    const monto = VALORES_CUOTA[tipoPlan];

    const { data: maxPagoData, error: maxPagoErr } = await supabase
      .from('pagos')
      .select('id_pago')
      .order('id_pago', { ascending: false })
      .limit(1);

    if (maxPagoErr) throw maxPagoErr;
    const nextIdPago = maxPagoData && maxPagoData.length > 0 ? (maxPagoData[0].id_pago + 1) : 1;

    const pagoData = {
      id_pago: nextIdPago,
      id_socio: socioId,
      monto,
      plan: tipoPlan.toLowerCase(),
      medio_pago: medioPago,
      link_comprobante: linkComprobante,
      fecha_pago: fechaPagoExacta,
      inicio_cobertura: inicioCoberturaStr,
      fin_cobertura: finCoberturaStr
    };

    const { data: newPago, error: insertError } = await supabase
      .from('pagos')
      .insert([pagoData])
      .select()
      .single();

    if (insertError) throw insertError;

    const { error: updateError } = await supabase
      .from('socios')
      .update({ vencimiento_actividad: finCoberturaStr })
      .eq('id_socio', socioId);

    if (updateError) throw updateError;

    return newPago as Pago;
  },

  async updatePago(idPago: number, data: Partial<Pago>): Promise<Pago> {
    const { data: updatedPago, error } = await supabase
      .from('pagos')
      .update(data)
      .eq('id_pago', idPago)
      .select()
      .single();

    if (error) throw error;
    return updatedPago as Pago;
  },

  async deletePago(id_pago: number): Promise<void> {
    const { data: pago, error: fetchError } = await supabase
      .from('pagos')
      .select('id_socio')
      .eq('id_pago', id_pago)
      .single();
    
    if (fetchError) throw fetchError;

    const { error: deleteError } = await supabase
      .from('pagos')
      .delete()
      .eq('id_pago', id_pago);
      
    if (deleteError) throw deleteError;

    const { data: pagos, error: pagosError } = await supabase
      .from('pagos')
      .select('fin_cobertura')
      .eq('id_socio', pago.id_socio)
      .order('fin_cobertura', { ascending: false });

    if (pagosError) throw pagosError;

    const nuevoVencimiento = pagos.length > 0 ? (pagos[0] as any).fin_cobertura : null;

    const { error: updateError } = await supabase
      .from('socios')
      .update({ vencimiento_actividad: nuevoVencimiento })
      .eq('id_socio', pago.id_socio);

    if (updateError) throw updateError;
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
