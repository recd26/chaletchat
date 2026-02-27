export default function Paiement() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-9">
      <h1 className="text-2xl font-800 text-gray-900 mb-2">Paiement & frais 💳</h1>
      <p className="text-gray-400 text-sm mb-8">Transparent, automatique et sécurisé via Stripe.</p>

      {/* Flux */}
      <div className="card mb-6">
        <h2 className="font-700 text-gray-900 mb-5">💸 Flux de paiement</h2>
        <div className="flex items-center gap-3 overflow-x-auto pb-2">
          {[
            { icon:'💳', label:'Paiement autorisé', sub:'À l\'acceptation' },
            { icon:'🔒', label:'Entiercement', sub:'Stripe Hold' },
            { icon:'📸', label:'Photos + checklist', sub:'100% complètes' },
            { icon:'✅', label:'Vérification auto', sub:'Immédiate' },
            { icon:'💸', label:'Versement pro', sub:'Dans les 2h' },
          ].map((step, i, arr) => (
            <div key={step.label} className="flex items-center flex-shrink-0">
              <div className="text-center w-24">
                <div className="w-12 h-12 rounded-full bg-gray-50 border-2 border-gray-200 flex items-center justify-center text-xl mx-auto mb-2">{step.icon}</div>
                <p className="text-xs font-700 text-gray-800">{step.label}</p>
                <p className="text-xs text-gray-400">{step.sub}</p>
              </div>
              {i < arr.length - 1 && <div className="text-gray-200 text-xl px-1 mb-5 flex-shrink-0">›</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Exemple calcul */}
      <div className="card mb-6">
        <h2 className="font-700 text-gray-900 mb-4">🧮 Exemple de calcul — offre de 95$</h2>
        <div className="space-y-2 mb-4">
          {[
            { label: 'Offre professionnelle',   val: '95,00 $',  color: 'text-gray-800' },
            { label: 'Frais de service (3%)',    val: '+2,85 $',  color: 'text-coral' },
            { label: 'Traitement Stripe',        val: '+0,75 $',  color: 'text-coral' },
          ].map(row => (
            <div key={row.label} className="flex justify-between items-center px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
              <span className="text-sm text-gray-600">{row.label}</span>
              <span className={`text-sm font-700 ${row.color}`}>{row.val}</span>
            </div>
          ))}
          <div className="flex justify-between items-center px-4 py-3 bg-coral/5 rounded-xl border border-coral/20">
            <span className="text-sm font-700 text-gray-800">Total débité au propriétaire</span>
            <span className="text-base font-800 text-coral">98,60 $</span>
          </div>
          <div className="flex justify-between items-center px-4 py-3 bg-teal/5 rounded-xl border border-teal/20">
            <span className="text-sm font-700 text-gray-800">Versé à la professionnelle</span>
            <span className="text-base font-800 text-teal">95,00 $</span>
          </div>
        </div>
        <p className="text-xs text-gray-400">Les frais de 3% restent sur la plateforme. La professionnelle reçoit toujours son montant exact.</p>
      </div>

      {/* Stripe info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-700 text-gray-900 mb-3">🏡 Pour les propriétaires</h3>
          <ul className="space-y-2 text-sm text-gray-500">
            <li className="flex gap-2"><span className="text-teal">✓</span>Carte enregistrée obligatoire avant la 1ère demande</li>
            <li className="flex gap-2"><span className="text-teal">✓</span>Pré-autorisation seulement — aucun débit avant complétion</li>
            <li className="flex gap-2"><span className="text-teal">✓</span>Remboursement en cas d'annulation &lt;24h</li>
            <li className="flex gap-2"><span className="text-teal">✓</span>Reçu par courriel automatiquement</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="font-700 text-gray-900 mb-3">🧹 Pour les professionnel·le·s</h3>
          <ul className="space-y-2 text-sm text-gray-500">
            <li className="flex gap-2"><span className="text-teal">✓</span>Versement automatique dans les 2h post-complétion</li>
            <li className="flex gap-2"><span className="text-teal">✓</span>100% du montant offert garanti</li>
            <li className="flex gap-2"><span className="text-teal">✓</span>Virement direct via Stripe Connect</li>
            <li className="flex gap-2"><span className="text-teal">✓</span>Historique des versements dans votre profil</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
