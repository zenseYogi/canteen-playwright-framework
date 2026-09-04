import { BaseScreen } from './base.screen';
import { mobileConfig } from '../config/mobile.config';
import type { Lob } from '../utils/lob';

/**
 * Truck Stock > Truck returns. Ported from truck_stock_truck_returns.robot.
 *
 * RF's own keywords for this screen were inconsistent about the nav
 * preamble: the very first navigation into Truck Stock in a suite expanded
 * the collapsible "Truck stock" group first, but later keywords in the same
 * suite skipped that tap - because RF's Suite Setup opens the app once and
 * every test case in the file reuses that same session/nav-menu state.
 * Every Playwright test gets a fresh app session (see appium.fixture.ts's
 * `pm clear` before each test), so the nav menu always starts collapsed -
 * `open()` here always does the full expand-then-navigate sequence.
 */
export class TruckStockTruckReturnsScreen extends BaseScreen {
  // Both the nav menu button and the screen title share the content-desc
  // "Truck returns" - kept as distinct widget-typed xpaths (Button vs View)
  // rather than one `~Truck returns` accessibility-id lookup, since that
  // shorthand can't disambiguate between them if both exist in the view
  // hierarchy at the same time (e.g. a nav drawer that stays mounted while closed).
  private readonly navMenuTruckReturns = '//android.widget.Button[@content-desc="Truck Returns"]';
  private readonly truckReturnsTitle = '//android.view.View[@content-desc="Truck Returns"]';

  // Truck Returns' own tabs use lowercase content-desc ("coffee"/"market"),
  // the same mismatch already found on Transfers' tabs - the shared
  // lobTabSelector()/coffeeTab/marketTab constants are capitalized for a
  // different screen's LOB cards and don't match here.
  private readonly lowercaseLobTab = (lob: Lob) => `//android.view.View[@content-desc="${lob}"]`;

  // Overrides BaseScreen's `searchList` (a `ScrollView/View/View` structural
  // path): live-verified 2026-08-04 that Truck Returns' Search product sheet
  // only wraps its results in a ScrollView when there are enough of them to
  // scroll - a single-match search (e.g. "jaggery") renders its one result
  // in a plain, non-scrollable View instead, so the base locator silently
  // matches zero elements and searchAndSelect() throws on `options[0]`
  // being undefined. This locator instead matches on content, not container
  // type, so it works regardless of result count.
  // protected readonly searchList = '//android.view.View[@clickable="true" and contains(@content-desc,"pkg:")]';

  private readonly addProductTitle = '//android.view.View[@content-desc="Add product"]';
  // The Add Product screen's Damaged/Spoiled fields have no content-desc,
  // hint, or resource-id at all (confirmed live 2026-08-04 via uiautomator
  // dump) - only distinguishable by their left-to-right position, so a
  // plain positional xpath is the only viable locator (the old deeply-
  // nested structural path from the RF port had drifted and no longer
  // matched anything). CRITICAL: tapping the field opens the SAME custom
  // numeric keypad as Transfers' quantity field (digit buttons 0-9, -/+,
  // and a content-desc-less confirm checkmark) - `type()`/`setValue()`
  // silently does nothing here (confirmed live: the field stayed visibly
  // empty and the product never appeared on the Truck Returns list). Must
  // tap the field to open the keypad, then tap digit buttons, then confirm.
  private readonly addProductDamagedField = '(//android.widget.EditText)[1]';
  private readonly qtyKeypadDigit = (digit: number) => `//android.widget.Button[@content-desc="${digit}"]`;
  private readonly qtyKeypadConfirm = '(//android.widget.Button)[last()]';
  private readonly addedProducts = '//android.view.View[@text="1"]';
  // The RF-ported deeply-nested structural xpath had drifted and no longer
  // matched anything (confirmed live 2026-08-04). Real structure: the swipe-
  // revealed delete button is a FOLLOWING SIBLING of the product row itself
  // (both children of the same parent), not nested inside it - so the
  // locator walks from the matched row to its next Button sibling. The
  // 0-based matched array index from swipeAndDeleteByLabel needs +1 for the
  // 1-based XPath positional predicate.
  private readonly deleteIconAt = (index: number) =>
    `(//android.view.View[@text="1"])[${index + 1}]/following-sibling::android.widget.Button[1]`;

  private readonly lookUpProductField = '//android.widget.EditText[@hint="Look up product"]';
  private readonly infoPaneHeading = '//android.view.View[@content-desc="Record Individual Truck Returns"]';
  private readonly infoPaneBody =
    '//android.view.View[@content-desc="This service stop does not have requested truck returns. Please add truck returns individually to accurately reflect inventory."]';

  /** Excel TC298 - taps the hamburger icon and reports whether "Truck stock" and its Truck returns/Route Inventory/Route shopping sub-items, plus the sibling "Transfers" item, are all visible. Finishes by tapping "Truck returns" to land on that screen (equivalent to open()), so a subsequent open() call is a no-op rather than fighting an already-open drawer. */
  async isTruckStockMenuVisible(): Promise<{
    truckStock: boolean;
    truckReturns: boolean;
    routeInventory: boolean;
    routeShopping: boolean;
    transfers: boolean;
  }> {
    await this.tap(this.hamburgerIcon);
    if (await this.isVisible(this.navMenuTruckStockCollapsed)) {
      await this.tap(this.navMenuTruckStockCollapsed);
    }
    const result = {
      truckStock: await this.isVisible('//android.view.View[contains(@content-desc,"Truck Stock")]'),
      truckReturns: await this.isVisible(this.navMenuTruckReturns),
      routeInventory: await this.isVisible('//android.widget.Button[@content-desc="Route Inventory"]'),
      routeShopping: await this.isVisible('//android.widget.Button[@content-desc="Route Shopping"]'),
      transfers: await this.isVisible('//android.widget.Button[@content-desc="Transfers"]')
    };
    await this.tap(this.navMenuTruckReturns);
    await this.waitFor(this.truckReturnsTitle);
    return result;
  }

  /** Excel TC299 - which of the Truck Returns tabs (coffee/market/vending) are currently visible. Assumes open() was already called. */
  async getVisibleLobTabs(): Promise<{ coffee: boolean; market: boolean; vending: boolean }> {
    return {
      coffee: await this.isVisible(this.lowercaseLobTab('coffee')),
      market: await this.isVisible(this.lowercaseLobTab('market')),
      vending: await this.isVisible(this.lowercaseLobTab('vending'))
    };
  }

  /** Excel TC299/TC300 - whether the "Look up product" search field, its search/scanner icon pair, and the "Record Individual Truck Returns" info pane are all visible. Assumes open() was already called. */
  async isSearchAreaVisible(): Promise<{ searchField: boolean; icons: boolean; infoHeading: boolean; infoBody: boolean }> {
    const icons = await this.driver.$$('//android.widget.ImageView');
    return {
      searchField: await this.isVisible(this.lookUpProductField),
      icons: (await icons.length) >= 2,
      infoHeading: await this.isVisible(this.infoPaneHeading),
      infoBody: await this.isVisible(this.infoPaneBody)
    };
  }

  async open(): Promise<void> {
    // No-op if already on this screen - addProduct()/deleteProduct() both
    // call open() defensively, and re-tapping the hamburger + an already-
    // expanded "Truck stock" group + an already-active nav item is a real,
    // reproducible source of intermittent timeouts (confirmed live
    // 2026-08-04: the drawer's re-navigation sometimes silently no-ops when
    // the destination is already showing, leaving the next waitFor stuck).
    if (await this.isVisible(this.truckReturnsTitle)) {
      return;
    }
    await this.tap(this.hamburgerIcon);
    // "Truck stock" only needs expanding if it isn't already - a nav menu
    // opened a second time in the same session (e.g. addProduct()/
    // deleteProduct() re-calling open()) can land with the group already
    // expanded, in which case this collapsed-state node no longer exists.
    if (await this.isVisible(this.navMenuTruckStockCollapsed)) {
      await this.tap(this.navMenuTruckStockCollapsed);
    }
    await this.waitFor(this.navMenuTruckReturns);
    await this.tap(this.navMenuTruckReturns);
    await this.waitFor(this.truckReturnsTitle);
  }

  /** Adds a product under the given LOB tab and returns its resolved name (feed straight into deleteProduct). */
  async addProduct(lob: Lob, searchTerm: string): Promise<string> {
    await this.open();
    await this.tap(this.lowercaseLobTab(lob));
    await this.tap(this.addProductButton);
    const productName = await this.searchAndSelect(searchTerm);
    await this.waitFor(this.addProductTitle);
    await this.tap(this.addProductDamagedField);
    await this.tap(this.qtyKeypadDigit(1));
    await this.tap(this.qtyKeypadConfirm);
    await this.tap(this.doneButton);
    // Without this, the screen-transition animation back to Truck Returns
    // can still be mid-flight when deleteProduct() immediately re-taps the
    // hamburger icon in the same test, intermittently leaving the nav
    // drawer's "Truck returns" tap a no-op and the subsequent waitFor
    // timing out (confirmed live 2026-08-04 - re-running the identical
    // sequence with a manual pause between steps never reproduced it).
    await this.waitFor(this.truckReturnsTitle);
    return productName;
  }

  

  /**
   * Deletes a previously-added product. `productName` is accepted for call-
   * site symmetry with addProduct() but is NOT used to match the row -
   * live-verified 2026-08-04 that searchAndSelect()'s resolved catalog name
   * ("24 Mantra Organic Jaggery Powder (1lb)") does not literally contain
   * the Truck Returns list's own abbreviated display hint ("24Mantra
   * OrgJaggeryPwdr 1lb"), so swipeAndDeleteByLabel()'s substring match
   * throws "no element with a hint matching" even though the row is right
   * there. Since this method is only ever used to remove the single product
   * this same test just added, swiping the first (only) row is equivalent
   * and avoids the mismatch entirely.
   */
  async deleteProduct(lob: Lob, _productName: string): Promise<void> {
    await this.open();
    await this.tap(this.lowercaseLobTab(lob));
    const row = await this.driver.$(this.addedProducts);
    await row.waitForExist({ timeout: mobileConfig.timeouts.element });
    const loc = await row.getLocation();
    const size = await row.getSize();
    await this.swipe(loc.x + size.width - 10, loc.y + size.height / 2, loc.x + 10, loc.y + size.height / 2);
    await this.tap(this.deleteIconAt(0));
    await this.tap(this.deleteButton);
  }
}
