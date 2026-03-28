import { useState, useEffect, useCallback, useRef } from 'react'
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { ScanLine, Search, PackagePlus, AlertCircle, X, Loader2, Database } from 'lucide-react'

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
  const scannerRef = useRef(null)

  const fetchStock = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('inventario_almacen')
        .select('*, productos(sku, nombre, categoria)')
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
        .from('productos')
        .select('*')
        .eq('sku', sku)
        .limit(1)

      if (error) throw error
      
      const product = data?.[0]
      if (!product) {
        setError(`Producto no encontrado en el catálogo (SKU: ${sku})`)
        setScannedProduct(null)
      } else {
        setScannedProduct(product)
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

  const startScanner = () => {
    setIsScanning(true)
    setError(null)
    setTimeout(() => {
      if(!document.getElementById('reader')) return;
      const html5QrcodeScanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: {width: 250, height: 250}, supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA] },
        false
      );
      scannerRef.current = html5QrcodeScanner;
      
      html5QrcodeScanner.render(
        (decodedText) => handleProductFound(decodedText),
        (error) => {} // ignores read errors
      );
    }, 100)
  }

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error)
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

      const { data: currentStockData, error: checkError } = await supabase
        .from('inventario_almacen')
        .select('*')
        .eq('id_producto', scannedProduct.id)
        .limit(1)
        
      if (checkError) throw checkError
      
      const currentStock = currentStockData?.[0]
      let newTotalStock = amountToAdd
      
      if (currentStock) {
        newTotalStock += currentStock.stock_fisico
        const { error: updateError } = await supabase
          .from('inventario_almacen')
          .update({ stock_fisico: newTotalStock })
          .eq('id_producto', scannedProduct.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('inventario_almacen')
          .insert({ id_producto: scannedProduct.id, stock_fisico: newTotalStock, costo_unitario: 0 })
        if (insertError) throw insertError
      }

      const { error: movError } = await supabase
        .from('movimientos')
        .insert({
          id_producto: scannedProduct.id,
          id_usuario: user.id,
          tipo_movimiento: 'ENTRADA',
          cantidad: amountToAdd,
          motivo_detalle: 'Ingreso manual por escáner/formulario'
        })
      if (movError) throw movError

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
                     <tr key={item.id_producto} className="hover:bg-gray-800/30 transition-colors">
                       <td className="px-6 py-4">
                         <div className="text-white font-medium text-sm">{item.productos?.nombre}</div>
                         <div className="text-gray-500 font-mono text-xs">{item.productos?.sku}</div>
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
             <p className="text-gray-400 text-xs uppercase font-medium">Producto a ingresar</p>
             <p className="text-white font-bold text-lg mt-1 leading-tight">{scannedProduct.nombre}</p>
             <p className="text-indigo-300 font-mono text-xs mt-1">{scannedProduct.sku}</p>
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
