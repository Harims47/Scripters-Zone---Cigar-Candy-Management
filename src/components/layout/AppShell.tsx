import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useHub } from '../../context/HubContext';
import {
  LayoutDashboard,
  Users,
  Package,
  Receipt,
  ArrowUpRight,
  BarChart3,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  Wallet,
  Truck,
  Clock,
  Target
} from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
  currentTab?: string;
  setCurrentTab?: (tab: string) => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  currentTab,
  setCurrentTab
}) => {
  const {
    activeSession,
    logout
  } = useHub();

  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const pathname = location.pathname;

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  const handleToggleSidebar = () => {
    if (window.innerWidth <= 900) {
      setIsMobileNavOpen((prev) => !prev);
    } else {
      setIsSidebarCollapsed((prev) => !prev);
    }
  };

  // Derive active tab from current URL pathname
  const isTabActive = (tab: string): boolean => {
    switch (tab) {
      case 'dashboard':
        return pathname === '/dashboard' || pathname === '/' || pathname === '/salesman/dashboard';
      case 'handovers':
        return pathname.startsWith('/daily-handover') || pathname.startsWith('/handovers');
      case 'quantity-issues':
        return pathname.startsWith('/issue-stock') || pathname.startsWith('/quantity-issues');
      case 'targets':
        return pathname.startsWith('/sales-targets') || pathname.startsWith('/targets');
      case 'products':
        return pathname.startsWith('/products');
      case 'inventory':
        return pathname.startsWith('/inventory') || pathname.startsWith('/purchase-invoices') || pathname.startsWith('/suppliers');
      case 'attendance':
        return pathname.startsWith('/attendance');
      case 'salesman-ledger':
        return pathname.startsWith('/salesman-ledger');
      case 'salary':
        return pathname.startsWith('/salary');
      case 'staff':
        return pathname.startsWith('/staff') || pathname.startsWith('/salesmen') || pathname.startsWith('/dealers');
      case 'expenses':
        return pathname.startsWith('/expenses');
      case 'reports':
        return pathname.startsWith('/reports') || pathname.startsWith('/sales-ledger');
      case 'handover':
        return (
          pathname.startsWith('/salesman/handover') ||
          pathname.startsWith('/handover') ||
          pathname.startsWith('/salesman/history')
        );
      default:
        return currentTab === tab;
    }
  };

  const handleNavigate = (tab: string) => {
    const routeMap: Record<string, string> = {
      dashboard: activeSession.role === 'ADMIN' ? '/dashboard' : '/salesman/dashboard',
      handovers: '/daily-handover',
      'quantity-issues': '/issue-stock',
      targets: '/sales-targets',
      products: '/products',
      inventory: '/inventory',
      attendance: '/attendance',
      'salesman-ledger': '/salesman-ledger',
      salary: '/salary',
      staff: '/staff',
      expenses: '/expenses',
      reports: '/reports',
      handover: '/salesman/handover',
      history: '/salesman/handover'
    };

    const targetRoute = routeMap[tab] || `/${tab}`;
    navigate(targetRoute);
    if (setCurrentTab) {
      setCurrentTab(tab);
    }
    setIsMobileNavOpen(false);
  };

  // SEO & Document Title synchronization per route
  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'Dashboard',
      '/dashboard': activeSession.role === 'ADMIN' ? 'Dashboard' : 'My Dashboard',
      '/salesman/dashboard': 'My Dashboard',
      '/daily-handover': 'Daily Handover',
      '/handovers': 'Daily Handover',
      '/salesman/handover': "Today's Handover",
      '/handover': "Today's Handover",
      '/issue-stock': 'Issue Stock',
      '/quantity-issues': 'Issue Stock',
      '/sales-targets': 'Sales Targets',
      '/targets': 'Sales Targets',
      '/products': 'Products Catalog',
      '/inventory': 'Inventory & Purchases',
      '/inventory/purchases': 'Purchase Invoices',
      '/purchase-invoices': 'Purchase Invoices',
      '/inventory/opening-stock': 'Opening Stock',
      '/inventory/movements': 'Inventory Movements',
      '/staff': 'Salesmen & Dealers',
      '/salesmen': 'Salesmen Directory',
      '/dealers': 'Dealers Directory',
      '/suppliers': 'Suppliers',
      '/attendance': 'Staff Attendance',
      '/salesman-ledger': 'Salesman Financial Ledger',
      '/salary': 'Salary Management',
      '/expenses': 'Expenses Tracking',
      '/reports': 'Reports Hub',
      '/reports/pnl': 'Profit & Loss Statement',
      '/sales-ledger': 'Sales Ledger Report',
      '/dealer-sales': 'Dealer Sales'
    };

    const matchedTitle = titles[pathname] || 'Management Portal';
    document.title = `${matchedTitle} | Candy & Cigarette Management`;
  }, [pathname, activeSession.role]);

  return (
    <div className="app-layout">
      {/* Mobile Backdrop */}
      {isMobileNavOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsMobileNavOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`app-sidebar ${isSidebarCollapsed ? 'collapsed' : ''} ${isMobileNavOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              className="sidebar-logo-icon"
              style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Package size={22} />
            </div>
            <div>
              <div className="sidebar-brand-title">Candy & Cigarette</div>
              <div className="sidebar-brand-subtitle">Management System</div>
            </div>
          </div>

          <button
            type="button"
            className="sidebar-mobile-close"
            onClick={() => setIsMobileNavOpen(false)}
            title="Close menu"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {activeSession.role === 'ADMIN' ? (
            /* ================= ADMIN NAVIGATION (Section 46) ================= */
            <>
              <button
                className={`nav-item ${isTabActive('dashboard') ? 'active' : ''}`}
                onClick={() => handleNavigate('dashboard')}
              >
                <LayoutDashboard size={18} />
                <span>Dashboard</span>
              </button>

              <div className="nav-section-title">Sales</div>

              <button
                className={`nav-item ${isTabActive('handovers') ? 'active' : ''}`}
                onClick={() => handleNavigate('handovers')}
              >
                <Receipt size={18} />
                <span>Daily Handover</span>
              </button>

              <button
                className={`nav-item ${isTabActive('quantity-issues') ? 'active' : ''}`}
                onClick={() => handleNavigate('quantity-issues')}
              >
                <ArrowUpRight size={18} />
                <span>Issue Stock</span>
              </button>

              <button
                className={`nav-item ${isTabActive('targets') ? 'active' : ''}`}
                onClick={() => handleNavigate('targets')}
              >
                <Target size={18} />
                <span>Sales Targets</span>
              </button>

              <div className="nav-section-title">Inventory</div>

              <button
                className={`nav-item ${isTabActive('products') ? 'active' : ''}`}
                onClick={() => handleNavigate('products')}
              >
                <Package size={18} />
                <span>Products</span>
              </button>

              <button
                className={`nav-item ${isTabActive('inventory') ? 'active' : ''}`}
                onClick={() => handleNavigate('inventory')}
              >
                <Truck size={18} />
                <span>Inventory & Purchases</span>
              </button>

              <div className="nav-section-title">Staff</div>

              <button
                className={`nav-item ${isTabActive('attendance') ? 'active' : ''}`}
                onClick={() => handleNavigate('attendance')}
              >
                <Clock size={18} />
                <span>Attendance</span>
              </button>

              <button
                className={`nav-item ${isTabActive('salesman-ledger') ? 'active' : ''}`}
                onClick={() => handleNavigate('salesman-ledger')}
              >
                <Wallet size={18} />
                <span>Salesman Ledger</span>
              </button>

              <button
                className={`nav-item ${isTabActive('salary') ? 'active' : ''}`}
                onClick={() => handleNavigate('salary')}
              >
                <Receipt size={18} />
                <span>Salary</span>
              </button>

              <button
                className={`nav-item ${isTabActive('staff') ? 'active' : ''}`}
                onClick={() => handleNavigate('staff')}
              >
                <Users size={18} />
                <span>Salesmen & Dealers</span>
              </button>

              <div className="nav-section-title">Finance & Reports</div>

              <button
                className={`nav-item ${isTabActive('expenses') ? 'active' : ''}`}
                onClick={() => handleNavigate('expenses')}
              >
                <Wallet size={18} />
                <span>Expenses</span>
              </button>

              <button
                className={`nav-item ${isTabActive('reports') ? 'active' : ''}`}
                onClick={() => handleNavigate('reports')}
              >
                <BarChart3 size={18} />
                <span>Reports Hub</span>
              </button>
            </>
          ) : (
            /* ================= SALESMAN NAVIGATION (Section 47) ================= */
            <>
              <button
                className={`nav-item ${isTabActive('dashboard') ? 'active' : ''}`}
                onClick={() => handleNavigate('dashboard')}
              >
                <LayoutDashboard size={18} />
                <span>My Dashboard</span>
              </button>

              <button
                className={`nav-item ${isTabActive('handover') ? 'active' : ''}`}
                onClick={() => handleNavigate('handover')}
              >
                <Receipt size={18} />
                <span>Today's Handover</span>
              </button>
            </>
          )}
        </nav>

        {/* Logged In User Profile & Account Switcher in Sidebar Footer */}
        <div className="sidebar-footer">
          {/* Active Logged-In User Profile Card */}
          <div className="sidebar-user-card">
            <div className="sidebar-user-avatar-wrap">
              <div className={`sidebar-user-avatar role-${activeSession.role.toLowerCase()}`}>
                {activeSession.role === 'ADMIN' ? (
                  <ShieldCheck size={20} color="#ffffff" />
                ) : (
                  <Users size={20} color="#ffffff" />
                )}
              </div>
              <span className="sidebar-online-indicator" title="Active Session" />
            </div>

            <div className="sidebar-user-info">
              <div className="sidebar-user-label">Logged In User</div>
              <div className="sidebar-user-name" title={activeSession.name}>
                {activeSession.name}
              </div>
              <div className={`sidebar-role-badge badge-${activeSession.role.toLowerCase()}`}>
                {activeSession.role === 'ADMIN' ? 'Central Admin' : 'Field Salesman'}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="app-main">
        {/* Topbar */}
        <header className="app-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="sidebar-toggle-btn"
              onClick={handleToggleSidebar}
              title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label="Toggle sidebar"
            >
              <Menu size={20} />
            </button>
            <div className="topbar-title">
              {activeSession.role === 'ADMIN' ? (
                <>Candy & Cigarette Management — Central Administration</>
              ) : (
                <>{activeSession.name} — Daily Field Sales & Handover Portal</>
              )}
            </div>
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={logout}
              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
            >
              <LogOut size={14} />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
};
