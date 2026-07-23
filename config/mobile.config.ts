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
  defaultRoute: {
    operationSearch: process.env.ROUTE_OPERATION_SEARCH || 'Miami',
    operationLabel: process.env.ROUTE_OPERATION_LABEL || 'Miami, FL',
    routeSearch: process.env.ROUTE_SEARCH || 'Route 010',
    routeLabel: process.env.ROUTE_LABEL || 'Route 010',
    day: (process.env.ROUTE_DAY as 'TODAY' | 'YESTERDAY' | 'TOMORROW') || 'TODAY'
  }
};
