import { test } from '../../fixtures/appium.fixture';
import { ScheduleOverviewScreen } from '../../screens/schedule-overview.screen';

test.describe('Schedule overview', () => {
  test('User can drill into today\'s route and browse schedule overview', async ({ driver }) => {
    const screen = new ScheduleOverviewScreen(driver);

    await screen.step1_androidViewView();
    await screen.step2_todayFri10Jul();
    await screen.step3_route10();
    await screen.step4_3Deliveries();
    await screen.step5_remainingOf3();
    await screen.step6_02();
    await screen.step7_01();
    await screen.step8_market();
    await screen.step9_coffee();
    await screen.step10_schedule();
    await screen.step11_pendingAction3();
    await screen.step12_androidViewView();
    await screen.step13_openNavigationMenu();
    await screen.step14_scheduleOverview();
    await screen.step15_androidViewView();
    await screen.step16_openNavigationMenu();
    await screen.step17_welcomeAnthony();
    await screen.step18_scheduleOverview();
    await screen.step19_androidViewView();
    await screen.step20_openNavigationMenu();
    await screen.step21_scheduleOverview();
    await screen.step22_completed0();
    await screen.step23_noCompletedTask();
    await screen.step24_openNavigationMenu();
    await screen.step25_androidWidgetLinearlayout();
  });
});
