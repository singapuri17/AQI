import clsx from 'clsx'

export default function StatCard({ icon: Icon, title, value, subtitle, trend, trendValue, color = 'blue', className = '' }) {
  const colorMap = {
    blue: 'from-blue-600/20 to-blue-500/10 border-blue-500/20 text-blue-400',
    green: 'from-emerald-600/20 to-emerald-500/10 border-emerald-500/20 text-emerald-400',
    red: 'from-red-600/20 to-red-500/10 border-red-500/20 text-red-400',
    orange: 'from-orange-600/20 to-orange-500/10 border-orange-500/20 text-orange-400',
    purple: 'from-purple-600/20 to-purple-500/10 border-purple-500/20 text-purple-400',
    yellow: 'from-yellow-600/20 to-yellow-500/10 border-yellow-500/20 text-yellow-400',
  }

  const iconBgMap = {
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-emerald-500/20 text-emerald-400',
    red: 'bg-red-500/20 text-red-400',
    orange: 'bg-orange-500/20 text-orange-400',
    purple: 'bg-purple-500/20 text-purple-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
  }

  return (
    <div className={clsx(
      'glass-card p-5 bg-gradient-to-br border hover:scale-[1.02] transition-transform duration-200',
      colorMap[color] || colorMap.blue,
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-gray-400 text-sm font-medium mb-1">{title}</p>
          <p className="text-2xl font-bold text-white mb-1">{value}</p>
          {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={clsx('p-2.5 rounded-lg', iconBgMap[color] || iconBgMap.blue)}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      {trend !== undefined && (
        <div className="mt-3 flex items-center gap-1.5">
          <span className={clsx('text-xs font-medium', trend >= 0 ? 'text-red-400' : 'text-emerald-400')}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trendValue || trend)}
          </span>
          <span className="text-xs text-gray-500">vs yesterday</span>
        </div>
      )}
    </div>
  )
}
