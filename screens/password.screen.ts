import { BaseScreen } from './base.screen';

/**
 * Password screen - Microsoft Entra ID (Azure AD) sign-in page.
 *
 * Same undebuggable-WebView situation as LoginScreen (no
 * WebView.setWebContentsDebuggingEnabled on this build - see LoginScreen's
 * comment for the full reasoning), so this uses the same proven approach:
 * ADB-based tap + keyboard-visibility poll + ADB-based type, with the
 * keyboard explicitly dismissed before any fixed-percentage tap that was
 * calibrated against a keyboard-closed screenshot (confirmed necessary on
 * Login - without it, a tap meant for one button landed on an unrelated
 * link once the keyboard shifted the page layout).
 *
 * Percentages read off the actual Password screen screenshot.
 *
 * FRAGILE, same caveats as LoginScreen: breaks on any layout/screen-size/
 * OS change, no real locator to fall back on. Replace with real
 * `id=` selectors (i0118, idSIButton9, idA_PWD_ForgotPassword) the moment
 * WebView debugging is enabled.
 */
export class PasswordScreen extends BaseScreen {
  private static readonly PASSWORD_FIELD_Y_PCT = 0.211;
  private static readonly SIGN_IN_BUTTON_Y_PCT = 0.327;
  private static readonly FORGOT_PASSWORD_Y_PCT = 0.24;

  async enterPassword(password: string): Promise<void> {
    const { width, height } = await this.driver.getWindowSize();
    await this.tapViaAdb(width * 0.5, height * PasswordScreen.PASSWORD_FIELD_Y_PCT);
    await this.waitForKeyboardVisible();
    await this.driver.pause(1000);
    await this.typeViaAdb(password);
    await this.driver.pause(1000);
  }

  async tapSignIn(): Promise<void> {
    await this.hideKeyboardViaAdb();
    const { width, height } = await this.driver.getWindowSize();
    // Sign in sits on the right side of the screen, not centered - read
    // directly off the screenshot rather than assuming width * 0.5.
    await this.tapViaAdb(width * 0.81, height * PasswordScreen.SIGN_IN_BUTTON_Y_PCT);
  }

  async tapForgotPassword(): Promise<void> {
    await this.hideKeyboardViaAdb();
    const { width, height } = await this.driver.getWindowSize();
    // Also left-aligned, not centered.
    await this.tapViaAdb(width * 0.18, height * PasswordScreen.FORGOT_PASSWORD_Y_PCT);
  }
}