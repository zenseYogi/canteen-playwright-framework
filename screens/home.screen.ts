import { BaseScreen } from './base.screen';

/**
 * Home / dashboard screen - lands here after successful login + MFA.
 */
export class HomeScreen extends BaseScreen {
  private readonly navMenuButton = '//*[@content-desc="Open navigation menu"]';
  private readonly startDayButton = '//*[@content-desc="Start day"]';

  async isLoaded(): Promise<boolean> {
    return this.isVisible(this.navMenuButton);
  }

  async tapStartDay(): Promise<void> {
    await this.tap(this.startDayButton);
  }
}
