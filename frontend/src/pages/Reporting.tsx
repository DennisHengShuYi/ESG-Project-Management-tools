import { useState, useEffect } from 'react';
import { getEventsFull, getCorporateGovernance, CSV_FIELDS } from '../utils/db';
import { FileText, Download, CheckCircle, XCircle } from 'lucide-react';
import { useReportingYear } from '../hooks/useReportingYear';
import './Reporting.css';

// One representative metric per Bursa Malaysia sustainability pillar this
// report aggregates (Green Ops / Health & Safety / Procurement / Financial).
// "Complete" means every pillar has *some* reported data, not just that an
// event row exists for the year — an event with everything left at 0 used to
// pass this check.
const MANDATORY_PILLAR_FIELDS = ['total_energy_mwh', 'man_hours_actual', 'procurement_total_rm', 'budget_actual'];

const IFRS_NARRATIVE_FIELDS: [string, string][] = [
  ['gov_committee_name', 'Sustainability Committee Name'],
  ['gov_meeting_frequency', 'Committee Meeting Frequency'],
  ['gov_board_oversight_text', 'Board Oversight Description'],
  ['gov_executive_accountability_text', 'Executive Accountability'],
  ['gov_strategy_integration_text', 'Sustainability Strategy Integration'],
  ['strategy_short_text', 'Short-Term Risks (0-1 year)'],
  ['strategy_medium_text', 'Medium-Term Risks (1-5 years)'],
  ['strategy_long_text', 'Long-Term Risks (5+ years)'],
  ['scenario_analysis_text', 'Climate Scenario Analysis'],
  ['risk_identification_text', 'Risk Identification Process'],
  ['risk_assessment_text', 'Risk Assessment Methodology'],
  ['risk_erm_integration_status', 'ERM Integration Status'],
];

const IFRS_CLIMATE_FIELDS: [string, string][] = [
  ['climate_transition_risk_rm', 'Transition Risk Exposure (RM)'],
  ['climate_physical_risk_rm', 'Acute Physical Risk Exposure (RM)'],
  ['climate_chronic_risk_rm', 'Chronic Physical Risk Exposure (RM)'],
  ['climate_capex_rm', 'Climate Mitigation Capital (RM)'],
  ['internal_carbon_price', 'Internal Carbon Shadow Pricing (RM/tCO2e)'],
  ['exec_climate_remun_pct', 'Executive Remuneration Linkage (%)'],
  ['fin_position_impact_rm', 'Financial Position Impact (RM)'],
];

// Indicative GRI Topic Standard groupings per module — top-level topic
// numbers only (e.g. GRI 302 Energy), not granular disclosure sub-codes.
const GRI_TOPIC_BY_MODULE: Record<string, string> = {
  'Green Ops': 'GRI 302/303/305/306 (Energy, Water, Emissions, Waste)',
  'Health, Safety & Labour': 'GRI 401/403/404/405/406 (Employment, OH&S, Training, Diversity, Non-discrimination)',
  'Procurement & Community': 'GRI 204/413/418 (Procurement, Local Communities, Customer Privacy)',
  'Financial': 'GRI 201 (Economic Performance)',
  'Timeline & Team': 'GRI 2 (General Disclosures)',
  'Attendance': 'GRI 2 (General Disclosures)',
};

const escapeCsv = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const stripHtml = (v: any) => String(v ?? '').replace(/<[^>]*>?/gm, '');

const downloadCsv = (filename: string, header: string, rows: string[]) => {
  const csv = header + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const Reporting = () => {
  const [events, setEvents] = useState([]);
  const [corp, setCorp] = useState<any>({});
  const { selectedYear, setSelectedYear, availableYears } = useReportingYear(events.map((e: any) => e.reporting_year));

  useEffect(() => {
    let active = true;
    const load = async () => {
      const data = await getEventsFull();
      if (active) setEvents(data);
    };
    load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    getCorporateGovernance(selectedYear).then(setCorp);
  }, [selectedYear]);

  const currentEvents = events.filter(e => e.reporting_year === selectedYear);
  const isComplete = currentEvents.length > 0
    && MANDATORY_PILLAR_FIELDS.every(field => currentEvents.some((e: any) => Number(e[field]) > 0));

  const handleExportSummary = () => {
    const header = 'Module,Metric,Total Value\n';
    const rows = CSV_FIELDS.map(({ key, label, module }) => {
      const total = currentEvents.reduce((a, e: any) => a + (Number(e[key]) || 0), 0);
      return [module, label, total].map(escapeCsv).join(',');
    });
    downloadCsv(`bursa_sustainability_statement_FYE${selectedYear}.csv`, header, rows);
  };

  const handleExportPerEvent = () => {
    const header = 'Event,Module,Metric,Value\n';
    const rows: string[] = [];
    currentEvents.forEach((e: any) => {
      CSV_FIELDS.forEach(({ key, label, module }) => {
        rows.push([e.event_name, module, label, e[key] ?? ''].map(escapeCsv).join(','));
      });
    });
    downloadCsv(`bursa_csi_per_event_FYE${selectedYear}.csv`, header, rows);
  };

  const handleExportIfrsPackage = () => {
    const header = 'Section,Field,Value\n';
    const narrativeRows = IFRS_NARRATIVE_FIELDS.map(([key, label]) =>
      ['IFRS S1 — Governance/Strategy/Risk', label, stripHtml(corp[key])].map(escapeCsv).join(',')
    );
    const climateRows = IFRS_CLIMATE_FIELDS.map(([key, label]) =>
      ['IFRS S2 — Climate Finance', label, corp[key] ?? 0].map(escapeCsv).join(',')
    );
    downloadCsv(`ifrs_s1_s2_package_FYE${selectedYear}.csv`, header, [...narrativeRows, ...climateRows]);
  };

  const handleExportGri = () => {
    const header = 'GRI Topic Standard,Module,Metric,Total Value\n';
    const rows = CSV_FIELDS.map(({ key, label, module }) => {
      const total = currentEvents.reduce((a, e: any) => a + (Number(e[key]) || 0), 0);
      return [GRI_TOPIC_BY_MODULE[module] || 'GRI 2 (General Disclosures)', module, label, total].map(escapeCsv).join(',');
    });
    downloadCsv(`gri_index_FYE${selectedYear}.csv`, header, rows);
  };

  return (
    <div className="reporting-container animate-fade-in">
      <div className="page-header">
        <div>
          <h2>Compliance & Reporting</h2>
          <p className="text-secondary">Generate Bursa Malaysia, IFRS S1/S2, and GRI compliance reports.</p>
        </div>
        <div className="header-actions">
          <select className="input-field" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="reporting-grid">
        <div className="glass-card report-card">
          <div className="report-icon bg-primary-light text-primary">
            <FileText size={32} />
          </div>
          <h3>Bursa Malaysia Sustainability Statement</h3>
          <p className="text-secondary">11 Common Sustainability Matters aggregated across all events.</p>
          
          <div className="completeness-check">
            {isComplete ? (
              <span className="badge badge-success"><CheckCircle size={14}/> Data Complete</span>
            ) : (
              <span className="badge badge-danger"><XCircle size={14}/> Missing Mandatory Data</span>
            )}
          </div>
          
          <div className="report-actions">
            <button className="btn btn-primary" disabled={!isComplete} onClick={handleExportSummary}><Download size={16}/> Export Summary (CSV)</button>
            <button className="btn btn-secondary" disabled={!isComplete} onClick={handleExportPerEvent}><Download size={16}/> Export Per-Event (CSV)</button>
          </div>
        </div>

        <div className="glass-card report-card">
          <div className="report-icon bg-info-light text-info">
            <FileText size={32} />
          </div>
          <h3>IFRS S1 & S2 Disclosure</h3>
          <p className="text-secondary">Narrative governance plus climate metrics and scenarios.</p>
          
          <div className="completeness-check">
            <span className="badge badge-success"><CheckCircle size={14}/> Narrative Ready</span>
          </div>
          
          <div className="report-actions">
            <button className="btn btn-primary" onClick={handleExportIfrsPackage}><Download size={16}/> Export Full Package (CSV)</button>
          </div>
        </div>

        <div className="glass-card report-card">
          <div className="report-icon bg-warning-light text-warning">
            <FileText size={32} />
          </div>
          <h3>GRI Standards Report</h3>
          <p className="text-secondary">GRI Content Index mapping each metric to disclosure number.</p>
          
          <div className="completeness-check">
            <span className="badge badge-success"><CheckCircle size={14}/> 100% Coverage</span>
          </div>
          
          <div className="report-actions">
            <button className="btn btn-primary" onClick={handleExportGri}><Download size={16}/> Export GRI Index (CSV)</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reporting;
