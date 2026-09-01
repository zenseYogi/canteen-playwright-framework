import { BaseScreen } from './base.screen';
import type { Lob } from '../utils/lob';

/**
 * Home / dashboard screen - lands here after successful login + MFA.
 */
export class HomeScreen extends BaseScreen {
  // Ported from dashboard.yaml's title_deliveries - the specific element RF's
  // "Validate user is on the dashboard page" keyword waits on. Matches the
  // "Deliver" stem rather than "Deliveries" - live-verified the dashboard
  // shows singular "1 Delivery" (not "1 Deliveries") when only one stop is
  // scheduled, and "Deliveries" is not a substring of "Delivery".
  private readonly deliveriesTitle = '//android.view.View[contains(@content-desc, "Deliver")]';

  // PBI 622025 "Home Page: Dynamic data with functionality" - live-verified
  // against build 0.1.76 (Miami/010). The day badge's content-desc used to
  // be a relative label (e.g. "Yesterday, Thu 23 Jul").
  //
  // CORRECTED 2026-08-20 (build 0.1.86, live-verified via uiautomator dump):
  // this badge now shows the plain absolute date instead (e.g.
  // "August 20,2026" - no space before the comma, no leading zero on the
  // day) - the relative Today/Yesterday/Tomorrow label is gone entirely.
  // Matched by month-name prefix instead, since the day/date portion still
  // changes daily. isOnRoute() in utils/login-flow.ts had to change its
  // comparison logic to match (formats and compares an absolute date rather
  // than reading a relative-day prefix).
  private readonly currentDateBadge =
    '//android.view.View[starts-with(@content-desc,"January") or starts-with(@content-desc,"February") or starts-with(@content-desc,"March") or starts-with(@content-desc,"April") or starts-with(@content-desc,"May") or starts-with(@content-desc,"June") or starts-with(@content-desc,"July") or starts-with(@content-desc,"August") or starts-with(@content-desc,"September") or starts-with(@content-desc,"October") or starts-with(@content-desc,"November") or starts-with(@content-desc,"December")]';
  private readonly routeBadge = '//android.view.View[starts-with(@content-desc,"Route")]';
  // The "Select a day" bottom sheet's own TODAY card (content-desc packs
  // the label and date together, e.g. "TODAY\nAugust 7, 2026") - used by
  // returnToHome() to dismiss this sheet if left open.
  private readonly selectADaySheetTodayOption = '//android.view.View[starts-with(@content-desc,"TODAY")]';
  // New as of build 0.1.86 (live-verified 2026-08-20): tapping a day option
  // now raises a "Confirm Date!" dialog needing an extra tap before the
  // sheet actually closes - see RouteSetupScreen.selectDay's matching fix.
  // Without this, returnToHome()'s loop below just re-taps TODAY forever
  // against a dialog that's still sitting on top, burning the whole
  // maxBackPresses budget without ever reaching the hamburger.
  private readonly confirmDateButton = '~Confirm';
  // Live-verified: each LOB's "X/Y" count badge and its name label are
  // siblings in two separate groups under the same parent (all counts
  // first, then all labels), in the SAME per-LOB order - e.g. Market's
  // count and Coffee's count both precede both labels. Confirmed only
  // "X/Y"-shaped counts contain "/" on this screen, so lobCountBadge is
  // safe without also scoping to a specific container.
  private readonly lobCountBadge = '//android.view.View[contains(@content-desc,"/")]';
  private readonly lobLabels = '//android.view.View[@content-desc="Market" or @content-desc="Coffee" or @content-desc="Vending"]';
  // TC036 "view Edit schedule order screen" / TC018/TC020 "navigate to Edit
  // schedule order screen" (PBI 611763/630328) - live-verified: opens a
  // sheet titled "Edit Schedule Order" listing every stop's name+address.
  private readonly editScheduleButton = '~Edit schedule';
  private readonly editScheduleTitle = '~Edit Schedule Order';

  async isLoaded(): Promise<boolean> {
    return this.isVisible(this.hamburgerIcon);
  }

  /**
   * Ported from dashboard_keywords.robot's "Validate user is on the dashboard page".
   *
   * CORRECTED 2026-08-20 (build 0.1.86, live-verified): right after the new
   * post-MFA "Select Day" sheet is dismissed (see MfaScreen.waitForManualApproval),
   * the app briefly renders an interim "Start day, Route NNN" checklist screen
   * (Product collection/Money operations/Additional prep/Checks) while a
   * background sync settles, before this real Dashboard appears - the same
   * 60-90s class of sync delay RouteSetupScreen.waitForSyncAndDaySheet already
   * accounts for. BaseScreen's default 15s element timeout isn't enough here;
   * this is a real settle delay, not a broken locator - deliveriesTitle itself
   * was confirmed correct (content-desc "1 Delivery") once given time.
   */
  // Sync-failure aware as of build 0.1.92 (2026-08-31): the same "Syncing
  // failed" card that interrupts Route Setup also appears on launch, before
  // Dashboard is ever reached - hit at 21% on the first launch after
  // installing 92. Every spec funnels through here, so recovering at this
  // one point covers the whole suite. See BaseScreen.waitForWithSyncRecovery.
  async waitForDashboardLoaded(timeoutMs = 120_000): Promise<void> {
    await this.waitForWithSyncRecovery(this.deliveriesTitle, timeoutMs);
  }

  async tapStartDay(): Promise<void> {
    await this.tap(this.startDayButton);
  }

  /** TC006 "click on the Hamburger menu" - opens the nav drawer. */
  async openHamburgerMenu(): Promise<void> {
    await this.tap(this.hamburgerIcon);
  }

  /** Whether the nav drawer is open, per its own "Schedule overview" menu item - the hamburger icon itself is hidden behind the drawer once open, so this (not hamburgerIcon) is the visibility signal. */
  async isNavigationMenuVisible(): Promise<boolean> {
    return this.isVisible('~Schedule overview');
  }

  /** Closes the nav drawer via hardware back - the hamburger icon is hidden while the drawer is open, so re-tapping it isn't an option. */
  async closeHamburgerMenu(): Promise<void> {
    await this.pressKeyCode(4);
  }

  /**
   * TC007 "view the System Date" - the day/date badge in the navigation bar
   * (e.g. "Yesterday, Thu 23 Jul").
   *
   * CORRECTED 2026-08-20: callers landing on Home right after
   * returnToHome()/loginAndEnsureRoute() can beat the same background-sync
   * settle delay documented on waitForDashboardLoaded - the badge isn't in
   * the tree yet, and a bare $().getAttribute() throws "element wasn't
   * found" instead of returning ''. Waits for it first, same pattern as
   * waitForDashboardLoaded.
   */
  async getCurrentDateText(): Promise<string> {
    await this.waitFor(this.currentDateBadge, 120_000);
    const el = await this.driver.$(this.currentDateBadge);
    return (await el.getAttribute('content-desc')) ?? '';
  }

  /**
   * TC012 "view route badge" - e.g. "Route 103".
   *
   * CORRECTED 2026-08-20: the earlier "deliberately not waitFor'd" reasoning
   * below was too broad - live-verified a REAL route's badge can just as
   * easily lose the same Home-settle race as the date badge (getAttribute()
   * throwing "element wasn't found" moments after isLoaded()'s hamburger
   * check passed), not only the guaranteed-empty test route this note
   * originally had in mind. A short bounded wait (much less than
   * getCurrentDateText's 120s - this route legitimately has none to wait
   * for) that swallows its own timeout instead of throwing covers both
   * cases: a real route's badge gets the brief settle time it needs, and
   * the empty route still resolves to '' quickly rather than hanging.
   * isOnRoute() already treats '' as "check the deliveries count instead".
   */
  async getRouteBadgeText(): Promise<string> {
    await this.waitFor(this.routeBadge, 20_000).catch(() => {});
    const el = await this.driver.$(this.routeBadge);
    return (await el.getAttribute('content-desc').catch(() => '')) ?? '';
  }

  /** TC013 "view Deliveries" / TC014 "view remaining deliveries" (PBI 622025) - parsed from the shared "N Delivery/Deliveries" text. */
  async getDeliveriesCount(): Promise<number> {
    const el = await this.driver.$(this.deliveriesTitle);
    const desc = (await el.getAttribute('content-desc')) ?? '';
    return Number(/(\d+)/.exec(desc)?.[1]);
  }

  /**
   * TC015 "view Vending counter" (and the equivalent Market/Coffee counts,
   * part of PBI 622025's "dynamic" claim) - returns whichever LOBs actually
   * have a card rendered today (this screen only shows a LOB's badge when it
   * has scheduled stops - e.g. Miami/010 shows Market+Coffee, never Vending).
   */
  async getLobCounts(): Promise<Partial<Record<Lob, string>>> {
    const labelEls = await this.driver.$$(this.lobLabels);
    const countEls = await this.driver.$$(this.lobCountBadge);
    const result: Partial<Record<Lob, string>> = {};
    const labelCount = await labelEls.length;
    for (let i = 0; i < labelCount; i++) {
      const label = ((await labelEls[i].getAttribute('content-desc')) ?? '').toLowerCase() as Lob;
      const count = countEls[i] ? await countEls[i].getAttribute('content-desc') : null;
      if (count) {
        result[label] = count;
      }
    }
    return result;
  }

  async openEditSchedule(): Promise<void> {
    await this.tap(this.editScheduleButton);
    await this.waitFor(this.editScheduleTitle);
  }

  async isEditScheduleVisible(): Promise<boolean> {
    return this.isVisible(this.editScheduleTitle);
  }

  /**
   * TC036 "view Edit schedule order screen... with icon and list of stops
   * with names and addresses" - each stop row's content-desc is
   * "{address}\n{Name}" (live-verified, e.g. "19000 SW 192nd St Miami
   * Florida 33187-1908\nCureLeaf"), so this returns just the trailing name
   * line from every multi-line View on the (assumed already open) sheet.
   */
  async getEditScheduleStopNames(): Promise<string[]> {
    const els = await this.driver.$$('//android.view.View');
    const names: string[] = [];
    for (const el of els) {
      const desc = (await el.getAttribute('content-desc')) ?? '';
      if (desc.includes('\n')) {
        const parts = desc.split('\n');
        names.push(parts[parts.length - 1]);
      }
    }
    return names;
  }

  /**
   * TC037 "verify drag handle visibility" - each stop row (the same
   * multi-line View getEditScheduleStopNames() reads) renders a drag
   * handle icon on its right edge, live-confirmed visually, but with NO
   * accessible node of its own anywhere in the tree (baked into the row's
   * bitmap - see BaseScreen.hasNonWhiteIconNearRightEdge's own doc
   * comment). Returns true only if every stop row has one.
   */
  async areDragHandlesVisibleForAllStops(): Promise<boolean> {
    const els = await this.driver.$$('//android.view.View');
    const rows = [];
    for (const el of els) {
      const desc = (await el.getAttribute('content-desc')) ?? '';
      if (desc.includes('\n')) {
        rows.push(el);
      }
    }
    if (rows.length === 0) {
      return false;
    }
    for (const row of rows) {
      if (!(await this.hasNonWhiteIconNearRightEdge(row))) {
        return false;
      }
    }
    return true;
  }

  // PBI 850155 "Ad-hoc Scheduling" (TC025/027/028/029).
  //
  // TC027 "navigate to Ad-hoc delivery creation screen" - live-verified
  // 2026-07-24: the "+" icon next to the Schedule pane header has NO
  // content-desc/resource-id of its own (confirmed via dump - an unlabeled
  // clickable View), so it's targeted structurally as the immediate
  // following-sibling of the "Schedule" text. Confirmed reachable
  // regardless of whether the current day is empty or not (tested against
  // a day with 4 real deliveries) - opens an "Add Delivery" screen with a
  // Customer search field and Add Delivery / "+ Add Another Delivery"
  // buttons.
  private readonly addAdhocDeliveryButton = '//android.view.View[@content-desc="Schedule"]/following-sibling::android.view.View[1]';

  // TC025 "No deliveries available" message - UNVERIFIED locators below.
  // Live-confirmed the SHAPE of this empty state earlier the same day
  // (2026-07-24) on a genuinely zero-delivery day ("0 Delivery", "You do
  // not have an active deliveries for Fri 24 Jul. To add an ad-hoc
  // delivery, click the plus (+) icon", Start day shown disabled) - but
  // BA has since seeded data across every day on both known routes
  // (Miami/010 and Charlotte/103), so no zero-delivery day remains to
  // confirm the EXACT locator/content-desc for that message text right
  // now. Matched via the Excel's literal wording ("do not have"), tolerant
  // of the varying day/date suffix - needs re-verification once a
  // zero-delivery day exists again (tracked, not guessed away).
  private readonly noDeliveriesMessage = '//android.view.View[contains(@content-desc,"do not have")]';

  /** TC025 - true only when Deliveries is genuinely 0 AND the no-deliveries message is showing (see noDeliveriesMessage's caveat above). */
  async isDeliveriesEmptyStateVisible(): Promise<boolean> {
    const count = await this.getDeliveriesCount();
    return count === 0 && (await this.isVisible(this.noDeliveriesMessage));
  }

  /** TC025 "Start day button should be display as inactive" when there are no deliveries. */
  /**
   * Whether Home is still offering its own "Start day" CTA at all - the
   * signal that this route/day has NOT had Start Day performed yet. Live-
   * verified 2026-08-27 on Charlotte 103 / 26 Aug: the button is present
   * (enabled or not) beforehand and disappears from Home entirely once Start
   * Day completes.
   *
   * Distinct from isStartDayDisabled(), which cannot be used as a presence
   * check - isEnabled() swallows a missing element into `false`, so a
   * DISAPPEARED button and a DISABLED one both report "disabled".
   */
  async isStartDayVisible(): Promise<boolean> {
    return this.isVisible(this.startDayButton);
  }

  async isStartDayDisabled(): Promise<boolean> {
    return !(await this.isEnabled(this.startDayButton));
  }

  /**
   * TC026 - the "+" icon (Schedule Ad-hoc Delivery's own primary CTA) is
   * visible before it's tapped.
   *
   * CORRECTED 2026-08-31: this used a bare isVisible(), which checks
   * isDisplayed() ONCE with no wait, and so reported false on any route whose
   * Schedule section had not painted yet. It passed on Miami/001 (2
   * deliveries, renders instantly) and failed on Charlotte/103 (154
   * deliveries) - diagnosed by dumping 103's live tree while the "+" was
   * plainly on screen: the icon was present and exactly where the locator
   * expects it (clickable View at index 8, immediately after "Schedule"), so
   * the locator was never wrong, the check just ran too early. The 15s
   * default was not enough for 103 either - SD-TC-031 timed out on this same
   * element at 15s - so heavy routes get a longer allowance.
   */
  async isAdhocDeliveryButtonVisible(timeoutMs = 45_000): Promise<boolean> {
    const el = await this.driver.$(this.addAdhocDeliveryButton);
    return el.waitForDisplayed({ timeout: timeoutMs }).then(
      () => true,
      () => false
    );
  }

  /** TC027/TC028 - opens the Ad-hoc delivery creation screen via the "+" icon. */
  async openAdhocDeliveryCreation(): Promise<void> {
    // Same slow-render allowance as isAdhocDeliveryButtonVisible above - on a
    // 154-delivery route the default 15s tap timeout expires before the
    // Schedule row exists.
    await this.tap(this.addAdhocDeliveryButton, 45_000);
  }

  // Live-verified 2026-07-24: pressing BACK from a screen with unsaved
  // Sort/Filter selections (e.g. Vending's Product Fills) triggers a "Save
  // Changes! Your changes have not saved yet, Do you want to save?" dialog
  // (Discard/Save). A naive repeated-BACK loop presses BACK again on this
  // dialog, which just dismisses it back to the SAME screen - the very next
  // press re-triggers the identical dialog, looping forever and never
  // making progress. Must tap "Discard" explicitly instead.
  // Coffee's signature-discard prompt - see returnToHome's own note on why
  // this loop must tap "Go Back" explicitly rather than pressing BACK again.
  private readonly signatureDiscardPrompt = '//*[starts-with(@content-desc,"Are you sure?")]';
  private readonly signatureDiscardGoBack = '//android.widget.Button[@content-desc="Go Back"]';
  private readonly discardChangesButton = '~Discard';
  // A SECOND, differently-worded variant of the same dialog class - live-
  // verified 2026-08-05 on Market's Removals & Returns "Document product"
  // screen: "Save Changes / Do you want to save your changes? / No / Save"
  // (not "Discard"/"Save"). Same looping-forever risk as discardChangesButton
  // if not handled explicitly.
  private readonly saveChangesNoButton = '~No';
  // A THIRD variant, live-verified 2026-08-06 on Coffee's Pre-sales summary
  // screen ("Complete Pre-sale! Do you want to complete the pre-sale for
  // this service? / Skip pre-sale / Complete") - tapping "Skip pre-sale"
  // leaves the order as already saved (this dialog is about completing the
  // SERVICE, not discarding the order) and continues navigating back,
  // matching returnToHome's intent of leaving state alone.
  private readonly skipPresaleButton = '~Skip pre-sale';

  /**
   * Navigates back to Dashboard from wherever the app currently is - used to
   * let multiple tests share one login session (see vending-service.spec.ts)
   * instead of each paying the manual-MFA-approval cost of a fresh login.
   *
   * CORRECTED: this can't be done with plain repeated BACK presses alone -
   * live-verified this app's back-stack is NOT a simple linear chain back to
   * Dashboard. From Vending's Product Fills (after Sort/Filter, no hamburger
   * icon - only a back arrow), one BACK press reaches the machine's task
   * list (still no hamburger), a second reaches the stop-detail screen
   * ("Aaron's" - hamburger IS present here), but a THIRD exits the app
   * entirely to the OS launcher instead of reaching Dashboard - there is no
   * intermediate Dashboard entry in that back-stack to land on. So this
   * instead presses BACK only until any screen with the hamburger menu is
   * reached, then uses the app's own "Schedule overview" nav item (found in
   * the hamburger menu, live-verified) to deterministically reach Dashboard,
   * rather than continuing to guess with more back-presses. Also handles the
   * "Save Changes" dialog (see discardChangesButton) by tapping Discard
   * instead of pressing BACK again, which would otherwise loop forever.
   *
   * CORRECTED (live-verified 2026-08-06): the hardware BACK button
   * (pressKeyCode(4)) is a no-op on at least one screen (Coffee's
   * Pre-sales summary) - it neither navigates nor opens the confirm
   * dialog below, so a loop that only ever presses hardware BACK gets
   * stuck there for all maxBackPresses attempts. The on-screen back arrow
   * (BaseScreen.backButton) reliably triggers the real in-app back action
   * on that same screen. Now prefers tapping it when visible, falling
   * back to hardware BACK only when it isn't (e.g. genuinely no back
   * arrow on screen).
   */
  async returnToHome(maxBackPresses = 10): Promise<void> {
    let reachedHamburger = false;
    for (let i = 0; i < maxBackPresses; i++) {
      if (await this.isVisible(this.hamburgerIcon)) {
        reachedHamburger = true;
        break;
      }
      if (await this.isVisible(this.discardChangesButton)) {
        await this.tap(this.discardChangesButton);
      } else if (await this.isVisible(this.saveChangesNoButton)) {
        await this.tap(this.saveChangesNoButton);
      } else if (await this.isVisible(this.skipPresaleButton)) {
        await this.tap(this.skipPresaleButton);
      } else if (await this.isVisible(this.skipButton)) {
        // Prep Tasks' own back-press Skip/Complete popup (see
        // PrepTasksScreen.isBackPressPopupVisible) - live-verified
        // 2026-08-07: without this, tapping the sub-screen's back arrow
        // just opens this popup, and neither hardware BACK nor a repeat
        // backButton tap reliably dismisses it (observed oscillating
        // between the popup and the checklist screen for the full
        // maxBackPresses budget, never reaching the hamburger). Skip is
        // the same "leave without completing" semantics this loop wants.
        await this.tap(this.skipButton);
      } else if (await this.isVisible(this.signatureDiscardPrompt)) {
        // Coffee's Customer Signature screen raises "Are you sure? / Your
        // signature will be lost if you go back without saving." (Cancel /
        // "Go Back") on BACK, but ONLY once a signature has actually been
        // drawn - live-verified 2026-08-25 (build 0.1.90). A blind BACK loop
        // can never escape it: BACK on the prompt just dismisses it back to
        // the signature screen, and the next BACK re-raises it, oscillating
        // for the full maxBackPresses budget. Same trap as the Discard-changes
        // and Prep-Tasks Skip popups handled above. "Go Back" is the leave-
        // without-saving path this loop wants; Cancel would keep us here.
        await this.tap(this.signatureDiscardGoBack);
      } else if (await this.isVisible(this.selectADaySheetTodayOption)) {
        // The date badge's own "Select a day" bottom sheet (TODAY/
        // YESTERDAY/TOMORROW cards) - live-verified 2026-08-07: hardware
        // BACK does not dismiss it, leaving the loop stuck for the full
        // maxBackPresses budget. Tapping TODAY re-confirms whichever day
        // is already selected in the common case and simply closes the
        // sheet - a safe, idempotent way out regardless of which day the
        // caller actually wanted (a real day switch, if needed, happens
        // separately via RouteSetupScreen/switchRoute).
        await this.tap(this.selectADaySheetTodayOption);
        if (await this.isVisible(this.confirmDateButton)) {
          await this.tap(this.confirmDateButton);
        }
      } else if (await this.isVisible(this.backButton)) {
        await this.tap(this.backButton);
      } else {
        await this.pressKeyCode(4);
      }
      await this.driver.pause(700);
    }
    if (!reachedHamburger) {
      // LAST-RESORT RECOVERY. BACK cannot always get us home, and when it
      // cannot, the failure lands on the NEXT run rather than the one that
      // caused it - which makes it read as an unrelated login failure. Seen
      // three times: the in-app camera (which traps BACK entirely), the
      // Equipment audit's "complete audit?" loop, and - after a test that hands
      // off to Google Maps - backing out of our own last screen surfacing MAPS,
      // because the external app stays in the activity stack even once
      // activateApp has brought ours to the front.
      //
      // Relaunching is safe here: it terminates and reactivates the app WITHOUT
      // clearing data, so the login survives (see BaseScreen.relaunchApp).
      await this.relaunchApp();
      for (let i = 0; i < maxBackPresses; i++) {
        if (await this.isVisible(this.hamburgerIcon)) {
          reachedHamburger = true;
          break;
        }
        await this.pressKeyCode(4);
        await this.driver.pause(700);
      }
    }
    if (!reachedHamburger) {
      throw new Error(
        `returnToHome: no screen with the hamburger menu appeared after ${maxBackPresses} BACK presses, ` +
          'and the app could not be recovered by relaunching either'
      );
    }
    // Do NOT tap the hamburger unconditionally. If the drawer is ALREADY open,
    // that tap CLOSES it and the "Schedule overview" tap below then times out
    // against a drawer that is no longer there - which is exactly how this
    // failed on 2026-08-28, in the shared login/Start Day step rather than in
    // any test's own logic. Same non-idempotent-navigation family as the
    // Settings-expanded bug. The drawer's own item is the reliable tell that
    // it is open.
    if (!(await this.isVisible('~Schedule overview'))) {
      await this.tap(this.hamburgerIcon);
    }
    await this.tap('~Schedule overview');
    await this.scrollScheduleToTop();
    await this.waitFor(this.deliveriesTitle);
  }

  /**
   * Scrolls Home's schedule list back to the top.
   *
   * Necessary because the "Deliveries" title this method waits on is part of
   * the SCROLLING content, not a fixed header - it scrolls out of the
   * accessibility tree entirely once the list moves. Any caller that scrolled
   * looking for a stop (see DashboardScreen.scrollToAndClickLocationByName,
   * needed at all because a route can carry 150+ stops) would otherwise leave
   * every subsequent returnToHome() failing with "Deliver... still not
   * displayed" - live-hit twice on 2026-08-25, each time presenting as a
   * login failure several tests later rather than at its real cause.
   *
   * Cheap and idempotent: scrolling up on an already-top list is a no-op, so
   * this runs unconditionally rather than trying to detect whether it is
   * needed.
   */
  private async scrollScheduleToTop(maxScrolls = 15): Promise<void> {
    for (let i = 0; i < maxScrolls; i++) {
      if (await this.isVisible(this.deliveriesTitle)) {
        return;
      }
      await this.driver.executeScript('mobile: scrollGesture', [
        { left: 100, top: 600, width: 800, height: 1200, direction: 'up', percent: 1.0 }
      ]);
      await this.driver.pause(300);
    }
  }
}
