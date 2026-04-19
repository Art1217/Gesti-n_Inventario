import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import { getStockTienda } from '../services/inventario.service'
import { Store, Search, Loader2, AlertTriangle, PackageX } from 'lucide-react'

function stockBadge(stock) {
  if (stock === 0)  return { cls: 'bg-red-500/10 text-red-400 border-red-500/20',    label: 'Sin stock' }
  if (stock <= 3)   return { cls: 'bg-red-500/10 text-red-400 border-red-500/20',    label: `${stock} unid.` }
  if (stock <= 8)   return { cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: `${stock} unid.` }
  return                  { cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: `${stock} unid.` }
}

export default function StockTienda() {
  const [stock, setStock]     = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [error, setError]     = useState(null)

  const fetchStock = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getStockTienda()
      setStock(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStock() }, [fetchStock])

  const filtered = stock.filter(item => {
    const q = search.toLowerCase()
    return !q
      || item.producto_variantes?.productos?.nombre?.toLowerCase().includes(q)
      || item.producto_variantes?.sku?.toLowerCase().includes(q)
  })

  const sinStock  = stock.filter(i => i.stock_exhibicion === 0).length
  const stockBajo = stock.filter(i => i.stock_exhibicion > 0 && i.stock_exhibicion <= 8).length

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Store className="w-7 h-7 text-emerald-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Stock de Tienda</h1>
            <p className="text-gray-500 text-sm">Consulta de disponibilidad de productos en exhibición</p>
          </div>
        </div>

        {/* Alertas de stock */}
        {!loading && (sinStock > 0 || stockBajo > 0) && (
          <div className="flex flex-col sm:flex-row gap-3">
            {sinStock > 0 && (
              <div className="flex items-center gap-2 bg-red-950/40 border border-red-800/50 text-red-300 rounded-xl px-4 py-3 text-sm flex-1">
                <PackageX className="w-4 h-4 flex-shrink-0" />
                <span><span className="font-bold">{sinStock}</span> producto{sinStock > 1 ? 's' : ''} sin stock</span>
              </div>
            )}
            {stockBajo > 0 && (
              <div className="flex items-center gap-2 bg-amber-950/40 border border-amber-800/50 text-amber-300 rounded-xl px-4 py-3 text-sm flex-1">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span><span className="font-bold">{stockBajo}</span> producto{stockBajo > 1 ? 's' : ''} con stock bajo</span>
              </div>
            )}
          </div>
        )}

        {/* Buscador */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o SKU..."
            className="w-full sm:w-80 pl-10 pr-3 py-2.5 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Tabla */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-600">
              <Store className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">{search ? `Sin resultados para "${search}"` : 'No hay productos registrados'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Producto</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">SKU</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Stock</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Precio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {filtered.map((item, i) => {
                    const v     = item.producto_variantes
                    const badge = stockBadge(item.stock_exhibicion ?? 0)
                    return (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-5 py-3">
                          <p className="text-white font-medium text-xs leading-tight">{v?.productos?.nombre}</p>
                          {(v?.talla || v?.color) && (
                            <p className="text-gray-500 text-[10px] uppercase mt-0.5">
                              {v.talla ? `T:${v.talla}` : ''}{v.color ? ` C:${v.color}` : ''}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-indigo-400 font-mono text-xs">{v?.sku}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-gray-300 font-mono text-xs">
                            S/ {Number(item.precio_venta ?? 0).toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && stock.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-800 flex items-center justify-between">
              <span className="text-xs text-gray-500">{filtered.length} de {stock.length} productos</span>
              <button
                onClick={fetchStock}
                className="text-xs text-gray-500 hover:text-white transition-colors"
              >
                Actualizar
              </button>
            </div>
          )}
        </div>

      </div>
    </Layout>
  )
}
