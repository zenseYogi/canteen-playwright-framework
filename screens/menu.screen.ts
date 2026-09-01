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

  private readonly hamburgerMenu =
    '//android.widget.Button[@content-desc="Open navigation menu"]';
  private readonly discardChangesButton = '~Discard';
  private readonly saveChangesNoButton = '~No';

  /**
   * Verifies that the device information header is visible on the settings screen.
   *
   * @returns {Promise<boolean>} Resolves to true when the device information section is displayed.
   */
  async isDeviceInformationHeaderDisplayed(): Promise<boolean> {
    return await this.driver.$(this.deviceInfoHeader).isDisplayed();
  }

  /**
   * Checks whether the User label is visible in the device information panel.
   *
   * @returns {Promise<boolean>} Resolves to true when the user label is present.
   */
  async isUserDisplayed(): Promise<boolean> {
    return await this.driver.$(this.userLabel).isDisplayed();
  }

  private readonly settingsMenu =
    '//android.view.View[contains(@content-desc,"Settings")]';

  private readonly deviceInfoMenu =
    '//android.widget.Button[@content-desc="Device info"]';

  /**
   * Reads the current user name from the device information screen.
   *
   * @returns {Promise<string>} The user name value displayed in the device info panel.
   * @throws {Error} Throws when no user value is available in the UI.
   */
  async getUserName(): Promise<string> {
    const value = await this.driver.$(this.userName)
      .getAttribute('content-desc');
    if (!value) {
      throw new Error('Username value not found');
    }
    return value;
  }

  /**
   * Verifies that the user name value is displayed in the device information section.
   *
   * @returns {Promise<boolean>} Resolves to true when the user name is populated.
   */
  async isUserNameDisplayed(): Promise<boolean> {
    const user = await this.getUserName();
    return user.trim().length > 0;
  }

  /**
   * Checks whether the security functions label is visible.
   *
   * @returns {Promise<boolean>} Resolves to true when the security functions field is shown.
   */
  async isSecurityFunctionsDisplayed(): Promise<boolean> {
    return await this.driver.$(this.securityFunctionsLabel)
      .isDisplayed();
  }

  /**
   * Reads the configured security permissions value from the device information screen.
   *
   * @returns {Promise<string>} The security functions value shown for the logged-in user.
   * @throws {Error} Throws when the value cannot be retrieved from the screen.
   */
  async getSecurityFunctions(): Promise<string> {
    const value = await this.driver.$(this.securityFunctionsValue)
      .getAttribute('content-desc');
    if (!value) {
      throw new Error('Security functions value not found');
    }
    return value;
  }

  /**
   * Confirms whether any security permission text is present.
   *
   * @returns {Promise<boolean>} Resolves to true when the security function value has content.
   */
  async hasSecurityPermissions(): Promise<boolean> {
    const permissions = await this.getSecurityFunctions();
    return permissions.trim().length > 0;
  }

  /**
   * Checks whether the Last sync label is visible.
   *
   * @returns {Promise<boolean>} Resolves to true when the sync label is displayed.
   */
  async isLastSyncDisplayed(): Promise<boolean> {
    return await this.driver.$(this.lastSyncLabel)
      .isDisplayed();
  }

  /**
   * Reads the current last sync value from the device information screen.
   *
   * @returns {Promise<string>} The current sync timestamp or status value.
   * @throws {Error} Throws when the last sync field is missing or empty.
   */
  async getLastSyncValue(): Promise<string> {
    const value = await this.driver
      .$(this.lastSyncValue)
      .getAttribute('content-desc');

    if (!value) {
      throw new Error('Last sync value not found');
    }

    return value;
  }

  /**
   * Verifies that the last sync value contains usable content.
   *
   * @returns {Promise<boolean>} Resolves to true when a sync value is available.
   */
  async hasLastSyncValue(): Promise<boolean> {
    const value = await this.getLastSyncValue();
    return value.trim().length > 0;
  }

  /**
   * Opens the navigation drawer from the hamburger menu.
   *
   * @returns {Promise<void>} Resolves once the menu is opened.
   */
  async openNavigationMenu(): Promise<void> {
    const menu = await this.driver.$(this.hamburgerMenu);
    await menu.waitForDisplayed({ timeout: 10000 });
    await menu.click();
  }

  /**
   * Opens the Settings section from the navigation menu.
   *
   * @returns {Promise<void>} Resolves once the Settings section is expanded or available.
   */
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

  /**
   * Opens the Device information screen from the Settings menu.
   *
   * @returns {Promise<void>} Resolves once the device information page is loaded.
   */
  async openDeviceInfo(): Promise<void> {
    const deviceInfo = await this.driver.$(this.deviceInfoMenu);

    await deviceInfo.waitForDisplayed({ timeout: 10000 });
    await deviceInfo.click();

    await this.driver.$(
      '//android.view.View[@content-desc="Device information"]'
    ).waitForDisplayed({ timeout: 10000 });
  }

  /**
   * Checks whether a product with the given name is visible on screen.
   *
   * @param {string} productName - The product name to search for.
   * @returns {Promise<boolean>} Resolves to true when the product row is visible.
   */
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

  /**
   * Checks whether an added product row is visible for the given name.
   *
   * @param {string} productName - The resolved product name to look up.
   * @returns {Promise<boolean>} Resolves to true when the product row is displayed.
   */
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

  /**
   * Verifies that a product row has additional details beyond just the name.
   *
   * @param {string} productName - The product name to inspect.
   * @returns {Promise<boolean>} Resolves to true when the content description contains extra detail text.
   */
  async hasProductDetails(productName: string): Promise<boolean> {
    const details = await this.getProductDetails(productName);

    return (
      details.includes(productName) &&
      details.trim().length > productName.length
    );
  }

  /**
   * Reads the content description for the matched product row.
   *
   * @param {string} productName - The product name to read details for.
   * @returns {Promise<string>} The product row content description, or an empty string when unavailable.
   */
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

  /**
   * Verifies that the Route Shopping title is visible.
   *
   * @returns {Promise<boolean>} Resolves to true when the Route shopping heading is shown.
   */
  async isRouteShoppingTitleDisplayed(): Promise<boolean> {
    return await this.driver.$(this.routeShoppingTitle).isDisplayed();
  }

  /**
   * Reads the warehouse details text displayed for the active route.
   *
   * @returns {Promise<string>} The warehouse label or an empty string if not found.
   */
  async getWarehouseDetails(): Promise<string> {
    const value = await this.driver
      .$(this.warehouseDetails)
      .getAttribute('content-desc');

    return value ?? '';
  }

  /**
   * Checks whether the warehouse details are visible on the route shopping screen.
   *
   * @returns {Promise<boolean>} Resolves to true when the warehouse metadata is displayed.
   */
  async isWarehouseDetailsDisplayed(): Promise<boolean> {
    return await this.driver.$(this.warehouseDetails).isDisplayed();
  }

  /**
   * Reads the full row details for a given product in the current list.
   *
   * @param {string} productName - The product name to inspect.
   * @returns {Promise<string>} The product row content description or an empty string when unavailable.
   */
  async getProductRowDetails(productName: string): Promise<string> {
    const value = await this.driver
      .$(this.productRow(productName))
      .getAttribute('content-desc');

    return value ?? '';
  }

  /**
   * Validates that a product row includes the expected quantity text.
   *
   * @param {string} productName - The product name to validate.
   * @param {string} quantity - The expected quantity string such as x1 or 2.
   * @returns {Promise<boolean>} Resolves to true when both the name and quantity are found in the row details.
   */
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

  /**
   * Opens the Route Shopping view from the navigation menu.
   *
   * @returns {Promise<void>} Resolves once Route Shopping is loaded.
   */
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

  /**
   * Adds a product to Route Shopping and returns the fully resolved product name.
   *
   * @param {string} [searchTerm='can'] - The product search term to use.
   * @returns {Promise<string>} The resolved product name selected from the catalog.
   */
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

  /**
   * Reads the product name currently displayed in the quantity field hint.
   *
   * @returns {Promise<string>} The visible product name for the currently focused row.
   */
  async getProductName(): Promise<string> {
    const hint = await this.driver
      .$(this.quantityFieldBox)
      .getAttribute('hint');
    const value = hint ?? '';
    return value.split('\n')[0].trim();
  }

  /**
   * Searches for a product and selects the option at the requested index.
   *
   * @param {string} value - The search text to enter.
   * @param {number} [position=0] - The matching result index to select.
   * @returns {Promise<string | null>} The normalized product name if a result was selected, otherwise null.
   */
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


  /**
   * Opens the edit screen for a previously added product row.
   *
   * @param {string} productName - The product name to edit.
   * @returns {Promise<void>} Resolves once the product detail editor is opened.
   */
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

  /**
   * Updates the quantity value for a given product in the edit dialog.
   *
   * @param {string} productName - The product row whose quantity will be edited.
   * @param {number} quantity - The new numeric quantity to set.
   * @returns {Promise<void>} Resolves when the numeric value is confirmed and validated.
   */
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






  /**
   * Saves the current route shopping edits and waits for the screen to reload.
   *
   * @returns {Promise<void>} Resolves after the save action completes.
   */
  async saveChanges(): Promise<void> {
    await this.tap(this.doneButton);
    await this.waitFor(this.routeShoppingTitle);
  }

  /**
   * Verifies that a product quantity matches the expected value after saving.
   *
   * @param {string} productName - The product name to check.
   * @param {string} expectedQty - The expected quantity string.
   * @returns {Promise<boolean>} Resolves to true when the saved quantity matches the expected value.
   */
  async verifySavedQuantity(
    productName: string,
    expectedQty: string
  ): Promise<boolean> {
    await this.editAddedProduct(productName);
    const actualQty = await this.getQuantity(productName);
    await this.saveChanges();
    return actualQty === expectedQty;
  }


  /**
   * Reads the current quantity text for a product row.
   *
   * @param {string} productName - The product name to read.
   * @returns {Promise<string>} The quantity value currently displayed in the row.
   */
  async getQuantity(productName: string): Promise<string> {
    const value = await this.driver
      .$(this.quantityField(productName))
      .getAttribute('text');

    return value ?? '';
  }

  /**
   * Confirms that discarding edits restores the original product value.
   *
   * @param {string} productName - The product being checked.
   * @param {string} originalQty - The expected restored quantity.
   * @returns {Promise<void>} Resolves after the discard verification completes.
   */
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

  /**
   * Discards the current product edits and returns to the Route Shopping screen.
   *
   * @returns {Promise<void>} Resolves once the discard flow is confirmed.
   */
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



  /**
   * Deletes an added product from the current Route Shopping list.
   *
   * @param {string} productName - The product to remove.
   * @returns {Promise<void>} Resolves after the row is removed and the screen is saved.
   */
  async deleteProduct(productName: string): Promise<void> {
    await this.editAddedProduct(productName);
    await this.swipeAndDelete(this.recordByHint(productName));
    await this.tap(this.doneButton);
  }

  /**
   * Taps the screen back arrow to navigate backward.
   *
   * @returns {Promise<void>} Resolves after the back action is triggered.
   */
  async tapBackArrow(): Promise<void> {
    await this.tap(this.backButton);
  }

  /**
   * Reads the numeric quantity for a product from the visible list row.
   *
   * @param {string} productName - The product name to inspect.
   * @returns {Promise<number>} The parsed product quantity as a number, or 0 when not found.
   */
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

  /**
   * Validates the product count shown on a route transfer card.
   *
   * @param {string} routeName - The route or warehouse label to inspect.
   * @param {number} expectedCount - The expected product total count.
   * @returns {Promise<void>} Resolves after asserting the count matches.
   */
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

  /**
   * Validates that a specific product and quantity are presented in a route transfer card.
   *
   * @param {string} routeName - The route or warehouse label to inspect.
   * @param {string} productName - The product expected to appear in the route transfer.
   * @param {number} expectedQty - The expected transfer quantity.
   * @returns {Promise<void>} Resolves after asserting the product details match the expected content.
   */
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


  /**
   * Opens the product details drawer for the provided route card.
   *
   * @param {string} routeName - The route label whose details should be opened.
   * @returns {Promise<void>} Resolves once the details panel is opened.
   */
  async openProductDetails(routeName: string): Promise<void> {
    const icon = await this.driver.$(`//android.view.View[contains(@content-desc,"${routeName}")]/android.view.View`
    );
    await icon.waitForDisplayed({ timeout: 10000 });
    await icon.click();
  }
  private readonly anyRouteOption = '//android.view.View[starts-with(@content-desc,"Route ")]';

  /**
   * Checks whether the route label is present in the route picker list.
   *
   * @param {string} routeLabel - The route label to look for.
   * @returns {Promise<boolean>} Resolves to true when the selected route is available in the list.
   */
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
  /**
   * Reads the warehouse name from the Route setup header.
   *
   * @returns {Promise<string>} The route warehouse name extracted from the header text.
   */
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

  /**
   * Builds the locator for the Start day element tied to a specific route.
   *
   * @param {string} route - The route label to match in the start-day content description.
   * @returns {string} A locator string for the matching route start-day element.
   */
  titleStartDayAndRoute(route: string): string {
    return `//android.view.View[starts-with(@content-desc,"Start day") and contains(@content-desc,"${route}")]`;
  }


  protected readonly changeRoutePopup =
    '//android.view.View[contains(@content-desc,"Change route")]';

  /**
   * Validates the route change confirmation popup content before proceeding.
   *
   * @returns {Promise<void>} Resolves after asserting the warning header and message are present.
   */
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

  /**
   * Checks whether the Route setup header is currently visible.
   *
   * @returns {Promise<boolean>} Resolves to true when the route setup screen is loaded.
   */
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



  /**
   * Adds a product to Truck Stock with specified damaged and spoiled quantities.
   *
   * @param {string} lob - The line of business tab to use (for example Coffee or Market).
   * @param {string} searchTerm - The product lookup term.
   * @param {number} damagedQuantity - Quantity to assign as damaged.
   * @param {number} spoiledQuantity - Quantity to assign as spoiled.
   * @returns {Promise<string>} The selected product name after save.
   */
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
  /**
   * Reads the product name shown in the add-product confirmation dialog.
   *
   * @returns {Promise<string>} The selected product name from the detail screen.
   */
  async getSelectedProductName(): Promise<string> {
    const el = await this.driver.$(this.selectedProductName);
    return (await el.getAttribute('content-desc')) ?? '';
  }

  private readonly navMenuTruckReturns = '//android.widget.Button[@content-desc="Truck Returns"]';

  /**
   * Opens the Truck Returns screen via the navigation menu.
   *
   * @returns {Promise<void>} Resolves once the Truck Returns screen is visible.
   */
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

  /**
   * Validates the quantity shown for a Truck Return product row.
   *
   * @param {string} productName - The product to validate.
   * @param {number} expectedQuantity - The expected numeric quantity.
   * @returns {Promise<void>} Resolves after the row quantity assertion passes.
   */
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

  /**
   * Deletes a product from a Truck Returns tab.
   *
   * @param {string} lob - The current LOB tab name.
   * @param {string} productName - The product to delete.
   * @returns {Promise<void>} Resolves once the product is removed from the list.
   */
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




  /**
   * Checks whether a Truck Returns product row has been removed.
   *
   * @param {string} productName - The product name to verify is deleted.
   * @returns {Promise<boolean>} Resolves to true if the row is no longer displayed.
   */
  async verifyTruckReturnsProductDeleted(productName: string): Promise<boolean> {
    return this.verifyProductDeleted(productName, this.truckReturnProductRow(productName));
  }

  /**
   * Verifies that a product row is no longer present in the matching locator.
   *
   * @param {string} productName - The product name being checked.
   * @param {string} locator - The selector used to find the product row.
   * @returns {Promise<boolean>} Resolves to true when the row disappears within the timeout.
   */
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


  /**
   * Adds one or more products into the selected Route Inventory tab.
   *
   * @param {string} lob - The line-of-business tab name.
   * @param {InventoryType} type - The inventory type, either audit or cycle.
   * @param {{ count?: number; searchTerm?: string }} [opts={}] - Optional count and search term overrides.
   * @returns {Promise<string>} The last added product name after the action completes.
   */
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


  /**
   * Opens a specific Route Inventory tab for a line of business and inventory type.
   *
   * @param {string} lob - The line-of-business tab to open.
   * @param {InventoryType} type - The inventory tab type to select.
   * @returns {Promise<void>} Resolves once the tab is opened.
   */
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

  /**
   * Opens the Route Inventory screen from the hamburger menu.
   *
   * @returns {Promise<void>} Resolves once the Route Inventory page is visible.
   */
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


  /**
   * Checks that a Route Inventory product row shows the expected quantity.
   *
   * @param {string} productName - The product name to validate.
   * @param {number} quantity - The expected quantity.
   * @returns {Promise<void>} Resolves after the quantity assertion passes.
   */
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



  /**
   * Waits until a product row is removed from the Route Inventory list.
   *
   * @param {string} productName - The product expected to be absent.
   * @returns {Promise<void>} Resolves once the product is no longer visible.
   */
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



  /**
   * Deletes a product from a Route Inventory row.
   *
   * @param {string} lob - The LOB tab to use.
   * @param {string} productName - The product to delete.
   * @returns {Promise<void>} Resolves after the product is removed from the inventory list.
   */
  async deleteRouteInventoryProduct(lob: string, productName: string): Promise<void> {
    await this.tap(this.lobTab(lob));
    await this.waitFor(this.addedProductRow(productName));
    await this.tap(this.addedProductRow(productName));
    await this.waitFor(this.recordByHint(productName));
    await this.deleteProductTest(productName);
  }

  private truckRouteInventoryDeleteButton = (productName: string) =>
    `//android.widget.EditText[contains(@hint,"${productName}")]/android.widget.Button`;

  /**
   * Deletes a product after swiping the inventory row and confirming the delete action.
   *
   * @param {string} productName - The product row to delete.
   * @returns {Promise<void>} Resolves once the row disappears from the screen.
   */
  async deleteProductTest(productName: string): Promise<void> {
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





  // A THIRD variant, live-verified 2026-08-06 on Coffee's Pre-sales summary
  // screen ("Complete Pre-sale! Do you want to complete the pre-sale for
  // this service? / Skip pre-sale / Complete") - tapping "Skip pre-sale"
  // leaves the order as already saved (this dialog is about completing the
  // SERVICE, not discarding the order) and continues navigating back,
  // matching returnToHome's intent of leaving state alone.
  private readonly skipPresaleButton = '~Skip pre-sale';

  /**
   * Navigates back to the Dashboard by following the app's back stack and handling common dialogs.
   *
   * @param {number} [maxBackPresses=10] - Maximum number of back attempts before failing.
   * @returns {Promise<void>} Resolves once the dashboard is reached from the current screen.
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
