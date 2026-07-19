import { useEffect, useState } from 'react'
import { hospitalsAPI } from '../../api'
import HospitalMap from '../../components/maps/HospitalMap'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { BuildingOffice2Icon, PhoneIcon, MapPinIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

// Normalise backend shape → UI shape
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
  const [loading, setLoading]               = useState(true)
  const [selectedRadius, setSelectedRadius] = useState(10)
  const [selected, setSelected]             = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await hospitalsAPI.getHospitals()
        const raw = Array.isArray(res.data) ? res.data : []
        setHospitals(raw.map(normalise).filter(h => h.lat && h.lng))
      } catch (e) {
        console.error('Hospitals load error:', e)
        setHospitals([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Simple distance filter — if distance is null show all
  const visible = hospitals.filter(h =>
    h.distance === null || h.distance <= selectedRadius
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BuildingOffice2Icon className="w-6 h-6 text-emerald-400" />
            Nearby Hospitals
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Medical facilities in Ahmedabad
            {!loading && ` · ${hospitals.length} found`}
          </p>
        </div>

        {/* Radius filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Show within:</span>
          {RADII.map(r => (
            <button
              key={r}
              onClick={() => setSelectedRadius(r)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
                selectedRadius === r
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
              )}
            >
              {r} km
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="glass-card h-96 flex items-center justify-center">
          <LoadingSpinner text="Loading hospitals..." />
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4" style={{ minHeight: 500 }}>
          {/* Map */}
          <div className="glass-card overflow-hidden" style={{ height: '55vh', minHeight: 400 }}>
            <HospitalMap
              hospitals={visible}
              selectedHospital={selected}
              height="100%"
            />
          </div>

          {/* List */}
          <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: '55vh' }}>
            <p className="text-sm text-gray-400 flex-shrink-0">
              {visible.length} hospital{visible.length !== 1 ? 's' : ''} shown
            </p>

            {visible.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <BuildingOffice2Icon className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">No hospitals found in this range</p>
              </div>
            ) : (
              visible.map(h => (
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
                      {/* Name + emergency badge */}
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-semibold text-white text-sm">{h.name}</p>
                        {h.emergency && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-medium">
                            Emergency
                          </span>
                        )}
                      </div>
                      {/* Address */}
                      {h.address && (
                        <p className="text-xs text-gray-400 flex items-center gap-1 mb-0.5">
                          <MapPinIcon className="w-3 h-3 flex-shrink-0" />
                          {h.address}
                        </p>
                      )}
                      {/* Phone */}
                      {h.phone && (
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <PhoneIcon className="w-3 h-3 flex-shrink-0" />
                          {h.phone}
                        </p>
                      )}
                    </div>
                    {/* Distance */}
                    {h.distance != null && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-emerald-400">
                          {h.distance.toFixed(1)} km
                        </p>
                        <p className="text-xs text-gray-500">away</p>
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
