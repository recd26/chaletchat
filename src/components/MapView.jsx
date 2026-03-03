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

        {/* Demandes disponibles */}
        {requestsWithCoords.map(req => {
          const urgent = isAutoUrgent(req)
          const icon = urgent ? urgentIcon : req.inRadius ? chaletIcon : farIcon
          const rooms = req.chalet?.checklist_templates?.length || 0
          const offersCount = req.offers?.length || 0
          const dateStr = req.scheduled_date
            ? new Date(req.scheduled_date).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })
            : '?'
          const dayStr = req.scheduled_date
            ? new Date(req.scheduled_date).toLocaleDateString('fr-CA', { weekday: 'short' })
            : ''

          return (
            <Marker key={req.id} position={req.coords} icon={icon}>
              {/* Tooltip au survol — 3 infos clés max */}
              <Tooltip direction="top" offset={[0, -38]} opacity={0.95}>
                <span style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                  {urgent && '🔴 '}
                  {`🗓 ${dateStr}`}
                  {req.dist != null && ` • 📍 ${req.dist.toFixed(0)} km`}
                  {` • 📨 ${offersCount} offre${offersCount !== 1 ? 's' : ''}`}
                </span>
              </Tooltip>

              {/* Popup au clic — infos complètes */}
              <Popup>
                <div style={{ minWidth: '220px', maxWidth: '260px' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '6px' }}>
                    <p style={{ fontWeight: '700', color: '#111', fontSize: '14px', margin: 0 }}>
                      🏔 {req.chalet?.name || 'Chalet'}
                    </p>
                    {urgent && (
                      <span style={{ background: '#FEE2E2', color: '#DC2626', fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '6px' }}>
                        🔴 {req.is_urgent ? 'Urgent' : '< 48h'}
                      </span>
                    )}
                  </div>

                  {/* Lieu + distance */}
                  <p style={{ fontSize: '12px', color: '#666', margin: '0 0 4px' }}>
                    📍 {req.chalet?.city || '?'}
                    {req.dist != null && (
                      <span style={{ color: req.inRadius ? '#0D9488' : '#9CA3AF', fontWeight: '600' }}>
                        {' '}— {req.dist.toFixed(1)} km {!req.inRadius ? '(hors zone)' : ''}
                      </span>
                    )}
                  </p>

                  {/* Grille stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', margin: '8px 0', background: '#F9FAFB', borderRadius: '8px', padding: '6px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '13px', fontWeight: '800', color: '#111', margin: 0 }}>
                        {req.suggested_budget ? `${req.suggested_budget} $` : '—'}
                      </p>
                      <p style={{ fontSize: '10px', color: '#999', margin: 0 }}>💰 Budget</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '13px', fontWeight: '800', color: '#111', margin: 0 }}>
                        {dateStr}
                      </p>
                      <p style={{ fontSize: '10px', color: '#999', margin: 0 }}>🗓 {dayStr}</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '13px', fontWeight: '800', color: '#111', margin: 0 }}>
                        {req.chalet?.bedrooms || '?'} ch / {req.chalet?.bathrooms || '?'} sdb
                      </p>
                      <p style={{ fontSize: '10px', color: '#999', margin: 0 }}>🏠 Taille</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '13px', fontWeight: '800', color: '#111', margin: 0 }}>
                        ~{req.estimated_hours || '?'}h
                      </p>
                      <p style={{ fontSize: '10px', color: '#999', margin: 0 }}>⏱ Durée</p>
                    </div>
                  </div>

                  {/* Tags */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '8px' }}>
                    {rooms > 0 && (
                      <span style={{ fontSize: '10px', background: '#F0FDFA', color: '#0D9488', border: '1px solid #99F6E4', padding: '2px 6px', borderRadius: '6px' }}>
                        📸 {rooms} pièces
                      </span>
                    )}
                    {req.scheduled_time && (
                      <span style={{ fontSize: '10px', background: '#F3F4F6', color: '#666', padding: '2px 6px', borderRadius: '6px' }}>
                        ⏰ {req.scheduled_time}
                      </span>
                    )}
                    {(req.laundry_tasks?.length || 0) > 0 && (
                      <span style={{ fontSize: '10px', background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', padding: '2px 6px', borderRadius: '6px' }}>
                        🧺 Lavage
                      </span>
                    )}
                    {(req.spa_tasks?.length || 0) > 0 && (
                      <span style={{ fontSize: '10px', background: '#FAF5FF', color: '#7C3AED', border: '1px solid #DDD6FE', padding: '2px 6px', borderRadius: '6px' }}>
                        ♨️ Spa
                      </span>
                    )}
                    {offersCount > 0 && (
                      <span style={{ fontSize: '10px', background: '#FEF3C7', color: '#D97706', border: '1px solid #FDE68A', padding: '2px 6px', borderRadius: '6px', fontWeight: '600' }}>
                        📨 {offersCount} offre{offersCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Bouton */}
                  <div
                    onClick={() => onRequestClick && onRequestClick(req.id)}
                    style={{
                      padding: '8px 12px',
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
          )
        })}
      </MapContainer>
    </div>
  )
}
