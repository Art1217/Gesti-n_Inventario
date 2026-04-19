-- ================================================================
-- MÓDULO DE ÓRDENES DE COMPRA
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ================================================================

-- 1. Ampliar estados permitidos en cotizaciones para incluir 'Aceptada'
ALTER TABLE public.cotizaciones
  DROP CONSTRAINT IF EXISTS cotizaciones_estado_check;

ALTER TABLE public.cotizaciones
  ADD CONSTRAINT cotizaciones_estado_check
  CHECK (estado IN ('Borrador', 'Emitida', 'Aceptada'));

-- 2. Tabla de órdenes de compra
CREATE TABLE IF NOT EXISTS public.ordenes_compra (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo            text NOT NULL CHECK (tipo IN ('Externa', 'Interna')),

  -- Vínculo opcional a cotización
  id_cotizacion   bigint REFERENCES public.cotizaciones(id) ON DELETE SET NULL,

  -- Cliente (denormalizado — útil en OC Interna sin cotización)
  cliente_nombre  text,

  -- Archivo PDF del cliente (OC Externa)
  archivo_url     text,
  archivo_nombre  text,

  -- Descripción del pedido (OC Interna principalmente)
  descripcion     text,
  cantidad_total  int,

  -- Seguimiento de plazo
  fecha_emision   date NOT NULL DEFAULT CURRENT_DATE,
  fecha_entrega   date,
  fecha_entregada date,

  -- Estado y notas
  estado          text NOT NULL DEFAULT 'Pendiente'
                    CHECK (estado IN ('Pendiente', 'En Proceso', 'Entregada', 'Cancelada')),
  notas           text,

  id_usuario      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 3. RLS: solo ADMIN
ALTER TABLE public.ordenes_compra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ordenes_compra_admin" ON public.ordenes_compra;

CREATE POLICY "ordenes_compra_admin" ON public.ordenes_compra
  FOR ALL
  USING      (public.get_user_role() = 'ADMIN')
  WITH CHECK (public.get_user_role() = 'ADMIN');

-- 4. Bucket de Storage para archivos OC (ejecutar por separado si falla)
-- El bucket se crea en Dashboard → Storage → New bucket: "ordenes-compra" (privado)
-- Luego ejecutar estas políticas:

-- INSERT INTO storage.buckets (id, name, public) VALUES ('ordenes-compra', 'ordenes-compra', false)
-- ON CONFLICT (id) DO NOTHING;

-- DROP POLICY IF EXISTS "oc_admin_all" ON storage.objects;
-- CREATE POLICY "oc_admin_all" ON storage.objects
--   FOR ALL USING (
--     bucket_id = 'ordenes-compra'
--     AND public.get_user_role() = 'ADMIN'
--   );
