import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useCityStore, CITIES } from '../../store/cityStore'
import {
  CloudIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  ChartBarIcon,
  MapIcon,
  BeakerIcon,
  HeartIcon,
  BuildingLibraryIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

const citizenLinks = [
  { to: '/citizen',             label: 'Dashboard',   icon: ChartBarIcon },
  { to: '/citizen/map',         label: 'AQI Map',     icon: MapIcon },
  { to: '/citizen/predictions', label: 'Predictions', icon: BeakerIcon },
  { to: '/citizen/health',      label: 'Health',      icon: HeartIcon },
]

const govLinks = [
  { to: '/government',             label: 'Dashboard', icon: ChartBarIcon },
  { to: '/government/hotspots',    label: 'Hotspots',  icon: MapIcon },
  { to: '/government/priority',    label: 'Priority',  icon: BeakerIcon },
  { to: '/government/actions',     label: 'Actions',   icon: HeartIcon },
]

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const { user, isAuthenticated, logout } = useAuthStore()
  const { selectedCity, setCity } = useCityStore()
  const navigate = useNavigate()
  const location = useLocation()

  const isGovPath = location.pathname.startsWith('/government')
  const navLinks = isGovPath ? govLinks : citizenLinks

  const handleLogout = () => {
    logout()
    navigate('/')
    setDropdownOpen(false)
  }

  return (
    <nav className="bg-gray-900/90 backdrop-blur-md border-b border-gray-700/50 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="p-1.5 rounded-lg bg-blue-500/20 group-hover:bg-blue-500/30 transition-colors">
              <CloudIcon className="w-6 h-6 text-blue-400" />
            </div>
            <span className="text-xl font-bold text-white">UAQIIS</span>
            <span className="hidden sm:block text-xs text-gray-400 mt-0.5">Air Quality System</span>
          </Link>

          {/* Desktop nav links — always visible on citizen, only when authenticated on gov */}
          {(!isGovPath || isAuthenticated) && (
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-gray-700/50 transition-colors"
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              ))}
            </div>
          )}

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* City selector — visible when on citizen path */}
            {!isGovPath && (
              <div className="flex items-center gap-1.5 bg-gray-800/60 border border-gray-700/50 rounded-lg px-2 py-1">
                <BuildingLibraryIcon className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <select
                  value={selectedCity}
                  onChange={e => setCity(e.target.value)}
                  className="bg-transparent text-sm text-white font-medium focus:outline-none cursor-pointer pr-1"
                >
                  {CITIES.map(c => (
                    <option key={c} value={c} className="bg-gray-800 text-white">{c}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Government path — authenticated user menu */}
            {isGovPath && isAuthenticated && (
              <>
                <div className="relative">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-700/50 transition-colors"
                  >
                    <UserCircleIcon className="w-7 h-7 text-gray-300" />
                    <div className="hidden sm:block text-left">
                      <p className="text-sm font-medium text-white leading-tight">
                        {user?.full_name || user?.name || 'Officer'}
                      </p>
                      <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-purple-500/20 text-purple-400">
                        Government
                      </span>
                    </div>
                  </button>

                  {dropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                      <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-xl border border-gray-700 shadow-xl z-20">
                        <div className="p-3 border-b border-gray-700">
                          <p className="text-sm font-medium text-white">{user?.full_name || user?.name}</p>
                          <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                        </div>
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors rounded-b-xl"
                        >
                          <ArrowRightOnRectangleIcon className="w-4 h-4" />
                          Sign out
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={() => setMobileOpen(!mobileOpen)}
                  className="md:hidden p-2 rounded-lg text-gray-300 hover:bg-gray-700/50"
                >
                  {mobileOpen ? <XMarkIcon className="w-5 h-5" /> : <Bars3Icon className="w-5 h-5" />}
                </button>
              </>
            )}

            {/* Citizen path — mobile hamburger (no auth UI) */}
            {!isGovPath && (
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 rounded-lg text-gray-300 hover:bg-gray-700/50"
              >
                {mobileOpen ? <XMarkIcon className="w-5 h-5" /> : <Bars3Icon className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-3 pt-1 border-t border-gray-700/50 mt-1">
            {navLinks.map(({ to, label, icon: Icon }) => (
              (!isGovPath || isAuthenticated) && (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-lg"
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              )
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}
