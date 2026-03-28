import { useAuth } from '../context/AuthContext'
import { ShoppingCart, Search, CreditCard, LogOut } from 'lucide-react'

export default function TiendaPOS() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShoppingCart className="w-6 h-6 text-emerald-400" />
          <h1 className="text-lg font-bold">Punto de Venta (POS)</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{user?.email}</span>
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Salir
          </button>
        </div>
      </header>

      <main className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[
            { icon: Search, label: 'Buscar Producto', color: 'text-blue-400' },
            { icon: ShoppingCart, label: 'Carrito de Venta', color: 'text-emerald-400' },
            { icon: CreditCard, label: 'Procesar Pago', color: 'text-purple-400' },
          ].map(({ icon: Icon, label, color }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <Icon className={"w-8 h-8 mb-3 " + color} />
              <p className="font-semibold">{label}</p>
              <p className="text-gray-500 text-sm mt-1">Módulo en construcción...</p>
            </div>
          ))}
        </div>
        <div className="bg-gray-900 border border-dashed border-gray-700 rounded-2xl p-12 text-center">
          <p className="text-gray-500">Interfaz POS completa — próximamente</p>
        </div>
      </main>
    </div>
  )
}
