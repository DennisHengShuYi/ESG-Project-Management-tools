import { CHART_COLORS } from './chartTheme';

interface GaugeBarProps {
  pct: number;
  color?: string;
  label?: string;
  height?: number;
  showLabel?: boolean;
}

const GaugeBar = ({ pct, color = CHART_COLORS.green, label, height = 6, showLabel = true }: GaugeBarProps) => {
  const clamped = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <div className="gauge-bar">
      <div className="gauge-track" style={{ height }}>
        <div className="gauge-fill" style={{ width: `${clamped}%`, background: color }} />
      </div>
      {showLabel && <span className="gauge-pct-label">{clamped.toFixed(0)}%{label ? ` ${label}` : ''}</span>}
    </div>
  );
};

export default GaugeBar;
