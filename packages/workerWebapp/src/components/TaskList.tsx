import React, { useState, useEffect } from 'react';
import { Task } from '../types';
import { TaskCard } from './TaskCard';
import { TaskType } from '../types/enums';
import { useGetAvailableTasksQuery } from '../store/api/apiSlice';
import { 
  Box, 
  Group, 
  Title, 
  Text, 
  Button, 
  Grid, 
  Paper, 
  Skeleton, 
  Pagination, 
  Center,
  Badge,
  Stack
} from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';

interface TaskListProps {
  filterTaskTypes?: TaskType[];
  searchQuery?: string;
  limit?: number;
  onTaskSelect?: (task: Task) => void;
  category?: string;
  difficulty?: string;
}

export const TaskList: React.FC<TaskListProps> = ({
  filterTaskTypes,
  searchQuery,
  limit = 10,
  onTaskSelect,
  category,
  difficulty
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [displayedTasks, setDisplayedTasks] = useState<Task[]>([]);
  
  // Use RTK Query to fetch tasks
  const { 
    data: tasks = [], 
    isLoading, 
    isFetching, 
    refetch
  } = useGetAvailableTasksQuery({ 
    limit: 100, // Fetch more than needed for client-side filtering
    category,
    difficulty
  });

  const loading = isLoading || isFetching;

  // Apply filters when tasks, filter types, or search query changes
  useEffect(() => {
    let filtered = [...tasks];
    
    // Apply task type filter if provided
    if (filterTaskTypes && filterTaskTypes.length > 0) {
      filtered = filtered.filter(task => 
        filterTaskTypes.includes(task.type as TaskType)
      );
    }
    
    // Apply search filter if provided
    if (searchQuery && searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(task => 
        task.title?.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query) ||
        task.id.toLowerCase().includes(query)
      );
    }
    
    setDisplayedTasks(filtered);
    setCurrentPage(1); // Reset pagination when filters change
  }, [tasks, filterTaskTypes, searchQuery]);
  
  // Calculate pagination
  const totalPages = Math.ceil(displayedTasks.length / limit);
  const paginatedTasks = displayedTasks.slice(
    (currentPage - 1) * limit,
    currentPage * limit
  );

  const handleSelectTask = (task: Task) => {
    if (onTaskSelect) {
      onTaskSelect(task);
    }
  };

  if (loading && displayedTasks.length === 0) {
    return (
      <Box p="md">
        <Title order={2} mb="md">Available Tasks</Title>
        {Array.from({ length: 3 }).map((_, index) => (
          <Paper key={index} p="md" mb="md" withBorder>
            <Skeleton height={24} mb="md" width="70%" />
            <Skeleton height={16} mb="md" />
            <Skeleton height={16} mb="md" width="90%" />
            <Group mt="md">
              <Skeleton height={22} width={80} radius="xl" />
              <Skeleton height={22} width={80} radius="xl" />
            </Group>
          </Paper>
        ))}
      </Box>
    );
  }

  if (displayedTasks.length === 0) {
    return (
      <Box p="md">
        <Title order={2} mb="md">Available Tasks</Title>
        <Paper p="xl" withBorder sx={{ textAlign: 'center' }}>
          <Text size="lg" fw={500} mb="md">No tasks available matching your criteria</Text>
          <Text size="sm" color="dimmed" mb="lg">
            Try changing your filters or check back later for new tasks
          </Text>
          <Button onClick={() => refetch()}>Refresh Tasks</Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box p="md">
      <Stack spacing="xs" mb="md">
        <Group position="apart">
          <Title order={2}>Available Tasks</Title>
          <Badge size="lg">{displayedTasks.length} tasks</Badge>
        </Group>
        <Text size="sm" color="dimmed">
          Select a task to start working on verification
        </Text>
      </Stack>

      <Grid>
        {paginatedTasks.map(task => (
          <Grid.Col key={task.id} span={12} md={6} lg={4}>
            <TaskCard 
              task={task} 
              onClick={() => handleSelectTask(task)} 
            />
          </Grid.Col>
        ))}
      </Grid>
      
      {totalPages > 1 && (
        <Center mt="xl">
          <Pagination 
            total={totalPages} 
            value={currentPage}
            onChange={setCurrentPage}
            withEdges
          />
        </Center>
      )}
      
      {loading && (
        <Center mt="md">
          <Text size="sm" color="dimmed">Updating tasks...</Text>
        </Center>
      )}
      
      <Center mt="xl">
        <Button 
          onClick={() => refetch()} 
          variant="outline"
          leftIcon={<IconChevronDown size={16} />}
          loading={loading}
        >
          Refresh Tasks
        </Button>
      </Center>
    </Box>
  );
}; 