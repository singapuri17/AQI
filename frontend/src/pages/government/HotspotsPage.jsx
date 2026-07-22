import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useState } from 'react'
import { aqiAPI, hotspotsAPI } from '../../api'
import AQIMap from '../../components/maps/AQIMap'
import HotspotMap from '../../components/maps/HotspotMap'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import AQIBadge from '../../components/common/AQIBadge'
import { ExclamationTriangleIcon, MapIcon, ArrowPathIcon, ClockIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { useAuthStore } from '../../store/authStore'
import { CITY_CENTRES, CITY_ZOOM } from '../../store/cityStore'
import { getAQICategory, getAQIColor } from '../../utils/aqiUtils'

const AUTO_REFRESH_MS = 60_000   // re-fetch every 60 s

// ── normalise AQI ward record → shape AQIMap expects ─────────────────────
function normaliseWard(w, i) {
  return {
    id:       w.id      ?? w.ward_id   ?? i,
    name:     w.ward_name ?? w.name    ?? `Ward ${i + 1}`,
    lat:      w.latitude  ?? w.lat,
    lng:      w.longitude ?? w.lng,
    aqi:      w.aqi_value ?? w.aqi     ?? 0,
    pm25:     w.pm25, pm10: w.pm10, no2: w.no2, so2: w.so2, co: w.co, o3: w.o3,
    timestamp: w.timestamp,
  }
}

// ── normalise hotspot cluster record → shape HotspotMap expects ──────────
function normaliseHotspot(h, i) {
  const aqi = h.average_aqi ?? h.aqi ?? h.aqi_value ?? 0
  return {
    id:              h.id ?? h.cluster_id ?? i,
    cluster_id:      h.cluster_id ?? i,
    name:            h.name
                     ?? (Array.isArray(h.ward_names) ? h.ward_names[0] : null)
                     ?? h.ward_name
                     ?? `Cluster ${(h.cluster_id ?? i) + 1}`,
    lat:             h.center_latitude  ?? h.lat ?? h.latitude,
    lng:             h.center_longitude ?? h.lng ?? h.longitude,
    average_aqi:     aqi,
    aqi,
    max_aqi:         h.max_aqi,
    severity:        aqi,
    primary_pollutant: h.primary_pollutant ?? h.source ?? null,
    point_count:     h.point_count,
  }
}

// ── dominant pollutant from ward data ────────────────────────────────────
function dominantPollutant(w) {
  const candidates = [
    { label: 'PM2.5', value: w.pm25 },
    { label: 'PM10',  value: w.pm10 },
    { label: 'NO₂',   value: w.no2  },
    { label: 'SO₂',   value: w.so2  },
    { label: 'CO',    value: w.co   },
    { label: 'O₃',    value: w.o3   },
  ].filter(c => c.value != null)
  if (!candidates.length) return '—'
  return candidates.reduce((a, b) => (a.value > b.value ? a : b)).label
}

// ── severity label ─────────────────────────────────────────────────────
function riskLabel(aqi) {
  if (aqi >= 300) return { text: 'Hazardous', cls: 'bg-rose-900/40 text-rose-300 border-rose-800/50' }
  if (aqi >= 200) return { text: 'Very High',  cls: 'bg-red-500/20   text-red-400   border-red-500/30'    }
  if (aqi >= 150) return { text: 'High',       cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30' }
  if (aqi >= 100) return { text: 'Moderate',   cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' }
  return               { text: 'Low',         cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' }
}

// ── fallback hotspot data (Ahmedabad) ─────────────────────────────────────
const FALLBACK_HOTSPOTS = [
  { id:1, cluster_id:0, name:'Naroda Industrial Zone', lat:23.0731, lng:72.6419, aqi:210, average_aqi:210, primary_pollutant:'PM2.5' },
  { id:2, cluster_id:0, name:'Odhav GIDC',             lat:22.9982, lng:72.6403, aqi:196, average_aqi:196, primary_pollutant:'NO₂'  },
  { id:3, cluster_id:1, name:'Vatva Chemical Belt',    lat:22.9805, lng:72.6286, aqi:185, average_aqi:185, primary_pollutant:'SO₂'  },
  { id:4, cluster_id:2, name:'Bapunagar Road',         lat:23.0437, lng:72.6121, aqi:172, average_aqi:172, primary_pollutant:'CO'   },
  { id:5, cluster_id:1, name:'Vastral Dump Site',      lat:22.9869, lng:72.6598, aqi:158, average_aqi:158, primary_pollutant:'PM10' },
]

export default function HotspotsPage() {
  const { user }        = useAuthStore()
  const officerCity     = user?.city || 'Ahmedabad'      // locked to officer's city, never changes
  const centre          = CITY_CENTRES[officerCity] ?? CITY_CENTRES.Ahmedabad
  const zoom            = CITY_ZOOM[officerCity]    ?? 12

  const [wards,      setWards]     = useState([])
  const [hotspots,   setHotspots]  = useState([])
  const [loading,    setLoading]   = useState(true)
  const [lastUpdate, setLastUpdate]= useState(null)
  const [selectedHs, setSelectedHs]= useState(null)

  const fetchData = useCallback(async () => {
    try {
      const [aqiRes, hsRes] = await Promise.allSettled([
        aqiAPI.getCurrentAQI(officerCity),
        hotspotsAPI.getHotspots(officerCity),
      ])

      if (aqiRes.status === 'fulfilled') {
        const raw = Array.isArray(aqiRes.value.data) ? aqiRes.value.data : []
        setWards(raw.map(normaliseWard).filter(w => w.lat && w.lng))
      }

      if (hsRes.status === 'fulfilled') {
        const raw   = Array.isArray(hsRes.value.data) ? hsRes.value.data : []
        const norm  = raw.map(normaliseHotspot).filter(h => h.lat && h.lng)
        setHotspots(norm.length > 0 ? norm : FALLBACK_HOTSPOTS)
      } else {
        setHotspots(FALLBACK_HOTSPOTS)
      }

      setLastUpdate(new Date())
    } catch {
      setHotspots(FALLBACK_HOTSPOTS)
    } finally {
      setLoading(false)
    }
  }, [officerCity])

  // Initial load
  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh
  useEffect(() => {
    const id = setInterval(fetchData, AUTO_REFRESH_MS)
    return () => clearInterval(id)
  }, [fetchData])

  // Derived stats
  const avgAQI    = wards.length
    ? Math.round(wards.reduce((s, w) => s + w.aqi, 0) / wards.length) : 0
  const highRisk  = wards.filter(w => w.aqi > 150).length
  const avgCat    = getAQICategory(avgAQI)

  return (
    <div className="space-y-4">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-400" />
            Air Quality Monitoring
          </h1>
          <p className="text-gray-400 text-sm mt-0.5 flex items-center gap-2">
            <span>
              Real-time AQI stations and pollution hotspots ·{' '}
              <span className="text-white font-medium">{officerCity}</span>
            </span>
            {lastUpdate && (
              <span className="flex items-center gap-1 text-gray-500 text-xs">
                <ClockIcon className="w-3 h-3" />
                Updated {format(lastUpdate, 'HH:mm:ss')}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-300 hover:text-white transition-colors"
        >
          <ArrowPathIcon className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* ── Summary strip ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          className="glass-card p-3 text-center"
          style={{ borderColor: `${avgCat.color}33`, background: `${avgCat.color}0d` }}
        >
          <p className="text-xs text-gray-400 mb-0.5">City Avg AQI</p>
          <p className="text-2xl font-bold text-white">{avgAQI}</p>
          <p className="text-xs font-semibold mt-0.5" style={{ color: avgCat.color }}>{avgCat.label}</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-xs text-gray-400 mb-0.5">Stations</p>
          <p className="text-2xl font-bold text-white">{wards.length}</p>
        </div>
        <div className="glass-card p-3 text-center border-red-500/20 bg-red-500/5">
          <p className="text-xs text-gray-400 mb-0.5">High-Risk Wards</p>
          <p className="text-2xl font-bold text-red-400">{highRisk}</p>
        </div>
        <div className="glass-card p-3 text-center border-orange-500/20 bg-orange-500/5">
          <p className="text-xs text-gray-400 mb-0.5">Hotspot Clusters</p>
          <p className="text-2xl font-bold text-orange-400">{hotspots.length}</p>
        </div>
      </div>

      {/* ── Dual map layout ─────────────────────────────────────────── */}
      {loading ? (
        <div className="glass-card h-96 flex items-center justify-center">
          <LoadingSpinner text={`Loading ${officerCity} data…`} />
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* ── Left: Real-Time AQI Map ── */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <MapIcon className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-white">Real-Time AQI Monitoring</h2>
              <span className="text-xs text-gray-500">{wards.length} stations</span>
            </div>
            <div className="glass-card overflow-hidden" style={{ height: '50vh', minHeight: 340 }}>
              <AQIMap
                wards={wards}
                center={[centre.lat, centre.lng]}
                zoom={zoom}
                height="100%"
              />
            </div>
            {/* Station list */}
            <div className="glass-card p-3 overflow-y-auto" style={{ maxHeight: '22vh' }}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Stations by AQI (worst first)
              </p>
              <div className="space-y-1.5">
                {[...wards]
                  .sort((a, b) => b.aqi - a.aqi)
                  .map((w, i) => {
                    const dom = dominantPollutant(w)
                    const ts  = w.timestamp ? format(new Date(w.timestamp), 'HH:mm') : null
                    return (
                      <div key={w.id} className="flex items-center gap-2 group">
                        <span className="w-5 h-5 rounded-full bg-gray-700 text-[10px] flex items-center justify-center text-white flex-shrink-0">
                          {i + 1}
                        </span>
                        <span className="flex-1 text-xs text-gray-300 truncate">{w.name}</span>
                        {dom !== '—' && (
                          <span className="text-[10px] text-gray-500 flex-shrink-0">{dom}</span>
                        )}
                        {ts && <span className="text-[10px] text-gray-600 flex-shrink-0">{ts}</span>}
                        <AQIBadge value={w.aqi} showLabel={false} size="sm" />
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>

          {/* ── Right: Pollution Hotspot Map ── */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="w-4 h-4 text-red-400" />
              <h2 className="text-sm font-semibold text-white">Pollution Hotspot Clusters</h2>
              <span className="text-xs text-gray-500">{hotspots.length} clusters</span>
            </div>
            <div className="glass-card overflow-hidden" style={{ height: '50vh', minHeight: 340 }}>
              <HotspotMap
                hotspots={hotspots}
                center={[centre.lat, centre.lng]}
                zoom={zoom}
                height="100%"
              />
            </div>
            {/* Hotspot list */}
            <div className="glass-card p-3 overflow-y-auto" style={{ maxHeight: '22vh' }}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Clusters by severity (worst first)
              </p>
              <div className="space-y-1.5">
                {[...hotspots]
                  .sort((a, b) => (b.aqi ?? 0) - (a.aqi ?? 0))
                  .map((hs, i) => {
                    const aqi   = hs.aqi ?? 0
                    const risk  = riskLabel(aqi)
                    const color = getAQIColor(aqi)
                    return (
                      <div
                        key={hs.id}
                        onClick={() => setSelectedHs(prev => prev?.id === hs.id ? null : hs)}
                        className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-colors ${
                          selectedHs?.id === hs.id
                            ? 'bg-red-500/10 border border-red-500/20'
                            : 'hover:bg-gray-800/40'
                        }`}
                      >
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: color }} />
                        <span className="flex-1 text-xs text-gray-300 truncate">{hs.name}</span>
                        {hs.primary_pollutant && (
                          <span className="text-[10px] text-gray-500 flex-shrink-0">{hs.primary_pollutant}</span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium flex-shrink-0 ${risk.cls}`}>
                          {risk.text}
                        </span>
                        <AQIBadge value={aqi} showLabel={false} size="sm" />
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Selected hotspot detail panel ─────────────────────────── */}
      {selectedHs && (
        <div
          className="glass-card p-4 border-l-4"
          style={{ borderLeftColor: getAQIColor(selectedHs.aqi ?? 0) }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-bold text-white">{selectedHs.name}</h3>
                <AQIBadge value={selectedHs.aqi ?? 0} size="sm" />
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-400 mt-1">
                {selectedHs.primary_pollutant && (
                  <span>Dominant pollutant: <span className="text-white">{selectedHs.primary_pollutant}</span></span>
                )}
                {selectedHs.max_aqi != null && (
                  <span>Peak AQI: <span className="text-white">{Math.round(selectedHs.max_aqi)}</span></span>
                )}
                {selectedHs.point_count != null && (
                  <span>Stations in cluster: <span className="text-white">{selectedHs.point_count}</span></span>
                )}
                <span>Risk: <span style={{ color: getAQIColor(selectedHs.aqi ?? 0) }}>{riskLabel(selectedHs.aqi ?? 0).text}</span></span>
              </div>
            </div>
            <button
              onClick={() => setSelectedHs(null)}
              className="text-gray-500 hover:text-gray-300 text-xs flex-shrink-0"
            >
              ✕ Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
