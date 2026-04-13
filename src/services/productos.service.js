import { supabase } from '../lib/supabaseClient'

// ── TiendaPOS ────────────────────────────────────────────────────
// Busca por SKU primero; si no hay resultados, busca por nombre de producto
export async function buscarVariantesPOS(texto) {
  if (!texto.trim()) return []

  const selectQuery = `
    id, sku, talla, color,
    productos!inner(nombre, categoria),
    inventario_tienda!inner(stock_exhibicion, precio_final)
  `
  const filtroActivo = { 'productos.activo': true }

  let { data, error } = await supabase
    .from('producto_variantes')
    .select(selectQuery)
    .eq('productos.activo', true)
    .ilike('sku', `%${texto}%`)
  if (error) throw error

  if (!data || data.length === 0) {
    const res = await supabase
      .from('producto_variantes')
      .select(selectQuery)
      .eq('productos.activo', true)
      .ilike('productos.nombre', `%${texto}%`)
    if (res.error) throw res.error
    data = res.data
  }

  return (data ?? []).map(v => {
    const tienda = Array.isArray(v.inventario_tienda) ? v.inventario_tienda[0] : v.inventario_tienda
    return {
      id_variante: v.id,
      sku: v.sku,
      talla: v.talla,
      color: v.color,
      productos: v.productos,
      stock_exhibicion: tienda?.stock_exhibicion ?? 0,
      precio_final: tienda?.precio_final ?? 0,
    }
  })
}

// ── AlmacenView ──────────────────────────────────────────────────
// Busca una variante activa por SKU exacto
export async function buscarVariantePorSKU(sku) {
  const { data, error } = await supabase
    .from('producto_variantes')
    .select('*, productos!inner(nombre, activo)')
    .eq('sku', sku)
    .eq('productos.activo', true)
    .limit(1)
  if (error) throw error
  return data?.[0] ?? null
}

// ── Transferencias (admin dropdown) ─────────────────────────────
// Todas las variantes de productos activos
export async function getVariantesActivas() {
  const { data, error } = await supabase
    .from('producto_variantes')
    .select('*, productos!inner(nombre, activo)')
    .eq('productos.activo', true)
    .order('sku')
  if (error) throw error
  return data ?? []
}

// ── Catálogo ─────────────────────────────────────────────────────
// Productos con variantes; opcionalmente incluye inactivos
export async function getProductosConVariantes(incluirInactivos = false) {
  let query = supabase
    .from('productos')
    .select('*, proveedores(nombre), producto_variantes(*)')
    .order('nombre')
  if (!incluirInactivos) query = query.eq('activo', true)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function crearProducto(payload) {
  const { data, error } = await supabase
    .from('productos')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function actualizarProducto(id, payload) {
  const { error } = await supabase.from('productos').update(payload).eq('id', id)
  if (error) throw error
}

export async function toggleProductoActivo(id, activo) {
  const { error } = await supabase.from('productos').update({ activo: !activo }).eq('id', id)
  if (error) throw error
}

export async function upsertVariantes(variantes) {
  const { error } = await supabase.from('producto_variantes').upsert(variantes)
  if (error) throw error
}
