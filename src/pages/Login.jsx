import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import PasswordInput from '../components/PasswordInput'
import Toast from '../components/Toast'

export default function Login() {
  const { signIn } = useAuth()
  const { toasts, toast } = useToast()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [pw,    setPw]    = useState('')
  const [busy,  setBusy]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !pw) return toast('⚠️ Veuillez remplir tous les champs', 'error')
    setBusy(true)
    try {
      const { user } = await signIn({ email, password: pw })
      toast('✅ Connexion réussie !', 'success')
      // Redirection selon le rôle (géré dans App.jsx via le profil)
      setTimeout(() => navigate('/dashboard'), 800)
    } catch (err) {
      toast(`❌ ${err.message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center py-12 px-4 bg-gray-50">
      <div className="bg-white border border-gray-200 rounded-2xl p-10 w-full max-w-md shadow-md page-enter">

        <div className="text-center mb-8">
          <div className="text-2xl font-800 mb-1">
            <span className="text-coral">Chalet</span><span className="text-teal">Prop</span>
          </div>
          <p className="text-sm text-gray-400">Bon retour parmi nous ! 👋</p>
        </div>

        <h2 className="text-xl font-800 text-gray-900 mb-1">Connexion</h2>
        <p className="text-sm text-gray-400 mb-6">Accédez à votre espace ChaletProp.</p>

        {/* Social */}
        <div className="flex gap-3 mb-5">
          <button onClick={() => toast('🔗 Configurez Google OAuth dans Supabase Dashboard → Auth', 'info')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm font-600 hover:border-gray-400 transition-all">
            🇬 Google
          </button>
          <button onClick={() => toast('🍎 Configurez Apple OAuth dans Supabase Dashboard → Auth', 'info')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm font-600 hover:border-gray-400 transition-all">
            🍎 Apple
          </button>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <hr className="flex-1 border-gray-200"/><span className="text-xs text-gray-400">ou avec votre courriel</span><hr className="flex-1 border-gray-200"/>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Adresse courriel</label>
            <input
              className="input-field"
              type="email"
              placeholder="votre@courriel.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="mb-2">
            <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Mot de passe</label>
            <PasswordInput value={pw} onChange={setPw} />
          </div>

          <div className="text-right mb-5">
            <button type="button" onClick={() => toast('📧 Fonctionnalité de réinitialisation à implémenter avec supabase.auth.resetPasswordForEmail()', 'info')}
              className="text-xs text-coral font-600 hover:underline">
              Mot de passe oublié ?
            </button>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full py-3 text-base disabled:opacity-60"
          >
            {busy ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-5">
          Pas encore de compte ?{' '}
          <Link to="/inscription" className="text-coral font-700">S'inscrire gratuitement</Link>
        </p>
      </div>
      <Toast toasts={toasts} />
    </div>
  )
}
