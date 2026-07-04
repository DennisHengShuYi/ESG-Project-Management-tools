// Maps every field the frontend can see back to the module that owns it,
// so read access can be enforced per-module even though several endpoints
// (events_flat, corporate governance) merge multiple modules' data into one
// response object. Admins skip all of this — see middleware/permissions.js.

// ── Corporate governance / HR / climate-finance key sets ────────────────
// Single source of truth — governance.js imports these too, so the field
// list used to split one incoming payload across three tables is exactly
// the same list used to redact one outgoing payload on the way out.
export const STRATEGY_KEYS = new Set([
  'gov_committee_name', 'gov_meeting_frequency', 'gov_board_oversight_text',
  'gov_strategy_integration_text', 'gov_executive_accountability_text',
  'risk_erm_integration_status', 'risk_identification_text', 'risk_assessment_text',
  'strategy_short_text', 'strategy_medium_text', 'strategy_long_text', 'scenario_analysis_text',
  'gov_business_model_impact_text', 'gov_time_horizons_text',
  'gov_exec_name_role', 'gov_exec_kpi_pay_linked', 'gov_exec_kpi_pay_desc', 'gov_board_report_url',
  'risk_prioritisation_text', 'risk_review_frequency',
  'risk_register_mapping_text', 'risk_owner_assignment_text', 'risk_mitigation_actions_text',
  'scenario_scenarios_used_text', 'scenario_key_assumptions_text',
  'scenario_resilience_summary_text', 'scenario_gaps_text',
]);

export const HR_KEYS = new Set([
  'emp_total', 'emp_female', 'emp_male',
  'board_total', 'board_female', 'board_male',
  'board_male_pct', 'board_female_pct',
  'board_under30_pct', 'board_30to50_pct', 'board_over50_pct',
  'emp_under30_pct', 'emp_30to50_pct', 'emp_over50_pct',
  'anticorrupt_training_coverage', 'corruption_risk_assessment_pct', 'confirmed_corruption_incidents',
]);

export const CLIMATE_KEYS = new Set([
  'climate_transition_risk_rm', 'climate_transition_risk_pct',
  'climate_physical_risk_rm', 'climate_physical_risk_pct',
  'climate_chronic_risk_rm', 'climate_chronic_risk_pct',
  'climate_opportunities_rm', 'climate_opportunities_pct',
  'climate_capex_rm', 'internal_carbon_price', 'exec_climate_remun_pct',
  'fin_position_impact_rm', 'fin_position_impact_pct', 'fin_position_time_horizon',
]);

// Meta fields present on the merged governance response that aren't gated —
// they're identifiers/timestamps, not module content.
const GOVERNANCE_META_KEYS = new Set(['id', 'organisation_id', 'reporting_year', 'created_at', 'updated_at']);

/**
 * Removes fields from a merged governance/HR/climate-finance response the
 * user can't read. Meta fields always pass through.
 */
export function redactGovernanceFields(corp, user) {
  if (!corp) return corp;
  if (user.role === 'admin') return corp;

  const canReadStrategy = !!user.module_permissions?.governance?.read || !!user.module_permissions?.governance?.write;
  const canReadHr       = !!user.module_permissions?.['hr-diversity']?.read || !!user.module_permissions?.['hr-diversity']?.write;
  const canReadClimate  = !!user.module_permissions?.['climate-finance']?.read || !!user.module_permissions?.['climate-finance']?.write;

  const out = {};
  Object.keys(corp).forEach(key => {
    if (GOVERNANCE_META_KEYS.has(key)) { out[key] = corp[key]; return; }
    if (STRATEGY_KEYS.has(key))  { if (canReadStrategy) out[key] = corp[key]; return; }
    if (HR_KEYS.has(key))        { if (canReadHr)       out[key] = corp[key]; return; }
    if (CLIMATE_KEYS.has(key))   { if (canReadClimate)  out[key] = corp[key]; return; }
    out[key] = corp[key]; // unknown key — pass through rather than silently drop
  });
  return out;
}

// ── Event flat-view field → module map ───────────────────────────────────
// Mirrors frontend/src/utils/db.ts's CSV_FIELDS module tagging, plus the
// computed/derived columns events_flat adds that CSV_FIELDS doesn't cover
// (CSV export only lists raw input fields, not auto-calculated ones).
const EVENT_FIELD_MODULE = {};
const tag = (module, keys) => keys.forEach(k => { EVENT_FIELD_MODULE[k] = module; });

tag('events', [
  'id', 'event_name', 'client_name', 'event_location', 'event_type', 'event_status',
  'reporting_year', 'event_start_date', 'event_end_date', 'description',
  'organisation_id', 'created_at', 'updated_at', 'deleted_at',
]);

tag('green-ops', [
  'total_energy_mwh', 'renewable_energy_mwh', 'renewable_energy_pct', 'total_water_m3',
  'waste_hazardous_kg', 'waste_nonhazardous_kg', 'waste_recycled_kg', 'waste_composted_kg',
  'waste_upcycled_kg', 'waste_diverted_pct', 'sustainable_catering_pct', 'food_recovery_kg',
  'scope1_tco2e', 'scope2_lb_tco2e', 'scope3_tco2e',
]);

tag('health-safety', [
  'fatalities_count', 'lti_count', 'man_hours_actual', 'ltir', 'safety_trained_count',
  'staff_permanent_count', 'staff_contractor_count', 'contractor_pct', 'hr_complaints_count',
  'training_hours_total', 'turnover_count', 'crew_female_count', 'crew_male_count', 'total_headcount',
]);

tag('procurement', [
  'procurement_total_rm', 'local_supplier_spend_rm', 'local_supplier_spend_pct',
  'community_invest_rm', 'community_beneficiaries', 'data_breach_complaints',
]);

tag('financial', [
  'budget_estimated', 'budget_actual', 'revenue_estimated', 'revenue_actual', 'green_spend_rm',
]);

tag('timeline', [
  'project_start_date', 'project_end_planned', 'timeline_actual_end_date',
  'tasks_total', 'tasks_on_time', 'team_size_total',
]);

tag('attendance', ['expected_attendance', 'actual_attendance']);

/**
 * Removes fields from a flat event object the user can't read. Fields with
 * no known module mapping pass through unchanged rather than being silently
 * dropped (fail open on unmapped metadata, not on known-sensitive data).
 */
export function redactEventFields(event, user) {
  if (!event) return event;
  if (user.role === 'admin') return event;

  const out = {};
  Object.keys(event).forEach(key => {
    const module = EVENT_FIELD_MODULE[key];
    if (!module) { out[key] = event[key]; return; }
    const perm = user.module_permissions?.[module];
    if (perm?.read || perm?.write) out[key] = event[key];
  });
  return out;
}
