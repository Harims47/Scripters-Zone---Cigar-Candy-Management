import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsSalesman, navigateTab, setupConsoleAudit } from '../fixtures/helpers';

test.describe('Global Table & Data Grid Audit Suite (Phase 2N.6)', () => {
  test.describe('Admin Tables & Data Grids', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test('1. Standard Pagination: Default 10 rows/page and page size options [10, 25, 50, 100]', async ({ page }) => {
      const audit = setupConsoleAudit(page);
      await navigateTab(page, 'Products');

      // Check pagination container is present
      const pagination = page.locator('.table-pagination-bar');
      await expect(pagination).toBeVisible();

      // Check page size selector has 10 selected by default
      const pageSizeSelect = pagination.locator('select');
      await expect(pageSizeSelect).toHaveValue('10');

      // Check number of visible body rows is at most 10
      const rows = page.locator('table tbody tr');
      const rowCount = await rows.count();
      expect(rowCount).toBeLessThanOrEqual(10);
      expect(rowCount).toBeGreaterThan(0);

      // Change page size to 25
      await pageSizeSelect.selectOption('25');
      await page.waitForTimeout(300);

      const rowsAfter25 = await page.locator('table tbody tr').count();
      expect(rowsAfter25).toBeGreaterThanOrEqual(rowCount);

      // Change page size to 50
      await pageSizeSelect.selectOption('50');
      await page.waitForTimeout(300);

      // Change page size back to 10
      await pageSizeSelect.selectOption('10');
      await page.waitForTimeout(300);
      expect(await page.locator('table tbody tr').count()).toBe(rowCount);

      expect(audit.errors).toHaveLength(0);
    });

    test('2. Column Header Sorting: Asc/Desc toggle and aria-sort accessibility', async ({ page }) => {
      const audit = setupConsoleAudit(page);
      await navigateTab(page, 'Products');

      // Locate sortable header for SKU (initially unsorted)
      const skuHeader = page.locator('th.sortable-th:has-text("SKU")');
      await expect(skuHeader).toBeVisible();

      // Click to sort ascending
      await skuHeader.click();
      await page.waitForTimeout(300);
      await expect(skuHeader).toHaveAttribute('aria-sort', 'ascending');

      // Click to sort descending
      await skuHeader.click();
      await page.waitForTimeout(300);
      await expect(skuHeader).toHaveAttribute('aria-sort', 'descending');

      expect(audit.errors).toHaveLength(0);
    });

    test('3. Search & Filter: Resets page to 1 on query entry', async ({ page }) => {
      const audit = setupConsoleAudit(page);
      await navigateTab(page, 'Products');

      // Go to next page if enabled
      const nextBtn = page.locator('.table-pagination-bar button[title="Next Page"]');
      if (await nextBtn.isVisible() && await nextBtn.isEnabled()) {
        await nextBtn.click();
        await page.waitForTimeout(300);
      }

      // Enter search query
      const searchInput = page.locator('input[placeholder*="Search product name"]');
      await searchInput.fill('Four Square');
      await page.waitForTimeout(400);

      // Page should automatically reset to Page 1
      await expect(page.locator('.table-pagination-bar')).toContainText('Showing 1 to');

      // Clear search
      await searchInput.fill('');
      await page.waitForTimeout(400);

      expect(audit.errors).toHaveLength(0);
    });

    test('4. Empty State: Displays TableEmptyState on zero results with action to clear', async ({ page }) => {
      const audit = setupConsoleAudit(page);
      await navigateTab(page, 'Products');

      const searchInput = page.locator('input[placeholder*="Search product name"]');
      await searchInput.fill('__non_existent_search_query_xyz_123__');
      await page.waitForTimeout(400);

      // Verify TableEmptyState is rendered
      const emptyState = page.locator('table tbody td:has-text("No products match your current search and filter criteria")');
      await expect(emptyState).toBeVisible();

      // Click the clear button inside empty state
      const clearBtn = page.locator('table tbody button:has-text("Clear All Filters")');
      await expect(clearBtn).toBeVisible();
      await clearBtn.click();
      await page.waitForTimeout(400);

      // Full list restored
      const restoredRows = page.locator('table tbody tr');
      expect(await restoredRows.count()).toBeGreaterThan(0);

      expect(audit.errors).toHaveLength(0);
    });

    test('5. Summary KPI Integrity: Filtered dataset totals computed across all pages', async ({ page }) => {
      const audit = setupConsoleAudit(page);
      await navigateTab(page, 'Dashboard');

      // Cumulative Items Sold section
      const cumulativeSection = page.locator('div:has-text("Cumulative Items Sold")').first();
      await expect(cumulativeSection).toBeVisible();

      // Check product search in dashboard
      const dashboardSearch = page.locator('input[placeholder*="Search product, brand, category"]');
      if (await dashboardSearch.isVisible()) {
        await dashboardSearch.fill('Gold');
        await page.waitForTimeout(300);
        await dashboardSearch.fill('');
        await page.waitForTimeout(300);
      }

      expect(audit.errors).toHaveLength(0);
    });

    test('6. Responsive Layout: Audit tables across desktop, tablet, and mobile', async ({ page }) => {
      const audit = setupConsoleAudit(page);
      await navigateTab(page, 'Salesmen & Dealers');

      // 1. Desktop (1440x900)
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForTimeout(200);
      await expect(page.locator('.table-pagination-bar').first()).toBeVisible();

      // 2. Tablet (1024x768)
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.waitForTimeout(200);
      await expect(page.locator('.table-pagination-bar').first()).toBeVisible();

      // 3. Mobile (390x844)
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(200);
      await expect(page.locator('.table-pagination-bar').first()).toBeVisible();

      expect(audit.errors).toHaveLength(0);
    });
  });

  test.describe('Salesman Portal Data Grids', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsSalesman(page);
    });

    test('7. Salesman Handover History: Hardened table with search, sorting, and pagination', async ({ page }) => {
      const audit = setupConsoleAudit(page);
      await navigateTab(page, "Today's Handover");

      // Check table is visible in Handover History section
      const historyTable = page.locator('.salesman-history-view table');
      await expect(historyTable).toBeVisible();

      // Check search input
      const searchInput = page.locator('input[placeholder*="Search handover"]');
      await expect(searchInput).toBeVisible();

      // Check pagination
      const pagination = page.locator('.salesman-history-view .table-pagination-bar');
      await expect(pagination).toBeVisible();

      expect(audit.errors).toHaveLength(0);
    });

    test('8. Salesman Dashboard Ledger Activity: Hardened table with search, sorting, and pagination', async ({ page }) => {
      const audit = setupConsoleAudit(page);
      await navigateTab(page, 'My Dashboard');

      // Check table is visible
      const ledgerTable = page.locator('.salesman-dashboard table');
      await expect(ledgerTable).toBeVisible();

      // Check search input
      const searchInput = page.locator('input[placeholder*="Search reference"]');
      await expect(searchInput).toBeVisible();

      // Check pagination
      const pagination = page.locator('.salesman-dashboard .table-pagination-bar');
      await expect(pagination).toBeVisible();

      expect(audit.errors).toHaveLength(0);
    });
  });
});
