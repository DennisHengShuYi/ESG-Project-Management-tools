import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  getAdminUsers, createAdminUser, updateAdminUser,
  getAuditLog, getOrgSettings, saveOrgSettings,
} from '../utils/db';
import { useAuth } from '../contexts/AuthContext';
import { Users, ClipboardList, Settings as SettingsIcon, Plus, X, Save, ShieldCheck, Copy, ChevronLeft, ChevronRight } from 'lucide-react';
import './Admin.css';

/* ── Module catalog — mirrors backend/src/utils/fieldRedaction.js ──── */
const MODULES = [
  { key: 'events',          label: 'Events' },
  { key: 'green-ops',       label: 'Green Ops' },
  { key: 'health-safety',   label: 'Health, Safety & Labour' },
  { key: 'procurement',     label: 'Procurement & Community' },
  { key: 'financial',       label: 'Financial' },
  { key: 'timeline',        label: 'Timeline & Team' },
  { key: 'attendance',      label: 'Attendance' },
  { key: 'governance',      label: 'Governance' },
  { key: 'hr-diversity',    label: 'HR & Diversity' },
  { key: 'climate-finance', label: 'Climate Finance' },
  { key: 'sdg',             label: 'SDG' },
];

const emptyPermissions = () => {
  const p: Record<string, { read: boolean; write: boolean }> = {};
  MODULES.forEach(m => { p[m.key] = { read: false, write: false }; });
  return p;
};

const PRESETS = [
  { id: 'viewer', label: 'Viewer', apply: () => {
    const p = emptyPermissions();
    MODULES.forEach(m => { p[m.key] = { read: true, write: false }; });
    return p;
  }},
  { id: 'full', label: 'Full Editor', apply: () => {
    const p = emptyPermissions();
    MODULES.forEach(m => { p[m.key] = { read: true, write: true }; });
    return p;
  }},
  { id: 'event-staff', label: 'Event Staff', apply: () => {
    const p = emptyPermissions();
    ['events', 'green-ops', 'health-safety', 'procurement', 'financial', 'timeline', 'attendance']
      .forEach(k => { p[k] = { read: true, write: true }; });
    return p;
  }},
];

const summarize = (perms: Record<string, { read?: boolean; write?: boolean }> | undefined) => {
  const list = MODULES.map(m => perms?.[m.key] || {});
  const read = list.filter(p => p.read || p.write).length;
  const write = list.filter(p => p.write).length;
  return { read, write, total: MODULES.length };
};

/* ═══════════════════════════════════════════════════════════════════
   PERMISSION MATRIX (shared by add + edit modals)
═══════════════════════════════════════════════════════════════════ */
const PermissionMatrix = ({ permissions, onChange, disabled }) => (
  <table className="perm-matrix">
    <thead>
      <tr>
        <th>Module</th>
        <th>Read</th>
        <th>Write</th>
      </tr>
    </thead>
    <tbody>
      {MODULES.map(m => {
        const perm = permissions[m.key] || { read: false, write: false };
        return (
          <tr key={m.key}>
            <td>{m.label}</td>
            <td>
              <input
                type="checkbox"
                disabled={disabled}
                checked={!!perm.read || !!perm.write}
                onChange={e => onChange(m.key, { ...perm, read: e.target.checked, write: e.target.checked ? perm.write : false })}
              />
            </td>
            <td>
              <input
                type="checkbox"
                disabled={disabled}
                checked={!!perm.write}
                onChange={e => onChange(m.key, { ...perm, write: e.target.checked, read: e.target.checked ? true : perm.read })}
              />
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

/* ═══════════════════════════════════════════════════════════════════
   ADD TEAMMATE MODAL
═══════════════════════════════════════════════════════════════════ */
const AddUserModal = ({ users, onClose, onCreated }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('member');
  const [permissions, setPermissions] = useState(emptyPermissions());
  const [copyFrom, setCopyFrom] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setPerm = (key, val) => setPermissions(prev => ({ ...prev, [key]: val }));

  const applyCopyFrom = (userId) => {
    setCopyFrom(userId);
    const source = users.find(u => u.id === userId);
    if (source) setPermissions({ ...emptyPermissions(), ...(source.module_permissions || {}) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) { setError('Email and password are required.'); return; }
    setSaving(true);
    setError('');
    const result = await createAdminUser({ email, password, full_name: fullName, role, module_permissions: permissions });
    setSaving(false);
    if (result.success) { onCreated(result.user); onClose(); }
    else setError(result.error || 'Failed to create teammate.');
  };

  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card admin-modal-solid animate-fade-in">
        <div className="modal-header">
          <h3>Add Teammate</h3>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-grid">
            <div className="input-group">
              <label className="input-label">Email *</label>
              <input className="input-field" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="teammate@company.com" autoFocus />
            </div>
            <div className="input-group">
              <label className="input-label">Temporary Password *</label>
              <input className="input-field" type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="Shared out-of-band" />
            </div>
            <div className="input-group">
              <label className="input-label">Full Name</label>
              <input className="input-field" type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Jane Doe" />
            </div>
            <div className="input-group">
              <label className="input-label">Role</label>
              <select className="input-field" value={role} onChange={e => setRole(e.target.value)}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          {role !== 'admin' && (
            <>
              <div className="perm-toolbar">
                <span className="perm-toolbar-label">Presets:</span>
                {PRESETS.map(p => (
                  <button type="button" key={p.id} className="btn btn-secondary btn-sm" onClick={() => setPermissions(p.apply())}>
                    {p.label}
                  </button>
                ))}
                {users.length > 0 && (
                  <select className="input-field perm-copy-select" value={copyFrom} onChange={e => applyCopyFrom(e.target.value)}>
                    <option value="">Copy permissions from…</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
                  </select>
                )}
              </div>
              <PermissionMatrix permissions={permissions} onChange={setPerm} disabled={false} />
            </>
          )}
          {role === 'admin' && (
            <p className="admin-note"><ShieldCheck size={14} /> Admins have full read/write access to every module automatically.</p>
          )}

          {error && <p className="modal-error">{error}</p>}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} /> {saving ? 'Creating…' : 'Create Teammate'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

/* ═══════════════════════════════════════════════════════════════════
   EDIT USER MODAL
═══════════════════════════════════════════════════════════════════ */
const EditUserModal = ({ user, onClose, onSaved }) => {
  const [role, setRole] = useState(user.role);
  const [isActive, setIsActive] = useState(user.is_active);
  const [permissions, setPermissions] = useState({ ...emptyPermissions(), ...(user.module_permissions || {}) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setPerm = (key, val) => setPermissions(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    const result = await updateAdminUser(user.id, { role, is_active: isActive, module_permissions: permissions });
    setSaving(false);
    if (result.success) { onSaved(result.user); onClose(); }
    else setError(result.error || 'Failed to update teammate.');
  };

  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card admin-modal-solid animate-fade-in">
        <div className="modal-header">
          <h3>{user.email}</h3>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-form">
          <div className="modal-grid">
            <div className="input-group">
              <label className="input-label">Role</label>
              <select className="input-field" value={role} onChange={e => setRole(e.target.value)}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Account Status</label>
              <label className="checkbox-label">
                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                &nbsp;Active (unchecked = deactivated, blocks login)
              </label>
            </div>
          </div>

          {role !== 'admin' ? (
            <>
              <div className="perm-toolbar">
                <span className="perm-toolbar-label">Presets:</span>
                {PRESETS.map(p => (
                  <button type="button" key={p.id} className="btn btn-secondary btn-sm" onClick={() => setPermissions(p.apply())}>
                    {p.label}
                  </button>
                ))}
              </div>
              <PermissionMatrix permissions={permissions} onChange={setPerm} disabled={false} />
            </>
          ) : (
            <p className="admin-note"><ShieldCheck size={14} /> Admins have full read/write access to every module automatically.</p>
          )}

          {error && <p className="modal-error">{error}</p>}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
              <Save size={16} /> {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

/* ═══════════════════════════════════════════════════════════════════
   TEAM TAB
═══════════════════════════════════════════════════════════════════ */
const TeamTab = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const load = () => { getAdminUsers().then(setUsers); };
  useEffect(() => { load(); }, []);

  return (
    <div className="glass-card admin-panel">
      <div className="admin-panel-header">
        <h3>Team</h3>
        <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
          <Plus size={16} /> Add Teammate
        </button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>Access</th>
              <th>Status</th>
              <th>Last Login</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const isSelf = u.id === currentUser?.id;
              const { read, write, total } = summarize(u.module_permissions);
              return (
                <tr
                  key={u.id}
                  className={isSelf ? '' : 'clickable-row'}
                  onClick={() => !isSelf && setEditing(u)}
                >
                  <td className="font-medium">{u.email}{isSelf && <span className="text-tertiary"> (you)</span>}</td>
                  <td className="text-secondary">{u.full_name || '—'}</td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'badge-success' : 'badge-neutral'}`}>{u.role}</span>
                  </td>
                  <td className="text-secondary">
                    {u.role === 'admin' ? 'All modules' : `Read ${read}/${total} · Write ${write}/${total}`}
                  </td>
                  <td>
                    <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                      {u.is_active ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td className="text-secondary">{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <AddUserModal users={users} onClose={() => setAddOpen(false)} onCreated={load} />
      )}
      {editing && (
        <EditUserModal user={editing} onClose={() => setEditing(null)} onSaved={load} />
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   ACTIVITY LOG TAB
═══════════════════════════════════════════════════════════════════ */
const fmtVal = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v));
const META_KEYS = new Set(['id', 'created_at', 'updated_at', 'organisation_id', 'event_id']);

const renderChanges = (row: any) => {
  const changes = row.changes || {};
  if (row.action === 'update') {
    const entries = Object.entries(changes) as [string, any][];
    if (entries.length === 0) return '—';
    return entries.map(([k, v]) => `${k}: ${fmtVal(v?.old)} → ${fmtVal(v?.new)}`).join('; ');
  }
  const entries = Object.entries(changes).filter(([k]) => !META_KEYS.has(k));
  const shown = entries.slice(0, 6).map(([k, v]) => `${k}: ${fmtVal(v)}`).join('; ');
  return entries.length > 6 ? `${shown} … (+${entries.length - 6} more)` : (shown || '—');
};

const ActivityLogTab = ({ users }: { users: any[] }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [module, setModule] = useState('');
  const [userId, setUserId] = useState('');
  const pageSize = 50;

  useEffect(() => {
    getAuditLog({ module: module || undefined, user_id: userId || undefined, page }).then(res => {
      setRows(res.rows || []);
      setTotal(res.total || 0);
    });
  }, [module, userId, page]);

  const handleExportCsv = () => {
    const header = 'When,Who,Action,Module,Table,Record ID,Changes\n';
    const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csvRows = rows.map(r => [
      new Date(r.created_at).toLocaleString(), r.user_email, r.action, r.module, r.table_name, r.record_id, renderChanges(r),
    ].map(escape).join(','));
    const csv = header + csvRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'activity_log.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="glass-card admin-panel">
      <div className="admin-panel-header">
        <h3>Activity Log</h3>
        <button className="btn btn-secondary" onClick={handleExportCsv}>Export CSV</button>
      </div>

      <div className="activity-filters">
        <select className="input-field" value={module} onChange={e => { setModule(e.target.value); setPage(1); }}>
          <option value="">All modules</option>
          {MODULES.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
        <select className="input-field" value={userId} onChange={e => { setUserId(e.target.value); setPage(1); }}>
          <option value="">All teammates</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
        </select>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Action</th>
              <th>Module</th>
              <th>What Changed</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? rows.map(r => (
              <tr key={r.id}>
                <td className="text-secondary">{new Date(r.created_at).toLocaleString()}</td>
                <td>{r.user_email}</td>
                <td><span className="badge badge-neutral">{r.action}</span></td>
                <td className="text-secondary">{MODULES.find(m => m.key === r.module)?.label || r.module}</td>
                <td className="text-secondary activity-changes-cell">{renderChanges(r)}</td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="empty-row">No activity recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {total > pageSize && (
        <div className="activity-pagination">
          <button className="btn-icon" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={16} /></button>
          <span className="text-secondary">Page {page} of {totalPages}</span>
          <button className="btn-icon" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight size={16} /></button>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   ORG SETTINGS TAB — retired Settings.tsx content, admin-only
═══════════════════════════════════════════════════════════════════ */
const OrgSettingsTab = () => {
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => { getOrgSettings().then(setSettings); }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.startsWith('framework_')) {
      const fw = name.replace('framework_', '');
      setSettings(prev => ({ ...prev, frameworks: { ...prev.frameworks, [fw]: checked } }));
      return;
    }
    const val = type === 'number' ? parseFloat(value) || 0 : value;
    setSettings(prev => ({ ...prev, [name]: val }));
  };

  const handleSave = async () => {
    await saveOrgSettings(settings);
    alert('Org settings saved successfully.');
  };

  if (!settings) return <div className="loading">Loading…</div>;

  return (
    <div className="settings-grid">
      <div className="glass-card settings-section">
        <div className="section-header">
          <SettingsIcon size={20} className="text-primary" />
          <h3>System Configuration</h3>
        </div>
        <div className="form-group">
          <label>Internal Carbon Price (RM/tCO2e)</label>
          <input type="number" name="internal_carbon_price" value={settings.internal_carbon_price || 0} onChange={handleInputChange} className="input-field" />
          <span className="help-text">Used to calculate shadow carbon costs.</span>
        </div>
        <div className="form-group">
          <label>Grid Emission Factor (kgCO2e/kWh)</label>
          <input type="number" name="grid_emission_factor" step="0.001" value={settings.grid_emission_factor || 0} onChange={handleInputChange} className="input-field" />
          <span className="help-text">Peninsular Malaysia (TNB) default is 0.694.</span>
        </div>
        <div className="form-group">
          <label>Reporting Financial Year End</label>
          <input type="text" name="reporting_fye" value={settings.reporting_fye || ''} onChange={handleInputChange} className="input-field" />
        </div>
      </div>

      <div className="glass-card settings-section">
        <div className="section-header">
          <SettingsIcon size={20} className="text-warning" />
          <h3>Alert Thresholds</h3>
        </div>
        <div className="form-group">
          <label>LTIR Threshold</label>
          <input type="number" name="ltir_threshold" step="0.1" value={settings.ltir_threshold || 0} onChange={handleInputChange} className="input-field" />
          <span className="help-text">Trigger dashboard alert if exceeded.</span>
        </div>
        <div className="form-group">
          <label>High Risk Score Threshold</label>
          <input type="number" name="high_risk_threshold" value={settings.high_risk_threshold || 0} onChange={handleInputChange} className="input-field" />
          <span className="help-text">Risks scoring above this (Likelihood x Impact) are flagged.</span>
        </div>
      </div>

      <div className="glass-card settings-section">
        <div className="section-header">
          <SettingsIcon size={20} className="text-info" />
          <h3>Framework Toggles</h3>
        </div>
        <div className="toggle-list">
          <div className="toggle-item">
            <div>
              <span className="font-medium block">Bursa Malaysia PN9-A</span>
              <span className="text-sm text-secondary">Mandatory for all Malaysian PLCs</span>
            </div>
            <input type="checkbox" checked={true} disabled className="toggle-switch" />
          </div>
          <div className="toggle-item">
            <div><span className="font-medium block">IFRS S1 General Requirements</span></div>
            <input type="checkbox" name="framework_ifrs1" checked={!!settings.frameworks?.ifrs1} onChange={handleInputChange} className="toggle-switch" />
          </div>
          <div className="toggle-item">
            <div><span className="font-medium block">IFRS S2 Climate Disclosures</span></div>
            <input type="checkbox" name="framework_ifrs2" checked={!!settings.frameworks?.ifrs2} onChange={handleInputChange} className="toggle-switch" />
          </div>
          <div className="toggle-item">
            <div><span className="font-medium block">GRI Standards Mapping</span></div>
            <input type="checkbox" name="framework_gri" checked={!!settings.frameworks?.gri} onChange={handleInputChange} className="toggle-switch" />
          </div>
          <div className="toggle-item">
            <div><span className="font-medium block">UN SDG Alignment</span></div>
            <input type="checkbox" name="framework_sdg" checked={!!settings.frameworks?.sdg} onChange={handleInputChange} className="toggle-switch" />
          </div>
        </div>
      </div>

      <div className="org-settings-save">
        <button className="btn btn-primary" onClick={handleSave}>
          <Save size={18} /> Save Org Settings
        </button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════ */
const TABS = [
  { id: 'team',     label: 'Team',          icon: Users },
  { id: 'activity', label: 'Activity Log',  icon: ClipboardList },
  { id: 'settings', label: 'Org Settings',  icon: SettingsIcon },
];

const Admin = () => {
  const [activeTab, setActiveTab] = useState('team');
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => { getAdminUsers().then(setUsers); }, [activeTab]);

  return (
    <div className="admin-container animate-fade-in">
      <div className="page-header">
        <div>
          <h2>Admin</h2>
          <p className="text-secondary">Manage teammate access, review the activity log, and configure org-wide settings.</p>
        </div>
      </div>

      <div className="module-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`module-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'team' && <TeamTab />}
      {activeTab === 'activity' && <ActivityLogTab users={users} />}
      {activeTab === 'settings' && <OrgSettingsTab />}
    </div>
  );
};

export default Admin;
