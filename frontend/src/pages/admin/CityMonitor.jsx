import { useEffect, useState } from 'react'
import { aqiAPI, hotspotsAPI, governmentAPI } from '../../api'
import { CITIES_WITH_DATA, CITY_CENTRES, CITY_ZOOM } from '../../store/cityStore'
import AQIBadge from '../../components/common/AQIBadge'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import WardRankingChart from '../../components/charts/WardRankingChart'
import {
  CloudIcon, ExclamationTriangleIcon, BoltIcon,
  MapIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { getAQICategory, getAQIColor } from '../../utils/aqiUtils'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'

// ── Re-centre whenever city changes ──────────────────────────────────────────
function Recentre({ centre, zoom }) {
  const map = useMap()
  useEffect(() => {
    if (centre) map.setView([centre.lat, centre.lng], zoom)
  }, [centre, zoom, map])
  return null
}

// ── Single persistent map that swaps AQI / Hotspot layers internally ─────────
function CityMapPanel({ wards, hotspots, centre, zoom, mode }) {
  const CLUSTER_COLORS = ['#ef4444','#f97316','#a855f7','#3b82f6','#10b981','#fbbf24','#ec4899','#14b8a6']

  return (
    <MapContainer
      center={[centre.lat, centre.lng]}
      zoom={zoom}
      style={{ height: '100%', width: '100%' }}
      className="rounded-xl z-0"
      scrollWheelZoom
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recentre centre={centre} zoom={zoom} />

      {/* AQI ward markers */}
      {mode === 'aqi' && wards.map((w, i) => {
        if (!w.lat || !w.lng) return null
        const color  = getAQIColor(w.aqi)
        const radius = Math.max(10, Math.min(24, (w.aqi / 300) * 26 + 8))
        return (
          <CircleMarker key={w.id ?? i} center={[w.lat, w.lng]} radius={radius}
            pathOptions={{ fillColor: color, fillOpacity: 0.82, color, weight: 2, opacity: 0.9 }}>
            <Popup>
              <div style={{ minWidth: 170, fontFamily: 'system-ui, sans-serif' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <strong style={{ color: '#fff', fontSize: 13 }}>{w.name}</strong>
                  <span style={{ background: `${color}33`, color, border: `1px solid ${color}66`, borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                    {Math.round(w.aqi)}
                  </span>
                </div>
                {[['PM2.5', w.pm25], ['PM10', w.pm10], ['NO₂', w.no2], ['SO₂', w.so2]]
                  .filter(([, v]) => v != null)
                  .map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#ccc' }}>
                      <span style={{ color: '#999' }}>{label}</span>
                      <span style={{ color: '#fff', fontWeight: 600 }}>{Number(val).toFixed(1)}</span>
                    </div>
                  ))}
              </div>
            </Popup>
          </CircleMarker>
        )
      })}

      {/* Hotspot cluster markers */}
      {mode === 'hotspot' && hotspots.map((hs, i) => {
        const lat = hs.lat ?? hs.latitude ?? hs.center_latitude
        const lng = hs.lng ?? hs.longitude ?? hs.center_longitude
        if (!lat || !lng) return null
        const color    = CLUSTER_COLORS[(hs.cluster_id ?? i) % CLUSTER_COLORS.length]
        const severity = hs.average_aqi ?? hs.aqi ?? hs.severity ?? 150
        const radius   = Math.max(14, Math.min(42, (severity / 300) * 48))
        const name     = hs.name ?? (hs.ward_names?.[0]) ?? hs.ward_name ?? `Hotspot ${i + 1}`
        return (
          <CircleMarker key={hs.id ?? i} center={[lat, lng]} radius={radius}
            pathOptions={{ fillColor: color, fillOpacity: 0.40, color, weight: 2, opacity: 0.8 }}>
            <Popup>
              <div style={{ minWidth: 160, fontFamily: 'system-ui, sans-serif' }}>
                <strong style={{ color: '#fff', fontSize: 13 }}>{name}</strong>
                <p style={{ color: '#aaa', fontSize: 11, margin: '4px 0' }}>Cluster {(hs.cluster_id ?? i) + 1}</p>
                <span style={{ color, fontWeight: 700, fontSize: 12 }}>AQI {Math.round(severity)}</span>
                {hs.primary_pollutant && (
                  <p style={{ color: '#aaa', fontSize: 11, marginTop: 4 }}>Source: {hs.primary_pollutant}</p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}

function normaliseWard(w, i) {
  return {
    id:   w.id   ?? w.ward_id   ?? i,
    name: w.name ?? w.ward_name ?? `Ward ${i + 1}`,
    lat:  w.lat  ?? w.latitude,
    lng:  w.lng  ?? w.longitude,
    aqi:  w.aqi  ?? w.aqi_value ?? 0,
    pm25: w.pm25, pm10: w.pm10, no2: w.no2, so2: w.so2,
  }
}

export default function CityMonitor() {
  const [city, setCity]           = useState(CITIES_WITH_DATA[0])
  const [wards, setWards]         = useState([])
  const [hotspots, setHotspots]   = useState([])
  const [actions, setActions]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [mapMode, setMapMode]     = useState('aqi') // 'aqi' | 'hotspot'

  const load = async (c) => {
    setLoading(true)
    const [aqiR, hsR, actR] = await Promise.allSettled([
      aqiAPI.getCurrentAQI(c),
      hotspotsAPI.getHotspots(c),
      governmentAPI.getActions(c),
    ])
    if (aqiR.status === 'fulfilled') {
      const list = Array.isArray(aqiR.value.data) ? aqiR.value.data : []
      setWards(list.map(normaliseWard).filter(w => w.lat && w.lng))
    }
    if (hsR.status === 'fulfilled') {
      setHotspots(Array.isArray(hsR.value.data) ? hsR.value.data : [])
    }
    if (actR.status === 'fulfilled') {
      setActions(Array.isArray(actR.value.data) ? actR.value.data : [])
    }
    setLoading(false)
  }

  useEffect(() => { load(city) }, [city])

  const centre  = CITY_CENTRES[city] ?? CITY_CENTRES.Ahmedabad
  const zoom    = CITY_ZOOM[city]    ?? 12
  const avgAQI  = wards.length ? Math.round(wards.reduce((s, w) => s + w.aqi, 0) / wards.length) : 0
  const avgCat  = getAQICategory(avgAQI)
  const worstWard = wards.length ? [...wards].sort((a, b) => b.aqi - a.aqi)[0] : null
  const bestWard  = wards.length ? [...wards].sort((a, b) => a.aqi - b.aqi)[0] : null

  const chartData = [...wards].sort((a, b) => b.aqi - a.aqi).slice(0, 10).map(w => ({ ward: w.name, aqi: w.aqi }))

  const STATUS_CLS = {
    pending:     'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    in_progress: 'bg-blue-500/20   text-blue-400   border-blue-500/30',
    completed:   'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    cancelled:   'bg-gray-600/20   text-gray-400   border-gray-600/30',
  }

  return (
    <div className="space-y-5">
      {/* Header + city picker */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CloudIcon className="w-6 h-6 text-blue-400" />
            City Monitor
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">Real-time AQI, hotspots and interventions</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-800/60 rounded-xl p-1 border border-gray-700/50">
            {CITIES_WITH_DATA.map(c => (
              <button
                key={c}
                onClick={() => setCity(c)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  city === c ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <button onClick={() => load(city)} className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white transition-colors">
            <ArrowPathIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card p-4 text-center" style={{ borderColor: `${avgCat.color}33`, background: `${avgCat.color}0d` }}>
          <p className="text-xs text-gray-400 mb-1">City Avg AQI</p>
          <p className="text-3xl font-bold text-white">{avgAQI}</p>
          <p className="text-xs mt-1 font-semibold" style={{ color: avgCat.color }}>{avgCat.label}</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-xs text-gray-400 mb-1">Wards Monitored</p>
          <p className="text-3xl font-bold text-white">{wards.length}</p>
        </div>
        <div className="glass-card p-4 text-center border-red-500/20 bg-red-500/5">
          <p className="text-xs text-gray-400 mb-1">Hotspots</p>
          <p className="text-3xl font-bold text-red-400">{hotspots.length}</p>
        </div>
        <div className="glass-card p-4 text-center border-blue-500/20 bg-blue-500/5">
          <p className="text-xs text-gray-400 mb-1">Actions</p>
          <p className="text-3xl font-bold text-blue-400">{actions.length}</p>
        </div>
      </div>

      {/* Map + rankings */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 flex flex-col gap-3">
          {/* Map mode toggle */}
          <div className="flex gap-1 w-fit bg-gray-800/60 rounded-lg p-1 border border-gray-700/50">
            {[{ id: 'aqi', label: 'AQI Map', icon: MapIcon }, { id: 'hotspot', label: 'Hotspots', icon: ExclamationTriangleIcon }].map(m => (
              <button key={m.id} onClick={() => setMapMode(m.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  mapMode === m.id ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                }`}>
                <m.icon className="w-4 h-4" />{m.label}
              </button>
            ))}
          </div>

          <div className="glass-card overflow-hidden" style={{ height: '45vh', minHeight: 320 }}>
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <LoadingSpinner text={`Loading ${city}…`} />
              </div>
            ) : (
              <CityMapPanel
                wards={wards}
                hotspots={hotspots}
                centre={centre}
                zoom={zoom}
                mode={mapMode}
              />
            )}
          </div>
        </div>

        {/* Ward rankings sidebar */}
        <div className="glass-card p-4 overflow-y-auto" style={{ maxHeight: '52vh' }}>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Ward Rankings</h3>
          {loading ? <LoadingSpinner size="sm" text="" className="py-8" /> : (
            <div className="space-y-2">
              {[...wards].sort((a, b) => b.aqi - a.aqi).map((w, i) => (
                <div key={w.id} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-gray-700 text-xs flex items-center justify-center text-white font-bold flex-shrink-0">{i + 1}</span>
                  <span className="flex-1 text-xs text-gray-300 truncate">{w.name}</span>
                  <AQIBadge value={w.aqi} showLabel={false} size="sm" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bar chart + best/worst */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {chartData.length > 0 && (
            <WardRankingChart data={chartData} title={`Top 10 Most Polluted Wards — ${city}`} />
          )}
        </div>
        <div className="space-y-3">
          {worstWard && (
            <div className="glass-card p-4 border-red-500/20 bg-red-500/5">
              <p className="text-xs text-gray-400 mb-1">Most Polluted Ward</p>
              <p className="text-sm font-bold text-white">{worstWard.name}</p>
              <AQIBadge value={worstWard.aqi} size="sm" />
            </div>
          )}
          {bestWard && (
            <div className="glass-card p-4 border-emerald-500/20 bg-emerald-500/5">
              <p className="text-xs text-gray-400 mb-1">Cleanest Ward</p>
              <p className="text-sm font-bold text-white">{bestWard.name}</p>
              <AQIBadge value={bestWard.aqi} size="sm" />
            </div>
          )}
        </div>
      </div>

      {/* Recent actions */}
      {actions.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Recent Actions — {city}</h3>
          <div className="space-y-2">
            {actions.slice(0, 5).map(a => (
              <div key={a.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/30">
                <div>
                  <p className="text-sm font-medium text-white">{a.action_type}</p>
                  <p className="text-xs text-gray-400">{a.ward_id}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full border font-medium ${STATUS_CLS[a.status] || STATUS_CLS.pending}`}>
                  {a.status?.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
