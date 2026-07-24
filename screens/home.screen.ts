import { BaseScreen } from './base.screen';
import type { Lob } from '../utils/lob';

/**
 * Home / dashboard screen - lands here after successful login + MFA.
 */
export class HomeScreen extends BaseScreen {
  // Ported from dashboard.yaml's title_deliveries - the specific element RF's
  // "Validate user is on the dashboard page" keyword waits on. Matches the
  // "Deliver" stem rather than "Deliveries" - live-verified the dashboard
  // shows singular "1 Delivery" (not "1 Deliveries") when only one stop is
  // scheduled, and "Deliveries" is not a substring of "Delivery".
  private readonly deliveriesTitle = '//android.view.View[contains(@content-desc, "Deliver")]';

  // PBI 622025 "Home Page: Dynamic data with functionality" - live-verified
  // against build 0.1.76 (Miami/010). The day badge's content-desc is the
  // whole string (e.g. "Yesterday, Thu 23 Jul") - matched by its one of
  // three fixed prefixes, since the day/date portion changes daily.
  private readonly currentDateBadge =
    '//android.view.View[starts-with(@content-desc,"Today") or starts-with(@content-desc,"Yesterday") or starts-with(@content-desc,"Tomorrow")]';
  private readonly routeBadge = '//android.view.View[starts-with(@content-desc,"Route")]';
  // Live-verified: each LOB's "X/Y" count badge and its name label are
  // siblings in two separate groups under the same parent (all counts
  // first, then all labels), in the SAME per-LOB order - e.g. Market's
  // count and Coffee's count both precede both labels. Confirmed only
  // "X/Y"-shaped counts contain "/" on this screen, so lobCountBadge is
  // safe without also scoping to a specific container.
  private readonly lobCountBadge = '//android.view.View[contains(@content-desc,"/")]';
  private readonly lobLabels = '//android.view.View[@content-desc="Market" or @content-desc="Coffee" or @content-desc="Vending"]';
  // TC036 "view Edit schedule order screen" / TC018/TC020 "navigate to Edit
  // schedule order screen" (PBI 611763/630328) - live-verified: opens a
  // sheet titled "Edit Schedule Order" listing every stop's name+address.
  private readonly editScheduleButton = '~Edit schedule';
  private readonly editScheduleTitle = '~Edit Schedule Order';

  async isLoaded(): Promise<boolean> {
    return this.isVisible(this.hamburgerIcon);
  }

  /** Ported from dashboard_keywords.robot's "Validate user is on the dashboard page". */
  async waitForDashboardLoaded(): Promise<void> {
    await this.waitFor(this.deliveriesTitle);
  }

  async tapStartDay(): Promise<void> {
    await this.tap(this.startDayButton);
  }

  /** TC007 "view the System Date" - the day/date badge in the navigation bar (e.g. "Yesterday, Thu 23 Jul"). */
  async getCurrentDateText(): Promise<string> {
    const el = await this.driver.$(this.currentDateBadge);
    return (await el.getAttribute('content-desc')) ?? '';
  }

  /** TC012 "view route badge" - e.g. "Route 103". */
  async getRouteBadgeText(): Promise<string> {
    const el = await this.driver.$(this.routeBadge);
    return (await el.getAttribute('content-desc')) ?? '';
  }

  /** TC013 "view Deliveries" / TC014 "view remaining deliveries" (PBI 622025) - parsed from the shared "N Delivery/Deliveries" text. */
  async getDeliveriesCount(): Promise<number> {
    const el = await this.driver.$(this.deliveriesTitle);
    const desc = (await el.getAttribute('content-desc')) ?? '';
    return Number(/(\d+)/.exec(desc)?.[1]);
  }

  /**
   * TC015 "view Vending counter" (and the equivalent Market/Coffee counts,
   * part of PBI 622025's "dynamic" claim) - returns whichever LOBs actually
   * have a card rendered today (this screen only shows a LOB's badge when it
   * has scheduled stops - e.g. Miami/010 shows Market+Coffee, never Vending).
   */
  async getLobCounts(): Promise<Partial<Record<Lob, string>>> {
    const labelEls = await this.driver.$$(this.lobLabels);
    const countEls = await this.driver.$$(this.lobCountBadge);
    const result: Partial<Record<Lob, string>> = {};
    const labelCount = await labelEls.length;
    for (let i = 0; i < labelCount; i++) {
      const label = ((await labelEls[i].getAttribute('content-desc')) ?? '').toLowerCase() as Lob;
      const count = countEls[i] ? await countEls[i].getAttribute('content-desc') : null;
      if (count) {
        result[label] = count;
      }
    }
    return result;
  }

  async openEditSchedule(): Promise<void> {
    await this.tap(this.editScheduleButton);
    await this.waitFor(this.editScheduleTitle);
  }

  async isEditScheduleVisible(): Promise<boolean> {
    return this.isVisible(this.editScheduleTitle);
  }

  /**
   * TC036 "view Edit schedule order screen... with icon and list of stops
   * with names and addresses" - each stop row's content-desc is
   * "{address}\n{Name}" (live-verified, e.g. "19000 SW 192nd St Miami
   * Florida 33187-1908\nCureLeaf"), so this returns just the trailing name
   * line from every multi-line View on the (assumed already open) sheet.
   */
  async getEditScheduleStopNames(): Promise<string[]> {
    const els = await this.driver.$$('//android.view.View');
    const names: string[] = [];
    for (const el of els) {
      const desc = (await el.getAttribute('content-desc')) ?? '';
      if (desc.includes('\n')) {
        const parts = desc.split('\n');
        names.push(parts[parts.length - 1]);
      }
    }
    return names;
  }

  // Live-verified 2026-07-24: pressing BACK from a screen with unsaved
  // Sort/Filter selections (e.g. Vending's Product Fills) triggers a "Save
  // Changes! Your changes have not saved yet, Do you want to save?" dialog
  // (Discard/Save). A naive repeated-BACK loop presses BACK again on this
  // dialog, which just dismisses it back to the SAME screen - the very next
  // press re-triggers the identical dialog, looping forever and never
  // making progress. Must tap "Discard" explicitly instead.
  private readonly discardChangesButton = '~Discard';

  /**
   * Navigates back to Dashboard from wherever the app currently is - used to
   * let multiple tests share one login session (see vending-service.spec.ts)
   * instead of each paying the manual-MFA-approval cost of a fresh login.
   *
   * CORRECTED: this can't be done with plain repeated BACK presses alone -
   * live-verified this app's back-stack is NOT a simple linear chain back to
   * Dashboard. From Vending's Product Fills (after Sort/Filter, no hamburger
   * icon - only a back arrow), one BACK press reaches the machine's task
   * list (still no hamburger), a second reaches the stop-detail screen
   * ("Aaron's" - hamburger IS present here), but a THIRD exits the app
   * entirely to the OS launcher instead of reaching Dashboard - there is no
   * intermediate Dashboard entry in that back-stack to land on. So this
   * instead presses BACK only until any screen with the hamburger menu is
   * reached, then uses the app's own "Schedule overview" nav item (found in
   * the hamburger menu, live-verified) to deterministically reach Dashboard,
   * rather than continuing to guess with more back-presses. Also handles the
   * "Save Changes" dialog (see discardChangesButton) by tapping Discard
   * instead of pressing BACK again, which would otherwise loop forever.
   */
  async returnToHome(maxBackPresses = 10): Promise<void> {
    let reachedHamburger = false;
    for (let i = 0; i < maxBackPresses; i++) {
      if (await this.isVisible(this.hamburgerIcon)) {
        reachedHamburger = true;
        break;
      }
      if (await this.isVisible(this.discardChangesButton)) {
        await this.tap(this.discardChangesButton);
      } else {
        await this.pressKeyCode(4);
      }
      await this.driver.pause(700);
    }
    if (!reachedHamburger) {
      throw new Error(`returnToHome: no screen with the hamburger menu appeared after ${maxBackPresses} BACK presses`);
    }
    await this.tap(this.hamburgerIcon);
    await this.tap('~Schedule overview');
    await this.waitFor(this.deliveriesTitle);
  }
}
