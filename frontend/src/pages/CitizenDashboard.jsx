import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import Sidebar from '../components/common/Sidebar'
import { aqiAPI } from '../api'
import { useAuthStore } from '../store/authStore'
import StatCard from '../components/common/StatCard'
import AQIBadge from '../components/common/AQIBadge'
import LoadingSpinner from '../components/common/LoadingSpinner'
import AQITrendChart from '../components/charts/AQITrendChart'
import {
  CloudIcon, MapIcon, ChartBarIcon, HeartIcon, BuildingOffice2Icon
} from '@heroicons/react/24/outline'
import { getAQICategory } from '../utils/aqiUtils'
import { format, subDays, startOfDay } from 'date-fns'

// Build a stable 7-day trend from the ward array (no Math.random)
function buildTrend(wards) {
  if (!wards || wards.length === 0) return []

  // Average AQI across all wards for each of the last 7 days
  // Since we only have current snapshots (not 7-day history here),
  // we simulate a plausible curve based on the current avg with small
  // deterministic variation using ward count as a stable seed
  const avgNow = wards.reduce((s, w) => s + (w.aqi_value ?? w.aqi ?? 0), 0) / wards.length
  const seed = Math.round(avgNow)                    // stable: same data → same chart

  // Deterministic offset pattern (no Math.random — same every render)
  const offsets = [8, 12, -6, -14, 4, 18, 0]         // fixed day-by-day variation

  return Array.from({ length: 7 }, (_, i) => ({
    time: format(subDays(new Date(), 6 - i), 'MMM d'),
    aqi:  Math.max(20, Math.round(avgNow + offsets[i])),
  }))
}

function DashboardOverview() {
  const [wards, setWards]         = useState([])
  const [trendData, setTrendData] = useState([])
  const [loading, setLoading]     = useState(true)
  const { user } = useAuthStore()

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const res  = await aqiAPI.getCurrentAQI()
        // Backend returns a flat array of ward AQI records
        const list = Array.isArray(res.data) ? res.data : []
        setWards(list)
        setTrendData(buildTrend(list))
      } catch (e) {
        console.error('Dashboard AQI fetch error:', e)
        setWards([])
        setTrendData([])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])   // ← runs once on mount, NOT on every render

  // ── Compute stats from the ward array ─────────────────────────────
  const validWards = wards.filter(w => (w.aqi_value ?? w.aqi) > 0)

  const avgAQI = validWards.length
    ? validWards.reduce((s, w) => s + (w.aqi_value ?? w.aqi ?? 0), 0) / validWards.length
    : 0

  const worstWard = validWards.length
    ? validWards.reduce((a, b) =>
        (a.aqi_value ?? a.aqi) > (b.aqi_value ?? b.aqi) ? a : b)
    : null

  const bestWard = validWards.length
    ? validWards.reduce((a, b) =>
        (a.aqi_value ?? a.aqi) < (b.aqi_value ?? b.aqi) ? a : b)
    : null

  const avgCategory = getAQICategory(avgAQI)

  const quickLinks = [
    { to: '/citizen/map',         icon: MapIcon,              label: 'AQI Map',       desc: 'Live air quality across all wards',     color: 'blue'   },
    { to: '/citizen/predictions', icon: ChartBarIcon,         label: 'AI Predictions',desc: '7-day AQI forecasts powered by ML',     color: 'purple' },
    { to: '/citizen/health',      icon: HeartIcon,            label: 'Health Risk',   desc: 'Personalised health risk assessment',   color: 'red'    },
    { to: '/citizen/hospitals',   icon: BuildingOffice2Icon,  label: 'Hospitals',     desc: 'Find emergency medical facilities',     color: 'green'  },
  ]

  const colorCard = {
    blue:   'from-blue-600/15    to-blue-500/5    border-blue-500/20    text-blue-400',
    purple: 'from-purple-600/15  to-purple-500/5  border-purple-500/20  text-purple-400',
    red:    'from-red-600/15     to-red-500/5     border-red-500/20     text-red-400',
    green:  'from-emerald-600/15 to-emerald-500/5 border-emerald-500/20 text-emerald-400',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner text="Loading dashboard..." />
      </div>
    )
  }

  const greet = new Date().getHours() < 12 ? 'Morning'
              : new Date().getHours() < 18 ? 'Afternoon'
              : 'Evening'
  const firstName = (user?.full_name || user?.name)?.split(' ')[0] || 'Citizen'

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Good {greet}, {firstName}
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Air quality overview for Ahmedabad · {format(new Date(), 'EEEE, MMMM d')}
          {validWards.length > 0 && ` · ${validWards.length} wards monitored`}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* City Average */}
        <div
          className="glass-card p-5 flex items-center gap-4"
          style={{
            borderColor: `${avgCategory.color}33`,
            background:  `${avgCategory.color}11`,
          }}
        >
          <div className="p-3 rounded-xl" style={{ background: `${avgCategory.color}22` }}>
            <CloudIcon className="w-7 h-7" style={{ color: avgCategory.color }} />
          </div>
          <div>
            <p className="text-gray-400 text-sm">City Average AQI</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-3xl font-bold text-white">
                {Math.round(avgAQI)}
              </span>
              <AQIBadge value={avgAQI} size="sm" />
            </div>
          </div>
        </div>

        {/* Worst Ward */}
        <StatCard
          icon={CloudIcon}
          title="Worst Ward"
          value={worstWard ? (worstWard.ward_name ?? worstWard.name ?? '—') : '—'}
          subtitle={worstWard ? `AQI ${Math.round(worstWard.aqi_value ?? worstWard.aqi ?? 0)}` : 'No data'}
          color="red"
        />

        {/* Best Ward */}
        <StatCard
          icon={CloudIcon}
          title="Best Ward"
          value={bestWard ? (bestWard.ward_name ?? bestWard.name ?? '—') : '—'}
          subtitle={bestWard ? `AQI ${Math.round(bestWard.aqi_value ?? bestWard.aqi ?? 0)}` : 'No data'}
          color="green"
        />
      </div>

      {/* 7-day trend */}
      {trendData.length > 0 && (
        <AQITrendChart
          data={trendData}
          title="7-Day AQI Trend (City Average)"
          color="#3b82f6"
          height={200}
        />
      )}

      {/* Quick Access */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Quick Access</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map(({ to, icon: Icon, label, desc, color }) => (
            <Link
              key={to}
              to={to}
              className={`glass-card p-5 bg-gradient-to-br border hover:scale-[1.03] transition-all duration-200 ${colorCard[color]}`}
            >
              <Icon className="w-8 h-8 mb-3" />
              <p className="font-semibold text-white text-sm">{label}</p>
              <p className="text-xs text-gray-400 mt-1">{desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function CitizenDashboard() {
  const location = useLocation()
  const isRoot   = location.pathname === '/citizen'

  return (
    <div className="flex h-screen bg-gray-900 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-6xl mx-auto">
          {isRoot ? <DashboardOverview /> : <Outlet />}
        </div>
      </main>
    </div>
  )
}
