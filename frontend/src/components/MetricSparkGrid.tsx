import './MetricSparkGrid.css';

interface MetricSparkField {
  key: string;
  label: string;
  unit?: string;
  readOnly?: boolean;
  compute?: (data: any) => any;
}

interface MetricSparkGridProps {
  fields: MetricSparkField[];
  data: any;
  accentColor?: string;
}

const MetricSparkGrid = ({ fields, data = {}, accentColor = '#10B981' }: MetricSparkGridProps) => {
  const displayValue = (field: MetricSparkField) => {
    if (field.compute) return field.compute(data);
    const raw = data[field.key];
    if (raw === null || raw === undefined || raw === '') return '—';
    const formatted = typeof raw === 'number' ? raw.toLocaleString() : raw;
    return field.unit ? `${formatted} ${field.unit}` : String(formatted);
  };

  return (
    <div className="spark-grid">
      {fields.map(field => (
        <div key={field.key} className="spark-card" style={{ '--accent': accentColor } as React.CSSProperties}>
          <span className="spark-label">{field.label}</span>
          <div className="spark-value-row">
            <span className="spark-value">{displayValue(field)}</span>
            {field.readOnly && <span className="spark-badge">AUTO</span>}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MetricSparkGrid;
