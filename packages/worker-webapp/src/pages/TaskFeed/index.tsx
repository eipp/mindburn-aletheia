import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Chip,
  Stack,
  Grid,
  Select,
  MenuItem,
  IconButton,
  LinearProgress,
  Alert
} from '@mui/material';
import {
  FilterList as FilterIcon,
  Timer as TimerIcon,
  Assignment as TaskIcon,
  AttachMoney as RewardIcon
} from '@mui/icons-material';

import { useStore } from '../../store';
import { Task, TaskType, TaskStatus } from '../../types';

export default function TaskFeed() {
  const navigate = useNavigate();
  const { tasks, fetchTasks, isLoading, error } = useStore();
  const [filters, setFilters] = useState({
    type: 'all',
    duration: 'all',
    reward: 'all'
  });

  useEffect(() => {
    fetchTasks(filters);
  }, [fetchTasks, filters]);

  const handleTaskClick = (taskId: string) => {
    navigate(`/verify/${taskId}`);
  };

  const getTaskTypeColor = (type: TaskType) => {
    const colors = {
      text: 'primary',
      image: 'secondary',
      code: 'error',
      data: 'info',
      audio: 'warning'
    };
    return colors[type] || 'default';
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  const formatReward = (amount: number) => {
    return `${amount} TON`;
  };

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {/* Filters */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12}>
          <Stack direction="row" spacing={1} alignItems="center">
            <FilterIcon />
            <Select
              size="small"
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="text">Text</MenuItem>
              <MenuItem value="image">Image</MenuItem>
              <MenuItem value="code">Code</MenuItem>
              <MenuItem value="data">Data</MenuItem>
              <MenuItem value="audio">Audio</MenuItem>
            </Select>

            <TimerIcon />
            <Select
              size="small"
              value={filters.duration}
              onChange={(e) => setFilters({ ...filters, duration: e.target.value })}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="all">Any Duration</MenuItem>
              <MenuItem value="short">< 15min</MenuItem>
              <MenuItem value="medium">15-30min</MenuItem>
              <MenuItem value="long">> 30min</MenuItem>
            </Select>

            <RewardIcon />
            <Select
              size="small"
              value={filters.reward}
              onChange={(e) => setFilters({ ...filters, reward: e.target.value })}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="all">Any Reward</MenuItem>
              <MenuItem value="low">< 5 TON</MenuItem>
              <MenuItem value="medium">5-10 TON</MenuItem>
              <MenuItem value="high">> 10 TON</MenuItem>
            </Select>
          </Stack>
        </Grid>
      </Grid>

      {/* Task List */}
      {isLoading ? (
        <LinearProgress />
      ) : (
        <Stack spacing={2}>
          {tasks.map((task) => (
            <Card key={task.id}>
              <CardActionArea onClick={() => handleTaskClick(task.id)}>
                <CardContent>
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="h6" component="div">
                        {task.title}
                      </Typography>
                      <Chip
                        label={task.type}
                        color={getTaskTypeColor(task.type)}
                        size="small"
                      />
                    </Stack>

                    <Typography variant="body2" color="text.secondary">
                      {task.description}
                    </Typography>

                    <Stack direction="row" spacing={2}>
                      <Chip
                        icon={<TimerIcon />}
                        label={formatDuration(task.estimatedDuration)}
                        variant="outlined"
                        size="small"
                      />
                      <Chip
                        icon={<RewardIcon />}
                        label={formatReward(task.reward)}
                        variant="outlined"
                        size="small"
                      />
                      {task.status === TaskStatus.URGENT && (
                        <Chip
                          label="Urgent"
                          color="error"
                          size="small"
                        />
                      )}
                    </Stack>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
} 