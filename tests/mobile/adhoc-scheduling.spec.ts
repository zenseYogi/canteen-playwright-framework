import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndEnsureRoute, ensureOnRoute } from '../../utils/login-flow';
import { HomeScreen } from '../../screens/home.screen';
import { AdhocDeliveryScreen } from '../../screens/adhoc-delivery.screen';
import { DashboardScreen } from '../../screens/dashboard.screen';
import { PrepTasksScreen } from '../../screens/prep-tasks.screen';
import { CoffeeServiceScreen } from '../../screens/coffee-service.screen';
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
        await loginAndEnsureRoute(driver, mobileConfig.vendingRoute);
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
  // The catalogue account this case books against - see the block comment
  // above for why it must be a NAMED customer rather than an arbitrary search
  // result. Shared by the cleanup precondition and the selection step so the
  // two can never drift apart.
  const SD_TC_017_CUSTOMER = 'American Airlines';

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
        await loginAndEnsureRoute(driver, { ...mobileConfig.vendingRoute, day: 'YESTERDAY' });
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
      // !! UNPROVEN AS OF 2026-08-27 - this step has NEVER been observed
      // actually deleting anything, and must not be assumed to work.
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

        const found = await dashboard.scrollToAndClickLocationByName(SD_TC_017_CUSTOMER);
        if (found) {
          const deleted = await dashboard.deleteNthServiceStation('coffee', 'first');
          console.log(`[SD-TC-017] pre-existing "${SD_TC_017_CUSTOMER}" stop found; coffee station deleted = ${deleted}`);
          await home.returnToHome();
        } else {
          console.log(`[SD-TC-017] no pre-existing "${SD_TC_017_CUSTOMER}" stop to clean up`);
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
        customer = await adhoc.selectSearchedCustomerByIndex(SD_TC_017_CUSTOMER, 1);
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
  // REUSES TC025's route and setup exactly - mobileConfig.emptyRoute (Miami /
  // Route 001), the dedicated zero-delivery test route.
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
        await adhoc.searchCustomer('a');
        expect(await adhoc.getResultRowCount()).toBeGreaterThan(0);
        expect(await adhoc.selectFirstSearchedCustomer()).not.toBe('');
        await adhoc.selectFirstServiceAnyLob();
        await adhoc.selectServiceType('FULL');
        expect(await adhoc.isAddDeliveryButtonEnabled()).toBe(true);
        await adhoc.submitAddDelivery();
      });

      await test.step('SD-TC-024: Start Day is now actionable', async () => {
        await home.returnToHome();
        console.log(`[SD-TC-024] deliveries after ad-hoc = ${await home.getDeliveriesCount()}`);
        await expect.poll(() => home.isStartDayDisabled(), { timeout: 30_000 }).toBe(false);
      });
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

      await test.step('Log in, ensure the dedicated empty test route (Miami / Route 001) on the first day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.emptyRoute, day: 'YESTERDAY' });
      });

      // Live-verified: Miami / Route 001 is empty on all three days the
      // in-app day picker offers (past/current/future relative to today).
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
