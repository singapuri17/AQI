import { getRiskColor } from '../../utils/aqiUtils'

export default function HealthRiskGauge({ score = 0, category = 'Low', size = 200 }) {
  const radius = size * 0.38
  const cx = size / 2
  const cy = size * 0.55
  const startAngle = Math.PI
  const endAngle = 0
  const angleRange = Math.PI
  const scoreAngle = startAngle - (score / 100) * angleRange
  const needleLength = radius * 0.85

  const arcPath = (r, start, end) => {
    const x1 = cx + r * Math.cos(start)
    const y1 = cy - r * Math.sin(start)
    const x2 = cx + r * Math.cos(end)
    const y2 = cy - r * Math.sin(end)
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`
  }

  const color = getRiskColor(category)

  const segments = [
    { start: Math.PI, end: Math.PI * 0.8, color: '#10b981' },
    { start: Math.PI * 0.8, end: Math.PI * 0.6, color: '#fbbf24' },
    { start: Math.PI * 0.6, end: Math.PI * 0.4, color: '#f97316' },
    { start: Math.PI * 0.4, end: Math.PI * 0.2, color: '#ef4444' },
    { start: Math.PI * 0.2, end: 0, color: '#881337' },
  ]

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.6}>
        {segments.map((seg, i) => (
          <path
            key={i}
            d={arcPath(radius, seg.start, seg.end)}
            fill="none"
            stroke={seg.color}
            strokeWidth={size * 0.09}
            strokeLinecap="butt"
            opacity={0.85}
          />
        ))}
        <path
          d={arcPath(radius, Math.PI, Math.PI - (score / 100) * Math.PI)}
          fill="none"
          stroke={color}
          strokeWidth={size * 0.09}
          strokeLinecap="butt"
          opacity={1}
        />
        <line
          x1={cx}
          y1={cy}
          x2={cx + needleLength * Math.cos(scoreAngle)}
          y2={cy - needleLength * Math.sin(scoreAngle)}
          stroke="white"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={size * 0.04} fill="white" />
      </svg>

      <div className="text-center -mt-2">
        <p className="text-4xl font-bold text-white">{Math.round(score)}</p>
        <p className="text-sm mt-1 font-semibold px-3 py-1 rounded-full border" style={{
          color,
          backgroundColor: `${color}22`,
          borderColor: `${color}44`,
        }}>
          {category} Risk
        </p>
      </div>
    </div>
  )
}
