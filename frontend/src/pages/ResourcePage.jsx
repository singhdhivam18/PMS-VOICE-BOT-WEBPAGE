import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowDownWideNarrow, ChevronLeft, ChevronRight, CirclePlus, Download, Edit3, Eye, FileAudio, Headphones, LoaderCircle, Plus, Search, ShieldCheck, X } from 'lucide-react'
import { api, fetchAll } from '../api/client.js'

const resourceDefinitions = {
  languages: {
    title: 'Languages', eyebrow: 'REFERENCE DATA', description: 'Maintain the languages supported by your driver outreach workflow.', icon: 'Languages', searchable: true,
    columns: [{ key: 'name', label: 'Language' }, { key: 'code', label: 'Code', mono: true }, { key: 'created_at', label: 'Created', type: 'date' }],
    fields: [{ name: 'name', label: 'Language name', required: true, maxLength: 50 }, { name: 'code', label: 'Language code', required: true, maxLength: 5, placeholder: 'e.g. en, hi, kn' }],
  },
  drivers: {
    title: 'Drivers', eyebrow: 'PEOPLE & PREFERENCES', description: 'Manage driver contact details, language preferences and call restrictions.', icon: 'Users', searchable: true,
    columns: [{ key: 'name', label: 'Driver' }, { key: 'phone', label: 'Phone number', mono: true }, { key: 'language_name', label: 'Preferred language' }, { key: 'language_source', label: 'Language source', type: 'tag' }, { key: 'do_not_call', label: 'Call allowed', type: 'call-flag' }],
    fields: [
      { name: 'name', label: 'Full name', required: true, maxLength: 100 },
      { name: 'phone', label: 'Phone (international format)', required: true, placeholder: '+919876543210', help: 'Must start with + and country code.' },
      { name: 'preferred_language_id', label: 'Preferred language', type: 'select', optionsEndpoint: 'languages', optionLabel: 'name', required: true },
      { name: 'language_source', label: 'Language source', type: 'select', options: [{ value: 'default', label: 'Default' }, { value: 'manual', label: 'Manual' }, { value: 'detected', label: 'Detected' }], defaultValue: 'default', required: true },
      { name: 'do_not_call', label: 'Do not call this driver', type: 'checkbox', defaultValue: false },
    ],
  },
  vehicles: {
    title: 'Vehicles', eyebrow: 'FLEET DIRECTORY', description: 'Track registration numbers, assigned drivers and active fleet vehicles.', icon: 'CarFront', searchable: true,
    columns: [{ key: 'registration_no', label: 'Registration number', mono: true }, { key: 'driver_name', label: 'Assigned driver' }, { key: 'is_active', label: 'Status', type: 'active' }, { key: 'created_at', label: 'Added', type: 'date' }],
    fields: [
      { name: 'registration_no', label: 'Registration number', required: true, maxLength: 20, placeholder: 'KA01AB1234' },
      { name: 'driver_id', label: 'Assigned driver', type: 'select', optionsEndpoint: 'drivers', optionLabel: 'name', allowEmpty: true, emptyLabel: 'Unassigned' },
      { name: 'is_active', label: 'Vehicle is active', type: 'checkbox', defaultValue: true },
    ],
  },
  'vehicle-services': {
    title: 'Vehicle Services', eyebrow: 'MAINTENANCE PLANNING', description: 'Manage service due dates and maintenance records for each vehicle.', icon: 'Wrench', searchable: true,
    columns: [{ key: 'vehicle_registration_no', label: 'Vehicle', mono: true }, { key: 'maintenance_type', label: 'Maintenance type' }, { key: 'due_maintenance_date', label: 'Due date', type: 'date-only' }, { key: 'service_status', label: 'Service status', type: 'status' }, { key: 'call_attempts', label: 'Call attempts', align: 'right' }],
    fields: [
      { name: 'vehicle_id', label: 'Vehicle', type: 'select', optionsEndpoint: 'vehicles', optionLabel: 'registration_no', required: true },
      { name: 'due_maintenance_date', label: 'Maintenance due date', type: 'date', required: true },
      { name: 'maintenance_type', label: 'Maintenance type', type: 'select', options: [{ value: 'Regular Service', label: 'Regular Service' }, { value: 'Oil Change', label: 'Oil Change' }, { value: 'Repair', label: 'Repair' }, { value: 'Other', label: 'Other' }], required: true },
      { name: 'service_status', label: 'Service status', required: true, maxLength: 20, defaultValue: 'DUE', disabledOnCreate: true },
      { name: 'call_attempts', label: 'Call attempts', type: 'number', required: true, min: 0, defaultValue: 0, hideOnCreate: true },
    ],
  },
  'call-jobs': {
    title: 'Call Jobs', eyebrow: 'VOICE WORKFLOW', description: 'Inspect call job status and callback tracking from the voice automation pipeline.', icon: 'PhoneCall', searchable: true, readOnly: true,
    readOnlyMessage: 'Call jobs are read-only in this dashboard because their lifecycle is managed by the voice-calling workflow. This prevents manual edits from conflicting with workers and callbacks.',
    columns: [{ key: 'id', label: 'Job ID', format: (row) => `JOB-${row.id}`, mono: true }, { key: 'service_id', label: 'Service ID' }, { key: 'job_status', label: 'Job status', type: 'status' }, { key: 'callback_received', label: 'Callback', type: 'boolean' }, { key: 'correlation_id', label: 'Correlation ID', mono: true }, { key: 'created_at', label: 'Created', type: 'date' }], fields: [],
  },
  'call-job-events': {
    title: 'Job Events', eyebrow: 'AUDIT & HISTORY', description: 'Review status changes and system messages captured for call jobs.', icon: 'Activity', searchable: true, readOnly: true,
    readOnlyMessage: 'Job events are treated as an operational audit trail and are read-only in the admin dashboard.',
    columns: [{ key: 'id', label: 'Event ID', mono: true }, { key: 'job_id', label: 'Job ID', format: (row) => `JOB-${row.job_id}` }, { key: 'event_status', label: 'Event status', type: 'status' }, { key: 'system_message', label: 'System message', wide: true }, { key: 'event_occurred_at', label: 'Occurred at', type: 'date' }], fields: [],
  },
  appointments: {
    title: 'Appointments', eyebrow: 'SERVICE BOOKINGS', description: 'Review and maintain appointment dates, times, vehicle registration and depot details.', icon: 'CalendarDays', searchable: true,
    columns: [{ key: 'job_id', label: 'Job', format: (row) => `JOB-${row.job_id}` }, { key: 'appointment_date', label: 'Appointment date', type: 'date-only' }, { key: 'appointment_time', label: 'Time', type: 'time' }, { key: 'vehicle_registration_no', label: 'Vehicle', mono: true }, { key: 'depot', label: 'Depot' }],
    fields: [
      { name: 'job_id', label: 'Call job', type: 'select', optionsEndpoint: 'call-jobs', optionLabel: 'id', optionFormat: (row) => `JOB-${row.id} · ${row.job_status}`, required: true },
      { name: 'appointment_date', label: 'Appointment date', type: 'date', required: true },
      { name: 'appointment_time', label: 'Appointment time', type: 'time', required: true },
      { name: 'vehicle_registration_no', label: 'Vehicle registration', required: true, maxLength: 50 },
      { name: 'depot', label: 'Depot', maxLength: 150, placeholder: 'Depot or service centre' },
    ],
  },
  documents: {
    title: 'Documents', eyebrow: 'CALL ARTIFACTS', description: 'Inspect transcript and recording metadata linked to call jobs.', icon: 'FileAudio', searchable: true, readOnly: true,
    readOnlyMessage: 'Documents are read-only metadata. Use Listen to play recordings or View to inspect transcripts. Files are streamed through the authenticated backend; raw server paths are not exposed by the API.',
    columns: [{ key: 'job_id', label: 'Job', format: (row) => `JOB-${row.job_id}` }, { key: 'document_type', label: 'Type', type: 'document-type' }, { key: 'file_name', label: 'File name', mono: true, wide: true }, { key: 'created_at', label: 'Created', type: 'date' }], fields: [],
  },
}

function displayDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString([], { dateStyle: 'medium' })
}
function displayDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}
function getErrorMessage(error) {
  const data = error.response?.data
  if (!data) return error.code === 'ERR_NETWORK' ? 'Cannot reach Django. Confirm the backend is running and the API URL is correct.' : 'Something went wrong. Please try again.'
  if (typeof data.detail === 'string') return data.detail
  return Object.entries(data).map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(' ') : String(messages)}`).join(' · ')
}
function pillClass(value) {
  const v = String(value ?? '').toLowerCase()
  if (['completed', 'success', 'active', 'confirmed', 'received', 'true', 'transcript'].includes(v)) return 'status-success'
  if (['due', 'pending', 'scheduled', 'recording'].includes(v)) return 'status-warning'
  if (['failed', 'error', 'cancelled', 'inactive'].includes(v)) return 'status-danger'
  return 'status-neutral'
}
function Cell({ row, column }) {
  const raw = row[column.key]
  if (column.format) return <span className={column.mono ? 'mono' : ''}>{column.format(row) ?? '—'}</span>
  if (column.type === 'date') return <span>{displayDateTime(raw)}</span>
  if (column.type === 'date-only') return <span>{displayDate(raw)}</span>
  if (column.type === 'time') return <span>{raw ? String(raw).slice(0, 5) : '—'}</span>
  if (column.type === 'status') return <span className={`status-badge ${pillClass(raw)}`}>{raw || 'Unknown'}</span>
  if (column.type === 'document-type') return <span className="doc-type"><FileAudio size={14} />{raw || '—'}</span>
  if (column.type === 'active') return <span className={`status-badge ${raw ? 'status-success' : 'status-danger'}`}>{raw ? 'Active' : 'Inactive'}</span>
  if (column.type === 'boolean') return <span className={`status-badge ${raw ? 'status-success' : 'status-warning'}`}>{raw ? 'Received' : 'Waiting'}</span>
  if (column.type === 'call-flag') return <span className={`status-badge ${raw ? 'status-danger' : 'status-success'}`}>{raw ? 'Restricted' : 'Allowed'}</span>
  if (column.type === 'tag') return <span className="soft-tag">{raw || '—'}</span>
  if (raw === null || raw === undefined || raw === '') return <span className="cell-muted">—</span>
  return <span className={`${column.mono ? 'mono' : ''} ${column.wide ? 'long-value' : ''}`}>{String(raw)}</span>
}

export default function ResourcePage({ config }) {
  const definition = resourceDefinitions[config.endpoint]
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [searchText, setSearchText] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [count, setCount] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [hasPrevious, setHasPrevious] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [formValues, setFormValues] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [optionsByEndpoint, setOptionsByEndpoint] = useState({})
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewingDocument, setViewingDocument] = useState(null)
  const [viewerLoading, setViewerLoading] = useState(false)
  const [viewerError, setViewerError] = useState('')
  const [viewerText, setViewerText] = useState('')
  const [viewerMediaUrl, setViewerMediaUrl] = useState('')
  const [viewerMode, setViewerMode] = useState('text')

  const optionEndpoints = useMemo(() => [...new Set((definition.fields || []).map((field) => field.optionsEndpoint).filter(Boolean))], [definition])

  useEffect(() => () => {
    if (viewerMediaUrl) URL.revokeObjectURL(viewerMediaUrl)
  }, [viewerMediaUrl])

  const loadRows = useCallback(async () => {
    setBusy(true)
    setLoadError('')
    try {
      const { data } = await api.get(`/${config.endpoint}/`, { params: { page, search: appliedSearch || undefined } })
      if (Array.isArray(data)) {
        setRows(data); setCount(data.length); setHasNext(false); setHasPrevious(false)
      } else {
        setRows(data.results || []); setCount(data.count || 0); setHasNext(Boolean(data.next)); setHasPrevious(Boolean(data.previous))
      }
    } catch (error) {
      setLoadError(getErrorMessage(error))
      setRows([])
    } finally { setBusy(false) }
  }, [config.endpoint, page, appliedSearch])

  useEffect(() => { loadRows() }, [loadRows])
  useEffect(() => {
    let cancelled = false
    async function loadOptions() {
      const result = {}
      await Promise.all(optionEndpoints.map(async (endpoint) => {
        try { result[endpoint] = await fetchAll(`/${endpoint}/`) } catch { result[endpoint] = [] }
      }))
      if (!cancelled) setOptionsByEndpoint(result)
    }
    loadOptions()
    return () => { cancelled = true }
  }, [optionEndpoints])

  const openCreate = () => {
    setEditing(null)
    setFormValues(Object.fromEntries((definition.fields || []).map((field) => [field.name, field.defaultValue ?? (field.type === 'checkbox' ? false : '')])))
    setFormError('')
    setFormOpen(true)
  }
  const openEdit = (row) => {
    setEditing(row)
    setFormValues(Object.fromEntries((definition.fields || []).map((field) => [field.name, row[field.name] ?? (field.type === 'checkbox' ? false : '')])))
    setFormError('')
    setFormOpen(true)
  }
  const onFieldChange = (name, value) => setFormValues((current) => ({ ...current, [name]: value }))

  async function openDocument(row) {
    setViewingDocument(row)
    setViewerOpen(true)
    setViewerLoading(true)
    setViewerError('')
    setViewerText('')
    setViewerMediaUrl('')
    setViewerMode(row.document_type === 'RECORDING' ? 'audio' : 'text')
    try {
      const { data, headers } = await api.get(`/documents/${row.id}/content/`, {
        responseType: 'blob',
        timeout: 120000,
      })
      const blob = data instanceof Blob ? data : new Blob([data], { type: headers['content-type'] || '' })
      const objectUrl = URL.createObjectURL(blob)
      setViewerMediaUrl(objectUrl)
      if (row.document_type === 'RECORDING') {
        setViewerMode('audio')
      } else {
        setViewerMode('text')
        let text = await blob.text()
        if (row.file_name?.toLowerCase().endsWith('.json') || headers['content-type']?.includes('application/json')) {
          try { text = JSON.stringify(JSON.parse(text), null, 2) } catch { /* keep original transcript text */ }
        }
        setViewerText(text || 'The transcript file is empty.')
      }
    } catch (error) {
      const statusCode = error.response?.status
      setViewerError(
        statusCode === 404 ? 'The file was not found in the configured document storage. Check its stored path.' :
        statusCode === 503 ? 'Document storage is not configured. Check the selected Django storage backend and its settings.' :
        statusCode === 400 ? 'The stored file path is outside the permitted /upload/ directory.' :
        statusCode === 403 ? 'Django does not have permission to read this file.' :
        statusCode === 415 ? 'This audio format is not supported for browser playback.' :
        statusCode === 502 ? 'Django could not retrieve the file. Check the storage backend, SFTP connection or file permissions.' :
        getErrorMessage(error)
      )
    } finally {
      setViewerLoading(false)
    }
  }

  function closeDocumentViewer() {
    setViewerOpen(false)
    setViewingDocument(null)
    setViewerText('')
    setViewerMediaUrl('')
    setViewerError('')
  }

  async function submitForm(event) {
    event.preventDefault()
    setFormError('')
    setSaving(true)
    const payload = {}
    for (const field of definition.fields) {
      // Call attempts are intentionally omitted from create requests; Django supplies 0.
      if (!editing && field.hideOnCreate) continue
      let value = formValues[field.name]
      if (field.type === 'checkbox') value = Boolean(value)
      else if (field.type === 'number' && value !== '') value = Number(value)
      else if (field.type === 'select' && value === '' && field.allowEmpty) value = null
      else if (value === '' && !field.required) value = ''
      if (value !== undefined) payload[field.name] = value
    }
    try {
      if (editing) await api.patch(`/${config.endpoint}/${editing.id}/`, payload)
      else await api.post(`/${config.endpoint}/`, payload)
      setFormOpen(false)
      await loadRows()
    } catch (error) { setFormError(getErrorMessage(error)) }
    finally { setSaving(false) }
  }

  if (!definition) return <div className="page-alert">This resource page has not been configured yet.</div>
  const startRecord = count === 0 ? 0 : (page - 1) * 20 + 1
  const endRecord = Math.min(page * 20, count)
  const hasRowActions = !definition.readOnly || config.endpoint === 'documents'

  return <div className="resource-page">
    <div className="page-heading-row resource-heading"><div><div className="eyebrow">{definition.eyebrow}</div><h1>{definition.title}</h1><p>{definition.description}</p></div>{!definition.readOnly && <button className="primary-button" onClick={openCreate}><Plus size={17} /> Add {config.label.replace(/s$/, '')}</button>}</div>

    {definition.readOnly && <div className="read-only-note"><ShieldCheck size={18} /><div><strong>Read-only operational records</strong><p>{definition.readOnlyMessage}</p></div></div>}
    <section className="panel resource-panel">
      <div className="resource-toolbar"><div><h2>{definition.title} records</h2><p>{busy ? 'Loading records…' : `${count.toLocaleString()} record${count === 1 ? '' : 's'} found`}</p></div><form className="resource-search" onSubmit={(e) => { e.preventDefault(); setPage(1); setAppliedSearch(searchText.trim()) }}><Search size={16} /><input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder={`Search ${definition.title.toLowerCase()}…`} aria-label={`Search ${definition.title}`} /><button type="submit">Search</button></form></div>
      {loadError && <div className="inline-error"><AlertCircle size={17} /><span>{loadError}</span><button className="text-button" onClick={loadRows}>Retry</button></div>}
      <div className="table-wrap resource-table-wrap"><table className="data-table resource-table"><thead><tr>{definition.columns.map((column) => <th key={column.key} className={`${column.align === 'right' ? 'align-right' : ''} ${column.wide ? 'wide-col' : ''}`}>{column.label}{column.key === 'created_at' && <ArrowDownWideNarrow size={12} className="sort-hint" />}</th>)}{hasRowActions && <th className="action-head">Action</th>}</tr></thead><tbody>
        {busy ? <tr><td colSpan={definition.columns.length + (hasRowActions ? 1 : 0)}><div className="table-state"><LoaderCircle size={19} className="spin" /> Loading data from Django API…</div></td></tr> : rows.length === 0 ? <tr><td colSpan={definition.columns.length + (hasRowActions ? 1 : 0)}><div className="table-state empty-table-state"><div className="empty-icon"><Search size={20} /></div><strong>{loadError ? 'Records could not be loaded' : 'No records found'}</strong><span>{loadError ? 'Check your API connection and retry.' : appliedSearch ? 'Try a different search phrase.' : 'When records are available in PostgreSQL, they will show up here.'}</span>{!definition.readOnly && !loadError && <button className="secondary-button" onClick={openCreate}><CirclePlus size={15} /> Add the first record</button>}</div></td></tr> : rows.map((row) => <tr key={row.id}>{definition.columns.map((column) => <td key={column.key} className={`${column.align === 'right' ? 'align-right' : ''} ${column.wide ? 'wide-cell' : ''}`}><Cell row={row} column={column} /></td>)}{hasRowActions && <td>{config.endpoint === 'documents' ? <button className="row-action" onClick={() => openDocument(row)} aria-label={`${row.document_type === 'RECORDING' ? 'Listen to' : 'View'} document ${row.id}`} title={row.document_type === 'RECORDING' ? 'Listen to recording' : 'View transcript'}>{row.document_type === 'RECORDING' ? <><Headphones size={15} /> Listen</> : <><Eye size={15} /> View</>}</button> : <button className="row-action" onClick={() => openEdit(row)} aria-label={`Edit record ${row.id}`} title="Edit record"><Edit3 size={16} /> Edit</button>}</td>}</tr>)}
      </tbody></table></div>
      <div className="table-footer"><span>Showing <strong>{startRecord}–{endRecord}</strong> of <strong>{count}</strong></span><div className="pagination-controls"><button className="page-arrow" disabled={!hasPrevious || busy} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous page"><ChevronLeft size={17} /></button><span className="current-page">{page}</span><button className="page-arrow" disabled={!hasNext || busy} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight size={17} /></button></div></div>
    </section>
    <div className="resource-footnote"><ShieldCheck size={14} /><span>Changes are validated by Django and PostgreSQL constraints. Record deletion is not enabled in this starter.</span></div>

    {formOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false) }}><section className="form-modal" role="dialog" aria-modal="true" aria-labelledby="form-title"><div className="modal-header"><div><div className="eyebrow">{editing ? 'UPDATE RECORD' : 'NEW RECORD'}</div><h2 id="form-title">{editing ? `Edit ${definition.title.replace(/s$/, '')}` : `Add ${definition.title.replace(/s$/, '')}`}</h2><p>{editing ? 'Update the selected record details.' : 'Enter details to create a record in PostgreSQL.'}</p></div><button className="icon-button" onClick={() => setFormOpen(false)} aria-label="Close form"><X size={19} /></button></div>
      <form className="record-form" onSubmit={submitForm}><div className="form-grid">{definition.fields.filter((field) => !(field.hideOnCreate && !editing)).map((field) => <div key={field.name} className={`form-field ${field.type === 'checkbox' ? 'full-field checkbox-field' : ''}`}>
        {field.type === 'checkbox' ? <label className="checkbox-label"><input type="checkbox" checked={Boolean(formValues[field.name])} onChange={(e) => onFieldChange(field.name, e.target.checked)} /><span><strong>{field.label}</strong>{field.help && <small>{field.help}</small>}</span></label> : <>
          <label className="form-label" htmlFor={`field-${field.name}`}>{field.label}{field.required && <span className="required-mark"> *</span>}</label>
          {field.type === 'select' ? <select id={`field-${field.name}`} className="text-input" value={formValues[field.name] ?? ''} required={field.required} disabled={!editing && field.disabledOnCreate} onChange={(e) => onFieldChange(field.name, e.target.value)}><option value="">{field.allowEmpty ? (field.emptyLabel || 'None') : 'Select an option'}</option>{(field.options || (optionsByEndpoint[field.optionsEndpoint] || []).map((option) => ({ value: option.id, label: field.optionFormat ? field.optionFormat(option) : option[field.optionLabel] }))).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input id={`field-${field.name}`} className="text-input" type={field.type || 'text'} value={formValues[field.name] ?? ''} required={field.required} disabled={!editing && field.disabledOnCreate} maxLength={field.maxLength} min={field.min} placeholder={field.placeholder || ''} onChange={(e) => onFieldChange(field.name, e.target.value)} />}
          {field.help && <small className="field-help">{field.help}</small>}
        </>}
      </div>)}</div>
      {formError && <div className="form-error form-error-block"><AlertCircle size={16} /><span>{formError}</span></div>}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? <><LoaderCircle size={16} className="spin" /> Saving…</> : <><Plus size={16} /> {editing ? 'Save changes' : 'Create record'}</>}</button></div></form>
    </section></div>}

    {viewerOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDocumentViewer() }}><section className="form-modal document-modal" role="dialog" aria-modal="true" aria-labelledby="document-viewer-title"><div className="modal-header"><div><div className="eyebrow">CALL ARTIFACT</div><h2 id="document-viewer-title">{viewingDocument?.document_type === 'RECORDING' ? 'Listen to recording' : 'View transcript'}</h2><p>{viewingDocument?.file_name || 'Call document'} · Job {viewingDocument?.job_id ?? '—'}</p></div><button className="icon-button" onClick={closeDocumentViewer} aria-label="Close document viewer"><X size={19} /></button></div>
      <div className="document-viewer-body">
        {viewerLoading ? <div className="table-state"><LoaderCircle size={21} className="spin" /><strong>Loading file from the server…</strong><span>The file is retrieved through the authenticated Django API.</span></div> : viewerError ? <div className="form-error form-error-block"><AlertCircle size={17} /><span>{viewerError}</span></div> : viewerMode === 'audio' ? <div className="audio-viewer"><div className="audio-file-icon"><FileAudio size={27} /></div><strong>{viewingDocument?.file_name}</strong><p>Recording playback</p><audio controls autoPlay preload="metadata" src={viewerMediaUrl}>Your browser does not support audio playback.</audio></div> : <pre className="transcript-viewer">{viewerText}</pre>}
      </div>
      {!viewerLoading && !viewerError && viewerMediaUrl && <div className="modal-actions document-modal-actions"><a className="secondary-button download-document" href={viewerMediaUrl} download={viewingDocument?.file_name || 'call-document'}><Download size={15} /> Download file</a><button type="button" className="primary-button" onClick={closeDocumentViewer}>Done</button></div>}
    </section></div>}
  </div>
}
