import { test, expect } from '../../fixtures/appium.fixture';
import { LoginScreen } from '../../screens/login.screen';
import { PasswordScreen } from '../../screens/password.screen';
import { MfaScreen } from '../../screens/mfa.screen';
import { HomeScreen } from '../../screens/home.screen';
import { RouteSetupScreen } from '../../screens/route-setup.screen';
import { SignOutScreen } from '../../screens/sign-out.screen';
import { mobileConfig } from '../../config/mobile.config';

test.describe('Login', () => {
  // Both tests below hand-roll their own login starting from
  // loginScreen.enterLoginId(), which assumes the app is on the logged-out
  // Login WebView already. That's only true when the fixture's pm-clear ran
  // (the default) - under KEEP_APP_SESSION=true, or simply if the app was
  // left authenticated from a prior run/session, the app resumes on native
  // Dashboard instead, and switchToWebView() then times out with "No
  // WEBVIEW context appeared" (live-verified 2026-08-07) since there's no
  // WebView to find. Rather than have this suite's correctness silently
  // depend on how it happens to be invoked, sign off first whenever already
  // authenticated - a real precondition check, not an assumption. Sign off
  // itself needs no MFA approval (only sign-IN does), so this costs nothing
  // extra when the precondition already holds.
  test.beforeEach(async ({ driver }) => {
    const home = new HomeScreen(driver);
    if (await home.isVisible('~Open navigation menu')) {
      const signOut = new SignOutScreen(driver);
      await signOut.step1_openNavigationMenu();
      await signOut.step2_signOff();
      await signOut.step3_signOff();
    }
  });

  // Traceability note: the title's "TC001-TC002" refers to the pre-
  // optimization Master sheet's original numbering (Android/iOS login
  // variants). The @Login-TC001 tag below is the Optimized sheet's own
  // TC001 (Login/Login, "I am able to login to Nexus application on
  // Android device") - Optimized_TCs_V_2.0.xlsx already merged the
  // original TC001-TC004 into that one row, so the two "TC001"s are
  // different IDs in different sheets, not the same test case. Tags are
  // area-qualified (@{Area}-TC{n}) suite-wide since the Excel reuses the
  // same TC number across unrelated areas (e.g. a separate Coffee TC001
  // exists too) - a bare @TC001 would have conflated the two.
  test(
    'TC001-TC002: user can log in with valid credentials and reach Home',
    { tag: ['@Login-TC001'] },
    async ({ driver }) => {
      const loginScreen = new LoginScreen(driver);
      const passwordScreen = new PasswordScreen(driver);
      const mfaScreen = new MfaScreen(driver);
      const homeScreen = new HomeScreen(driver);
      const routeSetup = new RouteSetupScreen(driver);

      await test.step('Enter Login ID and continue', async () => {
        await loginScreen.enterLoginId(process.env.TEST_LOGIN_ID ?? 'MPY01');
        await loginScreen.tapContinue();
      });

      await test.step('Enter password and sign in', async () => {
        await passwordScreen.enterPassword(process.env.TEST_PASSWORD ?? '');
        await passwordScreen.tapSignIn();
      });

      // 🔴 INTERIM: MFA (Authenticator push + number match + fingerprint) can't be automated
      // end-to-end - it requires manual approval on a separate physical device. Remove this
      // step once a dedicated QA test account with an MFA/Conditional-Access exclusion is
      // provisioned - at that point login should land on Home right after Sign in.
      //
      // CORRECTED (live-verified 2026-08-07): a genuinely cold/pm-cleared
      // account (this test's own starting state, since it doesn't use
      // loginAndWaitForMfa()'s KEEP_APP_SESSION skip) lands on the "Route
      // Setup Required" gate post-MFA, not Dashboard directly - the shared
      // utils/login-flow.ts helper already handles this; this test hand-
      // rolls its own login instead of using that helper (deliberately, to
      // exercise the raw screens directly), so it needs the same gate-
      // handling inlined here rather than assuming Dashboard unconditionally.
      await test.step('Wait for manual MFA approval (interim - see MfaScreen for context)', async () => {
        const postAuthScreen = await mfaScreen.waitForManualApproval();
        if (postAuthScreen === 'route-setup') {
          await routeSetup.changeRouteAndSelectDay(mobileConfig.defaultRoute);
        }
      });

      // Ported from dashboard_keywords.robot's "Validate user is on the dashboard
      // page" (test.robot's "Validate user is able to open the app") - RF ran this
      // as its own test case against an already-authenticated session; here it's
      // the natural final assertion of the one flow that actually reaches Dashboard.
      await test.step('Verify dashboard is loaded', async () => {
        await homeScreen.waitForDashboardLoaded();
      });
    }
  );

  // TC009 - a genuine RouteDriver persona account (TEST_LOGIN_ID_RouteDriver,
  // provisioned 2026-08-05) should NOT see "Route setup" under Settings, unlike
  // the shared MPY01 CSM account used everywhere else in this suite (which
  // live-verified DOES show it).
  //
  // NOTE (2026-08-07): .env's TEST_LOGIN_ID_RouteDriver was briefly swapped to
  // a different account (SekarS01) which DID show "Route setup", failing this
  // test - since reverted back to the originally-verified MaliS01. That was a
  // local env mixup, not a real app regression - flagging here only so a
  // future "TC009 suddenly fails" moment checks .env's actual value first.
  //
  // Scripted as the full required sequence (live-verified 2026-08-05, see
  // [[tc009_routedriver_account_blocker]]): logging into RouteDriver directly
  // from a cold app state hits a native "Route Setup Required - contact your
  // CSM" blocking dialog with no self-service path. The proven workaround
  // (Somnath's own suggestion) is to log in as the CSM persona FIRST in the
  // same app session, Sign off (NOT pm clear/app-data-clear - a real in-app
  // sign-off preserves whatever account-provisioning state avoids the
  // blocking dialog), THEN log in as RouteDriver - this lands cleanly on
  // RouteDriver's Dashboard every time. Both logins need their own manual MFA
  // approval (2 pushes total per run - a real, unavoidable wait, not a bug).
  //
  // Does NOT use loginAndWaitForMfa()'s KEEP_APP_SESSION/WEBVIEW-context skip
  // shortcut: live-verified 2026-08-05 that context detection is unreliable
  // once a single app process has rendered the Login WebView more than once
  // (exactly this CSM->RouteDriver sequence) - `driver.getContexts()` keeps
  // returning a WEBVIEW_* entry even while sitting on native Dashboard, long
  // past Login, causing a false "still on Login" conclusion. This test always
  // drives the full sequence explicitly instead.
  test(
    'TC009: RouteDriver persona does not see the Route setup option',
    { tag: ['@Login-TC009'] },
    async ({ driver }, testInfo) => {
      // Two manual MFA approvals in one run - generous timeout budget.
      testInfo.setTimeout(300_000);

      const loginScreen = new LoginScreen(driver);
      const passwordScreen = new PasswordScreen(driver);
      const mfaScreen = new MfaScreen(driver);
      const routeSetup = new RouteSetupScreen(driver);
      const signOut = new SignOutScreen(driver);

      await test.step('Log in as the CSM persona (MPY01)', async () => {
        await loginScreen.enterLoginId(process.env.TEST_LOGIN_ID ?? 'MPY01');
        await loginScreen.tapContinue();
        await passwordScreen.enterPassword(process.env.TEST_PASSWORD ?? '');
        await passwordScreen.tapSignIn();
        const postAuthScreen = await mfaScreen.waitForManualApproval();

        // A freshly-cleared account lands on the Route Setup gate instead of
        // Dashboard post-MFA - complete it so Sign off (which needs the
        // hamburger menu) is reachable.
        if (postAuthScreen === 'route-setup') {
          await routeSetup.changeRouteAndSelectDay(mobileConfig.defaultRoute);
        }
      });

      await test.step('Sign off the CSM persona (in-app sign off, not an app-data clear)', async () => {
        await signOut.step1_openNavigationMenu();
        await signOut.step2_signOff();
        await signOut.step3_signOff();
      });

      await test.step('Log in as the RouteDriver persona (MaliS01)', async () => {
        await loginScreen.enterLoginId(process.env.TEST_LOGIN_ID_RouteDriver ?? 'MaliS01');
        await loginScreen.tapContinue();
        await passwordScreen.enterPassword(process.env.TEST_PASSWORD_RouteDriver ?? '');
        await passwordScreen.tapSignIn();
        await mfaScreen.waitForManualApproval();
      });

      await test.step('TC009: Settings has no Route setup option for this persona', async () => {
        expect(await routeSetup.isRouteSetupOptionVisible()).toBe(false);
      });

      // Cleanup: this test would otherwise leave the session logged in as
      // RouteDriver, not the shared CSM persona (MPY01) every other test in
      // this suite assumes. Only matters for manual KEEP_APP_SESSION dev-runs
      // (real CI resets the app per test), but a KEEP_APP_SESSION test run
      // right after this one would otherwise silently continue as
      // RouteDriver. Costs a 3rd manual MFA approval.
      await test.step('Clean up: sign off RouteDriver and log back in as CSM', async () => {
        // The drawer + Settings section are already expanded here -
        // isRouteSetupOptionVisible() above leaves them that way (see its
        // own idempotency note) - tapping the hamburger again
        // (step1_openNavigationMenu) would CLOSE it instead of opening it,
        // so skip straight to Sign off.
        await signOut.step2_signOff();
        await signOut.step3_signOff();

        await loginScreen.enterLoginId(process.env.TEST_LOGIN_ID ?? 'MPY01');
        await loginScreen.tapContinue();
        await passwordScreen.enterPassword(process.env.TEST_PASSWORD ?? '');
        await passwordScreen.tapSignIn();
        await mfaScreen.waitForManualApproval();
      });
    }
  );
});
