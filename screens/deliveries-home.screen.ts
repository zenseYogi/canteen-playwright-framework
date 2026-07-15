import { BaseScreen } from './base.screen';

// Example generated-style screen class. Replace the selectors below with
// the real locators captured by the Inspector's Appium recorder — this
// file just illustrates the shape a recorded class should take so it can
// be dropped straight into tests/generated/ and used from a spec.
export class DeliveriesHomeScreen extends BaseScreen {
  private startDayButton = '~Start day';
  private editScheduleButton = '~Edit schedule';
  private scheduleItem = (name: string) => `//android.widget.TextView[@text="${name}"]`;

  async step1_startDay(): Promise<void> {
    await this.tap(this.startDayButton);
  }

  async step2_openScheduleItem(name: string): Promise<void> {
    await this.tap(this.scheduleItem(name));
  }

  async getDeliveryCountText(): Promise<string> {
    return this.getText('//android.widget.TextView[contains(@text,"Deliveries")]');
  }
}
