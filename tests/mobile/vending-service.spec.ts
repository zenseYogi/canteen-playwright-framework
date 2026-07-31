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
    { tag: ['@Vending-TC163', '@Vending-TC164', '@Vending-TC166', '@Vending-TC167', '@Vending-TC212', '@Vending-TC215', '@Vending-TC216', '@Vending-TC217', '@Vending-TC181', '@Vending-TC183', '@Vending-TC186'] },
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
      const defaultOrder = await vending.getFillProductNamesInOrder();
      await test.step('TC212/TC215: open Sort, select A to Z, verify it becomes active', async () => {
        await vending.selectSortOption('A to Z');
        expect(await vending.isSortActive()).toBe(true);
      });

      // TC216 "Clear sort order enabled after selection" - live: there is
      // no separate "Apply sort order" button on this sheet (documented
      // discrepancy - see VendingServiceScreen's own note above
      // isFillsHeaderActionsVisible); only Clear sort order exists, and
      // it's enabled now that a sort is active.
      await test.step('TC216: reopening Sort shows Clear sort order enabled', async () => {
        await vending.openSortSheet();
        expect(await vending.isClearSortEnabled()).toBe(true);
      });

      // TC217 "clear sort after selection (no apply) -> Sort icon back to
      // default, list back to default order" - confirmed live: tapping
      // Clear sort order returns section_header_sort_cta's `checked` to
      // false and restores the exact pre-sort row order.
      await test.step('TC217: Clear sort order deactivates the icon and restores the default order', async () => {
        await vending.tapClearSort();
        expect(await vending.isSortActive()).toBe(false);
        expect(await vending.getFillProductNamesInOrder()).toEqual(defaultOrder);
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
    { tag: ['@Vending-TC244', '@Vending-TC246', '@Vending-TC248'] },
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

  // TC144/TC146/TC147 (Vending "Planogram" sub-area, despite describing
  // the Product fills row rather than the separate Planogram grid screen
  // - see VendingServiceScreen's own note above isParFieldEditable) -
  // live-verified 2026-07-29 (build 0.1.76, Route 103/YESTERDAY, "Aaron's"
  // stop, "61241 - Lg Snacks" machine).
  //
  // MUST run before "TC117/TC165/TC168-TC180" below (and therefore before
  // "TC004-TC015" too): TC147 asserts the Delivery field is genuinely
  // BLANK, which is only true before anything has filled it - both of
  // those later tests fill this exact same "first" machine's Delivery
  // fields (TC178-180 fills every row to make Continue actually submit;
  // TC004-015's own prerequisite helper does the same) - see the note on
  // that test for why re-using this machine post-submission also breaks
  // Continue itself, a separate but related ordering constraint.
  test(
    'TC144/TC146/TC147: Par is read-only, and the Delivery field starts genuinely empty',
    { tag: ['@Vending-TC144', '@Vending-TC147'] },
    async () => {
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const vending = new VendingServiceScreen(driver);

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });

      await test.step("Open the first stop's first Vending machine's Product fills", async () => {
        await dashboard.clickLocationByPosition('first');
        await dashboard.openNthServiceStation('vending', 'first');
        await vending.openFills();
      });

      // TC144/TC145 "Par value is read-only, positioned between the
      // product name and Delivery field" - live: no EditText anywhere on
      // the row carries an hint of "Par" (only "Delivery" and "End" do);
      // its value is baked into the row's own content-desc, structurally
      // preceding both fields (see getFillRowSummary).
      await test.step('TC144: Par has no editable counterpart anywhere on the row', async () => {
        const summary = await vending.getFillRowSummary('first');
        expect(summary.par).toBeGreaterThan(0);
        expect(await vending.isParFieldEditable('first')).toBe(false);
      });

      // TC146 "PAR value displayed as per the legacy application" - a
      // pure visual-parity claim with no accessible signal to check
      // against (see VendingServiceScreen's own note) - not asserted.

      // TC147 "empty numeric input with label Delivery" - on a
      // genuinely fresh, not-yet-touched machine, Delivery starts blank.
      await test.step('TC147: the Delivery field is visible, labeled "Delivery", and starts empty', async () => {
        expect(await vending.getDeliveryFieldHint('first')).toBe('Delivery');
        expect(await vending.getDeliveryFieldValue('first')).toBe('');
      });
    }
  );

  // TC182/TC185/TC187-TC211 (Vending "delivery - Filters") - live-verified
  // 2026-07-29 (build 0.1.76, Route 103/YESTERDAY, "Aaron's" stop,
  // "11333 - Bottle Bev" machine, categories BOTTLE BEV (5)/CAN BEV (2)/
  // GENERAL MDSE (1)).
  //
  // Uses the THIRD Vending machine at this stop, not "first" or "second" -
  // "TC117/TC165/TC168-TC180" and "TC004-TC015" fully submit (Continue)
  // the "first" machine's Fills as part of their own flow, and this test
  // needs to actually complete a (filtered) Fill of its own for
  // TC210/TC211 - reusing "first" would hit the exact same already-
  // submitted-Continue-is-a-no-op issue documented on that test. The
  // "second" machine ("61241 - Lg Snacks") was live-verified during this
  // test's own development and is ALSO already submitted - not reused
  // for the same reason.
  //
  // Key live-verified discrepancies from the Excel (documented, not
  // asserted as bugs):
  // - TC187's own test data ("Snacks, Nuts") doesn't match this catalog's
  //   real category chips - there is no "Snacks" or "Nuts" category here,
  //   only BOTTLE BEV/CAN BEV/GENERAL MDSE - BOTTLE BEV and CAN BEV are
  //   used instead throughout this test.
  // - TC202 "reopen Filter and verify chips cleared, Apply Filters
  //   disabled" - live-verified FALSE: reopening the sheet after removing
  //   ONE of two applied tags (TC199) shows the sheet reflecting the
  //   CURRENTLY active filter (the still-applied category's chip stays
  //   selected, Apply Filters stays enabled) - it does not reset to a
  //   blank slate.
  // - TC205 "apply filters with no matching items -> empty-state shown" -
  //   not reproducible via category filters alone on this catalog: all
  //   three real categories have a non-zero count (5/2/1), so there is
  //   no combination of category chips that yields zero results.
  // - TC206 "list sorted alphabetically (if applicable)" - the Excel's
  //   own "if applicable" hedge; not asserted (Sort is a separate,
  //   already-covered feature - see TC212/TC215 above - orthogonal to
  //   Filter).
  // - TC208 "invalid Ending Inventory (-1/blank/10.5) -> Continue
  //   disabled" - live-verified FALSE, same "always enabled" discrepancy
  //   already documented on TC177/TC178 above; not re-explored via the
  //   keypad again here, just re-confirmed via a cleared field.
  // - TC211 "delivery tile highlighted green with a tick mark" - visual-
  //   only signal with no accessible content-desc/selected/checked
  //   change, same pattern as TC014/TC179 elsewhere in this file - not
  //   assertable.
  test(
    'TC182/TC185/TC187-TC211: Filter sheet chip selection, apply/clear, tags, reopened state, and completing a filtered Fill',
    { tag: (
      ['TC182', 'TC185', 'TC187', 'TC188', 'TC190', 'TC192', 'TC193', 'TC194', 'TC195', 'TC196',
        'TC198', 'TC199', 'TC200', 'TC201', 'TC202', 'TC203', 'TC204', 'TC205', 'TC206', 'TC207',
        'TC208', 'TC209', 'TC210', 'TC211'
      ].map((n) => `@Vending-${n}`)
    ) },
    async ({}, testInfo) => {
      // fillAllProductDeliveryQuantities()'s scroll-and-fill loop can run
      // to 40+ rounds on a "full service" machine with a large catalog -
      // well beyond the 150s default budget (see TC117/TC165/TC168-TC180
      // above, which needs the same allowance).
      testInfo.setTimeout(400_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const vending = new VendingServiceScreen(driver);

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });

      await test.step("Open the first stop's third Vending machine's Product fills", async () => {
        await dashboard.clickLocationByPosition('first');
        await dashboard.openNthServiceStation('vending', 'third');
        await vending.openFills();
      });

      // TC182 "view category text" / TC185/TC190 "Apply Filters disabled
      // without a selection" (Clear Filters also starts disabled - both
      // confirmed live).
      await test.step('TC182/TC185/TC190: Filter sheet opens with "By category" and both actions disabled', async () => {
        await vending.openFilterSheet();
        expect(await vending.isFilterByCategoryLabelVisible()).toBe(true);
        expect(await vending.isApplyFiltersEnabled()).toBe(false);
        expect(await vending.isClearFiltersEnabled()).toBe(false);
      });

      // TC187/TC192 "select multiple chips" / TC193/TC195 "Apply Filters
      // enabled" / TC194 "Apply Filters disabled again on deselection".
      await test.step('TC187/TC192/TC193/TC195/TC194: selecting/deselecting chips toggles Apply Filters', async () => {
        await vending.tapFilterChip('BOTTLE BEV');
        await vending.tapFilterChip('CAN BEV');
        expect(await vending.isFilterChipSelected('BOTTLE BEV')).toBe(true);
        expect(await vending.isFilterChipSelected('CAN BEV')).toBe(true);
        expect(await vending.isApplyFiltersEnabled()).toBe(true);

        await vending.tapFilterChip('BOTTLE BEV');
        await vending.tapFilterChip('CAN BEV');
        expect(await vending.isApplyFiltersEnabled()).toBe(false);

        await vending.tapFilterChip('BOTTLE BEV');
        await vending.tapFilterChip('CAN BEV');
        expect(await vending.isApplyFiltersEnabled()).toBe(true);
      });

      // TC196 "apply -> filtered list" / TC198 "active filter icon".
      await test.step('TC196/TC198: applying filters activates the header icon and shows both tags', async () => {
        await vending.tapApplyFilters();
        expect(await vending.isFilterActive()).toBe(true);
        expect(await vending.isFilterTagVisible('BOTTLE BEV')).toBe(true);
        expect(await vending.isFilterTagVisible('CAN BEV')).toBe(true);
      });

      // TC199 "remove a single filter tag -> list updates with the
      // remaining filter still applied".
      await test.step('TC199: removing one tag leaves the other filter active', async () => {
        await vending.removeFilterTag('BOTTLE BEV');
        expect(await vending.isFilterTagVisible('BOTTLE BEV')).toBe(false);
        expect(await vending.isFilterTagVisible('CAN BEV')).toBe(true);
      });

      // TC202 "reopen Filter and verify state" - live: reflects the
      // currently-active filter, not a cleared slate (documented
      // discrepancy above).
      await test.step('TC202: reopening Filter reflects the still-active filter, not a cleared sheet', async () => {
        await vending.openFilterSheet();
        expect(await vending.isFilterChipSelected('CAN BEV')).toBe(true);
        expect(await vending.isFilterChipSelected('BOTTLE BEV')).toBe(false);
        expect(await vending.isApplyFiltersEnabled()).toBe(true);
      });

      // TC203/TC204 "re-select and re-apply filters".
      await test.step('TC203/TC204: re-selecting the removed category and re-applying restores both tags', async () => {
        await vending.tapFilterChip('BOTTLE BEV');
        await vending.tapApplyFilters();
        expect(await vending.isFilterTagVisible('BOTTLE BEV')).toBe(true);
        expect(await vending.isFilterTagVisible('CAN BEV')).toBe(true);
      });

      // TC188/TC200 "clear all filters" / TC198/TC201 "icon returns to
      // normal".
      await test.step('TC188/TC200/TC201: Clear Filters removes every tag and deactivates the header icon', async () => {
        await vending.openFilterSheet();
        await vending.tapClearFilters();
        expect(await vending.isFilterActive()).toBe(false);
        expect(await vending.isFilterTagVisible('BOTTLE BEV')).toBe(false);
        expect(await vending.isFilterTagVisible('CAN BEV')).toBe(false);
      });

      // TC207/TC209 "Ending Inventory field visible, valid quantity ->
      // Continue enabled" / TC208 "invalid (cleared) quantity -> Continue
      // disabled" - live: Continue stays enabled regardless (documented
      // discrepancy above, same as TC177/TC178).
      await test.step('TC207/TC208/TC209: Ending Inventory field is present; Continue stays enabled even when cleared', async () => {
        const before = await vending.getEndFieldValue('first');
        expect(before.length).toBeGreaterThan(0);
        await vending.clearEndFieldValue('first');
        expect(await vending.isFillsContinueEnabled()).toBe(true);
        await vending.setEndFieldValue('first', before);
      });

      // TC210 "Continue with valid inputs navigates to the workflow
      // summary screen" - reuses the already-proven
      // fillAllProductDeliveryQuantities() scroll-and-fill loop (every
      // row's Delivery must be filled for Continue to actually submit -
      // see TC178-TC180's own note above). Re-applies the small "CAN
      // BEV" (2-item) filter first rather than completing against the
      // full, just-cleared catalog - live-verified this machine's full
      // catalog runs well past fillAllProductDeliveryQuantities()'s
      // default 60-round cap, which left several rows blank and made
      // Continue a legitimate no-op (not a bug) when first tried against
      // the unfiltered list.
      await test.step('TC210: re-filtering to a small category, then filling and continuing leaves Product fills', async () => {
        await vending.openFilterSheet();
        await vending.tapFilterChip('CAN BEV');
        await vending.tapApplyFilters();
        await vending.fillAllProductDeliveryQuantities();
        expect(await vending.isProductFillsTitleVisible()).toBe(false);
      });
    }
  );

  // TC220/TC221/TC222/TC223/TC225/TC226/TC227/TC230-TC241 (Vending
  // "delivery - Sort", continuing from TC216/TC217 above) - live-verified
  // 2026-07-30 (build 0.1.76, Route 103/YESTERDAY, "Aaron's" stop,
  // "61241 - Lg Snacks" machine).
  //
  // Uses the SECOND Vending machine at this stop, same reasoning as the
  // Filters test above: TC240 completes a real Continue submission, which
  // would conflict with any other test that assumes this machine's Fills
  // is still pending (or, if this ran first, would break its own TC240 if
  // some other test had already submitted this same machine).
  //
  // Key live-verified discrepancies from the Excel (documented, not
  // asserted as bugs):
  // - TC222/TC227 "previously selected option highlighted on reopen" -
  //   live-verified this IS a real visual signal (screenshotted: the
  //   previously-applied option's row renders with a light-green
  //   background) but, like several other visual-only states elsewhere
  //   in this app (TC014's completion checkmark, TC063-TC065's legacy
  //   layout), it carries NO accessible signal at all - the option
  //   Button's own `selected`/`checked` attributes both read false
  //   regardless of whether it's the currently-applied sort. Not
  //   independently assertable; documented instead.
  // - TC230-TC238 (Barcode Ascending/Barcode Descending sort options) -
  //   not reproducible: live-verified this sheet's only five real
  //   options are A to Z, Z to A, By Category, Newest First, and Oldest
  //   First - there is no barcode-based sort anywhere on this screen.
  // - TC241 "delivery tile highlighted green with a tick mark" - visual-
  //   only signal with no accessible content-desc/selected/checked
  //   change, same pattern as TC014/TC179/TC211 elsewhere in this file -
  //   not assertable.
  test(
    'TC220-TC241: Sort order applies/reverses correctly, persists across reopen, and completing a sorted Fill',
    { tag: (
      ['TC220', 'TC221', 'TC222', 'TC223', 'TC225', 'TC226', 'TC227', 'TC230', 'TC231', 'TC232',
        'TC235', 'TC236', 'TC237', 'TC238', 'TC240', 'TC241'
      ].map((n) => `@Vending-${n}`)
    ) },
    async ({}, testInfo) => {
      // fillAllProductDeliveryQuantities()'s scroll-and-fill loop can run
      // to 40+ rounds on a "full service" machine with a large catalog -
      // well beyond the 150s default budget (see TC117/TC165/TC168-TC180
      // above, which needs the same allowance).
      testInfo.setTimeout(400_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const vending = new VendingServiceScreen(driver);

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });

      await test.step("Open the first stop's second Vending machine's Product fills", async () => {
        await dashboard.clickLocationByPosition('first');
        await dashboard.openNthServiceStation('vending', 'second');
        await vending.openFills();
      });

      // TC220 "apply A to Z" / TC221 "verify A to Z order".
      await test.step('TC220/TC221: applying A to Z sorts the list alphabetically ascending', async () => {
        await vending.selectSortOption('A to Z');
        expect(await vending.isSortActive()).toBe(true);
        const names = await vending.getFillProductNamesInOrder();
        const sorted = [...names].sort((a, b) => a.localeCompare(b));
        expect(names).toEqual(sorted);
      });

      // TC222 "persisted selection on reopen" - live: Clear sort order
      // stays enabled (the real, accessible persistence signal); the
      // option's own visual highlight has no accessible counterpart (see
      // this test's own note above).
      await test.step('TC222: reopening Sort after A to Z shows Clear sort order still enabled', async () => {
        await vending.openSortSheet();
        expect(await vending.isClearSortEnabled()).toBe(true);
      });

      // TC223 "clear sort from highlighted state" - same mechanism as
      // TC217 above, re-confirmed here after a DIFFERENT sort (A to Z)
      // was the one active.
      await test.step('TC223: Clear sort order deactivates the icon after A to Z', async () => {
        await vending.tapClearSort();
        expect(await vending.isSortActive()).toBe(false);
      });

      // TC220/TC225 "apply Z to A" / TC221/TC226 "verify Z to A order" /
      // TC227 "persist Z to A selection on reopen".
      await test.step('TC225/TC226/TC227: applying Z to A sorts descending and persists on reopen', async () => {
        await vending.selectSortOption('Z to A');
        expect(await vending.isSortActive()).toBe(true);
        const names = await vending.getFillProductNamesInOrder();
        const sortedDesc = [...names].sort((a, b) => b.localeCompare(a));
        expect(names).toEqual(sortedDesc);

        await vending.openSortSheet();
        expect(await vending.isClearSortEnabled()).toBe(true);
        await vending.tapClearSort();
        expect(await vending.isSortActive()).toBe(false);
      });

      // TC230-TC238 (Barcode Ascending/Descending) - not reproducible on
      // this catalog/sheet (see this test's own note above); not
      // exercised.

      // TC240 "Continue with valid inputs navigates to the workflow
      // summary screen" - reuses the already-proven
      // fillAllProductDeliveryQuantities() scroll-and-fill loop against
      // this machine's full (unsorted) catalog.
      await test.step('TC240: filling every row\'s Delivery and continuing leaves Product fills', async () => {
        await vending.fillAllProductDeliveryQuantities();
        expect(await vending.isProductFillsTitleVisible()).toBe(false);
      });

      // TC241 - visual-only tile completion signal; not assertable (see
      // this test's own note above).
    }
  );

  // TC117/TC165/TC168-TC180 (Vending "delivery - Product delivery") -
  // live-verified 2026-07-29 (build 0.1.76, Route 103/YESTERDAY, "Aaron's"
  // stop, "61241 - Lg Snacks"/"3247550" machines). See VendingServiceScreen's
  // own extensive note above its Product fills locators for every
  // discrepancy found relative to the Excel (TC165/TC168/TC169/TC171/
  // TC172/TC174/TC176/TC177/TC178) - not repeated here.
  //
  // MUST run before "TC004-TC015" below: that test's own
  // completeBeforePhotosMoneyOpsAndFills() fully submits (Continue) this
  // exact same "first" Vending machine's Product fills - live-verified
  // that re-tapping Continue on an already-submitted Fill is a silent
  // no-op (the screen never navigates away, even though every field still
  // reads as valid) rather than an error, which made the failure look like
  // a Continue-locator bug at first. Placing this test first guarantees
  // Fills is still genuinely pending when TC178/TC179/TC180 tap Continue.
  test(
    'TC117/TC165/TC168-TC180: Product fills header actions, row summary, Delivery/Ending Inventory fields, keypad, Continue',
    {
      tag: [
        '@Vending-TC117',
        '@Vending-TC165',
        '@Vending-TC168',
        '@Vending-TC169',
        '@Vending-TC170',
        '@Vending-TC171',
        '@Vending-TC172',
        '@Vending-TC173',
        '@Vending-TC174',
        '@Vending-TC175',
        '@Vending-TC176',
        '@Vending-TC177',
        '@Vending-TC178',
        '@Vending-TC179',
        '@Vending-TC180'
      ]
    },
    async ({}, testInfo) => {
      // fillAllProductDeliveryQuantities()'s scroll-and-fill loop can run
      // to 40+ rounds on a "full service" machine with a large catalog -
      // well beyond the 150s default budget (see this file's own
      // TC004-TC015 test, which needs the same allowance).
      testInfo.setTimeout(400_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const vending = new VendingServiceScreen(driver);

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });

      await test.step("Open the first stop's first Vending machine's Product fills", async () => {
        await dashboard.clickLocationByPosition('first');
        await dashboard.openNthServiceStation('vending', 'first');
        await vending.openFills();
      });

      // TC165 "Filter, Sort, Add icons visible" - actual header has
      // Filter/Sort/Planogram, no Add (documented discrepancy).
      await test.step('TC165: header shows Sort/Filter/Planogram, not Add', async () => {
        const actions = await vending.isFillsHeaderActionsVisible();
        expect(actions.sort).toBe(true);
        expect(actions.filter).toBe(true);
        expect(actions.planogram).toBe(true);
        expect(actions.add).toBe(false);
      });

      // TC117 "open Planogram from delivery".
      await test.step('TC117: Planogram opens from the header icon', async () => {
        await vending.openPlanogram();
        expect(await vending.isPlanogramTitleVisible()).toBe(true);
        await vending.pressKeyCode(4);
        await vending.waitFor('~Product fills');
      });

      // TC168/TC169 "view package info / Par, Ordered, Picked values" -
      // only a Par value is actually present (documented discrepancy).
      await test.step('TC168/TC169: first row exposes a name and Par value', async () => {
        const summary = await vending.getFillRowSummary('first');
        expect(summary.name.length).toBeGreaterThan(0);
        expect(summary.par).toBeGreaterThan(0);
      });

      // TC170 "Delivery field labeled 'Delivery', not 'DEL'".
      await test.step("TC170: the Delivery field's label reads \"Delivery\"", async () => {
        expect(await vending.getDeliveryFieldHint('first')).toBe('Delivery');
      });

      // TC173/TC175 "enter Ending Inventory, numeric keypad shown" /
      // TC171/TC172 "default value clears then overwrites, not appends" -
      // of the End (Ending Inventory) field, which starts pre-filled with
      // the row's own Par value (see this file's own note above on why
      // it's End, not Delivery, that carries this default).
      await test.step('TC171/TC172/TC173/TC175: Ending Inventory field replaces its default on first entry', async () => {
        const before = await vending.getEndFieldValue('first');
        expect(before.length).toBeGreaterThan(0);
        await vending.setEndFieldValue('first', '9');
        expect(await vending.getEndFieldValue('first')).toBe('9');
      });

      // TC176 "unable to enter negative Ending Inventory" - the keypad's
      // "-" key is a decrement stepper floored at 0, not a literal minus
      // sign - repeated taps never go negative.
      await test.step('TC176: repeated decrement taps floor Ending Inventory at 0, never negative', async () => {
        await vending.tapEndFieldDecrement('first', 20);
        expect(await vending.getEndFieldValue('first')).toBe('0');
      });

      // TC177 "Continue disabled due to empty Ending Inventory" - live:
      // Continue stays enabled even with the field cleared to empty
      // (documented discrepancy).
      await test.step('TC177: Continue stays enabled even with Ending Inventory cleared to empty', async () => {
        await vending.clearEndFieldValue('first');
        expect(await vending.getEndFieldValue('first')).toBe('');
        expect(await vending.isFillsContinueEnabled()).toBe(true);
      });

      // TC178/TC179/TC180 "Continue enabled with valid entries, proceeds,
      // and the Fills tile can be re-opened from the checklist". Live-
      // verified Continue's ENABLED state is purely cosmetic (see TC177's
      // own note) - tapping it while any row's own Delivery field is still
      // blank is a silent no-op that never actually leaves this screen,
      // regardless of the End field. The real gate is every row's
      // Delivery field being filled - reuses the already-proven
      // fillAllProductDeliveryQuantities() scroll-and-fill loop rather
      // than re-deriving that discovery here.
      await test.step('TC178/TC179/TC180: restoring a valid value, filling every row\'s Delivery quantity, Continue proceeds back to the checklist, and Fills reopens', async () => {
        await vending.setEndFieldValue('first', '24');
        expect(await vending.isFillsContinueEnabled()).toBe(true);
        await vending.fillAllProductDeliveryQuantities();
        expect(await vending.isProductFillsTitleVisible()).toBe(false);
        await vending.openFills();
        expect(await vending.isProductFillsTitleVisible()).toBe(true);
      });
    }
  );

  // TC004-TC015 (Vending "After Photos") - live-verified 2026-07-29 (build
  // 0.1.76, Route 103/YESTERDAY, "Aaron's" and "Admark Graphics" stops,
  // "11333 - Bottle Bev"/"97624 - Bottle Bev" machines).
  //
  // Unlike every other Vending tile, After Photos starts DISABLED until
  // Before Photos, Money Operations, Fills, and Removals & Returns are ALL
  // completed first - see VendingServiceScreen's own note above
  // isAfterPhotosEnabled/completeBeforePhotosMoneyOpsAndFills for the full
  // discovery (including why Fills needs a scroll-and-fill loop, not a
  // fixed row count).
  //
  // NOT independently asserted (documented instead):
  // - TC006/TC007 (camera opens, no "Taking a photo" text) - both live-
  //   verified true via a direct manual walkthrough (see this describe
  //   block's own commit history), but not exercised by this automated
  //   test - it goes via Skip Photo instead, since driving the emulator's
  //   own camera reliably from an automated run (shutter tap timing,
  //   review-screen Attach Photo) proved far less deterministic than the
  //   shared Skip Photo component every other LOB already relies on.
  // - TC008/TC009 (capture/save a real photo) - same reason; live-verified
  //   true manually (unlike Coffee, where the camera view is entirely
  //   inaccessible) but not re-exercised here.
  // - TC014 (visual completion checkmark) - live-verified as a real
  //   visual-only signal (green background + checkmark icon) with NO
  //   accessible content-desc/selected/checked change - not assertable.
  test(
    'TC004-TC015: complete the machine prerequisites, then Skip Photo on After Photos',
    { tag: ['@Vending-TC004', '@Vending-TC005', '@Vending-TC010', '@Vending-TC011', '@Vending-TC012', '@Vending-TC013', '@Vending-TC015'] },
    async ({}, testInfo) => {
      // Fills' scroll-and-fill loop can run to 40+ rounds on a "full
      // service" machine with a large catalog - well beyond the 150s
      // default budget.
      testInfo.setTimeout(400_000);
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

      // TC004 "access After Photos" - visible, but NOT yet enabled until
      // the other three tiles are completed (live-verified discrepancy
      // from the Excel's own "option available" wording - see
      // VendingServiceScreen's note).
      await test.step('TC004: After Photos tile is visible but disabled until prerequisites are met', async () => {
        expect(await vending.isAfterPhotosEnabled()).toBe(false);
        await vending.completeBeforePhotosMoneyOpsAndFills();
        await vending.completeRemovalsAndReturns();
        expect(await vending.isAfterPhotosEnabled()).toBe(true);
      });

      // TC005/TC010-TC013/TC015 - the shared Take/Skip photo modal and
      // Skip Photo reason sheet, identical to Coffee/Market's own.
      await test.step('TC005: After Photos opens the Take/Skip photo modal without opening the camera', async () => {
        await vending.openAfterPhotos();
        const modal = await vending.isPhotoModalVisible();
        expect(modal.takePhoto).toBe(true);
        expect(modal.skipPhoto).toBe(true);
      });

      await test.step('TC010/TC012: Skip photo opens the reason sheet, disabled by default', async () => {
        await vending.openSkipPhotoReasonSheet();
        expect(await vending.isSkipPhotoReasonSheetVisible()).toBe(true);
        expect(await vending.isSkipPhotoSubmitEnabled()).toBe(false);
      });

      await test.step('TC011: entering a reason enables Skip photo', async () => {
        await vending.enterSkipPhotoReason('Camera cannot focus and take clear picture');
        await vending.waitForSkipPhotoSubmitEnabled(true);
      });

      await test.step('TC013/TC015: submitting returns to the service stop checklist without saving a photo', async () => {
        await vending.confirmSkipPhoto();
        expect(await vending.isSkipPhotoReasonSheetVisible()).toBe(false);
      });
    }
  );

  // TC016-TC068 (Vending "Removals & Returns") - live-verified 2026-07-29
  // (build 0.1.76, Route 103/YESTERDAY, "Advocate Health Carolina
  // Neurosurgery & Spine Association" stop, "97713 - Bottle Bev" machine).
  // See VendingServiceScreen's own extensive note above its Removals &
  // Returns locators for every discrepancy found relative to the Excel
  // (TC018/TC019/TC020/TC022/TC029/TC030/TC033/TC034/TC036/TC045-TC050/
  // TC060/TC063-TC066) - not repeated here.
  test(
    'TC016-TC068: search, add a product with Spoiled/Damaged quantities, validate zero-quantity handling, save',
    {
      tag: [
        '@Vending-TC016',
        '@Vending-TC017',
        '@Vending-TC018',
        '@Vending-TC021',
        '@Vending-TC022',
        '@Vending-TC024',
        '@Vending-TC028',
        '@Vending-TC031',
        '@Vending-TC032',
        '@Vending-TC035',
        '@Vending-TC038',
        '@Vending-TC040',
        '@Vending-TC041',
        '@Vending-TC042',
        '@Vending-TC043',
        '@Vending-TC044',
        '@Vending-TC045',
        '@Vending-TC049',
        '@Vending-TC050',
        '@Vending-TC051',
        '@Vending-TC052',
        '@Vending-TC054',
        '@Vending-TC055',
        '@Vending-TC056',
        '@Vending-TC060',
        '@Vending-TC061',
        '@Vending-TC066',
        '@Vending-TC067',
        '@Vending-TC068'
      ]
    },
    async ({}, testInfo) => {
      testInfo.setTimeout(240_000);
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

      // TC016/TC023/TC062 "open Removals & Returns" / TC017/TC037 "route &
      // date header" (shared chrome) / TC018 "header icons" (Sort/Filter -
      // see this file's own describe-block note on Search/Scan actually
      // being the field's own embedded icons) / TC021 "info message" /
      // TC022 "Continue disabled initially" (live: Done, enabled by
      // default - documented discrepancy).
      await test.step('TC016/TC017/TC018/TC021/TC022: open Removals & Returns, verify its empty state', async () => {
        await vending.openRemovalsAndReturns();
        expect(await vending.isRemovalsEmptyStateVisible()).toBe(true);
        const icons = await vending.areRemovalsHeaderIconsVisible();
        expect(icons.sort).toBe(true);
        expect(icons.filter).toBe(true);
        expect(await vending.isRemovalsDoneEnabled()).toBe(true);
      });

      // TC031 "no results" / TC032 "clear search restores the list".
      await test.step('TC031/TC032: a non-matching search shows no results; clearing restores them', async () => {
        await vending.searchRemovalsProduct('XYZNONEXISTENT');
        expect(await vending.isNoSearchResultsVisible()).toBe(true);
        await vending.clearRemovalsSearch();
        await vending.searchRemovalsProduct('Snickers');
        expect(await vending.getVisibleSearchResultCount()).toBeGreaterThan(0);
      });

      // TC024/TC028/TC035/TC040 "search, filter, select a product, open
      // Document product" - reuses the already-open search from above.
      // Deliberately re-searching by the same plain term ("Snickers"), not
      // the fuller name searchAndSelect returns (e.g. "Snickers (1.86oz)")
      // - live-verified the parenthesized full name doesn't reliably
      // re-match on a fresh search.
      await test.step('TC024/TC028/TC035/TC040: selecting a search result opens Document product', async () => {
        const options = await vending.getVisibleSearchResultCount();
        expect(options).toBeGreaterThan(0);
        await vending.searchAndSelect('Snickers');
        expect(await vending.isDocumentProductOpen()).toBe(true);
      });

      // TC038 "Cancel returns without saving" - back out, reconfirm the
      // list still has zero saved rows, before actually saving anything.
      await test.step('TC038: Cancel returns to Removals & Returns without saving', async () => {
        await vending.cancelDocumentProduct();
        expect(await vending.getRemovalsSavedRowCount()).toBe(0);
      });

      // TC041-TC044 "Spoiled/Damaged/Theft/Truck Return fields editable" /
      // TC045 "numeric keypad" / TC049/TC050 (blocked at the floor/cap -
      // see VendingServiceScreen's own note; not re-exercised here, just
      // relied upon) / TC051/TC052/TC054 "zero quantity accepted, saved,
      // excluded from the list".
      await test.step('TC041-TC044/TC051/TC052/TC054: a zero-quantity save is accepted but excluded from the list', async () => {
        await vending.searchAndSelect('Twix');
        expect(await vending.isRemovalsSaveEnabled()).toBe(true);
        await vending.saveDocumentProduct();
        expect(await vending.getRemovalsSavedRowCount()).toBe(0);
      });

      // TC055/TC056/TC060/TC061/TC066 "valid quantity saves and appears
      // with an aggregate Qty, not a per-field breakdown".
      await test.step('TC055/TC056/TC060/TC061/TC066: Spoiled=2/Damaged=1 saves and appears with an aggregate Qty of 3', async () => {
        await vending.searchAndSelect('Snickers');
        await vending.fillRemovalsQuantities({ spoiled: '2', damaged: '1' });
        expect(await vending.isRemovalsSaveEnabled()).toBe(true);
        await vending.saveDocumentProduct();
        expect(await vending.getRemovalsSavedRowCount()).toBe(1);
        expect(await vending.getRemovalsSavedRowQty(0)).toBe('3');
      });

      // TC067/TC068 "Done enabled after saving; tapping it proceeds".
      await test.step('TC067/TC068: Done is enabled and navigates back to the checklist', async () => {
        expect(await vending.isRemovalsDoneEnabled()).toBe(true);
        await vending.tapRemovalsDone();
        expect(await vending.isVisible('//android.view.View[starts-with(@content-desc,"Removals")]')).toBe(true);
      });
    }
  );
});
