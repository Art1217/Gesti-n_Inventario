import { useState } from 'react'

const IGV_RATE = 0.18

/**
 * Shopping cart state and derived totals for the POS.
 *
 * Returns:
 *   carrito       – array of cart items
 *   agregar(item) – add a product variant (respects stock_exhibicion limit)
 *   cambiarCantidad(id, delta) – increment/decrement quantity
 *   quitar(id)    – remove item from cart
 *   vaciar()      – empty the cart
 *   subtotal, igv, total – computed totals (numbers, 2 decimals)
 *   totalItems    – sum of all quantities
 */
export function useCarrito() {
  const [carrito, setCarrito] = useState([])

  const agregar = (item) => {
    const precioFinal = parseFloat((item.precio_final || 0).toFixed(2))
    setCarrito(prev => {
      const existe = prev.find(c => c.id_variante === item.id_variante)
      if (existe) {
        if (existe.cantidad >= item.stock_exhibicion) return prev
        return prev.map(c =>
          c.id_variante === item.id_variante ? { ...c, cantidad: c.cantidad + 1 } : c
        )
      }
      if (item.stock_exhibicion <= 0) return prev
      return [...prev, {
        id_variante: item.id_variante,
        nombre:      item.productos?.nombre,
        sku:         item.sku,
        talla:       item.talla,
        color:       item.color,
        precio_final: precioFinal,
        stock_max:   item.stock_exhibicion,
        cantidad:    1,
      }]
    })
  }

  const cambiarCantidad = (id, delta) => {
    setCarrito(prev => prev.map(c =>
      c.id_variante === id
        ? { ...c, cantidad: Math.min(c.stock_max, Math.max(1, c.cantidad + delta)) }
        : c
    ))
  }

  const quitar = (id) => setCarrito(prev => prev.filter(c => c.id_variante !== id))

  const vaciar = () => setCarrito([])

  const subtotal   = parseFloat(carrito.reduce((s, c) => s + c.precio_final * c.cantidad, 0).toFixed(2))
  const igv        = parseFloat((subtotal * IGV_RATE).toFixed(2))
  const total      = parseFloat((subtotal + igv).toFixed(2))
  const totalItems = carrito.reduce((s, c) => s + c.cantidad, 0)

  return { carrito, agregar, cambiarCantidad, quitar, vaciar, subtotal, igv, total, totalItems }
}
