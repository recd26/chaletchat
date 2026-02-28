import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useChalets } from '../hooks/useChalets'
import { useRequests } from '../hooks/useRequests'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'
import { Plus, Lock, Eye, EyeOff, MessageSquare } from 'lucide-react'
import ChatPanel from '../components/ChatPanel'

const TABS = ['Mes chalets', '🔑 Accès', '💳 Paiement']

export default function Dashboard() {
  const { profile } = useAuth()
  const { chalets, loading: loadChalets } = useChalets()
  const { requests, loading: loadReqs, acceptOffer } = useRequests()
  const { toasts, toast } = useToast()
  const [tab, setTab] = useState(0)
  const [showCode, setShowCode] = useState({})
  const [chatRequest, setChatRequest] = useState(null)

  function toggleCode(id) {
    setShowCode(prev => ({ ...prev, [id]: !prev[id] }))
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
          <Link to="/nouvelle-demande" className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={15} /> Demande
          </Link>
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
              const req = myRequests.find(r => r.chalet_id === chalet.id && r.status !== 'completed')
              const offers = req?.offers || []
              const done = req?.checklist_completions?.filter(c => c.is_done && c.photo_url)?.length || 0
              const total = chalet.checklist_templates?.length || 0
              const pct = total > 0 ? Math.round(done / total * 100) : 0

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
                      <div className="bg-gray-50 rounded-xl px-4 py-3 flex gap-5 flex-wrap text-xs text-gray-400 mb-4">
                        <span>🗓 {new Date(req.scheduled_date).toLocaleDateString('fr-CA', { weekday:'short', day:'numeric', month:'short' })}</span>
                        <span>⏰ {req.scheduled_time}</span>
                        {req.estimated_hours && <span>⏱ ~{req.estimated_hours}h</span>}
                      </div>

                      {/* Checklist progress */}
                      {total > 0 && (
                        <div className="mb-4">
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-gray-400">{done} / {total} pièces avec photos</span>
                            <span className="text-teal font-700">{pct}%</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-teal to-teal-light rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }} />
                          </div>
                          {pct === 100 && (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-3 mt-3 text-xs text-green-700">
                              ⚡ <strong>Checklist 100% !</strong> {req.agreed_price}$ libérés automatiquement.
                            </div>
                          )}
                        </div>
                      )}

                      {/* Offres */}
                      {offers.length > 0 && (
                        <div>
                          <p className="text-sm font-700 text-gray-800 mb-2">Offres reçues ({offers.length})</p>
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
                                  <button className="text-xs font-600 bg-gray-100 text-gray-400 px-3 py-1.5 rounded-lg">Profil</button>
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
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3 mb-4">
              <span className="text-2xl">✅</span>
              <div>
                <p className="text-sm font-700 text-green-700">Carte enregistrée</p>
                <p className="text-xs text-green-600">Visa se terminant par •••• 4242 • Paiements automatiques activés</p>
              </div>
            </div>
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

      <Toast toasts={toasts} />
    </div>
  )
}
