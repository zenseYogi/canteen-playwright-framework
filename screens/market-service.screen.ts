import { BaseScreen } from './base.screen';
import type { Position } from '../utils/position';

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

  async clickServiceLocation(position: Position): Promise<void> {
    await this.selectServiceLocation(this.marketLob, position);
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
