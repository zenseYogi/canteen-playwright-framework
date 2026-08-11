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

  // TC200/TC201 mirror the exact same back-arrow-again -> popup-reappears
  // -> Complete pattern already proven for Money Operations (see this
  // file's TC171/TC179-TC183 test) - folded into this SAME test/session as
  // TC198/TC199 (open -> popup -> Skip -> reopen -> popup again -> Complete)
  // rather than a separate test, since a separate fresh-day login left
  // Additional Prep in a partially-checked leftover state from an earlier
  // KEEP_APP_SESSION-persisted run (live-verified 2026-08-10: back-press
  // silently auto-completes without showing the popup at all once any
  // checklist item is already checked - the popup only appears from a
  // genuinely pristine, zero-selected state, which only this continuous
  // flow can guarantee).
  test(
    'skip then complete Additional Prep via the back-press popup, twice',
    { tag: ['@StartOfDay-TC198', '@StartOfDay-TC199', '@StartOfDay-TC200', '@StartOfDay-TC201'] },
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

      // TC200 "click on the back arrow again" - reopen Additional Prep
      // (still genuinely 0-selected, since Skip didn't check anything) and
      // trigger the popup a second time.
      await test.step('TC200: reopen Additional Prep and verify the popup reappears', async () => {
        await prepTasks.openBackPressPopup(prepTasks.subScreenTriggers.additionalPrep);
        expect(await prepTasks.isBackPressPopupVisible()).toBe(true);
      });

      // TC201 "click on the Complete button" - navigates back to the Prep
      // Tasks list with the Additional Prep tile now ticked.
      await test.step('TC201: tap Complete and verify navigation back to the Prep Tasks list', async () => {
        await prepTasks.confirmComplete();
        expect(await prepTasks.isPrepTasksListVisible()).toBe(true);
      });
    }
  );

  // Sub Area "Prep Tasks-Additional Prep" header, checklist, Continue
  // discrepancy, completion, and the overall Start day button's gating.
  //
  // NOT automated (live-verified, 2026-08-10):
  // - TC189's "label change to Collect Badges & Keys" claim - confirmed
  //   FALSE. The label is static content-desc text ("Collect Badges &
  //   Keys") both before AND after selection - no "Check for required
  //   badges & keys" pre-selection wording was observed. Only the visual
  //   turn-green part of TC189 is real (asserted below via pixel sampling).
  test(
    'TC185/187/188/189/195/196/202: header, checklist, Continue-always-enabled, completion, and overall Start day gating',
    {
      tag: [
        '@StartOfDay-TC185',
        '@StartOfDay-TC187',
        '@StartOfDay-TC188',
        '@StartOfDay-TC189',
        '@StartOfDay-TC195',
        '@StartOfDay-TC196',
        '@StartOfDay-TC202'
      ]
    },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);

      await test.step('Log in to a fresh (not yet Start-Day-completed) day', async () => {
        await loginToFreshStartDayRoute(driver, mobileConfig.defaultRoute);
      });

      // TC202 "keep Complete start of the day disabled with none selected" -
      // the Prep Tasks list's OWN bottom CTA, checked BEFORE opening any
      // sub-screen (nothing completed yet this fresh day).
      await test.step('TC202: verify the overall Start day button is disabled with nothing completed', async () => {
        await prepTasks.openFromHamburgerMenu();
        expect(await prepTasks.isOverallStartDayButtonEnabled()).toBe(false);
      });

      // TC185 "view date and route in the header" / TC187 "view checklist
      // items with counts"
      await test.step('TC185/TC187: open Additional Prep and verify the header and checklist items', async () => {
        await prepTasks.openAdditionalPrepOnly();
        const header = await prepTasks.isAdditionalPrepHeaderVisible();
        expect(header.title).toBe(true);
        expect(header.date).toBe(true);
        expect(header.route).toBe(true);
        const items = await prepTasks.isAdditionalPrepChecklistVisible();
        expect(items.collectBadgesKeys).toBe(true);
        expect(items.reviewAdHocTasks).toBe(true);
      });

      // TC188 "see Continue disabled initially" - Excel claims disabled,
      // but live-verified FALSE (same documented-discrepancy pattern as
      // TC077/TC122): Continue is enabled even with zero items selected.
      await test.step('TC188: verify Continue is enabled even with nothing selected', async () => {
        expect(await prepTasks.isContinueEnabled()).toBe(true);
      });

      // TC189 "select Check for required badges & keys" - the real,
      // reproducible part: the item visually turns green (checked) on tap.
      await test.step('TC189: select the badges/keys item and verify it turns green', async () => {
        await prepTasks.selectAdditionalPrepBadgesItem();
        expect(await prepTasks.isBadgesItemChecked()).toBe(true);
      });

      // TC195 "save and proceed" - Continue completes Additional Prep and
      // returns to the Prep Tasks list with its tile now ticked.
      await test.step('TC195: tap Continue and verify return to the Prep Tasks list', async () => {
        await prepTasks.continueFromAdditionalPrep();
        expect(await prepTasks.isPrepTasksListVisible()).toBe(true);
      });

      // TC196 "test tile/tick interactions after completion" - the now-
      // completed tile remains tappable and reopens Additional Prep.
      await test.step('TC196: re-tap the completed tile and verify it reopens Additional Prep', async () => {
        await prepTasks.reopenAdditionalPrepTile();
        expect(await prepTasks.isVisible('~Additional prep')).toBe(true);
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
    'view the Product collection title, Add product (+) icon, open Add product, and add a product with a quantity',
    { tag: ['@StartOfDay-TC074', '@StartOfDay-TC075', '@StartOfDay-TC080', '@StartOfDay-TC110'] },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);

      await test.step('Log in to a fresh (not yet Start-Day-completed) day', async () => {
        await loginToFreshStartDayRoute(driver, mobileConfig.defaultRoute);
      });

      // TC074 "view Production collection title" / TC075 "view Add product (+) icon"
      let beforeLines: string[] = [];
      await test.step('TC074/TC075: open Product Collection and verify the title and Add product (+) icon are visible', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.openProductCollection();
        expect(await prepTasks.isProductCollectionTitleVisible()).toBe(true);
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

  // Sub Area "Prep Tasks-Product collection" Add product/search flow batch.
  //
  // NOT automated (live-verified, 2026-08-10 - no reliable accessibility
  // signal to assert against, not assumptions):
  // - TC082 "view screen heading and title" - same title ("~Add product")
  //   already asserted by TC080 above, not a separate claim.
  // - TC086 "view scanner icon" - the icon is a bare, content-desc-less
  //   ImageView (structural position only, right edge of the search field) -
  //   no semantic locator exists to assert "this is a scanner" specifically.
  // - TC092/TC093 "character keypad opens" / "first item highlighted yellow" -
  //   both are purely visual (a color change / an on-screen keypad render),
  //   no accessibility attribute reflects either state.
  // - TC096 "scan a valid barcode" - requires real camera/barcode hardware,
  //   not reproducible on the emulator.
  // - TC101 "keypad displayed for qty entry" - same class as TC092, no signal.
  // - TC085 "view helper text under the search field" - live-verified FALSE
  //   on a clean re-check: the field's hint is literally just "Product",
  //   no embedded helper/description text of any kind. An earlier pass
  //   misread a multi-line hint from a stale/concatenated page-source
  //   capture - reverted rather than shipped as a false positive.
  // - TC105/TC106 "validate decimal in qty" / TC107 "verify maximum length
  //   for qty" - both live-verified INCONSISTENT across runs (2026-08-10):
  //   decimal ("1.5") sometimes leaves Add enabled, sometimes disabled;
  //   a 15-digit quantity is sometimes truncated, sometimes accepted in
  //   full - both depend on which product the "Snickers" search happens to
  //   match (likely a per-product unit-of-measure rule, e.g. weight-based
  //   items allow decimals/longer values while count-based ones don't).
  //   Neither is a stable, assertable claim without pinning to one specific
  //   known product's exact SKU - dropped rather than shipped as flaky.
  test(
    'TC084/087/090/097/099/100/102/103/108/109: Add product search dialog and quantity-field validation',
    {
      tag: [
        '@StartOfDay-TC084',
        '@StartOfDay-TC087',
        '@StartOfDay-TC090',
        '@StartOfDay-TC097',
        '@StartOfDay-TC099',
        '@StartOfDay-TC100',
        '@StartOfDay-TC102',
        '@StartOfDay-TC103',
        '@StartOfDay-TC108',
        '@StartOfDay-TC109'
      ]
    },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);

      await test.step('Log in to a fresh (not yet Start-Day-completed) day', async () => {
        await loginToFreshStartDayRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('Open Product Collection, then Add product', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.openProductCollection();
        await prepTasks.openAddProductForm();
      });

      // TC087 "view Cancel and Add buttons" - fresh form, before any search.
      await test.step('TC087: verify Cancel is visible and Add starts disabled', async () => {
        const state = await prepTasks.isAddProductFormInitialStateCorrect();
        expect(state.cancelVisible).toBe(true);
        expect(state.addDisabled).toBe(true);
      });

      // TC084/TC090 "open Search product screen"
      await test.step('TC084/TC090: tap the field and verify the Search product screen opens', async () => {
        await prepTasks.openSearchDialog();
      });

      // TC097/TC098 "no results found" for a non-matching search
      await test.step('TC097: search a non-existent product and verify "No search results found"', async () => {
        await prepTasks.searchForNonExistentProduct('zzzzznonexistentproduct999');
        expect(await prepTasks.isNoSearchResultsVisible()).toBe(true);
      });

      // TC099/TC100 "select a product and view the summary with Pkg: 1"
      await test.step('TC099/TC100: search "Snickers" and select the first match', async () => {
        await prepTasks.searchAndSelectProduct('Snickers');
      });

      // TC102/TC108/TC109 "numeric quantity accepted / Add enabled" -
      // live-verified 2026-08-10: the quantity field defaults to "1" as
      // soon as a product is selected, so Add is already enabled before
      // any typing - TC108's Excel claim ("Add disabled with no valid
      // input") is a confirmed FALSE discrepancy (there's no reachable
      // "nothing entered yet" state once a product is picked). Asserting
      // the real observed behavior for TC102/108/109 together.
      await test.step('TC102/TC108/TC109: verify the quantity field defaults to "1" with Add already enabled', async () => {
        const state = await prepTasks.getQuantityFieldValueAndAddButtonState();
        expect(state.qty).toBe('1');
        expect(state.addEnabled).toBe(true);
      });

      // TC103/TC104 "reject alphabetic quantity" - live-verified: typing
      // letters disables Add (a real rejection signal, unlike TC108's
      // default-value discrepancy above).
      await test.step('TC103: verify Add becomes disabled after entering an alphabetic quantity', async () => {
        expect(await prepTasks.enterQuantityAndCheckAddEnabled('abc')).toBe(false);
      });
    }
  );

  // Sub Area "Prep Tasks-Product collection" Totes/checklist batch.
  // Excel documents this generic per-category checklist bottom sheet twice
  // under two different category examples ("Totes"/generic wording in
  // TC111-TC122, "Candy" in TC126-TC129) - live-verified 2026-08-10 it's
  // ONE reusable component regardless of category name, so this test
  // covers both sets of tags against a single real category ("CANDY",
  // since no category literally named "Totes" exists in Route 10's data).
  //
  // NOT automated (live-verified, 2026-08-10):
  // - TC118 "scroll Totes list" - CANDY only has 4 items, all fit on
  //   screen with no overflow to scroll - not reproducible without a
  //   category that has enough items, none found live.
  // - TC120 "Totes row reflects completion with a tick" / TC129 "detect
  //   mismatch between Candy screen total and list row" - both purely
  //   visual (a green tick rendered on the category row) - the row's own
  //   content-desc is unchanged ("CANDY\n30") whether 0/4 or 4/4 complete,
  //   no accessibility signal at all. Same class of gap as the
  //   pixel-only checkbox states elsewhere - not worth a dedicated
  //   pixel-sampling helper for this single, low-value assertion.
  // - TC122 "verify Continue state after Totes" - duplicate of the
  test(
    'TC111/113/115/116/117/122/126/127/128: category checklist bottom sheet (header count, select/unselect, Continue state)',
    {
      tag: [
        '@StartOfDay-TC111',
        '@StartOfDay-TC113',
        '@StartOfDay-TC115',
        '@StartOfDay-TC116',
        '@StartOfDay-TC117',
        '@StartOfDay-TC122',
        '@StartOfDay-TC126',
        '@StartOfDay-TC127',
        '@StartOfDay-TC128'
      ]
    },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);

      await test.step('Log in to a fresh (not yet Start-Day-completed) day', async () => {
        await loginToFreshStartDayRoute(driver, mobileConfig.defaultRoute);
      });

      let itemCount = 0;

      // TC111 "open Totes screen" / "view items and quantity badges"
      await test.step('TC111: open Product Collection and open the CANDY category checklist', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.openProductCollection();
        await prepTasks.openCategoryChecklist('CANDY');
        const rows = await prepTasks.getChecklistItemRows();
        expect(rows.length).toBeGreaterThan(0);
        itemCount = await prepTasks.getChecklistItemCount();
      });

      // TC113 "view initial header quantity total"
      await test.step('TC113: verify the header starts at 0/N', async () => {
        expect(await prepTasks.getChecklistHeaderCount()).toBe(`0/${itemCount}`);
      });

      // TC115/TC126 "select multiple items" - selects the first two and
      // verifies the header reflects the running sum.
      await test.step('TC115/TC126: select two items and verify the header sums correctly', async () => {
        await prepTasks.tapChecklistItemCheckbox(0);
        await prepTasks.tapChecklistItemCheckbox(1);
        expect(await prepTasks.getChecklistHeaderCount()).toBe(`2/${itemCount}`);
      });

      // TC116/TC127 "select all items and verify full count"
      await test.step('TC116/TC127: select the remaining items and verify the full count', async () => {
        for (let i = 2; i < itemCount; i++) {
          await prepTasks.tapChecklistItemCheckbox(i);
        }
        expect(await prepTasks.getChecklistHeaderCount()).toBe(`${itemCount}/${itemCount}`);
      });

      // TC117/TC128 "unselect and verify decrease"
      await test.step('TC117/TC128: unselect one item and verify the header decreases correctly', async () => {
        await prepTasks.tapChecklistItemCheckbox(0);
        expect(await prepTasks.getChecklistHeaderCount()).toBe(`${itemCount - 1}/${itemCount}`);
      });

      // TC122 "verify Continue state after Totes" - same documented
      // discrepancy as TC077 (Continue is always enabled), asserted here
      // directly against the Product Collection screen after closing the
      // checklist rather than left as a bare comment note.
      await test.step('TC122: close the checklist sheet and verify Continue remains enabled', async () => {
        await prepTasks.closeCategoryChecklist();
        expect(await prepTasks.isContinueEnabled()).toBe(true);
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

  // Sub Area "Prep Tasks-Product collection" header/nav basics batch.
  // TC074 is tagged on the TC075/TC080/TC110 test above instead of here
  // (already asserted there via isProductCollectionTitleVisible()).
  //
  // NOT automated (live-verified, 2026-08-10):
  // - TC076 "view item name and quantity columns" - confirmed FALSE. Live
  //   uiautomator dump of the Product Collection list shows category+count
  //   summary rows (e.g. "LG SNACKS\n8" as one content-desc, see
  //   getProductCollectionSummaryLines) - no "Item"/"Quantity"/"Qty" column
  //   header text exists anywhere on the screen. Not a table.
  test(
    'TC069/TC070/TC077/TC078/TC088: Product Collection header, Continue enablement, and Add product Cancel',
    { tag: ['@StartOfDay-TC069', '@StartOfDay-TC070', '@StartOfDay-TC077', '@StartOfDay-TC078', '@StartOfDay-TC088'] },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);

      await test.step('Log in to a fresh (not yet Start-Day-completed) day', async () => {
        await loginToFreshStartDayRoute(driver, mobileConfig.defaultRoute);
      });

      // TC069 "view date and route in the header" / TC070 "view route details"
      await test.step('TC069/TC070: open Product Collection and verify the date + route header', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.openProductCollection();
        const header = await prepTasks.isDateRouteHeaderVisible();
        expect(header.date).toBe(true);
        expect(header.route).toBe(true);
      });

      // TC077 "Continue disabled with no entries" - Excel claims disabled,
      // but live-verified FALSE (also documented in this file's TC072/TC079
      // test note): Continue's enabled attribute is "true" with zero items
      // selected. Asserting the real observed behavior, not the Excel claim.
      await test.step('TC077: verify Continue is enabled even with zero entries (documented Excel discrepancy)', async () => {
        expect(await prepTasks.isContinueEnabled()).toBe(true);
      });

      // TC088 "Cancel and changes are not reflected" - opens Add product,
      // cancels without submitting, and verifies we land back on the
      // Product Collection list (not the search/entry screen) with no new
      // line added.
      await test.step('TC088: open Add product, tap Cancel, and verify no changes are reflected', async () => {
        const beforeLines = await prepTasks.getProductCollectionSummaryLines();
        await prepTasks.openAddProductForm();
        await prepTasks.cancelAddProductForm();
        expect(await prepTasks.isProductCollectionTitleVisible()).toBe(true);
        const afterLines = await prepTasks.getProductCollectionSummaryLines();
        expect(afterLines).toEqual(beforeLines);
      });

      // TC078 "Continue enabled with at least one collected line" - given
      // TC077's confirmed-always-enabled discrepancy above, this asserts
      // the (real, still-true) claim that Continue stays enabled once a
      // product has actually been added, using the same add-flow as TC110.
      await test.step('TC078: add a product and verify Continue remains enabled', async () => {
        await prepTasks.openAddProductForm();
        await prepTasks.fillAndSubmitAddProduct('Snickers', '1');
        expect(await prepTasks.isContinueEnabled()).toBe(true);
      });
    }
  );

  // Sub Area "Prep Tasks-Checks". TC216-TC219 mirror the exact same
  // back-arrow-again -> popup-reappears -> Complete pattern already proven
  // for Money Operations/Additional Prep - folded into one continuous
  // test/session for the same reason as Additional Prep's own TC198-201
  // test (a separate fresh-day login risks an inconsistent partial state
  // if Checks was already individually touched by an earlier test run).
  test(
    'skip then complete Checks via the back-press popup, twice',
    { tag: ['@StartOfDay-TC216', '@StartOfDay-TC217', '@StartOfDay-TC218', '@StartOfDay-TC219'] },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);

      await test.step('Log in to a fresh (not yet Start-Day-completed) day', async () => {
        await loginToFreshStartDayRoute(driver, mobileConfig.defaultRoute);
      });

      // TC216 "view the Skip and Complete buttons on the pop-up"
      await test.step('TC216: Open Checks and trigger the back-press Skip/Complete popup', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.openBackPressPopup(prepTasks.subScreenTriggers.checks);
        expect(await prepTasks.isBackPressPopupVisible()).toBe(true);
      });

      // TC217 "click Skip on the confirmation"
      await test.step('TC217: Skip it', async () => {
        await prepTasks.confirmSkip();
      });

      // TC218 "click on the back arrow again"
      await test.step('TC218: reopen Checks and verify the popup reappears', async () => {
        await prepTasks.openBackPressPopup(prepTasks.subScreenTriggers.checks);
        expect(await prepTasks.isBackPressPopupVisible()).toBe(true);
      });

      // TC219 "click on the Complete button"
      await test.step('TC219: tap Complete and verify navigation back to the Prep Tasks list', async () => {
        await prepTasks.confirmComplete();
        expect(await prepTasks.isPrepTasksListVisible()).toBe(true);
      });
    }
  );

  // Sub Area "Prep Tasks-Checks" header, informational items, the GeoTab
  // error path, Continue-always-enabled, and completion.
  //
  // NOT automated (live-verified, 2026-08-10):
  // - TC212's literal "both checkboxes selected" claim - NOT achievable.
  //   Vehicle check completed can never actually be marked checked via
  //   either the GeoTab error dialog's Cancel OR Dismiss button (see
  //   vehicleCheckItem's own note) - there is no reachable "both selected"
  //   state. The real, still-true part (Continue stays enabled regardless)
  //   is asserted below alongside TC211's identical claim.
  test(
    'TC204/206/207/208/209/211/212/213/214: header, checklist items, GeoTab error, Continue-always-enabled, and completion',
    {
      tag: [
        '@StartOfDay-TC204',
        '@StartOfDay-TC206',
        '@StartOfDay-TC207',
        '@StartOfDay-TC208',
        '@StartOfDay-TC209',
        '@StartOfDay-TC211',
        '@StartOfDay-TC212',
        '@StartOfDay-TC213',
        '@StartOfDay-TC214'
      ]
    },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);

      await test.step('Log in to a fresh (not yet Start-Day-completed) day', async () => {
        await loginToFreshStartDayRoute(driver, mobileConfig.defaultRoute);
      });

      // TC204 "view date and route in the header" / TC206 "view
      // informational items"
      await test.step('TC204/TC206: open Checks and verify the header and checklist items', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.openChecksOnly();
        const header = await prepTasks.isChecksHeaderVisible();
        expect(header.title).toBe(true);
        expect(header.date).toBe(true);
        expect(header.route).toBe(true);
        const items = await prepTasks.areChecksItemsVisible();
        expect(items.vehicleCheck).toBe(true);
        expect(items.safetyCheck).toBe(true);
      });

      // TC207 "see Continue disabled initially" - Excel claims disabled,
      // but live-verified FALSE (same documented-discrepancy pattern as
      // TC077/TC122/TC188): Continue is enabled even with zero selected.
      await test.step('TC207: verify Continue is enabled even with nothing selected', async () => {
        expect(await prepTasks.isContinueEnabled()).toBe(true);
      });

      // TC208 "select the first checkbox and handle error"
      await test.step('TC208: tap Vehicle check completed and verify the GeoTab error dialog', async () => {
        await prepTasks.tapVehicleCheckItem();
        const dialog = await prepTasks.isGeoTabErrorDialogVisible();
        expect(dialog.cancel).toBe(true);
        expect(dialog.dismiss).toBe(true);
      });

      // TC209 "close the error dialog via Cancel" - stays on Checks, item
      // remains unchecked (Cancel doesn't mark it done).
      await test.step('TC209: tap Cancel and verify Vehicle check stays unchecked', async () => {
        await prepTasks.cancelGeoTabError();
        expect(await prepTasks.isVisible('~Checks')).toBe(true);
        expect(await prepTasks.isVehicleCheckItemChecked()).toBe(false);
      });

      // TC211 "verify Continue remains disabled with only one selected" -
      // same confirmed-FALSE discrepancy as TC207: Continue is already
      // enabled before selecting anything, and stays enabled after
      // selecting just Safety check.
      await test.step('TC211: select Safety check and verify Continue remains enabled', async () => {
        await prepTasks.selectSafetyCheckItem();
        expect(await prepTasks.isContinueEnabled()).toBe(true);
      });

      // TC212 "enable Continue when both checkboxes are selected" - the
      // literal "both selected" state isn't reachable (see this test's own
      // top-of-block note), but attempting Vehicle check again via Dismiss
      // and confirming Continue is unaffected is the real, assertable claim.
      await test.step('TC212: attempt Vehicle check via Dismiss and verify Continue is unaffected', async () => {
        await prepTasks.tapVehicleCheckItem();
        await prepTasks.dismissGeoTabError();
        expect(await prepTasks.isVehicleCheckItemChecked()).toBe(false);
        expect(await prepTasks.isContinueEnabled()).toBe(true);
      });

      // TC213 "proceed after both selected" (in practice, after Safety
      // check alone, since that's the only reachable state) - Continue
      // completes Checks and returns to the Prep Tasks list with its tile
      // now ticked.
      await test.step('TC213: tap Continue and verify return to the Prep Tasks list', async () => {
        await prepTasks.continueFromChecks();
        expect(await prepTasks.isPrepTasksListVisible()).toBe(true);
      });

      // TC214 "test tile/tick interactions after completion" - the now-
      // completed tile remains tappable and reopens Checks.
      await test.step('TC214: re-tap the completed tile and verify it reopens Checks', async () => {
        await prepTasks.reopenChecksTile();
        expect(await prepTasks.isVisible('~Checks')).toBe(true);
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
  //
  // RE-VERIFIED (2026-08-10) for the wider TC130-166 range referenced in
  // the Excel's own bundled Outcome text (see the original Excel pull's
  // "TC069→(TC073,TC081)"-style cross-reference notes): only TC134/136/
  // 137/138 are genuinely covered by coffee-service.spec.ts's @Coffee-
  // TC134/136/137/138 tags (the skip-reason sheet). The rest of the range
  // is NOT a duplicate and is NOT automatable in this environment:
  // - TC130/TC131/TC132/TC133 all depend on an intermediate "Can't take a
  //   photo?" confirmation modal with its own Cancel button - confirmed
  //   live this modal does not exist in this build. Tapping Skip photo
  //   goes straight to the reason sheet (already covered above), and
  //   pressing back from that reason sheet exits the whole photo modal
  //   entirely rather than surfacing any intermediate confirm/cancel step.
  // - TC135/TC141/TC142/TC144/TC145/TC148/TC150-157/TC162/TC164/TC166 (the
  //   actual take-photo/rotate/label/describe/multi-photo/delete path) is
  //   genuinely BLOCKED on this build/emulator: tapping the shutter on
  //   Coffee's Before Photos camera screen never advances past the black
  //   preview, even waiting the full 30s that PrepTasksScreen.
  //   capturePhotoIfPresent() uses successfully elsewhere in this suite.
  //   That working capture path belongs to a DIFFERENT trigger (Product
  //   Collection's own Complete button) - it only looks similar in the UI,
  //   it is not the same underlying flow as this LOB-level Before/After
  //   Photos entry point, and does not transfer.
});
