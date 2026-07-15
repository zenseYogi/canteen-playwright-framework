import { BaseScreen } from './base.screen';

export class SignInScreen extends BaseScreen {
  /** Step 1: Tap: android.widget.LinearLayout */
  async step1_androidWidgetLinearlayout(): Promise<void> {
    await this.tap("//android.widget.LinearLayout");
  }

  /** Step 2: Tap: android.view.View */
  async step2_androidViewView(): Promise<void> {
    await this.tap("//android.view.View");
  }

  /** Step 3: Tap: android.widget.LinearLayout */
  async step3_androidWidgetLinearlayout(): Promise<void> {
    await this.tap("//android.widget.LinearLayout");
  }

  /** Step 4: Tap: android.view.View */
  async step4_androidViewView(): Promise<void> {
    await this.tap("//android.view.View");
  }

  /** Step 5: Tap: android.view.View */
  async step5_androidViewView(): Promise<void> {
    await this.tap("//android.view.View");
  }

  /** Step 6: Tap: android.widget.LinearLayout */
  async step6_androidWidgetLinearlayout(): Promise<void> {
    await this.tap("//android.widget.LinearLayout");
  }

  /** Step 7: Tap: android.view.View */
  async step7_androidViewView(): Promise<void> {
    await this.tap("//android.view.View");
  }

  /** Step 8: Tap: android.view.View */
  async step8_androidViewView(): Promise<void> {
    await this.tap("//android.view.View");
  }

  /** Step 9: Tap: Today, Fri 10 Jul */
  async step9_todayFri10Jul(): Promise<void> {
    await this.tap("//*[@content-desc=\"Today, Fri 10 Jul\"]");
  }

  /** Step 10: Tap: Open navigation menu */
  async step10_openNavigationMenu(): Promise<void> {
    await this.tap("//*[@content-desc=\"Open navigation menu\"]");
  }

  /** Step 11: Tap: android.widget.LinearLayout */
  async step11_androidWidgetLinearlayout(): Promise<void> {
    await this.tap("//android.widget.LinearLayout");
  }
}
