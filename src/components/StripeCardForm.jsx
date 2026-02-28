import { useState } from 'react'

export default function StripeCardForm({ onSuccess, onError, buttonText = '✅ Valider la carte' }) {
  const [name, setName] = useState('')
  const [num, setNum] = useState('')
  const [exp, setExp] = useState('')
  const [cvv, setCvv] = useState('')
  const [busy, setBusy] = useState(false)

  function fmtCard(v) {
    const d = v.replace(/\D/g, '').substring(0, 16)
    return d.match(/.{1,4}/g)?.join(' ') || d
  }
  function fmtExp(v) {
    const d = v.replace(/\D/g, '').substring(0, 4)
    if (d.length >= 3) return d.substring(0, 2) + ' / ' + d.substring(2)
    return d
  }

  async function handleSubmit() {
    if (!name) return onError('Entrez le nom du titulaire')
    if (num.replace(/\s/g, '').length < 14) return onError('Numéro de carte invalide')
    setBusy(true)
    // Mock — simule une validation Stripe
    setTimeout(() => {
      const last4 = num.replace(/\s/g, '').slice(-4)
      onSuccess({ paymentMethodId: 'pm_test_ok', name, last4, brand: 'Visa' })
      setBusy(false)
    }, 1000)
  }

  return (
    <div>
      <div className="mb-3">
        <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Titulaire</label>
        <input className="input-field" placeholder="Jean-François Martin" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className="mb-3">
        <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Numéro de carte</label>
        <input className="input-field" placeholder="4242 4242 4242 4242" value={num} onChange={e => setNum(fmtCard(e.target.value))} maxLength={19} />
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Expiration</label>
          <input className="input-field" placeholder="12 / 28" value={exp} onChange={e => setExp(fmtExp(e.target.value))} maxLength={7} />
        </div>
        <div>
          <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">CVV</label>
          <input className="input-field" placeholder="123" value={cvv} onChange={e => setCvv(e.target.value.replace(/\D/g, ''))} maxLength={4} />
        </div>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 mb-4">
        🧪 Mode test — Carte : 4242 4242 4242 4242 • Date : 12/28 • CVV : 123
      </div>
      <button onClick={handleSubmit} disabled={busy} className="btn-primary w-full py-3">
        {busy ? '⏳ Vérification...' : buttonText}
      </button>
    </div>
  )
}
