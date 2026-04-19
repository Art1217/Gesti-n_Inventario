import { supabase } from '../lib/supabaseClient'

const PAGE_SIZE = 20

export async function getCotizaciones(page = 1, search = '') {
  const from = (page - 1) * PAGE_SIZE
  const to   = from + PAGE_SIZE - 1

  let q = supabase
    .from('cotizaciones')
    .select('id, cliente_ruc, cliente_razon_social, fecha, estado, total_final, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (search.trim()) {
    q = q.or(`cliente_razon_social.ilike.%${search.trim()}%,cliente_ruc.ilike.%${search.trim()}%`)
  }

  const { data, error, count } = await q
  if (error) throw error
  return { data, count, totalPages: Math.ceil((count ?? 0) / PAGE_SIZE) }
}

export async function getCotizacionConItems(id) {
  const { data: cot, error: cotErr } = await supabase
    .from('cotizaciones')
    .select('*')
    .eq('id', id)
    .single()
  if (cotErr) throw cotErr
  const { data: items, error: itemsErr } = await supabase
    .from('cotizacion_items')
    .select('*')
    .eq('id_cotizacion', id)
  if (itemsErr) throw itemsErr
  return { cot, items }
}

/**
 * Consulta el RUC en SUNAT vía la Edge Function.
 * Retorna { razonSocial, direccion, estado, condicion } o lanza error.
 */
export async function consultarRUC(ruc) {
  const { data, error } = await supabase.functions.invoke('consulta-ruc', {
    body: { ruc },
  })
  if (error) throw new Error(error.message ?? 'Error al conectar con la función.')
  if (!data?.ok) throw new Error(data?.error ?? 'Error desconocido en la consulta.')
  return {
    razonSocial: data.razon_social ?? '',
    direccion:   data.direccion   ?? '',
    estado:      data.estado      ?? '',
    condicion:   data.condicion   ?? '',
  }
}

/**
 * Guarda la cotización y sus ítems en Supabase.
 * Retorna el id de la cotización creada.
 */
export async function guardarCotizacion({ cliente, items, totales, idUsuario }) {
  const { data: cot, error: cotErr } = await supabase
    .from('cotizaciones')
    .insert({
      cliente_ruc:          cliente.ruc || null,
      cliente_razon_social: cliente.razonSocial,
      cliente_direccion:    cliente.direccion || null,
      subtotal:             totales.subtotal,
      igv:                  totales.igv,
      total_final:          totales.total,
      id_usuario:           idUsuario,
      estado:               'Emitida',
    })
    .select('id, created_at')
    .single()

  if (cotErr) throw cotErr

  const { error: itemsErr } = await supabase
    .from('cotizacion_items')
    .insert(
      items.map(item => ({
        id_cotizacion:   cot.id,
        id_variante:     item.id_variante,
        nombre_producto: item.nombre,
        sku:             item.sku,
        talla:           item.talla ?? null,
        color:           item.color ?? null,
        cantidad:        item.cantidad,
        precio_unitario: item.precio_unitario,
        subtotal:        parseFloat((item.precio_unitario * item.cantidad).toFixed(2)),
      }))
    )

  if (itemsErr) throw itemsErr

  return cot
}
