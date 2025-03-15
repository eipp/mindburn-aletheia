import { Card, Group, Stack, Text, Badge, Button, Progress } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { Task, TaskStatus, TaskType } from '@/types';
import { formatDistanceToNow } from 'date-fns';

const STATUS_COLORS = {
  [TaskStatus.PENDING]: 'blue',
  [TaskStatus.ASSIGNED]: 'yellow',
  [TaskStatus.SUBMITTED]: 'cyan',
  [TaskStatus.VERIFIED]: 'green',
  [TaskStatus.REJECTED]: 'red',
};

const TYPE_LABELS = {
  [TaskType.TEXT_VERIFICATION]: 'Text',
  [TaskType.IMAGE_VERIFICATION]: 'Image',
  [TaskType.AUDIO_VERIFICATION]: 'Audio',
  [TaskType.VIDEO_VERIFICATION]: 'Video',
};

interface TaskCardProps {
  task: Task;
  onAccept?: (taskId: string) => void;
}

export default function TaskCard({ task, onAccept }: TaskCardProps) {
  const navigate = useNavigate();
  const timeLeft = formatDistanceToNow(task.deadline, { addSuffix: true });
  const progress = Math.max(0, Math.min(100, ((task.deadline - Date.now()) / (30 * 60 * 1000)) * 100));

  return (
    <Card withBorder>
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <Badge color={STATUS_COLORS[task.status]}>{task.status}</Badge>
          <Badge variant="light">{TYPE_LABELS[task.type]}</Badge>
        </Group>

        <Text lineClamp={2} fw={500}>
          {task.data.instructions}
        </Text>

        <Group grow>
          <Stack gap={4}>
            <Text size="sm" c="dimmed">
              Time Left
            </Text>
            <Text size="sm" fw={500}>
              {timeLeft}
            </Text>
          </Stack>
          <Stack gap={4}>
            <Text size="sm" c="dimmed">
              Reward
            </Text>
            <Text size="sm" fw={500}>
              {task.reward} TON
            </Text>
          </Stack>
        </Group>

        <Progress value={progress} color={progress < 20 ? 'red' : 'blue'} size="sm" />

        <Group>
          <Button
            variant="light"
            onClick={() => navigate(`/tasks/${task.id}`)}
            style={{ flex: 1 }}
          >
            View Details
          </Button>
          {task.status === TaskStatus.PENDING && onAccept && (
            <Button onClick={() => onAccept(task.id)} style={{ flex: 1 }}>
              Accept Task
            </Button>
          )}
        </Group>
      </Stack>
    </Card>
  );
} 