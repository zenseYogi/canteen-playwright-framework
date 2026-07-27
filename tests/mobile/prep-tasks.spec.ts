import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndWaitForMfa, switchRoute } from '../../utils/login-flow';
import { PrepTasksScreen } from '../../screens/prep-tasks.screen';
import { mobileConfig } from '../../config/mobile.config';

// Traceability to Optimized_TCs_V_2.0.xlsx: TC numbers cited per assertion
// below are from the "Start of The Day" area's four Prep Tasks sub-areas
// (Product collection / Money Operations / Additional Prep / Checks).
// Every locator used here was live-verified against build 0.1.73 - see
// docs/rf-to-playwright-reuse.md's "Live verification session" section.
test.describe('Prep Tasks / Start of Day', () => {
  test(
    'view all prep categories, then complete the full Start Day flow',
    { tag: ['@TC071', '@TC072', '@TC079', '@TC168', '@TC184', '@TC203'] },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);

      await test.step('Log in', async () => {
        await loginAndWaitForMfa(driver);
      });

      // TC071 "I am able to view all prep categories"
      await test.step('TC071: Open Prep Tasks and verify all four categories are visible', async () => {
        await prepTasks.openFromHamburgerMenu();
        const categories = await prepTasks.arePrepCategoriesVisible();
        expect(categories.productCollection).toBe(true);
        expect(categories.moneyOperations).toBe(true);
        expect(categories.additionalPrep).toBe(true);
        expect(categories.checks).toBe(true);
      });

      // TC072 "open Product collection" / TC168 "open the Money operations
      // screen" / TC184 "open Additional prep" / TC203 "open the Checks
      // screen" / TC079 "proceed through Prep Tasks" - completeFullDayPrep()
      // walks through all four in sequence.
      //
      // NOT asserted: TC077 ("Continue disabled with no entries") and TC173
      // ("Continue disabled initially") - both directly tested live and
      // found FALSE. uiautomator dump showed enabled="true" on the Continue
      // button on both Product Collection and Money Operations with zero
      // items selected. This is a confirmed discrepancy between the Excel
      // and the real app, not an assumption - see
      // docs/rf-to-playwright-reuse.md's Phase 7 notes. The equivalent
      // claims for Additional Prep (TC188) and Checks (TC207) follow the
      // same pattern but haven't been directly tested.
      await test.step('TC072/TC079/TC168/TC184/TC203: complete the full Start Day flow', async () => {
        await prepTasks.completeFullDayPrep();
      });
    }
  );

  test(
    'skip a prep task via the back-press popup',
    { tag: ['@TC198', '@TC199'] },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);

      await test.step('Log in', async () => {
        await loginAndWaitForMfa(driver);
      });

      // TC198 "view the Skip and Complete buttons on the pop-up" - this is
      // Additional Prep's own popup TC (not TC180, which is the near-
      // identical but distinct claim for Money Operations - the Excel
      // documents the same shared UI pattern once per sub-screen).
      await test.step('TC198: Open Additional Prep and trigger the back-press Skip/Complete popup', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.openBackPressPopup(prepTasks.subScreenTriggers.additionalPrep);
        expect(await prepTasks.isBackPressPopupVisible()).toBe(true);
      });

      // TC199 "click Skip on the confirmation"
      await test.step('TC199: Skip it', async () => {
        await prepTasks.confirmSkip();
      });
    }
  );

  // PBI 729543, Sub Area "Prep Tasks-Product collection" - Excel's TC075
  // row bundles TC080/TC083/TC089/TC110 together (same Action/Outcome
  // pattern repeated for re-opening the flow a second time - TC083/TC089
  // are literal duplicates of TC075/TC080, not separately addressable).
  // Uses Charlotte/103 explicitly (not the plain defaultRoute login) since
  // Miami/010 needs BA data prep - consistent with adhoc-scheduling.spec.ts.
  test(
    'view the Add product (+) icon, open Add product, and add a product with a quantity',
    { tag: ['@TC075', '@TC080', '@TC110'] },
    async ({ driver }) => {
      const prepTasks = new PrepTasksScreen(driver);

      await test.step('Log in, then switch to Charlotte/103 (Miami/010 needs BA data prep)', async () => {
        await loginAndWaitForMfa(driver);
        await switchRoute(driver, mobileConfig.vendingRoute);
      });

      // TC075 "view Add product (+) icon"
      await test.step('TC075: open Product Collection and verify the Add product (+) icon is visible', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.openProductCollection();
        expect(await prepTasks.isAddProductButtonVisible()).toBe(true);
      });

      // TC080 "open Add product screen"
      await test.step('TC080: tap the icon and verify the Add product screen opens', async () => {
        await prepTasks.openAddProductForm();
        expect(await prepTasks.isAddProductScreenVisible()).toBe(true);
      });

      // TC110 "add the product and update count" - Excel's own Test Data
      // ("Snickers - Qty 5"). Live-verified: the search field's results are
      // NOT limited to an exact "Snickers" product - multiple SKUs/package
      // sizes match (including a "Coffee Mate Snickers Creamer" variant),
      // so this asserts on the qty actually entered (5) appearing in the
      // returned list's per-category summary, not on which exact product
      // got selected by position.
      await test.step('TC110: search "Snickers", enter qty 5, submit, and verify the count updates', async () => {
        await prepTasks.fillAndSubmitAddProduct('Snickers', '5');
        const summaryLines = await prepTasks.getProductCollectionSummaryLines();
        expect(summaryLines.some((line) => line.endsWith('\n5'))).toBe(true);
      });
    }
  );

  // CORRECTED (2026-07-27, per BA): TC130-TC138's "Skip photo" flow is NOT
  // part of Prep Tasks/Product Collection's Continue button at all - that
  // was this Excel row's own Area/Sub Area mislabeling. The real feature is
  // a service stop's "Before Photos"/"After Photos" tile (reached AFTER
  // Start Day, at a Market/Coffee/Vending location's checklist screen -
  // Before Photos, Removals & Returns, Delivery, Audit, After Photos,
  // Market Transfers). Confirmed this is why Product Collection's Continue
  // never opened a camera no matter how non-empty the checklist was - it
  // was never going to; the whole premise of TC130-138 living here was
  // wrong. Now automated at coffee-service.spec.ts (tagged TC015/TC021/
  // TC022/TC025, the correctly-attributed Market "Before Photo" rows for
  // this same shared, LOB-agnostic component) - not duplicated here.
});
