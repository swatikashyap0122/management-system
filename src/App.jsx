import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { api } from './lib/api.js'

const categories = ['All events', 'Technology', 'Arts & culture', 'Career', 'Sports']

const dateLabel = (value, options = { month: 'short', day: 'numeric' }) =>
  new Intl.DateTimeFormat('en', options).format(new Date(value))

const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('campus_user') || 'null')
    } catch {
      return null
    }
  })
  const [events, setEvents] = useState([])
  const [registrations, setRegistrations] = useState([])
  const [adminRegistrations, setAdminRegistrations] = useState([])
  const [activeTab, setActiveTab] = useState('discover')
  const [category, setCategory] = useState('All events')
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState(null)
  const [editingEvent, setEditingEvent] = useState(null)
  const [notice, setNotice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const searchInputRef = useRef(null)

  const flash = useCallback((message, type = 'success') => {
    setNotice({ message, type })
    window.setTimeout(() => setNotice(null), 4200)
  }, [])

  const loadEvents = useCallback(async () => {
    const data = await api('/events')
    setEvents(data)
  }, [])

  const loadRegistrations = useCallback(async () => {
    if (!user) {
      setRegistrations([])
      setAdminRegistrations([])
      return
    }
    if (user.role === 'admin') {
      const data = await api('/admin/registrations')
      setAdminRegistrations(data)
    } else {
      const data = await api('/registrations/mine')
      setRegistrations(data)
    }
  }, [user])

  const reload = useCallback(async () => {
    try {
      await Promise.all([loadEvents(), loadRegistrations()])
    } catch (error) {
      flash(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [flash, loadEvents, loadRegistrations])

  useEffect(() => {
    let active = true
    const registrationsPath = user?.role === 'admin'
      ? '/admin/registrations'
      : user
        ? '/registrations/mine'
        : null
    Promise.all([
      api('/events'),
      registrationsPath ? api(registrationsPath) : Promise.resolve([]),
    ])
      .then(([eventData, registrationData]) => {
        if (!active) return
        setEvents(eventData)
        if (user?.role === 'admin') setAdminRegistrations(registrationData)
        else setRegistrations(registrationData)
      })
      .catch((error) => {
        if (active) flash(error.message, 'error')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [flash, user])

  useEffect(() => {
    function focusSearch(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return events.filter((event) => {
      const matchesCategory = category === 'All events' || event.category === category
      const matchesQuery =
        !normalizedQuery ||
        `${event.title} ${event.description} ${event.location} ${event.category}`
          .toLowerCase()
          .includes(normalizedQuery)
      return matchesCategory && matchesQuery
    })
  }, [category, events, query])

  const registeredIds = useMemo(
    () => new Set(registrations.map((registration) => Number(registration.event_id))),
    [registrations],
  )

  function saveSession(data) {
    localStorage.setItem('campus_token', data.token)
    localStorage.setItem('campus_user', JSON.stringify(data.user))
    setUser(data.user)
    setDialog(null)
    setActiveTab(data.user.role === 'admin' ? 'admin-events' : 'discover')
    flash(`Welcome ${data.user.full_name.split(' ')[0]}!`)
  }

  function signOut() {
    localStorage.removeItem('campus_token')
    localStorage.removeItem('campus_user')
    setUser(null)
    setRegistrations([])
    setAdminRegistrations([])
    setActiveTab('discover')
    flash('You have been signed out.')
  }

  async function registerForEvent(event) {
    if (!user) {
      setDialog({ type: 'auth', mode: 'login' })
      flash('Sign in as a student to reserve your spot.', 'error')
      return
    }
    if (user.role !== 'student') {
      flash('Student accounts are required to register for events.', 'error')
      return
    }
    setBusy(true)
    try {
      await api(`/events/${event.id}/register`, { method: 'POST' })
      await Promise.all([loadEvents(), loadRegistrations()])
      setDialog(null)
      flash(`You're registered for ${event.title}.`)
    } catch (error) {
      flash(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function deleteEvent(event) {
    if (!window.confirm(`Delete "${event.title}" and its registrations?`)) return
    try {
      await api(`/events/${event.id}`, { method: 'DELETE' })
      await reload()
      flash('Event deleted.')
    } catch (error) {
      flash(error.message, 'error')
    }
  }

  async function deleteRegistration(registration) {
    if (!window.confirm(`Remove ${registration.student_name}'s registration?`)) return
    try {
      await api(`/admin/registrations/${registration.id}`, { method: 'DELETE' })
      await loadRegistrations()
      await loadEvents()
      flash('Registration removed.')
    } catch (error) {
      flash(error.message, 'error')
    }
  }

  const isAdmin = user?.role === 'admin'
  const pageTitle =
    activeTab === 'my-events'
      ? 'My registrations'
      : activeTab === 'admin-registrations'
        ? 'Event registrations'
        : activeTab === 'admin-events'
          ? 'Event management'
          : 'Discover events'

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={() => setActiveTab('discover')} aria-label="Campusly home">
          <span className="brand-mark">C</span>
          <span>campusly<span className="brand-period">.</span></span>
        </a>
        <nav className="top-nav" aria-label="Main navigation">
          <button className={activeTab === 'discover' ? 'nav-link active' : 'nav-link'} onClick={() => setActiveTab('discover')}>Discover</button>
          {user?.role === 'student' && (
            <button className={activeTab === 'my-events' ? 'nav-link active' : 'nav-link'} onClick={() => setActiveTab('my-events')}>My events</button>
          )}
          {isAdmin && (
            <>
              <button className={activeTab === 'admin-events' ? 'nav-link active' : 'nav-link'} onClick={() => setActiveTab('admin-events')}>Manage events</button>
              <button className={activeTab === 'admin-registrations' ? 'nav-link active' : 'nav-link'} onClick={() => setActiveTab('admin-registrations')}>Registrations</button>
            </>
          )}
        </nav>
        <div className="top-actions">
          {user ? (
            <>
              <span className="user-chip"><span className="avatar">{initials(user.full_name)}</span><span className="user-name">{user.full_name.split(' ')[0]}</span></span>
              <button className="button button-outline button-small" onClick={signOut}>Sign out</button>
            </>
          ) : (
            <>
              <button className="button button-quiet button-small" onClick={() => setDialog({ type: 'auth', mode: 'login' })}>Log in</button>
              <button className="button button-dark button-small" onClick={() => setDialog({ type: 'auth', mode: 'register' })}>Join campusly <span aria-hidden="true">↗</span></button>
            </>
          )}
        </div>
      </header>

      <main>
        {activeTab === 'discover' && (
          <>
            <section className="hero">
              <div className="hero-content">
                <div className="eyebrow"><span className="live-dot" /> YOUR CAMPUS, MORE ALIVE</div>
                <h1>Make room for<br /><span>something great.</span></h1>
                <p className="hero-copy">The best moments on campus don't happen between classes. Find your people, try something new, and make this semester count.</p>
                <div className="hero-actions">
                  <a className="button button-dark button-large" href="#events">Explore events <span aria-hidden="true">↓</span></a>
                  {!user && <button className="button button-text button-large" onClick={() => setDialog({ type: 'auth', mode: 'register' })}>Create your account <span aria-hidden="true">↗</span></button>}
                </div>
                <div className="hero-proof"><div className="proof-avatars"><span>R</span><span>A</span><span>M</span><span>+</span></div><span>Join students making campus unforgettable</span></div>
              </div>
              <div className="hero-art">
                <div className="art-glow" />
                <div className="art-image" role="img" aria-label="Students at a campus event" />
                <div className="art-note"><span className="note-icon">✳</span><span><strong>Good things happen</strong><small>when we show up.</small></span></div>
                <span className="art-sticker">MAKE<br />IT COUNT</span>
              </div>
              <span className="hero-index">01 — CAMPUS LIFE, UNLOCKED</span>
            </section>

            <section className="upcoming-strip">
              <div><span className="strip-label">THE GOOD STUFF</span><strong>{events.length} ways to make your week better</strong></div>
              <a href="#events">See what's happening <span>↘</span></a>
            </section>
          </>
        )}

        <section className="events-section" id="events">
          <div className="section-heading">
            <div>
              <div className="eyebrow">{activeTab === 'discover' ? 'A LITTLE SOMETHING FOR EVERYONE' : 'YOUR CAMPUS, YOUR CALENDAR'}</div>
              <h2>{activeTab === 'discover' ? <>Find your <span>next thing.</span></> : pageTitle}</h2>
            </div>
            {isAdmin && activeTab === 'admin-events' && (
              <button className="button button-dark" onClick={() => { setEditingEvent(null); setDialog({ type: 'event' }) }}>＋ Create event</button>
            )}
          </div>

          {activeTab === 'discover' && (
            <div className="event-toolbar">
              <div className="category-list" role="group" aria-label="Filter by category">
                {categories.map((item) => <button key={item} className={category === item ? 'category-pill selected' : 'category-pill'} onClick={() => setCategory(item)}>{item}</button>)}
              </div>
              <label className="search-box"><span aria-hidden="true">⌕</span><input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find your thing..." aria-label="Search events" /><kbd>⌘ K</kbd></label>
            </div>
          )}

          {activeTab === 'my-events' && (
            <p className="section-subtitle">All the good things you've signed up for.</p>
          )}
          {activeTab === 'admin-registrations' && (
            <p className="section-subtitle">See who's coming and manage event sign-ups.</p>
          )}
          {activeTab === 'admin-events' && (
            <p className="section-subtitle">Keep your campus calendar fresh and exciting.</p>
          )}

          {activeTab === 'admin-registrations' ? (
            <RegistrationTable registrations={adminRegistrations} onDelete={deleteRegistration} />
          ) : (
            <div className="event-grid">
              {loading ? (
                <div className="empty-state"><span className="loading-spinner" /> Loading campus events...</div>
              ) : (
                <EventList
                  events={activeTab === 'my-events' ? registrations.map((registration) => registration.event) : filteredEvents}
                  isAdmin={isAdmin && activeTab === 'admin-events'}
                  isRegistered={registeredIds}
                  onOpen={(event) => setDialog({ type: 'details', event })}
                  onEdit={(event) => { setEditingEvent(event); setDialog({ type: 'event' }) }}
                  onDelete={deleteEvent}
                />
              )}
            </div>
          )}

          {!loading && activeTab === 'discover' && filteredEvents.length === 0 && (
            <div className="empty-state"><span className="empty-icon">✳</span><strong>Nothing on the calendar just yet.</strong><p>Try a different search or check back soon.</p></div>
          )}
          {!loading && activeTab === 'my-events' && registrations.length === 0 && (
            <div className="empty-state"><span className="empty-icon">✳</span><strong>Your next great memory is out there.</strong><p>Browse events and save yourself a spot.</p><button className="button button-dark" onClick={() => setActiveTab('discover')}>Find an event</button></div>
          )}
        </section>

        <footer className="footer">
          <a className="brand footer-brand" href="#" onClick={() => setActiveTab('discover')}><span className="brand-mark">C</span><span>campusly<span className="brand-period">.</span></span></a>
          <span>Made for the moments between lectures.</span>
          <span>© {new Date().getFullYear()} Campusly</span>
        </footer>
      </main>

      {notice && <div className={`toast ${notice.type}`} role="status"><span>{notice.type === 'success' ? '✓' : '!'}</span>{notice.message}<button aria-label="Dismiss notification" onClick={() => setNotice(null)}>×</button></div>}

      {dialog?.type === 'auth' && (
        <AuthDialog
          mode={dialog.mode}
          setMode={(mode) => setDialog({ type: 'auth', mode })}
          onClose={() => setDialog(null)}
          onSubmit={async (form) => {
            setBusy(true)
            try {
              const data = await api(`/auth/${dialog.mode === 'register' ? 'register' : 'login'}`, { method: 'POST', body: form, auth: false })
              saveSession(data)
            } finally {
              setBusy(false)
            }
          }}
          busy={busy}
        />
      )}
      {dialog?.type === 'details' && (
        <EventDetails
          event={dialog.event}
          isRegistered={registeredIds.has(Number(dialog.event.id))}
          onClose={() => setDialog(null)}
          onRegister={() => registerForEvent(dialog.event)}
          busy={busy}
          isAdmin={isAdmin}
        />
      )}
      {dialog?.type === 'event' && (
        <EventForm
          event={editingEvent}
          onClose={() => setDialog(null)}
          onSubmit={async (form) => {
            setBusy(true)
            try {
              await api(editingEvent ? `/events/${editingEvent.id}` : '/events', {
                method: editingEvent ? 'PUT' : 'POST',
                body: form,
              })
              await loadEvents()
              setDialog(null)
              flash(editingEvent ? 'Event updated.' : 'Your event is live!')
            } catch (error) {
              flash(error.message, 'error')
            } finally {
              setBusy(false)
            }
          }}
          busy={busy}
        />
      )}
    </div>
  )
}

function EventList({ events, isAdmin, isRegistered, onOpen, onEdit, onDelete }) {
  if (!events.length) return null
  return events.map((event, index) => {
    const filled = Number(event.registration_count || 0)
    const percent = Math.min(100, Math.round((filled / Math.max(1, Number(event.capacity))) * 100))
    return (
      <article className="event-card" key={event.id} style={{ '--card-delay': `${index * 70}ms` }}>
        <button className="event-visual" onClick={() => onOpen(event)} style={{ '--event-image': `url("${event.image_url || 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1000&q=85'}")` }} aria-label={`View ${event.title} details`}>
          <span className={`event-tag tag-${event.category.toLowerCase().replace(/[^a-z]+/g, '-')}`}>{event.category}</span>
          <span className="visual-date"><strong>{dateLabel(event.event_date, { day: '2-digit' })}</strong><small>{dateLabel(event.event_date, { month: 'short' }).toUpperCase()}</small></span>
          <span className="visual-arrow">↗</span>
        </button>
        <div className="event-card-body">
          <div className="event-card-meta"><span>◷ &nbsp;{dateLabel(event.event_date, { hour: 'numeric', minute: '2-digit' })}</span><span>⌖ &nbsp;{event.location}</span></div>
          <button className="event-title" onClick={() => onOpen(event)}>{event.title}</button>
          <p className="event-description">{event.description}</p>
          <div className="event-card-bottom">
            <div className="capacity"><div className="capacity-track"><span style={{ width: `${percent}%` }} /></div><small>{Math.max(0, Number(event.capacity) - filled)} spots left</small></div>
            {isAdmin ? (
              <div className="admin-actions"><button onClick={() => onEdit(event)} aria-label={`Edit ${event.title}`}>Edit</button><button onClick={() => onDelete(event)} aria-label={`Delete ${event.title}`}>Delete</button></div>
            ) : isRegistered.has(Number(event.id)) ? (
              <span className="registered-label">✓ Going</span>
            ) : (
              <button className="card-action" onClick={() => onOpen(event)} aria-label={`Register for ${event.title}`}>↗</button>
            )}
          </div>
        </div>
      </article>
    )
  })
}

function AuthDialog({ mode, setMode, onClose, onSubmit, busy }) {
  const [form, setForm] = useState({ fullName: '', email: '', studentId: '', password: '', role: 'student' })
  const [error, setError] = useState('')
  const register = mode === 'register'
  async function submit(event) {
    event.preventDefault()
    setError('')
    try {
      await onSubmit({
        ...form,
        fullName: form.fullName.trim(),
        email: form.email.trim(),
      })
    } catch (submitError) {
      setError(submitError.message)
    }
  }
  return (
    <Modal onClose={onClose} wide={false}>
      <div className="auth-panel">
        <div className="dialog-eyebrow"><span className="brand-mark small">C</span> A PLACE TO BELONG</div>
        <h2>{register ? 'Your campus story starts here.' : 'Good to have you back.'}</h2>
        <p>{register ? 'Find your people. Save your spot. Make it count.' : 'Sign in and get back to the good stuff.'}</p>
        <div className="auth-switch">
          <button className={form.role === 'student' ? 'active' : ''} onClick={() => setForm((value) => ({ ...value, role: 'student' }))}>Student</button>
          <button className={form.role === 'admin' ? 'active' : ''} onClick={() => { setForm((value) => ({ ...value, role: 'admin' })); setMode('login') }}>Administrator</button>
        </div>
        <form className="dialog-form" onSubmit={submit}>
          {register && form.role === 'student' && <Field label="Full name" name="fullName" placeholder="e.g. Alex Morgan" value={form.fullName} onChange={setForm} required />}
          <Field label="College email" name="email" type="email" placeholder="you@college.edu" value={form.email} onChange={setForm} required />
          {register && form.role === 'student' && <Field label="Student ID" name="studentId" placeholder="Your student ID" value={form.studentId} onChange={setForm} required />}
          <Field label="Password" name="password" type="password" placeholder="At least 8 characters" value={form.password} onChange={setForm} required minLength={8} />
          {error && <p className="form-error">{error}</p>}
          <button className="button button-dark button-submit" disabled={busy}>{busy ? 'Just a moment...' : register ? 'Create my account ↗' : 'Sign in ↗'}</button>
        </form>
        {form.role === 'admin' && <p className="auth-hint">Admin account must be created with the backend seed command.</p>}
        {form.role === 'student' && <p className="auth-footer">{register ? 'Already part of the campus?' : 'New around here?'} <button onClick={() => setMode(register ? 'login' : 'register')}>{register ? 'Log in' : 'Create an account'}</button></p>}
      </div>
    </Modal>
  )
}

function Field({ label, name, onChange, value, ...props }) {
  return <label className="form-field"><span>{label}</span><input name={name} value={value} onChange={(event) => onChange((previous) => ({ ...previous, [name]: event.target.value }))} {...props} /></label>
}

function EventForm({ event, onClose, onSubmit, busy }) {
  const eventDate = event?.event_date ? new Date(event.event_date) : null
  const localDate = eventDate
    ? new Date(eventDate.getTime() - eventDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    : ''
  const [form, setForm] = useState({
    title: event?.title || '',
    category: event?.category || 'Technology',
    description: event?.description || '',
    eventDate: localDate,
    location: event?.location || '',
    capacity: event?.capacity || '',
    imageUrl: event?.image_url || '',
  })
  return (
    <Modal onClose={onClose} wide={false}>
      <div className="form-dialog">
        <div className="dialog-eyebrow">CAMPUSLY / EVENT STUDIO</div>
        <h2>{event ? 'Make it even better.' : 'Let’s make it happen.'}</h2>
        <p>{event ? 'Update your event details below.' : 'Add something worth showing up for.'}</p>
        <form className="dialog-form" onSubmit={(submitEvent) => { submitEvent.preventDefault(); onSubmit(form) }}>
          <Field label="Event name" name="title" placeholder="A name people won't forget" value={form.title} onChange={setForm} required maxLength={120} />
          <label className="form-field"><span>Category</span><select value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}>{categories.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="form-field"><span>What’s it about?</span><textarea rows="3" maxLength="2000" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} required placeholder="Give students a reason to be curious..." /></label>
          <div className="form-row">
            <Field label="Date & time" name="eventDate" type="datetime-local" value={form.eventDate} onChange={setForm} required />
            <Field label="Capacity" name="capacity" type="number" min="1" max="100000" value={form.capacity} onChange={setForm} required />
          </div>
          <Field label="Where is it?" name="location" placeholder="e.g. Innovation Hall" value={form.location} onChange={setForm} required maxLength={180} />
          <Field label="Cover image URL (optional)" name="imageUrl" type="url" placeholder="https://..." value={form.imageUrl} onChange={setForm} />
          <button className="button button-dark button-submit" disabled={busy}>{busy ? 'Saving...' : event ? 'Save changes ↗' : 'Publish event ↗'}</button>
        </form>
      </div>
    </Modal>
  )
}

function EventDetails({ event, isRegistered, onClose, onRegister, busy, isAdmin }) {
  const filled = Number(event.registration_count || 0)
  const full = filled >= Number(event.capacity)
  return (
    <Modal onClose={onClose} wide>
      <div className="details-layout">
        <div className="details-image" style={{ '--event-image': `url("${event.image_url || ''}")` }}>
          <span className={`event-tag tag-${event.category.toLowerCase().replace(/[^a-z]+/g, '-')}`}>{event.category}</span>
        </div>
        <div className="details-content">
          <div className="dialog-eyebrow">A CAMPUSLY PICK · {dateLabel(event.event_date).toUpperCase()}</div>
          <h2>{event.title}</h2>
          <p className="details-description">{event.description}</p>
          <div className="details-facts"><span>◷ <strong>{dateLabel(event.event_date, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</strong></span><span>⌖ <strong>{event.location}</strong></span><span>◉ <strong>{Math.max(0, Number(event.capacity) - filled)} spots left</strong></span></div>
          {!isAdmin && <button className="button button-dark button-submit" onClick={onRegister} disabled={busy || isRegistered || full}>{isRegistered ? '✓ You’re on the list' : full ? 'All spots are taken' : busy ? 'Saving your spot...' : 'Count me in ↗'}</button>}
          {isAdmin && <p className="admin-detail-note">Admin view · {filled} of {event.capacity} spots reserved</p>}
        </div>
      </div>
    </Modal>
  )
}

function RegistrationTable({ registrations, onDelete }) {
  if (!registrations.length) return <div className="empty-state"><span className="empty-icon">✳</span><strong>No one's on the list yet.</strong><p>Registrations will show up here as students sign up.</p></div>
  return (
    <div className="table-wrap">
      <table className="registration-table">
        <thead><tr><th>Student</th><th>Event</th><th>Student ID</th><th>Registered</th><th /></tr></thead>
        <tbody>{registrations.map((registration) => <tr key={registration.id}><td><div className="student-cell"><span className="avatar">{initials(registration.student_name)}</span><span><strong>{registration.student_name}</strong><small>{registration.email}</small></span></div></td><td>{registration.event_title}<small>{registration.event_location}</small></td><td>{registration.student_id}</td><td>{dateLabel(registration.registered_at, { month: 'short', day: 'numeric', year: 'numeric' })}</td><td><button className="remove-link" onClick={() => onDelete(registration)}>Remove</button></td></tr>)}</tbody>
      </table>
    </div>
  )
}

function Modal({ children, onClose, wide }) {
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose])
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className={`modal-card${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true"><button className="modal-close" onClick={onClose} aria-label="Close dialog">×</button>{children}</section></div>
}

export default App
