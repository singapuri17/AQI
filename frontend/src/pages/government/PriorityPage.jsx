import { useEffect, useState } from 'react'
import { hotspotsAPI } from '../../api'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import AQIBadge from '../../components/common/AQIBadge'
import WardRankingChart from '../../components/charts/WardRankingChart'
import { StarIcon, BoltIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useCityStore } from '../../store/cityStore'
import toast from 'react-hot-toast'
import clsx from 'clsx'

// Backend returns: { ward_id, ward_name, current_aqi, aqi_category,
//                    priority_score, rank, contributing_factors, recommended_actions }
function normalise(row, i) {
  return {
    rank:           row.rank ?? i + 1,
    ward:           row.ward_name ?? row.ward ?? row.ward_id ?? `Ward ${i + 1}`,
    ward_id:        row.ward_id ?? '',
    aqi:            row.current_aqi ?? row.aqi ?? 0,
    aqi_category:   row.aqi_category ?? '',
    priority_score: row.priority_score ?? 0,
    factors:        row.contributing_factors ?? [],
    actions:        row.recommended_actions ?? [],
  }
}

const statusStyles = {
  active:    'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  pending:   'bg-yellow-500/20  text-yellow-400  border-yellow-500/30',
  completed: 'bg-blue-500/20    text-blue-400    border-blue-500/30',
  none:      'bg-gray-600/20    text-gray-400    border-gray-600/30',
}

function priorityColor(score) {
  if (score >= 0.8) return 'text-red-400'
  if (score >= 0.6) return 'text-orange-400'
  if (score >= 0.4) return 'text-yellow-400'
  return 'text-emerald-400'
}
function priorityBorderColor(score) {
  if (score >= 0.8) return 'border-l-red-500'
  if (score >= 0.6) return 'border-l-orange-500'
  if (score >= 0.4) return 'border-l-yellow-500'
  return 'border-l-emerald-500'
}

export default function PriorityPage() {
  const [rows, setRows]     = useState([])
  const [loading, setLoading] = useState(true)
  const navigate            = useNavigate()
  const { user }            = useAuthStore()
  const { selectedCity }    = useCityStore()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await hotspotsAPI.getPriorityRanking(user?.city || selectedCity || null)
        const raw = Array.isArray(res.data) ? res.data : []
        setRows(raw.map(normalise))
      } catch (e) {
        console.error('Priority load error:', e)
        setRows([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user?.city, selectedCity])

  // Chart needs { ward, aqi }
  const chartData = rows.map(r => ({ ward: r.ward, aqi: r.aqi }))

  const handleAct = (ward, ward_id) => {
    navigate('/government/actions', { state: { wardPreset: ward } })
    toast.success(`Creating action for ${ward}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <StarIcon className="w-6 h-6 text-yellow-400" />
          Priority Ranking
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">
          Wards ranked by AQI severity, industry density, and construction activity
        </p>
      </div>

      {/* Bar chart */}
      {chartData.length > 0 && (
        <WardRankingChart
          data={chartData.slice(0, 10)}
          title="Top 10 Wards — AQI Priority Overview"
        />
      )}

      {/* Table */}
      {loading ? (
        <div className="glass-card h-48 flex items-center justify-center">
          <LoadingSpinner text="Loading priority data..." />
        </div>
      ) : rows.length === 0 ? (
        <div className="glass-card p-8 text-center text-gray-400">
          No priority data available
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-gray-700/50">
                  {['#', 'Ward', 'AQI', 'Priority Score', 'Key Factors', 'Action'].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {rows.map((row) => (
                  <tr
                    key={row.ward_id || row.ward}
                    className={clsx(
                      'hover:bg-gray-800/30 transition-colors border-l-2',
                      priorityBorderColor(row.priority_score)
                    )}
                  >
                    {/* Rank */}
                    <td className="px-4 py-3">
                      <span className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-white">
                        {row.rank}
                      </span>
                    </td>

                    {/* Ward name */}
                    <td className="px-4 py-3 text-sm font-medium text-white whitespace-nowrap">
                      {row.ward}
                    </td>

                    {/* AQI badge */}
                    <td className="px-4 py-3">
                      <AQIBadge value={row.aqi} size="sm" />
                    </td>

                    {/* Priority score — backend gives 0–1, display as 0–100 */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-700 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-orange-500"
                            style={{ width: `${Math.min(row.priority_score * 100, 100)}%` }}
                          />
                        </div>
                        <span className={`text-sm font-bold ${priorityColor(row.priority_score)}`}>
                          {(row.priority_score * 100).toFixed(1)}
                        </span>
                      </div>
                    </td>

                    {/* Contributing factors */}
                    <td className="px-4 py-3 max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {row.factors.length > 0 ? (
                          row.factors.slice(0, 2).map((f, i) => (
                            <span
                              key={i}
                              className="text-xs px-1.5 py-0.5 rounded bg-gray-700/60 text-gray-300 border border-gray-600/40"
                            >
                              {f}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-500">—</span>
                        )}
                      </div>
                    </td>

                    {/* Act button */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleAct(row.ward, row.ward_id)}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-colors whitespace-nowrap"
                      >
                        <BoltIcon className="w-3 h-3" />
                        Act
                      </button>
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
