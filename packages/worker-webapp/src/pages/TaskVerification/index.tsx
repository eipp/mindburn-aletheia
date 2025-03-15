import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Typography,
  Paper,
  TextField,
  Slider,
  Stack,
  LinearProgress,
  Alert,
  Card,
  CardContent,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Timer as TimerIcon,
  AttachFile as AttachIcon,
  Help as HelpIcon,
  Check as CheckIcon
} from '@mui/icons-material';

import { useStore } from '../../store';
import { BaseTask, TaskType, TaskStatus } from '@mindburn/shared/types';

interface VerificationStep {
  id: string;
  title: string;
  description: string;
  type: 'text' | 'choice' | 'rating' | 'evidence';
  options?: string[];
  required: boolean;
}

interface Evidence {
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  description?: string;
}

interface ExtendedTask extends BaseTask {
  title: string;
  description: string;
  reward: number;
  timeLimit: number;
  estimatedDuration: number;
  content: string;
  steps: VerificationStep[];
  guidelines: string;
  evidenceTypes: ('image' | 'video' | 'audio' | 'document')[];
  requiredSkills: string[];
}

interface VerificationData {
  taskId: string;
  responses: Record<string, any>;
  confidence: Record<string, number>;
  evidence: Record<string, Evidence[]>;
  timeSpent: number;
}

export default function TaskVerification() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { task, fetchTask, submitVerification, isLoading, error } = useStore<{
    task: ExtendedTask | null;
    fetchTask: (id: string) => Promise<void>;
    submitVerification: (data: VerificationData) => Promise<boolean>;
    isLoading: boolean;
    error: string | null;
  }>();

  const [activeStep, setActiveStep] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [confidence, setConfidence] = useState<Record<string, number>>({});
  const [evidence, setEvidence] = useState<Record<string, Evidence[]>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);

  useEffect(() => {
    if (taskId) {
      fetchTask(taskId);
    }
  }, [taskId, fetchTask]);

  useEffect(() => {
    if (task?.timeLimit) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev === null) return task.timeLimit * 60;
          if (prev <= 0) return 0;
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [task]);

  const handleNext = () => {
    if (activeStep === task!.steps.length - 1) {
      handleSubmit();
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    if (!task) return;

    const verificationData: VerificationData = {
      taskId: task.id,
      responses,
      confidence,
      evidence,
      timeSpent: task.timeLimit * 60 - (timeLeft || 0)
    };
    
    const success = await submitVerification(verificationData);
    if (success) {
      navigate('/tasks');
    }
  };

  const handleResponseChange = (stepId: string, value: any) => {
    setResponses((prev) => ({ ...prev, [stepId]: value }));
  };

  const handleConfidenceChange = (stepId: string, value: number) => {
    setConfidence((prev) => ({ ...prev, [stepId]: value }));
  };

  const handleEvidenceAdd = (stepId: string, evidence: Evidence) => {
    setEvidence((prev) => ({
      ...prev,
      [stepId]: [...(prev[stepId] || []), evidence]
    }));
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (isLoading || !task) {
    return <LinearProgress />;
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate('/tasks')}>
          <BackIcon />
        </IconButton>
        <Typography variant="h6">{task.title}</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <IconButton onClick={() => setHelpDialogOpen(true)}>
          <HelpIcon />
        </IconButton>
      </Stack>

      {/* Timer */}
      {timeLeft !== null && (
        <Paper sx={{ p: 1, mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <TimerIcon color={timeLeft < 300 ? "error" : "inherit"} />
            <Typography>
              Time Left: {formatTime(timeLeft)}
            </Typography>
          </Stack>
        </Paper>
      )}

      {/* Content Display */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Content to Verify
          </Typography>
          <Typography variant="body1">
            {task.content}
          </Typography>
        </CardContent>
      </Card>

      {/* Verification Steps */}
      <Stepper activeStep={activeStep} orientation="vertical">
        {task.steps.map((step, index) => (
          <Step key={step.id}>
            <StepLabel>
              <Typography variant="subtitle1">{step.title}</Typography>
            </StepLabel>
            <StepContent>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {step.description}
                </Typography>
                {step.type === 'text' && (
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    value={responses[step.id] || ''}
                    onChange={(e) => handleResponseChange(step.id, e.target.value)}
                    placeholder="Enter your response"
                  />
                )}
                {step.type === 'choice' && step.options && (
                  <Stack spacing={1}>
                    {step.options.map((option) => (
                      <Button
                        key={option}
                        variant={responses[step.id] === option ? "contained" : "outlined"}
                        onClick={() => handleResponseChange(step.id, option)}
                        fullWidth
                      >
                        {option}
                      </Button>
                    ))}
                  </Stack>
                )}
                {step.type === 'rating' && (
                  <Slider
                    value={responses[step.id] || 0}
                    onChange={(_, value) => handleResponseChange(step.id, value)}
                    step={1}
                    marks
                    min={0}
                    max={10}
                    valueLabelDisplay="auto"
                  />
                )}
                {step.type === 'evidence' && (
                  <Stack spacing={2}>
                    <input
                      type="file"
                      accept={task.evidenceTypes.map((type) => 
                        type === 'image' ? 'image/*' :
                        type === 'video' ? 'video/*' :
                        type === 'audio' ? 'audio/*' :
                        '.pdf,.doc,.docx'
                      ).join(',')}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // Handle file upload and get URL
                          handleEvidenceAdd(step.id, {
                            type: task.evidenceTypes[0],
                            url: URL.createObjectURL(file),
                            description: file.name
                          });
                        }
                      }}
                      style={{ display: 'none' }}
                      id={`evidence-upload-${step.id}`}
                    />
                    <Button
                      variant="outlined"
                      startIcon={<AttachIcon />}
                      onClick={() => document.getElementById(`evidence-upload-${step.id}`)?.click()}
                    >
                      Attach Evidence
                    </Button>
                    {evidence[step.id]?.map((item, i) => (
                      <Paper key={i} sx={{ p: 1 }}>
                        <Typography variant="body2">{item.description}</Typography>
                      </Paper>
                    ))}
                  </Stack>
                )}
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    Confidence Level
                  </Typography>
                  <Slider
                    value={confidence[step.id] || 50}
                    onChange={(_, value) => handleConfidenceChange(step.id, value as number)}
                    step={10}
                    marks
                    min={0}
                    max={100}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}%`}
                  />
                </Box>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleNext}
                  sx={{ mt: 1, mr: 1 }}
                  disabled={step.required && !responses[step.id]}
                >
                  {index === task.steps.length - 1 ? 'Submit' : 'Continue'}
                </Button>
                {index > 0 && (
                  <Button
                    onClick={handleBack}
                    sx={{ mt: 1, mr: 1 }}
                  >
                    Back
                  </Button>
                )}
              </Box>
            </StepContent>
          </Step>
        ))}
      </Stepper>

      {/* Help Dialog */}
      <Dialog
        open={helpDialogOpen}
        onClose={() => setHelpDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Guidelines</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            {task.guidelines}
          </Typography>
          <Typography variant="subtitle1" sx={{ mt: 2 }} gutterBottom>
            Required Skills
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {task.requiredSkills.map((skill) => (
              <Chip key={skill} label={skill} />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
} 