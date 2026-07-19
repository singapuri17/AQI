import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { getAQIColor } from '../../utils/aqiUtils'

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const value = payload[0].value
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 shadow-xl">
        <p className="text-xs text-gray-400 mb-1">{label}</p>
        <p className="text-sm font-bold" style={{ color: getAQIColor(value) }}>
          AQI: {Math.round(value)}
        </p>
      </div>
    )
  }
  return null
}

export default function AQITrendChart({ data = [], title = 'AQI Trend', color = '#3b82f6', height = 220 }) {
  return (
    <div className="glass-card p-5">
      {title && <h3 className="text-sm font-semibold text-gray-300 mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="time"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#374151' }}
          />
          <YAxis
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={50} stroke="#10b981" strokeDasharray="4 4" opacity={0.4} />
          <ReferenceLine y={100} stroke="#fbbf24" strokeDasharray="4 4" opacity={0.4} />
          <ReferenceLine y={150} stroke="#f97316" strokeDasharray="4 4" opacity={0.4} />
          <ReferenceLine y={200} stroke="#ef4444" strokeDasharray="4 4" opacity={0.4} />
          <Line
            type="monotone"
            dataKey="aqi"
            stroke={color}
            strokeWidth={2.5}
            dot={{ fill: color, strokeWidth: 0, r: 3 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
