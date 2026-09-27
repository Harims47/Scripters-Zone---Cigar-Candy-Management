import { Page, expect } from '@playwright/test';

/**
 * Shared helper utilities for Phase 2N E2E Automated Verification.
 */

export interface ConsoleAudit {
  errors: string[];
  warnings: string[];
}

/**
 * Attach console listener to capture any runtime errors.
 */
export function setupConsoleAudit(page: Page): ConsoleAudit {
  const audit: ConsoleAudit = { errors: [], warnings: [] };
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore benign React development logs or network 401/409 intentionally provoked during negative tests
      if (
        !text.includes('Failed to load resource') &&
        !text.includes('401') &&
        !text.includes('409') &&
        !text.includes('400') &&
        !text.includes('already exists')
      ) {
        audit.errors.push(text);
      }
    }
  });
  page.on('pageerror', (err) => {
    audit.errors.push(err.message);
  });
  return audit;
}

/**
 * Deterministic unique identifier generator for test data.
 */
export function generateE2EId(prefix: string): string {
  const ts = Date.now().toString().slice(-6);
  const rand = Math.floor(Math.random() * 900 + 100);
  return `${prefix}_${ts}_${rand}`;
}

/**
 * Log in as Admin through the real UI.
 */
export async function loginAsAdmin(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const adminBadge = page.locator('.sidebar-role-badge:has-text("Central Admin")');
  if (await adminBadge.isVisible()) {
    return;
  }

  const logoutBtn = page.locator('button:has-text("Logout")');
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
    await expect(page.locator('h1:has-text("Sign in to Portal")')).toBeVisible({ timeout: 8000 });
  }

  const adminTab = page.locator('button.login-role-tab:has-text("Central Admin")');
  if (await adminTab.isVisible()) {
    await adminTab.click();
  }

  const usernameInput = page.locator('input[placeholder*="Username"]');
  const passwordInput = page.locator('input[placeholder*="password"]');
  await usernameInput.fill('admin');
  await passwordInput.fill('Admin@12345');

  const submitBtn = page.locator('button[type="submit"]');
  await submitBtn.click();

  await expect(page.locator('.sidebar-brand-title')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.sidebar-user-name')).toContainText('Admin', { timeout: 10000 });
}

/**
 * Log in as Field Salesman through the real UI.
 */
export async function loginAsSalesman(page: Page, username: string = 'ramesh', password: string = 'Sales@12345') {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const logoutBtn = page.locator('button:has-text("Logout")');
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
    await expect(page.locator('h1:has-text("Sign in to Portal")')).toBeVisible({ timeout: 8000 });
  }

  const salesmanTab = page.locator('button.login-role-tab:has-text("Field Salesman")');
  if (await salesmanTab.isVisible()) {
    await salesmanTab.click();
  }

  const usernameInput = page.locator('input[placeholder*="Username"]');
  const passwordInput = page.locator('input[placeholder*="password"]');
  await usernameInput.fill(username);
  await passwordInput.fill(password);

  const submitBtn = page.locator('button[type="submit"]');
  await submitBtn.click();

  await expect(page.locator('.sidebar-brand-title')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.sidebar-role-badge')).toContainText('Field Salesman', { timeout: 10000 });
}

/**
 * Log out from the current session.
 */
export async function logout(page: Page) {
  const logoutBtn = page.locator('button:has-text("Logout")');
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
  }
  await expect(page.locator('h1:has-text("Sign in to Portal")')).toBeVisible({ timeout: 8000 });
}

/**
 * Navigate to a specific view using the sidebar navigation (handles mobile menu toggle automatically).
 */
export async function navigateTab(page: Page, tabTitle: string) {
  const mobileToggle = page.locator('.topbar-mobile-toggle');
  if (await mobileToggle.isVisible()) {
    const isSidebarOpen = await page.locator('.app-sidebar.mobile-open').isVisible();
    if (!isSidebarOpen) {
      await mobileToggle.click();
      await page.waitForTimeout(300);
    }
  }

  const navButton = page.locator(`.sidebar-nav button.nav-item:has-text("${tabTitle}")`);
  await expect(navButton).toBeVisible({ timeout: 5000 });
  await navButton.click();
  await page.waitForTimeout(400); // Allow view to hydrate
}
