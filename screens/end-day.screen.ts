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
  // CONTAINS, not an exact accessibility-id match. The gate's text lives in a
  // single node whose content-desc is the WHOLE block:
  //   "Information\ni\nPlease finish the following\nYou need to complete the
  //    service or provide a No Service reason."
  // `~Please finish the following` requires equality, so it matched nothing and
  // isFinishServiceGateVisible() reported the gate absent while it was plainly
  // on screen. Same class as the Transfers LOB-tab casing bug fixed earlier
  // today: an exact match against a content-desc that carries more than the
  // label being looked for.
  private readonly finishServiceGateTitle =
    '//android.view.View[contains(@content-desc,"Please finish the following")]';
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

  // ---- The "Please finish the following" gate, and its No Service sheet ----
  //
  // Live-mapped 2026-08-28 on Miami 001 with two pending Market stops. The gate
  // lists one row per unfinished activity, each carrying its own Service and
  // No Service buttons. Note it appeared WITHOUT Start Day having been
  // completed on that route/day.
  private readonly selectOrderOptionLabel = '~Select order option';

  /** ED-TC-002 - how many pending activities the gate is listing, counted by their No Service buttons. */
  async getGatePendingActivityCount(): Promise<number> {
    return [...(await this.driver.$$(this.noServiceButton))].length;
  }

  /** ED-TC-002 - whether the gate offers BOTH actions the case names. */
  async isGateActionPairVisible(): Promise<{ service: boolean; noService: boolean }> {
    return {
      service: await this.isVisible('~Service'),
      noService: await this.isVisible(this.noServiceButton)
    };
  }

  /**
   * ED-TC-003 - opens the No Service sheet for the FIRST listed activity,
   * without resolving anything. Distinct from resolveWithNoService(), which
   * commits: this one only opens, so the sheet's contents can be asserted and
   * then dismissed leaving the stop untouched.
   */
  async openNoServiceSheet(): Promise<void> {
    await this.tap(this.noServiceButton);
    await this.waitFor(this.selectOrderOptionLabel);
  }

  /** ED-TC-003 - the "Select order option" heading and the two options under it. */
  async getOrderOptions(): Promise<{ heading: boolean; leaveOnTruck: boolean; returnToWarehouse: boolean }> {
    return {
      heading: await this.isVisible(this.selectOrderOptionLabel),
      leaveOnTruck: await this.isVisible(this.leaveOnTruckOption),
      returnToWarehouse: await this.isVisible(this.returnToWarehouseOption)
    };
  }

  /** The No Service sheet's own Skip stop button - gated until a reason is chosen. */
  async isNoServiceSkipEnabled(): Promise<boolean> {
    return this.isEnabled(this.skipStopSheetTitle.replace('~', '//android.widget.Button[@content-desc="') + '"]');
  }

  /** Dismisses the No Service sheet via its scrim, leaving the stop unresolved. */
  async dismissNoServiceSheet(): Promise<void> {
    await this.tap('~Scrim');
    await this.driver
      .waitUntil(async () => !(await this.isVisible(this.selectOrderOptionLabel)), { timeout: 15_000, interval: 500 })
      .catch(() => undefined);
  }

  /**
   * Opens End Day from the hamburger menu.
   *
   * WAITS FOR THE DRAWER, both open and closed. The previous version tapped
   * the hamburger and then immediately tapped the menu item, with no wait
   * between - so the second tap could land while the drawer was still sliding
   * in, hit whatever sat at those coordinates on the screen behind, and leave
   * the app exactly where it started. Observed 2026-08-28 on Miami 001: the
   * test ended on Home having "opened" End Day, and the same navigation done
   * by hand a minute earlier had worked fine. TransfersScreen.open() already
   * had the waits; this did not.
   *
   * The close is detected via "Schedule overview" - a drawer-only item -
   * rather than by waiting for the End Day screen's own header, because that
   * header carries the SAME content-desc ("End day") as the drawer item that
   * was just tapped, so waiting for it would pass before anything happened.
   */
  async openFromHamburgerMenu(): Promise<void> {
    await this.tap(this.hamburgerIcon);
    // tapWhenSettled, not tap: the drawer reports its final bounds while still
    // sliding, so a click aimed there lands on the scrim and closes it again.
    await this.tapWhenSettled(this.endDayMenuItem);
    await this.driver.waitUntil(async () => !(await this.isVisible('~Schedule overview')), {
      timeout: 30_000,
      interval: 500,
      timeoutMsg: 'The navigation drawer did not close after tapping End day'
    });
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
  // ---- Reports, the step AFTER Unused Kits ----
  //
  // Live-mapped 2026-08-28 on Charlotte 103 (Coffee). The flow observed there
  // is Unused kits -> Reports -> Done. **Money Bag Review did not appear at
  // all**, which the older notes in this suite assumed always sat between the
  // two - it is populated from SKIPPED stops carrying money bags, and a Coffee
  // route has neither.
  private readonly reportsTitle = '~Reports';
  private readonly noReportsMessage = '~No reports are available.';
  // NB: `doneButton` is inherited from BaseScreen ('~Done') - redeclaring it
  // here shadows the base member and fails the build.

  async isReportsScreenVisible(): Promise<boolean> {
    return this.isVisible(this.reportsTitle);
  }

  /** ED-TC-013 - whether Reports is empty rather than listing report categories. */
  async isNoReportsMessageVisible(): Promise<boolean> {
    return this.isVisible(this.noReportsMessage);
  }

  /**
   * Whether the Reports step's Done is offered. NOT tapped by any of the
   * non-terminal End Day tests: Done uploads the reports, raises the End Day
   * Successful popup (ED-TC-014) and completes the day (ED-TC-015), which ends
   * the route day for every other test on the route. Its presence is what the
   * non-terminal tests assert - that the flow REACHED the last step - rather
   * than pressing it.
   */
  async isDoneVisible(): Promise<boolean> {
    return this.isVisible(this.doneButton);
  }

  async isDoneEnabled(): Promise<boolean> {
    return this.isEnabled(this.doneButton);
  }

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
