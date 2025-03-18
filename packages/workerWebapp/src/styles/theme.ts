import { createTheme, rem } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'blue',
  primaryShade: 6,
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  defaultRadius: 'md',
  components: {
    Button: {
      defaultProps: {
        size: 'md',
      },
      styles: {
        root: {
          height: rem(40),
        },
      },
    },
    Card: {
      defaultProps: {
        padding: 'lg',
        radius: 'md',
      },
    },
    Paper: {
      defaultProps: {
        padding: 'md',
        radius: 'md',
      },
    },
  },
  other: {
    taskCard: {
      height: rem(200),
    },
    headerHeight: rem(60),
    maxContentWidth: rem(800),
  },
});
