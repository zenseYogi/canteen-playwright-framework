import { BaseScreen } from './base.screen';

/**
 * Ad-hoc Delivery creation screen (PBI 850155) - reached via the "+" icon on
 * the Home screen's Schedule pane header (see HomeScreen.
 * openAdhocDeliveryCreation()). Live-verified 2026-07-24:
 * reachable regardless of whether the current day has zero or existing
 * deliveries (tested against a day with 4 real deliveries) - TC027 does NOT
 * require a genuinely empty day to verify, unlike TC025/TC028 (see
 * HomeScreen's noDeliveriesMessage caveat).
 *
 * The title and the submit button share the exact same content-desc text
 * ("Add Delivery") - distinguished only by element type (a plain View for
 * the title, an android.widget.Button for the submit action), confirmed via
 * a live page-source dump.
 */
export class AdhocDeliveryScreen extends BaseScreen {
  private readonly titleText = '//android.view.View[@content-desc="Add Delivery"]';
  private readonly customerField = '//android.view.View[@hint="Account"]';
  private readonly addDeliveryButton = '//android.widget.Button[@content-desc="Continue"]';
  private readonly addAnotherDeliveryButton = '~+ Add Another Delivery';

  // The account picker opened by tapping customerField - a bottom sheet
  // titled "Select an account" with its own EditText search box (live-
  // verified: setValue() alone doesn't trigger the app's filtering, real
  // per-character keystrokes via driver.keys() are required).
  private readonly accountSearchField = '//android.widget.EditText[@hint="Search"]';
  private accountRow(name: string): string {
    return `//android.view.View[contains(@content-desc,"${name}")]`;
  }

  // "Service" - live-verified this list is NOT scoped to the selected
  // customer; it's every service station across every account/kiosk, each
  // tagged with its LOB suffix ("- Market", "- OCS/Pantry"). "OCS/Pantry"
  // (Office Coffee Service) is the Coffee LOB's tag here, confirmed live:
  // selecting one and submitting made the Coffee LOB badge appear on Home
  // (0/1) and on the target account's card (build 0.1.76, 2026-08-06).
  private readonly serviceField = '//android.view.View[contains(@content-desc,"Search by type or number")]';
  private readonly coffeeServiceRow = '//android.view.View[contains(@content-desc,"OCS/Pantry")]';
  private readonly marketServiceRow = '//android.view.View[contains(@content-desc,"- Market")]';
  private readonly serviceTypeField = '//android.view.View[contains(@content-desc,"Select service type")]';
  private serviceTypeOption(type: string): string {
    return `//android.view.View[@content-desc="${type}"]`;
  }

  async isTitleVisible(): Promise<boolean> {
    return this.isVisible(this.titleText);
  }

  async isCustomerFieldVisible(): Promise<boolean> {
    return this.isVisible(this.customerField);
  }

  async isAddDeliveryButtonVisible(): Promise<boolean> {
    return this.isVisible(this.addDeliveryButton);
  }

  async isAddAnotherDeliveryButtonVisible(): Promise<boolean> {
    return this.isVisible(this.addAnotherDeliveryButton);
  }

  /** Opens the "Select an account" sheet and searches it for the given account name - does not select a row. */
  async searchCustomer(name: string): Promise<void> {
    await this.tap(this.customerField);
    const search = await this.driver.$(this.accountSearchField);
    await search.waitForExist({ timeout: 10_000 });
    await search.click();
    for (const ch of name) {
      await this.driver.keys(ch);
    }
  }

  /** Selects an already-searched (see searchCustomer) account row by name. */
  async selectCustomer(name: string): Promise<void> {
    await this.tap(this.accountRow(name));
  }

  /** TC057 "clear selected account" - clears the already-open search field (see searchCustomer), restoring the full unfiltered account list. */
  async clearAccountSearch(): Promise<void> {
    const search = await this.driver.$(this.accountSearchField);
    await search.clearValue();
  }

  // TC058 "no-results state" - live-verified 2026-08-10: a non-matching
  // search shows this exact message in place of any result rows.
  private readonly noSearchResultsMessage = '~No search results found';

  async isNoSearchResultsVisible(): Promise<boolean> {
    return this.isVisible(this.noSearchResultsMessage);
  }

  /** Count of real result rows currently showing in an already-open, already-searched account or service sheet (see firstMultilineRow's own doc comment for why this locator is safe against the sheet's own decorative elements). */
  async getResultRowCount(): Promise<number> {
    const rows = await this.driver.$$(this.firstMultilineRow);
    return rows.length;
  }

  // Generic "first real row" locator shared by both the account-search sheet
  // and the service-picker sheet below - live-verified 2026-08-07: every
  // real row in both sheets is a clickable View whose content-desc packs
  // two lines (name+address, or service label+address) joined by a literal
  // newline, which the sheet's own decorative/backdrop elements (the
  // "Select an account"/"Select Service" label, the "Scrim" backdrop) never
  // have - so this reliably skips those without needing to know any actual
  // account/service name in advance.
  private readonly firstMultilineRow = '//android.view.View[@clickable="true" and contains(@content-desc, "\n")]';

  /**
   * Selects the FIRST row in an already-open, already-searched account
   * sheet (see searchCustomer) without knowing its name in advance - unlike
   * selectCustomer(name), which requires a known account. Used to
   * bootstrap a delivery onto a day that has none yet (see
   * login-flow.ts's ensureAnyDeliveryExistsToday), where no specific
   * account name can be assumed. Returns the row's own name (before the
   * newline) for logging/traceability.
   */
  async selectFirstSearchedCustomer(): Promise<string> {
    const row = await this.driver.$(this.firstMultilineRow);
    await row.waitForDisplayed({ timeout: 10_000 });
    const desc = (await row.getAttribute('content-desc')) ?? '';
    await row.click();
    return desc.split('\n')[0] ?? '';
  }

  /** Opens the Service picker and selects the first row tagged "OCS/Pantry" - Coffee's LOB tag in this list (see coffeeServiceRow). Assumes a customer is already selected. */
  /** TC061 "view Service station drop down" - live-verified: only appears once a customer is selected; the build's own placeholder is "Search by type or number", not the Excel's claimed "Select from account's service stations" (an app-terminology mismatch, not a missing field). */
  async isServiceFieldVisible(): Promise<boolean> {
    return this.isVisible(this.serviceField);
  }

  async isServiceTypeFieldVisible(): Promise<boolean> {
    return this.isVisible(this.serviceTypeField);
  }

  async selectFirstCoffeeService(): Promise<void> {
    await this.tap(this.serviceField);
    await this.tap(this.coffeeServiceRow);
  }

  /** Same as selectFirstCoffeeService, but for Market's own "- Market" tag - used to bootstrap a fresh Market stop when a day's existing ones are all already actioned. */
  async selectFirstMarketService(): Promise<void> {
    await this.tap(this.serviceField);
    await this.tap(this.marketServiceRow);
  }

  /**
   * Opens the Service picker and selects whichever service row comes
   * first, regardless of LOB - unlike selectFirstCoffeeService, which only
   * matches the "OCS/Pantry" tag. Used by ensureAnyDeliveryExistsToday,
   * which only needs SOME delivery to exist (to unblock Start Day), not a
   * specific LOB.
   */
  async selectFirstServiceAnyLob(): Promise<string> {
    await this.tap(this.serviceField);
    const row = await this.driver.$(this.firstMultilineRow);
    await row.waitForDisplayed({ timeout: 10_000 });
    const desc = (await row.getAttribute('content-desc')) ?? '';
    await row.click();
    return desc.split('\n')[0] ?? '';
  }

  /** Opens the Service type picker and selects the given type (e.g. "FULL"). */
  async selectServiceType(type: string): Promise<void> {
    await this.tap(this.serviceTypeField);
    await this.tap(this.serviceTypeOption(type));
  }

  async isAddDeliveryButtonEnabled(): Promise<boolean> {
    return this.isEnabled(this.addDeliveryButton);
  }

  async submitAddDelivery(): Promise<void> {
    await this.tap(this.addDeliveryButton);
  }
}
