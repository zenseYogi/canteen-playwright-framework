import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndEnsureRoute } from '../../utils/login-flow';
import { PrepTasksScreen } from '../../screens/prep-tasks.screen';
import { HomeScreen } from '../../screens/home.screen';
import { DashboardScreen } from '../../screens/dashboard.screen';
import { MarketServiceScreen } from '../../screens/market-service.screen';
import { EndDayScreen } from '../../screens/end-day.screen';
import { mobileConfig } from '../../config/mobile.config';

test('EXPLORE: complete ONE Market stop WITH a money bag, skip the other, check Money Bag Review', async ({ driver }) => {
  test.setTimeout(1_800_000);
  const prepTasks = new PrepTasksScreen(driver);
  const home = new HomeScreen(driver);
  const dashboard = new DashboardScreen(driver);
  const market = new MarketServiceScreen(driver);
  const endDay = new EndDayScreen(driver);

  await loginAndEnsureRoute(driver, { ...mobileConfig.marketRoute, day: 'YESTERDAY' });
  await home.returnToHome();
  if (await home.isStartDayVisible()) {
    await prepTasks.openFromHamburgerMenu();
    await prepTasks.ensureFullDayPrepComplete();
    await home.returnToHome();
  }
  console.log(`[MB5] pending at start = ${await dashboard.getPendingActionCount()}`);

  await dashboard.clickLocationByPosition('first');
  await dashboard.openFirstServiceStation('market');

  if (!(await market.isChecklistIconChecked('//android.view.View[starts-with(@content-desc,"Before Photos")]'))) {
    await market.openBeforePhotos();
    await market.openSkipPhotoReasonSheet();
    await market.enterSkipPhotoReason("Camera can't focus and take clear picture");
    await market.waitForSkipPhotoSubmitEnabled(true);
    await market.confirmSkipPhoto();
  }
  if (!(await market.isChecklistIconChecked('//android.view.View[starts-with(@content-desc,"Delivery")]'))) {
    await market.openFills();
    await market.ensureFillsSubmittable();
    await market.submitFillsAndReturnToChecklist();
  }
  const auditChecked = await market.isChecklistIconChecked(
    '//android.view.View[starts-with(@content-desc,"Audit") or starts-with(@content-desc,"Market Physical")]'
  );
  if (!auditChecked) {
    await market.tapAuditTile();
    if (await market.isCountTypeModalVisible()) await market.selectCountType('cycle');
    await market.searchAndSelectAuditProduct('Balance C', 'Balance CkieDough1.76oz - pkg: 1', 'Balance CkieDough1.76oz');
    await market.tap('~Continue');
  }
  console.log('[MB5] photos + fills + audit done');

  await market.openMoneyOperations();
  // NUMERIC. The working Market tests use '77'/'88'/'55'/'66' - an
  // alphanumeric code is rejected, Save cannot complete, and the screen holds
  // you on Money Collection (which is what blocked the previous attempts).
  await market.enterBagCode('91');
  console.log(`[MB5] bag code field reads = ${await market.getBagCodeValue()}`);
  await market.saveMoneyOperations();
  const backOnChecklist = await market.returnToChecklistFromMoneyOperations();
  console.log(`[MB5] money bag saved; back on checklist = ${backOnChecklist}`);
  console.log(`[MB5] completeDelivery enabled = ${await market.isCompleteDeliveryEnabled()}`);

  if (await market.isCompleteDeliveryEnabled()) {
    await market.tap('~Complete Delivery');
    await driver.pause(5_000);
    console.log('[MB5] COMPLETED the stop with a money bag');
  }

  await home.returnToHome();
  console.log(`[MB5] pending after completing one = ${await dashboard.getPendingActionCount()}`);

  await endDay.openFromHamburgerMenu();
  for (let i = 0; i < 6 && (await endDay.isFinishServiceGateVisible()); i++) {
    await endDay.resolveWithNoService();
    await driver.pause(2_000);
  }
  console.log(`[MB5] unusedKits=${await endDay.isUnusedKitsScreenVisible()}`);
  if (await endDay.isUnusedKitsScreenVisible()) {
    await endDay.tapContinue();
    await driver.pause(4_000);
  }
  console.log(`[MB5] NEXT SCREEN = ${await endDay.getVisibleScreenText()}`);
  expect(true).toBe(true);
});
