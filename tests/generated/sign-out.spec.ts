import { test } from '../../fixtures/appium.fixture';
import { SignOutScreen } from '../../screens/sign-out.screen';

test.describe('Sign out', () => {
  test('User can sign off from the nav menu', async ({ driver }) => {
    const screen = new SignOutScreen(driver);

    await screen.step1_openNavigationMenu();
    await screen.step2_signOff();
    await screen.step3_signOff();
  });
});
