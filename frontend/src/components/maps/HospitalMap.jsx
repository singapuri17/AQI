import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

// Custom red-cross hospital icon
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

export default function HospitalMap({
  hospitals        = [],
  center           = [23.0225, 72.5714],
  selectedHospital = null,
  height           = '100%',
}) {
  return (
    <MapContainer
      center={center}
      zoom={12}
      style={{ height, width: '100%' }}
      className="rounded-xl z-0"
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com">CARTO</a>'
      />
      {selectedHospital && <PanTo target={selectedHospital} />}

      {hospitals.map((h, i) => {
        const lat = h.lat ?? h.latitude
        const lng = h.lng ?? h.longitude
        if (!lat || !lng) return null
        return (
          <Marker key={h.id ?? i} position={[lat, lng]} icon={hospitalIcon}>
            <Popup>
              <div style={{ minWidth: 200, fontFamily: 'system-ui, sans-serif' }}>
                <strong style={{ color: '#fff', fontSize: 13 }}>{h.name}</strong>
                {h.distance_km != null && (
                  <p style={{ color: '#60a5fa', fontSize: 11, margin: '4px 0' }}>
                    {h.distance_km.toFixed(1)} km away
                  </p>
                )}
                {h.contact && (
                  <p style={{ color: '#ccc', fontSize: 11 }}>📞 {h.contact}</p>
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
