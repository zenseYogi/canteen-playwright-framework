import { test } from '../../fixtures/appium.fixture';
import { loginAndWaitForMfa } from '../../utils/login-flow';
import { TruckStockTruckReturnsScreen } from '../../screens/truck-stock-truck-returns.screen';

// Ported from test.robot's three active Truck Returns cases ("...open the truck
// returns screen", "...add products under the coffee tab...", "...delete
// products under the coffee tab..."). RF ran these as separate test cases
// against one shared, already-authenticated Suite Setup session; here they're
// steps in one test, since every Playwright test re-runs the full Login ->
// Password -> manual-MFA-approval preamble from a freshly cleared app (see
// appium.fixture.ts) and that wait is too expensive to repeat three times.
test.describe('Truck Stock - Truck Returns', () => {
  test('open Truck returns, add a product under Coffee, then delete it', async ({ driver }) => {
    const truckReturns = new TruckStockTruckReturnsScreen(driver);
    let productName = '';

    await test.step('Log in', async () => {
      await loginAndWaitForMfa(driver);
    });

    await test.step('Open the Truck returns screen', async () => {
      await truckReturns.open();
    });

    // RF's own add/delete keywords for this same Coffee tab used different
    // search terms ("co" to add, "man" to delete) - an inconsistency in the
    // source, not a meaningful distinction. Using one consistent term here.
    await test.step('Add a product under Coffee', async () => {
      productName = await truckReturns.addProduct('coffee', 'man');
    });

    await test.step('Delete the added product under Coffee', async () => {
      await truckReturns.deleteProduct('coffee', productName);
    });
  });
});
