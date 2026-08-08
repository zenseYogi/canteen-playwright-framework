import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndWaitForMfa } from '../../utils/login-flow';
import { RouteSetupScreen } from '../../screens/route-setup.screen';
import { HomeScreen } from '../../screens/home.screen';
import { mobileConfig } from '../../config/mobile.config';

// Not an Excel-driven test case - Route Setup is an account/environment
// prerequisite (Settings > Route setup), not one of the Optimized TCs' LOB
// service flows. Written to unblock live verification of LOB service
// screens: a route/operation with real seeded stops is selected via
// config/mobile.config.ts's defaultRoute (currently Miami, FL / Route 010 /
// Today - BA-seeded Coffee data confirmed live).
//
// NOTE: loginAndWaitForMfa() now auto-completes Route Setup itself whenever
// a fresh/reset account lands on that gate post-MFA (see utils/login-flow.ts)
// - using this same defaultRoute. That means login here always lands on
// Dashboard already, never on the raw gate screen directly; this spec
// exercises the OTHER real entry point instead - deliberately re-opening
// Route Setup via Settings on an already-configured account (e.g. to switch
// to a different route) - exactly what a human tester would do, and what
// every other spec's shared login helper does NOT cover.
test.describe('Route Setup', () => {
  test(`change route to ${mobileConfig.defaultRoute.operationLabel} / ${mobileConfig.defaultRoute.routeLabel} and select ${mobileConfig.defaultRoute.day}`, async ({ driver }) => {
    const routeSetup = new RouteSetupScreen(driver);
    const home = new HomeScreen(driver);

    await test.step('Log in (lands on Dashboard - auto-handles the fresh-account gate if it appears)', async () => {
      await loginAndWaitForMfa(driver);
    });

    await test.step('Open Route Setup via Settings', async () => {
      await routeSetup.openFromHamburgerMenu();
    });

    await test.step('Change route, then select the configured day', async () => {
      await routeSetup.changeRouteAndSelectDay(mobileConfig.defaultRoute);
    });

    await test.step('Verify Dashboard reloaded with the selected day', async () => {
      await home.waitForDashboardLoaded();
      expect(await home.isLoaded()).toBe(true);
    });
  });
});
