import React, { useState, useEffect } from 'react';
import { Task, TaskSubmission as TaskSubmissionType } from '../types';
import { TaskType, ContentType } from '../types/enums';
import { useSubmitTaskMutation } from '../store/api/apiSlice';
import {
  Box,
  Title,
  Text,
  Paper,
  Button,
  Group,
  Stack,
  Textarea,
  Radio,
  RadioGroup,
  Divider,
  Image,
  Badge,
  Alert,
  Progress,
  Slider,
  ActionIcon,
  Modal,
  LoadingOverlay,
  Center
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { 
  IconAlertCircle, 
  IconCheck, 
  IconX, 
  IconArrowLeft,
  IconClock
} from '@tabler/icons-react';
import { useWalletStore } from '../store/wallet';

interface TaskSubmissionProps {
  task: Task;
  onSubmit: (result: { success: boolean; message?: string }) => void;
  onCancel: () => void;
}

export const TaskSubmission: React.FC<TaskSubmissionProps> = ({ 
  task, 
  onSubmit, 
  onCancel 
}) => {
  const [answer, setAnswer] = useState<string>('');
  const [textAnswer, setTextAnswer] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(1.0);
  const [startTime] = useState<number>(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [confirmOpened, { open: openConfirm, close: closeConfirm }] = useDisclosure(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(task.timeLimit ? task.timeLimit : null);
  
  // Redux hook for task submission
  const [submitTask, { isLoading: isSubmitting }] = useSubmitTaskMutation();
  
  // Get wallet connection status
  const { connected: walletConnected } = useWalletStore();

  // Set up timer for the task
  useEffect(() => {
    // Check if task has a time limit
    if (task.timeLimit) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = task.timeLimit - elapsed;
        
        if (remaining <= 0) {
          clearInterval(interval);
          setTimeLeft(0);
          setError('Time limit reached. Your submission will be automatically sent.');
          
          // Auto-submit after 5 seconds
          setTimeout(() => {
            if (answer || textAnswer) {
              handleSubmit();
            } else {
              onCancel();
            }
          }, 5000);
        } else {
          setTimeLeft(remaining);
        }
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [task, startTime]);

  const handleSubmit = async () => {
    if ((!answer && !textAnswer) || isSubmitting) {
      return;
    }
    
    closeConfirm();
    setError(null);

    try {
      const timeSpent = (Date.now() - startTime) / 1000; // Convert to seconds
      
      const submission: TaskSubmissionType = {
        taskId: task.id,
        answer: textAnswer || answer,
        confidence: confidence,
        timeSpent: timeSpent,
        submittedAt: new Date().toISOString(),
        metadata: {
          deviceInfo: {
            platform: 'telegram-miniapp',
            userAgent: navigator.userAgent,
          },
        }
      };

      const result = await submitTask(submission).unwrap();
      onSubmit(result);
    } catch (err) {
      setError('Failed to submit task. Please try again.');
      onSubmit({ success: false, message: 'Submission failed' });
    }
  };

  const renderSubmissionForm = () => {
    switch (task.type) {
      case TaskType.CONTENT_MODERATION:
        return renderContentModerationForm();
      case TaskType.FACT_CHECK:
        return renderFactCheckForm();
      case TaskType.TOXICITY:
        return renderToxicityForm();
      case TaskType.SENTIMENT:
        return renderSentimentForm();
      case TaskType.CUSTOM:
        return renderCustomForm();
      default:
        return renderGenericForm();
    }
  };

  const renderContentModerationForm = () => {
    const options = [
      { value: 'safe', label: '✅ Safe', color: 'green' },
      { value: 'nsfw', label: '⚠️ NSFW', color: 'yellow' },
      { value: 'adult', label: '🔞 Adult', color: 'orange' },
      { value: 'violence', label: '⚔️ Violence', color: 'red' },
      { value: 'hate', label: '👿 Hate', color: 'red' },
      { value: 'unsafe', label: '🚫 Unsafe', color: 'red' },
    ];

    return (
      <Box>
        <Title order={3} mb="md">Content Moderation</Title>
        <Text mb="lg">Please review the content and select the appropriate classification:</Text>
        
        {task.contentUrl && renderContent()}
        
        <RadioGroup
          value={answer}
          onChange={setAnswer}
          orientation="vertical"
          spacing="md"
          mt="xl"
        >
          {options.map(option => (
            <Radio 
              key={option.value} 
              value={option.value} 
              label={
                <Group>
                  <Text>{option.label}</Text>
                  <Badge color={option.color}>{option.value}</Badge>
                </Group>
              }
              size="md"
            />
          ))}
        </RadioGroup>
      </Box>
    );
  };

  const renderFactCheckForm = () => {
    const options = [
      { value: 'true', label: '✅ True', color: 'green' },
      { value: 'false', label: '❌ False', color: 'red' },
      { value: 'misleading', label: '⚠️ Misleading', color: 'yellow' },
      { value: 'unverifiable', label: '❓ Unverifiable', color: 'gray' },
    ];

    return (
      <Box>
        <Title order={3} mb="md">Fact Check</Title>
        <Text mb="md">Please verify the following claim:</Text>
        
        <Paper p="md" withBorder mb="xl">
          <Text fw={500}>{task.content || task.description}</Text>
        </Paper>
        
        <RadioGroup
          value={answer}
          onChange={setAnswer}
          orientation="vertical"
          spacing="md"
          mb="xl"
        >
          {options.map(option => (
            <Radio 
              key={option.value} 
              value={option.value} 
              label={
                <Group>
                  <Text>{option.label}</Text>
                  <Badge color={option.color}>{option.value}</Badge>
                </Group>
              }
              size="md"
            />
          ))}
        </RadioGroup>
        
        <Box mt="xl">
          <Text fw={500} mb="xs">Provide Evidence (Optional)</Text>
          <Textarea
            placeholder="Enter evidence or explanation for your answer..."
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            minRows={4}
            autosize
          />
        </Box>
      </Box>
    );
  };

  const renderToxicityForm = () => {
    const options = [
      { value: 'not_toxic', label: '✅ Not Toxic', color: 'green' },
      { value: 'mildly_toxic', label: '⚠️ Mildly Toxic', color: 'yellow' },
      { value: 'toxic', label: '🚫 Toxic', color: 'orange' },
      { value: 'severely_toxic', label: '⛔ Severely Toxic', color: 'red' },
      { value: 'hate_speech', label: '👿 Hate Speech', color: 'red' },
    ];

    return (
      <Box>
        <Title order={3} mb="md">Toxicity Detection</Title>
        <Text mb="md">Please evaluate the following content for toxicity:</Text>
        
        <Paper p="md" withBorder mb="xl">
          <Text>{task.content || task.description}</Text>
        </Paper>
        
        <RadioGroup
          value={answer}
          onChange={setAnswer}
          orientation="vertical"
          spacing="md"
        >
          {options.map(option => (
            <Radio 
              key={option.value} 
              value={option.value} 
              label={
                <Group>
                  <Text>{option.label}</Text>
                  <Badge color={option.color}>{option.value}</Badge>
                </Group>
              }
              size="md"
            />
          ))}
        </RadioGroup>
      </Box>
    );
  };

  const renderSentimentForm = () => {
    const options = [
      { value: 'very_positive', label: '😄 Very Positive', color: 'green' },
      { value: 'positive', label: '🙂 Positive', color: 'teal' },
      { value: 'neutral', label: '😐 Neutral', color: 'gray' },
      { value: 'negative', label: '🙁 Negative', color: 'orange' },
      { value: 'very_negative', label: '😠 Very Negative', color: 'red' },
    ];

    return (
      <Box>
        <Title order={3} mb="md">Sentiment Analysis</Title>
        <Text mb="md">Please identify the sentiment of the following content:</Text>
        
        <Paper p="md" withBorder mb="xl">
          <Text>{task.content || task.description}</Text>
        </Paper>
        
        <RadioGroup
          value={answer}
          onChange={setAnswer}
          orientation="vertical"
          spacing="md"
        >
          {options.map(option => (
            <Radio 
              key={option.value} 
              value={option.value} 
              label={
                <Group>
                  <Text>{option.label}</Text>
                  <Badge color={option.color}>{option.value}</Badge>
                </Group>
              }
              size="md"
            />
          ))}
        </RadioGroup>
      </Box>
    );
  };

  const renderCustomForm = () => {
    return (
      <Box>
        <Title order={3} mb="md">{task.title || 'Custom Task'}</Title>
        <Text mb="lg">{task.description || 'Please complete this custom task.'}</Text>
        
        {task.contentUrl && renderContent()}
        
        {task.options && task.options.length > 0 ? (
          <RadioGroup
            value={answer}
            onChange={setAnswer}
            orientation="vertical"
            spacing="md"
            mt="xl"
          >
            {task.options.map(option => (
              <Radio 
                key={option} 
                value={option} 
                label={option}
                size="md"
              />
            ))}
          </RadioGroup>
        ) : (
          <Box mt="xl">
            <Text fw={500} mb="xs">Your Answer</Text>
            <Textarea
              placeholder="Enter your answer here..."
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              minRows={4}
              autosize
            />
          </Box>
        )}
      </Box>
    );
  };

  const renderGenericForm = () => {
    return (
      <Box>
        <Title order={3} mb="md">{task.title || 'Task'}</Title>
        <Text mb="lg">{task.description || 'Please complete this task.'}</Text>
        
        {task.contentUrl && renderContent()}
        
        <Box mt="xl">
          <Text fw={500} mb="xs">Your Answer</Text>
          <Textarea
            placeholder="Enter your answer here..."
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            minRows={4}
            autosize
          />
        </Box>
      </Box>
    );
  };

  const renderContent = () => {
    if (!task.contentUrl) return null;
    
    switch (task.contentType) {
      case ContentType.IMAGE:
        return (
          <Box my="md">
            <Image
              src={task.contentUrl}
              alt="Task content"
              radius="md"
              withPlaceholder
              caption="Review this image"
            />
          </Box>
        );
      case ContentType.VIDEO:
        return (
          <Box my="md">
            <video 
              src={task.contentUrl} 
              controls 
              style={{ width: '100%', borderRadius: '8px' }}
            />
            <Text size="sm" mt="xs" color="dimmed">Review this video</Text>
          </Box>
        );
      case ContentType.AUDIO:
        return (
          <Box my="md">
            <audio 
              src={task.contentUrl} 
              controls 
              style={{ width: '100%' }}
            />
            <Text size="sm" mt="xs" color="dimmed">Review this audio</Text>
          </Box>
        );
      default:
        return null;
    }
  };

  const renderConfidenceSlider = () => {
    const confidenceLabels = [
      { value: 0.2, label: 'Very uncertain' },
      { value: 0.4, label: 'Somewhat uncertain' },
      { value: 0.6, label: 'Somewhat confident' },
      { value: 0.8, label: 'Confident' },
      { value: 1.0, label: 'Very confident' },
    ];
    
    return (
      <Box mt="xl">
        <Text fw={500} mb="md">How confident are you in your answer?</Text>
        <Slider
          value={confidence}
          onChange={setConfidence}
          min={0.2}
          max={1.0}
          step={0.1}
          label={(value) => `${Math.round(value * 100)}%`}
          marks={confidenceLabels.map(l => ({ value: l.value, label: l.label }))}
          size="md"
        />
      </Box>
    );
  };

  return (
    <Box pos="relative">
      <LoadingOverlay visible={isSubmitting} />
      
      {/* Timer */}
      {timeLeft !== null && (
        <Box mb="md">
          <Group spacing="xs" mb="xs">
            <IconClock size={16} />
            <Text size="sm">Time remaining: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</Text>
          </Group>
          <Progress 
            value={(timeLeft / task.timeLimit) * 100} 
            size="sm"
            color={timeLeft < task.timeLimit * 0.2 ? "red" : timeLeft < task.timeLimit * 0.5 ? "yellow" : "teal"} 
          />
        </Box>
      )}
      
      {error && (
        <Alert 
          icon={<IconAlertCircle size={16} />} 
          title="Error" 
          color="red" 
          mb="md"
          withCloseButton
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}
      
      <Paper p="lg" withBorder>
        {renderSubmissionForm()}
        
        {renderConfidenceSlider()}
        
        <Group position="apart" mt="xl" pt="md">
          <Button 
            onClick={onCancel} 
            variant="subtle" 
            leftIcon={<IconArrowLeft size={16} />}
          >
            Cancel
          </Button>
          
          <Button 
            onClick={openConfirm}
            disabled={!answer && !textAnswer}
            loading={isSubmitting}
            color="green"
            leftIcon={<IconCheck size={16} />}
          >
            Submit Answer
          </Button>
        </Group>
      </Paper>
      
      {/* Confirmation Modal */}
      <Modal
        opened={confirmOpened}
        onClose={closeConfirm}
        title="Confirm Submission"
        centered
      >
        <Text size="sm" mb="md">
          Are you sure you want to submit your answer? You cannot change it after submission.
        </Text>
        
        {!walletConnected && (
          <Alert 
            icon={<IconAlertCircle size={16} />} 
            title="Wallet not connected" 
            color="yellow" 
            mb="md"
          >
            Connect your TON wallet to receive payment for your tasks.
          </Alert>
        )}
        
        <Group position="right" mt="xl">
          <Button variant="outline" onClick={closeConfirm} leftIcon={<IconX size={16} />}>
            Cancel
          </Button>
          <Button color="green" onClick={handleSubmit} leftIcon={<IconCheck size={16} />}>
            Confirm Submission
          </Button>
        </Group>
      </Modal>
    </Box>
  );
}; 