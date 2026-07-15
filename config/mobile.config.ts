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
    'appium:noReset': true,
    'appium:newCommandTimeout': 240
  },
  timeouts: {
    element: parseInt(process.env.ELEMENT_TIMEOUT || '15000')
  }
};
