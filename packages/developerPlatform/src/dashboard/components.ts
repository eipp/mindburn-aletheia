/**
 * Dashboard Components
 * 
 * Reusable UI components for the developer dashboard
 */

import { FC, ReactNode } from 'react';
import { styled } from '@mui/material/styles';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Divider,
  Avatar,
  LinearProgress,
  Badge,
  CircularProgress,
  Button,
  ButtonProps,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material';
import { alpha } from '@mui/material/styles';

// Styled components
export const PageContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
  },
}));

export const PageHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: theme.spacing(4),
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    '& > *:not(:last-child)': {
      marginBottom: theme.spacing(2),
    },
  },
}));

export const PageTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  fontSize: '1.75rem',
  color: theme.palette.text.primary,
}));

export const SectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  fontSize: '1.25rem',
  marginBottom: theme.spacing(3),
  color: theme.palette.text.primary,
}));

export const GridContainer = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(12, 1fr)',
  gap: theme.spacing(3),
  [theme.breakpoints.down('md')]: {
    gap: theme.spacing(2),
  },
}));

export const DashboardCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'box-shadow 0.3s ease-in-out, transform 0.2s ease-in-out',
  '&:hover': {
    boxShadow: '0px 8px 24px -4px rgba(0, 0, 0, 0.12)',
    transform: 'translateY(-4px)',
  },
}));

export const StatsCard = styled(Card)(({ theme }) => ({
  height: '100%',
  padding: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  transition: 'box-shadow 0.3s ease-in-out',
  '&:hover': {
    boxShadow: '0px 8px 24px -4px rgba(0, 0, 0, 0.1)',
  },
}));

export const StatValue = styled(Typography)(({ theme }) => ({
  fontSize: '2rem',
  fontWeight: 600,
  marginTop: theme.spacing(1),
  marginBottom: theme.spacing(1),
  color: theme.palette.text.primary,
}));

export const StatLabel = styled(Typography)(({ theme }) => ({
  fontSize: '0.875rem',
  color: theme.palette.text.secondary,
  fontWeight: 500,
}));

export const TabContainer = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(3),
}));

// Data display components
interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  change?: {
    value: string | number;
    positive: boolean;
  };
  helperText?: string;
  color?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error';
}

export const MetricCard: FC<MetricCardProps> = ({
  title,
  value,
  icon,
  change,
  helperText,
  color = 'primary',
}) => {
  return (
    <StatsCard>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <StatLabel>{title}</StatLabel>
        {icon && (
          <Avatar
            sx={{
              backgroundColor: (theme) => alpha(theme.palette[color].main, 0.1),
              color: (theme) => theme.palette[color].main,
              width: 40,
              height: 40,
            }}
          >
            {icon}
          </Avatar>
        )}
      </Box>
      <StatValue>{value}</StatValue>
      {change && (
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
          <Typography
            variant="body2"
            sx={{
              color: (theme) => (change.positive ? theme.palette.success.main : theme.palette.error.main),
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {change.positive ? '↑' : '↓'} {change.value}
          </Typography>
          {helperText && (
            <Typography variant="body2" color="textSecondary" sx={{ ml: 1 }}>
              {helperText}
            </Typography>
          )}
        </Box>
      )}
      {!change && helperText && (
        <Typography variant="body2" color="textSecondary">
          {helperText}
        </Typography>
      )}
    </StatsCard>
  );
};

interface ProgressCardProps {
  title: string;
  value: number;
  max: number;
  formatValue?: (value: number, max: number) => string;
  color?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error';
  helperText?: string;
}

export const ProgressCard: FC<ProgressCardProps> = ({
  title,
  value,
  max,
  formatValue,
  color = 'primary',
  helperText,
}) => {
  const percentage = Math.min(Math.round((value / max) * 100), 100);
  const formattedValue = formatValue ? formatValue(value, max) : `${value} / ${max}`;

  return (
    <StatsCard>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <StatLabel>{title}</StatLabel>
        <Typography variant="body2" fontWeight={500}>
          {percentage}%
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={percentage}
        color={color}
        sx={{ height: 8, borderRadius: 4, mb: 2 }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body1" fontWeight={500}>
          {formattedValue}
        </Typography>
        {helperText && (
          <Typography variant="body2" color="textSecondary">
            {helperText}
          </Typography>
        )}
      </Box>
    </StatsCard>
  );
};

// Primary action button with loading state
export const ActionButton = styled(
  ({ loading, ...props }: ButtonProps & { loading?: boolean }) => (
    <Button
      {...props}
      disabled={props.disabled || loading}
      startIcon={loading ? <CircularProgress size={20} color="inherit" /> : props.startIcon}
    />
  )
)(({ theme }) => ({
  borderRadius: 8,
  padding: theme.spacing(1, 3),
  fontWeight: 500,
  boxShadow: 'none',
  '&:hover': {
    boxShadow: 'none',
  },
}));

// Empty state component for lists/tables
interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: FC<EmptyStateProps> = ({ title, description, icon, action }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        py: 8,
        px: 2,
      }}
    >
      {icon && <Box sx={{ mb: 3, color: 'text.secondary' }}>{icon}</Box>}
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="textSecondary" sx={{ mb: 3, maxWidth: 400 }}>
          {description}
        </Typography>
      )}
      {action && (
        <Button
          variant="contained"
          color="primary"
          onClick={action.onClick}
          sx={{ mt: description ? 0 : 3 }}
        >
          {action.label}
        </Button>
      )}
    </Box>
  );
};

// Status indicator component
interface StatusIndicatorProps {
  status: 'active' | 'inactive' | 'pending' | 'success' | 'error' | 'warning';
  size?: 'small' | 'medium';
  withLabel?: boolean;
}

export const StatusIndicator: FC<StatusIndicatorProps> = ({
  status,
  size = 'medium',
  withLabel = false,
}) => {
  const statusConfig = {
    active: { color: '#10B981', label: 'Active' },
    inactive: { color: '#6B7280', label: 'Inactive' },
    pending: { color: '#F59E0B', label: 'Pending' },
    success: { color: '#10B981', label: 'Success' },
    error: { color: '#EF4444', label: 'Error' },
    warning: { color: '#F59E0B', label: 'Warning' },
  };

  const dotSize = size === 'small' ? 8 : 10;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Box
        sx={{
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          backgroundColor: statusConfig[status].color,
          boxShadow: `0 0 0 2px ${alpha(statusConfig[status].color, 0.2)}`,
        }}
      />
      {withLabel && (
        <Typography
          variant="body2"
          sx={{ ml: 1, fontWeight: 500, color: (theme) => theme.palette.text.secondary }}
        >
          {statusConfig[status].label}
        </Typography>
      )}
    </Box>
  );
};

// Section divider with optional title
interface SectionDividerProps {
  title?: string;
}

export const SectionDivider: FC<SectionDividerProps> = ({ title }) => {
  if (!title) {
    return <Divider sx={{ my: 4 }} />;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', my: 4 }}>
      <Divider sx={{ flexGrow: 1 }} />
      <Typography
        variant="body2"
        sx={{
          px: 2,
          fontWeight: 500,
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {title}
      </Typography>
      <Divider sx={{ flexGrow: 1 }} />
    </Box>
  );
}; 