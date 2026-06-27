import express from 'express';
import { supabase } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
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

router.post('/', async (req, res) => {
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

export default router;
