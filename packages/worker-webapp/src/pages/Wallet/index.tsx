import {
  Container,
  Title,
  Paper,
  Stack,
  Group,
  Text,
  Button,
  SimpleGrid,
  CopyButton,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { IconCopy, IconCheck } from '@tabler/icons-react';
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import { useGetUserProfileQuery } from '@/store/api/apiSlice';

export default function Wallet() {
  const [tonConnectUI] = useTonConnectUI();
  const userFriendlyAddress = useTonAddress();
  const { data: profile } = useGetUserProfileQuery();

  const handleConnect = () => {
    tonConnectUI.connectWallet();
  };

  const handleDisconnect = () => {
    tonConnectUI.disconnect();
  };

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <Title order={2}>Wallet</Title>

        <Paper withBorder p="xl">
          <Stack gap="lg">
            <Group justify="space-between">
              <Text fw={500}>TON Wallet</Text>
              {userFriendlyAddress ? (
                <Button variant="light" color="red" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              ) : (
                <Button onClick={handleConnect}>Connect Wallet</Button>
              )}
            </Group>

            {userFriendlyAddress && (
              <Group>
                <Text fz="sm" ff="monospace">
                  {userFriendlyAddress}
                </Text>
                <CopyButton value={userFriendlyAddress} timeout={2000}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? 'Copied' : 'Copy'}>
                      <ActionIcon color={copied ? 'teal' : 'gray'} onClick={copy}>
                        {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>
            )}
          </Stack>
        </Paper>

        {profile && (
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            <Paper withBorder p="md">
              <Stack gap="xs">
                <Text size="sm" c="dimmed">
                  Total Earnings
                </Text>
                <Title order={3}>{profile.earnings} TON</Title>
              </Stack>
            </Paper>

            <Paper withBorder p="md">
              <Stack gap="xs">
                <Text size="sm" c="dimmed">
                  Pending Rewards
                </Text>
                <Title order={3}>0 TON</Title>
              </Stack>
            </Paper>
          </SimpleGrid>
        )}

        <Paper withBorder p="md">
          <Stack gap="md">
            <Title order={3}>Recent Transactions</Title>
            <Text c="dimmed" ta="center" py="xl">
              No recent transactions
            </Text>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
} 