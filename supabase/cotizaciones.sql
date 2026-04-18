-- ================================================================
-- MÓDULO DE COTIZACIONES — Tablas y RLS
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ================================================================

-- 1. Tabla principal de cotizaciones
CREATE TABLE IF NOT EXISTS public.cotizaciones (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cliente_ruc           text,
  cliente_razon_social  text NOT NULL,
  cliente_direccion     text,
  fecha                 date NOT NULL DEFAULT CURRENT_DATE,
  estado                text NOT NULL DEFAULT 'Borrador'
                          CHECK (estado IN ('Borrador', 'Emitida')),
  subtotal              numeric(10,2) NOT NULL DEFAULT 0,
  igv                   numeric(10,2) NOT NULL DEFAULT 0,
  total_final           numeric(10,2) NOT NULL DEFAULT 0,
  id_usuario            uuid REFERENCES auth.users(id),
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- 2. Tabla de ítems por cotización (snapshot de producto al momento de cotizar)
CREATE TABLE IF NOT EXISTS public.cotizacion_items (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cotizacion    bigint NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  id_variante      uuid REFERENCES public.producto_variantes(id),
  nombre_producto  text NOT NULL,
  sku              text,
  talla            text,
  color            text,
  cantidad         int NOT NULL DEFAULT 1,
  precio_unitario  numeric(10,2) NOT NULL,
  subtotal         numeric(10,2) NOT NULL
);

-- 3. RLS: solo ADMIN tiene acceso completo
ALTER TABLE public.cotizaciones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizacion_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cotizaciones_admin"      ON public.cotizaciones;
DROP POLICY IF EXISTS "cotizacion_items_admin"  ON public.cotizacion_items;

CREATE POLICY "cotizaciones_admin" ON public.cotizaciones
  FOR ALL
  USING      (public.get_user_role() = 'ADMIN')
  WITH CHECK (public.get_user_role() = 'ADMIN');

CREATE POLICY "cotizacion_items_admin" ON public.cotizacion_items
  FOR ALL
  USING      (public.get_user_role() = 'ADMIN')
  WITH CHECK (public.get_user_role() = 'ADMIN');
