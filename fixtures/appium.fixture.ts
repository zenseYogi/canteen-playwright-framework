import { test as base, expect } from '@playwright/test';
import { remote, type Browser } from 'webdriverio';
import { mobileConfig } from '../config/mobile.config';

type MobileFixtures = {
  driver: Browser;
};

export const test = base.extend<MobileFixtures>({
  driver: async ({}, use) => {
    const driver = await remote({
      hostname: mobileConfig.appium.host,
      port: mobileConfig.appium.port,
      path: mobileConfig.appium.path,
      capabilities: mobileConfig.capabilities
    });

    await use(driver);

    await driver.deleteSession();
  }
});

export { expect };
