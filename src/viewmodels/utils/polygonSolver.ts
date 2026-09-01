/**
 * ViewModel Utility: Polygon & Triangulation Solver
 * Resuelve la geometría paramétrica de ambientes no-ortogonales (falsas escuadras,
 * longitudes de muros independientes, diagonales de triangulación y cálculo de ángulos).
 */

import { Room, WallOrientation } from '@/models/RoomModel';

export interface Point2D {
  x: number;
  y: number;
}

export interface CornerAngles {
  NW: number; // Ángulo en esquina Noroeste (grados)
  NE: number; // Ángulo en esquina Noreste (grados)
  SE: number; // Ángulo en esquina Sureste (grados)
  SW: number; // Ángulo en esquina Suroeste (grados)
}

/**
 * Calcula la diagonal teórica ortogonal (Pitágoras)
 */
export function calculateTheoreticalDiagonal(width: number, length: number): number {
  return Number(Math.sqrt(width ** 2 + length ** 2).toFixed(2));
}

/**
 * Retorna la longitud en metros de una pared específica de un ambiente
 */
export function getWallActualLength(room: Room, wall: WallOrientation): number {
  if (wall === 'ceiling') {
    return calculateTheoreticalDiagonal(room.dimensions.width, room.dimensions.length);
  }

  const geom = room.geometry;
  if (geom?.independentWalls) {
    if (wall === 'north') return geom.independentWalls.north || room.dimensions.width;
    if (wall === 'south') return geom.independentWalls.south || room.dimensions.width;
    if (wall === 'east') return geom.independentWalls.east || room.dimensions.length;
    if (wall === 'west') return geom.independentWalls.west || room.dimensions.length;
  }

  if (wall === 'north' || wall === 'south') return room.dimensions.width;
  return room.dimensions.length;
}

/**
 * Calcula el área de un polígono 2D mediante la fórmula de Gauss (Shoelace)
 */
export function calculatePolygonArea(vertices: Point2D[]): number {
  if (vertices.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }

  return Number((Math.abs(area) / 2).toFixed(2));
}

/**
 * Calcula el ángulo interior entre 3 puntos consecutivos (B es el vértice)
 */
function angleBetween3Points(A: Point2D, B: Point2D, C: Point2D): number {
  const v1 = { x: A.x - B.x, y: A.y - B.y };
  const v2 = { x: C.x - B.x, y: C.y - B.y };

  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2);
  const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2);

  if (mag1 === 0 || mag2 === 0) return 90;

  const cosTheta = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Number((Math.acos(cosTheta) * (180 / Math.PI)).toFixed(1));
}

/**
 * Calcula los 4 ángulos interiores de las esquinas del ambiente
 */
export function calculateCornerAngles(vertices: Point2D[]): CornerAngles {
  if (vertices.length < 4) {
    return { NW: 90, NE: 90, SE: 90, SW: 90 };
  }

  const [V0, V1, V2, V3] = vertices; // NW, NE, SE, SW

  return {
    NW: angleBetween3Points(V3, V0, V1),
    NE: angleBetween3Points(V0, V1, V2),
    SE: angleBetween3Points(V1, V2, V3),
    SW: angleBetween3Points(V2, V3, V0)
  };
}

/**
 * Resuelve las coordenadas (x, y) en metros de los 4 vértices del ambiente
 * Orden de vértices: [V0 (NW), V1 (NE), V2 (SE), V3 (SW)]
 */
export function calculateRoomPolygon(room: Room): Point2D[] {
  const width = room.dimensions.width || 3.0;
  const length = room.dimensions.length || 2.5;

  const geom = room.geometry;
  const isOrthogonal = !geom || geom.mode === 'rectangle' || !geom.independentWalls;

  // 1. Caso Rectangular Ortogonal Puro
  if (isOrthogonal) {
    return [
      { x: 0, y: 0 },         // V0: NW
      { x: width, y: 0 },     // V1: NE
      { x: width, y: length }, // V2: SE
      { x: 0, y: length }     // V3: SW
    ];
  }

  // 2. Caso con 4 Paredes Independientes + Triangulación / Constraints
  const LN = geom.independentWalls?.north || width;
  const LS = geom.independentWalls?.south || width;
  const LE = geom.independentWalls?.east || length;
  const LO = geom.independentWalls?.west || length;

  const theoreticalDiag = calculateTheoreticalDiagonal(LS, LO);
  const D = geom.diagonalSO_NE && geom.diagonalSO_NE > 0 ? geom.diagonalSO_NE : theoreticalDiag;

  // Verificar si hay restricciones fijas de 90° en las esquinas
  const locks = geom.cornerConstraints || {};

  // Caso: Esquina NW y SW fijadas a 90° (Paredes Norte y Sur horizontales, Oeste vertical)
  if (locks.northWestLocked90 && locks.southWestLocked90) {
    return [
      { x: 0, y: 0 },     // V0: NW
      { x: LN, y: 0 },    // V1: NE
      { x: LS, y: LO },   // V2: SE
      { x: 0, y: LO }     // V3: SW
    ];
  }

  // Triangulación completa por Ley de Cosenos:
  // Vértice V0 (NW) en origen (0, 0)
  // Vértice V1 (NE) en (LN, 0) a lo largo del eje X
  const V0: Point2D = { x: 0, y: 0 };
  const V1: Point2D = { x: LN, y: 0 };

  // En triángulo V0-V1-V3 (lados LN, D, LO):
  // Coseno del ángulo en V0 (NW)
  const cosV0 = Math.max(-1, Math.min(1, (LN ** 2 + LO ** 2 - D ** 2) / (2 * LN * LO)));
  const angleV0 = Math.acos(cosV0);

  // V3 (SW) respecto a V0 (NW)
  const V3: Point2D = {
    x: LO * Math.cos(angleV0 - Math.PI / 2),
    y: LO * Math.sin(angleV0 - Math.PI / 2)
  };

  // En triángulo V1-V3-V2 (lados D, LS, LE):
  // Coseno del ángulo en V1 (NE) respecto a la diagonal D
  const cosV1Diag = Math.max(-1, Math.min(1, (D ** 2 + LE ** 2 - LS ** 2) / (2 * D * LE)));
  const angleV1Diag = Math.acos(cosV1Diag);

  // Vector unitario de la diagonal D de V1 a V3
  const diagVec = { x: V3.x - V1.x, y: V3.y - V1.y };
  const diagAngle = Math.atan2(diagVec.y, diagVec.x);

  // V2 (SE) respecto a V1 (NE)
  const angleV2 = diagAngle + angleV1Diag;
  const V2: Point2D = {
    x: V1.x + LE * Math.cos(angleV2),
    y: V1.y + LE * Math.sin(angleV2)
  };

  // Normalizar coordenadas para que el punto más a la izquierda y arriba sea (0, 0)
  const minX = Math.min(V0.x, V1.x, V2.x, V3.x);
  const minY = Math.min(V0.y, V1.y, V2.y, V3.y);

  return [
    { x: Number((V0.x - minX).toFixed(3)), y: Number((V0.y - minY).toFixed(3)) },
    { x: Number((V1.x - minX).toFixed(3)), y: Number((V1.y - minY).toFixed(3)) },
    { x: Number((V2.x - minX).toFixed(3)), y: Number((V2.y - minY).toFixed(3)) },
    { x: Number((V3.x - minX).toFixed(3)), y: Number((V3.y - minY).toFixed(3)) }
  ];
}
