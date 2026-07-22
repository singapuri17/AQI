import { useCityStore } from '../../store/cityStore'
import { ActionsPageContent } from './ActionsPage'

export default function ActionsPage() {
  const { selectedCity } = useCityStore()

  return (
    <ActionsPageContent city={selectedCity} />
  )
}
