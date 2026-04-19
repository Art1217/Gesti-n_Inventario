import { supabase } from '../lib/supabaseClient'

const PAGE_SIZE = 20
const BUCKET    = 'ordenes-compra'

export async function getOrdenes({ filtro = 'todas', page = 1, search = '' } = {}) {
  const from = (page - 1) * PAGE_SIZE
  const to   = from + PAGE_SIZE - 1
  const hoy  = new Date().toISOString().split('T')[0]

  let q = supabase
    .from('ordenes_compra')
    .select('*, cotizaciones(cliente_razon_social, cliente_ruc)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filtro === 'pendientes') {
    q = q.in('estado', ['Pendiente', 'En Proceso'])
  } else if (filtro === 'vencidas') {
    q = q.lt('fecha_entrega', hoy).in('estado', ['Pendiente', 'En Proceso'])
  } else if (filtro === 'entregadas') {
    q = q.eq('estado', 'Entregada')
  }

  if (search.trim()) {
    q = q.ilike('cliente_nombre', `%${search.trim()}%`)
  }

  const { data, error, count } = await q
  if (error) throw error
  return { data, count, totalPages: Math.ceil((count ?? 0) / PAGE_SIZE) }
}

export async function getOrdenStats() {
  const hoy = new Date().toISOString().split('T')[0]

  const [{ count: activas }, { count: vencidas }, { count: entregadas }, { count: total }] =
    await Promise.all([
      supabase.from('ordenes_compra').select('id', { count: 'exact', head: true })
        .in('estado', ['Pendiente', 'En Proceso']),
      supabase.from('ordenes_compra').select('id', { count: 'exact', head: true })
        .lt('fecha_entrega', hoy).in('estado', ['Pendiente', 'En Proceso']),
      supabase.from('ordenes_compra').select('id', { count: 'exact', head: true })
        .eq('estado', 'Entregada'),
      supabase.from('ordenes_compra').select('id', { count: 'exact', head: true }),
    ])

  return { activas: activas ?? 0, vencidas: vencidas ?? 0, entregadas: entregadas ?? 0, total: total ?? 0 }
}

export async function crearOrden(payload) {
  const { data, error } = await supabase
    .from('ordenes_compra')
    .insert(payload)
    .select('id')
    .single()
  if (error) throw error
  return data
}

export async function actualizarOrden(id, updates) {
  const { error } = await supabase
    .from('ordenes_compra')
    .update(updates)
    .eq('id', id)
  if (error) throw error
}

// Sube un archivo al bucket y devuelve el path guardado
export async function subirArchivoOC(file, ordenId) {
  const ext  = file.name.split('.').pop()
  const path = `${ordenId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true })
  if (error) throw error
  return path
}

// Genera URL firmada de 1 hora para ver/descargar el archivo
export async function getUrlArchivoOC(path) {
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}
