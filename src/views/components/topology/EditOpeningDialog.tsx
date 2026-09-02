/**
 * View: EditOpeningDialog (Material 3)
 * Inspector y Editor de Muros Compartidos y Aberturas (BIM Space Boundaries).
 * Permite configurar:
 * 1. Material del tabique y espesor real (cm/m).
 * 2. Advertencias constructivas y de canalización eléctrica (AEA 90364-771: H°A°, Durlock, Ladrillo Hueco/Común).
 * 3. Múltiples Aberturas en la misma pared (0, 1 o varias: puertas, vanos, pasa-platos, ventanas).
 * 4. Pases y cruces técnicos de cañerías eléctricas.
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
  IconButton,
  Card,
  CardContent,
  Alert,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  ViewInAr as WallIcon,
  Delete as DeleteIcon,
  ElectricBolt as BoltIcon,
  Add as AddIcon,
  Tune as TuneIcon,
  Explore as CompassIcon,
  MeetingRoom as DoorIcon,
  WarningAmber as WarningIcon
} from '@mui/icons-material';
import {
  LogicalConnection,
  LogicalConnectionType,
  CONNECTION_TYPE_CATALOG,
  CANONICAL_OPENING_TYPES,
  SwingDirection,
  OpeningMaterial,
  TabiqueMaterialType,
  TABIQUE_MATERIAL_CATALOG,
  OpeningProperties,
  getConnectionOpenings,
  WALL_ORIENTATION_CATALOG
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { rooms, updateConnection, deleteConnection } = useSurveyViewModel();

  // Estados del Muro Compartido
  const [sourceWall, setSourceWall] = useState<WallOrientation>('east');
  const [targetWall, setTargetWall] = useState<WallOrientation>('west');
  const [materialType, setMaterialType] = useState<TabiqueMaterialType>('ladrillo_hueco_8');
  const [thicknessCm, setThicknessCm] = useState<number>(10);
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');

  // Estados de Aberturas Múltiples (0, 1 o N)
  const [openingsList, setOpeningsList] = useState<OpeningProperties[]>([]);

  // Invasión / Quiebre de Muro (Placares, Nichos, Duchas)
  const [invasionType, setInvasionType] = useState<'none' | 'source_invades_target' | 'target_invades_source'>('none');
  const [invasionDepth, setInvasionDepth] = useState<number>(0.60);
  const [invasionWidth, setInvasionWidth] = useState<number>(0);

  // Pases e Instalaciones Eléctricas
  const [hasElectricalPass, setHasElectricalPass] = useState(false);
  const [ductDiameterMm, setDuctDiameterMm] = useState<number>(19);

  useEffect(() => {
    if (connection) {
      setSourceWall(connection.sourceWall || 'east');
      setTargetWall(connection.targetWall || 'west');
      setLabel(connection.label || '');
      setNotes(connection.notes || '');
      setHasElectricalPass(Boolean(connection.hasElectricalPass));
      setDuctDiameterMm(connection.electricalDuctDiameterMm || connection.ductDiameterMm || 19);

      // Cargar material y espesor
      const mat = connection.wallProperties?.materialType || 'ladrillo_hueco_8';
      setMaterialType(mat);
      const th = connection.wallProperties?.thicknessMeters
        ? Math.round(connection.wallProperties.thicknessMeters * 100)
        : Math.round((TABIQUE_MATERIAL_CATALOG[mat]?.defaultThicknessMeters || 0.10) * 100);
      setThicknessCm(th);

      // Cargar invasión / quiebre
      const inv = connection.invasion;
      setInvasionType(inv?.type || 'none');
      setInvasionDepth(inv?.depthMeters || 0.60);
      setInvasionWidth(inv?.widthMeters || 0);

      // Cargar aberturas
      const ops = getConnectionOpenings(connection);
      setOpeningsList(ops.length > 0 ? [...ops] : []);
    }
  }, [connection]);

  if (!connection) return null;

  const sourceRoom = rooms.find((r) => r.id === connection.sourceRoomId);
  const targetRoom = rooms.find((r) => r.id === connection.targetRoomId);
  const matMeta = TABIQUE_MATERIAL_CATALOG[materialType] || TABIQUE_MATERIAL_CATALOG.ladrillo_hueco_8;

  const handleMaterialChange = (newMat: TabiqueMaterialType) => {
    setMaterialType(newMat);
    const meta = TABIQUE_MATERIAL_CATALOG[newMat];
    if (meta) {
      setThicknessCm(Math.round(meta.defaultThicknessMeters * 100));
    }
  };

  const handleAddOpening = () => {
    const newOpening: OpeningProperties = {
      id: `open-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      openingType: 'puerta_estandar',
      widthMeters: 0.80,
      heightMeters: 2.05,
      swingDirection: 'right',
      material: 'wood',
      offsetRatio: 0.5,
      label: 'Puerta Placa'
    };
    setOpeningsList([...openingsList, newOpening]);
  };

  const handleRemoveOpening = (index: number) => {
    setOpeningsList(openingsList.filter((_, idx) => idx !== index));
  };

  const handleUpdateOpening = (index: number, updates: Partial<OpeningProperties>) => {
    setOpeningsList(
      openingsList.map((op, idx) => {
        if (idx !== index) return op;
        const merged = { ...op, ...updates };
        if (updates.openingType && updates.openingType !== op.openingType) {
          const typeMeta = CONNECTION_TYPE_CATALOG[updates.openingType];
          if (typeMeta) {
            merged.widthMeters = typeMeta.defaultWidth;
            merged.heightMeters = typeMeta.defaultHeight;
            merged.sillHeightMeters = typeMeta.defaultSillHeight;
            if (typeMeta.defaultSwing) merged.swingDirection = typeMeta.defaultSwing;
          }
        }
        return merged;
      })
    );
  };

  const handleSave = () => {
    const primaryType: LogicalConnectionType =
      openingsList.length === 0
        ? 'pared_comun'
        : openingsList[0].openingType || 'puerta_estandar';

    const defaultLabel =
      openingsList.length === 0
        ? `🧱 Muro ${thicknessCm}cm`
        : openingsList.length === 1
        ? `${CONNECTION_TYPE_CATALOG[openingsList[0].openingType]?.emoji || '🚪'} ${openingsList[0].widthMeters}m`
        : `🧱 ${openingsList.length} Aberturas`;

    updateConnection(connection.id, {
      type: primaryType,
      label: label.trim() || defaultLabel,
      sourceWall,
      targetWall,
      sourceHandle: `source-${sourceWall}`,
      targetHandle: `target-${targetWall}`,
      wallProperties: {
        materialType,
        thicknessMeters: Number((thicknessCm / 100).toFixed(2)),
        canChase: matMeta.canChase,
        chasingMethod: matMeta.chasingMethod,
        notes: notes.trim() || undefined
      },
      invasion: invasionType !== 'none'
        ? {
            type: invasionType,
            depthMeters: invasionDepth > 0 ? Number(invasionDepth) : undefined,
            widthMeters: invasionWidth > 0 ? Number(invasionWidth) : undefined
          }
        : undefined,
      openings: openingsList,
      opening: openingsList[0],
      hasElectricalPass,
      electricalDuctDiameterMm: hasElectricalPass ? ductDiameterMm : undefined,
      ductDiameterMm: hasElectricalPass ? ductDiameterMm : undefined,
      notes: notes.trim()
    });

    onClose();
  };

  const handleDelete = () => {
    if (window.confirm('¿Eliminar este muro compartido / vínculo entre ambientes?')) {
      deleteConnection(connection.id);
      onClose();
    }
  };

  return (
    <Dialog
      fullScreen={isMobile}
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: isMobile ? 0 : 4, p: isMobile ? 0.5 : 1 } }}
    >
      <DialogTitle component="div" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box
            sx={{
              p: 1,
              bgcolor: '#e0f2fe',
              color: '#0284c7',
              borderRadius: 2.5,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <WallIcon />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Propiedades del Muro Compartido
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Linderos: <strong>{sourceRoom?.name}</strong> ↔ <strong>{targetRoom?.name}</strong>
            </Typography>
          </Box>
        </Stack>
        <IconButton color="error" size="small" onClick={handleDelete} title="Eliminar vínculo">
          <DeleteIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ mt: 0.5 }}>
          {/* 🧭 SECCIÓN 1: Orientación Espacial de Contacto */}
          <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 2.5, border: '1px solid #e2e8f0' }}>
            <Box display="flex" alignItems="center" gap={0.8} mb={1.2}>
              <CompassIcon fontSize="small" color="primary" />
              <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase">
                Orientación Espacial de las Caras en Contacto
              </Typography>
            </Box>
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label={`Pared en ${sourceRoom?.name || 'Origen'}`}
                  value={sourceWall}
                  onChange={(e) => setSourceWall(e.target.value as WallOrientation)}
                  fullWidth
                  size="small"
                >
                  {Object.values(WALL_ORIENTATION_CATALOG).filter(w => w.wall !== 'ceiling').map((w) => (
                    <MenuItem key={w.wall} value={w.wall}>
                      {w.emoji} {w.combinedLabel}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label={`Pared en ${targetRoom?.name || 'Destino'}`}
                  value={targetWall}
                  onChange={(e) => setTargetWall(e.target.value as WallOrientation)}
                  fullWidth
                  size="small"
                >
                  {Object.values(WALL_ORIENTATION_CATALOG).filter(w => w.wall !== 'ceiling').map((w) => (
                    <MenuItem key={w.wall} value={w.wall}>
                      {w.emoji} {w.combinedLabel}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
          </Box>

          {/* 🧱 SECCIÓN 2: Material Constructivo, Espesor e Impacto Eléctrico */}
          <Box sx={{ p: 2, bgcolor: '#ffffff', borderRadius: 3, border: '1px solid #cbd5e1' }}>
            <Typography variant="subtitle2" fontWeight={700} color="text.primary" gutterBottom display="flex" alignItems="center" gap={1}>
              <WallIcon fontSize="small" color="primary" /> Material Constructivo y Espesor del Tabique
            </Typography>

            <Grid container spacing={1.5} alignItems="center" mt={0.2}>
              <Grid item xs={12} sm={8}>
                <TextField
                  select
                  label="Tipo de Material / Tabique"
                  value={materialType}
                  onChange={(e) => handleMaterialChange(e.target.value as TabiqueMaterialType)}
                  fullWidth
                  size="small"
                >
                  {Object.values(TABIQUE_MATERIAL_CATALOG).map((mat) => (
                    <MenuItem key={mat.type} value={mat.type}>
                      <Box display="flex" justifyContent="space-between" width="100%" alignItems="center">
                        <span>{mat.emoji} {mat.label}</span>
                        <Chip
                          label={mat.electricalDifficultyLabel}
                          size="small"
                          variant="outlined"
                          color={!mat.canChase ? 'error' : mat.chasingMethod === 'en_seco' ? 'success' : 'default'}
                          sx={{ height: 20, fontSize: '0.68rem', ml: 1 }}
                        />
                      </Box>
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  label="Espesor de Muro (cm)"
                  type="number"
                  inputProps={{ step: 1, min: 3, max: 60 }}
                  value={thicknessCm}
                  onChange={(e) => setThicknessCm(parseFloat(e.target.value) || 10)}
                  fullWidth
                  size="small"
                  helperText={`${(thicknessCm / 100).toFixed(2)} m real`}
                />
              </Grid>
            </Grid>

            {/* Atajos Rápidos de Espesor */}
            <Stack direction="row" spacing={1} mt={1} alignItems="center">
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                Atajos:
              </Typography>
              {[7, 10, 15, 20, 30].map((th) => (
                <Chip
                  key={th}
                  label={`${th} cm`}
                  size="small"
                  onClick={() => setThicknessCm(th)}
                  variant={thicknessCm === th ? 'filled' : 'outlined'}
                  color={thicknessCm === th ? 'primary' : 'default'}
                  clickable
                  sx={{ height: 22, fontSize: '0.72rem' }}
                />
              ))}
            </Stack>

            {/* Advertencia Electrotécnica si el material tiene restricciones */}
            {matMeta.electricalWarning ? (
              <Alert severity="warning" icon={<WarningIcon />} sx={{ mt: 1.5, py: 0.5, fontSize: '0.8rem' }}>
                {matMeta.electricalWarning}
              </Alert>
            ) : (
              <Box sx={{ mt: 1.5, p: 1, bgcolor: '#f1f5f9', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  <strong>Trabajabilidad Eléctrica:</strong> {matMeta.electricalDifficultyLabel} • {matMeta.description}
                </Typography>
              </Box>
            )}
          </Box>

          {/* 🔲 SECCIÓN 3: Quiebre de Muro (Solo visible si hay quiebre activo por avance en el plano) */}
          {invasionType !== 'none' && (
            <Box sx={{ p: 2, bgcolor: '#f0fdf4', borderRadius: 3, border: '1px solid #bbf7d0' }}>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TuneIcon color="success" fontSize="small" />
                  <Typography variant="subtitle2" fontWeight={700} color="#166534">
                    Quiebre de Pared Común (Detectado por Solape)
                  </Typography>
                </Stack>
                <Chip
                  label="Quiebre Activo"
                  size="small"
                  color="success"
                  sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }}
                />
              </Box>

              <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                La pared común tomó forma por el avance de un ambiente sobre el otro en el plano. Podés ajustar las medidas exactas a mano para darle mayor precisión:
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Profundidad del Quiebre (m)"
                    type="number"
                    inputProps={{ step: 0.05, min: 0.05, max: 3.0 }}
                    value={invasionDepth === 0 ? '' : invasionDepth}
                    onChange={(e) => setInvasionDepth(parseFloat(e.target.value) || 0)}
                    fullWidth
                    size="small"
                    helperText="Profundidad de penetración en metros"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Ancho del Quiebre (m)"
                    type="number"
                    inputProps={{ step: 0.05, min: 0.1, max: 10.0 }}
                    value={invasionWidth === 0 ? '' : invasionWidth}
                    placeholder="Todo el tramo compartido"
                    onChange={(e) => setInvasionWidth(parseFloat(e.target.value) || 0)}
                    fullWidth
                    size="small"
                    helperText={invasionWidth > 0 ? `${invasionWidth}m de ancho` : 'Vacío = todo el contacto compartido'}
                  />
                </Grid>
              </Grid>

              <Box mt={1.5} display="flex" justifyContent="flex-end">
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => setInvasionType('none')}
                  sx={{ textTransform: 'none', fontSize: '0.72rem', color: '#64748b' }}
                >
                  Restablecer a Muro Recto
                </Button>
              </Box>
            </Box>
          )}

          {/* 🚪 SECCIÓN 4: Aberturas Hospedadas en este Muro (0, 1 o Varias) */}
          <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <DoorIcon color="primary" fontSize="small" />
                <Typography variant="subtitle2" fontWeight={700}>
                  Aberturas en este Muro ({openingsList.length})
                </Typography>
                {openingsList.length === 0 && (
                  <Chip label="Pared Ciega" size="small" color="default" sx={{ height: 20, fontSize: '0.68rem' }} />
                )}
              </Stack>
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddOpening}
                sx={{ borderRadius: 2, fontSize: '0.75rem', py: 0.4 }}
              >
                + Agregar Abertura
              </Button>
            </Box>

            {openingsList.length === 0 ? (
              <Card sx={{ p: 2, bgcolor: '#ffffff', border: '1px dashed #94a3b8', borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="body2" fontWeight={600} color="text.primary">
                  🧱 Tabique Ciego Compartido (Sin aberturas)
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                  Los ambientes comparten contacto constructivo directo en esta pared sin vanos ni puertas.
                  Hacé clic en &quot;+ Agregar Abertura&quot; si deseás colocar una puerta, ventana o pasa-platos.
                </Typography>
              </Card>
            ) : (
              <Stack spacing={1.5}>
                {openingsList.map((opening, idx) => {
                  const isWindow = opening.openingType === 'ventana_estandar' || opening.openingType === 'puerta_ventana';
                  const typeMeta = CONNECTION_TYPE_CATALOG[opening.openingType] || CONNECTION_TYPE_CATALOG.puerta_estandar;

                  return (
                    <Card key={opening.id || idx} variant="outlined" sx={{ borderRadius: 2.5, bgcolor: '#ffffff' }}>
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip
                              label={`Abertura #${idx + 1}`}
                              size="small"
                              color="primary"
                              sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }}
                            />
                            <Typography variant="body2" fontWeight={700}>
                              {typeMeta.emoji} {typeMeta.label}
                            </Typography>
                          </Stack>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleRemoveOpening(idx)}
                            title="Eliminar esta abertura"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>

                        <Grid container spacing={1.5} alignItems="center">
                          {/* Tipo de Abertura */}
                          <Grid item xs={12} sm={5}>
                            <TextField
                              select
                              label="Tipo de Carpintería"
                              value={opening.openingType}
                              onChange={(e) =>
                                handleUpdateOpening(idx, {
                                  openingType: e.target.value as LogicalConnectionType
                                })
                              }
                              fullWidth
                              size="small"
                            >
                              {CANONICAL_OPENING_TYPES.map((item) => (
                                <MenuItem key={item.type} value={item.type}>
                                  {item.emoji} {item.label}
                                </MenuItem>
                              ))}
                            </TextField>
                          </Grid>

                          {/* Ancho */}
                          <Grid item xs={6} sm={isWindow ? 2.3 : 3.5}>
                            <TextField
                              label="Ancho (m)"
                              type="number"
                              inputProps={{ step: 0.05, min: 0.4 }}
                              value={opening.widthMeters}
                              onChange={(e) =>
                                handleUpdateOpening(idx, {
                                  widthMeters: parseFloat(e.target.value) || 0.8
                                })
                              }
                              fullWidth
                              size="small"
                            />
                          </Grid>

                          {/* Altura */}
                          <Grid item xs={6} sm={isWindow ? 2.3 : 3.5}>
                            <TextField
                              label="Altura (m)"
                              type="number"
                              inputProps={{ step: 0.05, min: 0.5 }}
                              value={opening.heightMeters}
                              onChange={(e) =>
                                handleUpdateOpening(idx, {
                                  heightMeters: parseFloat(e.target.value) || 2.05
                                })
                              }
                              fullWidth
                              size="small"
                            />
                          </Grid>

                          {/* Antepecho si es ventana */}
                          {isWindow && (
                            <Grid item xs={12} sm={2.4}>
                              <TextField
                                label="Antepecho (m)"
                                type="number"
                                inputProps={{ step: 0.05, min: 0 }}
                                value={opening.sillHeightMeters ?? 0.9}
                                onChange={(e) =>
                                  handleUpdateOpening(idx, {
                                    sillHeightMeters: parseFloat(e.target.value) || 0
                                  })
                                }
                                fullWidth
                                size="small"
                              />
                            </Grid>
                          )}

                          {/* Mano de Apertura y Material */}
                          <Grid item xs={6} sm={6}>
                            <TextField
                              select
                              label="Sentido / Mano"
                              value={opening.swingDirection || 'right'}
                              onChange={(e) =>
                                handleUpdateOpening(idx, {
                                  swingDirection: e.target.value as SwingDirection
                                })
                              }
                              fullWidth
                              size="small"
                            >
                              <MenuItem value="right">Mano Derecha (Batiente)</MenuItem>
                              <MenuItem value="left">Mano Izquierda (Batiente)</MenuItem>
                              <MenuItem value="double">Doble Batiente / Vaivén</MenuItem>
                              <MenuItem value="sliding">Corrediza / Deslizante</MenuItem>
                              <MenuItem value="overhead">Levadizo / Guillotina</MenuItem>
                              <MenuItem value="fixed">Fijo / Sin movimiento</MenuItem>
                            </TextField>
                          </Grid>

                          <Grid item xs={6} sm={6}>
                            <TextField
                              select
                              label="Material Carpintería"
                              value={opening.material || 'wood'}
                              onChange={(e) =>
                                handleUpdateOpening(idx, {
                                  material: e.target.value as OpeningMaterial
                                })
                              }
                              fullWidth
                              size="small"
                            >
                              <MenuItem value="wood">Madera / Cedro / Placa</MenuItem>
                              <MenuItem value="aluminum">Aluminio (Módena/A30)</MenuItem>
                              <MenuItem value="steel">Chapa / Hierro / Seguridad</MenuItem>
                              <MenuItem value="pvc">PVC con DVH</MenuItem>
                              <MenuItem value="glass">Vidrio Templado / Blindex</MenuItem>
                            </TextField>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            )}
          </Box>

          {/* ⚡ SECCIÓN 4: Instalaciones Técnicas en Muro */}
          <Box sx={{ p: 1.5, bgcolor: '#ffffff', borderRadius: 2.5, border: '1px solid #e2e8f0' }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase" display="block" mb={1}>
              Instalaciones Especiales y Pases Técnicos
            </Typography>

            <Grid container spacing={1.5} alignItems="center">
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={hasElectricalPass}
                      onChange={(e) => setHasElectricalPass(e.target.checked)}
                      color="secondary"
                    />
                  }
                  label={
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <BoltIcon fontSize="small" color={hasElectricalPass ? 'secondary' : 'disabled'} />
                      <Typography variant="body2">
                        Pase de Cañería Embutido en Muro
                      </Typography>
                    </Box>
                  }
                />
              </Grid>

              {hasElectricalPass && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    label="Diámetro de Cañería / Pase"
                    value={ductDiameterMm}
                    onChange={(e) => setDuctDiameterMm(parseInt(e.target.value))}
                    fullWidth
                    size="small"
                  >
                    <MenuItem value={19}>Ø 19 mm (3/4&quot;) - Estándar</MenuItem>
                    <MenuItem value={25}>Ø 25 mm (1&quot;) - Alimentador</MenuItem>
                    <MenuItem value={32}>Ø 32 mm (1 1/4&quot;) - Montante</MenuItem>
                    <MenuItem value={38}>Ø 38 mm (1 1/2&quot;)</MenuItem>
                    <MenuItem value={50}>Ø 50 mm (2&quot;)</MenuItem>
                  </TextField>
                </Grid>
              )}
            </Grid>

            {/* Notas / Observaciones */}
            <TextField
              label="Observaciones Técnicas del Muro"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Aislación acústica, cerradura electromagnética, marco de chapa..."
              multiline
              rows={2}
              fullWidth
              size="small"
              sx={{ mt: 1.5 }}
            />
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions
        sx={{
          px: 2.5,
          py: 1.5,
          borderTop: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Button onClick={onClose} color="inherit">
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          startIcon={<TuneIcon />}
          sx={{ borderRadius: 2, fontWeight: 700, px: 2 }}
        >
          Guardar Propiedades de Muro
        </Button>
      </DialogActions>
    </Dialog>
  );
};
