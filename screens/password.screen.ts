import { BaseScreen } from './base.screen';

/**
 * Password screen - Microsoft Entra ID (Azure AD) sign-in page, rendered inside the
 * same WebView chain as Login. Element IDs (i0118, idSIButton9, etc.) are Microsoft's
 * own standard ADFS/Entra element IDs - confirmed via uiautomator dump.
 */
export class PasswordScreen extends BaseScreen {
  private readonly passwordField = '//*[@resource-id="i0118"]';
  private readonly signInButton = '//*[@resource-id="idSIButton9"]';
  private readonly forgotPasswordLink = '//*[@resource-id="idA_PWD_ForgotPassword"]';

  async enterPassword(password: string): Promise<void> {
    await this.type(this.passwordField, password);
  }

  async tapSignIn(): Promise<void> {
    await this.tap(this.signInButton);
  }

  async tapForgotPassword(): Promise<void> {
    await this.tap(this.forgotPasswordLink);
  }
}
