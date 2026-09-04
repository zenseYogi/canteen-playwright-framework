import { BaseScreen } from './base.screen';

/**
 * Login screen - a real CAS/SSO WebView (ssoqas.compassmanager.com), not a
 * native Flutter screen. Confirmed live via Chrome DevTools (chrome://inspect
 * equivalent over `adb forward` to the `webview_devtools_remote_*` socket)
 * once WebView.setWebContentsDebuggingEnabled was enabled in build 0.1.76
 * (nexus-app-qa-debug-220726.apk, package com.compass.canteen.nexus.test -
 * previously this was disabled, forcing an ADB coordinate-tap stopgap; see
 * git history for that approach).
 *
 * With debugging on, Appium can create a real WEBVIEW_* context and locate
 * these elements by their actual HTML `id` - confirmed by driving this exact
 * flow end-to-end against the live emulator.
 */
export class LoginScreen extends BaseScreen {
  // IDs corrected 2026-08-20 (build 0.1.86, live-verified via CDP against
  // ssoqas.compassmanager.com): the CAS page now renders `#loginId` /
  // `#hrdContinueBtn`, not the earlier `#login-id` / `#get-home-realm-details-button`.
  private readonly loginIdField = '#loginId';
  private readonly continueBtn = '#hrdContinueBtn';

  async enterLoginId(loginId: string): Promise<void> {
    await this.switchToWebView();
    await this.type(this.loginIdField, loginId);
  }

  async tapContinue(): Promise<void> {
    await this.tap(this.continueBtn);
  }

  /**
   * Whether the login form is ACTUALLY on screen - i.e. the #loginId field
   * exists in the WebView, not merely that a WEBVIEW context is listed.
   *
   * Added 2026-09-02. loginAndWaitForMfa's resume path used the context list
   * alone as its "still on Login" signal, and that list is unreliable: once an
   * app process has rendered the Login WebView, getContexts() keeps reporting a
   * WEBVIEW_* entry long after login (already noted in that function's own
   * comments). So any resumed session that happened to be on a hamburger-less
   * screen - a modal, the sync screen - was judged "logged out" and started a
   * full sign-in, sitting there waiting on an MFA push that no one was going to
   * approve. Checking for the field itself is the difference between "a WebView
   * exists somewhere" and "the user is being asked to log in".
   *
   * Restores NATIVE_APP before returning either way, so callers are left in the
   * context they started in.
   */
  async isLoginFormPresent(): Promise<boolean> {
    try {
      await this.switchToWebView();
    } catch {
      return false;
    }
    const present = await this.driver
      .$(this.loginIdField)
      .isExisting()
      .catch(() => false);
    await this.switchToNative().catch(() => {});
    return present;
  }
}
