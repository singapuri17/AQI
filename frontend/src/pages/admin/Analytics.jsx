import { useEffect, useState } from 'react'
import { aqiAPI, governmentAPI } from '../../api'
import { CITIES_WITH_DATA } from '../../store/cityStore'
import { predictionsAPI } from '../../api'
import AQIPredictionPanel from '../../components/AQIPredictionPanel'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { CpuChipIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import { getAQIColor } from '../../utils/aqiUtils'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  CartesianGrid,
} from 'recharts'

const PIE_COLORS = ['#ef4444', '#f97316', '#fbbf24', '#a855f7', '#3b82f6', '#10b981']

export default function Analytics() {
  const [loading, setLoading]     = useState(true)
  const [wardData, setWardData]   = useState([])
  const [pollutants, setPollutants] = useState([])
  const [actionStats, setActionStats] = useState([])
  const [metrics, setMetrics]     = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [aqiResults, actionResults, metricsRes] = await Promise.allSettled([
        Promise.all(CITIES_WITH_DATA.map(c => aqiAPI.getCurrentAQI(c))),
        Promise.all(CITIES_WITH_DATA.map(c => governmentAPI.getActions(c))),
        predictionsAPI.getAccuracyMetrics(),
      ])

      if (aqiResults.status === 'fulfilled') {
        const all = aqiResults.value.flatMap((r, i) => {
          const list = Array.isArray(r.data) ? r.data : []
          return list.map(w => ({ ward: w.ward_name, aqi: Math.round(w.aqi_value ?? 0), city: CITIES_WITH_DATA[i] }))
        })
        all.sort((a, b) => b.aqi - a.aqi)
        setWardData(all.slice(0, 15))
        const allWards = aqiResults.value.flatMap(r => Array.isArray(r.data) ? r.data : [])
        const avg = key => allWards.length ? +(allWards.reduce((s, w) => s + (w[key] ?? 0), 0) / allWards.length).toFixed(1) : 0
        setPollutants([
          { name: 'PM2.5', value: avg('pm25') }, { name: 'PM10', value: avg('pm10') },
          { name: 'NO₂',   value: avg('no2')  }, { name: 'SO₂',  value: avg('so2')  },
          { name: 'CO',    value: avg('co')   }, { name: 'O₃',   value: avg('o3')   },
        ])
      }
      if (actionResults.status === 'fulfilled') {
        setActionStats(actionResults.value.map((r, i) => {
          const list = Array.isArray(r.data) ? r.data : []
          return { city: CITIES_WITH_DATA[i], total: list.length, completed: list.filter(a => a.status === 'completed').length, pending: list.filter(a => a.status === 'pending').length }
        }))
      }
      if (metricsRes.status === 'fulfilled') {
        const d = metricsRes.value.data
        const src = d?.xgboost ?? d?.random_forest ?? d ?? {}
        setMetrics({ mae: src.mae?.toFixed(2) ?? '--', rmse: src.rmse?.toFixed(2) ?? '--', r2: src.r2?.toFixed(3) ?? '--', acc: src.r2 != null ? `${(src.r2 * 100).toFixed(1)}%` : '--' })
      }
      setLoading(false)
    }
    load()
  }, [])

  const CITY_COLORS = { Ahmedabad: '#3b82f6', Surat: '#f97316', Vadodara: '#a855f7' }
  const [predCity, setPredCity] = useState(CITIES_WITH_DATA[0])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner text="Loading analytics…" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <CpuChipIcon className="w-6 h-6 text-emerald-400" />
          Analytics
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">State-wide insights, pollutant distribution and AQI predictions</p>
      </div>

      {/* Model accuracy */}
      {metrics && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Prediction Model Accuracy (XGBoost)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'MAE',      value: metrics.mae,  color: 'text-blue-400'    },
              { label: 'RMSE',     value: metrics.rmse, color: 'text-purple-400'  },
              { label: 'R²',       value: metrics.r2,   color: 'text-emerald-400' },
              { label: 'Accuracy', value: metrics.acc,  color: 'text-yellow-400'  },
            ].map(m => (
              <div key={m.label} className="bg-gray-800/50 rounded-xl p-4 text-center border border-gray-700/50">
                <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                <p className="text-sm font-semibold text-white mt-1">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── AQI Prediction (replaces Weekly Trend) ── */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <ChartBarIcon className="w-4 h-4 text-blue-400" />
            AQI Prediction — Ward-level Forecasts
          </h3>
          {/* City selector for prediction */}
          <div className="flex gap-1 bg-gray-800/60 rounded-lg p-1 border border-gray-700/50">
            {CITIES_WITH_DATA.map(c => (
              <button key={c} onClick={() => setPredCity(c)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  predCity === c ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}>{c}</button>
            ))}
          </div>
        </div>
        <AQIPredictionPanel
          city={predCity}
          compact={true}
          showWardSelector={true}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Most polluted wards */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Most Polluted Wards (Top 15)</h3>
          <ResponsiveContainer width="100%" height={Math.max(wardData.length * 28, 200)}>
            <BarChart data={wardData} layout="vertical" margin={{ top: 0, right: 20, left: 5, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#374151' }} />
              <YAxis dataKey="ward" type="category" tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} axisLine={false} width={80} />
              <Tooltip
                formatter={(v, _, { payload }) => [v, `AQI · ${payload.city}`]}
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              />
              <Bar dataKey="aqi" radius={[0, 4, 4, 0]} maxBarSize={18}>
                {wardData.map((w, i) => <Cell key={i} fill={getAQIColor(w.aqi)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pollutant distribution */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Avg Pollutant Levels (State-wide, μg/m³)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={pollutants} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#374151' }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip formatter={v => [`${v} μg/m³`]} contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {pollutants.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-3 gap-1.5 mt-3">
            {pollutants.map((p, i) => (
              <div key={p.name} className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i] }} />
                <span className="text-gray-300">{p.name}</span>
                <span className="text-gray-500 ml-auto">{p.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action trends by city */}
      {actionStats.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Government Action Summary by City</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={actionStats} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis dataKey="city" tick={{ fill: '#9ca3af', fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#374151' }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
              <Bar dataKey="total"     name="Total"     fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={30} />
              <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
              <Bar dataKey="pending"   name="Pending"   fill="#fbbf24" radius={[4, 4, 0, 0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
