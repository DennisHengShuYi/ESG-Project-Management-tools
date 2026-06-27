import express from 'express';
import { supabase } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

const STRATEGY_KEYS = new Set([
  // Existing governance fields
  'gov_committee_name','gov_meeting_frequency','gov_board_oversight_text',
  'gov_strategy_integration_text','gov_executive_accountability_text',
  'risk_erm_integration_status','risk_identification_text','risk_assessment_text',
  'strategy_short_text','strategy_medium_text','strategy_long_text','scenario_analysis_text',
  // Strategy Integration Framework (new)
  'gov_business_model_impact_text','gov_time_horizons_text',
  // Executive Accountability Structure (new)
  'gov_exec_name_role','gov_exec_kpi_pay_linked','gov_exec_kpi_pay_desc','gov_board_report_url',
  // Risk Identification (new)
  'risk_prioritisation_text','risk_review_frequency',
  // ERM narrative (new)
  'risk_register_mapping_text','risk_owner_assignment_text','risk_mitigation_actions_text',
  // Climate Scenario split fields (new)
  'scenario_scenarios_used_text','scenario_key_assumptions_text',
  'scenario_resilience_summary_text','scenario_gaps_text',
]);

const HR_KEYS = new Set([
  'emp_total','emp_female','emp_male',
  'board_total','board_female','board_male',
  'board_male_pct','board_female_pct',
  'board_under30_pct','board_30to50_pct','board_over50_pct',
  'emp_under30_pct','emp_30to50_pct','emp_over50_pct',
  'anticorrupt_training_coverage','corruption_risk_assessment_pct','confirmed_corruption_incidents',
]);

const CLIMATE_KEYS = new Set([
  'climate_transition_risk_rm','climate_transition_risk_pct',
  'climate_physical_risk_rm','climate_physical_risk_pct',
  'climate_chronic_risk_rm','climate_chronic_risk_pct',
  'climate_opportunities_rm','climate_opportunities_pct',
  'climate_capex_rm','internal_carbon_price','exec_climate_remun_pct',
  'fin_position_impact_rm','fin_position_impact_pct','fin_position_time_horizon',
]);

// Meta fields from the GET response (merged from multiple tables) that must never
// be written back — they would cause Supabase upsert to fail or produce conflicts.
const META_KEYS = new Set(['id','organisation_id','reporting_year','created_at','updated_at']);

// Distinct reporting years that actually have governance data — used by the
// frontend's year-default heuristic, which must not confuse "an event exists
// for year X" (module_events) with "governance data exists for year X"
// (module_strategy_risk / module_hr_diversity / module_climate_finance).
router.get('/years', async (req, res) => {
  try {
    const [sRes, hRes, cRes] = await Promise.all([
      supabase.from('module_strategy_risk').select('reporting_year').eq('organisation_id', req.user.organisation_id),
      supabase.from('module_hr_diversity').select('reporting_year').eq('organisation_id', req.user.organisation_id),
      supabase.from('module_climate_finance').select('reporting_year').eq('organisation_id', req.user.organisation_id),
    ]);
    const years = new Set();
    [sRes, hRes, cRes].forEach(r => (r.data || []).forEach(row => years.add(row.reporting_year)));
    res.json(Array.from(years));
  } catch (err) {
    console.error('getGovernanceYears error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const year = req.query.year || '2025';
    const [sRes, hRes, cRes] = await Promise.all([
      supabase.from('module_strategy_risk')
        .select('*').eq('organisation_id', req.user.organisation_id).eq('reporting_year', year).maybeSingle(),
      supabase.from('module_hr_diversity')
        .select('*').eq('organisation_id', req.user.organisation_id).eq('reporting_year', year).maybeSingle(),
      supabase.from('module_climate_finance')
        .select('*').eq('organisation_id', req.user.organisation_id).eq('reporting_year', year).maybeSingle(),
    ]);

    res.json({
      ...(sRes.data  || {}),
      ...(hRes.data  || {}),
      ...(cRes.data  || {}),
    });
  } catch (err) {
    console.error('getCorporateGovernance error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const govData = req.body;
    const year = req.query.year || '2025';

    const strategy = {}, hr = {}, climate = {};
    Object.entries(govData).forEach(([k, v]) => {
      if (META_KEYS.has(k))      return;          // skip meta fields
      if (STRATEGY_KEYS.has(k))  strategy[k] = v;
      else if (HR_KEYS.has(k))   hr[k] = v;
      else if (CLIMATE_KEYS.has(k)) climate[k] = v;
      // else: unknown key — silently ignored (no partial upsert pollution)
    });

    const baseStrategy = { organisation_id: req.user.organisation_id, reporting_year: year, ...strategy };
    const baseHr       = { organisation_id: req.user.organisation_id, reporting_year: year, ...hr };
    const baseClimate  = { organisation_id: req.user.organisation_id, reporting_year: year, ...climate };

    const results = await Promise.all([
      Object.keys(strategy).length > 0
        ? supabase.from('module_strategy_risk').upsert(baseStrategy, { onConflict: 'organisation_id,reporting_year' })
        : Promise.resolve(null),
      Object.keys(hr).length > 0
        ? supabase.from('module_hr_diversity').upsert(baseHr, { onConflict: 'organisation_id,reporting_year' })
        : Promise.resolve(null),
      Object.keys(climate).length > 0
        ? supabase.from('module_climate_finance').upsert(baseClimate, { onConflict: 'organisation_id,reporting_year' })
        : Promise.resolve(null),
    ]);

    // supabase-js upsert() resolves with {data, error} rather than throwing —
    // without this check, a failed upsert (e.g. an unrecognised column) was
    // silently swallowed and the frontend always reported "saved successfully".
    const failed = results.filter(r => r && r.error);
    if (failed.length > 0) throw new Error(failed.map(r => r.error.message).join('; '));

    res.json({ success: true });
  } catch (err) {
    console.error('saveCorporateGovernance error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
