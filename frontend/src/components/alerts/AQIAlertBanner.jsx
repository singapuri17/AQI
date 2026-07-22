/**
 * AQIAlertBanner — colored banner shown at the top of the Citizen Dashboard.
 * Green → Safe | Yellow → Moderate | Orange → Unhealthy | Red → Severe
 */
import { useState } from 'react'
import { XMarkIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { getAlertLevel } from '../../hooks/useAQIAlerts'
import clsx from 'clsx'

export default function AQIAlertBanner({ avgAQI, worstWard, city }) {
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || !avgAQI) return null

  const level = getAlertLevel(avgAQI)

  // Don't show banner for safe/good air
  if (level.level === 'safe') return (
    <div className={clsx('flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm', level.bg, level.border)}>
      <span className="text-lg">✅</span>
      <span className={clsx('font-medium', level.text)}>Air quality in {city} is good (AQI {Math.round(avgAQI)})</span>
    </div>
  )

  return (
    <div className={clsx('rounded-xl border overflow-hidden', level.bg, level.border)}>
      {/* Banner header */}
      <div className="flex items-center justify-between px-4 py-3 gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-xl flex-shrink-0">{level.icon}</span>
          <div className="min-w-0">
            <span className={clsx('font-semibold text-sm', level.text)}>
              {level.label} — {city}
            </span>
            <span className="text-gray-300 text-sm ml-2">
              Avg AQI: <strong>{Math.round(avgAQI)}</strong>
              {worstWard && <span className="text-gray-400"> · Worst: {worstWard.ward_name} ({Math.round(worstWard.aqi_value ?? worstWard.aqi ?? 0)})</span>}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setExpanded(e => !e)}
            className={clsx('flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors', level.text, level.border, 'hover:bg-white/10')}>
            {expanded ? <><ChevronUpIcon className="w-3 h-3" /> Less</> : <><ChevronDownIcon className="w-3 h-3" /> Details</>}
          </button>
          <button onClick={() => setDismissed(true)} className="text-gray-400 hover:text-white transition-colors">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded recommendations */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/10 pt-3">
          <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">Health Recommendations</p>
          <ul className="space-y-1.5">
            {level.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-200">
                <span className="text-base flex-shrink-0 leading-tight">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
