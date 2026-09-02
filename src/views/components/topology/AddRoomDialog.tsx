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
  ToggleButton,
  ToggleButtonGroup,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  Add as AddIcon,
  MeetingRoom as RoomIcon,
  DoorSliding as EntryIcon,
  ElectricMeter as IslandIcon,
  BorderLeft as BoundaryIcon
} from '@mui/icons-material';
import {
  RoomType,
  ROOM_TYPE_CATALOG,
  TipoCubierta,
  TIPO_CUBIERTA_CATALOG
} from '@/models/RoomModel';
import {
  TABIQUE_MATERIAL_CATALOG,
  TabiqueMaterialType
} from '@/models/GraphModel';
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
  const [tipoCubierta, setTipoCubierta] = useState<TipoCubierta>('cubierto');
  const [name, setName] = useState('');
  const [width, setWidth] = useState<number>(4.0);
  const [length, setLength] = useState<number>(4.5);
  const [height, setHeight] = useState<number>(2.6);

  // Propiedades específicas de la categoría Límite / Medianera
  const [boundaryMaterial, setBoundaryMaterial] = useState<TabiqueMaterialType>('medianera_comun_30');
  const [boundaryThickness, setBoundaryThickness] = useState<number>(0.30);
  const [boundaryCondition, setBoundaryCondition] = useState<'muro_ciego' | 'frente_calle' | 'retiro_frente' | 'patio_luz'>('muro_ciego');
  const [boundaryNotes, setBoundaryNotes] = useState<string>('');

  const [error, setError] = useState<string | null>(null);

  const isInteriorMode = tabIndex === 0;
  const isAccessMode = tabIndex === 1;
  const isTechnicalMode = tabIndex === 2;
  const isBoundaryMode = tabIndex === 3;

  const handleTabChange = (_: React.SyntheticEvent, newIndex: number) => {
    setTabIndex(newIndex);
    let newDefaultType: RoomType = 'living';
    if (newIndex === 1) newDefaultType = 'access_street';
    if (newIndex === 2) newDefaultType = 'technical_island_meters';
    if (newIndex === 3) newDefaultType = 'limit_medianera_izq';
    handleTypeChange(newDefaultType);
  };

  const handleTypeChange = (newType: RoomType) => {
    setType(newType);
    const preset = ROOM_TYPE_CATALOG[newType];
    setName(preset.label);
    setTipoCubierta(preset.defaultCubierta || 'cubierto');
    setWidth(preset.defaultWidth);
    setLength(preset.defaultLength);
    setHeight(preset.defaultHeight);

    // Ajustar valores constructivos por defecto según el tipo de límite
    if (newType === 'limit_frente_lm') {
      setBoundaryCondition('frente_calle');
      setBoundaryMaterial('medianera_comun_30');
      setBoundaryThickness(0.30);
    } else if (newType === 'limit_patio') {
      setBoundaryCondition('patio_luz');
      setBoundaryMaterial('ladrillo_hueco_12');
      setBoundaryThickness(0.15);
    } else if (newType === 'limit_fondo') {
      setBoundaryCondition('muro_ciego');
      setBoundaryMaterial('medianera_comun_30');
      setBoundaryThickness(0.30);
    } else if (newType.startsWith('limit_medianera')) {
      setBoundaryCondition('muro_ciego');
      setBoundaryMaterial('medianera_comun_30');
      setBoundaryThickness(0.30);
    }
  };

  const handleMaterialChange = (mat: TabiqueMaterialType) => {
    setBoundaryMaterial(mat);
    const defThick = TABIQUE_MATERIAL_CATALOG[mat]?.defaultThicknessMeters || 0.30;
    setBoundaryThickness(defThick);
  };

  const handleSave = () => {
    try {
      setError(null);
      const newRoom = createRoom(
        name,
        type,
        isInteriorMode ? { width, length, height } : { width: 0, length: 0, height: 0 },
        isAccessMode,
        isTechnicalMode,
        tipoCubierta,
        isBoundaryMode
          ? {
              materialType: boundaryMaterial,
              thicknessMeters: boundaryThickness,
              boundaryCondition,
              notes: boundaryNotes.trim() || undefined
            }
          : undefined
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
    if (isBoundaryMode) return meta.isBoundary;
    if (isTechnicalMode) return meta.isTechnical;
    if (isAccessMode) return meta.isAccess;
    return !meta.isAccess && !meta.isTechnical && !meta.isBoundary;
  });

  return (
    <Dialog
      fullScreen={isMobile}
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: isMobile ? 0 : 4, p: isMobile ? 0.5 : 1 } }}
    >
      <DialogTitle component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {isBoundaryMode ? (
          <BoundaryIcon color="secondary" />
        ) : isTechnicalMode ? (
          <IslandIcon color="warning" />
        ) : isAccessMode ? (
          <EntryIcon color="success" />
        ) : (
          <RoomIcon color="primary" />
        )}
        <Typography variant="h6" fontWeight={700}>
          {isBoundaryMode
            ? 'Nuevo Límite de Terreno / Medianera'
            : isTechnicalMode
            ? 'Nueva Isla Técnica (Suministro)'
            : isAccessMode
            ? 'Nuevo Punto de Ingreso'
            : 'Nuevo Ambiente Interior'}
        </Typography>
      </DialogTitle>

      {/* Selector de Modo: 4 Pestañas */}
      <Box sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabIndex} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
          <Tab icon={<RoomIcon fontSize="small" />} iconPosition="start" label="Interior" />
          <Tab icon={<EntryIcon fontSize="small" />} iconPosition="start" label="Ingreso" />
          <Tab icon={<IslandIcon fontSize="small" />} iconPosition="start" label="Isla Técnica" />
          <Tab icon={<BoundaryIcon fontSize="small" />} iconPosition="start" label="Límites / Medianeras" />
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
            label={isBoundaryMode ? "Tipo de Límite / Medianera" : isTechnicalMode ? "Tipo de Isla Técnica" : isAccessMode ? "Tipo de Acceso" : "Tipo de Espacio"}
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
            label={
              isBoundaryMode
                ? 'Referencia / Nombre del Límite'
                : isTechnicalMode
                ? 'Nombre de la Isla Técnica'
                : isAccessMode
                ? 'Nombre del Punto de Acceso'
                : 'Nombre del Ambiente'
            }
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              isBoundaryMode
                ? 'Ej: Medianera Izquierda (Lote 12), Frente Calle San Martín, Fondo...'
                : isTechnicalMode
                ? 'Ej: Sala de Medidores Subsuelo, Pilar Acometida...'
                : isAccessMode
                ? 'Ej: Calle L.M., Palier Principal, Cochera...'
                : 'Ej: Living Comedor, Cocina, Dormitorio 1...'
            }
            fullWidth
            required
          />

          {/* Propiedades exclusivas de la categoría Límite / Medianera */}
          {isBoundaryMode && (
            <Stack spacing={2} sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2.5, border: '1px solid #cbd5e1' }}>
              <Box>
                <Typography variant="caption" fontWeight={700} color="#334155" display="block" gutterBottom>
                  🧱 Especificaciones del Muro Lindero / Perimetral
                </Typography>
                <Typography variant="caption" color="#64748b" display="block">
                  Configura el material constructivo, espesor y condición reglamentaria de este límite.
                </Typography>
              </Box>

              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={8}>
                  <TextField
                    select
                    label="Material del Muro Lindero"
                    value={boundaryMaterial}
                    onChange={(e) => handleMaterialChange(e.target.value as TabiqueMaterialType)}
                    fullWidth
                    size="small"
                  >
                    {Object.values(TABIQUE_MATERIAL_CATALOG).map((mat) => (
                      <MenuItem key={mat.type} value={mat.type}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <span>{mat.emoji}</span>
                          <Typography variant="body2">{mat.label}</Typography>
                        </Stack>
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Espesor (m)"
                    type="number"
                    inputProps={{ step: 0.05, min: 0.05, max: 1.0 }}
                    value={boundaryThickness}
                    onChange={(e) => setBoundaryThickness(parseFloat(e.target.value) || 0.30)}
                    fullWidth
                    size="small"
                  />
                </Grid>
              </Grid>

              {/* Condición Reglamentaria */}
              <Box>
                <Typography variant="caption" fontWeight={600} color="text.secondary" gutterBottom display="block">
                  Condición del Límite
                </Typography>
                <ToggleButtonGroup
                  value={boundaryCondition}
                  exclusive
                  onChange={(_, val) => {
                    if (val) setBoundaryCondition(val);
                  }}
                  fullWidth
                  size="small"
                >
                  <ToggleButton value="muro_ciego" sx={{ textTransform: 'none', fontSize: '0.73rem', py: 0.6 }}>
                    🧱 Muro Ciego
                  </ToggleButton>
                  <ToggleButton value="frente_calle" sx={{ textTransform: 'none', fontSize: '0.73rem', py: 0.6 }}>
                    🏛️ Frente Calle
                  </ToggleButton>
                  <ToggleButton value="retiro_frente" sx={{ textTransform: 'none', fontSize: '0.73rem', py: 0.6 }}>
                    🏡 Retiro / Jardín
                  </ToggleButton>
                  <ToggleButton value="patio_luz" sx={{ textTransform: 'none', fontSize: '0.73rem', py: 0.6 }}>
                    ☀️ Patio Luz
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {/* Notas del Límite */}
              <TextField
                label="Notas de Lindero / Parcela (Opcional)"
                value={boundaryNotes}
                onChange={(e) => setBoundaryNotes(e.target.value)}
                placeholder="Ej: Lindero con Lote 12, Padrón 4582, muro de 30cm propio..."
                fullWidth
                size="small"
              />
            </Stack>
          )}

          {/* Tipo de Cubierta (Solo para Ambientes Interiores y Accesos) */}
          {(isInteriorMode || isAccessMode) && (
            <Box>
              <Typography variant="caption" fontWeight={600} color="text.secondary" gutterBottom display="block">
                Tipo de Cubierta / Cerramiento
              </Typography>
              <ToggleButtonGroup
                value={tipoCubierta}
                exclusive
                onChange={(_, val) => {
                  if (val) setTipoCubierta(val);
                }}
                fullWidth
                size="small"
              >
                {Object.values(TIPO_CUBIERTA_CATALOG).map((cub) => (
                  <ToggleButton
                    key={cub.tipo}
                    value={cub.tipo}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      py: 0.8
                    }}
                  >
                    <Stack direction="row" spacing={0.6} alignItems="center">
                      <span>{cub.emoji}</span>
                      <span>{cub.label}</span>
                    </Stack>
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontSize: '0.7rem' }}>
                {TIPO_CUBIERTA_CATALOG[tipoCubierta]?.description}
              </Typography>
            </Box>
          )}

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
