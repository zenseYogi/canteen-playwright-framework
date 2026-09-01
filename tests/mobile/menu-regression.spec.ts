import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndEnsureRoute, loginAndWaitForMfa } from '../../utils/login-flow';
import { TruckStockTruckReturnsScreen } from '../../screens/truck-stock-truck-returns.screen';
import { HomeScreen } from '../../screens/home.screen';
import { mobileConfig } from '../../config/mobile.config';
import { DashboardScreen } from '@screens/dashboard.screen';
import { MenuScreen } from '@screens/menu.screen';
import { TruckStockRouteShoppingScreen } from '@screens/truck-stock-route-shopping.screen';
import { PrepTasksScreen } from '@screens/prep-tasks.screen';
import { TransfersScreen } from '@screens/transfers.screen';
import { RouteSetupScreen } from '@screens/route-setup.screen';

// Ported from test.robot's three active Truck Returns cases ("...open the truck
// returns screen", "...add products under the coffee tab...", "...delete
// products under the coffee tab..."). RF ran these as separate test cases
// against one shared, already-authenticated Suite Setup session; here they're
// steps in one test, since every Playwright test re-runs the full Login ->
// Password -> manual-MFA-approval preamble from a freshly cleared app (see
// appium.fixture.ts) and that wait is too expensive to repeat three times.
test.describe('Truck Stock - Truck Returns', () => {
  // Same reasoning as the rest of this suite: every test here leaves the
  // app wherever the last step landed under KEEP_APP_SESSION - return to
  // Dashboard after each so no test inherits a stale screen from whichever
  // ran before it.
  // test.afterEach(async ({ driver }) => {
  //   await new HomeScreen(driver).returnToHome().catch(() => { });
  // });

  test.afterEach(async ({ driver}, testInfo) => {
      // Same failure-screenshot capture appium.fixture.ts's driver fixture
      // normally does per test - reproduced here since this file bypasses it.
      if (testInfo.status !== testInfo.expectedStatus) {
        try {
          const screenshotPath = testInfo.outputPath('failure.png');
          await driver.saveScreenshot(screenshotPath);
          await testInfo.attach('failure-screenshot', { path: screenshotPath, contentType: 'image/png' });
        } catch (e) {
          console.warn('Could not capture failure screenshot:', e);
        }
      }
      await new HomeScreen(driver).returnToHome();
    });





  test('Menu', async ({ driver }) => {
    const home = new HomeScreen(driver);
    const dashboard = new DashboardScreen(driver);
    const menu = new MenuScreen(driver);

    await test.step('Log in', async () => {
      await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
    });

    await test.step('Device Information screen displays user, permissions, and sync details', async () => {
      await menu.openNavigationMenu();
      await menu.openSettings();
      await menu.openDeviceInfo();

      expect(await menu.isDeviceInformationHeaderDisplayed()).toBe(true);
      expect(await menu.isUserDisplayed()).toBe(true);
      expect(await menu.isUserNameDisplayed()).toBe(true);
      expect(await menu.isSecurityFunctionsDisplayed()).toBe(true);
      expect(await menu.hasSecurityPermissions()).toBe(true);
      expect(await menu.isLastSyncDisplayed()).toBe(true);
      expect(await menu.hasLastSyncValue()).toBe(true);
    });

  });




  // test('Truck returns, add a product under Coffee, then delete it', async ({ driver }) => {
  //   const truckReturns = new TruckStockTruckReturnsScreen(driver);
  //   const menu = new MenuScreen(driver);
  //   let productName = '';

  //   await test.step('Log in', async () => {
  //     await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
  //   });

  //   await test.step('Open the Truck returns screen', async () => {
  //     await truckReturns.open();
  //   });

  //   await test.step('Add a product under Coffee', async () => {
  //     productName = await truckReturns.addProduct('coffee', 'Kit Kat', 1);
  //   });

  //   await test.step('Delete the added product under Coffee', async () => {
  //     await truckReturns.deleteProduct('coffee', productName);
  //   });

  //   await test.step('Add a product under Coffee', async () => {
  //     productName = await truckReturns.addProduct('coffee', 'Kit Kat', 0);
  //   });

  //   await test.step('verify Deleted product is not displayed', async () => {
  //     expect(await menu.isProductPresent(productName)).toBe(false);
  //   });

  // });


// /passed
  test.skip('truckReturnsRouteShopping, Driver searches or scans products in Route Shopping', async ({ driver }) => {
    const truckReturnsRouteShopping = new TruckStockRouteShoppingScreen(driver);
    const menu = new MenuScreen(driver);

    await test.step('Log in', async () => {
      // await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      // await loginAndEnsureRoute(driver, mobileConfig.vendingRoute);
    });

    var productName: string = 'A&W Rt Beer CN 12oz';
    await test.step('Driver searches or scans products in Route Shopping', async () => {
      productName = await menu.addProduct('can');
      console.log(`Added Product: ${productName}`);
      expect(
        await menu.isProductDisplayed(productName)
      ).toBe(true);
      expect(
        await menu.hasProductDetails(productName)
      ).toBe(true);
    });

    await test.step(
      'Driver searches or scans products in Route Shopping',
      async () => {
        expect(await menu.isRouteShoppingTitleDisplayed()).toBe(true);
        expect(await menu.isWarehouseDetailsDisplayed()).toBe
        expect(await menu.verifyProductQuantity(productName, 'x1')).toBe(true);

      }
    );

    await test.step(
      'Driver updates products in Route Shopping',
      async () => {
        expect(await menu.isRouteShoppingTitleDisplayed()).toBe(true);
        expect(await menu.isWarehouseDetailsDisplayed()).toBe(true);
        expect(await menu.verifyProductQuantity(productName, 'x1')).toBe(true);

      }
    );

    await test.step(
      'Route shopping supports add, update, delete, save, and discard',
      async () => {

        const productName = await menu.addProduct('can');
        expect(await menu.verifySavedQuantity(productName, '2')).toBe(true);
        // await menu.editAddedProduct(productName);
        // await menu.updateQuantity(2);
        // await menu.updateQuantity('A&W Rt Beer CN 12oz', 2 );
        // await menu.saveChanges();
        // await menu.addProduct('can');

        await menu.tap(menu.addProductButton);
        await menu.searchAndSelect('can');
        await menu.discardChanges();
        expect(await menu.verifyProductQuantity(productName, '2')).toBe(true);
        // await menu.verifyDiscardRestoresValue(productName, '2');
        await menu.deleteProduct(productName);
      }
    );

  });








  test('Search with no match or invalid scan does not select wrong product [Route shopping]', async ({ driver }) => {
    const truckReturnsRouteShopping = new TruckStockRouteShoppingScreen(driver);
    const menu = new MenuScreen(driver);
    const prepTasks = new PrepTasksScreen(driver);

    await test.step('Log in', async () => {
      // await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
    });

    await test.step('Search with no match or invalid scan does not select wrong product', async () => {
      await menu.openRouteShopping();
      await menu.tap(menu.addProductButton);
      // menu.addProduct
      const invalidProductName = 'zzzzznonexistentproduct999';
      await prepTasks.openSearchDialog();
      await prepTasks.searchForNonExistentProduct('zzzzznonexistentproduct999');
      expect(await prepTasks.isNoSearchResultsVisible()).toBe(true);
      await driver.back();
      // await driver.pressKeyCode(4);
      // Verify no product was added to Route Shopping
      await driver.back();
      await menu.tap("~Done");
      expect(await menu.isProductDisplayed(invalidProductName)).toBe(false);
      // expect(await menu.verifyProductQuantity(invalidProductName, '1')).toBe(false);
    });

  })


  test('TC009: Search and scan return expected product across key modules [Route shopping]', async ({ driver }) => {
    const truckReturnsRouteShopping = new TruckStockRouteShoppingScreen(driver);
    const menu = new MenuScreen(driver);
    const prepTasks = new PrepTasksScreen(driver);

    await test.step('Log in', async () => {
      // await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
    });

    var productName: string = 'Kit Kat Big Kat';
    await test.step('Driver searches or scans products in Route Shopping', async () => {
      // productName = await menu.addProduct('Kit Kat Big Kat (1.5oz)');
      await menu.openRouteShopping();
      // const productFullName = await menu.addProduct(productName);
      await menu.tap(menu.addProductButton);
      await menu.searchAndSelectProducts(productName);
      const productFullName = await menu.getProductName();
      await menu.tap(menu.doneButton);
      console.log(`Added Product: ${productFullName}`);
      expect(await menu.verifyProductQuantity(productFullName, '1')).toBe(true);
    });
  })
});


test.describe('Menu - Route to Route Transfers', () => {
  // test.afterEach(async ({ driver }) => {
  //   await new HomeScreen(driver).returnToHome().catch(() => { });
  // });

  test(
    'Search and scan in transfer workflows [Transfers - Route to Route]',
    { tag: ['@Menu-TC010', '@Menu-TC011', '@Menu-TC012', '@Menu-TC013'] },
    async ({ driver }) => {
      const transfers = new TransfersScreen(driver);
      const menu = new MenuScreen(driver);
      const home = new HomeScreen(driver);
      let driverDefaultRoute = '';
      await test.step('Log in', async () => {
        // await loginAndEnsureRoute(driver, mobileConfig.vendingRoute);
        driverDefaultRoute = await home.getRouteBadgeText();
      });
      let routeLabel = '';

      await test.step('Transfers landing page shows its LOB and transfer-type tabs', async () => {
        await transfers.open();
        expect(await transfers.isTransfersTitleVisible()).toBe(true);
        const tabs = await transfers.isLandingPageVisible();
        expect(tabs.coffee).toBe(true);
        expect(tabs.market).toBe(true);
        expect(tabs.vending).toBe(true);
        expect(tabs.routeToRoute).toBe(true);
        expect(tabs.routeToWarehouse).toBe(true);
        const icons = await transfers.isHeaderIconsVisible();
        expect(icons.hamburger).toBe(true);
        expect(icons.plus).toBe(true);
        expect(await transfers.isEmptyStateMessageVisible()).toBe(true);
        await transfers.openSelectRouteSheet();
        expect(await transfers.isSelectRouteSheetVisible()).toBe(true);
        expect(await transfers.isAnyRouteOptionVisible()).toBe(true);
        expect(await menu.isRouteDisplayed(driverDefaultRoute)).toBe(false);
        routeLabel = await transfers.selectFirstAvailableRoute();
        expect(await transfers.isRouteCardVisibleWithProductCount(routeLabel, 0)).toBe(true);
      });

      await test.step('searching a non-matching term shows no search results found', async () => {
        await transfers.openRtrDetails(routeLabel);
        await menu.searchAndSelectProducts('zzznonexistentproduct123');
        await driver.waitUntil(async () => transfers.isNoSearchResultsFoundVisible(), {
          timeout: 15000
        });
        expect(await transfers.isNoSearchResultsFoundVisible()).toBe(true);
        await transfers.pressKeyCode(4);
        await transfers.pressKeyCode(4);
      });
      let product = '';
      await test.step('Set up: create a route-to-route transfer, open RTR Details, and add a product', async () => {
        await transfers.searchAndSelect('can');
        product = await menu.getProductName();
        await transfers.tapQtyDigit(5);
        expect(await transfers.getQtyValue()).toBe('5');
        for (let i = 0; i < 10; i++) {
          await transfers.tapQtyDigit(9);
        }
        const capped = await transfers.getQtyValue();
        expect(capped).toBe('599');
      });

      await test.step('confirming via the checkmark keeps the capped value', async () => {
        await transfers.confirmQty();
        expect(await transfers.getQtyValue()).toBe('599');
        await transfers.closeRtrDetails();
        await menu.openProductDetails(routeLabel);
        await menu.verifyRouteTransferTotalProducts(routeLabel, 1);
        await menu.verifyRouteTransferProduct(routeLabel, product, 599);
        // await transfers.pressKeyCode(4);
        // await transfers.deleteRoute('coffee', 'routeToRoute', routeLabel);
      });

      await test.step('Market search returns expected product', async () => {
        await transfers.tap('~Market');
        await transfers.openSelectRouteSheet();
        routeLabel = await transfers.selectFirstAvailableRoute();
        expect(await transfers.isRouteCardVisibleWithProductCount(routeLabel, 0)).toBe(true);
        await transfers.openRtrDetails(routeLabel);
        await transfers.searchAndSelect('chips');
        const product = await menu.getProductName();
        await transfers.confirmQty();
        // await transfers.pressKeyCode(4);
        expect(product).toBeTruthy();
        await transfers.confirmQty();
        await menu.openProductDetails(routeLabel);
        await menu.verifyRouteTransferTotalProducts(routeLabel, 1);
        await menu.verifyRouteTransferProduct(routeLabel, product, 1);

      });

      await test.step('Vending search returns expected product', async () => {
        await transfers.tap('~Vending');
        await transfers.openSelectRouteSheet();
        routeLabel = await transfers.selectFirstAvailableRoute();
        expect(await transfers.isRouteCardVisibleWithProductCount(routeLabel, 0)).toBe(true);
        await transfers.openRtrDetails(routeLabel);
        await transfers.searchAndSelect('can');
        const product = await menu.getProductName();
        await transfers.confirmQty();
        expect(product).toBeTruthy();
        await transfers.confirmQty();
        await menu.openProductDetails(routeLabel);
        await menu.verifyRouteTransferTotalProducts(routeLabel, 1);
        await menu.verifyRouteTransferProduct(routeLabel, product, 1);
      });
    });
});






test.describe('Menu - Route to Warehouse Transfers', () => {
  // test.afterEach(async ({ driver }) => {
  //   await new HomeScreen(driver).returnToHome().catch(() => { });
  // });

  test(
    'Search and scan in transfer workflows [Transfers - Route to Warehouse]',
    { tag: ['@Menu-TC014', '@Menu-TC015', '@Menu-TC016', '@Menu-TC017'] },
    async ({ driver }) => {
      const transfers = new TransfersScreen(driver);
      const menu = new MenuScreen(driver);
      const home = new HomeScreen(driver);
      let driverDefaultRoute = '';
      await test.step('Log in', async () => {
        // await loginAndEnsureRoute(driver, mobileConfig.vendingRoute);
        driverDefaultRoute = await home.getRouteBadgeText();
      });
      let warehouseName = '';

      await test.step('Transfers landing page shows its LOB and transfer-type tabs', async () => {
        warehouseName = await menu.getRouteWarehouseName();
        await transfers.open();
        expect(await transfers.isTransfersTitleVisible()).toBe(true);
        const tabs = await transfers.isLandingPageVisible();
        expect(tabs.coffee).toBe(true);
        expect(tabs.market).toBe(true);
        expect(tabs.vending).toBe(true);
        expect(tabs.routeToRoute).toBe(true);
        expect(tabs.routeToWarehouse).toBe(true);
        const icons = await transfers.isHeaderIconsVisible();
        expect(icons.hamburger).toBe(true);
        expect(icons.plus).toBe(true);
        await transfers.tap('~Route to Warehouse');
        expect(await transfers.isEmptyStateMessageVisible()).toBe(true);
        // await transfers.openSelectRouteSheet();
        await transfers.tap(transfers.addProductButton);

        // expect(await transfers.isSelectRouteSheetVisible()).toBe(true);
        // expect(await transfers.isAnyRouteOptionVisible()).toBe(true);
        // expect(await menu.isRouteDisplayed(driverDefaultRoute)).toBe(false);
        // routeLabel = await transfers.selectFirstAvailableRoute();
        expect(await transfers.isRouteCardVisibleWithProductCount(warehouseName, 0)).toBe(true);
      });

      await test.step('searching a non-matching term shows no search results found', async () => {
        await transfers.openRtrDetails(warehouseName);
        await menu.searchAndSelectProducts('zzznonexistentproduct123');
        await driver.waitUntil(async () => transfers.isNoSearchResultsFoundVisible(), {
          timeout: 15000
        });
        expect(await transfers.isNoSearchResultsFoundVisible()).toBe(true);
        await transfers.pressKeyCode(4);
        await transfers.pressKeyCode(4);
      });
      let product = '';
      await test.step('Set up: create a route-to-route transfer, open RTR Details, and add a product', async () => {
        // await transfers.open();
        // await transfers.openSelectRouteSheet();
        // routeLabel = await transfers.selectFirstAvailableRoute();
        await transfers.searchAndSelect('can');
        product = await menu.getProductName();
        await transfers.tapQtyDigit(5);
        expect(await transfers.getQtyValue()).toBe('5');
        for (let i = 0; i < 10; i++) {
          await transfers.tapQtyDigit(9);
        }
        const capped = await transfers.getQtyValue();
        expect(capped).toBe('599');
      });

      await test.step('confirming via the checkmark keeps the capped value', async () => {
        await transfers.confirmQty();
        expect(await transfers.getQtyValue()).toBe('599');
        await transfers.closeRtrDetails();
        await menu.openProductDetails(warehouseName);
        await menu.verifyRouteTransferTotalProducts(warehouseName, 1);
        await menu.verifyRouteTransferProduct(warehouseName, product, 599);
        // await transfers.pressKeyCode(4);
        // await transfers.deleteRoute('coffee', 'routeToRoute', routeLabel);
      });


      await test.step('Market search returns expected product', async () => {
        warehouseName = await menu.getRouteWarehouseName();
        await transfers.open();
        await transfers.tap('~Market');
        await transfers.tap('~Route to Warehouse');

        expect(await transfers.isEmptyStateMessageVisible()).toBe(true);
        await transfers.tap(transfers.addProductButton);

        // await transfers.openSelectRouteSheet();
        // routeLabel = await transfers.selectFirstAvailableRoute();
        expect(await transfers.isRouteCardVisibleWithProductCount(warehouseName, 0)).toBe(true);
        await transfers.openRtrDetails(warehouseName);
        await transfers.searchAndSelect('chips');
        const product = await menu.getProductName();
        await transfers.confirmQty();
        // await transfers.pressKeyCode(4);
        expect(product).toBeTruthy();
        await transfers.confirmQty();
        await menu.openProductDetails(warehouseName);
        await menu.verifyRouteTransferTotalProducts(warehouseName, 1);
        await menu.verifyRouteTransferProduct(warehouseName, product, 1);
      });



      await test.step('Vending search returns expected product', async () => {
        warehouseName = await menu.getRouteWarehouseName();
        await transfers.open();
        await transfers.tap('~Vending');
        await transfers.tap('~Route to Warehouse');

        expect(await transfers.isEmptyStateMessageVisible()).toBe(true);
        await transfers.tap(transfers.addProductButton);

        // await transfers.openSelectRouteSheet();
        // routeLabel = await transfers.selectFirstAvailableRoute();
        expect(await transfers.isRouteCardVisibleWithProductCount(warehouseName, 0)).toBe(true);
        await transfers.openRtrDetails(warehouseName);
        await transfers.searchAndSelect('can');
        const product = await menu.getProductName();
        await transfers.confirmQty();
        expect(product).toBeTruthy();
        await transfers.confirmQty();
        await menu.openProductDetails(warehouseName);
        await menu.verifyRouteTransferTotalProducts(warehouseName, 1);
        await menu.verifyRouteTransferProduct(warehouseName, product, 1);
      });
    });
});


test.describe('Route Setup', () => {
  test(
    `change route to ${mobileConfig.defaultRoute.operationLabel} / ${mobileConfig.defaultRoute.routeLabel} and select ${mobileConfig.defaultRoute.day}`,
    { tag: ['@Menu-TC003'] },
    async ({ driver }) => {
      const routeSetup = new RouteSetupScreen(driver);
      const home = new HomeScreen(driver);
      const menu = new MenuScreen(driver);
      // await test.step('Log in (lands on Dashboard - auto-handles the fresh-account gate if it appears)', async () => {
      //   await loginAndWaitForMfa(driver);
      // });

      await test.step('Open Route Setup via Settings', async () => {
        await routeSetup.openFromHamburgerMenu();
      });

      await test.step('Change route, wait for the post-confirm resync', async () => {
        // await routeSetup.selectOperation(mobileConfig.defaultRoute.operationSearch, mobileConfig.defaultRoute.operationLabel);
        // await routeSetup.selectRoute(mobileConfig.defaultRoute.routeSearch, mobileConfig.defaultRoute.routeLabel);

          await routeSetup.selectOperation(mobileConfig.defaultRoute.operationSearch, mobileConfig.defaultRoute.operationLabel);
        await routeSetup.selectRoute(mobileConfig.defaultRoute.routeSearch, mobileConfig.defaultRoute.routeLabel);



        await menu.tap('~Change route');
        await menu.verifyChangeRoutePopupContent();
        await menu.tap('~Cancel');
        expect(await menu.isRouteSetupHeaderDisplayed()).toBe(true);

        // await routeSetup.selectOperation(mobileConfig.defaultRoute.operationSearch, mobileConfig.defaultRoute.operationLabel);
        // await routeSetup.selectRoute(mobileConfig.defaultRoute.routeSearch, mobileConfig.defaultRoute.routeLabel);

        await routeSetup.confirmChangeRoute();
        await routeSetup.waitForSyncAndDaySheet();
      });

      // TC030 "view 'Select a day'" / TC035 "verify date-label mapping" -
      // all three options present, each carrying a real calendar date, and
      // in the correct chronological order (yesterday < today < tomorrow).
      await test.step('TC030/TC035: the day sheet shows Yesterday/Today/Tomorrow, each with a correctly-mapped real date', async () => {
        const labels = await routeSetup.getDaySheetOptionLabels();
        expect(labels.length).toBe(3);
        const parsed = labels.map((label) => {
          const [prefix, dateStr] = label.split('\n');
          return { prefix, date: new Date(dateStr) };
        });
        const today = parsed.find((p) => p.prefix === 'TODAY')!;
        const yesterday = parsed.find((p) => p.prefix === 'YESTERDAY')!;
        const tomorrow = parsed.find((p) => p.prefix === 'TOMORROW')!;
        expect(yesterday.date.getTime()).toBeLessThan(today.date.getTime());
        expect(today.date.getTime()).toBeLessThan(tomorrow.date.getTime());
      });

      await test.step('Select the configured day', async () => {
        await routeSetup.selectDay(mobileConfig.defaultRoute.day);
        await menu.isVisible(menu.confirmDatesheet);
        await menu.tap('~Confirm');
      });

      await test.step('Verify Dashboard reloaded with the selected day', async () => {
        // await home.waitForDashboardLoaded();
        await (await driver.$(menu.titleStartDayAndRoute(mobileConfig.defaultRoute.routeLabel))).waitForDisplayed({
          timeout: 120_000
        });
        await menu.isVisible(menu.titleStartDayAndRoute(mobileConfig.defaultRoute.routeLabel));
        expect(await home.isLoaded()).toBe(true);


      });
    }
  );
});


test.describe('Truck Stock - Truck Returns', () => {

  test.afterEach(async ({ driver }) => {
    // await new HomeScreen(driver).returnToHome().catch(() => {});
  });

  test('open Truck returns, add a product under Coffee, then delete it',  
    { tag: ['@Menu-TC004', '@Menu-TC005'] },
    async ({ driver }) => {
    
    const truckReturns = new TruckStockTruckReturnsScreen(driver);
    const menu = new MenuScreen(driver);
    let coffeeProductName = '';
    let marketProductName = '';

    // let coffeeProductName = 'CanDry GingrAle CN 12oz';
    // let marketProductName = 'CanDry GingrAle CN 12oz';

    // await test.step('Log in', async () => {
    //   await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
    // });

    await test.step('TC298: the hamburger menu lists Truck Stock (Truck returns/Route Inventory/Route shopping) and Transfers', async () => {
      const menu = await truckReturns.isTruckStockMenuVisible();
      expect(menu.truckStock).toBe(true);
      expect(menu.truckReturns).toBe(true);
      expect(menu.routeInventory).toBe(true);
    });

    await test.step('TC299: the Truck Returns screen shows its tabs, search controls, and info pane', async () => {
      await truckReturns.open();
      const tabs = await truckReturns.getVisibleLobTabs();
      expect(await menu.isVisible(menu.lobTabs("Coffee"))).toBe(true);
      expect(await menu.isVisible(menu.lobTabs("Market"))).toBe(true);
      expect(await menu.isVisible(menu.lobTabs("Vending"))).toBe(true);
      const search = await truckReturns.isSearchAreaVisible();
      expect(search.searchField).toBe(true);
      expect(search.infoHeading).toBe(true);
      expect(search.infoBody).toBe(true);
    });

    await test.step('Add a product under Coffee', async () => {
      coffeeProductName = await menu.addProductInTruckStock('Coffee', 'can', 1, 1);
      await menu.verifyTruckReturnProduct(coffeeProductName, 2);

    });

    await test.step('Add a product under Market', async () => {
      marketProductName = await menu.addProductInTruckStock('Market', 'Kit kat', 1, 1);
      await menu.verifyTruckReturnProduct(marketProductName, 2);
    });

    await test.step('Delete a product under Coffee & Market', async () => {
      await menu.deleteTruckReturnsProduct('Coffee', coffeeProductName);
      await menu.verifyTruckReturnsProductDeleted(coffeeProductName);
      await menu.deleteTruckReturnsProduct('Market', marketProductName);
      await menu.verifyTruckReturnsProductDeleted(marketProductName);
    });


  });
});




test('open Route Inventory, add a product under Coffee, then delete it', 
   { tag: ['@Menu-TC004', '@Menu-TC005'] },
   async ({ driver }) => {
  const truckReturns = new TruckStockTruckReturnsScreen(driver);
  const menu = new MenuScreen(driver);
  let coffeeProductName = '';
  let marketProductName = '';

  // let coffeeProductName = 'CanDry GingrAle CN';
  // let marketProductName = 'Kit Kat';

  // await test.step('Log in', async () => {
  //   await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
  // });
  await test.step('the Route Inventory screen shows tabs, inventory types, and search controls',
    async () => {
      await menu.openRouteInventory();
      expect(await menu.isVisible(menu.lobTabs('Coffee'))).toBe(true);
      expect(await menu.isVisible(menu.lobTabs('Market'))).toBe(true);
      expect(await menu.isVisible(menu.lobTabs('Vending'))).toBe(true);
      const controls = await menu.isRouteInventorySearchAreaVisible();
    });


  await test.step('Add a Coffee product under Audit inventory', async () => {
    coffeeProductName = await menu.addProductInRouteInventory('Coffee', 'audit', { searchTerm: 'can' });
    await menu.verifyProductQuantityInRouteInventory(coffeeProductName, 1)
  });


  await test.step('Add a Market product under Audit inventory', async () => {
    marketProductName = await menu.addProductInRouteInventory('Market', 'audit', { searchTerm: 'kit' });
    await menu.verifyProductQuantityInRouteInventory(marketProductName, 1);
  });


  await test.step('Delete a product under Coffee & Market', async () => {
    // //await menu.openTab('Coffee', 'audit');
    await menu.deleteRouteInventoryProduct('Coffee', coffeeProductName);
    await menu.tapBackArrow();
    expect(await menu.verifyRouteInventoryProductDeleted(coffeeProductName)).toBe(true);
    await menu.deleteRouteInventoryProduct('Market', marketProductName);
    await menu.tapBackArrow();
    expect(await menu.verifyRouteInventoryProductDeleted(marketProductName)).toBe(true);
  });


});