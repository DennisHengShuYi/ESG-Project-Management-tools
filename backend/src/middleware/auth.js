import jwt from 'jsonwebtoken';
import { supabase } from '../supabase.js';

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];

    // Verify the JWT token locally
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token payload' });
    }

    // Role/module_permissions/is_active are looked up fresh on every request
    // rather than trusted from the JWT — the token can live up to 24h, and a
    // permission change or deactivation by an admin must take effect
    // immediately, not only after the token expires.
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('role, module_permissions, is_active, full_name, organisation:organisations ( name )')
      .eq('id', decoded.id)
      .maybeSingle();

    if (userError || !userRow) {
      return res.status(401).json({ error: 'Unauthorized: User no longer exists' });
    }
    if (userRow.is_active === false) {
      return res.status(401).json({ error: 'Unauthorized: Account has been deactivated' });
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      organisation_id: decoded.organisation_id,
      organisation_name: userRow.organisation?.name || null,
      role: userRow.role || 'member',
      module_permissions: userRow.module_permissions || {},
      full_name: userRow.full_name || null,
    };

    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Internal server error during auth verification' });
  }
};
