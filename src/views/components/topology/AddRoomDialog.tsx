/**
 * View: AddRoomDialog (Material 3)
 * Diálogo interactivo con 3 pestañas: Ambientes Interiores, Puntos de Ingreso e Islas Técnicas de Suministro.
 */

import React, { useState } from 'react';
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
  Tabs,
  Tab,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  Add as AddIcon,
  MeetingRoom as RoomIcon,
  DoorSliding as EntryIcon,
  ElectricMeter as IslandIcon
} from '@mui/icons-material';
import { RoomType, ROOM_TYPE_CATALOG } from '@/models/RoomModel';
import { useSurveyViewModel } from '@/viewmodels';

interface AddRoomDialogProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: 'interior' | 'access' | 'technical';
}

export const AddRoomDialog: React.FC<AddRoomDialogProps> = ({
  open,
  onClose,
  defaultTab = 'interior'
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { createRoom, selectRoom } = useSurveyViewModel();

  const initialTabIndex = defaultTab === 'technical' ? 2 : defaultTab === 'access' ? 1 : 0;
  const [tabIndex, setTabIndex] = useState<number>(initialTabIndex);
  const [type, setType] = useState<RoomType>(
    defaultTab === 'technical'
      ? 'technical_island_meters'
      : defaultTab === 'access'
      ? 'access_street'
      : 'living'
  );
  const [name, setName] = useState('');
  const [width, setWidth] = useState<number>(4.0);
  const [length, setLength] = useState<number>(4.5);
  const [height, setHeight] = useState<number>(2.6);
  const [error, setError] = useState<string | null>(null);

  const isInteriorMode = tabIndex === 0;
  const isAccessMode = tabIndex === 1;
  const isTechnicalMode = tabIndex === 2;

  const handleTabChange = (_: React.SyntheticEvent, newIndex: number) => {
    setTabIndex(newIndex);
    let newDefaultType: RoomType = 'living';
    if (newIndex === 1) newDefaultType = 'access_street';
    if (newIndex === 2) newDefaultType = 'technical_island_meters';
    handleTypeChange(newDefaultType);
  };

  const handleTypeChange = (newType: RoomType) => {
    setType(newType);
    const preset = ROOM_TYPE_CATALOG[newType];
    setName(preset.label);
    setWidth(preset.defaultWidth);
    setLength(preset.defaultLength);
    setHeight(preset.defaultHeight);
  };

  const handleSave = () => {
    try {
      setError(null);
      const newRoom = createRoom(
        name,
        type,
        isInteriorMode ? { width, length, height } : { width: 0, length: 0, height: 0 },
        isAccessMode,
        isTechnicalMode
      );
      selectRoom(newRoom.id);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Error al crear espacio');
      }
    }
  };

  // Filtrar catálogo según la pestaña seleccionada
  const filteredCatalog = Object.values(ROOM_TYPE_CATALOG).filter((meta) => {
    if (isTechnicalMode) return meta.isTechnical;
    if (isAccessMode) return meta.isAccess;
    return !meta.isAccess && !meta.isTechnical;
  });

  return (
    <Dialog
      fullScreen={isMobile}
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: isMobile ? 0 : 4, p: isMobile ? 0.5 : 1 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {isTechnicalMode ? (
          <IslandIcon color="warning" />
        ) : isAccessMode ? (
          <EntryIcon color="success" />
        ) : (
          <RoomIcon color="primary" />
        )}
        <Typography variant="h6" fontWeight={700}>
          {isTechnicalMode
            ? 'Nueva Isla Técnica (Suministro)'
            : isAccessMode
            ? 'Nuevo Punto de Ingreso'
            : 'Nuevo Ambiente Interior'}
        </Typography>
      </DialogTitle>

      {/* Selector de Modo: 3 Pestañas */}
      <Box sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabIndex} onChange={handleTabChange} variant="fullWidth">
          <Tab icon={<RoomIcon fontSize="small" />} iconPosition="start" label="Interior" />
          <Tab icon={<EntryIcon fontSize="small" />} iconPosition="start" label="Ingreso" />
          <Tab icon={<IslandIcon fontSize="small" />} iconPosition="start" label="Isla Técnica" />
        </Tabs>
      </Box>

      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {error && (
            <Typography variant="caption" color="error" fontWeight={600}>
              {error}
            </Typography>
          )}

          {/* Selector de Tipo */}
          <TextField
            select
            label="Tipo de Espacio"
            value={type}
            onChange={(e) => handleTypeChange(e.target.value as RoomType)}
            fullWidth
          >
            {filteredCatalog.map((meta) => (
              <MenuItem key={meta.type} value={meta.type}>
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {meta.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {meta.description}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </TextField>

          {/* Nombre / Identificador */}
          <TextField
            label="Nombre del Espacio"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Sala de Medidores Subsuelo, Palier 2°P, Cocina..."
            fullWidth
            required
          />

          {/* Dimensiones (Exclusivas para Ambientes Interiores Propios) */}
          {isInteriorMode ? (
            <Box>
              <Typography variant="caption" fontWeight={600} color="text.secondary" gutterBottom display="block">
                Dimensiones Constructivas del Local (Metros)
              </Typography>
              <Grid container spacing={1.5}>
                <Grid item xs={4}>
                  <TextField
                    label="Ancho (X)"
                    type="number"
                    inputProps={{ step: 0.1, min: 0.5 }}
                    value={width}
                    onChange={(e) => setWidth(parseFloat(e.target.value) || 0)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    label="Largo (Y)"
                    type="number"
                    inputProps={{ step: 0.1, min: 0.5 }}
                    value={length}
                    onChange={(e) => setLength(parseFloat(e.target.value) || 0)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    label="Altura (Z)"
                    type="number"
                    inputProps={{ step: 0.1, min: 0 }}
                    value={height}
                    onChange={(e) => setHeight(parseFloat(e.target.value) || 0)}
                    fullWidth
                  />
                </Grid>
              </Grid>
            </Box>
          ) : (
            <Box
              sx={{
                p: 1.8,
                bgcolor: isAccessMode ? '#f0fdf4' : '#fffbeb',
                borderRadius: 2.5,
                border: isAccessMode ? '1px solid #bbf7d0' : '1px solid #fde68a'
              }}
            >
              <Typography
                variant="caption"
                color={isAccessMode ? '#166534' : '#92400e'}
                fontWeight={600}
                display="block"
              >
                {isAccessMode
                  ? '☁️ Los puntos de ingreso (Calle L.M., Palier, etc.) son nodos conceptuales de frontera sin dimensiones fijas y se representan como una nube exterior en el esquema de ensamblaje.'
                  : '☁️ Las islas técnicas de suministro (Sala de Medidores, Pilares, Plenos) no requieren cotas constructivas para la planta de la unidad funcional.'}
              </Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions
        sx={{
          px: 2,
          pt: 1.5,
          pb: isMobile ? 'calc(env(safe-area-inset-bottom, 0px) + 24px)' : 1.5,
          borderTop: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Button onClick={onClose} color="inherit">
          Cancelar
        </Button>
        <Button
          variant="contained"
          color={isTechnicalMode ? 'warning' : isAccessMode ? 'success' : 'primary'}
          onClick={handleSave}
          startIcon={<AddIcon />}
          disabled={!name.trim()}
        >
          Crear {isTechnicalMode ? 'Isla Técnica' : isAccessMode ? 'Punto de Ingreso' : 'Ambiente'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
