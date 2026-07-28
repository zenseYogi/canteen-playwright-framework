import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndWaitForMfa, switchRoute } from '../../utils/login-flow';
import { PrepTasksScreen } from '../../screens/prep-tasks.screen';
import { DashboardScreen } from '../../screens/dashboard.screen';
import { CoffeeServiceScreen } from '../../screens/coffee-service.screen';
import { mobileConfig } from '../../config/mobile.config';

// Traceability: this is the same shared/LOB-agnostic Skip-photo component
// documented in market-service.spec.ts (see BaseScreen's openPhotoTrigger/
// openSkipPhotoReasonSheet) - originally verified here via Coffee's own
// "Before Photos" tile on 2026-07-27 because that day's Market-capable stop
// had no Market service station yet. Now that Market's own stop is
// reachable, the Excel's actual "Before Photo" TCs (TC015/TC021/TC022/
// TC025) are tested there instead - see market-service.spec.ts's own
// "Before Photos / Skip photo" describe block. Kept here untagged to those
// Market TC numbers (still exercises the same component on Coffee's LOB as
// incidental regression coverage), but tagged to TC134/TC136/TC137/TC138 -
// the numbers under the ORIGINAL Excel row that BA confirmed was mislabeled
// as Prep Tasks/Product Collection (see prep-tasks.spec.ts's note) - since
// this is still the direct live verification of that correction.
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
    { tag: ['@TC134', '@TC136', '@TC137', '@TC138'] },
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

// TC001-TC017/TC030/TC033-TC035 (Coffee "Header" + "Completing an equipment
// audit") - live-verified 2026-07-28 (build 0.1.76, Route 10/YESTERDAY,
// "Alan B. Levan |NSU Broward Center of Innovation" stop).
//
// The equipment-CARD TCs (TC008-TC017) were initially blocked - this stop
// starts with zero equipment on file, and manually-added equipment did NOT
// survive across separate app sessions/restarts (confirmed live: the same
// card the user added disappeared after this suite's own force-stop/
// restart cycle, then reappeared once re-added and left untouched). That
// makes cross-session fixture data unreliable for this sub-area - the fix
// is to build the equipment record fresh WITHIN this same continuous test
// (fill Add Equipment's fields, submit, then immediately exercise
// verify/mark-missing on the resulting card), which is exactly what this
// test now does end to end - see CoffeeServiceScreen's own note above its
// equipment-card locators for the live-verified field combination used.
//
// NOT independently asserted (documented instead):
// - TC013/TC018/TC019 (Add equipment verification screen reached via a
//   search-no-match precursor, with prefilling) - this test reaches
//   "Equipment detail" by reopening an already-known card, not via a
//   search-no-match path - that precursor search flow itself is TC020-029.
// - TC020-TC029 (search field icons/label/placeholder/typing/highlight/
//   no-results within the equipment list) - live-verified the header shows
//   no separate Search icon even with equipment cards present (only
//   section_header_add_cta) - the real search entry point for this list
//   wasn't identified this session.
test.describe('Coffee - Equipment Audit (Header + Completing an equipment audit)', () => {
  test(
    'TC001-TC017/TC030/TC033-TC035: header, equipment audit empty-state, Add Equipment, verify, and mark-missing',
    {
      tag: [
        '@TC001',
        '@TC002',
        '@TC003',
        '@TC004',
        '@TC005',
        '@TC006',
        '@TC007',
        '@TC008',
        '@TC009',
        '@TC010',
        '@TC011',
        '@TC012',
        '@TC014',
        '@TC015',
        '@TC016',
        '@TC017',
        '@TC030',
        '@TC033',
        '@TC034',
        '@TC035'
      ]
    },
    async ({ driver }, testInfo) => {
      testInfo.setTimeout(240_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);

      await test.step('Log in, switch to Route 10/YESTERDAY', async () => {
        await loginAndWaitForMfa(driver);
        await switchRoute(driver, { ...mobileConfig.defaultRoute, day: 'YESTERDAY' });
      });

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });

      await test.step("Open the day's Coffee service stop", async () => {
        await dashboard.clickLocationByPosition('second');
        await dashboard.openFirstServiceStation('coffee');
      });

      // TC001/TC002/TC003 "view the delivery header" - the account/location
      // name shown as the bold header on the checklist screen.
      await test.step('TC001/TC002/TC003: the account location name is the bold checklist header', async () => {
        expect(await coffee.isServiceStopLocationHeaderVisible()).toBe(true);
        const headerText = await coffee.getServiceStopLocationHeaderText();
        expect(headerText.length).toBeGreaterThan(0);
      });

      // TC004/TC006 "open the audit list" / "verify title" - Equipment
      // audit's own page title.
      await test.step('TC004/TC006: Equipment audit opens with its own page title', async () => {
        await coffee.openEquipmentAudit();
        expect(await coffee.isEquipmentAuditTitleVisible()).toBe(true);
      });

      // TC005 "verify date & route" - the same shared date/route pill as
      // every other screen.
      await test.step('TC005: date and route chips are visible in the header', async () => {
        const header = await coffee.isDateRouteHeaderVisible();
        expect(header.date).toBe(true);
        expect(header.route).toBe(true);
      });

      // TC007 "view header actions" - live-verified only Add equipment
      // (section_header_add_cta) is present in this empty-state; no Search
      // icon shows until equipment exists to search over.
      await test.step('TC007: the Add equipment header action is visible', async () => {
        const actions = await coffee.isEquipmentAuditHeaderActionsVisible();
        expect(actions.addEquipment).toBe(true);
      });

      // TC004's own empty-state (documented as the live behavior on a
      // zero-equipment stop) - heading, explanatory message, and both
      // Add equipment/Done buttons.
      await test.step("Equipment audit's empty-state shows its heading, message, and both buttons", async () => {
        const emptyState = await coffee.isEquipmentAuditEmptyStateVisible();
        expect(emptyState.heading).toBe(true);
        expect(emptyState.message).toBe(true);
        expect(emptyState.addEquipment).toBe(true);
        expect(emptyState.done).toBe(true);
      });

      // TC030 "start adding equipment" - Add equipment screen opens.
      await test.step('TC030: Add equipment opens from the empty-state trigger', async () => {
        await coffee.openAddEquipmentFromEmptyState();
        expect(await coffee.isVisible('//android.view.View[@content-desc="Add equipment"]')).toBe(true);
      });

      // TC033/TC034 "view all required fields at once" / "review required
      // inputs" - every mandatory field visible immediately, no scrolling
      // gate. NOT asserted: a separate "Audit date" field - live-verified
      // this build has none (not user-editable/not present), contrary to
      // the Excel's own field list.
      await test.step('TC033/TC034: every mandatory Add Equipment field is visible at once', async () => {
        const fields = await coffee.isAddEquipmentFormVisible();
        expect(fields.account).toBe(true);
        expect(fields.manufacturer).toBe(true);
        expect(fields.model).toBe(true);
        expect(fields.barcode).toBe(true);
        expect(fields.serialNumber).toBe(true);
        expect(fields.assetNumber).toBe(true);
        expect(fields.netTlmConnected).toBe(true);
        expect(fields.plumbed).toBe(true);
        expect(fields.photos).toBe(true);
      });

      // TC035 "confirm Add equipment button initial state" - disabled grey
      // before any input.
      await test.step('TC035: Add equipment starts disabled', async () => {
        expect(await coffee.isAddEquipmentSubmitEnabled()).toBe(false);
      });

      // TC035's other half + TC009 "physically confirm equipment presence" -
      // filling every mandatory field (Barcode included - live-verified
      // this was the missing piece an earlier attempt without it never
      // enabled the button) enables the submit button. The button's own
      // label stays "Add equipment" for a genuinely new record, or flips to
      // "Verify equipment" if the entered Barcode/Serial/Asset combination
      // happens to match an existing catalog record (both observed live) -
      // submitAddOrVerifyEquipment() handles either.
      await test.step("TC035/TC009: filling every field enables submit", async () => {
        await coffee.fillAndSubmitNewEquipment({
          account: 'Covista',
          manufacturer: 'Cafection',
          model: 'Galleria',
          barcode: 'aaaa',
          serialNumber: '1111',
          assetNumber: '124'
        });
        expect(await coffee.isAddEquipmentSubmitEnabled()).toBe(true);
        await coffee.submitAddOrVerifyEquipment();
      });

      // TC008 "view equipment cards" - the saved card's own Model/Serial/
      // Asset, read directly from content-desc. Live-verified a freshly
      // Added (not Verified) card's own status label is "Recently added",
      // not "Verified" yet - that only appears after reopening the card and
      // explicitly confirming it (see TC009/TC010 below).
      await test.step('TC008: the new card shows Model/Serial/Asset', async () => {
        expect(await coffee.getEquipmentCardCount()).toBe(1);
        const card = await coffee.getEquipmentCardSummary('Cafection');
        expect(card.model).toBe('Galleria');
        expect(card.serialNumber).toBe('1111');
        expect(card.assetNumber).toBe('124');
        expect(card.status).toBe('Recently added');
      });

      // TC009/TC010 "physically confirm equipment presence" / "card turns
      // green with Verified checkmark" - reopening the card (not the header
      // + icon) reaches "Equipment detail" with its own "Verify equipment"
      // button; submitting it (with "Equipment does not exist" left
      // unchecked) flips the card's status from "Recently added" to
      // "Verified".
      await test.step('TC009/TC010: reopening and confirming the card marks it Verified', async () => {
        await coffee.openEquipmentCard('Cafection');
        expect(await coffee.isEquipmentDoesNotExistCheckboxChecked()).toBe(false);
        await coffee.submitAddOrVerifyEquipment();
        const card = await coffee.getEquipmentCardSummary('Cafection');
        expect(card.status).toBe('Verified');
      });

      // TC011 "confirm verified status persists" - leave Equipment audit
      // entirely (back to the checklist) and reopen it; the card and its
      // Verified status are still there. Live-verified: pressing back from
      // the equipment LIST screen triggers the same "Equipment Audit - Do
      // you want to complete equipment audit!" confirmation this file's
      // earlier TC134/TC136-TC138 test already covers - confirm with Yes.
      await test.step('TC011: the Verified card persists after navigating away and back', async () => {
        await coffee.pressKeyCode(4);
        await driver.pause(500);
        await coffee.tap('~Yes');
        await driver.pause(500);
        await coffee.openEquipmentAudit();
        const card = await coffee.getEquipmentCardSummary('Cafection');
        expect(card.status).toBe('Verified');
      });

      // TC012/TC014/TC015 "identify missing equipment" / "view 'Equipment
      // does not exist'" / "mark not present" - reopening the card shows
      // the same Equipment detail screen with an unchecked checkbox;
      // checking it hides the detail fields and re-submitting updates the
      // card's own status label.
      await test.step('TC012/TC014/TC015: mark the equipment as not present', async () => {
        await coffee.openEquipmentCard('Cafection');
        expect(await coffee.isEquipmentDoesNotExistCheckboxChecked()).toBe(false);
        await coffee.tapEquipmentDoesNotExistCheckbox();
        expect(await coffee.isEquipmentDoesNotExistCheckboxChecked()).toBe(true);
        await coffee.submitAddOrVerifyEquipment();
      });

      // TC016/TC017 "return to Equipment audit screen" / "card shows
      // 'Equipment does not exist' in grey label format" - live-verified
      // this is the card's own trailing status label, the same field that
      // showed "Verified" before - directly readable, no visual-only
      // green/grey signal needed.
      await test.step('TC016/TC017: the card now shows "Equipment does not exist"', async () => {
        const card = await coffee.getEquipmentCardSummary('Cafection');
        expect(card.status).toBe('Equipment does not exist');
      });
    }
  );
});
