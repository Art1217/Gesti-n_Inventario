import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Package2, LayoutDashboard, Truck, BookOpen,
  ShoppingCart, LogOut, ChevronRight, Calculator
} from 'lucide-react'

const NAV_ADMIN_ALMACENERO = [
  { to: '/admin',       icon: LayoutDashboard, label: 'Dashboard',   roles: ['ADMIN'] },
  { to: '/admin/finanzas', icon: Calculator,   label: 'Finanzas y Costos', roles: ['ADMIN'] },
  { to: '/almacen',     icon: LayoutDashboard, label: 'Inicio',      roles: ['ALMACENERO'] },
  { to: '/proveedores', icon: Truck,           label: 'Proveedores', roles: ['ADMIN', 'ALMACENERO'] },
  { to: '/catalogo',    icon: BookOpen,        label: 'Catálogo',    roles: ['ADMIN', 'ALMACENERO'] },
]

const NAV_VENDEDOR = [
  { to: '/pos', icon: ShoppingCart, label: 'Punto de Venta', roles: ['ADMIN', 'VENDEDOR'] },
]

export default function Sidebar() {
  const { userRole, user, signOut } = useAuth()
  const navigate = useNavigate()

  const navItems = userRole === 'VENDEDOR'
    ? NAV_VENDEDOR
    : NAV_ADMIN_ALMACENERO.filter(item => item.roles.includes(userRole))

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const roleColors = {
    ADMIN: 'bg-indigo-600/20 text-indigo-300 border-indigo-600/30',
    ALMACENERO: 'bg-amber-600/20 text-amber-300 border-amber-600/30',
    VENDEDOR: 'bg-emerald-600/20 text-emerald-300 border-emerald-600/30',
  }

  return (
    <aside className="w-64 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
            <Package2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Inventario</p>
            <p className="text-gray-500 text-xs">Sistema Dual</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                isActive
                  ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-600/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-indigo-400' : 'text-gray-500 group-hover:text-gray-300'}`} />
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight className="w-3 h-3 text-indigo-400" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="px-3 pb-4 space-y-2">
        {/* Role badge */}
        <div className={`mx-1 px-3 py-2 rounded-xl border text-xs font-semibold text-center ${roleColors[userRole] ?? ''}`}>
          {userRole}
        </div>
        {/* Email */}
        <div className="px-3 py-2 bg-gray-800/60 rounded-xl">
          <p className="text-gray-500 text-xs truncate">{user?.email}</p>
        </div>
        {/* Logout */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:text-red-400 hover:bg-red-900/10 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  )
}
