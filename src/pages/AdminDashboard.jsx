import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import { getKpis, getVentasParaGraficos, getMovimientosPorFecha, getKpisCotOC, MOVIMIENTOS_PAGE_SIZE } from '../services/movimientos.service'
import { getStockCriticoAlmacen, getStockCriticoTienda } from '../services/inventario.service'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts'
import {
  TrendingUp, AlertTriangle, ShoppingBag, Warehouse,
  Store, Loader2, RefreshCw, Clock, ArrowRightLeft,
  PackagePlus, ShoppingCart, Printer, FileText, ClipboardList, Calendar
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
function KpiCard({ title, value, sub, icon: Icon, color, loading, alert, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-gray-900 border rounded-2xl p-5 flex flex-col gap-3 ${alert ? 'border-red-800/60' : 'border-gray-800'} ${onClick ? 'cursor-pointer hover:bg-gray-800/60 transition-colors' : ''}`}
    >
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

  const [cotOcKpi, setCotOcKpi] = useState({ cotMes: 0, montoMes: 0, ocActivas: 0, ocVencen: 0, proximas: [] })
  const [cotOcLoading, setCotOcLoading] = useState(true)

  const [pieData, setPieData] = useState([])
  const [barData, setBarData] = useState([])
  const [chartsLoading, setChartsLoading] = useState(true)

  const [movimientos, setMovimientos] = useState([])
  const [movLoading, setMovLoading] = useState(true)
  const [movCount, setMovCount] = useState(0)
  const [page, setPage] = useState(1)

  const [filtroFecha, setFiltroFecha] = useState(() => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 10)
  })
  const [filtroTipo, setFiltroTipo] = useState('')

  const totalPages = Math.max(1, Math.ceil(movCount / MOVIMIENTOS_PAGE_SIZE))

  // ── Modal stock crítico ──
  const [critModal, setCritModal] = useState(null) // 'almacen' | 'tienda' | null
  const [critItems, setCritItems] = useState([])
  const [critLoading, setCritLoading] = useState(false)

  const openCritModal = async (tipo) => {
    setCritModal(tipo)
    setCritItems([])
    setCritLoading(true)
    try {
      const data = tipo === 'almacen'
        ? await getStockCriticoAlmacen()
        : await getStockCriticoTienda()
      setCritItems(data)
    } catch (e) {
      console.error(e)
    } finally {
      setCritLoading(false)
    }
  }

  // ── Solo KPIs y Gráficos ──
  const fetchKpiAndCharts = useCallback(async () => {
    setKpiLoading(true)
    try {
      const kpiData = await getKpis()
      setKpi(kpiData)
    } catch (e) {
      console.error('Error cargando KPIs:', e)
    } finally { setKpiLoading(false) }

    setChartsLoading(true)
    try {
      const { pieData, barData } = await getVentasParaGraficos()
      setPieData(pieData)
      setBarData(barData)
    } catch (e) {
      console.error('Error cargando gráficos:', e)
    } finally { setChartsLoading(false) }

    setCotOcLoading(true)
    try {
      const cotOcData = await getKpisCotOC()
      setCotOcKpi(cotOcData)
    } catch (e) {
      console.error('Error cargando KPIs estratégicos:', e)
    } finally { setCotOcLoading(false) }
  }, [])

  // ── Solo Movimientos con Filtro ──
  const fetchMovimientos = useCallback(async (fecha, pg, tipo) => {
    setMovLoading(true)
    try {
      const { data, count } = await getMovimientosPorFecha(fecha, pg, tipo)
      setMovimientos(data)
      setMovCount(count)
    } catch (e) {
      console.error('Error cargando movimientos:', e)
    } finally {
      setMovLoading(false)
    }
  }, [])

  useEffect(() => { fetchKpiAndCharts() }, [fetchKpiAndCharts])
  useEffect(() => { fetchMovimientos(filtroFecha, page, filtroTipo) }, [filtroFecha, page, filtroTipo, fetchMovimientos])

  const handleRefresh = () => {
    fetchKpiAndCharts()
    fetchMovimientos(filtroFecha, page, filtroTipo)
  }

  const handleFechaChange = (e) => {
    setPage(1)
    setFiltroFecha(e.target.value)
  }

  const handleTipoChange = (e) => {
    setPage(1)
    setFiltroTipo(e.target.value)
  }

  const plazoInfo = (orden) => {
    if (!orden.fecha_entrega) return null
    const hoy = new Date(); hoy.setHours(0,0,0,0)
    const entrega = new Date(orden.fecha_entrega + 'T00:00:00')
    const dias = Math.round((entrega - hoy) / 86400000)
    if (dias < 0)  return { label: `Vencida (${Math.abs(dias)}d)`, cls: 'bg-red-500/15 text-red-400 border-red-500/30' }
    if (dias === 0) return { label: 'Vence hoy',                   cls: 'bg-red-500/15 text-red-400 border-red-500/30' }
    if (dias <= 3)  return { label: `${dias}d restantes`,          cls: 'bg-red-500/15 text-red-400 border-red-500/30' }
    if (dias <= 7)  return { label: `${dias}d restantes`,          cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' }
    return              { label: `${dias}d restantes`,             cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' }
  }

  const fmt = (n) => `S/ ${(n || 0).toFixed(2)}`
  const fmtDate = (iso) => {
    const d = new Date(iso)
    return d.toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <Layout>
      <style>{`
        @media print {
          aside { display: none !important; }
          .lg\\:hidden { display: none !important; }
          body, main { background: white !important; overflow: visible !important; height: auto !important; }
          .print\\:hidden { display: none !important; }
          .print\\:text-black { color: #000 !important; }
          .print\\:bg-white { background: #fff !important; color: #000 !important; }
          .print\\:border-none { border: none !important; }
          .print\\:table { width: 100% !important; border-collapse: collapse !important; }
          .print\\:th { border-bottom: 2px solid #ccc !important; color: #000 !important; }
          .print\\:td { border-bottom: 1px solid #eee !important; color: #000 !important; }
        }
      `}</style>
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 print:p-0 print:space-y-4">

        {/* ── Header ── */}
        <div className="flex items-center justify-between print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <TrendingUp className="w-7 h-7 text-indigo-400" />
              Dashboard Gerencial
            </h1>
            <p className="text-gray-500 text-sm mt-1">Resumen en tiempo real de tu operación</p>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl border border-gray-700 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 print:hidden">
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
            sub={kpi.critAlmacen > 0 ? 'Clic para ver cuáles' : 'Productos con menos de 10 unidades'}
            icon={Warehouse}
            color="bg-amber-500/15 text-amber-400"
            alert={kpi.critAlmacen > 0}
            loading={kpiLoading}
            onClick={kpi.critAlmacen > 0 ? () => openCritModal('almacen') : undefined}
          />
          <KpiCard
            title="Stock Crítico Tienda"
            value={kpi.critTienda}
            sub={kpi.critTienda > 0 ? 'Clic para ver cuáles' : 'Productos con menos de 5 en exhibición'}
            icon={Store}
            color="bg-red-500/15 text-red-400"
            alert={kpi.critTienda > 0}
            loading={kpiLoading}
            onClick={kpi.critTienda > 0 ? () => openCritModal('tienda') : undefined}
          />
        </div>

        {/* ── KPIs Estratégicos ── */}
        <div className="print:hidden">
          <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
            <ClipboardList className="w-4 h-4" /> Cotizaciones y Órdenes de Compra — Este mes
          </h2>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              title="Cotizaciones Emitidas"
              value={cotOcKpi.cotMes}
              sub="Cotizaciones generadas este mes"
              icon={FileText}
              color="bg-indigo-500/15 text-indigo-400"
              loading={cotOcLoading}
            />
            <KpiCard
              title="Monto Cotizado (S/)"
              value={fmt(cotOcKpi.montoMes)}
              sub="Total cotizado en el mes"
              icon={TrendingUp}
              color="bg-emerald-500/15 text-emerald-400"
              loading={cotOcLoading}
            />
            <KpiCard
              title="OC Activas"
              value={cotOcKpi.ocActivas}
              sub="Órdenes Pendiente o En Proceso"
              icon={ClipboardList}
              color="bg-amber-500/15 text-amber-400"
              loading={cotOcLoading}
            />
            <KpiCard
              title="OC Por Vencer ≤7 días"
              value={cotOcKpi.ocVencen}
              sub="Órdenes activas con plazo próximo"
              icon={AlertTriangle}
              color="bg-red-500/15 text-red-400"
              alert={cotOcKpi.ocVencen > 0}
              loading={cotOcLoading}
            />
          </div>
        </div>

        {/* ── Próximos Vencimientos OC ── */}
        {!cotOcLoading && cotOcKpi.proximas.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden print:hidden">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-500" />
              <h2 className="text-white font-semibold">Próximos Vencimientos de OC</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">N°</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente / Descripción</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Entrega</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plazo</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {cotOcKpi.proximas.map(oc => {
                    const plazo = plazoInfo(oc)
                    const cliente = oc.cotizaciones?.cliente_razon_social || oc.cliente_nombre || '—'
                    return (
                      <tr key={oc.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-5 py-3.5 text-indigo-400 font-mono text-xs">
                          OC-{String(oc.id).padStart(4, '0')}
                          {oc.id_cotizacion && <span className="text-gray-600 ml-1">· COT-{String(oc.id_cotizacion).padStart(4, '0')}</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${oc.tipo === 'Externa' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                            {oc.tipo}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-white max-w-[200px] truncate">{cliente}</td>
                        <td className="px-5 py-3.5 text-gray-400 text-xs font-mono whitespace-nowrap">
                          {oc.fecha_entrega ? new Date(oc.fecha_entrega + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          {plazo
                            ? <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${plazo.cls}`}>{plazo.label}</span>
                            : <span className="text-gray-600 text-xs">—</span>
                          }
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${oc.estado === 'Pendiente' ? 'bg-gray-700/50 text-gray-300 border-gray-600' : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'}`}>
                            {oc.estado}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Gráficos ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 print:hidden">

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
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden print:border-none print:bg-white print:rounded-none">
          <div className="px-6 py-5 border-b border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:border-b-2 print:border-black print:px-0">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-500 print:hidden" />
              <h2 className="text-white font-semibold print:text-black print:text-xl">Libro Diario de Control</h2>
            </div>

            <div className="flex items-center gap-3 print:hidden">
              <input
                type="date"
                value={filtroFecha}
                onChange={handleFechaChange}
                className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
              />
              <select
                value={filtroTipo}
                onChange={handleTipoChange}
                className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
              >
                <option value="">Todos los tipos</option>
                <option value="VENTA">Ventas</option>
                <option value="ENTRADA">Entradas</option>
                <option value="TRANSFERENCIA">Transferencias</option>
                <option value="AJUSTE">Ajustes</option>
              </select>
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors border border-indigo-500"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Imprimir Reporte</span>
                <span className="sm:hidden">Imprimir</span>
              </button>
            </div>
          </div>

          {movLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : movimientos.length === 0 ? (
            <div className="text-center py-16 text-gray-600 text-sm">No hay movimientos registrados aún.</div>
          ) : (
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left print:table">
                <thead className="sticky top-0 bg-gray-950/90 backdrop-blur-sm print:static print:bg-transparent">
                  <tr className="border-b border-gray-800 print:border-black">
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider print:th">Fecha / Hora</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider print:th">Tipo</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider print:th">Producto</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center print:th">Cant.</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center print:th">Usuario</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right print:th">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {movimientos.map(mov => {
                    const meta = TIPO_META[mov.tipo_movimiento] ?? { label: mov.tipo_movimiento, color: 'text-gray-400', bg: 'bg-gray-800 border-gray-700', icon: Clock }
                    const Icon = meta.icon
                    return (
                      <tr key={mov.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-6 py-3.5 text-gray-400 text-sm font-mono whitespace-nowrap print:td">
                          {fmtDate(mov.created_at)}
                        </td>
                        <td className="px-6 py-3.5 print:td">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${meta.bg} ${meta.color} print:border-none print:text-black print:p-0`}>
                            <Icon className="w-3 h-3 print:hidden" />
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 print:td">
                          <p className="text-white text-sm print:text-black">{mov.producto_variantes?.productos?.nombre ?? '—'}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-indigo-400 font-mono text-xs">{mov.producto_variantes?.sku}</span>
                            {(mov.producto_variantes?.talla || mov.producto_variantes?.color) && (
                              <span className="text-gray-500 text-[10px] uppercase">
                                {mov.producto_variantes.talla ? `T:${mov.producto_variantes.talla} ` : ''} 
                                {mov.producto_variantes.color ? `C:${mov.producto_variantes.color}` : ''}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-center text-gray-300 text-sm font-semibold print:td">{mov.cantidad}</td>
                        <td className="px-6 py-3.5 text-center text-gray-500 text-xs font-mono print:td" title={mov.usuario_email ?? mov.id_usuario}>
                          {mov.usuario_email
                            ? mov.usuario_email.split('@')[0]
                            : mov.id_usuario?.substring(0, 8) ?? '—'}
                        </td>
                        <td className="px-6 py-3.5 text-right print:td">
                          {mov.total_final
                            ? <span className="text-emerald-400 font-mono font-semibold text-sm print:text-black">{fmt(mov.total_final)}</span>
                            : <span className="text-gray-700 text-sm print:text-black">—</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginación */}
          {!movLoading && totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800 print:hidden">
              <p className="text-gray-500 text-sm">
                Página {page} de {totalPages} · {movCount} movimientos
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => p - 1)}
                  disabled={page === 1}
                  className="px-3 py-1.5 bg-gray-800 border border-gray-700 text-gray-400 hover:text-white rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 bg-gray-800 border border-gray-700 text-gray-400 hover:text-white rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal Stock Crítico ── */}
      {critModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="text-white font-semibold flex items-center gap-2">
                {critModal === 'almacen'
                  ? <><Warehouse className="w-5 h-5 text-amber-400" /> Stock Crítico — Almacén</>
                  : <><Store className="w-5 h-5 text-red-400" /> Stock Crítico — Tienda</>
                }
              </h2>
              <button onClick={() => setCritModal(null)} className="text-gray-500 hover:text-white transition-colors">
                <span className="text-xl leading-none">×</span>
              </button>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {critLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mr-2" />
                  <span className="text-gray-400 text-sm">Cargando...</span>
                </div>
              ) : critItems.length === 0 ? (
                <p className="text-center text-gray-500 py-10 text-sm">No hay items críticos.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="pb-3 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Producto</th>
                      <th className="pb-3 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">
                        {critModal === 'almacen' ? 'Stock' : 'Exhibición'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {critItems.map((item, i) => {
                      const stock = critModal === 'almacen' ? item.stock_fisico : item.stock_exhibicion
                      const stockColor = stock === 0 ? 'text-red-400' : 'text-amber-400'
                      return (
                        <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                          <td className="py-3 px-2">
                            <p className="text-white font-medium">{item.producto_variantes?.productos?.nombre}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-indigo-300 font-mono text-xs">{item.producto_variantes?.sku}</span>
                              {(item.producto_variantes?.talla || item.producto_variantes?.color) && (
                                <span className="text-gray-500 text-xs uppercase">
                                  {item.producto_variantes.talla ? `T:${item.producto_variantes.talla}` : ''}
                                  {item.producto_variantes.color ? ` C:${item.producto_variantes.color}` : ''}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <span className={`font-bold text-base font-mono ${stockColor}`}>{stock}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-800 text-right">
              <button
                onClick={() => setCritModal(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl text-sm transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
