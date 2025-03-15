import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  LinearProgress,
  Alert,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton
} from '@mui/material';
import {
  School as TrainingIcon,
  Lock as LockIcon,
  CheckCircle as CompletedIcon,
  PlayArrow as StartIcon,
  Star as RewardIcon,
  Timer as DurationIcon,
  ArrowForward as NextIcon,
  Close as CloseIcon
} from '@mui/icons-material';

import { useStore } from '../../store';
import { TrainingModule, TrainingProgress } from '../../types';
import { api } from '../../services/api';

export default function Training() {
  const { profile, fetchProfile } = useStore();
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [progress, setProgress] = useState<TrainingProgress | null>(null);
  const [selectedModule, setSelectedModule] = useState<TrainingModule | null>(null);
  const [currentContentIndex, setCurrentContentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTrainingData();
  }, []);

  const loadTrainingData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [modulesData, progressData] = await Promise.all([
        api.training.getModules(),
        api.training.getProgress()
      ]);
      setModules(modulesData);
      setProgress(progressData);
    } catch (error) {
      setError('Failed to load training data');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartModule = (module: TrainingModule) => {
    setSelectedModule(module);
    setCurrentContentIndex(0);
  };

  const handleNextContent = async () => {
    if (!selectedModule) return;

    const nextIndex = currentContentIndex + 1;
    if (nextIndex < selectedModule.content.length) {
      setCurrentContentIndex(nextIndex);
    } else {
      try {
        await api.training.completeModule(selectedModule.id);
        await Promise.all([loadTrainingData(), fetchProfile()]);
        setSelectedModule(null);
        setCurrentContentIndex(0);
      } catch (error) {
        setError('Failed to complete module');
        console.error(error);
      }
    }
  };

  const getModuleStatus = (module: TrainingModule) => {
    if (progress?.completedModules.includes(module.id)) {
      return 'completed';
    }
    if (module.status === 'locked') {
      return 'locked';
    }
    return 'available';
  };

  const renderModuleContent = () => {
    if (!selectedModule) return null;

    const content = selectedModule.content[currentContentIndex];
    const isLastContent = currentContentIndex === selectedModule.content.length - 1;

    return (
      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6">{selectedModule.title}</Typography>
          <IconButton onClick={() => setSelectedModule(null)}>
            <CloseIcon />
          </IconButton>
        </Stack>

        <LinearProgress
          variant="determinate"
          value={(currentContentIndex + 1) / selectedModule.content.length * 100}
          sx={{ mb: 2 }}
        />

        <Paper sx={{ p: 2, mb: 2 }}>
          {content.type === 'video' && (
            <Box sx={{ position: 'relative', paddingTop: '56.25%' }}>
              <iframe
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                src={content.data.url}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </Box>
          )}

          {content.type === 'text' && (
            <Typography variant="body1">
              {content.data.text}
            </Typography>
          )}

          {content.type === 'quiz' && (
            <Stack spacing={2}>
              <Typography variant="subtitle1">{content.data.question}</Typography>
              {content.data.options.map((option: string, index: number) => (
                <Button
                  key={index}
                  variant="outlined"
                  fullWidth
                  onClick={() => {/* Handle quiz answer */}}
                >
                  {option}
                </Button>
              ))}
            </Stack>
          )}
        </Paper>

        <Button
          variant="contained"
          endIcon={isLastContent ? <CompletedIcon /> : <NextIcon />}
          onClick={handleNextContent}
          fullWidth
        >
          {isLastContent ? 'Complete Module' : 'Next'}
        </Button>
      </Box>
    );
  };

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

  if (selectedModule) {
    return (
      <Box sx={{ p: 2 }}>
        {renderModuleContent()}
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {/* Progress Overview */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <TrainingIcon color="primary" />
            <Typography variant="h6">Training Progress</Typography>
          </Stack>

          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Box textAlign="center">
                <Typography variant="h4">
                  {progress?.completedModules.length || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Completed Modules
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box textAlign="center">
                <Typography variant="h4">
                  {Object.keys(progress?.skillLevels || {}).length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Skills Learned
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box textAlign="center">
                <Typography variant="h4">
                  {progress?.earnedRewards || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  TON Earned
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Stack>
      </Paper>

      {/* Module List */}
      <Grid container spacing={2}>
        {modules.map((module) => {
          const status = getModuleStatus(module);
          return (
            <Grid item xs={12} sm={6} key={module.id}>
              <Card>
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="h6" component="div">
                      {module.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {module.description}
                    </Typography>

                    <Stack direction="row" spacing={1}>
                      <Chip
                        icon={<DurationIcon />}
                        label={`${module.duration} min`}
                        size="small"
                      />
                      <Chip
                        icon={<RewardIcon />}
                        label={`${module.reward} TON`}
                        size="small"
                      />
                    </Stack>

                    {module.skills.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {module.skills.map((skill) => (
                          <Chip
                            key={skill}
                            label={skill}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    )}
                  </Stack>
                </CardContent>
                <CardActions>
                  {status === 'completed' ? (
                    <Button
                      startIcon={<CompletedIcon />}
                      disabled
                      fullWidth
                    >
                      Completed
                    </Button>
                  ) : status === 'locked' ? (
                    <Button
                      startIcon={<LockIcon />}
                      disabled
                      fullWidth
                    >
                      Locked
                    </Button>
                  ) : (
                    <Button
                      startIcon={<StartIcon />}
                      variant="contained"
                      onClick={() => handleStartModule(module)}
                      fullWidth
                    >
                      Start Module
                    </Button>
                  )}
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
} 