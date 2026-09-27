import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsSalesman, logout, setupConsoleAudit } from '../fixtures/helpers';

test.describe('Global Routing Audit & URL-Based Navigation Suite', () => {

  test.describe('1. Admin Sidebar SPA Navigation & Active State (No Reload)', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test('Sidebar navigation clicks update URL, render correct view, and highlight active tab without page reload', async ({ page }) => {
      const audit = setupConsoleAudit(page);

      const navRoutes = [
        { label: 'Products', expectedPath: '/products', expectedHeading: 'Product Master Catalog' },
        { label: 'Inventory & Purchases', expectedPath: '/inventory', expectedHeading: 'Inventory & Purchases' },
        { label: 'Sales Targets', expectedPath: '/sales-targets', expectedHeading: 'Sales Targets' },
        { label: 'Daily Handover', expectedPath: '/daily-handover', expectedHeading: 'Daily Handover' },
        { label: 'Issue Stock', expectedPath: '/issue-stock', expectedHeading: 'Issue Stock' },
        { label: 'Attendance', expectedPath: '/attendance', expectedHeading: 'Attendance' },
        { label: 'Salesman Ledger', expectedPath: '/salesman-ledger', expectedHeading: 'Salesman Ledger' },
        { label: 'Salary', expectedPath: '/salary', expectedHeading: 'Salary' },
        { label: 'Salesmen & Dealers', expectedPath: '/staff', expectedHeading: 'Salesmen' },
        { label: 'Expenses', expectedPath: '/expenses', expectedHeading: 'Expenses' },
        { label: 'Reports Hub', expectedPath: '/reports', expectedHeading: 'Reports' },
        { label: 'Dashboard', expectedPath: '/dashboard', expectedHeading: 'Operational Command Center' }
      ];

      for (const item of navRoutes) {
        const navButton = page.locator(`.sidebar-nav button.nav-item:has-text("${item.label}")`);
        await expect(navButton).toBeVisible();
        await navButton.click();

        // 1. Verify browser URL updated
        await expect(page).toHaveURL(new RegExp(`${item.expectedPath}$`));

        // 2. Verify active sidebar highlighting
        await expect(navButton).toHaveClass(/active/);

        // 3. Verify target page content rendered
        await expect(page.locator(`text=${item.expectedHeading}`).first()).toBeVisible({ timeout: 5000 });

        // 4. Verify document title
        const title = await page.title();
        expect(title).toContain('Candy & Cigarette Management');
      }

      expect(audit.errors).toHaveLength(0);
    });
  });

  test.describe('2. Browser Back & Forward History Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test('Browser back and forward buttons naturally traverse application navigation history', async ({ page }) => {
      const audit = setupConsoleAudit(page);

      // Sequence: Products -> Inventory -> Sales Targets
      await page.locator('.sidebar-nav button.nav-item:has-text("Products")').click();
      await expect(page).toHaveURL(/\/products$/);

      await page.locator('.sidebar-nav button.nav-item:has-text("Inventory & Purchases")').click();
      await expect(page).toHaveURL(/\/inventory$/);

      await page.locator('.sidebar-nav button.nav-item:has-text("Sales Targets")').click();
      await expect(page).toHaveURL(/\/sales-targets$/);

      // Back -> Inventory
      await page.goBack();
      await expect(page).toHaveURL(/\/inventory$/);
      await expect(page.locator('.sidebar-nav button.nav-item:has-text("Inventory & Purchases")')).toHaveClass(/active/);

      // Back -> Products
      await page.goBack();
      await expect(page).toHaveURL(/\/products$/);
      await expect(page.locator('.sidebar-nav button.nav-item:has-text("Products")')).toHaveClass(/active/);

      // Forward -> Inventory
      await page.goForward();
      await expect(page).toHaveURL(/\/inventory$/);
      await expect(page.locator('.sidebar-nav button.nav-item:has-text("Inventory & Purchases")')).toHaveClass(/active/);

      expect(audit.errors).toHaveLength(0);
    });
  });

  test.describe('3. Direct URL Access & Deep Linking', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test('Direct URL entry opens the exact page and tab without defaulting to Dashboard', async ({ page }) => {
      const audit = setupConsoleAudit(page);

      // Direct access to /inventory
      await page.goto('/inventory');
      await expect(page).toHaveURL(/\/inventory$/);
      await expect(page.locator('text=Inventory & Purchases').first()).toBeVisible();
      await expect(page.locator('.sidebar-nav button.nav-item:has-text("Inventory & Purchases")')).toHaveClass(/active/);

      // Direct access to subtab /inventory/purchases
      await page.goto('/inventory/purchases');
      await expect(page).toHaveURL(/\/inventory\/purchases$/);
      await expect(page.locator('.sidebar-nav button.nav-item:has-text("Inventory & Purchases")')).toHaveClass(/active/);

      // Direct access to /reports/pnl
      await page.goto('/reports/pnl');
      await expect(page).toHaveURL(/\/reports\/pnl$/);
      await expect(page.locator('.sidebar-nav button.nav-item:has-text("Reports Hub")')).toHaveClass(/active/);

      // Direct access to /sales-ledger
      await page.goto('/sales-ledger');
      await expect(page).toHaveURL(/\/sales-ledger$/);
      await expect(page.locator('.sidebar-nav button.nav-item:has-text("Reports Hub")')).toHaveClass(/active/);

      // Direct access to /dealers
      await page.goto('/dealers');
      await expect(page).toHaveURL(/\/dealers$/);
      await expect(page.locator('.sidebar-nav button.nav-item:has-text("Salesmen & Dealers")')).toHaveClass(/active/);

      expect(audit.errors).toHaveLength(0);
    });

    test('Page refresh preserves exact URL and re-authenticates via /auth/me without redirecting to dashboard', async ({ page }) => {
      const audit = setupConsoleAudit(page);

      await page.goto('/inventory');
      await expect(page).toHaveURL(/\/inventory$/);
      await expect(page.locator('text=Inventory & Purchases').first()).toBeVisible();

      // Refresh browser
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Verify route remains /inventory and view renders correctly
      await expect(page).toHaveURL(/\/inventory$/);
      await expect(page.locator('text=Inventory & Purchases').first()).toBeVisible();
      await expect(page.locator('.sidebar-nav button.nav-item:has-text("Inventory & Purchases")')).toHaveClass(/active/);

      // Repeat for /products
      await page.goto('/products');
      await expect(page).toHaveURL(/\/products$/);
      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/products$/);
      await expect(page.locator('.sidebar-nav button.nav-item:has-text("Products")')).toHaveClass(/active/);

      expect(audit.errors).toHaveLength(0);
    });
  });

  test.describe('4. Role-Based Route Guards & Security (403 Forbidden)', () => {
    test('Salesman accessing Admin-only routes is blocked with HTTP 403 Access Denied view', async ({ page }) => {
      const audit = setupConsoleAudit(page);

      await loginAsSalesman(page);

      // Salesman allowed routes work
      await expect(page.locator('.sidebar-role-badge')).toContainText('Field Salesman');

      const adminRoutes = [
        '/products',
        '/inventory',
        '/reports/pnl',
        '/staff',
        '/expenses'
      ];

      for (const route of adminRoutes) {
        await page.goto(route);
        await expect(page).toHaveURL(new RegExp(`${route}$`));

        // Verify 403 Forbidden UI
        await expect(page.locator('text=HTTP 403 Forbidden')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('h1:has-text("Access Denied")')).toBeVisible();

        // Verify return button works
        const returnBtn = page.locator('button:has-text("Return to My Portal")');
        await expect(returnBtn).toBeVisible();
      }

      // Click Return to My Portal
      await page.locator('button:has-text("Return to My Portal")').click();
      await expect(page).toHaveURL(/\/salesman\/dashboard$/);
      await expect(page.locator('h1:has-text("Welcome back")')).toBeVisible();

      expect(audit.errors).toHaveLength(0);
    });
  });

  test.describe('5. Authentication State & Unauthenticated Protection', () => {
    test('Unauthenticated user is redirected to /login; authenticated user is redirected away from /login', async ({ page }) => {
      const audit = setupConsoleAudit(page);

      // Log out first
      await loginAsAdmin(page);
      await logout(page);

      // Attempt to access protected route
      await page.goto('/inventory');
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.locator('h1:has-text("Sign in to Portal")')).toBeVisible();

      // Log in
      await page.locator('input[placeholder*="Username"]').fill('admin');
      await page.locator('input[placeholder*="password"]').fill('Admin@12345');
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(/\/dashboard$/);

      // Visiting /login while authenticated redirects to /dashboard
      await page.goto('/login');
      await expect(page).toHaveURL(/\/dashboard$/);

      expect(audit.errors).toHaveLength(0);
    });
  });

  test.describe('6. Unknown Route 404 Handling', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test('Non-existent route renders 404 Page Not Found with return action', async ({ page }) => {
      const audit = setupConsoleAudit(page);

      await page.goto('/this-route-does-not-exist');
      await expect(page.locator('text=404 — Page Not Found')).toBeVisible();
      await expect(page.locator('h1:has-text("Page Not Found")')).toBeVisible();

      const returnBtn = page.locator('button:has-text("Return to Dashboard")');
      await expect(returnBtn).toBeVisible();
      await returnBtn.click();

      await expect(page).toHaveURL(/\/dashboard$/);
      expect(audit.errors).toHaveLength(0);
    });
  });

  test.describe('7. Mobile Viewport Routing (390x844)', () => {
    test('Mobile drawer navigation opens, navigates, updates URL, closes drawer, and supports browser back', async ({ page }) => {
      const audit = setupConsoleAudit(page);

      await page.setViewportSize({ width: 390, height: 844 });
      await loginAsAdmin(page);

      // 1. Open hamburger menu
      const toggle = page.locator('.topbar-mobile-toggle');
      await expect(toggle).toBeVisible();
      await toggle.click();
      await expect(page.locator('.app-sidebar.mobile-open')).toBeVisible();

      // 2. Click Products in drawer
      await page.locator('.sidebar-nav button.nav-item:has-text("Products")').click();
      await expect(page).toHaveURL(/\/products$/);

      // 3. Verify drawer closed automatically after navigation
      await expect(page.locator('.app-sidebar.mobile-open')).not.toBeVisible();
      await expect(page.locator('text=Product Master Catalog').first()).toBeVisible();

      // 4. Open drawer again, click Daily Handover
      await toggle.click();
      await expect(page.locator('.app-sidebar.mobile-open')).toBeVisible();
      await page.locator('.sidebar-nav button.nav-item:has-text("Daily Handover")').click();
      await expect(page).toHaveURL(/\/daily-handover$/);
      await expect(page.locator('.app-sidebar.mobile-open')).not.toBeVisible();

      // 5. Browser back works on mobile
      await page.goBack();
      await expect(page).toHaveURL(/\/products$/);

      expect(audit.errors).toHaveLength(0);
    });
  });

});
