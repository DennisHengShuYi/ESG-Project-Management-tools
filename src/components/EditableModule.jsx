import { useState } from 'react';
import { Pencil, Save, X } from 'lucide-react';
import './EditableModule.css';

/**
 * EditableModule
 * 
 * Props:
 *  - title: string
 *  - icon: ReactNode
 *  - fields: Array<{ key, label, type?, unit?, readOnly?, compute? }>
 *      type: 'number' | 'text' | 'date' | 'textarea'  (default: 'number')
 *      readOnly: true → shown in view mode but not editable (computed fields)
 *      compute: fn(data) → derived display value for readOnly fields
 *  - data: object  (the raw data record)
 *  - onSave: fn(updatedFields) → called with only the changed raw keys
 *  - readOnlyBanner: optional string shown instead of Edit button (aggregated views)
 */
const EditableModule = ({ title, icon, fields, data, onSave, readOnlyBanner }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});

  const editableFields = fields.filter(f => !f.readOnly);

  const startEdit = () => {
    const initial = {};
    editableFields.forEach(f => {
      initial[f.key] = data[f.key] ?? '';
    });
    setDraft(initial);
    setEditing(true);
  };

  const handleChange = (key, value, type) => {
    setDraft(prev => ({
      ...prev,
      [key]: type === 'number' ? (parseFloat(value) || 0) : value
    }));
  };

  const handleSave = () => {
    onSave(draft);
    setEditing(false);
  };

  const displayValue = (field, source) => {
    if (field.compute) return field.compute(source);
    const raw = source[field.key];
    if (raw === undefined || raw === null || raw === '') return '—';
    const formatted = typeof raw === 'number' ? raw.toLocaleString() : raw;
    return field.unit ? `${formatted} ${field.unit}` : formatted;
  };

  return (
    <div className="glass-card editable-module animate-fade-in">
      {/* Header */}
      <div className="module-header">
        <div className="module-header-left">
          {icon}
          <h3>{title}</h3>
        </div>
        <div className="module-header-right">
          {readOnlyBanner ? (
            <span className="readonly-banner">{readOnlyBanner}</span>
          ) : !editing ? (
            <button className="btn-edit" onClick={startEdit}>
              <Pencil size={13} />
              Edit
            </button>
          ) : (
            <div className="edit-actions">
              <button className="btn-save" onClick={handleSave}>
                <Save size={13} />
                Save
              </button>
              <button className="btn-cancel" onClick={() => setEditing(false)}>
                <X size={13} />
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* View Mode */}
      {!editing && (
        <div className="metrics-grid">
          {fields.map(field => (
            <div key={field.key} className={`metric-box ${field.fullWidth ? 'full-width' : ''}`}>
              <span className="metric-label">{field.label}</span>
              <span className={`metric-value ${field.readOnly ? 'metric-computed' : ''}`}>
                {displayValue(field, data)}
                {field.readOnly && <span className="computed-badge">auto</span>}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Edit Mode */}
      {editing && (
        <div className="edit-grid">
          {editableFields.map(field => (
            <div key={field.key} className="edit-field">
              <label className="edit-label">
                {field.label}
                {field.unit && <span className="unit-hint">{field.unit}</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  className="input-field edit-textarea"
                  value={draft[field.key] ?? ''}
                  onChange={e => handleChange(field.key, e.target.value, 'text')}
                  rows={3}
                />
              ) : (
                <input
                  type={field.type || 'number'}
                  className="input-field"
                  value={draft[field.key] ?? ''}
                  onChange={e => handleChange(field.key, e.target.value, field.type || 'number')}
                  step={field.type === 'number' ? 'any' : undefined}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EditableModule;
