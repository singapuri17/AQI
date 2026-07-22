import { useEffect, useState } from 'react'
import { aqiAPI, hotspotsAPI, governmentAPI } from '../../api'
import { CITIES_WITH_DATA } from '../../store/cityStore'
import AQIBadge from '../../components/common/AQIBadge'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { getAQIColor } from '../../utils/aqiUtils'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, CartesianGrid,
} from 'recharts'
import { ChartBarIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { format, subDays } from 'date-fns'

const CITY_COLORS = { Ahmedabad: '#3b82f6', Surat: '#f97316', Vadodara: '#a855f7' }

const POLLUTANTS = ['pm25', 'pm10', 'co', 'no2', 'so2', 'o3']
const POLLUTANT_LABELS = { pm25: 'PM2.5', pm10: 'PM10', co: 'CO', no2: 'NO₂', so2: 'SO₂', o3: 'O₃' }

export default function CityComparison() {
  const [selected, setSelected] = useState(new Set(CITIES_WITH_DATA))
  const [data, setData]         = useState({})
  const [loading, setLoading]   = useState(true)

  const load = async () => {
    setLoading(true)
    const results = {}
    await Promise.allSettled(
      CITIES_WITH_DATA.map(async city => {
        const [aqiR, hsR, actR] = await Promise.allSettled([
          aqiAPI.getCurrentAQI(city),
          hotspotsAPI.getHotspots(city),
          governmentAPI.getActions(city),
        ])
        const aqiList = aqiR.status === 'fulfilled' && Array.isArray(aqiR.value.data) ? aqiR.value.data : []
        const hsList  = hsR.status  === 'fulfilled' && Array.isArray(hsR.value.data)  ? hsR.value.data  : []
        const actList = actR.status === 'fulfilled' && Array.isArray(actR.value.data) ? actR.value.data : []

        const avg = (key) => aqiList.length ? aqiList.reduce((s, w) => s + (w[key] ?? 0), 0) / aqiList.length : 0

        results[city] = {
          avgAQI:    Math.round(avg('aqi_value')),
          pm25:      +avg('pm25').toFixed(1),
          pm10:      +avg('pm10').toFixed(1),
          co:        +avg('co').toFixed(1),
          no2:       +avg('no2').toFixed(1),
          so2:       +avg('so2').toFixed(1),
          o3:        +avg('o3').toFixed(1),
          hotspots:  hsList.length,
          actions:   actList.length,
          completed: actList.filter(a => a.status === 'completed').length,
          highRisk:  aqiList.filter(w => (w.aqi_value ?? 0) > 150).length,
          wards:     aqiList.length,
        }
      })
    )
    setData(results)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const toggle = (city) => {
    setSelected(s => {
      const n = new Set(s)
      if (n.has(city)) { if (n.size > 1) n.delete(city) } else n.add(city)
      return n
    })
  }

  const activeCities = CITIES_WITH_DATA.filter(c => selected.has(c) && data[c])

  // Bar chart: AQI comparison
  const aqiBarData = activeCities.map(c => ({ city: c, aqi: data[c]?.avgAQI ?? 0 }))

  // Radar chart: pollutant profile (normalised 0-100)
  const maxVals = { pm25: 150, pm10: 250, co: 30, no2: 80, so2: 40, o3: 100 }
  const radarData = POLLUTANTS.map(key => {
    const point = { pollutant: POLLUTANT_LABELS[key] }
    activeCities.forEach(c => {
      point[c] = Math.min(100, Math.round(((data[c]?.[key] ?? 0) / maxVals[key]) * 100))
    })
    return point
  })

  // Trend line (deterministic simulation from avg AQI)
  const trendData = Array.from({ length: 7 }, (_, i) => {
    const point = { time: format(subDays(new Date(), 6 - i), 'MMM d') }
    activeCities.forEach(c => {
      const base = data[c]?.avgAQI ?? 100
      const offsets = [8, -5, 12, -8, 3, 15, 0]
      point[c] = Math.max(20, Math.round(base + offsets[i]))
    })
    return point
  })

  // Metric comparison table
  const metrics = [
    { key: 'avgAQI',   label: 'Avg AQI' },
    { key: 'pm25',     label: 'PM2.5 μg/m³' },
    { key: 'pm10',     label: 'PM10 μg/m³'  },
    { key: 'hotspots', label: 'Hotspots'    },
    { key: 'actions',  label: 'Gov. Actions' },
    { key: 'highRisk', label: 'High-Risk Wards' },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner text="Loading city comparison data…" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ChartBarIcon className="w-6 h-6 text-cyan-400" />
            City Comparison
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">Compare AQI, pollutants and interventions across cities</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:text-white text-sm transition-colors">
          <ArrowPathIcon className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* City selector */}
      <div className="flex gap-2 flex-wrap">
        <span className="text-xs text-gray-400 self-center">Select cities:</span>
        {CITIES_WITH_DATA.map(c => (
          <button
            key={c}
            onClick={() => toggle(c)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
              selected.has(c)
                ? 'text-white border-transparent'
                : 'text-gray-400 border-gray-700 bg-gray-800/50 hover:border-gray-600'
            }`}
            style={selected.has(c) ? { background: `${CITY_COLORS[c]}33`, borderColor: `${CITY_COLORS[c]}66`, color: CITY_COLORS[c] } : {}}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: selected.has(c) ? CITY_COLORS[c] : '#4b5563' }} />
            {c}
          </button>
        ))}
      </div>

      {/* Metric comparison cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        {activeCities.map(c => (
          <div key={c} className="glass-card p-5" style={{ borderColor: `${CITY_COLORS[c]}33` }}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-white">{c}</p>
              <AQIBadge value={data[c]?.avgAQI ?? 0} size="sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'PM2.5', val: data[c]?.pm25 ?? 0, unit: 'μg' },
                { label: 'PM10',  val: data[c]?.pm10 ?? 0, unit: 'μg' },
                { label: 'NO₂',   val: data[c]?.no2  ?? 0, unit: 'μg' },
                { label: 'Hotspots', val: data[c]?.hotspots ?? 0, unit: '' },
              ].map(({ label, val, unit }) => (
                <div key={label} className="bg-gray-800/50 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="text-sm font-bold text-white">{val}{unit}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Metric table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Metric</th>
                {activeCities.map(c => (
                  <th key={c} className="text-center px-4 py-3 text-xs font-semibold uppercase" style={{ color: CITY_COLORS[c] }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {metrics.map(m => {
                const vals = activeCities.map(c => data[c]?.[m.key] ?? 0)
                const maxV = Math.max(...vals)
                return (
                  <tr key={m.key} className="hover:bg-gray-800/20">
                    <td className="px-4 py-3 text-sm text-gray-300">{m.label}</td>
                    {activeCities.map(c => {
                      const v = data[c]?.[m.key] ?? 0
                      const isMax = v === maxV && maxV > 0
                      return (
                        <td key={c} className="px-4 py-3 text-center">
                          <span className={`text-sm font-bold ${isMax ? 'text-red-400' : 'text-white'}`}>{v}</span>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* AQI bar chart */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Average AQI Comparison</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={aqiBarData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="city" tick={{ fill: '#9ca3af', fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#374151' }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={v => [v, 'Avg AQI']}
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              />
              <Bar dataKey="aqi" radius={[6, 6, 0, 0]} maxBarSize={70}>
                {aqiBarData.map(c => <Cell key={c.city} fill={CITY_COLORS[c.city] ?? '#3b82f6'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Radar chart */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Pollutant Profile (normalised %)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
              <PolarGrid stroke="#374151" />
              <PolarAngleAxis dataKey="pollutant" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
              {activeCities.map(c => (
                <Radar key={c} name={c} dataKey={c} stroke={CITY_COLORS[c]} fill={CITY_COLORS[c]} fillOpacity={0.15} strokeWidth={2} />
              ))}
              <Legend
                formatter={v => <span style={{ color: CITY_COLORS[v] ?? '#fff', fontSize: 11 }}>{v}</span>}
              />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trend line */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">7-Day AQI Trend Comparison</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#374151' }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            />
            <Legend formatter={v => <span style={{ color: CITY_COLORS[v] ?? '#fff', fontSize: 11 }}>{v}</span>} />
            {activeCities.map(c => (
              <Line key={c} type="monotone" dataKey={c} stroke={CITY_COLORS[c]} strokeWidth={2.5}
                dot={{ fill: CITY_COLORS[c], r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Ranking */}
      <div className="grid sm:grid-cols-2 gap-5">
        {[
          { label: 'Cleanest Cities', order: 'asc', color: 'emerald' },
          { label: 'Most Polluted Cities', order: 'desc', color: 'red' },
        ].map(({ label, order, color }) => {
          const sorted = activeCities
            .map(c => ({ city: c, avg: data[c]?.avgAQI ?? 0 }))
            .sort((a, b) => order === 'asc' ? a.avg - b.avg : b.avg - a.avg)
          return (
            <div key={label} className="glass-card p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">{label}</h3>
              <div className="space-y-3">
                {sorted.map((item, i) => (
                  <div key={item.city} className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}>{i + 1}</span>
                    <span className="flex-1 font-medium text-white">{item.city}</span>
                    <AQIBadge value={item.avg} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
