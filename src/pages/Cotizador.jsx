import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { buscarVariantesPOS } from '../services/productos.service'
import { consultarRUC, guardarCotizacion } from '../services/cotizaciones.service'
import { FileText, Search, Plus, Trash2, Loader2, AlertCircle, CheckCircle, Building2, X } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── Datos de tu empresa — edita aquí ──────────────────────────────
const EMPRESA = {
  nombre:    'INDUSTRIAS PERUANAS SAFETY WEAR SAC',
  ruc:       '20557566601',
  direccion: 'Apv. Los Huertos de Pro Mz.A Lte.20',
  telefono:  '+51994551864',
  email:     'ipersa_7@hotmail.com',
}
const IGV_RATE = 0.18
// ─────────────────────────────────────────────────────────────────

function generarPDF(cot, items, totales) {
  const doc = new jsPDF()
  const numCot = `COT-${String(cot.id).padStart(4, '0')}`
  const fecha  = new Date(cot.created_at).toLocaleDateString('es-PE', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  // ── Encabezado empresa ──
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text(EMPRESA.nombre, 14, 22)

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)
  doc.text(`RUC: ${EMPRESA.ruc}`, 14, 29)
  doc.text(EMPRESA.direccion, 14, 34)
  doc.text(`${EMPRESA.telefono}   ${EMPRESA.email}`, 14, 39)

  // ── Número de cotización ──
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(79, 70, 229)
  doc.text('COTIZACIÓN', 196, 22, { align: 'right' })
  doc.setFontSize(10)
  doc.setTextColor(30, 30, 30)
  doc.text(numCot, 196, 29, { align: 'right' })
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)
  doc.text(`Fecha: ${fecha}`, 196, 35, { align: 'right' })
  doc.text('Válida por 15 días', 196, 40, { align: 'right' })

  // ── Línea divisoria ──
  doc.setDrawColor(200, 200, 200)
  doc.line(14, 45, 196, 45)

  // ── Datos del cliente ──
  doc.setFillColor(248, 249, 255)
  doc.roundedRect(14, 49, 182, 30, 2, 2, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(79, 70, 229)
  doc.text('DATOS DEL CLIENTE', 19, 56)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(40, 40, 40)
  if (cot.cliente_ruc) {
    doc.text(`RUC: ${cot.cliente_ruc}`, 19, 63)
  }
  doc.setFont('helvetica', 'bold')
  doc.text(cot.cliente_razon_social, 19, cot.cliente_ruc ? 69 : 63)
  if (cot.cliente_direccion) {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100)
    doc.text(cot.cliente_direccion, 19, cot.cliente_ruc ? 75 : 69)
  }

  // ── Tabla de ítems ──
  autoTable(doc, {
    startY: 85,
    head: [['#', 'Producto / Variante', 'SKU', 'Cant.', 'Precio Unit. (S/)', 'Subtotal (S/)']],
    body: items.map((item, i) => {
      const variante = [
        item.talla ? `T:${item.talla}` : '',
        item.color ? `C:${item.color}` : '',
      ].filter(Boolean).join(' ')
      return [
        i + 1,
        variante ? `${item.nombre}\n${variante}` : item.nombre,
        item.sku ?? '—',
        item.cantidad,
        `S/ ${Number(item.precio_unitario).toFixed(2)}`,
        `S/ ${(Number(item.precio_unitario) * Number(item.cantidad)).toFixed(2)}`,
      ]
    }),
    styles: {
      fontSize: 8.5,
      cellPadding: 4,
      textColor: [40, 40, 40],
    },
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 10,  halign: 'center' },
      3: { cellWidth: 15,  halign: 'center' },
      4: { cellWidth: 35,  halign: 'right' },
      5: { cellWidth: 35,  halign: 'right' },
    },
  })

  const finalY = doc.lastAutoTable.finalY + 10

  // ── Cuadro de totales ──
  const boxX = 125
  doc.setFillColor(248, 249, 255)
  doc.roundedRect(boxX, finalY - 4, 71, 36, 2, 2, 'F')
  doc.setDrawColor(220, 220, 235)
  doc.roundedRect(boxX, finalY - 4, 71, 36, 2, 2, 'S')

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)
  doc.text('Subtotal:', boxX + 5, finalY + 4)
  doc.text(`S/ ${totales.subtotal.toFixed(2)}`, 193, finalY + 4, { align: 'right' })

  doc.text(`IGV (${(IGV_RATE * 100).toFixed(0)}%):`, boxX + 5, finalY + 12)
  doc.text(`S/ ${totales.igv.toFixed(2)}`, 193, finalY + 12, { align: 'right' })

  doc.setDrawColor(200, 200, 220)
  doc.line(boxX + 5, finalY + 15, 193, finalY + 15)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text('TOTAL:', boxX + 5, finalY + 24)
  doc.setTextColor(79, 70, 229)
  doc.text(`S/ ${totales.total.toFixed(2)}`, 193, finalY + 24, { align: 'right' })

  // ── Pie de página ──
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(160)
  doc.text('Este documento es una cotización y no constituye una factura.', 105, 285, { align: 'center' })

  doc.save(`${numCot}.pdf`)
}

export default function Cotizador() {
  const { user } = useAuth()

  // ── Cliente ──
  const [ruc, setRuc]               = useState('')
  const [clienteData, setClienteData] = useState(null)
  const [consultando, setConsultando] = useState(false)
  const [rucError, setRucError]       = useState(null)

  // ── Búsqueda de productos ──
  const [query, setQuery]           = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando]     = useState(false)

  // ── Ítems de cotización ──
  const [items, setItems] = useState([])

  // ── Modo manual ──
  const [modoManual, setModoManual]           = useState(false)
  const [manualRazonSocial, setManualRazonSocial] = useState('')
  const [manualDireccion, setManualDireccion]   = useState('')

  // ── Estado global ──
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)
  const [success, setSuccess]   = useState(null)

  // ── Sync modo manual → clienteData ──
  useEffect(() => {
    if (!modoManual) return
    if (manualRazonSocial.trim()) {
      setClienteData({
        razonSocial: manualRazonSocial.trim(),
        direccion:   manualDireccion.trim(),
        estado:      '',
        condicion:   '',
      })
    } else {
      setClienteData(null)
    }
  }, [modoManual, manualRazonSocial, manualDireccion])

  const toggleModo = () => {
    setModoManual(m => !m)
    setClienteData(null)
    setRucError(null)
    setRuc('')
    setManualRazonSocial('')
    setManualDireccion('')
  }

  // ── Búsqueda con debounce ──
  const buscar = useCallback(async (texto) => {
    if (!texto.trim()) { setResultados([]); return }
    setBuscando(true)
    try {
      const data = await buscarVariantesPOS(texto)
      setResultados(data)
    } catch (e) {
      console.error(e)
    } finally {
      setBuscando(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => buscar(query), 350)
    return () => clearTimeout(t)
  }, [query, buscar])

  // ── Consultar RUC ──
  const handleConsultarRUC = async () => {
    if (!/^\d{11}$/.test(ruc)) {
      setRucError('El RUC debe tener 11 dígitos.')
      return
    }
    setConsultando(true)
    setRucError(null)
    setClienteData(null)
    try {
      const data = await consultarRUC(ruc)
      setClienteData(data)
    } catch (err) {
      setRucError(err.message)
    } finally {
      setConsultando(false)
    }
  }

  // ── Agregar producto ──
  const agregarItem = (variante) => {
    setItems(prev => {
      const existe = prev.find(i => i.id_variante === variante.id_variante)
      if (existe) {
        return prev.map(i =>
          i.id_variante === variante.id_variante ? { ...i, cantidad: i.cantidad + 1 } : i
        )
      }
      return [...prev, {
        id_variante:    variante.id_variante,
        nombre:         variante.productos?.nombre ?? '',
        sku:            variante.sku,
        talla:          variante.talla,
        color:          variante.color,
        precio_unitario: parseFloat((variante.precio_final || 0).toFixed(2)),
        cantidad:        1,
      }]
    })
  }

  const updateItem = (id, field, raw) => {
    const value = field === 'cantidad'
      ? Math.max(1, parseInt(raw) || 1)
      : Math.max(0, parseFloat(raw) || 0)
    setItems(prev => prev.map(i => i.id_variante === id ? { ...i, [field]: value } : i))
  }

  const quitarItem = (id) => setItems(prev => prev.filter(i => i.id_variante !== id))

  // ── Totales ──
  const subtotal = parseFloat(items.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0).toFixed(2))
  const igv      = parseFloat((subtotal * IGV_RATE).toFixed(2))
  const total    = parseFloat((subtotal + igv).toFixed(2))

  const canSave = clienteData?.razonSocial && items.length > 0

  // ── Guardar + PDF ──
  const handleGuardarYPDF = async () => {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      const cot = await guardarCotizacion({
        cliente:   { ruc, ...clienteData },
        items,
        totales:   { subtotal, igv, total },
        idUsuario: user.id,
      })

      generarPDF(
        {
          ...cot,
          cliente_ruc:          ruc || null,
          cliente_razon_social: clienteData.razonSocial,
          cliente_direccion:    clienteData.direccion ?? null,
        },
        items,
        { subtotal, igv, total }
      )

      setSuccess(`Cotización ${`COT-${String(cot.id).padStart(4, '0')}`} guardada y PDF generado.`)
      setTimeout(() => setSuccess(null), 6000)

      // Resetear formulario
      setRuc('')
      setClienteData(null)
      setManualRazonSocial('')
      setManualDireccion('')
      setItems([])
      setQuery('')
      setResultados([])
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <FileText className="w-7 h-7 text-indigo-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Cotizador</h1>
            <p className="text-gray-500 text-sm">Genera cotizaciones con consulta SUNAT y exporta a PDF</p>
          </div>
        </div>

        {/* Alertas globales */}
        {error && (
          <div className="flex items-center gap-2 bg-red-950/50 border border-red-800 text-red-300 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 bg-emerald-950/50 border border-emerald-800 text-emerald-300 rounded-xl px-4 py-3 text-sm">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">{success}</span>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

          {/* ── Columna izquierda: Cliente + Búsqueda ── */}
          <div className="xl:col-span-2 space-y-5">

            {/* Sección Cliente */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-400" />
                  Datos del Cliente
                </h2>
                <button
                  onClick={toggleModo}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors underline underline-offset-2"
                >
                  {modoManual ? 'Consultar SUNAT' : 'Ingresar manualmente'}
                </button>
              </div>

              {modoManual ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={ruc}
                    onChange={e => setRuc(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    placeholder="RUC (opcional)"
                    className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <input
                    type="text"
                    value={manualRazonSocial}
                    onChange={e => setManualRazonSocial(e.target.value)}
                    placeholder="Razón Social *"
                    className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    type="text"
                    value={manualDireccion}
                    onChange={e => setManualDireccion(e.target.value)}
                    placeholder="Dirección (opcional)"
                    className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500"
                  />
                  {manualRazonSocial.trim() && (
                    <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-xl p-3 space-y-1 mt-1">
                      <p className="text-white font-semibold text-sm">{manualRazonSocial}</p>
                      {manualDireccion && <p className="text-gray-400 text-xs">{manualDireccion}</p>}
                      <span className="inline-block text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
                        Ingresado manualmente
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={ruc}
                      onChange={e => { setRuc(e.target.value.replace(/\D/g, '').slice(0, 11)); setRucError(null) }}
                      onKeyDown={e => e.key === 'Enter' && handleConsultarRUC()}
                      placeholder="RUC (11 dígitos)"
                      className="flex-1 px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500 font-mono"
                    />
                    <button
                      onClick={handleConsultarRUC}
                      disabled={consultando || ruc.length !== 11}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                    >
                      {consultando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      Consultar
                    </button>
                  </div>

                  {rucError && (
                    <p className="text-red-400 text-xs mb-3">{rucError}</p>
                  )}

                  {clienteData && (
                    <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-xl p-3 space-y-1">
                      <p className="text-white font-semibold text-sm">{clienteData.razonSocial}</p>
                      {clienteData.direccion && (
                        <p className="text-gray-400 text-xs">{clienteData.direccion}</p>
                      )}
                      {clienteData.estado && (
                        <span className={`inline-block text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                          clienteData.estado === 'ACTIVO' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {clienteData.estado} · {clienteData.condicion}
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Búsqueda de productos */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h2 className="text-white font-semibold flex items-center gap-2 mb-4">
                <Search className="w-4 h-4 text-indigo-400" />
                Agregar Productos
              </h2>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                {buscando && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 animate-spin" />}
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar por nombre o SKU..."
                  className="w-full pl-10 pr-10 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {resultados.length === 0 && query && !buscando && (
                  <p className="text-gray-600 text-xs text-center py-4">Sin resultados</p>
                )}
                {resultados.map(item => {
                  const sinStock = item.stock_exhibicion <= 0
                  return (
                    <div key={item.id_variante} className="flex items-center justify-between gap-2 bg-gray-800/50 border border-gray-700/50 rounded-xl px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium truncate">{item.productos?.nombre}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-indigo-400 font-mono text-[10px]">{item.sku}</span>
                          {(item.talla || item.color) && (
                            <span className="text-gray-500 text-[10px] uppercase">
                              {item.talla ? `T:${item.talla}` : ''}{item.color ? ` C:${item.color}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-emerald-400 text-xs font-bold font-mono">S/ {(item.precio_final || 0).toFixed(2)}</p>
                        <button
                          onClick={() => agregarItem(item)}
                          disabled={sinStock}
                          className="mt-1 flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-[10px] font-semibold rounded-lg transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          {sinStock ? 'Sin stock' : 'Agregar'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── Columna derecha: Tabla de ítems + Totales ── */}
          <div className="xl:col-span-3 space-y-5">

            {/* Tabla de ítems */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800">
                <h2 className="text-white font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  Detalle de Cotización
                  <span className="ml-auto text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-full font-bold">
                    {items.length} {items.length === 1 ? 'ítem' : 'ítems'}
                  </span>
                </h2>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-16 text-gray-600">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Agrega productos desde el panel izquierdo</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Producto</th>
                        <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-20 text-center">Cant.</th>
                        <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-28 text-right">Precio (S/)</th>
                        <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24 text-right">Subtotal</th>
                        <th className="px-3 py-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                      {items.map(item => (
                        <tr key={item.id_variante} className="hover:bg-gray-800/30 transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-white font-medium text-xs leading-tight">{item.nombre}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-indigo-400 font-mono text-[10px]">{item.sku}</span>
                              {(item.talla || item.color) && (
                                <span className="text-gray-500 text-[10px] uppercase">
                                  {item.talla ? `T:${item.talla}` : ''}{item.color ? ` C:${item.color}` : ''}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="number" min="1" value={item.cantidad}
                              onChange={e => updateItem(item.id_variante, 'cantidad', e.target.value)}
                              className="w-full text-center bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="number" min="0" step="0.01" value={item.precio_unitario}
                              onChange={e => updateItem(item.id_variante, 'precio_unitario', e.target.value)}
                              className="w-full text-right bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                            />
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className="text-emerald-400 font-bold text-xs font-mono">
                              S/ {(item.precio_unitario * item.cantidad).toFixed(2)}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <button
                              onClick={() => quitarItem(item.id_variante)}
                              className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Totales + Botón */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="space-y-2 mb-5">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>Subtotal</span>
                  <span className="font-mono">S/ {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-400">
                  <span>IGV (18%)</span>
                  <span className="font-mono">S/ {igv.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-white border-t border-gray-800 pt-2 mt-2">
                  <span>Total Final</span>
                  <span className="text-indigo-400 font-mono">S/ {total.toFixed(2)}</span>
                </div>
              </div>

              {!canSave && (
                <p className="text-gray-600 text-xs text-center mb-3">
                  {!clienteData?.razonSocial
                    ? (modoManual ? 'Ingresa la Razón Social del cliente.' : 'Consulta el RUC del cliente primero.')
                    : 'Agrega al menos un producto.'}
                </p>
              )}

              <button
                onClick={handleGuardarYPDF}
                disabled={!canSave || saving}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                {saving ? 'Generando...' : 'Guardar y Generar PDF'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
