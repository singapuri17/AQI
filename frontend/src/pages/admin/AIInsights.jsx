import { useEffect, useState } from 'react'
import { aqiAPI, hotspotsAPI, governmentAPI } from '../../api'
import { CITIES_WITH_DATA } from '../../store/cityStore'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { CpuChipIcon, ArrowPathIcon, LightBulbIcon, ExclamationTriangleIcon, MapPinIcon, BoltIcon } from '@heroicons/react/24/outline'
import { getAQICategory } from '../../utils/aqiUtils'

function buildInsights(allData) {
  const insights = []

  // 1. Cities with worsening AQI
  const worseningCities = allData
    .filter(d => d.avgAQI > 200)
    .map(d => d.city)
  if (worseningCities.length > 0) {
    insights.push({
      id:       'worsening',
      category: 'warning',
      icon:     ExclamationTriangleIcon,
      title:    'Cities with elevated air quality risk',
      text:     `${worseningCities.join(' and ')} ${worseningCities.length === 1 ? 'has' : 'have'} an average AQI above 200. Health advisories should be issued and interventions prioritised.`,
      action:   'Review hotspot maps and issue public advisories',
    })
  }

  // 2. Most polluted wards consistently
  const worstWards = allData.flatMap(d => d.topWards).sort((a, b) => b.aqi - a.aqi).slice(0, 3)
  if (worstWards.length > 0) {
    insights.push({
      id:       'worst-wards',
      category: 'critical',
      icon:     MapPinIcon,
      title:    'Consistently high-pollution wards',
      text:     `${worstWards.map(w => `${w.name} (${w.city}, AQI ${w.aqi})`).join(', ')} are showing the highest AQI values. These areas require immediate intervention.`,
      action:   'Deploy emergency monitoring and industrial controls',
    })
  }

  // 3. Areas where complaints > actions
  const backlogCities = allData.filter(d => d.hotspots > d.actions)
  if (backlogCities.length > 0) {
    insights.push({
      id:       'backlog',
      category: 'warning',
      icon:     BoltIcon,
      title:    'Action backlog in high-pollution zones',
      text:     `${backlogCities.map(d => d.city).join(', ')} ${backlogCities.length === 1 ? 'has' : 'have'} more pollution hotspots than recorded government actions, suggesting intervention gaps.`,
      action:   'Assign additional officers and accelerate action creation',
    })
  }

  // 4. Predicted high-risk zones (deterministic from current AQI)
  const highRiskWards = allData.flatMap(d => d.topWards).filter(w => w.aqi > 150).slice(0, 4)
  if (highRiskWards.length > 0) {
    insights.push({
      id:       'predicted-risk',
      category: 'info',
      icon:     LightBulbIcon,
      title:    'Predicted high-risk zones for next 24–48 hours',
      text:     `Based on current AQI trends, ${highRiskWards.map(w => w.name).join(', ')} are likely to remain in the Unhealthy or Very Unhealthy category. Pre-emptive advisories are recommended.`,
      action:   'Issue 24-hour health advisories for sensitive groups',
    })
  }

  // 5. Fastest improving city (lowest AQI among monitored)
  const sorted = [...allData].sort((a, b) => a.avgAQI - b.avgAQI)
  if (sorted.length > 0) {
    insights.push({
      id:       'improving',
      category: 'positive',
      icon:     LightBulbIcon,
      title:    `${sorted[0].city} shows best air quality`,
      text:     `${sorted[0].city} has the lowest average AQI at ${sorted[0].avgAQI} among monitored cities. Interventions in this city appear effective and can be used as a model.`,
      action:   'Document successful interventions for replication',
    })
  }

  return insights
}

const CAT_STYLES = {
  critical: { border: 'border-l-red-500',    badge: 'bg-red-500/20 text-red-400 border-red-500/30',       icon: 'text-red-400'    },
  warning:  { border: 'border-l-orange-500', badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: 'text-orange-400' },
  info:     { border: 'border-l-blue-500',   badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',     icon: 'text-blue-400'   },
  positive: { border: 'border-l-emerald-500',badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',icon:'text-emerald-400'},
}

export default function AIInsights() {
  const [insights, setInsights] = useState([])
  const [loading, setLoading]   = useState(true)
  const [lastRefresh, setLast]  = useState(null)

  const load = async () => {
    setLoading(true)
    const results = await Promise.allSettled(
      CITIES_WITH_DATA.flatMap(city => [
        aqiAPI.getCurrentAQI(city).then(r => ({ type: 'aqi', city, data: r.data })),
        hotspotsAPI.getHotspots(city).then(r => ({ type: 'hs', city, data: r.data })),
        governmentAPI.getActions(city).then(r => ({ type: 'act', city, data: r.data })),
      ])
    )
    const byCity = {}
    results.forEach(r => {
      if (r.status !== 'fulfilled') return
      const { type, city, data } = r.value
      if (!byCity[city]) byCity[city] = { city, wards: [], hotspots: [], actions: [] }
      if (type === 'aqi')  byCity[city].wards    = Array.isArray(data) ? data : []
      if (type === 'hs')   byCity[city].hotspots = Array.isArray(data) ? data : []
      if (type === 'act')  byCity[city].actions  = Array.isArray(data) ? data : []
    })

    const allData = Object.values(byCity).map(d => {
      const sorted = [...d.wards].sort((a, b) => (b.aqi_value ?? 0) - (a.aqi_value ?? 0))
      const avg = d.wards.length ? Math.round(d.wards.reduce((s, w) => s + (w.aqi_value ?? 0), 0) / d.wards.length) : 0
      return {
        city:     d.city,
        avgAQI:   avg,
        topWards: sorted.slice(0, 3).map(w => ({ name: w.ward_name, aqi: Math.round(w.aqi_value ?? 0), city: d.city })),
        hotspots: d.hotspots.length,
        actions:  d.actions.length,
      }
    })

    setInsights(buildInsights(allData))
    setLast(new Date())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CpuChipIcon className="w-6 h-6 text-teal-400" />
            AI Insights
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Actionable recommendations based on real-time data
            {lastRefresh && <span className="ml-2 text-gray-500">· Updated {lastRefresh.toLocaleTimeString()}</span>}
          </p>
        </div>
        <button onClick={load}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:text-white text-sm transition-colors">
          <ArrowPathIcon className="w-4 h-4" />Refresh
        </button>
      </div>

      {/* Intro banner */}
      <div className="flex items-start gap-3 p-4 bg-teal-500/10 border border-teal-500/20 rounded-xl">
        <CpuChipIcon className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-teal-200 leading-relaxed">
          These insights are generated by analysing current AQI, pollutant levels, hotspot density and action history across all monitored cities. Each insight includes a recommended action.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner text="Generating AI insights…" />
        </div>
      ) : insights.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <CpuChipIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-300 font-medium">No insights available</p>
          <p className="text-gray-500 text-sm mt-1">No significant anomalies detected in current data.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {insights.map((ins, i) => {
            const sty  = CAT_STYLES[ins.category] ?? CAT_STYLES.info
            const Icon = ins.icon
            return (
              <div key={ins.id}
                className={`glass-card p-5 border-l-4 transition-all hover:border-gray-600 ${sty.border}`}>
                <div className="flex gap-4">
                  <div className={`p-2.5 rounded-xl flex-shrink-0 self-start ${sty.badge.split(' ')[0]}`}>
                    <Icon className={`w-5 h-5 ${sty.icon}`} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-gray-400">#{i + 1}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${sty.badge}`}>
                        {ins.category}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white">{ins.title}</h3>
                    <p className="text-sm text-gray-300 leading-relaxed">{ins.text}</p>
                    <div className="flex items-start gap-2 p-3 bg-gray-800/60 rounded-lg border border-gray-700/40 mt-2">
                      <BoltIcon className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-yellow-300 mb-0.5">Recommended Action</p>
                        <p className="text-xs text-gray-300">{ins.action}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
