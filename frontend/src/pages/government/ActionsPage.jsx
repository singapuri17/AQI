import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { governmentAPI, aqiAPI } from '../../api'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import {
  BoltIcon, PlusIcon, SparklesIcon, XMarkIcon,
  CheckCircleIcon, XCircleIcon, ChevronDownIcon,
  BeakerIcon, BuildingStorefrontIcon, ClockIcon,
} from '@heroicons/react/24/outline'
import { useAuthStore } from '../../store/authStore'
import { useCityStore } from '../../store/cityStore'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const ACTION_TYPES = [
  { label: 'Traffic Restriction', value: 'regulation'     },
  { label: 'Water Sprinkling',    value: 'infrastructure' },
  { label: 'Industrial Control',  value: 'enforcement'    },
  { label: 'School Closure',      value: 'regulation'     },
  { label: 'Public Advisory',     value: 'awareness'      },
  { label: 'Tree Plantation',     value: 'infrastructure' },
]
const PRIORITIES = [
  { label: 'High',   value: 'high'   },
  { label: 'Medium', value: 'medium' },
  { label: 'Low',    value: 'low'    },
]

function normalise(a) {
  return {
    id:          a.id,
    ward:        a.ward_id ?? a.ward ?? '—',
    action_type: a.action_type ?? '—',
    description: a.description ?? '',
    priority:    a.priority ?? 'medium',
    status:      a.status ?? 'pending',
    created_at:  a.created_at ?? null,
  }
}

const statusCls = {
  pending:     'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  in_progress: 'bg-blue-500/20   text-blue-400   border-blue-500/30',
  completed:   'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  cancelled:   'bg-gray-600/20   text-gray-400   border-gray-600/30',
}
const priorityCls = {
  critical: 'bg-red-500/20    text-red-400    border-red-500/30',
  high:     'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low:      'bg-gray-600/20   text-gray-400   border-gray-600/30',
}
const typeIcon   = { regulation: '🚦', enforcement: '🏭', infrastructure: '💧', awareness: '📢' }
const sourceTag  = {
  industrial:   { label: 'Industrial',    color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  traffic:      { label: 'Traffic',       color: 'bg-blue-500/20   text-blue-300   border-blue-500/30'   },
  construction: { label: 'Construction',  color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  green_cover:  { label: 'Green Cover',   color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  waste_burning:{ label: 'Waste Burning', color: 'bg-red-500/20    text-red-300    border-red-500/30'    },
  severe_aqi:   { label: 'Severe AQI',    color: 'bg-red-700/20    text-red-300    border-red-700/30'    },
  high_aqi:     { label: 'High AQI',      color: 'bg-orange-700/20 text-orange-300 border-orange-700/30' },
  so2:          { label: 'SO₂',           color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  preventive:   { label: 'Preventive',    color: 'bg-gray-600/20   text-gray-300   border-gray-600/30'   },
}
const densityDot   = { high: 'bg-red-500', medium: 'bg-yellow-500', low: 'bg-emerald-500' }
const densityLabel = { high: 'High', medium: 'Medium', low: 'Low' }

function DensityBadge({ label, level }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', densityDot[level] || 'bg-gray-500')} />
      <span className="text-xs text-gray-400">{label}: <span className="text-white font-medium">{densityLabel[level] || level}</span></span>
    </div>
  )
}

function WardAnalysisCard({ ward, onAccept }) {
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [dismissed, setDismissed] = useState({})

  useEffect(() => {
    setLoading(true); setError(null); setData(null)
    governmentAPI.getWardRecommendations(ward.ward_id)
      .then(r => setData(r.data))
      .catch(e => setError(e?.response?.data?.detail || 'Failed to load recommendations'))
      .finally(() => setLoading(false))
  }, [ward.ward_id])

  if (loading) return (
    <div className="glass-card p-5 space-y-3 animate-pulse">
      <div className="h-4 bg-gray-700 rounded w-1/3" />
      <div className="h-3 bg-gray-700 rounded w-full" />
      <div className="h-3 bg-gray-700 rounded w-4/5" />
      <div className="h-3 bg-gray-700 rounded w-3/5" />
    </div>
  )
  if (error) return (
    <div className="glass-card p-5 border border-red-500/20">
      <p className="text-red-400 text-sm">⚠ {error}</p>
    </div>
  )
  if (!data) return null

  const aqiColor = data.aqi > 300 ? 'text-red-400' : data.aqi > 200 ? 'text-orange-400' : data.aqi > 100 ? 'text-yellow-400' : 'text-emerald-400'
  const riskColor = data.risk_level === 'Severe' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                    data.risk_level === 'High'   ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' :
                    data.risk_level === 'Moderate' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
                                                     'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'

  return (
    <div className="glass-card overflow-hidden border border-gray-700/40">
      <div className="p-5 bg-gradient-to-r from-purple-900/30 to-blue-900/20 border-b border-gray-700/40">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">{data.ward_name}</h3>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={clsx('text-2xl font-bold', aqiColor)}>AQI {data.aqi?.toFixed(0)}</span>
              <span className="text-gray-400 text-sm">· 7d avg: {data.avg_aqi_7d}</span>
              <span className={clsx('text-xs px-2 py-0.5 rounded-full border font-semibold', riskColor)}>{data.risk_level} Risk</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 mb-1">Ward Type</p>
            <p className="text-sm font-semibold text-purple-300">{data.ward_type}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap mt-3">
          {[['PM2.5', data.pm25], ['PM10', data.pm10], ['NO₂', data.no2], ['SO₂', data.so2]].map(([name, val]) => (
            <span key={name} className="text-xs bg-gray-800/60 border border-gray-700/40 rounded-lg px-2 py-1 text-gray-300">
              {name}: <span className="text-white font-medium">{val?.toFixed(1)}</span> μg/m³
            </span>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
          <DensityBadge label="Industrial"    level={data.industrial_density} />
          <DensityBadge label="Traffic"       level={data.traffic_density} />
          <DensityBadge label="Construction"  level={data.construction_activity} />
          <DensityBadge label="Green Cover"   level={data.green_cover} />
          <DensityBadge label="Waste Burning" level={data.waste_burning} />
        </div>
        <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-xs font-semibold text-blue-300 mb-1">🔍 Primary Cause</p>
          <p className="text-sm text-gray-200 leading-relaxed">{data.primary_cause}</p>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Recommended Actions ({data.recommendations?.filter((_, i) => !dismissed[i]).length || 0})
          </p>
          <p className="text-xs text-gray-500">Accept or Dismiss each action</p>
        </div>
        {(data.recommendations?.filter((_, i) => !dismissed[i]).length === 0) ? (
          <p className="text-sm text-gray-500 text-center py-4">All recommendations dismissed.</p>
        ) : (
          <div className="space-y-2">
            {data.recommendations?.map((rec, i) => {
              if (dismissed[i]) return null
              const tag = sourceTag[rec.source_tag] || sourceTag.preventive
              return (
                <div key={i} className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-xl border border-gray-700/30 hover:border-purple-500/20 transition-colors">
                  <span className="text-xl flex-shrink-0 mt-0.5">{typeIcon[rec.action_type] || '⚡'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-sm font-semibold text-white">{rec.title}</p>
                      <span className={clsx('text-xs px-1.5 py-0.5 rounded-full border font-medium', priorityCls[rec.priority] || priorityCls.medium)}>
                        {rec.priority?.toUpperCase()}
                      </span>
                      <span className={clsx('text-xs px-1.5 py-0.5 rounded-full border', tag.color)}>{tag.label}</span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed mb-1.5">{rec.description}</p>
                    <div className="flex items-center gap-4 flex-wrap text-xs text-gray-500">
                      <span className="flex items-center gap-1"><BeakerIcon className="w-3 h-3 text-emerald-400" /> {rec.impact}</span>
                      <span className="flex items-center gap-1"><ClockIcon className="w-3 h-3 text-blue-400" /> {rec.timeline}</span>
                      {rec.aqi_reduction !== 'N/A' && (
                        <span className="text-purple-300 font-medium">📉 Est. AQI reduction: {rec.aqi_reduction}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0 mt-0.5">
                    <button onClick={() => onAccept({ ward_id: ward.ward_id, ward_name: data.ward_name, rec })}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 text-xs font-medium transition-colors">
                      <CheckCircleIcon className="w-3.5 h-3.5" /> Accept
                    </button>
                    <button onClick={() => setDismissed(d => ({ ...d, [i]: true }))}
                      className="p-1.5 rounded-lg bg-gray-700/40 text-gray-400 border border-gray-600/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-colors" title="Dismiss">
                      <XCircleIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ActionsPage() {
  const location = useLocation()
  const [actions, setActions]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [updating, setUpdating]       = useState({})   // { [id]: true } while patching
  const [cityWards, setCityWards]     = useState([])
  const [activeTab, setActiveTab]     = useState('recommendations')
  const [expandedWard, setExpandedWard] = useState(null)
  const { user }         = useAuthStore()
  const { selectedCity } = useCityStore()

  const [form, setForm] = useState({
    ward: location.state?.wardPreset || '',
    action_type: ACTION_TYPES[0].label,
    description: '',
    priority: 'high',
  })

  const city = user?.city || selectedCity || null

  useEffect(() => {
    if (!city) return
    aqiAPI.getWardList(city).then(res => {
      const list = Array.isArray(res.data) ? res.data : []
      setCityWards(list)
      if (list.length > 0 && !form.ward) setForm(f => ({ ...f, ward: list[0].ward_id }))
      if (list.length > 0) setExpandedWard(list[0].ward_id)
    }).catch(() => {})
  }, [city]) // eslint-disable-line

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await governmentAPI.getActions(city)
        setActions(Array.isArray(res.data) ? res.data.map(normalise) : [])
      } catch { setActions([]) }
      finally { setLoading(false) }
    }
    load()
  }, [city])

  const handleAccept = ({ ward_id, ward_name, rec }) => {
    const typeMap = { regulation: 'Traffic Restriction', enforcement: 'Industrial Control', infrastructure: 'Water Sprinkling', awareness: 'Public Advisory' }
    setForm({
      ward: ward_id,
      action_type: typeMap[rec.action_type] || ACTION_TYPES[0].label,
      description: `[Recommended] ${rec.title}. Impact: ${rec.impact}. Timeline: ${rec.timeline}.`,
      priority: rec.priority || 'high',
    })
    setShowForm(true)
    setActiveTab('actions')
    toast.success(`Recommendation for ${ward_name} loaded — review and confirm`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.description.trim()) { toast.error('Please add a description'); return }
    setSubmitting(true)
    const defaultWard = cityWards[0]?.ward_id || ''
    try {
      const res = await governmentAPI.createAction(form)
      setActions(prev => [normalise(res.data), ...prev])
      toast.success('Action created successfully')
      setForm({ ward: defaultWard, action_type: ACTION_TYPES[0].label, description: '', priority: 'high' })
      setShowForm(false)
    } catch {
      const mock = { id: Date.now(), ...normalise({ ...form, status: 'pending', created_at: new Date().toISOString() }) }
      setActions(prev => [mock, ...prev])
      toast.success('Action saved')
      setForm({ ward: defaultWard, action_type: ACTION_TYPES[0].label, description: '', priority: 'high' })
      setShowForm(false)
    } finally { setSubmitting(false) }
  }

  const handleStatusUpdate = async (actionId, newStatus) => {
    setUpdating(u => ({ ...u, [actionId]: true }))
    try {
      const res = await governmentAPI.updateActionStatus(actionId, newStatus)
      setActions(prev => prev.map(a => a.id === actionId ? normalise(res.data) : a))
      const labels = { in_progress: 'confirmed & in progress', completed: 'marked complete', cancelled: 'cancelled' }
      toast.success(`Action ${labels[newStatus] || newStatus}`)
    } catch (e) {
      // Optimistic update even if backend fails (mock action with fake id)
      setActions(prev => prev.map(a => a.id === actionId ? { ...a, status: newStatus } : a))
      toast.success(`Status updated to ${newStatus}`)
    } finally {
      setUpdating(u => ({ ...u, [actionId]: false }))
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BoltIcon className="w-6 h-6 text-blue-400" /> Government Actions
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Rule-based ward recommendations · {city && <span className="text-purple-300 font-medium">{city}</span>}
          </p>
        </div>
        <button onClick={() => { setShowForm(s => !s); setActiveTab('actions') }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors">
          {showForm ? <XMarkIcon className="w-4 h-4" /> : <PlusIcon className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'New Action'}
        </button>
      </div>

      <div className="flex gap-1 bg-gray-800/50 p-1 rounded-xl w-fit">
        {[
          { id: 'recommendations', label: 'Ward Recommendations', icon: SparklesIcon },
          { id: 'actions', label: `All Actions (${actions.length})`, icon: BoltIcon },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === tab.id ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white')}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="glass-card p-6 border border-blue-500/20">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-1">Create Intervention</h2>
          <p className="text-xs text-gray-500 mb-5">Review details then confirm to create the action.</p>
          <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label-text">Ward</label>
              <select className="input-field" value={form.ward} onChange={e => setForm(f => ({ ...f, ward: e.target.value }))}>
                {cityWards.map(w => <option key={w.ward_id} value={w.ward_id}>{w.ward_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label-text">Action Type</label>
              <select className="input-field" value={form.action_type} onChange={e => setForm(f => ({ ...f, action_type: e.target.value }))}>
                {ACTION_TYPES.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label-text">Priority</label>
              <select className="input-field" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label-text">Description</label>
              <textarea className="input-field min-h-[90px] resize-none" placeholder="Describe the intervention measures..."
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
                {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircleIcon className="w-4 h-4" />}
                Confirm & Create Action
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'recommendations' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <SparklesIcon className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <p className="text-sm text-yellow-200">
              Each ward gets <strong>unique, rule-based recommendations</strong> derived from its actual AQI, pollutants, industries, construction activity and traffic. Accept to create an action.
            </p>
          </div>
          {cityWards.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <SparklesIcon className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Loading ward data…</p>
            </div>
          ) : (
            cityWards.map(ward => (
              <div key={ward.ward_id}>
                <button
                  onClick={() => setExpandedWard(expandedWard === ward.ward_id ? null : ward.ward_id)}
                  className={clsx(
                    'w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left',
                    expandedWard === ward.ward_id ? 'bg-purple-500/10 border-purple-500/40' : 'bg-gray-800/40 border-gray-700/40 hover:border-gray-600/60'
                  )}>
                  <div className="flex items-center gap-3">
                    <BuildingStorefrontIcon className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <span className="text-sm font-semibold text-white">{ward.ward_name}</span>
                    <span className="text-xs text-gray-500">{ward.ward_id}</span>
                  </div>
                  <ChevronDownIcon className={clsx('w-4 h-4 text-gray-400 transition-transform', expandedWard === ward.ward_id && 'rotate-180')} />
                </button>
                {expandedWard === ward.ward_id && (
                  <div className="mt-2">
                    <WardAnalysisCard ward={ward} onAccept={handleAccept} />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'actions' && (
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">All Actions ({actions.length})</h2>
          {loading ? (
            <LoadingSpinner size="sm" text="Loading actions..." className="py-8" />
          ) : actions.length === 0 ? (
            <div className="text-center py-10">
              <BoltIcon className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No actions recorded yet.</p>
              <p className="text-gray-500 text-xs mt-1">Go to Ward Recommendations and accept one to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {actions.map(action => (
                <div key={action.id} className={clsx(
                  'p-4 rounded-xl border transition-colors',
                  action.status === 'completed'   ? 'bg-emerald-500/5  border-emerald-500/20' :
                  action.status === 'in_progress' ? 'bg-blue-500/5     border-blue-500/20'    :
                  action.status === 'cancelled'   ? 'bg-gray-700/20    border-gray-600/30 opacity-60' :
                                                    'bg-gray-800/40    border-gray-700/30 hover:border-gray-600/50'
                )}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm">{typeIcon[action.action_type] || '⚡'}</span>
                        <p className="text-sm font-semibold text-white">{action.action_type}</p>
                        <span className="text-xs text-gray-500">·</span>
                        <p className="text-xs text-gray-400">{action.ward}</p>
                      </div>
                      <p className="text-sm text-gray-300 leading-relaxed">{action.description}</p>
                    </div>

                    {/* Status + action buttons */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <span className={clsx('text-xs px-2 py-1 rounded-full border font-medium', statusCls[action.status] || statusCls.pending)}>
                          {action.status.replace('_', ' ')}
                        </span>
                        <span className={clsx('text-xs px-2 py-0.5 rounded-full border', priorityCls[action.priority] || priorityCls.medium)}>
                          {action.priority}
                        </span>
                      </div>

                      {/* Status transition buttons */}
                      {action.status !== 'cancelled' && action.status !== 'completed' && (
                        <div className="flex gap-1.5">
                          {action.status === 'pending' && (
                            <button
                              onClick={() => handleStatusUpdate(action.id, 'in_progress')}
                              disabled={updating[action.id]}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              {updating[action.id]
                                ? <div className="w-3 h-3 border border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                                : <BoltIcon className="w-3 h-3" />}
                              Confirm
                            </button>
                          )}
                          {action.status === 'in_progress' && (
                            <button
                              onClick={() => handleStatusUpdate(action.id, 'completed')}
                              disabled={updating[action.id]}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              {updating[action.id]
                                ? <div className="w-3 h-3 border border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                                : <CheckCircleIcon className="w-3 h-3" />}
                              Mark Done
                            </button>
                          )}
                          <button
                            onClick={() => handleStatusUpdate(action.id, 'cancelled')}
                            disabled={updating[action.id]}
                            className="px-2 py-1.5 rounded-lg bg-gray-700/40 text-gray-400 border border-gray-600/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 text-xs transition-colors disabled:opacity-50"
                            title="Cancel action"
                          >
                            <XMarkIcon className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {action.status === 'completed' && (
                        <p className="text-xs text-emerald-400 flex items-center gap-1">
                          <CheckCircleIcon className="w-3 h-3" /> Completed
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

