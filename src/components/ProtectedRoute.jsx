import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ProtectedRoute({ children, requiredRole = null, adminOnly = false }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-coral border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  const isAdmin = profile?.is_admin === true

  // Protection admin — seuls les profils marqués is_admin peuvent accéder
  if (adminOnly && !isAdmin) {
    return <Navigate to={profile?.role === 'proprio' ? '/dashboard' : '/pro'} replace />
  }

  // Bloquer l'accès si le compte n'est pas approuvé par l'admin (sauf admin)
  if (!adminOnly && !isAdmin && profile?.verif_status !== 'approved') {
    return <Navigate to="/en-attente" replace />
  }

  if (requiredRole && profile?.role !== requiredRole) {
    return <Navigate to={profile?.role === 'proprio' ? '/dashboard' : '/pro'} replace />
  }

  return children
}
