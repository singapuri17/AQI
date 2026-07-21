import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CloudIcon, EyeIcon, EyeSlashIcon, UserIcon, BuildingOffice2Icon } from '@heroicons/react/24/outline'
import { authAPI } from '../api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const CITIES = ['Ahmedabad', 'Surat', 'Vadodara']

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'citizen',
    city: 'Ahmedabad',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuthStore()

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const validate = () => {
    if (!form.name.trim()) return 'Name is required'
    if (!form.email.includes('@')) return 'Enter a valid email'
    if (form.password.length < 6) return 'Password must be at least 6 characters'
    if (form.password !== form.confirmPassword) return 'Passwords do not match'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const err = validate()
    if (err) { toast.error(err); return }
    setLoading(true)
    try {
      const res = await authAPI.register({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        city: form.city,
      })
      const { access_token, user } = res.data
      login(user, access_token)
      toast.success(`Welcome, ${user.full_name}! Redirecting…`)
      navigate(user.role === 'government' ? '/government' : '/citizen', { replace: true })
    } catch (err) {
      const msg = err.response?.data?.detail || 'Registration failed. Try a different email.'
      toast.error(Array.isArray(msg) ? msg[0]?.msg || 'Validation error' : msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4 py-8">
      <div className="absolute inset-0 overflow-hidden -z-10">
        <div className="absolute top-0 right-1/3 w-96 h-96 bg-blue-700/15 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-teal-700/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <CloudIcon className="w-7 h-7 text-blue-400" />
            </div>
            <span className="text-2xl font-bold text-white">UAQIIS</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-gray-400 text-sm mt-1">Join the air quality monitoring network</p>
        </div>

        <div className="glass-card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label-text">Full Name</label>
              <input
                type="text" name="name" value={form.name} onChange={handleChange}
                placeholder="John Doe" className="input-field" required
              />
            </div>

            <div>
              <label className="label-text">Email address</label>
              <input
                type="email" name="email" value={form.email} onChange={handleChange}
                placeholder="you@example.com" className="input-field" required
              />
            </div>

            <div>
              <label className="label-text">Role</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'citizen', label: 'Citizen', icon: UserIcon, desc: 'Personal use & health monitoring' },
                  { value: 'government', label: 'Government', icon: BuildingOffice2Icon, desc: 'Policy & intervention management' },
                ].map(({ value, label, icon: Icon, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, role: value }))}
                    className={clsx(
                      'p-3 rounded-lg border text-left transition-all',
                      form.role === value
                        ? value === 'government'
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-blue-500 bg-blue-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                    )}
                  >
                    <Icon className={clsx('w-5 h-5 mb-1.5',
                      form.role === value
                        ? value === 'government' ? 'text-purple-400' : 'text-blue-400'
                        : 'text-gray-400'
                    )} />
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label-text">City</label>
              <select name="city" value={form.city} onChange={handleChange} className="input-field">
                {CITIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {form.role === 'government'
                  ? 'You will manage air quality data for this city'
                  : 'Your city for localised AQI and health alerts'}
              </p>
            </div>

            <div>
              <label className="label-text">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password" value={form.password} onChange={handleChange}
                  placeholder="Min 6 characters" className="input-field pr-10" required
                />
                <button type="button" onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200">
                  {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="label-text">Confirm Password</label>
              <input
                type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange}
                placeholder="Repeat password" className="input-field" required
              />
              {form.confirmPassword && form.password !== form.confirmPassword && (
                <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
              )}
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating account...</>
              ) : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
