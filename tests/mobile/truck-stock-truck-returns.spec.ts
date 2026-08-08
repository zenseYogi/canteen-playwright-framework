import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndEnsureRoute } from '../../utils/login-flow';
import { TruckStockTruckReturnsScreen } from '../../screens/truck-stock-truck-returns.screen';
import { HomeScreen } from '../../screens/home.screen';
import { mobileConfig } from '../../config/mobile.config';

// Ported from test.robot's three active Truck Returns cases ("...open the truck
// returns screen", "...add products under the coffee tab...", "...delete
// products under the coffee tab..."). RF ran these as separate test cases
// against one shared, already-authenticated Suite Setup session; here they're
// steps in one test, since every Playwright test re-runs the full Login ->
// Password -> manual-MFA-approval preamble from a freshly cleared app (see
// appium.fixture.ts) and that wait is too expensive to repeat three times.
test.describe('Truck Stock - Truck Returns', () => {
  // Same reasoning as the rest of this suite: every test here leaves the
  // app wherever the last step landed under KEEP_APP_SESSION - return to
  // Dashboard after each so no test inherits a stale screen from whichever
  // ran before it.
  test.afterEach(async ({ driver }) => {
    await new HomeScreen(driver).returnToHome().catch(() => {});
  });

  test('open Truck returns, add a product under Coffee, then delete it', async ({ driver }) => {
    const truckReturns = new TruckStockTruckReturnsScreen(driver);
    let productName = '';

    await test.step('Log in', async () => {
      await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
    });

    await test.step('Open the Truck returns screen', async () => {
      await truckReturns.open();
    });

    // RF's own add/delete keywords for this same Coffee tab used different
    // search terms ("co" to add, "man" to delete) - an inconsistency in the
    // source, not a meaningful distinction. Using one consistent term here.
    // Live-verified 2026-08-04: the generic term "man" ambiguously matches
    // multiple products (both "24Mantra..." and "Barnie's German Choc..." -
    // "German" contains "man"), and deleteProduct()'s hint-matching breaks
    // for the latter because its full catalog name and its on-screen
    // abbreviated display name don't align ("Chocolate" vs "Choc", etc.).
    // "jaggery" matches exactly one product whose catalog/display names do
    // align cleanly.
    await test.step('Add a product under Coffee', async () => {
      productName = await truckReturns.addProduct('coffee', 'jaggery');
    });

    await test.step('Delete the added product under Coffee', async () => {
      await truckReturns.deleteProduct('coffee', productName);
    });
  });

  // TC298 "verify Transfers, Truck Returns, and Route Inventory options are
  // available in Hamburger Menu" - live-verified 2026-08-04: the hamburger
  // drawer's "Truck stock" group expands to show "Truck returns", "Route
  // Inventory", and "Route shopping", with "Transfers" as a sibling item at
  // the same top level - matching the Excel's expected list.
  //
  // TC299 "verify Truck Returns screen having three tabs as Coffee, Vending
  // and Vending" (the Excel's own wording is malformed, presumably meaning
  // Coffee/Market/Vending) - live-verified 2026-08-04: the "Truck returns"
  // heading, "+" add icon, "coffee" tab (selected by default), search field
  // with its search/scanner icon pair, and the "Record Individual Truck
  // Returns" info pane are all present, matching the rest of the Excel's
  // literal claims. The "market" tab is also present. The "vending" tab is
  // NOT verified here: this account's current route/day has zero Vending
  // stops (confirmed via the Dashboard showing only Market/Coffee delivery
  // counts), so there is nothing to demonstrate a Vending tab against - same
  // class of data gap already documented for Transfers and Vending
  // elsewhere in this suite. Needs re-verification on a route/day with an
  // actual Vending stop.
  test(
    'TC298/TC299: the hamburger menu lists Truck Stock/Transfers, and the Truck Returns screen shows its expected controls',
    { tag: ['@Menu-TC298', '@Menu-TC299'] },
    async ({ driver }) => {
      const truckReturns = new TruckStockTruckReturnsScreen(driver);

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('TC298: the hamburger menu lists Truck Stock (Truck returns/Route Inventory/Route shopping) and Transfers', async () => {
        const menu = await truckReturns.isTruckStockMenuVisible();
        expect(menu.truckStock).toBe(true);
        expect(menu.truckReturns).toBe(true);
        expect(menu.routeInventory).toBe(true);
        expect(menu.routeShopping).toBe(true);
        expect(menu.transfers).toBe(true);
      });

      await test.step('TC299: the Truck Returns screen shows its tabs, search controls, and info pane', async () => {
        const tabs = await truckReturns.getVisibleLobTabs();
        expect(tabs.coffee).toBe(true);
        expect(tabs.market).toBe(true);
        const search = await truckReturns.isSearchAreaVisible();
        expect(search.searchField).toBe(true);
        expect(search.icons).toBe(true);
        expect(search.infoHeading).toBe(true);
        expect(search.infoBody).toBe(true);
      });
    }
  );

  // TC300 "verify user is able to Search and Add Product in respective tab
  // for Coffee, Vending and Vending" - live-verified 2026-08-04: searching
  // and adding a product under the Coffee tab is exactly the flow TC298's
  // sibling test above already exercises via addProduct()/deleteProduct().
  // This test additionally confirms the same flow works identically under
  // the Market tab. Vending is NOT verified for the same data-gap reason
  // documented on TC299 above.
  test(
    'TC300: searching and adding a product works on the Market tab too',
    { tag: ['@Menu-TC300'] },
    async ({ driver }) => {
      const truckReturns = new TruckStockTruckReturnsScreen(driver);
      let productName = '';

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('Add a product under Market', async () => {
        productName = await truckReturns.addProduct('market', 'jaggery');
      });

      await test.step('Delete the added product under Market', async () => {
        await truckReturns.deleteProduct('market', productName);
      });
    }
  );
});
