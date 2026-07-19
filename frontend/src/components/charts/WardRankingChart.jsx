import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
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

export default function WardRankingChart({ data = [], title = 'Ward AQI Rankings' }) {
  return (
    <div className="glass-card p-5">
      {title && <h3 className="text-sm font-semibold text-gray-300 mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={Math.max(data.length * 36, 220)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#374151' }}
            domain={[0, 'dataMax + 20']}
          />
          <YAxis
            dataKey="ward"
            type="category"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={90}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="aqi" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={getAQIColor(entry.aqi)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
