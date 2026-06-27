import { toISODate } from './dates.js';

// `Number(flat.total_headcount) || (permanent + contract)` treats an
// explicit 0 the same as "not provided" (0 is falsy), so a user clearing
// headcount to 0 always got silently overridden. Use presence, not truthiness.
export const resolveTotalHeadcount = (flat, permanent, contract) => {
  const explicit = flat.total_headcount;
  if (explicit !== undefined && explicit !== null && explicit !== '') {
    return Number(explicit) || 0;
  }
  return permanent + contract;
};

export const mapGreenOps = (flat) => ({
  total_energy_mwh:           Number(flat.total_energy_mwh)        || 0,
  renewable_energy_mwh:       Number(flat.renewable_energy_mwh)    || 0,
  total_water_m3:             Number(flat.total_water_m3)           || 0,
  hazardous_waste_tonnes:     (Number(flat.waste_hazardous_kg)     || 0) / 1000,
  nonhazardous_waste_tonnes:  (Number(flat.waste_nonhazardous_kg)  || 0) / 1000,
  waste_diverted_tonnes:      (Number(flat.waste_recycled_kg)      || 0) / 1000,
  sustainable_catering_pct:   Number(flat.sustainable_catering_pct) || 0,
  surplus_food_recovered_kg:  Number(flat.food_recovery_kg)         || 0,
  ghg_scope1_tco2e:           Number(flat.scope1_tco2e)             || 0,
  ghg_scope2_tco2e:           Number(flat.scope2_lb_tco2e)          || 0,
  ghg_scope3_tco2e:           Number(flat.scope3_tco2e)             || 0,
});

export const mapHealthSafety = (flat) => {
  const permanent = Number(flat.staff_permanent_count) || 0;
  const contract  = Number(flat.staff_contractor_count) || 0;
  return {
    work_related_fatalities:   Number(flat.fatalities_count)     || 0,
    lti_count:                 Number(flat.lti_count)            || 0,
    total_hours_worked:        Number(flat.man_hours_actual)     || 0,
    safety_training_headcount: Number(flat.safety_trained_count) || 0,
    total_headcount:           resolveTotalHeadcount(flat, permanent, contract),
    contract_temp_count:       contract,
    human_rights_complaints:   Number(flat.hr_complaints_count)  || 0,
    training_hours_total:      Number(flat.training_hours_total) || 0,
    employee_turnover_count:   Number(flat.turnover_count)       || 0,
  };
};

export const mapProcurement = (flat) => ({
  total_procurement_spend_rm: Number(flat.procurement_total_rm)    || 0,
  local_supplier_spend_rm:    Number(flat.local_supplier_spend_rm) || 0,
  community_investment_rm:    Number(flat.community_invest_rm)     || 0,
  community_beneficiaries:    Number(flat.community_beneficiaries) || 0,
  privacy_breaches_count:     Number(flat.data_breach_complaints)  || 0,
});

export const mapFinancials = (flat) => ({
  budget_estimated:  Number(flat.budget_estimated)  || 0,
  budget_actual:     Number(flat.budget_actual)     || 0,
  revenue_estimated: Number(flat.revenue_estimated) || 0,
  revenue_actual:    Number(flat.revenue_actual)    || 0,
  green_spend_rm:    Number(flat.green_spend_rm)    || 0,
});

export const mapTimeline = (flat) => ({
  project_start_date: toISODate(flat.project_start_date),
  planned_end_date:   toISODate(flat.project_end_planned),
  // Accept new key (timeline_actual_end_date) or old key (event_end_date) for
  // backwards compatibility. `||`, not `??` — the edit form defaults an
  // untouched field to '' (not null/undefined), and '' must fall through to
  // the next candidate or Postgres rejects it ("invalid input syntax for type date").
  actual_end_date: toISODate(flat.timeline_actual_end_date || flat.event_end_date),
  tasks_total:     Number(flat.tasks_total)     || 0,
  tasks_on_time:   Number(flat.tasks_on_time)   || 0,
  team_size:       Number(flat.team_size_total) || 0,
});

export const mapAttendance = (flat) => ({
  expected_attendance: Number(flat.expected_attendance) || 0,
  actual_attendance:   Number(flat.actual_attendance)   || 0,
});
