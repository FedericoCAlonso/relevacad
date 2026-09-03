/**
 * View Component: RoomAssemblyShape (Konva 2D Architectural Room Node)
 * Implementa Bitmap Caching nativo (group.cache()) por ambiente con:
 * - Colocalización exacta de aberturas en ambos ambientes que comparten el muro.
 * - Deduplicación estricta de símbolos CAD (se dibuja una sola vez sin duplicar arcos).
 * - Muros compartidos unificados con espesor individual por tabique (10cm, 15cm, 20cm, 30cm, 7cm).
 * - Soporte para 0 (pared ciega), 1 o múltiples aberturas en la misma pared (ej. puerta + pasa-platos).
 * - Mochetas sólidas calculadas dinámicamente sin solapamiento con vanos.
 */

import React, { memo } from 'react';
import { Group, Rect, Text, Line, Circle } from 'react-konva';
import { Room, TIPO_CUBIERTA_CATALOG, isMetricRoom, WallOrientation } from '@/models/RoomModel';
import { LogicalConnection } from '@/models/GraphModel';
import { ELECTRICAL_ASSET_CATALOG } from '@/models/ElectricalTypes';
import { metersToPixels, PIXELS_PER_METER } from '@/viewmodels/utils/geometryUtils';
import {
  calculatePolygonArea,
  calculateRoomPolygon
} from '@/viewmodels/utils/polygonSolver';
import { calculateRoomPlanimetry, WallPlanimetryInfo } from '@/viewmodels/utils/unifiedFloorPlanSolver';
import { ArchitecturalOpeningShape } from './ArchitecturalOpeningShape';

interface RoomAssemblyShapeProps {
  room: Room;
  allRooms: Room[];
  isSelected: boolean;
  wallThicknessPx: number;
  openings: LogicalConnection[];
  onSelect: (roomId: string) => void;
  onDragMove: (roomId: string, node: any) => void;
  onDragEnd: (roomId: string, node: any) => void;
  onWallClick?: (roomId: string, wall: WallOrientation, clickOffsetMeters: number, clickRatio: number) => void;
}

export const RoomAssemblyShape = memo<RoomAssemblyShapeProps>(({
  room,
  allRooms,
  isSelected,
  wallThicknessPx,
  openings,
  onSelect,
  onDragMove,
  onDragEnd,
  onWallClick
}) => {
  const isNonMetric = !isMetricRoom(room);

  // 🧱 ZONAS NO RELEVADAS / LÍMITES Y ACCESOS (Áreas Difuminadas sin Bordes e Islas Flotantes)
  if (isNonMetric) {
    const isTechnical = room.isTechnicalIsland || room.type.startsWith('technical_island');

    // ⚡ CASO 1: AMBIENTE ISLA TÉCNICA (Cuadrado con bordes definidos, libre / no anclado a nada)
    if (isTechnical) {
      const sidePx = 54;
      return (
        <Group
          id={room.id}
          x={room.canvasPosition.x}
          y={room.canvasPosition.y}
          draggable
          onTouchStart={(e) => {
            e.cancelBubble = true;
          }}
          onMouseDown={(e) => {
            e.cancelBubble = true;
          }}
          onDragStart={(e) => {
            e.cancelBubble = true;
          }}
          onClick={(e) => {
            e.cancelBubble = true;
            onSelect(room.id);
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            onSelect(room.id);
          }}
          onDragMove={(e) => {
            e.cancelBubble = true;
            onDragMove(room.id, e.target);
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            onSelect(room.id);
            onDragEnd(room.id, e.target);
          }}
        >
          <Rect
            x={0}
            y={0}
            width={sidePx}
            height={sidePx}
            fill="#fffbeb"
            stroke={isSelected ? '#0284c7' : '#d97706'}
            strokeWidth={isSelected ? 2.5 : 2}
            cornerRadius={4}
            shadowColor="rgba(217, 119, 6, 0.2)"
            shadowBlur={6}
          />
          <Text
            text="⚡"
            x={0}
            y={8}
            fontSize={16}
            width={sidePx}
            align="center"
            listening={false}
          />
          <Text
            text={room.name.toUpperCase()}
            x={2}
            y={28}
            fontSize={8}
            fontStyle="bold"
            fontFamily="Outfit, Roboto, sans-serif"
            fill="#92400e"
            width={sidePx - 4}
            align="center"
            listening={false}
          />
          <Text
            text="Isla Libre"
            x={2}
            y={40}
            fontSize={7}
            fontFamily="Outfit, Roboto, sans-serif"
            fill="#b45309"
            width={sidePx - 4}
            align="center"
            listening={false}
          />
        </Group>
      );
    }

    // 🌫️ CASO 2: REGIONES DIFUMINADAS SIN BORDES (Palier, Patios, Límites de Referencia)
    // No tienen bordes, son gradientes radiales difuminados que se mezclan sin invadir la propiedad.
    const isPalier = room.isAccessPoint || room.type === 'access_palier';
    const isPatio = room.type === 'limit_patio';

    const wPx = metersToPixels(room.dimensions?.width > 0 ? room.dimensions.width : 2.5);
    const hPx = metersToPixels(room.dimensions?.length > 0 ? room.dimensions.length : 2.5);
    const radius = Math.max(wPx, hPx) * 0.58;
    const centerX = wPx / 2;
    const centerY = hPx / 2;

    const colorCenter = isPalier
      ? 'rgba(16, 185, 129, 0.28)'
      : isPatio
      ? 'rgba(14, 165, 233, 0.28)'
      : 'rgba(148, 163, 184, 0.22)';

    const colorMid = isPalier
      ? 'rgba(16, 185, 129, 0.10)'
      : isPatio
      ? 'rgba(14, 165, 233, 0.08)'
      : 'rgba(148, 163, 184, 0.06)';

    const colorEdge = 'rgba(255, 255, 255, 0)';

    const textFill = isPalier ? '#047857' : isPatio ? '#0369a1' : '#475569';
    const label = isPalier
      ? `🏢 ${room.name}`
      : isPatio
      ? `☀️ ${room.name}`
      : `🧱 ${room.name}`;

    return (
      <Group
        id={room.id}
        x={room.canvasPosition.x}
        y={room.canvasPosition.y}
        draggable
        onTouchStart={(e) => {
          e.cancelBubble = true;
        }}
        onMouseDown={(e) => {
          e.cancelBubble = true;
        }}
        onDragStart={(e) => {
          e.cancelBubble = true;
        }}
        onClick={(e) => {
          e.cancelBubble = true;
          onSelect(room.id);
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          onSelect(room.id);
        }}
        onDragMove={(e) => {
          e.cancelBubble = true;
          onDragMove(room.id, e.target);
        }}
        onDragEnd={(e) => {
          e.cancelBubble = true;
          onSelect(room.id);
          onDragEnd(room.id, e.target);
        }}
      >
        {/* Halo difuminado sin bordes */}
        <Circle
          x={centerX}
          y={centerY}
          radius={radius}
          fillRadialGradientStartPoint={{ x: 0, y: 0 }}
          fillRadialGradientStartRadius={0}
          fillRadialGradientEndPoint={{ x: 0, y: 0 }}
          fillRadialGradientEndRadius={radius}
          fillRadialGradientColorStops={[0, colorCenter, 0.55, colorMid, 1, colorEdge]}
          strokeEnabled={false}
          perfectDrawEnabled={false}
        />

        {/* Si está seleccionado, indicador sutil de selección */}
        {isSelected && (
          <Circle
            x={centerX}
            y={centerY}
            radius={radius * 0.55}
            stroke="#0284c7"
            strokeWidth={1.5}
            dash={[4, 4]}
            opacity={0.6}
            perfectDrawEnabled={false}
          />
        )}

        {/* Rótulo tipográfico integrado en el difuminado */}
        <Text
          text={label}
          x={0}
          y={centerY - 9}
          fontSize={11}
          fontStyle="bold"
          fontFamily="Outfit, Roboto, sans-serif"
          fill={textFill}
          width={wPx}
          align="center"
          listening={false}
        />
        <Text
          text="Zona de Referencia"
          x={0}
          y={centerY + 6}
          fontSize={8}
          fontFamily="Outfit, Roboto, sans-serif"
          fill="#94a3b8"
          width={wPx}
          align="center"
          listening={false}
        />
      </Group>
    );
  }

  // 🏠 RECINTO ARQUITECTÓNICO CONSTRUCTIVO
  const widthPx = metersToPixels(room.dimensions?.width || 3);
  const lengthPx = metersToPixels(room.dimensions?.length || 2.5);
  const verticesMeters = calculateRoomPolygon(room);
  const realArea = calculatePolygonArea(verticesMeters);

  // Deduplicación y cálculo de muros e interfaces con colocalización de vanos y espesores individuales
  const planimetry = calculateRoomPlanimetry(
    room,
    allRooms,
    openings,
    wallThicknessPx / PIXELS_PER_METER
  );

  const polyPointsPx = verticesMeters.flatMap((v) => [metersToPixels(v.x), metersToPixels(v.y)]);
  const isPolygonRoom = Boolean(
    room.geometry?.mode === 'polygon' ||
    (room.geometry?.computedVertices && room.geometry.computedVertices.length >= 3 && room.geometry.computedVertices.length !== 4) ||
    (room.geometry?.arcWalls && room.geometry.arcWalls.length > 0) ||
    verticesMeters.length > 4
  );
  const hasBreaks = (room.geometry?.wallBreaks || []).length > 0 || isPolygonRoom;

  const isWLocked = room.dimensions.widthLocked ?? true;
  const isLLocked = room.dimensions.lengthLocked ?? true;
  const widthText = isWLocked ? `${room.dimensions.width}` : `~${room.dimensions.width}`;
  const lengthText = isLLocked ? `${room.dimensions.length}` : `~${room.dimensions.length}`;

  const handleWallPointerClick = (e: any, wall: WallOrientation) => {
    e.cancelBubble = true;
    if (!isSelected) {
      // Si el ambiente no está seleccionado, el primer toque lo selecciona en lugar de disparar un diálogo modal
      onSelect(room.id);
      return;
    }
    if (!onWallClick) return;

    const stage = e.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const scale = stage.scaleX() || 1;
    const localX = (pointer.x - stage.x()) / scale - room.canvasPosition.x;
    const localY = (pointer.y - stage.y()) / scale - room.canvasPosition.y;

    let clickMeters = 0;
    let clickRatio = 0.5;

    if (wall === 'north' || wall === 'south') {
      const clampedX = Math.max(0, Math.min(widthPx, localX));
      clickMeters = clampedX / PIXELS_PER_METER;
      clickRatio = widthPx > 0 ? clampedX / widthPx : 0.5;
    } else {
      const clampedY = Math.max(0, Math.min(lengthPx, localY));
      clickMeters = clampedY / PIXELS_PER_METER;
      clickRatio = lengthPx > 0 ? clampedY / lengthPx : 0.5;
    }

    onWallClick(room.id, wall, Number(clickMeters.toFixed(2)), Number(clickRatio.toFixed(3)));
  };

  const renderWallWithOpenings = (
    wallInfo: WallPlanimetryInfo,
    roomWidthPx: number,
    roomLengthPx: number
  ) => {
    const { wall, intervals, segments = [] } = wallInfo;
    const isHoriz = wall === 'north' || wall === 'south';
    const wallLengthPx = isHoriz ? roomWidthPx : roomLengthPx;

    // Si el solver calculó el desglose por intervalos de la pared (concepto abierto o tabiques con tramos no comunes)
    if (segments.length > 0) {
      const segElements: React.ReactNode[] = [];

      segments.forEach((seg, idx) => {
        if (seg.type === 'virtual') {
          // Línea punteada de límite virtual únicamente en este tramo de contacto
          let points: number[] = [];
          if (wall === 'north') points = [seg.startPx, 0, seg.endPx, 0];
          else if (wall === 'south') points = [seg.startPx, roomLengthPx, seg.endPx, roomLengthPx];
          else if (wall === 'west') points = [0, seg.startPx, 0, seg.endPx];
          else if (wall === 'east') points = [roomWidthPx, seg.startPx, roomWidthPx, seg.endPx];

          segElements.push(
            <Line
              key={`wall-virt-${wall}-${idx}`}
              points={points}
              stroke="#0284c7"
              strokeWidth={1.5}
              dash={[6, 4]}
              opacity={0.8}
              listening={false}
              perfectDrawEnabled={false}
            />
          );
        } else if (seg.type === 'solid_exterior' || seg.type === 'solid_shared') {
          const segTh = seg.thicknessMeters * PIXELS_PER_METER;
          const isStartCorner = seg.startPx === 0;
          const isEndCorner = Math.abs(seg.endPx - wallLengthPx) <= 2;

          let x = 0;
          let y = 0;
          let w = 0;
          let h = 0;

          if (wall === 'north') {
            x = isStartCorner ? -segTh : seg.startPx;
            y = -segTh;
            w = (seg.endPx - seg.startPx) + (isStartCorner ? segTh : 0) + (isEndCorner ? segTh : 0);
            h = segTh;
          } else if (wall === 'south') {
            x = isStartCorner ? -segTh : seg.startPx;
            y = roomLengthPx;
            w = (seg.endPx - seg.startPx) + (isStartCorner ? segTh : 0) + (isEndCorner ? segTh : 0);
            h = segTh;
          } else if (wall === 'west') {
            x = -segTh;
            y = isStartCorner ? -segTh : seg.startPx;
            w = segTh;
            h = (seg.endPx - seg.startPx) + (isStartCorner ? segTh : 0) + (isEndCorner ? segTh : 0);
          } else if (wall === 'east') {
            x = roomWidthPx;
            y = isStartCorner ? -segTh : seg.startPx;
            w = segTh;
            h = (seg.endPx - seg.startPx) + (isStartCorner ? segTh : 0) + (isEndCorner ? segTh : 0);
          }

          if (w > 0 && h > 0) {
            segElements.push(
              <Rect
                key={`wall-solid-${wall}-${idx}`}
                x={x}
                y={y}
                width={w}
                height={h}
                fill="#1e293b"
                opacity={seg.type === 'solid_shared' ? 0.92 : 1}
                cornerRadius={0.5}
                listening={false}
                perfectDrawEnabled={false}
              />
            );
          }
        }
      });

      // Dibujar los símbolos CAD de las aberturas
      intervals.forEach((interval, idx) => {
        if (interval.shouldDrawSymbol) {
          let openingGroupY = 0;
          if (wall === 'south') openingGroupY = roomLengthPx;
          if (wall === 'east') openingGroupY = 0;

          segElements.push(
            <Group key={`opening-${interval.opening.id || idx}`} y={openingGroupY} listening={false}>
              <ArchitecturalOpeningShape
                wall={wall}
                opening={interval.opening}
                wallLengthPx={wallLengthPx}
                wallThicknessPx={wallThicknessPx}
                offsetRatio={interval.offsetRatio}
              />
            </Group>
          );
        }
      });

      return segElements;
    }

    return null;
  };

  const cubiertaMeta = TIPO_CUBIERTA_CATALOG[room.tipoCubierta || 'cubierto'];
  const isDescubierto = room.tipoCubierta === 'descubierto';
  const isSemicubierto = room.tipoCubierta === 'semicubierto';

  return (
    <Group
      id={room.id}
      x={room.canvasPosition.x}
      y={room.canvasPosition.y}
      draggable
      onTouchStart={(e) => {
        e.cancelBubble = true;
      }}
      onMouseDown={(e) => {
        e.cancelBubble = true;
      }}
      onDragStart={(e) => {
        e.cancelBubble = true;
      }}
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect(room.id);
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect(room.id);
      }}
      onDragMove={(e) => {
        e.cancelBubble = true;
        onDragMove(room.id, e.target);
      }}
      onDragEnd={(e) => {
        e.cancelBubble = true;
        onSelect(room.id);
        onDragEnd(room.id, e.target);
      }}
    >
      <Group>
        {/* Superficie / Suelo Interior */}
        {hasBreaks ? (
          <Line
            points={polyPointsPx}
            closed
            fill={isDescubierto ? '#f0fdf4' : isSemicubierto ? '#fffdfa' : (room.color || '#f8fafc')}
            opacity={1}
            shadowColor={isSelected ? '#00629e' : '#000000'}
            shadowBlur={isSelected ? 16 : 4}
            shadowOpacity={isSelected ? 0.35 : 0.08}
            perfectDrawEnabled={false}
          />
        ) : (
          <Rect
            x={0}
            y={0}
            width={widthPx}
            height={lengthPx}
            fill={isDescubierto ? '#f0fdf4' : isSemicubierto ? '#fffdfa' : (room.color || '#f8fafc')}
            opacity={1}
            shadowColor={isSelected ? '#00629e' : '#000000'}
            shadowBlur={isSelected ? 16 : 4}
            shadowOpacity={isSelected ? 0.35 : 0.08}
            perfectDrawEnabled={false}
          />
        )}

        {/* 🧱 Muros Perimetrales con Espesores Individuales y Multi-Aberturas Colocalizadas */}
        {isPolygonRoom ? (
          <Line
            points={polyPointsPx}
            closed
            stroke="#1e293b"
            strokeWidth={wallThicknessPx * 2}
            lineJoin="miter"
            strokeScaleEnabled={false}
            listening={false}
          />
        ) : (
          <>
            {renderWallWithOpenings(planimetry.north, widthPx, lengthPx)}
            {renderWallWithOpenings(planimetry.south, widthPx, lengthPx)}
            {renderWallWithOpenings(planimetry.west, widthPx, lengthPx)}
            {renderWallWithOpenings(planimetry.east, widthPx, lengthPx)}
          </>
        )}

        {/* 🧱 Hitboxes interactivos en las 4 paredes para configuración directa y anclaje de aberturas */}
        {onWallClick && (
          <Group name="wall-hitboxes">
            {/* Pared Norte */}
            <Rect
              x={0}
              y={-wallThicknessPx - 6}
              width={widthPx}
              height={wallThicknessPx + 12}
              fill="transparent"
              listening={true}
              onClick={(e) => handleWallPointerClick(e, 'north')}
              onTap={(e) => handleWallPointerClick(e, 'north')}
              onMouseEnter={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'pointer';
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'default';
              }}
            />
            {/* Pared Sur */}
            <Rect
              x={0}
              y={lengthPx - 6}
              width={widthPx}
              height={wallThicknessPx + 12}
              fill="transparent"
              listening={true}
              onClick={(e) => handleWallPointerClick(e, 'south')}
              onTap={(e) => handleWallPointerClick(e, 'south')}
              onMouseEnter={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'pointer';
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'default';
              }}
            />
            {/* Pared Oeste */}
            <Rect
              x={-wallThicknessPx - 6}
              y={0}
              width={wallThicknessPx + 12}
              height={lengthPx}
              fill="transparent"
              listening={true}
              onClick={(e) => handleWallPointerClick(e, 'west')}
              onTap={(e) => handleWallPointerClick(e, 'west')}
              onMouseEnter={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'pointer';
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'default';
              }}
            />
            {/* Pared Este */}
            <Rect
              x={widthPx - 6}
              y={0}
              width={wallThicknessPx + 12}
              height={lengthPx}
              fill="transparent"
              listening={true}
              onClick={(e) => handleWallPointerClick(e, 'east')}
              onTap={(e) => handleWallPointerClick(e, 'east')}
              onMouseEnter={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'pointer';
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'default';
              }}
            />
          </Group>
        )}

        {/* Indicador de Selección Activa */}
        {isSelected &&
          (hasBreaks ? (
            <Line
              points={polyPointsPx}
              closed
              stroke="#0284c7"
              strokeWidth={2}
              dash={[6, 4]}
              listening={false}
              perfectDrawEnabled={false}
            />
          ) : (
            <Rect
              x={-wallThicknessPx - 1}
              y={-wallThicknessPx - 1}
              width={widthPx + 2 * wallThicknessPx + 2}
              height={lengthPx + 2 * wallThicknessPx + 2}
              stroke="#0284c7"
              strokeWidth={2}
              dash={[6, 4]}
              listening={false}
              perfectDrawEnabled={false}
            />
          ))}

        {/* Nombre y Dimensiones Interiores */}
        <Text
          text={`${cubiertaMeta?.emoji || '🏠'} ${room.name}`}
          x={10}
          y={12}
          fontSize={11.5}
          fontStyle="bold"
          fontFamily="Outfit, Roboto, sans-serif"
          fill="#0f172a"
          width={Math.max(10, widthPx - 20)}
          align="center"
          listening={false}
        />
        <Text
          text={`${widthText} × ${lengthText}m • ${realArea}m² • ${cubiertaMeta?.shortLabel || 'Cubierto'}`}
          x={10}
          y={27}
          fontSize={8.5}
          fontFamily="Outfit, Roboto, sans-serif"
          fill={isDescubierto ? '#16a34a' : isSemicubierto ? '#d97706' : !isWLocked || !isLLocked ? '#0284c7' : '#64748b'}
          width={Math.max(10, widthPx - 20)}
          align="center"
          listening={false}
        />

        {/* Renderizado de Bocas Eléctricas */}
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

          return (
            <Group key={asset.id} x={posX} y={posY} listening={false}>
              <Rect
                x={-7}
                y={-7}
                width={14}
                height={14}
                fill="#ffffff"
                stroke="#d97706"
                strokeWidth={1.5}
                cornerRadius={3}
                perfectDrawEnabled={false}
              />
              <Text
                text={meta.code}
                x={-6}
                y={-5}
                fontSize={8}
                fontStyle="bold"
                fontFamily="Outfit, Roboto, sans-serif"
                fill="#b45309"
                width={12}
                align="center"
                perfectDrawEnabled={false}
              />
            </Group>
          );
        })}
      </Group>
    </Group>
  );
});
