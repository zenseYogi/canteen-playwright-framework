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

  // PBI 729543, Sub Area "Prep Tasks-Product collection". TC130-TC138 are a
  // sequential flow: Continue (non-empty checklist) -> camera opens -> tap
  // "Skip photo" -> confirmation modal ("Can't take a photo?") -> tap Skip
  // photo again -> TC134's own bottom sheet (Reason to skip photo field,
  // disabled submit button) -> TC135 keypad focus -> TC136 reason enables
  // Skip -> TC137 blank reason stays disabled -> TC138 submits and skips.
  //
  // BLOCKED (2026-07-27): live-verified on Route 10/TODAY (build 0.1.76)
  // with a genuinely non-empty, fully-checked Product Collection checklist
  // (OCS Creamer/Sugar-20, Paper/Cups/Stir-20, Candy-10, LG Snacks-20) -
  // tapping Continue completes the Product Collection tile instantly and
  // returns straight to the Prep Tasks list. The camera never opens, so
  // none of TC130-138 are reachable. `adb shell dumpsys media.camera`
  // confirms the app's camera hasn't been connected to since 2026-07-24 -
  // the same date docs/rf-to-playwright-reuse.md's Phase 7 notes cite as
  // the last time completeProductCollection()'s photo-capture branch was
  // confirmed end-to-end. This looks like an app-side regression or
  // intentional behavior change since that date, not a test bug - not an
  // assumption, a directly reproduced blocker. Held per explicit direction
  // pending BA/dev confirmation - do not re-attempt without new information
  // on whether the photo step still exists.
  test.fixme(
    'TC134: proceed to the Skip photo reason bottom sheet',
    { tag: ['@TC130', '@TC131', '@TC132', '@TC133', '@TC134', '@TC135', '@TC136', '@TC137', '@TC138'] },
    async () => {}
  );
});
