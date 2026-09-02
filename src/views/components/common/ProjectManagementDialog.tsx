/**
 * View Component: ProjectManagementDialog (Material 3)
 * Gestión de Proyectos, Clientes y Persistencia Local en IndexedDB (Dexie.js),
 * con exportación interoperable directa a Cotizador IEBA.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Stack,
  Tabs,
  Tab,
  Card,
  CardContent,
  Chip,
  IconButton,
  Grid,
  Alert,
  MenuItem,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  Folder as ProjectIcon,
  Person as ClientIcon,
  Save as SaveIcon,
  CloudDownload as ExportIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckIcon,
  Description as FileIcon,
  Explore as CompassIcon,
  WbSunny as SunIcon
} from '@mui/icons-material';
import { useSurveyViewModel } from '@/viewmodels';
import { getAllProjects, deleteProject } from '@/db/database';
import { RelevamientoProyecto, RumboCardinal, RUMBOS_SOLARES_CATALOG } from '@/models/ProjectModel';

interface ProjectManagementDialogProps {
  open: boolean;
  onClose: () => void;
}

export const ProjectManagementDialog: React.FC<ProjectManagementDialogProps> = ({
  open,
  onClose
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const {
    currentProjectId,
    currentProjectName,
    clienteInfo,
    ubicacionObra,
    descripcionObra,
    rumboFrente: storeRumboFrente,
    azimutGrados: storeAzimutGrados,
    lastSavedAt,
    setProjectMetadata,
    setClienteInfo,
    saveCurrentProjectToDB,
    loadProjectFromDB,
    createNewProject,
    exportProjectToCotizadorJSON,
    loadSampleData
  } = useSurveyViewModel();

  const [tabIndex, setTabIndex] = useState<number>(0);
  const [savedProjects, setSavedProjects] = useState<RelevamientoProyecto[]>([]);

  // Estados locales para el formulario de cliente y obra
  const [nombreProyecto, setNombreProyecto] = useState(currentProjectName);
  const [ubicacion, setUbicacion] = useState(ubicacionObra);
  const [descripcion, setDescripcion] = useState(descripcionObra);
  const [rumboFrente, setRumboFrente] = useState<RumboCardinal>(storeRumboFrente || 'Norte');
  const [azimutGrados, setAzimutGrados] = useState<number>(storeAzimutGrados || 0);

  const [clienteNombre, setClienteNombre] = useState(clienteInfo.nombre);
  const [clienteTelefono, setClienteTelefono] = useState(clienteInfo.telefono || '');
  const [clienteEmail, setClienteEmail] = useState(clienteInfo.email || '');
  const [clienteDireccion, setClienteDireccion] = useState(clienteInfo.direccion || '');
  const [clienteCuitDni, setClienteCuitDni] = useState(clienteInfo.cuitDni || '');

  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Recargar proyectos guardados cuando se abre el diálogo
  const refreshProjectsList = async () => {
    try {
      const list = await getAllProjects();
      setSavedProjects(list);
    } catch (err) {
      console.warn('Error al cargar lista de proyectos:', err);
    }
  };

  useEffect(() => {
    if (open) {
      setNombreProyecto(currentProjectName);
      setUbicacion(ubicacionObra);
      setDescripcion(descripcionObra);
      setRumboFrente(storeRumboFrente || 'Norte');
      setAzimutGrados(storeAzimutGrados || 0);
      setClienteNombre(clienteInfo.nombre);
      setClienteTelefono(clienteInfo.telefono || '');
      setClienteEmail(clienteInfo.email || '');
      setClienteDireccion(clienteInfo.direccion || '');
      setClienteCuitDni(clienteInfo.cuitDni || '');
      refreshProjectsList();
      setFeedbackMsg(null);
    }
  }, [open, currentProjectName, ubicacionObra, descripcionObra, storeRumboFrente, storeAzimutGrados, clienteInfo]);

  const handleSaveData = async () => {
    setProjectMetadata({
      nombre: nombreProyecto.trim() || 'Relevamiento sin nombre',
      ubicacion: ubicacion.trim(),
      descripcion: descripcion.trim(),
      rumboFrente,
      azimutGrados
    });

    setClienteInfo({
      nombre: clienteNombre.trim() || 'Cliente sin asignar',
      telefono: clienteTelefono.trim(),
      email: clienteEmail.trim(),
      direccion: clienteDireccion.trim(),
      cuitDni: clienteCuitDni.trim()
    });

    await saveCurrentProjectToDB();
    await refreshProjectsList();
    setFeedbackMsg('Datos guardados correctamente en la base de datos local (IndexedDB).');
  };

  const handleCreateNew = () => {
    if (window.confirm('¿Deseas iniciar un nuevo relevamiento en blanco? Los cambios actuales están guardados en tu dispositivo.')) {
      createNewProject('Nuevo Relevamiento', 'Nuevo Cliente');
      onClose();
    }
  };

  const handleLoadProject = async (projId: string) => {
    await loadProjectFromDB(projId);
    onClose();
  };

  const handleDeleteProject = async (projId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('¿Eliminar este relevamiento de la memoria local?')) {
      await deleteProject(projId);
      await refreshProjectsList();
    }
  };

  const handleExportCotizador = () => {
    exportProjectToCotizadorJSON();
    setFeedbackMsg('Descargando archivo .ieba.json con el cómputo de materiales y bocas.');
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
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              p: 1,
              borderRadius: 2.5,
              bgcolor: '#fef3c7',
              color: '#b45309',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <ProjectIcon />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Gestión de Obra, Cliente y Cotizador IEBA
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Persistencia local en IndexedDB (Dexie.js) y sincronización
            </Typography>
          </Box>
        </Stack>

        {lastSavedAt && (
          <Chip
            icon={<CheckIcon fontSize="small" />}
            label={`Guardado ${lastSavedAt}`}
            size="small"
            color="success"
            variant="outlined"
            sx={{ fontSize: '0.72rem' }}
          />
        )}
      </DialogTitle>

      {/* Selector de Pestañas */}
      <Box sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} variant="fullWidth">
          <Tab icon={<ClientIcon fontSize="small" />} iconPosition="start" label="Datos de Obra y Cliente" />
          <Tab icon={<FileIcon fontSize="small" />} iconPosition="start" label={`Mis Proyectos (${savedProjects.length})`} />
        </Tabs>
      </Box>

      <DialogContent dividers sx={{ p: isMobile ? 1.5 : 2.5 }}>
        {feedbackMsg && (
          <Alert severity="success" sx={{ mb: 2, py: 0.5, fontSize: '0.82rem' }} onClose={() => setFeedbackMsg(null)}>
            {feedbackMsg}
          </Alert>
        )}

        {/* ─── PESTAÑA 1: DATOS DE OBRA Y CLIENTE ────────────────────── */}
        {tabIndex === 0 && (
          <Stack spacing={2.5}>
            {/* Ficha de la Obra */}
            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 3, border: '1px solid #e2e8f0' }}>
              <Typography variant="subtitle2" fontWeight={700} color="primary" mb={1.5}>
                📍 Datos del Inmueble / Relevamiento
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Nombre del Relevamiento"
                    value={nombreProyecto}
                    onChange={(e) => setNombreProyecto(e.target.value)}
                    fullWidth
                    size="small"
                    helperText="Ej: Depto 3 Ambientes, Casa Barrio Norte"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Dirección / Ubicación de la Obra"
                    value={ubicacion}
                    onChange={(e) => setUbicacion(e.target.value)}
                    fullWidth
                    size="small"
                    helperText="Ej: Av. Corrientes 2450, 3° B"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Observaciones Técnicas de la Obra"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    multiline
                    rows={2}
                    fullWidth
                    size="small"
                    placeholder="Detalles sobre montantes, cañerías existentes, tableros o particularidades..."
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Orientación Geográfica y Solar (Paneles Fotovoltaicos) */}
            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 3, border: '1px solid #e2e8f0' }}>
              <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
                <CompassIcon color="primary" fontSize="small" />
                <Typography variant="subtitle2" fontWeight={700} color="primary">
                  🧭 Orientación Geográfica y Solar (Norte Real / Fotovoltaica)
                </Typography>
              </Stack>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    label="Orientación del Frente (Calle)"
                    value={rumboFrente}
                    onChange={(e) => {
                      const newRumbo = e.target.value as RumboCardinal;
                      setRumboFrente(newRumbo);
                      setAzimutGrados(RUMBOS_SOLARES_CATALOG[newRumbo]?.azimutGrados ?? 0);
                    }}
                    fullWidth
                    size="small"
                  >
                    {Object.values(RUMBOS_SOLARES_CATALOG).map((item) => (
                      <MenuItem key={item.rumbo} value={item.rumbo}>
                        {item.emoji} {item.rumbo} ({item.azimutGrados}°)
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Ángulo de Acimut Solar (°)"
                    type="number"
                    inputProps={{ min: 0, max: 360, step: 1 }}
                    value={azimutGrados}
                    onChange={(e) => setAzimutGrados(Number(e.target.value) || 0)}
                    fullWidth
                    size="small"
                    helperText="0° = Norte, 90° = Este, 180° = Sur, 270° = Oeste"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ p: 1.2, bgcolor: '#fef3c7', borderRadius: 2, border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SunIcon sx={{ color: '#d97706', fontSize: 20 }} />
                    <Typography variant="caption" color="#92400e">
                      <strong>Aprovechamiento Solar (Hemisferio Sur):</strong> {RUMBOS_SOLARES_CATALOG[rumboFrente]?.aprovechamientoSolarHemisferioSur || 'Óptimo para captación solar'}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>

            {/* Ficha del Cliente */}
            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 3, border: '1px solid #e2e8f0' }}>
              <Typography variant="subtitle2" fontWeight={700} color="primary" mb={1.5}>
                👤 Datos del Cliente (Compatibles con Cotizador IEBA)
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Nombre del Cliente / Contacto"
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                    fullWidth
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Teléfono / WhatsApp"
                    value={clienteTelefono}
                    onChange={(e) => setClienteTelefono(e.target.value)}
                    fullWidth
                    size="small"
                    placeholder="+54 9 11 ..."
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Email"
                    value={clienteEmail}
                    onChange={(e) => setClienteEmail(e.target.value)}
                    fullWidth
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="CUIT / DNI"
                    value={clienteCuitDni}
                    onChange={(e) => setClienteCuitDni(e.target.value)}
                    fullWidth
                    size="small"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Domicilio del Cliente"
                    value={clienteDireccion}
                    onChange={(e) => setClienteDireccion(e.target.value)}
                    fullWidth
                    size="small"
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Banner de Exportación a Cotizador IEBA */}
            <Box
              sx={{
                p: 2,
                borderRadius: 3,
                bgcolor: '#fffbeb',
                border: '1px solid #fde68a',
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
                gap: 1.5
              }}
            >
              <Box>
                <Typography variant="subtitle2" fontWeight={700} color="#92400e">
                  ⚡ Interoperabilidad Cotizador IEBA (.ieba.json)
                </Typography>
                <Typography variant="caption" color="#b45309">
                  Genera el cómputo métrico listo para importar en Cotizador IEBA (metros de caño, cables, bocas y tabiques).
                </Typography>
              </Box>
              <Button
                variant="contained"
                color="warning"
                startIcon={<ExportIcon />}
                onClick={handleExportCotizador}
                sx={{ borderRadius: 2.5, fontWeight: 700, textTransform: 'none', px: 2 }}
              >
                Exportar a Cotizador
              </Button>
            </Box>
          </Stack>
        )}

        {/* ─── PESTAÑA 2: LISTADO DE PROYECTOS GUARDADOS ──────────────── */}
        {tabIndex === 1 && (
          <Stack spacing={2}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2" fontWeight={700}>
                Proyectos en este Dispositivo (IndexedDB)
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={handleCreateNew}
                sx={{ borderRadius: 2 }}
              >
                + Nuevo Relevamiento
              </Button>
            </Box>

            {savedProjects.length === 0 ? (
              <Box textAlign="center" py={4}>
                <Typography variant="body2" color="text.secondary">
                  No hay otros proyectos guardados en este dispositivo.
                </Typography>
                <Button variant="text" size="small" onClick={loadSampleData} sx={{ mt: 1 }}>
                  Cargar Departamento de Demostración (3 Ambientes)
                </Button>
              </Box>
            ) : (
              <Stack spacing={1.5}>
                {savedProjects.map((proj) => {
                  const isCurrent = proj.id === currentProjectId;
                  return (
                    <Card
                      key={proj.id}
                      variant="outlined"
                      sx={{
                        borderRadius: 3,
                        borderColor: isCurrent ? 'primary.main' : 'divider',
                        bgcolor: isCurrent ? '#f0f9ff' : 'background.paper',
                        transition: 'all 0.2s',
                        '&:hover': { borderColor: 'primary.light', boxShadow: 1 }
                      }}
                    >
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                          <Box>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="subtitle1" fontWeight={700}>
                                {proj.nombre}
                              </Typography>
                              {isCurrent && (
                                <Chip label="En Edición" size="small" color="primary" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }} />
                              )}
                            </Stack>
                            <Typography variant="caption" color="text.secondary" display="block">
                              👤 {proj.clienteNombre || 'Sin cliente asignado'} • 📍 {proj.ubicacion || 'Sin ubicación'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              🏠 {proj.rooms?.length || 0} Ambientes • ⚡ {proj.electricalNodes?.length || 0} Nodos • 🕒 {new Date(proj.updatedAt).toLocaleDateString()} {new Date(proj.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Typography>
                          </Box>

                          <Stack direction="row" spacing={1} alignItems="center">
                            {!isCurrent && (
                              <Button
                                variant="contained"
                                size="small"
                                onClick={() => handleLoadProject(proj.id)}
                                sx={{ borderRadius: 2, textTransform: 'none' }}
                              >
                                Abrir
                              </Button>
                            )}
                            <IconButton
                              size="small"
                              color="error"
                              onClick={(e) => handleDeleteProject(proj.id, e)}
                              title="Eliminar este proyecto"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </Box>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
        <Button onClick={onClose} color="inherit">
          Cerrar
        </Button>
        {tabIndex === 0 && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={handleSaveData}
            sx={{ borderRadius: 2.5, px: 3, fontWeight: 700 }}
          >
            Guardar Ficha
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
