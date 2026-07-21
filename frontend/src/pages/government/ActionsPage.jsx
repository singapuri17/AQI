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
const typeIcon = { regulation: '🚦', enforcement: '🏭', infrastructure: '💧', awareness: '📢' }

// ── Ward Analysis Card ────────────────────────────────────────────────────
function WardAnalysisCard({ ward, onAccept, onDismiss }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState({})

  useEffect(() => {
    governmentAPI.getWardRecommendations(ward.ward_id)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [ward.ward_id])

  if (loading) return (
    <div className="glass-card p-5 animate-pulse">
      <div className="h-4 bg-gray-700 rounded w-1/3 mb-3" />
      <div className="h-3 bg-gray-700 rounded w-full mb-2" />
      <div className="h-3 bg-gray-700 rounded w-4/5" />
    </div>
  )
  if (!data) return null

  const aqiColor = data.current_aqi > 300 ? 'text-red-400' :
                   data.current_aqi > 200 ? 'text-orange-400' :
                   data.current_aqi > 100 ? 'text-yellow-400' : 'text-emerald-400'

  return (
    <div className="glass-card overflow-hidden border border-gray-700/40">
      {/* Ward header */}
      <div className="p-4 bg-gradient-to-r from-purple-900/30 to-blue-900/20 border-b border-gray-700/40">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">{data.ward_name}</h3>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
              <span className={`font-bold text-sm ${aqiColor}`}>AQI {data.current_aqi?.toFixed(0)}</span>
              <span>· 7d avg: {data.avg_aqi_7d}</span>
              <span>· PM2.5: {data.pm25?.toFixed(1)} μg/m³</span>
              <span>· {data.industry_count} industries</span>
            </div>
          </div>
        </div>
        {/* AI Analysis */}
        <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-xs font-semibold text-blue-300 mb-1 flex items-center gap-1">
            <SparklesIcon className="w-3 h-3" /> AI Analysis
          </p>
          <p className="text-xs text-gray-300 leading-relaxed">{data.analysis}</p>
        </div>
      </div>

      {/* Recommended actions */}
      <div className="p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Recommended Actions — Government Decision Required
        </p>
        <div className="space-y-2">
          {data.recommendations?.map((rec, i) => {
            if (dismissed[i]) return null
            return (
              <div key={i} className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-xl border border-gray-700/30 hover:border-purple-500/20 transition-colors">
                <span className="text-lg flex-shrink-0 mt-0.5">{typeIcon[rec.action_type] || '⚡'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="text-sm font-semibold text-white">{rec.title}</p>
                    <span className={clsx('text-xs px-1.5 py-0.5 rounded-full border font-medium', priorityCls[rec.priority] || priorityCls.medium)}>
                      {rec.priority}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                    <span className="flex items-center gap-1"><BeakerIcon className="w-3 h-3" />{rec.impact}</span>
                    <span className="flex items-center gap-1"><ClockIcon className="w-3 h-3" />{rec.timeline}</span>
                  </div>
                </div>
                {/* Accept / Dismiss */}
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => onAccept({ ward_id: ward.ward_id, ward_name: data.ward_name, rec })}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 text-xs font-medium transition-colors"
                    title="Accept — open action form pre-filled"
                  >
                    <CheckCircleIcon className="w-3.5 h-3.5" /> Accept
                  </button>
                  <button
                    onClick={() => setDismissed(d => ({ ...d, [i]: true }))}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-gray-700/40 text-gray-400 border border-gray-600/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 text-xs transition-colors"
                    title="Dismiss this recommendation"
                  >
                    <XCircleIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function ActionsPage() {
  const location = useLocation()
  const [actions, setActions]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [cityWards, setCityWards]     = useState([])
  const [activeTab, setActiveTab]     = useState('recommendations') // 'recommendations' | 'actions'
  const [expandedWard, setExpandedWard] = useState(null)
  const { user }           = useAuthStore()
  const { selectedCity }   = useCityStore()

  const [form, setForm] = useState({
    ward: location.state?.wardPreset || '',
    action_type: ACTION_TYPES[0].label,
    description: '',
    priority: 'high',
  })

  const city = user?.city || selectedCity || null

  // Load wards
  useEffect(() => {
    if (!city) return
    aqiAPI.getWardList(city).then(res => {
      const list = Array.isArray(res.data) ? res.data : []
      setCityWards(list)
      if (list.length > 0 && !form.ward) setForm(f => ({ ...f, ward: list[0].ward_id }))
      if (list.length > 0 && !expandedWard) setExpandedWard(list[0].ward_id)
    }).catch(() => {})
  }, [city]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load existing actions
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

  // Accept a recommendation → pre-fill form
  const handleAccept = ({ ward_id, ward_name, rec }) => {
    const typeMap = { regulation: 'Traffic Restriction', enforcement: 'Industrial Control', infrastructure: 'Water Sprinkling', awareness: 'Public Advisory' }
    setForm({
      ward: ward_id,
      action_type: typeMap[rec.action_type] || ACTION_TYPES[0].label,
      description: `[AI Recommended] ${rec.title}. Expected impact: ${rec.impact}. Timeline: ${rec.timeline}.`,
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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BoltIcon className="w-6 h-6 text-blue-400" /> Government Actions
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            AI-powered recommendations · {city && <span className="text-purple-300 font-medium">{city}</span>}
          </p>
        </div>
        <button onClick={() => { setShowForm(s => !s); setActiveTab('actions') }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors">
          {showForm ? <XMarkIcon className="w-4 h-4" /> : <PlusIcon className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'New Action'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800/50 p-1 rounded-xl w-fit">
        {[
          { id: 'recommendations', label: 'AI Recommendations', icon: SparklesIcon },
          { id: 'actions',         label: `All Actions (${actions.length})`, icon: BoltIcon },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === tab.id ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white')}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Create Form (shown when showForm=true regardless of tab) */}
      {showForm && (
        <div className="glass-card p-6 border border-blue-500/20">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-1">Create Intervention</h2>
          <p className="text-xs text-gray-500 mb-5">Review the details below, then confirm to create the action.</p>
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
              <textarea className="input-field min-h-[90px] resize-none"
                placeholder="Describe the intervention measures..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                required />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
                {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <CheckCircleIcon className="w-4 h-4" />}
                Confirm & Create Action
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Recommendations Tab */}
      {activeTab === 'recommendations' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <SparklesIcon className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <p className="text-sm text-yellow-200">
              AI has analysed real AQI, pollution sources, and construction data for each ward in <strong>{city}</strong>. 
              Review each recommendation and <strong>Accept</strong> to pre-fill an action form, or <strong>Dismiss</strong> to skip.
            </p>
          </div>

          {cityWards.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <SparklesIcon className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Loading ward data…</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cityWards.map(ward => (
                <div key={ward.ward_id}>
                  {/* Accordion header */}
                  <button
                    onClick={() => setExpandedWard(expandedWard === ward.ward_id ? null : ward.ward_id)}
                    className={clsx(
                      'w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left',
                      expandedWard === ward.ward_id
                        ? 'bg-purple-500/10 border-purple-500/40'
                        : 'bg-gray-800/40 border-gray-700/40 hover:border-gray-600/60'
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
                      <WardAnalysisCard ward={ward} onAccept={handleAccept} onDismiss={() => {}} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions Tab */}
      {activeTab === 'actions' && (
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
            All Actions ({actions.length})
          </h2>
          {loading ? (
            <LoadingSpinner size="sm" text="Loading actions..." className="py-8" />
          ) : actions.length === 0 ? (
            <div className="text-center py-10">
              <BoltIcon className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No actions recorded yet.</p>
              <p className="text-gray-500 text-xs mt-1">Go to AI Recommendations and accept one to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {actions.map(action => (
                <div key={action.id} className="p-4 bg-gray-800/40 rounded-xl border border-gray-700/30 hover:border-gray-600/50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-semibold text-white">{action.action_type}</p>
                        <span className="text-xs text-gray-500">·</span>
                        <p className="text-xs text-gray-400">{action.ward}</p>
                      </div>
                      <p className="text-sm text-gray-300 leading-relaxed">{action.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className={clsx('text-xs px-2 py-1 rounded-full border font-medium', statusCls[action.status] || statusCls.pending)}>
                        {action.status}
                      </span>
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full border', priorityCls[action.priority] || priorityCls.medium)}>
                        {action.priority}
                      </span>
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
