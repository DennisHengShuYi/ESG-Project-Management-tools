import { ReactNode } from 'react';

interface DisclosureStatusBadge {
  label: string;
  variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

interface DisclosureCardProps {
  title: string;
  icon?: ReactNode;
  statusBadge?: DisclosureStatusBadge;
  children: ReactNode;
}

const DisclosureCard = ({ title, icon, statusBadge, children }: DisclosureCardProps) => (
  <div className="glass-card gov-section">
    <div className="disclosure-card-header">
      <h3>
        {icon}
        {title}
      </h3>
      {statusBadge && (
        <span className={`badge badge-${statusBadge.variant}`}>{statusBadge.label}</span>
      )}
    </div>
    {children}
  </div>
);

export default DisclosureCard;
