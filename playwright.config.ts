import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // Every spec that logs in calls MfaScreen.waitForManualApproval (up to
  // 120s waiting for a human to approve the Authenticator push) - the
  // previous 60s default meant any such test failed on timeout before a
  // human could ever act, regardless of app behavior.
  //
  // CORRECTED 2026-08-20 (build 0.1.86, live-verified): a post-MFA "Select
  // Day" sheet now leads into an interim "Start day" checklist screen while
  // a background sync settles before HomeScreen.waitForDashboardLoaded's
  // target element appears (up to another 120s, same class of delay as
  // RouteSetupScreen's own 60-90s sync wait). That wait happens
  // SEQUENTIALLY after the MFA wait within the same test, so the two
  // together can exceed the old 150s budget even when both individually
  // succeed - live-verified TC001 needed 2.5m end-to-end. 300s gives both
  // their full 120s allowance plus headroom for everything around them.
  timeout: 300_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['html', { outputFolder: 'reports/html' }], ['list']],
  projects: [
    {
      name: 'mobile',
      testDir: './tests/mobile'
    },
    {
      name: 'generated',
      testDir: './tests/generated'
    },
    // Regression super-set: one file per area, each runnable as a unit.
    // Same Appium fixture and timeouts as `mobile` - this only narrows the
    // directory, so a file can be run without a --grep.
    {
      name: 'regression',
      testDir: './tests/regression'
    }
  ]
});
