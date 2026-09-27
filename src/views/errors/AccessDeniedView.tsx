import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { useHub } from '../../context/HubContext';

export const AccessDeniedView: React.FC = () => {
  const navigate = useNavigate();
  const { activeSession } = useHub();

  const handleReturn = () => {
    if (activeSession.role === 'ADMIN') {
      navigate('/dashboard');
    } else {
      navigate('/salesman/dashboard');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '32px 16px',
        textAlign: 'center'
      }}
    >
      <div
        style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '2px solid rgba(239, 68, 68, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
          color: '#ef4444'
        }}
      >
        <ShieldAlert size={36} />
      </div>

      <div
        style={{
          fontSize: '0.8rem',
          fontWeight: 800,
          color: '#ef4444',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: '8px'
        }}
      >
        HTTP 403 Forbidden
      </div>

      <h1
        style={{
          fontSize: '1.75rem',
          fontWeight: 800,
          color: '#0f172a',
          margin: '0 0 12px 0'
        }}
      >
        Access Denied
      </h1>

      <p
        style={{
          fontSize: '0.95rem',
          color: '#64748b',
          maxWidth: '460px',
          lineHeight: 1.6,
          margin: '0 0 24px 0'
        }}
      >
        You do not have administrative permission to view this module. Your current role (
        <strong style={{ color: '#0f172a' }}>{activeSession.role}</strong>
        ) is restricted from direct access to this management route.
      </p>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleReturn}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            fontSize: '0.9rem',
            fontWeight: 700
          }}
        >
          <LayoutDashboard size={16} />
          <span>Return to {activeSession.role === 'ADMIN' ? 'Dashboard' : 'My Portal'}</span>
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => window.history.back()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            fontSize: '0.9rem',
            fontWeight: 600
          }}
        >
          <ArrowLeft size={16} />
          <span>Go Back</span>
        </button>
      </div>
    </div>
  );
};
