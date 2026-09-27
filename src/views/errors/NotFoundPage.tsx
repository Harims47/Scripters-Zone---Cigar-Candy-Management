import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, LayoutDashboard, ArrowLeft } from 'lucide-react';
import { useHub } from '../../context/HubContext';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, activeSession } = useHub();

  const handleHome = () => {
    if (!isAuthenticated) {
      navigate('/login');
    } else if (activeSession.role === 'ADMIN') {
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
        minHeight: '70vh',
        padding: '32px 16px',
        textAlign: 'center'
      }}
    >
      <div
        style={{
          width: '76px',
          height: '76px',
          borderRadius: '50%',
          background: 'rgba(99, 102, 241, 0.1)',
          border: '2px solid rgba(99, 102, 241, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
          color: '#6366f1'
        }}
      >
        <Compass size={38} />
      </div>

      <div
        style={{
          fontSize: '0.85rem',
          fontWeight: 800,
          color: '#6366f1',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: '8px'
        }}
      >
        404 — Page Not Found
      </div>

      <h1
        style={{
          fontSize: '2rem',
          fontWeight: 800,
          color: '#0f172a',
          margin: '0 0 12px 0'
        }}
      >
        Page Not Found
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
        The URL route you entered does not exist or may have been moved. Check the address bar or return to your dashboard.
      </p>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleHome}
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
          <span>Return to Dashboard</span>
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
