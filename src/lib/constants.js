// ── Provinces et territoires du Canada (13) ──────────────────
export const PROVINCES = [
  'Alberta',
  'Colombie-Britannique',
  'Île-du-Prince-Édouard',
  'Manitoba',
  'Nouveau-Brunswick',
  'Nouvelle-Écosse',
  'Nunavut',
  'Ontario',
  'Québec',
  'Saskatchewan',
  'Terre-Neuve-et-Labrador',
  'Territoires du Nord-Ouest',
  'Yukon',
]

// ── Validation code postal canadien (A1A 1A1) ───────────────
const POSTAL_CODE_REGEX = /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/

export function isValidPostalCode(code) {
  return POSTAL_CODE_REGEX.test(code?.trim() || '')
}
