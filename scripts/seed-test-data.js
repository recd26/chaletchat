/**
 * Script de données de test — 10 chalets au Saguenay-Lac-Saint-Jean
 * avec 1 demande par chalet.
 *
 * Usage: node scripts/seed-test-data.js
 * Nécessite les variables d'env VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Charger .env
config({ path: '.env' })
const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('❌ Variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY requises')
  console.log('Créez un fichier .env avec ces variables ou exportez-les')
  process.exit(1)
}

const supabase = createClient(url, key)

// ── Connexion au compte proprio ──
const OWNER_EMAIL = 'ouellet.david@outlook.com'
const OWNER_PASSWORD = process.argv[2]
if (!OWNER_PASSWORD) {
  console.error('❌ Usage: node scripts/seed-test-data.js <mot-de-passe>')
  process.exit(1)
}

// ── 10 chalets au Saguenay-Lac-Saint-Jean ──
const CHALETS = [
  {
    name: 'Chalet du Fjord',
    address: '125 Rue du Quai',
    city: 'La Baie',
    province: 'Québec',
    postal_code: 'G7B 3P1',
    lat: 48.3324, lng: -70.8816,
    bedrooms: 3, bathrooms: 2,
    access_code: '4521', wifi_name: 'Fjord-WiFi', wifi_password: 'fjord2024',
  },
  {
    name: 'Refuge du Lac Kénogami',
    address: '88 Chemin des Pins',
    city: 'Lac-Kénogami',
    province: 'Québec',
    postal_code: 'G7X 7V1',
    lat: 48.3842, lng: -71.2567,
    bedrooms: 4, bathrooms: 2,
    access_code: '1234', wifi_name: 'Kenogami-Net', wifi_password: 'lac1234',
  },
  {
    name: 'Chalet Boréal',
    address: '342 Boulevard du Royaume',
    city: 'Jonquière',
    province: 'Québec',
    postal_code: 'G7S 4J5',
    lat: 48.4153, lng: -71.2484,
    bedrooms: 2, bathrooms: 1,
    access_code: '7890', wifi_name: 'Boreal-WiFi', wifi_password: 'boreal7890',
  },
  {
    name: 'Domaine des Monts-Valin',
    address: '15 Chemin du Sommet',
    city: 'Saint-Fulgence',
    province: 'Québec',
    postal_code: 'G0V 1S0',
    lat: 48.4571, lng: -70.6498,
    bedrooms: 5, bathrooms: 3,
    access_code: '5555', wifi_name: 'Valin-Peak', wifi_password: 'montvalin55',
  },
  {
    name: 'La Cabane à sucre du Nord',
    address: '200 Rang Saint-Joseph',
    city: 'Hébertville',
    province: 'Québec',
    postal_code: 'G8N 1M8',
    lat: 48.3928, lng: -71.6803,
    bedrooms: 3, bathrooms: 1,
    access_code: '3030', wifi_name: 'Cabane-Nord', wifi_password: 'sucre3030',
  },
  {
    name: 'Chalet Lac-Bouchette',
    address: '66 Rue Principale',
    city: 'Lac-Bouchette',
    province: 'Québec',
    postal_code: 'G0W 1V0',
    lat: 48.2302, lng: -72.1810,
    bedrooms: 2, bathrooms: 1,
    access_code: '8080', wifi_name: 'LacB-WiFi', wifi_password: 'bouchette8080',
  },
  {
    name: 'Auberge du Lac-Saint-Jean',
    address: '410 Rue Scott',
    city: 'Roberval',
    province: 'Québec',
    postal_code: 'G8H 1S8',
    lat: 48.5190, lng: -72.2282,
    bedrooms: 4, bathrooms: 2,
    access_code: '1111', wifi_name: 'Auberge-LSJ', wifi_password: 'roberval11',
  },
  {
    name: 'Chalet des Chutes',
    address: '55 Rue de Val-Jalbert',
    city: 'Chambord',
    province: 'Québec',
    postal_code: 'G0W 1G0',
    lat: 48.4469, lng: -72.0676,
    bedrooms: 3, bathrooms: 2,
    access_code: '9999', wifi_name: 'Chutes-Net', wifi_password: 'jalbert99',
  },
  {
    name: 'Villégiature Alma',
    address: '790 Rue Sacré-Coeur Ouest',
    city: 'Alma',
    province: 'Québec',
    postal_code: 'G8B 1M4',
    lat: 48.5508, lng: -71.6497,
    bedrooms: 3, bathrooms: 2,
    access_code: '2468', wifi_name: 'Alma-Villa', wifi_password: 'alma2468',
  },
  {
    name: 'Chalet Petit-Saguenay',
    address: '22 Rue Dumas',
    city: 'Petit-Saguenay',
    province: 'Québec',
    postal_code: 'G0V 1N0',
    lat: 48.2340, lng: -70.0850,
    bedrooms: 2, bathrooms: 1,
    access_code: '6767', wifi_name: 'PtSag-WiFi', wifi_password: 'saguenay67',
  },
]

// Pièces par défaut pour la checklist
const DEFAULT_ROOMS = ['Cuisine', 'Salon', 'Salle de bain', 'Chambre principale', 'Chambre 2', 'Entrée']

async function main() {
  console.log('🔑 Connexion...')
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
  })
  if (authErr) { console.error('❌ Auth:', authErr.message); process.exit(1) }
  const userId = auth.user.id
  console.log(`✅ Connecté en tant que ${OWNER_EMAIL} (${userId})`)

  for (let i = 0; i < CHALETS.length; i++) {
    const c = CHALETS[i]
    console.log(`\n🏔 [${i + 1}/10] Création: ${c.name}...`)

    // 1. Créer le chalet
    const { data: chalet, error: chaletErr } = await supabase
      .from('chalets')
      .insert({
        owner_id: userId,
        name: c.name,
        address: c.address,
        city: c.city,
        province: c.province,
        postal_code: c.postal_code,
        lat: c.lat,
        lng: c.lng,
        bedrooms: c.bedrooms,
        bathrooms: c.bathrooms,
        access_code: c.access_code,
        wifi_name: c.wifi_name,
        wifi_password: c.wifi_password,
      })
      .select()
      .single()

    if (chaletErr) { console.error(`  ❌ Chalet: ${chaletErr.message}`); continue }
    console.log(`  ✅ Chalet créé: ${chalet.id}`)

    // 2. Créer les pièces de la checklist
    const roomsToInsert = DEFAULT_ROOMS.slice(0, c.bedrooms + 2).map((name, idx) => ({
      chalet_id: chalet.id,
      room_name: name,
      position: idx,
    }))
    const { error: roomErr } = await supabase
      .from('checklist_templates')
      .insert(roomsToInsert)
    if (roomErr) console.error(`  ⚠️ Checklist: ${roomErr.message}`)
    else console.log(`  ✅ ${roomsToInsert.length} pièces ajoutées`)

    // 3. Créer une demande de ménage (dates variées cette semaine et la prochaine)
    const today = new Date()
    const offset = i < 5 ? i + 1 : i + 3 // répartir sur 2 semaines
    const schedDate = new Date(today)
    schedDate.setDate(today.getDate() + offset)
    const dateStr = schedDate.toISOString().split('T')[0]
    const timeStr = `${9 + (i % 4)}:00` // 9h, 10h, 11h, 12h
    const hours = 1.5 + (c.bedrooms * 0.5)
    const budget = 60 + (c.bedrooms * 15) + (c.bathrooms * 10)

    const { data: request, error: reqErr } = await supabase
      .from('cleaning_requests')
      .insert({
        chalet_id: chalet.id,
        owner_id: userId,
        scheduled_date: dateStr,
        scheduled_time: timeStr,
        estimated_hours: hours,
        suggested_budget: budget,
        status: 'open',
        is_urgent: i === 0, // la première est urgente
        special_notes: i % 3 === 0 ? 'Invités arrivent le lendemain, bien vérifier la literie' : null,
        supplies_on_site: JSON.stringify(
          i % 2 === 0
            ? [{ name: 'Balai', available: true }, { name: 'Aspirateur', available: true }, { name: 'Produits salle de bain', available: false }]
            : [{ name: 'Aspirateur', available: true }, { name: 'Serpillère', available: true }]
        ),
        laundry_tasks: JSON.stringify(
          c.bedrooms >= 3
            ? [{ name: 'Draps lit queen' }, { name: 'Serviettes' }]
            : []
        ),
        spa_tasks: JSON.stringify(
          c.bathrooms >= 2
            ? [{ name: 'Nettoyage spa' }, { name: 'Vérifier pH' }]
            : []
        ),
      })
      .select()
      .single()

    if (reqErr) console.error(`  ❌ Demande: ${reqErr.message}`)
    else console.log(`  ✅ Demande créée: ${dateStr} ${timeStr} — ${budget}$ — ${request.id}`)
  }

  console.log('\n🎉 Terminé ! 10 chalets + 10 demandes créés.')
  await supabase.auth.signOut()
}

main().catch(console.error)
