import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getEvents, saveEvent, deleteEvent } from '../utils/db';
import { Plus, Search, Calendar, MapPin, Pencil, Trash2, X, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Events.css';

const STATUSES = ['Draft', 'Planned', 'Active', 'Completed'];
const CURRENT_YEAR = new Date().getFullYear();

const EMPTY_EVENT = {
  event_name: '',
  client_name: '',
  event_location: '',
  event_start_date: '',
  event_end_date: '',
  reporting_year: String(CURRENT_YEAR),
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

  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card modal-card-solid animate-fade-in">
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
              <label className="input-label">Start Date</label>
              <input
                className="input-field"
                type="date"
                value={form.event_start_date || ''}
                onChange={e => {
                  const val = e.target.value;
                  setForm(prev => ({
                    ...prev,
                    event_start_date: val,
                    reporting_year: val ? val.slice(0, 4) : prev.reporting_year,
                  }));
                }}
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
              <label className="input-label">Status</label>
              <select
                className="input-field"
                value={form.event_status}
                onChange={e => set('event_status', e.target.value)}
              >
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
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
    </div>,
    document.body
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

  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card modal-card-sm modal-card-solid animate-fade-in">
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
    </div>,
    document.body
  );
};

/* ═══════════════════════════════════════════════════════════════════
   BULK DELETE CONFIRM MODAL
═══════════════════════════════════════════════════════════════════ */
const BulkDeleteModal = ({ events, onClose, onDeleted }) => {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await Promise.all(events.map(e => deleteEvent(e.id)));
    onDeleted(events.map(e => e.id));
    onClose();
  };

  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card modal-card-sm modal-card-solid animate-fade-in">
        <div className="modal-header">
          <h3>Delete {events.length} Event{events.length !== 1 ? 's' : ''}</h3>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        <p className="modal-delete-msg">
          Are you sure you want to delete <strong>{events.length}</strong> selected event{events.length !== 1 ? 's' : ''}?
          This action cannot be undone.
        </p>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
            <Trash2 size={16} />
            {deleting ? 'Deleting…' : 'Delete All'}
          </button>
        </div>
      </div>
    </div>,
    document.body
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
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const selectAllRef = useRef(null);
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

  const allFilteredSelected = filtered.length > 0 && filtered.every(e => selectedIds.has(e.id));
  const someFilteredSelected = filtered.some(e => selectedIds.has(e.id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someFilteredSelected && !allFilteredSelected;
    }
  }, [someFilteredSelected, allFilteredSelected]);

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
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleBulkDeleted = (ids) => {
    const idSet = new Set(ids);
    setEvents(prev => prev.filter(e => !idSet.has(e.id)));
    setSelectedIds(new Set());
  };

  const openCreate = () => setModal({ mode: 'create', event: { ...EMPTY_EVENT } });
  const openEdit   = (e, ev) => { ev.stopPropagation(); setModal({ mode: 'edit', event: { ...e } }); };
  const openDelete = (e, ev) => { ev.stopPropagation(); setDeleteTarget(e); };

  const toggleRow = (id, ev) => {
    ev.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filtered.forEach(e => next.delete(e.id));
        return next;
      }
      const next = new Set(prev);
      filtered.forEach(e => next.add(e.id));
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());
  const selectedEvents = events.filter(e => selectedIds.has(e.id));

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
          {selectedIds.size > 0 ? (
            <div className="bulk-actions">
              <span className="bulk-count">{selectedIds.size} selected</span>
              <button className="btn btn-secondary btn-sm" onClick={clearSelection}>Clear</button>
              <button className="btn btn-danger btn-sm" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 size={14} /> Delete Selected
              </button>
            </div>
          ) : (
            <p className="results-count text-secondary">
              {filtered.length} event{filtered.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th className="checkbox-col">
                  <input
                    type="checkbox"
                    ref={selectAllRef}
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all events"
                  />
                </th>
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
                  className={`clickable-row ${selectedIds.has(event.id) ? 'row-selected' : ''}`}
                >
                  <td className="checkbox-col" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(event.id)}
                      onChange={e => toggleRow(event.id, e)}
                      aria-label={`Select ${event.event_name}`}
                    />
                  </td>
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
                  <td colSpan={8} className="empty-row">
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
      {bulkDeleteOpen && (
        <BulkDeleteModal
          events={selectedEvents}
          onClose={() => setBulkDeleteOpen(false)}
          onDeleted={handleBulkDeleted}
        />
      )}
    </div>
  );
};

export default Events;
