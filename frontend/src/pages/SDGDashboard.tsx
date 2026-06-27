import { useState, useEffect } from 'react';
import { getEventsFull, getCorporateGovernance } from '../utils/db';
import { useReportingYear } from '../hooks/useReportingYear';
import { CheckCircle2, AlertCircle, Circle, Download } from 'lucide-react';
import './SDGDashboard.css';

/* ── Achievement status helpers ──────────────────────────────────── */
const STATUS = { ACHIEVED: 'achieved', PARTIAL: 'partial', NOT_STARTED: 'not_started' };

const AchievementIcon = ({ status }) => {
  if (status === STATUS.ACHIEVED)    return <CheckCircle2 size={16} className="sdg-icon-achieved" />;
  if (status === STATUS.PARTIAL)     return <AlertCircle  size={16} className="sdg-icon-partial" />;
  return                                    <Circle       size={16} className="sdg-icon-none" />;
};

const statusLabel = { achieved: 'Achieved', partial: 'In Progress', not_started: 'Not Started' };

/* ── Progress bar ────────────────────────────────────────────────── */
const ProgressBar = ({ pct, color }) => (
  <div className="sdg-progress-track">
    <div className="sdg-progress-fill" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
  </div>
);

/* ═══════════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════════ */
const SDGDashboard = () => {
  const [events, setEvents]   = useState([]);
  const [corp, setCorp]       = useState<any>({});
  const { selectedYear, setSelectedYear, availableYears } = useReportingYear(events);

  useEffect(() => {
    getEventsFull().then(setEvents);
    getCorporateGovernance().then(setCorp);
  }, []);

  const yearEvents = events.filter(e => e.reporting_year === selectedYear);
  const n  = yearEvents.length || 1;
  const sum = (key) => yearEvents.reduce((a, c) => a + (Number(c[key]) || 0), 0);
  const avg = (key) => sum(key) / n;

  /* ── Aggregated metrics ─────────────────────────────────────────── */
  const totalScope12    = sum('scope1_tco2e') + sum('scope2_lb_tco2e');
  const totalScope123   = totalScope12 + sum('scope3_tco2e');
  const totalEnergy     = sum('total_energy_mwh');
  const totalWater      = sum('total_water_m3');
  const totalWasteKg    = sum('waste_hazardous_kg') + sum('waste_nonhazardous_kg');
  const avgDivertedPct  = avg('waste_diverted_pct');
  const avgRenewablePct = avg('renewable_energy_pct');
  const avgLtir         = avg('ltir');
  const totalFatalities = sum('fatalities_count');
  const totalHrComplaints = sum('hr_complaints_count');
  const totalTraining   = sum('training_hours_total');
  const totalCommunity  = sum('community_invest_rm');
  const avgLocalSupplier = avg('local_supplier_spend_pct');
  const privacyBreaches = sum('data_breach_complaints');
  // Board gender representation, from the org-level HR & Diversity module
  // (edited on the Dashboard's "Enterprise HR & Diversity" tab). The events_flat
  // view's crew_female_count/crew_male_count columns are unwired placeholders
  // (hardcoded to 0 in the view) — using them here always read as "untracked".
  const boardFemalePct  = Number(corp.board_female_pct) || 0;
  const hasBoardDiversityData = corp.board_female_pct != null;
  const corruptIncidents = Number(corp.confirmed_corruption_incidents) || 0;
  const corruptTraining  = Number(corp.anticorrupt_training_coverage)  || 0;
  const hasGovOversight  = !!(corp.gov_committee_name || corp.gov_meeting_frequency);
  const hasClimateScenario = !!(corp.scenario_analysis_text);

  /* ── SDG definitions with achievement logic ─────────────────────── */
  const sdgs = [
    {
      num: 3, name: 'Good Health & Well-being',
      color: '#4C9F38',
      target: '3.9 Reduce deaths from pollution | 3.4 Decent work, safe environments',
      metric: avgLtir === 0 && totalFatalities === 0
        ? 'LTIR = 0, Zero fatalities'
        : `LTIR: ${avgLtir.toFixed(2)} | Fatalities: ${totalFatalities}`,
      module: 'Module B',
      status: totalFatalities === 0 && avgLtir === 0
        ? STATUS.ACHIEVED
        : totalFatalities === 0 ? STATUS.PARTIAL : STATUS.NOT_STARTED,
      pct: totalFatalities === 0 ? (avgLtir === 0 ? 100 : 60) : 20,
    },
    {
      num: 5, name: 'Gender Equality',
      color: '#FF3A21',
      target: '5.5 Women\'s participation & leadership | 5.1 End gender discrimination',
      metric: hasBoardDiversityData ? `${boardFemalePct.toFixed(1)}% female board representation` : 'Board diversity not tracked',
      module: 'Module B + E',
      status: !hasBoardDiversityData
        ? STATUS.NOT_STARTED
        : (boardFemalePct >= 30 && totalHrComplaints === 0) ? STATUS.ACHIEVED : STATUS.PARTIAL,
      pct: hasBoardDiversityData ? Math.min(100, (boardFemalePct / 30) * 100) : 0,
    },
    {
      num: 6, name: 'Clean Water & Sanitation',
      color: '#26BDE2',
      target: '6.4 Increase water-use efficiency',
      metric: totalWater > 0 ? `${totalWater.toLocaleString()} m³ tracked` : 'Water not tracked',
      module: 'Module A',
      status: totalWater > 0 ? STATUS.ACHIEVED : STATUS.NOT_STARTED,
      pct: totalWater > 0 ? 100 : 0,
    },
    {
      num: 7, name: 'Affordable & Clean Energy',
      color: '#FCC30B',
      target: '7.2 Increase renewable energy share | 7.3 Improve energy efficiency',
      metric: totalEnergy > 0
        ? `${avgRenewablePct.toFixed(1)}% renewable, ${totalEnergy.toFixed(1)} MWh total`
        : 'Energy not tracked',
      module: 'Module A',
      status: avgRenewablePct >= 30
        ? STATUS.ACHIEVED
        : totalEnergy > 0 ? STATUS.PARTIAL : STATUS.NOT_STARTED,
      pct: Math.min(100, avgRenewablePct > 0 ? (avgRenewablePct / 30) * 100 : totalEnergy > 0 ? 20 : 0),
    },
    {
      num: 8, name: 'Decent Work & Economic Growth',
      color: '#A21942',
      target: '8.5 Full & productive employment | 8.8 Safe working environments | 8.7 Ethical labour',
      metric: `Fatalities: ${totalFatalities} | HR complaints: ${totalHrComplaints} | Training: ${totalTraining.toLocaleString()} hrs | Local suppliers: ${avgLocalSupplier.toFixed(1)}%`,
      module: 'Module B',
      status: totalFatalities === 0 && totalHrComplaints === 0
        ? STATUS.ACHIEVED
        : totalFatalities === 0 ? STATUS.PARTIAL : STATUS.NOT_STARTED,
      pct: totalFatalities === 0 ? (totalHrComplaints === 0 ? 100 : 65) : 10,
    },
    {
      num: 10, name: 'Reduced Inequalities',
      color: '#DD1367',
      target: '10.3 Equal opportunity | 10.2 Social inclusion',
      metric: totalHrComplaints === 0
        ? `Zero discrimination complaints | ${hasBoardDiversityData ? `${boardFemalePct.toFixed(1)}% female board` : 'Diversity tracked'}`
        : `${totalHrComplaints} HR complaint(s)`,
      module: 'Module B + C',
      status: totalHrComplaints === 0 && hasBoardDiversityData
        ? STATUS.ACHIEVED
        : totalHrComplaints === 0 ? STATUS.PARTIAL : STATUS.NOT_STARTED,
      pct: totalHrComplaints === 0 ? (hasBoardDiversityData ? 100 : 50) : 10,
    },
    {
      num: 11, name: 'Sustainable Cities',
      color: '#FD6925',
      target: '11.6 Reduce per-capita environmental impact | 11.b Climate resilience',
      metric: totalWasteKg > 0
        ? `${(totalWasteKg/1000).toFixed(2)} t waste | ${avgDivertedPct.toFixed(1)}% diverted | Community inv: RM ${totalCommunity.toLocaleString()}`
        : 'Waste not tracked',
      module: 'Module A + D',
      status: avgDivertedPct >= 50 && hasClimateScenario
        ? STATUS.ACHIEVED
        : totalWasteKg > 0 ? STATUS.PARTIAL : STATUS.NOT_STARTED,
      pct: totalWasteKg > 0 ? Math.min(100, avgDivertedPct * 2) : 0,
    },
    {
      num: 12, name: 'Responsible Consumption',
      color: '#BF8B2E',
      target: '12.4 Responsible waste management | 12.5 Reduce waste | 12.6 Sustainability reporting',
      metric: avgDivertedPct > 0
        ? `${avgDivertedPct.toFixed(1)}% waste diversion | ${totalWasteKg > 0 ? 'Waste tracked' : 'No waste data'}`
        : 'No waste data',
      module: 'Module A + F',
      status: avgDivertedPct >= 50
        ? STATUS.ACHIEVED
        : avgDivertedPct > 0 ? STATUS.PARTIAL : STATUS.NOT_STARTED,
      pct: Math.min(100, avgDivertedPct * 2),
    },
    {
      num: 13, name: 'Climate Action',
      color: '#3F7E44',
      target: '13.2 Integrate climate measures into planning | 13.1 Strengthen climate resilience',
      metric: totalScope123 > 0
        ? `${totalScope123.toFixed(2)} tCO₂e total | ${hasClimateScenario ? 'Scenario analysis done' : 'Scenario analysis missing'}`
        : 'Emissions not tracked',
      module: 'Module A + D + F',
      status: totalScope123 > 0 && hasClimateScenario
        ? STATUS.ACHIEVED
        : totalScope123 > 0 ? STATUS.PARTIAL : STATUS.NOT_STARTED,
      pct: totalScope123 > 0 ? (hasClimateScenario ? 100 : 55) : 0,
    },
    {
      num: 16, name: 'Peace, Justice & Institutions',
      color: '#0A97D9',
      target: '16.5 Reduce corruption & bribery | 16.6 Transparent institutions | 16.10 Data privacy',
      metric: `Corruption training: ${corruptTraining > 0 ? corruptTraining.toFixed(1) + '%' : 'Not tracked'} | Incidents: ${corruptIncidents} | Privacy breaches: ${privacyBreaches}`,
      module: 'Module C + D + E',
      status: corruptIncidents === 0 && privacyBreaches === 0 && corruptTraining >= 95 && hasGovOversight
        ? STATUS.ACHIEVED
        : corruptIncidents === 0 && privacyBreaches === 0 ? STATUS.PARTIAL : STATUS.NOT_STARTED,
      pct: corruptIncidents === 0 ? Math.min(100, (corruptTraining > 0 ? corruptTraining : 30) + (privacyBreaches === 0 ? 20 : 0) + (hasGovOversight ? 20 : 0)) : 5,
    },
  ];

  const achieved  = sdgs.filter(s => s.status === STATUS.ACHIEVED).length;
  const partial   = sdgs.filter(s => s.status === STATUS.PARTIAL).length;
  const notStarted = sdgs.filter(s => s.status === STATUS.NOT_STARTED).length;

  const handleExportCsv = () => {
    const header = 'SDG,Name,Status,Progress (%),Metric,Target\n';
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = sdgs.map(s => [
      s.num, s.name, statusLabel[s.status], s.pct.toFixed(0), s.metric, s.target,
    ].map(escape).join(','));

    const csv = header + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sdg_impact_FYE${selectedYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <div className="sdg-container animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2>UN SDG Impact Dashboard</h2>
          <p className="text-secondary">
            System-driven SDG alignment based on your reported metrics across {yearEvents.length} events.
          </p>
        </div>
        <div className="header-actions">
          <select className="input-field" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
            {availableYears.map(y => <option key={y} value={y}>{`FYE ${y}`}</option>)}
          </select>
          <button className="btn btn-primary" onClick={handleExportCsv}>
            <Download size={18} /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="sdg-summary-row">
        <div className="sdg-summary-chip chip-achieved">
          <CheckCircle2 size={15} /> {achieved} Achieved
        </div>
        <div className="sdg-summary-chip chip-partial">
          <AlertCircle size={15} /> {partial} In Progress
        </div>
        <div className="sdg-summary-chip chip-none">
          <Circle size={15} /> {notStarted} Not Started
        </div>
        <div className="sdg-summary-chip chip-total">
          {sdgs.length} SDGs tracked out of 17
        </div>
      </div>

      {/* SDG cards grid */}
      <div className="sdg-grid">
        {sdgs.map(sdg => (
          <div key={sdg.num} className={`glass-card sdg-card sdg-card-${sdg.status}`}>
            {/* Colour header */}
            <div className="sdg-header" style={{ backgroundColor: sdg.color }}>
              <span className="sdg-num">{sdg.num}</span>
              <div className="sdg-header-right">
                <span className="sdg-name">{sdg.name}</span>
                <span className="sdg-module-tag">{sdg.module}</span>
              </div>
            </div>

            {/* Body */}
            <div className="sdg-body">
              {/* Status badge */}
              <div className="sdg-status-row">
                <AchievementIcon status={sdg.status} />
                <span className={`sdg-status-label status-${sdg.status}`}>
                  {statusLabel[sdg.status]}
                </span>
              </div>

              {/* Progress bar */}
              <ProgressBar pct={sdg.pct} color={sdg.color} />
              <span className="sdg-pct-label">{sdg.pct.toFixed(0)}% toward target</span>

              {/* Metric value */}
              <p className="sdg-metric">{sdg.metric}</p>

              {/* Target description */}
              <p className="sdg-target">{sdg.target}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SDGDashboard;
