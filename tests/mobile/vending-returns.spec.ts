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


      
      //
    });

     await test.step('verify if header icon is displayed', async () => {
        const isHeaderDisplayed = await delivery.isHeaderDisplayed('Truck returns');
        expect(isHeaderDisplayed).toBe(true);
        await vendingReturn.tapVendingCategory();
        const isHeaderAddIconDisplayed = await delivery.isHeaderButtonDisplayed('section_header_add_cta');
        expect(isHeaderAddIconDisplayed).toBe(true);
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

    await test.step('select each category and verify lookup and barcode icons plus highlight', async () => {
      const categories = ['coffee', 'market', 'vending'];
      for (const category of categories) {
        await vendingReturn.tapCategory(category);
       // expect(await vendingReturn.isCategoryHighlighted(category)).toBe(true);
        expect(await vendingReturn.isSearchIconVisible()).toBe(true);
        expect(await vendingReturn.isBarcodeScannerIconVisible()).toBe(true);
        expect(await vendingReturn.isLookupIconLeftOfBarcodeIcon()).toBe(true);
      }
    });

    // await test.step('verify Lookup placeholder text is displayed', async () => {
    //   expect(await vendingReturn.getLookupProductHint()).toContain('Scan or search name, sku');
    // });

  await test.step('verify Record Truck Returns icon, info text, and validation message', async () => {
        expect(await vendingReturn.isRecordTruckReturnsInfoIconVisible()).toBe(true);
        expect(await vendingReturn.isRecordTruckReturnsInfoVisible()).toBe(true);
        expect(await vendingReturn.getRecordTruckReturnsInfoText()).toContain('Record Individual Truck Returns');
        expect(await vendingReturn.isValidationTextVisible()).toBe(true);
        expect(await vendingReturn.getValidationText()).toContain(
          'This service stop does not have requested truck returns. Please add truck returns individually to accurately reflect inventory'
        );
      });

       await test.step('Verify barcode scanner', async () => {
        await vendingReturn.tap(vendingReturn.lookupProductBarcodeIcon);
        await vendingReturn.verifyElementIsDisplayed(vendingReturn.widgetButton);
        await vendingReturn.click("Continue");
    });

    await test.step('enter junk text and verify no matching results', async () => {
      await vendingReturn.enterLookupProductText('XXYYZZ');
      expect(await vendingReturn.isNoMatchingResultsVisible()).toBe(true);
      expect(await vendingReturn.getNoMatchingResultsText()).toContain('No search results found');
      await vendingReturn.tapScrim();
    });

    await test.step('verify product header, pkg info, and barcode display', async () => {
      await vendingReturn.enterLookupProductText('Regal Movie Ticket');
      await vendingReturn.verifyProductInfo('1 Regal Movie Ticket - pkg: 1', 'SKU: 48097')
      // expect(await vendingReturn.verifyProductInfo('1 Regal Movie Ticket - pkg: 1', 'SKU: 48097'))
      //   .toBe(true);
      await vendingReturn.tapProductResult('Regal Movie Ticket');
    });

    await test.step('verify Add product header, product & pkg info is displayed', async () => {
      expect(await vendingReturn.verifyElementDisplayed('Add product')).toBe(true);
      expect(await vendingReturn.verifyElementDisplayed('1 Regal Movie Ticket')).toBe(true);
      expect(await vendingReturn.verifyElementDisplayed('Pkg: 1')).toBe(true);
    });

    await test.step('Verify numeric keyboard, Enter damaged, spoiled, stolen quantities and click done', async () => {
      expect(await vendingReturn.isNumericKeyboardDisplayed('Damaged')).toBe(true);
      await vendingReturn.enterTextBoxValue('Damaged', '1');
      await vendingReturn.enterTextBoxValue('Spoiled', '1');
      await vendingReturn.enterTextBoxValue('Stolen', '1');
      await vendingReturn.click('Done');
    });



    await test.step('Verify product details are added and displayed', async () => {
      const hint = await vendingReturn.getAddedProductHintText('1 Regal Movie Ticket');
      expect(hint).toContain('1 Regal Movie Ticket');
      expect(hint).toContain('Pkg: 1');
      expect(hint).toContain('Qty');
      expect(await vendingReturn.getAddedProductTextValue('1 Regal Movie Ticket')).toBe('3');
    });

    

  });
});

