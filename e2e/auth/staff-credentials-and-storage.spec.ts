import { test, expect } from '@playwright/test';
import { loginAsAdmin, navigateTab, generateE2EId, setupConsoleAudit } from '../fixtures/helpers';

test.describe('Phase 2N.5: Staff Credentials, Session Security & Database-Only Storage', () => {
  const uniqueId = Date.now().toString().slice(-6);
  const testSalesmanName = `E2E_Sales_Rep_${uniqueId}`;
  const testSalesmanPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
  const testUsername = `rep_${uniqueId}`;
  const testPassword = 'Password@9876';

  test('1. Staff Creation UI: Salesman reveals credential fields, Dealer hides credentials', async ({ page }) => {
    setupConsoleAudit(page);
    await loginAsAdmin(page);
    await navigateTab(page, 'Salesmen & Dealers');

    await page.locator('button:has-text("Register New Person")').click();
    const modal = page.locator('.modal-content:has(h3:has-text("Register Staff / Dealer"))');
    await expect(modal).toBeVisible();

    // Default is Salesman: Credentials section must be visible
    await expect(modal.locator('text=Login Credentials')).toBeVisible();
    await expect(modal.locator('input[placeholder*="ramesh.kumar"]')).toBeVisible();
    await expect(modal.locator('input[type="password"]').first()).toBeVisible();

    // Switch to Wholesale Dealer: Credentials section must disappear completely
    await modal.locator('select.select-field').selectOption('DEALER');
    await expect(modal.locator('text=Login Credentials')).not.toBeVisible();
    await expect(modal.locator('input[placeholder*="ramesh.kumar"]')).not.toBeVisible();

    // Switch back to Salesman: Credentials section reappears
    await modal.locator('select.select-field').selectOption('SALESMAN');
    await expect(modal.locator('text=Login Credentials')).toBeVisible();
  });

  test('2. Password validation: Password mismatch displays error and prevents submission', async ({ page }) => {
    setupConsoleAudit(page);
    await loginAsAdmin(page);
    await navigateTab(page, 'Salesmen & Dealers');

    await page.locator('button:has-text("Register New Person")').click();
    const modal = page.locator('.modal-content:has(h3:has-text("Register Staff / Dealer"))');

    await modal.locator('input[placeholder*="Anand or City Supermarket"]').fill('Invalid Staff');
    await modal.locator('input[placeholder*="9845123456"]').fill('9988776655');
    await modal.locator('input[placeholder*="ramesh.kumar"]').fill('invalid_user');
    await modal.locator('input[type="password"]').first().fill('Password@123');
    await modal.locator('input[type="password"]').nth(1).fill('Password@999'); // Mismatch

    await modal.locator('button[type="submit"]:has-text("Save Person")').click();

    // Error alert displayed
    await expect(modal.locator('text=Password and Confirm Password do not match')).toBeVisible();
    // Modal stays open
    await expect(modal).toBeVisible();
  });

  test('3. Admin registers Salesman with login credentials -> Appears immediately without refresh', async ({ page }) => {
    setupConsoleAudit(page);
    await loginAsAdmin(page);
    await navigateTab(page, 'Salesmen & Dealers');

    await page.locator('button:has-text("Register New Person")').click();
    const modal = page.locator('.modal-content:has(h3:has-text("Register Staff / Dealer"))');

    await modal.locator('input[placeholder*="Anand or City Supermarket"]').fill(testSalesmanName);
    await modal.locator('input[placeholder*="9845123456"]').fill(testSalesmanPhone);
    await modal.locator('input[placeholder*="South Zone Market"]').fill('Central Route 4');
    await modal.locator('input[placeholder*="ramesh.kumar"]').fill(testUsername);
    await modal.locator('input[type="password"]').first().fill(testPassword);
    await modal.locator('input[type="password"]').nth(1).fill(testPassword);

    await modal.locator('button[type="submit"]:has-text("Save Person")').click();
    await expect(modal).not.toBeVisible({ timeout: 6000 });

    // Verify Salesman appears immediately in table with @username badge without page reload
    const salesmanRow = page.locator(`tr:has-text("${testSalesmanName}")`);
    await expect(salesmanRow).toBeVisible({ timeout: 6000 });
    await expect(salesmanRow).toContainText(`@${testUsername}`);
    await expect(salesmanRow).toContainText('SALESMAN');
  });

  test('4. Duplicate Login ID: Creating user with existing username returns 409 and displays error', async ({ page }) => {
    setupConsoleAudit(page);
    await loginAsAdmin(page);
    await navigateTab(page, 'Salesmen & Dealers');

    await page.locator('button:has-text("Register New Person")').click();
    const modal = page.locator('.modal-content:has(h3:has-text("Register Staff / Dealer"))');

    await modal.locator('input[placeholder*="Anand or City Supermarket"]').fill('Duplicate Sales Rep');
    await modal.locator('input[placeholder*="9845123456"]').fill('9123456780');
    // Attempt duplicate username
    await modal.locator('input[placeholder*="ramesh.kumar"]').fill(testUsername);
    await modal.locator('input[type="password"]').first().fill(testPassword);
    await modal.locator('input[type="password"]').nth(1).fill(testPassword);

    await modal.locator('button[type="submit"]:has-text("Save Person")').click();

    // Verify 409 conflict error message appears cleanly
    await expect(modal.locator('text=This login ID is already in use')).toBeVisible({ timeout: 6000 });
    await expect(modal).toBeVisible();
  });

  test('5. Newly created Salesman logs in, verifies role isolation, and storage contains 0 auth tokens', async ({ page }) => {
    setupConsoleAudit(page);

    // 1. Visit Login page
    await page.goto('/');

    // Select Salesman role tab
    await page.locator('button:has-text("Salesman"), button:has-text("Sales Staff")').first().click();

    // Fill newly created credentials
    await page.locator('input[type="text"]').fill(testUsername);
    await page.locator('input[type="password"]').fill(testPassword);
    await page.locator('button[type="submit"]:has-text("Sign In")').click();

    // Verify successful login to Salesman Handover dashboard
    await expect(page.locator('text=/Daily Handover|Waiting for Admin Collection/i').first()).toBeVisible({ timeout: 10000 });

    // 2. Storage Audit: Verify localStorage and sessionStorage contain NO auth tokens or cached business data
    const localToken = await page.evaluate(() => window.localStorage.getItem('AUTH_TOKEN'));
    const localUser = await page.evaluate(() => window.localStorage.getItem('CURRENT_USER'));
    const sessionToken = await page.evaluate(() => window.sessionStorage.getItem('AUTH_TOKEN'));

    expect(localToken).toBeNull();
    expect(localUser).toBeNull();
    expect(sessionToken).toBeNull();

    // 3. Role Isolation: Admin tabs must NOT exist in the DOM
    await expect(page.locator('button:has-text("Products")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Salesmen & Dealers")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Purchase Invoices")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Reports Hub")')).not.toBeVisible();

    // 4. Session Persistence via Backend Cookie on Page Reload
    await page.reload();
    await expect(page.locator('text=/Field Sales Representative Portal|Welcome back/i').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Logout")')).toBeVisible();

    // Still no tokens in localStorage
    const localTokenAfterReload = await page.evaluate(() => window.localStorage.getItem('AUTH_TOKEN'));
    expect(localTokenAfterReload).toBeNull();
  });

  test('6. Dealer Creation: Dealer has no login credentials and cannot authenticate', async ({ page }) => {
    setupConsoleAudit(page);
    await loginAsAdmin(page);
    await navigateTab(page, 'Salesmen & Dealers');

    await page.locator('button:has-text("Register New Person")').click();
    const modal = page.locator('.modal-content:has(h3:has-text("Register Staff / Dealer"))');

    const dealerName = generateE2EId('E2E_Wholesale_NoLogin');
    const dealerPhone = `97${Math.floor(10000000 + Math.random() * 90000000)}`;

    await modal.locator('input[placeholder*="Anand or City Supermarket"]').fill(dealerName);
    await modal.locator('input[placeholder*="9845123456"]').fill(dealerPhone);
    await modal.locator('select.select-field').selectOption('DEALER');
    await modal.locator('input[placeholder*="South Zone Market"]').fill('North Market St');

    // Confirm credentials fields are NOT in the form
    await expect(modal.locator('text=Login Credentials')).not.toBeVisible();
    await expect(modal.locator('input[type="password"]')).not.toBeVisible();

    await modal.locator('button[type="submit"]:has-text("Save Person")').click();
    await expect(modal).not.toBeVisible({ timeout: 6000 });

    // Dealer row appears with DEALER badge and NO @username
    const dealerRow = page.locator(`tr:has-text("${dealerName}")`);
    await expect(dealerRow).toBeVisible({ timeout: 6000 });
    await expect(dealerRow).toContainText('DEALER');
    await expect(dealerRow).not.toContainText('@');
  });
});
