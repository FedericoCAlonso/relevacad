/**
 * View: WallAssetEditor (Material 3)
 * Gestor de elementos eléctricos organizados por cada una de las 4 paredes y el cielorraso.
 */

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  Box,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Chip,
  Stack,
  Badge
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  CompassCalibration as CompassIcon
} from '@mui/icons-material';
import { Room, WallOrientation } from '@/models/RoomModel';
import { ELECTRICAL_ASSET_CATALOG } from '@/models/ElectricalTypes';
import { useSurveyViewModel } from '@/viewmodels';

import { getWallActualLength } from '@/viewmodels/utils/polygonSolver';

interface WallAssetEditorProps {
  room: Room;
  onOpenAddAsset: (wall: WallOrientation) => void;
}

export const WallAssetEditor: React.FC<WallAssetEditorProps> = ({
  room,
  onOpenAddAsset
}) => {
  const { deleteElectricalAsset } = useSurveyViewModel();
  const [selectedWall, setSelectedWall] = useState<WallOrientation>('north');

  const assetsOnCurrentWall = room.electricalAssets.filter(
    (a) => a.wall === selectedWall
  );

  const getWallAssetCount = (wall: WallOrientation) => {
    return room.electricalAssets.filter((a) => a.wall === wall).length;
  };

  const wallLabels: Record<WallOrientation, { title: string; lengthStr: string }> = {
    north: { title: 'Pared Norte', lengthStr: `${getWallActualLength(room, 'north')}m (Oeste → Este)` },
    south: { title: 'Pared Sur', lengthStr: `${getWallActualLength(room, 'south')}m (Oeste → Este)` },
    east: { title: 'Pared Este', lengthStr: `${getWallActualLength(room, 'east')}m (Norte → Sur)` },
    west: { title: 'Pared Oeste', lengthStr: `${getWallActualLength(room, 'west')}m (Norte → Sur)` },
    ceiling: { title: 'Cielorraso / Techo', lengthStr: 'Plano horizontal superior' }
  };

  return (
    <Card sx={{ border: '1px solid #e0e7ee', bgcolor: '#ffffff' }}>
      {/* Selector de Paredes con Badges */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: '#fbfcfd' }}>
        <Tabs
          value={selectedWall}
          onChange={(_, val) => setSelectedWall(val)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {(['north', 'south', 'east', 'west', 'ceiling'] as WallOrientation[]).map((w) => (
            <Tab
              key={w}
              value={w}
              label={
                <Badge
                  badgeContent={getWallAssetCount(w)}
                  color="primary"
                  sx={{ '& .MuiBadge-badge': { fontSize: '0.68rem', height: 16, minWidth: 16 } }}
                >
                  <Box sx={{ pr: 1 }}>
                    {w === 'north' && '🧭 Norte'}
                    {w === 'south' && '🧭 Sur'}
                    {w === 'east' && '🧭 Este'}
                    {w === 'west' && '🧭 Oeste'}
                    {w === 'ceiling' && '💡 Cielorraso'}
                  </Box>
                </Badge>
              }
            />
          ))}
        </Tabs>
      </Box>

      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* Encabezado de la Pared Activa */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
          <Box>
            <Typography variant="subtitle2" fontWeight={700}>
              {wallLabels[selectedWall].title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Referencia: {wallLabels[selectedWall].lengthStr}
            </Typography>
          </Box>
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => onOpenAddAsset(selectedWall)}
          >
            Agregar Boca
          </Button>
        </Box>

        {/* Lista de Elementos en esta Pared */}
        {assetsOnCurrentWall.length === 0 ? (
          <Box
            sx={{
              py: 4,
              textAlign: 'center',
              bgcolor: '#f8fafc',
              borderRadius: 2,
              border: '1px dashed #cbd5e1'
            }}
          >
            <CompassIcon sx={{ color: '#94a3b8', fontSize: 32, mb: 0.5 }} />
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              Sin elementos eléctricos registrados en esta pared
            </Typography>
            <Typography variant="caption" color="text.disabled">
              Hacé clic en &quot;Agregar Boca&quot; para incorporar tomas, tableros o llaves.
            </Typography>
          </Box>
        ) : (
          <List dense disablePadding>
            {assetsOnCurrentWall.map((asset) => {
              const meta = ELECTRICAL_ASSET_CATALOG[asset.type] || {
                label: asset.type,
                code: 'ELEC'
              };

              return (
                <ListItem
                  key={asset.id}
                  sx={{
                    mb: 1,
                    p: 1.2,
                    borderRadius: 2.5,
                    border: '1px solid #edf2f7',
                    bgcolor: '#ffffff',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                  }}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      size="small"
                      color="error"
                      onClick={() => deleteElectricalAsset(room.id, asset.id)}
                      title="Eliminar elemento"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  }
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        bgcolor: 'primary.light',
                        color: 'primary.dark',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.72rem'
                      }}
                    >
                      {meta.code}
                    </Box>
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="body2" fontWeight={600}>
                          {asset.label}
                        </Typography>
                        {asset.circuitCode && (
                          <Chip
                            label={asset.circuitCode}
                            size="small"
                            color="secondary"
                            variant="outlined"
                            sx={{ height: 18, fontSize: '0.65rem' }}
                          />
                        )}
                      </Stack>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {asset.wall !== 'ceiling'
                          ? `Distancia: ${asset.offsetMeters}m (${(asset.offsetRatio * 100).toFixed(0)}%) • Cota: ${asset.heightFromFloor}m s/NPT`
                          : `Ubicación central • Altura: ${asset.heightFromFloor}m s/NPT`}
                        {asset.notes ? ` • ${asset.notes}` : ''}
                      </Typography>
                    }
                  />
                </ListItem>
              );
            })}
          </List>
        )}
      </CardContent>
    </Card>
  );
};
