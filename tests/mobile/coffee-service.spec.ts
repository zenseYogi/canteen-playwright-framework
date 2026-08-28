import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndEnsureRoute, ensureCoffeeDeliveryExists } from '../../utils/login-flow';
import { AdhocDeliveryScreen } from '../../screens/adhoc-delivery.screen';
import { PrepTasksScreen } from '../../screens/prep-tasks.screen';
import { DashboardScreen } from '../../screens/dashboard.screen';
import { CoffeeServiceScreen } from '../../screens/coffee-service.screen';
import { HomeScreen } from '../../screens/home.screen';
import { mobileConfig } from '../../config/mobile.config';
import type { Position } from '../../utils/position';

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
  qualify: (coffee: CoffeeServiceScreen, stopName: string) => Promise<boolean>,
  preferred: string[] = [],
  maxScan = 10,
  exclude: string[] = []
): Promise<string> {
  const home = new HomeScreen(driver);
  const dashboard = new DashboardScreen(driver);
  const coffee = new CoffeeServiceScreen(driver);

  const attempt = async (name: string): Promise<boolean> => {
    await home.returnToHome();
    // Must SCROLL to the row - Home renders only a few of the route's stops at
    // a time (49 on Charlotte 103), so a plain by-name click can only ever
    // reach the first few.
    const opened = await dashboard.scrollToAndClickLocationByName(name).catch(() => false);
    if (!opened) {
      console.log(`[attempt] ${name}: could not open the stop`);
      return false;
    }
    const hasCoffee = await dashboard.isLobCardVisible('coffee').catch(() => false);
    if (!hasCoffee) {
      console.log(`[attempt] ${name}: no coffee LOB card`);
      return false;
    }
    console.log(`[attempt] ${name}: opened, coffee card present`);

    // EVERY service station under the card, not just the first. A stop can
    // carry more than one (Atrium Health has two: an unnamed one and "Floor 1
    // Lounge 1217"), and they are worked INDEPENDENTLY - so a stop whose first
    // station this suite already completed can still have a perfectly fresh
    // second one behind it. Only ever opening the first made such a stop look
    // exhausted, and on a route where every first station was signed,
    // discovery reported "no stop satisfying..." while a workable station sat
    // one tap away. Live-confirmed 2026-08-28.
    for (const position of ['first', 'second', 'third', 'fourth'] as Position[]) {
      if (position !== 'first' && !(await dashboard.isNthServiceStationVisible('coffee', position).catch(() => false))) {
        break;
      }
      try {
        await dashboard.openNthServiceStation('coffee', position);
      } catch (error) {
        console.log(`[attempt] ${name}/${position}: could not open station - ${(error as Error).message.split('\n')[0]}`);
        break;
      }
      // Errors from qualify are LOGGED, not silently swallowed. A bare
      // .catch(() => false) here turned every navigation fault into the same
      // "no stop satisfying..." verdict as genuinely absent data, which is
      // exactly the ambiguity that made this hard to diagnose.
      let qualified = false;
      try {
        // The stop's own name is passed through because some preconditions are
        // about the RELATIONSHIP between the stop and what a screen shows -
        // C-TC-006 needs a stop whose checklist header differs from its account
        // name, which is unanswerable from the screen alone.
        qualified = await qualify(coffee, name);
      } catch (error) {
        console.log(`[attempt] ${name}/${position}: qualify threw - ${(error as Error).message.split('\n')[0]}`);
      }
      if (qualified) return true;
      // Back to this stop's detail to try the next station. Re-navigated from
      // Home rather than by pressing BACK: BACK out of a service screen can
      // exit into Google Maps, which C-TC-045 leaves in the activity stack.
      await home.returnToHome();
      if (!(await dashboard.scrollToAndClickLocationByName(name).catch(() => false))) return false;
      if (!(await dashboard.isLobCardVisible('coffee').catch(() => false))) return false;
    }
    return false;
  };

  const cached = qualifyingStopCache.get(label);
  const ordered = [...(cached ? [cached] : []), ...preferred].filter((n) => !exclude.includes(n));
  for (const name of ordered) {
    if (await attempt(name)) {
      qualifyingStopCache.set(label, name);
      return name;
    }
  }

  let scanned = 0;
  for (const name of await enumerateAllStops(driver)) {
    if (ordered.includes(name) || exclude.includes(name)) continue;
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
    // maxScan is deliberately LOW. Since discovery began walking every service
    // station on a stop (not just the first), a full scan of this route takes
    // long enough that all three tests depending on this helper hit their
    // 15-minute timeout without ever reporting WHY - "Test timeout exceeded"
    // says nothing about the missing precondition. Four stops is enough to
    // establish that no empty-deliveries stop exists, and leaves time for the
    // failure below to be raised and read.
    await reachCoffeeStop(driver, 'coffee-empty-deliveries', async (c) => {
      await c.openDelivery();
      return c.isDeliveriesEmptyStateVisible();
    }, ['Amerock'], 4);
    return;
  } catch {
    // Fall through to bootstrapping one.
  }

  const home = new HomeScreen(driver);
  const dashboard = new DashboardScreen(driver);
  const coffee = new CoffeeServiceScreen(driver);
  const adhoc = new AdhocDeliveryScreen(driver);
  const BOOTSTRAP = 'Amerock';

  // MUST scroll to the row. clickLocationByName() anchors on the "Pending
  // action" tab header via following-sibling, and that header scrolls out of
  // the tree - so it can only ever reach the first few of Charlotte 103's 150+
  // stops, and Amerock is never among them. This is the third time this exact
  // helper has bitten this suite (see the two cases in the file header), and
  // it hid here because the batch never runs this branch: C-TC-005 caches the
  // empty-deliveries stop first, so C-TC-011 reuses the cache and the
  // bootstrap only executes when a test runs in ISOLATION.
  await home.returnToHome();
  const bootstrapExists = await dashboard.scrollToAndClickLocationByName(BOOTSTRAP).catch(() => false);
  if (!bootstrapExists) {
    // Say precisely what is missing. This helper's precondition - a Coffee stop
    // whose Deliveries screen is EMPTY - stopped being satisfiable on Charlotte
    // 103 after the route was re-pulled on 2026-08-28: every stop now carries
    // real ordered products, and "Amerock", the account this bootstrap creates
    // against, is no longer on the route at all. Failing here with that
    // sentence is worth more than a timeout fifteen minutes later.
    throw new Error(
      `No Coffee stop with an EMPTY Deliveries screen exists on this route, and the bootstrap account ` +
        `"${BOOTSTRAP}" is not on it either, so one cannot be created. C-TC-005 and C-TC-035 both need ` +
        `this precondition. Restore it with an ad-hoc Coffee delivery (they arrive with no products by ` +
        `design) or by emptying one stop's Deliveries.`
    );
  }
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
  await dashboard.scrollToAndClickLocationByName(BOOTSTRAP);
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

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
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

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
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
    'C-TC-003/C-TC-022: Check Number is mandatory, caps at 10 digits, and blocks save when empty',
    { tag: ['@Coffee-C-TC-003', '@Coffee-C-TC-022'] },
    async ({ driver }) => {
      test.setTimeout(420_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
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

      // C-TC-022 ("Mandatory validation blocks saving Check payment without
      // Check Number") is this exact step, so it is tagged here rather than
      // duplicated as its own test - the setup to reach this screen is the
      // expensive part and it is already done. C-TC-022 adds one clause over
      // C-TC-003's wording, "the driver should remain on the Payment screen",
      // which is now asserted explicitly instead of being left implied by the
      // validation message alone.
      await test.step('C-TC-003/C-TC-022: submitting with Check Number empty is rejected and stays on Payment', async () => {
        await coffee.clearPaymentField('Check Number*');
        await coffee.typePaymentField('Amount*', '10');
        // Done is NOT gated - it stays enabled and validates on tap.
        expect(await coffee.isPaymentDoneEnabled()).toBe(true);
        await coffee.tapPaymentDone();
        expect(await coffee.isPaymentValidationErrorVisible()).toBe(true);
        expect(await coffee.isOrderPaymentScreenVisible()).toBe(true);
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

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
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
        // Polled rather than read once - the prompt is a dialog window and
        // arrives a beat after the BACK press. This assertion passed as an
        // immediate read earlier in the day and then failed on a slower run,
        // which is the same race seen on the delete dialog, sign-off
        // enablement, and the post-relaunch tree.
        await expect
          .poll(() => coffee.isSignatureDiscardPromptVisible(), { timeout: 20_000 })
          .toBe(true);
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
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
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
      test.setTimeout(900_000);
      test.fail();
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
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
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
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
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
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

  // ==== C-TC-015 (regression suite "Coffee", build 0.1.90) ====
  //
  // "Driver skips After Photo by providing a reason -> After Photos should be
  // marked complete with a tick mark."
  //
  // The skip-reason flow itself is already automated (see the "Coffee - After
  // Photos / Skip photo" describe block, tagged TC274/TC277/TC278), but that
  // test stops at "the reason sheet closed" and only DOCUMENTS the green tick,
  // because the tile exposes no accessible completed state - its content-desc
  // is byte-identical complete or not. This test closes that gap, which is the
  // entire expected outcome of C-TC-015.
  //
  // It also runs on Charlotte 103 with runtime stop discovery, whereas the
  // older test is pinned to Route 010 / FedEx - an account live-confirmed to
  // have lost its Coffee service entirely.
  //
  // NOT self-cleaning, unlike C-TC-011/C-TC-014: skipping a photo completes
  // that tile permanently, and nothing in the app un-completes it. That is why
  // the precondition is "a stop whose After Photos is still PENDING" rather
  // than a fixed stop - each run consumes one, and discovery moves to the next.
  test(
    'C-TC-015: skipping After Photos with a reason marks the tile complete',
    { tag: ['@Coffee-C-TC-015'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('Reach a Coffee stop whose After Photos tile is still pending', async () => {
        // The precondition IS the "before" half of the assertion: a tile that
        // is already green would let this test pass without having done
        // anything. Qualifying on "not yet complete" makes that impossible.
        await reachCoffeeStop(driver, 'coffee-after-photos-pending', async (c) => {
          return !(await c.isPhotoTileComplete('after'));
        }, ['Amerock', '24Hundred Marketplace']);
      });

      await test.step('C-TC-015 (baseline): the After Photos tile shows no completion green', async () => {
        expect(await coffee.isPhotoTileComplete('after')).toBe(false);
      });

      await test.step('C-TC-015: skip the photo, giving a reason', async () => {
        await coffee.openAfterPhotos();
        const modal = await coffee.isPhotoModalVisible();
        expect(modal.takePhoto).toBe(true);
        expect(modal.skipPhoto).toBe(true);

        await coffee.openSkipPhotoReasonSheet();
        expect(await coffee.isSkipPhotoReasonSheetVisible()).toBe(true);
        // Blank is rejected - the reason is what the case is about, so prove it
        // is genuinely required rather than assuming.
        expect(await coffee.isSkipPhotoSubmitEnabled()).toBe(false);

        await coffee.enterSkipPhotoReason('Camera cannot focus and take clear picture');
        await coffee.waitForSkipPhotoSubmitEnabled(true);
        await coffee.confirmSkipPhoto();
        expect(await coffee.isSkipPhotoReasonSheetVisible()).toBe(false);
      });

      await test.step('C-TC-015: the After Photos tile is now marked complete', async () => {
        // Polled: the tile repaints asynchronously once the sheet closes, and a
        // single immediate screenshot can catch it mid-transition - the same
        // class of race that produced C-TC-011's batch flake.
        await expect.poll(() => coffee.isPhotoTileComplete('after'), { timeout: 20_000 }).toBe(true);
      });
    }
  );

  // ==== C-TC-016 (regression suite "Coffee", build 0.1.90) ====
  //
  // "Driver skips Before Photo by providing a reason -> the reason should be
  // saved; And Before Photos should be marked complete with a check mark."
  //
  // C-TC-015's twin on the Before Photos tile. Same shared Skip-photo
  // component (BaseScreen.openPhotoTrigger/openSkipPhotoReasonSheet), same
  // pixel-differential for the tick, same not-self-cleaning caveat - see
  // C-TC-015's own note for the reasoning behind all three.
  //
  // The one extra clause this case carries over C-TC-015 is "the reason should
  // be SAVED". There is no read-back of a saved skip reason anywhere in the
  // UI, so what is actually asserted is that a reason was REQUIRED to proceed
  // (blank leaves Skip disabled) and that submitting one completed the tile.
  // Flagged rather than glossed: the persistence half of that clause is not
  // verifiable through the app.
  test(
    'C-TC-016: skipping Before Photos with a reason marks the tile complete',
    { tag: ['@Coffee-C-TC-016'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('Reach a Coffee stop whose Before Photos tile is still pending', async () => {
        await reachCoffeeStop(driver, 'coffee-before-photos-pending', async (c) => {
          return !(await c.isPhotoTileComplete('before'));
        }, ['Amerock', '24Hundred Marketplace']);
      });

      await test.step('C-TC-016 (baseline): the Before Photos tile shows no completion green', async () => {
        expect(await coffee.isPhotoTileComplete('before')).toBe(false);
      });

      await test.step('C-TC-016: a blank reason is rejected; a real one is accepted', async () => {
        await coffee.openBeforePhotos();
        const modal = await coffee.isPhotoModalVisible();
        expect(modal.takePhoto).toBe(true);
        expect(modal.skipPhoto).toBe(true);

        await coffee.openSkipPhotoReasonSheet();
        expect(await coffee.isSkipPhotoReasonSheetVisible()).toBe(true);
        expect(await coffee.isSkipPhotoSubmitEnabled()).toBe(false);

        // Type then clear, so "blank is rejected" is proven as a real
        // transition rather than just the field's untouched initial state.
        await coffee.enterSkipPhotoReason('Camera cannot focus and take clear picture');
        await coffee.waitForSkipPhotoSubmitEnabled(true);
        await coffee.enterSkipPhotoReason('');
        await coffee.waitForSkipPhotoSubmitEnabled(false);

        await coffee.enterSkipPhotoReason('Camera cannot focus and take clear picture');
        await coffee.waitForSkipPhotoSubmitEnabled(true);
        await coffee.confirmSkipPhoto();
        expect(await coffee.isSkipPhotoReasonSheetVisible()).toBe(false);
      });

      await test.step('C-TC-016: the Before Photos tile is now marked complete', async () => {
        await expect.poll(() => coffee.isPhotoTileComplete('before'), { timeout: 20_000 }).toBe(true);
      });
    }
  );

  // ==== C-TC-021 / C-TC-030 / C-TC-034 / C-TC-036 / C-TC-042 ====
  //
  // Five sheet rows in one test:
  //   C-TC-034  Add button enables only when mandatory fields are complete
  //   C-TC-036  all add-equipment fields present; verify / mark missing
  //   C-TC-021  card shows Name/Model/Serial/Asset (+ "Equipped Date & Time",
  //             which this build does NOT render - see the separate
  //             test.fail() case below), and status updates on Verified /
  //             Does not exist
  //   C-TC-030  search returns matching results (Completing an equipment audit)
  //   C-TC-042  search returns matching results (Equipment Audit)
  //
  // CREATES NO EQUIPMENT - that is the design, not an accident.
  //
  // The first version built its own card and deleted it afterwards, copying
  // the legacy build-0.1.76 test. Live-verified 2026-08-26 that equipment
  // cards can NO LONGER be deleted on build 0.1.90: neither the stop's seeded
  // card nor a freshly-created one reveals a delete control under the fast OR
  // the slow swipe. So a create-then-delete test cannot clean up after itself,
  // and each run permanently adds a card to a REAL customer stop. (It also
  // means deleteAllEquipment() is broken, and with it the legacy Coffee
  // equipment test's own idempotency guard - see that test at the top of this
  // file.)
  //
  // ORDER MATTERS: everything that acts on existing equipment runs FIRST, and
  // the Add Equipment form is exercised LAST, so the test simply ends on the
  // abandoned form. An earlier ordering did the form first and then tried to
  // navigate back to the card list, which failed for a subtle reason worth
  // recording: BACK out of the form raises the "complete equipment audit?"
  // confirmation, and answering Yes COMPLETES the audit and leaves the screen
  // entirely - so the card list was gone and both the list and its checklist
  // tile were unfindable afterwards.
  test(
    'C-TC-021/030/034/036/042: card details, verify/mark-missing, then Add Equipment gating and search',
    {
      tag: [
        '@Coffee-C-TC-021',
        '@Coffee-C-TC-030',
        '@Coffee-C-TC-034',
        '@Coffee-C-TC-036',
        '@Coffee-C-TC-042'
      ]
    },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      let cardName = '';
      await test.step('Reach a Coffee stop that already HAS equipment on file', async () => {
        // Precondition, not a stop name: C-TC-021 is about what an EXISTING
        // card displays, so the stop must already have one. With nothing
        // creatable-and-removable on this build, discovery is the only honest
        // way to satisfy that.
        await reachCoffeeStop(driver, 'coffee-with-equipment', async (c) => {
          await c.openEquipmentAudit();
          return (await c.getEquipmentCardCount()) > 0;
        }, ['24Hundred Marketplace', 'Amerock']);
        cardName = await coffee.getFirstEquipmentCardName();
        expect(cardName).not.toBe('');
      });

      await test.step('C-TC-021: the existing card shows Name, Model, Serial Number and Asset Number', async () => {
        const raw = await coffee.getEquipmentCardRawText(cardName);
        expect(raw).toContain('Model:');
        expect(raw).toContain('Serial Number:');
        expect(raw).toContain('Asset Number:');
        const card = await coffee.getEquipmentCardSummary(cardName);
        // Real seeded values, so assert they are POPULATED rather than
        // matching fixtures this test did not create.
        expect(card.model.length).toBeGreaterThan(0);
        expect(card.serialNumber.length).toBeGreaterThan(0);
        expect(card.assetNumber.length).toBeGreaterThan(0);
      });

      await test.step('C-TC-021/C-TC-036: marking the equipment Verified updates its status', async () => {
        await coffee.openEquipmentCard(cardName);
        await coffee.setEquipmentDoesNotExistCheckbox(false);
        await coffee.submitAddOrVerifyEquipment();
        await expect
          .poll(async () => (await coffee.getEquipmentCardSummary(cardName)).status, { timeout: 15_000 })
          .toBe('Verified');
      });

      await test.step('C-TC-021/C-TC-036: marking it "Equipment does not exist" updates its status', async () => {
        await coffee.openEquipmentCard(cardName);
        await coffee.setEquipmentDoesNotExistCheckbox(true);
        expect(await coffee.isEquipmentDoesNotExistCheckboxChecked()).toBe(true);
        await coffee.submitAddOrVerifyEquipment();
        await expect
          .poll(async () => (await coffee.getEquipmentCardSummary(cardName)).status, { timeout: 15_000 })
          .toBe('Equipment does not exist');
      });

      await test.step("Restore: set the stop's own equipment back to Verified", async () => {
        // The card belongs to the customer, not to this test. It cannot be
        // returned to a never-audited state (nothing un-audits equipment), but
        // leaving it flagged as missing would be worse than leaving it
        // verified.
        await coffee.openEquipmentCard(cardName);
        await coffee.setEquipmentDoesNotExistCheckbox(false);
        await coffee.submitAddOrVerifyEquipment();
        await expect
          .poll(async () => (await coffee.getEquipmentCardSummary(cardName)).status, { timeout: 15_000 })
          .toBe('Verified');
      });

      await test.step('C-TC-036: every Add Equipment field is present on one form', async () => {
        await coffee.openAddEquipmentFromEmptyState();
        const fields = await coffee.isAddEquipmentFormVisible();
        expect(fields.account).toBe(true);
        expect(fields.manufacturer).toBe(true);
        expect(fields.model).toBe(true);
        expect(fields.barcode).toBe(true);
        expect(fields.serialNumber).toBe(true);
        expect(fields.assetNumber).toBe(true);
        expect(fields.netTlmConnected).toBe(true);
        expect(fields.plumbed).toBe(true);
        // Photos sits BELOW THE FOLD on this build - live-verified 2026-08-26:
        // false before a scroll, true after, the row reading "Photos | Record
        // equipment condition.". Asserted after scrolling rather than reported
        // as missing: every field C-TC-034 calls mandatory
        // (Account/Manufacturer/Model) IS immediately visible, and "at once"
        // distinguishes one form from a multi-step wizard, which this is.
        await driver.executeScript('mobile: scrollGesture', [
          { left: 100, top: 600, width: 800, height: 1200, direction: 'down', percent: 0.8 }
        ]);
        await driver.pause(1_000);
        expect((await coffee.isAddEquipmentFormVisible()).photos).toBe(true);
        // MUST scroll back - the Manufacturer dropdown the next step opens is
        // above the fold, and leaving the form scrolled made an earlier run
        // fail with a misleading "Manufacturer still not displayed".
        for (let i = 0; i < 4; i++) {
          await driver.executeScript('mobile: scrollGesture', [
            { left: 100, top: 600, width: 800, height: 1200, direction: 'up', percent: 1.0 }
          ]);
        }
        await driver.pause(800);
      });

      await test.step('C-TC-034: Add equipment stays disabled until the mandatory fields are complete', async () => {
        expect(await coffee.isAddEquipmentSubmitEnabled()).toBe(false);
      });

      await test.step('C-TC-030/C-TC-042: searching a dropdown returns matching results', async () => {
        // The Manufacturer sheet, not Account: Account's matching is
        // live-verified NON-deterministic (typing "Cov" returns a different
        // set each time, including unrelated accounts), so asserting its
        // contents would be flaky by nature. Narrow, then restore via the
        // clear icon - that transition is the stable signal.
        await coffee.openAddEquipmentDropdownAndSearch('Manufacturer', 'Bun');
        const filtered = await coffee.getAddEquipmentDropdownOptionCount();
        expect(filtered).toBeGreaterThan(0);
        await coffee.clearAddEquipmentDropdownSearch();
        expect(await coffee.getAddEquipmentDropdownOptionCount()).toBeGreaterThan(filtered);
        await (await driver.$('~Bunn')).click();
      });

      await test.step('C-TC-034: completing the mandatory fields enables Add equipment', async () => {
        // Account is left as the form's own pre-filled value - the account
        // list is scoped to the ROUTE, so naming the legacy Miami test's
        // "Covista" here fails outright. Manufacturer is already set above.
        //
        // DELIBERATELY NEVER SUBMITTED: submitting would add a permanently
        // undeletable card to a real customer stop. The enable transition is
        // the whole of what C-TC-034 asks for, and the test ends here so
        // nothing has to navigate off the abandoned form.
        await coffee.selectAddEquipmentDropdownOption('Model', 'Axiom Single GPR');
        await coffee.typeAddEquipmentField('Barcode', '629104873561');
        await coffee.typeAddEquipmentField('Serial Number', '1111');
        await coffee.typeAddEquipmentField('Asset Number', '124');
        await coffee.pressKeyCode(4);
        expect(await coffee.isAddEquipmentSubmitEnabled()).toBe(true);
      });
    }
  );


  // C-TC-021's remaining clause, split out for the same reason C-TC-005 is
  // split: asserting it inside the test above under test.fail() would mask the
  // four clauses that genuinely pass.
  //
  // Live-verified 2026-08-26 that build 0.1.90 renders NO "Equipped Date &
  // Time" anywhere - not on the card
  //   ("Cafection | Model: | Galleria | Serial Number: | 1111 |
  //     Asset Number: | 124 | Recently added")
  // nor on the Equipment detail screen
  //   ("Account | ... | Manufacturer | ... | Model | ... |
  //     Net/TLM Connected | No | Plumbed | No | Verify equipment").
  // Both plausible locations were checked before concluding it is absent.
  //
  // The sheet records C-TC-021 as Pass, so this is a genuine discrepancy
  // between the sheet and the build. Asserted as INTENDED behaviour under
  // test.fail() so it flags the moment the field is added, instead of
  // asserting the current absence and going silently green forever.
  test(
    'C-TC-021 (gap): the equipment card shows an Equipped Date & Time',
    { tag: ['@Coffee-C-TC-021'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      test.fail();
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
      await prepTasks.openFromHamburgerMenu();
      await prepTasks.ensureFullDayPrepComplete();
      await home.returnToHome();

      await reachCoffeeStop(driver, 'coffee-with-equipment', async (c) => {
        await c.openEquipmentAudit();
        return (await c.getEquipmentCardCount()) > 0;
      }, ['24Hundred Marketplace', 'Amerock']);

      const name = await coffee.getFirstEquipmentCardName();
      const raw = await coffee.getEquipmentCardRawText(name);
      expect(raw).toMatch(/Equipped|Date/i);
    }
  );


  // ==== C-TC-033 (regression suite "Coffee", build 0.1.90) ====
  //
  // "Signing Order screen displays order, delivery, cost, and sign-off
  // details."
  //
  // Live-verified 2026-08-26 (Charlotte 103 / 24Hundred Marketplace) that the
  // screen matches the case only IN PART, so it is split like C-TC-005: this
  // test asserts everything that genuinely renders, and the test.fail() case
  // below carries the clauses that do not, asserting the INTENDED behaviour so
  // they flag when fixed rather than going silently green.
  //
  // Actually rendered: "Ordered Items 16", "Items Delivered 16", a Delivery
  // summary table with Ordered/Delivered columns, and a Cost summary of
  // Delivery Charge (Nontaxable) $12.00, Shipping & Handling (Taxable) $1.06,
  // Product Cost $1285.52 and Total Cost $1298.58, then the Sign Off row and a
  // disabled Continue.
  //
  // Written fresh on Charlotte 103 rather than tagged onto the legacy Delivery
  // test (@Coffee-TC206...), which reaches its stop via FedEx on Route 010 - a
  // route Anthony confirmed has no Coffee service left.
  //
  // NON-DESTRUCTIVE: never signs or submits, so the order is left as found.
  test(
    'C-TC-033: Signing Order shows items, delivery and cost summaries, sign-off, and a gated Continue',
    { tag: ['@Coffee-C-TC-033'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('Reach Signing Order on a Coffee stop that has requested deliveries', async () => {
        await reachCoffeeStop(driver, 'coffee-with-deliveries', async (c) => {
          await c.openDelivery();
          return c.isDeliveryContinueEnabled();
        }, ['24Hundred Marketplace']);
        await coffee.tapDeliveryContinue();
        expect(await coffee.isSigningOrderTitleVisible()).toBe(true);
        // Logged BEFORE any assertion so the record exists even when one
        // fails - an earlier version put this after the first assertion and
        // lost the evidence to that assertion's own failure.
        console.log(`[C-TC-033] Signing Order text: ${await coffee.getVisibleScreenText()}`);
      });

      await test.step('C-TC-033: Ordered Items and Items Delivered are displayed', async () => {
        expect(await coffee.isSummaryLineVisible('Ordered Items')).toBe(true);
        expect(await coffee.isSummaryLineVisible('Items Delivered')).toBe(true);
      });

      await test.step('C-TC-033: Delivery summary and Cost summary tables are displayed', async () => {
        expect(await coffee.isDeliverySummaryVisible()).toBe(true);
        expect(await coffee.isCostSummaryVisible()).toBe(true);
      });

      await test.step('C-TC-033: the Cost summary shows Product Cost and a total with prices', async () => {
        expect(await coffee.isSummaryLineVisible('Product Cost')).toBe(true);
        expect(await coffee.isSummaryLineVisible('Total Cost')).toBe(true);
        // Prices, not just labels - the case says these should SHOW APPLICABLE
        // PRICES, which a label-only assertion would not prove.
        expect(await coffee.isSummaryLineVisible('$')).toBe(true);
      });

      await test.step('C-TC-033: the Sign off row is displayed with its signature affordance', async () => {
        expect(await coffee.isSignOffRowVisible()).toBe(true);
      });

      await test.step('C-TC-033: Continue is disabled while no customer signature exists', async () => {
        // One-sided ON PURPOSE. Proving the other half - that Continue ENABLES
        // once signed - means permanently saving a signature to a real order,
        // which is the whole subject of C-TC-013. Asserting the gate here and
        // leaving the transition to C-TC-013 keeps this case non-destructive
        // rather than completing a customer's delivery as a side effect.
        expect(await coffee.isDeliveryContinueEnabled()).toBe(false);
      });
    }
  );

  // FAILING HALF of C-TC-033 - the clauses build 0.1.90 does not satisfy.
  //
  // Live-verified 2026-08-26 on the Signing Order screen above:
  //   - NO order number is rendered anywhere on the screen. (The legacy
  //     build-0.1.76 test asserted an order-number chip here and passed, so
  //     this is a change, not a mis-specified case. Note it is also distinct
  //     from C-TC-054, which is about the DELIVERY page.)
  //   - NO "Service Fee" line: the Cost summary lists Delivery Charge
  //     (Nontaxable) and Shipping & Handling (Taxable) instead.
  //   - NO "Tax" line at all (the only occurrences of the string are the
  //     "(Taxable)"/"(Nontaxable)" qualifiers - see isTaxLineVisible).
  //   - the total is labelled "Total Cost", NOT "Total Service Cost".
  //
  // Grouped in one test.fail() rather than four, matching C-TC-005's
  // precedent; the trade-off is that a PARTIAL fix will not flag until all
  // four land. Worth knowing when this eventually goes green.
  //
  // Related and already open with Anthony: delivery/fuel fee lines depend on
  // service location and a fix was pending, and C-TC-005 already confirmed one
  // real fee-line defect (BUG 918856) on the empty Deliveries screen.
  test(
    'C-TC-033 (gap): Signing Order shows an order number, Service Fee, Tax and Total Service Cost',
    { tag: ['@Coffee-C-TC-033'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      test.fail();
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
      await prepTasks.openFromHamburgerMenu();
      await prepTasks.ensureFullDayPrepComplete();
      await home.returnToHome();

      await reachCoffeeStop(driver, 'coffee-with-deliveries', async (c) => {
        await c.openDelivery();
        return c.isDeliveryContinueEnabled();
      }, ['24Hundred Marketplace']);
      await coffee.tapDeliveryContinue();

      expect(await coffee.isOrderNumberChipVisible()).toBe(true);
      expect(await coffee.isSummaryLineVisible('Service Fee')).toBe(true);
      expect(await coffee.isTaxLineVisible()).toBe(true);
      expect(await coffee.isSummaryLineVisible('Total Service Cost')).toBe(true);
    }
  );

  // ==== C-TC-023 / C-TC-024 / C-TC-025 (regression suite "Coffee") ====
  //
  // Three sheet rows, all Order Payment "Amount" validation on one screen:
  //   C-TC-023  empty field   -> driver may proceed, Done stays enabled
  //   C-TC-024  negatives     -> values rejected, Done stays enabled
  //   C-TC-025  valid positive-> value accepted and retained, Done stays enabled
  //
  // Grouped because reaching this screen is the expensive part (login, Start
  // Day, stop discovery, Delivery, Continue, Payment - about 50s) and all three
  // are non-destructive reads and keystrokes against the same field.
  //
  // CASH is selected deliberately: it hides Check Number (proven in C-TC-002),
  // so Amount is the only field in play and a validation error cannot be
  // mis-attributed to the mandatory Check Number that C-TC-003/C-TC-022 cover.
  //
  // NEVER SUBMITS. Done is only ever inspected, never successfully tapped, so
  // no payment is recorded against a real order. "Allow the driver to proceed"
  // in C-TC-023's wording is therefore covered as far as the Done button's own
  // enabled state - actually completing a save is C-TC-026's subject, which is
  // a real data mutation and is kept separate on purpose.
  test(
    'C-TC-023/024/025: Order Payment Amount takes positives, rejects negatives, and never gates Done',
    { tag: ['@Coffee-C-TC-023', '@Coffee-C-TC-024', '@Coffee-C-TC-025'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('Reach the Order payment screen with Cash selected', async () => {
        await reachCoffeeStop(driver, 'coffee-with-deliveries', async (c) => {
          await c.openDelivery();
          return c.isDeliveryContinueEnabled();
        }, ['24Hundred Marketplace']);
        await coffee.tapDeliveryContinue();
        await coffee.openOrderPayment();
        await coffee.choosePaymentType('Cash');
        expect(await coffee.isPaymentFieldVisible('Amount*')).toBe(true);
      });

      await test.step('C-TC-023: with Amount empty, Done stays enabled', async () => {
        await coffee.clearPaymentField('Amount*');
        // Logged because this field's "empty" is not necessarily '' - the
        // Delivered quantity field elsewhere in this suite clears to "0"
        // instead, and knowing which matters for reading the assertions below.
        console.log(`[C-TC-023] Amount after clear = "${await coffee.getPaymentFieldValue('Amount*')}"`);
        expect(await coffee.isPaymentDoneEnabled()).toBe(true);
      });

      await test.step('C-TC-025: a valid positive value is accepted and retained', async () => {
        // Amount is a CURRENCY field that fills from the RIGHT in cents.
        // Live-verified 2026-08-26: typing "10" lands as 0.1, NOT 10 - the
        // digits shift in behind two decimal places. So "$10.00" is typed as
        // "1000". Genuinely surprising, and every later payment test depends on
        // it (C-TC-026 pays $1.00 by typing "100"), which is why it is spelled
        // out here rather than hidden in a magic string.
        await coffee.typePaymentField('Amount*', '1000');
        expect(Number(await coffee.getPaymentFieldValue('Amount*'))).toBe(10);
        expect(await coffee.isPaymentDoneEnabled()).toBe(true);
        // Recorded, not asserted: the cents behaviour above is what makes the
        // raw "10" case interesting, and whether the field takes a typed
        // decimal point is not something any of these three cases states.
        await coffee.clearPaymentField('Amount*');
        await coffee.typePaymentField('Amount*', '10');
        console.log(`[C-TC-025] Amount after typing "10" = "${await coffee.getPaymentFieldValue('Amount*')}" (cents fill)`);
        await coffee.clearPaymentField('Amount*');
        await coffee.typePaymentField('Amount*', '12.34');
        console.log(`[C-TC-025] Amount after typing "12.34" = "${await coffee.getPaymentFieldValue('Amount*')}"`);
      });

      await test.step('C-TC-024: a negative is rejected on the real keypad, and Done stays enabled', async () => {
        // Live-verified 2026-08-26, and the two input paths DISAGREE:
        //   setValue("-50")    -> "-50"   (negative survives)
        //   keystrokes "-50"   -> "0.50"  (the minus is dropped; 5 and 0 fill
        //                                  in as cents, per C-TC-025's note)
        //
        // The KEYSTROKE path is the one asserted, because it is the only one a
        // driver can actually perform - and on it the app rejects the negative
        // exactly as C-TC-024 requires. setValue writes straight to the field
        // and bypasses the IME filter that does the rejecting, so its result is
        // a harness artefact, NOT a defect. Reporting one off setValue alone
        // would have been a false positive; the disagreement is recorded here
        // so the next person does not re-raise it.
        await coffee.clearPaymentField('Amount*');
        for (const ch of '-50') {
          await driver.keys(ch);
        }
        const viaKeys = await coffee.getPaymentFieldValue('Amount*');
        console.log(`[C-TC-024] keystrokes "-50" -> "${viaKeys}"`);
        expect(viaKeys.startsWith('-')).toBe(false);
        expect(Number(viaKeys)).toBeGreaterThanOrEqual(0);
        // Done is never gated on the Amount's validity - the other half of the
        // case, and true regardless of which path put the value there.
        expect(await coffee.isPaymentDoneEnabled()).toBe(true);
      });

      await test.step('Leave without saving, so no payment is recorded', async () => {
        await coffee.clearPaymentField('Amount*');
        await coffee.pressKeyCode(4);
      });
    }
  );

  // ==== C-TC-026 (regression suite "Coffee", build 0.1.90) ====
  //
  // "Payment can be saved without entering comments" -> payment details should
  // be saved successfully, and the driver should navigate back to the Signing
  // Order screen.
  //
  // THIS TEST RECORDS A REAL PAYMENT. Unlike every other Coffee C-TC written so
  // far, it cannot be undone from the app: the whole point of the case is a
  // successful save, so it commits an Amount against a live order on Charlotte
  // 103. Explicitly authorised by the user 2026-08-26. Deliberate mitigations:
  //   - CASH, so no Check Number is required and the save is the simplest
  //     possible one (see C-TC-003/C-TC-022 for the Check path's validation)
  //   - an Amount of $1.00 (typed as "100" - the field fills in cents), the
//     smallest clean value that still proves a save
  //   - it re-reads the value afterwards rather than trusting the navigation,
  //     because "navigated back" alone does not prove anything was stored
  //
  // Comments is left EMPTY on purpose - that IS the case. Its optionality is
  // asserted first, since this screen signals optional-vs-mandatory ONLY by the
  // absence of a trailing asterisk (Amount* and Check Number* carry one).
  test(
    'C-TC-026: a payment saves with Comments left empty and returns to Signing Order',
    { tag: ['@Coffee-C-TC-026'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('Reach the Order payment screen', async () => {
        await reachCoffeeStop(driver, 'coffee-with-deliveries', async (c) => {
          await c.openDelivery();
          return c.isDeliveryContinueEnabled();
        }, ['24Hundred Marketplace']);
        await coffee.tapDeliveryContinue();
        await coffee.openOrderPayment();
        // Logged so a re-run against an order that already carries a payment
        // from a previous run is readable in the output rather than confusing.
        console.log(`[C-TC-026] Amount on arrival = "${await coffee.getPaymentFieldValue('Amount*')}"`);
      });

      await test.step('C-TC-026: Comments is optional, Amount is mandatory', async () => {
        await coffee.choosePaymentType('Cash');
        expect(await coffee.isPaymentFieldOptional('Comments')).toBe(true);
        expect(await coffee.isPaymentFieldVisible('Amount*')).toBe(true);
      });

      await test.step('C-TC-026: enter an Amount, leave Comments blank, and save', async () => {
        await coffee.clearPaymentField('Amount*');
        // "100", not "1" - the field fills from the right in cents, so "1"
        // would record $0.01. See C-TC-025's own note. This records $1.00.
        await coffee.typePaymentField('Amount*', '100');
        // Read, never cleared. Unlike Amount, the Comments placeholder ("Write
        // brief about payment") shares no word with its label, so once focused
        // it cannot be re-resolved by label at all - and there is nothing to
        // clear anyway, since leaving it untouched IS the case.
        expect(await coffee.getPaymentFieldValue('Comments')).toBe('');
        expect(await coffee.isPaymentDoneEnabled()).toBe(true);
        await coffee.tapPaymentDone();
      });

      await test.step('C-TC-026: the save is accepted with no validation error', async () => {
        // Asserted BEFORE the navigation check: if the app rejected the blank
        // Comments, the error would be the real finding and "did not navigate"
        // would only be its symptom.
        expect(await coffee.isPaymentValidationErrorVisible()).toBe(false);
      });

      await test.step('C-TC-026: the driver is returned to the Signing Order screen', async () => {
        await expect.poll(() => coffee.isSigningOrderTitleVisible(), { timeout: 20_000 }).toBe(true);
        expect(await coffee.isOrderPaymentScreenVisible()).toBe(false);
      });

      await test.step('C-TC-026: the payment persisted - reopening Payment shows the saved Amount', async () => {
        // The case says "saved successfully", and navigating back does not
        // prove that on its own - the value has to still be there.
        await coffee.openOrderPayment();
        console.log(`[C-TC-026] Amount after save = "${await coffee.getPaymentFieldValue('Amount*')}"`);
        expect(Number(await coffee.getPaymentFieldValue('Amount*'))).toBe(1);
      });
    }
  );

  // ==== C-TC-054 (regression suite "Coffee") ====
  //
  // "Order number displays on Delivery page when an order exists; when the
  // driver opens a delivery with no associated order, 'No Orders' should be
  // displayed instead."
  //
  // The Coffee counterpart of Market's M-TC-004, which already proves this
  // shape on its own LOB. Both halves are asserted here on Coffee, because the
  // sub-feature row covers Coffee explicitly and a Market pass is not evidence
  // about a different LOB's screen.
  //
  // Needs TWO stops - one with a real backend order, one without - so both are
  // reached by precondition rather than by name. The no-order side is the same
  // empty-Deliveries stop C-TC-005/011/014 use, which is ad-hoc and therefore
  // has no order by design (Anthony, 2026-08-25).
  //
  // NON-DESTRUCTIVE: reads only.
  test(
    'C-TC-054: a Delivery page with no associated order states that no fills are requested',
    { tag: ['@Coffee-C-TC-054'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('C-TC-054: a stop with NO order communicates that no fills are requested', async () => {
        await reachCoffeeStopWithEmptyDeliveries(driver);
        console.log(`[C-TC-054] Deliveries text (no order): ${await coffee.getVisibleScreenText()}`);
        // Coffee's wording is "No Deliveries Requested.", NOT the "No Orders"
        // the case names - see the second gap test below. What IS true, and
        // worth guarding, is that the screen states the absence explicitly and
        // shows no order number.
        expect(await coffee.isDeliveriesEmptyStateVisible()).toBe(true);
        expect(await coffee.getDeliveryOrderNumber()).toBe('');
      });
    }
  );

  // FAILING HALF of C-TC-054 - no order number is rendered on the Delivery page.
  //
  // Live-verified 2026-08-26 on a stop with a REAL backend order (two products,
  // Ordered 8 each). The Deliveries screen's entire text is:
  //   "Deliveries | section_header_add_cta | section_header_sort_cta |
  //    Delivery Charge (Nontaxable) $12.00 | Shipping & Handling (Taxable)
  //    $1.06 | Hi-C Pop Pnk Lmnade BIB 5gal (Pkg: 1) (Price: 119.6) Ordered 8 |
  //    Texas Pete Pkts 200ct (Pkg: 1) (Price: 41.09) Ordered 8 | Continue"
  // - no order number anywhere.
  //
  // This is the SAME absence C-TC-033's gap case records on Signing Order, so
  // order numbers appear to be missing from the Coffee delivery flow generally
  // in build 0.1.90, not from one screen. Directly relevant to the delivery-
  // header question already open with Anthony.
  //
  // Asserted as INTENDED behaviour under test.fail() so it flags when fixed.
  test(
    'C-TC-054 (gap): the Delivery page shows an order number when an order exists',
    { tag: ['@Coffee-C-TC-054'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      test.fail();
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
      await prepTasks.openFromHamburgerMenu();
      await prepTasks.ensureFullDayPrepComplete();
      await home.returnToHome();

      await reachCoffeeStop(driver, 'coffee-with-deliveries', async (c) => {
        await c.openDelivery();
        return c.isDeliveryContinueEnabled();
      }, ['24Hundred Marketplace']);

      expect(await coffee.getDeliveryOrderNumber()).not.toBe('');
    }
  );

  // SECOND FAILING HALF of C-TC-054 - the "No Orders" wording.
  //
  // Kept as its own test rather than folded into the order-number gap above,
  // because they are independent defects: one is a missing value, the other a
  // missing label, and either could be fixed without the other. (C-TC-033's
  // gap groups four clauses and therefore will not flag on a partial fix -
  // avoided here.)
  //
  // Live-verified 2026-08-26: a Coffee stop with no associated order renders
  //   "Information | i | No Deliveries Requested. | This service stop doesn't
  //    have any requested fills. ..."
  // - it never uses the string "No Orders". Market's M-TC-004 asserts exactly
  // that string and passes on its own LOB, so this is a CROSS-LOB
  // INCONSISTENCY on a sheet row whose sub-feature covers both, not simply a
  // mis-specified case. Measured claim: the screen does communicate the
  // absence, so this is a labelling difference rather than a functional break.
  test(
    'C-TC-054 (gap): a Delivery page with no order shows "No Orders", as Market does',
    { tag: ['@Coffee-C-TC-054'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      test.fail();
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
      await prepTasks.openFromHamburgerMenu();
      await prepTasks.ensureFullDayPrepComplete();
      await home.returnToHome();

      await reachCoffeeStopWithEmptyDeliveries(driver);
      expect(await coffee.isSummaryLineVisible('No Orders')).toBe(true);
    }
  );

  // ==== C-TC-051 / C-TC-052 / C-TC-053 (regression suite "Coffee") ====
  //
  // Numeric entry validation on delivery product quantities:
  //   C-TC-051  malformed text  -> reject values, keep Continue disabled
  //   C-TC-052  negative numbers-> reject values, keep Continue disabled
  //   C-TC-053  valid positives -> accept values, enable Continue
  //
  // The Coffee counterparts of Market's M-TC-009/010/011. Those found the
  // Market Delivery field ACCEPTS malformed and negative input unchanged, with
  // Continue never reflecting validity - so C-TC-051/052 may well fail here
  // too. Deliberately NOT assumed: this is a different LOB and a different
  // widget (Coffee's Delivered quantity uses the app's own keypad), and the
  // Order Payment field earlier today rejected negatives on the real keypad
  // while accepting them via setValue. Evidence first.
  //
  // This run therefore LOGS the malformed/negative outcomes and asserts only
  // C-TC-053, which is already known-good from C-TC-014. The other two get
  // their assertions once the behaviour is known.
  //
  // Self-cleaning: the product added here is deleted again, restoring the empty
  // Deliveries state C-TC-005/011/014 depend on.
  test(
    'C-TC-051/052/053: delivery quantity validation - positives accepted, negatives and non-numerics rejected',
    { tag: ['@Coffee-C-TC-051', '@Coffee-C-TC-052', '@Coffee-C-TC-053'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('Reach an empty Deliveries screen and add one product to type into', async () => {
        await reachCoffeeStopWithEmptyDeliveries(driver);
        expect(await coffee.getDeliveryProductRowCount()).toBe(0);
        expect(await coffee.addFirstDeliverySearchResult('sugar')).not.toBe('');
        await driver.executeScript('mobile: pressKey', [{ keycode: 4 }]);
        await expect.poll(() => coffee.getDeliveryProductRowCount(), { timeout: 15_000 }).toBe(1);
      });

      await test.step('C-TC-053: a valid positive quantity is accepted and enables Continue', async () => {
        await coffee.setDeliveredQuantity('4');
        // Compared numerically - this field clears to "0" rather than empty, so
        // setting 4 lands as the TEXT "04".
        expect(Number(await coffee.getDeliveredQty())).toBe(4);
        expect(await coffee.isDeliveriesContinueEnabled()).toBe(true);
      });

      // Live-verified 2026-08-26 via setValue:
      //   "abc" -> "0abc", Continue DISABLED
      //   "-5"  -> "05",   Continue ENABLED
      //
      // Read carefully, both are correct behaviour, and neither is the failure
      // the sheet's wording implies:
      //
      // C-TC-051 (malformed): the app's protection is that Continue goes
      // DISABLED while the field holds something non-numeric, which is what is
      // asserted. The text landing in the field at all is a HARNESS artefact -
      // this is the app's own keypad, which has no letter keys, so no driver
      // can type "abc" here. setValue bypasses it, exactly as it bypassed the
      // Order Payment field's minus filter earlier today.
      //
      // C-TC-052 (negative): the minus IS rejected - "-5" becomes 5. Continue
      // then enabling is CORRECT, because the sanitised value is a valid
      // quantity. The sheet's "keep Continue disabled" presumes the value stays
      // invalid, which it does not; that clause is mis-specified rather than a
      // defect, so it is documented here instead of being raised against dev
      // (same call as C-TC-001's business-date wording).
      await test.step('C-TC-051: non-numeric content keeps Continue disabled', async () => {
        await coffee.setDeliveredQuantity('abc');
        const malformed = await coffee.getDeliveredQty();
        console.log(`[C-TC-051] "abc" -> "${malformed}"`);
        expect(await coffee.isDeliveriesContinueEnabled()).toBe(false);
      });

      await test.step('C-TC-052: a negative is rejected, leaving a non-negative quantity', async () => {
        await coffee.setDeliveredQuantity('-5');
        const negative = await coffee.getDeliveredQty();
        console.log(`[C-TC-052] "-5" -> "${negative}"`);
        // Mechanism-agnostic, as in C-TC-024: what matters is that the field
        // cannot end up holding a negative, not HOW that is prevented.
        expect(negative.startsWith('-')).toBe(false);
        expect(Number(negative)).toBeGreaterThanOrEqual(0);
      });

      await test.step('Cleanup: remove the added product, restoring the empty state', async () => {
        await coffee.revealDeliveryProductDelete();
        await coffee.tapRevealedDeliveryProductDelete();
        await coffee.confirmDeleteProduct();
        await coffee.waitForDeleteProductConfirmGone();
        await expect.poll(() => coffee.getDeliveryProductRowCount(), { timeout: 15_000 }).toBe(0);
      });
    }
  );

  // ==== C-TC-027 / C-TC-031 (regression suite "Coffee") ====
  //
  //   C-TC-027  Presale Continue is disabled until at least one product is
  //             added, then becomes enabled
  //   C-TC-031  Search returns matching products, and the selected product's
  //             details appear on the parent screen
  //
  // One test because C-TC-031's search happens INSIDE the very order whose
  // existence flips C-TC-027's Continue - running them apart would mean saving
  // and deleting a presale twice for no gain.
  //
  // SELF-CLEANING, and that is what makes the C-TC-027 assertion meaningful:
  // it asserts Continue disabled, creates an order, asserts Continue enabled,
  // then DELETES the order and asserts Continue is disabled once more. The
  // round trip proves the gate actually tracks the order rather than happening
  // to be in the right state - and it leaves the stop's Pre-sales empty, which
  // is the precondition C-TC-007 depends on.
  test(
    'C-TC-027/031: presale search shows matching products, and Continue tracks whether an order exists',
    { tag: ['@Coffee-C-TC-027', '@Coffee-C-TC-031'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      let baseline = 0;
      await test.step('Reach a Coffee stop whose Pre-sales screen has no saved order', async () => {
        // Precondition, not a stop name - and it has to be the EMPTY state,
        // since "Continue is disabled" is only meaningful before any order
        // exists.
        await reachCoffeeStop(driver, 'coffee-empty-presales', async (c) => {
          await c.tapAddPresaleTrigger();
          return c.isPresalesEmptyStateVisible();
        }, ['24Hundred Marketplace', 'Amerock']);
        baseline = await coffee.getSavedPresaleCount();
        expect(baseline).toBe(0);
      });

      await test.step('C-TC-027: Continue is disabled while no product has been added', async () => {
        expect(await coffee.isPresalesContinueEnabled()).toBe(false);
      });

      await test.step('C-TC-031: searching returns matching products', async () => {
        await coffee.openAddPresalesOrder();
        await coffee.typeAddPresalesProduct('sugar');
        // The results populate asynchronously, so poll rather than read once -
        // the same race that produced C-TC-011's batch flake.
        await expect.poll(() => coffee.getPresaleSearchResultCount(), { timeout: 15_000 }).toBeGreaterThan(0);
      });

      await test.step("C-TC-031: the selected product's details appear on the Add Presale form", async () => {
        const chosen = await coffee.selectFirstPresaleSearchResult();
        expect(chosen).not.toBe('');
        await coffee.dismissPresaleKeypadIfPresent();
        const onForm = await coffee.getPresaleFormProductHint();
        console.log(`[C-TC-031] search result "${chosen}" -> form row "${onForm}"`);
        // Asserted on the DETAILS, not the name: the two screens use different
        // name forms for the same product (see getPresaleFormProductHint), so a
        // verbatim name match would fail on a correctly added product.
        expect(onForm).toContain('SKU');
        expect(onForm).toContain('Qty');
      });

      await test.step('C-TC-027: saving the order enables Continue', async () => {
        await coffee.selectFirstAvailableDeliveryDate();
        expect(await coffee.isAddPresalesSaveEnabled()).toBe(true);
        await coffee.saveAddPresalesOrder();
        await expect.poll(() => coffee.getSavedPresaleCount(), { timeout: 15_000 }).toBe(baseline + 1);
        expect(await coffee.isPresalesContinueEnabled()).toBe(true);
      });

      await test.step('C-TC-027: deleting the order disables Continue again', async () => {
        // The other half of the gate, and the cleanup in one - see this test's
        // own header on why the round trip matters.
        await coffee.revealSavedPresaleDelete();
        await coffee.tapRevealedSavedPresaleDelete();
        expect(await coffee.isDeletePresaleConfirmVisible()).toBe(true);
        await coffee.confirmDeletePresale();
        await coffee.waitForDeletePresaleConfirmGone();
        await expect.poll(() => coffee.getSavedPresaleCount(), { timeout: 15_000 }).toBe(baseline);
        expect(await coffee.isPresalesContinueEnabled()).toBe(false);
      });
    }
  );

  // ==== C-TC-013 / C-TC-020 / C-TC-032 / C-TC-041 / C-TC-043 / C-TC-049 ====
  //
  // THE DESTRUCTIVE BATCH. Everything here permanently completes work on a real
  // Charlotte 103 stop and CANNOT be undone from the app.
  //
  //   C-TC-013  save a signature, tap Continue, Delivery marked complete
  //   C-TC-032  Signing Order completes with NO payment entered
  //   C-TC-041  the Coffee service completes without any photos attached
  //   C-TC-020  Equipment Audit stays optional and does not block completion
  //   C-TC-049  the service station shows a green tick and full progress
  //   C-TC-043  Complete Stop navigates to the Schedule screen
  //
  // ONE test, deliberately. These are six facets of a SINGLE irreversible
  // journey - sign off, complete the delivery, complete the station, complete
  // the stop - so splitting them would burn six stops to learn what one can
  // show. The sheet itself treats the same walk as end-to-end cases
  // (C-TC-038/039/040).
  //
  // FAIL-SAFE ORDERING. Every read-only assertion and every log happens BEFORE
  // the first irreversible tap, so a wrong assumption about the UI costs a run
  // but NOT a stop. The first destructive action is submitSignOff().
  //
  // STOP CHOICE. It deliberately avoids whichever stop the rest of the suite
  // cached as 'coffee-with-deliveries', because completing that one would pull
  // the precondition out from under eight other tests. Runtime discovery would
  // recover, but slowly and confusingly.
  test(
    'C-TC-013/020/032/041/049: sign off, complete the delivery, and the station',
    {
      tag: [
        '@Coffee-C-TC-013',
        '@Coffee-C-TC-020',
        '@Coffee-C-TC-032',
        '@Coffee-C-TC-041',
        '@Coffee-C-TC-049'
      ]
    },
    async ({ driver }) => {
      test.setTimeout(1_200_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      let stopName = '';
      await test.step('Reach a Coffee stop with deliveries, avoiding the one other tests rely on', async () => {
        // NO preferred list on purpose. An earlier version filtered out
        // whichever stop the cache held for 'coffee-with-deliveries', which
        // does nothing when this test runs in ISOLATION - the cache is
        // process-scoped and empty, so the filter removed nothing and the run
        // completed the very stop eight other tests depend on. Letting
        // discovery scan means it lands on whatever stop qualifies, rather than
        // preferring the shared one by name.
        stopName = await reachCoffeeStop(
          driver,
          'coffee-to-complete',
          async (c) => {
            // TWO conditions, and the second matters as much as the first: the
            // stop must have deliveries AND be UNWORKED. An earlier run signed
            // off on 24Hundred Marketplace without finishing, and because that
            // stop is simply first in scan order, discovery kept returning to
            // it - so the run failed on its own baseline instead of finding a
            // clean stop. Requiring "Delivery not already complete" makes
            // discovery skip any partially-worked stop by itself, which is
            // more robust than naming stops to avoid.
            await c.openDelivery();
            if (!(await c.isDeliveryContinueEnabled())) {
              return false;
            }
            await c.pressKeyCode(4);
            await driver.pause(1_500);
            // "Complete Delivery" still present == the service is NOT yet
            // finished. This replaces an earlier check on the Delivery TILE's
            // green, which was semantically wrong: the tile turns green once
            // the order is SIGNED, well before the service is complete, so it
            // rejected a stop that was still perfectly workable and the scan
            // then exhausted itself having skipped the only viable candidate.
            return c.isVisible('~Complete Delivery');
          },
          []
        );
        console.log(`[DESTRUCTIVE] completing stop "${stopName}"`);
      });

      await test.step('C-TC-041/C-TC-020 (baseline): photos and Equipment audit are NOT complete', async () => {
        // Recorded BEFORE anything is completed - this baseline is the whole
        // basis for C-TC-041 and C-TC-020. Without it, "completed without
        // photos" could not be distinguished from "photos happened to be done".
        // Already on the checklist - the qualifier above leaves us here.
        console.log(`[DESTRUCTIVE] checklist before completion: ${await coffee.getVisibleScreenText()}`);
        expect(await coffee.isChecklistTileComplete('Before Photos')).toBe(false);
        expect(await coffee.isChecklistTileComplete('After Photos')).toBe(false);
        expect(await coffee.isChecklistTileComplete('Equipment audit')).toBe(false);
        // The service itself is not yet complete. Asserted via the Complete
        // Delivery button rather than the Delivery tile's colour, for the
        // reason given in the qualifier above - green there means "signed".
        expect(await coffee.isVisible('~Complete Delivery')).toBe(true);
      });

      await test.step('Reach Signing Order (still reversible up to this point)', async () => {
        await coffee.openDelivery();
        expect(await coffee.isDeliveryContinueEnabled()).toBe(true);
        await coffee.tapDeliveryContinue();
        expect(await coffee.isSigningOrderTitleVisible()).toBe(true);
      });

      await test.step('C-TC-032: no payment is entered, and Continue is still gated only by the signature', async () => {
        // The payment row exists and is left alone - that IS the case. Anthony
        // confirmed Payment is NOT mandatory; only Sign off gates Continue.
        expect(await coffee.isSummaryLineVisible('Payment')).toBe(true);
        expect(await coffee.isDeliveryContinueEnabled()).toBe(false);
      });

      // ---- everything below this line is IRREVERSIBLE ----
      await test.step('C-TC-013: sign off, and Continue becomes enabled', async () => {
        // Tolerant of an ALREADY-SIGNED order, and that is not defensive
        // padding - it is forced by the data. Charlotte 103/YESTERDAY appears
        // to have exactly one Coffee stop with requested deliveries, and an
        // earlier run of this very test signed it before failing further on.
        // Re-signing it does NOT re-enable Sign off: the pad accepts a stroke
        // (confirmed by screenshot) yet the button stays greyed through a 20s
        // poll. That behaviour is close to C-TC-018 - "editing a signed
        // delivery ... clears signature status" - which the sheet itself
        // records as Fail, so it is very likely the same defect rather than a
        // scripting problem.
        //
        // So: sign when the order is unsigned (the real C-TC-013 path), and
        // when it is already signed, skip and say so. The remaining cases in
        // this walk do not depend on who signed.
        if (await coffee.isDeliveryContinueEnabled()) {
          console.log('[DESTRUCTIVE] order already signed - skipping the signature (see C-TC-018)');
          return;
        }
        await coffee.openSignOff();
        expect(await coffee.isSignOffEnabled()).toBe(false);
        await coffee.drawSignature();
        await expect.poll(() => coffee.isSignOffEnabled(), { timeout: 20_000 }).toBe(true);
        await coffee.submitSignOff();
        await expect.poll(() => coffee.isDeliveryContinueEnabled(), { timeout: 20_000 }).toBe(true);
      });

      await test.step('C-TC-013/C-TC-032: Continue completes the order with no payment recorded', async () => {
        await coffee.tapDeliveryContinue();
        await driver.pause(2_500);
        console.log(`[DESTRUCTIVE] after Continue: ${await coffee.getVisibleScreenText()}`);
      });

      await test.step('C-TC-013: the signed order is reflected on the Coffee menu', async () => {
        // The tile turning green here means SIGNED. Completion proper is
        // asserted further down via the station's own progress, which is the
        // unambiguous signal - an earlier run passed this step while progress
        // was still 0.
        await expect.poll(() => coffee.isChecklistTileComplete('Delivery'), { timeout: 20_000 }).toBe(true);
      });

      await test.step('C-TC-041/C-TC-020: no photos and no equipment audit were required', async () => {
        // Still not complete, yet the delivery went through - which is exactly
        // what these two cases assert.
        expect(await coffee.isChecklistTileComplete('Before Photos')).toBe(false);
        expect(await coffee.isChecklistTileComplete('After Photos')).toBe(false);
        expect(await coffee.isChecklistTileComplete('Equipment audit')).toBe(false);
      });

      await test.step('C-TC-013/C-TC-049: Complete Delivery finishes the service', async () => {
        // Live-verified 2026-08-26 and MISSED by the first attempt: signing off
        // and tapping Continue returns to the CHECKLIST, where a "Complete
        // Delivery" button still waits. Until it is tapped the service is not
        // finished and the station's progress stays at 0 - which is exactly how
        // that first run failed, with a green-looking Delivery tile but 0%
        // progress. The tile turning green after sign-off is real but means
        // "signed", not "service complete".
        expect(await coffee.isVisible('~Complete Delivery')).toBe(true);
        await coffee.tap('~Complete Delivery');
        await driver.pause(3_000);
        console.log(`[DESTRUCTIVE] after Complete Delivery: ${await coffee.getVisibleScreenText()}`);
      });

      await test.step('C-TC-049: the service station shows a green tick and full progress', async () => {
        // NO back press. "Complete Delivery" already lands on the stop detail -
        // its own log line shows "coffee | 1 Service stations | 100". An
        // earlier version pressed BACK here and EXITED THE APP INTO GOOGLE
        // MAPS, because C-TC-045 leaves Maps in the activity back stack, so
        // backing out of our last screen reveals it. Two lessons in one: do not
        // navigate when already on the target screen, and a test that hands off
        // to an external app leaves it behind in the stack even after
        // activateApp brings ours back to the front.
        await driver.pause(2_000);
        console.log(`[DESTRUCTIVE] stop detail: ${await coffee.getVisibleScreenText()}`);
        expect(await dashboard.getServiceStationProgress('coffee')).toBe(100);
        expect(await dashboard.isNthServiceStationComplete('coffee', 'first')).toBe(true);
      });

      await test.step('C-TC-020: the stop itself completed, with the Equipment Audit skipped', async () => {
        // CORRECTED 2026-08-28. This step used to assert that "Complete Stop"
        // was visible and enabled, and failed because on a SINGLE-station stop
        // that button does not exist at all - completing the only station
        // completes the stop by itself. (See DashboardScreen's own note: the
        // button appears on stops with 2+ stations under one LOB, and stays
        // disabled until every station is actioned.)
        //
        // That was the wrong instrument rather than a real gap. C-TC-020 asks
        // that "the service stop should complete without a blocking validation
        // for the skipped audit" - it says nothing about a button. So the
        // assertion is now the outcome itself: the stop moves to Completed,
        // with the Equipment Audit still untouched.
        expect(await coffee.isChecklistTileComplete('Equipment audit')).toBe(false);
        await home.returnToHome();
        await dashboard.openCompletedTab();
        await expect
          .poll(() => dashboard.isStopListedOnCurrentTab(stopName), { timeout: 30_000 })
          .toBe(true);
        console.log(`[DESTRUCTIVE] "${stopName}" is listed under Completed`);
      });
    }
  );

  // ==== C-TC-050 (regression suite "Coffee") ====
  //
  // "Driver views stops and navigates to stop preview" - pending stops listed;
  // tapping one shows the Stop Preview with Date, Location and Service Type.
  //
  // Read-only, and deliberately independent of the delivery flow, so it is
  // unaffected by the stop this session's destructive batch damaged.
  test(
    'C-TC-050: pending stops are listed, and opening one shows its Stop Preview',
    { tag: ['@Coffee-C-TC-050'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      let stopName = '';
      await test.step('C-TC-050: a Coffee stop is listed and can be opened', async () => {
        // Discovered, never named - the schedule is volatile (49 -> 157 stops
        // in a day), so the assertion is that SOME Coffee stop is listed and
        // reachable, which is what the case actually claims.
        stopName = await reachCoffeeStop(driver, 'any-coffee', async () => true, []);
        expect(stopName).not.toBe('');
        console.log(`[C-TC-050] opened stop "${stopName}"`);
      });

      await test.step('C-TC-050: the Stop Preview shows Date, Location and Service Type', async () => {
        await coffee.pressKeyCode(4);
        await driver.pause(2_000);
        const preview = await coffee.getVisibleScreenText();
        console.log(`[C-TC-050] stop preview: ${preview}`);
        expect(await dashboard.isStopOverviewVisible()).toBe(true);
        // Location - read from the screen, NOT from getStopHeaderText(): that
        // helper returns the position badge ("Stop 1 of 48"), not the location
        // name, despite its name suggesting otherwise. dashboard.screen.ts
        // already carries a correction noting the same mismatch went uncaught
        // once because the old assertion only checked length > 0.
        expect(preview).toContain(stopName);
        // The address is part of "Location" too, and is what distinguishes a
        // real preview from a bare title.
        expect(preview).toMatch(/\d+\s+\w+/);
        // Service Type - the LOB card. Coffee is the one we navigated in on.
        expect(await dashboard.isLobCardVisible('coffee')).toBe(true);
        // Date - matched on the Stop Preview's OWN rendering ("August 25,2026"),
        // not via isDateRouteHeaderVisible(). That helper looks for the service
        // screens' "25 Aug 2026 | Route 103" chip, which this screen does not
        // have: it formats the date differently and carries no route chip at
        // all. Asserting the shared chip here failed on a screen that plainly
        // shows its date. The route is not part of what C-TC-050 asks for
        // (Date, Location, Service Type), so it is not asserted.
        expect(preview).toMatch(/[A-Z][a-z]+\s+\d{1,2},\s*\d{4}/);
      });
    }
  );

  // ==== C-TC-029 (regression suite "Coffee") ====
  //
  // "Scanning or re-adding an existing product increments quantity instead of
  // duplicating" - quantity up by one, product moves to the top, no duplicate
  // line.
  //
  // The scan half is not automatable (no scanner mechanism in this suite - the
  // same blocker as C-TC-014's own note); re-adding by search is the path a
  // scan result feeds into anyway.
  //
  // TWO products are added on purpose: "moves to the top" is unobservable with
  // one row. Runs on the empty-Deliveries stop and deletes both afterwards, so
  // it is self-cleaning and never touches the damaged stop.
  test(
    'C-TC-029: re-adding a product increments it and moves it to the top, without duplicating',
    { tag: ['@Coffee-C-TC-029'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      let productA = '';
      let rowA = '';
      let qtyABefore = 0;
      await test.step('Reach an empty Deliveries screen and add two different products', async () => {
        await reachCoffeeStopWithEmptyDeliveries(driver);
        expect(await coffee.getDeliveryProductRowCount()).toBe(0);
        productA = await coffee.addDeliverySearchResultAt('sugar', 0);
        await driver.executeScript('mobile: pressKey', [{ keycode: 4 }]);
        await expect.poll(() => coffee.getDeliveryProductRowCount(), { timeout: 15_000 }).toBe(1);
        // Captured while it is the ONLY row, which is the one moment its row
        // label is unambiguous. Tracking the product by this label rather than
        // by name is essential: the search result calls it "Canteen Granulated
        // Sugar Canister" while the row calls it "CanteenSugrCanister20oz", so
        // a name match fails on a correctly added product - the same trap
        // documented on Pre-sales, which this test walked straight into first
        // time round.
        rowA = (await coffee.getDeliveryProductRowTexts())[0];
        await coffee.addDeliverySearchResultAt('sugar', 1);
        await driver.executeScript('mobile: pressKey', [{ keycode: 4 }]);
        await expect.poll(() => coffee.getDeliveryProductRowCount(), { timeout: 15_000 }).toBe(2);
        const rowsBefore = await coffee.getDeliveryProductRowTexts();
        const qtysBefore = await coffee.getAllDeliveredQtyValues();
        qtyABefore = Number(qtysBefore[rowsBefore.indexOf(rowA)] ?? '0');
        console.log(`[C-TC-029] product A = "${productA}" -> row "${rowA}" qty ${qtyABefore}`);
        console.log(`[C-TC-029] rows before re-add: ${JSON.stringify(rowsBefore)}`);
        console.log(`[C-TC-029] qtys before re-add: ${JSON.stringify(qtysBefore)}`);
      });

      await test.step('C-TC-029: re-adding the first product does not create a duplicate row', async () => {
        await coffee.addDeliverySearchResultAt('sugar', 0);
        await driver.executeScript('mobile: pressKey', [{ keycode: 4 }]);
        const rows = await coffee.getDeliveryProductRowTexts();
        console.log(`[C-TC-029] rows after re-add: ${JSON.stringify(rows)}`);
        console.log(`[C-TC-029] qtys after re-add: ${JSON.stringify(await coffee.getAllDeliveredQtyValues())}`);
        // The headline clause: still two rows, not three.
        expect(rows.length).toBe(2);
      });

      await test.step('C-TC-029: the re-added product moved to the top, with its quantity up by one', async () => {
        const rows = await coffee.getDeliveryProductRowTexts();
        const qtys = await coffee.getAllDeliveredQtyValues();
        // Identity, not name - rowA was captured when it was the only row.
        expect(rows[0]).toBe(rowA);
        expect(Number(qtys[0])).toBe(qtyABefore + 1);
      });

      await test.step('Cleanup: remove both products, restoring the empty state', async () => {
        for (let i = 0; i < 2; i++) {
          await coffee.revealRowDeleteResilient('//android.view.View[contains(@content-desc,"Pkg:")]');
          await coffee.tapRevealedDeliveryProductDelete();
          await coffee.confirmDeleteProduct();
          await coffee.waitForDeleteProductConfirmGone();
        }
        await expect.poll(() => coffee.getDeliveryProductRowCount(), { timeout: 15_000 }).toBe(0);
      });
    }
  );

  // ==== C-TC-047 (regression suite "Coffee") ====
  //
  // "Keypad arrows move only between editable product quantity fields" - focus
  // should move to the next EDITABLE quantity field, and not to a read-only
  // ordered quantity or an unrelated button.
  //
  // COFFEE'S KEYPAD HAS NO SUCH ARROWS. Live-verified 2026-08-26 by probing
  // every control on the app's own Deliveries keypad, which is: digits 1-9 and
  // 0, "-", "+", and four UNLABELLED buttons down the right-hand column at
  // x=799. With two product rows on screen and focus on the first, each of the
  // four was tapped in turn:
  //     side control #0: focus 0 -> -1   (focus lost)
  //     side control #1: focus 0 -> -1   (focus lost)
  //     side control #2: focus 0 ->  0   (unchanged)
  //     side control #3: focus 0 ->  0   (unchanged)
  // Not one moves focus to the next field. (-1 means focus left the editable
  // quantity fields entirely.)
  //
  // The sheet's sub-feature for this row is "Vending/Market/coffee", so the
  // arrows may well exist on another LOB's keypad - this says nothing about
  // Vending. On COFFEE the premise does not hold.
  //
  // Written as test.fail() asserting the INTENDED behaviour, not as a passing
  // test asserting today's absence: the latter would go silently green forever
  // and never tell us arrows had been added. Same convention as C-TC-005,
  // C-TC-033 and C-TC-054.
  //
  // Distinguishing the focused field NEEDS getFocusedDeliveredQtyIndex(), not
  // getFocusedFieldHint(): every quantity field shares the hint "Delivered",
  // so the hint is identical for all of them and cannot answer this question.
  test(
    'C-TC-047 (gap): a keypad control moves focus to the next editable quantity field',
    { tag: ['@Coffee-C-TC-047'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      test.fail();
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
      await prepTasks.openFromHamburgerMenu();
      await prepTasks.ensureFullDayPrepComplete();
      await home.returnToHome();

      await reachCoffeeStopWithEmptyDeliveries(driver);
      // Self-healing start. An earlier probe run navigated away mid-flow and
      // left its two products stranded here, which would otherwise break both
      // this test and C-TC-005/011/014's empty-Deliveries precondition.
      if ((await coffee.getDeliveryProductRowCount()) > 0) {
        await coffee.deleteAllDeliveryProducts();
      }

      await coffee.addDeliverySearchResultAt('sugar', 0);
      await driver.executeScript('mobile: pressKey', [{ keycode: 4 }]);
      await coffee.addDeliverySearchResultAt('sugar', 1);
      await driver.executeScript('mobile: pressKey', [{ keycode: 4 }]);
      await expect.poll(() => coffee.getDeliveryProductRowCount(), { timeout: 15_000 }).toBe(2);

      await coffee.focusDeliveredQty(0);
      await driver.pause(1_000);
      expect(await coffee.getFocusedDeliveredQtyIndex()).toBe(0);

      const controls = await coffee.getKeypadSideControls();
      let movedToNext = false;
      for (let i = 0; i < controls.length && !movedToNext; i++) {
        await coffee.focusDeliveredQty(0);
        await driver.pause(800);
        await controls[i].click();
        await driver.pause(1_000);
        movedToNext = (await coffee.getFocusedDeliveredQtyIndex()) === 1;
      }

      // CLEAN UP BEFORE ASSERTING. This is a test.fail() case, so the assertion
      // below ends the test - anything after it would never run, and the two
      // products added here would be left stranded on the very stop whose
      // EMPTY Deliveries state C-TC-005/011/014 depend on. (An earlier version
      // did exactly that.) Tolerant, because the probe taps unlabelled controls
      // and can navigate away.
      await driver.executeScript('mobile: pressKey', [{ keycode: 4 }]);
      await driver.pause(1_000);
      await coffee.deleteAllDeliveryProducts().catch(() => undefined);
      console.log(`[C-TC-047] rows left behind = ${await coffee.getDeliveryProductRowCount()}`);

      expect(movedToNext).toBe(true);
    }
  );

  // ==== C-TC-019 (regression suite "Coffee") ====
  //
  // "Equipment Audit remains optional after app relaunch."
  //
  // The relaunch is the whole point, so it is a REAL restart:
  // BaseScreen.relaunchApp() terminates and reactivates the app in-session.
  // Deliberately NOT `pm clear` - that is the fixture's cold-start path and
  // would wipe the login; "after relaunch" means restarted, not reinstalled.
  //
  // What "optional" is asserted by: the checklist groups Equipment audit under
  // its own "Optional" heading (live-verified in the checklist dump:
  // "... | Optional | Before Photos ... | Equipment audit | Audit machine(s) |
  // ..."), and the tile is not complete. The stronger claim - that the stop can
  // be COMPLETED with the audit skipped - is C-TC-020, which is parked because
  // it needs a completable stop.
  //
  // Read-only: it opens no audit and completes nothing, so it is unaffected by
  // the stop damaged earlier in this session.
  test(
    'C-TC-019: Equipment Audit is still optional after the app is relaunched',
    { tag: ['@Coffee-C-TC-019'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      let stopName = '';
      let before = '';
      await test.step('C-TC-019 (before): Equipment audit is present and optional', async () => {
        stopName = await reachCoffeeStop(driver, 'any-coffee', async () => true, []);
        // Polled for the same reason as the post-relaunch read below: the
        // checklist's TILES render after its title and Complete Delivery
        // button, so an immediate read can return only
        // "25 Aug 2026 | Route 103 | <stop> | Complete Delivery" - which looks
        // like the tiles are missing rather than merely late.
        await expect
          .poll(() => coffee.getVisibleScreenText(), { timeout: 30_000 })
          .toContain('Equipment audit');
        before = await coffee.getVisibleScreenText();
        console.log(`[C-TC-019] stop "${stopName}" checklist BEFORE relaunch: ${before}`);
        expect(before).toContain('Optional');
        expect(await coffee.isChecklistTileComplete('Equipment audit')).toBe(false);
      });

      await test.step('Relaunch the app', async () => {
        await coffee.relaunchApp();
      });

      await test.step('C-TC-019 (after): the same stop still shows Equipment audit as optional', async () => {
        // Re-navigate from scratch - a relaunch drops us wherever the app
        // restores to, which is not guaranteed to be the checklist.
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await home.returnToHome();
        expect(await dashboard.scrollToAndClickLocationByName(stopName)).toBe(true);
        await dashboard.openFirstServiceStation('coffee');

        // POLLED, not read once. A relaunch leaves the accessibility tree empty
        // for a beat while the checklist renders - the first attempt read ""
        // here and failed, while a screenshot taken moments later showed the
        // screen fully drawn. Waiting for the tree to populate is the fix.
        await expect
          .poll(() => coffee.getVisibleScreenText(), { timeout: 30_000 })
          .toContain('Equipment audit');
        const after = await coffee.getVisibleScreenText();
        console.log(`[C-TC-019] checklist AFTER relaunch: ${after}`);
        expect(after).toContain('Optional');
        expect(await coffee.isChecklistTileComplete('Equipment audit')).toBe(false);
      });
    }
  );

  // ==== C-TC-037 (regression suite "Coffee") ====
  //
  // "Each delivery location displays its own address by service line" - the
  // Coffee delivery location should show its own delivery address.
  //
  // Read-only. Asserted on the Stop Preview, where the address sits alongside
  // the LOB card - live-observed as
  //   "... | 24Hundred Marketplace | 2400 Yorkmont Rd Charlotte North Carolina
  //    28217-4511 | About this location | ... | coffee | 1 Service stations"
  //
  // NOT asserted via dashboard.getStopHeaderText(): that returns the position
  // badge ("Stop 1 of 48"), not the location or address - a mismatch
  // dashboard.screen.ts already carries a correction about, and one C-TC-050
  // tripped over.
  test(
    'C-TC-037: the Coffee delivery location shows its own address on the Stop Preview',
    { tag: ['@Coffee-C-TC-037'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      let stopName = '';
      await test.step('Open a Coffee stop and return to its Stop Preview', async () => {
        stopName = await reachCoffeeStop(driver, 'any-coffee', async () => true, []);
        await coffee.pressKeyCode(4);
        await expect
          .poll(() => coffee.getVisibleScreenText(), { timeout: 30_000 })
          .toContain('About this location');
      });

      await test.step('C-TC-037: the stop shows its own address, against its Coffee service line', async () => {
        const preview = await coffee.getVisibleScreenText();
        console.log(`[C-TC-037] stop preview: ${preview}`);
        // The location it belongs to.
        expect(preview).toContain(stopName);
        // A real street address - number followed by a street name, then a
        // postal code. Matched by SHAPE, not by a literal: the address is real
        // customer data and differs per stop, so hardcoding one would make this
        // test a fixture check rather than a behaviour check.
        expect(preview).toMatch(/\d+\s+[A-Za-z].*\d{5}/);
        // "by service line" - the address is presented on the same preview as
        // the Coffee LOB card, which is what ties address to service line.
        expect(await dashboard.isLobCardVisible('coffee')).toBe(true);
      });
    }
  );

  // ==== C-TC-028 (regression suite "Coffee") ====
  //
  // "Product SKU is displayed beneath the product name."
  //
  // Read-only and self-cleaning: it opens the Add Product search, reads the
  // result rows, and closes the sheet WITHOUT selecting anything, so no product
  // is ever added.
  //
  // Where the SKU actually appears is evidence-led rather than assumed. It is
  // known to be present on the Add PRESALE form's product row (live-captured:
  // "A&WZeroSugarRtBeer 20oz | SKU : 6217 | pkg: 1 | Qty"), but the Deliveries
  // SEARCH RESULT rows were only ever seen as "... (20oz) - pkg: 1", with no
  // SKU in the captures taken so far. So this dumps the rows first and asserts
  // on what is really there - the case says SKU shows beneath the NAME, which
  // is a claim about the product LIST, not about a form field.
  test(
    "C-TC-028: a product's SKU is displayed with its name in the product list",
    { tag: ['@Coffee-C-TC-028'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('Open the Deliveries product search', async () => {
        await reachCoffeeStopWithEmptyDeliveries(driver);
        await coffee.openAddDeliveryProduct();
        await coffee.searchDeliveryProductOption('sugar');
        await expect.poll(() => coffee.getPresaleSearchResultCount(), { timeout: 15_000 }).toBeGreaterThan(0);
      });

      await test.step('C-TC-028: each result row carries the SKU alongside the product name', async () => {
        const rows = await coffee.getDeliveryProductRowTexts();
        const results = await coffee.getVisibleScreenText();
        console.log(`[C-TC-028] search result rows: ${JSON.stringify(rows)}`);
        console.log(`[C-TC-028] search sheet text: ${results}`);
        expect(results).toContain('SKU');
      });
    }
  );

  // ==== C-TC-017 (regression suite "Coffee") ====
  //
  // "Driver skips or completes Pre-sales activity via Back arrow confirmation"
  // - the sheet describes a Complete Pre-sale pop-up on Back, with "Skip
  // pre-sale" and "Complete" branches.
  //
  // THAT POP-UP DOES NOT APPEAR IN BUILD 0.1.90. Live-verified 2026-08-26 on
  // both paths: BACK on an EMPTY Pre-sales screen exits silently, and BACK with
  // a SAVED ORDER lands straight on the checklist -
  //   "25 Aug 2026 | Route 103 | 24Hundred Marketplace | Optional | Before
  //    Photos ... | Add Presale ... | Signing Order ... | Complete Delivery"
  // with no prompt in the tree at all. (home.screen.ts still carries a comment
  // describing that pop-up, which returnToHome tolerates - evidently stale.
  // Anthony confirmed the analogous Delivery -> Signing Order Yes/No confirm
  // was REMOVED at customer request, so this looks like the same change.)
  //
  // The activity IS completable - just not that way. The Pre-sales screen's own
  // Continue enables once an order exists (proven in C-TC-027), and that is the
  // real path, asserted below. The missing pop-up is carried as its own
  // test.fail() gap so it flags if reinstated.
  //
  // Self-cleaning: the presale created here is deleted at the end.
  test(
    'C-TC-017: a saved presale can be completed from the Pre-sales screen, marking the tile done',
    { tag: ['@Coffee-C-TC-017'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('Reach a Coffee stop whose Pre-sales is empty, and add an order', async () => {
        await reachCoffeeStop(driver, 'coffee-empty-presales', async (c) => {
          await c.tapAddPresaleTrigger();
          return c.isPresalesEmptyStateVisible();
        }, ['24Hundred Marketplace', 'Amerock']);
        expect(await coffee.isPresalesContinueEnabled()).toBe(false);

        await coffee.openAddPresalesOrder();
        await coffee.typeAddPresalesProduct('sugar');
        expect(await coffee.selectFirstPresaleSearchResult()).not.toBe('');
        await coffee.dismissPresaleKeypadIfPresent();
        await coffee.selectFirstAvailableDeliveryDate();
        await coffee.saveAddPresalesOrder();
        await expect.poll(() => coffee.getSavedPresaleCount(), { timeout: 15_000 }).toBe(1);
      });

      await test.step('C-TC-017: Continue completes the Pre-sales activity', async () => {
        expect(await coffee.isPresalesContinueEnabled()).toBe(true);
        await coffee.tap('~Continue');
        await expect
          .poll(() => coffee.getVisibleScreenText(), { timeout: 30_000 })
          .toContain('Add Presale');
      });

      await test.step('C-TC-017: Add presale is marked complete on the checklist', async () => {
        await expect.poll(() => coffee.isChecklistTileComplete('Add Presale'), { timeout: 20_000 }).toBe(true);
      });

      await test.step('Cleanup: delete the presale created here', async () => {
        await coffee.tapAddPresaleTrigger();
        await driver.pause(2_000);
        if ((await coffee.getSavedPresaleCount()) > 0) {
          await coffee.revealSavedPresaleDelete();
          await coffee.tapRevealedSavedPresaleDelete();
          await coffee.confirmDeletePresale();
          await coffee.waitForDeletePresaleConfirmGone();
        }
        await expect.poll(() => coffee.getSavedPresaleCount(), { timeout: 15_000 }).toBe(0);
      });
    }
  );

  // FAILING HALF of C-TC-017 - the Back-arrow confirmation itself.
  //
  // Asserted as INTENDED behaviour so it flags if the pop-up returns, rather
  // than asserting today's absence and going silently green. Kept separate from
  // the passing half above for the same reason as C-TC-005/033/054.
  //
  // Note this may be a deliberate product change rather than a defect - the
  // analogous Delivery confirm was removed at customer request - in which case
  // the right outcome is to retire this sheet row, not to fix the app. Worth
  // asking Anthony alongside the other Coffee findings.
  test(
    'C-TC-017 (gap): BACK on Pre-sales with a saved order raises a Complete Pre-sale confirmation',
    { tag: ['@Coffee-C-TC-017'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      test.fail();
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
      await prepTasks.openFromHamburgerMenu();
      await prepTasks.ensureFullDayPrepComplete();
      await home.returnToHome();

      await reachCoffeeStop(driver, 'any-coffee', async (c) => {
        await c.tapAddPresaleTrigger();
        return true;
      }, ['24Hundred Marketplace', 'Amerock']);

      await driver.pause(2_000);
      await coffee.pressKeyCode(4);
      await driver.pause(1_500);
      expect(await coffee.isCompletePresalePromptVisible()).toBe(true);
    }
  );

  // ==== C-TC-035 (regression suite "Coffee") ====
  //
  // "Ad-hoc after-photos are blocked until delivery is completed [Coffee]" -
  // after-photos and signing-off should be disabled, matching the scheduled
  // Coffee delivery flow. The sheet records this row as **Fail**.
  //
  // READ-ONLY: it inspects tile state on an ad-hoc stop whose delivery is NOT
  // complete, and taps nothing. That is deliberate - the case is about what
  // should be BLOCKED, so opening the tiles to find out would defeat it.
  //
  // Written as test.fail() asserting the INTENDED gating. If the tiles turn out
  // to be genuinely disabled the test will flag as "expected to fail but
  // passed", which is the signal to promote it to a normal passing test.
  test(
    'C-TC-035 (gap): on an ad-hoc stop, After Photos and Signing Order are gated until delivery completes',
    { tag: ['@Coffee-C-TC-035'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      test.fail();
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
      await prepTasks.openFromHamburgerMenu();
      await prepTasks.ensureFullDayPrepComplete();
      await home.returnToHome();

      // The ad-hoc stop is the one with an EMPTY Deliveries screen - ad-hoc
      // orders arrive with no products by design (Anthony, 2026-08-25), so its
      // delivery is by definition not complete, which is the precondition.
      await reachCoffeeStopWithEmptyDeliveries(driver);
      await coffee.pressKeyCode(4);
      await expect
        .poll(() => coffee.getVisibleScreenText(), { timeout: 30_000 })
        .toContain('After Photos');

      console.log(`[C-TC-035] checklist: ${await coffee.getVisibleScreenText()}`);
      console.log(
        `[C-TC-035] After Photos enabled=${await coffee.isChecklistTileEnabled('After Photos')} ` +
          `Signing Order enabled=${await coffee.isChecklistTileEnabled('Signing Order')}`
      );

      expect(await coffee.isChecklistTileEnabled('After Photos')).toBe(false);
      expect(await coffee.isChecklistTileEnabled('Signing Order')).toBe(false);
    }
  );

  // ==== C-TC-048 (regression suite "Coffee") ====
  //
  // "Continue remains disabled until mandatory tasks are complete" - Continue
  // stays disabled; once the mandatory tasks are done, Continue becomes
  // enabled.
  //
  // WHICH "Continue" this is, and why. The sheet's sub-feature is
  // "Vending/Market/coffee" and it does not name a screen. On Coffee there are
  // two candidate readings:
  //   (a) the DELIVERIES screen's Continue, gated on the screen's own mandatory
  //       task - a delivered quantity actually being entered; and
  //   (b) the STOP-level action ("Complete Delivery"), gated on the whole
  //       checklist.
  // (b) is C-TC-020's subject and requires completing a stop, which is parked -
  // so this asserts (a), and says so rather than quietly picking one. The
  // wording fits (a) exactly: disabled -> mandatory task done -> enabled.
  //
  // Written as a ROUND TRIP - disabled, enabled, then disabled again once the
  // product is removed. The return leg is what proves the gate TRACKS the
  // mandatory task rather than happening to be in the right state when looked
  // at, and it doubles as cleanup, restoring the empty-Deliveries precondition
  // C-TC-005/011/014 depend on.
  test(
    'C-TC-048: Deliveries Continue stays disabled until a delivered quantity is entered',
    { tag: ['@Coffee-C-TC-048'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('C-TC-048: with nothing to deliver, Continue is disabled', async () => {
        await reachCoffeeStopWithEmptyDeliveries(driver);
        expect(await coffee.getDeliveryProductRowCount()).toBe(0);
        expect(await coffee.isDeliveriesContinueEnabled()).toBe(false);
      });

      await test.step('C-TC-048: adding a product arrives with quantity 1, which satisfies the gate', async () => {
        // Live-verified 2026-08-26: a newly added product does NOT arrive
        // empty - it lands with a delivered quantity of 1 already set, and
        // Continue enables immediately on add ("qty after add = 1,
        // Continue enabled=true").
        //
        // Worth stating plainly because the obvious expectation is the
        // opposite. An earlier version of this step was titled "adding a
        // product alone does not enable Continue", which the evidence
        // contradicts; it only passed because the step logged rather than
        // asserted. The gate is genuinely "is there a valid quantity", and the
        // app pre-satisfies it on add.
        expect(await coffee.addFirstDeliverySearchResult('sugar')).not.toBe('');
        await driver.executeScript('mobile: pressKey', [{ keycode: 4 }]);
        await expect.poll(() => coffee.getDeliveryProductRowCount(), { timeout: 15_000 }).toBe(1);
        const qty = await coffee.getDeliveredQty();
        console.log(`[C-TC-048] qty after add = "${qty}" Continue enabled=${await coffee.isDeliveriesContinueEnabled()}`);
        expect(Number(qty)).toBeGreaterThan(0);
        expect(await coffee.isDeliveriesContinueEnabled()).toBe(true);
      });

      await test.step('C-TC-048: editing the quantity keeps Continue enabled', async () => {
        await coffee.setDeliveredQuantity('4');
        // Compared numerically - this field clears to "0" rather than empty, so
        // setting 4 lands as the text "04".
        expect(Number(await coffee.getDeliveredQty())).toBe(4);
        await expect.poll(() => coffee.isDeliveriesContinueEnabled(), { timeout: 15_000 }).toBe(true);
      });

      await test.step('C-TC-048: removing the product disables Continue again', async () => {
        await coffee.revealRowDeleteResilient('//android.view.View[contains(@content-desc,"Pkg:")]');
        await coffee.tapRevealedDeliveryProductDelete();
        await coffee.confirmDeleteProduct();
        await coffee.waitForDeleteProductConfirmGone();
        await expect.poll(() => coffee.getDeliveryProductRowCount(), { timeout: 15_000 }).toBe(0);
        expect(await coffee.isDeliveriesContinueEnabled()).toBe(false);
      });
    }
  );

  // ==== C-TC-045 (regression suite "Coffee") ====
  //
  // "Driver navigates to stop using default maps application" - the device's
  // default navigation app should open with directions to the stop.
  //
  // This is the ONLY Coffee case that deliberately leaves the app, so two
  // things are handled explicitly:
  //
  // 1. The assertion is on the FOREGROUND PACKAGE, not on anything drawn on
  //    screen. Once Maps takes over, the accessibility tree belongs to another
  //    app and this suite's locators mean nothing there - the only sound signal
  //    is which package Android has in front.
  // 2. It brings our app back afterwards via activateApp. A test that walked
  //    off into another app would strand every test after it, which is exactly
  //    how the in-app camera and the Equipment audit BACK-loop broke following
  //    runs earlier in this suite's history.
  //
  // Pre-checked on this emulator: `cmd package resolve-activity` for
  // "geo:0,0?q=..." resolves to com.google.android.apps.maps, so a default
  // handler genuinely exists here. Without one the case would be untestable on
  // this device rather than failing.
  //
  // Read-only with respect to route data - it completes nothing.
  test(
    'C-TC-045: Navigate hands off to the default maps application',
    { tag: ['@Coffee-C-TC-045'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      let ownPackage = '';
      await test.step('Open a Coffee stop and return to its Stop Preview', async () => {
        await reachCoffeeStop(driver, 'any-coffee', async () => true, []);
        await coffee.pressKeyCode(4);
        await expect
          .poll(() => coffee.getVisibleScreenText(), { timeout: 30_000 })
          .toContain('Navigate');
        ownPackage = await coffee.getForegroundPackage();
        console.log(`[C-TC-045] own package = "${ownPackage}"`);
        expect(ownPackage).not.toBe('');
      });

      await test.step('C-TC-045: tapping Navigate opens the default maps app', async () => {
        await coffee.tap('~Navigate');
        // Polled: the hand-off is an intent, so the foreground package changes
        // asynchronously and a single read catches the old one.
        await expect
          .poll(() => coffee.getForegroundPackage(), { timeout: 30_000 })
          .not.toBe(ownPackage);
        const handler = await coffee.getForegroundPackage();
        console.log(`[C-TC-045] foreground after Navigate = "${handler}"`);
        // Asserted as "a maps handler", not the exact package: which app is
        // default is a DEVICE setting, so pinning com.google.android.apps.maps
        // would make this a check of the emulator's configuration rather than
        // of the app's hand-off.
        expect(handler.toLowerCase()).toContain('maps');
      });

      await test.step('Restore: bring the app back to the foreground', async () => {
        // Not optional housekeeping - without it every following test starts
        // inside Google Maps.
        await coffee.returnToThisApp();
        await expect.poll(() => coffee.getForegroundPackage(), { timeout: 30_000 }).toBe(ownPackage);
      });
    }
  );

  // ==== C-TC-018 (regression suite "Coffee") ====
  //
  // "Editing a signed delivery requires confirmation and clears signature
  // status" - the Sign for Order completed status should be cleared until a new
  // signature is obtained. The sheet records this row as **Fail**.
  //
  // Needs a SIGNED delivery, not a completable stop - a distinction worth
  // stating because this case was previously mis-triaged as blocked alongside
  // the end-to-end ones. A signed-but-not-completed delivery is exactly what
  // exists on this route, so the precondition is discoverable: find a stop
  // whose Signing Order tile is already complete.
  //
  // MUTATES a signed order deliberately - that IS the case. Editing is the
  // action under test, and there is no read-only way to observe what an edit
  // does. The stop it lands on is the one already consumed by the parked
  // destructive batch, so this adds no NEW data debt.
  //
  // Assertions are written to the INTENDED behaviour. If the sheet's Fail is
  // right they will fail, and the case then converts to test.fail() with the
  // logged evidence behind it - the same route C-TC-033/054/047 took.
  test(
    'C-TC-018: editing a signed delivery confirms, and clears the signed status',
    { tag: ['@Coffee-C-TC-018'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('Reach a Coffee stop whose delivery is already SIGNED', async () => {
        await reachCoffeeStop(driver, 'coffee-signed-delivery', async (c) => {
          // NO back press here. reachCoffeeStop's openFirstServiceStation()
          // already leaves us ON the checklist; an earlier version pressed BACK
          // first (copied from a qualifier that had opened Delivery), which
          // navigated AWAY to the stop detail where the Signing Order tile does
          // not exist - so every stop failed to qualify and the scan exhausted.
          //
          // The tiles render after the checklist's chrome, so wait for them
          // rather than reading immediately.
          await driver.pause(1_500);
          for (let i = 0; i < 10; i++) {
            if ((await c.getVisibleScreenText()).includes('Signing Order')) {
              break;
            }
            await driver.pause(1_000);
          }
          return c.isChecklistTileComplete('Signing Order');
        }, []);
        await expect
          .poll(() => coffee.getVisibleScreenText(), { timeout: 30_000 })
          .toContain('Signing Order');
        console.log(`[C-TC-018] checklist BEFORE edit: ${await coffee.getVisibleScreenText()}`);
        expect(await coffee.isChecklistTileComplete('Signing Order')).toBe(true);
      });

      await test.step('C-TC-018: editing the delivery raises a confirmation', async () => {
        await coffee.openDelivery();
        await expect.poll(() => coffee.getDeliveryProductRowCount(), { timeout: 20_000 }).toBeGreaterThan(0);
        const qtyBefore = await coffee.getDeliveredQty();
        // Change the delivered quantity - the smallest real edit to a signed
        // delivery, and one that does not add or remove anything.
        await coffee.setDeliveredQuantity(String(Number(qtyBefore) + 1));
        await driver.pause(2_000);
        const afterEdit = await coffee.getVisibleScreenText();
        console.log(`[C-TC-018] qty ${qtyBefore} -> ${await coffee.getDeliveredQty()}`);
        console.log(`[C-TC-018] screen after edit: ${afterEdit}`);
        // "requires confirmation" - some dialog should stand between the driver
        // and an edit that invalidates a customer's signature.
        expect(afterEdit.toLowerCase()).toMatch(/are you sure|confirm|sign/);
      });

      await test.step('C-TC-018: the Sign for Order completed status is cleared', async () => {
        await coffee.pressKeyCode(4);
        await expect
          .poll(() => coffee.getVisibleScreenText(), { timeout: 30_000 })
          .toContain('Signing Order');
        const afterBack = await coffee.getVisibleScreenText();
        console.log(`[C-TC-018] checklist AFTER edit: ${afterBack}`);
        // The heart of the case: an edited delivery must no longer count as
        // signed until a new signature is taken.
        expect(await coffee.isChecklistTileComplete('Signing Order')).toBe(false);
      });
    }
  );

  // ==== C-TC-012 (regression suite "Coffee", build 0.1.90) ====
  //
  // "Driver deletes a saved presale order with confirmation."
  //
  // Creates the presale it deletes, rather than consuming one C-TC-010 left
  // behind. Two reasons: the two tests stop depending on run order, and the
  // case ends net-zero, so it cannot quietly eat the saved presale that
  // C-TC-010's own assertions - or a later Continue-enabled check - rely on.
  //
  // Counted rather than asserted absolutely: earlier runs can leave presales
  // on a stop, so baseline+1 then back to baseline is the real proof, the same
  // reasoning C-TC-010 uses for its Items count.
  //
  // See CoffeeServiceScreen's own "C-TC-012" section for the four
  // non-obvious mechanics behind the delete (no control on the summary, a
  // reveal gesture the default swipe is too fast for, an unlabelled Button
  // located by geometry, and Cancel/Delete rather than No/Yes).
  test(
    'C-TC-012: deleting a saved presale requires confirmation and removes it from Pre-sales',
    { tag: ['@Coffee-C-TC-012'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('Reach a Coffee stop and open Pre-sales', async () => {
        // Prefer a stop OTHER than the one C-TC-007 settled on: this test
        // transiently saves a presale, which would destroy the empty state
        // C-TC-007 asserts if the two landed together. Same guard C-TC-010
        // uses.
        const usedByCancelTest = qualifyingStopCache.get('coffee-empty-presales');
        await reachCoffeeStop(
          driver,
          'coffee-for-presale-delete',
          async (c) => {
            await c.tapAddPresaleTrigger();
            return true;
          },
          ['Amerock', '24Hundred Marketplace'].filter((n) => n !== usedByCancelTest)
        );
      });

      let baseline = 0;
      await test.step('Create the presale this test will delete', async () => {
        baseline = await coffee.getSavedPresaleCount();
        await coffee.openAddPresalesOrder();
        await coffee.typeAddPresalesProduct('sugar');
        expect(await coffee.selectFirstPresaleSearchResult()).not.toBe('');
        await coffee.dismissPresaleKeypadIfPresent();
        await coffee.selectFirstAvailableDeliveryDate();
        expect(await coffee.isAddPresalesSaveEnabled()).toBe(true);
        await coffee.saveAddPresalesOrder();
        await expect.poll(() => coffee.getSavedPresaleCount(), { timeout: 15_000 }).toBe(baseline + 1);
      });

      await test.step('C-TC-012: swiping the saved order and tapping delete raises a confirmation', async () => {
        await coffee.revealSavedPresaleDelete();
        await coffee.tapRevealedSavedPresaleDelete();
        expect(await coffee.isDeletePresaleConfirmVisible()).toBe(true);
        expect(await coffee.getDeletePresaleConfirmText()).toContain('Are you sure you want to delete');
      });

      // The confirmation must actually GATE the delete - without this,
      // "deletes with confirmation" would pass even if the dialog were
      // decorative and the order had already gone. Same gating check as
      // C-TC-011, and polled for the same dialog-window reason.
      await test.step('C-TC-012: cancelling the confirmation keeps the presale', async () => {
        await coffee.cancelDeletePresale();
        await coffee.waitForDeletePresaleConfirmGone();
        await expect.poll(() => coffee.getSavedPresaleCount(), { timeout: 15_000 }).toBe(baseline + 1);
      });

      await test.step('C-TC-012: confirming removes the presale from the Pre-sales screen', async () => {
        await coffee.revealSavedPresaleDelete();
        await coffee.tapRevealedSavedPresaleDelete();
        expect(await coffee.isDeletePresaleConfirmVisible()).toBe(true);
        await coffee.confirmDeletePresale();
        await coffee.waitForDeletePresaleConfirmGone();
        await expect.poll(() => coffee.getSavedPresaleCount(), { timeout: 15_000 }).toBe(baseline);
      });
    }
  );

  // ==== C-TC-011 (regression suite "Coffee", build 0.1.90) ====
  //
  // "Driver deletes a manually added product with confirmation."
  //
  // Self-cleaning by construction: it adds a product and then deletes it, so
  // the stop ends exactly as it started. That is why it can safely share
  // C-TC-005's "empty Deliveries" precondition rather than needing a sandbox
  // stop of its own.
  //
  // The delete affordance is a swipe-left on the row revealing an UNLABELLED
  // Button (desc="null"), located as the row's own Button child - see
  // revealDeliveryProductDelete/tapRevealedDeliveryProductDelete.
  test(
    'C-TC-011: deleting a manually added product requires confirmation and removes it',
    { tag: ['@Coffee-C-TC-011'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      let product = '';
      await test.step('Reach an empty Deliveries screen and add a product manually', async () => {
        await reachCoffeeStopWithEmptyDeliveries(driver);
        expect(await coffee.getDeliveryProductRowCount()).toBe(0);
        product = await coffee.addFirstDeliverySearchResult('sugar');
        expect(product).not.toBe('');
        // Selecting a product opens the quantity keypad over the list.
        await driver.executeScript('mobile: pressKey', [{ keycode: 4 }]);
        expect(await coffee.getDeliveryProductRowCount()).toBe(1);
      });

      await test.step('C-TC-011: swiping the row and tapping delete raises a confirmation naming the product', async () => {
        await coffee.revealDeliveryProductDelete();
        await coffee.tapRevealedDeliveryProductDelete();
        expect(await coffee.isDeleteProductConfirmVisible()).toBe(true);
        expect(await coffee.getDeleteProductConfirmText()).toContain('Are you sure you want to delete');
      });

      // The confirmation must actually GATE the delete - without this step,
      // "deletes with confirmation" would pass even if the dialog were purely
      // decorative and the row had already gone.
      // Batch-only flake investigated 2026-08-25. This step intermittently read
      // 0 rows here in a full run (never standalone), which left two candidate
      // causes: a re-render race, or "No" deleting the row anyway.
      //
      // Instrumented and re-run in batch: the row count read 1 immediately
      // after the tap and stayed 1 across a 20-second trace, with the empty
      // state absent throughout. So No genuinely does NOT delete - a real
      // delete-on-decline would be deterministic, not intermittent - and this
      // is a timing artefact, not a product defect. The dialog is its own
      // window, so while it is dismissing the list behind it is not reliably
      // in the accessibility tree and a single immediate read can see nothing.
      //
      // The flake did not reproduce on the instrumented run, so this is
      // hardening against the mechanism rather than a confirmed-cured fix:
      // wait for the dialog to actually leave, then poll rather than trusting
      // one snapshot. If it ever fails again it now fails on a 15s poll that
      // never saw the row, which IS evidence of a real defect.
      await test.step('C-TC-011: declining the confirmation keeps the product', async () => {
        await coffee.declineDeleteProduct();
        await coffee.waitForDeleteProductConfirmGone();
        await expect.poll(() => coffee.getDeliveryProductRowCount(), { timeout: 15_000 }).toBe(1);
      });

      await test.step('C-TC-011: confirming removes the product from the delivery list', async () => {
        await coffee.revealDeliveryProductDelete();
        await coffee.tapRevealedDeliveryProductDelete();
        expect(await coffee.isDeleteProductConfirmVisible()).toBe(true);
        await coffee.confirmDeleteProduct();
        // Same dialog-window race as the decline step above - poll rather than
        // read once. (This direction happens to be the forgiving one: a stale
        // read here returns the 0 we want and passes for the wrong reason,
        // which is exactly why it is worth pinning down too.)
        await coffee.waitForDeleteProductConfirmGone();
        await expect.poll(() => coffee.getDeliveryProductRowCount(), { timeout: 15_000 }).toBe(0);
        // Back to the empty state we started from, so the stop is left clean.
        expect(await coffee.isDeliveriesEmptyStateVisible()).toBe(true);
      });
    }
  );

  // ==== C-TC-014 (regression suite "Coffee", build 0.1.90) ====
  //
  // "Driver searches or scans and adds a product to Deliveries."
  //
  // The SCAN half is not automatable (no scanner hardware, and no scan-intent
  // mechanism in this suite - the same blocker as Vending V-TC-001/004 and
  // Market M-TC-012). The search half is what is verified here, which is the
  // path a scan result feeds into anyway.
  //
  // Self-cleaning like C-TC-011: the product added here is deleted again at
  // the end, so the stop is left on the empty Deliveries state that C-TC-005
  // and C-TC-011 both depend on.
  test(
    'C-TC-014: a searched product is added with Ordered and an editable Delivered quantity',
    { tag: ['@Coffee-C-TC-014'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('Reach an empty Deliveries screen', async () => {
        await reachCoffeeStopWithEmptyDeliveries(driver);
        expect(await coffee.getDeliveryProductRowCount()).toBe(0);
        // Establish the "before" state, so enabling Continue later is a real
        // transition rather than something that was already true.
        expect(await coffee.isDeliveriesContinueEnabled()).toBe(false);
      });

      let product = '';
      await test.step('C-TC-014: searching and selecting a product adds it to the list', async () => {
        product = await coffee.addFirstDeliverySearchResult('sugar');
        expect(product).not.toBe('');
        await driver.executeScript('mobile: pressKey', [{ keycode: 4 }]);
        expect(await coffee.getDeliveryProductRowCount()).toBe(1);
      });

      await test.step('C-TC-014: the row exposes Ordered and an editable Delivered quantity', async () => {
        // The row concatenates product, packaging, price and the Ordered
        // label/value into one content-desc. A manually added product has no
        // ordered quantity, so Ordered renders as "-" rather than a number -
        // the presence of the label and the product is what matters here.
        const rowText = await coffee.getFirstDeliveryProductRowText();
        expect(rowText).toContain('Ordered');
        expect(rowText).toContain('Pkg:');
        expect(await coffee.isDeliveredQtyFieldVisible()).toBe(true);
        // Editable in the real sense: it accepts a new value and keeps it.
        // Compared numerically because this keypad field clears to "0" rather
        // than empty, so setting 4 lands as the text "04" - see
        // setDeliveredQuantity's own note.
        await coffee.setDeliveredQuantity('4');
        expect(Number(await coffee.getDeliveredQty())).toBe(4);
      });

      await test.step('C-TC-014: Continue is enabled once a valid delivered quantity is present', async () => {
        expect(await coffee.isDeliveriesContinueEnabled()).toBe(true);
      });

      await test.step('Cleanup: remove the added product so the stop is left empty', async () => {
        await coffee.revealDeliveryProductDelete();
        await coffee.tapRevealedDeliveryProductDelete();
        await coffee.confirmDeleteProduct();
        // Polled for the same dialog-window reason as C-TC-011's own delete
        // steps - and it matters more here, because a stale 0 would report a
        // successful cleanup that never happened, leaving the stop dirty for
        // C-TC-005 and C-TC-011.
        await coffee.waitForDeleteProductConfirmGone();
        await expect.poll(() => coffee.getDeliveryProductRowCount(), { timeout: 15_000 }).toBe(0);
      });
    }
  );


  // ==== C-TC-055 - OUT OF SCOPE (no scanner, and the case is only about scanning) ====
  //
  // "Scanning a product during Add Product dismisses search results and shows
  // keypad" -> "Then the search results should be dismissed; And the quantity
  // keypad should be fully visible".
  //
  // NOT AUTOMATED. Every assertion this case makes is downstream of a real
  // barcode scan, and there is no scanner and no scan-intent mechanism here -
  // the same blocker already recorded for C-TC-014's scan half, Market
  // M-TC-012/M-TC-016 and Vending V-TC-001/004.
  //
  // What WAS live-verified 2026-08-27 on Charlotte 103, so the entry point is
  // not left unexamined: Deliveries -> add (+) opens "Search product", which
  // carries a scanner icon to the right of its field, and tapping that icon
  // does open a real scanner - a viewfinder with its own torch control and a
  // Continue button. It is reachable and it works; it simply cannot be FED.
  // Pointing the emulator's virtual camera at a barcode would additionally
  // require a barcode encoding a SKU that exists in this route's catalog,
  // which the app does not expose anywhere.
  //
  // The half that is not scanner-specific - that choosing a product dismisses
  // the results list and leaves an editable quantity - is covered by C-TC-014,
  // which walks the same path a scan result feeds into.
  //
  // Revisit if a scan-intent broadcast or a seeded test barcode ever becomes
  // available.

  // ==== C-TC-046 (regression suite "Coffee", build 0.1.90) ====
  //
  // "Flash and camera flip are available on all in-app photo capture screens"
  // -> "Then Flash and Camera Flip options should be available; And existing
  // capture behavior should otherwise be unaffected".
  //
  // The camera screen carries ZERO content-descs - 12 nodes, none labelled -
  // so neither control can be addressed or named by any accessibility signal.
  // Its identical twin M-TC-039 was ruled Out of Scope on exactly that basis:
  // that a test naming the left control "Flash" from position alone would be a
  // guess presented as a fact, and would keep passing if the two were swapped.
  //
  // That reasoning holds, but the conclusion drawn from it was too pessimistic.
  // The controls do not have to be named by POSITION - they can be named by
  // what tapping them demonstrably DOES, which is observable and is what this
  // test asserts. Live-measured on Charlotte 103 (2026-08-27):
  //
  //   * the left control repaints ~3% of its OWN bounds on a tap, and a second
  //     tap restores them to a PIXEL-EXACT match of the original. A live
  //     camera feed can never round-trip to a zero diff, so this is a
  //     two-state icon toggle - i.e. Flash, and it is still on the screen in
  //     both of its states.
  //
  //   * the right control changes ~98% of the preview, against ~14% idle feed
  //     jitter, and swaps back on a second tap. Nothing but a camera switch
  //     replaces the whole scene and then restores it - i.e. Camera Flip.
  //
  // Both claims are measured against the jitter floor read at run time rather
  // than against the numbers above, so a slower or noisier device shifts the
  // baseline without weakening the assertion.
  //
  // M-TC-039 should be revisited on the strength of this - it is the same
  // shared camera component, mapped node-for-node identical on both LOBs.
  test(
    'C-TC-046: the camera exposes a working Flash toggle and Camera Flip alongside capture',
    { tag: ['@Coffee-C-TC-046'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('Reach the in-app camera from a Coffee stop', async () => {
        // ANY Coffee stop will do - deliberately not one whose Before Photos
        // tile is still pending. See C-TC-056's own note: a completed tile
        // reopens the same "Add supporting photo" sheet, and requiring a
        // pending one makes these tests consume a stop per run, which
        // Charlotte 103 cannot afford (it carried ONE stop on 2026-08-27).
        await reachCoffeeStop(driver, 'any-coffee', async () => true, ['24Hundred Marketplace', 'Amerock']);
        await coffee.openBeforePhotos();
        // reachCamera() rather than a bare "Take photo" tap - see its own note
        // on why a tile that already holds a photo opens that photo's review
        // screen instead of the camera.
        await coffee.reachCamera();
      });

      let flash: any;
      let shutter: any;
      let flip: any;

      await test.step('C-TC-046: the capture screen offers two controls either side of the shutter', async () => {
        // Guarded first, so a screen that is not the camera fails HERE with a
        // clear message rather than as a puzzling length mismatch.
        expect(await coffee.isCameraScreen()).toBe(true);
        const controls = await coffee.getCameraControls();
        console.log(
          `[C-TC-046] camera controls = ${JSON.stringify(
            controls.map((c) => ({ cls: c.className, x: c.x, w: c.width }))
          )}`
        );
        // Exactly three, and the shutter is the widest - asserted so the two
        // auxiliary controls are identified as "the ones flanking capture",
        // not merely as "the first and last clickable things on screen".
        expect(controls).toHaveLength(3);
        [flash, shutter, flip] = controls;
        expect(shutter.width).toBeGreaterThan(flash.width);
        expect(shutter.width).toBeGreaterThan(flip.width);
        expect(flash.x).toBeLessThan(shutter.x);
        expect(flip.x).toBeGreaterThan(shutter.x);
      });

      // The floor every "the feed changed" claim below is judged against. Read
      // live rather than hardcoded: the preview is never pixel-identical frame
      // to frame, and how much it drifts is a property of the device.
      let jitter = 0;
      await test.step('Measure the idle preview jitter', async () => {
        jitter = await coffee.measureCameraPreviewJitter();
        console.log(`[C-TC-046] idle preview jitter = ${jitter}%`);
        expect(jitter).toBeLessThan(60);
      });

      await test.step('C-TC-046: the left control is a Flash toggle - it switches state and back', async () => {
        const on = await coffee.tapCameraControlAndMeasure(flash);
        console.log(`[C-TC-046] flash tap 1: own=${on.own}% preview=${on.preview}%`);
        // Its own icon repainted...
        expect(on.own).toBeGreaterThan(0.5);
        // ...and it did NOT swap the camera - a flash toggle leaves the scene
        // alone, which is what separates it from the control on the right.
        expect(on.preview).toBeLessThan(jitter + 25);

        // Tapping again must return the icon to EXACTLY its first state. This
        // is the assertion that makes it a toggle rather than a coincidence:
        // measured against the pre-first-tap screenshot, a live region could
        // not come back pixel-identical.
        const off = await coffee.tapCameraControlAndMeasure(flash, on.before);
        console.log(`[C-TC-046] flash tap 2 (vs original): own=${off.own}% preview=${off.preview}%`);
        expect(off.own).toBeLessThan(0.5);
      });

      await test.step('C-TC-046: the right control is Camera Flip - it swaps the feed and back', async () => {
        const flipped = await coffee.tapCameraControlAndMeasure(flip);
        console.log(`[C-TC-046] flip tap 1: own=${flipped.own}% preview=${flipped.preview}%`);
        // The whole scene was replaced, well clear of the idle jitter floor.
        expect(flipped.preview).toBeGreaterThan(jitter + 30);

        const back = await coffee.tapCameraControlAndMeasure(flip, flipped.before);
        console.log(`[C-TC-046] flip tap 2 (vs original): preview=${back.preview}%`);
        // ...and flipping back returns to the original camera, i.e. within
        // jitter of where it started rather than to a third state.
        expect(back.preview).toBeLessThan(jitter + 25);
      });

      await test.step('C-TC-046: existing capture behaviour is unaffected', async () => {
        // The case's second clause. Capture must still work after both
        // controls have been exercised - and it is asserted here rather than
        // assumed from the shutter merely being present.
        await coffee.tapCameraShutter();
        const review = await coffee.isPhotoReviewVisible();
        console.log(`[C-TC-046] post-capture review = ${JSON.stringify(review)}`);
        expect(review.review).toBe(true);
        expect(review.attach).toBe(true);
      });

      await test.step('Cleanup: discard the capture and leave the checklist', async () => {
        // Deleted rather than attached: this case is about the camera's
        // controls, not about adding a photo to the stop, so it leaves no
        // trace on the checklist it borrowed.
        await coffee.deleteCapturedPhoto();
        await expect
          .poll(() => coffee.isPhotoReviewVisible().then((r) => r.review).catch(() => false), { timeout: 20_000 })
          .toBe(false);
        // One BACK escapes this camera. Live-verified 2026-08-27 on build
        // 0.1.90 - the older note in this suite that Coffee's camera traps
        // BACK entirely no longer holds.
        await driver.executeScript('mobile: pressKey', [{ keycode: 4 }]);
        await expect
          .poll(() => coffee.isChecklistTileComplete('Delivery').then(() => true).catch(() => false), {
            timeout: 20_000
          })
          .toBe(true);
      });
    }
  );

  // ==== C-TC-056 (regression suite "Coffee", build 0.1.90) ====
  //
  // "Driver captures, labels, and attaches photos with optional description"
  // -> "Then the photo should be confirmed and saved against the selected
  // label".
  //
  // The Coffee twin of Market's M-TC-041, and the same shared review screen -
  // "Photos" heading, a label picker, a description field, and Delete photo /
  // Take photo / Attach Photo. Two differences from Market worth knowing:
  //
  //  * the picker's chosen label comes back as the node's `text`, not its
  //    content-desc, so getVisibleScreenText() (which reads content-descs) does
  //    NOT see it. getSelectedPhotoLabel() reads both attributes for that
  //    reason.
  //  * Coffee's label list is Coffee-specific equipment - "Coffee Machine 1",
  //    "Cupboard 1 - Before", "Kegurator", "Refrigerator 2 - After" and so on.
  //    Nothing is hardcoded to those; whatever the sheet offers first is used.
  //
  // Scope note, the same one M-TC-041 settled on: the case's expected result is
  // that the photo is confirmed and saved AGAINST THE SELECTED LABEL - not that
  // the Before Photos task becomes complete. Re-opening Before Photos reopens
  // the ADD sheet rather than a gallery, so there is no read-back surface for
  // an attached photo; what is asserted is that the label survives being
  // chosen and described, and that Attach is accepted.
  test(
    'C-TC-056: a captured photo can be labelled, described and attached',
    { tag: ['@Coffee-C-TC-056'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('Reach a Coffee stop', async () => {
        // Deliberately NOT "a stop whose Before Photos tile is still pending".
        // That precondition looks right and is actively wrong here: attaching
        // completes the tile permanently, so a test requiring a pending one
        // consumes a stop on every run and fails the moment the route runs
        // out - which took exactly two runs, because Charlotte 103 carried a
        // single Coffee stop on 2026-08-27, not the 49 this file's older
        // comments describe.
        //
        // It buys nothing either: live-verified the same day that tapping an
        // ALREADY-COMPLETED Before Photos tile reopens the very same "Add
        // supporting photo" sheet, so the capture path under test is reachable
        // regardless of the tile's state.
        await reachCoffeeStop(driver, 'any-coffee', async () => true, ['24Hundred Marketplace', 'Amerock']);
      });

      await test.step('C-TC-056: capture a photo', async () => {
        await coffee.openBeforePhotos();
        expect((await coffee.isPhotoModalVisible()).takePhoto).toBe(true);
        // Normalises onto the camera whether or not this stop already carries
        // a photo from an earlier run - see BaseScreen.reachCamera.
        await coffee.reachCamera();
        await coffee.tapCameraShutter();
        const review = await coffee.isPhotoReviewVisible();
        console.log(`[C-TC-056] review screen = ${JSON.stringify(review)}`);
        expect(review.review).toBe(true);
        expect(review.attach).toBe(true);
      });

      let chosen = '';
      await test.step('C-TC-056: label the capture from the Select Label sheet', async () => {
        // Nothing is labelled before a choice is made - established first, so
        // the label read back later is a real selection and not a default that
        // was already sitting there.
        expect(await coffee.getSelectedPhotoLabel()).toBe('');

        await coffee.tapPhotoLabelPicker();
        await driver.pause(2_000);
        expect(await coffee.isSelectLabelSheetVisible()).toBe(true);

        const options = await coffee.getPhotoLabelOptions();
        console.log(`[C-TC-056] label options = ${JSON.stringify(options.map((o) => o.label).slice(0, 12))}`);
        expect(options.length).toBeGreaterThan(0);
        chosen = options[0].label;
        await options[0].el.click();
        await driver.pause(1_500);
      });

      await test.step('C-TC-056: the chosen label is shown against the photo', async () => {
        await expect.poll(() => coffee.getSelectedPhotoLabel(), { timeout: 20_000 }).toBe(chosen);
      });

      await test.step('C-TC-056: the description is optional and accepts text', async () => {
        await coffee.enterPhotoDescription('QA automated check');
        // The label must survive the description being typed - the two share
        // the review screen, and a re-render that dropped the selection would
        // otherwise go unnoticed right before the attach.
        expect(await coffee.getSelectedPhotoLabel()).toBe(chosen);
      });

      await test.step('C-TC-056: attaching confirms the photo against that label', async () => {
        await coffee.tapAttachPhoto();
        // Accepted = the review screen is dismissed. Polled rather than read
        // once, since the attach and the screen teardown are not simultaneous.
        await expect
          .poll(() => coffee.isPhotoReviewVisible().then((r) => r.review).catch(() => false), { timeout: 30_000 })
          .toBe(false);
        console.log(`[C-TC-056] attached against label "${chosen}"`);
        // Evidence for the record, not an assertion. Attaching DOES mark the
        // Before Photos tile complete here - observed true on every run - and
        // that is a real Coffee/Market difference worth writing down, since
        // asserting exactly this is what made the Market twin M-TC-041 fail
        // three times. It stays unasserted all the same: the case claims the
        // photo is saved against its label, not that the task completes, and
        // a stop that wanted more than one photo would fail this for reasons
        // having nothing to do with the case's subject.
        console.log(
          `[C-TC-056] Before Photos tile complete after attach = ${await coffee
            .isPhotoTileComplete('before')
            .catch(() => 'unreadable')}`
        );
      });
    }
  );


  // ==== C-TC-009 / C-TC-008 (capture, label and attach a photo) ====
  //
  //   C-TC-009  "Driver captures, labels, and attaches Before Photos" -> "the
  //             photo should be attached successfully; And Before Photos
  //             should be marked complete in green"
  //   C-TC-008  the same for After Photos -> "After Photos should be marked
  //             completed in green"
  //
  // BOTH WERE RECORDED "NOT FEASIBLE" (camera). That verdict is wrong on build
  // 0.1.90 and was set before the camera was ever mapped: one BACK press
  // escapes it, the shutter works, and the post-capture review screen is fully
  // labelled. See BaseScreen's camera helpers, and C-TC-046 for the controls.
  //
  // Relationship to C-TC-056, which walks the same flow: that case asks only
  // that the photo be saved against its chosen label, and deliberately does
  // NOT assert tile completion. These two ask precisely the opposite - the
  // green tile IS their expected result - so the assertion C-TC-056 leaves as
  // a logged observation is the one being made here.
  //
  // Asserted DIFFERENTIALLY, as BaseScreen.hasCompletionGreen requires: the
  // tile carries no accessible completed state, so an absolute "is it green"
  // check would pass on a tile an earlier run left complete, without this test
  // having done anything. Each run therefore clears the tile first (see the
  // normalisation step) and proves the transition.

  test(
    'C-TC-009: a Before Photo can be captured, labelled and attached, turning the tile green',
    { tag: ['@Coffee-C-TC-009'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('Reach a Coffee stop', async () => {
        await reachCoffeeStop(driver, 'any-coffee', async () => true, ['24Hundred Marketplace', 'Amerock']);
      });

      await test.step('Normalise: clear any photo a previous run attached', async () => {
        // reachCamera() discards whatever photo is already on the tile, and
        // deleting one reverts the tile to "Record pre-service condition" with
        // its Optional badge back - live-verified 2026-08-28. That is what
        // makes the green assertion below a real transition on every run
        // rather than only the first.
        await coffee.openBeforePhotos();
        await coffee.reachCamera();
        await driver.executeScript('mobile: pressKey', [{ keycode: 4 }]);
        await expect
          .poll(() => coffee.isPhotoTileComplete('before').catch(() => true), { timeout: 30_000 })
          .toBe(false);
      });

      let chosen = '';
      await test.step('C-TC-009: capture, label and attach a Before Photo', async () => {
        await coffee.openBeforePhotos();
        await coffee.reachCamera();
        await coffee.tapCameraShutter();
        expect((await coffee.isPhotoReviewVisible()).attach).toBe(true);

        await coffee.tapPhotoLabelPicker();
        await driver.pause(2_000);
        expect(await coffee.isSelectLabelSheetVisible()).toBe(true);
        const options = await coffee.getPhotoLabelOptions();
        expect(options.length).toBeGreaterThan(0);
        chosen = options[0].label;
        await options[0].el.click();
        await driver.pause(1_500);
        await expect.poll(() => coffee.getSelectedPhotoLabel(), { timeout: 20_000 }).toBe(chosen);

        await coffee.tapAttachPhoto();
        await expect
          .poll(() => coffee.isPhotoReviewVisible().then((r) => r.review).catch(() => false), { timeout: 30_000 })
          .toBe(false);
        console.log(`[C-TC-009] attached against label "${chosen}"`);
      });

      await test.step('C-TC-009: Before Photos is now marked complete in green', async () => {
        await expect.poll(() => coffee.isPhotoTileComplete('before'), { timeout: 30_000 }).toBe(true);
      });
    }
  );

  test(
    'C-TC-008: an After Photo can be captured, labelled and attached, turning the tile green',
    { tag: ['@Coffee-C-TC-008'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('Reach a Coffee stop whose After Photos tile is actionable', async () => {
        // NOT any stop. After Photos is gated on the delivery being complete
        // (see isAfterPhotosAvailable), so this discovers a stop that has one -
        // which the destructive walk leaves behind. Stating the precondition
        // and letting discovery satisfy it is what stops this failing for DATA
        // reasons and reading as a regression.
        const stop = await reachCoffeeStop(
          driver,
          'coffee-after-photos-available',
          async (c) => c.isAfterPhotosAvailable(),
          ['24Hundred Marketplace']
        );
        console.log(`[C-TC-008] using stop "${stop}"`);
      });

      await test.step('Normalise: clear any photo a previous run attached', async () => {
        await coffee.openAfterPhotos();
        await coffee.reachCamera();
        await driver.executeScript('mobile: pressKey', [{ keycode: 4 }]);
        await expect
          .poll(() => coffee.isPhotoTileComplete('after').catch(() => true), { timeout: 30_000 })
          .toBe(false);
      });

      let chosen = '';
      await test.step('C-TC-008: capture, label and attach an After Photo', async () => {
        await coffee.openAfterPhotos();
        await coffee.reachCamera();
        await coffee.tapCameraShutter();
        expect((await coffee.isPhotoReviewVisible()).attach).toBe(true);

        await coffee.tapPhotoLabelPicker();
        await driver.pause(2_000);
        const options = await coffee.getPhotoLabelOptions();
        expect(options.length).toBeGreaterThan(0);
        chosen = options[0].label;
        await options[0].el.click();
        await driver.pause(1_500);
        await expect.poll(() => coffee.getSelectedPhotoLabel(), { timeout: 20_000 }).toBe(chosen);

        await coffee.tapAttachPhoto();
        await expect
          .poll(() => coffee.isPhotoReviewVisible().then((r) => r.review).catch(() => false), { timeout: 30_000 })
          .toBe(false);
        console.log(`[C-TC-008] attached against label "${chosen}"`);
      });

      await test.step('C-TC-008: After Photos is now marked complete in green', async () => {
        await expect.poll(() => coffee.isPhotoTileComplete('after'), { timeout: 30_000 }).toBe(true);
      });
    }
  );


  // ==== C-TC-044 (retake, delete, or skip optional photos) ====
  //
  // "Driver can retake, delete, or skip optional photos" -> "the new capture
  // should replace or remove the previous image as expected; When the photo
  // requirement is optional and the driver taps Skip photo; Then the driver
  // should proceed without capturing a photo".
  //
  // Recorded hardware-blocked, from the same batch as C-TC-008/009's "Not
  // Feasible" - and wrong for the same reason. It is the Coffee twin of
  // Market's M-TC-037, which has been green since 2026-08-27, and needs no
  // mechanic this suite does not already have.
  //
  // RUNS ON ITS OWN STOP, excluding whichever one C-TC-009 settled on. Not
  // tidiness - the skip path COMPLETES the Before Photos tile without leaving
  // a photo behind, and C-TC-009 clears its tile by deleting the photo on it.
  // There is no photo to delete after a skip, so the two sharing a stop would
  // leave C-TC-009 unable to reach its own baseline on the next run. Same
  // separate-by-data collision avoidance as M-TC-037/M-TC-041 (by stop) and
  // SD-TC-022/024 (by day).
  //
  // Caveat worth knowing: run in ISOLATION the cache is empty, so the
  // exclusion has nothing to exclude and this may land on C-TC-009's stop
  // anyway. That costs C-TC-009 its next run, not this one.
  test(
    'C-TC-044: an optional photo can be retaken, deleted, or skipped',
    { tag: ['@Coffee-C-TC-044'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('Reach a Coffee stop other than the one C-TC-009 owns', async () => {
        const owned = qualifyingStopCache.get('any-coffee');
        const stop = await reachCoffeeStop(
          driver,
          'coffee-photo-lifecycle',
          async () => true,
          [],
          10,
          owned ? [owned] : []
        );
        console.log(`[C-TC-044] using stop "${stop}" (C-TC-009 owns "${owned ?? 'none yet'}")`);
      });

      await test.step('C-TC-044: the photo requirement is optional - both paths are offered', async () => {
        await coffee.openBeforePhotos();
        const modal = await coffee.isPhotoModalVisible();
        console.log(`[C-TC-044] photo sheet = ${JSON.stringify(modal)}`);
        expect(modal.takePhoto).toBe(true);
        expect(modal.skipPhoto).toBe(true);
      });

      await test.step('C-TC-044: a capture offers retake and delete', async () => {
        await coffee.reachCamera();
        await coffee.tapCameraShutter();
        const review = await coffee.isPhotoReviewVisible();
        console.log(`[C-TC-044] review screen = ${JSON.stringify(review)}`);
        expect(review.review).toBe(true);
        expect(review.retake).toBe(true);
        expect(review.delete).toBe(true);
      });

      await test.step('C-TC-044: capturing again from the review screen is accepted', async () => {
        // "Take photo" here ADDS a further capture - it does NOT replace the
        // current one, despite sharing its label with the pre-capture sheet's
        // button. Established 2026-08-28 by counting deletes (see the next
        // step, which guards it). The app has no replace affordance on this
        // screen at all; replacing means deleting and capturing again.
        await coffee.tapRetakePhoto();
        await coffee.waitForCameraScreen();
        await coffee.tapCameraShutter();
        expect((await coffee.isPhotoReviewVisible()).review).toBe(true);
        // The new capture is its own image, so it arrives unlabelled rather
        // than inheriting anything from the previous one.
        expect(await coffee.getSelectedPhotoLabel()).toBe('');
      });

      await test.step('C-TC-044: deleting removes captures one at a time', async () => {
        // TWO captures were made above, so it must take TWO deletes to clear
        // them - and asserting that count is the whole point of this step. It
        // is what pins down "Take photo" as ADD rather than REPLACE: were it a
        // replace, one delete would empty the screen. If the app ever gains a
        // real retake, this flags it rather than passing quietly.
        let deletes = 0;
        while (deletes < 5 && (await coffee.isPhotoReviewVisible()).review) {
          await coffee.deleteCapturedPhoto();
          deletes++;
          await driver.pause(2_500);
        }
        console.log(`[C-TC-044] deletes needed to clear 2 captures = ${deletes}`);
        expect(deletes).toBe(2);
        // Deleting the LAST capture is what drops back to the camera.
        await coffee.waitForCameraScreen();
        await driver.executeScript('mobile: pressKey', [{ keycode: 4 }]);
        // Nothing was kept - the tile is still incomplete after all that.
        await expect
          .poll(() => coffee.isPhotoTileComplete('before').catch(() => true), { timeout: 30_000 })
          .toBe(false);
      });

      await test.step('C-TC-044: Skip photo proceeds without capturing', async () => {
        await coffee.openBeforePhotos();
        await coffee.openSkipPhotoReasonSheet();
        await coffee.enterSkipPhotoReason("Camera can't focus and take clear picture");
        await coffee.waitForSkipPhotoSubmitEnabled(true);
        await coffee.confirmSkipPhoto();
        // Proceeded WITHOUT a photo: the tile completes, and it completes with
        // nothing attached.
        await expect.poll(() => coffee.isPhotoTileComplete('before'), { timeout: 30_000 }).toBe(true);
        console.log('[C-TC-044] Before Photos completed via Skip, no photo captured');
      });
    }
  );


  // ==== C-TC-038 / C-TC-040 (end-to-end delivery WITH payment) ====
  //
  //   C-TC-038  "Coffee presales, delivery, signing order, and payment
  //             complete end to end" -> "presale and delivery summaries
  //             should preserve saved product, quantity, signature, and
  //             payment state; And the coffee service should be marked
  //             complete"
  //   C-TC-040  "Driver completes coffee delivery with signature and optional
  //             payment" -> "the coffee delivery should be marked complete on
  //             the service menu; And delivery summary should reflect
  //             signature, payment state, and final quantity"
  //
  // ONE test, deliberately. These are two readings of a SINGLE journey -
  // presale, delivery quantity, payment, signature, completion - and the setup
  // to reach the end of it is the expensive part. Same reasoning as the
  // C-TC-013 batch above. C-TC-039 is NOT folded in with them: it requires the
  // order to complete with NO payment, which directly contradicts these two.
  //
  // PRESERVATION is asserted BEFORE signing, not after. Re-opening a signed
  // delivery triggers the app's own edit-confirmation flow and clears the
  // signature (that is C-TC-018's subject, and the sheet records it as Fail),
  // so proving "the quantity survived" by re-reading it after sign-off would
  // damage the very state under test. Setting the quantity, leaving the
  // screen, and coming back proves persistence just as well and costs nothing.
  //
  // Destructive, but sustainably so: a completed Coffee stop on this route is
  // fully RE-WORKABLE - live-verified 2026-08-28 that 24Hundred Marketplace,
  // completed earlier the same day, showed "Customer sign-off required" again
  // with Continue enabled and its product row intact. So these do not consume
  // the route the way the C-TC-013 batch appeared to.
  test(
    'C-TC-038/040: presale, delivery, payment and signature complete the service end to end',
    { tag: ['@Coffee-C-TC-038', '@Coffee-C-TC-040'] },
    async ({ driver }) => {
      test.setTimeout(1_200_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      let stopName = '';
      await test.step('Reach a Coffee stop with a workable delivery', async () => {
        stopName = await reachCoffeeStop(
          driver,
          'coffee-end-to-end',
          async (c) => {
            await c.openDelivery();
            if (!(await c.isDeliveryContinueEnabled())) return false;
            // The Delivered field must still be EDITABLE, which is NOT implied
            // by Continue being enabled. On a station this suite completed
            // minutes earlier the row still renders (ordered quantity and all)
            // and Continue is still enabled, but the quantity field is gone -
            // and setDeliveredQuantity then fails on a missing element rather
            // than on anything the case is about. A stop only qualifies if the
            // journey can actually be walked.
            if (!(await c.isDeliveredQtyFieldVisible())) return false;
            // The delivery must be genuinely EDITABLE. Asserted by probing an
            // edit rather than by reading a flag - see isDeliveryEditable for
            // why the Delivery tile's green does not answer this.
            const editable = await c.isDeliveryEditable();
            if (!editable) {
              console.log('[qualify] rejected: delivery not editable');
              return false;
            }
            // Discards the probe's throwaway value AND answers the Save
            // Changes prompt that modifying it raises - without which this
            // lands on that dialog and every station is rejected.
            await c.leaveDeliveriesScreen(false);
            // Requiring an editable delivery is affordable only because
            // attempt() now walks EVERY service station: a stop whose first
            // station this suite already signed still has a fresh second one
            // behind it. Before that, this requirement emptied the route.
            // Still offering "Complete Delivery" == the service is not already
            // finished, so this journey has somewhere to go.
            const completeDelivery = await c.isVisible('~Complete Delivery');
            if (!completeDelivery) {
              console.log(`[qualify] NOT on the checklist. Screen = ${await c.getVisibleScreenText()}`);
            }
            console.log(`[qualify] editable=true completeDelivery=${completeDelivery}`);
            return completeDelivery;
          },
          []
        );
        console.log(`[C-TC-038/040] stop = "${stopName}"`);
      });

      let presaleBaseline = 0;
      await test.step('C-TC-038: a presale order is saved and preserved', async () => {
        await coffee.tapAddPresaleTrigger();
        // NORMALISE TO ZERO first. Each run of this test saves a presale, and
        // re-saving the SAME product (the search term is fixed) does not add a
        // second order - so on the second run the count stays at 1 and an
        // increment assertion fails against a stop that behaved correctly.
        // Clearing first makes "saving adds one" a real transition every run,
        // and stops this test accumulating data debt on the stop. Same
        // self-cleaning approach as C-TC-027.
        for (let i = 0; i < 5 && (await coffee.getSavedPresaleCount()) > 0; i++) {
          await coffee.revealSavedPresaleDelete();
          await coffee.tapRevealedSavedPresaleDelete();
          await coffee.confirmDeletePresale();
          await coffee.waitForDeletePresaleConfirmGone();
          await driver.pause(1_000);
        }
        presaleBaseline = await coffee.getSavedPresaleCount();
        expect(presaleBaseline).toBe(0);
        await coffee.openAddPresalesOrder();
        await coffee.typeAddPresalesProduct('sugar');
        await expect.poll(() => coffee.getPresaleSearchResultCount(), { timeout: 15_000 }).toBeGreaterThan(0);
        const chosen = await coffee.selectFirstPresaleSearchResult();
        expect(chosen).not.toBe('');
        await coffee.dismissPresaleKeypadIfPresent();
        // The product really is on the form - asserted on its DETAILS, since
        // the two screens render the same product's name differently (see
        // getPresaleFormProductHint).
        const onForm = await coffee.getPresaleFormProductHint();
        expect(onForm).toContain('SKU');
        expect(onForm).toContain('Qty');

        await coffee.selectFirstAvailableDeliveryDate();
        expect(await coffee.isAddPresalesSaveEnabled()).toBe(true);
        await coffee.saveAddPresalesOrder();
        // "preserve saved product" - the order survives the save and is listed.
        await expect.poll(() => coffee.getSavedPresaleCount(), { timeout: 20_000 }).toBe(presaleBaseline + 1);
        console.log(`[C-TC-038] presale saved: ${presaleBaseline} -> ${presaleBaseline + 1}`);
        await home.returnToHome();
        await dashboard.scrollToAndClickLocationByName(stopName);
        await dashboard.openFirstServiceStation('coffee');
      });

      let finalQty = 0;
      await test.step('C-TC-038/040: a delivered quantity is set and survives leaving the screen', async () => {
        await coffee.openDelivery();
        const rowBefore = await coffee.getFirstDeliveryProductRowText();
        console.log(`[C-TC-038/040] delivery row = ${rowBefore}`);
        finalQty = 6;
        await coffee.setDeliveredQuantity(String(finalQty));
        // Compared numerically - this keypad field clears to "0" rather than
        // empty, so setting 6 lands as the text "06" (see setDeliveredQuantity).
        expect(Number(await coffee.getDeliveredQty())).toBe(finalQty);

        // Leave and come back. This is the "delivery summary preserves
        // quantity" clause, proven as persistence rather than as a value still
        // sitting in a field nobody navigated away from.
        // SAVED on the way out - leaving a modified Deliveries screen
        // prompts, and answering "No" would discard the very value under test.
        await coffee.leaveDeliveriesScreen(true);
        await coffee.openDelivery();
        expect(Number(await coffee.getDeliveredQty())).toBe(finalQty);
        console.log(`[C-TC-038/040] delivered quantity ${finalQty} preserved across navigation`);
      });

      await test.step('Reach Signing Order (still reversible up to this point)', async () => {
        expect(await coffee.isDeliveryContinueEnabled()).toBe(true);
        await coffee.tapDeliveryContinue();
        expect(await coffee.isSigningOrderTitleVisible()).toBe(true);
      });

      await test.step('C-TC-038/040: a payment is recorded and its state persists on Signing Order', async () => {
        // RECORDS A REAL PAYMENT against this order, same as C-TC-026 does.
        expect(await coffee.isSummaryLineVisible('Payment')).toBe(true);
        await coffee.openOrderPayment();
        await coffee.choosePaymentType('Cash');
        // "1000" lands as 10 - this field fills from the cents end (see
        // C-TC-025). Read back numerically rather than as a string.
        await coffee.typePaymentField('Amount*', '1000');
        expect(Number(await coffee.getPaymentFieldValue('Amount*'))).toBe(10);
        await coffee.tapPaymentDone();
        // Accepted = the Payment screen closes and we are back on Signing
        // Order, rather than held there by a validation message.
        await expect
          .poll(() => coffee.isOrderPaymentScreenVisible().catch(() => true), { timeout: 20_000 })
          .toBe(false);
        expect(await coffee.isSigningOrderTitleVisible()).toBe(true);
        console.log(`[C-TC-038/040] signing order after payment: ${await coffee.getVisibleScreenText()}`);
      });

      // ---- everything below this line is IRREVERSIBLE ----
      await test.step('C-TC-038/040: signing off enables Continue', async () => {
        expect(await coffee.isDeliveryContinueEnabled()).toBe(false);
        await coffee.openSignOff();
        expect(await coffee.isSignOffEnabled()).toBe(false);
        await coffee.drawSignature();
        await expect.poll(() => coffee.isSignOffEnabled(), { timeout: 20_000 }).toBe(true);
        await coffee.submitSignOff();
        // The signature is what unlocks Continue - the "signature state" clause
        // both cases make, asserted as the gate it actually controls.
        await expect.poll(() => coffee.isDeliveryContinueEnabled(), { timeout: 20_000 }).toBe(true);
      });

      await test.step('C-TC-040: the delivery is marked complete on the Coffee menu', async () => {
        await coffee.tapDeliveryContinue();
        await driver.pause(2_500);
        await expect.poll(() => coffee.isChecklistTileComplete('Delivery'), { timeout: 20_000 }).toBe(true);
      });

      await test.step('C-TC-038: the Coffee service is marked complete', async () => {
        // The tile above means SIGNED. The service is not finished until
        // Complete Delivery is tapped, and the station's own progress is the
        // unambiguous signal - see the C-TC-013 batch's note on the run that
        // passed the tile check while progress was still 0.
        expect(await coffee.isVisible('~Complete Delivery')).toBe(true);
        await coffee.tap('~Complete Delivery');
        await driver.pause(3_000);
        console.log(`[C-TC-038/040] after Complete Delivery: ${await coffee.getVisibleScreenText()}`);
        // The STATION's own tick is the assertion - see C-TC-039's note on why
        // the LOB card's percentage is the wrong instrument here (it spans
        // every station under the card, so a multi-station stop never reads
        // 100 off one completed service).
        console.log(`[C-TC-038/040] coffee card progress = ${await dashboard.getServiceStationProgress('coffee')}`);
        expect(await dashboard.isNthServiceStationComplete('coffee', 'first')).toBe(true);
      });
    }
  );

  // ==== C-TC-039 (over-delivery, and completing with NO payment) ====
  //
  // "Coffee service supports presales, over-delivery, and optional payment on
  // Signing Order" -> "ordered and delivered quantities should be shown
  // clearly; And Signing Order should complete successfully even when payment
  // is not entered".
  //
  // SCOPED TO THE EXPECTED RESULT. The scenario line also names presales, but
  // the expected result asserts nothing about them - it is context, and
  // presale creation is already covered by C-TC-010/027/031 and again by
  // C-TC-038 above. What is genuinely specific to this case is over-delivery,
  // which nothing else in this file exercises.
  //
  // Kept separate from C-TC-038/040 because it contradicts them: those record a
  // payment, this one must complete with none.
  test(
    'C-TC-039: an over-delivered quantity is shown against Ordered, and completes with no payment',
    { tag: ['@Coffee-C-TC-039'] },
    async ({ driver }) => {
      test.setTimeout(1_200_000);
      const prepTasks = new PrepTasksScreen(driver);
      const dashboard = new DashboardScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      await test.step('Reach a Coffee stop with a workable delivery', async () => {
        const stop = await reachCoffeeStop(
          driver,
          'coffee-over-delivery',
          async (c) => {
            await c.openDelivery();
            if (!(await c.isDeliveryContinueEnabled())) return false;
            // The Delivered field must still be EDITABLE, which is NOT implied
            // by Continue being enabled. On a station this suite completed
            // minutes earlier the row still renders (ordered quantity and all)
            // and Continue is still enabled, but the quantity field is gone -
            // and setDeliveredQuantity then fails on a missing element rather
            // than on anything the case is about. A stop only qualifies if the
            // journey can actually be walked.
            if (!(await c.isDeliveredQtyFieldVisible())) return false;
            // The delivery must be genuinely EDITABLE. Asserted by probing an
            // edit rather than by reading a flag - see isDeliveryEditable for
            // why the Delivery tile's green does not answer this.
            const editable = await c.isDeliveryEditable();
            if (!editable) {
              console.log('[qualify] rejected: delivery not editable');
              return false;
            }
            // Discards the probe's throwaway value AND answers the Save
            // Changes prompt that modifying it raises - without which this
            // lands on that dialog and every station is rejected.
            await c.leaveDeliveriesScreen(false);
            // Requiring an editable delivery is affordable only because
            // attempt() now walks EVERY service station: a stop whose first
            // station this suite already signed still has a fresh second one
            // behind it. Before that, this requirement emptied the route.
            const completeDelivery = await c.isVisible('~Complete Delivery');
            if (!completeDelivery) {
              console.log(`[qualify] NOT on the checklist. Screen = ${await c.getVisibleScreenText()}`);
            }
            console.log(`[qualify] editable=true completeDelivery=${completeDelivery}`);
            return completeDelivery;
          },
          []
        );
        console.log(`[C-TC-039] stop = "${stop}"`);
      });

      let ordered = 0;
      await test.step('C-TC-039: the ordered quantity is shown on the delivery row', async () => {
        await coffee.openDelivery();
        const row = await coffee.getFirstDeliveryProductRowText();
        console.log(`[C-TC-039] delivery row = ${row}`);
        // The row concatenates product, packaging, price, the "Ordered" label
        // and its value into ONE content-desc - so the ordered quantity is
        // parsed out of it rather than read from a field of its own.
        expect(row).toContain('Ordered');
        const match = row.match(/Ordered\s+(\d+)/);
        expect(match, `could not read an ordered quantity from "${row}"`).not.toBeNull();
        ordered = Number(match![1]);
        expect(ordered).toBeGreaterThan(0);
      });

      const overDelivered = () => ordered + 4;
      await test.step('C-TC-039: delivering MORE than ordered is accepted and both are shown', async () => {
        await coffee.setDeliveredQuantity(String(overDelivered()));
        expect(Number(await coffee.getDeliveredQty())).toBe(overDelivered());
        // "shown clearly" means BOTH at once - the over-delivered figure must
        // not overwrite or hide what was ordered. Re-read the row rather than
        // trusting the value captured before the edit.
        const rowAfter = await coffee.getFirstDeliveryProductRowText();
        console.log(`[C-TC-039] ordered=${ordered} delivered=${overDelivered()} row=${rowAfter}`);
        expect(rowAfter).toContain('Ordered');
        expect(rowAfter).toMatch(new RegExp(`Ordered\\s+${ordered}\\b`));
        expect(await coffee.isDeliveryContinueEnabled()).toBe(true);
      });

      await test.step('C-TC-039: Signing Order is reached with no payment entered', async () => {
        await coffee.tapDeliveryContinue();
        expect(await coffee.isSigningOrderTitleVisible()).toBe(true);
        // The Payment row exists and is deliberately left alone - "optional
        // payment" is the case's own wording, and Anthony confirmed only the
        // sign-off gates Continue.
        expect(await coffee.isSummaryLineVisible('Payment')).toBe(true);
        expect(await coffee.isDeliveryContinueEnabled()).toBe(false);
      });

      // ---- everything below this line is IRREVERSIBLE ----
      await test.step('C-TC-039: the order completes successfully without payment', async () => {
        await coffee.openSignOff();
        await coffee.drawSignature();
        await expect.poll(() => coffee.isSignOffEnabled(), { timeout: 20_000 }).toBe(true);
        await coffee.submitSignOff();
        await expect.poll(() => coffee.isDeliveryContinueEnabled(), { timeout: 20_000 }).toBe(true);
        await coffee.tapDeliveryContinue();
        await driver.pause(2_500);
        await expect.poll(() => coffee.isChecklistTileComplete('Delivery'), { timeout: 20_000 }).toBe(true);

        expect(await coffee.isVisible('~Complete Delivery')).toBe(true);
        await coffee.tap('~Complete Delivery');
        await driver.pause(3_000);
        console.log(`[C-TC-039] after Complete Delivery: ${await coffee.getVisibleScreenText()}`);
        // Asserted on THIS STATION's own tick, not on the LOB card's
        // percentage. getServiceStationProgress reads the card, which spans
        // every station under it - on a 2-station stop one finished station is
        // legitimately 50, and an earlier version of this step demanded 100 and
        // failed on a stop that had done nothing wrong. The card's figure is
        // logged as evidence instead.
        console.log(`[C-TC-039] coffee card progress = ${await dashboard.getServiceStationProgress('coffee')}`);
        expect(await dashboard.isNthServiceStationComplete('coffee', 'first')).toBe(true);
      });
    }
  );

  // ==== C-TC-043 - NOT REACHABLE ON COFFEE (there is no Complete Stop) ====
  //
  // "App navigates to Schedule after Complete Stop is selected" -> "Then the
  // app should navigate to the Scheduled screen". Cross-App case, sub-feature
  // "Vending/Market/coffee".
  //
  // NOT AUTOMATED HERE, on evidence rather than assumption. Written, run, and
  // then withdrawn 2026-08-28 - what it found is recorded because it is worth
  // more than the test would have been.
  //
  // COFFEE HAS NO "Complete Stop" BUTTON, on any stop. A stop completes
  // IMPLICITLY once all of its service stations are complete. Walked live on
  // Atrium Health, the route's only multi-station Coffee stop (2 stations):
  //
  //   before any work    - Complete Stop visible=false, 2 stations outstanding
  //   first station done - coffee card progress 50, still visible=false
  //   second done        - coffee card progress 100, still visible=false
  //   afterwards         - the stop had moved to Home's Completed tab by itself
  //
  // The single-station case behaves the same way and was established earlier
  // the same day under C-TC-020 (24Hundred Marketplace and ADI Global both
  // reached Completed with no Complete Stop ever tapped). So this is not a
  // multi-station gate that failed to open - the control does not exist on
  // this LOB. Nor does the navigation half hold: completing the last station
  // lands on the STOP DETAIL, not the Schedule.
  //
  // WHY THE FIRST ATTEMPT ASSERTED OTHERWISE.
  // DashboardScreen.isCompleteStopEnabled's note says a stop with 2+ stations
  // under one LOB shows the button, disabled until every station is actioned.
  // That note is honest about its source - live-verified on a MARKET card
  // (FedEx's "Breakroom" + "Homestead Warehouse") - and it was applied here
  // without rechecking. Same error as inheriting Coffee's camera verdict onto
  // Market: behaviour established on one LOB is not evidence about another.
  //
  // WHERE THIS CASE PROBABLY BELONGS: Market, where the button is recorded as
  // existing. Not moved unilaterally - it is a C-TC row, and re-homing it to
  // the Market suite is a call for QA, not for this file.


  // ==== C-TC-006 (delivery header shows the account location name) ====
  //
  // "Delivery header shows account location name consistently" ->
  //   (a) "the account location name should be displayed as the bolded
  //       primary header"
  //   (b) "the same account location name should persist across Coffee
  //       delivery and product screens"
  //   (c) "the header should show account location name instead of equipment
  //       identifier"
  //
  // This was recorded HELD since 2026-08-26, pending a question to Anthony
  // that the notes show was drafted and never sent. Un-held 2026-08-28 by
  // re-verifying the behaviour instead: the answer only changes what the app
  // SHOULD do, and either way the suite can assert the intended behaviour and
  // flag when it changes.
  //
  // LIVE-VERIFIED on Adams Old Castle, whose account name ("Adams Old Castle")
  // and service station name ("Adams an Old Castle - Office") differ - the only
  // circumstance in which any of this is observable at all. On a stop where the
  // two coincide (24Hundred Marketplace) every clause looks satisfied whether
  // or not it is, which is precisely why the stop is DISCOVERED by that
  // difference rather than named.
  //
  //   checklist header  - the SERVICE STATION name. Not the account name.
  //   Deliveries        - neither name appears
  //   Pre-sales         - BOTH names appear
  //   Equipment audit   - neither name appears
  //
  // So (a) does not hold, and (b) holds on Pre-sales but not on Deliveries or
  // Equipment audit - inconsistent rather than simply absent, which is the
  // more useful thing to report. (c) is satisfied only in the weak sense that
  // a station name is not an equipment identifier.
  //
  // Split into a PASSING test and a FAILING one, per this file's convention:
  // a lone test.fail() cannot distinguish "the gap is still there" from "the
  // setup broke", so the passing half proves the screens were reached and the
  // names really do differ before the failing half asserts the intent.
  test(
    'C-TC-006: the checklist header carries the service station name, and Pre-sales carries both',
    { tag: ['@Coffee-C-TC-006'] },
    async ({ driver }) => {
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      let account = '';
      let header = '';
      await test.step('Reach a Coffee stop whose header differs from its account name', async () => {
        account = await reachCoffeeStop(driver, 'coffee-header-differs', async (c, stopName) => {
          const text = (await c.getServiceStopLocationHeaderText().catch(() => '')).trim();
          return text !== '' && text !== stopName.trim();
        });
        header = (await coffee.getServiceStopLocationHeaderText()).trim();
        console.log(`[C-TC-006] account="${account}" header="${header}"`);
      });

      await test.step('C-TC-006: the header is populated, and is NOT the account name', async () => {
        expect(header).not.toBe('');
        // The finding itself. Asserted rather than merely logged so that the
        // day the header starts showing the account name, this test fails and
        // the gap below starts passing - the pair moves together.
        expect(header).not.toBe(account);
      });

      await test.step('C-TC-006: Pre-sales carries the account location name', async () => {
        // The half of clause (b) that DOES hold. Worth asserting: it shows the
        // name is available to the app on this journey, so its absence
        // elsewhere is an inconsistency rather than missing data.
        await coffee.tapAddPresaleTrigger();
        const presales = await coffee.getVisibleScreenText();
        console.log(`[C-TC-006] pre-sales screen = ${presales}`);
        expect(presales).toContain(account);
      });
    }
  );

  // The gap. Asserts what C-TC-006 actually asks for, so it flags the day the
  // app satisfies it. Kept separate from the test above for the reason given
  // in that block's header.
  test(
    'C-TC-006 (gap): the header should show the account location name, and it should persist onto Deliveries',
    { tag: ['@Coffee-C-TC-006'] },
    async ({ driver }) => {
      test.fail();
      test.setTimeout(900_000);
      const prepTasks = new PrepTasksScreen(driver);
      const coffee = new CoffeeServiceScreen(driver);
      const home = new HomeScreen(driver);

      await test.step('Log in, ensure Charlotte 103/YESTERDAY, complete Start Day', async () => {
        await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'YESTERDAY' });
        await prepTasks.openFromHamburgerMenu();
        await prepTasks.ensureFullDayPrepComplete();
        await home.returnToHome();
      });

      let account = '';
      await test.step('Reach a Coffee stop whose header differs from its account name', async () => {
        account = await reachCoffeeStop(driver, 'coffee-header-differs', async (c, stopName) => {
          const text = (await c.getServiceStopLocationHeaderText().catch(() => '')).trim();
          return text !== '' && text !== stopName.trim();
        });
      });

      await test.step('C-TC-006 (a): the bolded primary header should be the account location name', async () => {
        expect((await coffee.getServiceStopLocationHeaderText()).trim()).toBe(account);
      });

      await test.step('C-TC-006 (b): that name should persist onto the Deliveries screen', async () => {
        await coffee.openDelivery();
        expect(await coffee.getVisibleScreenText()).toContain(account);
      });
    }
  );

});
