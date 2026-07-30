import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndWaitForMfa } from '../../utils/login-flow';
import { VendingDeliveryScreen } from '../../screens/vending-delivery.screen';
import { VendingReturnScreen } from '../../screens/vending-returns.screen';
import { TruckStockTruckReturnsScreen } from '../../screens/truck-stock-truck-returns.screen';
import { HomeScreen } from '@screens/home.screen';


test.describe('Truck Stock -  vending returns workflow', () => {
  test('open Truck returns, add a product under vending', async ({ driver }) => {
    const truckReturns = new TruckStockTruckReturnsScreen(driver);
    const vendingReturn = new VendingReturnScreen(driver);
    const delivery = new VendingDeliveryScreen(driver);
    const home = new HomeScreen(driver);
    let productName = '';

    // await test.step('Log in', async () => {
    //   await loginAndWaitForMfa(driver);
    // });
//
// await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
    //     await prepTasks.openFromHamburgerMenu();
    //     await prepTasks.completeFullDayPrep();
    //   });

    // await test.step('Change route, then select the configured day', async () => {
    //    // await routeSetup.selectDay("TODAY");
    //     await routeSetup.changeRouteAndSelectDay({
    //       operationSearch: 'Charlotte',
    //       operationLabel: 'Charlotte, NC',
    //       routeSearch: 'Route 103',
    //       routeLabel: 'Route 103',
    //       day: 'TODAY'
    //     });
    // });

    //       await test.step('Verify Dashboard reloaded with the selected day', async () => {
    //         await home.waitForDashboardLoaded();
    //         expect(await home.isLoaded()).toBe(true);
    //       });

    await test.step('Open the Truck returns screen', async () => {
      await truckReturns.open();
    });

     await test.step('verify if header icon is displayed', async () => {
        const isHeaderDisplayed = await delivery.isHeaderDisplayed('Truck returns');
        expect(isHeaderDisplayed).toBe(true);
    });

    await test.step('verify Lookup product, search, barcode icons are displayed', async () => {
      expect(await vendingReturn.isSearchIconVisible()).toBe(true);
      expect(await vendingReturn.isSearchIconClickable()).toBe(true);
      expect(await vendingReturn.isBarcodeScannerIconVisible()).toBe(true);
      expect(await vendingReturn.isBarcodeScannerIconClickable()).toBe(true);
    });

    await test.step('verify Lookup label is displayed', async () => {
      expect(await vendingReturn.isLookupProductLabelVisible()).toBe(true);
      expect(await vendingReturn.getLookupProductHint()).toContain('Look up product');
    });

    await test.step('verify Lookup placeholder text is displayed', async () => {
      expect(await vendingReturn.getLookupProductPlaceholder()).toContain('Scan or search name, sku');
    });


      await test.step('verify Record Truck Returns info and validation text', async () => {
        expect(await vendingReturn.isRecordTruckReturnsInfoVisible()).toBe(true);
        expect(await vendingReturn.getRecordTruckReturnsInfoText()).toContain('Record Truck Returns');
        expect(await vendingReturn.isValidationTextVisible()).toBe(true);
        expect(await vendingReturn.getValidationText()).toContain(
          'This service stop does not have requested truck returns. Please add truck returns individually to accurately reflect inventory'
        );
      });
  });
});

