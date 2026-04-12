import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import {
  ArrowRightLeft, PackagePlus, X, Loader2, AlertCircle,
  CheckCircle, Warehouse, Store, Zap
} from 'lucide-react'

function Modal({ title, icon: Icon, iconColor = 'text-indigo-400', onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Icon className={`w-5 h-5 ${iconColor}`} />
            {title}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

export default function Transferencias() {
  const { user, userRole } = useAuth()
  const isAdmin = userRole === 'ADMIN'

  const [stockAlmacen, setStockAlmacen] = useState([])
  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState(null)
  const [error, setError]     = useState(null)
  const [processing, setProcessing] = useState(false)

  // Modal transferencia
  const [transfModal, setTransfModal] = useState(null) // el item seleccionado
  const [cantTransf, setCantTransf] = useState('')

  // Modal ingreso directo (solo ADMIN)
  const [directModal, setDirectModal] = useState(false)
  const [directForm, setDirectForm] = useState({ id_variante: '', cantidad: '' })
  const [todasVariantes, setTodasVariantes] = useState([])

  // ── Carga de datos ──
  const fetchAlmacen = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('inventario_almacen')
        .select('*, producto_variantes!inner(*, productos!inner(*))')
        .eq('producto_variantes.productos.activo', true)
        .gt('stock_fisico', 0)
        .order('stock_fisico', { ascending: false })
      if (error) throw error
      setStockAlmacen(data ?? [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchTodasVariantes = useCallback(async () => {
    if (!isAdmin) return
    const { data } = await supabase.from('producto_variantes').select('*, productos!inner(nombre, activo)').eq('productos.activo', true).order('sku')
    setTodasVariantes(data ?? [])
  }, [isAdmin])

  useEffect(() => {
    fetchAlmacen()
    fetchTodasVariantes()
  }, [fetchAlmacen, fetchTodasVariantes])

  const flash = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 4000)
  }

  // ── TRANSFERENCIA Almacén → Tienda ──
  const handleTransferir = async (e) => {
    e.preventDefault()
    setProcessing(true)
    setError(null)
    const item = transfModal
    const cantidad = parseInt(cantTransf)

    try {
      if (cantidad <= 0) throw new Error('La cantidad debe ser mayor a cero.')

      // RPC atómica: valida stock real, descuenta almacén, suma tienda
      // e inserta movimiento en una sola transacción
      const { data, error } = await supabase.rpc('procesar_transferencia', {
        p_id_variante: item.id_variante,
        p_cantidad: cantidad,
        p_id_usuario: user.id,
      })

      if (error) throw new Error(error.message)
      if (!data?.ok) throw new Error(data?.error ?? 'Error al transferir')

      setTransfModal(null)
      setCantTransf('')
      fetchAlmacen()
      flash(`✓ ${cantidad} unid. de "${item.producto_variantes?.productos?.nombre}" (SKU: ${item.producto_variantes?.sku}) enviadas a Tienda.`)
    } catch (e) {
      setError(e.message)
    } finally {
      setProcessing(false)
    }
  }

  // ── INGRESO DIRECTO a Tienda (solo ADMIN) ──
  const handleIngresoDirecto = async (e) => {
    e.preventDefault()
    setProcessing(true)
    setError(null)
    const { id_variante, cantidad: cantStr } = directForm
    const cantidad = parseInt(cantStr)

    try {
      if (!id_variante) throw new Error('Selecciona un producto.')
      if (cantidad <= 0) throw new Error('La cantidad debe ser mayor a cero.')

      // RPC atómica: upsert en tienda e inserta movimiento en una sola transacción
      const { data, error } = await supabase.rpc('procesar_ingreso_directo_tienda', {
        p_id_variante: id_variante,
        p_cantidad: cantidad,
        p_id_usuario: user.id,
      })

      if (error) throw new Error(error.message)
      if (!data?.ok) throw new Error(data?.error ?? 'Error al ingresar a tienda')

      const varInst = todasVariantes.find(p => p.id === id_variante)
      setDirectModal(false)
      setDirectForm({ id_variante: '', cantidad: '' })
      flash(`✓ ${cantidad} unid. de "${varInst?.productos?.nombre} (${varInst?.sku})" ingresadas directo a Tienda.`)
    } catch (e) {
      setError(e.message)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Transferencias</h1>
              <p className="text-gray-500 text-sm">Envía stock del Almacén a la Tienda</p>
            </div>
          </div>

          {isAdmin && (
            <button
              onClick={() => { setDirectModal(true); setError(null) }}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-amber-950 font-semibold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20"
            >
              <Zap className="w-4 h-4" />
              Ingreso Directo a Tienda
            </button>
          )}
        </div>

        {/* Alertas */}
        {success && (
          <div className="flex items-center gap-2 mb-6 bg-emerald-950/50 border border-emerald-800 text-emerald-300 rounded-xl px-4 py-3 text-sm shadow-lg shadow-emerald-900/20">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">{success}</span>
          </div>
        )}
        {error && !transfModal && !directModal && (
          <div className="flex items-center gap-2 mb-6 bg-red-950/50 border border-red-800 text-red-300 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Leyenda */}
        <div className="flex items-center gap-6 mb-6 px-1">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Warehouse className="w-4 h-4 text-amber-400" />
            Almacén
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <ArrowRightLeft className="w-3 h-3" />
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Store className="w-4 h-4 text-emerald-400" />
            Tienda (Stock Exhibición)
          </div>
        </div>

        {/* Tabla de stock de almacén */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center p-16">
              <Loader2 className="w-7 h-7 text-indigo-500 animate-spin mr-3" />
              <span className="text-gray-400 text-sm">Cargando stock del almacén...</span>
            </div>
          ) : stockAlmacen.length === 0 ? (
            <div className="text-center p-16 text-gray-600">
              <Warehouse className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-medium">El almacén no tiene stock disponible para transferir.</p>
              <p className="text-xs mt-1">Primero ingresa mercadería desde el módulo de Almacén.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-950/40">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Producto</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Stock en Almacén</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {stockAlmacen.map(item => {
                    const variante = item.producto_variantes
                    return (
                    <tr key={item.id_variante} className="hover:bg-gray-800/30 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="text-white font-medium text-sm">{variante?.productos?.nombre}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="bg-gray-800 text-indigo-300 px-2 py-0.5 rounded text-xs font-mono">{variante?.sku}</span>
                          {(variante?.talla || variante?.color) && (
                            <span className="text-gray-500 text-xs uppercase">
                              {variante.talla ? `T:${variante.talla}` : ''} {variante.color ? `C:${variante.color}` : ''}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-400 font-bold rounded-lg text-sm border border-amber-500/20">
                          <Warehouse className="w-3.5 h-3.5" />
                          {item.stock_fisico} unid.
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => { setTransfModal(item); setCantTransf(''); setError(null) }}
                          className="flex items-center gap-2 ml-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all opacity-60 group-hover:opacity-100 shadow-lg shadow-indigo-600/20"
                        >
                          <ArrowRightLeft className="w-4 h-4" />
                          Enviar a Tienda
                        </button>
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

      {/* ── Modal de Transferencia ── */}
      {transfModal && (
        <Modal title="Enviar a Tienda" icon={ArrowRightLeft} iconColor="text-indigo-400" onClose={() => setTransfModal(null)}>
          <div className="mb-5 p-4 bg-gray-800/60 border border-gray-700 rounded-xl space-y-3">
            <div className="flex flex-col mb-4 bg-gray-900 border border-gray-700/50 p-3 rounded-lg">
              <span className="text-white font-semibold text-sm">{transfModal.producto_variantes?.productos?.nombre}</span>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="bg-gray-800 text-indigo-300 px-2 py-1 rounded text-xs font-mono tracking-wide">{transfModal.producto_variantes?.sku}</span>
                {(transfModal.producto_variantes?.talla || transfModal.producto_variantes?.color) && (
                  <span className="text-gray-400 text-xs uppercase font-medium">
                    {transfModal.producto_variantes.talla ? `T:${transfModal.producto_variantes.talla} ` : ''} {transfModal.producto_variantes.color ? `C:${transfModal.producto_variantes.color}` : ''}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-gray-700 pt-3">
              <div className="flex items-center gap-1.5 text-xs text-gray-400"><Warehouse className="w-3.5 h-3.5 text-amber-400" /> Stock en Almacén</div>
              <span className="text-amber-400 font-bold">{transfModal.stock_fisico} unid.</span>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-950/50 border border-red-800 text-red-300 rounded-xl px-3 py-2.5 text-xs mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleTransferir} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Cantidad a transferir <span className="text-gray-600">(máx. {transfModal.stock_fisico})</span>
              </label>
              <input
                type="number" min="1" max={transfModal.stock_fisico} step="1" required autoFocus
                value={cantTransf} onChange={e => setCantTransf(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white font-semibold text-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="Ej: 10"
              />
            </div>
            <button
              type="submit" disabled={processing}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold rounded-xl transition-all"
            >
              {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRightLeft className="w-5 h-5" />}
              {processing ? 'Transfiriendo...' : 'Confirmar Transferencia'}
            </button>
          </form>
        </Modal>
      )}

      {/* ── Modal Ingreso Directo (Solo ADMIN) ── */}
      {directModal && (
        <Modal title="Ingreso Directo a Tienda" icon={Zap} iconColor="text-amber-400" onClose={() => { setDirectModal(false); setError(null) }}>
          <p className="text-gray-500 text-xs mb-5 bg-amber-950/30 border border-amber-900/50 rounded-xl px-3 py-2.5">
            <span className="text-amber-400 font-semibold">Solo Administrador:</span> Ingresa productos directamente en el mostrador sin pasar por el almacén.
          </p>

          {error && (
            <div className="flex items-center gap-2 bg-red-950/50 border border-red-800 text-red-300 rounded-xl px-3 py-2.5 text-xs mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleIngresoDirecto} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Producto</label>
              <select
                required
                value={directForm.id_variante}
                onChange={e => setDirectForm(f => ({ ...f, id_variante: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              >
                <option value="">— Selecciona una variante —</option>
                {todasVariantes.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.productos?.nombre} - [{v.sku}] {v.talla ? `T:${v.talla}` : ''} {v.color ? `C:${v.color}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Cantidad</label>
              <input
                type="number" min="1" step="1" required autoFocus
                value={directForm.cantidad} onChange={e => setDirectForm(f => ({ ...f, cantidad: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white font-semibold text-lg focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                placeholder="Ej: 5"
              />
            </div>
            <button
              type="submit" disabled={processing}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-amber-950 font-bold rounded-xl transition-all"
            >
              {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <PackagePlus className="w-5 h-5" />}
              {processing ? 'Procesando...' : 'Ingresar a Tienda'}
            </button>
          </form>
        </Modal>
      )}
    </Layout>
  )
}
