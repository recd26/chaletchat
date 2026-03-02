import { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useRequests } from '../hooks/useRequests'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'
import { Camera, CheckCircle, Star, Map, List, MessageSquare, Upload, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import ChatPanel from '../components/ChatPanel'
import { PROVINCES } from '../lib/constants'
import { geocodeAddress, haversineDistance } from '../lib/geocode'

const MapView = lazy(() => import('../components/MapView'))

const TABS = ['Demandes à proximité', 'Mon profil & vérification', '✅ Missions complétées']

export default function ProDashboard() {
  const { profile, updateProfile } = useAuth()
  const { requests, loading, submitOffer, updateChecklistItem, uploadRoomPhoto, getOpenRequestsNearby, completeRequest, submitReview, updateOffer } = useRequests()
  const { toasts, toast } = useToast()

  const [searchParams, setSearchParams] = useSearchParams()
  const [tab,        setTab]        = useState(0)
  const [viewMode,   setViewMode]   = useState('list') // 'list' or 'map'
  const [highlightRequest, setHighlightRequest] = useState(null)

  // Lire les search params pour navigation depuis les notifications
  useEffect(() => {
    const paramTab = searchParams.get('tab')
    const paramReq = searchParams.get('request')
    if (paramTab === null && !paramReq) return
    if (paramTab !== null) setTab(parseInt(paramTab, 10))
    if (paramReq) {
      setHighlightRequest(paramReq)
      setTimeout(() => {
        document.getElementById(`request-${paramReq}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 500)
      setTimeout(() => setHighlightRequest(null), 5000)
    }
    setSearchParams({}, { replace: true })
  }, [searchParams])
  const [offerPrice, setOfferPrice] = useState({})
  const [offerMsg,   setOfferMsg]   = useState({})
  const [uploading,  setUploading]  = useState({})
  const [starVal,    setStarVal]    = useState(0)
  const [starHover,  setStarHover]  = useState(0)
  const [chatRequest, setChatRequest] = useState(null)
  const [openMission, setOpenMission] = useState(null) // id de la mission ouverte
  const [editRadius, setEditRadius] = useState(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [editAddr,     setEditAddr]     = useState('')
  const [editCity,     setEditCity]     = useState('')
  const [editProv,     setEditProv]     = useState('')
  const [editPostal,   setEditPostal]   = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [completing, setCompleting] = useState(null)
  const [uploadingDoc, setUploadingDoc] = useState(null) // 'selfie' | 'id_card'
  const [reviewData, setReviewData] = useState({}) // { [requestId]: { rating, comment } }
  const [reviewHover, setReviewHover] = useState({}) // { [requestId]: hoverStar }
  const [submittingReview, setSubmittingReview] = useState(null)
  const [editingOffer, setEditingOffer] = useState(null) // request id
  const [editOfferPrice, setEditOfferPrice] = useState('')
  const [editOfferMsg, setEditOfferMsg] = useState('')
  const [savingOffer, setSavingOffer] = useState(false)
  const [expandedReq, setExpandedReq] = useState(null)
  // Bancaire
  const [editingBank, setEditingBank] = useState(false)
  const [bankForm, setBankForm] = useState({})
  const [savingBank, setSavingBank] = useState(false)

  // Helpers pour les cartes de demande
  function isAutoUrgent(req) {
    if (req.is_urgent) return true
    const scheduled = new Date(`${req.scheduled_date}T${req.scheduled_time || '12:00'}`)
    const diff = scheduled - new Date()
    return diff > 0 && diff < 48 * 60 * 60 * 1000
  }

  function getDistance(req) {
    if (!profile?.lat || !profile?.lng || !req.chalet?.lat || !req.chalet?.lng) return null
    return haversineDistance(
      { lat: profile.lat, lng: profile.lng },
      { lat: req.chalet.lat, lng: req.chalet.lng }
    )
  }

  async function handleDocUpload(type, e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingDoc(type)
    try {
      const ext = file.name.split('.').pop()
      const path = `${profile.id}/${type}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('id-documents')
        .upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage
        .from('id-documents')
        .getPublicUrl(path)
      const field = type === 'selfie' ? 'selfie_url' : 'id_card_url'
      await updateProfile({ [field]: publicUrl })
      toast(`📸 ${type === 'selfie' ? 'Selfie' : 'Pièce d\'identité'} téléversé(e) !`, 'success')
    } catch (err) {
      toast(`❌ ${err.message}`, 'error')
    } finally {
      setUploadingDoc(null)
    }
  }

  // Demandes ouvertes filtrées par rayon
  const openReqs = useMemo(() => getOpenRequestsNearby(profile), [requests, profile])
  // Mes missions en cours
  const myActive = useMemo(() => requests.filter(r =>
    r.assigned_pro_id === profile?.id && ['confirmed','in_progress'].includes(r.status)
  ), [requests, profile])
  // Mes missions complétées
  const myCompleted = useMemo(() => requests.filter(r =>
    r.assigned_pro_id === profile?.id && r.status === 'completed'
  ), [requests, profile])
  const totalEarned = useMemo(() => myCompleted.reduce((sum, r) => sum + (parseFloat(r.agreed_price) || 0), 0), [myCompleted])
  const myReviews = useMemo(() => myCompleted.flatMap(r => r.reviews || []).filter(r => r.reviewee_id === profile?.id), [myCompleted, profile])
  const avgRating = useMemo(() => myReviews.length > 0
    ? (myReviews.reduce((s, r) => s + r.rating, 0) / myReviews.length).toFixed(1)
    : null, [myReviews])

  async function handleOffer(requestId) {
    // Vérifier que le pro a configuré ses infos bancaires
    if (!profile?.bank_name) {
      toast('💳 Ajoutez vos informations bancaires avant de soumettre une offre', 'info')
      setTab(1) // Aller à l'onglet Profil
      return
    }
    const price = parseFloat(offerPrice[requestId])
    if (!price || price <= 0) return toast('⚠️ Entrez un prix valide', 'error')
    try {
      await submitOffer(requestId, price, offerMsg[requestId] || '')
      toast('💰 Offre envoyée !', 'success')
      setOfferPrice(p => ({ ...p, [requestId]: '' }))
      setOfferMsg(m => ({ ...m, [requestId]: '' }))
    } catch (err) {
      toast(`❌ ${err.message}`, 'error')
    }
  }

  async function handleReview(requestId, ownerId) {
    const data = reviewData[requestId]
    if (!data?.rating) return toast('⚠️ Sélectionnez une note', 'error')
    setSubmittingReview(requestId)
    try {
      await submitReview(requestId, ownerId, data.rating, data.comment || '')
      toast('⭐ Évaluation envoyée ! Merci !', 'success')
    } catch (err) {
      toast(`❌ ${err.message}`, 'error')
    } finally {
      setSubmittingReview(null)
    }
  }

  async function handleUpdateOffer(offerId) {
    const price = parseFloat(editOfferPrice)
    if (!price || price <= 0) return toast('⚠️ Entrez un prix valide', 'error')
    setSavingOffer(true)
    try {
      await updateOffer(offerId, price, editOfferMsg || '')
      toast('✅ Offre modifiée !', 'success')
      setEditingOffer(null)
    } catch (err) {
      toast(`❌ ${err.message}`, 'error')
    } finally {
      setSavingOffer(false)
    }
  }

  async function handlePhoto(requestId, templateId, e) {
    const file = e.target.files?.[0]
    if (!file) return
    const key = `${requestId}-${templateId}`
    setUploading(u => ({ ...u, [key]: true }))
    try {
      await uploadRoomPhoto(requestId, templateId, file)
      toast('📸 Photo téléversée et pièce validée !', 'success')
    } catch (err) {
      toast(`❌ ${err.message}`, 'error')
    } finally {
      setUploading(u => ({ ...u, [key]: false }))
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-9">
      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-2xl font-800 text-gray-900 tracking-tight">Espace professionnel 🧹</h1>
          <p className="text-sm text-gray-400 mt-1">
            Bonjour {profile?.first_name} •{' '}
            <span className={profile?.verif_status === 'approved' ? 'text-green-600 font-600' : 'text-amber-500 font-600'}>
              {profile?.verif_status === 'approved' ? '✅ Vérifié·e' : '⏳ Vérification en cours'}
            </span>
          </p>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-4 py-2.5 text-sm font-600 border-b-2 -mb-px transition-all whitespace-nowrap ${
              tab === i ? 'border-teal text-teal' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Onglet 0 : Demandes ── */}
      {tab === 0 && (
        <div>
          {/* Missions actives */}
          {myActive.length > 0 && (
            <div className="mb-5">
              <h2 className="text-sm font-700 text-gray-400 uppercase tracking-wide mb-3">
                Mes missions ({myActive.length})
              </h2>

              {myActive.map(req => {
                const tasks = req.chalet?.checklist_templates || []
                const completions = req.checklist_completions || []
                const done = completions.filter(c => c.is_done && c.photo_url).length
                const pct = tasks.length > 0 ? Math.round(done / tasks.length * 100) : 0
                const isOpen = openMission === req.id

                return (
                  <div key={req.id} className="card mb-4 border-teal border">
                    {/* En-tête compact (toujours visible) */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="pill-active mb-2 inline-block">🔵 Mission en cours</span>
                        <h3 className="font-700 text-gray-900">🏔 {req.chalet?.name}</h3>
                        <p className="text-xs text-gray-400">
                          {req.chalet?.city} — {req.scheduled_date ? new Date(req.scheduled_date).toLocaleDateString('fr-CA', { weekday:'short', day:'numeric', month:'short' }) : ''} à {req.scheduled_time}
                        </p>
                      </div>
                      <p className="text-xl font-800 text-teal">{req.agreed_price} $</p>
                    </div>

                    {/* Barre de progression (toujours visible) */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-gray-400">{done} / {tasks.length} pièces complétées</span>
                        <span className="text-teal font-700">{pct}%</span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-teal to-teal-light rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    {pct === 100 && (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-3 text-sm text-green-700 font-600">
                        🎉 Checklist complète ! 💸 <strong>{req.agreed_price}$</strong> en cours de versement.
                      </div>
                    )}

                    {/* Bouton terminer la mission manuellement */}
                    <button
                      onClick={async () => {
                        if (!confirm('Terminer cette mission et la transférer à l\'historique ?')) return
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
                      className="w-full py-2.5 mb-2 text-sm font-700 rounded-xl border-2 border-green-500 text-green-700 bg-green-50 hover:bg-green-100 transition-all disabled:opacity-50"
                    >
                      {completing === req.id ? '⏳ Transfert...' : '✅ Terminer → Historique'}
                    </button>

                    {/* Bouton ouvrir / fermer */}
                    <button
                      onClick={() => setOpenMission(isOpen ? null : req.id)}
                      className="btn-teal w-full py-3 text-sm font-700 mb-2"
                    >
                      {isOpen ? '▲ Fermer la mission' : `▼ Ouvrir la mission — Checklist & Photos`}
                    </button>

                    {/* Vue détaillée (quand ouvert) */}
                    {isOpen && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        {/* Infos planification */}
                        <div className="bg-gray-50 rounded-xl px-4 py-3 flex gap-5 flex-wrap text-xs text-gray-400 mb-3">
                          <span>🗓 {req.scheduled_date ? new Date(req.scheduled_date).toLocaleDateString('fr-CA', { weekday:'long', day:'numeric', month:'long' }) : ''}</span>
                          <span>⏰ {req.scheduled_time}</span>
                          {req.deadline_time && <span>⏱ Limite : {req.deadline_time}</span>}
                          {req.estimated_hours && <span>~{req.estimated_hours}h</span>}
                        </div>

                        {/* Détails accès */}
                        <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-3 text-xs text-green-700 space-y-1">
                          <p className="font-700">🔑 Détails d'accès</p>
                          <p>📍 {req.chalet?.address}, {req.chalet?.city}</p>
                          {req.chalet?.access_code && <p>🔑 Code porte : <strong>{req.chalet.access_code}</strong></p>}
                          {req.chalet?.key_box && <p>📦 Boîte à clé : {req.chalet.key_box}</p>}
                          {req.chalet?.parking_info && <p>🅿️ Stationnement : {req.chalet.parking_info}</p>}
                          {req.chalet?.wifi_name && <p>🌐 Wi-Fi : {req.chalet.wifi_name} • {req.chalet.wifi_password}</p>}
                          {req.chalet?.special_notes && <p>⚠️ Notes : {req.chalet.special_notes}</p>}
                        </div>

                        {/* Produits sur place */}
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

                        {/* Lavage */}
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

                        {/* Spa */}
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
                          <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
                            📝 {req.special_notes}
                          </div>
                        )}

                        {/* Checklist avec photos */}
                        <div className="bg-teal/5 border border-teal/20 rounded-xl p-4 mb-4 mt-4">
                          <div className="flex items-center justify-between mb-4">
                            <p className="text-sm font-700 text-gray-800">Checklist du ménage 📸</p>
                            <span className="text-xs font-700 text-teal bg-teal/10 px-2.5 py-1 rounded-lg">
                              {done}/{tasks.length} complétées
                            </span>
                          </div>

                          <div className="space-y-3">
                            {tasks.map((template, idx) => {
                              const comp = completions.find(c => c.template_id === template.id)
                              const isDone = comp?.is_done && comp?.photo_url
                              const key = `${req.id}-${template.id}`

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
                                        {isDone ? 'Complétée avec photo' : 'Photo obligatoire pour valider'}
                                      </p>
                                    </div>
                                    {isDone && <CheckCircle size={20} className="text-teal flex-shrink-0" />}
                                  </div>

                                  {/* Photo de référence du proprio */}
                                  {template.reference_photo_url && (
                                    <div className="px-4 pb-2">
                                      <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-2">
                                        <img
                                          src={template.reference_photo_url}
                                          alt={`Réf: ${template.room_name}`}
                                          onClick={() => window.open(template.reference_photo_url, '_blank')}
                                          className="w-12 h-12 object-cover rounded-md border border-blue-300 cursor-pointer hover:opacity-80 flex-shrink-0"
                                        />
                                        <p className="text-[10px] text-blue-600 font-600">📌 Photo de référence — cliquez pour agrandir</p>
                                      </div>
                                    </div>
                                  )}

                                  {/* Zone photo */}
                                  <div className="px-4 pb-3">
                                    {isDone ? (
                                      /* Photo prise - afficher miniature */
                                      <div className="flex items-center gap-3 bg-green-50 rounded-xl p-3">
                                        <img
                                          src={comp.photo_url}
                                          alt={template.room_name}
                                          className="w-16 h-16 rounded-lg object-cover border-2 border-teal/30"
                                        />
                                        <div className="flex-1">
                                          <p className="text-xs font-600 text-green-700">Photo validée</p>
                                          <p className="text-xs text-green-600">
                                            {comp.completed_at ? new Date(comp.completed_at).toLocaleString('fr-CA', { hour:'2-digit', minute:'2-digit' }) : ''}
                                          </p>
                                        </div>
                                        {/* Reprendre la photo */}
                                        <label className="cursor-pointer text-xs text-gray-400 hover:text-teal transition-colors">
                                          Reprendre
                                          <input type="file" accept="image/*" className="hidden"
                                            onChange={e => handlePhoto(req.id, template.id, e)} />
                                        </label>
                                      </div>
                                    ) : (
                                      /* Pas encore complétée - boutons photo */
                                      <div className="flex gap-2">
                                        {/* Prendre une photo (caméra) */}
                                        <label className={`flex-1 cursor-pointer flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed transition-all ${
                                          uploading[key] ? 'border-gray-200 bg-gray-50 opacity-60' : 'border-teal/40 bg-teal/5 hover:bg-teal/10 hover:border-teal'
                                        }`}>
                                          <Camera size={18} className="text-teal" />
                                          <span className="text-sm font-700 text-teal">
                                            {uploading[key] ? 'Envoi...' : 'Prendre une photo'}
                                          </span>
                                          <input type="file" accept="image/*" capture="environment" className="hidden"
                                            disabled={uploading[key]}
                                            onChange={e => handlePhoto(req.id, template.id, e)} />
                                        </label>

                                        {/* Choisir une photo (galerie) */}
                                        <label className={`flex-1 cursor-pointer flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed transition-all ${
                                          uploading[key] ? 'border-gray-200 bg-gray-50 opacity-60' : 'border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400'
                                        }`}>
                                          <span className="text-base">🖼</span>
                                          <span className="text-sm font-600 text-gray-600">
                                            {uploading[key] ? 'Envoi...' : 'Choisir une photo'}
                                          </span>
                                          <input type="file" accept="image/*" className="hidden"
                                            disabled={uploading[key]}
                                            onChange={e => handlePhoto(req.id, template.id, e)} />
                                        </label>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Bouton chat */}
                        <button
                          onClick={() => setChatRequest({ id: req.id, chaletName: req.chalet?.name })}
                          className="btn-secondary text-xs flex items-center gap-2"
                        >
                          <MessageSquare size={14} /> Envoyer un message au propriétaire
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Demandes ouvertes */}
          <div className="flex items-center justify-between mb-3 mt-5">
            <h2 className="text-sm font-700 text-gray-400 uppercase tracking-wide">
              Demandes à proximité ({openReqs.length})
            </h2>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-700 transition-all ${
                  viewMode === 'list' ? 'bg-white text-teal shadow-sm' : 'text-gray-400'
                }`}>
                <List size={13} /> Liste
              </button>
              <button onClick={() => setViewMode('map')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-700 transition-all ${
                  viewMode === 'map' ? 'bg-white text-teal shadow-sm' : 'text-gray-400'
                }`}>
                <Map size={13} /> Carte
              </button>
            </div>
          </div>

          {/* Vue carte */}
          {viewMode === 'map' && (
            <div className="mb-5">
              <Suspense fallback={<div className="h-96 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400">🗺️ Chargement de la carte...</div>}>
                <MapView
                  requests={openReqs}
                  proLat={profile?.lat}
                  proLng={profile?.lng}
                  radius={profile?.radius_km || 25}
                  onRequestClick={(reqId) => {
                    setViewMode('list')
                    setTimeout(() => {
                      document.getElementById(`request-${reqId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }, 100)
                  }}
                />
              </Suspense>
              <p className="text-xs text-gray-400 text-center mt-2">Cliquez sur un 🏔 pour voir les détails</p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-3xl">⏳</div>
          ) : openReqs.length === 0 ? (
            <div className="card text-center py-10">
              <p className="text-3xl mb-2">📍</p>
              <p className="font-700 text-gray-600">Aucune demande dans votre zone</p>
              <p className="text-sm text-gray-400 mt-1">Vous recevrez une notification dès qu'une demande est publiée près de chez vous.</p>
            </div>
          ) : viewMode === 'list' ? (
            openReqs.map(req => {
              const dist = getDistance(req)
              const urgent = isAutoUrgent(req)
              const laundryCount = req.laundry_tasks?.length || 0
              const hasSpa = req.spa_tasks?.length > 0
              const hasNotes = !!req.special_notes
              const isExpanded = expandedReq === req.id

              return (
              <div key={req.id} id={`request-${req.id}`} className={`card mb-4 hover:border-teal transition-all ${highlightRequest === req.id ? 'ring-2 ring-teal ring-offset-2' : ''}`}>
                {/* A. Header — nom, ville, chambres, sdb, urgence */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-700 text-gray-900">🏔 {req.chalet?.name}</h3>
                    <p className="text-xs text-gray-400">{req.chalet?.city} • {req.chalet?.bedrooms || '?'} ch. • {req.chalet?.bathrooms || '?'} sdb</p>
                  </div>
                  {urgent && (
                    <span className="pill-coral">
                      {req.is_urgent ? '🔴 Urgent' : '🔴 < 48h'}
                    </span>
                  )}
                </div>

                {/* B. Grille 4 stats clés */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  <div className="bg-gray-50 rounded-xl px-2 py-2.5 text-center">
                    <p className="text-base mb-0.5">📍</p>
                    <p className="text-sm font-800 text-gray-900">{dist != null ? `${dist.toFixed(1)} km` : '—'}</p>
                    <p className="text-[10px] text-gray-400">Distance</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl px-2 py-2.5 text-center">
                    <p className="text-base mb-0.5">💰</p>
                    <p className="text-sm font-800 text-gray-900">{req.suggested_budget ? `${req.suggested_budget} $` : '—'}</p>
                    <p className="text-[10px] text-gray-400">Budget</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl px-2 py-2.5 text-center">
                    <p className="text-base mb-0.5">🗓</p>
                    <p className="text-sm font-800 text-gray-900">{new Date(req.scheduled_date).toLocaleDateString('fr-CA', { day:'numeric', month:'short' })}</p>
                    <p className="text-[10px] text-gray-400">{new Date(req.scheduled_date).toLocaleDateString('fr-CA', { weekday:'short' })}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl px-2 py-2.5 text-center">
                    <p className="text-base mb-0.5">⏱</p>
                    <p className="text-sm font-800 text-gray-900">~{req.estimated_hours || '?'}h</p>
                    <p className="text-[10px] text-gray-400">Durée</p>
                  </div>
                </div>

                {/* C. Tags résumé compacts */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-lg">⏰ {req.scheduled_time}</span>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-lg">📸 Photo/pièce</span>
                  {laundryCount > 0 && (
                    <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-1 rounded-lg">🧺 Lavage ({laundryCount})</span>
                  )}
                  {hasSpa && (
                    <span className="text-xs bg-purple-50 text-purple-600 border border-purple-200 px-2 py-1 rounded-lg">♨️ Spa</span>
                  )}
                  {hasNotes && (
                    <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2 py-1 rounded-lg">📝 Notes</span>
                  )}
                </div>

                {/* D. Bouton "Consulter la demande" */}
                <button
                  onClick={() => setExpandedReq(isExpanded ? null : req.id)}
                  className="w-full text-left text-sm font-600 text-teal hover:text-teal/80 transition-colors flex items-center gap-1.5 mb-3 py-1">
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {isExpanded ? 'Masquer les détails' : 'Consulter la demande →'}
                </button>

                {/* E. Section pliable — détails complets */}
                {isExpanded && (
                  <div className="border-t border-gray-100 pt-3 mb-3 space-y-3">
                    {/* Produits sur place */}
                    {req.supplies_on_site?.length > 0 && (
                      <div>
                        <p className="text-xs font-700 text-gray-400 mb-1.5">🧴 Produits sur place :</p>
                        <div className="flex flex-wrap gap-1.5">
                          {req.supplies_on_site.map((s, i) => (
                            <span key={i} className={`text-xs px-2 py-1 rounded-lg ${
                              s.available ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-500 border border-red-200 line-through'
                            }`}>{s.name}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Lavage détaillé */}
                    {laundryCount > 0 && (
                      <div>
                        <p className="text-xs font-700 text-gray-400 mb-1.5">🧺 Lavage à faire :</p>
                        <div className="flex flex-wrap gap-1.5">
                          {req.laundry_tasks.map((l, i) => (
                            <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-lg">{l.name}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Spa détaillé */}
                    {hasSpa && (
                      <div>
                        <p className="text-xs font-700 text-gray-400 mb-1.5">♨️ Entretien spa :</p>
                        <div className="flex flex-wrap gap-1.5">
                          {req.spa_tasks.map((s, i) => (
                            <span key={i} className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-1 rounded-lg">{s.name}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes spéciales */}
                    {hasNotes && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
                        📝 {req.special_notes}
                      </div>
                    )}

                    {/* Checklist des pièces avec photos de référence */}
                    {req.chalet?.checklist_templates?.length > 0 && (
                      <div>
                        <p className="text-xs font-700 text-gray-400 mb-2">🏠 Pièces à nettoyer ({req.chalet.checklist_templates.length}) :</p>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {req.chalet.checklist_templates.sort((a, b) => a.position - b.position).map(t => (
                            <div key={t.id} className="text-center">
                              {t.reference_photo_url ? (
                                <img
                                  src={t.reference_photo_url}
                                  alt={t.room_name}
                                  onClick={() => window.open(t.reference_photo_url, '_blank')}
                                  className="w-full h-14 object-cover rounded-lg border border-teal/30 cursor-pointer hover:border-teal hover:shadow-sm transition-all"
                                />
                              ) : (
                                <div className="w-full h-14 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center">
                                  <Camera size={16} className="text-gray-300" />
                                </div>
                              )}
                              <p className="text-[10px] font-600 text-gray-500 mt-1 truncate">{t.room_name}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* F. Faire une offre / statut offre */}
                {(() => {
                  const myOffer = req.offers?.find(o => o.pro_id === profile?.id)
                  // Offre acceptée : soit status='accepted', soit la demande est confirmée et le pro est assigné
                  if (myOffer?.status === 'accepted' || (myOffer && req.status === 'confirmed' && req.assigned_pro_id === profile?.id)) {
                    return (
                      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-600">
                        ✅ Offre acceptée — {myOffer.price} $ • La mission apparaîtra dans vos missions actives.
                      </div>
                    )
                  }
                  if (myOffer?.status === 'pending') {
                    if (editingOffer === req.id) {
                      return (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                          <p className="text-sm font-700 text-amber-700 mb-3">✏️ Modifier votre offre</p>
                          <div className="flex gap-2 items-center mb-3">
                            <div className="flex-1 relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-700 text-sm">$</span>
                              <input
                                type="number"
                                placeholder="Nouveau prix"
                                value={editOfferPrice}
                                onChange={e => setEditOfferPrice(e.target.value)}
                                className="input-field-teal pl-7"
                              />
                            </div>
                          </div>
                          <textarea
                            className="input-field-teal text-xs min-h-12 resize-none mb-3 w-full"
                            placeholder="Message (optionnel)"
                            value={editOfferMsg}
                            onChange={e => setEditOfferMsg(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateOffer(myOffer.id)}
                              disabled={savingOffer}
                              className="btn-teal text-xs disabled:opacity-60">
                              {savingOffer ? '⏳...' : '💾 Sauvegarder'}
                            </button>
                            <button onClick={() => setEditingOffer(null)}
                              className="btn-secondary text-xs">Annuler</button>
                          </div>
                        </div>
                      )
                    }
                    return (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-700 text-amber-700">Offre envoyée — {myOffer.price} $</p>
                          <p className="text-xs text-amber-500">En attente de réponse du propriétaire</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingOffer(req.id)
                              setEditOfferPrice(myOffer.price?.toString() || '')
                              setEditOfferMsg(myOffer.message || '')
                            }}
                            className="text-xs font-600 text-amber-700 bg-amber-100 px-3 py-1.5 rounded-lg hover:bg-amber-200 transition-all">
                            ✏️ Modifier
                          </button>
                          <span className="text-2xl">⏳</span>
                        </div>
                      </div>
                    )
                  }
                  if (myOffer?.status === 'declined') {
                    return (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-400">
                        Offre non retenue — {myOffer.price} $
                      </div>
                    )
                  }
                  return (
                    <div className="flex gap-2 items-center">
                      <div className="flex-1 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-700 text-sm">$</span>
                        <input
                          type="number"
                          placeholder="Votre prix"
                          value={offerPrice[req.id] || ''}
                          onChange={e => setOfferPrice(p => ({ ...p, [req.id]: e.target.value }))}
                          className="input-field-teal pl-7"
                        />
                      </div>
                      <button
                        onClick={() => handleOffer(req.id)}
                        className="btn-teal flex-shrink-0 whitespace-nowrap">
                        💰 Faire une offre
                      </button>
                    </div>
                  )
                })()}
              </div>
              )
            })
          ) : null}
        </div>
      )}

      {/* ── Onglet 1 : Profil & Vérification ── */}
      {tab === 1 && (
        <div>
          {/* Étapes */}
          <div className="flex gap-2 mb-5 flex-wrap">
            {[
              { label: 'Infos personnelles', done: true },
              { label: 'Zone de travail', done: true },
              { label: 'Vérification identité', done: profile?.verif_status === 'approved' },
              { label: 'Infos bancaires', done: !!profile?.bank_name },
            ].map((s,i) => (
              <span key={i} className={`text-xs font-700 px-3 py-1.5 rounded-full border ${
                s.done ? 'border-teal text-teal bg-teal/5' : 'border-amber-300 text-amber-600 bg-amber-50'
              }`}>{s.done ? '✅' : '⚠️'} {s.label}</span>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-sm text-blue-700">
            <strong>🛡️ Vérification d'identité requise</strong>
            <p className="text-xs mt-1">Pour la sécurité des propriétaires. Vos documents sont chiffrés et jamais partagés.</p>
          </div>

          <div className="card mb-4">
            <h3 className="font-700 text-gray-900 mb-4">📸 Documents requis</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { type:'selfie', icon:'🤳', title:'Selfie', sub:'Visage visible, bonne lumière', done: !!profile?.selfie_url, url: profile?.selfie_url },
                { type:'id_card', icon:'🪪', title:'Pièce d\'identité', sub:'Passeport, permis ou carte officielle', done: !!profile?.id_card_url, url: profile?.id_card_url },
              ].map(box => (
                <div key={box.type} className={`border-2 rounded-xl p-4 text-center transition-all ${
                  box.done ? 'border-teal bg-teal/5' : 'border-dashed border-gray-200'
                }`}>
                  {box.done && box.url ? (
                    <>
                      <img src={box.url} alt={box.title} className="w-16 h-16 rounded-xl object-cover mx-auto mb-2 border-2 border-teal/30" />
                      <p className="text-sm font-700 text-teal">✅ {box.title}</p>
                      <label className="cursor-pointer text-xs text-gray-400 hover:text-teal transition-colors mt-1 inline-block">
                        Remplacer
                        <input type="file" accept="image/*" className="hidden"
                          onChange={e => handleDocUpload(box.type, e)} />
                      </label>
                    </>
                  ) : (
                    <label className="cursor-pointer block">
                      <div className="text-3xl mb-2">{uploadingDoc === box.type ? '⏳' : box.icon}</div>
                      <p className="text-sm font-700 text-gray-800">
                        {uploadingDoc === box.type ? 'Envoi...' : box.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{box.sub}</p>
                      <div className="mt-2 flex items-center justify-center gap-1 text-xs text-teal font-600">
                        <Upload size={12} /> Téléverser
                      </div>
                      <input type="file" accept="image/*" className="hidden"
                        disabled={uploadingDoc === box.type}
                        onChange={e => handleDocUpload(box.type, e)} />
                    </label>
                  )}
                </div>
              ))}
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-4 text-xs text-gray-400">
              <p className="font-700 text-gray-700 mb-2">📋 Critères acceptés</p>
              <div className="grid grid-cols-2 gap-1">
                <span>✅ Document officiel gouvernemental</span><span>✅ Non expiré</span>
                <span>✅ 4 coins entièrement visibles</span><span>✅ Texte et photo lisibles</span>
                <span>❌ Pas de photocopie</span><span>❌ Pas de reflets/flash</span>
              </div>
            </div>

            <div className={`rounded-xl p-3 flex items-center gap-3 mb-4 ${
              profile?.verif_status === 'approved'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-amber-50 border border-amber-200 text-amber-700'
            }`}>
              <span className="text-2xl">{profile?.verif_status === 'approved' ? '✅' : '⏳'}</span>
              <div className="text-xs">
                <p className="font-700">{profile?.verif_status === 'approved' ? 'Identité vérifiée !' : 'Vérification en cours'}</p>
                <p>{profile?.verif_status === 'approved' ? 'Vous pouvez recevoir des demandes.' : 'Réponse par courriel sous 24h.'}</p>
              </div>
            </div>

            <button
              onClick={async () => {
                if (!profile?.selfie_url || !profile?.id_card_url) {
                  return toast('⚠️ Téléversez votre selfie et pièce d\'identité avant de soumettre', 'error')
                }
                try {
                  await updateProfile({ verif_status: 'pending' })
                  toast('📤 Documents soumis pour vérification ! Réponse sous 24h.', 'success')
                } catch (err) {
                  toast(`❌ ${err.message}`, 'error')
                }
              }}
              disabled={profile?.verif_status === 'pending' || profile?.verif_status === 'approved'}
              className="btn-teal w-full py-3 disabled:opacity-60">
              {profile?.verif_status === 'approved'
                ? '✅ Identité vérifiée'
                : profile?.verif_status === 'pending'
                  ? '⏳ Vérification en cours...'
                  : '📤 Soumettre pour vérification'}
            </button>
          </div>

          {/* Infos profil */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-700 text-gray-900">👤 Informations personnelles</h3>
              <span className="pill-active">✅ Complété</span>
            </div>
            {[
              { icon:'👤', label:'Nom complet', val: `${profile?.first_name || ''} ${profile?.last_name || ''}` },
              { icon:'📍', label:'Adresse', val: [profile?.address, profile?.city, profile?.province, profile?.postal_code].filter(Boolean).join(', ') || 'Non définie' },
              { icon:'🗣️', label:'Langues', val: profile?.languages?.join(', ') || 'Non défini' },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-100 mb-2">
                <span>{row.icon}</span>
                <span className="text-xs font-700 text-gray-400 w-28 flex-shrink-0">{row.label}</span>
                <span className="text-sm font-600 text-gray-800">{row.val}</span>
              </div>
            ))}

            {/* Rayon éditable */}
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-100 mb-2">
              <span>📏</span>
              <span className="text-xs font-700 text-gray-400 w-28 flex-shrink-0">Rayon</span>
              {editRadius !== null ? (
                <div className="flex items-center gap-3 flex-1">
                  <input type="range" min={5} max={100} step={5}
                    value={editRadius}
                    onChange={e => setEditRadius(parseInt(e.target.value))}
                    className="flex-1 accent-teal" />
                  <span className="text-sm font-700 text-teal w-14 text-right">{editRadius} km</span>
                  <button onClick={async () => {
                    try {
                      await updateProfile({ radius_km: editRadius })
                      toast('📏 Rayon mis à jour !', 'success')
                      setEditRadius(null)
                    } catch (err) { toast(`❌ ${err.message}`, 'error') }
                  }} className="text-xs font-700 text-white bg-teal px-3 py-1 rounded-lg">OK</button>
                  <button onClick={() => setEditRadius(null)} className="text-xs text-gray-400">Annuler</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm font-600 text-gray-800">{profile?.radius_km || 25} km</span>
                  <button onClick={() => setEditRadius(profile?.radius_km || 25)}
                    className="text-xs text-teal font-600 hover:underline ml-2">Modifier</button>
                </div>
              )}
            </div>

            {/* Modifier adresse */}
            {editingProfile ? (
              <div className="mt-4 bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h4 className="text-sm font-700 text-gray-700 mb-3">Modifier l'adresse</h4>
                <div className="mb-3">
                  <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1">Adresse</label>
                  <input className="input-field-teal" value={editAddr} onChange={e => setEditAddr(e.target.value)} placeholder="123 Rue Principale" />
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1">Ville</label>
                    <input className="input-field-teal" value={editCity} onChange={e => setEditCity(e.target.value)} placeholder="Mont-Tremblant" />
                  </div>
                  <div>
                    <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1">Province</label>
                    <select className="input-field-teal" value={editProv} onChange={e => setEditProv(e.target.value)}>
                      <option value="">Sélectionnez...</option>
                      {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1">Code postal</label>
                  <input className="input-field-teal w-40" value={editPostal} onChange={e => setEditPostal(e.target.value.toUpperCase())} placeholder="J8E 1T4" maxLength={7} />
                </div>
                <div className="flex gap-2">
                  <button disabled={savingProfile} onClick={async () => {
                    if (!editAddr || !editCity || !editProv) return toast('⚠️ Remplissez tous les champs', 'error')
                    setSavingProfile(true)
                    try {
                      const coords = await geocodeAddress({ address: editAddr, city: editCity, province: editProv, postalCode: editPostal })
                      await updateProfile({
                        address: editAddr, city: editCity, province: editProv, postal_code: editPostal,
                        zone: editCity,
                        lat: coords?.lat || null, lng: coords?.lng || null,
                      })
                      toast('✅ Adresse mise à jour !', 'success')
                      setEditingProfile(false)
                    } catch (err) { toast(`❌ ${err.message}`, 'error') }
                    finally { setSavingProfile(false) }
                  }} className="btn-teal text-xs">{savingProfile ? '⏳...' : '💾 Sauvegarder'}</button>
                  <button onClick={() => setEditingProfile(false)} className="btn-secondary text-xs">Annuler</button>
                </div>
              </div>
            ) : (
              <button onClick={() => {
                setEditAddr(profile?.address || '')
                setEditCity(profile?.city || '')
                setEditProv(profile?.province || '')
                setEditPostal(profile?.postal_code || '')
                setEditingProfile(true)
              }} className="btn-secondary text-xs mt-3 inline-block">✏️ Modifier le profil</button>
            )}
          </div>

          {/* Informations bancaires */}
          <div className="card mt-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-700 text-gray-900">💳 Informations bancaires</h3>
              {profile?.bank_name ? (
                <span className="pill-active">✅ Configuré</span>
              ) : (
                <span className="text-xs font-700 px-3 py-1 rounded-full border border-amber-300 text-amber-600 bg-amber-50">⚠️ Requis pour soumettre des offres</span>
              )}
            </div>

            {profile?.bank_name && !editingBank ? (
              <>
                {[
                  { icon: '👤', label: 'Titulaire', val: profile.bank_name },
                  { icon: '🏦', label: 'Institution', val: profile.bank_institution || '—' },
                  { icon: '🔢', label: 'Transit', val: profile.bank_transit ? '•••' + profile.bank_transit.slice(-2) : '—' },
                  { icon: '💰', label: 'Compte', val: profile.bank_account ? '••••••' + profile.bank_account.slice(-4) : '—' },
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-100 mb-2">
                    <span>{row.icon}</span>
                    <span className="text-xs font-700 text-gray-400 w-24 flex-shrink-0">{row.label}</span>
                    <span className="text-sm font-600 text-gray-800">{row.val}</span>
                  </div>
                ))}
                <button onClick={() => {
                  setEditingBank(true)
                  setBankForm({
                    bank_name: profile.bank_name || '',
                    bank_institution: profile.bank_institution || '',
                    bank_transit: profile.bank_transit || '',
                    bank_account: profile.bank_account || '',
                  })
                }} className="btn-secondary text-xs mt-3 inline-block">✏️ Modifier</button>
              </>
            ) : (
              <div className={profile?.bank_name ? '' : 'mt-0'}>
                {!profile?.bank_name && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 mb-4">
                    💡 Ajoutez vos informations bancaires pour pouvoir soumettre des offres et recevoir vos paiements.
                  </div>
                )}
                <div className="mb-3">
                  <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1">Nom du titulaire</label>
                  <input className="input-field-teal" placeholder="Marie Lapointe"
                    value={bankForm.bank_name || ''} onChange={e => setBankForm(f => ({ ...f, bank_name: e.target.value }))} />
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1">Institution bancaire</label>
                  <select className="input-field-teal" value={bankForm.bank_institution || ''} onChange={e => setBankForm(f => ({ ...f, bank_institution: e.target.value }))}>
                    <option value="">Sélectionnez...</option>
                    <option>Desjardins</option><option>Banque Nationale</option><option>TD</option>
                    <option>RBC</option><option>BMO</option><option>Scotiabank</option><option>Autre</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1">Transit (5 chiffres)</label>
                    <input className="input-field-teal" placeholder="12345" maxLength={5}
                      value={bankForm.bank_transit || ''} onChange={e => setBankForm(f => ({ ...f, bank_transit: e.target.value.replace(/\D/g, '') }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1">Numéro de compte</label>
                    <input className="input-field-teal" placeholder="0012345678" maxLength={12}
                      value={bankForm.bank_account || ''} onChange={e => setBankForm(f => ({ ...f, bank_account: e.target.value.replace(/\D/g, '') }))} />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button disabled={savingBank} onClick={async () => {
                    if (!bankForm.bank_name) return toast('⚠️ Nom du titulaire requis', 'error')
                    if (!bankForm.bank_transit || bankForm.bank_transit.length < 5) return toast('⚠️ Transit requis (5 chiffres)', 'error')
                    if (!bankForm.bank_account || bankForm.bank_account.length < 7) return toast('⚠️ Numéro de compte requis (min 7 chiffres)', 'error')
                    setSavingBank(true)
                    try {
                      await updateProfile(bankForm)
                      toast('✅ Informations bancaires enregistrées !', 'success')
                      setEditingBank(false)
                    } catch (err) { toast(`❌ ${err.message}`, 'error') }
                    finally { setSavingBank(false) }
                  }} className="btn-teal text-xs">{savingBank ? '⏳...' : '💾 Enregistrer'}</button>
                  {profile?.bank_name && (
                    <button onClick={() => setEditingBank(false)} className="btn-secondary text-xs">Annuler</button>
                  )}
                </div>

                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-700 mt-4">
                  🔐 Vos informations bancaires sont sécurisées et utilisées uniquement pour les virements de paiement.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Onglet 2 : Missions complétées ── */}
      {tab === 2 && (
        <div>
          {/* Stats résumé */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="card text-center py-4">
              <p className="text-2xl font-800 text-teal">{myCompleted.length}</p>
              <p className="text-xs text-gray-400 mt-1">Missions</p>
            </div>
            <div className="card text-center py-4">
              <p className="text-2xl font-800 text-green-600">{totalEarned.toFixed(0)} $</p>
              <p className="text-xs text-gray-400 mt-1">Total gagné</p>
            </div>
            <div className="card text-center py-4">
              <p className="text-2xl font-800 text-amber-500">{avgRating || '—'} ★</p>
              <p className="text-xs text-gray-400 mt-1">{myReviews.length} évaluation{myReviews.length > 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Évaluations reçues */}
          {myReviews.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-700 text-gray-400 uppercase tracking-wide mb-3">⭐ Évaluations reçues</h3>
              {myReviews.map((rev, i) => {
                const req = myCompleted.find(r => r.id === rev.request_id)
                return (
                  <div key={i} className="card mb-3 border-amber-200 border">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-700 text-gray-800">🏔 {req?.chalet?.name || 'Chalet'}</p>
                        <p className="text-xs text-gray-400">
                          {req?.chalet?.city} • {req?.scheduled_date ? new Date(req.scheduled_date).toLocaleDateString('fr-CA', { day:'numeric', month:'short', year:'numeric' }) : ''}
                        </p>
                      </div>
                      <div className="flex gap-0.5">
                        {Array.from({length: 5}).map((_, j) => (
                          <Star key={j} size={14} className={j < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
                        ))}
                      </div>
                    </div>
                    {rev.comment && (
                      <p className="text-sm text-gray-600 leading-relaxed bg-amber-50 rounded-lg px-3 py-2">"{rev.comment}"</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Liste missions complétées */}
          <h3 className="text-sm font-700 text-gray-400 uppercase tracking-wide mb-3">📋 Historique des missions</h3>

          {myCompleted.length === 0 ? (
            <div className="card text-center py-10">
              <p className="text-3xl mb-2">📋</p>
              <p className="font-700 text-gray-600">Aucune mission complétée</p>
              <p className="text-sm text-gray-400 mt-1">Vos missions terminées apparaîtront ici avec vos gains.</p>
            </div>
          ) : (
            myCompleted.map(req => {
              const tasks = req.chalet?.checklist_templates || []
              const completions = req.checklist_completions || []
              const review = req.reviews?.find(r => r.reviewee_id === profile?.id)
              const isExpanded = openMission === `done-${req.id}`

              return (
                <div key={req.id} className="card mb-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-700 text-gray-900 text-sm">🏔 {req.chalet?.name}</h4>
                      <p className="text-xs text-gray-400">
                        {req.chalet?.city} — {req.scheduled_date ? new Date(req.scheduled_date).toLocaleDateString('fr-CA', { weekday:'short', day:'numeric', month:'short' }) : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-800 text-green-600">{req.agreed_price} $</p>
                      {review && (
                        <div className="flex gap-0.5 justify-end mt-0.5">
                          {Array.from({length: 5}).map((_, j) => (
                            <Star key={j} size={10} className={j < review.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Recap rapide */}
                  <div className="flex flex-wrap gap-2 text-xs mb-2">
                    <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-lg">✓ {tasks.length} pièces</span>
                    {req.supplies_on_site?.length > 0 && (
                      <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-lg">🧴 {req.supplies_on_site.length} produits</span>
                    )}
                    {req.laundry_tasks?.length > 0 && (
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg">🧺 {req.laundry_tasks.length} lavage</span>
                    )}
                    {req.spa_tasks?.length > 0 && (
                      <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-lg">♨️ Spa</span>
                    )}
                  </div>

                  {/* Bouton voir les photos */}
                  <button
                    onClick={() => setOpenMission(isExpanded ? null : `done-${req.id}`)}
                    className="w-full py-2 text-xs font-600 text-teal bg-teal/5 border border-teal/20 rounded-lg hover:bg-teal/10 transition-all"
                  >
                    {isExpanded ? '▲ Fermer' : '📸 Voir mes photos'}
                  </button>

                  {/* Photos galerie */}
                  {isExpanded && (
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {tasks.map(template => {
                        const comp = completions.find(c => c.template_id === template.id)
                        return (
                          <div key={template.id} className="relative">
                            {comp?.photo_url ? (
                              <img
                                src={comp.photo_url}
                                alt={template.room_name}
                                className="w-full h-24 object-cover rounded-lg border border-teal/20 cursor-pointer hover:opacity-90"
                                onClick={() => window.open(comp.photo_url, '_blank')}
                              />
                            ) : (
                              <div className="w-full h-24 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300">
                                <Camera size={18} />
                              </div>
                            )}
                            <p className="text-[10px] text-gray-500 text-center mt-0.5 truncate">{template.room_name}</p>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Évaluation du propriétaire */}
                  {(() => {
                    const myReview = req.reviews?.find(r => r.reviewer_id === profile?.id)
                    const rd = reviewData[req.id] || {}
                    const rh = reviewHover[req.id] || 0
                    if (myReview) {
                      return (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-3">
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
                      )
                    }
                    return req.owner_id ? (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-3">
                        <p className="text-xs font-700 text-gray-700 mb-2">⭐ Évaluer le propriétaire</p>
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
                          className="input-field text-xs min-h-16 resize-none mb-2 w-full"
                          placeholder="Un commentaire ? (optionnel)"
                          value={rd.comment || ''}
                          onChange={e => setReviewData(d => ({ ...d, [req.id]: { ...d[req.id], comment: e.target.value } }))}
                        />
                        <button
                          onClick={() => handleReview(req.id, req.owner_id)}
                          disabled={submittingReview === req.id}
                          className="btn-teal text-xs py-2 disabled:opacity-60"
                        >
                          {submittingReview === req.id ? '⏳...' : '⭐ Envoyer l\'évaluation'}
                        </button>
                      </div>
                    ) : null
                  })()}
                </div>
              )
            })
          )}
        </div>
      )}

      {chatRequest && (
        <ChatPanel
          requestId={chatRequest.id}
          chaletName={chatRequest.chaletName}
          onClose={() => setChatRequest(null)}
        />
      )}

      <Toast toasts={toasts} />
    </div>
  )
}
