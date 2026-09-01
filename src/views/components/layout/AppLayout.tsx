/**
 * View: AppLayout (Material 3)
 * Estructura de cabecera (AppBar), selector de fases (Topología, Parametrización, Ensamblaje 2D)
 * y contenedor principal de la aplicación.
 */

import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Tabs,
  Tab,
  Chip,
  Tooltip,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  Menu as MenuIcon,
  Hub as TopologyIcon,
  Tune as ParamIcon,
  ViewQuilt as AssemblyIcon,
  AutoFixHigh as SnapIcon,
  CloudDone as PwaIcon
} from '@mui/icons-material';
import { useSurveyViewModel } from '@/viewmodels';
import { NavigationDrawer } from './NavigationDrawer';

interface AppLayoutProps {
  children: React.ReactNode;
  onOpenAddRoom: (defaultTab?: 'interior' | 'access' | 'technical') => void;
  onOpenAddElectricalNode?: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  onOpenAddRoom,
  onOpenAddElectricalNode
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const {
    activePhase,
    setActivePhase,
    isSnapEnabled,
    toggleSnap
  } = useSurveyViewModel();

  const handleTabChange = (_event: React.SyntheticEvent, newValue: string) => {
    setActivePhase(newValue as 'topology' | 'parametrization' | 'assembly');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Top App Bar - Material 3 */}
      <AppBar position="static" elevation={0} sx={{ borderBottom: '1px solid #e2e8f0', zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ minHeight: 64, px: { xs: 1.5, sm: 3 } }}>
          {/* Botón de Menú Drawer */}
          <IconButton
            edge="start"
            color="inherit"
            aria-label="menu"
            onClick={() => setDrawerOpen(true)}
            sx={{ mr: 1.5 }}
          >
            <MenuIcon />
          </IconButton>

          {/* Logotipo y Título de la PWA */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mr: 3 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 2,
                bgcolor: 'primary.main',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: 16
              }}
            >
              ⚡
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={700} lineHeight={1.1} noWrap>
                RelevaCAD
              </Typography>
              {!isMobile && (
                <Typography variant="caption" color="text.secondary">
                  Relevamiento Topológico & Eléctrico
                </Typography>
              )}
            </Box>
          </Box>

          {/* Navegación por Fases (3 Fases Core) */}
          <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
            <Tabs
              value={activePhase}
              onChange={handleTabChange}
              textColor="primary"
              indicatorColor="primary"
              variant={isMobile ? 'scrollable' : 'standard'}
              scrollButtons="auto"
              sx={{
                '& .MuiTabs-indicator': {
                  height: 3,
                  borderRadius: '3px 3px 0 0'
                }
              }}
            >
              <Tab
                value="topology"
                icon={<TopologyIcon fontSize="small" />}
                iconPosition="start"
                label="1. Topología"
              />
              <Tab
                value="parametrization"
                icon={<ParamIcon fontSize="small" />}
                iconPosition="start"
                label="2. Parametrización"
              />
              <Tab
                value="assembly"
                icon={<AssemblyIcon fontSize="small" />}
                iconPosition="start"
                label="3. Ensamblaje 2D"
              />
            </Tabs>
          </Box>

          {/* Acciones de Cabecera */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            {/* Toggle de Snapping Magnético */}
            {activePhase === 'assembly' && (
              <Tooltip title={isSnapEnabled ? 'Atracción Magnética (~15px) Activa' : 'Atracción Magnética Desactivada'}>
                <Chip
                  icon={<SnapIcon fontSize="small" />}
                  label={isMobile ? 'Snap' : isSnapEnabled ? 'Snap: ON' : 'Snap: OFF'}
                  color={isSnapEnabled ? 'primary' : 'default'}
                  onClick={() => toggleSnap()}
                  clickable
                  variant={isSnapEnabled ? 'filled' : 'outlined'}
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              </Tooltip>
            )}

            {/* PWA Offline Ready Badge */}
            {!isMobile && (
              <Tooltip title="PWA con soporte offline y almacenamiento local">
                <Chip
                  icon={<PwaIcon fontSize="small" />}
                  label="Offline Ready"
                  color="success"
                  variant="outlined"
                  size="small"
                  sx={{ bgcolor: '#f0fdf4', borderColor: '#bbf7d0' }}
                />
              </Tooltip>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Drawer Lateral */}
      <NavigationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onOpenAddRoom={onOpenAddRoom}
        onOpenAddElectricalNode={onOpenAddElectricalNode}
      />

      {/* Contenedor Principal de la Vista Activa */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          height: 'calc(100vh - 64px)',
          overflow: 'hidden',
          position: 'relative',
          bgcolor: 'background.default'
        }}
      >
        {children}
      </Box>
    </Box>
  );
};
