import { useState, useEffect, useCallback, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import Sidebar from '../components/Sidebar'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { ScanLine, Search, ShoppingCart, Plus, Minus, Trash2,
  X, Loader2, CheckCircle, CreditCard, Banknote,
  Smartphone, AlertCircle, Receipt, PackageX, LogOut
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const IGV_RATE = 0.18

const PAYMENT_METHODS = [
  { id: 'EFECTIVO', label: 'Efectivo', icon: Banknote, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20' },
  { id: 'TARJETA',  label: 'Tarjeta',  icon: CreditCard, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/30 hover:bg-indigo-500/20' },
  { id: 'YAPE',     label: 'Yape',     icon: Smartphone, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20' },
  { id: 'PLIN',     label: 'Plin',     icon: Smartphone, color: 'text-sky-400',    bg: 'bg-sky-500/10 border-sky-500/30 hover:bg-sky-500/20' },
]

function getPrecioFinal(item) {
  return parseFloat((item.precio_final || 0).toFixed(2))
}

export default function TiendaPOS() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  // Catálogo y búsqueda
  const [query, setQuery] = useState('')
  const [productos, setProductos] = useState([])
  const [searching, setSearching] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const scannerRef = useRef(null)

  // Carrito
  const [carrito, setCarrito] = useState([])

  // Modal de pago
  const [payModal, setPayModal] = useState(false)
  const [metodoPago, setMetodoPago] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [ventaOk, setVentaOk] = useState(false)
  const [finalTotal, setFinalTotal] = useState(0)   // ← guarda el total antes de limpiar el carrito
  const [error, setError] = useState(null)

  // --- Búsqueda ---
  const buscarProductos = useCallback(async (texto) => {
    if (!texto.trim()) { setProductos([]); return }
    setSearching(true)
    try {
      // 1. Intentamos buscar por SKU primero (es lo más rápido en un POS)
      let { data: resultados, error } = await supabase
        .from('producto_variantes')
        .select(`
          id,
          sku,
          talla,
          color,
          productos!inner (nombre, categoria),
          inventario_tienda!inner (stock_exhibicion, precio_final)
        `)
        .eq('productos.activo', true)
        .ilike('sku', `%${texto}%`);

      // 2. Si no hay resultados por SKU, buscamos por Nombre en la tabla relacionada
      if (!error && (!resultados || resultados.length === 0)) {
        const { data: resultadosNombre, error: errorNombre } = await supabase
          .from('producto_variantes')
          .select(`
            id,
            sku,
            talla,
            color,
            productos!inner (nombre, categoria),
            inventario_tienda!inner (stock_exhibicion, precio_final)
          `)
          .eq('productos.activo', true)
          .ilike('productos.nombre', `%${texto}%`);
          
        resultados = resultadosNombre;
        error = errorNombre;
      }

      if (error) {
        console.error("Error exacto de Supabase:", error.message || error);
        setSearching(false);
        return;
      }

      // Aplanar la respuesta de inventario_tienda para facilitar el renderizado del POS
      const formatted = (resultados ?? []).map(v => {
        const tienda = Array.isArray(v.inventario_tienda) ? v.inventario_tienda[0] : v.inventario_tienda
        return {
          id_variante: v.id,
          sku: v.sku,
          talla: v.talla,
          color: v.color,
          productos: v.productos,
          stock_exhibicion: tienda?.stock_exhibicion || 0,
          precio_final: tienda?.precio_final || 0
        }
      })
      
      setProductos(formatted)
    } catch (e) {
      console.error('Error buscando productos POS:', e)
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => buscarProductos(query), 350)
    return () => clearTimeout(t)
  }, [query, buscarProductos])

  // Limpieza del escáner al desmontar
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [])

  // --- Escáner ---
  const handleScanned = useCallback(async (sku) => {
    // Detener escáner antes de buscar
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch (_) {}
      try { scannerRef.current.clear() } catch (_) {}
      scannerRef.current = null
    }
    setIsScanning(false)
    setQuery(sku)
    await buscarProductos(sku)
  }, [buscarProductos])

  const startScanner = async () => {
    setIsScanning(true)
    await new Promise(r => setTimeout(r, 150))
    try {
      const qrcode = new Html5Qrcode('pos-reader')
      scannerRef.current = qrcode
      // Intentar cámara trasera estricta, fallback a cualquier cámara si falla (ej: desktop)
      const camConfig = { facingMode: { exact: 'environment' } }
      try {
        await qrcode.start(camConfig, { fps: 12, qrbox: { width: 220, height: 220 } }, (decoded) => handleScanned(decoded), () => {})
      } catch (_) {
        await qrcode.start('environment', { fps: 12, qrbox: { width: 220, height: 220 } }, (decoded) => handleScanned(decoded), () => {})
      }
    } catch (err) {
      console.error('Error iniciando escáner POS:', err)
      setIsScanning(false)
    }
  }

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch (_) {}
      try { scannerRef.current.clear() } catch (_) {}
      scannerRef.current = null
    }
    setIsScanning(false)
  }

  // --- Carrito ---
  const agregarAlCarrito = (item) => {
    const pf = getPrecioFinal(item)
    setCarrito(prev => {
      const existe = prev.find(c => c.id_variante === item.id_variante)
      if (existe) {
        if (existe.cantidad >= item.stock_exhibicion) return prev
        return prev.map(c => c.id_variante === item.id_variante ? { ...c, cantidad: c.cantidad + 1 } : c)
      }
      if (item.stock_exhibicion <= 0) return prev
      return [...prev, {
        id_variante: item.id_variante,
        nombre: item.productos?.nombre,
        sku: item.sku,
        talla: item.talla,
        color: item.color,
        precio_final: pf,
        stock_max: item.stock_exhibicion,
        cantidad: 1,
      }]
    })
  }

  const cambiarCantidad = (id, delta) => {
    setCarrito(prev => prev
      .map(c => c.id_variante === id ? { ...c, cantidad: Math.min(c.stock_max, Math.max(1, c.cantidad + delta)) } : c)
    )
  }

  const quitarDelCarrito = (id) => setCarrito(prev => prev.filter(c => c.id_variante !== id))

  // --- Totales ---
  const subtotal = parseFloat(carrito.reduce((s, c) => s + c.precio_final * c.cantidad, 0).toFixed(2))
  const igv = parseFloat((subtotal * IGV_RATE).toFixed(2))
  const total = parseFloat((subtotal + igv).toFixed(2))

  // --- Cobrar ---
  const handleCobrar = async () => {
    if (!metodoPago) return
    setProcessing(true)
    setError(null)
    try {
      // 1. Descontar stock de cada variante vendida
      const stockUpdates = carrito.map(item =>
        supabase
          .from('inventario_tienda')
          .update({ stock_exhibicion: item.stock_max - item.cantidad })
          .eq('id_variante', item.id_variante)
      )
      const stockResults = await Promise.all(stockUpdates)
      const stockError = stockResults.find(r => r.error)
      if (stockError) throw new Error(`Error al descontar stock: ${stockError.error.message}`)

      // 2. Registrar un movimiento por cada variante de la venta
      const movimientos = carrito.map(item => ({
        id_variante: item.id_variante,
        id_usuario: user.id,
        tipo_movimiento: 'VENTA',
        cantidad: item.cantidad,
        metodo_pago: metodoPago,
        subtotal: parseFloat((item.precio_final * item.cantidad).toFixed(2)),
        igv: parseFloat((item.precio_final * item.cantidad * IGV_RATE).toFixed(2)),
        total_final: parseFloat((item.precio_final * item.cantidad * (1 + IGV_RATE)).toFixed(2)),
      }))

      const { error: movError } = await supabase.from('movimientos').insert(movimientos)
      if (movError) throw new Error(`Error al registrar movimiento: ${movError.message}`)

      setFinalTotal(total)   // ← capturar ANTES de limpiar el carrito
      setVentaOk(true)
      setCarrito([])
      setQuery('')
      setProductos([])
    } catch (e) {
      setError(e.message)
    } finally {
      setProcessing(false)
    }
  }

  const cerrarModal = () => {
    setPayModal(false)
    setMetodoPago(null)
    setVentaOk(false)
    setError(null)
  }

  // Tab activo en móvil: 'buscar' | 'carrito'
  const [mobileTab, setMobileTab] = useState('buscar')
  const totalItems = carrito.reduce((s, c) => s + c.cantidad, 0)

  return (
    <div className="flex min-h-screen bg-gray-950">
      {/* Sidebar: oculto en mobile, visible en lg+ */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col overflow-hidden h-screen">

        {/* ── Header móvil: sólo visible en < lg, con email y botón logout ── */}
        <div className="lg:hidden flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center">
              <ShoppingCart className="w-3.5 h-3.5 text-white" />
            </div>
            <p className="text-gray-400 text-xs truncate max-w-[180px]">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-red-400 hover:bg-red-900/10 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Salir
          </button>
        </div>

        {/* ── Tabs móvil ── */}
        <div className="lg:hidden flex border-b border-gray-800 bg-gray-900 flex-shrink-0">
          <button
            onClick={() => setMobileTab('buscar')}
            className={`flex-1 py-3.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
              mobileTab === 'buscar'
                ? 'text-emerald-400 border-b-2 border-emerald-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Search className="w-4 h-4" />
            Buscar Producto
          </button>
          <button
            onClick={() => setMobileTab('carrito')}
            className={`flex-1 py-3.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors relative ${
              mobileTab === 'carrito'
                ? 'text-emerald-400 border-b-2 border-emerald-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Carrito
            {totalItems > 0 && (
              <span className="absolute top-2 right-6 w-5 h-5 bg-emerald-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </button>
        </div>

        {/* ── Cuerpo: dos columnas en desktop, tabs en móvil ── */}
        <div className="flex flex-1 overflow-hidden">

        {/* ── IZQUIERDA: CARRITO ── */}
        <div className={`flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col w-full lg:w-80 xl:w-96 ${mobileTab === 'carrito' ? 'flex' : 'hidden'} lg:flex`}>
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-3">
            <ShoppingCart className="w-5 h-5 text-emerald-400" />
            <h2 className="text-white font-semibold">Carrito de Venta</h2>
            <span className="ml-auto text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-bold px-2.5 py-1 rounded-full">
              {carrito.reduce((s, c) => s + c.cantidad, 0)} ítems
            </span>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {carrito.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-600 text-center px-4">
                <ShoppingCart className="w-14 h-14 mb-4 opacity-20" />
                <p className="text-sm font-medium">El carrito está vacío</p>
                <p className="text-xs mt-1">Busca y agrega productos desde la derecha</p>
              </div>
            ) : (
              carrito.map(item => (
                <div key={item.id_variante} className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{item.nombre}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span className="text-indigo-400 font-mono text-xs truncate bg-gray-900 px-1.5 py-0.5 rounded border border-gray-700">{item.sku}</span>
                        {(item.talla || item.color) && (
                          <span className="text-gray-500 text-[10px] uppercase font-semibold">
                            {item.talla ? `T:${item.talla} ` : ''} 
                            {item.color ? `C:${item.color}` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => quitarDelCarrito(item.id_variante)} className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-1.5 bg-gray-900 rounded-lg border border-gray-700 p-0.5">
                      <button onClick={() => cambiarCantidad(item.id_variante, -1)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded-md transition-colors">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-white text-sm w-6 text-center font-semibold">{item.cantidad}</span>
                      <button onClick={() => cambiarCantidad(item.id_variante, 1)} disabled={item.cantidad >= item.stock_max} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-emerald-400 font-bold text-sm">
                      S/ {(item.precio_final * item.cantidad).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totales + Cobrar */}
          <div className="px-5 py-4 border-t border-gray-800 space-y-3">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>Subtotal</span>
                <span className="font-mono">S/ {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>IGV (18%)</span>
                <span className="font-mono">S/ {igv.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-white font-bold text-lg pt-1 border-t border-gray-700">
                <span>Total</span>
                <span className="text-emerald-400 font-mono">S/ {total.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={() => { setPayModal(true); setVentaOk(false); setError(null); setMetodoPago(null) }}
              disabled={carrito.length === 0}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20 text-base"
            >
              <Receipt className="w-5 h-5" />
              COBRAR
            </button>
          </div>
        </div>

        {/* ── DERECHA: BÚSQUEDA Y CATÁLOGO ── */}
        <div className={`flex-1 overflow-y-auto flex flex-col bg-gray-950 ${mobileTab === 'buscar' ? 'flex' : 'hidden'} lg:flex`}>
          {/* Header búsqueda */}
          <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800 px-6 py-4">
            <div className="flex items-center gap-4">
              {/* Escáner */}
              {!isScanning ? (
                <button
                  onClick={startScanner}
                  className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-amber-950 font-semibold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 flex-shrink-0"
                >
                  <ScanLine className="w-4 h-4" />
                  Escanear
                </button>
              ) : (
                <button onClick={stopScanner} className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl text-sm flex-shrink-0">
                  <X className="w-4 h-4" />
                  Cancelar
                </button>
              )}

              {/* Input búsqueda */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 animate-spin" />}
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar por nombre o SKU..."
                  className="w-full pl-10 pr-10 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm"
                />
              </div>
            </div>

            {/* Cámara del escáner */}
            {isScanning && (
              <div className="mt-4 flex justify-center">
                <div id="pos-reader" className="max-w-xs w-full rounded-2xl overflow-hidden border-2 border-amber-500/50 shadow-xl bg-black"></div>
              </div>
            )}
          </div>

          {/* Listado de resultados */}
          <div className="flex-1 p-6">
            {!query && !isScanning && (
              <div className="flex flex-col items-center justify-center h-64 text-gray-700 text-center">
                <Search className="w-12 h-12 mb-4 opacity-30" />
                <p className="text-sm font-medium">Busca un producto para comenzar</p>
                <p className="text-xs mt-1 text-gray-600">Escribe el nombre, SKU o usa el escáner</p>
              </div>
            )}

            {query && productos.length === 0 && !searching && (
              <div className="flex flex-col items-center justify-center h-64 text-gray-600 text-center">
                <PackageX className="w-12 h-12 mb-4 opacity-30" />
                <p className="text-sm font-medium">No se encontraron productos</p>
                <p className="text-xs mt-1">Verifica el nombre o el código</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {productos.map(item => {
                const pf = getPrecioFinal(item)
                const sinStock = item.stock_exhibicion <= 0
                const enCarrito = carrito.find(c => c.id_variante === item.id_variante)
                const maxAlcanzado = enCarrito && enCarrito.cantidad >= item.stock_exhibicion

                return (
                  <div
                    key={item.id_variante}
                    className={`bg-gray-900 border rounded-2xl p-4 flex flex-col gap-3 transition-all ${
                      sinStock ? 'border-gray-800 opacity-60' : 'border-gray-800 hover:border-gray-700 hover:shadow-lg hover:shadow-black/30'
                    }`}
                  >
                    <div className="flex-1">
                      <p className="text-white font-semibold text-sm leading-tight">{item.productos?.nombre}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="bg-gray-800 text-indigo-300 px-2 py-0.5 rounded text-xs font-mono">{item.sku}</span>
                        {(item.talla || item.color) && (
                          <span className="text-gray-500 text-xs uppercase font-semibold">
                            {item.talla ? `T:${item.talla} ` : ''} 
                            {item.color ? `C:${item.color}` : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <p className="text-emerald-400 font-bold text-lg font-mono">S/ {pf.toFixed(2)}</p>
                      </div>

                      <div className="text-right">
                        <p className={`text-xs font-semibold mb-2 ${sinStock ? 'text-red-400' : 'text-gray-500'}`}>
                          {sinStock ? 'Sin stock' : `Stock: ${item.stock_exhibicion}`}
                        </p>
                        <button
                          onClick={() => agregarAlCarrito(item)}
                          disabled={sinStock || maxAlcanzado}
                          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {sinStock ? 'Sin Stock' : maxAlcanzado ? 'Máx.' : 'Agregar'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* ── MODAL DE PAGO ── */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">

            {ventaOk ? (
              /* Estado de Éxito */
              <div className="flex flex-col items-center justify-center p-10 text-center">
                <div className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/50 flex items-center justify-center mb-5">
                  <CheckCircle className="w-10 h-10 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">¡Venta Completada!</h2>
                <p className="text-gray-400 text-sm mb-2">Total cobrado</p>
                <p className="text-emerald-400 font-bold text-3xl font-mono mb-6">S/ {finalTotal.toFixed(2)}</p>
                <button onClick={cerrarModal} className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors">
                  Nueva Venta
                </button>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-emerald-400" />
                    Finalizar Venta
                  </h2>
                  <button onClick={cerrarModal} className="text-gray-500 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-5">
                  {/* Resumen */}
                  <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-1.5 text-sm">
                    <div className="flex justify-between text-gray-400">
                      <span>Subtotal</span>
                      <span className="font-mono">S/ {subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>IGV (18%)</span>
                      <span className="font-mono">S/ {igv.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-white font-bold text-base pt-1.5 mt-1.5 border-t border-gray-700">
                      <span>Total a Cobrar</span>
                      <span className="text-emerald-400 font-mono">S/ {total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Método de pago */}
                  <div>
                    <p className="text-gray-400 text-sm font-medium mb-3">Selecciona el método de pago</p>
                    <div className="grid grid-cols-2 gap-2">
                      {PAYMENT_METHODS.map(({ id, label, icon: Icon, color, bg }) => (
                        <button
                          key={id}
                          onClick={() => setMetodoPago(id)}
                          className={`flex items-center gap-2.5 px-4 py-3.5 rounded-xl border font-semibold text-sm transition-all ${
                            metodoPago === id
                              ? `border-2 ${bg.replace('border-', 'border-')} ${color} ring-2 ring-current/20` 
                              : `border-gray-700 text-gray-400 bg-gray-800/40 hover:bg-gray-800`
                          } ${bg}`}
                        >
                          <Icon className={`w-4 h-4 ${metodoPago === id ? color : 'text-gray-500'}`} />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 bg-red-950/50 border border-red-800 text-red-300 rounded-xl px-4 py-3 text-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {error}
                    </div>
                  )}

                  <button
                    onClick={handleCobrar}
                    disabled={!metodoPago || processing}
                    className="w-full flex items-center justify-center gap-2.5 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl transition-all shadow-lg shadow-emerald-600/20"
                  >
                    {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                    {processing ? 'Procesando...' : 'Confirmar Cobro'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
