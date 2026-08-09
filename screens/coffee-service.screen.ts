import { BaseScreen } from './base.screen';
import type { Position } from '../utils/position';

/**
 * Coffee LOB - servicing a delivery location. Ported from coffee_keywords.robot.
 *
 * Deliberately NOT the same shape as Market/Vending's service screens -
 * Coffee's delivery flow includes a full document-signing/signature-capture
 * step that Market and Vending don't have at all, so this stays its own
 * class rather than forcing a shared "LOB service" base across all three
 * (see docs/rf-to-playwright-reuse.md's Phase 3 notes).
 */
export class CoffeeServiceScreen extends BaseScreen {
  private readonly coffeeLob = '//android.widget.ImageView[contains(@content-desc,"coffee")]';
  private readonly coffeeDeliveriesTitle = '~Deliveries';
  private readonly signingOrderTitle = '~Signing Order';
  private readonly clickToGetCustomerSignature = '//android.view.View[contains(@content-desc,"Customer signature here")]';
  // FRAGILE: deep structural path from coffee.yaml, no stable identifier -
  // re-verify against the current build.
  private readonly signatureScreen =
    '//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.View/android.view.View/android.view.View/android.view.View/android.view.View[5]';
  private readonly signOffButton = '~Sign off';
  private readonly equipmentAudit = '//android.view.View[starts-with(@content-desc, "Equipment audit")]';
  // Live-verified 2026-07-27 on a Coffee service stop (Route 10/TODAY,
  // "Alan B. Levan |NSU Broward Center of Innovation"'s checklist) -
  // Before Photos is the first tile, dashed border until completed/skipped.
  private readonly beforePhotos = '//android.view.View[starts-with(@content-desc,"Before Photos")]';

  // Excel TC001/TC002/TC003 "view the delivery header" - same shared
  // pattern as Market's own serviceStopLocationHeader (see that class's own
  // note on why it's a preceding-sibling of Before Photos, not a fixed
  // string - varies per location).
  private readonly serviceStopLocationHeader =
    '//android.view.View[starts-with(@content-desc,"Before Photos")]/preceding-sibling::android.view.View[1]';

  // Excel TC001-TC035 (Coffee "Header"/"Completing an equipment audit").
  // Live-verified 2026-07-28 (build 0.1.76, Route 10/YESTERDAY, "Alan B.
  // Levan |NSU Broward Center of Innovation" stop).
  //
  // Same hint-encoding pattern as Market's Add Product screen: the
  // Account/Manufacturer/Model dropdown-style fields expose "{Label}\n
  // {Value}" as one content-desc, not separate elements.
  private readonly equipmentAuditTitle = '~Equipment audit';
  private readonly equipmentAuditEmptyStateHeading = '~Log equipment audit';
  private readonly equipmentAuditEmptyStateMessage =
    '~To add equipments to this service, please add equipment individually to this service location.';
  // The empty-state's own trigger is a plain View (not a Button) - distinct
  // from the Add Equipment form's own submit Button, which shares the same
  // "Add equipment" label (same disambiguation-by-tag-name pattern already
  // used for Market's Add Product screen).
  private readonly addEquipmentTrigger = '//android.view.View[@content-desc="Add equipment"]';
  private readonly addEquipmentTitle = '//android.view.View[@content-desc="Add equipment"]';
  private readonly addEquipmentSubmitButton = '//android.widget.Button[@content-desc="Add equipment"]';
  private addEquipmentFieldSelector(label: string): string {
    return `//android.view.View[starts-with(@content-desc,"${label}\n")]`;
  }

  // Excel TC008-TC017 (equipment card content, verify, mark-missing) - live-
  // verified 2026-07-28 end-to-end in one continuous session (this data
  // does NOT survive an app process restart before some further
  // sync/completion step, so building it fresh within a single test run is
  // the only reliable way to exercise these TCs - see this class's own
  // history/commit notes on why a separately-added card couldn't be reused
  // across sessions).
  //
  // Filling Account/Manufacturer/Model + Barcode/Serial/Asset Number on the
  // blank "Add equipment" form (reached via the header + icon) enables a
  // button that stays labeled "Add equipment" - live-verified submitting it
  // saves a new card whose own status label is "Recently added", NOT yet
  // "Verified". Reopening that SAME card afterward (tap the card itself,
  // not the + icon) reaches a screen titled "Equipment detail" with an
  // "Equipment does not exist" checkbox and a button labeled "Verify
  // equipment" instead - it's the ENTRY POINT (blank form vs. an existing
  // card) that determines the button's label, not the entered data.
  // Submitting from Equipment detail with the checkbox left unchecked
  // flips the card's status to "Verified"; checking it first hides the
  // Manufacturer/Model detail fields and flips the status to "Equipment
  // does not exist" instead - all three states ("Recently added"/
  // "Verified"/"Equipment does not exist") are directly readable from the
  // card's own content-desc, no visual-only (green/grey) signal needed.
  private equipmentCard(name: string): string {
    return `//android.view.View[starts-with(@content-desc,"${name}\n")]`;
  }
  private readonly equipmentDetailTitle = '//android.view.View[@content-desc="Equipment detail"]';
  private readonly equipmentDoesNotExistCheckbox = '//android.widget.CheckBox';
  private readonly verifyEquipmentSubmitButton = '~Verify equipment';

  // Excel TC043/TC046/TC054/TC065 (Account/Manufacturer/Model "Select a
  // stop"-style bottom sheets) - live-verified 2026-07-28: each sheet has
  // its own "Search" field and a real clear (X) icon - NOT the decorative
  // search icon on the field's other side (that one has clickable="false");
  // the clear icon is the only clickable ImageView in the sheet. Tapping it
  // restores the full unfiltered option list with nothing selected.
  private readonly dropdownSearchField = '//android.widget.EditText[@hint="Search"]';
  private readonly dropdownClearIcon = '//android.widget.ImageView[@clickable="true"]';
  private readonly dropdownOption = '//android.view.View[@clickable="true" and @content-desc!="Scrim" and not(starts-with(@content-desc,"Add "))]';

  // Excel TC147/TC149/TC167 (Coffee "Presales order") - live-verified
  // 2026-07-29 (build 0.1.76, Route 10/TODAY, "Amazon Corporate"/"3rd Floor"
  // stop, manually-seeded Covista Coffee data). Reached from the checklist's
  // own "Add presale\nLog presale if/when requested" optional tile (NOT the
  // Delivery tile) - opens straight into a "Pre-sales" empty state
  // ("Log Pre-Sales by Order") with its own "Add order" button, same
  // empty-state pattern as Equipment audit.
  //
  // "Add order" opens "Add Pre-sales order": a Delivery Date field (native
  // Android Material DatePicker, NOT a custom Flutter widget - the only
  // native picker found in this app so far) + an "Add product" field that
  // opens a "Search product" bottom sheet. Live-verified contrary to Excel's
  // TC150 claim: the Delivery Date field starts EMPTY ("Select Delivery
  // Date"), not pre-populated with today's date - not asserted here.
  //
  // Delivery Date picker: today itself is NOT selectable (only future dates
  // enabled) - Thu Jul 30 (today+1) is the earliest enabled date and the
  // one pre-highlighted on open. The upper limit is exactly today+35 days
  // (live-verified: Sep 2, 2026 enabled, Sep 3 onward disabled, from a
  // "today" of Jul 29, 2026) - matches Excel TC165 exactly.
  //
  // Selecting a product from the search sheet adds a row with a package
  // size ("pkg: N") and its own Qty numeric-keypad input (default 1),
  // enabling Cancel/Save order. Submitting "Save order" lands on the
  // "Pre-sales" summary screen (location header + "Items\nN" dropdown +
  // Delivery Date chip + "Add order"/"Continue" buttons) - tapping the
  // Items row reopens "Add Pre-sales order" PRE-FILLED with the saved
  // product (TC193), while "Add order" opens a genuinely blank form for a
  // second order (TC201, live-verified: Cancel is disabled on a blank form
  // since there's nothing to cancel - the back arrow is the only way out).
  private readonly addPresaleTrigger = '//android.view.View[starts-with(@content-desc,"Add presale")]';
  private readonly presalesEmptyStateHeading = '~Log Pre-Sales by Order';
  private readonly presalesAddOrderTrigger = '~Add order';
  private readonly addPresalesOrderTitle = '~Add Pre-sales order';
  // Live-verified (build 0.1.76): both fields are true XML siblings of the
  // title under one parent (index 3 = title, 4 = Delivery Date, 6 = Add
  // product EditText) - content-desc/hint-based locators don't work here
  // since this field is BLANK (no content-desc, no hint) until a date is
  // picked, when it switches to using the plain "text" attribute instead
  // ("Thu 30 Jul") rather than content-desc. following-sibling off the
  // title is the only stable anchor found.
  private readonly deliveryDateField =
    '//android.view.View[@content-desc="Add Pre-sales order"]/following-sibling::android.view.View[1]';
  private readonly addProductField =
    '//android.view.View[@content-desc="Add Pre-sales order"]/following-sibling::android.widget.EditText[1]';
  private readonly searchProductSheetTitle = '~Search product';
  // Scoped as a sibling of the sheet's own title, not a bare
  // "//android.widget.EditText" - the underlying "Add Pre-sales order"
  // screen's own "Add product" EditText is still present in the tree while
  // this sheet is open, so an unscoped EditText locator could resolve to
  // either one non-deterministically.
  private readonly searchProductField =
    '//android.view.View[@content-desc="Search product"]/following-sibling::android.widget.EditText[1]';
  private searchProductOption(term: string): string {
    return `//android.view.View[contains(@content-desc,"${term}")]`;
  }
  private readonly saveOrderButton = '~Save order';
  private readonly cancelOrderButton = '~Cancel';
  private readonly presalesSummaryTitle = '//android.view.View[@content-desc="Pre-sales"]';
  private readonly presalesItemsRow = '//android.view.View[starts-with(@content-desc,"Items")]';
  private readonly presalesContinueButton = '~Continue';

  /** Excel TC147 (via checklist) - opens the checklist's own "Add presale" tile, landing on the Pre-sales empty state. */
  async openAddPresaleFromChecklist(): Promise<void> {
    await this.tap(this.addPresaleTrigger);
    await this.waitFor(this.presalesEmptyStateHeading);
  }

  /**
   * Same "Add presale" checklist tile, but tolerant of a pre-existing
   * order from an earlier run against this same account/day (live-
   * verified 2026-08-06: Pre-sales orders persist server-side same as
   * Coffee's equipment cards do) - lands on either the empty state or the
   * existing order's own summary screen, and doesn't wait for either.
   */
  async tapAddPresaleTrigger(): Promise<void> {
    await this.tap(this.addPresaleTrigger);
  }

  async isPresalesEmptyStateVisible(): Promise<boolean> {
    return this.isVisible(this.presalesEmptyStateHeading);
  }

  async isPresalesSummaryVisible(): Promise<boolean> {
    return this.isVisible(this.presalesSummaryTitle);
  }

  /** Excel TC147/TC148 - opens "Add Pre-sales order" from the empty-state's own "Add order" button. */
  async openAddPresalesOrder(): Promise<void> {
    await this.tap(this.presalesAddOrderTrigger);
    await this.waitFor(this.addPresalesOrderTitle);
  }

  async isAddPresalesOrderTitleVisible(): Promise<boolean> {
    return this.isVisible(this.addPresalesOrderTitle);
  }

  /**
   * Excel TC149/TC150 - the Delivery Date field's own current value. Reads
   * the "text" attribute, not content-desc - live-verified this field
   * switches to plain text ("Thu 30 Jul") once a date is picked, unlike
   * every other dropdown-style field in this app which uses content-desc.
   */
  async getDeliveryDateFieldText(): Promise<string> {
    const el = await this.driver.$(this.deliveryDateField);
    return (await el.getAttribute('text').catch(() => '')) || '';
  }

  async openDeliveryDatePicker(): Promise<void> {
    await this.tap(this.deliveryDateField);
    // Not an accessibility-id match ('~Select date') - live-verified this
    // native Android DatePicker dialog's own content-desc is actually
    // "Select date\n{selected day}" (e.g. "Select date\nThu, Jul 30"), so
    // an exact-match accessibility id never resolves.
    await this.waitFor('//android.view.View[starts-with(@content-desc,"Select date")]');
  }

  // starts-with, not contains: each day button's content-desc is
  // "{day}, {weekday}, {month} {day}, {year}" (e.g. "2, Wednesday,
  // September 2, 2026") - contains("2,") would also match "12," (which
  // ends in the substring "2,"), wrongly resolving to the wrong day.
  private dayOption(desc: string): string {
    return `//android.widget.Button[starts-with(@content-desc,"${desc}")]`;
  }

  /**
   * Excel TC165/TC167 - reads whether a given day-of-month button in the
   * currently-open month view is enabled. Caller navigates months first via
   * tapNextMonth()/tapPreviousMonth().
   */
  async isDayEnabled(dayContentDescFragment: string): Promise<boolean> {
    const el = await this.driver.$(this.dayOption(dayContentDescFragment));
    return (await el.getAttribute('enabled').catch(() => 'false')) === 'true';
  }

  async tapNextMonth(): Promise<void> {
    await this.tap('~Next month');
  }

  async tapPreviousMonth(): Promise<void> {
    await this.tap('~Previous month');
  }

  async confirmDatePickerSelection(): Promise<void> {
    await this.tap('~OK');
  }

  async cancelDatePicker(): Promise<void> {
    await this.tap('~Cancel');
  }

  /** Excel TC166 - selects a specific enabled day (e.g. the pre-highlighted today+1 default) and confirms. */
  async selectDeliveryDate(dayContentDescFragment: string): Promise<void> {
    await this.tap(this.dayOption(dayContentDescFragment));
    await this.confirmDatePickerSelection();
  }

  /**
   * Opens the "Search product" bottom sheet from the Add product field.
   *
   * CORRECTED (live-verified 2026-08-06, FedEx/Route 10/Today): the sheet
   * does NOT appear on tap alone, no matter how long you wait afterwards -
   * it only opens once at least one character is typed into the
   * now-focused inline field, at which point the app navigates to the
   * sheet (its own search field starts genuinely empty - the triggering
   * keystroke does not carry over, confirmed via the sheet's own
   * EditText's `text` attribute being ""). A single throwaway keystroke is
   * enough to trigger that navigation.
   */
  async openAddProductSearch(): Promise<void> {
    await this.tap(this.addProductField);
    await this.driver.keys('a');
    await this.waitFor(this.searchProductSheetTitle);
  }

  async searchPresaleProduct(term: string): Promise<void> {
    const field = await this.driver.$(this.searchProductField);
    await field.click();
    await field.setValue(term);
  }

  async selectPresaleProductOption(term: string): Promise<void> {
    await this.tap(this.searchProductOption(term));
  }

  async isSaveOrderEnabled(): Promise<boolean> {
    return this.isEnabled(this.saveOrderButton);
  }

  async isCancelOrderEnabled(): Promise<boolean> {
    return this.isEnabled(this.cancelOrderButton);
  }

  /** Excel TC199 - submits the Add Pre-sales order form, landing on the Pre-sales summary screen. */
  async saveOrder(): Promise<void> {
    await this.tap(this.saveOrderButton);
    await this.waitFor(this.presalesSummaryTitle);
  }

  /** Excel TC200 - the summary screen's own "Items\n{count}" line. */
  async getPresalesSummaryItemsText(): Promise<string> {
    const el = await this.driver.$(this.presalesItemsRow);
    return (await el.getAttribute('content-desc')) ?? '';
  }

  /** Excel TC193 - reopens "Add Pre-sales order" pre-filled, by tapping the summary's own Items row. */
  async reopenPresalesOrderFromSummary(): Promise<void> {
    await this.tap(this.presalesItemsRow);
    await this.waitFor(this.addPresalesOrderTitle);
  }

  /** Excel TC201 - opens a genuinely blank "Add Pre-sales order" form for a second order. */
  async openAnotherPresalesOrder(): Promise<void> {
    await this.tap(this.presalesAddOrderTrigger);
    await this.waitFor(this.addPresalesOrderTitle);
  }

  async isPresalesContinueVisible(): Promise<boolean> {
    return this.isVisible(this.presalesContinueButton);
  }

  // Excel TC206/TC207/TC209/TC210-TC212/TC215-TC217 (Coffee "Delivery") -
  // live-verified 2026-07-29 (build 0.1.76, Route 10/TODAY, "Amazon
  // Corporate"/"3rd Floor" stop). Reached from the checklist's own
  // "Delivery\nRestock products" tile (BaseScreen.deliveryTrigger) - opens
  // a "Deliveries" screen whose empty state ("No Deliveries Requested.")
  // ALREADY shows the header's own Add (+)/Sort icons and its own Search
  // product field - unlike Equipment audit's empty state, which hides
  // Search until data exists.
  //
  // Adding a product (via the header + icon -> "Search product" sheet,
  // same shared component as Coffee Presales order) creates a row with an
  // "Ordered" value (always "-"/blank for this ad-hoc-added stop, since
  // there was never a real requested order) and an editable "Delivered"
  // numeric-keypad field (default 1) - Excel's own TC215/TC211 call this
  // column "Ending Inventory", but the live build's own field/column label
  // is "Delivered".
  //
  // Tapping Continue ALWAYS surfaced a "Coffee Delivery! Some deliveries
  // are not updated. You still want to continue?" (No/Yes) popup in this
  // session, even after setting Delivered to a non-zero value - live-
  // verified this is most likely tied to the "Ordered" column staying
  // blank (an ad-hoc product was never actually "requested"), not
  // specifically a zero-value Delivered check as Excel's TC211 wording
  // implies - the exact zero-value trigger condition couldn't be isolated
  // without a stop that has real seeded Ordered-quantity data. The popup's
  // own No/Yes behavior (TC212/TC213) was verified as described regardless.
  //
  // "Yes" lands on "Signing Order": an Order # chip, "Ordered Items"/
  // "Items Delivered" fields, a "Delivery summary" table (Product/Ordered/
  // Delivered columns - TC215's 3-column shape, different labels), a "Cost
  // summary" table, and a dashed "Sign Off\nCustomer signature here"
  // trigger. Tapping that trigger opens a dedicated signature-capture
  // screen showing "Default Email" (a plain, non-editable View - TC218's
  // "not editable" claim confirmed structurally: it's not even an
  // EditText) and "Invoice Email" (a real EditText, optional) beneath the
  // signature pad, with "Sign off" disabled until the pad is tapped
  // (same double-tap pattern as performDelivery() above).
  //
  // NOT independently asserted (documented instead):
  // - TC219-TC225 (delivery service fee display/consistency/backend sync)
  //   - live-verified NOT PRESENT anywhere in this flow (no "fee" text at
  //     all on the Signing Order screen's own Cost summary) - matches the
  //     Excel's own "Not Tested" Result for all of these rows, suggesting
  //     this is an unimplemented/not-yet-seeded feature rather than a
  //     missed assertion.
  private readonly deliveriesTitle = '~Deliveries';
  private readonly deliveriesEmptyStateHeading = '~No Deliveries Requested.';
  private readonly sortByTrigger = '~section_header_sort_cta';
  private readonly sortBySheetTitle = '~Sort by';
  private readonly clearSortOrderButton = '~Clear sort order';
  private sortOption(label: string): string {
    return `~${label}`;
  }
  // True XML sibling of the "Deliveries" title - see this class's own
  // "Add Pre-sales order" note above for why a structural anchor, not a
  // hint/content-desc match, is used: this EditText exposes neither.
  private readonly deliveriesSearchField =
    '//android.view.View[@content-desc="Deliveries"]/following-sibling::android.widget.EditText[1]';
  private deliveryProductRow(name: string): string {
    return `//android.view.View[starts-with(@content-desc,"${name}")]`;
  }
  // Not the bare/first EditText - that always resolves to the Deliveries
  // screen's own top search field (document order puts it first). Once a
  // product is added, its own Delivered field is a LATER EditText in the
  // tree - last() targets whichever product was most recently added,
  // which is exactly what a single-product test flow needs.
  private readonly deliveredQtyField = '(//android.widget.EditText)[last()]';
  private readonly deliveryConfirmDialog =
    '//android.view.View[starts-with(@content-desc,"Coffee Delivery!")]';
  private readonly orderNumberChip = '//android.view.View[starts-with(@content-desc,"Order #")]';
  private readonly deliverySummaryTable = '~Delivery summary';
  private readonly costSummaryTable = '~Cost summary';
  private readonly signOffTrigger = '~Sign Off\nCustomer signature here';
  private readonly signatureCapturePad =
    '//android.view.View[@content-desc="Customer signature here:"]/following-sibling::android.view.View[1]';
  // The non-editable Default Email is a plain View (no content-desc/hint
  // of its own) - the following-sibling anchor off the signature label is
  // the only way found to target it; Invoice Email is the one real
  // EditText on this screen.
  private readonly defaultEmailField =
    '//android.view.View[@content-desc="Customer signature here:"]/following-sibling::android.view.View[2]';
  private readonly invoiceEmailField = '//android.widget.EditText';

  /** Excel TC206 (via checklist) - opens the Deliveries screen from the checklist's own Delivery tile. */
  async openDelivery(): Promise<void> {
    await this.tap(this.deliveryTrigger);
    await this.waitFor(this.deliveriesTitle);
  }

  async isDeliveriesEmptyStateVisible(): Promise<boolean> {
    return this.isVisible(this.deliveriesEmptyStateHeading);
  }

  /** Excel TC206 - opens the "Search product" sheet from the header's own + icon. */
  async openAddDeliveryProduct(): Promise<void> {
    await this.tap(this.addProductButton);
    await this.waitFor('~Search product');
  }

  // Scoped as a sibling of the sheet's own title - same rationale as
  // CoffeeServiceScreen's Presales searchProductField above.
  private readonly deliveryAddProductSearchField =
    '//android.view.View[@content-desc="Search product"]/following-sibling::android.widget.EditText[1]';

  /**
   * CORRECTED (live-verified 2026-08-06, FedEx/Route 10/Today): this used
   * to return right after setValue() with no wait for the filtered result
   * list to actually render - under real-device timing, a caller's very
   * next action (selectDeliveryProductOption's tap) can then land before
   * any row exists, silently matching nothing. Reproduced the exact
   * TC206 failure this way (getVisibleDeliveryProductCount() staying 0
   * after a search+select that visually looked fine moments later) and
   * confirmed the search/filter itself works correctly once given time to
   * render - waits for at least one result row here instead of leaving
   * that race to the caller. Deliberately lowercase "pkg:" - live-
   * verified the SEARCH SHEET's own rows use that casing ("... - pkg: 1"),
   * distinct from the capitalized "(Pkg: 1)" the DELIVERY LIST'S rows use
   * once added (see getVisibleDeliveryProductCount below) - easy to
   * conflate since they look identical at a glance.
   */
  async searchDeliveryProductOption(term: string): Promise<void> {
    const field = await this.driver.$(this.deliveryAddProductSearchField);
    await field.click();
    await field.setValue(term);
    await this.waitFor('//android.view.View[contains(@content-desc,"pkg:")]');
  }

  async selectDeliveryProductOption(term: string): Promise<void> {
    await this.tap(`//android.view.View[contains(@content-desc,"${term}")]`);
  }

  /** Excel TC207 - opens the "Sort by" sheet from the header's own sort icon. */
  async openSortBySheet(): Promise<void> {
    await this.tap(this.sortByTrigger);
    await this.waitFor(this.sortBySheetTitle);
  }

  async isSortBySheetVisible(): Promise<boolean> {
    return this.isVisible(this.sortBySheetTitle);
  }

  /** Dismisses the "Sort by" sheet without selecting anything, via its own backdrop - it has no Cancel button (only "Clear sort order" at the bottom, unrelated to dismissal). */
  async dismissSortBySheet(): Promise<void> {
    await this.tap('~Scrim');
  }

  /** Excel TC208 - selects a sort option by its exact label (A to Z/Z to A/Newest First/Oldest First). */
  async selectSortOption(label: string): Promise<void> {
    await this.tap(this.sortOption(label));
  }

  async isClearSortOrderEnabled(): Promise<boolean> {
    return this.isEnabled(this.clearSortOrderButton);
  }

  /**
   * Excel TC209 - types into the Deliveries screen's own Search product
   * field, filtering the already-added list. Same render-timing race as
   * searchDeliveryProductOption above - a short settle pause here since
   * there's no simple "wait for count to change" primitive to wait on
   * instead (the filtered-down state is still a valid, populated list,
   * not an absence/presence signal waitFor can key off).
   */
  async searchDeliveriesList(term: string): Promise<void> {
    const field = await this.driver.$(this.deliveriesSearchField);
    await field.click();
    await field.setValue(term);
    await this.driver.pause(800);
  }

  // A row's own content-desc is "{Name} (Pkg: N)\nOrdered\n{value}" - it
  // never includes the word "Delivered" (that's a separate sibling
  // EditText, not part of this string) - "Pkg:" is the reliable per-row
  // substring instead.
  async getVisibleDeliveryProductCount(): Promise<number> {
    const rows = await this.driver.$$('//android.view.View[contains(@content-desc,"Pkg:")]');
    return rows.length;
  }

  /**
   * Deletes every product currently on the Deliveries list - live-verified
   * 2026-08-07: swiping a row left reveals a trash icon (the row's own
   * following-sibling Button, same swipe-reveals-a-child-Button pattern as
   * BaseScreen.swipeAndDelete), which opens a "Delete Product... Yes/No"
   * confirm dialog (NOT the "~Delete" button BaseScreen.swipeAndDelete
   * expects, hence a dedicated method here rather than reusing it).
   * Re-queries the first remaining row each iteration since indices shift
   * after every deletion. Exists so tests that build up delivery fixture
   * data (which persists server-side with no other reset mechanism - see
   * the TC206 test's own idempotency note) can start from a guaranteed
   * empty list instead of tracking deltas against unbounded prior state.
   */
  async deleteAllDeliveryProducts(): Promise<void> {
    const rowSelector = '//android.view.View[contains(@content-desc,"Pkg:")]';
    for (;;) {
      const remaining = await this.driver.$$(rowSelector);
      const count = await remaining.length;
      if (count === 0) {
        break;
      }
      const row = await this.driver.$(rowSelector);
      const loc = await row.getLocation();
      const size = await row.getSize();
      await this.swipe(loc.x + size.width - 10, loc.y + size.height / 2, loc.x + 10, loc.y + size.height / 2);
      await this.tap(`${rowSelector}/android.widget.Button`);
      await this.tap('~Yes');
      await this.driver.pause(600);
    }
  }

  async isDeliveryProductVisible(name: string): Promise<boolean> {
    return this.isVisible(this.deliveryProductRow(name));
  }

  /** Excel TC211 - sets a product's own Delivered quantity via its numeric-keypad field (see deliveredQtyField's own note on targeting it). */
  async setDeliveredQuantity(value: string): Promise<void> {
    const field = await this.driver.$(this.deliveredQtyField);
    await field.click();
    await field.setValue(value);
  }

  async isDeliveryContinueEnabled(): Promise<boolean> {
    return this.isEnabled(this.continueButton);
  }

  async tapDeliveryContinue(): Promise<void> {
    await this.tap(this.continueButton);
  }

  async isDeliveryConfirmDialogVisible(): Promise<boolean> {
    return this.isVisible(this.deliveryConfirmDialog);
  }

  /** Excel TC212 - dismisses the confirm dialog via No, remaining on Deliveries. */
  async dismissDeliveryConfirmDialog(): Promise<void> {
    await this.tap(this.noButton);
  }

  /** Excel TC213 - confirms the dialog via Yes, navigating to Signing Order. */
  async confirmDeliveryConfirmDialog(): Promise<void> {
    await this.tap(this.yesButton);
    await this.waitFor(this.signingOrderTitle);
  }

  async isOrderNumberChipVisible(): Promise<boolean> {
    return this.isVisible(this.orderNumberChip);
  }

  /**
   * Excel TC215 - confirms a given product's own row is present under the
   * Delivery summary table. Live-verified the table's row is just the bare
   * product name as its own content-desc ("AllCoffee CafeRealExpoCuban
   * 2lb") - the Ordered/Delivered VALUES render as separate sibling
   * elements (their own content-desc is just the value, e.g. "-"/"1"),
   * not combined into one row string - too structurally fragile to read
   * reliably as a single value here, so this only confirms the row's own
   * name is present; isDeliverySummaryVisible()/isCostSummaryVisible()
   * cover the table headers.
   */
  async isDeliverySummaryRowVisible(productName: string): Promise<boolean> {
    return this.isVisible(this.deliveryProductRow(productName));
  }

  async isDeliverySummaryVisible(): Promise<boolean> {
    return this.isVisible(this.deliverySummaryTable);
  }

  async isCostSummaryVisible(): Promise<boolean> {
    return this.isVisible(this.costSummaryTable);
  }

  /**
   * Excel TC216 - opens the dedicated signature-capture screen from the
   * Signing Order summary's own trigger.
   *
   * CORRECTED (live-verified 2026-08-07): the signOffTrigger is the LAST
   * element on this page, below the Delivery/Cost summary tables - with
   * few line items it happened to already be on-screen, but once the
   * Delivery summary grows tall enough (observed with 6 accumulated
   * products on one order), it renders below the fold and reports
   * not-displayed even though it exists in the tree (confirmed via page
   * source - present, just off-screen), causing tap()'s waitForDisplayed
   * to time out. What looked like "Continue" being permanently disabled
   * was actually this - Continue only enables once Sign Off itself is
   * completed further down the SAME page. Scrolls into view first.
   */
  async openSignOff(): Promise<void> {
    for (let i = 0; i < 5; i++) {
      if (await this.isVisible(this.signOffTrigger)) {
        break;
      }
      await this.scrollDown();
    }
    await this.tap(this.signOffTrigger);
    await this.waitFor('~Customer signature here:');
  }

  async isSignOffEnabled(): Promise<boolean> {
    return this.isEnabled(this.signOffButton);
  }

  /** Draws a signature by double-tapping the pad - same pattern as performDelivery() above. */
  async drawSignature(): Promise<void> {
    await this.tap(this.signatureCapturePad);
    await this.tap(this.signatureCapturePad);
  }

  /**
   * Excel TC218 - "Default Email is not editable". Confirmed structurally
   * rather than via a disabled-EditText check: this field is a plain
   * android.view.View by construction (see defaultEmailField's own note) -
   * Invoice Email is the ONLY true EditText on this screen, so simply
   * being present at its expected position already demonstrates it isn't
   * a real input.
   */
  async isDefaultEmailFieldVisible(): Promise<boolean> {
    return this.isVisible(this.defaultEmailField);
  }

  async enterInvoiceEmail(email: string): Promise<void> {
    const field = await this.driver.$(this.invoiceEmailField);
    await field.click();
    await field.setValue(email);
  }

  /**
   * Submits the signature-capture screen, returning to the Signing Order
   * summary screen. Waits for the Delivery summary table specifically, not
   * just the "Signing Order" title - live-verified BOTH the summary screen
   * and this signature sub-screen share that exact same title, so it alone
   * can't distinguish having actually navigated back.
   */
  /**
   * CORRECTED (live-verified 2026-08-07): same off-screen issue as
   * openSignOff's own note, mirrored - after signing off, the page is
   * still scrolled to wherever openSignOff left it (near the bottom, to
   * reach the Sign Off box), so the "Delivery summary" anchor near the
   * TOP of this same scrollable page can itself be off-screen and not
   * "displayed" yet. Scrolls back up first.
   */
  async submitSignOff(): Promise<void> {
    await this.tap(this.signOffButton);
    for (let i = 0; i < 5; i++) {
      if (await this.isVisible(this.deliverySummaryTable)) {
        break;
      }
      await this.scrollUp();
    }
    await this.waitFor(this.deliverySummaryTable);
  }

  async clickServiceLocation(position: Position): Promise<void> {
    await this.selectServiceLocation(this.coffeeLob, position);
  }

  async performDelivery(): Promise<void> {
    await this.tap(this.deliveryTrigger);
    await this.waitFor(this.coffeeDeliveriesTitle);
    await this.tap(this.continueButton);
    await this.waitFor(this.signingOrderTitle);
    await this.scrollDown();
    await this.tap(this.clickToGetCustomerSignature);
    await this.waitFor(this.signatureScreen);
    // RF tapped the signature pad twice here - kept as-is (first tap likely
    // focuses/opens the pad, second registers an actual stroke point).
    await this.tap(this.signatureScreen);
    await this.tap(this.signatureScreen);
    await this.tap(this.signOffButton);
    await this.tap(this.continueButton);
  }

  async performEquipmentAudit(): Promise<void> {
    await this.tap(this.equipmentAudit);
    await this.tap(this.doneButton);
    await this.tap(this.yesButton);
  }

  /** Opens the Before Photos step's "Add supporting photo" modal - see BaseScreen's openPhotoTrigger/isPhotoModalVisible/openSkipPhotoReasonSheet for the shared skip-photo flow beyond this. */
  async openBeforePhotos(): Promise<void> {
    await this.openPhotoTrigger(this.beforePhotos);
  }

  // Excel TC274/TC277/TC278 (Coffee "After Photo") - live-verified
  // 2026-07-29 (build 0.1.76, Route 10/TODAY, "Amazon Corporate"/"3rd
  // Floor" stop): the checklist's own "After Photos\nDocument Completed
  // Services" tile opens the exact same shared "Add supporting photo" /
  // Skip photo reason-sheet component already proven for Before Photos -
  // same BaseScreen methods (openPhotoTrigger/isPhotoModalVisible/
  // openSkipPhotoReasonSheet/isSkipPhotoSubmitEnabled/enterSkipPhotoReason/
  // waitForSkipPhotoSubmitEnabled/confirmSkipPhoto) apply unchanged, just
  // against this different trigger tile.
  private readonly afterPhotos = '//android.view.View[starts-with(@content-desc,"After Photos")]';

  /** Opens the After Photos step's "Add supporting photo" modal - see openBeforePhotos's own note on the shared skip-photo flow beyond this. */
  async openAfterPhotos(): Promise<void> {
    await this.openPhotoTrigger(this.afterPhotos);
  }

  /** Excel TC001/TC002/TC003 "view the delivery header" - assumes the service stop's checklist screen is already open. */
  async isServiceStopLocationHeaderVisible(): Promise<boolean> {
    return this.isVisible(this.serviceStopLocationHeader);
  }

  async getServiceStopLocationHeaderText(): Promise<string> {
    const el = await this.driver.$(this.serviceStopLocationHeader);
    return (await el.getAttribute('content-desc')) ?? '';
  }

  /** Excel TC004/TC006 - opens Equipment audit and confirms its own page title. */
  async openEquipmentAudit(): Promise<void> {
    await this.tap(this.equipmentAudit);
    await this.waitFor(this.equipmentAuditTitle);
  }

  async isEquipmentAuditTitleVisible(): Promise<boolean> {
    return this.isVisible(this.equipmentAuditTitle);
  }

  /**
   * Excel TC007 - header actions; live-verified 2026-07-28: Search is NOT
   * present in the empty-state (no equipment to search yet) - only Back
   * and Add equipment (section_header_add_cta). Back itself is
   * BaseScreen.backButton - live-verified 2026-07-29 against this exact
   * screen (Equipment audit empty-state, Route 10/TODAY, "Amazon
   * Fulfillment" stop): its own FRAGILE deep structural path resolves
   * correctly here too, same generic app-shell chrome as every other
   * screen.
   */
  async isEquipmentAuditHeaderActionsVisible(): Promise<{ back: boolean; addEquipment: boolean }> {
    return {
      back: await this.isVisible(this.backButton),
      addEquipment: await this.isVisible(this.addProductButton)
    };
  }

  /** Excel TC004's empty-state (this account's stop has zero equipment on file) - "Log equipment audit" heading + explanatory message + Add equipment/Done buttons. */
  async isEquipmentAuditEmptyStateVisible(): Promise<{ heading: boolean; message: boolean; addEquipment: boolean; done: boolean }> {
    return {
      heading: await this.isVisible(this.equipmentAuditEmptyStateHeading),
      message: await this.isVisible(this.equipmentAuditEmptyStateMessage),
      addEquipment: await this.isVisible(this.addEquipmentTrigger),
      done: await this.isVisible(this.doneButton)
    };
  }

  /** Excel TC030 - opens the Add Equipment form from the empty-state's own trigger, confirms its title. */
  async openAddEquipmentFromEmptyState(): Promise<void> {
    await this.tap(this.addEquipmentTrigger);
    await this.waitFor(this.addEquipmentTitle);
  }

  /** Excel TC033/TC034 - every mandatory field's own visibility, read in one shot. */
  async isAddEquipmentFormVisible(): Promise<{
    account: boolean;
    manufacturer: boolean;
    model: boolean;
    barcode: boolean;
    serialNumber: boolean;
    assetNumber: boolean;
    netTlmConnected: boolean;
    plumbed: boolean;
    photos: boolean;
  }> {
    return {
      account: await this.isVisible(this.addEquipmentFieldSelector('Account')),
      manufacturer: await this.isVisible(this.addEquipmentFieldSelector('Manufacturer')),
      model: await this.isVisible(this.addEquipmentFieldSelector('Model')),
      barcode: await this.isVisible('//android.widget.EditText[@hint="Barcode"]'),
      serialNumber: await this.isVisible('//android.widget.EditText[@hint="Serial Number"]'),
      assetNumber: await this.isVisible('//android.widget.EditText[@hint="Asset Number"]'),
      netTlmConnected: await this.isVisible(this.addEquipmentFieldSelector('Net/TLM Connected')),
      plumbed: await this.isVisible(this.addEquipmentFieldSelector('Plumbed')),
      photos: await this.isVisible(this.addEquipmentFieldSelector('Photos'))
    };
  }

  /** Excel TC035 - Add equipment submit button's enabled state (disabled grey until required fields are filled). */
  async isAddEquipmentSubmitEnabled(): Promise<boolean> {
    return this.isEnabled(this.addEquipmentSubmitButton);
  }

  /**
   * Live-verified: Account options carry a trailing address in their own
   * content-desc (e.g. "Covista\n3005 Highland Pkwy...") while Manufacturer/
   * Model options are plain exact labels ("Cafection", "Galleria") - a
   * starts-with match handles both without needing to know which field this
   * is.
   */
  async selectAddEquipmentDropdownOption(fieldLabel: string, optionLabel: string): Promise<void> {
    await this.tap(this.addEquipmentFieldSelector(fieldLabel));
    await this.tap(`//*[starts-with(@content-desc,"${optionLabel}")]`);
  }

  async typeAddEquipmentField(hint: string, value: string): Promise<void> {
    const field = await this.driver.$(`//android.widget.EditText[@hint="${hint}"]`);
    await field.click();
    await field.setValue(value);
  }

  /**
   * Excel TC030-TC035 end-to-end - fills every mandatory Add Equipment
   * field with a combination live-verified to resolve to a real, savable
   * record (Account=Covista, Manufacturer=Cafection, Model=Galleria,
   * Barcode=aaaa, Serial=1111, Asset=124), then submits. The submit
   * button's own label flips from "Add equipment" to "Verify equipment"
   * once this combination is entered (see this class's own note above the
   * locators) - both are handled here since the button is targeted by
   * being the sole enabled bottom action, not by its exact label.
   */
  async fillAndSubmitNewEquipment(values: {
    account: string;
    manufacturer: string;
    model: string;
    barcode: string;
    serialNumber: string;
    assetNumber: string;
  }): Promise<void> {
    await this.selectAddEquipmentDropdownOption('Account', values.account);
    await this.selectAddEquipmentDropdownOption('Manufacturer', values.manufacturer);
    await this.selectAddEquipmentDropdownOption('Model', values.model);
    await this.typeAddEquipmentField('Barcode', values.barcode);
    await this.typeAddEquipmentField('Serial Number', values.serialNumber);
    await this.typeAddEquipmentField('Asset Number', values.assetNumber);
  }

  async submitAddOrVerifyEquipment(): Promise<void> {
    const addBtn = await this.driver.$(this.addEquipmentSubmitButton);
    if (await addBtn.isDisplayed().catch(() => false)) {
      await addBtn.click();
      return;
    }
    await this.tap(this.verifyEquipmentSubmitButton);
  }

  /** Excel TC094/TC008 - count of equipment cards currently rendered. */
  async getEquipmentCardCount(): Promise<number> {
    const cards = await this.driver.$$('//android.view.View[contains(@content-desc,"Model:")]');
    return cards.length;
  }

  /**
   * Deletes every equipment card currently listed - live-verified
   * 2026-08-07: swiping a card left reveals a trash icon (the card's own
   * child android.widget.Button, same structural pattern as Deliveries'
   * own swipe-reveal), and tapping it deletes IMMEDIATELY - no "Yes/No"
   * confirm dialog here (unlike deleteAllDeliveryProducts's Delete
   * Product popup). Re-queries the first remaining card each iteration
   * since indices shift after every deletion. Exists so tests that build
   * up equipment fixture data (which persists server-side, same as
   * Deliveries) can start from a guaranteed empty audit instead of the
   * tolerant pre-existing-card branch the TC001 test used before this was
   * found.
   */
  async deleteAllEquipment(): Promise<void> {
    const cardSelector = '//android.view.View[contains(@content-desc,"Model:")]';
    for (;;) {
      const remaining = await this.driver.$$(cardSelector);
      const count = await remaining.length;
      if (count === 0) {
        break;
      }
      const card = await this.driver.$(cardSelector);
      const loc = await card.getLocation();
      const size = await card.getSize();
      await this.swipe(loc.x + size.width - 10, loc.y + size.height / 2, loc.x + 10, loc.y + size.height / 2);
      await this.tap(`${cardSelector}/android.widget.Button`);
      await this.driver.pause(600);
    }
  }

  /**
   * Excel TC008/TC010/TC011/TC012/TC016/TC017 - a card's full content-desc
   * is "{Name}\nModel:\n{model}\nSerial Number:\n{serial}\nAsset Number:
   * \n{asset}\n{status}", where status is either "Verified" or "Equipment
   * does not exist" - both read directly, no visual-only signal needed.
   */
  async getEquipmentCardSummary(name: string): Promise<{ model: string; serialNumber: string; assetNumber: string; status: string }> {
    const el = await this.driver.$(this.equipmentCard(name));
    const desc = (await el.getAttribute('content-desc')) ?? '';
    const parts = desc.split('\n');
    return {
      model: parts[2] ?? '',
      serialNumber: parts[4] ?? '',
      assetNumber: parts[6] ?? '',
      status: parts[7] ?? ''
    };
  }

  /** Excel TC012-TC015 - reopens an existing card's "Equipment detail" screen. */
  async openEquipmentCard(name: string): Promise<void> {
    await this.tap(this.equipmentCard(name));
    await this.waitFor(this.equipmentDetailTitle);
  }

  async isEquipmentDoesNotExistCheckboxChecked(): Promise<boolean> {
    const el = await this.driver.$(this.equipmentDoesNotExistCheckbox);
    return (await el.getAttribute('checked').catch(() => 'false')) === 'true';
  }

  /** Sets the checkbox to the desired state - checks its current state first (via BaseScreen.setCheckboxState) rather than blindly tapping, so a call that requests the state it's already in is a no-op instead of toggling it the wrong way. */
  async setEquipmentDoesNotExistCheckbox(checked: boolean): Promise<void> {
    await this.setCheckboxState(this.equipmentDoesNotExistCheckbox, checked);
  }

  /**
   * Excel TC043/TC054/TC065 - opens a dropdown sheet (Account/Manufacturer/
   * Model) and types a search term into it. Types character by character
   * with a pause between each - a single setValue() call doesn't reliably
   * trigger this list's search-as-you-type filter (same class of issue as
   * the Market Add Product search field elsewhere in this suite).
   */
  async openAddEquipmentDropdownAndSearch(fieldLabel: string, searchTerm: string): Promise<void> {
    await this.tap(this.addEquipmentFieldSelector(fieldLabel));
    const field = await this.driver.$(this.dropdownSearchField);
    await field.click();
    for (const ch of searchTerm) {
      await field.addValue(ch);
      await this.driver.pause(200);
    }
  }

  /** Excel TC043/TC054/TC065 - taps the sheet's real clear (X) icon, restoring the unfiltered option list. */
  async clearAddEquipmentDropdownSearch(): Promise<void> {
    await this.tap(this.dropdownClearIcon);
  }

  async getAddEquipmentDropdownOptionCount(): Promise<number> {
    const options = await this.driver.$$(this.dropdownOption);
    return options.length;
  }

  /** Whether any option in the currently-open dropdown sheet is selected (ticked). */
  async isAnyAddEquipmentDropdownOptionSelected(): Promise<boolean> {
    const options = await this.driver.$$(this.dropdownOption);
    for (const option of options) {
      if ((await option.getAttribute('selected').catch(() => 'false')) === 'true') {
        return true;
      }
    }
    return false;
  }
}
