import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { Warehouse, ArrowDownToLine, MoveRight } from 'lucide-react'

export default function AlmacenView() {
  const { user } = useAuth()

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Warehouse className="w-7 h-7 text-amber-400" />
            <h1 className="text-2xl font-bold text-white">Gestión de Almacén</h1>
          </div>
          <p className="text-gray-500 text-sm ml-10">Bienvenido, {user?.email}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {[
            { icon: ArrowDownToLine, label: 'Ingresar Stock al Almacén', desc: 'Registrar nuevas entradas de mercadería', color: 'text-amber-400', bg: 'bg-amber-400/10' },
            { icon: MoveRight, label: 'Trasladar a Tienda', desc: 'Mover stock del almacén a exhibición', color: 'text-green-400', bg: 'bg-green-400/10' },
          ].map(({ icon: Icon, label, desc, color, bg }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 cursor-pointer hover:border-amber-600/50 transition-colors group">
              <div className={"w-10 h-10 rounded-xl flex items-center justify-center mb-4 " + bg}>
                <Icon className={"w-5 h-5 " + color} />
              </div>
              <p className="text-white font-semibold mb-1">{label}</p>
              <p className="text-gray-500 text-sm">{desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-gray-900 border border-dashed border-gray-700 rounded-2xl p-12 text-center">
          <p className="text-gray-500 text-sm">Módulo de inventario del almacén — próximo sprint.</p>
        </div>
      </div>
    </Layout>
  )
}
