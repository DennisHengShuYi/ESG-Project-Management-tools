/**
 * Normalise any common date string into YYYY-MM-DD for PostgreSQL.
 * Handles: YYYY-MM-DD, DD/MM/YYYY, D/M/YYYY, MM/DD/YYYY, DD-MM-YYYY, etc.
 * Returns null for blank or unparseable values.
 */
export const toISODate = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;

  // Already ISO format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or D/M/YYYY  (day first — most common in Malaysia)
  const dmySlash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmySlash) {
    const [, d, m, y] = dmySlash;
    const iso = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    // Validate the date is real
    const dt = new Date(iso);
    if (!isNaN(dt.getTime())) return iso;
  }

  // DD-MM-YYYY or D-M-YYYY
  const dmyDash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmyDash) {
    const [, d, m, y] = dmyDash;
    const iso = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    const dt = new Date(iso);
    if (!isNaN(dt.getTime())) return iso;
  }

  // Try native Date parse as last resort (handles many edge cases).
  // Read back via local getters (not toISOString/UTC) — Date parses
  // non-ISO strings as local midnight, and converting that to UTC can
  // roll the date back a day for positive UTC offsets (e.g. GMT+8).
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
};
