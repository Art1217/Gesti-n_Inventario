import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import { getProductosConVariantes, crearProducto, actualizarProducto, toggleProductoActivo, upsertVariantes } from '../services/productos.service'
import { getProveedoresSimple } from '../services/proveedores.service'
import { Plus, Pencil, Trash2, RefreshCw, X, Loader2, BookOpen, AlertCircle, Search, Barcode as BarcodeIcon, Printer } from 'lucide-react'
import Barcode from 'react-barcode'

const EMPTY_FORM = { nombre: '', categoria: '', id_proveedor: '', variantes: [{ sku: '', talla: '', color: '' }] }

const CATEGORIAS = ['Electrónica', 'Ropa', 'Alimentos', 'Limpieza', 'Herramientas', 'Oficina', 'Otro']

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-white font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

function InputField({ label, id, children, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>
      {children ?? (
        <input
          id={id}
          className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
          {...props}
        />
      )}
    </div>
  )
}

export default function Catalogo() {
  const [productos, setProductos]     = useState([])
  const [proveedores, setProveedores] = useState([])
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState(null)
  const [modalOpen, setModalOpen]     = useState(false)
  const [editingId, setEditingId]     = useState(null)
  const [form, setForm]               = useState(EMPTY_FORM)
  const [search, setSearch]           = useState('')
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [barcodeProduct, setBarcodeProduct] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [prods, provs] = await Promise.all([
        getProductosConVariantes(mostrarInactivos),
        getProveedoresSimple(),
      ])
      setProductos(prods)
      setProveedores(provs)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [mostrarInactivos])

  useEffect(() => { fetchData() }, [fetchData])

  const openCreate = () => { setForm(EMPTY_FORM); setEditingId(null); setModalOpen(true) }
  const openEdit   = (p)  => {
    setForm({ 
      nombre: p.nombre ?? '', 
      categoria: p.categoria ?? '', 
      id_proveedor: p.id_proveedor ?? '',
      variantes: p.producto_variantes && p.producto_variantes.length > 0
        ? p.producto_variantes.map(v => ({ id: v.id, sku: v.sku, talla: v.talla ?? '', color: v.color ?? '' }))
        : [{ sku: '', talla: '', color: '' }]
    })
    setEditingId(p.id)
    setModalOpen(true)
  }
  const closeModal = () => { setModalOpen(false); setEditingId(null); setForm(EMPTY_FORM); setError(null) }

  const openBarcode = (varianteInfo) => setBarcodeProduct(varianteInfo)
  const closeBarcode = () => setBarcodeProduct(null)

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payloadProd = {
      nombre: form.nombre,
      categoria: form.categoria,
      id_proveedor: form.id_proveedor || null,
    }
    try {
      let prodId = editingId
      if (editingId) {
        await actualizarProducto(editingId, payloadProd)
      } else {
        const prod = await crearProducto(payloadProd)
        prodId = prod.id
      }

      const varPayload = form.variantes.map(v => {
        const res = { id_producto: prodId, sku: v.sku, talla: v.talla || null, color: v.color || null }
        if (v.id) res.id = v.id
        return res
      })
      await upsertVariantes(varPayload)

      closeModal()
      fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleVarChange = (index, field, value) => {
    setForm(prev => {
      const nw = [...prev.variantes]
      nw[index] = { ...nw[index], [field]: value }
      return { ...prev, variantes: nw }
    })
  }

  const addVariante = () => setForm(prev => ({ ...prev, variantes: [...prev.variantes, { sku: '', talla: '', color: '' }] }))
  const removeVariante = (index) => setForm(prev => ({ ...prev, variantes: prev.variantes.filter((_, i) => i !== index) }))

  const handleToggleActivo = async (id, currentActivo) => {
    const action = currentActivo ? 'desactivar' : 'reactivar'
    if (!window.confirm(`¿Estás seguro de que quieres ${action} este producto?`)) return
    setError(null)
    try {
      await toggleProductoActivo(id, currentActivo)
      fetchData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  // Filtro por nombre o SKU (client-side)
  const filteredProductos = productos.filter(p => {
    const q = search.toLowerCase()
    const matchesName = (p.nombre ?? '').toLowerCase().includes(q)
    const matchesSku = (p.producto_variantes ?? []).some(v => (v.sku ?? '').toLowerCase().includes(q))
    return matchesName || matchesSku
  })

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-indigo-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Catálogo Maestro</h1>
              <p className="text-gray-500 text-sm">{productos.length} producto{productos.length !== 1 ? 's' : ''} registrado{productos.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMostrarInactivos(!mostrarInactivos)}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-xl transition-colors ${
                mostrarInactivos 
                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' 
                  : 'text-gray-400 hover:text-white border border-gray-700 hover:bg-gray-800'
              }`}
            >
              Inactivos: {mostrarInactivos ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nuevo Producto
            </button>
          </div>
        </div>

        {/* Barra de búsqueda */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nombre o SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
          />
        </div>

        {/* Error */}
        {error && !modalOpen && (
          <div className="flex items-center gap-2 mb-6 bg-red-950/50 border border-red-800 text-red-300 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Tabla */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mr-2" />
              <span className="text-gray-400 text-sm">Cargando catálogo...</span>
            </div>
          ) : filteredProductos.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{search ? 'Sin resultados para tu búsqueda.' : 'No hay productos registrados.'}</p>
              {!search && <p className="text-xs mt-1">Haz clic en "Nuevo Producto" para agregar uno.</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">SKU</th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Categoría</th>
                    <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Proveedor</th>
                    <th className="px-6 py-3.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {filteredProductos.map((p) => (
                    <tr key={p.id} className={`hover:bg-gray-800/30 transition-colors ${p.activo === false ? 'opacity-50 grayscale' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2">
                          {(p.producto_variantes || []).length === 0 ? <span className="text-gray-500 text-xs">—</span> : null}
                          {(p.producto_variantes || []).map(v => (
                            <div key={v.id} className="flex items-center gap-2 bg-gray-800 text-indigo-300 pl-3 pr-2 py-1.5 rounded-lg border border-gray-700/50 w-max">
                              <div>
                                <span className="font-mono font-bold tracking-wide block leading-tight">{v.sku}</span>
                                {(v.talla || v.color) && (
                                  <span className="text-[10px] text-gray-400 uppercase block mb-0.5">
                                    {v.talla ? `T:${v.talla} ` : ''} {v.color ? `C:${v.color}` : ''}
                                  </span>
                                )}
                              </div>
                              <button onClick={() => openBarcode({ sku: v.sku, nombre: `${p.nombre} ${v.talla||''} ${v.color||''}`.trim() })} className="ml-1 p-1 text-gray-500 hover:text-emerald-400 hover:bg-emerald-400/10 rounded transition-all" title="Ver Código de Barras">
                                <BarcodeIcon className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-white font-medium text-sm align-top pt-5">{p.nombre}</td>
                      <td className="px-6 py-4 align-top pt-5">
                        {p.categoria
                          ? <span className="text-xs bg-gray-800 text-gray-300 px-2.5 py-1 rounded-full border border-gray-700">{p.categoria}</span>
                          : <span className="text-gray-600">—</span>
                        }
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-sm align-top pt-5">{p.proveedores?.nombre || <span className="text-gray-600">—</span>}</td>
                      <td className="px-6 py-4 align-top pt-4">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEdit(p)} className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-all" title="Editar">
                            <Pencil className="w-4 h-4" />
                          </button>
                          {p.activo !== false ? (
                            <button onClick={() => handleToggleActivo(p.id, true)} className="p-1.5 text-gray-500 hover:text-amber-400 hover:bg-amber-400/10 rounded-lg transition-all" title="Desactivar">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <button onClick={() => handleToggleActivo(p.id, false)} className="p-1.5 text-gray-500 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-all" title="Reactivar">
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <Modal title={editingId ? 'Editar Producto' : 'Nuevo Producto'} onClose={closeModal}>
          <form onSubmit={handleSave} className="space-y-4">
            <InputField label="Nombre de Producto *" id="nombre" name="nombre" required value={form.nombre} onChange={handleChange} placeholder="Ej: Camisa Clásica" />

            <div className="grid grid-cols-2 gap-4">
              <InputField label="Categoría" id="categoria">
                <select
                  id="categoria"
                  name="categoria"
                  value={form.categoria}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                >
                  <option value="">Sin categoría</option>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </InputField>

              <InputField label="Proveedor" id="id_proveedor">
                <select
                  id="id_proveedor"
                  name="id_proveedor"
                  value={form.id_proveedor}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                >
                  <option value="">Sin proveedor</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </InputField>
            </div>

            {/* Variantes */}
            <div className="space-y-3 pt-2 bg-gray-900/50 -mx-6 px-6 py-4 border-y border-gray-800">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-300">Variantes (SKUs)</label>
                <button type="button" onClick={addVariante} className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium bg-indigo-500/10 px-2 py-1 rounded transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Añadir
                </button>
              </div>
              
              <div className="space-y-3 max-h-[35vh] overflow-y-auto pr-1 custom-scrollbar">
                {form.variantes.map((v, idx) => (
                  <div key={idx} className="flex items-start gap-3 bg-gray-800 p-3.5 rounded-xl border border-gray-700">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="text-[10px] text-gray-500 uppercase font-semibold tracking-wider mb-1 block">SKU *</label>
                        <input required placeholder="Ej: CAM-M-ROJ" className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm font-mono focus:ring-1 focus:ring-indigo-500" value={v.sku} onChange={e => handleVarChange(idx, 'sku', e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase font-semibold tracking-wider mb-1 block">Talla</label>
                        <input placeholder="Ej: M" className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-indigo-500" value={v.talla} onChange={e => handleVarChange(idx, 'talla', e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase font-semibold tracking-wider mb-1 block">Color</label>
                        <input placeholder="Ej: Rojo" className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-indigo-500" value={v.color} onChange={e => handleVarChange(idx, 'color', e.target.value)} />
                      </div>
                    </div>
                    {form.variantes.length > 1 && (
                      <button type="button" onClick={() => removeVariante(idx)} className="text-gray-500 hover:text-red-400 p-1 mt-6 transition-colors">
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="text-red-300 text-sm bg-red-950/50 border border-red-800 rounded-xl px-3 py-2">{error}</div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={closeModal} className="flex-1 px-4 py-2.5 border border-gray-700 text-gray-300 hover:text-white rounded-xl text-sm transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-semibold rounded-xl text-sm transition-colors">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Crear Producto'}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {/* Modal Barcode */}
      {barcodeProduct && (
        <Modal title="Código de Barras" onClose={closeBarcode}>
          <div className="flex flex-col items-center justify-center space-y-6">
            <div id="print-barcode-area" className="bg-white px-8 py-6 rounded-2xl">
              <Barcode value={barcodeProduct.sku} width={2} height={80} displayValue={true} />
            </div>
            <p className="text-gray-400 text-sm text-center">
              Producto: <span className="text-white font-semibold">{barcodeProduct.nombre}</span>
            </p>
            <button
              onClick={() => {
                const printContent = document.getElementById('print-barcode-area').innerHTML;
                const originalContents = document.body.innerHTML;
                document.body.innerHTML = `<div style="display:flex;justify-content:center;align-items:center;height:100vh;">${printContent}</div>`;
                window.print();
                document.body.innerHTML = originalContents;
                window.location.reload(); // Recargar para restaurar los listeners de React completos
              }}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-colors"
            >
              <Printer className="w-4 h-4" />
              Imprimir Código
            </button>
          </div>
        </Modal>
      )}
    </Layout>
  )
}
