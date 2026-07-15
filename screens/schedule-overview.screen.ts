import { BaseScreen } from './base.screen';

export class ScheduleOverviewScreen extends BaseScreen {
  /** Step 1: Tap: android.view.View */
  async step1_androidViewView(): Promise<void> {
    await this.tap("//android.view.View");
  }

  /** Step 2: Tap: Today, Fri 10 Jul */
  async step2_todayFri10Jul(): Promise<void> {
    await this.tap("//*[@content-desc=\"Today, Fri 10 Jul\"]");
  }

  /** Step 3: Tap: Route 10 */
  async step3_route10(): Promise<void> {
    await this.tap("//*[@content-desc=\"Route 10\"]");
  }

  /** Step 4: Tap: 3 Deliveries */
  async step4_3Deliveries(): Promise<void> {
    await this.tap("//*[@content-desc=\"3 Deliveries\"]");
  }

  /** Step 5: Tap: Remaining of 3 */
  async step5_remainingOf3(): Promise<void> {
    await this.tap("//*[@content-desc=\"Remaining of 3\"]");
  }

  /** Step 6: Tap: 0/2 */
  async step6_02(): Promise<void> {
    await this.tap("//*[@content-desc=\"0/2\"]");
  }

  /** Step 7: Tap: 0/1 */
  async step7_01(): Promise<void> {
    await this.tap("//*[@content-desc=\"0/1\"]");
  }

  /** Step 8: Tap: Market */
  async step8_market(): Promise<void> {
    await this.tap("//*[@content-desc=\"Market\"]");
  }

  /** Step 9: Tap: Coffee */
  async step9_coffee(): Promise<void> {
    await this.tap("//*[@content-desc=\"Coffee\"]");
  }

  /** Step 10: Tap: Schedule */
  async step10_schedule(): Promise<void> {
    await this.tap("//*[@content-desc=\"Schedule\"]");
  }

  /** Step 11: Tap: Pending action (3) */
  async step11_pendingAction3(): Promise<void> {
    await this.tap("//*[@content-desc=\"Pending action (3)\"]");
  }

  /** Step 12: Tap: android.view.View */
  async step12_androidViewView(): Promise<void> {
    await this.tap("//android.view.View");
  }

  /** Step 13: Tap: Open navigation menu */
  async step13_openNavigationMenu(): Promise<void> {
    await this.tap("//*[@content-desc=\"Open navigation menu\"]");
  }

  /** Step 14: Tap: Schedule overview */
  async step14_scheduleOverview(): Promise<void> {
    await this.tap("//*[@content-desc=\"Schedule overview\"]");
  }

  /** Step 15: Tap: android.view.View */
  async step15_androidViewView(): Promise<void> {
    await this.tap("//android.view.View");
  }

  /** Step 16: Tap: Open navigation menu */
  async step16_openNavigationMenu(): Promise<void> {
    await this.tap("//*[@content-desc=\"Open navigation menu\"]");
  }

  /** Step 17: Tap: Welcome,  Anthony */
  async step17_welcomeAnthony(): Promise<void> {
    await this.tap("//*[@content-desc=\"Welcome,  Anthony\"]");
  }

  /** Step 18: Tap: Schedule overview */
  async step18_scheduleOverview(): Promise<void> {
    await this.tap("//*[@content-desc=\"Schedule overview\"]");
  }

  /** Step 19: Tap: android.view.View */
  async step19_androidViewView(): Promise<void> {
    await this.tap("//android.view.View");
  }

  /** Step 20: Tap: Open navigation menu */
  async step20_openNavigationMenu(): Promise<void> {
    await this.tap("//*[@content-desc=\"Open navigation menu\"]");
  }

  /** Step 21: Tap: Schedule overview */
  async step21_scheduleOverview(): Promise<void> {
    await this.tap("//*[@content-desc=\"Schedule overview\"]");
  }

  /** Step 22: Tap: Completed (0) */
  async step22_completed0(): Promise<void> {
    await this.tap("//*[@content-desc=\"Completed (0)\"]");
  }

  /** Step 23: Tap: No Completed Task */
  async step23_noCompletedTask(): Promise<void> {
    await this.tap("//*[@content-desc=\"No Completed Task\"]");
  }

  /** Step 24: Tap: Open navigation menu */
  async step24_openNavigationMenu(): Promise<void> {
    await this.tap("//*[@content-desc=\"Open navigation menu\"]");
  }

  /** Step 25: Tap: android.widget.LinearLayout */
  async step25_androidWidgetLinearlayout(): Promise<void> {
    await this.tap("//android.widget.LinearLayout");
  }
}
