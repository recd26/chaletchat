import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { uploadIdDoc } from '../lib/idDocs'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'
import UploadBox from '../components/UploadBox'

const ADMIN_EMAILS = ['ouellet.david@outlook.com']

export default function PendingApproval() {
  const { user, profile, loading, signOut, updateProfile } = useAuth()
  const { toasts, toast } = useToast()

  // Documents en cours de sélection (avant le clic sur "Envoyer")
  const [selfieFile, setSelfieFile] = useState(null)
  const [idFile,     setIdFile]     = useState(null)
  const [uploading,  setUploading]  = useState(false)

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
  if (ADMIN_EMAILS.includes(user.email?.toLowerCase())) {
    return <Navigate to="/admin" replace />
  }

  // Si déjà approuvé, rediriger vers le dashboard
  if (profile?.verif_status === 'approved') {
    return <Navigate to={profile.role === 'proprio' ? '/dashboard' : '/pro'} replace />
  }

  const isRejected = profile?.verif_status === 'rejected'
  const isPro      = profile?.role === 'pro'

  // Pièce d'identité manquante (uniquement pertinent pour les pros) : on
  // guide l'utilisateur à téléverser depuis cette page — la session RLS
  // est garantie ici (auth.uid() défini), contrairement au signup où la
  // confirmation d'email peut la retarder.
  const needsIdUpload =
    isPro && !isRejected && (!profile?.selfie_url || !profile?.id_card_url)

  async function submitIdDocs() {
    if (uploading) return
    if (!selfieFile && !profile?.selfie_url) {
      toast('⚠️ Ajoutez un selfie avant de soumettre', 'error')
      return
    }
    if (!idFile && !profile?.id_card_url) {
      toast('⚠️ Ajoutez votre pièce d\'identité avant de soumettre', 'error')
      return
    }
    setUploading(true)
    try {
      const updates = {}
      if (selfieFile) {
        updates.selfie_url = await uploadIdDoc({
          userId: user.id, type: 'selfie', file: selfieFile,
        })
      }
      if (idFile) {
        updates.id_card_url = await uploadIdDoc({
          userId: user.id, type: 'id_card', file: idFile,
        })
      }
      // On garde verif_status='pending' (déjà en place) : l'admin voit
      // apparaître le compte dans sa file d'attente dès que les deux docs
      // sont uploadés (filtre côté AdminDashboard côté vue).
      if (Object.keys(updates).length > 0) {
        await updateProfile(updates)
      }
      toast('📤 Documents envoyés ! Réponse sous 24h par courriel.', 'success')
      setSelfieFile(null)
      setIdFile(null)
    } catch (err) {
      toast(`❌ ${err.message}`, 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-8 bg-gray-50">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 w-full max-w-md shadow-md text-center page-enter">
        <div className="text-5xl mb-4">{isRejected ? '❌' : needsIdUpload ? '🪪' : '⏳'}</div>
        <h1 className="text-xl font-800 text-gray-900 mb-2">
          {isRejected
            ? 'Compte refusé'
            : needsIdUpload
              ? 'Dernière étape : votre pièce d\'identité'
              : 'Compte en attente d\'approbation'}
        </h1>
        <p className="text-sm text-gray-400 mb-6 leading-relaxed">
          {isRejected
            ? 'Votre demande d\'inscription a été refusée par l\'administrateur. Contactez le support pour plus d\'informations.'
            : needsIdUpload
              ? 'Pour la sécurité des propriétaires, nous vérifions l\'identité de chaque pro. Documents chiffrés, jamais partagés.'
              : 'Votre compte a été créé avec succès. Un administrateur doit approuver votre inscription avant que vous puissiez accéder à la plateforme.'
          }
        </p>

        {isRejected && profile?.verif_rejection_reason && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-left">
            <p className="text-xs text-red-700 font-700 mb-1">Motif du refus :</p>
            <p className="text-sm text-red-600">{profile.verif_rejection_reason}</p>
          </div>
        )}

        {/* ── Uploader ID pour les pros dont les docs manquent ── */}
        {needsIdUpload && (
          <div className="text-left">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <UploadBox
                icon="🤳"
                title="Selfie"
                subtitle="Visage visible, bonne lumière"
                onFile={setSelfieFile}
                teal
              />
              <UploadBox
                icon="🪪"
                title="Pièce d'identité"
                subtitle="Passeport, permis ou carte"
                onFile={setIdFile}
                teal
              />
            </div>
            {(profile?.selfie_url || profile?.id_card_url) && (
              <p className="text-xs text-gray-400 mb-3">
                {profile.selfie_url && !selfieFile && '✅ Selfie déjà téléversé. '}
                {profile.id_card_url && !idFile && '✅ Pièce d\'identité déjà téléversée.'}
              </p>
            )}
            <p className="text-xs text-gray-400 mb-4">
              Formats : JPG, PNG, WEBP · Max 10 Mo · 🔐 Chiffrement AES-256
            </p>

            <div className="bg-gray-50 rounded-xl p-3 mb-4 text-xs text-gray-400">
              <p className="font-700 text-gray-700 mb-1">📋 Critères acceptés</p>
              <div className="grid grid-cols-2 gap-1">
                <span>✅ Document officiel gouvernemental</span><span>✅ Non expiré</span>
                <span>✅ 4 coins visibles</span><span>✅ Texte lisible</span>
              </div>
            </div>

            <button
              onClick={submitIdDocs}
              disabled={uploading || (!selfieFile && !idFile)}
              className="w-full py-3 rounded-xl font-700 text-sm bg-teal text-white hover:opacity-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed mb-3">
              {uploading ? 'Envoi...' : '📤 Envoyer pour vérification'}
            </button>
          </div>
        )}

        {!isRejected && !needsIdUpload && (
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
      <Toast toasts={toasts} />
    </div>
  )
}
