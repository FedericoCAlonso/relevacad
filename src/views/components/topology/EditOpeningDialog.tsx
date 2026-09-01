/**
 * View: EditOpeningDialog (Material 3)
 * Diálogo para configurar las propiedades arquitectónicas y técnicas de una Abertura / Vínculo
 * (Puertas, Vanos, Ventanas, Portones de Ingreso, Orientación de Paredes Norte/Sur/Este/Oeste).
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
  FormControlLabel,
  Switch,
  Chip,
  Divider,
  IconButton
} from '@mui/material';
import {
  MeetingRoom as DoorIcon,
  Delete as DeleteIcon,
  ElectricBolt as BoltIcon,
  Tune as TuneIcon,
  Explore as CompassIcon
} from '@mui/icons-material';
import {
  LogicalConnection,
  LogicalConnectionType,
  CONNECTION_TYPE_CATALOG,
  SwingDirection,
  OpeningMaterial
} from '@/models/GraphModel';
import { WallOrientation } from '@/models/RoomModel';
import { useSurveyViewModel } from '@/viewmodels';

interface EditOpeningDialogProps {
  open: boolean;
  onClose: () => void;
  connection: LogicalConnection | null;
}

export const EditOpeningDialog: React.FC<EditOpeningDialogProps> = ({
  open,
  onClose,
  connection
}) => {
  const { rooms, updateConnection, deleteConnection } = useSurveyViewModel();

  const [type, setType] = useState<LogicalConnectionType>('puerta_estandar');
  const [label, setLabel] = useState('');
  const [sourceWall, setSourceWall] = useState<WallOrientation>('east');
  const [targetWall, setTargetWall] = useState<WallOrientation>('west');
  const [widthMeters, setWidthMeters] = useState(0.8);
  const [heightMeters, setHeightMeters] = useState(2.05);
  const [sillHeightMeters, setSillHeightMeters] = useState<number | undefined>(undefined);
  const [swingDirection, setSwingDirection] = useState<SwingDirection>('right');
  const [material, setMaterial] = useState<OpeningMaterial>('wood');
  const [hasAutomation, setHasAutomation] = useState(false);
  const [hasElectricalPass, setHasElectricalPass] = useState(false);
  const [ductDiameterMm, setDuctDiameterMm] = useState<number | undefined>(19);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (connection) {
      setType(connection.type);
      setLabel(connection.label || '');
      setSourceWall(connection.sourceWall || 'east');
      setTargetWall(connection.targetWall || 'west');
      setDuctDiameterMm(connection.ductDiameterMm);
      setNotes(connection.notes || '');

      if (connection.opening) {
        setWidthMeters(connection.opening.widthMeters);
        setHeightMeters(connection.opening.heightMeters);
        setSillHeightMeters(connection.opening.sillHeightMeters);
        setSwingDirection(connection.opening.swingDirection || 'right');
        setMaterial(connection.opening.material || 'wood');
        setHasAutomation(!!connection.opening.hasAutomation);
        setHasElectricalPass(!!connection.opening.hasElectricalPass);
        if (connection.opening.notes) setNotes(connection.opening.notes);
      } else {
        const meta = CONNECTION_TYPE_CATALOG[connection.type] || CONNECTION_TYPE_CATALOG.puerta_estandar;
        setWidthMeters(meta.defaultWidth);
        setHeightMeters(meta.defaultHeight);
        setSillHeightMeters(meta.defaultSillHeight);
        setSwingDirection(meta.defaultSwing || 'right');
      }
    }
  }, [connection]);

  if (!connection) return null;

  const sourceRoom = rooms.find((r) => r.id === connection.sourceRoomId);
  const targetRoom = rooms.find((r) => r.id === connection.targetRoomId);

  const handleTypeChange = (newType: LogicalConnectionType) => {
    setType(newType);
    const meta = CONNECTION_TYPE_CATALOG[newType];
    if (meta) {
      setLabel(`${meta.emoji} ${meta.label}`);
      setWidthMeters(meta.defaultWidth);
      setHeightMeters(meta.defaultHeight);
      setSillHeightMeters(meta.defaultSillHeight);
      if (meta.defaultSwing) setSwingDirection(meta.defaultSwing);
      if (newType === 'puerta_seguridad' || newType === 'porton_garage') {
        setHasAutomation(true);
      }
    }
  };

  const handleSave = () => {
    const meta = CONNECTION_TYPE_CATALOG[type];
    const isOpeningType = meta?.isOpening ?? true;

    updateConnection(connection.id, {
      type,
      label: label.trim() || `${meta.emoji} ${meta.label}`,
      sourceWall,
      targetWall,
      sourceHandle: `source-${sourceWall}`,
      targetHandle: `target-${targetWall}`,
      ductDiameterMm: !isOpeningType ? ductDiameterMm : undefined,
      notes: notes.trim(),
      opening: isOpeningType
        ? {
            openingType: type,
            widthMeters,
            heightMeters,
            sillHeightMeters: type === 'ventana_estandar' ? sillHeightMeters : undefined,
            swingDirection,
            material,
            hasAutomation,
            hasElectricalPass,
            notes: notes.trim()
          }
        : undefined
    });

    onClose();
  };

  const handleDelete = () => {
    if (window.confirm('¿Eliminar este vínculo / abertura?')) {
      deleteConnection(connection.id);
      onClose();
    }
  };

  const isWindow = type === 'ventana_estandar' || type === 'puerta_ventana';
  const isConduit = type === 'conduit_main' || type === 'conduit_sec' || type === 'pass_through';
  const isCommonWall = type === 'pared_comun';
  const isOpening = !isConduit && !isCommonWall;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 4, p: 1 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <DoorIcon color="primary" />
          <Box>
            <Typography variant="h6" fontWeight={700}>
              {isCommonWall ? 'Propiedades de Pared Común' : 'Propiedades de la Abertura / Vínculo'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {sourceRoom?.name} ↔ {targetRoom?.name}
            </Typography>
          </Box>
        </Stack>
        <IconButton color="error" size="small" onClick={handleDelete} title="Eliminar vínculo">
          <DeleteIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {/* Tipo de Abertura / Vínculo */}
          <TextField
            select
            label="Tipo de Abertura o Conexión"
            value={type}
            onChange={(e) => handleTypeChange(e.target.value as LogicalConnectionType)}
            fullWidth
          >
            {Object.values(CONNECTION_TYPE_CATALOG).map((item) => (
              <MenuItem key={item.type} value={item.type}>
                <Box display="flex" justifyContent="space-between" width="100%" alignItems="center">
                  <span>{item.emoji} {item.label}</span>
                  <Chip label={item.shortCode} size="small" variant="outlined" sx={{ height: 20 }} />
                </Box>
              </MenuItem>
            ))}
          </TextField>

          {/* 🧭 Orientación de las Paredes de Anclaje */}
          <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 2.5, border: '1px solid #e2e8f0' }}>
            <Box display="flex" alignItems="center" gap={0.8} mb={1.2}>
              <CompassIcon fontSize="small" color="primary" />
              <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase">
                Orientación Espacial de la Abertura / Pared Compartida
              </Typography>
            </Box>
            <Grid container spacing={1.5}>
              <Grid item xs={6}>
                <TextField
                  select
                  label={`Pared en ${sourceRoom?.name || 'Origen'}`}
                  value={sourceWall}
                  onChange={(e) => setSourceWall(e.target.value as WallOrientation)}
                  fullWidth
                  size="small"
                >
                  <MenuItem value="north">🧭 Norte (Superior)</MenuItem>
                  <MenuItem value="south">🧭 Sur (Inferior)</MenuItem>
                  <MenuItem value="east">🧭 Este (Derecha)</MenuItem>
                  <MenuItem value="west">🧭 Oeste (Izquierda)</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  select
                  label={`Pared en ${targetRoom?.name || 'Destino'}`}
                  value={targetWall}
                  onChange={(e) => setTargetWall(e.target.value as WallOrientation)}
                  fullWidth
                  size="small"
                >
                  <MenuItem value="north">🧭 Norte (Superior)</MenuItem>
                  <MenuItem value="south">🧭 Sur (Inferior)</MenuItem>
                  <MenuItem value="east">🧭 Este (Derecha)</MenuItem>
                  <MenuItem value="west">🧭 Oeste (Izquierda)</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </Box>

          {/* Etiqueta visible en el grafo */}
          <TextField
            label="Etiqueta visible en Topología"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ej: Puerta Principal, Vano Cocina, Tabique Divisorio..."
            fullWidth
          />

          {isCommonWall && (
            <Box sx={{ p: 2, bgcolor: '#f1f5f9', borderRadius: 2, border: '1px dashed #94a3b8' }}>
              <Typography variant="body2" fontWeight={600} color="text.primary">
                🧱 Tabique Ciego Compartido (Pared Común)
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                Esta conexión establece que las caras seleccionadas ({sourceWall.toUpperCase()} de {sourceRoom?.name} y {targetWall.toUpperCase()} de {targetRoom?.name}) están en contacto constructivo directo, facilitando la alineación y el ensamblaje 2D de ambos recintos.
              </Typography>
            </Box>
          )}

          {isOpening && (
            <>
              {/* Dimensiones físicas de la carpintería */}
              <Box>
                <Typography variant="caption" fontWeight={600} color="text.secondary" gutterBottom display="block">
                  Dimensiones de la Carpintería (Metros)
                </Typography>
                <Grid container spacing={1.5}>
                  <Grid item xs={isWindow ? 4 : 6}>
                    <TextField
                      label="Ancho (Luz de Paso)"
                      type="number"
                      inputProps={{ step: 0.05, min: 0.4 }}
                      value={widthMeters}
                      onChange={(e) => setWidthMeters(parseFloat(e.target.value) || 0)}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={isWindow ? 4 : 6}>
                    <TextField
                      label="Altura de Hoja"
                      type="number"
                      inputProps={{ step: 0.05, min: 0.5 }}
                      value={heightMeters}
                      onChange={(e) => setHeightMeters(parseFloat(e.target.value) || 0)}
                      fullWidth
                    />
                  </Grid>
                  {isWindow && (
                    <Grid item xs={4}>
                      <TextField
                        label="Antepecho (Suelo a Alféizar)"
                        type="number"
                        inputProps={{ step: 0.05, min: 0 }}
                        value={sillHeightMeters ?? 0.9}
                        onChange={(e) => setSillHeightMeters(parseFloat(e.target.value) || 0)}
                        fullWidth
                        helperText="Cota inferior"
                      />
                    </Grid>
                  )}
                </Grid>
              </Box>

              {/* Mano de apertura y Material */}
              <Grid container spacing={1.5}>
                <Grid item xs={6}>
                  <TextField
                    select
                    label="Sentido / Mano de Apertura"
                    value={swingDirection}
                    onChange={(e) => setSwingDirection(e.target.value as SwingDirection)}
                    fullWidth
                  >
                    <MenuItem value="right">Mano Derecha (Batiente)</MenuItem>
                    <MenuItem value="left">Mano Izquierda (Batiente)</MenuItem>
                    <MenuItem value="double">Doble Batiente / Vaivén</MenuItem>
                    <MenuItem value="sliding">Corrediza / Deslizante</MenuItem>
                    <MenuItem value="overhead">Levadizo / Guillotina</MenuItem>
                    <MenuItem value="fixed">Fijo / Sin movimiento</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    select
                    label="Material de Carpintería"
                    value={material}
                    onChange={(e) => setMaterial(e.target.value as OpeningMaterial)}
                    fullWidth
                  >
                    <MenuItem value="wood">Madera / Cedro / Placa</MenuItem>
                    <MenuItem value="aluminum">Aluminio (Módena/A30)</MenuItem>
                    <MenuItem value="steel">Chapa / Hierro / Seguridad</MenuItem>
                    <MenuItem value="pvc">PVC con DVH</MenuItem>
                    <MenuItem value="glass">Vidrio Templado / Blindex</MenuItem>
                  </TextField>
                </Grid>
              </Grid>

              <Divider />

              {/* Atributos Eléctricos y Automatización */}
              <Box>
                <Typography variant="caption" fontWeight={600} color="text.secondary" gutterBottom display="block">
                  Instalaciones Especiales y Automatización
                </Typography>
                <Stack direction="row" spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={hasAutomation}
                        onChange={(e) => setHasAutomation(e.target.checked)}
                        color="primary"
                      />
                    }
                    label={
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <BoltIcon fontSize="small" color={hasAutomation ? 'primary' : 'disabled'} />
                        <Typography variant="body2">
                          Automatización (Portero / Cerradura / Motor)
                        </Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={hasElectricalPass}
                        onChange={(e) => setHasElectricalPass(e.target.checked)}
                        color="secondary"
                      />
                    }
                    label={
                      <Typography variant="body2">
                        Pase de Cañería Embutido
                      </Typography>
                    }
                  />
                </Stack>
              </Box>
            </>
          )}

          {isConduit && (
            /* Diámetro de Cañería para Vínculos Técnicos */
            <Grid container spacing={1.5}>
              <Grid item xs={12}>
                <TextField
                  select
                  label="Diámetro de Cañería / Pase"
                  value={ductDiameterMm || 19}
                  onChange={(e) => setDuctDiameterMm(parseInt(e.target.value))}
                  fullWidth
                >
                  <MenuItem value={19}>Ø 19 mm (3/4&quot;) - Estándar</MenuItem>
                  <MenuItem value={25}>Ø 25 mm (1&quot;) - Alimentador</MenuItem>
                  <MenuItem value={32}>Ø 32 mm (1 1/4&quot;) - Montante</MenuItem>
                  <MenuItem value={38}>Ø 38 mm (1 1/2&quot;)</MenuItem>
                  <MenuItem value={50}>Ø 50 mm (2&quot;)</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          )}

          {/* Notas */}
          <TextField
            label="Observaciones Técnicas"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: Marco de chapa 18, cerradura electromagnética 12V..."
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
          startIcon={<TuneIcon />}
        >
          Guardar Abertura
        </Button>
      </DialogActions>
    </Dialog>
  );
};
