import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, Menu, PhoneCall, Search, LogOut, X } from 'lucide-react'

export default function AppShell({ navItems, children }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const current = navItems.find((item) => item.path === location.pathname) || navItems[0]
  const logout = () => {
    localStorage.removeItem('voiceops_access')
    localStorage.removeItem('voiceops_refresh')
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-frame">
      {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <span className="brand-mark"><PhoneCall size={20} /></span>
          <div><div className="brand-name">VoiceOps</div><div className="brand-subtitle">FLEET MANAGEMENT</div></div>
          <button className="icon-button sidebar-close" aria-label="Close menu" onClick={() => setMobileOpen(false)}><X size={18} /></button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon
            return <NavLink key={item.path} to={item.path} end={item.path === '/'} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} strokeWidth={1.8} /><span>{item.label}</span>{item.label === 'Call Jobs' && <span className="nav-dot" />}
            </NavLink>
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><div className="help-icon"><PhoneCall size={17} /></div><div><strong>Voice operations</strong><p>Monitor maintenance calls and bookings.</p></div></div>
          <div className="server-status"><span className="status-pulse" /> API connection is checked in the app</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
            <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{current.label}</strong></div>
          </div>
          <div className="topbar-right">
            <div className="top-search"><Search size={16} /><span>Voice bot operations</span><kbd>⌘ K</kbd></div>
            <button className="icon-button notification-button" aria-label="Notifications"><Bell size={18} /><i /></button>
            <div className="user-menu"><div className="avatar">VO</div><div className="user-copy"><strong>Administrator</strong><span>Operations</span></div><button className="icon-button user-chevron" onClick={logout} title="Sign out" aria-label="Sign out"><LogOut size={17} /></button><ChevronDown size={14} className="muted-chevron" /></div>
          </div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  )
}
