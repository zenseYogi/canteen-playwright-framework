import { test, expect } from '../../fixtures/appium.fixture';
import { LoginScreen } from '../../screens/login.screen';
import { PasswordScreen } from '../../screens/password.screen';
import { MfaScreen } from '../../screens/mfa.screen';
import { HomeScreen } from '../../screens/home.screen';
import { RouteSetupScreen } from '../../screens/route-setup.screen';
import { SignOutScreen } from '../../screens/sign-out.screen';
import { mobileConfig } from '../../config/mobile.config';

test.describe('Login', () => {
  
  test.beforeEach(async ({ driver }) => {
    const home = new HomeScreen(driver);
    if (await home.isVisible('~Open navigation menu')) {
      const signOut = new SignOutScreen(driver);
      await signOut.step1_openNavigationMenu();
      await signOut.step2_signOff();
      await signOut.step3_signOff();
    }
  });

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
        await loginScreen.enterLoginId(process.env.TEST_LOGIN_ID ?? 'CHIRIA02');
        await loginScreen.tapContinue();
      });

      await test.step('Enter password and sign in', async () => {
        await passwordScreen.enterPassword(process.env.TEST_PASSWORD ?? '');
        await passwordScreen.tapSignIn();
      });

      await test.step('Wait for manual MFA approval (interim - see MfaScreen for context)', async () => {
        const postAuthScreen = await mfaScreen.waitForManualApproval();
        if (postAuthScreen === 'route-setup') {
          await routeSetup.changeRouteAndSelectDay(mobileConfig.defaultRoute);
        }
      });

      await test.step('Verify dashboard is loaded', async () => {
        await homeScreen.waitForDashboardLoaded();
      });
    }
  );


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
