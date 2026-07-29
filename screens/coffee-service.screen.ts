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

  async isPresalesEmptyStateVisible(): Promise<boolean> {
    return this.isVisible(this.presalesEmptyStateHeading);
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

  /** Opens the "Search product" bottom sheet from the Add product field. */
  async openAddProductSearch(): Promise<void> {
    await this.tap(this.addProductField);
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

  /** Excel TC007 - header actions; live-verified 2026-07-28: Search is NOT present in the empty-state (no equipment to search yet) - only Back and Add equipment (section_header_add_cta). */
  async isEquipmentAuditHeaderActionsVisible(): Promise<{ addEquipment: boolean }> {
    return { addEquipment: await this.isVisible(this.addProductButton) };
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

  async tapEquipmentDoesNotExistCheckbox(): Promise<void> {
    await this.tap(this.equipmentDoesNotExistCheckbox);
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
