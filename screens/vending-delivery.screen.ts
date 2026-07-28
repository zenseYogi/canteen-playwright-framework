import { BaseScreen } from './base.screen';
import { positionToIndex, type Position } from '../utils/position';

export class VendingDeliveryScreen extends BaseScreen {
  private readonly deliveryLocationList =
    '//android.view.View[contains(@content-desc,"Pending action")]/following-sibling::android.view.View//android.widget.ImageView[@clickable="true"]';

  async getHeaderText(headerLabel: string): Promise<string> {
    const selector = `//android.view.View[@content-desc="${headerLabel}"]`;
    const header = await this.driver.$(selector);
    await header.waitForDisplayed({ timeout: 15000 });
    return (await header.getText()).trim();
  }

  async getHeaderAddress(headerLabel: string): Promise<string> {
    const selector = `//android.view.View[@content-desc="${headerLabel}"]/following-sibling::android.view.View[1]`;
    const addressElement = await this.driver.$(selector);
    await addressElement.waitForDisplayed({ timeout: 15000 });
    return (await addressElement.getText()).trim();
  }

  async isHeaderDisplayed(headerLabel: string): Promise<boolean> {
    const selector = `//android.view.View[@content-desc="${headerLabel}"]`;
    const header = await this.driver.$(selector);
    return header.isDisplayed().catch(() => false);
  }


  async getFirstMachineName(): Promise<string> {
    const elements = await this.driver.$$(this.deliveryLocationList);
    const element = elements[positionToIndex('first', 0)];
    await element.waitForDisplayed({ timeout: 15000 });
    const contentDesc = await element.getAttribute('content-desc');
    if (contentDesc && contentDesc.trim().length > 0) {
      return contentDesc.trim();
    }
    return (await element.getText()).trim();
  }

  async clickMachine(machineName: string): Promise<void> {
    const selector = `//android.view.View[@content-desc="${machineName}"]`;
    const element = await this.driver.$(selector);
    await element.waitForDisplayed({ timeout: 15000 });
    await element.click();
  }
}
