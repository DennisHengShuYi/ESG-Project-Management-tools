// src/utils/db.js
import { supabase } from './supabase';

const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

// ── Events (core fields only — for list view) ─────────────────────
export const getEvents = async () => {
  const { data, error } = await supabase
    .from('events')
    .select('id,event_name,client_name,event_location,event_type,event_status,reporting_year,event_start_date,event_end_date,created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) { console.error('getEvents error:', error); return []; }
  return data;
};

// ── Events (full flat view — for Dashboard / SDG aggregation) ─────
export const getEventsFull = async () => {
  const { data, error } = await supabase
    .from('events_flat')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('getEventsFull error:', error); return []; }
  return data;
};

// ── Single event with all module data ────────────────────────────
export const getEventDetail = async (id) => {
  const { data, error } = await supabase
    .from('events_flat')
    .select('*')
    .eq('id', id)
    .single();
  if (error) { console.error('getEventDetail error:', error); return null; }
  return data;
};

// ── Save / upsert core event fields ──────────────────────────────
export const saveEvent = async (eventData) => {
  const CORE_FIELDS = [
    'event_name', 'client_name', 'event_location', 'event_type',
    'event_status', 'reporting_year', 'event_start_date', 'event_end_date',
    'description', 'organisation_id',
  ];

  const fields = {};
  CORE_FIELDS.forEach(k => { if (eventData[k] !== undefined) fields[k] = eventData[k]; });
  if (!fields.organisation_id) fields.organisation_id = DEFAULT_ORG_ID;

  const id = eventData.id;
  if (id) {
    const { data, error } = await supabase
      .from('events').update(fields).eq('id', id).select().single();
    if (error) { console.error('saveEvent (update) error:', error); return null; }
    return data;
  } else {
    const { data, error } = await supabase
      .from('events').insert(fields).select().single();
    if (error) { console.error('saveEvent (insert) error:', error); return null; }
    return data;
  }
};

// Soft delete
export const deleteEvent = async (id) => {
  const { error } = await supabase
    .from('events')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.error('deleteEvent error:', error);
};

// ── Module A: Green Ops ───────────────────────────────────────────
export const saveGreenOps = async (eventId, flat) => {
  const row = {
    event_id:                   eventId,
    total_energy_mwh:           Number(flat.total_energy_mwh)     || 0,
    renewable_energy_mwh:       Number(flat.renewable_energy_mwh) || 0,
    total_water_m3:             Number(flat.total_water_m3)        || 0,
    hazardous_waste_tonnes:     (Number(flat.waste_hazardous_kg)  || 0) / 1000,
    nonhazardous_waste_tonnes:  (Number(flat.waste_nonhazardous_kg) || 0) / 1000,
    waste_diverted_tonnes:      (Number(flat.waste_recycled_kg)   || 0) / 1000,
    sustainable_catering_pct:   Number(flat.sustainable_catering_pct) || 0,
    surplus_food_recovered_kg:  Number(flat.food_recovery_kg)     || 0,
    ghg_scope1_tco2e:           Number(flat.scope1_tco2e)          || 0,
    ghg_scope2_tco2e:           Number(flat.scope2_lb_tco2e)       || 0,
    ghg_scope3_tco2e:           Number(flat.scope3_tco2e)          || 0,
  };
  const { error } = await supabase
    .from('module_green_ops')
    .upsert(row, { onConflict: 'event_id' });
  if (error) console.error('saveGreenOps error:', error);
};

// ── Module B: Health, Safety & Labour ────────────────────────────
export const saveHealthSafety = async (eventId, flat) => {
  const permanent = Number(flat.staff_permanent_count) || 0;
  const contract  = Number(flat.staff_contractor_count) || 0;
  const row = {
    event_id:                   eventId,
    work_related_fatalities:    Number(flat.fatalities_count)      || 0,
    lti_count:                  Number(flat.lti_count)             || 0,
    total_hours_worked:         Number(flat.man_hours_actual)      || 0,
    safety_training_headcount:  Number(flat.safety_trained_count)  || 0,
    total_headcount:            Number(flat.total_headcount)       || (permanent + contract),
    contract_temp_count:        contract,
    human_rights_complaints:    Number(flat.hr_complaints_count)   || 0,
    training_hours_total:       Number(flat.training_hours_total)  || 0,
    employee_turnover_count:    Number(flat.turnover_count)        || 0,
  };
  const { error } = await supabase
    .from('module_health_safety_labour')
    .upsert(row, { onConflict: 'event_id' });
  if (error) console.error('saveHealthSafety error:', error);
};

// ── Module C: Procurement & Community ────────────────────────────
export const saveProcurement = async (eventId, flat) => {
  const row = {
    event_id:                   eventId,
    total_procurement_spend_rm: Number(flat.procurement_total_rm)  || 0,
    local_supplier_spend_rm:    Number(flat.local_supplier_spend_rm) || 0,
    community_investment_rm:    Number(flat.community_invest_rm)   || 0,
    community_beneficiaries:    Number(flat.community_beneficiaries) || 0,
    privacy_breaches_count:     Number(flat.data_breach_complaints) || 0,
  };
  const { error } = await supabase
    .from('module_procurement_community')
    .upsert(row, { onConflict: 'event_id' });
  if (error) console.error('saveProcurement error:', error);
};

// ── Event Financials ──────────────────────────────────────────────
export const saveEventFinancials = async (eventId, flat) => {
  const row = {
    event_id:          eventId,
    budget_estimated:  Number(flat.budget_estimated)  || 0,
    budget_actual:     Number(flat.budget_actual)     || 0,
    revenue_estimated: Number(flat.revenue_estimated) || 0,
    revenue_actual:    Number(flat.revenue_actual)    || 0,
    green_spend_rm:    Number(flat.green_spend_rm)    || 0,
  };
  const { error } = await supabase
    .from('event_financials')
    .upsert(row, { onConflict: 'event_id' });
  if (error) console.error('saveEventFinancials error:', error);
};

// ── Event Timeline ────────────────────────────────────────────────
export const saveEventTimeline = async (eventId, flat) => {
  const row = {
    event_id:           eventId,
    project_start_date: flat.project_start_date || null,
    planned_end_date:   flat.project_end_planned || null,
    actual_end_date:    flat.event_end_date      || null,
    tasks_total:        Number(flat.tasks_total)    || 0,
    tasks_on_time:      Number(flat.tasks_on_time)  || 0,
    team_size:          Number(flat.team_size_total) || 0,
  };
  const { error } = await supabase
    .from('event_timeline')
    .upsert(row, { onConflict: 'event_id' });
  if (error) console.error('saveEventTimeline error:', error);
};

// ── Event Attendance ──────────────────────────────────────────────
export const saveEventAttendance = async (eventId, flat) => {
  const row = {
    event_id:            eventId,
    expected_attendance: Number(flat.expected_attendance) || 0,
    actual_attendance:   Number(flat.actual_attendance)   || 0,
  };
  const { error } = await supabase
    .from('event_attendance')
    .upsert(row, { onConflict: 'event_id' });
  if (error) console.error('saveEventAttendance error:', error);
};

// ── Corporate Governance (merges 3 org-level tables) ─────────────
export const getCorporateGovernance = async (year = '2025') => {
  const [sRes, hRes, cRes] = await Promise.all([
    supabase.from('module_strategy_risk')
      .select('*').eq('organisation_id', DEFAULT_ORG_ID).eq('reporting_year', year).maybeSingle(),
    supabase.from('module_hr_diversity')
      .select('*').eq('organisation_id', DEFAULT_ORG_ID).eq('reporting_year', year).maybeSingle(),
    supabase.from('module_climate_finance')
      .select('*').eq('organisation_id', DEFAULT_ORG_ID).eq('reporting_year', year).maybeSingle(),
  ]);
  return {
    ...(sRes.data  || {}),
    ...(hRes.data  || {}),
    ...(cRes.data  || {}),
  };
};

const STRATEGY_KEYS = new Set([
  'gov_committee_name','gov_meeting_frequency','gov_board_oversight_text',
  'gov_strategy_integration_text','gov_executive_accountability_text',
  'risk_erm_integration_status','risk_identification_text','risk_assessment_text',
  'strategy_short_text','strategy_medium_text','strategy_long_text','scenario_analysis_text',
]);

const HR_KEYS = new Set([
  'emp_total','emp_female','emp_male',
  'board_total','board_female','board_male',
  'board_male_pct','board_female_pct',
  'board_under30_pct','board_30to50_pct','board_over50_pct',
  'anticorrupt_training_coverage','corruption_risk_assessment_pct','confirmed_corruption_incidents',
]);

export const saveCorporateGovernance = async (govData, year = '2025') => {
  const strategy = {}, hr = {}, climate = {};
  Object.entries(govData).forEach(([k, v]) => {
    if (STRATEGY_KEYS.has(k)) strategy[k] = v;
    else if (HR_KEYS.has(k))  hr[k] = v;
    else                      climate[k] = v;
  });

  const baseStrategy = { organisation_id: DEFAULT_ORG_ID, reporting_year: year, ...strategy };
  const baseHr       = { organisation_id: DEFAULT_ORG_ID, reporting_year: year, ...hr };
  const baseClimate  = { organisation_id: DEFAULT_ORG_ID, reporting_year: year, ...climate };

  await Promise.all([
    Object.keys(strategy).length > 0
      ? supabase.from('module_strategy_risk').upsert(baseStrategy, { onConflict: 'organisation_id,reporting_year' })
      : Promise.resolve(),
    Object.keys(hr).length > 0
      ? supabase.from('module_hr_diversity').upsert(baseHr, { onConflict: 'organisation_id,reporting_year' })
      : Promise.resolve(),
    Object.keys(climate).length > 0
      ? supabase.from('module_climate_finance').upsert(baseClimate, { onConflict: 'organisation_id,reporting_year' })
      : Promise.resolve(),
  ]);
};

// ── App Settings ─────────────────────────────────────────────────
export const getSettings = async () => {
  const { data, error } = await supabase
    .from('app_settings').select('*').limit(1).single();
  if (error) { console.error('getSettings error:', error); return {}; }
  return data?.data || {};
};

export const saveSettings = async (settingsData) => {
  const { data: existing } = await supabase
    .from('app_settings').select('id').limit(1).single();
  if (existing?.id) {
    const { error } = await supabase
      .from('app_settings').update({ data: settingsData }).eq('id', existing.id);
    if (error) console.error('saveSettings error:', error);
  } else {
    const { error } = await supabase
      .from('app_settings').insert({ data: settingsData });
    if (error) console.error('saveSettings (insert) error:', error);
  }
};

export const seedDatabase = () => {
  console.log('Using Supabase — seeding done via schema.sql / seed_dummy.sql.');
};
