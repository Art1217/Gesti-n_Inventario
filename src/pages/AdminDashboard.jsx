import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { ShieldCheck, Users, Package, BarChart3 } from 'lucide-react'

export default function AdminDashboard() {
  const { user } = useAuth()

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <ShieldCheck className="w-7 h-7 text-indigo-400" />
            <h1 className="text-2xl font-bold text-white">Panel Administrador</h1>
          </div>
          <p className="text-gray-500 text-sm ml-10">Bienvenido, {user?.email}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[
            { icon: Users, label: 'Usuarios activos', value: '—', color: 'text-blue-400', bg: 'bg-blue-400/10' },
            { icon: Package, label: 'Productos en catálogo', value: '—', color: 'text-green-400', bg: 'bg-green-400/10' },
            { icon: BarChart3, label: 'Movimientos hoy', value: '—', color: 'text-purple-400', bg: 'bg-purple-400/10' },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <div className={"w-10 h-10 rounded-xl flex items-center justify-center mb-4 " + bg}>
                <Icon className={"w-5 h-5 " + color} />
              </div>
              <p className="text-3xl font-bold text-white mb-1">{value}</p>
              <p className="text-gray-500 text-sm">{label}</p>
            </div>
          ))}
        </div>

        <div className="bg-gray-900 border border-dashed border-gray-700 rounded-2xl p-12 text-center">
          <p className="text-gray-500 text-sm">Panel completo del Admin — próximamente en los siguientes sprints.</p>
        </div>
      </div>
    </Layout>
  )
}
