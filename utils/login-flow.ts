import type { Browser } from 'webdriverio';
import { LoginScreen } from '../screens/login.screen';
import { PasswordScreen } from '../screens/password.screen';
import { MfaScreen } from '../screens/mfa.screen';
import { RouteSetupScreen, type DaySelection } from '../screens/route-setup.screen';
import { HomeScreen } from '../screens/home.screen';
import { AdhocDeliveryScreen } from '../screens/adhoc-delivery.screen';
import { DashboardScreen } from '../screens/dashboard.screen';
import { PrepTasksScreen } from '../screens/prep-tasks.screen';
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
export async function loginAndWaitForMfa(driver: Browser, loginId?: string, password?: string): Promise<void> {
  const loginScreen = new LoginScreen(driver);
  const passwordScreen = new PasswordScreen(driver);
  const mfaScreen = new MfaScreen(driver);

  // KEEP_APP_SESSION mode (see appium.fixture.ts): the app may already have
  // launched straight into a still-valid, previously-MFA-approved session -
  // possibly resuming mid-flow on whatever screen the previous test run
  // left it on (live-verified 2026-07-28: it can resume on Product Fills
  // with the numeric keypad still open), not necessarily Dashboard.
  //
  // Two signals, checked in order:
  // 1. Hamburger icon visible -> definitely past Login (native Dashboard or
  //    any screen with the drawer reachable) - skip immediately. Fast path,
  //    covers the common case.
  // 2. Otherwise, fall back to the WEBVIEW-context check (absence means
  //    already past Login even on a hamburger-less native screen, e.g. that
  //    keypad-open state).
  //
  // CORRECTED 2026-08-05: the WEBVIEW-context check ALONE is not reliable
  // once a single app process has rendered the Login WebView more than once
  // in its lifetime (e.g. logging in as one persona, signing off, then
  // logging in as another - see [[tc009_routedriver_account_blocker]]) -
  // `driver.getContexts()` keeps returning a WEBVIEW_* entry even while
  // sitting on native Dashboard, long past Login, causing a false "still on
  // Login" conclusion that then fails trying to type into a non-existent
  // #login-id field. Checking the hamburger icon first avoids this false
  // positive in the common case; the WEBVIEW fallback still covers the
  // original hamburger-less mid-flow scenario the check was written for.
  if (process.env.KEEP_APP_SESSION === 'true') {
    const onDashboard = await loginScreen.isVisible('~Open navigation menu');
    if (onDashboard) {
      return;
    }
    const contexts = await driver.getContexts();
    const onLoginWebview = contexts.some((c) => String(c).startsWith('WEBVIEW'));
    if (!onLoginWebview) {
      return;
    }
  }

  await loginScreen.enterLoginId(loginId ?? process.env.TEST_LOGIN_ID ?? 'MPY01');
  await loginScreen.tapContinue();
  await passwordScreen.enterPassword(password ?? process.env.TEST_PASSWORD ?? '');
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

/** "Route 010" / "Route 10" -> "10" - the Home badge drops the label's leading zeros, so comparisons must go through this rather than a raw string match. */
function routeNumber(text: string): string {
  const match = /\d+/.exec(text);
  return match ? String(parseInt(match[0], 10)) : '';
}

/**
 * Whether the app is currently sitting on the given route/day, per Home's
 * own badges (HomeScreen.getRouteBadgeText()/getCurrentDateText()) -
 * live-verified 2026-08-06 (build 0.1.76): reads "Route 10" / "Today, Thu 6
 * Aug" reliably, resolving the "not yet confirmed live" caveat switchRoute's
 * own doc comment used to carry. Assumes Dashboard is already reached (call
 * after loginAndWaitForMfa).
 *
 * CORRECTED 2026-08-09 (live-verified): a route's badge only ever renders a
 * real number once at least one delivery exists on it - confirmed by adding
 * a throwaway delivery to Route 103 (blank "Route " immediately became
 * "Route 103"). This left ensureOnRoute() unable to ever skip a redundant
 * switch for Miami/Route 001 (config/mobile.config.ts's emptyRoute) - the
 * ONE route in this framework guaranteed to always have 0 deliveries BY
 * DESIGN (it's the whole reason TC025/TC028 use it) - since its badge
 * stays permanently blank. Falls back to checking "0 deliveries" as the
 * confirming signal, but ONLY for emptyRoute specifically - deliberately
 * NOT generalized to "any route currently showing 0 deliveries", since
 * e.g. Route 103's blank/0-delivery state is an incidental DATA GAP (see
 * [[market_coffee_vending_p1_status]]), not a guaranteed invariant;
 * treating that as "confirmed" too could silently leave the app on the
 * wrong route if two blank-badge routes were ever compared.
 */
// async function isOnRoute(
//   driver: Browser,
//   route: { routeLabel: string; day: DaySelection }
// ): Promise<boolean> {
//   const home = new HomeScreen(driver);
//   const [routeText, dateText] = await Promise.all([home.getRouteBadgeText(), home.getCurrentDateText()]);
//   const currentDayPrefix = dateText.split(',')[0]?.trim().toUpperCase();
//   if (currentDayPrefix !== route.day) {
//     return false;
//   }
//   const currentRoute = routeNumber(routeText);
//   const targetRoute = routeNumber(route.routeLabel);
//   if (currentRoute !== '') {
//     return currentRoute === targetRoute;
//   }
//   if (targetRoute === routeNumber(mobileConfig.emptyRoute.routeLabel)) {
//     return (await home.getDeliveriesCount()) === 0;
//   }
//   return false;
// }


async function isOnRoute(
  driver: Browser,
  route: { routeLabel: string; day: DaySelection }
): Promise<boolean> {
  const home = new HomeScreen(driver);

  const [routeText, dateText] = await Promise.all([
    home.getRouteBadgeText(),
    home.getCurrentDateText(),
  ]);

  console.log(`Route Badge: ${routeText}`);
  console.log(`Date Text: ${dateText}`);
  console.log(`Target Route: ${route.routeLabel}`);
  console.log(`Target Day: ${route.day}`);

  // Route validation
  const currentRoute = routeNumber(routeText).trim();
  const targetRoute = routeNumber(route.routeLabel).trim();
  console.log(`Current Route: ${currentRoute}`);
  console.log(`Expected Route: ${targetRoute}`);
  if (currentRoute !== targetRoute) {
    return false;
  }
  // Day validation
  const appDate = new Date(dateText.replace(',', ', '));
  const expectedDate = new Date();
  switch (route.day) {
    case 'YESTERDAY':
      expectedDate.setDate(expectedDate.getDate() - 1);
      break;
    case 'TOMORROW':
      expectedDate.setDate(expectedDate.getDate() + 1);
      break;
    case 'TODAY':
    default:
      break;
  }
  console.log(`App Date: ${appDate.toDateString()}`);
  console.log(`Expected Date: ${expectedDate.toDateString()}`);
  return (
    appDate.getDate() === expectedDate.getDate() &&
    appDate.getMonth() === expectedDate.getMonth() &&
    appDate.getFullYear() === expectedDate.getFullYear()
  );
}

/**
 * Re-asserts (and re-switches if needed) the given route/day - a defensive
 * guard for callers that repeatedly call HomeScreen.returnToHome() while
 * working a non-TODAY day (e.g. end-day.spec.ts's own skip/complete loop,
 * one returnToHome() per stop). Live-verified 2026-08-07: returnToHome()'s
 * hardware-BACK fallback (used when a screen has no hamburger icon yet,
 * forcing several BACK presses before the hamburger-driven "Schedule
 * overview" path even starts) can silently land back on TODAY instead of
 * whatever day was previously selected - confirmed by contrast: hamburger
 * menu -> "Schedule overview" alone (no preceding hardware BACK presses)
 * reliably preserves the selected day. Call this after any returnToHome()
 * where staying on a specific day matters, not just reaching Dashboard.
 */
export async function ensureOnRoute(
  driver: Browser,
  route: { operationSearch: string; operationLabel: string; routeSearch: string; routeLabel: string; day: DaySelection }
): Promise<void> {
  if (await isOnRoute(driver, route)) {
    return;
  }
  await switchRoute(driver, route);
}

/**
 * Combines loginAndWaitForMfa + switchRoute, but skips the (comparatively
 * expensive) Settings > Route setup navigation entirely when a resumed
 * KEEP_APP_SESSION session is already sitting on the requested route/day -
 * switchRoute alone always re-navigated regardless, which was correct but
 * wasteful once a spec run leaves the app already parked on the route the
 * next spec also wants.
 *
 * CORRECTED (live-verified 2026-08-06): isOnRoute's badges only exist on
 * Home, but loginAndWaitForMfa's KEEP_APP_SESSION fast path can resume on
 * ANY screen with the hamburger reachable (its own doc comment's example:
 * mid-flow on Product Fills with a keypad open) - NOT necessarily Home.
 * Reading the badges straight after it threw a real "element not found"
 * here rather than a false route mismatch. Routes through
 * HomeScreen.returnToHome() first so the badges are always actually there
 * to read, whichever screen the session resumed on.
 */
export async function loginAndEnsureRoute(
  driver: Browser,
  route: { operationSearch: string; operationLabel: string; routeSearch: string; routeLabel: string; day: DaySelection },
  loginId?: string,
  password?: string
): Promise<void> {
  await loginAndWaitForMfa(driver, loginId, password);
  const home = new HomeScreen(driver);
  await home.returnToHome();
  if (await isOnRoute(driver, route)) {
    return;
  }
  await switchRoute(driver, route);
}

/**
 * For tests that need a genuinely FRESH (not-yet-Start-Day-completed) Prep
 * Tasks screen, not just a reachable one - e.g. TC198's back-press-popup
 * test and TC075/080/110's Add Product test, both of which need live
 * category tiles to interact with. Start Day completion is server-tracked
 * per route/day and one-way - once any test (in this file or another)
 * completes it for a given day, there's no in-app action that un-completes
 * it. Tries TODAY first (real, current data); only falls back to TOMORROW
 * (untouched by anything that's run today) if TODAY already turns out to
 * be complete. Leaves the caller with Prep Tasks open on the fresh day, so
 * a subsequent openFromHamburgerMenu() call is a harmless no-op re-open.
 */
export async function loginToFreshStartDayRoute(
  driver: Browser,
  baseRoute: { operationSearch: string; operationLabel: string; routeSearch: string; routeLabel: string },
  loginId?: string,
  password?: string
): Promise<void> {
  const prepTasks = new PrepTasksScreen(driver);
  await loginAndEnsureRoute(driver, { ...baseRoute, day: 'TODAY' }, loginId, password);
  await prepTasks.openFromHamburgerMenu();
  if (!(await prepTasks.isStartDayAlreadyComplete())) {
    return;
  }
  await loginAndEnsureRoute(driver, { ...baseRoute, day: 'TOMORROW' }, loginId, password);
  // TOMORROW can independently have ZERO deliveries seeded at all (live-
  // verified 2026-08-07 on Charlotte/103: "0 Delivery", Start day disabled,
  // no category tiles ever render regardless of completion state) - a
  // genuinely different problem from "already complete" above, and Prep
  // Tasks alone can't fix it (there's nothing to open). Bootstraps ONE
  // ad-hoc delivery first so there's something for Start Day to run
  // against, same "create only if truly missing" principle as
  // MarketServiceScreen.ensureFillableProductsExist.
  await ensureAnyDeliveryExistsToday(driver);
  // A day that has NEVER had Start Day initiated (this bootstrap path only
  // runs for a day that had zero deliveries a moment ago) isn't reachable
  // via the hamburger menu's Prep Task nav item at all yet - live-verified
  // 2026-08-07: openFromHamburgerMenu() bounced straight back to Dashboard
  // every time, no matter how many retries. Prep Tasks only becomes a real
  // nav destination after Dashboard's OWN "Start day" button is tapped
  // once (see HomeScreen.tapStartDay()/PrepTasksScreen.
  // waitForOpenedFromDashboard() - the same distinction RF's "...from
  // dashboard" keyword already drew). Every other route/day this file
  // touches already had Start Day initiated at least once historically
  // (real seeded data), which is why openFromHamburgerMenu() alone was
  // sufficient everywhere else.
  const home = new HomeScreen(driver);
  await home.tapStartDay();
  await prepTasks.waitForOpenedFromDashboard();
  // Lands on Prep Tasks' OWN pre-screen ("Start day, Route X" heading, no
  // tiles yet, its own separate "Start day" CTA) - a SECOND, distinct
  // Start Day gate one level in from Dashboard's own button just tapped
  // above. Tapping it here is what actually reveals the four category
  // tiles for a day that's never been started (see
  // PrepTasksScreen.tapStartDayButton's own doc comment).
  await prepTasks.tapStartDayButton();
  if (await prepTasks.isStartDayAlreadyComplete()) {
    throw new Error('loginToFreshStartDayRoute: Prep Tasks tiles never appeared after bootstrapping a delivery');
  }
}

/**
 * Guarantees the CURRENT day has at least one delivery, bootstrapping one
 * via the real Add Delivery flow when it's genuinely empty - but only then
 * (never duplicates onto a day that already has data). Doesn't target any
 * specific account/service/LOB: searches broadly ("a", which live-verified
 * 2026-08-07 always matches something in this environment's account list)
 * and takes whichever account/service comes first - the goal is just
 * unblocking Start Day for tests that don't care which account it is, not
 * seeding a specific scenario. Assumes Home/Dashboard is already reached.
 */
export async function ensureAnyDeliveryExistsToday(driver: Browser): Promise<void> {
  const home = new HomeScreen(driver);
  if (!(await home.isDeliveriesEmptyStateVisible())) {
    return;
  }
  await home.openAdhocDeliveryCreation();
  const adhoc = new AdhocDeliveryScreen(driver);
  await adhoc.searchCustomer('a');
  await adhoc.selectFirstSearchedCustomer();
  await adhoc.selectFirstServiceAnyLob();
  await adhoc.selectServiceType('FULL');
  await adhoc.submitAddDelivery();
  await home.returnToHome();
}

/**
 * Unconditionally bootstraps ONE new Market delivery via the real Add
 * Delivery flow, against whichever account the broad "a" search happens
 * to surface first. Unlike ensureAnyDeliveryExistsToday, this is NOT
 * gated on the day being empty - it's for the opposite case: a day that
 * already has real deliveries, but none with a pending Market station
 * left to skip (e.g. end-day.spec.ts's own TC002-004 test, once an
 * earlier run already skipped every Market stop for the day). Callers
 * decide when to call this (e.g. after confirming zero pending Market
 * stops), since calling it unconditionally would just keep piling on
 * duplicate deliveries. Assumes Home/Dashboard is already reached.
 */
export async function ensureFreshMarketDeliveryExists(driver: Browser): Promise<void> {
  const home = new HomeScreen(driver);
  await home.openAdhocDeliveryCreation();
  const adhoc = new AdhocDeliveryScreen(driver);
  await adhoc.searchCustomer('a');
  await adhoc.selectFirstSearchedCustomer();
  await adhoc.selectFirstMarketService();
  await adhoc.selectServiceType('FULL');
  await adhoc.submitAddDelivery();
  await home.returnToHome();
}

/**
 * Precondition for any Coffee LOB test: guarantees the GIVEN account's stop
 * (not just some stop on today's route) has a Coffee delivery, ad-hoc-
 * scheduling one against it if it doesn't. Live-verified 2026-08-06 (build
 * 0.1.76, Route 10/TODAY, a day seeded with Market-only accounts): Home's
 * LOB badges (HomeScreen.getLobCounts()) had no "coffee" key at all, and
 * there was no in-app "create a new Coffee account" screen - but the
 * existing Add Delivery flow's Service picker lists every service station
 * across every account tagged by LOB, where Coffee's tag is "OCS/Pantry"
 * (Office Coffee Service), confirmed by submitting one against the given
 * account and watching Home's LOB badges gain a Coffee entry.
 *
 * CORRECTED (live-verified 2026-08-06): checking the aggregate
 * HomeScreen.getLobCounts() (as this used to) is NOT sufficient - it
 * returns "coffee" truthy as soon as ANY stop on the route has one, which
 * silently skipped adding it to the given account when an unrelated
 * account had independently gained a Coffee stop of its own (observed
 * live: a "White & Case LLP" stop neither this function nor any test in
 * this file created still satisfied the old aggregate check, leaving
 * FedEx itself Market-only and every test that opens FedEx expecting
 * Coffee failing). Now opens the given account's OWN location and checks
 * its OWN LOB cards instead.
 */
export async function ensureCoffeeDeliveryExists(driver: Browser, accountName: string): Promise<void> {
  const home = new HomeScreen(driver);
  const dashboard = new DashboardScreen(driver);
  await dashboard.clickLocationByName(accountName);
  const hasCoffee = await dashboard.isLobCardVisible('coffee');
  await home.returnToHome();
  if (hasCoffee) {
    return;
  }
  await home.openAdhocDeliveryCreation();
  const adhocDelivery = new AdhocDeliveryScreen(driver);
  await adhocDelivery.searchCustomer(accountName);
  await adhocDelivery.selectCustomer(accountName);
  await adhocDelivery.selectFirstCoffeeService();
  await adhocDelivery.selectServiceType('FULL');
  await adhocDelivery.submitAddDelivery();
}
