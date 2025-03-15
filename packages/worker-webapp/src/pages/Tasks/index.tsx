import { useState } from 'react';
import {
  Container,
  Title,
  Group,
  Select,
  TextInput,
  SimpleGrid,
  LoadingOverlay,
  Text,
  Stack,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import { TaskType } from '@/types';
import TaskCard from '@/components/TaskCard';
import { useGetTasksQuery, useSubmitTaskMutation } from '@/store/api/apiSlice';

const TASK_TYPE_OPTIONS = Object.entries(TaskType).map(([key, value]) => ({
  label: key.split('_')[0],
  value,
}));

export default function Tasks() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<string | null>(null);
  const isMobile = useMediaQuery('(max-width: 48em)');

  const { data: tasks, isLoading, error } = useGetTasksQuery();
  const [submitTask] = useSubmitTaskMutation();

  const filteredTasks = tasks?.filter((task) => {
    const matchesSearch = task.data.instructions.toLowerCase().includes(search.toLowerCase());
    const matchesType = !type || task.type === type;
    return matchesSearch && matchesType;
  });

  const handleAcceptTask = async (taskId: string) => {
    try {
      await submitTask({ taskId, answer: '' });
    } catch (error) {
      console.error('Error accepting task:', error);
    }
  };

  if (isLoading) {
    return <LoadingOverlay visible />;
  }

  if (error) {
    return (
      <Container size="lg" py="xl">
        <Stack align="center" gap="md">
          <Text c="red">Error loading tasks. Please try again later.</Text>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" wrap="nowrap">
          <Title order={2}>Available Tasks</Title>
        </Group>

        <Group grow={!isMobile}>
          <TextInput
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftSection={<IconSearch size={16} />}
          />
          <Select
            placeholder="Filter by type"
            value={type}
            onChange={setType}
            data={TASK_TYPE_OPTIONS}
            clearable
          />
        </Group>

        {filteredTasks?.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            No tasks found matching your criteria.
          </Text>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {filteredTasks?.map((task) => (
              <TaskCard key={task.id} task={task} onAccept={handleAcceptTask} />
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </Container>
  );
} 