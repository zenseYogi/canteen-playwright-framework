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
    // numeric badge (content-desc "0", live-verified) - not a service
    // station row at all. Actual station rows start at the second sibling.
    const index = positionToIndex(position, 1) + 1;
    return `//android.widget.ImageView[starts-with(@content-desc,"${lob}")]/following-sibling::android.view.View[${index}]`;
  }

  /** Like openFirstServiceStation, but for LOBs with more than one service station per stop (confirmed needed for Vending, and for Market stops like FedEx's "Breakroom" + "Homestead Warehouse"). */
  async openNthServiceStation(lob: Lob, position: Position): Promise<void> {
    await this.clickLob(lob);
    await this.tap(this.nthServiceStationUnder(lob, position));
  }

  private serviceStationByName(lob: Lob, stationName: string): string {
  return `//android.widget.ImageView[starts-with(@content-desc,"${lob}")]
          /following-sibling::android.view.View[contains(@content-desc,"${stationName}")]`;
}
  // async openServiceStationByName(
  //   lob: Lob,
  //   stationName: string
  // ): Promise<void> {
  //   await this.clickLob(lob);
  //   const locator = this.serviceStationByName(lob, stationName);
  //   const station = await this.driver.$(locator);
  //   await station.waitForDisplayed({ timeout: 10000 });
  //   await station.click();
  // }
  





async openServiceStationByName(
  lob: Lob,
  stationName: string
): Promise<void> {
  await this.clickLob(lob);
  const targetLocator = `//android.view.View[contains(@content-desc,"${stationName}")]`;
  // const stationRows =
  //   `//android.widget.ImageView[contains(@content-desc,"${stationName}")]`;
    const stationRows =
  '//android.widget.ScrollView//android.view.View[@clickable="true"]';
  let previousLastStation = '';
  for (let i = 0; i < 15; i++) {
    const stations = await this.driver.$$(targetLocator);
    if (await stations.length > 0 && await stations[0].isDisplayed()) {
      await stations[0].click();
      return;
    }
    const visibleStations = await this.driver.$$(stationRows);
    if (await visibleStations.length === 0) {
      break;
    }
    const lastStation =
      visibleStations[await visibleStations.length - 1];
    const lastStationName =
      (await lastStation.getAttribute('content-desc')) ?? '';

    // Reached end of list
    if (lastStationName === previousLastStation) {
      break;
    }
    previousLastStation = lastStationName;
    await this.swipe(
      540, 1900,
      540, 1200
    );
    await this.driver.pause(800);
  }
  throw new Error(
    `Service Station "${stationName}" not found`
  );
}


async waitForServiceStationVisible(
  lob: Lob,
  stationName: string,
  maxScrolls: number = 15
): Promise<boolean> {
  await this.clickLob(lob);

  const targetLocator =
    `//android.view.View[contains(@content-desc,"${stationName}")]`;

  const stationRows =
    '//android.widget.ScrollView//android.view.View[@clickable="true"]';

  let previousLastStation = '';

  for (let i = 0; i < maxScrolls; i++) {
    const found = await this.driver.waitUntil(
      async () => {
        const stations = await this.driver.$$(targetLocator);
        return await stations.length > 0 &&
          await stations[0].isDisplayed();
      },
      {
        timeout: 3000,
        interval: 500,
        timeoutMsg: ''
      }
    ).then(() => true).catch(() => false);

    if (found) {
      return true;
    }

    const visibleStations = await this.driver.$$(stationRows);

    if (await visibleStations.length === 0) {
      break;
    }

    const lastStation = visibleStations[await visibleStations.length - 1];
    const lastStationName =
      (await lastStation.getAttribute('content-desc')) ?? '';

    if (lastStationName === previousLastStation) {
      break;
    }

    previousLastStation = lastStationName;

    await this.swipe(
      540, 1900,
      540, 1200
    );

    await this.driver.pause(1000);
  }

  return false;
}


  async getNthServiceStationName(
    lob: Lob,
    position: Position
  ): Promise<string> {
    await this.clickLob(lob);
    const locator = this.nthServiceStationUnder(lob, position);
    const station = await this.driver.$(locator);
    const stationName =
      (await station.getAttribute('content-desc')) ?? '';
    // await station.click();
    return stationName.split('\n')[0].trim();
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
  // async clickLocationByName(name: string): Promise<void> {
  //   await this.ensurePendingActionTabSelected();
  //   const row = `//android.view.View[contains(@content-desc,"Pending action")]/following-sibling::android.view.View//*[@clickable="true" and @content-desc="${name}"]`;
  //   await this.tap(row);
  // }

  async clickLocationByName(name: string): Promise<void> {
  await this.ensurePendingActionTabSelected();

  const targetLocator =
    `//android.widget.ImageView[contains(@content-desc,"${name}")]`;

  const locationRows =
    '//android.widget.ImageView[@clickable="true"]';

  let previousLastItem = '';

  for (let i = 0; i < 30; i++) {
    const target = await this.driver.$$(targetLocator);

    if (await target.length > 0 && await target[0].isDisplayed()) {
      await target[0].click();
      return;
    }

    const visibleLocations = await this.driver.$$(locationRows);
    if (await  visibleLocations.length === 0) {
      break;
    }

    const lastItem =
      visibleLocations[await visibleLocations.length - 1];

    const lastItemName =
      (await lastItem.getAttribute('content-desc')) ?? '';

    // End of list
    if (lastItemName === previousLastItem) {
      break;
    }

    previousLastItem = lastItemName;

    // Smaller swipe so the last visible item
    // approximately becomes the first visible item
    await this.swipe(
      540, 1900,
      540, 1200
    );

    await this.driver.pause(800);
  }

  throw new Error(
    `Location "${name}" not found in Pending Actions list`
  );
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
