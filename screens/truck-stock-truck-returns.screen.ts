import { BaseScreen } from './base.screen';

type Lob = 'coffee' | 'market' | 'vending';

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
  private readonly navMenuTruckStockCollapsed = '//android.view.View[@content-desc="Truck stock, Collapsed"]';
  // Both the nav menu button and the screen title share the content-desc
  // "Truck returns" - kept as distinct widget-typed xpaths (Button vs View)
  // rather than one `~Truck returns` accessibility-id lookup, since that
  // shorthand can't disambiguate between them if both exist in the view
  // hierarchy at the same time (e.g. a nav drawer that stays mounted while closed).
  private readonly navMenuTruckReturns = '//android.widget.Button[@content-desc="Truck returns"]';
  private readonly truckReturnsTitle = '//android.view.View[@content-desc="Truck returns"]';

  private readonly coffeeTab = '//android.view.View[@content-desc="Coffee"]';
  private readonly marketTab = '//android.view.View[@content-desc="Market"]';
  private readonly vendingTab = '//android.view.View[@content-desc="Vending"]';

  private readonly addProductTitle = '//android.view.View[@content-desc="Add product"]';
  private readonly addProductDamagedField =
    '//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.View/android.view.View/android.view.View/android.view.View[6]/android.widget.EditText[1]';
  private readonly addedProducts = '//android.view.View[@text="1"]';
  // RF's delete-icon xpath uses a 1-based XPath positional predicate, so the
  // 0-based matched array index from swipeAndDeleteByLabel needs +1 here.
  private readonly deleteIconAt = (index: number) =>
    `//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.View/android.view.View/android.view.View/android.view.View[5]/android.view.View/android.view.View[${index + 1}]/android.widget.Button`;

  private tabSelector(lob: Lob): string {
    return { coffee: this.coffeeTab, market: this.marketTab, vending: this.vendingTab }[lob];
  }

  async open(): Promise<void> {
    await this.tap(this.hamburgerIcon);
    await this.waitFor(this.navMenuTruckStockCollapsed);
    await this.tap(this.navMenuTruckStockCollapsed);
    await this.waitFor(this.navMenuTruckReturns);
    await this.tap(this.navMenuTruckReturns);
    await this.waitFor(this.truckReturnsTitle);
  }

  /** Adds a product under the given LOB tab and returns its resolved name (feed straight into deleteProduct). */
  async addProduct(lob: Lob, searchTerm: string): Promise<string> {
    await this.open();
    await this.tap(this.tabSelector(lob));
    await this.tap(this.addProductButton);
    const productName = await this.searchAndSelect(searchTerm);
    await this.waitFor(this.addProductTitle);
    await this.tap(this.addProductDamagedField);
    const field = await this.driver.$(this.addProductDamagedField);
    await field.setValue('1');
    await this.tap(this.doneButton);
    return productName;
  }

  /** Deletes a previously-added product by its resolved name, matching RF's swipe-then-match-by-hint delete. */
  async deleteProduct(lob: Lob, productName: string): Promise<void> {
    await this.open();
    await this.tap(this.tabSelector(lob));
    await this.swipeAndDeleteByLabel(this.addedProducts, productName, this.deleteIconAt);
  }
}
