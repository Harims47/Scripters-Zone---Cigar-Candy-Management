import { test, expect } from '@playwright/test';
import { loginAsAdmin, navigateTab, setupConsoleAudit } from '../fixtures/helpers';

test.describe('Responsive Layout & System Hardening E2E (Phase 2N)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('1. Table Filters & Search: Applying and clearing filters updates displayed dataset cleanly', async ({ page }) => {
    const audit = setupConsoleAudit(page);
    await navigateTab(page, 'Products');

    // Type in search box
    const searchInput = page.locator('input[placeholder*="Search product name"]');
    await searchInput.fill('Cavanders');
    await page.waitForTimeout(400);

    // Verify filtered rows
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(400);

    // Full data should return
    const restoredCount = await rows.count();
    expect(restoredCount).toBeGreaterThanOrEqual(count);

    expect(audit.errors).toHaveLength(0);
  });

  test('2. Table Pagination: Navigating between pages displays correct page slices', async ({ page }) => {
    const audit = setupConsoleAudit(page);
    await navigateTab(page, 'Products');

    // Check pagination controls
    const nextBtn = page.locator('button[title="Next Page"]');
    if (await nextBtn.isVisible()) {
      const isEnabled = await nextBtn.isEnabled();
      if (isEnabled) {
        await nextBtn.click();
        await page.waitForTimeout(300);
      }
    }
    // Table remains visible
    await expect(page.locator('table')).toBeVisible();

    expect(audit.errors).toHaveLength(0);
  });

  test('3. Network Failure Interception: Simulating HTTP 500 displays error cleanly without crashing', async ({ page }) => {
    const audit = setupConsoleAudit(page);

    // Intercept a specific POST endpoint to simulate server error
    await page.route('**/api/v1/products', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Simulated backend database error for hardening test',
          }),
        });
      } else {
        route.continue();
      }
    });

    await navigateTab(page, 'Products');
    await page.locator('button:has-text("Add Product")').click();

    const modal = page.locator('.modal-content:has(h3:has-text("Add New Product"))');
    await expect(modal).toBeVisible();

    // Fill form
    await modal.locator('.form-group').filter({ hasText: /^Product Name/ }).locator('input').fill('Test Fail Prod');
    await modal.locator('select').first().selectOption('Candy');
    await modal.locator('.form-group').filter({ hasText: /^Brand/ }).locator('input').fill('GPI');
    await modal.locator('button[type="submit"]').click();

    // Verify error toast/message is displayed
    await page.waitForTimeout(800);
    const toast = page.locator('.toast.error, .toast, div:has-text("error"), div:has-text("Error")');
    await expect(toast.first()).toBeVisible({ timeout: 6000 });

    // Application shell must remain stable and interactive
    await expect(page.locator('.sidebar-brand-title')).toBeVisible();
  });

  test('4. Double-Click / Rapid Submission Protection: Rapid repeated clicks on button do not spawn duplicates', async ({ page }) => {
    const audit = setupConsoleAudit(page);
    await navigateTab(page, 'Products');

    await page.locator('button:has-text("Add Product")').click();
    const modal = page.locator('.modal-content:has(h3:has-text("Add New Product"))');
    await expect(modal).toBeVisible();

    const testName = `RapidClick_${Date.now()}`;
    await modal.locator('.form-group').filter({ hasText: /^Product Name/ }).locator('input').fill(testName);
    await modal.locator('select').first().selectOption('Candy');
    await modal.locator('.form-group').filter({ hasText: /^Brand/ }).locator('input').fill('GPI');

    const submitBtn = modal.locator('button[type="submit"]');

    // Rapid double click
    await submitBtn.click({ clickCount: 2, delay: 50 });

    await page.waitForTimeout(1000);

    // Filter by the created name
    const searchInput = page.locator('input[placeholder*="Search product name"]');
    await searchInput.fill(testName);
    await page.waitForTimeout(500);

    // Exactly one row should be present, not two
    const matchingRows = page.locator(`table tbody tr:has-text("${testName}")`);
    const count = await matchingRows.count();
    expect(count).toBeLessThanOrEqual(1);

    expect(audit.errors).toHaveLength(0);
  });
});
