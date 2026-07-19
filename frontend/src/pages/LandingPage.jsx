import { Link } from 'react-router-dom'
import { CloudIcon, ChartBarIcon, HeartIcon, ShieldCheckIcon, MapPinIcon } from '@heroicons/react/24/outline'
import { AQI_LEVELS } from '../utils/aqiUtils'

function CitySkyline() {
  return (
    <svg viewBox="0 0 1200 300" className="w-full opacity-20" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="180" width="1200" height="120" fill="#1e3a5f" />
      <rect x="50" y="120" width="40" height="60" fill="#1e3a5f" />
      <rect x="55" y="105" width="30" height="15" fill="#1e3a5f" />
      <rect x="110" y="80" width="60" height="100" fill="#1e40af" />
      <rect x="125" y="65" width="30" height="15" fill="#1e40af" />
      <rect x="185" y="100" width="50" height="80" fill="#1e3a5f" />
      <rect x="250" y="60" width="70" height="120" fill="#1e40af" />
      <rect x="265" y="45" width="40" height="15" fill="#1e40af" />
      <rect x="335" y="90" width="45" height="90" fill="#1e3a5f" />
      <rect x="395" y="50" width="80" height="130" fill="#1d4ed8" />
      <rect x="415" y="35" width="40" height="15" fill="#1d4ed8" />
      <rect x="490" y="110" width="35" height="70" fill="#1e3a5f" />
      <rect x="540" y="70" width="55" height="110" fill="#1e40af" />
      <rect x="610" y="40" width="90" height="140" fill="#1d4ed8" />
      <rect x="635" y="25" width="40" height="15" fill="#1d4ed8" />
      <rect x="715" y="90" width="50" height="90" fill="#1e3a5f" />
      <rect x="780" y="60" width="65" height="120" fill="#1e40af" />
      <rect x="860" y="80" width="55" height="100" fill="#1e3a5f" />
      <rect x="930" y="45" width="75" height="135" fill="#1d4ed8" />
      <rect x="955" y="30" width="25" height="15" fill="#1d4ed8" />
      <rect x="1020" y="100" width="45" height="80" fill="#1e3a5f" />
      <rect x="1080" y="70" width="60" height="110" fill="#1e40af" />
      <rect x="1150" y="120" width="40" height="60" fill="#1e3a5f" />
    </svg>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white overflow-hidden">
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <CloudIcon className="w-7 h-7 text-blue-400" />
          </div>
          <span className="text-xl font-bold">UAQIIS</span>
        </div>
        <div className="flex gap-3">
          <Link to="/login" className="px-5 py-2 rounded-lg border border-gray-600 text-gray-300 hover:border-blue-500 hover:text-white transition-colors text-sm font-medium">
            Login
          </Link>
          <Link to="/register" className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors text-sm font-medium">
            Get Started
          </Link>
        </div>
      </nav>

      <section className="relative px-6 py-20 text-center max-w-5xl mx-auto">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
          <div className="absolute top-20 right-1/4 w-80 h-80 bg-cyan-600/15 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-40 bg-blue-900/30 blur-3xl" />
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-8">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          Real-time Air Quality Monitoring
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-tight mb-6">
          <span className="text-white">Breathe Smarter,</span>
          <br />
          <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 text-transparent bg-clip-text">
            Live Better
          </span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          AI-powered air quality intelligence for citizens and government agencies. Monitor, predict, and act on pollution data across Ahmedabad's 20 wards in real-time.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Link to="/register" className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-base font-semibold transition-colors shadow-lg shadow-blue-500/20">
            Start Monitoring Free
          </Link>
          <Link to="/login" className="px-8 py-3.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white rounded-xl text-base font-semibold transition-colors">
            Sign In to Dashboard
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-6 max-w-md mx-auto">
          {[
            { value: '20', label: 'Wards Monitored' },
            { value: 'Live', label: 'Real-time Updates' },
            { value: 'AI', label: 'Predictions' },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-sm text-gray-400">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative -mt-8">
        <CitySkyline />
      </section>

      <section className="px-6 py-16 max-w-6xl mx-auto">
        <h2 className="text-center text-sm font-semibold text-gray-400 uppercase tracking-widest mb-6">AQI Reference Scale</h2>
        <div className="flex flex-col sm:flex-row rounded-xl overflow-hidden border border-gray-700/50">
          {AQI_LEVELS.map(({ range, label, color }) => (
            <div
              key={label}
              className="flex-1 py-4 px-3 text-center hover:brightness-110 transition-all cursor-default"
              style={{ backgroundColor: `${color}22`, borderTop: `3px solid ${color}` }}
            >
              <p className="text-sm font-bold" style={{ color }}>{range}</p>
              <p className="text-xs text-gray-300 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 py-16 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">Built for Every Stakeholder</h2>
          <p className="text-gray-400">Tailored experiences for citizens and government authorities</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: HeartIcon,
              title: 'For Citizens',
              color: 'blue',
              description: 'Check real-time AQI for your ward, get personalized health risk scores, find nearby hospitals, and receive AI-powered health advisories.',
              features: ['Real-time AQI monitoring', 'Health risk assessment', 'Hospital locator', 'Multilingual health advice'],
            },
            {
              icon: ShieldCheckIcon,
              title: 'For Government',
              color: 'purple',
              description: 'Identify pollution hotspots, track industrial emissions, prioritize interventions, and generate evidence-based compliance reports.',
              features: ['Hotspot detection', 'Industry tracking', 'Priority ranking', 'Automated reports'],
            },
            {
              icon: ChartBarIcon,
              title: 'AI-Powered',
              color: 'cyan',
              description: 'Machine learning models predict AQI 7 days ahead, DBSCAN clustering identifies pollution sources, and Gemini AI generates smart recommendations.',
              features: ['7-day AQI forecasts', 'DBSCAN clustering', 'Gemini AI insights', 'Accuracy metrics'],
            },
          ].map(({ icon: Icon, title, color, description, features }) => (
            <div key={title} className="glass-card p-6 hover:border-gray-600 transition-all duration-200 group">
              <div className={`inline-flex p-3 rounded-xl mb-4 ${
                color === 'blue' ? 'bg-blue-500/20 text-blue-400' :
                color === 'purple' ? 'bg-purple-500/20 text-purple-400' :
                'bg-cyan-500/20 text-cyan-400'
              }`}>
                <Icon className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-white mb-3">{title}</h3>
              <p className="text-gray-400 text-sm mb-4 leading-relaxed">{description}</p>
              <ul className="space-y-2">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      color === 'blue' ? 'bg-blue-400' :
                      color === 'purple' ? 'bg-purple-400' : 'bg-cyan-400'
                    }`} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-gray-800 px-6 py-8 text-center text-gray-500 text-sm">
        <div className="flex items-center justify-center gap-2 mb-3">
          <CloudIcon className="w-5 h-5 text-blue-400" />
          <span className="font-bold text-gray-300">UAQIIS</span>
        </div>
        <p>Urban Air Quality Intelligence & Intervention System · Ahmedabad, India</p>
        <p className="mt-1 text-gray-600">© 2024 UAQIIS. Powered by AI & Real-time Data.</p>
      </footer>
    </div>
  )
}
