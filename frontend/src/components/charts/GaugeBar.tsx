import { CHART_COLORS } from './chartTheme';

interface GaugeBarProps {
  pct: number;
  color?: string;
  label?: string;
  showLabel?: boolean;
}

const GaugeBar = ({ pct, color = CHART_COLORS.green, label, showLabel = true }: GaugeBarProps) => {
  const clamped = Math.max(0, Math.min(100, Number(pct) || 0));

  // Circular gauge config
  const size = 130;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="gauge-circle-container">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="gauge-circle-svg">
        {/* Track Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-color)"
          strokeWidth={strokeWidth}
        />
        {/* Progress Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.25, 1, 0.5, 1)' }}
        />
      </svg>
      {/* Center value */}
      <div className="gauge-circle-center">
        <span className="gauge-circle-pct">{clamped.toFixed(0)}%</span>
        {showLabel && label && <span className="gauge-circle-label">{label}</span>}
      </div>
    </div>
  );
};

export default GaugeBar;
