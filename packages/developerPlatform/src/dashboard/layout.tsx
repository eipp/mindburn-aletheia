/**
 * Dashboard Layout
 * 
 * Main layout components for the developer dashboard
 */

import { FC, ReactNode, useState } from 'react';
import { styled, Theme, CSSObject } from '@mui/material/styles';
import {
  Box,
  Drawer as MuiDrawer,
  AppBar as MuiAppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Avatar,
  Menu,
  MenuItem,
  Badge,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  AppBarProps as MuiAppBarProps,
} from '@mui/material/AppBar';

// Sidebar width configuration
const drawerWidth = 260;

// Styled components for the layout
const openedMixin = (theme: Theme): CSSObject => ({
  width: drawerWidth,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
});

const closedMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  width: `calc(${theme.spacing(7)} + 1px)`,
  [theme.breakpoints.up('sm')]: {
    width: `calc(${theme.spacing(8)} + 1px)`,
  },
});

interface AppBarProps extends MuiAppBarProps {
  open?: boolean;
}

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})<AppBarProps>(({ theme, open }) => ({
  zIndex: theme.zIndex.drawer + 1,
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

const Drawer = styled(MuiDrawer, {
  shouldForwardProp: (prop) => prop !== 'open',
})(({ theme, open }) => ({
  width: drawerWidth,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  ...(open && {
    ...openedMixin(theme),
    '& .MuiDrawer-paper': openedMixin(theme),
  }),
  ...(!open && {
    ...closedMixin(theme),
    '& .MuiDrawer-paper': closedMixin(theme),
  }),
}));

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
}));

const ContentWrapper = styled('main')(({ theme }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  height: '100vh',
  overflow: 'auto',
  paddingTop: 64 + theme.spacing(3), // AppBar height + padding
}));

// Main layout component
interface DashboardLayoutProps {
  children: ReactNode;
  menu: {
    icon: ReactNode;
    title: string;
    path: string;
    badge?: number;
  }[];
  activePath: string;
  onMenuClick: (path: string) => void;
  user?: {
    name: string;
    email: string;
    avatarUrl?: string;
  };
  onLogout: () => void;
  notifications?: {
    count: number;
    onClick: () => void;
  };
  title: string;
  logo: ReactNode;
  rightContent?: ReactNode;
}

export const DashboardLayout: FC<DashboardLayoutProps> = ({
  children,
  menu,
  activePath,
  onMenuClick,
  user,
  onLogout,
  notifications,
  title,
  logo,
  rightContent,
}) => {
  const [open, setOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const userMenuOpen = Boolean(anchorEl);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Auto-close sidebar on mobile
  if (isMobile && open) {
    setOpen(false);
  }

  const handleDrawerToggle = () => {
    setOpen(!open);
  };

  const handleUserMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleUserMenuClose();
    onLogout();
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" open={open} elevation={1} color="default">
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            aria-label="toggle drawer"
            onClick={handleDrawerToggle}
            sx={{ marginRight: 2 }}
          >
            {open ? '←' : '→'}
          </IconButton>

          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {title}
          </Typography>

          {rightContent}

          {notifications && (
            <IconButton 
              color="inherit" 
              onClick={notifications.onClick}
              sx={{ marginLeft: 1 }}
            >
              <Badge badgeContent={notifications.count} color="error">
                🔔
              </Badge>
            </IconButton>
          )}

          {user && (
            <>
              <Tooltip title={user.name || user.email}>
                <IconButton
                  onClick={handleUserMenuClick}
                  size="small"
                  sx={{ ml: 2 }}
                  aria-controls={userMenuOpen ? 'account-menu' : undefined}
                  aria-haspopup="true"
                  aria-expanded={userMenuOpen ? 'true' : undefined}
                >
                  <Avatar alt={user.name} src={user.avatarUrl}>
                    {!user.avatarUrl && user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </Avatar>
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={anchorEl}
                id="account-menu"
                open={userMenuOpen}
                onClose={handleUserMenuClose}
                PaperProps={{
                  elevation: 0,
                  sx: {
                    overflow: 'visible',
                    filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.15))',
                    mt: 1.5,
                    minWidth: 200,
                    '& .MuiAvatar-root': {
                      width: 32,
                      height: 32,
                      ml: -0.5,
                      mr: 1,
                    },
                  },
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              >
                <MenuItem sx={{ pointerEvents: 'none' }}>
                  <Typography variant="body2">{user.email}</Typography>
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleUserMenuClose}>Profile</MenuItem>
                <MenuItem onClick={handleUserMenuClose}>Settings</MenuItem>
                <MenuItem onClick={handleLogout}>Logout</MenuItem>
              </Menu>
            </>
          )}
        </Toolbar>
      </AppBar>

      <Drawer variant="permanent" open={open}>
        <DrawerHeader>
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              width: '100%',
              justifyContent: open ? 'flex-start' : 'center',
              p: 2
            }}
          >
            {logo}
          </Box>
        </DrawerHeader>
        
        <Divider />
        
        <List>
          {menu.map((item) => (
            <ListItem 
              key={item.path} 
              disablePadding 
              sx={{ display: 'block' }}
            >
              <ListItemButton
                sx={{
                  minHeight: 48,
                  justifyContent: open ? 'initial' : 'center',
                  px: 2.5,
                  backgroundColor: 
                    activePath === item.path ? 
                    (theme) => theme.palette.action.selected : 
                    'transparent',
                }}
                onClick={() => onMenuClick(item.path)}
              >
                <Tooltip title={open ? '' : item.title} placement="right">
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: open ? 3 : 'auto',
                      justifyContent: 'center',
                    }}
                  >
                    {item.badge ? (
                      <Badge badgeContent={item.badge} color="error">
                        {item.icon}
                      </Badge>
                    ) : (
                      item.icon
                    )}
                  </ListItemIcon>
                </Tooltip>
                <ListItemText 
                  primary={item.title} 
                  sx={{ 
                    opacity: open ? 1 : 0,
                    '& .MuiTypography-root': {
                      fontWeight: activePath === item.path ? 600 : 400
                    }
                  }} 
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>

      <ContentWrapper>
        {children}
      </ContentWrapper>
    </Box>
  );
}; 