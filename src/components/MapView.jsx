import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Icône personnalisée pour les demandes
const chaletIcon = new L.DivIcon({
  html: `<div style="
    background: #FF5A5F;
    color: white;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    border: 2px solid white;
  "><span style="transform: rotate(45deg)">🏔</span></div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
  className: '',
})

const proIcon = new L.DivIcon({
  html: `<div style="
    background: #0D9488;
    color: white;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    border: 3px solid white;
  ">🧹</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  className: '',
})

export default function MapView({ requests = [], proZone = null, radius = 25 }) {
  const [center, setCenter] = useState([46.8, -71.2]) // Québec par défaut

  // Coordonnées simulées par région (en prod, on utiliserait une vraie API de géocodage)
  const ZONE_COORDS = {
    'Laurentides':           [46.05, -74.5],
    'Charlevoix':            [47.5,  -70.5],
    'Cantons-de-l\'Est':    [45.4,  -72.1],
    'Lanaudière':            [46.1,  -73.5],
    'Outaouais':             [45.7,  -75.7],
    'Montréal':              [45.5,  -73.6],
    'Québec (ville)':        [46.8,  -71.2],
    'Ontario':               [43.7,  -79.4],
    'Alma':                  [48.5,  -71.6],
    'Mont-Tremblant':        [46.1,  -74.6],
    'Saint-Sauveur':         [45.9,  -74.2],
  }

  useEffect(() => {
    if (proZone && ZONE_COORDS[proZone]) {
      setCenter(ZONE_COORDS[proZone])
    } else if (requests.length > 0) {
      // Centrer sur la première demande
      const first = requests[0]
      const coords = ZONE_COORDS[first?.chalet?.city] || ZONE_COORDS[first?.chalet?.province] || [46.8, -71.2]
      setCenter(coords)
    }
  }, [proZone, requests])

  // Assigner des coordonnées aux demandes
  const requestsWithCoords = requests.map(req => {
    const city = req?.chalet?.city || ''
    const coords = ZONE_COORDS[city] ||
      Object.entries(ZONE_COORDS).find(([k]) => city.toLowerCase().includes(k.toLowerCase()))?.[1] ||
      [center[0] + (Math.random()-0.5)*0.5, center[1] + (Math.random()-0.5)*0.5]
    return { ...req, coords }
  })

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: '420px' }}>
      <MapContainer
        center={center}
        zoom={9}
        style={{ height: '100%', width: '100%' }}
        key={center.join(',')}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Cercle de rayon du pro */}
        {proZone && ZONE_COORDS[proZone] && (
          <Circle
            center={ZONE_COORDS[proZone]}
            radius={parseInt(radius) * 1000}
            pathOptions={{ color: '#0D9488', fillColor: '#0D9488', fillOpacity: 0.08, weight: 2, dashArray: '6 4' }}
          />
        )}

        {/* Position du pro */}
        {proZone && ZONE_COORDS[proZone] && (
          <Marker position={ZONE_COORDS[proZone]} icon={proIcon}>
            <Popup>
              <div className="text-center">
                <p className="font-700 text-gray-900">📍 Votre zone</p>
                <p className="text-xs text-gray-400">{proZone} • {radius} km</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Demandes disponibles */}
        {requestsWithCoords.map(req => (
          <Marker key={req.id} position={req.coords} icon={chaletIcon}>
            <Popup>
              <div style={{ minWidth: '180px' }}>
                <p style={{ fontWeight: '700', color: '#111', marginBottom: '4px' }}>
                  🏔 {req.chalet?.name || 'Chalet'}
                </p>
                <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                  📍 {req.chalet?.city || 'Ville inconnue'}
                </p>
                <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                  🗓 {req.scheduled_date ? new Date(req.scheduled_date).toLocaleDateString('fr-CA') : 'Date à confirmer'}
                </p>
                {req.estimated_price && (
                  <p style={{ fontSize: '14px', fontWeight: '700', color: '#FF5A5F' }}>
                    ~{req.estimated_price} $
                  </p>
                )}
                <div style={{
                  marginTop: '8px',
                  padding: '6px 12px',
                  background: '#0D9488',
                  color: 'white',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '700',
                  textAlign: 'center',
                  cursor: 'pointer'
                }}>
                  Voir la demande ↓
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
