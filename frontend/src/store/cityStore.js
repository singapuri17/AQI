import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Geographic centre of each supported city
export const CITY_CENTRES = {
  Ahmedabad: { lat: 23.0225, lng: 72.5714 },
  Surat:     { lat: 21.1702, lng: 72.8311 },
  Vadodara:  { lat: 22.3072, lng: 73.1812 },
}

// ward_id prefix used in the database for each city
export const CITY_WARD_PREFIX = {
  Ahmedabad: 'AMD_',
  Surat:     'SRT_',
  Vadodara:  'VDR_',
}

// Default map zoom level per city (all similar size, 12 works well)
export const CITY_ZOOM = {
  Ahmedabad: 12,
  Surat:     12,
  Vadodara:  12,
}

export const CITIES = ['Ahmedabad', 'Surat', 'Vadodara']

/**
 * Filter a flat array of ward records (from /aqi/current) to the given city.
 * Each ward object must have a ward_id field.
 */
export function filterWardsByCity(wards, city) {
  const prefix = CITY_WARD_PREFIX[city]
  if (!prefix) return wards
  return wards.filter(w => (w.ward_id ?? '').startsWith(prefix))
}

/**
 * Reverse-geocode a lat/lng to one of our supported cities.
 * Uses the Nominatim API (free, no key needed).
 * Resolves to a city name string, or null if not in our dataset.
 */
export async function detectCityFromCoords(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const data = await res.json()
    const rawCity =
      data?.address?.city ||
      data?.address?.town ||
      data?.address?.county ||
      data?.address?.state_district ||
      ''

    // Fuzzy match against our supported cities
    const lower = rawCity.toLowerCase()
    if (lower.includes('ahmedabad') || lower.includes('amdavad')) return 'Ahmedabad'
    if (lower.includes('surat'))     return 'Surat'
    if (lower.includes('vadodara') || lower.includes('baroda')) return 'Vadodara'
    return null
  } catch {
    return null
  }
}

export const useCityStore = create(
  persist(
    (set) => ({
      selectedCity: 'Ahmedabad',
      // Exact GPS coords from browser (if user allows)
      userLocation: null,
      setUserLocation: (loc) => set({ userLocation: loc }),
      clearUserLocation: () => set({ userLocation: null }),
      setCity: (city) => set({ selectedCity: city }),
      // Sync to user's registered city on login
      syncToUser: (user) => {
        if (user?.city && CITIES.includes(user.city)) {
          set({ selectedCity: user.city })
        }
      },
    }),
    { name: 'aqi-city-store' }
  )
)
