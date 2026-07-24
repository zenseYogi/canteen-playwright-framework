import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndWaitForMfa } from '../../utils/login-flow';
import { HomeScreen } from '../../screens/home.screen';
import { AdhocDeliveryScreen } from '../../screens/adhoc-delivery.screen';

// PBI 850155 "Ad-hoc Scheduling" (Start of The Day area). Four TCs:
//   TC025 - "No deliveries available" empty state (0 Delivery, message,
//           Start day shown inactive).
//   TC027 - Navigate to Ad-hoc delivery creation screen via "+".
//   TC028 - Ad-hoc scheduling available across all days with zero
//           deliveries (past/current/future).
//   TC029 - Empty state should NOT show, delivery list should display,
//           when deliveries exist.
//
// Data note (2026-07-24): BA has seeded delivery data across every day
// (Yesterday/Today/Tomorrow) on both routes this framework knows about
// (Miami/010, Charlotte/103) - a zero-delivery day existed on Miami/010
// earlier the same day (confirmed live: "0 Delivery", the empty-state
// message, Start day shown disabled) but no longer does on either route as
// of writing. TC029 (data exists) is fully verified below. TC027 turned out
// NOT to require an empty day at all - live-verified reachable from a day
// with 4 real deliveries. TC025/TC028 genuinely need a zero-delivery day and
// are written as test.fixme() (ready to enable, not guessed at) pending BA
// confirming/creating one.
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

  // Pending a zero-delivery day being available again on a known route (see
  // the Data note above) - written now per explicit instruction ("automate
  // it for now, re-verify when zero-delivery data is available"), not
  // guessed-and-claimed-passing. Flip to test() once BA confirms/creates one.
  test.fixme(
    'TC025: view the "No deliveries available" empty state',
    { tag: ['@TC025'] },
    async ({ driver }) => {
      const home = new HomeScreen(driver);

      await test.step('Log in (on a zero-delivery day)', async () => {
        await loginAndWaitForMfa(driver);
      });

      await test.step('TC025: verify 0 Delivery, the empty-state message, and Start day disabled', async () => {
        expect(await home.getDeliveriesCount()).toBe(0);
        expect(await home.isDeliveriesEmptyStateVisible()).toBe(true);
        expect(await home.isStartDayDisabled()).toBe(true);
      });

      await test.step('TC025/TC027: the "+" icon is still available on the empty state', async () => {
        const adhoc = new AdhocDeliveryScreen(driver);
        await home.openAdhocDeliveryCreation();
        expect(await adhoc.isTitleVisible()).toBe(true);
      });
    }
  );

  test.fixme(
    'TC028: Ad-hoc scheduling is available across multiple zero-delivery days',
    { tag: ['@TC028'] },
    async ({ driver }) => {
      const home = new HomeScreen(driver);

      await test.step('Log in', async () => {
        await loginAndWaitForMfa(driver);
      });

      // Requires switchRoute-ing through Yesterday/Today/Tomorrow (or
      // further via Route Setup) to find/confirm multiple zero-delivery
      // days in sequence, verifying the empty state + "+" availability on
      // each - not written in full until at least one such day is
      // confirmed live, to avoid guessing at multi-day navigation timing.
      await test.step('TC028: verify Ad-hoc scheduling is offered on every zero-delivery day tried', async () => {
        expect(await home.isDeliveriesEmptyStateVisible()).toBe(true);
      });
    }
  );
});
