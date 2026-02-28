import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useChalets } from '../hooks/useChalets'
import { useRequests } from '../hooks/useRequests'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'
import { Plus, Lock, Eye, EyeOff, MessageSquare, CreditCard, X, Star, MapPin, Clock, Languages, CheckCircle, Camera } from 'lucide-react'
import ChatPanel from '../components/ChatPanel'
import StripeCardForm from '../components/StripeCardForm'
import { supabase } from '../lib/supabase'

const TABS = ['Mes chalets', '🔑 Accès', '💳 Paiement']

export default function Dashboard() {
  const { profile } = useAuth()
  const { chalets, loading: loadChalets } = useChalets()
  const { requests, loading: loadReqs, acceptOffer } = useRequests()
  const { toasts, toast } = useToast()
  const navigate = useNavigate()
  const [tab, setTab] = useState(0)
  const [showCode, setShowCode] = useState({})
  const [chatRequest, setChatRequest] = useState(null)
  const [savedCard, setSavedCard] = useState(
    profile?.stripe_customer_id ? { last4: '4242', brand: 'Visa', name: profile.first_name } : null
  )
  const [showCardForm, setShowCardForm] = useState(false)
  const [viewingPro, setViewingPro] = useState(null) // profil pro à afficher
  const [openRequest, setOpenRequest] = useState(null) // id de la demande ouverte

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
      setTab(2)
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

  const myRequests = requests.filter(r =>
    chalets.some(c => c.id === r.chalet_id)
  )

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
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-4 py-2.5 text-sm font-600 border-b-2 -mb-px transition-all ${
              tab === i ? 'border-coral text-coral' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Onglet 0 : Mes chalets ── */}
      {tab === 0 && (
        <div>
          {loadChalets ? (
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
              const req = chaletReqs.find(r => r.status !== 'completed') || chaletReqs[0]
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
                        <span className={`pill-${req.status === 'completed' ? 'done' : req.status === 'open' ? 'pending' : 'active'}`}>
                          {req.status === 'open' ? '⏳ En attente' : req.status === 'confirmed' ? '✅ Confirmé' : req.status === 'completed' ? '✔ Complété' : req.status}
                        </span>
                      ) : (
                        <span className="pill-done">Aucune demande</span>
                      )}
                    </div>
                  </div>

                  {req && (
                    <>
                      {/* Info demande */}
                      <div className="bg-gray-50 rounded-xl px-4 py-3 flex gap-5 flex-wrap text-xs text-gray-400 mb-3">
                        <span>🗓 {new Date(req.scheduled_date).toLocaleDateString('fr-CA', { weekday:'short', day:'numeric', month:'short' })}</span>
                        <span>⏰ {req.scheduled_time}</span>
                        {req.estimated_hours && <span>⏱ ~{req.estimated_hours}h</span>}
                        {req.agreed_price && <span className="text-teal font-700">💰 {req.agreed_price} $</span>}
                      </div>

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
                        const accepted = offers.find(o => o.status === 'accepted')
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

                      {/* Offres en attente (seulement si demande ouverte) */}
                      {req.status === 'open' && offers.filter(o => o.status === 'pending').length > 0 && (
                        <div>
                          <p className="text-sm font-700 text-gray-800 mb-2">Offres reçues ({offers.filter(o => o.status === 'pending').length})</p>
                          {offers.filter(o => o.status === 'pending').map(offer => (
                            <div key={offer.id} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 mb-2 hover:border-coral transition-all">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-coral-light to-amber-300 flex items-center justify-center text-lg">👩</div>
                                <div>
                                  <p className="text-sm font-700 text-gray-800">{offer.pro?.first_name} {offer.pro?.last_name}</p>
                                  <p className="text-xs text-amber-500">★★★★★ 4.9</p>
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

      {/* ── Onglet 1 : Accès ── */}
      {tab === 1 && (
        <div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-sm text-blue-700">
            🔒 <strong>Envoi automatique et sécurisé</strong> — Les détails d'accès sont transmis uniquement au professionnel accepté, dès l'acceptation de son offre.
          </div>

          {chalets.map(chalet => (
            <div key={chalet.id} className="card mb-4">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-700 text-gray-900">🏔 {chalet.name}</h3>
                  <p className="text-xs text-gray-400">{chalet.city}</p>
                </div>
                {chalet.access_code
                  ? <span className="pill-active">✅ Accès configuré</span>
                  : <span className="pill-pending">⏳ Non configuré</span>}
              </div>

              {chalet.access_code ? (
                <div className="space-y-2">
                  {[
                    { icon:'📍', label:'Adresse', val: chalet.address },
                    { icon:'🔑', label:'Code porte', val: chalet.access_code, secret: true, id: chalet.id },
                    { icon:'📦', label:'Boîte à clé', val: chalet.key_box },
                    { icon:'🅿️', label:'Stationnement', val: chalet.parking_info },
                    { icon:'🌐', label:'Wi-Fi', val: chalet.wifi_name ? `${chalet.wifi_name} • ${chalet.wifi_password}` : null, secret: true, id: `wifi-${chalet.id}` },
                    { icon:'⚠️', label:'Notes', val: chalet.special_notes },
                  ].filter(r => r.val).map(row => (
                    <div key={row.label} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-100">
                      <span className="text-base">{row.icon}</span>
                      <span className="text-xs font-700 text-gray-400 w-24 flex-shrink-0">{row.label}</span>
                      <span className="text-sm font-600 text-gray-800 flex-1">
                        {row.secret ? (showCode[row.id] ? row.val : '••••••') : row.val}
                      </span>
                      {row.secret && (
                        <button onClick={() => toggleCode(row.id)} className="text-gray-400 hover:text-gray-600">
                          {showCode[row.id] ? <EyeOff size={14}/> : <Eye size={14}/>}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 mb-3">
                  ⚠️ Configurez les accès — ils seront envoyés automatiquement au prochain pro accepté.
                </div>
              )}

              <button
                onClick={() => toast('💾 Formulaire d\'édition des accès — à compléter avec React Hook Form', 'info')}
                className="btn-secondary text-xs mt-3">
                {chalet.access_code ? '✏️ Modifier' : '➕ Configurer les accès'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Onglet 2 : Paiement ── */}
      {tab === 2 && (
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

              {/* Évaluations placeholder */}
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <Star size={16} className="text-amber-500" />
                <span className="text-sm font-600 text-amber-700">Évaluations à venir</span>
              </div>
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
