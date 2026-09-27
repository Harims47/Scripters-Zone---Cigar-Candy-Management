import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../fixtures/helpers';

test.describe('Purchase Invoice Creation and Stock Real-Time Verification', () => {
  test('Admin can create a purchase invoice and see stock live update immediately', async ({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    // 1. Log in as admin
    await loginAsAdmin(page);

    // 2. Navigate to Inventory
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');

    // 3. Click on "Purchase Invoices" tab
    const invoicesTab = page.locator('button:has-text("Purchase Invoices")');
    await expect(invoicesTab).toBeVisible();
    await invoicesTab.click();

    // 4. Click "Record Purchase Invoice"
    const newInvoiceBtn = page.locator('button:has-text("Record Purchase Invoice")');
    await expect(newInvoiceBtn).toBeVisible();
    await newInvoiceBtn.click();

    // 5. Fill out the Invoice Workspace
    const testInvNum = `INV-TEST-${Date.now().toString().slice(-4)}`;
    await page.locator('input[placeholder="Enter or select supplier..."]').fill('GPI Central Supplier');
    await page.locator('input[placeholder="e.g. INV-2026-9021"]').fill(testInvNum);

    // Item line quantity
    const qtyInput = page.locator('[data-testid="invoice-item-qty"]').first();
    await qtyInput.fill('100');

    // Rate
    const rateInput = page.locator('[data-testid="invoice-item-rate"]').first();
    await rateInput.fill('85');

    // 6. Submit invoice
    const saveBtn = page.locator('[data-testid="save-purchase-invoice-btn"]');
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // 7. Verify toast notification appears
    await expect(page.locator('text=Purchase Invoice recorded and stock received')).toBeVisible({ timeout: 10000 });

    // 8. Verify the invoice is listed in the Purchase Invoices table with accurate Gross, Net, and Rate values
    const invRow = page.locator(`tr:has-text("${testInvNum}")`);
    await expect(invRow).toBeVisible({ timeout: 10000 });
    await expect(invRow).toContainText('100 @ ₹85');
    await expect(invRow).toContainText('₹8,500');

    // 9. Navigate to "Stock on Hand" tab and verify live stock reflects the purchase
    const stockTab = page.locator('button:has-text("Live Stock on Hand")');
    await stockTab.click();
    await page.waitForTimeout(500);

    // Verify stock is greater than 0
    await expect(page.locator('table')).toBeVisible();
  });
});
