import { useState, useEffect } from 'react';
import { getEventsFull, getCorporateGovernance, getSettings, saveSettings } from '../utils/db';
import { useReportingYear } from '../hooks/useReportingYear';
import { CheckCircle2, AlertCircle, Circle, Download } from 'lucide-react';
import './SDGDashboard.css';

/* ── Status constants ─────────────────────────────────────────────── */
const STATUS = { ACHIEVED: 'achieved', PARTIAL: 'partial', NOT_STARTED: 'not_started' };
const statusLabel = { achieved: 'Achieved', partial: 'In Progress', not_started: 'Not Started' };

/* ── Icons ────────────────────────────────────────────────────────── */
const AchievementIcon = ({ status }: { status: string }) => {
  if (status === STATUS.ACHIEVED) return <CheckCircle2 size={16} className="sdg-icon-achieved" />;
  if (status === STATUS.PARTIAL)  return <AlertCircle  size={16} className="sdg-icon-partial" />;
  return                                 <Circle       size={16} className="sdg-icon-none" />;
};

/* ── Progress bar ─────────────────────────────────────────────────── */
const ProgressBar = ({ pct, status }: { pct: number; status: string }) => {
  let color = 'var(--text-tertiary)';
  if (status === STATUS.ACHIEVED) color = 'var(--success)';
  else if (status === STATUS.PARTIAL) color = 'var(--warning)';

  return (
    <div className="sdg-progress-track">
      <div className="sdg-progress-fill" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
    </div>
  );
};

/* ── Pencil icon SVG ─────────────────────────────────────────────── */
const PencilIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

/* ════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════════════ */
const SDGDashboard = () => {
  const [events, setEvents]     = useState<any[]>([]);
  const [corp, setCorp]         = useState<any>({});
  const [settings, setSettings] = useState<any>({});
  const { selectedYear, setSelectedYear, availableYears } =
    useReportingYear(events.map((e: any) => e.reporting_year));

  /* Modal state */
  const [editSdg, setEditSdg]       = useState<any>(null);
  const [editFields, setEditFields]  = useState<any>({});
  const [saving, setSaving]          = useState(false);
  const [saveMsg, setSaveMsg]        = useState('');

  useEffect(() => {
    getEventsFull().then(setEvents);
    getSettings().then(setSettings);
  }, []);

  useEffect(() => {
    getCorporateGovernance(selectedYear).then(setCorp);
  }, [selectedYear]);

  /* ── Aggregate helpers ────────────────────────────────────────────── */
  const yearEvents  = events.filter((e: any) => e.reporting_year === selectedYear);
  const n           = yearEvents.length || 1;
  const sum         = (key: string) => yearEvents.reduce((a, c: any) => a + (Number(c[key]) || 0), 0);
  const avg         = (key: string) => sum(key) / n;

  /* ── Raw metrics ─────────────────────────────────────────────────── */
  const totalScope12      = sum('scope1_tco2e') + sum('scope2_lb_tco2e');
  const totalScope123     = totalScope12 + sum('scope3_tco2e');
  const totalEnergy       = sum('total_energy_mwh');
  const totalWater        = sum('total_water_m3');
  const totalWasteKg      = sum('waste_hazardous_kg') + sum('waste_nonhazardous_kg');
  const avgDivertedPct    = avg('waste_diverted_pct');
  const avgRenewablePct   = avg('renewable_energy_pct');
  const avgLtir           = avg('ltir');
  const totalFatalities   = sum('fatalities_count');
  const totalHrComplaints = sum('hr_complaints_count');
  const totalTraining     = sum('training_hours_total');
  const totalCommunity    = sum('community_invest_rm');
  const avgLocalSupplier  = avg('local_supplier_spend_pct');
  const privacyBreaches   = sum('data_breach_complaints');
  const boardTotal        = Number(corp.board_total) || 0;
  const boardFemalePct    = boardTotal > 0 ? (Number(corp.board_female) || 0) / boardTotal * 100 : 0;
  const hasBoardData      = boardTotal > 0;
  const corruptIncidents  = Number(corp.confirmed_corruption_incidents) || 0;
  const corruptTraining   = Number(corp.anticorrupt_training_coverage)  || 0;
  const hasGovOversight   = !!(corp.gov_committee_name || corp.gov_meeting_frequency);
  const hasClimateScenario = !!(corp.scenario_analysis_text);
  const hasExecAccount    = !!(corp.gov_executive_accountability_text);
  const hasErmIntegration = corp.risk_erm_integration_status === 'Fully Integrated';
  const climateMitigRm    = Number(corp.climate_capex_rm) || 0;
  const internalCarbonPx  = Number(corp.internal_carbon_price) || 0;
  const transitionRiskRm  = Number(corp.climate_transition_risk_rm) || 0;
  const hasClimateFinance = climateMitigRm > 0 || internalCarbonPx > 0 || transitionRiskRm > 0;

  /* ── Configurable thresholds (loaded from app_settings) ────────────
     Each key maps 1-to-1 to a field in the JSONB settings blob.
     Default values are the fallback when the user hasn't configured yet. */
  const isRequired = (val: any, defaultVal = 1) => {
    if (val === undefined || val === null) return defaultVal === 1;
    return Number(val) === 1;
  };

  const T = {
    ltir:            settings.ltir_threshold !== undefined && settings.ltir_threshold !== null ? Number(settings.ltir_threshold) : 0.5,
    fatalities:      settings.fatalities_threshold !== undefined && settings.fatalities_threshold !== null ? Number(settings.fatalities_threshold) : 0,
    renewable:       settings.renewable_target_pct !== undefined && settings.renewable_target_pct !== null ? Number(settings.renewable_target_pct) : 30,
    water:           settings.water_intensity_target_m3 !== undefined && settings.water_intensity_target_m3 !== null ? Number(settings.water_intensity_target_m3) : 200,
    boardFemale:     settings.board_female_target_pct !== undefined && settings.board_female_target_pct !== null ? Number(settings.board_female_target_pct) : 30,
    wasteDiv:        settings.waste_diversion_target_pct !== undefined && settings.waste_diversion_target_pct !== null ? Number(settings.waste_diversion_target_pct) : 50,
    corruptTrain:    settings.corrupt_training_target_pct !== undefined && settings.corrupt_training_target_pct !== null ? Number(settings.corrupt_training_target_pct) : 95,
    localSupplier:   settings.local_supplier_target_pct !== undefined && settings.local_supplier_target_pct !== null ? Number(settings.local_supplier_target_pct) : 50,
    communityInvest: settings.community_invest_target_rm !== undefined && settings.community_invest_target_rm !== null ? Number(settings.community_invest_target_rm) : 10000,
    scope12Target:   settings.scope12_target_tco2e !== undefined && settings.scope12_target_tco2e !== null ? Number(settings.scope12_target_tco2e) : 100,
    hrComplaints:    settings.hr_complaint_target !== undefined && settings.hr_complaint_target !== null ? Number(settings.hr_complaint_target) : 0,
    corruptionIncidents: settings.corruption_incident_threshold !== undefined && settings.corruption_incident_threshold !== null ? Number(settings.corruption_incident_threshold) : 0,
    privacyBreaches: settings.privacy_breach_threshold !== undefined && settings.privacy_breach_threshold !== null ? Number(settings.privacy_breach_threshold) : 0,
    climateScenarioRequired: isRequired(settings.climate_scenario_required, 1),
    climateFinanceRequired:  isRequired(settings.climate_finance_required, 1),
    govOversightRequired:    isRequired(settings.gov_oversight_required, 1),
    execAccountRequired:     isRequired(settings.exec_accountability_required, 1),
    ermIntegrationRequired:  isRequired(settings.erm_integration_required, 1),
  };

  const ltirOk = T.ltir > 0 ? avgLtir <= T.ltir : avgLtir === 0;

  /* ════════════════════════════════════════════════════════════════
     SDG DEFINITIONS — EVERY CARD HAS ITS OWN thresholdFields
  ════════════════════════════════════════════════════════════════ */
  const sdgs = [
    /* ─ SDG 3: Good Health & Well-being ─────────────────────────── */
    {
      num: 3, name: 'Good Health & Well-being', color: '#4C9F38',
      target: '3.9 Reduce deaths from pollution | 3.4 Decent work, safe environments',
      metric: ltirOk && totalFatalities <= T.fatalities
        ? `LTIR within threshold (≤${T.ltir}), Fatalities within threshold (≤${T.fatalities})`
        : `LTIR: ${avgLtir.toFixed(2)} (threshold ${T.ltir}) | Fatalities: ${totalFatalities} (threshold ${T.fatalities})`,
      status: totalFatalities <= T.fatalities && ltirOk
        ? STATUS.ACHIEVED
        : totalFatalities <= T.fatalities ? STATUS.PARTIAL : STATUS.NOT_STARTED,
      pct: totalFatalities <= T.fatalities ? (ltirOk ? 100 : 55) : 15,
      thresholdFields: [
        {
          key: 'ltir_threshold', label: 'Max LTIR Rate', type: 'number',
          unit: 'rate', min: 0, max: 10, step: 0.01, default: 0.5,
          hint: 'Maximum acceptable Lost-Time Injury Rate per 200,000 hrs worked. Events must average ≤ this to be Achieved.',
        },
        {
          key: 'fatalities_threshold', label: 'Max Fatalities Allowed', type: 'number',
          unit: 'count', min: 0, max: 10, step: 1, default: 0,
          hint: 'Maximum number of work-related fatalities tolerated for Achieved status.',
        },
      ],
    },

    /* ─ SDG 5: Gender Equality ───────────────────────────────────── */
    {
      num: 5, name: 'Gender Equality', color: '#FF3A21',
      target: '5.5 Women\'s participation & leadership | 5.1 End gender discrimination',
      metric: hasBoardData
        ? `${boardFemalePct.toFixed(1)}% female board (target ≥${T.boardFemale}%) | HR complaints: ${totalHrComplaints} (target ≤${T.hrComplaints})`
        : 'Board diversity not tracked',
      status: !hasBoardData ? STATUS.NOT_STARTED
        : boardFemalePct >= T.boardFemale && totalHrComplaints <= T.hrComplaints ? STATUS.ACHIEVED : STATUS.PARTIAL,
      pct: hasBoardData ? Math.min(100, Math.min(80, (boardFemalePct / T.boardFemale) * 80) + (totalHrComplaints <= T.hrComplaints ? 20 : 0)) : 0,
      thresholdFields: [
        {
          key: 'board_female_target_pct', label: 'Female Board Representation Target', type: 'number',
          unit: '%', min: 0, max: 100, step: 1, default: 30,
          hint: 'Minimum % of board seats held by women to qualify as Achieved.',
        },
        {
          key: 'hr_complaint_target', label: 'Max HR Complaints Allowed', type: 'number',
          unit: 'count', min: 0, max: 50, step: 1, default: 0,
          hint: 'Maximum total HR / human-rights complaints tolerated to qualify as Achieved.',
        },
      ],
    },

    /* ─ SDG 6: Clean Water & Sanitation ─────────────────────────── */
    {
      num: 6, name: 'Clean Water & Sanitation', color: '#26BDE2',
      target: '6.4 Increase water-use efficiency',
      metric: totalWater > 0
        ? `${totalWater.toLocaleString()} m³ tracked | Target: ≤${T.water.toLocaleString()} m³/event avg`
        : 'Water not tracked',
      status: totalWater > 0 && (totalWater / n) <= T.water
        ? STATUS.ACHIEVED
        : totalWater > 0 ? STATUS.PARTIAL : STATUS.NOT_STARTED,
      pct: totalWater > 0 ? Math.min(100, (1 - Math.max(0, (totalWater / n) - T.water) / T.water) * 100) : 0,
      thresholdFields: [
        {
          key: 'water_intensity_target_m3', label: 'Max Water Consumption per Event', type: 'number',
          unit: 'm³', min: 0, max: 10000, step: 10, default: 200,
          hint: 'Maximum acceptable average water consumption per event (m³). Avg ≤ this = Achieved.',
        },
      ],
    },

    /* ─ SDG 7: Affordable & Clean Energy ────────────────────────── */
    {
      num: 7, name: 'Affordable & Clean Energy', color: '#FCC30B',
      target: '7.2 Increase renewable energy share | 7.3 Improve energy efficiency',
      metric: totalEnergy > 0
        ? `${avgRenewablePct.toFixed(1)}% renewable (target ≥${T.renewable}%) | ${totalEnergy.toFixed(1)} MWh total`
        : 'Energy not tracked',
      status: avgRenewablePct >= T.renewable ? STATUS.ACHIEVED
        : totalEnergy > 0 ? STATUS.PARTIAL : STATUS.NOT_STARTED,
      pct: Math.min(100, totalEnergy > 0 ? (avgRenewablePct / T.renewable) * 100 : 0),
      thresholdFields: [
        {
          key: 'renewable_target_pct', label: 'Renewable Energy Mix Target', type: 'number',
          unit: '%', min: 0, max: 100, step: 1, default: 30,
          hint: 'Minimum average % of energy from renewable sources across all events in the year.',
        },
      ],
    },

    /* ─ SDG 8: Decent Work & Economic Growth ────────────────────── */
    {
      num: 8, name: 'Decent Work & Economic Growth', color: '#A21942',
      target: '8.5 Full & productive employment | 8.8 Safe working environments | 8.7 Ethical labour',
      metric: `Fatalities: ${totalFatalities} (target ≤${T.fatalities}) | HR complaints: ${totalHrComplaints} (target ≤${T.hrComplaints}) | Training: ${totalTraining.toLocaleString()} hrs | Local suppliers: ${avgLocalSupplier.toFixed(1)}% (target ≥${T.localSupplier}%)`,
      status: totalFatalities <= T.fatalities && totalHrComplaints <= T.hrComplaints && avgLocalSupplier >= T.localSupplier
        ? STATUS.ACHIEVED
        : totalFatalities <= T.fatalities ? STATUS.PARTIAL : STATUS.NOT_STARTED,
      pct: totalFatalities <= T.fatalities
        ? Math.min(100, (totalHrComplaints <= T.hrComplaints ? 40 : 20) + Math.min(60, (avgLocalSupplier / T.localSupplier) * 60))
        : 10,
      thresholdFields: [
        {
          key: 'local_supplier_target_pct', label: 'Local Supplier Spend Target', type: 'number',
          unit: '%', min: 0, max: 100, step: 1, default: 50,
          hint: 'Minimum % of procurement spend with local suppliers to count as Achieved.',
        },
        {
          key: 'hr_complaint_target', label: 'Max HR Complaints Allowed', type: 'number',
          unit: 'count', min: 0, max: 50, step: 1, default: 0,
          hint: 'Maximum total HR / human-rights complaints tolerated across all events.',
        },
        {
          key: 'fatalities_threshold', label: 'Max Fatalities Allowed', type: 'number',
          unit: 'count', min: 0, max: 10, step: 1, default: 0,
          hint: 'Maximum number of work-related fatalities tolerated for Achieved status.',
        },
      ],
    },

    /* ─ SDG 10: Reduced Inequalities ────────────────────────────── */
    {
      num: 10, name: 'Reduced Inequalities', color: '#DD1367',
      target: '10.3 Equal opportunity | 10.2 Social inclusion',
      metric: totalHrComplaints <= T.hrComplaints
        ? `Discrimination complaints ≤${T.hrComplaints} | ${hasBoardData ? `${boardFemalePct.toFixed(1)}% female board` : 'Board diversity not tracked'} | Community: RM ${totalCommunity.toLocaleString()}`
        : `${totalHrComplaints} HR complaint(s) (target ≤${T.hrComplaints})`,
      status: totalHrComplaints <= T.hrComplaints && hasBoardData && totalCommunity >= T.communityInvest
        ? STATUS.ACHIEVED
        : totalHrComplaints <= T.hrComplaints ? STATUS.PARTIAL : STATUS.NOT_STARTED,
      pct: totalHrComplaints <= T.hrComplaints
        ? Math.min(100, (hasBoardData ? 40 : 20) + Math.min(60, (totalCommunity / T.communityInvest) * 60))
        : 5,
      thresholdFields: [
        {
          key: 'community_invest_target_rm', label: 'Community Investment Target', type: 'number',
          unit: 'RM', min: 0, max: 1000000, step: 1000, default: 10000,
          hint: 'Minimum total community investment (RM) across events in the year to count as Achieved.',
        },
        {
          key: 'hr_complaint_target', label: 'Max HR Complaints Allowed', type: 'number',
          unit: 'count', min: 0, max: 50, step: 1, default: 0,
          hint: 'Maximum total discrimination/HR complaints tolerated to qualify as Achieved.',
        },
      ],
    },

    /* ─ SDG 11: Sustainable Cities ──────────────────────────────── */
    {
      num: 11, name: 'Sustainable Cities', color: '#FD6925',
      target: '11.6 Reduce per-capita environmental impact | 11.b Climate resilience',
      metric: totalWasteKg > 0
        ? `${(totalWasteKg/1000).toFixed(2)} t waste | ${avgDivertedPct.toFixed(1)}% diverted (target ≥${T.wasteDiv}%) | Community inv: RM ${totalCommunity.toLocaleString()}`
        : 'Waste not tracked',
      status: avgDivertedPct >= T.wasteDiv && (!T.climateScenarioRequired || hasClimateScenario)
        ? STATUS.ACHIEVED
        : totalWasteKg > 0 ? STATUS.PARTIAL : STATUS.NOT_STARTED,
      pct: totalWasteKg > 0 ? Math.min(100, Math.min(60, (avgDivertedPct / T.wasteDiv) * 60) + ((!T.climateScenarioRequired || hasClimateScenario) ? 40 : 0)) : 0,
      thresholdFields: [
        {
          key: 'waste_diversion_target_pct', label: 'Waste Diversion Rate Target', type: 'number',
          unit: '%', min: 0, max: 100, step: 1, default: 50,
          hint: 'Minimum % of waste diverted from landfill (recycled, composted, recovered) to count as Achieved.',
        },
        {
          key: 'climate_scenario_required', label: 'Climate Scenario Required', type: 'select',
          options: [
            { value: '1', label: 'Yes' },
            { value: '0', label: 'No' },
          ],
          default: 1,
          hint: 'Require Climate Scenario Analysis to be completed for Achieved status.',
        },
      ],
    },

    /* ─ SDG 12: Responsible Consumption ─────────────────────────── */
    {
      num: 12, name: 'Responsible Consumption', color: '#BF8B2E',
      target: '12.4 Responsible waste management | 12.5 Reduce waste | 12.6 Sustainability reporting',
      metric: avgDivertedPct > 0
        ? `${avgDivertedPct.toFixed(1)}% waste diversion (target ≥${T.wasteDiv}%) | ${totalWasteKg > 0 ? `${(totalWasteKg/1000).toFixed(2)} t tracked` : 'No waste data'}`
        : 'No waste data',
      status: avgDivertedPct >= T.wasteDiv ? STATUS.ACHIEVED
        : avgDivertedPct > 0 ? STATUS.PARTIAL : STATUS.NOT_STARTED,
      pct: Math.min(100, T.wasteDiv > 0 ? (avgDivertedPct / T.wasteDiv) * 100 : 0),
      thresholdFields: [
        {
          key: 'waste_diversion_target_pct', label: 'Waste Diversion Rate Target', type: 'number',
          unit: '%', min: 0, max: 100, step: 1, default: 50,
          hint: 'Shared with SDG 11. Minimum % of waste diverted from landfill to qualify as Achieved.',
        },
      ],
    },

    /* ─ SDG 13: Climate Action ───────────────────────────────────── */
    {
      num: 13, name: 'Climate Action', color: '#3F7E44',
      target: '13.2 Integrate climate measures into planning | 13.1 Strengthen climate resilience',
      metric: totalScope123 > 0
        ? `${totalScope123.toFixed(2)} tCO₂e (target ≤${T.scope12Target} tCO₂e Sc1+2) | Scenario: ${hasClimateScenario ? '✓' : '✗'} | Finance: ${hasClimateFinance ? '✓' : '✗'}`
        : 'Emissions not tracked',
      status: totalScope123 > 0 &&
        (!T.climateScenarioRequired || hasClimateScenario) &&
        (!T.climateFinanceRequired || hasClimateFinance) &&
        totalScope12 <= T.scope12Target
          ? STATUS.ACHIEVED
          : totalScope123 > 0 ? STATUS.PARTIAL : STATUS.NOT_STARTED,
      pct: totalScope123 > 0
        ? Math.min(100,
            (totalScope12 <= T.scope12Target ? 40 : Math.min(40, (T.scope12Target / totalScope12) * 40))
            + ((!T.climateScenarioRequired || hasClimateScenario) ? 30 : 0)
            + ((!T.climateFinanceRequired || hasClimateFinance) ? 30 : 0))
        : 0,
      thresholdFields: [
        {
          key: 'scope12_target_tco2e', label: 'Scope 1+2 Emissions Target', type: 'number',
          unit: 'tCO₂e', min: 0, max: 10000, step: 10, default: 100,
          hint: 'Maximum total Scope 1+2 GHG emissions (tCO₂e) across all events.',
        },
        {
          key: 'climate_scenario_required', label: 'Climate Scenario Required', type: 'select',
          options: [
            { value: '1', label: 'Yes' },
            { value: '0', label: 'No' },
          ],
          default: 1,
          hint: 'Require Climate Scenario Analysis to be completed for Achieved status.',
        },
        {
          key: 'climate_finance_required', label: 'Climate Finance Tracked Required', type: 'select',
          options: [
            { value: '1', label: 'Yes' },
            { value: '0', label: 'No' },
          ],
          default: 1,
          hint: 'Require Climate Opportunities / Capex / Internal Carbon Price tracking for Achieved status.',
        },
      ],
    },

    /* ─ SDG 16: Peace, Justice & Institutions ────────────────────── */
    {
      num: 16, name: 'Peace, Justice & Institutions', color: '#0A97D9',
      target: '16.5 Reduce corruption & bribery | 16.6 Transparent institutions | 16.10 Data privacy',
      metric: `Training: ${corruptTraining > 0 ? corruptTraining.toFixed(1) + '%' : 'N/A'} (target ≥${T.corruptTrain}%) | Incidents: ${corruptIncidents} (target ≤${T.corruptionIncidents}) | Breaches: ${privacyBreaches} (target ≤${T.privacyBreaches}) | ERM: ${corp.risk_erm_integration_status || 'N/A'}`,
      status:
        corruptIncidents <= T.corruptionIncidents &&
        privacyBreaches <= T.privacyBreaches &&
        corruptTraining >= T.corruptTrain &&
        (!T.govOversightRequired || hasGovOversight) &&
        (!T.execAccountRequired || hasExecAccount) &&
        (!T.ermIntegrationRequired || hasErmIntegration)
          ? STATUS.ACHIEVED
          : corruptIncidents <= T.corruptionIncidents && privacyBreaches <= T.privacyBreaches ? STATUS.PARTIAL : STATUS.NOT_STARTED,
      pct: corruptIncidents <= T.corruptionIncidents
        ? Math.min(100,
            (corruptTraining > 0 ? Math.min(corruptTraining, T.corruptTrain) / T.corruptTrain * 50 : 10)
            + (privacyBreaches <= T.privacyBreaches ? 15 : 0)
            + ((!T.govOversightRequired || hasGovOversight) ? 15 : 0)
            + ((!T.execAccountRequired || hasExecAccount) ? 10 : 0)
            + ((!T.ermIntegrationRequired || hasErmIntegration) ? 10 : 0))
        : 5,
      thresholdFields: [
        {
          key: 'corrupt_training_target_pct', label: 'Anti-Corruption Training Target', type: 'number',
          unit: '%', min: 0, max: 100, step: 1, default: 95,
          hint: 'Minimum anti-corruption training coverage % required across the organisation for Achieved status.',
        },
        {
          key: 'corruption_incident_threshold', label: 'Max Corruption Incidents Allowed', type: 'number',
          unit: 'incidents', min: 0, max: 10, step: 1, default: 0,
          hint: 'Maximum number of confirmed corruption incidents tolerated for Achieved status.',
        },
        {
          key: 'privacy_breach_threshold', label: 'Max Data Breaches Allowed', type: 'number',
          unit: 'breaches', min: 0, max: 10, step: 1, default: 0,
          hint: 'Maximum number of confirmed data privacy/security breaches tolerated for Achieved status.',
        },
        {
          key: 'gov_oversight_required', label: 'Board Governance Oversight Required', type: 'select',
          options: [
            { value: '1', label: 'Yes' },
            { value: '0', label: 'No' },
          ],
          default: 1,
          hint: 'Require active board-level ESG oversight meetings for Achieved status.',
        },
        {
          key: 'exec_accountability_required', label: 'Executive ESG Accountability Required', type: 'select',
          options: [
            { value: '1', label: 'Yes' },
            { value: '0', label: 'No' },
          ],
          default: 1,
          hint: 'Require executive accountability policies for ESG to be active for Achieved status.',
        },
        {
          key: 'erm_integration_required', label: 'ERM Integration Required', type: 'select',
          options: [
            { value: '1', label: 'Yes' },
            { value: '0', label: 'No' },
          ],
          default: 1,
          hint: 'Require ESG risks to be integrated into Enterprise Risk Management for Achieved status.',
        },
      ],
    },
  ];

  const achieved   = sdgs.filter(s => s.status === STATUS.ACHIEVED).length;
  const partial    = sdgs.filter(s => s.status === STATUS.PARTIAL).length;
  const notStarted = sdgs.filter(s => s.status === STATUS.NOT_STARTED).length;

  /* ── Export CSV ─────────────────────────────────────────────────── */
  const handleExportCsv = () => {
    const header = 'SDG,Name,Status,Progress (%),Metric,Target\n';
    const escape = (v: any) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = sdgs.map(s =>
      [s.num, s.name, statusLabel[s.status], s.pct.toFixed(0), s.metric, s.target]
        .map(escape).join(','));
    const csv = header + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sdg_impact_FYE${selectedYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /* ── Modal handlers ─────────────────────────────────────────────── */
  const openEdit = (sdg: any) => {
    const initial: any = {};
    sdg.thresholdFields.forEach((f: any) => {
      initial[f.key] = settings[f.key] !== undefined && settings[f.key] !== null
        ? settings[f.key]
        : f.default;
    });
    setEditFields(initial);
    setEditSdg(sdg);
    setSaveMsg('');
  };

  const closeEdit = () => { setEditSdg(null); setSaveMsg(''); };

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    const merged = { ...settings };
    Object.keys(editFields).forEach(k => {
      merged[k] = editFields[k] === '' ? null : Number(editFields[k]);
    });
    await saveSettings(merged);
    setSettings(merged);          // ← update local state so cards re-compute immediately
    setSaving(false);
    setSaveMsg('✓ Saved!');
    setTimeout(() => { setSaveMsg(''); closeEdit(); }, 900);
  };

  /* ═══════════════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════════════ */
  return (
    <div className="sdg-container animate-fade-in">

      {/* ── Page header ────────────────────────────────────────────── */}
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

      {/* ── Summary chips ──────────────────────────────────────────── */}
      <div className="sdg-summary-row">
        <div className="sdg-summary-chip chip-achieved"><CheckCircle2 size={15} /> {achieved} Achieved</div>
        <div className="sdg-summary-chip chip-partial"><AlertCircle size={15} /> {partial} In Progress</div>
        <div className="sdg-summary-chip chip-none"><Circle size={15} /> {notStarted} Not Started</div>
        <div className="sdg-summary-chip chip-total">{sdgs.length} SDGs tracked out of 17</div>
      </div>

      {/* ── SDG card grid ──────────────────────────────────────────── */}
      <div className="sdg-grid">
        {sdgs.map(sdg => (
          <div key={sdg.num} className={`glass-card sdg-card sdg-card-${sdg.status}`}>

            {/* Header band */}
            <div className="sdg-header">
              <span className="sdg-num">{sdg.num}</span>
              <div className="sdg-header-right">
                <span className="sdg-name">{sdg.name}</span>
              </div>
              {/* Edit button — every card has this */}
              <button
                className="sdg-edit-btn"
                onClick={() => openEdit(sdg)}
                title={`Configure SDG ${sdg.num} thresholds`}
                aria-label={`Configure thresholds for SDG ${sdg.num}`}
              >
                <PencilIcon />
              </button>
            </div>

            {/* Card body */}
            <div className="sdg-body">
              <div className="sdg-status-row">
                <AchievementIcon status={sdg.status} />
                <span className={`sdg-status-label status-${sdg.status}`}>
                  {statusLabel[sdg.status]}
                </span>
              </div>
              <ProgressBar pct={sdg.pct} status={sdg.status} />
              <span className="sdg-pct-label">{sdg.pct.toFixed(0)}% toward target</span>
              <p className="sdg-metric">{sdg.metric}</p>
              <p className="sdg-target">{sdg.target}</p>
            </div>

          </div>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════
          THRESHOLD EDIT MODAL
      ════════════════════════════════════════════════════════════ */}
      {editSdg && (
        <div className="sdg-modal-overlay" onClick={closeEdit}>
          <div className="sdg-modal" onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="sdg-modal-header">
              <div className="sdg-modal-title-row">
                <span className="sdg-modal-num">
                  {editSdg.num}
                </span>
                <div>
                  <div className="sdg-modal-title">{editSdg.name}</div>
                  <div className="sdg-modal-subtitle">Configure achievement thresholds</div>
                </div>
              </div>
              <button className="sdg-modal-close" onClick={closeEdit} aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Modal body — input fields */}
            <div className="sdg-modal-body">
              {editSdg.thresholdFields.map((field: any) => (
                <div key={field.key} className="sdg-modal-field">
                  <label className="sdg-modal-label" htmlFor={`sdg-field-${field.key}`}>
                    {field.label}
                    {field.unit && <span className="sdg-modal-unit"> ({field.unit})</span>}
                  </label>
                  <div className="sdg-modal-input-wrap">
                    {field.type === 'select' ? (
                      <select
                        id={`sdg-field-${field.key}`}
                        value={editFields[field.key] ?? field.default}
                        onChange={e => setEditFields((prev: any) => ({ ...prev, [field.key]: e.target.value }))}
                        className="input-field sdg-modal-input"
                      >
                        {field.options.map((opt: any) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={`sdg-field-${field.key}`}
                        type="number"
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={editFields[field.key] ?? field.default}
                        onChange={e => setEditFields((prev: any) => ({ ...prev, [field.key]: e.target.value }))}
                        className="input-field sdg-modal-input"
                        placeholder={`Default: ${field.default}`}
                      />
                    )}
                    {field.unit && <span className="sdg-modal-input-unit">{field.unit}</span>}
                  </div>
                  {field.hint && <p className="sdg-modal-hint">{field.hint}</p>}
                </div>
              ))}

              {/* "Currently stored" summary */}
              <div className="sdg-modal-current">
                <div className="sdg-modal-current-label">Currently stored in Supabase</div>
                {editSdg.thresholdFields.map((f: any) => (
                  <div key={f.key} className="sdg-modal-current-row">
                    <span>{f.label}:</span>
                    <strong>
                      {settings[f.key] !== undefined && settings[f.key] !== null
                        ? (f.type === 'select'
                            ? (f.options.find((o: any) => String(o.value) === String(settings[f.key]))?.label ?? settings[f.key])
                            : `${settings[f.key]} ${f.unit ?? ''}`)
                        : (f.type === 'select'
                            ? `default (${f.options.find((o: any) => String(o.value) === String(f.default))?.label ?? f.default})`
                            : <span className="sdg-modal-default">default ({f.default} {f.unit ?? ''})</span>)
                      }
                    </strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal footer */}
            <div className="sdg-modal-footer">
              {saveMsg && <span className="sdg-save-msg">{saveMsg}</span>}
              <button className="btn btn-secondary" onClick={closeEdit}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
                style={{ minWidth: 110 }}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default SDGDashboard;
