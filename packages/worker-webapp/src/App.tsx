import { useEffect } from 'react';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { WebApp } from '@twa-dev/sdk';
import { Provider } from 'react-redux';
import { store } from './store';
import AppRouter from './routes';
import { theme } from './styles/theme';

const manifestUrl = 'https://aletheia.mindburn.org/tonconnect-manifest.json';

function App() {
  useEffect(() => {
    WebApp.ready();
    WebApp.expand();
  }, []);

  return (
    <Provider store={store}>
      <TonConnectUIProvider manifestUrl={manifestUrl}>
        <MantineProvider theme={theme} defaultColorScheme="dark">
          <Notifications position="top-right" />
          <AppRouter />
        </MantineProvider>
      </TonConnectUIProvider>
    </Provider>
  );
}

export default App;
