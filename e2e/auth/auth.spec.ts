import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsSalesman, logout, setupConsoleAudit } from '../fixtures/helpers';

test.describe('Authentication & Session E2E (Phase 2N)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('1. Login UI renders with role selector, fields, and no Dealer login option', async ({ page }) => {
    const audit = setupConsoleAudit(page);

    // Verify brand headers
    await expect(page.locator('h1')).toContainText('Sign in to Portal');
    await expect(page.getByText('Candy & Cigarette').first()).toBeVisible();

    // Verify exactly TWO role tabs exist: Central Admin and Field Salesman
    const adminTab = page.locator('button.login-role-tab:has-text("Central Admin")');
    const salesmanTab = page.locator('button.login-role-tab:has-text("Field Salesman")');
    await expect(adminTab).toBeVisible();
    await expect(salesmanTab).toBeVisible();

    // Verify Dealer does NOT have a login tab or option
    const dealerTab = page.locator('button.login-role-tab:has-text("Dealer")');
    await expect(dealerTab).toHaveCount(0);

    // Verify inputs
    await expect(page.locator('input[placeholder*="Username"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    expect(audit.errors).toHaveLength(0);
  });

  test('2. Invalid credentials display error without crashing or loop', async ({ page }) => {
    const audit = setupConsoleAudit(page);

    const usernameInput = page.locator('input[placeholder*="Username"]');
    const passwordInput = page.locator('input[placeholder*="password"]');
    await usernameInput.fill('admin');
    await passwordInput.fill('WrongPassword@123');

    await page.locator('button[type="submit"]').click();

    // Error toast should appear
    const toast = page.locator('.toast.error, .toast, .toast-container');
    await expect(toast.first()).toBeVisible({ timeout: 6000 });

    // Should remain on login page without crashing
    await expect(page.locator('h1')).toContainText('Sign in to Portal');
  });

  test('3. Admin login, identity verification, navigation inspection, and logout', async ({ page }) => {
    const audit = setupConsoleAudit(page);
    await loginAsAdmin(page);

    // Verify Admin identity badge
    await expect(page.locator('.sidebar-role-badge')).toContainText('Central Admin');
    await expect(page.locator('.topbar-title')).toContainText('Central Administration');

    // Verify Admin navigation items are visible
    await expect(page.locator('.sidebar-nav button.nav-item:has-text("Dashboard")')).toBeVisible();
    await expect(page.locator('.sidebar-nav button.nav-item:has-text("Daily Handover")')).toBeVisible();
    await expect(page.locator('.sidebar-nav button.nav-item:has-text("Issue Stock")')).toBeVisible();
    await expect(page.locator('.sidebar-nav button.nav-item:has-text("Products")')).toBeVisible();
    await expect(page.locator('.sidebar-nav button.nav-item:has-text("Inventory & Purchases")')).toBeVisible();
    await expect(page.locator('.sidebar-nav button.nav-item:has-text("Expenses")')).toBeVisible();
    await expect(page.locator('.sidebar-nav button.nav-item:has-text("Reports Hub")')).toBeVisible();

    // Logout
    await logout(page);
    expect(audit.errors).toHaveLength(0);
  });

  test('4. Salesman login, identity isolation, and restricted navigation', async ({ page }) => {
    const audit = setupConsoleAudit(page);
    await loginAsSalesman(page, 'ramesh', 'Sales@12345');

    // Verify Salesman identity
    await expect(page.locator('.sidebar-role-badge')).toContainText('Field Salesman');
    await expect(page.locator('.topbar-title')).toContainText('Daily Field Sales & Handover Portal');

    // Verify Salesman only sees salesman tabs
    await expect(page.locator('.sidebar-nav button.nav-item:has-text("My Dashboard")')).toBeVisible();
    await expect(page.locator('.sidebar-nav button.nav-item:has-text("Today\'s Handover")')).toBeVisible();

    // Verify Admin-only navigation buttons are completely absent for salesman
    await expect(page.locator('.sidebar-nav button.nav-item:has-text("Products")')).toHaveCount(0);
    await expect(page.locator('.sidebar-nav button.nav-item:has-text("Inventory & Purchases")')).toHaveCount(0);
    await expect(page.locator('.sidebar-nav button.nav-item:has-text("Expenses")')).toHaveCount(0);
    await expect(page.locator('.sidebar-nav button.nav-item:has-text("Salary")')).toHaveCount(0);

    await logout(page);
    expect(audit.errors).toHaveLength(0);
  });

  test('5. Session restoration via /auth/me on page reload without data flash', async ({ page }) => {
    const audit = setupConsoleAudit(page);
    await loginAsAdmin(page);

    // Refresh page (testing session persistence across reload)
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Session must be restored automatically without redirecting to login
    await expect(page.locator('.sidebar-brand-title')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.sidebar-user-name')).toContainText('Admin');

    await logout(page);
    expect(audit.errors).toHaveLength(0);
  });
});
