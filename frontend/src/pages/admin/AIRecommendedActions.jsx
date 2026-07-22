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
