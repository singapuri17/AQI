/**
 * DataSourceBadge — shows AQI data source, last updated time, and refresh status.
 * Shown on both CitizenDashboard and any page that displays AQI.
 */
import { useEffect, useState, useCallback } from 'react'
import { aqiAPI } from '../../api'
import { ArrowPathIcon, SignalIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'

export default function DataSourceBadge({ city, refreshIntervalMs = 30 * 60 * 1000 }) {
  const [info, setInfo]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)   // seconds until next auto-refresh

  const fetch = useCallback(async () => {
    try {
      const res = await aqiAPI.getSourceInfo(city)
      setInfo(res.data)
      setCountdown(Math.floor(refreshIntervalMs / 1000))
      console.log('AQI Source:', res.data.data_source)
      console.log('AQI Last Updated:', res.data.last_updated)
      console.log('AQI Status:', res.data.status)
    } catch { /* silent */ }
  }, [city, refreshIntervalMs])

  // Fetch on mount and when city changes
  useEffect(() => { fetch() }, [fetch])

  // Auto-refresh counter
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { fetch(); return Math.floor(refreshIntervalMs / 1000) }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [fetch, refreshIntervalMs])

  const handleManualRefresh = async () => {
    setLoading(true)
    await fetch()
    setLoading(false)
  }

  const isReal    = info?.is_real_data
  const hasKey    = info?.has_api_key
  const lastUpdated = info?.last_updated
    ? formatDistanceToNow(new Date(info.last_updated), { addSuffix: true })
    : 'unknown'

  const mins = Math.floor(countdown / 60)
  const secs = countdown % 60

  return (
    <div className={clsx(
      'flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2 rounded-lg border text-xs',
      isReal
        ? 'bg-emerald-900/20 border-emerald-700/40 text-emerald-300'
        : 'bg-yellow-900/20 border-yellow-700/40 text-yellow-300'
    )}>
      {/* Status dot + source name */}
      <div className="flex items-center gap-1.5">
        {isReal
          ? <SignalIcon className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          : <ExclamationTriangleIcon className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
        }
        <span className="font-medium">
          {isReal ? '🟢 Real-time' : '🟡 Synthetic (demo)'}
        </span>
      </div>

      {/* Source name */}
      <span className="text-gray-300">
        Source: <span className="text-white font-medium">{info?.data_source || '…'}</span>
      </span>

      {/* Last updated */}
      <span className="text-gray-400">
        Updated: <span className="text-gray-200">{lastUpdated}</span>
      </span>

      {/* Auto-refresh countdown */}
      {countdown > 0 && (
        <span className="text-gray-500">
          Refreshes in: <span className="text-gray-300 tabular-nums">
            {mins}:{String(secs).padStart(2, '0')}
          </span>
        </span>
      )}

      {/* Manual refresh button */}
      <button
        onClick={handleManualRefresh}
        disabled={loading}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
        title="Refresh now"
      >
        <ArrowPathIcon className={clsx('w-3 h-3', loading && 'animate-spin')} />
        {loading ? 'Refreshing…' : 'Refresh'}
      </button>

      {/* No API key warning */}
      {!hasKey && (
        <span className="text-yellow-400 font-medium">
          ⚠ Add WEATHER_API_KEY to backend/.env for real data
        </span>
      )}
    </div>
  )
}
