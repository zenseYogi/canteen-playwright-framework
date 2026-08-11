import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndEnsureRoute } from '../../utils/login-flow';
import { HomeScreen } from '../../screens/home.screen';
import { DashboardScreen } from '../../screens/dashboard.screen';
import { mobileConfig } from '../../config/mobile.config';

// Start of The Day / "Stop preview" sub-area (TC039-TC051) - reached by
// tapping a location card on Home BEFORE Start Day is completed. Live-
// verified 2026-08-10 (Miami/Route 10, CureLeaf/market - the only LOB
// this route currently has). Excel's TC044/TC047-TC050 mentions inside
// TC042/TC045/TC046's own Outcome column are NOT independent rows for
// this sub-area (those TC numbers belong to entirely different areas -
// Vending/Market/Menu - confirmed via a fresh Excel read); the real
// distinct rows here are exactly TC039-TC043/TC045/TC046/TC051 (8 total).
test.describe('Start of The Day - Stop preview', () => {
  test(
    'view a stop\'s details, About this location, View schedule, and the pre-Start-Day service gate',
    {
      tag: [
        '@StartOfDay-TC039',
        '@StartOfDay-TC040',
        '@StartOfDay-TC041',
        '@StartOfDay-TC042',
        '@StartOfDay-TC043',
        '@StartOfDay-TC045',
        '@StartOfDay-TC046',
        '@StartOfDay-TC051'
      ]
    },
    async ({ driver }) => {
      const home = new HomeScreen(driver);
      const dashboard = new DashboardScreen(driver);

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      // TC039 "view stop details" / TC040 "view full address" - both live
      // on the same "Stop N of M" header alongside the stop name/address.
      await test.step('TC039/TC040: open a stop and verify its header details', async () => {
        await dashboard.clickLocationByName('CureLeaf');
        expect(await dashboard.isStopOverviewVisible()).toBe(true);
        const header = await dashboard.getStopHeaderText();
        expect(header.length).toBeGreaterThan(0);
        expect(await dashboard.isLobCardVisible('market')).toBe(true);
      });

      // TC041/TC042 "About this location" / "Close button" - opens a
      // sheet with the stop's name/address, dismissible back to Stop
      // Overview.
      await test.step('TC041/TC042: About this location opens and closes cleanly', async () => {
        await dashboard.openAboutThisLocation();
        expect(await dashboard.isAboutThisLocationVisible()).toBe(true);
        await dashboard.closeAboutThisLocation();
        expect(await dashboard.isStopOverviewVisible()).toBe(true);
      });

      // TC043 "View schedule" - live-verified: returns to Home/Schedule
      // overview, so re-open the stop afterward for the remaining steps.
      await test.step('TC043: View schedule returns to the Schedule overview', async () => {
        await dashboard.tapViewSchedule();
        expect(await home.isLoaded()).toBe(true);
        await dashboard.clickLocationByName('CureLeaf');
      });

      // TC045/TC046 "click on a service card / first task" - live-
      // verified: before Start Day is completed, expanding the LOB card
      // and tapping its station row shows a "Start day" gate popup
      // (Cancel/Start day) instead of a task list - the task-list outcome
      // needs Start Day already done, out of scope here.
      await test.step('TC045/TC046: opening a service station pre-Start-Day shows the Start day gate popup', async () => {
        await dashboard.openFirstServiceStation('market');
        expect(await dashboard.isStartDayGatePopupVisible()).toBe(true);
      });

      // TC051 "click on 'start day' button" - live-verified: navigates to
      // the Prep Task screen ("Start day, Route X").
      await test.step('TC051: confirming the gate popup navigates to the Prep Task screen', async () => {
        await dashboard.confirmStartDayFromGatePopup();
        expect(await home.isVisible('~Start day, Route 10')).toBe(true);
      });
    }
  );
});
