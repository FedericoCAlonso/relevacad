/**
 * View: App (Componente Raíz de la Vista)
 * Coordina el renderizado según la fase activa del relevamiento bajo el patrón MVVM.
 */

import React, { useState } from 'react';
import { Box } from '@mui/material';
import { useSurveyViewModel } from '@/viewmodels';
import { AppLayout } from './components/layout/AppLayout';
import { TopologyView } from './components/topology/TopologyView';
import { ParametrizationView } from './components/parametrization/ParametrizationView';
import { AssemblyCanvasView } from './components/assembly/AssemblyCanvasView';
import { AddRoomDialog } from './components/topology/AddRoomDialog';
import { AddElectricalNodeDialog } from './components/topology/AddElectricalNodeDialog';

export const App: React.FC = () => {
  const { activePhase, selectedRoomId, rooms } = useSurveyViewModel();
  const [addRoomOpen, setAddRoomOpen] = useState(false);
  const [defaultTab, setDefaultTab] = useState<'interior' | 'access' | 'technical'>('interior');
  const [addElecNodeOpen, setAddElecNodeOpen] = useState(false);

  const handleOpenAddRoom = (tab: 'interior' | 'access' | 'technical' = 'interior') => {
    setDefaultTab(tab);
    setAddRoomOpen(true);
  };

  const handleOpenAddElectricalNode = () => {
    setAddElecNodeOpen(true);
  };

  return (
    <AppLayout
      onOpenAddRoom={handleOpenAddRoom}
      onOpenAddElectricalNode={handleOpenAddElectricalNode}
    >
      <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
        {activePhase === 'topology' && (
          <TopologyView onOpenAddRoom={handleOpenAddRoom} />
        )}
        {activePhase === 'parametrization' && (
          <ParametrizationView onOpenAddRoom={() => handleOpenAddRoom('interior')} />
        )}
        {activePhase === 'assembly' && (
          <AssemblyCanvasView />
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

      {/* Diálogo Global para Crear Nodo Eléctrico */}
      {addElecNodeOpen && (
        <AddElectricalNodeDialog
          open={addElecNodeOpen}
          onClose={() => setAddElecNodeOpen(false)}
          defaultRoomId={selectedRoomId || rooms[0]?.id}
        />
      )}
    </AppLayout>
  );
};
