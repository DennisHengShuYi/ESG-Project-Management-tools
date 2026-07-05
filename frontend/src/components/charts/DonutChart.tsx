import { ResponsiveContainer, PieChart, Pie, Tooltip, Legend } from 'recharts';
import ChartEmpty from './ChartEmpty';
import { TOOLTIP_STYLE } from './chartTheme';

interface DonutSlice {
  name: string;
  value: number;
  fill: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  height?: number;
  valueSuffix?: string;
  innerRadius?: number;
  outerRadius?: number;
  emptyMessage?: string;
}

const DonutChart = ({
  data,
  height = 220,
  valueSuffix = '',
  innerRadius = 45,
  outerRadius = 70,
  emptyMessage,
}: DonutChartProps) => {
  if (!data || data.length === 0) return <ChartEmpty message={emptyMessage} />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={3}
          dataKey="value"
        />
        <Tooltip formatter={(v: number) => `${v}${valueSuffix}`} contentStyle={TOOLTIP_STYLE} />
        <Legend
          verticalAlign="bottom"
          height={40}
          iconSize={9}
          wrapperStyle={{ fontSize: 11, paddingTop: 10, lineHeight: 1.6 }}
          formatter={(value: string, entry: any) => `${value}: ${entry?.payload?.value ?? ''}${valueSuffix}`}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default DonutChart;
