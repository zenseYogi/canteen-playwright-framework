import { BaseScreen } from './base.screen';

export type PostAuthScreen = 'dashboard' | 'route-setup' | 'select-day';

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
  // RE-CORRECTED 2026-08-20: the earlier "lowercase s" claim was wrong - a
  // fresh raw `uiautomator dump` against this exact gate screen (build
  // 0.1.86) shows content-desc="Route Setup" (capital S) - see
  // RouteSetupScreen.screenTitle's matching fix for the same locator.
  private readonly routeSetupGateTitle = '~Route Setup';

  // New as of build 0.1.86 (live-verified 2026-08-20): a "Select Day" bottom
  // sheet (content-desc exactly "Select Day", NOT "Select a day" -
  // RouteSetupScreen.waitForSyncAndDaySheet's older locator was stale too,
  // see its own fix) now appears directly after MFA approval even for an
  // account that already has an assigned route (Miami, FL / Route 010
  // pre-filled, no operation/route search needed) - previously only
  // RouteSetupScreen.changeRouteAndSelectDay's post-confirm sync flow
  // produced this sheet. The hamburger icon is simultaneously present
  // underneath it, so the old two-way wait below would falsely resolve
  // 'dashboard' while this sheet still blocks every subsequent element -
  // that's what caused login.spec.ts's 150s timeout. Checked BEFORE the
  // hamburger so it's never masked by the false-positive dashboard read.
  private readonly selectDaySheetTitle = '~Select Day';

  /**
   * Waits for manual MFA approval, then reports which screen the app landed
   * on - Dashboard (account already has a route), the Route Setup gate
   * (fresh account, no route assigned yet), or the standalone Select Day
   * sheet (account has a route, but the day still needs confirming).
   * Callers must branch on this rather than assuming Dashboard.
   *
   * @param timeoutMs how long to wait for manual approval before failing. Default 2 minutes.
   */
  async waitForManualApproval(timeoutMs = 120_000): Promise<PostAuthScreen> {
    await this.driver.waitUntil(
      async () => {
        const [dashboardVisible, routeSetupVisible, selectDayVisible] = await Promise.all([
          this.isVisible(this.hamburgerIcon),
          this.isVisible(this.routeSetupGateTitle),
          this.isVisible(this.selectDaySheetTitle)
        ]);
        return dashboardVisible || routeSetupVisible || selectDayVisible;
      },
      { timeout: timeoutMs, interval: 2000, timeoutMsg: 'Neither Dashboard, the Route Setup gate, nor the Select Day sheet appeared after MFA approval' }
    );

    if (await this.isVisible(this.selectDaySheetTitle)) {
      return 'select-day';
    }
    return (await this.isVisible(this.routeSetupGateTitle)) ? 'route-setup' : 'dashboard';
  }
}
