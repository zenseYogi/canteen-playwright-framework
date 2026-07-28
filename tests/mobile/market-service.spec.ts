import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndWaitForMfa, switchRoute } from '../../utils/login-flow';
import { PrepTasksScreen } from '../../screens/prep-tasks.screen';
import { DashboardScreen } from '../../screens/dashboard.screen';
import { MarketServiceScreen } from '../../screens/market-service.screen';
import { mobileConfig } from '../../config/mobile.config';

// Traceability to Optimized_TCs_V_2.0.xlsx: TC numbers cited per assertion
// below are from the "Market" area's Delivery / Delivery-Add Product /
// Money Operation - Multiple POS sub-areas. Every locator used here was
// live-verified against build 0.1.73 - see docs/rf-to-playwright-reuse.md's
// "Live verification session" section.
//
// Scope note: these assert field/screen PRESENCE and reachability, not
// validation BEHAVIOR (reject negative/alphabetic input, decimal handling,
// max length etc.) - that hasn't been tested live yet.
//
// Data note: navigating to a Market location assumes this environment's
// seeded route data is stable across sessions (confirmed across this
// session's app relaunches) - the second dashboard location is a Market stop.
test.describe('Market - Delivery, Add Product, Money Operations', () => {
  test('reach a Market location and verify the Money Collection screen fields', async ({ driver }) => {
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

    // NOT tagged to any Excel TC: the Excel's only Market money-handling
    // sub-area is "Money Operation - Multiple POS" (TC308-TC327), which
    // describes a POS LIST screen (TC308 "view POS list", TC310 "view
    // multiple POS entries") - this location's Money Operations opened
    // straight to a single bag-code/coins/bills/refund form with no POS
    // list at all. Unclear whether Multiple POS is a genuinely different
    // screen (more registers at a location) or this single-entry form is
    // its one-POS state - unconfirmed either way, so no TC is claimed here.
    // This still verifies real, useful screen structure - just not
    // provably the Excel's documented scenario.
    await test.step('Verify Money Collection screen fields are present', async () => {
      await market.openMoneyOperations();
      const fields = await market.isMoneyCollectionScreenVisible();
      expect(fields.title).toBe(true);
      expect(fields.skipMoneyBag).toBe(true);
      expect(fields.bagCode).toBe(true);
      expect(fields.coins).toBe(true);
      expect(fields.bills).toBe(true);
      expect(fields.refund).toBe(true);
    });
  });

  test(
    'reach Product fills and verify the Add Product entry screen',
    { tag: ['@TC147', '@TC149', '@TC153'] },
    async ({ driver }) => {
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

      // TC147 "open Add Product flow from top" / TC149 "view screen heading
      // and title" / TC153 "view Cancel and Add buttons disabled (no input)".
      // TC153 nuance: live-verified only Add is actually disabled
      // (enabled="false") - Cancel is enabled="true" throughout (makes UX
      // sense: you can always back out, only submitting requires input).
      // The assertions below reflect the real behavior, not TC153's
      // possibly-ambiguous "Cancel and Add buttons disabled" wording taken
      // literally as "both disabled".
      await test.step('TC147/TC149: open Product fills, then Add Product, and verify its title', async () => {
        await market.openAddProductFromFills();
        expect(await market.isAddProductScreenVisible()).toBe(true);
      });

      await test.step('TC153: verify Cancel is enabled and Add is disabled with no input', async () => {
        const buttons = await market.addProductButtonStates();
        expect(buttons.cancelEnabled).toBe(true);
        expect(buttons.addEnabled).toBe(false);
      });
    }
  );

  // Sub Area "Header". Uses Route 10/TODAY + position 'first' explicitly -
  // live-verified 2026-07-27 that on this day the Market stop ("CuraLeaf")
  // is the FIRST dashboard location, not the second (Coffee's "Nova
  // Innovation" is second) - the reverse of the assumption the tests above
  // were built on (which also predate today and use the still-stale
  // defaultRoute/YESTERDAY day, unrelated to this test). Location ordering
  // is seed-data-dependent, not a fixed contract - don't assume position
  // 'second' is always Market.
  test(
    'TC010: view the account location name as the delivery header',
    { tag: ['@TC010'] },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const market = new MarketServiceScreen(driver);

      await test.step('Log in, switch to Route 10/TODAY', async () => {
        await loginAndWaitForMfa(driver);
        await switchRoute(driver, { ...mobileConfig.defaultRoute, day: 'TODAY' });
      });

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });

      // TC010 "view the delivery header" - Excel's Test Data references a
      // different account name ("Goodwill / Rutherford") than what's
      // actually seeded here ("CuraLeaf") - expected, seed data varies by
      // environment; the claim being tested is that SOME account name
      // renders as the bold header, not a specific literal string.
      //
      // NOT asserted: TC011 ("account location name displayed instead of
      // POS/equipment ID on the Market product recording screen") and
      // TC012 ("the same account location name persists across Market
      // delivery and product screens") - both live-verified FALSE. Opening
      // Delivery (Product fills) replaces the header entirely with the
      // feature name "Product fills" - the account name ("CuraLeaf")
      // doesn't appear anywhere on that screen at all, so it neither
      // "persists" (TC012) nor "displays instead of POS/equipment ID"
      // (TC011, which also doesn't show a POS/equipment ID to be replacing).
      await test.step("TC010: open a Market location's service stop and verify the account name is the bold header", async () => {
        await dashboard.clickLocationByPosition('first');
        await dashboard.openFirstServiceStation('market');
        expect(await market.isServiceStopLocationHeaderVisible()).toBe(true);
        const headerText = await market.getServiceStopLocationHeaderText();
        expect(headerText.length).toBeGreaterThan(0);
      });
    }
  );

  // Sub Area "Before Photo". Originally live-verified via Coffee's own
  // "Before Photos" tile (see coffee-service.spec.ts) because Route 10's
  // Market-capable stop had no Market service station that day - now that
  // Market's own stop ("CuraLeaf", position 'first') is reachable, this
  // exercises the same shared component directly on Market, the Excel's
  // actually-correct Area for these TC numbers.
  //
  // Uses day='YESTERDAY', not 'TODAY': real time advanced past 2026-07-27
  // to 07-28 between sessions, and TODAY now resolves to an empty (0
  // Delivery) day for Route 10 - same fixed-date-seed staleness flagged
  // elsewhere (mobile.config.ts's own note). YESTERDAY still resolves to
  // Jul 27, confirmed live to have real data.
  test(
    'TC015/TC021/TC022/TC025: Before Photos Skip-photo flow',
    { tag: ['@TC015', '@TC021', '@TC022', '@TC025'] },
    async ({ driver }, testInfo) => {
      // Full Start Day + LOB navigation + multi-step skip-photo flow in one
      // session - same reasoning as coffee-service.spec.ts's own timeout bump.
      testInfo.setTimeout(240_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const market = new MarketServiceScreen(driver);

      await test.step('Log in, switch to Route 10/YESTERDAY', async () => {
        await loginAndWaitForMfa(driver);
        await switchRoute(driver, { ...mobileConfig.defaultRoute, day: 'YESTERDAY' });
      });

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });

      await test.step("Open the day's Market service stop", async () => {
        await dashboard.clickLocationByPosition('first');
        await dashboard.openFirstServiceStation('market');
      });

      // TC015 "open the Before Photos screen"
      await test.step('TC015: tap Before Photos and verify the Take photo/Skip photo modal', async () => {
        await market.openBeforePhotos();
        const modal = await market.isPhotoModalVisible();
        expect(modal.takePhoto).toBe(true);
        expect(modal.skipPhoto).toBe(true);
      });

      // TC021 "open skip reason sheet" - bottom sheet with a Reason field
      // and a disabled submit button.
      await test.step('TC021: tap Skip photo and verify the reason sheet, disabled by default', async () => {
        await market.openSkipPhotoReasonSheet();
        expect(await market.isSkipPhotoReasonSheetVisible()).toBe(true);
        expect(await market.isSkipPhotoSubmitEnabled()).toBe(false);
      });

      // TC022 "verify blank reason is not allowed" - type then clear,
      // confirm it goes back to disabled rather than assuming it always was.
      await test.step('TC022: a blank reason keeps Skip photo disabled', async () => {
        await market.enterSkipPhotoReason("Camera can't focus and take clear picture");
        await market.waitForSkipPhotoSubmitEnabled(true);
        await market.enterSkipPhotoReason('');
        await market.waitForSkipPhotoSubmitEnabled(false);
      });

      // TC025 "submit skip reason" - re-enter the reason, submit, and land
      // back on the service stop checklist without a photo being saved.
      await test.step('TC025: submit a non-blank reason and return to the service stop screen', async () => {
        await market.enterSkipPhotoReason("Camera can't focus and take clear picture");
        await market.waitForSkipPhotoSubmitEnabled(true);
        await market.confirmSkipPhoto();
        expect(await market.isSkipPhotoReasonSheetVisible()).toBe(false);
      });
    }
  );

  // TC150-TC173/TC178-TC179 (Market "Delivery - Add Product" sub-area, PBI
  // 611013) - the Add Product search/select/quantity/submit flow reached
  // from Product fills' add_cta. Live-verified 2026-07-28 (build 0.1.76,
  // Route 10/YESTERDAY, first Market stop) - see MarketServiceScreen's own
  // note above the locators for the full structural walkthrough (Add
  // product's inline field -> separate Search product screen -> selecting a
  // result renders a Qty field reusing the Fill screen's numeric keypad).
  //
  // NOT independently asserted (documented instead):
  // - TC157 ("first related item highlighted with color") - no accessible
  //   signal: every result row's `selected` attribute stays "false"
  //   regardless of position, so there's nothing in the a11y tree to assert
  //   against - visual-only, same class of gap as the completed Delivery
  //   tile's tick mark documented elsewhere in this suite.
  // - TC160 ("scan to find product") - not reproducible: no real barcode to
  //   scan against in this environment, and the scanner icon's tap target
  //   is already covered structurally by TC152/TC155.
  // - TC166/TC168/TC169 ("reject alphabetic/decimal/special-character qty")
  //   - structurally impossible through the real UI, same reasoning as
  //   TC109/TC110 on the Fill screen's identical keypad: no letter keys, no
  //   decimal point, no literal minus-sign entry.
  // - TC171/TC172 ("Add disabled with no valid qty" / "Cancel+Add enabled
  //   after valid input") - already covered directly: TC167's qty=0 case
  //   proves Add disables, and TC162's post-selection default (qty=1, both
  //   buttons enabled) proves the enabled case - re-tagging duplicates
  //   nothing new.
  test(
    'TC150-TC173/TC178-TC179: Add Product search, select, quantity entry, and submit',
    {
      tag: [
        '@TC150',
        '@TC151',
        '@TC152',
        '@TC154',
        '@TC155',
        '@TC156',
        '@TC158',
        '@TC159',
        '@TC161',
        '@TC162',
        '@TC163',
        '@TC164',
        '@TC165',
        '@TC167',
        '@TC170',
        '@TC173',
        '@TC178',
        '@TC179'
      ]
    },
    async ({ driver }, testInfo) => {
      testInfo.setTimeout(240_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const market = new MarketServiceScreen(driver);

      await test.step('Log in, switch to Route 10/YESTERDAY', async () => {
        await loginAndWaitForMfa(driver);
        await switchRoute(driver, { ...mobileConfig.defaultRoute, day: 'YESTERDAY' });
      });

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });

      let unfilteredCount = 0;
      await test.step("Open a Market location's service station, Product fills, then Add Product", async () => {
        await dashboard.clickLocationByPosition('first');
        await dashboard.openFirstServiceStation('market');
        await market.openFills();
        unfilteredCount = await market.getFillProductRowCount();
        await market.openAddProduct();
      });

      // TC150/TC151/TC152 - the "Add product" screen's own inline field
      // packs its label and helper text into one `hint`, and has a
      // clickable scanner icon.
      await test.step('TC150/TC151/TC152: Product field label, helper text, and scanner icon', async () => {
        const { label, helper } = await market.getProductSearchFieldLabelAndHelper();
        expect(label).toBe('Product');
        expect(helper).toBe('Scan or search brand, name, sku');
        expect(await market.isAddProductScannerIconVisible()).toBe(true);
      });

      // TC154/TC155/TC156/TC158 - typing in the Product field (live-
      // verified: a tap alone does NOT navigate anywhere - see searchProduct's
      // own note) opens the separate "Search product" screen, which has its
      // own scanner icon, and filters the results list down to that
      // product's own rows (each SKU appears once per Pkg size).
      await test.step('TC154/TC155/TC156/TC158: typing opens Search product and filters by name', async () => {
        await market.searchProduct('Snickers');
        expect(await market.isSearchProductScreenVisible()).toBe(true);
        expect(await market.isSearchScannerIconVisible()).toBe(true);
        const row = await driver.$('//android.view.View[starts-with(@content-desc,"Snickers (1.86oz) - pkg: 1")]');
        expect(await row.isDisplayed()).toBe(true);
      });

      // TC159 - searching by SKU surfaces that exact-SKU product among the
      // results (live-verified: this build's results aren't STRICTLY
      // limited to the searched SKU - an unrelated row can also surface -
      // so this asserts the exact-SKU row is present, not that it's the
      // only one).
      await test.step('TC159: searching by SKU surfaces the exact-SKU product', async () => {
        await market.searchProduct('19515');
        const row = await driver.$('//android.view.View[contains(@content-desc,"SKU: 19515")]');
        expect(await row.isDisplayed()).toBe(true);
      });

      // TC161 "view empty results" - live-verified exact text below.
      await test.step('TC161: a non-matching search shows the empty-results message', async () => {
        await market.searchProduct('ZZZNOTFOUND');
        expect(await market.isNoSearchResultsVisible()).toBe(true);

        await market.searchProduct('Snickers');
      });

      // TC162/TC163 - selecting a result returns to Add product with a Qty
      // field whose own hint packs the selected product's name/SKU/Pkg.
      await test.step('TC162/TC163: selecting a result shows the product summary', async () => {
        await market.selectSearchResult('Snickers (1.86oz) - pkg: 1');
        const summary = await market.getAddProductSummary();
        expect(summary.name).toBe('Snickers 1.86oz');
        expect(summary.sku).toBe('SKU: 19515');
        expect(summary.pkg).toBe('Pkg: 1');
      });

      // TC164/TC165 - the Qty field defaults to "1", reuses the custom
      // numeric keypad, and accepts further digit taps.
      await test.step('TC164/TC165: numeric keypad visible, Qty defaults to 1, and accepts digit entry', async () => {
        expect(await market.isAddProductQtyKeypadVisible()).toBe(true);
        expect(await market.getAddProductQtyValue()).toBe('1');

        await market.tapKeypadIncrement();
        await market.tapKeypadIncrement();
        await market.tapKeypadIncrement();
        await market.tapKeypadIncrement();
        expect(await market.getAddProductQtyValue()).toBe('5');
      });

      // TC167 "reject negative quantity" - the "-" stepper floor-clamps at
      // 0 (never produces a literal negative), and Add itself becomes
      // disabled at Qty=0 - a real validation this screen has that the Fill
      // screen's Continue button does NOT (don't assume the two match).
      await test.step('TC167: the decrement stepper floor-clamps at 0 and disables Add', async () => {
        for (let i = 0; i < 5; i++) {
          await market.tapKeypadDecrement();
        }
        expect(await market.getAddProductQtyValue()).toBe('0');
        expect(await market.addProductButtonStates().then((b) => b.addEnabled)).toBe(false);

        await market.tapKeypadIncrement();
        await market.tapKeypadIncrement();
        await market.tapKeypadIncrement();
        await market.tapKeypadIncrement();
        await market.tapKeypadIncrement();
        expect(await market.getAddProductQtyValue()).toBe('5');
      });

      // TC170 "verify maximum length for qty" - live-verified actual max
      // length is 3 digits, not the Excel's guessed "e.g. 4".
      await test.step('TC170: Qty entry is capped at 3 digits', async () => {
        for (let i = 0; i < 6; i++) {
          await market.tapKeypadDigit('1');
        }
        const value = await market.getAddProductQtyValue();
        expect(value.length).toBeLessThanOrEqual(3);
      });

      // TC173 "cancel without saving" - returns to Product fills with the
      // row count unchanged (no product added).
      await test.step('TC173: Cancel returns to Product fills without adding anything', async () => {
        await market.cancelAddProduct();
        expect(await market.isProductFillsTitleVisible()).toBe(true);
        expect(await market.getFillProductRowCount()).toBe(unfilteredCount);
      });

      // TC178/TC179 - re-run the same search+select+qty flow and this time
      // Add it: returns to Product fills with a new row visible, and
      // expanding it shows the saved Qty in its own Delivery field.
      await test.step('TC178/TC179: Add returns to Product fills with the new product row saved', async () => {
        // Already on Product fills (TC173's Cancel returned here, not out
        // to the outer checklist) - openAddProduct() alone, not the
        // from-checklist variant.
        await market.openAddProduct();
        await market.searchProduct('Snickers');
        await market.selectSearchResult('Snickers (1.86oz) - pkg: 1');
        await market.tapKeypadIncrement();
        await market.tapKeypadIncrement();
        await market.tapKeypadIncrement();
        await market.tapKeypadIncrement();
        expect(await market.getAddProductQtyValue()).toBe('5');

        await market.confirmAddProduct();
        expect(await market.isProductFillsTitleVisible()).toBe(true);
        expect(await market.getFillProductRowCount()).toBe(unfilteredCount + 1);

        await market.expandProductFill('first');
        const deliveryField = await driver.$('//android.widget.EditText[@hint="Delivery"]');
        expect(await deliveryField.getAttribute('text')).toBe('5');
      });
    }
  );
});
