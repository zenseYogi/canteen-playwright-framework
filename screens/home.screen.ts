import { BaseScreen } from './base.screen';

/**
 * Home / dashboard screen - lands here after successful login + MFA.
 */
export class HomeScreen extends BaseScreen {
  // Ported from dashboard.yaml's title_deliveries - the specific element RF's
  // "Validate user is on the dashboard page" keyword waits on. Matches the
  // "Deliver" stem rather than "Deliveries" - live-verified the dashboard
  // shows singular "1 Delivery" (not "1 Deliveries") when only one stop is
  // scheduled, and "Deliveries" is not a substring of "Delivery".
  private readonly deliveriesTitle = '//android.view.View[contains(@content-desc, "Deliver")]';

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
