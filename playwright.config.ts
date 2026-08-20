import { defineConfig } from '@playwright/test';

// Generate a unique timestamp string (e.g., 2026-08-18_18-59-00)
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

export default defineConfig({
  testDir: './tests',
  // Every spec that logs in calls MfaScreen.waitForManualApproval (up to
  // 120s waiting for a human to approve the Authenticator push) - the
  // previous 60s default meant any such test failed on timeout before a
  // human could ever act, regardless of app behavior.
  timeout: 150_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['html', { outputFolder: `playwright-report/run-${timestamp}` }], ['list']],
  use: {
    /* Capture a screenshot after each test (pass or fail) */
    screenshot: 'on',
  },
  projects: [
    {
      name: 'mobile',
      testDir: './tests/mobile'
    },
    {
      name: 'generated',
      testDir: './tests/generated'
    }
  ]
});
