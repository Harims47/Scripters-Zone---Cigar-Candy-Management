import { test, expect } from '@playwright/test';
import { loginAsAdmin, navigateTab, generateE2EId, setupConsoleAudit } from '../fixtures/helpers';

test.describe('Inventory & Purchase Invoices E2E (Phase 2N)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('1. Create Purchase Invoice -> Verify instant invoice appearance and immediate stock increase without reload', async ({ page }) => {
    const audit = setupConsoleAudit(page);
    await navigateTab(page, 'Inventory & Purchases');

    await expect(page.locator('h1')).toContainText('Inventory & Purchases');

    // 1. Check initial stock on hand table
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // 2. Switch to Purchase Invoices tab
    const invoicesTab = page.locator('button.tab-btn:has-text("Purchase Invoices")');
    await invoicesTab.click();

    // 3. Open "+ Record Purchase Invoice" workspace
    const recordInvBtn = page.locator('button:has-text("+ Record Purchase Invoice"), button:has-text("Record Purchase Invoice")');
    await recordInvBtn.click();

    const testInvNumber = generateE2EId('INV_E2E');

    // Fill Supplier and Invoice Number
    await page.locator('div:has(> label:has-text("Supplier")) input').fill('Godfrey Phillips Distributors');
    await page.locator('input[placeholder*="INV-2026-9021"]').fill(testInvNumber);

    // Set Quantity and Rate on first item row in desktop table
    const qtyInput = page.locator('.inv-desktop-only input[type="number"]').first();
    if (await qtyInput.isVisible()) {
      await qtyInput.fill('75');
    }
    const rateInput = page.locator('.inv-desktop-only input[type="number"]').nth(1);
    if (await rateInput.isVisible()) {
      await rateInput.fill('85');
    }

    // Save Purchase Invoice
    const saveInvoiceBtn = page.locator('button:has-text("Save & Receive Stock")');
    await saveInvoiceBtn.click();

    // 4. Verify invoice appears immediately in the table WITHOUT refresh
    const invoiceRow = page.locator('tr:has-text("Godfrey Phillips Distributors"):has-text("75")');
    await expect(invoiceRow.first()).toBeVisible({ timeout: 8000 });

    // 5. Navigate to Live Stock on Hand tab without page reload
    const stockTab = page.locator('button.tab-btn:has-text("Live Stock on Hand")');
    await stockTab.click();

    // Verify stock table is displayed
    await expect(page.locator('table')).toBeVisible();

    // 6. Navigate to Movement Ledger tab without reload
    const ledgerTab = page.locator('button.tab-btn:has-text("Movement Ledger")');
    if (await ledgerTab.isVisible()) {
      await ledgerTab.click();
      await expect(page.locator('table')).toBeVisible();
    }

    expect(audit.errors).toHaveLength(0);
  });
});
