/**
 * View: ParametrizationView (Fase 2: Vista de Parametrización)
 * Formulario Material 3 donde, al seleccionar un nodo/ambiente, se ingresan sus dimensiones
 * rectangulares y se agregan particularidades eléctricas con referencias relativas a las paredes.
 * Si se selecciona un nodo conceptual (Ingreso/Isla), muestra el aviso correspondiente.
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Chip,
  Stack,
  Card,
  CardContent,
  Button,
  Container,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  MeetingRoom as RoomIcon,
  ViewQuilt as AssemblyIcon,
  Delete as DeleteIcon,
  Hub as TopologyIcon,
  CloudQueue as CloudIcon
} from '@mui/icons-material';
import { useSurveyViewModel } from '@/viewmodels';
import { WallOrientation } from '@/models/RoomModel';
import { RoomDimensionsCard } from './RoomDimensionsCard';
import { WallAssetEditor } from './WallAssetEditor';
import { RoomSchematicPreview } from './RoomSchematicPreview';
import { AddAssetDialog } from './AddAssetDialog';

interface ParametrizationViewProps {
  onOpenAddRoom: () => void;
}

export const ParametrizationView: React.FC<ParametrizationViewProps> = ({
  onOpenAddRoom
}) => {
  const {
    rooms,
    selectedRoom,
    selectRoom,
    deleteRoom,
    setActivePhase
  } = useSurveyViewModel();

  const [addAssetModalOpen, setAddAssetModalOpen] = useState(false);
  const [selectedWallForAsset, setSelectedWallForAsset] = useState<WallOrientation>('north');

  const handleOpenAddAsset = (wall: WallOrientation) => {
    setSelectedWallForAsset(wall);
    setAddAssetModalOpen(true);
  };

  const handleDeleteRoom = (roomId: string, roomName: string) => {
    if (window.confirm(`¿Estás seguro de eliminar el espacio "${roomName}"?`)) {
      deleteRoom(roomId);
    }
  };

  if (rooms.length === 0) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        height="100%"
        p={3}
      >
        <RoomIcon sx={{ fontSize: 64, color: '#94a3b8', mb: 2 }} />
        <Typography variant="h6" fontWeight={700} gutterBottom>
          No hay ambientes creados
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" sx={{ maxWidth: 400, mb: 3 }}>
          Creá primero un ambiente o cargá la vivienda de prueba para parametrizar las dimensiones y circuitos.
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={onOpenAddRoom}>
          Crear Primer Ambiente
        </Button>
      </Box>
    );
  }

  const currentRoom = selectedRoom || rooms.find((r) => !r.isAccessPoint && !r.isTechnicalIsland) || rooms[0];
  const isNonMetric = currentRoom.isAccessPoint || currentRoom.isTechnicalIsland;

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', p: { xs: 2, md: 3 } }}>
      <Container maxWidth="xl" disableGutters>
        {/* Barra Superior de Selección de Ambientes */}
        <Card sx={{ mb: 2.5, bgcolor: '#ffffff' }}>
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
              <Box display="flex" alignItems="center" gap={1} overflow="auto" sx={{ maxWidth: '100%' }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase" sx={{ whiteSpace: 'nowrap', mr: 1 }}>
                  Espacio:
                </Typography>
                <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', py: 0.5 }}>
                  {rooms.map((room) => {
                    const isSelected = room.id === currentRoom.id;
                    const isAccess = room.isAccessPoint;
                    const isTechnical = room.isTechnicalIsland;

                    return (
                      <Chip
                        key={room.id}
                        label={
                          isTechnical
                            ? `⚡ ${room.name}`
                            : isAccess
                            ? `🟢 ${room.name}`
                            : `${room.name} (${room.electricalAssets.length})`
                        }
                        onClick={() => selectRoom(room.id)}
                        color={
                          isSelected
                            ? isTechnical
                              ? 'warning'
                              : isAccess
                              ? 'success'
                              : 'primary'
                            : 'default'
                        }
                        variant={isSelected ? 'filled' : 'outlined'}
                        sx={{ fontWeight: isSelected ? 700 : 500 }}
                      />
                    );
                  })}
                </Stack>
              </Box>

              <Stack direction="row" spacing={1}>
                <Tooltip title="Eliminar este espacio">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDeleteRoom(currentRoom.id, currentRoom.name)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Button
                  variant="outlined"
                  size="small"
                  endIcon={<AssemblyIcon />}
                  onClick={() => setActivePhase('assembly')}
                >
                  Ir a Ensamblaje 2D
                </Button>
              </Stack>
            </Box>
          </CardContent>
        </Card>

        {/* Si es un nodo conceptual (Ingreso / Isla Técnica), mostrar aviso sin muros rígidos */}
        {isNonMetric ? (
          <Card
            sx={{
              p: 4,
              textAlign: 'center',
              bgcolor: currentRoom.isTechnicalIsland ? '#fffbeb' : '#f0fdf4',
              border: currentRoom.isTechnicalIsland ? '1.5px dashed #f59e0b' : '1.5px dashed #10b981',
              borderRadius: 4
            }}
          >
            <CloudIcon
              sx={{
                fontSize: 56,
                color: currentRoom.isTechnicalIsland ? '#d97706' : '#059669',
                mb: 1.5
              }}
            />
            <Typography variant="h6" fontWeight={700} color={currentRoom.isTechnicalIsland ? '#92400e' : '#065f46'} gutterBottom>
              {currentRoom.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto', mb: 3 }}>
              {currentRoom.isTechnicalIsland
                ? 'Esta es una Isla Técnica de Suministro (ej: Sala de Medidores o Pilar de Acometida). No requiere cotas de habitación constructiva y se representa como una nube de suministro exterior.'
                : 'Este es un Punto de Ingreso / Frontera (ej: Calle Línea Municipal o Palier Común). Se representa como una nube exterior en el esquema de ensamblaje.'}
            </Typography>
            <Stack direction="row" spacing={1.5} justifyContent="center">
              <Button
                variant="outlined"
                startIcon={<TopologyIcon />}
                onClick={() => setActivePhase('topology')}
              >
                Volver a Topología
              </Button>
              <Button
                variant="contained"
                endIcon={<AssemblyIcon />}
                onClick={() => setActivePhase('assembly')}
              >
                Ver Ensamblaje 2D
              </Button>
            </Stack>
          </Card>
        ) : (
          /* Layout en 2 Columnas: Parametrización y Esquema para Ambientes Propios */
          <Grid container spacing={2.5}>
            {/* Columna Izquierda: Dimensiones y Gestión de Bocas por Pared */}
            <Grid item xs={12} lg={7}>
              <RoomDimensionsCard room={currentRoom} />
              <WallAssetEditor
                room={currentRoom}
                onOpenAddAsset={handleOpenAddAsset}
              />
            </Grid>

            {/* Columna Derecha: Previsualización Paramétrica 2D */}
            <Grid item xs={12} lg={5}>
              <RoomSchematicPreview room={currentRoom} />
            </Grid>
          </Grid>
        )}
      </Container>

      {/* Modal para Agregar Elemento Eléctrico a una Pared */}
      {addAssetModalOpen && !isNonMetric && (
        <AddAssetDialog
          open={addAssetModalOpen}
          onClose={() => setAddAssetModalOpen(false)}
          room={currentRoom}
          defaultWall={selectedWallForAsset}
        />
      )}
    </Box>
  );
};
