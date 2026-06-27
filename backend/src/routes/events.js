import express from 'express';
import { supabase } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { requireEventOwnership } from '../middleware/requireEventOwnership.js';
import { checkEventOwnership } from '../utils/checkEventOwnership.js';
import {
  mapGreenOps,
  mapHealthSafety,
  mapProcurement,
  mapFinancials,
  mapTimeline,
  mapAttendance,
} from '../utils/eventModules.js';

const router = express.Router();
router.use(requireAuth);

// ── Events (core fields, scoped) ─────────────────────────────────
router.get('/', async (req, res) => {
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
// Must be registered before '/:id' so 'full' isn't swallowed by the wildcard.
router.get('/full', async (req, res) => {
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
router.get('/:id', async (req, res) => {
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
router.post('/', async (req, res) => {
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
      // Verify ownership first — id comes from the body here, not a :id
      // param, so the requireEventOwnership router middleware can't apply.
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
router.delete('/:id', requireEventOwnership, async (req, res) => {
  try {
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
router.post('/:id/bulk-update', requireEventOwnership, async (req, res) => {
  try {
    const flat = req.body;
    const eventId = req.params.id;

    const results = await Promise.allSettled([
      supabase.from('module_green_ops').upsert({ event_id: eventId, ...mapGreenOps(flat) }, { onConflict: 'event_id' }),
      supabase.from('module_health_safety_labour').upsert({ event_id: eventId, ...mapHealthSafety(flat) }, { onConflict: 'event_id' }),
      supabase.from('module_procurement_community').upsert({ event_id: eventId, ...mapProcurement(flat) }, { onConflict: 'event_id' }),
      supabase.from('event_financials').upsert({ event_id: eventId, ...mapFinancials(flat) }, { onConflict: 'event_id' }),
      supabase.from('event_timeline').upsert({ event_id: eventId, ...mapTimeline(flat) }, { onConflict: 'event_id' }),
      supabase.from('event_attendance').upsert({ event_id: eventId, ...mapAttendance(flat) }, { onConflict: 'event_id' }),
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
router.post('/:id/green-ops', requireEventOwnership, async (req, res) => {
  try {
    const row = { event_id: req.params.id, ...mapGreenOps(req.body) };
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
router.post('/:id/health-safety', requireEventOwnership, async (req, res) => {
  try {
    const row = { event_id: req.params.id, ...mapHealthSafety(req.body) };
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
router.post('/:id/procurement', requireEventOwnership, async (req, res) => {
  try {
    const row = { event_id: req.params.id, ...mapProcurement(req.body) };
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
router.post('/:id/financials', requireEventOwnership, async (req, res) => {
  try {
    const row = { event_id: req.params.id, ...mapFinancials(req.body) };
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
router.post('/:id/timeline', requireEventOwnership, async (req, res) => {
  try {
    const row = { event_id: req.params.id, ...mapTimeline(req.body) };
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
router.post('/:id/attendance', requireEventOwnership, async (req, res) => {
  try {
    const row = { event_id: req.params.id, ...mapAttendance(req.body) };
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

export default router;
