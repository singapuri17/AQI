import { useEffect } from 'react'
import { useCityStore } from '../../store/cityStore'
import CitySelector from '../../components/common/CitySelector'
import { ActionsPageContent } from '../government/ActionsPage'

export default function AIRecommendedActions() {
  const { selectedCity } = useCityStore()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [selectedCity])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Recommended Actions</h1>
          <p className="text-gray-400 text-sm mt-1">
            Ward-level recommendations driven by AQI data and city context.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CitySelector showGeolocation={false} />
        </div>
      </div>

      <ActionsPageContent
        city={selectedCity}
        pageTitle="AI Recommended Actions"
        pageSubtitle="Review ward recommendations and convert them into government actions."
      />
    </div>
  )
}
