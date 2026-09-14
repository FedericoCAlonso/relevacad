/**
 * ViewModel Utility: Wall Anchor & Snapping Calculator
 * Resuelve el anclaje paramétrico a muros (proyección ortogonal, distancias métricas,
 * ángulo normal de rotación y caras interior/exterior) o anclaje libre espacial a losa/piso.
 *
 * Sigue estrictamente el patrón MVVM sin valores hardcodeados en las vistas.
 */

import { WallOrientation } from '@/models/RoomModel';
import { ElementoElectrico, ModoAnclaje, LadoMuro } from '@/models/ElectricalModel';
import { Abertura } from '@/models/OpeningModel';

export interface CalculatedWallAnchor {
  modo: ModoAnclaje;
  wall?: WallOrientation;
  distanciaMeters?: number;
  lado?: LadoMuro;
  anguloRotacion: number;
  localCoords: {
    xMeters: number;
    yMeters: number;
  };
}

export interface RoomDimensionsLike {
  width: number;
  length: number;
}

/** Tolerancia de captura a muro por defecto en metros (35 cm reales) */
export const DEFAULT_WALL_SNAP_TOLERANCE_METERS = 0.35;

/**
 * Retorna la pared opuesta / acoplada en un tabique compartido.
 */
export function getOppositeWall(wall: WallOrientation): WallOrientation {
  switch (wall) {
    case 'north':
      return 'south';
    case 'south':
      return 'north';
    case 'east':
      return 'west';
    case 'west':
      return 'east';
    default:
      return wall;
  }
}

/**
 * Calcula el ángulo normal de rotación (en grados) para un símbolo montado en pared,
 * de modo que apunte perpendicularmente hacia el interior (o exterior) de la habitación.
 */
export function getWallSymbolRotation(wall: WallOrientation, lado: LadoMuro = 'interior'): number {
  let baseAng = 0;

  switch (wall) {
    case 'south':
      // Pared Sur (inferior, y = length): el interior está hacia arriba (-Y) -> 0°
      baseAng = 0;
      break;
    case 'north':
      // Pared Norte (superior, y = 0): el interior está hacia abajo (+Y) -> 180°
      baseAng = 180;
      break;
    case 'west':
      // Pared Oeste (izquierda, x = 0): el interior está hacia la derecha (+X) -> 90°
      baseAng = 90;
      break;
    case 'east':
      // Pared Este (derecha, x = width): el interior está hacia la izquierda (-X) -> 270°
      baseAng = 270;
      break;
    default:
      baseAng = 0;
  }

  if (lado === 'exterior') {
    baseAng = (baseAng + 180) % 360;
  }

  return baseAng;
}

/**
 * Dado un punto de toque (x, y) en metros locales del ambiente,
 * determina si se imanta al muro más cercano o queda libre en el techo/piso.
 */
export function calculateWallAnchor(
  localPoint: { xMeters: number; yMeters: number },
  dimensions: RoomDimensionsLike,
  snapToleranceMeters: number = DEFAULT_WALL_SNAP_TOLERANCE_METERS,
  preferenciaModo?: ModoAnclaje
): CalculatedWallAnchor {
  const { width, length } = dimensions;

  // Si el usuario forzó expresamente techo o piso, se preserva libre
  if (preferenciaModo === 'techo' || preferenciaModo === 'piso') {
    return {
      modo: preferenciaModo,
      anguloRotacion: 0,
      localCoords: {
        xMeters: Math.max(0.1, Math.min(width - 0.1, Number(localPoint.xMeters.toFixed(2)))),
        yMeters: Math.max(0.1, Math.min(length - 0.1, Number(localPoint.yMeters.toFixed(2))))
      }
    };
  }

  const rawX = localPoint.xMeters;
  const rawY = localPoint.yMeters;

  // Clampeo a límites
  const cx = Math.max(0, Math.min(width, rawX));
  const cy = Math.max(0, Math.min(length, rawY));

  // Distancias ortogonales a los 4 muros
  const distNorth = Math.abs(rawY - 0);
  const distSouth = Math.abs(rawY - length);
  const distWest = Math.abs(rawX - 0);
  const distEast = Math.abs(rawX - width);

  const minDist = Math.min(distNorth, distSouth, distWest, distEast);

  // ¿Snap a muro activo?
  if (minDist <= snapToleranceMeters || preferenciaModo === 'pared') {
    let wall: WallOrientation = 'south';
    let distanciaMeters = 0;
    let localX = cx;
    let localY = cy;
    let lado: LadoMuro = 'interior';

    if (minDist === distNorth) {
      wall = 'north';
      distanciaMeters = Number(cx.toFixed(2));
      localX = cx;
      localY = 0;
      if (rawY < -0.02) lado = 'exterior';
    } else if (minDist === distSouth) {
      wall = 'south';
      distanciaMeters = Number(cx.toFixed(2));
      localX = cx;
      localY = length;
      if (rawY > length + 0.02) lado = 'exterior';
    } else if (minDist === distWest) {
      wall = 'west';
      distanciaMeters = Number(cy.toFixed(2));
      localX = 0;
      localY = cy;
      if (rawX < -0.02) lado = 'exterior';
    } else {
      wall = 'east';
      distanciaMeters = Number(cy.toFixed(2));
      localX = width;
      localY = cy;
      if (rawX > width + 0.02) lado = 'exterior';
    }

    const anguloRotacion = getWallSymbolRotation(wall, lado);

    return {
      modo: 'pared',
      wall,
      distanciaMeters,
      lado,
      anguloRotacion,
      localCoords: {
        xMeters: Number(localX.toFixed(2)),
        yMeters: Number(localY.toFixed(2))
      }
    };
  }

  // De lo contrario, queda anclado en techo (centro)
  return {
    modo: 'techo',
    anguloRotacion: 0,
    localCoords: {
      xMeters: Number(cx.toFixed(2)),
      yMeters: Number(cy.toFixed(2))
    }
  };
}

/**
 * Calcula las coordenadas 2D locales y el ángulo de rotación de un ElementoElectrico existente.
 */
export function getElementLocalPlacement(
  el: ElementoElectrico,
  dimensions: RoomDimensionsLike
): { xMeters: number; yMeters: number; anguloRotacion: number } {
  const { width, length } = dimensions;

  if (el.anclaje.modo === 'pared' && el.anclaje.pared) {
    const { wall, distanciaMeters, lado } = el.anclaje.pared;
    const anguloRotacion = getWallSymbolRotation(wall, lado);

    let x = 0;
    let y = 0;

    switch (wall) {
      case 'north':
        x = Math.max(0, Math.min(width, distanciaMeters));
        y = 0;
        break;
      case 'south':
        x = Math.max(0, Math.min(width, distanciaMeters));
        y = length;
        break;
      case 'west':
        x = 0;
        y = Math.max(0, Math.min(length, distanciaMeters));
        break;
      case 'east':
        x = width;
        y = Math.max(0, Math.min(length, distanciaMeters));
        break;
      default:
        x = width / 2;
        y = length / 2;
    }

    return { xMeters: x, yMeters: y, anguloRotacion };
  }

  // Techo o piso con coordenadas espaciales
  if (el.anclaje.espacial) {
    return {
      xMeters: el.anclaje.espacial.xMeters,
      yMeters: el.anclaje.espacial.yMeters,
      anguloRotacion: 0
    };
  }

  // Fallback seguro al centro del recinto
  return {
    xMeters: width / 2,
    yMeters: length / 2,
    anguloRotacion: 0
  };
}

/**
 * Restringe la posición métrica de una abertura para garantizar que quede
 * contenida dentro de la pared sin invadir las esquinas.
 */
export function calculateOpeningPlacement(
  wall: WallOrientation,
  clickOffsetMeters: number,
  openingWidth: number,
  dimensions: RoomDimensionsLike
): number {
  const wallLength = wall === 'north' || wall === 'south' ? dimensions.width : dimensions.length;
  const maxPos = Math.max(0, wallLength - openingWidth);
  return Math.max(0, Math.min(maxPos, Number(clickOffsetMeters.toFixed(2))));
}

/**
 * Proyecta la posición de una abertura a la pared contigua de un ambiente vecino acoplado.
 */
export function projectOpeningToNeighbor(
  opening: Abertura,
  _sourceDimensions: RoomDimensionsLike,
  targetDimensions: RoomDimensionsLike,
  offsetAlignmentMeters: number = 0
): { targetWall: WallOrientation; targetPosicionMeters: number } {
  const targetWall = getOppositeWall(opening.wall);
  const isHoriz = opening.wall === 'north' || opening.wall === 'south';
  const targetWallLength = isHoriz ? targetDimensions.width : targetDimensions.length;

  // En tabiques acoplados, la cota métrica se alinea según el desplazamiento relativo
  const targetPos = Math.max(
    0,
    Math.min(targetWallLength - opening.anchoMeters, opening.posicionMeters + offsetAlignmentMeters)
  );

  return {
    targetWall,
    targetPosicionMeters: Number(targetPos.toFixed(2))
  };
}
