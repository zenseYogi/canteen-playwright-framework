import { BaseScreen } from './base.screen';

/**
 * Login screen - TEMPORARY coordinate-based stopgap.
 *
 * The Login screen is a real android.webkit.WebView (confirmed via page
 * source dump), but this build has WebView remote debugging disabled -
 * confirmed via `adb shell cat /proc/net/unix | grep webview_devtools`
 * returning nothing on the device. Without that, Appium/chromedriver cannot
 * create a WEBVIEW context or see the WebView's DOM through any locator
 * strategy at all - this is a build configuration issue, not something
 * fixable from the test framework side. Raised with the Android build
 * owners to enable WebView.setWebContentsDebuggingEnabled(true) for this
 * build variant.
 *
 * Until that's enabled, this screen taps fixed screen positions (as a % of
 * window size, read off the actual Login screen screenshot) and types via
 * Appium's `mobile: type` extension, which sends text to whatever element
 * currently has focus rather than requiring a locatable element handle.
 *
 * FRAGILE: breaks on any layout change, different screen size/density, or
 * OS version - it has no real locator to fall back on. Replace with real
 * `id=` selectors (see the original WebView-context approach) the moment
 * WebView debugging is enabled. Do not build further screens/tests on top
 * of this coordinate approach - it's a bridge, not a pattern.
 */
export class LoginScreen extends BaseScreen {
  // Percentages read off the actual Login screen screenshot (device
  // getWindowSize() reports 1080x2400, matching this screenshot closely).
  // Previous estimates (0.24 / 0.365) were too far up the screen - closer
  // to the OMS logo than the actual field/button.
  private static readonly LOGIN_ID_FIELD_Y_PCT = 0.39;
  private static readonly CONTINUE_BUTTON_Y_PCT = 0.53;

  async enterLoginId(loginId: string): Promise<void> {
    const { width, height } = await this.driver.getWindowSize();
    // tapAt (Appium's W3C pointer action, via UiAutomator2) was confirmed
    // NOT to properly focus this WebView's field for typing purposes - a
    // manual test showed a real/adb-originated tap works but the scripted
    // equivalent doesn't. Using tapViaAdb instead, which goes through the
    // same OS-level path as that working manual test.
    await this.tapViaAdb(width * 0.5, height * LoginScreen.LOGIN_ID_FIELD_Y_PCT);
    // Poll for the actual keyboard/IME-shown signal rather than guessing a
    // fixed pause - the working manual test had a natural multi-second gap
    // between tap and typing that a flat 1000ms pause wasn't reproducing.
    await this.waitForKeyboardVisible();
    // Extra safety margin beyond the keyboard appearing - the WebView's
    // own JS-side focus handling may still lag slightly behind the IME.
    await this.driver.pause(1000);
    await this.typeViaAdb(loginId);
    // Give the WebView a moment to actually register the typed text before
    // Continue is tapped - confirmed via screenshot that tap+type alone
    // correctly lands the text at this point.
    await this.driver.pause(1000);
  }

  async tapContinue(): Promise<void> {
    // Dismiss the keyboard first - with it open, the page content shifts
    // to keep the focused field visible, so the same fixed percentage
    // coordinate (calibrated against a keyboard-closed screenshot) can
    // land on a different element entirely. Confirmed: without this, the
    // tap meant for Continue instead landed on a Privacy Policy link.
    await this.hideKeyboardViaAdb();
    const { width, height } = await this.driver.getWindowSize();
    await this.tapViaAdb(width * 0.5, height * LoginScreen.CONTINUE_BUTTON_Y_PCT);
  }
}