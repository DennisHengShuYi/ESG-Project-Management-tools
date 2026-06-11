import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getEventDetail,
  saveGreenOps, saveHealthSafety, saveProcurement,
  saveEventFinancials, saveEventTimeline, saveEventAttendance,
} from '../utils/db';
import { ArrowLeft, Cloud, ShieldAlert, HeartHandshake, DollarSign, Clock, Users } from 'lucide-react';
import EditableModule from '../components/EditableModule';
import ESGData from './ESGData';
import ProjectMgmt from './ProjectMgmt';
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
  { key: 'project_start_date',  label: 'Project Start Date',   type: 'date' },
  { key: 'project_end_planned', label: 'Planned End Date',     type: 'date' },
  { key: 'event_end_date',      label: 'Actual End Date',      type: 'date' },
  { key: 'tasks_total',         label: 'Total Tasks',          type: 'number' },
  { key: 'tasks_on_time',       label: 'Tasks Completed On Time', type: 'number' },
  { key: 'team_size_total',     label: 'Total Team Size',      type: 'number' },
  {
    key: '_sched_var', label: 'Schedule Variance', unit: 'days', readOnly: true,
    compute: d => {
      if (!d.project_end_planned || !d.event_end_date) return '—';
      const diff = Math.round((new Date(d.project_end_planned) - new Date(d.event_end_date)) / 86400000);
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
  { id: 'green-ops',     label: 'Green Ops',               icon: Cloud,          fields: GREEN_OPS_FIELDS,    colorClass: 'text-primary' },
  { id: 'health-safety', label: 'Health, Safety & Labour', icon: ShieldAlert,    fields: HEALTH_FIELDS,       colorClass: 'text-danger'  },
  { id: 'procurement',   label: 'Procurement & Community', icon: HeartHandshake, fields: PROCUREMENT_FIELDS,  colorClass: 'text-info'    },
  { id: 'financial',     label: 'Financial',               icon: DollarSign,     fields: FINANCIAL_FIELDS,    colorClass: 'text-success' },
  { id: 'timeline',      label: 'Timeline & Team',         icon: Clock,          fields: TIMELINE_FIELDS,     colorClass: 'text-warning' },
  { id: 'attendance',    label: 'Attendance',              icon: Users,          fields: ATTENDANCE_FIELDS,   colorClass: 'text-primary' },
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

/* ── Component ─────────────────────────────────────────────────────── */
const EventDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent]         = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [activeModule, setActiveModule] = useState('green-ops');

  useEffect(() => {
    getEventDetail(id).then(data => { if (data) setEvent(data); });
  }, [id]);

  if (!event) return <div className="loading">Loading…</div>;

  const handleModuleSave = async (updatedFields) => {
    const merged = { ...event, ...updatedFields };
    const saveFn = MODULE_SAVE[activeModule];
    if (saveFn) await saveFn(event.id, merged);
    const refreshed = await getEventDetail(event.id);
    if (refreshed) setEvent(refreshed);
    else setEvent(merged);
  };

  const renderOverview = () => {
    const currentModule = MODULE_TABS.find(t => t.id === activeModule);
    if (!currentModule) return null;
    const Icon = currentModule.icon;
    return (
      <div className="overview-wrapper animate-fade-in">
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
        <div className="mt-4">
          <EditableModule
            key={activeModule}
            title={currentModule.label}
            icon={<Icon className={currentModule.colorClass} />}
            fields={currentModule.fields}
            data={event}
            onSave={handleModuleSave}
          />
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'esg':      return <ESGData eventId={event.id} />;
      case 'project':  return <ProjectMgmt eventId={event.id} />;
      default:         return null;
    }
  };

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
      </div>

      <div className="internal-tabs">
        <button className={`internal-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
        <button className={`internal-tab ${activeTab === 'esg'      ? 'active' : ''}`} onClick={() => setActiveTab('esg')}>ESG Data</button>
        <button className={`internal-tab ${activeTab === 'project'  ? 'active' : ''}`} onClick={() => setActiveTab('project')}>Project Management</button>
      </div>

      <div className="tab-content mt-4">
        {renderContent()}
      </div>
    </div>
  );
};

export default EventDetail;
