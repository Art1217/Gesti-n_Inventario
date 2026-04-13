import { supabase } from '../lib/supabaseClient'

// ── AlmacenView + Transferencias ────────────────────────────────
// soloConStock: true → solo variantes con stock > 0 (para Transferencias)
//               false → todas las variantes (para AlmacenView)
export async function getStockAlmacen({ soloConStock = false } = {}) {
  let query = supabase
    .from('inventario_almacen')
    .select('*, producto_variantes!inner(*, productos!inner(*))')
    .eq('producto_variantes.productos.activo', true)
    .order('stock_fisico', { ascending: false })
  if (soloConStock) query = query.gt('stock_fisico', 0)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

// ── AdminFinanzas ────────────────────────────────────────────────
// Todos los productos activos con sus costos y precios aplanados
export async function getFinanzas() {
  const { data, error } = await supabase
    .from('productos')
    .select(`
      id, nombre,
      producto_variantes(
        id, sku, talla, color,
        inventario_almacen(costo_unitario),
        inventario_tienda(precio_venta, descuento_porcentaje)
      )
    `)
    .eq('activo', true)
    .order('nombre')
  if (error) throw error

  const filas = []
  ;(data ?? []).forEach(p => {
    ;(p.producto_variantes ?? []).forEach(v => {
      const alm = Array.isArray(v.inventario_almacen) ? v.inventario_almacen[0] : v.inventario_almacen
      const tda = Array.isArray(v.inventario_tienda) ? v.inventario_tienda[0] : v.inventario_tienda
      filas.push({
        id_variante: v.id,
        nombre: p.nombre,
        sku: v.sku,
        talla: v.talla,
        color: v.color,
        costo_unitario: alm?.costo_unitario ?? 0,
        precio_venta: tda?.precio_venta ?? 0,
        descuento_porcentaje: tda?.descuento_porcentaje ?? 0,
      })
    })
  })
  return filas
}

// Guarda costo y precio de una variante (update si existe, insert si no)
export async function actualizarCostoYPrecio(item) {
  const { data: existsAlm } = await supabase
    .from('inventario_almacen')
    .select('id_variante')
    .eq('id_variante', item.id_variante)
    .limit(1)

  if (existsAlm?.length > 0) {
    const { error } = await supabase
      .from('inventario_almacen')
      .update({ costo_unitario: item.costo_unitario })
      .eq('id_variante', item.id_variante)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('inventario_almacen')
      .insert({ id_variante: item.id_variante, costo_unitario: item.costo_unitario, stock_fisico: 0 })
    if (error) throw error
  }

  const { data: existsTda } = await supabase
    .from('inventario_tienda')
    .select('id_variante')
    .eq('id_variante', item.id_variante)
    .limit(1)

  if (existsTda?.length > 0) {
    const { error } = await supabase
      .from('inventario_tienda')
      .update({ precio_venta: item.precio_venta, descuento_porcentaje: item.descuento_porcentaje })
      .eq('id_variante', item.id_variante)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('inventario_tienda')
      .insert({ id_variante: item.id_variante, precio_venta: item.precio_venta, descuento_porcentaje: item.descuento_porcentaje, stock_exhibicion: 0 })
    if (error) throw error
  }
}

// ── AdminDashboard: stock crítico ───────────────────────────────
export async function getStockCriticoAlmacen() {
  const { data, error } = await supabase
    .from('inventario_almacen')
    .select('stock_fisico, producto_variantes(sku, talla, color, productos(nombre))')
    .lt('stock_fisico', 10)
    .order('stock_fisico', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getStockCriticoTienda() {
  const { data, error } = await supabase
    .from('inventario_tienda')
    .select('stock_exhibicion, producto_variantes(sku, talla, color, productos(nombre))')
    .lt('stock_exhibicion', 5)
    .order('stock_exhibicion', { ascending: true })
  if (error) throw error
  return data ?? []
}

// ── RPCs atómicas ────────────────────────────────────────────────
// Todas las operaciones que modifican stock + movimientos viven aquí

export async function procesarVenta(items, idUsuario, metodoPago) {
  const { data, error } = await supabase.rpc('procesar_venta', {
    p_items: items,
    p_id_usuario: idUsuario,
    p_metodo_pago: metodoPago,
  })
  if (error) throw new Error(error.message)
  if (!data?.ok) throw new Error(data?.error ?? 'Error al procesar la venta')
}

export async function procesarTransferencia(idVariante, cantidad, idUsuario) {
  const { data, error } = await supabase.rpc('procesar_transferencia', {
    p_id_variante: idVariante,
    p_cantidad: cantidad,
    p_id_usuario: idUsuario,
  })
  if (error) throw new Error(error.message)
  if (!data?.ok) throw new Error(data?.error ?? 'Error al transferir')
}

export async function procesarIngresoDirectoTienda(idVariante, cantidad, idUsuario) {
  const { data, error } = await supabase.rpc('procesar_ingreso_directo_tienda', {
    p_id_variante: idVariante,
    p_cantidad: cantidad,
    p_id_usuario: idUsuario,
  })
  if (error) throw new Error(error.message)
  if (!data?.ok) throw new Error(data?.error ?? 'Error al ingresar a tienda')
}

export async function procesarEntradaAlmacen(idVariante, cantidad, idUsuario) {
  const { data, error } = await supabase.rpc('procesar_entrada_almacen', {
    p_id_variante: idVariante,
    p_cantidad: cantidad,
    p_id_usuario: idUsuario,
  })
  if (error) throw new Error(error.message)
  if (!data?.ok) throw new Error(data?.error ?? 'Error al registrar el ingreso')
}
