import { useAuth } from '../hooks/useAuth'
import { Navigate } from 'react-router-dom'

export default function PendingApproval() {
  const { user, profile, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-coral border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Si pas connecté, rediriger vers login
  if (!user) return <Navigate to="/login" replace />

  // Si admin, rediriger vers admin
  if (profile?.is_admin) {
    return <Navigate to="/admin" replace />
  }

  // Si déjà approuvé, rediriger vers le dashboard
  if (profile?.verif_status === 'approved') {
    return <Navigate to={profile.role === 'proprio' ? '/dashboard' : '/pro'} replace />
  }

  const isRejected = profile?.verif_status === 'rejected'

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 bg-gray-50">
      <div className="bg-white border border-gray-200 rounded-2xl p-10 w-full max-w-md shadow-md text-center page-enter">
        <div className="text-5xl mb-4">{isRejected ? '❌' : '⏳'}</div>
        <h1 className="text-xl font-800 text-gray-900 mb-2">
          {isRejected ? 'Compte refusé' : 'Compte en attente d\'approbation'}
        </h1>
        <p className="text-sm text-gray-400 mb-6 leading-relaxed">
          {isRejected
            ? 'Votre demande d\'inscription a été refusée par l\'administrateur. Contactez le support pour plus d\'informations.'
            : 'Votre compte a été créé avec succès. Un administrateur doit approuver votre inscription avant que vous puissiez accéder à la plateforme.'
          }
        </p>

        {!isRejected && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-xs text-amber-700 font-600">
              Vous recevrez un accès dès que l'administrateur aura validé votre compte.
              Revenez vérifier bientôt !
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="flex-1 py-3 rounded-xl font-700 text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
          >
            Vérifier mon statut
          </button>
          <button
            onClick={signOut}
            className="flex-1 py-3 rounded-xl font-700 text-sm bg-coral text-white hover:opacity-90 transition-all"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  )
}
