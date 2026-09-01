/**
 * View: AddAssetDialog (Material 3)
 * Diálogo modal para registrar elementos eléctricos referenciados relativamente a las paredes del ambiente.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Grid,
  Box,
  Typography,
  Stack,
  Slider,
  Chip
} from '@mui/material';
import {
  ElectricBolt as BoltIcon,
  Add as AddIcon
} from '@mui/icons-material';
import {
  ElectricalAssetType,
  ELECTRICAL_ASSET_CATALOG
} from '@/models/ElectricalTypes';
import { WallOrientation, Room } from '@/models/RoomModel';
import { useSurveyViewModel } from '@/viewmodels';

interface AddAssetDialogProps {
  open: boolean;
  onClose: () => void;
  room: Room;
  defaultWall?: WallOrientation;
}

export const AddAssetDialog: React.FC<AddAssetDialogProps> = ({
  open,
  onClose,
  room,
  defaultWall = 'north'
}) => {
  const { registerElectricalAsset } = useSurveyViewModel();

  const [assetType, setAssetType] = useState<ElectricalAssetType>('single_outlet_10a');
  const [wall, setWall] = useState<WallOrientation>(defaultWall);
  const [offsetMeters, setOffsetMeters] = useState<number>(1.0);
  const [heightFromFloor, setHeightFromFloor] = useState<number>(0.35);
  const [circuitCode, setCircuitCode] = useState<string>('C1-TUG');
  const [label, setLabel] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Sincronizar pared por defecto al abrir
  useEffect(() => {
    if (open) {
      setWall(defaultWall);
      const catalogItem = ELECTRICAL_ASSET_CATALOG[assetType];
      setHeightFromFloor(catalogItem.defaultHeight);
      setLabel(catalogItem.label);

      // Posición inicial al centro de la pared seleccionada
      const maxLen = defaultWall === 'east' || defaultWall === 'west'
        ? room.dimensions.length
        : room.dimensions.width;
      setOffsetMeters(Number((maxLen / 2).toFixed(2)));
    }
  }, [open, defaultWall, room]);

  const maxWallLength = wall === 'east' || wall === 'west'
    ? room.dimensions.length
    : room.dimensions.width;

  const handleAssetTypeChange = (type: ElectricalAssetType) => {
    setAssetType(type);
    const catalogItem = ELECTRICAL_ASSET_CATALOG[type];
    setHeightFromFloor(catalogItem.defaultHeight);
    setLabel(catalogItem.label);

    // Sugerencia de código de circuito según tipo
    if (catalogItem.category === 'lighting') {
      setCircuitCode('C1-IUG');
    } else if (catalogItem.category === 'outlet') {
      setCircuitCode(type === 'outlet_20a' ? 'C3-TUE' : 'C2-TUG');
    } else if (catalogItem.category === 'panel') {
      setCircuitCode('ALIM-01');
    }
  };

  const handleSave = () => {
    registerElectricalAsset(room.id, {
      type: assetType,
      label,
      wall,
      offsetMeters,
      heightFromFloor,
      circuitCode,
      notes
    });
    onClose();
  };

  const wallLabels: Record<WallOrientation, string> = {
    north: `Pared Norte (${room.dimensions.width}m)`,
    south: `Pared Sur (${room.dimensions.width}m)`,
    east: `Pared Este (${room.dimensions.length}m)`,
    west: `Pared Oeste (${room.dimensions.length}m)`,
    ceiling: 'Cielorraso / Centro Techo'
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 4, p: 1 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <BoltIcon color="primary" />
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Agregar Elemento Eléctrico
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Ambiente: {room.name}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {/* Tipo de Elemento Eléctrico */}
          <TextField
            select
            label="Tipo de Elemento Eléctrico"
            value={assetType}
            onChange={(e) => handleAssetTypeChange(e.target.value as ElectricalAssetType)}
            fullWidth
          >
            {Object.values(ELECTRICAL_ASSET_CATALOG).map((item) => (
              <MenuItem key={item.type} value={item.type}>
                <Box display="flex" justifyContent="space-between" width="100%" alignItems="center">
                  <span>{item.label}</span>
                  <Chip label={item.code} size="small" variant="outlined" sx={{ ml: 1, height: 20 }} />
                </Box>
              </MenuItem>
            ))}
          </TextField>

          {/* Pared Contenedora */}
          <TextField
            select
            label="Pared o Plano de Montaje"
            value={wall}
            onChange={(e) => {
              const newWall = e.target.value as WallOrientation;
              setWall(newWall);
              const maxL = newWall === 'east' || newWall === 'west'
                ? room.dimensions.length
                : room.dimensions.width;
              if (offsetMeters > maxL) setOffsetMeters(Number((maxL / 2).toFixed(2)));
            }}
            fullWidth
          >
            {(['north', 'south', 'east', 'west', 'ceiling'] as WallOrientation[]).map((w) => (
              <MenuItem key={w} value={w}>
                {wallLabels[w]}
              </MenuItem>
            ))}
          </TextField>

          {/* Distancia / Offset a lo largo de la pared */}
          {wall !== 'ceiling' ? (
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  Distancia desde el inicio de pared (Cota Relativa): <strong>{offsetMeters} m</strong>
                </Typography>
                <Chip
                  label={`${((offsetMeters / maxWallLength) * 100).toFixed(0)}% del tramo`}
                  size="small"
                  color="primary"
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              </Box>
              <Slider
                value={offsetMeters}
                min={0}
                max={maxWallLength}
                step={0.05}
                onChange={(_, val) => setOffsetMeters(val as number)}
                valueLabelDisplay="auto"
              />
              <Grid container spacing={1.5} mt={0.5}>
                <Grid item xs={6}>
                  <TextField
                    label="Distancia Exacta (m)"
                    type="number"
                    inputProps={{ step: 0.05, min: 0, max: maxWallLength }}
                    value={offsetMeters}
                    onChange={(e) => setOffsetMeters(Math.min(maxWallLength, Math.max(0, parseFloat(e.target.value) || 0)))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Altura s/NPT (m)"
                    type="number"
                    inputProps={{ step: 0.05, min: 0, max: room.dimensions.height }}
                    value={heightFromFloor}
                    onChange={(e) => setHeightFromFloor(parseFloat(e.target.value) || 0)}
                    fullWidth
                  />
                </Grid>
              </Grid>
            </Box>
          ) : (
            <Grid container spacing={1.5}>
              <Grid item xs={12}>
                <TextField
                  label="Altura de Montaje s/NPT (m)"
                  type="number"
                  inputProps={{ step: 0.05, min: 0, max: room.dimensions.height }}
                  value={heightFromFloor}
                  onChange={(e) => setHeightFromFloor(parseFloat(e.target.value) || 0)}
                  fullWidth
                  helperText="Cota de cielorraso"
                />
              </Grid>
            </Grid>
          )}

          {/* Código de Circuito y Etiqueta */}
          <Grid container spacing={1.5}>
            <Grid item xs={6}>
              <TextField
                label="Circuito Eléctrico"
                value={circuitCode}
                onChange={(e) => setCircuitCode(e.target.value)}
                placeholder="Ej: C1-TUG, C2-IUG"
                fullWidth
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Etiqueta Personalizada"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                fullWidth
              />
            </Grid>
          </Grid>

          {/* Notas Adicionales */}
          <TextField
            label="Notas Técnicas (Opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: Cañería rígida 3/4, caja plástica reforzada..."
            multiline
            rows={2}
            fullWidth
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Button onClick={onClose} color="inherit">
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          startIcon={<AddIcon />}
        >
          Guardar Elemento
        </Button>
      </DialogActions>
    </Dialog>
  );
};
