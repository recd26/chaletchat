import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { haversineDistance } from '../lib/geocode'

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Icône urgente
const urgentIcon = new L.DivIcon({
  html: `<div style="
    background: #DC2626;
    color: white;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    box-shadow: 0 2px 8px rgba(220,38,38,0.5);
    border: 2px solid white;
    animation: pulse 2s infinite;
  "><span style="transform: rotate(45deg)">🔴</span></div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
  className: '',
})

// Icône normale
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

// Icône hors rayon (grisée)
const farIcon = new L.DivIcon({
  html: `<div style="
    background: #9CA3AF;
    color: white;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    border: 2px solid white;
    opacity: 0.7;
  "><span style="transform: rotate(45deg)">🏔</span></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30],
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

function isAutoUrgent(req) {
  if (req.is_urgent) return true
  const scheduled = new Date(`${req.scheduled_date}T${req.scheduled_time || '12:00'}`)
  const diff = scheduled - new Date()
  return diff > 0 && diff < 48 * 60 * 60 * 1000
}

export default function MapView({ requests = [], proLat = null, proLng = null, radius = 25, onRequestClick = null }) {
  const [center, setCenter] = useState([46.8, -71.2]) // Québec par défaut

  useEffect(() => {
    if (proLat && proLng) {
      setCenter([proLat, proLng])
    } else if (requests.length > 0) {
      const first = requests.find(r => r.chalet?.lat && r.chalet?.lng)
      if (first) setCenter([first.chalet.lat, first.chalet.lng])
    }
  }, [proLat, proLng, requests])

  // Ne garder que les demandes avec coordonnées
  const requestsWithCoords = requests
    .filter(req => req.chalet?.lat && req.chalet?.lng)
    .map(req => {
      const dist = proLat && proLng
        ? haversineDistance({ lat: proLat, lng: proLng }, { lat: req.chalet.lat, lng: req.chalet.lng })
        : null
      const inRadius = dist !== null ? dist <= radius : true
      return { ...req, coords: [req.chalet.lat, req.chalet.lng], dist, inRadius }
    })

  // Regrouper les demandes par chalet (mêmes coordonnées)
  const groupedByChalet = {}
  requestsWithCoords.forEach(req => {
    const key = `${req.chalet.lat},${req.chalet.lng}`
    if (!groupedByChalet[key]) groupedByChalet[key] = []
    groupedByChalet[key].push(req)
  })
  const chaletGroups = Object.values(groupedByChalet)

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
        {proLat && proLng && (
          <Circle
            center={[proLat, proLng]}
            radius={parseInt(radius) * 1000}
            pathOptions={{ color: '#0D9488', fillColor: '#0D9488', fillOpacity: 0.08, weight: 2, dashArray: '6 4' }}
          />
        )}

        {/* Position du pro */}
        {proLat && proLng && (
          <Marker position={[proLat, proLng]} icon={proIcon}>
            <Popup>
              <div className="text-center">
                <p className="font-700 text-gray-900">📍 Votre position</p>
                <p className="text-xs text-gray-400">{radius} km de rayon</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Demandes disponibles — groupées par chalet */}
        {chaletGroups.map(group => {
          const first = group[0]
          const count = group.length
          const hasUrgent = group.some(r => isAutoUrgent(r))
          const icon = count > 1
            ? new L.DivIcon({
                html: `<div style="
                  background: ${hasUrgent ? '#DC2626' : '#FF5A5F'};
                  color: white;
                  border-radius: 50% 50% 50% 0;
                  transform: rotate(-45deg);
                  width: 40px;
                  height: 40px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 14px;
                  font-weight: 800;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                  border: 2px solid white;
                  ${hasUrgent ? 'animation: pulse 2s infinite;' : ''}
                "><span style="transform: rotate(45deg)">${count}</span></div>`,
                iconSize: [40, 40],
                iconAnchor: [20, 40],
                popupAnchor: [0, -40],
                className: '',
              })
            : hasUrgent ? urgentIcon
            : first.inRadius ? chaletIcon : farIcon

          return (
            <Marker key={first.id} position={first.coords} icon={icon}>
              {/* Tooltip */}
              <Tooltip direction="top" offset={[0, -42]} opacity={0.95}>
                <span style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                  🏔 {first.chalet?.name}
                  {count > 1 && ` • ${count} demandes`}
                  {first.dist != null && ` • ${first.dist.toFixed(0)} km`}
                </span>
              </Tooltip>

              {/* Popup avec toutes les demandes du chalet */}
              <Popup>
                <div style={{ minWidth: '230px', maxWidth: '280px' }}>
                  {/* Header chalet */}
                  <div style={{ marginBottom: '8px' }}>
                    <p style={{ fontWeight: '700', color: '#111', fontSize: '14px', margin: 0 }}>
                      🏔 {first.chalet?.name || 'Chalet'}
                      {count > 1 && <span style={{ fontSize: '11px', color: '#FF5A5F', fontWeight: '800' }}> × {count}</span>}
                    </p>
                    <p style={{ fontSize: '12px', color: '#666', margin: '2px 0 0' }}>
                      📍 {first.chalet?.city || '?'}
                      {first.dist != null && (
                        <span style={{ color: first.inRadius ? '#0D9488' : '#9CA3AF', fontWeight: '600' }}>
                          {' '}— {first.dist.toFixed(1)} km {!first.inRadius ? '(hors zone)' : ''}
                        </span>
                      )}
                    </p>
                    <p style={{ fontSize: '11px', color: '#999', margin: '2px 0 0' }}>
                      {first.chalet?.bedrooms || '?'} ch. • {first.chalet?.bathrooms || '?'} sdb
                    </p>
                  </div>

                  {/* Liste des demandes */}
                  {group.map((req, idx) => {
                    const urgent = isAutoUrgent(req)
                    const dateStr = req.scheduled_date
                      ? new Date(req.scheduled_date).toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' })
                      : '?'
                    const offersCount = req.offers?.length || 0
                    return (
                      <div key={req.id}
                        onClick={(e) => { e.stopPropagation(); onRequestClick && onRequestClick(req.id) }}
                        onMouseDown={(e) => e.stopPropagation()}
                        style={{
                          padding: '8px',
                          marginBottom: idx < group.length - 1 ? '6px' : '0',
                          background: urgent ? '#FEF2F2' : '#F9FAFB',
                          border: `1px solid ${urgent ? '#FECACA' : '#E5E7EB'}`,
                          borderRadius: '8px',
                          cursor: 'pointer',
                        }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#111' }}>
                            {urgent && '🔴 '}🗓 {dateStr}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '800', color: '#0D9488' }}>
                              {req.suggested_budget ? `${req.suggested_budget} $` : '—'}
                            </span>
                            <span style={{ fontSize: '10px', color: '#0D9488', fontWeight: '600' }}>Voir →</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '10px', background: '#F3F4F6', color: '#666', padding: '1px 5px', borderRadius: '4px' }}>
                            ⏰ {req.scheduled_time || '?'}
                          </span>
                          <span style={{ fontSize: '10px', background: '#F3F4F6', color: '#666', padding: '1px 5px', borderRadius: '4px' }}>
                            ~{req.estimated_hours || '?'}h
                          </span>
                          {offersCount > 0 && (
                            <span style={{ fontSize: '10px', background: '#FEF3C7', color: '#D97706', padding: '1px 5px', borderRadius: '4px', fontWeight: '600' }}>
                              📨 {offersCount}
                            </span>
                          )}
                          {(req.laundry_tasks?.length || 0) > 0 && (
                            <span style={{ fontSize: '10px', background: '#EFF6FF', color: '#2563EB', padding: '1px 5px', borderRadius: '4px' }}>🧺</span>
                          )}
                          {(req.spa_tasks?.length || 0) > 0 && (
                            <span style={{ fontSize: '10px', background: '#FAF5FF', color: '#7C3AED', padding: '1px 5px', borderRadius: '4px' }}>♨️</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
