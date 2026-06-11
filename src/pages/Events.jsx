import { useState, useEffect } from 'react';
import { getEvents, saveEvent, deleteEvent } from '../utils/db';
import { Plus, Search, Calendar, MapPin, Pencil, Trash2, X, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Events.css';

const STATUSES = ['Draft', 'Planned', 'Active', 'Completed'];
const YEARS    = ['2025', '2024', '2023'];

const EMPTY_EVENT = {
  event_name: '',
  client_name: '',
  event_location: '',
  event_start_date: '',
  event_end_date: '',
  reporting_year: '2025',
  event_status: 'Draft',
};

/* ── Status badge helper ─────────────────────────────────────────── */
const statusClass = (s) => ({
  Active:    'badge-success',
  Completed: 'badge-neutral',
  Planned:   'badge-info',
  Draft:     'badge-warning',
}[s] || 'badge-neutral');

/* ═══════════════════════════════════════════════════════════════════
   NEW / EDIT EVENT MODAL
═══════════════════════════════════════════════════════════════════ */
const EventModal = ({ mode, initial, onClose, onSaved }) => {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.event_name.trim()) { setError('Event name is required.'); return; }
    setSaving(true);
    setError('');
    const saved = await saveEvent(form);
    setSaving(false);
    if (saved) { onSaved(saved); onClose(); }
    else setError('Failed to save. Please try again.');
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card glass-card animate-fade-in">
        {/* Header */}
        <div className="modal-header">
          <h3>{mode === 'create' ? 'New Event / Project' : 'Edit Event'}</h3>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-grid">
            <div className="input-group">
              <label className="input-label">Event Name *</label>
              <input
                className="input-field"
                type="text"
                value={form.event_name}
                onChange={e => set('event_name', e.target.value)}
                placeholder="e.g. Green Tech Summit 2025"
                autoFocus
              />
            </div>
            <div className="input-group">
              <label className="input-label">Client / Organisation</label>
              <input
                className="input-field"
                type="text"
                value={form.client_name}
                onChange={e => set('client_name', e.target.value)}
                placeholder="e.g. Axiata Group"
              />
            </div>
            <div className="input-group">
              <label className="input-label">Location</label>
              <input
                className="input-field"
                type="text"
                value={form.event_location}
                onChange={e => set('event_location', e.target.value)}
                placeholder="e.g. KLCC, Kuala Lumpur"
              />
            </div>
            <div className="input-group">
              <label className="input-label">Status</label>
              <select
                className="input-field"
                value={form.event_status}
                onChange={e => set('event_status', e.target.value)}
              >
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Start Date</label>
              <input
                className="input-field"
                type="date"
                value={form.event_start_date || ''}
                onChange={e => set('event_start_date', e.target.value)}
              />
            </div>
            <div className="input-group">
              <label className="input-label">End Date</label>
              <input
                className="input-field"
                type="date"
                value={form.event_end_date || ''}
                onChange={e => set('event_end_date', e.target.value)}
              />
            </div>
            <div className="input-group">
              <label className="input-label">Reporting Year</label>
              <select
                className="input-field"
                value={form.reporting_year}
                onChange={e => set('reporting_year', e.target.value)}
              >
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {error && <p className="modal-error">{error}</p>}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} />
              {saving ? 'Saving…' : mode === 'create' ? 'Create Event' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   DELETE CONFIRM MODAL
═══════════════════════════════════════════════════════════════════ */
const DeleteModal = ({ event, onClose, onDeleted }) => {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await deleteEvent(event.id);
    onDeleted(event.id);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card modal-card-sm glass-card animate-fade-in">
        <div className="modal-header">
          <h3>Delete Event</h3>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        <p className="modal-delete-msg">
          Are you sure you want to delete <strong>{event.event_name}</strong>?
          This action cannot be undone.
        </p>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
            <Trash2 size={16} />
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════ */
const Events = () => {
  const [events, setEvents]           = useState([]);
  const [searchTerm, setSearchTerm]   = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [modal, setModal]             = useState(null); // null | { mode: 'create'|'edit', event }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    getEvents().then(setEvents);
  }, []);

  const filtered = events.filter(e => {
    const q = searchTerm.toLowerCase();
    const matchSearch = e.event_name.toLowerCase().includes(q) ||
                        (e.client_name || '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'All' || e.event_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleSaved = (saved) => {
    setEvents(prev => {
      const idx = prev.findIndex(e => e.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
  };

  const handleDeleted = (id) => {
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  const openCreate = () => setModal({ mode: 'create', event: { ...EMPTY_EVENT } });
  const openEdit   = (e, ev) => { ev.stopPropagation(); setModal({ mode: 'edit', event: { ...e } }); };
  const openDelete = (e, ev) => { ev.stopPropagation(); setDeleteTarget(e); };

  return (
    <div className="events-container animate-fade-in">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h2>Events &amp; Projects</h2>
          <p className="text-secondary">Manage and track all individual events and projects.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={18} /> New Event
        </button>
      </div>

      {/* Summary chips */}
      <div className="events-summary">
        {['All', ...STATUSES].map(s => {
          const count = s === 'All' ? events.length : events.filter(e => e.event_status === s).length;
          return (
            <div key={s} className={`summary-chip ${statusFilter === s ? 'active' : ''}`}
              onClick={() => setStatusFilter(s)}>
              <span className={`chip-dot ${s === 'All' ? 'dot-default' : `badge-${statusClass(s).replace('badge-','')}-dot`}`} />
              {s}
              <span className="chip-count">{count}</span>
            </div>
          );
        })}
      </div>

      {/* Table card */}
      <div className="glass-card table-card">
        <div className="table-controls">
          <div className="search-box">
            <Search size={16} className="text-tertiary" />
            <input
              type="text"
              placeholder="Search events or clients…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <p className="results-count text-secondary">
            {filtered.length} event{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Event Name</th>
                <th>Client</th>
                <th>Start Date</th>
                <th>Location</th>
                <th>Year</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? filtered.map(event => (
                <tr
                  key={event.id}
                  onClick={() => navigate(`/events/${event.id}`)}
                  className="clickable-row"
                >
                  <td className="font-medium">{event.event_name}</td>
                  <td className="text-secondary">{event.client_name || '—'}</td>
                  <td>
                    <div className="cell-with-icon">
                      <Calendar size={13} className="text-tertiary" />
                      <span>{event.event_start_date || '—'}</span>
                    </div>
                  </td>
                  <td>
                    <div className="cell-with-icon">
                      <MapPin size={13} className="text-tertiary" />
                      <span>{event.event_location || '—'}</span>
                    </div>
                  </td>
                  <td className="text-secondary">{event.reporting_year}</td>
                  <td>
                    <span className={`badge ${statusClass(event.event_status)}`}>
                      {event.event_status}
                    </span>
                  </td>
                  <td>
                    <div className="action-btns" onClick={e => e.stopPropagation()}>
                      <button className="btn-icon" title="Edit" onClick={e => openEdit(event, e)}>
                        <Pencil size={15} />
                      </button>
                      <button className="btn-icon btn-icon-danger" title="Delete" onClick={e => openDelete(event, e)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="7" className="empty-row">
                    {searchTerm || statusFilter !== 'All'
                      ? 'No events match your search.'
                      : 'No events yet — create your first event.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {modal && (
        <EventModal
          mode={modal.mode}
          initial={modal.event}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          event={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
};

export default Events;
