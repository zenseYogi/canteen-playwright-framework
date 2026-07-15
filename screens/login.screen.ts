import { BaseScreen } from './base.screen';

/**
 * Login screen - rendered as a WebView (SSO/OAuth login page, "Compass | Login"),
 * not native Flutter. Locators confirmed via uiautomator dump.
 */
export class LoginScreen extends BaseScreen {
  private readonly loginIdField = '//*[@resource-id="login-id"]';
  private readonly continueButton = '//*[@resource-id="get-home-realm-details-button"]';

  async enterLoginId(loginId: string): Promise<void> {
    await this.type(this.loginIdField, loginId);
  }

  async tapContinue(): Promise<void> {
    await this.tap(this.continueButton);
  }
}
