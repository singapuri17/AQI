import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { getAQIColor } from '../../utils/aqiUtils'

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const predicted = payload.find(p => p.dataKey === 'predicted')?.value
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 shadow-xl">
        <p className="text-xs text-gray-400 mb-1">{label}</p>
        {predicted !== undefined && (
          <p className="text-sm font-bold" style={{ color: getAQIColor(predicted) }}>
            Predicted: {Math.round(predicted)}
          </p>
        )}
        {payload.find(p => p.dataKey === 'lower') && (
          <p className="text-xs text-gray-400">
            Range: {Math.round(payload.find(p => p.dataKey === 'lower')?.value)} – {Math.round(payload.find(p => p.dataKey === 'upper')?.value)}
          </p>
        )}
      </div>
    )
  }
  return null
}

export default function PredictionChart({ data = [], title = 'AQI Forecast' }) {
  return (
    <div className="glass-card p-5">
      {title && <h3 className="text-sm font-semibold text-gray-300 mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="predGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="confGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.0} />
            </linearGradient>
          </defs>
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
          <ReferenceLine y={50} stroke="#10b981" strokeDasharray="4 4" opacity={0.3} />
          <ReferenceLine y={100} stroke="#fbbf24" strokeDasharray="4 4" opacity={0.3} />
          <ReferenceLine y={150} stroke="#f97316" strokeDasharray="4 4" opacity={0.3} />
          {data[0]?.upper !== undefined && (
            <Area
              type="monotone"
              dataKey="upper"
              stroke="transparent"
              fill="url(#confGradient)"
              fillOpacity={1}
            />
          )}
          {data[0]?.lower !== undefined && (
            <Area
              type="monotone"
              dataKey="lower"
              stroke="transparent"
              fill="#1f2937"
              fillOpacity={1}
            />
          )}
          <Area
            type="monotone"
            dataKey="predicted"
            stroke="#3b82f6"
            strokeWidth={2.5}
            fill="url(#predGradient)"
            dot={{ fill: '#3b82f6', strokeWidth: 0, r: 3 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
