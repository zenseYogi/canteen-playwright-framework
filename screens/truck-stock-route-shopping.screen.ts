import { BaseScreen } from './base.screen';

/**
 * Truck Stock > Route Shopping. Ported from truck_stock_route_shopping.robot.
 *
 * RF's source used a Global Variable to pass the resolved product name
 * between keywords (Add -> Click-to-edit -> Delete) within one test case.
 * Replaced with explicit return values/parameters here, same as
 * TruckStockTruckReturnsScreen in Phase 2 - no hidden cross-call state.
 */
export class TruckStockRouteShoppingScreen extends BaseScreen {
  // Same content-desc ("Route shopping") on both the nav button and the
  // screen title - kept as distinct widget-typed xpaths, same reasoning as
  // the other Truck Stock screens' nav-item-vs-title pairs.
  private readonly navMenuRouteShopping = '//android.widget.Button[@content-desc="Route shopping"]';
  private readonly routeShoppingTitle = '//android.view.View[@content-desc="Route shopping"]';
  private readonly addedProductRow = (name: string) => `//android.view.View[contains(@content-desc,"${name}")]`;

  async open(): Promise<void> {
    await this.tap(this.hamburgerIcon);
    await this.waitFor(this.navMenuTruckStockCollapsed);
    await this.tap(this.navMenuTruckStockCollapsed);
    await this.waitFor(this.navMenuRouteShopping);
    await this.tap(this.navMenuRouteShopping);
    await this.waitFor(this.routeShoppingTitle);
  }

  /** Adds a product and returns its resolved name - feed straight into editAddedProduct/deleteProduct/addMultipleToEditedProduct. */
  async addProduct(searchTerm = 'can'): Promise<string> {
    await this.open();
    await this.tap(this.addProductButton);
    const productName = await this.searchAndSelect(searchTerm);
    await this.tap(this.doneButton);
    return productName;
  }

  /** Opens an already-added product's edit screen by its resolved name. */
  async editAddedProduct(productName: string): Promise<void> {
    await this.waitFor(this.addedProductRow(productName));
    await this.tap(this.addedProductRow(productName));
    await this.waitFor(this.recordByHint(productName));
  }

  async deleteProduct(productName: string): Promise<void> {
    await this.editAddedProduct(productName);
    await this.swipeAndDelete(this.recordByHint(productName));
    await this.tap(this.doneButton);
  }

  /** Adds `count` more products to an already-added product's edit screen. */
  async addMultipleToEditedProduct(productName: string, count: number, searchTerm = 'can'): Promise<void> {
    await this.editAddedProduct(productName);
    for (let i = 0; i < count; i++) {
      await this.searchAndSelect(searchTerm);
    }
    await this.tap(this.doneButton);
  }
}
