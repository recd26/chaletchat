import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'
import { Star, CheckCircle, XCircle, Eye } from 'lucide-react'

const ADMIN_EMAILS = ['ouellet.david@outlook.com']

export default function AdminDashboard() {
  const { user, profile } = useAuth()
  const { toasts, toast } = useToast()
  const [pros, setPros] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending') // 'all' | 'pending' | 'approved' | 'rejected'
  const [viewDoc, setViewDoc] = useState(null) // url du document à afficher

  // Double sécurité — vérifier l'email même si ProtectedRoute le fait
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
        .eq('role', 'pro')
        .order('created_at', { ascending: false })
      if (error) throw error
      setPros(data || [])
    } catch (err) {
      toast(`❌ ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function updateVerifStatus(proId, status) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ verif_status: status })
        .eq('id', proId)
      if (error) throw error
      setPros(prev => prev.map(p => p.id === proId ? { ...p, verif_status: status } : p))
      toast(`✅ Statut mis à jour : ${status}`, 'success')
    } catch (err) {
      toast(`❌ ${err.message}`, 'error')
    }
  }

  const filtered = filter === 'all' ? pros : pros.filter(p => p.verif_status === filter)

  const counts = {
    all: pros.length,
    pending: pros.filter(p => p.verif_status === 'pending').length,
    approved: pros.filter(p => p.verif_status === 'approved').length,
    rejected: pros.filter(p => p.verif_status === 'rejected').length,
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
      <div className="mb-7">
        <h1 className="text-2xl font-800 text-gray-900 tracking-tight">Panneau d'administration 🛡️</h1>
        <p className="text-sm text-gray-400 mt-1">Vérification des professionnel·le·s</p>
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
          <p className="font-700 text-gray-600">Aucun professionnel dans cette catégorie</p>
        </div>
      ) : (
        filtered.map(pro => (
          <div key={pro.id} className={`card mb-4 ${
            pro.verif_status === 'pending' ? 'border-amber-300 border' :
            pro.verif_status === 'approved' ? 'border-green-300 border' :
            pro.verif_status === 'rejected' ? 'border-red-300 border' : ''
          }`}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-700 text-gray-900">
                  {pro.first_name} {pro.last_name}
                </h3>
                <p className="text-xs text-gray-400">
                  {pro.city || 'Ville inconnue'} • {pro.province || ''} • Rayon {pro.radius_km || 25} km
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  📧 {pro.email || pro.id} • 📱 {pro.phone || 'N/A'}
                </p>
              </div>
              <span className={`text-xs font-700 px-3 py-1.5 rounded-full ${
                pro.verif_status === 'approved' ? 'bg-green-50 text-green-700 border border-green-200' :
                pro.verif_status === 'rejected' ? 'bg-red-50 text-red-500 border border-red-200' :
                'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {pro.verif_status === 'approved' ? '✅ Approuvé' :
                 pro.verif_status === 'rejected' ? '❌ Refusé' : '⏳ En attente'}
              </span>
            </div>

            {/* Infos pro */}
            <div className="flex flex-wrap gap-2 text-xs mb-3">
              {pro.experience && <span className="bg-gray-50 text-gray-600 px-2 py-1 rounded-lg border border-gray-200">🕐 {pro.experience}</span>}
              {pro.languages && <span className="bg-gray-50 text-gray-600 px-2 py-1 rounded-lg border border-gray-200">🗣️ {pro.languages}</span>}
              {pro.bio && <span className="bg-gray-50 text-gray-600 px-2 py-1 rounded-lg border border-gray-200 max-w-xs truncate">📝 {pro.bio}</span>}
            </div>

            {/* Documents */}
            <div className="flex gap-3 mb-3">
              {pro.selfie_url ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                  <img src={pro.selfie_url} alt="Selfie" className="w-10 h-10 rounded-lg object-cover border border-green-300" />
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
                  <img src={pro.id_card_url} alt="ID" className="w-10 h-10 rounded-lg object-cover border border-green-300" />
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

            {/* Actions */}
            <div className="flex gap-2">
              {pro.verif_status !== 'approved' && (
                <button
                  onClick={() => updateVerifStatus(pro.id, 'approved')}
                  className="flex items-center gap-1.5 text-xs font-700 bg-green-500 text-white px-4 py-2 rounded-xl hover:bg-green-600 transition-all"
                >
                  <CheckCircle size={14} /> Approuver
                </button>
              )}
              {pro.verif_status !== 'rejected' && (
                <button
                  onClick={() => updateVerifStatus(pro.id, 'rejected')}
                  className="flex items-center gap-1.5 text-xs font-700 bg-red-500 text-white px-4 py-2 rounded-xl hover:bg-red-600 transition-all"
                >
                  <XCircle size={14} /> Refuser
                </button>
              )}
              {pro.verif_status !== 'pending' && (
                <button
                  onClick={() => updateVerifStatus(pro.id, 'pending')}
                  className="flex items-center gap-1.5 text-xs font-600 bg-gray-100 text-gray-500 px-4 py-2 rounded-xl hover:bg-gray-200 transition-all"
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
            <img src={viewDoc} alt="Document" className="w-full rounded-2xl shadow-2xl" />
          </div>
        </div>
      )}

      <Toast toasts={toasts} />
    </div>
  )
}
