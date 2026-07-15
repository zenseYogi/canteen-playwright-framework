import { test, expect } from '../../fixtures/appium.fixture';
import { DeliveriesHomeScreen } from '../../screens/deliveries-home.screen';

test.describe('Deliveries - Route 10', () => {
  test('Start day and open a schedule item', async ({ driver }) => {
    const home = new DeliveriesHomeScreen(driver);

    await home.step1_startDay();
    await home.step2_openScheduleItem('CureLeaf');

    expect(await home.getDeliveryCountText()).toContain('Deliveries');
  });
});
