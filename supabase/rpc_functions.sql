-- ================================================================
-- FUNCIONES RPC ATÓMICAS — Sistema de Inventario
-- ================================================================
-- Ejecuta este archivo completo en el SQL Editor de Supabase:
--   Dashboard → SQL Editor → New query → pegar y ejecutar
-- ================================================================


-- ----------------------------------------------------------------
-- 1. procesar_venta
--    Procesa una venta del POS de forma atómica:
--    - Valida stock actualizado al momento del cobro
--    - Descuenta stock de inventario_tienda con bloqueo de fila (FOR UPDATE)
--    - Registra un movimiento VENTA por cada ítem
--    - Si CUALQUIER ítem falla, revierte TODO (transacción completa)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION procesar_venta(
  p_items       jsonb,   -- [{ id_variante, cantidad, subtotal, igv, total_final }]
  p_id_usuario  uuid,
  p_metodo_pago text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row         record;
  v_id_variante uuid;
  v_cantidad    int;
  v_stock       int;
BEGIN
  FOR v_row IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_id_variante := (v_row.value->>'id_variante')::uuid;
    v_cantidad    := (v_row.value->>'cantidad')::int;

    -- Bloquear fila: previene que otra transacción concurrente
    -- lea el mismo stock antes de que lo actualicemos
    SELECT stock_exhibicion INTO v_stock
    FROM inventario_tienda
    WHERE id_variante = v_id_variante
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Sin inventario en tienda para variante %', v_id_variante;
    END IF;

    -- Validar stock real al momento del cobro (no el del carrito)
    IF v_stock < v_cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente. Disponible: %, solicitado: %',
        v_stock, v_cantidad;
    END IF;

    -- Decremento atómico
    UPDATE inventario_tienda
    SET stock_exhibicion = stock_exhibicion - v_cantidad
    WHERE id_variante = v_id_variante;

    -- Movimiento en la misma transacción
    INSERT INTO movimientos (
      id_variante, id_usuario, tipo_movimiento,
      cantidad, metodo_pago, subtotal, igv, total_final
    ) VALUES (
      v_id_variante,
      p_id_usuario,
      'VENTA',
      v_cantidad,
      p_metodo_pago,
      (v_row.value->>'subtotal')::numeric,
      (v_row.value->>'igv')::numeric,
      (v_row.value->>'total_final')::numeric
    );
  END LOOP;

  RETURN jsonb_build_object('ok', true);

EXCEPTION WHEN OTHERS THEN
  -- Cualquier error hace rollback automático de toda la transacción
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;


-- ----------------------------------------------------------------
-- 2. procesar_transferencia
--    Transfiere stock de Almacén → Tienda de forma atómica:
--    - Valida y descuenta inventario_almacen
--    - Suma a inventario_tienda (crea el registro si no existe)
--    - Registra movimiento TRANSFERENCIA
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION procesar_transferencia(
  p_id_variante uuid,
  p_cantidad    int,
  p_id_usuario  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stock int;
BEGIN
  -- Bloquear fila del almacén
  SELECT stock_fisico INTO v_stock
  FROM inventario_almacen
  WHERE id_variante = p_id_variante
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Variante no encontrada en inventario de almacén';
  END IF;

  IF v_stock < p_cantidad THEN
    RAISE EXCEPTION 'Stock insuficiente en almacén. Disponible: %, solicitado: %',
      v_stock, p_cantidad;
  END IF;

  -- Descontar del almacén
  UPDATE inventario_almacen
  SET stock_fisico = stock_fisico - p_cantidad
  WHERE id_variante = p_id_variante;

  -- Sumar a tienda (crea el registro si no existe)
  INSERT INTO inventario_tienda (id_variante, stock_exhibicion, precio_venta, descuento_porcentaje)
  VALUES (p_id_variante, p_cantidad, 0, 0)
  ON CONFLICT (id_variante)
  DO UPDATE SET stock_exhibicion = inventario_tienda.stock_exhibicion + p_cantidad;

  -- Movimiento
  INSERT INTO movimientos (id_variante, id_usuario, tipo_movimiento, cantidad)
  VALUES (p_id_variante, p_id_usuario, 'TRANSFERENCIA', p_cantidad);

  RETURN jsonb_build_object('ok', true);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;


-- ----------------------------------------------------------------
-- 3. procesar_entrada_almacen
--    Registra ingreso de mercadería al almacén de forma atómica:
--    - Suma stock a inventario_almacen (crea si no existe)
--    - Registra movimiento ENTRADA
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION procesar_entrada_almacen(
  p_id_variante uuid,
  p_cantidad    int,
  p_id_usuario  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Upsert atómico: incrementa si existe, crea si no
  INSERT INTO inventario_almacen (id_variante, stock_fisico, costo_unitario)
  VALUES (p_id_variante, p_cantidad, 0)
  ON CONFLICT (id_variante)
  DO UPDATE SET stock_fisico = inventario_almacen.stock_fisico + p_cantidad;

  -- Movimiento
  INSERT INTO movimientos (id_variante, id_usuario, tipo_movimiento, cantidad, motivo_detalle)
  VALUES (p_id_variante, p_id_usuario, 'ENTRADA', p_cantidad, 'Ingreso manual por escáner/formulario');

  RETURN jsonb_build_object('ok', true);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;


-- ----------------------------------------------------------------
-- 4. procesar_ingreso_directo_tienda
--    Ingresa stock directamente a tienda sin pasar por almacén (Admin):
--    - Suma stock a inventario_tienda (crea si no existe)
--    - Registra movimiento INGRESO_DIRECTO_ADMIN
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION procesar_ingreso_directo_tienda(
  p_id_variante uuid,
  p_cantidad    int,
  p_id_usuario  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Upsert atómico
  INSERT INTO inventario_tienda (id_variante, stock_exhibicion, precio_venta, descuento_porcentaje)
  VALUES (p_id_variante, p_cantidad, 0, 0)
  ON CONFLICT (id_variante)
  DO UPDATE SET stock_exhibicion = inventario_tienda.stock_exhibicion + p_cantidad;

  -- Movimiento
  INSERT INTO movimientos (id_variante, id_usuario, tipo_movimiento, cantidad)
  VALUES (p_id_variante, p_id_usuario, 'INGRESO_DIRECTO_ADMIN', p_cantidad);

  RETURN jsonb_build_object('ok', true);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;
