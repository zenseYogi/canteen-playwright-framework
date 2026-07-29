import { BaseScreen } from './base.screen';
import type { Position } from '../utils/position';

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
  // field). None expose a hint/content-desc of their own; positional
  // indexing is the only option, matching the existing Market pattern.
  private readonly bagCodeField = '//android.widget.EditText[1]';
  private readonly billsField = '//android.widget.EditText[2]';
  private readonly refundField = '//android.widget.EditText[3]';

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

  async performMoneyOperations(values: { bagCode?: string; bills?: string; refund?: string } = {}): Promise<void> {
    await this.openMoneyOperations();
    await this.type(this.bagCodeField, values.bagCode ?? '1234');
    await this.type(this.billsField, values.bills ?? '120');
    await this.pressKeyCode(66);
    await this.type(this.refundField, values.refund ?? '0.05');
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
          await fields[i].click();
          await fields[i].clearValue().catch(() => {});
          await fields[i].setValue(quantity);
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
}
