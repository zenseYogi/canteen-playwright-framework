import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndWaitForMfa } from '../../utils/login-flow';
import { RouteSetupScreen } from '../../screens/route-setup.screen';
import { HomeScreen } from '../../screens/home.screen';

// Not an Excel-driven test case - Route Setup is an account/environment
// prerequisite (Settings > Route setup), not one of the Optimized TCs' LOB
// service flows. Written to unblock live verification of LOB service
// screens: this account's Today route has 0 scheduled deliveries, so a
// route/operation with real seeded stops is selected instead (Charlotte, NC /
// Route 103, previously Miami, FL / Route 010 - see
// docs/rf-to-playwright-reuse.md's WebView debugging / build 0.1.76 section
// for the earlier route's confirmed stop data; Charlotte/103's stops are not
// yet independently documented).
//
// A fresh account (no route assigned yet) lands directly on the Route Setup
// gate right after MFA, with no Dashboard/hamburger menu accessible until
// it's completed - a different account state than one that's already set up,
// which lands on Dashboard and reaches Route Setup via Settings instead. This
// spec handles both: loginAndWaitForMfa() reports which screen actually
// appeared, and only opens the hamburger menu when that screen is Dashboard.
test.describe('Route Setup', () => {
  test('change route to Charlotte, NC / Route 103 and select Yesterday', async ({ driver }) => {
    const routeSetup = new RouteSetupScreen(driver);
    const home = new HomeScreen(driver);

    const postAuthScreen = await test.step('Log in', async () => {
      return loginAndWaitForMfa(driver);
    });

    await test.step('Reach Route Setup (via Settings, or already there on a fresh account)', async () => {
      if (postAuthScreen === 'dashboard') {
        await routeSetup.openFromHamburgerMenu();
      }
      // else: postAuthScreen === 'route-setup' - already on the gate screen, no navigation needed.
    });

    await test.step('Change route, then select Yesterday', async () => {
      await routeSetup.changeRouteAndSelectDay({
        operationSearch: 'Charlotte',
        operationLabel: 'Charlotte, NC',
        routeSearch: 'Route 103',
        routeLabel: 'Route 103',
        day: 'YESTERDAY'
      });
    });

    await test.step('Verify Dashboard reloaded with the selected day', async () => {
      await home.waitForDashboardLoaded();
      expect(await home.isLoaded()).toBe(true);
    });
  });
});
