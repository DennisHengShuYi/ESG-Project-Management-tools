import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getEventsFull, getCorporateGovernance, getSettings, saveSettings } from '../utils/db';
import { useReportingYear } from '../hooks/useReportingYear';
import { CheckCircle2, AlertCircle, Circle, Download, ListChecks, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './SDGDashboard.css';

/* ── Status constants ─────────────────────────────────────────────── */
const STATUS = { ACHIEVED: 'achieved', PARTIAL: 'partial', NOT_STARTED: 'not_started' };
const statusLabel = { achieved: 'Achieved', partial: 'In Progress', not_started: 'Not Started' };

/* ── Full UN SDG catalog ──────────────────────────────────────────────
   Used to let the org add/remove goals from tracking. Only the goals below
   in DEFAULT_TRACKED ship with real computed metrics/thresholds; any other
   goal added from this catalog renders as a placeholder card until its
   data source is wired up. */
const SDG_CATALOG = [
  { num: 1,  name: 'No Poverty', color: '#E5243B', target: '1.4 Equal rights to economic resources | 1.5 Build resilience to shocks' },
  { num: 2,  name: 'Zero Hunger', color: '#DDA63A', target: '2.1 End hunger, ensure food access | 2.4 Sustainable food production' },
  { num: 4,  name: 'Quality Education', color: '#C5192D', target: '4.4 Relevant skills for employment | 4.7 Education for sustainable development' },
  { num: 9,  name: 'Industry, Innovation & Infrastructure', color: '#FD6925', target: '9.4 Upgrade infrastructure for sustainability | 9.5 Enhance research & innovation' },
  { num: 14, name: 'Life Below Water', color: '#0A97D9', target: '14.1 Reduce marine pollution | 14.2 Protect marine ecosystems' },
  { num: 15, name: 'Life on Land', color: '#56C02B', target: '15.2 Sustainable forest management | 15.5 Halt biodiversity loss' },
  { num: 17, name: 'Partnerships for the Goals', color: '#19486A', target: '17.16 Global partnerships | 17.17 Effective public-private partnerships' },
];

const DEFAULT_TRACKED = [3, 5, 6, 7, 8, 10, 11, 12, 13, 16];

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
  const { canRead, canWrite } = useAuth();
  const canWriteSdg = canWrite('sdg');
  const canReadEvents = canRead('events');
  const canReadCorp = ['governance', 'hr-diversity', 'climate-finance'].some(m => canRead(m));
  const canReadSdg = canRead('sdg');

  /* Modal state */
  const [editSdg, setEditSdg]       = useState<any>(null);
  const [editFields, setEditFields]  = useState<any>({});
  const [saving, setSaving]          = useState(false);
  const [saveMsg, setSaveMsg]        = useState('');

  /* Tracked-goals management (add/remove which SDGs appear on the board).
     Kept per reporting year — each year gets its own selection, stored under
     settings.tracked_sdgs_by_year[year]. Falls back to the legacy flat
     settings.tracked_sdgs (pre-per-year), then to the built-in default. */
  const [manageOpen, setManageOpen] = useState(false);

  const trackedNums: number[] = (() => {
    const byYear = settings.tracked_sdgs_by_year?.[selectedYear];
    if (Array.isArray(byYear) && byYear.length > 0) return byYear;
    if (Array.isArray(settings.tracked_sdgs) && settings.tracked_sdgs.length > 0) return settings.tracked_sdgs;
    return DEFAULT_TRACKED;
  })();

  useEffect(() => {
    // Skip requests entirely without read access — they'd just 403.
    if (canReadEvents) getEventsFull().then(setEvents);
    if (canReadSdg) getSettings().then(setSettings);
  }, [canReadEvents, canReadSdg]);

  useEffect(() => {
    if (canReadCorp) getCorporateGovernance(selectedYear).then(setCorp);
  }, [selectedYear, canReadCorp]);

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
    ltir:                    settings.ltir_threshold !== undefined && settings.ltir_threshold !== null ? Number(settings.ltir_threshold) : 0.5,
    fatalities:              settings.fatalities_threshold !== undefined && settings.fatalities_threshold !== null ? Number(settings.fatalities_threshold) : 0,
    renewable:               settings.renewable_target_pct !== undefined && settings.renewable_target_pct !== null ? Number(settings.renewable_target_pct) : 30,
    water:                   settings.water_intensity_target_m3 !== undefined && settings.water_intensity_target_m3 !== null ? Number(settings.water_intensity_target_m3) : 200,
    boardFemale:             settings.board_female_target_pct !== undefined && settings.board_female_target_pct !== null ? Number(settings.board_female_target_pct) : 30,
    wasteDiv:                settings.waste_diversion_target_pct !== undefined && settings.waste_diversion_target_pct !== null ? Number(settings.waste_diversion_target_pct) : 50,
    corruptTrain:            settings.corrupt_training_target_pct !== undefined && settings.corrupt_training_target_pct !== null ? Number(settings.corrupt_training_target_pct) : 95,
    localSupplier:           settings.local_supplier_target_pct !== undefined && settings.local_supplier_target_pct !== null ? Number(settings.local_supplier_target_pct) : 50,
    communityInvest:         settings.community_invest_target_rm !== undefined && settings.community_invest_target_rm !== null ? Number(settings.community_invest_target_rm) : 10000,
    scope12Target:           settings.scope12_target_tco2e !== undefined && settings.scope12_target_tco2e !== null ? Number(settings.scope12_target_tco2e) : 100,
    hrComplaints:            settings.hr_complaint_target !== undefined && settings.hr_complaint_target !== null ? Number(settings.hr_complaint_target) : 0,
    corruptionIncidents:     settings.corruption_incident_threshold !== undefined && settings.corruption_incident_threshold !== null ? Number(settings.corruption_incident_threshold) : 0,
    privacyBreaches:         settings.privacy_breach_threshold !== undefined && settings.privacy_breach_threshold !== null ? Number(settings.privacy_breach_threshold) : 0,

    // New parameters from the PDF triggers
    wasteHazardousLimit:     settings.waste_hazardous_limit_kg !== undefined && settings.waste_hazardous_limit_kg !== null ? Number(settings.waste_hazardous_limit_kg) : 500,
    contractorLimit:         settings.contractor_ratio_threshold !== undefined && settings.contractor_ratio_threshold !== null ? Number(settings.contractor_ratio_threshold) : 30,
    turnoverLimit:           settings.employee_turnover_threshold !== undefined && settings.employee_turnover_threshold !== null ? Number(settings.employee_turnover_threshold) : 5,
    beneficiariesTarget:     settings.community_beneficiaries_target !== undefined && settings.community_beneficiaries_target !== null ? Number(settings.community_beneficiaries_target) : 1000,
    corruptAssess:           settings.corruption_risk_assessment_target_pct !== undefined && settings.corruption_risk_assessment_target_pct !== null ? Number(settings.corruption_risk_assessment_target_pct) : 95,

    climateScenarioRequired: isRequired(settings.climate_scenario_required, 1),
    climateFinanceRequired:  isRequired(settings.climate_finance_required, 1),
    govOversightRequired:    isRequired(settings.gov_oversight_required, 1),
    execAccountRequired:     isRequired(settings.exec_accountability_required, 1),
    ermIntegrationRequired:  isRequired(settings.erm_integration_required, 1),
    physicalRiskRequired:    isRequired(settings.physical_risk_required, 1),
  };

  /* ── Prior year comparisons ───────────────────────────────────────── */
  const priorYear = String(Number(selectedYear) - 1);
  const priorYearEvents = events.filter((e: any) => e.reporting_year === priorYear);
  const priorN = priorYearEvents.length || 1;
  const priorSum = (key: string) => priorYearEvents.reduce((a, c: any) => a + (Number(c[key]) || 0), 0);
  const priorAvg = (key: string) => priorSum(key) / priorN;

  const priorWater = priorSum('total_water_m3');
  const priorEnergy = priorSum('total_energy_mwh');
  const priorRenewablePct = priorAvg('renewable_energy_pct');
  const priorLtir = priorAvg('ltir');

  /* ════════════════════════════════════════════════════════════════
     SDG DEFINITIONS — EVERY CARD HAS ITS OWN thresholdFields
  ════════════════════════════════════════════════════════════════ */
  const sdgs = [
    /* ─ SDG 3: Good Health & Well-being ─────────────────────────── */
    {
      num: 3, name: 'Good Health & Well-being', color: '#4C9F38',
      target: '3.9 Reduce deaths from pollution | 3.4 Decent work, safe environments',
      metric: `Hazardous Waste: ${sum('waste_hazardous_kg').toFixed(1)} kg (threshold ≤${T.wasteHazardousLimit} kg)`,
      status: n > 0 && sum('waste_hazardous_kg') <= T.wasteHazardousLimit && sum('waste_hazardous_kg') >= 0
        ? STATUS.ACHIEVED
        : sum('waste_hazardous_kg') >= 0 ? STATUS.PARTIAL : STATUS.NOT_STARTED,
      pct: Math.round(((sum('waste_hazardous_kg') <= T.wasteHazardousLimit ? 1 : 0) + (sum('waste_hazardous_kg') >= 0 ? 1 : 0)) / 2 * 100),
      thresholdFields: [
        {
          key: 'waste_hazardous_limit_kg', label: 'Max Hazardous Waste Allowed', type: 'number',
          unit: 'kg', min: 0, max: 10000, step: 10, default: 500,
          hint: 'Maximum total hazardous waste (kg) allowed across events to count as Achieved.',
        },
      ],
    },

    /* ─ SDG 5: Gender Equality ───────────────────────────────────── */
    {
      num: 5, name: 'Gender Equality', color: '#FF3A21',
      target: '5.5 Women\'s participation & leadership | 5.1 End gender discrimination',
      metric: `Board Female: ${boardFemalePct.toFixed(1)}% (target ≥${T.boardFemale}%) | Employee Diversity Profile: ${corp.emp_total > 0 ? 'Tracked' : 'No'} | Complaints: ${totalHrComplaints} (target ≤${T.hrComplaints})`,
      status: boardFemalePct >= T.boardFemale && corp.emp_total > 0 && totalHrComplaints <= T.hrComplaints
        ? STATUS.ACHIEVED
        : boardFemalePct > 0 || corp.emp_total > 0 ? STATUS.PARTIAL : STATUS.NOT_STARTED,
      pct: Math.round(((boardFemalePct >= T.boardFemale ? 1 : 0) + (corp.emp_total > 0 ? 1 : 0) + (totalHrComplaints <= T.hrComplaints ? 1 : 0)) / 3 * 100),
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
      metric: `Avg Water: ${(totalWater/n).toFixed(0)} m³ (target ≤${T.water} m³) | YoY Trend: ${priorWater > 0 ? (totalWater <= priorWater ? 'Declined/Stable' : 'Increased') : 'No baseline'}`,
      status: totalWater > 0 && (totalWater / n) <= T.water && (priorWater > 0 ? totalWater <= priorWater : true)
        ? STATUS.ACHIEVED
        : totalWater > 0 ? STATUS.PARTIAL : STATUS.NOT_STARTED,
      pct: Math.round(((totalWater > 0 ? 1 : 0) + ((priorWater > 0 ? totalWater <= priorWater : true) ? 1 : 0) + ((totalWater / n) <= T.water ? 1 : 0)) / 3 * 100),
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
      metric: `Renewable: ${avgRenewablePct.toFixed(1)}% (target ≥${T.renewable}%) | YoY Energy Trend: ${priorEnergy > 0 ? (totalEnergy <= priorEnergy ? 'Declined/Stable' : 'Increased') : 'No baseline'}`,
      status: totalEnergy > 0 && avgRenewablePct >= T.renewable && (priorRenewablePct > 0 ? avgRenewablePct >= priorRenewablePct : true) && (priorEnergy > 0 ? totalEnergy <= priorEnergy : true)
        ? STATUS.ACHIEVED
        : totalEnergy > 0 ? STATUS.PARTIAL : STATUS.NOT_STARTED,
      pct: Math.round(((totalEnergy > 0 ? 1 : 0) + (avgRenewablePct >= T.renewable ? 1 : 0) + ((priorRenewablePct > 0 ? avgRenewablePct >= priorRenewablePct : true) ? 1 : 0) + ((priorEnergy > 0 ? totalEnergy <= priorEnergy : true) ? 1 : 0)) / 4 * 100),
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
      metric: `Fatalities: ${totalFatalities} | LTIR: ${avgLtir.toFixed(2)} | Contractor: ${avg('contractor_pct').toFixed(1)}% (≤${T.contractorLimit}%) | Turnover: ${avg('turnover_count').toFixed(1)} (≤${T.turnoverLimit}) | Local Spend: ${avgLocalSupplier.toFixed(1)}% (≥${T.localSupplier}%)`,
      status: totalFatalities === 0 && (avgLtir === 0 || (priorLtir > 0 && avgLtir <= priorLtir)) && totalHrComplaints <= T.hrComplaints && avgLocalSupplier >= T.localSupplier && avg('contractor_pct') <= T.contractorLimit && avg('turnover_count') <= T.turnoverLimit
        ? STATUS.ACHIEVED
        : totalFatalities === 0 ? STATUS.PARTIAL : STATUS.NOT_STARTED,
      pct: Math.round(((totalFatalities === 0 ? 1 : 0) + ((avgLtir === 0 || (priorLtir > 0 && avgLtir <= priorLtir)) ? 1 : 0) + (totalHrComplaints <= T.hrComplaints ? 1 : 0) + (avgLocalSupplier >= T.localSupplier ? 1 : 0) + (avg('contractor_pct') <= T.contractorLimit ? 1 : 0) + (avg('turnover_count') <= T.turnoverLimit ? 1 : 0)) / 6 * 100),
      thresholdFields: [
        {
          key: 'local_supplier_target_pct', label: 'Local Supplier Spend Target', type: 'number',
          unit: '%', min: 0, max: 100, step: 1, default: 50,
          hint: 'Minimum % of procurement spend with local suppliers to count as Achieved.',
        },
        {
          key: 'contractor_ratio_threshold', label: 'Max Contractor Ratio Allowed', type: 'number',
          unit: '%', min: 0, max: 100, step: 1, default: 30,
          hint: 'Maximum allowed proportion of contract/temporary workers.',
        },
        {
          key: 'employee_turnover_threshold', label: 'Max Employee Turnover Allowed', type: 'number',
          unit: 'count', min: 0, max: 50, step: 1, default: 5,
          hint: 'Maximum allowed average employee turnover count per event.',
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
      metric: `Complaints: ${totalHrComplaints} (≤${T.hrComplaints}) | Diversity Profile: ${corp.emp_total > 0 ? 'Tracked' : 'No'} | Beneficiaries: ${sum('community_beneficiaries')} (target ≥${T.beneficiariesTarget})`,
      status: totalHrComplaints <= T.hrComplaints && corp.emp_total > 0 && sum('community_beneficiaries') >= T.beneficiariesTarget
        ? STATUS.ACHIEVED
        : totalHrComplaints <= T.hrComplaints || corp.emp_total > 0 ? STATUS.PARTIAL : STATUS.NOT_STARTED,
      pct: Math.round(((totalHrComplaints <= T.hrComplaints ? 1 : 0) + ((corp.emp_total > 0 && corp.emp_under30_pct != null) ? 1 : 0) + (sum('community_beneficiaries') >= T.beneficiariesTarget ? 1 : 0)) / 3 * 100),
      thresholdFields: [
        {
          key: 'community_beneficiaries_target', label: 'Community Beneficiaries Target', type: 'number',
          unit: 'people', min: 0, max: 100000, step: 10, default: 1000,
          hint: 'Minimum total community beneficiaries reached to count as Achieved.',
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
      target: '11.6 Reduce environmental impact | 11.b Climate resilience',
      metric: [
        `Waste Diversion: ${avgDivertedPct.toFixed(1)}% (target ≥${T.wasteDiv}%)`,
        T.climateScenarioRequired ? `Scenario: ${hasClimateScenario ? '✓' : '✗'}` : null,
        T.physicalRiskRequired ? `Physical Risk Exposure: ${Number(corp.climate_physical_risk_rm) > 0 ? 'Quantified' : 'No'}` : null
      ].filter(Boolean).join(' | '),
      status: avgDivertedPct >= T.wasteDiv && sum('waste_hazardous_kg') >= 0 && sum('waste_nonhazardous_kg') >= 0 && (!T.climateScenarioRequired || hasClimateScenario) && (!T.physicalRiskRequired || (Number(corp.climate_physical_risk_rm) > 0 && Number(corp.climate_chronic_risk_rm) > 0))
        ? STATUS.ACHIEVED
        : avgDivertedPct > 0 ? STATUS.PARTIAL : STATUS.NOT_STARTED,
      pct: Math.round(((sum('waste_hazardous_kg') >= 0 ? 1 : 0) + (sum('waste_nonhazardous_kg') >= 0 ? 1 : 0) + (avgDivertedPct >= T.wasteDiv ? 1 : 0) + ((!T.climateScenarioRequired || hasClimateScenario) ? 1 : 0) + ((!T.physicalRiskRequired || (Number(corp.climate_physical_risk_rm) > 0 && Number(corp.climate_chronic_risk_rm) > 0)) ? 1 : 0)) / 5 * 100),
      thresholdFields: [
        {
          key: 'waste_diversion_target_pct', label: 'Waste Diversion Rate Target', type: 'number',
          unit: '%', min: 0, max: 100, step: 1, default: 50,
          hint: 'Minimum % of waste diverted from landfill to count as Achieved.',
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
          key: 'physical_risk_required', label: 'Physical Risk Quantified Required', type: 'select',
          options: [
            { value: '1', label: 'Yes' },
            { value: '0', label: 'No' },
          ],
          default: 1,
          hint: 'Require financial physical risk exposure to be quantified in RM terms for Achieved status.',
        },
      ],
    },

    /* ─ SDG 12: Responsible Consumption ─────────────────────────── */
    {
      num: 12, name: 'Responsible Consumption', color: '#BF8B2E',
      target: '12.4 Waste management | 12.5 Reduce waste | 12.6 Sustainability reporting',
      metric: `Waste Diversion: ${avgDivertedPct.toFixed(1)}% (target ≥${T.wasteDiv}%) | Rolling 3-Yr Data: ${availableYears.length >= 3 ? 'Yes' : 'No'} | Energy/Water YoY: ${((priorEnergy > 0 ? totalEnergy <= priorEnergy : true) && (priorWater > 0 ? totalWater <= priorWater : true)) ? 'Improved/Stable' : 'No improvement'}`,
      status: avgDivertedPct >= T.wasteDiv && sum('waste_hazardous_kg') >= 0 && sum('waste_nonhazardous_kg') >= 0 && (availableYears.length >= 3) && (priorEnergy > 0 ? totalEnergy <= priorEnergy : true) && (priorWater > 0 ? totalWater <= priorWater : true)
        ? STATUS.ACHIEVED
        : avgDivertedPct > 0 ? STATUS.PARTIAL : STATUS.NOT_STARTED,
      pct: Math.round(((sum('waste_hazardous_kg') >= 0 ? 1 : 0) + (sum('waste_nonhazardous_kg') >= 0 ? 1 : 0) + (avgDivertedPct >= T.wasteDiv ? 1 : 0) + (availableYears.length >= 3 ? 1 : 0) + (((priorEnergy > 0 ? totalEnergy <= priorEnergy : true) && (priorWater > 0 ? totalWater <= priorWater : true)) ? 1 : 0)) / 5 * 100),
      thresholdFields: [
        {
          key: 'waste_diversion_target_pct', label: 'Waste Diversion Rate Target', type: 'number',
          unit: '%', min: 0, max: 100, step: 1, default: 50,
          hint: 'Minimum % of waste diverted from landfill to qualify as Achieved.',
        },
      ],
    },

    /* ─ SDG 13: Climate Action ───────────────────────────────────── */
    {
      num: 13, name: 'Climate Action', color: '#3F7E44',
      target: '13.2 Integrate climate measures | 13.1 Strengthen climate resilience',
      metric: [
        `Scope 1+2: ${(sum('scope1_tco2e') + sum('scope2_lb_tco2e')).toFixed(1)} tCO₂e (target ≤${T.scope12Target})`,
        T.climateFinanceRequired ? `CapEx: RM ${corp.climate_capex_rm || 0}` : null,
        T.climateFinanceRequired ? `Shadow Price: RM ${corp.internal_carbon_price || 0}` : null,
        T.climateScenarioRequired ? `Scenario: ${hasClimateScenario ? '✓' : '✗'}` : null,
        T.govOversightRequired ? `Oversight: ${hasGovOversight ? '✓' : '✗'}` : null,
        T.execAccountRequired ? `Remuneration Linkage: ${corp.exec_climate_remun_pct || 0}%` : null
      ].filter(Boolean).join(' | '),
      status: (sum('scope1_tco2e') > 0 && sum('scope2_lb_tco2e') > 0 && sum('scope3_tco2e') > 0) &&
        (sum('scope1_tco2e') + sum('scope2_lb_tco2e')) <= T.scope12Target &&
        (!T.climateFinanceRequired || (corp.climate_capex_rm > 0 && corp.internal_carbon_price > 0 && corp.climate_transition_risk_rm > 0 && corp.climate_physical_risk_rm > 0 && corp.climate_chronic_risk_rm > 0)) &&
        (!T.climateScenarioRequired || hasClimateScenario) &&
        (!T.govOversightRequired || hasGovOversight) &&
        (!T.execAccountRequired || corp.exec_climate_remun_pct > 0)
          ? STATUS.ACHIEVED
          : sum('scope1_tco2e') > 0 ? STATUS.PARTIAL : STATUS.NOT_STARTED,
      pct: Math.round(((sum('scope1_tco2e') > 0 && sum('scope2_lb_tco2e') > 0 && sum('scope3_tco2e') > 0 ? 1 : 0) + ((sum('scope1_tco2e') + sum('scope2_lb_tco2e')) <= T.scope12Target ? 1 : 0) + ((!T.climateFinanceRequired || (corp.climate_capex_rm > 0 && corp.internal_carbon_price > 0 && corp.climate_transition_risk_rm > 0 && corp.climate_physical_risk_rm > 0 && corp.climate_chronic_risk_rm > 0)) ? 1 : 0) + ((!T.climateScenarioRequired || hasClimateScenario) ? 1 : 0) + ((!T.govOversightRequired || hasGovOversight) ? 1 : 0) + ((!T.execAccountRequired || (corp.exec_climate_remun_pct > 0)) ? 1 : 0)) / 6 * 100),
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
          hint: 'Require Climate Opportunities / Capex / Internal Carbon Price / Risks tracking for Achieved status.',
        },
      ],
    },

    /* ─ SDG 16: Peace, Justice & Institutions ────────────────────── */
    {
      num: 16, name: 'Peace, Justice & Institutions', color: '#0A97D9',
      target: '16.5 Reduce corruption | 16.6 Transparent institutions | 16.10 Data privacy',
      metric: [
        `Training: ${corruptTraining.toFixed(1)}% (target ≥${T.corruptTrain}%)`,
        `Risk Assessment: ${(corp.corruption_risk_assessment_pct || 0).toFixed(1)}% (target ≥${T.corruptAssess}%)`,
        `Incidents: ${corruptIncidents} (target ≤${T.corruptionIncidents})`,
        `Breaches: ${privacyBreaches} (target ≤${T.privacyBreaches})`,
        T.govOversightRequired ? `Oversight: ${hasGovOversight ? '✓' : '✗'}` : null,
        T.execAccountRequired ? `Executive Accountability: ${hasExecAccount ? '✓' : '✗'}` : null,
        T.ermIntegrationRequired ? `ERM Integration: ${hasErmIntegration ? '✓' : '✗'}` : null
      ].filter(Boolean).join(' | '),
      status: corruptTraining >= T.corruptTrain &&
        (corp.corruption_risk_assessment_pct || 0) >= T.corruptAssess &&
        corruptIncidents <= T.corruptionIncidents &&
        (!T.govOversightRequired || hasGovOversight) &&
        (!T.execAccountRequired || hasExecAccount) &&
        (!T.ermIntegrationRequired || hasErmIntegration) &&
        privacyBreaches <= T.privacyBreaches
          ? STATUS.ACHIEVED
          : corruptIncidents <= T.corruptionIncidents && privacyBreaches <= T.privacyBreaches ? STATUS.PARTIAL : STATUS.NOT_STARTED,
      pct: Math.round(((corruptTraining >= T.corruptTrain ? 1 : 0) + ((corp.corruption_risk_assessment_pct || 0) >= T.corruptAssess ? 1 : 0) + (corruptIncidents <= T.corruptionIncidents ? 1 : 0) + ((!T.govOversightRequired || hasGovOversight) ? 1 : 0) + ((!T.execAccountRequired || hasExecAccount) ? 1 : 0) + ((!T.ermIntegrationRequired || hasErmIntegration) ? 1 : 0) + (privacyBreaches <= T.privacyBreaches ? 1 : 0)) / 7 * 100),
      thresholdFields: [
        {
          key: 'corrupt_training_target_pct', label: 'Anti-Corruption Training Target', type: 'number',
          unit: '%', min: 0, max: 100, step: 1, default: 95,
          hint: 'Minimum anti-corruption training coverage % required across the organisation for Achieved status.',
        },
        {
          key: 'corruption_risk_assessment_target_pct', label: 'Corruption Risk Assessment Target', type: 'number',
          unit: '%', min: 0, max: 100, step: 1, default: 95,
          hint: 'Minimum operations assessed for corruption-related risks % required for Achieved status.',
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

  /* Goals with no computed logic yet (added from the catalog but not one of
     the 10 built-in ones) render as an untracked placeholder rather than a
     bogus "Achieved". */
  const definedNums = sdgs.map(s => s.num);
  const placeholderSdgs = SDG_CATALOG
    .filter(c => !definedNums.includes(c.num))
    .map(c => ({
      num: c.num, name: c.name, color: c.color, target: c.target,
      metric: 'No metrics linked yet — this goal has no configured data source.',
      status: STATUS.NOT_STARTED,
      pct: 0,
      thresholdFields: [] as any[],
    }));
  const allSdgs = [...sdgs, ...placeholderSdgs].sort((a, b) => a.num - b.num);
  const visibleSdgs = allSdgs.filter(s => trackedNums.includes(s.num));

  const achieved   = visibleSdgs.filter(s => s.status === STATUS.ACHIEVED).length;
  const partial    = visibleSdgs.filter(s => s.status === STATUS.PARTIAL).length;
  const notStarted = visibleSdgs.filter(s => s.status === STATUS.NOT_STARTED).length;

  /* ── Add / remove a goal from tracking (scoped to selectedYear) ──── */
  const toggleTracked = async (num: number) => {
    const next = trackedNums.includes(num)
      ? trackedNums.filter(n => n !== num)
      : [...trackedNums, num].sort((a, b) => a - b);
    const byYear = { ...(settings.tracked_sdgs_by_year || {}), [selectedYear]: next };
    const merged = { ...settings, tracked_sdgs_by_year: byYear };
    setSettings(merged);
    await saveSettings(merged);
  };

  /* ── Export CSV ─────────────────────────────────────────────────── */
  const handleExportCsv = () => {
    const header = 'SDG,Name,Status,Progress (%),Metric,Target\n';
    const escape = (v: any) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = visibleSdgs.map(s =>
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
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {canWriteSdg && (
            <button className="btn btn-secondary" onClick={() => setManageOpen(true)}>
              <ListChecks size={18} /> Manage Goals
            </button>
          )}
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
        <div className="sdg-summary-chip chip-total">{visibleSdgs.length} SDGs tracked out of 17</div>
      </div>

      {/* ── SDG card grid ──────────────────────────────────────────── */}
      <div className="sdg-grid">
        {visibleSdgs.map(sdg => (
          <div key={sdg.num} className={`glass-card sdg-card sdg-card-${sdg.status}`}>

            {/* Header band */}
            <div className="sdg-header">
              <span className="sdg-num">{sdg.num}</span>
              <div className="sdg-header-right">
                <span className="sdg-name">{sdg.name}</span>
              </div>
              {/* Edit button — only for goals with configurable thresholds */}
              {canWriteSdg && sdg.thresholdFields.length > 0 && (
                <button
                  className="sdg-edit-btn"
                  onClick={() => openEdit(sdg)}
                  title={`Configure SDG ${sdg.num} thresholds`}
                  aria-label={`Configure thresholds for SDG ${sdg.num}`}
                >
                  <PencilIcon />
                </button>
              )}
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
      {editSdg && createPortal(
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
        </div>,
        document.body
      )}

      {/* ════════════════════════════════════════════════════════════
          MANAGE TRACKED GOALS MODAL
      ════════════════════════════════════════════════════════════ */}
      {manageOpen && createPortal(
        <div className="sdg-modal-overlay" onClick={() => setManageOpen(false)}>
          <div className="sdg-modal sdg-manage-modal" onClick={e => e.stopPropagation()}>

            <div className="sdg-modal-header">
              <div className="sdg-modal-title-row">
                <div>
                  <div className="sdg-modal-title">Manage Tracked Goals</div>
                  <div className="sdg-modal-subtitle">Add or remove UN SDGs tracked for FY{selectedYear}</div>
                </div>
              </div>
              <button className="sdg-modal-close" onClick={() => setManageOpen(false)} aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="sdg-modal-body">
              <div className="sdg-manage-list">
                {allSdgs.map(def => {
                  const tracked = trackedNums.includes(def.num);
                  return (
                    <div key={def.num} className="sdg-manage-row">
                      <span className="sdg-manage-badge" style={{ background: def.color }}>{def.num}</span>
                      <span className="sdg-manage-name">{def.name}</span>
                      <button
                        className={`btn btn-sm ${tracked ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={() => toggleTracked(def.num)}
                      >
                        {tracked ? <><Trash2 size={14} /> Remove</> : <><Plus size={14} /> Add</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="sdg-modal-footer">
              <button className="btn btn-secondary" onClick={() => setManageOpen(false)}>Done</button>
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default SDGDashboard;
