import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndWaitForMfa } from '../../utils/login-flow';
import { PrepTasksScreen } from '../../screens/prep-tasks.screen';

// Ported from Optimized_TCs_V_2.0.xlsx (Start of The Day / Prep Tasks-*).
// Every locator used here was live-verified against build 0.1.73 - see
// docs/rf-to-playwright-reuse.md's "Live verification session" section.
test.describe('Prep Tasks / Start of Day', () => {
  test('view all prep categories, then complete the full Start Day flow (Excel TC071 + Start Day)', async ({
    driver
  }) => {
    const prepTasks = new PrepTasksScreen(driver);

    await test.step('Log in', async () => {
      await loginAndWaitForMfa(driver);
    });

    await test.step('Open Prep Tasks and verify all four categories are visible', async () => {
      await prepTasks.openFromHamburgerMenu();
      const categories = await prepTasks.arePrepCategoriesVisible();
      expect(categories.productCollection).toBe(true);
      expect(categories.moneyOperations).toBe(true);
      expect(categories.additionalPrep).toBe(true);
      expect(categories.checks).toBe(true);
    });

    await test.step('Complete the full Start Day flow (Product Collection -> Money Operations -> Additional Prep -> Checks)', async () => {
      await prepTasks.completeFullDayPrep();
    });
  });

  test('skip a prep task via the back-press popup (Excel TC180/182)', async ({ driver }) => {
    const prepTasks = new PrepTasksScreen(driver);

    await test.step('Log in', async () => {
      await loginAndWaitForMfa(driver);
    });

    await test.step('Open Additional Prep and trigger the back-press Skip/Complete popup', async () => {
      await prepTasks.openFromHamburgerMenu();
      await prepTasks.openBackPressPopup(prepTasks.subScreenTriggers.additionalPrep);
      expect(await prepTasks.isBackPressPopupVisible()).toBe(true);
    });

    await test.step('Skip it', async () => {
      await prepTasks.confirmSkip();
    });
  });
});
