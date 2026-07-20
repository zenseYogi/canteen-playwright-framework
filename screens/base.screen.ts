import { execSync } from 'child_process';
import type { Browser } from 'webdriverio';
import { mobileConfig } from '../config/mobile.config';

export class BaseScreen {
  constructor(protected driver: Browser) {}

  /**
   * Switches the session into the app's WebView context so that WebView-rendered
   * screens (e.g. the Login screen, which is an SSO page, not native Flutter) can
   * be located at all. Native `resource-id` xpath only ever searches the Android
   * native view hierarchy (NATIVE_APP context) - it has no visibility into a
   * WebView's DOM. Elements inside a WebView must be located by their HTML `id`
   * (via `id=` selector) or CSS, and only after switching into that WebView's
   * context. Without this switch, WebView elements never match no matter how
   * long you wait or how the locator is written - they're structurally invisible
   * from NATIVE_APP context.
   */
  async switchToWebView(): Promise<void> {
    await this.driver.waitUntil(
      async () => {
        const contexts = await this.driver.getContexts();
        return contexts.some((c) => String(c).startsWith('WEBVIEW'));
      },
      { timeout: mobileConfig.timeouts.element, timeoutMsg: 'No WEBVIEW context appeared' }
    );
    const contexts = await this.driver.getContexts();
    const webviewContext = contexts.find((c) => String(c).startsWith('WEBVIEW'));
    if (webviewContext) {
      await this.driver.switchContext(String(webviewContext));
    }
  }

  async switchToNative(): Promise<void> {
    await this.driver.switchContext('NATIVE_APP');
  }

  async tap(selector: string): Promise<void> {
    const el = await this.driver.$(selector);
    await el.waitForDisplayed({ timeout: mobileConfig.timeouts.element });
    await el.click();
  }

  async type(selector: string, text: string): Promise<void> {
    const el = await this.driver.$(selector);
    await el.waitForDisplayed({ timeout: mobileConfig.timeouts.element });
    await el.setValue(text);
  }

  async getText(selector: string): Promise<string> {
    const el = await this.driver.$(selector);
    await el.waitForDisplayed({ timeout: mobileConfig.timeouts.element });
    return el.getText();
  }

  async isVisible(selector: string): Promise<boolean> {
    const el = await this.driver.$(selector);
    return el.isDisplayed().catch(() => false);
  }

  async waitFor(selector: string): Promise<void> {
    const el = await this.driver.$(selector);
    await el.waitForDisplayed({ timeout: mobileConfig.timeouts.element });
  }

  /**
   * Polls the device directly for whether the on-screen keyboard/IME is
   * actually showing, instead of a fixed pause. The manual test that
   * confirmed tapViaAdb + typeViaAdb works had a natural multi-second gap
   * between the tap and typing the adb command by hand - our fixed 1000ms
   * pause may simply not be long enough for this WebView's IME handshake
   * to complete under an active Appium session. Polling the real signal
   * removes the guesswork.
   */
  async waitForKeyboardVisible(timeoutMs = 5000): Promise<void> {
    const deviceName = mobileConfig.capabilities['appium:deviceName'];
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const output = execSync(`adb -s ${deviceName} shell dumpsys input_method`).toString();
      if (/mInputShown=true/.test(output)) {
        return;
      }
      await this.driver.pause(200);
    }
    // Don't throw here - some devices/IME implementations may not report
    // this flag reliably. Fall through and let the caller's own pause/type
    // attempt proceed rather than hard-failing on a best-effort check.
  }

  /**
   * Dismisses the on-screen keyboard via the BACK key. Android intercepts
   * BACK to close an open IME first, without navigating the underlying
   * page, as long as a keyboard is actually showing. Needed before any
   * fixed-percentage tap (e.g. tapContinue) that was calibrated against a
   * keyboard-closed screenshot - with the keyboard open, the page content
   * is typically shifted/compressed to keep the focused field visible
   * above it, so the same percentage coordinate can land on a completely
   * different element (this was confirmed to happen: a tap meant for
   * Continue instead landed on a Privacy Policy link while the keyboard
   * was still open).
   */
  async hideKeyboardViaAdb(): Promise<void> {
    const deviceName = mobileConfig.capabilities['appium:deviceName'];
    execSync(`adb -s ${deviceName} shell input keyevent 4`);
    // Give the layout a moment to reflow back to its keyboard-closed state.
    await this.driver.pause(500);
  }

  /** Coordinate-based tap — used when a recorded step had no stable resource-id/text/content-desc locator. */
  async tapAt(x: number, y: number): Promise<void> {
    // driver.touchAction(...) is deprecated for this Appium/WebdriverIO
    // combination and was sending a GET request with a body (rejected by
    // the server as "Request with GET/HEAD method cannot have body").
    // The W3C Actions API is the supported replacement.
    await this.driver
      .action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ x, y })
      .down()
      .pause(50)
      .up()
      .perform();
  }

  /**
   * Taps via raw ADB input rather than Appium's W3C pointer Actions API.
   * A manual test isolated the actual failure: a real mouse-driven tap on
   * the emulator followed by `adb shell input text` worked immediately
   * (text appeared), but the scripted equivalent - Appium's W3C pointer
   * action (routed through UiAutomator2) followed by typeViaAdb - left the
   * field empty every time despite the cursor appearing to be present.
   * That isolates the problem to the tap, not the typing: UiAutomator2's
   * synthetic touch events aren't reaching this WebView's focus/IME
   * handling the way a genuine touch does. `adb shell input tap` goes
   * through the same OS-level path as the working manual test, bypassing
   * Appium's touch injection entirely.
   */
  async tapViaAdb(x: number, y: number): Promise<void> {
    const deviceName = mobileConfig.capabilities['appium:deviceName'];
    execSync(`adb -s ${deviceName} shell input tap ${Math.round(x)} ${Math.round(y)}`);
  }

  /**
   * Types text via raw ADB key input rather than Appium's `mobile: type`
   * extension. `mobile: type` sends text to the currently accessibility-
   * focused native element - it silently no-ops (still reports success)
   * when the focused field is inside this app's undebuggable WebView,
   * since that field never exposes itself as a native accessibility-
   * focused element. Confirmed via two screenshots showing a genuinely
   * focused field (blinking cursor, keyboard visible) that stayed
   * completely empty after mobile: type reported true both times.
   * `adb shell input text` instead simulates real OS-level key events,
   * which the visible on-screen keyboard actually relays to the WebView's
   * focused input the same way a real user's typing would.
   */
  async typeViaAdb(text: string): Promise<void> {
    const deviceName = mobileConfig.capabilities['appium:deviceName'];
    // adb's `input text` treats a literal space as a token separator, so
    // any space in the text must be escaped as %s.
    const escaped = String(text).replace(/ /g, '%s');
    execSync(`adb -s ${deviceName} shell input text "${escaped}"`);
  }
}