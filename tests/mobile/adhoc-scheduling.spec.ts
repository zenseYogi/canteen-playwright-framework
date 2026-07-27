import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndWaitForMfa, switchRoute } from '../../utils/login-flow';
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
test.describe('Ad-hoc Scheduling (PBI 850155)', () => {
  test(
    'TC027: navigate to the Ad-hoc delivery creation screen',
    { tag: ['@TC027'] },
    async ({ driver }) => {
      const home = new HomeScreen(driver);
      const adhoc = new AdhocDeliveryScreen(driver);

      await test.step('Log in', async () => {
        await loginAndWaitForMfa(driver);
      });

      // Live-verified: this "+" icon is reachable regardless of whether the
      // current day is empty or has real deliveries.
      await test.step('TC027: tap "+" and verify the Add Delivery screen opens', async () => {
        await home.openAdhocDeliveryCreation();
        expect(await adhoc.isTitleVisible()).toBe(true);
        expect(await adhoc.isCustomerFieldVisible()).toBe(true);
        expect(await adhoc.isAddDeliveryButtonVisible()).toBe(true);
        expect(await adhoc.isAddAnotherDeliveryButtonVisible()).toBe(true);
      });
    }
  );

  test(
    'TC029: dashboard shows the delivery list (not the empty state) when deliveries exist',
    { tag: ['@TC029'] },
    async ({ driver }) => {
      const home = new HomeScreen(driver);

      await test.step('Log in', async () => {
        await loginAndWaitForMfa(driver);
      });

      await test.step('TC029: verify a real delivery count and no empty-state message', async () => {
        const count = await home.getDeliveriesCount();
        expect(count).toBeGreaterThan(0);
        expect(await home.isDeliveriesEmptyStateVisible()).toBe(false);
      });
    }
  );

  test(
    'TC025: view the "No deliveries available" empty state',
    { tag: ['@TC025'] },
    async ({ driver }) => {
      const home = new HomeScreen(driver);
      const adhoc = new AdhocDeliveryScreen(driver);

      await test.step('Log in, then switch to the dedicated empty test route (Miami / Route 001)', async () => {
        await loginAndWaitForMfa(driver);
        await switchRoute(driver, { ...mobileConfig.emptyRoute, day: 'TODAY' });
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
    }
  );

  test(
    'TC028: Ad-hoc scheduling is available across multiple zero-delivery days',
    { tag: ['@TC028'] },
    async ({ driver }) => {
      const home = new HomeScreen(driver);

      await test.step('Log in', async () => {
        await loginAndWaitForMfa(driver);
      });

      // Live-verified: Miami / Route 001 is empty on all three days the
      // in-app day picker offers (past/current/future relative to today).
      for (const day of ['YESTERDAY', 'TODAY', 'TOMORROW'] as const) {
        await test.step(`TC028: switch to ${day} and verify the empty state + Ad-hoc option`, async () => {
          await switchRoute(driver, { ...mobileConfig.emptyRoute, day });
          expect(await home.getDeliveriesCount()).toBe(0);
          expect(await home.isDeliveriesEmptyStateVisible()).toBe(true);
          expect(await home.isStartDayDisabled()).toBe(true);

          const adhoc = new AdhocDeliveryScreen(driver);
          await home.openAdhocDeliveryCreation();
          expect(await adhoc.isTitleVisible()).toBe(true);
          // Return to a hamburger-accessible screen so the next iteration's
          // switchRoute() (which navigates via Settings) can reach it.
          await home.returnToHome();
        });
      }
    }
  );
});
