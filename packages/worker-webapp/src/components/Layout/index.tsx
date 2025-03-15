import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppShell,
  Burger,
  Group,
  UnstyledButton,
  Stack,
  Text,
  rem,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconDashboard, IconTasks, IconUser, IconWallet } from '@tabler/icons-react';
import { TonConnectButton } from '@tonconnect/ui-react';

const NAV_ITEMS = [
  { icon: IconDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: IconTasks, label: 'Tasks', path: '/tasks' },
  { icon: IconUser, label: 'Profile', path: '/profile' },
  { icon: IconWallet, label: 'Wallet', path: '/wallet' },
];

export default function Layout() {
  const [opened, { toggle }] = useDisclosure();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 300,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Text size="lg" fw={700}>Aletheia</Text>
          </Group>
          <TonConnectButton />
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Stack gap={8}>
          {NAV_ITEMS.map((item) => (
            <UnstyledButton
              key={item.path}
              onClick={() => navigate(item.path)}
              py="xs"
              px="md"
              style={{
                borderRadius: rem(8),
                backgroundColor:
                  location.pathname === item.path ? 'var(--mantine-color-blue-light)' : 'transparent',
              }}
            >
              <Group>
                <item.icon size={20} />
                <Text size="sm">{item.label}</Text>
              </Group>
            </UnstyledButton>
          ))}
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
} 