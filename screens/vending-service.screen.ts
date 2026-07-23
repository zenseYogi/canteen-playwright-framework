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
}
