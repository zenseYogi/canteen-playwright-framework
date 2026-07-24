import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndWaitForMfa } from '../../utils/login-flow';
import { PrepTasksScreen } from '../../screens/prep-tasks.screen';
import { DashboardScreen } from '../../screens/dashboard.screen';
import { MarketServiceScreen } from '../../screens/market-service.screen';

// PBI 611013 (Azure DevOps): "As a developer, I want to implement the Fill
// Screen in the Market Flow based on the Figma design so that the list
// screen, detail screen, and bottom-sheet sorting behave exactly as
// designed."
//
// Live-verified against build 0.1.76 (Miami, FL / Route 010, CureLeaf and
// FedEx stops) before writing anything here - the PBI's mockups describe two
// things this build does NOT yet have:
//   1. A two-tab Filter (By SKU product group + By category) - only "By
//      category" exists live; "By product group" is expected to be dropped
//      per direct confirmation from BA/QA, so not asserted here at all.
//   2. Multiple products with barcode details in the list - this account's
//      seeded catalog only ever shows one product per stop at a time, so
//      position-based helpers (default 'first') are used throughout rather
//      than iterating a real multi-item list.
//
// What IS live and covered here: each product row's "More info" expand icon
// (its only clickable child besides the Delivery quantity field - no
// content-desc/resource-id of its own, targeted structurally) reveals Par
// Stock/Ordered/Picked (appended to the row's own content-desc, not separate
// elements) plus Theft/Damaged/Returned/Spoiled/Delivery entry fields -
// exactly the PBI's step 3. Filter selection reuses BaseScreen's Sort/Filter
// helpers already proven on Vending, via a new prefix-based category
// selector (selectFilterCategoryByPrefix) since the chip's label includes a
// live product count suffix (e.g. "CANDY (1)") that isn't stable day to day.
test.describe('Market - Fill Screen (PBI 611013)', () => {
  test('review Par/Ordered/Picked and enter Theft/Damaged/Returned/Spoiled/Delivered quantities', async ({ driver }) => {
    const prepTasks = new PrepTasksScreen(driver);
    const dashboard = new DashboardScreen(driver);
    const market = new MarketServiceScreen(driver);

    await test.step('Log in', async () => {
      await loginAndWaitForMfa(driver);
    });

    await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
      await prepTasks.openFromHamburgerMenu();
      await prepTasks.completeFullDayPrep();
    });

    await test.step("Open a Market location's service station", async () => {
      await dashboard.clickLocationByPosition('second');
      await dashboard.openFirstServiceStation('market');
    });

    await test.step('Step 1/2: tap Fills, verify the refill list loaded', async () => {
      await market.openFills();
      expect(await market.isProductFillsTitleVisible()).toBe(true);
    });

    await test.step('Step 3: expand the first product, verify Par/Ordered/Picked are visible', async () => {
      await market.expandProductFill('first');
      const review = await market.getProductFillReview('first');
      expect(Number.isNaN(review.par)).toBe(false);
      expect(Number.isNaN(review.ordered)).toBe(false);
      expect(Number.isNaN(review.picked)).toBe(false);

      const fields = await market.isFillEntryVisible('first');
      expect(fields.theft).toBe(true);
      expect(fields.damaged).toBe(true);
      expect(fields.returned).toBe(true);
      expect(fields.spoiled).toBe(true);
      expect(fields.delivered).toBe(true);
    });

    await test.step('Step 3: enter Theft/Damaged/Returned/Spoiled and Delivered Quantity', async () => {
      await market.enterFillQuantities('first', {
        theft: '0',
        damaged: '0',
        returned: '0',
        spoiled: '0',
        delivered: '10'
      });
    });
  });

  test('Step 4: filter Product fills by category', async ({ driver }) => {
    const prepTasks = new PrepTasksScreen(driver);
    const dashboard = new DashboardScreen(driver);
    const market = new MarketServiceScreen(driver);

    await test.step('Log in', async () => {
      await loginAndWaitForMfa(driver);
    });

    await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
      await prepTasks.openFromHamburgerMenu();
      await prepTasks.completeFullDayPrep();
    });

    await test.step("Open a Market location's service station", async () => {
      await dashboard.clickLocationByPosition('second');
      await dashboard.openFirstServiceStation('market');
    });

    await test.step('Open Fills, then filter by category and verify it becomes active', async () => {
      await market.openFills();
      // "By product group" is not asserted - confirmed obsolete/deprioritized
      // directly by BA/QA. Only "By category" (live) is exercised here.
      await market.selectFilterCategoryByPrefix('CANDY');
      expect(await market.isFilterActive()).toBe(true);
    });
  });
});
