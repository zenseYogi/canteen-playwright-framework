import { BaseScreen } from './base.screen';

/**
 * End Day flow - live-verified 2026-08-05 (build 0.1.76, Route 10/Miami).
 *
 * The Excel's TC001 ("End Day is disabled") gate is real: End Day only
 * reaches the Unused Kits screen once every scheduled stop for the day is
 * either fully serviced OR skipped via the "Skip stop" flow
 * (DashboardScreen.swipeAndSkipServiceStation + this class's Skip-stop-sheet
 * methods) - live-verified this is the SAME mechanism Excel's TC001
 * describes as "do the service or do a No Service" for each pending stop.
 *
 * Skipping every stop for the day (rather than fully completing each one)
 * is by far the fastest real path to the Unused Kits/Money Bag Review
 * screens - confirmed live 2026-08-05 that this is a genuine, intended app
 * flow, not a workaround: the "Skip stop" sheet's Reason field defaults to
 * "Serviced Using Client App" and "Return to warehouse" is pre-selected,
 * suggesting this is the expected day-to-day path for stops actually
 * serviced through a separate client-facing app rather than Nexus itself.
 */
export class EndDayScreen extends BaseScreen {
  private readonly endDayMenuItem = '~End day';
  private readonly unusedKitsTitle = '~Unused kits';
  // TC001's gate isn't scoped to Market/Coffee/Vending delivery stops only -
  // live-verified 2026-08-05 (Route 10/TODAY) it also covers a Warehouse
  // stop (e.g. "Homestead Warehouse (FedEx)") that never appears in
  // DashboardScreen's own Pending action list at all - End Day itself shows
  // a "Please finish the following" screen naming it, with the same
  // Service/No Service choice TC001 describes.
  private readonly finishServiceGateTitle = '~Please finish the following';
  private readonly noServiceButton = '~No Service';
  private readonly noServiceReasonField = '//android.widget.EditText';
  private readonly noServiceConfirmButton = '(//*[@content-desc="No Service"])[2]';
  private readonly skipStopSheetTitle = '~Skip stop';
  private readonly skipStopReasonField = '//android.view.View[starts-with(@content-desc,"Reason for skipping stop")]';
  private readonly leaveOnTruckOption = '~Leave on truck';
  private readonly returnToWarehouseOption = '~Return to warehouse';
  private readonly skipStopConfirmButton = '(//*[@content-desc="Skip stop"])[2]';
  private readonly moneyBagReviewTitle = (count: number) => `//android.view.View[starts-with(@content-desc,"Money Bag Review: ${count}")]`;
  private readonly totalBagsLine = (count: number) => `~Total Bags: ${count}`;
  private readonly deliveriesWithoutBagsLine = (count: number) => `~Deliveries without bags: ${count}`;
  private readonly kitRow = (lob: string, accountName: string, machineOrAccount: string) =>
    `//android.view.View[starts-with(@content-desc,"${lob}\n${accountName}\n${machineOrAccount}")]`;

  /** Opens End Day from the hamburger menu. Assumes it's already enabled (see this class's own note on the TC001 gate). */
  async openFromHamburgerMenu(): Promise<void> {
    await this.tap(this.hamburgerIcon);
    await this.tap(this.endDayMenuItem);
  }

  /** Whether End Day is showing the "Please finish the following" gate instead of Unused Kits - a stop (e.g. a Warehouse stop) still needs Service or No Service. */
  async isFinishServiceGateVisible(): Promise<boolean> {
    return this.isVisible(this.finishServiceGateTitle);
  }

  /** Taps No Service on the finish-service gate screen and, if a reason sheet appears, fills a generic reason and confirms - mirrors the Skip stop sheet's own trigger/confirm label-reuse convention (see confirmSkipStop's note). */
  async resolveWithNoService(reason = 'Serviced Using Client App'): Promise<void> {
    await this.tap(this.noServiceButton);
    const reasonField = await this.driver.$(this.noServiceReasonField);
    if (await reasonField.isDisplayed().catch(() => false)) {
      await reasonField.click();
      await reasonField.setValue(reason);
      await this.pressKeyCode(4);
    }
    if (await this.isVisible(this.noServiceConfirmButton)) {
      await this.tap(this.noServiceConfirmButton);
    }
  }

  /** Excel TC002 - the Unused Kits screen's own title, live-verified alongside a numeric count badge next to it. */
  async isUnusedKitsScreenVisible(): Promise<boolean> {
    return this.isVisible(this.unusedKitsTitle);
  }

  /** Excel TC002 - the count shown inline with the "Unused kits" title (should match the number of skipped/unused-kit stops). */
  async getUnusedKitsCount(): Promise<number> {
    const el = await this.driver.$('//android.view.View[@content-desc="Unused kits"]/following-sibling::android.view.View');
    const text = (await el.getAttribute('content-desc')) ?? '';
    return parseInt(text, 10);
  }

  /** Excel TC002 - a given kit row is present, identified by its LOB title + account/location name + machine-or-area name (the row's own content-desc packs LOB/account/machine/date/order into one string). */
  async isKitRowVisible(lob: string, accountName: string, machineOrAccount: string): Promise<boolean> {
    return this.isVisible(this.kitRow(lob, accountName, machineOrAccount));
  }

  /** Excel TC003 - taps the Unused Kits screen's own Continue button, proceeding to Money Bag Review. */
  async tapContinue(): Promise<void> {
    await this.tap(this.continueButton);
  }

  /** Excel TC004 - the Money Bag Review screen's own title, combined with its total kit count (e.g. "Money Bag Review: 3"). */
  async isMoneyBagReviewVisible(count: number): Promise<boolean> {
    return this.isVisible(this.moneyBagReviewTitle(count));
  }

  /** Excel TC004 - the "Total Bags: N" line above the (here, empty) money-bag table. */
  async isTotalBagsVisible(count: number): Promise<boolean> {
    return this.isVisible(this.totalBagsLine(count));
  }

  /** Excel TC004 - the "Deliveries without bags: N" line above the Reason/Machine-Account/Time table. */
  async isDeliveriesWithoutBagsVisible(count: number): Promise<boolean> {
    return this.isVisible(this.deliveriesWithoutBagsLine(count));
  }

  /** Whether the "Skip stop" bottom sheet (opened via DashboardScreen.swipeAndSkipServiceStation) is showing. */
  async isSkipStopSheetVisible(): Promise<boolean> {
    return this.isVisible(this.skipStopSheetTitle);
  }

  /** The Skip-stop sheet's own Reason field text - live-verified this defaults to "Serviced Using Client App" without any input needed. */
  async getSkipReasonText(): Promise<string> {
    const el = await this.driver.$(this.skipStopReasonField);
    return (await el.getAttribute('content-desc')) ?? '';
  }

  async selectLeaveOnTruck(): Promise<void> {
    await this.tap(this.leaveOnTruckOption);
  }

  async selectReturnToWarehouse(): Promise<void> {
    await this.tap(this.returnToWarehouseOption);
  }

  /** Confirms the Skip-stop sheet - live-verified the sheet's own title and its confirm button share the exact content-desc "Skip stop", so the confirm button is addressed positionally (2nd match) rather than by a name collision-prone locator. */
  async confirmSkipStop(): Promise<void> {
    await this.tap(this.skipStopConfirmButton);
  }
}
