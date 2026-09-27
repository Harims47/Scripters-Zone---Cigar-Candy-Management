import React from 'react';

export interface OperationalNoteProps {
  title?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  variant?: 'neutral' | 'amber' | 'blue' | 'purple' | 'emerald';
  action?: React.ReactNode;
  className?: string;
}

export const OperationalNote: React.FC<OperationalNoteProps> = ({
  title,
  children,
  icon,
  variant = 'neutral',
  action,
  className = ''
}) => {
  const variantStyles = {
    blue: {
      bg: '#f0f4ff',
      border: '#c7d2fe',
      titleColor: '#3730a3',
      iconBg: '#e0e7ff',
      iconColor: '#4338ca',
      textColor: '#1e293b'
    },
    amber: {
      bg: '#fffbeb',
      border: '#fde68a',
      titleColor: '#92400e',
      iconBg: '#fef3c7',
      iconColor: '#b45309',
      textColor: '#451a03'
    },
    purple: {
      bg: '#faf5ff',
      border: '#e9d5ff',
      titleColor: '#581c87',
      iconBg: '#f3e8ff',
      iconColor: '#7e22ce',
      textColor: '#3b0764'
    },
    emerald: {
      bg: '#f0fdf4',
      border: '#bbf7d0',
      titleColor: '#14532d',
      iconBg: '#dcfce7',
      iconColor: '#15803d',
      textColor: '#052e16'
    },
    neutral: {
      bg: '#f8fafc',
      border: '#e2e8f0',
      titleColor: '#1e293b',
      iconBg: '#e2e8f0',
      iconColor: '#475569',
      textColor: '#334155'
    }
  }[variant];

  return (
    <div
      className={`operational-note ${className}`}
      style={{
        background: variantStyles.bg,
        border: `1px solid ${variantStyles.border}`,
        borderRadius: '10px',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '14px',
        margin: '16px 0'
      }}
    >
      {icon && (
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: variantStyles.iconBg,
            color: variantStyles.iconColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: '1px'
          }}
        >
          {icon}
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <div
            style={{
              fontSize: '0.74rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: variantStyles.titleColor,
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>◈</span>
            <span>{title}</span>
          </div>
        )}
        <div
          style={{
            fontSize: '0.85rem',
            lineHeight: 1.55,
            color: variantStyles.textColor || '#1e293b'
          }}
        >
          {children}
        </div>
      </div>

      {action && <div style={{ flexShrink: 0, alignSelf: 'center' }}>{action}</div>}
    </div>
  );
};
