import { useState, useEffect } from 'react';
import { getEventsFull, getCorporateGovernance, saveCorporateGovernance } from '../utils/db';
import { Cloud, Zap, ShieldAlert, HeartHandshake, Landmark, Users, DollarSign, Calendar, Flame } from 'lucide-react';
import EditableModule from '../components/EditableModule';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, ComposedChart, Line
} from 'recharts';
import './Dashboard.css';

/* ── Chart colour tokens ─────────────────────────────────────────── */
const C = {
  green:  '#10B981',
  blue:   '#3B82F6',
  amber:  '#F59E0B',
  red:    '#EF4444',
  purple: '#8B5CF6',
  pink:   '#EC4899',
  teal:   '#14B8A6',
};

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  fontSize: '12px',
  color: 'var(--text-primary)',
};

/* ── Corporate-level field definitions ──────────────────────────── */
const CORP_STRATEGY_FIELDS = [
  { key: 'gov_committee_name',             label: 'Sustainability Committee Name',     type: 'text' },
  { key: 'gov_meeting_frequency',          label: 'Oversight Review Frequency',        type: 'text' },
  { key: 'gov_strategy_integration_text',  label: 'Strategy Integration Framework',   type: 'textarea' },
  { key: 'gov_executive_accountability_text', label: 'Executive Accountability Structure', type: 'textarea' },
  { key: 'risk_identification_text',       label: 'Sustainability Risk Identification', type: 'textarea' },
  { key: 'risk_erm_integration_status',    label: 'ERM Matrix Integration Status',     type: 'textarea' },
  { key: 'risk_assessment_text',           label: 'Climate Scenario Resilience Summary', type: 'textarea' },
  { key: 'fin_position_time_horizon',      label: 'Financial Impact Time Horizon',     type: 'text' },
];

const CLIMATE_FINANCE_FIELDS = [
  { key: 'climate_transition_risk_rm',  label: 'Transition Risk Exposure',        unit: 'RM' },
  { key: 'climate_transition_risk_pct', label: 'Transition Risk (%)',             unit: '%' },
  { key: 'climate_physical_risk_rm',    label: 'Acute Physical Risk Exposure',    unit: 'RM' },
  { key: 'climate_physical_risk_pct',   label: 'Acute Physical Risk (%)',         unit: '%' },
  { key: 'climate_chronic_risk_rm',     label: 'Chronic Physical Risk Exposure',  unit: 'RM' },
  { key: 'climate_chronic_risk_pct',    label: 'Chronic Physical Risk (%)',       unit: '%' },
  { key: 'climate_opportunities_rm',    label: 'Climate Opportunities Alignment', unit: 'RM' },
  { key: 'climate_opportunities_pct',   label: 'Climate Opportunities (%)',       unit: '%' },
  { key: 'climate_capex_rm',            label: 'Climate Mitigation Capital',      unit: 'RM' },
  { key: 'internal_carbon_price',       label: 'Internal Carbon Shadow Pricing',  unit: 'RM/tCO₂e' },
  { key: 'exec_climate_remun_pct',      label: 'Executive Remuneration Linkage',  unit: '%' },
  { key: 'fin_position_impact_rm',      label: 'Financial Position Impact',       unit: 'RM' },
  { key: 'fin_position_impact_pct',     label: 'Financial Position Impact (%)',   unit: '%' },
];

const HR_DIVERSITY_FIELDS = [
  { key: 'board_male_pct',                label: 'Board — Male',                       unit: '%' },
  { key: 'board_female_pct',              label: 'Board — Female',                     unit: '%' },
  { key: 'board_under30_pct',             label: 'Age Profile — Under 30',             unit: '%' },
  { key: 'board_30to50_pct',              label: 'Age Profile — 30 to 50',             unit: '%' },
  { key: 'board_over50_pct',              label: 'Age Profile — Over 50',              unit: '%' },
  { key: 'anticorrupt_training_coverage', label: 'Anti-Corruption Training Coverage',  unit: '%' },
  { key: 'corruption_risk_assessment_pct',label: 'Corruption Risk Assessment',         unit: '%' },
  { key: 'confirmed_corruption_incidents',label: 'Confirmed Corruption Incidents',      type: 'number' },
];

/* ── Read-only aggregate field helpers ──────────────────────────── */
const agg = (key, label, unit) => ({ key, label, unit, readOnly: true });

/* ── Utility: truncate event name for chart axis ────────────────── */
const short = (name, max = 14) =>
  name && name.length > max ? name.substring(0, max) + '…' : (name || '—');

/* ── Empty chart placeholder ──────────────────────────────────────*/
const ChartEmpty = () => (
  <div className="chart-empty">
    <Cloud size={32} className="text-tertiary" />
    <p>No event data for selected year</p>
  </div>
);

/* ── Custom Tooltip ───────────────────────────────────────────────*/
const CustomTooltip = ({ active, payload, label, prefix = '', suffix = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE} className="custom-tooltip">
      <p className="tooltip-label">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.fill || p.color }}>
          {p.name}: {prefix}{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}{suffix}
        </p>
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════════ */
const Dashboard = () => {
  const [events, setEvents]   = useState([]);
  const [corp, setCorp]       = useState({});
  const [selectedYear, setSelectedYear] = useState('2025');
  const [activeTab, setActiveTab]       = useState('green-ops');

  useEffect(() => {
    const load = async () => {
      setEvents(await getEventsFull());
      setCorp(await getCorporateGovernance());
    };
    load();
  }, []);

  const yearEvents = events.filter(e => e.reporting_year === selectedYear);
  const n = yearEvents.length || 1;
  const sum  = (key) => yearEvents.reduce((a, c) => a + (Number(c[key]) || 0), 0);
  const avg  = (key) => sum(key) / n;

  /* ── Aggregated display object ─────────────────────────────────── */
  const agg_ = {
    total_energy_mwh:           sum('total_energy_mwh'),
    renewable_energy_pct:       avg('renewable_energy_pct'),
    total_water_m3:             sum('total_water_m3'),
    waste_hazardous_tonnes:     sum('waste_hazardous_kg') / 1000,
    waste_nonhazardous_tonnes:  sum('waste_nonhazardous_kg') / 1000,
    waste_diverted_pct:         avg('waste_diverted_pct'),
    sustainable_catering_pct:   avg('sustainable_catering_pct'),
    food_recovery_kg:           sum('food_recovery_kg'),
    scope1_tco2e:               sum('scope1_tco2e'),
    scope2_lb_tco2e:            sum('scope2_lb_tco2e'),
    scope3_tco2e:               sum('scope3_tco2e'),

    fatalities_count:       sum('fatalities_count'),
    ltir:                   avg('ltir'),
    contractor_pct:         avg('contractor_pct'),
    hr_complaints_count:    sum('hr_complaints_count'),
    training_hours_total:   sum('training_hours_total'),
    turnover_count:         sum('turnover_count'),
    safety_trained_count:   sum('safety_trained_count'),
    staff_permanent_count:  sum('staff_permanent_count'),
    staff_contractor_count: sum('staff_contractor_count'),

    local_supplier_spend_pct: avg('local_supplier_spend_pct'),
    community_invest_rm:      sum('community_invest_rm'),
    community_beneficiaries:  sum('community_beneficiaries'),
    data_breach_complaints:   sum('data_breach_complaints'),

    budget_estimated:  sum('budget_estimated'),
    budget_actual:     sum('budget_actual'),
    revenue_estimated: sum('revenue_estimated'),
    revenue_actual:    sum('revenue_actual'),
    green_spend_rm:    sum('green_spend_rm'),
  };

  agg_.safety_pct = agg_.safety_trained_count
    ? `${((agg_.safety_trained_count / ((agg_.staff_permanent_count + agg_.staff_contractor_count) || 1)) * 100).toFixed(1)}%`
    : '—';

  const totalEmissions = agg_.scope1_tco2e + agg_.scope2_lb_tco2e + agg_.scope3_tco2e;
  const netProfit = agg_.revenue_actual - agg_.budget_actual;

  /* ── Chart datasets ────────────────────────────────────────────── */
  const emissionsData = yearEvents.map(e => ({
    name: short(e.event_name),
    'Scope 1': +((e.scope1_tco2e) || 0).toFixed(2),
    'Scope 2': +((e.scope2_lb_tco2e) || 0).toFixed(2),
    'Scope 3': +((e.scope3_tco2e) || 0).toFixed(2),
  }));

  const wasteData = (() => {
    const diverted = (sum('waste_recycled_kg') + sum('waste_composted_kg') + sum('waste_upcycled_kg')) / 1000;
    const landfill = Math.max(0, agg_.waste_hazardous_tonnes + agg_.waste_nonhazardous_tonnes - diverted);
    return [
      { name: 'Diverted', value: +diverted.toFixed(2), fill: C.green },
      { name: 'Landfill', value: +landfill.toFixed(2), fill: C.red },
      { name: 'Hazardous', value: +agg_.waste_hazardous_tonnes.toFixed(2), fill: C.amber },
    ].filter(d => d.value > 0);
  })();

  const energyData = yearEvents.map(e => ({
    name: short(e.event_name),
    'Total Energy (MWh)': +(e.total_energy_mwh || 0).toFixed(2),
    'Renewable %':        +(e.renewable_energy_pct || 0).toFixed(1),
  }));

  const financialData = yearEvents.map(e => ({
    name: short(e.event_name),
    'Budget': +(e.budget_estimated || 0),
    'Actual Cost': +(e.budget_actual || 0),
    'Revenue': +(e.revenue_actual || 0),
  }));

  const healthData = yearEvents.map(e => ({
    name: short(e.event_name),
    'Training Hours': +(e.training_hours_total || 0),
    'LTIR': +(e.ltir || 0).toFixed(2),
  }));

  const diversityData = corp.board_male_pct != null ? [
    { name: 'Male',   value: +(corp.board_male_pct || 0),   fill: C.blue },
    { name: 'Female', value: +(corp.board_female_pct || 0), fill: C.pink },
  ] : [];

  const ageData = corp.board_under30_pct != null ? [
    { name: '<30',   value: +(corp.board_under30_pct || 0), fill: C.green },
    { name: '30–50', value: +(corp.board_30to50_pct || 0),  fill: C.blue },
    { name: '>50',   value: +(corp.board_over50_pct || 0),  fill: C.purple },
  ] : [];

  /* ── Corp save handler ─────────────────────────────────────────── */
  const handleCorpSave = async (updatedFields) => {
    const updated = { ...corp, ...updatedFields };
    await saveCorporateGovernance(updated);
    setCorp(updated);
  };

  /* ── Static banner ─────────────────────────────────────────────── */
  const BANNER = 'Aggregated from individual events — edit within each event';

  /* ── Aggregate field configs ───────────────────────────────────── */
  const AGG_GREEN = [
    agg('total_energy_mwh',         'Total Energy Consumption',        'MWh'),
    agg('renewable_energy_pct',      'Renewable Energy Share (avg)',    '%'),
    agg('total_water_m3',            'Total Water Consumption',         'm³'),
    agg('waste_hazardous_tonnes',    'Total Hazardous Waste',           'Tonnes'),
    agg('waste_nonhazardous_tonnes', 'Total Non-Hazardous Waste',       'Tonnes'),
    agg('waste_diverted_pct',        'Waste Diversion Rate (avg)',      '%'),
    agg('sustainable_catering_pct',  'Sustainable Catering Rate (avg)', '%'),
    agg('food_recovery_kg',          'Surplus Food Recovery',           'kg'),
    agg('scope1_tco2e',              'Total Scope 1 Emissions',         'tCO₂e'),
    agg('scope2_lb_tco2e',           'Total Scope 2 Emissions',         'tCO₂e'),
    agg('scope3_tco2e',              'Total Scope 3 Emissions',         'tCO₂e'),
  ];

  const AGG_HEALTH = [
    agg('fatalities_count',      'Total Work-Related Fatalities',      ''),
    agg('ltir',                  'Lost Time Injury Rate — avg',        ''),
    { key: 'safety_pct', label: 'Safety Training Coverage (avg)', readOnly: true, compute: d => d.safety_pct },
    agg('contractor_pct',        'Contract & Temp Staff Ratio (avg)',  '%'),
    agg('hr_complaints_count',   'Total Human Rights Complaints',      ''),
    agg('training_hours_total',  'Total Employee Training Hours',      'hrs'),
    agg('turnover_count',        'Total Employee Turnover Headcount',  ''),
  ];

  const AGG_PROC = [
    agg('local_supplier_spend_pct', 'Local Supplier Spend (avg)',      '%'),
    agg('community_invest_rm',      'Total Community Investment',       'RM'),
    agg('community_beneficiaries',  'Community Beneficiaries',          ''),
    agg('data_breach_complaints',   'Substantiated Privacy Breaches',   ''),
  ];

  const AGG_FIN = [
    agg('budget_estimated',  'Total Estimated Budget',   'RM'),
    agg('budget_actual',     'Total Actual Cost',        'RM'),
    {
      key: '_bvar', label: 'Budget Variance & Utilisation', readOnly: true,
      compute: d => {
        const v = (d.budget_estimated||0) - (d.budget_actual||0);
        const u = d.budget_estimated ? (((d.budget_actual||0)/d.budget_estimated)*100).toFixed(1) : 0;
        return `RM ${v.toLocaleString()} (${u}% utilised)`;
      }
    },
    agg('revenue_estimated', 'Total Estimated Revenue',  'RM'),
    agg('revenue_actual',    'Total Actual Revenue',     'RM'),
    {
      key: '_revvar', label: 'Revenue Variance', readOnly: true,
      compute: d => `RM ${((d.revenue_actual||0)-(d.revenue_estimated||0)).toLocaleString()}`
    },
    {
      key: '_net', label: 'Overall Net Profit / Loss & ROI', readOnly: true,
      compute: d => {
        const p  = (d.revenue_actual||0) - (d.budget_actual||0);
        const roi = d.budget_actual ? ((p/d.budget_actual)*100).toFixed(1) : 0;
        return `RM ${p.toLocaleString()} (${roi}% ROI)`;
      }
    },
    agg('green_spend_rm', 'Total Green Spend', 'RM'),
    {
      key: '_gsratio', label: 'Green Spend Ratio', readOnly: true,
      compute: d => d.budget_actual ? `${(((d.green_spend_rm||0)/d.budget_actual)*100).toFixed(1)}%` : '—'
    },
  ];

  /* ── Chart panels ─────────────────────────────────────────────── */
  const renderGreenCharts = () => (
    <div className="charts-row">
      <div className="chart-card glass-card">
        <h4 className="chart-title">GHG Emissions by Event (tCO₂e)</h4>
        {yearEvents.length === 0 ? <ChartEmpty /> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={emissionsData} margin={{ top: 5, right: 10, left: -10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip suffix=" tCO₂e" />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Scope 1" stackId="a" fill={C.red}    radius={[0,0,0,0]} />
              <Bar dataKey="Scope 2" stackId="a" fill={C.amber}  radius={[0,0,0,0]} />
              <Bar dataKey="Scope 3" stackId="a" fill={C.blue}   radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="chart-card glass-card">
        <h4 className="chart-title">Waste Composition (Tonnes)</h4>
        {wasteData.length === 0 ? <ChartEmpty /> : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={wasteData} cx="50%" cy="45%" innerRadius={55} outerRadius={85}
                paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}t`}
                labelLine={false} />
              <Tooltip formatter={(v) => `${v} t`} contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="chart-card glass-card chart-wide">
        <h4 className="chart-title">Energy Consumption per Event (MWh)</h4>
        {yearEvents.length === 0 ? <ChartEmpty /> : (
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={energyData} margin={{ top: 5, right: 30, left: -10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" interval={0} />
              <YAxis yAxisId="left"  tick={{ fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="Total Energy (MWh)" fill={C.blue} radius={[3,3,0,0]} />
              <Line yAxisId="right" type="monotone" dataKey="Renewable %" stroke={C.green} strokeWidth={2} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );

  const renderHealthCharts = () => (
    <div className="charts-row">
      <div className="chart-card glass-card chart-wide">
        <h4 className="chart-title">Training Hours per Event</h4>
        {yearEvents.length === 0 ? <ChartEmpty /> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={healthData} margin={{ top: 5, right: 10, left: -10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip suffix=" hrs" />} />
              <Bar dataKey="Training Hours" fill={C.teal} radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="chart-card glass-card">
        <h4 className="chart-title">LTIR by Event</h4>
        {yearEvents.length === 0 ? <ChartEmpty /> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={healthData} margin={{ top: 5, right: 10, left: -10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="LTIR" fill={C.red} radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );

  const renderFinancialCharts = () => (
    <div className="charts-row">
      <div className="chart-card glass-card chart-full">
        <h4 className="chart-title">Budget vs Actual Cost vs Revenue (RM)</h4>
        {yearEvents.length === 0 ? <ChartEmpty /> : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={financialData} margin={{ top: 5, right: 10, left: 10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
              <Tooltip
                formatter={(v) => `RM ${v.toLocaleString()}`}
                contentStyle={TOOLTIP_STYLE}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Budget"      fill={C.blue}  radius={[3,3,0,0]} />
              <Bar dataKey="Actual Cost" fill={C.amber} radius={[3,3,0,0]} />
              <Bar dataKey="Revenue"     fill={C.green} radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );

  const renderHRCharts = () => (
    <div className="charts-row">
      <div className="chart-card glass-card">
        <h4 className="chart-title">Board Gender Composition (%)</h4>
        {diversityData.length === 0 ? <ChartEmpty /> : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={diversityData} cx="50%" cy="45%" innerRadius={55} outerRadius={85}
                paddingAngle={3} dataKey="value"
                label={({ name, value }) => `${name}: ${value}%`} labelLine={false} />
              <Tooltip formatter={(v) => `${v}%`} contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="chart-card glass-card">
        <h4 className="chart-title">Board Age Profile (%)</h4>
        {ageData.length === 0 ? <ChartEmpty /> : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={ageData} cx="50%" cy="45%" innerRadius={55} outerRadius={85}
                paddingAngle={3} dataKey="value"
                label={({ name, value }) => `${name}: ${value}%`} labelLine={false} />
              <Tooltip formatter={(v) => `${v}%`} contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );

  /* ── Tab config ───────────────────────────────────────────────── */
  const TABS = [
    { id: 'green-ops',       label: 'Green Ops' },
    { id: 'health-safety',   label: 'Health, Safety & Labour' },
    { id: 'procurement',     label: 'Procurement & Community' },
    { id: 'financial',       label: 'Financial Summary' },
    { id: 'corp-strategy',   label: 'Corporate Strategy & Risk' },
    { id: 'climate-finance', label: 'Climate Finance' },
    { id: 'hr-diversity',    label: 'Enterprise HR & Diversity' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'green-ops':
        return (
          <>
            {renderGreenCharts()}
            <EditableModule title="Green Ops" icon={<Cloud className="text-primary" />}
              fields={AGG_GREEN} data={agg_} onSave={() => {}} readOnlyBanner={BANNER} />
          </>
        );
      case 'health-safety':
        return (
          <>
            {renderHealthCharts()}
            <EditableModule title="Health, Safety & Labour" icon={<ShieldAlert className="text-danger" />}
              fields={AGG_HEALTH} data={agg_} onSave={() => {}} readOnlyBanner={BANNER} />
          </>
        );
      case 'procurement':
        return (
          <EditableModule title="Procurement & Community" icon={<HeartHandshake className="text-info" />}
            fields={AGG_PROC} data={agg_} onSave={() => {}} readOnlyBanner={BANNER} />
        );
      case 'financial':
        return (
          <>
            {renderFinancialCharts()}
            <EditableModule title="Financial Summary" icon={<DollarSign className="text-success" />}
              fields={AGG_FIN} data={agg_} onSave={() => {}} readOnlyBanner={BANNER} />
          </>
        );
      case 'corp-strategy':
        return (
          <EditableModule title="Corporate Strategy & Risk (IFRS S1)" icon={<Landmark className="text-warning" />}
            fields={CORP_STRATEGY_FIELDS} data={corp} onSave={handleCorpSave} />
        );
      case 'climate-finance':
        return (
          <EditableModule title="Climate Finance (IFRS S2)" icon={<Zap className="text-primary" />}
            fields={CLIMATE_FINANCE_FIELDS} data={corp} onSave={handleCorpSave} />
        );
      case 'hr-diversity':
        return (
          <>
            {renderHRCharts()}
            <EditableModule title="Enterprise HR & Diversity" icon={<Users className="text-info" />}
              fields={HR_DIVERSITY_FIELDS} data={corp} onSave={handleCorpSave} />
          </>
        );
      default:
        return null;
    }
  };

  /* ── KPI Stat Cards ───────────────────────────────────────────── */
  const statCards = [
    {
      label: 'Events This Year',
      value: yearEvents.length,
      sub: `of ${events.length} total`,
      icon: Calendar,
      color: C.green,
      bg: 'rgba(16,185,129,0.08)',
    },
    {
      label: 'Total CO₂e Emitted',
      value: `${totalEmissions.toFixed(1)}`,
      sub: 'tCO₂e (S1+S2+S3)',
      icon: Flame,
      color: C.red,
      bg: 'rgba(239,68,68,0.08)',
    },
    {
      label: 'Total Energy',
      value: `${agg_.total_energy_mwh.toFixed(1)}`,
      sub: 'MWh consumed',
      icon: Zap,
      color: C.amber,
      bg: 'rgba(245,158,11,0.08)',
    },
    {
      label: 'Net Profit / Loss',
      value: `RM ${Math.abs(netProfit).toLocaleString()}`,
      sub: netProfit >= 0 ? 'Profit' : 'Loss',
      icon: DollarSign,
      color: netProfit >= 0 ? C.green : C.red,
      bg: netProfit >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
    },
  ];

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <div className="dashboard-container animate-fade-in">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h2>Overview Dashboard</h2>
          <p className="text-secondary">Comprehensive ESG metrics aggregated across all events.</p>
        </div>
        <div className="year-selector">
          <label>Financial Year:</label>
          <select className="input-field" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
            <option value="2025">FYE 2025</option>
            <option value="2024">FYE 2024</option>
            <option value="2023">FYE 2023</option>
          </select>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="kpi-row">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="kpi-card glass-card">
              <div className="kpi-icon-wrap" style={{ backgroundColor: card.bg }}>
                <Icon size={20} style={{ color: card.color }} />
              </div>
              <div className="kpi-body">
                <span className="kpi-value" style={{ color: card.color }}>{card.value}</span>
                <span className="kpi-label">{card.label}</span>
                <span className="kpi-sub">{card.sub}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Module Tabs */}
      <div className="module-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`module-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="tab-content-area">
        {renderContent()}
      </div>
    </div>
  );
};

export default Dashboard;
