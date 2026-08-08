import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndEnsureRoute } from '../../utils/login-flow';
import { PrepTasksScreen } from '../../screens/prep-tasks.screen';
import { DashboardScreen } from '../../screens/dashboard.screen';
import { HomeScreen } from '../../screens/home.screen';
import { EndDayScreen } from '../../screens/end-day.screen';
import { mobileConfig } from '../../config/mobile.config';
import type { Position } from '../../utils/position';
import type { Lob } from '../../utils/lob';

// Excel TC002/TC003/TC004 (Menu area, "End Day" sub-area) - live-verified
// 2026-08-05 (build 0.1.76, Route 10/Miami/TODAY): the Unused Kits/Money Bag
// Review screens are only reachable once EVERY scheduled stop for the day
// is either fully serviced or SKIPPED - the same "do the service or a No
// Service" gate TC001 describes. Skipping is the fast, genuinely-intended
// path here (see EndDayScreen's own top note): swiping a service station
// row left reveals a skip icon, opening a "Skip stop" sheet whose Reason
// field already defaults to "Serviced Using Client App" with "Return to
// warehouse" pre-selected - no input needed, just confirm.
//
// CORRECTED (live-verified 2026-08-07): this used to switch between
// TODAY/TOMORROW (or even YESTERDAY) chasing a day with unactioned Market
// stops - abandoned after finding that switching days mid-test (via
// returnToHome()'s hardware-BACK fallback, hit whenever a screen has no
// hamburger icon yet) can silently revert the app back to TODAY, corrupting
// which day's stops actually got skipped. Stays on TODAY unconditionally
// instead.
//
// The actual thumb rule (per direct guidance, not assumed): Coffee stops
// should be COMPLETED, never skipped - this test doesn't touch Coffee at
// all, leaving any pending one for End Day's own gate-resolution loop
// below (resolveWithNoService), the same generic mechanism already
// handling non-Market/Coffee/Vending blockers (e.g. Warehouse stops). For
// Market, the rule is simply: zero PENDING Market stops left, with at
// least one having been skipped at some point - if today's Market stops
// are already all actioned from an earlier run (real, expected once this
// test - or others - have run today), that rule is already satisfied and
// this test does nothing further for Market either. No new delivery is
// ever bootstrapped - forcing fresh data when the end state already holds
// would be solving a problem that doesn't exist.
//
// NOT independently asserted (documented instead):
// - TC002's expected default radio state ("Keep on truck" selected by
//   default) - live-verified FALSE: "Return to warehouse" is what's
//   pre-selected (inherited from the Skip-stop sheet's own default). Also,
//   like every other radio-style control in this app, `checked`/`selected`
//   stay "false" in the accessibility tree regardless of the real visual
//   selection - not assertable either way, same class of gap already
//   raised to dev for Sort/Filter-adjacent controls elsewhere in this
//   suite.
test.describe('Menu - End Day', () => {
  // Same reasoning as the rest of this suite: this test ends on Money Bag
  // Review, not Dashboard - return to Dashboard afterward so no other spec
  // inherits a stale screen from this one under KEEP_APP_SESSION.
  test.afterEach(async ({ driver }) => {
    await new HomeScreen(driver).returnToHome().catch(() => {});
  });

  test(
    'TC002/TC003/TC004: skipping every Market stop unlocks Unused Kits and Money Bag Review',
    { tag: ['@Menu-TC002', '@Menu-TC003', '@Menu-TC004'] },
    async ({ driver }, testInfo) => {
      testInfo.setTimeout(240_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const home = new HomeScreen(driver);
      const endDay = new EndDayScreen(driver);

      await test.step('Log in to Route 10/TODAY', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.defaultRoute, day: 'TODAY' });
      });

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });

      await test.step('Return to Dashboard - the app deliberately restores its last-visited screen (e.g. a stale location-detail screen from an earlier KEEP_APP_SESSION run), and merely backgrounding/foregrounding it does NOT reset this. Uses HomeScreen.returnToHome(), which presses BACK only until any screen with the hamburger menu appears, then uses the "Schedule overview" nav item to deterministically reach Dashboard - live-verified elsewhere in this suite that plain BACK from a stop-detail screen exits straight to the OS launcher with no Dashboard stop in between, so a raw back-press loop cannot get here on its own.', async () => {
        let reachedDashboard = await dashboard
          .getLocationCount()
          .then(() => true)
          .catch(() => false);
        if (!reachedDashboard) {
          await home.returnToHome();
          reachedDashboard = await dashboard
            .getLocationCount()
            .then(() => true)
            .catch(() => false);
        }
        expect(reachedDashboard).toBe(true);
      });

      // Unused Kits/Money Bag Review are populated from SKIPPED stations,
      // not fully-serviced ones - live-verified 2026-08-05: fully servicing
      // a stop (Before Photos -> Delivery -> Audit -> After Photos ->
      // Complete Stop) closes it out fine, but End Day then shows only a
      // generic "no reports available" Reports screen, never Unused Kits.
      // Skip stop (swipeAndSkipServiceStation, opening a "Skip stop" sheet
      // whose Reason defaults to "Serviced Using Client App") is the
      // genuinely intended path to those screens.
      //
      // Thumb rule (live-verified 2026-08-05, FedEx/Breakroom stop): a
      // single LOB card can have MORE THAN ONE service station (e.g.
      // Market's "Breakroom" + "Homestead Warehouse" under the same FedEx
      // stop) - EVERY station must be skipped (or serviced), not just the
      // first, before Complete Stop enables. Checking isCompleteStopVisible
      // alone can't tell "still disabled" from "ready" - a tap on the
      // disabled button silently no-ops, which is exactly what let an
      // unactioned second station slip through undetected before.
      //
      // Generalized by LOB (not hardcoded to 'market') - CORRECTED
      // (live-verified 2026-08-07): a pending stop can be Coffee-only (e.g.
      // "White & Case LLP") with no Market card at all - calling
      // isNthServiceStationVisible('market', ...) on one of those THROWS
      // (not just returns false), since it calls clickLob('market')
      // internally with nothing to expand. Checks isLobCardVisible first
      // (the real non-throwing presence check) and leaves stops without
      // the target LOB untouched.
      const skipAndCompleteStopIfLob = async (lob: Lob, position: Position): Promise<boolean> => {
        await dashboard.clickLocationByPosition(position);
        if (!(await dashboard.isLobCardVisible(lob))) {
          await home.returnToHome();
          return false;
        }
        for (const stationPosition of ['first', 'second'] as const) {
          if (!(await dashboard.isNthServiceStationVisible(lob, stationPosition))) {
            continue;
          }
          try {
            await dashboard.swipeAndSkipServiceStation(lob, stationPosition);
          } catch {
            continue; // already actioned (completed or previously skipped) - move on
          }
          if (await endDay.isSkipStopSheetVisible()) {
            await endDay.confirmSkipStop();
          }
        }

        expect(await dashboard.isCompleteStopEnabled()).toBe(true);
        await dashboard.tapCompleteStop();

        // Complete Stop marks the stop done IN PLACE - it does not navigate
        // back to the Dashboard's Pending action list (live-verified: the
        // very same stop-overview screen remains, just with a green
        // checkmark now). Use returnToHome() to reach Dashboard for the
        // next stop.
        await home.returnToHome();
        return true;
      };

      // Scans every pending position (up to 'fourth' - this suite never
      // sees more than 4 stops/day) rather than assuming 'first' always
      // holds a stop of the target LOB - a completed stop drops off the
      // list and shifts later ones down, but an untouched stop of a
      // DIFFERENT LOB does NOT, so it can occupy 'first' indefinitely
      // while real target-LOB stops sit behind it.
      const skipAllStopsForLob = async (lob: Lob): Promise<void> => {
        const positions: Position[] = ['first', 'second', 'third', 'fourth'];
        let sawAny = true;
        while (sawAny) {
          sawAny = false;
          for (const position of positions) {
            const stopCount = await dashboard.getLocationCount();
            if (positions.indexOf(position) >= stopCount) break;
            if (await skipAndCompleteStopIfLob(lob, position)) {
              sawAny = true;
              break; // list just shifted - rescan from 'first'
            }
          }
        }
      };

      // Per direct guidance: Coffee stops are intentionally NOT touched
      // here - they should be COMPLETED, never skipped, and this test has
      // no "complete a Coffee stop properly" flow to run (that's the
      // full Before Photos/Delivery/Audit/After Photos checklist, out of
      // scope for this test). Any pending Coffee stop is left for End
      // Day's own gate-resolution loop below. Market only needs whatever
      // is CURRENTLY pending skipped - if nothing is pending (already
      // fully actioned by an earlier run today), there's nothing to do
      // here at all, and that's fine: the rule ("zero pending Market,
      // at least one skipped ever") is already satisfied.
      await test.step("Skip every currently-pending Market station (no-op if none are pending)", async () => {
        await skipAllStopsForLob('market');
      });

      let unusedKitsCount = 0;
      await test.step('Open End Day and verify the Unused Kits screen (TC002)', async () => {
        await endDay.openFromHamburgerMenu();
        // TC001's gate isn't scoped to Market/Coffee/Vending stops only - a
        // Warehouse stop (never listed in Dashboard's own Pending action
        // list) can also block End Day. Resolve any such stop with No
        // Service, re-opening End Day each time, until Unused Kits appears.
        for (let attempt = 0; attempt < 5 && (await endDay.isFinishServiceGateVisible()); attempt++) {
          await endDay.resolveWithNoService();
          await endDay.openFromHamburgerMenu();
        }
        expect(await endDay.isUnusedKitsScreenVisible()).toBe(true);
        unusedKitsCount = await endDay.getUnusedKitsCount();
        expect(unusedKitsCount).toBeGreaterThan(0);
      });

      await test.step('TC003: Continue from Unused Kits reaches Money Bag Review', async () => {
        await endDay.tapContinue();
        expect(await endDay.isMoneyBagReviewVisible(unusedKitsCount)).toBe(true);
      });

      await test.step('TC004: Money Bag Review shows Total Bags (0, since every stop was skipped) and Deliveries without bags matching the Unused Kits count', async () => {
        expect(await endDay.isTotalBagsVisible(0)).toBe(true);
        expect(await endDay.isDeliveriesWithoutBagsVisible(unusedKitsCount)).toBe(true);
      });
    }
  );
});
