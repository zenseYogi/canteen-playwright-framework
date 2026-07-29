import { test } from '../../fixtures/appium.fixture';
import { LoginScreen } from '../../screens/login.screen';
import { PasswordScreen } from '../../screens/password.screen';
import { MfaScreen } from '../../screens/mfa.screen';
import { HomeScreen } from '../../screens/home.screen';

test.describe('Login', () => {
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
      await test.step('Wait for manual MFA approval (interim - see MfaScreen for context)', async () => {
        await mfaScreen.waitForManualApproval();
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
});
