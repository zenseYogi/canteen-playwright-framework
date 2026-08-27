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
  // CORRECTED 2026-08-20 (live-verified via raw uiautomator dump): this
  // field now carries NO hint/content-desc attribute at all (placeholder
  // text "Search account, location, or kiosk" isn't exposed via any
  // accessible attribute either) - the original hint="Customer" locator
  // never matches anymore. It's the only clickable android.view.View in
  // the Add Delivery screen's content area, immediately below the title -
  // targeted positionally, same rationale as RouteSetupScreen's own
  // operationField/routeField.
  private readonly customerField = '(//android.view.View[@clickable="true"])[1]';
  private readonly addDeliveryButton = '//android.widget.Button[@content-desc="Add Delivery"]';
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

  private accountRowStartingWith(name: string): string {
    return `//android.view.View[starts-with(@content-desc,"${name}")]`;
  }

  /**
   * Selects the Nth already-searched (see searchCustomer) account row whose
   * name starts with `name` - selectCustomer(name) taps the FIRST match, which
   * is wrong when the catalogue carries one trading name at several addresses.
   * Charlotte 103 lists two "American Airlines" (Parkway Plaza Blvd and 4800
   * Hangar) and only the second offers any OCS/Pantry service, so SD-TC-017
   * has to disambiguate by position. starts-with, not contains, so a row that
   * merely mentions the name mid-string cannot shift the indexing.
   *
   * Returns the chosen row's full label (name + address, newlines flattened)
   * so the run records WHICH of the duplicates it actually took.
   */
  async selectSearchedCustomerByIndex(name: string, index: number): Promise<string> {
    const rows = [...(await this.driver.$$(this.accountRowStartingWith(name)))];
    if (rows.length <= index) {
      throw new Error(
        `Expected at least ${index + 1} account row(s) starting with "${name}", found ${rows.length}`
      );
    }
    const desc = ((await rows[index].getAttribute('content-desc')) ?? '').replace(/\n/g, ' | ');
    await rows[index].click();
    return desc;
  }

  /**
   * Labels of every real row in the open account or service sheet, newlines
   * flattened to " | ". For logging what the catalogue actually offered, so a
   * data change shows up in the run output as a changed list rather than as a
   * bare "0 results" that reads like a broken locator.
   */
  async getResultRowLabels(): Promise<string[]> {
    const rows = [...(await this.driver.$$(this.firstMultilineRow))];
    const labels: string[] = [];
    for (const row of rows) {
      labels.push(((await row.getAttribute('content-desc')) ?? '').replace(/\n/g, ' | '));
    }
    return labels;
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
   * Opens the Service picker and selects the "- Market" service belonging to
   * a NAMED account, falling back to the first Market service of any account
   * if that account has none listed.
   *
   * Needed because this picker is NOT scoped to the customer chosen a step
   * earlier (see serviceField's own note - it lists every service station
   * across every account, each tagged with its LOB): selectFirstMarketService()
   * therefore happily attaches a DIFFERENT account's Market station, creating
   * the delivery against the wrong stop. Callers that bootstrap a specific
   * account (e.g. M-TC-014's find-or-create prerequisite, which needs "Pet
   * SuperMarket Sunrise" itself) must match on the account name too.
   */
  async selectMarketServiceFor(accountName: string): Promise<void> {
    await this.tap(this.serviceField);
    const scoped = `//android.view.View[contains(@content-desc,"${accountName}") and contains(@content-desc,"- Market")]`;
    const row = await this.driver.$(scoped);
    if (await row.waitForDisplayed({ timeout: 5_000 }).catch(() => false)) {
      await row.click();
      return;
    }
    await this.tap(this.marketServiceRow);
  }

  /**
   * Opens the Service picker and selects the OCS/Pantry (Coffee) service whose
   * label contains `nameFragment`. Live-verified 2026-08-25 on Charlotte 103
   * that this picker IS scoped to the customer chosen a step earlier (Aaron's
   * offered only its own Vending stations, Amerock only "Maint: Amerock -
   * OCS/Pantry"), so the fragment only has to disambiguate WITHIN one account -
   * Advocate Health, for instance, offers two.
   */
  async selectCoffeeServiceFor(nameFragment: string): Promise<void> {
    await this.tap(this.serviceField);
    await this.tap(`//android.view.View[contains(@content-desc,"${nameFragment}") and contains(@content-desc,"OCS/Pantry")]`);
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

  /**
   * Opens the Service type picker and selects the given type (e.g. "FULL").
   *
   * CORRECTED 2026-08-21 (build 0.1.86, live-verified): for an account with
   * only ONE service station (e.g. AETNA/"Aetna Plantation - Market"), this
   * screen skips the Service type picker entirely - selecting the service
   * lands directly on a form with just a "Continue" button, no
   * serviceTypeField at all. Tapping serviceTypeField in that case used to
   * hang for the full element timeout with no useful error. Now a no-op
   * when the field never appears, so callers don't need to know in advance
   * whether the selected account is single- or multi-service.
   */
  async selectServiceType(type: string): Promise<void> {
    const fieldPresent = await this.isVisible(this.serviceTypeField);
    if (!fieldPresent) {
      return;
    }
    await this.tap(this.serviceTypeField);
    await this.tap(this.serviceTypeOption(type));
  }

  async isAddDeliveryButtonEnabled(): Promise<boolean> {
    return this.isEnabled(this.addDeliveryButton);
  }

  /**
   * CORRECTED 2026-08-21 (build 0.1.86, live-verified): the submit button's
   * own label is "Add Delivery" for a multi-service account (matches
   * addDeliveryButton), but "Continue" for a single-service account whose
   * Service type picker was skipped (see selectServiceType's own note) -
   * trying whichever one is actually present rather than assuming the
   * "Add Delivery" label always applies.
   */
  async submitAddDelivery(): Promise<void> {
    if (await this.isVisible(this.addDeliveryButton)) {
      await this.tap(this.addDeliveryButton);
      return;
    }
    await this.tap(this.continueButton);
  }
}
