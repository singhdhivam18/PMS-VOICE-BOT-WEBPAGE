import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { LayoutDashboard, Languages, Users, CarFront, Wrench, PhoneCall, Activity, CalendarDays, FileAudio } from 'lucide-react'
import AppShell from './components/AppShell.jsx'
import LoginPage from './pages/LoginPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import ResourcePage from './pages/ResourcePage.jsx'

const navItems = [
  { label: 'Overview', path: '/', icon: LayoutDashboard, kind: 'dashboard' },
  { label: 'Languages', path: '/languages', icon: Languages, endpoint: 'languages' },
  { label: 'Drivers', path: '/drivers', icon: Users, endpoint: 'drivers' },
  { label: 'Vehicles', path: '/vehicles', icon: CarFront, endpoint: 'vehicles' },
  { label: 'Vehicle Services', path: '/vehicle-services', icon: Wrench, endpoint: 'vehicle-services' },
  { label: 'Call Jobs', path: '/call-jobs', icon: PhoneCall, endpoint: 'call-jobs' },
  { label: 'Job Events', path: '/call-job-events', icon: Activity, endpoint: 'call-job-events' },
  { label: 'Appointments', path: '/appointments', icon: CalendarDays, endpoint: 'appointments' },
  { label: 'Documents', path: '/documents', icon: FileAudio, endpoint: 'documents' },
]

function RequireAuth({ children }) {
  const location = useLocation()
  if (!localStorage.getItem('voiceops_access')) return <Navigate to="/login" replace state={{ from: location }} />
  return children
}

function ProtectedShell({ children }) {
  return <RequireAuth><AppShell navItems={navItems}>{children}</AppShell></RequireAuth>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedShell><DashboardPage /></ProtectedShell>} />
      {navItems.filter((item) => item.endpoint).map((item) => (
        <Route key={item.path} path={item.path} element={
          <ProtectedShell><ResourcePage key={item.endpoint} config={item} /></ProtectedShell>
        } />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
