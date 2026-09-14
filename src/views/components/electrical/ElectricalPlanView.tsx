/**
 * View: ElectricalPlanView (Fase 3: Gestión e Inserción Interactiva sobre Planta)
 * Permite gestionar la traza de cañerías, bocas, tableros y circuitos sobre la arquitectura:
 * - Renderizado vectorial SVG real normalizado según symbols.json (AEA / IEC)
 * - Modo "Click & Snap" para anclar automáticamente bocas a paredes (distancia métrica + rotación normal) o losa
 * - Arrastre táctil y mouse con imantación en tiempo real a muros
 * - Trazado de cañerías con arcos curvados suaves y notación reglamentaria AEA 90364-771
 * - Filtro visual por circuitos e inspector paramétrico
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Line, Group, Rect, Text } from 'react-konva';
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
  TextField,
  Chip,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RestartAlt as ResetViewIcon,
  Cable as ConduitIcon,
  Delete as DeleteIcon,
  PanTool as PointerIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useSurveyViewModel } from '@/viewmodels';
import { metersToPixels, PIXELS_PER_METER } from '@/viewmodels/utils/geometryUtils';
import { isMetricRoom } from '@/models/RoomModel';
import {
  getElementLocalPlacement,
  calculateWallAnchor
} from '@/viewmodels/utils/wallAnchorCalculator';
import { getSymbolById } from '@/models/ElectricalSymbolsModel';
import { ElectricalSymbolShape } from './ElectricalSymbolShape';
import { ConduitInspectorDrawer } from '../topology/ConduitInspectorDrawer';

const CIRCUIT_COLORS: Record<string, string> = {
  'C1-IUG': '#0284c7', // Azul iluminación
  'C2-TUG': '#d97706', // Ámbar tomas generales
  'C3-TUE': '#dc2626', // Rojo tomas especiales
  'ALIM-TSG': '#7c3aed', // Púrpura alimentador
  'ALIM-GRAL': '#7c3aed'
};

const SYMBOL_QUICK_PALETTE = [
  { id: 'sym-planta-boca-techo', label: 'Boca Techo', emoji: '💡', defaultCircuit: 'C1-IUG', prefix: 'L' },
  { id: 'sym-planta-boca-pared', label: 'Aplique', emoji: '🔦', defaultCircuit: 'C1-IUG', prefix: 'AP' },
  { id: 'sym-planta-toma', label: 'Toma 10A', emoji: '🔌', defaultCircuit: 'C2-TUG', prefix: 'T' },
  { id: 'sym-planta-toma-doble', label: 'Toma Doble', emoji: '🔌', defaultCircuit: 'C2-TUG', prefix: 'T' },
  { id: 'sym-planta-toma-20a', label: 'Toma 20A', emoji: '⚡', defaultCircuit: 'C3-TUE', prefix: 'TUE' },
  { id: 'sym-planta-llave-1', label: 'Llave 1P', emoji: '🔘', defaultCircuit: 'C1-IUG', prefix: 'SW' },
  { id: 'sym-planta-llave-2', label: 'Llave 2P', emoji: '🔘', defaultCircuit: 'C1-IUG', prefix: 'SW' },
  { id: 'sym-planta-llave-comb', label: 'Llave Comb', emoji: '🔀', defaultCircuit: 'C1-IUG', prefix: 'SWC' },
  { id: 'sym-planta-ts', label: 'Tablero TS', emoji: '🛡️', defaultCircuit: 'ALIM-TSG', prefix: 'TS' },
  { id: 'sym-planta-medidor', label: 'Medidor Wh', emoji: '📊', defaultCircuit: 'ALIM-GRAL', prefix: 'MED' },
  { id: 'sym-planta-caja-pase', label: 'Caja Pase', emoji: '📦', defaultCircuit: 'C1-IUG', prefix: 'CP' },
  { id: 'sym-planta-pat', label: 'Jabalina PAT', emoji: '⏚', defaultCircuit: 'PAT', prefix: 'PAT' }
];

export const ElectricalPlanView: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [dimensions, setDimensions] = useState({ width: 1000, height: 700 });
  const [scale, setScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 80, y: 60 });

  // Herramienta Activa: 'pointer' | 'conduit' | símbolo ID (ej: 'sym-planta-toma')
  const [activeTool, setActiveTool] = useState<string>('pointer');

  // Filtro de Circuito Activo
  const [selectedCircuitFilter, setSelectedCircuitFilter] = useState<string>('all');

  // Modo Trazado de Cañería entre Elementos
  const [routingSourceId, setRoutingSourceId] = useState<string | null>(null);

  // Modales y Drawers
  const [selectedTramoForInspector, setSelectedTramoForInspector] = useState<string | null>(null);

  const {
    rooms,
    elementosElectricos,
    selectedElementoElectricoId,
    selectElementoElectrico,
    addElementoElectrico,
    updateElementoElectrico,
    deleteElementoElectrico,
    electricalTramos
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

  // Zoom y pan táctil de 2 dedos en smartphone
  const lastCenterRef = useRef<{ x: number; y: number } | null>(null);
  const lastDistRef = useRef<number>(0);

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

      const getTouchDistance = () =>
        Math.sqrt(Math.pow(p2.clientX - p1.clientX, 2) + Math.pow(p2.clientY - p1.clientY, 2));
      const getTouchCenter = () => ({
        x: (p1.clientX + p2.clientX) / 2,
        y: (p1.clientY + p2.clientY) / 2
      });

      if (!lastCenterRef.current) {
        lastCenterRef.current = getTouchCenter();
        return;
      }
      const newCenter = getTouchCenter();
      const dist = getTouchDistance();

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

  // Coordenadas absolutas de un ElementoElectrico en el canvas
  const getElementCanvasCoordinates = useCallback(
    (el: { roomId: string; simboloId: string; anclaje: any }): { x: number; y: number } => {
      const room = rooms.find((r) => r.id === el.roomId);
      if (!room) return { x: 100, y: 100 };

      const placement = getElementLocalPlacement(el as any, room.dimensions);
      return {
        x: room.canvasPosition.x + metersToPixels(placement.xMeters),
        y: room.canvasPosition.y + metersToPixels(placement.yMeters)
      };
    },
    [rooms]
  );

  // 🖱️ Interacción Click-to-Place (Inserción con Snap a Pared o Losa)
  const handleStageClick = (e: any) => {
    // Si hicimos click en un nodo hijo o estamos arrastrando el escenario, ignorar
    if (e.target !== e.target.getStage() && e.target.name() !== 'room-bg-rect') {
      return;
    }

    if (!activeTool.startsWith('sym-')) {
      // Click en el fondo deselecciona
      selectElementoElectrico(null);
      return;
    }

    const stage = e.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    // Coordenadas métricas respecto al canvas
    const stagePointerX = (pointer.x - stage.x()) / stage.scaleX();
    const stagePointerY = (pointer.y - stage.y()) / stage.scaleX();

    // Buscar qué ambiente contiene el punto de clic
    const clickedRoom = rooms.find((r) => {
      if (!isMetricRoom(r)) return false;
      const rx = r.canvasPosition.x;
      const ry = r.canvasPosition.y;
      const rw = metersToPixels(r.dimensions.width);
      const rl = metersToPixels(r.dimensions.length);
      // Incluir un margen de tolerancia exterior para captar clicks en la cara externa de los muros
      const margin = 25;
      return (
        stagePointerX >= rx - margin &&
        stagePointerX <= rx + rw + margin &&
        stagePointerY >= ry - margin &&
        stagePointerY <= ry + rl + margin
      );
    });

    if (!clickedRoom) return;

    // Calcular posición métrica relativa al ambiente
    const localMetersX = (stagePointerX - clickedRoom.canvasPosition.x) / PIXELS_PER_METER;
    const localMetersY = (stagePointerY - clickedRoom.canvasPosition.y) / PIXELS_PER_METER;

    // Resolver anclaje a muro o centro
    const calculated = calculateWallAnchor(
      { xMeters: localMetersX, yMeters: localMetersY },
      clickedRoom.dimensions,
      0.45 // 45 cm de tolerancia de captura magnética
    );

    // Generar prefijo correlativo (ej: T1, T2, L1...)
    const preset = SYMBOL_QUICK_PALETTE.find((p) => p.id === activeTool);
    const prefix = preset?.prefix || 'E';
    const sameTypeCount = elementosElectricos.filter((el) => el.simboloId === activeTool).length;
    const nextRef = `${prefix}${sameTypeCount + 1}`;

    const circuit =
      selectedCircuitFilter !== 'all'
        ? selectedCircuitFilter
        : preset?.defaultCircuit || 'C1-IUG';

    const newEl = addElementoElectrico({
      roomId: clickedRoom.id,
      simboloId: activeTool,
      referencia: nextRef,
      circuitoId: circuit,
      ceilingHeight: clickedRoom.dimensions.height,
      anclaje: {
        modo: calculated.modo,
        pared:
          calculated.modo === 'pared' && calculated.wall
            ? {
                wall: calculated.wall,
                distanciaMeters: calculated.distanciaMeters || 0,
                lado: calculated.lado || 'interior'
              }
            : undefined,
        espacial:
          calculated.modo !== 'pared'
            ? {
                xMeters: calculated.localCoords.xMeters,
                yMeters: calculated.localCoords.yMeters
              }
            : undefined
      }
    });

    selectElementoElectrico(newEl.id);
  };

  const handleElementClick = (elementId: string) => {
    if (activeTool === 'conduit') {
      if (!routingSourceId) {
        setRoutingSourceId(elementId);
      } else if (routingSourceId !== elementId) {
        // Enlazar cañería entre ambos elementos
        // TODO: registrar conexión en store
        setRoutingSourceId(null);
        setActiveTool('pointer');
      }
      return;
    }
    selectElementoElectrico(elementId === selectedElementoElectricoId ? null : elementId);
  };

  const selectedElemento = useMemo(
    () => elementosElectricos.find((el) => el.id === selectedElementoElectricoId),
    [elementosElectricos, selectedElementoElectricoId]
  );

  const selectedElementoRoom = useMemo(
    () => (selectedElemento ? rooms.find((r) => r.id === selectedElemento.roomId) : null),
    [selectedElemento, rooms]
  );

  const visibleElementos = useMemo(() => {
    if (selectedCircuitFilter === 'all') return elementosElectricos;
    return elementosElectricos.filter((el) => el.circuitoId === selectedCircuitFilter);
  }, [elementosElectricos, selectedCircuitFilter]);

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
      {/* 🧭 Barra Superior de Herramientas Eléctricas con Paleta de Símbolos */}
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
          gap: isMobile ? 0.6 : 1,
          maxWidth: isMobile ? 'calc(100vw - 12px)' : '92vw',
          overflowX: 'auto',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
        }}
      >
        {/* Herramienta Puntero / Selección */}
        <Tooltip title="Puntero: Seleccionar y arrastrar elementos en el plano">
          <Button
            variant={activeTool === 'pointer' ? 'contained' : 'text'}
            size="small"
            startIcon={<PointerIcon fontSize="small" />}
            onClick={() => {
              setActiveTool('pointer');
              setRoutingSourceId(null);
            }}
            sx={{
              borderRadius: 6,
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.74rem',
              height: 28,
              px: 1.2,
              whiteSpace: 'nowrap',
              minWidth: 'fit-content'
            }}
          >
            Puntero
          </Button>
        </Tooltip>

        {/* Herramienta Trazar Cañería */}
        <Tooltip title="Trazar cañería entre dos bocas">
          <Button
            variant={activeTool === 'conduit' ? 'contained' : 'outlined'}
            size="small"
            color="primary"
            startIcon={<ConduitIcon fontSize="small" />}
            onClick={() => {
              setActiveTool(activeTool === 'conduit' ? 'pointer' : 'conduit');
              setRoutingSourceId(null);
            }}
            sx={{
              borderRadius: 6,
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.74rem',
              height: 28,
              px: 1.2,
              whiteSpace: 'nowrap',
              minWidth: 'fit-content'
            }}
          >
            {activeTool === 'conduit' ? (routingSourceId ? 'Click Destino...' : 'Click Origen...') : 'Cañería'}
          </Button>
        </Tooltip>

        <Box sx={{ width: '1px', height: 18, bgcolor: '#cbd5e1', mx: 0.2 }} />

        {/* 🎨 Paleta Rápida de Símbolos Normalizados */}
        <Stack direction="row" spacing={0.5} sx={{ overflowX: 'auto', py: 0.2 }}>
          {SYMBOL_QUICK_PALETTE.map((sym) => {
            const isSelected = activeTool === sym.id;
            return (
              <Tooltip key={sym.id} title={`Insertar ${sym.label} (Click en el plano)`}>
                <Chip
                  label={`${sym.emoji} ${sym.label}`}
                  size="small"
                  clickable
                  onClick={() => {
                    setActiveTool(isSelected ? 'pointer' : sym.id);
                    setRoutingSourceId(null);
                  }}
                  color={isSelected ? 'warning' : 'default'}
                  variant={isSelected ? 'filled' : 'outlined'}
                  sx={{
                    height: 26,
                    fontSize: '0.70rem',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    borderRadius: 4,
                    borderColor: isSelected ? undefined : '#cbd5e1'
                  }}
                />
              </Tooltip>
            );
          })}
        </Stack>

        <Box sx={{ width: '1px', height: 18, bgcolor: '#cbd5e1', mx: 0.2 }} />

        {/* Selector Filtro de Circuito */}
        <Select
          size="small"
          value={selectedCircuitFilter}
          onChange={(e) => setSelectedCircuitFilter(e.target.value)}
          sx={{ height: 28, fontSize: '0.72rem', fontWeight: 600, borderRadius: 6, minWidth: isMobile ? 85 : 110 }}
        >
          <MenuItem value="all">Todos</MenuItem>
          <MenuItem value="C1-IUG">🔵 C1 - IUG</MenuItem>
          <MenuItem value="C2-TUG">🟠 C2 - TUG</MenuItem>
          <MenuItem value="C3-TUE">🔴 C3 - TUE</MenuItem>
          <MenuItem value="ALIM-TSG">🟣 Alim. TSG</MenuItem>
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

      {/* ℹ️ Banner Informativo de Modo Inserción Activo */}
      {activeTool.startsWith('sym-') && (
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            top: isMobile ? 56 : 64,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 19,
            py: 0.5,
            px: 2,
            borderRadius: 6,
            bgcolor: '#d97706',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          <Typography variant="caption" fontWeight={700}>
            📍 Toca en cualquier pared para anclar el símbolo, o en el centro para losa/techo
          </Typography>
          <IconButton size="small" onClick={() => setActiveTool('pointer')} sx={{ color: '#ffffff', p: 0.2 }}>
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Paper>
      )}

      {/* 📱 Botonera Táctil Flotante para Celular */}
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
            gap: 0.3
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

      {/* 🎨 Lienzo Gráfico Konva */}
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        scaleX={scale}
        scaleY={scale}
        x={stagePos.x}
        y={stagePos.y}
        draggable={activeTool === 'pointer'}
        onDragEnd={(e) => {
          if (e.target === e.target.getStage()) {
            setStagePos({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onClick={handleStageClick}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        {/* Capa 1: Arquitectura de Fondo (Estilo Blueprint Técnico Limpio) */}
        <Layer>
          {rooms.map((room) => {
            const isMetric = isMetricRoom(room);
            const w = isMetric ? metersToPixels(room.dimensions?.width || 3) : 180;
            const h = isMetric ? metersToPixels(room.dimensions?.length || 2.5) : 120;

            return (
              <Group key={`arch-bg-${room.id}`} x={room.canvasPosition.x} y={room.canvasPosition.y}>
                <Rect
                  name="room-bg-rect"
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
                  listening={false}
                />
                {isMetric && (
                  <Text
                    text={`${room.dimensions.width}m × ${room.dimensions.length}m`}
                    x={8}
                    y={24}
                    fontSize={9}
                    fontFamily="Outfit, sans-serif"
                    fill="#cbd5e1"
                    listening={false}
                  />
                )}
              </Group>
            );
          })}
        </Layer>

        {/* Capa 2: Cañerías Curvadas y Notación Reglamentaria AEA */}
        <Layer>
          {electricalTramos.map((tramo) => {
            // Conectar mediante las coordenadas de los extremos
            const sEl = visibleElementos.find((e) => e.id === tramo.sourceNodeId);
            const tEl = visibleElementos.find((e) => e.id === tramo.targetNodeId);
            if (!sEl || !tEl) return null;

            const sPos = getElementCanvasCoordinates(sEl);
            const tPos = getElementCanvasCoordinates(tEl);

            const color = CIRCUIT_COLORS[tramo.circuitoCodigo || ''] || '#475569';
            const isSelected = tramo.id === selectedTramoForInspector;

            // Arco curvado suave cuadrático para emular el tendido de cañería real
            const midX = (sPos.x + tPos.x) / 2;
            const midY = (sPos.y + tPos.y) / 2;
            const dx = tPos.x - sPos.x;
            const dy = tPos.y - sPos.y;
            const len = Math.hypot(dx, dy);
            const curvature = Math.min(len * 0.15, 25);
            const ctrlX = midX - (dy / (len || 1)) * curvature;
            const ctrlY = midY + (dx / (len || 1)) * curvature;

            return (
              <Group
                key={tramo.id}
                onClick={() => setSelectedTramoForInspector(tramo.id)}
                onTap={() => setSelectedTramoForInspector(tramo.id)}
              >
                <Line
                  points={[sPos.x, sPos.y, ctrlX, ctrlY, tPos.x, tPos.y]}
                  stroke={color}
                  strokeWidth={isSelected ? 4 : 2}
                  tension={0.3}
                  hitStrokeWidth={14}
                  dash={tramo.tipoMontaje === 'losa' ? [6, 4] : undefined}
                />
                <Text
                  text={`${tramo.circuitoCodigo || 'C1'} • Ø${tramo.diametroCañoMm || 19}`}
                  x={ctrlX - 25}
                  y={ctrlY - 8}
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

        {/* Capa 3: Símbolos Eléctricos SVG Normalizados (IRAM / AEA) con Anclaje Paramétrico */}
        <Layer>
          {visibleElementos.map((elemento) => {
            const room = rooms.find((r) => r.id === elemento.roomId);
            if (!room) return null;

            const circuitColor = elemento.circuitoId
              ? CIRCUIT_COLORS[elemento.circuitoId] || '#0284c7'
              : '#0284c7';

            return (
              <ElectricalSymbolShape
                key={elemento.id}
                elemento={elemento}
                room={room}
                isSelected={elemento.id === selectedElementoElectricoId}
                isRoutingSource={elemento.id === routingSourceId}
                circuitColor={circuitColor}
                onSelect={selectElementoElectrico}
                onAnchorChange={(id, newAnchor) => updateElementoElectrico(id, { anclaje: newAnchor })}
                onClick={handleElementClick}
              />
            );
          })}
        </Layer>
      </Stage>

      {/* 🏷️ Panel Flotante del Elemento Seleccionado (Edición Paramétrica In-Situ) */}
      {selectedElemento && (
        <Paper
          elevation={5}
          sx={{
            position: 'absolute',
            bottom: isMobile ? 80 : 24,
            right: isMobile ? 14 : 24,
            zIndex: 20,
            p: 1.5,
            borderRadius: 3,
            bgcolor: '#ffffff',
            border: '1.5px solid #0284c7',
            width: isMobile ? 'calc(100vw - 28px)' : 310,
            boxShadow: '0 8px 30px rgba(0,0,0,0.12)'
          }}
        >
          <Stack spacing={1.2}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2" fontWeight={700} color="#0f172a">
                {getSymbolById(selectedElemento.simboloId)?.label || 'Elemento Eléctrico'}
                {selectedElementoRoom ? ` • ${selectedElementoRoom.name}` : ''}
              </Typography>
              <IconButton size="small" onClick={() => selectElementoElectrico(null)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>

            <Box display="flex" gap={1}>
              <TextField
                label="Referencia"
                size="small"
                value={selectedElemento.referencia}
                onChange={(e) => updateElementoElectrico(selectedElemento.id, { referencia: e.target.value })}
                sx={{ flex: 1 }}
              />
              <TextField
                select
                label="Circuito"
                size="small"
                value={selectedElemento.circuitoId || 'C1-IUG'}
                onChange={(e) => updateElementoElectrico(selectedElemento.id, { circuitoId: e.target.value })}
                sx={{ flex: 1.2 }}
              >
                <MenuItem value="C1-IUG">🔵 C1 - IUG</MenuItem>
                <MenuItem value="C2-TUG">🟠 C2 - TUG</MenuItem>
                <MenuItem value="C3-TUE">🔴 C3 - TUE</MenuItem>
                <MenuItem value="ALIM-TSG">🟣 Alim. TSG</MenuItem>
              </TextField>
            </Box>

            {/* Efectos (si es interruptor o boca comandada) */}
            {(selectedElemento.simboloId.includes('llave') || selectedElemento.simboloId.includes('boca')) && (
              <TextField
                label="Efectos de Encendido"
                size="small"
                value={selectedElemento.efectos || ''}
                placeholder="Ej: a, b"
                onChange={(e) => updateElementoElectrico(selectedElemento.id, { efectos: e.target.value })}
                fullWidth
              />
            )}

            {/* Datos de Anclaje y Altura */}
            <Box display="flex" justifyContent="space-between" alignItems="center" bgcolor="#f1f5f9" p={0.8} borderRadius={2}>
              <Typography variant="caption" color="text.secondary">
                {selectedElemento.anclaje.modo === 'pared' && selectedElemento.anclaje.pared
                  ? `Pared ${selectedElemento.anclaje.pared.wall.toUpperCase()} • ${selectedElemento.anclaje.pared.distanciaMeters.toFixed(2)}m (${selectedElemento.anclaje.pared.lado})`
                  : `Losa / Techo (${selectedElemento.anclaje.espacial?.xMeters.toFixed(2)}m, ${selectedElemento.anclaje.espacial?.yMeters.toFixed(2)}m)`}
              </Typography>
              <Chip
                label={`h: ${selectedElemento.alturaMontajeMeters.toFixed(2)}m`}
                size="small"
                sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600 }}
              />
            </Box>

            <Box display="flex" justifyContent="flex-end" gap={1}>
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<DeleteIcon fontSize="small" />}
                onClick={() => deleteElementoElectrico(selectedElemento.id)}
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
              >
                Eliminar
              </Button>
            </Box>
          </Stack>
        </Paper>
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
