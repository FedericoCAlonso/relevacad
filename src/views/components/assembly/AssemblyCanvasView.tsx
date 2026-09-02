/**
 * View: AssemblyCanvasView (Fase 3: Vista de Ensamblaje Canvas 2D)
 * Renderizado gráfico planimétrico de los ambientes como recinto arquitectónico real:
 * - Muros con espesor constructivo parametrizable (10cm, 15cm, 20cm)
 * - Dimensiones netas tomadas desde el interior de cada ambiente
 * - Aberturas arquitectónicas CAD reales en los muros (hojas batientes, corredizas y vanos)
 * - Barra de herramientas flotante compacta y elegante (Glassmorphic Pill)
 * - Snap magnético interactivo (~15px) con arrastre nativo a 60fps
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Line, Group, Text, Circle } from 'react-konva';
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
  AccountTree as TopologyLinesIcon,
  Architecture as ArchPlanIcon,
  Tune as TuneIcon,
  Add as AddIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useSurveyViewModel } from '@/viewmodels';
import { useSurveyStore } from '@/viewmodels/surveyStore';
import { SnapGuideLine } from '@/viewmodels/utils/snappingCalculator';
import { metersToPixels, PIXELS_PER_METER } from '@/viewmodels/utils/geometryUtils';
import { CONNECTION_TYPE_CATALOG, LogicalConnection } from '@/models/GraphModel';
import { WallOrientation, isMetricRoom, isParcelBoundaryNode } from '@/models/RoomModel';
import { RoomAssemblyShape } from './RoomAssemblyShape';
import { EditOpeningDialog } from '../topology/EditOpeningDialog';
import { RoomDetailDialog } from '../topology/RoomDetailDialog';

interface AssemblyCanvasViewProps {
  onOpenAddRoom?: (defaultTab?: 'interior' | 'access' | 'technical') => void;
}

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
    activeSnapGuides,
    handleRoomDrag,
    handleRoomDragEnd,
    wallThicknessMeters,
    setWallThickness,
    getOrCreateWallConnection,
    updateRoomDimensions
  } = useSurveyViewModel();

  const syncRoomWallAdjacencies = useSurveyStore((state) => state.syncRoomWallAdjacencies);
  const setSnapGuides = useSurveyStore((state) => state.setSnapGuides);

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
      const currentHandleX = e.target.x();
      const sX = selectedRoom.canvasPosition.x;
      const sY = selectedRoom.canvasPosition.y;
      const sL = metersToPixels(selectedRoom.dimensions?.length || 2.5);

      let snappedX = currentHandleX;
      let bestGuide: SnapGuideLine | null = null;
      let minD = 16;

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
      const sL = metersToPixels(selectedRoom.dimensions?.length || 2.5);
      const newWidthMeters = Number(Math.max(0.6, (finalHandleX - sX) / PIXELS_PER_METER).toFixed(2));

      updateRoomDimensions(selectedRoom.id, {
        ...selectedRoom.dimensions,
        width: newWidthMeters,
        widthLocked: true
      });
      setSnapGuides([]);
      e.target.position({ x: sX + metersToPixels(newWidthMeters), y: selectedRoom.canvasPosition.y + sL / 2 });
      syncRoomWallAdjacencies(selectedRoom.id);
    },
    [selectedRoom, updateRoomDimensions, setSnapGuides, syncRoomWallAdjacencies]
  );

  const handleResizeLengthDragMove = useCallback(
    (e: any) => {
      if (!selectedRoom || !isMetricRoom(selectedRoom)) return;
      const currentHandleY = e.target.y();
      const sX = selectedRoom.canvasPosition.x;
      const sY = selectedRoom.canvasPosition.y;
      const sW = metersToPixels(selectedRoom.dimensions?.width || 3.0);

      let snappedY = currentHandleY;
      let bestGuide: SnapGuideLine | null = null;
      let minD = 16;

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
      const sW = metersToPixels(selectedRoom.dimensions?.width || 3.0);
      const newLengthMeters = Number(Math.max(0.6, (finalHandleY - sY) / PIXELS_PER_METER).toFixed(2));

      updateRoomDimensions(selectedRoom.id, {
        ...selectedRoom.dimensions,
        length: newLengthMeters,
        lengthLocked: true
      });
      setSnapGuides([]);
      e.target.position({ x: sX + sW / 2, y: sY + metersToPixels(newLengthMeters) });
      syncRoomWallAdjacencies(selectedRoom.id);
    },
    [selectedRoom, updateRoomDimensions, setSnapGuides, syncRoomWallAdjacencies]
  );

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
      {activeSnapGuides.length > 0 && (
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
      )}

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
        {activeSnapGuides.length > 0 && (
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
        )}

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

        {/* Capa 3.5: Tiradores de Cota y Redimensionamiento con Snap Magnético */}
        {selectedRoom && isMetricRoom(selectedRoom) && (
          <Layer>
            {/* Tirador Este (Redimensionar Ancho con Snap) */}
            <Group
              x={selectedRoom.canvasPosition.x + selectedRoomWidthPx}
              y={selectedRoom.canvasPosition.y + selectedRoomLengthPx / 2}
              draggable
              dragBoundFunc={(pos) => ({
                x: Math.max(selectedRoom.canvasPosition.x + 30, pos.x),
                y: selectedRoom.canvasPosition.y + selectedRoomLengthPx / 2
              })}
              onMouseDown={(e) => { e.cancelBubble = true; }}
              onTouchStart={(e) => { e.cancelBubble = true; }}
              onClick={(e) => { e.cancelBubble = true; }}
              onTap={(e) => { e.cancelBubble = true; }}
              onDragStart={(e) => { e.cancelBubble = true; }}
              onDragMove={handleResizeWidthDragMove}
              onDragEnd={handleResizeWidthDragEnd}
            >
              {/* Zona de contacto amplia para dedos en celular (48px de diámetro) */}
              <Circle radius={isMobile ? 24 : 16} fill="transparent" />
              <Circle
                radius={isMobile ? 13 : 10}
                fill="#0284c7"
                stroke="#ffffff"
                strokeWidth={2.5}
                shadowColor="#0284c7"
                shadowBlur={10}
                shadowOpacity={0.7}
              />
              <Text
                text="↔"
                x={-6}
                y={-7}
                fontSize={isMobile ? 13 : 10}
                fontStyle="bold"
                fill="#ffffff"
                listening={false}
              />
            </Group>

            {/* Tirador Sur (Redimensionar Longitud con Snap) */}
            <Group
              x={selectedRoom.canvasPosition.x + selectedRoomWidthPx / 2}
              y={selectedRoom.canvasPosition.y + selectedRoomLengthPx}
              draggable
              dragBoundFunc={(pos) => ({
                x: selectedRoom.canvasPosition.x + selectedRoomWidthPx / 2,
                y: Math.max(selectedRoom.canvasPosition.y + 30, pos.y)
              })}
              onMouseDown={(e) => { e.cancelBubble = true; }}
              onTouchStart={(e) => { e.cancelBubble = true; }}
              onClick={(e) => { e.cancelBubble = true; }}
              onTap={(e) => { e.cancelBubble = true; }}
              onDragStart={(e) => { e.cancelBubble = true; }}
              onDragMove={handleResizeLengthDragMove}
              onDragEnd={handleResizeLengthDragEnd}
            >
              {/* Zona de contacto amplia para dedos en celular (48px de diámetro) */}
              <Circle radius={isMobile ? 24 : 16} fill="transparent" />
              <Circle
                radius={isMobile ? 13 : 10}
                fill="#0284c7"
                stroke="#ffffff"
                strokeWidth={2.5}
                shadowColor="#0284c7"
                shadowBlur={10}
                shadowOpacity={0.7}
              />
              <Text
                text="↕"
                x={-4}
                y={-7}
                fontSize={isMobile ? 13 : 10}
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

      {/* 📐 Botón Flotante de Medidas del Ambiente Seleccionado */}
      {selectedRoom && isMetricRoom(selectedRoom) && (
        <Paper
          elevation={4}
          sx={{
            position: 'absolute',
            bottom: isMobile ? 74 : 20,
            right: 14,
            zIndex: 20,
            py: 0.8,
            px: 1.5,
            borderRadius: 3,
            bgcolor: '#ffffff',
            border: '1.5px solid #00629e',
            display: 'flex',
            alignItems: 'center',
            gap: 1.2,
            boxShadow: '0 8px 24px rgba(0,98,158,0.18)',
            maxWidth: isMobile ? 'calc(100vw - 110px)' : undefined
          }}
        >
          <Box sx={{ overflow: 'hidden' }}>
            <Typography variant="body2" fontWeight={700} color="#0f172a" noWrap>
              {selectedRoom.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" noWrap>
              {selectedRoom.dimensions.width}m × {selectedRoom.dimensions.length}m
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            startIcon={<TuneIcon />}
            onClick={() => setDetailRoomId(selectedRoom.id)}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, px: 1.2, whiteSpace: 'nowrap' }}
          >
            Medidas
          </Button>
        </Paper>
      )}

      {/* 🧱 Inspector Modal de Muro y Aberturas al Tocar una Pared */}
      {editingConnection && (
        <EditOpeningDialog
          open={Boolean(editingConnection)}
          onClose={() => setEditingConnection(null)}
          connection={editingConnection}
        />
      )}

      {/* 📐 Diálogo de Dimensiones y Propiedades del Ambiente */}
      {detailRoomId && (
        <RoomDetailDialog
          open={Boolean(detailRoomId)}
          onClose={() => setDetailRoomId(null)}
          roomId={detailRoomId}
        />
      )}

      {/* 🧭 Barra de Acción de Ambiente Seleccionado (Material 3 Mobile-First) */}
      {selectedRoom && (
        <Paper
          elevation={4}
          sx={{
            position: 'absolute',
            bottom: isMobile ? 14 : 22,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            py: 0.6,
            px: 1.5,
            borderRadius: 6,
            bgcolor: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(10px)',
            border: '1px solid #0284c7',
            boxShadow: '0 8px 24px rgba(2, 132, 199, 0.2)'
          }}
        >
          <Typography
            variant="body2"
            fontWeight={700}
            color="#0f172a"
            sx={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}
          >
            🏠 {selectedRoom.name}
          </Typography>

          {isMetricRoom(selectedRoom) && (
            <Chip
              label={`${selectedRoom.dimensions.width} × ${selectedRoom.dimensions.length}m`}
              size="small"
              sx={{
                height: 22,
                fontSize: '0.72rem',
                fontWeight: 600,
                bgcolor: '#e0f2fe',
                color: '#0369a1'
              }}
            />
          )}

          <Button
            size="small"
            variant="outlined"
            onClick={() => handleWallClick(selectedRoom.id, 'north')}
            sx={{
              borderRadius: 4,
              textTransform: 'none',
              fontSize: '0.72rem',
              fontWeight: 600,
              height: 26,
              px: 1,
              borderColor: '#cbd5e1'
            }}
          >
            🚪 Aberturas / Muro
          </Button>

          <Button
            size="small"
            variant="outlined"
            onClick={() => setDetailRoomId(selectedRoom.id)}
            sx={{
              borderRadius: 4,
              textTransform: 'none',
              fontSize: '0.72rem',
              fontWeight: 600,
              height: 26,
              px: 1,
              borderColor: '#cbd5e1'
            }}
          >
            ⚙️ Datos
          </Button>

          <IconButton
            size="small"
            onClick={() => selectRoom(null as any)}
            sx={{ p: 0.3, color: '#64748b' }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Paper>
      )}
    </Box>
  );
};
