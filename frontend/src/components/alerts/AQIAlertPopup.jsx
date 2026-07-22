/**
 * AQIAlertPopup — auto-shown modal for severe AQI alerts.
 */
import { XMarkIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

export default function AQIAlertPopup({ alert, onDismiss }) {
  if (!alert) return null
  const { level, title, wardName, aqi, recommendations } = alert

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onDismiss}>
      <div
        className={clsx('w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden', level.bg, level.border)}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={clsx('flex items-center justify-between px-5 py-4 border-b border-white/10', level.banner)}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{level.icon}</span>
            <div>
              <p className={clsx('font-bold text-base', level.text)}>{title}</p>
              <p className="text-gray-300 text-sm">Current AQI: <strong>{aqi}</strong> — {level.label}</p>
            </div>
          </div>
          <button onClick={onDismiss} className="text-gray-400 hover:text-white transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-gray-200 leading-relaxed">{level.message}</p>

          <div>
            <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Recommendations
            </p>
            <ul className="space-y-2">
              {recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-gray-200">
                  <span className={clsx('mt-0.5 text-base flex-shrink-0', level.text)}>•</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={onDismiss}
            className={clsx('w-full py-2.5 rounded-xl border font-medium text-sm transition-colors hover:bg-white/10', level.text, level.border)}
          >
            I Understand — Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
