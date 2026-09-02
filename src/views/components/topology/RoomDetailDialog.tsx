/**
 * View Component: RoomDetailDialog (Material 3 Mobile Modal / Bottom Sheet)
 * Muestra el detalle completo de un espacio en móvil al tocar un nodo del grafo topológico:
 * - Dimensiones y superficie
 * - Bocas y componentes eléctricos por pared
 * - Accesos directos a agregar bocas, editar cotas o eliminar
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Chip,
  Stack,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Close as CloseIcon,
  ElectricBolt as BoltIcon,
  Tune as ParamIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  MeetingRoom as RoomIcon,
  DoorSliding as EntryIcon,
  ElectricMeter as IslandIcon,
  Lightbulb as LightIcon,
  Power as OutletIcon,
  ToggleOn as SwitchIcon
} from '@mui/icons-material';
import { useSurveyViewModel } from '@/viewmodels';
import {
  ROOM_TYPE_CATALOG,
  TIPO_CUBIERTA_CATALOG
} from '@/models/RoomModel';
import { TIPO_NODO_ELECTRICO_CATALOG } from '@/models/ElectricalGraphModel';

interface RoomDetailDialogProps {
  open: boolean;
  onClose: () => void;
  roomId: string | null;
  onOpenAddElectricalNode?: (roomId: string) => void;
}

export const RoomDetailDialog: React.FC<RoomDetailDialogProps> = ({
  open,
  onClose,
  roomId,
  onOpenAddElectricalNode
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const {
    rooms,
    electricalNodes,
    deleteNodoElectrico,
    deleteRoom,
    updateRoomCubierta,
    setActivePhase,
    selectRoom
  } = useSurveyViewModel();

  if (!roomId) return null;
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return null;

  const roomTypeMeta = ROOM_TYPE_CATALOG[room.type] || ROOM_TYPE_CATALOG.other;
  const roomElecNodes = electricalNodes.filter((n) => n.roomId === room.id);
  const isNonMetric = room.isAccessPoint || room.isTechnicalIsland;
  const areaM2 = (room.dimensions.width * room.dimensions.length).toFixed(1);

  const handleGoToParametrization = () => {
    selectRoom(room.id);
    setActivePhase('parametrization');
    onClose();
  };

  const handleDeleteRoom = () => {
    if (window.confirm(`¿Deseas eliminar el espacio "${room.name}"?`)) {
      deleteRoom(room.id);
      onClose();
    }
  };

  const getNodeIcon = (tipo: string) => {
    if (tipo.includes('boca_techo') || tipo.includes('aplique')) return <LightIcon fontSize="small" sx={{ color: '#d97706' }} />;
    if (tipo.includes('toma')) return <OutletIcon fontSize="small" sx={{ color: '#2563eb' }} />;
    if (tipo.includes('llave')) return <SwitchIcon fontSize="small" sx={{ color: '#7c3aed' }} />;
    return <BoltIcon fontSize="small" color="primary" />;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      scroll="paper"
      sx={{
        zIndex: 1300,
        '& .MuiDialog-container': {
          alignItems: isMobile ? 'flex-end' : 'center',
          justifyContent: 'center'
        }
      }}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? '24px 24px 0 0' : 4,
          maxHeight: isMobile ? '82vh' : '85vh',
          width: isMobile ? '100vw' : 'auto',
          m: isMobile ? 0 : 2,
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }
      }}
    >
      {/* Header del Diálogo */}
      <DialogTitle component="div" sx={{ px: 2, pt: 2, pb: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              p: 1,
              borderRadius: 2,
              bgcolor: room.isTechnicalIsland ? '#fef3c7' : room.isAccessPoint ? '#d1fae5' : 'primary.light',
              color: room.isTechnicalIsland ? '#b45309' : room.isAccessPoint ? '#065f46' : 'primary.dark',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {room.isTechnicalIsland ? <IslandIcon /> : room.isAccessPoint ? <EntryIcon /> : <RoomIcon />}
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              {room.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {roomTypeMeta.label}
            </Typography>
          </Box>
        </Stack>

        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ px: 2, py: 2 }}>
        {/* Selector Interactivo de Tipo de Cubierta */}
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            mb: 2,
            borderRadius: 3,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase" letterSpacing={0.5} display="block" mb={0.8}>
            Tipo de Cubierta
          </Typography>
          <ToggleButtonGroup
            value={room.tipoCubierta || 'cubierto'}
            exclusive
            onChange={(_, val) => {
              if (val) updateRoomCubierta(room.id, val);
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
                  py: 0.6
                }}
              >
                <Stack direction="row" spacing={0.6} alignItems="center">
                  <span>{cub.emoji}</span>
                  <span>{cub.label}</span>
                </Stack>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.6, fontSize: '0.7rem' }}>
            {TIPO_CUBIERTA_CATALOG[room.tipoCubierta || 'cubierto']?.description}
          </Typography>
        </Paper>

        {/* Aviso especial si es descubierto */}
        {room.tipoCubierta === 'descubierto' && (
          <Box
            sx={{
              p: 1.2,
              mb: 2,
              borderRadius: 2.5,
              bgcolor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <Typography variant="caption" color="#166534" fontWeight={600}>
              ☀️ Espacio a cielo abierto (sin losa de techo). Las bocas de luz corresponden a apliques de pared o artefactos exteriores estancos IP65.
            </Typography>
          </Box>
        )}

        {/* Tarjeta de Métricas Constructivas */}
        {!isNonMetric ? (
          <Paper
            elevation={0}
            sx={{
              p: 2,
              mb: 2.5,
              borderRadius: 3,
              bgcolor: '#fffbf7',
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase" letterSpacing={0.5}>
              Geometría y Cotas del Local
            </Typography>
            <Box display="grid" gridTemplateColumns="1fr 1fr 1fr" gap={1.5} mt={1}>
              <Box>
                <Typography variant="caption" color="text.secondary">Superficie</Typography>
                <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                  {areaM2} m²
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Ancho x Largo</Typography>
                <Typography variant="body2" fontWeight={600}>
                  {room.dimensions.width.toFixed(2)}m × {room.dimensions.length.toFixed(2)}m
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Altura (Z)</Typography>
                <Typography variant="body2" fontWeight={600}>
                  {room.dimensions.height.toFixed(2)}m
                </Typography>
              </Box>
            </Box>
          </Paper>
        ) : (
          <Paper
            elevation={0}
            sx={{
              p: 2,
              mb: 2.5,
              borderRadius: 3,
              bgcolor: room.isTechnicalIsland ? '#fffbeb' : '#f0fdf4',
              border: '1px dashed',
              borderColor: room.isTechnicalIsland ? '#f59e0b' : '#10b981'
            }}
          >
            <Typography variant="subtitle2" fontWeight={700} color={room.isTechnicalIsland ? '#92400e' : '#065f46'}>
              {room.isTechnicalIsland ? 'Isla Técnica Exterior' : 'Punto de Ingreso / Frontera'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Espacio no acotado métricamente. Funciona como nodo de enlace para acometidas o accesos.
            </Typography>
          </Paper>
        )}

        {/* Sección de Bocas y Nodos Eléctricos */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle2" fontWeight={700} color="text.primary">
            ⚡ Componentes Eléctricos ({roomElecNodes.length})
          </Typography>

          {onOpenAddElectricalNode && (
            <Button
              size="small"
              variant="contained"
              color="warning"
              startIcon={<AddIcon sx={{ fontSize: 16 }} />}
              onClick={() => {
                onOpenAddElectricalNode(room.id);
                onClose();
              }}
              sx={{ borderRadius: 2, fontSize: '0.75rem', py: 0.4, px: 1.2, fontWeight: 700 }}
            >
              + Boca
            </Button>
          )}
        </Box>

        {roomElecNodes.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              textAlign: 'center',
              bgcolor: '#fafafa',
              borderRadius: 3,
              border: '1px dashed #e2e8f0'
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Aún no hay bocas eléctricas asignadas a este local.
            </Typography>
          </Paper>
        ) : (
          <List dense sx={{ bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            {roomElecNodes.map((node, index) => {
              const tipoMeta = TIPO_NODO_ELECTRICO_CATALOG[node.tipo] || TIPO_NODO_ELECTRICO_CATALOG.boca_iluminacion;
              return (
                <React.Fragment key={node.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    secondaryAction={
                      <IconButton
                        edge="end"
                        size="small"
                        color="error"
                        onClick={() => deleteNodoElectrico(node.id)}
                        sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      {getNodeIcon(node.tipo)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={0.8} alignItems="center">
                          <Typography variant="body2" fontWeight={600}>
                            {node.etiqueta}
                          </Typography>
                          <Chip
                            label={tipoMeta.label}
                            size="small"
                            sx={{ fontSize: '0.65rem', height: 18, bgcolor: '#f1f5f9' }}
                          />
                        </Stack>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          {node.circuitoCodigo ? `Circuito: ${node.circuitoCodigo}` : 'Sin circuito asignado'}
                        </Typography>
                      }
                    />
                  </ListItem>
                </React.Fragment>
              );
            })}
          </List>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          px: 2.5,
          pt: 1.5,
          pb: isMobile ? 'calc(env(safe-area-inset-bottom, 0px) + 24px)' : 2,
          justifyContent: 'space-between',
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          flexShrink: 0
        }}
      >
        <Button
          size="medium"
          color="error"
          startIcon={<DeleteIcon fontSize="small" />}
          onClick={handleDeleteRoom}
          sx={{ fontWeight: 600, borderRadius: 2 }}
        >
          Eliminar
        </Button>

        <Stack direction="row" spacing={1.2}>
          {!isNonMetric && (
            <Button
              variant="outlined"
              size="medium"
              startIcon={<ParamIcon fontSize="small" />}
              onClick={handleGoToParametrization}
              sx={{ fontWeight: 600, borderRadius: 2 }}
            >
              Parametrizar
            </Button>
          )}
          <Button
            variant="contained"
            size="medium"
            onClick={onClose}
            sx={{ fontWeight: 700, borderRadius: 2, px: 2.5 }}
          >
            Listo
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
};
