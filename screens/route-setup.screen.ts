import { BaseScreen } from './base.screen';

export type DaySelection = 'TODAY' | 'YESTERDAY' | 'TOMORROW';

/**
 * Route Setup screen (Settings > Route setup) - a one-time-per-day-change
 * account/environment setup flow, not part of the Excel's LOB service flows.
 * All locators below were live-verified against build 0.1.76 by driving the
 * real flow end-to-end (Miami, FL / Route 010) via raw adb taps computed from
 * `uiautomator dump` bounds, then translated here into the equivalent
 * Appium/WebdriverIO locator strategy.
 *
 * The Operation and Route dropdown fields expose no content-desc/resource-id
 * of their own (confirmed via dump) - they're the only two clickable
 * `android.view.View` nodes on this screen, so a positional predicate is the
 * only stable locator available, same rationale as BaseScreen.recordByHint's
 * neighbors.
 */
export class RouteSetupScreen extends BaseScreen {
  private readonly settingsMenuItem = '~Settings, Collapsed';
  private readonly settingsExpandedMarker = '~Settings, Expanded';
  private readonly routeSetupMenuItem = '~Route setup';
  // RE-RE-CORRECTED 2026-08-20: the "lowercase s" claim was right all
  // along FOR THIS SCREEN specifically - a fresh raw `uiautomator dump`
  // taken right after openFromHamburgerMenu's own navigation (Hamburger >
  // Settings > Route setup) confirms content-desc="Route setup" (lowercase
  // s) on this screen's own header. The capital-S "Route Setup" is a
  // DIFFERENT screen: the fresh-account post-MFA gate MfaScreen detects
  // directly (no menu navigation involved) - see its own
  // routeSetupGateTitle, independently confirmed capital via the same
  // dump technique. Two real screens, two real (different) casings - not
  // one locator that kept getting mis-transcribed.
  private readonly screenTitle = '~Route setup';
  private readonly operationField = '(//android.view.View[@clickable="true"])[1]';
  private readonly routeField = '(//android.view.View[@clickable="true"])[2]';
  private readonly modalSearchField = '//android.widget.EditText';
  /**
   * The modal's real clear (X) icon. Same identification rationale as
   * CoffeeServiceScreen's own dropdownClearIcon: it is the only clickable
   * ImageView inside the sheet (the magnifier is decorative and not
   * clickable), and it carries no content-desc of its own.
   */
  private readonly modalClearIcon = '//android.widget.ImageView[@clickable="true"]';
  private readonly changeRouteButton = '~Change route';

  private daySelector(day: DaySelection): string {
    return `//android.view.View[starts-with(@content-desc,"${day}")]`;
  }

  /**
   * Hamburger menu > Settings (expands the collapsed section) > Route setup.
   *
   * CORRECTED 2026-08-20 (live-verified): not idempotent against a resumed
   * KEEP_APP_SESSION session that already left the drawer's Settings
   * section expanded from earlier in the same app process - tapping the
   * hamburger re-opens the drawer fine, but this then unconditionally
   * tapped `~Settings, Collapsed`, which no longer exists once Settings is
   * already expanded (its own content-desc becomes `~Settings, Expanded`
   * instead) - the tap silently timed out 15s later with no visible error
   * as to why. Same idempotency gap already fixed once for
   * isRouteSetupOptionVisible() above; applying the identical
   * already-open/already-expanded check here too.
   */
  async openFromHamburgerMenu(): Promise<void> {
    const alreadyOpen = await this.isVisible(this.settingsMenuItem);
    const alreadyExpanded = await this.isVisible(this.settingsExpandedMarker);
    if (!alreadyOpen && !alreadyExpanded) {
      await this.tap(this.hamburgerIcon);
    }
    if (!(await this.isVisible(this.settingsExpandedMarker))) {
      await this.tap(this.settingsMenuItem);
    }
    await this.tap(this.routeSetupMenuItem);
    await this.waitFor(this.screenTitle);
    // CORRECTED 2026-08-20 (live-verified): the screen title renders before
    // the Operation field does - callers (changeRouteAndSelectDay ->
    // selectOperation) that tap operationField immediately after this
    // returns can land the tap before the field exists, silently missing
    // it and leaving the "Select operation" modal never opened, which then
    // times out 15s later inside typeAndSelectFromModal with no clue why.
    // Waiting for the field itself closes that race.
    await this.waitFor(this.operationField);
  }

  /**
   * Excel TC009 - opens the hamburger menu and expands Settings (without
   * tapping Route setup), then reports whether the "Route setup" menu item
   * is present at all. Live-verified 2026-08-05: a genuine RouteDriver
   * persona account (unlike the shared MPY01 test account used everywhere
   * else in this suite, which is NOT RouteDriver and does show Route setup)
   * has Settings expand to only Scanner support/Dex support/Device
   * info/Export Data/Sign off - no Route setup item at all. Confirms this
   * is a real persona-based restriction, not a stale/wrong TC.
   */
  async isRouteSetupOptionVisible(): Promise<boolean> {
    // Idempotent, same rationale as DashboardScreen.clickLob(): a resumed
    // KEEP_APP_SESSION session can land with the drawer already open and/or
    // Settings already expanded (live-verified 2026-08-05) - tapping either
    // again would close it instead of opening it.
    const alreadyOpen = await this.isVisible(this.settingsMenuItem);
    if (!alreadyOpen) {
      const expanded = await this.isVisible(this.settingsExpandedMarker);
      if (!expanded) {
        await this.tap(this.hamburgerIcon);
      }
    }
    if (!(await this.isVisible(this.settingsExpandedMarker))) {
      await this.tap(this.settingsMenuItem);
    }
    return this.isVisible(this.routeSetupMenuItem);
  }

  /**
   * Types into the already-focused modal search field and taps the matching
   * result - retrying the type itself, not just waiting longer, since
   * live-verified (2026-07-24) even typeViaAdb's real key events don't
   * reliably trigger the list's search-as-you-type filter every time: the
   * field can show the typed text correctly while the list stays completely
   * unfiltered (e.g. "Miami" typed, but "Allentown, PA"/"Asheville, NC"/etc.
   * still shown) - an intermittent app-level filter reactivity issue, not a
   * typing-mechanism problem (typeViaAdb itself was already proven correct
   * against the Login WebView fields). Clearing and retyping a few times
   * resolves it faster than any single fixed timeout would.
   */
  /**
   * Taps the modal's X clear icon so its list actually renders - see
   * typeAndSelectFromModal's own note on the underlying app defect.
   * Deliberately tolerant: on a modal whose field is already empty the icon
   * may not be present at all, and that is not an error.
   */
  private async populateModalListViaClearIcon(): Promise<void> {
    const icon = await this.driver.$(this.modalClearIcon);
    if (!(await icon.waitForDisplayed({ timeout: 5_000 }).catch(() => false))) {
      return;
    }
    await icon.click().catch(() => {});
    await this.driver.pause(1_500);
  }

  private async typeAndSelectFromModal(searchTerm: string, resultLabel: string, maxAttempts = 3): Promise<void> {
    // APP DEFECT WORKAROUND, reported by QA and live-confirmed 2026-08-25
    // (build 0.1.90): the Select Route modal opens with its list EMPTY and
    // renders nothing at all until the user taps the search field's own X
    // clear icon - only then does the route data populate. A programmatic
    // field.clearValue() does NOT trigger it (it changes the field's text
    // without firing whatever the app actually listens to), which is why the
    // retry loop below used to burn every attempt against a list that was
    // never going to appear, failing with "~Route 010 still not displayed".
    // Tapping the real icon first is what makes the rest of this method work.
    await this.populateModalListViaClearIcon();

    // With the list populated, the wanted row is often already right there in
    // the unfiltered list - take it directly rather than typing a search term
    // that this modal may not even match (see the digits-only note below).
    const unfiltered = await this.driver.$(`~${resultLabel}`);
    if (await unfiltered.waitForDisplayed({ timeout: 5_000 }).catch(() => false)) {
      await unfiltered.click();
      return;
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await this.tap(this.modalSearchField);
      const field = await this.driver.$(this.modalSearchField);
      await field.clearValue().catch(() => {});
      await this.typeViaAdb(searchTerm);
      const resultEl = await this.driver.$(`~${resultLabel}`);
      const filtered = await resultEl.waitForDisplayed({ timeout: 5_000 }).catch(() => false);
      if (filtered) {
        await resultEl.click();
        return;
      }
    }
    // CORRECTED 2026-08-24 (build 0.1.90, live-verified on Route 001/990):
    // the Select Route modal's search only matches against the route's own
    // number, not its full display label - searching the literal "Route
    // 001"/"Route 990" text (what changeRouteAndSelectDay's own callers
    // naturally pass, matching resultLabel's own wording) returns "No
    // search results found" every time, even though the exact row exists
    // in the unfiltered list. Only a bare numeric search ("001", "990")
    // filters correctly. Retry once with just the digits extracted before
    // giving up - keeps every existing call site working unchanged rather
    // than requiring each caller to know this quirk.
    const digitsOnly = searchTerm.replace(/\D/g, '');
    if (digitsOnly && digitsOnly !== searchTerm) {
      await this.tap(this.modalSearchField);
      const field = await this.driver.$(this.modalSearchField);
      await field.clearValue().catch(() => {});
      await this.typeViaAdb(digitsOnly);
      const resultEl = await this.driver.$(`~${resultLabel}`);
      const filtered = await resultEl.waitForDisplayed({ timeout: 5_000 }).catch(() => false);
      if (filtered) {
        await resultEl.click();
        return;
      }
    }
    // Final attempt already exhausted - let the normal tap() surface a clear
    // timeout error rather than silently trying again.
    await this.tap(`~${resultLabel}`);
  }

  /**
   * Taps a field expected to open a "Search"-labeled modal sheet (Operation
   * or Route), retrying the tap itself if the sheet doesn't appear.
   *
   * CORRECTED 2026-08-21 (build 0.1.86, live-verified): the field can report
   * clickable="true" in the accessibility tree well before the screen has
   * actually finished loading/hydrating - a tap during that window silently
   * no-ops (no error, no modal, nothing) rather than failing loudly.
   * Live-reproduced this repeatedly: the same tap that no-ops immediately
   * after openFromHamburgerMenu() returns succeeds fine a few seconds later.
   * Retrying the tap with a pause, and verifying the modal's own Search
   * field actually appeared before proceeding, closes that gap instead of
   * every caller needing its own workaround.
   */
  private async tapFieldUntilModalOpens(fieldSelector: string, maxAttempts = 4): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await this.tap(fieldSelector);
      const modalField = await this.driver.$(this.modalSearchField);
      const opened = await modalField.waitForDisplayed({ timeout: 4_000 }).catch(() => false);
      if (opened) {
        return;
      }
      await this.driver.pause(2_000);
    }
    // Final attempt already exhausted - let the normal tap() surface a clear
    // timeout error rather than silently trying again.
    await this.tap(fieldSelector);
  }

  /**
   * Taps the Operation field, then searches the resulting "Select operation"
   * modal and taps the matching result by its exact content-desc (the
   * option label, e.g. "Miami, FL"). See typeAndSelectFromModal for the
   * retry behavior.
   */
  async selectOperation(searchTerm: string, resultLabel: string): Promise<void> {
    await this.tapFieldUntilModalOpens(this.operationField);
    await this.typeAndSelectFromModal(searchTerm, resultLabel);
  }

  /** Same pattern as selectOperation, for the "Select route" modal (e.g. "Route 010"). */
  async selectRoute(searchTerm: string, resultLabel: string): Promise<void> {
    await this.tapFieldUntilModalOpens(this.routeField);
    await this.typeAndSelectFromModal(searchTerm, resultLabel);
  }

  /**
   * Taps "Change route", then confirms the "If you proceed all information
   * will be DELETED" dialog's own "Change route" button. Live-verified: only
   * one node with this content-desc exists in the tree at any moment - the
   * main screen's button and the dialog's button never coexist - so the same
   * locator resolves correctly both times.
   */
  async confirmChangeRoute(): Promise<void> {
    await this.tap(this.changeRouteButton);
    await this.tap(this.changeRouteButton);
  }

  /**
   * Waits for the post-confirm sync to finish and the "Select Day" sheet
   * to appear. Sync took 60-90s in live testing - default timeout reflects
   * that rather than BaseScreen's normal 15s element timeout.
   *
   * CORRECTED 2026-08-20 (build 0.1.86, live-verified via uiautomator dump):
   * the sheet's real content-desc is exactly "Select Day", not "Select a
   * day" - the old locator never actually matched anything; it happened not
   * to matter until this same sheet started also appearing as a standalone
   * post-MFA gate (see MfaScreen.waitForManualApproval), which is what
   * surfaced the mismatch.
   */
  async waitForSyncAndDaySheet(timeoutMs = 120_000): Promise<void> {
    const el = await this.driver.$('~Select Day');
    await el.waitForDisplayed({ timeout: timeoutMs });
  }

  // New as of build 0.1.86 (live-verified 2026-08-20): tapping a day option
  // now raises a "Confirm Date!" dialog (content-desc "Confirm Date!\n{DAY}
  // {Weekday} {D} {Mon}") with Cancel/Confirm buttons, before the day is
  // actually applied - previously (build 0.1.76) the tap alone closed the
  // sheet immediately with no intermediate confirmation. Only checked
  // conditionally, not tapped unconditionally: live-verified this dialog
  // only appears when the tap represents a REAL day change (e.g. switching
  // routes/day together) - re-tapping the day that's already active (the
  // common post-MFA "just confirm today" case) closes the sheet directly
  // with no dialog at all, so an unconditional tap here would time out and
  // break that already-working path.
  private readonly confirmDateButton = '~Confirm';

  async selectDay(day: DaySelection): Promise<void> {
    await this.tap(this.daySelector(day));
    if (await this.isVisible(this.confirmDateButton)) {
      await this.tap(this.confirmDateButton);
    }
  }

  /**
   * TC030 "view 'Select a day'" / TC035 "verify date-label mapping" -
   * returns each of the sheet's three options' full content-desc (e.g.
   * "TODAY\nAugust 10, 2026"), in whatever order they appear. Live-verified
   * 2026-08-10: tapping any option immediately applies it and closes the
   * sheet - there's no persistent, inspectable radio-selection state to
   * assert on (checked/selected both read false regardless, even before
   * any tap), so TC031-034's "radio button in green"/"single selection"
   * claims aren't reproducible here - call this BEFORE selectDay(), not
   * after.
   */
  async getDaySheetOptionLabels(): Promise<string[]> {
    const options = await this.driver.$$(
      '//android.view.View[starts-with(@content-desc,"TODAY") or starts-with(@content-desc,"YESTERDAY") or starts-with(@content-desc,"TOMORROW")]'
    );
    const labels: string[] = [];
    for (const option of options) {
      labels.push((await option.getAttribute('content-desc')) ?? '');
    }
    return labels;
  }

  /**
   * Pick operation/route, confirm, wait for sync, pick a day - assumes
   * you're already ON the Route Setup screen (either navigated there via
   * openFromHamburgerMenu(), or landed here directly as a fresh account's
   * mandatory post-MFA gate - see MfaScreen.waitForManualApproval). Does NOT
   * navigate itself, since the two entry paths differ.
   */
  async changeRouteAndSelectDay(params: {
    operationSearch: string;
    operationLabel: string;
    routeSearch: string;
    routeLabel: string;
    day: DaySelection;
  }): Promise<void> {
    await this.selectOperation(params.operationSearch, params.operationLabel);
    await this.selectRoute(params.routeSearch, params.routeLabel);
    await this.confirmChangeRoute();
    await this.waitForSyncAndDaySheet();
    await this.selectDay(params.day);
  }
}
