import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndWaitForMfa } from '../../utils/login-flow';
import { VendingDeliveryScreen } from '../../screens/vending-delivery.screen';
import { PrepTasksScreen } from '../../screens/prep-tasks.screen';
import { DashboardScreen } from '../../screens/dashboard.screen';
import { RouteSetupScreen } from '@screens/route-setup.screen';
import { HomeScreen } from '@screens/home.screen';


test.describe('Vending delivery workflow', () => {
  /**
   *  Vending & Coffee machine workflow.
   *
   * Steps:
   * 1. Verify the Vending header is visible.
   * 2. Read the first Vending machine tile label and click it.
   * 3. Confirm the selected Vending machine header is displayed and address also appears.
   * 4. Verify the Coffee header is visible.
   * 5. Navigate to the Coffee section and select the first coffee machine.
   * 6. Verify the selected coffee item is shown in the header.
   */
  test('reads the first location name, clicks it and verifies it and address', 
     { tag: ['@TC001', '@TC002', '@TC003'] },
    async ({ driver }) => {
        const prepTasks = new PrepTasksScreen(driver);
        const dashboard = new DashboardScreen(driver);
        const delivery = new VendingDeliveryScreen(driver);
        const routeSetup = new RouteSetupScreen(driver);
        const home = new HomeScreen(driver);
        var firstMachineName: string;

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

    await test.step('verify if the Vending header is displayed', async () => {
        const isHeaderDisplayed = await delivery.isHeaderDisplayed('Vending');
        expect(isHeaderDisplayed).toBe(true);
    });


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

    await test.step('Verify the machine address is displayed', async () => {
      const address = await delivery.getHeaderAddress(firstMachineName);
      expect(address).toBeTruthy();
      expect(address).not.toEqual('');
      await delivery.tapViewSchedule();
    });
   

    await test.step('verify if the Coffee header is displayed', async () => {
        const isHeaderDisplayed = await delivery.isHeaderDisplayed('Coffee');
        expect(isHeaderDisplayed).toBe(true);
    });
    
    await test.step('Scroll and select the first coffee icon item', async () => {
      
      await delivery.scrollToCoffeeIconItem("Covista");
      const firstCoffeeName = await delivery.getCoffeeIconName("Covista");
      expect(firstCoffeeName).toBeTruthy();
      await delivery.clickCoffeeIcon(firstCoffeeName);

      expect(await delivery.isHeaderDisplayed(firstCoffeeName)).toBe(true);
      const coffeeHeader = await delivery.getHeaderText(firstCoffeeName);
      expect(coffeeHeader).toBe(firstCoffeeName);
    });


  });
});
