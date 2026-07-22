import { useEffect, useState } from 'react'
import { aqiAPI } from '../../api'
import { CITIES_WITH_DATA } from '../../store/cityStore'
import AQIBadge from '../../components/common/AQIBadge'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { getAQICategory, getAQIColor } from '../../utils/aqiUtils'
import { TableCellsIcon, FunnelIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

const SORT_OPTIONS = [
  { key: 'aqi',  label: 'Highest AQI' },
  { key: 'pm25', label: 'Highest PM2.5' },
  { key: 'risk', label: 'Risk Level' },
]

function riskLevel(aqi) {
  if (aqi >= 300) return { label: 'Hazardous', cls: 'bg-rose-900/40 text-rose-300 border-rose-800/50' }
  if (aqi >= 200) return { label: 'Severe',    cls: 'bg-red-500/20 text-red-400 border-red-500/30' }
  if (aqi >= 150) return { label: 'High',      cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30' }
  if (aqi >= 100) return { label: 'Moderate',  cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' }
  return              { label: 'Low',       cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' }
}

export default function WardComparison() {
  const [city, setCity]     = useState(CITIES_WITH_DATA[0])
  const [wards, setWards]   = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('aqi')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res  = await aqiAPI.getCurrentAQI(city)
        const list = Array.isArray(res.data) ? res.data : []
        if (!cancelled) setWards(list)
      } catch {
        if (!cancelled) setWards([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [city])

  const sorted = [...wards]
    .filter(w => (w.ward_name ?? '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'aqi')  return (b.aqi_value ?? 0) - (a.aqi_value ?? 0)
      if (sortBy === 'pm25') return (b.pm25 ?? 0) - (a.pm25 ?? 0)
      if (sortBy === 'risk') return (b.aqi_value ?? 0) - (a.aqi_value ?? 0)
      return 0
    })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <TableCellsIcon className="w-6 h-6 text-indigo-400" />
          Ward Comparison
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">Compare wards within a city by AQI, pollutants and risk level</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* City tabs */}
        <div className="flex gap-1 bg-gray-800/60 rounded-xl p-1 border border-gray-700/50">
          {CITIES_WITH_DATA.map(c => (
            <button key={c} onClick={() => setCity(c)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                city === c ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              }`}>{c}</button>
          ))}
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search ward…"
          className="input-field !py-1.5 !w-40"
        />

        {/* Sort */}
        <div className="flex items-center gap-1.5">
          <FunnelIcon className="w-4 h-4 text-gray-400" />
          {SORT_OPTIONS.map(o => (
            <button key={o.key} onClick={() => setSortBy(o.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                sortBy === o.key
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
              }`}>{o.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="glass-card h-64 flex items-center justify-center">
          <LoadingSpinner text={`Loading ${city} wards…`} />
        </div>
      ) : sorted.length === 0 ? (
        <div className="glass-card p-8 text-center text-gray-400">No ward data found.</div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700/50">
                  {['#', 'Ward', 'AQI', 'PM2.5', 'PM10', 'NO₂', 'SO₂', 'CO', 'O₃', 'Risk Level'].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {sorted.map((w, i) => {
                  const aqi  = w.aqi_value ?? 0
                  const risk = riskLevel(aqi)
                  const color = getAQIColor(aqi)
                  return (
                    <tr key={w.ward_id ?? i} className="hover:bg-gray-800/20 transition-colors"
                      style={{ borderLeft: `3px solid ${color}` }}>
                      <td className="px-3 py-3 text-xs text-gray-500">{i + 1}</td>
                      <td className="px-3 py-3 text-sm font-medium text-white whitespace-nowrap">{w.ward_name}</td>
                      <td className="px-3 py-3"><AQIBadge value={aqi} size="sm" /></td>
                      {['pm25', 'pm10', 'no2', 'so2', 'co', 'o3'].map(p => (
                        <td key={p} className="px-3 py-3 text-sm text-gray-300">
                          {w[p] != null ? w[p].toFixed(1) : '—'}
                        </td>
                      ))}
                      <td className="px-3 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${risk.cls}`}>
                          {risk.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary strip */}
      {!loading && sorted.length > 0 && (() => {
        const best  = sorted[sorted.length - 1]
        const worst = sorted[0]
        const avg   = Math.round(sorted.reduce((s, w) => s + (w.aqi_value ?? 0), 0) / sorted.length)
        return (
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="glass-card p-4 border-red-500/20 bg-red-500/5 text-center">
              <p className="text-xs text-gray-400">Most Polluted</p>
              <p className="text-sm font-bold text-white mt-1">{worst.ward_name}</p>
              <AQIBadge value={worst.aqi_value ?? 0} size="sm" />
            </div>
            <div className="glass-card p-4 text-center">
              <p className="text-xs text-gray-400">City Average</p>
              <p className="text-3xl font-bold text-white mt-1">{avg}</p>
              <AQIBadge value={avg} size="sm" />
            </div>
            <div className="glass-card p-4 border-emerald-500/20 bg-emerald-500/5 text-center">
              <p className="text-xs text-gray-400">Cleanest Ward</p>
              <p className="text-sm font-bold text-white mt-1">{best.ward_name}</p>
              <AQIBadge value={best.aqi_value ?? 0} size="sm" />
            </div>
          </div>
        )
      })()}
    </div>
  )
}
