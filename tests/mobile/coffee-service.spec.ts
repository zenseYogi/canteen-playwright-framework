import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndEnsureRoute, ensureCoffeeDeliveryExists } from '../../utils/login-flow';
import { AdhocDeliveryScreen } from '../../screens/adhoc-delivery.screen';
import { PrepTasksScreen } from '../../screens/prep-tasks.screen';
import { DashboardScreen } from '../../screens/dashboard.screen';
import { CoffeeServiceScreen } from '../../screens/coffee-service.screen';
import { HomeScreen } from '../../screens/home.screen';
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

/**
 * Leaves the caller on a Coffee service station's checklist, returning the
 * stop's name. Finds any scheduled stop that actually exposes a Coffee LOB
 * and, only if none does, bootstraps one as an ad-hoc delivery.
 *
 * The bootstrap is not optional insurance - live-confirmed 2026-08-25 that
 * Route 010/YESTERDAY had ZERO Coffee stops left. FedEx, which every existing
 * Coffee test in this file attaches its ad-hoc delivery to, has been reduced
 * to a single Market station ("Fed Ex Homestead"), taking the route's last
 * Coffee host with it. ensureCoffeeDeliveryExists() cannot recover from that
 * because it has to OPEN the named stop before it can add Coffee to it.
 *
 * Bootstrap pairing: customer "Covista" + service "Adtalem - Miramar -
 * OCS/Pantry" - the only OCS/Pantry (Coffee) service the picker offers on
 * this route. The two belong to different accounts on purpose: the Service
 * picker is NOT scoped to the selected customer (see
 * AdhocDeliveryScreen.selectMarketServiceFor's own note on the Market
 * equivalent), so the resulting stop shows as "Covista" on Home while its
 * checklist header reads "Adtalem - Miramar". That mismatch is expected.
 */
/**
 * ---------------------------------------------------------------------------
 * Runtime stop discovery
 * ---------------------------------------------------------------------------
 *
 * These tests must NOT name a stop. The schedule is explicitly dynamic:
 * Anthony (QA) confirmed 2026-08-25 that "deltas keep updating the screen -
 * if a new order is created it will be automatically pulled in", and we have
 * watched a stop vanish and return within one day, an order number change
 * under us, a completed stop revert to Pending, and an ad-hoc stop disappear
 * entirely. A hardcoded stop name therefore fails for DATA reasons and reads
 * as a regression, which is exactly the confusion the suite exists to remove.
 *
 * So a test states its PRECONDITION and this layer finds a stop that satisfies
 * it, bootstrapping one only as a last resort.
 *
 * Note also that Charlotte 103 carries 49 stops, not the handful Home shows
 * without scrolling - an earlier version of this file drew conclusions from
 * the first five rows and was wrong to.
 */

/** Cache of label -> stop name that satisfied it, so one scan is shared across tests in a run. */
const qualifyingStopCache = new Map<string, string>();
let cachedStopNames: string[] | null = null;

/** Every stop on the current route, scrolling both tabs (Home renders only a few rows at a time). */
async function enumerateAllStops(driver: any): Promise<string[]> {
  if (cachedStopNames) return cachedStopNames;
  const home = new HomeScreen(driver);
  await home.returnToHome();
  const seen: string[] = [];
  for (const tab of ['Pending action', 'Completed']) {
    await (await driver.$(`//android.view.View[contains(@content-desc,"${tab}")]`)).click();
    await driver.pause(1_500);
    let stagnant = 0;
    for (let i = 0; i < 30 && stagnant < 3; i++) {
      const before = seen.length;
      for (const row of [...(await driver.$$('//*[@clickable="true" and @content-desc!=""]'))]) {
        const n = ((await row.getAttribute('content-desc')) ?? '').split('\n')[0].trim();
        const chrome = /^(Open navigation menu|Edit schedule|Pending action|Completed)/.test(n);
        if (n && !chrome && !seen.includes(n)) seen.push(n);
      }
      stagnant = seen.length === before ? stagnant + 1 : 0;
      await driver.executeScript('mobile: scrollGesture', [
        { left: 100, top: 600, width: 800, height: 1200, direction: 'down', percent: 0.8 }
      ]);
      await driver.pause(700);
    }
    // MUST restore the scroll position. Home's "Deliveries" title is what
    // returnToHome() waits on, and it scrolls off the top - leaving the list
    // scrolled makes every subsequent returnToHome() fail at login, which is
    // exactly how this first went wrong.
    for (let i = 0; i < 12; i++) {
      await driver.executeScript('mobile: scrollGesture', [
        { left: 100, top: 600, width: 800, height: 1200, direction: 'up', percent: 1.0 }
      ]);
    }
    await driver.pause(700);
  }
  cachedStopNames = seen;
  return seen;
}

/**
 * Leaves the caller wherever `qualify` left them on a Coffee stop that
 * satisfies it, and returns that stop's name.
 *
 * `qualify` runs with the stop's Coffee checklist open and may navigate freely
 * - whatever screen it ends on is what the caller inherits, so it can double
 * as the test's own navigation.
 *
 * Order tried: the stop cached for this label (fast path, usually one open),
 * then `preferred`, then every other stop on the route. Bounded by `maxScan`
 * so a route where nothing qualifies fails in reasonable time with a clear
 * message rather than walking all 49 stops indefinitely.
 */
async function reachCoffeeStop(
  driver: any,
  label: string,
  qualify: (coffee: CoffeeServiceScreen) => Promise<boolean>,
  preferred: string[] = [],
  maxScan = 10
): Promise<string> {
  const home = new HomeScreen(driver);
  const dashboard = new DashboardScreen(driver);
  const coffee = new CoffeeServiceScreen(driver);

  const attempt = async (name: string): Promise<boolean> => {
    await home.returnToHome();
    try {
      await dashboard.clickLocationByName(name);
    } catch {
      return false; // No longer on the schedule.
    }
    if (!(await dashboard.isLobCardVisible('coffee').catch(() => false))) return false;
    await dashboard.openFirstServiceStation('coffee');
    return qualify(coffee).catch(() => false);
  };

  const cached = qualifyingStopCache.get(label);
  const ordered = [...(cached ? [cached] : []), ...preferred];
  for (const name of ordered) {
    if (await attempt(name)) {
      qualifyingStopCache.set(label, name);
      return name;
    }
  }

  let scanned = 0;
  for (const name of await enumerateAllStops(driver)) {
    if (ordered.includes(name)) continue;
    if (scanned++ >= maxScan) break;
    if (await attempt(name)) {
      qualifyingStopCache.set(label, name);
      return name;
    }
  }
  throw new Error(
    `No Coffee stop satisfying "${label}" found (tried ${ordered.length} preferred + ${scanned} scanned).`
  );
}

/**
 * Leaves the caller on a Coffee stop whose Deliveries screen is EMPTY - the
 * precondition C-TC-005 needs.
 *
 * Discovery first: a real stop with no requested fills is far better evidence
 * than one we manufactured. Only if the route genuinely has none does this
 * bootstrap an ad-hoc Coffee delivery, which by design arrives with no
 * products (Anthony, 2026-08-25) and so lands exactly on "No Deliveries
 * Requested."
 *
 * The bootstrap deliberately targets an account OTHER than whichever stop the
 * with-deliveries tests settled on, so it cannot disturb them, and is
 * idempotent - it only creates a stop when that account has no Coffee card.
 */
async function reachCoffeeStopWithEmptyDeliveries(driver: any): Promise<void> {
  try {
    await reachCoffeeStop(driver, 'coffee-empty-deliveries', async (c) => {
      await c.openDelivery();
      return c.isDeliveriesEmptyStateVisible();
    }, ['Amerock']);
    return;
  } catch {
    // Fall through to bootstrapping one.
  }

  const home = new HomeScreen(driver);
  const dashboard = new DashboardScreen(driver);
  const coffee = new CoffeeServiceScreen(driver);
  const adhoc = new AdhocDeliveryScreen(driver);
  const BOOTSTRAP = 'Amerock';

  await home.returnToHome();
  await dashboard.clickLocationByName(BOOTSTRAP);
  const hasCoffee = await dashboard.isLobCardVisible('coffee').catch(() => false);
  await home.returnToHome();
  if (!hasCoffee) {
    await home.openAdhocDeliveryCreation();
    await adhoc.searchCustomer(BOOTSTRAP);
    await adhoc.selectCustomer(BOOTSTRAP);
    await adhoc.selectCoffeeServiceFor('Maint: Amerock');
    await adhoc.selectServiceType('FULL');
    await adhoc.submitAddDelivery();
    await home.returnToHome();
  }
  await dashboard.clickLocationByName(BOOTSTRAP);
  await dashboard.openFirstServiceStation('coffee');
  await coffee.openDelivery();
}

test.describe('Coffee - Before Photos / Skip photo', () => {
  test(
    'Skip photo flow: reason sheet appears, validates non-blank input, and submits without saving a photo',
    { tag: ['@Coffee-TC134', '@Coffee-TC136', '@Coffee-TC137', '@Coffee-TC138'] },
    async ({ driver }, testInfo) => {
      // This walks a full Start Day + LOB navigation + multi-step skip-photo
      // flow in one session - noticeably more real-device round trips than
      // most other specs, and the default 150s budget (playwright.config.ts)
      // was cutting it close under real device latency.
      testInfo.setTimeout(240_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Route 10/TODAY (only day with live Prep Tasks + schedule data)', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.defaultRoute, day: 'TODAY' });
      });

      // Precondition (live-verified 2026-08-06): this route's TODAY data can
      // be seeded Market-only with no Coffee stop at all - see
      // ensureCoffeeDeliveryExists's doc comment for how that's detected/
      // fixed via an ad-hoc "OCS/Pantry" delivery against FedEx, the same
      // account this spec already navigates to below.
      await test.step("Ensure today's route has a Coffee delivery", async () => {
        await ensureCoffeeDeliveryExists(driver, 'FedEx');
      });

      // Start Day may already be server-tracked complete from an earlier
      // run today - ensureFullDayPrepComplete() tolerates that (see its own
      // doc comment).
      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });

      await test.step("Open the day's Coffee service stop", async () => {
        // By name, not position - live-verified 2026-08-06 that Route 10's
        // stop order/count drifts (an unrelated stop can appear alongside
        // FedEx), same rationale as ensureCoffeeDeliveryExists's own note.
        await dashboard.clickLocationByName('FedEx');
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

      await test.step('Return to Home', async () => {
        await home.returnToHome();
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
// - TC013/TC019 (Add equipment reached via a search-no-match precursor,
//   with prefilling / a "Search equipment" screen with search field +
//   scanner) - re-verified live 2026-08-03 via BOTH real entry points
//   (the empty-state's own "Add equipment" button AND the header's
//   section_header_add_cta icon): both open the exact same blank Add
//   equipment form directly, with no intermediate "Search equipment"
//   screen and no prefilled values. This precursor flow does not exist in
//   this build via either reachable trigger. TC018 is NOW TAGGED
//   separately (see TC035 below - "Add equipment button... grey" is the
//   same disabled-state check already asserted there).
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
        '@Coffee-TC001',
        '@Coffee-TC002',
        '@Coffee-TC003',
        '@Coffee-TC004',
        '@Coffee-TC005',
        '@Coffee-TC006',
        '@Coffee-TC007',
        '@Coffee-TC008',
        '@Coffee-TC009',
        '@Coffee-TC010',
        '@Coffee-TC011',
        '@Coffee-TC012',
        '@Coffee-TC014',
        '@Coffee-TC015',
        '@Coffee-TC016',
        '@Coffee-TC017',
        '@Coffee-TC018',
        '@Coffee-TC030',
        '@Coffee-TC033',
        '@Coffee-TC034',
        '@Coffee-TC035'
      ]
    },
    async ({ driver }, testInfo) => {
      testInfo.setTimeout(240_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);

      await test.step('Log in, ensure Route 10/YESTERDAY (skips the route switch if already there)', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.defaultRoute, day: 'YESTERDAY' });
      });

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });

      await test.step("Open the day's Coffee service stop", async () => {
        // Route 10/Yesterday's Coffee stop keeps drifting position (same
        // recurring issue as market-service.spec.ts's TC112 note) - live-
        // verified again 2026-08-06: now 3 stops (CureLeaf/Market,
        // FedEx/Market, White & Case LLP/Coffee), Coffee at 'third', not
        // 'first' as of the last correction.
        await dashboard.clickLocationByPosition('third');
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

      // TC007 "view header actions" - live-verified only Back and Add
      // equipment (section_header_add_cta) are present in this empty-state;
      // no Search icon shows until equipment exists to search over.
      await test.step('TC007: the Back and Add equipment header actions are visible', async () => {
        const actions = await coffee.isEquipmentAuditHeaderActionsVisible();
        expect(actions.back).toBe(true);
        expect(actions.addEquipment).toBe(true);
      });

      // Idempotency guard (live-verified 2026-08-06/2026-08-07, same class
      // of issue as the TC147/TC206 tests' own notes): this test builds its
      // own fixture data (adds a "Cafection" equipment card, then drives it
      // through Verified -> Equipment does not exist) and never tore it
      // down, so re-running it against the same account/day found Cafection
      // already on the card list, breaking the empty-state assertion below.
      //
      // CORRECTED (live-verified 2026-08-07): an earlier version of this
      // guard branched around a pre-existing card (normalizing its state
      // instead of re-running the creation TCs) because no reset mechanism
      // was known. One exists: swiping a card left reveals a trash icon (a
      // child android.widget.Button), and tapping it deletes IMMEDIATELY -
      // no confirm dialog, unlike Deliveries' own delete flow. See
      // CoffeeServiceScreen.deleteAllEquipment(). Clearing first restores
      // the test to its original, simplest form.
      if ((await coffee.getEquipmentCardCount()) > 0) {
        await coffee.deleteAllEquipment();
      }

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
      // before any input. TC018 "Add equipment button visible... Enabled
      // with grey" is the same button/state - "grey" is the disabled
      // color throughout this app (same convention documented elsewhere in
      // this suite), so "Enabled" in the Excel's own wording is a likely
      // data-entry error, not a distinct state to prove.
      await test.step('TC018/TC035: Add equipment starts disabled (grey)', async () => {
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
      //
      // CORRECTED (live-verified 2026-08-06): that confirmation is only
      // shown when there's an actual unsaved change to prompt about - on
      // the pre-existing-card path above, resetting the checkbox back to
      // its already-current state left nothing "dirty", so back landed
      // directly on the checklist (already showing "Equipment audit" with
      // its complete checkmark) with no dialog at all. Tolerates either.
      await test.step('TC011: the Verified card persists after navigating away and back', async () => {
        await coffee.pressKeyCode(4);
        await driver.pause(500);
        if (await coffee.isVisible('~Yes')) {
          await coffee.tap('~Yes');
          await driver.pause(500);
        }
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
        await coffee.setEquipmentDoesNotExistCheckbox(true);
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

      await test.step('Return to Home', async () => {
        await new HomeScreen(driver).returnToHome();
      });
    }
  );

  // TC043/TC046/TC054/TC065/TC085/TC089 (Completing an equipment audit) -
  // live-verified 2026-07-28 (build 0.1.76, Route 10/YESTERDAY, "Alan B.
  // Levan |NSU Broward Center of Innovation" stop), on a fresh Add
  // Equipment form:
  //
  // NOT independently asserted (documented instead):
  // - TC086 ("Select barcode sheet opened") - live-verified FALSE: Barcode
  //   is a plain EditText with a scanner icon, not a bottom-sheet picker
  //   like Account/Manufacturer/Model - there is no "Select barcode" sheet
  //   in this build at all.
  // - TC088 ("scan a valid barcode") - not reproducible: no real camera/
  //   barcode to scan against in this environment.
  // - TC103/TC110/TC113/TC124 (Photos row's own Skip-photo confirmation
  //   modal / Skip stop bottom sheet / capture / attach) - re-verified live
  //   2026-08-03: the Photos row on THIS form goes straight into a native
  //   camera capture screen with no intermediate "Add supporting photo"
  //   modal at all (unlike Before/After Photos elsewhere in this suite,
  //   which do have that modal) - pressing back cancels straight out with
  //   no Skip confirmation of any kind, contradicting TC103/TC110's own
  //   claim. Additionally tried tapping the real shutter button (found via
  //   its own bounds in a raw page-source dump - the camera view's
  //   elements all carry empty content-desc, but the elements themselves
  //   DO exist, unlike a prior session's "entirely empty hierarchy" note)
  //   to test TC113/TC124's capture/attach claim directly: the tap
  //   produced zero hierarchy change (identical dump before/after,
  //   confirmed via checksum) - capture does not appear to function in
  //   this emulator environment at all, so TC113/TC124 remain unconfirmed.
  // - TC139 ("Equipment Audit tile shows a green tick") - this exact Yes-
  //   confirmation flow is already exercised (see the TC011 step above,
  //   which taps Yes to get back to the checklist) - live-verified via
  //   screenshot that the tile does turn green with a checkmark, but its
  //   own content-desc carries no accessible completed/tick signal to
  //   assert against (same category as the Market/Coffee Delivery tile's
  //   already-documented visual-only state elsewhere in this suite).
  test(
    'TC043/TC046/TC054/TC065/TC085/TC089: Account/Manufacturer/Model search-clear and Barcode entry',
    { tag: ['@Coffee-TC043', '@Coffee-TC046', '@Coffee-TC054', '@Coffee-TC065', '@Coffee-TC085', '@Coffee-TC089'] },
    async ({ driver }, testInfo) => {
      testInfo.setTimeout(240_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Route 10/YESTERDAY (skips the route switch if already there)', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.defaultRoute, day: 'YESTERDAY' });
      });

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });

      await test.step("Open the day's Coffee service stop, Equipment audit, and a fresh Add Equipment form", async () => {
        // Same recurring Route 10/Yesterday stop-position drift as the
        // TC001 test above - live-verified 2026-08-06, Coffee is at
        // 'third' (White & Case LLP), not 'second'.
        await dashboard.clickLocationByPosition('third');
        await dashboard.openFirstServiceStation('coffee');
        await coffee.openEquipmentAudit();
        await coffee.openAddEquipmentFromEmptyState();
      });

      // TC043/TC046 - the Account sheet's search narrows the list; the real
      // clear (X) icon restores the full unfiltered list with nothing
      // selected. (TC046 "selecting a stop populates the Account field" is
      // already proven by every other test in this file that fills the Add
      // Equipment form.)
      //
      // NOT a plain substring filter - live-verified typing "Cov" here
      // returns a non-deterministic result set each time (sometimes
      // includes unrelated accounts like "Warner Brothers Discovery",
      // sometimes includes/excludes accounts that don't even contain
      // "Cov") - some other matching/ranking logic, not a bug in this
      // test, but too unstable to assert specific content against. The
      // reliable signal is the clear icon itself: it empties the search
      // field's own text (confirmed via its `text` attribute, not just
      // visual appearance) and leaves nothing selected.
      await test.step('TC043: the clear icon empties the Account search field', async () => {
        await coffee.openAddEquipmentDropdownAndSearch('Account', 'Cov');
        await coffee.clearAddEquipmentDropdownSearch();
        const searchField = await driver.$('//android.widget.EditText');
        expect(await searchField.getAttribute('text')).toBe('');
        expect(await coffee.isAnyAddEquipmentDropdownOptionSelected()).toBe(false);
      });

      // The sheet is still open (clearing the search doesn't close it) -
      // select directly rather than re-invoking the opener, which expects
      // the closed form's own field to be tappable.
      const covistaOption = await driver.$('//*[starts-with(@content-desc,"Covista")]');
      await covistaOption.click();

      // TC054/TC065 - same shared component for Manufacturer (and, by the
      // same component, Model) - search narrows to an exact match, clear
      // restores the unfiltered list.
      await test.step('TC054/TC065: clearing the Manufacturer search restores the unfiltered list', async () => {
        await coffee.openAddEquipmentDropdownAndSearch('Manufacturer', 'Bun');
        const filteredCount = await coffee.getAddEquipmentDropdownOptionCount();
        expect(filteredCount).toBe(1);
        await coffee.clearAddEquipmentDropdownSearch();
        const restoredCount = await coffee.getAddEquipmentDropdownOptionCount();
        expect(restoredCount).toBeGreaterThan(filteredCount);
      });

      // Same reason as the Account sheet above - still open after clearing.
      const bunnOption = await driver.$('~Bunn');
      await bunnOption.click();
      await coffee.selectAddEquipmentDropdownOption('Model', 'Axiom Single GPR');

      // TC085/TC089 - typing a barcode value populates the field and stays
      // shown. Uses a digits-only value and dismisses the keyboard right
      // after - live-verified the system IME's word-prediction bar can
      // otherwise append an autocorrect suggestion onto a letters-adjacent
      // value if left open (e.g. a stray " ft" appended after "...561").
      await test.step('TC085/TC089: a typed Barcode value is displayed in the field', async () => {
        await coffee.typeAddEquipmentField('Barcode', '629104873561');
        await coffee.pressKeyCode(4);
        const barcodeField = await driver.$('//android.widget.EditText[starts-with(@hint,"Barcode")]');
        expect(await barcodeField.getAttribute('text')).toBe('629104873561');
      });

      await test.step('Return to Home', async () => {
        await home.returnToHome();
      });
    }
  );
});

// TC147/TC149/TC167 (Coffee "Presales order") - live-verified 2026-07-29
// (build 0.1.76, Route 10/TODAY, "Amazon Corporate"/"3rd Floor" stop, a
// manually-seeded Covista Coffee delivery - Route 10's own Coffee stop is
// date-relative seed data that rotates as the real calendar date advances,
// so unlike the equipment-audit stop this one had to be added fresh for
// this session rather than reused from an earlier day).
//
// Reached via the checklist's own "Add presale\nLog presale if/when
// requested" OPTIONAL tile (distinct from the mandatory Delivery tile) -
// opens straight into a "Pre-sales" empty state, same
// empty-state-with-its-own-Add-button pattern as Equipment audit.
//
// NOT independently asserted (documented instead):
// - TC150 ("current date pre-populated in the field") - live-verified
//   FALSE: the Delivery Date field starts on a "Select Delivery Date"
//   placeholder, not today's date.
// - TC148 - covered incidentally (the date/route header chip is the same
//   shared component asserted elsewhere), not re-asserted per-field here.
test.describe('Coffee - Presales order (Add Pre-sales order)', () => {
  test(
    'TC147/TC149/TC167: open Add Pre-sales order, enforce the delivery-date upper limit, save an order',
    { tag: ['@Coffee-TC147', '@Coffee-TC149', '@Coffee-TC167'] },
    async ({ driver }, testInfo) => {
      testInfo.setTimeout(240_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Route 10/TODAY (the Coffee Presales stop is seeded on TODAY only)', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.defaultRoute, day: 'TODAY' });
      });

      // Precondition (same as the Skip-photo TODAY test above) - the
      // ad-hoc Coffee delivery this test's Coffee stop depends on isn't
      // guaranteed to persist from a previous run/session (live-verified
      // 2026-08-06: it was gone on a later, independent run against the
      // same account after having been present earlier), so each TODAY
      // test re-asserts it exists rather than assuming another test's run
      // already did.
      await test.step("Ensure today's route has a Coffee delivery", async () => {
        await ensureCoffeeDeliveryExists(driver, 'FedEx');
      });

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });

      await test.step("Open the day's Coffee service stop", async () => {
        // Route 10/Today's Coffee stop is FedEx (ad-hoc-scheduled via
        // ensureCoffeeDeliveryExists above), not the original manually-
        // seeded stop this test was written against - opened by name, not
        // position, since Route 10's stop order/count drifts (live-
        // verified 2026-08-06, same rationale as ensureCoffeeDeliveryExists's
        // own note).
        await dashboard.clickLocationByName('FedEx');
        await dashboard.openFirstServiceStation('coffee');
      });

      // TC147 "open Add a Pre-sale order screen" - via the checklist's
      // Optional "Add presale" tile, then its own empty-state Add order.
      //
      // Idempotency guard (live-verified 2026-08-06, same class of issue
      // as the TC001 Equipment audit test's own note): a Pre-sales order
      // saved by an earlier run against this same FedEx/Today stop
      // persists server-side, so the checklist tile can land on the
      // order's own summary screen instead of the empty state. Either way,
      // the summary's "+"/"Add order" trigger (openAddPresalesOrder, same
      // locator used by both states) opens a fresh "Add Pre-sales order"
      // form - only the empty-state assertion itself is conditional.
      await test.step('TC147: Add presale opens the Pre-sales empty state (or an existing summary), then Add Pre-sales order', async () => {
        await coffee.tapAddPresaleTrigger();
        const onSummary = await coffee.isPresalesSummaryVisible();
        if (!onSummary) {
          expect(await coffee.isPresalesEmptyStateVisible()).toBe(true);
        }
        await coffee.openAddPresalesOrder();
        expect(await coffee.isAddPresalesOrderTitleVisible()).toBe(true);
      });

      // TC149 "view the Delivery Date field" + TC165/TC167 "enforce/reject
      // a delivery date beyond the upper limit" - live-verified the native
      // Android date picker's own upper bound is exactly today+35 days
      // (Sep 2, 2026 enabled, Sep 3 onward disabled, from a "today" of
      // Jul 29, 2026) - re-derives that same +35 offset relative to
      // whatever "today" actually is at run time, rather than a fixed date.
      await test.step('TC149/TC167: the Delivery Date picker enforces an upper limit of today+35 days', async () => {
        await coffee.openDeliveryDatePicker();

        const today = new Date();
        const limit = new Date(today);
        limit.setDate(limit.getDate() + 35);
        const dayAfterLimit = new Date(limit);
        dayAfterLimit.setDate(dayAfterLimit.getDate() + 1);

        const format = (d: Date) => d.getDate().toString();

        // Navigate the picker to the limit month (and the day-after-limit's
        // month, if different) via Next month, then read each day's own
        // enabled state directly - no fixed calendar assumptions beyond the
        // +35 day offset itself.
        const monthsToAdvance =
          (limit.getFullYear() - today.getFullYear()) * 12 + (limit.getMonth() - today.getMonth());
        for (let i = 0; i < monthsToAdvance; i++) {
          await coffee.tapNextMonth();
        }
        expect(await coffee.isDayEnabled(`${format(limit)},`)).toBe(true);

        if (dayAfterLimit.getMonth() !== limit.getMonth()) {
          await coffee.tapNextMonth();
        }
        expect(await coffee.isDayEnabled(`${format(dayAfterLimit)},`)).toBe(false);

        await coffee.cancelDatePicker();
      });

      // TC199/TC200/TC201 - not independently Excel-numbered under this
      // TC147 row's own TC# but part of the same Merged source-TC group;
      // exercised here as the natural continuation of the same screen
      // already open, confirming the end-to-end save + summary flow works.
      await test.step('Save an order and confirm the Pre-sales summary reflects it', async () => {
        await coffee.openDeliveryDatePicker();
        await coffee.confirmDatePickerSelection();

        await coffee.openAddProductSearch();
        await coffee.searchPresaleProduct('coffee');
        await coffee.selectPresaleProductOption('Coffee');
        // Deliberately NOT dismissing the quantity keypad that appears here
        // via a BACK press - live-verified this keypad is the app's own
        // custom widget, not a system IME, so BaseScreen.hideKeyboardViaAdb
        // (which relies on Android intercepting BACK to close an open IME)
        // would instead navigate back out of this screen. Not needed
        // anyway - live-verified the Cancel/Save order buttons sit above
        // the keypad's own bounds, with no overlap.

        expect(await coffee.isSaveOrderEnabled()).toBe(true);
        await coffee.saveOrder();

        const itemsText = await coffee.getPresalesSummaryItemsText();
        expect(itemsText).toContain('Items');
        expect(await coffee.isPresalesContinueVisible()).toBe(true);
      });

      await test.step('Return to Home', async () => {
        await home.returnToHome();
      });
    }
  );
});

// TC206/TC207/TC209/TC210-TC212/TC215-TC217 (Coffee "Delivery") - live-
// verified 2026-07-29 (build 0.1.76, Route 10/TODAY, "Amazon Corporate"/
// "3rd Floor" stop, the same manually-seeded ad-hoc Coffee delivery used
// for the Presales order suite above).
//
// NOT independently asserted (documented instead):
// - TC208 (sort actually reorders the list) - the "Sort by" sheet itself
//   (TC207) is opened and its options/Clear sort order confirmed, but
//   applying a sort and asserting reordering needs 2+ differently-named
//   products already in a stable order - not attempted here to keep this
//   test focused; see CoffeeServiceScreen.selectSortOption for the hook a
//   future test can use.
// - TC211's exact "zero value" trigger - live-verified the "Coffee
//   Delivery! Some deliveries are not updated" confirm popup appeared
//   regardless of the Delivered value entered (including non-zero) on
//   this ad-hoc stop, most likely because its "Ordered" column stays
//   blank ("-") rather than a real requested quantity - see
//   CoffeeServiceScreen's own note above its Delivery locators. This test
//   asserts the popup's real, confirmed behavior (appears on Continue,
//   No/Yes navigate as TC212/TC213 describe) without asserting a specific
//   zero-value CAUSE that couldn't be isolated from data available this
//   session.
// - TC213/TC214 - exercised as the natural continuation of TC212's own
//   Yes path and TC210's own page-elements check, not separately tagged.
// - TC219-TC225 (delivery service fee) - live-verified NOT PRESENT in this
//   build at all (no "fee" text anywhere on the Signing Order screen) -
//   matches the Excel's own "Not Tested" Result for all of these rows.
test.describe('Coffee - Delivery (add product, sort/search, sign-off)', () => {
  test(
    'TC206/TC207/TC209/TC210-TC212/TC215-TC217: add a product, confirm popup, sign off with an invoice email',
    { tag: ['@Coffee-TC206', '@Coffee-TC207', '@Coffee-TC209', '@Coffee-TC210', '@Coffee-TC211', '@Coffee-TC212', '@Coffee-TC215', '@Coffee-TC216', '@Coffee-TC217'] },
    async ({ driver }, testInfo) => {
      testInfo.setTimeout(240_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Route 10/TODAY (the Coffee Delivery stop is seeded on TODAY only)', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.defaultRoute, day: 'TODAY' });
      });

      // Precondition (see the Skip-photo TODAY test's own note) - this
      // test's Coffee stop (FedEx) isn't guaranteed to already have a
      // Coffee delivery from a previous run/session.
      await test.step("Ensure today's route has a Coffee delivery", async () => {
        await ensureCoffeeDeliveryExists(driver, 'FedEx');
      });

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });

      // Idempotency guard (live-verified 2026-08-07, same class of issue as
      // the TC001 Equipment audit and TC147 Presales tests' own notes): a
      // Delivery submitted by an earlier run's completed Sign Off persists
      // for the rest of the day, so this stop's Deliveries list can already
      // be non-empty.
      //
      // CORRECTED (live-verified 2026-08-07): earlier versions of this guard
      // tried to tolerate a non-empty starting list - first via baseline+N
      // deltas, then via presence/relative-count checks - both needed
      // because product search is non-deterministic and can coincidentally
      // match an already-present row. Both became unnecessary once a real
      // reset was found: swiping a Deliveries row left reveals a trash
      // icon (a child android.widget.Button of the row), which opens a
      // "Delete Product... Yes/No" confirm dialog - see
      // CoffeeServiceScreen.deleteAllDeliveryProducts(). Clearing the list
      // first restores the test to its original, simplest form: exact
      // counts against a guaranteed-empty start, no delta math needed.
      await test.step("Open the day's Coffee service stop and the Delivery tile", async () => {
        // FedEx (the ad-hoc-scheduled Coffee stop), opened by name rather
        // than position - Route 10's stop order/count drifts (live-
        // verified 2026-08-06, same rationale as ensureCoffeeDeliveryExists's
        // own note).
        await dashboard.clickLocationByName('FedEx');
        await dashboard.openFirstServiceStation('coffee');
        await coffee.openDelivery();
        if (!(await coffee.isDeliveriesEmptyStateVisible())) {
          await coffee.deleteAllDeliveryProducts();
        }
        expect(await coffee.isDeliveriesEmptyStateVisible()).toBe(true);
      });

      // TC206 "add a product to the delivery screen"
      //
      // CORRECTED (live-verified 2026-08-07): getVisibleDeliveryProductCount()
      // right after selectDeliveryProductOption() can read the list mid-
      // transition (the "Search product" sheet is still closing/the row
      // hasn't rendered yet), intermittently observed as a spurious 0 -
      // expect.poll() retries the read instead of trusting a single
      // snapshot, same fix applied to every count check in this test that
      // follows an action which mutates the list asynchronously.
      await test.step('TC206: add a product via the header + icon', async () => {
        await coffee.openAddDeliveryProduct();
        await coffee.searchDeliveryProductOption('coffee');
        await coffee.selectDeliveryProductOption('Coffee');
        await expect.poll(() => coffee.getVisibleDeliveryProductCount()).toBe(1);
      });

      // TC207 "open the sort screen" - options + Clear sort order visible.
      await test.step('TC207: the Sort by sheet opens with its own options', async () => {
        await coffee.openSortBySheet();
        expect(await coffee.isSortBySheetVisible()).toBe(true);
        await coffee.dismissSortBySheet();
      });

      // TC209 "search for a product" - filters the already-added list down
      // to a second, differently-named product added for this purpose.
      await test.step('TC209: the Deliveries search field filters the already-added product list', async () => {
        await coffee.openAddDeliveryProduct();
        await coffee.searchDeliveryProductOption('sugar');
        await coffee.selectDeliveryProductOption('Sugar');
        await expect.poll(() => coffee.getVisibleDeliveryProductCount()).toBe(2);

        await coffee.searchDeliveriesList('sugar');
        await expect.poll(() => coffee.getVisibleDeliveryProductCount()).toBe(1);
      });

      // TC211/TC212 "zero Ending Inventory blocks proceeding, No keeps the
      // user on Deliveries" - see this describe block's own note on why
      // the popup's TRIGGER (zero value specifically) isn't asserted, only
      // its real observed behavior.
      await test.step('TC211/TC212: Continue surfaces a confirm popup; No stays on Deliveries', async () => {
        expect(await coffee.isDeliveryContinueEnabled()).toBe(true);
        await coffee.tapDeliveryContinue();
        expect(await coffee.isDeliveryConfirmDialogVisible()).toBe(true);
        await coffee.dismissDeliveryConfirmDialog();
        expect(await coffee.isDeliveriesEmptyStateVisible()).toBe(false);
        await expect.poll(() => coffee.getVisibleDeliveryProductCount()).toBe(1);
      });

      // TC210/TC213/TC214 "Yes navigates to Signing Order; its own fields
      // and Delivery/Cost summary tables are correct"
      await test.step('TC210/TC213/TC215: Yes navigates to Signing Order, with Delivery/Cost summary tables', async () => {
        await coffee.tapDeliveryContinue();
        await coffee.confirmDeliveryConfirmDialog();
        expect(await coffee.isOrderNumberChipVisible()).toBe(true);
        expect(await coffee.isDeliverySummaryVisible()).toBe(true);
        expect(await coffee.isCostSummaryVisible()).toBe(true);
      });

      // TC216/TC217/TC218 "sign-off requires a signature; email fields"
      await test.step('TC216/TC217/TC218: Sign off is gated on a signature; Default Email is read-only, Invoice Email is editable', async () => {
        await coffee.openSignOff();
        expect(await coffee.isDefaultEmailFieldVisible()).toBe(true);
        expect(await coffee.isSignOffEnabled()).toBe(false);

        await coffee.enterInvoiceEmail('test@example.com');
        await coffee.drawSignature();
        expect(await coffee.isSignOffEnabled()).toBe(true);

        await coffee.submitSignOff();
        expect(await coffee.isDeliveryContinueEnabled()).toBe(true);
      });

      await test.step('Return to Home', async () => {
        await home.returnToHome();
      });
    }
  );
});

// TC274/TC277/TC278 (Coffee "After Photo") - live-verified 2026-07-29
// (build 0.1.76, Route 10/TODAY, "Amazon Corporate"/"3rd Floor" stop). The
// checklist's own "After Photos" tile opens the exact same shared "Add
// supporting photo"/Skip-photo-reason-sheet component already proven for
// Before Photos (see the "Coffee - Before Photos / Skip photo" describe
// block above) - this test is the direct live verification of that same
// component against Coffee's own After Photo Excel row, not just
// incidental regression coverage.
test.describe('Coffee - After Photos / Skip photo', () => {
  test(
    'Skip photo flow: reason sheet appears, accepts a reason, and submits without saving a photo',
    { tag: ['@Coffee-TC274', '@Coffee-TC277', '@Coffee-TC278'] },
    async ({ driver }, testInfo) => {
      testInfo.setTimeout(240_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Route 10/TODAY (the Coffee stop is seeded on TODAY only)', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.defaultRoute, day: 'TODAY' });
      });

      // Precondition (see the Skip-photo TODAY test's own note) - this
      // test's Coffee stop (FedEx) isn't guaranteed to already have a
      // Coffee delivery from a previous run/session.
      await test.step("Ensure today's route has a Coffee delivery", async () => {
        await ensureCoffeeDeliveryExists(driver, 'FedEx');
      });

      await test.step('Complete Start Day (prerequisite gate for any LOB service flow)', async () => {
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
      });

      await test.step("Open the day's Coffee service stop", async () => {
        // FedEx (the ad-hoc-scheduled Coffee stop), opened by name rather
        // than position - Route 10's stop order/count drifts (live-
        // verified 2026-08-06, same rationale as ensureCoffeeDeliveryExists's
        // own note).
        await dashboard.clickLocationByName('FedEx');
        await dashboard.openFirstServiceStation('coffee');
      });

      // TC274 "open skip reason sheet" - via After Photos' own Take/Skip
      // photo modal, same shared component as Before Photos.
      await test.step('TC274: tap After Photos, then Skip photo, and verify the reason sheet is disabled by default', async () => {
        await coffee.openAfterPhotos();
        const modal = await coffee.isPhotoModalVisible();
        expect(modal.takePhoto).toBe(true);
        expect(modal.skipPhoto).toBe(true);

        await coffee.openSkipPhotoReasonSheet();
        expect(await coffee.isSkipPhotoReasonSheetVisible()).toBe(true);
        expect(await coffee.isSkipPhotoSubmitEnabled()).toBe(false);
      });

      // TC277 "type skip reason" - Skip enables once a non-blank reason is entered.
      await test.step('TC277: entering a reason enables Skip photo', async () => {
        await coffee.enterSkipPhotoReason('Camera cannot focus and take clear picture');
        await coffee.waitForSkipPhotoSubmitEnabled(true);
      });

      // TC278 "submit skip reason" - lands back on the service stop
      // checklist without a photo being saved.
      await test.step('TC278: submit the reason and return to the service stop screen', async () => {
        await coffee.confirmSkipPhoto();
        expect(await coffee.isSkipPhotoReasonSheetVisible()).toBe(false);
      });

      await test.step('Return to Home', async () => {
        await home.returnToHome();
      });
    }
  );

});

test.describe('Coffee - Equipment audit (regression suite C-TC-xxx)', () => {
  // ==== C-TC-001 (regression suite "Coffee", build 0.1.90) ====
  //
  // "Audit date is included automatically and is not editable."
  //
  // MOVED to Charlotte 103 on 2026-08-25: this originally ran on Route 010 and
  // BOOTSTRAPPED its own Coffee stop ad-hoc, because Route 010 has no Coffee
  // data left. Two reasons that is no longer right. First, Anthony confirmed
  // Coffee orders live on Charlotte 103 and that we should test service WITH
  // orders first, treating ad-hoc creation as its own separate scenario -
  // 24Hundred Marketplace is a real ordered stop. Second, ad-hoc stops may not
  // survive the schedule's delta refresh (one we created on Miami 001 vanished
  // the same day), so depending on one is inherently fragile. Keeping every
  // Coffee C-TC on one route also stops the batch switching routes, which was
  // repeatedly tripping the Route dropdown defect (empty until the search
  // field's X is tapped - see RouteSetupScreen.populateModalListViaClearIcon).
  //
  // IMPORTANT - the regression sheet's own Expected text is WRONG and must
  // NOT be automated literally. It reads "an Audit Date reflecting THE
  // BUSINESS DATE should be included", but Anthony confirmed 2026-08-25 that
  // the SYSTEM date is the intended default. The two only agree when the
  // selected route day happens to be today: live-verified on Route
  // 010/YESTERDAY (business date 24 Aug 2026, header shows "24 Aug 2026")
  // the field renders "08/25/2026" - the real calendar date. Asserting the
  // sheet's wording would report a false defect against dev on every
  // non-today route, so this asserts the confirmed intent instead.
  test(
    'C-TC-001: Audit Date is auto-populated with the system date and is not editable',
    { tag: ['@Coffee-C-TC-001'] },
    async ({ driver }) => {
      test.setTimeout(300_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/TODAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.vendingRoute, day: 'TODAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('Reach any Coffee service station', async () => {
        await reachCoffeeStop(driver, 'any-coffee', async () => true, ['24Hundred Marketplace']);
      });

      await test.step('Open Equipment audit and the Add Equipment form', async () => {
        await coffee.openEquipmentAudit();
        await coffee.openAddEquipmentFromEmptyState();
      });

      await test.step('C-TC-001: the Audit Date is auto-populated with the system date', async () => {
        const now = new Date();
        const expected = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()}`;
        expect(await coffee.getAuditDate()).toBe(expected);
      });

      await test.step('C-TC-001: the driver cannot change the Audit Date', async () => {
        expect(await coffee.isAuditDateEditable()).toBe(false);
      });
    }
  );
});


test.describe('Coffee - Order payment (regression suite C-TC-xxx)', () => {
  // ==== C-TC-002 (regression suite "Coffee", build 0.1.90) ====
  //
  // "Cash payment type selection hides Check Number field."
  //
  // Runs on CHARLOTTE 103, not Miami - confirmed by Anthony 2026-08-25 that
  // Coffee orders live there. Miami Route 010 has no Coffee stop at all any
  // more (FedEx, its only ad-hoc Coffee host, is down to a single Market
  // station) and Miami 001 has none on any business date. Charlotte 103's
  // stops carry REAL seeded fills, so the Delivery -> Signing Order ->
  // Payment path is reachable without hand-building an ad-hoc order.
  //
  // The Payment screen itself is new in this build and is NOT mandatory -
  // only Sign Off gates Continue - so this test deliberately stops at
  // inspecting the form and never submits it, leaving the stop untouched
  // for other cases.
  test(
    'C-TC-002: selecting Cash hides Check Number, and Comments stays optional',
    { tag: ['@Coffee-C-TC-002'] },
    async ({ driver }) => {
      test.setTimeout(420_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/TODAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.vendingRoute, day: 'TODAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('Reach Signing Order on a Coffee stop that has requested deliveries', async () => {
        // Precondition, not a stop name: Delivery must be submittable, which
        // requires the stop to actually have requested fills.
        await reachCoffeeStop(driver, 'coffee-with-deliveries', async (c) => {
          await c.openDelivery();
          return c.isDeliveryContinueEnabled();
        }, ['24Hundred Marketplace']);
        // No confirmation dialog any more - removed at customer request
        // (Anthony, 2026-08-25); Continue lands straight on Signing Order.
        await coffee.tapDeliveryContinue();
      });

      await test.step('Open the Order payment screen', async () => {
        await coffee.openOrderPayment();
      });

      await test.step('C-TC-002: the payment type selector offers Cash and Check', async () => {
        expect(await coffee.getPaymentTypeOptions()).toEqual(expect.arrayContaining(['Cash', 'Check']));
        await coffee.selectPaymentType('Check');
      });

      // Establish the contrast first: under Check the field IS present. Without
      // this, "Check Number is absent under Cash" proves nothing - the field
      // might simply not exist on the screen at all.
      await test.step('C-TC-002 (control): Check shows the Check Number field', async () => {
        expect(await coffee.getPaymentType()).toBe('Check');
        expect(await coffee.isPaymentFieldVisible('Check Number*')).toBe(true);
      });

      await test.step('C-TC-002: switching to Cash hides Check Number', async () => {
        await coffee.choosePaymentType('Cash');
        expect(await coffee.getPaymentType()).toBe('Cash');
        expect(await coffee.isPaymentFieldVisible('Check Number*')).toBe(false);
      });

      await test.step('C-TC-002: Comments remains present and optional under Cash', async () => {
        // Optionality is conveyed ONLY by the absence of a trailing asterisk
        // in the hint - Amount* and Check Number* carry one, Comments does not.
        expect(await coffee.isPaymentFieldOptional('Comments')).toBe(true);
        expect(await coffee.isPaymentFieldVisible('Amount*')).toBe(true);
      });
    }
  );
  // ==== C-TC-003 (regression suite "Coffee", build 0.1.90) ====
  //
  // "Check payment requires mandatory Check Number with max 10 digits."
  //
  // Shares C-TC-002's screen and route (Charlotte 103 - see that test's own
  // note on why not Miami). Deliberately never submits successfully: the
  // only Done tap here is the one that must FAIL validation, so the stop is
  // left exactly as found for other cases.
  test(
    'C-TC-003: Check Number is mandatory and caps at 10 digits',
    { tag: ['@Coffee-C-TC-003'] },
    async ({ driver }) => {
      test.setTimeout(420_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/TODAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.vendingRoute, day: 'TODAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('Reach the Order payment screen and select Check', async () => {
        await reachCoffeeStop(driver, 'coffee-with-deliveries', async (c) => {
          await c.openDelivery();
          return c.isDeliveryContinueEnabled();
        }, ['24Hundred Marketplace']);
        await coffee.tapDeliveryContinue();
        await coffee.openOrderPayment();
        await coffee.choosePaymentType('Check');
      });

      await test.step('C-TC-003: the Check Number field is displayed and marked mandatory', async () => {
        // Mandatory is signalled by the trailing asterisk in the hint - the
        // only marker this screen provides.
        expect(await coffee.isPaymentFieldVisible('Check Number*')).toBe(true);
      });

      // Two input paths deliberately: setValue can bypass validation that real
      // per-character keystrokes respect (a bypass this suite has been bitten
      // by before), so a cap proven only via setValue would not be trustworthy.
      // Live-verified 2026-08-25 that BOTH truncate at 10.
      await test.step('C-TC-003: 15 digits entered via setValue are capped at 10', async () => {
        await coffee.typePaymentField('Check Number*', '123456789012345');
        expect(await coffee.getPaymentFieldValue('Check Number*')).toBe('1234567890');
      });

      await test.step('C-TC-003: 15 digits entered as real keystrokes are capped at 10', async () => {
        await coffee.clearPaymentField('Check Number*');
        for (const ch of '987654321098765') {
          await driver.keys(ch);
        }
        expect(await coffee.getPaymentFieldValue('Check Number*')).toBe('9876543210');
      });

      // Not part of the TC's own wording, but it defines what "digits" means
      // here and is cheap to lock down: the field silently strips non-numerics.
      await test.step('C-TC-003 (extra): non-numeric characters are stripped', async () => {
        await coffee.clearPaymentField('Check Number*');
        for (const ch of 'ab12cd34') {
          await driver.keys(ch);
        }
        expect(await coffee.getPaymentFieldValue('Check Number*')).toBe('1234');
      });

      await test.step('C-TC-003: submitting with Check Number empty is rejected', async () => {
        await coffee.clearPaymentField('Check Number*');
        await coffee.typePaymentField('Amount*', '10');
        // Done is NOT gated - it stays enabled and validates on tap.
        expect(await coffee.isPaymentDoneEnabled()).toBe(true);
        await coffee.tapPaymentDone();
        expect(await coffee.isPaymentValidationErrorVisible()).toBe(true);
      });
    }
  );

  // ==== C-TC-004 (regression suite "Coffee", build 0.1.90) ====
  //
  // "Customer Signature screen validates back navigation before and after
  // signing."
  //
  // Same Charlotte 103 stop as C-TC-002/003. Leaves the stop CLEAN: the
  // signature drawn here is deliberately discarded via "Go Back" at the end,
  // and Sign off is never submitted, so the order is untouched for other cases.
  test(
    'C-TC-004: back navigation prompts only after signing, and Cancel keeps the signature',
    { tag: ['@Coffee-C-TC-004'] },
    async ({ driver }) => {
      test.setTimeout(480_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/TODAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.vendingRoute, day: 'TODAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('Reach Signing Order', async () => {
        await reachCoffeeStop(driver, 'coffee-with-deliveries', async (c) => {
          await c.openDelivery();
          return c.isDeliveryContinueEnabled();
        }, ['24Hundred Marketplace']);
        await coffee.tapDeliveryContinue();
      });

      await test.step('C-TC-004: Back before signing returns to Signing Order with no prompt', async () => {
        await coffee.openSignOff();
        // Sign off stays disabled until the pad is actually drawn on - that is
        // also this test's signal for whether a signature exists at all.
        expect(await coffee.isSignOffEnabled()).toBe(false);
        await driver.executeScript('mobile: pressKey', [{ keycode: 4 }]);
        expect(await coffee.isSignatureDiscardPromptVisible()).toBe(false);
        expect(await coffee.isSigningOrderTitleVisible()).toBe(true);
      });

      await test.step('C-TC-004: Back after signing raises the "Are you sure?" prompt', async () => {
        await coffee.openSignOff();
        await coffee.drawSignature();
        expect(await coffee.isSignOffEnabled()).toBe(true);
        await driver.executeScript('mobile: pressKey', [{ keycode: 4 }]);
        expect(await coffee.isSignatureDiscardPromptVisible()).toBe(true);
        expect(await coffee.getSignatureDiscardPromptText()).toContain('signature will be lost');
      });

      await test.step('C-TC-004: Cancel returns to the signature screen with the signature retained', async () => {
        await coffee.cancelSignatureDiscard();
        // Sign off being enabled is the only available proof the signature
        // survived - the pad itself exposes no readable content of its own.
        expect(await coffee.isSignOffEnabled()).toBe(true);
      });

      await test.step('Cleanup: discard the signature so the order is left untouched', async () => {
        await driver.executeScript('mobile: pressKey', [{ keycode: 4 }]);
        await coffee.confirmSignatureDiscard();
      });
    }
  );

  // ==== C-TC-005 (regression suite "Coffee", build 0.1.90) ====
  //
  // "Deliveries screen shows empty state when no deliveries are requested."
  //
  // Split into two tests deliberately. The sheet records this case as Fail
  // with BUG 918856 raised, and exactly ONE of its five expected clauses
  // actually fails (the fee lines). Asserting all five in a single test marked
  // as expected-to-fail would mask a regression in the other four - the test
  // would still "pass" if the heading or Continue-disabled behaviour broke.
  test(
    'C-TC-005: empty Deliveries shows header, search, Add/Sort icons and a disabled Continue',
    { tag: ['@Coffee-C-TC-005'] },
    async ({ driver }) => {
      test.setTimeout(600_000);
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/TODAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.vendingRoute, day: 'TODAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('Reach a Coffee stop with no requested deliveries', async () => {
        await reachCoffeeStopWithEmptyDeliveries(driver);
      });

      await test.step('C-TC-005: date, route and Deliveries heading are shown', async () => {
        const header = await coffee.isDateRouteHeaderVisible();
        expect(header.date).toBe(true);
        expect(header.route).toBe(true);
        expect(await coffee.isDeliveriesHeadingVisible()).toBe(true);
      });

      await test.step('C-TC-005: Search product field with Add and Sort icons', async () => {
        expect(await coffee.isDeliverySearchFieldVisible()).toBe(true);
        expect(await coffee.areDeliveryHeaderIconsVisible()).toEqual({ add: true, sort: true });
      });

      await test.step('C-TC-005: the empty-state message is shown', async () => {
        expect(await coffee.isDeliveriesEmptyStateVisible()).toBe(true);
      });

      await test.step('C-TC-005: Continue remains disabled', async () => {
        expect(await coffee.isDeliveriesContinueEnabled()).toBe(false);
      });
    }
  );

  // FAILING HALF of C-TC-005 - BUG 918856.
  //
  // Marked test.fail() so it asserts the INTENDED behaviour while staying green
  // against the current build, and flags loudly ("expected to fail but passed")
  // the moment the fix lands. That is the whole point of writing it this way:
  // the alternative - asserting the buggy behaviour as if correct - would go
  // silently green forever and never tell us the bug was fixed.
  //
  // The expectation is legitimate, not a mis-specified test case: a POPULATED
  // Deliveries screen on this same route DOES render both fee lines (live-
  // verified 2026-08-25: "Shipping & Handling (Taxable) $1.06" and "Delivery
  // Charge (Nontaxable) $12.00" on 24Hundred Marketplace). Only the empty state
  // omits them.
  test(
    'C-TC-005 (BUG 918856): empty Deliveries omits Shipping & Handling and Delivery Charge',
    { tag: ['@Coffee-C-TC-005', '@bug-918856'] },
    async ({ driver }) => {
      test.setTimeout(600_000);
      test.fail();
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await loginAndEnsureRoute(driver, { ...mobileConfig.vendingRoute, day: 'TODAY' });
      await prepTasks.openFromHamburgerMenu();
      await prepTasks.ensureFullDayPrepComplete();
      await home.returnToHome();
      await reachCoffeeStopWithEmptyDeliveries(driver);

      expect(await coffee.isDeliveryFeeLineVisible('Shipping & Handling')).toBe(true);
      expect(await coffee.isDeliveryFeeLineVisible('Delivery Charge')).toBe(true);
    }
  );

  // ==== C-TC-007 (regression suite "Coffee", build 0.1.90) ====
  //
  // "Driver cancels presale creation with unsaved changes."
  //
  // Runs on 24Hundred Marketplace (Charlotte 103). Safe to run against a real
  // ordered stop precisely BECAUSE it cancels: nothing is ever saved, so the
  // stop is left exactly as found.
  //
  // Gating discovered live 2026-08-25 and worth knowing before reading this
  // test: the form's Cancel AND "Save order" both stay DISABLED until the
  // Delivery Date is set - adding a product is not enough. So a driver who
  // adds a product and changes their mind has no Cancel button at all, only
  // the back arrow. Odd, but it is a gating rule rather than a defect, and the
  // test sets the date so it can exercise the documented Cancel path.
  test(
    'C-TC-007: cancelling a presale with unsaved changes creates no order',
    { tag: ['@Coffee-C-TC-007'] },
    async ({ driver }) => {
      test.setTimeout(600_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/TODAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.vendingRoute, day: 'TODAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('Reach a Coffee stop whose Pre-sales is empty, and start an order', async () => {
        // Precondition: the stop must have NO saved presales, since the final
        // assertion is that the empty state is still there after cancelling.
        // Discovering this at runtime also means C-TC-010 consuming one stop's
        // empty state simply pushes this test onto another.
        await reachCoffeeStop(driver, 'coffee-empty-presales', async (c) => {
          await c.tapAddPresaleTrigger();
          return c.isPresalesEmptyStateVisible();
        }, ['24Hundred Marketplace']);
        await coffee.openAddPresalesOrder();
      });

      await test.step('C-TC-007: build up unsaved changes - a product and a delivery date', async () => {
        // Typing in "Add product" opens a separate product SEARCH SHEET;
        // picking a result returns to the form with the product attached.
        await coffee.typeAddPresalesProduct('sugar');
        await coffee.selectPresaleProductOption('Canteen Granulated Sugar Canister (20oz) - pkg: 1');
        await coffee.dismissPresaleKeypadIfPresent();
        const chosen = await coffee.selectFirstAvailableDeliveryDate();
        expect(chosen).not.toBe('');
        expect(await coffee.getAddPresalesDeliveryDate()).not.toBe('');
      });

      await test.step('C-TC-007: Cancel is available once the form is complete', async () => {
        expect(await coffee.isAddPresalesCancelEnabled()).toBe(true);
        expect(await coffee.isAddPresalesSaveEnabled()).toBe(true);
      });

      await test.step('C-TC-007: cancelling returns to Pre-sales with no order created', async () => {
        await coffee.cancelAddPresalesOrder();
        // The empty state IS the proof no order was created - it only renders
        // when the stop has no presales at all.
        expect(await coffee.isPresalesEmptyStateVisible()).toBe(true);
        expect(await coffee.isPresalesContinueEnabled()).toBe(false);
      });
    }
  );

  // ==== C-TC-010 (regression suite "Coffee", build 0.1.90) ====
  //
  // "Driver creates a presale order with valid delivery date and product."
  //
  // The SAVE counterpart of C-TC-007's cancel path, and the reason it runs on
  // AMEROCK rather than 24Hundred Marketplace: saving a presale permanently
  // removes that stop's Pre-sales empty state, which C-TC-007 asserts. Amerock
  // is the ad-hoc stop we already use as a mutation sandbox (see
  // reachEmptyCoffeeDeliveries), so the two cases cannot collide.
  //
  // Written to tolerate presales left by earlier runs: a saved presale cannot
  // be removed from the app, so this asserts that OUR order is present by its
  // own delivery date rather than asserting a total count.
  test(
    'C-TC-010: a presale saves and shows its Items count and Delivery Date',
    { tag: ['@Coffee-C-TC-010'] },
    async ({ driver }) => {
      test.setTimeout(600_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/TODAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.vendingRoute, day: 'TODAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('Reach a Coffee stop and start a presale', async () => {
        // Saving a presale destroys a stop's Pre-sales empty state, which
        // C-TC-007 needs - so deliberately prefer a stop OTHER than the one
        // C-TC-007 settled on, and let discovery sort it out if that is gone.
        const usedByCancelTest = qualifyingStopCache.get('coffee-empty-presales');
        await reachCoffeeStop(
          driver,
          'coffee-for-presale-save',
          async (c) => {
            await c.tapAddPresaleTrigger();
            return true;
          },
          ['Amerock', '24Hundred Marketplace'].filter((n) => n !== usedByCancelTest)
        );
        await coffee.openAddPresalesOrder();
      });

      let expectedDate = '';
      await test.step('C-TC-010: add a valid product and delivery date', async () => {
        await coffee.typeAddPresalesProduct('sugar');
        // Any valid product satisfies this TC, so take the first result rather
        // than naming one - see selectFirstPresaleSearchResult on why the
        // by-name helper can select the wrong row.
        const product = await coffee.selectFirstPresaleSearchResult();
        expect(product).not.toBe('');
        // Guarded, not a blind BACK - see dismissPresaleKeypadIfPresent.
        await coffee.dismissPresaleKeypadIfPresent();
        await coffee.selectFirstAvailableDeliveryDate();
        expectedDate = await coffee.getAddPresalesDeliveryDate();
        expect(expectedDate).not.toBe('');
        expect(await coffee.isAddPresalesSaveEnabled()).toBe(true);
      });

      await test.step('C-TC-010: saving shows the presale with Items count and Delivery Date', async () => {
        await coffee.saveAddPresalesOrder();
        expect(await coffee.isPresalesSummaryVisible()).toBe(true);
        // "Items\n1" - assert a real count is rendered, not the exact total,
        // since earlier runs may have left presales on this stop.
        expect(await coffee.getPresalesSummaryItemsText()).toMatch(/Items[\s\S]*\d/);
        expect(await coffee.getSavedPresaleDeliveryDate()).toBe(expectedDate);
        // Continue only enables once the stop actually has a saved presale.
        expect(await coffee.isPresalesContinueEnabled()).toBe(true);
      });
    }
  );

});
