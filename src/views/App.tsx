/**
 * View: App (Componente Raíz de la Vista)
 * Coordina el renderizado según la fase activa del relevamiento bajo el patrón MVVM.
 */

import React, { useState, useEffect } from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { useSurveyViewModel, useKeyboardShortcuts } from '@/viewmodels';
import { loadActiveSession } from '@/db/database';
import { AppLayout } from './components/layout/AppLayout';
import { AssemblyCanvasView } from './components/assembly/AssemblyCanvasView';
import { ElectricalPlanView } from './components/electrical/ElectricalPlanView';
import { PresentationView } from './components/presentation/PresentationView';
import { AddRoomDialog } from './components/topology/AddRoomDialog';
import { KeyboardShortcutsDialog } from './components/common/KeyboardShortcutsDialog';
import { MobileRoomBottomSheet } from './components/common/MobileRoomBottomSheet';

export const App: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const {
    activePhase,
    loadProjectFromDB,
    selectedRoom,
    selectRoom
  } = useSurveyViewModel();

  const [addRoomOpen, setAddRoomOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [defaultTab, setDefaultTab] = useState<'interior' | 'access' | 'technical'>('interior');

  // Registrar Atajos de Teclado Globales para PC
  useKeyboardShortcuts({
    onOpenAddRoom: () => handleOpenAddRoom('interior'),
    onOpenShortcutsHelp: () => setShortcutsOpen(true),
    onOpenProjectDialog: () => {}
  });

  useEffect(() => {
    async function restoreSession() {
      const activeSession = await loadActiveSession();
      if (activeSession && activeSession.id) {
        await loadProjectFromDB(activeSession.id);
      }
    }
    restoreSession();
  }, [loadProjectFromDB]);

  const handleOpenAddRoom = (tab: 'interior' | 'access' | 'technical' = 'interior') => {
    setDefaultTab(tab);
    setAddRoomOpen(true);
  };

  return (
    <AppLayout
      onOpenAddRoom={handleOpenAddRoom}
      onOpenShortcutsHelp={() => setShortcutsOpen(true)}
    >
      <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
        {(activePhase === 'architecture' || activePhase === 'topology' || activePhase === 'parametrization') && (
          <AssemblyCanvasView onOpenAddRoom={handleOpenAddRoom} />
        )}
        {activePhase === 'electrical' && (
          <ElectricalPlanView />
        )}
        {(activePhase === 'presentation' || activePhase === 'assembly') && (
          <PresentationView />
        )}
      </Box>

      {/* Diálogo Global para Crear Ambiente, Punto de Ingreso o Isla Técnica */}
      {addRoomOpen && (
        <AddRoomDialog
          open={addRoomOpen}
          onClose={() => setAddRoomOpen(false)}
          defaultTab={defaultTab}
        />
      )}

      {/* CheatSheet Modal de Atajos de Teclado (Desktop) */}
      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      {/* BottomSheet Táctil Deslizante para Edición Rápida en Smartphone (solo en modo presentación para no bloquear el lienzo) */}
      {isMobile && selectedRoom && activePhase === 'presentation' && (
        <MobileRoomBottomSheet
          open={Boolean(selectedRoom)}
          onClose={() => selectRoom(null)}
        />
      )}
    </AppLayout>
  );
};
