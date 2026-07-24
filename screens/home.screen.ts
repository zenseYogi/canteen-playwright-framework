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

  // Live-verified 2026-07-24: pressing BACK from a screen with unsaved
  // Sort/Filter selections (e.g. Vending's Product Fills) triggers a "Save
  // Changes! Your changes have not saved yet, Do you want to save?" dialog
  // (Discard/Save). A naive repeated-BACK loop presses BACK again on this
  // dialog, which just dismisses it back to the SAME screen - the very next
  // press re-triggers the identical dialog, looping forever and never
  // making progress. Must tap "Discard" explicitly instead.
  private readonly discardChangesButton = '~Discard';

  /**
   * Navigates back to Dashboard from wherever the app currently is - used to
   * let multiple tests share one login session (see vending-service.spec.ts)
   * instead of each paying the manual-MFA-approval cost of a fresh login.
   *
   * CORRECTED: this can't be done with plain repeated BACK presses alone -
   * live-verified this app's back-stack is NOT a simple linear chain back to
   * Dashboard. From Vending's Product Fills (after Sort/Filter, no hamburger
   * icon - only a back arrow), one BACK press reaches the machine's task
   * list (still no hamburger), a second reaches the stop-detail screen
   * ("Aaron's" - hamburger IS present here), but a THIRD exits the app
   * entirely to the OS launcher instead of reaching Dashboard - there is no
   * intermediate Dashboard entry in that back-stack to land on. So this
   * instead presses BACK only until any screen with the hamburger menu is
   * reached, then uses the app's own "Schedule overview" nav item (found in
   * the hamburger menu, live-verified) to deterministically reach Dashboard,
   * rather than continuing to guess with more back-presses. Also handles the
   * "Save Changes" dialog (see discardChangesButton) by tapping Discard
   * instead of pressing BACK again, which would otherwise loop forever.
   */
  async returnToHome(maxBackPresses = 10): Promise<void> {
    let reachedHamburger = false;
    for (let i = 0; i < maxBackPresses; i++) {
      if (await this.isVisible(this.hamburgerIcon)) {
        reachedHamburger = true;
        break;
      }
      if (await this.isVisible(this.discardChangesButton)) {
        await this.tap(this.discardChangesButton);
      } else {
        await this.pressKeyCode(4);
      }
      await this.driver.pause(700);
    }
    if (!reachedHamburger) {
      throw new Error(`returnToHome: no screen with the hamburger menu appeared after ${maxBackPresses} BACK presses`);
    }
    await this.tap(this.hamburgerIcon);
    await this.tap('~Schedule overview');
    await this.waitFor(this.deliveriesTitle);
  }
}
