import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getEventDetail,
  saveGreenOps, saveHealthSafety, saveProcurement,
  saveEventFinancials, saveEventTimeline, saveEventAttendance,
  downloadEventCsv, uploadEventCsv,
} from '../utils/db';
import { ArrowLeft, Cloud, ShieldAlert, HeartHandshake, DollarSign, Clock, Users, Download, Upload } from 'lucide-react';
import EditableModule from '../components/EditableModule';
import './EventDetail.css';

/* ── Field definitions per module ─────────────────────────────────── */
const GREEN_OPS_FIELDS = [
  { key: 'total_energy_mwh',        label: 'Energy Consumption',          unit: 'MWh' },
  { key: 'renewable_energy_mwh',    label: 'Renewable Energy',            unit: 'MWh' },
  { key: 'renewable_energy_pct',    label: 'Renewable Energy Share',      unit: '%',     readOnly: true, compute: d => d.renewable_energy_pct != null ? `${Number(d.renewable_energy_pct).toFixed(1)}%` : '—' },
  { key: 'total_water_m3',          label: 'Water Consumption',           unit: 'm³' },
  { key: 'waste_hazardous_kg',      label: 'Hazardous Waste',             unit: 'kg' },
  { key: 'waste_nonhazardous_kg',   label: 'Non-Hazardous Waste',         unit: 'kg' },
  { key: 'waste_recycled_kg',       label: 'Waste Diverted (recycled/composted)', unit: 'kg' },
  { key: 'waste_diverted_pct',      label: 'Waste Diversion Rate',        unit: '%',     readOnly: true, compute: d => d.waste_diverted_pct != null ? `${Number(d.waste_diverted_pct).toFixed(1)}%` : '—' },
  { key: 'sustainable_catering_pct',label: 'Sustainable Catering Rate',   unit: '%' },
  { key: 'food_recovery_kg',        label: 'Surplus Food Recovery',       unit: 'kg' },
  { key: 'scope1_tco2e',            label: 'Scope 1 Emissions',           unit: 'tCO₂e' },
  { key: 'scope2_lb_tco2e',         label: 'Scope 2 Emissions',           unit: 'tCO₂e' },
  { key: 'scope3_tco2e',            label: 'Scope 3 Emissions',           unit: 'tCO₂e' },
];

const HEALTH_FIELDS = [
  { key: 'fatalities_count',        label: 'Work-Related Fatalities',       type: 'number' },
  { key: 'lti_count',               label: 'Lost Time Injuries (LTI)',      type: 'number' },
  { key: 'man_hours_actual',        label: 'Total Hours Worked',            type: 'number' },
  { key: 'ltir',                    label: 'LTIR (auto-calculated)',         unit: '',      readOnly: true, compute: d => d.ltir != null ? Number(d.ltir).toFixed(4) : '—' },
  { key: 'safety_trained_count',    label: 'Safety Training Headcount',     type: 'number' },
  { key: 'total_headcount',         label: 'Total Headcount (all staff)',    type: 'number' },
  { key: 'staff_contractor_count',  label: 'Contract & Temp Staff Count',   type: 'number' },
  { key: 'contractor_pct',          label: 'Contract & Temp Ratio',         unit: '%',     readOnly: true, compute: d => d.contractor_pct != null ? `${Number(d.contractor_pct).toFixed(1)}%` : '—' },
  { key: 'hr_complaints_count',     label: 'Human Rights Complaints',       type: 'number' },
  { key: 'training_hours_total',    label: 'Employee Training Hours',       type: 'number' },
  { key: 'turnover_count',          label: 'Employee Turnover Headcount',   type: 'number' },
];

const PROCUREMENT_FIELDS = [
  { key: 'procurement_total_rm',     label: 'Total Procurement Spend',       unit: 'RM' },
  { key: 'local_supplier_spend_rm',  label: 'Local Supplier Spend',          unit: 'RM' },
  { key: 'local_supplier_spend_pct', label: 'Local Supplier Spend % (auto)', unit: '%',     readOnly: true, compute: d => d.local_supplier_spend_pct != null ? `${Number(d.local_supplier_spend_pct).toFixed(1)}%` : '—' },
  { key: 'community_invest_rm',      label: 'Community Investment',          unit: 'RM' },
  { key: 'community_beneficiaries',  label: 'Community Beneficiaries',       type: 'number' },
  { key: 'data_breach_complaints',   label: 'Substantiated Privacy Breaches',type: 'number' },
];

const FINANCIAL_FIELDS = [
  { key: 'budget_estimated',   label: 'Estimated Budget',      unit: 'RM' },
  { key: 'budget_actual',      label: 'Actual Cost',           unit: 'RM' },
  { key: 'revenue_estimated',  label: 'Estimated Revenue',     unit: 'RM' },
  { key: 'revenue_actual',     label: 'Actual Revenue',        unit: 'RM' },
  { key: 'green_spend_rm',     label: 'Green Spend',           unit: 'RM' },
  {
    key: '_budget_var', label: 'Budget Variance & Utilisation', readOnly: true,
    compute: d => {
      const v = (d.budget_estimated||0) - (d.budget_actual||0);
      const u = d.budget_estimated ? (((d.budget_actual||0)/d.budget_estimated)*100).toFixed(1) : 0;
      return `RM ${v.toLocaleString()} (${u}% utilised)`;
    }
  },
  {
    key: '_net_profit', label: 'Net Profit / Loss & ROI', readOnly: true,
    compute: d => {
      const p   = (d.revenue_actual||0) - (d.budget_actual||0);
      const roi = d.budget_actual ? ((p/d.budget_actual)*100).toFixed(1) : 0;
      return `RM ${p.toLocaleString()} (${roi}% ROI)`;
    }
  },
];

const TIMELINE_FIELDS = [
  { key: 'project_start_date',       label: 'Project Start Date',          type: 'date' },
  { key: 'project_end_planned',      label: 'Planned End Date',            type: 'date' },
  { key: 'timeline_actual_end_date', label: 'Actual End Date',             type: 'date' },
  { key: 'tasks_total',              label: 'Total Tasks',                 type: 'number' },
  { key: 'tasks_on_time',            label: 'Tasks Completed On Time',     type: 'number' },
  { key: 'team_size_total',          label: 'Total Team Size',             type: 'number' },
  {
    key: '_sched_var', label: 'Schedule Variance', unit: 'days', readOnly: true,
    compute: d => {
      if (!d.project_end_planned || !d.timeline_actual_end_date) return '—';
      const diff = Math.round((new Date(d.project_end_planned).getTime() - new Date(d.timeline_actual_end_date).getTime()) / 86400000);
      return diff >= 0 ? `+${diff} (on time)` : `${diff} (delayed)`;
    }
  },
  {
    key: '_ontime', label: 'On-Time Delivery Rate', readOnly: true,
    compute: d => {
      const tot = Number(d.tasks_total) || 0;
      const ot  = Number(d.tasks_on_time) || 0;
      return tot > 0 ? `${((ot/tot)*100).toFixed(1)}%` : '—';
    }
  },
];

const ATTENDANCE_FIELDS = [
  { key: 'expected_attendance', label: 'Expected Attendance', type: 'number' },
  { key: 'actual_attendance',   label: 'Actual Attendance',   type: 'number' },
  {
    key: '_att_rate', label: 'Attendance Rate', readOnly: true,
    compute: d => d.expected_attendance
      ? `${(((d.actual_attendance||0)/d.expected_attendance)*100).toFixed(1)}%`
      : '—'
  },
];

/* ── Module tab config ─────────────────────────────────────────────── */
const MODULE_TABS = [
  { id: 'green-ops',     label: 'Green Ops',               icon: Cloud,          fields: GREEN_OPS_FIELDS,    colorClass: 'text-primary', accentColor: '#10B981' },
  { id: 'health-safety', label: 'Health, Safety & Labour', icon: ShieldAlert,    fields: HEALTH_FIELDS,       colorClass: 'text-danger',  accentColor: '#EF4444' },
  { id: 'procurement',   label: 'Procurement & Community', icon: HeartHandshake, fields: PROCUREMENT_FIELDS,  colorClass: 'text-info',    accentColor: '#14B8A6' },
  { id: 'financial',     label: 'Financial',               icon: DollarSign,     fields: FINANCIAL_FIELDS,    colorClass: 'text-success', accentColor: '#10B981' },
  { id: 'timeline',      label: 'Timeline & Team',         icon: Clock,          fields: TIMELINE_FIELDS,     colorClass: 'text-warning', accentColor: '#F59E0B' },
  { id: 'attendance',    label: 'Attendance',              icon: Users,          fields: ATTENDANCE_FIELDS,   colorClass: 'text-primary', accentColor: '#3B82F6' },
];

/* ── Module → save function map ────────────────────────────────────── */
const MODULE_SAVE = {
  'green-ops':     saveGreenOps,
  'health-safety': saveHealthSafety,
  'procurement':   saveProcurement,
  'financial':     saveEventFinancials,
  'timeline':      saveEventTimeline,
  'attendance':    saveEventAttendance,
};

/**
 * The events_flat view returns raw DB column names from joined tables.
 * Some differ from the keys that TIMELINE_FIELDS expects. This function
 * normalises the flat object so the frontend display keys always work.
 */
const normaliseEvent = (raw: any) => ({
  ...raw,
  // event_timeline aliases — view uses planned_end_date; frontend key is project_end_planned
  project_start_date:       raw.project_start_date       ?? raw.project_start_date   ?? null,
  project_end_planned:      raw.project_end_planned      ?? raw.planned_end_date      ?? null,
  // actual_end_date from event_timeline is surfaced as timeline_actual_end_date by the backend
  timeline_actual_end_date: raw.timeline_actual_end_date ?? raw.actual_end_date       ?? null,
  team_size_total:          raw.team_size_total          ?? raw.team_size             ?? null,
  tasks_total:              raw.tasks_total              ?? null,
  tasks_on_time:            raw.tasks_on_time            ?? null,
});

/* ── Component ─────────────────────────────────────────────────────── */
const EventDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent]               = useState(null);
  const [activeModule, setActiveModule] = useState('green-ops');
  const [dataVersion, setDataVersion]   = useState(0);   // bumped after CSV upload to force remount
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getEventDetail(id).then(data => { if (data) setEvent(normaliseEvent(data)); });
  }, [id]);

  if (!event) return <div className="loading">Loading…</div>;

  const handleModuleSave = async (updatedFields) => {
    const merged = { ...event, ...updatedFields };
    const saveFn = MODULE_SAVE[activeModule];
    if (saveFn) await saveFn(event.id, merged);
    const refreshed = await getEventDetail(event.id);
    if (refreshed) setEvent(normaliseEvent(refreshed));
    else setEvent(merged);
  };

  const handleDownloadCsv = () => {
    downloadEventCsv(event);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input so the same file can be re-uploaded if needed
    e.target.value = '';

    setUploadStatus('loading');
    setUploadMessage('Uploading…');

    const result = await uploadEventCsv(event.id, file);

    if (result.success) {
      setUploadStatus('success');
      setUploadMessage('All metrics updated successfully!');
      // Refresh event data and bump version so EditableModule remounts with fresh data
      const refreshed = await getEventDetail(event.id);
      if (refreshed) setEvent(normaliseEvent(refreshed));
      setDataVersion(v => v + 1);
      setTimeout(() => setUploadStatus('idle'), 3000);
    } else {
      setUploadStatus('error');
      setUploadMessage(result.error || 'Upload failed.');
      setTimeout(() => setUploadStatus('idle'), 5000);
    }
  };

  const currentModule = MODULE_TABS.find(t => t.id === activeModule);
  const ModuleIcon = currentModule?.icon;

  return (
    <div className="event-detail-container animate-fade-in">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <button className="btn-icon" onClick={() => navigate('/events')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2>{event.event_name}</h2>
              <span className={`badge badge-${event.event_status === 'Active' ? 'success' : event.event_status === 'Completed' ? 'neutral' : 'warning'}`}>
                {event.event_status}
              </span>
            </div>
            <p className="text-secondary">{event.client_name} • {event.event_location}</p>
          </div>
        </div>

        {/* CSV Download / Upload actions */}
        <div className="csv-actions">
          <button
            className="btn-csv btn-csv-download"
            onClick={handleDownloadCsv}
            title="Download all metrics as CSV"
          >
            <Download size={15} />
            Download CSV
          </button>
          <button
            className="btn-csv btn-csv-upload"
            onClick={handleUploadClick}
            disabled={uploadStatus === 'loading'}
            title="Upload modified CSV to update all metrics"
          >
            <Upload size={15} />
            {uploadStatus === 'loading' ? 'Uploading…' : 'Upload CSV'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Upload status banner */}
      {uploadStatus !== 'idle' && (
        <div className={`csv-status-banner csv-status-${uploadStatus}`}>
          {uploadMessage}
        </div>
      )}

      <div className="module-tabs">
        {MODULE_TABS.map(tab => (
          <button
            key={tab.id}
            className={`module-tab-btn ${activeModule === tab.id ? 'active' : ''}`}
            onClick={() => setActiveModule(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {currentModule && (
        <div className="mt-4">
          <EditableModule
            key={`${activeModule}-${dataVersion}`}
            title={currentModule.label}
            icon={<ModuleIcon className={currentModule.colorClass} />}
            fields={currentModule.fields}
            data={event}
            onSave={handleModuleSave}
            accentColor={currentModule.accentColor}
          />
        </div>
      )}
    </div>
  );
};

export default EventDetail;
