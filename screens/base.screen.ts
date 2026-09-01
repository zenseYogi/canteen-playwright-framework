import { execSync } from 'child_process';
import { PNG } from 'pngjs';
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

  /**
   * Taps an element only once its position has STOPPED MOVING.
   *
   * For anything that slides in - the navigation drawer above all - waiting
   * for the element to exist is not enough: it reports its FINAL bounds while
   * still animating, so a click aimed at that centre can land on whatever is
   * currently under those coordinates. With the drawer that is the scrim,
   * which closes it again, and the app is left exactly where it started with
   * no error raised.
   *
   * Diagnosed 2026-08-28: EndDayScreen.openFromHamburgerMenu appeared to open
   * End Day and silently stayed on Home, while the identical navigation done
   * by hand - with a human-sized pause between taps - worked every time.
   *
   * Polls the location instead of sleeping a fixed amount, so it costs only
   * what the animation actually takes.
   */
  async tapWhenSettled(selector: string, timeoutMs = 15_000): Promise<void> {
    const el = await this.driver.$(selector);
    await el.waitForDisplayed({ timeout: timeoutMs });
    let previous = { x: -1, y: -1 };
    await this.driver
      .waitUntil(
        async () => {
          const current = await el.getLocation();
          const settled = current.x === previous.x && current.y === previous.y;
          previous = { x: current.x, y: current.y };
          return settled;
        },
        { timeout: timeoutMs, interval: 250 }
      )
      .catch(() => undefined);
    await el.click();
  }

  async isVisible(selector: string): Promise<boolean> {
    const el = await this.driver.$(selector);
    return el.isDisplayed().catch(() => false);
  }

  // ---- Build 0.1.92 sync-failure recovery ----
  //
  // New in build 0.1.92 (live-verified 2026-08-31): route syncing now fails
  // intermittently, replacing whatever screen was expected with a card
  // reading "Syncing failed" / "Syncing routes failed" over a stalled
  // progress bar, offering Retry and Change route. Seen twice within an
  // hour - at 21% on the first launch after installing 92, and at 0%
  // immediately after a Route Setup change - and BOTH recovered on the
  // first Retry tap, so this is a transient sync fault rather than a dead
  // end.
  //
  // Nothing in the framework could see it before: every wait watches only
  // for its own target element, so the failure card just sat there burning
  // the full 120s and surfaced as "element still not displayed", pointing
  // at the wrong cause entirely (that is exactly how it presented as
  // "Select Day never appeared").
  //
  // Keyed on the Retry button PLUS a node containing "failed", not on the
  // message text: the wording differs between the two places this appears,
  // and "Retry" alone is too generic to be safe as a sole signal.
  private readonly syncRetryButton = '~Retry';
  private readonly syncFailedText = '//*[contains(@content-desc, "failed")]';

  async isSyncFailureVisible(): Promise<boolean> {
    if (!(await this.isVisible(this.syncRetryButton))) {
      return false;
    }
    return this.isVisible(this.syncFailedText);
  }

  /** Taps Retry if the sync-failure card is up. Returns whether it was. */
  async recoverFromSyncFailure(): Promise<boolean> {
    if (!(await this.isSyncFailureVisible())) {
      return false;
    }
    await this.tap(this.syncRetryButton);
    return true;
  }

  /**
   * Waits for `selector`, tapping Retry each time the sync-failure card
   * appears instead of the expected screen.
   *
   * Bounded by maxRetries rather than looping until the deadline: a sync
   * that fails repeatedly is a real environment problem the run should
   * surface, not something to paper over silently. On giving up it throws
   * naming the sync failure, so the cause is not misreported as a missing
   * element the way it was before this existed.
   */
  async waitForWithSyncRecovery(selector: string, timeoutMs = 120_000, maxRetries = 3): Promise<void> {
    let deadline = Date.now() + timeoutMs;
    let retries = 0;
    while (Date.now() < deadline) {
      if (await this.isVisible(selector)) {
        return;
      }
      if (await this.isSyncFailureVisible()) {
        if (retries >= maxRetries) {
          throw new Error(
            `waitForWithSyncRecovery: sync kept failing after ${retries} Retry taps while waiting for ${selector} (build 0.1.92 sync fault)`
          );
        }
        retries += 1;
        await this.tap(this.syncRetryButton);
        // Let the card actually go away before resuming the poll. It stays
        // on screen for a beat after the tap, and this loop comes back
        // around every 2s - without this it would read the SAME failure as
        // a fresh one and spend the whole retry budget double-tapping a
        // sync that had already restarted.
        await this.driver
          .waitUntil(async () => !(await this.isSyncFailureVisible()), { timeout: 30_000, interval: 1000 })
          .catch(() => undefined);
        // A Retry restarts the sync from scratch, and a full sync runs
        // 60-90s. Without granting it a fresh window it inherits whatever
        // is left of the original budget and gets cut off mid-resync -
        // which is exactly how this first presented: Retry was tapped,
        // the sync WAS recovering, and the wait expired underneath it,
        // making a working Retry look like a failed one.
        deadline = Date.now() + timeoutMs;
      }
      await this.driver.pause(2000);
    }
    throw new Error(
      `waitForWithSyncRecovery: ${selector} still not displayed after ${timeoutMs}ms (${retries} sync Retry taps along the way)`
    );
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

  async waitFor(selector: string, timeoutMs = mobileConfig.timeouts.element): Promise<void> {
    const el = await this.driver.$(selector);
    await el.waitForDisplayed({ timeout: timeoutMs });
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
   * Same "is this checkbox-like element currently on" read as isChecked(),
   * but also falls back to the `selected` attribute - some of this app's
   * checkboxes are plain android.widget.CheckBox (real `checked`), others
   * are ImageView-based custom checkboxes (e.g. Prep Tasks' "Select All")
   * that may expose `selected` instead. Tries `checked` first since that's
   * the more common/reliable signal where present.
   */
  private async isCheckboxOn(el: any): Promise<boolean> {
    const checked = await el.getAttribute('checked').catch(() => null);
    if (checked !== null) {
      return checked === 'true';
    }
    return (await el.getAttribute('selected').catch(() => 'false')) === 'true';
  }

  /**
   * Sets a checkbox-like element to the desired checked state, only tapping
   * it if its current state doesn't already match - guards against blindly
   * toggling a checkbox that's already in the state a TC wants (which would
   * otherwise flip it into the WRONG state instead of leaving it alone).
   * Always verify against the checkbox's real current state before
   * selecting/unselecting, per the exact TC being automated.
   */
  async setCheckboxState(selector: string, checked: boolean): Promise<void> {
    const el = await this.driver.$(selector);
    const current = await this.isCheckboxOn(el);
    if (current !== checked) {
      await el.click();
    }
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

  /**
   * Whether a checklist row's checkbox icon is visually checked (a green
   * checkmark) - for elements with NO accessibility signal at all for
   * their checked state. Confirmed live 2026-08-09 via both Appium's
   * getPageSource AND a raw `adb uiautomator dump` (bypassing Appium
   * entirely): Prep Tasks' Money Operations/Additional Prep checkbox rows
   * and the Checks screen's Safety-check checkbox are plain
   * android.widget.ImageView nodes, single-level, no children/siblings, no
   * resource-id - `checked`/`selected` are permanently "false" regardless
   * of the rendered checkmark, because the state exists ONLY in the
   * rendered bitmap, never in the semantics node.
   *
   * CORRECTED (live-verified 2026-08-09): an earlier version sampled a
   * SINGLE pixel at a fixed fraction of the row's own height - broke on
   * the Checks screen's "Safety check completed" row, which is taller
   * (192px, two lines: label + subtitle) than Money Operations/Additional
   * Prep's rows (162px, single line) - the icon is NOT positioned
   * proportionally to row height (it stays near the top, pinned to the
   * label's own line, regardless of how much subtitle text follows), so
   * the same fractional offset landed on blank space on the taller row
   * and mis-read it as unchecked, causing a real regression (a checked
   * "Safety check completed" box got un-checked). Scans a small region
   * near the icon's expected top-left corner instead of trusting one
   * exact point - robust to the icon's exact position varying by a few
   * dozen pixels between row layouts. Checked reads clearly green (e.g.
   * RGB 65/159/103); unchecked reads as a neutral gray outline (e.g. RGB
   * 73/69/79, channels roughly equal, no green dominance) - the scan
   * returns true the moment ANY sampled pixel in the region is green.
   *
   * Do NOT reuse this for real android.widget.CheckBox elements (e.g.
   * Coffee's "Equipment does not exist", Market/Vending's "Skip money
   * bag") - those DO expose a working `checked` attribute (see
   * isCheckboxOn/isChecked/setCheckboxState) and should use that instead;
   * pixel sampling is a last resort for elements with no other signal,
   * and is inherently more fragile (theme/resolution/icon-asset changes
   * could shift the icon's position or color).
   */
  private async isChecklistIconCheckedEl(el: any): Promise<boolean> {
    // CORRECTED 2026-08-24 (build 0.1.90, live-verified on Route 990/Miami
    // and Route 103/Charlotte): the raw protocol command getElementRect
    // isn't meant to be called directly on an element at all - WebdriverIO's
    // own internal usages (see node_modules/webdriverio/build/node.js)
    // always call it on the browser/driver scope with an explicit
    // elementId, never bare on the element. Calling el.getElementRect(...)
    // - with OR without the elementId argument - throws inconsistently
    // depending on the WDIO element handle's internal state (reproduced
    // both as "Malformed type for elementId parameter" with the arg, and
    // "Wrong parameters applied" without it). The stable, documented public
    // API for this is getLocation()/getSize(), both plain element methods
    // that resolve the same rect correctly regardless of route/element.
    const [location, size] = await Promise.all([el.getLocation(), el.getSize()]);
    const rect = { x: location.x, y: location.y, width: size.width, height: size.height };
    const base64 = await this.driver.takeScreenshot();
    const png = PNG.sync.read(Buffer.from(base64, 'base64'));
    const scanWidth = Math.min(140, rect.width - 10);
    const scanHeight = Math.min(140, rect.height - 10);
    for (let dy = 10; dy < scanHeight; dy += 6) {
      for (let dx = 10; dx < scanWidth; dx += 6) {
        const x = Math.round(rect.x + dx);
        const y = Math.round(rect.y + dy);
        const idx = (png.width * y + x) << 2;
        if (this.isCompletionGreen(png.data[idx], png.data[idx + 1], png.data[idx + 2])) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * The green this app paints a completed/checked state in, as distinct from
   * the surrounding neutral UI.
   *
   * Extracted so every pixel-based completion check shares ONE definition and
   * they cannot drift apart - the threshold was tuned live against the Prep
   * Tasks checkboxes and is the only thing standing in for an accessibility
   * signal that does not exist.
   */
  private isCompletionGreen(r: number, g: number, b: number): boolean {
    return g > r + 30 && g > b + 20;
  }

  /**
   * Whether a completion green is rendered anywhere inside an element's own
   * bounds - the tile-level counterpart to isChecklistIconChecked().
   *
   * Scans the WHOLE element rather than a corner: isChecklistIconCheckedEl
   * samples only the top-left 140x140, which is right for a checkbox but wrong
   * for a checklist TILE, where the tick sits at the row's trailing edge and
   * would be missed entirely.
   *
   * Use this DIFFERENTIALLY - assert no green before the action and green
   * after. An absolute "is it green" check is not trustworthy on its own: any
   * incidental green in the row would satisfy it, and a tile already completed
   * by an earlier run would pass without the test having done anything. The
   * before/after pair proves the transition, which is what the case is about.
   */
  async hasCompletionGreen(el: any): Promise<boolean> {
    const [location, size] = await Promise.all([el.getLocation(), el.getSize()]);
    const base64 = await this.driver.takeScreenshot();
    const png = PNG.sync.read(Buffer.from(base64, 'base64'));
    const startX = Math.round(location.x) + 4;
    const endX = Math.min(png.width - 1, Math.round(location.x + size.width) - 4);
    const startY = Math.round(location.y) + 4;
    const endY = Math.min(png.height - 1, Math.round(location.y + size.height) - 4);
    for (let y = startY; y < endY; y += 4) {
      for (let x = startX; x < endX; x += 4) {
        const idx = (png.width * y + x) << 2;
        if (this.isCompletionGreen(png.data[idx], png.data[idx + 1], png.data[idx + 2])) {
          return true;
        }
      }
    }
    return false;
  }

  async isChecklistIconChecked(selector: string): Promise<boolean> {
    const el = await this.driver.$(selector);
    return this.isChecklistIconCheckedEl(el);
  }

  /** Same "only tap if not already in the desired state" idempotency as setCheckboxState(), but for checklist icons with no accessibility signal (see isChecklistIconChecked). */
  async setChecklistIconState(selector: string, checked: boolean): Promise<void> {
    const el = await this.driver.$(selector);
    if ((await this.isChecklistIconCheckedEl(el)) !== checked) {
      await el.click();
    }
  }

  /**
   * Checks every checklist icon currently matched by `selector` via pixel
   * sampling (see isChecklistIconChecked) - skips any already checked, so a
   * repeat call against a partially-completed screen is idempotent instead
   * of unchecking already-done items.
   *
   * CORRECTED 2026-08-25 (build 0.1.90): re-resolves the match list on every
   * iteration instead of holding the one `$$` snapshot taken up front.
   * Clicking one icon can re-render the list and change how many nodes match
   * (live-observed on Prep Tasks' Product collection, where the snapshot's
   * element 2 then resolved against a 2-element list and threw "Index out of
   * bounds! ... returned only 2 elements", failing Start Day outright). The
   * loop is still bounded by the ORIGINAL count so a list that grows can't
   * spin forever, and stops early if the list shrinks below the cursor.
   */
  async selectAllChecklistIcons(selector: string): Promise<void> {
    const initial = [...(await this.driver.$$(selector))];
    const total = initial.length;
    for (let i = 0; i < total; i++) {
      const current = [...(await this.driver.$$(selector))];
      if (i >= current.length) {
        break;
      }
      const el = current[i];
      if (!(await this.isChecklistIconCheckedEl(el))) {
        await el.click();
      }
    }
  }

  /**
   * Whether a decorative icon (e.g. a drag handle) is rendered somewhere
   * near an element's right edge - same last-resort pixel-sampling
   * rationale as isChecklistIconChecked, for icons with NO accessible
   * node of their own at all (confirmed live 2026-08-10: Edit Schedule
   * Order's per-row drag handles are baked into the row's own bitmap -
   * the only ImageView anywhere in the tree is the screen title's own
   * icon, not one per row). Scans a narrow vertical strip along the
   * right ~15% of the element's width for any non-white pixel - generic
   * presence detection, not a specific icon match.
   */
  async hasNonWhiteIconNearRightEdge(el: any): Promise<boolean> {
    // Same fix as isChecklistIconCheckedEl's own note - getElementRect
    // isn't meant to be called directly on an element; use getLocation()/
    // getSize() instead.
    const [location, size] = await Promise.all([el.getLocation(), el.getSize()]);
    const rect = { x: location.x, y: location.y, width: size.width, height: size.height };
    const base64 = await this.driver.takeScreenshot();
    const png = PNG.sync.read(Buffer.from(base64, 'base64'));
    const stripStartX = rect.x + Math.round(rect.width * 0.85);
    const stripEndX = rect.x + rect.width - 10;
    for (let y = rect.y + 10; y < rect.y + rect.height - 10; y += 6) {
      for (let x = stripStartX; x < stripEndX; x += 6) {
        const idx = (png.width * Math.round(y) + Math.round(x)) << 2;
        const r = png.data[idx];
        const g = png.data[idx + 1];
        const b = png.data[idx + 2];
        if (!(r > 240 && g > 240 && b > 240)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * C-TC-019 - relaunches the app WITHOUT tearing down the Appium session or
   * clearing app data.
   *
   * terminateApp + activateApp, not `adb shell am force-stop`: the adb route
   * kills the process out from under the session, so the next command fails
   * and the test has to rebuild everything. This pair is the supported
   * in-session restart and leaves the driver usable.
   *
   * It also deliberately does NOT clear data (no `pm clear`) - that is the
   * fixture's cold-start path and would wipe the login. "After app relaunch"
   * means restarted, not reinstalled.
   *
   * Worth having beyond C-TC-019: a test that fails mid-flow has repeatedly
   * left this app on a screen BACK cannot escape (the in-app camera, the
   * Equipment audit's "complete audit?" loop), which then breaks the NEXT run
   * before it starts.
   */
  async relaunchApp(): Promise<void> {
    const appId = mobileConfig.capabilities['appium:appPackage'];
    await this.driver.execute('mobile: terminateApp', { appId });
    await this.driver.pause(1_500);
    await this.driver.execute('mobile: activateApp', { appId });
    await this.driver.pause(4_000);
  }

  /** C-TC-045 - the package currently in the foreground. Used to detect the app handing off to an EXTERNAL app. */
  async getForegroundPackage(): Promise<string> {
    return (await this.driver.getCurrentPackage()) ?? '';
  }

  /**
   * C-TC-045 - brings THIS app back to the foreground after an external app
   * has taken over.
   *
   * Needed because a test that leaves the app would otherwise strand every
   * test after it on someone else's screen - the same class of breakage that
   * the in-app camera and the Equipment audit BACK-loop caused earlier. Uses
   * activateApp rather than BACK: the external app's back stack is not ours to
   * reason about.
   */
  async returnToThisApp(): Promise<void> {
    const appId = mobileConfig.capabilities['appium:appPackage'];
    await this.driver.execute('mobile: activateApp', { appId });
    await this.driver.pause(3_000);
  }

  // ==== Shared swipe-to-reveal-delete primitives ====
  //
  // swipeAndDelete() below does this whole flow in one call, which fits a
  // CLEANUP step but not a TEST of the delete itself: a test needs to assert
  // the icon appeared, assert the confirmation appeared, and exercise the
  // decline path before confirming. These three primitives are that same
  // mechanic decomposed so those assertions can sit between the steps.
  //
  // Used by Coffee's C-TC-011 (Deliveries product) and C-TC-012 (saved
  // presale); TransfersScreen's swipeRouteCardToRevealDelete/isDeleteIconVisible/
  // tapDeleteIcon are the same three steps written out longhand and can be
  // collapsed onto these when that suite is next touched.
  //
  // The CONFIRMATION is deliberately NOT part of these - it is not consistent
  // across screens. Deliveries' "Delete Product" dialog answers No/Yes, while
  // the Pre-sales one answers Cancel/Delete (BaseScreen.deleteButton) despite
  // carrying the same title. Callers tap their own.

  /**
   * Swipes a row left to reveal its unlabelled delete Button.
   *
   * `slow` is for rows the default 300ms gesture does not register on.
   * Live-verified 2026-08-25 (build 0.1.90, Coffee Pre-sales): the fast swipe
   * produced NO reveal on the saved-presale row - the tree came back
   * byte-identical, which reads exactly like "this row has no delete
   * affordance" and nearly got C-TC-012 written off as a missing feature. A
   * 900ms move bracketed by press/release pauses reveals it reliably.
   * Deliveries' rows tolerate the fast version, so this stays opt-in.
   */
  async revealRowDelete(rowSelector: string, opts: { slow?: boolean } = {}): Promise<void> {
    const row = await this.driver.$(rowSelector);
    await row.waitForDisplayed({ timeout: mobileConfig.timeouts.element });
    const loc = await row.getLocation();
    const size = await row.getSize();
    if (!opts.slow) {
      await this.swipe(loc.x + size.width - 10, loc.y + size.height / 2, loc.x + 10, loc.y + size.height / 2);
      return;
    }
    await this.driver
      .action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ x: loc.x + size.width - 15, y: loc.y + size.height / 2 })
      .down()
      .pause(300)
      .move({ duration: 900, x: loc.x + 15, y: loc.y + size.height / 2 })
      .pause(300)
      .up()
      .perform();
  }

  /** Whether the delete Button revealed by revealRowDelete() is showing. Unlabelled everywhere, so addressed as the row's own Button child. */
  async isRowDeleteIconVisible(rowSelector: string): Promise<boolean> {
    return this.isVisible(`${rowSelector}/android.widget.Button`);
  }

  /**
   * Reveals a row's delete control, escalating from the fast gesture to the
   * slow one if the fast one did not take. Returns whether anything was
   * actually revealed.
   *
   * Which rows need which gesture is NOT predictable from the screen: Coffee's
   * Deliveries rows respond to the fast swipe, the saved-presale row responds
   * ONLY to the slow one, and the Equipment audit CARD - which the fast swipe
   * used to clear successfully - was live-observed on 2026-08-26 failing it
   * too, leaving the Button unrevealed and the tap timing out 15s later.
   * Rather than keep rediscovering this per screen (it has now cost three
   * separate investigations), try fast, verify, and fall back to slow.
   */
  async revealRowDeleteResilient(rowSelector: string): Promise<boolean> {
    await this.revealRowDelete(rowSelector);
    if (await this.isRowDeleteIconVisible(rowSelector)) {
      return true;
    }
    await this.revealRowDelete(rowSelector, { slow: true });
    return this.isRowDeleteIconVisible(rowSelector);
  }

  /** Taps the delete Button revealed by revealRowDelete(), opening that screen's own confirmation. */
  async tapRowDeleteIcon(rowSelector: string): Promise<void> {
    await this.tap(`${rowSelector}/android.widget.Button`);
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

  // The photo REVIEW screen, reached by tapping the camera's shutter.
  // Live-mapped 2026-08-27 on Market/Teva: unlike the camera itself (12 nodes,
  // zero labels), this screen IS labelled - "Photos" heading, a label picker,
  // a description EditText, and Delete photo / Take photo / Attach Photo.
  //
  // "Take photo" appears on BOTH the pre-capture sheet and here. It was
  // recorded as meaning RETAKE on this screen; that is WRONG, corrected
  // 2026-08-28 by counting deletes. This screen edits a LIST of captures one
  // at a time (note the thumbnail beside the label picker) and "Take photo"
  // ADDS a further capture rather than replacing the current one: capture,
  // then "Take photo" and capture again, and it takes TWO deletes to get back
  // to the camera. Deleting the last capture is what returns you there.
  //
  // So there is no replace affordance here at all - replacing means deleting
  // and capturing again. C-TC-044 guards this explicitly by asserting the
  // delete count.
  protected readonly photoReviewTitle = '~Photos';
  protected readonly deletePhotoButton = '//android.widget.Button[@content-desc="Delete photo"]';
  protected readonly retakePhotoButton = '//android.widget.Button[@content-desc="Take photo"]';
  // Positional: neither carries a content-desc of its own. The picker is the
  // clickable View above the description field, and the description is the
  // only EditText on the screen.
  // Anchored on the description EditText rather than on a container: the
  // review screen has no reliable ScrollView wrapper, and a ScrollView-scoped
  // path found nothing. The picker is the nearest clickable View BEFORE the
  // description field, which holds whatever the layout nests them in.
  protected readonly photoLabelPicker =
    '//android.widget.EditText/preceding::android.view.View[@clickable="true"][1]';
  protected readonly photoDescriptionField = '//android.widget.EditText';

  /** Whether the post-capture review screen is showing, with its retake/delete/attach controls. */
  async isPhotoReviewVisible(): Promise<{ review: boolean; retake: boolean; delete: boolean; attach: boolean }> {
    return {
      review: await this.isVisible(this.photoReviewTitle),
      retake: await this.isVisible(this.retakePhotoButton),
      delete: await this.isVisible(this.deletePhotoButton),
      attach: await this.isVisible(this.attachPhotoButton)
    };
  }

  /**
   * Taps the camera's shutter. The camera screen carries NO labels at all, so
   * the shutter is addressed by capturePhotoButton's structural path - see its
   * own declaration for why that is unavoidable here.
   */
  /**
   * CORRECTED 2026-09-01 (build 0.1.92, live-verified via uiautomator dump):
   * capturePhotoButton's 6-level structural path no longer matches. The real
   * camera tree is FrameLayout > LinearLayout > FrameLayout > FrameLayout >
   * View x4 > controls - an extra LinearLayout the ported path does not
   * account for - so the tap hit nothing, the review screen never opened,
   * and the failure surfaced as "~Photos still not displayed after 15000ms",
   * which read as a missing review screen rather than a missed shutter. That
   * locator was always flagged FRAGILE with "re-verify against the current
   * build"; this is that re-verification.
   *
   * Selects by GEOMETRY instead. The camera screen carries no labels at all,
   * but it has exactly three clickable controls in a fixed arrangement:
   * flash (left), shutter (centre, clearly the largest), flip (right). The
   * shutter is the one nearest the horizontal centre, which survives the
   * hierarchy changing again.
   */
  async tapCameraShutter(): Promise<void> {
    const controls = await this.getCameraControls();
    if (controls.length === 0) {
      // No camera controls at all: fall back to the legacy path so this
      // reports the original failure rather than a confusing "no controls".
      await this.tap(this.capturePhotoButton);
      await this.waitFor(this.photoReviewTitle, 60_000);
      return;
    }
    const { width: screenWidth } = await this.driver.getWindowSize();
    const centre = screenWidth / 2;
    const shutter = controls.reduce((best, c) =>
      Math.abs(c.x + c.width / 2 - centre) < Math.abs(best.x + best.width / 2 - centre) ? c : best
    );
    await shutter.el.click();
    // 60s, not the 15s default: capture plus review-screen render is slower
    // than an ordinary screen transition on an emulator.
    await this.waitFor(this.photoReviewTitle, 60_000);
  }

  /** Discards the captured image and returns to the camera. */
  async deleteCapturedPhoto(): Promise<void> {
    await this.tap(this.deletePhotoButton);
  }

  /**
   * Taps the review screen's "Take photo", which ADDS a further capture -
   * it does NOT retake/replace the current one. Named for the button, since
   * naming it for the behaviour previously encoded an assumption that turned
   * out to be false (see the note on retakePhotoButton).
   */
  async tapRetakePhoto(): Promise<void> {
    await this.tap(this.retakePhotoButton);
  }

  async tapAttachPhoto(): Promise<void> {
    await this.tap(this.attachPhotoButton);
  }

  // ---- In-app camera controls (C-TC-046) ----
  //
  // The camera screen carries ZERO content-descs - 12 nodes, not one labelled.
  // Live-mapped 2026-08-27 on Coffee/Charlotte 103 and found identical to
  // Market/Miami 001's, so this is one shared component and the mapping holds
  // for both LOBs.
  //
  // It exposes exactly three clickable nodes along the bottom edge, left to
  // right: an android.widget.Button, a larger android.view.View (the shutter),
  // and an android.widget.ImageView.
  //
  // Naming them by POSITION alone would be a guess presented as a fact - such
  // a test keeps passing if flash and flip are swapped, or if one is replaced
  // by something else entirely. So each is identified by what tapping it
  // demonstrably DOES, which is what tapCameraControlAndMeasure() exists for.
  // Live-measured on the emulator: tapping the left control repaints 3% of its
  // OWN bounds and restores them exactly on a second tap (a two-state icon
  // toggle - the live preview could never round-trip to zero); tapping the
  // right control changes 98% of the preview against 14.5% idle feed jitter (a
  // camera switch, and nothing else can do that).
  protected readonly anyClickable = '//*[@clickable="true"]';

  /**
   * The camera's clickable controls, ordered left to right, each with the
   * bounds needed to sample its own region.
   */
  async getCameraControls(): Promise<
    { el: any; className: string; x: number; y: number; width: number; height: number }[]
  > {
    const found: { el: any; className: string; x: number; y: number; width: number; height: number }[] = [];
    for (const el of [...(await this.driver.$$(this.anyClickable))]) {
      const [location, size] = await Promise.all([el.getLocation(), el.getSize()]);
      found.push({
        el,
        className: (await el.getAttribute('class')) ?? '',
        x: location.x,
        y: location.y,
        width: size.width,
        height: size.height
      });
    }
    return found.sort((a, b) => a.x - b.x);
  }

  /**
   * Whether the unlabelled in-app camera is the screen currently showing.
   *
   * Its signature is exactly three clickable controls, none of which carries a
   * content-desc. Both halves matter: the photo REVIEW screen also has a
   * handful of clickable nodes, but they are labelled ("Delete photo",
   * "Attach Photo"), so the absence of labels is what tells the two apart.
   */
  async isCameraScreen(): Promise<boolean> {
    const controls = await this.getCameraControls();
    if (controls.length !== 3) return false;
    for (const c of controls) {
      const desc = ((await c.el.getAttribute('content-desc')) ?? '').trim();
      if (desc && desc !== 'null') return false;
    }
    return true;
  }

  /**
   * Leaves the caller on the in-app CAMERA, whatever state the photo tile was
   * already in.
   *
   * Tapping "Take photo" opens the camera on a tile carrying no photo yet -
   * but on one that ALREADY has a photo attached it opens THAT photo's review
   * screen instead. Live-verified 2026-08-27, and the reason C-TC-046 and
   * C-TC-056 both passed in isolation and then both failed on their next run
   * against the same stop: one found the review screen's labelled controls
   * where it expected the camera's unlabelled three, the other found the
   * previous run's label already filled in.
   *
   * Deleting from the review screen drops back to the camera, so discarding
   * whatever is there is what makes this idempotent - and that matters more
   * than it sounds, because Charlotte 103 carried a single Coffee stop on
   * 2026-08-27. Without this, every run would need a fresh stop.
   */
  async reachCamera(): Promise<void> {
    await this.tap('//android.widget.Button[@content-desc="Take photo"]');
    await this.driver.pause(4_000);
    // Bounded rather than while(true): if deleting ever stops returning to the
    // camera, this must fail with waitForCameraScreen's message rather than
    // spin.
    for (let i = 0; i < 3; i++) {
      if (!(await this.isPhotoReviewVisible()).review) break;
      await this.deleteCapturedPhoto();
      await this.driver.pause(3_000);
    }
    await this.waitForCameraScreen();
  }

  async waitForCameraScreen(): Promise<void> {
    await this.driver.waitUntil(async () => this.isCameraScreen(), {
      timeout: 30_000,
      interval: 1_000,
      timeoutMsg: 'The in-app camera never appeared (expected three unlabelled controls)'
    });
  }

  /** The screen as a decoded PNG. Shared by every pixel-based check here. */
  protected async screenshotPng(): Promise<PNG> {
    return PNG.sync.read(Buffer.from(await this.driver.takeScreenshot(), 'base64'));
  }

  /**
   * Share (0-100) of sampled pixels inside `rect` that differ between two
   * screenshots. Sampled every `step` pixels rather than exhaustively - the
   * signals this separates are 3% vs 0% and 98% vs 14%, nowhere near fine
   * enough to need every pixel, and a full scan of a 1080x2400 frame in JS is
   * slow enough to matter when it runs four times in one test.
   */
  protected diffPercent(
    before: PNG,
    after: PNG,
    rect: { x: number; y: number; width: number; height: number },
    step = 3,
    threshold = 40
  ): number {
    const endX = Math.min(before.width, after.width, Math.round(rect.x + rect.width));
    const endY = Math.min(before.height, after.height, Math.round(rect.y + rect.height));
    let sampled = 0;
    let changed = 0;
    for (let y = Math.max(0, Math.round(rect.y)); y < endY; y += step) {
      for (let x = Math.max(0, Math.round(rect.x)); x < endX; x += step) {
        const idx = (before.width * y + x) << 2;
        const jdx = (after.width * y + x) << 2;
        sampled++;
        const delta =
          Math.abs(before.data[idx] - after.data[jdx]) +
          Math.abs(before.data[idx + 1] - after.data[jdx + 1]) +
          Math.abs(before.data[idx + 2] - after.data[jdx + 2]);
        if (delta > threshold) changed++;
      }
    }
    return sampled === 0 ? 0 : Math.round((1000 * changed) / sampled) / 10;
  }

  /**
   * Taps a camera control and reports how much changed - separately inside the
   * control's OWN bounds and across the live preview above it.
   *
   * That split is the entire discriminator between the two unlabelled
   * controls, so it is reported rather than judged here: a flash toggle
   * repaints its own icon and leaves the scene alone, while a camera flip
   * replaces the whole feed.
   *
   * `reference` lets the caller measure against the state BEFORE an earlier
   * tap instead of the state right before this one, which is how the flash
   * round-trip is proven.
   */
  async tapCameraControlAndMeasure(
    control: { el: any; x: number; y: number; width: number; height: number },
    reference?: PNG
  ): Promise<{ own: number; preview: number; before: PNG; after: PNG }> {
    const before = reference ?? (await this.screenshotPng());
    await control.el.click();
    await this.driver.pause(2_500);
    const after = await this.screenshotPng();
    // The preview band, kept clear of the status bar at the top and of the
    // control strip itself at the bottom, so "the feed changed" cannot be
    // satisfied by a control's own icon repainting.
    const preview = {
      x: 0,
      y: Math.round(after.height * 0.15),
      width: after.width,
      height: Math.round(after.height * 0.6)
    };
    return {
      own: this.diffPercent(before, after, control),
      preview: this.diffPercent(before, after, preview),
      before,
      after
    };
  }

  /**
   * How much the live preview drifts on its own between two reads, with
   * nothing tapped. The camera feed is never pixel-identical frame to frame,
   * so "the feed changed" has to be judged against this floor rather than
   * against zero - measured at ~14% on the emulator, against the ~98% a real
   * camera switch produces.
   */
  async measureCameraPreviewJitter(): Promise<number> {
    const first = await this.screenshotPng();
    await this.driver.pause(2_000);
    const second = await this.screenshotPng();
    return this.diffPercent(first, second, {
      x: 0,
      y: Math.round(first.height * 0.15),
      width: first.width,
      height: Math.round(first.height * 0.6)
    });
  }

  /**
   * The label currently chosen on the photo review screen, or '' if none.
   *
   * Reads content-desc AND text: the picker exposes its selection as `text` on
   * Coffee and the two LOBs have not been seen to agree on which attribute
   * carries it, so relying on either alone silently returns '' on the other.
   */
  async getSelectedPhotoLabel(): Promise<string> {
    const el = await this.driver.$(this.photoLabelPicker);
    if (!(await el.isExisting())) return '';
    // Appium hands back the literal STRING "null" for an attribute the node
    // does not carry, not null - so `?? ''` never fires and an unlabelled
    // picker reads as the four characters n-u-l-l. Both are normalised to ''.
    const read = async (name: string): Promise<string> => {
      const raw = ((await el.getAttribute(name)) ?? '').trim();
      return raw === 'null' ? '' : raw;
    };
    return (await read('content-desc')) || (await read('text'));
  }

  /** The "Select Label" sheet opened by tapping the review screen's label picker. */
  protected readonly selectLabelTitle = '~Select Label';

  async isSelectLabelSheetVisible(): Promise<boolean> {
    return this.isVisible(this.selectLabelTitle);
  }

  /** Every label the "Select Label" sheet offers, in the order it lists them. */
  async getPhotoLabelOptions(): Promise<{ el: any; label: string }[]> {
    const options: { el: any; label: string }[] = [];
    for (const el of [
      ...(await this.driver.$$('//android.view.View[@clickable="true" and string-length(@content-desc)>2]'))
    ]) {
      const label = ((await el.getAttribute('content-desc')) ?? '').trim();
      if (label && label !== 'Select Label') options.push({ el, label });
    }
    return options;
  }

  /**
   * Every content-desc currently on screen, joined. Used to EVIDENCE what a
   * screen actually shows rather than asserting blind against a field that may
   * not exist - e.g. proving "Equipped Date & Time" is absent (C-TC-021), or
   * that a chosen photo label survived an attach (M-TC-041).
   *
   * Moved here from CoffeeServiceScreen 2026-08-27: it is LOB-agnostic and
   * Market needed it too.
   */
  async getVisibleScreenText(): Promise<string> {
    const parts: string[] = [];
    for (const e of [...(await this.driver.$$('//*[@content-desc!=""]'))]) {
      parts.push(((await e.getAttribute('content-desc')) ?? '').replace(/\n/g, ' | '));
    }
    return parts.join('  //  ');
  }

  /** Opens the photo's label picker on the review screen. */
  async tapPhotoLabelPicker(): Promise<void> {
    await this.tap(this.photoLabelPicker);
  }

  async enterPhotoDescription(text: string): Promise<void> {
    const el = await this.driver.$(this.photoDescriptionField);
    await el.click();
    await el.setValue(text);
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
    // CORRECTED 2026-08-25 (build 0.1.90, live-verified by dumping the modal):
    // the Document product modal's ONLY buttons are Cancel and Save - there is
    // no "Done" button on it, nor on the Removals & Returns list it returns to
    // (whose only controls are the sort/filter CTAs plus the saved rows). The
    // unconditional Done wait+tap here was ported from RF and never verified
    // live - see vending-service.screen.ts's own note flagging exactly these
    // removals locators as unverified ports - and it failed M-TC-013 on a save
    // that had actually SUCCEEDED (the row was persisted; only this step
    // threw). Tapping Done only when one really appears keeps any build that
    // does have it working, while a build without it just confirms the modal
    // closed.
    const done = await this.driver.$(this.removalsDoneButton);
    const hasDone = await done.waitForDisplayed({ timeout: 5_000 }).catch(() => false);
    if (hasDone) {
      await done.click();
      return;
    }
    await this.waitForGone(this.documentProductTitle);
  }

  /** Waits until `selector` is no longer displayed - the inverse of waitFor(), for confirming a modal/overlay has actually closed rather than guessing with a fixed pause. */
  protected async waitForGone(selector: string, timeoutMs = mobileConfig.timeouts.element): Promise<void> {
    const el = await this.driver.$(selector);
    await el.waitForDisplayed({ timeout: timeoutMs, reverse: true });
  }

  /** Clicks then sets a value on one of Removals & Returns' custom-keypad-driven quantity fields - see performRemovalsAndReturns's own note on why a bare setValue() isn't enough. */
  protected async fillRemovalsField(selector: string, value: string): Promise<void> {
    const field = await this.driver.$(selector);
    await field.click();
    await field.setValue(value);
  }
}