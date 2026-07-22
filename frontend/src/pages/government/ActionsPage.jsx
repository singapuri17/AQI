import { useEffect, useState, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { governmentAPI, aqiAPI } from '../../api'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import {
  BoltIcon, PlusIcon, SparklesIcon, XMarkIcon,
  CheckCircleIcon, XCircleIcon, ChevronDownIcon,
  BeakerIcon, BuildingStorefrontIcon, ClockIcon,
  MagnifyingGlassIcon, StarIcon, FunnelIcon,
} from '@heroicons/react/24/outline'
import { useAuthStore } from '../../store/authStore'
import { useCityStore } from '../../store/cityStore'
import toast from 'react-hot-toast'
import clsx from 'clsx'

// ── Constants ─────────────────────────────────────────────────────────────
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
const FILTER_CHIPS = ['All','Industrial','Traffic','Construction','Waste Burning','Green Cover','Critical AQI']
const SORT_OPTIONS = ['Highest AQI','Highest Priority','Alphabetical']

function normaliseAction(a) {
  return {
    id: a.id, ward: a.ward_id ?? a.ward ?? '—',
    action_type: a.action_type ?? '—', description: a.description ?? '',
    priority: a.priority ?? 'medium', status: a.status ?? 'pending',
    created_at: a.created_at ?? null,
  }
}

const statusCls = {
  pending:     'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  in_progress: 'bg-blue-500/20   text-blue-400   border-blue-500/30',
  completed:   'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  cancelled:   'bg-gray-600/20   text-gray-400   border-gray-600/30',
}
const priorityCls = {
  critical:'bg-red-500/20 text-red-400 border-red-500/30',
  high:    'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium:  'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low:     'bg-gray-600/20 text-gray-400 border-gray-600/30',
}
const typeIcon   = { regulation:'🚦', enforcement:'🏭', infrastructure:'💧', awareness:'📢' }
const sourceTag  = {
  industrial:   { label:'Industrial',    color:'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  traffic:      { label:'Traffic',       color:'bg-blue-500/20 text-blue-300 border-blue-500/30'   },
  construction: { label:'Construction',  color:'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  green_cover:  { label:'Green Cover',   color:'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  waste_burning:{ label:'Waste Burning', color:'bg-red-500/20 text-red-300 border-red-500/30' },
  severe_aqi:   { label:'Severe AQI',    color:'bg-red-700/20 text-red-300 border-red-700/30' },
  high_aqi:     { label:'High AQI',      color:'bg-orange-700/20 text-orange-300 border-orange-700/30' },
  so2:          { label:'SO₂',           color:'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  preventive:   { label:'Preventive',    color:'bg-gray-600/20 text-gray-300 border-gray-600/30' },
}
const densityDot   = { high:'bg-red-500', medium:'bg-yellow-500', low:'bg-emerald-500' }
const densityLabel = { high:'High', medium:'Medium', low:'Low' }

// ── Helpers ───────────────────────────────────────────────────────────────
function highlight(text, term) {
  if (!term || !text) return text
  const idx = text.toLowerCase().indexOf(term.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-400/30 text-yellow-200 rounded px-0.5">{text.slice(idx, idx + term.length)}</mark>
      {text.slice(idx + term.length)}
    </>
  )
}

function wardMatchesFilter(ward, filter, wardData) {
  if (filter === 'All') return true
  const d = wardData[ward.ward_id]
  if (!d) return true
  const map = {
    'Industrial':   d.industrial_density === 'high',
    'Traffic':      d.traffic_density === 'high',
    'Construction': d.construction_activity === 'high',
    'Waste Burning':d.waste_burning === 'high',
    'Green Cover':  d.green_cover === 'low',
    'Critical AQI': d.aqi > 200,
  }
  return map[filter] ?? true
}

// ── DensityBadge ──────────────────────────────────────────────────────────
function DensityBadge({ label, level }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', densityDot[level] || 'bg-gray-500')} />
      <span className="text-xs text-gray-400">{label}: <span className="text-white font-medium">{densityLabel[level] || level}</span></span>
    </div>
  )
}

// ── WardAnalysisCard ──────────────────────────────────────────────────────
function WardAnalysisCard({ ward, onAccept, searchTerm }) {
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [dismissed, setDismissed] = useState({})

  useEffect(() => {
    setLoading(true); setError(null); setData(null)
    governmentAPI.getWardRecommendations(ward.ward_id)
      .then(r => setData(r.data))
      .catch(e => setError(e?.response?.data?.detail || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [ward.ward_id])

  if (loading) return (
    <div className="glass-card p-5 space-y-3 animate-pulse">
      {[1/3,1,4/5,3/5].map((w,i) => <div key={i} className="h-3 bg-gray-700 rounded" style={{width:`${w*100}%`}} />)}
    </div>
  )
  if (error) return <div className="glass-card p-4 border border-red-500/20"><p className="text-red-400 text-sm">⚠ {error}</p></div>
  if (!data) return null

  const aqiColor = data.aqi > 300 ? 'text-red-400' : data.aqi > 200 ? 'text-orange-400' : data.aqi > 100 ? 'text-yellow-400' : 'text-emerald-400'
  const riskColor = data.risk_level === 'Severe' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                    data.risk_level === 'High' ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' :
                    data.risk_level === 'Moderate' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
                    'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'

  return (
    <div className="glass-card overflow-hidden border border-gray-700/40">
      <div className="p-5 bg-gradient-to-r from-purple-900/30 to-blue-900/20 border-b border-gray-700/40">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">{highlight(data.ward_name, searchTerm)}</h3>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={clsx('text-2xl font-bold', aqiColor)}>AQI {data.aqi?.toFixed(0)}</span>
              <span className="text-gray-400 text-sm">· 7d avg: {data.avg_aqi_7d}</span>
              <span className={clsx('text-xs px-2 py-0.5 rounded-full border font-semibold', riskColor)}>{data.risk_level} Risk</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 mb-1">Ward Type</p>
            <p className="text-sm font-semibold text-purple-300">{highlight(data.ward_type, searchTerm)}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap mt-3">
          {[['PM2.5',data.pm25],['PM10',data.pm10],['NO₂',data.no2],['SO₂',data.so2]].map(([n,v]) => (
            <span key={n} className="text-xs bg-gray-800/60 border border-gray-700/40 rounded-lg px-2 py-1 text-gray-300">
              {n}: <span className="text-white font-medium">{v?.toFixed(1)}</span> μg/m³
            </span>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
          <DensityBadge label="Industrial"   level={data.industrial_density} />
          <DensityBadge label="Traffic"      level={data.traffic_density} />
          <DensityBadge label="Construction" level={data.construction_activity} />
          <DensityBadge label="Green Cover"  level={data.green_cover} />
          <DensityBadge label="Waste Burning"level={data.waste_burning} />
        </div>
        <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-xs font-semibold text-blue-300 mb-1">🔍 Primary Cause</p>
          <p className="text-sm text-gray-200 leading-relaxed">{data.primary_cause}</p>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Recommended Actions ({data.recommendations?.filter((_,i) => !dismissed[i]).length || 0})
          </p>
          <p className="text-xs text-gray-500">Accept or Dismiss each</p>
        </div>
        {data.recommendations?.filter((_,i) => !dismissed[i]).length === 0 ? (
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
                      <span className="flex items-center gap-1"><BeakerIcon className="w-3 h-3 text-emerald-400" />{rec.impact}</span>
                      <span className="flex items-center gap-1"><ClockIcon className="w-3 h-3 text-blue-400" />{rec.timeline}</span>
                      {rec.aqi_reduction !== 'N/A' && <span className="text-purple-300 font-medium">📉 {rec.aqi_reduction}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0 mt-0.5">
                    <button onClick={() => onAccept({ ward_id: ward.ward_id, ward_name: data.ward_name, rec })}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 text-xs font-medium transition-colors">
                      <CheckCircleIcon className="w-3.5 h-3.5" /> Accept
                    </button>
                    <button onClick={() => setDismissed(d => ({ ...d, [i]: true }))}
                      className="p-1.5 rounded-lg bg-gray-700/40 text-gray-400 border border-gray-600/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-colors">
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

// ── Main Page ─────────────────────────────────────────────────────────────
export default function ActionsPage() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const { user }         = useAuthStore()
  const { selectedCity } = useCityStore()
  const city = user?.city || selectedCity || null

  // ── State ────────────────────────────────────────────────────────────
  const [actions, setActions]           = useState([])
  const [loadingActions, setLoadingActions] = useState(true)
  const [showForm, setShowForm]         = useState(false)
  const [submitting, setSubmitting]     = useState(false)
  const [updating, setUpdating]         = useState({})
  const [cityWards, setCityWards]       = useState([])
  const [wardData, setWardData]         = useState({}) // cache {ward_id: analysisData}
  const [activeTab, setActiveTab]       = useState('recommendations')
  const [expandedWard, setExpandedWard] = useState(null)
  const [highlightedWard, setHighlightedWard] = useState(null) // ⭐ Selected Ward badge
  const [searchTerm, setSearchTerm]     = useState('')
  const [activeFilter, setActiveFilter] = useState('All')
  const [sortBy, setSortBy]             = useState('Highest AQI')

  const wardRefs = useRef({})

  const [form, setForm] = useState({
    ward: '', action_type: ACTION_TYPES[0].label, description: '', priority: 'high',
  })

  // ── Load wards ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!city) return
    aqiAPI.getWardList(city).then(res => {
      const list = Array.isArray(res.data) ? res.data : []
      setCityWards(list)
      if (list.length > 0) setForm(f => ({ ...f, ward: f.ward || list[0].ward_id }))

      // Check URL for ?ward= param
      const params = new URLSearchParams(location.search)
      const wardParam = params.get('ward')
      if (wardParam) {
        // Match by name (case-insensitive) or id
        const matched = list.find(
          w => w.ward_name.toLowerCase() === wardParam.toLowerCase() ||
               w.ward_id.toLowerCase()   === wardParam.toLowerCase()
        )
        if (matched) {
          setExpandedWard(matched.ward_id)
          setHighlightedWard(matched.ward_id)
          // Scroll after a brief delay for render
          setTimeout(() => {
            wardRefs.current[matched.ward_id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 400)
          // Remove highlight badge after 3s
          setTimeout(() => setHighlightedWard(null), 3000)
        } else {
          setExpandedWard(list[0]?.ward_id || null)
        }
      } else {
        // No URL param — open first ward by default
        setExpandedWard(list[0]?.ward_id || null)
      }
    }).catch(() => {})
  }, [city, location.search]) // eslint-disable-line

  // ── Load actions ──────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoadingActions(true)
      try {
        const res = await governmentAPI.getActions(city)
        setActions(Array.isArray(res.data) ? res.data.map(normaliseAction) : [])
      } catch { setActions([]) }
      finally { setLoadingActions(false) }
    }
    load()
  }, [city])

  // ── Filter + Search + Sort ────────────────────────────────────────────
  const filteredWards = cityWards
    .filter(w => {
      if (!searchTerm) return true
      const term = searchTerm.toLowerCase()
      const d = wardData[w.ward_id]
      return (
        w.ward_name.toLowerCase().includes(term) ||
        w.ward_id.toLowerCase().includes(term)   ||
        (d?.ward_type || '').toLowerCase().includes(term) ||
        (d?.industrial_density === 'high' && 'industrial'.includes(term)) ||
        (d?.traffic_density === 'high'    && 'traffic'.includes(term))    ||
        (d?.waste_burning === 'high'      && 'waste burning'.includes(term))
      )
    })
    .filter(w => wardMatchesFilter(w, activeFilter, wardData))
    .sort((a, b) => {
      const da = wardData[a.ward_id], db = wardData[b.ward_id]
      if (sortBy === 'Alphabetical') return a.ward_name.localeCompare(b.ward_name)
      if (sortBy === 'Highest AQI')  return (db?.aqi || 0) - (da?.aqi || 0)
      return 0
    })

  // Cache ward analysis data when loaded
  const handleWardDataLoaded = useCallback((ward_id, data) => {
    setWardData(prev => ({ ...prev, [ward_id]: data }))
  }, [])

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleAccept = ({ ward_id, ward_name, rec }) => {
    const typeMap = { regulation:'Traffic Restriction', enforcement:'Industrial Control', infrastructure:'Water Sprinkling', awareness:'Public Advisory' }
    setForm({
      ward: ward_id,
      action_type: typeMap[rec.action_type] || ACTION_TYPES[0].label,
      description: `[Recommended] ${rec.title}. Impact: ${rec.impact}. Timeline: ${rec.timeline}.`,
      priority: rec.priority || 'high',
    })
    setShowForm(true)
    setActiveTab('actions')
    toast.success(`Recommendation for ${ward_name} loaded — confirm to create`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.description.trim()) { toast.error('Add a description'); return }
    setSubmitting(true)
    try {
      const res = await governmentAPI.createAction(form)
      setActions(prev => [normaliseAction(res.data), ...prev])
      toast.success('Action created successfully')
      setForm({ ward: cityWards[0]?.ward_id || '', action_type: ACTION_TYPES[0].label, description: '', priority: 'high' })
      setShowForm(false)
    } catch {
      const mock = { id: Date.now(), ...normaliseAction({ ...form, status: 'pending', created_at: new Date().toISOString() }) }
      setActions(prev => [mock, ...prev])
      toast.success('Action saved')
      setForm({ ward: cityWards[0]?.ward_id || '', action_type: ACTION_TYPES[0].label, description: '', priority: 'high' })
      setShowForm(false)
    } finally { setSubmitting(false) }
  }

  const handleStatusUpdate = async (actionId, newStatus) => {
    setUpdating(u => ({ ...u, [actionId]: true }))
    try {
      const res = await governmentAPI.updateActionStatus(actionId, newStatus)
      setActions(prev => prev.map(a => a.id === actionId ? normaliseAction(res.data) : a))
      toast.success(`Action ${newStatus.replace('_',' ')}`)
    } catch {
      setActions(prev => prev.map(a => a.id === actionId ? { ...a, status: newStatus } : a))
      toast.success(`Status updated`)
    } finally { setUpdating(u => ({ ...u, [actionId]: false })) }
  }

  const handleAccordionClick = (ward_id) => {
    setExpandedWard(prev => prev === ward_id ? null : ward_id)
    // Update URL without re-fetching
    const ward = cityWards.find(w => w.ward_id === ward_id)
    if (ward) navigate(`/government/actions?ward=${encodeURIComponent(ward.ward_name)}`, { replace: true })
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
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

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800/50 p-1 rounded-xl w-fit">
        {[
          { id:'recommendations', label:'Ward Recommendations', icon:SparklesIcon },
          { id:'actions', label:`All Actions (${actions.length})`, icon:BoltIcon },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === tab.id ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white')}>
            <tab.icon className="w-4 h-4" />{tab.label}
          </button>
        ))}
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="glass-card p-6 border border-blue-500/20">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-1">Create Intervention</h2>
          <p className="text-xs text-gray-500 mb-5">Review and confirm to create the action.</p>
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
              <textarea className="input-field min-h-[90px] resize-none" placeholder="Describe the intervention..."
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

      {/* ── Recommendations Tab ────────────────────────────────────────── */}
      {activeTab === 'recommendations' && (
        <div className="space-y-4">
          {/* Search + Filter + Sort bar */}
          <div className="glass-card p-4 space-y-3">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="🔍  Search ward name, ID, Industrial, Traffic, Waste Burning..."
                className="input-field pl-9 text-sm"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <FunnelIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              {FILTER_CHIPS.map(chip => (
                <button key={chip} onClick={() => setActiveFilter(chip)}
                  className={clsx('px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                    activeFilter === chip ? 'bg-purple-600 text-white border-purple-500' : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700')}>
                  {chip}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 flex-shrink-0">Sort by:</span>
              {SORT_OPTIONS.map(opt => (
                <button key={opt} onClick={() => setSortBy(opt)}
                  className={clsx('px-2.5 py-1 rounded-lg text-xs border transition-colors',
                    sortBy === opt ? 'bg-blue-600/30 text-blue-300 border-blue-500/40' : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:text-white')}>
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Info banner */}
          <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <SparklesIcon className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <p className="text-sm text-yellow-200">
              Each ward gets <strong>unique rule-based recommendations</strong> from its actual AQI, industries, construction and traffic data.
              {filteredWards.length < cityWards.length && (
                <span className="ml-1 text-yellow-300">· Showing {filteredWards.length} of {cityWards.length} wards</span>
              )}
            </p>
          </div>

          {/* Ward list */}
          {filteredWards.length === 0 ? (
            <div className="glass-card p-10 text-center">
              <MagnifyingGlassIcon className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No ward found matching "<span className="text-white">{searchTerm}</span>"</p>
              <button onClick={() => { setSearchTerm(''); setActiveFilter('All') }} className="mt-3 text-blue-400 text-xs hover:underline">Clear search</button>
            </div>
          ) : (
            filteredWards.map(ward => (
              <div
                key={ward.ward_id}
                ref={el => wardRefs.current[ward.ward_id] = el}
                className={clsx('transition-all duration-300', highlightedWard === ward.ward_id && 'ring-2 ring-yellow-400/60 rounded-xl')}
              >
                {/* Accordion header */}
                <button
                  onClick={() => handleAccordionClick(ward.ward_id)}
                  className={clsx(
                    'w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left',
                    expandedWard === ward.ward_id ? 'bg-purple-500/10 border-purple-500/40' : 'bg-gray-800/40 border-gray-700/40 hover:border-gray-600/60'
                  )}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <BuildingStorefrontIcon className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <span className="text-sm font-semibold text-white">{highlight(ward.ward_name, searchTerm)}</span>
                    <span className="text-xs text-gray-500">{ward.ward_id}</span>
                    {/* ⭐ Selected Ward badge — shown for 3s after redirect from Priority page */}
                    {highlightedWard === ward.ward_id && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 animate-pulse">
                        <StarIcon className="w-3 h-3" /> Selected Ward
                      </span>
                    )}
                    {/* AQI pill if data cached */}
                    {wardData[ward.ward_id] && (
                      <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full',
                        wardData[ward.ward_id].aqi > 200 ? 'bg-red-500/20 text-red-300' :
                        wardData[ward.ward_id].aqi > 100 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-emerald-500/20 text-emerald-300')}>
                        AQI {wardData[ward.ward_id].aqi?.toFixed(0)}
                      </span>
                    )}
                  </div>
                  <ChevronDownIcon className={clsx('w-4 h-4 text-gray-400 transition-transform flex-shrink-0', expandedWard === ward.ward_id && 'rotate-180')} />
                </button>

                {/* Expanded content */}
                {expandedWard === ward.ward_id && (
                  <div className="mt-2">
                    <WardAnalysisCard
                      ward={ward}
                      onAccept={handleAccept}
                      searchTerm={searchTerm}
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Actions Tab ───────────────────────────────────────────────── */}
      {activeTab === 'actions' && (
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">All Actions ({actions.length})</h2>
          {loadingActions ? (
            <LoadingSpinner size="sm" text="Loading actions..." className="py-8" />
          ) : actions.length === 0 ? (
            <div className="text-center py-10">
              <BoltIcon className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No actions recorded yet.</p>
              <p className="text-gray-500 text-xs mt-1">Go to Ward Recommendations and accept one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {actions.map(action => (
                <div key={action.id} className={clsx('p-4 rounded-xl border transition-colors',
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
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <span className={clsx('text-xs px-2 py-1 rounded-full border font-medium', statusCls[action.status] || statusCls.pending)}>
                          {action.status.replace('_',' ')}
                        </span>
                        <span className={clsx('text-xs px-2 py-0.5 rounded-full border', priorityCls[action.priority] || priorityCls.medium)}>
                          {action.priority}
                        </span>
                      </div>
                      {action.status !== 'cancelled' && action.status !== 'completed' && (
                        <div className="flex gap-1.5">
                          {action.status === 'pending' && (
                            <button onClick={() => handleStatusUpdate(action.id,'in_progress')} disabled={updating[action.id]}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 text-xs font-medium transition-colors disabled:opacity-50">
                              {updating[action.id] ? <div className="w-3 h-3 border border-blue-400/30 border-t-blue-400 rounded-full animate-spin" /> : <BoltIcon className="w-3 h-3" />}
                              Confirm
                            </button>
                          )}
                          {action.status === 'in_progress' && (
                            <button onClick={() => handleStatusUpdate(action.id,'completed')} disabled={updating[action.id]}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 text-xs font-medium transition-colors disabled:opacity-50">
                              {updating[action.id] ? <div className="w-3 h-3 border border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" /> : <CheckCircleIcon className="w-3 h-3" />}
                              Mark Done
                            </button>
                          )}
                          <button onClick={() => handleStatusUpdate(action.id,'cancelled')} disabled={updating[action.id]}
                            className="px-2 py-1.5 rounded-lg bg-gray-700/40 text-gray-400 border border-gray-600/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 text-xs transition-colors disabled:opacity-50">
                            <XMarkIcon className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      {action.status === 'completed' && (
                        <p className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircleIcon className="w-3 h-3" /> Completed</p>
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
