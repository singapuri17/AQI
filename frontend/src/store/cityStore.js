import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// City centre coordinates for map defaults
export const CITY_CENTRES = {
  Ahmedabad: { lat: 23.0225, lng: 72.5714 },
  Surat:     { lat: 21.1702, lng: 72.8311 },
  Vadodara:  { lat: 22.3072, lng: 73.1812 },
}

export const CITIES = ['Ahmedabad', 'Surat', 'Vadodara']

export const useCityStore = create(
  persist(
    (set) => ({
      selectedCity: 'Ahmedabad',
      setCity: (city) => set({ selectedCity: city }),
    }),
    { name: 'aqi-city-store' }
  )
)
