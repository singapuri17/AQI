/**
 * PollutionAnalysisPanel
 * Replaces the simple filter chips with a rich AI-driven source analysis view.
 * Shows aggregate stats, pie chart, bar chart, and per-source breakdowns.
 */
import { useMemo, useState } from 'react'
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BTooltip,
} from 'recharts'
import { InformationCircleIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

// ── Source definitions ──────────────────────────────────────────────────
export const SOURCES = [
  {
    id: 'All',
    label: 'All',
    color: '#a78bfa',
    icon: '🗺️',
    tooltip: 'Show all wards without filtering.',
    matchFn: () => true,
  },
  {
    id: 'Industrial',
    label: 'Industrial',
    color: '#f97316',
    icon: '🏭',
    tooltip: 'Pollution caused by factories and industrial units emitting PM2.5, SO₂ and NO₂.',
    matchFn: d => d?.industrial_density === 'high',
  },
  {
    id: 'Traffic',
    label: 'Traffic',
    color: '#3b82f6',
    icon: '🚗',
    tooltip: 'Vehicle emissions, road dust and congestion contributing to NO₂, CO and PM10.',
    matchFn: d => d?.traffic_density === 'high',
  },
  {
    id: 'Construction',
    label: 'Construction',
    color: '#eab308',
    icon: '🏗️',
    tooltip: 'Dust and particulate matter from active construction and demolition sites.',
    matchFn: d => d?.construction_activity === 'high',
  },
  {
    id: 'Waste Burning',
    label: 'Waste Burning',
    color: '#ef4444',
    icon: '🔥',
    tooltip: 'Open garbage burning releasing PM2.5, CO and toxic organic compounds.',
    matchFn: d => d?.waste_burning === 'high',
  },
  {
    id: 'Green Cover',
    label: 'Green Cover',
    color: '#22c55e',
    icon: '🌿',
    tooltip: 'Low vegetation cover reduces natural air filtration — wards with less than optimal tree coverage.',
    matchFn: d => d?.green_cover === 'low',
  },
  {
    id: 'Critical AQI',
    label: 'Critical AQI',
    color: '#dc2626',
    icon: '⚠️',
    tooltip: 'AQI above 200 — classified as Very Poor or Severe. Immediate intervention required.',
    matchFn: d => d?.aqi > 200,
  },
]

// Source contribution weights (rule-based estimation)
function estimateContributions(d) {
  if (!d) return {}
  const base = {}
  if (d.industrial_density === 'high')    base.Industrial   = 0.55
  else if (d.industrial_density === 'medium') base.Industrial = 0.30
  else base.Industrial = 0.10

  if (d.traffic_density === 'high')       base.Traffic      = 0.25
  else if (d.traffic_density === 'medium') base.Traffic     = 0.15
  else base.Traffic = 0.05

  if (d.construction_activity === 'high') base.Construction = 0.15
  else if (d.construction_activity === 'medium') base.Construction = 0.08
  else base.Construction = 0.02

  if (d.waste_burning === 'high')         base['Waste Burning'] = 0.12
  else if (d.waste_burning === 'medium')  base['Waste Burning'] = 0.05
  else base['Waste Burning'] = 0.01

  base['Green Cover'] = d.green_cover === 'low' ? 0.08 : 0.02

  // Normalise to 100%
  const total = Object.values(base).reduce((a, b) => a + b, 0)
  return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, Math.round((v / total) * 100)]))
}

function primaryPollutants(d) {
  if (!d) return []
  const p = []
  if (d.pm25 > 60)  p.push('PM2.5')
  if (d.pm10 > 100) p.push('PM10')
  if (d.no2 > 40)   p.push('NO₂')
  if (d.so2 > 20)   p.push('SO₂')
  if (!p.length)    p.push('PM2.5')
  return p
}

// ── Tooltip component ──────────────────────────────────────────────────
function SourceTooltip({ tooltip }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative inline-block ml-1">
      <InformationCircleIcon
        className="w-3.5 h-3.5 text-gray-500 hover:text-gray-300 cursor-help inline"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      />
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-gray-800 border border-gray-600 rounded-lg p-2.5 text-xs text-gray-200 shadow-xl leading-relaxed">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-600" />
        </div>
      )}
    </div>
  )
}

// ── Pollution Attribution mini bar (per ward) ──────────────────────────
export function PollutionAttributionBar({ wardData }) {
  const contribs = useMemo(() => estimateContributions(wardData), [wardData])
  const pollutants = useMemo(() => primaryPollutants(wardData), [wardData])

  const sourceColors = Object.fromEntries(SOURCES.map(s => [s.id, s.color]))
  const confidence = wardData ? Math.min(95, 70 + (wardData.aqi > 200 ? 15 : 0) + (wardData.industry_count || 0) * 3) : 80

  return (
    <div className="mt-3 p-3 bg-gray-800/50 border border-gray-700/30 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-300">AI Pollution Attribution</p>
        <span className="text-xs text-purple-300">Confidence: {confidence}%</span>
      </div>

      {/* Stacked bar */}
      <div className="flex rounded-full overflow-hidden h-3 mb-2">
        {Object.entries(contribs)
          .sort(([,a],[,b]) => b - a)
          .map(([src, pct]) => (
            <div
              key={src}
              style={{ width: `${pct}%`, backgroundColor: sourceColors[src] || '#94a3b8' }}
              title={`${src}: ${pct}%`}
            />
          ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(contribs)
          .sort(([,a],[,b]) => b - a)
          .map(([src, pct]) => (
            <span key={src} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sourceColors[src] }} />
              {src}: <span className="text-white font-medium">{pct}%</span>
            </span>
          ))}
      </div>

      <div className="flex items-center gap-2 mt-2">
        <span className="text-xs text-gray-500">Primary pollutants:</span>
        {pollutants.map(p => (
          <span key={p} className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">{p}</span>
        ))}
      </div>
    </div>
  )
}

// ── Main Panel ─────────────────────────────────────────────────────────
const PIE_COLORS = ['#f97316','#3b82f6','#eab308','#ef4444','#22c55e','#a78bfa']

export default function PollutionAnalysisPanel({ activeFilter, onFilterChange, wardData, cityWards }) {
  const loadedWards = useMemo(() =>
    cityWards.map(w => wardData[w.ward_id]).filter(Boolean),
    [cityWards, wardData]
  )

  const source = SOURCES.find(s => s.id === activeFilter) || SOURCES[0]
  const matchedWards = useMemo(() =>
    loadedWards.filter(d => source.matchFn(d)),
    [loadedWards, source]
  )

  // Aggregate stats for selected source
  const avgAQI = matchedWards.length
    ? Math.round(matchedWards.reduce((s, d) => s + d.aqi, 0) / matchedWards.length)
    : 0

  // Pie: source composition across all loaded wards
  const pieData = useMemo(() => {
    const totals = {}
    loadedWards.forEach(d => {
      const c = estimateContributions(d)
      Object.entries(c).forEach(([k, v]) => { totals[k] = (totals[k] || 0) + v })
    })
    if (!Object.keys(totals).length) return []
    const total = Object.values(totals).reduce((a, b) => a + b, 0)
    return Object.entries(totals)
      .map(([name, val]) => ({ name, value: Math.round(val / loadedWards.length) }))
      .sort((a, b) => b.value - a.value)
  }, [loadedWards])

  // Bar: top affected wards by AQI (for selected filter)
  const barData = useMemo(() =>
    matchedWards
      .sort((a, b) => b.aqi - a.aqi)
      .slice(0, 8)
      .map(d => ({ ward: d.ward_name?.split(' ')[0] || d.ward_id, aqi: Math.round(d.aqi) })),
    [matchedWards]
  )

  // Primary pollutants across matched wards
  const allPollutants = useMemo(() => {
    const counts = {}
    matchedWards.forEach(d => {
      primaryPollutants(d).forEach(p => { counts[p] = (counts[p] || 0) + 1 })
    })
    return Object.entries(counts).sort(([,a],[,b]) => b - a).slice(0, 3).map(([p]) => p)
  }, [matchedWards])

  const pctLoaded = cityWards.length ? Math.round((loadedWards.length / cityWards.length) * 100) : 0

  return (
    <div className="glass-card p-5 space-y-4">
      {/* Source filter chips with tooltips */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span>AI Pollution Source Filter</span>
          {pctLoaded < 100 && (
            <span className="text-xs text-gray-500 font-normal">· {pctLoaded}% of wards analysed (expand wards to load all)</span>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {SOURCES.map(src => (
            <button
              key={src.id}
              onClick={() => onFilterChange(src.id)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                activeFilter === src.id
                  ? 'text-white border-transparent shadow-lg'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
              )}
              style={activeFilter === src.id ? { backgroundColor: src.color + '33', borderColor: src.color } : {}}
            >
              <span>{src.icon}</span>
              <span style={activeFilter === src.id ? { color: src.color } : {}}>{src.label}</span>
              {src.id !== 'All' && matchedWards.length > 0 && activeFilter === src.id && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: src.color + '33', color: src.color }}>
                  {matchedWards.length}
                </span>
              )}
              <SourceTooltip tooltip={src.tooltip} />
            </button>
          ))}
        </div>
      </div>

      {/* Analysis panel — shown only when a specific source is selected */}
      {activeFilter !== 'All' && (
        <div className="space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Affected Wards', value: matchedWards.length, sub: `of ${cityWards.length} total` },
              { label: 'Average AQI',    value: avgAQI || '—',       sub: avgAQI > 200 ? 'Very Poor' : avgAQI > 100 ? 'Moderate' : 'Satisfactory' },
              { label: 'Primary Pollutants', value: allPollutants.join(', ') || '—', sub: 'dominant' },
              { label: 'Est. Contribution', value: `${source.id === 'Industrial' ? '55' : source.id === 'Traffic' ? '25' : source.id === 'Construction' ? '15' : source.id === 'Waste Burning' ? '12' : source.id === 'Green Cover' ? '8' : '—'}%`, sub: 'of city AQI' },
            ].map(({ label, value, sub }) => (
              <div key={label} className="p-3 bg-gray-800/50 rounded-xl border border-gray-700/30 text-center">
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                <p className="text-lg font-bold text-white leading-tight">{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {/* Charts row */}
          {loadedWards.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Pie: source breakdown */}
              <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/30">
                <p className="text-xs font-semibold text-gray-300 mb-3">City-wide Pollution Source Breakdown</p>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                        dataKey="value" nameKey="name" paddingAngle={2}>
                        {pieData.map((entry, i) => (
                          <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <RTooltip formatter={(v, n) => [`${v}%`, n]}
                        contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-gray-500 text-center py-8">Expand wards to load analysis</p>
                )}
                <div className="flex flex-wrap gap-2 mt-1">
                  {pieData.map((entry, i) => (
                    <span key={entry.name} className="flex items-center gap-1 text-xs text-gray-400">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {entry.name}: {entry.value}%
                    </span>
                  ))}
                </div>
              </div>

              {/* Bar: top impacted wards */}
              <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/30">
                <p className="text-xs font-semibold text-gray-300 mb-3">Top Impacted Wards — {source.label}</p>
                {barData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                      <XAxis type="number" domain={[0, 'auto']} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                      <YAxis type="category" dataKey="ward" tick={{ fill: '#d1d5db', fontSize: 10 }} width={60} />
                      <BTooltip formatter={v => [`AQI ${v}`, 'Air Quality Index']}
                        contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }} />
                      <Bar dataKey="aqi" radius={[0, 4, 4, 0]}>
                        {barData.map((entry, i) => (
                          <Cell key={i} fill={entry.aqi > 250 ? '#dc2626' : entry.aqi > 150 ? '#f97316' : '#eab308'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-40">
                    <p className="text-xs text-gray-500">No {source.label} wards loaded yet — expand wards to see data</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Top wards list */}
          {matchedWards.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Top Impacted Wards</p>
              <div className="space-y-1.5">
                {matchedWards
                  .sort((a, b) => b.aqi - a.aqi)
                  .slice(0, 5)
                  .map((d, i) => (
                    <div key={d.ward_id} className="flex items-center justify-between px-3 py-2 bg-gray-800/40 rounded-lg border border-gray-700/30">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-white">{i+1}</span>
                        <span className="text-sm text-white font-medium">{d.ward_name}</span>
                        <span className="text-xs text-gray-500">{d.ward_type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={clsx('text-xs font-bold',
                          d.aqi > 250 ? 'text-red-400' : d.aqi > 150 ? 'text-orange-400' : 'text-yellow-400')}>
                          AQI {d.aqi?.toFixed(0)}
                        </span>
                        <span className="text-xs text-gray-500">{d.risk_level}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
