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
 * Resuelve las coordenadas (x, y) en metros de los vértices del ambiente,
 * incorporando opcionalmente paredes con quiebres en Z, nichos de placard y columnas.
 * Orden de vértices: Recorrido horario iniciando en NW.
 */
export function calculateRoomPolygon(room: Room): Point2D[] {
  // Si el ambiente ya cuenta con vértices calculados (fusión booleana en L o geometría poligonal libre)
  if (room.geometry?.computedVertices && room.geometry.computedVertices.length >= 3) {
    return room.geometry.computedVertices;
  }

  const width = room.dimensions.width || 3.0;
  const length = room.dimensions.length || 2.5;

  const geom = room.geometry;
  const breaks = geom?.wallBreaks || [];

  const LN = geom?.independentWalls?.north || width;
  const LS = geom?.independentWalls?.south || width;
  const LE = geom?.independentWalls?.east || length;
  const LO = geom?.independentWalls?.west || length;

  // Si no hay quiebres ni falsa escuadra, caso ortogonal estándar de 4 vértices
  if (breaks.length === 0 && (!geom || geom.mode === 'rectangle' || !geom.independentWalls)) {
    return [
      { x: 0, y: 0 },         // V0: NW
      { x: width, y: 0 },     // V1: NE
      { x: width, y: length }, // V2: SE
      { x: 0, y: length }     // V3: SW
    ];
  }

  // Helper para subdividir un segmento con sus quiebres
  const northBreaks = breaks.filter((b) => b.wall === 'north').sort((a, b) => a.startOffsetMeters - b.startOffsetMeters);
  const eastBreaks = breaks.filter((b) => b.wall === 'east').sort((a, b) => a.startOffsetMeters - b.startOffsetMeters);

  const poly: Point2D[] = [];

  // 1. Pared Norte (V0 a V1, horizontal de X=0 a X=LN en Y=0)
  poly.push({ x: 0, y: 0 });
  for (const b of northBreaks) {
    const s = Math.max(0, Math.min(LN, b.startOffsetMeters));
    const e = Math.max(s, Math.min(LN, s + b.widthMeters));
    const d = b.depthMeters; // + hacia afuera (-Y), - hacia adentro (+Y)
    poly.push({ x: s, y: 0 });
    poly.push({ x: s, y: -d });
    poly.push({ x: e, y: -d });
    poly.push({ x: e, y: 0 });
  }
  poly.push({ x: LN, y: 0 });

  // 2. Pared Este (V1 a V2, vertical de Y=0 a Y=LE en X=LN)
  for (const b of eastBreaks) {
    const s = Math.max(0, Math.min(LE, b.startOffsetMeters));
    const e = Math.max(s, Math.min(LE, s + b.widthMeters));
    const d = b.depthMeters; // + hacia afuera (+X), - hacia adentro (-X)
    poly.push({ x: LN, y: s });
    poly.push({ x: LN + d, y: s });
    poly.push({ x: LN + d, y: e });
    poly.push({ x: LN, y: e });
  }
  poly.push({ x: LN, y: LE });

  // 3. Pared Sur (V2 a V3, horizontal de X=LS a X=0 en Y=LE/LO)
  // Como caminamos de Este (X=LS) hacia Oeste (X=0), procesamos los quiebres de mayor a menor X
  const southBreaksDesc = [...breaks.filter((b) => b.wall === 'south')].sort(
    (a, b) => b.startOffsetMeters - a.startOffsetMeters
  );
  for (const b of southBreaksDesc) {
    const s = Math.max(0, Math.min(LS, b.startOffsetMeters));
    const e = Math.max(s, Math.min(LS, s + b.widthMeters));
    const d = b.depthMeters; // + hacia afuera (+Y), - hacia adentro (-Y)
    poly.push({ x: e, y: LE });
    poly.push({ x: e, y: LE + d });
    poly.push({ x: s, y: LE + d });
    poly.push({ x: s, y: LE });
  }
  poly.push({ x: 0, y: LO });

  // 4. Pared Oeste (V3 a V0, vertical de Y=LO a Y=0 en X=0)
  // Como caminamos de Sur (Y=LO) hacia Norte (Y=0), procesamos los quiebres de mayor a menor Y
  const westBreaksDesc = [...breaks.filter((b) => b.wall === 'west')].sort(
    (a, b) => b.startOffsetMeters - a.startOffsetMeters
  );
  for (const b of westBreaksDesc) {
    const s = Math.max(0, Math.min(LO, b.startOffsetMeters));
    const e = Math.max(s, Math.min(LO, s + b.widthMeters));
    const d = b.depthMeters; // + hacia afuera (-X), - hacia adentro (+X)
    poly.push({ x: 0, y: e });
    poly.push({ x: -d, y: e });
    poly.push({ x: -d, y: s });
    poly.push({ x: 0, y: s });
  }

  // Filtrar vértices duplicados o colineales redundantes consecutivos
  const cleaned: Point2D[] = [];
  for (let i = 0; i < poly.length; i++) {
    const pt = poly[i];
    const prev = cleaned[cleaned.length - 1];
    if (!prev || Math.hypot(pt.x - prev.x, pt.y - prev.y) > 0.005) {
      cleaned.push({
        x: Number(pt.x.toFixed(3)),
        y: Number(pt.y.toFixed(3))
      });
    }
  }

  return cleaned;
}
