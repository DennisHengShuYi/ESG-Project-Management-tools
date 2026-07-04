import { supabase } from '../supabase.js';

// Fields that change on every write regardless of what the user actually
// edited — including them would make every audit entry noisy with
// "updated_at changed" instead of the fields someone actually meant to change.
const IGNORED_KEYS = new Set([
  'id', 'created_at', 'updated_at', 'organisation_id', 'event_id',
]);

/**
 * Shallow-diffs two flat row objects and returns only the fields that
 * actually changed, as { field: { old, new } }. String-compares values so
 * type drift between what Postgres returns (e.g. numeric) and what was
 * submitted (e.g. string from a form) doesn't register as a false change.
 */
export function diffFields(before = {}, after = {}) {
  const changes = {};
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  keys.forEach(key => {
    if (IGNORED_KEYS.has(key)) return;
    const oldVal = before ? before[key] : undefined;
    const newVal = after ? after[key] : undefined;
    if (String(oldVal ?? '') !== String(newVal ?? '')) {
      changes[key] = { old: oldVal ?? null, new: newVal ?? null };
    }
  });
  return changes;
}

/**
 * Records a single audit_log entry. Never throws — a logging failure must
 * never break the actual save/delete the user is waiting on.
 */
export async function logAudit(req, { action, module, table, recordId, before, after }) {
  try {
    let changes;
    if (action === 'update') {
      changes = diffFields(before, after);
      if (Object.keys(changes).length === 0) return; // no-op save, nothing to record
    } else if (action === 'delete') {
      changes = before || {};
    } else {
      changes = after || {};
    }

    const { error } = await supabase.from('audit_log').insert({
      organisation_id: req.user.organisation_id,
      user_id: req.user.id,
      user_email: req.user.email,
      action,
      module,
      table_name: table,
      record_id: recordId ?? null,
      changes,
    });
    if (error) console.error('logAudit insert error:', error);
  } catch (err) {
    console.error('logAudit error:', err);
  }
}
