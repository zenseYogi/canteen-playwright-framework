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

  async clickServiceLocation(position: Position): Promise<void> {
    await this.selectServiceLocation(this.marketLob, position);
  }

  async performMoneyOperations(
    values: { bagCode?: string; coins?: string; bills?: string; refund?: string } = {}
  ): Promise<void> {
    await this.tap(this.moneyOperations);
    await this.waitFor(this.skipMoneyBagCheckbox);
    await this.type(this.bagCodeField, values.bagCode ?? '1234');
    await this.type(this.coinsField, values.coins ?? '12');
    await this.type(this.billsField, values.bills ?? '120');
    await this.pressKeyCode(66);
    await this.type(this.refundField, values.refund ?? '0.05');
    await this.tap(this.continueButton);
  }

  async performDelivery(): Promise<void> {
    await this.tap(this.deliveryTrigger);
    await this.waitFor(this.fillsTitle);
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
