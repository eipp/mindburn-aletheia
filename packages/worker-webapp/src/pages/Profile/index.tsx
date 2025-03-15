import { useEffect } from 'react';
import {
  Box,
  Avatar,
  Typography,
  Paper,
  Grid,
  Chip,
  LinearProgress,
  Stack,
  Card,
  CardContent,
  IconButton,
  Alert,
  Button
} from '@mui/material';
import {
  Star as StarIcon,
  Assignment as TaskIcon,
  EmojiEvents as BadgeIcon,
  Edit as EditIcon,
  Add as AddIcon
} from '@mui/icons-material';

import { useStore } from '../../store';
import { Badge } from '../../types';

export default function Profile() {
  const { profile, fetchProfile, isLoading, error } = useStore();

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const calculateLevelProgress = () => {
    if (!profile) return 0;
    const experienceForNextLevel = profile.level * 1000;
    return (profile.experience / experienceForNextLevel) * 100;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const renderBadge = (badge: Badge) => (
    <Card key={badge.id} sx={{ width: '100%', mb: 1 }}>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar src={badge.icon} sx={{ bgcolor: 'primary.main' }}>
            <BadgeIcon />
          </Avatar>
          <Box>
            <Typography variant="subtitle1">{badge.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {badge.description}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Earned on {formatDate(badge.earnedAt)}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return <LinearProgress />;
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!profile) {
    return (
      <Alert severity="info" sx={{ m: 2 }}>
        Profile not found
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar
            src={profile.avatar}
            sx={{ width: 80, height: 80 }}
          />
          <Box sx={{ flexGrow: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="h6">{profile.name}</Typography>
              <IconButton size="small">
                <EditIcon fontSize="small" />
              </IconButton>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Member since {formatDate(profile.joinedAt)}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={4}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <StarIcon color="primary" />
            <Typography variant="h6">{profile.rating.toFixed(1)}</Typography>
            <Typography variant="body2">Rating</Typography>
          </Paper>
        </Grid>
        <Grid item xs={4}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <TaskIcon color="primary" />
            <Typography variant="h6">{profile.completedTasks}</Typography>
            <Typography variant="body2">Tasks</Typography>
          </Paper>
        </Grid>
        <Grid item xs={4}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <BadgeIcon color="primary" />
            <Typography variant="h6">{profile.badges.length}</Typography>
            <Typography variant="body2">Badges</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Level Progress */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Level {profile.level}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={calculateLevelProgress()}
          sx={{ height: 10, borderRadius: 5 }}
        />
        <Typography variant="caption" color="text.secondary">
          {profile.experience} / {profile.level * 1000} XP
        </Typography>
      </Paper>

      {/* Skills */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="subtitle1">Skills</Typography>
          <Button startIcon={<AddIcon />} size="small">
            Add Skill
          </Button>
        </Stack>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {profile.skills.map((skill) => (
            <Chip
              key={skill}
              label={skill}
              variant="outlined"
              size="small"
            />
          ))}
        </Box>
      </Paper>

      {/* Badges */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Achievements
        </Typography>
        {profile.badges.map(renderBadge)}
      </Paper>
    </Box>
  );
} 