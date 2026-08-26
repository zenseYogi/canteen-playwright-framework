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
  /**
   * CORRECTED 2026-08-25 (build 0.1.90, live-verified on Coffee/Equipment
   * audit): the labelled "Add equipment" button is GONE from the empty
   * state - the only add control left is an untitled header icon whose
   * content-desc is the internal id "section_header_add_cta" (the same
   * unlabelled section_header_*_cta family Market's screens now use).
   * Matching either, so this keeps working on both builds.
   */
  private readonly addEquipmentTrigger =
    '//*[@content-desc="Add equipment" or @content-desc="section_header_add_cta"]';
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
  // CORRECTED 2026-08-25 (build 0.1.90, live-verified): the checklist tile is
  // now capitalised "Add Presale" ("Add Presale\nAdd a New Presale Order") -
  // the old lowercase "Add presale" locator matched ZERO elements. Matching
  // either so this keeps working across both builds.
  private readonly addPresaleTrigger =
    '//android.view.View[starts-with(@content-desc,"Add presale") or starts-with(@content-desc,"Add Presale")]';
  private readonly presalesEmptyStateHeading = '~Log Pre-Sales by Order';
  // CORRECTED 2026-08-25 (build 0.1.90, live-verified): the Pre-sales screen's
  // own "start a new order" trigger is no longer labelled "Add order" - it is
  // now "Add Presale", the SAME label as the checklist tile that led here.
  // Matching either; the two never appear on the same screen.
  private readonly presalesAddOrderTrigger =
    '//android.view.View[@content-desc="Add order" or @content-desc="Add Presale"]';
  // CORRECTED 2026-08-25 (build 0.1.90, live-verified): the Add Presale form's
  // title is no longer "Add Pre-sales order" - it is now "Add Presale", the
  // SAME content-desc as both the checklist tile and the Pre-sales screen's own
  // trigger. All three collapsed onto one string in this build, so the title is
  // no longer a safe "have we arrived?" anchor: waiting on it can match the
  // trigger we just tapped rather than the form. Anchoring on "Save order"
  // instead - a button that exists ONLY on this form.
  private readonly addPresalesOrderTitle =
    '//android.view.View[@content-desc="Add Pre-sales order" or @content-desc="Add Presale"]';
  private readonly addPresalesOrderAnchor = '//android.widget.Button[@content-desc="Save order"]';
  private readonly addPresalesCancelButton = '//android.widget.Button[@content-desc="Cancel"]';
  private readonly addPresalesProductField = '//android.widget.EditText[@hint="Add product"]';
  // Live-verified (build 0.1.76): both fields are true XML siblings of the
  // title under one parent (index 3 = title, 4 = Delivery Date, 6 = Add
  // product EditText) - content-desc/hint-based locators don't work here
  // since this field is BLANK (no content-desc, no hint) until a date is
  // picked, when it switches to using the plain "text" attribute instead
  // ("Thu 30 Jul") rather than content-desc. following-sibling off the
  // title is the only stable anchor found.
  // CORRECTED 2026-08-25 (build 0.1.90): both of these were anchored as
  // siblings of the title "Add Pre-sales order", which no longer exists (the
  // form is now titled "Add Presale" - see addPresalesOrderTitle's own note),
  // so neither resolved at all. Re-anchored on each field's own `hint`, the
  // only stable attribute they carry - both expose content-desc="null".
  //
  // Note the Delivery Date row itself is a View with clickable="false"; the
  // real picker trigger is the calendar ImageView rendered immediately after
  // it, hence deliveryDatePickerIcon below rather than tapping the row.
  private readonly deliveryDateField = '//*[@hint="Delivery Date"]';
  private readonly deliveryDatePickerIcon =
    '//*[@hint="Delivery Date"]/following::android.widget.ImageView[1]';
  private readonly addProductField = '//android.widget.EditText[@hint="Add product"]';
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
    // Anchor on "Save order", not the title - see addPresalesOrderTitle's note.
    await this.waitFor(this.addPresalesOrderAnchor);
  }

  /**
   * C-TC-010 - selects the FIRST product row in the presale search results,
   * returning its display name.
   *
   * Deliberately positional rather than by name. selectPresaleProductOption()
   * matches on `contains(@content-desc, term)` and taps the first hit, which
   * live-verified 2026-08-25 can resolve to a CONTAINER overlapping the first
   * row rather than the named row itself - asking for "Canteen Granulated
   * Sugar Canister (20oz) - pkg: 1" actually added "A&W Zero Sugar Root Beer".
   * Cases that just need *a* valid product should use this instead; only a
   * case that genuinely depends on one specific product should risk the
   * by-name path, and should assert what it actually got.
   */
  async selectFirstPresaleSearchResult(): Promise<string> {
    const resultRow = '//android.view.View[contains(@content-desc,"pkg:")]';
    // The results list populates asynchronously after typing - wait for a real
    // row rather than reading immediately (or sleeping a fixed amount).
    await this.driver.waitUntil(
      async () => [...(await this.driver.$$(resultRow))].length > 0,
      { timeout: 15_000, timeoutMsg: 'No presale product results appeared after searching' }
    );
    const rows = [...(await this.driver.$$(resultRow))];
    if (!rows.length) {
      throw new Error('No presale product results to select');
    }
    const name = ((await rows[0].getAttribute('content-desc')) ?? '').split('\n')[0];
    await rows[0].click();
    return name;
  }

  /**
   * C-TC-007/C-TC-010 - dismisses the numeric keypad that opens over the Add
   * Presale form when a product is selected, and confirms we are STILL on the
   * form afterwards.
   *
   * A blind BACK press here is unsafe: if the keypad happens not to be up, the
   * same press exits the form back to the Pre-sales summary. That is silent
   * and then misleads the NEXT step - once the stop has a saved presale, the
   * summary carries its own "Delivery Date" field, so the date-picker icon
   * still resolves and opens the wrong thing. Live-observed as an intermittent
   * "Save order still not displayed" timeout that only appeared in batch runs.
   */
  async dismissPresaleKeypadIfPresent(): Promise<void> {
    if (await this.isVisible('//android.widget.Button[@content-desc="7"]')) {
      await this.pressKeyCode(4);
    }
    await this.waitFor(this.addPresalesOrderAnchor);
  }

  /** C-TC-031 - how many product rows the presale search returned. */
  async getPresaleSearchResultCount(): Promise<number> {
    return [...(await this.driver.$$('//android.view.View[contains(@content-desc,"pkg:")]'))].length;
  }

  /**
   * C-TC-031 - the Add Presale form's own product row, read from its HINT
   * (e.g. "A&WZeroSugarRtBeer 20oz | SKU : 6217 | pkg: 1 | Qty"), or '' if no
   * product has been added yet.
   *
   * Read as a whole rather than matched against the name the search results
   * showed: live-verified 2026-08-26 the two screens use DIFFERENT name forms
   * for the same product - the results list carries the full catalogue name
   * while the form shows an abbreviated one - so asserting the search name
   * appears verbatim on the form would fail for a correctly added product.
   * What the case actually needs is that the product's details (name, SKU,
   * packaging, quantity) landed on the parent screen at all.
   */
  async getPresaleFormProductHint(): Promise<string> {
    for (const el of [...(await this.driver.$$('//android.widget.EditText'))]) {
      const hint = ((await el.getAttribute('hint')) ?? '').replace(/\n/g, ' | ');
      if (hint.includes('SKU')) {
        return hint;
      }
    }
    return '';
  }

  /** C-TC-010 - saves the in-progress presale. */
  async saveAddPresalesOrder(): Promise<void> {
    await this.tap(this.addPresalesOrderAnchor);
    await this.waitFor(this.presalesSummaryTitle);
  }

  /**
   * C-TC-010 - the Delivery Date shown against a SAVED presale on the
   * Pre-sales summary (e.g. "Wed 26 Aug"). Same hint-anchored field as the
   * Add Presale form's own - the summary reuses the component read-only.
   */
  async getSavedPresaleDeliveryDate(): Promise<string> {
    const el = await this.driver.$(this.deliveryDateField);
    await el.waitForDisplayed({ timeout: 15_000 });
    return (await el.getAttribute('text')) ?? '';
  }

  /** C-TC-007 - whether the Pre-sales screen's own Continue is enabled (stays disabled while the stop has no saved presales). */
  async isPresalesContinueEnabled(): Promise<boolean> {
    return this.isEnabled(this.presalesContinueButton);
  }

  // ==== C-TC-012: deleting a SAVED presale order ====
  //
  // This is the SAME swipe-to-reveal-an-unlabelled-trash-Button + confirm
  // popup that TransfersScreen already models (swipeRouteCardToRevealDelete /
  // tapDeleteIcon / cancelDeleteConfirmation / confirmDelete) and that
  // BaseScreen.swipeAndDelete() encodes end to end. Deliberately built on the
  // same two conventions rather than new ones:
  //   - the revealed control is the row's own `/android.widget.Button` child
  //     (structural, and far less brittle than locating it by pixel band)
  //   - the confirmation's buttons are BaseScreen.deleteButton (`~Delete`) and
  //     `~Cancel` - NOT the No/Yes pair the Deliveries "Delete Product" dialog
  //     uses, so confirmDeleteProduct() must not be reused here
  //
  // swipeAndDelete() itself is still not directly callable, for one reason
  // live-verified 2026-08-25 (build 0.1.90, Charlotte 103 / Amerock): it uses
  // the fast swipe(), and on THIS row a 300ms swipe reveals nothing at all -
  // the tree comes back byte-identical, which reads exactly like "this row has
  // no delete affordance". Only the slower gesture reveals the Button. Hence
  // slowSwipeLeftOn() plus the same structural child-Button tap.
  //
  // Also worth knowing: the Pre-sales summary exposes no delete control until
  // that swipe - its whole tree is the order row, "Add Presale", Continue, a
  // back arrow and a non-clickable chevron.
  private readonly savedPresaleRow = '//android.view.View[starts-with(@content-desc,"Items")]';
  // Deliberately anchored on "Delete" alone, not "Delete Product". The
  // product-row dialog was the one live-verified; the ORDER-row dialog may
  // well be titled differently ("Delete Order"/"Delete Presale"), and a
  // too-specific locator would report "no confirmation appeared" - a false
  // defect - rather than the retitled dialog it actually is. The assertions
  // read the title back, so a rename shows up as readable text either way.
  private readonly deletePresaleConfirm = '//*[starts-with(@content-desc,"Delete")]';

  /** C-TC-012 - how many saved presale orders the Pre-sales summary lists. */
  async getSavedPresaleCount(): Promise<number> {
    return [...(await this.driver.$$(this.savedPresaleRow))].length;
  }

  /** C-TC-012 - swipes the first saved presale row left to reveal its delete control. Needs the SLOW gesture - see revealRowDelete. */
  async revealSavedPresaleDelete(): Promise<void> {
    await this.revealRowDelete(this.savedPresaleRow, { slow: true });
  }

  /** C-TC-012 - whether the delete control revealed by revealSavedPresaleDelete() is showing. */
  async isSavedPresaleDeleteIconVisible(): Promise<boolean> {
    return this.isRowDeleteIconVisible(this.savedPresaleRow);
  }

  /** C-TC-012 - taps the delete control revealed by revealSavedPresaleDelete(). */
  async tapRevealedSavedPresaleDelete(): Promise<void> {
    await this.tapRowDeleteIcon(this.savedPresaleRow);
  }

  /** C-TC-012 - whether the presale delete confirmation is showing. */
  async isDeletePresaleConfirmVisible(): Promise<boolean> {
    return this.isVisible(this.deletePresaleConfirm);
  }

  /** C-TC-012 - the presale delete confirmation's full message (title included, so a retitled dialog is readable). */
  async getDeletePresaleConfirmText(): Promise<string> {
    const el = await this.driver.$(this.deletePresaleConfirm);
    await el.waitForDisplayed({ timeout: 15_000 });
    return ((await el.getAttribute('content-desc')) ?? '').replace(/\n/g, ' ');
  }

  /** C-TC-012 - confirms the presale deletion. Note "Delete", not the "Yes" the Deliveries dialog uses. */
  async confirmDeletePresale(): Promise<void> {
    await this.tap('//android.widget.Button[@content-desc="Delete"]');
  }

  /** C-TC-012 - declines the presale deletion, leaving the order in place. */
  async cancelDeletePresale(): Promise<void> {
    await this.tap('//android.widget.Button[@content-desc="Cancel"]');
  }

  /** C-TC-012 - waits for the presale delete confirmation to leave the tree (same dialog-window race as the Deliveries one). */
  async waitForDeletePresaleConfirmGone(timeout = 15_000): Promise<void> {
    await this.driver.waitUntil(async () => !(await this.isDeletePresaleConfirmVisible()), {
      timeout,
      timeoutMsg: 'The presale delete confirmation never closed'
    });
  }

  /**
   * C-TC-007 - selects a Delivery Date on the Add Presale form.
   *
   * Live-verified 2026-08-25 (build 0.1.90): the picker offers FUTURE dates
   * only (on business date 25 Aug it offered 26-31 Aug), which is consistent
   * with a pre-sale. Both the form's Cancel AND "Save order" stay disabled
   * until this field is set - adding a product alone is not enough.
   */
  async selectFirstAvailableDeliveryDate(): Promise<string> {
    await this.openDeliveryDatePicker();
    const days = [...(await this.driver.$$('//*[@clickable="true" and @content-desc!=""]'))];
    let chosen = '';
    for (const d of days) {
      const desc = (await d.getAttribute('content-desc')) ?? '';
      // Day cells read like "26, Wednesday, August 26, 2026" - a leading digit
      // distinguishes them from the picker's own chrome (Cancel/OK/Next month).
      if (/^\d+,/.test(desc)) {
        chosen = desc;
        await d.click();
        break;
      }
    }
    await this.tap('//*[@content-desc="OK" or @text="OK"]');
    await this.waitFor(this.addPresalesOrderAnchor);
    return chosen;
  }

  /** C-TC-007 - the Delivery Date currently shown on the Add Presale form (e.g. "Wed 26 Aug"). */
  async getAddPresalesDeliveryDate(): Promise<string> {
    const el = await this.driver.$(this.deliveryDateField);
    await el.waitForDisplayed({ timeout: 15_000 });
    return (await el.getAttribute('text')) ?? '';
  }

  /** C-TC-007 - whether the Add Presale form's Cancel is enabled (live-verified: disabled until the form has unsaved content). */
  async isAddPresalesCancelEnabled(): Promise<boolean> {
    return this.isEnabled(this.addPresalesCancelButton);
  }

  /** C-TC-007 - whether the Add Presale form's "Save order" is enabled. */
  async isAddPresalesSaveEnabled(): Promise<boolean> {
    return this.isEnabled(this.addPresalesOrderAnchor);
  }

  /** C-TC-007 - cancels the in-progress presale, discarding it. */
  async cancelAddPresalesOrder(): Promise<void> {
    await this.tap(this.addPresalesCancelButton);
  }

  /** C-TC-007 - types into the Add Presale form's own "Add product" field (hint-matched; it carries no content-desc). */
  async typeAddPresalesProduct(term: string): Promise<void> {
    const f = await this.driver.$(this.addPresalesProductField);
    await f.waitForDisplayed({ timeout: 15_000 });
    await f.click();
    await f.setValue(term);
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
    await this.tap(this.deliveryDatePickerIcon);
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
  // CORRECTED 2026-08-25 (build 0.1.90): was '(//android.widget.EditText)[last()]',
  // a positional guess that silently targets whatever EditText happens to be
  // last in the tree - on the Deliveries screen that is not necessarily the
  // Delivered field (the "Search product" input is also an EditText). The
  // field carries hint="Delivered", which identifies it directly.
  private readonly deliveredQtyField = '//android.widget.EditText[@hint="Delivered"]';
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
    for (;;) {
      const remaining = await this.driver.$$(this.deliveryProductRowAny);
      const count = await remaining.length;
      if (count === 0) {
        break;
      }
      // Same reveal/tap primitives C-TC-011 tests, so the cleanup path and the
      // tested path cannot drift apart. The confirm stays local: this dialog
      // answers Yes, not the Cancel/Delete the Pre-sales one uses.
      await this.revealRowDeleteResilient(this.deliveryProductRowAny);
      await this.tapRowDeleteIcon(this.deliveryProductRowAny);
      await this.tap('~Yes');
      await this.driver.pause(600);
    }
  }

  async isDeliveryProductVisible(name: string): Promise<boolean> {
    return this.isVisible(this.deliveryProductRow(name));
  }

  /**
   * Excel TC211 - sets a product's own Delivered quantity via its
   * numeric-keypad field (see deliveredQtyField's own note on targeting it).
   *
   * NOTE the resulting TEXT may carry a leading zero: this is a keypad-driven
   * field, and clearing it leaves "0" rather than empty, so setValue("4")
   * lands as "04" - live-verified 2026-08-25. The value is numerically
   * correct; callers should compare with Number(), not string equality.
   */
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

  /**
   * Excel TC213 - confirms the dialog via Yes, navigating to Signing Order.
   *
   * REMOVED FROM THE APP as of build 0.1.90 - confirmed by Anthony (QA)
   * 2026-08-25: "there will be no popup anymore. Client asked to remove it."
   * Tapping Continue on Delivery now lands directly on Signing Order.
   * Live-observed the same day: no dialog appeared at all.
   *
   * Kept (rather than deleted) only so existing TC212/TC213 call sites keep
   * compiling, but it is now a NO-OP when no dialog is present instead of
   * hanging on a Yes button that will never exist. TC212/TC213 themselves
   * should be retired from the suite - they assert a flow the client has
   * deliberately removed.
   */
  async confirmDeliveryConfirmDialog(): Promise<void> {
    const yes = await this.driver.$(this.yesButton);
    if (await yes.waitForDisplayed({ timeout: 5_000 }).catch(() => false)) {
      await yes.click();
    }
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
  /**
   * C-TC-015/C-TC-016 - whether a photo checklist tile shows its completion
   * green.
   *
   * The tile carries NO accessible completed/tick signal of its own (its
   * content-desc is identical complete or not), which is why the older
   * TC139-era tests documented the green tick instead of asserting it. Pixel
   * sampling is the only route, reusing the very predicate the Prep Tasks
   * checkboxes needed for the same reason - see BaseScreen.hasCompletionGreen,
   * and note it must be used as a BEFORE/AFTER pair.
   */
  async isPhotoTileComplete(which: 'before' | 'after'): Promise<boolean> {
    const selector = which === 'after' ? this.afterPhotos : this.beforePhotos;
    const el = await this.driver.$(selector);
    await el.waitForDisplayed({ timeout: 15_000 });
    return this.hasCompletionGreen(el);
  }

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

  // ==== C-TC-002: Signing Order -> "Order payment" screen ====
  //
  // Live-verified 2026-08-25 (build 0.1.90, Charlotte 103 / 24Hundred
  // Marketplace, a stop with a REAL seeded order). Reached from Signing
  // Order's own "Payment | Add payment for order delivered" row - a NEW
  // screen in this build (confirmed by Anthony 2026-08-25), and NOT
  // mandatory: only Sign Off is required for Continue to enable.
  //
  // CRITICAL for anyone extending this: every input on this screen exposes
  // NO content-desc and NO text until typed into - the ONLY identifying
  // attribute is `hint` ("Amount*", "Check Number*", "Comments"). A page
  // dump filtered on content-desc/text being non-empty shows NOTHING of
  // them and reads as "the fields don't exist", which is exactly the wrong
  // conclusion drawn here first time round. Always match on hint.
  //
  // Mandatory vs optional is conveyed ONLY by a trailing asterisk in the
  // hint - "Amount*" and "Check Number*" are required, "Comments" is not.
  private readonly paymentRow = '//*[contains(@content-desc,"Payment")]';
  private readonly orderPaymentTitle = '~Order payment';
  private readonly paymentTypeField = '//*[contains(@content-desc,"Payment type")]';
  private paymentInputByHint(hint: string): string {
    return `//android.widget.EditText[@hint="${hint}"]`;
  }

  /**
   * Focus-tolerant locator for READING or WRITING a payment input.
   *
   * Live-verified 2026-08-26: this screen's `hint` SWAPS WITH FOCUS. Unfocused,
   * the Amount input reports its floating label "Amount*"; once focused it
   * reports the in-field placeholder "Enter amount*" instead. So an exact-hint
   * locator resolves fine, and then fails on the very next call after any
   * interaction focused the field - which is exactly how C-TC-023 broke, with
   * a misleading "Amount* still not displayed" for a field plainly on screen.
   *
   * Matches the label's core word case-insensitively (the placeholder
   * lower-cases it), so it holds in either state.
   *
   * NOTE the asterisk is stripped here, which is why this must NOT be used for
   * the mandatory-vs-optional checks: those depend on distinguishing "Amount*"
   * from "Amount", and they keep using the exact matcher above.
   */
  private paymentInputByLabel(label: string): string {
    const core = label.replace(/\*+$/, '').toLowerCase();
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    return `//android.widget.EditText[contains(translate(@hint,'${upper}','${lower}'),'${core}')]`;
  }

  /** C-TC-002 - opens the Order payment screen from Signing Order's Payment row. */
  async openOrderPayment(): Promise<void> {
    await this.tap(this.paymentRow);
    await this.waitFor(this.orderPaymentTitle);
  }

  /** C-TC-002 - the currently selected payment type, read off the field's own "Payment type\nX" content-desc. */
  async getPaymentType(): Promise<string> {
    const el = await this.driver.$(this.paymentTypeField);
    await el.waitForDisplayed({ timeout: 15_000 });
    const desc = (await el.getAttribute('content-desc')) ?? '';
    return desc.split('\n').slice(1).join(' ').trim();
  }

  /** C-TC-002 - the payment types the selector offers (live-verified: Cash, Check). */
  async getPaymentTypeOptions(): Promise<string[]> {
    await this.tap(this.paymentTypeField);
    await this.waitFor('~Cash');
    const opts: string[] = [];
    for (const o of [...(await this.driver.$$('//android.view.View[@clickable="true"]'))]) {
      const d = (await o.getAttribute('content-desc')) ?? '';
      if (d && d !== 'Dismiss') opts.push(d);
    }
    return opts;
  }

  /** C-TC-002 - picks a payment type from the already-open selector. */
  async selectPaymentType(type: 'Cash' | 'Check'): Promise<void> {
    await this.tap(`~${type}`);
    await this.waitFor(this.orderPaymentTitle);
  }

  /** C-TC-002 - opens the selector and picks a type in one step. */
  async choosePaymentType(type: 'Cash' | 'Check'): Promise<void> {
    await this.tap(this.paymentTypeField);
    await this.waitFor(`~${type}`);
    await this.selectPaymentType(type);
  }

  /** C-TC-002 - whether an Order payment input is rendered, matched by its hint (see this section's own note on why hint is the only usable attribute). */
  async isPaymentFieldVisible(hint: string): Promise<boolean> {
    return this.isVisible(this.paymentInputByHint(hint));
  }

  // ==== C-TC-011 / C-TC-014: delivery product rows ====
  //
  // Live-verified 2026-08-25 (build 0.1.90). A product row reads
  // "CanteenSugrCanister20oz (Pkg: 24) (Price: 117.26)\nOrdered\n-" with a
  // sibling EditText hinted "Delivered". Deleting is a swipe-left on the row,
  // which reveals an UNLABELLED Button inside it (desc="null"), then a
  // "Delete Product / Are you sure you want to delete the X?" dialog with
  // No/Yes.
  private readonly deliveryProductRowAny = '//android.view.View[contains(@content-desc,"Pkg:")]';
  private readonly deleteProductConfirm = '//*[starts-with(@content-desc,"Delete Product")]';

  /** C-TC-011/C-TC-014 - how many product rows the Deliveries list currently shows. */
  async getDeliveryProductRowCount(): Promise<number> {
    return [...(await this.driver.$$(this.deliveryProductRowAny))].length;
  }

  /**
   * C-TC-014 - the first delivery product row's full label, e.g.
   * "CanteenSugrCanister20oz (Pkg: 24) (Price: 117.26) Ordered -".
   *
   * Read whole rather than probed by name: the row concatenates product,
   * packaging, price, the "Ordered" label and its value into ONE content-desc,
   * so isDeliveryProductVisible()'s starts-with match only ever finds the
   * product name at the front - asking it for "Ordered" returns false even
   * though the label is plainly there.
   */
  async getFirstDeliveryProductRowText(): Promise<string> {
    const row = await this.driver.$(this.deliveryProductRowAny);
    await row.waitForDisplayed({ timeout: 15_000 });
    return ((await row.getAttribute('content-desc')) ?? '').replace(/\n/g, ' ');
  }

  /** C-TC-014 - whether the row's editable "Delivered" quantity field is present. */
  async isDeliveredQtyFieldVisible(): Promise<boolean> {
    return this.isVisible(this.deliveredQtyField);
  }

  /** C-TC-014 - the current Delivered quantity. */
  async getDeliveredQty(): Promise<string> {
    const f = await this.driver.$(this.deliveredQtyField);
    await f.waitForDisplayed({ timeout: 15_000 });
    return (await f.getAttribute('text')) ?? '';
  }

  /**
   * C-TC-011/C-TC-014 - adds the FIRST product in the Deliveries search
   * results, returning its name. Positional for the same reason as
   * selectFirstPresaleSearchResult: the by-name helper can resolve to a
   * container and select the wrong row.
   */
  async addFirstDeliverySearchResult(term: string): Promise<string> {
    await this.openAddDeliveryProduct();
    await this.searchDeliveryProductOption(term);
    const resultRow = '//android.view.View[contains(@content-desc,"pkg:")]';
    await this.driver.waitUntil(
      async () => [...(await this.driver.$$(resultRow))].length > 0,
      { timeout: 15_000, timeoutMsg: `No delivery products matched "${term}"` }
    );
    const rows = [...(await this.driver.$$(resultRow))];
    const name = ((await rows[0].getAttribute('content-desc')) ?? '').split('\n')[0];
    await rows[0].click();
    return name;
  }

  /** C-TC-011 - swipes the first product row left, revealing its delete control. These rows register the FAST gesture, unlike the saved-presale row. */
  async revealDeliveryProductDelete(): Promise<void> {
    await this.revealRowDelete(this.deliveryProductRowAny);
  }

  /** C-TC-011 - whether the delete control revealed by revealDeliveryProductDelete() is showing. */
  async isDeliveryProductDeleteIconVisible(): Promise<boolean> {
    return this.isRowDeleteIconVisible(this.deliveryProductRowAny);
  }

  /** C-TC-011 - taps the delete control revealed by revealDeliveryProductDelete(). */
  async tapRevealedDeliveryProductDelete(): Promise<void> {
    await this.tapRowDeleteIcon(this.deliveryProductRowAny);
  }

  /** C-TC-011 - whether the "Delete Product" confirmation is showing. */
  async isDeleteProductConfirmVisible(): Promise<boolean> {
    return this.isVisible(this.deleteProductConfirm);
  }

  /** C-TC-011 - the confirmation's full message, for asserting it names the product. */
  async getDeleteProductConfirmText(): Promise<string> {
    const el = await this.driver.$(this.deleteProductConfirm);
    await el.waitForDisplayed({ timeout: 15_000 });
    return ((await el.getAttribute('content-desc')) ?? '').replace(/\n/g, ' ');
  }

  /** C-TC-011 - confirms the deletion. */
  async confirmDeleteProduct(): Promise<void> {
    await this.tap('//android.widget.Button[@content-desc="Yes"]');
  }

  /** C-TC-011 - declines the deletion, leaving the product in place. */
  async declineDeleteProduct(): Promise<void> {
    await this.tap('//android.widget.Button[@content-desc="No"]');
  }

  /**
   * C-TC-011 - waits for the Delete Product confirmation to actually leave the
   * tree after Yes/No.
   *
   * Needed because the dialog is a separate window: while it is up (and while
   * it is dismissing), the Deliveries list behind it is not reliably in the
   * accessibility tree, so an immediate getDeliveryProductRowCount() can read
   * 0 for a row that is still there.
   */
  async waitForDeleteProductConfirmGone(timeout = 15_000): Promise<void> {
    await this.driver.waitUntil(async () => !(await this.isDeleteProductConfirmVisible()), {
      timeout,
      timeoutMsg: 'The Delete Product confirmation never closed'
    });
  }

  // ==== C-TC-005: the Deliveries screen's empty state ====
  //
  // Live-verified 2026-08-25 (build 0.1.90, Charlotte 103). The fee lines
  // BELONG on this screen: a POPULATED Deliveries screen renders "Shipping &
  // Handling (Taxable) $1.06" and "Delivery Charge (Nontaxable) $12.00" above
  // the product rows. The EMPTY state omits them entirely - that is the defect
  // behind BUG 918856, and the reason this had to be checked both ways: if
  // fees had been absent from the populated screen too, the test case would
  // simply have been pointing at the wrong screen rather than the app being
  // wrong.
  private readonly deliverySearchField = '//android.widget.EditText[@hint="Search product"]';
  private readonly deliveryAddIcon = '~section_header_add_cta';
  private readonly deliverySortIcon = '~section_header_sort_cta';
  private readonly deliveriesHeading = '~Deliveries';

  /** C-TC-005 - the Deliveries screen's own heading. */
  async isDeliveriesHeadingVisible(): Promise<boolean> {
    return this.isVisible(this.deliveriesHeading);
  }

  /** C-TC-005 - the "Search product" input, matched by hint (it carries no content-desc). */
  async isDeliverySearchFieldVisible(): Promise<boolean> {
    return this.isVisible(this.deliverySearchField);
  }

  /** C-TC-005 - the Add and Sort header icons (both unlabelled section_header_*_cta ids). */
  async areDeliveryHeaderIconsVisible(): Promise<{ add: boolean; sort: boolean }> {
    return {
      add: await this.isVisible(this.deliveryAddIcon),
      sort: await this.isVisible(this.deliverySortIcon)
    };
  }

  /** C-TC-005 - whether a named fee line (e.g. "Shipping & Handling") is rendered on the Deliveries screen. */
  async isDeliveryFeeLineVisible(label: string): Promise<boolean> {
    return this.isVisible(`//*[contains(@content-desc,"${label}")]`);
  }

  /** C-TC-005 - whether the Deliveries screen's own Continue is enabled. */
  async isDeliveriesContinueEnabled(): Promise<boolean> {
    return this.isDeliveryContinueEnabled();
  }

  // ==== C-TC-004: the signature-discard confirmation ====
  //
  // Live-verified 2026-08-25 (build 0.1.90, Charlotte 103): pressing BACK on
  // the Customer Signature screen behaves differently depending on whether a
  // signature has been drawn:
  //   - UNSIGNED -> returns straight to Signing Order, no prompt at all.
  //   - SIGNED   -> raises "Are you sure? / Your signature will be lost if you
  //                 go back without saving." with Cancel and "Go Back".
  // Cancel returns to the signature screen with the signature still intact;
  // "Go Back" is the discard path.
  private readonly signatureDiscardPrompt = '//*[starts-with(@content-desc,"Are you sure?")]';
  private readonly signatureDiscardCancel = '//android.widget.Button[@content-desc="Cancel"]';
  private readonly signatureDiscardConfirm = '//android.widget.Button[@content-desc="Go Back"]';

  /**
   * C-TC-033 - whether a named summary line (e.g. "Service Fee", "Tax") is
   * rendered on the current screen.
   *
   * Matched on `contains`, not an exact label, because these lines pair the
   * label and its price inside one content-desc.
   */
  async isSummaryLineVisible(label: string): Promise<boolean> {
    // Matches content-desc OR hint. "Items Delivered" is an EditText that
    // exposes its label ONLY as a hint (live-verified 2026-08-26: the screen's
    // content-desc dump reads "... 16 | Ordered Items | Delivery summary ..."
    // with no "Items Delivered" in it at all), the same hint-only pattern the
    // Order payment screen's inputs use. A content-desc-only match reports
    // this plainly-visible field as missing.
    return this.isVisible(
      `//*[contains(@content-desc,"${label}") or contains(@hint,"${label}")]`
    );
  }

  /**
   * C-TC-033 - whether a real "Tax" line exists in the Cost summary.
   *
   * Deliberately NOT a plain contains("Tax"): the Cost summary carries
   * "Shipping & Handling (Taxable)" and "Delivery Charge (Nontaxable)", both
   * of which contain the substring, so a naive match reports a Tax line that
   * is not there - a false pass on exactly the clause under test.
   */
  async isTaxLineVisible(): Promise<boolean> {
    return this.isVisible(
      '//*[contains(@content-desc,"Tax") and not(contains(@content-desc,"Taxable"))]'
    );
  }

  /**
   * C-TC-033 - whether Signing Order's Sign Off row is present.
   *
   * Scrolls to find it for the same reason openSignOff() does: it is the LAST
   * element on the page and drops below the fold once the Delivery summary
   * grows, so a flat visibility check reports false for a row that is really
   * there.
   */
  async isSignOffRowVisible(): Promise<boolean> {
    for (let i = 0; i < 5; i++) {
      if (await this.isVisible(this.signOffTrigger)) {
        return true;
      }
      await this.scrollDown();
    }
    return false;
  }

  /** C-TC-004 - whether we are back on the Signing Order summary screen. */
  async isSigningOrderTitleVisible(): Promise<boolean> {
    return this.isVisible(this.signingOrderTitle);
  }

  /** C-TC-004 - whether the "Are you sure?" signature-discard prompt is showing. */
  async isSignatureDiscardPromptVisible(): Promise<boolean> {
    return this.isVisible(this.signatureDiscardPrompt);
  }

  /** C-TC-004 - the discard prompt's full message, for asserting its wording. */
  async getSignatureDiscardPromptText(): Promise<string> {
    const el = await this.driver.$(this.signatureDiscardPrompt);
    await el.waitForDisplayed({ timeout: 15_000 });
    return ((await el.getAttribute('content-desc')) ?? '').replace(/\n/g, ' ');
  }

  /** C-TC-004 - dismisses the discard prompt via Cancel, staying on the signature screen with the signature kept. */
  async cancelSignatureDiscard(): Promise<void> {
    await this.tap(this.signatureDiscardCancel);
    await this.waitFor('~Customer signature here:');
  }

  /** C-TC-004 - confirms the discard via "Go Back", losing the signature and returning to Signing Order. */
  async confirmSignatureDiscard(): Promise<void> {
    await this.tap(this.signatureDiscardConfirm);
    await this.waitFor(this.signingOrderTitle);
  }

  /**
   * C-TC-054 - the delivery's order number as displayed, or '' if none.
   *
   * Matched in JS rather than XPath for two reasons. The label has been seen
   * in more than one shape ("Order #..." here, bare "Order 13517404" on
   * Market), so an exact prefix is unsafe; and a loose contains("Order") would
   * also match the Deliveries list's own "Ordered" column header, which is a
   * false positive on precisely the thing under test - the same trap as
   * contains("Tax") matching "(Taxable)".
   */
  async getDeliveryOrderNumber(): Promise<string> {
    for (const el of [...(await this.driver.$$('//*[contains(@content-desc,"Order")]'))]) {
      const desc = ((await el.getAttribute('content-desc')) ?? '').replace(/\n/g, ' ');
      const match = desc.match(/Order\s*#?\s*(\d{3,})/);
      if (match) {
        return match[0];
      }
    }
    return '';
  }

  /** C-TC-002/C-TC-022 - whether the Order payment screen itself is still displayed (its own title). */
  async isOrderPaymentScreenVisible(): Promise<boolean> {
    return this.isVisible(this.orderPaymentTitle);
  }

  /** C-TC-003 - types into an Order payment input, matched by hint. */
  async typePaymentField(hint: string, value: string): Promise<void> {
    const f = await this.driver.$(this.paymentInputByLabel(hint));
    await f.waitForDisplayed({ timeout: 15_000 });
    await f.click();
    await f.setValue(value);
  }

  /** C-TC-003 - reads back an Order payment input's current value. */
  async getPaymentFieldValue(hint: string): Promise<string> {
    const f = await this.driver.$(this.paymentInputByLabel(hint));
    await f.waitForDisplayed({ timeout: 15_000 });
    return (await f.getAttribute('text')) ?? '';
  }

  /** C-TC-003 - clears an Order payment input. */
  async clearPaymentField(hint: string): Promise<void> {
    const f = await this.driver.$(this.paymentInputByLabel(hint));
    await f.click();
    await f.clearValue();
  }

  /**
   * C-TC-003 - taps the Order payment screen's Done.
   *
   * Note this button stays ENABLED even when mandatory fields are empty -
   * validation fires on tap, showing an inline "Cannot be empty" message and
   * keeping the user on the screen, rather than gating the button. Same
   * validate-on-submit shape as Market's own Continue (see M-TC-015).
   */
  async tapPaymentDone(): Promise<void> {
    await this.tap('//android.widget.Button[@content-desc="Done"]');
  }

  /** C-TC-003 - whether Done is currently enabled (live-verified: true even with mandatory fields empty). */
  async isPaymentDoneEnabled(): Promise<boolean> {
    return this.isEnabled('//android.widget.Button[@content-desc="Done"]');
  }

  /** C-TC-003 - the inline validation message raised by submitting with a mandatory field empty. */
  async isPaymentValidationErrorVisible(): Promise<boolean> {
    return this.isVisible('~Cannot be empty');
  }

  /**
   * C-TC-002 - whether the field carrying `label` is optional. This screen
   * marks mandatory fields with a trailing asterisk in the hint and nothing
   * else, so "optional" means an un-asterisked hint exists for that label.
   */
  async isPaymentFieldOptional(label: string): Promise<boolean> {
    const plain = await this.isVisible(this.paymentInputByHint(label));
    const required = await this.isVisible(this.paymentInputByHint(`${label}*`));
    return plain && !required;
  }

  /**
   * C-TC-001 - the Add Equipment form's Audit Date.
   *
   * Live-verified 2026-08-25 (build 0.1.90, Coffee/Equipment audit): this
   * field exposes NO accessibility label whatsoever - its content-desc is
   * the literal string "null" and the value lives only in `text` (e.g.
   * "08/25/2026"). It can therefore only be matched on the SHAPE of its own
   * value: a 10-character MM/DD/YYYY string. Same unlabelled-element pattern
   * as this screen's own section_header_add_cta (see addEquipmentTrigger).
   * If a second date-shaped value is ever added to this form, this locator
   * needs revisiting - there is no more specific hook available today.
   */
  private readonly auditDateField =
    '//android.view.View[contains(@text,"/") and string-length(@text)=10]';

  /** C-TC-001 - the auto-populated Audit Date's own value, as displayed (MM/DD/YYYY). */
  async getAuditDate(): Promise<string> {
    const el = await this.driver.$(this.auditDateField);
    await el.waitForDisplayed({ timeout: 15_000 });
    return (await el.getAttribute('text')) ?? '';
  }

  /**
   * C-TC-001 - whether the Audit Date can be changed by the driver. Reads
   * BOTH signals rather than just one: a field is editable if it is either
   * clickable (opens a date picker) or a real EditText (accepts typing).
   */
  async isAuditDateEditable(): Promise<boolean> {
    const el = await this.driver.$(this.auditDateField);
    await el.waitForDisplayed({ timeout: 15_000 });
    const clickable = await el.getAttribute('clickable');
    const cls = (await el.getAttribute('class')) ?? '';
    return clickable === 'true' || cls.endsWith('EditText');
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
    account?: string;
    manufacturer: string;
    model: string;
    barcode: string;
    serialNumber: string;
    assetNumber: string;
  }): Promise<void> {
    // Account is OPTIONAL here on purpose. The form arrives with the stop's
    // own account already selected (live-verified 2026-08-26 on Charlotte 103:
    // "Account | 24Hundred Marketplace"), and the account list is scoped to
    // the route - passing a name from another route silently fails as
    // "Covista still not displayed", which is exactly how this bit once. Omit
    // it to keep the pre-filled value, which is what a real driver would do.
    if (values.account) {
      await this.selectAddEquipmentDropdownOption('Account', values.account);
    }
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
      // CORRECTED 2026-08-26: this used the fast swipe inline and was live-
      // observed failing - the card was found but its delete Button never
      // appeared, so the tap timed out 15s later and took the whole test with
      // it. Escalates to the slow gesture now; see revealRowDeleteResilient.
      if (!(await this.revealRowDeleteResilient(cardSelector))) {
        throw new Error('An equipment card would not reveal its delete control under either swipe gesture');
      }
      await this.tapRowDeleteIcon(cardSelector);
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

  /**
   * C-TC-021 - an equipment card's FULL label, newline-joined.
   *
   * getEquipmentCardSummary() reads fixed positions (parts[2]/[4]/[6]/[7]) and
   * so has no slot for "Equipped Date & Time", which C-TC-021 requires. Read
   * the whole thing instead of extending that positional parse: if the field
   * is absent the raw text says so plainly, whereas another hardcoded index
   * would just return '' and read as a failed assertion against a field that
   * may not exist at all.
   */
  async getEquipmentCardRawText(name: string): Promise<string> {
    const el = await this.driver.$(this.equipmentCard(name));
    await el.waitForDisplayed({ timeout: 15_000 });
    return ((await el.getAttribute('content-desc')) ?? '').replace(/\n/g, ' | ');
  }

  /**
   * C-TC-021 - deletes ONE named equipment card, returning whether it was
   * there to delete.
   *
   * Targeted on purpose. deleteAllEquipment() clears the list indiscriminately,
   * and Charlotte 103's Coffee stops carry REAL seeded equipment (live-observed
   * 2026-08-26: "Amana / RSC10 / ghh KJ / 589988") which is customer data, not
   * fixture data - wiping it to get a clean slate would be a destructive act
   * dressed up as test setup. A test that creates a card should remove exactly
   * that card and nothing else.
   *
   * Live-observed the seeded card does NOT reveal a delete control under either
   * swipe gesture, which is consistent with real records being undeletable from
   * here - another reason not to point deleteAllEquipment() at this screen.
   */
  async deleteEquipmentByName(name: string): Promise<boolean> {
    const sel = this.equipmentCard(name);
    if (!(await this.isVisible(sel))) {
      return false;
    }
    if (!(await this.revealRowDeleteResilient(sel))) {
      return false;
    }
    await this.tapRowDeleteIcon(sel);
    await this.driver.pause(600);
    return true;
  }

  /**
   * C-TC-021 - the name of the first equipment card on the audit list, or ''
   * if there are none.
   *
   * Read at runtime, never hardcoded: the seeded equipment differs per stop
   * (live-observed "Amana" on 24Hundred Marketplace) and is real customer
   * data that can change, exactly like the stop names this suite already
   * refuses to hardcode.
   */
  async getFirstEquipmentCardName(): Promise<string> {
    const cards = [...(await this.driver.$$('//android.view.View[contains(@content-desc,"Model:")]'))];
    if (!cards.length) {
      return '';
    }
    return ((await cards[0].getAttribute('content-desc')) ?? '').split('\n')[0].trim();
  }

  /** C-TC-021 - every Button on screen with its label, enabled state and position - for evidencing whether an UNLABELLED control (a swipe-revealed trash icon) appeared at all. */
  async describeButtons(): Promise<string> {
    const parts: string[] = [];
    for (const b of [...(await this.driver.$$('//android.widget.Button'))]) {
      const loc = await b.getLocation();
      const size = await b.getSize();
      parts.push(
        `desc="${await b.getAttribute('content-desc')}" enabled=${await b.getAttribute('enabled')} @${loc.x},${loc.y} ${size.width}x${size.height}`
      );
    }
    return parts.join(' | ');
  }

  /** C-TC-021 - every content-desc currently on screen, joined - used to evidence whether a field (e.g. "Equipped Date & Time") exists at all rather than asserting blind against it. */
  async getVisibleScreenText(): Promise<string> {
    const parts: string[] = [];
    for (const e of [...(await this.driver.$$('//*[@content-desc!=""]'))]) {
      parts.push(((await e.getAttribute('content-desc')) ?? '').replace(/\n/g, ' | '));
    }
    return parts.join('  //  ');
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
