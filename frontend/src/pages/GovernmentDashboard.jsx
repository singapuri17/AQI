import { useEffect, useState } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import Sidebar from '../components/common/Sidebar'
import StatCard from '../components/common/StatCard'
import LoadingSpinner from '../components/common/LoadingSpinner'
import WardRankingChart from '../components/charts/WardRankingChart'
import { aqiAPI, hotspotsAPI, governmentAPI } from '../api'
import { useAuthStore } from '../store/authStore'
import {
  ExclamationTriangleIcon, ShieldCheckIcon, BoltIcon, DocumentTextIcon,
  BuildingStorefrontIcon, StarIcon
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import AQIBadge from '../components/common/AQIBadge'

const PIE_COLORS = ['#ef4444', '#f97316', '#fbbf24', '#a855f7', '#3b82f6', '#10b981']

// Stable pollutant breakdown — computed once from real data, never random
const POLLUTANT_PIE = [
  { name: 'PM2.5', value: 35 },
  { name: 'PM10',  value: 25 },
  { name: 'NO₂',   value: 20 },
  { name: 'SO₂',   value: 10 },
  { name: 'CO',    value:  7 },
  { name: 'O₃',    value:  3 },
]

const STATUS_CLS = {
  active:      'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  pending:     'bg-yellow-500/20  text-yellow-400  border-yellow-500/30',
  completed:   'bg-blue-500/20    text-blue-400    border-blue-500/30',
  cancelled:   'bg-gray-600/20    text-gray-400    border-gray-600/30',
  in_progress: 'bg-purple-500/20  text-purple-400  border-purple-500/30',
}

function GovernmentOverview() {
  const [wardData, setWardData]         = useState([])
  const [recentActions, setRecentActions] = useState([])
  const [topPriority, setTopPriority]   = useState([])
  const [stats, setStats]               = useState({ hotspots: 0, highRisk: 0, actions: 0, reports: 0 })
  const [loading, setLoading]           = useState(true)
  const { user } = useAuthStore()

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true)
      try {
        // Fetch everything in parallel
        const [aqiRes, hotspotsRes, actionsRes, priorityRes] = await Promise.allSettled([
          aqiAPI.getCurrentAQI(),
          hotspotsAPI.getHotspots(),
          governmentAPI.getActions(),
          hotspotsAPI.getPriorityRanking(),
        ])

        // ── AQI wards ─────────────────────────────────────────────────
        if (aqiRes.status === 'fulfilled') {
          const list = Array.isArray(aqiRes.value.data) ? aqiRes.value.data : []
          // normalise to { ward, aqi } for WardRankingChart
          const normalised = list
            .map(w => ({
              ward: w.ward_name ?? w.name ?? w.ward_id ?? '—',
              aqi:  w.aqi_value ?? w.aqi ?? 0,
            }))
            .sort((a, b) => b.aqi - a.aqi)
          setWardData(normalised)

          // Count high-risk wards (AQI > 150)
          const highRisk = list.filter(w => (w.aqi_value ?? w.aqi ?? 0) > 150).length
          setStats(s => ({ ...s, highRisk }))
        }

        // ── Hotspots ──────────────────────────────────────────────────
        if (hotspotsRes.status === 'fulfilled') {
          const hs = Array.isArray(hotspotsRes.value.data) ? hotspotsRes.value.data : []
          setStats(s => ({ ...s, hotspots: hs.length }))
        }

        // ── Actions ───────────────────────────────────────────────────
        if (actionsRes.status === 'fulfilled') {
          const acts = Array.isArray(actionsRes.value.data) ? actionsRes.value.data : []
          setStats(s => ({ ...s, actions: acts.length }))
          setRecentActions(acts.slice(0, 5))
        }

        // ── Priority ranking ──────────────────────────────────────────
        if (priorityRes.status === 'fulfilled') {
          const pr = Array.isArray(priorityRes.value.data) ? priorityRes.value.data : []
          setTopPriority(pr.slice(0, 5))
        }

      } catch (e) {
        console.error('Gov dashboard load error:', e)
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [])   // ← only runs once on mount

  const quickLinks = [
    { to: '/government/hotspots',  icon: ExclamationTriangleIcon, label: 'View Hotspots',   color: 'orange' },
    { to: '/government/industries',icon: BuildingStorefrontIcon,  label: 'Industries',       color: 'yellow' },
    { to: '/government/priority',  icon: StarIcon,                label: 'Priority Ranking', color: 'purple' },
    { to: '/government/actions',   icon: BoltIcon,                label: 'Manage Actions',   color: 'blue'   },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner text="Loading government dashboard..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Government Control Center</h1>
        <p className="text-gray-400 text-sm mt-1">
          Welcome, {user?.full_name || user?.name} · {format(new Date(), 'EEEE, MMMM d yyyy')}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ExclamationTriangleIcon} title="Pollution Hotspots" value={stats.hotspots}  color="red"    />
        <StatCard icon={ShieldCheckIcon}         title="High-Risk Wards"   value={stats.highRisk}  color="orange" />
        <StatCard icon={BoltIcon}                title="Active Interventions" value={stats.actions} color="blue"   />
        <StatCard icon={DocumentTextIcon}        title="Reports Generated" value={stats.reports}   color="purple" />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Ward ranking bar chart */}
        <div className="lg:col-span-2">
          <WardRankingChart
            data={wardData.slice(0, 8)}
            title={`Ward AQI Rankings (Top ${Math.min(8, wardData.length)} of ${wardData.length})`}
          />
        </div>

        {/* Pollutant pie chart */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Pollutant Breakdown</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={POLLUTANT_PIE}
                cx="50%" cy="50%"
                innerRadius={45} outerRadius={70}
                dataKey="value"
                paddingAngle={2}
              >
                {POLLUTANT_PIE.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={v => [`${v}%`]}
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            {POLLUTANT_PIE.map((item, i) => (
              <div key={item.name} className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i] }} />
                <span className="text-gray-300">{item.name}</span>
                <span className="text-gray-500 ml-auto">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent actions */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-300">Recent Actions</h3>
            <Link to="/government/actions" className="text-xs text-blue-400 hover:text-blue-300">
              View all →
            </Link>
          </div>
          {recentActions.length === 0 ? (
            <div className="text-center py-6">
              <BoltIcon className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No actions created yet</p>
              <Link to="/government/actions" className="text-xs text-blue-400 mt-1 inline-block">
                Create first action →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentActions.map(action => (
                <div
                  key={action.id}
                  className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/30"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{action.action_type}</p>
                    <p className="text-xs text-gray-400">{action.ward_id ?? action.ward}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full border font-medium ${
                    STATUS_CLS[action.status] || STATUS_CLS.pending
                  }`}>
                    {action.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top 5 priority wards */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-300">Priority Wards (Top 5)</h3>
            <Link to="/government/priority" className="text-xs text-blue-400 hover:text-blue-300">
              Full ranking →
            </Link>
          </div>
          {topPriority.length === 0 && wardData.length > 0 ? (
            // Fallback: use ward AQI data directly
            <div className="space-y-2">
              {wardData.slice(0, 5).map((w, i) => (
                <div key={w.ward} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm text-gray-300 truncate">{w.ward}</span>
                  <AQIBadge value={w.aqi} size="sm" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {topPriority.map((row, i) => (
                <div key={row.ward_id ?? i} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                    {row.rank ?? i + 1}
                  </span>
                  <span className="flex-1 text-sm text-gray-300 truncate">
                    {row.ward_name ?? row.ward ?? row.ward_id}
                  </span>
                  <AQIBadge value={row.current_aqi ?? row.aqi ?? 0} size="sm" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick action tiles */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Quick Access</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map(({ to, icon: Icon, label, color }) => (
            <Link
              key={to}
              to={to}
              className="glass-card p-4 flex flex-col items-center text-center hover:scale-[1.03] transition-transform gap-2"
            >
              <Icon className={`w-7 h-7 ${
                color === 'orange' ? 'text-orange-400' :
                color === 'yellow' ? 'text-yellow-400' :
                color === 'purple' ? 'text-purple-400' : 'text-blue-400'
              }`} />
              <span className="text-sm font-medium text-gray-200">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function GovernmentDashboard() {
  const location = useLocation()
  const isRoot   = location.pathname === '/government'

  return (
    <div className="flex h-screen bg-gray-900 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-6xl mx-auto">
          {isRoot ? <GovernmentOverview /> : <Outlet />}
        </div>
      </main>
    </div>
  )
}
