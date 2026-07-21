import { useNavigate } from 'react-router-dom'
import {
  CloudIcon,
  ShieldCheckIcon,
  MapIcon,
  ChartBarIcon,
  HeartIcon,
  BuildingOffice2Icon,
  ExclamationTriangleIcon,
  BuildingLibraryIcon,
  BeakerIcon,
  CpuChipIcon,
  ArrowRightIcon,
  SignalIcon,
} from '@heroicons/react/24/outline'

const FEATURES = [
  {
    icon: SignalIcon,
    title: 'Real-Time AQI Monitoring',
    desc:  'Live air quality readings from sensors across 50+ wards updated continuously.',
    color: 'blue',
  },
  {
    icon: MapIcon,
    title: 'Interactive Pollution Map',
    desc:  'Visualise ward-level AQI values on an interactive map with heatmap overlays.',
    color: 'cyan',
  },
  {
    icon: BeakerIcon,
    title: 'AI AQI Prediction',
    desc:  'XGBoost ML models forecast air quality up to 7 days ahead with confidence bands.',
    color: 'purple',
  },
  {
    icon: HeartIcon,
    title: 'Health Recommendations',
    desc:  'Personalised advisories in English, Hindi, and Gujarati based on your profile.',
    color: 'rose',
  },
  {
    icon: ExclamationTriangleIcon,
    title: 'Pollution Hotspots',
    desc:  'DBSCAN clustering automatically detects and highlights high-risk pollution zones.',
    color: 'orange',
  },
  {
    icon: BuildingOffice2Icon,
    title: 'Nearby Hospitals',
    desc:  'Locate emergency medical facilities within any radius of any city centre.',
    color: 'emerald',
  },
  {
    icon: ChartBarIcon,
    title: 'Environmental Analytics',
    desc:  'Trend charts, ward rankings, and pollutant breakdowns for in-depth analysis.',
    color: 'indigo',
  },
  {
    icon: CpuChipIcon,
    title: 'Smart City Intelligence',
    desc:  'Gemini AI generates actionable intervention plans and evidence-based reports.',
    color: 'teal',
  },
]

const COLOR_MAP = {
  blue:    { bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'group-hover:border-blue-500/40'    },
  cyan:    { bg: 'bg-cyan-500/10',    text: 'text-cyan-400',    border: 'group-hover:border-cyan-500/40'    },
  purple:  { bg: 'bg-purple-500/10',  text: 'text-purple-400',  border: 'group-hover:border-purple-500/40'  },
  rose:    { bg: 'bg-rose-500/10',    text: 'text-rose-400',    border: 'group-hover:border-rose-500/40'    },
  orange:  { bg: 'bg-orange-500/10',  text: 'text-orange-400',  border: 'group-hover:border-orange-500/40'  },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'group-hover:border-emerald-500/40' },
  indigo:  { bg: 'bg-indigo-500/10',  text: 'text-indigo-400',  border: 'group-hover:border-indigo-500/40'  },
  teal:    { bg: 'bg-teal-500/10',    text: 'text-teal-400',    border: 'group-hover:border-teal-500/40'    },
}

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* ── Top navbar ───────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-800/60">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <CloudIcon className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-base font-bold text-white leading-tight">UAQIIS</p>
              <p className="text-[10px] text-gray-400 leading-tight hidden sm:block">
                Urban Air Quality Intelligence &amp; Intervention System
              </p>
            </div>
          </div>

          {/* Government Sign In — small, unobtrusive */}
          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-gray-300 border border-gray-700/70 hover:border-gray-500 hover:text-white bg-gray-800/60 hover:bg-gray-800 transition-all"
          >
            <ShieldCheckIcon className="w-4 h-4" />
            Government Sign In
          </button>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 py-24 text-center">
        {/* Ambient glows */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-0   left-1/4  w-[500px] h-[500px] bg-blue-700/15   rounded-full blur-3xl" />
          <div className="absolute top-20  right-1/4 w-[400px] h-[400px] bg-cyan-700/10   rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-48     bg-blue-900/20   blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Status pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-8">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            Live air quality data · Ahmedabad · Surat · Vadodara
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.1] mb-6 tracking-tight">
            Clean Air for Every
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
              Indian City
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
            A smart-city platform powered by AI and real-time sensor data — giving citizens
            instant access to air quality insights, and government agencies the tools to act.
          </p>

          {/* Stat row */}
          <div className="flex flex-wrap justify-center gap-8 mb-14">
            {[
              { value: '50+',   label: 'Wards Monitored' },
              { value: '3',     label: 'Cities'          },
              { value: '7-Day', label: 'AI Forecasts'    },
              { value: 'Live',  label: 'Real-time Data'  },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-extrabold text-white">{value}</p>
                <p className="text-xs text-gray-400 mt-0.5 uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>

          {/* Primary CTA */}
          <button
            onClick={() => navigate('/citizen')}
            className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white text-base font-semibold rounded-xl shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.03] active:scale-100"
          >
            Explore AQI
            <ArrowRightIcon className="w-5 h-5" />
          </button>
          <p className="text-xs text-gray-500 mt-3">No account required · Free public access</p>
        </div>
      </section>

      {/* ── Features grid ────────────────────────────────────────────── */}
      <section className="px-6 py-16 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-2">
            Platform Capabilities
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Everything you need to understand air quality
          </h2>
          <p className="text-gray-400 mt-3 max-w-xl mx-auto text-sm">
            From live readings and predictive analytics to government intervention tools — all in one platform.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc, color }) => {
            const c = COLOR_MAP[color]
            return (
              <div
                key={title}
                className={`group glass-card p-6 border border-gray-700/50 hover:border-gray-600 transition-all duration-200 ${c.border}`}
              >
                <div className={`inline-flex p-3 rounded-xl mb-4 ${c.bg}`}>
                  <Icon className={`w-6 h-6 ${c.text}`} />
                </div>
                <h3 className="text-sm font-bold text-white mb-2">{title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
              </div>
            )
          })}
        </div>

        {/* CTA below features */}
        <div className="mt-12 text-center">
          <button
            onClick={() => navigate('/citizen')}
            className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white text-base font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.03] active:scale-100"
          >
            Explore AQI
            <ArrowRightIcon className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* ── AQI reference bar ────────────────────────────────────────── */}
      <section className="px-6 py-10 max-w-6xl mx-auto">
        <p className="text-center text-xs font-semibold text-gray-500 uppercase tracking-widest mb-5">
          AQI Reference Scale
        </p>
        <div className="flex flex-col sm:flex-row rounded-xl overflow-hidden border border-gray-700/40">
          {[
            { range: '0–50',    label: 'Good',              color: '#10b981' },
            { range: '51–100',  label: 'Moderate',          color: '#fbbf24' },
            { range: '101–150', label: 'Unhealthy (Sens.)', color: '#f97316' },
            { range: '151–200', label: 'Unhealthy',         color: '#ef4444' },
            { range: '201–300', label: 'Very Unhealthy',    color: '#a855f7' },
            { range: '301+',    label: 'Hazardous',         color: '#881337' },
          ].map(({ range, label, color }) => (
            <div
              key={label}
              className="flex-1 py-4 px-3 text-center transition-all hover:brightness-110"
              style={{ backgroundColor: `${color}20`, borderTop: `3px solid ${color}` }}
            >
              <p className="text-sm font-bold" style={{ color }}>{range}</p>
              <p className="text-xs text-gray-300 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-800 px-6 py-10 text-center text-gray-500 text-sm">
        <div className="flex items-center justify-center gap-2 mb-3">
          <CloudIcon className="w-5 h-5 text-blue-400" />
          <span className="font-bold text-gray-300">UAQIIS</span>
        </div>
        <p>Urban Air Quality Intelligence &amp; Intervention System · Gujarat, India</p>
        <p className="mt-1 text-gray-600 text-xs">© 2024 UAQIIS. Powered by AI &amp; Real-time Data.</p>
      </footer>
    </div>
  )
}
