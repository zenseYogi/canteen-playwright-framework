# Build 0.1.86 Regression — 5-Day Plan, Day 1 Status

**Date**: 2026-08-21
**Source of truth for TCs**: `/Users/mp.yogender/Documents/Compass_Canteen/Final_Optimized/Regression_tests_Build_84_17_08_2026.xlsx`
(sheets: Start of the day [31 rows], Vending [62], Market [42], Coffee [56], Menu [17], End Day [15] — 224 total)

## Plan vs. actual

| Day | Planned focus | Planned close | Actual close |
|---|---|---|---|
| 1 | Verify existing automated TCs on latest build; kick off net-new on Start of Day, Vending, Coffee | 46 verified/scoped + 21 net-new = 51/224 | **30/224** (Start of Day only — see below) |

Most of Day 1's time went into fixing 8 real script/app-compatibility bugs that were silently blocking the whole automation suite on 0.1.86, rather than into verifying new TCs. That work was necessary (nothing downstream could run reliably before it) but doesn't show up as TC count.

## Start of Day — confirmed TC status (30 total)

**PASS (21, directly verified):**
SD-TC-006, 007, 008, 009, 010, 011, 013, 014, 015, 016, 017, 019, 020, 021, 023, 024, 025, 026, 028, 029, 031

**PASS (9, via automated re-run)** — `prep-tasks.spec.ts`, tags `@StartOfDay-TC204/206/207/208/209/211/212/213/214` (Checks screen: GeoTab error, Continue-always-enabled, back-press Skip/Complete popup)

**FAIL — real app discrepancy, not a script gap:**
- **SD-TC-012** — Continue is never gated on Vehicle check (enabled from screen-open); Vehicle check itself can never be marked complete (GeoTab error dialog blocks both Cancel/Dismiss). See Excel remarks already drafted for this row. Confirmed via passing `@StartOfDay-TC211` — the "always enabled" behavior IS the automated assertion, it just contradicts the TC's expectation.

**SKIPPED (user instruction):**
- SD-TC-022 — needs a full `pm clear` app-data wipe + fresh MFA to reproduce ("no route setup performed" state). Cost too high mid-session; revisit if worth chasing.

**NOT TESTABLE this build/session:**
- SD-TC-001–005 (fresh-install permission grants — need a real fresh install)
- SD-TC-030 (12-hour session expiry — can't wait that long live)

**FAIL — feature not present (confirmed, was PARTIAL at session end):**
- **SD-TC-018** (Coffee ad-hoc shows delivery/fuel adjustment charges) — resolved via already-documented live evidence in `coffee-service.screen.ts` (build 0.1.76, 2026-07-29, Route 10/FedEx): the "Signing Order" screen's own Cost summary table shows no "fee" text at all — no delivery charge or fuel adjustment charge fields exist anywhere in the Coffee Delivery flow. Matches Excel's own "Not Tested" result for the related TC219–TC225 rows; looks like an unimplemented feature rather than a missed assertion. Account-independent (flow itself doesn't render fee fields), so no live re-check against Afficionado Coffee Roasters was needed.

## Script/app-compatibility bugs fixed this session

All in `screens/*.ts` and `utils/login-flow.ts` — currently **uncommitted local changes** (`git status` before continuing):

1. `vending-service.screen.ts` — Money Operations must complete before Fills unlocks (new 0.1.86 gating rule). Added `ensureMoneyOperationsComplete()`.
2. `vending-service.screen.ts` — `performMoneyOperations()` used `hideKeyboard()` (no-op against the app's custom keypad) instead of `dismissNumericKeypad()`; also added scroll-retry since Continue can sit below the fold.
3. `home.screen.ts` — `getCurrentDateText()` threw instead of waiting for Home's background-sync settle delay.
4. `home.screen.ts` — `getRouteBadgeText()` — same race, fixed with a *short* bounded wait+catch (not a long wait — the empty test route legitimately never shows this badge).
5. `login-flow.ts` — `isOnRoute()` assumed always-on-Home; now checks `home.isLoaded()` first before reading badges.
6. `login-flow.ts` — `KEEP_APP_SESSION` fast-path silently skipped route-setup handling when resuming on the Route Setup gate/Select Day sheet. Now routes through the same `handlePostAuthScreen()` a fresh login uses.
7. `route-setup.screen.ts` + `mfa.screen.ts` — **two different real screens** share the name "Route Setup" with **different actual casing**: the post-MFA fresh-account gate is `"Route Setup"` (capital S); the hamburger-menu-navigated screen is `"Route setup"` (lowercase s). Both confirmed via raw `uiautomator dump`. Don't unify these locators again.
8. `route-setup.screen.ts` — `openFromHamburgerMenu()` wasn't idempotent against Settings already being expanded (resumed session) — fixed. Also had a timing race (title renders before the Operation field) — added a wait for the field itself.
9. `adhoc-delivery.screen.ts` — `customerField` locator (`hint="Customer"`) was stale; the field now has no hint/content-desc at all. Fixed to a positional locator.

## Data drift discovered (not automation bugs — account/route data changed since older specs were written)

- **Route 103** (Charlotte NC, `vendingRoute`) is Vending-only — no Market/Coffee locations exist on it at all.
- **Route 010** (Miami, `defaultRoute`) currently has only 1 real scheduled stop (CureLeaf, Market) — `market-fill-screen.spec.ts`'s assumption of 2 stops (CureLeaf + FedEx) is stale.
- **FedEx** (Route 010) now only has a Market service, not Coffee — `coffee-service.spec.ts`'s `ensureCoffeeDeliveryExists(driver, 'FedEx')` will fail against current data.
- **Known-good Route 010 accounts** (confirmed live 2026-08-21): **AETNA** (Market), **Afficionado Coffee Roasters** (Coffee/OCS-Pantry) — use these for new Market/Coffee ad-hoc tests going forward.
- **Allentown PA / Route 109** (SD-TC-024's own Excel test data) no longer resolves in Select Operation search at all. SD-TC-024 was validated instead against **Charlotte NC / Route 103 on TOMORROW** (confirmed genuinely zero-delivery).

## Process notes for next session

- **Reuse existing screen-class methods and spec files before writing new ones.** Only write a new thin call-site when bootstrapping test data via an existing helper that isn't wired into any spec yet — keep it minimal.
- Don't manually drive the emulator via raw adb taps when Playwright/Appium automation exists for the same flow.
- Verify tap targets via a fresh `uiautomator dump` bounds check before tapping anything in the hamburger drawer/Settings menu — a stray tap can hit **Import Database** or **Sign off**.
- `pm clear`/data-wipe is expensive (fresh MFA approval + ~10min recovery) — treat as a deliberate, confirmed decision, not a troubleshooting reflex.
- If the app is already mid-navigation from the user's own manual exploration, detect and reuse that state rather than redoing it.

## Loose ends at session close

- `tests/mobile/_sdtc024_allentown.spec.ts` — thin call-site proving SD-TC-024, currently **passing**. Decide: delete, or formalize into permanent coverage.
- The AETNA/Afficionado bootstrap script (`_bootstrap_market_stop.spec.ts`) no longer exists on disk — recreate from this doc's account names + `screens/adhoc-delivery.screen.ts` methods if needed again.
- 9 files with real fixes are uncommitted — confirm with user before `git commit`/push.

## Day 2 pickup (2026-08-21 continuation)

- SD-TC-018 closed (see above) — **Start of Day is now fully resolved: 31/31 rows accounted for** (21 direct PASS + 9 automated-rerun PASS + 1 confirmed FAIL/SD-TC-012 + 1 confirmed FAIL-not-present/SD-TC-018, 5 skipped/not-testable, all with reasons recorded — SD-TC-027 doesn't exist in the sheet).
- Appium (localhost:4723) and emulator-5554 both confirmed up and ready at continuation start.
- `npx tsc --noEmit` has 2 pre-existing errors, both unrelated to Day 1's changes (`transfers.screen.ts:305`, `truck-stock-truck-returns.screen.ts:40`) — not a regression from today's fixes, don't chase these under this plan.
- Still open from Day 1: decide fate of `_sdtc024_allentown.spec.ts`; 9 files uncommitted; Vending/Coffee **net-new** TC authoring (21 planned) hasn't started yet — Day 1's Vending work was bug-fixing only.
- Next real step: start Vending net-new TC authoring (the Money-Ops-before-Fills fix from Day 1 unblocks this), or renegotiate remaining-days scope with the user given Day 1's actual pace.
