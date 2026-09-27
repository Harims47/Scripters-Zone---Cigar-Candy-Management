import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface TableEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  onRetry?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  colSpan?: number;
  isError?: boolean;
}

export const TableEmptyState: React.FC<TableEmptyStateProps> = ({
  icon,
  title,
  description,
  onRetry,
  actionLabel,
  onAction,
  colSpan = 10,
  isError = false
}) => {
  return (
    <tr>
      <td
        colSpan={colSpan}
        style={{
          padding: '48px 24px',
          textAlign: 'center',
          background: isError ? '#fff5f5' : '#ffffff'
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            maxWidth: '420px',
            margin: '0 auto'
          }}
        >
          {icon ? (
            icon
          ) : isError ? (
            <AlertCircle size={32} color="#dc2626" />
          ) : (
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8'
              }}
            >
              <AlertCircle size={20} />
            </div>
          )}
          <div
            style={{
              fontSize: '0.95rem',
              fontWeight: 700,
              color: isError ? '#991b1b' : '#334155'
            }}
          >
            {title}
          </div>
          {description && (
            <div style={{ fontSize: '0.82rem', color: isError ? '#b91c1c' : '#64748b', lineHeight: 1.4 }}>
              {description}
            </div>
          )}
          {onRetry && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onRetry}
              style={{
                marginTop: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
                padding: '6px 14px'
              }}
            >
              <RefreshCw size={13} />
              <span>Retry</span>
            </button>
          )}
          {onAction && actionLabel && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onAction}
              style={{
                marginTop: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.82rem',
                fontWeight: 700,
                padding: '6px 16px'
              }}
            >
              <span>{actionLabel}</span>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};
