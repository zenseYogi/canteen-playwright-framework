import { execSync } from 'child_process';
import type { Browser } from 'webdriverio';
import { mobileConfig } from '../config/mobile.config';
import { positionToIndex, type Position } from '../utils/position';
import type { Lob } from '../utils/lob';

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
  protected readonly noButton = '~No';
  protected readonly addProductButton = '~section_header_add_cta';
  protected readonly takePhotoButton = '~Take photo';
  protected readonly attachPhotoButton = '~Attach Photo';
  // Before/After Photos' "skip photo" sub-flow - live-verified 2026-07-27 on
  // a Coffee LOB service stop (Route 10/TODAY), reached via the service
  // stop checklist's "Before Photos" tile. Genuinely shared across LOBs -
  // the Excel documents the identical pattern separately for Market's
  // "Before Photo"/"After Photo" and Coffee's "After Photo"/"Completing an
  // equipment audit" sub-areas, all with the same wording - so this lives
  // here rather than duplicated per LOB screen (same reasoning as
  // removalsAndReturns below).
  //
  // CORRECTED: the reason-sheet's submit control shares its content-desc
  // ("Skip photo") with a plain, always-enabled android.view.View that's
  // just the sheet's own title text - a bare `~Skip photo` accessibility-id
  // selector resolves to whichever matches first and can silently grab the
  // title instead of the button, making an actually-disabled submit button
  // read as enabled. Scoped to the Button class specifically to avoid that.
  protected readonly skipPhotoModalTitle = '~Add supporting photo';
  protected readonly skipPhotoButton = '//android.widget.Button[@content-desc="Skip photo"]';
  // CORRECTED (live-verified 2026-07-28, Market's own equivalent flow):
  // once the field has been typed into and cleared once, its `hint`
  // attribute stops being the exact string "Reason to skip photo" - it
  // accumulates the previously-entered text as a second line ("Reason to
  // skip photo\nCamera can't focus..."), presumably a restore-suggestion
  // shown alongside the real placeholder. An exact-match selector then
  // finds zero elements even though the field is genuinely still on
  // screen - this is what looked like intermittent "not found" flakiness
  // in enterSkipPhotoReason() across several runs, but is actually a real,
  // reproducible state change. starts-with is stable across both the
  // pristine and post-clear states.
  protected readonly skipPhotoReasonField = '//android.widget.EditText[starts-with(@hint,"Reason to skip photo")]';
  // Generic EditText/ScrollView with no content-desc/resource-id of their own -
  // must stay xpath, no accessibility-id shorthand available for these.
  protected readonly searchField = '//android.widget.EditText';
  protected readonly searchList = '//android.widget.ScrollView/android.view.View/android.view.View';
  protected readonly cameraPermissionAllowButton =
    '//android.widget.Button[@resource-id="com.android.permissioncontroller:id/permission_allow_foreground_only_button"]';
  // Product-list header controls (Sort/Filter/Planogram) - live-verified on
  // Vending's Product fills screen; same content-desc IDs were already
  // spotted (but never used) during Market's live verification, so these
  // are a genuinely shared, LOB-agnostic component, not Vending-specific.
  // Both Sort and Filter render as an android.widget.Switch whose `checked`
  // attribute flips to true once a selection is applied - the real signal
  // for "is a sort/filter currently active", not just visibility.
  protected readonly sortCta = '~section_header_sort_cta';
  protected readonly filterCta = '~section_header_filter_cta';
  protected readonly planogramCta = '~section_header_planogram_cta';
  // Date/route pill shown at the top of nearly every in-app screen once
  // past login (Prep Tasks, Money Operations, Product Collection, Market's
  // Product fills, service-stop checklists, ...) - hoisted here from
  // PrepTasksScreen (originally added for TC169) once MarketServiceScreen
  // needed the identical component (TC092). The date renders as a bare
  // absolute-date string ("27 Jul 2026", not "Today"/"Yesterday" like the
  // Dashboard's own badge - see HomeScreen's currentDateBadge, which
  // wouldn't match here), immediately followed by the route pill
  // ("Route 10"). Located relative to the route pill (stable starts-with
  // match) since the date string itself has no fixed prefix to anchor on.
  protected readonly headerRouteBadge = '//android.view.View[starts-with(@content-desc,"Route")]';
  protected readonly headerDateBadge = `${this.headerRouteBadge}/preceding-sibling::android.view.View[1]`;

  async isDateRouteHeaderVisible(): Promise<{ date: boolean; route: boolean }> {
    return {
      date: await this.isVisible(this.headerDateBadge),
      route: await this.isVisible(this.headerRouteBadge)
    };
  }
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
  // Declared identically in both transfers.yaml and truck_stock.yaml - used
  // by TruckStockTruckReturnsScreen, TransfersScreen, and
  // TruckStockRouteInventoryScreen alike.
  protected readonly coffeeTab = '//android.view.View[@content-desc="Coffee"]';
  protected readonly marketTab = '//android.view.View[@content-desc="Market"]';
  protected readonly vendingTab = '//android.view.View[@content-desc="Vending"]';
  // FRAGILE: deeply nested structural path with no stable identifier, ported
  // as-is from common.yaml. Re-verify against the current build. NOTE: this
  // is NOT the same locator as transfers.yaml's transfer_to_screen_back_button
  // (a bare, generic //android.widget.Button) despite the similar name and
  // purpose - the original port-plan doc's hygiene section incorrectly
  // treated them as duplicates; corrected there.
  protected readonly backButton =
    '//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.View/android.view.View/android.view.View/android.view.View/android.widget.Button[1]';

  protected lobTabSelector(lob: Lob): string {
    return { coffee: this.coffeeTab, market: this.marketTab, vending: this.vendingTab }[lob];
  }

  // dashboard.yaml's start_day_button and prep_tasks.yaml's
  // prep_task_start_day_button are the exact same xpath under two names -
  // used by both HomeScreen (Dashboard) and PrepTasksScreen.
  protected readonly startDayButton = '//android.widget.Button[@content-desc="Start day"]';

  // navigation_menu.yaml's collapsible "Truck stock" group toggle - needed
  // by TruckStockTruckReturnsScreen, TruckStockRouteInventoryScreen, and
  // TruckStockRouteShoppingScreen alike to expand the group before its first
  // navigation in a fresh session (see TruckStockTruckReturnsScreen's open()
  // for why every Playwright test needs this, unlike RF's suite-shared session).
  protected readonly navMenuTruckStockCollapsed = '//android.view.View[@content-desc="Truck stock, Collapsed"]';

  /**
   * `record_to_delete_xpath` / `route_inventory_record_to_delete_xpath` -
   * declared identically (down to the xpath itself) in both transfers.yaml
   * and truck_stock.yaml.
   */
  protected recordByHint(name: string): string {
    return `//android.widget.EditText[contains(@hint,"${name}")]`;
  }
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

  async tap(selector: string, timeoutMs = mobileConfig.timeouts.element): Promise<void> {
    const el = await this.driver.$(selector);
    await el.waitForDisplayed({ timeout: timeoutMs });
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

  /** Element's enabled/disabled state - distinct from isVisible/isDisplayed. Needed for the Excel test suite's many "Continue/Add disabled until X" assertions, which RF never tested. */
  async isEnabled(selector: string): Promise<boolean> {
    const el = await this.driver.$(selector);
    return el.isEnabled().catch(() => false);
  }

  /**
   * The `hint` of whichever on-screen EditText currently has input focus, or
   * null if none does - used for TC102/103-style "did focus move to the
   * right field after tapping a custom keyboard's Up/Down arrow" assertions,
   * where there's no other way to tell which field is now active.
   */
  async getFocusedFieldHint(): Promise<string | null> {
    const fields = await this.driver.$$('//android.widget.EditText');
    for (const field of fields) {
      const focused = await field.getAttribute('focused').catch(() => 'false');
      if (focused === 'true') {
        return field.getAttribute('hint');
      }
    }
    return null;
  }

  async waitFor(selector: string): Promise<void> {
    const el = await this.driver.$(selector);
    await el.waitForDisplayed({ timeout: mobileConfig.timeouts.element });
  }

  /**
   * Whether a checkable element (the Sort/Filter header Switches, live-
   * verified) is in its "active/applied" state - the real `checked`
   * attribute, not just visibility (both Switches are always visible;
   * `checked` is what actually flips on selection).
   */
  async isChecked(selector: string): Promise<boolean> {
    const el = await this.driver.$(selector);
    return (await el.getAttribute('checked').catch(() => 'false')) === 'true';
  }

  /**
   * Opens the shared Sort-by sheet (Product fills header's sort_cta),
   * taps the named option (e.g. "A to Z"), and returns once the sheet
   * closes. Live-verified on Vending: selecting an option both re-orders
   * the list and flips section_header_sort_cta's `checked` to true.
   */
  async selectSortOption(optionLabel: string): Promise<void> {
    await this.tap(this.sortCta);
    await this.tap(`~${optionLabel}`);
  }

  async isSortActive(): Promise<boolean> {
    return this.isChecked(this.sortCta);
  }

  /**
   * Excel TC180-TC209 (Market "Delivery - Sort" sub-area) - lower-level
   * Sort-sheet building blocks, alongside selectSortOption above. Live-
   * verified on Market (build 0.1.76): the sheet's title is "Sort by" and
   * it lists FIVE options - "A to Z", "Z to A", "By Category", "Newest
   * First", "Oldest First" - not the Excel's claimed four options nor its
   * "Barcode Ascending"/"Barcode Descending" (neither exists in this
   * build). There is also no separate "Apply sort order" button at all -
   * tapping ANY option applies it immediately and closes the sheet in one
   * step (matching selectSortOption's own already-proven behavior); only
   * "Clear sort order" exists as its own button, disabled with no sort
   * currently active and enabled once one is.
   */
  protected readonly sortSheetTitle = '~Sort by';
  protected readonly clearSortButton = '~Clear sort order';

  async openSortSheet(): Promise<void> {
    await this.tap(this.sortCta);
  }

  async isSortSheetTitleVisible(): Promise<boolean> {
    return this.isVisible(this.sortSheetTitle);
  }

  async isSortOptionVisible(optionLabel: string): Promise<boolean> {
    return this.isVisible(`~${optionLabel}`);
  }

  async isClearSortEnabled(): Promise<boolean> {
    return this.isEnabled(this.clearSortButton);
  }

  async tapClearSort(): Promise<void> {
    await this.tap(this.clearSortButton);
  }

  /**
   * Opens the shared Filter sheet, taps the named category chip(s), then
   * Apply filters. Live-verified on Vending: selecting a chip enables both
   * Clear filters and Apply filters (disabled with zero chips selected),
   * and applying flips section_header_filter_cta's `checked` to true and
   * adds a removable "<name> x" chip above the list.
   */
  async selectFilterCategories(categoryLabels: string[]): Promise<void> {
    await this.tap(this.filterCta);
    for (const label of categoryLabels) {
      await this.tap(`~${label}`);
    }
    await this.tap('~Apply filters');
  }

  async isFilterActive(): Promise<boolean> {
    return this.isChecked(this.filterCta);
  }

  /**
   * Lower-level filter-sheet building blocks (Excel TC116-TC122, Market's
   * "Delivery - Filters" sub-area) - unlike selectFilterCategories/
   * selectFilterCategoryByPrefix above (which drive the whole open->select
   * ->Apply flow in one call), these expose each step separately so a test
   * can assert the sheet's intermediate states (chip selected/deselected,
   * Apply/Clear enabled/disabled) along the way. Live-verified on Market
   * (build 0.1.76, CuraLeaf stop): only a single "By category" tab exists
   * (no "By product group" tab - see market-fill-screen.spec.ts's own note,
   * confirmed obsolete by BA/QA), chips are plain Buttons whose `selected`
   * attribute (NOT `checked` - that's the header filter_cta's own toggle)
   * flips true/false per tap, and both Apply filters/Clear filters start
   * `enabled="false"` with zero chips selected.
   */
  protected readonly filterByCategoryLabel = '~By category';
  protected readonly applyFiltersButton = '~Apply filters';
  protected readonly clearFiltersButton = '~Clear filters';

  async openFilterSheet(): Promise<void> {
    await this.tap(this.filterCta);
  }

  async isFilterByCategoryLabelVisible(): Promise<boolean> {
    return this.isVisible(this.filterByCategoryLabel);
  }

  private filterChipSelector(labelPrefix: string): string {
    return `//android.widget.Button[starts-with(@content-desc,"${labelPrefix}")]`;
  }

  async tapFilterChip(labelPrefix: string): Promise<void> {
    await this.tap(this.filterChipSelector(labelPrefix));
  }

  async isFilterChipVisible(labelPrefix: string): Promise<boolean> {
    return this.isVisible(this.filterChipSelector(labelPrefix));
  }

  async getFilterChipLabel(labelPrefix: string): Promise<string> {
    const el = await this.driver.$(this.filterChipSelector(labelPrefix));
    return (await el.getAttribute('content-desc')) ?? '';
  }

  /**
   * Reads every category chip's own content-desc ("<NAME> (<count>)")
   * without assuming which categories exist - the seeded catalog's category
   * set for a given stop isn't stable over time (live-verified 2026-08-07:
   * a spec hardcoding "CANDY"/"LG SNACKS" broke once that stop's catalog no
   * longer had an "LG SNACKS" chip at all). Matches on the "(<count>)"
   * suffix every real category chip carries, which also excludes the
   * sheet's Apply/Clear filters buttons (same element type, no such
   * suffix). Call after openFilterSheet().
   */
  async getAllFilterChipLabels(): Promise<string[]> {
    const chips = await this.driver.$$('//android.widget.Button[contains(@content-desc,"(") and contains(@content-desc,")")]');
    const labels: string[] = [];
    for (const chip of chips) {
      const label = await chip.getAttribute('content-desc');
      if (label) labels.push(label);
    }
    return labels;
  }

  /** The chip's own selected/ticked state - distinct from isChecked (the header filter_cta toggle). */
  async isFilterChipSelected(labelPrefix: string): Promise<boolean> {
    const el = await this.driver.$(this.filterChipSelector(labelPrefix));
    return (await el.getAttribute('selected').catch(() => 'false')) === 'true';
  }

  async isApplyFiltersEnabled(): Promise<boolean> {
    return this.isEnabled(this.applyFiltersButton);
  }

  async isClearFiltersEnabled(): Promise<boolean> {
    return this.isEnabled(this.clearFiltersButton);
  }

  async tapApplyFilters(): Promise<void> {
    await this.tap(this.applyFiltersButton);
  }

  async tapClearFilters(): Promise<void> {
    await this.tap(this.clearFiltersButton);
  }

  /**
   * Excel TC133 "remove single filter" - once Applied, each active category
   * gets its own removable tag above the product list (e.g. a bare "LG
   * SNACKS" View, no count suffix - distinct from the filter SHEET's own
   * chip). Live-verified (build 0.1.76): the tag has no separate close-icon
   * content-desc/resource-id of its own - it's an unlabeled clickable View
   * immediately following the tag's label View, same structural pattern as
   * the numeric keypad's unlabeled Up/Down/backspace buttons.
   */
  private filterTagSelector(label: string): string {
    return `//android.view.View[@content-desc="${label}"]`;
  }

  async isFilterTagVisible(label: string): Promise<boolean> {
    return this.isVisible(this.filterTagSelector(label));
  }

  async removeFilterTag(label: string): Promise<void> {
    await this.tap(`${this.filterTagSelector(label)}/following-sibling::android.view.View[1]`);
  }

  /**
   * Same as selectFilterCategories, but matches a chip by its label PREFIX
   * (e.g. "CANDY") rather than the full content-desc - the chip's real label
   * includes a live product count suffix (e.g. "CANDY (1)") that changes with
   * the catalog, so an exact match would break as soon as that count shifts.
   */
  async selectFilterCategoryByPrefix(labelPrefix: string): Promise<void> {
    await this.tap(this.filterCta);
    await this.tap(`//android.widget.Button[starts-with(@content-desc,"${labelPrefix}")]`);
    await this.tap('~Apply filters');
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
   *
   * Ported from common_keywords.robot's "Swipe Left and click on the delete
   * button", which derives its delete-icon locator internally by appending a
   * fixed xpath suffix (`/android.widget.Button`) to the same row locator,
   * rather than taking it as a separate argument - matched exactly here.
   */
  async swipeAndDelete(rowSelector: string): Promise<void> {
    const row = await this.driver.$(rowSelector);
    await row.waitForExist({ timeout: mobileConfig.timeouts.element });
    const loc = await row.getLocation();
    const size = await row.getSize();
    await this.swipe(loc.x + size.width - 10, loc.y + size.height / 2, loc.x + 10, loc.y + size.height / 2);
    await this.tap(`${rowSelector}/android.widget.Button`);
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
   * Taps a Before/After Photos trigger and waits for the "Add supporting
   * photo" modal (Take photo / Skip photo). Live-verified (2026-07-27):
   * on this build/emulator the modal appears directly - no separate live
   * camera-preview screen beforehand, unlike the Excel's TC017/TC130-style
   * wording ("camera interface opens with live preview"). Not asserting
   * that a live preview exists first; this is the real, reproducible entry
   * point.
   */
  async openPhotoTrigger(triggerSelector: string): Promise<void> {
    await this.tap(triggerSelector);
    await this.waitFor(this.skipPhotoModalTitle);
  }

  async isPhotoModalVisible(): Promise<{ takePhoto: boolean; skipPhoto: boolean }> {
    return {
      takePhoto: await this.isVisible(this.takePhotoButton),
      skipPhoto: await this.isVisible(this.skipPhotoButton)
    };
  }

  /**
   * Taps Skip photo on the "Add supporting photo" modal and waits for the
   * Skip photo reason bottom sheet (Excel TC134/TC021/TC106's "Skip photo
   * bottom sheet ... Reason to skip photo text field and disabled submit
   * button"). Live-verified: a single tap reaches the reason sheet
   * directly - the Excel's separate "Can't take a photo?" confirmation
   * modal (TC131/TC018/TC103) with its own Cancel/Skip photo pair was NOT
   * observed as a distinct intermediate step on this build; not asserted.
   */
  async openSkipPhotoReasonSheet(): Promise<void> {
    await this.tap(this.skipPhotoButton);
    await this.waitFor(this.skipPhotoReasonField);
  }

  async isSkipPhotoReasonSheetVisible(): Promise<boolean> {
    return this.isVisible(this.skipPhotoReasonField);
  }

  async isSkipPhotoSubmitEnabled(): Promise<boolean> {
    return this.isEnabled(this.skipPhotoButton);
  }

  /**
   * Live-verified: the Skip photo button's enabled attribute lags behind
   * setValue() resolving by a variable amount (a fixed 500ms pause after
   * typing was NOT reliably enough across repeated runs) - polls instead of
   * guessing a fixed delay.
   */
  async waitForSkipPhotoSubmitEnabled(expected: boolean, timeoutMs = 5_000): Promise<void> {
    await this.driver.waitUntil(async () => (await this.isSkipPhotoSubmitEnabled()) === expected, {
      timeout: timeoutMs,
      interval: 200
    });
  }

  /**
   * TC136/TC024/TC108: enters the skip reason - does NOT submit. Field
   * accepts input directly (no keyboard-visibility polling needed,
   * confirmed live). Needs an explicit tap/focus before setValue() - a
   * plain setValue() with no prior tap left the field showing the right
   * text but the Skip photo button's enabled state never updated
   * (live-verified) - so this taps first for the app's own dirty-state
   * tracking to fire.
   *
   * Retries the element lookup as a general safety net against ordinary
   * UiAutomator2 instrumentation hiccups (seen intermittently elsewhere in
   * this suite) - the specific repeated "not found" this surfaced while
   * debugging turned out to be a real bug in skipPhotoReasonField's old
   * exact-match locator, now fixed at its declaration (see that field's own
   * comment), not something this retry papers over.
   */
  async enterSkipPhotoReason(reason: string): Promise<void> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const field = await this.driver.$(this.skipPhotoReasonField);
        await field.waitForDisplayed({ timeout: mobileConfig.timeouts.element });
        await field.click();
        await field.setValue(reason);
        return;
      } catch (err) {
        lastError = err;
        await this.driver.pause(1000);
      }
    }
    throw lastError;
  }

  /**
   * TC138/TC025/TC113: submits the skip reason. Dismisses the keyboard via
   * BACK first - live-verified the on-screen keyboard covers the submit
   * button's real position, same reasoning as hideKeyboardViaAdb's other
   * call sites, and this build's soft keyboard does close on BACK without
   * navigating the underlying sheet away (a keyboard was showing).
   */
  async confirmSkipPhoto(): Promise<void> {
    await this.pressKeyCode(4);
    await this.tap(this.skipPhotoButton);
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

  /** Same as scrollDown, direction reversed - needed by any flow that scrolls down to reach a lower element, then must scroll back up to find one nearer the top again (e.g. CoffeeServiceScreen's Signing Order page). */
  async scrollUp(opts: { left?: number; top?: number; width?: number; height?: number; percent?: number } = {}): Promise<void> {
    await this.driver.executeScript('mobile: scrollGesture', [
      {
        left: opts.left ?? 100,
        top: opts.top ?? 100,
        width: opts.width ?? 300,
        height: opts.height ?? 600,
        direction: 'up',
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
   *
   * CORRECTED (live-verified 2026-07-29 via Vending's own Removals &
   * Returns): the original type()-then-pressKeyCode(66) pattern does NOT
   * reliably commit a value on this screen's own quantity fields - a live
   * run using exactly that pattern surfaced the screen's "Quantity must be
   * greater than zero" validation toast on Save, meaning the field was
   * still seen as empty. These fields are driven by a custom keypad (same
   * family as every other numeric-keypad field elsewhere in this app) that
   * needs an explicit click() first to engage before setValue() - a bare
   * setValue() with no prior click, followed by an Enter keycode, doesn't
   * commit through the app's own controller. Enter is no longer needed at
   * all once the field is properly clicked first.
   */
  async performRemovalsAndReturns(
    searchTerm: string,
    values: { spoiled?: string; damaged?: string; theft?: string; truckReturns?: string } = {}
  ): Promise<void> {
    await this.tap(this.removalsAndReturns);
    await this.searchAndSelect(searchTerm);
    await this.waitFor(this.documentProductTitle);
    await this.fillRemovalsField(this.removalsSpoiledField, values.spoiled ?? '0');
    await this.fillRemovalsField(this.removalsDamagedField, values.damaged ?? '0');
    await this.fillRemovalsField(this.removalsTheftField, values.theft ?? '0');
    await this.fillRemovalsField(this.removalsTruckReturnsField, values.truckReturns ?? '0');
    await this.tap(this.removalsSaveButton);
    await this.waitFor(this.removalsDoneButton);
    await this.tap(this.removalsDoneButton);
  }

  /** Clicks then sets a value on one of Removals & Returns' custom-keypad-driven quantity fields - see performRemovalsAndReturns's own note on why a bare setValue() isn't enough. */
  protected async fillRemovalsField(selector: string, value: string): Promise<void> {
    const field = await this.driver.$(selector);
    await field.click();
    await field.setValue(value);
  }
}