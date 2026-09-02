/**
 * View: AddElectricalNodeDialog (Material 3)
 * Diálogo para incorporar un nodo eléctrico (Medidor, Tablero, Caja de Paso, Boca)
 * dentro de un ambiente, acceso o isla técnica de la instalación.
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
  Box,
  Typography,
  Stack,
  Chip,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  ElectricBolt as BoltIcon,
  Add as AddIcon
} from '@mui/icons-material';
import {
  TipoNodoElectrico,
  TIPO_NODO_ELECTRICO_CATALOG
} from '@/models/ElectricalGraphModel';
import { useSurveyViewModel } from '@/viewmodels';

interface AddElectricalNodeDialogProps {
  open: boolean;
  onClose: () => void;
  defaultRoomId?: string;
}

export const AddElectricalNodeDialog: React.FC<AddElectricalNodeDialogProps> = ({
  open,
  onClose,
  defaultRoomId
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { rooms, registerElectricalNode, selectElectricalNode } = useSurveyViewModel();

  const [roomId, setRoomId] = useState<string>(defaultRoomId || (rooms[0]?.id ?? ''));
  const [tipo, setTipo] = useState<TipoNodoElectrico>('tablero_seccional');
  const [etiqueta, setEtiqueta] = useState('');
  const [circuitoCodigo, setCircuitoCodigo] = useState('C1-IUG');

  const handleTipoChange = (newTipo: TipoNodoElectrico) => {
    setTipo(newTipo);
    const meta = TIPO_NODO_ELECTRICO_CATALOG[newTipo];
    setEtiqueta(meta.label);
    if (newTipo === 'medidor_kwh') setCircuitoCodigo('ALIM-GRAL');
    else if (newTipo === 'tablero_principal') setCircuitoCodigo('ALIM-TP');
    else if (newTipo === 'tablero_seccional') setCircuitoCodigo('ALIM-TS');
    else if (newTipo === 'boca_iluminacion') setCircuitoCodigo('C1-IUG');
    else if (newTipo === 'boca_tomacorriente') setCircuitoCodigo('C2-TUG');
  };

  const handleSave = () => {
    if (!roomId) return;
    const newNodo = registerElectricalNode(roomId, tipo, etiqueta, circuitoCodigo);
    selectElectricalNode(newNodo.id);
    onClose();
  };

  return (
    <Dialog
      fullScreen={isMobile}
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: isMobile ? 0 : 4, p: isMobile ? 0.5 : 1 } }}
    >
      <DialogTitle component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <BoltIcon color="primary" />
        <Typography variant="h6" fontWeight={700}>
          Nuevo Nodo Eléctrico
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {/* Espacio Contenedor */}
          <TextField
            select
            label="Ambiente o Espacio Contenedor"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            fullWidth
          >
            {rooms.map((room) => (
              <MenuItem key={room.id} value={room.id}>
                <Box display="flex" justifyContent="space-between" width="100%" alignItems="center">
                  <span>{room.name}</span>
                  <Chip
                    label={room.isTechnicalIsland ? 'Isla Técnica' : room.isAccessPoint ? 'Ingreso' : 'Ambiente'}
                    size="small"
                    color={room.isTechnicalIsland ? 'warning' : room.isAccessPoint ? 'success' : 'default'}
                    sx={{ height: 20, fontSize: '0.68rem' }}
                  />
                </Box>
              </MenuItem>
            ))}
          </TextField>

          {/* Tipo de Nodo Eléctrico */}
          <TextField
            select
            label="Tipo de Nodo Eléctrico"
            value={tipo}
            onChange={(e) => handleTipoChange(e.target.value as TipoNodoElectrico)}
            fullWidth
          >
            {Object.values(TIPO_NODO_ELECTRICO_CATALOG).map((item) => (
              <MenuItem key={item.tipo} value={item.tipo}>
                <Box display="flex" justifyContent="space-between" width="100%" alignItems="center">
                  <span>{item.emoji} {item.label}</span>
                  <Chip label={item.shortCode} size="small" variant="outlined" sx={{ height: 20 }} />
                </Box>
              </MenuItem>
            ))}
          </TextField>

          {/* Etiqueta / Nombre */}
          <TextField
            label="Etiqueta / Identificador"
            value={etiqueta}
            onChange={(e) => setEtiqueta(e.target.value)}
            placeholder="Ej: Tablero Seccional TS-01, Caja Paso Palier 2°P..."
            fullWidth
            required
          />

          {/* Circuito Asociado */}
          <TextField
            label="Circuito o Alimentador"
            value={circuitoCodigo}
            onChange={(e) => setCircuitoCodigo(e.target.value)}
            placeholder="Ej: ALIM-GRAL, C1-IUG, C2-TUG, PAT"
            fullWidth
          />
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
          onClick={handleSave}
          startIcon={<AddIcon />}
          disabled={!etiqueta.trim() || !roomId}
        >
          Crear Nodo Eléctrico
        </Button>
      </DialogActions>
    </Dialog>
  );
};
