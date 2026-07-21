import { BaseScreen } from './base.screen';

/**
 * Home / dashboard screen - lands here after successful login + MFA.
 */
export class HomeScreen extends BaseScreen {
  // Ported from dashboard.yaml's title_deliveries - the specific element RF's
  // "Validate user is on the dashboard page" keyword waits on.
  private readonly deliveriesTitle = '//android.view.View[contains(@content-desc, "Deliveries")]';

  async isLoaded(): Promise<boolean> {
    return this.isVisible(this.hamburgerIcon);
  }

  /** Ported from dashboard_keywords.robot's "Validate user is on the dashboard page". */
  async waitForDashboardLoaded(): Promise<void> {
    await this.waitFor(this.deliveriesTitle);
  }

  async tapStartDay(): Promise<void> {
    await this.tap(this.startDayButton);
  }
}
