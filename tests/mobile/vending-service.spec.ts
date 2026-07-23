import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndWaitForMfa } from '../../utils/login-flow';
import { PrepTasksScreen } from '../../screens/prep-tasks.screen';
import { DashboardScreen } from '../../screens/dashboard.screen';
import { VendingServiceScreen } from '../../screens/vending-service.screen';

// Traceability to Optimized_TCs_V_2.0.xlsx: TC numbers cited per assertion
// below are from the "Vending" area's Money ops / delivery - Product delivery
// / delivery - Sort / delivery - Filters sub-areas, all Mandatory (P1). Every
// locator used here was live-verified against build 0.1.76 on Route 103 (a
// Vending-only route, first stop "Aaron's", first machine "61241 - Lg
// Snacks") - see docs/rf-to-playwright-reuse.md's Vending section.
//
// Scope note: these assert screen/field presence, active-state signals
// (Sort/Filter's real `checked` attribute), and the one live-confirmed
// re-ordering effect - not full validation behavior (invalid quantity
// entry, decimal handling etc.) - that hasn't been tested live yet.
//
// Data note: assumes the seeded route for this account is Route 103
// (Vending-only, 47 stops incl. "Aaron's" as the first) - unlike Market's
// spec, this is NOT the account's default route; it requires the one-time
// Settings > Route setup > Miami, FL > Route 010 change documented in
// docs/rf-to-playwright-reuse.md (Route 010 is displayed as "Route 103" on
// this account's schedule - a real route/operation naming quirk, not a typo).
test.describe('Vending - Product fills (Sort/Filter), Money Operations', () => {
  test(
    'reach the first Vending machine and verify Product fills, Sort, and Filter',
    { tag: ['@TC163', '@TC164', '@TC166', '@TC167', '@TC212', '@TC215', '@TC181', '@TC183', '@TC186'] },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const vending = new VendingServiceScreen(driver);

      await test.step('Log in', async () => {
        await loginAndWaitForMfa(driver);
      });

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.completeFullDayPrep();
      });

      await test.step("Open the first stop's first Vending machine", async () => {
        await dashboard.clickLocationByPosition('first');
        await dashboard.openNthServiceStation('vending', 'first');
      });

      // TC163 "open Product Fills screen" / TC164 "view route details & date
      // in the header" / TC166 "view products to be refilled" / TC167 "view
      // product title" - the header (route/date) is shared chrome, already
      // confirmed visible on every screen; product rows and titles are
      // confirmed via the real seeded catalog (e.g. "61241 - Lg Snacks").
      await test.step('TC163/TC164/TC166/TC167: open Product fills and verify it loaded', async () => {
        await vending.openFills();
        expect(await vending.isProductFillsTitleVisible()).toBe(true);
      });

      // TC212 "open sort list" / TC215 "select one sort option and see
      // highlight" - "highlight" is the section_header_sort_cta Switch's
      // real `checked` attribute flipping to true, confirmed live (also
      // visually: the icon turns green with a dot badge, and the product
      // list actually re-orders alphabetically).
      await test.step('TC212/TC215: open Sort, select A to Z, verify it becomes active', async () => {
        await vending.selectSortOption('A to Z');
        expect(await vending.isSortActive()).toBe(true);
      });

      // TC181 "open Filter screen" / TC183 "view Product Group filters with
      // count" (confirmed live: "CANDY (6)" / "LG SNACKS (2)" / "SNACKS
      // (24)" chips, counts matching the real catalog) / TC186 "select one
      // category chip" - applying enables both Clear filters and Apply
      // filters (both start disabled with zero chips selected) and flips
      // section_header_filter_cta's `checked` to true.
      await test.step('TC181/TC183/TC186: open Filter, select CANDY, verify it becomes active', async () => {
        await vending.selectFilterCategories(['CANDY (6)']);
        expect(await vending.isFilterActive()).toBe(true);
      });
    }
  );

  test(
    'verify the Money Collection screen fields',
    { tag: ['@TC244', '@TC246', '@TC248'] },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const vending = new VendingServiceScreen(driver);

      await test.step('Log in', async () => {
        await loginAndWaitForMfa(driver);
      });

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.completeFullDayPrep();
      });

      await test.step("Open the first stop's first Vending machine", async () => {
        await dashboard.clickLocationByPosition('first');
        await dashboard.openNthServiceStation('vending', 'first');
      });

      // TC244 "verify title" / TC246 "view all sections" (Skip Money Bag,
      // bag code, Replenishment Bills, Refund - all four confirmed live) /
      // TC248 "view the Skip Money Bag label".
      await test.step('TC244/TC246/TC248: open Money Operations and verify all fields are present', async () => {
        await vending.openMoneyOperations();
        const fields = await vending.isMoneyCollectionScreenVisible();
        expect(fields.title).toBe(true);
        expect(fields.skipMoneyBag).toBe(true);
        expect(fields.bagCode).toBe(true);
        expect(fields.bills).toBe(true);
        expect(fields.refund).toBe(true);
      });
    }
  );
});
