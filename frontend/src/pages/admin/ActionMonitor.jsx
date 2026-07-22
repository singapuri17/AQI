import { useEffect, useState } from 'react'
import { governmentAPI } from '../../api'
import { CITIES_WITH_DATA } from '../../store/cityStore'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { BoltIcon, FunnelIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import clsx from 'clsx'

const STATUS_CLS = {
  pending:     'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  in_progress: 'bg-blue-500/20   text-blue-400   border-blue-500/30',
  completed:   'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  cancelled:   'bg-gray-600/20   text-gray-400   border-gray-600/30',
}
const PRIORITY_CLS = {
  critical: 'bg-red-500/20    text-red-400    border-red-500/30',
  high:     'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low:      'bg-gray-600/20   text-gray-400   border-gray-600/30',
}

export default function ActionMonitor() {
  const [actions, setActions]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [cityFilter, setCityFilter] = useState('All')
  const [statusFilter, setStatus]   = useState('All')
  const [search, setSearch]         = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const results = await Promise.allSettled(
        CITIES_WITH_DATA.map(async city => {
          const res = await governmentAPI.getActions(city)
          const list = Array.isArray(res.data) ? res.data : []
          return list.map(a => ({ ...a, city }))
        })
      )
      const all = results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
      all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      setActions(all)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = actions.filter(a => {
    if (cityFilter !== 'All' && a.city !== cityFilter) return false
    if (statusFilter !== 'All' && a.status !== statusFilter) return false
    if (search && !((a.ward_id ?? '').toLowerCase().includes(search.toLowerCase()) ||
                    (a.action_type ?? '').toLowerCase().includes(search.toLowerCase()))) return false
    return true
  })

  const statCounts = {
    total:    actions.length,
    pending:  actions.filter(a => a.status === 'pending').length,
    active:   actions.filter(a => a.status === 'in_progress').length,
    done:     actions.filter(a => a.status === 'completed').length,
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BoltIcon className="w-6 h-6 text-blue-400" />
          Action Monitor
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">Government actions across all cities</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',     val: statCounts.total,   color: 'text-white'         },
          { label: 'Pending',   val: statCounts.pending, color: 'text-yellow-400'    },
          { label: 'In Progress',val: statCounts.active, color: 'text-blue-400'      },
          { label: 'Completed', val: statCounts.done,    color: 'text-emerald-400'   },
        ].map(({ label, val, color }) => (
          <div key={label} className="glass-card p-4 text-center">
            <p className="text-xs text-gray-400">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>{val}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <FunnelIcon className="w-4 h-4 text-gray-400" />
        {/* City filter */}
        <div className="flex gap-1 bg-gray-800/60 rounded-lg p-1 border border-gray-700/50">
          {['All', ...CITIES_WITH_DATA].map(c => (
            <button key={c} onClick={() => setCityFilter(c)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                cityFilter === c ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}>{c}</button>
          ))}
        </div>
        {/* Status filter */}
        <div className="flex gap-1 bg-gray-800/60 rounded-lg p-1 border border-gray-700/50">
          {['All', 'pending', 'in_progress', 'completed', 'cancelled'].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                statusFilter === s ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}>{s.replace('_', ' ')}</button>
          ))}
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search ward / type…"
          className="input-field !py-1.5 !w-44 text-sm"
        />
        {filtered.length !== actions.length && (
          <span className="text-xs text-gray-400">Showing {filtered.length} of {actions.length}</span>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="glass-card h-48 flex items-center justify-center">
          <LoadingSpinner text="Loading actions…" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-8 text-center text-gray-400">No actions match the current filters.</div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700/50">
                  {['City', 'Ward', 'Type', 'Description', 'Priority', 'Status', 'Date'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.map(a => (
                  <tr key={`${a.city}-${a.id}`} className="hover:bg-gray-800/20 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-purple-300 whitespace-nowrap">{a.city}</td>
                    <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">{a.ward_id}</td>
                    <td className="px-4 py-3 text-sm text-white whitespace-nowrap">{a.action_type}</td>
                    <td className="px-4 py-3 text-sm text-gray-400 max-w-xs truncate">{a.description}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PRIORITY_CLS[a.priority] || PRIORITY_CLS.medium}`}>
                        {a.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_CLS[a.status] || STATUS_CLS.pending}`}>
                        {(a.status ?? '').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {a.created_at ? format(new Date(a.created_at), 'MMM d, yyyy') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
