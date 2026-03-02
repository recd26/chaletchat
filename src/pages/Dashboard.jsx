import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useChalets } from '../hooks/useChalets'
import { useRequests } from '../hooks/useRequests'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'
import { Plus, Lock, Eye, EyeOff, MessageSquare, CreditCard, X, Star, MapPin, Clock, Languages, CheckCircle, Camera, Home, Bed, Bath } from 'lucide-react'
import ChatPanel from '../components/ChatPanel'
import StripeCardForm from '../components/StripeCardForm'
import { supabase } from '../lib/supabase'

const TABS = ['🏡 Tableau de bord', '🏔 Mes chalets', '📋 Demandes', '✅ Historique', '💳 Paiement']

export default function Dashboard() {
  const { profile } = useAuth()
  const { chalets, loading: loadChalets, updateChalet } = useChalets()
  const { requests, loading: loadReqs, acceptOffer, submitReview, completeRequest, updateRequest } = useRequests()
  const { toasts, toast } = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState(0)
  const [highlightRequest, setHighlightRequest] = useState(null)

  // Lire les search params pour navigation depuis les notifications
  useEffect(() => {
    const paramTab = searchParams.get('tab')
    const paramReq = searchParams.get('request')
    if (paramTab === null && !paramReq) return
    if (paramTab !== null) setTab(parseInt(paramTab, 10))
    if (paramReq) {
      setHighlightRequest(paramReq)
      setOpenRequest(paramReq)
      setTimeout(() => {
        document.getElementById(`request-${paramReq}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 500)
      setTimeout(() => setHighlightRequest(null), 5000)
    }
    setSearchParams({}, { replace: true })
  }, [searchParams])
  const [showCode, setShowCode] = useState({})
  const [chatRequest, setChatRequest] = useState(null)
  const [savedCard, setSavedCard] = useState(
    profile?.stripe_customer_id ? { last4: '4242', brand: 'Visa', name: profile.first_name } : null
  )
  const [showCardForm, setShowCardForm] = useState(false)
  const [viewingPro, setViewingPro] = useState(null) // profil pro à afficher
  const [openRequest, setOpenRequest] = useState(null) // id de la demande ouverte
  const [openCompleted, setOpenCompleted] = useState(null) // id de la mission complétée ouverte
  const [reviewData, setReviewData] = useState({}) // { [requestId]: { rating, comment } }
  const [reviewHover, setReviewHover] = useState({}) // { [requestId]: hoverStar }
  const [submittingReview, setSubmittingReview] = useState(null)
  const [completing, setCompleting] = useState(null)
  const [expandedAccess, setExpandedAccess] = useState({}) // { chaletId: true/false }
  const [editingAccess, setEditingAccess] = useState(null) // chalet id
  const [accessForm, setAccessForm] = useState({})
  const [savingAccess, setSavingAccess] = useState(false)
  const [editingRequest, setEditingRequest] = useState(null) // request id
  const [editReqForm, setEditReqForm] = useState({})
  const [savingRequest, setSavingRequest] = useState(false)

  function startEditAccess(chalet) {
    setEditingAccess(chalet.id)
    setAccessForm({
      access_code: chalet.access_code || '',
      key_box: chalet.key_box || '',
      parking_info: chalet.parking_info || '',
      wifi_name: chalet.wifi_name || '',
      wifi_password: chalet.wifi_password || '',
      special_notes: chalet.special_notes || '',
    })
  }

  async function saveAccess(chaletId) {
    setSavingAccess(true)
    try {
      await updateChalet(chaletId, accessForm)
      toast('✅ Accès mis à jour !', 'success')
      setEditingAccess(null)
    } catch (err) {
      toast(`❌ ${err.message}`, 'error')
    } finally {
      setSavingAccess(false)
    }
  }

  function toggleCode(id) {
    setShowCode(prev => ({ ...prev, [id]: !prev[id] }))
  }

  async function handleCardSaved({ paymentMethodId, name, last4, brand }) {
    setSavedCard({ last4, brand, name })
    setShowCardForm(false)
    // Sauvegarder le mock stripe_customer_id dans le profil
    await supabase
      .from('profiles')
      .update({ stripe_customer_id: paymentMethodId })
      .eq('id', profile.id)
    toast('💳 Carte enregistrée avec succès !', 'success')
  }

  function handleNewRequest() {
    if (!savedCard) {
      toast('💳 Ajoutez une méthode de paiement avant de créer une demande', 'info')
      setTab(4)
      return
    }
    navigate('/nouvelle-demande')
  }

  async function handleAccept(requestId, offerId, proId, price) {
    try {
      await acceptOffer(requestId, offerId, proId, price)
      toast('🎉 Offre acceptée ! 🔑 Détails d\'accès envoyés automatiquement.', 'success')
    } catch (err) {
      toast(`❌ ${err.message}`, 'error')
    }
  }

  // requests is already filtered by owner_id in useRequests hook — no extra filter needed
  const myRequests = requests
  const completedRequests = myRequests.filter(r => r.status === 'completed')
  const totalSpent = completedRequests.reduce((sum, r) => sum + (parseFloat(r.agreed_price) || 0), 0)

  function startEditRequest(req) {
    setEditingRequest(req.id)
    setEditReqForm({
      scheduled_date: req.scheduled_date || '',
      scheduled_time: req.scheduled_time || '',
      deadline_time: req.deadline_time || '',
      estimated_hours: req.estimated_hours || 3,
      is_urgent: req.is_urgent || false,
      special_notes: req.special_notes || '',
    })
  }

  async function saveEditRequest(requestId) {
    if (!editReqForm.scheduled_date || !editReqForm.scheduled_time) {
      return toast('⚠️ Date et heure requises', 'error')
    }
    setSavingRequest(true)
    try {
      await updateRequest(requestId, {
        scheduled_date: editReqForm.scheduled_date,
        scheduled_time: editReqForm.scheduled_time,
        deadline_time: editReqForm.deadline_time || null,
        estimated_hours: parseFloat(editReqForm.estimated_hours),
        is_urgent: editReqForm.is_urgent,
        special_notes: editReqForm.special_notes || null,
      })
      toast('✅ Demande modifiée !', 'success')
      setEditingRequest(null)
    } catch (err) {
      toast(`❌ ${err.message}`, 'error')
    } finally {
      setSavingRequest(false)
    }
  }

  async function handleReview(requestId, proId) {
    const data = reviewData[requestId]
    if (!data?.rating) return toast('⚠️ Sélectionnez une note', 'error')
    setSubmittingReview(requestId)
    try {
      await submitReview(requestId, proId, data.rating, data.comment || '')
      toast('⭐ Évaluation envoyée ! Merci !', 'success')
    } catch (err) {
      toast(`❌ ${err.message}`, 'error')
    } finally {
      setSubmittingReview(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-9">
      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-2xl font-800 text-gray-900 tracking-tight">
            Tableau de bord 🏡
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Bonjour {profile?.first_name} • {chalets.length} chalet{chalets.length > 1 ? 's' : ''} actif{chalets.length > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/nouveau-chalet" className="btn-secondary flex items-center gap-2 text-sm">
            <Plus size={15} /> Chalet
          </Link>
          <button onClick={handleNewRequest} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={15} /> Demande
          </button>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-4 py-2.5 text-sm font-600 border-b-2 -mb-px transition-all whitespace-nowrap ${
              tab === i ? 'border-coral text-coral' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Onglet 0 : Mes chalets ── */}
      {tab === 0 && (
        <div>
          {(loadChalets || loadReqs) ? (
            <div className="text-center py-12 text-gray-300 text-4xl">⏳</div>
          ) : chalets.length === 0 ? (
            <div className="card text-center py-12">
              <div className="text-4xl mb-3">🏡</div>
              <p className="font-700 text-gray-700 mb-2">Aucun chalet encore</p>
              <p className="text-sm text-gray-400 mb-5">Ajoutez votre premier chalet pour commencer.</p>
              <Link to="/nouveau-chalet" className="btn-primary inline-block">Ajouter un chalet</Link>
            </div>
          ) : (
            chalets.map(chalet => {
              const chaletReqs = myRequests.filter(r => r.chalet_id === chalet.id)
              const req = chaletReqs.find(r => r.status !== 'completed') || null
              const offers = req?.offers || []
              const tasks = req?.chalet?.checklist_templates || chalet.checklist_templates || []
              const completions = req?.checklist_completions || []
              const done = completions.filter(c => c.is_done && c.photo_url).length
              const total = tasks.length
              const pct = total > 0 ? Math.round(done / total * 100) : 0
              const isOpen = openRequest === req?.id

              return (
                <div key={chalet.id} className="card mb-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-700 text-gray-900">🏔 {chalet.name}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">{chalet.city} • {chalet.bedrooms} ch. • {chalet.bathrooms} sdb</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link to={`/chalet/${chalet.id}/editer`}
                        className="text-xs font-600 text-gray-400 hover:text-coral border border-gray-200 rounded-lg px-2.5 py-1.5 transition-all">
                        ✏️ Modifier
                      </Link>
                      {req ? (
                        <span className={`pill-${req.status === 'open' ? (offers.length > 0 ? 'coral' : 'pending') : 'active'}`}>
                          {req.status === 'open'
                            ? (offers.length > 0 ? `📨 En révision (${offers.length})` : '⏳ En attente')
                            : req.status === 'confirmed' ? '✅ Confirmé' : req.status}
                        </span>
                      ) : (
                        <span className="pill-done">Aucune demande active</span>
                      )}
                    </div>
                  </div>

                  {/* Lien vers historique si missions complétées */}
                  {!req && chaletReqs.some(r => r.status === 'completed') && (
                    <button
                      onClick={() => setTab(3)}
                      className="w-full py-3 text-sm font-600 text-teal bg-teal/5 border border-teal/20 rounded-xl hover:bg-teal/10 transition-all mb-3"
                    >
                      📋 {chaletReqs.filter(r => r.status === 'completed').length} mission{chaletReqs.filter(r => r.status === 'completed').length > 1 ? 's' : ''} complétée{chaletReqs.filter(r => r.status === 'completed').length > 1 ? 's' : ''} — Voir l'historique
                    </button>
                  )}

                  {req && (
                    <>
                      {/* Info demande */}
                      <div className="bg-gray-50 rounded-xl px-4 py-3 flex gap-5 flex-wrap text-xs text-gray-400 mb-3">
                        <span>🗓 {new Date(req.scheduled_date).toLocaleDateString('fr-CA', { weekday:'short', day:'numeric', month:'short' })}</span>
                        <span>⏰ {req.scheduled_time}</span>
                        {req.estimated_hours && <span>⏱ ~{req.estimated_hours}h</span>}
                        {req.agreed_price && <span className="text-teal font-700">💰 {req.agreed_price} $</span>}
                        {req.status === 'open' && (
                          <button onClick={() => startEditRequest(req)}
                            className="text-coral font-600 hover:underline ml-auto">✏️ Modifier</button>
                        )}
                      </div>

                      {/* Formulaire modification demande (si ouverte) */}
                      {editingRequest === req.id && (
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-3">
                          <h4 className="text-sm font-700 text-gray-700 mb-3">✏️ Modifier la demande</h4>
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                              <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1">Date *</label>
                              <input type="date" className="input-field" value={editReqForm.scheduled_date}
                                onChange={e => setEditReqForm(f => ({ ...f, scheduled_date: e.target.value }))} />
                            </div>
                            <div>
                              <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1">Heure *</label>
                              <input type="time" className="input-field" value={editReqForm.scheduled_time}
                                onChange={e => setEditReqForm(f => ({ ...f, scheduled_time: e.target.value }))} />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                              <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1">Heure limite</label>
                              <input type="time" className="input-field" value={editReqForm.deadline_time || ''}
                                onChange={e => setEditReqForm(f => ({ ...f, deadline_time: e.target.value }))} />
                            </div>
                            <div>
                              <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1">Durée estimée</label>
                              <select className="input-field" value={editReqForm.estimated_hours}
                                onChange={e => setEditReqForm(f => ({ ...f, estimated_hours: e.target.value }))}>
                                {['1', '1.5', '2', '2.5', '3', '3.5', '4', '5', '6', '7', '8'].map(h => (
                                  <option key={h} value={h}>{h}h</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="mb-3">
                            <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1">Notes spéciales</label>
                            <textarea className="input-field min-h-16 resize-none" placeholder="Instructions..."
                              value={editReqForm.special_notes || ''}
                              onChange={e => setEditReqForm(f => ({ ...f, special_notes: e.target.value }))} />
                          </div>
                          <label className="flex items-center gap-3 cursor-pointer mb-4">
                            <div className={`w-11 h-6 rounded-full relative transition-colors ${editReqForm.is_urgent ? 'bg-coral' : 'bg-gray-200'}`}
                              onClick={() => setEditReqForm(f => ({ ...f, is_urgent: !f.is_urgent }))}>
                              <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform left-0.5"
                                style={{ transform: editReqForm.is_urgent ? 'translateX(22px)' : 'translateX(0)' }} />
                            </div>
                            <span className="text-sm font-600 text-gray-700">Demande urgente</span>
                          </label>
                          <div className="flex gap-2">
                            <button onClick={() => saveEditRequest(req.id)} disabled={savingRequest}
                              className="btn-primary text-xs py-2 disabled:opacity-60">
                              {savingRequest ? '⏳...' : '💾 Sauvegarder'}
                            </button>
                            <button onClick={() => setEditingRequest(null)} className="btn-secondary text-xs py-2">Annuler</button>
                          </div>
                        </div>
                      )}

                      {/* Checklist progress */}
                      {total > 0 && (
                        <div className="mb-4">
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-gray-400">{done} / {total} pièces avec photos</span>
                            <span className="text-teal font-700">{pct}%</span>
                          </div>
                          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-teal to-teal-light rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }} />
                          </div>
                          {pct === 100 && (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-3 mt-3 text-xs text-green-700 font-600">
                              🎉 <strong>Checklist 100% !</strong> {req.agreed_price}$ libérés automatiquement.
                            </div>
                          )}
                        </div>
                      )}

                      {/* Pro accepté (demande confirmée) */}
                      {req.status === 'confirmed' && (() => {
                        const accepted = offers.find(o => o.status === 'accepted') || offers.find(o => o.pro_id === req.assigned_pro_id)
                        return accepted ? (
                          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal to-teal-light flex items-center justify-center text-lg text-white">🧹</div>
                                <div>
                                  <p className="text-sm font-700 text-gray-800">{accepted.pro?.first_name} {accepted.pro?.last_name}</p>
                                  <p className="text-xs text-green-600 font-600">Offre acceptée — {accepted.price} $</p>
                                </div>
                              </div>
                              <button
                                onClick={() => setViewingPro(accepted.pro)}
                                className="text-xs font-600 bg-white text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-all">
                                Profil
                              </button>
                            </div>
                          </div>
                        ) : null
                      })()}

                      {/* Bouton terminer la mission manuellement (proprio) */}
                      {req.status === 'confirmed' && (
                        <button
                          onClick={async () => {
                            if (!confirm('Confirmer la complétion et transférer à l\'historique ?')) return
                            setCompleting(req.id)
                            try {
                              await completeRequest(req.id)
                              toast('✅ Mission transférée à l\'historique !', 'success')
                            } catch (e) {
                              toast('Erreur : ' + e.message, 'error')
                            } finally {
                              setCompleting(null)
                            }
                          }}
                          disabled={completing === req.id}
                          className="w-full py-2.5 mb-3 text-sm font-700 rounded-xl border-2 border-green-500 text-green-700 bg-green-50 hover:bg-green-100 transition-all disabled:opacity-50"
                        >
                          {completing === req.id ? '⏳ Transfert...' : '✅ Terminer → Historique'}
                        </button>
                      )}

                      {/* Bouton ouvrir / fermer la demande */}
                      {req.status === 'confirmed' && total > 0 && (
                        <button
                          onClick={() => setOpenRequest(isOpen ? null : req.id)}
                          className="btn-primary w-full py-3 text-sm font-700 mb-3"
                        >
                          {isOpen ? '▲ Fermer la demande' : `▼ Voir la checklist & photos en direct`}
                        </button>
                      )}

                      {/* Vue détaillée (quand ouvert) */}
                      {isOpen && (
                        <div className="mt-2 pt-4 border-t border-gray-200">
                          {/* Résumé produits / lavage / spa */}
                          <div className="flex flex-wrap gap-2 mb-4 text-xs">
                            {req.supplies_on_site?.length > 0 && (
                              <span className="bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-lg">
                                🧴 {req.supplies_on_site.filter(s => s.available).length}/{req.supplies_on_site.length} produits dispo
                              </span>
                            )}
                            {req.laundry_tasks?.length > 0 && (
                              <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-lg">
                                🧺 {req.laundry_tasks.length} lavage{req.laundry_tasks.length > 1 ? 's' : ''}
                              </span>
                            )}
                            {req.spa_tasks?.length > 0 && (
                              <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-1 rounded-lg">
                                ♨️ {req.spa_tasks.length} tâche{req.spa_tasks.length > 1 ? 's' : ''} spa
                              </span>
                            )}
                          </div>

                          {/* Produits détaillés */}
                          {req.supplies_on_site?.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-700 text-gray-400 mb-1.5">🧴 Produits sur place :</p>
                              <div className="flex flex-wrap gap-1.5">
                                {req.supplies_on_site.map((s, i) => (
                                  <span key={i} className={`text-xs px-2 py-1 rounded-lg ${
                                    s.available ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-500 border border-red-200'
                                  }`}>{s.available ? '✓' : '✗'} {s.name}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Lavage détaillé */}
                          {req.laundry_tasks?.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-700 text-gray-400 mb-1.5">🧺 Lavage à faire :</p>
                              <div className="flex flex-wrap gap-1.5">
                                {req.laundry_tasks.map((l, i) => (
                                  <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-lg">{l.name}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Spa détaillé */}
                          {req.spa_tasks?.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-700 text-gray-400 mb-1.5">♨️ Entretien spa :</p>
                              <div className="flex flex-wrap gap-1.5">
                                {req.spa_tasks.map((s, i) => (
                                  <span key={i} className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-1 rounded-lg">{s.name}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {req.special_notes && (
                            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
                              📝 {req.special_notes}
                            </div>
                          )}

                          {/* Checklist avec photos — vue proprio */}
                          <div className="bg-coral/5 border border-coral/20 rounded-xl p-4 mb-4">
                            <div className="flex items-center justify-between mb-4">
                              <p className="text-sm font-700 text-gray-800">📸 Checklist du ménage — Suivi en direct</p>
                              <span className="text-xs font-700 text-teal bg-teal/10 px-2.5 py-1 rounded-lg">
                                {done}/{total} complétées
                              </span>
                            </div>

                            <div className="space-y-3">
                              {tasks.map((template, idx) => {
                                const comp = completions.find(c => c.template_id === template.id)
                                const isDone = comp?.is_done && comp?.photo_url

                                return (
                                  <div key={template.id}
                                    className={`rounded-xl border-2 overflow-hidden transition-all ${
                                      isDone ? 'border-teal bg-white' : 'border-gray-200 bg-white'
                                    }`}>

                                    {/* En-tête de la pièce */}
                                    <div className={`flex items-center gap-3 px-4 py-3 ${isDone ? 'bg-green-50' : ''}`}>
                                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-800 flex-shrink-0 ${
                                        isDone ? 'bg-teal border-teal text-white' : 'bg-gray-100 border-gray-300 text-gray-400'
                                      }`}>
                                        {isDone ? '✓' : idx + 1}
                                      </div>
                                      <div className="flex-1">
                                        <p className={`text-sm font-700 ${isDone ? 'text-teal' : 'text-gray-800'}`}>
                                          {template.room_name}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                          {isDone ? 'Complétée avec photo' : 'En attente de la photo du pro'}
                                        </p>
                                      </div>
                                      {isDone && <CheckCircle size={20} className="text-teal flex-shrink-0" />}
                                    </div>

                                    {/* Photo si complétée */}
                                    {isDone && (
                                      <div className="px-4 pb-3">
                                        <div className="flex items-center gap-3 bg-green-50 rounded-xl p-3">
                                          <img
                                            src={comp.photo_url}
                                            alt={template.room_name}
                                            className="w-20 h-20 rounded-lg object-cover border-2 border-teal/30 cursor-pointer hover:opacity-90 transition-all"
                                            onClick={() => window.open(comp.photo_url, '_blank')}
                                          />
                                          <div className="flex-1">
                                            <p className="text-xs font-600 text-green-700">📸 Photo validée</p>
                                            <p className="text-xs text-green-600">
                                              {comp.completed_at ? new Date(comp.completed_at).toLocaleString('fr-CA', {
                                                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                              }) : ''}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Indicateur en attente */}
                                    {!isDone && (
                                      <div className="px-4 pb-3">
                                        <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-3 text-xs text-gray-400">
                                          <Camera size={14} />
                                          <span>En attente de la photo du professionnel...</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Résumé badges (visible quand fermé) */}
                      {!isOpen && (
                        <div className="flex flex-wrap gap-2 mb-3 text-xs">
                          {req.supplies_on_site?.length > 0 && (
                            <span className="bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-lg">
                              🧴 {req.supplies_on_site.filter(s => s.available).length}/{req.supplies_on_site.length} produits
                            </span>
                          )}
                          {req.laundry_tasks?.length > 0 && (
                            <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-lg">
                              🧺 {req.laundry_tasks.length} lavage{req.laundry_tasks.length > 1 ? 's' : ''}
                            </span>
                          )}
                          {req.spa_tasks?.length > 0 && (
                            <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-1 rounded-lg">
                              ♨️ {req.spa_tasks.length} tâche{req.spa_tasks.length > 1 ? 's' : ''} spa
                            </span>
                          )}
                        </div>
                      )}

                      {/* Offres reçues (demande ouverte) */}
                      {req.status === 'open' && offers.length > 0 && (
                        <div>
                          <p className="text-sm font-700 text-gray-800 mb-2">📨 Offres reçues ({offers.length})</p>
                          {offers.map(offer => (
                            <div key={offer.id} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 mb-2 hover:border-coral transition-all">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-coral-light to-amber-300 flex items-center justify-center text-lg">👩</div>
                                <div>
                                  <p className="text-sm font-700 text-gray-800">{offer.pro?.first_name} {offer.pro?.last_name}</p>
                                  <p className="text-xs text-amber-500">{(() => {
                                    const proReviews = myRequests
                                      .filter(r => r.assigned_pro_id === offer.pro_id && r.status === 'completed' && r.reviews?.length > 0)
                                      .flatMap(r => r.reviews.filter(rv => rv.reviewee_id === offer.pro_id))
                                    if (proReviews.length === 0) return '☆ Nouveau'
                                    const avg = (proReviews.reduce((s, r) => s + r.rating, 0) / proReviews.length).toFixed(1)
                                    return `${'★'.repeat(Math.round(avg))}${'☆'.repeat(5 - Math.round(avg))} ${avg}`
                                  })()}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-800 text-gray-900">{offer.price} $</p>
                                <div className="flex gap-2 mt-1">
                                  <button
                                    onClick={() => handleAccept(req.id, offer.id, offer.pro_id, offer.price)}
                                    className="text-xs font-700 bg-coral text-white px-3 py-1.5 rounded-lg hover:bg-coral-dark transition-all">
                                    Accepter
                                  </button>
                                  <button
                                    onClick={() => setViewingPro(offer.pro)}
                                    className="text-xs font-600 bg-gray-100 text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-all">
                                    Profil
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Bouton chat si pro assigne */}
                      {req.assigned_pro_id && (
                        <button
                          onClick={() => setChatRequest({ id: req.id, chaletName: chalet.name })}
                          className="btn-secondary text-xs flex items-center gap-2 mt-3"
                        >
                          <MessageSquare size={14} /> Envoyer un message
                        </button>
                      )}
                    </>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── Onglet 1 : Mes chalets ── */}
      {tab === 1 && (
        <div>
          {/* Stats résumé */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="card text-center py-4">
              <p className="text-2xl font-800 text-coral">{chalets.length}</p>
              <p className="text-xs text-gray-400 mt-1">Chalets</p>
            </div>
            <div className="card text-center py-4">
              <p className="text-2xl font-800 text-gray-900">{chalets.reduce((s, c) => s + (c.bedrooms || 0), 0)}</p>
              <p className="text-xs text-gray-400 mt-1">Chambres total</p>
            </div>
            <div className="card text-center py-4">
              <p className="text-2xl font-800 text-teal">{chalets.reduce((s, c) => s + (c.checklist_templates?.length || 0), 0)}</p>
              <p className="text-xs text-gray-400 mt-1">Pièces définies</p>
            </div>
          </div>

          {loadChalets ? (
            <div className="text-center py-12 text-gray-300 text-4xl">⏳</div>
          ) : chalets.length === 0 ? (
            <div className="card text-center py-12">
              <div className="text-4xl mb-3">🏔</div>
              <p className="font-700 text-gray-700 mb-2">Aucun chalet</p>
              <p className="text-sm text-gray-400 mb-5">Ajoutez votre premier chalet pour commencer.</p>
              <Link to="/nouveau-chalet" className="btn-primary inline-block">+ Ajouter un chalet</Link>
            </div>
          ) : (
            <div className="space-y-4">
              {chalets.map(chalet => {
                const rooms = chalet.checklist_templates || []
                const hasActiveReq = myRequests.some(r => r.chalet_id === chalet.id && r.status !== 'completed')
                const completedCount = myRequests.filter(r => r.chalet_id === chalet.id && r.status === 'completed').length

                return (
                  <div key={chalet.id} className="card">
                    {/* En-tête */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-700 text-gray-900 text-lg">🏔 {chalet.name}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {[chalet.address, chalet.city, chalet.province, chalet.postal_code].filter(Boolean).join(', ')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasActiveReq ? (
                          <span className="pill-active">📋 Demande active</span>
                        ) : (
                          <span className="pill-done">Disponible</span>
                        )}
                      </div>
                    </div>

                    {/* Badges infos */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2.5 py-1.5 rounded-lg">
                        <Bed size={12} /> {chalet.bedrooms || '?'} chambre{(chalet.bedrooms || 0) > 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2.5 py-1.5 rounded-lg">
                        <Bath size={12} /> {chalet.bathrooms || '?'} sdb
                      </span>
                      <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2.5 py-1.5 rounded-lg">
                        <Home size={12} /> {rooms.length} pièce{rooms.length > 1 ? 's' : ''}
                      </span>
                      {completedCount > 0 && (
                        <span className="flex items-center gap-1 text-xs bg-teal/10 text-teal border border-teal/20 px-2.5 py-1.5 rounded-lg">
                          <CheckCircle size={12} /> {completedCount} mission{completedCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Pièces avec photos de référence */}
                    {rooms.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-700 text-gray-400 uppercase tracking-wide mb-2">Pièces & photos de référence</p>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                          {rooms.sort((a, b) => a.position - b.position).map(room => (
                            <div key={room.id} className="text-center">
                              {room.reference_photo_url ? (
                                <img
                                  src={room.reference_photo_url}
                                  alt={room.room_name}
                                  onClick={() => window.open(room.reference_photo_url, '_blank')}
                                  className="w-full h-16 object-cover rounded-lg border border-teal/30 cursor-pointer hover:border-teal hover:shadow-sm transition-all"
                                />
                              ) : (
                                <div className="w-full h-16 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center">
                                  <Camera size={16} className="text-gray-300" />
                                </div>
                              )}
                              <p className="text-[10px] font-600 text-gray-500 mt-1 truncate">{room.room_name}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {rooms.length === 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700 mb-4">
                        ⚠️ Aucune pièce définie — modifiez ce chalet pour ajouter la checklist.
                      </div>
                    )}

                    {/* Section Accès (pliable) */}
                    <div className="mb-4">
                      <button
                        onClick={() => setExpandedAccess(prev => ({ ...prev, [chalet.id]: !prev[chalet.id] }))}
                        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-700 transition-all ${
                          chalet.access_code
                            ? 'bg-green-50 border border-green-200 text-green-700'
                            : 'bg-amber-50 border border-amber-200 text-amber-700'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Lock size={13} />
                          {chalet.access_code ? '🔑 Accès configuré' : '⚠️ Accès non configuré'}
                        </span>
                        <span className="text-[10px]">{expandedAccess[chalet.id] ? '▲' : '▼'}</span>
                      </button>

                      {expandedAccess[chalet.id] && (
                        <div className="mt-2 bg-gray-50 rounded-xl border border-gray-200 p-3">
                          {chalet.access_code ? (
                            <div className="space-y-1.5">
                              {[
                                { icon: '🔑', label: 'Code porte', val: chalet.access_code, secret: true, id: chalet.id },
                                { icon: '📦', label: 'Boîte à clé', val: chalet.key_box },
                                { icon: '🅿️', label: 'Stationnement', val: chalet.parking_info },
                                { icon: '🌐', label: 'Wi-Fi', val: chalet.wifi_name ? `${chalet.wifi_name} • ${chalet.wifi_password}` : null, secret: true, id: `wifi-${chalet.id}` },
                                { icon: '⚠️', label: 'Notes', val: chalet.special_notes },
                              ].filter(r => r.val).map(row => (
                                <div key={row.label} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-100">
                                  <span className="text-sm">{row.icon}</span>
                                  <span className="text-[10px] font-700 text-gray-400 w-20 flex-shrink-0 uppercase tracking-wide">{row.label}</span>
                                  <span className="text-xs font-600 text-gray-800 flex-1">
                                    {row.secret ? (showCode[row.id] ? row.val : '••••••') : row.val}
                                  </span>
                                  {row.secret && (
                                    <button onClick={() => toggleCode(row.id)} className="text-gray-400 hover:text-gray-600">
                                      {showCode[row.id] ? <EyeOff size={13}/> : <Eye size={13}/>}
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-amber-600">
                              Configurez les accès — ils seront envoyés automatiquement au prochain pro accepté.
                            </p>
                          )}

                          {/* Formulaire d'édition des accès */}
                          {editingAccess === chalet.id ? (
                            <div className="mt-3 bg-white rounded-xl p-3 border border-gray-200">
                              <h4 className="text-xs font-700 text-gray-700 mb-2">🔑 Modifier les accès</h4>
                              <div className="grid grid-cols-2 gap-2 mb-2">
                                <div>
                                  <label className="block text-[10px] font-700 text-gray-400 uppercase tracking-wide mb-0.5">Code porte</label>
                                  <input className="input-field text-xs" placeholder="1234#" value={accessForm.access_code}
                                    onChange={e => setAccessForm(f => ({ ...f, access_code: e.target.value }))} />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-700 text-gray-400 uppercase tracking-wide mb-0.5">Boîte à clé</label>
                                  <input className="input-field text-xs" placeholder="Sous le perron" value={accessForm.key_box}
                                    onChange={e => setAccessForm(f => ({ ...f, key_box: e.target.value }))} />
                                </div>
                              </div>
                              <div className="mb-2">
                                <label className="block text-[10px] font-700 text-gray-400 uppercase tracking-wide mb-0.5">Stationnement</label>
                                <input className="input-field text-xs" placeholder="2 places devant" value={accessForm.parking_info}
                                  onChange={e => setAccessForm(f => ({ ...f, parking_info: e.target.value }))} />
                              </div>
                              <div className="grid grid-cols-2 gap-2 mb-2">
                                <div>
                                  <label className="block text-[10px] font-700 text-gray-400 uppercase tracking-wide mb-0.5">Nom Wi-Fi</label>
                                  <input className="input-field text-xs" placeholder="ChaletWifi" value={accessForm.wifi_name}
                                    onChange={e => setAccessForm(f => ({ ...f, wifi_name: e.target.value }))} />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-700 text-gray-400 uppercase tracking-wide mb-0.5">Mot de passe Wi-Fi</label>
                                  <input className="input-field text-xs" placeholder="••••••" value={accessForm.wifi_password}
                                    onChange={e => setAccessForm(f => ({ ...f, wifi_password: e.target.value }))} />
                                </div>
                              </div>
                              <div className="mb-3">
                                <label className="block text-[10px] font-700 text-gray-400 uppercase tracking-wide mb-0.5">Notes spéciales</label>
                                <textarea className="input-field text-xs min-h-12 resize-none" placeholder="Instructions particulières..."
                                  value={accessForm.special_notes}
                                  onChange={e => setAccessForm(f => ({ ...f, special_notes: e.target.value }))} />
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => saveAccess(chalet.id)} disabled={savingAccess}
                                  className="btn-primary text-xs py-1.5 disabled:opacity-60">
                                  {savingAccess ? '⏳...' : '💾 Sauvegarder'}
                                </button>
                                <button onClick={() => setEditingAccess(null)} className="btn-secondary text-xs py-1.5">Annuler</button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => startEditAccess(chalet)} className="btn-secondary text-xs mt-2 w-full">
                              {chalet.access_code ? '✏️ Modifier les accès' : '➕ Configurer les accès'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Link to={`/chalet/${chalet.id}/editer`}
                        className="btn-secondary text-xs flex items-center gap-1.5">
                        ✏️ Modifier
                      </Link>
                      {!hasActiveReq && (
                        <button onClick={() => { navigate('/nouvelle-demande') }}
                          className="btn-primary text-xs flex items-center gap-1.5">
                          <Plus size={12} /> Créer une demande
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Bouton ajouter un chalet */}
          {chalets.length > 0 && (
            <Link to="/nouveau-chalet"
              className="mt-5 w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm font-700 text-gray-400 hover:border-coral hover:text-coral transition-all flex items-center justify-center gap-2">
              <Plus size={16} /> Ajouter un chalet
            </Link>
          )}
        </div>
      )}

      {/* ── Onglet 2 : Demandes ── */}
      {tab === 2 && (
        <div>
          {loadReqs ? (
            <div className="text-center py-12 text-gray-300 text-4xl">⏳</div>
          ) : (() => {
            const activeReqs = myRequests.filter(r => r.status !== 'completed')
            const openReqs = activeReqs.filter(r => r.status === 'open')
            const confirmedReqs = activeReqs.filter(r => r.status === 'confirmed')
            const totalOffers = openReqs.reduce((sum, r) => sum + (r.offers?.length || 0), 0)

            return (
              <div>
                {/* Stats demandes */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="card text-center py-4">
                    <p className="text-2xl font-800 text-coral">{openReqs.length}</p>
                    <p className="text-xs text-gray-400 mt-1">En attente</p>
                  </div>
                  <div className="card text-center py-4">
                    <p className="text-2xl font-800 text-teal">{confirmedReqs.length}</p>
                    <p className="text-xs text-gray-400 mt-1">Confirmées</p>
                  </div>
                  <div className="card text-center py-4">
                    <p className="text-2xl font-800 text-amber-500">{totalOffers}</p>
                    <p className="text-xs text-gray-400 mt-1">Offres reçues</p>
                  </div>
                </div>

                {activeReqs.length === 0 ? (
                  <div className="card text-center py-12">
                    <div className="text-4xl mb-3">📋</div>
                    <p className="font-700 text-gray-700 mb-2">Aucune demande active</p>
                    <p className="text-sm text-gray-400 mb-5">Créez une demande de ménage pour recevoir des offres.</p>
                    <button onClick={handleNewRequest} className="btn-primary">+ Nouvelle demande</button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeReqs.map(req => {
                      const chalet = chalets.find(c => c.id === req.chalet_id) || req.chalet
                      const offers = req.offers || []
                      const acceptedPro = offers.find(o => o.status === 'accepted') || offers.find(o => o.pro_id === req.assigned_pro_id)

                      return (
                        <div key={req.id} id={`request-${req.id}`} className={`card border ${req.status === 'confirmed' ? 'border-green-200' : 'border-coral/30'} ${highlightRequest === req.id ? 'ring-2 ring-coral ring-offset-2' : ''}`}>
                          {/* En-tête */}
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="font-700 text-gray-900">🏔 {chalet?.name || 'Chalet'}</h3>
                              <p className="text-xs text-gray-400 mt-0.5">{chalet?.city}</p>
                            </div>
                            <span className={`pill-${req.status === 'open' ? (offers.length > 0 ? 'coral' : 'pending') : 'active'}`}>
                              {req.status === 'open'
                                ? (offers.length > 0 ? `📨 En révision (${offers.length})` : '⏳ En attente d\'offres')
                                : '✅ Confirmé'}
                            </span>
                          </div>

                          {/* Infos demande */}
                          <div className="bg-gray-50 rounded-xl px-4 py-3 flex gap-5 flex-wrap text-xs text-gray-500 mb-3">
                            <span>🗓 {req.scheduled_date ? new Date(req.scheduled_date).toLocaleDateString('fr-CA', { weekday:'short', day:'numeric', month:'short' }) : '—'}</span>
                            <span>⏰ {req.scheduled_time || '—'}</span>
                            {req.estimated_hours && <span>⏱ ~{req.estimated_hours}h</span>}
                            {req.is_urgent && <span className="text-coral font-700">🔥 Urgent</span>}
                            {req.agreed_price && <span className="text-teal font-700">💰 {req.agreed_price} $</span>}
                          </div>

                          {/* Notes spéciales */}
                          {req.special_notes && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700 mb-3">
                              📝 {req.special_notes}
                            </div>
                          )}

                          {/* Badges produits / lavage / spa */}
                          <div className="flex flex-wrap gap-2 mb-3 text-xs">
                            {req.supplies_on_site?.length > 0 && (
                              <span className="bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-lg">
                                🧴 {req.supplies_on_site.filter(s => s.available).length}/{req.supplies_on_site.length} produits
                              </span>
                            )}
                            {req.laundry_tasks?.length > 0 && (
                              <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-lg">
                                🧺 {req.laundry_tasks.length} lavage{req.laundry_tasks.length > 1 ? 's' : ''}
                              </span>
                            )}
                            {req.spa_tasks?.length > 0 && (
                              <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-1 rounded-lg">
                                ♨️ {req.spa_tasks.length} tâche{req.spa_tasks.length > 1 ? 's' : ''} spa
                              </span>
                            )}
                          </div>

                          {/* Bouton modifier (demande ouverte) */}
                          {req.status === 'open' && (
                            <button onClick={() => startEditRequest(req)}
                              className="text-xs font-600 text-coral hover:underline mb-3">✏️ Modifier cette demande</button>
                          )}

                          {/* Formulaire modification demande */}
                          {editingRequest === req.id && (
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-3">
                              <h4 className="text-sm font-700 text-gray-700 mb-3">✏️ Modifier la demande</h4>
                              <div className="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                  <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1">Date *</label>
                                  <input type="date" className="input-field" value={editReqForm.scheduled_date}
                                    onChange={e => setEditReqForm(f => ({ ...f, scheduled_date: e.target.value }))} />
                                </div>
                                <div>
                                  <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1">Heure *</label>
                                  <input type="time" className="input-field" value={editReqForm.scheduled_time}
                                    onChange={e => setEditReqForm(f => ({ ...f, scheduled_time: e.target.value }))} />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                  <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1">Heure limite</label>
                                  <input type="time" className="input-field" value={editReqForm.deadline_time || ''}
                                    onChange={e => setEditReqForm(f => ({ ...f, deadline_time: e.target.value }))} />
                                </div>
                                <div>
                                  <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1">Durée estimée</label>
                                  <select className="input-field" value={editReqForm.estimated_hours}
                                    onChange={e => setEditReqForm(f => ({ ...f, estimated_hours: e.target.value }))}>
                                    {['1', '1.5', '2', '2.5', '3', '3.5', '4', '5', '6', '7', '8'].map(h => (
                                      <option key={h} value={h}>{h}h</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div className="mb-3">
                                <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1">Notes spéciales</label>
                                <textarea className="input-field min-h-16 resize-none" placeholder="Instructions..."
                                  value={editReqForm.special_notes || ''}
                                  onChange={e => setEditReqForm(f => ({ ...f, special_notes: e.target.value }))} />
                              </div>
                              <label className="flex items-center gap-3 cursor-pointer mb-4">
                                <div className={`w-11 h-6 rounded-full relative transition-colors ${editReqForm.is_urgent ? 'bg-coral' : 'bg-gray-200'}`}
                                  onClick={() => setEditReqForm(f => ({ ...f, is_urgent: !f.is_urgent }))}>
                                  <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform left-0.5"
                                    style={{ transform: editReqForm.is_urgent ? 'translateX(22px)' : 'translateX(0)' }} />
                                </div>
                                <span className="text-sm font-600 text-gray-700">Demande urgente</span>
                              </label>
                              <div className="flex gap-2">
                                <button onClick={() => saveEditRequest(req.id)} disabled={savingRequest}
                                  className="btn-primary text-xs py-2 disabled:opacity-60">
                                  {savingRequest ? '⏳...' : '💾 Sauvegarder'}
                                </button>
                                <button onClick={() => setEditingRequest(null)} className="btn-secondary text-xs py-2">Annuler</button>
                              </div>
                            </div>
                          )}

                          {/* Pro confirmé */}
                          {req.status === 'confirmed' && acceptedPro && (
                            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal to-teal-light flex items-center justify-center text-lg text-white">🧹</div>
                                  <div>
                                    <p className="text-sm font-700 text-gray-800">{acceptedPro.pro?.first_name} {acceptedPro.pro?.last_name}</p>
                                    <p className="text-xs text-green-600 font-600">Offre acceptée — {acceptedPro.price} $</p>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => setViewingPro(acceptedPro.pro)}
                                    className="text-xs font-600 bg-white text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-all">
                                    Profil
                                  </button>
                                  <button onClick={() => setChatRequest({ id: req.id, chaletName: chalet?.name })}
                                    className="text-xs font-600 bg-teal text-white px-3 py-1.5 rounded-lg hover:bg-teal/90 transition-all">
                                    💬 Chat
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Offres reçues (demande ouverte) */}
                          {req.status === 'open' && (
                            <div>
                              {offers.length === 0 ? (
                                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                                  <p className="text-sm text-gray-400">⏳ En attente d'offres des professionnels...</p>
                                  <p className="text-xs text-gray-300 mt-1">Les pros proches de votre chalet recevront une notification.</p>
                                </div>
                              ) : (
                                <div>
                                  <p className="text-sm font-700 text-gray-800 mb-2">
                                    📨 {offers.length} offre{offers.length > 1 ? 's' : ''} reçue{offers.length > 1 ? 's' : ''}
                                  </p>
                                  {offers.map(offer => (
                                    <div key={offer.id} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 mb-2 hover:border-coral transition-all">
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-coral-light to-amber-300 flex items-center justify-center text-lg">
                                          {offer.pro?.avatar_url
                                            ? <img src={offer.pro.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                                            : '👩'
                                          }
                                        </div>
                                        <div>
                                          <p className="text-sm font-700 text-gray-800">{offer.pro?.first_name} {offer.pro?.last_name}</p>
                                          <p className="text-xs text-gray-400">
                                            {offer.pro?.experience || 'Nouveau'}
                                            {offer.pro?.languages?.length > 0 && ` • ${offer.pro.languages.join(', ')}`}
                                          </p>
                                          {offer.message && (
                                            <p className="text-xs text-gray-500 mt-0.5 italic">"{offer.message}"</p>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-right flex-shrink-0 ml-3">
                                        <p className="text-lg font-800 text-gray-900">{offer.price} $</p>
                                        <div className="flex gap-2 mt-1">
                                          <button
                                            onClick={() => handleAccept(req.id, offer.id, offer.pro_id, offer.price)}
                                            className="text-xs font-700 bg-coral text-white px-3 py-1.5 rounded-lg hover:bg-coral-dark transition-all">
                                            ✅ Accepter
                                          </button>
                                          <button
                                            onClick={() => setViewingPro(offer.pro)}
                                            className="text-xs font-600 bg-gray-100 text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-all">
                                            Profil
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* ── Onglet 3 : Historique ── */}
      {tab === 3 && (
        <div>
          {/* Stats résumé */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="card text-center py-4">
              <p className="text-2xl font-800 text-teal">{completedRequests.length}</p>
              <p className="text-xs text-gray-400 mt-1">Missions complétées</p>
            </div>
            <div className="card text-center py-4">
              <p className="text-2xl font-800 text-gray-900">{totalSpent.toFixed(0)} $</p>
              <p className="text-xs text-gray-400 mt-1">Total dépensé</p>
            </div>
            <div className="card text-center py-4">
              <p className="text-2xl font-800 text-amber-500">
                {completedRequests.length > 0
                  ? (completedRequests.filter(r => r.reviews?.length > 0).reduce((s, r) => s + (r.reviews[0]?.rating || 0), 0) / Math.max(completedRequests.filter(r => r.reviews?.length > 0).length, 1)).toFixed(1)
                  : '—'
                } ★
              </p>
              <p className="text-xs text-gray-400 mt-1">Note moyenne donnée</p>
            </div>
          </div>

          {completedRequests.length === 0 ? (
            <div className="card text-center py-10">
              <p className="text-3xl mb-2">📋</p>
              <p className="font-700 text-gray-600">Aucune mission complétée</p>
              <p className="text-sm text-gray-400 mt-1">Vos missions terminées apparaîtront ici.</p>
            </div>
          ) : (
            completedRequests.map(req => {
              const chalet = chalets.find(c => c.id === req.chalet_id)
              const tasks = req.chalet?.checklist_templates || chalet?.checklist_templates || []
              const completions = req.checklist_completions || []
              const accepted = req.offers?.find(o => o.status === 'accepted') || req.offers?.find(o => o.pro_id === req.assigned_pro_id)
              const reviewTargetId = accepted?.pro_id || req.assigned_pro_id
              const reviewTargetName = accepted?.pro?.first_name || 'le professionnel'
              const isExpanded = openCompleted === req.id
              const myReview = req.reviews?.find(r => r.reviewer_id === profile?.id)
              const rd = reviewData[req.id] || {}
              const rh = reviewHover[req.id] || 0

              return (
                <div key={req.id} className="card mb-4 border-green-200 border">
                  {/* En-tête */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="pill-done mb-2 inline-block">✅ Complété</span>
                      <h3 className="font-700 text-gray-900">🏔 {chalet?.name || 'Chalet'}</h3>
                      <p className="text-xs text-gray-400">
                        {chalet?.city} — {req.scheduled_date ? new Date(req.scheduled_date).toLocaleDateString('fr-CA', { weekday:'short', day:'numeric', month:'long', year:'numeric' }) : ''}
                      </p>
                    </div>
                    <p className="text-xl font-800 text-teal">{req.agreed_price} $</p>
                  </div>

                  {/* Pro qui a fait la mission */}
                  {(accepted || req.assigned_pro_id) && (
                    <div className="flex items-center gap-3 bg-green-50 rounded-xl px-4 py-2.5 mb-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal to-teal-light flex items-center justify-center text-sm text-white">🧹</div>
                      <div className="flex-1">
                        <p className="text-sm font-700 text-gray-800">{accepted?.pro?.first_name || 'Professionnel'} {accepted?.pro?.last_name || ''}</p>
                        <p className="text-xs text-green-600">Mission complétée</p>
                      </div>
                      {accepted?.pro && (
                        <button onClick={() => setViewingPro(accepted.pro)}
                          className="text-xs font-600 text-gray-400 hover:text-teal">Profil</button>
                      )}
                    </div>
                  )}

                  {/* Bouton voir photos */}
                  <button
                    onClick={() => setOpenCompleted(isExpanded ? null : req.id)}
                    className="w-full py-2.5 text-sm font-700 text-teal bg-teal/5 border border-teal/20 rounded-xl hover:bg-teal/10 transition-all mb-3"
                  >
                    {isExpanded ? '▲ Fermer' : `📸 Voir les ${tasks.length} photos — Checklist complète`}
                  </button>

                  {/* Galerie photos (expanded) */}
                  {isExpanded && (
                    <div className="mb-4">
                      {/* Grille photos */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        {tasks.map((template) => {
                          const comp = completions.find(c => c.template_id === template.id)
                          return (
                            <div key={template.id} className="relative group">
                              {comp?.photo_url ? (
                                <img
                                  src={comp.photo_url}
                                  alt={template.room_name}
                                  className="w-full h-32 object-cover rounded-xl border-2 border-teal/20 cursor-pointer hover:opacity-90 transition-all"
                                  onClick={() => window.open(comp.photo_url, '_blank')}
                                />
                              ) : (
                                <div className="w-full h-32 rounded-xl bg-gray-100 border-2 border-gray-200 flex items-center justify-center text-gray-300">
                                  <Camera size={24} />
                                </div>
                              )}
                              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs font-600 px-2 py-1.5 rounded-b-xl">
                                ✓ {template.room_name}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Détails produits / lavage / spa */}
                      {req.supplies_on_site?.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs font-700 text-gray-400 mb-1">🧴 Produits :</p>
                          <div className="flex flex-wrap gap-1">
                            {req.supplies_on_site.map((s, i) => (
                              <span key={i} className={`text-xs px-2 py-0.5 rounded-lg ${s.available ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-400'}`}>{s.name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {req.laundry_tasks?.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs font-700 text-gray-400 mb-1">🧺 Lavage :</p>
                          <div className="flex flex-wrap gap-1">
                            {req.laundry_tasks.map((l, i) => (
                              <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg">{l.name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {req.spa_tasks?.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs font-700 text-gray-400 mb-1">♨️ Spa :</p>
                          <div className="flex flex-wrap gap-1">
                            {req.spa_tasks.map((s, i) => (
                              <span key={i} className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-lg">{s.name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Évaluation */}
                  {myReview ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-700 text-amber-700">Votre évaluation</p>
                        <div className="flex gap-0.5">
                          {Array.from({length: 5}).map((_, j) => (
                            <Star key={j} size={14} className={j < myReview.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
                          ))}
                        </div>
                      </div>
                      {myReview.comment && <p className="text-xs text-amber-600">{myReview.comment}</p>}
                    </div>
                  ) : reviewTargetId ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <p className="text-xs font-700 text-gray-700 mb-2">⭐ Évaluer {reviewTargetName}</p>
                      <div className="flex gap-1 mb-3">
                        {Array.from({length: 5}).map((_, j) => (
                          <button key={j}
                            onMouseEnter={() => setReviewHover(h => ({ ...h, [req.id]: j + 1 }))}
                            onMouseLeave={() => setReviewHover(h => ({ ...h, [req.id]: 0 }))}
                            onClick={() => setReviewData(d => ({ ...d, [req.id]: { ...d[req.id], rating: j + 1 } }))}
                          >
                            <Star size={22} className={
                              j < (rh || rd.rating || 0)
                                ? 'fill-amber-400 text-amber-400 transition-all'
                                : 'text-gray-300 transition-all hover:text-amber-300'
                            } />
                          </button>
                        ))}
                        {rd.rating && <span className="text-sm font-700 text-amber-600 ml-2">{rd.rating}/5</span>}
                      </div>
                      <textarea
                        className="input-field text-xs min-h-16 resize-none mb-2"
                        placeholder="Un commentaire ? (optionnel)"
                        value={rd.comment || ''}
                        onChange={e => setReviewData(d => ({ ...d, [req.id]: { ...d[req.id], comment: e.target.value } }))}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReview(req.id, reviewTargetId)}
                          disabled={submittingReview === req.id}
                          className="btn-primary text-xs py-2 disabled:opacity-60"
                        >
                          {submittingReview === req.id ? '⏳...' : '⭐ Envoyer l\'évaluation'}
                        </button>
                        <button
                          onClick={() => navigate('/nouvelle-demande')}
                          className="btn-secondary text-xs py-2"
                        >
                          🔄 Redemander ce pro
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── Onglet 4 : Paiement ── */}
      {tab === 4 && (
        <div>
          <div className="card mb-4">
            <h3 className="font-700 text-gray-900 mb-4">💳 Méthode de paiement</h3>

            {/* Carte sauvegardee */}
            {savedCard && !showCardForm ? (
              <>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3 mb-4">
                  <span className="text-2xl">✅</span>
                  <div className="flex-1">
                    <p className="text-sm font-700 text-green-700">Carte enregistrée</p>
                    <p className="text-xs text-green-600">{savedCard.brand} se terminant par •••• {savedCard.last4}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCardForm(true)}
                  className="btn-secondary text-xs flex items-center gap-2"
                >
                  <CreditCard size={14} /> Changer de carte
                </button>
              </>
            ) : (
              <>
                {/* Formulaire carte */}
                {!savedCard && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 mb-4">
                    💳 Ajoutez une méthode de paiement pour pouvoir créer des demandes de ménage.
                  </div>
                )}
                {showCardForm && savedCard && (
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-400">Entrez les informations de votre nouvelle carte.</p>
                    <button onClick={() => setShowCardForm(false)} className="text-xs text-gray-400 hover:text-gray-600">Annuler</button>
                  </div>
                )}
                <StripeCardForm
                  onSuccess={handleCardSaved}
                  onError={(msg) => toast(msg, 'error')}
                  buttonText={savedCard ? 'Changer la carte' : 'Ajouter la carte'}
                />
              </>
            )}
          </div>

          {/* Comment ca marche */}
          <div className="card">
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-2">
              <p>💸 <strong>Comment ça marche :</strong></p>
              <p>1. Vous acceptez une offre → votre carte est pré-autorisée</p>
              <p>2. Le montant est mis en entiercement (Stripe)</p>
              <p>3. Checklist 100% + photos → paiement libéré automatiquement</p>
              <p>4. La professionnelle reçoit son montant dans les 2h</p>
            </div>
            <div className="mt-4 p-3 bg-coral/5 border border-coral/20 rounded-xl text-xs text-coral">
              ℹ️ <strong>Frais de service : 3%</strong> par transaction. Exemple : offre de 95$ → vous payez 98,60$ (95 + 2,85$ frais + 0,75$ traitement).
            </div>
          </div>
        </div>
      )}

      {chatRequest && (
        <ChatPanel
          requestId={chatRequest.id}
          chaletName={chatRequest.chaletName}
          onClose={() => setChatRequest(null)}
        />
      )}

      {/* Modal profil professionnel */}
      {viewingPro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setViewingPro(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-br from-teal to-teal-light p-6 text-white relative">
              <button onClick={() => setViewingPro(null)} className="absolute top-3 right-3 text-white/70 hover:text-white">
                <X size={20} />
              </button>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl">
                  {viewingPro.avatar_url
                    ? <img src={viewingPro.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover" />
                    : '👩'
                  }
                </div>
                <div>
                  <h2 className="text-xl font-800">{viewingPro.first_name} {viewingPro.last_name}</h2>
                  <p className="text-white/80 text-sm">
                    {viewingPro.verif_status === 'approved' ? '✅ Identité vérifiée' : '⏳ Vérification en cours'}
                  </p>
                </div>
              </div>
            </div>

            {/* Contenu */}
            <div className="p-5 space-y-4">
              {/* Localisation */}
              {(viewingPro.city || viewingPro.province) && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin size={16} className="text-teal flex-shrink-0" />
                  <span>{[viewingPro.city, viewingPro.province].filter(Boolean).join(', ')}</span>
                </div>
              )}

              {/* Expérience */}
              {viewingPro.experience && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock size={16} className="text-teal flex-shrink-0" />
                  <span>{viewingPro.experience}</span>
                </div>
              )}

              {/* Langues */}
              {viewingPro.languages?.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Languages size={16} className="text-teal flex-shrink-0" />
                  <span>{viewingPro.languages.join(', ')}</span>
                </div>
              )}

              {/* Bio */}
              {viewingPro.bio && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-700 text-gray-400 uppercase mb-1.5">À propos</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{viewingPro.bio}</p>
                </div>
              )}

              {/* Évaluations réelles */}
              {(() => {
                const proRevs = myRequests
                  .filter(r => r.assigned_pro_id === viewingPro.id && r.status === 'completed' && r.reviews?.length > 0)
                  .flatMap(r => r.reviews.filter(rv => rv.reviewee_id === viewingPro.id))
                const avg = proRevs.length > 0
                  ? (proRevs.reduce((s, r) => s + r.rating, 0) / proRevs.length).toFixed(1)
                  : null
                return proRevs.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex gap-0.5">
                        {Array.from({length: 5}).map((_, j) => (
                          <Star key={j} size={14} className={j < Math.round(avg) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
                        ))}
                      </div>
                      <span className="text-sm font-700 text-amber-600">{avg}/5</span>
                      <span className="text-xs text-gray-400">({proRevs.length} éval.)</span>
                    </div>
                    {proRevs.slice(0, 3).map((rev, i) => (
                      <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-1.5 text-xs">
                        <div className="flex gap-0.5 mb-1">
                          {Array.from({length: 5}).map((_, j) => (
                            <Star key={j} size={10} className={j < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
                          ))}
                        </div>
                        {rev.comment && <p className="text-gray-600">"{rev.comment}"</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                    <Star size={16} className="text-gray-300" />
                    <span className="text-sm font-600 text-gray-400">Aucune évaluation pour le moment</span>
                  </div>
                )
              })()}
            </div>

            <div className="px-5 pb-5">
              <button onClick={() => setViewingPro(null)} className="btn-secondary w-full py-2.5">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toasts={toasts} />
    </div>
  )
}
