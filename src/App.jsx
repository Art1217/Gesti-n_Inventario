import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import AdminFinanzas from './pages/AdminFinanzas'
import AlmacenView from './pages/AlmacenView'
import Transferencias from './pages/Transferencias'
import TiendaPOS from './pages/TiendaPOS'
import Proveedores from './pages/Proveedores'
import Catalogo from './pages/Catalogo'
import Cotizador from './pages/Cotizador'
import OrdenesCompra from './pages/OrdenesCompra'
import StockTienda from './pages/StockTienda'

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
      {/* Pública */}
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RoleRedirect />} />

      {/* Solo ADMIN */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['ADMIN']}><AdminDashboard /></ProtectedRoute>
      } />
      <Route path="/admin/finanzas" element={
        <ProtectedRoute allowedRoles={['ADMIN']}><AdminFinanzas /></ProtectedRoute>
      } />
      <Route path="/admin/cotizaciones" element={
        <ProtectedRoute allowedRoles={['ADMIN']}><Cotizador /></ProtectedRoute>
      } />
      <Route path="/admin/ordenes" element={
        <ProtectedRoute allowedRoles={['ADMIN']}><OrdenesCompra /></ProtectedRoute>
      } />

      {/* ADMIN + ALMACENERO */}
      <Route path="/almacen" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'ALMACENERO']}><AlmacenView /></ProtectedRoute>
      } />
      <Route path="/transferencias" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'ALMACENERO']}><Transferencias /></ProtectedRoute>
      } />
      <Route path="/proveedores" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'ALMACENERO']}><Proveedores /></ProtectedRoute>
      } />
      <Route path="/catalogo" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'ALMACENERO']}><Catalogo /></ProtectedRoute>
      } />

      {/* ADMIN + VENDEDOR */}
      <Route path="/pos" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'VENDEDOR']}><TiendaPOS /></ProtectedRoute>
      } />
      <Route path="/stock-tienda" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'VENDEDOR']}><StockTienda /></ProtectedRoute>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
