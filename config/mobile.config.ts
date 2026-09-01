import dotenv from 'dotenv';
dotenv.config();

export const mobileConfig = {
  appium: {
    host: process.env.APPIUM_HOST || 'localhost',
    port: parseInt(process.env.APPIUM_PORT || '4723'),
    path: '/'
  },
  capabilities: {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': process.env.DEVICE_NAME || 'emulator-5554',
    'appium:appPackage': process.env.APP_PACKAGE || 'com.canteen.nexus',
    'appium:appActivity': process.env.APP_ACTIVITY || '.MainActivity',
    'appium:noReset': false,
    'appium:fullReset': true,
    'appium:newCommandTimeout': 240
  },
  timeouts: {
    element: parseInt(process.env.ELEMENT_TIMEOUT || '15000')
  },
  // The route/day every spec expects to find real seeded data on - centralized
  // here (rather than hardcoded in utils/login-flow.ts) so switching routes in
  // future only means changing these values or the matching env vars, no code
  // changes needed.
  //
  // day='YESTERDAY' (not 'TODAY'): live-verified 2026-07-24 that BA's seeded
  // Market/Coffee data on Miami/010 is anchored to the fixed calendar date
  // Jul 23, not a rolling "today" - real "today" already advanced past it,
  // leaving 'TODAY' pointed at an empty schedule ("0 Delivery"). This is a
  // stopgap: once real time passes Jul 24, 'YESTERDAY' will also go stale
  // (it'll resolve to Jul 24, itself empty) - needs BA to either re-seed on
  // a rolling date or confirm a fixed reference date to standardize on.
  defaultRoute: {
    operationSearch: process.env.ROUTE_OPERATION_SEARCH || 'Miami',
    operationLabel: process.env.ROUTE_OPERATION_LABEL || 'Miami, FL',
    routeSearch: process.env.ROUTE_SEARCH || 'Route 010',
    routeLabel: process.env.ROUTE_LABEL || 'Route 010',
    day: (process.env.ROUTE_DAY as 'TODAY' | 'YESTERDAY' | 'TOMORROW') || 'YESTERDAY'
  },
  // ---- PER-LOB ROUTES (user-specified 2026-08-28, authoritative) ----
  //
  //   Vending - Miami, FL / Route 990
  //   Coffee  - Charlotte, NC / Route 103
  //   Market  - Miami, FL / Route 001
  //
  // Each LOB gets its OWN named entry. Until now Coffee borrowed the entry
  // called `vendingRoute` because both happened to sit on Charlotte 103 - 47
  // of that key's 56 call sites were Coffee tests. Repointing it to Miami 990
  // without splitting them first would have moved every Coffee test to the
  // wrong route silently, failing on data rather than on anything real. Name
  // the route after the LOB that owns it, and that class of accident cannot
  // happen again.
  vendingRoute: {
    operationSearch: process.env.VENDING_OPERATION_SEARCH || 'Miami',
    operationLabel: process.env.VENDING_OPERATION_LABEL || 'Miami, FL',
    routeSearch: process.env.VENDING_ROUTE_SEARCH || 'Route 990',
    routeLabel: process.env.VENDING_ROUTE_LABEL || 'Route 990',
    // UNVERIFIED on Miami 990 - carried over from Charlotte 103, where
    // YESTERDAY is where the seeded data lives. Confirm on the first Vending
    // run against this route and correct if the data sits on TODAY instead.
    day: (process.env.VENDING_ROUTE_DAY as 'TODAY' | 'YESTERDAY' | 'TOMORROW') || 'YESTERDAY'
  },
  // Coffee's own route. Holds the value `vendingRoute` used to carry, so every
  // Coffee test keeps running exactly where it has been all along - the switch
  // is a rename, not a data move. Also used by the Start-of-Day cases that
  // name Charlotte 103 explicitly (Miami 010 needs BA data prep).
  coffeeRoute: {
    operationSearch: process.env.COFFEE_OPERATION_SEARCH || 'Charlotte',
    operationLabel: process.env.COFFEE_OPERATION_LABEL || 'Charlotte, NC',
    routeSearch: process.env.COFFEE_ROUTE_SEARCH || 'Route 103',
    routeLabel: process.env.COFFEE_ROUTE_LABEL || 'Route 103',
    // CORRECTED 2026-08-31 to TODAY (was YESTERDAY) - live-verified on a
    // clean 0.1.92 install: Charlotte/103 carries 154 deliveries on TODAY
    // (Aug 31) and ZERO on YESTERDAY (Aug 30). Every Coffee and ad-hoc test
    // was therefore switching itself onto an EMPTY day and then failing on
    // missing accounts/stops, which read as data gaps but was this setting.
    // The YESTERDAY default dates back to when the seeded data sat on a
    // fixed calendar date; it now rolls with the current day.
    day: (process.env.COFFEE_ROUTE_DAY as 'TODAY' | 'YESTERDAY' | 'TOMORROW') || 'TODAY'
  },
  // PBI 850155 (Ad-hoc Scheduling, TC025/TC028) needs a genuinely zero-delivery
  // day to test the empty-state UI - defaultRoute/vendingRoute both had real
  // seeded data on every day by the time this was needed. Miami, FL / Route 001
  // confirmed live (2026-07-27) to be empty across Yesterday/Today/Tomorrow -
  // a dedicated test route, not a real business route like the other two.
  // Day is passed per-call (not fixed here) since TC028 specifically needs to
  // exercise all three.
  // CORRECTED 2026-08-24 (build 0.1.90): Miami/001 is no longer empty -
  // live-verified it now carries 2 real, seeded Market deliveries (Teva
  // Pharmaceutical Industries LTB / Order 13517384, and United Collection
  // Bureau, Inc. / Order 13517385). It survives under its own name as
  // marketRoute below, which uses it deliberately FOR that data.
  //
  // MOVED 2026-08-27 to CHARLOTTE, NC / Route 001 (user-specified). This
  // entry means "the route guaranteed to have zero deliveries", so leaving
  // it pointed at a route carrying two of them made the name lie, and every
  // consumer inherited that - SD-TC-024 could not run at all. Repointed
  // rather than adding a second empty-route entry, so there is exactly one
  // answer to "which route is the empty one".
  //
  // NOTE this is shared: SD-TC-024 plus TC025/TC028 all read it. That is
  // intended - all three want the same thing - but it does mean TC025/TC028
  // now exercise Charlotte 001 rather than Miami 001.
  //
  // Also note isOnRoute() in login-flow.ts keys its "trust a 0-delivery
  // count as route confirmation" special case on THIS entry's route NUMBER
  // ("001"). That still resolves correctly, and is now unambiguous again:
  // previously two different 001s were in play.
  emptyRoute: {
    operationSearch: process.env.EMPTY_ROUTE_OPERATION_SEARCH || 'Charlotte',
    operationLabel: process.env.EMPTY_ROUTE_OPERATION_LABEL || 'Charlotte, NC',
    routeSearch: process.env.EMPTY_ROUTE_SEARCH || 'Route 001',
    routeLabel: process.env.EMPTY_ROUTE_LABEL || 'Route 001'
  },
  // M-TC-005/008/013/014/015/016 (build 0.1.90) - same physical route as
  // emptyRoute above, now used deliberately FOR its 2 real seeded Market
  // deliveries rather than for being empty. See market-service.spec.ts's
  // own note on why these tests moved off AETNA/CureLeaf (ad-hoc-created
  // orders have no seeded Delivery products and can't reach a meaningful
  // checklist state).
  // Market's own route. Renamed from `miamiRoute001` 2026-08-28 - same physical
  // route and same seeded data, now named for the LOB that owns it so it reads
  // alongside vendingRoute/coffeeRoute.
  marketRoute: {
    operationSearch: process.env.MARKET_OPERATION_SEARCH || 'Miami',
    operationLabel: process.env.MARKET_OPERATION_LABEL || 'Miami, FL',
    routeSearch: process.env.MARKET_ROUTE_SEARCH || '001',
    routeLabel: process.env.MARKET_ROUTE_LABEL || 'Route 001',
    day: (process.env.MARKET_ROUTE_DAY as 'TODAY' | 'YESTERDAY' | 'TOMORROW') || 'TODAY'
  }
};
