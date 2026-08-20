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
  private readonly screenTitle = '~Route setup';
  private readonly operationField = '(//android.view.View[@clickable="true"])[1]';
  private readonly routeField = '(//android.view.View[@clickable="true"])[2]';
  private readonly modalSearchField = '//android.widget.EditText';
  private readonly changeRouteButton = '~Change route';

  private daySelector(day: DaySelection): string {
    return `//android.view.View[starts-with(@content-desc,"${day}")]`;
  }

  /** Hamburger menu > Settings (expands the collapsed section) > Route setup.
   * Handles both states: if Settings is already expanded, do not tap the
   * collapsed label again or it will collapse the section instead of opening it.
   */
  async openFromHamburgerMenu(): Promise<void> {
    const settingsCollapsed = await this.isVisible(this.settingsMenuItem);
    const settingsExpanded = await this.isVisible(this.settingsExpandedMarker);

    if (!settingsCollapsed && !settingsExpanded) {
      await this.tap(this.hamburgerIcon);
    }

    if (settingsCollapsed) {
      await this.tap(this.settingsMenuItem);
    } else if (!settingsExpanded) {
      const collapsedVisible = await this.isVisible(this.settingsMenuItem);
      if (collapsedVisible) {
        await this.tap(this.settingsMenuItem);
      }
    }

    await this.tap(this.routeSetupMenuItem);
    await this.waitFor(this.screenTitle);
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
    const settingsCollapsed = await this.isVisible(this.settingsMenuItem);
    const settingsExpanded = await this.isVisible(this.settingsExpandedMarker);

    if (settingsCollapsed) {
      await this.tap(this.settingsMenuItem);
    } else if (settingsExpanded) {
      // Already expanded; continue without re-tapping, or it will collapse
      // the section instead of preserving the current open state.
    } else {
      await this.tap(this.hamburgerIcon);
      const settingsVisibleAfterOpen = await this.isVisible(this.settingsMenuItem);
      if (settingsVisibleAfterOpen) {
        await this.tap(this.settingsMenuItem);
      }
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
  private async typeAndSelectFromModal(searchTerm: string, resultLabel: string, maxAttempts = 3): Promise<void> {
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
    // Final attempt already exhausted - let the normal tap() surface a clear
    // timeout error rather than silently trying a 4th time.
    await this.tap(`~${resultLabel}`);
  }

  /**
   * Taps the Operation field, then searches the resulting "Select operation"
   * modal and taps the matching result by its exact content-desc (the
   * option label, e.g. "Miami, FL"). See typeAndSelectFromModal for the
   * retry behavior.
   */
  async selectOperation(searchTerm: string, resultLabel: string): Promise<void> {
    await this.tap(this.operationField);
    await this.typeAndSelectFromModal(searchTerm, resultLabel);
  }

  /** Same pattern as selectOperation, for the "Select route" modal (e.g. "Route 010"). */
  async selectRoute(searchTerm: string, resultLabel: string): Promise<void> {
    await this.tap(this.routeField);
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
   * Waits for the post-confirm sync to finish and the "Select a day" sheet
   * to appear. Sync took 60-90s in live testing - default timeout reflects
   * that rather than BaseScreen's normal 15s element timeout.
   */
  async waitForSyncAndDaySheet(timeoutMs = 360_000): Promise<void> {
    const el = await this.driver.$('~Select a day');
    await el.waitForDisplayed({ timeout: timeoutMs });
  }

  async selectDay(day: DaySelection): Promise<void> {
    await this.tap(this.daySelector(day));
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
