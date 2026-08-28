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
  // THE STEP IS NOT UNCONDITIONAL, which is what makes this a real gap rather
  // than "the app always shows it". ED-TC-004 runs the same flow on the EMPTY
  // route (Charlotte 001, nothing scheduled) and Unused Kits is ABSENT there -
  // End Day goes straight to Reports (logged: unusedKits=false reports=true).
  // So the app does suppress this step in at least one situation; it simply
  // does not suppress it for a Coffee route with nothing skipped, which is the
  // situation both these cases are about.
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


  // ==== ED-TC-004 (End Day is available on a day with nothing scheduled) ====
  //
  // "End of Day is available when no scheduled activities exist for the day"
  // -> "End of Day should be enabled since there are no pending activities to
  // block it".
  //
  // RUNS ON THE DEDICATED EMPTY ROUTE (mobileConfig.emptyRoute, Charlotte 001)
  // on YESTERDAY. The route is empty on all three days the picker offers, and
  // the day matters for collision avoidance rather than data: SD-TC-024 ADDS a
  // delivery to TODAY and SD-TC-022 to TOMORROW, so either would put a
  // scheduled activity in front of a case whose entire precondition is that
  // there are none. Same separate-by-day approach as those two use on each
  // other.
  //
  // The precondition is ASSERTED, not assumed. "End Day opened" proves nothing
  // about this case unless the day really was empty - and on a route two other
  // tests write to, that is exactly the thing most likely to stop being true.
  //
  // Start Day is completed first, deliberately. A day has to be started before
  // it can be ended, and SD-TC-024 is the standing evidence that Start Day
  // completes fine with zero deliveries. Doing it here also means a failure
  // afterwards is about End Day rather than about an un-started day.
  //
  // Like every other non-terminal case here, this stops at the closure flow and
  // never taps Done.
  test(
    'ED-TC-004: End Day is available on a day with no scheduled activities',
    { tag: ['@EndDay-ED-TC-004'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const home = new HomeScreen(driver);
      const endDay = new EndDayScreen(driver);

      await test.step('Log in and switch to the empty route (Charlotte 001) on YESTERDAY', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.emptyRoute, day: 'YESTERDAY' });
        await home.returnToHome();
      });

      await test.step('ED-TC-004 (precondition): the day has no scheduled activities', async () => {
        const deliveries = await home.getDeliveriesCount();
        console.log(`[ED-TC-004] deliveries scheduled = ${deliveries}`);
        expect(
          deliveries,
          'ED-TC-004 needs a day with NOTHING scheduled - if this route has acquired deliveries, ' +
            'the case is being judged against the wrong situation'
        ).toBe(0);
      });

      await test.step('Complete Start Day (a day must be started before it can be ended)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('ED-TC-004: End Day opens with nothing blocking it', async () => {
        await endDay.openFromHamburgerMenu();
        // The "End Day is Disabled" gate ED-TC-001/002 describe. With no
        // pending activities there is nothing for it to list, so it must not
        // appear - that IS this case.
        expect(await endDay.isFinishServiceGateVisible()).toBe(false);
        // And it genuinely entered the closure flow rather than merely not
        // showing the gate: one of its steps is on screen.
        const unusedKits = await endDay.isUnusedKitsScreenVisible();
        const reports = await endDay.isReportsScreenVisible();
        console.log(`[ED-TC-004] closure flow reached: unusedKits=${unusedKits} reports=${reports}`);
        expect(unusedKits || reports).toBe(true);
      });
    }
  );


  // ==== ED-TC-002 / ED-TC-003 (the End Day gate, and its No Service sheet) ====
  //
  //   ED-TC-002 "End of Day is blocked until required activities are complete"
  //             -> "the driver should be taken to an End Day is Disabled
  //             screen; And pending activities should be listed with Service
  //             and No Service actions"
  //   ED-TC-003 "No Service pop-up presents order options when a current-day
  //             order exists" -> "order options should be displayed under
  //             Select Order Option"
  //
  // RUNS ON THE MARKET ROUTE (Miami 001), and has to. On the Coffee route this
  // gate never appears at all - End Day opens straight into the closure flow
  // with Coffee stops still pending, which is ED-TC-009's subject. Pending
  // MARKET stops are what block End Day, so that is where these two live.
  //
  // NON-DESTRUCTIVE by construction. It opens the No Service sheet to assert
  // its contents and then dismisses it via the scrim - openNoServiceSheet()
  // exists precisely so this can be done without resolveWithNoService()'s
  // commit. Nothing is skipped, no stop is resolved, and the route is left
  // exactly as found. That matters: skipping is how ED-TC-010/011/012 get
  // their money-bag data, and doing it here would spend that state early.
  //
  // NOTE Start Day is NOT completed first. The gate appeared without it on
  // 2026-08-28, and these cases are about pending ACTIVITIES blocking End Day
  // rather than about the day being started - so requiring Start Day would add
  // a precondition the cases do not have.
  test(
    'ED-TC-002/003: pending Market stops block End Day and list Service/No Service, whose sheet offers order options',
    { tag: ['@EndDay-ED-TC-002', '@EndDay-ED-TC-003'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const home = new HomeScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const endDay = new EndDayScreen(driver);

      await test.step('Log in and switch to the Market route (Miami 001)', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.marketRoute);
        await home.returnToHome();
      });

      let pending = 0;
      await test.step('Precondition: the route has unfinished activities', async () => {
        pending = await dashboard.getPendingActionCount();
        console.log(`[ED-TC-002] pending stops = ${pending}`);
        expect(
          pending,
          'ED-TC-002/003 need UNFINISHED activities - with none, End Day would open unblocked and there ' +
            'would be no gate to assert (that situation is ED-TC-004)'
        ).toBeGreaterThan(0);
      });

      await test.step('ED-TC-002: End Day is blocked, listing the pending activities', async () => {
        await endDay.openFromHamburgerMenu();
        expect(await endDay.isFinishServiceGateVisible()).toBe(true);
        // It did NOT enter the closure flow - the gate is a block, not a
        // banner shown alongside it.
        expect(await endDay.isUnusedKitsScreenVisible()).toBe(false);
        expect(await endDay.isReportsScreenVisible()).toBe(false);

        const listed = await endDay.getGatePendingActivityCount();
        console.log(`[ED-TC-002] activities listed on the gate = ${listed}`);
        expect(listed).toBeGreaterThan(0);
      });

      await test.step('ED-TC-002: each pending activity offers Service and No Service', async () => {
        const actions = await endDay.isGateActionPairVisible();
        console.log(`[ED-TC-002] gate actions = ${JSON.stringify(actions)}`);
        expect(actions.service).toBe(true);
        expect(actions.noService).toBe(true);
      });

      await test.step('ED-TC-003: the No Service sheet presents its order options', async () => {
        await endDay.openNoServiceSheet();
        const options = await endDay.getOrderOptions();
        console.log(`[ED-TC-003] order options = ${JSON.stringify(options)}`);
        expect(options.heading).toBe(true);
        expect(options.leaveOnTruck).toBe(true);
        expect(options.returnToWarehouse).toBe(true);
      });

      await test.step('Leave the route as found - dismiss without resolving anything', async () => {
        await endDay.dismissNoServiceSheet();
        await home.returnToHome();
        // The stop really was left unresolved. Without this the test could
        // pass having quietly skipped a stop, spending the very data
        // ED-TC-010/011/012 need.
        expect(await dashboard.getPendingActionCount()).toBe(pending);
      });
    }
  );


  // ==== ED-TC-013 (the Reports step's header and contents) ====
  //
  // "Reports step lists available EOD reports with correct defaults" -> "the
  // Reports screen should display the Date and Route Number at the top; And
  // display the Reports heading; And list available report categories such as
  // Coffee, Market, and Vending with their respective..."
  //
  // CATEGORIES ARE READ, NOT DICTATED. The case names Coffee, Market and
  // Vending, but which appear depends on what the ROUTE actually did - Miami
  // 001 is Market-only, so MARKET is the only category there, and asserting
  // all three would fail a screen behaving perfectly correctly. What is
  // asserted is that the screen lists at least one real category and names a
  // report against it.
  //
  // NON-TERMINAL. Reports is the last step before Done, and Done is what
  // uploads and completes the day (ED-TC-014/015). This asserts the screen's
  // contents and stops.
  //
  // Reaching Reports requires the route's activities to be resolved - with any
  // pending, End Day shows the gate instead (ED-TC-002). This does not resolve
  // them itself: skipping is destructive and the state is shared, so the test
  // states the precondition and fails clearly if it is not met.
  test(
    'ED-TC-013: the Reports step shows date, route and the report categories for the day',
    { tag: ['@EndDay-ED-TC-013'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const home = new HomeScreen(driver);
      const endDay = new EndDayScreen(driver);

      await test.step('Log in and switch to the Market route (Miami 001)', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.marketRoute);
        await home.returnToHome();
      });

      await test.step('Reach the Reports step', async () => {
        await endDay.openFromHamburgerMenu();
        expect(
          await endDay.isFinishServiceGateVisible(),
          'ED-TC-013 needs the activities for the day already resolved - End Day is showing its gate ' +
            'instead, so this route has unfinished stops (that situation is ED-TC-002)'
        ).toBe(false);
        // Unused Kits sits between End Day and Reports whenever stops were
        // skipped; step past it if it is there.
        if (await endDay.isUnusedKitsScreenVisible()) {
          await endDay.tapContinue();
        }
        await expect.poll(() => endDay.isReportsScreenVisible(), { timeout: 30_000 }).toBe(true);
      });

      await test.step('ED-TC-013: the header carries the date and route number', async () => {
        const header = await endDay.getReportsHeader();
        console.log(`[ED-TC-013] header = ${JSON.stringify(header)}`);
        expect(header.date).not.toBe('');
        expect(header.route).not.toBe('');
      });

      await test.step('ED-TC-013: report categories and their reports are listed', async () => {
        const categories = await endDay.getReportCategories();
        const lines = await endDay.getReportLines();
        console.log(`[ED-TC-013] categories = ${JSON.stringify(categories)}`);
        console.log(`[ED-TC-013] report lines = ${JSON.stringify(lines)}`);
        expect(categories.length).toBeGreaterThan(0);
        expect(lines.length).toBeGreaterThan(0);
        // Done is offered but deliberately NOT tapped - see this block's note.
        expect(await endDay.isDoneVisible()).toBe(true);
      });
    }
  );


  // ==== ED-TC-005 (End Day unblocks in real time as the last activity resolves) ====
  //
  // "End of Day becomes enabled in real time when final activity completes" ->
  // "the End of the Day option should become enabled without requiring a page
  // refresh".
  //
  // "WITHOUT A REFRESH" IS THE WHOLE CASE, so the test never re-opens End Day.
  // It stays on the gate throughout, resolves the activities one at a time, and
  // watches the same screen change by itself. Re-opening End Day between
  // resolutions would prove only that it is unblocked NOW, which is what the
  // case is careful not to ask.
  //
  // The intermediate assertion matters as much as the final one: while
  // activities remain, the gate must STILL be showing. Without it a route with
  // a single activity would pass trivially, and there would be no evidence the
  // gate tracks the count rather than happening to vanish.
  //
  // DESTRUCTIVE: it skips every stop on the route, and they do not come back
  // without a route-setup reset. Observed live before being written, on a route
  // reset for the purpose.
  //
  // DAY IS PINNED TO YESTERDAY rather than using marketRoute's configured
  // TODAY. isOnRoute() compares the DATE as well as the route number, so a
  // mismatch triggers a full switchRoute - which on 2026-08-28 would have
  // undone a route someone had just set up by hand, and risked the Route Setup
  // modal that has been intermittent. The seeded Market data sat on YESTERDAY
  // that day. Worth settling properly: the config and the device disagreed.
  test(
    'ED-TC-005: the End Day gate clears itself as the final activity is resolved, with no refresh',
    { tag: ['@EndDay-ED-TC-005'] },
    async ({ driver }) => {
      test.setTimeout(1_800_000);
      const home = new HomeScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const endDay = new EndDayScreen(driver);

      await test.step('Log in and ensure the Market route on the day carrying its data', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.marketRoute, day: 'YESTERDAY' });
        await home.returnToHome();
      });

      let pending = 0;
      await test.step('Precondition: more than one activity is outstanding', async () => {
        pending = await dashboard.getPendingActionCount();
        console.log(`[ED-TC-005] pending activities = ${pending}`);
        expect(
          pending,
          'ED-TC-005 needs at least TWO outstanding activities - with one, "still blocked while others ' +
            'remain" cannot be observed and the case would pass trivially'
        ).toBeGreaterThan(1);
      });

      await test.step('ED-TC-005: End Day starts blocked', async () => {
        await endDay.openFromHamburgerMenu();
        expect(await endDay.isFinishServiceGateVisible()).toBe(true);
        expect(await endDay.getGatePendingActivityCount()).toBe(pending);
      });

      await test.step('ED-TC-005: the gate clears itself as activities are resolved', async () => {
        for (let remaining = pending; remaining > 0; remaining--) {
          await endDay.resolveWithNoService();
          await driver.pause(2_000);

          if (remaining > 1) {
            // Still activities left, so the gate must still be blocking - and
            // listing one fewer than before.
            expect(await endDay.isFinishServiceGateVisible()).toBe(true);
            await expect
              .poll(() => endDay.getGatePendingActivityCount(), { timeout: 20_000 })
              .toBe(remaining - 1);
            console.log(`[ED-TC-005] resolved one; gate still blocking with ${remaining - 1} left`);
          }
        }
      });

      await test.step('ED-TC-005: with the last one resolved, End Day proceeds on its own', async () => {
        // NO re-open. The same screen must have moved on by itself.
        await expect
          .poll(
            async () => (await endDay.isUnusedKitsScreenVisible()) || (await endDay.isReportsScreenVisible()),
            { timeout: 60_000 }
          )
          .toBe(true);
        expect(await endDay.isFinishServiceGateVisible()).toBe(false);
        console.log(
          `[ED-TC-005] gate cleared without a refresh; unusedKits=${await endDay.isUnusedKitsScreenVisible()} ` +
            `reports=${await endDay.isReportsScreenVisible()}`
        );
      });
    }
  );


  // ==== ED-TC-014 / ED-TC-015 / ED-TC-016 (the terminal closure) ====
  //
  //   ED-TC-014 Done uploads the reports; a popup shows the success message,
  //             date, time, and an enabled Close button
  //   ED-TC-015 the End Day process completes, data is saved, and the driver
  //             exits the End Day flow
  //   ED-TC-016 Begin Day reopens centered on today afterwards
  //
  // ONE test, because they are three readings of a single irreversible
  // sequence: Done -> popup -> Close -> Select Day. Splitting them would mean
  // completing End Day three times.
  //
  // SAFE TO RE-RUN, which was not obvious and was checked before writing.
  // Completing End Day does NOT dead-end the route: Close lands on Select Day,
  // and picking a day returns to Prep Tasks with the day's stops back at
  // PENDING - the three resolved on the way through came back. So End Day is
  // itself a recovery mechanism, and notably one that never touches the
  // Select-operation modal that has been intermittently broken.
  //
  // It resolves whatever activities are outstanding to reach Reports. That is
  // destructive in the moment and self-healing by the end, per the above.
  test(
    'ED-TC-014/015/016: Done uploads and confirms, Close exits the flow, and the day selector returns',
    { tag: ['@EndDay-ED-TC-014', '@EndDay-ED-TC-015', '@EndDay-ED-TC-016'] },
    async ({ driver }) => {
      test.setTimeout(1_800_000);
      const home = new HomeScreen(driver);
      const endDay = new EndDayScreen(driver);

      await test.step('Log in and ensure the Market route on the day carrying its data', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.marketRoute, day: 'YESTERDAY' });
        await home.returnToHome();
      });

      await test.step('Reach the Reports step, resolving any outstanding activities', async () => {
        await endDay.openFromHamburgerMenu();
        for (let guard = 0; guard < 8 && (await endDay.isFinishServiceGateVisible()); guard++) {
          await endDay.resolveWithNoService();
          await driver.pause(2_000);
        }
        expect(await endDay.isFinishServiceGateVisible()).toBe(false);
        if (await endDay.isUnusedKitsScreenVisible()) {
          await endDay.tapContinue();
        }
        await expect.poll(() => endDay.isReportsScreenVisible(), { timeout: 30_000 }).toBe(true);
        expect(await endDay.isDoneEnabled()).toBe(true);
      });

      await test.step('ED-TC-014: Done produces a confirmation carrying date and time', async () => {
        await endDay.tapDone();
        await expect.poll(() => endDay.isSyncCompletePopupVisible(), { timeout: 60_000 }).toBe(true);
        const text = await endDay.getSyncCompletePopupText();
        console.log(`[ED-TC-014] popup = ${text}`);
        // The case's substance: date, time, and an enabled Close.
        expect(text).toMatch(/Date:\s*\d{1,2}-\w{3}-\d{4}/);
        expect(text).toMatch(/Time:\s*\d{1,2}:\d{2}/);
        expect(await endDay.isCloseEnabled()).toBe(true);
        // NOT asserted: that the popup says "End Day Successful". It says
        // "Route Data Sync Complete". Asserting the sheet's wording would fail
        // on a build behaving correctly, and asserting the app's wording would
        // bake a discrepancy in as if intended - so it is recorded and left
        // for QA to rule on.
        console.log(`[ED-TC-014] NOTE popup title is "Route Data Sync Complete", not "End Day Successful"`);
      });

      await test.step('ED-TC-015: Close exits the End Day flow', async () => {
        await endDay.tapClose();
        await expect.poll(() => endDay.isSelectDayVisible(), { timeout: 60_000 }).toBe(true);
        // Genuinely out of the flow, not merely past the popup.
        expect(await endDay.isReportsScreenVisible()).toBe(false);
        expect(await endDay.isUnusedKitsScreenVisible()).toBe(false);
      });

      await test.step('ED-TC-016: the day selector returns, offering today', async () => {
        const options = await endDay.getSelectDayOptions();
        console.log(`[ED-TC-016] day options = ${JSON.stringify(options)}`);
        expect(options.length).toBeGreaterThan(0);
        const today = options.find((o) => o.label.startsWith('TODAY'));
        expect(today, 'the selector should offer TODAY').toBeTruthy();
        // The case says today should be "in the middle of the date selector".
        // It is not BETWEEN the other two: TODAY sits on its own full-width row
        // ABOVE, with YESTERDAY and TOMORROW side by side beneath it. Logged
        // rather than asserted either way - "middle" may well mean this
        // primary/centred position, and that is a QA call, not one to bake in.
        const others = options.filter((o) => !o.label.startsWith('TODAY'));
        console.log(
          `[ED-TC-016] layout: TODAY y=${today?.y}, others y=${others.map((o) => o.y).join(',')} - ` +
            `TODAY is ${others.every((o) => (today?.y ?? 0) < o.y) ? 'ABOVE' : 'not above'} the other options`
        );
      });
    }
  );

});
