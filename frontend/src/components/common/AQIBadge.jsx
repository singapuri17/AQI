import { getAQICategory, formatAQI } from '../../utils/aqiUtils'

export default function AQIBadge({ value, showLabel = true, size = 'md' }) {
  const category = getAQICategory(value)

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  }[size] || 'text-sm px-3 py-1'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold border ${sizeStyles}`}
      style={{
        backgroundColor: `${category.color}22`,
        color: category.color,
        borderColor: `${category.color}44`,
      }}
    >
      <span className="font-bold">{formatAQI(value)}</span>
      {showLabel && <span className="opacity-90">{category.label}</span>}
    </span>
  )
}
