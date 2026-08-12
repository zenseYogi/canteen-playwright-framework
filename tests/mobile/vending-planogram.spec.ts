import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndWaitForMfa } from '../../utils/login-flow';
import { VendingDeliveryScreen } from '../../screens/vending-delivery.screen';
import { DashboardScreen } from '../../screens/dashboard.screen';
import { TruckStockTruckReturnsScreen } from '../../screens/truck-stock-truck-returns.screen';
import { HomeScreen } from '@screens/home.screen';
import { VendingRemovalReturnScreen } from '@screens/vending-removal-returns.screen';
import { VendingPlanogramScreen } from '@screens/vending-planogram.screen';
import { PrepTasksScreen } from '@screens/prep-tasks.screen';


test.describe('Truck Stock -  vending returns workflow', () => {
  test('open Truck returns, add a product under vending', async ({ driver }) => {
    const truckReturns = new TruckStockTruckReturnsScreen(driver);
    const vendingRemovalReturn = new VendingRemovalReturnScreen(driver);
    const vendingPlanogram = new VendingPlanogramScreen(driver);
    const delivery = new VendingDeliveryScreen(driver);
    const dashboard = new DashboardScreen(driver);
    const home = new HomeScreen(driver);
    const prepTasks = new PrepTasksScreen(driver);
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
      await vendingRemovalReturn.clickHeader('Fills');
       expect(await delivery.isHeaderDisplayed('Product fills')).toBe(true);
       await vendingRemovalReturn.click('section_header_planogram_cta');
      //section_header_planogram_cta
       expect(await delivery.isHeaderDisplayed('Planogram')).toBe(true);
      expect(await delivery.isHeaderDisplayed('Machine 3247549 POG')).toBe(true);
      expect(await vendingRemovalReturn.verifyElementDisplayed('Label name')).toBe(true);
    });
      
      await test.step('Verify layout toggles are visible', async () => {
        expect(await vendingPlanogram.isGridLayoutToggleVisible()).toBe(true);
      });

      await test.step('Select Par / Capacity from the Label name dropdown', async () => {
        await vendingPlanogram.openLabelNameDropdown();
        await vendingPlanogram.selectLabelNameOption('Par / Capacity');
        expect(await vendingPlanogram.isLabelNameValueDisplayed('Par / Capacity')).toBe(true);
      });

      // Verify Par/Capacity labels and values
      await test.step('TC127: I am able to view Par/Capacity', async () => {
        expect(await vendingPlanogram.isParCapacityHeaderVisible()).toBe(true);
      });

      //
    });
});

