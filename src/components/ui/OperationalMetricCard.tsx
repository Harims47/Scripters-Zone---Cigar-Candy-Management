import React from 'react';

export type MetricSemanticColor = 'blue' | 'emerald' | 'amber' | 'purple' | 'red' | 'slate';

export interface OperationalContextItem {
  label: string;
  value: string | number;
  highlight?: boolean;
  color?: string;
}

export interface OperationalMetricCardProps {
  label: string;
  value: string | number;
  supporting?: React.ReactNode;
  contextItems?: OperationalContextItem[];
  customContext?: React.ReactNode;
  icon?: React.ReactNode;
  semanticColor?: MetricSemanticColor;
  alert?: boolean;
  onClick?: () => void;
  className?: string;
}

export const OperationalMetricCard: React.FC<OperationalMetricCardProps> = ({
  label,
  value,
  supporting,
  contextItems,
  customContext,
  icon,
  semanticColor = 'slate',
  alert = false,
  onClick,
  className = ''
}) => {
  const colorSchemes = {
    blue: {
      cardBg: '#ffffff',
      topBorder: '#3b82f6',
      subtleTint: 'linear-gradient(180deg, #f0f7ff 0%, #ffffff 42px)',
      labelColor: '#1e40af',
      valueColor: '#1d4ed8',
      iconContainerBg: '#eff6ff',
      iconContainerBorder: '#bfdbfe',
      iconColor: '#2563eb',
      dividerColor: '#eff6ff'
    },
    emerald: {
      cardBg: '#ffffff',
      topBorder: '#10b981',
      subtleTint: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 42px)',
      labelColor: '#065f46',
      valueColor: '#047857',
      iconContainerBg: '#ecfdf5',
      iconContainerBorder: '#a7f3d0',
      iconColor: '#059669',
      dividerColor: '#ecfdf5'
    },
    amber: {
      cardBg: '#ffffff',
      topBorder: '#f59e0b',
      subtleTint: 'linear-gradient(180deg, #fffbeb 0%, #ffffff 42px)',
      labelColor: '#92400e',
      valueColor: '#b45309',
      iconContainerBg: '#fffbeb',
      iconContainerBorder: '#fde68a',
      iconColor: '#d97706',
      dividerColor: '#fef3c7'
    },
    purple: {
      cardBg: '#ffffff',
      topBorder: '#8b5cf6',
      subtleTint: 'linear-gradient(180deg, #faf5ff 0%, #ffffff 42px)',
      labelColor: '#581c87',
      valueColor: '#6d28d9',
      iconContainerBg: '#faf5ff',
      iconContainerBorder: '#e9d5ff',
      iconColor: '#7c3aed',
      dividerColor: '#f3e8ff'
    },
    red: {
      cardBg: '#ffffff',
      topBorder: '#ef4444',
      subtleTint: 'linear-gradient(180deg, #fef2f2 0%, #ffffff 42px)',
      labelColor: '#991b1b',
      valueColor: '#dc2626',
      iconContainerBg: '#fef2f2',
      iconContainerBorder: '#fca5a5',
      iconColor: '#ef4444',
      dividerColor: '#fee2e2'
    },
    slate: {
      cardBg: '#ffffff',
      topBorder: '#94a3b8',
      subtleTint: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 42px)',
      labelColor: '#475569',
      valueColor: '#0f172a',
      iconContainerBg: '#f1f5f9',
      iconContainerBorder: '#e2e8f0',
      iconColor: '#64748b',
      dividerColor: '#f1f5f9'
    }
  };

  const scheme = alert ? colorSchemes.red : colorSchemes[semanticColor] || colorSchemes.slate;

  return (
    <div
      className={`operational-metric-card ${alert ? 'alert' : ''} ${className}`}
      onClick={onClick}
      style={{
        background: scheme.subtleTint,
        border: alert ? '1px solid #fca5a5' : '1px solid #e2e8f0',
        borderTop: `3px solid ${scheme.topBorder}`,
        borderRadius: '12px',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative'
      }}
    >
      <div>
        {/* Top Header: Label & Colored Icon Container */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px'
          }}
        >
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: scheme.labelColor
            }}
          >
            {label}
          </span>
          {icon && (
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: scheme.iconContainerBg,
                border: `1px solid ${scheme.iconContainerBorder}`,
                color: scheme.iconColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {icon}
            </div>
          )}
        </div>

        {/* Primary Value: Dominates card with semantic color */}
        <div
          style={{
            fontSize: '1.95rem',
            fontWeight: 800,
            color: scheme.valueColor,
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {value}
        </div>

        {/* Supporting Context Text */}
        {supporting && (
          <div
            style={{
              fontSize: '0.84rem',
              color: '#475569',
              marginTop: '5px',
              lineHeight: 1.4,
              fontWeight: 500
            }}
          >
            {supporting}
          </div>
        )}
      </div>

      {/* Thin Divider & Bottom Contextual Row (Explains the number) */}
      {(contextItems || customContext) && (
        <div style={{ marginTop: '14px' }}>
          <div
            style={{
              height: '1px',
              background: '#f1f5f9',
              marginBottom: '10px'
            }}
          />
          {customContext ? (
            customContext
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.78rem',
                color: '#475569',
                gap: '10px'
              }}
            >
              {contextItems?.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontVariantNumeric: 'tabular-nums'
                  }}
                >
                  <span
                    style={{
                      fontWeight: 700,
                      color: item.color || scheme.valueColor
                    }}
                  >
                    {item.value}
                  </span>
                  <span style={{ color: '#64748b' }}>{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
