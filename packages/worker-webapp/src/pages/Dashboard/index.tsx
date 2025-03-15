import {
  Container,
  Title,
  SimpleGrid,
  Paper,
  Text,
  Stack,
  Group,
  RingProgress,
  useMantineTheme,
} from '@mantine/core';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useGetUserProfileQuery } from '@/store/api/apiSlice';

const MOCK_EARNINGS_DATA = Array.from({ length: 7 }, (_, i) => ({
  date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toLocaleDateString(),
  earnings: Math.random() * 10,
}));

export default function Dashboard() {
  const theme = useMantineTheme();
  const { data: profile, isLoading } = useGetUserProfileQuery();

  if (isLoading || !profile) {
    return null;
  }

  const successRate = profile.totalTasks
    ? (profile.completedTasks / profile.totalTasks) * 100
    : 0;

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <Title order={2}>Dashboard</Title>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
          <Paper withBorder p="md">
            <Stack gap="xs">
              <Text size="sm" c="dimmed">
                Total Tasks
              </Text>
              <Title order={3}>{profile.totalTasks}</Title>
            </Stack>
          </Paper>

          <Paper withBorder p="md">
            <Stack gap="xs">
              <Text size="sm" c="dimmed">
                Completed Tasks
              </Text>
              <Title order={3}>{profile.completedTasks}</Title>
            </Stack>
          </Paper>

          <Paper withBorder p="md">
            <Stack gap="xs">
              <Text size="sm" c="dimmed">
                Total Earnings
              </Text>
              <Title order={3}>{profile.earnings} TON</Title>
            </Stack>
          </Paper>

          <Paper withBorder p="md">
            <Group>
              <RingProgress
                size={80}
                roundCaps
                thickness={8}
                sections={[{ value: successRate, color: theme.primaryColor }]}
                label={
                  <Text ta="center" fz="lg" fw={700}>
                    {Math.round(successRate)}%
                  </Text>
                }
              />
              <Stack gap={0}>
                <Text size="sm" c="dimmed">
                  Success Rate
                </Text>
                <Text fz="sm">
                  {profile.completedTasks} of {profile.totalTasks} tasks
                </Text>
              </Stack>
            </Group>
          </Paper>
        </SimpleGrid>

        <Paper withBorder p="md">
          <Stack gap="md">
            <Title order={3}>Earnings History</Title>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={MOCK_EARNINGS_DATA}>
                  <defs>
                    <linearGradient id="earnings" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={theme.colors[theme.primaryColor][5]}
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor={theme.colors[theme.primaryColor][5]}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="earnings"
                    stroke={theme.colors[theme.primaryColor][5]}
                    fillOpacity={1}
                    fill="url(#earnings)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
} 