import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../supabase.js';

const router = express.Router();

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
router.post('/login', async (req, res) => {
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

export default router;
