/**
 * useAQIAlerts — computes AQI-level alerts and stores notification history.
 * Exported alert levels and helpers are reused across all alert components.
 */
import { useState, useEffect, useCallback } from 'react'

// ── Alert level definitions ────────────────────────────────────────────────
export const ALERT_LEVELS = [
  {
    min: 0, max: 100,
    level: 'safe',
    label: 'Good / Satisfactory',
    icon: '✅',
    color: '#22c55e',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/40',
    text: 'text-emerald-400',
    banner: 'bg-emerald-900/40',
    message: 'Air quality is satisfactory. Enjoy outdoor activities.',
    recommendations: [
      'Air quality is good — enjoy outdoor activities.',
      'No special precautions needed.',
    ],
  },
  {
    min: 101, max: 200,
    level: 'moderate',
    label: 'Moderate',
    icon: '⚠️',
    color: '#eab308',
    bg: 'bg-yellow-500/15',
    border: 'border-yellow-500/40',
    text: 'text-yellow-400',
    banner: 'bg-yellow-900/40',
    message: 'Moderate pollution detected. Sensitive groups should limit prolonged outdoor exposure.',
    recommendations: [
      'Sensitive people (asthma, heart conditions) should limit outdoor time.',
      'Keep windows closed during peak traffic hours.',
      'Reduce strenuous outdoor exercise.',
    ],
  },
  {
    min: 201, max: 300,
    level: 'unhealthy',
    label: 'Unhealthy',
    icon: '⚠️',
    color: '#f97316',
    bg: 'bg-orange-500/15',
    border: 'border-orange-500/40',
    text: 'text-orange-400',
    banner: 'bg-orange-900/40',
    message: 'Unhealthy air quality. Avoid prolonged outdoor exposure and wear a mask.',
    recommendations: [
      'Avoid prolonged outdoor activities.',
      'Wear a mask (at minimum a surgical mask) when going outside.',
      'Keep windows and doors closed.',
      'Use an air purifier indoors if available.',
      'Children and elderly should remain indoors.',
    ],
  },
  {
    min: 301, max: Infinity,
    level: 'severe',
    label: 'Severe / Hazardous',
    icon: '🚨',
    color: '#ef4444',
    bg: 'bg-red-500/15',
    border: 'border-red-500/40',
    text: 'text-red-400',
    banner: 'bg-red-900/40',
    message: 'Severe pollution alert. Stay indoors, avoid all outdoor exercise.',
    recommendations: [
      'Stay indoors as much as possible.',
      'Wear an N95/FFP2 mask if you must go outside.',
      'Close all windows and seal gaps.',
      'Children, elderly and those with health conditions must stay indoors.',
      'Avoid outdoor exercise completely.',
      'Keep pets indoors.',
      'Seek medical advice if you experience breathing difficulty.',
    ],
  },
]

export function getAlertLevel(aqi) {
  return ALERT_LEVELS.find(l => aqi >= l.min && aqi <= l.max) || ALERT_LEVELS[0]
}

export function getAQIColor(aqi) {
  return getAlertLevel(aqi).color
}

// ── Max AQI across wards ───────────────────────────────────────────────────
function computeMaxAQI(wards) {
  if (!wards || wards.length === 0) return 0
  return Math.max(...wards.map(w => w.aqi_value ?? w.aqi ?? 0))
}

function computeAvgAQI(wards) {
  if (!wards || wards.length === 0) return 0
  const vals = wards.map(w => w.aqi_value ?? w.aqi ?? 0).filter(v => v > 0)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
}

// ── Hook ──────────────────────────────────────────────────────────────────
const MAX_HISTORY = 20

export function useAQIAlerts(wards, city) {
  const [alerts, setAlerts]         = useState([])          // current active alerts
  const [history, setHistory]       = useState([])          // recent alert history
  const [unreadCount, setUnreadCount] = useState(0)
  const [showPopup, setShowPopup]   = useState(false)       // auto-popup for severe

  const markAllRead = useCallback(() => setUnreadCount(0), [])
  const dismissPopup = useCallback(() => setShowPopup(false), [])

  useEffect(() => {
    if (!wards || wards.length === 0) return

    const maxAQI  = computeMaxAQI(wards)
    const avgAQI  = computeAvgAQI(wards)
    const level   = getAlertLevel(avgAQI)

    // Find the worst ward
    const worstWard = wards.reduce((a, b) =>
      (a.aqi_value ?? a.aqi ?? 0) > (b.aqi_value ?? b.aqi ?? 0) ? a : b
    )
    const worstAQI  = worstWard.aqi_value ?? worstWard.aqi ?? 0
    const worstName = worstWard.ward_name ?? worstWard.name ?? 'Unknown'
    const worstLevel = getAlertLevel(worstAQI)

    const newAlerts = []

    // City-level alert (based on avg)
    if (avgAQI > 100) {
      newAlerts.push({
        id:       `city-${city}-${Date.now()}`,
        type:     'city',
        city,
        wardName: city,
        aqi:      Math.round(avgAQI),
        level,
        title:    `AQI Alert — ${city}`,
        message:  level.message,
        recommendations: level.recommendations,
        timestamp: new Date().toISOString(),
        read:     false,
      })
    }

    // Worst-ward alert (if different from city avg level and above moderate)
    if (worstAQI > 150 && worstLevel.level !== level.level) {
      newAlerts.push({
        id:       `ward-${worstWard.ward_id ?? worstName}-${Date.now()}`,
        type:     'ward',
        city,
        wardName: worstName,
        aqi:      Math.round(worstAQI),
        level:    worstLevel,
        title:    `🚨 AQI Alert — ${worstName}`,
        message:  worstLevel.message,
        recommendations: worstLevel.recommendations,
        timestamp: new Date().toISOString(),
        read:     false,
      })
    }

    setAlerts(newAlerts)

    if (newAlerts.length > 0) {
      setUnreadCount(n => n + newAlerts.length)
      setHistory(prev => {
        const combined = [...newAlerts, ...prev].slice(0, MAX_HISTORY)
        return combined
      })
      // Auto-popup only for severe level
      if (worstLevel.level === 'severe' || level.level === 'severe') {
        setShowPopup(true)
      }
    }
  }, [wards, city]) // eslint-disable-line

  return { alerts, history, unreadCount, showPopup, markAllRead, dismissPopup }
}
