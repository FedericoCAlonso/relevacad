/**
 * ViewModel Utility: Boolean Room Union (Fusión Booleana de Ambientes)
 * Combina dos ambientes rectangulares contiguos o solapados en un único
 * ambiente continuo poligonal (en 'L', 'T' o rectangular ampliado).
 */

import { Room } from '@/models/RoomModel';
import { PIXELS_PER_METER } from './geometryUtils';
import { Point2D } from './polygonSolver';

export interface RectangleMeters {
  x: number;
  y: number;
  width: number;
  length: number;
}

export interface BooleanUnionResult {
  minX: number;
  minY: number;
  boundingBoxWidth: number;
  boundingBoxLength: number;
  areaMeters2: number;
  verticesMeters: Point2D[];
}

/**
 * Calcula la unión booleana (A ∪ B) de dos rectángulos ortogonales en metros.
 * Retorna el polígono perimetral continuo en coordenadas locales y su área exacta.
 */
export function unionOfTwoRectangles(
  rectA: RectangleMeters,
  rectB: RectangleMeters
): BooleanUnionResult | null {
  const A = { ...rectA };
  const B = { ...rectB };

  // Snap de tolerancia (15cm) para absorber pequeñas imperfecciones de arrastre táctil
  if (Math.abs(A.x + A.width - B.x) < 0.15) B.x = A.x + A.width;
  else if (Math.abs(B.x + B.width - A.x) < 0.15) A.x = B.x + B.width;

  if (Math.abs(A.y + A.length - B.y) < 0.15) B.y = A.y + A.length;
  else if (Math.abs(B.y + B.length - A.y) < 0.15) A.y = B.y + B.length;

  if (Math.abs(A.x - B.x) < 0.15) B.x = A.x;
  if (Math.abs(A.y - B.y) < 0.15) B.y = A.y;
  if (Math.abs(A.x + A.width - (B.x + B.width)) < 0.15) B.width = A.x + A.width - B.x;
  if (Math.abs(A.y + A.length - (B.y + B.length)) < 0.15) B.length = A.y + A.length - B.y;

  // 1. Extraer coordenadas X e Y ordenadas y únicas
  const rawXs = [A.x, A.x + A.width, B.x, B.x + B.width].sort((a, b) => a - b);
  const xs: number[] = [];
  for (const x of rawXs) {
    if (xs.length === 0 || Math.abs(x - xs[xs.length - 1]) > 0.02) {
      xs.push(Number(x.toFixed(3)));
    }
  }

  const rawYs = [A.y, A.y + A.length, B.y, B.y + B.length].sort((a, b) => a - b);
  const ys: number[] = [];
  for (const y of rawYs) {
    if (ys.length === 0 || Math.abs(y - ys[ys.length - 1]) > 0.02) {
      ys.push(Number(y.toFixed(3)));
    }
  }

  if (xs.length < 2 || ys.length < 2) return null;

  const numX = xs.length - 1;
  const numY = ys.length - 1;

  // 2. Grilla booleana de celdas
  const grid: boolean[][] = Array.from({ length: numX }, () => Array(numY).fill(false));
  let totalArea = 0;

  for (let i = 0; i < numX; i++) {
    for (let j = 0; j < numY; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      const cy = (ys[j] + ys[j + 1]) / 2;

      const inA =
        cx >= A.x - 0.01 &&
        cx <= A.x + A.width + 0.01 &&
        cy >= A.y - 0.01 &&
        cy <= A.y + A.length + 0.01;
      const inB =
        cx >= B.x - 0.01 &&
        cx <= B.x + B.width + 0.01 &&
        cy >= B.y - 0.01 &&
        cy <= B.y + B.length + 0.01;

      if (inA || inB) {
        grid[i][j] = true;
        totalArea += (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]);
      }
    }
  }

  if (totalArea <= 0.1) return null;

  // 3. Extraer aristas de contorno dirigidas (recorrido horario: el interior queda a la derecha)
  interface DirectedEdge {
    start: Point2D;
    end: Point2D;
  }
  const edges: DirectedEdge[] = [];

  for (let i = 0; i < numX; i++) {
    for (let j = 0; j < numY; j++) {
      if (!grid[i][j]) continue;

      // Arista Superior (Y = ys[j]): hacia la derecha (+X)
      if (j === 0 || !grid[i][j - 1]) {
        edges.push({
          start: { x: xs[i], y: ys[j] },
          end: { x: xs[i + 1], y: ys[j] }
        });
      }

      // Arista Derecha (X = xs[i+1]): hacia abajo (+Y)
      if (i === numX - 1 || !grid[i + 1][j]) {
        edges.push({
          start: { x: xs[i + 1], y: ys[j] },
          end: { x: xs[i + 1], y: ys[j + 1] }
        });
      }

      // Arista Inferior (Y = ys[j+1]): hacia la izquierda (-X)
      if (j === numY - 1 || !grid[i][j + 1]) {
        edges.push({
          start: { x: xs[i + 1], y: ys[j + 1] },
          end: { x: xs[i], y: ys[j + 1] }
        });
      }

      // Arista Izquierda (X = xs[i]): hacia arriba (-Y)
      if (i === 0 || !grid[i - 1][j]) {
        edges.push({
          start: { x: xs[i], y: ys[j + 1] },
          end: { x: xs[i], y: ys[j] }
        });
      }
    }
  }

  if (edges.length === 0) return null;

  // 4. Encadenar aristas en un bucle cerrado ordenado
  const loop: Point2D[] = [];
  let current = edges[0];
  loop.push(current.start);

  const remaining = edges.slice(1);
  while (remaining.length > 0) {
    const nextIdx = remaining.findIndex(
      (e) => Math.hypot(e.start.x - current.end.x, e.start.y - current.end.y) < 0.015
    );
    if (nextIdx === -1) break;
    current = remaining.splice(nextIdx, 1)[0];
    loop.push(current.start);
  }

  if (loop.length < 4) return null;

  // 5. Reducción de vértices colineales
  const simplified: Point2D[] = [];
  const n = loop.length;
  for (let k = 0; k < n; k++) {
    const prev = loop[(k - 1 + n) % n];
    const curr = loop[k];
    const next = loop[(k + 1) % n];

    const isCollinearX = Math.abs(prev.x - curr.x) < 0.015 && Math.abs(curr.x - next.x) < 0.015;
    const isCollinearY = Math.abs(prev.y - curr.y) < 0.015 && Math.abs(curr.y - next.y) < 0.015;

    if (!isCollinearX && !isCollinearY) {
      simplified.push(curr);
    }
  }

  if (simplified.length < 4) return null;

  // 6. Convertir a coordenadas locales relativas al minX, minY del polígono
  const minX = xs[0];
  const minY = ys[0];
  const maxX = xs[xs.length - 1];
  const maxY = ys[ys.length - 1];

  const localVertices: Point2D[] = simplified.map((v) => ({
    x: Number((v.x - minX).toFixed(2)),
    y: Number((v.y - minY).toFixed(2))
  }));

  return {
    minX,
    minY,
    boundingBoxWidth: Number((maxX - minX).toFixed(2)),
    boundingBoxLength: Number((maxY - minY).toFixed(2)),
    areaMeters2: Number(totalArea.toFixed(2)),
    verticesMeters: localVertices
  };
}

/**
 * Evalúa si dos ambientes pueden ser fusionados (si se tocan o solapan).
 */
export function canRoomsBeMerged(roomA: Room, roomB: Room): boolean {
  if (roomA.id === roomB.id) return false;
  if (!roomA.dimensions?.width || !roomB.dimensions?.width) return false;

  const Ax = roomA.canvasPosition.x / PIXELS_PER_METER;
  const Ay = roomA.canvasPosition.y / PIXELS_PER_METER;
  const Aw = roomA.dimensions.width;
  const Ah = roomA.dimensions.length;

  const Bx = roomB.canvasPosition.x / PIXELS_PER_METER;
  const By = roomB.canvasPosition.y / PIXELS_PER_METER;
  const Bw = roomB.dimensions.width;
  const Bh = roomB.dimensions.length;

  const overlapX = Math.min(Ax + Aw, Bx + Bw) - Math.max(Ax, Bx);
  const overlapY = Math.min(Ay + Ah, By + Bh) - Math.max(Ay, By);

  // Solapan físicamente
  if (overlapX > 0.05 && overlapY > 0.05) return true;

  // Se tocan por borde (contacto <= 0.15m)
  const touchHoriz = (Math.abs(Ax + Aw - Bx) < 0.15 || Math.abs(Bx + Bw - Ax) < 0.15) && overlapY > 0.15;
  const touchVert = (Math.abs(Ay + Ah - By) < 0.15 || Math.abs(By + Bh - Ay) < 0.15) && overlapX > 0.15;

  return touchHoriz || touchVert;
}

/**
 * Combina dos recintos en un nuevo objeto Room único con geometría poligonal continua.
 */
export function mergeTwoRooms(roomA: Room, roomB: Room, customName?: string): Room | null {
  const Ax = roomA.canvasPosition.x / PIXELS_PER_METER;
  const Ay = roomA.canvasPosition.y / PIXELS_PER_METER;
  const Bx = roomB.canvasPosition.x / PIXELS_PER_METER;
  const By = roomB.canvasPosition.y / PIXELS_PER_METER;

  const rectA: RectangleMeters = {
    x: Ax,
    y: Ay,
    width: roomA.dimensions.width,
    length: roomA.dimensions.length
  };

  const rectB: RectangleMeters = {
    x: Bx,
    y: By,
    width: roomB.dimensions.width,
    length: roomB.dimensions.length
  };

  const unionResult = unionOfTwoRectangles(rectA, rectB);
  if (!unionResult) return null;

  const mergedName = customName || `${roomA.name} - ${roomB.name}`;

  // Consolidar activos eléctricos de ambos ambientes
  const combinedAssets = [
    ...(roomA.electricalAssets || []),
    ...(roomB.electricalAssets || [])
  ];

  const mergedRoom: Room = {
    id: `room-fused-${Date.now()}`,
    name: mergedName,
    type: roomA.type,
    color: roomA.color || roomB.color || '#f8fafc',
    tipoCubierta: roomA.tipoCubierta || roomB.tipoCubierta || 'cubierto',
    dimensions: {
      width: unionResult.boundingBoxWidth,
      length: unionResult.boundingBoxLength,
      height: Math.max(roomA.dimensions.height || 2.6, roomB.dimensions.height || 2.6),
      widthLocked: true,
      lengthLocked: true
    },
    canvasPosition: {
      x: Number((unionResult.minX * PIXELS_PER_METER).toFixed(1)),
      y: Number((unionResult.minY * PIXELS_PER_METER).toFixed(1))
    },
    topologyPosition: roomA.topologyPosition || roomB.topologyPosition,
    geometry: {
      mode: 'polygon',
      computedVertices: unionResult.verticesMeters
    },
    electricalAssets: combinedAssets,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return mergedRoom;
}
