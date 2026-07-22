import { useEffect, useState } from 'react'
import { aqiAPI, hotspotsAPI } from '../../api'
import { CITIES_WITH_DATA, CITY_CENTRES } from '../../store/cityStore'
import AQIMap from '../../components/maps/AQIMap'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import AQIBadge from '../../components/common/AQIBadge'
import { getAQICategory } from '../../utils/aqiUtils'
import { MapIcon, FunnelIcon } from '@heroicons/react/24/outline'

const AQI_FILTERS = ['All', 'Good (≤50)', 'Moderate (≤100)', 'Poor (≤200)', 'Very Poor (≤300)', 'Severe (>300)']

function filterByAQI(wards, f) {
  if (f === 'All') return wards
  if (f.startsWith('Good'))      return wards.filter(w => w.aqi <= 50)
  if (f.startsWith('Moderate'))  return wards.filter(w => w.aqi > 50 && w.aqi <= 100)
  if (f.startsWith('Poor'))      return wards.filter(w => w.aqi > 100 && w.aqi <= 200)
  if (f.startsWith('Very'))      return wards.filter(w => w.aqi > 200 && w.aqi <= 300)
  if (f.startsWith('Severe'))    return wards.filter(w => w.aqi > 300)
  return wards
}

export default function StateMap() {
  const [allWards, setAllWards]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [heatmap, setHeatmap]     = useState(false)
  const [aqiFilter, setAqiFilter] = useState('All')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const results = await Promise.allSettled(
        CITIES_WITH_DATA.map(c => aqiAPI.getCurrentAQI(c))
      )
      const combined = []
      results.forEach(r => {
        if (r.status === 'fulfilled' && Array.isArray(r.value.data)) {
          r.value.data.forEach(w => {
            combined.push({
              id:   w.ward_id,
              name: w.ward_name,
              lat:  w.latitude,
              lng:  w.longitude,
              aqi:  w.aqi_value ?? 0,
              pm25: w.pm25, pm10: w.pm10, no2: w.no2, so2: w.so2,
            })
          })
        }
      })
      setAllWards(combined.filter(w => w.lat && w.lng))
      setLoading(false)
    }
    load()
  }, [])

  const filtered = filterByAQI(allWards, aqiFilter)

  // Gujarat geographic centre
  const gujaratCentre = [22.5, 72.0]
  const gujaratZoom   = 7

  const stats = CITIES_WITH_DATA.map(city => {
    const cityWards = allWards.filter(w => w.id?.startsWith(
      city === 'Ahmedabad' ? 'AMD_' : city === 'Surat' ? 'SRT_' : 'VDR_'
    ))
    const avg = cityWards.length
      ? Math.round(cityWards.reduce((s, w) => s + w.aqi, 0) / cityWards.length) : 0
    return { city, avg, wards: cityWards.length }
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MapIcon className="w-6 h-6 text-teal-400" />
            State-wide Heat Map
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            All cities simultaneously · {allWards.length} total wards
          </p>
        </div>
        <button
          onClick={() => setHeatmap(h => !h)}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
            heatmap ? 'bg-teal-600 border-teal-500 text-white' : 'border-gray-700 text-gray-300 hover:bg-gray-700'
          }`}
        >
          {heatmap ? 'Heat Mode ON' : 'Heat Mode'}
        </button>
      </div>

      {/* City summary cards */}
      <div className="grid sm:grid-cols-3 gap-3">
        {stats.map(s => (
          <div key={s.city} className="glass-card p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">{s.city}</p>
              <p className="text-xs text-gray-400">{s.wards} wards</p>
            </div>
            <AQIBadge value={s.avg} size="sm" />
          </div>
        ))}
      </div>

      {/* AQI filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <FunnelIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span className="text-xs text-gray-400">Filter:</span>
        {AQI_FILTERS.map(f => (
          <button key={f} onClick={() => setAqiFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              aqiFilter === f
                ? 'bg-teal-600 border-teal-500 text-white'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
            }`}>{f}</button>
        ))}
        {aqiFilter !== 'All' && (
          <span className="text-xs text-gray-400">({filtered.length} wards)</span>
        )}
      </div>

      {/* Full-state map */}
      <div className="glass-card overflow-hidden" style={{ height: '60vh', minHeight: 420 }}>
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <LoadingSpinner text="Loading state-wide data…" />
          </div>
        ) : (
          <AQIMap
            wards={filtered}
            center={gujaratCentre}
            zoom={gujaratZoom}
            height="100%"
            heatmap={heatmap}
          />
        )}
      </div>

      {/* AQI Legend */}
      <div className="glass-card p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">AQI Legend</p>
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Good',          range: '0–50',   color: '#10b981' },
            { label: 'Moderate',      range: '51–100', color: '#fbbf24' },
            { label: 'Unhealthy',     range: '101–200',color: '#f97316' },
            { label: 'Very Unhealthy',range: '201–300',color: '#ef4444' },
            { label: 'Severe',        range: '301+',   color: '#881337' },
          ].map(({ label, range, color }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded-full" style={{ background: color }} />
              <span className="text-gray-300">{label}</span>
              <span className="text-gray-500">({range})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
