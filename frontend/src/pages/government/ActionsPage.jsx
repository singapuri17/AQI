import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { governmentAPI, aqiAPI } from '../../api'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { BoltIcon, PlusIcon, SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '../../store/authStore'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const ACTION_TYPES = [
  { label: 'Traffic Restriction', value: 'regulation'      },
  { label: 'Water Sprinkling',    value: 'infrastructure'  },
  { label: 'Industrial Control',  value: 'enforcement'     },
  { label: 'School Closure',      value: 'regulation'      },
  { label: 'Public Advisory',     value: 'awareness'       },
  { label: 'Tree Plantation',     value: 'infrastructure'  },
]

const PRIORITIES = [
  { label: 'High',     value: 'high'     },
  { label: 'Medium',   value: 'medium'   },
  { label: 'Low',      value: 'low'      },
]

// Normalise a backend action record
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

// Static AI recommendations (fallback when Gemini key not set)
const FALLBACK_RECS = [
  { ward:'Naroda',  recommendation:'Implement 50% industrial capacity restriction 10 pm–6 am. Install continuous emission monitoring.', priority:'Critical' },
  { ward:'Vatva',   recommendation:'Deploy real-time sensor alerts for Chemical GIDC zone. Mandate green belt around perimeter.',        priority:'High'     },
  { ward:'Odhav',   recommendation:'Coordinate with traffic department for truck route diversions during winter months.',                priority:'High'     },
  { ward:'Vastral', recommendation:'Close municipal dump-site during peak morning hours. Enforce dust suppression at construction sites.',priority:'Medium'  },
]

export default function ActionsPage() {
  const location = useLocation()
  const [actions, setActions]               = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading]               = useState(true)
  const [showForm, setShowForm]             = useState(false)
  const [submitting, setSubmitting]         = useState(false)
  const [cityWards, setCityWards]           = useState([])
  const { user } = useAuthStore()

  const [form, setForm] = useState({
    ward:        location.state?.wardPreset || '',
    action_type: ACTION_TYPES[0].label,
    description: '',
    priority:    'high',
  })

  // Load wards for the user's city
  useEffect(() => {
    const city = user?.city || null
    aqiAPI.getWardList(city).then(res => {
      const list = Array.isArray(res.data) ? res.data : []
      setCityWards(list)
      if (list.length > 0 && !form.ward) {
        setForm(f => ({ ...f, ward: list[0].ward_id }))
      }
    }).catch(() => setCityWards([]))
  }, [user?.city]) // eslint-disable-line react-hooks/exhaustive-deps
  // Load actions filtered by city
  useEffect(() => {
    const city = user?.city || null
    const load = async () => {
      setLoading(true)
      try {
        const [actRes, recRes] = await Promise.all([
          governmentAPI.getActions(city).catch(() => null),
          governmentAPI.getRecommendations().catch(() => null),
        ])
        setActions(
          actRes?.data && Array.isArray(actRes.data)
            ? actRes.data.map(normalise)
            : []
        )
        const recs = recRes?.data?.recommendations ?? recRes?.data ?? []
        setRecommendations(Array.isArray(recs) && recs.length > 0 ? recs : FALLBACK_RECS)
      } catch {
        setActions([])
        setRecommendations(FALLBACK_RECS)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user?.city])

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
      toast.success('Action saved (offline mode)')
      setForm({ ward: defaultWard, action_type: ACTION_TYPES[0].label, description: '', priority: 'high' })
      setShowForm(false)
    } finally {
      setSubmitting(false)
    }
  }

  const loadRec = (rec) => {
    setForm(f => ({ ...f, ward: rec.ward, description: rec.recommendation }))
    setShowForm(true)
    toast.success('Recommendation loaded into form')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BoltIcon className="w-6 h-6 text-blue-400" />
            Government Actions
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Manage interventions and AI-powered recommendations
            {user?.city && <span className="ml-2 text-purple-300 font-medium">· {user.city}</span>}
          </p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          {showForm ? <XMarkIcon className="w-4 h-4" /> : <PlusIcon className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'New Action'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-5">
            Create Intervention
          </h2>
          <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label-text">Ward</label>
              <select className="input-field" value={form.ward}
                onChange={e => setForm(f => ({ ...f, ward: e.target.value }))}>
                {cityWards.map(w => (
                  <option key={w.ward_id} value={w.ward_id}>{w.ward_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-text">Action Type</label>
              <select className="input-field" value={form.action_type}
                onChange={e => setForm(f => ({ ...f, action_type: e.target.value }))}>
                {ACTION_TYPES.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label-text">Priority</label>
              <select className="input-field" value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label-text">Description</label>
              <textarea
                className="input-field min-h-[80px] resize-none"
                placeholder="Describe the intervention measures..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                required
              />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
                {submitting
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <PlusIcon className="w-4 h-4" />}
                Create Action
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* AI Recommendations */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <SparklesIcon className="w-4 h-4 text-yellow-400" />
          AI Recommendations (Gemini)
        </h2>
        <div className="space-y-3">
          {recommendations.map((rec, i) => (
            <div key={i} className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-white">{rec.ward}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                  priorityCls[rec.priority?.toLowerCase()] || priorityCls.medium
                }`}>
                  {rec.priority}
                </span>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{rec.recommendation}</p>
              <button
                onClick={() => loadRec(rec)}
                className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Use this recommendation →
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Actions list */}
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
            <p className="text-gray-500 text-xs mt-1">Click "New Action" to create the first one.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {actions.map(action => (
              <div
                key={action.id}
                className="p-4 bg-gray-800/40 rounded-xl border border-gray-700/30 hover:border-gray-600/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-white">{action.action_type}</p>
                      <span className="text-xs text-gray-400">·</span>
                      <p className="text-xs text-gray-400">{action.ward}</p>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">{action.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-full border font-medium ${
                      statusCls[action.status] || statusCls.pending
                    }`}>
                      {action.status}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      priorityCls[action.priority] || priorityCls.medium
                    }`}>
                      {action.priority}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
