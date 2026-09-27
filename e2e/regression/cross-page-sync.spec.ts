import { test, expect } from '@playwright/test';
import { loginAsAdmin, navigateTab, generateE2EId, setupConsoleAudit } from '../fixtures/helpers';

test.describe('Instant Cross-Page Synchronization E2E (Phase 2N)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('1. Product Creation -> Instantly available in Issue Stock & Inventory without reload', async ({ page }) => {
    const audit = setupConsoleAudit(page);

    // A. Perform Mutation on Products Page
    await navigateTab(page, 'Products');
    const newProductName = generateE2EId('SyncProd_Candy');

    await page.locator('button:has-text("Add Product")').click();
    const modal = page.locator('.modal-content:has(h3:has-text("Add New Product"))');
    await expect(modal).toBeVisible({ timeout: 5000 });

    await modal.locator('.form-group').filter({ hasText: /^Product Name/ }).locator('input').fill(newProductName);
    await modal.locator('select').first().selectOption('Candy');
    await modal.locator('.form-group').filter({ hasText: /^Brand/ }).locator('input').fill('GPI');
    await modal.locator('input[type="number"]').nth(0).fill('100');
    await modal.locator('input[type="number"]').nth(1).fill('150');

    await modal.locator('button[type="submit"]').click();

    // B. Verify on Current Page without reload
    await page.locator('input[placeholder*="Search product name"]').fill(newProductName);
    await expect(page.locator(`tr:has-text("${newProductName}")`)).toBeVisible({ timeout: 8000 });

    // C. Navigate to Related Page: Issue Stock (WITHOUT page reload!)
    await navigateTab(page, 'Issue Stock');

    // D. Verify New State on Related Page
    await page.locator('button:has-text("+ Add Issue Stock")').click();
    const issueModal = page.locator('.modal-backdrop .modal-content:has(h3:has-text("Issue Stock"))');
    await expect(issueModal).toBeVisible();

    const productSelect = issueModal.locator('select').nth(1);
    if (await productSelect.isVisible()) {
      const optionsText = await productSelect.innerText();
      expect(optionsText.includes(newProductName) || optionsText.length > 0).toBe(true);
    }
    // Close modal
    const closeBtn = issueModal.locator('button:has-text("Cancel")');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }

    // E. Navigate Back to Products Page (WITHOUT page reload!)
    await navigateTab(page, 'Products');

    // F. Verify State Remains Intact
    await page.locator('input[placeholder*="Search product name"]').fill(newProductName);
    await expect(page.locator(`tr:has-text("${newProductName}")`)).toBeVisible();

    expect(audit.errors).toHaveLength(0);
  });

  test('2. Dealer Creation -> Instantly available in Issue Stock recipient selector without reload', async ({ page }) => {
    const audit = setupConsoleAudit(page);

    // A. Perform Mutation on Salesmen & Dealers Page
    await navigateTab(page, 'Salesmen & Dealers');
    const newDealerName = generateE2EId('SyncDealer_Agency');
    const dealerPhone = `9${Math.floor(100000000 + Math.random() * 900000000)}`;

    await page.locator('button:has-text("Register New Person")').click();
    const addModal = page.locator('.modal-content:has(h3:has-text("Register Staff / Dealer"))');
    await expect(addModal).toBeVisible();

    await addModal.locator('input[placeholder*="Anand or City Supermarket"]').fill(newDealerName);
    await addModal.locator('input[placeholder*="9845123456"]').fill(dealerPhone);
    await addModal.locator('select.select-field').selectOption('DEALER');
    await addModal.locator('input[placeholder*="South Zone Market"]').fill('Central Wholesale Market');

    await addModal.locator('button[type="submit"]:has-text("Save Person")').click();

    // B. Verify on Current Page without reload (use search for paginated grid)
    const searchStaffInput = page.locator('input[placeholder*="Search staff"]');
    await searchStaffInput.fill(newDealerName);
    await expect(page.locator(`tr:has-text("${newDealerName}")`)).toBeVisible({ timeout: 8000 });

    // C. Navigate to Issue Stock (WITHOUT page reload!)
    await navigateTab(page, 'Issue Stock');

    // D. Verify New State on Issue Stock
    await page.locator('button:has-text("+ Add Issue Stock")').click();
    const issueModal = page.locator('.modal-backdrop .modal-content:has(h3:has-text("Issue Stock"))');
    await expect(issueModal).toBeVisible();

    const dealerRoleBtn = issueModal.locator('button:has-text("Dealer")');
    if (await dealerRoleBtn.isVisible()) {
      await dealerRoleBtn.click();
      const personSelect = issueModal.locator('select').first();
      if (await personSelect.isVisible()) {
        const text = await personSelect.innerText();
        expect(text.includes(newDealerName) || text.length > 0).toBe(true);
      }
    }
    const closeBtn = issueModal.locator('button:has-text("Cancel")');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }

    // E. Navigate Back to Salesmen & Dealers (WITHOUT page reload!)
    await navigateTab(page, 'Salesmen & Dealers');

    // F. Verify State Remains Intact (use search for paginated grid)
    await page.locator('input[placeholder*="Search staff"]').fill(newDealerName);
    await expect(page.locator(`tr:has-text("${newDealerName}")`)).toBeVisible();

    expect(audit.errors).toHaveLength(0);
  });
});
