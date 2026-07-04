import express from 'express';
import { supabase } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { logAudit } from '../utils/auditLog.js';

const router = express.Router();
router.use(requireAuth);

// This endpoint's only remaining frontend consumer is SDGDashboard.tsx
// (thresholds + per-year tracked-goals selection) — the old Settings.tsx
// content (carbon price, framework toggles, etc.) has moved to the
// admin-only /api/admin/org-settings route instead. Gated on the `sdg`
// module rather than requiring admin.
router.get('/', requirePermission('sdg', 'read'), async (req, res) => {
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

router.post('/', requirePermission('sdg', 'write'), async (req, res) => {
  try {
    const incoming = req.body;
    const { data: existing } = await supabase
      .from('app_settings').select('id, data').limit(1).single();
    // Merge rather than replace — this row is shared with the admin-only
    // org-settings route, so a caller that only sends SDG-related keys
    // must not wipe out unrelated org config stored in the same blob.
    if (existing?.id) {
      const merged = { ...(existing.data || {}), ...incoming };
      const { error } = await supabase
        .from('app_settings').update({ data: merged }).eq('id', existing.id);
      if (error) throw error;
      await logAudit(req, {
        action: 'update', module: 'sdg', table: 'app_settings', recordId: existing.id,
        before: existing.data, after: merged,
      });
    } else {
      const { data, error } = await supabase
        .from('app_settings').insert({ data: incoming }).select().single();
      if (error) throw error;
      await logAudit(req, {
        action: 'create', module: 'sdg', table: 'app_settings', recordId: data.id, after: incoming,
      });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('saveSettings error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
