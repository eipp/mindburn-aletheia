declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
        };
        BackButton: {
          isVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        initData: string;
        initDataUnsafe: {
          query_id: string;
          user: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
            is_premium?: boolean;
          };
          auth_date: number;
          hash: string;
        };
        colorScheme: 'light' | 'dark';
        themeParams: {
          bg_color: string;
          text_color: string;
          hint_color: string;
          link_color: string;
          button_color: string;
          button_text_color: string;
          secondary_bg_color: string;
        };
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        onEvent: (eventType: string, eventHandler: () => void) => void;
        offEvent: (eventType: string, eventHandler: () => void) => void;
        sendData: (data: string) => void;
        openLink: (url: string) => void;
        openTelegramLink: (url: string) => void;
        openInvoice: (url: string) => void;
      };
    };
  }
}

export const telegramWebApp = window.Telegram?.WebApp;

export const initTelegramApp = () => {
  if (!telegramWebApp) {
    console.error('Telegram WebApp is not available');
    return;
  }

  // Initialize the app
  telegramWebApp.ready();

  // Expand the Mini App to full height
  telegramWebApp.expand();

  // Set up viewport meta for mobile optimization
  const viewportMeta = document.createElement('meta');
  viewportMeta.name = 'viewport';
  viewportMeta.content =
    'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
  document.head.appendChild(viewportMeta);

  // Handle theme changes
  const handleThemeChange = () => {
    const isDarkMode = telegramWebApp.colorScheme === 'dark';
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');

    // Apply theme colors from Telegram
    const {
      bg_color,
      text_color,
      hint_color,
      link_color,
      button_color,
      button_text_color,
      secondary_bg_color,
    } = telegramWebApp.themeParams;

    const root = document.documentElement;
    root.style.setProperty('--tg-theme-bg-color', bg_color);
    root.style.setProperty('--tg-theme-text-color', text_color);
    root.style.setProperty('--tg-theme-hint-color', hint_color);
    root.style.setProperty('--tg-theme-link-color', link_color);
    root.style.setProperty('--tg-theme-button-color', button_color);
    root.style.setProperty('--tg-theme-button-text-color', button_text_color);
    root.style.setProperty('--tg-theme-secondary-bg-color', secondary_bg_color);

    // Update Material-UI theme
    document.dispatchEvent(
      new CustomEvent('telegram-theme-changed', {
        detail: { isDarkMode, colors: telegramWebApp.themeParams },
      })
    );
  };

  // Initial theme setup
  handleThemeChange();

  // Listen for theme changes
  telegramWebApp.onEvent('themeChanged', handleThemeChange);

  // Handle viewport changes
  const handleViewportChanged = () => {
    const vh = telegramWebApp.viewportHeight;
    const stableVh = telegramWebApp.viewportStableHeight;
    document.documentElement.style.setProperty('--tg-viewport-height', `${vh}px`);
    document.documentElement.style.setProperty('--tg-viewport-stable-height', `${stableVh}px`);
  };

  handleViewportChanged();
  telegramWebApp.onEvent('viewportChanged', handleViewportChanged);

  // Handle hardware back button
  telegramWebApp.onEvent('backButtonClicked', () => {
    window.history.back();
  });
};

export const showMainButton = (text: string, onClick: () => void) => {
  if (!telegramWebApp) return;

  const { MainButton } = telegramWebApp;
  MainButton.text = text;
  MainButton.onClick(onClick);
  MainButton.show();
};

export const hideMainButton = () => {
  if (!telegramWebApp) return;

  const { MainButton } = telegramWebApp;
  MainButton.hide();
};

export const showBackButton = (onClick: () => void) => {
  if (!telegramWebApp) return;

  const { BackButton } = telegramWebApp;
  BackButton.onClick(onClick);
  BackButton.show();
};

export const hideBackButton = () => {
  if (!telegramWebApp) return;

  const { BackButton } = telegramWebApp;
  BackButton.hide();
};

export const hapticFeedback = {
  success: () => {
    telegramWebApp?.HapticFeedback.notificationOccurred('success');
  },
  error: () => {
    telegramWebApp?.HapticFeedback.notificationOccurred('error');
  },
  warning: () => {
    telegramWebApp?.HapticFeedback.notificationOccurred('warning');
  },
  impact: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') => {
    telegramWebApp?.HapticFeedback.impactOccurred(style);
  },
  selection: () => {
    telegramWebApp?.HapticFeedback.selectionChanged();
  },
};

export const getUserData = () => {
  if (!telegramWebApp) return null;

  return telegramWebApp.initDataUnsafe.user;
};

export const getQueryId = () => {
  if (!telegramWebApp) return null;

  return telegramWebApp.initDataUnsafe.query_id;
};

export const sendData = (data: any) => {
  if (!telegramWebApp) return;

  telegramWebApp.sendData(JSON.stringify(data));
};

export const openLink = (url: string) => {
  if (!telegramWebApp) {
    window.open(url, '_blank');
    return;
  }

  telegramWebApp.openLink(url);
};

export const openTelegramLink = (url: string) => {
  if (!telegramWebApp) {
    window.open(url, '_blank');
    return;
  }

  telegramWebApp.openTelegramLink(url);
};

export const openInvoice = (url: string) => {
  if (!telegramWebApp) {
    window.open(url, '_blank');
    return;
  }

  telegramWebApp.openInvoice(url);
};
