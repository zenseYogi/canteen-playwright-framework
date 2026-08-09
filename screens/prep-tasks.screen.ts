import { BaseScreen } from './base.screen';

/**
 * Prep Tasks screen. Ported from prep_task_keywords.robot.
 */
export class PrepTasksScreen extends BaseScreen {
  // Same content-desc ("Prep tasks") on both the nav button and the screen
  // title - kept as distinct widget-typed xpaths, same reasoning as the
  // other nav-item-vs-title pairs across this port.
  private readonly navMenuPrepTask = '//android.widget.Button[@content-desc="Prep tasks"]';
  private readonly prepTasksTitle = '//android.view.View[@content-desc="Prep tasks"]';
  // Ported from prep_tasks.yaml's title_start_day - what RF's "...opened from
  // dashboard" keyword waits on after HomeScreen.tapStartDay() is called.
  private readonly titleStartDay = '//android.view.View[starts-with(@content-desc, "Start day")]';

  private readonly productCollection = '//android.widget.ImageView[starts-with(@content-desc, "Product collection")]';
  private readonly productCollectionTitle = '~Product Collection';
  // NOTE: NOT the same locator as MarketServiceScreen/VendingServiceScreen's
  // "Money Operations" trigger (a View, capital "Operations") - this is an
  // ImageView nav tile with lowercase "operations". Similar name, similar
  // purpose, different screen - kept separate, not hoisted/shared.
  private readonly moneyOperations = '//android.widget.ImageView[starts-with(@content-desc, "Money operations")]';
  private readonly additionalPrep = '//android.widget.ImageView[starts-with(@content-desc, "Additional prep")]';
  private readonly checks = '//android.widget.ImageView[starts-with(@content-desc, "Checks")]';

  private readonly completeButton = '~Complete';
  private readonly safetyCheckCompletedCheckbox = '//android.widget.ImageView[starts-with(@content-desc, "Safety check completed")]';
  // common.yaml's "Select All Checkboxes" keyword's target - only ever
  // actually invoked from this screen in the source reviewed, so kept local
  // rather than hoisted to BaseScreen (same reasoning as equipment_audit/fills).
  private readonly multipleCheckboxes = '//android.view.View/android.widget.ImageView[@clickable="true"]';
  // CORRECTED (live-verified 2026-07-27): the quantity field's hint is NOT
  // the product's display name - it's a separately abbreviated/truncated
  // string (e.g. "Cof-MteSnickersCrm50ct..." for "Coffee Mate Snickers
  // Creamer (.38oz, Box of 50)"), so contains(@hint, productName) never
  // matches for products whose hint gets truncated. Only one quantity field
  // exists on this screen at a time regardless of product, so matching on
  // the shared "Qty" suffix every hint ends with is both simpler and
  // actually correct.
  private readonly quantityFieldByHint = '//android.widget.EditText[contains(@hint,"Qty")]';
  private readonly addProductTitle = '~Add product';
  private readonly addButton = '~Add';

  // TC169's "date and route in the header" - see BaseScreen's
  // headerDateBadge/headerRouteBadge/isDateRouteHeaderVisible() for the
  // shared component itself (hoisted there once MarketServiceScreen also
  // needed it, for TC092).
  private readonly moneyOperationsTitle = '~Money operations';
  // TC171's checklist items - live-verified 2026-07-27 exact content-desc matches.
  private readonly replacementMoneyBagsItem = '~Replacement money bag(s)';
  private readonly changerBagItem = '~Changer bag';

  /**
   * Public access to the four sub-screen trigger locators, for passing into
   * skipSubScreen()/completeSubScreen()/openBackPressPopup() from spec code -
   * those are generic (all four sub-screens share the same skip/complete
   * shape), so this exposes one small surface rather than four near-
   * duplicate skipX()/completeX() wrapper methods per sub-screen.
   */
  get subScreenTriggers() {
    return {
      productCollection: this.productCollection,
      moneyOperations: this.moneyOperations,
      additionalPrep: this.additionalPrep,
      checks: this.checks
    };
  }

  /** Ported from Excel TC071 "I am able to view all prep categories" - confirmed live: all four tiles render as starts-with-matched ImageViews. */
  async arePrepCategoriesVisible(): Promise<{
    productCollection: boolean;
    moneyOperations: boolean;
    additionalPrep: boolean;
    checks: boolean;
  }> {
    return {
      productCollection: await this.isVisible(this.productCollection),
      moneyOperations: await this.isVisible(this.moneyOperations),
      additionalPrep: await this.isVisible(this.additionalPrep),
      checks: await this.isVisible(this.checks)
    };
  }

  async isProductCollectionTitleVisible(): Promise<boolean> {
    return this.isVisible(this.productCollectionTitle);
  }

  /** For the Excel's Continue-enablement TCs (e.g. "maintain enablement with at least one selected") - NOT yet confirmed live whether Continue is actually disabled with zero items selected; see docs/rf-to-playwright-reuse.md. */
  async isContinueEnabled(): Promise<boolean> {
    return this.isEnabled(this.continueButton);
  }

  /** Confirms the back-press Skip/Complete popup (Excel TC180) is showing - both options visible at once. */
  async isBackPressPopupVisible(): Promise<boolean> {
    const [skip, complete] = await Promise.all([this.isVisible(this.skipButton), this.isVisible(this.completeButton)]);
    return skip && complete;
  }

  /**
   * CORRECTED (2026-07-27): used to also wait for the Product Collection
   * tile here, but that tile never renders once Start Day is already
   * server-tracked complete (only a bare "Start day" button + title show) -
   * live-verified this hangs the full 15s timeout in that state. prepTasksTitle
   * alone is the real "we've arrived" signal; completeFullDayPrep() already
   * does its own wait for productCollection right before using it, and
   * ensureFullDayPrepComplete() checks its visibility without waiting - so
   * nothing downstream loses coverage by dropping the wait here.
   */
  async openFromHamburgerMenu(): Promise<void> {
    await this.tap(this.hamburgerIcon);
    await this.waitFor(this.navMenuPrepTask);
    await this.tap(this.navMenuPrepTask);
    await this.waitFor(this.prepTasksTitle);
  }

  /** Confirms Prep Tasks loaded via the Dashboard's Start day button - see HomeScreen.tapStartDay(), which RF's "...from dashboard" keyword calls before this wait. */
  async waitForOpenedFromDashboard(): Promise<void> {
    await this.waitFor(this.titleStartDay);
  }

  private async openSubScreen(trigger: string): Promise<void> {
    await this.tap(this.hamburgerIcon);
    await this.waitFor(this.navMenuPrepTask);
    await this.tap(this.navMenuPrepTask);
    await this.waitFor(trigger);
    await this.tap(trigger);
  }

  /** Opens a sub-screen and triggers the back-press Skip/Complete popup (Excel TC180/182), without committing to either choice yet. */
  async openBackPressPopup(trigger: string): Promise<void> {
    await this.openSubScreen(trigger);
    await this.tap(this.backButton);
  }

  /** Taps Skip/Complete on an already-open back-press popup (see openBackPressPopup) - separate from skipSubScreen/completeSubScreen so callers that already opened the popup (e.g. to assert isBackPressPopupVisible() first) don't have to re-navigate. */
  async confirmSkip(): Promise<void> {
    await this.tap(this.skipButton);
  }

  async confirmComplete(): Promise<void> {
    await this.tap(this.completeButton);
  }

  /** Skip is identically shaped across all four prep-task sub-screens. */
  async skipSubScreen(trigger: string): Promise<void> {
    await this.openBackPressPopup(trigger);
    await this.confirmSkip();
  }

  /**
   * Complete is identically shaped for Money Operations / Additional Prep /
   * Checks - NOT Product Collection, which has an extra photo-capture step
   * afterward (see completeProductCollection).
   */
  async completeSubScreen(trigger: string): Promise<void> {
    await this.openBackPressPopup(trigger);
    await this.confirmComplete();
  }

  /**
   * BA-confirmed (and live-reproduced - see docs/evidence/product-collection-
   * no-photo-step-*.png) real app behavior: when the product list is empty,
   * completing Product Collection returns straight to the Prep Tasks list
   * with the tile already marked complete - the camera never opens at all.
   * When the list is non-empty, the camera auto-opens after Complete/Continue
   * and this walks shutter -> Attach Photo, same as before. So this is
   * genuinely conditional on list content, not a timing issue.
   *
   * CORRECTED: this can't be detected by probing capturePhotoButton's own
   * visibility - that locator is a deeply-nested, attribute-less structural
   * xpath (no content-desc/resource-id of its own, see its declaration in
   * BaseScreen), and live-verified to false-positive-match some unrelated
   * node already present on the Prep Tasks list itself, making "is it
   * displayed" true even when the camera never opened - which then hangs the
   * subsequent Attach Photo tap for its full 30s timeout. titleStartDay
   * (a specific, unambiguous "Start day, ..." content-desc) is the real
   * signal for "we're already back on the list, no photo step occurred".
   */
  private async capturePhotoIfPresent(): Promise<void> {
    const backOnList = await this.driver
      .waitUntil(async () => this.isVisible(this.titleStartDay), { timeout: 8_000, interval: 500 })
      .catch(() => false);
    if (backOnList) {
      return;
    }
    await this.waitFor(this.capturePhotoButton);
    await this.tap(this.capturePhotoButton);
    // Live-verified flaky: the emulator's virtual camera capture + review
    // screen render can take noticeably longer than the default 15s element
    // timeout to produce the "Attach Photo" button, even though the capture
    // itself already succeeded - a longer, dedicated wait here avoids a
    // false-negative failure on an otherwise-working step.
    await this.tap(this.attachPhotoButton, 30_000);
  }

  /**
   * Ported from "Perform Complete on the product collection screen" - after
   * Complete, the camera auto-opens only when the product list is non-empty
   * (see capturePhotoIfPresent), so this doesn't reuse BaseScreen.capturePhoto()
   * - that helper's shape (tap trigger -> optional permission -> Take photo ->
   * capture -> attach) doesn't match what this keyword actually does, and
   * assumes the step is mandatory, which it is not.
   */
  async completeProductCollection(): Promise<void> {
    await this.completeSubScreen(this.productCollection);
    await this.capturePhotoIfPresent();
  }

  /** Opens Product Collection without completing/skipping it - lets callers assert on the way in (e.g. TC075's Add product icon) before committing to anything. */
  async openProductCollection(): Promise<void> {
    await this.openSubScreen(this.productCollection);
    await this.waitFor(this.productCollectionTitle);
  }

  /** Excel TC075 "view Add product (+) icon" - assumes Product Collection is already open (openProductCollection()). */
  async isAddProductButtonVisible(): Promise<boolean> {
    return this.isVisible(this.addProductButton);
  }

  /** Opens Money Operations without completing/skipping it - lets callers assert the header (TC169) before committing to anything. */
  async openMoneyOperationsOnly(): Promise<void> {
    await this.openSubScreen(this.moneyOperations);
    await this.waitFor(this.moneyOperationsTitle);
  }

  /** Excel TC169 "view date and route in the header" - assumes Money Operations is already open (openMoneyOperationsOnly()). */
  async isMoneyOperationsHeaderVisible(): Promise<{ title: boolean; date: boolean; route: boolean }> {
    const header = await this.isDateRouteHeaderVisible();
    return {
      title: await this.isVisible(this.moneyOperationsTitle),
      ...header
    };
  }

  /** Excel TC171 "view available checklist items" - assumes Money Operations is already open. */
  async isMoneyOperationsChecklistVisible(): Promise<{ replacementMoneyBags: boolean; changerBag: boolean }> {
    return {
      replacementMoneyBags: await this.isVisible(this.replacementMoneyBagsItem),
      changerBag: await this.isVisible(this.changerBagItem)
    };
  }

  async isMoneyOperationsTitleVisible(): Promise<boolean> {
    return this.isVisible(this.moneyOperationsTitle);
  }

  /** Excel TC179/TC182 "click back arrow in the Money operations screen" - assumes Money Operations is already open (no re-navigation, unlike openBackPressPopup()). */
  async tapBackArrow(): Promise<void> {
    await this.tap(this.backButton);
  }

  /** Excel TC183's "navigate to the Prep task screen" - the list view's own heading (e.g. "Start day, Route 10"), same signal waitForOpenedFromDashboard() waits on. */
  async isPrepTasksListVisible(): Promise<boolean> {
    return this.isVisible(this.titleStartDay);
  }

  /** Excel TC080/TC089 "open Add product screen" - taps the "+" and waits for the shared "Add product" title (same string as MarketServiceScreen's - not hoisted, see that screen's own note on why LOB screens stay separate). */
  async openAddProductForm(): Promise<void> {
    await this.tap(this.addProductButton);
    await this.waitFor(this.addProductTitle);
  }

  async isAddProductScreenVisible(): Promise<boolean> {
    return this.isVisible(this.addProductTitle);
  }

  /**
   * Searches, selects the first match, enters qty, and submits - assumes
   * openAddProductForm() already ran. Split out of addProductToCollection()
   * so TC075/TC080's checkpoints can run in between.
   *
   * CORRECTED: waits for productCollectionTitle to reappear after tapping
   * Add - live-verified tapping Add doesn't return to the list instantly,
   * and a caller checking the list's content (e.g. TC110's summary line)
   * immediately after this returns can catch the screen mid-transition and
   * see stale/empty content.
   */
  async fillAndSubmitAddProduct(searchTerm: string, qty: string): Promise<void> {
    await this.searchAndSelect(searchTerm);
    await this.type(this.quantityFieldByHint, qty);
    await this.tap(this.addButton);
    await this.waitFor(this.productCollectionTitle);
  }

  /**
   * TC110 "add the product and update count" - live-verified the returned
   * Product Collection list shows a per-category summary row (e.g. "OCS
   * Creamer/Sugar\n5"), not the individual product name, so this returns
   * every multi-line row's raw content-desc for the caller to search
   * (matches HomeScreen.getEditScheduleStopNames's approach to the same
   * kind of "\n"-joined summary text).
   */
  async getProductCollectionSummaryLines(): Promise<string[]> {
    const els = await this.driver.$$('//android.view.View');
    const lines: string[] = [];
    for (const el of els) {
      const desc = (await el.getAttribute('content-desc')) ?? '';
      if (desc.includes('\n')) {
        lines.push(desc);
      }
    }
    return lines;
  }

  async addProductToCollection(searchTerm = 'can', qty = '1'): Promise<void> {
    await this.openProductCollection();
    await this.openAddProductForm();
    await this.fillAndSubmitAddProduct(searchTerm, qty);
  }

  /**
   * Ported from "Validate user is able to complete the prep task
   * successfully" - a single linear walk through all four sub-screens with
   * real data-entry actions (not skip, not the standalone Complete flow
   * above). Assumes Prep Tasks is already open (call openFromHamburgerMenu()
   * or waitForOpenedFromDashboard() first).
   *
   * One sub-step from the RF source is deliberately NOT reproduced -
   * Checks: clicking a "Vehicle check completed" checkbox + a "Dismiss"
   * popup button were commented out there - only the Safety check
   * checkbox is actually clicked here. (Product Collection's own
   * checkboxes were ALSO commented out in the RF source, but per explicit
   * user request 2026-08-09 this port now selects them too - see
   * completeFullDayPrep()'s own selectAllChecklistIcons() call for that
   * step. Live-verified the same nested `View > ImageView[clickable=true]`
   * structure multipleCheckboxes already targets for Money Operations/
   * Additional Prep applies here unchanged.)
   */
  /**
   * Same as completeFullDayPrep(), but tolerates Start Day already being
   * complete - confirmed live 2026-07-24 that completion is server-tracked,
   * not tied to the local app session, so a previous test (in a shared
   * session, e.g. vending-service.spec.ts) or a previous run entirely can
   * leave it already done. When that's the case, Prep Tasks shows no
   * category tiles at all - just a bare "Start day" button - so this checks
   * for productCollection's tile first and taps Start day directly instead
   * of repeating a flow that has nothing left to do. Assumes Prep Tasks is
   * already open, same as completeFullDayPrep().
   */
  async ensureFullDayPrepComplete(): Promise<void> {
    const alreadyDone = !(await this.isVisible(this.productCollection));
    if (alreadyDone) {
      await this.tap(this.startDayButton);
      return;
    }
    await this.completeFullDayPrep();
  }

  /**
   * Taps THIS screen's own "Start day" button (bottom CTA, titled "Start
   * day, Route X" - distinct from Dashboard's OWN "Start day" CTA one level
   * up). Live-verified 2026-08-07: a day that has NEVER had Start Day
   * initiated renders this exact bare-button/no-tiles state - identical in
   * shape to the ALREADY-COMPLETE state ensureFullDayPrepComplete() handles
   * above, but with the opposite real effect - tapping it here actually
   * BEGINS the day, revealing the four category tiles for real
   * interaction, rather than exiting because there's nothing left to do.
   * Only call this for a day confirmed genuinely fresh (e.g. right after
   * bootstrapping its first delivery) - calling it on an actually-complete
   * day would incorrectly expect tiles that will never appear.
   */
  async tapStartDayButton(): Promise<void> {
    await this.tap(this.startDayButton);
  }

  /**
   * Whether Start Day is already server-tracked complete for the CURRENT
   * route/day - same "no category tiles, just a bare Start day button"
   * signal ensureFullDayPrepComplete() checks internally, exposed publicly
   * for callers that need a genuinely FRESH (not-yet-started) day rather
   * than one that tolerates completion (e.g. TC198's back-press-popup test
   * and TC075/080/110's Add Product test both need live category tiles to
   * interact with, not just "Start day" to tap). Assumes Prep Tasks is
   * already open (call after openFromHamburgerMenu()).
   */
  async isStartDayAlreadyComplete(): Promise<boolean> {
    return !(await this.isVisible(this.productCollection));
  }

  /**
   * Prefer ensureFullDayPrepComplete() over calling this directly unless the
   * day is known to be genuinely fresh. Money Operations/Additional Prep's
   * checkbox tiles (multipleCheckboxes) and Checks' safety checkbox expose
   * NO checked/selected accessibility signal at all (live-confirmed
   * 2026-08-09 via both Appium's getPageSource AND a raw `adb uiautomator
   * dump`: both attributes report "false" regardless of the rendered
   * checkmark - the state exists only in the bitmap). BaseScreen.
   * selectAllChecklistIcons()/setChecklistIconState() work around this via
   * pixel-color sampling instead, so a repeat call against a
   * partially-completed day is safe - but that's still a fallback for
   * elements with no other signal, not a substitute for genuinely knowing
   * the day's state.
   */
  async completeFullDayPrep(): Promise<void> {
    await this.waitFor(this.productCollection);
    await this.tap(this.productCollection);
    await this.waitFor(this.productCollectionTitle);
    await this.selectAllChecklistIcons(this.multipleCheckboxes);
    await this.tap(this.continueButton);
    await this.capturePhotoIfPresent();

    await this.waitFor(this.moneyOperations);
    await this.tap(this.moneyOperations);
    await this.selectAllChecklistIcons(this.multipleCheckboxes);
    await this.tap(this.continueButton);

    await this.tap(this.additionalPrep);
    await this.selectAllChecklistIcons(this.multipleCheckboxes);
    await this.tap(this.continueButton);

    await this.waitFor(this.checks);
    await this.tap(this.checks);
    await this.setChecklistIconState(this.safetyCheckCompletedCheckbox, true);
    await this.tap(this.continueButton);

    await this.tap(this.startDayButton);
  }
}
