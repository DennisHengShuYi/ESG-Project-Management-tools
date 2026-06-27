import { checkEventOwnership } from '../utils/checkEventOwnership.js';

// Verifies req.params.id refers to an event belonging to req.user's
// organisation. Must run after requireAuth.
export const requireEventOwnership = async (req, res, next) => {
  const hasAccess = await checkEventOwnership(req.params.id, req.user.organisation_id);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access Denied: Event does not belong to your organization.' });
  }
  next();
};
