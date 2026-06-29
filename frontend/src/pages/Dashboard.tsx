import { useState, useEffect } from 'react';
import { getEventsFull, getCorporateGovernance, saveCorporateGovernance } from '../utils/db';
import { Cloud, Zap, ShieldAlert, HeartHandshake, Landmark, Users, DollarSign, Calendar, Flame } from 'lucide-react';
import EditableModule from '../components/EditableModule';
import MetricSparkGrid from '../components/MetricSparkGrid';
import { useReportingYear } from '../hooks/useReportingYear';
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line,
} from 'recharts';
import { CHART_COLORS as C, truncateLabel as short, ChartTooltip, ChartEmpty, KpiCard, DonutChart, BarChartPanel, GaugeBar } from '../components/charts';
import './Dashboard.css';

/* ── Corporate-level field definitions ──────────────────────────── */

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

// Female/male % are derived from real headcounts rather than typed by hand —
// the underlying board_female_pct/board_male_pct DB columns predate the
// emp_*/board_* headcount columns and are no longer written to from this UI.
const pctOf = (numKey: string, denKey: string) => (d: any) => {
  const den = Number(d[denKey]) || 0;
  if (den <= 0) return '—';
  return `${((Number(d[numKey]) || 0) / den * 100).toFixed(1)}%`;
};

const HR_DIVERSITY_FIELDS = [
  { key: 'board_total',                   label: 'Board — Total Members',              type: 'number' },
  { key: 'board_female',                  label: 'Board — Female Headcount',           type: 'number' },
  { key: 'board_male',                    label: 'Board — Male Headcount',             type: 'number' },
  { key: 'board_female_pct',              label: 'Board — Female %',                    readOnly: true, compute: pctOf('board_female', 'board_total') },
  { key: 'board_male_pct',                label: 'Board — Male %',                      readOnly: true, compute: pctOf('board_male', 'board_total') },
  { key: 'board_under30_pct',             label: 'Board Age Profile — Under 30',       unit: '%' },
  { key: 'board_30to50_pct',              label: 'Board Age Profile — 30 to 50',       unit: '%' },
  { key: 'board_over50_pct',              label: 'Board Age Profile — Over 50',        unit: '%' },
  { key: 'emp_total',                     label: 'Workforce — Total Employees',        type: 'number' },
  { key: 'emp_female',                    label: 'Workforce — Female Headcount',       type: 'number' },
  { key: 'emp_male',                      label: 'Workforce — Male Headcount',         type: 'number' },
  { key: 'emp_female_pct',                label: 'Workforce — Female %',                readOnly: true, compute: pctOf('emp_female', 'emp_total') },
  { key: 'emp_male_pct',                  label: 'Workforce — Male %',                  readOnly: true, compute: pctOf('emp_male', 'emp_total') },
  { key: 'emp_under30_pct',               label: 'Workforce Age Profile — Under 30',   unit: '%' },
  { key: 'emp_30to50_pct',                label: 'Workforce Age Profile — 30 to 50',   unit: '%' },
  { key: 'emp_over50_pct',                label: 'Workforce Age Profile — Over 50',    unit: '%' },
  { key: 'anticorrupt_training_coverage', label: 'Anti-Corruption Training Coverage',  unit: '%' },
  { key: 'corruption_risk_assessment_pct',label: 'Corruption Risk Assessment',         unit: '%' },
  { key: 'confirmed_corruption_incidents',label: 'Confirmed Corruption Incidents',      type: 'number' },
];

/* ── Read-only aggregate field helpers ──────────────────────────── */
const agg = (key, label, unit) => ({ key, label, unit, readOnly: true });

/* ═══════════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════════ */
const Dashboard = () => {
  const [events, setEvents]   = useState([]);
  const [corp, setCorp]       = useState<any>({});
  const { selectedYear, setSelectedYear, availableYears } = useReportingYear(events.map((e: any) => e.reporting_year));
  const [activeTab, setActiveTab]       = useState('green-ops');

  useEffect(() => {
    getEventsFull().then(setEvents);
  }, []);

  useEffect(() => {
    getCorporateGovernance(selectedYear).then(setCorp);
  }, [selectedYear]);

  const yearEvents = events.filter(e => e.reporting_year === selectedYear);
  const n = yearEvents.length || 1;
  const sum  = (key) => yearEvents.reduce((a, c) => a + (Number(c[key]) || 0), 0);
  const avg  = (key) => sum(key) / n;

  /* ── Aggregated display object ─────────────────────────────────── */
  const agg_: Record<string, any> = {
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
    local_supplier_spend_rm:  sum('local_supplier_spend_rm'),
    procurement_total_rm:     sum('procurement_total_rm'),
    community_invest_rm:      sum('community_invest_rm'),
    community_beneficiaries:  sum('community_beneficiaries'),
    data_breach_complaints:   sum('data_breach_complaints'),

    budget_estimated:  sum('budget_estimated'),
    budget_actual:     sum('budget_actual'),
    revenue_estimated: sum('revenue_estimated'),
    revenue_actual:    sum('revenue_actual'),
    green_spend_rm:    sum('green_spend_rm'),
    renewable_energy_mwh: sum('renewable_energy_mwh'),
  };

  agg_.safety_training_pct = agg_.safety_trained_count
    ? (agg_.safety_trained_count / ((agg_.staff_permanent_count + agg_.staff_contractor_count) || 1)) * 100
    : 0;
  agg_.safety_pct = agg_.safety_trained_count ? `${agg_.safety_training_pct.toFixed(1)}%` : '—';

  const totalEmissions = agg_.scope1_tco2e + agg_.scope2_lb_tco2e + agg_.scope3_tco2e;
  const netProfit = agg_.revenue_actual - agg_.budget_actual;

  const prevYear   = String(Number(selectedYear) - 1);
  const prevEvents = events.filter(e => e.reporting_year === prevYear);
  const prevSum    = (key) => prevEvents.reduce((a, c) => a + (Number(c[key]) || 0), 0);
  const prevEmissions = prevSum('scope1_tco2e') + prevSum('scope2_lb_tco2e') + prevSum('scope3_tco2e');
  const prevNetProfit = prevSum('revenue_actual') - prevSum('budget_actual');
  const trendOf = (curr, prev) => {
    if (!prev) return null;
    const pct = ((curr - prev) / Math.abs(prev)) * 100;
    return { pct: Math.abs(pct).toFixed(1), positive: pct > 0 };
  };

  /* ── Chart datasets ────────────────────────────────────────────── */
  const emissionsData = yearEvents.map(e => ({
    name: short(e.event_name),
    'Scope 1': +((e.scope1_tco2e) || 0).toFixed(2),
    'Scope 2': +((e.scope2_lb_tco2e) || 0).toFixed(2),
    'Scope 3': +((e.scope3_tco2e) || 0).toFixed(2),
  }));

  const wasteByEventData = yearEvents.map(e => ({
    name: short(e.event_name),
    'Hazardous':     +((e.waste_hazardous_kg    || 0) / 1000).toFixed(3),
    'Non-Hazardous': +((e.waste_nonhazardous_kg || 0) / 1000).toFixed(3),
  }));

  const energyData = yearEvents.map(e => ({
    name: short(e.event_name),
    'Total Energy (MWh)': +(e.total_energy_mwh || 0).toFixed(2),
    'Renewable %':        +(e.renewable_energy_pct || 0).toFixed(1),
  }));

  const renewableData = agg_.total_energy_mwh > 0 ? [
    { name: 'Renewable',     value: +agg_.renewable_energy_mwh.toFixed(2), fill: C.green },
    { name: 'Non-Renewable', value: +Math.max(0, agg_.total_energy_mwh - agg_.renewable_energy_mwh).toFixed(2), fill: C.blue },
  ] : [];

  const localSupplierData = agg_.procurement_total_rm > 0 ? [
    { name: 'Local',     value: +agg_.local_supplier_spend_rm.toFixed(2), fill: C.green },
    { name: 'Non-Local', value: +Math.max(0, agg_.procurement_total_rm - agg_.local_supplier_spend_rm).toFixed(2), fill: C.blue },
  ] : [];

  const greenSpendData = agg_.budget_actual > 0 ? [
    { name: 'Green Spend', value: +agg_.green_spend_rm.toFixed(2), fill: C.green },
    { name: 'Other Spend', value: +Math.max(0, agg_.budget_actual - agg_.green_spend_rm).toFixed(2), fill: C.blue },
  ] : [];

  const climateRiskData = [{
    name: 'Risk Exposure (RM)',
    'Transition Risk':       +(corp.climate_transition_risk_rm || 0),
    'Acute Physical Risk':   +(corp.climate_physical_risk_rm   || 0),
    'Chronic Physical Risk': +(corp.climate_chronic_risk_rm    || 0),
  }];
  const hasClimateRiskData = climateRiskData[0]['Transition Risk'] > 0
    || climateRiskData[0]['Acute Physical Risk'] > 0
    || climateRiskData[0]['Chronic Physical Risk'] > 0;

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

  const boardTotal = Number(corp.board_total) || 0;
  const diversityData = boardTotal > 0 ? [
    { name: 'Male',   value: (Number(corp.board_male)   || 0) / boardTotal * 100, fill: C.blue },
    { name: 'Female', value: (Number(corp.board_female) || 0) / boardTotal * 100, fill: C.pink },
  ] : [];

  const ageData = corp.board_under30_pct != null ? [
    { name: 'Under 30', value: +(corp.board_under30_pct || 0), fill: C.green },
    { name: '30–50',    value: +(corp.board_30to50_pct || 0),  fill: C.blue },
    { name: 'Over 50',  value: +(corp.board_over50_pct || 0),  fill: C.purple },
  ] : [];

  const empAgeData = corp.emp_under30_pct != null ? [
    { name: 'Under 30', value: +(corp.emp_under30_pct || 0), fill: C.green },
    { name: '30–50',    value: +(corp.emp_30to50_pct || 0),  fill: C.blue },
    { name: 'Over 50',  value: +(corp.emp_over50_pct || 0),  fill: C.purple },
  ] : [];

  /* ── Corp save handler ─────────────────────────────────────────── */
  const handleCorpSave = async (updatedFields) => {
    const updated = { ...corp, ...updatedFields };
    await saveCorporateGovernance(updated, selectedYear);
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
        <BarChartPanel
          data={emissionsData} stacked tooltipSuffix=" tCO₂e"
          series={[
            { dataKey: 'Scope 1', fill: C.red,   stackId: 'a' },
            { dataKey: 'Scope 2', fill: C.amber, stackId: 'a' },
            { dataKey: 'Scope 3', fill: C.blue,  stackId: 'a' },
          ]}
        />
      </div>

      <div className="chart-card glass-card">
        <h4 className="chart-title">Hazardous vs Non-Hazardous Waste (Tonnes)</h4>
        <BarChartPanel
          data={wasteByEventData} stacked tooltipSuffix=" t"
          series={[
            { dataKey: 'Hazardous',     fill: C.amber, stackId: 'a' },
            { dataKey: 'Non-Hazardous', fill: C.blue,  stackId: 'a' },
          ]}
        />
      </div>

      <div className="chart-card glass-card chart-wide">
        <h4 className="chart-title">Energy Consumption per Event (MWh)</h4>
        {yearEvents.length === 0 ? <ChartEmpty /> : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={energyData} margin={{ top: 20, right: 30, left: -10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" interval={0} height={60} />
              <YAxis yAxisId="left"  tick={{ fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
              <Tooltip content={<ChartTooltip />} />
              <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: 8 }} />
              <Bar yAxisId="left" dataKey="Total Energy (MWh)" fill={C.blue} radius={[3,3,0,0]} />
              <Line yAxisId="right" type="monotone" dataKey="Renewable %" stroke={C.green} strokeWidth={2} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="chart-card glass-card">
        <h4 className="chart-title">Renewable Energy Share</h4>
        <DonutChart data={renewableData} valueSuffix=" MWh" emptyMessage="No energy data for selected year" />
      </div>

      <div className="chart-card glass-card">
        <h4 className="chart-title">Waste Diversion Rate (avg, toward 100% target)</h4>
        <GaugeBar pct={agg_.waste_diverted_pct} color={C.green} />
      </div>

      <div className="chart-card glass-card">
        <h4 className="chart-title">Sustainable Catering Rate (avg, toward 100% target)</h4>
        <GaugeBar pct={agg_.sustainable_catering_pct} color={C.teal} />
      </div>
    </div>
  );

  const renderHealthCharts = () => (
    <div className="charts-row">
      <div className="chart-card glass-card">
        <KpiCard label="Work-Related Fatalities" value={agg_.fatalities_count} severity />
      </div>
      <div className="chart-card glass-card">
        <KpiCard label="Human Rights Complaints" value={agg_.hr_complaints_count} severity />
      </div>

      <div className="chart-card glass-card chart-wide">
        <h4 className="chart-title">Training Hours per Event</h4>
        <BarChartPanel data={healthData} tooltipSuffix=" hrs" series={[{ dataKey: 'Training Hours', fill: C.teal }]} />
      </div>
      <div className="chart-card glass-card">
        <h4 className="chart-title">LTIR by Event</h4>
        <BarChartPanel data={healthData} series={[{ dataKey: 'LTIR', fill: C.red }]} />
      </div>

      <div className="chart-card glass-card">
        <h4 className="chart-title">Safety Training Coverage (avg, toward 100% target)</h4>
        <GaugeBar pct={agg_.safety_training_pct} color={C.green} />
      </div>
      <div className="chart-card glass-card">
        <h4 className="chart-title">Contract & Temp vs Permanent Staff</h4>
        <DonutChart
          valueSuffix=""
          data={(agg_.staff_permanent_count + agg_.staff_contractor_count) > 0 ? [
            { name: 'Permanent', value: agg_.staff_permanent_count, fill: C.blue },
            { name: 'Contract/Temp', value: agg_.staff_contractor_count, fill: C.purple },
          ] : []}
        />
      </div>
    </div>
  );

  const renderProcurementCharts = () => (
    <div className="charts-row">
      <div className="chart-card glass-card">
        <h4 className="chart-title">Local Supplier Spend (RM)</h4>
        <DonutChart data={localSupplierData} valueSuffix=" RM" />
      </div>
      <div className="chart-card glass-card">
        <KpiCard label="Substantiated Privacy Breaches" value={agg_.data_breach_complaints} severity />
      </div>
    </div>
  );

  const renderFinancialCharts = () => (
    <div className="charts-row">
      <div className="chart-card glass-card chart-wide">
        <h4 className="chart-title">Budget vs Actual Cost vs Revenue (RM)</h4>
        <BarChartPanel
          data={financialData} tooltipPrefix="RM " height={240}
          yTickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)}
          series={[
            { dataKey: 'Budget',      fill: C.blue },
            { dataKey: 'Actual Cost', fill: C.amber },
            { dataKey: 'Revenue',     fill: C.green },
          ]}
        />
      </div>
      <div className="chart-card glass-card">
        <h4 className="chart-title">Green Spend Ratio (RM)</h4>
        <DonutChart data={greenSpendData} valueSuffix=" RM" />
      </div>
    </div>
  );

  const renderClimateFinanceCharts = () => (
    <div className="charts-row">
      <div className="chart-card glass-card chart-wide">
        <h4 className="chart-title">Climate Risk Exposure by Type (RM)</h4>
        {hasClimateRiskData ? (
          <BarChartPanel
            data={climateRiskData} tooltipPrefix="RM "
            series={[
              { dataKey: 'Transition Risk',       fill: C.amber },
              { dataKey: 'Acute Physical Risk',   fill: C.red },
              { dataKey: 'Chronic Physical Risk', fill: C.purple },
            ]}
          />
        ) : <ChartEmpty message="No climate risk data recorded" />}
      </div>
      <div className="chart-card glass-card">
        <h4 className="chart-title">Climate Opportunities Alignment (toward 100% target)</h4>
        <GaugeBar pct={corp.climate_opportunities_pct || 0} color={C.green} />
      </div>
      <div className="chart-card glass-card">
        <h4 className="chart-title">Executive Remuneration Linkage (toward 100% target)</h4>
        <GaugeBar pct={corp.exec_climate_remun_pct || 0} color={C.teal} />
      </div>
    </div>
  );

  const renderHRCharts = () => (
    <div className="charts-row">
      <div className="chart-card glass-card">
        <h4 className="chart-title">Board Gender Composition (%)</h4>
        <DonutChart data={diversityData} valueSuffix="%" />
      </div>
      <div className="chart-card glass-card">
        <h4 className="chart-title">Board Age Profile (%)</h4>
        <DonutChart data={ageData} valueSuffix="%" />
      </div>
      <div className="chart-card glass-card">
        <h4 className="chart-title">Workforce Age Profile (%)</h4>
        <DonutChart data={empAgeData} valueSuffix="%" />
      </div>
      <div className="chart-card glass-card">
        <h4 className="chart-title">Anti-Corruption Training Coverage (toward 100% target)</h4>
        <GaugeBar pct={corp.anticorrupt_training_coverage || 0} color={C.green} />
      </div>
      <div className="chart-card glass-card">
        <h4 className="chart-title">Corruption Risk Assessment Coverage (toward 100% target)</h4>
        <GaugeBar pct={corp.corruption_risk_assessment_pct || 0} color={C.amber} />
      </div>
      <div className="chart-card glass-card">
        <KpiCard label="Confirmed Corruption Incidents" value={corp.confirmed_corruption_incidents || 0} severity />
      </div>
    </div>
  );

  /* ── Tab config ───────────────────────────────────────────────── */
  const TABS = [
    { id: 'green-ops',       label: 'Green Ops' },
    { id: 'health-safety',   label: 'Health, Safety & Labour' },
    { id: 'procurement',     label: 'Procurement & Community' },
    { id: 'financial',       label: 'Financial Summary' },
    { id: 'climate-finance', label: 'Climate Finance' },
    { id: 'hr-diversity',    label: 'Enterprise HR & Diversity' },
  ];

  const renderAggModule = (title, IconComp, iconClass, fields, accentColor) => (
    <div className="glass-card aggregate-card">
      <div className="module-header">
        <div className="module-header-left">
          <IconComp size={18} className={iconClass} />
          <h3>{title}</h3>
        </div>
        <span className="readonly-banner">{BANNER}</span>
      </div>
      <MetricSparkGrid fields={fields} data={agg_} accentColor={accentColor} />
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'green-ops':
        return (
          <>
            {renderGreenCharts()}
            {renderAggModule('Green Ops', Cloud, 'text-primary', AGG_GREEN, C.green)}
          </>
        );
      case 'health-safety':
        return (
          <>
            {renderHealthCharts()}
            {renderAggModule('Health, Safety & Labour', ShieldAlert, 'text-danger', AGG_HEALTH, C.red)}
          </>
        );
      case 'procurement':
        return (
          <>
            {renderProcurementCharts()}
            {renderAggModule('Procurement & Community', HeartHandshake, 'text-info', AGG_PROC, C.teal)}
          </>
        );
      case 'financial':
        return (
          <>
            {renderFinancialCharts()}
            {renderAggModule('Financial Summary', DollarSign, 'text-success', AGG_FIN, C.green)}
          </>
        );

      case 'climate-finance':
        return (
          <>
            {renderClimateFinanceCharts()}
            <EditableModule title="Climate Finance (IFRS S2)" icon={<Zap className="text-primary" />}
              fields={CLIMATE_FINANCE_FIELDS} data={corp} onSave={handleCorpSave} />
          </>
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
      trend: trendOf(yearEvents.length, prevEvents.length),
      goodWhenUp: true,
    },
    {
      label: 'Total CO₂e Emitted',
      value: `${totalEmissions.toFixed(1)}`,
      sub: 'tCO₂e (S1+S2+S3)',
      icon: Flame,
      color: C.red,
      bg: 'rgba(239,68,68,0.08)',
      trend: trendOf(totalEmissions, prevEmissions),
      goodWhenUp: false,
    },
    {
      label: 'Total Energy',
      value: `${agg_.total_energy_mwh.toFixed(1)}`,
      sub: 'MWh consumed',
      icon: Zap,
      // var(--warning), not C.amber — C.amber (#F59E0B) only hits ~2.1:1
      // contrast as text on a white background. The CSS variable resolves
      // to a darker, legible shade in light mode and the original bright
      // one in dark mode (see index.css).
      color: 'var(--warning)',
      bg: 'rgba(245,158,11,0.08)',
      trend: trendOf(agg_.total_energy_mwh, prevSum('total_energy_mwh')),
      goodWhenUp: false,
    },
    {
      label: 'Net Profit / Loss',
      value: `RM ${Math.abs(netProfit).toLocaleString()}`,
      sub: netProfit >= 0 ? 'Profit' : 'Loss',
      icon: DollarSign,
      color: netProfit >= 0 ? C.green : C.red,
      bg: netProfit >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
      trend: trendOf(netProfit, prevNetProfit),
      goodWhenUp: true,
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
          <label>Year:</label>
          <select className="input-field" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="kpi-row">
        {statCards.map((card, i) => (
          <KpiCard
            key={i}
            label={card.label}
            value={card.value}
            sub={card.sub}
            icon={card.icon}
            color={card.color}
            bg={card.bg}
            trend={card.trend}
            goodWhenUp={card.goodWhenUp}
            trendSuffix={`% vs ${prevYear}`}
          />
        ))}
      </div>

      {/* Module Tabs */}
      <div className="module-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`module-tab-btn module-tab-${tab.id} ${activeTab === tab.id ? 'active' : ''}`}
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
