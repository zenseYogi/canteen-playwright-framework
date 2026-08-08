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

  /** Whether the given LOB's card is present at all on the current location-detail screen - distinct from clickLob (which assumes it exists and expands it). */
  async isLobCardVisible(lob: Lob): Promise<boolean> {
    return this.isVisible(this.lobSelector(lob));
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
