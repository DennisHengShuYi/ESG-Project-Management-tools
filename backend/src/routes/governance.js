import express from 'express';
import { supabase } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { hasPermission } from '../middleware/permissions.js';
import { logAudit } from '../utils/auditLog.js';
import { STRATEGY_KEYS, HR_KEYS, CLIMATE_KEYS, redactGovernanceFields } from '../utils/fieldRedaction.js';

const router = express.Router();
router.use(requireAuth);

// Meta fields from the GET response (merged from multiple tables) that must never
// be written back — they would cause Supabase upsert to fail or produce conflicts.
const META_KEYS = new Set(['id','organisation_id','reporting_year','created_at','updated_at']);

// Distinct reporting years that actually have governance data — used by the
// frontend's year-default heuristic, which must not confuse "an event exists
// for year X" (module_events) with "governance data exists for year X"
// (module_strategy_risk / module_hr_diversity / module_climate_finance).
// Requires read on at least one of the three org-level modules — this is a
// low-sensitivity aggregate (just year strings), not gated more strictly.
router.get('/years', async (req, res) => {
  const canRead = ['governance', 'hr-diversity', 'climate-finance'].some(m => hasPermission(req.user, m, 'read'));
  if (!canRead) return res.status(403).json({ error: 'No read access to governance data.' });
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
  const canRead = ['governance', 'hr-diversity', 'climate-finance'].some(m => hasPermission(req.user, m, 'read'));
  if (!canRead) return res.status(403).json({ error: 'No read access to governance data.' });
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

    const merged = {
      ...(sRes.data  || {}),
      ...(hRes.data  || {}),
      ...(cRes.data  || {}),
    };

    // Most recent change across the three org-level modules for this year,
    // for the "Last edited by" attribution shown on the Governance page.
    const recordIds = [sRes.data?.id, hRes.data?.id, cRes.data?.id].filter(Boolean);
    let lastEdit = null;
    if (recordIds.length > 0) {
      const { data } = await supabase
        .from('audit_log')
        .select('user_email, module, created_at')
        .in('record_id', recordIds)
        .eq('organisation_id', req.user.organisation_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      lastEdit = data || null;
    }

    res.json({ ...redactGovernanceFields(merged, req.user), _last_edited: lastEdit });
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

    const GROUPS = [
      { module: 'governance',      table: 'module_strategy_risk',   payload: strategy, base: baseStrategy },
      { module: 'hr-diversity',    table: 'module_hr_diversity',    payload: hr,       base: baseHr },
      { module: 'climate-finance', table: 'module_climate_finance', payload: climate,  base: baseClimate },
    ].filter(g => Object.keys(g.payload).length > 0);

    // Reject the whole save (no partial writes) if the user lacks write
    // access to any module the submitted payload actually touches.
    const forbidden = GROUPS.filter(g => !hasPermission(req.user, g.module, 'write'));
    if (forbidden.length > 0) {
      return res.status(403).json({ error: `No write access to: ${forbidden.map(g => g.module).join(', ')}.` });
    }

    const beforeRows = await Promise.all(
      GROUPS.map(g => supabase.from(g.table)
        .select('*').eq('organisation_id', req.user.organisation_id).eq('reporting_year', year).maybeSingle())
    );

    const results = await Promise.all(
      GROUPS.map(g => supabase.from(g.table)
        .upsert(g.base, { onConflict: 'organisation_id,reporting_year' })
        .select().maybeSingle())
    );

    // supabase-js upsert() resolves with {data, error} rather than throwing —
    // without this check, a failed upsert (e.g. an unrecognised column) was
    // silently swallowed and the frontend always reported "saved successfully".
    const failed = results.filter(r => r && r.error);
    if (failed.length > 0) throw new Error(failed.map(r => r.error.message).join('; '));

    await Promise.all(GROUPS.map((g, i) => logAudit(req, {
      action: 'update', module: g.module, table: g.table,
      recordId: results[i]?.data?.id ?? beforeRows[i]?.data?.id,
      before: beforeRows[i]?.data, after: results[i]?.data ?? g.base,
    })));

    res.json({ success: true });
  } catch (err) {
    console.error('saveCorporateGovernance error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
