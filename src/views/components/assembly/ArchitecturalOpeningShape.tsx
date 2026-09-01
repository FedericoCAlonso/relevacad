/**
 * View Component: ArchitecturalOpeningShape (Konva 2D CAD Opening)
 * Renderiza aberturas arquitectónicas según convención de dibujo técnico:
 * - Puertas con hoja batiente y arco de barrido a 90°
 * - Ventanas y Puertas-Ventanas con marcos y hojas de vidrio paralelas
 * - Vanos libres con dintel y mochetas
 */

import React from 'react';
import { Group, Line, Arc, Rect, Text, Circle } from 'react-konva';
import { WallOrientation } from '@/models/RoomModel';
import { OpeningProperties } from '@/models/GraphModel';

interface ArchitecturalOpeningShapeProps {
  wall: WallOrientation;
  opening: OpeningProperties;
  wallLengthPx: number;
  wallThicknessPx: number;
  offsetRatio?: number;
}

export const ArchitecturalOpeningShape: React.FC<ArchitecturalOpeningShapeProps> = ({
  wall,
  opening,
  wallLengthPx,
  wallThicknessPx,
  offsetRatio = 0.5
}) => {
  const openingWidthPx = Math.min(wallLengthPx * 0.9, (opening.widthMeters || 0.8) * 50);
  const centerPos = Math.max(
    openingWidthPx / 2,
    Math.min(wallLengthPx - openingWidthPx / 2, offsetRatio * wallLengthPx)
  );
  const startPos = centerPos - openingWidthPx / 2;

  const isDoor =
    opening.openingType === 'puerta_estandar' ||
    opening.openingType === 'puerta_seguridad' ||
    opening.openingType === 'puerta_doble' ||
    opening.openingType === 'door';
  const isWindow =
    opening.openingType === 'ventana_estandar' ||
    opening.openingType === 'puerta_ventana' ||
    opening.openingType === 'puerta_corrediza';
  const isVano =
    opening.openingType === 'vano_libre' ||
    opening.openingType === 'pass_through' ||
    opening.openingType === 'open_space' ||
    opening.openingType === 'porton_garage';

  const isSecurityDoor = opening.openingType === 'puerta_seguridad';
  const doorColor = isSecurityDoor ? '#dc2626' : '#4f46e5';
  const windowColor = '#0284c7';
  const vanoColor = '#94a3b8';

  // Coordenadas locales según orientación de la pared
  let groupX = 0;
  let groupY = 0;
  let rotation = 0;

  switch (wall) {
    case 'north':
      groupX = startPos;
      groupY = 0;
      rotation = 0;
      break;
    case 'south':
      groupX = startPos;
      groupY = 0;
      rotation = 0;
      break;
    case 'west':
      groupX = 0;
      groupY = startPos;
      rotation = 90;
      break;
    case 'east':
      groupX = 0;
      groupY = startPos;
      rotation = 90;
      break;
  }

  const swingInward = wall === 'north' || wall === 'west';

  return (
    <Group x={groupX} y={groupY} rotation={rotation}>
      {/* 1. Mochetas / Marcos de tope de muro */}
      <Rect
        x={0}
        y={-wallThicknessPx / 2}
        width={3}
        height={wallThicknessPx}
        fill="#0f172a"
      />
      <Rect
        x={openingWidthPx - 3}
        y={-wallThicknessPx / 2}
        width={3}
        height={wallThicknessPx}
        fill="#0f172a"
      />

      {/* 2. PUERTA BATIENTE (Hoja + Arco de Barrido CAD) */}
      {isDoor && (
        <Group>
          {/* Arco de barrido de 90 grados */}
          <Arc
            x={0}
            y={0}
            innerRadius={0}
            outerRadius={openingWidthPx}
            angle={90}
            rotation={swingInward ? 0 : 180}
            stroke={doorColor}
            strokeWidth={1}
            dash={[3, 3]}
            opacity={0.5}
          />

          {/* Hoja de puerta abierta */}
          <Line
            points={[0, 0, 0, swingInward ? openingWidthPx : -openingWidthPx]}
            stroke={doorColor}
            strokeWidth={2.5}
            lineCap="round"
          />

          {/* Picaporte / Manija */}
          <Circle
            x={0}
            y={swingInward ? openingWidthPx - 8 : -openingWidthPx + 8}
            radius={2}
            fill="#f59e0b"
          />
        </Group>
      )}

      {/* 3. VENTANA O PUERTA-VENTANA (Marco + 2 Hojas Corredizas) */}
      {isWindow && (
        <Group>
          {/* Muro bajo / Antepecho */}
          <Line
            points={[0, -wallThicknessPx / 2, openingWidthPx, -wallThicknessPx / 2]}
            stroke="#64748b"
            strokeWidth={1.5}
          />
          <Line
            points={[0, wallThicknessPx / 2, openingWidthPx, wallThicknessPx / 2]}
            stroke="#64748b"
            strokeWidth={1.5}
          />

          {/* Hojas de Vidrio Corredizas Paralelas */}
          <Line
            points={[2, -2, openingWidthPx / 2 + 3, -2]}
            stroke={windowColor}
            strokeWidth={2}
          />
          <Line
            points={[openingWidthPx / 2 - 3, 2, openingWidthPx - 2, 2]}
            stroke={windowColor}
            strokeWidth={2}
          />
        </Group>
      )}

      {/* 4. VANO LIBRE / PASO */}
      {isVano && (
        <Group>
          <Line
            points={[0, 0, openingWidthPx, 0]}
            stroke={vanoColor}
            strokeWidth={1}
            dash={[4, 4]}
          />
        </Group>
      )}

      {/* Cota técnica del paso */}
      <Text
        text={`${opening.widthMeters}m`}
        x={openingWidthPx / 2 - 12}
        y={isDoor ? (swingInward ? 5 : -14) : -11}
        fontSize={8}
        fontFamily="Roboto, sans-serif"
        fontStyle="bold"
        fill={isDoor ? doorColor : isWindow ? windowColor : vanoColor}
        align="center"
      />
    </Group>
  );
};
