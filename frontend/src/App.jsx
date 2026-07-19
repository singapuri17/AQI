import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import CitizenDashboard from './pages/CitizenDashboard'
import GovernmentDashboard from './pages/GovernmentDashboard'
import AQIMapPage from './pages/citizen/AQIMapPage'
import PredictionsPage from './pages/citizen/PredictionsPage'
import HealthRiskPage from './pages/citizen/HealthRiskPage'
import HospitalsPage from './pages/citizen/HospitalsPage'
import HotspotsPage from './pages/government/HotspotsPage'
import IndustriesPage from './pages/government/IndustriesPage'
import PriorityPage from './pages/government/PriorityPage'
import ActionsPage from './pages/government/ActionsPage'
import ReportsPage from './pages/government/ReportsPage'

function ProtectedRoute({ children, requiredRole }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (requiredRole && user?.role !== requiredRole) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/citizen"
        element={<ProtectedRoute requiredRole="citizen"><CitizenDashboard /></ProtectedRoute>}
      >
        <Route path="map" element={<AQIMapPage />} />
        <Route path="predictions" element={<PredictionsPage />} />
        <Route path="health" element={<HealthRiskPage />} />
        <Route path="hospitals" element={<HospitalsPage />} />
      </Route>

      <Route
        path="/government"
        element={<ProtectedRoute requiredRole="government"><GovernmentDashboard /></ProtectedRoute>}
      >
        <Route path="hotspots" element={<HotspotsPage />} />
        <Route path="industries" element={<IndustriesPage />} />
        <Route path="priority" element={<PriorityPage />} />
        <Route path="actions" element={<ActionsPage />} />
        <Route path="reports" element={<ReportsPage />} />
      </Route>
    </Routes>
  )
}
