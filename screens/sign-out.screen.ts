import { BaseScreen } from './base.screen';

export class SignOutScreen extends BaseScreen {
  /** Step 1: Tap: Open navigation menu */
  async step1_openNavigationMenu(): Promise<void> {
    await this.tap("//*[@content-desc=\"Open navigation menu\"]");
  }

  /** Step 2: Tap: Sign off */
  async step2_signOff(): Promise<void> {
    await this.tap("//*[@content-desc=\"Sign off\"]");
  }

  /** Step 3: Tap: Sign off */
  async step3_signOff(): Promise<void> {
    await this.tap("//*[@content-desc=\"Sign off\"]");
  }
}
