import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const ADMIN_EMAILS = ['ouellet.david@outlook.com']

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

  // Protection admin — seuls les emails autorisés peuvent accéder
  if (adminOnly && !ADMIN_EMAILS.includes(user.email?.toLowerCase())) {
    return <Navigate to={profile?.role === 'proprio' ? '/dashboard' : '/pro'} replace />
  }

  if (requiredRole && profile?.role !== requiredRole) {
    return <Navigate to={profile?.role === 'proprio' ? '/dashboard' : '/pro'} replace />
  }

  return children
}
