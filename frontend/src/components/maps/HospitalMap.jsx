import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'

// Red cross hospital icon
const hospitalIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:30px;height:30px;
    background:#ef4444;
    border:2px solid #fff;
    border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 2px 8px rgba(0,0,0,.5);
    font-weight:900;color:#fff;font-size:16px;line-height:1;
  ">+</div>`,
  iconSize:    [30, 30],
  iconAnchor:  [15, 15],
  popupAnchor: [0, -18],
})

// Blue pulsing user location icon
const userIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:20px;height:20px;
    background:#3b82f6;
    border:3px solid #fff;
    border-radius:50%;
    box-shadow:0 0 0 6px rgba(59,130,246,0.3), 0 2px 8px rgba(0,0,0,.5);
  "></div>`,
  iconSize:    [20, 20],
  iconAnchor:  [10, 10],
  popupAnchor: [0, -14],
})

// Pan to a target position
function PanTo({ target }) {
  const map = useMap()
  useEffect(() => {
    if (target) {
      const lat = target.lat ?? target.latitude
      const lng = target.lng ?? target.longitude
      if (lat && lng) map.setView([lat, lng], 15)
    }
  }, [target, map])
  return null
}

// Fit map to show user + all hospitals
function FitBounds({ userLocation, hospitals }) {
  const map = useMap()
  useEffect(() => {
    if (!userLocation) return
    const points = [[userLocation.lat, userLocation.lng]]
    hospitals.forEach(h => {
      const lat = h.lat ?? h.latitude
      const lng = h.lng ?? h.longitude
      if (lat && lng) points.push([lat, lng])
    })
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 })
    } else {
      map.setView([userLocation.lat, userLocation.lng], 13)
    }
  // only re-fit when location or hospital list changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation?.lat, userLocation?.lng, hospitals.length])
  return null
}

export default function HospitalMap({
  hospitals        = [],
  userLocation     = null,
  center           = [23.0225, 72.5714],
  selectedHospital = null,
  radius           = 5,
  height           = '100%',
}) {
  const mapCenter = userLocation
    ? [userLocation.lat, userLocation.lng]
    : center

  return (
    <MapContainer
      center={mapCenter}
      zoom={12}
      style={{ height, width: '100%' }}
      className="rounded-xl z-0"
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com">CARTO</a>'
      />

      {/* Fit bounds when data changes */}
      {userLocation && (
        <FitBounds userLocation={userLocation} hospitals={hospitals} />
      )}

      {/* Pan to selected hospital */}
      {selectedHospital && <PanTo target={selectedHospital} />}

      {/* Radius circle around user */}
      {userLocation && (
        <Circle
          center={[userLocation.lat, userLocation.lng]}
          radius={radius * 1000}           // metres
          pathOptions={{
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.06,
            weight: 1.5,
            dashArray: '6 4',
          }}
        />
      )}

      {/* User location marker */}
      {userLocation && (
        <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
          <Popup>
            <div style={{ fontFamily: 'system-ui', minWidth: 140 }}>
              <strong style={{ color: '#60a5fa' }}>📍 Your Location</strong>
              <p style={{ color: '#999', fontSize: 11, margin: '4px 0 0' }}>
                {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)}
              </p>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Hospital markers */}
      {hospitals.map((h, i) => {
        const lat = h.lat ?? h.latitude
        const lng = h.lng ?? h.longitude
        if (!lat || !lng) return null
        return (
          <Marker key={h.id ?? i} position={[lat, lng]} icon={hospitalIcon}>
            <Popup>
              <div style={{ minWidth: 200, fontFamily: 'system-ui, sans-serif' }}>
                <strong style={{ color: '#fff', fontSize: 13 }}>{h.name}</strong>
                {h.distance != null && (
                  <p style={{ color: '#34d399', fontSize: 12, margin: '4px 0 2px', fontWeight: 600 }}>
                    📍 {h.distance.toFixed(1)} km away
                  </p>
                )}
                {(h.contact || h.phone) && (
                  <p style={{ color: '#ccc', fontSize: 11 }}>📞 {h.contact ?? h.phone}</p>
                )}
                {h.address && (
                  <p style={{ color: '#999', fontSize: 11, marginTop: 4 }}>{h.address}</p>
                )}
                {(h.emergency_facilities || h.emergency) && (
                  <span style={{
                    display: 'inline-block', marginTop: 6,
                    background: '#ef444433', color: '#f87171',
                    border: '1px solid #ef444466',
                    borderRadius: 99, padding: '2px 8px', fontSize: 10, fontWeight: 600,
                  }}>
                    Emergency 24/7
                  </span>
                )}
              </div>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
