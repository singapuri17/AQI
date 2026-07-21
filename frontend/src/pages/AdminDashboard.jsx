import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CloudIcon,
  UserGroupIcon,
  HomeIcon,
  ArrowRightOnRectangleIcon,
  UserPlusIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserCircleIcon,
  DocumentArrowUpIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'
import { useAuthStore } from '../store/authStore'
import { adminAPI } from '../api'
import clsx from 'clsx'

const CITIES   = ['Ahmedabad', 'Surat', 'Vadodara', 'Other']
const GENDERS  = ['Male', 'Female', 'Other', 'Prefer not to say']

const EMPTY_FORM = {
  full_name:     '',
  email:         '',
  password:      '',
  city:          '',
  gender:        '',
  date_of_birth: '',
  document:      null,
}

// ─── Sidebar ───────────────────────────────────────────────────────────────
function AdminSidebar({ view, setView, collapsed, setCollapsed }) {
  const { user, logout } = useAuthStore()
  const navigate         = useNavigate()

  const links = [
    { id: 'dashboard', label: 'Dashboard', icon: HomeIcon },
    { id: 'officers',  label: 'Officers',  icon: UserGroupIcon },
  ]

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <aside className={clsx(
      'h-full flex flex-col bg-gray-900/80 backdrop-blur-md border-r border-gray-700/50 transition-all duration-300 relative flex-shrink-0',
      collapsed ? 'w-16' : 'w-60'
    )}>
      {/* Logo */}
      <div className={clsx('p-4 flex items-center gap-3 border-b border-gray-700/50', collapsed && 'justify-center')}>
        <div className="p-1.5 rounded-lg bg-purple-500/20">
          <CloudIcon className="w-5 h-5 text-purple-400" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-sm font-bold text-white">UAQIIS</p>
            <p className="text-xs text-purple-400">Admin Portal</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {links.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={clsx(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
              view === id
                ? 'bg-purple-600/30 text-purple-300 border border-purple-500/30'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50',
              collapsed && 'justify-center'
            )}
            title={collapsed ? label : undefined}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </button>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="p-3 border-t border-gray-700/50">
        {!collapsed && (
          <div className="flex items-center gap-2 px-2 py-2 mb-2">
            <UserCircleIcon className="w-7 h-7 text-gray-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.full_name || 'Admin'}</p>
              <p className="text-xs text-purple-400 truncate">Administrator</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={clsx(
            'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors',
            collapsed && 'justify-center'
          )}
          title={collapsed ? 'Logout' : undefined}
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5 flex-shrink-0" />
          {!collapsed && 'Logout'}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="absolute -right-3 top-20 bg-gray-800 border border-gray-700 rounded-full p-1 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors z-10"
      >
        {collapsed ? <ChevronRightIcon className="w-3 h-3" /> : <ChevronLeftIcon className="w-3 h-3" />}
      </button>
    </aside>
  )
}

// ─── Dashboard overview ────────────────────────────────────────────────────
function DashboardView({ officerCount, setView }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">System overview and quick actions</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-5">
        <div className="glass-card p-6 border-purple-500/20 bg-purple-500/5">
          <p className="text-xs text-gray-400 mb-1">Total Officers</p>
          <p className="text-4xl font-bold text-white">{officerCount}</p>
          <p className="text-xs text-purple-400 mt-1">Active government officers</p>
        </div>
        <div className="glass-card p-6 border-blue-500/20 bg-blue-500/5">
          <p className="text-xs text-gray-400 mb-1">Cities Covered</p>
          <p className="text-4xl font-bold text-white">3</p>
          <p className="text-xs text-blue-400 mt-1">Ahmedabad · Surat · Vadodara</p>
        </div>
        <div className="glass-card p-6 border-emerald-500/20 bg-emerald-500/5">
          <p className="text-xs text-gray-400 mb-1">System Status</p>
          <p className="text-lg font-bold text-emerald-400 mt-1">● Online</p>
          <p className="text-xs text-gray-400 mt-1">All services running</p>
        </div>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Quick Actions</h2>
        <button
          onClick={() => setView('officers')}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <UserPlusIcon className="w-4 h-4" />
          Register New Officer
        </button>
      </div>
    </div>
  )
}

// ─── Officers management view ──────────────────────────────────────────────
function OfficersView() {
  const [officers, setOfficers]   = useState([])
  const [listLoading, setListLoad]= useState(true)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess]     = useState('')
  const [formError, setFormError] = useState('')
  const [showPw, setShowPw]       = useState(false)
  const fileRef                   = useRef(null)

  const loadOfficers = async () => {
    setListLoad(true)
    try {
      const res = await adminAPI.listOfficers()
      setOfficers(Array.isArray(res.data) ? res.data : [])
    } catch {
      setOfficers([])
    } finally {
      setListLoad(false)
    }
  }

  useEffect(() => { loadOfficers() }, [])

  const handleField = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    setFormError('')
    setSuccess('')
  }

  const handleFile = (e) => {
    setForm(f => ({ ...f, document: e.target.files[0] ?? null }))
  }

  const validate = () => {
    if (!form.full_name.trim()) return 'Name is required.'
    if (!form.email.trim())     return 'Email is required.'
    if (!form.password)         return 'Password is required.'
    if (form.password.length < 6) return 'Password must be at least 6 characters.'
    if (!form.city)             return 'City is required.'
    if (!form.gender)           return 'Gender is required.'
    if (!form.date_of_birth)    return 'Date of birth is required.'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const err = validate()
    if (err) { setFormError(err); return }

    setSubmitting(true)
    setFormError('')
    setSuccess('')

    const fd = new FormData()
    fd.append('full_name',     form.full_name.trim())
    fd.append('email',         form.email.trim())
    fd.append('password',      form.password)
    fd.append('city',          form.city)
    fd.append('gender',        form.gender)
    fd.append('date_of_birth', form.date_of_birth)
    if (form.document) fd.append('document', form.document)

    try {
      await adminAPI.registerOfficer(fd)
      setSuccess('Officer registered successfully.')
      setForm(EMPTY_FORM)
      if (fileRef.current) fileRef.current.value = ''
      await loadOfficers()
    } catch (err) {
      const detail = err.response?.data?.detail
      setFormError(
        Array.isArray(detail) ? detail[0]?.msg : detail || 'Registration failed.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Remove officer "${name}"? This cannot be undone.`)) return
    try {
      await adminAPI.deleteOfficer(id)
      await loadOfficers()
    } catch {
      // non-critical
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Government Officer Management</h1>
        <p className="text-gray-400 text-sm mt-1">
          Register new officers and manage existing accounts.
        </p>
      </div>

      <div className="grid xl:grid-cols-2 gap-8 items-start">
        {/* ── Registration form ── */}
        <div className="glass-card p-7">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-6">
            Register Officer
          </h2>

          {success && (
            <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mb-5 text-emerald-400 text-sm">
              <CheckCircleIcon className="w-5 h-5 flex-shrink-0" />
              {success}
            </div>
          )}
          {formError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl mb-5 text-red-400 text-sm">
              <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0" />
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Name */}
            <div>
              <label className="label-text">Full Name <span className="text-red-400">*</span></label>
              <input
                name="full_name"
                value={form.full_name}
                onChange={handleField}
                placeholder="Officer full name"
                className="input-field"
              />
            </div>

            {/* Email */}
            <div>
              <label className="label-text">Email Address <span className="text-red-400">*</span></label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleField}
                placeholder="officer@municipality.gov"
                className="input-field"
              />
            </div>

            {/* Password */}
            <div>
              <label className="label-text">Password <span className="text-red-400">*</span></label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleField}
                  placeholder="Min. 6 characters"
                  className="input-field pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                  tabIndex={-1}
                >
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* City */}
            <div>
              <label className="label-text">City <span className="text-red-400">*</span></label>
              <select
                name="city"
                value={form.city}
                onChange={handleField}
                className="input-field"
              >
                <option value="">Select city…</option>
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Gender + DOB side by side */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-text">Gender <span className="text-red-400">*</span></label>
                <select
                  name="gender"
                  value={form.gender}
                  onChange={handleField}
                  className="input-field"
                >
                  <option value="">Select…</option>
                  {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="label-text">Date of Birth <span className="text-red-400">*</span></label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={form.date_of_birth}
                  onChange={handleField}
                  className="input-field"
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            {/* Document upload — optional */}
            <div>
              <label className="label-text flex items-center gap-1">
                <DocumentArrowUpIcon className="w-4 h-4" />
                Government Document
                <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={handleFile}
                className="block w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-gray-700 file:text-gray-300 hover:file:bg-gray-600 file:cursor-pointer cursor-pointer mt-1"
              />
              {form.document && (
                <p className="text-xs text-gray-400 mt-1 truncate">
                  Selected: {form.document.name}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 !mt-6"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Registering…
                </>
              ) : (
                <>
                  <UserPlusIcon className="w-4 h-4" />
                  Register Officer
                </>
              )}
            </button>
          </form>
        </div>

        {/* ── Officer list ── */}
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-5">
            Registered Officers ({officers.length})
          </h2>

          {listLoading ? (
            <div className="flex items-center justify-center h-40 gap-2 text-gray-400 text-sm">
              <span className="w-4 h-4 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
              Loading…
            </div>
          ) : officers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <UserGroupIcon className="w-10 h-10 text-gray-600 mb-2" />
              <p className="text-gray-400 text-sm">No officers registered yet.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {officers.map(o => (
                <div
                  key={o.id}
                  className="flex items-center justify-between gap-3 p-3 bg-gray-800/50 rounded-xl border border-gray-700/40"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-purple-400">
                        {o.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{o.full_name}</p>
                      <p className="text-xs text-gray-400 truncate">{o.email}</p>
                      {o.city && (
                        <p className="text-xs text-blue-400">{o.city}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(o.id, o.full_name)}
                    className="flex-shrink-0 p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Remove officer"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Root AdminDashboard ───────────────────────────────────────────────────
export default function AdminDashboard() {
  const [view, setView]           = useState('dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const [officerCount, setCount]  = useState(0)

  // Load officer count for the dashboard stat card
  useEffect(() => {
    adminAPI.listOfficers()
      .then(r => setCount(Array.isArray(r.data) ? r.data.length : 0))
      .catch(() => {})
  }, [view]) // refresh when switching back to dashboard

  return (
    <div className="flex h-screen bg-gray-900 overflow-hidden">
      <AdminSidebar
        view={view}
        setView={setView}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-6xl mx-auto">
          {view === 'dashboard'
            ? <DashboardView officerCount={officerCount} setView={setView} />
            : <OfficersView />}
        </div>
      </main>
    </div>
  )
}
