import { test } from '../../fixtures/appium.fixture';
import { SignInScreen } from '../../screens/sign-in.screen';

test.describe('Sign in', () => {
  test('User can sign in and land on the deliveries screen', async ({ driver }) => {
    const screen = new SignInScreen(driver);

    await screen.step1_androidWidgetLinearlayout();
    await screen.step2_androidViewView();
    await screen.step3_androidWidgetLinearlayout();
    await screen.step4_androidViewView();
    await screen.step5_androidViewView();
    await screen.step6_androidWidgetLinearlayout();
    await screen.step7_androidViewView();
    await screen.step8_androidViewView();
    await screen.step9_todayFri10Jul();
    await screen.step10_openNavigationMenu();
    await screen.step11_androidWidgetLinearlayout();
  });
});
