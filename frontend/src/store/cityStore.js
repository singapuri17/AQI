import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Geographic centre of each supported city
export const CITY_CENTRES = {
  Ahmedabad: { lat: 23.0225, lng: 72.5714 },
  Surat:     { lat: 21.1702, lng: 72.8311 },
  Vadodara:  { lat: 22.3072, lng: 73.1812 },
  Rajkot:    { lat: 22.3039, lng: 70.8022 },
  Gandhinagar: { lat: 23.2156, lng: 72.6369 },
}

// ward_id prefix used in the database for each city
export const CITY_WARD_PREFIX = {
  Ahmedabad:   'AMD_',
  Surat:       'SRT_',
  Vadodara:    'VDR_',
  Rajkot:      'RJK_',
  Gandhinagar: 'GNR_',
}

// Default map zoom level per city
export const CITY_ZOOM = {
  Ahmedabad:   12,
  Surat:       12,
  Vadodara:    12,
  Rajkot:      12,
  Gandhinagar: 12,
}

// Cities that have real data in the database
export const CITIES_WITH_DATA = ['Ahmedabad', 'Surat', 'Vadodara']

// All cities (including planned)
export const CITIES = ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar']

/**
 * Filter a flat array of ward records (from /aqi/current) to the given city.
 */
export function filterWardsByCity(wards, city) {
  const prefix = CITY_WARD_PREFIX[city]
  if (!prefix) return wards
  return wards.filter(w => (w.ward_id ?? '').startsWith(prefix))
}

/**
 * Reverse-geocode a lat/lng to one of our supported cities via Nominatim.
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
    const lower = rawCity.toLowerCase()
    if (lower.includes('ahmedabad') || lower.includes('amdavad')) return 'Ahmedabad'
    if (lower.includes('surat'))                                   return 'Surat'
    if (lower.includes('vadodara') || lower.includes('baroda'))    return 'Vadodara'
    if (lower.includes('rajkot'))                                  return 'Rajkot'
    if (lower.includes('gandhinagar'))                             return 'Gandhinagar'
    return null
  } catch {
    return null
  }
}

export const useCityStore = create(
  persist(
    (set) => ({
      selectedCity: 'Ahmedabad',
      userLocation: null,
      setUserLocation: (loc) => set({ userLocation: loc }),
      clearUserLocation: () => set({ userLocation: null }),
      setCity: (city) => set({ selectedCity: city }),
      syncToUser: (user) => {
        if (user?.city && CITIES.includes(user.city)) {
          set({ selectedCity: user.city })
        }
      },
    }),
    { name: 'aqi-city-store' }
  )
)
