import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndWaitForMfa } from '../../utils/login-flow';
import { VendingDeliveryScreen } from '../../screens/vending-delivery.screen';
import { DashboardScreen } from '../../screens/dashboard.screen';
import { TruckStockTruckReturnsScreen } from '../../screens/truck-stock-truck-returns.screen';
import { HomeScreen } from '@screens/home.screen';
import { VendingRemovalReturnScreen } from '@screens/vending-removal-returns.screen';


test.describe('Truck Stock -  vending returns workflow', () => {
  test('open Truck returns, add a product under vending', async ({ driver }) => {
    const truckReturns = new TruckStockTruckReturnsScreen(driver);
    const vendingRemovalReturn = new VendingRemovalReturnScreen(driver);
    const delivery = new VendingDeliveryScreen(driver);
    const dashboard = new DashboardScreen(driver);
    const home = new HomeScreen(driver);
    let productName = '';
    let firstMachineName: string;
    let firstServiceStationName: string;


    // await test.step('Log in', async () => {
    //   await loginAndWaitForMfa(driver);
    // });
//
    // await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
    //     await prepTasks.openFromHamburgerMenu();
    //     await prepTasks.completeFullDayPrep();
    //   });

    //   await test.step('Change route, then select the configured day', async () => {

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



    

    await test.step('Read and verify the first machine location name', async () => {
      firstMachineName = await delivery.getFirstMachineName();
      expect(firstMachineName).toBeTruthy();
      expect(firstMachineName).not.toEqual('');
      expect(firstMachineName.toLowerCase()).not.toContain('undefined');
    });

    await test.step('Click the first machine', async () => {
      await delivery.clickMachine(firstMachineName);
    });

     await test.step('Verify the clicked machine name is shown as header', async () => {
      expect(await delivery.isHeaderDisplayed(firstMachineName)).toBe(true);
      const header = await delivery.getHeaderText(firstMachineName);
      expect(header).toBe(firstMachineName);
    });

   

    await test.step('Open the first vending service station', async () => {
      await dashboard.openNthServiceStation('vending', 'first');
      await vendingRemovalReturn.clickHeader('Removals & Returns');
    });


     await test.step('verify if header icon is displayed', async () => {
        const isHeaderDisplayed = await delivery.isHeaderDisplayed('Removals & Returns');
        expect(isHeaderDisplayed).toBe(true);
        expect(await vendingRemovalReturn.isSortIconVisible()).toBe(true);
      expect(await vendingRemovalReturn.isSortIconEnabled()).toBe(true);
      expect(await vendingRemovalReturn.isFilterIconVisible()).toBe(true);
      expect(await vendingRemovalReturn.isFilterIconEnabled()).toBe(true);
    });

    await test.step('verify Sort, Filter icons, Lookup product, search, barcode icons are displayed', async () => {
     
      expect(await vendingRemovalReturn.isSearchIconVisible()).toBe(true);
      expect(await vendingRemovalReturn.isSearchIconClickable()).toBe(true);
      expect(await vendingRemovalReturn.isBarcodeScannerIconVisible()).toBe(true);
      expect(await vendingRemovalReturn.isBarcodeScannerIconClickable()).toBe(true);
       
    });


    await test.step('verify Lookup label is displayed', async () => {
      expect(await vendingRemovalReturn.isLookupProductLabelVisible()).toBe(true);
      expect(await vendingRemovalReturn.getLookupProductHint()).toContain('Look up product');
    });


    await test.step('select each category and verify lookup and barcode icons plus highlight', async () => {      
        expect(await vendingRemovalReturn.isSearchIconVisible()).toBe(true);
        expect(await vendingRemovalReturn.isBarcodeScannerIconVisible()).toBe(true);
        expect(await vendingRemovalReturn.isLookupIconLeftOfBarcodeIcon()).toBe(true);

    });

  

  await test.step('verify Record Truck Returns icon, info text, and validation message', async () => {
        expect(await vendingRemovalReturn.isRecordTruckReturnsInfoIconVisible()).toBe(true);
        expect(await vendingRemovalReturn.isRecordTruckReturnsInfoVisible()).toBe(true);
        expect(await vendingRemovalReturn.getRecordTruckReturnsInfoText()).toContain('Record Removed Items & Truck Returns');
        expect(await vendingRemovalReturn.isValidationTextVisible()).toBe(true);
        expect(await vendingRemovalReturn.getValidationText()).toContain(
          'To document removals and truck returns please scan or search the item and log the count.'
        );
      });

      //   await test.step('verify Lookup placeholder text is displayed', async () => {
      // expect(await vendingRemovalReturn.getLookupProductHint()).toContain('Scan or search name, sku');
    // });

       await test.step('Verify barcode scanner', async () => {
        await vendingRemovalReturn.tap(vendingRemovalReturn.lookupProductBarcodeIcon);
        await vendingRemovalReturn.verifyElementIsDisplayed(vendingRemovalReturn.widgetButton);
        await vendingRemovalReturn.click("Continue");
    });

    await test.step('enter junk text and verify no matching results', async () => {
      await vendingRemovalReturn.enterLookupProductText('XXYYZZ');
      expect(await vendingRemovalReturn.isNoMatchingResultsVisible()).toBe(true);
      expect(await vendingRemovalReturn.getNoMatchingResultsText()).toContain('No search results found');
      await vendingRemovalReturn.tapScrim();
    });

    await test.step('verify product header, pkg info, and barcode display', async () => {
      await vendingRemovalReturn.enterLookupProductText('Regal Movie Ticket');
      await vendingRemovalReturn.verifyProductInfo('1 Regal Movie Ticket - pkg: 1', 'SKU: 48097')
      // expect(await vendingRemovalReturn.verifyProductInfo('1 Regal Movie Ticket - pkg: 1', 'SKU: 48097'))
      //   .toBe(true);
      await vendingRemovalReturn.tapProductResult('Regal Movie Ticket');
    });

    await test.step('verify Document product header, product & pkg info is displayed', async () => {
      expect(await vendingRemovalReturn.verifyElementDisplayed('Document product')).toBe(true);
      expect(await vendingRemovalReturn.verifyElementDisplayed('1 Regal Movie Ticket')).toBe(true);
      expect(await vendingRemovalReturn.verifyElementDisplayed('Pkg: 1')).toBe(true);
    });

    await test.step('Verify numeric keyboard, Enter damaged, spoiled, stolen quantities and click done', async () => {
      expect(await vendingRemovalReturn.isNumericKeyboardDisplayed('Damaged')).toBe(true);
      await vendingRemovalReturn.enterTextBoxValue('Damaged', '1');
      await vendingRemovalReturn.enterTextBoxValue('Spoiled', '1');
      await vendingRemovalReturn.enterTextBoxValue('Theft', '0');
      await vendingRemovalReturn.enterTextBoxValue('Truck Return', '1');
      await vendingRemovalReturn.click('Save');
    });

    await test.step('Verify product details are added and displayed', async () => {
      const hint = await vendingRemovalReturn.getAddedProductHintText('1 Regal Movie Ticket');
      expect(hint).toContain('1 Regal Movie Ticket');
      expect(hint).toContain('Pkg: 1');
      expect(hint).toContain('Qty');
      expect(await vendingRemovalReturn.getAddedProductTextValue('1 Regal Movie Ticket')).toBe('3');
    });

   // Add additional products for filter and sort verification
    await test.step('Add additional products for filter and sort verification', async () => {
      await vendingRemovalReturn.enterLookupProductText('Snack');
      await vendingRemovalReturn.tapProductResult('Truly Good Snackin Mix (10lb)');
      await vendingRemovalReturn.enterTextBoxValue('Damaged', '1');
      await vendingRemovalReturn.click('Save');
      //const hint = await vendingRemovalReturn.getAddedProductHintText('Charlotte Snack Tray');
      expect(await vendingRemovalReturn.getAddedProductTextValue('TGF Snackin Mix 10lb')).toBe('1');

      await vendingRemovalReturn.enterLookupProductText('100 Grand');
      await vendingRemovalReturn.tapProductResult('100 Grand (1.5oz)');
      await vendingRemovalReturn.enterTextBoxValue('Damaged', '1');
      await vendingRemovalReturn.click('Save');
      //const hintCandy = await vendingRemovalReturn.getAddedProductHintText('100 Grand (1.5oz)');
      expect(await vendingRemovalReturn.getAddedProductTextValue('100 Grand 1.5oz')).toBe('1');

      await vendingRemovalReturn.enterLookupProductText('Coffee');
      await vendingRemovalReturn.tapProductResult('BLK & BOLD Coffee-ish Decaf');
      await vendingRemovalReturn.enterTextBoxValue('Damaged', '1');
      await vendingRemovalReturn.click('Save');
      //const hintCandy = await vendingRemovalReturn.getAddedProductHintText('100 Grand (1.5oz)');
      await vendingRemovalReturn.closeKeypadIfDisplayed();
      expect(await vendingRemovalReturn.getAddedProductTextValue('BLK&BOLD CoffeeishDC')).toBe('1');
    });
     
    await test.step('TC070: Open Filter and view category list', async () => {
      await vendingRemovalReturn.openFilter();
      expect(await vendingRemovalReturn.isFilterSheetVisible()).toBe(true);
      expect(await vendingRemovalReturn.verifyElementIsDisplayed(vendingRemovalReturn.byCategoryLabel)).toBe(true);
      await vendingRemovalReturn.verifyButtonIsDisplayed('CANDY');
      await vendingRemovalReturn.verifyButtonIsDisplayed('OTHER PRODUCTS');
    });

    await test.step('TC073: Select a category chip and verify Apply enabled', async () => {
      await vendingRemovalReturn.tapFilterCategory('CANDY');
      expect(await vendingRemovalReturn.isFilterCategoryHighlighted('CANDY')).toBe(true);
      expect(await vendingRemovalReturn.isApplyFiltersEnabled()).toBe(true);
      expect(await vendingRemovalReturn.isClearFiltersEnabled()).toBe(true);
    });

    await test.step('TC085: Apply filters and verify filter becomes active', async () => {
      await vendingRemovalReturn.applyFilters();
      expect(await vendingRemovalReturn.isFilterActive()).toBe(true);
      expect(await delivery.isHeaderDisplayed("CANDY")).toBe(true);
    });

   

    await test.step('TC078: Deselect category and verify Clear/Apply state', async () => {
      await vendingRemovalReturn.openFilter();
      await vendingRemovalReturn.tapFilterCategory('CANDY');
      // After deselecting the only chip, Clear filters should be disabled
      expect(await vendingRemovalReturn.isFilterCategoryHighlighted('CANDY')).toBe(false);
      expect(await vendingRemovalReturn.isClearFiltersEnabled()).toBe(false);
      expect(await vendingRemovalReturn.isApplyFiltersEnabled()).toBe(false);
    });


    await test.step('TC074: I am able to select multiple categories', async () => {
      //await vendingRemovalReturn.openFilter();
      await vendingRemovalReturn.selectFilterCategories(['CANDY', 'Coffee - Premium', 'SNACKS']);
      expect(await vendingRemovalReturn.isFilterCategoryHighlighted('CANDY')).toBe(true);
      expect(await vendingRemovalReturn.isFilterCategoryHighlighted('Coffee - Premium')).toBe(true);
      expect(await vendingRemovalReturn.isFilterCategoryHighlighted('SNACKS')).toBe(true);
      expect(await vendingRemovalReturn.isApplyFiltersEnabled()).toBe(true);
      expect(await vendingRemovalReturn.isClearFiltersEnabled()).toBe(true);
    });

    await test.step('TC077: I am able to clear all selections', async () => {
      // Clear selections via the Clear filters control
      await vendingRemovalReturn.clearFilters();
       await vendingRemovalReturn.openFilter();
      expect(await vendingRemovalReturn.isFilterCategoryHighlighted('CANDY')).toBe(false);
      expect(await vendingRemovalReturn.isFilterCategoryHighlighted('Coffee - Premium')).toBe(false);
      expect(await vendingRemovalReturn.isFilterCategoryHighlighted('SNACKS')).toBe(false);
      expect(await vendingRemovalReturn.isApplyFiltersEnabled()).toBe(false);
      expect(await vendingRemovalReturn.isClearFiltersEnabled()).toBe(false);
    });

    await test.step('TC084: I am able to clear all tags and see filter icon update', async () => {
      // Re-select and apply filters to create active chips, then clear them
      //await vendingRemovalReturn.openFilter();
      await vendingRemovalReturn.selectFilterCategories(['CANDY']);
      await vendingRemovalReturn.applyFilters();
      // Active chips should now exist and filter icon shows active state
     // expect((await vendingRemovalReturn.getActiveFilterChips()).length).toBeGreaterThan(0);
      expect(await vendingRemovalReturn.isFilterActive()).toBe(true);

      // Open filter sheet and clear all selections; verify chips removed and icon cleared
      await vendingRemovalReturn.openFilter();
      await vendingRemovalReturn.clearFilters();
      //expect(await vendingRemovalReturn.areActiveFilterChipsCleared()).toBe(true);
      expect(await vendingRemovalReturn.isFilterActive()).toBe(false);
    });


    await test.step('TC074: I am able to select multiple categories', async () => {
      await vendingRemovalReturn.openFilter();
      await vendingRemovalReturn.selectFilterCategories(['CANDY', 'Coffee - Premium', 'SNACKS']);
      expect(await vendingRemovalReturn.isFilterCategoryHighlighted('CANDY')).toBe(true);
      expect(await vendingRemovalReturn.isFilterCategoryHighlighted('Coffee - Premium')).toBe(true);
      expect(await vendingRemovalReturn.isFilterCategoryHighlighted('SNACKS')).toBe(true);
      await vendingRemovalReturn.applyFilters();
      expect(await vendingRemovalReturn.isFilterActive()).toBe(true);
    });

    

     await test.step('TC098: Open Sort list and verify Sort by title', async () => {
      await vendingRemovalReturn.openSort();
      expect(await vendingRemovalReturn.isSortSheetVisible()).toBe(true);     
      expect(await vendingRemovalReturn.verifyActiveFilterChips(['A to Z', 'Z to A', 
        'By Category', 'Newest First', 'Oldest First'])).toBe(true);
    });

    await test.step('TC107: Select A to Z and verify Sort becomes active', async () => {
      await vendingRemovalReturn.selectSortOption('A to Z');
      expect(await vendingRemovalReturn.isSortActive()).toBe(true);
      await vendingRemovalReturn.openSort();
      await vendingRemovalReturn.isSortSheetVisible();
      //Not verfiable since no attribute to check if the option is highlighted
      //expect(await vendingRemovalReturn.isSortOptionHighlighted('A to Z')).toBe(true);
      expect(await vendingRemovalReturn.isEnabled(vendingRemovalReturn.clearSortOrderButton)).toBe(true);
      await vendingRemovalReturn.tapScrim();
      expect(await vendingRemovalReturn.isProductListSortedByTitleAtoZ()).toBe(true);
    });

    await test.step('Verify able to view active filter tags', async () => {
      // expect(await vendingRemovalReturn.isFilterActive()).toBe(true);
      expect(await vendingRemovalReturn.verifyActiveFilterChips(['CANDY', 'Coffee - Premium', 'SNACKS'])).toBe(true);
    });

    await test.step('Reopen Sort and apply Z to A sort', async () => {
      await vendingRemovalReturn.openSort();
      expect(await vendingRemovalReturn.isSortSheetVisible()).toBe(true);
      await vendingRemovalReturn.selectSortOption('Z to A');
      expect(await vendingRemovalReturn.isSortActive()).toBe(true);
      expect(await vendingRemovalReturn.isProductListSortedByTitleZtoA()).toBe(true);
      await vendingRemovalReturn.openSort();
      //Not verfiable since no attribute to check if the option is highlighted
     // expect(await vendingRemovalReturn.isSortOptionHighlighted('Z to A')).toBe(true);
      expect(await vendingRemovalReturn.isEnabled(vendingRemovalReturn.clearSortOrderButton)).toBe(true);
      await vendingRemovalReturn.tapScrim();
    });

    await test.step('Clear sort while filters remain active', async () => {
      await vendingRemovalReturn.openSort();
      expect(await vendingRemovalReturn.isSortSheetVisible()).toBe(true);
      await vendingRemovalReturn.clearSortOrder();
      expect(await vendingRemovalReturn.isSortActive()).toBe(false);
      expect(await vendingRemovalReturn.isFilterActive()).toBe(true);
      expect(await vendingRemovalReturn.verifyActiveFilterChips(['CANDY', 'Coffee - Premium', 'SNACKS'])).toBe(true);
      //await vendingRemovalReturn.tapScrim();
    });

    


  });
});

