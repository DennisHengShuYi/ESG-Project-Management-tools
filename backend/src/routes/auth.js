import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Fields the frontend needs for permission-aware UI (hiding buttons the
// backend would 403 on anyway). Real enforcement always happens
// server-side in middleware/permissions.js — this is just for display.
router.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});

// Fetch list of organisations
router.get('/organisations', async (req, res) => {
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
router.post('/register', async (req, res) => {
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
    const { data: existingUser } = await supabase
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

    // First person to register into an organisation with no admin yet
    // becomes its admin — mirrors the migration-time bootstrap in
    // schema.sql for any organisation created after that migration ran.
    const { count: adminCount } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('organisation_id', organisation_id)
      .eq('role', 'admin');
    const role = (adminCount || 0) === 0 ? 'admin' : 'member';

    // Insert user
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        email,
        password_hash,
        organisation_id,
        role,
      })
      .select('id, email, organisation_id, role, module_permissions, full_name')
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
      user: newUser,
    });
  } catch (err) {
    console.error('register error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Fetch user
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id, email, password_hash, organisation_id, role, module_permissions, full_name, is_active')
      .eq('email', email)
      .maybeSingle();

    if (fetchError || !user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    if (user.is_active === false) {
      return res.status(403).json({ error: 'This account has been deactivated. Contact your admin.' });
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

    supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id)
      .then(({ error }) => { if (error) console.error('updateLastLogin error:', error); });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        organisation_id: user.organisation_id,
        role: user.role,
        module_permissions: user.module_permissions,
        full_name: user.full_name,
      }
    });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
