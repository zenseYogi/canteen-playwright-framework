import { test, expect } from '@playwright/test';
import type { Browser } from 'webdriverio';
import { createMobileSession, closeMobileSession } from '../../fixtures/appium.fixture';
import { loginAndWaitForMfa, ensureOnRoute, loginAndEnsureRoute } from '../../utils/login-flow';
import { PrepTasksScreen } from '../../screens/prep-tasks.screen';
import { DashboardScreen } from '../../screens/dashboard.screen';
import { VendingServiceScreen } from '../../screens/vending-service.screen';
import { HomeScreen } from '../../screens/home.screen';
import { mobileConfig } from '../../config/mobile.config';
import { EndDayScreen } from '../../screens/end-day.screen';




// test.describe.configure({ mode: 'serial' });

test.describe('Vending - Product fills (Sort/Filter), Money Operations', () => {
  let driver: Browser;

  test.beforeAll(async () => {
    driver = await createMobileSession();
    // await loginAndWaitForMfa(driver);
    // await loginAndEnsureRoute(driver, mobileConfig.vendingRoute);
  });

  test.afterEach(async ({ }, testInfo) => {
    // // Same failure-screenshot capture appium.fixture.ts's driver fixture
    // // normally does per test - reproduced here since this file bypasses it.
    if (testInfo.status !== testInfo.expectedStatus) {
      try {
        const screenshotPath = testInfo.outputPath('failure.png');
        await driver.saveScreenshot(screenshotPath);
        await testInfo.attach('failure-screenshot', { path: screenshotPath, contentType: 'image/png' });
      } catch (e) {
        console.warn('Could not capture failure screenshot:', e);
      }
    }
    driver.pause(1000);
    await new HomeScreen(driver).returnToHome();
  });

  test.afterAll(async () => {
    await closeMobileSession(driver);
  });





  //Passed
  test.skip(
    'Deleting an added delivery removes it entirely from the schedule',
    { tag: ['@Vending-TC-023'] },
    async () => {
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const vending = new VendingServiceScreen(driver);

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.vendingRoute);
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });
      var stationName: string;
      var machineId: string;
      await test.step("Open the first stop's first Vending machine", async () => {

        const locationName = await vending.getLocationNameByPosition('first');
        console.log(locationName);
        await dashboard.clickLocationByPosition('first');
        stationName = await dashboard.getNthServiceStationName('vending', 'first');
        dashboard.openNthServiceStation('vending', 'first');
        console.log('Station Names', stationName);
        machineId = stationName.split('-')[0].trim();
      });

      await test.step('TC003: tap Before Photos and verify the Take photo/Skip photo modal', async () => {
        await vending.tapContinue();
        await vending.openBeforePhotos();
        const modal = await vending.isPhotoModalVisible();
        await vending.openSkipPhotoReasonSheet();
        await vending.enterSkipPhotoReason('Camera cannot focus and take clear picture');
        await vending.confirmSkipPhoto();
      });

      await test.step('TC042: Delete Delivery', async () => {
        await vending.tap(vending.deleteDelivery);
        // expect(await dashboard.isNthServiceStationVisible('vending', 'first')).toBe(false);
        // expect(await vending.isConfirmDeletePopupDisplayed()).toBe(true);
        await vending.tap('~Delete');
        if (!await dashboard.isNthServiceStationVisible('vending', 'first')) {
          await vending.clickVendingStationsIfCollapsed();
        }
        expect(await dashboard.isNthServiceStationVisible('vending', 'first')).toBe(true);
        dashboard.openServiceStationByName('vending', stationName);
        await vending.tapContinue();
        expect(await vending.isServiceStationCompleted('Before Photos')).toBe(false);
        // expect(
        //   await vending.isServiceStationCompleted('99187 - Bottle Bev')
        // ).toBe(false);

      });

    });



  //Pass
  test(
    'Complete a Full service Delivery and Deleting a completed unsynced scheduled service returns machine to unhandled',
    { tag: ['@Vending-TC-029', '@Vending-TC-036'] },
    async () => {
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const vending = new VendingServiceScreen(driver);

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.vendingRoute);
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });
      var stationName: string;
      var machineId: string;
      await test.step("Open the first stop's first Vending machine", async () => {

        const locationName = await vending.getLocationNameByPosition('first');
        console.log(locationName);
        await dashboard.clickLocationByPosition('first');
        stationName = await dashboard.getNthServiceStationName('vending', 'first');
        dashboard.openNthServiceStation('vending', 'first');
        console.log('Station Names', stationName);
        machineId = stationName.split('-')[0].trim();
      });


      await test.step('TC003: tap Before Photos and verify the Take photo/Skip photo modal', async () => {
        await vending.tapContinue();
        const header = await vending.isDateRouteHeaderVisible();
        expect(await vending.isMachineDisplayed(machineId)).toBe(true);
        expect(await vending.isHeaderDisplayed('FULL SERVICE')).toBe(true);
        expect(await vending.isBeforePhotosEnabled()).toBe(true);
        expect(await vending.isMoneyOperationsEnabled()).toBe(true);
        expect(await vending.isFillsAndEndingInventoryDisabled()).toBe(true);
        expect(await vending.isRemovalsAndReturnsDisabled()).toBe(true);
        expect(await vending.isKitReturnsEnabled()).toBe(true);
        expect(await vending.isCompleteDeliveryDisabled()).toBe(true);
        await vending.openBeforePhotos();
        const modal = await vending.isPhotoModalVisible();
        await vending.openSkipPhotoReasonSheet();
        await vending.enterSkipPhotoReason('Camera cannot focus and take clear picture');
        await vending.confirmSkipPhoto();
      });


      await test.step("TC003/TC006: After Photos remains disabled until all required tasks are complete", async () => {
        expect(await vending.isAfterPhotosEnabled()).toBe(false);
        await vending.openMoneyOperations();
        await vending.performMoneyOperations({ bagCode: '12931', bills: '120', refund: '5.55' });
        //Fills, removales enabled
        expect(await vending.isFillsAndEndingInventoryDisabled()).toBe(false);
        expect(await vending.isRemovalsAndReturnsDisabled()).toBe(false);
        await vending.openFillsAndEndingInventory();
        // await vending.fillAllProductDeliveryQuantities();
        await vending.fillAllProductEndQuantities()
        // await vending.fillAllProductQuantities();


        // await vending.tapBackArrow();
        await vending.tapBackArrow();
        expect(await vending.isAfterPhotosEnabled()).toBe(true);

      });

      await test.step('TC031: Machine type audit visibility edge cases [Vending | Audit should not be shown]', async () => {
        expect(await vending.isAuditVisible()).toBe(false);
      });

      await test.step('TC005/TC006: Spoiled=2/RETK=1 saves and appears with an aggregate Qty of 3', async () => {
        await vending.openRemovalsAndReturns();
        await vending.tapBackArrow();
        await vending.isHeaderDisplayed("Removals & Returns");


        await vending.openRemovalsAndReturns();
        const productName = await vending.enterFillsAndRemovalsForFirstRow('2', '1');
        await prepTasks.tapBackArrow();
        await vending.isHeaderDisplayed("Removals & Returns");



        // await vending.openRemovalsAndReturns();
        // let productName = 'Sun Drop 20oz';
        // // await vending.enterRemovalReturnValues(productName, '2', '1');
        // productName = await vending.enterRemovalReturnValuesForFirstRow('2', '1');
        // await prepTasks.tapBackArrow();
        // await vending.isHeaderDisplayed("Removals & Returns");
        await vending.openRemovalsAndReturns();
        // Verify persisted values
        await vending.verifyRemovalReturnValues(productName, '2', '1');
        await prepTasks.tapBackArrow();
      });

      await test.step('TC042: Skip After photos', async () => {
        await vending.openAfterPhotos();
        const modal = await vending.isPhotoModalVisible();
        expect(modal.skipPhoto).toBe(true);
        await vending.openSkipPhotoReasonSheet();
        expect(await vending.isSkipPhotoReasonSheetVisible()).toBe(true);
        expect(await vending.isSkipPhotoSubmitEnabled()).toBe(false);
        await vending.enterSkipPhotoReason('Camera cannot focus and take clear picture');
        await vending.waitForSkipPhotoSubmitEnabled(true);
        await vending.confirmSkipPhoto();
        expect(await vending.isSkipPhotoReasonSheetVisible()).toBe(false);
        await vending.tap("~Complete Delivery");
        // expect(await vending.isHeaderDisplayed(locationName)).toBe(true);


      });

      await test.step('Delete Completed Delivery', async () => {
        if (!await dashboard.isNthServiceStationVisible('vending', 'first')) {
          await vending.clickVendingStationsIfCollapsed();
        }
        expect(await vending.isServiceStationCompleted(stationName)).toBe(true);
        dashboard.openServiceStationByName('vending', stationName);
        expect(await vending.isVisible('~Edit Existing Delivery')).toBe(false);
        await vending.waitFor('~Edit Existing Delivery')
        await vending.tap('~Edit Existing Delivery');
        await vending.waitFor('~EDITING EXISTING DELIVERY')
        await vending.tapFullButton();
        await vending.isHeaderDisplayed('FULL SERVICE');
        await vending.tap(vending.deleteDelivery);
        await vending.tap('~Delete');
        if (!await dashboard.isNthServiceStationVisible('vending', 'first')) {
          await vending.clickVendingStationsIfCollapsed();
        }
        // const stationName = '69617 - Snacks';
        expect(await dashboard.isNthServiceStationVisible('vending', 'first')).toBe(true);
        await vending.isHeaderDisplayed(stationName);
        driver.pause(1000);
        await dashboard.waitForServiceStationVisible('vending', stationName);
        await dashboard.openServiceStationByName('vending', stationName);
        await vending.tapBackArrow();
        expect(await vending.isServiceStationCompleted(stationName)).toBe(false);
        dashboard.openServiceStationByName('vending', stationName);
        await vending.tapContinue();
        expect(await vending.isServiceStationCompleted('Before Photos')).toBe(false);
      });
    });




  //Pass
  test(
    'Spot service',
    { tag: ['@Vending-TC-024'] },
    async () => {
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const vending = new VendingServiceScreen(driver);

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        // await loginAndEnsureRoute(driver, mobileConfig.vendingRoute);
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });


      await test.step('TC:041 Verify Navigate launches Google Maps',
        async () => {

          const locationName = await vending.getLocationNameByPosition('first');
          console.log(locationName);
          await dashboard.clickLocationByName(locationName)
          address = await vending.getHeaderAddress(locationName);
          stationName = await dashboard.getNthServiceStationName('vending', 'first');
          const appPackage = await driver.getCurrentPackage();
          await vending.tap('~Navigate');
          await driver.waitUntil(
            async () =>
              (await driver.getCurrentPackage()) === 'com.google.android.apps.maps',
            { timeout: 10000 }
          );
          expect(await driver.getCurrentPackage()).toBe(
            'com.google.android.apps.maps'
          );
          await vending.skipGoogleMapsSigninIfDisplayed();

          const destination = await vending.getMapsDestination();
          expect(destination).toContain(address);

          // Return to Compass app
          await driver.activateApp(appPackage);
          await driver.waitUntil(
            async () =>
              (await driver.getCurrentPackage()) === appPackage,
            { timeout: 10000 }
          );
          expect(await driver.getCurrentPackage()).toBe(appPackage);
        });



      var stationName: string;
      var machineId: string;
      var address: string;
      await test.step("Open the first stop's first Vending machine", async () => {
        await dashboard.tapViewSchedule();
        const isHeaderDisplayed = await vending.isHeaderDisplayed('Vending');
        expect(isHeaderDisplayed).toBe(true);
        //Aaron's
        // await dashboard.clickLocationByPosition('first');
        const locationName = await vending.getLocationNameByPosition('first');
        console.log(locationName);
        await dashboard.clickLocationByName(locationName)
        address = await vending.getHeaderAddress(locationName);
        stationName = await dashboard.getNthServiceStationName('vending', 'first');
        dashboard.openNthServiceStation('vending', 'first');
        console.log('Station Name', stationName);
        machineId = stationName.split('-')[0].trim();
      });

      await test.step(
        'TC028: Verify SPOT Service task list screen',
        async () => {
          await vending.tapSpot();
          const header = await vending.isDateRouteHeaderVisible();
          expect(await vending.isMachineDisplayed(machineId)).toBe(true);
          expect(await vending.isHeaderDisplayed('SPOT SERVICE')).toBe(true);
          expect(await vending.isBeforePhotosEnabled()).toBe(true);
          expect(await vending.isMoneyOperationsEnabled()).toBe(true);
          expect(await vending.isFillsAndRemovalsDisabled()).toBe(false);
          expect(await vending.isAfterPhotosDisabled()).toBe(false);
          expect(await vending.isCompleteDeliveryDisabled()).toBe(true);
        }
      );

      await test.step('TC003: tap Before Photos and verify the Take photo/Skip photo modal', async () => {
        await vending.openBeforePhotos();
        const modal = await vending.isPhotoModalVisible();
        await vending.openSkipPhotoReasonSheet();
        await vending.enterSkipPhotoReason('Camera cannot focus and take clear picture');
        await vending.confirmSkipPhoto();
      });


      await test.step("Money operations", async () => {
        await vending.openMoneyOperations();
        await vending.enterBillExchangeAmount('120');
        await vending.tapBackArrow();
        expect(await vending.isCompleteDeliveryDisabled()).toBe(true);

        await vending.openFillsAndRemovals();
        const productName = await vending.enterFillsAndRemovalsForFirstRow('2', '1');
        await prepTasks.tapBackArrow();
        await vending.isHeaderDisplayed("Removals & Returns");

        // const productName = 'Sun Drop 20oz';
        // // await vending.enterRemovalReturnValues(productName, '2', '1');
        // await vending.enterProductValues(productName, {
        //   Delivery: '2',
        //   Spoiled: '1',
        // });
        // await prepTasks.tapBackArrow();
        // await vending.isHeaderDisplayed("Fills & Removals");
        expect(await vending.isCompleteDeliveryEnabled()).toBe(true);

      });

      await test.step('TC042: Skip After photos', async () => {
        await vending.openAfterPhotos();
        const modal = await vending.isPhotoModalVisible();
        expect(modal.skipPhoto).toBe(true);
        await vending.openSkipPhotoReasonSheet();
        expect(await vending.isSkipPhotoReasonSheetVisible()).toBe(true);
        expect(await vending.isSkipPhotoSubmitEnabled()).toBe(false);
        await vending.enterSkipPhotoReason('Camera cannot focus and take clear picture');
        await vending.waitForSkipPhotoSubmitEnabled(true);
        await vending.confirmSkipPhoto();
        expect(await vending.isSkipPhotoReasonSheetVisible()).toBe(false);
        await vending.tap("~Complete Delivery");
        expect(await dashboard.isNthServiceStationVisible('vending', 'first')).toBe(true);
        // add step to open and verify existing delivery with SPOT available
        if (!await dashboard.isNthServiceStationVisible('vending', 'first')) {
          await vending.clickVendingStationsIfCollapsed();
        }
        dashboard.openServiceStationByName('vending', stationName);
        expect(await vending.isVisible('~Edit Existing Delivery')).toBe(false);
        await vending.waitFor('~Edit Existing Delivery')
        await vending.tap('~Edit Existing Delivery');
        await vending.waitFor('~EDITING EXISTING DELIVERY')
        await vending.tapBackArrow();
        await vending.tap('~Edit Existing Delivery');
        await vending.waitFor('~EDITING EXISTING DELIVERY')
        await vending.verifySpotDeliveryDisplayed();

      });

      // await test.step('Delete Completed Delivery', async () => {
      //   if (!await dashboard.isNthServiceStationVisible('vending', 'first')) {
      //     await vending.clickVendingStationsIfCollapsed();
      //   }
      //   // expect(await vending.isServiceStationCompleted(stationName)).toBe(true);
      //   dashboard.openServiceStationByName('vending', stationName);
      //   expect(await vending.isVisible('~Edit Existing Delivery')).toBe(false);
      //   await vending.waitFor('~Edit Existing Delivery')
      //   await vending.tap('~Edit Existing Delivery');
      //   await vending.waitFor('~EDITING EXISTING DELIVERY')
      //   await vending.tapFullButton();
      //   await vending.isHeaderDisplayed('FULL SERVICE');
      //   await vending.tap(vending.deleteDelivery);
      //   await vending.tap('~Delete');
      //   if (!await dashboard.isNthServiceStationVisible('vending', 'first')) {
      //     await vending.clickVendingStationsIfCollapsed();
      //   }
      //   // const stationName = '69617 - Snacks';
      //   expect(await dashboard.isNthServiceStationVisible('vending', 'first')).toBe(true);
      //   await vending.isHeaderDisplayed(stationName);
      //   driver.pause(1000);
      //   await dashboard.waitForServiceStationVisible('vending', stationName);
      //   await dashboard.openServiceStationByName('vending', stationName);
      //   await vending.tapBackArrow();
      //   expect(await vending.isServiceStationCompleted(stationName)).toBe(false);
      //   dashboard.openServiceStationByName('vending', stationName);
      //   await vending.tapContinue();
      //   expect(await vending.isServiceStationCompleted('Before Photos')).toBe(false);
      // });
    });




  //Failed in sorting
  test(
    'reach the first Vending machine and verify Product fills, Sort, and Filter',
    { tag: ['@Vending-TC-001'] },
    async () => {
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const vending = new VendingServiceScreen(driver);

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        //  await loginAndEnsureRoute(driver, mobileConfig.vendingRoute);
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });

      await test.step("Open the first stop's first Vending machine", async () => {
        await dashboard.clickLocationByPosition('first');
        await dashboard.openNthServiceStation('vending', 'first');
        await vending.tapContinue();
      });

      await test.step('TC007/TC031: Machine type audit visibility edge cases [Vending | Audit should not be shown]', async () => {
        expect(await vending.isAuditVisible()).toBe(false);
      });

      await test.step('TC003: tap Before Photos and verify the Take photo/Skip photo modal', async () => {
        await vending.openBeforePhotos();
        const modal = await vending.isPhotoModalVisible();
        await vending.openSkipPhotoReasonSheet();
        await vending.enterSkipPhotoReason('Camera cannot focus and take clear picture');
        await vending.confirmSkipPhoto();
        // expect(await vending.isSkipPhotoReasonSheetVisible()).toBe(false);
      });

      await test.step("TC003/TC006: After Photos remains disabled until all required tasks are complete", async () => {
        expect(await vending.isAfterPhotosEnabled()).toBe(false);
        await vending.openMoneyOperations();
        await vending.performMoneyOperations({ bagCode: '12932', bills: '120', refund: '5.55' });
        expect(await vending.isFillsAndEndingInventoryDisabled()).toBe(false);
        await vending.openFillsAndEndingInventory();
        // await vending.fillAllProductQuantities();
        // await vending.fillAllProductDeliveryQuantities();
        await vending.fillAllProductEndQuantities();
        // await vending.tapBackArrow();
        await vending.tapBackArrow();
        await vending.openFillsAndEndingInventory();
        await vending.verifyAllProductEndQuantities();
        await vending.tapBackArrow();
        expect(await vending.isServiceStationCompleted('Fills & Ending Inventory')).toBe(true);
        expect(await vending.isAfterPhotosEnabled()).toBe(true);

      });



      await test.step('TC012/TC008/TC013: Fills and Ending Inventory data auto-saves without a Complete button on screen]', async () => {
        await vending.openFillsAndEndingInventory();
        expect(await vending.isProductTitleVisible()).toBe(true);

        // await vending.fillAllProductDeliveryQuantities();
        await vending.tapBackArrow();
        expect(await vending.isProductFillsTitleVisible()).toBe(false);
        await vending.openFills();
        expect(await vending.isProductFillsTitleVisible()).toBe(true);
      });

      await test.step('TC009: I am able to review Par, Capacity, Ordered, Picked values]', async () => {

        // await vending.clickMoreInfoArrow('Dasani Wtr 20oz');
        await vending.clickFirstMoreInfoArrow();
        // const productInfo = await vending.getProductInfoLabels('Dasani Wtr 20oz');
        const productInfo = await vending.getFirstProductInfoLabels();

        for (const [label, value] of Object.entries(productInfo)) {
          expect(Number.isInteger(value), `${label} should have a numeric value`).toBe(true);
          expect(value, `${label} should be displayed`).toBeGreaterThanOrEqual(0);
        }

      });

      await test.step('TC010: Keypad arrows move only between editable product quantity fields]', async () => {
        var deliveryFields = await vending.getEditableQuantityFields();
        await deliveryFields[0].click();
        await vending.waitForKeyboardVisible();

        // Press keypad down arrow
        await vending.tapKeypadDownArrow();
        await driver.pause(1000);
        deliveryFields = await vending.getEditableQuantityFields();
        expect(await deliveryFields[1].getAttribute('focused')).toBe('true');
        vending.tapBackArrow();
      });



      await test.step('TC011: Driver filters and sorts products on the Fills screen', async () => {
        await vending.openFillsAndEndingInventory();
        const defaultOrder = await vending.getFillProductNamesInOrder();
        await vending.openSortSheet();
        await vending.selectSortOption('A to Z');
        expect(await vending.isSortActive()).toBe(true);
        const aToZNames = await vending.getFillProductNamesInOrder();
        const sorted = [...defaultOrder].sort((a, b) => a.localeCompare(b));
        console.log('Default order:', defaultOrder);
        console.log('Sorted A to Z:', sorted);
        console.log('A to Z names from app:', aToZNames);
        expect.soft(aToZNames).toEqual(sorted);


        await vending.openSortSheet();
        expect(await vending.isClearSortEnabled()).toBe(true);
        await vending.tapClearSort();
        expect(await vending.isSortActive()).toBe(false);
        await vending.openSortSheet();
        await vending.selectSortOption('Z to A');
        expect(await vending.isSortActive()).toBe(true);
        const zToANames = await vending.getFillProductNamesInOrder();
        const sortedDesc = [...defaultOrder].sort((a, b) => b.localeCompare(a));
        expect.soft(zToANames).toEqual(sortedDesc);

        await vending.openSortSheet();
        expect(await vending.isClearSortEnabled()).toBe(true);
        await vending.tapClearSort();
        expect(await vending.isSortActive()).toBe(false);
        expect(await vending.getFillProductNamesInOrder()).toEqual(defaultOrder);


        await vending.openFilterSheet();
        expect(await vending.isFilterByCategoryLabelVisible()).toBe(true);
        expect(await vending.isApplyFiltersEnabled()).toBe(false);
        expect(await vending.isClearFiltersEnabled()).toBe(false);


        await vending.tapFilterChip('CANDY');
        // await vending.tapFilterChip('BOTTLE BEV');
        // await vending.tapFilterChip('CAN BEV');
        expect(await vending.isFilterChipSelected('CANDY')).toBe(true);
        // expect(await vending.isFilterChipSelected('CAN BEV')).toBe(true);
        expect(await vending.isApplyFiltersEnabled()).toBe(true);

        await vending.tapApplyFilters();
        expect(await vending.isFilterActive()).toBe(true);
        expect(await vending.isFilterTagVisible('CANDY')).toBe(true);
        // expect(await vending.isFilterTagVisible('CAN BEV')).toBe(true);

        await vending.openFilterSheet();
        await vending.tapClearFilters();
        expect(await vending.isFilterActive()).toBe(false);
        expect(await vending.isFilterTagVisible('CANDY')).toBe(false);
        // expect(await vending.isFilterTagVisible('CAN BEV')).toBe(false);

      });
    });



  //Passed
  //Complete Full service
  test(
    'Driver opens Planogram from Fills and verifies the screen',
    { tag: ['@Vending-TC-014'] },
    async () => {
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const vending = new VendingServiceScreen(driver);

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        //  await loginAndEnsureRoute(driver, mobileConfig.vendingRoute);
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });

      var stationName: string;
      var machineId: string;
      await test.step("Open the first stop's first Vending machine", async () => {
        await dashboard.clickLocationByPosition('first');
        stationName = await dashboard.getNthServiceStationName('vending', 'first');
        dashboard.openNthServiceStation('vending', 'first');
        console.log('Station Names', stationName);
        machineId = stationName.split('-')[0].trim();
        await vending.tapContinue();
      });


      await test.step('TC003: tap Before Photos and verify the Take photo/Skip photo modal', async () => {
        await vending.openBeforePhotos();
        const modal = await vending.isPhotoModalVisible();
        await vending.openSkipPhotoReasonSheet();
        await vending.enterSkipPhotoReason('Camera cannot focus and take clear picture');
        await vending.confirmSkipPhoto();
        // expect(await vending.isSkipPhotoReasonSheetVisible()).toBe(false);
      });

      await test.step("TC003/TC006: After Photos remains disabled until all required tasks are complete", async () => {
        expect(await vending.isAfterPhotosEnabled()).toBe(false);
        await vending.openMoneyOperations();
        await vending.performMoneyOperations({ bagCode: '12933', bills: '120', refund: '5.55' });
        expect(await vending.isFillsAndEndingInventoryDisabled()).toBe(false);
        await vending.openFillsAndEndingInventory();
        // await vending.fillAllProductQuantities();
        // await vending.fillAllProductDeliveryQuantities();
        await vending.fillAllProductEndQuantities();
        // await vending.tapBackArrow();
        await vending.tapBackArrow();
        expect(await vending.isAfterPhotosEnabled()).toBe(true);
      });



      await test.step('TC008/TC013/TC012: Fills and Ending Inventory data auto-saves without a Complete button on screen]', async () => {
        await vending.openFillsAndEndingInventory();
        expect(await vending.isProductTitleVisible()).toBe(true);

        //verify values
        // await vending.fillAllProductDeliveryQuantities();

        await vending.tapBackArrow();
        expect(await vending.isProductFillsTitleVisible()).toBe(false);
        await vending.openFills();
        expect(await vending.isProductFillsTitleVisible()).toBe(true);
      });


      // Filter/Sort/Planogram, no Add (documented discrepancy).
      await test.step('TC015/TC016/TC017: header shows Planogram, Planogram opens from the header icon', async () => {
        const actions = await vending.isFillsHeaderActionsVisible();
        await vending.openPlanogram();
        expect(await vending.isPlanogramTitleVisible()).toBe(true);
        await vending.verifyDateRouteHeader();

        const header = await vending.isDateRouteHeaderVisible();
        expect.soft(header.date).toBe(true);
        expect.soft(header.route).toBe(true);

        expect(await vending.isHeaderDisplayed("Planogram")).toBe(true);
        // expect(await vending.isHeaderDisplayed("Machine 3285345 POG")).toBe(true);
        await vending.verifyMachinePogHeader();

        //Verify layout toggles are visible
        expect(await vending.isGridLayoutToggleVisible()).toBe(true);
        await vending.openLabelNameDropdown();
        expect(await vending.isOptionDisplayed('Ending inventory')).toBe(true);
        expect(await vending.isOptionDisplayed('Fills')).toBe(true);
        expect(await vending.isOptionDisplayed('Par / Capacity')).toBe(true);
        expect(await vending.isOptionDisplayed('Price')).toBe(true);
        expect(await vending.isOptionDisplayed('Spoils / Return to truck')).toBe(true);
        expect(await vending.isOptionDisplayed('Service tests')).toBe(true);
        expect(await vending.isOptionDisplayed('Product')).toBe(true);

        await vending.selectLabelNameOption('Par / Capacity');
        // Verify Par/Capacity labels and values
        expect(await vending.isParCapacityHeaderVisible()).toBe(true);
        expect(await vending.getParCapacityRowCount()).toBeGreaterThan(0);
        expect(await vending.isParCapacityDataDisplayed()).toBe(true);

        expect(
          await vending.isGridViewDisplayed()
        ).toBe(true);

        // Toggle layout
        // await vending.switchParCapacityLayout();
        await vending.switchParCapacityLayoutToRight();
        await vending.waitForListViewLayout();
        expect(await vending.isListViewDisplayed()).toBe(true);

        await vending.pressKeyCode(4);
        await vending.waitFor('~Product fills');
        await vending.enterFirstEndValue('0');
        await vending.tapBackArrow();
      });

      await test.step('TC005: Spoiled=2/RETK=1 saves and appears with an aggregate Qty of 3', async () => {
        await vending.openRemovalsAndReturns();
        // await vending.searchAndSelect('Snickers');
        await vending.fillRemovalsSpoiledRetkQuantities({ spoiled: '2', truckReturns: '1' });
        await prepTasks.tapBackArrow();
        await vending.isHeaderDisplayed('Removals & Returns')
        await vending.openRemovalsAndReturns();
        expect(await vending.getSpoiledQuantity()).toBe('2');
        expect(await vending.getTruckReturnsQuantity()).toBe('1');
        await prepTasks.tapBackArrow();
        await vending.isHeaderDisplayed('Removals & Returns');
        expect(await vending.isServiceStationCompleted('Removals & Returns')).toBe(true);
      });

      await test.step('Skip After photos and complete Delivery', async () => {
        await vending.openAfterPhotos();
        const modal = await vending.isPhotoModalVisible();
        expect(modal.takePhoto).toBe(true);
        expect(modal.skipPhoto).toBe(true);
        await vending.openSkipPhotoReasonSheet();
        expect(await vending.isSkipPhotoReasonSheetVisible()).toBe(true);
        expect(await vending.isSkipPhotoSubmitEnabled()).toBe(false);
        await vending.enterSkipPhotoReason('Camera cannot focus and take clear picture');
        await vending.waitForSkipPhotoSubmitEnabled(true);
        await vending.confirmSkipPhoto();
        expect(await vending.isSkipPhotoReasonSheetVisible()).toBe(false);

        await vending.tap("~Complete Delivery");
        await vending.isServiceStationCompleted(stationName);
      });

      await test.step('Delete Completed Delivery', async () => {
        if (!await dashboard.isNthServiceStationVisible('vending', 'first')) {
          await vending.clickVendingStationsIfCollapsed();
        }
        expect(await vending.isServiceStationCompleted(stationName)).toBe(true);
        dashboard.openServiceStationByName('vending', stationName);
        expect(await vending.isVisible('~Edit Existing Delivery')).toBe(false);
        await vending.waitFor('~Edit Existing Delivery')
        await vending.tap('~Edit Existing Delivery');
        await vending.waitFor('~EDITING EXISTING DELIVERY')
        await vending.tapFullButton();
        await vending.isHeaderDisplayed('FULL SERVICE');
        await vending.tap(vending.deleteDelivery);
        await vending.tap('~Delete');
        if (!await dashboard.isNthServiceStationVisible('vending', 'first')) {
          await vending.clickVendingStationsIfCollapsed();
        }
        // const stationName = '69617 - Snacks';
        expect(await dashboard.isNthServiceStationVisible('vending', 'first')).toBe(true);
        await vending.isHeaderDisplayed(stationName);
        driver.pause(1000);
        await dashboard.waitForServiceStationVisible('vending', stationName);
        await dashboard.openServiceStationByName('vending', stationName);
        await vending.tapBackArrow();
        expect(await vending.isServiceStationCompleted(stationName)).toBe(false);
        dashboard.openServiceStationByName('vending', stationName);
        await vending.tapContinue();
        expect(await vending.isServiceStationCompleted('Before Photos')).toBe(false);
      });
    });












  //Passed
  test(
    'Skip stop',
    { tag: ['@Vending-TC-038', '@Vending-TC-039', '@Vending-TC-003'] },
    async () => {
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const vending = new VendingServiceScreen(driver);
      const endDay = new EndDayScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        //  await loginAndEnsureRoute(driver, mobileConfig.vendingRoute);
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });
      var stationName: string;
      var machineId: string;
      await test.step("Driver skips a stop", async () => {
        await dashboard.clickLocationByPosition('first');
        await dashboard.isNthServiceStationVisible('vending', 'first');

        stationName = await dashboard.getNthServiceStationName('vending', 'first');
        // dashboard.openNthServiceStation('vending', 'first');
        console.log('Station Names', stationName);
        // machineId = stationName.split('-')[0].trim();


        await dashboard.swipeAndSkipServiceStation("vending", "first");
        expect(await vending.tapSkipReasonDropdown()).toBe(true);
        await vending.selectSkipReason('Driver Skipped');
        // await vending.selectLeaveOnTruck();
        await vending.tap('~Leave on truck');
        await vending.tap('~Skip stop');
        expect(await vending.isServiceStationSkipped(stationName)).toBe(true);

        if (!await dashboard.isNthServiceStationVisible('vending', 'first')) {
          await vending.clickVendingStationsIfCollapsed();
        }
        expect(await dashboard.isNthServiceStationVisible('vending', 'first')).toBe(true);
      });


      await test.step("Driver can resume service on a previously skipped machine", async () => {
        await dashboard.tapViewSchedule();
        await dashboard.clickLocationByPosition('first');
        stationName = await dashboard.getNthServiceStationName('vending', 'first');
        dashboard.openNthServiceStation('vending', 'first');
        console.log('Station Names', stationName);
        machineId = stationName.split('-')[0].trim();
      });

      await test.step(
        'TC030: Verify FULL SERVICE task list screen',
        async () => {
          await vending.tapContinue();
          expect(await vending.isMachineDisplayed(machineId)).toBe(true);
          expect(await vending.isHeaderDisplayed('FULL SERVICE')).toBe(true);
          expect(await vending.isBeforePhotosEnabled()).toBe(true);
          expect(await vending.isMoneyOperationsEnabled()).toBe(true);
          expect(await vending.isFillsAndEndingInventoryDisabled()).toBe(true);
          expect(await vending.isRemovalsAndReturnsDisabled()).toBe(true);
          expect(await vending.isKitReturnsEnabled()).toBe(true);
          expect(await vending.isAfterPhotosDisabled()).toBe(true);
        }
      );

      await test.step('TC003/TC001: tap Before Photos and verify the Take photo/Skip photo modal', async () => {
        await vending.openBeforePhotos();
        const modal = await vending.isPhotoModalVisible();
        expect(modal.takePhoto).toBe(true);
        expect(modal.skipPhoto).toBe(true);
        await vending.openSkipPhotoReasonSheet();
        expect(await vending.isSkipPhotoReasonSheetVisible()).toBe(true);
        expect(await vending.isSkipPhotoSubmitEnabled()).toBe(false);
        await vending.enterSkipPhotoReason('Camera cannot focus and take clear picture');
        await vending.waitForSkipPhotoSubmitEnabled(true);
        await vending.confirmSkipPhoto();
        expect(await vending.isServiceStationCompleted('Before Photos')).toBe(true);
      });

      await test.step("TC003/TC006: After Photos remains disabled until all required tasks are complete", async () => {
        expect(await vending.isAfterPhotosEnabled()).toBe(false);
        await vending.openMoneyOperations();
        await vending.performMoneyOperations({ bagCode: '12934', bills: '120', refund: '5.55' });
        expect(await vending.isFillsAndEndingInventoryDisabled()).toBe(false);
        await vending.openFillsAndEndingInventory();
        await vending.fillAllProductEndQuantities();
        // await vending.fillAllProductDeliveryQuantities();
        await vending.tapBackArrow();
        // await vending.tapBackArrow();
        expect(await vending.isAfterPhotosEnabled()).toBe(true);
      });

      await test.step('TC031: Machine type audit visibility edge cases [Vending | Audit should not be shown]', async () => {
        expect(await vending.isAuditVisible()).toBe(false);
      });

      await test.step('TC005: Spoiled=2/RETK=1 saves and appears with an aggregate Qty of 3', async () => {
        await vending.openRemovalsAndReturns();
        const productName = await vending.enterFillsAndRemovalsForFirstRow('2', '1');
        await prepTasks.tapBackArrow();
        await vending.isHeaderDisplayed("Removals & Returns");



        // await vending.openRemovalsAndReturns();
        // //update
        // const productName = 'Sun Drop 20oz';
        // await vending.enterRemovalReturnValues(productName, '2', '1');
        // await prepTasks.tapBackArrow();
        // await vending.isHeaderDisplayed("Removals & Returns");
        await vending.openRemovalsAndReturns();
        // Verify persisted values
        await vending.verifyRemovalReturnValues(productName, '2', '1');
        await prepTasks.tapBackArrow();
      });

      await test.step('Skip After photos', async () => {
        await vending.openAfterPhotos();
        const modal = await vending.isPhotoModalVisible();
        expect(modal.takePhoto).toBe(true);
        expect(modal.skipPhoto).toBe(true);
        await vending.openSkipPhotoReasonSheet();
        expect(await vending.isSkipPhotoReasonSheetVisible()).toBe(true);
        expect(await vending.isSkipPhotoSubmitEnabled()).toBe(false);
        await vending.enterSkipPhotoReason('Camera cannot focus and take clear picture');
        await vending.waitForSkipPhotoSubmitEnabled(true);
        await vending.confirmSkipPhoto();
        expect(await vending.isSkipPhotoReasonSheetVisible()).toBe(false);

        await vending.tap("~Complete Delivery");
        await dashboard.waitForServiceStationVisible('vending', stationName);
        expect(await vending.isServiceStationCompleted(stationName)).toBe(true);
      });

      await test.step('Delete Completed Delivery', async () => {
        if (!await dashboard.isNthServiceStationVisible('vending', 'first')) {
          await vending.clickVendingStationsIfCollapsed();
        }
        expect(await vending.isServiceStationCompleted(stationName)).toBe(true);
        dashboard.openServiceStationByName('vending', stationName);
        expect(await vending.isVisible('~Edit Existing Delivery')).toBe(false);
        await vending.waitFor('~Edit Existing Delivery')
        await vending.tap('~Edit Existing Delivery');
        await vending.waitFor('~EDITING EXISTING DELIVERY')
        await vending.tapFullButton();
        await vending.isHeaderDisplayed('FULL SERVICE');
        await vending.tap(vending.deleteDelivery);
        await vending.tap('~Delete');
        if (!await dashboard.isNthServiceStationVisible('vending', 'first')) {
          await vending.clickVendingStationsIfCollapsed();
        }
        // const stationName = '69617 - Snacks';
        expect(await dashboard.isNthServiceStationVisible('vending', 'first')).toBe(true);
        await vending.isHeaderDisplayed(stationName);
        driver.pause(1000);
        await dashboard.waitForServiceStationVisible('vending', stationName);
        await dashboard.openServiceStationByName('vending', stationName);
        await vending.tapBackArrow();
        expect(await vending.isServiceStationCompleted(stationName)).toBe(false);
        dashboard.openServiceStationByName('vending', stationName);
        await vending.tapContinue();
        expect(await vending.isServiceStationCompleted('Before Photos')).toBe(false);
      });


    });





  //Need a existing full delivery dependent on TC 'Skip stop'
  //Passed
  test(
    'Existing order Full service',
    { tag: ['@Vending-TC-030'] },
    async () => {
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const vending = new VendingServiceScreen(driver);

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        //  await loginAndEnsureRoute(driver, mobileConfig.vendingRoute);
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });
      var stationName: string;
      var machineId: string;
      await test.step("Open the first stop's first Vending machine", async () => {
        await dashboard.clickLocationByPosition('first');
        stationName = await dashboard.getNthServiceStationName('vending', 'first');
        dashboard.openNthServiceStation('vending', 'first');
        console.log('Station Names', stationName);
        machineId = stationName.split('-')[0].trim();
      });


      await test.step(
        'TC030: Verify FULL SERVICE task list screen',
        async () => {
          // await vending.tap('~Edit Existing Delivery');
          // await vending.waitFor('~EDITING EXISTING DELIVERY')
          // await vending.tapFullButton();

          const orderText = await vending.getOrderText();
          expect(orderText).not.toContain('No Order Available');
          expect(orderText).toMatch(/Order:\s*\S+/);

          await vending.tapContinue();
          expect(await vending.isMachineDisplayed(machineId)).toBe(true);
          expect(await vending.isHeaderDisplayed('FULL SERVICE')).toBe(true);
          expect(await vending.isBeforePhotosEnabled()).toBe(true);
          expect(await vending.isMoneyOperationsEnabled()).toBe(true);
          expect(await vending.isFillsAndEndingInventoryDisabled()).toBe(true);
          expect(await vending.isRemovalsAndReturnsDisabled()).toBe(true);
          // expect(await vending.isDexEnabled()).toBe(true);
          expect(await vending.isKitReturnsEnabled()).toBe(true);
          expect(await vending.isAfterPhotosDisabled()).toBe(true);
        }
      );

      await test.step('TC003: tap Before Photos and verify the Take photo/Skip photo modal', async () => {
        await vending.openBeforePhotos();
        const modal = await vending.isPhotoModalVisible();
        await vending.openSkipPhotoReasonSheet();
        await vending.enterSkipPhotoReason('Camera cannot focus and take clear picture');
        await vending.confirmSkipPhoto();
      });

      await test.step("TC003/TC006: After Photos remains disabled until all required tasks are complete", async () => {
        expect(await vending.isAfterPhotosEnabled()).toBe(false);
        await vending.openMoneyOperations();
        await vending.performMoneyOperations({ bagCode: '12935', bills: '120', refund: '5.55' });
        expect(await vending.isFillsAndEndingInventoryDisabled()).toBe(false);
        await vending.openFillsAndEndingInventory();
        // await vending.fillAllProductDeliveryQuantities();
        await vending.fillAllProductEndQuantities();
        await vending.tapBackArrow();
        // await vending.tapBackArrow();
        expect(await vending.isServiceStationCompleted('Fills & Ending Inventory')).toBe(true);
        expect(await vending.isAfterPhotosEnabled()).toBe(true);
      });

      await test.step('TC031: Machine type audit visibility edge cases [Vending | Audit should not be shown]', async () => {
        expect(await vending.isAuditVisible()).toBe(false);
      });

      await test.step('TC005/TC006: Spoiled=2/RETK=1 saves and appears with an aggregate Qty of 3', async () => {
        // await vending.openRemovalsAndReturns();
        // await vending.tapBackArrow();
        // await vending.isHeaderDisplayed("Removals & Returns");

        await vending.openRemovalsAndReturns();
        const productName = await vending.enterFillsAndRemovalsForFirstRow('2', '1');
        await prepTasks.tapBackArrow();
        await vending.isHeaderDisplayed("Removals & Returns");


        // await vending.openRemovalsAndReturns();
        // const productName = 'Sun Drop 20oz';
        // await vending.enterRemovalReturnValues(productName, '2', '1');
        // await prepTasks.tapBackArrow();
        // await vending.isHeaderDisplayed("Removals & Returns");

        await vending.openRemovalsAndReturns();
        // Verify persisted values
        await vending.verifyRemovalReturnValues(productName, '2', '1');
        await prepTasks.tapBackArrow();
        /****** confirm delete delivery **** */
        await prepTasks.tapBackArrow();
        await vending.isHeaderDisplayed("The service must be completed or deleted.  Do you want to delete all information for this service?")
        await vending.tap('~Yes');
      });

    });









  //Passed
  test(
    'Money Operations',
    { tag: ['@Vending-TC-018', '@Vending-TC-019', '@Vending-TC-020', '@Vending-TC-021', '@Vending-TC-022'] },
    async () => {
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const vending = new VendingServiceScreen(driver);

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        // await loginAndEnsureRoute(driver, mobileConfig.vendingRoute);
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });

      await test.step("Open the first stop's first Vending machine", async () => {
        await dashboard.clickLocationByPosition('first');
        await dashboard.openNthServiceStation('vending', 'first');
        await vending.tapContinue();
      });


      await test.step('TC018: Money bag number length validation [3 to 5 | accepted without error]', async () => {
        await vending.openMoneyOperations();
        expect(await vending.isSkipMoneyBagChecked()).toBe(false);
        // await prepTasks.setChecklistIconState(vending.skipMoneyBagCheckbox, false);
        const fields = await vending.isMoneyCollectionScreenVisible();
        expect(fields.title).toBe(true);
        expect(fields.skipMoneyBag).toBe(true);
        expect(fields.bagCode).toBe(true);
        expect(fields.bills).toBe(true);
        expect(fields.refund).toBe(true);

        await vending.performMoneyOperations({ bagCode: '12936', bills: '120', refund: '5.55' });
        await vending.isMoneyOperationsVisible();
        await vending.openMoneyOperations();
        const values = await vending.getMoneyOperationsValues();
        expect(values.bagCode).toBe('12936');
        expect(values.bills).toBe('120');
        expect(values.refund).toBe('5.55');
      });

      await test.step('TC019: Money bag number length validation [more than 5 | rejected with an error message]', async () => {
        await vending.enterBagCode('987654321');
        await vending.tapBackArrow();
        await vending.isMoneyOperationsVisible();
        // expect(await vending.isMoneyOperationsVisible()).toBe(false);
        // await vending.enterBagCode('98765')
        await vending.openMoneyOperations();
        const values = await vending.getMoneyOperationsValues();
        expect(values.bagCode).toBe('98765');
      });

      await test.step('TC020: Skip Money Bag does not auto-select when bag number is deleted', async () => {
        await vending.clearBagCode();
        expect(await vending.isSkipMoneyBagSelected()).toBe(false);
      });

      await test.step('TC021: Numeric entry validation accepts valid and blocks invalid values [Money Operations]', async () => {
        // await vending.enterBagCode('AB981');
        await vending.enterBagCodeInMoneyOperations('ABCDE');
        // await vending.enterBagCode('AB981');
        await vending.tapBackArrow();
        //  await vending.performMoneyOperations({ bagCode: 'AB981'});
        expect(await vending.isMoneyOperationsVisible()).toBe(false);
        await vending.enterBagCodeInMoneyOperations('@@@');
        await vending.tapBackArrow();
        expect(await vending.isVisible('~Money Collection')).toBe(true);
        expect(await vending.isMoneyOperationsVisible()).toBe(false);
      });

      await test.step('TC022: Vending money operations validate bag codes, refund, and replenishment inputs]', async () => {
        await vending.verifyBagCodeDisabledWhenSkipSelected();
        await prepTasks.setChecklistIconState(vending.skipMoneyBagCheckbox, false);
        await vending.enterBagCode('12345');
        await vending.openAdditionalBagCodeField();
        await vending.enterAdditionalBagCode(1, '12345');
        await vending.tapBackArrow();
        expect(await vending.isDuplicateBagCodeErrorVisible()).toBe(true);
        expect(await vending.isVisible('~Money Collection')).toBe(true);
        await vending.deleteAdditionalBagCodeRow();
        await vending.tapBackArrow();
        await vending.openMoneyOperations();
        await vending.performMoneyOperations({ bagCode: '12937', bills: '120', refund: '5.55' });
      });
    });


  //Passed
  test.only(
    'Service List',
    {
      tag: ['@Vending-TC-024', '@Vending-TC-025', '@Vending-TC-026', '@Vending-TC-027',
        '@Vending-TC-028', '@Vending-TC-043', '@Vending-TC-033']
    },
    async () => {
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const vending = new VendingServiceScreen(driver);

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        // await loginAndEnsureRoute(driver, mobileConfig.vendingRoute);
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });
      var stationName: string;
      var machineId: string;
      await test.step("TC037/TC044: Open the first stop's first Vending machine", async () => {
        const isHeaderDisplayed = await vending.isHeaderDisplayed('Vending');
        expect(isHeaderDisplayed).toBe(true);
        //Aaron's
        // await dashboard.clickLocationByPosition('first');
        const locationName = await vending.getLocationNameByPosition('first');
        console.log(locationName);
        await dashboard.clickLocationByName(locationName)
        expect(await vending.isHeaderDisplayed(locationName)).toBe(true);
        const address = await vending.getHeaderAddress(locationName);
        expect(address).toBeTruthy();
        expect(address).not.toEqual('');
        stationName = await dashboard.getNthServiceStationName('vending', 'first');
        dashboard.openNthServiceStation('vending', 'first');
        console.log('Station Name', stationName);
        machineId = stationName.split('-')[0].trim();
      });



      await test.step('TC024/TC033: Verify details in service screen', async () => {
        const formattedStationName = vending.formatStationName(stationName);
        expect(await vending.isHeaderDisplayed(formattedStationName)).toBe(true);
        // expect(await vending.isHeaderDisplayed('11328 - Bottle Bev (Breakroom)')).toBe(true);
        // expect(await vending.isHeaderDisplayed('99092 - Bottle Bev (WPB Teachers Lounge)')).toBe(true);
        expect(await vending.isHeaderDisplayed("Order:")).toBe(true);
        expect(await vending.isHeaderDisplayed("FINAL")).toBe(true);
        expect(await vending.isHeaderDisplayed("SPOT")).toBe(true);
        expect(await vending.isContinueEnabled()).toBe(true);

      });


      await test.step('TC043: Order number displays on Delivery page when an order exists; otherwise "No Orders" is displayed',
        async () => {
          const orderText = await vending.getOrderText();
          if (orderText.includes('No Order Available')) {
            expect(orderText).toContain('No Order Available');
          } else {
            expect(orderText).toMatch(/Order:\s*\S+/);
          }
          await vending.tapContinue();
        }
      );



      await test.step(
        'TC025: Verify FULL SERVICE task list screen',
        async () => {
          expect(await vending.isMachineDisplayed(machineId)).toBe(true);
          expect(await vending.isHeaderDisplayed('FULL SERVICE')).toBe(true);
          expect(await vending.isBeforePhotosEnabled()).toBe(true);
          expect(await vending.isMoneyOperationsEnabled()).toBe(true);
          expect(await vending.isFillsAndEndingInventoryDisabled()).toBe(true);
          expect(await vending.isRemovalsAndReturnsDisabled()).toBe(true);
          expect(await vending.isKitReturnsEnabled()).toBe(true);
          expect(await vending.isAfterPhotosDisabled()).toBe(true);
          vending.tapBackArrow();
          vending.tap('~Yes')
        }
      );

      await test.step(
        'TC026: Verify Final Service confirmation popup is displayed',
        async () => {
          await vending.tapFinal();

          expect(await vending.isHeaderDisplayed('Do you want to continue with final service?')).toBe(true);
          expect(await vending.isNoButtonDisplayed()).toBe(true);
          expect(await vending.isYesButtonDisplayed()).toBe(true);
          expect(await vending.isYesButtonEnabled()).toBe(true);
        }
      );

      await test.step(
        'TC027: Verify Final Service tasks after clicking Yes',
        async () => {
          await vending.tapYes();
          //expect(await vending.isMachineDisplayed(machineId)).toBe(true);
          expect(await vending.isHeaderDisplayed('Before Photos')).toBe(true);
          expect(await vending.isHeaderDisplayed('Money Operations')).toBe(true);
          expect(await vending.isHeaderDisplayed('Removals & Returns')).toBe(true);
          expect(await vending.isHeaderDisplayed('After Photos')).toBe(true);
          expect(await vending.isBeforePhotosEnabled()).toBe(true);
          expect(await vending.isMoneyOperationsEnabled()).toBe(true);
          expect(await vending.isRemovalsAndReturnsEnabled()).toBe(false);
          expect(await vending.isAfterPhotosEnabled()).toBe(false);
          vending.tapBackArrow();
          vending.tap('~Yes')
        }
      );


      await test.step(
        'TC028: Verify SPOT Service task list screen',
        async () => {
          await vending.tapSpot();
          const header = await vending.isDateRouteHeaderVisible();
          expect(header.date).toBe(true);
          expect(header.route).toBe(true);
          // expect(await vending.isMachineDisplayed(machineId)).toBe(true);
          expect(await vending.isHeaderDisplayed('SPOT SERVICE')).toBe(true);
          expect(await vending.isBeforePhotosEnabled()).toBe(true);
          expect(await vending.isMoneyOperationsEnabled()).toBe(true);
          expect(await vending.isFillsAndRemovalsDisabled()).toBe(false);
          expect(await vending.isAfterPhotosDisabled()).toBe(false);
          expect(await vending.isCompleteDeliveryDisabled()).toBe(true);
        }
      );

    });







  //Pre-requisite: Data Dependency Wet(UNITED FACILITIES INC, 20013 - Hot Beverage) & 
  // Changer machines(BNSF Railway/80012 - Bill Changers)
  test(
    'Spot Service is not offered for Wet or Changer machines',
    { tag: ['@Vending-TC-034', '@Vending-TC-024', '@Vending-TC-045', '@Vending-TC-045'] },
    async () => {
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const vending = new VendingServiceScreen(driver);

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.vendingWetMachineRoute);
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });
      var stationName: string;
      var machineId: string;

      //Data Dependency
      await test.step("Open the Changer Vending machine", async () => {
        await dashboard.clickLocationByName('BNSF Railway');
        await vending.isHeaderDisplayed('BNSF Railway')
        dashboard.openServiceStationByName('vending', '80012 - Bill Changers');
        // machineId = stationName.split('-')[0].trim();
      });

      await test.step('Verify service selection screen', async () => {
        expect(await vending.isHeaderDisplayed("Order:")).toBe(true);
        expect(await vending.isHeaderDisplayed("FINAL")).toBe(true);
        expect(await vending.isHeaderDisplayed("SPOT")).toBe(false);
        expect(await vending.isContinueEnabled()).toBe(true);
        await vending.tapBackArrow();
        await vending.tap('~Open navigation menu');
        await vending.tap('~Schedule overview');
        // await vending.tapBackArrow();
      });


      await test.step("Open the Wet Vending machine", async () => {

        await vending.scrollUpUntilVisible(vending.pendingActionTab);
        await dashboard.clickLocationByName('UNITED FACILITIES INC');
        dashboard.openServiceStationByName('vending', '20013 - Hot Beverage');
      });

      await test.step('Verify service selection screen', async () => {
        // const formattedStationName = vending.formatStationName(stationName);
        // expect(await vending.isHeaderDisplayed(formattedStationName)).toBe(true);
        expect(await vending.isHeaderDisplayed("Order:")).toBe(true);
        expect(await vending.isHeaderDisplayed("FINAL")).toBe(true);
        expect(await vending.isHeaderDisplayed("SPOT")).toBe(false);
        expect(await vending.isContinueEnabled()).toBe(true);
        await vending.tapContinue();
      });

      await test.step(
        'TC025: Verify FULL SERVICE task list screen',
        async () => {
          // expect(await vending.isMachineDisplayed(machineId)).toBe(true);
          expect(await vending.isHeaderDisplayed('FULL SERVICE')).toBe(true);
          expect(await vending.isBeforePhotosEnabled()).toBe(true);
          expect(await vending.isMoneyOperationsEnabled()).toBe(true);
          expect(await vending.isDexEnabled()).toBe(true);
          expect(await vending.isMeterEnabled()).toBe(false);
          expect(await vending.isAfterPhotosDisabled()).toBe(true);
          // vending.tapBackArrow();
          // vending.tap('~Yes')
        }
      );

      await test.step('TC003/TC001: tap Before Photos and verify the Take photo/Skip photo modal for Wet Machine', async () => {
        await vending.openBeforePhotos();
        const modal = await vending.isPhotoModalVisible();
        expect(modal.takePhoto).toBe(true);
        expect(modal.skipPhoto).toBe(true);
        await vending.openSkipPhotoReasonSheet();
        expect(await vending.isSkipPhotoReasonSheetVisible()).toBe(true);
        expect(await vending.isSkipPhotoSubmitEnabled()).toBe(false);
        await vending.enterSkipPhotoReason('Camera cannot focus and take clear picture');
        await vending.waitForSkipPhotoSubmitEnabled(true);
        await vending.confirmSkipPhoto();
        expect(await vending.isServiceStationCompleted('Before Photos')).toBe(true);

      });

      await test.step("TC003/TC006: After Photos remains disabled until all required tasks are complete", async () => {
        expect(await vending.isAfterPhotosEnabled()).toBe(false);
        await vending.openMoneyOperations();
        await vending.enterBagCode('12938');
        vending.tapBackArrow();
        expect(await vending.isMeterEnabled()).toBe(true);
        expect(await vending.isDexEnabled()).toBe(true);

        await vending.openMeters();
        expect(await vending.isMetersHeaderDisplayed()).toBe(true);
        await vending.enterUnitMeterReading(99); // invalid value
        await vending.tapMetersHeader();
        // await vending.verifyMeterReadingErrorMessage(
        //   'Please enter a valid meter reading');
        // await vending.tapBackArrow();
        // expect(await vending.isServiceStationCompleted('Meter')).toBe(false);
        //Enter valid readings and  Meter should be completed
        //
        await vending.enterUnitMeterReading('1'); // valid value
        await vending.tapMetersHeader();
        await vending.tapBackArrow();
        expect(await vending.isServiceStationCompleted('Meter')).toBe(true);
      });


      await test.step('Skip After photos', async () => {
        expect(await vending.isAfterPhotosEnabled()).toBe(true);
        await vending.openAfterPhotos();
        const modal = await vending.isPhotoModalVisible();
        await vending.openSkipPhotoReasonSheet();
        expect(await vending.isSkipPhotoReasonSheetVisible()).toBe(true);
        expect(await vending.isSkipPhotoSubmitEnabled()).toBe(false);
        await vending.enterSkipPhotoReason('Camera cannot focus and take clear picture');
        await vending.waitForSkipPhotoSubmitEnabled(true);
        await vending.confirmSkipPhoto();
        expect(await vending.isSkipPhotoReasonSheetVisible()).toBe(false);
      });

      await test.step('Complete Delivery', async () => {
        await vending.tap("~Complete Delivery");
        await vending.isServiceStationCompleted("20013 - Hot Beverage");
      });

    });


















  // test(
  //   'Service List',
  //   { tag: ['@Vending-TC-024'] },
  //   async () => {
  //     const prepTasks = new PrepTasksScreen(driver);
  //     const dashboard = new DashboardScreen(driver);
  //     const vending = new VendingServiceScreen(driver);

  //     // await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
  //     //   await prepTasks.openFromHamburgerMenu();
  //     //   await prepTasks.ensureFullDayPrepComplete();
  //     // });
  //     var stationName: string;
  //     var machineId: string;
  //     await test.step("Open the first stop's first Vending machine", async () => {
  //       await dashboard.clickLocationByPosition('first');
  //       stationName = await dashboard.getNthServiceStationName('vending', 'first');
  //       dashboard.openNthServiceStation('vending', 'first');
  //       console.log('Station Names', stationName);
  //       machineId = stationName.split('-')[0].trim();
  //     });

  //     await test.step(
  //       'TC025: Verify FULL SERVICE task list screen',
  //       async () => {
  //         // expect(await vending.isMachineDisplayed(machineId)).toBe(true);
  //         expect(await vending.isHeaderDisplayed('FULL SERVICE')).toBe(true);
  //         expect(await vending.isBeforePhotosEnabled()).toBe(true);
  //         expect(await vending.isMoneyOperationsEnabled()).toBe(true);
  //         expect(await vending.isFillsAndEndingInventoryDisabled()).toBe(true);
  //         expect(await vending.isRemovalsAndReturnsDisabled()).toBe(true);
  //         expect(await vending.isDexEnabled()).toBe(true);
  //         expect(await vending.isAfterPhotosDisabled()).toBe(true);
  //         vending.tapBackArrow();
  //         vending.tap('~Yes')
  //       }
  //     );

  //     await test.step('Verify service selection screen', async () => {

  //       const formattedStationName = vending.formatStationName(stationName);
  //       expect(await vending.isHeaderDisplayed(formattedStationName)).toBe(true);
  //      // expect(await vending.isHeaderDisplayed('11328 - Bottle Bev (Breakroom)')).toBe(true);
  //       expect(await vending.isHeaderDisplayed("Order:")).toBe(true);
  //       expect(await vending.isHeaderDisplayed("FINAL")).toBe(true);
  //       expect(await vending.isHeaderDisplayed("SPOT")).toBe(true);
  //       expect(await vending.isContinueEnabled()).toBe(true);
  //       await vending.tapContinue();
  //     });

  //     await test.step(
  //       'TC025: Verify FULL SERVICE task list screen',
  //       async () => {
  //         expect(await vending.isMachineDisplayed(machineId)).toBe(true);
  //         expect(await vending.isHeaderDisplayed('FULL SERVICE')).toBe(true);
  //         expect(await vending.isBeforePhotosEnabled()).toBe(true);
  //         expect(await vending.isMoneyOperationsEnabled()).toBe(true);
  //         expect(await vending.isFillsAndEndingInventoryDisabled()).toBe(true);
  //         expect(await vending.isRemovalsAndReturnsDisabled()).toBe(true);
  //         expect(await vending.isDexEnabled()).toBe(true);
  //         expect(await vending.isAfterPhotosDisabled()).toBe(true);
  //         vending.tapBackArrow();
  //         vending.tap('~Yes')
  //       }
  //     );

  //   });
});