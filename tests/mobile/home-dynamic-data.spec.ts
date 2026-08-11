import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndEnsureRoute } from '../../utils/login-flow';
import { HomeScreen } from '../../screens/home.screen';
import { DashboardScreen } from '../../screens/dashboard.screen';
import { mobileConfig } from '../../config/mobile.config';

// PBI 622025 (Azure DevOps): "Home Page: Dynamic data with functionality" -
// 1) System date populates on the navigation bar.
// 2) Deliveries count, along with Coffee/Vending/Market, are dynamic.
// 3) Edit schedule works as expected.
// 4) All navigation works as expected.
//
// Live-verified against build 0.1.76 (Miami, FL / Route 010) before writing
// anything here.
//
// TC-ID traceability: cross-referenced against Optimized_TCs_V_2.0.xlsx by
// (TC#, Area="Start of The Day") pair. Only TC013 itself is mapped to PBI
// 622025 in the Excel - the other TCs below (date/route badge/LOB
// counts/schedule cards/Edit schedule) sit under DIFFERENT PBI IDs
// (729648, 611763/630328) despite reading like the same "dynamic Home
// screen" feature the user described. Not asserting those are wrong (unlike
// the earlier PBI 619783/735739 case, I don't have those other PBIs' ACs to
// compare against) - each is tagged to its own Excel-documented PBI, not
// folded into 622025.
test.describe('Home / Dashboard - dynamic data (PBI 622025)', () => {
  // Same reasoning as the rest of this suite: every test here leaves the
  // app wherever the last step landed under KEEP_APP_SESSION - return to
  // Dashboard after each so no test inherits a stale screen from whichever
  // ran before it.
  test.afterEach(async ({ driver }) => {
    await new HomeScreen(driver).returnToHome().catch(() => {});
  });

  test(
    'view the system date, route badge, and dynamic Deliveries/LOB counts',
    {
      tag: [
        '@StartOfDay-TC006',
        '@StartOfDay-TC007',
        '@StartOfDay-TC012',
        '@StartOfDay-TC013',
        '@StartOfDay-TC014',
        '@StartOfDay-TC015',
        '@StartOfDay-TC016',
        '@StartOfDay-TC017',
        '@StartOfDay-TC021',
        '@StartOfDay-TC022'
      ]
    },
    async ({ driver }) => {
      const home = new HomeScreen(driver);
      const dashboard = new DashboardScreen(driver);

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      // TC007 "view the System Date" - the badge shows one of
      // Today/Yesterday/Tomorrow followed by the actual date (e.g.
      // "Yesterday, Thu 23 Jul") - live-verified this updates to match
      // whichever day is currently selected (config/mobile.config.ts's
      // defaultRoute.day).
      await test.step('TC007: verify the system date is populated on the navigation bar', async () => {
        const dateText = await home.getCurrentDateText();
        expect(dateText.length).toBeGreaterThan(0);
      });

      // TC012 "view route badge" - e.g. "Route 10" (displayed form of
      // Route 010, per the account's naming quirk documented elsewhere).
      await test.step('TC012: verify the route badge is visible', async () => {
        const routeText = await home.getRouteBadgeText();
        expect(routeText.length).toBeGreaterThan(0);
      });

      // TC013 "view Deliveries" / TC014 "view remaining deliveries" (PBI
      // 622025's own TC) - live-verified this is a real cumulative count
      // (e.g. "4 Deliveries"), not a hardcoded label.
      await test.step('TC013/TC014: verify the Deliveries count is a real number', async () => {
        const count = await home.getDeliveriesCount();
        expect(Number.isNaN(count)).toBe(false);
        expect(count).toBeGreaterThanOrEqual(0);
      });

      // TC015/TC016 "view Vending counter" (near-duplicate rows in the
      // Excel - Home vs Home-Vending sub-areas, same assertion) / TC017
      // "view Coffee counter" - same dynamic pattern applies to
      // Market/Coffee/Vending alike. Live-verified on Miami/010: only LOBs
      // with scheduled stops render a card at all (Market "0/3", Coffee
      // "0/1" - no Vending card, since this route has zero Vending stops
      // today). So this asserts the counts that ARE present are
      // well-formed ("X/Y"), not that all three LOBs always appear.
      await test.step('TC015/TC016/TC017: verify each rendered LOB count is well-formed (X/Y)', async () => {
        const counts = await home.getLobCounts();
        const renderedLobs = Object.keys(counts);
        expect(renderedLobs.length).toBeGreaterThan(0);
        for (const lob of renderedLobs) {
          expect(counts[lob as keyof typeof counts]).toMatch(/^\d+\/\d+$/);
        }
      });

      // TC006 "click on the Hamburger menu" - live-verified 2026-08-10: the
      // icon itself is hidden once the drawer is open (its own visibility
      // isn't a usable "did it open" signal), so this checks for the
      // drawer's own "Schedule overview" item instead, then closes back
      // out via hardware back (re-tapping the hamburger icon isn't
      // possible while it's hidden behind the drawer).
      await test.step('TC006: hamburger menu opens the nav drawer', async () => {
        await home.openHamburgerMenu();
        expect(await home.isNavigationMenuVisible()).toBe(true);
        await home.closeHamburgerMenu();
      });

      // TC021 "view Pending action tab" / TC022 "view Actioned tab" - this
      // build labels the second tab "Completed", not "Actioned" (an
      // app-terminology mismatch, not a missing feature - see
      // DashboardScreen.isCompletedTabVisible's own doc comment). Both tab
      // pills are present on Home regardless of which is currently
      // selected.
      await test.step('TC021/TC022: both Pending action and Completed tabs are visible', async () => {
        expect(await dashboard.isPendingActionTabVisible()).toBe(true);
        expect(await dashboard.isCompletedTabVisible()).toBe(true);
      });
    }
  );

  test(
    'open Edit schedule and verify it lists every stop',
    { tag: ['@StartOfDay-TC018', '@StartOfDay-TC020', '@StartOfDay-TC036', '@StartOfDay-TC037'] },
    async ({ driver }) => {
      const home = new HomeScreen(driver);

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      // TC018 "view Schedule" / TC020 "navigate to Edit schedule order
      // screen" / TC036 "view Edit schedule order screen... with icon and
      // list of stops with names and addresses".
      await test.step('TC018/TC020/TC036: open Edit schedule and verify it lists every stop', async () => {
        await home.openEditSchedule();
        expect(await home.isEditScheduleVisible()).toBe(true);
        const stopNames = await home.getEditScheduleStopNames();
        expect(stopNames.length).toBeGreaterThan(0);
      });

      // TC037 "verify drag handle visibility" - live-confirmed 2026-08-10:
      // each row's drag handle has NO accessible node of its own anywhere
      // in the tree (baked into the row's bitmap, same class of gap as
      // Prep Tasks' checklist checkboxes) - detected via pixel scanning
      // instead (see BaseScreen.hasNonWhiteIconNearRightEdge).
      await test.step('TC037: a drag handle icon is visible for every stop', async () => {
        expect(await home.areDragHandlesVisibleForAllStops()).toBe(true);
      });

      // TC038 "reorder stops" - NOT automated. Live-attempted 2026-08-10
      // with three different gesture strategies (raw W3C pointer actions
      // with a long-press hold before moving, incremental multi-step
      // moves, and Appium's dedicated `mobile: dragGesture` command) -
      // none triggered a reorder; the stop order stayed unchanged every
      // time. Drag-and-drop reordering on Flutter ReorderableListView-
      // style widgets is a known hard case for synthetic touch timing.
      // Needs further investigation (or a different automation strategy
      // entirely) before this can be automated - not a "TC doesn't match
      // app behavior" case like TC031-034, the feature visibly exists
      // (see the screenshot evidence for TC037), just not yet
      // successfully driven.
    }
  );
});
