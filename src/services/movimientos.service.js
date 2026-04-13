import { supabase } from '../lib/supabaseClient'

// ── AdminDashboard ───────────────────────────────────────────────

// KPIs del día: ventas, operaciones y conteos de stock crítico
export async function getKpis() {
  const hoyStart = new Date(); hoyStart.setHours(0, 0, 0, 0)
  const hoyEnd   = new Date(); hoyEnd.setHours(23, 59, 59, 999)

  const [ventasRes, opHoyRes, critAlmRes, critTdaRes] = await Promise.all([
    supabase.from('movimientos').select('total_final')
      .eq('tipo_movimiento', 'VENTA')
      .gte('created_at', hoyStart.toISOString())
      .lte('created_at', hoyEnd.toISOString()),
    supabase.from('movimientos').select('id', { count: 'exact', head: true })
      .gte('created_at', hoyStart.toISOString())
      .lte('created_at', hoyEnd.toISOString()),
    supabase.from('inventario_almacen').select('id_variante', { count: 'exact', head: true })
      .lt('stock_fisico', 10),
    supabase.from('inventario_tienda').select('id_variante', { count: 'exact', head: true })
      .lt('stock_exhibicion', 5),
  ])

  if (ventasRes.error) throw ventasRes.error
  if (opHoyRes.error)  throw opHoyRes.error
  if (critAlmRes.error) throw critAlmRes.error
  if (critTdaRes.error) throw critTdaRes.error

  const ventasHoy = (ventasRes.data ?? []).reduce((s, r) => s + (r.total_final ?? 0), 0)
  return {
    ventasHoy,
    opHoy: opHoyRes.count ?? 0,
    critAlmacen: critAlmRes.count ?? 0,
    critTienda: critTdaRes.count ?? 0,
  }
}

// Datos para los gráficos: pie (por método de pago) y bar (top 5 productos)
export async function getVentasParaGraficos() {
  const { data, error } = await supabase
    .from('movimientos')
    .select('metodo_pago, total_final, cantidad, producto_variantes(productos(nombre))')
    .eq('tipo_movimiento', 'VENTA')
  if (error) throw error

  const movs = data ?? []

  const pagoMap = {}
  movs.forEach(m => {
    const key = m.metodo_pago ?? 'Sin método'
    pagoMap[key] = (pagoMap[key] ?? 0) + (m.total_final ?? 0)
  })
  const pieData = Object.entries(pagoMap).map(([name, value]) => ({
    name,
    value: parseFloat(value.toFixed(2)),
  }))

  const prodMap = {}
  movs.forEach(m => {
    const nombre = m.producto_variantes?.productos?.nombre ?? 'Desconocido'
    prodMap[nombre] = (prodMap[nombre] ?? 0) + (m.cantidad ?? 0)
  })
  const barData = Object.entries(prodMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, vendidos]) => ({
      name: name.length > 14 ? name.slice(0, 13) + '…' : name,
      vendidos,
    }))

  return { pieData, barData }
}

const PAGE_SIZE = 20

// Movimientos de un día específico con paginación y email de usuario
// Retorna: { data: [...], count: number }
export async function getMovimientosPorFecha(fecha, page = 1) {
  const [y, m, d] = fecha.split('-')
  const start = new Date(y, m - 1, d, 0, 0, 0)
  const end   = new Date(y, m - 1, d, 23, 59, 59, 999)
  const from  = (page - 1) * PAGE_SIZE
  const to    = from + PAGE_SIZE - 1

  const { data, error, count } = await supabase
    .from('movimientos')
    .select('*, producto_variantes(sku, talla, color, productos(nombre))', { count: 'exact' })
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('created_at', { ascending: false })
    .range(from, to)
  if (error) throw error

  const rows = data ?? []

  // Enriquecer con email del usuario (una sola query extra por página)
  const userIds = [...new Set(rows.map(r => r.id_usuario).filter(Boolean))]
  let profileMap = {}
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', userIds)
    ;(profiles ?? []).forEach(p => { profileMap[p.id] = p.email })
  }

  return {
    data:  rows.map(r => ({ ...r, usuario_email: profileMap[r.id_usuario] ?? null })),
    count: count ?? 0,
  }
}

export { PAGE_SIZE as MOVIMIENTOS_PAGE_SIZE }
