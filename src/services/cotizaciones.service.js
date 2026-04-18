import { supabase } from '../lib/supabaseClient'

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
