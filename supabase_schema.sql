-- Tabla de Socios
CREATE TABLE public.socios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    dni TEXT UNIQUE NOT NULL,
    email TEXT,
    telefono TEXT,
    estado TEXT NOT NULL CHECK (estado IN ('Activo', 'Inactivo', 'Vitalicio', 'Suspendido', 'Baja')),
    plan TEXT NOT NULL CHECK (plan IN ('Mensual', 'Semestral', 'Anual')),
    inicio_cobertura DATE,
    fin_cobertura DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de Pagos
CREATE TABLE public.pagos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    socio_id UUID REFERENCES public.socios(id) ON DELETE CASCADE,
    monto INTEGER NOT NULL CHECK (monto IN (7000, 25000, 50000)),
    fecha_pago DATE NOT NULL,
    tipo_plan TEXT NOT NULL CHECK (tipo_plan IN ('Mensual', 'Semestral', 'Anual')),
    mes_cobertura INTEGER,
    anio_cobertura INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Opcional, pero recomendado)
ALTER TABLE public.socios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;

-- Políticas temporales para desarrollo (Permiten todo - Ajustar en producción)
CREATE POLICY "Permitir todo a todos los usuarios en socios" ON public.socios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a todos los usuarios en pagos" ON public.pagos FOR ALL USING (true) WITH CHECK (true);

-- Trigger para actualizar fin_cobertura al insertar un pago puede hacerse mediante API o Trigger.
-- En este sistema, lo manejaremos vía la API (Frontend / Supabase Client JS) para mantener la lógica de aplicación junta.
