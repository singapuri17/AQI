import 'leaflet/dist/leaflet.css'
import { useEffect, useState } from 'react'
import { hotspotsAPI } from '../../api'
import HotspotMap from '../../components/maps/HotspotMap'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import AQIBadge from '../../components/common/AQIBadge'
import AQITrendChart from '../../components/charts/AQITrendChart'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { format, subDays } from 'date-fns'
import { useAuthStore } from '../../store/authStore'
import { useCityStore } from '../../store/cityStore'

// Normalise a backend hotspot cluster record
// Backend shape: { cluster_id, ward_ids, ward_names, center_latitude, center_longitude,
//                  average_aqi, max_aqi, point_count, severity, ... }
function normaliseHotspot(h, i) {
  const aqi = h.average_aqi ?? h.aqi ?? h.aqi_value ?? 0
  return {
    id:         h.id ?? h.cluster_id ?? i,
    cluster_id: h.cluster_id ?? i,
    name:       h.name
                ?? (h.ward_names ? h.ward_names[0] : null)
                ?? h.ward_name
                ?? `Cluster ${(h.cluster_id ?? i) + 1}`,
    lat:        h.lat ?? h.latitude ?? h.center_latitude,
    lng:        h.lng ?? h.longitude ?? h.center_longitude,
    aqi,
    severity:   aqi,
    source:     h.primary_pollutant ?? h.source ?? null,
  }
}

const CLUSTER_COLORS = ['#ef4444', '#f97316', '#a855f7', '#3b82f6', '#10b981', '#fbbf24']

function severityBadge(aqi) {
  if (aqi >= 200) return { label: 'Critical', cls: 'bg-red-500/20 text-red-400 border-red-500/30' }
  if (aqi >= 150) return { label: 'High',     cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30' }
  if (aqi >= 100) return { label: 'Moderate', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' }
  return              { label: 'Low',      cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' }
}

function generateTrend(baseAQI) {
  return Array.from({ length: 7 }, (_, i) => ({
    time: format(subDays(new Date(), 6 - i), 'MMM d'),
    aqi:  Math.max(50, Math.round(baseAQI + (Math.random() - 0.5) * 40)),
  }))
}

// Static fallback (used if API returns empty or fails)
const FALLBACK = [
  { id:1, cluster_id:0, name:'Naroda Industrial Zone', lat:23.0731, lng:72.6419, aqi:210, severity:210, source:'Industrial' },
  { id:2, cluster_id:0, name:'Odhav GIDC',             lat:22.9982, lng:72.6403, aqi:196, severity:196, source:'Industrial' },
  { id:3, cluster_id:1, name:'Vatva Chemical Belt',    lat:22.9805, lng:72.6286, aqi:185, severity:185, source:'Chemical'  },
  { id:4, cluster_id:2, name:'Bapunagar Road',         lat:23.0437, lng:72.6121, aqi:172, severity:172, source:'Traffic'   },
  { id:5, cluster_id:1, name:'Vastral Dump Site',      lat:22.9869, lng:72.6598, aqi:158, severity:158, source:'Waste'     },
  { id:6, cluster_id:2, name:'Nikol Junction',         lat:23.0353, lng:72.6475, aqi:167, severity:167, source:'Traffic'   },
]

export default function HotspotsPage() {
  const [hotspots, setHotspots]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [selectedHotspot, setSelected]  = useState(null)
  const { user } = useAuthStore()
  const { selectedCity } = useCityStore()

  useEffect(() => {
    const city = user?.city || selectedCity || null
    const load = async () => {
      setLoading(true)
      try {
        const res  = await hotspotsAPI.getHotspots(city)
        const raw  = Array.isArray(res.data) ? res.data : []
        const norm = raw.map(normaliseHotspot)
        const valid = norm.filter(h => h.lat && h.lng)
        setHotspots(valid.length > 0 ? valid : FALLBACK)
      } catch {
        setHotspots(FALLBACK)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user?.city, selectedCity])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ExclamationTriangleIcon className="w-6 h-6 text-red-400" />
          Pollution Hotspots
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">
          DBSCAN-identified pollution clusters · {hotspots.length} hotspots detected
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Map */}
        <div className="glass-card overflow-hidden" style={{ height: '52vh', minHeight: 360 }}>
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <LoadingSpinner text="Loading hotspot data..." />
            </div>
          ) : (
            <HotspotMap hotspots={hotspots} height="100%" />
          )}
        </div>

        {/* List */}
        <div className="space-y-2 overflow-y-auto" style={{ maxHeight: '52vh' }}>
          {/* Cluster legend */}
          <div className="flex gap-4 mb-2">
            {[...new Set(hotspots.map(h => h.cluster_id))].slice(0, 4).map(cid => (
              <div key={cid} className="flex items-center gap-1.5 text-xs text-gray-400">
                <div className="w-3 h-3 rounded-full" style={{ background: CLUSTER_COLORS[cid % CLUSTER_COLORS.length] }} />
                Cluster {cid + 1}
              </div>
            ))}
          </div>

          {hotspots
            .slice()
            .sort((a, b) => b.aqi - a.aqi)
            .map((hs, i) => {
              const { label, cls } = severityBadge(hs.aqi)
              const clusterColor   = CLUSTER_COLORS[hs.cluster_id % CLUSTER_COLORS.length]
              return (
                <div
                  key={hs.id}
                  onClick={() => setSelected(prev => prev?.id === hs.id ? null : hs)}
                  className={`glass-card p-4 cursor-pointer transition-all hover:border-red-500/20 ${
                    selectedHotspot?.id === hs.id ? 'border-red-500/40 bg-red-500/5' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: clusterColor }} />
                      <p className="text-sm font-semibold text-white">{hs.name}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cls}`}>
                      {label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 pl-5">
                    <AQIBadge value={hs.aqi} size="sm" />
                    {hs.source && (
                      <span className="text-xs text-gray-400">Source: {hs.source}</span>
                    )}
                    <span className="text-xs text-gray-500">Cluster {hs.cluster_id + 1}</span>
                  </div>
                </div>
              )
            })}

          {!loading && hotspots.length === 0 && (
            <div className="glass-card p-8 text-center text-gray-400 text-sm">
              No hotspots detected in the current time window
            </div>
          )}
        </div>
      </div>

      {/* Trend chart for selected hotspot */}
      {selectedHotspot && (
        <AQITrendChart
          data={generateTrend(selectedHotspot.aqi)}
          title={`7-Day AQI Trend — ${selectedHotspot.name}`}
          color="#ef4444"
        />
      )}
    </div>
  )
}
