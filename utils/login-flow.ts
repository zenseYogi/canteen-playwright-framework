import type { Browser } from 'webdriverio';
import { LoginScreen } from '../screens/login.screen';
import { PasswordScreen } from '../screens/password.screen';
import { MfaScreen } from '../screens/mfa.screen';
import { RouteSetupScreen, type DaySelection } from '../screens/route-setup.screen';
import { mobileConfig } from '../config/mobile.config';

// The route/day every spec expects to find real seeded data on - now
// parameterized via config/mobile.config.ts's defaultRoute (env-overridable:
// ROUTE_OPERATION_SEARCH/ROUTE_OPERATION_LABEL/ROUTE_SEARCH/ROUTE_LABEL/
// ROUTE_DAY) instead of hardcoded here, so switching the route in future is a
// config/env change, not a code change. Currently Miami, FL / Route 010 /
// Today (BA-seeded Coffee data confirmed live - see docs/rf-to-playwright-reuse.md).
const DEFAULT_ROUTE = mobileConfig.defaultRoute;

/**
 * Runs the full Login -> Password -> interim MFA wait flow, then guarantees
 * the caller lands on Dashboard - transparently completing Route Setup
 * first if that gate appears instead.
 *
 * Every RF keyword we're porting assumes an already-authenticated session
 * (RF's Suite Setup just launches the app and lands straight on Dashboard);
 * this Playwright fixture instead clears app data before every single test
 * (see appium.fixture.ts), so every screen beyond Login needs this preamble
 * run first. Pulled out here so later phases don't each re-duplicate it.
 *
 * A fresh/reset account (no route assigned yet, or one whose local app data
 * was just cleared) lands on the Route Setup gate post-MFA instead of
 * Dashboard, with no hamburger menu accessible until it's completed - this
 * was previously left for each spec to check and branch on individually
 * (see MfaScreen.waitForManualApproval's PostAuthScreen return), which is
 * exactly the failure mode reported when vending-service.spec.ts was run
 * without route-setup.spec.ts run first. Handling it once here means every
 * spec that calls this function can assume Dashboard unconditionally.
 */
export async function loginAndWaitForMfa(driver: Browser): Promise<void> {
  const loginScreen = new LoginScreen(driver);
  const passwordScreen = new PasswordScreen(driver);
  const mfaScreen = new MfaScreen(driver);

  // KEEP_APP_SESSION mode (see appium.fixture.ts): the app may already have
  // launched straight into a still-valid, previously-MFA-approved session -
  // possibly resuming mid-flow on whatever screen the previous test run
  // left it on (live-verified 2026-07-28: it can resume on Product Fills
  // with the numeric keypad still open), not necessarily Dashboard. A
  // hamburger-icon check is NOT reliable here - plenty of native screens
  // (like that keypad-open state) don't show it. Login/Password are the
  // only WebView-rendered screens in this app (everything past them is
  // native Flutter - see BaseScreen.switchToWebView's own note), so the
  // presence or absence of a WEBVIEW context is a clean, universal signal:
  // no WebView context at all means we've already skipped past Login
  // entirely, regardless of which native screen we've landed on.
  if (process.env.KEEP_APP_SESSION === 'true') {
    const contexts = await driver.getContexts();
    const onLoginWebview = contexts.some((c) => String(c).startsWith('WEBVIEW'));
    if (!onLoginWebview) {
      return;
    }
  }

  await loginScreen.enterLoginId(process.env.TEST_LOGIN_ID ?? 'MPY01');
  await loginScreen.tapContinue();
  await passwordScreen.enterPassword(process.env.TEST_PASSWORD ?? '');
  await passwordScreen.tapSignIn();
  // Interim: MFA (Authenticator push + number match + fingerprint) requires
  // manual approval on a separate physical device - see MfaScreen.
  const postAuthScreen = await mfaScreen.waitForManualApproval();

  if (postAuthScreen === 'route-setup') {
    const routeSetup = new RouteSetupScreen(driver);
    // Already on the gate screen - no navigation via Settings needed.
    await routeSetup.changeRouteAndSelectDay(DEFAULT_ROUTE);
  }
}

/**
 * Explicitly switches to a different route than the account's current one -
 * needed by specs whose LOB doesn't live on defaultRoute (confirmed
 * 2026-07-24: Vending's data is on Charlotte/103, not Miami/010, which
 * Market/Coffee use). Unlike loginAndWaitForMfa's post-MFA gate handling
 * (which only fires for a fresh/reset account and always applies
 * defaultRoute), this always navigates via Settings > Route setup and
 * always switches - correctness over speed, since an already-configured
 * account logging in lands straight on Dashboard on whatever route it was
 * last left on, with no reliable way to detect that route from the
 * Dashboard badge alone (not yet confirmed live). Call after
 * loginAndWaitForMfa(), which must run first to reach Dashboard/hamburger
 * menu access at all.
 */
export async function switchRoute(
  driver: Browser,
  route: { operationSearch: string; operationLabel: string; routeSearch: string; routeLabel: string; day: DaySelection }
): Promise<void> {
  const routeSetup = new RouteSetupScreen(driver);
  await routeSetup.openFromHamburgerMenu();
  await routeSetup.changeRouteAndSelectDay(route);
}
