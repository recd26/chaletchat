// Missions manuelles / importées — stockage local pour l'onglet Calendrier pro.
// Une mission manuelle = un contrat externe à la plateforme (client direct du pro),
// avec nom du chalet, date, heure de début et durée totale de nettoyage.

const STORAGE_KEY_PREFIX = 'chaletchat:manual-missions'

function storageKey(userId) {
  return `${STORAGE_KEY_PREFIX}:${userId || 'anon'}`
}

// ── CRUD localStorage ─────────────────────────────────────────
export function loadManualMissions(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function saveManualMissions(userId, missions) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(missions))
  } catch (err) {
    console.warn('saveManualMissions:', err?.message || err)
  }
}

function makeId() {
  return `mm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function addManualMissions(userId, newMissions) {
  const current = loadManualMissions(userId)
  const now = new Date().toISOString()
  const stamped = newMissions.map(m => ({
    id: makeId(),
    created_at: now,
    source: m.source || 'manual',
    ...m,
  }))
  const merged = [...current, ...stamped]
  saveManualMissions(userId, merged)
  return merged
}

export function deleteManualMission(userId, id) {
  const current = loadManualMissions(userId)
  const filtered = current.filter(m => m.id !== id)
  saveManualMissions(userId, filtered)
  return filtered
}

// ── Validation ────────────────────────────────────────────────
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{1,2}:\d{2}$/

export function validateMission(row) {
  const errors = []
  const name = String(row.chalet_name || '').trim()
  const date = String(row.date || '').trim()
  const startTime = String(row.start_time || '').trim()
  const hoursRaw = row.hours

  if (!name) errors.push('nom du chalet requis')
  if (!DATE_RE.test(date)) errors.push('date invalide (AAAA-MM-JJ)')
  if (!TIME_RE.test(startTime)) errors.push('heure invalide (HH:MM)')

  const hours = Number(hoursRaw)
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
    errors.push('durée invalide (0.5 à 24)')
  }

  // Normaliser HH:MM → 08:30
  const normTime = TIME_RE.test(startTime)
    ? startTime.split(':').map((p, i) => (i === 0 ? p.padStart(2, '0') : p.slice(0, 2))).join(':')
    : startTime

  return {
    valid: errors.length === 0,
    errors,
    mission: {
      chalet_name: name,
      date,
      start_time: normTime,
      hours: Number.isFinite(hours) ? hours : null,
    },
  }
}

// ── Template CSV téléchargeable ───────────────────────────────
// Colonnes: chalet_name, date (YYYY-MM-DD), start_time (HH:MM), hours (0.5 à 24)
// Note : les CSV ne supportent pas nativement les drop-downs Excel, mais le
// fichier ouvre parfaitement dans Excel, Google Sheets, Numbers et LibreOffice.
// Une feuille d'instructions est incluse en commentaire (lignes préfixées par #).
export function buildCsvTemplate() {
  const today = new Date()
  const in3d = new Date(today); in3d.setDate(today.getDate() + 3)
  const in5d = new Date(today); in5d.setDate(today.getDate() + 5)
  const ymd = d => d.toISOString().split('T')[0]

  const rows = [
    // Header
    ['chalet_name', 'date', 'start_time', 'hours'],
    // Exemples réels
    ['Chalet du Lac', ymd(in3d), '10:00', '3'],
    ['Refuge des Cerfs', ymd(in5d), '14:30', '2.5'],
  ]

  // Instructions collées en tête (lignes commentaires ignorées par notre parseur)
  const instructions = [
    '# ChaletChat — Modèle d\'import missions',
    '# Remplissez une ligne par mission. Ne modifiez pas la ligne d\'en-tête.',
    '# chalet_name  : nom du chalet ou du client (texte)',
    '# date         : format AAAA-MM-JJ (ex : 2026-07-15)',
    '# start_time   : format HH:MM sur 24h (ex : 09:30, 14:00)',
    '# hours        : durée totale du nettoyage en heures (ex : 2, 2.5, 3)',
    '# Supprimez ces lignes # avant l\'import, ou laissez-les — elles seront ignorées.',
    '',
  ]

  const csvBody = rows.map(r => r.map(escapeCsvCell).join(',')).join('\r\n')
  return instructions.join('\r\n') + csvBody + '\r\n'
}

function escapeCsvCell(v) {
  const s = String(v ?? '')
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function downloadCsvTemplate(filename = 'chaletchat-modele-missions.csv') {
  const csv = buildCsvTemplate()
  // BOM UTF-8 pour qu'Excel/Windows détecte correctement les accents
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  triggerDownload(blob, filename)
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ── Parser CSV (RFC-4180-lite, avec strip BOM + skip lignes '#') ──
export function parseCsv(text) {
  if (!text) return { header: [], rows: [] }
  // Strip BOM
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
  const lines = splitCsvLines(text)

  // Ignorer commentaires '#' et lignes vides
  const dataLines = lines.filter(l => l.trim() !== '' && !l.trim().startsWith('#'))
  if (dataLines.length === 0) return { header: [], rows: [] }

  const header = splitCsvRow(dataLines[0]).map(h => h.trim().toLowerCase())
  const rows = dataLines.slice(1).map(line => {
    const cells = splitCsvRow(line)
    const obj = {}
    header.forEach((h, i) => { obj[h] = (cells[i] ?? '').trim() })
    return obj
  })
  return { header, rows }
}

// Découpe respectant les guillemets et les nouvelles lignes échappées
function splitCsvLines(text) {
  const out = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"' ) {
      inQ = !inQ
      cur += c
    } else if ((c === '\n' || c === '\r') && !inQ) {
      if (c === '\r' && text[i + 1] === '\n') i++
      out.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  if (cur.length) out.push(cur)
  return out
}

function splitCsvRow(line) {
  const out = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
      else inQ = !inQ
    } else if (c === ',' && !inQ) {
      out.push(cur); cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out
}

// ── Alias : accepte des en-têtes en français ou anglais ───────
const HEADER_ALIASES = {
  chalet_name: ['chalet_name', 'chalet', 'nom du chalet', 'nom_chalet', 'nom', 'name', 'client'],
  date: ['date', 'jour', 'date_du_nettoyage'],
  start_time: ['start_time', 'heure', 'heure_debut', 'heure de début', 'heure_de_debut', 'time', 'debut'],
  hours: ['hours', 'heures', 'duree', 'durée', 'duration', 'total_hours', 'temps'],
}

export function normalizeCsvRows(parsed) {
  const { header, rows } = parsed
  const map = {}
  Object.entries(HEADER_ALIASES).forEach(([canonical, aliases]) => {
    const found = header.find(h => aliases.includes(h))
    if (found) map[canonical] = found
  })
  return rows.map(r => ({
    chalet_name: r[map.chalet_name] || '',
    date: r[map.date] || '',
    start_time: r[map.start_time] || '',
    hours: r[map.hours] || '',
  }))
}

// ── Import complet : text → validated missions + errors summary ──
export function parseImportText(text) {
  const parsed = parseCsv(text)
  const normalized = normalizeCsvRows(parsed)
  const items = normalized.map((r, idx) => {
    const v = validateMission(r)
    return { rowNumber: idx + 2, raw: r, ...v }
  })
  return {
    header: parsed.header,
    items,
    validCount: items.filter(i => i.valid).length,
    invalidCount: items.filter(i => !i.valid).length,
  }
}
