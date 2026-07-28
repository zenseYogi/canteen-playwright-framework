import { BaseScreen } from './base.screen';
import { positionToIndex, type Position } from '../utils/position';

/**
 * Market LOB - servicing a delivery location. Ported from market_keywords.robot.
 */
export class MarketServiceScreen extends BaseScreen {
  // CORRECTED (live-verified against build 0.1.73): real content-desc is
  // lowercase "market", not "Market" - see DashboardScreen's marketLob for
  // the same fix and full context.
  private readonly marketLob = '//android.widget.ImageView[contains(@content-desc,"market")]';
  private readonly fillsTitle = '~Product fills';
  private readonly audit = '//android.view.View[starts-with(@content-desc,"Audit")]';
  // Excel TC010 "view the delivery header" - the account/location name
  // (e.g. "CuraLeaf") shown as the bold header on the service stop's
  // checklist screen (Before Photos, Removals & Returns, Delivery, Audit,
  // After Photos, Market Transfers). Live-verified 2026-07-27: it's a plain
  // View with no fixed prefix (varies per location) - located structurally,
  // immediately preceding the Before Photos tile.
  private readonly serviceStopLocationHeader =
    '//android.view.View[starts-with(@content-desc,"Before Photos")]/preceding-sibling::android.view.View[1]';
  // Excel TC015/TC021/TC022/TC025 ("Before Photo" sub-area) - live-verified
  // 2026-07-27 on Market's own checklist ("CuraLeaf" stop). Same
  // shared/LOB-agnostic component already exercised via Coffee's "Before
  // Photos" tile in coffee-service.spec.ts (see BaseScreen's
  // openPhotoTrigger/openSkipPhotoReasonSheet) - only the trigger locator
  // is LOB-specific.
  private readonly beforePhotos = '//android.view.View[starts-with(@content-desc,"Before Photos")]';

  // Money-operations fields: RF declared these in coffee.yaml (there is no
  // market.yaml) and market_keywords.robot never imports coffee.yaml
  // directly - they're only reachable there because Robot Framework's
  // variable scope is effectively suite-global once ANY loaded resource
  // pulls them in (test.robot happens to also load coffee_keywords.robot),
  // not because market_keywords.robot actually declared this dependency.
  // This might mean Money Operations is a genuinely shared, LOB-agnostic
  // screen in the real app - worth confirming - but the method stays here,
  // matching where RF's own keyword ("Market Perform Money operations") lived.
  private readonly moneyOperations = '//android.view.View[starts-with(@content-desc, "Money Operations")]';
  private readonly skipMoneyBagCheckbox = '//android.widget.CheckBox';
  private readonly bagCodeField = '//android.widget.ScrollView/android.widget.EditText[1]';
  private readonly coinsField = '//android.widget.ScrollView/android.widget.EditText[2]';
  private readonly billsField = '//android.widget.ScrollView/android.widget.EditText[3]';
  private readonly refundField = '//android.widget.ScrollView/android.widget.EditText[4]';
  // Live-verified (build 0.1.73): the Money Operations sub-screen's own
  // title is "Money Collection", NOT "Money Operations" - that's only the
  // trigger tile's label on the LOB service menu.
  private readonly moneyCollectionTitle = '~Money Collection';

  // "Add product" screen, reached from Product fills' add_cta button.
  // Live-verified: search field visible but has NO content-desc/hint of its
  // own (see docs/rf-to-playwright-reuse.md) - only the screen-level
  // elements below have real anchors.
  private readonly addProductTitle = '~Add product';
  private readonly addProductCancelButton = '~Cancel';
  private readonly addProductAddButton = '~Add';

  // PBI 611013 "Fill Screen" - live-verified against build 0.1.76 (Miami/010,
  // CureLeaf/FedEx). Each Product fills row's content-desc concatenates
  // "{Name}\nMore info\nPkg: N" - after tapping the row's own expand icon (its
  // only clickable child besides the Delivery quantity field, no content-desc
  // of its own), it appends "\nPar X\nOrdered Y\nPicked Z" to the SAME
  // content-desc rather than exposing them as separate elements - so the
  // review counts are read by parsing that string, not via their own locators.
  // The expand icon itself has no stable attribute of its own either; it's
  // targeted structurally as the row's first child (the second child is
  // always the Delivery EditText, confirmed live).
  private readonly fillProductRow = '//android.view.View[contains(@content-desc,"More info")]';
  private fillProductRowAt(position: Position): string {
    return `(${this.fillProductRow})[${positionToIndex(position, 1)}]`;
  }
  private fillExpandIcon(position: Position): string {
    return `${this.fillProductRowAt(position)}/android.view.View[1]`;
  }
  private fillFieldByHint(position: Position, hint: string): string {
    return `${this.fillProductRowAt(position)}//android.widget.EditText[@hint="${hint}"]`;
  }

  // TC101-103's custom numeric keypad - live-verified 2026-07-28: focusing
  // any Theft/Damaged/Returned/Spoiled/Delivery field replaces the system
  // IME with an in-app keypad (digits, -/+, backspace, confirm, and Up/Down
  // arrows that move focus to the previous/next quantity field without
  // closing the keypad). The Up/Down arrow buttons have no content-desc of
  // their own (same class of icon-only-button gap as elsewhere in this
  // port) - located structurally as the sibling immediately after the
  // "3"/"6" digit buttons respectively, which live-verified are always
  // present and unique in this keypad's layout.
  private numericKeypadDigit(d: string): string {
    return `//android.widget.Button[@content-desc="${d}"]`;
  }
  private readonly numericKeypadUpArrow = `${this.numericKeypadDigit('3')}/following-sibling::android.widget.Button[1]`;
  private readonly numericKeypadDownArrow = `${this.numericKeypadDigit('6')}/following-sibling::android.widget.Button[1]`;
  // TC111's backspace key - live-verified 2026-07-28: only removes digits
  // actually typed in the current session's entry buffer. Has no effect on
  // an untouched seeded default ("10" stays "10") - the field must be
  // touched by a digit tap first (which replaces the default per
  // tapKeypadDigit's own note) before backspace can empty it out.
  private readonly numericKeypadBackspace = `${this.numericKeypadDigit('9')}/following-sibling::android.widget.Button[1]`;
  // Excel TC113's "saved successfully" confirmation, shown as a toast right
  // after tapping Continue on Product fills - exact content-desc match,
  // live-verified 2026-07-28.
  private readonly savedSuccessToast = '~saved successfully.';

  /** Excel TC101 "see numeric keypad when entering Delivered" - checks for the keypad's own digit buttons rather than the system IME, since this is a custom in-app keypad. */
  async isNumericKeypadVisible(): Promise<boolean> {
    return this.isVisible(this.numericKeypadDigit('1'));
  }

  /** Excel TC102/TC103 - moves focus to the previous quantity field without closing the keypad. */
  async tapKeypadUpArrow(): Promise<void> {
    await this.tap(this.numericKeypadUpArrow);
  }

  /** Excel TC102/TC103 - moves focus to the next quantity field without closing the keypad. */
  async tapKeypadDownArrow(): Promise<void> {
    await this.tap(this.numericKeypadDownArrow);
  }

  /**
   * Taps a digit key (0-9) on the custom numeric keypad. Live-verified
   * 2026-07-28: the FIRST digit tap after focusing a field that already
   * holds a committed value (its seeded default, or whatever was left from
   * a previous visit) replaces that value outright; subsequent digit taps
   * within the same continuous entry append normally (building "5" then
   * "53") - see TC099/TC100's own test-step comments for the exact
   * sequences that proved this. Deliberately NOT implemented via
   * WebdriverIO's setValue() - that bypasses the app's own keypress
   * handling and gave inconsistent results across runs (sometimes
   * replacing, sometimes not) when this was first investigated.
   */
  async tapKeypadDigit(digit: string): Promise<void> {
    await this.tap(this.numericKeypadDigit(digit));
  }

  /**
   * TC104's decrement stepper - NOT a minus-sign/negative-number key
   * despite sharing the visual "-" label with what looks like a sign
   * toggle. Live-verified 2026-07-28: digit keys can never produce a "-"
   * at all; only this stepper can decrement a value, and it's floor-
   * clamped at 0 - tapping it on a field already at 0 leaves it at 0. This
   * is how "unable to enter negative Delivered" is actually implemented.
   */
  async tapKeypadDecrement(): Promise<void> {
    await this.tap(this.numericKeypadDigit('-'));
  }

  /** Excel TC111 - see numericKeypadBackspace's own note on when this actually removes anything. */
  async tapKeypadBackspace(): Promise<void> {
    await this.tap(this.numericKeypadBackspace);
  }

  /**
   * Excel TC113 "proceed to next screen with valid entries" - tapping
   * Continue on Product fills shows a "saved successfully" toast and
   * returns to the service stop checklist, where the Delivery tile is now
   * complete (live-verified 2026-07-28). Does NOT assert the tile's own
   * green/checkmark visual state - its content-desc is unchanged from the
   * incomplete state (no accessible signal to key off), so the toast is
   * the reliable assertion; the tile state is confirmed only via screenshot
   * evidence.
   */
  async submitFillsAndReturnToChecklist(): Promise<void> {
    await this.tap(this.continueButton);
    await this.waitFor(this.savedSuccessToast);
  }

  async isSavedSuccessToastVisible(): Promise<boolean> {
    return this.isVisible(this.savedSuccessToast);
  }

  async clickServiceLocation(position: Position): Promise<void> {
    await this.selectServiceLocation(this.marketLob, position);
  }

  /** Excel TC010 "view the delivery header" - assumes the service stop's checklist screen is already open. */
  async isServiceStopLocationHeaderVisible(): Promise<boolean> {
    return this.isVisible(this.serviceStopLocationHeader);
  }

  async getServiceStopLocationHeaderText(): Promise<string> {
    const el = await this.driver.$(this.serviceStopLocationHeader);
    return (await el.getAttribute('content-desc')) ?? '';
  }

  /** Opens the Before Photos step's "Add supporting photo" modal - see BaseScreen's openPhotoTrigger/isPhotoModalVisible/openSkipPhotoReasonSheet for the shared skip-photo flow beyond this. */
  async openBeforePhotos(): Promise<void> {
    await this.openPhotoTrigger(this.beforePhotos);
  }

  async isProductFillsTitleVisible(): Promise<boolean> {
    return this.isVisible(this.fillsTitle);
  }

  /**
   * Ported from the Excel's Money Operations field-presence TCs (view all
   * sections, Skip Money Bag label, Replenishment Amount/Refund fields) -
   * all five locators confirmed live against build 0.1.73. Does NOT assert
   * validation behavior (reject negative/alphabetic input etc.) - that's
   * unverified, see docs/rf-to-playwright-reuse.md.
   */
  async isMoneyCollectionScreenVisible(): Promise<{
    title: boolean;
    skipMoneyBag: boolean;
    bagCode: boolean;
    coins: boolean;
    bills: boolean;
    refund: boolean;
  }> {
    return {
      title: await this.isVisible(this.moneyCollectionTitle),
      skipMoneyBag: await this.isVisible(this.skipMoneyBagCheckbox),
      bagCode: await this.isVisible(this.bagCodeField),
      coins: await this.isVisible(this.coinsField),
      bills: await this.isVisible(this.billsField),
      refund: await this.isVisible(this.refundField)
    };
  }

  private async openProductFills(): Promise<void> {
    await this.tap(this.deliveryTrigger);
    await this.waitFor(this.fillsTitle);
  }

  /** Public alias for PBI 611013's "Tap 'Fills' to open the refill details page" - same screen as openProductFills(), just the PBI's own vocabulary (the live tile is labeled "Delivery", not "Fills"). */
  async openFills(): Promise<void> {
    await this.openProductFills();
  }

  /** Excel TC092 "view route details and date in the header" - the same shared date/route pill as every other screen (see BaseScreen's isDateRouteHeaderVisible), just re-exposed under Product fills' own PBI note below. */
  async isFillsHeaderVisible(): Promise<{ date: boolean; route: boolean }> {
    return this.isDateRouteHeaderVisible();
  }

  /** Excel TC093 "view header actions" - Filter/Sort/Add icons on the Product fills header, live-verified 2026-07-27 (build 0.1.76). */
  async isFillsHeaderActionsVisible(): Promise<{ add: boolean; sort: boolean; filter: boolean }> {
    return {
      add: await this.isVisible(this.addProductButton),
      sort: await this.isVisible(this.sortCta),
      filter: await this.isVisible(this.filterCta)
    };
  }

  /** Excel TC094 "view products to be refilled" - count of rendered product rows. */
  async getFillProductRowCount(): Promise<number> {
    const rows = await this.driver.$$(this.fillProductRow);
    return rows.length;
  }

  /**
   * Excel TC095 "view product title" / TC096 "view package info" - both
   * read from the same row content-desc string ("{Name}\nMore info\nPkg: N")
   * documented on fillProductRow above, not separate locators.
   */
  async getFillProductRowSummary(position: Position = 'first'): Promise<{ name: string; pkg: number }> {
    const row = await this.driver.$(this.fillProductRowAt(position));
    const desc = (await row.getAttribute('content-desc')) ?? '';
    const name = desc.split('\n')[0] ?? '';
    const pkg = Number(/Pkg: (\d+)/.exec(desc)?.[1]);
    return { name, pkg };
  }

  /** PBI 611013 step 3: expand a product row to reveal Par Stock/Ordered/Picked plus the Theft/Damaged/Returned/Spoiled/Delivery entry fields. */
  async expandProductFill(position: Position = 'first'): Promise<void> {
    await this.tap(this.fillExpandIcon(position));
  }

  /**
   * Reads Par Stock Count / Ordered Quantity / Picked Quantity - live-verified
   * these are NOT separate elements, just appended text in the row's own
   * content-desc after expansion (see fillProductRow above), so they're read
   * by parsing that string rather than three distinct locators.
   */
  async getProductFillReview(position: Position = 'first'): Promise<{ par: number; ordered: number; picked: number }> {
    const row = await this.driver.$(this.fillProductRowAt(position));
    const desc = (await row.getAttribute('content-desc')) ?? '';
    const par = Number(/Par (\d+)/.exec(desc)?.[1]);
    const ordered = Number(/Ordered (\d+)/.exec(desc)?.[1]);
    const picked = Number(/Picked (\d+)/.exec(desc)?.[1]);
    return { par, ordered, picked };
  }

  /** Whether the Theft/Damaged/Returned/Spoiled/Delivery entry fields are visible - only true after expandProductFill() has been called for the same position. */
  async isFillEntryVisible(position: Position = 'first'): Promise<{
    theft: boolean;
    damaged: boolean;
    returned: boolean;
    spoiled: boolean;
    delivered: boolean;
  }> {
    return {
      theft: await this.isVisible(this.fillFieldByHint(position, 'Theft')),
      damaged: await this.isVisible(this.fillFieldByHint(position, 'Damaged')),
      returned: await this.isVisible(this.fillFieldByHint(position, 'Returned')),
      spoiled: await this.isVisible(this.fillFieldByHint(position, 'Spoiled')),
      delivered: await this.isVisible(this.fillFieldByHint(position, 'Delivery'))
    };
  }

  /** PBI 611013 step 3: enter Theft/Damaged/Returned/Spoiled quantities, then the Delivered quantity - assumes expandProductFill() was already called for this position. */
  async enterFillQuantities(
    position: Position = 'first',
    values: { theft?: string; damaged?: string; returned?: string; spoiled?: string; delivered?: string } = {}
  ): Promise<void> {
    if (values.theft !== undefined) await this.type(this.fillFieldByHint(position, 'Theft'), values.theft);
    if (values.damaged !== undefined) await this.type(this.fillFieldByHint(position, 'Damaged'), values.damaged);
    if (values.returned !== undefined) await this.type(this.fillFieldByHint(position, 'Returned'), values.returned);
    if (values.spoiled !== undefined) await this.type(this.fillFieldByHint(position, 'Spoiled'), values.spoiled);
    if (values.delivered !== undefined) await this.type(this.fillFieldByHint(position, 'Delivery'), values.delivered);
  }

  /**
   * Opens "Add product" from the Product fills screen's add_cta button -
   * entry point only (Excel TC147). The actual search flow opens a separate
   * "Search product" modal with its own structure, not yet built - see
   * docs/rf-to-playwright-reuse.md's live verification notes.
   */
  async openAddProductFromFills(): Promise<void> {
    await this.openProductFills();
    await this.tap(this.addProductButton);
    await this.waitFor(this.addProductTitle);
  }

  async isAddProductScreenVisible(): Promise<boolean> {
    return this.isVisible(this.addProductTitle);
  }

  /** Excel TC153 "view Cancel and Add buttons disabled (no input)" - Cancel is confirmed always enabled; Add is confirmed disabled until valid input. */
  async addProductButtonStates(): Promise<{ cancelEnabled: boolean; addEnabled: boolean }> {
    return {
      cancelEnabled: await this.isEnabled(this.addProductCancelButton),
      addEnabled: await this.isEnabled(this.addProductAddButton)
    };
  }

  /** Opens Money Operations without filling/submitting anything - lets callers assert field presence before performMoneyOperations() commits values. */
  async openMoneyOperations(): Promise<void> {
    await this.tap(this.moneyOperations);
    await this.waitFor(this.skipMoneyBagCheckbox);
  }

  async performMoneyOperations(
    values: { bagCode?: string; coins?: string; bills?: string; refund?: string } = {}
  ): Promise<void> {
    await this.openMoneyOperations();
    await this.type(this.bagCodeField, values.bagCode ?? '1234');
    await this.type(this.coinsField, values.coins ?? '12');
    await this.type(this.billsField, values.bills ?? '120');
    await this.pressKeyCode(66);
    await this.type(this.refundField, values.refund ?? '0.05');
    await this.tap(this.continueButton);
  }

  async performDelivery(): Promise<void> {
    await this.openProductFills();
    await this.tap(this.continueButton);
  }

  async performAudit(searchTerm: string): Promise<void> {
    await this.tap(this.audit);
    // RF's own keyword waits on this same locator twice in a row (once
    // before the tap, once after) - kept as-is, likely just confirming the
    // next screen (which reuses the same "Audit" label) has loaded.
    await this.waitFor(this.audit);
    await this.searchAndSelect(searchTerm);
    await this.tap(this.continueButton);
  }
}
