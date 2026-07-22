/**
 * Government Portal — AQI Predictions page.
 * Reuses the shared AQIPredictionPanel component.
 */
import { useEffect, useState } from 'react'
import { aqiAPI } from '../../api'
import AQIPredictionPanel from '../../components/AQIPredictionPanel'
import AQIBadge from '../../components/common/AQIBadge'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { ChartBarIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '../../store/authStore'
import { useCityStore } from '../../store/cityStore'
import clsx from 'clsx'

export default function PredictionsGovPage() {
  const { user }         = useAuthStore()
  const { selectedCity } = useCityStore()
  const city = user?.city || selectedCity || 'Ahmedabad'

  const [wards, setWards]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    aqiAPI.getCurrentAQI(city)
      .then(res => setWards(Array.isArray(res.data) ? res.data : []))
      .catch(() => setWards([]))
      .finally(() => setLoading(false))
  }, [city])

  // Potential hotspots — wards with AQI > 150
  const hotspots = wards
    .filter(w => (w.aqi_value ?? 0) > 150)
    .sort((a, b) => (b.aqi_value ?? 0) - (a.aqi_value ?? 0))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ChartBarIcon className="w-6 h-6 text-blue-400" />
          AQI Predictions
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">
          AI-powered forecasts for <span className="text-white font-medium">{city}</span> — ward-wise 24h / 3-day / 7-day
        </p>
      </div>

      {/* Potential hotspot warnings */}
      {!loading && hotspots.length > 0 && (
        <div className="glass-card p-4 border border-orange-500/20 bg-orange-500/5">
          <p className="text-xs font-semibold text-orange-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <ExclamationTriangleIcon className="w-4 h-4" />
            Potential Hotspots — High AQI Wards
          </p>
          <div className="flex flex-wrap gap-2">
            {hotspots.map(w => (
              <div key={w.ward_id} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/60 rounded-lg border border-gray-700/40">
                <span className="text-sm text-white font-medium">{w.ward_name}</span>
                <AQIBadge value={w.aqi_value ?? 0} size="sm" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prediction panel */}
      {loading ? (
        <div className="glass-card h-60 flex items-center justify-center">
          <LoadingSpinner text={`Loading ${city} data…`} />
        </div>
      ) : (
        <div className="glass-card p-5">
          <AQIPredictionPanel
            city={city}
            wards={wards}
            compact={false}
            showWardSelector={true}
          />
        </div>
      )}
    </div>
  )
}
