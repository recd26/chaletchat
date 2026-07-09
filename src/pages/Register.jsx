import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { supabase } from '../lib/supabase'
import StepIndicator from '../components/StepIndicator'
import PasswordInput from '../components/PasswordInput'
import Toast from '../components/Toast'
import { PROVINCES, isValidPostalCode } from '../lib/constants'
import { geocodeAddress } from '../lib/geocode'

// ── Étapes selon le rôle ────────────────────────────────────
// La pièce d'identité est demandée APRÈS création de compte, sur
// /en-attente. Deux raisons : (1) conversion — un signup 2 étapes
// convertit mieux qu'un 3-étapes avec upload de docs sur mobile ;
// (2) l'upload dans le bucket privé `id-documents` nécessite une
// session RLS auth.uid() valide, garantie une fois connecté.
const STEPS_PROPRIO = ['Compte', 'Profil']
const STEPS_PRO     = ['Compte', 'Profil']

// Convertit "Français et Anglais" -> ["Français","Anglais"] pour la colonne text[]
function parseLanguages(value) {
  if (!value) return []
  return value.split(/\s+et\s+|,\s*/).map(s => s.trim()).filter(Boolean)
}

export default function Register() {
  const { signUp } = useAuth()
  const { toasts, toast } = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const defaultRole = params.get('role') === 'pro' ? 'pro' : 'proprio'

  const [role,  setRole]  = useState(defaultRole)
  const [step,  setStep]  = useState(1)
  const [busy,  setBusy]  = useState(false)

  // Champs communs
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [phone,     setPhone]     = useState('')
  const [pw,        setPw]        = useState('')
  const [pw2,       setPw2]       = useState('')
  const [terms,     setTerms]     = useState(false)

  // Propro profil
  const [province,    setProvince]    = useState('')
  const [chaletCount, setChaletCount] = useState('1 chalet')
  const [locationType,setLocationType]= useState('Airbnb / Vrbo (courte durée)')

  // Pro profil
  const [proAddress,    setProAddress]    = useState('')
  const [proCity,       setProCity]       = useState('')
  const [proProvince,   setProProvince]   = useState('')
  const [proPostalCode, setProPostalCode] = useState('')
  const [radius,      setRadius]      = useState('25')
  const [experience,  setExperience]  = useState('1 à 3 ans')
  const [languages,   setLanguages]   = useState('Français et Anglais')
  const [bio,         setBio]         = useState('')

  const steps      = role === 'proprio' ? STEPS_PROPRIO : STEPS_PRO
  const isTeal     = role === 'pro'
  const totalSteps = steps.length

  // Erreurs par champ, affichées inline sous chaque input.
  const [errors, setErrors] = useState({})

  // Calcule TOUTES les erreurs de l'étape courante en une passe, pour permettre
  // un affichage inline par champ + un récap au clic sur le bouton principal.
  function collectStepErrors() {
    const e = {}
    if (step === 1) {
      if (!firstName)              e.firstName = 'Prénom requis'
      if (!lastName)               e.lastName  = 'Nom requis'
      if (!email.includes('@'))    e.email     = 'Courriel invalide'
      if (pw.length < 8)           e.pw        = 'Min. 8 caractères'
      if (pw && pw2 && pw !== pw2) e.pw2       = 'Les mots de passe ne correspondent pas'
      else if (!pw2)               e.pw2       = 'Confirmez votre mot de passe'
      if (!terms)                  e.terms     = 'Acceptez les conditions d\'utilisation'
    }
    if (step === 2 && role === 'proprio') {
      if (!province) e.province = 'Sélectionnez une province'
    }
    if (step === 2 && role === 'pro') {
      if (!proAddress)  e.proAddress  = 'Adresse requise'
      if (!proCity)     e.proCity     = 'Ville requise'
      if (!proProvince) e.proProvince = 'Province requise'
      if (!isValidPostalCode(proPostalCode)) e.proPostalCode = 'Code postal invalide (ex: J8E 1T4)'
    }
    return e
  }

  // Le bouton reste actionnable même en erreur : au clic on affiche le récap
  // des erreurs, plutôt que de rester grisé sans feedback (l'utilisateur ne
  // savait pas pourquoi c'était grisé auparavant — cf. CHA-40).
  const submitDisabled  = busy

  function next() {
    const stepErrors = collectStepErrors()
    setErrors(stepErrors)
    const list = Object.values(stepErrors)
    if (list.length > 0) {
      // Récap : une seule notification qui liste tout ce qui manque.
      toast(`⚠️ ${list.length === 1 ? list[0] : `${list.length} champs à corriger`}`, 'error')
      return
    }
    if (step < totalSteps) return setStep(s => s + 1)
    handleSubmit()
  }

  // Efface l'erreur d'un champ dès qu'il est modifié (feedback immédiat).
  function clearError(field) {
    if (errors[field]) setErrors(prev => { const { [field]: _, ...rest } = prev; return rest })
  }

  async function handleSubmit() {
    if (busy) return
    setBusy(true)
    try {
      // Geocoder l'adresse du pro
      let proLat = null, proLng = null
      if (role === 'pro') {
        const coords = await geocodeAddress({
          address: proAddress, city: proCity,
          province: proProvince, postalCode: proPostalCode,
        })
        if (coords) { proLat = coords.lat; proLng = coords.lng }
      }

      // Créer le compte. La pièce d'identité (pro) est téléversée
      // APRÈS, depuis /en-attente : la session RLS est alors garantie
      // (auth.uid() défini) et le signup reste court (2 étapes).
      const signUpResult = await signUp({
        email,
        password: pw,
        role,
        firstName,
        lastName,
        phone,
        verif_status: 'pending', // Tous les comptes doivent être approuvés par l'admin
        // Profil pro
        ...(role === 'pro' && {
          address: proAddress,
          city: proCity,
          province: proProvince,
          postal_code: proPostalCode,
          zone: proCity,
          radius_km: parseInt(radius),
          lat: proLat,
          lng: proLng,
          experience,
          // La colonne languages est de type text[] — un select renvoie un
          // string libellé "Français et Anglais" qu'il faut décomposer sinon
          // Postgres rejette l'UPDATE et le profil reste incomplet (bug CHA-40).
          languages: parseLanguages(languages),
          bio,
        }),
        // Profil proprio — chalet_count/location_type sont désormais
        // persistés via une migration dédiée (voir supabase-schema.sql).
        ...(role === 'proprio' && {
          province,
          chalet_count: chaletCount,
          location_type: locationType,
        }),
      })

      const hasSession = !!signUpResult?.session
      const needsEmailConfirm = !hasSession

      if (needsEmailConfirm) {
        toast('📧 Compte créé ! Confirmez votre courriel puis connectez-vous pour finaliser votre profil.', 'success')
      } else if (role === 'pro') {
        toast('🎉 Compte créé ! Téléversez maintenant votre pièce d\'identité pour finaliser votre inscription.', 'success')
      } else {
        toast('🎉 Compte créé ! En attente d\'approbation par l\'administrateur.', 'success')
      }
      setTimeout(() => navigate(needsEmailConfirm ? '/login' : '/en-attente'), 1500)
    } catch (err) {
      toast(`❌ ${err.message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const inputClass = isTeal ? 'input-field-teal' : 'input-field'
  const fieldClass = (name) => errors[name] ? `${inputClass} border-red-400 focus:border-red-500` : inputClass

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center py-12 px-4 bg-gray-50">
      <div className="bg-white border border-gray-200 rounded-2xl p-10 w-full max-w-lg shadow-md page-enter">

        {/* Logo */}
        <div className="text-center mb-7">
          <div className="text-2xl font-800">
            <span className="text-coral">Chalet</span><span className="text-teal">Prop</span>
          </div>
          <p className="text-sm text-gray-400 mt-1">Rejoignez la plateforme #1 pour le ménage de chalets</p>
        </div>

        {/* Choix de rôle (step 1 uniquement) */}
        {step === 1 && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              { r:'proprio', icon:'🏡', title:'Propriétaire', sub:'Je possède des chalets locatifs' },
              { r:'pro',     icon:'🧹', title:'Professionnel·le', sub:'J\'offre des services de ménage' },
            ].map(({ r, icon, title, sub }) => (
              <button key={r} type="button"
                onClick={() => { setRole(r); setStep(1) }}
                className={`p-4 rounded-xl border-2 text-center transition-all ${
                  role === r
                    ? r === 'proprio' ? 'border-coral bg-coral/5' : 'border-teal bg-teal/5'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-400'
                }`}>
                <div className="text-3xl mb-2">{icon}</div>
                <p className={`text-sm font-700 ${role === r ? (r==='proprio'?'text-coral':'text-teal') : 'text-gray-800'}`}>{title}</p>
                <p className="text-xs text-gray-400 mt-1">{sub}</p>
              </button>
            ))}
          </div>
        )}

        {/* Indicateur d'étapes */}
        <StepIndicator steps={steps} current={step} teal={isTeal} />

        {/* ──────────────────────── STEP 1 : Compte ──────────────── */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-800 text-gray-900 mb-1">Créer votre compte {role === 'proprio' ? '🏡' : '🧹'}</h2>
            <p className="text-sm text-gray-400 mb-6">
              {role === 'proprio' ? 'Inscrivez-vous en tant que propriétaire.' : 'Inscrivez-vous pour recevoir des demandes.'}
            </p>

            <div className="flex gap-3 mb-4">
              <button className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm font-600 hover:border-gray-400 transition-all"
                onClick={async () => {
                  const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: { redirectTo: `${window.location.origin}/accueil` }
                  })
                  if (error) toast(`❌ ${error.message}`, 'error')
                }}>
                <span>🇬</span> Google
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm font-600 hover:border-gray-400 transition-all"
                onClick={() => toast('🍎 Apple OAuth nécessite un Apple Developer Account — à configurer', 'info')}>
                <span>🍎</span> Apple
              </button>
            </div>

            <div className="flex items-center gap-3 my-4">
              <hr className="flex-1 border-gray-200"/><span className="text-xs text-gray-400">ou avec votre courriel</span><hr className="flex-1 border-gray-200"/>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Prénom</label>
                <input className={fieldClass('firstName')} placeholder="Marie" value={firstName}
                  onChange={e=>{ setFirstName(e.target.value); clearError('firstName') }} />
                {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>}
              </div>
              <div>
                <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Nom</label>
                <input className={fieldClass('lastName')} placeholder="Lapointe" value={lastName}
                  onChange={e=>{ setLastName(e.target.value); clearError('lastName') }} />
                {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName}</p>}
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Courriel</label>
              <input className={fieldClass('email')} type="email" placeholder="votre@courriel.com" value={email}
                onChange={e=>{ setEmail(e.target.value); clearError('email') }} />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>
            <div className="mb-3">
              <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Téléphone</label>
              <input className={inputClass} type="tel" placeholder="+1 (514) 000-0000" value={phone} onChange={e=>setPhone(e.target.value)} />
            </div>
            <div className="mb-3">
              <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Mot de passe</label>
              <PasswordInput teal={isTeal} value={pw} onChange={(v)=>{ setPw(v); clearError('pw') }} />
              {errors.pw && <p className="text-xs text-red-500 mt-1">{errors.pw}</p>}
            </div>
            <div className="mb-4">
              <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Confirmer le mot de passe</label>
              <PasswordInput teal={isTeal} value={pw2} onChange={(v)=>{ setPw2(v); clearError('pw2') }} placeholder="Répétez le mot de passe" />
              {errors.pw2 && <p className="text-xs text-red-500 mt-1">{errors.pw2}</p>}
            </div>

            <label className="flex items-start gap-2.5 mb-2 cursor-pointer">
              <input type="checkbox" checked={terms} onChange={e=>{ setTerms(e.target.checked); clearError('terms') }}
                className="mt-0.5 w-4 h-4 accent-coral flex-shrink-0" />
              <span className="text-xs text-gray-400 leading-relaxed">
                J'accepte les <Link to="/conditions" className="text-coral font-600 underline">conditions d'utilisation</Link> et la <Link to="/confidentialite" className="text-coral font-600 underline">politique de confidentialité</Link> de ChaletProp.
              </span>
            </label>
            {errors.terms && <p className="text-xs text-red-500 mb-5 -mt-1">{errors.terms}</p>}
          </div>
        )}

        {/* ──────── STEP 2 PROPRIO : Profil ──────── */}
        {step === 2 && role === 'proprio' && (
          <div>
            <h2 className="text-xl font-800 text-gray-900 mb-1">Votre profil propriétaire</h2>
            <p className="text-sm text-gray-400 mb-6">Parlez-nous de vos chalets.</p>

            <div className="mb-3">
              <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Province</label>
              <select className={fieldClass('province')} value={province} onChange={e=>{ setProvince(e.target.value); clearError('province') }}>
                <option value="">Sélectionnez...</option>
                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              {errors.province && <p className="text-xs text-red-500 mt-1">{errors.province}</p>}
            </div>
            <div className="mb-3"><label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Nombre de chalets</label>
              <select className={inputClass} value={chaletCount} onChange={e=>setChaletCount(e.target.value)}>
                <option>1 chalet</option><option>2 chalets</option><option>3 à 5 chalets</option><option>6 et plus</option>
              </select></div>
            <div className="mb-4"><label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Type de locations</label>
              <select className={inputClass} value={locationType} onChange={e=>setLocationType(e.target.value)}>
                <option>Airbnb / Vrbo (courte durée)</option><option>Location à la semaine</option>
                <option>Location au mois</option><option>Mixte</option>
              </select></div>

            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-700">
              💳 Vous pourrez ajouter votre méthode de paiement plus tard dans votre tableau de bord.
            </div>
          </div>
        )}

        {/* ──────── STEP 2 PRO : Profil ──────── */}
        {step === 2 && role === 'pro' && (
          <div>
            <h2 className="text-xl font-800 text-gray-900 mb-1">Votre profil professionnel</h2>
            <p className="text-sm text-gray-400 mb-6">Aidez les propriétaires à vous trouver.</p>

            <div className="mb-3">
              <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Adresse</label>
              <input className={fieldClass('proAddress')} placeholder="123 Rue Principale" value={proAddress}
                onChange={e=>{ setProAddress(e.target.value); clearError('proAddress') }} />
              {errors.proAddress && <p className="text-xs text-red-500 mt-1">{errors.proAddress}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Ville</label>
                <input className={fieldClass('proCity')} placeholder="Mont-Tremblant" value={proCity}
                  onChange={e=>{ setProCity(e.target.value); clearError('proCity') }} />
                {errors.proCity && <p className="text-xs text-red-500 mt-1">{errors.proCity}</p>}
              </div>
              <div>
                <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Province</label>
                <select className={fieldClass('proProvince')} value={proProvince}
                  onChange={e=>{ setProProvince(e.target.value); clearError('proProvince') }}>
                  <option value="">Sélectionnez...</option>
                  {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                {errors.proProvince && <p className="text-xs text-red-500 mt-1">{errors.proProvince}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Code postal</label>
                <input className={fieldClass('proPostalCode')} placeholder="J8E 1T4" maxLength={7} value={proPostalCode}
                  onChange={e=>{ setProPostalCode(e.target.value.toUpperCase()); clearError('proPostalCode') }} />
                {errors.proPostalCode && <p className="text-xs text-red-500 mt-1">{errors.proPostalCode}</p>}
              </div>
              <div><label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Rayon de déplacement</label>
                <select className={inputClass} value={radius} onChange={e=>setRadius(e.target.value)}>
                  <option>10</option><option>25</option><option>50</option><option>75</option>
                </select></div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Expérience</label>
                <select className={inputClass} value={experience} onChange={e=>setExperience(e.target.value)}>
                  <option>Moins de 1 an</option><option>1 à 3 ans</option><option>3 à 5 ans</option><option>5 ans et plus</option>
                </select></div>
              <div><label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Langues</label>
                <select className={inputClass} value={languages} onChange={e=>setLanguages(e.target.value)}>
                  <option>Français seulement</option><option>Français et Anglais</option><option>Anglais seulement</option>
                </select></div>
            </div>
            <div className="mb-4"><label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Bio courte</label>
              <textarea className={`${inputClass} min-h-20 resize-none`} placeholder="Ex: Professionnelle du ménage avec 3 ans d'expérience dans les chalets des Laurentides..."
                value={bio} onChange={e=>setBio(e.target.value)} /></div>
          </div>
        )}

        {/* Note vérification identité — étape post-signup pour les pros */}
        {step === 2 && role === 'pro' && (
          <div className="mt-2 bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
            🪪 <span className="font-700">Pièce d'identité :</span> vous la téléverserez juste après la création du compte,
            pour que votre profil soit validé par l'administrateur (~24h).
          </div>
        )}

        {/* Récap des champs manquants (bannière visible sous les inputs) */}
        {Object.keys(errors).length > 1 && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
            <p className="font-700 mb-1">⚠️ Il reste {Object.keys(errors).length} champ{Object.keys(errors).length > 1 ? 's' : ''} à corriger :</p>
            <ul className="list-disc list-inside space-y-0.5">
              {Object.values(errors).map((msg, i) => <li key={i}>{msg}</li>)}
            </ul>
          </div>
        )}

        {/* ── Boutons de navigation ── */}
        <div className="flex gap-3 mt-6">
          {step > 1 && (
            <button type="button" onClick={() => setStep(s => s - 1)}
              className="btn-secondary flex-shrink-0">← Retour</button>
          )}
          <button
            type="button"
            onClick={next}
            disabled={submitDisabled}
            className={`flex-1 py-3 rounded-xl font-700 text-sm text-white transition-all ${
              isTeal ? 'bg-teal hover:opacity-90' : 'bg-coral hover:bg-coral-dark'
            } disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {busy ? 'Création...' : step === totalSteps ? '✅ Créer mon compte' : 'Continuer →'}
          </button>
        </div>

        <p className="text-center text-sm text-gray-400 mt-5">
          Déjà un compte ?{' '}
          <Link to="/login" className={`font-700 ${isTeal ? 'text-teal' : 'text-coral'}`}>Se connecter</Link>
        </p>
      </div>
      <Toast toasts={toasts} />
    </div>
  )
}
