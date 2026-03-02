import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useChalets } from '../hooks/useChalets'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'
import { Camera } from 'lucide-react'
import { PROVINCES } from '../lib/constants'
import { geocodeAddress } from '../lib/geocode'

const TABS = ['📋 Infos', '🔑 Accès', '✅ Checklist']

export default function EditChalet() {
  const { id } = useParams()
  const { chalets, updateChalet, saveChecklistTemplate, uploadReferencePhoto } = useChalets()
  const { toasts, toast } = useToast()
  const navigate = useNavigate()
  const [tab, setTab] = useState(0)
  const [busy, setBusy] = useState(false)

  const chalet = chalets.find(c => c.id === id)

  // Infos
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

  // Checklist — chaque pièce = { name, photoUrl, file }
  const [rooms,   setRooms]   = useState([])
  const [newRoom, setNewRoom] = useState('')

  useEffect(() => {
    if (!chalet) return
    setName(chalet.name || '')
    setAddress(chalet.address || '')
    setCity(chalet.city || '')
    setProvince(chalet.province || '')
    setPostalCode(chalet.postal_code || '')
    setBedrooms(String(chalet.bedrooms || 2))
    setBathrooms(String(chalet.bathrooms || 1))
    setAccessCode(chalet.access_code || '')
    setKeyBox(chalet.key_box || '')
    setParkingInfo(chalet.parking_info || '')
    setWifiName(chalet.wifi_name || '')
    setWifiPassword(chalet.wifi_password || '')
    setSpecialNotes(chalet.special_notes || '')
    setRooms(chalet.checklist_templates?.map(t => ({ name: t.room_name, photoUrl: t.reference_photo_url || null, file: null })) || [])
  }, [chalet])

  function addRoom() {
    if (!newRoom.trim()) return
    setRooms(r => [...r, { name: newRoom.trim(), photoUrl: null, file: null }])
    setNewRoom('')
  }

  function handleRoomPhoto(i, e) {
    const file = e.target.files?.[0]
    if (!file) return
    const preview = URL.createObjectURL(file)
    setRooms(r => r.map((room, idx) => idx === i ? { ...room, file, photoUrl: preview } : room))
  }

  function removeRoomPhoto(i) {
    setRooms(r => r.map((room, idx) => idx === i ? { ...room, file: null, photoUrl: null } : room))
  }

  async function saveInfos() {
    if (!name || !address || !city) return toast('⚠️ Remplissez tous les champs obligatoires', 'error')
    setBusy(true)
    try {
      const coords = await geocodeAddress({ address, city, province, postalCode })
      await updateChalet(id, {
        name, address, city, province,
        postal_code: postalCode,
        lat: coords?.lat || null,
        lng: coords?.lng || null,
        bedrooms: parseInt(bedrooms),
        bathrooms: parseInt(bathrooms),
      })
      toast('✅ Informations sauvegardées !', 'success')
    } catch (err) { toast(`❌ ${err.message}`, 'error') }
    finally { setBusy(false) }
  }

  async function saveAccess() {
    setBusy(true)
    try {
      await updateChalet(id, { access_code: accessCode, key_box: keyBox, parking_info: parkingInfo, wifi_name: wifiName, wifi_password: wifiPassword, special_notes: specialNotes })
      toast('✅ Accès sauvegardés !', 'success')
    } catch (err) { toast(`❌ ${err.message}`, 'error') }
    finally { setBusy(false) }
  }

  async function saveChecklist() {
    if (rooms.length === 0) return toast('⚠️ Ajoutez au moins une pièce', 'error')
    setBusy(true)
    try {
      // Upload les nouvelles photos
      const roomsWithUrls = await Promise.all(
        rooms.map(async (room) => {
          if (room.file) {
            const url = await uploadReferencePhoto(id, room.file)
            return { name: room.name, photoUrl: url }
          }
          return { name: room.name, photoUrl: room.photoUrl }
        })
      )
      await saveChecklistTemplate(id, roomsWithUrls)
      toast('✅ Checklist sauvegardée !', 'success')
    } catch (err) { toast(`❌ ${err.message}`, 'error') }
    finally { setBusy(false) }
  }

  if (!chalet) return (
    <div className="max-w-2xl mx-auto px-6 py-9 text-center">
      <div className="text-4xl mb-3">⏳</div>
      <p className="text-gray-400">Chargement...</p>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-6 py-9">
      <div className="flex items-center gap-3 mb-7">
        <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-gray-700 text-sm">← Retour</button>
        <h1 className="text-2xl font-800 text-gray-900">✏️ Modifier — {chalet.name}</h1>
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

      {/* ── Tab 0 : Infos ── */}
      {tab === 0 && (
        <div className="card">
          <div className="mb-4">
            <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Nom du chalet *</label>
            <input className="input-field" value={name} onChange={e=>setName(e.target.value)} />
          </div>
          <div className="mb-4">
            <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Adresse *</label>
            <input className="input-field" value={address} onChange={e=>setAddress(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Ville *</label>
              <input className="input-field" value={city} onChange={e=>setCity(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Province</label>
              <select className="input-field" value={province} onChange={e=>setProvince(e.target.value)}>
                <option value="">Sélectionnez...</option>
                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Code postal</label>
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
          <button onClick={saveInfos} disabled={busy} className="btn-primary w-full py-3 disabled:opacity-60">
            {busy ? '⏳ Sauvegarde...' : '💾 Sauvegarder les informations'}
          </button>
        </div>
      )}

      {/* ── Tab 1 : Accès ── */}
      {tab === 1 && (
        <div className="card">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 mb-5">
            🔒 Informations transmises uniquement au professionnel accepté.
          </div>
          <div className="mb-4">
            <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Code de porte</label>
            <input className="input-field" placeholder="Ex: 1234" value={accessCode} onChange={e=>setAccessCode(e.target.value)} />
          </div>
          <div className="mb-4">
            <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Boîte à clé</label>
            <input className="input-field" placeholder="Ex: Boîte rouge, code 5678" value={keyBox} onChange={e=>setKeyBox(e.target.value)} />
          </div>
          <div className="mb-4">
            <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Stationnement</label>
            <input className="input-field" placeholder="Ex: À gauche de l'entrée" value={parkingInfo} onChange={e=>setParkingInfo(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Nom Wi-Fi</label>
              <input className="input-field" value={wifiName} onChange={e=>setWifiName(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Mot de passe Wi-Fi</label>
              <input className="input-field" value={wifiPassword} onChange={e=>setWifiPassword(e.target.value)} />
            </div>
          </div>
          <div className="mb-6">
            <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Notes spéciales</label>
            <textarea className="input-field min-h-20 resize-none" value={specialNotes} onChange={e=>setSpecialNotes(e.target.value)} />
          </div>
          <button onClick={saveAccess} disabled={busy} className="btn-primary w-full py-3 disabled:opacity-60">
            {busy ? '⏳ Sauvegarde...' : '💾 Sauvegarder les accès'}
          </button>
        </div>
      )}

      {/* ── Tab 2 : Checklist ── */}
      {tab === 2 && (
        <div className="card">
          <p className="text-sm text-gray-400 mb-5">Le professionnel devra cocher chaque pièce avec une photo obligatoire.</p>
          <div className="space-y-2 mb-4">
            {rooms.map((room, i) => (
              <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-teal/10 border border-teal/30 flex items-center justify-center text-xs font-700 text-teal">{i+1}</div>
                    <span className="text-sm font-600 text-gray-700">{room.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer text-xs font-600 text-teal bg-teal/10 px-2.5 py-1.5 rounded-lg hover:bg-teal/20 transition-all flex items-center gap-1">
                      <Camera size={12} /> {room.photoUrl ? 'Changer' : 'Photo'}
                      <input type="file" accept="image/*" className="hidden" onChange={e => handleRoomPhoto(i, e)} />
                    </label>
                    <button onClick={() => setRooms(r => r.filter((_, idx) => idx !== i))}
                      className="text-gray-300 hover:text-coral text-lg font-700">×</button>
                  </div>
                </div>
                {room.photoUrl && (
                  <div className="flex items-center gap-3 mt-2 ml-9">
                    <img src={room.photoUrl} alt={room.name} className="w-16 h-12 object-cover rounded-lg border border-teal/30" />
                    <button onClick={() => removeRoomPhoto(i)} className="text-xs text-gray-400 hover:text-coral transition-colors">✕ Retirer</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 mb-6">
            <input className="input-field flex-1" placeholder="Ex: Sous-sol, Patio..." value={newRoom}
              onChange={e=>setNewRoom(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addRoom()} />
            <button onClick={addRoom} className="btn-teal flex-shrink-0">+ Ajouter</button>
          </div>
          <button onClick={saveChecklist} disabled={busy} className="btn-primary w-full py-3 disabled:opacity-60">
            {busy ? '⏳ Sauvegarde...' : '💾 Sauvegarder la checklist'}
          </button>
        </div>
      )}

      <Toast toasts={toasts} />
    </div>
  )
}
