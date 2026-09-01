/**
 * View: RoomDimensionsCard (Material 3)
 * Editor de dimensiones constructivas con soporte para:
 * 1. Modo Ortogonal Estándar (Ancho X / Largo Y)
 * 2. Modo 4 Muros Independientes + Diagonal de Triangulación y Candados de Ángulos (90° / Libre)
 */

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Box,
  Divider,
  Stack,
  Chip,
  Tabs,
  Tab,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Straighten as DimIcon,
  SquareFoot as AreaIcon,
  ViewInAr as VolumeIcon,
  Lock as LockIcon,
  LockOpen as UnlockIcon,
  AutoAwesome as AutoCalcIcon
} from '@mui/icons-material';
import { Room } from '@/models/RoomModel';
import { useSurveyViewModel } from '@/viewmodels';
import {
  calculateTheoreticalDiagonal,
  calculatePolygonArea,
  calculateRoomPolygon,
  calculateCornerAngles
} from '@/viewmodels/utils/polygonSolver';

interface RoomDimensionsCardProps {
  room: Room;
}

export const RoomDimensionsCard: React.FC<RoomDimensionsCardProps> = ({ room }) => {
  const {
    updateRoomDimensions,
    updateRoomGeometry,
    updateIndependentWall,
    setDiagonalConstraint,
    toggleCornerLock
  } = useSurveyViewModel();

  const geom = room.geometry;
  const isParametricMode = geom?.mode === 'independent_walls' || geom?.mode === 'diagonal_triangulated';

  const [tabIndex, setTabIndex] = useState<number>(isParametricMode ? 1 : 0);

  const handleTabChange = (_: React.SyntheticEvent, newIdx: number) => {
    setTabIndex(newIdx);
    if (newIdx === 0) {
      updateRoomGeometry(room.id, { mode: 'rectangle' });
    } else {
      updateRoomGeometry(room.id, {
        mode: 'independent_walls',
        independentWalls: {
          north: geom?.independentWalls?.north || room.dimensions.width,
          south: geom?.independentWalls?.south || room.dimensions.width,
          east: geom?.independentWalls?.east || room.dimensions.length,
          west: geom?.independentWalls?.west || room.dimensions.length
        }
      });
    }
  };

  const handleWidthChange = (val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      updateRoomDimensions(room.id, { width: num });
    }
  };

  const handleLengthChange = (val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      updateRoomDimensions(room.id, { length: num });
    }
  };

  const handleHeightChange = (val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      updateRoomDimensions(room.id, { height: num });
    }
  };

  const handleWallLengthChange = (wall: 'north' | 'south' | 'east' | 'west', val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      updateIndependentWall(room.id, wall, num);
    }
  };

  const handleDiagonalChange = (val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      setDiagonalConstraint(room.id, num);
    }
  };

  const handleAutoDiagonal = () => {
    const ls = geom?.independentWalls?.south || room.dimensions.width;
    const lo = geom?.independentWalls?.west || room.dimensions.length;
    const theoretical = calculateTheoreticalDiagonal(ls, lo);
    setDiagonalConstraint(room.id, theoretical);
  };

  // Cálculos geométricos dinámicos con el solver
  const vertices = calculateRoomPolygon(room);
  const realArea = calculatePolygonArea(vertices);
  const cornerAngles = calculateCornerAngles(vertices);

  const LN = geom?.independentWalls?.north || room.dimensions.width;
  const LS = geom?.independentWalls?.south || room.dimensions.width;
  const LE = geom?.independentWalls?.east || room.dimensions.length;
  const LO = geom?.independentWalls?.west || room.dimensions.length;
  const diagSO_NE = geom?.diagonalSO_NE || calculateTheoreticalDiagonal(LS, LO);

  const locks = geom?.cornerConstraints || {};

  const perimeter = (LN + LS + LE + LO).toFixed(2);
  const volume = (realArea * room.dimensions.height).toFixed(2);

  return (
    <Card sx={{ mb: 2.5, border: '1px solid #e0e7ee', bgcolor: '#ffffff' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <DimIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>
              Dimensiones y Falsa Escuadra
            </Typography>
          </Stack>
          <Chip
            label={tabIndex === 1 ? '📐 4 Muros Independientes' : '📐 Ortogonal 90°'}
            size="small"
            color={tabIndex === 1 ? 'secondary' : 'default'}
            variant="outlined"
            sx={{ fontSize: '0.72rem', fontWeight: 600 }}
          />
        </Box>

        {/* Selector de Modo: Ortogonal vs 4 Muros Independientes */}
        <Tabs
          value={tabIndex}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{ mb: 2, minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5, fontSize: '0.78rem' } }}
        >
          <Tab label="1. Rectangular Clásico (X / Y)" />
          <Tab label="2. 4 Paredes + Diagonal (Obra Real)" />
        </Tabs>

        {/* MODO 1: RECTANGULAR ESTÁNDAR */}
        {tabIndex === 0 && (
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Ancho - Eje X (m)"
                type="number"
                inputProps={{ step: 0.05, min: 0.5 }}
                value={room.dimensions.width}
                onChange={(e) => handleWidthChange(e.target.value)}
                fullWidth
                size="small"
                helperText="Paredes Norte y Sur"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Largo - Eje Y (m)"
                type="number"
                inputProps={{ step: 0.05, min: 0.5 }}
                value={room.dimensions.length}
                onChange={(e) => handleLengthChange(e.target.value)}
                fullWidth
                size="small"
                helperText="Paredes Este y Oeste"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Altura Libre - Z (m)"
                type="number"
                inputProps={{ step: 0.05, min: 1.8 }}
                value={room.dimensions.height}
                onChange={(e) => handleHeightChange(e.target.value)}
                fullWidth
                size="small"
                helperText="Suelo a Techo"
              />
            </Grid>
          </Grid>
        )}

        {/* MODO 2: 4 MUROS INDEPENDIENTES + DIAGONAL DE TRIANGULACIÓN */}
        {tabIndex === 1 && (
          <Box>
            <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase" display="block" mb={1}>
              Mediciones Muro a Muro (Distanciómetro Láser)
            </Typography>

            <Grid container spacing={1.5}>
              <Grid item xs={6} sm={3}>
                <TextField
                  label="🟦 Pared Norte (m)"
                  type="number"
                  inputProps={{ step: 0.01, min: 0.3 }}
                  value={LN}
                  onChange={(e) => handleWallLengthChange('north', e.target.value)}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField
                  label="🟧 Pared Sur (m)"
                  type="number"
                  inputProps={{ step: 0.01, min: 0.3 }}
                  value={LS}
                  onChange={(e) => handleWallLengthChange('south', e.target.value)}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField
                  label="🟩 Pared Oeste (m)"
                  type="number"
                  inputProps={{ step: 0.01, min: 0.3 }}
                  value={LO}
                  onChange={(e) => handleWallLengthChange('west', e.target.value)}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField
                  label="🟨 Pared Este (m)"
                  type="number"
                  inputProps={{ step: 0.01, min: 0.3 }}
                  value={LE}
                  onChange={(e) => handleWallLengthChange('east', e.target.value)}
                  fullWidth
                  size="small"
                />
              </Grid>
            </Grid>

            {/* Fila de Diagonal de Triangulación y Altura */}
            <Grid container spacing={1.5} alignItems="center" mt={0.5}>
              <Grid item xs={12} sm={6}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    label="📐 Diagonal SO ➔ NE (m)"
                    type="number"
                    inputProps={{ step: 0.01, min: 0.5 }}
                    value={diagSO_NE}
                    onChange={(e) => handleDiagonalChange(e.target.value)}
                    fullWidth
                    size="small"
                    helperText="Cota de triangulación de esquina a esquina"
                  />
                  <Tooltip title="Calcular diagonal teórica 90° (Pitágoras)">
                    <IconButton size="small" onClick={handleAutoDiagonal} color="primary" sx={{ border: '1px solid #cbd5e1', p: 0.8 }}>
                      <AutoCalcIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Altura Libre - Z (m)"
                  type="number"
                  inputProps={{ step: 0.05, min: 1.8 }}
                  value={room.dimensions.height}
                  onChange={(e) => handleHeightChange(e.target.value)}
                  fullWidth
                  size="small"
                />
              </Grid>
            </Grid>

            {/* Candados de Restricción de Ángulos en las 4 Esquinas */}
            <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={1}>
                Restricciones de Escuadra en Vértices:
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" gap={0.5}>
                <Chip
                  icon={locks.northWestLocked90 ? <LockIcon fontSize="small" /> : <UnlockIcon fontSize="small" />}
                  label={`NO: ${cornerAngles.NW}° (${locks.northWestLocked90 ? '🔒 90° Fijo' : '🔓 Libre'})`}
                  onClick={() => toggleCornerLock(room.id, 'northWestLocked90')}
                  clickable
                  size="small"
                  color={locks.northWestLocked90 ? 'primary' : 'default'}
                  variant={locks.northWestLocked90 ? 'filled' : 'outlined'}
                  sx={{ fontSize: '0.72rem' }}
                />
                <Chip
                  icon={locks.northEastLocked90 ? <LockIcon fontSize="small" /> : <UnlockIcon fontSize="small" />}
                  label={`NE: ${cornerAngles.NE}° (${locks.northEastLocked90 ? '🔒 90° Fijo' : '🔓 Libre'})`}
                  onClick={() => toggleCornerLock(room.id, 'northEastLocked90')}
                  clickable
                  size="small"
                  color={locks.northEastLocked90 ? 'primary' : 'default'}
                  variant={locks.northEastLocked90 ? 'filled' : 'outlined'}
                  sx={{ fontSize: '0.72rem' }}
                />
                <Chip
                  icon={locks.southEastLocked90 ? <LockIcon fontSize="small" /> : <UnlockIcon fontSize="small" />}
                  label={`SE: ${cornerAngles.SE}° (${locks.southEastLocked90 ? '🔒 90° Fijo' : '🔓 Libre'})`}
                  onClick={() => toggleCornerLock(room.id, 'southEastLocked90')}
                  clickable
                  size="small"
                  color={locks.southEastLocked90 ? 'primary' : 'default'}
                  variant={locks.southEastLocked90 ? 'filled' : 'outlined'}
                  sx={{ fontSize: '0.72rem' }}
                />
                <Chip
                  icon={locks.southWestLocked90 ? <LockIcon fontSize="small" /> : <UnlockIcon fontSize="small" />}
                  label={`SO: ${cornerAngles.SW}° (${locks.southWestLocked90 ? '🔒 90° Fijo' : '🔓 Libre'})`}
                  onClick={() => toggleCornerLock(room.id, 'southWestLocked90')}
                  clickable
                  size="small"
                  color={locks.southWestLocked90 ? 'primary' : 'default'}
                  variant={locks.southWestLocked90 ? 'filled' : 'outlined'}
                  sx={{ fontSize: '0.72rem' }}
                />
              </Stack>
            </Box>
          </Box>
        )}

        <Divider sx={{ my: 1.8 }} />

        {/* Resumen de Métricas de Superficie Real y Volumen */}
        <Box display="flex" alignItems="center" justifyContent="space-around" flexWrap="wrap" gap={1}>
          <Box display="flex" alignItems="center" gap={1}>
            <AreaIcon color="primary" fontSize="small" />
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Superficie Libre
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {realArea} m²
              </Typography>
            </Box>
          </Box>

          <Box display="flex" alignItems="center" gap={1}>
            <DimIcon color="secondary" fontSize="small" />
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Perímetro
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {perimeter} m
              </Typography>
            </Box>
          </Box>

          <Box display="flex" alignItems="center" gap={1}>
            <VolumeIcon color="info" fontSize="small" />
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Volumen Útil
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {volume} m³
              </Typography>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};
