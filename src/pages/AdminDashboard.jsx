import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'
import { CheckCircle, XCircle, Eye } from 'lucide-react'
import { getIdDocSignedUrl } from '../lib/idDocs'

const ADMIN_EMAILS = ['ouellet.david@outlook.com']

// Résout un chemin de storage `id-documents` en URL signée (60 s) pour
// l'affichage. Les anciens enregistrements stockant une URL absolue sont
// renvoyés tels quels — cf. src/lib/idDocs.js.
function SignedDocImage({ path, alt, className, onClick }) {
  const [url, setUrl] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setUrl(null)
    setError(false)
    if (!path) return
    getIdDocSignedUrl(path)
      .then(resolved => {
        if (cancelled) return
        if (resolved) setUrl(resolved)
        else setError(true)
      })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [path])

  if (error) return <span className={`${className} bg-red-50 text-red-500 flex items-center justify-center text-[9px]`}>Erreur</span>
  if (!url) return <span className={`${className} bg-gray-100 animate-pulse`} />
  return <img src={url} alt={alt} className={className} onClick={onClick} />
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const { toasts, toast } = useToast()
  const [pros, setPros] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [viewDoc, setViewDoc] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const isAdmin = ADMIN_EMAILS.includes(user?.email?.toLowerCase())

  useEffect(() => {
    if (isAdmin) fetchPros()
  }, [isAdmin])

  async function fetchPros() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setPros(data || [])
    } catch (err) {
      toast(`❌ ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function updateVerifStatus(proId, status, reason = null) {
    if (busyId) return
    setBusyId(proId)
    try {
      const { error } = await supabase.rpc('admin_update_verif_status', {
        target_user_id: proId,
        new_status: status,
        reason,
      })
      if (error) throw error

      setPros(prev => prev.map(p => p.id === proId
        ? { ...p, verif_status: status, verif_rejection_reason: status === 'rejected' ? reason : null }
        : p
      ))
      const label = status === 'approved' ? 'approuvé' : status === 'rejected' ? 'refusé' : 'remis en attente'
      toast(`✅ Compte ${label}`, 'success')
    } catch (err) {
      toast(`❌ ${err.message || 'Erreur inconnue'}`, 'error')
    } finally {
      setBusyId(null)
    }
  }

  function handleReject(proId) {
    // Motif court demandé à l'admin — envoyé à l'utilisateur par email
    // via le trigger notify_verif_status_changed (P0-3).
    const reason = window.prompt(
      'Motif du refus (visible dans l\'email envoyé à l\'utilisateur) :',
      ''
    )
    if (reason === null) return // annulé
    const trimmed = reason.trim()
    if (!trimmed) {
      toast('⚠️ Motif requis pour refuser un compte', 'error')
      return
    }
    updateVerifStatus(proId, 'rejected', trimmed)
  }

  // Traiter null/undefined comme 'pending' (comptes créés avant P0-3).
  const getStatus = (p) => p.verif_status || 'pending'
  const filtered = filter === 'all' ? pros : pros.filter(p => getStatus(p) === filter)

  const counts = {
    all: pros.length,
    pending: pros.filter(p => getStatus(p) === 'pending').length,
    approved: pros.filter(p => getStatus(p) === 'approved').length,
    rejected: pros.filter(p => getStatus(p) === 'rejected').length,
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="card text-center py-12 px-8 max-w-sm">
          <p className="text-4xl mb-3">🔒</p>
          <h2 className="text-xl font-800 text-gray-900 mb-2">Accès refusé</h2>
          <p className="text-sm text-gray-400">Cette page est réservée aux administrateurs.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-9">
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-800 text-gray-900 tracking-tight">Panneau d'administration 🛡️</h1>
          <p className="text-sm text-gray-400 mt-1">Approbation des nouveaux comptes</p>
        </div>
        <button
          onClick={fetchPros}
          disabled={loading}
          className="text-xs font-700 bg-gray-100 text-gray-700 px-3 py-2 rounded-xl hover:bg-gray-200 transition-all disabled:opacity-50"
        >
          🔄 Rafraîchir
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { key: 'all', label: 'Total', color: 'text-gray-800', icon: '👥' },
          { key: 'pending', label: 'En attente', color: 'text-amber-600', icon: '⏳' },
          { key: 'approved', label: 'Approuvés', color: 'text-green-600', icon: '✅' },
          { key: 'rejected', label: 'Refusés', color: 'text-red-500', icon: '❌' },
        ].map(s => (
          <button key={s.key} onClick={() => setFilter(s.key)}
            className={`card text-center py-4 transition-all ${filter === s.key ? 'border-teal border-2' : ''}`}>
            <p className={`text-2xl font-800 ${s.color}`}>{counts[s.key]}</p>
            <p className="text-xs text-gray-400 mt-1">{s.icon} {s.label}</p>
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="text-center py-12 text-3xl">⏳</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-3xl mb-2">📋</p>
          <p className="font-700 text-gray-600">Aucun utilisateur dans cette catégorie</p>
        </div>
      ) : (
        filtered.map(pro => (
          <div key={pro.id} className={`card mb-4 ${
            getStatus(pro) === 'pending' ? 'border-amber-300 border' :
            getStatus(pro) === 'approved' ? 'border-green-300 border' :
            getStatus(pro) === 'rejected' ? 'border-red-300 border' : ''
          }`}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-700 text-gray-900 flex items-center gap-2">
                  {pro.first_name} {pro.last_name}
                  <span className={`text-[10px] font-700 px-2 py-0.5 rounded-full ${
                    pro.role === 'pro' ? 'bg-teal/10 text-teal border border-teal/20' : 'bg-coral/10 text-coral border border-coral/20'
                  }`}>
                    {pro.role === 'pro' ? '🧹 Pro' : '🏡 Proprio'}
                  </span>
                </h3>
                <p className="text-xs text-gray-400">
                  {pro.city || 'Ville inconnue'} • {pro.province || ''}{pro.role === 'pro' ? ` • Rayon ${pro.radius_km || 25} km` : ''}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  🆔 {pro.id.slice(0, 8)}… • 📱 {pro.phone || 'N/A'}
                </p>
              </div>
              <span className={`text-xs font-700 px-3 py-1.5 rounded-full ${
                getStatus(pro) === 'approved' ? 'bg-green-50 text-green-700 border border-green-200' :
                getStatus(pro) === 'rejected' ? 'bg-red-50 text-red-500 border border-red-200' :
                'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {getStatus(pro) === 'approved' ? '✅ Approuvé' :
                 getStatus(pro) === 'rejected' ? '❌ Refusé' : '⏳ En attente'}
              </span>
            </div>

            {/* Motif de refus */}
            {getStatus(pro) === 'rejected' && pro.verif_rejection_reason && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">
                <p className="text-xs text-red-600"><span className="font-700">Motif du refus :</span> {pro.verif_rejection_reason}</p>
              </div>
            )}

            {/* Infos pro (seulement pour les pros) */}
            {pro.role === 'pro' && (
              <div className="flex flex-wrap gap-2 text-xs mb-3">
                {pro.experience && <span className="bg-gray-50 text-gray-600 px-2 py-1 rounded-lg border border-gray-200">🕐 {pro.experience}</span>}
                {pro.languages && <span className="bg-gray-50 text-gray-600 px-2 py-1 rounded-lg border border-gray-200">🗣️ {Array.isArray(pro.languages) ? pro.languages.join(', ') : pro.languages}</span>}
                {pro.bio && <span className="bg-gray-50 text-gray-600 px-2 py-1 rounded-lg border border-gray-200 max-w-xs truncate">📝 {pro.bio}</span>}
              </div>
            )}

            {/* Infos proprio */}
            {pro.role === 'proprio' && (
              <div className="flex flex-wrap gap-2 text-xs mb-3">
                {pro.province && <span className="bg-gray-50 text-gray-600 px-2 py-1 rounded-lg border border-gray-200">📍 {pro.province}</span>}
                {pro.chalet_count && <span className="bg-gray-50 text-gray-600 px-2 py-1 rounded-lg border border-gray-200">🏡 {pro.chalet_count}</span>}
                {pro.location_type && <span className="bg-gray-50 text-gray-600 px-2 py-1 rounded-lg border border-gray-200">📋 {pro.location_type}</span>}
              </div>
            )}

            {/* Documents (seulement pour les pros) */}
            {pro.role === 'pro' && (
              <div className="flex gap-3 mb-3">
                {pro.selfie_url ? (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                    <SignedDocImage path={pro.selfie_url} alt="Selfie" className="w-10 h-10 rounded-lg object-cover border border-green-300" />
                    <div>
                      <p className="text-xs font-600 text-green-700">🤳 Selfie</p>
                      <button onClick={() => setViewDoc(pro.selfie_url)} className="text-xs text-teal font-600 hover:underline flex items-center gap-1">
                        <Eye size={10} /> Agrandir
                      </button>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs bg-red-50 text-red-500 border border-red-200 px-3 py-2 rounded-xl">🤳 Selfie manquant</span>
                )}

                {pro.id_card_url ? (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                    <SignedDocImage path={pro.id_card_url} alt="ID" className="w-10 h-10 rounded-lg object-cover border border-green-300" />
                    <div>
                      <p className="text-xs font-600 text-green-700">🪪 Pièce d'identité</p>
                      <button onClick={() => setViewDoc(pro.id_card_url)} className="text-xs text-teal font-600 hover:underline flex items-center gap-1">
                        <Eye size={10} /> Agrandir
                      </button>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs bg-red-50 text-red-500 border border-red-200 px-3 py-2 rounded-xl">🪪 ID manquante</span>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {getStatus(pro) !== 'approved' && (
                <button
                  onClick={() => updateVerifStatus(pro.id, 'approved')}
                  disabled={busyId === pro.id}
                  className="flex items-center gap-1.5 text-xs font-700 bg-green-500 text-white px-4 py-2 rounded-xl hover:bg-green-600 transition-all disabled:opacity-50"
                >
                  <CheckCircle size={14} /> Approuver
                </button>
              )}
              {getStatus(pro) !== 'rejected' && (
                <button
                  onClick={() => handleReject(pro.id)}
                  disabled={busyId === pro.id}
                  className="flex items-center gap-1.5 text-xs font-700 bg-red-500 text-white px-4 py-2 rounded-xl hover:bg-red-600 transition-all disabled:opacity-50"
                >
                  <XCircle size={14} /> Refuser
                </button>
              )}
              {getStatus(pro) !== 'pending' && (
                <button
                  onClick={() => updateVerifStatus(pro.id, 'pending')}
                  disabled={busyId === pro.id}
                  className="flex items-center gap-1.5 text-xs font-600 bg-gray-100 text-gray-500 px-4 py-2 rounded-xl hover:bg-gray-200 transition-all disabled:opacity-50"
                >
                  ↩️ Remettre en attente
                </button>
              )}
            </div>
          </div>
        ))
      )}

      {/* Modal document plein écran */}
      {viewDoc && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setViewDoc(null)}>
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setViewDoc(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-500 hover:text-gray-800 z-10">
              ✕
            </button>
            <SignedDocImage path={viewDoc} alt="Document" className="w-full rounded-2xl shadow-2xl" />
          </div>
        </div>
      )}

      <Toast toasts={toasts} />
    </div>
  )
}
