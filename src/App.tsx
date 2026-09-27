import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Outlet } from 'react-router-dom';
import { HubProvider, useHub } from './context/HubContext';
import { ToastProvider } from './context/ToastContext';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/routing/ProtectedRoute';
import { PublicRoute } from './components/routing/PublicRoute';
import { AccessDeniedView } from './views/errors/AccessDeniedView';
import { NotFoundPage } from './views/errors/NotFoundPage';

// Admin Views
import { AdminDashboard } from './views/admin/AdminDashboard';
import { HandoverHubView } from './views/admin/HandoverHubView';
import { ProductsCatalogView } from './views/admin/ProductsCatalogView';
import { QuantityIssuesView } from './views/admin/QuantityIssuesView';
import { DealerSalesView } from './views/admin/DealerSalesView';
import { InventoryView } from './views/admin/InventoryView';
import { ExpensesView } from './views/admin/ExpensesView';
import { ReportsView } from './views/admin/ReportsView';
import { StaffDirectoryView } from './views/admin/StaffDirectoryView';
import { StaffAttendanceView } from './views/admin/StaffAttendanceView';
import { SalesmanLedgerView } from './views/admin/SalesmanLedgerView';
import { SalaryManagementView } from './views/admin/SalaryManagementView';
import { SalesTargetsView } from './views/admin/SalesTargetsView';

// Salesman Views
import { SalesmanDashboardView } from './views/salesman/SalesmanDashboardView';
import { SalesmanHandoverView } from './views/salesman/SalesmanHandoverView';

// Authentication
import { LoginPage } from './views/auth/LoginPage';

/**
 * Shell Layout wrapper that renders AppShell around the active child route
 */
const AppShellLayout: React.FC = () => {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
};

/**
 * Role-sensitive Dashboard dispatcher
 */
const DashboardDispatcher: React.FC = () => {
  const { activeSession } = useHub();
  const navigate = useNavigate();

  if (activeSession.role === 'SALESMAN') {
    return <SalesmanDashboardView onNavigate={(tab) => navigate(tab === 'handover' ? '/salesman/handover' : `/${tab}`)} />;
  }

  return <AdminDashboard onNavigate={(tab) => navigate(tab === 'dashboard' ? '/dashboard' : `/${tab}`)} />;
};

/**
 * Role-sensitive Handover dispatcher
 */
const HandoverDispatcher: React.FC = () => {
  const { activeSession } = useHub();

  if (activeSession.role === 'SALESMAN') {
    return <SalesmanHandoverView />;
  }

  return <HandoverHubView />;
};

/**
 * Root Redirect dispatcher
 */
const RootRedirect: React.FC = () => {
  const { activeSession } = useHub();
  const target = activeSession.role === 'ADMIN' ? '/dashboard' : '/salesman/dashboard';
  return <Navigate to={target} replace />;
};

export const AppRoutes: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Routes>
      {/* Public Authentication Route */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />

      {/* Authenticated Root & Application Shell */}
      <Route
        element={
          <ProtectedRoute>
            <AppShellLayout />
          </ProtectedRoute>
        }
      >
        {/* Root URL redirect */}
        <Route path="/" element={<RootRedirect />} />

        {/* Smart Contextual Routes (Admin or Salesman) */}
        <Route path="/dashboard" element={<DashboardDispatcher />} />
        <Route path="/daily-handover" element={<HandoverDispatcher />} />
        <Route path="/handovers" element={<HandoverDispatcher />} />
        <Route path="/handover" element={<HandoverDispatcher />} />

        {/* Dedicated Salesman Routes */}
        <Route
          path="/salesman/dashboard"
          element={
            <ProtectedRoute allowedRoles={['SALESMAN', 'ADMIN']}>
              <SalesmanDashboardView onNavigate={() => navigate('/salesman/handover')} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/salesman/handover"
          element={
            <ProtectedRoute allowedRoles={['SALESMAN', 'ADMIN']}>
              <SalesmanHandoverView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/salesman/history"
          element={
            <ProtectedRoute allowedRoles={['SALESMAN', 'ADMIN']}>
              <SalesmanHandoverView />
            </ProtectedRoute>
          }
        />

        {/* ADMIN-ONLY PROTECTED ROUTES */}
        <Route
          path="/products"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <ProductsCatalogView />
            </ProtectedRoute>
          }
        />

        <Route
          path="/issue-stock"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <QuantityIssuesView onNavigate={(tab) => navigate(`/${tab}`)} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quantity-issues"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <QuantityIssuesView onNavigate={(tab) => navigate(`/${tab}`)} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/sales-targets"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <SalesTargetsView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/targets"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <SalesTargetsView />
            </ProtectedRoute>
          }
        />

        {/* Inventory and Subtabs */}
        <Route
          path="/inventory"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <InventoryView initialTab="STOCK" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/purchases"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <InventoryView initialTab="INVOICES" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase-invoices"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <InventoryView initialTab="INVOICES" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/opening-stock"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <InventoryView initialTab="INITIAL_STOCK" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/movements"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <InventoryView initialTab="LEDGER" />
            </ProtectedRoute>
          }
        />

        {/* Staff, Salesmen, Dealers & Suppliers */}
        <Route
          path="/staff"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <StaffDirectoryView initialRoleFilter="ALL" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/salesmen"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <StaffDirectoryView initialRoleFilter="SALESMAN" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dealers"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <StaffDirectoryView initialRoleFilter="DEALER" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <InventoryView initialTab="STOCK" />
            </ProtectedRoute>
          }
        />

        {/* Attendance, Ledger, Salary, Expenses */}
        <Route
          path="/attendance"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <StaffAttendanceView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/salesman-ledger"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <SalesmanLedgerView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/salary"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <SalaryManagementView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/expenses"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <ExpensesView />
            </ProtectedRoute>
          }
        />

        {/* Reports Hub, P&L, Sales Ledger */}
        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <ReportsView initialTab="SALES_LEDGER" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/pnl"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <ReportsView initialTab="PROFIT_LOSS" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-ledger"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <ReportsView initialTab="SALES_LEDGER" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dealer-sales"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <DealerSalesView />
            </ProtectedRoute>
          }
        />

        {/* Access Denied Route */}
        <Route path="/access-denied" element={<AccessDeniedView />} />

        {/* 404 Route for any unmatched authenticated path */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};

export default function App() {
  return (
    <HubProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </HubProvider>
  );
}
