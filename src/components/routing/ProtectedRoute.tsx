import React from 'react';
import { Navigate } from 'react-router-dom';
import { useHub } from '../../context/HubContext';
import { AccessDeniedView } from '../../views/errors/AccessDeniedView';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<'ADMIN' | 'SALESMAN'>;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles
}) => {
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

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(activeSession.role)) {
    return <AccessDeniedView />;
  }

  return <>{children}</>;
};
