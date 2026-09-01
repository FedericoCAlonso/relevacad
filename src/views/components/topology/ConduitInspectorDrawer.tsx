/**
 * View Component: ConduitInspectorDrawer (Material 3)
 * Panel Lateral / Drawer para inspeccionar y editar Cañerías Eléctricas y sus Cables Alojados:
 * - Soporte multicircuito (múltiples circuitos en un mismo caño)
 * - Retornos de iluminación y combinación
 * - Medidor de Factor de Ocupación según AEA 90364-771 (Máx 35%)
 * - Caída de tensión por circuito
 */

import React, { useState } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  Stack,
  Chip,
  Button,
  TextField,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  LinearProgress,
  Paper,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  ElectricBolt as BoltIcon
} from '@mui/icons-material';
import {
  TipoConductor,
  ColorAislacion,
  calculateConduitFillRatio
} from '@/models/ElectricalGraphModel';
import { useSurveyViewModel } from '@/viewmodels';

interface ConduitInspectorDrawerProps {
  open: boolean;
  onClose: () => void;
  tramoId: string | null;
}

const COLOR_MAP: Record<ColorAislacion, string> = {
  marron: '#854d0e',
  marrón: '#854d0e',
  negro: '#1e293b',
  rojo: '#dc2626',
  celeste: '#0284c7',
  verde_amarillo: '#16a34a',
  blanco: '#64748b',
  gris: '#475569'
};

const TIPO_CONDUCTOR_LABELS: Record<TipoConductor, { label: string; symbol: string; color: string }> = {
  fase: { label: 'Fase (L)', symbol: '/', color: '#b45309' },
  neutro: { label: 'Neutro (N)', symbol: 'o-', color: '#0284c7' },
  tierra_pe: { label: 'Tierra (PE)', symbol: 'T', color: '#16a34a' },
  retorno: { label: 'Retorno (R)', symbol: "'", color: '#7c3aed' },
  retorno_combinacion: { label: 'Ret. Combinación', symbol: "''", color: '#9333ea' },
  comando: { label: 'Comando / Señal', symbol: 'c', color: '#64748b' }
};

export const ConduitInspectorDrawer: React.FC<ConduitInspectorDrawerProps> = ({
  open,
  onClose,
  tramoId
}) => {
  const {
    electricalTramos,
    electricalNodes,
    rooms,
    updateTramoElectrico,
    deleteTramoElectrico,
    addConductorToTramo,
    removeConductorFromTramo
  } = useSurveyViewModel();

  // Estados para formulario de nuevo conductor
  const [newCircuito, setNewCircuito] = useState('C1-IUG');
  const [newTipo, setNewTipo] = useState<TipoConductor>('retorno');
  const [newSeccion, setNewSeccion] = useState<number>(1.5);
  const [newEtiqueta, setNewEtiqueta] = useState('');

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const tramo = electricalTramos.find((t) => t.id === tramoId);

  if (!tramo) return null;

  const sourceNode = electricalNodes.find((n) => n.id === tramo.sourceNodeId);
  const targetNode = electricalNodes.find((n) => n.id === tramo.targetNodeId);
  const sourceRoom = rooms.find((r) => r.id === sourceNode?.roomId);
  const targetRoom = rooms.find((r) => r.id === targetNode?.roomId);

  // Cálculos reglamentarios AEA 90364-771
  const fillStats = calculateConduitFillRatio(tramo);

  const handleAddQuickConductor = (
    circ: string,
    tipo: TipoConductor,
    seccion: number,
    color: ColorAislacion,
    etiqueta: string
  ) => {
    addConductorToTramo(tramo.id, {
      circuitoCodigo: circ,
      tipoConductor: tipo,
      seccionMm2: seccion,
      colorAislacion: color,
      etiqueta
    });
  };

  const handleAddCustomConductor = () => {
    let color: ColorAislacion = 'negro';
    if (newTipo === 'fase') color = 'marron';
    else if (newTipo === 'neutro') color = 'celeste';
    else if (newTipo === 'tierra_pe') color = 'verde_amarillo';

    addConductorToTramo(tramo.id, {
      circuitoCodigo: newCircuito.trim() || 'C1-IUG',
      tipoConductor: newTipo,
      seccionMm2: newSeccion,
      colorAislacion: color,
      etiqueta: newEtiqueta.trim() || undefined
    });
    setNewEtiqueta('');
  };

  const handleDeleteTramo = () => {
    if (window.confirm('¿Deseas eliminar este tramo de cañería y todos sus conductores?')) {
      deleteTramoElectrico(tramo.id);
      onClose();
    }
  };

  return (
    <Drawer
      anchor={isMobile ? 'bottom' : 'right'}
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: isMobile ? '100vw' : 420,
          maxHeight: isMobile ? '85vh' : '100vh',
          borderTopLeftRadius: isMobile ? 24 : 0,
          borderTopRightRadius: isMobile ? 24 : 0,
          p: isMobile ? 2 : 2.5,
          bgcolor: '#ffffff',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
        }
      }}
    >
      {/* Header del Inspector */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
        <Stack direction="row" spacing={1.2} alignItems="center">
          <Box
            sx={{
              p: 1,
              bgcolor: '#eff6ff',
              color: '#2563eb',
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <BoltIcon />
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              Cañería Ø{tramo.diametroCañoMm} mm
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {sourceRoom?.name || 'Origen'} ➔ {targetRoom?.name || 'Destino'}
            </Typography>
          </Box>
        </Stack>

        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Divider sx={{ my: 1.5 }} />

      {/* 📊 Gauge de Ocupación AEA 90364-771 */}
      <Paper
        elevation={0}
        sx={{
          p: 1.8,
          mb: 2.5,
          bgcolor: fillStats.isCompliant ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${fillStats.isCompliant ? '#bbf7d0' : '#fecaca'}`,
          borderRadius: 2.5
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Stack direction="row" spacing={0.8} alignItems="center">
            {fillStats.isCompliant ? (
              <CheckIcon color="success" fontSize="small" />
            ) : (
              <WarningIcon color="error" fontSize="small" />
            )}
            <Typography variant="body2" fontWeight={700} color={fillStats.isCompliant ? 'success.dark' : 'error.dark'}>
              Ocupación: {fillStats.fillRatioPct}% (Máx {fillStats.maxAllowedPct}%)
            </Typography>
          </Stack>
          <Chip
            label={fillStats.isCompliant ? 'Reglamentario AEA' : 'Sobreocupado'}
            size="small"
            color={fillStats.isCompliant ? 'success' : 'error'}
            variant="filled"
            sx={{ fontSize: '0.68rem', fontWeight: 700, height: 20 }}
          />
        </Box>

        <LinearProgress
          variant="determinate"
          value={Math.min(100, (fillStats.fillRatioPct / fillStats.maxAllowedPct) * 100)}
          color={fillStats.isCompliant ? 'success' : 'error'}
          sx={{ height: 6, borderRadius: 3, mb: 1 }}
        />

        <Typography variant="caption" color="text.secondary">
          Área cables: <strong>{fillStats.totalConductorAreaMm2} mm²</strong> • Área útil caño: <strong>{fillStats.innerConduitAreaMm2} mm²</strong>
        </Typography>
      </Paper>

      {/* 🛠️ Parámetros Físicos de la Cañería */}
      <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase" display="block" mb={1}>
        Propiedades de la Canalización
      </Typography>

      <Stack spacing={1.5} mb={2.5}>
        <TextField
          select
          label="Diámetro Nominal de Cañería"
          value={tramo.diametroCañoMm}
          onChange={(e) => updateTramoElectrico(tramo.id, { diametroCañoMm: Number(e.target.value) })}
          size="small"
          fullWidth
        >
          <MenuItem value={16}>Ø16 mm (5/8" - Derivaciones simples)</MenuItem>
          <MenuItem value={19}>Ø19 mm (3/4" - Estándar circuitos)</MenuItem>
          <MenuItem value={22}>Ø22 mm (7/8" - Multicircuito)</MenuItem>
          <MenuItem value={25}>Ø25 mm (1" - Acometidas / Troncales)</MenuItem>
          <MenuItem value={32}>Ø32 mm (1 1/4" - Montantes)</MenuItem>
          <MenuItem value={38}>Ø38 mm (1 1/2" - Alimentadores generales)</MenuItem>
        </TextField>

        <Stack direction="row" spacing={1.5}>
          <TextField
            label="Longitud Física (m)"
            type="number"
            inputProps={{ step: 0.5, min: 0.5 }}
            value={tramo.longitudMeters}
            onChange={(e) => updateTramoElectrico(tramo.id, { longitudMeters: Number(e.target.value) })}
            size="small"
            sx={{ flex: 1 }}
          />

          <TextField
            select
            label="Tipo de Montaje"
            value={tramo.tipoMontaje}
            onChange={(e) => updateTramoElectrico(tramo.id, { tipoMontaje: e.target.value as any })}
            size="small"
            sx={{ flex: 1.5 }}
          >
            <MenuItem value="embutido">Mampostería</MenuItem>
            <MenuItem value="losa">Embutido en Losa</MenuItem>
            <MenuItem value="a_la_vista">A la Vista</MenuItem>
            <MenuItem value="pleno_montante">Montante</MenuItem>
            <MenuItem value="bandeja">Bandeja</MenuItem>
          </TextField>
        </Stack>
      </Stack>

      <Divider sx={{ my: 1.5 }} />

      {/* 🔌 Conductores Alojados (Multicircuito y Retornos) */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase">
          Conductores Alojados ({tramo.conductores?.length || 0})
        </Typography>
        <Chip
          label={`${Array.from(new Set((tramo.conductores || []).map((c) => c.circuitoCodigo))).length} Circuitos`}
          size="small"
          variant="outlined"
          sx={{ fontSize: '0.68rem', height: 20 }}
        />
      </Box>

      {/* Lista de Cables */}
      <List dense sx={{ mb: 2, bgcolor: '#f8fafc', borderRadius: 2, p: 0.5, border: '1px solid #e2e8f0' }}>
        {(tramo.conductores || []).map((c) => {
          const typeMeta = TIPO_CONDUCTOR_LABELS[c.tipoConductor] || TIPO_CONDUCTOR_LABELS.fase;
          const colorDot = COLOR_MAP[c.colorAislacion || 'negro'] || '#1e293b';

          return (
            <ListItem
              key={c.id}
              secondaryAction={
                <IconButton
                  edge="end"
                  size="small"
                  onClick={() => removeConductorFromTramo(tramo.id, c.id)}
                  sx={{ color: '#94a3b8', '&:hover': { color: '#dc2626' } }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              }
              sx={{ py: 0.5, borderBottom: '1px solid #edf2f7', '&:last-child': { borderBottom: 'none' } }}
            >
              <ListItemIcon sx={{ minWidth: 26 }}>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: colorDot,
                    border: '1px solid #cbd5e1'
                  }}
                />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Stack direction="row" spacing={0.8} alignItems="center">
                    <Chip
                      label={c.circuitoCodigo}
                      size="small"
                      sx={{ fontSize: '0.68rem', fontWeight: 700, height: 18 }}
                    />
                    <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.78rem' }}>
                      {typeMeta.label} • {c.seccionMm2} mm²
                    </Typography>
                  </Stack>
                }
                secondary={c.etiqueta ? c.etiqueta : undefined}
                secondaryTypographyProps={{ variant: 'caption', fontSize: '0.7rem' }}
              />
            </ListItem>
          );
        })}
      </List>

      {/* ⚡ Accesos Rápidos para Agregar Conductores Frecuentes */}
      <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={0.8}>
        Agregar Rápido a Cañería:
      </Typography>

      <Stack direction="row" spacing={0.8} flexWrap="wrap" gap={0.5} mb={2}>
        <Chip
          icon={<AddIcon fontSize="small" />}
          label="+ Retorno Luz (1.5mm²)"
          size="small"
          onClick={() => handleAddQuickConductor('C1-IUG', 'retorno', 1.5, 'negro', 'Retorno Interruptor')}
          clickable
          color="secondary"
          variant="outlined"
          sx={{ fontSize: '0.72rem' }}
        />
        <Chip
          icon={<AddIcon fontSize="small" />}
          label="+ Ret. Combinación"
          size="small"
          onClick={() => handleAddQuickConductor('C1-IUG', 'retorno_combinacion', 1.5, 'blanco', 'Retorno Combinación')}
          clickable
          color="secondary"
          variant="outlined"
          sx={{ fontSize: '0.72rem' }}
        />
        <Chip
          icon={<AddIcon fontSize="small" />}
          label="+ Par C2-TUG (F+N 2.5mm²)"
          size="small"
          onClick={() => {
            handleAddQuickConductor('C2-TUG', 'fase', 2.5, 'marron', 'Fase C2');
            handleAddQuickConductor('C2-TUG', 'neutro', 2.5, 'celeste', 'Neutro C2');
          }}
          clickable
          color="primary"
          variant="outlined"
          sx={{ fontSize: '0.72rem' }}
        />
        <Chip
          icon={<AddIcon fontSize="small" />}
          label="+ Tierra PE (2.5mm²)"
          size="small"
          onClick={() => handleAddQuickConductor('PE', 'tierra_pe', 2.5, 'verde_amarillo', 'Protección PE')}
          clickable
          color="success"
          variant="outlined"
          sx={{ fontSize: '0.72rem' }}
        />
      </Stack>

      {/* Formulario de Conductor Personalizado */}
      <Paper elevation={0} sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0', mb: 2 }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={1}>
          Personalizado:
        </Typography>
        <Stack spacing={1}>
          <Stack direction="row" spacing={1}>
            <TextField
              label="Circuito"
              value={newCircuito}
              onChange={(e) => setNewCircuito(e.target.value)}
              size="small"
              sx={{ flex: 1 }}
            />
            <TextField
              select
              label="Tipo"
              value={newTipo}
              onChange={(e) => setNewTipo(e.target.value as TipoConductor)}
              size="small"
              sx={{ flex: 1.2 }}
            >
              <MenuItem value="fase">Fase (L)</MenuItem>
              <MenuItem value="neutro">Neutro (N)</MenuItem>
              <MenuItem value="tierra_pe">Tierra (PE)</MenuItem>
              <MenuItem value="retorno">Retorno (R)</MenuItem>
              <MenuItem value="retorno_combinacion">Ret. Combinación</MenuItem>
              <MenuItem value="comando">Comando</MenuItem>
            </TextField>
            <TextField
              select
              label="Sección"
              value={newSeccion}
              onChange={(e) => setNewSeccion(Number(e.target.value))}
              size="small"
              sx={{ width: 85 }}
            >
              <MenuItem value={1.5}>1.5</MenuItem>
              <MenuItem value={2.5}>2.5</MenuItem>
              <MenuItem value={4.0}>4.0</MenuItem>
              <MenuItem value={6.0}>6.0</MenuItem>
            </TextField>
          </Stack>
          <TextField
            label="Etiqueta / Función (ej: Retorno Centro)"
            value={newEtiqueta}
            onChange={(e) => setNewEtiqueta(e.target.value)}
            size="small"
            fullWidth
          />
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleAddCustomConductor}
            sx={{ fontWeight: 600 }}
          >
            Agregar Cable al Caño
          </Button>
        </Stack>
      </Paper>

      {/* Botón de Eliminar Tramo */}
      <Box mt="auto" pt={2}>
        <Button
          fullWidth
          color="error"
          variant="outlined"
          startIcon={<DeleteIcon />}
          onClick={handleDeleteTramo}
          size="small"
          sx={{ fontWeight: 600 }}
        >
          Eliminar Tramo de Cañería
        </Button>
      </Box>
    </Drawer>
  );
};
