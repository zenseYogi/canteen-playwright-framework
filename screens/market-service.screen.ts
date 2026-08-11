import { execSync } from 'child_process';
import { BaseScreen } from './base.screen';
import { positionToIndex, type Position } from '../utils/position';
import { mobileConfig } from '../config/mobile.config';

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
  // Excel TC274/TC277/TC278 ("After Photo" sub-area) - same shared
  // component as beforePhotos above (BaseScreen's openPhotoTrigger/
  // openSkipPhotoReasonSheet), live-verified 2026-08-03 on CureLeaf. Unlike
  // Before Photos, this tile starts split into two non-clickable elements
  // (title + subtitle) until Before Photos, Removals & Returns, Delivery,
  // AND Audit are ALL completed first - same gated-tile pattern already
  // documented for Vending's own After Photos.
  private readonly afterPhotos = '//android.view.View[starts-with(@content-desc,"After Photos")]';

  // Excel TC301/TC302 (Market to Market Transfer, PBI 739293) - live-
  // verified 2026-07-28: the "Market Transfers\n{N} Transfers" checklist
  // tile is always present, but with only one market on this route/day
  // (Route 10/YESTERDAY), tapping it shows an info popup instead of the
  // actual Transfers screen: "Market Transfers can not be created because
  // only one market is available." + a two-paragraph explanation ("Today"/
  // "Future") + OK - confirmed exact wording matches the Excel's own TC302
  // Test Data almost verbatim. TC303-TC307 (the real Transfers screen's own
  // Expand All/Collapse All, manual/scan product add, delete) are NOT
  // reachable in this environment - this route never has more than one
  // market - so they're documented as blocked, not asserted (same category
  // as TC134's earlier blocked-not-a-test-bug finding).
  private readonly marketTransfersTile = '//android.view.View[starts-with(@content-desc,"Market Transfers")]';
  private readonly onlyOneMarketMessage = '~Market Transfers can not be created because only one market is available.';
  private readonly onlyOneMarketOkButton = '~OK';

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
  private readonly addProductTitle = '~Add product';
  private readonly addProductCancelButton = '~Cancel';
  private readonly addProductAddButton = '~Add';

  // Excel TC150-TC173/TC178-TC179 (Market "Delivery - Add Product" sub-area,
  // PBI 611013) - live-verified 2026-07-28 (build 0.1.76, Route 10/YESTERDAY,
  // first Market stop):
  //
  //   1. The "Add product" screen's own inline search field (hint =
  //      "Product\nScan or search brand, name, sku" - label and helper text
  //      packed together, joined by \n, same hint-encoding pattern already
  //      seen on skipPhotoReasonField) has a decorative search icon on its
  //      left and a clickable scanner icon on its right.
  //   2. Tapping that field navigates to a SEPARATE "Search product" screen
  //      with its own EditText (hint="Search", does NOT mutate) and its own
  //      scanner icon - typing there filters a live results list, each row's
  //      content-desc formatted "{Name} ({size}) - pkg: {N}\nSKU: {sku}".
  //   3. Selecting a result row returns to "Add product" with a NEW Qty
  //      EditText rendered below the search field, defaulting to "1" and
  //      already focused - its `hint` packs the selected product's name,
  //      SKU, and Pkg together with the "Qty" label (e.g. "Snickers
  //      1.86oz\nSKU: 19515\nPkg: 1\nQty"), reusing the SAME custom numeric
  //      keypad as the Fill screen's Theft/Damaged/.../Delivery fields (see
  //      numericKeypadDigit/tapKeypadDecrement above) - confirmed the "+"
  //      stepper increments and "-" decrements/floor-clamps at 0 exactly
  //      like that keypad, and Add itself becomes DISABLED at Qty=0 (a real
  //      validation this sub-flow has that the Fill screen's Continue does
  //      NOT - don't assume the two screens' button-enablement rules match).
  //   4. Live-verified max entry length is 3 digits (typing "1" six times in
  //      a row landed as "111", not more) - Excel's TC170 guessed "e.g. 4".
  private readonly productSearchField = '//android.widget.EditText[starts-with(@hint,"Product")]';
  private readonly searchProductTitle = '~Search product';
  private readonly searchProductField = '//android.widget.EditText[@hint="Search"]';
  private readonly noSearchResultsMessage = '~No search results found';
  private readonly addProductQtyField = '//android.widget.EditText[contains(@hint,"Qty")]';
  private searchResultRow(labelPrefix: string): string {
    return `//android.view.View[starts-with(@content-desc,"${labelPrefix}")]`;
  }

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

  /** Excel TC112 (Market "Delivery") - whether Product fills' own Continue button is currently enabled. */
  async isFillsContinueEnabled(): Promise<boolean> {
    return this.isEnabled(this.continueButton);
  }

  /**
   * Excel TC112 "enter valid data in all visible rows -> Continue enabled" -
   * expands and fills the Delivery field of every CURRENTLY RENDERED
   * product row (not the whole, possibly virtualized, catalog - unlike
   * Vending's fillAllProductDeliveryQuantities, no scroll-and-repeat loop
   * here since this is scoped to "visible rows" per the Excel's own
   * wording) using the same keypad-digit-tap approach already proven by
   * tapKeypadDigit (setValue() bypasses the app's real validation wiring).
   */
  async fillAllVisibleDeliveryQuantities(quantity = '5'): Promise<void> {
    const rowCount = await this.getFillProductRowCount();
    const positions: Position[] = ['first', 'second', 'third', 'fourth'];
    // Position only models up to 'fourth' - callers with a larger visible
    // row count should use a market stop with 4 or fewer catalog items.
    for (let i = 0; i < Math.min(rowCount, positions.length); i++) {
      const position = positions[i];
      await this.expandProductFill(position);
      const field = await this.driver.$(this.fillFieldByHint(position, 'Delivery'));
      await field.click();
      for (const digit of quantity) {
        await this.tapKeypadDigit(digit);
      }
      await this.driver.hideKeyboard().catch(() => {});
    }
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

  /** Opens the After Photos step's "Add supporting photo" modal - see this class's own note above afterPhotos on the tiles that must be completed first, and BaseScreen's openPhotoTrigger/isPhotoModalVisible/openSkipPhotoReasonSheet for the shared skip-photo flow beyond this. */
  async openAfterPhotos(): Promise<void> {
    await this.openPhotoTrigger(this.afterPhotos);
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

  /** Excel TC189/TC194/TC199/TC204 - every visible row's own name, in on-screen order, for asserting sort-order changes (e.g. A-Z ascending vs Z-A descending). */
  async getFillProductNamesInOrder(): Promise<string[]> {
    const rows = await this.driver.$$(this.fillProductRow);
    const names: string[] = [];
    for (const row of rows) {
      const desc = (await row.getAttribute('content-desc')) ?? '';
      names.push(desc.split('\n')[0] ?? '');
    }
    return names;
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
    await this.openAddProduct();
  }

  /**
   * Same as openAddProductFromFills() minus the initial navigation to
   * Product fills - for callers already ON that screen (e.g. right after
   * cancelAddProduct()/confirmAddProduct(), both of which return there
   * directly rather than back out to the outer checklist).
   */
  async openAddProduct(): Promise<void> {
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

  /**
   * Excel TC150/TC151 - the "Product" field's label and helper text are
   * both packed into its own `hint`, joined by \n - but live-verified
   * 2026-07-28: the helper-text half only appears once the field is
   * actually FOCUSED (a tap that does NOT yet navigate to Search product -
   * that only happens once typing starts). Before focus, the hint is just
   * "Product" alone. Callers must tap the field first (see openSearchProduct
   * below, which does this same tap before waiting for the navigation).
   */
  async getProductSearchFieldLabelAndHelper(): Promise<{ label: string; helper: string }> {
    await this.tap(this.productSearchField);
    const el = await this.driver.$(this.productSearchField);
    const hint = (await el.getAttribute('hint')) ?? '';
    const [label, helper] = hint.split('\n');
    return { label: label ?? '', helper: helper ?? '' };
  }

  /** Excel TC152 - the scanner icon on the "Add product" screen's own inline field (right-hand sibling ImageView of the field itself). */
  async isAddProductScannerIconVisible(): Promise<boolean> {
    return this.isVisible(`${this.productSearchField}/following-sibling::android.widget.ImageView[2]`);
  }

  async isSearchProductScreenVisible(): Promise<boolean> {
    return this.isVisible(this.searchProductTitle);
  }

  /** Excel TC155 - the Search product screen's own scanner icon. */
  async isSearchScannerIconVisible(): Promise<boolean> {
    return this.isVisible(`${this.searchProductField}/following-sibling::android.widget.ImageView[2]`);
  }

  /**
   * Excel TC154/TC156-TC161 - tapping the "Product" field alone does NOT
   * yet navigate anywhere (live-verified 2026-07-28: a tap with no typing
   * leaves the "Add product" screen's own title in place) - the separate
   * "Search product" screen only appears once actual typing starts, so
   * TC154's "open Search product screen" and TC156's "type characters" are
   * really the same live action, not two sequential ones. Types character
   * by character via adb, with a pause between each - a single `adb shell
   * input text` call drops/truncates characters here (live-verified:
   * "Snickers" landed as just "S", "Dark" as "Drk"), since this field
   * re-renders its results list on every keystroke and a fast multi-char
   * burst races that re-render. Same class of issue as setValue()'s
   * unreliability on the custom numeric keypad elsewhere in this suite,
   * different mechanism.
   */
  async searchProduct(text: string): Promise<void> {
    // Matches whichever field is currently on screen - the "Add product"
    // screen's own field (first call, not yet navigated) or the "Search
    // product" screen's field (every call after, already navigated).
    // Clears any previous search text on the SAME resolved element handle
    // (not a fresh lookup right after) - re-querying immediately after a
    // clear races this field's re-render and intermittently finds nothing.
    const field = await this.driver.$('//android.widget.EditText[starts-with(@hint,"Product") or @hint="Search"]');
    await field.click();
    await field.clearValue().catch(() => {});
    await this.driver.pause(300);
    const deviceName = mobileConfig.capabilities['appium:deviceName'];
    for (const ch of text) {
      execSync(`adb -s ${deviceName} shell input text "${ch === ' ' ? '%s' : ch}"`);
      await this.driver.pause(220);
    }
    await this.waitFor(this.searchProductTitle);
  }

  /** Excel TC161 "view empty results" - live-verified exact text is "No search results found" (Excel's own wording, "No results found", is close but not exact). */
  async isNoSearchResultsVisible(): Promise<boolean> {
    return this.isVisible(this.noSearchResultsMessage);
  }

  /** Excel TC162 - selects a result row by its label PREFIX (name+size, e.g. "Snickers (1.86oz) - pkg: 1") - content-desc also carries a live SKU suffix after a newline. */
  async selectSearchResult(labelPrefix: string): Promise<void> {
    await this.tap(this.searchResultRow(labelPrefix));
    await this.waitFor(this.addProductQtyField);
  }

  /**
   * Reads the FIRST result row's own content-desc ("{Name} ({size}) - pkg:
   * {N}\nSKU: {sku}") without assuming any specific product/SKU - seed data
   * for a given search term (e.g. "Snickers") isn't stable across
   * environments/time (live-verified 2026-08-07: pkg size/SKU for the same
   * search term had already changed since this suite was first written).
   * Callers that need a specific row to select or a SKU to search by should
   * derive it from this rather than hardcoding either.
   */
  async getFirstSearchResultContentDesc(): Promise<string> {
    const row = await this.driver.$(
      '(//android.view.View[contains(@content-desc,"pkg:") and contains(@content-desc,"SKU:")])[1]'
    );
    return (await row.getAttribute('content-desc')) ?? '';
  }

  /** Excel TC163 - the Add product details Qty field's `hint` packs the selected product's name/SKU/Pkg together with the "Qty" label (e.g. "Snickers 1.86oz\nSKU: 19515\nPkg: 1\nQty"). */
  async getAddProductSummary(): Promise<{ name: string; sku: string; pkg: string }> {
    const el = await this.driver.$(this.addProductQtyField);
    const hint = (await el.getAttribute('hint')) ?? '';
    const [name, sku, pkg] = hint.split('\n');
    return { name: name ?? '', sku: sku ?? '', pkg: pkg ?? '' };
  }

  /** Excel TC164/TC165 - the Add product details' own Qty entry, reusing the Fill screen's custom numeric keypad. */
  async isAddProductQtyKeypadVisible(): Promise<boolean> {
    return this.isNumericKeypadVisible();
  }

  async getAddProductQtyValue(): Promise<string> {
    const el = await this.driver.$(this.addProductQtyField);
    return (await el.getAttribute('text')) ?? '';
  }

  /** Excel TC165's "+" side of the stepper pair - see tapKeypadDecrement's own note; increments and has no verified ceiling clamp (unlike the floor-clamped decrement). */
  async tapKeypadIncrement(): Promise<void> {
    await this.tap(this.numericKeypadDigit('+'));
  }

  /** Excel TC173 - Cancel returns to Product fills without adding anything. */
  async cancelAddProduct(): Promise<void> {
    await this.tap(this.addProductCancelButton);
    await this.waitFor(this.fillsTitle);
  }

  /** Excel TC178 - Add returns to Product fills with the new row visible. */
  async confirmAddProduct(): Promise<void> {
    await this.tap(this.addProductAddButton);
    await this.waitFor(this.fillsTitle);
  }

  /**
   * Precondition for any test that needs Product fills to have SOME rows
   * (e.g. Sort/Filter tests) - guarantees this by adding one via the real
   * Add Product flow for each name in seedProductNames, but ONLY when the
   * list is currently empty. Live-verified 2026-08-07: this stop's Fill
   * list can genuinely run empty (repeated live test runs against the same
   * day's seeded data consume/complete those par items server-side) - a
   * bare assertion on row count then fails for a data reason, not a code
   * reason. Never adds anything when rows already exist - re-seeding on
   * top of real data would corrupt whatever a previous run intentionally
   * left in place, and duplicate rows aren't the point of this precondition.
   * Call from Product fills, before reading any row/category count.
   */
  async ensureFillableProductsExist(seedProductNames: string[] = ['Snickers', 'Doritos', 'Cheetos']): Promise<void> {
    if ((await this.getFillProductRowCount()) > 0) return;
    for (const name of seedProductNames) {
      if (await this.addFirstSearchResultProduct(name)) return;
    }
  }

  /**
   * Same precondition as ensureFillableProductsExist, but for tests that
   * specifically need at least `minCategories` distinct filter categories
   * (e.g. the multi-select filter tests) - a bare row-count check isn't
   * enough for those: live-verified 2026-08-07 that a stop can have exactly
   * 1 row/1 category (e.g. left behind by ensureFillableProductsExist's own
   * single-product top-up in an earlier run) which satisfies "not empty"
   * but not "has 2+ categories to choose between". Only adds MORE products
   * if the category count actually falls short - re-checks after each add
   * rather than adding the whole seed list blindly, so a catalog that
   * already has enough categories is left untouched.
   */
  async ensureMultipleFillCategoriesExist(
    seedProductNames: string[] = ['Snickers', 'Doritos', 'Cheetos', 'Baby Ruth', 'Skittles'],
    minCategories = 2
  ): Promise<number> {
    let categoryCount = await this.currentFilterCategoryCount();
    for (const name of seedProductNames) {
      if (categoryCount >= minCategories) break;
      if (await this.addFirstSearchResultProduct(name)) {
        categoryCount = await this.currentFilterCategoryCount();
      }
    }
    return categoryCount;
  }

  /** Opens the filter sheet, reads the category count, then closes it again (BACK dismisses the bottom sheet without applying) - leaves the caller back on Product fills exactly as found. */
  private async currentFilterCategoryCount(): Promise<number> {
    await this.openFilterSheet();
    const count = (await this.getAllFilterChipLabels()).length;
    await this.driver.back();
    await this.waitFor(this.fillsTitle);
    return count;
  }

  /** Searches for `name` via Add Product and adds the FIRST result if any match; returns whether a product was actually added. */
  private async addFirstSearchResultProduct(name: string): Promise<boolean> {
    await this.openAddProduct();
    await this.searchProduct(name);
    const noResults = await this.isNoSearchResultsVisible().catch(() => false);
    if (noResults) {
      await this.cancelAddProduct().catch(() => {});
      return false;
    }
    const contentDesc = await this.getFirstSearchResultContentDesc();
    if (!contentDesc) {
      await this.cancelAddProduct().catch(() => {});
      return false;
    }
    const label = contentDesc.split('\n')[0] ?? '';
    await this.selectSearchResult(label);
    await this.confirmAddProduct();
    return true;
  }

  /** Excel TC301 - taps the "Market Transfers" checklist tile; live-verified this environment always has only one market, so this consistently lands on the TC302 info popup rather than the real Transfers screen. */
  async openMarketTransfers(): Promise<void> {
    await this.tap(this.marketTransfersTile);
  }

  /** Excel TC302 - the "only one market available" info popup shown in place of the real Transfers screen. */
  async isOnlyOneMarketMessageVisible(): Promise<boolean> {
    return this.isVisible(this.onlyOneMarketMessage);
  }

  async dismissOnlyOneMarketMessage(): Promise<void> {
    await this.tap(this.onlyOneMarketOkButton);
  }

  /** Opens Money Operations without filling/submitting anything - lets callers assert field presence before performMoneyOperations() commits values. */
  /** Not every Market stop's checklist has a Money Operations tile (e.g. CuraLeaf doesn't, FedEx/Breakroom does) - check before deciding whether it must be completed for Continue to enable. */
  async isMoneyOperationsVisible(): Promise<boolean> {
    return this.isVisible(this.moneyOperations);
  }

  async openMoneyOperations(): Promise<void> {
    await this.tap(this.moneyOperations);
    await this.waitFor(this.skipMoneyBagCheckbox);
  }

  /** Checks "Skip money bag" and continues - simpler alternative to performMoneyOperations() when the actual bag code/coins/bills/refund values don't matter for the flow being exercised. */
  async skipMoneyOperations(): Promise<void> {
    await this.openMoneyOperations();
    await this.setCheckboxState(this.skipMoneyBagCheckbox, true);
    await this.tap(this.continueButton);
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

  /** Excel TC109/TC110 - opens Removals & Returns and searches/selects a product, stopping right before the Theft/Damaged/Returned/Spoiled fields would normally be filled with valid data - lets a caller inject a value into one of those fields directly and read it back. */
  async openRemovalsAndReturnsForProduct(searchTerm: string): Promise<void> {
    await this.tap(this.removalsAndReturns);
    await this.searchAndSelect(searchTerm);
    await this.waitFor(this.documentProductTitle);
  }

  private removalsFieldSelector(field: 'spoiled' | 'damaged' | 'theft' | 'truckReturns'): string {
    return {
      spoiled: this.removalsSpoiledField,
      damaged: this.removalsDamagedField,
      theft: this.removalsTheftField,
      truckReturns: this.removalsTruckReturnsField
    }[field];
  }

  /** Excel TC109/TC110 - types a raw value directly into a Removals & Returns field (bypassing whatever on-screen keyboard the real field uses) so the field's OWN validation logic can be exercised regardless of keypad constraints - same reasoning as this suite's other keypad-bypass TCs. Assumes openRemovalsAndReturnsForProduct() already ran. */
  async typeIntoRemovalsField(field: 'spoiled' | 'damaged' | 'theft' | 'truckReturns', value: string): Promise<void> {
    const selector = this.removalsFieldSelector(field);
    const el = await this.driver.$(selector);
    await el.click();
    await el.setValue(value);
  }

  /** Excel TC109/TC110 - taps Cancel on the Document product screen, discarding whatever was injected via typeIntoRemovalsField() without a "Save Changes?" prompt - leaves the app back on the outer checklist for whatever test runs next. */
  async cancelDocumentProduct(): Promise<void> {
    await this.tap('~Cancel');
  }

  /** Reads back a Removals & Returns field's current text - lets a caller confirm whether an injected invalid value (typeIntoRemovalsField) was actually accepted into the field or silently rejected/reverted. */
  async getRemovalsFieldValue(field: 'spoiled' | 'damaged' | 'theft' | 'truckReturns'): Promise<string> {
    const el = await this.driver.$(this.removalsFieldSelector(field));
    return (await el.getText()) ?? '';
  }

  /**
   * Removals & Returns has no products to remove on a fresh machine - its
   * own empty state ("Record Removed Items & Truck Returns") has a Done
   * button, enabled by default with nothing scanned/logged - live-verified
   * 2026-08-03 on CureLeaf, same empty-state pattern already documented for
   * Vending's own completeRemovalsAndReturns.
   */
  async completeRemovalsAndReturns(): Promise<void> {
    await this.tap(this.removalsAndReturns);
    await this.tap(this.doneButton);
  }

  /** Opens Audit without searching/continuing - lets callers assert the search field/scanner icon first. Assumes the tile is already enabled (see this class's own note above afterPhotos on Audit's own prerequisites - Before Photos, Removals & Returns, and Delivery). */
  async openAudit(): Promise<void> {
    await this.tap(this.audit);
    await this.waitFor(this.audit);
  }

  /** Excel TC244 - opens Audit and searches/selects a product, stopping right before Continue - lets a caller inspect whatever quantity-entry control appears (e.g. the shared numeric keypad) before committing. */
  async selectAuditProduct(searchTerm: string): Promise<void> {
    await this.tap(this.audit);
    await this.waitFor(this.audit);
    await this.searchAndSelect(searchTerm);
  }

  /** Excel TC244 - whether a given key (e.g. "." for decimal) exists at all on the shared numeric keypad currently on screen - same keypad component used by Delivery/Add Product/Audit quantity entry. */
  async isKeypadKeyVisible(key: string): Promise<boolean> {
    return this.isVisible(this.numericKeypadDigit(key));
  }

  /** Excel TC244 - taps an arbitrary key on the shared numeric keypad by its own content-desc (e.g. "." for decimal) - for keys with no dedicated tapKeypadX wrapper. */
  async tapKeypadKey(key: string): Promise<void> {
    await this.tap(this.numericKeypadDigit(key));
  }

  /** Reads the numeric keypad's target field's current text - generic readback for whatever field the keypad is currently editing (e.g. Audit's quantity field). */
  async getKeypadTargetValue(fieldSelector: string): Promise<string> {
    const el = await this.driver.$(fieldSelector);
    return (await el.getText().catch(() => el.getAttribute('text'))) ?? '';
  }

  /**
   * Excel TC232 ("Audit" sub-area) - the scanner icon on Audit's own
   * product search field, live-verified 2026-08-03 present as the same
   * unlabeled-ImageView-following-the-field pattern used throughout this
   * app (see e.g. isSearchScannerIconVisible above). Not exercised end-to-
   * end (no real barcode to scan against in this environment, same
   * reasoning as TC160's own note elsewhere in this file) - only the tap
   * target's presence is asserted.
   */
  async isAuditScannerIconVisible(): Promise<boolean> {
    return this.isVisible(`${this.searchField}/following-sibling::android.widget.ImageView[2]`);
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
