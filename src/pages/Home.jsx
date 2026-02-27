import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const FLOW = [
  { icon: '🏡', label: 'Inscription',     sub: 'Profil chalet' },
  { icon: '💳', label: 'Carte requise',   sub: 'Obligatoire' },
  { icon: '✅', label: 'Checklist',       sub: 'Tâches + photos' },
  { icon: '📢', label: 'Demande',         sub: 'Alertes pros' },
  { icon: '💰', label: 'Offres',          sub: 'Choisissez votre pro' },
  { icon: '📸', label: 'Photos/pièce',    sub: 'Preuve qualité' },
  { icon: '💸', label: 'Paiement auto',   sub: 'Libéré instantly' },
]

const FEATURES = [
  { icon: '📋', title: 'Checklist personnalisable', desc: 'Créez vos listes de tâches par chalet. Chaque pièce est cochée en temps réel.', tag: 'Propriétaires', teal: false },
  { icon: '📸', title: 'Photos obligatoires', desc: 'Impossible de finaliser sans une photo par pièce. Preuve horodatée de chaque espace nettoyé.', tag: 'Preuve qualité', teal: true },
  { icon: '💳', title: 'Paiement requis', desc: 'Les propriétaires enregistrent leur carte avant toute demande. Aucune surprise possible.', tag: 'Obligatoire', teal: false },
  { icon: '💸', title: 'Paiement 100% automatique', desc: 'Checklist + photos complètes → paiement libéré instantanément. Zéro action manuelle.', tag: 'Auto', teal: true },
  { icon: '📍', title: 'Alertes de proximité', desc: 'Notification instantanée aux professionnel·le·s à moins de 25 km.', tag: 'Géolocalisation', teal: false },
  { icon: '⭐', title: 'Évaluations mutuelles', desc: 'Propriétaires et professionnel·le·s se notent après chaque prestation.', tag: 'Confiance', teal: true },
]

export default function Home() {
  const { user, profile } = useAuth()

  return (
    <div>
      {/* ── Hero ── */}
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#FF5A5F 0%,#FF8C61 50%,#FFBA5A 100%)' }}>
        <div className="max-w-6xl mx-auto px-8 py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/25 border border-white/40 backdrop-blur px-4 py-1.5 rounded-full text-white text-xs font-700 uppercase tracking-widest mb-5">
              🏔 L'Uber du ménage pour chalets
            </div>
            <h1 className="text-5xl font-800 text-white leading-tight tracking-tight mb-5">
              Votre chalet<br />toujours impeccable
            </h1>
            <p className="text-white/90 text-base leading-relaxed mb-8">
              Connectez-vous avec des professionnel·le·s à proximité. Checklists avec photos obligatoires, paiement automatique à la complétion.
            </p>

            {user ? (
              <div className="flex gap-3 flex-wrap">
                <Link to={profile?.role === 'proprio' ? '/dashboard' : '/pro'}
                  className="bg-white text-coral font-700 px-6 py-3 rounded-xl shadow-md hover:-translate-y-0.5 transition-all text-sm">
                  Mon tableau de bord →
                </Link>
              </div>
            ) : (
              <div className="flex gap-3 flex-wrap">
                <Link to="/inscription?role=proprio"
                  className="bg-white text-coral font-700 px-6 py-3 rounded-xl shadow-md hover:-translate-y-0.5 transition-all text-sm">
                  🏡 Je suis propriétaire
                </Link>
                <Link to="/inscription?role=pro"
                  className="bg-white/20 text-white border border-white/50 backdrop-blur font-600 px-6 py-3 rounded-xl hover:bg-white/30 transition-all text-sm">
                  🧹 Je suis professionnel·le
                </Link>
              </div>
            )}

            <div className="flex gap-7 mt-9 pt-7 border-t border-white/25">
              {[['4.9★','Note moyenne'],['2h','Délai de réponse'],['3%','Frais de service']].map(([num,lbl]) => (
                <div key={lbl}>
                  <div className="text-2xl font-800 text-white">{num}</div>
                  <div className="text-xs text-white/70 mt-0.5">{lbl}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Phone mockup */}
          <div className="hidden lg:block">
            <div className="bg-white rounded-3xl p-5 max-w-xs mx-auto shadow-2xl">
              <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-coral to-coral-light flex items-center justify-center text-sm">🔔</div>
                  <div>
                    <p className="text-xs font-700 text-gray-800">Nouvelle demande à 12 km</p>
                    <p className="text-xs text-gray-400">Mont-Tremblant • il y a 2 min</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-2">Chalet des Laurentides • Sam 1 mars • 3h • ~95$</p>
                <div className="flex gap-2">
                  <span className="text-xs bg-coral/10 text-coral font-700 px-2 py-0.5 rounded-full">Urgent</span>
                  <span className="text-xs bg-teal/10 text-teal font-700 px-2 py-0.5 rounded-full">📸 Photo/pièce</span>
                </div>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal to-teal-light flex items-center justify-content-center text-sm flex items-center justify-center">✅</div>
                  <div>
                    <p className="text-xs font-700 text-gray-800">💸 Paiement libéré auto</p>
                    <p className="text-xs text-gray-400">Chalet Boreal • hier</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">87,40$ versés à Isabelle G. — checklist 100%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Comment ça marche ── */}
      <div className="max-w-6xl mx-auto px-8 py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-800 text-gray-900 tracking-tight mb-2">Comment ça fonctionne</h2>
          <p className="text-gray-400">Simple, transparent et 100% automatisé</p>
        </div>
        <div className="flex items-center overflow-x-auto pb-4 gap-0 scrollbar-hide">
          {FLOW.map((step, i) => (
            <div key={step.label} className="flex items-center flex-shrink-0">
              <div className="text-center w-28 group">
                <div className="w-14 h-14 rounded-full bg-white border-2 border-gray-200 shadow-sm flex items-center justify-center text-2xl mx-auto mb-3 transition-all group-hover:border-coral group-hover:shadow-coral/20 group-hover:shadow-md group-hover:-translate-y-1">
                  {step.icon}
                </div>
                <p className="text-xs font-700 text-gray-800">{step.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{step.sub}</p>
              </div>
              {i < FLOW.length - 1 && <div className="text-gray-200 text-xl px-1 mb-6 flex-shrink-0">›</div>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ── */}
      <div className="max-w-6xl mx-auto px-8 pb-20">
        <div className="mb-10">
          <h2 className="text-3xl font-800 text-gray-900 tracking-tight mb-2">Toutes les fonctionnalités</h2>
          <p className="text-gray-400">Tout ce qu'il faut pour gérer le ménage de vos chalets</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(f => (
            <div key={f.title} className="card hover:border-coral hover:shadow-md hover:-translate-y-1 transition-all cursor-default group">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4 ${f.teal ? 'bg-teal/10' : 'bg-coral/8'}`}>
                {f.icon}
              </div>
              <h3 className="text-sm font-700 text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              <span className={`inline-block mt-3 text-xs font-700 px-3 py-1 rounded-full uppercase tracking-wide ${
                f.teal ? 'bg-teal/10 text-teal' : 'bg-coral/10 text-coral'
              }`}>{f.tag}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
