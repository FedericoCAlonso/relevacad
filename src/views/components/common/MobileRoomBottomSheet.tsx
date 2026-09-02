/**
 * View Component: MobileRoomBottomSheet
 * Panel inferior deslizante táctil optimizado para smartphone/tablet en relevamiento de campo:
 * - Botones táctiles grandes de incremento/decremento (+/- 0.10m) para cotas con 1 pulgar
 * - Selector rápido de cubierta
 * - Botón de acceso directo a la Parametrización Eléctrica
 * - Resumen métrico y de bocas instaladas
 */

import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Paper,
  Divider
} from '@mui/material';
import {
  Close as CloseIcon,
  Tune as ParamIcon,
  Delete as DeleteIcon,
  BorderLeft as BoundaryIcon
} from '@mui/icons-material';
import { useSurveyViewModel } from '@/viewmodels';
import {
  ROOM_TYPE_CATALOG,
  TIPO_CUBIERTA_CATALOG,
  TipoCubierta,
  isMetricRoom,
  isParcelBoundaryNode
} from '@/models/RoomModel';

interface MobileRoomBottomSheetProps {
  open: boolean;
  onClose: () => void;
}

const ROOM_TYPE_EMOJIS: Record<string, string> = {
  living: '🛋️',
  kitchen: '🍳',
  bedroom: '🛏️',
  bathroom: '🚿',
  hallway: '🚪',
  technical_room: '⚡',
  laundry: '🧺',
  garage: '🚗',
  balcony: '🪴',
  garden: '🌳',
  generic_interior: '🏠',
  access_main: '🚪',
  access_palier: '🏢',
  access_garage: '🚗',
  access_service: '🔑',
  access_secondary: '🚪',
  technical_island_ground: '⚡',
  limit_front: '🛣️',
  limit_back: '🌿',
  limit_medianera_left: '🧱',
  limit_medianera_right: '🧱',
  limit_patio: '☀️'
};

export const MobileRoomBottomSheet: React.FC<MobileRoomBottomSheetProps> = ({
  open,
  onClose
}) => {
  const {
    selectedRoom,
    deleteRoom,
    updateRoomDimensions,
    updateRoomCubierta,
    setActivePhase
  } = useSurveyViewModel();

  if (!selectedRoom) return null;

  const isMetric = isMetricRoom(selectedRoom);
  const isBoundary = isParcelBoundaryNode(selectedRoom);
  const preset = ROOM_TYPE_CATALOG[selectedRoom.type] || ROOM_TYPE_CATALOG.other;

  const handleStepDimension = (dim: 'width' | 'length', delta: number) => {
    const current = selectedRoom.dimensions[dim];
    const updated = Math.max(0.5, Number((current + delta).toFixed(2)));
    updateRoomDimensions(selectedRoom.id, { [dim]: updated });
  };

  const handleCubiertaChange = (
    _: React.MouseEvent<HTMLElement>,
    newCubierta: TipoCubierta | null
  ) => {
    if (newCubierta) {
      updateRoomCubierta(selectedRoom.id, newCubierta);
    }
  };

  const handleDelete = () => {
    deleteRoom(selectedRoom.id);
    onClose();
  };

  const handleOpenParam = () => {
    setActivePhase('architecture');
    onClose();
  };

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          p: 2,
          pb: 3,
          maxHeight: '80vh',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.15)'
        }
      }}
    >
      {/* Indicador de arrastre táctil (Handle Bar) */}
      <Box sx={{ width: 36, height: 4, bgcolor: '#cbd5e1', borderRadius: 2, mx: 'auto', mb: 1.5 }} />

      {/* Cabecera del Ambiente */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2.5,
              bgcolor: isBoundary ? '#f1f5f9' : preset.color || '#e0f2fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem'
            }}
          >
            {isBoundary ? <BoundaryIcon fontSize="small" sx={{ color: '#475569' }} /> : ROOM_TYPE_EMOJIS[selectedRoom.type] || '🏠'}
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
              {selectedRoom.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {isBoundary
                ? 'Límite Perimetral / Medianera'
                : `${selectedRoom.dimensions.width}m × ${selectedRoom.dimensions.length}m • ${selectedRoom.electricalAssets.length} bocas`}
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={0.5}>
          <IconButton size="small" color="error" onClick={handleDelete}>
            <DeleteIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Controles Táctiles de Cotas (+/- 10cm) para Ambientes Métricos */}
      {isMetric && (
        <Stack spacing={2} sx={{ mb: 2 }}>
          {/* Stepper Ancho (X) */}
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="body2" fontWeight={600} color="text.secondary">
              Ancho (X):
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant="outlined"
                size="small"
                onClick={() => handleStepDimension('width', -0.1)}
                sx={{ minWidth: 40, height: 38, borderRadius: 2, fontWeight: 700 }}
              >
                -0.10
              </Button>
              <Paper
                variant="outlined"
                sx={{
                  px: 2,
                  py: 0.8,
                  borderRadius: 2,
                  minWidth: 80,
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: '0.95rem'
                }}
              >
                {selectedRoom.dimensions.width.toFixed(2)} m
              </Paper>
              <Button
                variant="outlined"
                size="small"
                onClick={() => handleStepDimension('width', 0.1)}
                sx={{ minWidth: 40, height: 38, borderRadius: 2, fontWeight: 700 }}
              >
                +0.10
              </Button>
            </Stack>
          </Box>

          {/* Stepper Largo (Y) */}
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="body2" fontWeight={600} color="text.secondary">
              Largo (Y):
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant="outlined"
                size="small"
                onClick={() => handleStepDimension('length', -0.1)}
                sx={{ minWidth: 40, height: 38, borderRadius: 2, fontWeight: 700 }}
              >
                -0.10
              </Button>
              <Paper
                variant="outlined"
                sx={{
                  px: 2,
                  py: 0.8,
                  borderRadius: 2,
                  minWidth: 80,
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: '0.95rem'
                }}
              >
                {selectedRoom.dimensions.length.toFixed(2)} m
              </Paper>
              <Button
                variant="outlined"
                size="small"
                onClick={() => handleStepDimension('length', 0.1)}
                sx={{ minWidth: 40, height: 38, borderRadius: 2, fontWeight: 700 }}
              >
                +0.10
              </Button>
            </Stack>
          </Box>

          {/* Selector de Cubierta en Móvil */}
          <Box>
            <Typography variant="caption" fontWeight={600} color="text.secondary" gutterBottom display="block">
              Tipo de Cubierta
            </Typography>
            <ToggleButtonGroup
              value={selectedRoom.tipoCubierta || 'cubierto'}
              exclusive
              onChange={handleCubiertaChange}
              fullWidth
              size="small"
            >
              {Object.values(TIPO_CUBIERTA_CATALOG).map((cub) => (
                <ToggleButton
                  key={cub.tipo}
                  value={cub.tipo}
                  sx={{ textTransform: 'none', fontSize: '0.73rem', py: 0.6 }}
                >
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <span>{cub.emoji}</span>
                    <span>{cub.label}</span>
                  </Stack>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        </Stack>
      )}

      {/* Botón Principal de Acción para Móvil */}
      {isMetric && (
        <Button
          variant="contained"
          size="large"
          fullWidth
          startIcon={<ParamIcon />}
          onClick={handleOpenParam}
          sx={{
            py: 1.2,
            borderRadius: 3,
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.95rem',
            boxShadow: '0 4px 14px rgba(0,98,158,0.25)'
          }}
        >
          Configurar Medidas y Muros
        </Button>
      )}
    </Drawer>
  );
};
