/**
 * View: EditTramoDialog (Material 3)
 * Diálogo para editar las propiedades técnicas del tramo eléctrico / canalización
 * (Metros lineales, Sección de conductores mm², Diámetro de cañería, Aislación, Caída de tensión).
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
  Chip,
  IconButton,
  Card,
  CardContent
} from '@mui/material';
import {
  Cable as CableIcon,
  Delete as DeleteIcon,
  ElectricBolt as BoltIcon,
  Calculate as CalcIcon
} from '@mui/icons-material';
import { TramoElectrico } from '@/models/ElectricalGraphModel';
import { useSurveyViewModel } from '@/viewmodels';

interface EditTramoDialogProps {
  open: boolean;
  onClose: () => void;
  tramo: TramoElectrico | null;
}

export const EditTramoDialog: React.FC<EditTramoDialogProps> = ({
  open,
  onClose,
  tramo
}) => {
  const {
    electricalNodes,
    rooms,
    updateTramoElectrico,
    deleteTramoElectrico
  } = useSurveyViewModel();

  const [longitudMeters, setLongitudMeters] = useState(5.0);
  const [seccionMm2, setSeccionMm2] = useState(2.5);
  const [seccionPeMm2, setSeccionPeMm2] = useState(2.5);
  const [cantidadConductores, setCantidadConductores] = useState(3);
  const [materialConductor, setMaterialConductor] = useState<'Cu' | 'Al'>('Cu');
  const [tipoAislacion, setTipoAislacion] = useState<'PVC' | 'XLPE' | 'LSOH' | 'IRAM2178'>('PVC');
  const [diametroCañoMm, setDiametroCañoMm] = useState(19);
  const [tipoMontaje, setTipoMontaje] = useState<'embutido' | 'losa' | 'a_la_vista' | 'subterraneo' | 'bandeja' | 'pleno_montante'>('embutido');
  const [circuitoCodigo, setCircuitoCodigo] = useState('C1-IUG');
  const [tensionV, setTensionV] = useState(220);
  const [notas, setNotas] = useState('');

  useEffect(() => {
    if (tramo) {
      setLongitudMeters(tramo.longitudMeters || 5.0);
      setSeccionMm2(tramo.seccionMm2 || 2.5);
      setSeccionPeMm2(tramo.seccionPeMm2 || tramo.seccionMm2 || 2.5);
      setCantidadConductores(tramo.cantidadConductores || tramo.conductores?.length || 3);
      setMaterialConductor(tramo.materialConductor || 'Cu');
      setTipoAislacion(tramo.tipoAislacion || 'PVC');
      setDiametroCañoMm(tramo.diametroCañoMm || 19);
      setTipoMontaje(tramo.tipoMontaje || 'embutido');
      setCircuitoCodigo(tramo.circuitoCodigo || 'C1-IUG');
      setTensionV(tramo.tensionV || 220);
      setNotas(tramo.notas || '');
    }
  }, [tramo]);

  if (!tramo) return null;

  const sourceNode = electricalNodes.find((n) => n.id === tramo.sourceNodeId);
  const targetNode = electricalNodes.find((n) => n.id === tramo.targetNodeId);
  const sourceRoom = rooms.find((r) => r.id === sourceNode?.roomId);
  const targetRoom = rooms.find((r) => r.id === targetNode?.roomId);

  // Estimación técnica de resistencia y caída de tensión (Ley de Ohm / AEA):
  // R = (rho * 2 * L) / S con rho_Cu = 0.0178 ohm*mm2/m
  // Suponiendo corriente nominal según sección (ej: 2.5mm2 -> 16A, 4mm2 -> 20A, 6mm2 -> 25A, 1.5mm2 -> 10A)
  const currentAssumed = seccionMm2 === 1.5 ? 10 : seccionMm2 === 2.5 ? 16 : seccionMm2 === 4 ? 20 : seccionMm2 === 6 ? 25 : 32;
  const resistanceOhm = (0.0178 * 2 * longitudMeters) / seccionMm2;
  const deltaV = resistanceOhm * currentAssumed;
  const deltaVPct = ((deltaV / tensionV) * 100).toFixed(2);

  const handleSave = () => {
    updateTramoElectrico(tramo.id, {
      longitudMeters,
      seccionMm2,
      seccionPeMm2,
      cantidadConductores,
      materialConductor,
      tipoAislacion,
      diametroCañoMm,
      tipoMontaje,
      circuitoCodigo: circuitoCodigo.trim(),
      tensionV,
      notas: notas.trim()
    });
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm('¿Eliminar este tramo de canalización eléctrica?')) {
      deleteTramoElectrico(tramo.id);
      onClose();
    }
  };

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
          <CableIcon color="primary" />
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Canalización y Conductores Eléctricos
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {sourceNode?.etiqueta} ({sourceRoom?.name}) ➔ {targetNode?.etiqueta} ({targetRoom?.name})
            </Typography>
          </Box>
        </Stack>
        <IconButton color="error" size="small" onClick={handleDelete} title="Eliminar tramo">
          <DeleteIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {/* Tarjeta de Estimación Técnica (Caída de Tensión) */}
          <Card sx={{ bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box display="flex" alignItems="center" gap={1}>
                  <CalcIcon color="success" fontSize="small" />
                  <Typography variant="body2" fontWeight={600} color="#065f46">
                    Caída de Tensión Estimada (a plena carga): <strong>{deltaVPct}% ({deltaV.toFixed(2)}V)</strong>
                  </Typography>
                </Box>
                <Chip
                  label={parseFloat(deltaVPct) <= 3.0 ? '✓ Cumple AEA (≤3%)' : '⚠️ Excede 3%'}
                  color={parseFloat(deltaVPct) <= 3.0 ? 'success' : 'warning'}
                  size="small"
                  sx={{ fontWeight: 700, height: 20 }}
                />
              </Box>
            </CardContent>
          </Card>

          {/* Identificador de Circuito y Tensión */}
          <Grid container spacing={1.5}>
            <Grid item xs={7}>
              <TextField
                label="Identificador de Circuito / Alimentador"
                value={circuitoCodigo}
                onChange={(e) => setCircuitoCodigo(e.target.value)}
                placeholder="Ej: ALIM-GRAL, C1-IUG, C2-TUG, C3-TUE"
                fullWidth
              />
            </Grid>
            <Grid item xs={5}>
              <TextField
                select
                label="Tensión Nominal"
                value={tensionV}
                onChange={(e) => setTensionV(parseInt(e.target.value))}
                fullWidth
              >
                <MenuItem value={220}>220 V (Monofásico)</MenuItem>
                <MenuItem value={380}>380 V (Trifásico)</MenuItem>
              </TextField>
            </Grid>
          </Grid>

          {/* Longitud y Sección */}
          <Grid container spacing={1.5}>
            <Grid item xs={6}>
              <TextField
                label="Longitud Estimada (Metros)"
                type="number"
                inputProps={{ step: 0.5, min: 0.5 }}
                value={longitudMeters}
                onChange={(e) => setLongitudMeters(parseFloat(e.target.value) || 0)}
                fullWidth
                helperText="Distancia real de cañería"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                select
                label="Sección del Conductor (mm²)"
                value={seccionMm2}
                onChange={(e) => {
                  const s = parseFloat(e.target.value);
                  setSeccionMm2(s);
                  setSeccionPeMm2(s);
                }}
                fullWidth
              >
                <MenuItem value={1.5}>1.5 mm² (Iluminación IUG)</MenuItem>
                <MenuItem value={2.5}>2.5 mm² (Tomas TUG)</MenuItem>
                <MenuItem value={4.0}>4.0 mm² (Tomas Especiales TUE)</MenuItem>
                <MenuItem value={6.0}>6.0 mm² (Alimentador Seccional)</MenuItem>
                <MenuItem value={10.0}>10.0 mm² (Alimentador Principal)</MenuItem>
                <MenuItem value={16.0}>16.0 mm² (Troncal Edificio)</MenuItem>
                <MenuItem value={25.0}>25.0 mm² (Acometida Industrial)</MenuItem>
              </TextField>
            </Grid>
          </Grid>

          {/* Cantidad de Conductores, Aislación y Tierra */}
          <Grid container spacing={1.5}>
            <Grid item xs={4}>
              <TextField
                select
                label="Conductores"
                value={cantidadConductores}
                onChange={(e) => setCantidadConductores(parseInt(e.target.value))}
                fullWidth
              >
                <MenuItem value={2}>2 (F + N)</MenuItem>
                <MenuItem value={3}>3 (F + N + PE)</MenuItem>
                <MenuItem value={4}>4 (3F + N)</MenuItem>
                <MenuItem value={5}>5 (3F + N + PE)</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={4}>
              <TextField
                select
                label="Material"
                value={materialConductor}
                onChange={(e) => setMaterialConductor(e.target.value as 'Cu' | 'Al')}
                fullWidth
              >
                <MenuItem value="Cu">Cobre (Cu)</MenuItem>
                <MenuItem value="Al">Aluminio (Al)</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={4}>
              <TextField
                select
                label="Tipo Aislación"
                value={tipoAislacion}
                onChange={(e) => setTipoAislacion(e.target.value as 'PVC' | 'XLPE' | 'LSOH' | 'IRAM2178')}
                fullWidth
              >
                <MenuItem value="PVC">PVC (VN 2000)</MenuItem>
                <MenuItem value="LSOH">LSOH (Libre Halógenos)</MenuItem>
                <MenuItem value="XLPE">XLPE (Polietileno)</MenuItem>
                <MenuItem value="IRAM2178">IRAM 2178 (Subterráneo)</MenuItem>
              </TextField>
            </Grid>
          </Grid>

          {/* Cañería e Infraestructura */}
          <Grid container spacing={1.5}>
            <Grid item xs={6}>
              <TextField
                select
                label="Diámetro de Cañería"
                value={diametroCañoMm}
                onChange={(e) => setDiametroCañoMm(parseInt(e.target.value))}
                fullWidth
              >
                <MenuItem value={19}>Ø 19 mm (3/4&quot;) - Estándar</MenuItem>
                <MenuItem value={22}>Ø 22 mm (7/8&quot;)</MenuItem>
                <MenuItem value={25}>Ø 25 mm (1&quot;) - Alimentador</MenuItem>
                <MenuItem value={32}>Ø 32 mm (1 1/4&quot;) - Montante</MenuItem>
                <MenuItem value={38}>Ø 38 mm (1 1/2&quot;)</MenuItem>
                <MenuItem value={50}>Ø 50 mm (2&quot;)</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                select
                label="Tipo de Montaje"
                value={tipoMontaje}
                onChange={(e) => setTipoMontaje(e.target.value as 'embutido' | 'a_la_vista' | 'subterraneo' | 'bandeja' | 'pleno_montante')}
                fullWidth
              >
                <MenuItem value="embutido">Embutido en Muro / Losa</MenuItem>
                <MenuItem value="pleno_montante">Pleno / Montante Vertical</MenuItem>
                <MenuItem value="a_la_vista">Caño Rígido a la Vista</MenuItem>
                <MenuItem value="bandeja">Bandeja Portacables</MenuItem>
                <MenuItem value="subterraneo">Subterráneo / Zanja</MenuItem>
              </TextField>
            </Grid>
          </Grid>

          {/* Observaciones */}
          <TextField
            label="Notas Técnicas"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Ej: Cañería compartida en montante, conductores IRAM 62267..."
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
          startIcon={<BoltIcon />}
        >
          Guardar Canalización
        </Button>
      </DialogActions>
    </Dialog>
  );
};
