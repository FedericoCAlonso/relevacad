/**
 * View: Navigation Drawer (Material 3)
 * Panel lateral para resumen del proyecto, navegación rápida entre ambientes, puntos de ingreso, islas y métricas.
 */

import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
  IconButton,
  Card,
  CardContent,
  Stack,
  Button,
  Tooltip
} from '@mui/material';
import {
  Close as CloseIcon,
  MeetingRoom as RoomIcon,
  ElectricBolt as BoltIcon,
  SquareFoot as AreaIcon,
  Cable as CableIcon,
  RestartAlt as ResetIcon,
  PlaylistAddCheck as DemoIcon,
  DoorSliding as EntryIcon,
  ElectricMeter as IslandIcon,
  DeleteOutline as DeleteIcon
} from '@mui/icons-material';
import { useSurveyViewModel } from '@/viewmodels';
import { ROOM_TYPE_CATALOG } from '@/models/RoomModel';
import { AddMenuButton } from '../common/AddMenuButton';

interface NavigationDrawerProps {
  open: boolean;
  onClose: () => void;
  onOpenAddRoom: (defaultTab?: 'interior' | 'access' | 'technical') => void;
  onOpenAddElectricalNode?: () => void;
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  open,
  onClose,
  onOpenAddRoom,
  onOpenAddElectricalNode
}) => {
  const {
    rooms,
    selectedRoomId,
    selectRoom,
    deleteRoom,
    projectStats,
    loadSampleData,
    resetProject,
    setActivePhase
  } = useSurveyViewModel();

  const handleDeleteRoom = (roomId: string, roomName: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (window.confirm(`¿Eliminar el espacio "${roomName}"?`)) {
      deleteRoom(roomId);
    }
  };

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 350,
          borderTopRightRadius: 24,
          borderBottomRightRadius: 24,
          p: 2,
          bgcolor: '#fffbf7'
        }
      }}
    >
      {/* Header del Drawer */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              bgcolor: 'primary.light',
              color: 'primary.dark',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <BoltIcon />
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
              RelevaCAD — IEBA
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Relevamiento Topológico & Eléctrico
            </Typography>
          </Box>
        </Stack>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Resumen del Proyecto */}
      <Card sx={{ mb: 2.5, bgcolor: '#ffffff', border: '1px solid #e8e2d4' }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Typography variant="caption" fontWeight={600} color="text.secondary" textTransform="uppercase" letterSpacing={0.5}>
            Métricas de Obra
          </Typography>
          <Box display="grid" gridTemplateColumns="1fr 1fr" gap={1.5} mt={1}>
            <Box>
              <Typography variant="h6" color="primary.main" fontWeight={700}>
                {projectStats.totalInterior} <Typography component="span" variant="caption">({projectStats.totalIslands} islas)</Typography>
              </Typography>
              <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.5}>
                <RoomIcon sx={{ fontSize: 13 }} /> Locales Propios
              </Typography>
            </Box>
            <Box>
              <Typography variant="h6" color="primary.main" fontWeight={700}>
                {projectStats.totalElectricalNodes}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.5}>
                <BoltIcon sx={{ fontSize: 13 }} /> Nodos Eléctricos
              </Typography>
            </Box>
            <Box>
              <Typography variant="h6" color="secondary.main" fontWeight={700}>
                {projectStats.totalAreaM2} <Typography component="span" variant="caption">m²</Typography>
              </Typography>
              <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.5}>
                <AreaIcon sx={{ fontSize: 13 }} /> Sup. Útil
              </Typography>
            </Box>
            <Box>
              <Typography variant="h6" color="secondary.main" fontWeight={700}>
                {projectStats.totalMetrosCanalizacion} <Typography component="span" variant="caption">m</Typography>
              </Typography>
              <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.5}>
                <CableIcon sx={{ fontSize: 13 }} /> Cañería Total
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Lista de Ambientes, Ingresos e Islas Técnicas con Botón Único "+ Agregar" */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
        <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
          Espacios Relevados ({rooms.length})
        </Typography>
        <AddMenuButton
          onAddRoom={(tab) => {
            onClose();
            onOpenAddRoom(tab);
          }}
          onAddElectricalNode={() => {
            onClose();
            onOpenAddElectricalNode?.();
          }}
          label="Agregar"
          size="small"
          variant="outlined"
          sx={{ py: 0.2, px: 1, fontSize: '0.72rem' }}
        />
      </Box>

      <Box sx={{ flexGrow: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 390px)' }}>
        <List dense disablePadding>
          {rooms.map((room) => {
            const preset = ROOM_TYPE_CATALOG[room.type] || ROOM_TYPE_CATALOG.other;
            const isSelected = room.id === selectedRoomId;
            const isAccess = room.isAccessPoint || preset.isAccess;
            const isTechnical = room.isTechnicalIsland || preset.isTechnical;

            return (
              <ListItem
                key={room.id}
                disablePadding
                sx={{ mb: 0.5 }}
                secondaryAction={
                  <Tooltip title="Eliminar espacio">
                    <IconButton
                      edge="end"
                      size="small"
                      color="error"
                      onClick={(e) => handleDeleteRoom(room.id, room.name, e)}
                      sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                }
              >
                <ListItemButton
                  selected={isSelected}
                  onClick={() => {
                    selectRoom(room.id);
                    if (!isTechnical && !isAccess) setActivePhase('parametrization');
                    onClose();
                  }}
                  sx={{
                    borderRadius: 3,
                    pr: 5,
                    bgcolor: isSelected
                      ? 'primary.light'
                      : isTechnical
                      ? '#fffbeb'
                      : isAccess
                      ? '#f0fdf4'
                      : '#ffffff',
                    border: isSelected
                      ? '1.5px solid #00629e'
                      : isTechnical
                      ? '1px dashed #f59e0b'
                      : isAccess
                      ? '1px dashed #10b981'
                      : '1px solid #edf2f7',
                    '&.Mui-selected': {
                      bgcolor: '#e1f0ff'
                    }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    {isTechnical ? (
                      <IslandIcon fontSize="small" sx={{ color: '#d97706' }} />
                    ) : isAccess ? (
                      <EntryIcon fontSize="small" sx={{ color: '#059669' }} />
                    ) : (
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          bgcolor: preset.color === '#f5f5f5' ? '#78909c' : preset.color,
                          border: '1.5px solid #546e7a'
                        }}
                      />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={room.name}
                    secondary={
                      isTechnical
                        ? 'Isla Técnica de Suministro'
                        : isAccess
                        ? 'Punto de Ingreso / Límite'
                        : `${room.dimensions.width}m × ${room.dimensions.length}m`
                    }
                    primaryTypographyProps={{
                      variant: 'body2',
                      fontWeight: isSelected ? 700 : 500,
                      color: isTechnical ? '#92400e' : isAccess ? '#065f46' : 'text.primary'
                    }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                  <Chip
                    size="small"
                    label={
                      isTechnical
                        ? 'Isla'
                        : isAccess
                        ? 'Ingreso'
                        : `${(room.dimensions.width * room.dimensions.length).toFixed(1)} m²`
                    }
                    color={isTechnical ? 'warning' : isAccess ? 'success' : 'default'}
                    variant={isTechnical || isAccess ? 'filled' : 'outlined'}
                    sx={{
                      height: 20,
                      fontSize: '0.68rem',
                      fontWeight: isTechnical || isAccess ? 700 : 500,
                      mr: 1
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Acciones de Proyecto */}
      <Stack spacing={1}>
        <Button
          fullWidth
          variant="outlined"
          size="small"
          startIcon={<DemoIcon />}
          onClick={() => {
            loadSampleData();
            onClose();
          }}
        >
          Cargar Proyecto Demo Completo
        </Button>
        <Button
          fullWidth
          variant="text"
          color="error"
          size="small"
          startIcon={<ResetIcon />}
          onClick={() => {
            if (window.confirm('¿Reiniciar todo el relevamiento? Se perderán los datos actuales.')) {
              resetProject();
              onClose();
            }
          }}
        >
          Limpiar Todo
        </Button>
      </Stack>
    </Drawer>
  );
};
