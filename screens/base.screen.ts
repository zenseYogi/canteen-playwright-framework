import { execSync } from 'child_process';
import type { Browser } from 'webdriverio';
import { mobileConfig } from '../config/mobile.config';
import { positionToIndex, type Position } from '../utils/position';

export class BaseScreen {
  constructor(protected driver: Browser) {}

  // Shared, app-wide locators ported from the Robot Framework suite's
  // common.yaml / navigation_menu.yaml - identical across every screen there,
  // so they belong here once rather than redeclared per screen.
  protected readonly hamburgerIcon = '~Open navigation menu';
  protected readonly doneButton = '~Done';
  protected readonly continueButton = '~Continue';
  protected readonly skipButton = '~Skip';
  protected readonly saveButton = '~Save';
  protected readonly deleteButton = '~Delete';
  protected readonly yesButton = '~Yes';
  protected readonly addProductButton = '~section_header_add_cta';
  protected readonly takePhotoButton = '~Take photo';
  protected readonly attachPhotoButton = '~Attach Photo';
  // Generic EditText/ScrollView with no content-desc/resource-id of their own -
  // must stay xpath, no accessibility-id shorthand available for these.
  protected readonly searchField = '//android.widget.EditText';
  protected readonly searchList = '//android.widget.ScrollView/android.view.View/android.view.View';
  protected readonly cameraPermissionAllowButton =
    '//android.widget.Button[@resource-id="com.android.permissioncontroller:id/permission_allow_foreground_only_button"]';
  // Scrollable service-location list under a LOB tab (dashboard.yaml's
  // service_locations) - identical across coffee/market/vending_keywords.robot.
  protected readonly serviceLocations = "//android.view.View[@scrollable='true']";
  // common.yaml's Removals & Returns trigger + its four input fields - a true
  // common_keywords.robot keyword, shared by every LOB.
  protected readonly removalsAndReturns = '//android.view.View[starts-with(@content-desc,"Removals & Returns")]';
  protected readonly documentProductTitle = '~Document product';
  protected readonly removalsSpoiledField = '//android.widget.EditText[1]';
  protected readonly removalsDamagedField = '//android.widget.EditText[2]';
  protected readonly removalsTheftField = '//android.widget.EditText[3]';
  protected readonly removalsTruckReturnsField = '//android.widget.EditText[4]';
  protected readonly removalsSaveButton = '~Save';
  protected readonly removalsDoneButton = '~Done';
  // common.yaml's "delivery" trigger - identical usage in both
  // coffee_keywords.robot and market_keywords.robot.
  protected readonly deliveryTrigger = '//android.view.View[starts-with(@content-desc,"Delivery")]';
  // FRAGILE: deeply nested structural path with no stable identifier, ported
  // as-is from common.yaml. Re-verify against the current build before
  // relying on it - see docs/rf-to-playwright-reuse.md.
  protected readonly capturePhotoButton =
    '//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.View/android.view.View/android.view.View/android.view.View/android.view.View';

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

  /**
   * Opens the hamburger nav menu, taps the given menu item, and waits for
   * the destination screen's title to appear. Ported from the identical
   * hamburger -> nav item -> wait-for-title preamble duplicated at the top
   * of nearly every keyword in prep_task_keywords.robot, transfers.robot,
   * and both truck_stock_*.robot files.
   */
  async navigateTo(menuItemSelector: string, expectedTitleSelector: string): Promise<void> {
    await this.tap(this.hamburgerIcon);
    await this.waitFor(menuItemSelector);
    await this.tap(menuItemSelector);
    await this.waitFor(expectedTitleSelector);
  }

  /**
   * Types into the shared search field, resolves the option at `position`
   * (0-based, so 0 = first result - matches nearly every RF call site) from
   * the shared search results list, clicks it, and returns its display name
   * (the content-desc up to the first "-", trimmed) the way RF's
   * "Search for X and click on the Nth record" keyword did via
   * Get Element Attribute + Split String + Strip String.
   */
  async searchAndSelect(value: string, position = 0): Promise<string> {
    await this.tap(this.searchField);
    const field = await this.driver.$(this.searchField);
    await field.clearValue();
    await this.driver.pause(1000);
    await field.setValue(value);
    await this.driver.pause(2000);
    const options = await this.driver.$$(this.searchList);
    const option = options[position];
    await option.waitForDisplayed({ timeout: mobileConfig.timeouts.element });
    const fullName = (await option.getAttribute('content-desc')) ?? '';
    const name = fullName.split('-')[0].trim();
    await option.click();
    return name;
  }

  /** Selects every checkbox currently matched by `selector`. */
  async selectAllCheckboxes(selector: string): Promise<void> {
    const elements = await this.driver.$$(selector);
    for (const el of elements) {
      await el.click();
    }
  }

  /** Straight-line swipe via the W3C pointer Actions API (same primitive `tapAt` uses, extended with a move). */
  async swipe(startX: number, startY: number, endX: number, endY: number): Promise<void> {
    await this.driver
      .action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ x: startX, y: startY })
      .down()
      .pause(100)
      .move({ duration: 300, x: endX, y: endY })
      .up()
      .perform();
  }

  /**
   * Swipe-left-to-reveal-delete when the row's locator is already known
   * (transfers.robot / truck_stock_route_inventory.robot). Computes the
   * swipe path from the row's own location/size, same as RF's
   * Get Element Location + Get Element Size + Swipe.
   */
  async swipeAndDelete(rowSelector: string, deleteIconSelector: string): Promise<void> {
    const row = await this.driver.$(rowSelector);
    await row.waitForExist({ timeout: mobileConfig.timeouts.element });
    const loc = await row.getLocation();
    const size = await row.getSize();
    await this.swipe(loc.x + size.width - 10, loc.y + size.height / 2, loc.x + 10, loc.y + size.height / 2);
    await this.tap(deleteIconSelector);
    await this.tap(this.deleteButton);
  }

  /**
   * Swipe-left-to-reveal-delete when the row must first be found by
   * matching `label` against each element's `hint` attribute (ported from
   * truck_stock_truck_returns.robot's "Truck Returns swipe Left and click on
   * the delete button"). `deleteIconSelector` receives the matched index so
   * callers can build the sibling delete-icon locator from it.
   *
   * NOTE: the RF source computed the match index correctly but then never
   * used it - after the FOR ENUMERATE loop it built the delete-icon xpath
   * from the loop variable's leftover value (the *last* index iterated),
   * not the matched one. That only happened to work when the target was
   * the last item in the list. This port uses the actual matched index.
   */
  async swipeAndDeleteByLabel(
    listSelector: string,
    label: string,
    deleteIconSelector: (index: number) => string
  ): Promise<void> {
    const elements = await this.driver.$$(listSelector);
    const count = await elements.length;
    let matchIndex = -1;
    for (let i = 0; i < count; i++) {
      const hint = await elements[i].getAttribute('hint');
      if (hint && label.includes(hint)) {
        matchIndex = i;
        break;
      }
    }
    if (matchIndex === -1) {
      throw new Error(`No element under "${listSelector}" with a hint matching "${label}"`);
    }
    const row = elements[matchIndex];
    const loc = await row.getLocation();
    const size = await row.getSize();
    await this.swipe(loc.x + size.width - 10, loc.y + size.height / 2, loc.x + 10, loc.y + size.height / 2);
    await this.tap(deleteIconSelector(matchIndex));
    await this.tap(this.deleteButton);
  }

  /**
   * Taps a before/after-photo trigger, handles the optional first-run camera
   * permission dialog, then walks take -> capture -> attach. Ported from
   * common_keywords.robot's "Take before photo" / "Take After photo", which
   * used Run Keyword And Return Status to make the permission dialog
   * optional (it only appears on a fresh app install).
   */
  async capturePhoto(triggerSelector: string): Promise<void> {
    await this.tap(triggerSelector);
    if (await this.isVisible(this.cameraPermissionAllowButton)) {
      await this.tap(this.cameraPermissionAllowButton);
    }
    await this.tap(this.takePhotoButton);
    await this.tap(this.capturePhotoButton);
    await this.tap(this.attachPhotoButton);
  }

  /**
   * Scrolls the screen down via Appium's `mobile: scrollGesture` extension -
   * same call common_keywords.robot made through
   * `Call Method ${driver} execute_script mobile: scrollGesture ${args}`.
   * The RF source's `percent` value was cut off in the copy we received;
   * defaulting to 1.0 (a full-strength scroll) until confirmed against the
   * real device.
   */
  async scrollDown(opts: { left?: number; top?: number; width?: number; height?: number; percent?: number } = {}): Promise<void> {
    await this.driver.executeScript('mobile: scrollGesture', [
      {
        left: opts.left ?? 100,
        top: opts.top ?? 100,
        width: opts.width ?? 300,
        height: opts.height ?? 600,
        direction: 'down',
        percent: opts.percent ?? 1.0
      }
    ]);
  }

  /**
   * Clicks the Nth service location under a given LOB tab. Ported from the
   * identical "Click on the ${position} service location under X" keyword
   * duplicated once per LOB file (coffee_keywords.robot, market_keywords.robot,
   * vending_keywords.robot) - only the LOB icon selector differed between
   * them, so callers pass their own. Uses XPath's 1-based positional
   * predicate, matching RF's "set index based on position" (base 1) variant
   * that this specific keyword called - see utils/position.ts.
   */
  async selectServiceLocation(lobIconSelector: string, position: Position): Promise<void> {
    await this.waitFor(lobIconSelector);
    const index = positionToIndex(position, 1);
    await this.tap(`${this.serviceLocations}[${index}]`);
  }

  /** Android `Press Keycode` (e.g. 66 = Enter, to dismiss an IME/confirm a field) - AppiumLibrary's native command, not the ADB-shell workarounds used for the undebuggable WebView screens. */
  async pressKeyCode(keyCode: number): Promise<void> {
    await this.driver.pressKeyCode(keyCode);
  }

  /**
   * Ported from common_keywords.robot's "Perform Removals & Returns by
   * searching for X and clicking on the Nth record in the search list" -
   * search, open Document product, fill spoiled/damaged/theft/truck-returns,
   * save.
   *
   * NOTE: the RF source appended a stray literal "zs" to the theft value
   * (`Input Text ... ${theft value}zs`) - almost certainly a paste-o, not
   * intentional test data. Not reproduced here.
   */
  async performRemovalsAndReturns(
    searchTerm: string,
    values: { spoiled?: string; damaged?: string; theft?: string; truckReturns?: string } = {}
  ): Promise<void> {
    await this.tap(this.removalsAndReturns);
    await this.searchAndSelect(searchTerm);
    await this.waitFor(this.documentProductTitle);
    await this.type(this.removalsSpoiledField, values.spoiled ?? '0');
    await this.pressKeyCode(66);
    await this.type(this.removalsDamagedField, values.damaged ?? '0');
    await this.pressKeyCode(66);
    await this.type(this.removalsTheftField, values.theft ?? '0');
    await this.pressKeyCode(66);
    await this.type(this.removalsTruckReturnsField, values.truckReturns ?? '0');
    await this.pressKeyCode(66);
    await this.tap(this.removalsSaveButton);
    await this.waitFor(this.removalsDoneButton);
    await this.tap(this.removalsDoneButton);
  }
}