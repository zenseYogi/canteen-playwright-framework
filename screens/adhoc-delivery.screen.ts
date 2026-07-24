import { BaseScreen } from './base.screen';

/**
 * Ad-hoc Delivery creation screen (PBI 850155) - reached via the "+" icon on
 * the Home screen's Schedule pane header (see HomeScreen.
 * openAdhocDeliveryCreation()). Live-verified 2026-07-24:
 * reachable regardless of whether the current day has zero or existing
 * deliveries (tested against a day with 4 real deliveries) - TC027 does NOT
 * require a genuinely empty day to verify, unlike TC025/TC028 (see
 * HomeScreen's noDeliveriesMessage caveat).
 *
 * The title and the submit button share the exact same content-desc text
 * ("Add Delivery") - distinguished only by element type (a plain View for
 * the title, an android.widget.Button for the submit action), confirmed via
 * a live page-source dump.
 */
export class AdhocDeliveryScreen extends BaseScreen {
  private readonly titleText = '//android.view.View[@content-desc="Add Delivery"]';
  private readonly customerField = '//android.view.View[@hint="Customer"]';
  private readonly addDeliveryButton = '//android.widget.Button[@content-desc="Add Delivery"]';
  private readonly addAnotherDeliveryButton = '~+ Add Another Delivery';

  async isTitleVisible(): Promise<boolean> {
    return this.isVisible(this.titleText);
  }

  async isCustomerFieldVisible(): Promise<boolean> {
    return this.isVisible(this.customerField);
  }

  async isAddDeliveryButtonVisible(): Promise<boolean> {
    return this.isVisible(this.addDeliveryButton);
  }

  async isAddAnotherDeliveryButtonVisible(): Promise<boolean> {
    return this.isVisible(this.addAnotherDeliveryButton);
  }
}
