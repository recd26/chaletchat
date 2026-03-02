import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChalets } from '../hooks/useChalets'
import { useRequests } from '../hooks/useRequests'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'

const DEFAULT_SUPPLIES = [
  'Balai / vadrouille',
  'Aspirateur',
  'Produits nettoyants multi-surfaces',
  'Produit pour vitres',
  'Produit pour salle de bain',
  'Éponges / chiffons',
  'Sacs poubelles',
  'Papier essuie-tout',
  'Détergent à lessive',
  'Assouplissant',
]

const DEFAULT_LAUNDRY = [
  'Draps (lit principal)',
  'Draps (lit 2)',
  'Serviettes de bain',
  'Serviettes de cuisine',
  'Débarbouillettes',
  'Taies d\'oreillers',
]

const DEFAULT_SPA = [
  'Vider et rincer le spa',
  'Vérifier le niveau de chlore / brome',
  'Nettoyer le filtre',
  'Vérifier la température',
  'Remettre la couverture du spa',
  'Nettoyer le contour / terrasse du spa',
]

export default function NewRequest() {
  const { chalets, loading: loadChalets } = useChalets()
  const { createRequest } = useRequests()
  const { toasts, toast } = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  const [chaletId, setChaletId]         = useState('')
  const [date, setDate]                 = useState('')
  const [time, setTime]                 = useState('')
  const [deadlineTime, setDeadlineTime] = useState('')
  const [hours, setHours]               = useState('3')
  const [urgent, setUrgent]             = useState(false)
  const [suggestedBudget, setSuggestedBudget] = useState('')
  const [notes, setNotes]               = useState('')

  // Produits sur place
  const [supplies, setSupplies]     = useState(DEFAULT_SUPPLIES.map(s => ({ name: s, available: true })))
  const [newSupply, setNewSupply]   = useState('')

  // Lavage machine
  const [laundry, setLaundry]       = useState(DEFAULT_LAUNDRY.map(l => ({ name: l, checked: true })))
  const [newLaundry, setNewLaundry] = useState('')

  // Spa
  const [hasSpa, setHasSpa]         = useState(false)
  const [spaTasks, setSpaTasks]     = useState(DEFAULT_SPA.map(s => ({ name: s, checked: true })))
  const [newSpaTask, setNewSpaTask] = useState('')

  const today = new Date().toISOString().split('T')[0]
  const selectedChalet = chalets.find(c => c.id === chaletId)

  function toggleSupply(i) {
    setSupplies(prev => prev.map((s, idx) => idx === i ? { ...s, available: !s.available } : s))
  }
  function addSupply() {
    if (!newSupply.trim()) return
    setSupplies(prev => [...prev, { name: newSupply.trim(), available: true }])
    setNewSupply('')
  }
  function removeSupply(i) { setSupplies(prev => prev.filter((_, idx) => idx !== i)) }

  function toggleLaundry(i) {
    setLaundry(prev => prev.map((l, idx) => idx === i ? { ...l, checked: !l.checked } : l))
  }
  function addLaundry() {
    if (!newLaundry.trim()) return
    setLaundry(prev => [...prev, { name: newLaundry.trim(), checked: true }])
    setNewLaundry('')
  }
  function removeLaundry(i) { setLaundry(prev => prev.filter((_, idx) => idx !== i)) }

  function toggleSpaTask(i) {
    setSpaTasks(prev => prev.map((s, idx) => idx === i ? { ...s, checked: !s.checked } : s))
  }
  function addSpaTask() {
    if (!newSpaTask.trim()) return
    setSpaTasks(prev => [...prev, { name: newSpaTask.trim(), checked: true }])
    setNewSpaTask('')
  }
  function removeSpaTask(i) { setSpaTasks(prev => prev.filter((_, idx) => idx !== i)) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!chaletId) return toast('Sélectionnez un chalet', 'error')
    if (!date)     return toast('Sélectionnez une date', 'error')
    if (!time)     return toast('Indiquez une heure d\'arrivée', 'error')

    setBusy(true)
    try {
      await createRequest({
        chalet_id: chaletId,
        scheduled_date: date,
        scheduled_time: time,
        deadline_time: deadlineTime || null,
        estimated_hours: parseFloat(hours),
        is_urgent: urgent,
        suggested_budget: suggestedBudget ? parseFloat(suggestedBudget) : null,
        special_notes: notes || null,
        supplies_on_site: supplies,
        laundry_tasks: laundry.filter(l => l.checked),
        spa_tasks: hasSpa ? spaTasks.filter(s => s.checked) : [],
        status: 'open',
      })
      toast('Demande créée avec succès !', 'success')
      setTimeout(() => navigate('/dashboard'), 1200)
    } catch (err) {
      toast(`${err.message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loadChalets) {
    return <div className="text-center py-20 text-gray-300 text-4xl">...</div>
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-9">
      <div className="flex items-center gap-3 mb-7">
        <button onClick={() => navigate('/dashboard')}
          className="text-gray-400 hover:text-gray-700 text-sm">← Retour</button>
        <h1 className="text-2xl font-800 text-gray-900">Nouvelle demande de ménage</h1>
      </div>

      {chalets.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">🏔</div>
          <p className="font-700 text-gray-700 mb-2">Aucun chalet</p>
          <p className="text-sm text-gray-400 mb-5">Ajoutez un chalet avant de créer une demande.</p>
          <button onClick={() => navigate('/nouveau-chalet')} className="btn-primary">
            Ajouter un chalet
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>

          {/* ── Sélection du chalet ── */}
          <div className="card mb-4">
            <h2 className="font-700 text-gray-900 mb-4">Quel chalet ?</h2>
            <div className="space-y-2">
              {chalets.map(c => (
                <label key={c.id}
                  className={`flex items-center gap-3 border rounded-xl px-4 py-3 cursor-pointer transition-all ${
                    chaletId === c.id ? 'border-coral bg-coral/5' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <input type="radio" name="chalet" value={c.id}
                    checked={chaletId === c.id} onChange={() => setChaletId(c.id)} className="accent-coral" />
                  <div className="flex-1">
                    <p className="text-sm font-700 text-gray-800">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.city} {c.province ? `• ${c.province}` : ''} — {c.bedrooms} ch. • {c.bathrooms} sdb</p>
                  </div>
                  <span className="text-xs text-gray-300">{c.checklist_templates?.length || 0} pièces</span>
                </label>
              ))}
            </div>
          </div>

          {/* ── Date et heure ── */}
          <div className="card mb-4">
            <h2 className="font-700 text-gray-900 mb-4">Quand ?</h2>

            <div className="mb-4">
              <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Date du ménage *</label>
              <input type="date" className="input-field" min={today} value={date} onChange={e => setDate(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Heure d'arrivée souhaitée *</label>
                <input type="time" className="input-field" value={time} onChange={e => setTime(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Heure limite (optionnel)</label>
                <input type="time" className="input-field" value={deadlineTime} onChange={e => setDeadlineTime(e.target.value)} />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Durée estimée</label>
              <select className="input-field w-40" value={hours} onChange={e => setHours(e.target.value)}>
                {['1', '1.5', '2', '2.5', '3', '3.5', '4', '5', '6', '7', '8'].map(h => (
                  <option key={h} value={h}>{h}h</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Budget suggéré (optionnel)</label>
              <p className="text-xs text-gray-400 mb-2">Montant indicatif pour guider les offres des pros.</p>
              <div className="relative w-48">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-700 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="5"
                  className="input-field pl-7"
                  placeholder="Ex: 150"
                  value={suggestedBudget}
                  onChange={e => setSuggestedBudget(e.target.value)}
                />
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`w-11 h-6 rounded-full relative transition-colors ${urgent ? 'bg-coral' : 'bg-gray-200'}`}
                onClick={() => setUrgent(!urgent)}>
                <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform left-0.5"
                  style={{ transform: urgent ? 'translateX(22px)' : 'translateX(0)' }} />
              </div>
              <div>
                <span className="text-sm font-600 text-gray-700">Demande urgente</span>
                <p className="text-xs text-gray-400">Les professionnels verront cette demande en priorité</p>
              </div>
            </label>
          </div>

          {/* ── Produits disponibles sur place ── */}
          <div className="card mb-4">
            <h2 className="font-700 text-gray-900 mb-2">Produits disponibles sur place</h2>
            <p className="text-sm text-gray-400 mb-4">Indiquez ce qui est déjà disponible au chalet. Le pro saura quoi apporter.</p>

            <div className="space-y-2 mb-4">
              {supplies.map((s, i) => (
                <div key={i} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5">
                  <button type="button" onClick={() => toggleSupply(i)}
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      s.available ? 'bg-teal border-teal text-white' : 'border-gray-300 bg-white'
                    }`}>
                    {s.available && <span className="text-xs">✓</span>}
                  </button>
                  <span className={`text-sm flex-1 ${s.available ? 'text-gray-700 font-600' : 'text-gray-400 line-through'}`}>
                    {s.name}
                  </span>
                  <button type="button" onClick={() => removeSupply(i)}
                    className="text-gray-300 hover:text-coral text-lg font-700 transition-colors">×</button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input className="input-field flex-1" placeholder="Ajouter un produit..."
                value={newSupply} onChange={e => setNewSupply(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSupply())} />
              <button type="button" onClick={addSupply} className="btn-teal flex-shrink-0">+ Ajouter</button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 mt-3">
              Les produits non cochés = le professionnel doit les apporter.
            </div>
          </div>

          {/* ── Lavage à la machine ── */}
          <div className="card mb-4">
            <h2 className="font-700 text-gray-900 mb-2">Lavage à la machine</h2>
            <p className="text-sm text-gray-400 mb-4">Cochez les items à laver et sécher sur place.</p>

            <div className="space-y-2 mb-4">
              {laundry.map((l, i) => (
                <div key={i} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5">
                  <button type="button" onClick={() => toggleLaundry(i)}
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      l.checked ? 'bg-teal border-teal text-white' : 'border-gray-300 bg-white'
                    }`}>
                    {l.checked && <span className="text-xs">✓</span>}
                  </button>
                  <span className={`text-sm flex-1 ${l.checked ? 'text-gray-700 font-600' : 'text-gray-400 line-through'}`}>
                    {l.name}
                  </span>
                  <button type="button" onClick={() => removeLaundry(i)}
                    className="text-gray-300 hover:text-coral text-lg font-700 transition-colors">×</button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input className="input-field flex-1" placeholder="Ajouter un item de lavage..."
                value={newLaundry} onChange={e => setNewLaundry(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLaundry())} />
              <button type="button" onClick={addLaundry} className="btn-teal flex-shrink-0">+ Ajouter</button>
            </div>
          </div>

          {/* ── Spa ── */}
          <div className="card mb-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-700 text-gray-900">Entretien du spa</h2>
                <p className="text-sm text-gray-400 mt-0.5">Activez si le chalet a un spa à entretenir.</p>
              </div>
              <div className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${hasSpa ? 'bg-teal' : 'bg-gray-200'}`}
                onClick={() => setHasSpa(!hasSpa)}>
                <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform left-0.5"
                  style={{ transform: hasSpa ? 'translateX(22px)' : 'translateX(0)' }} />
              </div>
            </div>

            {hasSpa && (
              <>
                <div className="space-y-2 mb-4">
                  {spaTasks.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5">
                      <button type="button" onClick={() => toggleSpaTask(i)}
                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          s.checked ? 'bg-teal border-teal text-white' : 'border-gray-300 bg-white'
                        }`}>
                        {s.checked && <span className="text-xs">✓</span>}
                      </button>
                      <span className={`text-sm flex-1 ${s.checked ? 'text-gray-700 font-600' : 'text-gray-400 line-through'}`}>
                        {s.name}
                      </span>
                      <button type="button" onClick={() => removeSpaTask(i)}
                        className="text-gray-300 hover:text-coral text-lg font-700 transition-colors">×</button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input className="input-field flex-1" placeholder="Ajouter une tâche spa..."
                    value={newSpaTask} onChange={e => setNewSpaTask(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSpaTask())} />
                  <button type="button" onClick={addSpaTask} className="btn-teal flex-shrink-0">+ Ajouter</button>
                </div>
              </>
            )}
          </div>

          {/* ── Instructions spéciales ── */}
          <div className="card mb-4">
            <h2 className="font-700 text-gray-900 mb-4">Instructions spéciales (optionnel)</h2>
            <textarea
              className="input-field min-h-24 resize-none"
              placeholder="Ex: Invités arrivent à 16h, priorité salles de bain, poêle à bois à nettoyer..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* ── Résumé ── */}
          {chaletId && date && (
            <div className="card mb-4 bg-gray-50">
              <h2 className="font-700 text-gray-900 mb-3">Résumé</h2>
              <div className="space-y-1.5 text-sm">
                <p><span className="text-gray-400">Chalet :</span> <strong>{selectedChalet?.name}</strong></p>
                <p><span className="text-gray-400">Date :</span> <strong>{new Date(date + 'T12:00').toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong></p>
                <p><span className="text-gray-400">Heure :</span> <strong>{time}</strong>{deadlineTime && <> — <span className="text-gray-400">limite</span> <strong>{deadlineTime}</strong></>}</p>
                <p><span className="text-gray-400">Durée :</span> <strong>~{hours}h</strong></p>
                {suggestedBudget && <p><span className="text-gray-400">Budget suggéré :</span> <strong>~{suggestedBudget} $</strong></p>}
                {urgent && <p className="text-coral font-700">Demande urgente</p>}
                <p><span className="text-gray-400">Produits sur place :</span> <strong>{supplies.filter(s => s.available).length}</strong> / {supplies.length}</p>
                <p><span className="text-gray-400">Lavage :</span> <strong>{laundry.filter(l => l.checked).length}</strong> item{laundry.filter(l => l.checked).length > 1 ? 's' : ''}</p>
                {hasSpa && <p><span className="text-gray-400">Spa :</span> <strong>{spaTasks.filter(s => s.checked).length}</strong> tâche{spaTasks.filter(s => s.checked).length > 1 ? 's' : ''}</p>}
                {notes && <p><span className="text-gray-400">Notes :</span> {notes}</p>}
              </div>
            </div>
          )}

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 mb-5">
            Les professionnels proches de votre chalet pourront soumettre des offres. Vous choisirez celle qui vous convient.
          </div>

          <button type="submit" disabled={busy} className="btn-primary w-full py-3 text-base disabled:opacity-60">
            {busy ? 'Création...' : 'Publier la demande'}
          </button>
        </form>
      )}

      <Toast toasts={toasts} />
    </div>
  )
}
