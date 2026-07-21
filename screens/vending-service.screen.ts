import { BaseScreen } from './base.screen';
import type { Position } from '../utils/position';

/**
 * Vending LOB - servicing a delivery location. Ported from vending_keywords.robot.
 */
export class VendingServiceScreen extends BaseScreen {
  private readonly vendingLob = '//android.widget.ImageView[contains(@content-desc,"vending")]';
  private readonly fills = '//android.view.View[starts-with(@content-desc,"Fills")]';
  private readonly productFillsAddedProductsList = '//android.widget.ScrollView';
  private readonly skipMoneyBagCheckbox = '//android.widget.CheckBox';
  private readonly moneyOperations = '//android.view.View[starts-with(@content-desc, "Money Operations")]';

  async clickServiceLocation(position: Position): Promise<void> {
    await this.selectServiceLocation(this.vendingLob, position);
  }

  /**
   * Ported from "Perform Vending fills by searching for X and clicking on
   * the Nth record in the search result screen" - but RF's own keyword body
   * never actually used its search-term/position arguments; it just opens
   * Fills, waits for the added-products list, and continues. Named here to
   * match what it actually does rather than what the RF keyword's name
   * implied - if a real search-driven fills flow is needed, it doesn't
   * exist yet in the source.
   */
  async openFillsAndContinue(): Promise<void> {
    await this.tap(this.fills);
    await this.waitFor(this.productFillsAddedProductsList);
    await this.tap(this.continueButton);
  }

  async performMoneyOperations(): Promise<void> {
    await this.tap(this.moneyOperations);
    await this.tap(this.skipMoneyBagCheckbox);
    // RF referenced ${money_operations_continue_button} here, a variable
    // that doesn't appear to be declared in any yaml file in the suite -
    // likely a genuine bug, never caught because this keyword is only ever
    // called from a commented-out test case. Using the shared Continue
    // button as the most plausible stand-in; confirm against the real app.
    await this.tap(this.continueButton);
  }
}
