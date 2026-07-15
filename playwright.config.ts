import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
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
    }
  ]
});
