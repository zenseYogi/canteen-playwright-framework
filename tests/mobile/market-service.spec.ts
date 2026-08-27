import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndEnsureRoute } from '../../utils/login-flow';
import { AdhocDeliveryScreen } from '../../screens/adhoc-delivery.screen';
import { PrepTasksScreen } from '../../screens/prep-tasks.screen';
import { DashboardScreen } from '../../screens/dashboard.screen';
import { HomeScreen } from '../../screens/home.screen';
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

/**
 * M-TC-005/008/013/014/015/016 (build 0.1.90) navigate to a named Miami/
 * Route 001 account (Teva Pharmaceutical or United Collection Bureau)
 * rather than a fixed Pending-tab position - live-verified 2026-08-24 that
 * clicking a position under "Pending action" alone breaks the moment an
 * earlier test in this same run completes that account (M-TC-008 tapping
 * Complete Delivery moves it to "Completed", changing every position
 * under Pending for whatever runs after it). Checking both tabs by the
 * account's own name keeps each test correct regardless of what state an
 * earlier test left the account in.
 */
async function reachMarketAccount(driver: any, accountName: string): Promise<void> {
  for (const tabLabel of ['Pending action', 'Completed']) {
    const tab = await driver.$(`//android.view.View[contains(@content-desc,"${tabLabel}")]`);
    await tab.click();
    const row = await driver.$(
      `//android.view.View[contains(@content-desc,"${tabLabel}")]/following-sibling::android.view.View//*[@clickable="true" and contains(@content-desc,"${accountName}")]`
    );
    const found = await row.waitForDisplayed({ timeout: 5_000 }).catch(() => false);
    if (found) {
      await row.click();
      return;
    }
  }
  throw new Error(`${accountName} not found under either Pending action or Completed`);
}

/**
 * Start Day (Prep Tasks) is a per-route/per-DAY server-tracked gate: until
 * it is completed, a stop's Market checklist tiles are unreachable, so every
 * Market test needs it done first. loginAndEnsureRoute() only runs it on the
 * fresh-login "select-day" gate path (see handlePostAuthScreen's own note),
 * which means a KEEP_APP_SESSION resume that lands straight on Home silently
 * skips it - exactly what broke M-TC-005/008/013/014/015/016 on 2026-08-25,
 * the first run on a NEW day after they last passed (they had inherited a
 * day whose Start Day was already complete, so the gap never showed).
 * ensureFullDayPrepComplete() is safe on an already-complete day (it just
 * taps through), so this is unconditional rather than state-detecting.
 */
async function loginAndStartDay(driver: any): Promise<void> {
  await loginAndEnsureRoute(driver, mobileConfig.miamiRoute001);
  const prepTasks = new PrepTasksScreen(driver);
  await prepTasks.openFromHamburgerMenu();
  await prepTasks.ensureFullDayPrepComplete();
}

/**
 * The Audit / "Market Physical" tile stays DISABLED until Before Photos and
 * Delivery are both done on that stop (see MarketServiceScreen's own note on
 * Audit's prerequisites) - tapping it before then is a silent no-op, which
 * surfaces downstream as tapAuditTile() timing out on a Count Type modal and
 * an Audit search field that never arrive.
 *
 * M-TC-015/016 used to get this for free: they inherited a day whose stops an
 * earlier run had already worked. On 2026-08-25 - the first run on a genuinely
 * NEW day - Teva's checklist came up fresh and both failed at the Audit tile.
 * Both sub-steps are guarded by isChecklistIconChecked, so this is a no-op on
 * a stop that is already past them (which is why M-TC-008, whose own body this
 * was extracted from, can share it).
 */
/**
 * Every Market stop currently scheduled today, across both Home tabs. The tab
 * bodies carry no per-row test id, so rows are read as "every clickable node
 * with a content-desc" minus the four chrome controls that always match too
 * (the nav/menu and edit-schedule icons, and the two tab headers, which read
 * "Pending action (N)" / "Completed (N)").
 */
async function listScheduledStops(driver: any): Promise<Array<{ tab: string; name: string }>> {
  const stops: Array<{ tab: string; name: string }> = [];
  for (const tab of ['Pending action', 'Completed']) {
    await (await driver.$(`//android.view.View[contains(@content-desc,"${tab}")]`)).click();
    await driver.pause(2_000);
    for (const row of [...(await driver.$$('//*[@clickable="true" and @content-desc!=""]'))]) {
      const name = ((await row.getAttribute('content-desc')) ?? '').split('\n')[0].trim();
      const isChrome =
        name === 'Open navigation menu' ||
        name === 'Edit schedule' ||
        name.startsWith('Pending action') ||
        name.startsWith('Completed');
      if (name && !isChrome && !stops.some((s) => s.name === name)) {
        stops.push({ tab, name });
      }
    }
  }
  return stops;
}

/**
 * M-TC-014's precondition: a Market stop whose Removals & Returns tile is
 * still UNCHECKED. Leaves the caller on that stop's Market checklist and
 * returns its name.
 *
 * Recording a removal is one-way and server-tracked per account per DAY, with
 * no in-app undo, so this precondition is a consumable resource rather than
 * something a test can simply reset. It also cannot be satisfied by pinning a
 * single account, because which Market stops Route 001 carries VARIES BY DAY
 * (2026-08-24: Teva Pharmaceutical + United Collection Bureau; 2026-08-25:
 * Teva only). So this searches every scheduled stop for one that qualifies
 * and, only if none does, BOOTSTRAPS a fresh one as an ad-hoc delivery -
 * mirroring what a tester does by hand, and confirmed live 2026-08-25 against
 * a manually-added "Pet SuperMarket Sunrise" whose whole checklist (Removals
 * included) came up unchecked.
 *
 * Note M-TC-014 never records a removal itself - it only asserts Complete
 * Delivery enables while Removals stays untouched - so a stop found here stays
 * valid for later re-runs; the bootstrap is a genuine last resort.
 */
async function reachStopWithUntouchedRemovals(
  driver: any,
  home: HomeScreen,
  dashboard: DashboardScreen,
  market: MarketServiceScreen
): Promise<string | null> {
  const REMOVALS_TILE = '//android.view.View[starts-with(@content-desc,"Removals & Returns")]';

  for (const { name } of await listScheduledStops(driver)) {
    try {
      await reachMarketAccount(driver, name);
      await dashboard.openFirstServiceStation('market');
    } catch {
      await home.returnToHome(); // Not a Market stop - openFirstServiceStation found no Market station.
      continue;
    }
    if (!(await market.isChecklistIconChecked(REMOVALS_TILE))) {
      return name;
    }
    await home.returnToHome();
  }

  // Nothing scheduled qualifies - bootstrap a fresh Market stop the same way a
  // tester would by hand. A brand-new ad-hoc delivery starts with its ENTIRE
  // checklist unchecked, Removals & Returns included.
  const BOOTSTRAP_ACCOUNT = 'Pet SuperMarket';
  await home.returnToHome();
  await home.openAdhocDeliveryCreation();
  const adhoc = new AdhocDeliveryScreen(driver);
  await adhoc.searchCustomer(BOOTSTRAP_ACCOUNT);
  await adhoc.selectCustomer(BOOTSTRAP_ACCOUNT);
  // Account-scoped, NOT selectFirstMarketService() - the Service picker lists
  // every account's stations, so the unscoped call attaches the wrong stop.
  await adhoc.selectMarketServiceFor(BOOTSTRAP_ACCOUNT);
  await adhoc.selectServiceType('FULL');
  await adhoc.submitAddDelivery();

  await home.returnToHome();
  try {
    await reachMarketAccount(driver, BOOTSTRAP_ACCOUNT);
    await dashboard.openFirstServiceStation('market');
  } catch {
    return null;
  }
  return (await market.isChecklistIconChecked(REMOVALS_TILE)) ? null : BOOTSTRAP_ACCOUNT;
}

async function ensureAuditPrerequisites(market: MarketServiceScreen): Promise<void> {
  if (!(await market.isChecklistIconChecked('//android.view.View[starts-with(@content-desc,"Before Photos")]'))) {
    await market.openBeforePhotos();
    await market.openSkipPhotoReasonSheet();
    await market.enterSkipPhotoReason("Camera can't focus and take clear picture");
    await market.waitForSkipPhotoSubmitEnabled(true);
    await market.confirmSkipPhoto();
  }
  if (!(await market.isChecklistIconChecked('//android.view.View[starts-with(@content-desc,"Delivery")]'))) {
    await market.openFills();
    // An ad-hoc stop bootstrapped by reachStopWithUntouchedRemovals has no
    // backend order, so its Product fills screen arrives EMPTY with Continue
    // disabled - see ensureFillsSubmittable. No-op on a normal stop.
    await market.ensureFillsSubmittable();
    await market.submitFillsAndReturnToChecklist();
  }
}

test.describe('Market - Delivery, Add Product, Money Operations', () => {
  // Every test here navigates deep into some Market sub-flow and leaves the
  // app sitting wherever the last step landed (KEEP_APP_SESSION carries
  // that state into whatever runs next, in this suite or another) - e.g.
  // live-verified 2026-08-07: mid-search on "Search product" with the
  // keyboard still open. Returning to Dashboard after every test, not just
  // the last, means any test here can be run standalone or reordered
  // without inheriting a stale mid-flow screen from whichever ran before
  // it - same reasoning as vending-service.spec.ts's own afterEach.
  test.afterEach(async ({ driver }) => {
    await new HomeScreen(driver).returnToHome().catch(() => {});
  });

  test('reach a Market location and verify the Money Collection screen fields', async ({ driver }) => {
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
    { tag: ['@Market-TC147', '@Market-TC148', '@Market-TC149', '@Market-TC153'] },
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

      // TC148 "view date and route in the header" - same shared date/route
      // pill as every other screen (BaseScreen.isDateRouteHeaderVisible),
      // live-verified 2026-08-03 present on the Add product screen too.
      await test.step('TC148: the Add product screen shows the date/route header', async () => {
        const header = await market.isDateRouteHeaderVisible();
        expect(header.date).toBe(true);
        expect(header.route).toBe(true);
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
    'TC010/M-TC-002: view the account location name as the delivery header, and whether it persists into Product fills',
    { tag: ['@Market-TC010', '@Market-TC002'] },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const market = new MarketServiceScreen(driver);

      // CORRECTED 2026-08-21: this test previously pinned day to 'TODAY',
      // which was valid when originally written but has since drifted -
      // Route 010's real TODAY now serves a Coffee stop (White & Case LLP),
      // not the Market stop (CureLeaf) this test needs. defaultRoute's own
      // 'YESTERDAY' default is the stable choice already used elsewhere
      // (e.g. stop-preview.spec.ts's M-TC-001), so just use it directly
      // instead of re-pinning a day that will drift again.
      await test.step('Log in, switch to Route 10/YESTERDAY', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });

      // CORRECTED 2026-08-21 (build 0.1.86, live-verified): TC010/M-TC-002
      // both assume this header shows the account/location name (e.g.
      // "CuraLeaf") - that's now FALSE. The bold header immediately above
      // Before Photos reads "Order {orderNumber}" (e.g. "Order 13517362")
      // once the order data finishes loading - confirmed via a raw
      // uiautomator dump: "CureLeaf" doesn't appear anywhere in this
      // screen's accessibility tree, not just outside the header.
      // isServiceStopLocationHeaderVisible() still returns true (SOME
      // element is there), so this only surfaces as a real failure once the
      // text itself is checked, not just presence.
      //
      // NOT asserted as the specific "Order {n}" pattern: live-verified
      // this header can sit on a literal "null" placeholder for well over
      // 30s right after Start Day completes (a real backend order-creation
      // delay, not a UI render race) - reaching this screen via an
      // already-completed day (no fresh order just created) resolves to
      // the real order number quickly instead. Asserting "not the account
      // name" directly, the actual claim under test, avoids coupling this
      // assertion to that unrelated backend timing.
      await test.step("TC010/M-TC-002: the checklist's bold header does not show the account location name (documented FAIL)", async () => {
        await dashboard.clickLocationByPosition('first');
        await dashboard.openFirstServiceStation('market');
        expect(await market.isServiceStopLocationHeaderVisible()).toBe(true);
        const headerText = await market.getServiceStopLocationHeaderText();
        expect(headerText.toLowerCase()).not.toContain('cureleaf');
      });

      // M-TC-002's second claim ("the same name should persist across
      // Market delivery and product screens") is moot given the above - the
      // account name was never shown to begin with, so nothing persists.
      // Still asserting the concrete, observed behavior (Product fills
      // replaces the header instead of persisting anything) so a future fix
      // that changes either half of this shows up as a real test change.
      await test.step('M-TC-002: Product fills replaces the header instead of persisting anything (documented FAIL)', async () => {
        await market.openFills();
        expect(await market.isProductFillsTitleVisible()).toBe(true);
        expect(await market.isServiceStopLocationHeaderVisible()).toBe(false);
      });
    }
  );

  // M-TC-004 "Order number displays on Delivery page when an order exists" -
  // both halves of this claim live on the same checklist-header element
  // documented in the TC010/M-TC-002 test above (getServiceStopLocationHeaderText).
  test(
    'M-TC-004: order number displays for a real stop; "No Orders" for an ad-hoc one with no backend order',
    { tag: ['@Market-TC004'] },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const market = new MarketServiceScreen(driver);

      await test.step('Log in, switch to Route 10/YESTERDAY', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });

      // Positive case: a real, already-scheduled stop (CureLeaf) has a real
      // backend order - the header is SUPPOSED to show "Order {n}" once it
      // finishes loading. Live-verified this is genuinely intermittent, not
      // just slow: earlier in this same session it correctly resolved to
      // "Order 13517362" within ~1.5s; later, against the same stop, it got
      // permanently stuck on the literal "null" placeholder for 45s+ across
      // 4 independent fresh navigations (confirmed via raw content-desc
      // polling, not just a UI read) - a real backend/sync defect, not a
      // test-side race. Asserting the CORRECT intended behavior here (not
      // loosened to accept "null") so a run that hits the stuck state
      // correctly reports FAIL rather than silently passing against broken
      // output - that's the honest signal for this TC, even though it
      // means this assertion will be flaky until the underlying app defect
      // is fixed.
      await test.step('M-TC-004 positive: a real stop shows its order number', async () => {
        await dashboard.clickLocationByPosition('first');
        await dashboard.openFirstServiceStation('market');
        const headerText = await market.getServiceStopLocationHeaderText(15_000);
        expect(headerText).toMatch(/^Order \d+$/);
        await new HomeScreen(driver).returnToHome();
      });

      // Negative case: an ad-hoc delivery created on the fly was never a
      // real requested/synced order - same "no real order" rationale
      // already documented in coffee-service.screen.ts for Coffee's own
      // ad-hoc Delivery flow. Inlining login-flow.ts's own
      // ensureFreshMarketDeliveryExists steps (rather than calling it as a
      // black box) to capture the selected account's name, needed to
      // navigate back to this specific stop afterward.
      //
      // BLOCKED 2026-08-22 (build 0.1.86, live-verified): this step never
      // actually ran this session - the positive-case step above fails
      // first (real, reproduced defect, not a script bug), and this test
      // doesn't reach here as a result.
      //
      // Standalone isolated retest (not this test - a separate throwaway
      // script, since removed) found a SECOND, more fundamental blocker:
      // for a single-service account (e.g. AETNA/"Aetna Plantation -
      // Market"), submitAddDelivery()'s "Continue" tap does nothing at all.
      // Confirmed with a clean before/after comparison - captured Home's
      // exact delivery counts and Completed-tab contents immediately
      // before tapping Continue (via a real WebDriverIO click(), not a
      // manual/raw tap) and again 10s afterward: both snapshots were
      // byte-for-byte identical (same "2 Deliveries", same Completed(2) =
      // AETNA + CureLeaf). The screen itself also never visibly changes
      // (still shows the filled Add Delivery form). This isn't the
      // documented "null" placeholder/slow-load pattern seen elsewhere
      // this session - it's a real submit failure with zero user feedback,
      // reported separately. Until this is fixed, there's no way to reach
      // a genuinely order-less Market stop via the ad-hoc flow at all, so
      // this negative case stays unverified. The assertion below reflects
      // Excel's claimed correct behavior, not something independently
      // confirmed live yet.
      await test.step('M-TC-004 negative: an ad-hoc delivery with no backend order shows "No Orders"', async () => {
        const home = new HomeScreen(driver);
        await home.openAdhocDeliveryCreation();
        const adhoc = new AdhocDeliveryScreen(driver);
        await adhoc.searchCustomer('a');
        const accountName = await adhoc.selectFirstSearchedCustomer();
        await adhoc.selectFirstMarketService();
        await adhoc.selectServiceType('FULL');
        await adhoc.submitAddDelivery();
        await home.returnToHome();

        await dashboard.clickLocationByName(accountName);
        await dashboard.openFirstServiceStation('market');
        const headerText = await market.getServiceStopLocationHeaderText();
        expect(headerText).toBe('No Orders');
      });
    }
  );

  // M-TC-005 "Scheduled markets display immediately after selecting a
  // stop" - verified via AETNA's own current state (already reachable via
  // the Completed tab, same route-switch-free approach as M-TC-008 below)
  // rather than the shared pre-Start-Day test in stop-preview.spec.ts,
  // whose own loginAndEnsureRoute() call started failing consistently on
  // the Route Setup Operation-search modal (5 straight attempts, including
  // after a full app restart - a real, reproducible app defect, not
  // flakiness, but orthogonal to what M-TC-005 itself claims). The
  // mechanism under test is identical either way: tapping the "market" LOB
  // card immediately reveals its scheduled station(s) as a flat list, with
  // no additional dropdown/selection step required.
  //
  // REWRITTEN 2026-08-24 (build 0.1.90) to be fully independent, per the
  // team's own direction: this test (and the 5 below it, through M-TC-016)
  // used to assume AETNA/CureLeaf were already reachable under Home's
  // "Completed" tab from an EARLIER test's own KEEP_APP_SESSION state -
  // true on the old build/data, false on this fresh install. Each test
  // below now does its own login + route switch + navigation instead,
  // against a real, currently-live account: Miami/Route 001's own
  // "Teva Pharmaceutical Industries LTB" (Stop 1 of 2, real Order
  // 13517384) - not an ad-hoc-created one, which live-verified 2026-08-24
  // has no seeded Delivery products at all and can never reach a
  // meaningful checklist state (a genuine dead end for this class of test,
  // not a script gap).
  test(
    'M-TC-005: scheduled markets display immediately under the LOB card, no extra dropdown needed',
    { tag: ['@Market-TC005'] },
    async ({ driver }) => {
      const dashboard = new DashboardScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Miami/Route 001, complete Start Day', async () => {
        await loginAndStartDay(driver);
      });

      await test.step("Reach Teva Pharmaceutical's location detail (Stop 1)", async () => {
        await home.returnToHome();
        await reachMarketAccount(driver, 'Teva Pharmaceutical');
      });

      await test.step('M-TC-005: expanding the market LOB card immediately shows its station(s), no dropdown needed', async () => {
        const lobCardText = await dashboard.getLobCardText('market');
        expect(lobCardText).toContain('Service stations');
        const stationNames = await dashboard.getServiceStationNames('market');
        expect(stationNames.length).toBeGreaterThan(0);
      });
    }
  );

  // ==== M-TC-015 / M-TC-016 (Sub Area "Audit"), build 0.1.86/0.1.90 ====
  //
  // Live-verified 2026-08-24 on AETNA / Route 010 / YESTERDAY (build
  // 0.1.86), REWRITTEN 2026-08-24 (build 0.1.90) to run independently
  // against Teva Pharmaceutical (Miami/Route 001, Stop 1) instead - see
  // this file's own top-of-M-TC-005 note on why. Also swapped the product
  // used ("Baby Ruth 1.9oz" doesn't exist in Teva's own catalog - live-
  // verified its real products include "Balance CkieDough1.76oz - pkg: 1"
  // among others). The Audit flow in this build works as follows (none of
  // it matched what the older TC232/TC244-era helpers assumed):
  //   1. Tapping the checklist's "Audit" tile raises a "Count Type" modal
  //      first - Cycle count / Full audit / Cancel.
  //   2. Choosing one opens the Audit screen, which carries its OWN "Audit
  //      type" Cycle count/Full audit toggle over the same product list
  //      (switching it keeps already-counted rows and their counts - it is
  //      a mode switch, not a separate list).
  //   3. Searching and selecting a product adds it as a row with an
  //      editable count "pill" (an EditText) pre-filled with 1, and opens
  //      the shared in-app numeric keypad against it (digits replace, +/-
  //      step, and the value survives dismissing the keypad).
  //
  // These two tests deliberately read the starting count dynamically rather
  // than assuming an empty audit: they mutate real seeded data (a counted
  // row persists on the stop), so a hardcoded "starts at 1" would pass once
  // and then fail on every re-run.
  test(
    'M-TC-015: Audit offers Cycle count/Full audit and saves editable count pills',
    { tag: ['@Market-TC015'] },
    async ({ driver }) => {
      const dashboard = new DashboardScreen(driver);
      const home = new HomeScreen(driver);
      const market = new MarketServiceScreen(driver);

      await test.step('Log in, ensure Miami/Route 001, complete Start Day', async () => {
        await loginAndStartDay(driver);
      });

      await test.step("Reach Teva Pharmaceutical's checklist (Stop 1)", async () => {
        await home.returnToHome();
        await reachMarketAccount(driver, 'Teva Pharmaceutical');
        await dashboard.openFirstServiceStation('market');
      });

      await test.step("Ensure Before Photos and Delivery are complete (Audit's prerequisites)", async () => {
        await ensureAuditPrerequisites(market);
      });

      // The Count Type modal only ever appears the FIRST time an
      // account's Audit is opened (see tapAuditTile's own note) - if an
      // earlier run already picked a count type for this account, this
      // step is skipped rather than failed, since there's nothing left to
      // observe about the modal on this particular account anymore.
      await test.step('M-TC-015: the Audit tile raises a Count Type modal offering Cycle count and Full audit (first-time-only)', async () => {
        await market.tapAuditTile();
        const modalShown = await market.isCountTypeModalVisible();
        if (modalShown) {
          expect(await market.getCountTypeOptions()).toEqual({ cycleCount: true, fullAudit: true, cancel: true });
          await market.selectCountType('cycle');
        }
      });

      // FAIL half of M-TC-015: Excel expects "Continue should remain
      // disabled until at least one valid count is entered". It is enabled
      // from the moment the Audit screen opens, with nothing counted -
      // there is no validation-driven enable transition to observe at all.
      // Same shape as M-TC-011's own already-reported finding on Fills.
      await test.step('M-TC-015 (FAIL): Continue is already enabled before any count is entered', async () => {
        expect(await market.isAuditContinueEnabled()).toBe(true);
      });

      await test.step('M-TC-015: selecting a product adds an editable count pill', async () => {
        await market.searchAndSelectAuditProduct('Balance C', 'Balance CkieDough1.76oz - pkg: 1', 'Balance CkieDough1.76oz');
        expect(await market.getAuditProductRowCount('Balance CkieDough1.76oz')).toBe(1);
        expect(Number(await market.getAuditCount('Balance CkieDough1.76oz'))).toBeGreaterThan(0);
      });

      // Note the Audit pill's keypad behaviour is NOT the same as Product
      // fills': there the first digit tap after focusing REPLACES the
      // committed value (see tapKeypadDigit's own note), whereas here it
      // APPENDS to it - live-verified 2026-08-24, a pill holding "1"
      // becomes "14", not "4". Asserted against the observed starting
      // value rather than a hardcoded one so this stays true whatever the
      // row already held.
      let expectedCount = '';
      await test.step('M-TC-015: the pill accepts a typed count and keeps it after the keypad closes', async () => {
        const before = await market.getAuditCount('Balance CkieDough1.76oz');
        await market.focusAuditCount('Balance CkieDough1.76oz');
        await market.tapKeypadDigit('4');
        expectedCount = `${before}4`;
        expect(await market.getAuditCount('Balance CkieDough1.76oz')).toBe(expectedCount);
        await market.pressKeyCode(4);
        expect(await market.getAuditCount('Balance CkieDough1.76oz')).toBe(expectedCount);
        expect(await market.isAuditContinueEnabled()).toBe(true);
      });

      await test.step('M-TC-015: switching Audit type to Full audit keeps the counted row intact', async () => {
        await market.switchAuditType('full');
        expect(await market.getAuditProductRowCount('Balance CkieDough1.76oz')).toBe(1);
        expect(await market.getAuditCount('Balance CkieDough1.76oz')).toBe(expectedCount);
      });
    }
  );

  // M-TC-016 "Scanning a product multiple times increases its audit count".
  // The literal barcode-SCAN trigger is not automatable here (same blocker
  // as M-TC-012 - no real scanner hardware and no scan-intent mechanism in
  // this suite). What IS verified below is the behaviour the TC is actually
  // asserting: re-adding the same product to the audit increments that
  // product's existing count by 1 rather than creating a duplicate row.
  // Live-verified 2026-08-24 (6 -> 7, still a single row) via the same
  // product-selection path a scan result feeds into.
  test(
    'M-TC-016: re-selecting an already-counted product increments its count instead of duplicating the row',
    { tag: ['@Market-TC016'] },
    async ({ driver }) => {
      const dashboard = new DashboardScreen(driver);
      const home = new HomeScreen(driver);
      const market = new MarketServiceScreen(driver);

      await test.step('Log in, ensure Miami/Route 001, complete Start Day', async () => {
        await loginAndStartDay(driver);
      });

      await test.step("Reach Teva Pharmaceutical's Audit screen (Stop 1)", async () => {
        await home.returnToHome();
        await reachMarketAccount(driver, 'Teva Pharmaceutical');
        await dashboard.openFirstServiceStation('market');
        await ensureAuditPrerequisites(market);
        await market.openAudit('cycle');
      });

      await test.step('M-TC-016: count the product once, then again', async () => {
        await market.searchAndSelectAuditProduct('Balance C', 'Balance CkieDough1.76oz - pkg: 1', 'Balance CkieDough1.76oz');
        const before = Number(await market.getAuditCount('Balance CkieDough1.76oz'));
        await market.pressKeyCode(4);
        await market.searchAndSelectAuditProduct('Balance C', 'Balance CkieDough1.76oz - pkg: 1', 'Balance CkieDough1.76oz');
        expect(Number(await market.getAuditCount('Balance CkieDough1.76oz'))).toBe(before + 1);
        expect(await market.getAuditProductRowCount('Balance CkieDough1.76oz')).toBe(1);
      });
    }
  );

  // M-TC-006/M-TC-007: BLOCKED 2026-08-22, not automated this session -
  // both need a genuinely PENDING (not-yet-completed) Market checklist to
  // verify (M-TC-006: task-category item counts updating; M-TC-007:
  // Complete Delivery staying disabled then becoming enabled). Every
  // Market-capable stop on Route 010/YESTERDAY (AETNA, CureLeaf - the only
  // two accounts confirmed to expose a Market service at all today, see
  // M-TC-004's own account-scoping note) got marked fully complete during
  // this session's earlier testing, and the ad-hoc bootstrap path can't
  // create a fresh one (M-TC-004's "Continue does nothing" defect blocks
  // it for single-service accounts, and every other searched account shows
  // "No items available" in the service picker - no clean workaround
  // found). Revisit once either a fresh pending Market stop is available
  // (different day/route) or the ad-hoc Continue defect is fixed.

  // ORDERED BEFORE M-TC-008 and M-TC-013 deliberately (moved 2026-08-25):
  // this TC's whole point is that Complete Delivery enables with Removals &
  // Returns left UNTOUCHED, and on a day where Route 001 carries only the one
  // Market stop (see reachPreferredMarketAccount's note) both of those tests
  // would otherwise destroy that precondition first - M-TC-013 by adding a
  // removal, M-TC-008 by completing the stop outright. This test only ASSERTS
  // Complete Delivery is enabled, it never taps it, so it leaves the stop in a
  // state M-TC-008 can still complete afterwards.
  // REWRITTEN 2026-08-24 (build 0.1.90) to be independent, and driving the
  // needed state itself rather than reading an AETNA leftover. Uses
  // "United Collection Bureau, Inc." (Stop 2 of 2, real Order 13517385) -
  // deliberately NOT Teva, since M-TC-008 completes Teva's Removals &
  // Returns too and this TC specifically needs it left untouched. Live-
  // verified the real requirement for Complete Delivery to enable on a
  // genuine backend order: Before Photos + Delivery + Market Physical
  // (Audit) + Money Operations, but NOT Removals & Returns - confirming
  // the Excel's original claim still holds, just via a different
  // combination of prerequisites than the ad-hoc AETNA order suggested.
  test(
    'M-TC-014: driver can proceed without recording any removal',
    { tag: ['@Market-TC014'] },
    async ({ driver }) => {
      const dashboard = new DashboardScreen(driver);
      const home = new HomeScreen(driver);
      const market = new MarketServiceScreen(driver);

      await test.step('Log in, ensure Miami/Route 001, complete Start Day', async () => {
        await loginAndStartDay(driver);
      });

      // PREREQUISITE (added 2026-08-25): this TC needs a Market stop whose
      // Removals & Returns is still UNTOUCHED. That is a consumable, one-way,
      // per-account, per-day resource, and which stops the route carries
      // varies by day - so rather than pin an account name (which failed the
      // moment United Collection Bureau wasn't scheduled) the prerequisite
      // searches for a qualifying stop and bootstraps a fresh ad-hoc delivery
      // when none exists. See reachStopWithUntouchedRemovals for the detail.
      let stopName: string | null = null;
      await test.step('PREREQUISITE: reach (or create) a Market stop whose Removals & Returns is untouched', async () => {
        await home.returnToHome();
        stopName = await reachStopWithUntouchedRemovals(driver, home, dashboard, market);
        expect(
          stopName,
          'Could not find or bootstrap a Market stop with Removals & Returns untouched'
        ).not.toBeNull();
      });

      await test.step('Complete Before Photos, Delivery, and Market Physical/Audit (each idempotent)', async () => {
        await ensureAuditPrerequisites(market);
        const auditChecked = await market.isChecklistIconChecked(
          '//android.view.View[starts-with(@content-desc,"Audit") or starts-with(@content-desc,"Market Physical")]'
        );
        if (!auditChecked) {
          await market.tapAuditTile();
          // Count Type modal is once-per-account (see tapAuditTile's note).
          if (await market.isCountTypeModalVisible()) {
            await market.selectCountType('cycle');
          }
          await market.searchAndSelectAuditProduct('Balance C', 'Balance CkieDough1.76oz - pkg: 1', 'Balance CkieDough1.76oz');
          await market.tap('~Continue');
        }
      });

      await test.step('Complete Money Operations (skip money bag, save)', async () => {
        if (!(await market.isChecklistIconChecked('//android.view.View[starts-with(@content-desc,"Money Operations")]'))) {
          await market.skipMoneyOperations();
        }
      });

      await test.step('M-TC-014: Removals & Returns is untouched, but Complete Delivery is still enabled', async () => {
        const removalsRow = await driver.$('//android.view.View[starts-with(@content-desc,"Removals & Returns")]');
        const removalsRowText = (await removalsRow.getAttribute('content-desc')) ?? '';
        // The real checkmark icon carries no accessible text of its own
        // (same "state exists only in the bitmap" class as elsewhere in
        // this suite) - confirming via the row's own visited/checked
        // background instead, reusing the same pixel-based detection
        // already proven for exactly this class of icon.
        const removalsChecked = await market.isChecklistIconChecked(
          '//android.view.View[starts-with(@content-desc,"Removals & Returns")]'
        );
        expect(removalsRowText).toContain('Removals & Returns');
        expect(removalsChecked).toBe(false);
        const completeDeliveryEnabled = await market.isCompleteDeliveryEnabled();
        expect(completeDeliveryEnabled).toBe(true);
      });
    }
  );

  // M-TC-008 "Driver proceeds and marks service station complete" -
  // REWRITTEN 2026-08-24 (build 0.1.90) to be independent, driving a real
  // completion itself rather than reading an already-completed leftover.
  // Uses Teva Pharmaceutical (Stop 1 of 2, real Order 13517384) - the SAME
  // account M-TC-005/013/015/016 use, deliberately: this test is the one
  // that pushes it over the finish line (tapping Complete Delivery), and
  // live-verified reopening the checklist afterward (M-TC-013/015/016's
  // own re-entry into Removals/Audit) still works fine on a completed
  // order - Completing Delivery doesn't lock the checklist from further
  // edits. Live-verified Complete Delivery only enables once Before
  // Photos, Delivery, Market Physical (Audit), AND Money Operations are
  // all done; Removals & Returns is genuinely NOT required (see
  // M-TC-014's own note below, confirmed on United Collection Bureau) - a
  // real backend order behaves differently here than the ad-hoc-created
  // AETNA order the original session tested this against.
  test(
    'M-TC-008: a completed service station shows a green tick and a fully-updated progress bar',
    { tag: ['@Market-TC008'] },
    async ({ driver }) => {
      const dashboard = new DashboardScreen(driver);
      const home = new HomeScreen(driver);
      const market = new MarketServiceScreen(driver);

      await test.step('Log in, ensure Miami/Route 001, complete Start Day', async () => {
        await loginAndStartDay(driver);
      });

      await test.step("Reach Teva Pharmaceutical's checklist (Stop 1)", async () => {
        await home.returnToHome();
        await reachMarketAccount(driver, 'Teva Pharmaceutical');
        await dashboard.openFirstServiceStation('market');
      });

      // Before Photos, Delivery, and Market Physical/Audit are all
      // idempotent no-ops if a previous test already completed them on
      // this same account (isChecklistIconChecked-backed helpers below
      // just skip re-doing work that's already checked).
      await test.step('Ensure Before Photos and Delivery are complete (Audit\'s prerequisites)', async () => {
        await ensureAuditPrerequisites(market);
      });

      await test.step('Ensure Market Physical/Audit is complete (count one product)', async () => {
        const auditTileChecked = await market.isChecklistIconChecked(
          '//android.view.View[starts-with(@content-desc,"Audit") or starts-with(@content-desc,"Market Physical")]'
        );
        if (!auditTileChecked) {
          await market.tapAuditTile();
          // The Count Type modal is a once-per-account, server-tracked event
          // (see tapAuditTile's own note) - on an account that has already
          // picked one, the tile lands straight on the Audit screen.
          if (await market.isCountTypeModalVisible()) {
            await market.selectCountType('cycle');
          }
          await market.searchAndSelectAuditProduct('Balance C', 'Balance CkieDough1.76oz - pkg: 1', 'Balance CkieDough1.76oz');
          await market.tap('~Continue');
        }
      });

      await test.step('Complete Money Operations (skip money bag, save)', async () => {
        await market.skipMoneyOperations();
      });

      await test.step('M-TC-008: Complete Delivery is now enabled - tap it', async () => {
        expect(await market.isCompleteDeliveryEnabled()).toBe(true);
        await market.tap('~Complete Delivery');
      });

      await test.step('M-TC-008: the location detail screen shows a green tick and 100% progress', async () => {
        const progress = await dashboard.getServiceStationProgress('market');
        expect(progress).toBe(100);
        const isComplete = await dashboard.isNthServiceStationComplete('market', 'first');
        expect(isComplete).toBe(true);
      });
    }
  );

  // M-TC-009/M-TC-010/M-TC-011 "Numeric entry validation on Delivery
  // product quantities" - all three live on the same Product fills
  // Delivery field (CureLeaf/Baby Ruth 2.1oz, reached via the checklist's
  // own Delivery tile, still reachable even though Home's own tile shows
  // this stop as "Completed" - the checklist itself remains fully open for
  // re-entry, Complete Delivery just starts disabled). Using
  // enterFillQuantities' own paste-style value injection (see its own
  // corrected note) rather than real keypad taps, since the real on-screen
  // keypad has no letter or minus-sign keys at all - malformed text and
  // negative numbers can never reach this field through genuine keypad
  // interaction in the first place (same rationale already established for
  // TC168/TC169's Add Product Qty checks). This probes the app's own
  // server/business-logic validation against input a real user couldn't
  // produce via the UI, not a UI-level typing gap.
  //
  // Live-verified 2026-08-22, all three FAIL: malformed text ("abc") and a
  // negative number ("-5") are both accepted LITERALLY into the field (no
  // stripping, no rejection), and Continue stays enabled throughout -
  // before any entry, after malformed entry, after negative entry, and
  // after a valid entry alike. This is a real gap, not just "the UI has no
  // way to reach it" - Add Product's own Qty field (TC169) DOES reject
  // pasted invalid input (disables Add), so Product fills' Delivery field
  // is inconsistent with that sibling field's own validation.
  test(
    'M-TC-009/M-TC-010/M-TC-011: Delivery field accepts malformed/negative input unchanged; Continue never reflects validity',
    { tag: ['@Market-TC009', '@Market-TC010', '@Market-TC011'] },
    async ({ driver }) => {
      const dashboard = new DashboardScreen(driver);
      const home = new HomeScreen(driver);
      const market = new MarketServiceScreen(driver);

      await test.step('Ensure a stable Home screen', async () => {
        await home.returnToHome();
      });

      await test.step('Reach CureLeaf\'s Product fills, expand the first product row', async () => {
        const completedTab = await driver.$('//android.view.View[contains(@content-desc,"Completed")]');
        await completedTab.click();
        const row = await driver.$(
          '//android.view.View[contains(@content-desc,"Completed")]/following-sibling::android.view.View//*[@clickable="true" and @content-desc="CureLeaf"]'
        );
        await row.click();
        await dashboard.openFirstServiceStation('market');
        await market.openFills();
        await market.expandProductFill('first');
      });

      await test.step('Baseline: Continue is already enabled before any entry', async () => {
        expect(await market.isFillsContinueEnabled()).toBe(true);
      });

      await test.step('M-TC-009 (FAIL): malformed text "abc" is accepted literally, not rejected', async () => {
        await market.enterFillQuantities('first', { delivered: 'abc' });
        expect(await market.getFillFieldValue('first', 'Delivery')).toBe('abc');
        expect(await market.isFillsContinueEnabled()).toBe(true);
      });

      await test.step('M-TC-010 (FAIL): negative "-5" is accepted literally, not rejected', async () => {
        await market.enterFillQuantities('first', { delivered: '-5' });
        expect(await market.getFillFieldValue('first', 'Delivery')).toBe('-5');
        expect(await market.isFillsContinueEnabled()).toBe(true);
      });

      await test.step('M-TC-011 (partial): a valid positive number is accepted, but Continue was already enabled beforehand too', async () => {
        await market.enterFillQuantities('first', { delivered: '7' });
        expect(await market.getFillFieldValue('first', 'Delivery')).toBe('7');
        expect(await market.isFillsContinueEnabled()).toBe(true);
      });
    }
  );

  // M-TC-012 "Scanning a product during Add Product dismisses search
  // results and shows keypad" - BLOCKED, not automated: requires actually
  // triggering a barcode scan (real scanner hardware, or an adb-broadcast
  // intent the app's scan receiver listens for). No such mechanism exists
  // anywhere in this suite yet (confirmed via search) - every existing
  // scanner-related check only verifies the scanner ICON is present
  // (isAddProductScannerIconVisible/isSearchScannerIconVisible), never a
  // real scan result. Building one would need investigating the app's own
  // scan-intent contract first, same class of investment already flagged
  // as out of scope without real device access (see the permissions-
  // capability precedent) - not attempted this session.

  // M-TC-013 "Driver records removals with reason and quantity" - MANUALLY
  // live-verified (real screenshots, not just this automated test): search
  // surfaces a selectable "Baby Ruth 1.9oz" result, entering Qty=2 saves it
  // with no separate Save/Done step (the checklist's own "Removals &
  // Returns" tile gets a green checkmark immediately), and reopening the
  // tile afterward shows the same product+Qty persisted. The "reason" half
  // of Excel's claim (Damaged/Spoiled/Theft/Truck Return) doesn't exist in
  // this build's UI at all (see MarketServiceScreen's own note on the real
  // current structure) - only a single aggregate Qty per product.
  //
  // FLAKY 2026-08-22: this automated version of that same manual check
  // fails consistently and reproducibly on its own FIRST
  // openRemovalsAndReturns() call (search field never appears, even with a
  // 30s wait) - yet the exact same steps (same locators, same tap, same
  // wait) succeed reliably within ~3s when driven from a standalone
  // throwaway script outside this file. Root cause not found despite
  // extensive isolation attempts (checked: navigation reaches the right
  // screen beforehand: confirmed; tap-retry assumption was wrong and
  // fixed: didn't help; single generous wait: didn't help either). Given
  // the underlying claim is already solidly confirmed manually, not
  // sinking further time into this specific test-authoring mystery right
  // now - revisit if it recurs.
  // REWRITTEN 2026-08-24 (build 0.1.90) to be independent - uses Teva
  // Pharmaceutical (Stop 1), the same account M-TC-005/008/015/016 use.
  // Also fixed a real screen-structure change discovered live: selecting
  // a product NOT yet added raises a "Document product" modal (4 plain
  // EditText fields, Spoiled/Damaged/Theft/TruckReturns, then Save) -
  // matching BaseScreen.performRemovalsAndReturns()'s own shape, not the
  // single-inline-Qty flow searchAndSelectRemovalsProduct()/setRemovalsQty()
  // assumed. The SAVED row afterward does display as a single aggregate
  // Qty (confirmed via screenshot), so market-service.screen.ts's own
  // getRemovalsProductQty() locator was fixed to find it (see that
  // method's own note - no "Qty" content-desc label exists at all, only
  // the numeric value itself is a real accessible node).
  test(
    'M-TC-013: Removals & Returns saves a product quantity and displays it on reopen',
    { tag: ['@Market-TC013'] },
    async ({ driver }) => {
      const dashboard = new DashboardScreen(driver);
      const home = new HomeScreen(driver);
      const market = new MarketServiceScreen(driver);

      await test.step('Log in, ensure Miami/Route 001, complete Start Day', async () => {
        await loginAndStartDay(driver);
      });

      await test.step("Reach Teva Pharmaceutical's checklist (Stop 1)", async () => {
        await home.returnToHome();
        await reachMarketAccount(driver, 'Teva Pharmaceutical');
        await dashboard.openFirstServiceStation('market');
      });

      await test.step('M-TC-013: search, select, and save a removal quantity', async () => {
        // Deliberately a fresh, never-touched product: re-selecting one
        // ALREADY added to this account's Removals & Returns skips the
        // "Document product" modal performRemovalsAndReturns drives (it
        // goes straight to viewing the existing entry instead), so a
        // stale product would stop this test exercising the real
        // add-a-new-removal flow.
        //
        // CORRECTED 2026-08-25 (build 0.1.90, live-verified by dumping
        // this account's Removals catalog): Removals & Returns has its OWN
        // catalog that spells products out in FULL - "Balance Cookie Dough
        // Bar (1.76oz)", "Balance Chocolate Craze Bar (1.76oz)" - whereas
        // Fills/Audit use abbreviated names ("Balance CkieDough1.76oz").
        // The two are NOT interchangeable: earlier attempts here searched
        // the abbreviated forms ("Hrshy", "Balance Hny Pnut") and got zero
        // results, which read as missing data but was really a
        // wrong-catalog-naming mismatch.
        //
        // The search itself only matches a SINGLE LEADING TOKEN - live-
        // verified 2026-08-25: "Balance" returns 7 rows, while "Balance
        // Chocolate", "Chocolate Craze" and "Balance Chocolate Craze" all
        // return ZERO. It is not a substring match over the whole name, so
        // a multi-word term can never match anything here.
        //
        // Hence the bare "Balance" + position 0, which is "Balance
        // Chocolate Craze Bar (1.76oz) - pkg: 6" (the catalog's stable
        // ordering groups Chocolate Craze before Cookie Dough). Position 0
        // deliberately lands on Chocolate Craze rather than Cookie Dough so
        // this stays a different product from Audit's own ("Balance
        // CkieDough1.76oz" IS Cookie Dough under the other catalog's
        // naming), avoiding cross-test interaction with M-TC-015/016.
        await market.performRemovalsAndReturns('Balance', { spoiled: '2' });
        expect(await market.getRemovalsProductQty()).toBe('2');
      });

      await test.step('M-TC-013: reopening the tile shows the same saved quantity', async () => {
        await driver.executeScript('mobile: pressKey', [{ keycode: 4 }]);
        await market.openRemovalsAndReturns();
        expect(await market.getRemovalsProductQty()).toBe('2');
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
    'TC015/TC021/TC022/TC024/TC025: Before Photos Skip-photo flow',
    { tag: ['@Market-TC015-legacy-before-photos', '@Market-TC021', '@Market-TC022', '@Market-TC024', '@Market-TC025'] },
    async ({ driver }, testInfo) => {
      // Full Start Day + LOB navigation + multi-step skip-photo flow in one
      // session - same reasoning as coffee-service.spec.ts's own timeout bump.
      testInfo.setTimeout(240_000);
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

      await test.step("Open the day's Market service stop", async () => {
        // 'first' (AMEX) is Coffee-only as of 2026-08-03 - CureLeaf, the
        // real Market stop, is 'second' (see TC112's own note elsewhere in
        // this file for the same correction).
        await dashboard.clickLocationByPosition('second');
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
      // TC024 "type skip reason -> reason text & Skip enabled" is the same
      // real assertion as the first two lines below (entering a non-blank
      // reason enables Skip photo) - not a separate mechanism.
      await test.step('TC022/TC024: a blank reason keeps Skip photo disabled, a non-blank reason enables it', async () => {
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
  // - TC160 ("scan to find product") - NOW TAGGED (below): not reproducible
  //   end-to-end (no real barcode to scan against in this environment), but
  //   the scanner icon itself (the same assertion TC152 already makes) is
  //   TC160's own tap target, so tagging it here rather than leaving it
  //   permanently unaccounted for.
  // - TC166 ("reject alphabetic qty") - structurally impossible through the
  //   real UI, same reasoning as TC109/TC110 on the Fill screen's identical
  //   keypad: no letter keys at all. Not tagged.
  // - TC168/TC169 ("reject decimal/special-character qty") - NOW TAGGED
  //   (below, via a paste bypass - the real keypad has no decimal point or
  //   special-character keys either): TC168's decimal is silently stripped
  //   (Add stays enabled), TC169's special characters are NOT stripped but
  //   DO disable Add - two genuinely different, real, adapted behaviors.
  // - TC171/TC172 ("Add disabled with no valid qty" / "Cancel+Add enabled
  //   after valid input") - NOW TAGGED: TC167's own qty=0 case (below)
  //   proves Add disables, and TC162's post-selection default (qty=1, both
  //   buttons enabled) proves the enabled case - same assertions, not
  //   re-derived.
  test(
    'TC150-TC173/TC178-TC179: Add Product search, select, quantity entry, and submit',
    {
      tag: [
        '@Market-TC150',
        '@Market-TC151',
        '@Market-TC152',
        '@Market-TC160',
        '@Market-TC154',
        '@Market-TC155',
        '@Market-TC156',
        '@Market-TC158',
        '@Market-TC159',
        '@Market-TC161',
        '@Market-TC162',
        '@Market-TC163',
        '@Market-TC164',
        '@Market-TC165',
        '@Market-TC167',
        '@Market-TC168',
        '@Market-TC169',
        '@Market-TC170',
        '@Market-TC171',
        '@Market-TC172',
        '@Market-TC173',
        '@Market-TC175',
        '@Market-TC177',
        '@Market-TC178',
        '@Market-TC179'
      ]
    },
    async ({ driver }, testInfo) => {
      testInfo.setTimeout(240_000);
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
      await test.step("Open a Market location's service station, Product fills, then Add Product", async () => {
        // 'first' (AMEX) is Coffee-only as of 2026-08-03 - CureLeaf, the
        // real Market stop, is 'second' (see TC112's own note elsewhere in
        // this file for the same correction).
        await dashboard.clickLocationByPosition('second');
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
      // product's own rows (each SKU appears once per Pkg size). TC175
      // ("open Search product screen") restates TC154 verbatim.
      //
      // Reads the FIRST result row's own content-desc rather than hardcoding
      // a specific pkg size/SKU for "Snickers" - live-verified 2026-08-07
      // that seed data for the same search term drifts over time (this
      // suite was originally written against "Snickers (1.86oz)"/SKU 19515,
      // which no longer exists - the live result is now "Snickers (2.07oz)"/
      // SKU 1111). Later steps (TC159/TC162/TC163) reuse this same row
      // instead of their own separate hardcoded values.
      let firstResultLabel = '';
      let firstResultSku = '';
      await test.step('TC154/TC155/TC156/TC158/TC175: typing opens Search product and filters by name', async () => {
        await market.searchProduct('Snickers');
        expect(await market.isSearchProductScreenVisible()).toBe(true);
        expect(await market.isSearchScannerIconVisible()).toBe(true);
        const contentDesc = await market.getFirstSearchResultContentDesc();
        expect(contentDesc.length).toBeGreaterThan(0);
        const [label, skuLine] = contentDesc.split('\n');
        firstResultLabel = label ?? '';
        firstResultSku = (skuLine ?? '').replace('SKU: ', '');
      });

      // TC159 - searching by SKU surfaces that exact-SKU product among the
      // results (live-verified: this build's results aren't STRICTLY
      // limited to the searched SKU - an unrelated row can also surface -
      // so this asserts the exact-SKU row is present, not that it's the
      // only one). Uses the SKU read off the first result above, not a
      // hardcoded one.
      await test.step('TC159: searching by SKU surfaces the exact-SKU product', async () => {
        await market.searchProduct(firstResultSku);
        const row = await driver.$(`//android.view.View[contains(@content-desc,"SKU: ${firstResultSku}")]`);
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
      // Selects the SAME first result read above and checks the summary
      // matches THAT row's own name/SKU/pkg, rather than a hardcoded value.
      await test.step('TC162/TC163: selecting a result shows the product summary', async () => {
        await market.selectSearchResult(firstResultLabel);
        const summary = await market.getAddProductSummary();
        expect(summary.sku).toBe(`SKU: ${firstResultSku}`);
        expect(summary.name.length).toBeGreaterThan(0);
        expect(summary.pkg).toMatch(/^Pkg: \d+$/);
      });

      // TC164/TC165 - the Qty field defaults to "1", reuses the custom
      // numeric keypad, and accepts further digit taps. TC177 ("enter
      // numeric quantity -> accepted and displayed") restates TC165
      // verbatim.
      await test.step('TC164/TC165/TC177: numeric keypad visible, Qty defaults to 1, and accepts digit entry', async () => {
        expect(await market.isAddProductQtyKeypadVisible()).toBe(true);
        expect(await market.getAddProductQtyValue()).toBe('1');

        await market.tapKeypadIncrement();
        await market.tapKeypadIncrement();
        await market.tapKeypadIncrement();
        await market.tapKeypadIncrement();
        expect(await market.getAddProductQtyValue()).toBe('5');
      });

      // TC172 "Cancel enabled (grey) and Add enabled (green) after Product
      // selected + valid Pkg/Qty" - both buttons live-verified enabled at
      // this exact state (product selected via TC162/TC163 above, Qty=5
      // via TC164/TC165 above).
      await test.step('TC172: Cancel and Add are both enabled once a product is selected with a valid Qty', async () => {
        const buttons = await market.addProductButtonStates();
        expect(buttons.cancelEnabled).toBe(true);
        expect(buttons.addEnabled).toBe(true);
      });

      // TC167 "reject negative quantity" / TC171 "Add disabled with no
      // valid selection/qty yet" - the "-" stepper floor-clamps at 0
      // (never produces a literal negative), and Add itself becomes
      // disabled at Qty=0 - a real validation this screen has that the Fill
      // screen's Continue button does NOT (don't assume the two match).
      await test.step('TC167/TC171: the decrement stepper floor-clamps at 0 and disables Add', async () => {
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

      // TC168 "validate decimal in qty -> error, must be a whole number" -
      // live-verified 2026-08-07 via direct value injection (a paste - the
      // real keypad has no decimal key at all, so "1.5" can never be typed
      // to test against in the first place): the decimal point IS silently
      // STRIPPED - "1.5" becomes "15" - and Add stays enabled since "15" is
      // a valid non-zero quantity. Same silent-strip pattern already
      // documented elsewhere in this suite (TC269/TC273/TC284).
      //
      // CORRECTED (2026-08-07): reading getText() immediately after
      // setValue() raced the field's own strip-and-rerender - flaky in
      // practice (passed in isolation, failed once running after the rest
      // of this suite, "1.5" observed un-stripped both times it failed) -
      // not a real behavior difference, just reading before the app
      // finished reacting. A short pause after setValue (same fix already
      // used elsewhere for this class of race - see searchProduct's own
      // pause) made it consistently reproduce the stripped "15" across
      // repeated re-runs, isolated and inside the full suite alike.
      //
      // TC169 "validate special characters in qty -> error 'Enter a
      // number', quantity rejected" - live-verified via the same paste
      // technique: unlike TC168, "@#!" is NOT stripped (the literal
      // characters remain in the field), but Add itself becomes DISABLED -
      // a real, adapted form of rejection (button-disable, not a literal
      // banner reading "Enter a number").
      await test.step('TC168/TC169: a pasted decimal is silently stripped (Add stays enabled); pasted special characters disable Add', async () => {
        const qtyField = await driver.$('//android.widget.EditText[contains(@hint,"Qty")]');
        await qtyField.clearValue();
        await qtyField.setValue('1.5');
        await driver.pause(300);
        expect(await qtyField.getText()).toBe('15');
        expect(await market.addProductButtonStates().then((b) => b.addEnabled)).toBe(true);

        await qtyField.clearValue();
        await qtyField.setValue('@#!');
        await driver.pause(300);
        expect(await qtyField.getText()).toBe('@#!');
        expect(await market.addProductButtonStates().then((b) => b.addEnabled)).toBe(false);

        await qtyField.clearValue();
        await qtyField.setValue('5');
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
        await market.selectSearchResult(firstResultLabel);
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

  // TC180-TC209 (Market "Delivery - Sort" sub-area, PBI 611013) - the
  // Product fills Sort-by sheet. Live-verified 2026-07-28 (build 0.1.76,
  // Route 10/YESTERDAY, first Market stop, catalog: "Baby Ruth 2.1oz",
  // "Doritos NChs 1.75oz", "Doritos RF NChs 1oz"):
  //
  //   - The sheet's title is "Sort by" and lists FIVE options - "A to Z",
  //     "Z to A", "By Category", "Newest First", "Oldest First" - NOT the
  //     Excel's claimed four options, and there is no "Barcode Ascending"/
  //     "Barcode Descending" pair anywhere in this build at all (TC198-205
  //     describe a sort variant that doesn't exist here).
  //   - There is no separate "Apply sort order" button either - tapping
  //     ANY option applies it immediately and closes the sheet in one step
  //     (BaseScreen.selectSortOption's own already-proven behavior) - only
  //     "Clear sort order" exists as its own button.
  //   - Confirmed the unfiltered/no-sort-applied row order is NOT
  //     alphabetical (see market-fill-screen.spec.ts's own TC140 note) -
  //     applying "A to Z" here produces a genuinely different, correctly
  //     alphabetical order, and "Z to A" is the exact reverse.
  //
  // NOT independently asserted (documented instead):
  // - TC183/TC187/TC195 ("selected option highlighted") - no accessible
  //   signal: reopening the sheet after applying a sort shows every
  //   option's `selected` attribute still "false" - same class of gap as
  //   TC157's search-result highlight. Not tagged.
  // - TC190 ("persisted selection on reopen -> previously selected option
  //   highlighted; Apply and Clear buttons enabled") - NOW TAGGED, but
  //   scoped to only its provable half: "highlighted" has the same
  //   no-accessible-signal gap as TC183/TC187 above (not asserted), and
  //   this build has no separate "Apply" button for Sort at all to check
  //   (see this comment's own top note) - only "Clear sort order enabled
  //   on reopen" is real and already asserted, on the TC192/TC193/TC194/
  //   TC184 step below.
  // - TC182/TC184/TC185's own "both buttons enabled/disabled" framing
  //   assumes a select-then-apply-or-clear two-step flow that doesn't
  //   exist live (selecting always applies immediately, and there is no
  //   separate "Apply sort order" button to check at all - see this
  //   comment's own note above on the five real sort options) - the real,
  //   assertable behavior is just: Clear sort order starts disabled with no
  //   sort active (TC182), and becomes enabled once one is (TC184, NOW
  //   TAGGED on the TC192/TC193/TC194 step below, which already reopens
  //   the sheet post-selection and checks isClearSortEnabled()).
  // - TC185/TC191/TC196/TC201/TC206's "list returns to the default order"
  //   after Clear - live-verified FALSE: Clear resets the header sort
  //   icon's active state correctly, but the row order it leaves behind is
  //   NOT the original pre-sort order (confirmed via two direct page-source
  //   dumps: unsorted was "Baby Ruth, Doritos RF NChs, Doritos NChs", but
  //   post-Clear-after-a-sort stayed "Baby Ruth, Doritos NChs, Doritos RF
  //   NChs" - the two Doritos rows never swapped back).
  // - TC198-TC205 (Barcode Ascending/Descending) - not applicable, this
  //   sort variant doesn't exist in this build (see above).
  // - TC208/TC209 ("Continue -> workflow summary" / "Delivery tile shows a
  //   tick") - identical mechanism to the already-covered TC113/TC114.
  test(
    'TC180-TC182/TC186/TC188/TC189/TC192-TC194/TC197/TC202/TC207: Sort-by sheet contents, ascending/descending order, and Clear',
    {
      tag: [
        '@Market-TC180',
        '@Market-TC181',
        '@Market-TC182',
        '@Market-TC184',
        '@Market-TC186',
        '@Market-TC188',
        '@Market-TC189',
        '@Market-TC190',
        '@Market-TC192',
        '@Market-TC193',
        '@Market-TC194',
        '@Market-TC197',
        '@Market-TC202',
        '@Market-TC185',
        '@Market-TC191',
        '@Market-TC207'
      ]
    },
    async ({ driver }, testInfo) => {
      testInfo.setTimeout(240_000);
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
        // real Market stop, is 'second' (see TC112's own note elsewhere in
        // this file for the same correction).
        await dashboard.clickLocationByPosition('second');
        await dashboard.openFirstServiceStation('market');
        await market.openFills();
      });

      // TC180/TC181 (+ bundled TC186/TC192/TC197/TC202/TC207 - same
      // repeated Excel claim) - the sheet's title and its real five options.
      await test.step('TC180/TC181: Sort by sheet title and its five real options', async () => {
        await market.openSortSheet();
        expect(await market.isSortSheetTitleVisible()).toBe(true);
        expect(await market.isSortOptionVisible('A to Z')).toBe(true);
        expect(await market.isSortOptionVisible('Z to A')).toBe(true);
        expect(await market.isSortOptionVisible('By Category')).toBe(true);
        expect(await market.isSortOptionVisible('Newest First')).toBe(true);
        expect(await market.isSortOptionVisible('Oldest First')).toBe(true);
      });

      // TC182 - Clear sort order starts disabled with no sort active.
      await test.step('TC182: Clear sort order is disabled with no sort currently active', async () => {
        expect(await market.isClearSortEnabled()).toBe(false);
        expect(await market.isSortActive()).toBe(false);
        // Dismiss the still-open sheet from the previous step (back press) -
        // selectSortOption below expects to open it fresh via the sort_cta
        // tap, which would instead CLOSE an already-open sheet.
        await market.pressKeyCode(4);
      });

      // TC188/TC189 - applying "A to Z" activates the header sort icon and
      // produces a genuinely alphabetical row order.
      let ascendingOrder: string[] = [];
      let descendingOrder: string[] = [];
      await test.step('TC188/TC189: applying A to Z sorts the list alphabetically ascending', async () => {
        await market.selectSortOption('A to Z');
        expect(await market.isSortActive()).toBe(true);
        ascendingOrder = await market.getFillProductNamesInOrder();
        const sorted = [...ascendingOrder].sort((a, b) => a.localeCompare(b));
        expect(ascendingOrder).toEqual(sorted);
      });

      // TC192/TC193/TC194 - applying "Z to A" produces the exact reverse
      // order of "A to Z", and the header icon stays active.
      // TC184 "Clear sort order enabled after a selection" (adapted - see
      // this file's own top note: there's no separate Apply button to
      // check) - reopening the sheet after TC188/TC189's "A to Z" above
      // confirms Clear sort order is now enabled. TC190 "persisted
      // selection on reopen -> ... Apply and Clear buttons enabled" is the
      // same isClearSortEnabled() check - scoped to only that half (see
      // this file's own top note on why "highlighted" and "Apply" aren't
      // asserted).
      await test.step('TC192/TC193/TC194/TC184/TC190: reopening the sheet shows Clear sort order enabled, then applying Z to A reverses the order', async () => {
        await market.openSortSheet();
        expect(await market.isClearSortEnabled()).toBe(true);
        await market.pressKeyCode(4); // dismiss before selectSortOption re-opens it
        await market.selectSortOption('Z to A');
        expect(await market.isSortActive()).toBe(true);
        descendingOrder = await market.getFillProductNamesInOrder();
        expect(descendingOrder).toEqual([...ascendingOrder].reverse());
      });

      // TC185/TC191 ("list returns to the default order" after Clear,
      // TC191 specifically "from highlighted state" i.e. right after Z to
      // A - exactly this scenario) - live-verified FALSE, reproduced twice
      // now (this catalog and an earlier session's different one): Clear
      // sort order resets the header icon correctly, but the row order it
      // leaves behind is whatever the LAST applied sort left it in - here,
      // still the exact "Z to A" descendingOrder, not the original "A to Z"
      // ascendingOrder captured above. TC196/TC201/TC206 (the same claim
      // for barcode ascending/descending Clear) remain untagged - that sort
      // variant doesn't exist in this build at all (see this test's own
      // top note).
      await test.step('TC185/TC191: Clear sort order resets the header icon but leaves the row order unchanged', async () => {
        await market.openSortSheet();
        await market.tapClearSort();
        expect(await market.isSortActive()).toBe(false);
        expect(await market.getFillProductNamesInOrder()).toEqual(descendingOrder);
      });
    }
  );

  // TC301/TC302 (Market to Market Transfer, PBI 739293) - live-verified
  // 2026-07-28 (build 0.1.76, Route 10/YESTERDAY, first Market/"CuraLeaf"
  // stop): this route never has more than one market, so the checklist's
  // "Market Transfers" tile consistently shows an info popup instead of the
  // real Transfers screen - its wording matches the Excel's own TC302 Test
  // Data almost verbatim.
  //
  // NOT reachable in this environment (documented, not asserted):
  // - TC303-TC307 (the real Transfers screen's own Expand All/Collapse All,
  //   manual/scan product add, delete) - all require a second nearby
  //   market to exist, which this route never has (same category as
  //   TC134's earlier blocked-not-a-test-bug finding).
  // - TC308-TC327 (Money Operation - Multiple POS) - this stop has no
  //   "Money Operations" checklist tile at all (unlike the account this
  //   file's very first test exercises, which does have one - a plain
  //   single bag-code/coins/bills/refund form, not a POS list). No stop
  //   reachable this session ever showed a genuine multi-POS list, so this
  //   whole sub-area remains unverified pending an account/route that
  //   actually has one.
  test('TC301/TC302: Market Transfers shows the only-one-market info popup', { tag: ['@Market-TC301', '@Market-TC302'] }, async ({ driver }) => {
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

    await test.step("Open a Market location's service station", async () => {
      await dashboard.clickLocationByPosition('first');
      await dashboard.openFirstServiceStation('market');
    });

    await test.step('TC301/TC302: tapping Market Transfers shows the only-one-market message, OK returns to the checklist', async () => {
      await market.openMarketTransfers();
      expect(await market.isOnlyOneMarketMessageVisible()).toBe(true);
      await market.dismissOnlyOneMarketMessage();
      expect(await market.isServiceStopLocationHeaderVisible()).toBe(true);
    });
  });

  // TC112/TC143 (Market "Delivery") - entering valid data in every visible
  // Product fills row enables Continue - the exact same assertion Excel
  // lists twice under two different TC numbers.
  test('TC112/TC143: Continue is enabled once every visible row has a valid Delivery quantity', { tag: ['@Market-TC112', '@Market-TC143'] }, async ({ driver }) => {
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

    await test.step("Open a Market location's Product fills", async () => {
      // Route 10/YESTERDAY's stop 1 (AMEX) is Coffee-only - CureLeaf
      // (stop 2) is the Market stop, live-confirmed 2026-08-03.
      await dashboard.clickLocationByPosition('second');
      await dashboard.openFirstServiceStation('market');
      await market.openFills();
    });

    await test.step('TC112: fill every visible row, then verify Continue is enabled', async () => {
      await market.fillAllVisibleDeliveryQuantities('5');
      expect(await market.isFillsContinueEnabled()).toBe(true);
    });
  });

  // TC232/TC244 (Market "Audit" sub-area) and TC274/TC277/TC278 (Market
  // "After Photo" sub-area) - live-verified 2026-08-03 (build 0.1.76,
  // Route 10/YESTERDAY, CureLeaf stop). After Photos starts split into two
  // non-clickable elements (same gated-tile pattern as Vending's own After
  // Photos - see MarketServiceScreen's own note above afterPhotos) until
  // Before Photos, Removals & Returns, Delivery, AND Audit are ALL
  // completed first - this test drives that full prerequisite chain before
  // reaching either target screen.
  //
  // TC232 "scan barcode to find product" on Audit's search field - live-
  // verified the scanner icon (same unlabeled-ImageView-following-the-
  // field pattern used throughout this app) is present; not exercised
  // end-to-end (no real barcode to scan against in this environment, same
  // reasoning as TC160's own note elsewhere in this file).
  //
  // TC244 "malformed decimal (second '.') rejected" on Audit's own count
  // field - NOT tagged: live-verified this field is driven by the SAME
  // digit-only custom keypad family as every other quantity field in this
  // app (Bag code/Bills/Refund/etc.) - no decimal key exists at all, so a
  // literal "." can never be typed to test against in the first place. Same
  // reasoning as TC168/TC269 elsewhere in this suite.
  //
  // TC274/TC277/TC278 - identical shared component to Before Photos'
  // already-covered TC021/TC022/TC025 (BaseScreen's openPhotoTrigger/
  // openSkipPhotoReasonSheet), just on the After Photos trigger instead.
  test(
    'TC232/TC274/TC277/TC278: Audit scanner icon, and the After Photos skip-reason flow',
    { tag: ['@Market-TC232', '@Market-TC274', '@Market-TC277', '@Market-TC278'] },
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

      await test.step("Open CureLeaf's service station", async () => {
        await dashboard.clickLocationByPosition('second');
        await dashboard.openFirstServiceStation('market');
      });

      await test.step('Complete Before Photos (skip with a reason)', async () => {
        await market.openBeforePhotos();
        await market.openSkipPhotoReasonSheet();
        await market.enterSkipPhotoReason("Camera can't focus and take clear picture");
        await market.waitForSkipPhotoSubmitEnabled(true);
        await market.confirmSkipPhoto();
      });

      await test.step('Complete Removals & Returns (empty machine, Done)', async () => {
        await market.completeRemovalsAndReturns();
      });

      await test.step('Complete Delivery (Continue with already-valid quantities)', async () => {
        await market.openFills();
        await market.fillAllVisibleDeliveryQuantities('5');
        await market.submitFillsAndReturnToChecklist();
      });

      // TC232 - Audit's search field scanner icon.
      await test.step('TC232: Audit shows a scanner icon on its search field', async () => {
        await market.openAudit();
        expect(await market.isAuditScannerIconVisible()).toBe(true);
      });

      await test.step("Back out of Audit to the service stop checklist", async () => {
        await market.pressKeyCode(4);
      });

      // TC274/TC277/TC278 - the After Photos Skip Photo reason sheet.
      await test.step('TC274: open the After Photos skip reason sheet, disabled by default', async () => {
        await market.openAfterPhotos();
        await market.openSkipPhotoReasonSheet();
        expect(await market.isSkipPhotoReasonSheetVisible()).toBe(true);
        expect(await market.isSkipPhotoSubmitEnabled()).toBe(false);
      });

      await test.step('TC277: entering a reason enables Skip photo', async () => {
        await market.enterSkipPhotoReason("Camera can't focus and take clear picture");
        await market.waitForSkipPhotoSubmitEnabled(true);
      });

      await test.step('TC278: submitting returns to the service stop checklist without saving a photo', async () => {
        await market.confirmSkipPhoto();
        expect(await market.isSkipPhotoReasonSheetVisible()).toBe(false);
        expect(await market.isServiceStopLocationHeaderVisible()).toBe(true);
      });
    }
  );

  // TC109 (Market "Delivery" sub-area) - live-verified 2026-08-05 (build
  // 0.1.76): unlike TC110's negative-sign case below, the Theft field does
  // NOT strip or reject injected alphabetic characters - "abc" lands as
  // literal "abc". The real on-screen keypad has no letter keys at all
  // (same class as TC166), so a genuine user can never reach this state via
  // the real UI - but the field's OWN validation does not independently
  // defend against it either. This test documents the field's real,
  // current behavior (via direct injection, bypassing the keypad) rather
  // than asserting the TC's original "rejected" expectation, which does
  // not hold - flagged to Dev/QA as a decision point (retire vs. treat as
  // a real gap), same as the dev-note's own TC166 handling.
  test('TC109: Removals & Returns Theft field does not reject injected alphabetic input', { tag: ['@Market-TC109'] }, async ({ driver }) => {
    const home = new HomeScreen(driver);
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

    await test.step("Open CureLeaf's Market station and Removals & Returns for a real product", async () => {
      await dashboard.clickLocationByPosition('second');
      await dashboard.openFirstServiceStation('market');
      await market.openRemovalsAndReturnsForProduct('Snickers');
    });

    await test.step('TC109: typing "abc" into Theft lands as literal "abc" (not rejected)', async () => {
      await market.typeIntoRemovalsField('theft', 'abc');
      expect(await market.getRemovalsFieldValue('theft')).toBe('abc');
    });

    await test.step('Clean up: cancel out of Document product without saving, then return to Dashboard', async () => {
      await market.cancelDocumentProduct();
      await home.returnToHome();
    });
  });

  // TC110 (Market "Delivery" sub-area) - live-verified 2026-08-05 (build
  // 0.1.76) with the genuine RouteDriver persona on a real catalog item:
  // Removals & Returns' Damaged field silently strips a typed "-" rather
  // than accepting it as part of the value - "-5" lands as "5", not "-5".
  // Confirmed via direct field injection (setValue, bypassing whatever
  // on-screen keyboard the field normally uses) - this proves the FIELD'S
  // OWN formatting logic rejects the sign, independent of keyboard type.
  test('TC110: Removals & Returns numeric fields strip a typed negative sign', { tag: ['@Market-TC110'] }, async ({ driver }) => {
    const home = new HomeScreen(driver);
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

    await test.step("Open CureLeaf's Market station and Removals & Returns for a real product", async () => {
      await dashboard.clickLocationByPosition('second');
      await dashboard.openFirstServiceStation('market');
      await market.openRemovalsAndReturnsForProduct('Snickers');
    });

    await test.step('TC110: typing "-5" into Damaged lands as "5" (negative sign stripped)', async () => {
      await market.typeIntoRemovalsField('damaged', '-5');
      expect(await market.getRemovalsFieldValue('damaged')).toBe('5');
    });

    // Leaves the app several screens deep (Document product -> Removals &
    // Returns list -> CureLeaf's own checklist) with the injected value
    // still unsaved otherwise - live-verified 2026-08-05 this then stalls
    // the NEXT test's own login-check (KEEP_APP_SESSION resumes wherever
    // this left off, with no hamburger menu reachable at any of those
    // intermediate screens). Cancel discards the unsaved value with no
    // "Save Changes?" prompt, then returnToHome() backs all the way out to
    // Dashboard regardless of stack depth.
    await test.step('Clean up: cancel out of Document product without saving, then return to Dashboard', async () => {
      await market.cancelDocumentProduct();
      await home.returnToHome();
    });
  });

  // TC208 (Market "Delivery - Sort" sub-area) - live-verified 2026-08-05:
  // selecting any Sort option (not just leaving the list unsorted) still
  // leaves Product fills' own Continue enabled once every visible row has
  // a valid Delivery quantity - proceeding after reviewing a sorted list
  // works exactly like the unsorted case TC112/TC143 already cover.
  test('TC208: Continue stays enabled after selecting a Sort option and reviewing the list', { tag: ['@Market-TC208'] }, async ({ driver }) => {
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

    await test.step("Open CureLeaf's Product fills and fill every visible row", async () => {
      await dashboard.clickLocationByPosition('second');
      await dashboard.openFirstServiceStation('market');
      await market.openFills();
      await market.fillAllVisibleDeliveryQuantities('5');
    });

    await test.step('TC208: select a Sort option, then verify Continue is still enabled', async () => {
      await market.selectSortOption('A to Z');
      expect(await market.isFillsContinueEnabled()).toBe(true);
    });
  });

  // ==== MONEY OPERATIONS (regression sheet "Market", M-TC-017..021/030/031) ====
  //
  // ROUTE/DAY: Miami 001 on YESTERDAY, not the miamiRoute001 default of TODAY.
  // The app is parked on 26 Aug (user-configured 2026-08-27) and the Route
  // Setup "Select operation" modal is currently BROKEN - it returns no results
  // for any query and traps the app - so any day/route switch fails. Matching
  // the day the app is already on means no switch is attempted at all.
  const MONEY_OPS_ROUTE = { ...mobileConfig.miamiRoute001, day: 'YESTERDAY' as const };

  const reachMoneyOpsChecklist = async (driver: any, account = 'Teva Pharmaceutical'): Promise<MarketServiceScreen> => {
    const prepTasks = new PrepTasksScreen(driver);
    const dashboard = new DashboardScreen(driver);
    const home = new HomeScreen(driver);
    await loginAndEnsureRoute(driver, MONEY_OPS_ROUTE);
    await home.returnToHome();
    // Unconditional, never state-detected: loginAndEnsureRoute() only runs prep
    // tasks on the fresh-login select-day path, so a KEEP_APP_SESSION resume
    // landing straight on Home skips them silently - exactly what broke
    // M-TC-005/008/013/014/015/016 on 2026-08-25.
    await prepTasks.openFromHamburgerMenu();
    await prepTasks.ensureFullDayPrepComplete();
    await home.returnToHome();
    await reachMarketAccount(driver, account);
    await dashboard.openFirstServiceStation('market');
    return new MarketServiceScreen(driver);
  };

  // ==== M-TC-020 - OUT OF SCOPE (no live scanner) ====
  //
  // "Money bag entry validation and duplicate prevention [scans a valid money
  // bag barcode | add the bag with the scanned code listed]".
  //
  // NOT AUTOMATED, deliberately. The Bag code field does carry a scanner icon
  // at its right edge, so the control exists - but the emulator has no usable
  // camera, the same reason Coffee's C-TC-008/C-TC-009 (Before/After Photos)
  // are recorded Not Feasible. Driving the scanner would test the emulator's
  // camera stack, not the app.
  //
  // Recorded here rather than silently skipped so the gap is visibly a
  // DECISION. Everything the scan path shares with typed entry - the code
  // landing in the field, duplicate rejection, the bag appearing on the tile -
  // is already covered by M-TC-017/018/021, so what is genuinely untested is
  // only the barcode capture itself.
  //
  // Revisit if this suite ever runs on a physical device.

  // ==== M-TC-021 ====
  //
  // "Money Operations category displays total money bags added" -> "the Money
  // Operations category should display the count of added money bags".
  //
  // CORRECTED 2026-08-27. An earlier version of this asserted a GAP and was
  // WRONG: it read the tile without ever adding a money bag, saw the generic
  // subtitle, and concluded the count was never shown. The tile does update -
  // it just has nothing to report until a bag exists. The green "58 |
  // VSH311173" row is the POS header, NOT a list of bags; the Bag code field
  // below it is where a bag is entered.
  //
  // Live-verified full cycle: enter code "77" -> Save -> the tile reads
  // "Money Operations | POS 58 [77]"; clear the bag -> it reverts to
  // "Collect and replace money materials".
  test(
    'M-TC-021: the Money Operations tile reports the money bag once one is added',
    { tag: ['@Market-M-TC-021'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const market = await reachMoneyOpsChecklist(driver);
      const code = '77';

      await test.step('Before any bag, the tile shows only its generic subtitle', async () => {
        const before = await market.getMoneyOperationsTileText();
        console.log(`[M-TC-021] tile before = "${before}"`);
        expect(before).not.toContain(code);
      });

      await test.step('Add a money bag and save', async () => {
        await market.openMoneyOperations();
        await market.enterBagCode(code);
        expect(await market.getBagCodeValue()).toBe(code);
        await market.saveMoneyOperations();
      });

      await test.step('The tile now reports the added bag', async () => {
        const after = await market.getMoneyOperationsTileText();
        console.log(`[M-TC-021] tile after = "${after}"`);
        expect(after).toContain(code);
      });

      await test.step('Cleanup: clear the bag so the stop is left as found', async () => {
        await market.openMoneyOperations();
        await market.clearMoneyBag();
        await market.pressKeyCode(4);
        await expect
          .poll(() => market.getMoneyOperationsTileText().catch(() => ''), { timeout: 20_000 })
          .not.toContain(code);
      });
    }
  );

  // ==== M-TC-017 ====
  //
  // "Money bag entry validation and duplicate prevention [deletes a bag and
  // confirms | remove the bag from the list and update the task title count]"
  // -> "the app should remove the bag from the list and update the task title
  // count".
  //
  // The delete affordance is a swipe on the BAG CODE FIELD, not on the green
  // POS header row - swiping that row reveals nothing, which is what made this
  // look unreachable at first. The revealed control is an unlabelled Button
  // overlapping the field's right edge, and it is NOT a child of the field, so
  // BaseScreen.revealRowDeleteResilient() cannot find it (see
  // moneyBagClearButton's own note).
  //
  // Confirming clears the bag code and amounts but LEAVES the POS header
  // intact - the dialog's wording ("clear the money bag contents from
  // VSH311173") describes clearing contents, not removing the POS. The seeded
  // POS is therefore never at risk, and this test only ever clears a bag it
  // added itself.
  test(
    'M-TC-017: a money bag can be deleted after confirmation, and the tile updates',
    { tag: ['@Market-M-TC-017'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const market = await reachMoneyOpsChecklist(driver);
      const code = '88';

      await test.step('Precondition: add a money bag of our own', async () => {
        await market.openMoneyOperations();
        await market.enterBagCode(code);
        await market.saveMoneyOperations();
        expect(await market.getMoneyOperationsTileText()).toContain(code);
      });

      await test.step('M-TC-017: swiping the Bag code field reveals a clear control', async () => {
        await market.openMoneyOperations();
        expect(await market.revealBagCodeClearControl()).toBe(true);
      });

      await test.step('M-TC-017: it asks for confirmation before clearing', async () => {
        // The "and confirms" half of the case - the destructive action must
        // not happen on the swipe alone.
        await market.tapMoneyBagClearControl();
        expect(await market.isClearMoneyBagDialogVisible()).toBe(true);
      });

      await test.step('M-TC-017: confirming removes the bag', async () => {
        await market.confirmClearMoneyBag();
        await expect.poll(() => market.getBagCodeValue().catch(() => 'x'), { timeout: 20_000 }).toBe('');
      });

      await test.step('M-TC-017: the task title no longer reports the bag', async () => {
        await market.pressKeyCode(4);
        await expect
          .poll(() => market.getMoneyOperationsTileText().catch(() => ''), { timeout: 20_000 })
          .not.toContain(code);
        console.log(`[M-TC-017] tile after clear = "${await market.getMoneyOperationsTileText()}"`);
      });
    }
  );

  // ==== M-TC-018 ====
  //
  // "Money bag entry validation and duplicate prevention [enters a bag number
  // already used on the same day | block the duplicate and show a confirming
  // error message]".
  //
  // "Already used on the same day" is exercised ACROSS STOPS: the code is
  // claimed on Teva, then re-entered on United Collection Bureau, the route's
  // other Market stop. The seeded bag cannot serve as the duplicate - its code
  // VSH311173 is 9 characters and the field caps at 5 (live-verified), so it
  // is physically untypeable. The duplicate therefore has to be one we create.
  //
  // The error appears only AFTER Save - typing a used code raises nothing - so
  // this must commit before asserting.
  test(
    'M-TC-018: a bag code already used that day is rejected with an error',
    // Also carries M-TC-031's "duplicate or invalid bag codes should be
    // rejected" clause - same assertion, so it is tagged rather than
    // duplicated into a second 1.2-minute run.
    { tag: ['@Market-M-TC-018', '@Market-M-TC-031'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const home = new HomeScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const code = '55';
      const market = await reachMoneyOpsChecklist(driver);

      try {
        await test.step('Precondition: claim the code on the first Market stop', async () => {
          await market.openMoneyOperations();
          await market.enterBagCode(code);
          await market.saveMoneyOperations();
          expect(await market.getMoneyOperationsTileText()).toContain(code);
        });

        await test.step('Re-enter the same code on the other Market stop', async () => {
          await home.returnToHome();
          await reachMarketAccount(driver, 'United Collection Bureau');
          await dashboard.openFirstServiceStation('market');
          expect(await market.isMoneyOperationsVisible()).toBe(true);
          await market.openMoneyOperations();
          await market.enterBagCode(code);
          expect(await market.getBagCodeValue()).toBe(code);
        });

        await test.step('M-TC-018: the duplicate is blocked with a confirming error', async () => {
          await market.saveMoneyOperations();
          expect(await market.isBagUsedErrorVisible()).toBe(true);
          const text = await market.getBagUsedErrorText();
          console.log(`[M-TC-018] error = "${text}"`);
          // The message names the offending code, which is what makes it
          // "confirming" rather than a generic failure.
          expect(text).toContain(code);
        });
      } finally {
        // Always runs: the error dialog blocks the screen behind it, so
        // leaving it up would strand the cleanup and leave a claimed code
        // behind for the next run to trip over.
        await market.dismissBagUsedError().catch(() => {});
        await home.returnToHome().catch(() => {});
        await reachMarketAccount(driver, 'Teva Pharmaceutical').catch(() => {});
        await dashboard.openFirstServiceStation('market').catch(() => {});
        await market.openMoneyOperations().catch(() => {});
        await market.clearMoneyBag().catch(() => {});
        await market.pressKeyCode(4).catch(() => {});
      }
    }
  );

  // ==== M-TC-019 and M-TC-031 ====
  //
  // M-TC-019: "enters Refunds, Replenished Bills, and Coins | allow Continue
  // when required values are valid".
  // M-TC-031: "Skip Money Bag should disable bag code entry when selected; And
  // duplicate or invalid bag codes should be rejected; And valid replenishment
  // and refund values should enable Continue when requirements are met".
  //
  // BOTH SAY "Continue". THIS SCREEN HAS NO CONTINUE BUTTON.
  // Live-verified 2026-08-27: Money Collection offers no Continue at all -
  // leaving the screen raises "Save Changes? (Cancel / No / Save)" and Save is
  // what commits. On explicit instruction, these assert the SAVE path as the
  // equivalent of "Continue is allowed": valid values commit successfully and
  // the checklist tile reflects the saved bag.
  //
  // Recorded rather than silently substituted - if the sheet's wording
  // reflects an older design, that is worth knowing; if the screen changed,
  // the sheet needs updating. Either way the behaviour asserted here is the
  // behaviour the build actually has.
  test(
    'M-TC-019/M-TC-031: valid bag code, bills, coins and refund commit via Save',
    { tag: ['@Market-M-TC-019', '@Market-M-TC-031'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const market = await reachMoneyOpsChecklist(driver);
      const code = '66';

      try {
        await test.step('Enter a valid bag code and all three amounts', async () => {
          await market.openMoneyOperations();
          await market.enterBagCode(code);
          await market.typeIntoMoneyField('bills', '120');
          await market.typeIntoMoneyField('coins', '250');
          await market.typeIntoMoneyField('refund', '5');
          // Read back BEFORE committing - Coins and Refund reformat to 2dp
          // currency while Bills does not (see M-TC-030).
          console.log(
            `[M-TC-019] bills="${await market.getMoneyFieldValue('bills')}" ` +
              `coins="${await market.getMoneyFieldValue('coins')}" ` +
              `refund="${await market.getMoneyFieldValue('refund')}"`
          );
        });

        await test.step('Saving is allowed and commits', async () => {
          // saveMoneyOperations() throws if the Save Changes dialog never
          // appears, so reaching the assertion already proves the commit path
          // was offered.
          await market.saveMoneyOperations();
          expect(await market.isBagUsedErrorVisible()).toBe(false);
          const tile = await market.getMoneyOperationsTileText();
          console.log(`[M-TC-019] tile after save = "${tile}"`);
          expect(tile).toContain(code);
        });
      } finally {
        await market.openMoneyOperations().catch(() => {});
        await market.clearMoneyBag().catch(() => {});
        await market.pressKeyCode(4).catch(() => {});
      }
    }
  );

  // The FAILING clause of M-TC-031, split out so test.fail() cannot mask a
  // broken setup (same reason C-TC-005 is split).
  //
  // "Skip Money Bag should disable bag code entry when selected" does not
  // hold: after ticking the checkbox the Bag code field is still enabled and
  // still accepts input (live-verified 2026-08-27 - enabled=true,
  // displayed=true). A driver can tick "skip" and still type a bag code, which
  // is the contradiction the clause exists to prevent.
  test(
    'M-TC-031 (gap): ticking Skip money bag does not disable Bag code entry',
    { tag: ['@Market-M-TC-031'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      test.fail();
      const market = await reachMoneyOpsChecklist(driver);
      try {
        await market.openMoneyOperations();
        await market.setSkipMoneyBag(true);
        expect(await market.isBagCodeFieldEnabled()).toBe(false);
      } finally {
        // Untick and leave without saving, so the stop is unchanged.
        await market.setSkipMoneyBag(false).catch(() => {});
        await market.discardMoneyOperationsChanges().catch(() => {});
      }
    }
  );

  // ==== M-TC-030 ====
  //
  // "Numeric entry validation accepts valid and blocks invalid values [Money
  // Operations]" -> "valid values should be accepted; And invalid values
  // should be rejected".
  //
  // Values are INJECTED with setValue rather than typed on the custom keypad
  // - deliberately, and the same technique TC109/TC110 already use for
  // Removals & Returns. The keypad offers no letter keys at all, so driving it
  // could never test whether the FIELD rejects letters; it would only prove
  // the keypad has no letter buttons, which is not the claim.
  //
  // Split as C-TC-005 is, so test.fail() cannot mask a broken setup.
  test(
    'M-TC-030: Money Operations accepts valid numeric input and strips a negative sign',
    { tag: ['@Market-M-TC-030'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const market = await reachMoneyOpsChecklist(driver);
      await market.openMoneyOperations();

      await test.step('Bills takes a whole number unchanged', async () => {
        await market.typeIntoMoneyField('bills', '222');
        expect(await market.getMoneyFieldValue('bills')).toBe('222');
      });

      await test.step('Coins and Refund auto-format as currency', async () => {
        // Live-verified 2026-08-27: these two reformat a bare integer into
        // 2dp currency ("333" -> "3.33"), while Bills above does NOT. The
        // asymmetry is real app behaviour, not a test artefact.
        await market.typeIntoMoneyField('coins', '333');
        expect(await market.getMoneyFieldValue('coins')).toBe('3.33');
        await market.typeIntoMoneyField('refund', '444');
        expect(await market.getMoneyFieldValue('refund')).toBe('4.44');
      });

      await test.step('A negative sign is rejected', async () => {
        // "-5" comes back as "0.05" - the sign is dropped and the digits are
        // currency-formatted. Rejecting the sign is the behaviour the case
        // asks for, so this clause PASSES.
        await market.typeIntoMoneyField('coins', '-5');
        const v = await market.getMoneyFieldValue('coins');
        console.log(`[M-TC-030] coins after "-5" = "${v}"`);
        expect(v).not.toContain('-');
      });

      await test.step('Leave without saving anything', async () => {
        await market.discardMoneyOperationsChanges();
        expect(await market.isMoneyOperationsVisible()).toBe(true);
      });
    }
  );

  // The FAILING half - a REAL validation gap, not a mis-specified case.
  //
  // Bills and Refund accept alphabetic input outright: "abc" and "xyz" are
  // stored verbatim and read straight back (live-verified 2026-08-27). Coins
  // is the only one of the three that coerces its input. These are money
  // fields, so accepting letters is exactly what M-TC-030 says must not
  // happen.
  //
  // Same family as Market TC109/TC110, which already document Removals &
  // Returns' Theft field accepting injected alphabetic input - so this is a
  // recurring validation weakness across screens rather than a one-off.
  test(
    'M-TC-030 (gap): Bills and Refund accept alphabetic input',
    { tag: ['@Market-M-TC-030'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      test.fail();
      const market = await reachMoneyOpsChecklist(driver);
      await market.openMoneyOperations();
      try {
        await market.typeIntoMoneyField('bills', 'abc');
        const bills = await market.getMoneyFieldValue('bills');
        await market.typeIntoMoneyField('refund', 'xyz');
        const refund = await market.getMoneyFieldValue('refund');
        console.log(`[M-TC-030] bills after "abc" = "${bills}"; refund after "xyz" = "${refund}"`);
        expect(bills).not.toBe('abc');
        expect(refund).not.toBe('xyz');
      } finally {
        // In a finally: this test is EXPECTED to throw above, and without
        // this the junk values would be left sitting on a real stop.
        await market.discardMoneyOperationsChanges();
      }
    }
  );

  // ==== AUDIT / MACHINE TYPE (M-TC-024, M-TC-025, M-TC-029) ====
  //
  // The Audit sub-feature has five rows; M-TC-015/016 are already automated,
  // leaving these three.
  //
  // M-TC-024 and M-TC-029 are NEAR-DUPLICATES - both reduce to "Audit should
  // be shown" for a Market machine type ("Machine type audit visibility edge
  // cases [Market | Audit should be shown]" and "Machine type determines
  // available task list and audit visibility [Market | Audit should be
  // shown]"). One test carries both, tagged twice, rather than running the
  // same navigation twice; M-TC-029's extra "available task list" clause is
  // covered by asserting the whole task set, not just the Audit tile.
  test(
    'M-TC-024/M-TC-029: a Market machine type offers Audit in its task list',
    { tag: ['@Market-M-TC-024', '@Market-M-TC-029'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const market = await reachMoneyOpsChecklist(driver);

      await test.step('M-TC-024: Audit is shown for this Market station', async () => {
        // Asked by capability, not by label: the tile reads "Market Physical"
        // on some stops and "Audit" on others, and the locator matches either.
        expect(await market.isAuditTileVisible()).toBe(true);
      });

      await test.step('M-TC-029: the machine type offers the full Market task list', async () => {
        const tasks = await market.getMarketChecklistTasks();
        console.log(`[M-TC-029] tasks = ${JSON.stringify(tasks)}`);
        expect(tasks).toEqual({
          beforePhotos: true,
          moneyOperations: true,
          removalsAndReturns: true,
          delivery: true,
          audit: true,
          afterPhotos: true,
          marketTransfers: true
        });
      });
    }
  );

  // M-TC-025: "Market audit supports cycle and full count editing with
  // persistence" -> "edited counts should persist after scrolling and
  // re-entry; And Audit should complete with correct status on the workflow
  // screen".
  //
  // The count-EDITING half is already proven by M-TC-015 (typed count survives
  // the keypad closing, and survives switching Cycle <-> Full). What is new
  // here, and what this asserts, is the other two clauses: persistence across
  // LEAVING AND RE-ENTERING the Audit screen, and the checklist tile showing a
  // completed status afterwards.
  //
  // NOTE this COMPLETES Teva's Audit, which is server-tracked and not
  // reversible. That is consistent with what this suite already does to this
  // stop - M-TC-008 completes the whole service station - and the test is
  // written to tolerate an Audit an earlier run already completed.
  test(
    'M-TC-025: audit counts survive re-entry, and completing Audit updates the checklist status',
    { tag: ['@Market-M-TC-025'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const market = await reachMoneyOpsChecklist(driver);
      const product = 'Balance CkieDough1.76oz';
      let counted = '';

      await test.step("Ensure Before Photos and Delivery are done (Audit's prerequisites)", async () => {
        await ensureAuditPrerequisites(market);
      });

      await test.step('Open Audit and record a count', async () => {
        // tapAuditTile() tolerates the Count Type modal being absent - it only
        // ever appears the first time an account's Audit is opened.
        await market.tapAuditTile();
        if (await market.isCountTypeModalVisible()) {
          await market.selectCountType('cycle');
        }
        await market.searchAndSelectAuditProduct('Balance C', 'Balance CkieDough1.76oz - pkg: 1', product);
        const before = await market.getAuditCount(product);
        await market.focusAuditCount(product);
        await market.tapKeypadDigit('4');
        // The Audit pill APPENDS rather than replaces (unlike Product fills) -
        // see M-TC-015's own note - so the expectation is derived from what
        // the row already held rather than hardcoded.
        counted = `${before}4`;
        expect(await market.getAuditCount(product)).toBe(counted);
        await market.pressKeyCode(4);
      });

      await test.step('M-TC-025: the count survives leaving and re-entering Audit', async () => {
        await market.pressKeyCode(4);
        expect(await market.isAuditTileVisible()).toBe(true);
        await market.tapAuditTile();
        if (await market.isCountTypeModalVisible()) {
          await market.selectCountType('cycle');
        }
        expect(await market.getAuditProductRowCount(product)).toBe(1);
        expect(await market.getAuditCount(product)).toBe(counted);
        console.log(`[M-TC-025] count survived re-entry = "${counted}"`);
      });

      await test.step('M-TC-025: completing Audit marks it complete on the checklist', async () => {
        expect(await market.isAuditContinueEnabled()).toBe(true);
        await market.submitAudit();
        await expect
          .poll(() => market.isAuditTileComplete().catch(() => false), { timeout: 30_000 })
          .toBe(true);
      });
    }
  );

  // ==== M-TC-023 (Skip Stop gating) ====
  //
  // "Skip Stop requires reason and disposition with no defaults pre-selected"
  // -> "Reason for Skipping should default to 'Select reason' with no option
  // pre-chosen; And no disposition radio button should be pre-selected; And
  // the Skip Stop button should remain disabled until both reason and
  // disposition are selected".
  //
  // NON-DESTRUCTIVE BY CONSTRUCTION. Every clause is about the sheet's state
  // BEFORE committing, so this opens the sheet, exercises the gating, and
  // backs out - it never taps Skip stop, so no stop is taken out of service.
  //
  // Runs against United Collection Bureau, the route's SECOND Market stop,
  // rather than Teva: Teva carries the data the other Market tests lean on,
  // and there is no reason to put it near a skip flow.
  test(
    'M-TC-023: Skip Stop needs both a reason and a disposition, with neither pre-selected',
    // Also carries M-TC-035's "Skip Stop should require explicit confirmation"
    // clause - the gating asserted here IS that requirement, so it is tagged
    // rather than duplicated.
    { tag: ['@Market-M-TC-023', '@Market-M-TC-035'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const home = new HomeScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const prepTasks = new PrepTasksScreen(driver);

      await test.step('Reach the second Market stop', async () => {
        await loginAndEnsureRoute(driver, MONEY_OPS_ROUTE);
        await home.returnToHome();
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
        await reachMarketAccount(driver, 'United Collection Bureau');
      });

      try {
        await test.step('Open the skip sheet from the service station row', async () => {
          await dashboard.openSkipStopSheet('market', 'first');
          expect(await dashboard.isSkipStopSheetVisible()).toBe(true);
        });

        await test.step('M-TC-023: no reason is pre-chosen', async () => {
          const reason = await dashboard.getSkipReasonText();
          console.log(`[M-TC-023] reason row = "${reason}"`);
          expect(reason).toContain('Select reason');
        });

        await test.step('M-TC-023: no disposition is pre-selected', async () => {
          expect(await dashboard.isAnySkipDispositionSelected()).toBe(false);
        });

        await test.step('M-TC-023: Skip stop is disabled with neither chosen', async () => {
          expect(await dashboard.isSkipStopButtonEnabled()).toBe(false);
        });

        await test.step('M-TC-023: still disabled with only a reason chosen', async () => {
          // The gating claim is "until BOTH", so a reason alone must not be
          // enough - checking the halfway state is what distinguishes this
          // from a test that would pass on any two-field form.
          await dashboard.selectSkipReason('Driver Skipped');
          expect(await dashboard.isSkipStopButtonEnabled()).toBe(false);
        });

        await test.step('M-TC-023: enabled once a disposition is chosen too', async () => {
          await dashboard.selectSkipDisposition('leaveOnTruck');
          expect(await dashboard.isAnySkipDispositionSelected()).toBe(true);
          await expect
            .poll(() => dashboard.isSkipStopButtonEnabled().catch(() => false), { timeout: 15_000 })
            .toBe(true);
        });
      } finally {
        // Always: leave WITHOUT skipping. The button is enabled by this point,
        // so an accidental tap here would take a real stop out of service.
        await dashboard.dismissSkipStopSheet().catch(() => {});
        await home.returnToHome().catch(() => {});
      }
    }
  );

  // ==== M-TC-032 (skip a stop, then resume service on it) ====
  //
  // "Driver skips a stop and can resume service on a previously skipped
  // machine" -> "the stop should be marked as skipped with a visible skip
  // indicator; When the driver taps the skipped machine again; Then the driver
  // should navigate to Service Selection and complete the required service;
  // And completing the service should clear the skip indicator".
  //
  // DESTRUCTIVE, and deliberately confined to United Collection Bureau (user
  // decision 2026-08-27). Teva carries the data the other Market tests depend
  // on and is never touched here.
  //
  // WHAT THIS ASSERTS, AND WHAT IT DELIBERATELY DOES NOT:
  // The skip and the resume-navigation are asserted. The final clause -
  // completing the resumed service - is NOT, because that exact sequence is
  // what M-TC-035 documents as CORRUPTING the schedule ("skipped a service
  // station -> then again completed skipped service. now not able to see it in
  // Deliveries. Also showing Deliveries as 3, but only 1 Pending & 1
  // Completed. Need to create PBI"). A test that corrupts the route on every
  // run is worse than no test; the defect is already recorded on M-TC-035.
  //
  // Live-verified 2026-08-27, and worth knowing: skipping alone does NOT
  // corrupt anything. After the skip the counts stayed consistent (2
  // Deliveries, Pending 1, Completed 1). So the corruption belongs to the
  // COMPLETE-after-skip step, not to skipping - which narrows the PBI.
  //
  // IDEMPOTENT: a skipped station stays skipped, so the skip half runs only
  // when the station is not already skipped. The resume half always runs.
  test(
    'M-TC-032: a skipped station is marked complete and can still be re-entered to resume service',
    { tag: ['@Market-M-TC-032'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const home = new HomeScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const prepTasks = new PrepTasksScreen(driver);
      const market = new MarketServiceScreen(driver);

      await test.step('Reach the second Market stop', async () => {
        await loginAndEnsureRoute(driver, MONEY_OPS_ROUTE);
        await home.returnToHome();
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
        await reachMarketAccount(driver, 'United Collection Bureau');
      });

      await test.step('M-TC-032: skip the station if it is not already skipped', async () => {
        const alreadySkipped = (await dashboard.getServiceStationProgress('market')) === 100;
        console.log(`[M-TC-032] station already skipped/complete = ${alreadySkipped}`);
        if (!alreadySkipped) {
          await dashboard.openSkipStopSheet('market', 'first');
          await dashboard.selectSkipReason('Driver Skipped');
          await dashboard.selectSkipDisposition('leaveOnTruck');
          expect(await dashboard.isSkipStopButtonEnabled()).toBe(true);
          await dashboard.tapSkipStop();
        }
      });

      await test.step('M-TC-032: the skip is reflected on the stop', async () => {
        // The app exposes NO distinct "skipped" marker - a skipped station
        // reads exactly like a completed one (progress 100, and the stop moves
        // to Home's Completed tab). So the indicator is asserted by that
        // observable effect rather than by a label that does not exist.
        await expect
          .poll(() => dashboard.getServiceStationProgress('market').catch(() => -1), { timeout: 20_000 })
          .toBe(100);
      });

      await test.step('M-TC-032: the skipped station re-opens to a full task list', async () => {
        // "Navigate to Service Selection and complete the required service" -
        // the checklist IS that destination, and it comes back fully
        // actionable, which is what makes resuming possible.
        await dashboard.openFirstServiceStation('market');
        const tasks = await market.getMarketChecklistTasks();
        console.log(`[M-TC-032] tasks on the skipped station = ${JSON.stringify(tasks)}`);
        expect(tasks.delivery).toBe(true);
        expect(tasks.audit).toBe(true);
        expect(tasks.moneyOperations).toBe(true);
      });
    }
  );

  // ==== M-TC-036 (Complete Stop navigates to Schedule) ====
  //
  // "App navigates to Schedule after Complete Stop is selected" -> "the app
  // should navigate to the Scheduled screen".
  //
  // RUNS ON UNITED COLLECTION BUREAU, the route's second REAL seeded stop -
  // not on Teva (which the other Market tests lean on), and NOT on an ad-hoc
  // stop.
  //
  // An ad-hoc stop was tried first and CANNOT work: one arrives with "No
  // Orders" and no backend order, so although Product fills accepts a product
  // and Continue submits, the Delivery tile never ticks - which leaves
  // Complete Delivery disabled and Complete Stop absent. Same limitation that
  // moved M-TC-005/008/013/014/015/016 off ad-hoc stops originally.
  //
  // Also note Complete Stop is NOT offered on a SKIPPED stop even at 100%
  // progress, so skipping and completing are genuinely different states
  // despite reading identically on the tile.
  //
  // DESTRUCTIVE BUT RECOVERABLE (Anthony, 2026-08-27): re-running Route Setup
  // with the SAME operation and route clears the local DB and re-pulls the
  // orders, undoing this completion. That is what makes completing a real stop
  // acceptable here at all.
  //
  // RE-RUN LIMITATION, stated so nobody discovers it by watching this fail:
  // the test LEAVES United completed, so a second run finds no Complete
  // Delivery to tap. Reset first - hamburger -> Settings -> Route setup ->
  // Change route -> same operation -> same route -> confirm -> Select Day ->
  // Confirm (~2 min). Same shape of limitation as M-TC-032.
  //
  // THREE THINGS THIS COST FOUR ATTEMPTS TO LEARN, all encoded below:
  //  1. FOUR tasks gate Complete Delivery (Before Photos, Delivery, Audit,
  //     Money Operations) - not the two that ensureAuditPrerequisites does.
  //  2. An AD-HOC stop can never be completed: it has "No Orders", and its
  //     Delivery tile never ticks even after Fills is submitted.
  //  3. A SINGLE-station stop has no separate "Complete Stop" button at all.
  test(
    'M-TC-036: completing a stop navigates back to the Schedule',
    { tag: ['@Market-M-TC-036'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const home = new HomeScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const prepTasks = new PrepTasksScreen(driver);
      const market = new MarketServiceScreen(driver);

      await test.step('Log in and complete Start Day', async () => {
        await loginAndEnsureRoute(driver, MONEY_OPS_ROUTE);
        await home.returnToHome();
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('Reach the second real Market stop', async () => {
        await reachMarketAccount(driver, 'United Collection Bureau');
        await dashboard.openFirstServiceStation('market');
      });

      // FOUR tasks gate Complete Delivery, not two: Before Photos, Delivery,
      // Audit AND Money Operations. An earlier version of this test did only
      // the first two (ensureAuditPrerequisites) and Complete Delivery never
      // enabled. M-TC-008 already walks the full sequence - this mirrors it.
      // Removals & Returns is genuinely NOT required (M-TC-014 proves that).
      await test.step('Service it: Before Photos and Delivery', async () => {
        await ensureAuditPrerequisites(market);
      });

      await test.step('Service it: Audit (count one product)', async () => {
        const auditDone = await market.isChecklistIconChecked(
          '//android.view.View[starts-with(@content-desc,"Market Physical") or starts-with(@content-desc,"Audit")]'
        );
        if (!auditDone) {
          await market.tapAuditTile();
          if (await market.isCountTypeModalVisible()) {
            await market.selectCountType('cycle');
          }
          await market.searchAndSelectAuditProduct('Balance C', 'Balance CkieDough1.76oz - pkg: 1', 'Balance CkieDough1.76oz');
          await market.tap('~Continue');
        }
      });

      await test.step('Service it: Money Operations', async () => {
        await market.skipMoneyOperations();
      });

      await test.step('Complete the delivery', async () => {
        await expect
          .poll(() => market.isCompleteDeliveryEnabled().catch(() => false), { timeout: 60_000 })
          .toBe(true);
        await market.tap('~Complete Delivery');
      });

      await test.step('M-TC-036: completing the stop returns to the Schedule', async () => {
        // On a stop with ONE service station there is NO separate "Complete
        // Stop" button - completing the last service completes the stop, and
        // the app navigates straight to the Schedule. Live-verified
        // 2026-08-27 on United Collection Bureau: tapping Complete Delivery
        // landed directly on Home with the stop moved to Completed.
        //
        // A multi-station stop DOES surface Complete Stop at the stop level
        // (Coffee's own suite taps it), so this handles both rather than
        // assuming one shape: if the button is there, tap it; otherwise the
        // completion above already was the stop completion.
        if (await dashboard.isCompleteStopVisible().catch(() => false)) {
          expect(await dashboard.isCompleteStopEnabled()).toBe(true);
          await dashboard.tapCompleteStop();
        }
        // "the Scheduled screen" is Home - the schedule list with its date,
        // route badge and delivery counters. isLoaded() is this suite's own
        // "we are on Home" signal.
        await expect.poll(() => home.isLoaded().catch(() => false), { timeout: 30_000 }).toBe(true);
        // Settle on Home before reading any counter: the delivery count is
        // SCROLLING content, not a fixed header, so arriving here mid-scroll
        // makes getDeliveriesCount() throw "element wasn't found" rather than
        // return a number. returnToHome() scrolls to top first.
        await home.returnToHome();
        console.log(`[M-TC-036] after completing the stop, deliveries = ${await home.getDeliveriesCount()}`);
        expect(await home.isLoaded()).toBe(true);
      });
    }
  );

  // ==== M-TC-001 / M-TC-042 (stop list -> Stop Preview) ====
  //
  // These two rows are WORD-FOR-WORD IDENTICAL - "Driver views market stops
  // and navigates to stop preview", same Expected text, differing only in Sub
  // Feature ("Service" vs "Stop Overview"). One test carries both rather than
  // running the same navigation twice.
  //
  // Note the sheet marks M-TC-001 "Automated" while M-TC-042 is blank, yet
  // NEITHER had any code behind it - M-TC-001 is one of the rows whose
  // "Automated" status could not be traced to a test. This closes both.
  //
  // Read-only: it opens a stop and asserts, completing nothing.
  test(
    'M-TC-001/M-TC-042: pending Market stops are listed and open a Stop Preview with date, location and service type',
    { tag: ['@Market-M-TC-001', '@Market-M-TC-042'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const home = new HomeScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const prepTasks = new PrepTasksScreen(driver);

      await test.step('Log in and complete Start Day', async () => {
        await loginAndEnsureRoute(driver, MONEY_OPS_ROUTE);
        await home.returnToHome();
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('M-TC-001/042: pending Market stops are listed', async () => {
        const count = await dashboard.getLocationCount();
        console.log(`[M-TC-001/042] pending stops = ${count}`);
        expect(count).toBeGreaterThan(0);
      });

      await test.step('M-TC-001/042: tapping a stop opens its Stop Preview', async () => {
        await reachMarketAccount(driver, 'Teva Pharmaceutical');
        expect(await dashboard.isStopOverviewVisible()).toBe(true);
      });

      await test.step('M-TC-001/042: the preview shows date, location and service type', async () => {
        // The three clauses the case names, each read from its own element
        // rather than from one blob of screen text - so a missing field fails
        // on its own rather than hiding behind the others.
        expect(await dashboard.isStopOverviewDateVisible()).toBe(true);

        const name = await dashboard.getStopLocationName();
        const address = await dashboard.getStopLocationAddress();
        console.log(`[M-TC-001/042] location = "${name}" / "${address}"`);
        expect(name).not.toBe('');
        expect(address).not.toBe('');

        // "Service Type" is the LOB card - it reads e.g. "market | 1 Service
        // stations ", naming the service line served at this stop.
        const lob = await dashboard.getLobCardText('market');
        console.log(`[M-TC-001/042] service type = "${lob.replace(/\n/g, ' | ')}"`);
        expect(lob.toLowerCase()).toContain('market');
      });
    }
  );

  // ==== M-TC-038 (Navigate hands off to the maps app) ====
  //
  // "Driver navigates to stop using default maps application" -> "the device's
  // default navigation app should open with directions to the stop".
  //
  // The Market counterpart of Coffee's C-TC-045, and it follows that test's
  // three hard-won rules exactly:
  //  1. Assert on the FOREGROUND PACKAGE, never on drawn content - once maps
  //     takes over, the accessibility tree belongs to another app and this
  //     suite's locators mean nothing in it.
  //  2. Assert "a maps handler", NOT the exact package - which app is default
  //     is a DEVICE setting, so pinning it would test the emulator's config
  //     rather than the app's hand-off.
  //  3. ALWAYS restore with returnToThisApp() (activateApp, not BACK - the
  //     foreign app's back stack is not ours) and ASSERT the return, or every
  //     following test starts inside Maps.
  //
  // Pre-checked on this emulator: `cmd package resolve-activity` for
  // "geo:0,0?q=..." resolves to com.google.android.apps.maps, so a default
  // handler genuinely exists. Without one the verdict would be "untestable on
  // this device", not a failure.
  //
  // Read-only: it completes nothing.
  test(
    'M-TC-038: Navigate hands off to the default maps application',
    { tag: ['@Market-M-TC-038'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const home = new HomeScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const prepTasks = new PrepTasksScreen(driver);

      let ownPackage = '';
      await test.step('Reach a Market stop overview', async () => {
        await loginAndEnsureRoute(driver, MONEY_OPS_ROUTE);
        await home.returnToHome();
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
        await reachMarketAccount(driver, 'Teva Pharmaceutical');
        expect(await dashboard.isStopOverviewVisible()).toBe(true);
        ownPackage = await dashboard.getForegroundPackage();
        console.log(`[M-TC-038] own package = "${ownPackage}"`);
        expect(ownPackage).not.toBe('');
      });

      await test.step('M-TC-038: tapping Navigate opens the default maps app', async () => {
        await dashboard.tap('~Navigate');
        // Polled: the hand-off is an intent, so the foreground package changes
        // asynchronously and a single read catches the old one.
        await expect
          .poll(() => dashboard.getForegroundPackage(), { timeout: 30_000 })
          .not.toBe(ownPackage);
        const handler = await dashboard.getForegroundPackage();
        console.log(`[M-TC-038] foreground after Navigate = "${handler}"`);
        expect(handler.toLowerCase()).toContain('maps');
      });

      await test.step('Restore: bring the app back to the foreground', async () => {
        // Not optional housekeeping - without it every following test starts
        // inside Google Maps.
        await dashboard.returnToThisApp();
        await expect.poll(() => dashboard.getForegroundPackage(), { timeout: 30_000 }).toBe(ownPackage);
      });
    }
  );

  // ==== M-TC-037 (retake, delete, or skip optional photos) ====
  //
  // "Driver can retake, delete, or skip optional photos" -> "the new capture
  // should replace or remove the previous image as expected; When the photo
  // requirement is optional and the driver taps Skip photo; Then the driver
  // should proceed without capturing a photo".
  //
  // FEASIBLE ON MARKET, contrary to a first assumption that inherited Coffee's
  // C-TC-008/009 "Not Feasible" verdict. Coffee's camera traps BACK entirely
  // and exposes nothing; Market's does NOT - a single BACK escapes it, capture
  // works, and the post-capture REVIEW screen is fully labelled. Feasibility
  // verdicts do not transfer between LOBs.
  //
  // Note "Take photo" appears on BOTH the pre-capture sheet and the review
  // screen, where it means RETAKE - same label, different meaning by context.
  test(
    'M-TC-037: optional photos can be retaken, deleted, or skipped',
    { tag: ['@Market-M-TC-037'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const market = await reachMoneyOpsChecklist(driver);

      await test.step('The photo requirement is optional and offers both paths', async () => {
        await market.openBeforePhotos();
        const modal = await market.isPhotoModalVisible();
        console.log(`[M-TC-037] photo sheet = ${JSON.stringify(modal)}`);
        expect(modal.takePhoto).toBe(true);
        expect(modal.skipPhoto).toBe(true);
      });

      await test.step('M-TC-037: capturing offers retake and delete', async () => {
        await market.tap('//android.widget.Button[@content-desc="Take photo"]');
        await market.tapCameraShutter();
        const review = await market.isPhotoReviewVisible();
        console.log(`[M-TC-037] review screen = ${JSON.stringify(review)}`);
        expect(review.review).toBe(true);
        expect(review.retake).toBe(true);
        expect(review.delete).toBe(true);
      });

      await test.step('M-TC-037: deleting removes the captured image', async () => {
        await market.deleteCapturedPhoto();
        // Delete returns to the CAMERA (unlabelled, 12 nodes) rather than to
        // the checklist, so "the image was removed" is asserted by the review
        // screen no longer being present.
        await expect
          .poll(() => market.isPhotoReviewVisible().then((r) => r.review).catch(() => false), { timeout: 20_000 })
          .toBe(false);
        // One BACK escapes Market's camera - Coffee's needs a force-stop.
        await market.pressKeyCode(4);
      });

      await test.step('M-TC-037: Skip photo proceeds without capturing', async () => {
        await market.openBeforePhotos();
        await market.openSkipPhotoReasonSheet();
        await market.enterSkipPhotoReason("Camera can't focus and take clear picture");
        await market.waitForSkipPhotoSubmitEnabled(true);
        await market.confirmSkipPhoto();
        await expect
          .poll(
            () =>
              market
                .isChecklistIconChecked('//android.view.View[starts-with(@content-desc,"Before Photos")]')
                .catch(() => false),
            { timeout: 30_000 }
          )
          .toBe(true);
        console.log('[M-TC-037] Before Photos completed via Skip, no photo captured');
      });
    }
  );

  // ==== M-TC-041 (capture, label, attach, optional description) ====
  //
  // "Driver captures, labels, and attaches photos with optional description"
  // -> "the photo should be confirmed and saved against the selected label".
  //
  // The review screen carries a label picker and a description field, neither
  // of which has a content-desc - both are addressed positionally (the first
  // clickable View in the ScrollView, and the screen's only EditText).
  //
  // Runs on UNITED COLLECTION BUREAU, the route's other real Market stop -
  // NOT Teva. M-TC-037 above completes Teva's Before Photos via Skip, and two
  // tests competing for the same tile would make whichever ran second fail for
  // reasons having nothing to do with its own subject. Separating them by STOP
  // is the same collision-avoidance used for SD-TC-022/024 (by day) and
  // M-TC-017/018 (by bag code).
  test(
    'M-TC-041: a captured photo can be labelled, described and attached',
    { tag: ['@Market-M-TC-041'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const market = await reachMoneyOpsChecklist(driver, 'United Collection Bureau');
      let chosenLabel = '';

      await test.step('Capture a photo', async () => {
        await market.openBeforePhotos();
        await market.tap('//android.widget.Button[@content-desc="Take photo"]');
        await market.tapCameraShutter();
        expect((await market.isPhotoReviewVisible()).attach).toBe(true);
      });

      await test.step('M-TC-041: label and describe the capture', async () => {
        await market.tapPhotoLabelPicker();
        await driver.pause(2_000);
        const options = [
          ...(await driver.$$('//android.view.View[@clickable="true" and string-length(@content-desc)>2]'))
        ];
        const labels: string[] = [];
        for (const o of options) {
          labels.push((await o.getAttribute('content-desc')) ?? '');
        }
        console.log(`[M-TC-041] label options = ${JSON.stringify(labels.slice(0, 12))}`);
        expect(options.length).toBeGreaterThan(0);
        chosenLabel = labels[0] ?? '';
        await options[0].click();
        await driver.pause(1_000);
        await market.enterPhotoDescription('QA automated check');
      });

      await test.step('M-TC-041: attaching saves the photo against its label', async () => {
        // The case's expected result is "the photo should be confirmed and
        // saved against the selected label" - NOT that the Before Photos task
        // becomes complete. An earlier version asserted completion and failed:
        // attaching a photo does not tick the tile, which is a different claim
        // the case never makes.
        await market.tapAttachPhoto();
        // Leaving the review screen is what confirms the attach was accepted.
        await expect
          .poll(() => market.isPhotoReviewVisible().then((r) => r.review).catch(() => false), { timeout: 30_000 })
          .toBe(false);
        // Attaching returns to the CHECKLIST, where the Before Photos tile
        // flips from "Record pre-service condition" to "tap to view" - that
        // change IS the confirmation the photo was saved.
        await expect
          .poll(() => market.getVisibleScreenText().catch(() => ''), { timeout: 30_000 })
          .toContain('tap to view');
        console.log(`[M-TC-041] photo saved; tile now reads "tap to view"`);
      });

      // NOT ASSERTED: reading the stored label back off the saved photo.
      //
      // The checklist tile invites "tap to view", but openBeforePhotos() lands
      // on the ADD sheet ("Add supporting photo" / Take photo / Skip photo /
      // Dismiss) rather than on any photo viewer - live-verified, so the
      // stored label cannot be read back through the path this suite knows.
      // Whether a separate viewer exists is unmapped.
      //
      // What IS proven above: the label picker offers real options, one is
      // selected, a description is entered, Attach is accepted, and the tile
      // flips to "tap to view" - i.e. the photo is confirmed and saved, having
      // been labelled. Only the read-back of the label is outstanding, and
      // saying so is better than asserting a weaker thing and calling the case
      // fully covered.
    }
  );

  // ==== M-TC-040 (keypad arrows move only between editable fields) ====
  //
  // "Keypad arrows move only between editable product quantity fields" ->
  // "focus should move to the next editable quantity field; And focus should
  // not move to read-only ordered quantity or unrelated screen buttons".
  // The sheet marks it Fail with an EXISTING PBI: "Keypad arrows not moving to
  // next editable field in one click, requires two click."
  //
  // SCREEN MATTERS. TC102 already asserts the Down arrow moving focus in ONE
  // tap - and it PASSES - but it runs on Removals & Returns, where the defect
  // does not reproduce. It reproduces on PRODUCT FILLS, where each product row
  // carries an editable Delivery field. Written against the wrong screen this
  // case would go green while the documented defect stayed unexercised.
  //
  // Live-captured on Teva (2 products, 2 editable Delivery fields):
  //   focus after click   = "Delivery"   <- first field
  //   focus after DOWN x1 = null         <- a NON-editable element
  //   focus after DOWN x2 = "Delivery"   <- the next field, second tap
  //
  // Split as C-TC-005 is, so test.fail() cannot mask a broken setup.
  test(
    'M-TC-040: Fills offers multiple editable quantity fields reachable by keypad arrow',
    { tag: ['@Market-M-TC-040'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const market = await reachMoneyOpsChecklist(driver);

      await test.step('Product fills has at least two editable quantity fields', async () => {
        await market.openFills();
        const fields = [...(await driver.$$('//android.widget.EditText'))];
        console.log(`[M-TC-040] editable quantity fields = ${fields.length}`);
        expect(fields.length).toBeGreaterThan(1);
        await fields[0].click();
        expect(await market.isNumericKeypadVisible()).toBe(true);
        expect(await market.getFocusedFieldHint()).toBe('Delivery');
      });

      await test.step('M-TC-040: the next editable field IS reachable - in two taps', async () => {
        // Documents the ACTUAL behaviour so the gap below is evidenced rather
        // than asserted blind. The first tap parks focus on something with no
        // hint at all - not an editable quantity field.
        await market.tapKeypadDownArrow();
        const afterOne = await market.getFocusedFieldHint();
        console.log(`[M-TC-040] focus after one Down = ${JSON.stringify(afterOne)}`);
        await market.tapKeypadDownArrow();
        const afterTwo = await market.getFocusedFieldHint();
        console.log(`[M-TC-040] focus after two Downs = ${JSON.stringify(afterTwo)}`);
        expect(afterTwo).toBe('Delivery');
      });

      await test.step('Leave without saving', async () => {
        await market.dismissNumericKeypadIfPresent();
        await market.pressKeyCode(4);
      });
    }
  );

  // The FAILING half - the documented PBI.
  //
  // Intended: ONE Down tap moves focus from one editable quantity field to the
  // NEXT editable quantity field. Actual: the first tap lands on an element
  // with no hint - i.e. not an editable field - and a second tap is needed.
  // That breaks BOTH of the case's clauses at once: focus does not reach the
  // next editable field in one move, and it DOES move somewhere that is not an
  // editable quantity field.
  test(
    'M-TC-040 (gap): one Down-arrow tap does not reach the next editable quantity field',
    { tag: ['@Market-M-TC-040', '@known-pbi'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      test.fail();
      const market = await reachMoneyOpsChecklist(driver);
      try {
        await market.openFills();
        const fields = [...(await driver.$$('//android.widget.EditText'))];
        expect(fields.length).toBeGreaterThan(1);
        await fields[0].click();
        expect(await market.getFocusedFieldHint()).toBe('Delivery');
        await market.tapKeypadDownArrow();
        // The assertion the case makes, which the build does not satisfy.
        expect(await market.getFocusedFieldHint()).toBe('Delivery');
      } finally {
        await market.dismissNumericKeypadIfPresent().catch(() => {});
        await market.pressKeyCode(4).catch(() => {});
      }
    }
  );

  // ==== M-TC-035 (Complete/Skip Stop need explicit state handling) ====
  //
  // "Complete Stop and Skip Stop require explicit state handling" -> "Service
  // will not be marked as complete until every mandatory service is completed;
  // And Skip Stop should require explicit confirmation; And the user should
  // re-enter and complete a previously skipped station without corrupting stop
  // state." Sheet: Result = Fail, remark "Need to create PBI".
  //
  // THREE CLAUSES, split across three places rather than one mega-test:
  //  - "requires explicit confirmation"  -> carried by M-TC-023 (tagged there).
  //  - "not complete until every mandatory service is done" -> the test below.
  //  - "without corrupting stop state"   -> the test.fail() below that, which
  //    is the actual defect.
  test(
    'M-TC-035: a stop cannot be completed until every mandatory service is done',
    { tag: ['@Market-M-TC-035'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const market = await reachMoneyOpsChecklist(driver, 'United Collection Bureau');

      await test.step('M-TC-035: Complete Delivery is gated while mandatory tasks are outstanding', async () => {
        // FOUR tasks gate it - Before Photos, Delivery, Audit and Money
        // Operations (established by M-TC-036). Any one outstanding must keep
        // the stop incompletable, which is exactly what this clause asserts.
        const tasks = await market.getMarketChecklistTasks();
        console.log(`[M-TC-035] tasks present = ${JSON.stringify(tasks)}`);
        const complete = await market.isCompleteDeliveryEnabled();
        const allDone = await market.isChecklistIconChecked(
          '//android.view.View[starts-with(@content-desc,"Delivery")]'
        );
        console.log(`[M-TC-035] Delivery done = ${allDone}; Complete Delivery enabled = ${complete}`);
        if (!allDone) {
          expect(complete).toBe(false);
        }
      });
    }
  );

  // The FAILING clause - the documented corruption, and the reason a PBI is
  // still owed.
  //
  // Asserts a SCHEDULE INVARIANT rather than a screen detail: the header's
  // delivery count must equal pending + completed. The sheet's own remark is
  // that this breaks after a skip-then-complete ("showing Deliveries as 3, but
  // only 1 Pending & 1 Completed").
  //
  // WHY THIS IS AUTOMATED AT ALL NOW: it was excluded earlier because the
  // corruption was permanent and would poison Miami 001 for every other Market
  // test. Anthony's route-setup reset (same operation + route re-selected
  // clears the local DB and re-pulls orders) makes it RECOVERABLE, so the
  // objection no longer holds.
  //
  // !! LEAVES THE ROUTE CORRUPTED. Run the route-setup reset afterwards:
  // hamburger -> Settings -> Route setup -> Change route -> same operation ->
  // same route -> confirm -> Select Day -> Confirm (~2 min).
  //
  // Narrowing already established by M-TC-032: SKIPPING ALONE does not
  // corrupt - counts stayed consistent after a skip. The damage belongs to the
  // COMPLETE-after-skip step, which is what this exercises.
  test(
    'M-TC-035 (gap): completing a previously skipped station corrupts the schedule counts',
    { tag: ['@Market-M-TC-035', '@corrupts-route'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      test.fail();
      const home = new HomeScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const prepTasks = new PrepTasksScreen(driver);
      const market = new MarketServiceScreen(driver);

      await test.step('Log in and complete Start Day', async () => {
        await loginAndEnsureRoute(driver, MONEY_OPS_ROUTE);
        await home.returnToHome();
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('Skip a station, then re-enter and complete it', async () => {
        await reachMarketAccount(driver, 'United Collection Bureau');
        if ((await dashboard.getServiceStationProgress('market')) !== 100) {
          await dashboard.openSkipStopSheet('market', 'first');
          await dashboard.selectSkipReason('Driver Skipped');
          await dashboard.selectSkipDisposition('leaveOnTruck');
          await dashboard.tapSkipStop();
          await driver.pause(4_000);
        }
        await home.returnToHome();
        await reachMarketAccount(driver, 'United Collection Bureau');
        await dashboard.openFirstServiceStation('market');
        await ensureAuditPrerequisites(market);
        const auditDone = await market.isChecklistIconChecked(
          '//android.view.View[starts-with(@content-desc,"Market Physical") or starts-with(@content-desc,"Audit")]'
        );
        if (!auditDone) {
          await market.tapAuditTile();
          if (await market.isCountTypeModalVisible()) {
            await market.selectCountType('cycle');
          }
          await market.searchAndSelectAuditProduct('Balance C', 'Balance CkieDough1.76oz - pkg: 1', 'Balance CkieDough1.76oz');
          await market.tap('~Continue');
        }
        await market.skipMoneyOperations();
        if (await market.isCompleteDeliveryEnabled()) {
          await market.tap('~Complete Delivery');
        }
      });

      await test.step('M-TC-035: the schedule counts should still add up', async () => {
        await home.returnToHome();
        const total = await home.getDeliveriesCount();
        const pending = await dashboard.getPendingActionCount();
        const completed = await dashboard.getCompletedCount();
        console.log(`[M-TC-035] deliveries=${total} pending=${pending} completed=${completed}`);
        // The invariant. The sheet records it breaking here.
        expect(pending + completed).toBe(total);
      });
    }
  );

  // ==== SEARCH AND SCAN (M-TC-028, M-TC-033, M-TC-034) ====
  //
  // All three pair "search AND scan". The SCAN half is OUT OF SCOPE for the
  // same reason as M-TC-020: no live scanner on this emulator. The SEARCH half
  // is fully testable and is what these assert - stated here so the coverage
  // is not read as more than it is.
  //
  // M-TC-028: "Search and scan return expected product across key modules
  // [Fills - Add Product]" -> "matching results should be displayed with
  // selected item details on the parent screen".
  test(
    'M-TC-028: Add Product search returns matches and carries the selection to the parent screen',
    { tag: ['@Market-M-TC-028'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const market = await reachMoneyOpsChecklist(driver);
      let firstResult = '';

      await test.step('Search on the Add Product screen', async () => {
        await market.openAddProductFromFills();
        expect(await market.isAddProductScreenVisible()).toBe(true);
        await market.searchProduct('Balance');
        firstResult = await market.getFirstSearchResultContentDesc();
        console.log(`[M-TC-028] first result = ${JSON.stringify(firstResult)}`);
        expect(firstResult).not.toBe('');
      });

      await test.step('M-TC-028: selecting carries the item details to the parent screen', async () => {
        // The row's content-desc is "{Name} ({size}) - pkg: {N}\nSKU: {sku}".
        // The label PREFIX is everything before the newline; deriving it from
        // the live row rather than hardcoding a product, because seed data for
        // a given term has already changed once in this suite's lifetime.
        const prefix = firstResult.split('\n')[0] ?? '';
        await market.selectSearchResult(prefix);
        const summary = await market.getAddProductSummary();
        console.log(`[M-TC-028] parent screen summary = ${JSON.stringify(summary)}`);
        // "selected item details on the parent screen" - the Qty field's hint
        // packs the chosen product's name, SKU and pkg.
        expect(summary.name).not.toBe('');
        expect(prefix).toContain(summary.name.split(' (')[0].trim().slice(0, 8));
      });

      await test.step('Leave without adding', async () => {
        await market.cancelAddProduct().catch(() => {});
        await market.pressKeyCode(4).catch(() => {});
      });
    }
  );

  // M-TC-034: the same claim on Removals & Returns.
  test(
    'M-TC-034: Removals & Returns search returns matches and opens the selected product',
    { tag: ['@Market-M-TC-034'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const market = await reachMoneyOpsChecklist(driver);

      await test.step('M-TC-034: search, select, and land on the product', async () => {
        // openRemovalsAndReturnsForProduct searches AND selects, then waits for
        // the Document product screen - reaching it IS the "selected item
        // details on the parent screen" outcome.
        await market.openRemovalsAndReturnsForProduct('Balance');
        const shown = await market.getVisibleScreenText();
        console.log(`[M-TC-034] document product screen: ${shown.slice(0, 220)}`);
        expect(shown).not.toBe('');
      });

      await test.step('Leave without documenting anything', async () => {
        await market.cancelDocumentProduct().catch(() => {});
        await market.pressKeyCode(4).catch(() => {});
      });
    }
  );

  // M-TC-033: "Search with no match or invalid scan does not select wrong
  // product [Removals & Returns]" -> "the app should return no matching result
  // or a clear no-match state; And no incorrect product should be selected or
  // populated on the parent screen".
  //
  // This one matters more than it looks. This suite has ALREADY been bitten by
  // selectors that match loosely and tap the first hit - asking for "Canteen
  // Granulated Sugar Canister" once added "A&W Zero Sugar Root Beer" on the
  // Coffee side. A search that silently selects the wrong product is exactly
  // that failure mode, and this is the case that would catch it.
  test(
    'M-TC-033: a no-match search selects nothing on Removals & Returns',
    { tag: ['@Market-M-TC-033'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const market = await reachMoneyOpsChecklist(driver);

      await test.step('Search a term that cannot match', async () => {
        await market.openRemovalsAndReturns();
        await market.searchRemovalsProduct('ZZQXNOMATCH');
        await driver.pause(2_000);
      });

      await test.step('M-TC-033: no result is offered and nothing is selected', async () => {
        const shown = await market.getVisibleScreenText();
        console.log(`[M-TC-033] screen after no-match search: ${shown.slice(0, 240)}`);
        // Nothing was selected: the Document product screen - which is where a
        // selection lands - must NOT have opened.
        expect(await market.isDocumentProductVisible()).toBe(false);
      });

      await test.step('Leave', async () => {
        await market.pressKeyCode(4).catch(() => {});
      });
    }
  );
});
