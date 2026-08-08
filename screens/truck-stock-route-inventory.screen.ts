import { BaseScreen } from './base.screen';
import type { Lob } from '../utils/lob';

type InventoryType = 'audit' | 'cycle';

/**
 * Truck Stock > Route Inventory. Ported from truck_stock_route_inventory.robot.
 */
export class TruckStockRouteInventoryScreen extends BaseScreen {
  // Same content-desc ("Route Inventory") on both the nav button and the
  // screen title - kept as distinct widget-typed xpaths, same reasoning as
  // TruckStockTruckReturnsScreen's nav-item-vs-title pair.
  private readonly navMenuRouteInventory = '//android.widget.Button[@content-desc="Route Inventory"]';
  private readonly routeInventoryTitle = '//android.view.View[@content-desc="Route Inventory"]';
  private readonly auditTab = '~Audit';
  private readonly cycleTab = '~Cycle';

  private inventoryTabSelector(type: InventoryType): string {
    return type === 'audit' ? this.auditTab : this.cycleTab;
  }

  async open(): Promise<void> {
    await this.tap(this.hamburgerIcon);
    await this.waitFor(this.navMenuTruckStockCollapsed);
    await this.tap(this.navMenuTruckStockCollapsed);
    await this.waitFor(this.navMenuRouteInventory);
    await this.tap(this.navMenuRouteInventory);
    await this.waitFor(this.routeInventoryTitle);
  }

  private async openTab(lob: Lob, type: InventoryType): Promise<void> {
    await this.open();
    await this.tap(this.lobTabSelector(lob));
    await this.tap(this.addProductButton);
    await this.tap(this.inventoryTabSelector(type));
  }

  /**
   * Adds `count` products (default 1). RF's bulk-add keyword manually
   * re-clicked/cleared/typed "can" into a scoped search field on every loop
   * iteration and THEN called the shared search-and-select keyword (which
   * does the exact same click/clear/type against the same visible field
   * itself) - a redundant double-search, not reproduced. Just calls
   * searchAndSelect once per iteration here.
   */
  async addProduct(lob: Lob, type: InventoryType, opts: { count?: number; searchTerm?: string } = {}): Promise<void> {
    const count = opts.count ?? 1;
    const searchTerm = opts.searchTerm ?? 'can';
    await this.openTab(lob, type);
    for (let i = 0; i < count; i++) {
      await this.searchAndSelect(searchTerm);
    }
    await this.tap(this.doneButton);
  }

  async deleteProduct(lob: Lob, type: InventoryType, searchTerm = 'man'): Promise<void> {
    await this.openTab(lob, type);
    const productName = await this.searchAndSelect(searchTerm);
    await this.swipeAndDelete(this.recordByHint(productName));
    await this.tap(this.backButton);
    await this.waitFor(this.saveButton);
    await this.tap(this.saveButton);
  }
}
