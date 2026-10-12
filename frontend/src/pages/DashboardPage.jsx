import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarCheck2, CarFront, CheckCircle2, Clock3, PhoneCall, RefreshCw, Wrench } from 'lucide-react'
import { api } from '../api/client.js'

const metricCards = [
  { key: 'vehicles', label: 'Total vehicles', icon: CarFront, tone: 'blue', note: 'Registered in system' },
  { key: 'due_services', label: 'Services due', icon: Wrench, tone: 'amber', note: 'Maintenance to review' },
  { key: 'pending_jobs', label: 'Pending call jobs', icon: PhoneCall, tone: 'violet', note: 'Awaiting progress' },
  { key: 'appointments', label: 'Appointments', icon: CalendarCheck2, tone: 'green', note: 'Recorded bookings' },
]

function dateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

function statusClass(status = '') {
  const value = String(status).toLowerCase()
  if (['completed', 'success', 'confirmed', 'done'].includes(value)) return 'status-success'
  if (['pending', 'due', 'scheduled', 'queued'].includes(value)) return 'status-warning'
  if (['failed', 'error', 'cancelled'].includes(value)) return 'status-danger'
  return 'status-neutral'
}

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [apiStatus, setApiStatus] = useState('checking')
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const [dashboard] = await Promise.all([api.get('/dashboard/'), api.get('/health/')])
        if (alive) { setData(dashboard.data); setApiStatus('connected'); setError('') }
      } catch (err) {
        if (alive) {
          setApiStatus('error')
          setError(err.response?.status === 401 ? 'Your session may have expired. Sign in again.' : 'Unable to load dashboard data. Check the API and PostgreSQL connection.')
        }
      }
    }
    load()
    return () => { alive = false }
  }, [refreshKey])

  const counts = data?.counts || {}
  return <div className="dashboard-page">
    <div className="page-heading-row">
      <div><div className="eyebrow">OPERATIONS OVERVIEW</div><h1>Good evening, Administrator</h1><p>Here's what's happening across your fleet and voice operations.</p></div>
      <button className="secondary-button" onClick={() => setRefreshKey((v) => v + 1)}><RefreshCw size={16} /> Refresh data</button>
    </div>
    {error && <div className="page-alert"><span>{error}</span><Link to="/login">Sign in</Link></div>}

    <div className="section-heading"><div><h2>At a glance</h2><p>Live counts from your connected database</p></div><div className={`connection-pill ${apiStatus}`}><span />{apiStatus === 'connected' ? 'Database connected' : apiStatus === 'checking' ? 'Checking connection' : 'Connection issue'}</div></div>
    <div className="metric-grid">
      {metricCards.map((card) => { const Icon = card.icon; return <div className="metric-card" key={card.key}>
        <div className="metric-top"><span className={`metric-icon ${card.tone}`}><Icon size={19} /></span><span className="metric-menu">•••</span></div>
        <div className="metric-value">{data ? (counts[card.key] ?? 0).toLocaleString() : '—'}</div>
        <div className="metric-label">{card.label}</div><div className="metric-note">{card.note}</div>
      </div> })}
    </div>

    <div className="dashboard-columns">
      <section className="panel recent-panel">
        <div className="panel-heading"><div><h2>Recent call jobs</h2><p>Latest records from the calling workflow</p></div><Link className="text-link" to="/call-jobs">View all <ArrowRight size={15} /></Link></div>
        {data?.recent_jobs?.length ? <div className="table-wrap"><table className="data-table dashboard-table"><thead><tr><th>Job ID</th><th>Service</th><th>Status</th><th>Callback</th><th>Created</th></tr></thead><tbody>{data.recent_jobs.map((job) => <tr key={job.id}>
          <td><span className="id-cell">JOB-{job.id}</span></td><td>Service #{job.service_id}</td><td><span className={`status-badge ${statusClass(job.job_status)}`}>{job.job_status}</span></td><td>{job.callback_received ? <span className="callback-state done"><CheckCircle2 size={14} /> Received</span> : <span className="callback-state waiting"><Clock3 size={14} /> Waiting</span>}</td><td>{dateTime(job.created_at)}</td>
        </tr>)}</tbody></table></div> : <div className="empty-state"><div className="empty-icon"><Activity size={22} /></div><strong>{data ? 'No call jobs yet' : 'Loading your call jobs'}</strong><span>{data ? 'Call jobs will appear here when records exist in PostgreSQL.' : 'Fetching the latest records from the API.'}</span></div>}
      </section>
      <section className="panel summary-panel">
        <div className="panel-heading"><div><h2>Fleet summary</h2><p>Current record totals</p></div></div>
        <div className="summary-list">
          <div className="summary-item"><span className="summary-icon blue"><CarFront size={17} /></span><div className="summary-copy"><strong>Active vehicles</strong><span>Out of all registered vehicles</span></div><b>{data ? `${counts.active_vehicles ?? 0} / ${counts.vehicles ?? 0}` : '—'}</b></div>
          <div className="summary-item"><span className="summary-icon amber"><Wrench size={17} /></span><div className="summary-copy"><strong>Maintenance records</strong><span>Scheduled vehicle services</span></div><b>{data ? (counts.vehicle_services ?? 0).toLocaleString() : '—'}</b></div>
          <div className="summary-item"><span className="summary-icon violet"><PhoneCall size={17} /></span><div className="summary-copy"><strong>Total call jobs</strong><span>Tracked by the voice workflow</span></div><b>{data ? (counts.call_jobs ?? 0).toLocaleString() : '—'}</b></div>
        </div>
        <div className="summary-foot"><span className="status-pulse" /> Counts update when you refresh the dashboard.</div>
      </section>
    </div>

    <section className="quick-actions-section"><div className="panel-heading"><div><h2>Quick access</h2><p>Jump to commonly used areas</p></div></div><div className="quick-grid">
      <Link to="/vehicles" className="quick-card"><span className="quick-icon blue"><CarFront size={20} /></span><span><strong>Manage vehicles</strong><small>Registration and driver assignment</small></span><ArrowUpRight size={17} /></Link>
      <Link to="/vehicle-services" className="quick-card"><span className="quick-icon amber"><Wrench size={20} /></span><span><strong>Maintenance schedule</strong><small>Due dates and service status</small></span><ArrowDownRight size={17} /></Link>
      <Link to="/appointments" className="quick-card"><span className="quick-icon green"><CalendarCheck2 size={20} /></span><span><strong>Appointments</strong><small>View or update service bookings</small></span><ArrowUpRight size={17} /></Link>
    </div></section>
    <div className="page-bottom-note">VoiceOps Admin Console <span>·</span> Data displayed from the connected PostgreSQL schema</div>
  </div>
}
