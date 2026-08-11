import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndEnsureRoute, loginToFreshStartDayRoute } from '../../utils/login-flow';
import { PrepTasksScreen } from '../../screens/prep-tasks.screen';
import { HomeScreen } from '../../screens/home.screen';
import { mobileConfig } from '../../config/mobile.config';

// Traceability to Optimized_TCs_V_2.0.xlsx: TC numbers cited per assertion
// below are from the "Start of The Day" area's four Prep Tasks sub-areas
// (Product collection / Money Operations / Additional Prep / Checks).
// Every locator used here was live-verified against build 0.1.73 - see
// docs/rf-to-playwright-reuse.md's "Live verification session" section.
test.describe('Prep Tasks / Start of Day', () => {
  // Same reasoning as market-service.spec.ts/market-fill-screen.spec.ts's
  // own afterEach: leaves the app wherever the last step landed (Prep Tasks
  // list, a sub-screen, etc.) under KEEP_APP_SESSION - return to Dashboard
  // after each test so no test inherits a stale screen from whichever ran
  // before it.
  test.afterEach(async ({ driver }) => {
    await new HomeScreen(driver).returnToHome().catch(() => {});
  });

  test(
    'view all prep categories, then complete the full Start Day flow',
    { tag: ['@StartOfDay-TC071', '@StartOfDay-TC072', '@StartOfDay-TC079', '@StartOfDay-TC168', '@StartOfDay-TC184', '@StartOfDay-TC203'] },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
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
      // Uses ensureFullDayPrepComplete() (not completeFullDayPrep() directly)
      // - Start Day completion is server-tracked, not tied to the local app
      // session, so a KEEP_APP_SESSION-resumed run can find this route/day
      // already fully done from an earlier run. Money Operations/Additional
      // Prep's checkbox tiles expose NO checked/selected accessibility
      // signal at all (live-confirmed 2026-08-09 - both attributes report
      // "false" before AND after tapping), so there's no way to detect
      // "already checked" and skip re-tapping individual boxes. Guarding at
      // the whole-flow level (skip entirely if already complete) is the only
      // reliable option - re-running completeFullDayPrep() against an
      // already-done day risks blindly UNchecking boxes left checked from
      // that earlier pass.
      await test.step('TC072/TC079/TC168/TC184/TC203: complete the full Start Day flow', async () => {
        await prepTasks.ensureFullDayPrepComplete();
      });
    }
  );

  test(
    'skip a prep task via the back-press popup',
    { tag: ['@StartOfDay-TC198', '@StartOfDay-TC199'] },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);

      // Needs a genuinely FRESH (not-yet-Start-Day-completed) Prep Tasks
      // screen - Additional Prep's tile isn't reachable at all once
      // complete (see PrepTasksScreen.ensureFullDayPrepComplete's own
      // note). Tries TODAY first, only falls back to TOMORROW if TODAY
      // already turns out complete (e.g. this same file's own full-
      // completion test ran first today) - see loginToFreshStartDayRoute's
      // doc comment.
      await test.step('Log in to a fresh (not yet Start-Day-completed) day', async () => {
        await loginToFreshStartDayRoute(driver, mobileConfig.defaultRoute);
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
  //
  // CORRECTED (live-verified 2026-08-07): this test used to switch Dashboard
  // to Charlotte/103 (vendingRoute) on the theory that Miami/010 always
  // needed BA data prep. Exhaustively tested that theory today (ad-hoc-
  // bootstrapping a delivery onto Charlotte/103's empty TOMORROW, opening
  // its service station, tapping through every "Start day" gate the app
  // offers) and found the REAL mechanism: Prep Tasks/Start Day is tied to
  // the account's actual underlying route, NOT whatever route Dashboard is
  // currently displaying via the route switcher - confirmed by switching
  // Dashboard to Route 103 and immediately opening Prep Tasks via the SAME
  // hamburger menu, which showed "Start day, Route 10" regardless. Every
  // Charlotte/103 dead-end (tiles never rendering, the circular Start-day
  // loop) was this same disconnect, not a data or navigation bug. Prep
  // Tasks is ALWAYS effectively Route 10 - so this now uses defaultRoute
  // directly with the same TODAY-first/TOMORROW-fallback helper the TC198
  // test above already uses successfully, rather than a route switch that
  // was never actually reaching Prep Tasks at all.
  test(
    'view the Add product (+) icon, open Add product, and add a product with a quantity',
    { tag: ['@StartOfDay-TC075', '@StartOfDay-TC080', '@StartOfDay-TC110'] },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);

      await test.step('Log in to a fresh (not yet Start-Day-completed) day', async () => {
        await loginToFreshStartDayRoute(driver, mobileConfig.defaultRoute);
      });

      // TC075 "view Add product (+) icon"
      let beforeLines: string[] = [];
      await test.step('TC075: open Product Collection and verify the Add product (+) icon is visible', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.openProductCollection();
        expect(await prepTasks.isAddProductButtonVisible()).toBe(true);
        beforeLines = await prepTasks.getProductCollectionSummaryLines();
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
      //
      // CORRECTED (live-verified 2026-08-07): asserting a summary line
      // ends with the literal submitted qty (e.g. "\n5") assumed every
      // category starts the day at 0 - false once Route 10 has real
      // seeded par data (observed live: "CANDY\n38" before, since Snickers
      // is a CANDY item with 38 already counted). Compares each category's
      // own count before vs. after instead - the real, data-independent
      // signal that submitting qty 5 actually added 5, whatever the
      // starting count was.
      await test.step('TC110: search "Snickers", enter qty 5, submit, and verify the count updates', async () => {
        await prepTasks.fillAndSubmitAddProduct('Snickers', '5');
        const afterLines = await prepTasks.getProductCollectionSummaryLines();
        const parseLine = (line: string) => {
          const [category, countText] = line.split('\n');
          return { category, count: Number(countText) };
        };
        const before = beforeLines.map(parseLine);
        const after = afterLines.map(parseLine);
        const increasedByFive = after.some((a) => {
          const priorEntry = before.find((b) => b.category === a.category);
          const priorCount = priorEntry ? priorEntry.count : 0;
          return a.count === priorCount + 5;
        });
        expect(increasedByFive).toBe(true);
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
    { tag: ['@StartOfDay-TC169'] },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);

      await test.step('Log in, then switch to Route 10/TODAY', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.defaultRoute, day: 'TODAY' });
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
    { tag: ['@StartOfDay-TC171', '@StartOfDay-TC179', '@StartOfDay-TC180', '@StartOfDay-TC181', '@StartOfDay-TC182', '@StartOfDay-TC183'] },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);

      await test.step('Log in, then switch to Route 10/TODAY', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.defaultRoute, day: 'TODAY' });
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
