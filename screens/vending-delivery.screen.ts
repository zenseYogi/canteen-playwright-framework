import { BaseScreen } from './base.screen';
import { positionToIndex, type Position } from '../utils/position';

/**
 * Page object for the Vending Delivery screen.
 *
 * Encapsulates vending machine selection, header/address validation, and
 * coffee icon discovery/click behavior.
 */
export class VendingDeliveryScreen extends BaseScreen {
  private readonly deliveryLocationList =
    '//android.view.View[contains(@content-desc,"Pending action")]/following-sibling::android.view.View//android.widget.ImageView[@clickable="true"]';

    //  private readonly coffeeIconItems =
    // '//android.widget.ScrollView//android.widget.ImageView[@clickable="true" and not(contains(@content-desc,"vending")) and not(contains(@content-desc,"\n")) and normalize-space(@content-desc)]';
  // private readonly firstCoffeeIconItem =
  //   '//android.widget.ImageView[@content-desc="${headerLabel}"]';

  /**
   * Scrolls until the coffee icon with the given header label becomes visible.
   *
   * This method attempts a limited number of scrolls and returns once the
   * matching ImageView is present and displayed on screen.
   *
   * @param headerLabel The accessible content-desc of the coffee icon.
   * @param maxScrolls Maximum swipe attempts before failing silently.
   */
  async scrollToCoffeeIconItem(headerLabel: string, maxScrolls = 15): Promise<void> {
    const selector = `//android.widget.ImageView[@content-desc="${headerLabel}"]`;
    for (let i = 0; i < maxScrolls; i++) {
      const items = await this.driver.$$(selector);
      const itemCount = await items.length;
      if (itemCount > 0 && (await items[0].isDisplayed().catch(() => false))) {
        return;
      }
      await this.scrollDown({ left: 100, top: 1200, width: 880, height: 800, percent: 0.8 });
    }
  }

  /**
   * Returns the visible coffee icon's header label after scrolling it into view.
   *
   * @param headerLabel The content-desc of the coffee icon to locate.
   * @returns The resolved content-desc for the located coffee icon.
   */
  async getCoffeeIconName(headerLabel: string): Promise<string> {
    await this.scrollToCoffeeIconItem(headerLabel);
    const selector = `//android.widget.ImageView[@content-desc="${headerLabel}"]`;
    const element = await this.driver.$(selector);
    await element.waitForDisplayed({ timeout: 15000 });
    return (await element.getAttribute('content-desc'))?.trim() ?? '';
  }

  /**
   * Clicks the coffee icon with the specified header label by tapping its center.
   *
   * If the icon is visible, this avoids edge/tap-target failures by using the
   * element's computed center coordinate.
   *
   * @param headerLabel The content-desc of the coffee icon to click.
   */
  async clickCoffeeIcon(headerLabel: string): Promise<void> {
     const selector = `//android.widget.ImageView[@content-desc="${headerLabel}"]`;
    const element = await this.driver.$(selector);
    await element.waitForDisplayed({ timeout: 15000 });
    await this.tapElementAtCenter(element as any);
  }

  /**
   * Taps at the center point of the supplied element.
   *
   * This is useful for image-only targets where clicking the element itself may
   * be unreliable due to partial visibility or inaccurate tap target handling.
   *
   * @param element The located target element.
   */
  private async tapElementAtCenter(element: any): Promise<void> {
    const location = await element.getLocation();
    const size = await element.getSize();
    const x = Math.round(location.x + size.width / 2);
    const y = Math.round(location.y + size.height / 2);
    await this.tapAt(x, y);
  }

  /**
   * Reads the header text for the specified machine or coffee item.
   *
   * The method prefers the content-desc attribute, falling back to visible
   * text if needed.
   *
   * @param headerLabel Header label to locate.
   * @returns The resolved header text.
   */
  async getHeaderText(headerLabel: string): Promise<string> {
    const selector = `//android.view.View[@content-desc="${headerLabel}"]`;
    const header = await this.driver.$(selector);
    await header.waitForDisplayed({ timeout: 15000 });
    const element = await this.driver.$(selector);
     const contentDesc = await element.getAttribute('content-desc');
    if (contentDesc && contentDesc.trim().length > 0) {
      return contentDesc.trim();
    }
    return (await element.getText()).trim();
  }

  /**
   * Reads the address displayed immediately below a machine header.
   *
   * The element is selected by following sibling semantics from the named
   * header row.
   *
   * @param headerLabel The visible machine header label.
   * @returns The machine address text.
   */
  async getHeaderAddress(headerLabel: string): Promise<string> {
    const selector = `//android.view.View[@content-desc="${headerLabel}"]/following-sibling::android.view.View[1]`;
    const addressElement = await this.driver.$(selector);
    await addressElement.waitForDisplayed({ timeout: 15000 });
     const contentDesc = await addressElement.getAttribute('content-desc');
    if (contentDesc && contentDesc.trim().length > 0) {
      return contentDesc.trim();
    }
    return (await addressElement.getText()).trim();
  }

  /**
   * Checks whether a named header is currently visible on screen.
   *
   * Uses the header content-desc locator and suppresses locator failures.
   *
   * @param headerLabel Header content-desc to verify.
   * @returns True if the header is displayed.
   */
  async isHeaderDisplayed(headerLabel: string): Promise<boolean> {
    const selector = `//android.view.View[@content-desc="${headerLabel}"]`;
    const header = await this.driver.$(selector);
    return header.isDisplayed().catch(() => false);
  }

  async isHeaderButtonDisplayed(headerLabel: string): Promise<boolean> {
    const selector = `//android.widget.Button[@content-desc="${headerLabel}"]`;
    const header = await this.driver.$(selector);
    return header.isDisplayed().catch(() => false);
  }

  private readonly viewScheduleButton = '~View schedule';

  async tapViewSchedule(): Promise<void> {
    await this.tap(this.viewScheduleButton);
  }

  // /**
  //  * Generic helper to verify whether an element matching the selector
  //  * is currently displayed on screen. Suppresses locator failures and
  //  * returns a boolean for easy use in assertions.
  //  *
  //  * @param selector XPath or selector string for the element.
  //  * @returns True if the element is displayed, false otherwise.
  //  */
  // async isElementDisplayed(selector: string): Promise<boolean> {
  //   const el = await this.driver.$(selector);
  //   return el.isDisplayed().catch(() => false);
  // }



  //android.widget.Button



  ////android.widget.Button[@content-desc="section_header_add_cta"]
  /**
   * Returns the first machine name shown in the delivery location list.
   *
   * Uses the known delivery location list selector and reads the first visible
   * clickable ImageView content-desc.
   *
   * @returns The first machine's display name.
   */
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

  /**
   * Clicks the vending machine tile with the given machine name.
   *
   * @param machineName The content-desc label of the machine tile.
   */
  async clickMachine(machineName: string): Promise<void> {
    const selector = `//android.widget.ImageView[@content-desc="${machineName}"]`;
    const element = await this.driver.$(selector);
    await element.waitForDisplayed({ timeout: 15000 });
    await element.click();
  }
}
