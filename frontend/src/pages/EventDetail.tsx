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
import { KpiCard, DonutChart, BarChartPanel, GaugeBar, ChartEmpty, CHART_COLORS as C } from '../components/charts';
import { useAuth } from '../contexts/AuthContext';
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
  { id: 'green-ops',     label: 'Green Ops',               icon: Cloud,          fields: GREEN_OPS_FIELDS,    colorClass: 'text-primary', accentColor: '#2F6844' },
  { id: 'health-safety', label: 'Health, Safety & Labour', icon: ShieldAlert,    fields: HEALTH_FIELDS,       colorClass: 'text-danger',  accentColor: '#B23A2B' },
  { id: 'procurement',   label: 'Procurement & Community', icon: HeartHandshake, fields: PROCUREMENT_FIELDS,  colorClass: 'text-info',    accentColor: '#3D7A6E' },
  { id: 'financial',     label: 'Financial',               icon: DollarSign,     fields: FINANCIAL_FIELDS,    colorClass: 'text-success', accentColor: '#2F6844' },
  { id: 'timeline',      label: 'Timeline & Team',         icon: Clock,          fields: TIMELINE_FIELDS,     colorClass: 'text-warning', accentColor: '#8C6A1F' },
  { id: 'attendance',    label: 'Attendance',              icon: Users,          fields: ATTENDANCE_FIELDS,   colorClass: 'text-primary', accentColor: '#3A6EA5' },
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

/* ── Per-module chart panels (single-event scale: no trend lines — a
   single event has a result, not a trend) ──────────────────────────── */
const renderGreenOpsCharts = (event: any) => {
  const totalEnergy = Number(event.total_energy_mwh) || 0;
  const renewable = Number(event.renewable_energy_mwh) || 0;
  const renewableData = totalEnergy > 0 ? [
    { name: 'Renewable', value: +renewable.toFixed(2), fill: C.green },
    { name: 'Non-Renewable', value: +Math.max(0, totalEnergy - renewable).toFixed(2), fill: C.blue },
  ] : [];

  const emissionsRow = {
    name: 'Emissions',
    'Scope 1': +(Number(event.scope1_tco2e) || 0).toFixed(2),
    'Scope 2': +(Number(event.scope2_lb_tco2e) || 0).toFixed(2),
    'Scope 3': +(Number(event.scope3_tco2e) || 0).toFixed(2),
  };
  const hasEmissions = emissionsRow['Scope 1'] > 0 || emissionsRow['Scope 2'] > 0 || emissionsRow['Scope 3'] > 0;

  const wasteRow = {
    name: 'Waste',
    'Hazardous': +((Number(event.waste_hazardous_kg) || 0) / 1000).toFixed(3),
    'Non-Hazardous': +((Number(event.waste_nonhazardous_kg) || 0) / 1000).toFixed(3),
  };
  const hasWaste = wasteRow['Hazardous'] > 0 || wasteRow['Non-Hazardous'] > 0;

  return (
    <>

      <div className="charts-row">
        <div className="chart-card glass-card">
          <h4 className="chart-title">Scope 1 / 2 / 3 Emissions (tCO₂e)</h4>
          {hasEmissions ? (
            <BarChartPanel
              data={[emissionsRow]} stacked layout="vertical" tooltipSuffix=" tCO₂e"
              series={[
                { dataKey: 'Scope 1', fill: C.red, stackId: 'a' },
                { dataKey: 'Scope 2', fill: C.amber, stackId: 'a' },
                { dataKey: 'Scope 3', fill: C.blue, stackId: 'a' },
              ]}
            />
          ) : <ChartEmpty message="No emissions data recorded" />}
        </div>
        <div className="chart-card glass-card">
          <h4 className="chart-title">Hazardous vs Non-Hazardous Waste (Tonnes)</h4>
          {hasWaste ? (
            <BarChartPanel
              data={[wasteRow]} stacked layout="vertical" tooltipSuffix=" t"
              series={[
                { dataKey: 'Hazardous', fill: C.amber, stackId: 'a' },
                { dataKey: 'Non-Hazardous', fill: C.blue, stackId: 'a' },
              ]}
            />
          ) : <ChartEmpty message="No waste data recorded" />}
        </div>
        <div className="chart-card glass-card">
          <h4 className="chart-title">Renewable Energy Share</h4>
          <DonutChart data={renewableData} valueSuffix=" MWh" emptyMessage="No energy data recorded" />
        </div>
        <div className="chart-card glass-card">
          <h4 className="chart-title">Waste Diversion Rate (toward 100% target)</h4>
          <GaugeBar pct={Number(event.waste_diverted_pct) || 0} color={C.green} />
        </div>
        <div className="chart-card glass-card">
          <h4 className="chart-title">Sustainable Catering Rate (toward 100% target)</h4>
          <GaugeBar pct={Number(event.sustainable_catering_pct) || 0} color={C.teal} />
        </div>
      </div>
    </>
  );
};

const renderHealthCharts = (event: any) => {
  const permanent = Number(event.staff_permanent_count) || 0;
  const contractor = Number(event.staff_contractor_count) || 0;
  const staffData = (permanent + contractor) > 0 ? [
    { name: 'Permanent', value: permanent, fill: C.blue },
    { name: 'Contract/Temp', value: contractor, fill: C.purple },
  ] : [];

  const totalStaff = (permanent + contractor) || Number(event.total_headcount) || 0;
  const safetyPct = totalStaff > 0 ? ((Number(event.safety_trained_count) || 0) / totalStaff) * 100 : 0;

  return (
    <>

      <div className="charts-row">
        <div className="chart-card glass-card">
          <h4 className="chart-title">Safety Training Coverage (toward 100% target)</h4>
          <GaugeBar pct={safetyPct} color={C.green} />
        </div>
        <div className="chart-card glass-card">
          <h4 className="chart-title">Contract & Temp vs Permanent Staff</h4>
          <DonutChart data={staffData} emptyMessage="No headcount data recorded" />
        </div>
      </div>
    </>
  );
};

const renderProcurementCharts = (event: any) => {
  const total = Number(event.procurement_total_rm) || 0;
  const local = Number(event.local_supplier_spend_rm) || 0;
  const supplierData = total > 0 ? [
    { name: 'Local', value: +local.toFixed(2), fill: C.green },
    { name: 'Non-Local', value: +Math.max(0, total - local).toFixed(2), fill: C.blue },
  ] : [];

  return (
    <>

      <div className="charts-row">
        <div className="chart-card glass-card">
          <h4 className="chart-title">Local Supplier Spend (RM)</h4>
          <DonutChart data={supplierData} valueSuffix=" RM" emptyMessage="No procurement data recorded" />
        </div>
      </div>
    </>
  );
};

const renderFinancialCharts = (event: any) => {
  const budgetEstimated = Number(event.budget_estimated) || 0;
  const budgetActual = Number(event.budget_actual) || 0;
  const revenueEstimated = Number(event.revenue_estimated) || 0;
  const revenueActual = Number(event.revenue_actual) || 0;
  const greenSpend = Number(event.green_spend_rm) || 0;

  const budgetVariance = budgetEstimated - budgetActual;
  const utilisation = budgetEstimated ? ((budgetActual / budgetEstimated) * 100).toFixed(1) : '0';
  const netProfit = revenueActual - budgetActual;
  const roi = budgetActual ? ((netProfit / budgetActual) * 100).toFixed(1) : '0';

  const greenSpendData = budgetActual > 0 ? [
    { name: 'Green Spend', value: +greenSpend.toFixed(2), fill: C.green },
    { name: 'Other Spend', value: +Math.max(0, budgetActual - greenSpend).toFixed(2), fill: C.blue },
  ] : [];

  return (
    <>

      <div className="charts-row">
        <div className="chart-card glass-card">
          <h4 className="chart-title">Estimated Budget vs Actual Cost (RM)</h4>
          <BarChartPanel
            data={[{ name: 'Budget', Estimated: budgetEstimated, Actual: budgetActual }]}
            tooltipPrefix="RM "
            series={[{ dataKey: 'Estimated', fill: C.blue }, { dataKey: 'Actual', fill: C.amber }]}
          />
        </div>
        <div className="chart-card glass-card">
          <h4 className="chart-title">Estimated vs Actual Revenue (RM)</h4>
          <BarChartPanel
            data={[{ name: 'Revenue', Estimated: revenueEstimated, Actual: revenueActual }]}
            tooltipPrefix="RM "
            series={[{ dataKey: 'Estimated', fill: C.blue }, { dataKey: 'Actual', fill: C.green }]}
          />
        </div>
        <div className="chart-card glass-card">
          <h4 className="chart-title">Green Spend Ratio (RM)</h4>
          <DonutChart data={greenSpendData} valueSuffix=" RM" emptyMessage="No spend data recorded" />
        </div>
      </div>
    </>
  );
};

const renderTimelineCharts = (event: any) => {
  const tasksTotal = Number(event.tasks_total) || 0;
  const tasksOnTime = Number(event.tasks_on_time) || 0;
  const onTimePct = tasksTotal > 0 ? (tasksOnTime / tasksTotal) * 100 : 0;

  let scheduleVarianceLabel = '—';
  if (event.project_end_planned && event.timeline_actual_end_date) {
    const diff = Math.round(
      (new Date(event.project_end_planned).getTime() - new Date(event.timeline_actual_end_date).getTime()) / 86400000
    );
    scheduleVarianceLabel = diff >= 0 ? `+${diff} days (on time)` : `${diff} days (delayed)`;
  }

  return (
    <>

      <div className="charts-row">
        <div className="chart-card glass-card">
          <h4 className="chart-title">On-Time Delivery Rate (toward 100% target)</h4>
          <GaugeBar pct={onTimePct} color={C.green} />
        </div>
      </div>
    </>
  );
};

const renderAttendanceCharts = (event: any) => {
  const expected = Number(event.expected_attendance) || 0;
  const actual = Number(event.actual_attendance) || 0;
  const attendancePct = expected > 0 ? (actual / expected) * 100 : 0;

  return (
    <div className="charts-row">
      <div className="chart-card glass-card">
        <h4 className="chart-title">Expected vs Actual Attendance</h4>
        <BarChartPanel
          data={[{ name: 'Attendance', Expected: expected, Actual: actual }]}
          series={[{ dataKey: 'Expected', fill: C.blue }, { dataKey: 'Actual', fill: C.green }]}
        />
      </div>
      <div className="chart-card glass-card">
        <h4 className="chart-title">Attendance Rate (toward 100% target)</h4>
        <GaugeBar pct={attendancePct} color={C.teal} />
      </div>
    </div>
  );
};

const MODULE_CHARTS = {
  'green-ops':     renderGreenOpsCharts,
  'health-safety': renderHealthCharts,
  'procurement':   renderProcurementCharts,
  'financial':     renderFinancialCharts,
  'timeline':      renderTimelineCharts,
  'attendance':    renderAttendanceCharts,
};

/* ── Component ─────────────────────────────────────────────────────── */
const EventDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent]               = useState(null);
  const [activeModule, setActiveModule] = useState('green-ops');
  const [dataVersion, setDataVersion]   = useState(0);   // bumped after CSV upload to force remount
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { canRead, canWrite, permissionsLoading } = useAuth();
  const canReadEvents = canRead('events');

  useEffect(() => {
    // Skip the request entirely without read access — it would just 403.
    // Wait for permissions to actually resolve first so we don't flag a
    // real event as "no access" during the brief window before /me returns.
    if (permissionsLoading) return;
    if (!canReadEvents) { setLoadFailed(true); return; }
    getEventDetail(id).then(data => {
      if (data) setEvent(normaliseEvent(data));
      else setLoadFailed(true);
    });
  }, [id, canReadEvents, permissionsLoading]);

  if (permissionsLoading) return <div className="loading">Loading…</div>;

  if (loadFailed) {
    return (
      <div className="event-detail-container animate-fade-in">
        <div className="glass-card no-access-card">
          Couldn't load this event — you may not have access to it. Ask an admin to grant you read access to Events.
        </div>
      </div>
    );
  }
  if (!event) return <div className="loading">Loading…</div>;

  const visibleTabs = MODULE_TABS.filter(t => canRead(t.id));
  const effectiveModule = visibleTabs.some(t => t.id === activeModule) ? activeModule : visibleTabs[0]?.id;

  const handleModuleSave = async (updatedFields) => {
    const merged = { ...event, ...updatedFields };
    const saveFn = MODULE_SAVE[effectiveModule];
    if (saveFn) await saveFn(event.id, merged);
    const refreshed = await getEventDetail(event.id);
    if (refreshed) setEvent(normaliseEvent(refreshed));
    else setEvent(merged);
  };

  const canBulkUpdate = Object.keys(MODULE_SAVE).every(m => canWrite(m));

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

  const currentModule = MODULE_TABS.find(t => t.id === effectiveModule);
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
            {event._last_edited && (
              <p className="last-edited-note">
                Last edited by {event._last_edited.user_email} · {new Date(event._last_edited.created_at).toLocaleString()}
              </p>
            )}
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
          {canBulkUpdate && (
            <button
              className="btn-csv btn-csv-upload"
              onClick={handleUploadClick}
              disabled={uploadStatus === 'loading'}
              title="Upload modified CSV to update all metrics"
            >
              <Upload size={15} />
              {uploadStatus === 'loading' ? 'Uploading…' : 'Upload CSV'}
            </button>
          )}
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

      {visibleTabs.length > 0 ? (
        <>
          <div className="module-tabs">
            {visibleTabs.map(tab => (
              <button
                key={tab.id}
                className={`module-tab-btn ${effectiveModule === tab.id ? 'active' : ''}`}
                onClick={() => setActiveModule(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {currentModule && (
            <div className="mt-4 event-module-content" key={`${effectiveModule}-${dataVersion}`}>
              {MODULE_CHARTS[effectiveModule]?.(event)}
              <EditableModule
                title={currentModule.label}
                icon={<ModuleIcon className={currentModule.colorClass} />}
                fields={currentModule.fields}
                data={event}
                onSave={handleModuleSave}
                accentColor={currentModule.accentColor}
                readOnlyBanner={!canWrite(effectiveModule) ? 'Read-only — you don\'t have write access to this module.' : undefined}
              />
            </div>
          )}
        </>
      ) : (
        <div className="glass-card no-access-card">
          You don't have read access to any module of this event.
        </div>
      )}
    </div>
  );
};

export default EventDetail;
