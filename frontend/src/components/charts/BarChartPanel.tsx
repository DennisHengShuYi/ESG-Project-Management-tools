import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import ChartEmpty from './ChartEmpty';
import ChartTooltip from './ChartTooltip';
import { truncateLabel } from './chartTheme';

interface BarSeries {
  dataKey: string;
  fill: string;
  stackId?: string;
}

interface BarChartPanelProps {
  data: Record<string, any>[];
  series: BarSeries[];
  /** Convenience flag: assigns stackId="a" to every series missing one. */
  stacked?: boolean;
  height?: number;
  xKey?: string;
  yTickFormatter?: (v: number) => string;
  tooltipPrefix?: string;
  tooltipSuffix?: string;
  showLegend?: boolean;
  /** 'vertical' renders horizontal segmented bars — useful for single-row datasets. */
  layout?: 'horizontal' | 'vertical';
  emptyMessage?: string;
}

const BarChartPanel = ({
  data,
  series,
  stacked = false,
  height = 300,
  xKey = 'name',
  yTickFormatter,
  tooltipPrefix = '',
  tooltipSuffix = '',
  showLegend = true,
  layout = 'horizontal',
  emptyMessage,
}: BarChartPanelProps) => {
  if (!data || data.length === 0) return <ChartEmpty message={emptyMessage} />;

  const isStacked = stacked || series.some(s => !!s.stackId);
  const lastIndex = series.length - 1;
  const topRadius: [number, number, number, number] = layout === 'vertical' ? [0, 3, 3, 0] : [3, 3, 0, 0];
  const flatRadius: [number, number, number, number] = [0, 0, 0, 0];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={layout}
        margin={{ top: showLegend ? 20 : 5, right: 10, left: layout === 'vertical' ? 10 : -10, bottom: layout === 'vertical' ? 5 : 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
        {layout === 'vertical' ? (
          <>
            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={yTickFormatter} />
            <YAxis type="category" dataKey={xKey} tick={{ fontSize: 10 }} width={90} />
          </>
        ) : (
          <>
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 10 }}
              tickFormatter={(v: string) => truncateLabel(v, 16)}
              angle={-35}
              textAnchor="end"
              interval={0}
              height={70}
            />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={yTickFormatter} />
          </>
        )}
        <Tooltip content={<ChartTooltip prefix={tooltipPrefix} suffix={tooltipSuffix} />} />
        {showLegend && <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: 8 }} />}
        {series.map((s, i) => {
          const isTop = isStacked ? i === lastIndex : true;
          return (
            <Bar
              key={s.dataKey}
              dataKey={s.dataKey}
              stackId={stacked ? (s.stackId ?? 'a') : s.stackId}
              fill={s.fill}
              radius={isTop ? topRadius : flatRadius}
            />
          );
        })}
      </BarChart>
    </ResponsiveContainer>
  );
};

export default BarChartPanel;
