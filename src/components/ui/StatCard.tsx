import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  trend?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  icon,
  iconBg = '#eef2ff',
  iconColor = '#4f46e5'
}) => {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <div
          className="stat-icon-wrapper"
          style={{ background: iconBg, color: iconColor }}
        >
          {icon}
        </div>
      </div>
      <div className="stat-value">{value}</div>
      {subtext && <div className="stat-subtext">{subtext}</div>}
    </div>
  );
};
