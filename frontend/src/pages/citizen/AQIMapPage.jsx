import { useEffect, useState } from 'react'
import { aqiAPI } from '../../api'
import AQIMap from '../../components/maps/AQIMap'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import AQIBadge from '../../components/common/AQIBadge'
import { AQI_LEVELS } from '../../utils/aqiUtils'
import { ArrowPathIcon, MapIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { useCityStore, CITY_CENTRES, CITY_ZOOM, filterWardsByCity } from '../../store/cityStore'

// Per-city mock fallback data so the map always shows something
const MOCK_WARDS = {
  Ahmedabad: [
    { id: 'AMD_W01', name: 'Maninagar',   lat: 22.994, lng: 72.618, aqi: 166 },
    { id: 'AMD_W02', name: 'Narol',       lat: 22.968, lng: 72.639, aqi: 217 },
    { id: 'AMD_W03', name: 'Vatva GIDC',  lat: 22.940, lng: 72.637, aqi: 311 },
    { id: 'AMD_W04', name: 'Odhav',       lat: 23.015, lng: 72.662, aqi: 246 },
    { id: 'AMD_W05', name: 'Naroda',      lat: 23.074, lng: 72.651, aqi: 285 },
    { id: 'AMD_W06', name: 'Chandkheda',  lat: 23.102, lng: 72.585, aqi: 175 },
    { id: 'AMD_W07', name: 'Sabarmati',   lat: 23.081, lng: 72.595, aqi: 198 },
    { id: 'AMD_W08', name: 'Thaltej',     lat: 23.060, lng: 72.509, aqi: 104 },
    { id: 'AMD_W09', name: 'Bopal',       lat: 23.027, lng: 72.470, aqi: 75  },
    { id: 'AMD_W10', name: 'Navrangpura', lat: 23.030, lng: 72.564, aqi: 166 },
  ],
  Surat: [
    { id: 'SRT_W01', name: 'Udhna',      lat: 21.178, lng: 72.853, aqi: 254 },
    { id: 'SRT_W02', name: 'Sachin GIDC',lat: 21.088, lng: 72.893, aqi: 343 },
    { id: 'SRT_W03', name: 'Pandesara',  lat: 21.151, lng: 72.871, aqi: 304 },
    { id: 'SRT_W04', name: 'Katargam',   lat: 21.212, lng: 72.842, aqi: 229 },
    { id: 'SRT_W05', name: 'Varachha',   lat: 21.211, lng: 72.877, aqi: 197 },
    { id: 'SRT_W06', name: 'Adajan',     lat: 21.190, lng: 72.793, aqi: 129 },
    { id: 'SRT_W07', name: 'Vesu',       lat: 21.158, lng: 72.773, aqi: 87  },
  ],
  Vadodara: [
    { id: 'VDR_W01', name: 'Gorwa',       lat: 22.338, lng: 73.148, aqi: 234 },
    { id: 'VDR_W02', name: 'Makarpura GIDC', lat: 22.251, lng: 73.177, aqi: 271 },
    { id: 'VDR_W03', name: 'Manjalpur',   lat: 22.274, lng: 73.193, aqi: 167 },
    { id: 'VDR_W04', name: 'Alkapuri',    lat: 22.309, lng: 73.170, aqi: 124 },
    { id: 'VDR_W05', name: 'Waghodia Rd', lat: 22.306, lng: 73.230, aqi: 198 },
    { id: 'VDR_W06', name: 'Nizampura',   lat: 22.349, lng: 73.196, aqi: 156 },
  ],
}

function normaliseWard(w, i) {
  return {
    id:   w.id   ?? w.ward_id   ?? i,
    name: w.name ?? w.ward_name ?? `Ward ${i + 1}`,
    lat:  w.lat  ?? w.latitude  ?? null,
    lng:  w.lng  ?? w.longitude ?? null,
    aqi:  w.aqi  ?? w.aqi_value ?? 0,
    pm25: w.pm25 ?? null,
    pm10: w.pm10 ?? null,
    no2:  w.no2  ?? null,
    so2:  w.so2  ?? null,
  }
}

export default function AQIMapPage() {
  const [wards, setWards]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [lastUpdated, setLast]    = useState(null)
  const [showHeatmap, setHeatmap] = useState(false)
  const { selectedCity }          = useCityStore()

  const centre = CITY_CENTRES[selectedCity] ?? CITY_CENTRES.Ahmedabad
  const zoom   = CITY_ZOOM[selectedCity]   ?? 12

  const fetchData = async (city) => {
    setLoading(true)
    try {
      const res  = await aqiAPI.getCurrentAQI(city)
      const raw  = Array.isArray(res.data) ? res.data : res.data?.wards ?? []

      // Keep only wards belonging to this city
      const cityRaw    = filterWardsByCity(raw, city)
      const normalised = cityRaw
        .map((w, i) => normaliseWard(w, i))
        .filter(w => w.lat !== null && w.lng !== null)

      setWards(normalised.length > 0 ? normalised : MOCK_WARDS[city] ?? [])
      setLast(new Date())
    } catch {
      setWards(MOCK_WARDS[city] ?? [])
      setLast(new Date())
    } finally {
      setLoading(false)
    }
  }

  // Re-fetch whenever the selected city changes
  useEffect(() => {
    setWards([])
    fetchData(selectedCity)
  }, [selectedCity]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => {
    toast.promise(fetchData(selectedCity), {
      loading: 'Refreshing…',
      success: 'AQI data updated',
      error:   'Failed to refresh',
    })
  }

  return (
    <div className="flex flex-col gap-4" style={{ height: 'calc(100vh - 160px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MapIcon className="w-6 h-6 text-blue-400" />
            AQI Map
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Real-time air quality · <span className="text-white font-medium">{selectedCity}</span>
            {lastUpdated && ` · Updated ${lastUpdated.toLocaleTimeString()}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setHeatmap(h => !h)}
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

      {/* Map + sidebar */}
      <div className="flex gap-4 flex-1 min-h-0">
        <div className="flex-1 glass-card overflow-hidden rounded-xl min-h-0">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <LoadingSpinner text={`Loading ${selectedCity} map…`} />
            </div>
          ) : (
            <AQIMap
              wards={wards}
              center={[centre.lat, centre.lng]}
              zoom={zoom}
              height="100%"
              heatmap={showHeatmap}
            />
          )}
        </div>

        {/* Legend + ward rankings */}
        <div className="w-60 flex flex-col gap-3 flex-shrink-0">
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

          <div className="glass-card p-4 flex-1 overflow-y-auto min-h-0">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Ward Rankings · {selectedCity}
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
