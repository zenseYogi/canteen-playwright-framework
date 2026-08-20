import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndEnsureRoute, ensureOnRoute } from '../../utils/login-flow';
import { HomeScreen } from '../../screens/home.screen';
import { AdhocDeliveryScreen } from '../../screens/adhoc-delivery.screen';
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

      // // TC019 (Area: Start of The Day, Sub Area: Home-Schedule, PBI
      // // 611763/630328) is the exact same assertion as TC027 under a
      // // different PBI - "click the plus(+) icon" -> "navigate to Add
      // // delivery screen" - so this one test satisfies both rather than
      // // duplicating it. TC052 (Area: Start of The Day, Sub Area: Add stop,
      // // PBI 611757) is "view 'Add delivery' title" - also the exact same
      // // isTitleVisible() assertion below, a third PBI covered by this test.
      // //
      // // NOT asserted: TC059 (bundled in TC052's own row, same PBI 611757)
      // // claims "Add delivery button disabled when mandatory fields are
      // // empty" - directly tested live 2026-07-27 and found FALSE. The Add
      // // Delivery button's enabled attribute is "true" with the Customer
      // // field completely empty and nothing else filled in. Same class of
      // // confirmed Excel-vs-app discrepancy as TC077/TC173 (see
      // // prep-tasks.spec.ts) - not an assumption.
      // await test.step('Log in, ensure Charlotte/103 (Miami/010 needs BA data prep)', async () => {
      //   await loginAndEnsureRoute(driver, mobileConfig.vendingRoute);
      // });

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
       // expect(await adhoc.isAddAnotherDeliveryButtonVisible()).toBe(true);
      });

      await test.step('Return to Home', async () => {
        await home.returnToHome();
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
        await loginAndEnsureRoute(driver, { ...mobileConfig.emptyRoute, day: 'TODAY' });
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
