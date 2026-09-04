import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndEnsureRoute } from '../../utils/login-flow';
import { HomeScreen } from '../../screens/home.screen';
import { PrepTasksScreen } from '../../screens/prep-tasks.screen';
import { mobileConfig } from '../../config/mobile.config';

// SD-TC-024 (Build-84 sheet): "Driver can Start Day with no scheduled
// deliveries on the route" - the sheet's own Allentown/109 test data is
// stale (no longer searchable in Select operation). Per direct
// confirmation: Charlotte NC / Route 103 (mobileConfig.coffeeRoute) on
// TOMORROW is a genuinely zero-delivery day on this account - same
// flow already used manually (Change route -> same Operation/Route ->
// select Tomorrow -> 0 deliveries).
test('SD-TC-024: Start Day completes with no scheduled deliveries (Route 103/TOMORROW)', async ({ driver }) => {
  await loginAndEnsureRoute(driver, { ...mobileConfig.coffeeRoute, day: 'TOMORROW' });
  const home = new HomeScreen(driver);
  await home.returnToHome();
  const deliveries = await home.getDeliveriesCount();
  console.log('Deliveries on Route 103/TOMORROW:', deliveries);
  expect(deliveries).toBe(0);

  const prepTasks = new PrepTasksScreen(driver);
  await prepTasks.openFromHamburgerMenu();
  await prepTasks.ensureFullDayPrepComplete();
  console.log('Start Day completed with 0 scheduled deliveries');
});
