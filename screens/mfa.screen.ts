import { BaseScreen } from './base.screen';

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
  private readonly homeScreenAnchor = '//*[@content-desc="Open navigation menu"]';

  /**
   * @param timeoutMs how long to wait for manual approval before failing. Default 2 minutes.
   */
  async waitForManualApproval(timeoutMs = 120_000): Promise<void> {
    const el = await this.driver.$(this.homeScreenAnchor);
    await el.waitForDisplayed({ timeout: timeoutMs, interval: 2000 });
  }
}
