import 'leaflet/dist/leaflet.css'
import { useEffect, useState } from 'react'
import { hotspotsAPI } from '../../api'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { BuildingStorefrontIcon, FunnelIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '../../store/authStore'
import { useCityStore } from '../../store/cityStore'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'

// Colour per industry type
const TYPE_COLORS = {
  Chemical:   '#ef4444',
  Textile:    '#f97316',
  Pharma:     '#a855f7',
  Metal:      '#fbbf24',
  Paper:      '#3b82f6',
  Rubber:     '#10b981',
  Ceramic:    '#06b6d4',
  Power:      '#e879f9',
  Food:       '#84cc16',
  Other:      '#94a3b8',
}

function typeColor(type) {
  return TYPE_COLORS[type] || '#94a3b8'
}

// Normalise a backend record to what the UI needs
function normalise(ind) {
  return {
    id:           ind.id,
    name:         ind.name,
    type:         ind.industry_type ?? ind.type ?? 'Other',
    lat:          ind.lat ?? ind.latitude,
    lng:          ind.lng ?? ind.longitude,
    ward:         ind.ward_id ?? ind.ward ?? '—',
    contribution: ind.pollution_contribution ?? ind.contribution ?? 0,
    emission:     ind.emission_category ?? 'unknown',
  }
}

const EMISSION_BADGE = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high:     'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low:      'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  unknown:  'bg-gray-600/20 text-gray-400 border-gray-600/30',
}

export default function IndustriesPage() {
  const [industries, setIndustries]   = useState([])
  const [loading, setLoading]         = useState(true)
  const { user } = useAuthStore()
  const { selectedCity } = useCityStore()
  const [selectedType, setSelectedType] = useState('All')
  const [error, setError]             = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res  = await hotspotsAPI.getIndustries(user?.city || selectedCity || null)
        const raw  = Array.isArray(res.data) ? res.data : []
        setIndustries(raw.map(normalise))
      } catch (e) {
        console.error('Industries load error:', e)
        setError('Failed to load industries data')
        setIndustries([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user?.city, selectedCity])

  // Unique types from data
  const allTypes = ['All', ...Array.from(new Set(industries.map(i => i.type))).sort()]

  const filtered = selectedType === 'All'
    ? industries
    : industries.filter(i => i.type === selectedType)

  // Aggregate contribution by type for bar chart
  const byType = Object.entries(
    industries.reduce((acc, ind) => {
      acc[ind.type] = (acc[ind.type] || 0) + (ind.contribution || 0)
      return acc
    }, {})
  )
    .map(([name, value]) => ({ name, value: +value.toFixed(1) }))
    .sort((a, b) => b.value - a.value)

  // Map center — average of all valid coords, fallback to Ahmedabad
  const validCoords = industries.filter(i => i.lat && i.lng)
  const mapCenter = validCoords.length
    ? [
        validCoords.reduce((s, i) => s + i.lat, 0) / validCoords.length,
        validCoords.reduce((s, i) => s + i.lng, 0) / validCoords.length,
      ]
    : [23.0225, 72.5714]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BuildingStorefrontIcon className="w-6 h-6 text-yellow-400" />
          Industries
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">
          Industrial pollution sources and contribution analysis
          {!loading && ` · ${industries.length} facilities`}
        </p>
      </div>

      {/* Type filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <FunnelIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
        {allTypes.map(type => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              selectedType === type
                ? 'text-white'
                : 'border-gray-700 text-gray-400 hover:bg-gray-700 bg-gray-800/50'
            }`}
            style={selectedType === type ? {
              background:   `${typeColor(type)}33`,
              borderColor:  `${typeColor(type)}66`,
              color:        type === 'All' ? '#fff' : typeColor(type),
            } : {}}
          >
            {type}
          </button>
        ))}
      </div>

      {error && (
        <div className="glass-card p-4 text-red-400 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="glass-card h-96 flex items-center justify-center">
          <LoadingSpinner text="Loading industry data..." />
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Map */}
          <div className="glass-card overflow-hidden" style={{ height: '50vh', minHeight: 360 }}>
            <MapContainer
              center={mapCenter}
              zoom={11}
              style={{ height: '100%', width: '100%' }}
              className="rounded-xl z-0"
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; CARTO'
              />
              {filtered.map(ind => {
                if (!ind.lat || !ind.lng) return null
                const color  = typeColor(ind.type)
                const radius = Math.max(7, Math.min(20, (ind.contribution / 50) * 14 + 6))
                return (
                  <CircleMarker
                    key={ind.id}
                    center={[ind.lat, ind.lng]}
                    radius={radius}
                    pathOptions={{
                      fillColor:   color,
                      fillOpacity: 0.80,
                      color,
                      weight:      2,
                    }}
                  >
                    <Popup>
                      <div style={{ minWidth: 180, fontFamily: 'system-ui, sans-serif' }}>
                        <strong style={{ color: '#fff', fontSize: 13 }}>{ind.name}</strong>
                        <p style={{ color, fontSize: 11, margin: '4px 0', fontWeight: 600 }}>
                          {ind.type}
                        </p>
                        <p style={{ color: '#aaa', fontSize: 11 }}>Ward: {ind.ward}</p>
                        <p style={{ color: '#fb923c', fontSize: 12, fontWeight: 700, marginTop: 4 }}>
                          Contribution: {ind.contribution}%
                        </p>
                        <p style={{ color: '#aaa', fontSize: 10, marginTop: 2, textTransform: 'capitalize' }}>
                          Emission: {ind.emission}
                        </p>
                      </div>
                    </Popup>
                  </CircleMarker>
                )
              })}
            </MapContainer>
          </div>

          {/* Right column: chart + list */}
          <div className="flex flex-col gap-4">
            {/* Bar chart */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">
                Pollution Contribution by Type (%)
              </h3>
              {byType.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={byType} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#9ca3af', fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: '#374151' }}
                    />
                    <YAxis
                      tick={{ fill: '#9ca3af', fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={v => [`${v}%`, 'Contribution']}
                      contentStyle={{
                        background: '#1f2937',
                        border: '1px solid #374151',
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={32}>
                      {byType.map(entry => (
                        <Cell key={entry.name} fill={typeColor(entry.name)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Industry list */}
            <div className="glass-card p-4 overflow-y-auto flex-1" style={{ maxHeight: '28vh' }}>
              <h3 className="text-sm font-semibold text-gray-300 mb-3">
                Industries ({filtered.length})
              </h3>
              {filtered.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No industries found</p>
              ) : (
                <div className="space-y-2">
                  {[...filtered]
                    .sort((a, b) => b.contribution - a.contribution)
                    .map(ind => (
                      <div
                        key={ind.id}
                        className="flex items-center gap-3 p-2.5 bg-gray-800/50 rounded-lg border border-gray-700/30"
                      >
                        {/* Type dot */}
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: typeColor(ind.type) }}
                        />
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">{ind.name}</p>
                          <p className="text-xs text-gray-400">{ind.type} · {ind.ward}</p>
                        </div>
                        {/* Emission badge */}
                        <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${
                          EMISSION_BADGE[ind.emission] || EMISSION_BADGE.unknown
                        }`}>
                          {ind.emission}
                        </span>
                        {/* Contribution */}
                        <span
                          className="text-xs font-bold flex-shrink-0"
                          style={{ color: typeColor(ind.type) }}
                        >
                          {ind.contribution}%
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
