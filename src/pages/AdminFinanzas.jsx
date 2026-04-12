import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabaseClient'
import { Calculator, Save, Loader2, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react'

export default function AdminFinanzas() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const [savingRowId, setSavingRowId] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: prods, error } = await supabase
        .from('productos')
        .select(`
          id,
          nombre,
          producto_variantes(
            id,
            sku,
            talla,
            color,
            inventario_almacen(costo_unitario),
            inventario_tienda(precio_venta, descuento_porcentaje)
          )
        `)
        .eq('activo', true)
        .order('nombre')

      if (error) throw error

      const formatted = []
      prods.forEach(p => {
        (p.producto_variantes || []).forEach(v => {
          const almacenInfo = Array.isArray(v.inventario_almacen) ? v.inventario_almacen[0] : v.inventario_almacen
          const tiendaInfo = Array.isArray(v.inventario_tienda) ? v.inventario_tienda[0] : v.inventario_tienda

          formatted.push({
            id_variante: v.id,
            nombre: p.nombre,
            sku: v.sku,
            talla: v.talla,
            color: v.color,
            costo_unitario: almacenInfo?.costo_unitario || 0,
            precio_venta: tiendaInfo?.precio_venta || 0,
            descuento_porcentaje: tiendaInfo?.descuento_porcentaje || 0,
          })
        })
      })

      setData(formatted)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleInputChange = (id, field, value) => {
    setData(prev => prev.map(item =>
      item.id_variante === id ? { ...item, [field]: value === '' ? 0 : parseFloat(value) } : item
    ))
  }

  const handleSaveRow = async (item) => {
    setSavingRowId(item.id_variante)
    setError(null)
    setSuccess(null)

    try {
      // Upsert almacen
      const { data: existsAlmacen } = await supabase.from('inventario_almacen').select('id_variante').eq('id_variante', item.id_variante).limit(1)
      if (existsAlmacen?.length > 0) {
        await supabase.from('inventario_almacen').update({ costo_unitario: item.costo_unitario }).eq('id_variante', item.id_variante)
      } else {
        await supabase.from('inventario_almacen').insert({ id_variante: item.id_variante, costo_unitario: item.costo_unitario, stock_fisico: 0 })
      }

      // Upsert tienda
      const { data: existsTienda } = await supabase.from('inventario_tienda').select('id_variante').eq('id_variante', item.id_variante).limit(1)
      if (existsTienda?.length > 0) {
        await supabase.from('inventario_tienda').update({
          precio_venta: item.precio_venta,
          descuento_porcentaje: item.descuento_porcentaje
        }).eq('id_variante', item.id_variante)
      } else {
        await supabase.from('inventario_tienda').insert({
          id_variante: item.id_variante,
          precio_venta: item.precio_venta,
          descuento_porcentaje: item.descuento_porcentaje,
          stock_exhibicion: 0
        })
      }

      // Feedback visual rápido
      setSuccess(`¡Guardado correcto para ${item.nombre}!`)
      setTimeout(() => setSavingRowId(null), 500)
      setTimeout(() => setSuccess(null), 3500)
    } catch (err) {
      console.error(err)
      setError(`Error al guardar: ${err.message || 'Sin permisos / 403 Forbidden'}.`)
      setSavingRowId(null)
    }
  }

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Calculator className="w-8 h-8 text-indigo-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Gestión de Costos y Precios</h1>
            <p className="text-gray-500 text-sm">Vista exclusiva de Administración - Control de rentabilidad</p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 mb-6 bg-red-950/50 border border-red-800 text-red-300 rounded-xl px-4 py-3 text-sm transition-all">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 mb-6 bg-emerald-950/50 border border-emerald-800 text-emerald-300 rounded-xl px-4 py-3 text-sm transition-all shadow-lg shadow-emerald-900/20">
            <Save className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">{success}</span>
          </div>
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
          {loading ? (
            <div className="flex items-center justify-center p-20">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mr-3" />
              <span className="text-gray-400">Cargando datos financieros...</span>
            </div>
          ) : data.length === 0 ? (
            <div className="text-center p-20 text-gray-500">
              No hay productos en el catálogo para costear.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-950/50">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Producto (SKU)</th>
                    <th className="px-4 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider w-36">Costo Base (S/)</th>
                    <th className="px-4 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider w-36">Precio Público (S/)</th>
                    <th className="px-4 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider w-32">Dscto. (%)</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right w-48">Margen de Ganancia</th>
                    <th className="px-6 py-4 w-28 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {data.map((item) => {
                    const precioFinal = item.precio_venta * (1 - (item.descuento_porcentaje / 100))
                    const margen = precioFinal - item.costo_unitario
                    const isProfitable = margen > 0

                    return (
                      <tr key={item.id_variante} className="hover:bg-gray-800/40 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-white font-medium text-sm leading-tight">{item.nombre}</span>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="bg-gray-800 text-indigo-300 px-1.5 py-0.5 rounded text-xs font-mono">{item.sku}</span>
                              {(item.talla || item.color) && (
                                <span className="text-gray-500 text-[10px] uppercase font-semibold">
                                  {item.talla ? `T:${item.talla} ` : ''} {item.color ? `C:${item.color}` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <input
                            type="number" step="0.01" min="0" value={item.costo_unitario}
                            onChange={(e) => handleInputChange(item.id_variante, 'costo_unitario', e.target.value)}
                            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <input
                            type="number" step="0.01" min="0" value={item.precio_venta}
                            onChange={(e) => handleInputChange(item.id_variante, 'precio_venta', e.target.value)}
                            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <input
                            type="number" step="0.1" min="0" max="100" value={item.descuento_porcentaje}
                            onChange={(e) => handleInputChange(item.id_variante, 'descuento_porcentaje', e.target.value)}
                            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono"
                          />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className={`flex items-center justify-end gap-2 font-bold text-base ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isProfitable ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            S/ {margen.toFixed(2)}
                          </div>
                          {item.descuento_porcentaje > 0 && (
                            <div className="text-[10px] text-gray-500 mt-1 uppercase font-semibold">
                              Precio Final: S/ {precioFinal.toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleSaveRow(item)}
                            disabled={savingRowId === item.id_variante}
                            className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${savingRowId === item.id_variante
                                ? 'bg-indigo-600/50 text-indigo-200'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 opacity-40 group-hover:opacity-100'
                              }`}
                            title="Guardar fila"
                          >
                            {savingRowId === item.id_variante ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
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
    </Layout>
  )
}

