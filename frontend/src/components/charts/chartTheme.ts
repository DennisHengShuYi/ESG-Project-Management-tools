/* ── Shared chart color tokens & helpers ──────────────────────────────
   Muted siblings of the app's "Field Ledger" palette (see index.css) —
   distinguishable from each other in a bar/donut series while cohering
   with the warm, paper-and-moss identity rather than clashing bright
   SaaS defaults against it. */
export const CHART_COLORS = {
  green:  '#3D7A54', // success green
  blue:   '#3A6EA5', // denim
  amber:  '#B8923F', // brass, lifted slightly for chart legibility
  red:    '#B23A2B', // brick
  purple: '#7A5C8F', // muted plum
  pink:   '#B25C7A', // muted rose
  teal:   '#3D7A6E', // muted teal
};

export const TOOLTIP_STYLE = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  fontSize: '12px',
  color: 'var(--text-primary)',
};

/* Truncate a label for chart axes / legends */
export const truncateLabel = (name?: string, max = 14): string =>
  name && name.length > max ? name.substring(0, max) + '…' : (name || '—');
