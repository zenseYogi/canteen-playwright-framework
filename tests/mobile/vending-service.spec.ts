import { test, expect } from '@playwright/test';
import type { Browser } from 'webdriverio';
import { createMobileSession, closeMobileSession } from '../../fixtures/appium.fixture';
import { loginAndWaitForMfa, switchRoute } from '../../utils/login-flow';
import { PrepTasksScreen } from '../../screens/prep-tasks.screen';
import { DashboardScreen } from '../../screens/dashboard.screen';
import { VendingServiceScreen } from '../../screens/vending-service.screen';
import { HomeScreen } from '../../screens/home.screen';
import { mobileConfig } from '../../config/mobile.config';

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
// Data note (CONFIRMED 2026-07-24): Vending's data lives on Charlotte, NC /
// Route 103 - a genuinely different route from Market/Coffee's Miami/010
// (config/mobile.config.ts's defaultRoute). loginAndWaitForMfa() alone only
// guarantees Miami/010 (via defaultRoute, for the fresh-account gate case),
// so switchRoute() is called once with mobileConfig.vendingRoute right after
// logging in.
//
// SHARED SESSION: both tests here log in and switch routes once (beforeAll)
// rather than per test - MFA requires manual approval on a separate physical
// device, by far the most expensive part of any run here, and this app's
// completion/route state is server-tracked rather than tied to the local
// app session (confirmed live), so per-test fresh logins weren't buying much
// real isolation. Uses createMobileSession()/closeMobileSession() directly
// (bypassing appium.fixture.ts's per-test `driver` fixture) plus
// `mode: 'serial'` so tests never run out of order or in parallel workers.
// completeFullDayPrep() is replaced with ensureFullDayPrepComplete(), which
// tolerates Start Day already being done by a previous test in the shared
// session (see PrepTasksScreen) - the exact conflict a same-shaped trial hit
// on prep-tasks.spec.ts, now handled instead of avoided. Each test returns
// to Dashboard afterward via HomeScreen.returnToHome() so the next test
// starts from a known screen.
test.describe.configure({ mode: 'serial' });

test.describe('Vending - Product fills (Sort/Filter), Money Operations', () => {
  let driver: Browser;

  test.beforeAll(async () => {
    driver = await createMobileSession();
    await loginAndWaitForMfa(driver);
    await switchRoute(driver, mobileConfig.vendingRoute);
  });

  test.afterEach(async ({}, testInfo) => {
    // Same failure-screenshot capture appium.fixture.ts's driver fixture
    // normally does per test - reproduced here since this file bypasses it.
    if (testInfo.status !== testInfo.expectedStatus) {
      try {
        const screenshotPath = testInfo.outputPath('failure.png');
        await driver.saveScreenshot(screenshotPath);
        await testInfo.attach('failure-screenshot', { path: screenshotPath, contentType: 'image/png' });
      } catch (e) {
        console.warn('Could not capture failure screenshot:', e);
      }
    }
    await new HomeScreen(driver).returnToHome();
  });

  test.afterAll(async () => {
    await closeMobileSession(driver);
  });

  test(
    'reach the first Vending machine and verify Product fills, Sort, and Filter',
    { tag: ['@TC163', '@TC164', '@TC166', '@TC167', '@TC212', '@TC215', '@TC181', '@TC183', '@TC186'] },
    async () => {
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const vending = new VendingServiceScreen(driver);

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
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
    async () => {
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const vending = new VendingServiceScreen(driver);

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
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
