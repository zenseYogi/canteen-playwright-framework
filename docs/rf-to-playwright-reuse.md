# Robot Framework → Playwright/TS Port Plan

Source: the existing "Mobile Automation" Robot Framework + AppiumLibrary suite
(`main_keywords.robot`, `common_keywords.robot`, `dashboard_keywords.robot`,
`coffee_keywords.robot`, `market_keywords.robot`, `vending_keywords.robot`,
`prep_task_keywords.robot`, `transfers.robot`, `truck_stock_route_inventory.robot`,
`truck_stock_route_shopping.robot`, `truck_stock_truck_returns.robot`,
`yaml/*.yaml`, `test.robot`, `run_tests.py`, `custom_listener.py`,
`draw_gestures.py`). Same app (`com.canteen.nexus`), same Appium/UiAutomator2
driver as this Playwright framework — reuse is about carrying over locators
and flow logic, not reinterpreting a different stack.

## Progress tracker

| # | Phase | Key deliverables | Status |
|---|---|---|---|
| 1 | Foundational helpers | `BaseScreen` additions (`navigateTo`, `searchAndSelect`, `selectAllCheckboxes`, `swipe`, `swipeAndDelete`, `swipeAndDeleteByLabel`, `capturePhoto`, `scrollDown`), `utils/position.ts`, failure-screenshot capture in `appium.fixture.ts` | Done |
| 2 | Port RF's currently-active coverage | Dashboard-loaded check (folded into login.spec.ts); Truck Returns open/add/delete for Coffee (`truck-stock-truck-returns.spec.ts`) | Done |
| 3 | LOB service flows | `dashboard.screen.ts`, `coffee-service.screen.ts`, `market-service.screen.ts`, `vending-service.screen.ts` (no shared `lob-service.screen.ts` base - see Phase 3 notes) | Screen classes done; spec test deferred (see Phase 3 notes) |
| 4 | Transfers + Route Inventory + Route Shopping | `transfers.screen.ts`, `truck-stock-route-inventory.screen.ts`, `truck-stock-route-shopping.screen.ts` | Screen classes done; spec test deferred (see project memory) |
| 5 | Prep Tasks | `prep-tasks.screen.ts` | Screen class done; spec test written (`prep-tasks.spec.ts`) - see Phase 7 below |
| 6 | Open items / cleanup | Resolve `draw_gestures.py` usage question; re-verify fragile xpaths; try `appium:permissions` capability swap | See Phase 6 notes - permissions swap investigated (not changing), fragile-xpath re-verification blocked on device/APK access, `draw_gestures.py` usage pending your check |
| 7 | Spec authoring from `Optimized_TCs_V_2.0.xlsx` (Tier 1 + Tier 2) | `prep-tasks.spec.ts`, `market-service.spec.ts` + new assertion methods on `PrepTasksScreen`/`MarketServiceScreen`/`DashboardScreen` | Done for Tier 1 (Login + Prep Tasks, ~75 TCs) and Tier 2 (Market Money Ops + Delivery/Add Product entry, ~15 TCs) - see Phase 7 notes |

## TL;DR

- The RF suite is a mature **keyword library + locator repository**, not a
  proven, currently-green regression suite — most of `test.robot` is
  commented out. Treat every ported flow as needing fresh verification
  against the real app, not just a syntax translation.
- RF's biggest structural weakness is duplication forced by its lack of
  first-class parameterization (one keyword per LOB × sub-flow combination).
  **Don't port that duplication** — collapse it into parameterized TS
  methods.
- Locators are overwhelmingly `content-desc`-based, which is the most
  portable strategy there is. Several fragile, structurally-absolute xpaths
  need re-verification, not blind trust.
- RF's custom report/screenshot tooling (`run_tests.py`,
  `custom_listener.py`) is functionality Playwright already has natively —
  nothing to port there except turning on a config flag.

## What transfers directly vs. what needs rework

| Reuse as-is | Rework before reuse |
|---|---|
| `content-desc` locator values (the semantic identity, e.g. `"Continue"`, `"Route Inventory"`) | The RF *xpath wrapper* around them — prefer WebdriverIO's accessibility-id shorthand (`~Continue`) over `//android.widget.Button[@content-desc="Continue"]`. [deliveries-home.screen.ts](screens/deliveries-home.screen.ts) already does this (`~Start day`, `~Edit schedule`) — follow that existing convention. |
| Placeholder-templated locators (`route_to_click_on_to_modify`, `record_to_delete_xpath`) | RF's two-step "declare template, then `Replace String`" → a single TS arrow-function locator, exactly the pattern already used in `deliveries-home.screen.ts`'s `scheduleItem = (name) => ...` |
| The overall flow/sequence of taps per screen | The one-keyword-per-LOB-per-subflow duplication in `transfers.robot` / `truck_stock_route_inventory.robot` / `truck_stock_truck_returns.robot` → one parameterized method taking `lob`/`transferType`/`count` args |
| `main_keywords.robot`'s capability list as a reference | Its literal shape — `appium.fixture.ts` already grants permissions via `adb pm grant` in a loop; RF instead relies on `appium:autoGrantPermissions=True` + explicit `appium:permissions={"android.permission.CAMERA":"grant"}` capabilities. Worth trying that capability-driven approach as a simplification, since it's proven to work in RF's session. |
| `custom_listener.py`'s intent (screenshot + artifact on failure) | Not its mechanism — Playwright's `use: { screenshot: 'only-on-failure', trace: 'retain-on-failure' }` (see Tooling section) replaces it outright and captures strictly more (full action timeline, not one static image). |
| `Set Global Variable` state-passing (`truck_stock_route_shopping.robot`) | Not portable as-is and shouldn't be — becomes a plain return value passed explicitly to the next call. |

## Locator hygiene findings (from the `yaml/*.yaml` files)

**Duplicate/colliding names across RF variable files** — dedupe these into one shared source when porting:
- `coffee_tab` / `market_tab` / `vending_tab` declared identically in both `transfers.yaml` and `truck_stock.yaml`.
- `back_button` (`common.yaml`) and `prep_task_sub_options_screen_back_button` (`prep_tasks.yaml`) resolve to the same deep, fragile frame-based xpath.
  **Correction (found during Phase 4)**: `transfer_to_screen_back_button` (`transfers.yaml`) is NOT the same locator despite the similar name/purpose - it's a bare, generic `//android.widget.Button` (matches the first Button on screen), not the fragile deep path. This doc originally lumped all three together; only the first two are actual duplicates.
- `signing_order_title` is declared twice within `coffee.yaml` itself.
- `route_to_click_on_to_modify` and `route_to_warehouse_to_delete` (`transfers.yaml`) are the exact same xpath under two names.
- `record_to_delete_xpath` (`transfers.yaml`) and `route_inventory_record_to_delete_xpath` (`truck_stock.yaml`) are the exact same xpath under two names - collapsed into `BaseScreen.recordByHint()`.
- `edit_record_added_product` (`truck_stock.yaml`) is that same xpath shape again, under a third name.

**Fragile, structurally-absolute xpaths** — no semantic anchor, break on any layout change, several have commented-out prior versions in the YAML already (evidence they've broken and been recalibrated before). Re-verify against the current build before trusting; don't port on faith:
- ~~`delivery_location_list`~~ **Live-verified BROKEN against build 0.1.73 (0 matches), fixed** — see Live verification findings below.
- `capture_photo_button`, `back_button`/its aliases, `delivery_location`, `add_product_damaged_field`, `truck_returns_delete_product_icon`, `bag_code`/`market_replenishment_*`/`market_refund_textfield` (positional `EditText[n]` with no other anchor) — still unverified against the live app.

**Case-sensitive data** — ~~preserve exactly, not "fix"~~ **correction: this was wrong, not a real app quirk.** `market_LOB` matched `contains(@content-desc,"Market")` (capitalized) while `coffee_LOB`/`vending_LOB` matched lowercase. This doc originally assumed the capitalization was a real inconsistency in the app's own labels, worth preserving verbatim. Live verification against build 0.1.73 disproved that: the actual per-location LOB card's content-desc is lowercase `"market\n1 Service stations "`, matching coffee/vending's convention. Fixed in `DashboardScreen` and `MarketServiceScreen`.

**Position → index conversion has a real off-by-one to watch.** RF has two separate "position to index" keywords: one 0-based (used for direct array indexing, `${array}[i]`), one 1-based (used to build an XPath positional predicate `[i]`, which is 1-indexed). If the TS port standardizes on `$$(selector)[index]` (0-based array access) everywhere, only one conversion function is needed — but if any code still builds an xpath position string, mixing the two conventions would silently select the wrong list item rather than fail loudly. Write one `positionToIndex()` util and audit every call site for which convention it expects.

## Shared `BaseScreen` additions needed

These come up in nearly every RF keyword file and should be added once to [base.screen.ts](screens/base.screen.ts) rather than reimplemented per screen:

```ts
// Navigation — replaces the hamburger→menu-item→wait-for-title preamble
// duplicated at the top of ~90% of prep_task/transfers/truck_stock keywords.
async navigateTo(menuItemSelector: string, expectedTitleSelector: string): Promise<void>

// Generic search-and-select — used by prep_task, transfers, and both
// truck_stock files identically ("Search for X and click on the Nth record").
async searchAndSelect(searchFieldSelector: string, value: string, position?: number): Promise<string>

// Swipe-to-delete, mode 1: locator is already known (transfers.robot, truck_stock_route_inventory.robot).
// Computes the delete-icon locator internally by appending a fixed xpath
// suffix (/android.widget.Button) to rowSelector, matching RF's own keyword
// shape exactly.
async swipeAndDelete(rowSelector: string): Promise<void>

// Swipe-to-delete, mode 2: resolve the row by matching an attribute against
// a label first, then swipe by computed index (truck_stock_truck_returns.robot's
// "Truck Returns swipe Left and click on the delete button").
async swipeAndDeleteByLabel(listSelector: string, label: string): Promise<void>

// Before/After photo capture, including the "may or may not show a camera
// permission prompt" conditional from common_keywords.robot.
async capturePhoto(triggerSelector: string): Promise<void>

// mobile: scrollGesture — same Appium extension RF calls via execute_script;
// WebdriverIO exposes it identically via driver.executeScript(...).
async scrollDown(opts?: { left?: number; top?: number; width?: number; height?: number; percent?: number }): Promise<void>
```

Plus a standalone pure-logic util (no driver dependency, so it doesn't belong on `BaseScreen`):

```ts
// utils/position.ts
export function positionToIndex(position: 'first' | 'second' | 'third' | 'fourth', base: 0 | 1 = 0): number
```

## File-by-file port mapping

| RF source | Planned TS equivalent | Notes |
|---|---|---|
| `main_keywords.robot` | [fixtures/appium.fixture.ts](fixtures/appium.fixture.ts) + [config/mobile.config.ts](config/mobile.config.ts) — already exist | Consider adopting RF's `appium:permissions` capability instead of the current adb-loop workaround |
| `common_keywords.robot` | `BaseScreen` additions above + `utils/position.ts` | Highest-leverage file — everything else depends on these |
| `dashboard_keywords.robot` | new `screens/dashboard.screen.ts` | Location list + LOB click; complements existing `HomeScreen` |
| `coffee_keywords.robot`, `market_keywords.robot`, `vending_keywords.robot` | `screens/coffee-service.screen.ts`, `screens/market-service.screen.ts`, `screens/vending-service.screen.ts` - three separate classes, **not** a shared base (see Phase 3 notes: the three flows diverge too much in shape) | `BaseScreen.selectServiceLocation()` covers the one piece that genuinely was identical (click the Nth service location under a LOB tab) |
| `prep_task_keywords.robot` | new `screens/prep-tasks.screen.ts` | Skip/Complete are identical shape across Money Ops/Additional Prep/Checks sub-screens — one parameterized method, not six |
| `transfers.robot` | new `screens/transfers.screen.ts` | `addProduct(lob, transferType, opts)`, `editAndDelete(...)`, `deleteRoute(...)` — collapses ~30 RF keywords into a handful of parameterized methods |
| `truck_stock_route_inventory.robot` | new `screens/truck-stock-route-inventory.screen.ts` | Parameterize on `lob` × `'audit' \| 'cycle'` |
| `truck_stock_route_shopping.robot` | new `screens/truck-stock-route-shopping.screen.ts` | `addProduct()` returns the product name directly instead of RF's `Set Global Variable` |
| `truck_stock_truck_returns.robot` | new `screens/truck-stock-truck-returns.screen.ts` | Uses `swipeAndDeleteByLabel` (the enumerate-and-match variant) |
| `all_keywords_yaml.robot` | — | Pure resource aggregator; TS's normal import graph replaces this, nothing to port |
| `yaml/*.yaml` | inline `private readonly` locator fields per Screen class (matches existing convention in `home.screen.ts`/`deliveries-home.screen.ts`) | Dedupe repeated constants (`back_button` family, `*_tab` family) into one shared definition each |
| `test.robot`, `run_tests.py`, `custom_listener.py` | `tests/mobile/*.spec.ts` + `playwright.config.ts` `use` block | Port only the RF test cases that are actually active (see below); the rest are unproven and need fresh validation, not translation |
| `draw_gestures.py` | **open question** — see below | Not obviously called by any active keyword; confirm before deciding whether to port |

## Tooling parity — implemented in the fixture, not config

**Correction from the original plan**: `playwright.config.ts`'s `screenshot`/`trace` options only apply to a Playwright-launched browser `page` — this project never creates one (`driver` is a standalone WebdriverIO/Appium session), so that config would have been a silent no-op. Verified via `grep` that no spec or fixture touches `page`.

The actual working equivalent of `custom_listener.py`'s `end_test` hook (capture + embed a screenshot on FAIL) now lives in [fixtures/appium.fixture.ts](fixtures/appium.fixture.ts): the `driver` fixture takes `testInfo` as its third argument, and after `use(driver)` resolves, checks `testInfo.status !== testInfo.expectedStatus` — if so, it calls `driver.saveScreenshot()` and `testInfo.attach()` so the image shows up in the HTML report, same as RF's listener did via AppiumLibrary's `capture_page_screenshot`.

Tag-based filtering (`run_tests.py`'s `--include`/`--exclude`) maps to Playwright's `--grep`/`--grep-invert` — no code needed, just CLI usage.

## Suggested sequencing

1. **Foundational helpers** — `BaseScreen` additions + `utils/position.ts` + the `playwright.config.ts` tooling tweak. Everything downstream depends on these; low risk, no app-flow logic yet.
2. **Port what's actually active in `test.robot` today** — dashboard-loaded check, Truck Returns open/add/delete for Coffee. This is RF's only currently-exercised coverage, so it's the lowest-risk, highest-confidence starting point.
3. **LOB service flows** (Coffee/Market/Vending dashboard → service) — these exist in `test.robot` but are commented out, meaning they're written but not currently verified. Port the shared `lob-service.screen.ts` base first, then the three thin subclasses; expect to re-verify locators live rather than trust them.
4. **Transfers + Route Inventory + Route Shopping** — the largest duplication payoff from parameterization; do these together since they share `searchAndSelect`/`swipeAndDelete` patterns most heavily.
5. **Prep Tasks** — the multi-screen sequential flow, once the navigation/skip/complete helpers are solid.
6. **Resolve the `draw_gestures.py` question** — confirm with whoever owns the RF suite whether it's wired into a live signature-capture step; if so, rebuild it on `BaseScreen.tapAt()`'s W3C pointer actions rather than porting the deprecated `TouchAction` API.

## Phase 2 notes

- **Architecture mismatch found**: RF's `test.robot` never automates Login at all — `Suite Setup` just launches the app and its dashboard-check test case assumes an already-authenticated session. This Playwright fixture instead does `pm clear` before every single test, so Dashboard/Truck Returns/etc. are only reachable after the full Login -> Password -> manual-MFA-approval flow. Rather than duplicate that flow in a new file just to re-assert something `login.spec.ts` already proves, the RF-faithful check (`HomeScreen.waitForDashboardLoaded()`, using `dashboard.yaml`'s `title_deliveries` locator) was folded into `login.spec.ts`'s existing final step.
- Added `utils/login-flow.ts` (`loginAndWaitForMfa(driver)`) so every future phase's spec can reach an authenticated state without re-duplicating the 5-step preamble. `login.spec.ts` itself was left untouched otherwise (still has its own inline `test.step()`s) to avoid touching an already-working test.
- RF's three active Truck Returns test cases (open / add / delete) were consolidated into one Playwright test with `test.step()`s per action, rather than three separate tests each repeating the login+MFA-wait preamble — MFA's manual-approval wait is expensive enough that 3x repetition per run isn't practical.
- Deduped two more instances of the hamburger-icon locator that surfaced while implementing this phase: `HomeScreen`'s old `navMenuButton` and `MfaScreen`'s `homeScreenAnchor` were both identical to `BaseScreen.hamburgerIcon` - both now reuse the inherited constant.
- RF's own add/delete keywords for Truck Returns > Coffee used different search terms ("co" vs "man") for what should be the same kind of lookup - an inconsistency in the source, not a real distinction. The port uses one consistent term.

## Phase 3 notes

- **Corrected the plan doc's own assumption**: `coffee_keywords.robot` / `market_keywords.robot` / `vending_keywords.robot` are NOT parallel in shape the way Transfers/Route-Inventory are. Coffee's delivery flow includes full document-signing/signature capture; Market's "delivery" is just a wait-and-continue; Vending has no delivery step at all. Built three separate screen classes (`CoffeeServiceScreen`, `MarketServiceScreen`, `VendingServiceScreen`) instead of forcing a shared `lob-service.screen.ts` base. The one piece that genuinely was identical across all three LOB files - "click the Nth service location under a LOB tab" - became `BaseScreen.selectServiceLocation(lobIconSelector, position)`.
- **Found RF's variable scoping is effectively suite-global, not per-file**: `market_keywords.robot`'s "Market Perform Money operations" keyword uses `${bag_code}`, `${market_replenishment_amount_coins_textfield}`, etc., none of which are declared in any yaml file `market_keywords.robot` itself imports - they live in `coffee.yaml`. This only works in RF because `test.robot` also loads `coffee_keywords.robot` in the same suite, making its variables globally visible by accident. Possibly this means Money Operations is a genuinely shared, LOB-agnostic screen in the real app - worth confirming - but `performMoneyOperations()` stayed on `MarketServiceScreen` for now, matching where RF's own keyword lived.
- **Found a likely-broken RF keyword, never caught because it's unreferenced by any active test**: `vending_keywords.robot`'s "Perform Vending Money Operations" references `${money_operations_continue_button}`, a variable that doesn't appear to be declared anywhere in the yaml files reviewed. `VendingServiceScreen.performMoneyOperations()` substitutes the shared Continue button as the most plausible stand-in - flagged in code, needs confirming against the real app.
- **Found a stub keyword whose name overpromises**: Vending's "Perform Vending fills by searching for X and clicking on the Nth record..." takes search-term/position arguments but its body never uses them - it just opens Fills and continues, no search happens. Ported as `openFillsAndContinue()`, named for what it actually does; a real search-driven fills flow doesn't exist yet in the RF source to port.
- Not reproduced: RF's `Perform Removals & Returns` keyword appended a stray literal `"zs"` to the theft-field value (`${theft value}zs`) - a paste-o, not intentional test data.
- **No end-to-end spec test written yet for these three screens** - see below.

## Phase 4 notes

- **Corrected `BaseScreen.swipeAndDelete`'s signature from Phase 1**: RF's real `Swipe Left and click on the delete button` keyword only takes the row locator + a value to substitute into it - it derives the delete-icon locator *internally* by appending a fixed xpath suffix (`/android.widget.Button`, confirmed from the untruncated source) to that same row locator, rather than taking the icon as a separate argument. Phase 1's two-argument version didn't match this; changed to one argument (`swipeAndDelete(rowSelector)`), matching RF's real shape exactly.
- Hoisted three more genuinely-shared pieces to `BaseScreen` once a third consumer appeared: `lobTabSelector(lob)` (coffee/market/vending tab locators - now used by Truck Returns, Transfers, and Route Inventory), `navMenuTruckStockCollapsed` (Truck Returns, Route Inventory, Route Shopping all expand the same collapsible nav group), and `recordByHint(name)` (the `EditText[contains(@hint,...)]` template - identical across `transfers.yaml` and `truck_stock.yaml` under three different names).
- **Two genuinely different user journeys, kept as two methods, not one parameterized flow**: Transfers' "Add a product" (creates a brand-new route/warehouse transfer via `add_product_button` + route selection, reading the target route's `content-desc` dynamically) and "Edit and Add a product" (adds to an already-existing route/warehouse by clicking its row directly, using a hardcoded route label) are different flows in the RF source, not a parameter difference - ported as `addProduct()` and `editAndAddProduct()`.
- RF's single-add keywords targeted "Route 001" while its bulk-add keywords targeted "Route 002" for the exact same routeToRoute flow - preserved as a `routeNumber` parameter (default 1) on `TransfersScreen.addProduct()` rather than hardcoded, so the difference is a call-site choice, not two code paths.
- **Found another redundant-but-harmless RF pattern, not reproduced**: `truck_stock_route_inventory.robot`'s bulk-add keyword manually clicks/clears/types "can" into a scoped search field on every loop iteration, then immediately calls the shared search-and-select keyword which does the identical click/clear/type against what's very likely the same visible field. `TruckStockRouteInventoryScreen.addProduct()` just calls `searchAndSelect()` once per iteration.
- **No end-to-end spec test written yet for Transfers/Route Inventory/Route Shopping** - unlike Phase 3, the underlying keyword logic here is internally consistent (no stub methods, no inconsistent partial drafts), it's specifically the `test.robot` wiring that's commented out for all of it. Held off pending the same kind of decision as Phase 3.

## Phase 5 notes

- Skip is identically shaped across all four prep-task sub-screens (Product Collection, Money Operations, Additional Prep, Checks) - `PrepTasksScreen.skipSubScreen(trigger)`. Complete is identical for the latter three but NOT Product Collection, which has an extra photo-capture step afterward (RF's Complete flow there waits for the camera shutter to auto-appear rather than tapping a trigger + Take Photo first, so it doesn't reuse `BaseScreen.capturePhoto()` - a different shape than the before/after-photo helper). Kept as `completeSubScreen(trigger)` + a separate `completeProductCollection()`.
- Ported "Validate user is able to complete the prep task successfully" faithfully as one method (`completeFullDayPrep()`), including two sub-steps the RF source itself had commented out (Product Collection's "Select All Checkboxes", and the Checks screen's vehicle-check-checkbox + Dismiss popup) - noted in the method's doc comment rather than silently reproduced or silently dropped, since this is a single, internally-consistent keyword (unlike Phase 3's problem of *inconsistent* commenting across sibling LOB drafts), so it was safe to port as-is.
- Two more duplicate-locator finds, resolved by hoisting to `BaseScreen`: `prep_tasks_continue_button` (`prep_tasks.yaml`) is the exact same value as the already-shared `continueButton`; `dashboard.yaml`'s `start_day_button` and `prep_tasks.yaml`'s `prep_task_start_day_button` are the same xpath - now `BaseScreen.startDayButton`, used by both `HomeScreen` and `PrepTasksScreen` (and the pre-existing example file `deliveries-home.screen.ts` had its own third copy under the same name, which had to be removed to avoid a property-type collision with the newly-hoisted one).
- `prep_task_sub_options_screen_back_button` (`prep_tasks.yaml`) really is identical to `back_button` (unlike `transfers.yaml`'s `transfer_to_screen_back_button`, corrected in Phase 4 notes) - reuses `BaseScreen.backButton` as-is.
- No spec test written, per the standing plan (see project memory / [[rf-port-spec-test-plan]]): spec authoring across all phases waits until the Manual Test Case doc + APK are available.

## Phase 6 notes

- **`appium:permissions` capability swap - investigated, decided against changing it.** `appium.fixture.ts`'s own existing comment documents that `appium:autoGrantPermissions: true` was already tried and found unreliable for this app specifically - the camera permission prompt still surfaced after a fresh `pm clear`, blocking the WebView underneath. The adb `pm grant` loop is the fallback that was built *because* the capability-based approach failed in practice. `appium:autoGrantPermissions` is already set in the fixture's capabilities today (it just isn't sufficient alone). There's no emulator/device available in this environment to test whether the more targeted `appium:permissions` capability (pre-granting specific permissions before session start, a different mechanism than `autoGrantPermissions`) behaves any better - swapping proven, hard-won-reliable infrastructure for an unverified alternative on a guess would be a real regression risk. Left as-is.
- **Fragile xpath re-verification** - genuinely needs a live device/APK to check locators against the real app; this isn't something that can be resolved by reading code. Rides along with the same upcoming step as the deferred spec-file work (see project memory) - both need real device access, not a separate task.
- **`draw_gestures.py` usage** - still unresolved; the user is checking whether `draw_letter_a` is actually called from any RF keyword (e.g. the signature-capture step in `coffee_keywords.robot`) or is an orphaned/experimental file. `CoffeeServiceScreen.performDelivery()`'s signature step currently just taps the signature pad twice (matching what's actually in `coffee_keywords.robot`) - if `draw_gestures.py` turns out to be wired in elsewhere, that step should be rebuilt on `BaseScreen.tapAt()`'s W3C pointer actions rather than the deprecated `TouchAction` API `draw_gestures.py` uses.

## Live verification session (build 0.1.73, Excel `Optimized_TCs_V_2.0.xlsx`)

With the Pixel_7 emulator running the real APK and the user logged in, this session live-verified several things via `adb`/`uiautomator dump` (converted to Appium's actual tag-per-classname page-source format, not raw dump format, to test xpaths faithfully) rather than reading code:

- **Login/Password coordinate-tap stopgap confirmed still necessary and still accurate**: `uiautomator dump` shows the Login screen is genuinely `class="android.webkit.WebView"` with `NAF="true"`; `adb shell cat /proc/net/unix | grep webview_devtools` is still empty. `LoginScreen.enterLoginId()`'s exact tap math (`width×0.5, height×0.39`) and `typeViaAdb`'s mechanism were both tested directly against the real screen and work.
- **`PrepTasksScreen` fully confirmed** — every locator tested (`productCollection`, `moneyOperations`, `additionalPrep`, `checks`, `productCollectionTitle`, `multipleCheckboxes`, plus the shared `addProductButton`/`continueButton`/`startDayButton`) matched exactly.
- **Two real bugs found and fixed** in `DashboardScreen`/`MarketServiceScreen` — see the Locator hygiene section above (`deliveryLocationList` was 0 matches, `marketLob` was wrong-cased).
- **Major structural discovery**: a **"Start Day" gate** blocks entry into any LOB service flow (Coffee/Market/Vending) until Prep Tasks (Product Collection → Money Operations → Additional Prep → Checks) is completed. Confirmed via an in-app dialog ("Looks like you haven't completed your start day checks..."). This dependency exists nowhere in the RF suite or in our Phase 3 screen design — any real end-to-end spec for a LOB service flow needs to run Prep Tasks first. Not yet encoded as a prerequisite anywhere in the port.

### Two-angle readiness analysis (against `Optimized_TCs_V_2.0.xlsx`)

**Angle 1 - can we automate the Mandatory(P1) test cases?** Of 322 total Mandatory(P1) cases, only 157 are UI-layer (the other 165 are Integration/API-BE - out of scope for this framework regardless of effort). Of those 157, mapping each against the actual screen-method inventory: **~9% weighted average coverage**, and **14 of 24 P1 sub-area groups (60 of 157 cases, 38%) have zero existing code** (Filters, Sort, Planogram, Multiple POS, Presales order, Ad-hoc scheduling, Session/soak tests, Add stop, End Day). RF only ever tested flow mechanics, never the field-level/UI-state assertions the Excel wants (button-enabled states, numeric-input validation, filter/sort behavior, keypad type checks) - so most of the 157 need building fresh from the Excel, not extending from the port.

**Angle 2 - how correct is what we've ported?** Split by verification status rather than one blended number, since most of the port hasn't been checked yet:
- *Confirmed correct*: Login/Password mechanics, all of `PrepTasksScreen`, several shared `BaseScreen` constants.
- *Confirmed broken (now fixed)*: `deliveryLocationList`, `marketLob` casing.
- *Untested (the majority)*: everything past the LOB-entry tap in `CoffeeServiceScreen`/`MarketServiceScreen`/`VendingServiceScreen`, all of `TransfersScreen`/`TruckStockRouteInventoryScreen`/`TruckStockRouteShoppingScreen`/`TruckStockTruckReturnsScreen`, `swipeAndDelete`'s icon suffix (confirmed against RF source text, never against the live DOM).

### Live verification session, part 2: completing Start Day + Market Delivery/Add Product/Money Ops

To reach any LOB service screen at all, Start Day had to actually be completed (not just navigated into) - all four Prep Tasks steps were done for real on the emulator:

- **`completeProductCollection()`'s entire flow confirmed end-to-end**, including a finding not previously verified: `capturePhotoButton`'s deeply-nested fragile xpath (flagged as unconfirmed since Phase 1) **is correct** - it resolves exactly to the in-app Flutter camera's shutter button (which, notably, has zero content-desc/accessibility label at all - the fragile positional path is the only way to reach it). `takePhotoButton` (`~Take photo`) and `attachPhotoButton` (`~Attach Photo`) both confirmed exact matches too.
- **Explains RF's commented-out vehicle-check lines**: tapping "Vehicle check completed" triggers a live "GeoTab not found" dialog with a "Dismiss" button (`prep_tasks.yaml`'s `dismiss_button`) - the GeoTab integration isn't available in this environment. RF's authors hit the exact same wall and commented those lines out for exactly this reason; confirms that omission in `completeFullDayPrep()` was the right call, not a gap.
- **`safetyCheckCompletedCheckbox` confirmed exact match.** After completing all four steps, "Start day" became enabled and tapping it correctly returned to Dashboard with the button now gone and "End day" enabled in the nav menu - full state-transition confirmed.

With Start Day complete, the Market LOB service menu for a real location (CuraLeaf) was reached for the first time - it has more sections than `MarketServiceScreen` currently models: **Before Photos, Money Operations, Removals & Returns, Delivery, Audit, After Photos, Market Transfers**. Findings per area:

- **`deliveryTrigger` and `moneyOperations` confirmed exact matches** against this real menu.
- **`MarketServiceScreen`'s entire Money Operations field set confirmed 100% correct**: `skipMoneyBagCheckbox`, and critically the positional `bagCodeField`/`coinsField`/`billsField`/`refundField` (`ScrollView/EditText[1..4]`) - tested by converting the live dump to Appium's actual page-source format and running the exact xpaths; all four resolved to exactly the right fields (Bag code, Coins, Bills, Refund Amounts). This screen is titled "Money Collection" in-app, not "Money Operations" - a different label than the trigger tile, worth knowing if writing title assertions.
  - Caveat: this confirms *locators*, not *validation behavior*. The Excel's 22 Vending/Money-ops and equivalent Market P1 cases mostly test field *behavior* (reject negative/alphabetic input, decimal handling, max value) - not yet tested live.
  - Also caveat: this is the **single-POS** "Money Collection" screen. The Excel's separate "Market / Money Operation - Multiple POS" group (10 P1 cases, list-of-registers scenario) was not reached or verified - it may be a materially different screen, not just this one with more rows.
- **`fillsTitle` and the shared `addProductButton` confirmed exact matches** on the "Product fills" (Delivery) screen. Two new, real, previously-unknown locators found: `section_header_sort_cta` and `section_header_filter_cta` buttons - both clickable and reachable, directly answering the Excel's Delivery-Sort/Delivery-Filters groups (19 P1 cases) with concrete anchor points to build against, where previously there was nothing.
- **Important gap found**: the per-product quantity field (e.g. "Delivery: 4") is a bare `android.widget.EditText` with **no content-desc, no hint, no resource-id whatsoever** - the only locator strategy available is a row-relative xpath (e.g. anchored off the product's own content-desc via `following::`), not a simple constant. `performDelivery()` doesn't touch this field at all today.
- **"Add product" flow (Market/Delivery-Add Product, 20 P1 cases) confirmed real and matches the Excel closely**: search field with helper text "Scan or search brand, name, sku" (matches Excel's TC150/151 almost verbatim), Cancel/Add buttons with Add genuinely disabled until valid input (matches TC153). But tapping the search field opens a **separate "Search product" bottom-sheet modal** with its own search box and full-width result rows (`"{name} - pkg: {n}\nSKU: {sku}"` as one clickable View) - a different UI pattern than the inline `search_field`/`search_list` pattern `BaseScreen.searchAndSelect()` was built from. **`searchAndSelect()` will not directly work for this flow** - it needs its own dedicated method built against this modal's actual structure.
- `Audit` and `After Photos` rows on the service menu render their title and description as two separate small Views rather than one combined content-desc (unlike Before Photos/Money Operations/Removals & Returns/Delivery, which combine both into one row-spanning View) - `MarketServiceScreen.audit`'s `starts-with` xpath still matches the title text node, presumed to still register a correct tap since Android touch dispatch resolves to the parent regardless of which descendant's bounds were targeted, but this wasn't click-tested directly.

Some methods that look "incomplete" aren't bugs to fix - `performDelivery`/`performMoneyOperations`/`performEquipmentAudit` are 3-4 line stubs because that's genuinely all the RF keyword they were ported from ever did. Making their locators correct won't make them cover the Excel's TCs; they need new method bodies written from the Excel directly.

## Open items to verify before trusting

- `draw_gestures.py` usage - see Phase 6 notes above.
- Re-capture the fragile absolute-xpath locators listed above against the current build before wiring them into new TS screens - blocked on device/APK access.
- ~~Confirm whether `appium:permissions` + `autoGrantPermissions` capabilities (RF's approach) can replace the current adb-loop permission-granting in `appium.fixture.ts`~~ **Resolved (Phase 6)**: not changing it - `autoGrantPermissions` was already tried in this exact fixture and found unreliable for this app; see Phase 6 notes.
- ~~`BaseScreen.swipeAndDelete`'s delete-icon xpath suffix is an unconfirmed placeholder~~ **Resolved**: confirmed against the untruncated `common_keywords.robot` source as `/android.widget.Button` - matches what was already in place.

## Phase 7 notes: spec authoring from Optimized_TCs_V_2.0.xlsx (Tier 1 + Tier 2)

Following the "how much can we complete now" analysis (Tier 1 = ready with near-zero new code, Tier 2 = ready with one small addition), wrote the actual spec files rather than just estimating:

- **New `BaseScreen.isEnabled(selector)`** - distinct from `isVisible`, needed for the Excel's many "Continue/Add disabled until X" assertions that RF never tested at all.
- **`PrepTasksScreen` additions**: `arePrepCategoriesVisible()`, `isProductCollectionTitleVisible()`, `isBackPressPopupVisible()`, `isContinueEnabled()`, and a `subScreenTriggers` public getter (exposes the four sub-screen trigger locators so spec code can call the existing generic `skipSubScreen`/`completeSubScreen`/`openBackPressPopup` methods - avoids needing four near-duplicate `skipX()`/`completeX()` wrapper methods per sub-screen). Also split `confirmSkip()`/`confirmComplete()` out of `skipSubScreen`/`completeSubScreen` so a spec that already opened the back-press popup (to assert `isBackPressPopupVisible()`) doesn't have to re-navigate just to tap Skip/Complete.
- **`MarketServiceScreen` additions**: `isProductFillsTitleVisible()`, `isMoneyCollectionScreenVisible()` (all 5 Money Operations field locators), `openMoneyOperations()` (opens without submitting - `performMoneyOperations()` now calls this internally), `openAddProductFromFills()`, `isAddProductScreenVisible()`, `addProductButtonStates()`.
- **`DashboardScreen` addition**: `openFirstServiceStation(lob)` - a genuinely new navigation method, not from RF. Needed because `BaseScreen.selectServiceLocation()`/`MarketServiceScreen.clickServiceLocation()` assume a different, unverified screen layout (a positional list after the LOB icon becomes visible) that doesn't match the real navigation this session actually walked through live (location row → expand LOB card → tap service station row). Only confirmed against a single-service-station example.
- **`tests/mobile/prep-tasks.spec.ts`** (2 tests): all four prep categories visible, full Start Day completion, and the back-press Skip popup.
- **`tests/mobile/market-service.spec.ts`** (2 tests): Money Operations field presence, and Add Product entry screen + button-enablement states. Both start from login and complete Start Day first, since that's a real prerequisite gate discovered this session.

**Scope discipline maintained**: none of these assert field validation *behavior* (reject negative/alphabetic input, decimal handling) - only presence/reachability/enablement state, since the behavior itself hasn't been tested live. `isContinueEnabled()` was added but deliberately not asserted against a specific expected value anywhere, since live observation contradicted the Excel's "Continue disabled initially" claim for Prep Tasks' Money Operations and this needs re-verification before asserting either way.

## Phase 7 addendum: TC-ID traceability + two confirmed discrepancies

Added Playwright `tag` arrays (`{ tag: ['@TC071', ...] }`) plus inline comments to `prep-tasks.spec.ts`, `market-service.spec.ts`, and `login.spec.ts`, citing exact Excel TC numbers per assertion (verifiable via `npx playwright test --grep @TC071`). Pulling the precise TC lists to do this properly surfaced two things worth knowing:

- **Confirmed discrepancy, not just uncertainty**: TC077 ("Continue disabled with no entries", Product Collection) and TC173 ("Continue disabled initially", Money Operations) are directly contradicted by evidence - the raw `uiautomator dump` XML shows `enabled="true"` on the Continue button on both screens with zero items selected. Deliberately not asserted in the specs. The equivalent claims for Additional Prep (TC188) and Checks (TC207) follow the same pattern but weren't directly tested.
- **TC153 wording vs. real behavior**: TC153 says "view Cancel and Add buttons disabled (no input)" - live dump evidence shows only Add is `enabled="false"`; Cancel is `enabled="true"` throughout. The spec asserts the real behavior (`cancelEnabled: true, addEnabled: false`), not TC153's literal wording taken as "both disabled".
- **Market's Money Operations test carries no TC tag at all**: the Excel's only Market money-handling sub-area is "Money Operation - Multiple POS" (TC308-TC327), which describes a POS *list* screen (TC308 "view POS list", TC310 "view multiple POS entries"). The location tested opened straight to a single bag-code/coins/bills/refund form with no POS list. Unclear whether Multiple POS is a different screen (locations with more registers) or this is its one-POS state - left untagged rather than force-fit a citation, though the screen structure verified is still real and useful.
- **Additional Prep's back-press popup TCs (TC198/199/200/201) are distinct from Money Operations' (TC180/181/182/183)** - the Excel documents the same shared back-press-popup UI pattern once per sub-screen rather than once globally. The port's `openBackPressPopup`/`confirmSkip`/`confirmComplete` methods are generic across all four, so get the right TC citation from whichever trigger locator the test actually passed in - this matters for not misciting TC180/182 when the test used Additional Prep's trigger.
