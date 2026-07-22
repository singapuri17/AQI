/**
 * DataSourceBadge — shows AQI data source and last updated time.
 */
import { useEffect, useState, useCallback } from 'react'
import { aqiAPI } from '../../api'
import { ArrowPathIcon, SignalIcon } from '@heroicons/react/24/outline'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'

export default function DataSourceBadge({ city, refreshIntervalMs = 30 * 60 * 1000 }) {
  const [info, setInfo]       = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchInfo = useCallback(async () => {
    try {
      const res = await aqiAPI.getSourceInfo(city)
      setInfo(res.data)
    } catch { /* silent */ }
  }, [city])

  useEffect(() => { fetchInfo() }, [fetchInfo])

  const handleRefresh = async () => {
    setLoading(true)
    await fetchInfo()
    setLoading(false)
  }

  const lastUpdated = info?.last_updated
    ? formatDistanceToNow(new Date(info.last_updated), { addSuffix: true })
    : null

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 rounded-lg border border-blue-700/30 bg-blue-900/10 text-xs text-blue-300">
      <div className="flex items-center gap-1.5">
        <SignalIcon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
        <span className="font-medium">AQI Monitoring</span>
      </div>
      {info?.data_source && (
        <span className="text-gray-400">
          Source: <span className="text-white font-medium">{info.data_source}</span>
        </span>
      )}
      {lastUpdated && (
        <span className="text-gray-500">Updated: <span className="text-gray-300">{lastUpdated}</span></span>
      )}
      <button
        onClick={handleRefresh}
        disabled={loading}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
        title="Refresh"
      >
        <ArrowPathIcon className={clsx('w-3 h-3', loading && 'animate-spin')} />
        {loading ? 'Loading…' : 'Refresh'}
      </button>
    </div>
  )
}
