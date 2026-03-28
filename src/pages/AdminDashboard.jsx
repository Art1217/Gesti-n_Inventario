import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabaseClient'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts'
import {
  TrendingUp, AlertTriangle, ShoppingBag, Warehouse,
  Store, Loader2, RefreshCw, Clock, ArrowRightLeft,
  PackagePlus, ShoppingCart
} from 'lucide-react'

// ─── Colores ───────────────────────────────────────────────
const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#e11d48']

const TIPO_META = {
  VENTA:                { label: 'Venta',            color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25', icon: ShoppingCart },
  ENTRADA:              { label: 'Entrada Almacén',  color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/25',   icon: PackagePlus },
  TRANSFERENCIA:        { label: 'Transferencia',    color: 'text-indigo-400',  bg: 'bg-indigo-500/10 border-indigo-500/25', icon: ArrowRightLeft },
  INGRESO_DIRECTO_ADMIN:{ label: 'Ingreso Directo',  color: 'text-purple-400',  bg: 'bg-purple-500/10 border-purple-500/25', icon: PackagePlus },
}

// ─── Skeleton ──────────────────────────────────────────────
function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-gray-800 rounded-xl ${className}`} />
}

// ─── KPI Card ──────────────────────────────────────────────
function KpiCard({ title, value, sub, icon: Icon, color, loading, alert }) {
  return (
    <div className={`bg-gray-900 border rounded-2xl p-5 flex flex-col gap-3 ${alert ? 'border-red-800/60' : 'border-gray-800'}`}>
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm font-medium">{title}</p>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-4.5 h-4.5 w-5 h-5" />
        </div>
      </div>
      {loading
        ? <Skeleton className="h-9 w-3/4" />
        : <p className={`text-3xl font-bold ${alert ? 'text-red-400' : 'text-white'}`}>{value}</p>
      }
      <p className="text-xs text-gray-600">{sub}</p>
    </div>
  )
}

export default function AdminDashboard() {
  const [kpi, setKpi] = useState({ ventasHoy: 0, opHoy: 0, critAlmacen: 0, critTienda: 0 })
  const [kpiLoading, setKpiLoading] = useState(true)

  const [pieData, setPieData] = useState([])
  const [barData, setBarData] = useState([])
  const [chartsLoading, setChartsLoading] = useState(true)

  const [movimientos, setMovimientos] = useState([])
  const [movLoading, setMovLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    const hoyStart = new Date(); hoyStart.setHours(0,0,0,0)
    const hoyEnd   = new Date(); hoyEnd.setHours(23,59,59,999)

    // ── KPIs ──
    setKpiLoading(true)
    try {
      const [ventasRes, opHoyRes, critAlmRes, critTiendaRes] = await Promise.all([
        supabase
          .from('movimientos')
          .select('total_final')
          .eq('tipo_movimiento', 'VENTA')
          .gte('created_at', hoyStart.toISOString())
          .lte('created_at', hoyEnd.toISOString()),
        supabase
          .from('movimientos')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', hoyStart.toISOString())
          .lte('created_at', hoyEnd.toISOString()),
        supabase
          .from('inventario_almacen')
          .select('id_producto', { count: 'exact', head: true })
          .lt('stock_fisico', 10),
        supabase
          .from('inventario_tienda')
          .select('id_producto', { count: 'exact', head: true })
          .lt('stock_exhibicion', 5),
      ])

      const ventasHoy = (ventasRes.data ?? []).reduce((s, r) => s + (r.total_final || 0), 0)
      setKpi({
        ventasHoy,
        opHoy: opHoyRes.count ?? 0,
        critAlmacen: critAlmRes.count ?? 0,
        critTienda: critTiendaRes.count ?? 0,
      })
    } finally {
      setKpiLoading(false)
    }

    // ── Gráficos ──
    setChartsLoading(true)
    try {
      const { data: ventasMov } = await supabase
        .from('movimientos')
        .select('metodo_pago, total_final, cantidad, productos(nombre)')
        .eq('tipo_movimiento', 'VENTA')

      // Pie: agrupar por método de pago
      const pagoMap = {}
      ;(ventasMov ?? []).forEach(m => {
        const key = m.metodo_pago ?? 'Sin método'
        pagoMap[key] = (pagoMap[key] || 0) + (m.total_final || 0)
      })
      setPieData(Object.entries(pagoMap).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) })))

      // Bar: top 5 productos más vendidos
      const prodMap = {}
      ;(ventasMov ?? []).forEach(m => {
        const nombre = m.productos?.nombre ?? 'Desconocido'
        prodMap[nombre] = (prodMap[nombre] || 0) + (m.cantidad || 0)
      })
      const sorted = Object.entries(prodMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, vendidos]) => ({ name: name.length > 14 ? name.slice(0, 13) + '…' : name, vendidos }))
      setBarData(sorted)
    } finally {
      setChartsLoading(false)
    }

    // ── Movimientos recientes ──
    setMovLoading(true)
    try {
      const { data } = await supabase
        .from('movimientos')
        .select('*, productos(nombre, sku)')
        .order('created_at', { ascending: false })
        .limit(15)
      setMovimientos(data ?? [])
    } finally {
      setMovLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const fmt = (n) => `S/ ${(n || 0).toFixed(2)}`
  const fmtDate = (iso) => {
    const d = new Date(iso)
    return d.toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <TrendingUp className="w-7 h-7 text-indigo-400" />
              Dashboard Gerencial
            </h1>
            <p className="text-gray-500 text-sm mt-1">Resumen en tiempo real de tu operación</p>
          </div>
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl border border-gray-700 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            title="Ventas de Hoy (S/)"
            value={fmt(kpi.ventasHoy)}
            sub="Total cobrado en ventas POS hoy"
            icon={ShoppingBag}
            color="bg-emerald-500/15 text-emerald-400"
            loading={kpiLoading}
          />
          <KpiCard
            title="Operaciones Hoy"
            value={kpi.opHoy}
            sub="Movimientos registrados hoy"
            icon={TrendingUp}
            color="bg-indigo-500/15 text-indigo-400"
            loading={kpiLoading}
          />
          <KpiCard
            title="Stock Crítico Almacén"
            value={kpi.critAlmacen}
            sub="Productos con menos de 10 unidades"
            icon={Warehouse}
            color="bg-amber-500/15 text-amber-400"
            alert={kpi.critAlmacen > 0}
            loading={kpiLoading}
          />
          <KpiCard
            title="Stock Crítico Tienda"
            value={kpi.critTienda}
            sub="Productos con menos de 5 en exhibición"
            icon={Store}
            color="bg-red-500/15 text-red-400"
            alert={kpi.critTienda > 0}
            loading={kpiLoading}
          />
        </div>

        {/* ── Gráficos ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* Pie – ventas por método de pago */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-5">Ventas por Método de Pago</h2>
            {chartsLoading ? (
              <div className="flex items-center justify-center h-56">
                <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" />
              </div>
            ) : pieData.length === 0 ? (
              <div className="flex items-center justify-center h-56 text-gray-600 text-sm">
                Sin datos de ventas aún.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => [`S/ ${v.toFixed(2)}`, 'Total']}
                    contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '12px', color: '#fff' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Bar – top 5 productos */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-5">Top 5 Productos más Vendidos</h2>
            {chartsLoading ? (
              <div className="flex items-center justify-center h-56">
                <Loader2 className="w-7 h-7 text-emerald-500 animate-spin" />
              </div>
            ) : barData.length === 0 ? (
              <div className="flex items-center justify-center h-56 text-gray-600 text-sm">
                Sin datos de ventas aún.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={barData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v) => [v, 'Unidades']}
                    contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '12px', color: '#fff' }}
                    cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                  />
                  <Bar dataKey="vendidos" radius={[6, 6, 0, 0]}>
                    {barData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Últimos movimientos ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-800 flex items-center gap-3">
            <Clock className="w-5 h-5 text-gray-500" />
            <h2 className="text-white font-semibold">Últimos Movimientos</h2>
            <span className="ml-auto text-xs text-gray-600">Últimos 15 registros</span>
          </div>

          {movLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : movimientos.length === 0 ? (
            <div className="text-center py-16 text-gray-600 text-sm">No hay movimientos registrados aún.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-950/40">
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha / Hora</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Producto</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Cant.</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {movimientos.map(mov => {
                    const meta = TIPO_META[mov.tipo_movimiento] ?? { label: mov.tipo_movimiento, color: 'text-gray-400', bg: 'bg-gray-800 border-gray-700', icon: Clock }
                    const Icon = meta.icon
                    return (
                      <tr key={mov.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-6 py-3.5 text-gray-400 text-sm font-mono whitespace-nowrap">
                          {fmtDate(mov.created_at)}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${meta.bg} ${meta.color}`}>
                            <Icon className="w-3 h-3" />
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <p className="text-white text-sm">{mov.productos?.nombre ?? '—'}</p>
                          <p className="text-gray-600 font-mono text-xs">{mov.productos?.sku}</p>
                        </td>
                        <td className="px-6 py-3.5 text-center text-gray-300 text-sm font-semibold">{mov.cantidad}</td>
                        <td className="px-6 py-3.5 text-right">
                          {mov.total_final
                            ? <span className="text-emerald-400 font-mono font-semibold text-sm">{fmt(mov.total_final)}</span>
                            : <span className="text-gray-700 text-sm">—</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
