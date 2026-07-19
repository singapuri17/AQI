import { useEffect, useState } from 'react'
import { aqiAPI } from '../../api'
import AQIMap from '../../components/maps/AQIMap'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import AQIBadge from '../../components/common/AQIBadge'
import { AQI_LEVELS } from '../../utils/aqiUtils'
import { ArrowPathIcon, MapIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

// Fallback data using the same normalised shape as API data
const MOCK_WARDS = [
  { id: 1,  name: 'Naroda',      lat: 23.0731, lng: 72.6419, aqi: 210, pm25: 98.3,  pm10: 162.1, no2: 54.2, so2: 28.7 },
  { id: 2,  name: 'Vatva',       lat: 22.9805, lng: 72.6286, aqi: 185, pm25: 82.1,  pm10: 134.5, no2: 48.3, so2: 31.2 },
  { id: 3,  name: 'Nikol',       lat: 23.0353, lng: 72.6475, aqi: 167, pm25: 71.2,  pm10: 118.4, no2: 44.1, so2: 22.6 },
  { id: 4,  name: 'Gota',        lat: 23.0997, lng: 72.5537, aqi: 142, pm25: 58.3,  pm10: 97.2,  no2: 38.4, so2: 18.9 },
  { id: 5,  name: 'Bopal',       lat: 23.0175, lng: 72.4680, aqi: 89,  pm25: 31.4,  pm10: 58.7,  no2: 22.1, so2: 11.3 },
  { id: 6,  name: 'Satellite',   lat: 23.0214, lng: 72.5151, aqi: 58,  pm25: 18.2,  pm10: 34.6,  no2: 16.3, so2: 8.2  },
  { id: 7,  name: 'Navrangpura', lat: 23.0367, lng: 72.5620, aqi: 76,  pm25: 24.1,  pm10: 45.8,  no2: 21.4, so2: 10.7 },
  { id: 8,  name: 'Maninagar',   lat: 22.9924, lng: 72.5983, aqi: 131, pm25: 52.3,  pm10: 88.4,  no2: 35.7, so2: 16.8 },
  { id: 9,  name: 'Vastral',     lat: 22.9869, lng: 72.6598, aqi: 158, pm25: 67.4,  pm10: 109.2, no2: 41.8, so2: 20.3 },
  { id: 10, name: 'Chandkheda',  lat: 23.1146, lng: 72.5889, aqi: 112, pm25: 44.3,  pm10: 73.8,  no2: 30.1, so2: 15.2 },
  { id: 11, name: 'Ghatlodia',   lat: 23.0640, lng: 72.5539, aqi: 95,  pm25: 36.1,  pm10: 62.4,  no2: 24.8, so2: 12.1 },
  { id: 12, name: 'Thaltej',     lat: 23.0527, lng: 72.5076, aqi: 82,  pm25: 28.4,  pm10: 52.1,  no2: 20.3, so2: 9.8  },
  { id: 13, name: 'Bapunagar',   lat: 23.0437, lng: 72.6121, aqi: 172, pm25: 73.8,  pm10: 122.6, no2: 46.2, so2: 23.4 },
  { id: 14, name: 'Odhav',       lat: 22.9982, lng: 72.6403, aqi: 196, pm25: 88.7,  pm10: 148.3, no2: 51.4, so2: 29.1 },
  { id: 15, name: 'Isanpur',     lat: 22.9686, lng: 72.6158, aqi: 148, pm25: 60.2,  pm10: 101.4, no2: 39.7, so2: 19.8 },
  { id: 16, name: 'Naranpura',   lat: 23.0526, lng: 72.5716, aqi: 103, pm25: 41.5,  pm10: 68.2,  no2: 28.4, so2: 13.7 },
  { id: 17, name: 'Vejalpur',    lat: 23.0042, lng: 72.5363, aqi: 91,  pm25: 33.2,  pm10: 56.1,  no2: 23.6, so2: 11.8 },
  { id: 18, name: 'Shahibaug',   lat: 23.0591, lng: 72.5969, aqi: 118, pm25: 46.8,  pm10: 77.3,  no2: 31.9, so2: 14.5 },
  { id: 19, name: 'Paldi',       lat: 23.0170, lng: 72.5690, aqi: 87,  pm25: 30.1,  pm10: 51.4,  no2: 21.8, so2: 10.2 },
  { id: 20, name: 'Ramol',       lat: 22.9721, lng: 72.6477, aqi: 161, pm25: 69.3,  pm10: 113.7, no2: 43.2, so2: 21.4 },
]

// Normalise a backend AQI record → the flat shape the map expects
function normaliseWard(w, index) {
  return {
    id:    w.id    ?? w.ward_id  ?? index,
    name:  w.name  ?? w.ward_name ?? `Ward ${index + 1}`,
    lat:   w.lat   ?? w.latitude  ?? null,
    lng:   w.lng   ?? w.longitude ?? null,
    aqi:   w.aqi   ?? w.aqi_value ?? 0,
    pm25:  w.pm25  ?? null,
    pm10:  w.pm10  ?? null,
    no2:   w.no2   ?? null,
    so2:   w.so2   ?? null,
  }
}

export default function AQIMapPage() {
  const [wards, setWards]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [showHeatmap, setShowHeatmap] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res  = await aqiAPI.getCurrentAQI()
      const raw  = res.data

      // Backend returns a flat array of AQI records
      const list = Array.isArray(raw) ? raw : raw?.wards ?? raw?.data ?? []

      if (list.length > 0) {
        const normalised = list
          .map((w, i) => normaliseWard(w, i))
          .filter(w => w.lat !== null && w.lng !== null)   // skip records with no coords

        setWards(normalised.length > 0 ? normalised : MOCK_WARDS)
      } else {
        setWards(MOCK_WARDS)
      }
      setLastUpdated(new Date())
    } catch {
      setWards(MOCK_WARDS)
      setLastUpdated(new Date())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleRefresh = () => {
    toast.promise(fetchData(), {
      loading: 'Refreshing data...',
      success: 'AQI data updated',
      error: 'Failed to refresh',
    })
  }

  return (
    <div className="flex flex-col gap-4" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MapIcon className="w-6 h-6 text-blue-400" />
            AQI Map
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Real-time air quality across Ahmedabad's 20 wards
            {lastUpdated && ` · Updated ${lastUpdated.toLocaleTimeString()}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHeatmap(h => !h)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              showHeatmap
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'border-gray-700 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {showHeatmap ? 'Heat Mode ON' : 'Heat Mode'}
          </button>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-300 transition-colors"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Main content: map + sidebar */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Map */}
        <div className="flex-1 glass-card overflow-hidden rounded-xl min-h-0">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <LoadingSpinner text="Loading map data..." />
            </div>
          ) : (
            <AQIMap wards={wards} height="100%" heatmap={showHeatmap} />
          )}
        </div>

        {/* Sidebar */}
        <div className="w-60 flex flex-col gap-3 flex-shrink-0">
          {/* Legend */}
          <div className="glass-card p-4 flex-shrink-0">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              AQI Legend
            </h3>
            <div className="space-y-2">
              {AQI_LEVELS.map(({ range, label, color }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">{label}</p>
                    <p className="text-xs text-gray-400">{range}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ward list */}
          <div className="glass-card p-4 flex-1 overflow-y-auto min-h-0">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Ward Rankings
            </h3>
            <div className="space-y-2">
              {[...wards]
                .sort((a, b) => b.aqi - a.aqi)
                .map((ward, i) => (
                  <div key={ward.id ?? i} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-300 truncate">{ward.name}</span>
                    <AQIBadge value={ward.aqi} showLabel={false} size="sm" />
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
