/**
 * View Component: RoomAssemblyShape (Konva 2D Architectural Room Node)
 * Implementa Bitmap Caching nativo (group.cache()) por ambiente con:
 * - Colocalización exacta de aberturas en ambos ambientes que comparten el muro.
 * - Deduplicación estricta de símbolos CAD (se dibuja una sola vez sin duplicar arcos).
 * - Muros compartidos unificados con espesor individual por tabique (10cm, 15cm, 20cm, 30cm, 7cm).
 * - Soporte para 0 (pared ciega), 1 o múltiples aberturas en la misma pared (ej. puerta + pasa-platos).
 * - Mochetas sólidas calculadas dinámicamente sin solapamiento con vanos.
 */

import React, { memo, useRef, useEffect } from 'react';
import { Group, Rect, Text, Line } from 'react-konva';
import Konva from 'konva';
import { Room, TIPO_CUBIERTA_CATALOG, WallOrientation, isMetricRoom } from '@/models/RoomModel';
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
  onOpenParametrization?: (roomId: string) => void;
  onWallClick?: (roomId: string, wall: WallOrientation) => void;
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
  onOpenParametrization,
  onWallClick,
  onDragMove,
  onDragEnd
}) => {
  const innerRef = useRef<Konva.Group>(null);
  const isNonMetric = !isMetricRoom(room);

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

  // 🧱 ZONAS NO RELEVADAS / LÍMITES Y ACCESOS (Áreas Sombreadas / Referencias Perimetrales)
  if (isNonMetric) {
    const isPalier = room.isAccessPoint || room.type === 'access_palier';
    const isPatio = room.type === 'limit_patio';
    const isBoundary = room.isParcelBoundary || room.type.startsWith('limit_');
    const isTechnical = room.isTechnicalIsland || room.type.startsWith('technical_island');

    const wPx = metersToPixels(room.dimensions?.width > 0 ? room.dimensions.width : (isBoundary ? 1.0 : 2.5));
    const hPx = metersToPixels(room.dimensions?.length > 0 ? room.dimensions.length : (isBoundary ? 4.0 : 2.5));

    const bgColor = isPalier ? '#ecfdf5' : isPatio ? '#f0fdf4' : isTechnical ? '#fffbeb' : '#f8fafc';
    const strokeColor = isPalier ? '#059669' : isPatio ? '#0ea5e9' : isTechnical ? '#d97706' : '#64748b';
    const label = isPalier
      ? `🏢 ${room.name.toUpperCase()}`
      : isPatio
      ? `☀️ ${room.name.toUpperCase()}`
      : isTechnical
      ? `⚡ ${room.name.toUpperCase()}`
      : `🧱 ${room.name.toUpperCase()}`;

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
        <Rect
          x={0}
          y={0}
          width={wPx}
          height={hPx}
          fill={bgColor}
          opacity={0.8}
          stroke={isSelected ? '#0284c7' : strokeColor}
          strokeWidth={isSelected ? 2.5 : 1.5}
          dash={isBoundary ? [14, 4, 3, 4] : [8, 4]}
          cornerRadius={4}
        />
        <Text
          text={label}
          x={6}
          y={hPx / 2 - 14}
          fontSize={10}
          fontStyle="bold"
          fontFamily="Outfit, Roboto, sans-serif"
          fill={strokeColor}
          width={Math.max(10, wPx - 12)}
          align="center"
          listening={false}
        />
        <Text
          text="Zona No Relevada (Referencia)"
          x={6}
          y={hPx / 2 + 2}
          fontSize={8}
          fontFamily="Outfit, Roboto, sans-serif"
          fill="#94a3b8"
          width={Math.max(10, wPx - 12)}
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
    const { wall, isShared, wallThicknessMeters, intervals } = wallInfo;
    const wallThickness = wallThicknessMeters * PIXELS_PER_METER;
    const wallLengthPx = wall === 'north' || wall === 'south' ? roomWidthPx : roomLengthPx;
    const isHoriz = wall === 'north' || wall === 'south';

    // 1. Si la pared no tiene aberturas (pared ciega o compartida sólida sin vanos)
    if (intervals.length === 0) {
      let x = 0;
      let y = 0;
      let w = roomWidthPx;
      let h = wallThickness;

      if (wall === 'north') {
        x = -wallThickness;
        y = -wallThickness;
        w = roomWidthPx + 2 * wallThickness;
        h = wallThickness;
      } else if (wall === 'south') {
        x = -wallThickness;
        y = roomLengthPx;
        w = roomWidthPx + 2 * wallThickness;
        h = wallThickness;
      } else if (wall === 'west') {
        x = -wallThickness;
        y = 0;
        w = wallThickness;
        h = roomLengthPx;
      } else if (wall === 'east') {
        x = roomWidthPx;
        y = 0;
        w = wallThickness;
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
          opacity={isShared ? 0.92 : 1}
          cornerRadius={0.5}
          listening={false}
          perfectDrawEnabled={false}
        />
      );
    }

    // 2. Muro con Aberturas (1 o Múltiples: Puertas, Ventanas, Pasa-platos)
    const elements: React.ReactNode[] = [];
    let currentPos = 0;

    intervals.forEach((interval, idx) => {
      // Tramo de pared sólido antes de esta abertura (mocheta)
      if (interval.startPx - currentPos > 2) {
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
    if (wallLengthPx - currentPos > 2) {
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
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect(room.id);
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect(room.id);
      }}
      onDblClick={(e) => {
        e.cancelBubble = true;
        onSelect(room.id);
        onOpenParametrization?.(room.id);
      }}
      onDblTap={(e) => {
        e.cancelBubble = true;
        onSelect(room.id);
        onOpenParametrization?.(room.id);
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

        {/* 🧱 Muros Perimetrales con Espesores Individuales y Multi-Aberturas Colocalizadas */}
        {renderWallWithOpenings(planimetry.north, widthPx, lengthPx)}
        {renderWallWithOpenings(planimetry.south, widthPx, lengthPx)}
        {renderWallWithOpenings(planimetry.west, widthPx, lengthPx)}
        {renderWallWithOpenings(planimetry.east, widthPx, lengthPx)}

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

      {/* 🧱 Zonas de clic interactivo en las 4 paredes (para tocar la pared y editar o agregar aberturas) */}
      {/* Pared Norte */}
      <Rect
        x={0}
        y={-wallThicknessPx - 6}
        width={widthPx}
        height={wallThicknessPx + 12}
        fill="transparent"
        stroke={isSelected ? 'rgba(2, 132, 199, 0.5)' : 'transparent'}
        strokeWidth={2}
        dash={[4, 2]}
        onClick={(e) => {
          e.cancelBubble = true;
          onSelect(room.id);
          onWallClick?.(room.id, 'north');
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          onSelect(room.id);
          onWallClick?.(room.id, 'north');
        }}
      />
      {/* Pared Sur */}
      <Rect
        x={0}
        y={lengthPx - 6}
        width={widthPx}
        height={wallThicknessPx + 12}
        fill="transparent"
        stroke={isSelected ? 'rgba(2, 132, 199, 0.5)' : 'transparent'}
        strokeWidth={2}
        dash={[4, 2]}
        onClick={(e) => {
          e.cancelBubble = true;
          onSelect(room.id);
          onWallClick?.(room.id, 'south');
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          onSelect(room.id);
          onWallClick?.(room.id, 'south');
        }}
      />
      {/* Pared Oeste */}
      <Rect
        x={-wallThicknessPx - 6}
        y={0}
        width={wallThicknessPx + 12}
        height={lengthPx}
        fill="transparent"
        stroke={isSelected ? 'rgba(2, 132, 199, 0.5)' : 'transparent'}
        strokeWidth={2}
        dash={[4, 2]}
        onClick={(e) => {
          e.cancelBubble = true;
          onSelect(room.id);
          onWallClick?.(room.id, 'west');
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          onSelect(room.id);
          onWallClick?.(room.id, 'west');
        }}
      />
      {/* Pared Este */}
      <Rect
        x={widthPx - 6}
        y={0}
        width={wallThicknessPx + 12}
        height={lengthPx}
        fill="transparent"
        stroke={isSelected ? 'rgba(2, 132, 199, 0.5)' : 'transparent'}
        strokeWidth={2}
        dash={[4, 2]}
        onClick={(e) => {
          e.cancelBubble = true;
          onSelect(room.id);
          onWallClick?.(room.id, 'east');
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          onSelect(room.id);
          onWallClick?.(room.id, 'east');
        }}
      />
    </Group>
  );
});
