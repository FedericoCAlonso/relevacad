/**
 * View Component: ElectricalSymbolShape (Konva 2D Electrical Symbol Node)
 * Renderiza un ElementoElectrico en el plano con:
 * - Gráfico vectorial SVG real normalizado según symbols.json (AEA / IEC).
 * - Rotación normal automática perpendicular al muro o centrada en techo.
 * - Halo de selección y estado interactivo.
 * - Texto de referencia siempre horizontal (anti-rotación para legibilidad).
 * - Soporte de arrastre táctil/mouse imantándose a los muros en tiempo real.
 */

import React, { memo, useState, useEffect, useMemo } from 'react';
import { Group, Image as KonvaImage, Circle, Text, Rect } from 'react-konva';
import { ElementoElectrico, AnclajeElemento } from '@/models/ElectricalModel';
import { Room } from '@/models/RoomModel';
import { getSymbolById } from '@/models/ElectricalSymbolsModel';
import {
  getElementLocalPlacement,
  calculateWallAnchor
} from '@/viewmodels/utils/wallAnchorCalculator';
import { metersToPixels, PIXELS_PER_METER } from '@/viewmodels/utils/geometryUtils';
import { getSymbolImage, onSvgSymbolLoaded } from './svgSymbolKonvaRenderer';

export interface ElectricalSymbolShapeProps {
  elemento: ElementoElectrico;
  room: Room;
  isSelected: boolean;
  isRoutingSource?: boolean;
  circuitColor?: string;
  onSelect: (id: string) => void;
  onAnchorChange?: (id: string, newAnchor: AnclajeElemento) => void;
  onClick?: (id: string) => void;
}

export const ElectricalSymbolShape: React.FC<ElectricalSymbolShapeProps> = memo(({
  elemento,
  room,
  isSelected,
  isRoutingSource = false,
  circuitColor = '#0284c7',
  onSelect,
  onAnchorChange,
  onClick
}) => {
  const [, setRerenderTrigger] = useState(0);

  // Escuchar cuando el SVG termine de rasterizarse en la imagen en memoria
  useEffect(() => {
    return onSvgSymbolLoaded(() => setRerenderTrigger((n) => n + 1));
  }, []);

  const simboloDef = useMemo(() => getSymbolById(elemento.simboloId), [elemento.simboloId]);

  // Posición y rotación normal calculadas por el solver (sin hardcodes)
  const placement = useMemo(
    () => getElementLocalPlacement(elemento, room.dimensions),
    [elemento, room.dimensions]
  );

  const localXPx = metersToPixels(placement.xMeters);
  const localYPx = metersToPixels(placement.yMeters);
  const stageX = room.canvasPosition.x + localXPx;
  const stageY = room.canvasPosition.y + localYPx;

  // Tamaño del símbolo en píxeles (escalado por escalaBase de catálogo)
  const baseSizePx = 36;
  const symbolSizePx = baseSizePx * (simboloDef?.escalaBase || 1);

  // Rasterización SVG con color del circuito
  const symbolImage = useMemo(
    () => (simboloDef ? getSymbolImage(simboloDef, circuitColor, symbolSizePx) : null),
    [simboloDef, circuitColor, symbolSizePx]
  );

  const labelText = elemento.efectos
    ? `${elemento.referencia} [${elemento.efectos}]`
    : elemento.referencia;

  const handleDragMove = (e: any) => {
    if (!onAnchorChange) return;

    // Coordenadas relativas al contenedor del ambiente
    const pointerStageX = e.target.x();
    const pointerStageY = e.target.y();

    const localMetersX = (pointerStageX - room.canvasPosition.x) / PIXELS_PER_METER;
    const localMetersY = (pointerStageY - room.canvasPosition.y) / PIXELS_PER_METER;

    // Imantación geométrica a muros o losa
    const newCalculated = calculateWallAnchor(
      { xMeters: localMetersX, yMeters: localMetersY },
      room.dimensions,
      0.40 // 40 cm de snap al arrastrar
    );

    const newAnchor: AnclajeElemento = {
      modo: newCalculated.modo,
      pared:
        newCalculated.modo === 'pared' && newCalculated.wall
          ? {
              wall: newCalculated.wall,
              distanciaMeters: newCalculated.distanciaMeters || 0,
              lado: newCalculated.lado || 'interior'
            }
          : undefined,
      espacial:
        newCalculated.modo !== 'pared'
          ? {
              xMeters: newCalculated.localCoords.xMeters,
              yMeters: newCalculated.localCoords.yMeters
            }
          : undefined
    };

    onAnchorChange(elemento.id, newAnchor);
  };

  return (
    <Group
      id={`symbol-node-${elemento.id}`}
      x={stageX}
      y={stageY}
      rotation={placement.anguloRotacion}
      draggable
      onDragMove={handleDragMove}
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect(elemento.id);
        onClick?.(elemento.id);
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect(elemento.id);
        onClick?.(elemento.id);
      }}
    >
      {/* 🌟 Halo de Selección o Fuente de Trazado de Cañería */}
      {(isSelected || isRoutingSource) && (
        <Circle
          radius={symbolSizePx * 0.65}
          fill={isRoutingSource ? 'rgba(2, 132, 199, 0.25)' : 'rgba(245, 158, 11, 0.25)'}
          stroke={isRoutingSource ? '#0284c7' : '#f59e0b'}
          strokeWidth={2}
          dash={[4, 3]}
        />
      )}

      {/* 🖼️ Símbolo Vectorial SVG Real */}
      {symbolImage ? (
        <KonvaImage
          image={symbolImage}
          x={-symbolSizePx / 2}
          y={-symbolSizePx / 2}
          width={symbolSizePx}
          height={symbolSizePx}
          perfectDrawEnabled={false}
        />
      ) : (
        // Fallback mientras se rasteriza el SVG
        <Circle
          radius={symbolSizePx * 0.4}
          fill="#ffffff"
          stroke={circuitColor}
          strokeWidth={2}
        />
      )}

      {/* 🏷️ Rótulo de Referencia y Efectos (Contrarrotado para mantenerse siempre horizontal y legible) */}
      {elemento.mostrarDato !== false && (
        <Group rotation={-placement.anguloRotacion} y={symbolSizePx * 0.5 + 8} listening={false}>
          <Rect
            x={-24}
            y={-7}
            width={48}
            height={14}
            fill="#ffffff"
            stroke="#cbd5e1"
            strokeWidth={1}
            cornerRadius={4}
            shadowColor="rgba(0,0,0,0.06)"
            shadowBlur={3}
          />
          <Text
            text={labelText}
            x={-24}
            y={-5}
            width={48}
            fontSize={8.5}
            fontStyle="bold"
            fontFamily="Outfit, Roboto, sans-serif"
            fill="#1e293b"
            align="center"
          />
        </Group>
      )}
    </Group>
  );
});
