import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import { getAQIColor, getAQICategory } from '../../utils/aqiUtils'

function Recenter({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.setView(center, map.getZoom())
  }, [center, map])
  return null
}

function riskCategory(aqi) {
  if (aqi >= 300) return 'Hazardous'
  if (aqi >= 200) return 'Very High'
  if (aqi >= 150) return 'High'
  if (aqi >= 100) return 'Moderate'
  return 'Low'
}

export default function HotspotMap({
  hotspots   = [],
  industries = [],
  center     = [23.0225, 72.5714],
  zoom       = 11,
  height     = '100%',
}) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height, width: '100%' }}
      className="rounded-xl z-0"
      scrollWheelZoom
    >
      <Recenter center={center} />
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {hotspots.map((hs, i) => {
        const lat = hs.lat ?? hs.latitude ?? hs.center_latitude
        const lng = hs.lng ?? hs.longitude ?? hs.center_longitude
        if (!lat || !lng) return null

        const aqi      = hs.average_aqi ?? hs.aqi ?? hs.severity ?? 150
        const color    = getAQIColor(aqi)
        const category = getAQICategory(aqi)
        const radius   = Math.max(16, Math.min(46, (aqi / 300) * 52))
        const name     = hs.name
                      ?? (Array.isArray(hs.ward_names) ? hs.ward_names[0] : null)
                      ?? hs.ward_name
                      ?? `Hotspot ${i + 1}`
        const dominant = hs.primary_pollutant ?? hs.source ?? null
        const risk     = riskCategory(aqi)

        return (
          <CircleMarker
            key={hs.id ?? hs.cluster_id ?? i}
            center={[lat, lng]}
            radius={radius}
            pathOptions={{
              fillColor:   color,
              fillOpacity: 0.45,
              color,
              weight:      2.5,
              opacity:     0.9,
            }}
          >
            <Popup>
              <div style={{ minWidth: 190, fontFamily: 'system-ui, sans-serif' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <strong style={{ color: '#fff', fontSize: 13, maxWidth: 120 }}>{name}</strong>
                  <span style={{
                    background: `${color}33`, color,
                    border: `1px solid ${color}66`,
                    borderRadius: 99, padding: '2px 8px',
                    fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                  }}>
                    AQI {Math.round(aqi)}
                  </span>
                </div>

                {/* AQI Category pill */}
                <div style={{
                  background: `${color}22`, color,
                  borderRadius: 99, textAlign: 'center',
                  padding: '3px 0', fontSize: 11, fontWeight: 600,
                  marginBottom: 8,
                }}>
                  {category.label}
                </div>

                {/* Detail rows */}
                <div style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {dominant && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#999' }}>Dominant pollutant</span>
                      <span style={{ color: '#fff', fontWeight: 600 }}>{dominant}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#999' }}>Risk category</span>
                    <span style={{ color, fontWeight: 600 }}>{risk}</span>
                  </div>
                  {hs.point_count != null && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#999' }}>Stations in cluster</span>
                      <span style={{ color: '#fff', fontWeight: 600 }}>{hs.point_count}</span>
                    </div>
                  )}
                  {hs.max_aqi != null && hs.max_aqi !== aqi && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#999' }}>Peak AQI</span>
                      <span style={{ color: '#fff', fontWeight: 600 }}>{Math.round(hs.max_aqi)}</span>
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}

      {industries.map((ind, i) => {
        const lat = ind.lat ?? ind.latitude
        const lng = ind.lng ?? ind.longitude
        if (!lat || !lng) return null
        return (
          <CircleMarker
            key={`ind-${ind.id ?? i}`}
            center={[lat, lng]}
            radius={8}
            pathOptions={{ fillColor: '#f97316', fillOpacity: 0.75, color: '#f97316', weight: 1.5 }}
          >
            <Popup>
              <div style={{ minWidth: 160, fontFamily: 'system-ui, sans-serif' }}>
                <strong style={{ color: '#fff', fontSize: 13 }}>{ind.name}</strong>
                <p style={{ color: '#fb923c', fontSize: 11, marginTop: 4 }}>
                  {ind.industry_type ?? ind.type ?? 'Industrial'}
                </p>
                {ind.pollution_contribution != null && (
                  <p style={{ color: '#aaa', fontSize: 11, marginTop: 4 }}>
                    Contribution: {ind.pollution_contribution}%
                  </p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
