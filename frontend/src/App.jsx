import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import { useCityStore } from './store/cityStore'

import RegisterPage from './pages/RegisterPage'


import LandingPage        from './pages/LandingPage'
import LoginPage          from './pages/LoginPage'
import CitizenDashboard   from './pages/CitizenDashboard'
import GovernmentDashboard from './pages/GovernmentDashboard'
import AdminDashboard     from './pages/AdminDashboard'

import AQIMapPage      from './pages/citizen/AQIMapPage'
import PredictionsPage from './pages/citizen/PredictionsPage'
import HealthRiskPage  from './pages/citizen/HealthRiskPage'
import HospitalsPage   from './pages/citizen/HospitalsPage'

import HotspotsPage   from './pages/government/HotspotsPage'
import IndustriesPage from './pages/government/IndustriesPage'
import PriorityPage   from './pages/government/PriorityPage'
import ActionsPage    from './pages/government/ActionsPage'
import ReportsPage    from './pages/government/ReportsPage'

// ── Route guards ─────────────────────────────────────────────────────────

/** Only ADMIN users. */
function AdminRoute({ children }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'ADMIN') return <Navigate to="/" replace />
  return children
}

/** Only OFFICER users. */
function OfficerRoute({ children }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'OFFICER') return <Navigate to="/" replace />
  return children
}

// ── App ───────────────────────────────────────────────────────────────────

export default function App() {
  const { user } = useAuthStore()
  const { syncToUser } = useCityStore()

  // On app load, sync city to user's registered city
  useEffect(() => {
    if (user) syncToUser(user)
  }, [user, syncToUser])
  return (
    <Routes>
      {/* ── Public ── */}
      <Route path="/"      element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* ── Citizen — fully public ── */}
      <Route path="/citizen" element={<CitizenDashboard />}>
        <Route path="map"         element={<AQIMapPage />} />
        <Route path="predictions" element={<PredictionsPage />} />
        <Route path="health"      element={<HealthRiskPage />} />
        <Route path="hospitals"   element={<HospitalsPage />} />
      </Route>

      {/* ── Government officer ── */}
      <Route
        path="/government"
        element={<OfficerRoute><GovernmentDashboard /></OfficerRoute>}
      >
        <Route path="hotspots"   element={<HotspotsPage />} />
        <Route path="industries" element={<IndustriesPage />} />
        <Route path="priority"   element={<PriorityPage />} />
        <Route path="actions"    element={<ActionsPage />} />
        <Route path="reports"    element={<ReportsPage />} />
      </Route>

      {/* ── System administrator ── */}
      <Route
        path="/admin"
        element={<AdminRoute><AdminDashboard /></AdminRoute>}
      />
      {/* Keep /administration as an alias */}
      <Route
        path="/administration"
        element={<AdminRoute><AdminDashboard /></AdminRoute>}
      />

      {/* ── Catch-all ── */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
