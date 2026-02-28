import { useState, lazy, Suspense } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useRequests } from '../hooks/useRequests'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'
import { Camera, CheckCircle, Star, Map, List, MessageSquare } from 'lucide-react'
import ChatPanel from '../components/ChatPanel'
import { PROVINCES } from '../lib/constants'
import { geocodeAddress } from '../lib/geocode'

const MapView = lazy(() => import('../components/MapView'))

const TABS = ['Demandes à proximité', 'Mon profil & vérification', 'Mes évaluations']

export default function ProDashboard() {
  const { profile, updateProfile } = useAuth()
  const { requests, loading, submitOffer, updateChecklistItem, uploadRoomPhoto, getOpenRequestsNearby } = useRequests()
  const { toasts, toast } = useToast()

  const [tab,        setTab]        = useState(0)
  const [viewMode,   setViewMode]   = useState('list') // 'list' or 'map'
  const [offerPrice, setOfferPrice] = useState({})
  const [offerMsg,   setOfferMsg]   = useState({})
  const [uploading,  setUploading]  = useState({})
  const [starVal,    setStarVal]    = useState(0)
  const [starHover,  setStarHover]  = useState(0)
  const [chatRequest, setChatRequest] = useState(null)
  const [editRadius, setEditRadius] = useState(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [editAddr,     setEditAddr]     = useState('')
  const [editCity,     setEditCity]     = useState('')
  const [editProv,     setEditProv]     = useState('')
  const [editPostal,   setEditPostal]   = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // Demandes ouvertes filtrées par rayon
  const openReqs = getOpenRequestsNearby(profile)
  // Mes missions en cours
  const myActive = requests.filter(r =>
    r.assigned_pro_id === profile?.id && ['confirmed','in_progress'].includes(r.status)
  )

  async function handleOffer(requestId) {
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
          {/* Missions actives en premier */}
          {myActive.map(req => {
            const tasks = req.chalet?.checklist_templates || []
            const completions = req.checklist_completions || []
            const done = completions.filter(c => c.is_done && c.photo_url).length
            const pct = tasks.length > 0 ? Math.round(done / tasks.length * 100) : 0

            return (
              <div key={req.id} className="card mb-4 border-teal border">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="pill-active mb-2 inline-block">🔵 Mission en cours</span>
                    <h3 className="font-700 text-gray-900">🏔 {req.chalet?.name}</h3>
                    <p className="text-xs text-gray-400">{req.chalet?.city}</p>
                  </div>
                  <p className="text-xl font-800 text-teal">{req.agreed_price} $</p>
                </div>

                {/* Détails accès (envoyés automatiquement) */}
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-xs text-green-700">
                  🔑 <strong>Détails d'accès reçus :</strong> {req.chalet?.address}
                  {req.chalet?.access_code && ` • Code : ${req.chalet.access_code}`}
                </div>

                {/* Checklist avec photos */}
                <p className="text-sm font-700 text-gray-800 mb-3">Checklist — Photo par pièce obligatoire 📸</p>
                <div className="space-y-2 mb-4">
                  {tasks.map(template => {
                    const comp = completions.find(c => c.template_id === template.id)
                    const isDone = comp?.is_done && comp?.photo_url
                    const key = `${req.id}-${template.id}`

                    return (
                      <div key={template.id}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                          isDone ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                        }`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-800 ${
                            isDone ? 'bg-teal border-teal text-white' : 'bg-white border-gray-200 text-gray-400'
                          }`}>
                            {isDone ? '✓' : ''}
                          </div>
                          <span className="text-sm font-600 text-gray-700">{template.room_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isDone ? (
                            <span className="text-xs text-teal font-700">📸 fait</span>
                          ) : (
                            <>
                              <span className="text-xs text-amber-500 font-700">📸 requis</span>
                              <label className={`cursor-pointer bg-teal text-white text-xs font-700 px-3 py-1.5 rounded-lg hover:opacity-90 transition-all flex items-center gap-1 ${uploading[key] ? 'opacity-60 cursor-wait' : ''}`}>
                                <Camera size={12} />
                                {uploading[key] ? '...' : 'Photo'}
                                <input type="file" accept="image/*" className="hidden"
                                  onChange={e => handlePhoto(req.id, template.id, e)} />
                              </label>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Progression */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-gray-400">{done} / {tasks.length} pièces avec photos</span>
                    <span className="text-teal font-700">{pct}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-teal to-teal-light rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {pct === 100 && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700 font-600">
                    🎉 Checklist complète ! 💸 <strong>{req.agreed_price}$</strong> en cours de versement.
                  </div>
                )}

                {/* Bouton chat */}
                <button
                  onClick={() => setChatRequest({ id: req.id, chaletName: req.chalet?.name })}
                  className="btn-secondary text-xs flex items-center gap-2 mt-3"
                >
                  <MessageSquare size={14} /> Envoyer un message
                </button>
              </div>
            )
          })}

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
            openReqs.map(req => (
              <div key={req.id} className="card mb-4 hover:border-teal transition-all">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-700 text-gray-900">🏔 {req.chalet?.name}</h3>
                    <p className="text-xs text-gray-400">{req.chalet?.city} • {req.chalet?.bedrooms} ch.</p>
                  </div>
                  {req.is_urgent && <span className="pill-coral">🔴 Urgent</span>}
                </div>

                <div className="bg-gray-50 rounded-xl px-4 py-3 flex gap-5 flex-wrap text-xs text-gray-400 mb-4">
                  <span>🗓 {new Date(req.scheduled_date).toLocaleDateString('fr-CA', { weekday:'short', day:'numeric', month:'short' })}</span>
                  <span>⏰ {req.scheduled_time}</span>
                  {req.estimated_hours && <span>⏱ ~{req.estimated_hours}h</span>}
                  <span>📸 Photo par pièce</span>
                </div>

                {/* Faire une offre */}
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
              </div>
            ))
          ) : null}
        </div>
      )}

      {/* ── Onglet 1 : Profil & Vérification ── */}
      {tab === 1 && (
        <div>
          {/* Étapes */}
          <div className="flex gap-2 mb-5 flex-wrap">
            {['✅ Infos personnelles','✅ Zone de travail','📸 Vérification identité','💳 Infos bancaires'].map((s,i) => (
              <span key={i} className={`text-xs font-700 px-3 py-1.5 rounded-full border ${
                s.startsWith('✅') ? 'border-teal text-teal bg-teal/5' :
                s.startsWith('📸') ? 'border-coral text-coral bg-coral/5' :
                'border-gray-200 text-gray-400'
              }`}>{s}</span>
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
                { icon:'🤳', title:'Selfie', sub:'Visage visible, bonne lumière', done: !!profile?.selfie_url },
                { icon:'🪪', title:'Pièce d\'identité', sub:'Passeport, permis ou carte officielle', done: !!profile?.id_card_url },
              ].map(box => (
                <div key={box.title}
                  className={`border-2 rounded-xl p-4 text-center transition-all ${
                    box.done ? 'border-teal bg-teal/5' : 'border-dashed border-gray-200 hover:border-teal hover:bg-teal/3 cursor-pointer'
                  }`}
                  onClick={() => !box.done && toast('📁 Upload vers Supabase Storage à intégrer ici', 'info')}>
                  <div className="text-3xl mb-2">{box.icon}</div>
                  <p className="text-sm font-700 text-gray-800">{box.done ? `✅ ${box.title}` : box.title}</p>
                  <p className="text-xs text-gray-400 mt-1">{box.sub}</p>
                  {box.done && <div className="w-5 h-5 bg-teal rounded-full flex items-center justify-center text-white text-xs mx-auto mt-2">✓</div>}
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

            <button onClick={() => toast('📤 Documents soumis pour vérification !', 'success')}
              className="btn-teal w-full py-3">
              📤 Soumettre pour vérification
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
        </div>
      )}

      {/* ── Onglet 2 : Évaluations ── */}
      {tab === 2 && (
        <div>
          <div className="card mb-4">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal to-teal-light flex items-center justify-center text-2xl">🧹</div>
              <div>
                <p className="text-xl font-800 text-gray-900">4.9 ★</p>
                <p className="text-sm text-gray-400">Basé sur 127 évaluations</p>
              </div>
            </div>

            {/* Exemple d'évaluations */}
            {[
              { owner:'Jean-François M.', rating:5, comment:'Impeccable ! Toutes les photos envoyées, très minutieuse.', date:'22 fév 2026', chalet:'Chalet des Laurentides' },
              { owner:'Sylvie B.', rating:5, comment:'Ponctuelle et très professionnelle. Je recommande!', date:'15 fév 2026', chalet:'Chalet Boreal' },
              { owner:'Marc T.', rating:4, comment:'Excellent travail, quelques détails mineurs mais très satisfait.', date:'8 fév 2026', chalet:'Chalet du Lac' },
            ].map((rev, i) => (
              <div key={i} className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-700 text-gray-800">{rev.owner}</p>
                    <p className="text-xs text-gray-400">{rev.chalet} • {rev.date}</p>
                  </div>
                  <div className="flex gap-0.5">
                    {Array.from({length:5}).map((_,j) => (
                      <Star key={j} size={14} className={j < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{rev.comment}</p>
              </div>
            ))}
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

      <Toast toasts={toasts} />
    </div>
  )
}
