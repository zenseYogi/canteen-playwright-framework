import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndWaitForMfa } from '../../utils/login-flow';
import { VendingDeliveryScreen } from '../../screens/vending-delivery.screen';
import { PrepTasksScreen } from '../../screens/prep-tasks.screen';
import { DashboardScreen } from '../../screens/dashboard.screen';


test.describe('Vending delivery workflow', () => {
  test('reads the first location name, clicks it and verifies it and address', 
     { tag: ['@TC001', '@TC002', '@TC003'] },
    async ({ driver }) => {
        const prepTasks = new PrepTasksScreen(driver);
        const dashboard = new DashboardScreen(driver);
        const delivery = new VendingDeliveryScreen(driver);
        var firstMachineName: string;

    await test.step('Log in', async () => {
      await loginAndWaitForMfa(driver);
    });

    await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.completeFullDayPrep();
      });

      await test.step("Open the first stop's first Vending machine", async () => {
        await dashboard.clickLocationByPosition('first');
        await dashboard.openNthServiceStation('vending', 'first');
      });


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
    });

   
    await test.step('verify if the Coffee header is displayed', async () => {
            const isHeaderDisplayed = await delivery.isHeaderDisplayed('Coffee');
            expect(isHeaderDisplayed).toBe(true);
    });
    
    






  });
});
