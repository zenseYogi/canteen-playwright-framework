import { BaseScreen } from './base.screen';

/**
 * Password screen - Microsoft Entra ID (Azure AD) sign-in page
 * (login.microsoftonline.com), reached via a same-WebView cross-origin
 * redirect after Login's Continue. Confirmed live (same WebView-debugging
 * build as LoginScreen - see its comment for context) that this really is
 * Microsoft's own hosted page, using its standard field/button ids.
 */
export class PasswordScreen extends BaseScreen {
  private readonly passwordField = '#i0118';
  private readonly signInBtn = '#idSIButton9';
  private readonly forgotPasswordLink = '#idA_PWD_ForgotPassword';

  async enterPassword(password: string): Promise<void> {
    await this.switchToWebView();
    await this.type(this.passwordField, password);
  }

  async tapSignIn(): Promise<void> {
    await this.tap(this.signInBtn);
    // Past Sign in, the app returns to native Flutter (camera-permission
    // dialog, then the MFA screen) - switch back so those screens' native
    // accessibility-id locators can find anything at all.
    await this.switchToNative();
  }

  async tapForgotPassword(): Promise<void> {
    await this.tap(this.forgotPasswordLink);
  }
}
