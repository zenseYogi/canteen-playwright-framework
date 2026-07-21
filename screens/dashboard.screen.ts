import { BaseScreen } from './base.screen';
import { positionToIndex, type Position } from '../utils/position';

export type Lob = 'coffee' | 'market' | 'vending';

/**
 * Dashboard / location-selection screen. Ported from dashboard_keywords.robot.
 */
export class DashboardScreen extends BaseScreen {
  // FRAGILE: deeply nested structural path with no stable identifier, ported
  // as-is from dashboard.yaml. Re-verify against the current build - see
  // docs/rf-to-playwright-reuse.md.
  private readonly deliveryLocationList =
    '//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.View/android.view.View/android.view.View/android.view.View[2]/android.view.View[10]/android.view.View';

  // Case preserved exactly as in dashboard.yaml ("Market" capitalized,
  // "coffee"/"vending" lowercase) - presumably matches the app's own
  // accessibility labels, not a typo to "fix".
  private readonly marketLob = '//android.widget.ImageView[contains(@content-desc,"Market")]';
  private readonly coffeeLob = '//android.widget.ImageView[contains(@content-desc,"coffee")]';
  private readonly vendingLob = '//android.widget.ImageView[contains(@content-desc,"vending")]';

  private lobSelector(lob: Lob): string {
    return { coffee: this.coffeeLob, market: this.marketLob, vending: this.vendingLob }[lob];
  }

  async getLocationCount(): Promise<number> {
    await this.waitFor(this.deliveryLocationList);
    const elements = await this.driver.$$(this.deliveryLocationList);
    const count = await elements.length;
    return count;
  }

  /**
   * Ported from "Click on the ${position} location" - uses 0-based direct
   * array indexing (RF's "Convert position to index value" keyword), unlike
   * BaseScreen.selectServiceLocation's 1-based XPath predicate.
   */
  async clickLocationByPosition(position: Position): Promise<void> {
    const elements = await this.driver.$$(this.deliveryLocationList);
    const index = positionToIndex(position, 0);
    await elements[index].click();
  }

  async clickLob(lob: Lob): Promise<void> {
    await this.tap(this.lobSelector(lob));
  }
}
