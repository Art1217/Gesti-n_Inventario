import { useState, useEffect, useCallback, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { ScanLine, Search, PackagePlus, AlertCircle, CheckCircle, X, Loader2, Database } from 'lucide-react'

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-white font-semibold flex items-center gap-2">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

export default function AlmacenView() {
  const { user } = useAuth()
  
  const [manualSku, setManualSku] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [scannedProduct, setScannedProduct] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ cantidad: '' })
  const [stock, setStock] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const scannerRef = useRef(null)

  const fetchStock = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('inventario_almacen')
        .select('*, producto_variantes!inner(*, productos!inner(*))')
        .eq('producto_variantes.productos.activo', true)
      if (error) throw error
      setStock(data ?? [])
    } catch(err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStock() }, [fetchStock])

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
         scannerRef.current.clear().catch(console.error);
      }
    }
  }, [])

  const handleProductFound = async (sku) => {
    if (isScanning && scannerRef.current) {
      scannerRef.current.clear().catch(console.error)
      setIsScanning(false)
    }
    setProcessing(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('producto_variantes')
        .select('*, productos!inner(nombre, activo)')
        .eq('sku', sku)
        .eq('productos.activo', true)
        .limit(1)

      if (error) throw error
      
      const variante = data?.[0]
      if (!variante) {
        setError(`Producto no encontrado en el catálogo (SKU: ${sku})`)
        setScannedProduct(null)
      } else {
        setScannedProduct(variante)
        setForm({ cantidad: '' })
        setModalOpen(true)
      }
    } catch(err) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const closeModal = () => {
    setModalOpen(false)
    setScannedProduct(null)
    setError(null)
    setForm({ cantidad: '' })
  }

  const startScanner = async () => {
    setIsScanning(true)
    setError(null)
    await new Promise(r => setTimeout(r, 150))
    try {
      const qrcode = new Html5Qrcode('reader')
      scannerRef.current = qrcode
      const camConfig = { facingMode: { exact: 'environment' } }
      try {
        await qrcode.start(camConfig, { fps: 12, qrbox: { width: 240, height: 240 } }, (decodedText) => handleProductFound(decodedText), () => {})
      } catch (_) {
        await qrcode.start('environment', { fps: 12, qrbox: { width: 240, height: 240 } }, (decodedText) => handleProductFound(decodedText), () => {})
      }
    } catch (err) {
      console.error('Error iniciando escáner:', err)
      setIsScanning(false)
      setError('No se pudo acceder a la cámara. Verifica los permisos o usa HTTPS.')
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

  const handleManualSearch = (e) => {
    e.preventDefault()
    if (!manualSku) return
    handleProductFound(manualSku)
  }

  const handleIngresoStock = async (e) => {
    e.preventDefault()
    setProcessing(true)
    setError(null)

    try {
      const amountToAdd = parseInt(form.cantidad)
      if (amountToAdd <= 0) throw new Error("Cantidad inválida")

      // RPC atómica: upsert en almacén e inserta movimiento ENTRADA
      // en una sola transacción (si falla, revierte todo)
      const { data, error } = await supabase.rpc('procesar_entrada_almacen', {
        p_id_variante: scannedProduct.id,
        p_cantidad: amountToAdd,
        p_id_usuario: user.id,
      })

      if (error) throw new Error(error.message)
      if (!data?.ok) throw new Error(data?.error ?? 'Error al registrar el ingreso')

      setSuccess(`¡Se agregaron ${amountToAdd} unidades correctamente!`)
      setTimeout(() => setSuccess(null), 4000)
      closeModal()
      setManualSku('')
      fetchStock()
    } catch(err) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <PackagePlus className="w-7 h-7 text-amber-400" />
              Ingreso de Almacén
            </h1>
            <p className="text-gray-500 text-sm mt-1">Registra nuevos ingresos mediante código de barras o búsqueda manual</p>
          </div>
        </div>

        {error && !modalOpen && (
          <div className="flex bg-red-950/50 border border-red-800 text-red-300 rounded-xl px-4 py-3 text-sm mb-6 items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-white"><X className="w-4 h-4"/></button>
          </div>
        )}

        {success && !modalOpen && (
          <div className="flex bg-emerald-950/50 border border-emerald-800 text-emerald-300 rounded-xl px-4 py-3 text-sm mb-6 items-center justify-between shadow-lg shadow-emerald-900/20">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-400" />
              <span>{success}</span>
            </div>
            <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-emerald-300"><X className="w-4 h-4"/></button>
          </div>
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8 text-center flex flex-col items-center">
          {!isScanning ? (
            <button onClick={startScanner} className="w-full max-w-sm flex flex-col items-center justify-center p-8 bg-amber-500 hover:bg-amber-400 text-amber-950 rounded-2xl transition-all shadow-lg shadow-amber-500/20 group">
              <ScanLine className="w-16 h-16 mb-4 group-hover:scale-110 transition-transform" />
              <span className="text-2xl font-bold font-sans">Escanear Ingreso</span>
              <span className="text-sm font-medium mt-1 opacity-80">Abre la cámara del dispositivo</span>
            </button>
          ) : (
            <div className="w-full max-w-sm">
               <div id="reader" className="w-full rounded-2xl overflow-hidden shadow-xl bg-black border-2 border-amber-500/50"></div>
               <button onClick={stopScanner} className="mt-4 px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium w-full text-sm">Cancelar Escaneo</button>
            </div>
          )}

          <div className="flex items-center gap-4 w-full justify-center mt-6">
            <div className="h-px bg-gray-800 flex-1 max-w-[100px]"></div>
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Búsqueda manual</span>
            <div className="h-px bg-gray-800 flex-1 max-w-[100px]"></div>
          </div>

          <form onSubmit={handleManualSearch} className="w-full max-w-sm mt-6 flex gap-2">
             <div className="relative flex-1">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
               <input type="text" value={manualSku} onChange={e => setManualSku(e.target.value)} disabled={isScanning || processing} placeholder="Cód. producto (SKU)" className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 disabled:opacity-50 text-sm" />
             </div>
             <button type="submit" disabled={isScanning || processing || !manualSku} className="px-5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium disabled:opacity-50 transition-colors">
               Buscar
             </button>
          </form>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mt-10">
           <div className="px-6 py-5 border-b border-gray-800 flex items-center justify-between">
             <h2 className="text-white font-semibold flex items-center gap-2">
               <Database className="w-5 h-5 text-gray-400" />
               Stock Actual Almacén
             </h2>
           </div>
           
           {loading ? (
             <div className="flex items-center justify-center p-12">
               <Loader2 className="w-6 h-6 text-amber-500 animate-spin mr-3" />
               <span className="text-gray-400 text-sm">Cargando inventario...</span>
             </div>
           ) : stock.length === 0 ? (
             <div className="text-center p-12 text-gray-500">
               <Database className="w-10 h-10 mx-auto mb-3 opacity-20" />
               <p>El almacén está vacío.</p>
               <p className="text-xs mt-1">Escanea productos para comenzar a agregarlos.</p>
             </div>
           ) : (
             <div className="overflow-x-auto">
               <table className="w-full text-left">
                 <thead>
                   <tr className="border-b border-gray-800">
                     <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Producto (SKU)</th>
                     <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Stock Físico</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-800/60">
                   {stock.map((item) => (
                     <tr key={item.id_variante} className="hover:bg-gray-800/30 transition-colors">
                       <td className="px-6 py-4">
                         <div className="text-white font-medium text-sm">{item.producto_variantes?.productos?.nombre}</div>
                         <div className="flex items-center gap-2 mt-1">
                           <span className="bg-gray-800 text-indigo-300 px-2 py-0.5 rounded text-xs font-mono">{item.producto_variantes?.sku}</span>
                           {(item.producto_variantes?.talla || item.producto_variantes?.color) && (
                             <span className="text-gray-500 text-xs uppercase">
                               {item.producto_variantes.talla ? `T:${item.producto_variantes.talla}` : ''} {item.producto_variantes.color ? `C:${item.producto_variantes.color}` : ''}
                             </span>
                           )}
                         </div>
                       </td>
                       <td className="px-6 py-4 text-right">
                         <span className="inline-flex px-3 py-1 bg-amber-500/10 text-amber-400 font-bold rounded-lg text-sm border border-amber-500/20">
                           {item.stock_fisico}
                         </span>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           )}
        </div>
      </div>

      {modalOpen && scannedProduct && (
        <Modal title={<><PackagePlus className="w-5 h-5 text-amber-400"/> Agregar Stock</>} onClose={closeModal}>
           <div className="mb-6 p-4 bg-gray-800/60 border border-gray-700 rounded-xl">
             <p className="text-gray-400 text-xs uppercase font-medium">Variante a ingresar</p>
             <p className="text-white font-bold text-lg mt-1 leading-tight">{scannedProduct.productos?.nombre}</p>
             <div className="flex items-center gap-2 mt-2">
                 <span className="bg-gray-900 border border-indigo-500 text-indigo-300 px-2.5 py-1 rounded text-sm font-mono tracking-wide">{scannedProduct.sku}</span>
                 {(scannedProduct.talla || scannedProduct.color) && (
                   <span className="text-gray-400 text-xs uppercase font-medium">
                     {scannedProduct.talla ? `T:${scannedProduct.talla} ` : ''} {scannedProduct.color ? `C:${scannedProduct.color}` : ''}
                   </span>
                 )}
             </div>
           </div>
           
           {error && (
             <div className="text-red-300 text-xs bg-red-950/50 border border-red-800 rounded-lg px-3 py-2 mb-4">{error}</div>
           )}

           <form onSubmit={handleIngresoStock} className="space-y-4">
             <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Cantidad a Ingresar</label>
                <input 
                  type="number" min="1" step="1" required
                  value={form.cantidad} onChange={e => setForm({...form, cantidad: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white font-semibold text-lg focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  placeholder="Ej: 50"
                  autoFocus
                />
             </div>

             <div className="pt-2">
                 <button type="submit" disabled={processing} className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-800 disabled:opacity-70 text-amber-950 font-bold rounded-xl transition-colors">
                   {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <PackagePlus className="w-5 h-5" />}
                   {processing ? 'Guardando...' : 'Confirmar Ingreso'}
                 </button>
             </div>
           </form>
        </Modal>
      )}
    </Layout>
  )
}
