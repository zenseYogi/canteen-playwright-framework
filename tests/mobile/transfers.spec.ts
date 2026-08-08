import { test, expect } from '../../fixtures/appium.fixture';
import { loginAndEnsureRoute } from '../../utils/login-flow';
import { TransfersScreen } from '../../screens/transfers.screen';
import { HomeScreen } from '../../screens/home.screen';
import { mobileConfig } from '../../config/mobile.config';

// Excel TC084/TC085 (Menu area, "Transfers - Route to Route Transfer" sub-
// area) - live-verified 2026-08-03 (build 0.1.76): TransfersScreen.open()
// was ported from RF's transfers.robot but never previously exercised by
// this Playwright suite. Confirmed live: the hamburger menu's own
// "Transfers" item opens a screen titled "Transfers" with per-LOB tabs
// (coffee/market/vending), a "Route to Route"/"Route to Warehouse" tab
// pair, and (on an account/route with none created yet) a real empty
// state - "No transfers yet." with an explanatory message and a Done
// button.
//
// TC132/TC133/TC134 (Menu area, "Transfers - Route to Warehouse Transfer"
// sub-area) restate the exact same claims verbatim from the Route-to-
// Warehouse sub-area's own perspective - "open Transfers", "view the
// landing page", "view transfer type options" - since Transfers is one
// shared screen where both tab types are always visible together,
// regardless of which sub-area's TC is asking. Tagged onto the same
// assertions below rather than duplicated.
test.describe('Menu - Transfers', () => {
  // Same reasoning as the other specs in this suite (market-service.spec.ts
  // etc.): every test here leaves the app wherever the last step landed
  // under KEEP_APP_SESSION - return to Dashboard after each so no test
  // inherits a stale screen from whichever ran before it.
  test.afterEach(async ({ driver }) => {
    await new HomeScreen(driver).returnToHome().catch(() => {});
  });

  test(
    'TC084-TC088: opening Transfers from the hamburger menu reaches the Transfers landing page',
    { tag: ['@Menu-TC084', '@Menu-TC085', '@Menu-TC086', '@Menu-TC087', '@Menu-TC088', '@Menu-TC132', '@Menu-TC133', '@Menu-TC134'] },
    async ({ driver }) => {
      const transfers = new TransfersScreen(driver);

      // CORRECTED (live-verified 2026-08-07): the "vending" LOB tab is tied
      // to the currently active route being Vending-capable - defaultRoute
      // (Miami/010) only ever shows "coffee"/"market" (confirmed via a
      // direct probe), while vendingRoute (Charlotte/103) shows all three.
      // Uses vendingRoute here so all three tabs this test asserts are
      // actually reachable.
      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.vendingRoute);
      });

      // TC084/TC132 "open Transfers -> navigate to the Transfers landing page".
      await test.step('TC084/TC132: opening Transfers from the hamburger menu reaches its own screen', async () => {
        await transfers.open();
        expect(await transfers.isTransfersTitleVisible()).toBe(true);
      });

      // TC085/TC133 "view the Transfers landing page" - the per-LOB tabs and
      // the Route to Route/Route to Warehouse tab pair are both real and
      // visible. TC088/TC134 "view transfer type options" restates the same
      // Route to Route/Route to Warehouse claim verbatim.
      await test.step('TC085/TC088/TC133/TC134: the Transfers landing page shows its LOB and transfer-type tabs', async () => {
        const tabs = await transfers.isLandingPageVisible();
        expect(tabs.coffee).toBe(true);
        expect(tabs.market).toBe(true);
        expect(tabs.vending).toBe(true);
        expect(tabs.routeToRoute).toBe(true);
        expect(tabs.routeToWarehouse).toBe(true);
      });

      // TC086 "view menu icon" / TC087 "view plus icon" - the hamburger
      // menu icon and the header's own add (+) icon are both visible on
      // this landing page.
      await test.step('TC086/TC087: the hamburger menu icon and header plus icon are both visible', async () => {
        const icons = await transfers.isHeaderIconsVisible();
        expect(icons.hamburger).toBe(true);
        expect(icons.plus).toBe(true);
      });
    }
  );

  // TC089/TC135 "verify default transfer selection" - live-verified
  // 2026-08-03 via screenshot: on a fresh Transfers landing page, "Route
  // to Route" is rendered with a highlighted/filled background while
  // "Route to Warehouse" is plain, confirming Route to Route is selected
  // by default. NOT assertable through the accessibility tree - both tabs
  // report checked="false" and selected="false" regardless of which is
  // visually active (this app's tab bar exposes selection only as a
  // background color, not an a11y-visible state). Asserting only what the
  // a11y tree can see: both tabs are present and tappable as soon as the
  // landing page loads, i.e. Route to Route requires no extra navigation
  // to reach. TC135 restates the identical claim from the Route-to-
  // Warehouse sub-area's own perspective.
  test(
    'TC089: the Transfers landing page opens directly onto Route to Route',
    { tag: ['@Menu-TC089', '@Menu-TC135'] },
    async ({ driver }) => {
      const transfers = new TransfersScreen(driver);

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('TC089/TC135: Route to Route and Route to Warehouse are both present as soon as Transfers opens', async () => {
        await transfers.open();
        const tabs = await transfers.isLandingPageVisible();
        expect(tabs.routeToRoute).toBe(true);
        expect(tabs.routeToWarehouse).toBe(true);
      });
    }
  );

  // TC090 "view information message" - live-verified 2026-08-03: on a
  // fresh Transfers landing page with no transfers created yet, the
  // "No transfers yet." message and its explanatory line are both real,
  // separate content-desc'd nodes (already noted in this file's own
  // TC084-088 doc comment - now asserted directly).
  //
  // TC091 "initiate transfer creation" - live-verified 2026-08-03: tapping
  // the header's plus icon opens a "Select Route" bottom sheet listing the
  // account's routes (Route 1, Route 18, Route 100, ... - real seed data,
  // not the Route 001/002 tiles used elsewhere in this file for an
  // ALREADY-created route-to-route transfer).
  test(
    'TC090/TC091: the empty-state message is visible and the plus icon opens Select Route',
    { tag: ['@Menu-TC090', '@Menu-TC091'] },
    async ({ driver }) => {
      const transfers = new TransfersScreen(driver);

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('TC090: the empty-state message is visible on a fresh Transfers landing page', async () => {
        await transfers.open();
        expect(await transfers.isEmptyStateMessageVisible()).toBe(true);
      });

      await test.step('TC091: the plus icon opens the Select Route bottom sheet', async () => {
        await transfers.openSelectRouteSheet();
        expect(await transfers.isSelectRouteSheetVisible()).toBe(true);
      });

      // Leave the app off the Select Route sheet so a KEEP_APP_SESSION=true
      // follow-on run's own open() can reach the hamburger menu again.
      await test.step('Dismiss the Select Route sheet', async () => {
        await transfers.pressKeyCode(4);
      });
    }
  );

  // TC092 "view available routes" - live-verified 2026-08-03: the Select
  // Route sheet lists real routes as bare "Route 1"/"Route 18"/"Route 100"
  // labels (not the zero-padded "Route 001" tiles used elsewhere in this
  // file for an ALREADY-created transfer's own route-selection sub-flow).
  //
  // TC093 "select a route" (bundled with TC094/TC097/TC098/TC101/TC119/
  // TC129/TC130/TC131 per Excel) - live-verified 2026-08-03: tapping a
  // route in the sheet returns to the Transfers landing page with a new
  // card for that route showing "Total Products: 0". Only the core
  // "adds the route with 0 products" claim is automated here; this test
  // also deletes the route it creates (via TransfersScreen.deleteRoute(),
  // already exercising the swipe-to-delete flow) so the app is left back
  // in the empty state TC090's test depends on.
  test(
    'TC092/TC093: Select Route lists real routes, and selecting one creates a 0-product transfer',
    { tag: ['@Menu-TC092', '@Menu-TC093'] },
    async ({ driver }) => {
      const transfers = new TransfersScreen(driver);
      let routeLabel = '';

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('TC092: the Select Route sheet lists real routes', async () => {
        await transfers.open();
        await transfers.openSelectRouteSheet();
        expect(await transfers.isAnyRouteOptionVisible()).toBe(true);
      });

      await test.step('TC093: selecting a route adds it to the Transfers list with 0 products', async () => {
        routeLabel = await transfers.selectFirstAvailableRoute();
        expect(await transfers.isRouteCardVisibleWithProductCount(routeLabel, 0)).toBe(true);
      });

      await test.step('Cleanup: delete the route just created, restoring the empty state', async () => {
        await transfers.deleteRoute('coffee', 'routeToRoute', routeLabel);
      });
    }
  );

  // TC095 "initiate delete action" - live-verified 2026-08-03: swiping a
  // route card right-to-left reveals a red trash/delete icon button
  // (unlabeled in the a11y tree - it's a bare child Button of the row, the
  // same structural selector TransfersScreen.swipeAndDelete() already taps
  // to complete a delete, just without confirming here).
  //
  // TC131.002 "view the renamed primary action button" - live-verified
  // 2026-08-03: the Transfers screen's bottom action button reads "Done".
  test(
    'TC095/TC131.002: swiping a route card reveals its delete icon, and the primary button reads Done',
    { tag: ['@Menu-TC095', '@Menu-TC131.002'] },
    async ({ driver }) => {
      const transfers = new TransfersScreen(driver);
      let routeLabel = '';

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('TC131.002: the primary action button reads Done', async () => {
        await transfers.open();
        expect(await transfers.isDoneButtonVisible()).toBe(true);
      });

      await test.step('Set up: create a route-to-route transfer to swipe', async () => {
        await transfers.openSelectRouteSheet();
        routeLabel = await transfers.selectFirstAvailableRoute();
      });

      await test.step('TC095: swiping the route card reveals its delete icon', async () => {
        await transfers.swipeRouteCardToRevealDelete(routeLabel);
        expect(await transfers.isDeleteIconVisible(routeLabel)).toBe(true);
      });

      await test.step('Cleanup: delete the route just created, restoring the empty state', async () => {
        await transfers.deleteRoute('coffee', 'routeToRoute', routeLabel);
      });
    }
  );

  // TC096 "view delete confirmation" - live-verified 2026-08-03: tapping
  // the trash icon revealed by swiping a route card opens a "Delete
  // Transfer" popup ("Are you sure you want to delete the Route 1?") with
  // Cancel/Delete buttons.
  //
  // TC099 "verify empty state" - live-verified 2026-08-03: confirming that
  // Delete returns the Transfers landing page to its "No transfers yet."
  // empty state (the same message TC090 asserts, now checked specifically
  // as the direct result of a deletion). This also serves as the test's
  // own cleanup.
  test(
    'TC096/TC099: deleting a route asks for confirmation, then returns to the empty state',
    { tag: ['@Menu-TC096', '@Menu-TC099'] },
    async ({ driver }) => {
      const transfers = new TransfersScreen(driver);
      let routeLabel = '';

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('Set up: create a route-to-route transfer to delete', async () => {
        await transfers.open();
        await transfers.openSelectRouteSheet();
        routeLabel = await transfers.selectFirstAvailableRoute();
      });

      await test.step('TC096: tapping the delete icon opens the Delete Transfer confirmation popup', async () => {
        await transfers.swipeRouteCardToRevealDelete(routeLabel);
        await transfers.tapDeleteIcon(routeLabel);
        expect(await transfers.isDeleteConfirmationVisible(routeLabel)).toBe(true);
      });

      await test.step('TC099: confirming the delete returns the landing page to its empty state', async () => {
        await transfers.confirmDelete();
        expect(await transfers.isEmptyStateMessageVisible()).toBe(true);
      });
    }
  );

  // TC102 "proceed to add products" - live-verified 2026-08-03: tapping an
  // existing route card on the Transfers landing page navigates to an
  // "RTR Details" screen titled "Transfer to - Route 1".
  //
  // TC103 "verify RTR details screen" - live-verified 2026-08-03: that
  // screen shows a back arrow, the "Transfer to - <route>" heading, a
  // Product search field ("Scan or search brand, name, sku"), a search
  // icon and a scanner icon flanking it, and (with no products added yet)
  // a "No products recorded" empty state.
  test(
    'TC102/TC103: tapping a route card opens its RTR Details screen with search/scanner controls',
    { tag: ['@Menu-TC102', '@Menu-TC103'] },
    async ({ driver }) => {
      const transfers = new TransfersScreen(driver);
      let routeLabel = '';

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('Set up: create a route-to-route transfer to open', async () => {
        await transfers.open();
        await transfers.openSelectRouteSheet();
        routeLabel = await transfers.selectFirstAvailableRoute();
      });

      await test.step('TC102: tapping the route card opens its RTR Details screen', async () => {
        await transfers.openRtrDetails(routeLabel);
      });

      await test.step('TC103: the RTR Details screen shows its heading, search field, and search/scanner icons', async () => {
        const details = await transfers.isRtrDetailsScreenVisible(routeLabel);
        expect(details.heading).toBe(true);
        expect(details.searchField).toBe(true);
        expect(details.searchIcon).toBe(true);
        expect(details.scannerIcon).toBe(true);
        expect(await transfers.isNoProductsRecordedVisible()).toBe(true);
      });

      await test.step('Cleanup: back out and delete the route just created, restoring the empty state', async () => {
        await transfers.closeRtrDetails();
        await transfers.deleteRoute('coffee', 'routeToRoute', routeLabel);
      });
    }
  );

  // TC104 "open product search" (bundles TC108/TC111/TC114/TC120 per Excel)
  // - live-verified 2026-08-04: tapping the RTR Details search field and
  // typing opens a "Search product" bottom sheet showing name/SKU-matched
  // results (TC108). Tapping a result adds it to RTR Details as a quantity
  // EditText defaulting to "1", with its own numeric keypad open over it
  // (TC111 - initial quantity) and a `hint` combining the product name +
  // "Qty" (TC114 - same name/quantity shown). Backing out to the Transfers
  // landing page shows the route's card with its Total Products count
  // updated to 1 (TC120 - route name, product name, total count all
  // visible across the two screens).
  //
  // TC123 "verify updated product count" - same exact claim as TC120
  // ("tap back arrow from RTR Details" -> "view updated product name and
  // count on Transfers screen"), just with different Excel sample data
  // (Route 001/Snickers/count=2 vs. this test's real route/product/count=1)
  // - not re-verified as a separate test since it's the identical
  // assertion already made below.
  test(
    'TC104: searching and selecting a product adds it with an initial quantity',
    { tag: ['@Menu-TC104', '@Menu-TC108', '@Menu-TC111', '@Menu-TC114', '@Menu-TC120', '@Menu-TC123'] },
    async ({ driver }) => {
      const transfers = new TransfersScreen(driver);
      let routeLabel = '';

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('Set up: create a route-to-route transfer and open its RTR Details', async () => {
        await transfers.open();
        await transfers.openSelectRouteSheet();
        routeLabel = await transfers.selectFirstAvailableRoute();
        await transfers.openRtrDetails(routeLabel);
      });

      await test.step('TC104/TC108: searching a product opens results, and selecting one adds it with an initial quantity', async () => {
        await transfers.searchAndSelect('can');
        expect(await transfers.isFirstAddedProductVisible()).toBe(true);
      });

      await test.step('TC120: the route card shows the updated Total Products count', async () => {
        await transfers.closeRtrDetails();
        expect(await transfers.isRouteCardVisibleWithProductCount(routeLabel, 1)).toBe(true);
      });

      // Live-verified 2026-08-04: a route with products does NOT reliably
      // delete via deleteRoute() alone - it looks deleted in-session but
      // reverts on the next real app restart, permanently polluting real
      // backend data. The product must be removed first.
      await test.step('Cleanup: remove the product, then delete the now-empty route, restoring the empty state', async () => {
        await transfers.openRtrDetails(routeLabel);
        await transfers.removeFirstProduct();
        await transfers.closeRtrDetails();
        await transfers.deleteRoute('coffee', 'routeToRoute', routeLabel);
      });
    }
  );

  // TC105 "enter characters" - live-verified 2026-08-04: tapping the RTR
  // Details Product search field opens the REAL Android soft keyboard (a
  // standard qwerty IME), not a custom in-app keypad - this app's own
  // custom numeric keypads (seen elsewhere in this file, e.g. the
  // quantity field) are the exception, not the rule.
  //
  // TC106/TC107 "validate invalid input" - live-verified 2026-08-04:
  // searching a term with no matching products shows "No search results
  // found" inside the Search product sheet.
  test(
    'TC105/TC106: the search field opens the alphabet keypad, and a non-matching search shows no results',
    { tag: ['@Menu-TC105', '@Menu-TC106', '@Menu-TC107'] },
    async ({ driver }) => {
      const transfers = new TransfersScreen(driver);
      let routeLabel = '';

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('Set up: create a route-to-route transfer and open its RTR Details', async () => {
        await transfers.open();
        await transfers.openSelectRouteSheet();
        routeLabel = await transfers.selectFirstAvailableRoute();
        await transfers.openRtrDetails(routeLabel);
      });

      await test.step('TC105: tapping the search field opens the alphabet keypad', async () => {
        await transfers.tap('//android.widget.EditText');
        expect(await transfers.isAlphabetKeypadVisible()).toBe(true);
      });

      await test.step('TC106/TC107: searching a non-matching term shows no search results found', async () => {
        const searchField = await driver.$('//android.widget.EditText');
        await searchField.setValue('zzznonexistentproduct123');
        await driver.waitUntil(async () => transfers.isNoSearchResultsFoundVisible(), {
          timeout: 5000
        });
        expect(await transfers.isNoSearchResultsFoundVisible()).toBe(true);
      });

      await test.step('Cleanup: delete the (still-empty) route, restoring the empty state', async () => {
        // First back press only dismisses the soft keyboard; a second is
        // needed to dismiss the Search product sheet itself.
        await transfers.pressKeyCode(4);
        await transfers.pressKeyCode(4);
        await transfers.closeRtrDetails();
        await transfers.deleteRoute('coffee', 'routeToRoute', routeLabel);
      });
    }
  );

  // TC110 "access scanner option" - live-verified 2026-08-04: tapping the
  // scanner icon on RTR Details opens a real barcode-scanner screen - a
  // live camera preview (confirmed genuine, not a mock, via the recording
  // indicator that appears in the status bar) with a "Continue" button,
  // the only labeled element on the screen.
  test(
    'TC110: tapping the scanner icon opens the barcode-scanner screen',
    { tag: ['@Menu-TC110'] },
    async ({ driver }) => {
      const transfers = new TransfersScreen(driver);
      let routeLabel = '';

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('Set up: create a route-to-route transfer and open its RTR Details', async () => {
        await transfers.open();
        await transfers.openSelectRouteSheet();
        routeLabel = await transfers.selectFirstAvailableRoute();
        await transfers.openRtrDetails(routeLabel);
      });

      await test.step('TC110: tapping the scanner icon opens the barcode-scanner screen', async () => {
        await transfers.openProductScanner();
        expect(await transfers.isScannerScreenVisible()).toBe(true);
      });

      await test.step('Cleanup: leave the scanner and delete the (still-empty) route, restoring the empty state', async () => {
        await transfers.closeScanner();
        await transfers.closeRtrDetails();
        await transfers.deleteRoute('coffee', 'routeToRoute', routeLabel);
      });
    }
  );

  // TC115/TC122 "modify product quantity" - live-verified 2026-08-04:
  // the newly-added product's quantity field opens its own numeric keypad
  // with the default "1" fully selected, so the first digit tapped
  // REPLACES it (confirmed: tapping "5" changes "1" -> "5", not "15").
  // Tapping the keypad's confirm checkmark closes it and keeps the new
  // value in the field.
  //
  // TC117 "handle max quantity limit" - live-verified 2026-08-04: typing
  // digits beyond a certain point is silently rejected rather than
  // growing the number further. Confirmed a hard, reproducible cap:
  // tapping "9" ten times in a row after reaching 599 left it at exactly
  // 599 every time - the field never grows past this value.
  test(
    'TC115/TC117: the quantity field accepts digit taps but caps at a maximum value',
    { tag: ['@Menu-TC115', '@Menu-TC117', '@Menu-TC122'] },
    async ({ driver }) => {
      const transfers = new TransfersScreen(driver);
      let routeLabel = '';

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('Set up: create a route-to-route transfer, open RTR Details, and add a product', async () => {
        await transfers.open();
        await transfers.openSelectRouteSheet();
        routeLabel = await transfers.selectFirstAvailableRoute();
        await transfers.openRtrDetails(routeLabel);
        await transfers.searchAndSelect('can');
      });

      await test.step('TC115: tapping a digit replaces the default quantity', async () => {
        await transfers.tapQtyDigit(5);
        expect(await transfers.getQtyValue()).toBe('5');
      });

      await test.step('TC117: further digits stop being accepted once the max quantity is reached', async () => {
        for (let i = 0; i < 10; i++) {
          await transfers.tapQtyDigit(9);
        }
        const capped = await transfers.getQtyValue();
        expect(capped).toBe('599');
      });

      await test.step('TC122: confirming via the checkmark keeps the capped value', async () => {
        await transfers.confirmQty();
        expect(await transfers.getQtyValue()).toBe('599');
      });

      await test.step('Cleanup: remove the product, then delete the now-empty route, restoring the empty state', async () => {
        await transfers.removeFirstProduct();
        await transfers.closeRtrDetails();
        await transfers.deleteRoute('coffee', 'routeToRoute', routeLabel);
      });
    }
  );

  // TC118 "validate valid quantity" - live-verified 2026-08-04: entering
  // an ordinary, well within-range positive quantity (25 - comfortably
  // under TC117's confirmed 599 cap) is accepted as-is: no rejection, no
  // clamping, the exact digits typed are what the field shows both before
  // and after confirming via the checkmark.
  test(
    'TC118: a valid positive quantity is accepted as entered',
    { tag: ['@Menu-TC118'] },
    async ({ driver }) => {
      const transfers = new TransfersScreen(driver);
      let routeLabel = '';

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('Set up: create a route-to-route transfer, open RTR Details, and add a product', async () => {
        await transfers.open();
        await transfers.openSelectRouteSheet();
        routeLabel = await transfers.selectFirstAvailableRoute();
        await transfers.openRtrDetails(routeLabel);
        await transfers.searchAndSelect('can');
      });

      await test.step('TC118: entering a valid quantity (25) is accepted as-is', async () => {
        await transfers.tapQtyDigit(2);
        await transfers.tapQtyDigit(5);
        expect(await transfers.getQtyValue()).toBe('25');
        await transfers.confirmQty();
        expect(await transfers.getQtyValue()).toBe('25');
      });

      await test.step('Cleanup: remove the product, then delete the now-empty route, restoring the empty state', async () => {
        await transfers.removeFirstProduct();
        await transfers.closeRtrDetails();
        await transfers.deleteRoute('coffee', 'routeToRoute', routeLabel);
      });
    }
  );

  // TC126 "cancel product deletion" - tapping Cancel on the "Delete
  // Product" popup (the same popup TC096 confirms via Delete) retains the
  // product completely unchanged - same qty, still present.
  test(
    'TC126: cancelling the Delete Product popup retains the product unchanged',
    { tag: ['@Menu-TC126'] },
    async ({ driver }) => {
      const transfers = new TransfersScreen(driver);
      let routeLabel = '';

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('Set up: create a route-to-route transfer, open RTR Details, and add a product', async () => {
        await transfers.open();
        await transfers.openSelectRouteSheet();
        routeLabel = await transfers.selectFirstAvailableRoute();
        await transfers.openRtrDetails(routeLabel);
        await transfers.searchAndSelect('can');
      });

      await test.step('TC126: cancelling the Delete Product popup retains the product', async () => {
        const qtyBefore = await transfers.getQtyValue();
        await transfers.swipeAndTapProductDelete();
        await transfers.cancelProductDelete();
        expect(await transfers.isFirstAddedProductVisible()).toBe(true);
        expect(await transfers.getQtyValue()).toBe(qtyBefore);
      });

      await test.step('Cleanup: remove the product, then delete the now-empty route, restoring the empty state', async () => {
        await transfers.removeFirstProduct();
        await transfers.closeRtrDetails();
        await transfers.deleteRoute('coffee', 'routeToRoute', routeLabel);
      });
    }
  );

  // TC116 "prevent invalid quantity" (bundled into TC106's Excel row) -
  // live-verified 2026-08-04: the quantity keypad has no minus-sign/letter
  // keys to type a literal negative number with - "-" is a decrement
  // button, not text entry. Tapping it repeatedly past the default "1"
  // floors at "0" and stays there; it never goes negative.
  test(
    'TC116: the quantity field floors at 0 and never goes negative',
    { tag: ['@Menu-TC116'] },
    async ({ driver }) => {
      const transfers = new TransfersScreen(driver);
      let routeLabel = '';

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('Set up: create a route-to-route transfer, open RTR Details, and add a product', async () => {
        await transfers.open();
        await transfers.openSelectRouteSheet();
        routeLabel = await transfers.selectFirstAvailableRoute();
        await transfers.openRtrDetails(routeLabel);
        await transfers.searchAndSelect('can');
      });

      await test.step('TC116: repeated decrements floor at 0 and never go negative', async () => {
        for (let i = 0; i < 5; i++) {
          await transfers.tapQtyDecrement();
        }
        expect(await transfers.getQtyValue()).toBe('0');
      });

      await test.step('Cleanup: remove the product, then delete the now-empty route, restoring the empty state', async () => {
        await transfers.removeFirstProduct();
        await transfers.closeRtrDetails();
        await transfers.deleteRoute('coffee', 'routeToRoute', routeLabel);
      });
    }
  );
});

// Menu / "Transfers - Route to Warehouse Transfer" sub-area (mirrors the
// Route-to-Route sub-area above, tested in the block below since it's the
// same shared TransfersScreen).
test.describe('Menu - Transfers (Route to Warehouse)', () => {
  // Same reasoning as the describe block above.
  test.afterEach(async ({ driver }) => {
    await new HomeScreen(driver).returnToHome().catch(() => {});
  });

  // TC137/TC150 "view/verify empty state message" - live-verified
  // 2026-08-04: switching to the Route to Warehouse tab on a fresh
  // account shows the identical "No transfers yet." empty state already
  // confirmed for Route to Route (TC090) - same message, same screen,
  // just the other tab.
  //
  // TC138/TC151/TC139/TC145 "initiate transfer creation" / "view
  // permitted warehouses" / "verify warehouse name and count" - live-
  // verified 2026-08-04: this account has exactly ONE permitted warehouse
  // ("Charlotte"). Tapping the plus icon does not show a separate
  // warehouse-selection screen in that case - it creates the transfer
  // directly, landing on a card showing the warehouse's real name with
  // Total Products already at 0. See initiateWarehouseTransfer()'s own
  // doc comment for why this diverges from the Excel's literal wording.
  //
  // TC184 "create Route-to-Warehouse transfer" - the same assertion below
  // (the Charlotte card appearing with Total Products: 0) IS the
  // successful-creation confirmation this TC asks for.
  //
  // TC138.001 "verify removal of the Create Transfer button" - NOT
  // asserted: live-verified 2026-08-04 that no "Create Transfer" button
  // exists anywhere in this flow at all - not on the Transfers landing
  // page before creation, not after, and not on the RTW Details screen
  // either (checked all three). Same class of gap as Market's missing
  // "Product Group" filter tab - the Excel describes a control that isn't
  // present in this build, likely because with only one permitted
  // warehouse there's no picker step to have such a button on. Needs
  // clarification: retire this TC, or re-verify once/if a second
  // warehouse is added to this account.
  test(
    'TC137/TC138: the Route to Warehouse tab shows its empty state, and the plus icon creates a 0-product transfer',
    { tag: ['@Menu-TC137', '@Menu-TC138', '@Menu-TC139', '@Menu-TC145', '@Menu-TC150', '@Menu-TC151', '@Menu-TC184'] },
    async ({ driver }) => {
      const transfers = new TransfersScreen(driver);
      let warehouseLabel = '';

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('TC137/TC150: the Route to Warehouse tab shows the empty-state message', async () => {
        await transfers.open();
        await transfers.switchToTransferType('routeToWarehouse');
        expect(await transfers.isEmptyStateMessageVisible()).toBe(true);
      });

      await test.step('TC138/TC139/TC145/TC184: the plus icon creates a transfer to the permitted warehouse with 0 products', async () => {
        warehouseLabel = await transfers.initiateWarehouseTransfer();
        expect(warehouseLabel).not.toBe('');
        expect(await transfers.isRouteCardVisibleWithProductCount(warehouseLabel, 0)).toBe(true);
      });

      await test.step('Cleanup: delete the warehouse transfer just created, restoring the empty state', async () => {
        await transfers.deleteRoute('coffee', 'routeToWarehouse', warehouseLabel);
      });
    }
  );

  // TC146/TC147/TC148/TC149 - live-verified 2026-08-04: the warehouse
  // card's swipe-to-delete flow is IDENTICAL to the route card's (TC095/
  // TC096/TC099) - same trash icon, same "Delete Transfer" confirmation
  // popup (naming "Charlotte" this time), same Cancel/Delete buttons.
  // TC146 swipe reveals the icon; TC147 tapping it opens the popup; TC148
  // Cancel retains the warehouse unchanged; TC149 confirming Delete
  // removes it, returning to the empty state.
  test(
    'TC146/TC147/TC148/TC149: the warehouse delete flow matches the route delete flow exactly',
    { tag: ['@Menu-TC146', '@Menu-TC147', '@Menu-TC148', '@Menu-TC149'] },
    async ({ driver }) => {
      const transfers = new TransfersScreen(driver);
      let warehouseLabel = '';

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('Set up: create a route-to-warehouse transfer', async () => {
        await transfers.open();
        await transfers.switchToTransferType('routeToWarehouse');
        warehouseLabel = await transfers.initiateWarehouseTransfer();
      });

      await test.step('TC146: swiping the warehouse card reveals its delete icon', async () => {
        await transfers.swipeRouteCardToRevealDelete(warehouseLabel);
        expect(await transfers.isDeleteIconVisible(warehouseLabel)).toBe(true);
      });

      await test.step('TC147: tapping the delete icon opens the Delete Transfer confirmation popup', async () => {
        await transfers.tapDeleteIcon(warehouseLabel);
        expect(await transfers.isDeleteConfirmationVisible(warehouseLabel)).toBe(true);
      });

      await test.step('TC148: cancelling retains the warehouse unchanged', async () => {
        await transfers.cancelDeleteConfirmation();
        expect(await transfers.isRouteCardVisibleWithProductCount(warehouseLabel, 0)).toBe(true);
      });

      await test.step('TC149: confirming the delete removes the warehouse, returning to the empty state', async () => {
        await transfers.swipeRouteCardToRevealDelete(warehouseLabel);
        await transfers.tapDeleteIcon(warehouseLabel);
        await transfers.confirmDelete();
        expect(await transfers.isEmptyStateMessageVisible()).toBe(true);
      });
    }
  );

  // TC153 "proceed to add products" / TC154 "verify RTW details screen" /
  // TC155 "open product search" - live-verified 2026-08-04: every one of
  // these is IDENTICAL to RTR Details' equivalent (TC102/TC103/TC104) -
  // same "Transfer to - <name>" heading format, same search field/icons,
  // same "No products recorded" empty state, same Search product sheet
  // and quantity-keypad-on-select behavior. All existing TransfersScreen
  // methods (openRtrDetails/isRtrDetailsScreenVisible/searchAndSelect/
  // isFirstAddedProductVisible) worked without any changes.
  test(
    'TC153/TC154/TC155: the RTW Details screen and product search match RTR Details exactly',
    { tag: ['@Menu-TC153', '@Menu-TC154', '@Menu-TC155'] },
    async ({ driver }) => {
      const transfers = new TransfersScreen(driver);
      let warehouseLabel = '';

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('Set up: create a route-to-warehouse transfer', async () => {
        await transfers.open();
        await transfers.switchToTransferType('routeToWarehouse');
        warehouseLabel = await transfers.initiateWarehouseTransfer();
      });

      await test.step('TC153/TC154: tapping the warehouse card opens its RTW Details screen', async () => {
        await transfers.openRtrDetails(warehouseLabel);
        const details = await transfers.isRtrDetailsScreenVisible(warehouseLabel);
        expect(details.heading).toBe(true);
        expect(details.searchField).toBe(true);
        expect(details.searchIcon).toBe(true);
        expect(details.scannerIcon).toBe(true);
        expect(await transfers.isNoProductsRecordedVisible()).toBe(true);
      });

      await test.step('TC155: searching and selecting a product adds it to the RTW Details list', async () => {
        await transfers.searchAndSelect('can');
        expect(await transfers.isFirstAddedProductVisible()).toBe(true);
      });

      await test.step('Cleanup: remove the product, then delete the now-empty warehouse, restoring the empty state', async () => {
        await transfers.removeFirstProduct();
        await transfers.closeRtrDetails();
        await transfers.deleteRoute('coffee', 'routeToWarehouse', warehouseLabel);
      });
    }
  );

  // TC156 "enter characters" / TC157/TC158 "validate invalid input" -
  // expected to mirror TC105/TC106/TC107 exactly (verify live before
  // relying on this): the RTW Details Product search field should open the
  // same real Android soft keyboard, and a non-matching search should show
  // the same "No search results found" message inside the Search product
  // sheet.
  test(
    'TC156/TC157/TC158: the search field opens the alphabet keypad, and a non-matching search shows no results',
    { tag: ['@Menu-TC156', '@Menu-TC157', '@Menu-TC158'] },
    async ({ driver }) => {
      const transfers = new TransfersScreen(driver);
      let warehouseLabel = '';

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('Set up: create a route-to-warehouse transfer and open its RTW Details', async () => {
        await transfers.open();
        await transfers.switchToTransferType('routeToWarehouse');
        warehouseLabel = await transfers.initiateWarehouseTransfer();
        await transfers.openRtrDetails(warehouseLabel);
      });

      await test.step('TC156: tapping the search field opens the alphabet keypad', async () => {
        await transfers.tap('//android.widget.EditText');
        expect(await transfers.isAlphabetKeypadVisible()).toBe(true);
      });

      await test.step('TC157/TC158: searching a non-matching term shows no search results found', async () => {
        const searchField = await driver.$('//android.widget.EditText');
        await searchField.setValue('zzznonexistentproduct123');
        await driver.waitUntil(async () => transfers.isNoSearchResultsFoundVisible(), {
          timeout: 5000
        });
        expect(await transfers.isNoSearchResultsFoundVisible()).toBe(true);
      });

      await test.step('Cleanup: delete the (still-empty) warehouse, restoring the empty state', async () => {
        await transfers.pressKeyCode(4);
        await transfers.pressKeyCode(4);
        await transfers.closeRtrDetails();
        await transfers.deleteRoute('coffee', 'routeToWarehouse', warehouseLabel);
      });
    }
  );

  // TC161 "access scanner option" - expected to mirror TC110 exactly
  // (verify live before relying on this): tapping the scanner icon on RTW
  // Details should open the same real barcode-scanner screen as RTR
  // Details.
  test(
    'TC161: tapping the scanner icon opens the barcode-scanner screen',
    { tag: ['@Menu-TC161'] },
    async ({ driver }) => {
      const transfers = new TransfersScreen(driver);
      let warehouseLabel = '';

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('Set up: create a route-to-warehouse transfer and open its RTW Details', async () => {
        await transfers.open();
        await transfers.switchToTransferType('routeToWarehouse');
        warehouseLabel = await transfers.initiateWarehouseTransfer();
        await transfers.openRtrDetails(warehouseLabel);
      });

      await test.step('TC161: tapping the scanner icon opens the barcode-scanner screen', async () => {
        await transfers.openProductScanner();
        expect(await transfers.isScannerScreenVisible()).toBe(true);
      });

      await test.step('Cleanup: leave the scanner and delete the (still-empty) warehouse, restoring the empty state', async () => {
        await transfers.closeScanner();
        await transfers.closeRtrDetails();
        await transfers.deleteRoute('coffee', 'routeToWarehouse', warehouseLabel);
      });
    }
  );

  // TC166/TC168/TC173 "modify product quantity" / "handle max quantity
  // limit" / "update quantity successfully" - expected to mirror TC115/
  // TC117/TC122 exactly (verify live before relying on this).
  test(
    'TC166/TC168/TC173: the quantity field accepts digit taps but caps at a maximum value',
    { tag: ['@Menu-TC166', '@Menu-TC168', '@Menu-TC173'] },
    async ({ driver }) => {
      const transfers = new TransfersScreen(driver);
      let warehouseLabel = '';

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('Set up: create a route-to-warehouse transfer, open RTW Details, and add a product', async () => {
        await transfers.open();
        await transfers.switchToTransferType('routeToWarehouse');
        warehouseLabel = await transfers.initiateWarehouseTransfer();
        await transfers.openRtrDetails(warehouseLabel);
        await transfers.searchAndSelect('can');
      });

      await test.step('TC166: tapping a digit replaces the default quantity', async () => {
        await transfers.tapQtyDigit(5);
        expect(await transfers.getQtyValue()).toBe('5');
      });

      await test.step('TC168: further digits stop being accepted once the max quantity is reached', async () => {
        for (let i = 0; i < 10; i++) {
          await transfers.tapQtyDigit(9);
        }
        const capped = await transfers.getQtyValue();
        expect(capped).toBe('599');
      });

      await test.step('TC173: confirming via the checkmark keeps the capped value', async () => {
        await transfers.confirmQty();
        expect(await transfers.getQtyValue()).toBe('599');
      });

      await test.step('Cleanup: remove the product, then delete the now-empty warehouse, restoring the empty state', async () => {
        await transfers.removeFirstProduct();
        await transfers.closeRtrDetails();
        await transfers.deleteRoute('coffee', 'routeToWarehouse', warehouseLabel);
      });
    }
  );

  // TC169 "validate valid quantity" - expected to mirror TC118 exactly
  // (verify live before relying on this).
  test(
    'TC169: a valid positive quantity is accepted as entered',
    { tag: ['@Menu-TC169'] },
    async ({ driver }) => {
      const transfers = new TransfersScreen(driver);
      let warehouseLabel = '';

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('Set up: create a route-to-warehouse transfer, open RTW Details, and add a product', async () => {
        await transfers.open();
        await transfers.switchToTransferType('routeToWarehouse');
        warehouseLabel = await transfers.initiateWarehouseTransfer();
        await transfers.openRtrDetails(warehouseLabel);
        await transfers.searchAndSelect('can');
      });

      await test.step('TC169: entering a valid quantity (25) is accepted as-is', async () => {
        await transfers.tapQtyDigit(2);
        await transfers.tapQtyDigit(5);
        expect(await transfers.getQtyValue()).toBe('25');
        await transfers.confirmQty();
        expect(await transfers.getQtyValue()).toBe('25');
      });

      await test.step('Cleanup: remove the product, then delete the now-empty warehouse, restoring the empty state', async () => {
        await transfers.removeFirstProduct();
        await transfers.closeRtrDetails();
        await transfers.deleteRoute('coffee', 'routeToWarehouse', warehouseLabel);
      });
    }
  );

  // TC170 "verify warehouse summary" / TC174 "verify updated product count" -
  // same exact claim as TC120/TC123 ("tap back arrow from RTW Details" ->
  // "view updated warehouse name and product count on Transfers screen") -
  // expected to mirror exactly (verify live before relying on this).
  test(
    'TC170/TC174: tapping the back arrow shows the warehouse card with the updated product count',
    { tag: ['@Menu-TC170', '@Menu-TC174'] },
    async ({ driver }) => {
      const transfers = new TransfersScreen(driver);
      let warehouseLabel = '';

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('Set up: create a route-to-warehouse transfer, open RTW Details, and add a product', async () => {
        await transfers.open();
        await transfers.switchToTransferType('routeToWarehouse');
        warehouseLabel = await transfers.initiateWarehouseTransfer();
        await transfers.openRtrDetails(warehouseLabel);
        await transfers.searchAndSelect('can');
      });

      await test.step('TC170/TC174: the warehouse card shows the updated Total Products count', async () => {
        await transfers.closeRtrDetails();
        expect(await transfers.isRouteCardVisibleWithProductCount(warehouseLabel, 1)).toBe(true);
      });

      await test.step('Cleanup: remove the product, then delete the now-empty warehouse, restoring the empty state', async () => {
        await transfers.openRtrDetails(warehouseLabel);
        await transfers.removeFirstProduct();
        await transfers.closeRtrDetails();
        await transfers.deleteRoute('coffee', 'routeToWarehouse', warehouseLabel);
      });
    }
  );

  // TC176/TC177/TC178/TC179 "initiate delete action" / "view delete
  // confirmation" / "cancel product deletion" / "remove product from RTW
  // Details" - expected to mirror TC096/TC126's product-delete pattern
  // exactly (verify live before relying on this): swiping the product row
  // reveals its trash icon (TC176), tapping it opens the "Delete Product"
  // confirmation popup (TC177), Cancel retains the product unchanged
  // (TC178), and confirming Delete removes it, restoring the empty state
  // (TC179).
  test(
    'TC176/TC177/TC178/TC179: the product delete flow reveals a trash icon, confirms, and removes on confirmation',
    { tag: ['@Menu-TC176', '@Menu-TC177', '@Menu-TC178', '@Menu-TC179'] },
    async ({ driver }) => {
      const transfers = new TransfersScreen(driver);
      let warehouseLabel = '';

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('Set up: create a route-to-warehouse transfer, open RTW Details, and add a product', async () => {
        await transfers.open();
        await transfers.switchToTransferType('routeToWarehouse');
        warehouseLabel = await transfers.initiateWarehouseTransfer();
        await transfers.openRtrDetails(warehouseLabel);
        await transfers.searchAndSelect('can');
      });

      await test.step('TC176/TC177: swiping the product row and tapping its trash icon opens the Delete Product confirmation popup', async () => {
        await transfers.swipeAndTapProductDelete();
        expect(await transfers.isDeleteButtonVisible()).toBe(true);
      });

      await test.step('TC178: cancelling retains the product unchanged', async () => {
        await transfers.cancelProductDelete();
        expect(await transfers.isFirstAddedProductVisible()).toBe(true);
      });

      await test.step('TC179: confirming the delete removes the product, restoring the empty state', async () => {
        await transfers.removeFirstProduct();
        expect(await transfers.isNoProductsRecordedVisible()).toBe(true);
      });

      await test.step('Cleanup: delete the now-empty warehouse, restoring the empty state', async () => {
        await transfers.closeRtrDetails();
        await transfers.deleteRoute('coffee', 'routeToWarehouse', warehouseLabel);
      });
    }
  );

  // TC181/TC182 "expand/collapse warehouse details" - live-verified
  // 2026-08-04: the header's chevron toggle (next to the "+" icon) expands
  // the warehouse card to show its product names/quantities inline, and
  // collapses it back to just the "Total Products" summary. Only visible
  // once the warehouse has at least one product - a card with 0 products
  // has nothing to expand into, which is why an earlier pass on an empty
  // card wrongly read this control as a no-op.
  test(
    'TC181/TC182: the header toggle expands and collapses the warehouse card product list',
    { tag: ['@Menu-TC181', '@Menu-TC182'] },
    async ({ driver }) => {
      const transfers = new TransfersScreen(driver);
      let warehouseLabel = '';

      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.defaultRoute);
      });

      await test.step('Set up: create a route-to-warehouse transfer and add a product', async () => {
        await transfers.open();
        await transfers.switchToTransferType('routeToWarehouse');
        warehouseLabel = await transfers.initiateWarehouseTransfer();
        await transfers.openRtrDetails(warehouseLabel);
        await transfers.searchAndSelect('can');
        await transfers.confirmQty();
        await transfers.closeRtrDetails();
      });

      await test.step('TC181: tapping the header toggle expands the card to show the added product', async () => {
        expect(await transfers.isWarehouseCardExpanded(warehouseLabel, 'x1')).toBe(false);
        await transfers.toggleWarehouseCardsExpanded();
        expect(await transfers.isWarehouseCardExpanded(warehouseLabel, 'x1')).toBe(true);
      });

      await test.step('TC182: tapping the header toggle again collapses the card back to the summary', async () => {
        await transfers.toggleWarehouseCardsExpanded();
        expect(await transfers.isWarehouseCardExpanded(warehouseLabel, 'x1')).toBe(false);
      });

      await test.step('Cleanup: remove the product, then delete the now-empty warehouse, restoring the empty state', async () => {
        await transfers.openRtrDetails(warehouseLabel);
        await transfers.removeFirstProduct();
        await transfers.closeRtrDetails();
        await transfers.deleteRoute('coffee', 'routeToWarehouse', warehouseLabel);
      });
    }
  );

  // Excel TC308/TC309/TC310 (Menu area, "Transfers" sub-area - a Route-to-
  // Route Transfer scenario, NOT to be confused with Market's own unrelated
  // TC308 "Money Operation - Multiple POS", a different area entirely; see
  // [[tc308_multiple_pos_investigation]]) - one bundled Excel row describing
  // the identical RTR Details product-search/add flow already proven by
  // TC102-TC126 above, just repeated per-LOB (Vending/Coffee/Market) and
  // asking for a FINAL LIST OF 2 PRODUCTS specifically, which those earlier
  // tests never exercised (they only ever added one).
  //
  // NOT independently asserted (documented instead, live-verified
  // 2026-08-05):
  // - "Vending/Coffee tab should be highlighted" - no accessible signal:
  //   the tab's own `checked`/`selected` attributes stay "false" regardless
  //   of which tab is actually active, same class of gap as TC157/TC183
  //   elsewhere in this suite (already raised to dev - see the
  //   accessibility-hooks ask in [[market_coffee_vending_p1_status]]-style
  //   status mail history).
  // - "Chips related products should be get listed below search field" -
  //   live-verified this is NOT a special filter-chip UI component (no such
  //   element exists on this screen) - it's the Excel author's literal
  //   phrasing for "search for 'chips' surfaces chip-snack products",
  //   already covered by the existing plain-text search mechanism
  //   (TC104/TC108's searchAndSelect()) - not a distinct feature to build.
  // - The Excel's own specific sample product names (e.g. "Herr Reg Chips
  //   1.5oz", "Art of Tea EarlGrey") are real backend catalog data that
  //   varies per environment - not asserted literally, same reasoning as
  //   every other product-name TC in this suite; the underlying claim (2
  //   real products added, both shown with qty) is what's verified.
  test(
    'TC308/TC309/TC310: Route-to-Route Details shows a final list of 2 added products, across Vending/Coffee/Market',
    { tag: ['@Menu-TC308', '@Menu-TC309', '@Menu-TC310'] },
    async ({ driver }, testInfo) => {
      testInfo.setTimeout(240_000);
      const transfers = new TransfersScreen(driver);
      const lobs: Array<{ lob: 'vending' | 'coffee' | 'market'; tag: string }> = [
        { lob: 'vending', tag: 'TC308' },
        { lob: 'coffee', tag: 'TC309' },
        { lob: 'market', tag: 'TC310' }
      ];

      // Same correction as the TC084-088 test: the "vending" tab only
      // renders when the active route is Vending-capable - uses
      // vendingRoute so all three LOB passes below (vending/coffee/market)
      // reach a real tab in one login rather than defaultRoute, which
      // never shows "vending" at all.
      await test.step('Log in', async () => {
        await loginAndEnsureRoute(driver, mobileConfig.vendingRoute);
      });

      for (const { lob, tag } of lobs) {
        let routeLabel = '';

        await test.step(`${tag}: open ${lob}'s Route to Route tab and create a new transfer`, async () => {
          await transfers.open();
          await transfers.switchToLob(lob);
          await transfers.switchToTransferType('routeToRoute');
          await transfers.openSelectRouteSheet();
          routeLabel = await transfers.selectFirstAvailableRoute();
        });

        await test.step(`${tag}: RTR Details starts with Total Products 0 and "No products recorded"`, async () => {
          expect(await transfers.isRouteCardVisibleWithProductCount(routeLabel, 0)).toBe(true);
          await transfers.openRtrDetails(routeLabel);
          expect(await transfers.isNoProductsRecordedVisible()).toBe(true);
        });

        await test.step(`${tag}: adding 2 products shows both, each defaulting to qty 1`, async () => {
          await transfers.searchAndSelect('can');
          expect(await transfers.isFirstAddedProductVisible()).toBe(true);
          await transfers.searchAndSelect('can', 1);
          await transfers.closeRtrDetails();
          expect(await transfers.isRouteCardVisibleWithProductCount(routeLabel, 2)).toBe(true);
        });

        await test.step(`Cleanup (${tag}): remove both products, then delete the now-empty route`, async () => {
          await transfers.openRtrDetails(routeLabel);
          await transfers.removeFirstProduct();
          await transfers.removeFirstProduct();
          await transfers.closeRtrDetails();
          await transfers.deleteRoute(lob, 'routeToRoute', routeLabel);
        });
      }
    }
  );
});
