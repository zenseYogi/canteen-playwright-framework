import type { Browser } from 'webdriverio';
import { mobileConfig } from '../config/mobile.config';

export class BaseScreen {
  constructor(protected driver: Browser) {}

  async tap(selector: string): Promise<void> {
    const el = await this.driver.$(selector);
    await el.waitForDisplayed({ timeout: mobileConfig.timeouts.element });
    await el.click();
  }

  async type(selector: string, text: string): Promise<void> {
    const el = await this.driver.$(selector);
    await el.waitForDisplayed({ timeout: mobileConfig.timeouts.element });
    await el.setValue(text);
  }

  async getText(selector: string): Promise<string> {
    const el = await this.driver.$(selector);
    await el.waitForDisplayed({ timeout: mobileConfig.timeouts.element });
    return el.getText();
  }

  async isVisible(selector: string): Promise<boolean> {
    const el = await this.driver.$(selector);
    return el.isDisplayed().catch(() => false);
  }

  async waitFor(selector: string): Promise<void> {
    const el = await this.driver.$(selector);
    await el.waitForDisplayed({ timeout: mobileConfig.timeouts.element });
  }

  /** Coordinate-based tap — used when a recorded step had no stable resource-id/text/content-desc locator. */
  async tapAt(x: number, y: number): Promise<void> {
    await this.driver.touchAction({ action: 'tap', x, y });
  }
}
