import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  MagnifyingGlassIcon,
  MapPinIcon,
  ChevronDownIcon,
  CheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { useCityStore, CITIES, detectCityFromCoords } from '../../store/cityStore'
import clsx from 'clsx'
import toast from 'react-hot-toast'

export default function CitySelector({ className = '' }) {
  const { selectedCity, setCity, setUserLocation, clearUserLocation } = useCityStore()
  const [open, setOpen]           = useState(false)
  const [locating, setLocating]   = useState(false)
  // Position state for the portal dropdown
  const [dropdownStyle, setDropdownStyle] = useState({})
  const triggerRef = useRef(null)

  // Recalculate position whenever the dropdown opens
  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setDropdownStyle({
      position: 'fixed',
      top:      rect.bottom + 6,
      left:     rect.left,
      width:    Math.max(rect.width, 192), // at least 192 px (w-48)
      zIndex:   9999,
    })
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (triggerRef.current && triggerRef.current.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on scroll / resize so the dropdown doesn't drift
  useEffect(() => {
    if (!open) return
    function close() { setOpen(false) }
    window.addEventListener('scroll',  close, true)
    window.addEventListener('resize',  close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const handleSelect = (city) => {
    // Clear any GPS override so searches/map use the selected city's centre
    clearUserLocation()
    setCity(city)
    setOpen(false)
  }

  const handleGeolocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.')
      return
    }
    setLocating(true)
    setOpen(false)

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        // Save exact GPS coords for map centring and nearby searches
        const loc = { lat: coords.latitude, lng: coords.longitude }
        setUserLocation(loc)

        // Reverse-geocode only to determine the city for AQI data
        const detected = await detectCityFromCoords(coords.latitude, coords.longitude)
        setLocating(false)
        if (detected) {
          setCity(detected)
          toast.success(`Switched to ${detected}`)
        } else {
          toast(
            (t) => (
              <span className="flex items-center gap-2 text-sm">
                <ExclamationTriangleIcon className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                Your location isn't in our dataset. Showing Ahmedabad.
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="ml-auto text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </span>
            ),
            { duration: 5000 }
          )
          setCity('Ahmedabad')
        }
      },
      () => {
        setLocating(false)
        toast.error('Could not access your location. Check browser permissions.')
      },
      { timeout: 10000, enableHighAccuracy: false }
    )
  }

  const dropdown = open && createPortal(
    <div
      style={dropdownStyle}
      className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl overflow-hidden"
    >
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider px-3 pt-3 pb-1.5">
        Select City
      </p>
      {CITIES.map(city => (
        <button
          key={city}
          onMouseDown={(e) => {
            // Use onMouseDown so the click fires before the outside-click handler
            e.preventDefault()
            handleSelect(city)
          }}
          className={clsx(
            'w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors',
            city === selectedCity
              ? 'text-blue-400 bg-blue-500/10'
              : 'text-gray-200 hover:bg-gray-700/60'
          )}
        >
          {city}
          {city === selectedCity && <CheckIcon className="w-4 h-4" />}
        </button>
      ))}
    </div>,
    document.body
  )

  return (
    <div className={clsx('relative flex items-center gap-2', className)}>
      {/* City dropdown trigger */}
      <button
        ref={triggerRef}
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-800/70 border border-gray-700/60 hover:border-blue-500/50 text-white text-sm font-medium transition-all min-w-[160px]"
      >
        <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span className="flex-1 text-left">{selectedCity}</span>
        <ChevronDownIcon
          className={clsx('w-4 h-4 text-gray-400 transition-transform', open && 'rotate-180')}
        />
      </button>

      {/* Use My Location button */}
      <button
        onClick={handleGeolocation}
        disabled={locating}
        title="Detect my city from GPS"
        className={clsx(
          'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all',
          locating
            ? 'bg-blue-600/20 border-blue-500/40 text-blue-400 cursor-wait'
            : 'bg-gray-800/70 border-gray-700/60 text-gray-300 hover:border-blue-500/50 hover:text-white'
        )}
      >
        {locating ? (
          <>
            <span className="w-4 h-4 border-2 border-blue-400/40 border-t-blue-400 rounded-full animate-spin" />
            <span className="hidden sm:inline">Locating…</span>
          </>
        ) : (
          <>
            <MapPinIcon className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Use My Location</span>
          </>
        )}
      </button>

      {/* Dropdown rendered in a portal so it escapes any overflow:hidden parent */}
      {dropdown}
    </div>
  )
}
