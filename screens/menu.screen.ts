import { BaseScreen } from './base.screen';
import type { Lob } from '../utils/lob';
import { expect } from '@playwright/test';
import { pause } from 'node_modules/webdriverio/build/commands/browser';
import { mobileConfig } from '../config/mobile.config';

type InventoryType = 'audit' | 'cycle';

/**
 * Home / dashboard screen - lands here after successful login + MFA.
 */
export class MenuScreen extends BaseScreen {
  // Ported from dashboard.yaml's title_deliveries - the specific element RF's
  // "Validate user is on the dashboard page" keyword waits on. Matches the
  // "Deliver" stem rather than "Deliveries" - live-verified the dashboard
  // shows singular "1 Delivery" (not "1 Deliveries") when only one stop is
  // scheduled, and "Deliveries" is not a substring of "Delivery".
  private readonly deliveriesTitle = '//android.view.View[contains(@content-desc, "Deliver")]';

  // PBI 622025 "Home Page: Dynamic data with functionality" - live-verified
  // against build 0.1.76 (Miami/010). The day badge's content-desc is the
  // whole string (e.g. "Yesterday, Thu 23 Jul") - matched by its one of
  // three fixed prefixes, since the day/date portion changes daily.
  private readonly currentDateBadge =
    '//android.view.View[starts-with(@content-desc,"Today") or starts-with(@content-desc,"Yesterday") or starts-with(@content-desc,"Tomorrow")]';
  private readonly routeBadge = '//android.view.View[starts-with(@content-desc,"Route")]';
  // The "Select a day" bottom sheet's own TODAY card (content-desc packs
  // the label and date together, e.g. "TODAY\nAugust 7, 2026") - used by
  // returnToHome() to dismiss this sheet if left open.
  private readonly selectADaySheetTodayOption = '//android.view.View[starts-with(@content-desc,"TODAY")]';
  // Live-verified: each LOB's "X/Y" count badge and its name label are
  // siblings in two separate groups under the same parent (all counts
  // first, then all labels), in the SAME per-LOB order - e.g. Market's
  // count and Coffee's count both precede both labels. Confirmed only
  // "X/Y"-shaped counts contain "/" on this screen, so lobCountBadge is
  // safe without also scoping to a specific container.
  private readonly lobCountBadge = '//android.view.View[contains(@content-desc,"/")]';
  private readonly lobLabels = '//android.view.View[@content-desc="Market" or @content-desc="Coffee" or @content-desc="Vending"]';
  // TC036 "view Edit schedule order screen" / TC018/TC020 "navigate to Edit
  // schedule order screen" (PBI 611763/630328) - live-verified: opens a
  // sheet titled "Edit Schedule Order" listing every stop's name+address.
  private readonly editScheduleButton = '~Edit schedule';
  private readonly editScheduleTitle = '~Edit Schedule Order';
  readonly productSearchField = '//android.widget.EditText[@hint="Product"]';







  private readonly deviceInfoHeader =
    '//android.view.View[@content-desc="Device information"]';

  private readonly userLabel =
    '//android.view.View[@content-desc="User"]';

  private readonly userName =
    '(//android.view.View[@content-desc="User"]/following-sibling::android.view.View)[1]';

  private readonly securityFunctionsLabel =
    '//android.view.View[@content-desc="Security functions"]';

  private readonly securityFunctionsValue =
    '(//android.view.View[@content-desc="Security functions"]/following-sibling::android.view.View)[1]';

  private readonly lastSyncLabel =
    '//android.view.View[@content-desc="Last sync"]';

  private readonly lastSyncValue =
    '(//android.view.View[@content-desc="Last sync"]/following-sibling::android.view.View)[1]';

  async isDeviceInformationHeaderDisplayed(): Promise<boolean> {
    return await this.driver.$(this.deviceInfoHeader).isDisplayed();
  }

  async isUserDisplayed(): Promise<boolean> {
    return await this.driver.$(this.userLabel).isDisplayed();
  }

  private readonly hamburgerMenu =
    '//android.widget.Button[@content-desc="Open navigation menu"]';

  private readonly settingsMenu =
    '//android.view.View[contains(@content-desc,"Settings")]';

  private readonly deviceInfoMenu =
    '//android.widget.Button[@content-desc="Device info"]';

  async getUserName(): Promise<string> {
    const value = await this.driver.$(this.userName)
      .getAttribute('content-desc');
    if (!value) {
      throw new Error('Username value not found');
    }
    return value;
  }

  async isUserNameDisplayed(): Promise<boolean> {
    const user = await this.getUserName();
    return user.trim().length > 0;
  }


  async isSecurityFunctionsDisplayed(): Promise<boolean> {
    return await this.driver.$(this.securityFunctionsLabel)
      .isDisplayed();
  }

  async getSecurityFunctions(): Promise<string> {
    const value = await this.driver.$(this.securityFunctionsValue)
      .getAttribute('content-desc');
    if (!value) {
      throw new Error('Security functions value not found');
    }
    return value;
  }

  async hasSecurityPermissions(): Promise<boolean> {
    const permissions = await this.getSecurityFunctions();
    return permissions.trim().length > 0;
  }

  async isLastSyncDisplayed(): Promise<boolean> {
    return await this.driver.$(this.lastSyncLabel)
      .isDisplayed();
  }

  async getLastSyncValue(): Promise<string> {
    const value = await this.driver
      .$(this.lastSyncValue)
      .getAttribute('content-desc');

    if (!value) {
      throw new Error('Last sync value not found');
    }

    return value;
  }

  async hasLastSyncValue(): Promise<boolean> {
    const value = await this.getLastSyncValue();
    return value.trim().length > 0;
  }

  async openNavigationMenu(): Promise<void> {
    const menu = await this.driver.$(this.hamburgerMenu);
    await menu.waitForDisplayed({ timeout: 10000 });
    await menu.click();
  }


  async openSettings(): Promise<void> {
    const settings = await this.driver.$(this.settingsMenu);

    await settings.waitForDisplayed({ timeout: 10000 });

    const contentDesc =
      (await settings.getAttribute('content-desc')) ?? '';

    if (contentDesc.includes('Collapsed')) {
      await settings.click();

      await this.driver.$(
        '//android.view.View[contains(@content-desc,"Settings, Expanded")]'
      ).waitForDisplayed({ timeout: 5000 });
    }
  }

  async openDeviceInfo(): Promise<void> {
    const deviceInfo = await this.driver.$(this.deviceInfoMenu);

    await deviceInfo.waitForDisplayed({ timeout: 10000 });
    await deviceInfo.click();

    await this.driver.$(
      '//android.view.View[@content-desc="Device information"]'
    ).waitForDisplayed({ timeout: 10000 });
  }

  async isProductPresent(productName: string): Promise<boolean> {
    const product = await this.driver.$(
      `//android.view.View[@content-desc="${productName}"]`
    );
    try {
      await product.waitForDisplayed({ timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  private readonly addedProductRow = (name: string) =>
    `//android.view.View[contains(@content-desc,"${name}")]`;
  async isProductDisplayed(productName: string): Promise<boolean> {
    try {
      await this.driver
        .$(this.addedProductRow(productName))
        .waitForDisplayed({ timeout: 5000 });

      return true;
    } catch {
      return false;
    }
  }

  async hasProductDetails(productName: string): Promise<boolean> {
    const details = await this.getProductDetails(productName);

    return (
      details.includes(productName) &&
      details.trim().length > productName.length
    );
  }

  async getProductDetails(productName: string): Promise<string> {
    const row = await this.driver.$(this.addedProductRow(productName));

    return (await row.getAttribute('content-desc')) ?? '';
  }

  private readonly routeShoppingTitle =
    '//android.view.View[@content-desc="Route shopping" or @content-desc="Route Shopping"]';

  private readonly warehouseDetails =
    '//android.view.View[@content-desc="From Charlotte"]';

  private readonly productRow = (productName: string) =>
    `//android.view.View[contains(@content-desc,"${productName}")]`;

  async isRouteShoppingTitleDisplayed(): Promise<boolean> {
    return await this.driver.$(this.routeShoppingTitle).isDisplayed();
  }

  async getWarehouseDetails(): Promise<string> {
    const value = await this.driver
      .$(this.warehouseDetails)
      .getAttribute('content-desc');

    return value ?? '';
  }

  async isWarehouseDetailsDisplayed(): Promise<boolean> {
    return await this.driver.$(this.warehouseDetails).isDisplayed();
  }


  async getProductRowDetails(productName: string): Promise<string> {
    const value = await this.driver
      .$(this.productRow(productName))
      .getAttribute('content-desc');

    return value ?? '';
  }



  async verifyProductQuantity(
    productName: string,
    quantity: string
  ): Promise<boolean> {
    const details = await this.getProductRowDetails(productName);

    return (
      details.includes(productName) &&
      details.includes(quantity)
    );
  }

  private readonly navMenuRouteShopping = '//android.widget.Button[@content-desc="Route Shopping"]';

  async openRouteShopping(): Promise<void> {
    await this.tap(this.hamburgerIcon);

    const routeShopping = await this.driver.$(this.navMenuRouteShopping);

    if (!(await routeShopping.isExisting())) {
      await this.waitFor(this.navMenuTruckStockCollapsed);
      await this.tap(this.navMenuTruckStockCollapsed);
    }

    await this.waitFor(this.navMenuRouteShopping);
    await this.tap(this.navMenuRouteShopping);
    await this.waitFor(this.routeShoppingTitle);
  }

  /** Adds a product and returns its resolved name - feed straight into editAddedProduct/deleteProduct/addMultipleToEditedProduct. */
  async addProduct(searchTerm = 'can'): Promise<string> {
    await this.openRouteShopping();
    await this.tap(this.addProductButton);
    await this.searchAndSelect(searchTerm);
    const productName = await this.getProductName();
    await this.tap(this.doneButton);
    return productName;
  }

  private readonly quantityFieldBox =
    '(//android.widget.EditText[contains(@hint,"Qty")])[1]';

  async getProductName(): Promise<string> {
    const hint = await this.driver
      .$(this.quantityFieldBox)
      .getAttribute('hint');
    const value = hint ?? '';
    return value.split('\n')[0].trim();
  }

  async searchAndSelectProducts(
    value: string,
    position = 0
  ): Promise<string | null> {
    await this.tap(this.searchField);
    const field = await this.driver.$(this.searchField);
    await field.clearValue();
    await this.driver.pause(1000);
    await field.setValue(value);
    await this.driver.pause(2000);
    const options = await this.driver.$$(this.searchList);
    if (await options.length === 0) {
      return null;
    }
    const option = options[position];
    const fullName =
      (await option.getAttribute('content-desc')) ?? '';
    const name = fullName.split('-')[0].trim();
    await option.click();
    return name;
  }


  /** Opens an already-added product's edit screen by its resolved name. */
  async editAddedProduct(productName: string): Promise<void> {
    await this.waitFor(this.addedProductRow(productName));
    await this.tap(this.addedProductRow(productName));
    await this.waitFor(this.recordByHint(productName));
  }


  // async updateQuantity(quantity: string): Promise<void> {
  //   const field = await this.driver.$(this.quantityField);
  //   await field.click();
  //   await field.clearValue();
  //   await field.setValue(quantity);
  //   expect(await field.getText()).toBe(quantity);
  // }

  private quantityField(productName: string): string {
    return `//android.widget.EditText[contains(@hint,"${productName}")]`;
  }

  async updateQuantity(
    productName: string,
    quantity: number
  ): Promise<void> {
    const locator = this.quantityField(productName);
    const field = await this.driver.$(locator);

    await field.waitForDisplayed();

    // Open quantity editor / keypad
    await this.tap(locator);

    // Wait until field is focused and keypad is displayed
    await this.driver.waitUntil(async () => {
      return await (await this.driver.$('~1')).isDisplayed();
    }, {
      timeout: 5000,
      timeoutMsg: `Quantity field for ${productName} was not focused`
    });

    // Value is selected, entering digits replaces existing value
    for (const digit of quantity.toString()) {
      await (await this.driver.$(`~${digit}`)).click();
    }

    await (await this.driver.$('~Done')).click();

    await this.driver.waitUntil(async () => {
      return Number(await field.getAttribute('text')) === quantity;
    }, {
      timeout: 5000,
      timeoutMsg: `Quantity was not updated to ${quantity}`
    });

    expect(Number(await field.getAttribute('text'))).toBe(quantity);
  }






  async saveChanges(): Promise<void> {
    await this.tap(this.doneButton);
    await this.waitFor(this.routeShoppingTitle);
  }

  async verifySavedQuantity(
    productName: string,
    expectedQty: string
  ): Promise<boolean> {
    await this.editAddedProduct(productName);
    const actualQty = await this.getQuantity(productName);
    await this.saveChanges();
    return actualQty === expectedQty;
  }


  async getQuantity(productName: string): Promise<string> {
    const value = await this.driver
      .$(this.quantityField(productName))
      .getAttribute('text');

    return value ?? '';
  }

  async verifyDiscardRestoresValue(
    productName: string,
    originalQty: string,
    // modifiedQty: string
  ) {

    // await this.editAddedProduct(productName);
    // await this.updateQuantity(modifiedQty);
    await this.discardChanges();
    // await this.editAddedProduct(productName);
    expect(await this.verifyProductQuantity(productName, originalQty)).toBe(true);
    // const currentQty = await this.getQuantity();
    // await this.saveChanges();
    // return currentQty === originalQty;
  }


  // private readonly noButton =
  //   '//android.widget.Button[@content-desc="No"]';

  async discardChanges(): Promise<void> {
    await this.tap(this.backButton);
    await this.tap(this.noButton)
    await this.waitFor(this.routeShoppingTitle);
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
  private readonly lobTab = (lob: String) => `//android.view.View[@content-desc="${lob}"]`;
  private readonly addedProducts = '//android.view.View[@text="1"]';
  private readonly deleteIconAt = (index: number) =>
    `(//android.view.View[@text="1"])[${index + 1}]/following-sibling::android.widget.Button[1]`;



  async deleteProduct(productName: string): Promise<void> {
    await this.editAddedProduct(productName);
    await this.swipeAndDelete(this.recordByHint(productName));
    await this.tap(this.doneButton);
  }

  async tapBackArrow(): Promise<void> {
    await this.tap(this.backButton);
  }

  async getProductQuantity(productName: string): Promise<number> {
    const quantityElement = await this.driver.$(
      `//android.view.View[contains(@content-desc,"${productName}")]
      /following-sibling::android.view.View[1]`
    );
    const text =
      (await quantityElement.getAttribute('content-desc')) ?? '';
    const qty = text.match(/\d+/);
    return Number(qty?.[0] ?? 0);
  }

  async verifyRouteTransferTotalProducts(
    routeName: string,
    expectedCount: number
  ): Promise<void> {
    const card = await this.driver.$(
      `//android.view.View[contains(@content-desc,"${routeName}")]`
    );
    const contentDesc =
      (await card.getAttribute('content-desc')) ?? '';
    expect(contentDesc).toContain(
      `Total Products\n${expectedCount}`
    );
  }

  async verifyRouteTransferProduct(
    routeName: string,
    productName: string,
    expectedQty: number
  ): Promise<void> {
    const card = await this.driver.$(
      `//android.view.View[contains(@content-desc,"${routeName}")]`
    );
    await card.waitForDisplayed({ timeout: 10000 });
    const contentDesc =
      (await card.getAttribute('content-desc')) ?? '';
    const expectedText = `${productName}\nx${expectedQty}`;
    expect(contentDesc).toContain(expectedText);
  }


  async openProductDetails(routeName: string): Promise<void> {
    const icon = await this.driver.$(`//android.view.View[contains(@content-desc,"${routeName}")]/android.view.View`
    );
    await icon.waitForDisplayed({ timeout: 10000 });
    await icon.click();
  }
  private readonly anyRouteOption = '//android.view.View[starts-with(@content-desc,"Route ")]';
  async isRouteDisplayed(routeLabel: string): Promise<boolean> {
    const options = await this.driver.$$(this.anyRouteOption);

    for (const option of options) {
      const label = (await option.getAttribute('content-desc')) ?? '';

      if (label.trim().toLowerCase() === routeLabel.trim().toLowerCase()) {
        return true;
      }
    }

    return false;
  }


  protected readonly routeSetupMenu = '~Route setup';
  protected readonly routeWarehouseHeader =
    '//android.view.View[contains(@content-desc,",")]';
  async getRouteWarehouseName(): Promise<string> {
    await this.openNavigationMenu();
    await this.tap(this.routeSetupMenu);
    const header = await this.driver.$(this.routeWarehouseHeader);
    await header.waitForDisplayed({
      timeout: mobileConfig.timeouts.element
    });
    const contentDesc =
      (await header.getAttribute('content-desc')) ?? '';
    // Example: "Charlotte, NC"
    return contentDesc.split(',')[0].trim();
  }

  readonly confirmDatesheet = '//android.view.View[contains(@content-desc,"Confirm Date!")]'

  titleStartDayAndRoute(route: string): string {
    return `//android.view.View[starts-with(@content-desc,"Start day") and contains(@content-desc,"${route}")]`;
  }


  protected readonly changeRoutePopup =
    '//android.view.View[contains(@content-desc,"Change route")]';

  async verifyChangeRoutePopupContent(): Promise<void> {
    const popup = await this.driver.$('//android.view.View[contains(@content-desc,"If you proceed all information will be DELETED.")]');
    const contentDesc = (await popup.getAttribute('content-desc')) ?? '';
    const [header, message] = contentDesc
      .split('\n')
      .map(x => x.trim())
      .filter(Boolean);
    expect(contentDesc).toContain('Change route');
    expect(contentDesc).toContain('If you proceed all information will be DELETED.');
  }


  protected readonly routeSetupHeader = '//android.view.View[@content-desc="Route setup"]';

  async isRouteSetupHeaderDisplayed(): Promise<boolean> {
    try {
      const el = await this.driver.$(this.routeSetupHeader);
      return await el.isDisplayed();
    } catch {
      return false;
    }
  }

  private readonly addProductTitle = '//android.view.View[@content-desc="Add product"]';
  private readonly addProductDamagedField = '(//android.widget.EditText[@hint="Damaged"])';
  private readonly addProductSpoiledField = '(//android.widget.EditText[@hint="Spoiled"])';
  private readonly qtyKeypadDigit = (digit: number) => `//android.widget.Button[@content-desc="${digit}"]`;
  private readonly qtyKeypadConfirm = '(//android.widget.Button)[last()]';
  private readonly truckReturnsTitle = '//android.view.View[@content-desc="Truck Returns"]';



  async addProductInTruckStock(lob: string, searchTerm: string, damagedQuantity: number, spoiledQuantity: number): Promise<string> {
    await this.open();
    await this.tap(this.lobTab(lob));
    await this.tap(this.addProductButton);
    await this.searchAndSelect(searchTerm);
    await this.waitFor(this.addProductTitle);
    const productName = await this.getSelectedProductName();
    await this.tap(this.addProductDamagedField);
    await this.tap(this.qtyKeypadDigit(damagedQuantity));
    await this.tap(this.qtyKeypadConfirm);
    await this.tap(this.addProductSpoiledField);
    await this.tap(this.qtyKeypadDigit(spoiledQuantity));
    await this.tap(this.qtyKeypadConfirm);
    await this.tap(this.doneButton);
    await this.waitFor(this.truckReturnsTitle);
    return productName;
  }

  private readonly selectedProductName =
    '//android.view.View[@content-desc="Add product"]/following-sibling::android.view.View[1]';
  async getSelectedProductName(): Promise<string> {
    const el = await this.driver.$(this.selectedProductName);
    return (await el.getAttribute('content-desc')) ?? '';
  }

  private readonly navMenuTruckReturns = '//android.widget.Button[@content-desc="Truck Returns"]';
  async open(): Promise<void> {
    if (await this.isVisible(this.truckReturnsTitle)) {
      return;
    }
    await this.tap(this.hamburgerIcon);
    if (await this.isVisible(this.navMenuTruckStockCollapsed)) {
      await this.tap(this.navMenuTruckStockCollapsed);
    }
    await this.waitFor(this.navMenuTruckReturns);
    await this.tap(this.navMenuTruckReturns);
    await this.waitFor(this.truckReturnsTitle);
  }




  private truckReturnProductRow = (productName: string) =>
    `//android.view.View[contains(@hint,"${productName}")]`;

  async verifyTruckReturnProduct(
    productName: string,
    expectedQuantity: number
  ): Promise<void> {
    const row = await this.driver.$(
      this.truckReturnProductRow(productName)
    );
    await row.waitForDisplayed();
    expect(await row.isDisplayed()).toBe(true);
    const actualQty = (await row.getText()).trim();
    expect(actualQty).toBe(expectedQuantity.toString());
  }

  readonly lobTabs = (lob: string) => `//android.view.View[@content-desc="${lob}"]`;


  private readonly deleteIcon =
    '//android.widget.Button[contains(@content-desc,"Delete")]';


  // private truckReturnProductRow = (productName: string) =>
  //     `//android.view.View[contains(@hint,"${productName}")]`;

  private truckReturnDeleteButton = (productName: string) =>
    `//android.view.View[contains(@hint,"${productName}")]/following-sibling::android.widget.Button`;

  async deleteTruckReturnsProduct(lob: string, productName: string): Promise<void> {

    await this.tap(this.lobTab(lob));
    await this.driver.pause(500);
    const rowLocator = `//android.view.View[contains(@hint,"${productName}")]`;
    await this.isVisible(rowLocator);
    const row = await this.driver.$(rowLocator);
    await row.waitForDisplayed({ timeout: mobileConfig.timeouts.element });

    const loc = await row.getLocation();
    const size = await row.getSize();

    const centerY = loc.y + Math.floor(size.height / 2);

    await this.swipe(
      loc.x + 650,
      centerY,
      loc.x + 350,
      centerY
    );

    await this.driver.pause(1000);
    await this.tap(this.truckReturnDeleteButton(productName));
    await this.driver.pause(1000);

    // await this.tap(this.truckReturnDeleteButton(productName));
    await this.tap(this.deleteButton);
    await this.driver.waitUntil(
      async () => {
        const elements = await this.driver.$$(rowLocator);
        return await elements.length === 0;
      },
      {
        timeout: mobileConfig.timeouts.element,
        timeoutMsg: `Product '${productName}' was not deleted`
      }
    );
  }


 

  async verifyTruckReturnsProductDeleted(productName: string): Promise<boolean> {
    return this.verifyProductDeleted(productName, this.truckReturnProductRow(productName));
  }

  async verifyProductDeleted(productName: string, locator: string): Promise<boolean> {
    try {
      await this.driver.waitUntil(
        async () => {
          const elements = await this.driver.$$(locator);
          return await elements.length === 0;
        },
        {
          timeout: mobileConfig.timeouts.element,
          timeoutMsg: `Product '${productName}' is still displayed`
        }
      );
      return true;
    } catch {
      return false;
    }
  }


  async verifyRouteInventoryProductDeleted(productName: string): Promise<boolean> {
    return this.verifyProductDeleted(productName, this.productRow(productName));
  }




  async isRouteInventorySearchAreaVisible(): Promise<{
    searchField: boolean;
    auditTab: boolean;
    cycleTab: boolean;
  }> {
    return {
      searchField: await this.isVisible(
        '//android.widget.EditText[contains(@hint,"Add product")]'
      ),
      auditTab: await this.isVisible('~Audit'),
      cycleTab: await this.isVisible('~Cycle')
    };
  }


  private routeInventoryProductRow = (productName: string) =>
    `//android.widget.EditText[contains(@hint,"${productName}")]`;

  async isRouteInventoryProductDisplayed(
    productName: string
  ): Promise<boolean> {
    const elements = await this.driver.$$(
      this.routeInventoryProductRow(productName)
    );
    return await elements.length > 0;
  }




  // async verifyRouteInventoryProductDeleted(
  //   productName: string
  // ): Promise<void> {
  //   await this.driver.waitUntil(
  //     async () => {
  //       const elements = await this.driver.$$(
  //         this.routeInventoryProductRow(productName)
  //       );
  //       return await elements.length === 0;
  //     },
  //     {
  //       timeout: mobileConfig.timeouts.element,
  //       timeoutMsg: `Product '${productName}' is still displayed`
  //     }
  //   );
  // }


  async addProductInRouteInventory(
    lob: string,
    type: InventoryType,
    opts: { count?: number; searchTerm?: string } = {}
  ): Promise<string> {
    const count = opts.count ?? 1;
    const searchTerm = opts.searchTerm ?? 'can';
    await this.openTab(lob, type);
    let lastAddedProduct = '';
    for (let i = 0; i < count; i++) {
      lastAddedProduct = await this.searchAndSelect(searchTerm);
    }
    lastAddedProduct = await this.getProductName();
    await this.tap(this.doneButton);
    return lastAddedProduct;
  }


  async openTab(lob: string, type: InventoryType): Promise<void> {
    await this.openRouteInventory();
    await this.tap(this.lobTab(lob));
    await this.tap(this.addProductButton);
    await this.tap(this.inventoryTabSelector(type));
  }

  private readonly navMenuRouteInventory = '//android.widget.Button[@content-desc="Route Inventory"]';
  private readonly routeInventoryTitle = '//android.view.View[@content-desc="Route Inventory"]';
  private readonly auditTab = '~Audit';
  private readonly cycleTab = '~Cycle';
  private inventoryTabSelector(type: InventoryType): string {
    return type === 'audit' ? this.auditTab : this.cycleTab;
  }

  async openRouteInventory(): Promise<void> {
    if (await this.isVisible(this.truckReturnsTitle)) {
      return;
    }
    await this.tap(this.hamburgerIcon);
    if (await this.isVisible(this.navMenuTruckStockCollapsed)) {
      await this.tap(this.navMenuTruckStockCollapsed);
    }
    await this.waitFor(this.navMenuRouteInventory);
    await this.tap(this.navMenuRouteInventory);
    await this.waitFor(this.routeInventoryTitle);
  }

  // private async openAuditTypeTab(lob: Lob, type: InventoryType): Promise<void> {
  //   await this.open();
  //   await this.tap(this.lobTabSelector(lob));
  //   await this.tap(this.addProductButton);
  //   await this.tap(this.inventoryTabSelector(type));
  // }

  async verifyProductQuantityInRouteInventory(
    productName: string,
    quantity: number
  ): Promise<void> {
    const details = await this.getProductRowDetails(
      productName
    );
    expect(details).toContain(productName);
    expect(details).toContain(`x${quantity}`);
  }

  // async getRouteInventoryProductRowDetails(
  //   productName: string
  // ): Promise<string> {
  //   const row = await this.driver.$(
  //     this.productRow(productName)
  //   );
  //   await row.waitForDisplayed({
  //     timeout: mobileConfig.timeouts.element
  //   });
  //   const value = await row.getAttribute('content-desc');
  //   return value || '';
  // }


  // private routeInventoryProductRow(productName: string): string {
  //   return `//android.view.View[contains(@content-desc,"${productName}")]`;
  // }


  async verifyProductNotDisplayedInRouteInventory(
    productName: string
  ): Promise<void> {

    await this.driver.waitUntil(
      async () => {
        const elements = await this.driver.$$(
          this.productRow(productName)
        );
        return await elements.length === 0;
      },
      {
        timeout: mobileConfig.timeouts.element,
        timeoutMsg: `Product '${productName}' is still displayed in Route Inventory`
      }
    );
  }



 async deleteRouteInventoryProduct(lob: string, productName: string): Promise<void> {
    await this.tap(this.lobTab(lob));
    await this.waitFor(this.addedProductRow(productName));
    await this.tap(this.addedProductRow(productName));
    await this.waitFor(this.recordByHint(productName));
   await this.deleteProductTest(productName);
  }

private truckRouteInventoryDeleteButton = (productName: string) =>
  `//android.widget.EditText[contains(@hint,"${productName}")]/android.widget.Button`;

  async deleteProductTest (productName: string): Promise<void> {
    await this.driver.pause(500);
    const rowLocator = `//android.widget.EditText[contains(@hint,"${productName}")]`;
    await this.isVisible(rowLocator);
    const row = await this.driver.$(rowLocator);
    await row.waitForDisplayed({ timeout: mobileConfig.timeouts.element });
    const loc = await row.getLocation();
    const size = await row.getSize();
    const centerY = loc.y + Math.floor(size.height / 2);
    await this.swipe(
      loc.x + 650,
      centerY,
      loc.x + 350,
      centerY
    );
    await this.driver.pause(1000);
    await this.tap(this.truckRouteInventoryDeleteButton(productName));
    await this.tap(this.deleteButton);
    await this.driver.waitUntil(
      async () => {
        const elements = await this.driver.$$(rowLocator);
        return await elements.length === 0;
      },
      {
        timeout: mobileConfig.timeouts.element,
        timeoutMsg: `Product '${productName}' was not deleted`
      }
    );
  }





















  async isLoaded(): Promise<boolean> {
    return this.isVisible(this.hamburgerIcon);
  }

  /** Ported from dashboard_keywords.robot's "Validate user is on the dashboard page". */
  async waitForDashboardLoaded(): Promise<void> {
    await this.waitFor(this.deliveriesTitle);
  }

  async tapStartDay(): Promise<void> {
    await this.tap(this.startDayButton);
  }

  /** TC006 "click on the Hamburger menu" - opens the nav drawer. */
  async openHamburgerMenu(): Promise<void> {
    await this.tap(this.hamburgerIcon);
  }

  /** Whether the nav drawer is open, per its own "Schedule overview" menu item - the hamburger icon itself is hidden behind the drawer once open, so this (not hamburgerIcon) is the visibility signal. */
  async isNavigationMenuVisible(): Promise<boolean> {
    return this.isVisible('~Schedule overview');
  }

  /** Closes the nav drawer via hardware back - the hamburger icon is hidden while the drawer is open, so re-tapping it isn't an option. */
  async closeHamburgerMenu(): Promise<void> {
    await this.pressKeyCode(4);
  }

  /** TC007 "view the System Date" - the day/date badge in the navigation bar (e.g. "Yesterday, Thu 23 Jul"). */
  async getCurrentDateText(): Promise<string> {
    const el = await this.driver.$(this.currentDateBadge);
    return (await el.getAttribute('content-desc')) ?? '';
  }

  /** TC012 "view route badge" - e.g. "Route 103". */
  async getRouteBadgeText(): Promise<string> {
    const el = await this.driver.$(this.routeBadge);
    return (await el.getAttribute('content-desc')) ?? '';
  }

  /** TC013 "view Deliveries" / TC014 "view remaining deliveries" (PBI 622025) - parsed from the shared "N Delivery/Deliveries" text. */
  async getDeliveriesCount(): Promise<number> {
    const el = await this.driver.$(this.deliveriesTitle);
    const desc = (await el.getAttribute('content-desc')) ?? '';
    return Number(/(\d+)/.exec(desc)?.[1]);
  }

  /**
   * TC015 "view Vending counter" (and the equivalent Market/Coffee counts,
   * part of PBI 622025's "dynamic" claim) - returns whichever LOBs actually
   * have a card rendered today (this screen only shows a LOB's badge when it
   * has scheduled stops - e.g. Miami/010 shows Market+Coffee, never Vending).
   */
  async getLobCounts(): Promise<Partial<Record<Lob, string>>> {
    const labelEls = await this.driver.$$(this.lobLabels);
    const countEls = await this.driver.$$(this.lobCountBadge);
    const result: Partial<Record<Lob, string>> = {};
    const labelCount = await labelEls.length;
    for (let i = 0; i < labelCount; i++) {
      const label = ((await labelEls[i].getAttribute('content-desc')) ?? '').toLowerCase() as Lob;
      const count = countEls[i] ? await countEls[i].getAttribute('content-desc') : null;
      if (count) {
        result[label] = count;
      }
    }
    return result;
  }

  async openEditSchedule(): Promise<void> {
    await this.tap(this.editScheduleButton);
    await this.waitFor(this.editScheduleTitle);
  }

  async isEditScheduleVisible(): Promise<boolean> {
    return this.isVisible(this.editScheduleTitle);
  }

  /**
   * TC036 "view Edit schedule order screen... with icon and list of stops
   * with names and addresses" - each stop row's content-desc is
   * "{address}\n{Name}" (live-verified, e.g. "19000 SW 192nd St Miami
   * Florida 33187-1908\nCureLeaf"), so this returns just the trailing name
   * line from every multi-line View on the (assumed already open) sheet.
   */
  async getEditScheduleStopNames(): Promise<string[]> {
    const els = await this.driver.$$('//android.view.View');
    const names: string[] = [];
    for (const el of els) {
      const desc = (await el.getAttribute('content-desc')) ?? '';
      if (desc.includes('\n')) {
        const parts = desc.split('\n');
        names.push(parts[parts.length - 1]);
      }
    }
    return names;
  }

  /**
   * TC037 "verify drag handle visibility" - each stop row (the same
   * multi-line View getEditScheduleStopNames() reads) renders a drag
   * handle icon on its right edge, live-confirmed visually, but with NO
   * accessible node of its own anywhere in the tree (baked into the row's
   * bitmap - see BaseScreen.hasNonWhiteIconNearRightEdge's own doc
   * comment). Returns true only if every stop row has one.
   */
  async areDragHandlesVisibleForAllStops(): Promise<boolean> {
    const els = await this.driver.$$('//android.view.View');
    const rows = [];
    for (const el of els) {
      const desc = (await el.getAttribute('content-desc')) ?? '';
      if (desc.includes('\n')) {
        rows.push(el);
      }
    }
    if (rows.length === 0) {
      return false;
    }
    for (const row of rows) {
      if (!(await this.hasNonWhiteIconNearRightEdge(row))) {
        return false;
      }
    }
    return true;
  }

  // PBI 850155 "Ad-hoc Scheduling" (TC025/027/028/029).
  //
  // TC027 "navigate to Ad-hoc delivery creation screen" - live-verified
  // 2026-07-24: the "+" icon next to the Schedule pane header has NO
  // content-desc/resource-id of its own (confirmed via dump - an unlabeled
  // clickable View), so it's targeted structurally as the immediate
  // following-sibling of the "Schedule" text. Confirmed reachable
  // regardless of whether the current day is empty or not (tested against
  // a day with 4 real deliveries) - opens an "Add Delivery" screen with a
  // Customer search field and Add Delivery / "+ Add Another Delivery"
  // buttons.
  private readonly addAdhocDeliveryButton = '//android.view.View[@content-desc="Schedule"]/following-sibling::android.view.View[1]';

  // TC025 "No deliveries available" message - UNVERIFIED locators below.
  // Live-confirmed the SHAPE of this empty state earlier the same day
  // (2026-07-24) on a genuinely zero-delivery day ("0 Delivery", "You do
  // not have an active deliveries for Fri 24 Jul. To add an ad-hoc
  // delivery, click the plus (+) icon", Start day shown disabled) - but
  // BA has since seeded data across every day on both known routes
  // (Miami/010 and Charlotte/103), so no zero-delivery day remains to
  // confirm the EXACT locator/content-desc for that message text right
  // now. Matched via the Excel's literal wording ("do not have"), tolerant
  // of the varying day/date suffix - needs re-verification once a
  // zero-delivery day exists again (tracked, not guessed away).
  private readonly noDeliveriesMessage = '//android.view.View[contains(@content-desc,"do not have")]';

  /** TC025 - true only when Deliveries is genuinely 0 AND the no-deliveries message is showing (see noDeliveriesMessage's caveat above). */
  async isDeliveriesEmptyStateVisible(): Promise<boolean> {
    const count = await this.getDeliveriesCount();
    return count === 0 && (await this.isVisible(this.noDeliveriesMessage));
  }

  /** TC025 "Start day button should be display as inactive" when there are no deliveries. */
  async isStartDayDisabled(): Promise<boolean> {
    return !(await this.isEnabled(this.startDayButton));
  }

  /** TC026 - the "+" icon (Schedule Ad-hoc Delivery's own primary CTA) is visible before it's tapped. */
  async isAdhocDeliveryButtonVisible(): Promise<boolean> {
    return this.isVisible(this.addAdhocDeliveryButton);
  }

  /** TC027/TC028 - opens the Ad-hoc delivery creation screen via the "+" icon. */
  async openAdhocDeliveryCreation(): Promise<void> {
    await this.tap(this.addAdhocDeliveryButton);
  }

  // Live-verified 2026-07-24: pressing BACK from a screen with unsaved
  // Sort/Filter selections (e.g. Vending's Product Fills) triggers a "Save
  // Changes! Your changes have not saved yet, Do you want to save?" dialog
  // (Discard/Save). A naive repeated-BACK loop presses BACK again on this
  // dialog, which just dismisses it back to the SAME screen - the very next
  // press re-triggers the identical dialog, looping forever and never
  // making progress. Must tap "Discard" explicitly instead.
  private readonly discardChangesButton = '~Discard';
  // A SECOND, differently-worded variant of the same dialog class - live-
  // verified 2026-08-05 on Market's Removals & Returns "Document product"
  // screen: "Save Changes / Do you want to save your changes? / No / Save"
  // (not "Discard"/"Save"). Same looping-forever risk as discardChangesButton
  // if not handled explicitly.
  private readonly saveChangesNoButton = '~No';
  // A THIRD variant, live-verified 2026-08-06 on Coffee's Pre-sales summary
  // screen ("Complete Pre-sale! Do you want to complete the pre-sale for
  // this service? / Skip pre-sale / Complete") - tapping "Skip pre-sale"
  // leaves the order as already saved (this dialog is about completing the
  // SERVICE, not discarding the order) and continues navigating back,
  // matching returnToHome's intent of leaving state alone.
  private readonly skipPresaleButton = '~Skip pre-sale';

  /**
   * Navigates back to Dashboard from wherever the app currently is - used to
   * let multiple tests share one login session (see vending-service.spec.ts)
   * instead of each paying the manual-MFA-approval cost of a fresh login.
   *
   * CORRECTED: this can't be done with plain repeated BACK presses alone -
   * live-verified this app's back-stack is NOT a simple linear chain back to
   * Dashboard. From Vending's Product Fills (after Sort/Filter, no hamburger
   * icon - only a back arrow), one BACK press reaches the machine's task
   * list (still no hamburger), a second reaches the stop-detail screen
   * ("Aaron's" - hamburger IS present here), but a THIRD exits the app
   * entirely to the OS launcher instead of reaching Dashboard - there is no
   * intermediate Dashboard entry in that back-stack to land on. So this
   * instead presses BACK only until any screen with the hamburger menu is
   * reached, then uses the app's own "Schedule overview" nav item (found in
   * the hamburger menu, live-verified) to deterministically reach Dashboard,
   * rather than continuing to guess with more back-presses. Also handles the
   * "Save Changes" dialog (see discardChangesButton) by tapping Discard
   * instead of pressing BACK again, which would otherwise loop forever.
   *
   * CORRECTED (live-verified 2026-08-06): the hardware BACK button
   * (pressKeyCode(4)) is a no-op on at least one screen (Coffee's
   * Pre-sales summary) - it neither navigates nor opens the confirm
   * dialog below, so a loop that only ever presses hardware BACK gets
   * stuck there for all maxBackPresses attempts. The on-screen back arrow
   * (BaseScreen.backButton) reliably triggers the real in-app back action
   * on that same screen. Now prefers tapping it when visible, falling
   * back to hardware BACK only when it isn't (e.g. genuinely no back
   * arrow on screen).
   */
  async returnToHome(maxBackPresses = 10): Promise<void> {
    let reachedHamburger = false;
    for (let i = 0; i < maxBackPresses; i++) {
      if (await this.isVisible(this.hamburgerIcon)) {
        reachedHamburger = true;
        break;
      }
      if (await this.isVisible(this.discardChangesButton)) {
        await this.tap(this.discardChangesButton);
      } else if (await this.isVisible(this.saveChangesNoButton)) {
        await this.tap(this.saveChangesNoButton);
      } else if (await this.isVisible(this.skipPresaleButton)) {
        await this.tap(this.skipPresaleButton);
      } else if (await this.isVisible(this.skipButton)) {
        // Prep Tasks' own back-press Skip/Complete popup (see
        // PrepTasksScreen.isBackPressPopupVisible) - live-verified
        // 2026-08-07: without this, tapping the sub-screen's back arrow
        // just opens this popup, and neither hardware BACK nor a repeat
        // backButton tap reliably dismisses it (observed oscillating
        // between the popup and the checklist screen for the full
        // maxBackPresses budget, never reaching the hamburger). Skip is
        // the same "leave without completing" semantics this loop wants.
        await this.tap(this.skipButton);
      } else if (await this.isVisible(this.selectADaySheetTodayOption)) {
        // The date badge's own "Select a day" bottom sheet (TODAY/
        // YESTERDAY/TOMORROW cards) - live-verified 2026-08-07: hardware
        // BACK does not dismiss it, leaving the loop stuck for the full
        // maxBackPresses budget. Tapping TODAY re-confirms whichever day
        // is already selected in the common case and simply closes the
        // sheet - a safe, idempotent way out regardless of which day the
        // caller actually wanted (a real day switch, if needed, happens
        // separately via RouteSetupScreen/switchRoute).
        await this.tap(this.selectADaySheetTodayOption);
      } else if (await this.isVisible(this.backButton)) {
        await this.tap(this.backButton);
      } else {
        await this.pressKeyCode(4);
      }
      await this.driver.pause(700);
    }
    if (!reachedHamburger) {
      throw new Error(`returnToHome: no screen with the hamburger menu appeared after ${maxBackPresses} BACK presses`);
    }
    await this.tap(this.hamburgerIcon);
    await this.tap('~Schedule overview');
    await this.waitFor(this.deliveriesTitle);
  }
}
