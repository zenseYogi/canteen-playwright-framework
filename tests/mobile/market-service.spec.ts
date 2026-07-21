import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndWaitForMfa } from '../../utils/login-flow';
import { PrepTasksScreen } from '../../screens/prep-tasks.screen';
import { DashboardScreen } from '../../screens/dashboard.screen';
import { MarketServiceScreen } from '../../screens/market-service.screen';

// Ported from Optimized_TCs_V_2.0.xlsx (Market / Delivery, Market / Delivery -
// Add Product, Market / Money Operation). Every locator used here was
// live-verified against build 0.1.73 - see docs/rf-to-playwright-reuse.md's
// "Live verification session" section.
//
// Scope note: these assert field/screen PRESENCE and reachability, not
// validation BEHAVIOR (reject negative/alphabetic input, decimal handling,
// max length etc.) - that hasn't been tested live yet.
//
// Data note: navigating to a Market location assumes this environment's
// seeded route data is stable across sessions (confirmed across this
// session's app relaunches) - the second dashboard location is a Market stop.
test.describe('Market - Delivery, Add Product, Money Operations', () => {
  test('reach a Market location and verify Money Operations screen fields (Excel Money Operation group)', async ({
    driver
  }) => {
    const prepTasks = new PrepTasksScreen(driver);
    const dashboard = new DashboardScreen(driver);
    const market = new MarketServiceScreen(driver);

    await test.step('Log in', async () => {
      await loginAndWaitForMfa(driver);
    });

    await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
      await prepTasks.openFromHamburgerMenu();
      await prepTasks.completeFullDayPrep();
    });

    await test.step("Open a Market location's service station", async () => {
      await dashboard.clickLocationByPosition('second');
      await dashboard.openFirstServiceStation('market');
    });

    await test.step('Verify Money Operations (Money Collection) screen fields are present', async () => {
      await market.openMoneyOperations();
      const fields = await market.isMoneyCollectionScreenVisible();
      expect(fields.title).toBe(true);
      expect(fields.skipMoneyBag).toBe(true);
      expect(fields.bagCode).toBe(true);
      expect(fields.coins).toBe(true);
      expect(fields.bills).toBe(true);
      expect(fields.refund).toBe(true);
    });
  });

  test('reach Product fills and verify the Add Product entry screen (Excel Delivery-Add Product group)', async ({
    driver
  }) => {
    const prepTasks = new PrepTasksScreen(driver);
    const dashboard = new DashboardScreen(driver);
    const market = new MarketServiceScreen(driver);

    await test.step('Log in', async () => {
      await loginAndWaitForMfa(driver);
    });

    await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
      await prepTasks.openFromHamburgerMenu();
      await prepTasks.completeFullDayPrep();
    });

    await test.step("Open a Market location's service station", async () => {
      await dashboard.clickLocationByPosition('second');
      await dashboard.openFirstServiceStation('market');
    });

    await test.step('Open Product fills, then Add Product, and verify its title + button states (Excel TC147/149/153)', async () => {
      await market.openAddProductFromFills();
      expect(await market.isAddProductScreenVisible()).toBe(true);
      const buttons = await market.addProductButtonStates();
      expect(buttons.cancelEnabled).toBe(true);
      expect(buttons.addEnabled).toBe(false);
    });
  });
});
