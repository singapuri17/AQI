import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CloudIcon,
  EyeIcon,
  EyeSlashIcon,
  ShieldCheckIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline'
import { useAuthStore } from '../store/authStore'
import { authAPI } from '../api'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [form, setForm]               = useState({ email: '', password: '' })
  const [showPassword, setShowPw]     = useState(false)
  const [loading, setLoading]         = useState(false)
  const [fieldError, setFieldError]   = useState('')
  const { login } = useAuthStore()
  const navigate  = useNavigate()

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    setFieldError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) {
      setFieldError('Please enter your email and password.')
      return
    }
    setLoading(true)
    setFieldError('')
    try {
      const res  = await authAPI.login(form.email, form.password)
      const { access_token, user } = res.data

      login(user, access_token)

      if (user.role === 'ADMIN') {
        navigate('/admin', { replace: true })
      } else if (user.role === 'OFFICER') {
        navigate('/government', { replace: true })
      } else {
        // Should never reach here — backend rejects non-admin/officer
        setFieldError('Invalid email or password.')
        useAuthStore.getState().logout()
      }
    } catch (err) {
      const detail = err.response?.data?.detail
      const msg = Array.isArray(detail)
        ? detail[0]?.msg || 'Invalid email or password.'
        : detail || 'Invalid email or password.'
      setFieldError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0   left-1/3  w-96 h-96 bg-purple-700/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/3 w-80 h-80 bg-blue-700/08  rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md">
        {/* Back to home */}
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-purple-500/15 rounded-2xl mb-5 border border-purple-500/20">
            <ShieldCheckIcon className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Government Portal</h1>
          <p className="text-gray-400 text-sm mt-1">
            Protected Authentication for Government Officers
          </p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          {/* Restricted-access notice */}
          <div className="flex items-start gap-3 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl mb-6">
            <LockClosedIcon className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300 leading-relaxed">
              Access to this portal is restricted to authorized municipal officers
              and system administrators.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Email */}
            <div>
              <label className="label-text">Email Address</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="officer@municipality.gov"
                className="input-field"
                autoComplete="email"
                autoFocus
              />
            </div>

            {/* Password */}
            <div>
              <label className="label-text">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  className="input-field pr-11"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword
                    ? <EyeSlashIcon className="w-5 h-5" />
                    : <EyeIcon       className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Inline error */}
            {fieldError && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {fieldError}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 mt-1"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  <ShieldCheckIcon className="w-4 h-4" />
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-600 mt-5">
          For public air quality data,{' '}
          <Link to="/citizen" className="text-blue-400 hover:text-blue-300">
            visit the citizen dashboard
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
