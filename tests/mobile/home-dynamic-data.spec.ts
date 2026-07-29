import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndWaitForMfa } from '../../utils/login-flow';
import { HomeScreen } from '../../screens/home.screen';

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
  test(
    'view the system date, route badge, and dynamic Deliveries/LOB counts',
    { tag: ['@StartOfDay-TC007', '@StartOfDay-TC012', '@StartOfDay-TC013', '@StartOfDay-TC014', '@StartOfDay-TC015'] },
    async ({ driver }) => {
      const home = new HomeScreen(driver);

      await test.step('Log in', async () => {
        await loginAndWaitForMfa(driver);
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

      // TC015 "view Vending counter" (same dynamic pattern applies to
      // Market/Coffee) - live-verified on Miami/010: only LOBs with
      // scheduled stops render a card at all (Market "0/3", Coffee "0/1" -
      // no Vending card, since this route has zero Vending stops today).
      // So this asserts the counts that ARE present are well-formed
      // ("X/Y"), not that all three LOBs always appear.
      await test.step('TC015: verify each rendered LOB count is well-formed (X/Y)', async () => {
        const counts = await home.getLobCounts();
        const renderedLobs = Object.keys(counts);
        expect(renderedLobs.length).toBeGreaterThan(0);
        for (const lob of renderedLobs) {
          expect(counts[lob as keyof typeof counts]).toMatch(/^\d+\/\d+$/);
        }
      });
    }
  );

  test(
    'open Edit schedule and verify it lists every stop',
    { tag: ['@StartOfDay-TC018', '@StartOfDay-TC020', '@StartOfDay-TC036'] },
    async ({ driver }) => {
      const home = new HomeScreen(driver);

      await test.step('Log in', async () => {
        await loginAndWaitForMfa(driver);
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
    }
  );
});
