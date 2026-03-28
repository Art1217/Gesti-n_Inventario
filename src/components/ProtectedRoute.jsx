import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Envuelve rutas protegidas.
 * Props:
 *   - children: componente a renderizar si el acceso es permitido
 *   - allowedRoles: array de strings, ej. ['ADMIN', 'ALMACENERO']
 *                   Si es vacio o undefined, solo verifica que haya sesion activa
 */
export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { session, userRole, isLoading, loadingRole } = useAuth()
  const location = useLocation()

  // Esperando sesion inicial de Supabase
  if (isLoading || loadingRole) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Verificando acceso...</p>
        </div>
      </div>
    )
  }

  // No autenticado -> redirigir al login
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Rol no permitido -> pagina de no autorizado
  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-6xl mb-4">🚫</p>
          <h1 className="text-2xl font-bold text-white mb-2">Acceso No Autorizado</h1>
          <p className="text-gray-400 text-sm">
            Tu rol <span className="text-indigo-400 font-semibold">{userRole}</span> no tiene permisos para esta sección.
          </p>
        </div>
      </div>
    )
  }

  return children
}
