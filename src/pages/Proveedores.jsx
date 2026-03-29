import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabaseClient'
import { Plus, Pencil, Trash2, X, Loader2, Truck, AlertCircle } from 'lucide-react'

const EMPTY_FORM = { nombre: '', contacto: '', telefono: '' }

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
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

function InputField({ label, id, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>
      <input
        id={id}
        className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
        {...props}
      />
    </div>
  )
}

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm]           = useState(EMPTY_FORM)

  const fetchProveedores = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('proveedores')
        .select('*')
        .order('nombre')
      if (error) throw error
      setProveedores(data ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchProveedores() }, [fetchProveedores])

  const openCreate = () => { setForm(EMPTY_FORM); setEditingId(null); setModalOpen(true) }
  const openEdit   = (p)  => { setForm({ nombre: p.nombre, contacto: p.contacto ?? '', telefono: p.telefono ?? '' }); setEditingId(p.id); setModalOpen(true) }
  const closeModal = ()   => { setModalOpen(false); setEditingId(null); setForm(EMPTY_FORM) }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      let qError
      if (editingId) {
        const { error } = await supabase.from('proveedores').update(form).eq('id', editingId)
        qError = error
      } else {
        const { error } = await supabase.from('proveedores').insert(form)
        qError = error
      }
      if (qError) throw qError
      closeModal()
      fetchProveedores()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este proveedor? Esta acción no se puede deshacer.')) return
    setError(null)
    try {
      const { error } = await supabase.from('proveedores').delete().eq('id', id)
      if (error) throw error
      fetchProveedores()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Truck className="w-7 h-7 text-amber-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Proveedores</h1>
              <p className="text-gray-500 text-sm">{proveedores.length} proveedor{proveedores.length !== 1 ? 'es' : ''} registrado{proveedores.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo Proveedor
          </button>
        </div>

        {/* Error global */}
        {error && (
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
              <span className="text-gray-400 text-sm">Cargando proveedores...</span>
            </div>
          ) : proveedores.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No hay proveedores registrados.</p>
              <p className="text-xs mt-1">Haz clic en "Nuevo Proveedor" para agregar uno.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contacto</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Teléfono</th>
                  <th className="px-6 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {proveedores.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 text-white font-medium text-sm">{p.nombre}</td>
                    <td className="px-6 py-4 text-gray-400 text-sm">{p.contacto || <span className="text-gray-600">—</span>}</td>
                    <td className="px-6 py-4 text-gray-400 text-sm">{p.telefono || <span className="text-gray-600">—</span>}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-all"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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

      {/* Modal Crear / Editar */}
      {modalOpen && (
        <Modal title={editingId ? 'Editar Proveedor' : 'Nuevo Proveedor'} onClose={closeModal}>
          <form onSubmit={handleSave} className="space-y-4">
            <InputField label="Nombre *" id="nombre" name="nombre" required value={form.nombre} onChange={handleChange} placeholder="Ej: Distribuidora XYZ" />
            <InputField label="Contacto" id="contacto" name="contacto" value={form.contacto} onChange={handleChange} placeholder="Nombre de la persona de contacto" />
            <InputField label="Teléfono" id="telefono" name="telefono" value={form.telefono} onChange={handleChange} placeholder="Ej: +51 999 999 999" />

            {error && (
              <div className="text-red-300 text-sm bg-red-950/50 border border-red-800 rounded-xl px-3 py-2">{error}</div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={closeModal} className="flex-1 px-4 py-2.5 border border-gray-700 text-gray-300 hover:text-white rounded-xl text-sm transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-semibold rounded-xl text-sm transition-colors">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Crear Proveedor'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  )
}
