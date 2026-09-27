import React from 'react';
import { Navigate } from 'react-router-dom';
import { useHub } from '../../context/HubContext';

interface PublicRouteProps {
  children: React.ReactNode;
}

export const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { isAuthenticated, isAuthBootstrapping, activeSession } = useHub();

  if (isAuthBootstrapping) {
    return (
      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          color: '#94a3b8'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '1.2rem',
              fontWeight: 700,
              color: '#ffffff',
              marginBottom: '8px'
            }}
          >
            Candy & Cigarette Management System
          </div>
          <div style={{ fontSize: '0.85rem' }}>Verifying secure session...</div>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    const destination = activeSession.role === 'ADMIN' ? '/dashboard' : '/salesman/dashboard';
    return <Navigate to={destination} replace />;
  }

  return <>{children}</>;
};
