import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import {
  HomeIcon,
  MapIcon,
  ChartBarIcon,
  HeartIcon,
  BuildingOffice2Icon,
  ExclamationTriangleIcon,
  BuildingStorefrontIcon,
  WrenchScrewdriverIcon,
  StarIcon,
  BoltIcon,
  DocumentTextIcon,
  ArrowRightOnRectangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserCircleIcon,
  CloudIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

const citizenLinks = [
  { to: '/citizen', label: 'Overview', icon: HomeIcon, end: true },
  { to: '/citizen/map', label: 'AQI Map', icon: MapIcon },
  { to: '/citizen/predictions', label: 'Predictions', icon: ChartBarIcon },
  { to: '/citizen/health', label: 'Health Risk', icon: HeartIcon },
  { to: '/citizen/hospitals', label: 'Hospitals', icon: BuildingOffice2Icon },
]

const governmentLinks = [
  { to: '/government', label: 'Overview', icon: HomeIcon, end: true },
  { to: '/government/hotspots', label: 'Hotspots', icon: ExclamationTriangleIcon },
  { to: '/government/industries', label: 'Industries', icon: BuildingStorefrontIcon },
  { to: '/government/priority', label: 'Priority Ranking', icon: StarIcon },
  { to: '/government/actions', label: 'Actions', icon: BoltIcon },
  { to: '/government/reports', label: 'Reports', icon: DocumentTextIcon },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const links = user?.role === 'government' ? governmentLinks : citizenLinks
  const isGov = user?.role === 'government'

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <aside className={clsx(
      'h-full flex flex-col bg-gray-900/80 backdrop-blur-md border-r border-gray-700/50 transition-all duration-300 relative',
      collapsed ? 'w-16' : 'w-60'
    )}>
      <div className={clsx('p-4 flex items-center gap-3 border-b border-gray-700/50', collapsed && 'justify-center')}>
        <div className={clsx(
          'p-1.5 rounded-lg',
          isGov ? 'bg-purple-500/20' : 'bg-blue-500/20'
        )}>
          <CloudIcon className={clsx('w-5 h-5', isGov ? 'text-purple-400' : 'text-blue-400')} />
        </div>
        {!collapsed && (
          <div>
            <p className="text-sm font-bold text-white">UAQIIS</p>
            <p className={clsx('text-xs', isGov ? 'text-purple-400' : 'text-blue-400')}>
              {isGov ? 'Government' : 'Citizen'} Portal
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
              isActive
                ? isGov
                  ? 'bg-purple-600/30 text-purple-300 border border-purple-500/30'
                  : 'bg-blue-600/30 text-blue-300 border border-blue-500/30'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50',
              collapsed && 'justify-center'
            )}
            title={collapsed ? label : undefined}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-700/50">
        {!collapsed && (
          <div className="flex items-center gap-2 px-2 py-2 mb-2">
            <UserCircleIcon className="w-7 h-7 text-gray-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.full_name || user?.name || 'User'}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={clsx(
            'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors',
            collapsed && 'justify-center'
          )}
          title={collapsed ? 'Sign out' : undefined}
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5 flex-shrink-0" />
          {!collapsed && 'Sign out'}
        </button>
      </div>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 bg-gray-800 border border-gray-700 rounded-full p-1 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors z-10"
      >
        {collapsed ? <ChevronRightIcon className="w-3 h-3" /> : <ChevronLeftIcon className="w-3 h-3" />}
      </button>
    </aside>
  )
}
