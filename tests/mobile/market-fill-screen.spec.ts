import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndEnsureRoute } from '../../utils/login-flow';
import { PrepTasksScreen } from '../../screens/prep-tasks.screen';
import { DashboardScreen } from '../../screens/dashboard.screen';
import { HomeScreen } from '../../screens/home.screen';
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
  // Same reasoning as market-service.spec.ts's own afterEach: every test
  // here leaves the app mid-flow (Fill screen, Filter sheet, etc.) under
  // KEEP_APP_SESSION - return to Dashboard after each so no test inherits a
  // stale screen from whichever ran before it.
  test.afterEach(async ({ driver }) => {
    await new HomeScreen(driver).returnToHome().catch(() => {});
  });

  test(
    'review Par/Ordered/Picked and enter Theft/Damaged/Returned/Spoiled/Delivered quantities',
    {
      tag: [
        '@Market-TC091',
        '@Market-TC097',
        '@Market-TC098',
        '@Market-TC105',
        '@Market-TC106',
        '@Market-TC107',
        '@Market-TC108',
        '@Market-TC141',
        '@Market-TC142'
      ]
    },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const market = new MarketServiceScreen(driver);

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });

      await test.step("Open a Market location's service station", async () => {
        await dashboard.clickLocationByPosition('second');
        await dashboard.openFirstServiceStation('market');
      });

      // TC091 "open Product Fills screen".
      await test.step('Step 1/2: tap Fills, verify the refill list loaded', async () => {
        await market.openFills();
        expect(await market.isProductFillsTitleVisible()).toBe(true);
        await market.ensureFillableProductsExist();
      });

      // TC141 "see Delivered quantity field displayed" - same field this
      // step already confirms via isFillEntryVisible().delivered.
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

      // TC105/TC106/TC107/TC108 "enter Theft/Damaged/Returned/Spoiled
      // quantity -> numeric value accepted" - live-verified 2026-08-03 with
      // distinct non-zero values (not the '0' no-op previously used here) +
      // real getText() assertions: unlike Vending's fillAllProductDelivery
      // Quantities/Market's own performMoneyOperations, type()'s setValue()
      // WITHOUT a preceding click() DOES register correctly on these four
      // fields - no click-first fix needed here.
      await test.step('TC105/TC106/TC107/TC108: enter Theft/Damaged/Returned/Spoiled and Delivered Quantity, verify each value registers', async () => {
        await market.enterFillQuantities('first', {
          theft: '1',
          damaged: '2',
          returned: '3',
          spoiled: '4',
          delivered: '10'
        });
        const theftField = await driver.$('//android.widget.EditText[@hint="Theft"]');
        const damagedField = await driver.$('//android.widget.EditText[@hint="Damaged"]');
        const returnedField = await driver.$('//android.widget.EditText[@hint="Returned"]');
        const spoiledField = await driver.$('//android.widget.EditText[@hint="Spoiled"]');
        expect(await theftField.getText()).toBe('1');
        expect(await damagedField.getText()).toBe('2');
        expect(await returnedField.getText()).toBe('3');
        expect(await spoiledField.getText()).toBe('4');
      });

      // TC109/TC110 "unable to enter alphabets/negative values -> validation
      // blocks (with message)" - NOT tagged: live-verified 2026-08-03 that
      // even bypassing the on-screen keypad entirely (direct value
      // injection, i.e. a paste - no real user can do this on a field that
      // only ever opens the custom digit-only keypad, never the system
      // IME/clipboard), the Theft field accepts "abc" and "-1" completely
      // verbatim - no sanitization, no error banner, nothing. This is a
      // stronger finding than "unreachable via the keypad" alone: the field
      // has NO input-level validation of its own at all: it fully trusts
      // the keypad to be the only gatekeeper. Real, but not something a
      // real user could ever trigger - still not assertable as a genuine
      // TC109/TC110 pass.
      //
      // TC142 "invalid quantity (-1/blank/10.5) -> Continue disabled" -
      // live-verified FALSE with TC142's own exact test data, extending the
      // already-documented "Continue always enabled" finding (TC111 above)
      // - Continue stays enabled with a pasted "10.5", "-1", or a blank
      // Delivery field alike.
      await test.step('TC109/TC110 (documented, not asserted) / TC142: paste-bypassed invalid values are accepted with no validation, and Continue stays enabled regardless', async () => {
        const theftField = await driver.$('//android.widget.EditText[@hint="Theft"]');
        await theftField.clearValue();
        await theftField.setValue('abc');
        expect(await theftField.getText()).toBe('abc');

        await theftField.clearValue();
        await theftField.setValue('-1');
        expect(await theftField.getText()).toBe('-1');

        const deliveryField = await driver.$('//android.widget.EditText[@hint="Delivery"]');
        const continueBtn = driver.$('~Continue');

        await deliveryField.clearValue();
        await deliveryField.setValue('10.5');
        expect(await continueBtn.isEnabled()).toBe(true);

        await deliveryField.clearValue();
        await deliveryField.setValue('-1');
        expect(await continueBtn.isEnabled()).toBe(true);

        await deliveryField.clearValue();
        expect(await continueBtn.isEnabled()).toBe(true);

        // Restore a valid Delivery value - this test's own state should
        // leave the field in a sane condition for anything that reuses the
        // session afterward.
        await deliveryField.setValue('10');
      });
    }
  );

  test(
    'Step 4: filter Product fills by category',
    { tag: ['@Market-TC115', '@Market-TC132'] },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const market = new MarketServiceScreen(driver);

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
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
        await market.ensureFillableProductsExist();
        await market.openFilterSheet();
        const labels = await market.getAllFilterChipLabels();
        expect(labels.length).toBeGreaterThan(0);
        const category = labels[0].replace(/\s*\(\d+\)$/, '');
        await market.tapFilterChip(category);
        await market.tapApplyFilters();
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
    { tag: ['@Market-TC092', '@Market-TC093', '@Market-TC094', '@Market-TC095', '@Market-TC096'] },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const market = new MarketServiceScreen(driver);

      await test.step('Log in, switch to Route 10/YESTERDAY', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.defaultRoute, day: 'YESTERDAY' });
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
    { tag: ['@Market-TC099', '@Market-TC100', '@Market-TC101', '@Market-TC102', '@Market-TC103', '@Market-TC104'] },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const market = new MarketServiceScreen(driver);

      await test.step('Log in, switch to Route 10/YESTERDAY', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.defaultRoute, day: 'YESTERDAY' });
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
    { tag: ['@Market-TC111', '@Market-TC113', '@Market-TC114', '@Market-TC144', '@Market-TC146'] },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const market = new MarketServiceScreen(driver);

      await test.step('Log in, switch to Route 10/YESTERDAY', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.defaultRoute, day: 'YESTERDAY' });
      });

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });

      await test.step("Open a Market location's service station and Product fills", async () => {
        // 'first' (AMEX) is Coffee-only as of 2026-08-03 - CureLeaf, the
        // real Market stop, is 'second' (see this file's own top note and
        // market-service.spec.ts's TC112 test for the same correction).
        await dashboard.clickLocationByPosition('second');
        await dashboard.openFirstServiceStation('market');
        await market.openFills();
        await market.ensureFillableProductsExist();
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

      // TC113 "proceed to next screen with valid entries" / TC144 "continue
      // with valid inputs -> navigate to the workflow summary screen" (same
      // mechanism: Continue's toast plus the return itself IS the workflow
      // summary/service-stop checklist) - tapping Continue shows a "saved
      // successfully" toast and returns to the service stop checklist,
      // where the Delivery tile becomes complete (screenshot-confirmed
      // green background + checkmark, not asserted here - see
      // submitFillsAndReturnToChecklist()'s own note).
      await test.step('TC113/TC144: Continue saves and returns to the service stop checklist', async () => {
        await market.submitFillsAndReturnToChecklist();
        expect(await market.isSavedSuccessToastVisible()).toBe(true);
      });

      // TC114 "test Delivery tile and tick interactions after completion" /
      // TC146 "reopen Delivery from workflow" (identical action: tap the
      // completed Delivery tile) - tapping the now-complete Delivery tile
      // reopens Product fills, the same tap target as the original
      // openFills().
      await test.step('TC114/TC146: tapping the completed Delivery tile reopens Product fills', async () => {
        await market.openFills();
        expect(await market.isProductFillsTitleVisible()).toBe(true);
      });
    }
  );

  // TC140 (Market "Delivery") - the unfiltered Product fills list order,
  // live-verified 2026-08-03 (build 0.1.76, Route 10/YESTERDAY, CureLeaf
  // stop - see this file's own top-of-file note on why 'second', not
  // 'first', is the real Market stop position now). Asserts against
  // whatever the real on-screen order actually is at test time (rather
  // than assuming the discrepancy already observed on a different stop's
  // catalog in a prior session still holds) - see the comment on the
  // TC132-TC138 test above for that earlier, different-catalog finding.
  test('TC140: the unfiltered Product fills list order', { tag: ['@Market-TC140'] }, async ({ driver }) => {
    const prepTasks = new PrepTasksScreen(driver);
    const dashboard = new DashboardScreen(driver);
    const market = new MarketServiceScreen(driver);

    await test.step('Log in, switch to Route 10/YESTERDAY', async () => {
      await loginAndEnsureRoute(driver, { ...mobileConfig.defaultRoute, day: 'YESTERDAY' });
    });

    await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
      await prepTasks.openFromHamburgerMenu();
      await prepTasks.ensureFullDayPrepComplete();
    });

    await test.step("Open CureLeaf's Product fills", async () => {
      await dashboard.clickLocationByPosition('second');
      await dashboard.openFirstServiceStation('market');
      await market.openFills();
      await market.ensureFillableProductsExist();
    });

    // TC140 "list sorted alphabetically (if applicable)" - NOT asserted as
    // a strict equal/not-equal check against alphabetical order: live-
    // verified 2026-08-03 that CureLeaf's own 2-item row order is genuinely
    // UNSTABLE between reads with no action in between - one raw
    // uiautomator dump read "Extra PolarIceGum 15stk" then
    // "HariboGummiGoldBear2oz", the very next read (and this test's own
    // getFillProductNamesInOrder() call) read the reverse - so asserting
    // either order (or its negation) would just be flaky, not a real
    // signal either way. This is itself a genuine, worth-flagging finding
    // (same class of gap as TC157/TC183's "no accessible highlight signal"
    // elsewhere in this suite) - only the list's non-emptiness is a stable,
    // real assertion here.
    await test.step('TC140: the Product fills list renders (row order is unstable between reads - not asserted)', async () => {
      const actual = await market.getFillProductNamesInOrder();
      expect(actual.length).toBeGreaterThan(0);
    });
  });

  // TC116-TC122 (Market's "Delivery - Filters" sub-area, PBI 611013 - same
  // PBI this whole file already covers, no misattribution here) - the
  // Product fills filter BOTTOM SHEET's own contents and chip-selection
  // behavior, live-verified 2026-07-28 (build 0.1.76, Route 10/YESTERDAY,
  // first Market stop): opening the sheet (section_header_filter_cta) shows
  // a "By category" label and one Button chip per category, each already
  // carrying a live product-count suffix (e.g. "CANDY (1)").
  //
  // NOT independently asserted (documented instead):
  // - TC117 ("view Product Group filters with count") - this build has no
  //   "By product group" tab at all, only "By category" - confirmed
  //   obsolete/deprioritized directly by BA/QA (same finding already noted
  //   at the top of this file for the Filter sheet in general). Nothing to
  //   assert; TC118 below covers the category-chip-with-count half of the
  //   same bundled Excel outcome.
  // - TC123/TC124/TC125/TC126/TC127/TC128/TC129/TC131 (bundled into
  //   TC115/TC119/TC120/TC121's own Excel rows) - NOW TAGGED: each restates
  //   an already-directly-asserted claim verbatim under a different TC
  //   number (TC124->TC119, TC125->TC120, TC126/TC129->TC121, TC127->TC120,
  //   TC128-> the deselection step below), tagged directly on those same
  //   steps. TC123 ("open Filter screen again") is proven by TC122's own
  //   step re-opening the sheet post-Apply. TC131 ("view filter tags on
  //   Product fills screen") is proven by the TC132/TC133 test's own
  //   isFilterTagVisible() check.
  // - TC130 (bundled into TC119's Excel row: "apply selected filters ->
  //   navigate to Product Fills with filtered list") - NOW TAGGED on the
  //   TC132/TC133 test's own TC132 step (below, in that other test), which
  //   already applies a filter and asserts the row count narrows.
  // - TC134/TC135 (bundled into TC122/TC132's own Excel rows, both labeled
  //   Integration but genuinely UI-observable) - NOW TAGGED directly on the
  //   TC122 step below, enhanced with real row-count/tag-visibility
  //   assertions after Clear filters (previously only checked the header
  //   icon's own state).
  test(
    'TC116-TC122: Product fills filter sheet contents, chip selection, and Apply/Clear behavior',
    {
      tag: [
        '@Market-TC116',
        '@Market-TC118',
        '@Market-TC119',
        '@Market-TC120',
        '@Market-TC121',
        '@Market-TC122',
        '@Market-TC123',
        '@Market-TC124',
        '@Market-TC125',
        '@Market-TC126',
        '@Market-TC127',
        '@Market-TC128',
        '@Market-TC129',
        '@Market-TC134',
        '@Market-TC135'
      ]
    },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const market = new MarketServiceScreen(driver);

      await test.step('Log in, switch to Route 10/YESTERDAY', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.defaultRoute, day: 'YESTERDAY' });
      });

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });

      await test.step("Open a Market location's service station and Product fills", async () => {
        // 'first' (AMEX) is Coffee-only as of 2026-08-03 - CureLeaf, the
        // real Market stop, is 'second' (see this file's own top note and
        // market-service.spec.ts's TC112 test for the same correction).
        await dashboard.clickLocationByPosition('second');
        await dashboard.openFirstServiceStation('market');
        await market.openFills();
        await market.ensureMultipleFillCategoriesExist();
      });

      const unfilteredCount = await market.getFillProductRowCount();

      // Reads whichever categories are ACTUALLY in this stop's catalog
      // right now, rather than hardcoding "CANDY"/"LG SNACKS" - live-
      // verified 2026-08-07 that the catalog's category set drifts over
      // time (a prior run's "LG SNACKS" chip no longer exists). Needs at
      // least 2 categories for the multi-select steps below (TC121/TC126/
      // TC128) - if the catalog ever narrows to a single category, this
      // fails loudly here rather than silently mis-asserting further down.
      let categoryA = '';
      let categoryB = '';

      // TC116 "view category text" / TC118 "view Category filters with
      // count" - both the "By category" section label and the chips
      // themselves (each labeled "<NAME> (<count>)") are visible.
      await test.step('TC116/TC118: filter sheet shows the "By category" label and count-suffixed chips', async () => {
        await market.openFilterSheet();
        expect(await market.isFilterByCategoryLabelVisible()).toBe(true);
        const labels = await market.getAllFilterChipLabels();
        expect(labels.length).toBeGreaterThanOrEqual(2);
        [categoryA, categoryB] = labels.map((l) => l.replace(/\s*\(\d+\)$/, ''));
        expect(categoryA.length).toBeGreaterThan(0);
        expect(categoryB.length).toBeGreaterThan(0);
      });

      // TC119/TC124 "Apply Filters button disabled before selection"
      // (TC124 restates TC119 verbatim) - live-verified: both Apply filters
      // and Clear filters start disabled with zero chips selected.
      await test.step('TC119/TC124: Apply/Clear filters start disabled with no chip selected', async () => {
        expect(await market.isApplyFiltersEnabled()).toBe(false);
        expect(await market.isClearFiltersEnabled()).toBe(false);
      });

      // TC120/TC125 "select one category chip - highlighted with tick icon
      // and brand color" (TC125 restates TC120 verbatim) - live-verified
      // via the chip's real `selected` attribute (not `checked` - that's
      // the header filter_cta's own toggle), which is the closest a11y-tree
      // signal to that visual state; Apply/Clear both flip to enabled the
      // moment a chip is selected. TC127 ("Apply Filters button enabling" ->
      // "enabled in green") is the same isApplyFiltersEnabled() check below.
      await test.step('TC120/TC125/TC127: selecting one chip marks it selected and enables Apply/Clear', async () => {
        await market.tapFilterChip(categoryA);
        expect(await market.isFilterChipSelected(categoryA)).toBe(true);
        expect(await market.isApplyFiltersEnabled()).toBe(true);
        expect(await market.isClearFiltersEnabled()).toBe(true);
      });

      // TC121/TC126 "select multiple chips" (TC126 restates TC121
      // verbatim) - a second chip can be selected alongside the first,
      // Apply/Clear remain enabled. TC129 ("Apply Filters button enabled in
      // green" after selecting again) is the same isApplyFiltersEnabled()
      // check already asserted here and on TC120/TC125 above.
      await test.step('TC121/TC126/TC129: a second chip can be selected at the same time, Apply stays enabled', async () => {
        await market.tapFilterChip(categoryB);
        expect(await market.isFilterChipSelected(categoryA)).toBe(true);
        expect(await market.isFilterChipSelected(categoryB)).toBe(true);
        expect(await market.isApplyFiltersEnabled()).toBe(true);
      });

      // Deselecting back to zero re-disables both buttons - the direct
      // converse of TC119/TC120, confirms the enable logic is driven by
      // selection COUNT, not a one-way latch. TC128 "Apply Filters button
      // disabled again on deselection" is this exact behavior.
      await test.step('TC128: deselecting all chips re-disables Apply/Clear filters', async () => {
        await market.tapFilterChip(categoryA);
        await market.tapFilterChip(categoryB);
        expect(await market.isApplyFiltersEnabled()).toBe(false);
        expect(await market.isClearFiltersEnabled()).toBe(false);
      });

      // TC122 "clear all selected filters" - re-select a chip, Apply it
      // (header filter icon goes active), reopen the sheet (selection
      // persisted), then Clear filters resets the header icon back to
      // inactive. TC123 ("open Filter screen again") is this same reopen
      // call, post-Apply. TC134 ("remove all filters -> tags removed and
      // full list restored") and TC135 ("filter icon resets") are the same
      // Clear filters action - live-verified 2026-08-03 that, unlike the
      // analogous Sort screen's own Clear (which does NOT restore original
      // row order - see the TC132-TC138 test's own note below), Clear
      // FILTERS genuinely restores the full unfiltered row count and
      // removes the active filter tag.
      await test.step('TC122/TC123/TC134/TC135: applying then reopening and clearing filters restores the full list and resets the header icon', async () => {
        await market.tapFilterChip(categoryA);
        await market.tapApplyFilters();
        expect(await market.isFilterActive()).toBe(true);
        expect(await market.getFillProductRowCount()).toBeLessThanOrEqual(unfilteredCount);

        await market.openFilterSheet();
        expect(await market.isFilterChipSelected(categoryA)).toBe(true);
        await market.tapClearFilters();
        expect(await market.isFilterActive()).toBe(false);
        expect(await market.isFilterTagVisible(categoryA)).toBe(false);
        expect(await market.getFillProductRowCount()).toBe(unfilteredCount);
      });
    }
  );

  // TC132-TC138 (Market's "Delivery - Filters" sub-area, PBI 611013, same
  // Filter bottom sheet as the TC116-122 test above) - live-verified
  // 2026-07-28 (build 0.1.76, Route 10/YESTERDAY, first Market stop,
  // catalog: "Baby Ruth 2.1oz" under CANDY, "Doritos RF NChs 1oz"/"Doritos
  // NChs 1.75oz" under LG SNACKS):
  //   - Applying a filter narrows getFillProductRowCount() to only that
  //     category's rows (TC130's own outcome, re-confirmed here as the
  //     setup for TC132/133/136-138).
  //   - Each applied category gets its own removable tag above the list (a
  //     bare "<NAME>" View, no count suffix, with an unlabeled clickable
  //     sibling as its close icon - see BaseScreen.removeFilterTag) -
  //     removing the sheet's only active tag fully clears the filter and
  //     restores the unfiltered row count (TC133).
  //   - Clearing filters, then reopening the sheet, shows every chip
  //     deselected and Apply filters disabled again (TC136) - re-selecting
  //     re-enables Apply and re-highlights the chip (TC137), and re-Applying
  //     re-narrows the list exactly as before (TC138).
  //
  // NOT independently asserted (documented instead):
  // - TC139 ("empty-state when filter matches nothing") - not reproducible
  //   live: the sheet only ever renders a chip for categories that already
  //   have >=1 product (that's what its own count suffix comes from), so
  //   there's no real user action on this account's seeded catalog that
  //   selects a category with zero matches.
  // - TC140 ("list sorted alphabetically") - own dedicated test below now
  //   (live data/catalog changes over time, so re-verified fresh rather
  //   than assumed from this comment's original 2026-07-28 observation).
  // - TC141/TC143 ("Delivered field visible" / "valid qty -> Continue
  //   enabled") - NOW TAGGED: TC141 on the TC091/TC097/TC098/TC105 test
  //   above (Delivered field visibility), TC143 on market-service.spec.ts's
  //   TC112 test (fills every visible row then asserts Continue enabled -
  //   the identical "valid qty -> Continue enabled" assertion).
  // - TC142 ("invalid quantity -> Continue disabled") - NOW TAGGED on the
  //   TC091/TC097/TC098/TC105 test above: live-verified FALSE using
  //   TC142's own exact test data (-1/blank/10.5) injected directly into
  //   Delivery, bypassing the keypad (which itself can't type any of these
  //   literally) - Continue stays enabled in every case, extending the
  //   already-documented "Continue always enabled" finding (TC111).
  // - TC144/TC146 ("Continue -> workflow summary" / "reopen Delivery from
  //   workflow") - NOW TAGGED on the TC109-TC114 test below (identical
  //   mechanism to TC113/TC114: submitFillsAndReturnToChecklist -> saved-
  //   successfully toast -> re-tap Delivery -> Product fills reopens).
  // - TC145 ("Delivery tile shows a green tick") - the completed tile's own
  //   content-desc ("Delivery\nRestock products") carries no accessible
  //   completed/tick signal to assert against - that state remains
  //   screenshot-confirmed only (same gap as TC014 elsewhere in this
  //   suite). Not tagged.
  test(
    'TC132/TC133/TC136-TC138: filter icon active state, single-tag removal, and reselect/reapply after Clear',
    { tag: ['@Market-TC130', '@Market-TC131', '@Market-TC132', '@Market-TC133', '@Market-TC136', '@Market-TC137', '@Market-TC138'] },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const market = new MarketServiceScreen(driver);

      await test.step('Log in, switch to Route 10/YESTERDAY', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.defaultRoute, day: 'YESTERDAY' });
      });

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });

      let unfilteredCount = 0;
      let categoryA = '';
      let categoryB = '';
      await test.step("Open a Market location's service station and Product fills", async () => {
        // 'first' (AMEX) is Coffee-only as of 2026-08-03 - CureLeaf, the
        // real Market stop, is 'second' (see this file's own top note).
        await dashboard.clickLocationByPosition('second');
        await dashboard.openFirstServiceStation('market');
        await market.openFills();
        await market.ensureMultipleFillCategoriesExist();
        unfilteredCount = await market.getFillProductRowCount();

        // Reads whichever categories are ACTUALLY in the catalog right now
        // rather than hardcoding "CANDY"/"LG SNACKS" - same reasoning as the
        // TC116-122 test above (live-verified 2026-08-07: catalog category
        // sets drift over time). categoryA/categoryB deliberately need to
        // be two DIFFERENT categories - TC130-133 filters by categoryA,
        // TC136-138 then re-selects and applies categoryB.
        await market.openFilterSheet();
        const labels = await market.getAllFilterChipLabels();
        expect(labels.length).toBeGreaterThanOrEqual(2);
        [categoryA, categoryB] = labels.map((l) => l.replace(/\s*\(\d+\)$/, ''));
      });

      // TC132 "see active filter icon" - applying a category filter flips
      // the header filter_cta's checked/active state and narrows the list.
      // TC130 "apply selected filters -> navigate to Product Fills with
      // filtered list" is this same tapApplyFilters() + narrowed-count
      // assertion below.
      await test.step('TC130/TC132: applying a category activates the header filter icon and narrows the list', async () => {
        await market.tapFilterChip(categoryA);
        await market.tapApplyFilters();
        expect(await market.isFilterActive()).toBe(true);
        expect(await market.getFillProductRowCount()).toBeLessThanOrEqual(unfilteredCount);
      });

      // TC133 "remove single filter" - the applied category's own tag (with
      // its unlabeled close-icon sibling) removes just that filter; with
      // only one filter active, removing it fully clears filtering. TC131
      // "view filter tags on Product fills screen" is the isFilterTagVisible()
      // check right below, confirming the tag itself renders.
      await test.step('TC131/TC133: the filter tag is visible, and removing it restores the unfiltered list', async () => {
        expect(await market.isFilterTagVisible(categoryA)).toBe(true);
        await market.removeFilterTag(categoryA);
        expect(await market.isFilterActive()).toBe(false);
        expect(await market.getFillProductRowCount()).toBe(unfilteredCount);
      });

      // TC136 "reopen Filter and verify state" - after Clear (already
      // exercised in the TC116-122 test above), reopening now with zero
      // filters shows every chip deselected and Apply filters disabled.
      await test.step('TC136: reopening the filter sheet after Clear shows chips deselected and Apply disabled', async () => {
        await market.openFilterSheet();
        expect(await market.isFilterChipSelected(categoryB)).toBe(false);
        expect(await market.isApplyFiltersEnabled()).toBe(false);
      });

      // TC137/TC138 "re-select filters again" / "re-apply filters" - a
      // fresh selection re-enables Apply, and re-Applying re-narrows the
      // list exactly as the first time.
      await test.step('TC137/TC138: re-selecting and re-applying a different category narrows the list again', async () => {
        await market.tapFilterChip(categoryB);
        expect(await market.isFilterChipSelected(categoryB)).toBe(true);
        expect(await market.isApplyFiltersEnabled()).toBe(true);

        await market.tapApplyFilters();
        expect(await market.isFilterActive()).toBe(true);
        expect(await market.getFillProductRowCount()).toBeLessThanOrEqual(unfilteredCount);
      });
    }
  );
});
