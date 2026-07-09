import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { supabase } from '../lib/supabase'
import StepIndicator from '../components/StepIndicator'
import PasswordInput from '../components/PasswordInput'
import UploadBox from '../components/UploadBox'
import Toast from '../components/Toast'
import { PROVINCES, isValidPostalCode } from '../lib/constants'
import { geocodeAddress } from '../lib/geocode'
import { uploadIdDoc } from '../lib/idDocs'

// ── Étapes selon le rôle ────────────────────────────────────
const STEPS_PROPRIO = ['Compte', 'Profil']
const STEPS_PRO     = ['Compte', 'Profil', 'Identité']

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

  // Vérification
  const [selfieFile,  setSelfieFile]  = useState(null)
  const [idFile,      setIdFile]      = useState(null)

  const steps      = role === 'proprio' ? STEPS_PROPRIO : STEPS_PRO
  const isTeal     = role === 'pro'
  const totalSteps = steps.length

  function validateStep() {
    if (step === 1) {
      if (!firstName || !lastName) return toast('⚠️ Prénom et nom requis', 'error')
      if (!email.includes('@'))    return toast('⚠️ Courriel invalide', 'error')
      if (pw.length < 8)           return toast('⚠️ Mot de passe trop court (min. 8 caractères)', 'error')
      if (pw !== pw2)              return toast('⚠️ Les mots de passe ne correspondent pas', 'error')
      if (!terms)                  return toast('⚠️ Acceptez les conditions d\'utilisation', 'error')
      return true
    }
    if (step === 2 && role === 'proprio') {
      if (!province) return toast('⚠️ Sélectionnez une province', 'error')
      return true
    }
    if (step === 2 && role === 'pro') {
      if (!proAddress)  return toast('⚠️ Adresse requise', 'error')
      if (!proCity)     return toast('⚠️ Ville requise', 'error')
      if (!proProvince) return toast('⚠️ Province requise', 'error')
      if (!isValidPostalCode(proPostalCode)) return toast('⚠️ Code postal invalide (ex: J8E 1T4)', 'error')
      return true
    }
    if (step === 3 && role === 'pro') {
      if (!selfieFile) return toast('⚠️ Selfie requis pour finaliser votre inscription', 'error')
      if (!idFile)     return toast('⚠️ Pièce d\'identité requise pour finaliser votre inscription', 'error')
      return true
    }
    return true
  }

  // Le bouton "Créer mon compte" reste désactivé tant que les 2 documents pro
  // ne sont pas prévisualisés (critère P0-5) — empêche d'atteindre handleSubmit.
  const isSubmitStep    = step === totalSteps
  const missingProDocs  = role === 'pro' && isSubmitStep && (!selfieFile || !idFile)
  const submitDisabled  = busy || missingProDocs

  function next() {
    if (!validateStep()) return
    if (step < totalSteps) return setStep(s => s + 1)
    handleSubmit()
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

      // 1) Créer le compte d'abord — il faut être authentifié pour
      //    uploader dans id-documents (RLS : premier segment du path = auth.uid).
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
          languages,
          bio,
        }),
        // Profil proprio
        ...(role === 'proprio' && {
          province,
          chalet_count: chaletCount,
          location_type: locationType,
        }),
      })

      // 2) Upload selfie + ID sous {userId}/... puis persister le chemin de stockage
      //    (pas d'URL publique — l'admin régénère une URL signée à l'affichage).
      const newUserId = signUpResult?.user?.id
      if (role === 'pro' && newUserId) {
        const docUpdates = {}
        if (selfieFile) {
          try {
            docUpdates.selfie_url = await uploadIdDoc({
              userId: newUserId, type: 'selfie', file: selfieFile,
            })
          } catch (err) {
            toast(`⚠️ Selfie non téléversé : ${err.message}`, 'error')
          }
        }
        if (idFile) {
          try {
            docUpdates.id_card_url = await uploadIdDoc({
              userId: newUserId, type: 'id_card', file: idFile,
            })
          } catch (err) {
            toast(`⚠️ Pièce d'identité non téléversée : ${err.message}`, 'error')
          }
        }
        if (Object.keys(docUpdates).length > 0) {
          await supabase.from('profiles').update(docUpdates).eq('id', newUserId)
        }
      }
      toast('🎉 Compte créé ! En attente d\'approbation par l\'administrateur.', 'success')
      setTimeout(() => navigate('/en-attente'), 1200)
    } catch (err) {
      toast(`❌ ${err.message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const inputClass = isTeal ? 'input-field-teal' : 'input-field'

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
              <div><label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Prénom</label>
                <input className={inputClass} placeholder="Marie" value={firstName} onChange={e=>setFirstName(e.target.value)} /></div>
              <div><label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Nom</label>
                <input className={inputClass} placeholder="Lapointe" value={lastName} onChange={e=>setLastName(e.target.value)} /></div>
            </div>
            <div className="mb-3"><label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Courriel</label>
              <input className={inputClass} type="email" placeholder="votre@courriel.com" value={email} onChange={e=>setEmail(e.target.value)} /></div>
            <div className="mb-3"><label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Téléphone</label>
              <input className={inputClass} type="tel" placeholder="+1 (514) 000-0000" value={phone} onChange={e=>setPhone(e.target.value)} /></div>
            <div className="mb-3"><label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Mot de passe</label>
              <PasswordInput teal={isTeal} value={pw} onChange={setPw} /></div>
            <div className="mb-4"><label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Confirmer le mot de passe</label>
              <PasswordInput teal={isTeal} value={pw2} onChange={setPw2} placeholder="Répétez le mot de passe" /></div>

            <label className="flex items-start gap-2.5 mb-5 cursor-pointer">
              <input type="checkbox" checked={terms} onChange={e=>setTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-coral flex-shrink-0" />
              <span className="text-xs text-gray-400 leading-relaxed">
                J'accepte les <Link to="/conditions" className="text-coral font-600 underline">conditions d'utilisation</Link> et la <Link to="/confidentialite" className="text-coral font-600 underline">politique de confidentialité</Link> de ChaletProp.
              </span>
            </label>
          </div>
        )}

        {/* ──────── STEP 2 PROPRIO : Profil ──────── */}
        {step === 2 && role === 'proprio' && (
          <div>
            <h2 className="text-xl font-800 text-gray-900 mb-1">Votre profil propriétaire</h2>
            <p className="text-sm text-gray-400 mb-6">Parlez-nous de vos chalets.</p>

            <div className="mb-3"><label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Province</label>
              <select className={inputClass} value={province} onChange={e=>setProvince(e.target.value)}>
                <option value="">Sélectionnez...</option>
                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select></div>
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

            <div className="mb-3"><label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Adresse</label>
              <input className={inputClass} placeholder="123 Rue Principale" value={proAddress} onChange={e=>setProAddress(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Ville</label>
                <input className={inputClass} placeholder="Mont-Tremblant" value={proCity} onChange={e=>setProCity(e.target.value)} /></div>
              <div><label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Province</label>
                <select className={inputClass} value={proProvince} onChange={e=>setProProvince(e.target.value)}>
                  <option value="">Sélectionnez...</option>
                  {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select></div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="block text-xs font-700 text-gray-400 uppercase tracking-wide mb-1.5">Code postal</label>
                <input className={inputClass} placeholder="J8E 1T4" maxLength={7} value={proPostalCode} onChange={e=>setProPostalCode(e.target.value.toUpperCase())} /></div>
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

        {/* ──────── STEP 3 PRO : Identité ──────── */}
        {step === 3 && role === 'pro' && (
          <div>
            <h2 className="text-xl font-800 text-gray-900 mb-1">Vérification d'identité 🪪</h2>
            <p className="text-sm text-gray-400 mb-5">Documents chiffrés, jamais partagés avec les propriétaires. Vérification sous 24h.</p>

            <div className="grid grid-cols-2 gap-3 mb-2">
              <UploadBox icon="🤳" title="Selfie" subtitle="Visage visible, bonne lumière"
                onFile={setSelfieFile} onError={(msg) => toast(`⚠️ ${msg}`, 'error')} teal />
              <UploadBox icon="🪪" title="Pièce d'identité" subtitle="Passeport, permis ou carte"
                onFile={setIdFile} onError={(msg) => toast(`⚠️ ${msg}`, 'error')} teal />
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Formats acceptés : JPG, PNG, WEBP, PDF · Max 10 Mo
            </p>

            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <p className="text-xs font-700 text-gray-800 mb-2">📋 Critères acceptés</p>
              <div className="grid grid-cols-2 gap-1 text-xs text-gray-400">
                <span>✅ Document officiel gouvernemental</span><span>✅ Non expiré</span>
                <span>✅ 4 coins entièrement visibles</span><span>✅ Texte lisible</span>
                <span>❌ Pas de photocopie</span><span>❌ Pas de reflets</span>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
              🔐 Chiffrement AES-256 — réponse sous 24h par courriel.
            </div>
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
            title={missingProDocs ? 'Téléversez votre selfie et votre pièce d\'identité pour continuer' : undefined}
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
