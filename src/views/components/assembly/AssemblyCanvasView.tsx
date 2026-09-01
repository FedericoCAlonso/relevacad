/**
 * View: AssemblyCanvasView (Fase 3: Vista de Ensamblaje Canvas 2D)
 * Renderizado gráfico planimétrico de los ambientes como recinto arquitectónico real:
 * - Muros con espesor constructivo parametrizable (10cm, 15cm, 20cm)
 * - Dimensiones netas tomadas desde el interior de cada ambiente
 * - Aberturas arquitectónicas CAD reales en los muros (hojas batientes, corredizas y vanos)
 * - Barra de herramientas flotante compacta y elegante (Glassmorphic Pill)
 * - Snap magnético interactivo (~15px)
 */

import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Text, Group, Line, Circle, Path } from 'react-konva';
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
  ListItemText
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RestartAlt as ResetViewIcon,
  AutoFixHigh as SnapIcon,
  ViewInAr as WallIcon,
  AccountTree as TopologyLinesIcon,
  Architecture as ArchPlanIcon
} from '@mui/icons-material';
import { useSurveyViewModel } from '@/viewmodels';
import { metersToPixels, PIXELS_PER_METER } from '@/viewmodels/utils/geometryUtils';
import {
  calculatePolygonArea,
  calculateRoomPolygon
} from '@/viewmodels/utils/polygonSolver';
import { ELECTRICAL_ASSET_CATALOG } from '@/models/ElectricalTypes';
import { CONNECTION_TYPE_CATALOG, LogicalConnection } from '@/models/GraphModel';
import { ArchitecturalOpeningShape } from './ArchitecturalOpeningShape';

// SVG Path escalado para contorno orgánico de Nube Arquitectónica
const CLOUD_PATH_DATA =
  'M 30,65 a 22,22 0 0,1 26,-15 a 30,30 0 0,1 52,-4 a 22,22 0 0,1 36,10 a 22,22 0 0,1 -6,38 h -90 a 20,20 0 0,1 -18,-29 z';

export const AssemblyCanvasView: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
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
    isSnapEnabled,
    toggleSnap,
    activeSnapGuides,
    handleRoomDrag,
    handleRoomDragEnd,
    wallThicknessMeters,
    setWallThickness
  } = useSurveyViewModel();

  const wallThicknessPx = wallThicknessMeters * PIXELS_PER_METER;

  // Ajustar el tamaño del canvas al contenedor visible
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleZoom = (factor: number) => {
    setScale((prev) => Math.max(0.3, Math.min(prev * factor, 3)));
  };

  const handleResetView = () => {
    setScale(1);
    setStagePos({ x: 80, y: 60 });
  };

  /**
   * Obtiene las aberturas conectadas a una pared específica de un ambiente
   */
  const getOpeningsForWall = (roomId: string, wall: 'north' | 'south' | 'east' | 'west') => {
    return connections.filter((conn) => {
      if (!conn.opening) return false;
      if (conn.sourceRoomId === roomId && conn.sourceWall === wall) return true;
      if (conn.targetRoomId === roomId && conn.targetWall === wall) return true;
      return false;
    });
  };

  /**
   * Renderiza los segmentos de muro con mochetas y aberturas CAD integradas
   */
  const renderWallWithOpenings = (
    wall: 'north' | 'south' | 'east' | 'west',
    roomWidthPx: number,
    roomLengthPx: number,
    wallOpenings: LogicalConnection[]
  ) => {
    const wallLengthPx = wall === 'north' || wall === 'south' ? roomWidthPx : roomLengthPx;
    const isHoriz = wall === 'north' || wall === 'south';

    // Muro sin aberturas -> Muro Sólido
    if (wallOpenings.length === 0) {
      let x = 0;
      let y = 0;
      let w = roomWidthPx;
      let h = wallThicknessPx;

      if (wall === 'north') {
        x = -wallThicknessPx;
        y = -wallThicknessPx;
        w = roomWidthPx + 2 * wallThicknessPx;
        h = wallThicknessPx;
      } else if (wall === 'south') {
        x = -wallThicknessPx;
        y = roomLengthPx;
        w = roomWidthPx + 2 * wallThicknessPx;
        h = wallThicknessPx;
      } else if (wall === 'west') {
        x = -wallThicknessPx;
        y = 0;
        w = wallThicknessPx;
        h = roomLengthPx;
      } else if (wall === 'east') {
        x = roomWidthPx;
        y = 0;
        w = wallThicknessPx;
        h = roomLengthPx;
      }

      return (
        <Rect
          key={`wall-solid-${wall}`}
          x={x}
          y={y}
          width={w}
          height={h}
          fill="#1e293b"
          cornerRadius={0.5}
        />
      );
    }

    // Muro con Abertura -> Hueco en el Muro + Símbolo CAD
    const elements: React.ReactNode[] = [];
    const opening = wallOpenings[0];
    const openingWidthPx = Math.min(wallLengthPx * 0.9, (opening.opening?.widthMeters || 0.8) * PIXELS_PER_METER);
    const centerPos = wallLengthPx / 2;
    const startOpening = Math.max(0, centerPos - openingWidthPx / 2);
    const endOpening = Math.min(wallLengthPx, centerPos + openingWidthPx / 2);

    // Segmento 1 de muro (antes del vano)
    if (startOpening > 2) {
      if (isHoriz) {
        const yPos = wall === 'north' ? -wallThicknessPx : roomLengthPx;
        elements.push(
          <Rect
            key={`wall-seg1-${wall}`}
            x={wall === 'north' ? -wallThicknessPx : -wallThicknessPx}
            y={yPos}
            width={startOpening + wallThicknessPx}
            height={wallThicknessPx}
            fill="#1e293b"
          />
        );
      } else {
        const xPos = wall === 'west' ? -wallThicknessPx : roomWidthPx;
        elements.push(
          <Rect
            key={`wall-seg1-${wall}`}
            x={xPos}
            y={0}
            width={wallThicknessPx}
            height={startOpening}
            fill="#1e293b"
          />
        );
      }
    }

    // Segmento 2 de muro (después del vano)
    if (wallLengthPx - endOpening > 2) {
      if (isHoriz) {
        const yPos = wall === 'north' ? -wallThicknessPx : roomLengthPx;
        elements.push(
          <Rect
            key={`wall-seg2-${wall}`}
            x={endOpening}
            y={yPos}
            width={wallLengthPx - endOpening + wallThicknessPx}
            height={wallThicknessPx}
            fill="#1e293b"
          />
        );
      } else {
        const xPos = wall === 'west' ? -wallThicknessPx : roomWidthPx;
        elements.push(
          <Rect
            key={`wall-seg2-${wall}`}
            x={xPos}
            y={endOpening}
            width={wallThicknessPx}
            height={wallLengthPx - endOpening}
            fill="#1e293b"
          />
        );
      }
    }

    // Renderizar la Abertura Arquitectónica
    if (opening.opening) {
      let openingGroupY = 0;
      if (wall === 'south') openingGroupY = roomLengthPx;
      if (wall === 'east') openingGroupY = 0;

      elements.push(
        <Group key={`opening-${opening.id}`} y={openingGroupY}>
          <ArchitecturalOpeningShape
            wall={wall}
            opening={opening.opening}
            wallLengthPx={wallLengthPx}
            wallThicknessPx={wallThicknessPx}
            offsetRatio={0.5}
          />
        </Group>
      );
    }

    return elements;
  };

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
          top: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          borderRadius: 8,
          py: 0.6,
          px: 1.5,
          bgcolor: 'rgba(255, 255, 255, 0.92)',
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
            color: '#ffffff'
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
        {/* Capa de Cuadrícula y Vínculos de Topología (Solo si se activa el modo grafo) */}
        <Layer>
          {showAbstractEdges &&
            connections.map((conn) => {
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
                <Group key={conn.id}>
                  <Line
                    points={[sX, sY, tX, tY]}
                    stroke={connMeta.color}
                    strokeWidth={2}
                    dash={conn.type === 'pass_through' ? [6, 6] : undefined}
                    opacity={0.5}
                  />
                </Group>
              );
            })}

          {/* Guías visuales de Snapping Magnético */}
          {activeSnapGuides.map((guide) => {
            const points =
              guide.orientation === 'vertical'
                ? [guide.position, guide.start, guide.position, guide.end]
                : [guide.start, guide.position, guide.end, guide.position];

            return (
              <Line
                key={guide.id}
                points={points}
                stroke="#00e5ff"
                strokeWidth={2}
                dash={[6, 4]}
                shadowColor="#00e5ff"
                shadowBlur={4}
              />
            );
          })}
        </Layer>

        {/* Capa de Ambientes, Muros Constructivos, Aberturas y Elementos Eléctricos */}
        <Layer>
          {rooms.map((room) => {
            const isSelected = room.id === selectedRoomId;
            const isNonMetric = room.isAccessPoint || room.isTechnicalIsland;

            // ☁️ 1. RENDERIZADO COMO NUBE PARA ACCESOS E ISLAS TÉCNICAS (Sin muros rígidos)
            if (isNonMetric) {
              const cloudFill = room.isTechnicalIsland ? '#fef3c7' : '#ecfdf5';
              const cloudStroke = isSelected
                ? '#00629e'
                : room.isTechnicalIsland
                ? '#d97706'
                : '#10b981';

              return (
                <Group
                  key={room.id}
                  id={room.id}
                  x={room.canvasPosition.x}
                  y={room.canvasPosition.y}
                  draggable
                  onClick={() => selectRoom(room.id)}
                  onDragMove={(e) => {
                    const node = e.target;
                    const snapped = handleRoomDrag(room.id, { x: node.x(), y: node.y() });
                    node.x(snapped.x);
                    node.y(snapped.y);
                  }}
                  onDragEnd={() => {
                    handleRoomDragEnd();
                  }}
                >
                  <Path
                    data={CLOUD_PATH_DATA}
                    scaleX={1.15}
                    scaleY={1.1}
                    fill={cloudFill}
                    opacity={0.88}
                    stroke={cloudStroke}
                    strokeWidth={isSelected ? 3 : 2}
                    dash={[6, 4]}
                    shadowColor={isSelected ? '#00629e' : '#000000'}
                    shadowBlur={isSelected ? 14 : 4}
                    shadowOpacity={0.2}
                  />

                  <Text
                    text={`☁️ ${room.name}`}
                    x={15}
                    y={42}
                    fontSize={11}
                    fontStyle="bold"
                    fontFamily="Roboto, sans-serif"
                    fill={room.isTechnicalIsland ? '#92400e' : '#065f46'}
                    width={150}
                    align="center"
                  />
                  <Text
                    text={room.isTechnicalIsland ? 'Isla de Suministro' : 'Límite Exterior / Palier'}
                    x={15}
                    y={58}
                    fontSize={8.5}
                    fontFamily="Roboto, sans-serif"
                    fill="#64748b"
                    width={150}
                    align="center"
                  />
                </Group>
              );
            }

            // 🏠 2. RENDERIZADO COMO RECINTO CONSTRUCTIVO REAL (Mediciones Interiores Netas)
            const widthPx = metersToPixels(room.dimensions?.width || 3);
            const lengthPx = metersToPixels(room.dimensions?.length || 2.5);
            const verticesMeters = calculateRoomPolygon(room);
            const realArea = calculatePolygonArea(verticesMeters);

            const northOpenings = getOpeningsForWall(room.id, 'north');
            const southOpenings = getOpeningsForWall(room.id, 'south');
            const eastOpenings = getOpeningsForWall(room.id, 'east');
            const westOpenings = getOpeningsForWall(room.id, 'west');

            const polyPointsPx = verticesMeters.flatMap((v) => [metersToPixels(v.x), metersToPixels(v.y)]);
            const hasBreaks = (room.geometry?.wallBreaks || []).length > 0;

            const isWLocked = room.dimensions.widthLocked ?? true;
            const isLLocked = room.dimensions.lengthLocked ?? true;
            const widthText = isWLocked ? `${room.dimensions.width}` : `~${room.dimensions.width}`;
            const lengthText = isLLocked ? `${room.dimensions.length}` : `~${room.dimensions.length}`;

            return (
              <Group
                key={room.id}
                id={room.id}
                x={room.canvasPosition.x}
                y={room.canvasPosition.y}
                draggable
                onClick={() => selectRoom(room.id)}
                onDragMove={(e) => {
                  const node = e.target;
                  const snapped = handleRoomDrag(room.id, { x: node.x(), y: node.y() });
                  node.x(snapped.x);
                  node.y(snapped.y);
                }}
                onDragEnd={() => {
                  handleRoomDragEnd();
                }}
              >
                {/* Superficie / Suelo Interior (Medidas Libres Netas con soporte a Polígonos de N Vértices / Z-Walls) */}
                {hasBreaks ? (
                  <Line
                    points={polyPointsPx}
                    closed
                    fill={room.color || '#f8fafc'}
                    opacity={isSelected ? 0.95 : 0.85}
                    shadowColor={isSelected ? '#00629e' : '#000000'}
                    shadowBlur={isSelected ? 16 : 4}
                    shadowOpacity={isSelected ? 0.35 : 0.08}
                  />
                ) : (
                  <Rect
                    x={0}
                    y={0}
                    width={widthPx}
                    height={lengthPx}
                    fill={room.color || '#f8fafc'}
                    opacity={isSelected ? 0.95 : 0.85}
                    shadowColor={isSelected ? '#00629e' : '#000000'}
                    shadowBlur={isSelected ? 16 : 4}
                    shadowOpacity={isSelected ? 0.35 : 0.08}
                  />
                )}

                {/* 🧱 Renderizado de los 4 Muros Perimetrales con Espesor y Aberturas Reales */}
                {renderWallWithOpenings('north', widthPx, lengthPx, northOpenings)}
                {renderWallWithOpenings('south', widthPx, lengthPx, southOpenings)}
                {renderWallWithOpenings('west', widthPx, lengthPx, westOpenings)}
                {renderWallWithOpenings('east', widthPx, lengthPx, eastOpenings)}

                {/* Indicador de Selección Activa */}
                {isSelected && (
                  <Rect
                    x={-wallThicknessPx - 1}
                    y={-wallThicknessPx - 1}
                    width={widthPx + 2 * wallThicknessPx + 2}
                    height={lengthPx + 2 * wallThicknessPx + 2}
                    stroke="#0284c7"
                    strokeWidth={2}
                    dash={[6, 4]}
                  />
                )}

                {/* Nombre y Dimensiones Interiores Netas con estado de bloqueo */}
                <Text
                  text={room.name}
                  x={10}
                  y={12}
                  fontSize={11.5}
                  fontStyle="bold"
                  fontFamily="Roboto, sans-serif"
                  fill="#0f172a"
                  width={widthPx - 20}
                  align="center"
                />
                <Text
                  text={`${widthText} × ${lengthText}m • ${realArea}m²`}
                  x={10}
                  y={27}
                  fontSize={9}
                  fontFamily="Roboto, sans-serif"
                  fill={!isWLocked || !isLLocked ? '#0284c7' : '#64748b'}
                  width={widthPx - 20}
                  align="center"
                />

                {/* Renderizado de Bocas y Elementos Eléctricos en Paredes Interiores */}
                {room.electricalAssets.map((asset) => {
                  const meta = ELECTRICAL_ASSET_CATALOG[asset.type] || { code: 'E' };
                  let posX = widthPx / 2;
                  let posY = lengthPx / 2;

                  if (asset.wall === 'north') {
                    posX = asset.offsetRatio * widthPx;
                    posY = 0;
                  } else if (asset.wall === 'south') {
                    posX = asset.offsetRatio * widthPx;
                    posY = lengthPx;
                  } else if (asset.wall === 'west') {
                    posX = 0;
                    posY = asset.offsetRatio * lengthPx;
                  } else if (asset.wall === 'east') {
                    posX = widthPx;
                    posY = asset.offsetRatio * lengthPx;
                  }

                  const isPanel = asset.type === 'main_panel' || asset.type === 'sub_panel';
                  const isLighting = asset.type === 'ceiling_light' || asset.type === 'wall_light';
                  const symbolColor = isPanel ? '#dc2626' : isLighting ? '#d97706' : '#2563eb';

                  return (
                    <Group key={asset.id} x={posX} y={posY}>
                      <Circle
                        radius={6.5}
                        fill={symbolColor}
                        stroke="#ffffff"
                        strokeWidth={1.5}
                        shadowColor="#000000"
                        shadowBlur={2}
                        shadowOpacity={0.3}
                      />
                      <Text
                        text={meta.code}
                        x={-8}
                        y={-3.5}
                        fontSize={7}
                        fontStyle="bold"
                        fontFamily="Roboto, sans-serif"
                        fill="#ffffff"
                        width={16}
                        align="center"
                      />
                    </Group>
                  );
                })}
              </Group>
            );
          })}
        </Layer>
      </Stage>
    </Box>
  );
};
