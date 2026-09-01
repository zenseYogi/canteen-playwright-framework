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
}
