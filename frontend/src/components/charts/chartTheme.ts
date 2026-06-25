/* ── Shared chart color tokens & helpers ──────────────────────────── */
export const CHART_COLORS = {
  green:  '#10B981',
  blue:   '#3B82F6',
  amber:  '#F59E0B',
  red:    '#EF4444',
  purple: '#8B5CF6',
  pink:   '#EC4899',
  teal:   '#14B8A6',
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
