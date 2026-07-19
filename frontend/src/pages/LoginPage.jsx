import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CloudIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '../store/authStore'
import { authAPI } from '../api'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) {
      toast.error('Please fill in all fields')
      return
    }
    setLoading(true)
    try {
      // Step 1: Login — get token + user in one response
      const res = await authAPI.login(form.email, form.password)
      const { access_token, user } = res.data

      // Step 2: Store auth state
      login(user, access_token)

      // Step 3: Navigate based on role
      const displayName = user.full_name || user.email
      toast.success(`Welcome back, ${displayName}!`)
      navigate(user.role === 'government' ? '/government' : '/citizen', { replace: true })

    } catch (err) {
      const detail = err.response?.data?.detail
      const msg = Array.isArray(detail)
        ? detail[0]?.msg || 'Validation error'
        : detail || 'Login failed. Please check your credentials.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden -z-10">
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-blue-700/15 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/3 w-80 h-80 bg-cyan-700/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <CloudIcon className="w-7 h-7 text-blue-400" />
            </div>
            <span className="text-2xl font-bold text-white">UAQIIS</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-gray-400 text-sm mt-1">Sign in to your account to continue</p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label-text">Email address</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="input-field"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="label-text">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  className="input-field pr-10"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                >
                  {showPassword
                    ? <EyeSlashIcon className="w-5 h-5" />
                    : <EyeIcon className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Info banner */}
            <div className="flex items-center gap-3 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <CloudIcon className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <p className="text-sm text-blue-300">
                Your role (Citizen / Government) is set when you register.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium">
              Create one
            </Link>
          </p>
        </div>

        {/* Demo hint */}
        <p className="text-center text-xs text-gray-600 mt-4">
          Demo: register with any email · password min 6 chars
        </p>
      </div>
    </div>
  )
}
