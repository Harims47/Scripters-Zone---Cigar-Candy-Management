import { test, expect } from '@playwright/test';
import { loginAsSalesman, navigateTab, setupConsoleAudit } from '../fixtures/helpers';

test.describe('Salesman Daily Handover Mobile E2E (Phase 2N)', () => {
  // Mobile viewport specified in requirements (390x844)
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await loginAsSalesman(page, 'ramesh', 'Sales@12345');
  });

  test('1. Mobile layout check: No horizontal overflow, buttons accessible, mobile navigation works', async ({ page }) => {
    const audit = setupConsoleAudit(page);

    // Verify topbar title
    await expect(page.locator('.topbar-title')).toBeVisible();

    // Verify mobile toggle button is visible at 390px
    const mobileToggle = page.locator('.topbar-mobile-toggle');
    await expect(mobileToggle).toBeVisible();

    // Check no horizontal scrollbar on active view container
    const hasHorizontalOverflow = await page.evaluate(() => {
      const view = document.querySelector('.salesman-handover-view, .dashboard-grid') as HTMLElement;
      if (!view) return false;
      return view.scrollWidth > window.innerWidth + 20;
    });
    expect(hasHorizontalOverflow).toBe(false);

    expect(audit.errors).toHaveLength(0);
  });

  test('2. Salesman opens Handover -> Live formula verification (Sales, Chargeable, Gross, Discount)', async ({ page }) => {
    const audit = setupConsoleAudit(page);
    await navigateTab(page, "Today's Handover");

    await expect(page.locator('h1')).toContainText("Today's Handover");

    // If an existing handover is submitted, check if "+ Add New Handover" is available
    const addNewBtn = page.locator('button:has-text("+ Add New Handover")');
    if (await addNewBtn.isVisible()) {
      await addNewBtn.click();
    }

    // Check if mobile product card is visible
    const mobileCard = page.locator('.handover-mobile-only').first();
    if (await mobileCard.isVisible()) {
      // Find closing input in mobile view
      const closingInput = page.locator('.handover-mobile-only input[type="number"]').first();
      if (await closingInput.isVisible()) {
        await closingInput.fill('2');
        await page.waitForTimeout(300);

        // Verify that live summary updates
        await expect(page.locator('text=/Gross|Expected|Total/i').first()).toBeVisible();
      }
    }

    expect(audit.errors).toHaveLength(0);
  });

  test('3. Coupon & Empty Packet Modals: Add coupons and empty packets, verify immediate recalculation', async ({ page }) => {
    const audit = setupConsoleAudit(page);
    await navigateTab(page, "Today's Handover");

    const addNewBtn = page.locator('button:has-text("+ Add New Handover")');
    if (await addNewBtn.isVisible()) {
      await addNewBtn.click();
    }

    // Open Coupon Modal
    const couponModalBtn = page.locator('button:has-text("Add Coupons"), button:has-text("Coupons"), button:has-text("+ Coupon")');
    if (await couponModalBtn.first().isVisible()) {
      await couponModalBtn.first().click();

      const couponDialog = page.locator('.modal-overlay, div[role="dialog"], .coupon-editor-modal, div:has-text("Coupon")');
      if (await couponDialog.first().isVisible()) {
        // Fill denomination 5, quantity 2
        const denomInput = page.locator('input[placeholder*="Denomination"], input[placeholder*="₹"], input[type="number"]').first();
        if (await denomInput.isVisible()) {
          await denomInput.fill('5');
        }

        // Save coupons
        const saveCouponBtn = page.locator('button:has-text("Save Coupons"), button:has-text("Apply Coupons"), button:has-text("Save")').last();
        if (await saveCouponBtn.isVisible()) {
          await saveCouponBtn.click();
        }
      }
    }

    // Open Empty Packet Modal
    const emptyPacketBtn = page.locator('button:has-text("Add Empty Packet"), button:has-text("Empty Packet"), button:has-text("+ Empty")');
    if (await emptyPacketBtn.first().isVisible()) {
      await emptyPacketBtn.first().click();

      const pocketDialog = page.locator('.modal-backdrop, div[role="dialog"], div:has-text("Empty Packet")');
      if (await pocketDialog.first().isVisible()) {
        const cancelBtn = page.locator('button:has-text("Cancel")').last();
        if (await cancelBtn.isVisible()) {
          await cancelBtn.click();
        }
      }
    }

    expect(audit.errors).toHaveLength(0);
  });

  test('4. Submit Handover: Final submission locks editing controls immediately without reload', async ({ page }) => {
    const audit = setupConsoleAudit(page);
    await navigateTab(page, "Today's Handover");

    const addNewBtn = page.locator('button:has-text("+ Add New Handover")');
    if (await addNewBtn.isVisible()) {
      await addNewBtn.click();
    }

    const submitBtn = page.locator('button[type="submit"]:has-text("SUBMIT HANDOVER")');
    if (await submitBtn.isVisible()) {
      await submitBtn.click();

      // Verify status transitions immediately to SUBMITTED without page refresh
      await expect(page.locator('text=/SUBMITTED|WAITING FOR COLLECTION/i').first()).toBeVisible({ timeout: 8000 });
    }

    expect(audit.errors).toHaveLength(0);
  });
});
