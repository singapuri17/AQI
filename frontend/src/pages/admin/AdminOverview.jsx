import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import {
  CloudIcon, UserGroupIcon, ExclamationTriangleIcon, BoltIcon,
  ShieldCheckIcon, DocumentTextIcon, CpuChipIcon, SignalIcon,
} from '@heroicons/react/24/outline'
import { aqiAPI, hotspotsAPI, governmentAPI, adminAPI } from '../../api'
import { CITIES_WITH_DATA } from '../../store/cityStore'
import StatCard from '../../components/common/StatCard'
import AQIBadge from '../../components/common/AQIBadge'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { useAuthStore } from '../../store/authStore'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { getAQIColor } from '../../utils/aqiUtils'

export default function AdminOverview({ setView }) {
  const { user } = useAuthStore()
  const [loading, setLoading]       = useState(true)
  const [cityStats, setCityStats]   = useState([])
  const [systemStats, setSystem]    = useState({
    officers: 0, hotspots: 0, highRisk: 0, actions: 0,
  })
  const [recentActions, setRecent]  = useState([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const [officersRes, ...cityResults] = await Promise.allSettled([
          adminAPI.listOfficers(),
          ...CITIES_WITH_DATA.map(city =>
            Promise.allSettled([
              aqiAPI.getCurrentAQI(city),
              hotspotsAPI.getHotspots(city),
              governmentAPI.getActions(city),
            ])
          ),
        ])

        if (cancelled) return

        // Officers
        const officers = officersRes.status === 'fulfilled'
          ? (Array.isArray(officersRes.value.data) ? officersRes.value.data : []) : []
        let totalHotspots = 0, totalHighRisk = 0, totalActions = 0
        const cities = []

        cityResults.forEach((cityResult, idx) => {
          const city = CITIES_WITH_DATA[idx]
          // Each cityResult is a Promise.allSettled result wrapping the inner allSettled array
          const [aqiR, hsR, actR] = cityResult.status === 'fulfilled' ? cityResult.value : []
          const aqiList = aqiR?.status === 'fulfilled'
            ? (Array.isArray(aqiR.value.data) ? aqiR.value.data : []) : []
          const hsList  = hsR?.status === 'fulfilled'
            ? (Array.isArray(hsR.value.data) ? hsR.value.data : []) : []
          const actList = actR?.status === 'fulfilled'
            ? (Array.isArray(actR.value.data) ? actR.value.data : []) : []

          const avg = aqiList.length
            ? aqiList.reduce((s, w) => s + (w.aqi_value ?? 0), 0) / aqiList.length : 0
          const highRisk = aqiList.filter(w => (w.aqi_value ?? 0) > 150).length

          totalHotspots += hsList.length
          totalHighRisk += highRisk
          totalActions  += actList.length

          cities.push({ city, avg: Math.round(avg), highRisk, hotspots: hsList.length, actions: actList.length })

          if (idx === 0) {
            setRecent(actList.slice(0, 6))
          }
        })

        setCityStats(cities)
        setSystem({ officers: officers.length, hotspots: totalHotspots, highRisk: totalHighRisk, actions: totalActions })
      } catch (e) {
        console.error('Admin overview error:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner text="Loading system overview…" />
    </div>
  )

  const STATUS_CLS = {
    pending:     'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    in_progress: 'bg-blue-500/20   text-blue-400   border-blue-500/30',
    completed:   'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    cancelled:   'bg-gray-600/20   text-gray-400   border-gray-600/30',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">System Overview</h1>
        <p className="text-gray-400 text-sm mt-1">
          Welcome, <span className="text-white font-medium">{user?.full_name || 'Administrator'}</span>
          {' · '}{format(new Date(), 'EEEE, MMMM d yyyy')}
          <span className="ml-2 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-medium">
            ADMIN
          </span>
        </p>
      </div>

      {/* System-wide stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={UserGroupIcon}          title="Total Officers"     value={systemStats.officers}  color="purple" />
        <StatCard icon={ExclamationTriangleIcon} title="Active Hotspots"    value={systemStats.hotspots}  color="red"    />
        <StatCard icon={ShieldCheckIcon}         title="High-Risk Wards"    value={systemStats.highRisk}  color="orange" />
        <StatCard icon={BoltIcon}                title="Total Actions"      value={systemStats.actions}   color="blue"   />
      </div>

      {/* Per-city AQI bar chart */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">City Average AQI</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={cityStats} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="city" tick={{ fill: '#9ca3af', fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#374151' }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip
              formatter={v => [Math.round(v), 'Avg AQI']}
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            />
            <Bar dataKey="avg" radius={[6, 6, 0, 0]} maxBarSize={60}>
              {cityStats.map(c => (
                <Cell key={c.city} fill={getAQIColor(c.avg)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* City summary cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        {cityStats.map(c => (
          <div key={c.city} className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-white">{c.city}</p>
              <AQIBadge value={c.avg} size="sm" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-red-400">{c.hotspots}</p>
                <p className="text-xs text-gray-500">Hotspots</p>
              </div>
              <div>
                <p className="text-lg font-bold text-orange-400">{c.highRisk}</p>
                <p className="text-xs text-gray-500">High-Risk</p>
              </div>
              <div>
                <p className="text-lg font-bold text-blue-400">{c.actions}</p>
                <p className="text-xs text-gray-500">Actions</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick navigation */}
      <div>
        <h2 className="text-base font-semibold text-white mb-3">Quick Access</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { id: 'city-monitor', icon: CloudIcon,              label: 'City Monitor',   color: 'text-blue-400'   },
            { id: 'comparison',   icon: SignalIcon,              label: 'Compare Cities', color: 'text-cyan-400'   },
            { id: 'officers',     icon: UserGroupIcon,           label: 'Officers',       color: 'text-purple-400' },
            { id: 'analytics',    icon: CpuChipIcon,             label: 'Analytics',      color: 'text-emerald-400'},
          ].map(({ id, icon: Icon, label, color }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className="glass-card p-4 flex flex-col items-center gap-2 hover:scale-[1.03] transition-transform"
            >
              <Icon className={`w-7 h-7 ${color}`} />
              <span className="text-sm font-medium text-gray-200">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent actions across all cities */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-300">Recent Actions (All Cities)</h3>
          <button onClick={() => setView('actions')} className="text-xs text-blue-400 hover:text-blue-300">View all →</button>
        </div>
        {recentActions.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No actions recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {recentActions.map(a => (
              <div key={a.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/30">
                <div>
                  <p className="text-sm font-medium text-white">{a.action_type}</p>
                  <p className="text-xs text-gray-400">{a.ward_id} · {a.description?.slice(0, 60)}{a.description?.length > 60 ? '…' : ''}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full border font-medium flex-shrink-0 ${STATUS_CLS[a.status] || STATUS_CLS.pending}`}>
                  {a.status?.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
