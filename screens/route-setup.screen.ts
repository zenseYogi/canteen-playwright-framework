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
  private readonly routeSetupMenuItem = '~Route setup';
  private readonly screenTitle = '~Route Setup';
  private readonly operationField = '(//android.view.View[@clickable="true"])[1]';
  private readonly routeField = '(//android.view.View[@clickable="true"])[2]';
  private readonly modalSearchField = '//android.widget.EditText';
  private readonly changeRouteButton = '~Change route';

  private daySelector(day: DaySelection): string {
    return `//android.view.View[starts-with(@content-desc,"${day}")]`;
  }

  /** Hamburger menu > Settings (expands the collapsed section) > Route setup. */
  async openFromHamburgerMenu(): Promise<void> {
    await this.tap(this.hamburgerIcon);
    await this.tap(this.settingsMenuItem);
    await this.tap(this.routeSetupMenuItem);
    await this.waitFor(this.screenTitle);
  }

  /**
   * Taps the Operation field, types into the resulting "Select operation"
   * modal's search box, and taps the matching result by its exact
   * content-desc (the option label, e.g. "Miami, FL"). The search field
   * needs an explicit tap-to-focus before typing.
   *
   * CORRECTED: BaseScreen.type()'s el.setValue() sets the field's text
   * without going through a real IME/key-event path - confirmed live this
   * silently fails to trigger the list's search-as-you-type filter (the
   * field shows the typed text, but the option list stays fully unfiltered
   * indefinitely, so the subsequent tap on `~${resultLabel}` times out).
   * Same underlying class of issue as the Login WebView fields elsewhere in
   * this codebase - typeViaAdb (real key events) reliably triggers it where
   * setValue() does not.
   */
  async selectOperation(searchTerm: string, resultLabel: string): Promise<void> {
    await this.tap(this.operationField);
    await this.tap(this.modalSearchField);
    await this.typeViaAdb(searchTerm);
    await this.tap(`~${resultLabel}`);
  }

  /** Same pattern as selectOperation, for the "Select route" modal (e.g. "Route 010"). */
  async selectRoute(searchTerm: string, resultLabel: string): Promise<void> {
    await this.tap(this.routeField);
    await this.tap(this.modalSearchField);
    await this.typeViaAdb(searchTerm);
    await this.tap(`~${resultLabel}`);
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
  async waitForSyncAndDaySheet(timeoutMs = 120_000): Promise<void> {
    const el = await this.driver.$('~Select a day');
    await el.waitForDisplayed({ timeout: timeoutMs });
  }

  async selectDay(day: DaySelection): Promise<void> {
    await this.tap(this.daySelector(day));
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
