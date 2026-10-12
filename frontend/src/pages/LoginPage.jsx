import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, LockKeyhole, PhoneCall } from 'lucide-react'
import axios from 'axios'
import { API_BASE_URL } from '../api/client.js'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  async function submit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { data } = await axios.post(`${API_BASE_URL}/auth/token/`, { username, password }, { timeout: 15000 })
      localStorage.setItem('voiceops_access', data.access)
      localStorage.setItem('voiceops_refresh', data.refresh)
      navigate(location.state?.from?.pathname || '/', { replace: true })
    } catch (err) {
      if (err.code === 'ERR_NETWORK') setError('Cannot reach the API. Start Django and check VITE_API_BASE_URL.')
      else setError('Sign-in failed. Check your username and password.')
    } finally { setBusy(false) }
  }

  return <div className="login-page">
    <div className="login-visual">
      <div className="login-brand"><span className="brand-mark"><PhoneCall size={20} /></span><span>VoiceOps</span></div>
      <div className="login-visual-copy"><div className="eyebrow"><span className="live-dot" /> FLEET SERVICE OPERATIONS</div><h1>Every vehicle.<br /><em>Every call.</em><br />In sync.</h1><p>One workspace to monitor maintenance schedules, driver outreach and service appointments.</p></div>
      <div className="login-visual-footer"><span>MAINTENANCE</span><b>·</b><span>VOICE AUTOMATION</span><b>·</b><span>APPOINTMENTS</span></div>
      <div className="decor-orbit orbit-one" /><div className="decor-orbit orbit-two" />
    </div>
    <div className="login-panel"><form className="login-form" onSubmit={submit}>
      <div className="login-mobile-brand"><span className="brand-mark"><PhoneCall size={20} /></span><span>VoiceOps</span></div>
      <div className="login-icon"><LockKeyhole size={22} /></div>
      <div className="eyebrow">ADMINISTRATOR ACCESS</div><h2>Welcome back</h2><p className="login-description">Sign in to continue to your operations dashboard.</p>
      <label className="form-label" htmlFor="username">Username</label><input id="username" className="text-input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your username" required />
      <label className="form-label form-label-spaced" htmlFor="password">Password</label><div className="password-wrap"><input id="password" className="text-input" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} className="password-toggle" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="primary-button login-submit" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} {!busy && <ArrowRight size={17} />}</button>
      <div className="login-secure-note"><LockKeyhole size={14} /> Secured with token-based authentication</div>
    </form><div className="login-footer">VOICEOPS ADMIN CONSOLE <span>·</span> DEVELOPMENT STARTER</div></div>
  </div>
}
