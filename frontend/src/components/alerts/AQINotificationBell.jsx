/**
 * AQINotificationBell — bell icon with unread badge + dropdown history panel.
 */
import { useState, useRef, useEffect } from 'react'
import { BellIcon, BellAlertIcon } from '@heroicons/react/24/outline'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'

export default function AQINotificationBell({ alerts, history, unreadCount, onMarkRead }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpen = () => {
    setOpen(o => !o)
    if (!open) onMarkRead()
  }

  const allItems = [...(alerts || []), ...(history || [])]
    .filter((v, i, arr) => arr.findIndex(x => x.id === v.id) === i) // dedupe
    .slice(0, 20)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
        title="AQI Notifications"
      >
        {unreadCount > 0
          ? <BellAlertIcon className="w-5 h-5 text-yellow-400 animate-pulse" />
          : <BellIcon className="w-5 h-5 text-gray-400" />
        }
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <p className="font-semibold text-white text-sm">AQI Notifications</p>
            {allItems.length > 0 && (
              <span className="text-xs text-gray-400">{allItems.length} alert{allItems.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-700/50">
            {allItems.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <BellIcon className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">No AQI alerts yet</p>
                <p className="text-gray-500 text-xs mt-1">Alerts appear when AQI exceeds 100</p>
              </div>
            ) : (
              allItems.map(item => (
                <div key={item.id} className={clsx('px-4 py-3 hover:bg-gray-700/30 transition-colors', item.level.bg)}>
                  <div className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0 mt-0.5">{item.level.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={clsx('text-sm font-semibold', item.level.text)}>{item.title}</p>
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 mt-0.5">
                        AQI <strong>{item.aqi}</strong> — {item.level.label}
                      </p>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">{item.message}</p>
                      {/* Top 2 recommendations */}
                      <ul className="mt-1.5 space-y-0.5">
                        {item.recommendations.slice(0, 2).map((r, i) => (
                          <li key={i} className="text-xs text-gray-400 flex items-start gap-1">
                            <span className={clsx('flex-shrink-0', item.level.text)}>•</span> {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {allItems.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-700 text-center">
              <p className="text-xs text-gray-500">Showing last {allItems.length} alerts · auto-updates with AQI data</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
