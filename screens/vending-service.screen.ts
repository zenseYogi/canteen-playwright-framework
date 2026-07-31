import { BaseScreen } from './base.screen';
import { positionToIndex, type Position } from '../utils/position';

/**
 * Vending LOB - servicing a delivery location. Ported from vending_keywords.robot,
 * then re-verified and extended live against build 0.1.76 on Route 103 (a
 * Vending-only route) - see docs/rf-to-playwright-reuse.md's Vending section.
 */
export class VendingServiceScreen extends BaseScreen {
  private readonly vendingLob = '//android.widget.ImageView[contains(@content-desc,"vending")]';
  private readonly fills = '//android.view.View[starts-with(@content-desc,"Fills")]';
  private readonly productFillsTitle = '~Product fills';
  private readonly moneyOperations = '//android.view.View[starts-with(@content-desc, "Money Operations")]';
  // Live-verified: the Money Operations sub-screen's own title is "Money
  // Collection" (same pattern as Market's), not "Money Operations" - that
  // label only belongs to the trigger tile on the machine's service menu.
  private readonly moneyCollectionTitle = '~Money Collection';
  private readonly skipMoneyBagCheckbox = '//android.widget.CheckBox';
  // Vending's Money Collection has 3 EditTexts (bag code / Replenishment
  // Bills / Refund amount) - one fewer than Market's 4 (no separate coins
  // field). CORRECTED: all three DO carry their own accessible hint
  // ("Bag code"/"Bills"/"Amounts", live-verified via a raw page-source
  // dump) - the original claim that none expose one was wrong; kept as
  // positional indexing anyway since that's already proven working
  // throughout this file and every other caller.
  private readonly bagCodeField = '//android.widget.EditText[1]';
  private readonly billsField = '//android.widget.EditText[2]';
  private readonly refundField = '//android.widget.EditText[3]';

  // Excel TC250/TC251/TC253/TC254/TC256/TC259/TC260/TC264 (Vending "Money
  // ops" - the Bag code sub-flow) - live-verified 2026-07-30 (build
  // 0.1.76, Route 103/YESTERDAY, "Admark Graphics" stop, "97624 - Bottle
  // Bev" machine).
  //
  // Key live-verified discrepancies from the Excel (documented, not
  // asserted as bugs):
  // - TC250/TC251 "Bag code field disabled" / "+ icon disabled" - both
  //   live-verified FALSE: both are enabled/clickable from the moment
  //   the screen opens, same "always enabled" pattern already documented
  //   elsewhere in this app (Continue/Apply buttons).
  // - TC256/TC258 "bag chip added" (after manual entry / after a scan) -
  //   live-verified FALSE: there is no chip/tag UI at all - the code
  //   simply stays as plain text inside the same EditText, same pattern
  //   as every other field in this app.
  // - Bag code is driven by the SAME custom digit-only keypad family
  //   used throughout this app (0-9, a "-"/"+" stepper pair, backspace,
  //   confirm) - there is no way to enter letters through it at all, so
  //   the Excel's own alphanumeric test data ("A29389P", "CR5249Q2") and
  //   TC264's "@@@@" (invalid characters) are both unreachable via real
  //   keypad interaction; not asserted as-is.
  // - TC258 (scan a bag code via the camera) - not exercised here, same
  //   reasoning as every other real-camera flow in this app (see the
  //   After Photos section's own note) - live-verified the scanner icon
  //   opens the device camera, not exercised end-to-end.
  // - TC264 "invalid bag code -> inline error, chip not added" - adapted
  //   rather than reproduced verbatim: live-verified that once the
  //   Additional code field exists (via the + icon) and BOTH bag code
  //   fields are left empty, tapping Continue shows a real (if brief,
  //   toast-like) banner - "All bag code fields must be filled in." -
  //   and Money Collection stays open. This is the closest real
  //   validation behavior to TC264's own intent.
  private readonly addBagCodeIcon = '~section_header_add_cta';
  private readonly additionalCodeField = '//android.widget.EditText[@hint="Additional code"]';
  private readonly bagCodeFieldsError = '~All bag code fields must be filled in.';
  // The Bag code field's own barcode-scanner icon - live-verified as an
  // unlabeled ImageView immediately following the field itself (no
  // content-desc of its own), same structural pattern as this file's
  // other unlabeled icon buttons.
  private readonly bagCodeScannerIcon = '(//android.widget.EditText[@hint="Bag code"]/following-sibling::android.widget.ImageView)[1]';

  // Excel TC261/TC262/TC263/TC265 (Vending "Money ops" - continuing the
  // Bag code sub-flow above with MULTIPLE Additional code fields) - live-
  // verified 2026-07-30 (build 0.1.76, Route 103/YESTERDAY, "Admark
  // Graphics" stop, "64922 - Lg Snacks" machine).
  //
  // Key live-verified discrepancies from the Excel (documented, not
  // asserted as bugs):
  // - TC261 "scanner icon in Additional bag code" - confirmed true: every
  //   Additional code field gets its own scanner icon, same as the
  //   primary Bag code field.
  // - TC262 "add another bag via + -> chip added" - live-verified FALSE,
  //   same "no chip" pattern as TC256/TC258 above - the "+" icon simply
  //   reveals ANOTHER plain "Additional code" EditText, not a chip.
  // - TC263 "5+ bag codes -> 4 chips visible, remaining scrollable, no
  //   limit" - adapted: there is no chip system to show "4 visible", but
  //   live-verified true in spirit - tapping "+" repeatedly keeps adding
  //   MORE Additional code fields with no observed cap (tested to 5
  //   total, the icon stayed enabled throughout), and the whole form
  //   sits inside a genuinely scrollable container (confirmed via a raw
  //   page-source dump: the parent's own `scrollable="true"`).
  // - TC265 "duplicate bag code -> inline error, chip not added" -
  //   adapted like TC264: live-verified a real "Duplicate bag codes are
  //   not allowed" banner appears on Continue when two bag code fields
  //   share the same value, and Money Collection stays open (the
  //   submission is genuinely blocked, not just a missing chip).
  private readonly duplicateBagCodeError = '~Duplicate bag codes are not allowed';

  private additionalCodeFieldAt(n: number): string {
    return `(${this.additionalCodeField})[${n}]`;
  }

  private additionalCodeScannerIconAt(n: number): string {
    return `(${this.additionalCodeField}/following-sibling::android.widget.ImageView)[${n}]`;
  }

  async isAdditionalCodeScannerIconVisible(n = 1): Promise<boolean> {
    return this.isVisible(this.additionalCodeScannerIconAt(n));
  }

  /** Excel TC262/TC263 - taps the "+" icon to reveal one more Additional code field, beyond however many already exist (see this class's own note above - there is no observed cap). */
  async tapAddBagCodeIcon(): Promise<void> {
    await this.tap(this.addBagCodeIcon);
  }

  async getAdditionalCodeFieldCount(): Promise<number> {
    const fields = await this.driver.$$(this.additionalCodeField);
    return fields.length;
  }

  /** Excel TC262/TC265 - enters a bag code into the Nth Additional code field via the SAME digit-only keypad as the primary Bag code field. */
  async enterAdditionalBagCode(n: number, digits: string): Promise<void> {
    const field = await this.driver.$(this.additionalCodeFieldAt(n));
    await field.click();
    for (const digit of digits) {
      await (await this.driver.$(`~${digit}`)).click();
    }
    await this.dismissNumericKeypad();
  }

  /** Excel TC265 (adapted - see this class's own note above) - the real validation banner shown when Continue is tapped with two bag code fields sharing the same value. */
  async isDuplicateBagCodeErrorVisible(): Promise<boolean> {
    return this.isVisible(this.duplicateBagCodeError);
  }

  async isBagCodeFieldEnabled(): Promise<boolean> {
    const field = await this.driver.$(this.bagCodeField);
    return (await field.getAttribute('enabled').catch(() => 'false')) === 'true';
  }

  async isAddBagCodeIconEnabled(): Promise<boolean> {
    return this.isEnabled(this.addBagCodeIcon);
  }

  async getBagCodeFieldText(): Promise<string> {
    const field = await this.driver.$(this.bagCodeField);
    return field.getText();
  }

  async isBagCodeScannerIconVisible(): Promise<boolean> {
    return this.isVisible(this.bagCodeScannerIcon);
  }

  /**
   * Excel TC257 - live-verified FALSE: tapping the Bag code field opens
   * the SAME custom digit-only keypad as Product fills' Delivery/End
   * fields (a "5" digit key becomes visible), not a real
   * character/alphanumeric keyboard - see this class's own note above
   * on why only digits are reachable through it. Dismisses the keypad
   * afterward without entering anything, leaving the field untouched
   * for callers that only want to check which keypad opened.
   */
  async isBagCodeDigitKeypadVisible(): Promise<boolean> {
    const field = await this.driver.$(this.bagCodeField);
    await field.click();
    const isDigitKeypadVisible = await this.isVisible('~5');
    await this.dismissNumericKeypad();
    return isDigitKeypadVisible;
  }

  /** Excel TC256 - drives the SAME custom digit-only keypad as Product fills' Delivery/End fields (see this class's own note above on why only digits are reachable). Dismisses the keypad afterward, matching the established pattern elsewhere in this file. */
  async enterBagCode(digits: string): Promise<void> {
    const field = await this.driver.$(this.bagCodeField);
    await field.click();
    if (!digits) {
      await field.clearValue();
    } else {
      for (const digit of digits) {
        await (await this.driver.$(`~${digit}`)).click();
      }
    }
    await this.dismissNumericKeypad();
  }

  async tapContinue(): Promise<void> {
    await this.tap(this.continueButton);
  }

  /** Fills only the Bills field - lets callers isolate the Bag code fields' own validation (see isBagCodeFieldsErrorVisible's own note) from the "enter at least one value" validation that fires when Bills/Refund are ALSO both empty. */
  async enterBillsAmount(value: string): Promise<void> {
    const bills = await this.driver.$(this.billsField);
    await bills.click();
    await bills.setValue(value);
    await this.driver.hideKeyboard().catch(() => {});
  }

  async getBillsAmount(): Promise<string> {
    const bills = await this.driver.$(this.billsField);
    return bills.getText();
  }

  /**
   * Excel TC266/TC267/TC277 (Vending "Money ops" - the Replenishment
   * Amount section) - live-verified 2026-07-30 (build 0.1.76, Route
   * 103/YESTERDAY, "Advocate Health Carolina Neurosurgery & Spine
   * Association" stop, "69153 - Lg Snacks" machine).
   *
   * TC266 "section renamed to Replenishment Amount" - already confirmed
   * true via isMoneyCollectionScreenVisible's own field-presence check
   * (see that test's own TC246 note).
   *
   * TC267 "expand Replenishment Amount -> see $5 and $10 bill inputs" -
   * live-verified FALSE: there is only ONE generic Bills field (same one
   * `billsField`/enterBillsAmount already use), not a $5/$10 denomination
   * breakdown. The section genuinely IS collapsible/expandable though -
   * tapping its header toggles the Bills field's own visibility, with no
   * separate accessible expanded/collapsed signal (the header's own
   * content-desc/attributes are byte-identical either way) - visibility
   * of the Bills field itself is the only real signal.
   */
  private readonly replenishmentAmountHeader = '~Replenishment Amount\ncheck starting cash in machine';

  async toggleReplenishmentAmountSection(): Promise<void> {
    await this.tap(this.replenishmentAmountHeader);
  }

  /**
   * CORRECTED: originally checked billsField (`EditText[2]`) directly,
   * but that's a positional index - once the section collapses and the
   * Bills EditText is removed from the tree entirely, the Refund
   * field's own Amounts EditText shifts up to take index 2, making the
   * positional check report "visible" (true) even while collapsed.
   * hint="Bills" is stable regardless of how many EditTexts currently
   * exist above it.
   */
  async isReplenishmentAmountExpanded(): Promise<boolean> {
    return this.isVisible('//android.widget.EditText[@hint="Bills"]');
  }

  /** Excel TC259/TC260 - tapping the "+" icon reveals a second "Additional code" field (own hint/placeholder confirmed live). */
  async openAdditionalBagCodeField(): Promise<void> {
    await this.tap(this.addBagCodeIcon);
    await this.waitFor(this.additionalCodeField);
  }

  async getAdditionalCodeFieldText(n = 1): Promise<string> {
    const field = await this.driver.$(this.additionalCodeFieldAt(n));
    return field.getText();
  }

  /** Excel TC264 (adapted - see this class's own note above) - the real validation banner shown when Continue is tapped with the Additional code field present but both bag code fields empty. */
  async isBagCodeFieldsErrorVisible(): Promise<boolean> {
    return this.isVisible(this.bagCodeFieldsError);
  }

  // Excel TC004-TC015 (Vending "After Photos") - live-verified 2026-07-29
  // (build 0.1.76, Route 103/YESTERDAY, "Aaron's" stop, "11333 - Bottle
  // Bev" and "11328 - Bottle Bev" machines).
  //
  // Unlike Coffee (where every checklist tile is independently tappable),
  // Vending's After Photos tile starts DISABLED (clickable="false", its
  // title/subtitle rendered as two separate un-combined content-desc
  // elements) until Before Photos, Money Operations, Fills, AND Removals &
  // Returns are ALL completed first - only then does it become one
  // tappable "{Title}\n{Subtitle}" element, matching every other tile's
  // shape. TC004's own "Able to see After Photos option available" is true
  // only in the sense of "visible on screen" - not "immediately usable".
  //
  // Once reachable, the flow is byte-for-byte the same shared component
  // already proven for Coffee: "Add supporting photo" modal (Take/Skip
  // photo, no camera opened yet - TC005) -> either the real device camera
  // (Take photo - TC006/TC007: live-verified NO "Taking a photo" text
  // overlay, and unlike Coffee's totally inaccessible camera view, the
  // emulator's own virtual camera IS capturable - tapping the shutter
  // reaches a review screen with Delete/Take again/Attach Photo, and
  // Attach Photo genuinely saves and returns to the checklist with the
  // tile marked done - TC008/TC009) or the Skip Photo reason sheet
  // (BaseScreen's openSkipPhotoReasonSheet/isSkipPhotoSubmitEnabled/
  // enterSkipPhotoReason/confirmSkipPhoto - TC010-TC013, identical
  // disabled-until-non-blank-reason behavior to Coffee/Market).
  //
  // TC014 "completion indicator" - live-verified as a real visual signal
  // (the tile's background turns green with a checkmark icon) but, same
  // as Coffee's equivalent, carries NO accessible signal of its own
  // (content-desc/selected/checked all unchanged) - not independently
  // asserted, documented instead.
  private readonly afterPhotos = '//android.view.View[starts-with(@content-desc,"After Photos")]';
  private readonly beforePhotos = '//android.view.View[starts-with(@content-desc,"Before Photos")]';
  // removalsAndReturns itself is BaseScreen's own shared locator - not redeclared here.

  async clickServiceLocation(position: Position): Promise<void> {
    await this.selectServiceLocation(this.vendingLob, position);
  }

  /** Opens Product fills without continuing - lets callers assert the list/Sort/Filter before committing. */
  async openFills(): Promise<void> {
    await this.tap(this.fills);
    await this.waitFor(this.productFillsTitle);
  }

  async isProductFillsTitleVisible(): Promise<boolean> {
    return this.isVisible(this.productFillsTitle);
  }

  /**
   * Ported from "Perform Vending fills by searching for X and clicking on
   * the Nth record in the search result screen" - but RF's own keyword body
   * never actually used its search-term/position arguments; it just opens
   * Fills and continues. Named here to match what it actually does rather
   * than what the RF keyword's name implied.
   */
  async openFillsAndContinue(): Promise<void> {
    await this.openFills();
    await this.tap(this.continueButton);
  }

  /** Opens Money Operations without filling/submitting - lets callers assert field presence first. */
  async openMoneyOperations(): Promise<void> {
    await this.tap(this.moneyOperations);
    await this.waitFor(this.moneyCollectionTitle);
  }

  /**
   * Excel's Vending Money ops field-presence TCs (view all sections, Skip
   * Money Bag label, bag code/Replenishment/Refund fields) - all four
   * locators confirmed live against build 0.1.76.
   */
  async isMoneyCollectionScreenVisible(): Promise<{
    title: boolean;
    skipMoneyBag: boolean;
    bagCode: boolean;
    bills: boolean;
    refund: boolean;
  }> {
    return {
      title: await this.isVisible(this.moneyCollectionTitle),
      skipMoneyBag: await this.isVisible(this.skipMoneyBagCheckbox),
      bagCode: await this.isVisible(this.bagCodeField),
      bills: await this.isVisible(this.billsField),
      refund: await this.isVisible(this.refundField)
    };
  }

  /**
   * CORRECTED (live-verified): the original version used BaseScreen's
   * generic type() helper (setValue() with no preceding click()) on all
   * three fields - it visually filled them, but Continue then failed
   * with a real "Please enter at least one value (bag code, bills, or
   * refund)" validation banner, because the app's own validation model
   * never actually registered the values (same root cause as
   * fillAllProductDeliveryQuantities()'s own setValue()-without-a-click
   * bug elsewhere in this file). Clicking each field before setValue()
   * fixes it - Continue then genuinely submits and returns to the
   * checklist.
   */
  async performMoneyOperations(values: { bagCode?: string; bills?: string; refund?: string } = {}): Promise<void> {
    await this.openMoneyOperations();
    const bagCode = await this.driver.$(this.bagCodeField);
    await bagCode.click();
    await bagCode.setValue(values.bagCode ?? '1234');
    const bills = await this.driver.$(this.billsField);
    await bills.click();
    await bills.setValue(values.bills ?? '120');
    const refund = await this.driver.$(this.refundField);
    await refund.click();
    await refund.setValue(values.refund ?? '0.05');
    await this.driver.hideKeyboard().catch(() => {});
    await this.tap(this.continueButton);
  }

  /** Whether the machine checklist's After Photos tile is currently a single tappable "{Title}\n{Subtitle}" element (see this class's own note on why it starts disabled/split into two elements instead). */
  async isAfterPhotosEnabled(): Promise<boolean> {
    const el = await this.driver.$(this.afterPhotos);
    return (await el.getAttribute('clickable').catch(() => 'false')) === 'true';
  }

  /** Opens the After Photos step's "Add supporting photo" modal - see BaseScreen's openPhotoTrigger/isPhotoModalVisible/openSkipPhotoReasonSheet for the shared skip-photo flow beyond this. Assumes the tile is already enabled (see isAfterPhotosEnabled/completeMachinePrerequisites). */
  async openAfterPhotos(): Promise<void> {
    await this.openPhotoTrigger(this.afterPhotos);
  }

  /**
   * Skips Before Photos (with a reason), Money Operations (Skip money bag
   * checked, Continue), and every visible product's Fills Delivery
   * quantity, in that order - the minimum needed to unlock After Photos.
   * Fills' own product list is virtualized (only currently-scrolled rows
   * exist in the accessibility tree at all) and can run to dozens of
   * items on a "full service" machine - this loops fill-then-scroll until
   * Continue succeeds, rather than assuming a fixed row count. Does NOT
   * touch Removals & Returns - callers must still complete that
   * separately (see completeRemovalsAndReturns).
   */
  async completeBeforePhotosMoneyOpsAndFills(reason = 'Camera cannot focus and take clear picture'): Promise<void> {
    await this.tap(this.beforePhotos);
    await this.openSkipPhotoReasonSheet();
    await this.enterSkipPhotoReason(reason);
    await this.waitForSkipPhotoSubmitEnabled(true);
    await this.confirmSkipPhoto();

    await this.tap(this.moneyOperations);
    await this.waitFor(this.moneyCollectionTitle);
    await this.tap(this.skipMoneyBagCheckbox);
    await this.tap(this.continueButton);

    await this.tap(this.fills);
    await this.waitFor(this.productFillsTitle);
    await this.fillAllProductDeliveryQuantities();
  }

  /**
   * Fills every visible product row's Delivery field with a fixed
   * quantity, scrolling for more rows as needed, until Continue succeeds
   * (confirmed by leaving the "Product fills" screen) - see this class's
   * own note above on why a fixed-row-count approach doesn't work here.
   */
  // Each round fills at most ONE field (re-querying fresh afterward, since
  // the DOM shifts once its keypad opens) - so maxRounds needs to cover
  // the largest catalog seen live (a "full service" snack machine ran to
  // 40+ products), not just a handful.
  async fillAllProductDeliveryQuantities(quantity = '5', maxRounds = 60): Promise<void> {
    for (let round = 0; round < maxRounds; round++) {
      const fields = [...(await this.driver.$$('//android.widget.EditText'))];
      let filledAny = false;
      for (let i = 0; i < fields.length; i += 2) {
        const text = await fields[i].getText().catch(() => '');
        if (!text) {
          // CORRECTED (live-verified): field.setValue() writes the
          // widget's visible text directly without going through the
          // custom keypad's own digit buttons - the row displays the
          // right number, but the app's own internal delivery-quantity
          // model never actually registers it (its validation is wired
          // to the keypad's onClick handlers, not the EditText's
          // text-changed listener), so Continue's later tap fails
          // real submission with "Please fix validation errors before
          // saving" even though every field LOOKS correctly filled.
          // Tapping the real digit keys (same as a physical user) is
          // required for the value to actually count.
          await fields[i].click();
          for (const digit of quantity) {
            await (await this.driver.$(`~${digit}`)).click();
          }
          await this.dismissNumericKeypad();
          filledAny = true;
          break;
        }
      }
      if (filledAny) {
        continue;
      }
      const continueBtn = await this.driver.$(this.continueButton);
      if (await continueBtn.isEnabled().catch(() => false)) {
        await continueBtn.click();
        if (!(await this.isVisible(this.productFillsTitle))) {
          return;
        }
      }
      await this.driver.execute('mobile: scrollGesture', {
        left: 100,
        top: 800,
        width: 800,
        height: 1200,
        direction: 'down',
        percent: 2.0
      });
    }
  }

  /**
   * Removals & Returns has no products to remove on a fresh machine - its
   * own empty state ("Record Removed Items & Truck Returns") has a Done
   * button (not Continue, unlike every other tile here), enabled by
   * default with nothing scanned/logged.
   */
  async completeRemovalsAndReturns(): Promise<void> {
    await this.tap(this.removalsAndReturns);
    await this.tap(this.doneButton);
  }

  // Excel TC016-TC068 (Vending "Removals & Returns") - live-verified
  // 2026-07-29 (build 0.1.76, Route 103/YESTERDAY, "Advocate Health
  // Carolina Neurosurgery & Spine Association" stop, "97713 - Bottle Bev"
  // machine). BaseScreen's own performRemovalsAndReturns/removalsAndReturns/
  // documentProductTitle/removalsSpoiledField/removalsDamagedField/
  // removalsTheftField/removalsTruckReturnsField/removalsSaveButton/
  // removalsDoneButton were already ported from RF but never live-verified
  // or exercised by any spec before this session - confirmed here to work
  // exactly as written.
  //
  // Key live-verified discrepancies from the Excel (documented, not
  // asserted as bugs):
  // - TC018 "Sort Alphabetically, Filter, Search, and Barcode Scanner
  //   icons" - only Sort/Filter are separate header icons; Search/Scan are
  //   the search field's own embedded left/right icons, not standalone
  //   header actions.
  // - TC019/TC020 (search field's "Look up product" label / "Scan or
  //   search name, sku" placeholder) - both real and visible on screen
  //   (confirmed via screenshot) but NEITHER is exposed via content-desc
  //   or any other accessible attribute on the EditText or its
  //   surroundings - not independently assertable, unlike almost every
  //   other field-label pattern elsewhere in this app.
  // - TC022 "Continue disabled initially" - the empty-state's own action
  //   button is labeled Done (not Continue) and is ENABLED by default
  //   with nothing entered - same discrepancy already documented for the
  //   After Photos prerequisite chain above.
  // - TC029/TC030 (search by barcode text/SKU) - not independently
  //   exercised; same shared search-and-filter component as TC024-TC028's
  //   name-based search, already proven to filter correctly.
  // - TC033/TC036/TC066 ("Barcode: value" in the row/header) - live-
  //   verified the row's own content-desc format is "{Name} - pkg: N\nSKU:
  //   {value}" - it says "SKU", never "Barcode:", in this build.
  // - TC034 (scan a barcode) - tapping the field's own scan icon opens a
  //   real native camera-based scanner view (live-verified, screenshotted)
  //   - same category as Take Photo's camera screen: not reliably
  //   automatable (shutter/decode timing) and not exercised here.
  // - TC045-TC050 (numeric keypad validation) - live-verified structurally
  //   rather than by attempting invalid input: the Spoiled/Damaged/Theft/
  //   Truck Return fields are driven by a custom digit-only keypad with no
  //   letter/decimal-point/symbol keys at all (TC046-TC048 blocked by
  //   construction, not a runtime validation check) - its "-"/"+" keys are
  //   INCREMENT/DECREMENT steppers, not literal minus/plus characters, and
  //   are floored at 0 (TC049 confirmed: 5 consecutive "-" taps from a
  //   starting value of 4 left the field at 0, never negative) and capped
  //   at 3 digits (TC050 confirmed: a 4th "0" tap after reaching "999" was
  //   silently ignored).
  // - TC060 "Save enabled when any value entered" - live-verified Save is
  //   ALWAYS enabled, even with every field still at its default (blank/
  //   zero) state - same discrepancy pattern as TC022/TC067.
  // - TC063-TC065 (compact list layout / 6-7 items visible / readable) -
  //   purely visual layout claims, not independently assertable via the
  //   accessibility tree; not asserted.
  private readonly removalsEmptyStateHeading = '~Record Removed Items & Truck Returns';
  private readonly removalsNoResultsText = '~No search results found';
  // The saved-row list has a genuine accessibility gap: live-verified via a
  // raw page-source dump that a saved row's product name/Pkg text is NOT
  // exposed at all (no content-desc, no text attribute anywhere in the
  // tree) - only its aggregate Qty number renders as a bare View's own
  // "text" attribute. This is the one thing reliably readable; rows can't
  // be looked up by product name, only by position/count.
  private readonly removalsSavedRow = '//android.view.View[@text!=""]';
  private readonly removalsCancelButton = '~Cancel';

  async openRemovalsAndReturns(): Promise<void> {
    await this.tap(this.removalsAndReturns);
    await this.waitFor('~Removals & Returns');
  }

  async isRemovalsEmptyStateVisible(): Promise<boolean> {
    return this.isVisible(this.removalsEmptyStateHeading);
  }

  async isRemovalsDoneEnabled(): Promise<boolean> {
    return this.isEnabled(this.doneButton);
  }

  /** Excel TC018 - the header's own Sort/Filter icons; Search/Scan are the search field's own embedded icons, not separate header actions (see this class's own note above). */
  async areRemovalsHeaderIconsVisible(): Promise<{ sort: boolean; filter: boolean }> {
    return { sort: await this.isVisible(this.sortCta), filter: await this.isVisible(this.filterCta) };
  }

  /** Excel TC024/TC028 - searches the shared field; results are asserted via getVisibleSearchResultCount/isNoResultsVisible rather than selecting one. */
  async searchRemovalsProduct(term: string): Promise<void> {
    const field = await this.driver.$(this.searchField);
    await field.click();
    await field.clearValue().catch(() => {});
    await field.setValue(term);
    await this.driver.pause(1500);
  }

  async isNoSearchResultsVisible(): Promise<boolean> {
    return this.isVisible(this.removalsNoResultsText);
  }

  async getVisibleSearchResultCount(): Promise<number> {
    const options = [...(await this.driver.$$(this.searchList))];
    return options.length;
  }

  /**
   * Excel TC032 - clears the search field. Deliberately NOT tapping the
   * field's own right-side icon: live-verified that icon is a real barcode
   * SCANNER trigger (opens the native camera - see this class's own note
   * on TC034), not a clear/X icon like the equivalent dropdown sheets
   * elsewhere in this app - tapping it would launch the camera instead of
   * clearing anything. clearValue() clears the field directly instead.
   */
  async clearRemovalsSearch(): Promise<void> {
    const field = await this.driver.$(this.searchField);
    await field.clearValue();
    await this.driver.pause(1000);
  }

  /** Excel TC038 - cancels out of Document product without saving. */
  async cancelDocumentProduct(): Promise<void> {
    await this.tap(this.removalsCancelButton);
    await this.waitFor('~Removals & Returns');
  }

  /** Excel TC061/TC055 - count of saved rows on the Removals & Returns list. */
  async getRemovalsSavedRowCount(): Promise<number> {
    const rows = [...(await this.driver.$$(this.removalsSavedRow))];
    return rows.length;
  }

  /**
   * Excel TC066 - a saved row's own aggregate Qty value, by position
   * (0-based) - see removalsSavedRow's own note on why lookup by product
   * name isn't possible here.
   */
  async getRemovalsSavedRowQty(position = 0): Promise<string> {
    const rows = [...(await this.driver.$$(this.removalsSavedRow))];
    return (await rows[position].getAttribute('text')) ?? '';
  }

  async isDocumentProductOpen(): Promise<boolean> {
    return this.isVisible(this.documentProductTitle);
  }

  /**
   * Excel TC041-TC044 - fills only the given fields on the already-open
   * Document product screen, leaving the rest at their default (blank/
   * zero). Uses BaseScreen's own fillRemovalsField (click() then
   * setValue()) - see its note there on why a bare setValue() doesn't
   * reliably commit on these custom-keypad-driven fields.
   */
  async fillRemovalsQuantities(values: { spoiled?: string; damaged?: string; theft?: string; truckReturns?: string }): Promise<void> {
    if (values.spoiled !== undefined) {
      await this.fillRemovalsField(this.removalsSpoiledField, values.spoiled);
    }
    if (values.damaged !== undefined) {
      await this.fillRemovalsField(this.removalsDamagedField, values.damaged);
    }
    if (values.theft !== undefined) {
      await this.fillRemovalsField(this.removalsTheftField, values.theft);
    }
    if (values.truckReturns !== undefined) {
      await this.fillRemovalsField(this.removalsTruckReturnsField, values.truckReturns);
    }
  }

  async isRemovalsSaveEnabled(): Promise<boolean> {
    return this.isEnabled(this.removalsSaveButton);
  }

  /** Submits the already-open Document product screen, returning to the Removals & Returns list. */
  async saveDocumentProduct(): Promise<void> {
    await this.tap(this.removalsSaveButton);
    await this.waitFor('~Removals & Returns');
  }

  async tapRemovalsDone(): Promise<void> {
    await this.tap(this.doneButton);
  }

  // Excel TC117/TC165/TC168-TC180 (Vending "delivery - Product delivery") -
  // live-verified 2026-07-29 (build 0.1.76, Route 103/YESTERDAY, "Aaron's"
  // stop, "61241 - Lg Snacks"/"3247550" machines). Each Product fills row
  // renders as ONE content-desc string "{position}\n{Name}\nMore info\nPar
  // \n{parValue}" followed by two EditTexts: hint="Delivery" (blank by
  // default - the quantity being delivered) and hint="End" (Ending
  // Inventory - defaults to the row's own Par value, e.g. 24).
  //
  // Key live-verified discrepancies from the Excel (documented, not
  // asserted as bugs):
  // - TC165 "Filter, Sort, Add icons" - this header has Filter, Sort, and
  //   Planogram icons; there is NO Add icon on Vending's Product fills
  //   screen (confirmed absent via a direct existence check), unlike
  //   Market's equivalent screen which does have one.
  // - TC168 "Pkg: 1" / TC169 "Par 15/Ordered 15/Picked 15" - the row's own
  //   content-desc has no "Pkg:" segment at all, and only ONE quantity
  //   value (Par) - there is no separate Ordered/Picked figure anywhere in
  //   the row; the leading number is the row's on-screen position, not a
  //   package count.
  // - TC171/TC172 "default value clears automatically / overwrites, not
  //   appends" - true, but of the End field (which has a real default of
  //   Par), not the Delivery field (which starts genuinely blank) - tapping
  //   an End field auto-selects its existing text, so the very FIRST digit
  //   typed replaces it; every subsequent digit APPENDS (confirmed: typing
  //   "5" then "5" again on a freshly-focused field produced "155", not
  //   "5" replacing "15").
  // - TC174/TC176 (alphabetic/negative Ending Inventory blocked) - this
  //   field is driven by the SAME custom digit-only keypad family as
  //   Removals & Returns (screenshotted: 0-9, a "-"/"+" pair, backspace,
  //   confirm - no letter/decimal keys at all). Live-verified the "-"/"+"
  //   keys are INCREMENT/DECREMENT steppers (one tap = ±1), floored at 0
  //   (30 consecutive "-" taps from 24 left the field at 0, never
  //   negative) and capped at 3 digits (mashing "9" against an existing
  //   3-digit value left it unchanged) - the same floor/cap behavior
  //   already documented for Removals & Returns' fields.
  // - TC177 "Continue disabled due to empty Ending Inventory" - live-
  //   verified FALSE: Continue stayed enabled even after clearing an End
  //   field to a genuinely empty string - same "always enabled" pattern
  //   already documented for Done/Save elsewhere in this app.
  // - TC178 "Continue enabled...with green color" - live-verified Continue
  //   is enabled by DEFAULT on a completely untouched, freshly-opened
  //   machine (every row's End field already defaults to a valid Par
  //   value) - "enter valid data in all visible rows" isn't actually
  //   required to reach this state. IMPORTANT: this enabled/disabled state
  //   is purely cosmetic - live-verified tapping Continue while ANY row's
  //   own Delivery field is still blank is a silent no-op (no toast, no
  //   error, the screen just never navigates away), regardless of the End
  //   field's value. Every row's Delivery must be filled - see
  //   fillAllProductDeliveryQuantities - for Continue to actually submit
  //   and leave this screen.
  // - TC173/TC175 (enter Ending Inventory / numeric keypad shown) - both
  //   confirmed true as-is.
  // - TC144/TC145 (Vending "Planogram" sub-area's own "PAR value read-only
  //   / positioned between product name and delivery field") - despite
  //   the sub-area name, these describe this same Product fills row, not
  //   the separate Planogram grid screen - see isParFieldEditable's own
  //   note for the full discovery.
  // - TC146 "verify legacy UI layout - PAR value displayed as per the
  //   legacy application" - a pure visual-parity claim with no
  //   accessible signal to check against; not independently assertable,
  //   same category as TC063-TC065 elsewhere in this file.
  // - TC147 "view delivery field - empty numeric input with label
  //   Delivery" - confirmed true (see getDeliveryFieldValue/
  //   getDeliveryFieldHint), same field already covered by TC170's own
  //   label check above - not a separate field.
  // - TC216 "Clear sort order enabled (grey) AND Apply sort order enabled
  //   (green)" - live-verified there is NO separate "Apply sort order"
  //   button anywhere on this sheet - only "Clear sort order" exists
  //   (same as Market's own Sort sheet - see BaseScreen's own note above
  //   openSortSheet/clearSortButton). Selecting an option (A to Z/Z to
  //   A/By Category/Newest First/Oldest First) applies it immediately and
  //   closes the sheet - there's nothing left to separately "Apply".
  //   "Clear sort order" itself IS disabled with nothing selected and
  //   becomes enabled once a sort is active, matching the Excel's own
  //   "enabled after selection" framing for that one real button.
  // - TC217 "clear sort after selection (no apply)" - since selecting an
  //   option already applies it (see TC216's own note - there's no
  //   unapplied intermediate state), this is really "reopen the sheet
  //   after a sort is active and tap Clear sort order" - live-verified
  //   true: the header icon's own `checked` state returns to false and
  //   the product list reverts to its original (unsorted/Par-position)
  //   order.
  private readonly planogramTitle = '~Planogram';
  private readonly fillProductRow = '//android.view.View[contains(@content-desc,"More info")]';

  private fillProductRowAt(position: Position): string {
    return `(${this.fillProductRow})[${positionToIndex(position) + 1}]`;
  }

  private fillDeliveryFieldAt(position: Position): string {
    return `(//android.widget.EditText)[${positionToIndex(position) * 2 + 1}]`;
  }

  private fillEndFieldAt(position: Position): string {
    return `(//android.widget.EditText)[${positionToIndex(position) * 2 + 2}]`;
  }

  /** Excel TC165 - this header's own Sort/Filter/Planogram icons; there is no Add icon here (see this class's own note above). */
  async isFillsHeaderActionsVisible(): Promise<{ sort: boolean; filter: boolean; planogram: boolean; add: boolean }> {
    return {
      sort: await this.isVisible(this.sortCta),
      filter: await this.isVisible(this.filterCta),
      planogram: await this.isVisible(this.planogramCta),
      add: await (await this.driver.$(this.addProductButton)).isExisting()
    };
  }

  /** Excel TC168/TC169 - a row's own name and Par value, parsed from its content-desc (see this class's own note on why there's no separate Pkg/Ordered/Picked figure here). */
  async getFillRowSummary(position: Position = 'first'): Promise<{ name: string; par: number }> {
    const row = await this.driver.$(this.fillProductRowAt(position));
    const desc = (await row.getAttribute('content-desc')) ?? '';
    const parts = desc.split('\n');
    return { name: parts[1] ?? '', par: Number(parts[4]) };
  }

  /** Excel TC216/TC217 (Vending "delivery - Sort") - every visible row's own name, in on-screen order, for asserting sort-order changes and Clear sort order's reset back to the default (Par-position) order. */
  async getFillProductNamesInOrder(): Promise<string[]> {
    const rows = await this.driver.$$(this.fillProductRow);
    const names: string[] = [];
    for (const row of rows) {
      const desc = (await row.getAttribute('content-desc')) ?? '';
      names.push(desc.split('\n')[1] ?? '');
    }
    return names;
  }

  /** Excel TC170 - the Delivery field's own accessible label, live-verified as the hint attribute rather than a separate text element. */
  async getDeliveryFieldHint(position: Position = 'first'): Promise<string> {
    const field = await this.driver.$(this.fillDeliveryFieldAt(position));
    return (await field.getAttribute('hint')) ?? '';
  }

  /** Excel TC147 - the Delivery field's own current value, blank by default on a fresh row (see getEndFieldValue for the same on End, which is NOT blank by default). */
  async getDeliveryFieldValue(position: Position = 'first'): Promise<string> {
    const field = await this.driver.$(this.fillDeliveryFieldAt(position));
    return field.getText();
  }

  /**
   * Excel TC144/TC145 (Vending "Planogram" sub-area, despite describing
   * the Product fills row itself rather than the Planogram grid screen) -
   * Par has no editable counterpart anywhere in this row: live-verified
   * via a raw page-source dump that a row's only two EditTexts are
   * hint="Delivery" and hint="End" - Par's value is baked directly into
   * the row's own content-desc text ("{pos}\n{Name}\nMore info\nPar
   * \n{value}"), with no separate widget of its own, hence "read-only" by
   * construction rather than by a disabled/read-only attribute on some
   * dedicated element. Its "position" (TC145) is also structural rather
   * than a separate check: that same content-desc places the Par value
   * after the product Name and before either EditText in both DOM and
   * on-screen (left-of-Delivery) order - see getFillRowSummary, which
   * already parses it from that exact position.
   */
  async isParFieldEditable(position: Position = 'first'): Promise<boolean> {
    const deliveryHint = await this.getDeliveryFieldHint(position);
    const endField = await this.driver.$(this.fillEndFieldAt(position));
    const endHint = (await endField.getAttribute('hint')) ?? '';
    return deliveryHint === 'Par' || endHint === 'Par';
  }

  async getEndFieldValue(position: Position = 'first'): Promise<string> {
    const field = await this.driver.$(this.fillEndFieldAt(position));
    return field.getText();
  }

  /**
   * The custom numeric keypad's own confirm key (bottom-right checkmark) -
   * live-verified it carries no content-desc/text of its own (unlike every
   * digit/+/- key), so it's targeted positionally as the last Button on
   * screen once the keypad is open. Tapping Continue while this keypad is
   * still open does NOT commit the field or navigate away (live-verified:
   * the tap is silently swallowed) - every keypad-driven field write here
   * dismisses it afterward via this method rather than leaving that to the
   * caller.
   */
  private async dismissNumericKeypad(): Promise<void> {
    const confirmKey = await this.driver.$('(//android.widget.Button)[last()]');
    if (await confirmKey.isExisting().catch(() => false)) {
      await confirmKey.click();
    }
  }

  /** Excel TC171/TC172 - clicking an End field selects its existing default value, so the first setValue() call replaces it; a second call on the same field appends instead (see this class's own note above). */
  async setEndFieldValue(position: Position, value: string): Promise<void> {
    const field = await this.driver.$(this.fillEndFieldAt(position));
    await field.click();
    await field.setValue(value);
    await this.dismissNumericKeypad();
  }

  async clearEndFieldValue(position: Position): Promise<void> {
    const field = await this.driver.$(this.fillEndFieldAt(position));
    await field.click();
    await field.clearValue();
    await this.dismissNumericKeypad();
  }

  /** Excel TC176 - the keypad's own decrement stepper (see this class's own note on why it's a stepper, not a literal minus sign). Re-opens the keypad first, since a prior setEndFieldValue/clearEndFieldValue call already dismissed it. */
  async tapEndFieldDecrement(position: Position, times = 1): Promise<void> {
    const field = await this.driver.$(this.fillEndFieldAt(position));
    await field.click();
    const key = await this.driver.$('~-');
    for (let i = 0; i < times; i++) {
      await key.click();
    }
    await this.dismissNumericKeypad();
  }

  async isFillsContinueEnabled(): Promise<boolean> {
    return this.isEnabled(this.continueButton);
  }

  /** Excel TC255 - same shared Continue button as Fills' own isFillsContinueEnabled, aliased here for clarity when asserting from the Money Collection screen. */
  async isMoneyCollectionContinueEnabled(): Promise<boolean> {
    return this.isEnabled(this.continueButton);
  }

  /** Excel TC117 - opens Planogram from the Product fills header's own planogram icon. */
  async openPlanogram(): Promise<void> {
    await this.tap(this.planogramCta);
    await this.waitFor(this.planogramTitle);
  }

  async isPlanogramTitleVisible(): Promise<boolean> {
    return this.isVisible(this.planogramTitle);
  }
}
