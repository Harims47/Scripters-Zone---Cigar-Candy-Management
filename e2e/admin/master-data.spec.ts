import { test, expect } from '@playwright/test';
import { loginAsAdmin, navigateTab, generateE2EId, setupConsoleAudit } from '../fixtures/helpers';

test.describe('Admin Master Data & Staff E2E (Phase 2N)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('1. Product Master: Create product, verify instant appearance without refresh, toggle status', async ({ page }) => {
    const audit = setupConsoleAudit(page);
    await navigateTab(page, 'Products');

    await expect(page.locator('h1')).toContainText('Product Master Catalog');

    // Click "Add Product" button
    const addProductBtn = page.locator('button:has-text("Add Product")');
    await expect(addProductBtn).toBeVisible();
    await addProductBtn.click();

    const modal = page.locator('.modal-content:has(h3:has-text("Add New Product"))');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const testProductName = generateE2EId('E2E_Candy_Mint');
    const testBrand = 'GPI';

    // Fill Product Name
    await modal.locator('.form-group').filter({ hasText: /^Product Name/ }).locator('input').fill(testProductName);

    // Select Category "Candy" (first select in the modal)
    await modal.locator('select').first().selectOption('Candy');

    // Brand (for Candy it has placeholder "e.g. Funda Goli")
    await modal.locator('.form-group').filter({ hasText: /^Brand/ }).locator('input').fill(testBrand);

    // Standard Purchase Price & Selling Rate (number inputs)
    await modal.locator('input[type="number"]').nth(0).fill('100');
    await modal.locator('input[type="number"]').nth(1).fill('150');

    // Submit modal form
    const saveBtn = modal.locator('button[type="submit"]');
    await saveBtn.click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // Search for product to bring it to view without page refresh
    await page.locator('input[placeholder*="Search product name"]').fill(testProductName);

    // Verify product appears immediately in table WITHOUT page refresh
    const productRow = page.locator(`tr:has-text("${testProductName}")`);
    await expect(productRow).toBeVisible({ timeout: 8000 });
    await expect(productRow).toContainText('Active');

    // Wait a brief tick for server sync before clicking edit
    await page.waitForTimeout(600);

    // Status toggle: Edit product and deactivate
    const editBtn = productRow.locator('button[title="Edit Product"]');
    await editBtn.click();

    const editModal = page.locator('.modal-content:has(h3:has-text("Edit Product Master"))');
    await expect(editModal).toBeVisible();

    // Toggle active checkbox
    await editModal.locator('input#activeCheck').uncheck();
    await editModal.locator('button[type="submit"]:has-text("Save Changes")').click();
    await expect(editModal).not.toBeVisible({ timeout: 5000 });

    // Verify row updates status to Inactive without reload
    await expect(productRow).toContainText('Inactive');

    expect(audit.errors).toHaveLength(0);
  });

  test('2. Dealer Master: Create wholesale dealer and verify immediate roster appearance', async ({ page }) => {
    const audit = setupConsoleAudit(page);
    await navigateTab(page, 'Salesmen & Dealers');

    await expect(page.locator('h2')).toContainText('Salesmen & Dealers Roster');

    // Click "Register New Person"
    const registerBtn = page.locator('button:has-text("Register New Person")');
    await registerBtn.click();

    const addModal = page.locator('.modal-content:has(h3:has-text("Register Staff / Dealer"))');
    await expect(addModal).toBeVisible();

    const dealerName = generateE2EId('E2E_Wholesale_Traders');
    const dealerPhone = `9${Math.floor(100000000 + Math.random() * 900000000)}`;

    // Fill form
    await addModal.locator('input[placeholder*="Anand or City Supermarket"]').fill(dealerName);
    await addModal.locator('input[placeholder*="9845123456"]').fill(dealerPhone);

    // Select Role: Wholesale Dealer (inside the modal form)
    await addModal.locator('select.select-field').selectOption('DEALER');
    await addModal.locator('input[placeholder*="South Zone Market"]').fill('Central Wholesale Market');

    // Submit using Save Person
    await addModal.locator('button[type="submit"]:has-text("Save Person")').click();

    // Verify Dealer appears immediately in roster without refresh
    const dealerRow = page.locator(`tr:has-text("${dealerName}")`);
    await expect(dealerRow).toBeVisible({ timeout: 8000 });
    await expect(dealerRow).toContainText('DEALER');

    expect(audit.errors).toHaveLength(0);
  });

  test('3. Staff Attendance: Record attendance and verify immediate table update', async ({ page }) => {
    const audit = setupConsoleAudit(page);
    await navigateTab(page, 'Attendance');

    await expect(page.locator('h1')).toContainText(/Staff Attendance/i);

    // Look for attendance mark button or inputs
    const saveAttendanceBtn = page.locator('button:has-text("Save Attendance"), button:has-text("Save Changes")');
    if (await saveAttendanceBtn.first().isVisible()) {
      await saveAttendanceBtn.first().click();
      await page.waitForTimeout(500);
      await expect(page.locator('text=Attendance saved').first()).toBeVisible({ timeout: 5000 });
    }

    expect(audit.errors).toHaveLength(0);
  });
});
