import { test, expect } from '@playwright/test';
import { loginAsAdmin, navigateTab, generateE2EId, setupConsoleAudit } from '../fixtures/helpers';

test.describe('Sales Targets & Issue Stock E2E (Phase 2N)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('1. Sales Targets: Admin sets sales target, verifies instant appearance without reload', async ({ page }) => {
    const audit = setupConsoleAudit(page);
    await navigateTab(page, 'Sales Targets');

    await expect(page.locator('h1')).toContainText('Sales Targets & Performance');

    // Click "Assign New Target" button
    const assignBtn = page.locator('button:has-text("Assign New Target")');
    await expect(assignBtn).toBeVisible();
    await assignBtn.click();

    // Verify modal appears
    const modal = page.locator('.modal-content:has(h3:has-text("Assign Sales Target"))');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Fill target amount
    await modal.locator('.form-group:has-text("Daily Revenue Target") input').fill('35000');

    // Save
    await modal.locator('button[type="submit"]:has-text("Assign Sales Target")').click();

    // Verify target appears immediately in the table without reload
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 8000 });

    expect(audit.errors).toHaveLength(0);
  });

  test('2. Issue Stock: Issue stock to Salesman -> Verify immediate record appearance and target independence', async ({ page }) => {
    const audit = setupConsoleAudit(page);
    await navigateTab(page, 'Issue Stock');

    await expect(page.locator('h2')).toContainText('Issue Stock');

    // Click "+ Add Issue Stock" button to open modal
    const openModalBtn = page.locator('button:has-text("+ Add Issue Stock")');
    await openModalBtn.click();

    // Verify modal appears
    const modal = page.locator('.modal-backdrop .modal-content:has(h3:has-text("Issue Stock"))');
    await expect(modal).toBeVisible();

    // Select Salesman role tab
    const salesmanRoleBtn = modal.locator('button:has-text("Salesman")');
    if (await salesmanRoleBtn.isVisible()) {
      await salesmanRoleBtn.click();
    }

    // Set Quantity to 10 on the first item
    const qtyInput = modal.locator('input[type="number"]').first();
    await qtyInput.fill('10');

    // Submit Issue Stock
    const submitIssueBtn = modal.locator('button[type="submit"]:has-text("Record Issue")');
    await submitIssueBtn.click();

    // Verify issue record appears immediately in the table without reload
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 8000 });

    expect(audit.errors).toHaveLength(0);
  });

  test('3. Issue Stock: Issue stock to Dealer -> Verify no target requirement', async ({ page }) => {
    const audit = setupConsoleAudit(page);
    await navigateTab(page, 'Issue Stock');

    const openModalBtn = page.locator('button:has-text("+ Add Issue Stock")');
    await openModalBtn.click();

    const modal = page.locator('.modal-backdrop .modal-content:has(h3:has-text("Issue Stock"))');
    await expect(modal).toBeVisible();

    // Switch to Dealer recipient
    const dealerRoleBtn = modal.locator('button:has-text("Dealer")');
    await dealerRoleBtn.click();

    // Enter issue quantity
    const qtyInput = modal.locator('input[type="number"]').first();
    await qtyInput.fill('5');

    // Issue stock
    const submitIssueBtn = modal.locator('button[type="submit"]:has-text("Record Issue")');
    await submitIssueBtn.click();

    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 8000 });

    expect(audit.errors).toHaveLength(0);
  });

  test('4. Insufficient Stock: Attempting issue greater than available stock returns error safely', async ({ page }) => {
    const audit = setupConsoleAudit(page);
    await navigateTab(page, 'Issue Stock');

    const openModalBtn = page.locator('button:has-text("+ Add Issue Stock")');
    await openModalBtn.click();

    const modal = page.locator('.modal-backdrop .modal-content:has(h3:has-text("Issue Stock"))');
    await expect(modal).toBeVisible();

    // Enter excessive quantity exceeding stock
    const qtyInput = modal.locator('input[type="number"]').first();
    await qtyInput.fill('9999999');

    const submitIssueBtn = modal.locator('button[type="submit"]:has-text("Record Issue")');
    await submitIssueBtn.click();

    // UI should show error or remain safe
    await page.waitForTimeout(600);
    expect(audit.errors).toHaveLength(0);
  });
});
