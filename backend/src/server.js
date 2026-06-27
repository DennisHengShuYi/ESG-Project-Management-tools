import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from './supabase.js';
import { requireAuth } from './middleware/auth.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Helper to check if event belongs to organisation
const checkEventOwnership = async (eventId, organisationId) => {
  const { data, error } = await supabase
    .from('events')
    .select('organisation_id')
    .eq('id', eventId)
    .maybeSingle();
  if (error || !data) return false;
  return data.organisation_id === organisationId;
};

// `Number(flat.total_headcount) || (permanent + contract)` treats an
// explicit 0 the same as "not provided" (0 is falsy), so a user clearing
// headcount to 0 always got silently overridden. Use presence, not truthiness.
const resolveTotalHeadcount = (flat, permanent, contract) => {
  const explicit = flat.total_headcount;
  if (explicit !== undefined && explicit !== null && explicit !== '') {
    return Number(explicit) || 0;
  }
  return permanent + contract;
};

// ── Public Authentication Routes ─────────────────────────────────

// Fetch list of organisations
app.get('/api/auth/organisations', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('organisations')
      .select('id, name')
      .order('name');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('getOrganisations error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Register user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, organisation_id } = req.body;
    if (!email || !password || !organisation_id) {
      return res.status(400).json({ error: 'Email, password, and organization ID are required.' });
    }

    // Validate organisation_id exists
    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .select('id')
      .eq('id', organisation_id)
      .maybeSingle();

    if (orgError || !org) {
      return res.status(400).json({ error: 'Invalid Organization Code / ID.' });
    }

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Insert user
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        email,
        password_hash,
        organisation_id
      })
      .select('id, email, organisation_id')
      .single();

    if (insertError) throw insertError;

    // Generate JWT token for auto-login
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, organisation_id: newUser.organisation_id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        organisation_id: newUser.organisation_id
      }
    });
  } catch (err) {
    console.error('register error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Fetch user
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id, email, password_hash, organisation_id')
      .eq('email', email)
      .maybeSingle();

    if (fetchError || !user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // Sign JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, organisation_id: user.organisation_id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        organisation_id: user.organisation_id
      }
    });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Events (core fields, scoped) ─────────────────────────────────
app.get('/api/events', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('id,event_name,client_name,event_location,event_type,event_status,reporting_year,event_start_date,event_end_date,created_at')
      .eq('organisation_id', req.user.organisation_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('getEvents error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Events (full flat view, scoped) ──────────────────────────────
app.get('/api/events/full', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('events_flat')
      .select('*')
      .eq('organisation_id', req.user.organisation_id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('getEventsFull error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Single event with all module data (scoped) ───────────────────
app.get('/api/events/:id', requireAuth, async (req, res) => {
  try {
    // Primary flat view
    const { data, error } = await supabase
      .from('events_flat')
      .select('*')
      .eq('id', req.params.id)
      .eq('organisation_id', req.user.organisation_id)
      .single();
    if (error) throw error;

    // Supplement with fields the view doesn't include
    const { data: tl } = await supabase
      .from('event_timeline')
      .select('project_start_date, planned_end_date, actual_end_date, tasks_total, tasks_on_time, team_size')
      .eq('event_id', req.params.id)
      .maybeSingle();

    // Merge: view fields take priority; fill gaps from event_timeline
    const merged = {
      ...data,
      // Ensure frontend key project_end_planned is always populated
      project_start_date: data.project_start_date ?? tl?.project_start_date ?? null,
      project_end_planned: data.project_end_planned ?? tl?.planned_end_date ?? null,
      // actual_end_date from timeline (distinct from event_end_date on events table)
      timeline_actual_end_date: tl?.actual_end_date ?? null,
      tasks_total:   tl?.tasks_total   ?? data.tasks_total   ?? null,
      tasks_on_time: tl?.tasks_on_time ?? data.tasks_on_time ?? null,
      team_size_total: data.team_size_total ?? tl?.team_size ?? null,
    };

    res.json(merged);
  } catch (err) {
    console.error('getEventDetail error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ── Save / upsert core event fields (scoped) ─────────────────────
app.post('/api/events', requireAuth, async (req, res) => {
  try {
    const eventData = req.body;
    const CORE_FIELDS = [
      'event_name', 'client_name', 'event_location', 'event_type',
      'event_status', 'reporting_year', 'event_start_date', 'event_end_date',
      'description'
    ];

    const fields = {};
    CORE_FIELDS.forEach(k => { if (eventData[k] !== undefined) fields[k] = eventData[k]; });

    // Postgres rejects '' for a `date` column ("invalid input syntax for type
    // date"); the create/edit form always sends these keys even when blank.
    if (fields.event_start_date === '') fields.event_start_date = null;
    if (fields.event_end_date === '') fields.event_end_date = null;

    // Bind to user's organization
    fields.organisation_id = req.user.organisation_id;

    const id = eventData.id;
    if (id) {
      // Verify ownership first
      const hasAccess = await checkEventOwnership(id, req.user.organisation_id);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access Denied: Event does not belong to your organization.' });
      }

      const { data, error } = await supabase
        .from('events').update(fields).eq('id', id).select().single();
      if (error) throw error;
      res.json(data);
    } else {
      const { data, error } = await supabase
        .from('events').insert(fields).select().single();
      if (error) throw error;
      res.json(data);
    }
  } catch (err) {
    console.error('saveEvent error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Soft delete (scoped)
app.delete('/api/events/:id', requireAuth, async (req, res) => {
  try {
    const hasAccess = await checkEventOwnership(req.params.id, req.user.organisation_id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const { error } = await supabase
      .from('events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('deleteEvent error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Bulk update all modules at once (used by CSV upload) ─────────

/**
 * Normalise any common date string into YYYY-MM-DD for PostgreSQL.
 * Handles: YYYY-MM-DD, DD/MM/YYYY, D/M/YYYY, MM/DD/YYYY, DD-MM-YYYY, etc.
 * Returns null for blank or unparseable values.
 */
const toISODate = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;

  // Already ISO format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or D/M/YYYY  (day first — most common in Malaysia)
  const dmySlash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmySlash) {
    const [, d, m, y] = dmySlash;
    const iso = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    // Validate the date is real
    const dt = new Date(iso);
    if (!isNaN(dt.getTime())) return iso;
  }

  // DD-MM-YYYY or D-M-YYYY
  const dmyDash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmyDash) {
    const [, d, m, y] = dmyDash;
    const iso = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    const dt = new Date(iso);
    if (!isNaN(dt.getTime())) return iso;
  }

  // Try native Date parse as last resort (handles many edge cases).
  // Read back via local getters (not toISOString/UTC) — Date parses
  // non-ISO strings as local midnight, and converting that to UTC can
  // roll the date back a day for positive UTC offsets (e.g. GMT+8).
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
};

app.post('/api/events/:id/bulk-update', requireAuth, async (req, res) => {
  try {
    const hasAccess = await checkEventOwnership(req.params.id, req.user.organisation_id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access Denied: Event does not belong to your organization.' });
    }

    const flat = req.body;
    const eventId = req.params.id;

    const greenOpsRow = {
      event_id:                   eventId,
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
    };

    const permanent = Number(flat.staff_permanent_count) || 0;
    const contract  = Number(flat.staff_contractor_count) || 0;
    const healthRow = {
      event_id:                   eventId,
      work_related_fatalities:    Number(flat.fatalities_count)         || 0,
      lti_count:                  Number(flat.lti_count)                || 0,
      total_hours_worked:         Number(flat.man_hours_actual)         || 0,
      safety_training_headcount:  Number(flat.safety_trained_count)     || 0,
      total_headcount:            resolveTotalHeadcount(flat, permanent, contract),
      contract_temp_count:        contract,
      human_rights_complaints:    Number(flat.hr_complaints_count)      || 0,
      training_hours_total:       Number(flat.training_hours_total)     || 0,
      employee_turnover_count:    Number(flat.turnover_count)           || 0,
    };

    const procRow = {
      event_id:                   eventId,
      total_procurement_spend_rm: Number(flat.procurement_total_rm)    || 0,
      local_supplier_spend_rm:    Number(flat.local_supplier_spend_rm) || 0,
      community_investment_rm:    Number(flat.community_invest_rm)     || 0,
      community_beneficiaries:    Number(flat.community_beneficiaries) || 0,
      privacy_breaches_count:     Number(flat.data_breach_complaints)  || 0,
    };

    const finRow = {
      event_id:          eventId,
      budget_estimated:  Number(flat.budget_estimated)  || 0,
      budget_actual:     Number(flat.budget_actual)     || 0,
      revenue_estimated: Number(flat.revenue_estimated) || 0,
      revenue_actual:    Number(flat.revenue_actual)    || 0,
      green_spend_rm:    Number(flat.green_spend_rm)    || 0,
    };

    const timeRow = {
      event_id:           eventId,
      project_start_date: toISODate(flat.project_start_date),
      planned_end_date:   toISODate(flat.project_end_planned),
      // Accept new key (timeline_actual_end_date) or old key (event_end_date) for backwards compatibility
      actual_end_date:    toISODate(flat.timeline_actual_end_date ?? flat.event_end_date),
      tasks_total:        Number(flat.tasks_total)    || 0,
      tasks_on_time:      Number(flat.tasks_on_time)  || 0,
      team_size:          Number(flat.team_size_total) || 0,
    };

    const attRow = {
      event_id:            eventId,
      expected_attendance: Number(flat.expected_attendance) || 0,
      actual_attendance:   Number(flat.actual_attendance)   || 0,
    };

    const results = await Promise.allSettled([
      supabase.from('module_green_ops').upsert(greenOpsRow, { onConflict: 'event_id' }),
      supabase.from('module_health_safety_labour').upsert(healthRow, { onConflict: 'event_id' }),
      supabase.from('module_procurement_community').upsert(procRow, { onConflict: 'event_id' }),
      supabase.from('event_financials').upsert(finRow, { onConflict: 'event_id' }),
      supabase.from('event_timeline').upsert(timeRow, { onConflict: 'event_id' }),
      supabase.from('event_attendance').upsert(attRow, { onConflict: 'event_id' }),
    ]);

    const errors = results
      .filter(r => r.status === 'rejected' || r.value?.error)
      .map(r => r.status === 'rejected' ? r.reason?.message : r.value?.error?.message);

    if (errors.length > 0) {
      return res.status(500).json({ error: 'Some modules failed to save: ' + errors.join('; ') });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('bulkUpdate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Module A: Green Ops (scoped) ─────────────────────────────────
app.post('/api/events/:id/green-ops', requireAuth, async (req, res) => {
  try {
    const hasAccess = await checkEventOwnership(req.params.id, req.user.organisation_id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access Denied: Event does not belong to your organization.' });
    }

    const flat = req.body;
    const row = {
      event_id:                   req.params.id,
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
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('saveGreenOps error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Module B: Health, Safety & Labour (scoped) ──────────────────
app.post('/api/events/:id/health-safety', requireAuth, async (req, res) => {
  try {
    const hasAccess = await checkEventOwnership(req.params.id, req.user.organisation_id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access Denied: Event does not belong to your organization.' });
    }

    const flat = req.body;
    const permanent = Number(flat.staff_permanent_count) || 0;
    const contract  = Number(flat.staff_contractor_count) || 0;
    const row = {
      event_id:                   req.params.id,
      work_related_fatalities:    Number(flat.fatalities_count)      || 0,
      lti_count:                  Number(flat.lti_count)             || 0,
      total_hours_worked:         Number(flat.man_hours_actual)      || 0,
      safety_training_headcount:  Number(flat.safety_trained_count)  || 0,
      total_headcount:            resolveTotalHeadcount(flat, permanent, contract),
      contract_temp_count:        contract,
      human_rights_complaints:    Number(flat.hr_complaints_count)   || 0,
      training_hours_total:       Number(flat.training_hours_total)  || 0,
      employee_turnover_count:    Number(flat.turnover_count)        || 0,
    };
    const { error } = await supabase
      .from('module_health_safety_labour')
      .upsert(row, { onConflict: 'event_id' });
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('saveHealthSafety error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Module C: Procurement & Community (scoped) ──────────────────
app.post('/api/events/:id/procurement', requireAuth, async (req, res) => {
  try {
    const hasAccess = await checkEventOwnership(req.params.id, req.user.organisation_id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access Denied: Event does not belong to your organization.' });
    }

    const flat = req.body;
    const row = {
      event_id:                   req.params.id,
      total_procurement_spend_rm: Number(flat.procurement_total_rm)  || 0,
      local_supplier_spend_rm:    Number(flat.local_supplier_spend_rm) || 0,
      community_investment_rm:    Number(flat.community_invest_rm)   || 0,
      community_beneficiaries:    Number(flat.community_beneficiaries) || 0,
      privacy_breaches_count:     Number(flat.data_breach_complaints) || 0,
    };
    const { error } = await supabase
      .from('module_procurement_community')
      .upsert(row, { onConflict: 'event_id' });
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('saveProcurement error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Event Financials (scoped) ────────────────────────────────────
app.post('/api/events/:id/financials', requireAuth, async (req, res) => {
  try {
    const hasAccess = await checkEventOwnership(req.params.id, req.user.organisation_id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access Denied: Event does not belong to your organization.' });
    }

    const flat = req.body;
    const row = {
      event_id:          req.params.id,
      budget_estimated:  Number(flat.budget_estimated)  || 0,
      budget_actual:     Number(flat.budget_actual)     || 0,
      revenue_estimated: Number(flat.revenue_estimated) || 0,
      revenue_actual:    Number(flat.revenue_actual)    || 0,
      green_spend_rm:    Number(flat.green_spend_rm)    || 0,
    };
    const { error } = await supabase
      .from('event_financials')
      .upsert(row, { onConflict: 'event_id' });
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('saveEventFinancials error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Event Timeline (scoped) ──────────────────────────────────────
app.post('/api/events/:id/timeline', requireAuth, async (req, res) => {
  try {
    const hasAccess = await checkEventOwnership(req.params.id, req.user.organisation_id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access Denied: Event does not belong to your organization.' });
    }

    const flat = req.body;
    const row = {
      event_id:           req.params.id,
      project_start_date: flat.project_start_date || null,
      planned_end_date:   flat.project_end_planned || null,
      // timeline_actual_end_date is the UI's field key; event_end_date is kept
      // only as a fallback for older callers that used the original key name.
      // `||`, not `??` — EditableModule's draft defaults an untouched field to
      // '' (not null/undefined), and '' must also fall through to the next
      // candidate or Postgres rejects it ("invalid input syntax for type date").
      actual_end_date:    flat.timeline_actual_end_date || flat.event_end_date || null,
      tasks_total:        Number(flat.tasks_total)    || 0,
      tasks_on_time:      Number(flat.tasks_on_time)  || 0,
      team_size:          Number(flat.team_size_total) || 0,
    };
    const { error } = await supabase
      .from('event_timeline')
      .upsert(row, { onConflict: 'event_id' });
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('saveEventTimeline error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Event Attendance (scoped) ────────────────────────────────────
app.post('/api/events/:id/attendance', requireAuth, async (req, res) => {
  try {
    const hasAccess = await checkEventOwnership(req.params.id, req.user.organisation_id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access Denied: Event does not belong to your organization.' });
    }

    const flat = req.body;
    const row = {
      event_id:            req.params.id,
      expected_attendance: Number(flat.expected_attendance) || 0,
      actual_attendance:   Number(flat.actual_attendance)   || 0,
    };
    const { error } = await supabase
      .from('event_attendance')
      .upsert(row, { onConflict: 'event_id' });
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('saveEventAttendance error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Corporate Governance (scoped) ──────────────────────────────
// Distinct reporting years that actually have governance data — used by the
// frontend's year-default heuristic, which must not confuse "an event exists
// for year X" (module_events) with "governance data exists for year X"
// (module_strategy_risk / module_hr_diversity / module_climate_finance).
app.get('/api/governance/years', requireAuth, async (req, res) => {
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

app.get('/api/governance', requireAuth, async (req, res) => {
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

app.post('/api/governance', requireAuth, async (req, res) => {
  try {
    const govData = req.body;
    const year = req.query.year || '2025';

    const strategy = {}, hr = {}, climate = {};
    Object.entries(govData).forEach(([k, v]) => {
      if (STRATEGY_KEYS.has(k)) strategy[k] = v;
      else if (HR_KEYS.has(k))  hr[k] = v;
      else                      climate[k] = v;
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

// ── App Settings (global read/write) ──────────────────────────────
app.get('/api/settings', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('app_settings').select('*').limit(1).single();
    if (error) throw error;
    res.json(data?.data || {});
  } catch (err) {
    console.error('getSettings error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', requireAuth, async (req, res) => {
  try {
    const settingsData = req.body;
    const { data: existing } = await supabase
      .from('app_settings').select('id').limit(1).single();
    if (existing?.id) {
      const { error } = await supabase
        .from('app_settings').update({ data: settingsData }).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('app_settings').insert({ data: settingsData });
      if (error) throw error;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('saveSettings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
