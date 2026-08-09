# Canteen Playwright Framework

Playwright + TypeScript mobile automation framework for the Compass Canteen (Nexus) Android app, driven via Appium/WebdriverIO (UiAutomator2 driver, plus a real WebView context for Login/SSO).

Test cases are authored directly against the master Excel test-case sheet (`Optimized_TCs_V_2.0.xlsx`). Each assertion is tagged with its Excel TC number (e.g. `@Market-TC110`) for traceability and `--grep` filtering.

## Prerequisites

- Node.js and npm
- An Android emulator or device, reachable via `adb`
- [Appium](https://appium.io/) server running (`appium --port 4723`) — **not** started automatically by the test run
- The app build installed with `WebView.setWebContentsDebuggingEnabled(true)` — without this flag, Appium can never establish a WebView context and every login-dependent test fails at the Login step. Verify with:
  ```bash
  adb shell cat /proc/net/unix | grep webview_devtools_remote
  ```

## Setup

```bash
npm install
```

Create a `.env` file (gitignored) with the device/package/test-account details:

```
APP_PACKAGE=com.compass.canteen.nexus.test
APP_ACTIVITY=com.compass.canteen.nexus.MainActivity
TEST_LOGIN_ID=...
TEST_PASSWORD=...
TEST_LOGIN_ID_RouteDriver=...
TEST_PASSWORD_RouteDriver=...
```

Key route/day defaults live in `config/mobile.config.ts` and are env-overridable (`ROUTE_OPERATION_SEARCH`, `ROUTE_LABEL`, `ROUTE_DAY`, etc.) — see that file for the full list.

## Running tests

> **Always set `KEEP_APP_SESSION=true`.** Without it, every run does a fresh `adb pm clear` + re-login, wiping app data and re-triggering a manual MFA push notification the tester has to approve by hand. Never cold-start the app between runs unless you explicitly intend to reset it.

Run a single spec:

```bash
KEEP_APP_SESSION=true npx playwright test tests/mobile/<spec>.spec.ts --project=mobile --reporter=list
```

Filter to one Excel TC:

```bash
npx playwright test --grep @Market-TC110
```

Full regression sweep (excludes Vending — see [Known limitations](#known-limitations)):

```bash
KEEP_APP_SESSION=true npx playwright test \
  tests/mobile/login.spec.ts \
  tests/mobile/route-setup.spec.ts \
  tests/mobile/adhoc-scheduling.spec.ts \
  tests/mobile/coffee-service.spec.ts \
  tests/mobile/market-service.spec.ts \
  tests/mobile/market-fill-screen.spec.ts \
  tests/mobile/prep-tasks.spec.ts \
  tests/mobile/transfers.spec.ts \
  tests/mobile/truck-stock-truck-returns.spec.ts \
  tests/mobile/home-dynamic-data.spec.ts \
  tests/mobile/end-day.spec.ts \
  --project=mobile --reporter=list,html
```

> `playwright.config.ts` declares `html` + `list` reporters by default, but passing `--reporter=list` on the CLI **overrides** that array entirely. Pass `--reporter=list,html` explicitly if you want the HTML report regenerated.

View the HTML report (must be served, not opened as a raw file — its data fetches are blocked by CORS under `file://`):

```bash
npm run report
```

## Project structure

```
config/       Route/day defaults and environment config
fixtures/     Playwright test fixtures (Appium session lifecycle)
screens/      Page-object-style screen classes (one per app screen/flow)
tests/mobile/ Spec files, one per LOB/area, TC-tagged per assertion
utils/        Shared login/route flow helpers (loginAndWaitForMfa, ensureOnRoute, etc.)
docs/         Working notes from the original RF → Playwright port
reports/      Generated HTML/PDF reports (gitignored)
```

## Known limitations

- **Vending** is code-complete but excluded from the standard regression sweep — the dedicated Vending route (Charlotte, NC / Route 103) has no seeded stops on any day, a data gap unrelated to the automation itself.
- **Market ↔ Market Transfer** and **Money Operations Multiple POS** are blocked pending a backend/customer-portal data or config change — every account and persona tested so far shows the same limitation.
- **End Day — Unused Kits / Money Bag Review**: no such UI has been observed in this build after fully completing multiple routes; needs dev/PM confirmation on whether it exists and what triggers it.

## Contributing

Before adding a new spec or screen method:

1. Live-verify locators against the running emulator (`adb shell uiautomator dump`) rather than guessing — several checkbox-style controls in this app expose **no** accessibility signal at all for their checked state (see `BaseScreen.isChecklistIconChecked`'s doc comment for the pixel-sampling workaround used where that's the case).
2. Tag every assertion with its exact Excel TC number, re-pulled fresh from the sheet — TC numbers are reused across different areas, so a stale citation is an easy mistake.
3. Prefer existing shared helpers (`ensureOnRoute`, `loginAndEnsureRoute`, `BaseScreen`'s primitives) over new ad-hoc navigation — most screens follow the same tap/type/checklist patterns already implemented once.
