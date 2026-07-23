import { BaseScreen } from './base.screen';

export type PostAuthScreen = 'dashboard' | 'route-setup';

/**
 * MFA screen - Microsoft Authenticator push notification with number matching +
 * fingerprint confirmation on a separate physical device. This cannot be automated
 * end-to-end client-side - there is no code path to a second device's biometric sensor.
 *
 * INTERIM APPROACH: poll for the Home screen's anchor element to appear, giving a human
 * time to approve the push on their phone. Remove/shorten this once a dedicated QA test
 * account with an MFA/Conditional-Access exclusion is provisioned (see the raised ask to
 * Rajesh) - at that point login should complete without ever reaching this screen.
 */
export class MfaScreen extends BaseScreen {
  // Same accessibility id as RouteSetupScreen's private screenTitle - a fresh
  // account (one that's never had a route assigned) lands directly on this
  // mandatory gate screen after MFA instead of Dashboard, with no hamburger
  // menu accessible until it's completed. Live-verified: this is a real,
  // valid post-auth destination, not a bug.
  private readonly routeSetupGateTitle = '~Route Setup';

  /**
   * Waits for manual MFA approval, then reports which screen the app landed
   * on - Dashboard (account already has a route) or the Route Setup gate
   * (fresh account, no route assigned yet). Callers must branch on this
   * rather than assuming Dashboard.
   *
   * @param timeoutMs how long to wait for manual approval before failing. Default 2 minutes.
   */
  async waitForManualApproval(timeoutMs = 120_000): Promise<PostAuthScreen> {
    await this.driver.waitUntil(
      async () => {
        const [dashboardVisible, routeSetupVisible] = await Promise.all([
          this.isVisible(this.hamburgerIcon),
          this.isVisible(this.routeSetupGateTitle)
        ]);
        return dashboardVisible || routeSetupVisible;
      },
      { timeout: timeoutMs, interval: 2000, timeoutMsg: 'Neither Dashboard nor the Route Setup gate appeared after MFA approval' }
    );

    return (await this.isVisible(this.routeSetupGateTitle)) ? 'route-setup' : 'dashboard';
  }
}
