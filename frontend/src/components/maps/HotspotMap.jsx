import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'

const CLUSTER_COLORS = [
  '#ef4444', '#f97316', '#a855f7', '#3b82f6',
  '#10b981', '#fbbf24', '#ec4899', '#14b8a6',
]

export default function HotspotMap({
  hotspots   = [],
  industries = [],
  center     = [23.0225, 72.5714],
  height     = '100%',
}) {
  return (
    <MapContainer
      center={center}
      zoom={11}
      style={{ height, width: '100%' }}
      className="rounded-xl z-0"
    >
      <TileLayer
  attribution='&copy; OpenStreetMap contributors'
  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
/>

      {hotspots.map((hs, i) => {
        const lat = hs.lat ?? hs.latitude ?? hs.center_latitude
        const lng = hs.lng ?? hs.longitude ?? hs.center_longitude
        if (!lat || !lng) return null

        const clusterIdx = (hs.cluster_id ?? i) % CLUSTER_COLORS.length
        const color      = CLUSTER_COLORS[clusterIdx]
        const severity   = hs.severity ?? hs.aqi ?? hs.average_aqi ?? 150
        const radius     = Math.max(15, Math.min(45, (severity / 300) * 50))
        const name       = hs.name ?? hs.ward_name ?? `Hotspot ${i + 1}`

        return (
          <CircleMarker
            key={hs.id ?? i}
            center={[lat, lng]}
            radius={radius}
            pathOptions={{
              fillColor:   color,
              fillOpacity: 0.40,
              color,
              weight:      2,
              opacity:     0.8,
            }}
          >
            <Popup>
              <div style={{ minWidth: 160, fontFamily: 'system-ui, sans-serif' }}>
                <strong style={{ color: '#fff', fontSize: 13 }}>{name}</strong>
                <p style={{ color: '#aaa', fontSize: 11, margin: '4px 0' }}>
                  Cluster {(hs.cluster_id ?? i) + 1}
                </p>
                <span style={{ color, fontWeight: 700, fontSize: 12 }}>
                  AQI {Math.round(severity)}
                </span>
                {hs.source && (
                  <p style={{ color: '#aaa', fontSize: 11, marginTop: 4 }}>
                    Source: {hs.source}
                  </p>
                )}
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
            key={`ind-${i}`}
            center={[lat, lng]}
            radius={8}
            pathOptions={{
              fillColor: '#f97316', fillOpacity: 0.7,
              color: '#f97316', weight: 1.5,
            }}
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
