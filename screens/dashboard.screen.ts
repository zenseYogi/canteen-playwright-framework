import { BaseScreen } from './base.screen';
import { positionToIndex, type Position } from '../utils/position';
import type { Lob } from '../utils/lob';

/**
 * Dashboard / location-selection screen. Ported from dashboard_keywords.robot.
 */
export class DashboardScreen extends BaseScreen {
  // Ported dashboard.yaml locator was confirmed BROKEN via live verification
  // against build 0.1.73 (0 matches, even after accounting for the
  // raw-uiautomator-dump-vs-Appium-page-source tag format difference).
  // Replaced with a content-desc-anchored selector confirmed live: the three
  // location rows are android.widget.ImageView siblings following the
  // "Pending action (N)" tab, which is far more stable than the original's
  // absolute structural position.
  //
  // CORRECTED (live-verified 2026-08-06, build 0.1.76): that ImageView-only
  // assumption breaks once a location has more than one LOB icon (e.g.
  // FedEx after gaining a Coffee delivery alongside its existing Market
  // one) - the row's clickable wrapper is then a plain android.view.View,
  // not an ImageView (single-LOB rows still use a bare ImageView), AND it
  // sits 3 levels of plain View deeper than before rather than being the
  // ImageView-only xpath's direct match. Rather than hardcode that depth,
  // matches on @content-desc being non-empty (live-verified: only the row
  // itself carries the location name as content-desc - every element
  // nested inside it, LOB icons and the row's own checkbox alike, has none)
  // combined with @clickable="true", which is depth- and tag-agnostic.
  private readonly deliveryLocationList =
    '//android.view.View[contains(@content-desc,"Pending action")]/following-sibling::android.view.View//*[@clickable="true" and string-length(@content-desc) > 0]';

  // CORRECTED: dashboard.yaml declared this capitalized ("Market"), which
  // this doc previously assumed was a real app inconsistency worth
  // preserving verbatim. Live verification against build 0.1.73 showed the
  // actual per-location LOB card's content-desc is lowercase
  // ("market\n1 Service stations "), matching coffee/vending's convention -
  // the capitalized version was simply wrong, not a real quirk.
  private readonly marketLob = '//android.widget.ImageView[contains(@content-desc,"market")]';
  private readonly coffeeLob = '//android.widget.ImageView[contains(@content-desc,"coffee")]';
  private readonly vendingLob = '//android.widget.ImageView[contains(@content-desc,"vending")]';

  private lobSelector(lob: Lob): string {
    return { coffee: this.coffeeLob, market: this.marketLob, vending: this.vendingLob }[lob];
  }

  // Live-verified (build 0.1.73): a service station row under an expanded
  // LOB card has content-desc "{LocationName}\n{lob}" (e.g. "CuraLeaf\nmarket") -
  // an android.view.View, distinct from the LOB card's own ImageView tile.
  // Only confirmed against a single-service-station example; not yet tested
  // with more than one station under a card.
  private firstServiceStationUnder(lob: Lob): string {
    return `//android.view.View[contains(@content-desc,"${lob}")]`;
  }

  // CORRECTED (live-verified against build 0.1.76, a Vending-only route with
  // multiple machines per stop): firstServiceStationUnder()'s
  // contains(@content-desc,"vending") assumption breaks down here - the LOB
  // card's own header is an android.widget.ImageView with content-desc
  // "vending\n3 Service stations " (which the View-only xpath correctly
  // skips), but each actual machine row (e.g. "61241 - Lg Snacks\nBreakroom")
  // is arbitrary per-machine data with NO "vending" substring at all - so
  // the old xpath matches nothing once a LOB has more than one station.
  // This position-based alternative walks from the card header (which DOES
  // reliably start with the lob name) to its Nth following View sibling
  // instead of relying on the row's own text.
  private nthServiceStationUnder(lob: Lob, position: Position): string {
    // +1: the card header's immediate first View sibling is a non-clickable
    // numeric badge - not a service station row at all. Actual station rows
    // start at the second sibling.
    //
    // CORRECTED 2026-08-22 (M-TC-008, live-verified): this badge isn't a
    // fixed "0" - it's the LOB card's real completion progress as a plain
    // integer percentage (content-desc "0" before any station is actioned,
    // "100" once fully complete). See serviceStationProgress()/
    // getServiceStationProgress() below, which read this same node
    // properly instead of just skipping past it.
    const index = positionToIndex(position, 1) + 1;
    return `//android.widget.ImageView[starts-with(@content-desc,"${lob}")]/following-sibling::android.view.View[${index}]`;
  }

  /** M-TC-008 "updated progress bar" - the LOB card's completion-progress node, immediately following its header (see nthServiceStationUnder's own corrected note). */
  private serviceStationProgress(lob: Lob): string {
    return `//android.widget.ImageView[starts-with(@content-desc,"${lob}")]/following-sibling::android.view.View[1]`;
  }

  /** M-TC-008 "updated progress bar" - reads the LOB card's completion percentage (0-100). Assumes the card is already expanded (see openFirstServiceStation/openNthServiceStation). */
  async getServiceStationProgress(lob: Lob): Promise<number> {
    const el = await this.driver.$(this.serviceStationProgress(lob));
    const text = (await el.getAttribute('content-desc')) ?? '0';
    return parseInt(text, 10) || 0;
  }

  /**
   * M-TC-008 "green tick" - whether a given service station row shows its
   * completed/green-checkmark visual state. Same "no accessibility signal,
   * state exists only in the rendered bitmap" situation BaseScreen's
   * isChecklistIconChecked already solves for Prep Tasks/Checks checkboxes -
   * live-verified 2026-08-22 this reuses cleanly here too (a completed
   * station row's light-green tinted background registers the same way).
   * Assumes the card is already expanded.
   */
  async isNthServiceStationComplete(lob: Lob, position: Position): Promise<boolean> {
    return this.isChecklistIconChecked(this.nthServiceStationUnder(lob, position));
  }

  /** Like openFirstServiceStation, but for LOBs with more than one service station per stop (confirmed needed for Vending, and for Market stops like FedEx's "Breakroom" + "Homestead Warehouse"). */
  async openNthServiceStation(lob: Lob, position: Position): Promise<void> {
    await this.clickLob(lob);
    await this.tap(this.nthServiceStationUnder(lob, position));
  }

  /** Whether a given position's service station row exists under the (already-expanded, or about-to-expand) LOB card - a quick presence check callers can use instead of eating openNthServiceStation's full tap timeout on a LOB with fewer stations than expected. */
  async isNthServiceStationVisible(lob: Lob, position: Position): Promise<boolean> {
    await this.clickLob(lob);
    return this.isVisible(this.nthServiceStationUnder(lob, position));
  }

  /**
   * From a location's detail screen (after clickLocationByPosition), expands
   * the given LOB's card and taps its first service station row. New method,
   * not ported from RF - built from this session's live navigation, since
   * BaseScreen.selectServiceLocation()/MarketServiceScreen.clickServiceLocation()
   * assume a different, unverified screen layout (a positional list after
   * just the LOB icon becomes visible) that doesn't match what was actually
   * walked through live.
   */
  async openFirstServiceStation(lob: Lob): Promise<void> {
    await this.clickLob(lob);
    await this.tap(this.firstServiceStationUnder(lob));
  }

  /**
   * Opens a location by its exact name rather than position - needed
   * because Route 10's stop ORDER keeps drifting day to day (documented
   * repeatedly elsewhere in this suite), and because a given account can
   * gain/lose LOBs between runs (e.g. FedEx's ad-hoc Coffee delivery),
   * making "the Nth stop" an unreliable way to reach a SPECIFIC account.
   */
  async clickLocationByName(name: string): Promise<void> {
    await this.ensurePendingActionTabSelected();
    const row = `//android.view.View[contains(@content-desc,"Pending action")]/following-sibling::android.view.View//*[@clickable="true" and @content-desc="${name}"]`;
    await this.tap(row);
  }

  /**
   * Like clickLocationByName(), but SCROLLS the schedule list to bring the row
   * into view first.
   *
   * clickLocationByName() only ever sees what Home currently renders, which is
   * a handful of rows - live-confirmed 2026-08-25 that Charlotte 103 carries
   * 49 stops, so any stop past the first few is simply unreachable by name
   * without this. Checks both tabs, since a stop moves to "Completed" once
   * serviced. Returns false rather than throwing when the stop genuinely is
   * not on the schedule, so callers can treat that as "does not qualify".
   */
  async scrollToAndClickLocationByName(name: string, maxScrolls = 25): Promise<boolean> {
    // NOT the tab-anchored following-sibling path clickLocationByName() uses:
    // the "Pending action" header itself scrolls out of the accessibility tree
    // as soon as the list moves, so that path can never match a scrolled-to
    // row. Live-confirmed 2026-08-25. A plain clickable+content-desc match is
    // what actually resolves; stop names are distinctive enough to be safe.
    const rowFor = (_tab: string) => `//*[@clickable="true" and @content-desc="${name}"]`;
    for (const tab of ['Pending action', 'Completed']) {
      await this.tap(`//android.view.View[contains(@content-desc,"${tab}")]`);
      await this.driver.pause(1_200);
      for (let i = 0; i < maxScrolls; i++) {
        if (await this.isVisible(rowFor(tab))) {
          await this.tap(rowFor(tab));
          return true;
        }
        await this.driver.executeScript('mobile: scrollGesture', [
          { left: 100, top: 600, width: 800, height: 1200, direction: 'down', percent: 0.8 }
        ]);
        await this.driver.pause(500);
      }
      // Restore the list to the top before trying the other tab - Home's own
      // "Deliveries" title scrolls off, and returnToHome() waits on it.
      for (let i = 0; i < maxScrolls; i++) {
        await this.driver.executeScript('mobile: scrollGesture', [
          { left: 100, top: 600, width: 800, height: 1200, direction: 'up', percent: 1.0 }
        ]);
      }
    }
    return false;
  }

  /** Market TC001 "view the list of market stops" - same row locator as clickLocationByName(), without tapping it. */
  async isLocationVisible(name: string): Promise<boolean> {
    await this.ensurePendingActionTabSelected();
    const row = `//android.view.View[contains(@content-desc,"Pending action")]/following-sibling::android.view.View//*[@clickable="true" and @content-desc="${name}"]`;
    return this.isVisible(row);
  }

  // TC039-TC051 (Start of The Day / Stop preview) - the screen
  // clickLocationByName()/clickLocationByPosition() land on. Live-verified
  // 2026-08-10 (Miami/Route 10, CureLeaf/market): heading badge reads
  // "Stop N of M", followed by the stop name, full address, an "About
  // this location" link, and "View schedule"/"Navigate" buttons, above
  // the LOB card(s).
  private readonly stopOverviewBadge = '//android.view.View[starts-with(@content-desc,"Stop ") and contains(@content-desc," of ")]';
  private readonly aboutThisLocationLink = '~About this location';
  private readonly closeButton = '~Close';
  private readonly viewScheduleButton = '~View schedule';
  // Market TC003 "view the service date" - live-verified 2026-08-10: the
  // Stop Overview screen's own date badge (e.g. "Yesterday, Sun 9 Aug") has
  // NO accompanying "Route X" text on this screen, so BaseScreen's shared
  // headerDateBadge/isDateRouteHeaderVisible() (anchored relative to the
  // route pill) don't match here - this locator anchors on the hamburger
  // button's position instead, which IS present on every screen.
  private readonly stopOverviewDateBadge =
    '//android.widget.Button[@content-desc="Open navigation menu"]/following-sibling::android.view.View[1]';
  // Market TC004 "view the service location name" - the stop's name is a
  // separate element directly above the address (see getStopHeaderText's
  // own note) - this is that name-only element, one level up.
  private readonly stopLocationName = `${this.stopOverviewBadge}/following-sibling::android.view.View[1]`;
  // Market TC003/M-TC-003 "view the delivery address" - CORRECTED
  // 2026-08-21: getStopHeaderText() below actually reads the "Stop N of M"
  // badge, not "location name + full address" as its own comment claims
  // (no assertion had ever checked its actual string content, only
  // length>0, so the mismatch went uncaught) - there was no real address
  // getter at all until now. Live-verified (Route 010/CureLeaf): the
  // address is a separate plain View immediately below stopLocationName
  // (e.g. "19000 SW 192nd St Miami Florida 33187-1908").
  private readonly stopLocationAddress = `${this.stopLocationName}/following-sibling::android.view.View[1]`;

  /** TC039 "view stop details" - the "Stop N of M" badge is the most reliable signal this screen (not some other) is showing. */
  async isStopOverviewVisible(): Promise<boolean> {
    return this.isVisible(this.stopOverviewBadge);
  }

  /** TC040 "view full address" - the location name + full address, both plain Views directly under the stop badge, live-verified as separate elements (name in a large bold style, address beneath it). */
  async getStopHeaderText(): Promise<string> {
    const el = await this.driver.$(this.stopOverviewBadge);
    return (await el.getAttribute('content-desc')) ?? '';
  }

  /** Market TC003 "view the service date" - assumes the Stop Overview screen is already open (clickLocationByName()). */
  async isStopOverviewDateVisible(): Promise<boolean> {
    return this.isVisible(this.stopOverviewDateBadge);
  }

  /** Market TC004 "view the service location name" - assumes the Stop Overview screen is already open. */
  async getStopLocationName(): Promise<string> {
    const el = await this.driver.$(this.stopLocationName);
    return (await el.getAttribute('content-desc')) ?? '';
  }

  /** Market TC003/M-TC-003 "view the delivery address" - assumes the Stop Overview screen is already open. */
  async getStopLocationAddress(): Promise<string> {
    const el = await this.driver.$(this.stopLocationAddress);
    return (await el.getAttribute('content-desc')) ?? '';
  }

  /** TC041 "click on About this location link" / opens a sheet titled "About this location" with the stop's name/address and a Close button. */
  async openAboutThisLocation(): Promise<void> {
    await this.tap(this.aboutThisLocationLink);
  }

  /**
   * Whether the "About this location" sheet is open - checks the Close
   * button rather than the "About this location" text itself, since that
   * exact content-desc appears BOTH on the Stop Overview screen's own
   * link (clickable) and the opened sheet's title (not clickable) -
   * ambiguous to match on alone. Close only exists while the sheet is
   * actually open.
   */
  async isAboutThisLocationVisible(): Promise<boolean> {
    return this.isVisible(this.closeButton);
  }

  /** TC042 "click on Close button" - dismisses the About-this-location sheet, returning to Stop Overview. */
  async closeAboutThisLocation(): Promise<void> {
    await this.tap(this.closeButton);
  }

  /** TC043 "click on View schedule" - live-verified: returns to Home/Schedule overview (the "schedule overview" the Excel's Outcome column refers to). */
  async tapViewSchedule(): Promise<void> {
    await this.tap(this.viewScheduleButton);
  }

  // TC046/048/050 (near-duplicate rows for Vending/Market/Coffee, same
  // outcome) - tapping a LOB card's service station row BEFORE Start Day
  // has been completed shows this gate popup instead of the task list
  // TC045/047/049 describe (that outcome needs Start Day already done -
  // out of scope for a Stop Preview-only test). Live-verified 2026-08-10:
  // titled "Start day" with a "Cancel"/"Start day" button pair - the
  // Excel calls the button "Go to start day", an app-terminology mismatch
  // (same class as TC022's "Actioned"/"Completed"), not a missing button.
  private readonly startDayGatePopupMessage = '//android.view.View[contains(@content-desc,"start day checks")]';

  async isStartDayGatePopupVisible(): Promise<boolean> {
    return this.isVisible(this.startDayGatePopupMessage);
  }

  /** TC051 "click on 'start day' button" - the gate popup's own confirm button; live-verified this navigates to the Prep Task screen ("Start day, Route X", the same pre-screen HomeScreen.tapStartDay() reaches). */
  async confirmStartDayFromGatePopup(): Promise<void> {
    await this.tap(this.startDayButton);
  }

  async cancelStartDayGatePopup(): Promise<void> {
    await this.tap('~Cancel');
  }

  /** Whether the given LOB's card is present at all on the current location-detail screen - distinct from clickLob (which assumes it exists and expands it). */
  async isLobCardVisible(lob: Lob): Promise<boolean> {
    return this.isVisible(this.lobSelector(lob));
  }

  /** Market TC007 "view the Market dropdown" - the LOB tile's own content-desc (e.g. "market\n1 Service stations "), a real station-count + dropdown-arrow tile regardless of how many stations that count actually is. Assumes the Stop Overview screen is already open. */
  async getLobCardText(lob: Lob): Promise<string> {
    const el = await this.driver.$(this.lobSelector(lob));
    return (await el.getAttribute('content-desc')) ?? '';
  }

  /** Market TC008 "open the list of service stations" - expands the LOB card (clickLob()) and returns every visible station row's content-desc. */
  async getServiceStationNames(lob: Lob): Promise<string[]> {
    await this.clickLob(lob);
    const rows = await this.driver.$$(`//android.view.View[contains(@content-desc,"${lob}")]`);
    const names: string[] = [];
    for (const row of rows) {
      names.push((await row.getAttribute('content-desc')) ?? '');
    }
    return names;
  }

  // The "Pending action (N)" tab pill itself - live-verified 2026-08-07:
  // deliveryLocationList's xpath anchors on this SAME element regardless
  // of which tab (Pending action / Completed) is currently selected, since
  // the tab pill's own text never changes - only the content pane below it
  // swaps between the two lists. Under KEEP_APP_SESSION, whichever tab a
  // PREVIOUS test/probe last selected stays selected into this one -
  // confirmed live this silently made getLocationCount()/
  // clickLocationByPosition read the Completed list (and click an
  // already-done stop) while believing they were on Pending action, with
  // no error until a downstream assertion failed confusingly far away.
  private readonly pendingActionTab = '//android.view.View[contains(@content-desc,"Pending action")]';

  /** Explicitly selects the "Pending action" tab - defensive against a stale Completed-tab selection carried over from an earlier test under KEEP_APP_SESSION (see pendingActionTab's own doc comment). */
  async ensurePendingActionTabSelected(): Promise<void> {
    await this.tap(this.pendingActionTab);
  }

  /** TC021 "view Pending action tab" - the tab pill itself is present regardless of which one is currently selected. */
  async isPendingActionTabVisible(): Promise<boolean> {
    return this.isVisible(this.pendingActionTab);
  }

  // The second tab pill, live-verified 2026-08-10: labeled "Completed" in
  // this build (e.g. "Completed (0)") - the Excel's TC022 calls it
  // "Actioned", an app-terminology mismatch (same class as other TCs'
  // stale wording elsewhere), not a missing feature.
  private readonly completedTab = '//android.view.View[contains(@content-desc,"Completed")]';

  /** TC022 "view Actioned tab" (this build labels it "Completed") - present regardless of which tab is currently selected. */
  async isCompletedTabVisible(): Promise<boolean> {
    return this.isVisible(this.completedTab);
  }

  // Live-verified 2026-08-07: a genuinely empty Pending action tab renders
  // "No Pending Task" instead of any location row - deliveryLocationList's
  // waitFor() then times out and throws, since there's nothing to wait
  // for. getLocationCount() checks for this text first so a legitimately
  // empty day returns 0 instead of throwing.
  private readonly noPendingTaskMessage = '~No Pending Task';

  async getLocationCount(): Promise<number> {
    await this.ensurePendingActionTabSelected();
    if (await this.isVisible(this.noPendingTaskMessage)) {
      return 0;
    }
    await this.waitFor(this.deliveryLocationList);
    const elements = await this.driver.$$(this.deliveryLocationList);
    const count = await elements.length;
    return count;
  }

  /**
   * Ported from "Click on the ${position} location" - uses 0-based direct
   * array indexing (RF's "Convert position to index value" keyword), unlike
   * BaseScreen.selectServiceLocation's 1-based XPath predicate.
   */
  async clickLocationByPosition(position: Position): Promise<void> {
    await this.ensurePendingActionTabSelected();
    await this.waitFor(this.deliveryLocationList);
    const elements = await this.driver.$$(this.deliveryLocationList);
    const index = positionToIndex(position, 0);
    await elements[index].click();
  }

  /**
   * Taps the LOB card header to expand it - made idempotent (CORRECTED
   * 2026-07-24): this header is a toggle, not an open-only trigger. With a
   * fresh login per test (the old default), the card always started
   * collapsed, so a single tap always meant "expand." Once a shared session
   * revisits the same stop across multiple tests (see
   * vending-service.spec.ts), the card's expand state persists from the
   * previous test - tapping an already-expanded card collapses it instead,
   * live-verified to break the very next station lookup. Checks whether the
   * first station row is already visible before tapping at all.
   */
  async clickLob(lob: Lob): Promise<void> {
    const alreadyExpanded = await this.isVisible(this.nthServiceStationUnder(lob, 'first'));
    if (alreadyExpanded) {
      return;
    }
    await this.tap(this.lobSelector(lob));
  }

  private readonly completeStopButton = '~Complete Stop';

  /**
   * Excel TC308-TC310 (Menu End Day) precondition: a service station row can
   * be swiped left to reveal a skip icon (an unlabeled android.widget.Button
   * child of the row itself, live-verified 2026-08-05 - same
   * swipe-reveals-a-child-Button pattern already proven for Transfers'
   * product/route delete icons), which opens the "Skip stop" bottom sheet.
   * Assumes the LOB card is already expanded (clickLob) and the target row
   * is on-screen.
   */
  async swipeAndSkipServiceStation(lob: Lob, position: Position): Promise<void> {
    await this.clickLob(lob);
    const row = this.nthServiceStationUnder(lob, position);
    const el = await this.driver.$(row);
    await el.waitForDisplayed({ timeout: 15_000 });
    const loc = await el.getLocation();
    const size = await el.getSize();
    await this.swipe(loc.x + size.width - 10, loc.y + size.height / 2, loc.x + 10, loc.y + size.height / 2);
    await this.tap(`${row}/android.widget.Button`);
  }

  /**
   * Removes the Nth service station - and with it its delivery - from the
   * currently-open stop overview. Returns false when there is no such row, so
   * callers can use it as a "clean up if a previous run left this behind"
   * precondition rather than having to probe first.
   *
   * SAME swipe-reveals-an-unlabelled-Button mechanic as
   * swipeAndSkipServiceStation() above, but NOT the same outcome, and the two
   * must not be merged on that resemblance. Live-verified 2026-08-27 against
   * an ad-hoc Coffee delivery (American Airlines / Josh Birmingham Pkwy on
   * Charlotte 103): tapping this Button DELETES immediately - no "Skip stop"
   * bottom sheet, no confirmation dialog of any kind - Home's delivery count
   * drops by one, and the emptied stop itself disappears on a later refresh.
   * Whether a row's Button skips or deletes is therefore contextual, so assert
   * the outcome you expect instead of trusting the gesture.
   *
   * Uses revealRowDeleteResilient() rather than swipeAndSkipServiceStation's
   * single fast swipe: this row needed the SLOW gesture when driven by hand,
   * and which rows need which is not predictable per screen (see that
   * helper's own note).
   *
   * PROVEN 2026-08-27 by SD-TC-024's cleanup step, which creates an ad-hoc
   * delivery and then deletes it, asserting the route returns to 0
   * deliveries. Works reliably in the SAME session that created the stop.
   */
  async deleteNthServiceStation(lob: Lob, position: Position): Promise<boolean> {
    await this.clickLob(lob);
    const row = this.nthServiceStationUnder(lob, position);
    if (!(await this.isVisible(row))) {
      return false;
    }
    if (!(await this.revealRowDeleteResilient(row))) {
      return false;
    }
    await this.tapRowDeleteIcon(row);
    return true;
  }

  /** Whether "Complete Stop" is available on the current location-detail screen (present once every checklist tile - including any just-skipped station - is done). */
  async isCompleteStopVisible(): Promise<boolean> {
    return this.isVisible(this.completeStopButton);
  }

  /**
   * Whether "Complete Stop" is both visible AND enabled - live-verified
   * 2026-08-05 that a stop with 2+ service stations under one LOB (e.g.
   * FedEx's Market card: "Breakroom" + "Homestead Warehouse") shows this
   * button the whole time, but greyed out/disabled until EVERY station is
   * actioned, not just the first. isCompleteStopVisible() alone can't tell
   * these apart - a tap on the disabled button silently no-ops.
   */
  async isCompleteStopEnabled(): Promise<boolean> {
    return this.isEnabled(this.completeStopButton);
  }

  /** Taps "Complete Stop" on the current location-detail screen. */
  async tapCompleteStop(): Promise<void> {
    await this.tap(this.completeStopButton);
  }
}
