import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndEnsureRoute, ensureOnRoute } from '../../utils/login-flow';
import { HomeScreen } from '../../screens/home.screen';
import { AdhocDeliveryScreen } from '../../screens/adhoc-delivery.screen';
import { DashboardScreen } from '../../screens/dashboard.screen';
import { PrepTasksScreen } from '../../screens/prep-tasks.screen';
import { CoffeeServiceScreen } from '../../screens/coffee-service.screen';
import type { Lob } from '../../utils/lob';
import { mobileConfig } from '../../config/mobile.config';

// PBI 850155 "Ad-hoc Scheduling" (Start of The Day area). Four TCs:
//   TC025 - "No deliveries available" empty state (0 Delivery, message,
//           Start day shown inactive).
//   TC027 - Navigate to Ad-hoc delivery creation screen via "+".
//   TC028 - Ad-hoc scheduling available across all days with zero
//           deliveries (past/current/future).
//   TC029 - Empty state should NOT show, delivery list should display,
//           when deliveries exist.
//
// Data note (2026-07-27): TC025/TC028 need a genuinely zero-delivery day,
// which neither defaultRoute (Miami/010) nor vendingRoute (Charlotte/103)
// have anymore - both got real data seeded across every day. Tried
// Charlotte/103/Tomorrow first (per a specific request) - still 153
// Deliveries, not zero. Miami, FL / Route 001 (config/mobile.config.ts's
// emptyRoute) confirmed live to be empty across Yesterday/Today/Tomorrow -
// a dedicated test route, distinct from the two real business routes above.
// Both TCs are now live-verified and passing.
//
// CORRECTED (2026-07-27): TC027 and TC029 both silently relied on
// loginAndWaitForMfa()'s implicit defaultRoute (Miami/010) rather than
// switching explicitly - which broke TC029 the moment Miami/010's
// Yesterday went stale (same fixed-date-seed issue flagged in
// mobile.config.ts, now recurring as real time passed Jul 24). Miami/010
// needs BA data prep before it's usable again, so both now explicitly
// switch to Charlotte/103 (vendingRoute) instead, which has real data on
// every day.
test.describe('Ad-hoc Scheduling (PBI 850155)', () => {
  test(
    'TC027/TC019/TC052/TC026: navigate to the Ad-hoc delivery creation screen',
    { tag: ['@StartOfDay-TC027', '@StartOfDay-TC019', '@StartOfDay-TC052', '@StartOfDay-TC026'] },
    async ({ driver }) => {
      const home = new HomeScreen(driver);
      const adhoc = new AdhocDeliveryScreen(driver);

      // TC019 (Area: Start of The Day, Sub Area: Home-Schedule, PBI
      // 611763/630328) is the exact same assertion as TC027 under a
      // different PBI - "click the plus(+) icon" -> "navigate to Add
      // delivery screen" - so this one test satisfies both rather than
      // duplicating it. TC052 (Area: Start of The Day, Sub Area: Add stop,
      // PBI 611757) is "view 'Add delivery' title" - also the exact same
      // isTitleVisible() assertion below, a third PBI covered by this test.
      //
      // NOT asserted: TC059 (bundled in TC052's own row, same PBI 611757)
      // claims "Add delivery button disabled when mandatory fields are
      // empty" - directly tested live 2026-07-27 and found FALSE. The Add
      // Delivery button's enabled attribute is "true" with the Customer
      // field completely empty and nothing else filled in. Same class of
      // confirmed Excel-vs-app discrepancy as TC077/TC173 (see
      // prep-tasks.spec.ts) - not an assumption.
      await test.step('Log in, ensure Charlotte/103 (Miami/010 needs BA data prep)', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.coffeeRoute);
      });

      // Live-verified: this "+" icon is reachable regardless of whether the
      // current day is empty or has real deliveries, and regardless of
      // which route/LOB is active (also confirmed on Charlotte/103, a
      // Vending-only route).
      await test.step('TC026: the "+" icon (Schedule Ad-hoc Delivery\'s primary CTA) is visible', async () => {
        expect(await home.isAdhocDeliveryButtonVisible()).toBe(true);
      });

      await test.step('TC027/TC019/TC052: tap "+" and verify the Add Delivery screen opens', async () => {
        await home.openAdhocDeliveryCreation();
        expect(await adhoc.isTitleVisible()).toBe(true);
        expect(await adhoc.isCustomerFieldVisible()).toBe(true);
        expect(await adhoc.isAddDeliveryButtonVisible()).toBe(true);
        expect(await adhoc.isAddAnotherDeliveryButtonVisible()).toBe(true);
      });

      await test.step('Return to Home', async () => {
        await home.returnToHome();
      });
    }
  );

  // ==== SD-TC-017 (regression sheet, "Start of the day") ====
  //
  // "User is able to successfully create an ad-hoc delivery for Coffee by
  // selecting Customer and location/Machine/POS and clicking Continue" -> the
  // user is taken to the Coffee Service screen.
  //
  // REUSES the existing Ad-hoc machinery rather than restating it: the customer
  // search/select and the Service picker are the same AdhocDeliveryScreen
  // methods TC053-TC068 already exercises field by field, and the same sequence
  // coffee-service.spec.ts's own bootstrap uses. What is NOT covered anywhere
  // yet, and is the whole point of this case, is the OUTCOME: that submitting
  // lands the driver on the Coffee service screen.
  //
  // THE FORM VARIES BY ACCOUNT, not by route (live-verified 2026-08-27, and a
  // correction to an earlier note here that blamed the route). The submit
  // control is "Add Delivery" for a multi-service account and "Continue" for a
  // single-service one, and the Service Type field is present only for the
  // former - which is why this uses submitAddDelivery() and selectServiceType()
  // rather than either literal control: both already resolve that difference
  // themselves (see their own doc comments). Hand-rolling "~Continue" here
  // would re-implement submitAddDelivery()'s existing fallback.
  //
  // PRECONDITION - Start Day. Confirmed 2026-08-27 as INTENDED behaviour, not
  // a defect: a service screen cannot be opened until Start Day is done. With
  // the day unstarted, tapping Continue creates the delivery correctly but
  // lands on the Start day checklist instead of the Coffee Service screen -
  // live-reproduced twice, once on a schedule cleaned of the previous run's
  // stop, so it is neither intermittent nor an artefact of leftover state.
  // The case's expected result is therefore only reachable on a started day.
  //
  // Uses selectFirstCoffeeService() rather than naming a service - the picker's
  // contents are route data and change. The CUSTOMER, by contrast, is named on
  // instruction: an arbitrary first search result does not work, because the
  // case needs an account that actually offers an OCS/Pantry (Coffee) service
  // and most do not. A catalogue account is a legitimate fixture where a
  // schedule stop would not be - the schedule is volatile (see
  // coffee-service.spec.ts's runtime stop discovery), the customer catalogue is
  // not.
  // The catalogue account SD-TC-017 and SD-TC-024 both book against, and the
  // index of the right one within a search for "American".
  //
  // A NAMED customer is required, not an arbitrary search result: most
  // accounts offer no service station at all, and the ad-hoc form cannot be
  // completed without one. Live-verified 2026-08-27 on Charlotte 001 that the
  // first hit for "a" is "1225 SOUTH CHURCH APARTMENTS", whose Location /
  // Machine / POS picker opens on "No items available" - that is what blocked
  // SD-TC-024, NOT the route change.
  //
  // The catalogue lists TWO "American Airlines"; only the 4800 Hangar one
  // (index 1) offers services - five OCS/Pantry stations plus a Market
  // section. Confirmed present with the SAME ordering on BOTH Charlotte 103
  // and Charlotte 001, so one fixture serves both tests.
  //
  // Naming a CATALOGUE account does not conflict with this suite's rule
  // against hardcoding stops: the schedule is volatile, the account
  // catalogue is not.
  const KNOWN_SERVICEABLE_CUSTOMER = 'American Airlines';
  const KNOWN_SERVICEABLE_CUSTOMER_INDEX = 1;

  test(
    'SD-TC-017: creating an ad-hoc Coffee delivery lands on the Coffee service screen',
    { tag: ['@StartOfDay-SD-TC-017'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const home = new HomeScreen(driver);
      const adhoc = new AdhocDeliveryScreen(driver);
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const dashboard = new DashboardScreen(driver);

      await test.step('Log in to Charlotte 103', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await home.returnToHome();
      });

      // CLEAN FIRST, then create - rather than skipping creation when the stop
      // is already there. The app SILENTLY REFUSES a duplicate ad-hoc
      // delivery: re-adding a customer+station that is already pending leaves
      // Continue completely inert - no navigation, no toast, no inline error,
      // no disabled state (live-verified 2026-08-27, full tree of 19 nodes
      // with zero error text). So a run that left its stop behind breaks the
      // NEXT run.
      //
      // Cleaning at the START rather than at the end is deliberate: an
      // end-of-test cleanup never executes when a run crashes or is
      // interrupted, whereas this self-heals on the following run. And unlike
      // a create-only-if-absent guard, creation is still exercised EVERY run,
      // so the case keeps testing what its title claims.
      //
      // Runs BEFORE Start Day, not after. Placed after it, this failed to
      // find a stop that was demonstrably on the schedule: live-traced
      // 2026-08-27, the row lookup returned "no such element" 1.2s after the
      // tab tap and stayed empty through all 25 scroll attempts, because
      // returning from the Prep Tasks flow leaves Home's tab bar rendered
      // while the schedule list itself is still empty. Immediately after
      // login the list is already populated. The getLocationCount() poll
      // below is the explicit "the list has actually rendered" gate, so this
      // can never silently no-op on an unrendered list again.
      // !! THIS STEP IS UNPROVEN - though the mechanism underneath it is not.
      // dashboard.deleteNthServiceStation() is PROVEN (SD-TC-024's cleanup
      // exercises it and asserts the route returns to 0 deliveries). What has
      // never been observed working is THIS step specifically, because it
      // cannot find a row to delete in the first place.
      // A real app bug prevents it being exercised: after a session reload an
      // ad-hoc delivery goes COUNTED BUT UNLISTED. Home's header still reads
      // "2 Deliveries / Remaining of 2", while the tab reads "Pending action
      // (1)" and the row is absent from the accessibility tree entirely -
      // confirmed via adb uiautomator dump AND Appium's own getPageSource,
      // with //*[contains(@content-desc,"American")] returning ZERO hits.
      // Pull-to-refresh does not restore it. So the stop is unreachable and
      // undeletable through the UI while STILL blocking re-creation via the
      // silent-duplicate refusal described below.
      //
      // The row IS deletable while it remains visible (same app session as
      // its creation) - that path was driven by hand twice and works. Only
      // the post-reload state is broken. Report alongside the silent-
      // duplicate finding; the two compound each other.
      //
      // Do NOT "fix" this by rewriting scrollToAndClickLocationByName() - its
      // XPath was verified correct against the live tree (exactly one match
      // when the row is present). Two runs were spent on that false trail.
      await test.step('Precondition: delete this stop if an earlier run left it behind', async () => {
        await expect
          .poll(() => dashboard.getLocationCount().catch(() => 0), { timeout: 60_000 })
          .toBeGreaterThan(0);

        const found = await dashboard.scrollToAndClickLocationByName(KNOWN_SERVICEABLE_CUSTOMER);
        if (found) {
          const deleted = await dashboard.deleteNthServiceStation('coffee', 'first');
          console.log(`[SD-TC-017] pre-existing "${KNOWN_SERVICEABLE_CUSTOMER}" stop found; coffee station deleted = ${deleted}`);
          await home.returnToHome();
        } else {
          console.log(`[SD-TC-017] no pre-existing "${KNOWN_SERVICEABLE_CUSTOMER}" stop to clean up`);
        }

        // scrollToAndClickLocationByName() leaves the list on the COMPLETED
        // tab when it finds nothing - it checks that tab second and does not
        // switch back. Everything downstream reads the Pending list, so
        // restore it rather than leaving the next step on the wrong tab.
        await dashboard.ensurePendingActionTabSelected();
      });

      // The same two calls the whole Coffee suite uses for this gate (see
      // coffee-service.spec.ts:263) rather than a new mechanism.
      // ensureFullDayPrepComplete() completes the four prep tiles on a fresh
      // day and tolerates one an earlier run already finished, since
      // completion is server-tracked per route/day and cannot be undone.
      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('Open Ad-hoc delivery creation', async () => {
        await home.openAdhocDeliveryCreation();
        expect(await adhoc.isTitleVisible()).toBe(true);
      });

      let customer = '';
      await test.step('SD-TC-017: select a customer that offers a Coffee service', async () => {
        // The list only populates after a search - the select methods pick a
        // ROW, they do not perform the search themselves. Searched on the
        // "American" token rather than a full account name: this picker is
        // already documented in this suite as not being a plain substring
        // filter, so the shorter, distinctive token is the reliable way in.
        //
        // "American Express" is NOT in Charlotte 103's catalogue - searching
        // "American" returns exactly & Efird, Airlines (x2), Business Journal,
        // Dornier, Freight 147 and Hardware & Lumber. Recorded so it is not
        // retried and written up as a broken search; the search is fine, the
        // account is simply absent here.
        await adhoc.searchCustomer('American');
        console.log(
          `[SD-TC-017] customer results for "American": ${JSON.stringify(await adhoc.getResultRowLabels())}`
        );
        expect(await adhoc.getResultRowCount()).toBeGreaterThan(0);

        // The SECOND "American Airlines" (4800 Hangar, Charlotte 28208), on
        // instruction. The catalogue lists two under that name and only this
        // one offers OCS/Pantry services, so it has to be taken by position -
        // selectCustomer() would tap the Parkway Plaza Blvd one.
        customer = await adhoc.selectSearchedCustomerByIndex(KNOWN_SERVICEABLE_CUSTOMER, KNOWN_SERVICEABLE_CUSTOMER_INDEX);
        console.log(`[SD-TC-017] selected customer "${customer}"`);
      });

      await test.step('SD-TC-017: select a Coffee (OCS/Pantry) service station', async () => {
        // This account pre-populates the "Location, Machine or POS" picker -
        // it opens straight onto "Select Service" with five OCS/Pantry entries
        // and a Market section, no search needed. Other accounts (American &
        // Efird) open with only a search box, so pre-population is an ACCOUNT
        // property, not a route one. selectFirstCoffeeService() covers both:
        // it taps the field and takes the first OCS/Pantry row.
        expect(await adhoc.isServiceFieldVisible()).toBe(true);
        await adhoc.selectFirstCoffeeService();

        // No-ops when the account's form has no Service Type field - see the
        // block comment above.
        await adhoc.selectServiceType('FULL');
      });

      await test.step('SD-TC-017: submitting takes the driver to the Coffee service screen', async () => {
        await adhoc.submitAddDelivery();

        // The outcome clause, and the whole point of the case - landing on a
        // Coffee service screen is what distinguishes this from TC053-TC068,
        // which stop at the form.
        //
        // Asserted via the CHECKLIST header, not DashboardScreen's
        // isLobCardVisible('coffee'). Continue does not land on the Stop
        // Overview, where that LOB tile lives - it goes one level deeper,
        // straight onto the service checklist (Before Photos / Delivery /
        // Equipment Audit / Add Presale / After Photos / Signing Order /
        // Complete Delivery), which carries no "coffee" ImageView at all.
        // The LOB-tile check therefore fails on a screen that is in fact the
        // correct destination - live-confirmed 2026-08-27.
        // isServiceStopLocationHeaderVisible() anchors on the Before Photos
        // tile, so it is specific to this checklist rather than to any screen
        // that merely mentions coffee.
        await expect
          .poll(() => coffee.isServiceStopLocationHeaderVisible().catch(() => false), { timeout: 30_000 })
          .toBe(true);
        console.log(
          `[SD-TC-017] ad-hoc Coffee delivery created for "${customer}"; landed on service stop "${await coffee.getServiceStopLocationHeaderText()}"`
        );
      });
    }
  );


  // ==== SD-TC-024 (regression sheet, "Start of the day") ====
  //
  // "Driver can Start Day with no scheduled deliveries on the route" -> Start
  // Day should complete successfully; and the driver should still be able to
  // add ad-hoc deliveries from the schedule.
  //
  // REUSES TC025's route and setup exactly - mobileConfig.emptyRoute, the
  // dedicated zero-delivery test route, which is CHARLOTTE, NC / Route 001 as
  // of 2026-08-27 (user-specified). It previously pointed at Miami / Route
  // 001, which acquired 2 seeded Market deliveries in build 0.1.90 and so
  // could no longer satisfy this case's "no scheduled deliveries" premise -
  // that is why this test was blocked rather than failing on its own logic.
  //
  // Note TC025 already asserts that with zero deliveries Start Day is DISABLED,
  // which reads as a contradiction of this case. The reconciliation is in
  // SD-TC-024's own second clause: ad-hoc deliveries are not SCHEDULED ones, so
  // the route still has "no scheduled deliveries" after one is added, and that
  // is what makes Start Day actionable. This asserts that sequence rather than
  // assuming either the sheet or TC025 is wrong.
  test(
    'SD-TC-024: on a route with no scheduled deliveries, an ad-hoc delivery makes Start Day actionable',
    { tag: ['@StartOfDay-SD-TC-024'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const home = new HomeScreen(driver);
      const adhoc = new AdhocDeliveryScreen(driver);
      const dashboard = new DashboardScreen(driver);
      let lob: Lob = 'coffee';

      await test.step('Log in to the dedicated zero-delivery route', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.emptyRoute, day: 'TODAY' });
      });

      await test.step('SD-TC-024 (baseline): no scheduled deliveries, and Start Day is not actionable', async () => {
        // Settle on Home first - the deliveries count lives on the schedule
        // screen, and a route switch does not necessarily leave us there.
        await home.returnToHome();
        const count = await home.getDeliveriesCount();
        console.log(`[SD-TC-024] scheduled deliveries on the empty route = ${count}`);
        expect(count).toBe(0);
        expect(await home.isStartDayDisabled()).toBe(true);
      });

      await test.step('SD-TC-024: the driver can still add an ad-hoc delivery from the schedule', async () => {
        // The case's second clause, and the mechanism behind the first.
        await home.openAdhocDeliveryCreation();
        expect(await adhoc.isTitleVisible()).toBe(true);
        // A NAMED account, not the first hit for a generic term - see
        // KNOWN_SERVICEABLE_CUSTOMER above. This case does not care WHICH LOB
        // the delivery is for, only that one can be added, so any serviceable
        // account will do; it just cannot be one with no services.
        await adhoc.searchCustomer('American');
        expect(await adhoc.getResultRowCount()).toBeGreaterThan(0);
        const picked = await adhoc.selectSearchedCustomerByIndex(
          KNOWN_SERVICEABLE_CUSTOMER,
          KNOWN_SERVICEABLE_CUSTOMER_INDEX
        );
        console.log(`[SD-TC-024] selected customer "${picked}"`);
        // The label carries the LOB tag ("- OCS/Pantry" / "- Market" /
        // "- Vending"), which the cleanup step below needs to find the row
        // again. Derived rather than assumed: this account offers both Coffee
        // and Market sections, and which one sorts first is route data.
        const service = await adhoc.selectFirstServiceAnyLob();
        lob = service.includes('OCS/Pantry') ? 'coffee' : service.includes('- Vending') ? 'vending' : 'market';
        console.log(`[SD-TC-024] selected service "${service}" -> lob=${lob}`);
        // No-ops when this account's form has no Service Type field.
        await adhoc.selectServiceType('FULL');

        // NOT asserting isAddDeliveryButtonEnabled() here. That button only
        // exists on the multi-service variant of this form; a single-service
        // account submits via "Continue" instead, so the check fails by
        // ABSENCE on a form that is perfectly valid (the same trap SD-TC-017
        // hit). submitAddDelivery() already resolves both, and the real proof
        // that submission worked is the Start Day assertion below.
        await adhoc.submitAddDelivery();
      });

      await test.step('SD-TC-024: Start Day is now actionable', async () => {
        await home.returnToHome();
        console.log(`[SD-TC-024] deliveries after ad-hoc = ${await home.getDeliveriesCount()}`);
        await expect.poll(() => home.isStartDayDisabled(), { timeout: 30_000 }).toBe(false);
      });

      // MUST self-clean. This is the only test on the shared empty route that
      // ADDS to it, and its siblings depend on that route being empty:
      // TC025 asserts zero deliveries on TODAY - the very day this uses - and
      // TC028 asserts zero on ALL THREE days, so there is no day this could
      // move to instead. Without this step, running SD-TC-024 first breaks
      // both of them, and the breakage looks like a TC025/TC028 defect rather
      // than SD-TC-024's leftovers.
      //
      // Deleting here also works around the counted-but-unlisted bug noted on
      // SD-TC-017: the stop is still listed in the SAME session that created
      // it, and only vanishes from the list after a reload - so cleaning up
      // immediately is the one moment this is reliably possible.
      await test.step('Cleanup: delete the ad-hoc delivery so the route is empty again', async () => {
        expect(await dashboard.scrollToAndClickLocationByName(KNOWN_SERVICEABLE_CUSTOMER)).toBe(true);
        expect(await dashboard.deleteNthServiceStation(lob, 'first')).toBe(true);
        await home.returnToHome();
        await expect.poll(() => home.getDeliveriesCount().catch(() => -1), { timeout: 30_000 }).toBe(0);
        console.log('[SD-TC-024] cleanup done - route is empty again');
      });
    }
  );

  // ==== SD-TC-022 (regression sheet, "Start of the day") ====
  //
  // "User is navigated to Prep Tasks after adding unscheduled delivery when no
  // route setup has been performed" -> "the app should navigate to Prep Tasks".
  // The sheet marks it Pass with no test data named.
  //
  // This behaviour was found INCIDENTALLY while automating SD-TC-017 on
  // 2026-08-27, before this case was written. SD-TC-017's first three runs
  // created their ad-hoc delivery correctly but then landed on "Start day,
  // Route 103" with all four prep tiles, instead of the Coffee service screen
  // it expected - because Start Day had not been performed on that route/day.
  // That was SD-TC-022 passing in front of us. It is asserted here directly
  // rather than left as an anecdote.
  //
  // ROUTE/DAY: mobileConfig.emptyRoute (Charlotte 001) on TOMORROW, chosen for
  // two reasons. It has had no route setup performed, which is the whole
  // precondition. And it is a DIFFERENT day from SD-TC-024, which uses the
  // same route and the same customer/service fixture on TODAY - putting both
  // on one day would risk them colliding on the app's silent-duplicate
  // refusal if either ever failed to clean up after itself.
  //
  // Landing on Prep Tasks is NOT the same as completing Start Day, so this
  // costs nothing irreversible: SD-TC-017 landed here repeatedly on 26 Aug
  // while that day remained un-started.
  test(
    'SD-TC-022: adding an unscheduled delivery with no route setup done navigates to Prep Tasks',
    { tag: ['@StartOfDay-SD-TC-022'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const home = new HomeScreen(driver);
      const adhoc = new AdhocDeliveryScreen(driver);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      let lob: Lob = 'coffee';

      await test.step('Log in to a route/day with no route setup performed', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.emptyRoute, day: 'TOMORROW' });
        await home.returnToHome();
      });

      await test.step('SD-TC-022 (precondition): no route setup has been performed', async () => {
        // Home still offering its OWN "Start day" CTA is the signal that this
        // route/day has not been set up yet - it vanishes from Home once Start
        // Day completes (live-verified 2026-08-27 on Charlotte 103 / 26 Aug,
        // before and after completing it).
        expect(await home.isStartDayVisible()).toBe(true);
      });

      await test.step('SD-TC-022: add an unscheduled (ad-hoc) delivery', async () => {
        await home.openAdhocDeliveryCreation();
        expect(await adhoc.isTitleVisible()).toBe(true);
        await adhoc.searchCustomer('American');
        const picked = await adhoc.selectSearchedCustomerByIndex(
          KNOWN_SERVICEABLE_CUSTOMER,
          KNOWN_SERVICEABLE_CUSTOMER_INDEX
        );
        console.log(`[SD-TC-022] selected customer "${picked}"`);
        const service = await adhoc.selectFirstServiceAnyLob();
        lob = service.includes('OCS/Pantry') ? 'coffee' : service.includes('- Vending') ? 'vending' : 'market';
        console.log(`[SD-TC-022] selected service "${service}" -> lob=${lob}`);
        await adhoc.selectServiceType('FULL');
        await adhoc.submitAddDelivery();
      });

      await test.step('SD-TC-022: the app navigates to Prep Tasks', async () => {
        // Asserted on the four CATEGORY TILES, not on the "Start day" heading.
        // That heading is a View whose content-desc starts with "Start day",
        // and Home carries a Button with almost the same label - the tiles
        // exist only on Prep Tasks, so they cannot be satisfied by any other
        // screen.
        await expect
          .poll(
            () =>
              prepTasks
                .arePrepCategoriesVisible()
                .then((c) => c.productCollection && c.moneyOperations && c.additionalPrep && c.checks)
                .catch(() => false),
            { timeout: 30_000 }
          )
          .toBe(true);
        console.log('[SD-TC-022] landed on Prep Tasks with all four category tiles');
      });

      // Same reasoning as SD-TC-024's cleanup - this route is shared with
      // TC025/TC028, which assert it is empty (TC028 on all three days,
      // TOMORROW included), so the delivery added above must not survive.
      await test.step('Cleanup: delete the ad-hoc delivery so the route is empty again', async () => {
        await home.returnToHome();
        expect(await dashboard.scrollToAndClickLocationByName(KNOWN_SERVICEABLE_CUSTOMER)).toBe(true);
        expect(await dashboard.deleteNthServiceStation(lob, 'first')).toBe(true);
        await home.returnToHome();
        await expect.poll(() => home.getDeliveriesCount().catch(() => -1), { timeout: 30_000 }).toBe(0);
        console.log('[SD-TC-022] cleanup done - route is empty again');
      });
    }
  );

  // ==== SD-TC-018 (regression sheet, "Start of the day") ====
  //
  // "Ad-hoc Coffee delivery shows delivery and fuel adjustment charges" ->
  // "Then Delivery Fees and Fuel Adjustment charges should be displayed; And
  // values should match OneCup or show zero when not applicable."
  // The sheet marks it Result = Fail, Remarks "Bug to be raised".
  //
  // SPLIT INTO TWO TESTS, exactly as C-TC-005 is, and for the same reason:
  // test.fail() marks a WHOLE test as expected-to-fail, so a broken setup
  // would report as "failed as expected" and hide itself forever. The first
  // test below carries the setup and every clause the build satisfies, so it
  // fails LOUDLY if the flow breaks. The second carries only the fee
  // assertions under test.fail().
  //
  // STATION: deliberately NOT the first OCS/Pantry row. SD-TC-017 books
  // "Josh Birmingham Pkwy" on this same account, and the app SILENTLY REFUSES
  // a duplicate customer+station (Continue goes inert with no error at all),
  // so sharing a station would make whichever test ran second fail for a
  // reason having nothing to do with its own subject.
  //
  // Runs on Charlotte 103 / YESTERDAY because a Coffee service screen cannot
  // be opened until Start Day is done, and that route/day already has it.
  const SD_TC_018_STATION = 'Sim Room';

  /** Creates an ad-hoc Coffee delivery on Charlotte 103 and opens its Deliveries screen. */
  const reachAdhocCoffeeDeliveries = async (driver: any): Promise<void> => {
    const home = new HomeScreen(driver);
    const adhoc = new AdhocDeliveryScreen(driver);
    const prepTasks = new PrepTasksScreen(driver);
    const coffee = new CoffeeServiceScreen(driver);

    await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
    await home.returnToHome();
    await prepTasks.openFromHamburgerMenu();
    await prepTasks.ensureFullDayPrepComplete();
    await home.returnToHome();

    await home.openAdhocDeliveryCreation();
    expect(await adhoc.isTitleVisible()).toBe(true);
    await adhoc.searchCustomer('American');
    await adhoc.selectSearchedCustomerByIndex(KNOWN_SERVICEABLE_CUSTOMER, KNOWN_SERVICEABLE_CUSTOMER_INDEX);
    await adhoc.selectCoffeeServiceFor(SD_TC_018_STATION);
    await adhoc.selectServiceType('FULL');
    await adhoc.submitAddDelivery();

    await expect
      .poll(() => coffee.isServiceStopLocationHeaderVisible().catch(() => false), { timeout: 30_000 })
      .toBe(true);
    await coffee.openDelivery();
  };

  /** Removes the ad-hoc delivery created by reachAdhocCoffeeDeliveries. */
  const cleanUpAdhocCoffeeDelivery = async (driver: any): Promise<void> => {
    const home = new HomeScreen(driver);
    const dashboard = new DashboardScreen(driver);
    await home.returnToHome();
    if (await dashboard.scrollToAndClickLocationByName(KNOWN_SERVICEABLE_CUSTOMER)) {
      const deleted = await dashboard.deleteNthServiceStation('coffee', 'first');
      console.log(`[SD-TC-018] cleanup - coffee station deleted = ${deleted}`);
      await home.returnToHome();
    }
  };

  test(
    'SD-TC-018: an ad-hoc Coffee delivery opens its Deliveries screen',
    { tag: ['@StartOfDay-SD-TC-018'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const coffee = new CoffeeServiceScreen(driver);

      await test.step('Create an ad-hoc Coffee delivery and open Deliveries', async () => {
        await reachAdhocCoffeeDeliveries(driver);
        expect(await coffee.isDeliveriesHeadingVisible()).toBe(true);
        console.log('[SD-TC-018] reached the Deliveries screen of a fresh ad-hoc Coffee delivery');
      });

      // What the fee lines ACTUALLY are on this build, recorded so the gap
      // below is read as evidence rather than as an untested claim. Logged,
      // not asserted - the assertions live in the test.fail() below.
      await test.step('Record which fee lines this build renders', async () => {
        for (const label of ['Delivery Charge', 'Shipping & Handling', 'Fuel', 'Delivery Fee']) {
          console.log(`[SD-TC-018] fee line "${label}" visible = ${await coffee.isDeliveryFeeLineVisible(label)}`);
        }
      });

      await test.step('Cleanup', async () => {
        await cleanUpAdhocCoffeeDelivery(driver);
      });
    }
  );

  // The FAILING half. Asserts the INTENDED behaviour so it stays green against
  // the current build and flags loudly ("expected to fail but passed") the
  // moment the fix lands - rather than asserting the buggy behaviour as if it
  // were correct, which would go silently green forever.
  //
  // The expectation is legitimate rather than a mis-specified case: a POPULATED
  // Deliveries screen on this same route DOES render fee lines ("Shipping &
  // Handling (Taxable) $1.06", "Delivery Charge (Nontaxable) $12.00" on
  // 24Hundred Marketplace, live-verified 2026-08-25 for C-TC-005). A fresh
  // ad-hoc delivery starts EMPTY, and the empty state omits them - the same
  // BUG 918856 family. "Fuel Adjustment" is a separate question: no such line
  // has been seen anywhere in this build, on Deliveries or Signing Order.
  test(
    'SD-TC-018 (BUG 918856 family): ad-hoc Coffee delivery omits Delivery Fees and Fuel Adjustment',
    { tag: ['@StartOfDay-SD-TC-018', '@bug-918856'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      test.fail();
      const coffee = new CoffeeServiceScreen(driver);

      await reachAdhocCoffeeDeliveries(driver);
      try {
        expect(await coffee.isDeliveryFeeLineVisible('Delivery Charge')).toBe(true);
        expect(await coffee.isDeliveryFeeLineVisible('Fuel')).toBe(true);
      } finally {
        // In a finally so the stop is removed even though this test is
        // EXPECTED to throw above - without it every run would leave a stop
        // behind and the next would hit the silent-duplicate refusal.
        await cleanUpAdhocCoffeeDelivery(driver);
      }
    }
  );

  test(
    'TC029: dashboard shows the delivery list (not the empty state) when deliveries exist',
    { tag: ['@StartOfDay-TC029'] },
    async ({ driver }) => {
      const home = new HomeScreen(driver);

      // CORRECTED (live-verified 2026-08-07): the data situation has
      // flipped since this test was written against vendingRoute (Charlotte/
      // 103) - that route's seeded deliveries have since rotated out of
      // range (0 across Yesterday/Today/Tomorrow), while defaultRoute
      // (Miami/010, the "needs BA data prep" route this test used to avoid)
      // now has real data (4 deliveries) across all three days. Same
      // recurring rotating-seed-data issue flagged elsewhere in this suite -
      // switched back to defaultRoute rather than leave this permanently
      // broken on a route that's gone stale.
      await test.step('Log in, ensure Miami/010 (defaultRoute currently has real data; vendingRoute has since gone empty)', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.defaultRoute, day: 'TODAY' });
      });

      await test.step('TC029: verify a real delivery count and no empty-state message', async () => {
        const count = await home.getDeliveriesCount();
        expect(count).toBeGreaterThan(0);
        expect(await home.isDeliveriesEmptyStateVisible()).toBe(false);
      });

      await test.step('Return to Home', async () => {
        await home.returnToHome();
      });
    }
  );

  test(
    'TC025: view the "No deliveries available" empty state',
    { tag: ['@StartOfDay-TC025'] },
    async ({ driver }) => {
      const home = new HomeScreen(driver);
      const adhoc = new AdhocDeliveryScreen(driver);

      await test.step('Log in, ensure the dedicated empty test route (Miami / Route 001)', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.emptyRoute, day: 'TODAY' });
      });

      await test.step('TC025: verify 0 Delivery, the empty-state message, and Start day disabled', async () => {
        expect(await home.getDeliveriesCount()).toBe(0);
        expect(await home.isDeliveriesEmptyStateVisible()).toBe(true);
        expect(await home.isStartDayDisabled()).toBe(true);
      });

      await test.step('TC025/TC027: the "+" icon is still available on the empty state', async () => {
        await home.openAdhocDeliveryCreation();
        expect(await adhoc.isTitleVisible()).toBe(true);
      });

      await test.step('Return to Home', async () => {
        await home.returnToHome();
      });
    }
  );

  test(
    'TC028: Ad-hoc scheduling is available across multiple zero-delivery days',
    { tag: ['@StartOfDay-TC028'] },
    async ({ driver }) => {
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure the dedicated empty test route (Charlotte / Route 001) on the first day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.emptyRoute, day: 'YESTERDAY' });
      });

      // Live-verified: the dedicated empty route is empty on all three days
      // the in-app day picker offers (past/current/future relative to today).
      // That route is CHARLOTTE / Route 001 as of 2026-08-27 - Miami / 001
      // acquired 2 seeded Market deliveries in build 0.1.90. Note SD-TC-024
      // shares this route and ADDS a delivery to TODAY; it deletes it again
      // in its own cleanup step, which is what keeps this assertion valid
      // regardless of test order.
      // CORRECTED (live-verified 2026-08-08): there is no lightweight,
      // route-untouched day picker reachable from Home at all - the Home
      // date badge is not even clickable (confirmed via page-source dump
      // and a raw adb coordinate tap, both no-ops), and the "Select a day"
      // sheet only ever appears as the tail end of Route Setup's full
      // change-route flow (RouteSetupScreen.changeRouteAndSelectDay,
      // after the 60-90s resync). HomeScreen.selectDay() was built on a
      // wrong assumption and has been removed. ensureOnRoute() is the
      // correct tool here: same isOnRoute guard loginAndEnsureRoute uses,
      // so the redundant first-iteration switch (already YESTERDAY from
      // the login step above) is skipped, and only genuine day changes
      // (TODAY, TOMORROW) pay for a real switchRoute() resync.
      for (const day of ['YESTERDAY', 'TODAY', 'TOMORROW'] as const) {
        await test.step(`TC028: switch to ${day} and verify the empty state + Ad-hoc option`, async () => {
          await ensureOnRoute(driver, { ...mobileConfig.emptyRoute, day });
          // Settle on Home before reading any badge. A route/day switch does
          // NOT reliably leave the app on the schedule screen - live-verified
          // 2026-08-27 that Charlotte 001 / YESTERDAY lands on the Prep Tasks
          // "Start day, Route 1" screen instead, where getDeliveriesCount()
          // finds no "Deliver" node at all and throws "element wasn't found"
          // rather than reporting a count. SD-TC-024's own baseline step
          // documents the same hazard. Miami / 001 simply never exposed it.
          await home.returnToHome();
          expect(await home.getDeliveriesCount()).toBe(0);
          expect(await home.isDeliveriesEmptyStateVisible()).toBe(true);
          expect(await home.isStartDayDisabled()).toBe(true);

          const adhoc = new AdhocDeliveryScreen(driver);
          await home.openAdhocDeliveryCreation();
          expect(await adhoc.isTitleVisible()).toBe(true);
          await home.returnToHome();
        });
      }
    }
  );

  // Start of The Day / "Add stop" sub-area (TC053-TC068) - the Add
  // Delivery screen's own field-by-field flow. Live-verified 2026-08-10
  // (Miami/Route 10). TC054/056/059/062-066 are NOT independent rows for
  // this sub-area (those numbers belong to Vending/Market's own Removals
  // & Returns sub-areas - confirmed via a fresh Excel read) - the real
  // distinct rows are exactly TC053/055/057/058/060/061/067/068 (8 total,
  // TC052 already covered above).
  test(
    'TC053-TC068: Add Delivery field-by-field flow (search, filter, clear, select, submit)',
    {
      tag: [
        '@StartOfDay-TC053',
        '@StartOfDay-TC055',
        '@StartOfDay-TC057',
        '@StartOfDay-TC058',
        '@StartOfDay-TC060',
        '@StartOfDay-TC061',
        '@StartOfDay-TC067',
        '@StartOfDay-TC068'
      ]
    },
    async ({ driver }) => {
      const home = new HomeScreen(driver);
      const adhoc = new AdhocDeliveryScreen(driver);

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('TC053: the Customer search field is visible', async () => {
        await home.openAdhocDeliveryCreation();
        expect(await adhoc.isCustomerFieldVisible()).toBe(true);
      });

      // TC055 "view filtered accounts list" / TC058 "no-results state" /
      // TC057 "clear selected account -> full list restored".
      await test.step('TC055/TC057/TC058: filtered list, no-results state, and clearing restores the full list', async () => {
        await adhoc.searchCustomer('a');
        expect(await adhoc.getResultRowCount()).toBeGreaterThan(0);

        for (const ch of 'zzzzzzzzzz') {
          await driver.keys(ch);
        }
        expect(await adhoc.isNoSearchResultsVisible()).toBe(true);

        await adhoc.clearAccountSearch();
        expect(await adhoc.getResultRowCount()).toBeGreaterThan(0);
      });

      // TC060 "view disabled add service" (the Add Delivery button, before
      // Service/Service type are filled) / TC061 "Service station drop
      // down" (this build's own placeholder is "Search by type or
      // number", not the Excel's claimed "Select from account's service
      // stations" - a wording mismatch, not a missing field).
      await test.step('TC060/TC061: Add Delivery starts disabled; the Service field appears once a customer is selected', async () => {
        await adhoc.selectFirstSearchedCustomer();
        expect(await adhoc.isAddDeliveryButtonEnabled()).toBe(false);
        expect(await adhoc.isServiceFieldVisible()).toBe(true);
        expect(await adhoc.isServiceTypeFieldVisible()).toBe(true);
      });

      // TC067 "add multiple services" - the "+ Add Another Delivery"
      // button (already covered generically via isAddAnotherDeliveryButtonVisible
      // elsewhere) remains available throughout this same flow.
      await test.step('TC067: Add Another Delivery remains available', async () => {
        expect(await adhoc.isAddAnotherDeliveryButtonVisible()).toBe(true);
      });

      // TC068 "proceed with Start day" - live-verified: filling every
      // mandatory field enables Add Delivery, and submitting it commits
      // the new ad-hoc delivery, returning to Home with it now part of
      // the day's schedule (ready for the Start Day workflow).
      await test.step('TC068: filling every field enables Add Delivery, and submitting proceeds to the Start Day workflow', async () => {
        await adhoc.selectFirstServiceAnyLob();
        await adhoc.selectServiceType('FULL');
        expect(await adhoc.isAddDeliveryButtonEnabled()).toBe(true);
        await adhoc.submitAddDelivery();
        expect(await home.isLoaded()).toBe(true);
      });
    }
  );
});
