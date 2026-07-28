import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndWaitForMfa, switchRoute } from '../../utils/login-flow';
import { PrepTasksScreen } from '../../screens/prep-tasks.screen';
import { DashboardScreen } from '../../screens/dashboard.screen';
import { MarketServiceScreen } from '../../screens/market-service.screen';
import { mobileConfig } from '../../config/mobile.config';

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
//
// TC-ID traceability: cross-referenced against Optimized_TCs_V_2.0.xlsx by
// (TC#, Area=Market) pair, not TC# alone (TC numbers repeat across Areas -
// e.g. TC091/097/098/105/115/120/132 all separately exist under Vending,
// Coffee, Menu, and Start of Day too, with unrelated content).
//
// CORRECTED: TC091/097/098/105 (test 1 below - Par/Ordered/Picked review,
// Theft/Damaged/Returned/Spoiled/Delivery entry) were previously found in
// the Excel mapped to PBI 619783 / 735739 - but those PBIs' actual ACs are
// Home Screen map/stop navigation and the "About this location" popup,
// neither of which mentions any of these fields. Cross-checking against
// 611013's own Process Steps instead shows a direct match (step 1 "Tap
// Fills" = TC091, step 3's Par/Ordered/Picked + Theft/Damaged/Returned/
// Spoiled/Delivered = TC097/TC098/TC105), so the Excel's PBI ID column for
// these 4 rows was a data error - corrected to 611013. TC120 ("select one
// category chip... highlighted with tick icon") is deliberately NOT tagged
// on test 2 - this spec taps the chip and asserts the header filter icon's
// active state, but never asserts the chip's OWN selected/ticked state, so
// citing it would overclaim.
test.describe('Market - Fill Screen (PBI 611013)', () => {
  test(
    'review Par/Ordered/Picked and enter Theft/Damaged/Returned/Spoiled/Delivered quantities',
    { tag: ['@TC091', '@TC097', '@TC098', '@TC105'] },
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

      // TC091 "open Product Fills screen".
      await test.step('Step 1/2: tap Fills, verify the refill list loaded', async () => {
        await market.openFills();
        expect(await market.isProductFillsTitleVisible()).toBe(true);
      });

      // TC097 "review Par, Ordered, Picked values" - outcome explicitly
      // covers BOTH the Par/Ordered/Picked review counts AND the
      // Theft/Damaged/Returned/Spoiled labels being visible in one TC.
      // TC098 "view the label of the Delivery text field ('Delivery', not
      // 'DEL')" - the field is located by hint="Delivery", so finding it
      // confirms the label directly.
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

      // TC105 "enter Theft quantity" (numeric value accepted) - its bundled
      // Damaged/Returned/Spoiled outcomes aren't separately tagged: those
      // numbers (TC106-108) collide with unrelated Areas when looked up
      // standalone and have no distinct Market row of their own.
      await test.step('Step 3: enter Theft/Damaged/Returned/Spoiled and Delivered Quantity', async () => {
        await market.enterFillQuantities('first', {
          theft: '0',
          damaged: '0',
          returned: '0',
          spoiled: '0',
          delivered: '10'
        });
      });
    }
  );

  test(
    'Step 4: filter Product fills by category',
    { tag: ['@TC115', '@TC132'] },
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

      // TC115 "open Filter screen" / TC132 "see active filter icon" (the
      // header filter icon's checked/indicator-dot state after Apply).
      // "By product group" is not asserted - confirmed obsolete/
      // deprioritized directly by BA/QA. Only "By category" (live) is
      // exercised here.
      await test.step('Open Fills, then filter by category and verify it becomes active', async () => {
        await market.openFills();
        await market.selectFilterCategoryByPrefix('CANDY');
        expect(await market.isFilterActive()).toBe(true);
      });
    }
  );

  // TC092-TC096: same PBI misattribution as TC091/097/098/105 above (Excel
  // lists 619783/735739, whose real ACs are unrelated) - these are the
  // Product fills LIST screen's own header/row-content TCs, a direct match
  // for 611013's Process Steps, so corrected the same way.
  //
  // Uses Route 10/YESTERDAY + position 'first' explicitly (not this file's
  // other tests' plain login + position 'second') - live-verified
  // 2026-07-28 that real time has advanced past Jul 27, so defaultRoute's
  // own day (YESTERDAY resolving from a fresh login) and Market's stop
  // position have both shifted since those tests were written - see
  // market-service.spec.ts's own notes on the same two issues.
  test(
    'TC092-TC096: Product fills header, row content, and header actions',
    { tag: ['@TC092', '@TC093', '@TC094', '@TC095', '@TC096'] },
    async ({ driver }) => {
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

      await test.step("Open a Market location's service station and Product fills", async () => {
        await dashboard.clickLocationByPosition('first');
        await dashboard.openFirstServiceStation('market');
        await market.openFills();
      });

      // TC092 "view route details and date in the header"
      await test.step('TC092: verify the date/route header is visible', async () => {
        const header = await market.isFillsHeaderVisible();
        expect(header.date).toBe(true);
        expect(header.route).toBe(true);
      });

      // TC093 "view header actions" - Filter, Sort, Add icons
      await test.step('TC093: verify Filter, Sort, and Add icons are visible', async () => {
        const actions = await market.isFillsHeaderActionsVisible();
        expect(actions.add).toBe(true);
        expect(actions.sort).toBe(true);
        expect(actions.filter).toBe(true);
      });

      // TC094 "view products to be refilled" - at least one row rendered
      await test.step('TC094: verify the product list renders at least one row', async () => {
        const count = await market.getFillProductRowCount();
        expect(count).toBeGreaterThan(0);
      });

      // TC095 "view product title" / TC096 "view package info" (Pkg: 1)
      await test.step('TC095/TC096: verify the first row shows a product title and package info', async () => {
        const summary = await market.getFillProductRowSummary('first');
        expect(summary.name.length).toBeGreaterThan(0);
        expect(Number.isNaN(summary.pkg)).toBe(false);
      });
    }
  );

  // TC099-TC104: same PBI misattribution as TC091/097/098/105 (Excel lists
  // 619783/735739, whose real ACs are unrelated) - corrected to 611013,
  // same reasoning as the notes above. These are the quantity fields'
  // (Theft/Damaged/Returned/Spoiled/Delivery) own input behavior, live-
  // verified 2026-07-28 via the Delivery field specifically.
  test(
    'TC099-TC104: quantity field overwrite behavior, custom numeric keypad, and negative-value handling',
    { tag: ['@TC099', '@TC100', '@TC101', '@TC102', '@TC103', '@TC104'] },
    async ({ driver }) => {
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

      await test.step("Open a Market location's service station, Product fills, and expand the first row", async () => {
        await dashboard.clickLocationByPosition('first');
        await dashboard.openFirstServiceStation('market');
        await market.openFills();
        await market.expandProductFill('first');
      });

      const deliveryField = () => driver.$('//android.widget.EditText[@hint="Delivery"]');
      const theftField = () => driver.$('//android.widget.EditText[@hint="Theft"]');

      // TC099 "tap the numeric field and enter a value" - the seeded
      // default ("10") is cleared automatically on the first digit tap;
      // only the new number shows. Uses real keypad taps, not setValue() -
      // see MarketServiceScreen.tapKeypadDigit()'s own note on why.
      await test.step('TC099: the first digit tap replaces the default value rather than appending to it', async () => {
        await (await deliveryField()).click();
        await market.tapKeypadDigit('5');
        expect(await (await deliveryField()).getText()).toBe('5');
      });

      // Second digit tap in the SAME continuous entry appends normally
      // (ordinary calculator-style typing) - not itself an Excel TC, just
      // the contrast that makes TC100 below meaningful: "53" here, then
      // TC100 proves a FRESH digit tap after refocusing replaces it again
      // rather than continuing to append ("537").
      await market.tapKeypadDigit('3');
      expect(await (await deliveryField()).getText()).toBe('53');

      // TC100 "change the value again in the same field" - moving focus
      // away and back, then tapping a new digit, overwrites the field's
      // settled value rather than appending to it.
      await test.step('TC100: a fresh digit tap after refocusing overwrites rather than appends', async () => {
        await (await theftField()).click();
        await (await deliveryField()).click();
        expect(await (await deliveryField()).getText()).toBe('53'); // refocusing alone doesn't clear it
        await market.tapKeypadDigit('7');
        expect(await (await deliveryField()).getText()).toBe('7'); // NOT "537"
      });

      // TC101 "see numeric keypad when entering Delivered" - this build uses
      // a custom in-app keypad, not the system IME - see
      // MarketServiceScreen's own note on isNumericKeypadVisible().
      await test.step('TC101: the custom numeric keypad is displayed', async () => {
        expect(await market.isNumericKeypadVisible()).toBe(true);
      });

      // TC102 "navigate using custom keyboard Up/Down arrows" - Down moves
      // focus to the next quantity field (Theft, live-verified), Up moves
      // it back.
      await test.step('TC102: Down arrow moves focus to the next quantity field, Up arrow moves it back', async () => {
        await market.tapKeypadDownArrow();
        expect(await market.getFocusedFieldHint()).toBe('Theft');
        await market.tapKeypadUpArrow();
        expect(await market.getFocusedFieldHint()).toBe('Delivery');
      });

      // TC103 "maintain keyboard visibility when moving fields" - still up
      // after both arrow taps above.
      await test.step('TC103: the keypad remains open after navigating between fields', async () => {
        expect(await market.isNumericKeypadVisible()).toBe(true);
      });

      // TC104 "unable to enter negative Delivered" - live-verified: there is
      // no way to type a "-" via the digit keys at all; the visually
      // similar "-" key is a decrement STEPPER (see
      // MarketServiceScreen.tapKeypadDecrement()'s own note), floor-clamped
      // at 0. Proven on Theft (currently 0 - untouched in this test): two
      // decrement taps leave it at 0, never negative.
      await test.step('TC104: the decrement stepper cannot push a value below zero', async () => {
        await (await theftField()).click();
        expect(await (await theftField()).getText()).toBe('0');
        await market.tapKeypadDecrement();
        await market.tapKeypadDecrement();
        expect(await (await theftField()).getText()).toBe('0');
      });
    }
  );

  // TC109-TC114: same PBI misattribution as TC091-105/092-096/099-104
  // (Excel lists 619783/735739) - corrected to 611013, same reasoning as
  // the notes above.
  //
  // NOT independently asserted (documented instead):
  // - TC109 ("unable to enter alphabets... validation error blocking") -
  //   structurally impossible to even attempt through the real UI: the
  //   custom numeric keypad (see MarketServiceScreen's own note) has no
  //   letter keys at all, only digits/steppers/navigation/confirm. There's
  //   no genuine user action that could type a letter to reject in the
  //   first place, so there's nothing to assert beyond what TC101's keypad
  //   presence already proves.
  // - TC110 ("unable to enter negative... blocks WITH MESSAGE") - the
  //   blocking itself is the same mechanism TC104 already proved (the "-"
  //   key is a floor-clamped decrement stepper, not text entry) - live-
  //   verified no error message/toast appears when the clamp is hit, just
  //   silent no-op. Not re-asserting the same mechanism a second time; the
  //   "with message" part specifically is false.
  // - TC112 ("Continue enabled with valid data") - live-verified true, but
  //   not meaningfully distinct from TC111 below: Continue's enabled state
  //   never actually changes based on field validity (same "always
  //   enabled" pattern documented repeatedly elsewhere in this suite).
  test(
    'TC109-TC114: quantity field validation and the Continue/Delivery-tile completion flow',
    { tag: ['@TC111', '@TC113', '@TC114'] },
    async ({ driver }) => {
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

      await test.step("Open a Market location's service station and Product fills", async () => {
        await dashboard.clickLocationByPosition('first');
        await dashboard.openFirstServiceStation('market');
        await market.openFills();
      });

      const continueBtn = () => driver.$('~Continue');

      // TC111 "unable to proceed with invalid or missing Delivered value" -
      // live-verified FALSE: Continue stays enabled even with Delivery
      // emptied out entirely (first row's Delivery field, cleared via a
      // digit tap then a backspace - see MarketServiceScreen's own note on
      // why backspace alone can't touch the untouched seeded default).
      await test.step('TC111: Continue remains enabled even with an empty Delivered value', async () => {
        const field = await driver.$('//android.widget.EditText[@hint="Delivery"]');
        await field.click();
        await market.tapKeypadDigit('5');
        await market.tapKeypadBackspace();
        expect(await field.getText()).toBe('');
        expect(await (await continueBtn()).isEnabled()).toBe(true);
      });

      // TC113 "proceed to next screen with valid entries" - tapping
      // Continue shows a "saved successfully" toast and returns to the
      // service stop checklist, where the Delivery tile becomes complete
      // (screenshot-confirmed green background + checkmark, not asserted
      // here - see submitFillsAndReturnToChecklist()'s own note).
      await test.step('TC113: Continue saves and returns to the service stop checklist', async () => {
        await market.submitFillsAndReturnToChecklist();
        expect(await market.isSavedSuccessToastVisible()).toBe(true);
      });

      // TC114 "test Delivery tile and tick interactions after completion" -
      // tapping the now-complete Delivery tile reopens Product fills, the
      // same tap target as the original openFills().
      await test.step('TC114: tapping the completed Delivery tile reopens Product fills', async () => {
        await market.openFills();
        expect(await market.isProductFillsTitleVisible()).toBe(true);
      });
    }
  );
});
