import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndWaitForMfa, switchRoute } from '../../utils/login-flow';
import { PrepTasksScreen } from '../../screens/prep-tasks.screen';
import { DashboardScreen } from '../../screens/dashboard.screen';
import { CoffeeServiceScreen } from '../../screens/coffee-service.screen';
import { mobileConfig } from '../../config/mobile.config';

// Traceability: the Excel's "Before Photo" sub-area only exists under the
// Market Area (TC015/TC017/TC018/TC020/TC021/TC022/TC025/TC026...) - Coffee
// has no "Before Photo" rows of its own (only "After Photo" and "Completing
// an equipment audit", which share the identical Skip-photo pattern under
// different PBIs). This flow is a genuinely shared, LOB-agnostic component
// (see BaseScreen's openPhotoTrigger/openSkipPhotoReasonSheet) - Route 10's
// only Market-capable stop had no Market service today, so this was
// live-verified via its Coffee stop instead, and tagged to Market's rows as
// the correctly-attributed source (per BA's 2026-07-27 correction that this
// flow does NOT belong to Prep Tasks/Product Collection, where an earlier
// Excel row mistakenly placed TC130-138 - see prep-tasks.spec.ts's note).
//
// Discrepancy note (not asserted): the Excel describes a live camera-preview
// screen opening first (TC017/TC130), then a "Can't take a photo?"
// confirmation modal on tapping Skip photo (TC018/TC131), THEN the reason
// sheet on tapping Skip photo again (TC021/TC134). Live-verified on this
// build: tapping Before Photos goes straight to an "Add supporting photo"
// modal (Take photo / Skip photo), and a single tap of Skip photo there
// goes straight to the reason sheet - no separate live-preview screen or
// intermediate confirmation modal was observed.
test.describe('Coffee - Before Photos / Skip photo', () => {
  test(
    'Skip photo flow: reason sheet appears, validates non-blank input, and submits without saving a photo',
    { tag: ['@TC015', '@TC021', '@TC022', '@TC025', '@TC134', '@TC136', '@TC137', '@TC138'] },
    async ({ driver }, testInfo) => {
      // This walks a full Start Day + LOB navigation + multi-step skip-photo
      // flow in one session - noticeably more real-device round trips than
      // most other specs, and the default 150s budget (playwright.config.ts)
      // was cutting it close under real device latency.
      testInfo.setTimeout(240_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);

      await test.step('Log in, switch to Route 10/TODAY (only day with live Prep Tasks + schedule data)', async () => {
        await loginAndWaitForMfa(driver);
        await switchRoute(driver, { ...mobileConfig.defaultRoute, day: 'TODAY' });
      });

      // Start Day may already be server-tracked complete from an earlier
      // run today - ensureFullDayPrepComplete() tolerates that (see its own
      // doc comment).
      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });

      await test.step("Open the day's Coffee service stop", async () => {
        await dashboard.clickLocationByPosition('second');
        await dashboard.openFirstServiceStation('coffee');
      });

      // TC015 "open the Before Photos screen"
      await test.step('TC015: tap Before Photos and verify the Take photo/Skip photo modal', async () => {
        await coffee.openBeforePhotos();
        const modal = await coffee.isPhotoModalVisible();
        expect(modal.takePhoto).toBe(true);
        expect(modal.skipPhoto).toBe(true);
      });

      // TC021/TC134 "open skip reason sheet" - bottom sheet with a Reason
      // field and a disabled submit button.
      await test.step('TC021/TC134: tap Skip photo and verify the reason sheet, disabled by default', async () => {
        await coffee.openSkipPhotoReasonSheet();
        expect(await coffee.isSkipPhotoReasonSheetVisible()).toBe(true);
        expect(await coffee.isSkipPhotoSubmitEnabled()).toBe(false);
      });

      // TC022/TC137 "verify blank reason is not allowed" - type then clear,
      // confirm it goes back to disabled rather than assuming it always was.
      await test.step('TC022/TC137: a blank reason keeps Skip photo disabled', async () => {
        await coffee.enterSkipPhotoReason("Camera can't focus and take clear picture");
        await coffee.waitForSkipPhotoSubmitEnabled(true);
        await coffee.enterSkipPhotoReason('');
        await coffee.waitForSkipPhotoSubmitEnabled(false);
      });

      // TC025/TC138 "submit skip reason" - re-enter the reason, submit, and
      // land back on the service stop checklist (Before Photos tile no
      // longer the dashed "todo" state) without a photo being saved.
      await test.step('TC025/TC138: submit a non-blank reason and return to the service stop screen', async () => {
        await coffee.enterSkipPhotoReason("Camera can't focus and take clear picture");
        await coffee.waitForSkipPhotoSubmitEnabled(true);
        await coffee.confirmSkipPhoto();
        expect(await coffee.isSkipPhotoReasonSheetVisible()).toBe(false);
      });
    }
  );
});
