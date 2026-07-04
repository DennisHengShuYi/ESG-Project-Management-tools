// Per-module read/write enforcement. Admins bypass every check here — see
// plan.md §2/§4 for the full design. `req.user.module_permissions` is
// populated fresh per request by middleware/auth.js, not trusted from a
// long-lived JWT claim, so a permission change takes effect immediately.

/** Shared check used by both the middleware below and ad-hoc route logic
 * (e.g. governance.js, which has to check multiple modules in one request). */
export function hasPermission(user, moduleKey, level = 'write') {
  if (user.role === 'admin') return true;
  const perm = user.module_permissions?.[moduleKey];
  if (level === 'read') return !!(perm?.read || perm?.write);
  return !!perm?.write;
}

export const requirePermission = (moduleKey, level = 'write') => (req, res, next) => {
  if (hasPermission(req.user, moduleKey, level)) return next();
  res.status(403).json({ error: `No ${level} access to ${moduleKey}.` });
};

export const requireRole = (role) => (req, res, next) => {
  if (req.user.role === role) return next();
  res.status(403).json({ error: `Requires ${role} role.` });
};
