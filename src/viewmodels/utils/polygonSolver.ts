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
 * Discretiza un segmento de arco definido por sus dos extremos (cuerda P1-P2)
 * y su flecha de curvatura (sagitta h en metros).
 * @param P1 Extremo inicial
 * @param P2 Extremo final
 * @param sagitta Flecha perpendicular en metros (+ hacia afuera del perímetro horario)
 * @param numSteps Cantidad de subdivisiones (por defecto 8)
 */
export function discretizeArcSegment(
  P1: Point2D,
  P2: Point2D,
  sagitta: number,
  numSteps: number = 8
): Point2D[] {
  if (Math.abs(sagitta) < 0.001) {
    return [P1, P2];
  }

  const dx = P2.x - P1.x;
  const dy = P2.y - P1.y;
  const chordLen = Math.hypot(dx, dy);
  if (chordLen < 0.001) return [P1];

  const midX = (P1.x + P2.x) / 2;
  const midY = (P1.y + P2.y) / 2;

  // Tangente unitaria de P1 hacia P2
  const ux = dx / chordLen;
  const uy = dy / chordLen;

  // Vector normal exterior (a la derecha en sentido horario estándar de canvas: (uy, -ux))
  const nx = uy;
  const ny = -ux;

  // Radio geométrico del arco R a partir de cuerda C y flecha h: R = (h/2) + (C^2 / 8h)
  const absH = Math.abs(sagitta);
  const R = absH / 2 + (chordLen ** 2) / (8 * absH);

  // Distancia del centro de la cuerda al centro del círculo
  const d = R - absH;
  // Si sagitta > 0, la flecha va hacia +nx (afuera), el centro del círculo está en -nx (adentro)
  const sign = sagitta > 0 ? 1 : -1;
  const centerX = midX - sign * d * nx;
  const centerY = midY - sign * d * ny;

  // Ángulos inicial y final respecto al centro
  const startAngle = Math.atan2(P1.y - centerY, P1.x - centerX);
  const endAngle = Math.atan2(P2.y - centerY, P2.x - centerX);

  // Barrido angular
  let sweep = endAngle - startAngle;
  if (sign > 0 && sweep < 0) sweep += 2 * Math.PI;
  if (sign < 0 && sweep > 0) sweep -= 2 * Math.PI;

  if (Math.abs(sweep) > Math.PI && absH <= chordLen / 2) {
    sweep = sweep > 0 ? sweep - 2 * Math.PI : sweep + 2 * Math.PI;
  }

  const points: Point2D[] = [];
  for (let i = 0; i <= numSteps; i++) {
    const t = i / numSteps;
    const angle = startAngle + t * sweep;
    points.push({
      x: Number((centerX + R * Math.cos(angle)).toFixed(3)),
      y: Number((centerY + R * Math.sin(angle)).toFixed(3))
    });
  }

  return points;
}

/**
 * Calcula el área exacta del segmento circular formado por una cuerda C y flecha h
 * Área = 0.5 * R^2 * (theta - sin(theta))
 */
export function calculateCircularSegmentArea(chordLength: number, sagitta: number): number {
  const absH = Math.abs(sagitta);
  if (absH < 0.001 || chordLength < 0.001) return 0;

  const R = absH / 2 + (chordLength ** 2) / (8 * absH);
  const theta = 2 * Math.asin(Math.min(1, chordLength / (2 * R)));
  const area = 0.5 * (R ** 2) * (theta - Math.sin(theta));
  return Number(area.toFixed(2));
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
  // Si el ambiente ya cuenta con vértices calculados por fusión booleana en L
  if (room.geometry?.mode === 'polygon' && room.geometry?.computedVertices && room.geometry.computedVertices.length >= 3) {
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

  const arcWalls = geom?.arcWalls || [];

  // Si no hay quiebres, muros curvos ni falsa escuadra, caso ortogonal estándar de 4 vértices
  if (breaks.length === 0 && arcWalls.length === 0 && (!geom || geom.mode === 'rectangle' || !geom.independentWalls)) {
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

  const northArc = arcWalls.find((a) => a.wall === 'north');
  const eastArc = arcWalls.find((a) => a.wall === 'east');
  const southArc = arcWalls.find((a) => a.wall === 'south');
  const westArc = arcWalls.find((a) => a.wall === 'west');

  const poly: Point2D[] = [];

  // 1. Pared Norte (V0 a V1, horizontal de X=0 a X=LN en Y=0)
  if (northArc && Math.abs(northArc.sagittaMeters) > 0.001) {
    poly.push(...discretizeArcSegment({ x: 0, y: 0 }, { x: LN, y: 0 }, northArc.sagittaMeters));
  } else {
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
  }

  // 2. Pared Este (V1 a V2, vertical de Y=0 a Y=LE en X=LN)
  if (eastArc && Math.abs(eastArc.sagittaMeters) > 0.001) {
    poly.push(...discretizeArcSegment({ x: LN, y: 0 }, { x: LN, y: LE }, eastArc.sagittaMeters).slice(1));
  } else {
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
  }

  // 3. Pared Sur (V2 a V3, horizontal de X=LS a X=0 en Y=LE/LO)
  if (southArc && Math.abs(southArc.sagittaMeters) > 0.001) {
    poly.push(...discretizeArcSegment({ x: LS, y: LE }, { x: 0, y: LO }, southArc.sagittaMeters).slice(1));
  } else {
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
  }

  // 4. Pared Oeste (V3 a V0, vertical de Y=LO a Y=0 en X=0)
  if (westArc && Math.abs(westArc.sagittaMeters) > 0.001) {
    poly.push(...discretizeArcSegment({ x: 0, y: LO }, { x: 0, y: 0 }, westArc.sagittaMeters).slice(1, -1));
  } else {
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
