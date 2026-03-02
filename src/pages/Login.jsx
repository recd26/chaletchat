import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { supabase } from '../lib/supabase'
import PasswordInput from '../components/PasswordInput'
import Toast from '../components/Toast'

export default function Login() {
  const { signIn } = useAuth()
  const { toasts, toast } = useToast()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [pw,    setPw]    = useState('')
  const [busy,  setBusy]  = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetBusy, setResetBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !pw) return toast('⚠️ Veuillez remplir tous les champs', 'error')
    setBusy(true)
    try {
      const { user } = await signIn({ email, password: pw })
      toast('✅ Connexion réussie !', 'success')
      setTimeout(() => navigate('/dashboard'), 800)
    } catch (err) {
      toast(`❌ ${err.message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/accueil` }
    })
    if (error) toast(`❌ ${error.message}`, 'error')
  }

  async function handleResetPassword(e) {
    e.preventDefault()
    if (!resetEmail.includes('@')) return toast('⚠️ Courriel invalide', 'error')
    setResetBusy(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/login`,
      })
      if (error) throw error
      setResetSent(true)
      toast('📧 Courriel de réinitialisation envoyé !', 'success')
    } catch (err) {
      toast(`❌ ${err.message}`, 'error')
    } finally {
      setResetBusy(false)
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

        {/* ── Mode réinitialisation ── */}
        {resetMode ? (
          <div>
            <h2 className="text-xl font-800 text-gray-900 mb-1">Mot de passe oublié</h2>
            <p className="text-sm text-gray-400 mb-6">
              Entrez votre courriel et nous vous enverrons un lien de réinitialisation.
            </p>

            {resetSent ? (
              <div className="text-center py-6">
                <div className="text-4xl mb-3">📧</div>
                <p className="font-700 text-gray-800 mb-2">Courriel envoyé !</p>
                <p className="text-sm text-gray-400 mb-5">
                  Vérifiez votre boîte de réception à <strong>{resetEmail}</strong>. Le lien expire dans 1 heure.
                </p>
                <button onClick={() => { setResetMode(false); setResetSent(false) }}
                  className="btn-primary w-full py-3">
                  ← Retour à la connexion
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword}>
                <div className="mb-4">
                  <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Adresse courriel</label>
                  <input
                    className="input-field"
                    type="email"
                    placeholder="votre@courriel.com"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    autoFocus
                  />
                </div>
                <button type="submit" disabled={resetBusy}
                  className="btn-primary w-full py-3 text-base disabled:opacity-60 mb-3">
                  {resetBusy ? '⏳ Envoi...' : '📧 Envoyer le lien'}
                </button>
                <button type="button" onClick={() => setResetMode(false)}
                  className="btn-secondary w-full py-2.5 text-sm">
                  ← Retour à la connexion
                </button>
              </form>
            )}
          </div>
        ) : (
          <>
            <h2 className="text-xl font-800 text-gray-900 mb-1">Connexion</h2>
            <p className="text-sm text-gray-400 mb-6">Accédez à votre espace ChaletProp.</p>

            {/* Social */}
            <div className="flex gap-3 mb-5">
              <button onClick={handleGoogleLogin}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm font-600 hover:border-gray-400 transition-all">
                🇬 Google
              </button>
              <button onClick={() => toast('🍎 Apple OAuth nécessite un Apple Developer Account — à configurer', 'info')}
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
                <button type="button" onClick={() => { setResetMode(true); setResetEmail(email) }}
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
          </>
        )}
      </div>
      <Toast toasts={toasts} />
    </div>
  )
}
