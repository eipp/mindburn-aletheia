import { createTheme, Theme } from '@mui/material/styles';
import { useEffect, useState } from 'react';

declare module '@mui/material/styles' {
  interface Palette {
    telegram: {
      main: string;
      dark: string;
      light: string;
      contrastText: string;
    };
  }
  interface PaletteOptions {
    telegram: {
      main: string;
      dark: string;
      light: string;
      contrastText: string;
    };
  }
}

const createAppTheme = (isDarkMode: boolean, telegramColors?: any): Theme =>
  createTheme({
    palette: {
      mode: isDarkMode ? 'dark' : 'light',
      primary: {
        main: telegramColors?.button_color || '#0088CC',
        contrastText: telegramColors?.button_text_color || '#FFFFFF',
      },
      background: {
        default: telegramColors?.bg_color || (isDarkMode ? '#1F1F1F' : '#F5F5F5'),
        paper: telegramColors?.secondary_bg_color || (isDarkMode ? '#2C2C2C' : '#FFFFFF'),
      },
      text: {
        primary: telegramColors?.text_color || (isDarkMode ? '#FFFFFF' : '#000000'),
        secondary: telegramColors?.hint_color || (isDarkMode ? '#A3A3A3' : '#666666'),
      },
      telegram: {
        main: '#229ED9',
        light: '#4EB3E2',
        dark: '#176E97',
        contrastText: '#FFFFFF',
      },
    },
    typography: {
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
      h1: { fontSize: '2rem', fontWeight: 600 },
      h2: { fontSize: '1.75rem', fontWeight: 600 },
      h3: { fontSize: '1.5rem', fontWeight: 600 },
      h4: { fontSize: '1.25rem', fontWeight: 600 },
      h5: { fontSize: '1.1rem', fontWeight: 600 },
      h6: { fontSize: '1rem', fontWeight: 600 },
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            fontWeight: 500,
          },
          contained: {
            boxShadow: 'none',
            '&:hover': {
              boxShadow: 'none',
            },
          },
        },
        defaultProps: {
          disableElevation: true,
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiBottomNavigation: {
        styleOverrides: {
          root: {
            height: 56,
            borderTop: '1px solid',
            borderColor: 'rgba(0, 0, 0, 0.12)',
          },
        },
      },
      MuiBottomNavigationAction: {
        styleOverrides: {
          root: {
            padding: '6px 0',
            minWidth: 64,
            '&.Mui-selected': {
              paddingTop: 6,
            },
          },
        },
      },
      MuiListItem: {
        styleOverrides: {
          root: {
            paddingTop: 12,
            paddingBottom: 12,
          },
        },
      },
    },
  });

export const useAppTheme = () => {
  const [theme, setTheme] = useState(() => createAppTheme(false));

  useEffect(() => {
    const handleThemeChange = (e: CustomEvent) => {
      const { isDarkMode, colors } = e.detail;
      setTheme(createAppTheme(isDarkMode, colors));
    };

    document.addEventListener('telegram-theme-changed', handleThemeChange as EventListener);
    return () => {
      document.removeEventListener('telegram-theme-changed', handleThemeChange as EventListener);
    };
  }, []);

  return theme;
};
