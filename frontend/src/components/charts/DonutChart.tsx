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
  innerRadius = 55,
  outerRadius = 85,
  emptyMessage,
}: DonutChartProps) => {
  if (!data || data.length === 0) return <ChartEmpty message={emptyMessage} />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={3}
          dataKey="value"
          label={({ name, value }) => `${name}: ${value}${valueSuffix}`}
          labelLine={false}
        />
        <Tooltip formatter={(v) => `${v}${valueSuffix}`} contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default DonutChart;
