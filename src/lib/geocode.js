const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

const cache = new Map()

/**
 * Geocode une adresse canadienne via Nominatim (OpenStreetMap).
 * Retourne { lat, lng } ou null si introuvable.
 */
export async function geocodeAddress({ address, city, province, postalCode }) {
  const query = [address, city, province, postalCode, 'Canada']
    .filter(Boolean)
    .join(', ')

  if (cache.has(query)) return cache.get(query)

  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      countrycodes: 'ca',
      limit: '1',
    })
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { 'User-Agent': 'ChaletProp-MVP/1.0' },
    })
    const data = await res.json()

    if (data && data.length > 0) {
      const result = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      }
      cache.set(query, result)
      return result
    }
    return null
  } catch (err) {
    console.error('Geocoding error:', err)
    return null
  }
}

/**
 * Distance Haversine en km entre deux points { lat, lng }.
 */
export function haversineDistance(a, b) {
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function toRad(deg) {
  return deg * Math.PI / 180
}
