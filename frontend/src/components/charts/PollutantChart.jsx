import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'

const POLLUTANT_COLORS = {
  'PM2.5': '#ef4444',
  'PM10': '#f97316',
  'NO2': '#fbbf24',
  'SO2': '#a855f7',
  'CO': '#3b82f6',
  'O3': '#10b981',
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 shadow-xl">
        <p className="text-xs text-gray-400 mb-1">{label}</p>
        <p className="text-sm font-bold text-white">{payload[0].value.toFixed(1)} μg/m³</p>
      </div>
    )
  }
  return null
}

export default function PollutantChart({ data = [], title = 'Pollutant Levels' }) {
  const chartData = data.length > 0 ? data : [
    { name: 'PM2.5', value: 0 },
    { name: 'PM10', value: 0 },
    { name: 'NO2', value: 0 },
    { name: 'SO2', value: 0 },
    { name: 'CO', value: 0 },
    { name: 'O3', value: 0 },
  ]

  return (
    <div className="glass-card p-5">
      {title && <h3 className="text-sm font-semibold text-gray-300 mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#374151' }}
          />
          <YAxis
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={POLLUTANT_COLORS[entry.name] || '#3b82f6'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
