import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChalets } from '../hooks/useChalets'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'
import { PROVINCES, isValidPostalCode } from '../lib/constants'
import { geocodeAddress } from '../lib/geocode'

const DEFAULT_ROOMS = [
  'Cuisine', 'Salon', 'Salle de bain principale',
  'Chambre principale', 'Chambre 2', 'Entrée / Couloir'
]

export default function NewChalet() {
  const { createChalet, saveChecklistTemplate } = useChalets()
  const { toasts, toast } = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState(1)

  // Infos de base
  const [name,      setName]      = useState('')
  const [address,   setAddress]   = useState('')
  const [city,      setCity]      = useState('')
  const [province,    setProvince]    = useState('')
  const [postalCode,  setPostalCode]  = useState('')
  const [bedrooms,  setBedrooms]  = useState('2')
  const [bathrooms, setBathrooms] = useState('1')

  // Accès
  const [accessCode,   setAccessCode]   = useState('')
  const [keyBox,       setKeyBox]       = useState('')
  const [parkingInfo,  setParkingInfo]  = useState('')
  const [wifiName,     setWifiName]     = useState('')
  const [wifiPassword, setWifiPassword] = useState('')
  const [specialNotes, setSpecialNotes] = useState('')

  // Checklist
  const [rooms, setRooms] = useState(DEFAULT_ROOMS)
  const [newRoom, setNewRoom] = useState('')

  function addRoom() {
    if (!newRoom.trim()) return
    setRooms(r => [...r, newRoom.trim()])
    setNewRoom('')
  }

  function removeRoom(i) {
    setRooms(r => r.filter((_, idx) => idx !== i))
  }

  function validateStep1() {
    if (!name)     return toast('⚠️ Nom du chalet requis', 'error')
    if (!address)  return toast('⚠️ Adresse requise', 'error')
    if (!city)     return toast('⚠️ Ville requise', 'error')
    if (!province) return toast('⚠️ Province requise', 'error')
    if (!isValidPostalCode(postalCode)) return toast('⚠️ Code postal invalide (ex: J8E 1T4)', 'error')
    return true
  }

  async function handleSubmit() {
    if (rooms.length === 0) return toast('⚠️ Ajoutez au moins une pièce', 'error')
    setBusy(true)
    try {
      const coords = await geocodeAddress({ address, city, province, postalCode })
      const chalet = await createChalet({
        name,
        address,
        city,
        province,
        postal_code: postalCode,
        lat: coords?.lat || null,
        lng: coords?.lng || null,
        bedrooms:  parseInt(bedrooms),
        bathrooms: parseInt(bathrooms),
        access_code:    accessCode,
        key_box:        keyBox,
        parking_info:   parkingInfo,
        wifi_name:      wifiName,
        wifi_password:  wifiPassword,
        special_notes:  specialNotes,
      })
      await saveChecklistTemplate(chalet.id, rooms)
      toast('🎉 Chalet ajouté avec succès !', 'success')
      setTimeout(() => navigate('/dashboard'), 1200)
    } catch (err) {
      toast(`❌ ${err.message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-9">
      <div className="flex items-center gap-3 mb-7">
        <button onClick={() => step > 1 ? setStep(s => s-1) : navigate('/dashboard')}
          className="text-gray-400 hover:text-gray-700 text-sm">← Retour</button>
        <h1 className="text-2xl font-800 text-gray-900">Ajouter un chalet 🏔</h1>
      </div>

      {/* Indicateur étapes */}
      <div className="flex gap-2 mb-8">
        {['Informations', 'Accès', 'Checklist'].map((label, i) => (
          <div key={label} className="flex-1 text-center">
            <div className={`h-1.5 rounded-full mb-2 ${step > i ? 'bg-coral' : step === i+1 ? 'bg-coral' : 'bg-gray-200'}`} />
            <span className={`text-xs font-600 ${step === i+1 ? 'text-coral' : 'text-gray-400'}`}>{label}</span>
          </div>
        ))}
      </div>

      {/* ── ÉTAPE 1 : Informations ── */}
      {step === 1 && (
        <div className="card">
          <h2 className="font-700 text-gray-900 mb-5">📋 Informations du chalet</h2>

          <div className="mb-4">
            <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Nom du chalet *</label>
            <input className="input-field" placeholder="Ex: Chalet des Laurentides" value={name} onChange={e=>setName(e.target.value)} />
          </div>

          <div className="mb-4">
            <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Adresse complète *</label>
            <input className="input-field" placeholder="123 Chemin du Lac" value={address} onChange={e=>setAddress(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Ville *</label>
              <input className="input-field" placeholder="Mont-Tremblant" value={city} onChange={e=>setCity(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Province *</label>
              <select className="input-field" value={province} onChange={e=>setProvince(e.target.value)}>
                <option value="">Sélectionnez...</option>
                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Code postal *</label>
            <input className="input-field w-40" placeholder="J8E 1T4" maxLength={7} value={postalCode} onChange={e=>setPostalCode(e.target.value.toUpperCase())} />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div>
              <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Chambres</label>
              <select className="input-field" value={bedrooms} onChange={e=>setBedrooms(e.target.value)}>
                {['1','2','3','4','5','6+'].map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Salles de bain</label>
              <select className="input-field" value={bathrooms} onChange={e=>setBathrooms(e.target.value)}>
                {['1','2','3','4+'].map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <button onClick={() => validateStep1() && setStep(2)}
            className="btn-primary w-full py-3">
            Continuer → Accès
          </button>
        </div>
      )}

      {/* ── ÉTAPE 2 : Accès ── */}
      {step === 2 && (
        <div className="card">
          <h2 className="font-700 text-gray-900 mb-2">🔑 Détails d'accès</h2>
          <p className="text-sm text-gray-400 mb-5">Ces informations seront envoyées automatiquement au professionnel accepté.</p>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 mb-5">
            🔒 Informations chiffrées et sécurisées — jamais visibles publiquement.
          </div>

          <div className="mb-4">
            <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Code de porte / serrure</label>
            <input className="input-field" placeholder="Ex: 1234" value={accessCode} onChange={e=>setAccessCode(e.target.value)} />
          </div>

          <div className="mb-4">
            <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Boîte à clé (si applicable)</label>
            <input className="input-field" placeholder="Ex: Boîte rouge près de la porte, code 5678" value={keyBox} onChange={e=>setKeyBox(e.target.value)} />
          </div>

          <div className="mb-4">
            <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Stationnement</label>
            <input className="input-field" placeholder="Ex: Stationnement à gauche de l'entrée" value={parkingInfo} onChange={e=>setParkingInfo(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Nom réseau Wi-Fi</label>
              <input className="input-field" placeholder="ChaletWifi" value={wifiName} onChange={e=>setWifiName(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Mot de passe Wi-Fi</label>
              <input className="input-field" placeholder="motdepasse123" value={wifiPassword} onChange={e=>setWifiPassword(e.target.value)} />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Notes spéciales</label>
            <textarea className="input-field min-h-20 resize-none" placeholder="Ex: Chien dans la maison, sonnette ne fonctionne pas, entrée par côté..."
              value={specialNotes} onChange={e=>setSpecialNotes(e.target.value)} />
          </div>

          <button onClick={() => setStep(3)} className="btn-primary w-full py-3">
            Continuer → Checklist
          </button>
        </div>
      )}

      {/* ── ÉTAPE 3 : Checklist ── */}
      {step === 3 && (
        <div className="card">
          <h2 className="font-700 text-gray-900 mb-2">✅ Checklist des pièces</h2>
          <p className="text-sm text-gray-400 mb-5">Le professionnel devra cocher chaque pièce avec une photo obligatoire.</p>

          <div className="space-y-2 mb-4">
            {rooms.map((room, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-teal/10 border border-teal/30 flex items-center justify-center text-xs font-700 text-teal">
                    {i+1}
                  </div>
                  <span className="text-sm font-600 text-gray-700">{room}</span>
                </div>
                <button onClick={() => removeRoom(i)}
                  className="text-gray-300 hover:text-coral text-lg font-700 transition-colors">×</button>
              </div>
            ))}
          </div>

          {/* Ajouter une pièce */}
          <div className="flex gap-2 mb-6">
            <input
              className="input-field flex-1"
              placeholder="Ex: Sous-sol, Patio, Garage..."
              value={newRoom}
              onChange={e => setNewRoom(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addRoom()}
            />
            <button onClick={addRoom} className="btn-teal flex-shrink-0">+ Ajouter</button>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 mb-5">
            📸 Une photo est obligatoire par pièce pour valider le ménage et déclencher le paiement automatique.
          </div>

          <button
            onClick={handleSubmit}
            disabled={busy}
            className="btn-primary w-full py-3 text-base disabled:opacity-60"
          >
            {busy ? '⏳ Création...' : '🏔 Créer mon chalet'}
          </button>
        </div>
      )}

      <Toast toasts={toasts} />
    </div>
  )
}
