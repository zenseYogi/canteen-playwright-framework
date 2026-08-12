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
  private readonly deliveryLocationList =
    '//android.view.View[contains(@content-desc,"Pending action")]/following-sibling::android.view.View//android.widget.ImageView[@clickable="true"]';

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

  /** Like openFirstServiceStation, but for LOBs with more than one service station per stop (confirmed needed for Vending). */
  async openNthServiceStation(lob: Lob, position: Position): Promise<void> {
    await this.clickLob(lob);
    await this.tap(this.nthServiceStationUnder(lob, position));
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

  async getLocationCount(): Promise<number> {
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
}
