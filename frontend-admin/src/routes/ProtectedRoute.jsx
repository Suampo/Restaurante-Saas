// src/routes/ProtectedRoute.jsx
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthProvider'

export default function ProtectedRoute() {
  const { dbToken } = useAuth()
  const token = dbToken || (typeof window !== 'undefined' ? sessionStorage.getItem('dbToken') : null)
  const loc = useLocation()
  return token ? <Outlet /> : <Navigate to="/login" replace state={{ from: loc }} />
}
