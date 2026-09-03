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
import { Room, TIPO_CUBIERTA_CATALOG, isMetricRoom } from '@/models/RoomModel';
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
}

export const RoomAssemblyShape = memo<RoomAssemblyShapeProps>(({
  room,
  allRooms,
  isSelected,
  wallThicknessPx,
  openings,
  onSelect,
  onDragMove,
  onDragEnd
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
  const hasBreaks = (room.geometry?.wallBreaks || []).length > 0;

  const isWLocked = room.dimensions.widthLocked ?? true;
  const isLLocked = room.dimensions.lengthLocked ?? true;
  const widthText = isWLocked ? `${room.dimensions.width}` : `~${room.dimensions.width}`;
  const lengthText = isLLocked ? `${room.dimensions.length}` : `~${room.dimensions.length}`;

  const renderWallWithOpenings = (
    wallInfo: WallPlanimetryInfo,
    roomWidthPx: number,
    roomLengthPx: number
  ) => {
    const { wall, isShared, isVirtualBoundary, wallThicknessMeters, intervals } = wallInfo;
    const isVirtual = isVirtualBoundary || Boolean(
      wallInfo.connection?.isVirtualBoundary ||
      wallInfo.connection?.wallProperties?.isVirtualBoundary ||
      wallInfo.connection?.type === 'limite_virtual'
    );

    if (isVirtual) {
      // 🚪 LÍMITE VIRTUAL (Concepto Abierto / Espacio Integrado sin Muro Físico):
      // No dibuja tabique constructivo sólido (#1e293b).
      // Dibuja una línea de trazos sutil (CAD dash) que delimita funcionalmente ambos recintos.
      let points: number[] = [];
      if (wall === 'north') points = [0, 0, roomWidthPx, 0];
      else if (wall === 'south') points = [0, roomLengthPx, roomWidthPx, roomLengthPx];
      else if (wall === 'west') points = [0, 0, 0, roomLengthPx];
      else if (wall === 'east') points = [roomWidthPx, 0, roomWidthPx, roomLengthPx];

      return (
        <Group key={`wall-virtual-${wall}`}>
          <Line
            points={points}
            stroke="#0284c7"
            strokeWidth={1.5}
            dash={[6, 4]}
            opacity={0.8}
            listening={false}
            perfectDrawEnabled={false}
          />
        </Group>
      );
    }

    const wallThickness = wallThicknessMeters * PIXELS_PER_METER;
    const wallLengthPx = wall === 'north' || wall === 'south' ? roomWidthPx : roomLengthPx;
    const isHoriz = wall === 'north' || wall === 'south';

    // 1. Si esta pared específica tiene un quiebre geométrico arquitectónico manual
    const wallBreak = (room.geometry?.wallBreaks || []).find(
      (b) => b.wall === wall && !b.id.startsWith('wb-invaded-')
    );
    if (wallBreak) {
      const s = wallBreak.startOffsetMeters * PIXELS_PER_METER;
      const w = wallBreak.widthMeters * PIXELS_PER_METER;
      const dPx = Math.abs(wallBreak.depthMeters) * PIXELS_PER_METER;
      const segments: React.ReactNode[] = [];

      if (wall === 'west') {
        if (s > 2) {
          segments.push(
            <Rect
              key={`wb-${wall}-pre`}
              x={-wallThickness}
              y={0}
              width={wallThickness}
              height={s}
              fill="#1e293b"
              listening={false}
            />
          );
        }
        if (s > 2) {
          segments.push(
            <Rect
              key={`wb-${wall}-step1`}
              x={-wallThickness}
              y={s}
              width={dPx + wallThickness}
              height={wallThickness}
              fill="#1e293b"
              listening={false}
            />
          );
        }
        segments.push(
          <Rect
            key={`wb-${wall}-back`}
            x={dPx - wallThickness}
            y={s}
            width={wallThickness}
            height={w}
            fill="#1e293b"
            listening={false}
          />
        );
        if (roomLengthPx - (s + w) > 2) {
          segments.push(
            <Rect
              key={`wb-${wall}-step2`}
              x={-wallThickness}
              y={s + w - wallThickness}
              width={dPx + wallThickness}
              height={wallThickness}
              fill="#1e293b"
              listening={false}
            />
          );
        }
        if (roomLengthPx - (s + w) > 2) {
          segments.push(
            <Rect
              key={`wb-${wall}-post`}
              x={-wallThickness}
              y={s + w}
              width={wallThickness}
              height={roomLengthPx - (s + w)}
              fill="#1e293b"
              listening={false}
            />
          );
        }
      } else if (wall === 'east') {
        if (s > 2) {
          segments.push(
            <Rect
              key={`wb-${wall}-pre`}
              x={roomWidthPx}
              y={0}
              width={wallThickness}
              height={s}
              fill="#1e293b"
              listening={false}
            />
          );
        }
        if (s > 2) {
          segments.push(
            <Rect
              key={`wb-${wall}-step1`}
              x={roomWidthPx - dPx}
              y={s}
              width={dPx + wallThickness}
              height={wallThickness}
              fill="#1e293b"
              listening={false}
            />
          );
        }
        segments.push(
          <Rect
            key={`wb-${wall}-back`}
            x={roomWidthPx - dPx}
            y={s}
            width={wallThickness}
            height={w}
            fill="#1e293b"
            listening={false}
          />
        );
        if (roomLengthPx - (s + w) > 2) {
          segments.push(
            <Rect
              key={`wb-${wall}-step2`}
              x={roomWidthPx - dPx}
              y={s + w - wallThickness}
              width={dPx + wallThickness}
              height={wallThickness}
              fill="#1e293b"
              listening={false}
            />
          );
        }
        if (roomLengthPx - (s + w) > 2) {
          segments.push(
            <Rect
              key={`wb-${wall}-post`}
              x={roomWidthPx}
              y={s + w}
              width={wallThickness}
              height={roomLengthPx - (s + w)}
              fill="#1e293b"
              listening={false}
            />
          );
        }
      } else if (wall === 'north') {
        if (s > 2) {
          segments.push(
            <Rect
              key={`wb-${wall}-pre`}
              x={0}
              y={-wallThickness}
              width={s}
              height={wallThickness}
              fill="#1e293b"
              listening={false}
            />
          );
        }
        if (s > 2) {
          segments.push(
            <Rect
              key={`wb-${wall}-step1`}
              x={s}
              y={-wallThickness}
              width={wallThickness}
              height={dPx + wallThickness}
              fill="#1e293b"
              listening={false}
            />
          );
        }
        segments.push(
          <Rect
            key={`wb-${wall}-back`}
            x={s}
            y={dPx - wallThickness}
            width={w}
            height={wallThickness}
            fill="#1e293b"
            listening={false}
          />
        );
        if (roomWidthPx - (s + w) > 2) {
          segments.push(
            <Rect
              key={`wb-${wall}-step2`}
              x={s + w - wallThickness}
              y={-wallThickness}
              width={wallThickness}
              height={dPx + wallThickness}
              fill="#1e293b"
              listening={false}
            />
          );
        }
        if (roomWidthPx - (s + w) > 2) {
          segments.push(
            <Rect
              key={`wb-${wall}-post`}
              x={s + w}
              y={-wallThickness}
              width={roomWidthPx - (s + w)}
              height={wallThickness}
              fill="#1e293b"
              listening={false}
            />
          );
        }
      } else if (wall === 'south') {
        if (s > 2) {
          segments.push(
            <Rect
              key={`wb-${wall}-pre`}
              x={0}
              y={roomLengthPx}
              width={s}
              height={wallThickness}
              fill="#1e293b"
              listening={false}
            />
          );
        }
        if (s > 2) {
          segments.push(
            <Rect
              key={`wb-${wall}-step1`}
              x={s}
              y={roomLengthPx - dPx}
              width={wallThickness}
              height={dPx + wallThickness}
              fill="#1e293b"
              listening={false}
            />
          );
        }
        segments.push(
          <Rect
            key={`wb-${wall}-back`}
            x={s}
            y={roomLengthPx - dPx}
            width={w}
            height={wallThickness}
            fill="#1e293b"
            listening={false}
          />
        );
        if (roomWidthPx - (s + w) > 2) {
          segments.push(
            <Rect
              key={`wb-${wall}-step2`}
              x={s + w - wallThickness}
              y={roomLengthPx - dPx}
              width={wallThickness}
              height={dPx + wallThickness}
              fill="#1e293b"
              listening={false}
            />
          );
        }
        if (roomWidthPx - (s + w) > 2) {
          segments.push(
            <Rect
              key={`wb-${wall}-post`}
              x={s + w}
              y={roomLengthPx}
              width={roomWidthPx - (s + w)}
              height={wallThickness}
              fill="#1e293b"
              listening={false}
            />
          );
        }
      }

      return <Group key={`wall-stepped-${wall}`}>{segments}</Group>;
    }

    // 2. Si la pared no tiene aberturas (pared ciega sólida)
    if (intervals.length === 0) {
      let survivingSegments: Array<{ start: number; end: number }> = [
        { start: 0, end: wallLengthPx }
      ];

      if (wallInfo.cutIntervals && wallInfo.cutIntervals.length > 0) {
        for (const cut of wallInfo.cutIntervals) {
          const next: Array<{ start: number; end: number }> = [];
          for (const seg of survivingSegments) {
            if (cut.endPx <= seg.start || cut.startPx >= seg.end) {
              next.push(seg);
            } else {
              if (cut.startPx > seg.start + 2) {
                next.push({ start: seg.start, end: cut.startPx });
              }
              if (cut.endPx < seg.end - 2) {
                next.push({ start: cut.endPx, end: seg.end });
              }
            }
          }
          survivingSegments = next;
        }
      }

      if (survivingSegments.length === 0) return null;

      return (
        <Group key={`wall-solid-${wall}`}>
          {survivingSegments.map((seg, idx) => {
            let x = 0;
            let y = 0;
            let w = 0;
            let h = 0;

            const isStartCorner = seg.start === 0;
            const isEndCorner = Math.abs(seg.end - wallLengthPx) <= 2;

            if (wall === 'north') {
              x = isStartCorner ? -wallThickness : seg.start;
              y = -wallThickness;
              w = (seg.end - seg.start) + (isStartCorner ? wallThickness : 0) + (isEndCorner ? wallThickness : 0);
              h = wallThickness;
            } else if (wall === 'south') {
              x = isStartCorner ? -wallThickness : seg.start;
              y = roomLengthPx;
              w = (seg.end - seg.start) + (isStartCorner ? wallThickness : 0) + (isEndCorner ? wallThickness : 0);
              h = wallThickness;
            } else if (wall === 'west') {
              x = -wallThickness;
              y = isStartCorner ? -wallThickness : seg.start;
              w = wallThickness;
              h = (seg.end - seg.start) + (isStartCorner ? wallThickness : 0) + (isEndCorner ? wallThickness : 0);
            } else if (wall === 'east') {
              x = roomWidthPx;
              y = isStartCorner ? -wallThickness : seg.start;
              w = wallThickness;
              h = (seg.end - seg.start) + (isStartCorner ? wallThickness : 0) + (isEndCorner ? wallThickness : 0);
            }

            if (w <= 0 || h <= 0) return null;

            return (
              <Rect
                key={`wall-solid-${wall}-${idx}`}
                x={x}
                y={y}
                width={w}
                height={h}
                fill="#1e293b"
                opacity={isShared ? 0.92 : 1}
                cornerRadius={0.5}
                listening={false}
                perfectDrawEnabled={false}
              />
            );
          })}
        </Group>
      );
    }

    // 2. Muro con Aberturas (1 o Múltiples: Puertas, Ventanas, Pasa-platos)
    const elements: React.ReactNode[] = [];
    let currentPos = 0;

    intervals.forEach((interval, idx) => {
      // Tramo de pared sólido antes de esta abertura (mocheta)
      if (!hasBreaks && interval.startPx - currentPos > 2) {
        const segLen = interval.startPx - currentPos;
        if (isHoriz) {
          const yPos = wall === 'north' ? -wallThickness : roomLengthPx;
          const xPos = currentPos === 0 ? -wallThickness : currentPos;
          const segWidth = currentPos === 0 ? segLen + wallThickness : segLen;

          elements.push(
            <Rect
              key={`wall-seg-${wall}-${idx}-pre`}
              x={xPos}
              y={yPos}
              width={segWidth}
              height={wallThickness}
              fill="#1e293b"
              listening={false}
              perfectDrawEnabled={false}
            />
          );
        } else {
          const xPos = wall === 'west' ? -wallThickness : roomWidthPx;
          const yPos = currentPos === 0 ? -wallThickness : currentPos;
          const segHeight = currentPos === 0 ? segLen + wallThickness : segLen;

          elements.push(
            <Rect
              key={`wall-seg-${wall}-${idx}-pre`}
              x={xPos}
              y={yPos}
              width={wallThickness}
              height={segHeight}
              fill="#1e293b"
              listening={false}
              perfectDrawEnabled={false}
            />
          );
        }
      }

      // Si este ambiente es el responsable, dibuja el símbolo CAD (puerta, ventana, vano)
      if (interval.shouldDrawSymbol) {
        let openingGroupY = 0;
        if (wall === 'south') openingGroupY = roomLengthPx;
        if (wall === 'east') openingGroupY = 0;

        elements.push(
          <Group key={`opening-${interval.opening.id || idx}`} y={openingGroupY} listening={false}>
            <ArchitecturalOpeningShape
              wall={wall}
              opening={interval.opening}
              wallLengthPx={wallLengthPx}
              wallThicknessPx={wallThickness}
              offsetRatio={interval.offsetRatio}
            />
          </Group>
        );
      }

      currentPos = Math.max(currentPos, interval.endPx);
    });

    // Tramo de pared sólido final después de la última abertura (mocheta final)
    if (!hasBreaks && wallLengthPx - currentPos > 2) {
      const segLen = wallLengthPx - currentPos;
      if (isHoriz) {
        const yPos = wall === 'north' ? -wallThickness : roomLengthPx;
        elements.push(
          <Rect
            key={`wall-seg-${wall}-post`}
            x={currentPos}
            y={yPos}
            width={segLen + wallThickness}
            height={wallThickness}
            fill="#1e293b"
            listening={false}
            perfectDrawEnabled={false}
          />
        );
      } else {
        const xPos = wall === 'west' ? -wallThickness : roomWidthPx;
        elements.push(
          <Rect
            key={`wall-seg-${wall}-post`}
            x={xPos}
            y={currentPos}
            width={wallThickness}
            height={segLen + wallThickness}
            fill="#1e293b"
            listening={false}
            perfectDrawEnabled={false}
          />
        );
      }
    }

    return elements;
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
        {renderWallWithOpenings(planimetry.north, widthPx, lengthPx)}
        {renderWallWithOpenings(planimetry.south, widthPx, lengthPx)}
        {renderWallWithOpenings(planimetry.west, widthPx, lengthPx)}
        {renderWallWithOpenings(planimetry.east, widthPx, lengthPx)}

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
