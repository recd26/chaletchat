import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'

import Home         from './pages/Home'
import Login        from './pages/Login'
import Register     from './pages/Register'
import Dashboard    from './pages/Dashboard'
import ProDashboard from './pages/ProDashboard'
import Paiement     from './pages/Paiement'
import NewChalet    from './pages/NewChalet'
import EditChalet   from './pages/EditChalet'

// Redirige après connexion selon le rôle
function RoleRedirect() {
  const { profile, loading } = useAuth()
  if (loading) return null
  if (!profile) return <Navigate to="/login" replace />
  return <Navigate to={profile.role === 'proprio' ? '/dashboard' : '/pro'} replace />
}

function AppRoutes() {
  return (
    <>
      <Navbar />
      <Routes>
        {/* Public */}
        <Route path="/"          element={<Home />} />
        <Route path="/login"     element={<Login />} />
        <Route path="/inscription" element={<Register />} />
        <Route path="/paiement"  element={<Paiement />} />

        {/* Redirige /dashboard selon le rôle */}
        <Route path="/accueil"   element={<RoleRedirect />} />

        {/* Propriétaire uniquement */}
        <Route path="/dashboard" element={
          <ProtectedRoute requiredRole="proprio">
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/nouveau-chalet" element={
          <ProtectedRoute requiredRole="proprio">
            <NewChalet />
          </ProtectedRoute>
        } />
        <Route path="/chalet/:id/editer" element={
          <ProtectedRoute requiredRole="proprio">
            <EditChalet />
          </ProtectedRoute>
        } />

        {/* Professionnel uniquement */}
        <Route path="/pro" element={
          <ProtectedRoute requiredRole="pro">
            <ProDashboard />
          </ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
