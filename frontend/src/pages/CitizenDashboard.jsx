import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import Sidebar from '../components/common/Sidebar'
import CitySelector from '../components/common/CitySelector'
import { aqiAPI } from '../api'
import { useCityStore, filterWardsByCity } from '../store/cityStore'
import StatCard from '../components/common/StatCard'
import AQIBadge from '../components/common/AQIBadge'
import LoadingSpinner from '../components/common/LoadingSpinner'
import AQITrendChart from '../components/charts/AQITrendChart'
import AQIAlertBanner from '../components/alerts/AQIAlertBanner'
import AQIAlertPopup from '../components/alerts/AQIAlertPopup'
import AQINotificationBell from '../components/alerts/AQINotificationBell'
import { useAQIAlerts } from '../hooks/useAQIAlerts'
import {
  CloudIcon, MapIcon, ChartBarIcon, HeartIcon, BuildingOffice2Icon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'
import { getAQICategory } from '../utils/aqiUtils'
import { format, subDays } from 'date-fns'

// Build a stable 7-day trend from the ward array
function buildTrend(wards) {
  if (!wards || wards.length === 0) return []
  const avgNow  = wards.reduce((s, w) => s + (w.aqi_value ?? w.aqi ?? 0), 0) / wards.length
  const offsets = [8, 12, -6, -14, 4, 18, 0]
  return Array.from({ length: 7 }, (_, i) => ({
    time: format(subDays(new Date(), 6 - i), 'MMM d'),
    aqi:  Math.max(20, Math.round(avgNow + offsets[i])),
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard overview — shown at /citizen
// ─────────────────────────────────────────────────────────────────────────────
function DashboardOverview() {
  const [wards, setWards]     = useState([])
  const [trendData, setTrend] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const { selectedCity }      = useCityStore()

  // ── Alerts ──────────────────────────────────────────────────────────
  const { alerts, history, unreadCount, showPopup, markAllRead, dismissPopup } =
    useAQIAlerts(wards, selectedCity)

  useEffect(() => {
    let cancelled = false
    const fetch = async () => {
      setLoading(true)
      setError(null)
      try {
        console.log('AQI Source: Synthetic/mock data — SQLite DB seeded at startup. NOT real-time.')
        console.log('AQI Fetch: GET /aqi/current?city=' + selectedCity)
        const res  = await aqiAPI.getCurrentAQI(selectedCity)
        console.log('AQI Response:', res.data)
        const all  = Array.isArray(res.data) ? res.data : []
        const city = filterWardsByCity(all, selectedCity)
        console.log('AQI Filtered wards for', selectedCity, ':', city.length, 'wards')
        if (!cancelled) {
          setWards(city)
          setTrend(buildTrend(city))
        }
      } catch (e) {
        if (!cancelled) {
          console.error('Dashboard AQI fetch error:', e)
          setError('Could not load AQI data. Make sure the backend is running.')
          setWards([])
          setTrend([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [selectedCity])

  const validWards = wards.filter(w => (w.aqi_value ?? w.aqi ?? 0) > 0)

  const avgAQI = validWards.length
    ? validWards.reduce((s, w) => s + (w.aqi_value ?? w.aqi ?? 0), 0) / validWards.length
    : 0

  const worstWard = validWards.length
    ? validWards.reduce((a, b) => (a.aqi_value ?? a.aqi) > (b.aqi_value ?? b.aqi) ? a : b)
    : null

  const bestWard = validWards.length
    ? validWards.reduce((a, b) => (a.aqi_value ?? a.aqi) < (b.aqi_value ?? b.aqi) ? a : b)
    : null

  const avgCategory = getAQICategory(avgAQI)

  const quickLinks = [
    { to: '/citizen/map',         icon: MapIcon,             label: 'AQI Map',        desc: 'Live air quality across all wards',    color: 'blue'   },
    { to: '/citizen/predictions', icon: ChartBarIcon,        label: 'AI Predictions', desc: '7-day AQI forecasts powered by ML',    color: 'purple' },
    { to: '/citizen/health',      icon: HeartIcon,           label: 'Health Risk',    desc: 'Personalised health risk assessment',  color: 'red'    },
    { to: '/citizen/hospitals',   icon: BuildingOffice2Icon, label: 'Hospitals',      desc: 'Find emergency medical facilities',    color: 'green'  },
  ]

  const colorCard = {
    blue:   'from-blue-600/15    to-blue-500/5    border-blue-500/20    text-blue-400',
    purple: 'from-purple-600/15  to-purple-500/5  border-purple-500/20  text-purple-400',
    red:    'from-red-600/15     to-red-500/5     border-red-500/20     text-red-400',
    green:  'from-emerald-600/15 to-emerald-500/5 border-emerald-500/20 text-emerald-400',
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner text={`Loading ${selectedCity} data…`} />
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <ExclamationCircleIcon className="w-10 h-10 text-red-400" />
      <p className="text-red-400 font-medium">{error}</p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
      >
        Retry
      </button>
    </div>
  )

  const greet = new Date().getHours() < 12 ? 'Morning'
              : new Date().getHours() < 18 ? 'Afternoon'
              : 'Evening'

  return (
    <div className="space-y-6">
      {/* Data source disclaimer banner */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/60 border border-gray-700/40 text-xs text-gray-400">
        <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0 animate-pulse" />
        <span>
          <strong className="text-yellow-400">Demo Data</strong> — AQI values are{' '}
          <strong className="text-white">synthetically generated</strong> (not real-time).
          {' '}Base AQI per ward + diurnal/seasonal variation + random noise.
          {' '}Source: <code className="text-gray-300 bg-gray-700 px-1 rounded">air_quality.db</code> (SQLite, seeded at startup).
          {' '}No auto-refresh.
        </span>
      </div>

      {/* ── AQI Alert Popup (auto-shown for severe) ── */}
      {showPopup && alerts.length > 0 && (
        <AQIAlertPopup alert={alerts[0]} onDismiss={dismissPopup} />
      )}

      {/* ── Alert Banner ── */}
      {!loading && validWards.length > 0 && (
        <AQIAlertBanner
          avgAQI={avgAQI}
          worstWard={worstWard}
          city={selectedCity}
        />
      )}

      {/* Greeting */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Good {greet}</h1>
          <p className="text-gray-400 text-sm mt-1">
            Air quality overview for <span className="text-white font-medium">{selectedCity}</span>
            {' · '}{format(new Date(), 'EEEE, MMMM d')}
            {validWards.length > 0 && ` · ${validWards.length} wards monitored`}
          </p>
        </div>
        {/* Notification bell */}
        <AQINotificationBell
          alerts={alerts}
          history={history}
          unreadCount={unreadCount}
          onMarkRead={markAllRead}
        />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* City Average AQI */}
        <div
          className="glass-card p-5 flex items-center gap-4"
          style={{ borderColor: `${avgCategory.color}33`, background: `${avgCategory.color}11` }}
        >
          <div className="p-3 rounded-xl" style={{ background: `${avgCategory.color}22` }}>
            <CloudIcon className="w-7 h-7" style={{ color: avgCategory.color }} />
          </div>
          <div>
            <p className="text-gray-400 text-sm">City Average AQI</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-3xl font-bold text-white">{Math.round(avgAQI)}</span>
              <AQIBadge value={avgAQI} size="sm" />
            </div>
          </div>
        </div>

        <StatCard
          icon={CloudIcon}
          title="Most Polluted Ward"
          value={worstWard ? (worstWard.ward_name ?? worstWard.name ?? '—') : '—'}
          subtitle={worstWard ? `AQI ${Math.round(worstWard.aqi_value ?? worstWard.aqi ?? 0)}` : 'No data'}
          color="red"
        />

        <StatCard
          icon={CloudIcon}
          title="Cleanest Ward"
          value={bestWard ? (bestWard.ward_name ?? bestWard.name ?? '—') : '—'}
          subtitle={bestWard ? `AQI ${Math.round(bestWard.aqi_value ?? bestWard.aqi ?? 0)}` : 'No data'}
          color="green"
        />
      </div>

      {/* 7-day trend */}
      {trendData.length > 0 && (
        <AQITrendChart
          data={trendData}
          title={`7-Day AQI Trend — ${selectedCity}`}
          color="#3b82f6"
          height={200}
        />
      )}

      {/* Quick access tiles */}
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

// ─────────────────────────────────────────────────────────────────────────────
// Layout wrapper — shown for /citizen and all sub-routes
// ─────────────────────────────────────────────────────────────────────────────
export default function CitizenDashboard() {
  const location = useLocation()
  const isRoot   = location.pathname === '/citizen'
  const { selectedCity } = useCityStore()

  return (
    <div className="flex h-screen bg-gray-900 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Persistent city selector header */}
        <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-gray-700/50 bg-gray-900/80 backdrop-blur-md">
          <p className="text-sm text-gray-400">
            Viewing data for{' '}
            <span className="text-white font-semibold">{selectedCity}</span>
          </p>
          <CitySelector />
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-6xl mx-auto">
            {isRoot ? <DashboardOverview /> : <Outlet />}
          </div>
        </main>
      </div>
    </div>
  )
}
