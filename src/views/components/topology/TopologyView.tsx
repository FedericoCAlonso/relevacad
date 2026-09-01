/**
 * View: TopologyView (Fase 1: Vista de Topología con Capas Arquitectónica y Eléctrica)
 * Renderizado interactivo con React Flow que soporta:
 * 1. Capa Arquitectura Pura: Espacios e Ingresos conectados por Aberturas orientadas por Paredes (N, S, E, O).
 * 2. Capa Eléctrica (Tendido de Cañerías): Espacios como Contenedores de Nodos Eléctricos con
 *    cañerías multicircuito, retornos y notación normalizada AEA 90364-771.
 * 3. 🌟 ILUMINACIÓN DINÁMICA DE SUBÁRBOL ELÉCTRICO al tocar cualquier Tablero (TP, TSG), Medidor o Boca.
 * 4. ⚡ MODO CONEXIÓN EN CADENA (CLICK-TO-CONNECT): Trazado ultra-rápido de cañerías tocando nodos en secuencia.
 * 5. Filtro interactivo por Circuito (C1-IUG, C2-TUG, C3-TUG, C4-TUE, Alimentación).
 * 6. Inspector Lateral (ConduitInspectorDrawer) con medidor de ocupación AEA y gestión de cables.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  useNodesState,
  useEdgesState
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  Divider,
  IconButton,
  TextField,
  MenuItem,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  Tune as ParamIcon,
  AutoAwesome as AutoLayoutIcon,
  ElectricBolt as BoltIcon,
  AccountTree as ArchitectureIcon,
  Delete as DeleteIcon,
  FilterAlt as FilterIcon,
  HighlightOff as ClearFocusIcon,
  Link as LinkIcon,
  Check as CheckIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useSurveyViewModel } from '@/viewmodels';
import { TopologyLayerMode } from '@/viewmodels/surveyStore';
import { RoomNodeComponent } from './RoomNodeComponent';
import { EditOpeningDialog } from './EditOpeningDialog';
import { AddElectricalNodeDialog } from './AddElectricalNodeDialog';
import { ConduitInspectorDrawer } from './ConduitInspectorDrawer';
import { CONNECTION_TYPE_CATALOG } from '@/models/GraphModel';
import { getConduitAeaNotation } from '@/models/ElectricalGraphModel';
import { computeElectricalSubtree } from '@/viewmodels/utils/electricalSubtreeSolver';
import { AddMenuButton } from '../common/AddMenuButton';

const nodeTypes = {
  roomNode: RoomNodeComponent
};

interface TopologyViewProps {
  onOpenAddRoom: (defaultTab?: 'interior' | 'access' | 'technical') => void;
}

const WALL_LABEL_MAP: Record<string, string> = {
  north: 'N',
  south: 'S',
  east: 'E',
  west: 'O'
};

export const TopologyView: React.FC<TopologyViewProps> = ({ onOpenAddRoom }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const {
    rooms,
    connections,
    electricalNodes,
    electricalTramos,
    selectedRoomId,
    selectedRoom,
    selectedElectricalNodeId,
    topologyLayer,
    setTopologyLayer,
    selectRoom,
    deleteRoom,
    selectElectricalNode,
    connectRooms,
    connectElectricalNodes,
    updateRoomTopologyPosition,
    setActivePhase
  } = useSurveyViewModel();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [inspectorTramoId, setInspectorTramoId] = useState<string | null>(null);
  const [addElecNodeRoomId, setAddElecNodeRoomId] = useState<string | null>(null);

  // Filtro activo de circuitos para la vista eléctrica
  const [circuitFilter, setCircuitFilter] = useState<string | null>(null);

  // ⚡ ESTADO DEL MODO CONEXIÓN EN CADENA (CLICK-TO-CONNECT)
  const [isChainMode, setIsChainMode] = useState<boolean>(false);
  const [chainCircuit, setChainCircuit] = useState<string>('C1-IUG');
  const [chainDiametro, setChainDiametro] = useState<number>(19);
  const [chainLastNodeId, setChainLastNodeId] = useState<string | null>(null);
  const [chainCount, setChainCount] = useState<number>(0);

  // 🌟 CÁLCULO DEL SUBÁRBOL ELÉCTRICO ILUMINADO (Solo si no estamos en modo cadena)
  const activeSubTree = useMemo(() => {
    if (isChainMode) return null;
    if (topologyLayer !== 'electrical' && topologyLayer !== 'unified') return null;
    return computeElectricalSubtree(selectedElectricalNodeId, electricalNodes, electricalTramos);
  }, [selectedElectricalNodeId, electricalNodes, electricalTramos, topologyLayer, isChainMode]);

  const isAnySubTreeActive = Boolean(activeSubTree);
  const highlightedNodeIds = useMemo(
    () => (activeSubTree ? Array.from(activeSubTree.subTreeNodeIds) : []),
    [activeSubTree]
  );
  const highlightedRoomIds = useMemo(
    () => (activeSubTree ? Array.from(activeSubTree.subTreeRoomIds) : []),
    [activeSubTree]
  );

  // Obtener lista única de circuitos disponibles en el proyecto
  const availableCircuits = useMemo(() => {
    const set = new Set<string>();
    electricalTramos.forEach((t) => {
      if (t.conductores && t.conductores.length > 0) {
        t.conductores.forEach((c) => set.add(c.circuitoCodigo));
      } else if (t.circuitoCodigo) {
        set.add(t.circuitoCodigo);
      }
    });
    return Array.from(set);
  }, [electricalTramos]);

  // Manejador del Click en Modo Cadena
  const handleNodeClickInChain = useCallback(
    (nodeId: string) => {
      if (!chainLastNodeId) {
        // Primer nodo de la cadena (Origen)
        setChainLastNodeId(nodeId);
        setChainCount(1);
      } else if (chainLastNodeId === nodeId) {
        // Clic en el mismo nodo: quitar foco de origen
        setChainLastNodeId(null);
        setChainCount(0);
      } else {
        // Tender cañería del nodo previo al nodo actual
        const newTramo = connectElectricalNodes(chainLastNodeId, nodeId, {
          circuitoCodigo: chainCircuit,
          diametroCañoMm: chainDiametro
        });

        if (newTramo) {
          // Continuar la cadena desde este nuevo nodo
          setChainLastNodeId(nodeId);
          setChainCount((c) => c + 1);
        }
      }
    },
    [chainLastNodeId, chainCircuit, chainDiametro, connectElectricalNodes]
  );

  const handleFinishChainMode = useCallback(() => {
    setIsChainMode(false);
    if (chainLastNodeId) {
      selectElectricalNode(chainLastNodeId);
    }
    setChainLastNodeId(null);
    setChainCount(0);
  }, [chainLastNodeId, selectElectricalNode]);

  const handleCancelChainMode = useCallback(() => {
    setIsChainMode(false);
    setChainLastNodeId(null);
    setChainCount(0);
  }, []);

  // Escuchar tecla Escape para cancelar o finalizar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isChainMode) {
        handleCancelChainMode();
      } else if (e.key === 'Enter' && isChainMode && chainCount > 1) {
        handleFinishChainMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChainMode, chainCount, handleCancelChainMode, handleFinishChainMode]);

  // Sincronizar el estado del ViewModel con los nodos de React Flow
  useEffect(() => {
    setNodes((prevNodes) => {
      const prevMap = new Map(prevNodes.map((n) => [n.id, n.position]));

      return rooms.map((room, index) => {
        const savedPos = room.topologyPosition;
        const currentPos = prevMap.get(room.id);
        const fallbackPos = {
          x: room.isTechnicalIsland ? 40 : room.isAccessPoint ? 50 : 380 + (index % 3) * 320,
          y: room.isTechnicalIsland ? 40 : 100 + index * 200
        };

        const roomElecNodes = electricalNodes.filter((n) => n.roomId === room.id);

        return {
          id: room.id,
          type: 'roomNode',
          position: currentPos || savedPos || fallbackPos,
          data: {
            roomId: room.id,
            name: room.name,
            roomType: room.type,
            isAccessPoint: room.isAccessPoint,
            isTechnicalIsland: room.isTechnicalIsland,
            isCommonArea: room.isCommonArea,
            dimensions: room.dimensions,
            assetCount: room.electricalAssets.length,
            color: room.color,
            isSelected: room.id === selectedRoomId,
            topologyLayer,
            electricalNodes: roomElecNodes,
            selectedElectricalNodeId,
            highlightedSubTreeNodeIds: highlightedNodeIds,
            highlightedSubTreeRoomIds: highlightedRoomIds,
            isAnySubTreeActive,

            // Props del Modo Cadena
            isChainModeActive: isChainMode,
            chainLastNodeId,
            chainNodesCount: chainCount,

            onAddElectricalNode: (rId: string) => setAddElecNodeRoomId(rId),
            onSelectElectricalNode: (nId: string | null) => selectElectricalNode(nId),
            onNodeClickInChain: handleNodeClickInChain
          }
        };
      });
    });
  }, [
    rooms,
    selectedRoomId,
    selectedElectricalNodeId,
    electricalNodes,
    topologyLayer,
    highlightedNodeIds,
    highlightedRoomIds,
    isAnySubTreeActive,
    isChainMode,
    chainLastNodeId,
    chainCount,
    handleNodeClickInChain,
    selectElectricalNode,
    setNodes
  ]);

  // Sincronizar Aristas con filtros estrictos, subárboles iluminados y notación AEA
  useEffect(() => {
    const formattedEdges: Edge[] = [];

    // 1. Aristas Arquitectónicas (Solo si la capa está en Arquitectura o Unificada)
    if (topologyLayer === 'architectural' || topologyLayer === 'unified') {
      connections.forEach((conn) => {
        const typeMeta =
          CONNECTION_TYPE_CATALOG[conn.type] || CONNECTION_TYPE_CATALOG.puerta_estandar;

        const srcWall = conn.sourceWall || 'east';
        const tgtWall = conn.targetWall || 'west';
        const srcHandle = conn.sourceHandle || `source-${srcWall}`;
        const tgtHandle = conn.targetHandle || `target-${tgtWall}`;

        const wallBadge = `[${WALL_LABEL_MAP[srcWall] || srcWall} ➔ ${WALL_LABEL_MAP[tgtWall] || tgtWall}]`;

        let edgeLabel = `${typeMeta.emoji} ${typeMeta.label} ${wallBadge}`;
        if (conn.opening) {
          edgeLabel = `${typeMeta.emoji} ${conn.opening.widthMeters}m ${wallBadge} ${
            conn.opening.hasAutomation ? '⚡' : ''
          }`;
        }

        formattedEdges.push({
          id: `arch-${conn.id}`,
          source: conn.sourceRoomId,
          target: conn.targetRoomId,
          sourceHandle: srcHandle,
          targetHandle: tgtHandle,
          label: edgeLabel,
          type: 'smoothstep',
          animated: conn.type === 'conduit_main' || !!conn.opening?.hasAutomation,
          style: {
            stroke: typeMeta.color,
            strokeWidth: 2.5,
            strokeDasharray: typeMeta.strokeDasharray,
            cursor: 'pointer',
            opacity: 1
          },
          labelStyle: { fill: '#0f172a', fontWeight: 700, fontSize: 10.5 },
          labelBgStyle: { fill: '#ffffff', fillOpacity: 0.96, rx: 6, ry: 6, stroke: typeMeta.color, strokeWidth: 1 },
          labelBgPadding: [6, 4],
          data: { edgeType: 'architectural', rawId: conn.id }
        });
      });
    }

    // 2. Aristas Eléctricas (Cañerías con Notación AEA Normalizada e Iluminación de Subárbol)
    if (topologyLayer === 'electrical' || topologyLayer === 'unified') {
      electricalTramos.forEach((tramo) => {
        const sourceNode = electricalNodes.find((n) => n.id === tramo.sourceNodeId);
        const targetNode = electricalNodes.find((n) => n.id === tramo.targetNodeId);
        if (!sourceNode || !targetNode) return;

        // Comprobar si pertenece al subárbol iluminado
        const isInSubtree = !activeSubTree || activeSubTree.subTreeTramoIds.has(tramo.id);

        // Comprobar filtro manual de circuitos
        const tramoCircuits = tramo.conductores?.map((c) => c.circuitoCodigo) || [tramo.circuitoCodigo || ''];
        const matchesCircuitFilter = !circuitFilter || tramoCircuits.some((c) => c === circuitFilter);

        const isHighlighted = isInSubtree && matchesCircuitFilter;

        const isMainFeeder = tramoCircuits.some((c) => c.includes('ALIM'));
        const tramoColor = isMainFeeder
          ? '#dc2626'
          : tramoCircuits.some((c) => c.includes('IUG'))
          ? '#d97706'
          : '#2563eb';

        // Notación técnica AEA concisa: ej "C1-IUG [// o- T ''] • Ø19 (5m)"
        const aeaNotation = getConduitAeaNotation(tramo);

        formattedEdges.push({
          id: `elec-${tramo.id}`,
          source: sourceNode.roomId,
          target: targetNode.roomId,
          sourceHandle: `elec-source-${sourceNode.id}`,
          targetHandle: `elec-target-${targetNode.id}`,
          label: aeaNotation,
          type: 'smoothstep',
          animated: isHighlighted,
          style: {
            stroke: tramoColor,
            strokeWidth: isHighlighted ? (isMainFeeder ? 4.5 : 3.5) : 1.5,
            cursor: 'pointer',
            opacity: isHighlighted ? 1 : 0.15
          },
          labelStyle: { fill: tramoColor, fontWeight: isHighlighted ? 800 : 500, fontSize: isHighlighted ? 10.5 : 9 },
          labelBgStyle: {
            fill: '#ffffff',
            fillOpacity: isHighlighted ? 0.98 : 0.3,
            rx: 6,
            ry: 6,
            stroke: isHighlighted ? tramoColor : '#cbd5e1',
            strokeWidth: isHighlighted ? 1.5 : 1
          },
          labelBgPadding: [6, 4],
          data: { edgeType: 'electrical', rawId: tramo.id }
        });
      });
    }

    setEdges(formattedEdges);
  }, [
    connections,
    electricalTramos,
    electricalNodes,
    topologyLayer,
    circuitFilter,
    activeSubTree,
    setEdges
  ]);

  // Manejador al finalizar el arrastre de un nodo para persistir su posición
  const handleNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, node: Node) => {
      updateRoomTopologyPosition(node.id, {
        x: Math.round(node.position.x),
        y: Math.round(node.position.y)
      });
    },
    [updateRoomTopologyPosition]
  );

  // Conectar nodos arrastrando desde un handle (Método clásico drag-and-drop)
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      const isElectricalSource = connection.sourceHandle?.startsWith('elec-');
      const isElectricalTarget = connection.targetHandle?.startsWith('elec-');

      if (isElectricalSource || isElectricalTarget) {
        const srcNodeId = connection.sourceHandle?.replace('elec-source-', '').replace('elec-target-', '');
        const tgtNodeId = connection.targetHandle?.replace('elec-source-', '').replace('elec-target-', '');

        if (srcNodeId && tgtNodeId) {
          const newTramo = connectElectricalNodes(srcNodeId, tgtNodeId);
          if (newTramo) setInspectorTramoId(newTramo.id);
        }
      } else {
        const sourceRoom = rooms.find((r) => r.id === connection.source);
        const targetRoom = rooms.find((r) => r.id === connection.target);
        const isEntryConnection = sourceRoom?.isAccessPoint || targetRoom?.isAccessPoint;
        const defaultType = isEntryConnection ? 'puerta_seguridad' : 'puerta_estandar';

        const newConn = connectRooms(
          connection.source,
          connection.target,
          defaultType,
          undefined,
          connection.sourceHandle || undefined,
          connection.targetHandle || undefined
        );
        if (newConn) setEditingConnectionId(newConn.id);
      }
    },
    [rooms, connectRooms, connectElectricalNodes]
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (!isChainMode) {
        selectRoom(node.id);
      }
    },
    [isChainMode, selectRoom]
  );

  const handleNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (!isChainMode) {
        selectRoom(node.id);
        setActivePhase('parametrization');
      }
    },
    [isChainMode, selectRoom, setActivePhase]
  );

  const handleEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    const edgeData = edge.data as { edgeType?: string; rawId?: string };
    if (edgeData?.edgeType === 'electrical' && edgeData.rawId) {
      setInspectorTramoId(edgeData.rawId);
    } else if (edgeData?.rawId) {
      setEditingConnectionId(edgeData.rawId);
    }
  }, []);

  const handlePaneClick = useCallback(() => {
    if (!isChainMode && selectedElectricalNodeId) {
      selectElectricalNode(null);
    }
  }, [isChainMode, selectedElectricalNodeId, selectElectricalNode]);

  // Eliminar un ambiente con confirmación
  const handleDeleteRoom = (roomId: string, roomName: string) => {
    if (window.confirm(`¿Estás seguro de eliminar el espacio "${roomName}" y todas sus conexiones?`)) {
      deleteRoom(roomId);
    }
  };

  // Auto-organizar nodos jerárquicamente
  const handleAutoLayout = useCallback(() => {
    const technicalNodes = rooms.filter((r) => r.isTechnicalIsland);
    const entryNodes = rooms.filter((r) => r.isAccessPoint);
    const regularNodes = rooms.filter((r) => !r.isAccessPoint && !r.isTechnicalIsland);

    technicalNodes.forEach((island, idx) => {
      updateRoomTopologyPosition(island.id, { x: 40, y: 40 + idx * 220 });
    });

    entryNodes.forEach((entry, idx) => {
      updateRoomTopologyPosition(entry.id, { x: 40, y: 300 + idx * 220 });
    });

    regularNodes.forEach((room, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      updateRoomTopologyPosition(room.id, {
        x: 380 + col * 340,
        y: 100 + row * 240
      });
    });
  }, [rooms, updateRoomTopologyPosition]);

  // Etiqueta del nodo actual de la cadena
  const chainCurrentNode = electricalNodes.find((n) => n.id === chainLastNodeId);

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative', bgcolor: '#f8fafc' }}>
      {/* 🧭 Barra Superior de Control de Capas y Acciones */}
      <Panel position="top-left" style={{ margin: isMobile ? 8 : 16, zIndex: 10, maxWidth: isMobile ? 'calc(100vw - 16px)' : undefined }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ gap: 0.8 }}>
          {/* Botón Único "+ Agregar" */}
          <AddMenuButton onAddRoom={onOpenAddRoom} />

          {/* Selector Estricto de Capas (Arquitectura vs Eléctrica) */}
          <ToggleButtonGroup
            value={topologyLayer}
            exclusive
            onChange={(_, newLayer: TopologyLayerMode | null) => {
              if (newLayer) {
                setTopologyLayer(newLayer);
                if (isChainMode) setIsChainMode(false);
              }
            }}
            size="small"
            sx={{
              bgcolor: 'background.paper',
              boxShadow: 1,
              borderRadius: 2,
              '& .MuiToggleButton-root': { px: isMobile ? 1 : 1.5, py: 0.5, fontSize: isMobile ? '0.74rem' : '0.8rem', fontWeight: 600 }
            }}
          >
            <ToggleButton value="architectural">
              <Stack direction="row" spacing={0.5} alignItems="center">
                <ArchitectureIcon sx={{ fontSize: 16 }} />
                <span>{isMobile ? 'Arq' : '🏛️ Arquitectura'}</span>
              </Stack>
            </ToggleButton>
            <ToggleButton value="electrical">
              <Stack direction="row" spacing={0.5} alignItems="center">
                <BoltIcon sx={{ fontSize: 16 }} color="primary" />
                <span>{isMobile ? 'Eléc' : '⚡ Cañerías'}</span>
              </Stack>
            </ToggleButton>
          </ToggleButtonGroup>

          {/* ⚡ Botón para Activar "Modo Conexión en Cadena (Click-to-Connect)" */}
          {topologyLayer === 'electrical' && !isChainMode && (
            <Button
              variant="contained"
              color="warning"
              size="small"
              startIcon={<LinkIcon sx={{ fontSize: 16 }} />}
              onClick={() => {
                setIsChainMode(true);
                setChainLastNodeId(null);
                setChainCount(0);
              }}
              sx={{ boxShadow: 2, fontWeight: 700, borderRadius: 2, fontSize: isMobile ? '0.72rem' : '0.8rem', px: isMobile ? 1 : 1.5 }}
            >
              {isMobile ? 'Cadena' : 'Conectar en Cadena'}
            </Button>
          )}

          {/* Botón de Auto-Organización */}
          {!isMobile && (
            <Tooltip title="Auto-ordenar espacios en cuadrícula limpia">
              <Button
                variant="outlined"
                size="small"
                startIcon={<AutoLayoutIcon />}
                onClick={handleAutoLayout}
                sx={{ bgcolor: 'background.paper', boxShadow: 1, fontWeight: 600 }}
              >
                Auto-Organizar
              </Button>
            </Tooltip>
          )}
        </Stack>
      </Panel>

      {/* ⚡ BARRA FLOTANTE DEL MODO "CONECTAR EN CADENA" (CLICK-TO-CONNECT) */}
      {isChainMode && (
        <Panel position="top-center" style={{ marginTop: 16, zIndex: 20 }}>
          <Card
            elevation={6}
            sx={{
              borderRadius: 4,
              px: 2.5,
              py: 1.2,
              bgcolor: '#1e293b',
              color: '#ffffff',
              boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
              border: '2px solid #f59e0b'
            }}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Box
                sx={{
                  p: 0.8,
                  bgcolor: '#f59e0b',
                  color: '#000',
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <LinkIcon />
              </Box>

              {/* Selector de Circuito para la Cadena */}
              <TextField
                select
                size="small"
                label="Circuito"
                value={chainCircuit}
                onChange={(e) => setChainCircuit(e.target.value)}
                sx={{
                  width: 130,
                  bgcolor: 'rgba(255,255,255,0.1)',
                  borderRadius: 1.5,
                  '& .MuiInputBase-root': { color: '#ffffff', fontSize: '0.82rem', fontWeight: 700 },
                  '& .MuiInputLabel-root': { color: '#94a3b8' }
                }}
              >
                <MenuItem value="C1-IUG">C1 - Iluminación (IUG)</MenuItem>
                <MenuItem value="C2-TUG">C2 - Tomas (TUG)</MenuItem>
                <MenuItem value="C3-TUG">C3 - Tomas Cocina (TUG)</MenuItem>
                <MenuItem value="C4-TUE">C4 - Tomas Esp. (TUE 20A)</MenuItem>
                <MenuItem value="ALIM-GRAL">Alimentador Principal</MenuItem>
              </TextField>

              {/* Selector de Diámetro de Cañería */}
              <TextField
                select
                size="small"
                label="Caño"
                value={chainDiametro}
                onChange={(e) => setChainDiametro(Number(e.target.value))}
                sx={{
                  width: 110,
                  bgcolor: 'rgba(255,255,255,0.1)',
                  borderRadius: 1.5,
                  '& .MuiInputBase-root': { color: '#ffffff', fontSize: '0.82rem', fontWeight: 700 },
                  '& .MuiInputLabel-root': { color: '#94a3b8' }
                }}
              >
                <MenuItem value={16}>Ø16 mm</MenuItem>
                <MenuItem value={19}>Ø19 mm (3/4")</MenuItem>
                <MenuItem value={22}>Ø22 mm (7/8")</MenuItem>
                <MenuItem value={25}>Ø25 mm (1")</MenuItem>
                <MenuItem value={32}>Ø32 mm</MenuItem>
              </TextField>

              {/* Instrucción Dinámica al Usuario */}
              <Box sx={{ minWidth: 260 }}>
                {!chainLastNodeId ? (
                  <Typography variant="body2" fontWeight={700} color="#fbbf24">
                    1. Haz clic en el nodo inicial (ej: TSG o Boca)
                  </Typography>
                ) : (
                  <Typography variant="body2" fontWeight={700} color="#34d399">
                    Toca la siguiente boca para unirla desde <u>{chainCurrentNode?.etiqueta}</u> ({chainCount} conectadas)
                  </Typography>
                )}
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                  Cada clic creará la cañería en serie inmediatamente
                </Typography>
              </Box>

              {/* Botón Finalizar Tendido */}
              <Button
                variant="contained"
                color="success"
                size="small"
                startIcon={<CheckIcon />}
                onClick={handleFinishChainMode}
                disabled={chainCount === 0}
                sx={{ fontWeight: 700, borderRadius: 2 }}
              >
                Listo
              </Button>

              {/* Botón Cancelar */}
              <IconButton size="small" onClick={handleCancelChainMode} sx={{ color: '#94a3b8', '&:hover': { color: '#fff' } }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Card>
        </Panel>
      )}

      {/* ⚡ Banner de Subárbol Iluminado Activo (Flotante) */}
      {!isChainMode && activeSubTree && (
        <Panel position="top-center" style={{ marginTop: 16, zIndex: 15 }}>
          <Card
            elevation={4}
            sx={{
              borderRadius: 4,
              px: 2,
              py: 0.8,
              bgcolor: 'rgba(37, 99, 235, 0.96)',
              color: '#ffffff',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35)'
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <BoltIcon sx={{ color: '#fbbf24' }} />
              <Box>
                <Typography variant="body2" fontWeight={700}>
                  Rama Completa: {activeSubTree.rootNodeLabel}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  {activeSubTree.subTreeNodeIds.size} componentes • {activeSubTree.subTreeTramoIds.size} cañerías • Circ: {Array.from(activeSubTree.circuitCodes).join(', ') || 'N/A'}
                </Typography>
              </Box>
              <Tooltip title="Quitar foco de la rama y mostrar todo">
                <IconButton
                  size="small"
                  onClick={() => selectElectricalNode(null)}
                  sx={{ color: '#ffffff', bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.35)' } }}
                >
                  <ClearFocusIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Card>
        </Panel>
      )}

      {/* ⚡ Barra Flotante de Filtro por Circuitos (Solo visible en Capa Eléctrica) */}
      {topologyLayer === 'electrical' && !isChainMode && availableCircuits.length > 0 && (
        <Panel position="top-right" style={{ margin: 16, zIndex: 10 }}>
          <Card elevation={2} sx={{ borderRadius: 3, p: 0.8, bgcolor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)' }}>
            <Stack direction="row" spacing={0.8} alignItems="center">
              <Typography variant="caption" fontWeight={700} color="text.secondary" display="flex" alignItems="center" gap={0.5} sx={{ pl: 0.5 }}>
                <FilterIcon fontSize="inherit" /> Filtrar:
              </Typography>

              <Chip
                label="Todos"
                size="small"
                onClick={() => setCircuitFilter(null)}
                color={circuitFilter === null ? 'primary' : 'default'}
                variant={circuitFilter === null ? 'filled' : 'outlined'}
                clickable
                sx={{ fontSize: '0.72rem', fontWeight: 600, height: 24 }}
              />

              {availableCircuits.map((circ) => (
                <Chip
                  key={circ}
                  label={circ}
                  size="small"
                  onClick={() => setCircuitFilter(circuitFilter === circ ? null : circ)}
                  color={circuitFilter === circ ? 'primary' : 'default'}
                  variant={circuitFilter === circ ? 'filled' : 'outlined'}
                  clickable
                  sx={{ fontSize: '0.72rem', fontWeight: 600, height: 24 }}
                />
              ))}
            </Stack>
          </Card>
        </Panel>
      )}

      {/* Tarjeta de Información del Espacio Seleccionado */}
      {selectedRoom && !isChainMode && (
        <Panel position="bottom-right" style={{ margin: 16, maxWidth: 360, zIndex: 10 }}>
          <Card elevation={3} sx={{ borderRadius: 3, border: '1px solid #e0e7ee', bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                    {selectedRoom.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {selectedRoom.isTechnicalIsland
                      ? 'Isla Técnica de Suministro'
                      : selectedRoom.isAccessPoint
                      ? 'Límite de Acceso / Parte Común'
                      : `${selectedRoom.dimensions.width}m × ${selectedRoom.dimensions.length}m • ${(
                          selectedRoom.dimensions.width * selectedRoom.dimensions.length
                        ).toFixed(1)} m²`}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDeleteRoom(selectedRoom.id, selectedRoom.name)}
                  title="Eliminar este espacio"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>

              <Divider sx={{ my: 1.2 }} />

              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<ParamIcon />}
                  onClick={() => setActivePhase('parametrization')}
                  sx={{ borderRadius: 2, fontWeight: 600 }}
                >
                  Parametrizar Paredes
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Panel>
      )}

      {/* Lienzo Principal de React Flow */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        onNodeDragStop={handleNodeDragStop}
        onConnect={handleConnect}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2.5}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
        <Controls showInteractive={false} position="bottom-left" style={{ margin: 16 }} />
        <MiniMap
          nodeColor={(n) => {
            const r = rooms.find((rm) => rm.id === n.id);
            return r?.color || '#cbd5e1';
          }}
          maskColor="rgba(240, 244, 248, 0.7)"
          style={{ height: 100, width: 140, margin: 16 }}
          position="bottom-left"
        />
      </ReactFlow>

      {/* Diálogo de Edición de Aberturas Arquitectónicas (Puertas / Ventanas) */}
      <EditOpeningDialog
        open={Boolean(editingConnectionId)}
        onClose={() => setEditingConnectionId(null)}
        connection={connections.find((c) => c.id === editingConnectionId) || null}
      />

      {/* ⚡ Inspector Lateral de Cañería (ConduitInspectorDrawer) con Ocupación AEA y Multicircuito */}
      <ConduitInspectorDrawer
        open={Boolean(inspectorTramoId)}
        onClose={() => setInspectorTramoId(null)}
        tramoId={inspectorTramoId}
      />

      {/* Diálogo para Agregar Nodo Eléctrico (Boca / Tablero) */}
      <AddElectricalNodeDialog
        open={Boolean(addElecNodeRoomId)}
        onClose={() => setAddElecNodeRoomId(null)}
        defaultRoomId={addElecNodeRoomId || undefined}
      />
    </Box>
  );
};
