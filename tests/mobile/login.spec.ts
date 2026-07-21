import { test, expect } from '../../fixtures/appium.fixture';
import { LoginScreen } from '../../screens/login.screen';
import { PasswordScreen } from '../../screens/password.screen';
import { MfaScreen } from '../../screens/mfa.screen';
import { HomeScreen } from '../../screens/home.screen';

test.describe('Login', () => {
  test('TC001-TC002: user can log in with valid credentials and reach Home', async ({ driver }) => {
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

    await test.step('Verify Home screen is loaded', async () => {
      expect(await homeScreen.isLoaded()).toBe(true);
    });
  });
});
