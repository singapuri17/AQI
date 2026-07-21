import { useEffect, useState, useCallback } from 'react'
import { hospitalsAPI } from '../../api'
import HospitalMap from '../../components/maps/HospitalMap'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { BuildingOffice2Icon, PhoneIcon, MapPinIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useCityStore, CITY_CENTRES } from '../../store/cityStore'

function normalise(h) {
  return {
    id:        h.id,
    name:      h.name,
    lat:       h.lat ?? h.latitude,
    lng:       h.lng ?? h.longitude,
    address:   h.address ?? '',
    phone:     h.contact ?? h.phone ?? '',
    emergency: h.emergency_facilities ?? h.emergency ?? false,
    distance:  h.distance_km ?? h.distance ?? null,
    ward_id:   h.ward_id ?? '',
  }
}

const RADII = [2, 5, 10, 20]

export default function HospitalsPage() {
  const [hospitals, setHospitals]           = useState([])
  const [counts, setCounts]                 = useState({ 2: 0, 5: 0, 10: 0, 20: 0 })
  const [loading, setLoading]               = useState(false)
  const [selectedRadius, setSelectedRadius] = useState(5)
  const [selected, setSelected]             = useState(null)
  const { selectedCity, userLocation }       = useCityStore()

  // City centre used as fallback when GPS is not available
  const cityLocation = CITY_CENTRES[selectedCity] ?? CITY_CENTRES.Ahmedabad
  const origin = userLocation ?? cityLocation

  const fetchNearby = useCallback(async (loc, radius) => {
    setLoading(true)
    try {
      const res = await hospitalsAPI.getNearbyHospitals(loc.lat, loc.lng, radius)
      const raw = Array.isArray(res.data) ? res.data : []
      setHospitals(raw.map(normalise).filter(h => h.lat && h.lng))
    } catch {
      setHospitals([])
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCounts = useCallback(async (loc) => {
    try {
      const results = await Promise.all(
        RADII.map(r => hospitalsAPI.getNearbyHospitals(loc.lat, loc.lng, r))
      )
      const next = {}
      RADII.forEach((r, i) => {
        next[r] = Array.isArray(results[i].data) ? results[i].data.length : 0
      })
      setCounts(next)
    } catch {
      // counts stay at 0 — non-critical
    }
  }, [])

  // Re-fetch when selected city OR user GPS location changes
  useEffect(() => {
    setHospitals([])
    setSelected(null)
    setCounts({ 2: 0, 5: 0, 10: 0, 20: 0 })
    fetchNearby(origin, selectedRadius)
    fetchCounts(origin)
  }, [selectedCity, userLocation]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRadiusChange = (r) => {
    setSelectedRadius(r)
    fetchNearby(origin, r)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BuildingOffice2Icon className="w-6 h-6 text-emerald-400" />
            Hospitals
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Medical facilities in{' '}
            <span className="text-white font-medium">{selectedCity}</span>
          </p>
        </div>

        {/* Radius selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-400">Show within:</span>
          {RADII.map(r => (
            <button
              key={r}
              onClick={() => handleRadiusChange(r)}
              className={clsx(
                'relative px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
                selectedRadius === r
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
              )}
            >
              {r} km
              {counts[r] > 0 && (
                <span className={clsx(
                  'absolute -top-2 -right-2 text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold border',
                  selectedRadius === r
                    ? 'bg-white text-emerald-700 border-emerald-300'
                    : 'bg-emerald-600 text-white border-emerald-500'
                )}>
                  {counts[r]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Count summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {RADII.map(r => (
          <button
            key={r}
            onClick={() => handleRadiusChange(r)}
            className={clsx(
              'glass-card p-3 text-center transition-all border cursor-pointer',
              selectedRadius === r
                ? 'border-emerald-500/50 bg-emerald-500/10'
                : 'border-gray-700/40 hover:border-emerald-500/20'
            )}
          >
            <p className={clsx('text-2xl font-bold', selectedRadius === r ? 'text-emerald-400' : 'text-white')}>
              {counts[r]}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">within {r} km</p>
          </button>
        ))}
      </div>

      {/* Map + list */}
      {loading ? (
        <div className="glass-card h-96 flex items-center justify-center">
          <LoadingSpinner text={`Loading hospitals in ${selectedCity}…`} />
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4" style={{ minHeight: 500 }}>
          {/* Map — centred on city, no user pin */}
          <div className="glass-card overflow-hidden" style={{ height: '55vh', minHeight: 400 }}>
            <HospitalMap
              hospitals={hospitals}
              userLocation={userLocation}
              center={[cityLocation.lat, cityLocation.lng]}
              selectedHospital={selected}
              radius={selectedRadius}
              height="100%"
            />
          </div>

          {/* Hospital list */}
          <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: '55vh' }}>
            <p className="text-sm text-gray-400 flex-shrink-0">
              {hospitals.length} hospital{hospitals.length !== 1 ? 's' : ''} within {selectedRadius} km
              {' '}of <span className="text-white font-medium">{userLocation ? 'your location' : `${selectedCity} centre`}</span>
            </p>

            {hospitals.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <BuildingOffice2Icon className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">No hospitals found within {selectedRadius} km</p>
                <p className="text-gray-500 text-xs mt-1">Try a larger radius</p>
              </div>
            ) : (
              hospitals.map(h => (
                <div
                  key={h.id}
                  onClick={() => setSelected(prev => prev?.id === h.id ? null : h)}
                  className={clsx(
                    'glass-card p-4 cursor-pointer transition-all hover:border-emerald-500/30',
                    selected?.id === h.id && 'border-emerald-500/50 bg-emerald-500/5'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-semibold text-white text-sm">{h.name}</p>
                        {h.emergency && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-medium">
                            Emergency
                          </span>
                        )}
                      </div>
                      {h.address && (
                        <p className="text-xs text-gray-400 flex items-center gap-1 mb-0.5">
                          <MapPinIcon className="w-3 h-3 flex-shrink-0" />
                          {h.address}
                        </p>
                      )}
                      {h.phone && (
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          📞 {h.phone}
                        </p>
                      )}
                    </div>
                    {h.distance != null && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-emerald-400">{h.distance.toFixed(1)} km</p>
                        <p className="text-xs text-gray-500">{userLocation ? 'from your location' : 'from centre'}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
