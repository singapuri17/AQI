import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import { getAQIColor, getAQICategory, formatAQI } from '../../utils/aqiUtils'
import AQIBadge from '../common/AQIBadge'

// Re-centre the map whenever the `center` prop changes
function RecenterMap({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.setView(center, map.getZoom())
  }, [center, map])
  return null
}

export default function AQIMap({
  wards  = [],
  center = [23.0225, 72.5714],
  zoom   = 11,
  height = '100%',
  heatmap = false,
}) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height, width: '100%' }}
      className="rounded-xl z-0"
      // prevent map from stealing all pointer events inside the card
      scrollWheelZoom={true}
    >
      <TileLayer
  attribution='&copy; OpenStreetMap contributors'
  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
/>

      <RecenterMap center={center} />

      {wards.map((ward, index) => {
        // Support both normalised (lat/lng) and raw backend (latitude/longitude) shapes
        const lat = ward.lat ?? ward.latitude
        const lng = ward.lng ?? ward.longitude
        const aqi = ward.aqi ?? ward.aqi_value ?? 0
        const name = ward.name ?? ward.ward_name ?? `Ward ${index + 1}`
        const id  = ward.id ?? ward.ward_id ?? index

        // Skip markers with no valid coordinates
        if (!lat || !lng) return null

        const color  = getAQIColor(aqi)
        const category = getAQICategory(aqi)

        // Radius scales with AQI severity (12–26 px)
        const radius = Math.max(12, Math.min(26, (aqi / 300) * 28 + 10))

        // In heatmap mode use larger, more transparent circles
        const fillOpacity = heatmap ? 0.45 : 0.80
        const markerRadius = heatmap ? radius * 1.6 : radius

        return (
          <CircleMarker
            key={id}
            center={[lat, lng]}
            radius={markerRadius}
            pathOptions={{
              fillColor:   color,
              fillOpacity,
              color:       color,
              weight:      heatmap ? 0 : 2,
              opacity:     0.9,
            }}
          >
            <Popup>
              <div style={{ minWidth: 180, fontFamily: 'system-ui, sans-serif' }}>
                {/* Ward name + AQI badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ color: '#fff', fontSize: 13 }}>{name}</strong>
                  <span style={{
                    background: `${color}33`,
                    color,
                    border: `1px solid ${color}66`,
                    borderRadius: 99,
                    padding: '2px 8px',
                    fontSize: 11,
                    fontWeight: 700,
                  }}>
                    {Math.round(aqi)}
                  </span>
                </div>

                {/* Category badge */}
                <div style={{
                  background: `${color}22`,
                  color,
                  borderRadius: 99,
                  textAlign: 'center',
                  padding: '3px 0',
                  fontSize: 11,
                  fontWeight: 600,
                  marginBottom: 10,
                }}>
                  {category.label}
                </div>

                {/* Pollutants */}
                {(ward.pm25 ?? ward.pm10 ?? ward.no2) != null && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11 }}>
                    {[
                      { label: 'PM2.5', value: ward.pm25 },
                      { label: 'PM10',  value: ward.pm10 },
                      { label: 'NO₂',   value: ward.no2  },
                      { label: 'SO₂',   value: ward.so2  },
                    ].filter(p => p.value != null).map(({ label, value }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', color: '#ccc' }}>
                        <span style={{ color: '#999' }}>{label}</span>
                        <span style={{ color: '#fff', fontWeight: 600 }}>{Number(value).toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Description */}
                <p style={{ color: '#888', fontSize: 10, marginTop: 8 }}>{category.description}</p>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
