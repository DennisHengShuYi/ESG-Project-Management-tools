import { LucideIcon } from 'lucide-react';
import { CHART_COLORS } from './chartTheme';

interface KpiTrend {
  pct: string;
  positive: boolean;
}

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  color?: string;
  bg?: string;
  trend?: KpiTrend | null;
  goodWhenUp?: boolean;
  /** Zero-tolerance mode (fatalities, breaches, complaints, incidents): no trend/tint decoration, red if >0 else green. */
  severity?: boolean;
  trendSuffix?: string;
}

const KpiCard = ({
  label,
  value,
  sub,
  icon: Icon,
  color = CHART_COLORS.green,
  bg,
  trend,
  goodWhenUp = true,
  severity = false,
  trendSuffix = '',
}: KpiCardProps) => {
  const isBreach = severity && Number(value) > 0;
  const severityColor = isBreach ? CHART_COLORS.red : CHART_COLORS.green;
  const resolvedColor = severity ? severityColor : color;
  const resolvedBg = severity ? 'transparent' : (bg ?? 'transparent');

  return (
    <div className={`kpi-card glass-card ${severity ? 'kpi-severity' : ''}`}>
      {Icon && !severity && (
        <div className="kpi-icon-wrap" style={{ backgroundColor: resolvedBg }}>
          <Icon size={20} style={{ color: resolvedColor }} />
        </div>
      )}
      <div className="kpi-body">
        <span className="kpi-value" style={{ color: resolvedColor }}>{value}</span>
        <span className="kpi-label">{label}</span>
        {(sub || severity) && <span className="kpi-sub">{sub ?? 'Target: 0'}</span>}
        {!severity && trend && (
          <span className={`kpi-trend ${trend.positive === goodWhenUp ? 'kpi-trend-good' : 'kpi-trend-bad'}`}>
            {trend.positive ? '↑' : '↓'} {trend.pct}{trendSuffix}
          </span>
        )}
      </div>
    </div>
  );
};

export default KpiCard;
