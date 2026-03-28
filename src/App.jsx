import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import AlmacenView from './pages/AlmacenView'
import TiendaPOS from './pages/TiendaPOS'

// Redirige segun el rol del usuario autenticado
function RoleRedirect() {
  const { userRole, isLoading } = useAuth()
  if (isLoading) return null
  if (!userRole) return <Navigate to="/login" replace />
  const routes = { ADMIN: '/admin', ALMACENERO: '/almacen', VENDEDOR: '/pos' }
  return <Navigate to={routes[userRole] ?? '/login'} replace />
}

export default function App() {
  return (
    <Routes>
      {/* Ruta publica */}
      <Route path="/login" element={<Login />} />

      {/* Redireccion raiz segun rol */}
      <Route path="/" element={<RoleRedirect />} />

      {/* Rutas protegidas por rol */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/almacen"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'ALMACENERO']}>
            <AlmacenView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pos"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'VENDEDOR']}>
            <TiendaPOS />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
