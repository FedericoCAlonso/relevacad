/**
 * View Component: RoomAssemblyShape (Konva 2D Architectural Room Node)
 * Implementa Bitmap Caching nativo (group.cache()) por ambiente con:
 * - Deduplicación estricta de aberturas arquitectónicas (puertas, vanos, ventanas no se repiten).
 * - Muros compartidos unificados (evita doble espesor de pared en encuentros).
 * - Identificación y dibujo de mochetas e intersecciones de encuentro T / L.
 */

import React, { memo, useRef, useEffect } from 'react';
import { Group, Rect, Text, Line } from 'react-konva';
import Konva from 'konva';
import { Room, TIPO_CUBIERTA_CATALOG } from '@/models/RoomModel';
import { LogicalConnection } from '@/models/GraphModel';
import { ELECTRICAL_ASSET_CATALOG } from '@/models/ElectricalTypes';
import { metersToPixels, PIXELS_PER_METER } from '@/viewmodels/utils/geometryUtils';
import {
  calculatePolygonArea,
  calculateRoomPolygon
} from '@/viewmodels/utils/polygonSolver';
import { calculateRoomPlanimetry } from '@/viewmodels/utils/unifiedFloorPlanSolver';
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
  const innerRef = useRef<Konva.Group>(null);
  const isNonMetric = room.isAccessPoint || room.isTechnicalIsland;

  // 🚀 BITMAP CACHING: Congela la geometría vectorial del bloque en memoria GPU
  useEffect(() => {
    if (innerRef.current) {
      innerRef.current.clearCache();
      try {
        innerRef.current.cache({
          pixelRatio: Math.min(window.devicePixelRatio || 1, 2)
        });
      } catch (err) {
        // Ignorar si el nodo está temporalmente desmontado o con dimensiones 0
      }
    }
  }, [
    room.dimensions,
    room.geometry,
    room.color,
    room.name,
    room.tipoCubierta,
    room.electricalAssets,
    isSelected,
    openings,
    wallThicknessPx,
    isNonMetric,
    allRooms
  ]);

  // Los accesos e islas técnicas (nubes) no se dibujan en la vista de ensamble arquitectónico
  if (isNonMetric) {
    return null;
  }

  // 🏠 2. RECINTO ARQUITECTÓNICO CONSTRUCTIVO
  const widthPx = metersToPixels(room.dimensions?.width || 3);
  const lengthPx = metersToPixels(room.dimensions?.length || 2.5);
  const verticesMeters = calculateRoomPolygon(room);
  const realArea = calculatePolygonArea(verticesMeters);

  // Deduplicación y cálculo de muros e interfaces
  const {
    northOpenings,
    southOpenings,
    eastOpenings,
    westOpenings,
    sharedWalls
  } = calculateRoomPlanimetry(room, allRooms, openings);

  const polyPointsPx = verticesMeters.flatMap((v) => [metersToPixels(v.x), metersToPixels(v.y)]);
  const hasBreaks = (room.geometry?.wallBreaks || []).length > 0;

  const isWLocked = room.dimensions.widthLocked ?? true;
  const isLLocked = room.dimensions.lengthLocked ?? true;
  const widthText = isWLocked ? `${room.dimensions.width}` : `~${room.dimensions.width}`;
  const lengthText = isLLocked ? `${room.dimensions.length}` : `~${room.dimensions.length}`;

  const renderWallWithOpenings = (
    wall: 'north' | 'south' | 'east' | 'west',
    roomWidthPx: number,
    roomLengthPx: number,
    wallOpenings: LogicalConnection[],
    isSharedWall: boolean
  ) => {
    const wallLengthPx = wall === 'north' || wall === 'south' ? roomWidthPx : roomLengthPx;
    const isHoriz = wall === 'north' || wall === 'south';

    // Si la pared es compartida pero no tiene aberturas en este ambiente:
    // se renderiza con espesor estándar unificado
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
          opacity={isSharedWall ? 0.92 : 1}
          cornerRadius={0.5}
          listening={false}
          perfectDrawEnabled={false}
        />
      );
    }

    // Muro con Abertura -> Hueco en el Muro + Símbolo CAD Único (No duplicado)
    const elements: React.ReactNode[] = [];
    const opening = wallOpenings[0];
    const openingWidthPx = Math.min(
      wallLengthPx * 0.9,
      (opening.opening?.widthMeters || 0.8) * PIXELS_PER_METER
    );
    const centerPos = wallLengthPx / 2;
    const startOpening = Math.max(0, centerPos - openingWidthPx / 2);
    const endOpening = Math.min(wallLengthPx, centerPos + openingWidthPx / 2);

    // Segmento 1 de muro (mocheta inicial)
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
            listening={false}
            perfectDrawEnabled={false}
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
            listening={false}
            perfectDrawEnabled={false}
          />
        );
      }
    }

    // Segmento 2 de muro (mocheta final)
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
            listening={false}
            perfectDrawEnabled={false}
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
            listening={false}
            perfectDrawEnabled={false}
          />
        );
      }
    }

    // Renderizar la Abertura Arquitectónica (única instancia CAD)
    if (opening.opening) {
      let openingGroupY = 0;
      if (wall === 'south') openingGroupY = roomLengthPx;
      if (wall === 'east') openingGroupY = 0;

      elements.push(
        <Group key={`opening-${opening.id}`} y={openingGroupY} listening={false}>
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

  const cubiertaMeta = TIPO_CUBIERTA_CATALOG[room.tipoCubierta || 'cubierto'];
  const isDescubierto = room.tipoCubierta === 'descubierto';
  const isSemicubierto = room.tipoCubierta === 'semicubierto';

  return (
    <Group
      id={room.id}
      x={room.canvasPosition.x}
      y={room.canvasPosition.y}
      draggable
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
        onDragEnd(room.id, e.target);
      }}
    >
      <Group ref={innerRef}>
        {/* Superficie / Suelo Interior */}
        {hasBreaks ? (
          <Line
            points={polyPointsPx}
            closed
            fill={isDescubierto ? '#f0fdf4' : isSemicubierto ? '#fffdfa' : (room.color || '#f8fafc')}
            opacity={isSelected ? 0.95 : 0.85}
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
            opacity={isSelected ? 0.95 : 0.85}
            shadowColor={isSelected ? '#00629e' : '#000000'}
            shadowBlur={isSelected ? 16 : 4}
            shadowOpacity={isSelected ? 0.35 : 0.08}
            perfectDrawEnabled={false}
          />
        )}

        {/* 🧱 Muros Perimetrales con Deduplicación */}
        {renderWallWithOpenings('north', widthPx, lengthPx, northOpenings, sharedWalls.north)}
        {renderWallWithOpenings('south', widthPx, lengthPx, southOpenings, sharedWalls.south)}
        {renderWallWithOpenings('west', widthPx, lengthPx, westOpenings, sharedWalls.west)}
        {renderWallWithOpenings('east', widthPx, lengthPx, eastOpenings, sharedWalls.east)}

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
            listening={false}
            perfectDrawEnabled={false}
          />
        )}

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
