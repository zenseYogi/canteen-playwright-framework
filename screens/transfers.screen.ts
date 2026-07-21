import { BaseScreen } from './base.screen';
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

  private async openTab(lob: Lob, transferType: TransferType): Promise<void> {
    await this.open();
    await this.tap(this.lobTabSelector(lob));
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
