export function getAQICategory(value) {
  if (value === null || value === undefined) {
    return { label: 'Unknown', color: '#6b7280', bgColor: 'bg-gray-500', textColor: 'text-gray-300', description: 'No data available' }
  }
  const v = Number(value)
  if (v <= 50) return {
    label: 'Good',
    color: '#10b981',
    bgColor: 'bg-emerald-500',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-500',
    description: 'Air quality is satisfactory and poses little or no risk.',
    gradient: 'from-emerald-500 to-green-400'
  }
  if (v <= 100) return {
    label: 'Moderate',
    color: '#fbbf24',
    bgColor: 'bg-yellow-500',
    textColor: 'text-yellow-400',
    borderColor: 'border-yellow-500',
    description: 'Acceptable air quality; some pollutants may affect sensitive individuals.',
    gradient: 'from-yellow-500 to-amber-400'
  }
  if (v <= 150) return {
    label: 'Unhealthy for Sensitive Groups',
    color: '#f97316',
    bgColor: 'bg-orange-500',
    textColor: 'text-orange-400',
    borderColor: 'border-orange-500',
    description: 'Sensitive groups may experience health effects. General public is less likely to be affected.',
    gradient: 'from-orange-500 to-amber-500'
  }
  if (v <= 200) return {
    label: 'Unhealthy',
    color: '#ef4444',
    bgColor: 'bg-red-500',
    textColor: 'text-red-400',
    borderColor: 'border-red-500',
    description: 'Everyone may experience health effects; sensitive groups may experience more serious effects.',
    gradient: 'from-red-500 to-rose-400'
  }
  if (v <= 300) return {
    label: 'Very Unhealthy',
    color: '#a855f7',
    bgColor: 'bg-purple-500',
    textColor: 'text-purple-400',
    borderColor: 'border-purple-500',
    description: 'Health alert: Everyone may experience more serious health effects.',
    gradient: 'from-purple-500 to-violet-400'
  }
  return {
    label: 'Hazardous',
    color: '#881337',
    bgColor: 'bg-rose-900',
    textColor: 'text-rose-300',
    borderColor: 'border-rose-800',
    description: 'Health warning of emergency conditions. Everyone is likely to be affected.',
    gradient: 'from-rose-900 to-red-800'
  }
}

export function getAQIColor(value) {
  return getAQICategory(value).color
}

export function getRiskColor(category) {
  const map = {
    Low: '#10b981',
    Moderate: '#fbbf24',
    High: '#f97316',
    Severe: '#ef4444',
    Critical: '#881337',
  }
  return map[category] || '#6b7280'
}

export function getRiskBgClass(category) {
  const map = {
    Low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    Moderate: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    High: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    Severe: 'bg-red-500/20 text-red-400 border-red-500/30',
    Critical: 'bg-rose-900/40 text-rose-300 border-rose-800/50',
  }
  return map[category] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
}

export function formatAQI(value) {
  if (value === null || value === undefined) return '--'
  return Math.round(Number(value)).toString()
}

export function getAQIPercentage(value) {
  return Math.min((Number(value) / 400) * 100, 100)
}

export const AQI_LEVELS = [
  { range: '0-50', label: 'Good', color: '#10b981' },
  { range: '51-100', label: 'Moderate', color: '#fbbf24' },
  { range: '101-150', label: 'USG', color: '#f97316' },
  { range: '151-200', label: 'Unhealthy', color: '#ef4444' },
  { range: '201-300', label: 'Very Unhealthy', color: '#a855f7' },
  { range: '301+', label: 'Hazardous', color: '#881337' },
]
