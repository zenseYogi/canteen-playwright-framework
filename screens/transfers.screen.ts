import { BaseScreen } from './base.screen';
import { mobileConfig } from '../config/mobile.config';
import type { Lob } from '../utils/lob';

type TransferType = 'routeToRoute' | 'routeToWarehouse';

/**
 * Transfers screen. Ported from transfers.robot, which unrolled a
 * {Coffee,Market,Vending} x {Route to Route,Route to Warehouse} x
 * {Add,Add N,Edit+Add,Edit+Delete,Delete route} matrix into ~30 near-
 * identical keywords. Collapsed here into a handful of parameterized
 * methods - see docs/rf-to-playwright-reuse.md.
 */
export class TransfersScreen extends BaseScreen {
  // Same content-desc ("Transfers") on both the nav button and the screen
  // title - kept as distinct widget-typed xpaths, same reasoning as
  // TruckStockTruckReturnsScreen's nav-item-vs-title pair.
  private readonly navMenuTransfers = '//android.widget.Button[@content-desc="Transfers"]';
  private readonly transfersTitle = '//android.view.View[@content-desc="Transfers"]';

  private readonly routeToRouteTab = '~Route to Route';
  private readonly routeToWarehouseTab = '~Route to Warehouse';
  private readonly routeToWarehouse = '//android.view.View[contains(@content-desc,"To Warehouse")]';
  private readonly noTransfersYetMessage = '~No transfers yet.';
  private readonly noTransfersYetInfo =
    '~This is where all your product transfers will appear once created.';
  private readonly selectRouteTitle = '~Select Route';
  private readonly cancelButton = '~Cancel';
  // transfers.yaml declared route_to_click_on_to_modify and
  // route_to_warehouse_to_delete as the exact same xpath under two names -
  // collapsed into one template here.
  private readonly routeRow = (label: string) => `//android.view.View[contains(@content-desc,"${label}")]`;
  private readonly firstAddedProduct = '(//android.widget.EditText[@text="1"])[1]';
  // Deliberately NOT the same as BaseScreen.backButton - transfers.yaml
  // declares this as a bare, generic //android.widget.Button (matches the
  // first Button on screen), unlike back_button's deep structural path. See
  // docs/rf-to-playwright-reuse.md's Phase 3/4 notes for the correction.
  private readonly transferToScreenBackButton = '//android.widget.Button';
  // RTR (Route-to-Route) Details screen - reached by tapping an existing
  // route card on the Transfers landing page. Neither the search icon nor
  // the scanner icon carries a content-desc - both are bare ImageViews
  // rendered as the search EditText's two following siblings (search icon
  // first/overlaid on its left edge, scanner icon second/on its right),
  // matched positionally rather than by any a11y label.
  private readonly rtrDetailsHeading = (routeLabel: string) => `~Transfer to - ${routeLabel}`;
  private readonly rtrSearchIcon = '//android.widget.EditText/following-sibling::android.widget.ImageView[1]';
  private readonly rtrScannerIcon = '//android.widget.EditText/following-sibling::android.widget.ImageView[2]';
  private readonly noProductsRecordedMessage = '~No products recorded';
  // Search product bottom sheet - opened by typing (not merely tapping)
  // into the RTR Details search field. TC105 confirmed live 2026-08-04:
  // the field uses the REAL Android soft keyboard (a standard qwerty IME),
  // not a custom in-app keypad - so "opens the alphabet keypad" is
  // satisfied simply by the system keyboard appearing on focus.
  private readonly searchProductSheetTitle = '~Search product';
  private readonly noSearchResultsFoundMessage = '~No search results found';
  // The barcode-scanner screen's only labeled element is its "Continue"
  // button - the camera preview itself carries no content-desc.
  private readonly scannerContinueButton = '~Continue';
  // The quantity field's custom keypad - live-verified 2026-08-04. Unlike
  // firstAddedProduct (which matches `@text="1"` and stops matching once
  // the quantity changes), this locator tracks the field by its `hint`
  // regardless of current value, so it stays valid across edits.
  private readonly qtyField = '//android.widget.EditText[contains(@hint,"Qty")]';
  private readonly qtyKeypadDigit = (digit: number) => `//android.widget.Button[@content-desc="${digit}"]`;
  // "-"/"+" are decrement/increment buttons, not literal minus/plus-sign
  // text entry - live-verified 2026-08-04.
  private readonly qtyKeypadDecrement = '//android.widget.Button[@content-desc="-"]';
  // The keypad's confirm checkmark carries no content-desc of its own.
  // CORRECTED after a live mis-tap: it is NOT the "+" key's next DOM
  // sibling (that's actually the backspace icon - the keypad's four
  // action icons, up/down/backspace/checkmark, are declared out of
  // visual row order, with backspace and checkmark both appearing AFTER
  // all digit/sign buttons). It reliably IS the very last
  // `android.widget.Button` on the page - confirmed via live DOM dump.
  private readonly qtyKeypadConfirm = '(//android.widget.Button)[last()]';

  private routeTabItem(routeNumber: number): string {
    const label = `Route ${String(routeNumber).padStart(3, '0')}`;
    return `//android.view.View[@content-desc="${label}"]`;
  }

  async open(): Promise<void> {
    await this.tap(this.hamburgerIcon);
    await this.waitFor(this.navMenuTransfers);
    await this.tap(this.navMenuTransfers);
    await this.waitFor(this.transfersTitle);
  }

  /** Excel TC084 - whether the Transfers screen's own title is showing (assumes open() was already called). */
  async isTransfersTitleVisible(): Promise<boolean> {
    return this.isVisible(this.transfersTitle);
  }

  /** Excel TC086/TC087 - the hamburger menu icon and the header's own plus (+) icon, both live-verified 2026-08-03 on the Transfers landing page. */
  async isHeaderIconsVisible(): Promise<{ hamburger: boolean; plus: boolean }> {
    return {
      hamburger: await this.isVisible(this.hamburgerIcon),
      plus: await this.isVisible(this.addProductButton)
    };
  }

  // CORRECTED (live-verified 2026-08-03): BaseScreen's own lobTabSelector
  // uses capitalized "Coffee"/"Market"/"Vending" - this screen's real tabs
  // are lowercase ("coffee"/"market"/"vending"), same capitalization
  // mismatch already documented elsewhere in this app (e.g. Dashboard's
  // own lowercase "market" LOB card). Not reusing the shared helper here.
  private readonly lowercaseLobTab = (lob: 'coffee' | 'market' | 'vending') =>
    `//android.view.View[@content-desc="${lob}"]`;

  /** Excel TC085 - the Transfers landing page's per-LOB tabs and Route to Route/Route to Warehouse tab pair, live-verified 2026-08-03. */
  async isLandingPageVisible(): Promise<{
    coffee: boolean;
    market: boolean;
    vending: boolean;
    routeToRoute: boolean;
    routeToWarehouse: boolean;
  }> {
    return {
      coffee: await this.isVisible(this.lowercaseLobTab('coffee')),
      market: await this.isVisible(this.lowercaseLobTab('market')),
      vending: await this.isVisible(this.lowercaseLobTab('vending')),
      routeToRoute: await this.isVisible(this.routeToRouteTab),
      routeToWarehouse: await this.isVisible(this.routeToWarehouseTab)
    };
  }

  /** Excel TC090 - the empty-state "No transfers yet." message and its explanatory line (assumes open() was already called, and the current LOB/tab has no transfers). */
  async isEmptyStateMessageVisible(): Promise<boolean> {
    return (await this.isVisible(this.noTransfersYetMessage)) && (await this.isVisible(this.noTransfersYetInfo));
  }

  /** Excel TC091 - tapping the header's plus icon opens the "Select Route" bottom sheet (assumes open() was already called). */
  async openSelectRouteSheet(): Promise<void> {
    await this.tap(this.addProductButton);
    await this.waitFor(this.selectRouteTitle);
  }

  /** Whether the "Select Route" bottom sheet opened by openSelectRouteSheet() is showing. */
  async isSelectRouteSheetVisible(): Promise<boolean> {
    return this.isVisible(this.selectRouteTitle);
  }

  /** Excel TC092 - a given route label (e.g. "Route 1") is present in the open Select Route sheet. Real route labels here are bare numbers ("Route 1", "Route 18", "Route 100"), NOT the zero-padded "Route 001" tiles used elsewhere in this file for an already-created transfer. */
  async isRouteOptionVisible(routeLabel: string): Promise<boolean> {
    return this.isVisible(`//android.view.View[@content-desc="${routeLabel}"]`);
  }

  /** Excel TC092 - at least one real route is listed in the open Select Route sheet, without assuming any specific route is still assignable (see selectFirstAvailableRoute()'s own note on why). */
  async isAnyRouteOptionVisible(): Promise<boolean> {
    return this.isVisible(this.anyRouteOption);
  }

  /** Excel TC093 - taps a route in the open Select Route sheet, creating a new (empty) route-to-route transfer for it. */
  async selectRoute(routeLabel: string): Promise<void> {
    await this.tap(`//android.view.View[@content-desc="${routeLabel}"]`);
  }

  // The Select Route sheet's own list of assignable routes is real backend
  // data and drifts across runs/days (same class of instability already
  // documented for stop ordering elsewhere in this suite) - a hardcoded
  // label like "Route 1" or "Route 18" can silently stop being offered
  // (already in use, reassigned, etc.), breaking every test that assumes
  // it. Picking whichever route is actually first, at runtime, removes
  // this entire class of flakiness.
  private readonly anyRouteOption = '//android.view.View[starts-with(@content-desc,"Route ")]';

  /** Taps whichever route is first in the open Select Route sheet and returns its real label (e.g. "Route 18"), instead of assuming a specific hardcoded route is still assignable. */
  async selectFirstAvailableRoute(): Promise<string> {
    const options = await this.driver.$$(this.anyRouteOption);
    const first = options[0];
    await first.waitForDisplayed({ timeout: mobileConfig.timeouts.element });
    const label = (await first.getAttribute('content-desc')) ?? '';
    await first.click();
    return label;
  }

  /** Excel TC093 - whether the Transfers landing page shows the given route's card with the given product count (both live inside a single combined content-desc: "To Route\nRoute 1\nTotal Products\n0"). */
  async isRouteCardVisibleWithProductCount(routeLabel: string, productCount: number): Promise<boolean> {
    return this.isVisible(
      `//android.view.View[contains(@content-desc,"${routeLabel}") and contains(@content-desc,"Total Products") and contains(@content-desc,"${productCount}")]`
    );
  }

  /** Whether the Transfers landing page's empty state is showing for the currently-active tab (assumes the desired LOB/transfer-type tab was already tapped). */
  async switchToTransferType(transferType: TransferType): Promise<void> {
    await this.tap(transferType === 'routeToRoute' ? this.routeToRouteTab : this.routeToWarehouseTab);
  }

  /** Taps a LOB tab (coffee/market/vending) on the Transfers landing page (assumes open() was already called). */
  async switchToLob(lob: Lob): Promise<void> {
    await this.tap(this.lowercaseLobTab(lob));
  }

  // Excel TC138/TC139/TC145 - live-verified 2026-08-04: this account has
  // exactly ONE permitted warehouse ("Charlotte"). Tapping the plus icon
  // does NOT show a separate warehouse-selection screen at all in that
  // case - it goes straight from tap to an already-created "To Warehouse"
  // card with 0 products. This diverges from the Excel's literal wording
  // ("navigate to warehouse selection screen") but matches exactly what
  // the pre-existing (never-verified) addProduct() RTW branch already
  // assumed: routeToWarehouse (the card's own locator) is what gets
  // tapped next to enter its Details screen, not a picker tile. With only
  // one warehouse assigned, there's nothing to demonstrate a real
  // multi-item picker with - if this account ever gets a second warehouse,
  // this should be re-verified for an actual selection UI.
  // Excel TC181/TC182 - live-verified 2026-08-04 on a Miami-route account
  // with 2 products added to its warehouse transfer: tapping
  // `section_header_toggle_cta` (the chevron next to the "+" icon) expands
  // EVERY warehouse card at once, appending each product's name/qty/pkg
  // directly onto the card's own content-desc (e.g. "...Total Products\n2\n
  // American Quality Pist 25lb\nx1\npkg: 1\n..."). Tapping it again
  // collapses back to just the "Total Products\n<n>" summary. Earlier
  // exploration on a single-warehouse, 0-product account wrongly concluded
  // this control was a no-op - it only has visible effect once a warehouse
  // actually has products to list.
  /** Excel TC181/TC182 - taps the header's expand/collapse chevron, toggling every warehouse card's product list inline. */
  async toggleWarehouseCardsExpanded(): Promise<void> {
    await this.tap('~section_header_toggle_cta');
  }

  /** Excel TC181/TC182 - whether the given warehouse's card is currently showing its expanded product list (its content-desc grows to include product names once toggleWarehouseCardsExpanded() is tapped with products present). */
  async isWarehouseCardExpanded(warehouseLabel: string, productName: string): Promise<boolean> {
    const card = await this.driver.$(this.routeRow(warehouseLabel));
    const desc = (await card.getAttribute('content-desc')) ?? '';
    return desc.includes(productName);
  }

  /** Taps the plus icon to create a new route-to-warehouse transfer, returning the resulting warehouse's name (read from the created card's own content-desc, same pattern as selectFirstAvailableRoute()). Assumes the Route to Warehouse tab is already active. */
  async initiateWarehouseTransfer(): Promise<string> {
    await this.tap(this.addProductButton);
    await this.waitFor(this.routeToWarehouse);
    const label = (await (await this.driver.$(this.routeToWarehouse)).getAttribute('content-desc')) ?? '';
    return label.split('\n')[1] ?? '';
  }

  /** Excel TC095 - swipes a route card right-to-left, revealing its (unlabeled) delete/trash icon button. Same structural child-Button selector swipeAndDelete() taps, just without also confirming the delete. */
  async swipeRouteCardToRevealDelete(routeLabel: string): Promise<void> {
    const row = await this.driver.$(this.routeRow(routeLabel));
    await row.waitForExist({ timeout: mobileConfig.timeouts.element });
    const loc = await row.getLocation();
    const size = await row.getSize();
    await this.swipe(loc.x + size.width - 10, loc.y + size.height / 2, loc.x + 10, loc.y + size.height / 2);
  }

  /** Excel TC095 - whether the delete/trash icon revealed by swipeRouteCardToRevealDelete() is visible. */
  async isDeleteIconVisible(routeLabel: string): Promise<boolean> {
    return this.isVisible(`${this.routeRow(routeLabel)}/android.widget.Button`);
  }

  /** Excel TC131.002 - the Transfers screen's primary action button is labeled "Done" (assumes open() was already called). */
  async isDoneButtonVisible(): Promise<boolean> {
    return this.isVisible(this.doneButton);
  }

  /** Excel TC096 - taps the delete/trash icon revealed by swipeRouteCardToRevealDelete(), opening the "Delete Transfer" confirmation popup. */
  async tapDeleteIcon(routeLabel: string): Promise<void> {
    await this.tap(`${this.routeRow(routeLabel)}/android.widget.Button`);
  }

  /** Excel TC096 - whether the "Delete Transfer" confirmation popup (with its "are you sure" message naming the route) is visible. */
  async isDeleteConfirmationVisible(routeLabel: string): Promise<boolean> {
    return this.isVisible(
      `//android.view.View[contains(@content-desc,"Delete Transfer") and contains(@content-desc,"${routeLabel}")]`
    );
  }

  /** Excel TC126 - taps Cancel on the "Delete Transfer" confirmation popup, retaining the route unchanged. */
  async cancelDeleteConfirmation(): Promise<void> {
    await this.tap(this.cancelButton);
  }

  /** Excel TC096/TC099 - taps Delete on the "Delete Transfer" confirmation popup, completing the delete. */
  async confirmDelete(): Promise<void> {
    await this.tap(this.deleteButton);
  }

  /** Excel TC102 - taps an existing route card on the Transfers landing page, navigating to its RTR (Route-to-Route) Details screen. */
  async openRtrDetails(routeLabel: string): Promise<void> {
    await this.tap(this.routeRow(routeLabel));
    await this.waitFor(this.rtrDetailsHeading(routeLabel));
  }

  /** Excel TC103 - the RTR Details screen's heading (naming the route), search field, and search/scanner icons are all visible (assumes openRtrDetails() was already called). */
  async isRtrDetailsScreenVisible(routeLabel: string): Promise<{
    heading: boolean;
    searchField: boolean;
    searchIcon: boolean;
    scannerIcon: boolean;
  }> {
    return {
      heading: await this.isVisible(this.rtrDetailsHeading(routeLabel)),
      searchField: await this.isVisible(this.searchField),
      searchIcon: await this.isVisible(this.rtrSearchIcon),
      scannerIcon: await this.isVisible(this.rtrScannerIcon)
    };
  }

  /** Whether the RTR Details screen's "No products recorded" empty state is showing. */
  async isNoProductsRecordedVisible(): Promise<boolean> {
    return this.isVisible(this.noProductsRecordedMessage);
  }

  /** Excel TC105 - tapping the Product search field opens the real Android soft keyboard (a standard qwerty IME, not a custom in-app keypad). */
  async isAlphabetKeypadVisible(): Promise<boolean> {
    return this.driver.execute('mobile: isKeyboardShown');
  }

  /** Excel TC110 - taps the scanner icon on RTR Details, opening the real barcode-scanner screen (a live camera preview with a "Continue" button - confirmed a genuine camera view, not a mock, via the recording indicator appearing in the status bar). */
  async openProductScanner(): Promise<void> {
    await this.tap(this.rtrScannerIcon);
    await this.waitFor(this.scannerContinueButton);
  }

  /** Whether the barcode-scanner screen opened by openProductScanner() is showing. */
  async isScannerScreenVisible(): Promise<boolean> {
    return this.isVisible(this.scannerContinueButton);
  }

  /** Leaves the scanner screen via the hardware back button, returning to RTR Details. */
  async closeScanner(): Promise<void> {
    await this.pressKeyCode(4);
  }

  /** Excel TC115/TC122 - taps a single digit on the quantity field's own custom keypad (assumes it's already open, e.g. right after searchAndSelect() adds a product). Live-verified 2026-08-04: the field's default "1" is fully selected on focus, so the first digit tapped REPLACES it rather than appending. */
  async tapQtyDigit(digit: number): Promise<void> {
    await this.tap(this.qtyKeypadDigit(digit));
  }

  /** Excel TC116 - taps the keypad's "-" (decrement) button once. */
  async tapQtyDecrement(): Promise<void> {
    await this.tap(this.qtyKeypadDecrement);
  }

  /** Current text of the quantity field. */
  async getQtyValue(): Promise<string> {
    return (await (await this.driver.$(this.qtyField)).getAttribute('text')) ?? '';
  }

  /** Excel TC122 - taps the keypad's confirm checkmark, closing the keypad and committing the entered quantity. */
  async confirmQty(): Promise<void> {
    await this.tap(this.qtyKeypadConfirm);
  }

  /** Excel TC106/TC107 - typing a term with no matching products shows the "No search results found" message inside the Search product sheet. */
  async isNoSearchResultsFoundVisible(): Promise<boolean> {
    return (await this.isVisible(this.searchProductSheetTitle)) && (await this.isVisible(this.noSearchResultsFoundMessage));
  }

  /** Leaves the RTR Details screen via its back arrow, returning to the Transfers landing page. */
  async closeRtrDetails(): Promise<void> {
    await this.tap(this.transferToScreenBackButton);
  }

  /** Excel TC104/TC108/TC111/TC114 - after searchAndSelect() adds a product, RTR Details shows it as a quantity EditText (default "1") whose `hint` carries the product name + "Qty" - live-verified 2026-08-04: selecting a product opens a custom numeric keypad over this same field, defaulting to quantity 1. */
  async isFirstAddedProductVisible(): Promise<boolean> {
    return this.isVisible(this.firstAddedProduct);
  }

  // CRITICAL, live-verified 2026-08-04: a route/warehouse transfer that
  // still has products on it does NOT reliably delete via deleteRoute()
  // alone - the swipe+confirm sequence visually removes the route card and
  // survives in-session navigation, but does NOT persist server-side. A
  // real force-stop + relaunch of the app brings the "deleted" route (and
  // its product) right back, every time - repeatedly confirmed live.
  // Removing the product FIRST (via these methods), THEN calling
  // deleteRoute() on the now-empty route, is the only sequence that
  // actually survives an app restart. Any test that adds a product to a
  // transfer MUST empty it before deleting the route, or the deletion is a
  // no-op that silently pollutes real backend data for future runs.
  /** Swipes the first product row to reveal its trash icon, then taps it - opening the "Delete Product" confirmation popup. Split out from removeFirstProduct() so TC126 can exercise the Cancel path instead of always confirming. */
  async swipeAndTapProductDelete(): Promise<void> {
    // qtyField (matched by hint, not text) rather than firstAddedProduct
    // (matched by `@text="1"`) - this must still resolve after a test has
    // changed the quantity away from "1" (e.g. TC115/TC117).
    const row = await this.driver.$(this.qtyField);
    await row.waitForExist({ timeout: mobileConfig.timeouts.element });
    const loc = await row.getLocation();
    const size = await row.getSize();
    await this.swipe(loc.x + size.width - 10, loc.y + size.height / 2, loc.x + 10, loc.y + size.height / 2);
    await this.tap(`${this.qtyField}/android.widget.Button`);
  }

  /** Excel TC126 - taps Cancel on the "Delete Product" confirmation popup, retaining the product unchanged. */
  async cancelProductDelete(): Promise<void> {
    await this.tap(this.cancelButton);
  }

  /** Excel TC177 - whether the "Delete Product" confirmation popup (its Delete button) is visible after swipeAndTapProductDelete(). */
  async isDeleteButtonVisible(): Promise<boolean> {
    return this.isVisible(this.deleteButton);
  }

  /** Removes the first product from an open RTR Details screen (swipe reveals its own trash icon, same pattern as a route card). Assumes at least one product is already present. */
  async removeFirstProduct(): Promise<void> {
    await this.swipeAndTapProductDelete();
    await this.tap(this.deleteButton);
  }

  private async openTab(lob: Lob, transferType: TransferType): Promise<void> {
    await this.open();
    await this.tap(this.lowercaseLobTab(lob));
    await this.tap(transferType === 'routeToRoute' ? this.routeToRouteTab : this.routeToWarehouseTab);
  }

  /**
   * Creates a brand-new route/warehouse transfer and adds `count` products
   * to it (default 1). For routeToRoute, `routeNumber` picks which existing
   * route tile to attach the new transfer to - RF used Route 001 for its
   * single-add keywords and Route 002 for its bulk-add keywords; preserved
   * here as a parameter rather than two hardcoded call sites.
   */
  async addProduct(
    lob: Lob,
    transferType: TransferType,
    opts: { routeNumber?: number; count?: number; searchTerm?: string } = {}
  ): Promise<void> {
    const count = opts.count ?? 1;
    const searchTerm = opts.searchTerm ?? 'can';
    await this.openTab(lob, transferType);
    await this.tap(this.addProductButton);
    if (transferType === 'routeToRoute') {
      const routeItem = this.routeTabItem(opts.routeNumber ?? 1);
      await this.waitFor(routeItem);
      const routeInfo = (await (await this.driver.$(routeItem)).getAttribute('content-desc')) ?? '';
      await this.tap(routeItem);
      await this.waitFor(this.routeRow(routeInfo));
      await this.tap(this.routeRow(routeInfo));
    } else {
      await this.tap(this.routeToWarehouse);
    }
    for (let i = 0; i < count; i++) {
      await this.searchAndSelect(searchTerm);
    }
    await this.tap(this.transferToScreenBackButton);
  }

  /** Adds a product to an ALREADY-EXISTING route/warehouse transfer (skips the add_product_button + route-selection sub-flow that addProduct goes through). */
  async editAndAddProduct(
    lob: Lob,
    transferType: TransferType,
    opts: { routeLabel?: string; searchTerm?: string } = {}
  ): Promise<void> {
    const searchTerm = opts.searchTerm ?? 'can';
    await this.openTab(lob, transferType);
    if (transferType === 'routeToRoute') {
      await this.tap(this.routeRow(opts.routeLabel ?? 'Route 001'));
    } else {
      await this.tap(this.routeToWarehouse);
    }
    await this.searchAndSelect(searchTerm);
    await this.tap(this.transferToScreenBackButton);
  }

  /** Deletes the first added product from an existing route/warehouse transfer, resolving its name from the first quantity-1 row's `hint` attribute. */
  async editAndDeleteProduct(lob: Lob, transferType: TransferType, opts: { routeLabel?: string } = {}): Promise<void> {
    await this.openTab(lob, transferType);
    if (transferType === 'routeToRoute') {
      await this.tap(this.routeRow(opts.routeLabel ?? 'Route 001'));
    } else {
      await this.tap(this.routeToWarehouse);
    }
    await this.waitFor(this.firstAddedProduct);
    const hint = (await (await this.driver.$(this.firstAddedProduct)).getAttribute('hint')) ?? '';
    const productName = hint.split('-')[0].trim();
    await this.swipeAndDelete(this.recordByHint(productName));
    await this.tap(this.transferToScreenBackButton);
  }

  /** Deletes an entire route/warehouse transfer entry (not just a product within it). */
  async deleteRoute(lob: Lob, transferType: TransferType, label?: string): Promise<void> {
    await this.openTab(lob, transferType);
    const routeLabel = label ?? (transferType === 'routeToRoute' ? 'Route 001' : 'To Warehouse');
    await this.swipeAndDelete(this.routeRow(routeLabel));
  }
}
