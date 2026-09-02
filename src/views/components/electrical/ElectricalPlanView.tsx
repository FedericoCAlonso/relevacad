/**
 * View: ElectricalPlanView (Fase 2: Gestión de Instalación Eléctrica sobre Planta)
 * Permite gestionar la traza de cañerías, bocas, tableros y circuitos sobre la arquitectura:
 * - Renderizado de planta arquitectónica en estilo plano técnico atenuado
 * - Ubicación interactiva de TSG, bocas de iluminación (IUG), tomas (TUG/TUE) y Jabalina PAT
 * - Trazado de cañerías (tramos) con cálculo de ocupación y conductores AEA 90364
 * - Filtro visual por circuitos y panel inspector de conductores
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Line, Group, Rect, Circle, Text } from 'react-konva';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Tooltip,
  Stack,
  Paper,
  MenuItem,
  Select,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RestartAlt as ResetViewIcon,
  Add as AddIcon,
  Cable as ConduitIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useSurveyViewModel } from '@/viewmodels';
import { metersToPixels } from '@/viewmodels/utils/geometryUtils';
import { isMetricRoom } from '@/models/RoomModel';
import {
  TIPO_NODO_ELECTRICO_CATALOG,
  getConduitAeaNotation,
  NodoElectrico
} from '@/models/ElectricalGraphModel';
import { AddElectricalNodeDialog } from '../topology/AddElectricalNodeDialog';
import { ConduitInspectorDrawer } from '../topology/ConduitInspectorDrawer';

const CIRCUIT_COLORS: Record<string, string> = {
  'C1-IUG': '#0284c7', // Azul iluminación
  'C2-TUG': '#d97706', // Ámbar tomas generales
  'C3-TUE': '#dc2626', // Rojo tomas especiales
  'ALIM-GRAL': '#7c3aed' // Púrpura acometida
};

export const ElectricalPlanView: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [dimensions, setDimensions] = useState({ width: 1000, height: 700 });
  const [scale, setScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 80, y: 60 });

  // Filtro de Circuito Activo
  const [selectedCircuitFilter, setSelectedCircuitFilter] = useState<string>('all');

  // Modo Trazado de Cañería
  const [isRoutingMode, setIsRoutingMode] = useState(false);
  const [routingSourceNodeId, setRoutingSourceNodeId] = useState<string | null>(null);

  // Modales y Drawers
  const [addNodeOpen, setAddNodeOpen] = useState(false);
  const [selectedTramoForInspector, setSelectedTramoForInspector] = useState<string | null>(null);

  const {
    rooms,
    electricalNodes,
    electricalTramos,
    selectedElectricalNodeId,
    selectElectricalNode,
    deleteNodoElectrico,
    connectElectricalNodes
  } = useSurveyViewModel();

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth;
        const h = containerRef.current.offsetHeight;
        if (w > 0 && h > 0) {
          setDimensions((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
        }
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleZoom = useCallback((factor: number) => {
    setScale((prev) => Math.max(0.3, Math.min(prev * factor, 3)));
  }, []);

  const handleResetView = useCallback(() => {
    setScale(1);
    setStagePos({ x: 80, y: 60 });
  }, []);

  // Refs para zoom y pan táctil con 2 dedos en smartphone
  const lastCenterRef = useRef<{ x: number; y: number } | null>(null);
  const lastDistRef = useRef<number>(0);

  const getTouchDistance = (p1: { clientX: number; clientY: number }, p2: { clientX: number; clientY: number }) => {
    return Math.sqrt(Math.pow(p2.clientX - p1.clientX, 2) + Math.pow(p2.clientY - p1.clientY, 2));
  };

  const getTouchCenter = (p1: { clientX: number; clientY: number }, p2: { clientX: number; clientY: number }) => {
    return {
      x: (p1.clientX + p2.clientX) / 2,
      y: (p1.clientY + p2.clientY) / 2
    };
  };

  const handleTouchMove = useCallback((e: any) => {
    const touch1 = e.evt.touches[0];
    const touch2 = e.evt.touches[1];

    if (touch1 && touch2) {
      const stage = e.target.getStage();
      if (!stage) return;

      if (stage.isDragging()) {
        stage.stopDrag();
      }

      const p1 = { clientX: touch1.clientX, clientY: touch1.clientY };
      const p2 = { clientX: touch2.clientX, clientY: touch2.clientY };

      if (!lastCenterRef.current) {
        lastCenterRef.current = getTouchCenter(p1, p2);
        return;
      }
      const newCenter = getTouchCenter(p1, p2);

      const dist = getTouchDistance(p1, p2);
      if (!lastDistRef.current) {
        lastDistRef.current = dist;
      }

      const pointTo = {
        x: (newCenter.x - stage.x()) / stage.scaleX(),
        y: (newCenter.y - stage.y()) / stage.scaleX()
      };

      const scaleBy = dist / lastDistRef.current;
      const newScale = Math.max(0.3, Math.min(stage.scaleX() * scaleBy, 3));

      const dx = newCenter.x - lastCenterRef.current.x;
      const dy = newCenter.y - lastCenterRef.current.y;

      const newPos = {
        x: newCenter.x - pointTo.x * newScale + dx,
        y: newCenter.y - pointTo.y * newScale + dy
      };

      setScale(newScale);
      setStagePos(newPos);

      lastDistRef.current = dist;
      lastCenterRef.current = newCenter;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    lastDistRef.current = 0;
    lastCenterRef.current = null;
  }, []);

  const handleWheel = useCallback((e: any) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const factor = 1.08;
    const newScale = Math.max(0.3, Math.min(direction > 0 ? oldScale * factor : oldScale / factor, 3));

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale
    };

    setScale(newScale);
    setStagePos(newPos);
  }, []);

  // Calcular posición absoluta en el canvas de cada nodo eléctrico
  const getNodeCanvasCoordinates = useCallback(
    (node: NodoElectrico): { x: number; y: number } => {
      const room = rooms.find((r) => r.id === node.roomId);
      if (!room) return { x: 100, y: 100 };

      const rW = isMetricRoom(room) ? metersToPixels(room.dimensions?.width || 3) : 180;
      const rH = isMetricRoom(room) ? metersToPixels(room.dimensions?.length || 2.5) : 100;

      const roomX = room.canvasPosition.x;
      const roomY = room.canvasPosition.y;

      if (node.tipo === 'tablero_principal' || node.tipo === 'tablero_seccional') {
        return { x: roomX + 30, y: roomY + 30 };
      }
      if (node.tipo === 'boca_iluminacion') {
        return { x: roomX + rW / 2, y: roomY + rH / 2 };
      }
      if (node.tipo === 'boca_tomacorriente') {
        return { x: roomX + rW - 20, y: roomY + rH / 2 };
      }
      if (node.tipo === 'caja_paso_comun' || node.tipo === 'caja_derivacion') {
        return { x: roomX + rW / 2, y: roomY + 16 };
      }
      if (node.tipo === 'jabalina_pat') {
        return { x: roomX + rW / 2, y: roomY + rH / 2 };
      }

      return { x: roomX + rW / 2, y: roomY + rH / 2 };
    },
    [rooms]
  );

  const handleNodeClick = (nodeId: string) => {
    if (isRoutingMode) {
      if (!routingSourceNodeId) {
        setRoutingSourceNodeId(nodeId);
      } else if (routingSourceNodeId !== nodeId) {
        connectElectricalNodes(routingSourceNodeId, nodeId);
        setRoutingSourceNodeId(null);
        setIsRoutingMode(false);
      }
      return;
    }
    selectElectricalNode(nodeId === selectedElectricalNodeId ? null : nodeId);
  };

  const visibleTramos = useMemo(() => {
    if (selectedCircuitFilter === 'all') return electricalTramos;
    return electricalTramos.filter((t) => t.circuitoCodigo === selectedCircuitFilter);
  }, [electricalTramos, selectedCircuitFilter]);

  const selectedNode = useMemo(
    () => electricalNodes.find((n) => n.id === selectedElectricalNodeId),
    [electricalNodes, selectedElectricalNodeId]
  );

  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        bgcolor: '#f8fafc',
        touchAction: 'none'
      }}
    >
      {/* 🧭 Barra Superior de Herramientas Eléctricas */}
      <Paper
        elevation={3}
        sx={{
          position: 'absolute',
          top: isMobile ? 8 : 14,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          borderRadius: 8,
          py: 0.5,
          px: isMobile ? 0.8 : 1.5,
          bgcolor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(226, 232, 240, 0.9)',
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? 0.8 : 1.2,
          maxWidth: isMobile ? 'calc(100vw - 12px)' : undefined,
          overflowX: 'auto'
        }}
      >
        {/* Botón Agregar Boca Eléctrica */}
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon fontSize="small" />}
          onClick={() => setAddNodeOpen(true)}
          sx={{
            borderRadius: 6,
            textTransform: 'none',
            fontWeight: 700,
            fontSize: isMobile ? '0.74rem' : '0.78rem',
            height: 28,
            px: isMobile ? 1 : 1.5,
            bgcolor: '#d97706',
            '&:hover': { bgcolor: '#b45309' },
            boxShadow: 'none',
            whiteSpace: 'nowrap',
            minWidth: 'fit-content'
          }}
        >
          {isMobile ? '+ Boca' : '+ Boca Eléctrica'}
        </Button>

        {/* Botón Trazar Cañería */}
        <Tooltip title="Hacer click en dos bocas para tender un caño entre ellas">
          <Button
            variant={isRoutingMode ? 'contained' : 'outlined'}
            size="small"
            color="primary"
            startIcon={<ConduitIcon fontSize="small" />}
            onClick={() => {
              setIsRoutingMode(!isRoutingMode);
              setRoutingSourceNodeId(null);
            }}
            sx={{
              borderRadius: 6,
              textTransform: 'none',
              fontWeight: 700,
              fontSize: isMobile ? '0.74rem' : '0.78rem',
              height: 28,
              px: isMobile ? 1 : 1.5,
              whiteSpace: 'nowrap',
              minWidth: 'fit-content'
            }}
          >
            {isRoutingMode
              ? (routingSourceNodeId ? (isMobile ? 'Destino...' : 'Click destino...') : (isMobile ? 'Origen...' : 'Click origen...'))
              : (isMobile ? 'Trazar' : 'Trazar Cañería')}
          </Button>
        </Tooltip>

        {/* Selector Filtro de Circuito */}
        <Select
          size="small"
          value={selectedCircuitFilter}
          onChange={(e) => setSelectedCircuitFilter(e.target.value)}
          sx={{ height: 28, fontSize: '0.74rem', fontWeight: 600, borderRadius: 6, minWidth: isMobile ? 95 : 120 }}
        >
          <MenuItem value="all">Todos</MenuItem>
          <MenuItem value="C1-IUG">🔵 C1 - IUG</MenuItem>
          <MenuItem value="C2-TUG">🟠 C2 - TUG</MenuItem>
          <MenuItem value="C3-TUE">🔴 C3 - TUE</MenuItem>
        </Select>

        {/* Zoom en Desktop */}
        {!isMobile && (
          <Stack direction="row" spacing={0.3}>
            <IconButton size="small" onClick={() => handleZoom(1.15)}>
              <ZoomInIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => handleZoom(0.85)}>
              <ZoomOutIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={handleResetView}>
              <ResetViewIcon fontSize="small" />
            </IconButton>
          </Stack>
        )}
      </Paper>

      {/* 📱 Botonera Táctil Flotante para Navegación con los Dedos en Celular */}
      {isMobile && (
        <Paper
          elevation={4}
          sx={{
            position: 'absolute',
            bottom: 74,
            left: 14,
            zIndex: 20,
            borderRadius: 4,
            p: 0.4,
            bgcolor: 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(226, 232, 240, 0.9)',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.3,
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)'
          }}
        >
          <IconButton size="small" onClick={() => handleZoom(1.2)} sx={{ p: 0.8 }} title="Acercar">
            <ZoomInIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => handleZoom(0.8)} sx={{ p: 0.8 }} title="Alejar">
            <ZoomOutIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={handleResetView} sx={{ p: 0.8 }} title="Centrar Plano">
            <ResetViewIcon fontSize="small" />
          </IconButton>
        </Paper>
      )}

      {/* Banner de Modo Trazado */}
      {isRoutingMode && (
        <Paper
          elevation={4}
          sx={{
            position: 'absolute',
            top: 64,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 19,
            py: 0.6,
            px: 2,
            borderRadius: 3,
            bgcolor: '#0284c7',
            color: '#ffffff'
          }}
        >
          <Typography variant="caption" fontWeight={700}>
            ⚡ {routingSourceNodeId ? 'Paso 2: Haz click en la boca destino para tender la cañería' : 'Paso 1: Selecciona la boca o tablero de partida'}
          </Typography>
        </Paper>
      )}

      {/* Lienzo Konva */}
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        scaleX={scale}
        scaleY={scale}
        x={stagePos.x}
        y={stagePos.y}
        draggable
        onDragEnd={(e) => {
          if (e.target === e.target.getStage()) {
            setStagePos({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        {/* Capa 1: Arquitectura de Fondo (Estilo Blueprint Técnico Atenuado) */}
        <Layer listening={false}>
          {rooms.map((room) => {
            const isTechnical = room.isTechnicalIsland || room.type.startsWith('technical_island');
            const isMetric = isMetricRoom(room);

            if (isTechnical) {
              const side = 54;
              return (
                <Group key={`arch-bg-${room.id}`} x={room.canvasPosition.x} y={room.canvasPosition.y}>
                  <Rect x={0} y={0} width={side} height={side} fill="#fffbeb" stroke="#d97706" strokeWidth={1.5} cornerRadius={4} />
                  <Text text="⚡" x={0} y={8} fontSize={14} width={side} align="center" />
                  <Text text={room.name} x={2} y={26} fontSize={7.5} fontStyle="bold" fontFamily="Outfit, sans-serif" fill="#92400e" width={side - 4} align="center" />
                </Group>
              );
            }

            if (!isMetric) {
              const isPalier = room.isAccessPoint || room.type === 'access_palier';
              const w = metersToPixels(room.dimensions?.width > 0 ? room.dimensions.width : 2.5);
              const h = metersToPixels(room.dimensions?.length > 0 ? room.dimensions.length : 2.5);
              const radius = Math.max(w, h) * 0.55;
              return (
                <Group key={`arch-bg-${room.id}`} x={room.canvasPosition.x} y={room.canvasPosition.y}>
                  <Circle
                    x={w / 2}
                    y={h / 2}
                    radius={radius}
                    fillRadialGradientStartPoint={{ x: 0, y: 0 }}
                    fillRadialGradientStartRadius={0}
                    fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                    fillRadialGradientEndRadius={radius}
                    fillRadialGradientColorStops={[0, isPalier ? 'rgba(16, 185, 129, 0.20)' : 'rgba(148, 163, 184, 0.16)', 1, 'rgba(255, 255, 255, 0)']}
                    strokeEnabled={false}
                  />
                  <Text text={room.name} x={0} y={h / 2 - 6} fontSize={10} fontStyle="bold" fontFamily="Outfit, sans-serif" fill="#64748b" width={w} align="center" />
                </Group>
              );
            }

            const w = metersToPixels(room.dimensions?.width || 3);
            const h = metersToPixels(room.dimensions?.length || 2.5);
            return (
              <Group key={`arch-bg-${room.id}`} x={room.canvasPosition.x} y={room.canvasPosition.y}>
                <Rect
                  x={0}
                  y={0}
                  width={w}
                  height={h}
                  fill="#ffffff"
                  stroke="#cbd5e1"
                  strokeWidth={1.5}
                />
                <Text
                  text={room.name}
                  x={8}
                  y={8}
                  fontSize={11}
                  fontStyle="bold"
                  fontFamily="Outfit, sans-serif"
                  fill="#94a3b8"
                />
              </Group>
            );
          })}
        </Layer>

        {/* Capa 2: Cañerías Eléctricas (Tramos de Caño) */}
        <Layer>
          {visibleTramos.map((tramo) => {
            const sNode = electricalNodes.find((n) => n.id === tramo.sourceNodeId);
            const tNode = electricalNodes.find((n) => n.id === tramo.targetNodeId);
            if (!sNode || !tNode) return null;

            const sPos = getNodeCanvasCoordinates(sNode);
            const tPos = getNodeCanvasCoordinates(tNode);

            const color = CIRCUIT_COLORS[tramo.circuitoCodigo || ''] || '#475569';
            const notation = getConduitAeaNotation(tramo);

            const isSelected = tramo.id === selectedTramoForInspector;

            return (
              <Group
                key={tramo.id}
                onClick={() => setSelectedTramoForInspector(tramo.id)}
                onTap={() => setSelectedTramoForInspector(tramo.id)}
              >
                <Line
                  points={[sPos.x, sPos.y, tPos.x, tPos.y]}
                  stroke={color}
                  strokeWidth={isSelected ? 4 : 2.5}
                  dash={tramo.tipoMontaje === 'losa' ? [8, 4] : undefined}
                  hitStrokeWidth={14}
                />
                <Text
                  text={notation}
                  x={(sPos.x + tPos.x) / 2 - 25}
                  y={(sPos.y + tPos.y) / 2 - 10}
                  fontSize={8.5}
                  fontStyle="bold"
                  fontFamily="Outfit, sans-serif"
                  fill={color}
                  listening={false}
                />
              </Group>
            );
          })}
        </Layer>

        {/* Capa 3: Nodos Eléctricos (Bocas, TSG, Jabalina) */}
        <Layer>
          {electricalNodes.map((node) => {
            const pos = getNodeCanvasCoordinates(node);
            const meta = TIPO_NODO_ELECTRICO_CATALOG[node.tipo] || { label: 'Boca', emoji: '💡' };
            const isSelected = node.id === selectedElectricalNodeId;
            const isRoutingSource = node.id === routingSourceNodeId;
            const isTSG = node.tipo === 'tablero_principal' || node.tipo === 'tablero_seccional';

            return (
              <Group
                key={node.id}
                x={pos.x}
                y={pos.y}
                onClick={() => handleNodeClick(node.id)}
                onTap={() => handleNodeClick(node.id)}
              >
                {isTSG ? (
                  <Group>
                    <Rect
                      x={-12}
                      y={-12}
                      width={24}
                      height={24}
                      fill="#ffffff"
                      stroke="#0f172a"
                      strokeWidth={2}
                    />
                    <Line points={[-12, -12, 12, 12]} stroke="#0f172a" strokeWidth={1.5} />
                    <Text
                      text="TSG"
                      x={-10}
                      y={-22}
                      fontSize={9}
                      fontStyle="bold"
                      fill="#0f172a"
                      listening={false}
                    />
                  </Group>
                ) : (
                  <Group>
                    <Circle
                      radius={isSelected || isRoutingSource ? 13 : 10}
                      fill={isRoutingSource ? '#0284c7' : isSelected ? '#f59e0b' : '#ffffff'}
                      stroke={node.tipo === 'boca_tomacorriente' ? '#d97706' : '#0284c7'}
                      strokeWidth={2}
                    />
                    <Text
                      text={meta.emoji}
                      x={-6}
                      y={-6}
                      fontSize={11}
                      listening={false}
                    />
                  </Group>
                )}
                <Text
                  text={node.etiqueta}
                  x={-25}
                  y={14}
                  fontSize={8}
                  fontFamily="Outfit, sans-serif"
                  fill="#334155"
                  width={50}
                  align="center"
                  listening={false}
                />
              </Group>
            );
          })}
        </Layer>
      </Stage>

      {/* Tarjeta Flotante del Nodo Seleccionado */}
      {selectedNode && (
        <Paper
          elevation={4}
          sx={{
            position: 'absolute',
            bottom: isMobile ? 80 : 20,
            right: 20,
            zIndex: 20,
            p: 1.5,
            borderRadius: 3,
            bgcolor: '#ffffff',
            border: '1.5px solid #d97706',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5
          }}
        >
          <Box>
            <Typography variant="body2" fontWeight={700} color="#0f172a">
              {selectedNode.etiqueta}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {TIPO_NODO_ELECTRICO_CATALOG[selectedNode.tipo]?.label || selectedNode.tipo}
            </Typography>
          </Box>
          <IconButton
            size="small"
            color="error"
            onClick={() => deleteNodoElectrico(selectedNode.id)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Paper>
      )}

      {/* Diálogo para Agregar Boca Eléctrica */}
      {addNodeOpen && (
        <AddElectricalNodeDialog
          open={addNodeOpen}
          onClose={() => setAddNodeOpen(false)}
        />
      )}

      {/* Drawer Inspector de Cañerías y Cables */}
      <ConduitInspectorDrawer
        open={Boolean(selectedTramoForInspector)}
        onClose={() => setSelectedTramoForInspector(null)}
        tramoId={selectedTramoForInspector}
      />
    </Box>
  );
};
