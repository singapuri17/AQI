/**
 * AdminDashboard.jsx
 *
 * Full-screen SPA with its own collapsible sidebar and view router.
 * Each view is a separate component imported from ./admin/*.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  HomeIcon,
  CloudIcon,
  ChartBarIcon,
  TableCellsIcon,
  MapIcon,
  BoltIcon,
  UserGroupIcon,
  CpuChipIcon,
  DocumentTextIcon,
  BellIcon,
  ArrowRightOnRectangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserCircleIcon,
  Squares2X2Icon,
  LightBulbIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useAuthStore } from '../store/authStore'

// ── Lazy-load view components ────────────────────────────────────────────────
import AdminOverview    from './admin/AdminOverview'
import CityMonitor      from './admin/CityMonitor'
import CityComparison   from './admin/CityComparison'
import WardComparison   from './admin/WardComparison'
import StateMap         from './admin/StateMap'
import AIRecommendedActions from './admin/AIRecommendedActions'
import ActionMonitor    from './admin/ActionMonitor'
import OfficerManagement from './admin/OfficerManagement'
import Analytics        from './admin/Analytics'
import AdminReports     from './admin/AdminReports'
import Alerts           from './admin/Alerts'

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar definition
// ─────────────────────────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  {
    label: 'Main',
    items: [
      { id: 'overview',     label: 'Dashboard',       icon: HomeIcon          },
      { id: 'city-monitor', label: 'City Monitoring',  icon: CloudIcon         },
      { id: 'state-map',    label: 'State Map',        icon: MapIcon           },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { id: 'comparison',   label: 'City Comparison',  icon: ChartBarIcon      },
      { id: 'ward-compare', label: 'Ward Comparison',  icon: TableCellsIcon    },
      { id: 'analytics',    label: 'Analytics',        icon: CpuChipIcon       },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'actions',      label: 'Action Taking',    icon: BoltIcon          },
      { id: 'officers',     label: 'Officers',         icon: UserGroupIcon     },
      { id: 'reports',      label: 'Reports',          icon: DocumentTextIcon  },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { id: 'ai-actions',   label: 'AI Recommended Actions', icon: LightBulbIcon },
      { id: 'alerts',       label: 'Alerts',           icon: BellIcon          },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// AdminSidebar
// ─────────────────────────────────────────────────────────────────────────────

function AdminSidebar({ view, setView, collapsed, setCollapsed }) {
  const { user, logout } = useAuthStore()
  const navigate         = useNavigate()

  const handleLogout = () => { logout(); navigate('/') }

  return (
    <aside className={clsx(
      'h-full flex flex-col bg-gray-900/90 backdrop-blur-md border-r border-gray-700/50',
      'transition-all duration-300 relative flex-shrink-0',
      collapsed ? 'w-16' : 'w-60'
    )}>
      {/* Brand */}
      <div className={clsx('p-4 flex items-center gap-3 border-b border-gray-700/50 flex-shrink-0', collapsed && 'justify-center')}>
        <div className="p-1.5 rounded-lg bg-purple-500/20 flex-shrink-0">
          <CloudIcon className="w-5 h-5 text-purple-400" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">UAQIIS</p>
            <p className="text-xs text-purple-400">Admin Portal</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {NAV_SECTIONS.map(section => (
          <div key={section.label} className="mb-2">
            {!collapsed && (
              <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest px-2 mb-1">
                {section.label}
              </p>
            )}
            {section.items.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                title={collapsed ? label : undefined}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  view === id
                    ? 'bg-purple-600/30 text-purple-300 border border-purple-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50',
                  collapsed && 'justify-center'
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* User + logout */}
      <div className="p-3 border-t border-gray-700/50 flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2 px-2 py-2 mb-1">
            <UserCircleIcon className="w-7 h-7 text-gray-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.full_name || 'Admin'}</p>
              <p className="text-xs text-purple-400">Administrator</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={clsx(
            'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors',
            collapsed && 'justify-center'
          )}
          title={collapsed ? 'Logout' : undefined}
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5 flex-shrink-0" />
          {!collapsed && 'Logout'}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="absolute -right-3 top-20 bg-gray-800 border border-gray-700 rounded-full p-1
                   text-gray-400 hover:text-white hover:bg-gray-700 transition-colors z-10"
      >
        {collapsed ? <ChevronRightIcon className="w-3 h-3" /> : <ChevronLeftIcon className="w-3 h-3" />}
      </button>
    </aside>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// View renderer
// ─────────────────────────────────────────────────────────────────────────────

function ViewContent({ view, setView }) {
  switch (view) {
    case 'overview':     return <AdminOverview     setView={setView} />
    case 'city-monitor': return <CityMonitor />
    case 'comparison':   return <CityComparison />
    case 'ward-compare': return <WardComparison />
    case 'state-map':    return <StateMap />
    case 'ai-actions':   return <AIRecommendedActions />
    case 'actions':      return <ActionMonitor />
    case 'officers':     return <OfficerManagement />
    case 'analytics':    return <Analytics />
    case 'reports':      return <AdminReports />
    case 'alerts':       return <Alerts />
    default:             return <AdminOverview setView={setView} />
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Root component
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [view, setView]           = useState('overview')
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-screen bg-gray-900 overflow-hidden">
      <AdminSidebar
        view={view}
        setView={setView}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto">
          <ViewContent view={view} setView={setView} />
        </div>
      </main>
    </div>
  )
}
