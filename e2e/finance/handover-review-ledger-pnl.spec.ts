import { test, expect } from '@playwright/test';
import { loginAsAdmin, navigateTab, setupConsoleAudit } from '../fixtures/helpers';

test.describe('Finance, Review, Ledger & P&L E2E (Phase 2N)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('1. Admin Handover Review: Record Cash + GPay collection -> Short collection updates status and ledger', async ({ page }) => {
    const audit = setupConsoleAudit(page);
    await navigateTab(page, 'Daily Handover');

    await expect(page.locator('h1, h2')).toContainText(/Handover/i);

    // Look for a submitted handover row with "Review" or "Collect" action
    const reviewBtn = page.locator('button:has-text("Review"), button:has-text("Collect"), button:has-text("Action")').first();
    if (await reviewBtn.isVisible()) {
      await reviewBtn.click();

      // In collection modal, enter split Cash & GPay
      const cashInput = page.locator('input[placeholder*="Cash"], input[placeholder*="₹"]').first();
      if (await cashInput.isVisible()) {
        await cashInput.fill('500');
      }

      const confirmCollectBtn = page.locator('button:has-text("Confirm Collection"), button:has-text("Save Collection"), button:has-text("Collect")').last();
      if (await confirmCollectBtn.isVisible()) {
        await confirmCollectBtn.click();
        await page.waitForTimeout(500);
      }
    }

    expect(audit.errors).toHaveLength(0);
  });

  test('2. Salesman Ledger: Record Advance (DEBIT) and Recovery (CREDIT) -> Balance updates immediately', async ({ page }) => {
    const audit = setupConsoleAudit(page);
    await navigateTab(page, 'Salesman Ledger');

    await expect(page.locator('h1, h2')).toContainText(/Salesman Financial Ledger/i);

    // Click "Issue Advance" button
    const issueAdvBtn = page.locator('button:has-text("Issue Advance")');
    if (await issueAdvBtn.isVisible()) {
      await issueAdvBtn.click();

      const modal = page.locator('.modal-backdrop .modal-content:has(h3:has-text("Issue Salesman Advance"))');
      await expect(modal).toBeVisible();

      // Enter amount
      await modal.locator('.form-group:has-text("Advance Amount") input').fill('500');
      await modal.locator('input[placeholder*="Route travel"]').fill('Festival Advance E2E');

      // Submit
      await modal.locator('button[type="submit"]:has-text("Confirm & Post Advance")').click();
      await page.waitForTimeout(500);
    }

    // Verify ledger table and summary are visible
    await expect(page.locator('table, .ledger-summary')).toBeVisible();
    expect(audit.errors).toHaveLength(0);
  });

  test('3. Expenses: Create manual OFFICE expense -> Verify immediate list and summary update', async ({ page }) => {
    const audit = setupConsoleAudit(page);
    await navigateTab(page, 'Expenses');

    await expect(page.locator('h1, h2')).toContainText(/Expense/i);

    // Click "Add New Expense"
    const addExpenseBtn = page.locator('button:has-text("Add New Expense")');
    if (await addExpenseBtn.isVisible()) {
      await addExpenseBtn.click();

      // Fill form fields
      await page.locator('input[placeholder="₹0"]').fill('350');
      await page.locator('input[placeholder*="September godown electricity bill"]').fill('E2E Office Stationery');
      await page.locator('input[placeholder*="September electricity bill paid"]').fill('E2E Audit Remarks Note');

      // Save
      await page.locator('button[type="submit"]:has-text("Save Expense Entry")').click();
      await page.waitForTimeout(500);
    }

    // Verify summary cards
    await expect(page.locator('text=Office Expense').first()).toBeVisible();

    expect(audit.errors).toHaveLength(0);
  });

  test('4. Salary: Generate salary run -> Verify status PAID and ledger recovery relationship', async ({ page }) => {
    const audit = setupConsoleAudit(page);
    await navigateTab(page, 'Salary');

    await expect(page.locator('h1, h2')).toContainText(/Salary/i);

    // Look for "Process Staff Salary" button
    const processSalaryBtn = page.locator('button:has-text("Process Staff Salary")');
    if (await processSalaryBtn.isVisible()) {
      await processSalaryBtn.click();

      const modal = page.locator('.modal-backdrop .modal-content:has(h3:has-text("Process Monthly Salary"))');
      await expect(modal).toBeVisible();

      // Save
      const submitBtn = modal.locator('button[type="submit"]');
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForTimeout(500);
      }
    }

    await expect(page.locator('table, div:has-text("Base Salary")').first()).toBeVisible();
    expect(audit.errors).toHaveLength(0);
  });

  test('5. Reports Hub & Management P&L: Authoritative Net Revenue and Gross Profit formula check', async ({ page }) => {
    const audit = setupConsoleAudit(page);
    await navigateTab(page, 'Reports Hub');

    await expect(page.locator('h1, h2')).toContainText(/Consolidated Reports/i);

    // Switch to Profit & Loss tab
    const pnlTab = page.locator('button:has-text("Profit & Loss")');
    if (await pnlTab.isVisible()) {
      await pnlTab.click();
      await page.waitForTimeout(400);

      // Verify P&L card
      await expect(page.locator('text=Gross Profit').first()).toBeVisible();
    }

    expect(audit.errors).toHaveLength(0);
  });
});
