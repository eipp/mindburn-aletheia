import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Mock Telegram Mini App SDK
window.Telegram = {
  WebApp: {
    ready: () => {},
    close: () => {},
    expand: () => {},
    MainButton: {
      show: () => {},
      hide: () => {},
      setText: () => {},
      onClick: () => {},
      offClick: () => {},
      enable: () => {},
      disable: () => {},
    },
    BackButton: {
      show: () => {},
      hide: () => {},
      onClick: () => {},
      offClick: () => {},
    },
    onEvent: () => {},
    offEvent: () => {},
    sendData: () => {},
    initData: '',
    initDataUnsafe: {},
    version: '6.0',
    platform: 'web',
    colorScheme: 'light',
    themeParams: {
      bg_color: '#ffffff',
      text_color: '#000000',
      hint_color: '#999999',
      link_color: '#2481cc',
      button_color: '#2481cc',
      button_text_color: '#ffffff',
    },
  },
};

// runs a cleanup after each test case
afterEach(() => {
  cleanup();
});
