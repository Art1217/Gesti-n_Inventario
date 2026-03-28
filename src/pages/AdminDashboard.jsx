import { useAuth } from '../context/AuthContext'
import { ShieldCheck, Users, Package, BarChart3, LogOut } from 'lucide-react'

export default function AdminDashboard() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-indigo-400" />
          <h1 className="text-lg font-bold">Panel de Administrador</h1>
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

      {/* Content placeholder */}
      <main className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[
            { icon: Users, label: 'Usuarios', value: '—', color: 'text-blue-400' },
            { icon: Package, label: 'Productos', value: '—', color: 'text-green-400' },
            { icon: BarChart3, label: 'Movimientos', value: '—', color: 'text-purple-400' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <Icon className={"w-5 h-5 " + color} />
                <span className="text-gray-400 text-sm">{label}</span>
              </div>
              <p className="text-3xl font-bold">{value}</p>
            </div>
          ))}
        </div>
        <div className="bg-gray-900 border border-dashed border-gray-700 rounded-2xl p-12 text-center">
          <p className="text-gray-500">Módulos del Admin en construcción...</p>
        </div>
      </main>
    </div>
  )
}
