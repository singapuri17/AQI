import { useEffect, useRef, useState } from 'react'
import { adminAPI } from '../../api'
import { CITIES } from '../../store/cityStore'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import {
  UserGroupIcon, UserPlusIcon, TrashIcon, PencilIcon,
  CheckCircleIcon, ExclamationCircleIcon, DocumentArrowUpIcon,
  MagnifyingGlassIcon, PowerIcon,
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import clsx from 'clsx'

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say']
const EMPTY = { full_name: '', email: '', password: '', city: '', gender: '', date_of_birth: '', document: null }

export default function OfficerManagement() {
  const [officers, setOfficers]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [panel, setPanel]           = useState(null)   // null | 'add' | {id,...}
  const [form, setForm]             = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback]     = useState({ ok: '', err: '' })
  const [showPw, setShowPw]         = useState(false)
  const [search, setSearch]         = useState('')
  const [cityFilter, setCityFilter] = useState('All')
  const fileRef = useRef(null)

  const reload = async () => {
    setLoading(true)
    try {
      const res = await adminAPI.listOfficers()
      setOfficers(Array.isArray(res.data) ? res.data : [])
    } catch { setOfficers([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { reload() }, [])

  const filtered = officers.filter(o => {
    const q = search.toLowerCase()
    if (q && !o.full_name?.toLowerCase().includes(q) && !o.email?.toLowerCase().includes(q)) return false
    if (cityFilter !== 'All' && o.city !== cityFilter) return false
    return true
  })

  const handleField = e => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    setFeedback({ ok: '', err: '' })
  }

  const validate = () => {
    if (!form.full_name.trim()) return 'Name is required.'
    if (!form.email.trim())     return 'Email is required.'
    if (panel === 'add' && !form.password) return 'Password is required.'
    if (form.password && form.password.length < 6) return 'Password must be ≥ 6 characters.'
    if (!form.city)             return 'City is required.'
    if (!form.gender)           return 'Gender is required.'
    if (!form.date_of_birth)    return 'Date of birth is required.'
    return null
  }

  const handleSubmit = async e => {
    e.preventDefault()
    const err = validate()
    if (err) { setFeedback({ ok: '', err }); return }
    setSubmitting(true)
    setFeedback({ ok: '', err: '' })
    try {
      if (panel === 'add') {
        const fd = new FormData()
        Object.entries(form).forEach(([k, v]) => { if (k !== 'document' && v) fd.append(k, v) })
        if (form.document) fd.append('document', form.document)
        await adminAPI.registerOfficer(fd)
        setFeedback({ ok: 'Officer registered successfully.', err: '' })
        setForm(EMPTY)
        if (fileRef.current) fileRef.current.value = ''
      } else {
        // Edit
        const payload = {}
        if (form.full_name)     payload.full_name     = form.full_name
        if (form.city)          payload.city          = form.city
        if (form.gender)        payload.gender        = form.gender
        if (form.date_of_birth) payload.date_of_birth = form.date_of_birth
        await adminAPI.updateOfficer(panel.id, payload)
        setFeedback({ ok: 'Officer updated successfully.', err: '' })
        setPanel(null)
      }
      await reload()
    } catch (err) {
      const d = err.response?.data?.detail
      setFeedback({ ok: '', err: Array.isArray(d) ? d[0]?.msg : d || 'Failed.' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggle = async o => {
    try {
      const res = await adminAPI.toggleOfficer(o.id)
      setOfficers(prev => prev.map(x => x.id === o.id ? res.data : x))
    } catch { /* silent */ }
  }

  const handleDelete = async o => {
    if (!window.confirm(`Remove "${o.full_name}"? This cannot be undone.`)) return
    try {
      await adminAPI.deleteOfficer(o.id)
      await reload()
    } catch { /* silent */ }
  }

  const openEdit = o => {
    setPanel(o)
    setForm({ full_name: o.full_name, email: o.email, password: '', city: o.city ?? '', gender: o.gender ?? '', date_of_birth: o.date_of_birth ?? '', document: null })
    setFeedback({ ok: '', err: '' })
  }

  const Form = (
    <div className="glass-card p-7">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          {panel === 'add' ? 'Register Officer' : `Edit — ${panel?.full_name}`}
        </h2>
        <button onClick={() => { setPanel(null); setFeedback({ ok: '', err: '' }) }}
          className="text-gray-400 hover:text-white text-xs">✕ Cancel</button>
      </div>

      {feedback.ok && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mb-4 text-emerald-400 text-sm">
          <CheckCircleIcon className="w-4 h-4 flex-shrink-0" />{feedback.ok}
        </div>
      )}
      {feedback.err && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl mb-4 text-red-400 text-sm">
          <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0" />{feedback.err}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className="label-text">Full Name <span className="text-red-400">*</span></label>
          <input name="full_name" value={form.full_name} onChange={handleField} className="input-field" placeholder="Officer full name" />
        </div>
        <div>
          <label className="label-text">Email {panel === 'add' && <span className="text-red-400">*</span>}</label>
          <input type="email" name="email" value={form.email} onChange={handleField} className={clsx('input-field', panel !== 'add' && 'opacity-50 cursor-not-allowed')} readOnly={panel !== 'add'} placeholder="officer@municipality.gov" />
        </div>
        {panel === 'add' && (
          <div>
            <label className="label-text">Password <span className="text-red-400">*</span></label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} name="password" value={form.password} onChange={handleField} className="input-field pr-10" placeholder="Min. 6 characters" />
              <button type="button" onClick={() => setShowPw(s => !s)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200">{showPw ? '🙈' : '👁️'}</button>
            </div>
          </div>
        )}
        <div>
          <label className="label-text">Assigned City <span className="text-red-400">*</span></label>
          <select name="city" value={form.city} onChange={handleField} className="input-field">
            <option value="">Select city…</option>
            {CITIES.filter(c => c !== 'Rajkot' && c !== 'Gandhinagar').map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-text">Gender <span className="text-red-400">*</span></label>
            <select name="gender" value={form.gender} onChange={handleField} className="input-field">
              <option value="">Select…</option>
              {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="label-text">Date of Birth <span className="text-red-400">*</span></label>
            <input type="date" name="date_of_birth" value={form.date_of_birth} onChange={handleField}
              className="input-field" max={new Date().toISOString().split('T')[0]} />
          </div>
        </div>
        {panel === 'add' && (
          <div>
            <label className="label-text flex items-center gap-1">
              <DocumentArrowUpIcon className="w-4 h-4" />
              Government Document <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => setForm(f => ({ ...f, document: e.target.files[0] ?? null }))}
              className="block w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-gray-700 file:text-gray-300 hover:file:bg-gray-600 file:cursor-pointer cursor-pointer mt-1" />
          </div>
        )}
        <button type="submit" disabled={submitting} className="btn-primary w-full py-3 flex items-center justify-center gap-2 !mt-5">
          {submitting
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Processing…</>
            : <><UserPlusIcon className="w-4 h-4" />{panel === 'add' ? 'Register Officer' : 'Save Changes'}</>}
        </button>
      </form>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <UserGroupIcon className="w-6 h-6 text-purple-400" />
            Officer Management
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {officers.length} officer{officers.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        {panel === null && (
          <button onClick={() => { setPanel('add'); setForm(EMPTY); setFeedback({ ok: '', err: '' }) }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors">
            <UserPlusIcon className="w-4 h-4" />Add Officer
          </button>
        )}
      </div>

      <div className="grid xl:grid-cols-2 gap-6 items-start">
        {/* Form panel */}
        {panel !== null && Form}

        {/* Officer list */}
        <div className="space-y-4">
          {/* Search + city filter */}
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name or email…"
                className="input-field !pl-9 !py-1.5 text-sm w-52" />
            </div>
            <div className="flex gap-1 bg-gray-800/60 rounded-lg p-1 border border-gray-700/50">
              {['All', 'Ahmedabad', 'Surat', 'Vadodara'].map(c => (
                <button key={c} onClick={() => setCityFilter(c)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    cityFilter === c ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}>{c}</button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32 gap-2 text-gray-400 text-sm">
              <span className="w-4 h-4 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <UserGroupIcon className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No officers found.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {filtered.map(o => (
                <div key={o.id} className={clsx(
                  'glass-card p-4 border transition-colors',
                  !o.is_active && 'opacity-50 border-gray-700/30',
                  o.is_active && 'border-gray-700/40'
                )}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={clsx('w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
                        o.is_active ? 'bg-purple-500/20' : 'bg-gray-700/50')}>
                        <span className={clsx('text-sm font-bold', o.is_active ? 'text-purple-400' : 'text-gray-500')}>
                          {o.full_name?.charAt(0)?.toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white truncate">{o.full_name}</p>
                          {!o.is_active && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">Disabled</span>}
                        </div>
                        <p className="text-xs text-gray-400 truncate">{o.email}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {o.city && <span className="text-xs text-blue-400">{o.city}</span>}
                          {o.gender && <span className="text-xs text-gray-500">{o.gender}</span>}
                          {o.created_at && (
                            <span className="text-xs text-gray-600">
                              Joined {format(new Date(o.created_at), 'MMM yyyy')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => openEdit(o)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors" title="Edit">
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleToggle(o)}
                        className={clsx('p-1.5 rounded-lg transition-colors', o.is_active
                          ? 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10'
                          : 'text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10')}
                        title={o.is_active ? 'Disable' : 'Enable'}>
                        <PowerIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(o)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
