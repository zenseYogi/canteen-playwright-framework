import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndEnsureRoute } from '../../utils/login-flow';
import { PrepTasksScreen } from '../../screens/prep-tasks.screen';
import { DashboardScreen } from '../../screens/dashboard.screen';
import { HomeScreen } from '../../screens/home.screen';
import { EndDayScreen } from '../../screens/end-day.screen';
import { TransfersScreen } from '../../screens/transfers.screen';
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

// ===========================================================================
// Regression suite "End Day" (ED-TC-*), build 0.1.90
// ===========================================================================
//
// SEPARATE from the "Menu - End Day" describe above, which is tagged to the
// OLD Excel Menu numbering (@Menu-TC002/003/004) and runs on Miami 010. These
// are the regression sheet's own ED-TC rows, and they run on the COFFEE route
// (Charlotte 103) because that is what the three cases below are ABOUT.
//
// FLOW AS IT ACTUALLY IS, live-mapped 2026-08-28 on Charlotte 103:
//
//     Unused kits (0)  ->  Reports ("No reports are available.")  ->  Done
//
// Two things there contradict the older notes in this file, and both matter:
//
//   * MONEY BAG REVIEW DOES NOT APPEAR. The notes above assume it always sits
//     between Unused Kits and Reports. It is populated from SKIPPED stops
//     carrying money bags, and a Coffee route has neither - so ED-TC-010/011/
//     012 are not reachable here at all and belong on the Market route.
//
//   * END DAY IS NOT BLOCKED by pending COFFEE stops. With two stops still
//     pending it opened straight to Unused Kits, with no "End Day is Disabled"
//     gate. That is not a defect - it is precisely what ED-TC-009 asserts -
//     but it does mean ED-TC-001/002/003 (the blocking gate) cannot be
//     exercised on a Coffee route and need pending MARKET stops.
//
// NOTHING HERE TAPS "Done". Done uploads the reports, raises the End Day
// Successful popup (ED-TC-014) and completes the day (ED-TC-015) - which ends
// the route day for every other test on the route. Reaching Done and asserting
// it is offered is the non-terminal way to prove the flow completed.
test.describe('End Day - regression suite (ED-TC-xxx)', () => {
  test.afterEach(async ({ driver }) => {
    await new HomeScreen(driver).returnToHome().catch(() => {});
  });

  // ==== ED-TC-009 (End Day proceeds with Coffee stops unserviced) ====
  //
  // "Driver completes End Day on mixed LOB without servicing all Coffee stops"
  // -> "End Day should complete without forcing the driver to service the
  // Coffee stops".
  //
  // SCOPED to the "without forcing" half. The clause "End Day should complete"
  // is ED-TC-015's own subject and is terminal, so this asserts the flow runs
  // unobstructed all the way to its last step (Reports, offering Done) while
  // Coffee stops remain pending - and stops there.
  //
  // The pending-Coffee precondition is asserted, not assumed: if the route
  // happened to have no pending stops the test would pass trivially while
  // proving nothing about "without forcing".
  test(
    'ED-TC-009: End Day runs to its final step while Coffee stops are still pending',
    { tag: ['@EndDay-ED-TC-009'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const home = new HomeScreen(driver);
      const endDay = new EndDayScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      let pending = 0;
      await test.step('Precondition: at least one Coffee stop is still unserviced', async () => {
        pending = await dashboard.getPendingActionCount();
        console.log(`[ED-TC-009] pending stops = ${pending}`);
        expect(
          pending,
          'ED-TC-009 needs an UNSERVICED Coffee stop - with none pending it would pass trivially'
        ).toBeGreaterThan(0);
      });

      await test.step('ED-TC-009: End Day opens without a blocking gate', async () => {
        await endDay.openFromHamburgerMenu();
        // The gate the sheet describes for ED-TC-001/002. On a Coffee route it
        // must NOT appear, which is this case's whole point.
        expect(await endDay.isFinishServiceGateVisible()).toBe(false);
        expect(await endDay.isUnusedKitsScreenVisible()).toBe(true);
      });

      await test.step('ED-TC-009: the flow reaches its final step with Coffee still pending', async () => {
        await endDay.tapContinue();
        await expect.poll(() => endDay.isReportsScreenVisible(), { timeout: 30_000 }).toBe(true);
        // Offered, deliberately not tapped - see this block's header.
        expect(await endDay.isDoneVisible()).toBe(true);
        expect(await endDay.isDoneEnabled()).toBe(true);
        console.log('[ED-TC-009] reached Reports with Done enabled; not tapped');
      });

      await test.step('The Coffee stops really were left unserviced', async () => {
        // Closes the loop: the flow got to the end AND the stops are still
        // pending, so nothing quietly serviced them on the way through.
        await home.returnToHome();
        expect(await dashboard.getPendingActionCount()).toBe(pending);
      });
    }
  );

  // ==== ED-TC-006 / ED-TC-007 (Unused Kits should not appear) ====
  //
  //   ED-TC-006 "Unused Kits appears only when a stop was skipped" -> shown
  //             when a stop was skipped; "When no stop was skipped; Then the
  //             Unused Kits step should not appear"
  //   ED-TC-007 "Unused Kits step is not shown for Coffee during End Day" ->
  //             "the Unused Kits screen should not be shown"
  //
  // On a Coffee route with nothing skipped, both say the same thing: Unused
  // Kits should not appear. It DOES appear, carrying a count of 0. Shown-but-
  // empty is not "not shown", so both are recorded as gaps.
  //
  // ED-TC-006's POSITIVE half (skipped stop -> shown) is not covered here:
  // Coffee has no Skip Stop at all, which is ED-TC-008's subject. It belongs
  // with the Market cases, where skipping is what populates the screen.
  //
  // Split passing/failing per this suite's convention - a lone test.fail()
  // cannot tell "the gap is still there" from "the setup broke", and the setup
  // here (reaching End Day at all) is exactly what has been shifting.
  test(
    'ED-TC-006/007: on a Coffee route with nothing skipped, Unused Kits is shown with a count of zero',
    { tag: ['@EndDay-ED-TC-006', '@EndDay-ED-TC-007'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const home = new HomeScreen(driver);
      const endDay = new EndDayScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('ED-TC-006/007: the Unused Kits step appears, and is empty', async () => {
        await endDay.openFromHamburgerMenu();
        expect(await endDay.isUnusedKitsScreenVisible()).toBe(true);
        const count = await endDay.getUnusedKitsCount();
        console.log(`[ED-TC-006/007] Unused Kits shown on a Coffee route, count = ${count}`);
        // Zero is the evidence that nothing was skipped - the precondition both
        // cases are written against. If this ever becomes non-zero the gap
        // below is being judged against the wrong situation.
        expect(count).toBe(0);
      });
    }
  );

  test(
    'ED-TC-006/007 (gap): Unused Kits should NOT be shown for Coffee, or when no stop was skipped',
    { tag: ['@EndDay-ED-TC-006', '@EndDay-ED-TC-007'] },
    async ({ driver }) => {
      test.fail();
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const home = new HomeScreen(driver);
      const endDay = new EndDayScreen(driver);

      await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
      await prepTasks.openFromHamburgerMenu();
      await prepTasks.ensureFullDayPrepComplete();
      await home.returnToHome();

      await endDay.openFromHamburgerMenu();
      expect(await endDay.isUnusedKitsScreenVisible()).toBe(false);
    }
  );

  // ==== ED-TC-008 (Coffee has no Skip Stop; warehouse returns go via Transfers) ====
  //
  // "Coffee route does not support Skip Stop" -> "Skip Stop functionality
  // should not be available for Coffee; And Return to Warehouse for Coffee
  // should be handled through transfer functionality".
  //
  // Two clauses, and both are asserted - but the second only to the extent
  // that the MECHANISM exists. Whether Route to Warehouse actually transfers
  // stock correctly is the Transfers suite's own subject (transfers.spec.ts
  // covers Menu/Transfers-Route-to-Warehouse), and duplicating it here would
  // add runtime without adding coverage.
  //
  // ASSERTING AN ABSENCE is the hard half. A swipe that reveals nothing is
  // indistinguishable from a swipe that did not take - and this suite has
  // already been bitten by exactly that, which is why revealRowDelete grew a
  // `slow` variant in the first place. So this uses revealRowDeleteResilient,
  // which escalates from the fast gesture to the slow one and reports whether
  // ANYTHING appeared. A false from it means the control is absent, not that
  // the gesture missed. Live-confirmed by hand first (2026-08-28): both a
  // 600ms and a 1500ms swipe across a Coffee station row leave the screen with
  // exactly one Button on it, the nav menu.
  //
  // Contrast with Market, where the same gesture on a service station row
  // reveals a skip control - see DashboardScreen.openSkipStopSheet, and note
  // its warning that the same gesture reveals a DELETE in other contexts. The
  // outcome is contextual, so this asserts what it expects rather than
  // trusting the gesture.
  test(
    'ED-TC-008: a Coffee service station offers no Skip Stop, and Transfers offers Route to Warehouse',
    { tag: ['@EndDay-ED-TC-008'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const home = new HomeScreen(driver);
      const transfers = new TransfersScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('Open a Coffee stop with a service station on it', async () => {
        const pending = await dashboard.getPendingActionCount();
        expect(pending, 'need a Coffee stop to inspect').toBeGreaterThan(0);
        await dashboard.clickLocationByPosition('first');
        expect(await dashboard.isLobCardVisible('coffee')).toBe(true);
        expect(await dashboard.isNthServiceStationVisible('coffee', 'first')).toBe(true);
      });

      await test.step('ED-TC-008: swiping the station row reveals no Skip Stop control', async () => {
        const revealed = await dashboard.revealsServiceStationRowControl('coffee', 'first');
        console.log(`[ED-TC-008] control revealed by swiping a Coffee station row = ${revealed}`);
        expect(
          revealed,
          'A control appeared on a Coffee service station row - Skip Stop may now be supported for Coffee, ' +
            'which would make ED-TC-008 obsolete rather than passing'
        ).toBe(false);
      });

      await test.step('ED-TC-008: Route to Warehouse is offered as the transfer mechanism', async () => {
        // The second clause, scoped to the mechanism existing. What it DOES is
        // transfers.spec.ts's subject.
        await home.returnToHome();
        await transfers.open();
        const tabs = await transfers.isLandingPageVisible();
        console.log(`[ED-TC-008] transfers landing = ${JSON.stringify(tabs)}`);
        expect(tabs.routeToWarehouse).toBe(true);
        expect(tabs.coffee).toBe(true);
      });
    }
  );

});
