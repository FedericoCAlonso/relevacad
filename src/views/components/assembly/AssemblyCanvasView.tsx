/**
 * View: AssemblyCanvasView (Fase 3: Vista de Ensamblaje Canvas 2D)
 * Renderizado gráfico planimétrico de los ambientes como recinto arquitectónico real:
 * - Muros con espesor constructivo parametrizable (10cm, 15cm, 20cm)
 * - Dimensiones netas tomadas desde el interior de cada ambiente
 * - Aberturas arquitectónicas CAD reales en los muros (hojas batientes, corredizas y vanos)
 * - Barra de herramientas flotante compacta y elegante (Glassmorphic Pill)
 * - Snap magnético interactivo (~15px) con arrastre nativo a 60fps
 */

import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { Stage, Layer, Line, Group, Text, Rect } from 'react-konva';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Button,
  Tooltip,
  Stack,
  Paper,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RestartAlt as ResetViewIcon,
  AutoFixHigh as SnapIcon,
  AutoAwesome as AutoLayoutIcon,
  ViewInAr as WallIcon,
  MeetingRoom as DoorIcon,
  AccountTree as TopologyLinesIcon,
  Architecture as ArchPlanIcon,
  Add as AddIcon,
  CallMerge as MergeIcon
} from '@mui/icons-material';
import { useSurveyViewModel } from '@/viewmodels';
import { useSurveyStore } from '@/viewmodels/surveyStore';
import { SnapGuideLine } from '@/viewmodels/utils/snappingCalculator';
import { metersToPixels, PIXELS_PER_METER } from '@/viewmodels/utils/geometryUtils';
import { canRoomsBeMerged } from '@/viewmodels/utils/booleanRoomUnion';
import { CONNECTION_TYPE_CATALOG, LogicalConnection } from '@/models/GraphModel';
import { WallOrientation, isMetricRoom, isParcelBoundaryNode } from '@/models/RoomModel';
import { RoomAssemblyShape } from './RoomAssemblyShape';
import { EditOpeningDialog } from '../topology/EditOpeningDialog';
import { RoomDetailDialog } from '../topology/RoomDetailDialog';

interface AssemblyCanvasViewProps {
  onOpenAddRoom?: (defaultTab?: 'interior' | 'access' | 'technical') => void;
}

const SnapActiveBadge: React.FC = memo(() => {
  const activeSnapGuides = useSurveyStore((state) => state.activeSnapGuides);
  if (!activeSnapGuides || activeSnapGuides.length === 0) return null;
  return (
    <Paper
      elevation={1}
      sx={{
        position: 'absolute',
        bottom: 14,
        left: 14,
        zIndex: 10,
        py: 0.4,
        px: 1.2,
        borderRadius: 2,
        bgcolor: '#0284c7',
        color: '#ffffff',
        pointerEvents: 'none'
      }}
    >
      <Typography variant="caption" fontWeight={600} display="flex" alignItems="center" gap={0.5}>
        ⚡ Snap Activo ({activeSnapGuides.length} aristas)
      </Typography>
    </Paper>
  );
});

const SnapGuidesLayer: React.FC = memo(() => {
  const activeSnapGuides = useSurveyStore((state) => state.activeSnapGuides);
  if (!activeSnapGuides || activeSnapGuides.length === 0) return null;

  return (
    <Layer listening={false}>
      {activeSnapGuides.map((guide) => {
        const points =
          guide.orientation === 'vertical'
            ? [guide.position, guide.start, guide.position, guide.end]
            : [guide.start, guide.position, guide.end, guide.position];

        const isTopo = guide.isTopologicalAdjacency;
        const isProj = guide.snapType === 'projection_face';
        const isCenter = guide.snapType === 'center';
        const strokeColor = isTopo ? '#10b981' : isProj ? '#0284c7' : isCenter ? '#d97706' : '#00e5ff';

        return (
          <Group key={guide.id}>
            <Line
              points={points}
              stroke={strokeColor}
              strokeWidth={isTopo ? 3 : 2}
              dash={isTopo ? [8, 3] : isProj ? [10, 4] : [6, 4]}
              shadowColor={strokeColor}
              shadowBlur={6}
              perfectDrawEnabled={false}
            />
            {guide.label && (
              <Text
                text={guide.label}
                x={guide.orientation === 'vertical' ? guide.position + 6 : guide.start + 12}
                y={guide.orientation === 'vertical' ? guide.start + 12 : guide.position + 6}
                fontSize={9}
                fontStyle="bold"
                fontFamily="Outfit, sans-serif"
                fill={strokeColor}
                perfectDrawEnabled={false}
              />
            )}
          </Group>
        );
      })}
    </Layer>
  );
});

export const AssemblyCanvasView: React.FC<AssemblyCanvasViewProps> = ({ onOpenAddRoom }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [dimensions, setDimensions] = useState({ width: 1000, height: 700 });
  const [scale, setScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 80, y: 60 });
  const [showAbstractEdges, setShowAbstractEdges] = useState(false);

  // Modales de Inspección de Pared/Abertura y Detalle de Ambiente
  const [editingConnection, setEditingConnection] = useState<LogicalConnection | null>(null);
  const [detailRoomId, setDetailRoomId] = useState<string | null>(null);

  // Menú flotante compacto para Espesor de Muro
  const [wallMenuAnchor, setWallMenuAnchor] = useState<null | HTMLElement>(null);

  const {
    rooms,
    connections,
    selectedRoomId,
    selectedRoom,
    selectRoom,
    autoAssembleRooms,
    isSnapEnabled,
    toggleSnap,
    handleRoomDrag,
    handleRoomDragEnd,
    wallThicknessMeters,
    setWallThickness,
    getOrCreateWallConnection,
    updateRoomDimensions
  } = useSurveyViewModel();

  const syncRoomWallAdjacencies = useSurveyStore((state) => state.syncRoomWallAdjacencies);
  const updateConnection = useSurveyStore((state) => state.updateConnection);
  const setSnapGuides = useSurveyStore((state) => state.setSnapGuides);
  const mergeRooms = useSurveyStore((state) => state.mergeRooms);

  const [mergeConfirmOpen, setMergeConfirmOpen] = useState(false);
  const [mergeCustomName, setMergeCustomName] = useState('');

  // Conexión adyacente con vecino (si existe muro o límite común)
  const adjacentConn = useMemo(() => {
    if (!selectedRoomId) return null;
    return (
      connections.find(
        (c) => c.sourceRoomId === selectedRoomId || c.targetRoomId === selectedRoomId
      ) || null
    );
  }, [selectedRoomId, connections]);

  const adjacentNeighbor = useMemo(() => {
    if (!adjacentConn || !selectedRoomId) return null;
    const neighborId =
      adjacentConn.sourceRoomId === selectedRoomId
        ? adjacentConn.targetRoomId
        : adjacentConn.sourceRoomId;
    return rooms.find((r) => r.id === neighborId) || null;
  }, [adjacentConn, selectedRoomId, rooms]);

  const canMergeWithNeighbor = useMemo(() => {
    if (!selectedRoom || !adjacentNeighbor) return false;
    return canRoomsBeMerged(selectedRoom, adjacentNeighbor);
  }, [selectedRoom, adjacentNeighbor]);

  const selectedRoomWidthPx =
    selectedRoom && isMetricRoom(selectedRoom)
      ? metersToPixels(selectedRoom.dimensions?.width || 3.0)
      : 0;
  const selectedRoomLengthPx =
    selectedRoom && isMetricRoom(selectedRoom)
      ? metersToPixels(selectedRoom.dimensions?.length || 2.5)
      : 0;

  const handleResizeWidthDragMove = useCallback(
    (e: any) => {
      if (!selectedRoom || !isMetricRoom(selectedRoom)) return;
      // Bloquear Y rígidamente a la posición del ambiente
      e.target.y(selectedRoom.canvasPosition.y);
      const currentHandleX = Math.max(selectedRoom.canvasPosition.x + 30, e.target.x());
      e.target.x(currentHandleX);

      const sX = selectedRoom.canvasPosition.x;
      const sY = selectedRoom.canvasPosition.y;
      const sL = metersToPixels(selectedRoom.dimensions?.length || 2.5);

      let snappedX = currentHandleX;
      let bestGuide: SnapGuideLine | null = null;
      let minD = isMobile ? 32 : 18;

      const otherRooms = rooms.filter((r) => r.id !== selectedRoom.id);
      for (const target of otherRooms) {
        const isTargetNonMetric = !isMetricRoom(target);
        const targetW = isTargetNonMetric ? 180 : metersToPixels(target.dimensions?.width || 3.0);
        const targetH = isTargetNonMetric ? 100 : metersToPixels(target.dimensions?.length || 2.5);
        const tLeft = target.canvasPosition.x;
        const tRight = tLeft + targetW;
        const tTop = target.canvasPosition.y;
        const tBottom = tTop + targetH;

        // Alinear borde derecho con cara izquierda del vecino
        const d1 = Math.abs(currentHandleX - tLeft);
        if (d1 < minD) {
          minD = d1;
          snappedX = tLeft;
          bestGuide = {
            id: `snap-w-align-${target.id}`,
            orientation: 'vertical',
            position: tLeft,
            start: Math.min(sY, tTop) - 40,
            end: Math.max(sY + sL, tBottom) + 40,
            targetRoomId: target.id,
            snapType: 'projection_face',
            label: `📏 Ancho: ${((tLeft - sX) / PIXELS_PER_METER).toFixed(2)}m (Alineado con ${target.name})`
          };
        }

        // Alinear borde derecho con cara derecha del vecino
        const d2 = Math.abs(currentHandleX - tRight);
        if (d2 < minD) {
          minD = d2;
          snappedX = tRight;
          bestGuide = {
            id: `snap-w-align-right-${target.id}`,
            orientation: 'vertical',
            position: tRight,
            start: Math.min(sY, tTop) - 40,
            end: Math.max(sY + sL, tBottom) + 40,
            targetRoomId: target.id,
            snapType: 'projection_face',
            label: `📏 Ancho: ${((tRight - sX) / PIXELS_PER_METER).toFixed(2)}m (Alineado con ${target.name})`
          };
        }

        // Igualar ancho con ancho del vecino
        const d3 = Math.abs(currentHandleX - sX - targetW);
        if (d3 < minD) {
          minD = d3;
          snappedX = sX + targetW;
          bestGuide = {
            id: `snap-w-match-${target.id}`,
            orientation: 'vertical',
            position: sX + targetW,
            start: Math.min(sY, tTop) - 40,
            end: Math.max(sY + sL, tBottom) + 40,
            targetRoomId: target.id,
            snapType: 'projection_face',
            label: `📏 Ancho: ${(targetW / PIXELS_PER_METER).toFixed(2)}m (Igual a ${target.name})`
          };
        }
      }

      if (bestGuide) {
        e.target.x(snappedX);
        setSnapGuides([bestGuide]);
      } else {
        setSnapGuides([]);
      }
    },
    [selectedRoom, rooms, setSnapGuides]
  );

  const handleResizeWidthDragEnd = useCallback(
    (e: any) => {
      if (!selectedRoom || !isMetricRoom(selectedRoom)) return;
      const finalHandleX = e.target.x();
      const sX = selectedRoom.canvasPosition.x;
      const newWidthMeters = Number(Math.max(0.6, (finalHandleX - sX) / PIXELS_PER_METER).toFixed(2));

      updateRoomDimensions(selectedRoom.id, {
        ...selectedRoom.dimensions,
        width: newWidthMeters,
        widthLocked: true
      });
      setSnapGuides([]);
      e.target.position({ x: sX + metersToPixels(newWidthMeters), y: selectedRoom.canvasPosition.y });
      syncRoomWallAdjacencies(selectedRoom.id);
    },
    [selectedRoom, updateRoomDimensions, setSnapGuides, syncRoomWallAdjacencies]
  );

  const handleResizeLengthDragMove = useCallback(
    (e: any) => {
      if (!selectedRoom || !isMetricRoom(selectedRoom)) return;
      // Bloquear X rígidamente a la posición del ambiente
      e.target.x(selectedRoom.canvasPosition.x);
      const currentHandleY = Math.max(selectedRoom.canvasPosition.y + 30, e.target.y());
      e.target.y(currentHandleY);

      const sX = selectedRoom.canvasPosition.x;
      const sY = selectedRoom.canvasPosition.y;
      const sW = metersToPixels(selectedRoom.dimensions?.width || 3.0);

      let snappedY = currentHandleY;
      let bestGuide: SnapGuideLine | null = null;
      let minD = isMobile ? 32 : 18;

      const otherRooms = rooms.filter((r) => r.id !== selectedRoom.id);
      for (const target of otherRooms) {
        const isTargetNonMetric = !isMetricRoom(target);
        const targetW = isTargetNonMetric ? 180 : metersToPixels(target.dimensions?.width || 3.0);
        const targetH = isTargetNonMetric ? 100 : metersToPixels(target.dimensions?.length || 2.5);
        const tLeft = target.canvasPosition.x;
        const tRight = tLeft + targetW;
        const tTop = target.canvasPosition.y;
        const tBottom = tTop + targetH;

        // Alinear borde inferior con cara superior del vecino
        const d1 = Math.abs(currentHandleY - tTop);
        if (d1 < minD) {
          minD = d1;
          snappedY = tTop;
          bestGuide = {
            id: `snap-l-align-${target.id}`,
            orientation: 'horizontal',
            position: tTop,
            start: Math.min(sX, tLeft) - 40,
            end: Math.max(sX + sW, tRight) + 40,
            targetRoomId: target.id,
            snapType: 'projection_face',
            label: `📏 Longitud: ${((tTop - sY) / PIXELS_PER_METER).toFixed(2)}m (Alineado con ${target.name})`
          };
        }

        // Alinear borde inferior con cara inferior del vecino
        const d2 = Math.abs(currentHandleY - tBottom);
        if (d2 < minD) {
          minD = d2;
          snappedY = tBottom;
          bestGuide = {
            id: `snap-l-align-bottom-${target.id}`,
            orientation: 'horizontal',
            position: tBottom,
            start: Math.min(sX, tLeft) - 40,
            end: Math.max(sX + sW, tRight) + 40,
            targetRoomId: target.id,
            snapType: 'projection_face',
            label: `📏 Longitud: ${((tBottom - sY) / PIXELS_PER_METER).toFixed(2)}m (Alineado con ${target.name})`
          };
        }

        // Igualar longitud con la longitud del vecino
        const d3 = Math.abs(currentHandleY - sY - targetH);
        if (d3 < minD) {
          minD = d3;
          snappedY = sY + targetH;
          bestGuide = {
            id: `snap-l-match-${target.id}`,
            orientation: 'horizontal',
            position: sY + targetH,
            start: Math.min(sX, tLeft) - 40,
            end: Math.max(sX + sW, tRight) + 40,
            targetRoomId: target.id,
            snapType: 'projection_face',
            label: `📏 Longitud: ${(targetH / PIXELS_PER_METER).toFixed(2)}m (Igual a ${target.name})`
          };
        }
      }

      if (bestGuide) {
        e.target.y(snappedY);
        setSnapGuides([bestGuide]);
      } else {
        setSnapGuides([]);
      }
    },
    [selectedRoom, rooms, setSnapGuides]
  );

  const handleResizeLengthDragEnd = useCallback(
    (e: any) => {
      if (!selectedRoom || !isMetricRoom(selectedRoom)) return;
      const finalHandleY = e.target.y();
      const sX = selectedRoom.canvasPosition.x;
      const sY = selectedRoom.canvasPosition.y;
      const newLengthMeters = Number(Math.max(0.6, (finalHandleY - sY) / PIXELS_PER_METER).toFixed(2));

      updateRoomDimensions(selectedRoom.id, {
        ...selectedRoom.dimensions,
        length: newLengthMeters,
        lengthLocked: true
      });
      setSnapGuides([]);
      e.target.position({ x: sX, y: sY + metersToPixels(newLengthMeters) });
      syncRoomWallAdjacencies(selectedRoom.id);
    },
    [selectedRoom, updateRoomDimensions, setSnapGuides, syncRoomWallAdjacencies]
  );

  // 🧲 Detección de alineaciones inteligentes por Snap para 1-Toque (resuelve imprecisión en celular)
  const snapSuggestions = useMemo(() => {
    if (!selectedRoom || !isMetricRoom(selectedRoom)) return [];
    const suggestions: Array<{ id: string; label: string; action: () => void }> = [];
    const otherRooms = rooms.filter((r) => r.id !== selectedRoom.id && isMetricRoom(r));

    const sL = selectedRoom.dimensions?.length || 2.5;
    const sW = selectedRoom.dimensions?.width || 3.0;

    for (const target of otherRooms) {
      const tW = target.dimensions?.width || 3.0;
      const tH = target.dimensions?.length || 2.5;

      // 1. Alinear / igualar longitud con vecino
      if (Math.abs(sL - tH) > 0.04 && Math.abs(sL - tH) <= 2.0) {
        suggestions.push({
          id: `align-l-${target.id}`,
          label: `🧲 Longitud = ${tH}m (${target.name})`,
          action: () => {
            updateRoomDimensions(selectedRoom.id, {
              ...selectedRoom.dimensions,
              length: tH,
              lengthLocked: true
            });
            syncRoomWallAdjacencies(selectedRoom.id);
          }
        });
      }

      // 2. Alinear / igualar ancho con vecino
      if (Math.abs(sW - tW) > 0.04 && Math.abs(sW - tW) <= 2.0) {
        suggestions.push({
          id: `align-w-${target.id}`,
          label: `🧲 Ancho = ${tW}m (${target.name})`,
          action: () => {
            updateRoomDimensions(selectedRoom.id, {
              ...selectedRoom.dimensions,
              width: tW,
              widthLocked: true
            });
            syncRoomWallAdjacencies(selectedRoom.id);
          }
        });
      }
    }

    return suggestions.slice(0, 2);
  }, [selectedRoom, rooms, updateRoomDimensions, syncRoomWallAdjacencies]);

  const handleWallClick = useCallback(
    (roomId: string, wall: WallOrientation) => {
      const conn = getOrCreateWallConnection(roomId, wall);
      setEditingConnection(conn);
    },
    [getOrCreateWallConnection]
  );

  const wallThicknessPx = useMemo(
    () => wallThicknessMeters * PIXELS_PER_METER,
    [wallThicknessMeters]
  );

  // Ajustar el tamaño del canvas al contenedor visible con guard de dimensiones
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

  // Arrastre fluido a 60fps sin mutar el store global de React en cada frame
  const handleNodeDragMove = useCallback(
    (roomId: string, node: any) => {
      const snapped = handleRoomDrag(roomId, { x: node.x(), y: node.y() });
      node.position({ x: snapped.x, y: snapped.y });
    },
    [handleRoomDrag]
  );

  const handleNodeDragEnd = useCallback(
    (roomId: string, node: any) => {
      handleRoomDragEnd(roomId, { x: node.x(), y: node.y() });
    },
    [handleRoomDragEnd]
  );

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

  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        bgcolor: '#f1f5f9',
        overflow: 'hidden',
        touchAction: 'none'
      }}
    >
      {/* 🧭 Barra de Controles Compacta y Elegante (Material 3 Glassmorphic Pill) */}
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
          maxWidth: isMobile ? 'calc(100vw - 12px)' : undefined,
          overflowX: isMobile ? 'auto' : 'visible',
          bgcolor: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(226, 232, 240, 0.9)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)'
        }}
      >
        <Stack direction="row" alignItems="center" spacing={isMobile ? 0.6 : 1}>
          {/* Botón Prominente para Agregar Ambiente */}
          {onOpenAddRoom && (
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon fontSize="small" />}
              onClick={() => onOpenAddRoom('interior')}
              sx={{
                borderRadius: 6,
                textTransform: 'none',
                fontWeight: 700,
                fontSize: isMobile ? '0.74rem' : '0.78rem',
                height: 28,
                px: isMobile ? 1 : 1.5,
                bgcolor: '#0284c7',
                '&:hover': { bgcolor: '#0369a1' },
                boxShadow: 'none',
                whiteSpace: 'nowrap',
                minWidth: 'fit-content'
              }}
            >
              Ambiente
            </Button>
          )}

          {/* Botón Compacto de Espesor de Muro */}
          <Tooltip title="Cambiar espesor constructivo de muros">
            <Chip
              icon={<WallIcon fontSize="small" />}
              label={isMobile ? `${Math.round(wallThicknessMeters * 100)} cm` : `Muro: ${Math.round(wallThicknessMeters * 100)} cm`}
              size="small"
              onClick={(e) => setWallMenuAnchor(e.currentTarget)}
              variant="outlined"
              clickable
              sx={{ fontWeight: 700, fontSize: '0.74rem', height: 28 }}
            />
          </Tooltip>

          {/* Menú Desplegable de Espesores */}
          <Menu
            anchorEl={wallMenuAnchor}
            open={Boolean(wallMenuAnchor)}
            onClose={() => setWallMenuAnchor(null)}
            PaperProps={{ sx: { borderRadius: 3, minWidth: 200 } }}
          >
            <MenuItem
              selected={wallThicknessMeters === 0.10}
              onClick={() => {
                setWallThickness(0.10);
                setWallMenuAnchor(null);
              }}
            >
              <ListItemIcon><WallIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="10 cm (Tabique / Hueco)" primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }} />
            </MenuItem>
            <MenuItem
              selected={wallThicknessMeters === 0.15}
              onClick={() => {
                setWallThickness(0.15);
                setWallMenuAnchor(null);
              }}
            >
              <ListItemIcon><WallIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="15 cm (Portante / Común)" primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }} />
            </MenuItem>
            <MenuItem
              selected={wallThicknessMeters === 0.20}
              onClick={() => {
                setWallThickness(0.20);
                setWallMenuAnchor(null);
              }}
            >
              <ListItemIcon><WallIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="20 cm (Medianera / Exterior)" primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }} />
            </MenuItem>
            <MenuItem
              selected={wallThicknessMeters === 0.07}
              onClick={() => {
                setWallThickness(0.07);
                setWallMenuAnchor(null);
              }}
            >
              <ListItemIcon><WallIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="7 cm (Durlock Liviano)" primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }} />
            </MenuItem>
          </Menu>

          {/* ⚡ Botón de Auto-Alinear Inteligente */}
          <Tooltip title="Auto-ensamblar y alinear planta arquitectónica">
            <Chip
              icon={<AutoLayoutIcon fontSize="small" />}
              label={isMobile ? 'Alinear' : 'Auto-Ensamblar'}
              color="primary"
              size="small"
              onClick={() => autoAssembleRooms()}
              clickable
              variant="filled"
              sx={{ fontWeight: 700, fontSize: '0.74rem', height: 28 }}
            />
          </Tooltip>


          <Box sx={{ height: 18, width: 1, bgcolor: '#cbd5e1' }} />

          {/* Botón Compacto de Snap Magnético */}
          <Tooltip title={isSnapEnabled ? 'Atracción magnética y proyección activa' : 'Atracción magnética desactivada'}>
            <Chip
              icon={<SnapIcon fontSize="small" />}
              label="Snap"
              color={isSnapEnabled ? 'primary' : 'default'}
              size="small"
              onClick={() => toggleSnap()}
              clickable
              variant={isSnapEnabled ? 'filled' : 'outlined'}
              sx={{ fontWeight: 600, fontSize: '0.74rem', height: 28 }}
            />
          </Tooltip>

          {/* Estado y accesos directos al ambiente seleccionado */}
          {selectedRoom && (
            <>
              <Box sx={{ height: 18, width: 1, bgcolor: '#cbd5e1' }} />
              <Chip
                label={`🏠 ${selectedRoom.name}`}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ fontWeight: 700, fontSize: '0.74rem', height: 28 }}
              />
              <Tooltip title="Editar nombre o propiedades del ambiente">
                <Chip
                  label="⚙️ Propiedades"
                  size="small"
                  onClick={() => setDetailRoomId(selectedRoom.id)}
                  clickable
                  variant="outlined"
                  sx={{ fontWeight: 600, fontSize: '0.74rem', height: 28 }}
                />
              </Tooltip>

              <Tooltip title="Gestionar aberturas y muro">
                <Chip
                  label="🚪 Aberturas"
                  size="small"
                  onClick={() => handleWallClick(selectedRoom.id, 'north')}
                  clickable
                  variant="outlined"
                  sx={{ fontWeight: 600, fontSize: '0.74rem', height: 28 }}
                />
              </Tooltip>

              {/* 🚪 Botón 1-toque: Integrar ambientes (Concepto Abierto) vs Tabique Sólido */}
              {adjacentConn && (
                <Tooltip
                  title={
                    adjacentConn.isVirtualBoundary || adjacentConn.type === 'limite_virtual'
                      ? 'Restablecer tabique divisorio con muro constructivo sólido'
                      : 'Integrar con ambiente contiguo (Concepto Abierto sin muro divisorio)'
                  }
                >
                  <Chip
                    icon={
                      adjacentConn.isVirtualBoundary || adjacentConn.type === 'limite_virtual' ? (
                        <WallIcon sx={{ fontSize: '1rem !important' }} />
                      ) : (
                        <DoorIcon sx={{ fontSize: '1rem !important' }} />
                      )
                    }
                    label={
                      adjacentConn.isVirtualBoundary || adjacentConn.type === 'limite_virtual'
                        ? '🧱 Poner Muro'
                        : '🚪 Integrar Espacio'
                    }
                    size="small"
                    color={
                      adjacentConn.isVirtualBoundary || adjacentConn.type === 'limite_virtual'
                        ? 'primary'
                        : 'default'
                    }
                    variant={
                      adjacentConn.isVirtualBoundary || adjacentConn.type === 'limite_virtual'
                        ? 'filled'
                        : 'outlined'
                    }
                    onClick={() => {
                      const nextVirtual = !(adjacentConn.isVirtualBoundary || adjacentConn.type === 'limite_virtual');
                      updateConnection(adjacentConn.id, {
                        isVirtualBoundary: nextVirtual,
                        type: nextVirtual ? 'limite_virtual' : 'pared_comun',
                        label: nextVirtual ? '🚪 Límite Abierto (Integrado)' : '🧱 Muro Compartido',
                        wallProperties: adjacentConn.wallProperties
                          ? {
                              ...adjacentConn.wallProperties,
                              isVirtualBoundary: nextVirtual,
                              thicknessMeters: nextVirtual ? 0 : (adjacentConn.wallProperties.thicknessMeters || 0.15)
                            }
                          : undefined
                      });
                    }}
                    clickable
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.74rem',
                      height: 28,
                      borderColor:
                        adjacentConn.isVirtualBoundary || adjacentConn.type === 'limite_virtual'
                          ? undefined
                          : '#0284c7',
                      color:
                        adjacentConn.isVirtualBoundary || adjacentConn.type === 'limite_virtual'
                          ? '#ffffff'
                          : '#0284c7'
                    }}
                  />
                </Tooltip>
              )}

              {/* 🔗 Botón 1-toque: Fusión Booleana de Ambientes en 'L' */}
              {adjacentNeighbor && canMergeWithNeighbor && (
                <Tooltip title={`Unir con ${adjacentNeighbor.name} en un único ambiente continuo (en 'L')`}>
                  <Chip
                    icon={<MergeIcon sx={{ fontSize: '1rem !important' }} />}
                    label={`🔗 Fusionar con ${adjacentNeighbor.name}`}
                    size="small"
                    color="secondary"
                    variant="outlined"
                    onClick={() => {
                      setMergeCustomName(`${selectedRoom.name} - ${adjacentNeighbor.name}`);
                      setMergeConfirmOpen(true);
                    }}
                    clickable
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.74rem',
                      height: 28,
                      borderColor: '#9333ea',
                      color: '#9333ea',
                      '&:hover': {
                        backgroundColor: 'rgba(147, 51, 234, 0.08)'
                      }
                    }}
                  />
                </Tooltip>
              )}

              {/* 🧲 Botones de alineación instantánea por Snap con 1 toque */}
              {snapSuggestions.map((sug) => (
                <Tooltip key={sug.id} title="Alinear instantáneamente por snap con 1 toque">
                  <Chip
                    label={sug.label}
                    size="small"
                    color="primary"
                    variant="filled"
                    onClick={sug.action}
                    clickable
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.74rem',
                      height: 28,
                      bgcolor: '#0284c7',
                      color: '#ffffff',
                      boxShadow: '0 2px 6px rgba(2, 132, 199, 0.35)'
                    }}
                  />
                </Tooltip>
              ))}
            </>
          )}

          {/* Controles de Zoom y Vista en Desktop */}
          {!isMobile && (
            <>
              {/* Botón Compacto de Plano CAD vs Grafo */}
              <Tooltip title={showAbstractEdges ? 'Ver Plano Arquitectónico Real con Aberturas' : 'Ver Líneas de Grafo Topológico'}>
                <IconButton
                  size="small"
                  color={showAbstractEdges ? 'secondary' : 'primary'}
                  onClick={() => setShowAbstractEdges(!showAbstractEdges)}
                  sx={{ p: 0.5 }}
                >
                  {showAbstractEdges ? <TopologyLinesIcon fontSize="small" /> : <ArchPlanIcon fontSize="small" />}
                </IconButton>
              </Tooltip>

              <Box sx={{ height: 18, width: 1, bgcolor: '#cbd5e1' }} />
              <IconButton size="small" onClick={() => handleZoom(1.15)} sx={{ p: 0.5 }}>
                <ZoomInIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={() => handleZoom(0.85)} sx={{ p: 0.5 }}>
                <ZoomOutIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={handleResetView} sx={{ p: 0.5 }}>
                <ResetViewIcon fontSize="small" />
              </IconButton>
              <Chip label={`${Math.round(scale * 100)}%`} size="small" variant="outlined" sx={{ fontSize: '0.68rem', height: 22 }} />
            </>
          )}
        </Stack>
      </Paper>

      {/* Info de Guías de Snapping Activas */}
      <SnapActiveBadge />

      {/* Lienzo Konva 2D */}
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
        {/* Capa 1: Vínculos de Topología (Solo si se activa el modo grafo) */}
        {showAbstractEdges && (
          <Layer listening={false}>
            {connections.map((conn) => {
              const sourceRoom = rooms.find((r) => r.id === conn.sourceRoomId);
              const targetRoom = rooms.find((r) => r.id === conn.targetRoomId);
              if (!sourceRoom || !targetRoom) return null;

              const sIsNonMetric = sourceRoom.isAccessPoint || sourceRoom.isTechnicalIsland;
              const tIsNonMetric = targetRoom.isAccessPoint || targetRoom.isTechnicalIsland;

              const sW = sIsNonMetric ? 180 : metersToPixels(sourceRoom.dimensions?.width || 3);
              const sH = sIsNonMetric ? 100 : metersToPixels(sourceRoom.dimensions?.length || 2);
              const tW = tIsNonMetric ? 180 : metersToPixels(targetRoom.dimensions?.width || 3);
              const tH = tIsNonMetric ? 100 : metersToPixels(targetRoom.dimensions?.length || 2);

              const sX = sourceRoom.canvasPosition.x + sW / 2;
              const sY = sourceRoom.canvasPosition.y + sH / 2;
              const tX = targetRoom.canvasPosition.x + tW / 2;
              const tY = targetRoom.canvasPosition.y + tH / 2;

              const connMeta = CONNECTION_TYPE_CATALOG[conn.type] || CONNECTION_TYPE_CATALOG.puerta_estandar;

              return (
                <Line
                  key={conn.id}
                  points={[sX, sY, tX, tY]}
                  stroke={connMeta.color}
                  strokeWidth={2}
                  dash={conn.type === 'pass_through' ? [6, 6] : undefined}
                  opacity={0.5}
                  perfectDrawEnabled={false}
                />
              );
            })}
          </Layer>
        )}

        {/* Capa 2: Guías visuales de Snapping Magnético y Proyecciones de Caras */}
        <SnapGuidesLayer />

        {/* Capa 3: Ambientes Arquitectónicos Métricos y Zonas Sombreadas de Referencia */}
        <Layer>
          {rooms.map((room) => (
            <RoomAssemblyShape
              key={room.id}
              room={room}
              allRooms={rooms}
              isSelected={room.id === selectedRoomId}
              wallThicknessPx={wallThicknessPx}
              openings={connections}
              onSelect={selectRoom}
              onDragMove={handleNodeDragMove}
              onDragEnd={handleNodeDragEnd}
            />
          ))}
        </Layer>

        {/* Capa 3.5: Tiradores de Pared Completa con Snap Magnético (Arrastrar desde la pared) */}
        {selectedRoom && isMetricRoom(selectedRoom) && (
          <Layer>
            {/* 🧱 Pared Este: Tocar y arrastrar la pared derecha para cambiar ancho con snap */}
            <Group
              x={selectedRoom.canvasPosition.x + selectedRoomWidthPx}
              y={selectedRoom.canvasPosition.y}
              draggable
              onDragStart={(e) => { e.cancelBubble = true; }}
              onDragMove={handleResizeWidthDragMove}
              onDragEnd={handleResizeWidthDragEnd}
            >
              {/* Zona de captura táctil a lo largo de toda la pared Este (48px de ancho) */}
              <Rect x={-24} y={0} width={48} height={selectedRoomLengthPx} fill="transparent" />
              {/* Resaltado visual azul de la pared Este interactiva */}
              <Rect
                x={-3}
                y={0}
                width={6}
                height={selectedRoomLengthPx}
                fill="#0284c7"
                opacity={0.85}
                cornerRadius={3}
              />
              {/* Pestaña central de agarre con icono */}
              <Rect
                x={-14}
                y={selectedRoomLengthPx / 2 - 16}
                width={28}
                height={32}
                fill="#0284c7"
                cornerRadius={14}
                shadowColor="#0284c7"
                shadowBlur={8}
                shadowOpacity={0.6}
              />
              <Text
                text="↔"
                x={-6}
                y={selectedRoomLengthPx / 2 - 6}
                fontSize={12}
                fontStyle="bold"
                fill="#ffffff"
                listening={false}
              />
            </Group>

            {/* 🧱 Pared Sur: Tocar y arrastrar la pared inferior para cambiar longitud con snap */}
            <Group
              x={selectedRoom.canvasPosition.x}
              y={selectedRoom.canvasPosition.y + selectedRoomLengthPx}
              draggable
              onDragStart={(e) => { e.cancelBubble = true; }}
              onDragMove={handleResizeLengthDragMove}
              onDragEnd={handleResizeLengthDragEnd}
            >
              {/* Zona de captura táctil a lo largo de toda la pared Sur (48px de alto) */}
              <Rect x={0} y={-24} width={selectedRoomWidthPx} height={48} fill="transparent" />
              {/* Resaltado visual azul de la pared Sur interactiva */}
              <Rect
                x={0}
                y={-3}
                width={selectedRoomWidthPx}
                height={6}
                fill="#0284c7"
                opacity={0.85}
                cornerRadius={3}
              />
              {/* Pestaña central de agarre con icono */}
              <Rect
                x={selectedRoomWidthPx / 2 - 16}
                y={-14}
                width={32}
                height={28}
                fill="#0284c7"
                cornerRadius={14}
                shadowColor="#0284c7"
                shadowBlur={8}
                shadowOpacity={0.6}
              />
              <Text
                text="↕"
                x={selectedRoomWidthPx / 2 - 4}
                y={-6}
                fontSize={12}
                fontStyle="bold"
                fill="#ffffff"
                listening={false}
              />
            </Group>
          </Layer>
        )}

        {/* Capa 4: Ejes Medianeros y Límites de Parcela (No interactiva, simbología profesional CAD) */}
        <Layer listening={false}>
          {rooms
            .filter(isParcelBoundaryNode)
            .map((bound) => {
              const boundConns = connections.filter(
                (c) => c.sourceRoomId === bound.id || c.targetRoomId === bound.id
              );
              const connectedRooms = rooms.filter(
                (r) =>
                  isMetricRoom(r) &&
                  boundConns.some((c) => c.sourceRoomId === r.id || c.targetRoomId === r.id)
              );
              if (connectedRooms.length === 0) return null;

              const xs = connectedRooms.map((r) => r.canvasPosition.x);
              const maxXs = connectedRooms.map(
                (r) => r.canvasPosition.x + metersToPixels(r.dimensions?.width || 3)
              );
              const ys = connectedRooms.map((r) => r.canvasPosition.y);
              const maxYs = connectedRooms.map(
                (r) => r.canvasPosition.y + metersToPixels(r.dimensions?.length || 2.5)
              );

              const minX = Math.min(...xs);
              const maxX = Math.max(...maxXs);
              const minY = Math.min(...ys);
              const maxY = Math.max(...maxYs);

              if (bound.type === 'limit_medianera_izq') {
                const lineX = minX - wallThicknessPx / 2 - 8;
                return (
                  <Group key={bound.id}>
                    <Line
                      points={[lineX, minY - 30, lineX, maxY + 30]}
                      stroke="#475569"
                      strokeWidth={2.5}
                      dash={[14, 4, 3, 4]}
                    />
                    <Text
                      x={lineX - 18}
                      y={maxY + 20}
                      text={`🧱 ${bound.name.toUpperCase()}`}
                      fontSize={11}
                      fontStyle="bold"
                      fill="#475569"
                      rotation={-90}
                    />
                  </Group>
                );
              } else if (bound.type === 'limit_medianera_der') {
                const lineX = maxX + wallThicknessPx / 2 + 8;
                return (
                  <Group key={bound.id}>
                    <Line
                      points={[lineX, minY - 30, lineX, maxY + 30]}
                      stroke="#475569"
                      strokeWidth={2.5}
                      dash={[14, 4, 3, 4]}
                    />
                    <Text
                      x={lineX + 6}
                      y={minY - 20}
                      text={`🧱 ${bound.name.toUpperCase()}`}
                      fontSize={11}
                      fontStyle="bold"
                      fill="#475569"
                      rotation={90}
                    />
                  </Group>
                );
              } else if (bound.type === 'limit_frente_lm') {
                const lineY = maxY + wallThicknessPx / 2 + 8;
                return (
                  <Group key={bound.id}>
                    <Line
                      points={[minX - 30, lineY, maxX + 30, lineY]}
                      stroke="#0284c7"
                      strokeWidth={3.5}
                    />
                    <Text
                      x={minX}
                      y={lineY + 6}
                      text={`🏛️ ${bound.name.toUpperCase()}`}
                      fontSize={11}
                      fontStyle="bold"
                      fill="#0284c7"
                    />
                  </Group>
                );
              } else if (bound.type === 'limit_fondo' || bound.type === 'limit_patio') {
                const lineY = minY - wallThicknessPx / 2 - 8;
                const isPatio = bound.type === 'limit_patio';
                return (
                  <Group key={bound.id}>
                    <Line
                      points={[minX - 30, lineY, maxX + 30, lineY]}
                      stroke={isPatio ? '#0ea5e9' : '#059669'}
                      strokeWidth={2.5}
                      dash={[10, 4]}
                    />
                    <Text
                      x={minX}
                      y={lineY - 18}
                      text={`${isPatio ? '☀️' : '🌳'} ${bound.name.toUpperCase()}`}
                      fontSize={11}
                      fontStyle="bold"
                      fill={isPatio ? '#0ea5e9' : '#059669'}
                    />
                  </Group>
                );
              }
              return null;
            })}
        </Layer>
      </Stage>

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

      {/* 🧱 Inspector Modal de Muro y Aberturas (Solo si el usuario pulsa Aberturas en la barra superior) */}
      {editingConnection && (
        <EditOpeningDialog
          open={Boolean(editingConnection)}
          onClose={() => setEditingConnection(null)}
          connection={editingConnection}
        />
      )}

      {/* 📐 Diálogo de Dimensiones y Propiedades (Solo si el usuario pulsa Propiedades en la barra superior) */}
      {detailRoomId && (
        <RoomDetailDialog
          open={Boolean(detailRoomId)}
          onClose={() => setDetailRoomId(null)}
          roomId={detailRoomId}
        />
      )}

      {/* 🔗 Modal de Confirmación: Fusión Booleana de Ambientes */}
      <Dialog
        open={mergeConfirmOpen}
        onClose={() => setMergeConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, p: 1 }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <MergeIcon sx={{ color: '#9333ea' }} />
          Fusión Booleana de Ambientes
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Se combinarán <strong>{selectedRoom?.name}</strong> y{' '}
            <strong>{adjacentNeighbor?.name}</strong> en un único ambiente continuo (geometría en 'L').
          </Typography>

          <TextField
            label="Nombre del Ambiente Resultante"
            fullWidth
            size="small"
            value={mergeCustomName}
            onChange={(e) => setMergeCustomName(e.target.value)}
            placeholder="Ej: Living - Comedor"
            autoFocus
          />

          <Box sx={{ bgcolor: 'rgba(147, 51, 234, 0.06)', p: 1.5, borderRadius: 2, border: '1px dashed #9333ea' }}>
            <Typography variant="caption" sx={{ display: 'block', color: '#7e22ce', fontWeight: 600 }}>
              💡 ¿Qué sucederá con la arquitectura?
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              • El tabique divisorio interno desaparecerá por completo.<br />
              • El nuevo espacio tendrá un único perímetro exterior continuo.<br />
              • Las bocas eléctricas y canalizaciones se unificarán.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setMergeConfirmOpen(false)} color="inherit" sx={{ fontWeight: 600 }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (selectedRoom && adjacentNeighbor) {
                mergeRooms(selectedRoom.id, adjacentNeighbor.id, mergeCustomName.trim() || undefined);
              }
              setMergeConfirmOpen(false);
            }}
            sx={{
              fontWeight: 700,
              bgcolor: '#9333ea',
              '&:hover': { bgcolor: '#7e22ce' }
            }}
          >
            Confirmar Fusión
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
