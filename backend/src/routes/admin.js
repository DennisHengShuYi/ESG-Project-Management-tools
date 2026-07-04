import express from 'express';
import bcrypt from 'bcryptjs';
import { supabase } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/permissions.js';
import { logAudit } from '../utils/auditLog.js';

const router = express.Router();
router.use(requireAuth);
router.use(requireRole('admin'));

const USER_COLUMNS = 'id, email, full_name, role, module_permissions, is_active, last_login_at, created_at';

// ── Team management ───────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select(USER_COLUMNS)
      .eq('organisation_id', req.user.organisation_id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('adminGetUsers error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/users', async (req, res) => {
  try {
    const { email, password, full_name, role, module_permissions } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const { data: existingUser } = await supabase
      .from('users').select('id').eq('email', email).maybeSingle();
    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        email,
        password_hash,
        organisation_id: req.user.organisation_id,
        full_name: full_name || null,
        role: role === 'admin' ? 'admin' : 'member',
        module_permissions: module_permissions || {},
        is_active: true,
      })
      .select(USER_COLUMNS)
      .single();
    if (error) throw error;

    await logAudit(req, { action: 'create', module: 'admin', table: 'users', recordId: newUser.id, after: newUser });
    res.status(201).json(newUser);
  } catch (err) {
    console.error('adminCreateUser error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/users/:id', async (req, res) => {
  try {
    const targetId = req.params.id;
    const { data: target } = await supabase
      .from('users').select(USER_COLUMNS)
      .eq('id', targetId).eq('organisation_id', req.user.organisation_id).maybeSingle();
    if (!target) return res.status(404).json({ error: 'User not found.' });

    const { role, module_permissions, is_active, full_name } = req.body;

    // Guard: never let the org end up with zero active admins.
    const wouldDemote      = target.role === 'admin' && role !== undefined && role !== 'admin';
    const wouldDeactivate  = target.role === 'admin' && is_active === false;
    if (wouldDemote || wouldDeactivate) {
      const { count } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('organisation_id', req.user.organisation_id)
        .eq('role', 'admin')
        .eq('is_active', true);
      if ((count || 0) <= 1) {
        return res.status(400).json({ error: 'Cannot demote or deactivate the last remaining admin.' });
      }
    }

    const updates = {};
    if (role !== undefined)               updates.role = role === 'admin' ? 'admin' : 'member';
    if (module_permissions !== undefined) updates.module_permissions = module_permissions;
    if (is_active !== undefined)          updates.is_active = !!is_active;
    if (full_name !== undefined)          updates.full_name = full_name;

    const { data: updated, error } = await supabase
      .from('users').update(updates).eq('id', targetId).select(USER_COLUMNS).single();
    if (error) throw error;

    await logAudit(req, { action: 'update', module: 'admin', table: 'users', recordId: targetId, before: target, after: updated });
    res.json(updated);
  } catch (err) {
    console.error('adminUpdateUser error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Activity log ───────────────────────────────────────────────────
router.get('/audit-log', async (req, res) => {
  try {
    const { module, user_id, from, to, page = '1', pageSize = '50' } = req.query;

    let query = supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .eq('organisation_id', req.user.organisation_id);
    if (module)  query = query.eq('module', module);
    if (user_id) query = query.eq('user_id', user_id);
    if (from)    query = query.gte('created_at', from);
    if (to)      query = query.lte('created_at', to);

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const size    = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 50));
    const start   = (pageNum - 1) * size;
    query = query.order('created_at', { ascending: false }).range(start, start + size - 1);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ rows: data, total: count, page: pageNum, pageSize: size });
  } catch (err) {
    console.error('adminGetAuditLog error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Org settings (retired Settings.tsx content — admin-only) ──────
// Shares the same app_settings singleton row as /api/settings (SDG
// thresholds + tracked goals), so writes here merge into the existing
// blob rather than replacing it wholesale — otherwise saving org config
// would silently wipe out unrelated SDG settings stored in the same row.
router.get('/org-settings', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('app_settings').select('*').limit(1).single();
    if (error) throw error;
    res.json(data?.data || {});
  } catch (err) {
    console.error('adminGetOrgSettings error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/org-settings', async (req, res) => {
  try {
    const incoming = req.body;
    const { data: existing } = await supabase
      .from('app_settings').select('id, data').limit(1).single();

    if (existing?.id) {
      const merged = { ...(existing.data || {}), ...incoming };
      const { error } = await supabase.from('app_settings').update({ data: merged }).eq('id', existing.id);
      if (error) throw error;
      await logAudit(req, {
        action: 'update', module: 'settings', table: 'app_settings', recordId: existing.id,
        before: existing.data, after: merged,
      });
    } else {
      const { data, error } = await supabase.from('app_settings').insert({ data: incoming }).select().single();
      if (error) throw error;
      await logAudit(req, {
        action: 'create', module: 'settings', table: 'app_settings', recordId: data.id, after: incoming,
      });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('adminSaveOrgSettings error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
