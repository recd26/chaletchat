import { supabase } from './supabase'

// Durée d'expiration d'une URL signée pour un document d'identité.
// Le critère d'acceptation P0-1 impose ~60 s : suffisant pour un affichage
// dans l'UI, insuffisant pour partager le lien publiquement.
export const ID_DOC_SIGNED_URL_TTL = 60

const BUCKET = 'id-documents'

// Cache mémoire des URLs signées : renvoyer la même URL tant qu'elle est
// valide plutôt que d'appeler Supabase à chaque re-render.
// Marge de sécurité : on invalide 10 s avant l'expiration réelle.
const REFRESH_MARGIN_MS = 10_000
const signedUrlCache = new Map() // path -> { url, expiresAt }

function isCachedUrlFresh(entry) {
  return entry && entry.expiresAt - Date.now() > REFRESH_MARGIN_MS
}

// Détecte les valeurs héritées de l'ancien schéma qui stockait des URLs
// publiques (getPublicUrl). Sur ces valeurs on renvoie l'URL telle quelle
// pour ne pas casser l'affichage historique, mais la nouvelle logique doit
// stocker un path relatif au bucket.
function looksLikeAbsoluteUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

export async function getIdDocSignedUrl(pathOrLegacyUrl) {
  if (!pathOrLegacyUrl) return null
  if (looksLikeAbsoluteUrl(pathOrLegacyUrl)) return pathOrLegacyUrl

  const cached = signedUrlCache.get(pathOrLegacyUrl)
  if (isCachedUrlFresh(cached)) return cached.url

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(pathOrLegacyUrl, ID_DOC_SIGNED_URL_TTL)

  if (error || !data?.signedUrl) return null

  signedUrlCache.set(pathOrLegacyUrl, {
    url: data.signedUrl,
    expiresAt: Date.now() + ID_DOC_SIGNED_URL_TTL * 1000,
  })
  return data.signedUrl
}

export function invalidateIdDocSignedUrl(path) {
  if (path) signedUrlCache.delete(path)
}

function randomUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback : suffisant pour un nom de fichier (pas cryptographique).
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function safeExtension(fileName) {
  if (!fileName) return 'bin'
  const raw = fileName.split('.').pop() || 'bin'
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin'
}

// Chemin final : {userId}/selfie-<uuid>.<ext>
// - Le userId comme premier segment est utilisé par les policies RLS
//   storage.objects pour restreindre l'accès au propriétaire (voir
//   supabase-schema.sql, section "id-documents").
// - Le UUID évite la collision entre deux uploads simultanés.
export function buildIdDocPath({ userId, type, fileName }) {
  if (!userId) throw new Error('userId requis pour construire un chemin id-document')
  if (!type)   throw new Error('type requis (ex: selfie, id_card)')
  const ext = safeExtension(fileName)
  return `${userId}/${type}-${randomUuid()}.${ext}`
}

export async function uploadIdDoc({ userId, type, file }) {
  const path = buildIdDocPath({ userId, type, fileName: file.name })
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || undefined })
  if (error) throw error
  return path
}
