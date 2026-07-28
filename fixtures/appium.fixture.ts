import { test as base, expect } from '@playwright/test';
import { remote, type Browser } from 'webdriverio';
import { execSync } from 'child_process';
import { mobileConfig } from '../config/mobile.config';

type MobileFixtures = {
  driver: Browser;
};

/**
 * Everything the per-test `driver` fixture below does to reach a clean,
 * logged-out app launch - pulled out so callers that need to share ONE
 * session across multiple tests (see vending-service.spec.ts) can create it
 * the same proven way, without going through Playwright's test-scoped
 * fixture (which always tears down and recreates per test).
 */
export async function createMobileSession(): Promise<Browser> {
  const appId = mobileConfig.capabilities['appium:appPackage'];
  const deviceName = mobileConfig.capabilities['appium:deviceName'];

  // Force a clean, logged-out state on every session so tests never
  // silently skip Login due to a persisted session from a prior run
  // (the app supports session restore - see clearUserSession in the
  // SecureStorageHelper unit tests - which caused exactly this issue).
  //
  // Done via a direct adb pm clear BEFORE the session starts, rather than
  // Appium's mobile: clearApp + mobile: activateApp run after session
  // creation - that combo doesn't reliably cold-start the app once it's
  // been cleared (activateApp only brings an already-running app to the
  // foreground). Clearing first and letting the normal capability-driven
  // launch (appPackage/appActivity) do the actual cold start avoids that -
  // that launch path is already proven to work.
  //
  // (Briefly disabled to test whether it was causing the SSL cert
  // validation failures seen navigating past Login - disproven: the same
  // "Trust anchor for certification path not found" error reproduced
  // manually via the Privacy Policy link, independent of pm clear
  // entirely. That's a real app-level WebView cert-trust bug, unrelated
  // to this reset step. Restored.)
  // KEEP_APP_SESSION=true opts out of the clear above, so a valid login +
  // MFA-approved session survives across test runs within the same
  // emulator boot - loginAndWaitForMfa() then detects that (hamburger icon
  // already visible) and skips Login/Password/MFA entirely. This is what
  // the comment above warned had been tried and reverted before ("silently
  // skips Login due to a persisted session from a prior run") - kept
  // opt-in rather than the default specifically so existing specs keep
  // today's proven clean-slate behavior unless a caller deliberately asks
  // for session reuse.
  if (process.env.KEEP_APP_SESSION !== 'true') {
    try {
      execSync(`adb -s ${deviceName} shell pm clear ${appId}`);
    } catch (e) {
      console.warn(`Could not clear app data for ${appId} before session start:`, e);
    }
  }

  // appium:autoGrantPermissions doesn't reliably suppress this app's runtime
  // camera permission prompt in practice - it still surfaces on first launch
  // after a clear, blocking the WebView Login screen underneath. Granting
  // directly via adb (after the clear above, since clearing revokes any
  // previously granted permissions) is deterministic and avoids depending on
  // that capability's behavior.
  // Full list confirmed via `adb shell dumpsys package com.canteen.nexus`
  // (the USER_SENSITIVE_WHEN_GRANTED-flagged permissions are the ones the
  // app actually prompts for at runtime).
  const runtimePermissions = [
    'android.permission.CAMERA',
    'android.permission.ACCESS_FINE_LOCATION',
    'android.permission.ACCESS_COARSE_LOCATION',
    'android.permission.BLUETOOTH_CONNECT',
    'android.permission.BLUETOOTH_SCAN',
    'android.permission.BLUETOOTH_ADVERTISE',
    'android.permission.READ_PHONE_STATE',
    'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.RECORD_AUDIO'
  ];
  for (const permission of runtimePermissions) {
    try {
      execSync(`adb -s ${deviceName} shell pm grant ${appId} ${permission}`);
    } catch (e) {
      console.warn(`Could not grant ${permission} to ${appId}:`, e);
    }
  }

  const driver = await remote({
    hostname: mobileConfig.appium.host,
    port: mobileConfig.appium.port,
    path: mobileConfig.appium.path,
    capabilities: {
      ...mobileConfig.capabilities,
      // The app is launched via appPackage/appActivity (already installed),
      // not a local APK, so Appium requires noReset: true here - it has no
      // `app` capability to install/reinstall from. mobile.config.ts's base
      // capabilities also set fullReset: true, which must be explicitly
      // overridden to false here too - otherwise both end up true (they're
      // mutually exclusive) since the spread above still carries it through.
      // The actual data reset now happens via the adb pm clear above.
      'appium:noReset': true,
      'appium:fullReset': false,
      // The app declares CAMERA/location/Bluetooth permissions - after a
      // fresh pm clear, a first-run permission dialog can pop up and block
      // the WebView underneath, which looks exactly like "app not visibly
      // launching" while locators keep timing out.
      'appium:autoGrantPermissions': true
    }
  });

  // The app can show an in-app "Confirm sign off" dialog on launch - a
  // session-restore artifact (some auth/cookie state can survive the adb
  // pm clear above even though local storage doesn't) where the app
  // detects a still-valid session and asks to confirm signing off before
  // it will render a clean Login screen. This is unrelated to OS
  // permission dialogs and needs its own dismissal: tap "Sign off" if
  // present, but don't fail the test if the dialog never appears (e.g.
  // on a genuinely fresh install with no prior session at all).
  //
  // Locator uses content-desc, not text - confirmed via an actual page
  // source dump that this button (like the rest of this Flutter app) has
  // text="" and exposes its accessible label only via content-desc.
  // Skipped under KEEP_APP_SESSION - tapping Sign off here would defeat the
  // whole point of keeping the session (it explicitly signs the restored
  // session out), so the only two outcomes to expect with that flag on are
  // landing straight on Dashboard, or this dialog simply never appearing.
  if (process.env.KEEP_APP_SESSION !== 'true') {
    try {
      const signOffButton = await driver.$('//*[@content-desc="Sign off"]');
      if (await signOffButton.isDisplayed().catch(() => false)) {
        await signOffButton.click();
      }
    } catch (e) {
      // Dialog wasn't present - nothing to do.
    }
  }

  return driver;
}

export async function closeMobileSession(driver: Browser): Promise<void> {
  await driver.deleteSession();
}

export const test = base.extend<MobileFixtures>({
  driver: async ({}, use, testInfo) => {
    const driver = await createMobileSession();

    await use(driver);

    // Ported equivalent of custom_listener.py's end_test hook (RF's
    // AppiumLibrary capture_page_screenshot on FAIL, embedded in the HTML
    // report). Playwright's own `screenshot`/`trace` config options only
    // apply to a Playwright-launched browser `page`, which this project
    // never creates - the driver here is a standalone WebdriverIO/Appium
    // session, so the failure artifact has to be captured from it directly.
    if (testInfo.status !== testInfo.expectedStatus) {
      try {
        const screenshotPath = testInfo.outputPath('failure.png');
        await driver.saveScreenshot(screenshotPath);
        await testInfo.attach('failure-screenshot', { path: screenshotPath, contentType: 'image/png' });
      } catch (e) {
        console.warn('Could not capture failure screenshot:', e);
      }
    }

    await driver.deleteSession();
  }
});

export { expect };