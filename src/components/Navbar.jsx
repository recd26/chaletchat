import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { LogOut, Home } from 'lucide-react'
import NotificationBell from './NotificationBell'

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="text-2xl font-extrabold tracking-tight">
          <span className="text-coral">Chalet</span>
          <span className="text-teal">Prop</span>
        </Link>

        {/* Nav droite */}
        {user && profile ? (
          <div className="flex items-center gap-4">
            {/* Liens selon rôle */}
            {profile.role === 'proprio' && (
              <Link to="/dashboard" className="text-sm font-600 text-gray-600 hover:text-coral transition-colors">
                Tableau de bord
              </Link>
            )}
            {profile.role === 'pro' && (
              <Link to="/pro" className="text-sm font-600 text-gray-600 hover:text-teal transition-colors">
                Mes demandes
              </Link>
            )}
            <Link to="/paiement" className="text-sm font-600 text-gray-600 hover:text-gray-900 transition-colors">
              Paiement
            </Link>

            <NotificationBell />

            {/* Avatar + nom */}
            <div className="flex items-center gap-2">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg font-bold ${
                profile.role === 'proprio'
                  ? 'bg-gradient-to-br from-coral-light to-amber-300'
                  : 'bg-gradient-to-br from-teal to-teal-light'
              }`}>
                {profile.role === 'proprio' ? '🏡' : '🧹'}
              </div>
              <span className="text-sm font-700 text-gray-800 hidden sm:block">
                {profile.first_name}
              </span>
            </div>

            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-xs font-600 text-gray-400 border border-gray-200 rounded-full px-3 py-1.5 hover:border-coral hover:text-coral transition-all"
            >
              <LogOut size={12} />
              Déconnexion
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link to="/login" className="text-sm font-600 text-gray-600 border border-gray-200 rounded-full px-4 py-2 hover:border-gray-400 transition-all">
              Connexion
            </Link>
            <Link to="/inscription" className="text-sm font-700 text-white bg-coral rounded-full px-4 py-2 shadow-sm hover:bg-coral-dark transition-all">
              S'inscrire — gratuit
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}
