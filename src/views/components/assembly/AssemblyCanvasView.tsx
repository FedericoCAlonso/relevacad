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
import { Stage, Layer, Line } from 'react-konva';
import {
  Box,
  Typography,
  Chip,
  IconButton,
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
  Architecture as ArchPlanIcon
} from '@mui/icons-material';
import { useSurveyViewModel } from '@/viewmodels';
import { metersToPixels, PIXELS_PER_METER } from '@/viewmodels/utils/geometryUtils';
import { CONNECTION_TYPE_CATALOG } from '@/models/GraphModel';
import { RoomAssemblyShape } from './RoomAssemblyShape';
import { IncrementalSurveyAssistant } from './IncrementalSurveyAssistant';

export const AssemblyCanvasView: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [dimensions, setDimensions] = useState({ width: 1000, height: 700 });
  const [scale, setScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 80, y: 60 });
  const [showAbstractEdges, setShowAbstractEdges] = useState(false);

  // Menú flotante compacto para Espesor de Muro
  const [wallMenuAnchor, setWallMenuAnchor] = useState<null | HTMLElement>(null);

  const {
    rooms,
    connections,
    selectedRoomId,
    selectRoom,
    autoAssembleRooms,
    isSnapEnabled,
    toggleSnap,
    activeSnapGuides,
    handleRoomDrag,
    handleRoomDragEnd,
    wallThicknessMeters,
    setWallThickness,
    isAssistantOpen,
    toggleAssistantOpen,
    questionsQueue
  } = useSurveyViewModel();

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

  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        bgcolor: '#f1f5f9',
        overflow: 'hidden'
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
          px: isMobile ? 1 : 1.5,
          maxWidth: isMobile ? 'calc(100vw - 16px)' : undefined,
          overflowX: isMobile ? 'auto' : 'visible',
          bgcolor: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(226, 232, 240, 0.9)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)'
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          {/* Botón Compacto de Espesor de Muro */}
          <Tooltip title="Cambiar espesor constructivo de muros">
            <Chip
              icon={<WallIcon fontSize="small" />}
              label={`Muro: ${Math.round(wallThicknessMeters * 100)} cm`}
              size="small"
              onClick={(e) => setWallMenuAnchor(e.currentTarget)}
              variant="outlined"
              clickable
              sx={{ fontWeight: 700, fontSize: '0.75rem', height: 28 }}
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

          {/* ⚡ Botón de Auto-Ensamble Inteligente */}
          <Tooltip title="Auto-ensamblar y alinear planta arquitectónica según el grafo topológico">
            <Chip
              icon={<AutoLayoutIcon fontSize="small" />}
              label="Auto-Ensamblar"
              color="primary"
              size="small"
              onClick={() => autoAssembleRooms()}
              clickable
              variant="filled"
              sx={{ fontWeight: 700, fontSize: '0.75rem', height: 28 }}
            />
          </Tooltip>

          {/* 🤖 Botón Asistente de Relevamiento Incremental */}
          <Tooltip title={isAssistantOpen ? 'Ocultar Asistente de Relevamiento' : 'Abrir Asistente de Relevamiento'}>
            <Chip
              label={`Asistente ${questionsQueue.length > 0 ? `(${questionsQueue.length})` : '✓'}`}
              color={questionsQueue.length > 0 ? 'warning' : 'success'}
              size="small"
              onClick={() => toggleAssistantOpen()}
              clickable
              variant={isAssistantOpen ? 'filled' : 'outlined'}
              sx={{ fontWeight: 700, fontSize: '0.75rem', height: 28 }}
            />
          </Tooltip>

          <Box sx={{ height: 18, width: 1, bgcolor: '#cbd5e1' }} />

          {/* Botón Compacto de Snap Magnético */}
          <Tooltip title={isSnapEnabled ? 'Atracción magnética activa' : 'Atracción magnética desactivada'}>
            <Chip
              icon={<SnapIcon fontSize="small" />}
              label="Snap"
              color={isSnapEnabled ? 'primary' : 'default'}
              size="small"
              onClick={() => toggleSnap()}
              clickable
              variant={isSnapEnabled ? 'filled' : 'outlined'}
              sx={{ fontWeight: 600, fontSize: '0.75rem', height: 28 }}
            />
          </Tooltip>

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

          {/* Controles de Zoom Compactos */}
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

        {/* Capa 2: Guías visuales de Snapping Magnético (No interactiva) */}
        {activeSnapGuides.length > 0 && (
          <Layer listening={false}>
            {activeSnapGuides.map((guide) => {
              const points =
                guide.orientation === 'vertical'
                  ? [guide.position, guide.start, guide.position, guide.end]
                  : [guide.start, guide.position, guide.end, guide.position];

              const isTopo = guide.isTopologicalAdjacency;

              return (
                <Line
                  key={guide.id}
                  points={points}
                  stroke={isTopo ? '#10b981' : '#00e5ff'}
                  strokeWidth={isTopo ? 3 : 2}
                  dash={isTopo ? [8, 3] : [6, 4]}
                  shadowColor={isTopo ? '#10b981' : '#00e5ff'}
                  shadowBlur={6}
                  perfectDrawEnabled={false}
                />
              );
            })}
          </Layer>
        )}

        {/* Capa 3: Ambientes Arquitectónicos Métricos, Muros y Aberturas */}
        <Layer>
          {rooms
            .filter((r) => !r.isAccessPoint && !r.isTechnicalIsland)
            .map((room) => (
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
      </Stage>

      {/* 🤖 Asistente de Relevamiento Incremental Móvil */}
      <IncrementalSurveyAssistant />
    </Box>
  );
};
