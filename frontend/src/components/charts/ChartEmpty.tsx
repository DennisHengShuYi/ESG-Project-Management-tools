import { ReactNode } from 'react';
import { Cloud } from 'lucide-react';

interface ChartEmptyProps {
  message?: string;
  icon?: ReactNode;
}

const ChartEmpty = ({ message = 'No event data for selected year', icon }: ChartEmptyProps) => (
  <div className="chart-empty">
    {icon ?? <Cloud size={32} className="text-tertiary" />}
    <p>{message}</p>
  </div>
);

export default ChartEmpty;
