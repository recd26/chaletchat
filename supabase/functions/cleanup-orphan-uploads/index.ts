import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Contexte (CHA-6 / P0-2) ────────────────────────────────────────────────
// Depuis P0-2, les fichiers d'identité sont uploadés sous `{userId}/…` après
// signUp — plus jamais dans `temp/`. Un objet `temp/*` ne peut donc provenir
// que d'un ancien code ou d'un contournement manuel : on le supprime après
// 24 h. Un objet `{uid}/*` sans profil correspondant vient d'un signUp qui
// s'est terminé prématurément (échec après auth, sans upsert du profil) — on
// le supprime pour éviter des orphelins non nettoyables.
//
// Sécurité : appelé exclusivement par pg_cron via `Authorization: Bearer
// <service_role_key>` (voir supabase-schema.sql section P0-2 cron). Aucune
// route publique ne doit invoquer cette fonction — le service role donne un
// accès total au bucket. En dernier recours on vérifie que la clé fournie
// correspond à SUPABASE_SERVICE_ROLE_KEY côté env.

const BUCKET = 'id-documents'
const TEMP_PREFIX = 'temp'
const TEMP_MAX_AGE_MS = 24 * 60 * 60 * 1000
const LIST_PAGE_SIZE = 1000

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type StorageEntry = {
  name: string
  id?: string | null
  updated_at?: string
  created_at?: string
  last_accessed_at?: string
  metadata?: Record<string, unknown> | null
}

// Liste toute la première "couche" de dossiers/fichiers du bucket. Les
// entrées dont `id` est null correspondent à des dossiers virtuels ; les
// autres sont des fichiers à la racine (on n'en attend pas mais on nettoie
// tout objet racine plus vieux que TEMP_MAX_AGE_MS pour être défensif).
async function listPrefix(
  supabase: ReturnType<typeof createClient>,
  prefix: string,
): Promise<StorageEntry[]> {
  const out: StorageEntry[] = []
  let offset = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
      limit: LIST_PAGE_SIZE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw error
    if (!data || data.length === 0) break
    out.push(...(data as StorageEntry[]))
    if (data.length < LIST_PAGE_SIZE) break
    offset += data.length
  }
  return out
}

function isOlderThan(entry: StorageEntry, maxAgeMs: number): boolean {
  const ts = entry.updated_at || entry.created_at
  if (!ts) return false
  const parsed = Date.parse(ts)
  if (Number.isNaN(parsed)) return false
  return Date.now() - parsed > maxAgeMs
}

async function removeBatched(
  supabase: ReturnType<typeof createClient>,
  paths: string[],
): Promise<number> {
  if (paths.length === 0) return 0
  // supabase-js remove() supporte plusieurs paths mais on découpe pour éviter
  // les payloads/timeout Postgres si un jour la liste explose.
  const CHUNK = 200
  let removed = 0
  for (let i = 0; i < paths.length; i += CHUNK) {
    const slice = paths.slice(i, i + CHUNK)
    const { data, error } = await supabase.storage.from(BUCKET).remove(slice)
    if (error) throw error
    removed += data?.length ?? slice.length
  }
  return removed
}

async function cleanupTemp(
  supabase: ReturnType<typeof createClient>,
): Promise<{ scanned: number; deleted: number; sample: string[] }> {
  const entries = await listPrefix(supabase, TEMP_PREFIX)
  const stale: string[] = []
  for (const entry of entries) {
    if (!entry.id) continue // sous-dossier, on l'ignore (rare mais possible)
    if (isOlderThan(entry, TEMP_MAX_AGE_MS)) stale.push(`${TEMP_PREFIX}/${entry.name}`)
  }
  const deleted = await removeBatched(supabase, stale)
  return { scanned: entries.length, deleted, sample: stale.slice(0, 5) }
}

async function cleanupOrphanUserFolders(
  supabase: ReturnType<typeof createClient>,
): Promise<{ folders: number; deleted: number; sample: string[] }> {
  const rootEntries = await listPrefix(supabase, '')

  // On ne considère que les entrées de type dossier (id null) qui ressemblent
  // à un UUID — le premier segment est censé être auth.uid().
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const userFolders = rootEntries
    .filter((e) => !e.id && uuidRe.test(e.name))
    .map((e) => e.name)

  if (userFolders.length === 0) {
    return { folders: 0, deleted: 0, sample: [] }
  }

  // On demande à Postgres quels ids existent — les autres sont orphelins.
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .in('id', userFolders)
  if (profileError) throw profileError

  const known = new Set((profiles ?? []).map((p: { id: string }) => p.id))
  const orphanFolders = userFolders.filter((uid) => !known.has(uid))

  const orphanPaths: string[] = []
  for (const folder of orphanFolders) {
    const files = await listPrefix(supabase, folder)
    for (const f of files) {
      if (f.id) orphanPaths.push(`${folder}/${f.name}`)
    }
  }

  const deleted = await removeBatched(supabase, orphanPaths)
  return { folders: orphanFolders.length, deleted, sample: orphanPaths.slice(0, 5) }
}

function isAuthorized(req: Request): boolean {
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return false
  return auth.slice('Bearer '.length) === SUPABASE_SERVICE_ROLE_KEY
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured' })
  }
  if (!isAuthorized(req)) {
    return json(401, { error: 'Unauthorized' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  try {
    const [tempResult, orphanResult] = await Promise.all([
      cleanupTemp(supabase),
      cleanupOrphanUserFolders(supabase),
    ])
    return json(200, {
      success: true,
      temp: tempResult,
      orphans: orphanResult,
    })
  } catch (err) {
    return json(500, { error: (err as Error).message })
  }
})
