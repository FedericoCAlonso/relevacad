/**
 * View Component: KeyboardShortcutsDialog
 * Modal de ayuda interactivo con la guía completa de atajos de teclado (CheatSheet CAD)
 * para operar el sistema a máxima velocidad desde PC/Escritorio.
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  Paper,
  Stack,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  Keyboard as KeyboardIcon,
  Close as CloseIcon
} from '@mui/icons-material';

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: 'fases' | 'edicion' | 'sistema';
}

const SHORTCUTS_CATALOG: ShortcutItem[] = [
  // Fases y Navegación
  { keys: ['1'], description: 'Ir a Fase 1: Planta Arquitectónica (Ambientes y Muros)', category: 'fases' },
  { keys: ['2'], description: 'Ir a Fase 2: Instalación Eléctrica (Bocas y Cañerías)', category: 'fases' },
  { keys: ['3'], description: 'Ir a Fase 3: Presentación, Cómputo & Cotizador IEBA', category: 'fases' },

  // Edición y Manipulación
  { keys: ['A', 'o', 'N'], description: 'Nuevo Espacio (Ambiente, Ingreso o Medianera)', category: 'edicion' },
  { keys: ['S'], description: 'Alternar Snap Magnético (Atracción a 15px)', category: 'edicion' },
  { keys: ['Espacio', 'o', 'E'], description: 'Auto-Alinear y Centrar Plano 2D', category: 'edicion' },
  { keys: ['Tab'], description: 'Seleccionar siguiente ambiente en el proyecto', category: 'edicion' },
  { keys: ['Shift', '+', 'Tab'], description: 'Seleccionar ambiente anterior', category: 'edicion' },
  { keys: ['Doble Clic'], description: 'Abrir ficha de parametrización del ambiente', category: 'edicion' },
  { keys: ['Supr'], description: 'Eliminar el ambiente o nodo seleccionado', category: 'edicion' },
  { keys: ['Esc'], description: 'Deseleccionar ambiente activo / Cerrar modales', category: 'edicion' },

  // Sistema y Proyecto
  { keys: ['Ctrl', '+', 'S'], description: 'Guardar Proyecto en Base de Datos Local', category: 'sistema' },
  { keys: ['P'], description: 'Ficha Técnica de Proyecto, Cliente y Orientación Solar', category: 'sistema' },
  { keys: ['?'], description: 'Abrir esta guía de atajos de teclado', category: 'sistema' }
];

export const KeyboardShortcutsDialog: React.FC<KeyboardShortcutsDialogProps> = ({
  open,
  onClose
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const renderKbd = (key: string) => {
    if (key === '+') {
      return (
        <Typography component="span" variant="caption" sx={{ color: '#94a3b8', mx: 0.3, fontWeight: 700 }}>
          +
        </Typography>
      );
    }
    if (key === 'o') {
      return (
        <Typography component="span" variant="caption" sx={{ color: '#94a3b8', mx: 0.5, fontStyle: 'italic' }}>
          ó
        </Typography>
      );
    }
    return (
      <Box
        component="kbd"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 26,
          height: 24,
          px: 0.8,
          borderRadius: 1.5,
          bgcolor: '#f1f5f9',
          border: '1px solid #cbd5e1',
          borderBottom: '2px solid #94a3b8',
          fontSize: '0.74rem',
          fontFamily: 'monospace',
          fontWeight: 700,
          color: '#1e293b',
          boxShadow: '0 1px 2px rgba(0,0,0,0.06)'
        }}
      >
        {key}
      </Box>
    );
  };

  const renderSection = (title: string, category: 'fases' | 'edicion' | 'sistema') => {
    const items = SHORTCUTS_CATALOG.filter((s) => s.category === category);
    return (
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="caption" fontWeight={700} color="primary.main" textTransform="uppercase" letterSpacing={0.8} display="block" gutterBottom>
          {title}
        </Typography>
        <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
          {items.map((item, idx) => (
            <Box
              key={idx}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                py: 1,
                px: 2,
                bgcolor: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                borderBottom: idx < items.length - 1 ? '1px solid #edf2f7' : 'none'
              }}
            >
              <Typography variant="body2" color="#334155" sx={{ fontSize: '0.82rem' }}>
                {item.description}
              </Typography>
              <Stack direction="row" spacing={0.3} alignItems="center">
                {item.keys.map((k, i) => (
                  <React.Fragment key={i}>{renderKbd(k)}</React.Fragment>
                ))}
              </Stack>
            </Box>
          ))}
        </Paper>
      </Box>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3.5, p: isMobile ? 0.5 : 1 } }}
    >
      <DialogTitle component="div" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Stack direction="row" spacing={1.2} alignItems="center">
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: 2,
              bgcolor: 'primary.light',
              color: 'primary.dark',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <KeyboardIcon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Atajos de Teclado
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Productividad acelerada para relevamiento y dibujo arquitectónico
            </Typography>
          </Box>
        </Stack>
        <Button size="small" onClick={onClose} sx={{ minWidth: 32, p: 0.5 }}>
          <CloseIcon fontSize="small" />
        </Button>
      </DialogTitle>

      <DialogContent dividers sx={{ py: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            {renderSection('🚀 Navegación Rápida entre Vistas', 'fases')}
            {renderSection('⚙️ Proyecto y Archivos', 'sistema')}
          </Grid>
          <Grid item xs={12} md={6}>
            {renderSection('✏️ Edición y Ensamblaje', 'edicion')}
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.5 }}>
        <Button variant="contained" onClick={onClose} sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600 }}>
          Entendido
        </Button>
      </DialogActions>
    </Dialog>
  );
};
