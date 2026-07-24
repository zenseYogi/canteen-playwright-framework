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
  // Vending confirmed (2026-07-24) to live on a separate route from
  // Market/Coffee - Charlotte, NC / Route 103, not the Miami/010 default
  // above. Kept as its own config (not folded into defaultRoute) since the
  // two LOBs' data genuinely lives on different routes; specs needing this
  // route call utils/login-flow.ts's switchRoute() explicitly after login,
  // rather than relying on the post-MFA gate auto-handling (which only
  // fires for a fresh/reset account and always uses defaultRoute).
  vendingRoute: {
    operationSearch: process.env.VENDING_OPERATION_SEARCH || 'Charlotte',
    operationLabel: process.env.VENDING_OPERATION_LABEL || 'Charlotte, NC',
    routeSearch: process.env.VENDING_ROUTE_SEARCH || 'Route 103',
    routeLabel: process.env.VENDING_ROUTE_LABEL || 'Route 103',
    day: (process.env.VENDING_ROUTE_DAY as 'TODAY' | 'YESTERDAY' | 'TOMORROW') || 'YESTERDAY'
  }
};
