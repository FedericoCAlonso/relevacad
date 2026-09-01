/**
 * ViewModel Utility: Geometry and Coordinate Transformations
 */

import { WallOrientation, RoomDimensions } from '@/models/RoomModel';

export const PIXELS_PER_METER = 50; // Factor de escala: 1 metro = 50 píxeles

/**
 * Convierte dimensiones en metros a dimensiones en píxeles de canvas
 */
export function metersToPixels(meters: number): number {
  return meters * PIXELS_PER_METER;
}

/**
 * Convierte píxeles de canvas a metros
 */
export function pixelsToMeters(pixels: number): number {
  return Number((pixels / PIXELS_PER_METER).toFixed(2));
}

export interface WallSegment {
  wall: WallOrientation;
  length: number; // en metros
  startX: number; // en píxeles relativos al origen del ambiente
  startY: number;
  endX: number;
  endY: number;
}

/**
 * Retorna las 4 paredes y sus segmentos geométricos para un ambiente rectangular
 */
export function getRoomWalls(dimensions: RoomDimensions): Record<WallOrientation, WallSegment> {
  const widthPx = metersToPixels(dimensions.width);
  const lengthPx = metersToPixels(dimensions.length);

  return {
    north: {
      wall: 'north',
      length: dimensions.width,
      startX: 0,
      startY: 0,
      endX: widthPx,
      endY: 0
    },
    south: {
      wall: 'south',
      length: dimensions.width,
      startX: 0,
      startY: lengthPx,
      endX: widthPx,
      endY: lengthPx
    },
    west: {
      wall: 'west',
      length: dimensions.length,
      startX: 0,
      startY: 0,
      endX: 0,
      endY: lengthPx
    },
    east: {
      wall: 'east',
      length: dimensions.length,
      startX: widthPx,
      startY: 0,
      endX: widthPx,
      endY: lengthPx
    },
    ceiling: {
      wall: 'ceiling',
      length: Math.sqrt(dimensions.width ** 2 + dimensions.length ** 2),
      startX: widthPx / 2,
      startY: lengthPx / 2,
      endX: widthPx / 2,
      endY: lengthPx / 2
    }
  };
}

/**
 * Calcula la posición en coordenadas de canvas locales (px) de un elemento eléctrico relativo a la pared
 */
export function calculateAssetLocalPosition(
  wall: WallOrientation,
  offsetRatio: number,
  dimensions: RoomDimensions
): { x: number; y: number; angleDeg: number } {
  const widthPx = metersToPixels(dimensions.width);
  const lengthPx = metersToPixels(dimensions.length);

  // Asegurar ratio entre 0.0 y 1.0
  const clampedRatio = Math.max(0, Math.min(1, offsetRatio));

  switch (wall) {
    case 'north':
      return {
        x: clampedRatio * widthPx,
        y: 0,
        angleDeg: 0
      };
    case 'south':
      return {
        x: clampedRatio * widthPx,
        y: lengthPx,
        angleDeg: 180
      };
    case 'west':
      return {
        x: 0,
        y: clampedRatio * lengthPx,
        angleDeg: 270
      };
    case 'east':
      return {
        x: widthPx,
        y: clampedRatio * lengthPx,
        angleDeg: 90
      };
    case 'ceiling':
    default:
      return {
        x: widthPx / 2,
        y: lengthPx / 2,
        angleDeg: 0
      };
  }
}
