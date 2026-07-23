import type { Browser } from 'webdriverio';
import { LoginScreen } from '../screens/login.screen';
import { PasswordScreen } from '../screens/password.screen';
import { MfaScreen, type PostAuthScreen } from '../screens/mfa.screen';

/**
 * Runs the full Login -> Password -> interim MFA wait flow. Every RF keyword
 * we're porting assumes an already-authenticated session (RF's Suite Setup
 * just launches the app and lands straight on Dashboard); this Playwright
 * fixture instead clears app data before every single test (see
 * appium.fixture.ts), so every screen beyond Login needs this preamble run
 * first. Pulled out here so later phases don't each re-duplicate it.
 *
 * Returns which screen the app actually landed on post-MFA - a fresh account
 * (no route assigned yet) lands on the Route Setup gate instead of Dashboard.
 * Callers that need Dashboard must check this rather than assume it.
 */
export async function loginAndWaitForMfa(driver: Browser): Promise<PostAuthScreen> {
  const loginScreen = new LoginScreen(driver);
  const passwordScreen = new PasswordScreen(driver);
  const mfaScreen = new MfaScreen(driver);

  await loginScreen.enterLoginId(process.env.TEST_LOGIN_ID ?? 'MPY01');
  await loginScreen.tapContinue();
  await passwordScreen.enterPassword(process.env.TEST_PASSWORD ?? '');
  await passwordScreen.tapSignIn();
  // Interim: MFA (Authenticator push + number match + fingerprint) requires
  // manual approval on a separate physical device - see MfaScreen.
  return mfaScreen.waitForManualApproval();
}
