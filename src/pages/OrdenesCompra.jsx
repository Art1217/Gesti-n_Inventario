import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import {
  getOrdenes, getOrdenStats, crearOrden, actualizarOrden,
  subirArchivoOC, getUrlArchivoOC,
} from '../services/ordenes.service'
import {
  ClipboardList, Plus, Loader2, AlertCircle, X, Upload, Search,
  CheckCircle2, Clock, AlertTriangle, ChevronLeft, ChevronRight,
  ExternalLink, PackageCheck, FileText,
} from 'lucide-react'

// ── Helpers ─────────────────────────────────────────────────────────────────

function plazoInfo(orden) {
  if (['Entregada', 'Cancelada'].includes(orden.estado)) {
    return null
  }
  if (!orden.fecha_entrega) return { label: 'Sin plazo', cls: 'bg-gray-500/10 text-gray-400' }

  const hoy     = new Date(); hoy.setHours(0, 0, 0, 0)
  const entrega = new Date(orden.fecha_entrega + 'T00:00:00')
  const dias    = Math.round((entrega - hoy) / 86400000)

  if (dias < 0)  return { label: `Vencida ${Math.abs(dias)}d`, cls: 'bg-red-500/10 text-red-400' }
  if (dias === 0) return { label: 'Vence hoy',                  cls: 'bg-red-500/10 text-red-400' }
  if (dias <= 7)  return { label: `${dias}d restantes`,         cls: 'bg-amber-500/10 text-amber-400' }
  return              { label: `${dias}d restantes`,            cls: 'bg-emerald-500/10 text-emerald-400' }
}

const ESTADO_COLORS = {
  Pendiente:   'bg-blue-500/10 text-blue-400',
  'En Proceso':'bg-amber-500/10 text-amber-400',
  Entregada:   'bg-emerald-500/10 text-emerald-400',
  Cancelada:   'bg-gray-500/10 text-gray-400',
}

const FILTROS = [
  { key: 'todas',      label: 'Todas' },
  { key: 'pendientes', label: 'Activas' },
  { key: 'vencidas',   label: 'Vencidas' },
  { key: 'entregadas', label: 'Entregadas' },
]

const ESTADOS_SIGUIENTE = {
  Pendiente:   'En Proceso',
  'En Proceso':'Entregada',
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function OrdenesCompra() {
  const { user } = useAuth()

  const [ordenes, setOrdenes]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [filtro, setFiltro]             = useState('todas')
  const [page, setPage]                 = useState(1)
  const [totalPages, setTotalPages]     = useState(1)
  const [stats, setStats]               = useState({ activas: 0, vencidas: 0, entregadas: 0, total: 0 })
  const [search, setSearch]             = useState('')

  const [error, setError]               = useState(null)
  const [success, setSuccess]           = useState(null)

  // Modales
  const [modalNueva, setModalNueva]     = useState(false)
  const [modalDetalle, setModalDetalle] = useState(null)

  // ── Carga de datos ──
  const cargar = useCallback(async (f, p, s) => {
    setLoading(true)
    try {
      const [res, st] = await Promise.all([
        getOrdenes({ filtro: f, page: p, search: s }),
        getOrdenStats(),
      ])
      setOrdenes(res.data)
      setTotalPages(res.totalPages)
      setStats(st)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar(filtro, page, search) }, [filtro, page, search, cargar])

  const handleFiltro = (f) => { setFiltro(f); setPage(1) }
  const handleSearch = (v) => { setSearch(v); setPage(1) }

  const refresh = () => cargar(filtro, page, search)

  // ── Avanzar estado desde la tabla ──
  const handleAvanzarEstado = async (orden) => {
    const siguiente = ESTADOS_SIGUIENTE[orden.estado]
    if (!siguiente) return
    try {
      const updates = { estado: siguiente }
      if (siguiente === 'Entregada') updates.fecha_entregada = new Date().toISOString().split('T')[0]
      await actualizarOrden(orden.id, updates)
      setSuccess(`Orden OC-${String(orden.id).padStart(4,'0')} marcada como "${siguiente}".`)
      setTimeout(() => setSuccess(null), 4000)
      refresh()
    } catch (e) { setError(e.message) }
  }

  // ── Abrir PDF ──
  const handleVerPDF = async (orden) => {
    if (!orden.archivo_url) return
    try {
      const url = await getUrlArchivoOC(orden.archivo_url)
      if (url) window.open(url, '_blank')
    } catch (e) { setError(e.message) }
  }

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-7 h-7 text-indigo-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Órdenes de Compra</h1>
              <p className="text-gray-500 text-sm">Gestión de OC externas e internas con seguimiento de plazo</p>
            </div>
          </div>
          <button
            onClick={() => setModalNueva(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva OC Interna
          </button>
        </div>

        {/* Alertas */}
        {error && (
          <div className="flex items-center gap-2 bg-red-950/50 border border-red-800 text-red-300 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 bg-emerald-950/50 border border-emerald-800 text-emerald-300 rounded-xl px-4 py-3 text-sm">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Activas',    value: stats.activas,    color: 'text-blue-400',    icon: Clock },
            { label: 'Vencidas',   value: stats.vencidas,   color: 'text-red-400',     icon: AlertTriangle },
            { label: 'Entregadas', value: stats.entregadas, color: 'text-emerald-400', icon: CheckCircle2 },
            { label: 'Total',      value: stats.total,      color: 'text-gray-300',    icon: ClipboardList },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">{label}</p>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Filtros + búsqueda */}
        <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
          {FILTROS.map(f => (
            <button
              key={f.key}
              onClick={() => handleFiltro(f.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filtro === f.key
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {f.label}
              {f.key === 'vencidas' && stats.vencidas > 0 && (
                <span className="ml-1.5 bg-red-500/20 text-red-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {stats.vencidas}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Buscar por cliente..."
            className="w-full sm:w-64 pl-8 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        </div>

        {/* Tabla */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            </div>
          ) : ordenes.length === 0 ? (
            <div className="text-center py-16 text-gray-600">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No hay órdenes en esta vista</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">N°</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente / Descripción</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plazo</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {ordenes.map(orden => {
                      const plazo    = plazoInfo(orden)
                      const cliente  = orden.cotizaciones?.cliente_razon_social ?? orden.cliente_nombre ?? '—'
                      const cotNum   = orden.id_cotizacion
                        ? `COT-${String(orden.id_cotizacion).padStart(4,'0')}`
                        : null
                      const siguiente = ESTADOS_SIGUIENTE[orden.estado]

                      return (
                        <tr key={orden.id} className="hover:bg-gray-800/30 transition-colors">
                          <td className="px-5 py-3">
                            <span className="text-indigo-400 font-mono font-bold text-xs">
                              OC-{String(orden.id).padStart(4,'0')}
                            </span>
                            {cotNum && (
                              <p className="text-gray-600 font-mono text-[10px]">{cotNum}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              orden.tipo === 'Externa'
                                ? 'bg-blue-500/10 text-blue-400'
                                : 'bg-amber-500/10 text-amber-400'
                            }`}>
                              {orden.tipo}
                            </span>
                          </td>
                          <td className="px-4 py-3 max-w-[220px]">
                            <p className="text-white text-xs font-medium truncate">{cliente}</p>
                            {orden.descripcion && (
                              <p className="text-gray-500 text-[10px] truncate">{orden.descripcion}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {plazo ? (
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${plazo.cls}`}>
                                {plazo.label}
                              </span>
                            ) : orden.fecha_entregada ? (
                              <span className="text-[10px] text-gray-500">
                                {new Date(orden.fecha_entregada + 'T00:00:00').toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' })}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${ESTADO_COLORS[orden.estado] ?? ''}`}>
                              {orden.estado}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {/* Ver detalle */}
                              <button
                                onClick={() => setModalDetalle(orden)}
                                title="Ver detalle"
                                className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded-lg transition-all"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                              {/* Ver PDF (solo Externa con archivo) */}
                              {orden.tipo === 'Externa' && orden.archivo_url && (
                                <button
                                  onClick={() => handleVerPDF(orden)}
                                  title="Ver PDF del cliente"
                                  className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {/* Avanzar estado */}
                              {siguiente && (
                                <button
                                  onClick={() => handleAvanzarEstado(orden)}
                                  title={`Marcar como ${siguiente}`}
                                  className="p-1.5 text-gray-500 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-all"
                                >
                                  <PackageCheck className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="px-5 py-3 border-t border-gray-800 flex items-center justify-between">
                  <span className="text-xs text-gray-500">Página {page} de {totalPages}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(p => p - 1)}
                      disabled={page === 1}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-all"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                    </button>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={page === totalPages}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-all"
                    >
                      Siguiente <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal Nueva OC Interna */}
      {modalNueva && (
        <ModalNuevaOCInterna
          userId={user?.id}
          onClose={() => setModalNueva(false)}
          onCreada={() => { setModalNueva(false); refresh() }}
          onError={setError}
        />
      )}

      {/* Modal Detalle */}
      {modalDetalle && (
        <ModalDetalleOrden
          orden={modalDetalle}
          onClose={() => setModalDetalle(null)}
          onActualizada={(updated) => {
            setModalDetalle(null)
            refresh()
            if (updated) {
              setSuccess(`Orden OC-${String(updated.id).padStart(4,'0')} actualizada.`)
              setTimeout(() => setSuccess(null), 4000)
            }
          }}
          onError={setError}
        />
      )}
    </Layout>
  )
}

// ── Modal: Nueva OC Interna ──────────────────────────────────────────────────

function ModalNuevaOCInterna({ userId, onClose, onCreada, onError }) {
  const [form, setForm]     = useState({ cliente_nombre: '', descripcion: '', cantidad_total: '', fecha_entrega: '', notas: '' })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.descripcion.trim()) return
    setSaving(true)
    try {
      await crearOrden({
        tipo:           'Interna',
        cliente_nombre: form.cliente_nombre.trim() || null,
        descripcion:    form.descripcion.trim(),
        cantidad_total: form.cantidad_total ? parseInt(form.cantidad_total) : null,
        fecha_entrega:  form.fecha_entrega || null,
        notas:          form.notas.trim() || null,
        id_usuario:     userId,
      })
      onCreada()
    } catch (err) {
      onError(err.message)
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Nueva Orden de Compra Interna" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Cliente / Empresa</label>
          <input
            type="text"
            value={form.cliente_nombre}
            onChange={e => set('cliente_nombre', e.target.value)}
            placeholder="Nombre del cliente (opcional)"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Descripción del pedido <span className="text-red-400">*</span></label>
          <textarea
            value={form.descripcion}
            onChange={e => set('descripcion', e.target.value)}
            placeholder="Ej: 100 pantalones cargo talla M, color negro"
            rows={3}
            required
            className={inputCls + ' resize-none'}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Cantidad total</label>
            <input
              type="number" min="1"
              value={form.cantidad_total}
              onChange={e => set('cantidad_total', e.target.value)}
              placeholder="Unidades"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Fecha de entrega</label>
            <input
              type="date"
              value={form.fecha_entrega}
              onChange={e => set('fecha_entrega', e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Notas</label>
          <textarea
            value={form.notas}
            onChange={e => set('notas', e.target.value)}
            placeholder="Observaciones adicionales"
            rows={2}
            className={inputCls + ' resize-none'}
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={saving || !form.descripcion.trim()}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl transition-colors flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? 'Creando...' : 'Crear Orden'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

// ── Modal: Detalle / Editar Orden ────────────────────────────────────────────

function ModalDetalleOrden({ orden, onClose, onActualizada, onError }) {
  const [estado, setEstado]             = useState(orden.estado)
  const [fechaEntregada, setFechaEntregada] = useState(orden.fecha_entregada ?? '')
  const [notas, setNotas]               = useState(orden.notas ?? '')
  const [archivo, setArchivo]           = useState(null)
  const [saving, setSaving]             = useState(false)
  const [loadingPDF, setLoadingPDF]     = useState(false)

  const cliente = orden.cotizaciones?.cliente_razon_social ?? orden.cliente_nombre ?? '—'
  const cotNum  = orden.id_cotizacion ? `COT-${String(orden.id_cotizacion).padStart(4,'0')}` : null
  const ocNum   = `OC-${String(orden.id).padStart(4,'0')}`

  const handleVerPDF = async () => {
    if (!orden.archivo_url) return
    setLoadingPDF(true)
    try {
      const url = await getUrlArchivoOC(orden.archivo_url)
      if (url) window.open(url, '_blank')
    } catch (e) { onError(e.message) }
    finally { setLoadingPDF(false) }
  }

  const handleGuardar = async () => {
    setSaving(true)
    try {
      const updates = { estado, notas: notas.trim() || null }

      if (estado === 'Entregada' && !orden.fecha_entregada) {
        updates.fecha_entregada = fechaEntregada || new Date().toISOString().split('T')[0]
      }

      // Subir nuevo archivo si se seleccionó uno
      if (archivo) {
        const path = await subirArchivoOC(archivo, orden.id)
        updates.archivo_url    = path
        updates.archivo_nombre = archivo.name
      }

      await actualizarOrden(orden.id, updates)
      onActualizada({ id: orden.id })
    } catch (err) {
      onError(err.message)
      setSaving(false)
    }
  }

  return (
    <ModalShell title={`${ocNum} — Detalle`} onClose={onClose}>
      <div className="space-y-4">

        {/* Info básica */}
        <div className="bg-gray-800/60 rounded-xl p-3 space-y-1.5 text-xs">
          <Row label="Tipo">
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${orden.tipo === 'Externa' ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'}`}>
              {orden.tipo}
            </span>
          </Row>
          <Row label="Cliente">{cliente}</Row>
          {cotNum    && <Row label="Cotización">{cotNum}</Row>}
          {orden.descripcion && <Row label="Descripción">{orden.descripcion}</Row>}
          {orden.cantidad_total && <Row label="Cantidad">{orden.cantidad_total} unidades</Row>}
          <Row label="Emisión">
            {new Date(orden.fecha_emision + 'T00:00:00').toLocaleDateString('es-PE')}
          </Row>
          {orden.fecha_entrega && (
            <Row label="Plazo entrega">
              {new Date(orden.fecha_entrega + 'T00:00:00').toLocaleDateString('es-PE')}
            </Row>
          )}
        </div>

        {/* Archivo PDF (OC Externa) */}
        {orden.tipo === 'Externa' && (
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Documento OC del cliente
            </label>
            {orden.archivo_url ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleVerPDF}
                  disabled={loadingPDF}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600/10 border border-blue-600/30 text-blue-400 hover:bg-blue-600/20 text-xs font-medium rounded-xl transition-all"
                >
                  {loadingPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                  {orden.archivo_nombre ?? 'Ver PDF'}
                </button>
                <span className="text-gray-600 text-[10px]">o reemplaza:</span>
              </div>
            ) : (
              <p className="text-gray-600 text-xs mb-2">Sin archivo subido aún.</p>
            )}
            <label className="mt-2 flex items-center gap-2 px-3 py-2 bg-gray-800 border border-dashed border-gray-700 rounded-xl cursor-pointer hover:border-indigo-500 transition-colors">
              <Upload className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-500">
                {archivo ? archivo.name : 'Subir / reemplazar PDF'}
              </span>
              <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden"
                onChange={e => setArchivo(e.target.files[0] ?? null)} />
            </label>
          </div>
        )}

        {/* Estado */}
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Estado</label>
          <select
            value={estado}
            onChange={e => setEstado(e.target.value)}
            className={inputCls}
          >
            {['Pendiente', 'En Proceso', 'Entregada', 'Cancelada'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Fecha entregada (si se marca Entregada) */}
        {estado === 'Entregada' && (
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Fecha de entrega real</label>
            <input
              type="date"
              value={fechaEntregada}
              onChange={e => setFechaEntregada(e.target.value)}
              className={inputCls}
            />
          </div>
        )}

        {/* Notas */}
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Notas</label>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            rows={2}
            className={inputCls + ' resize-none'}
            placeholder="Observaciones..."
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors">
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={saving}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl transition-colors flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

// ── Helpers de UI ────────────────────────────────────────────────────────────

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold text-sm">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-500 w-28 flex-shrink-0">{label}</span>
      <span className="text-gray-200">{children}</span>
    </div>
  )
}

const inputCls = 'w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500'
