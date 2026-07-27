import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndWaitForMfa, switchRoute } from '../../utils/login-flow';
import { PrepTasksScreen } from '../../screens/prep-tasks.screen';
import { mobileConfig } from '../../config/mobile.config';

// Traceability to Optimized_TCs_V_2.0.xlsx: TC numbers cited per assertion
// below are from the "Start of The Day" area's four Prep Tasks sub-areas
// (Product collection / Money Operations / Additional Prep / Checks).
// Every locator used here was live-verified against build 0.1.73 - see
// docs/rf-to-playwright-reuse.md's "Live verification session" section.
test.describe('Prep Tasks / Start of Day', () => {
  test(
    'view all prep categories, then complete the full Start Day flow',
    { tag: ['@TC071', '@TC072', '@TC079', '@TC168', '@TC184', '@TC203'] },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);

      await test.step('Log in', async () => {
        await loginAndWaitForMfa(driver);
      });

      // TC071 "I am able to view all prep categories"
      await test.step('TC071: Open Prep Tasks and verify all four categories are visible', async () => {
        await prepTasks.openFromHamburgerMenu();
        const categories = await prepTasks.arePrepCategoriesVisible();
        expect(categories.productCollection).toBe(true);
        expect(categories.moneyOperations).toBe(true);
        expect(categories.additionalPrep).toBe(true);
        expect(categories.checks).toBe(true);
      });

      // TC072 "open Product collection" / TC168 "open the Money operations
      // screen" / TC184 "open Additional prep" / TC203 "open the Checks
      // screen" / TC079 "proceed through Prep Tasks" - completeFullDayPrep()
      // walks through all four in sequence.
      //
      // NOT asserted: TC077 ("Continue disabled with no entries") and TC173
      // ("Continue disabled initially") - both directly tested live and
      // found FALSE. uiautomator dump showed enabled="true" on the Continue
      // button on both Product Collection and Money Operations with zero
      // items selected. This is a confirmed discrepancy between the Excel
      // and the real app, not an assumption - see
      // docs/rf-to-playwright-reuse.md's Phase 7 notes. The equivalent
      // claims for Additional Prep (TC188) and Checks (TC207) follow the
      // same pattern but haven't been directly tested.
      await test.step('TC072/TC079/TC168/TC184/TC203: complete the full Start Day flow', async () => {
        await prepTasks.completeFullDayPrep();
      });
    }
  );

  test(
    'skip a prep task via the back-press popup',
    { tag: ['@TC198', '@TC199'] },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);

      await test.step('Log in', async () => {
        await loginAndWaitForMfa(driver);
      });

      // TC198 "view the Skip and Complete buttons on the pop-up" - this is
      // Additional Prep's own popup TC (not TC180, which is the near-
      // identical but distinct claim for Money Operations - the Excel
      // documents the same shared UI pattern once per sub-screen).
      await test.step('TC198: Open Additional Prep and trigger the back-press Skip/Complete popup', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.openBackPressPopup(prepTasks.subScreenTriggers.additionalPrep);
        expect(await prepTasks.isBackPressPopupVisible()).toBe(true);
      });

      // TC199 "click Skip on the confirmation"
      await test.step('TC199: Skip it', async () => {
        await prepTasks.confirmSkip();
      });
    }
  );

  // PBI 729543, Sub Area "Prep Tasks-Product collection" - Excel's TC075
  // row bundles TC080/TC083/TC089/TC110 together (same Action/Outcome
  // pattern repeated for re-opening the flow a second time - TC083/TC089
  // are literal duplicates of TC075/TC080, not separately addressable).
  // Uses Charlotte/103 explicitly (not the plain defaultRoute login) since
  // Miami/010 needs BA data prep - consistent with adhoc-scheduling.spec.ts.
  test(
    'view the Add product (+) icon, open Add product, and add a product with a quantity',
    { tag: ['@TC075', '@TC080', '@TC110'] },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);

      await test.step('Log in, then switch to Charlotte/103 (Miami/010 needs BA data prep)', async () => {
        await loginAndWaitForMfa(driver);
        await switchRoute(driver, mobileConfig.vendingRoute);
      });

      // TC075 "view Add product (+) icon"
      await test.step('TC075: open Product Collection and verify the Add product (+) icon is visible', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.openProductCollection();
        expect(await prepTasks.isAddProductButtonVisible()).toBe(true);
      });

      // TC080 "open Add product screen"
      await test.step('TC080: tap the icon and verify the Add product screen opens', async () => {
        await prepTasks.openAddProductForm();
        expect(await prepTasks.isAddProductScreenVisible()).toBe(true);
      });

      // TC110 "add the product and update count" - Excel's own Test Data
      // ("Snickers - Qty 5"). Live-verified: the search field's results are
      // NOT limited to an exact "Snickers" product - multiple SKUs/package
      // sizes match (including a "Coffee Mate Snickers Creamer" variant),
      // so this asserts on the qty actually entered (5) appearing in the
      // returned list's per-category summary, not on which exact product
      // got selected by position.
      await test.step('TC110: search "Snickers", enter qty 5, submit, and verify the count updates', async () => {
        await prepTasks.fillAndSubmitAddProduct('Snickers', '5');
        const summaryLines = await prepTasks.getProductCollectionSummaryLines();
        expect(summaryLines.some((line) => line.endsWith('\n5'))).toBe(true);
      });
    }
  );

  // PBI 630328, Sub Area "Prep Tasks-Money Operations". Uses Route 10/TODAY
  // explicitly (Miami/010 data has been restored per 2026-07-27 update, but
  // defaultRoute's own day='YESTERDAY' default is still anchored to a fixed
  // seed date - see mobile.config.ts's note - so TODAY is the one confirmed
  // live to have a fresh, not-yet-completed Start Day this day).
  test(
    'TC169: view the date and route in the Money operations header',
    { tag: ['@TC169'] },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);

      await test.step('Log in, then switch to Route 10/TODAY', async () => {
        await loginAndWaitForMfa(driver);
        await switchRoute(driver, { ...mobileConfig.defaultRoute, day: 'TODAY' });
      });

      await test.step('TC169: open Money operations and verify the header (date + route) is visible', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.openMoneyOperationsOnly();
        const header = await prepTasks.isMoneyOperationsHeaderVisible();
        expect(header.title).toBe(true);
        expect(header.date).toBe(true);
        expect(header.route).toBe(true);
      });
    }
  );

  // PBI 630328, same Sub Area as TC169. TC171-TC183 is a sequential flow on
  // the Money operations checklist, but Excel actually describes TWO
  // separate endings from the same starting point (view checklist -> select
  // items -> either tap Continue directly (TC178), OR tap the back arrow to
  // get a Skip/Complete confirmation popup (TC179-183)) - not one single
  // continuous path, since completing the screen via either path ends the
  // scenario. Only one fresh (not-yet-completed) day was available live
  // (Route 10/TODAY), so this automates the richer back-arrow/Skip/Complete
  // path (TC179-183, 5 TCs) rather than TC178's Continue-button path - not
  // independently exercised this run, noted rather than assumed.
  //
  // NOT asserted (live-verified FALSE, 2026-07-27): TC172 ("items show
  // counts 10x/3x") - no count badge renders at all, just the plain labels.
  // TC173/174/175/176/177 (Continue disabled with 0 selected, enabled with
  // 1+, etc.) - Continue's `enabled` attribute is "true" regardless of
  // whether 0, 1, or 2 items are checked, tested through the full
  // check/uncheck sequence. Same class of confirmed discrepancy as the
  // Product Collection TC077/TC173 note earlier in this file.
  test(
    'TC171/TC179-TC183: Money operations checklist items and the back-arrow Skip/Complete confirmation',
    { tag: ['@TC171', '@TC179', '@TC180', '@TC181', '@TC182', '@TC183'] },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);

      await test.step('Log in, then switch to Route 10/TODAY', async () => {
        await loginAndWaitForMfa(driver);
        await switchRoute(driver, { ...mobileConfig.defaultRoute, day: 'TODAY' });
      });

      // TC171 "view available checklist items"
      await test.step('TC171: open Money operations and verify both checklist items are visible', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.openMoneyOperationsOnly();
        const items = await prepTasks.isMoneyOperationsChecklistVisible();
        expect(items.replacementMoneyBags).toBe(true);
        expect(items.changerBag).toBe(true);
      });

      // TC179 "click back arrow" -> TC180 "view Skip and Complete buttons"
      await test.step('TC179/TC180: tap the back arrow and verify the Skip/Complete confirmation popup', async () => {
        await prepTasks.tapBackArrow();
        expect(await prepTasks.isBackPressPopupVisible()).toBe(true);
      });

      // TC181 "click Skip" - Excel claims "no changes reflected, still on
      // Money operations". Live-verified FALSE (2026-07-27): Skip actually
      // navigates all the way back to the Prep Tasks list, same as a plain
      // unconfirmed back-press would - not a no-op. The tile itself is
      // NOT marked complete (still reachable, no tick), so nothing is lost,
      // but the screen does change. Asserting the real observed behavior.
      await test.step('TC181: tap Skip and verify it navigates back to the Prep Tasks list', async () => {
        await prepTasks.confirmSkip();
        expect(await prepTasks.isPrepTasksListVisible()).toBe(true);
      });

      // TC182 "click back arrow again" - since Skip already left Money
      // operations (see TC181's note), this re-enters it fresh rather than
      // literally tapping back a second time on the same still-open screen.
      await test.step('TC182: reopen Money operations, tap back, and verify the popup reappears', async () => {
        await prepTasks.openMoneyOperationsOnly();
        await prepTasks.tapBackArrow();
        expect(await prepTasks.isBackPressPopupVisible()).toBe(true);
      });

      // TC183 "click Complete" - navigates back to the Prep Tasks list
      await test.step('TC183: tap Complete and verify navigation back to the Prep Tasks list', async () => {
        await prepTasks.confirmComplete();
        expect(await prepTasks.isPrepTasksListVisible()).toBe(true);
      });
    }
  );

  // CORRECTED (2026-07-27, per BA): TC130-TC138's "Skip photo" flow is NOT
  // part of Prep Tasks/Product Collection's Continue button at all - that
  // was this Excel row's own Area/Sub Area mislabeling. The real feature is
  // a service stop's "Before Photos"/"After Photos" tile (reached AFTER
  // Start Day, at a Market/Coffee/Vending location's checklist screen -
  // Before Photos, Removals & Returns, Delivery, Audit, After Photos,
  // Market Transfers). Confirmed this is why Product Collection's Continue
  // never opened a camera no matter how non-empty the checklist was - it
  // was never going to; the whole premise of TC130-138 living here was
  // wrong. Now automated at coffee-service.spec.ts (tagged TC015/TC021/
  // TC022/TC025, the correctly-attributed Market "Before Photo" rows for
  // this same shared, LOB-agnostic component) - not duplicated here.
});
