/**
 * ViewModel Utility: Automatic Architectural Floor Plan Solver
 * Genera la distribución planimétrica 2D automática a partir del Grafo Topológico.
 * Resuelve adyacencias físicas entre paredes (N, S, E, O), alineaciones y contigüidad.
 */

import { Room } from '@/models/RoomModel';
import { LogicalConnection } from '@/models/GraphModel';
import { metersToPixels } from './geometryUtils';

interface PlacedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Resuelve automáticamente el ensamble espacial 2D de todos los ambientes
 * según las aristas y orientaciones del grafo topológico.
 */
export function solveAutoAssembly(
  rooms: Room[],
  connections: LogicalConnection[],
  origin: { x: number; y: number } = { x: 250, y: 250 }
): Room[] {
  if (rooms.length === 0) return [];

  const placed = new Map<string, PlacedBox>();
  const wallOffsets = new Map<
    string,
    { north: number; south: number; east: number; west: number }
  >();

  const getOffsets = (id: string) => {
    if (!wallOffsets.has(id)) {
      wallOffsets.set(id, { north: 0, south: 0, east: 0, west: 0 });
    }
    return wallOffsets.get(id)!;
  };

  const metricRooms = rooms.filter((r) => !r.isAccessPoint && !r.isTechnicalIsland);
  const nonMetricRooms = rooms.filter((r) => r.isAccessPoint || r.isTechnicalIsland);

  // 1. SELECCIONAR NODO RAÍZ / ANCLAJE (Living o el recinto con más conexiones)
  let rootRoom =
    metricRooms.find((r) => r.type === 'living') ||
    metricRooms.reduce((best, current) => {
      const currentConns = connections.filter(
        (c) => c.sourceRoomId === current.id || c.targetRoomId === current.id
      ).length;
      const bestConns = connections.filter(
        (c) => c.sourceRoomId === best.id || c.targetRoomId === best.id
      ).length;
      return currentConns > bestConns ? current : best;
    }, metricRooms[0] || rooms[0]);

  if (!rootRoom) {
    return rooms;
  }

  const rootW = metersToPixels(rootRoom.dimensions?.width || 3);
  const rootH = metersToPixels(rootRoom.dimensions?.length || 2.5);

  placed.set(rootRoom.id, {
    x: origin.x,
    y: origin.y,
    width: rootW,
    height: rootH
  });

  // 2. PROPAGACIÓN TOPOLÓGICA BREADTH-FIRST (BFS)
  const queue: string[] = [rootRoom.id];
  const visited = new Set<string>([rootRoom.id]);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentBox = placed.get(currentId)!;
    const currentWallOffsets = getOffsets(currentId);

    // Buscar conexiones de este ambiente con otros ambientes métricos no posicionados
    const roomConns = connections.filter(
      (c) => c.sourceRoomId === currentId || c.targetRoomId === currentId
    );

    for (const conn of roomConns) {
      const isSource = conn.sourceRoomId === currentId;
      const targetId = isSource ? conn.targetRoomId : conn.sourceRoomId;
      const targetRoom = metricRooms.find((r) => r.id === targetId);

      if (!targetRoom || visited.has(targetId)) continue;

      const myWall = isSource ? conn.sourceWall : conn.targetWall;
      const targetWall = isSource ? conn.targetWall : conn.sourceWall;
      if (!myWall || !targetWall) continue;

      const targetW = metersToPixels(targetRoom.dimensions?.width || 3);
      const targetH = metersToPixels(targetRoom.dimensions?.length || 2.5);

      let targetX = currentBox.x;
      let targetY = currentBox.y;

      // Calcular coordenadas exactas de encastre según el par de paredes adyacentes
      if (myWall === 'north' && targetWall === 'south') {
        targetY = currentBox.y - targetH;
        targetX = currentBox.x + currentWallOffsets.north;
        currentWallOffsets.north += targetW;
      } else if (myWall === 'south' && targetWall === 'north') {
        targetY = currentBox.y + currentBox.height;
        targetX = currentBox.x + currentWallOffsets.south;
        currentWallOffsets.south += targetW;
      } else if (myWall === 'east' && targetWall === 'west') {
        targetX = currentBox.x + currentBox.width;
        targetY = currentBox.y + currentWallOffsets.east;
        currentWallOffsets.east += targetH;
      } else if (myWall === 'west' && targetWall === 'east') {
        targetX = currentBox.x - targetW;
        targetY = currentBox.y + currentWallOffsets.west;
        currentWallOffsets.west += targetH;
      } else {
        // En caso de paredes no estándar, alinear por proximidad
        if (myWall === 'north') {
          targetY = currentBox.y - targetH;
        } else if (myWall === 'south') {
          targetY = currentBox.y + currentBox.height;
        } else if (myWall === 'east') {
          targetX = currentBox.x + currentBox.width;
        } else if (myWall === 'west') {
          targetX = currentBox.x - targetW;
        }
      }

      placed.set(targetId, {
        x: targetX,
        y: targetY,
        width: targetW,
        height: targetH
      });

      visited.add(targetId);
      queue.push(targetId);
    }
  }

  // 3. RECINTOS MÉTRICOS NO ALCANZADOS (Islas métricas desconectadas)
  let unreachedOffset = 0;
  for (const r of metricRooms) {
    if (!placed.has(r.id)) {
      const rW = metersToPixels(r.dimensions?.width || 3);
      const rH = metersToPixels(r.dimensions?.length || 2.5);
      placed.set(r.id, {
        x: origin.x + 600,
        y: origin.y + unreachedOffset,
        width: rW,
        height: rH
      });
      unreachedOffset += rH + 40;
    }
  }

  // 4. POSICIONAR PUNTOS DE ACCESO Y PUNTOS EXTERIORES (Nubes perimetrales)
  for (const nm of nonMetricRooms) {
    if (nm.isTechnicalIsland) {
      // Islas técnicas aisladas (ej. Sala de Medidores) se ubican en el sector técnico superior
      placed.set(nm.id, {
        x: 40,
        y: 40,
        width: 180,
        height: 100
      });
      continue;
    }

    // Puntos de acceso con conexión a un ambiente métrico
    const conn = connections.find(
      (c) => c.sourceRoomId === nm.id || c.targetRoomId === nm.id
    );

    if (conn) {
      const isSource = conn.sourceRoomId === nm.id;
      const targetMetricId = isSource ? conn.targetRoomId : conn.sourceRoomId;
      const metricBox = placed.get(targetMetricId);

      if (metricBox) {
        const myWall = isSource ? conn.sourceWall : conn.targetWall;
        if (myWall === 'east') {
          // El punto de acceso está al Oeste del recinto
          placed.set(nm.id, {
            x: metricBox.x - 180 - 30,
            y: metricBox.y + metricBox.height / 2 - 50,
            width: 180,
            height: 100
          });
        } else if (myWall === 'west') {
          // El punto de acceso está al Este del recinto
          placed.set(nm.id, {
            x: metricBox.x + metricBox.width + 30,
            y: metricBox.y + metricBox.height / 2 - 50,
            width: 180,
            height: 100
          });
        } else if (myWall === 'south') {
          // El punto de acceso está al Norte del recinto
          placed.set(nm.id, {
            x: metricBox.x + metricBox.width / 2 - 90,
            y: metricBox.y - 100 - 30,
            width: 180,
            height: 100
          });
        } else {
          // Al Sur del recinto
          placed.set(nm.id, {
            x: metricBox.x + metricBox.width / 2 - 90,
            y: metricBox.y + metricBox.height + 30,
            width: 180,
            height: 100
          });
        }
        continue;
      }
    }

    // Punto de acceso sin conexión: posición por defecto
    placed.set(nm.id, {
      x: 40,
      y: 300,
      width: 180,
      height: 100
    });
  }

  // 5. NORMALIZACIÓN Y CENTRADO DE COORDENADAS
  let minX = Infinity;
  let minY = Infinity;

  placed.forEach((box) => {
    if (box.x < minX) minX = box.x;
    if (box.y < minY) minY = box.y;
  });

  const targetMarginX = 60;
  const targetMarginY = 60;
  const shiftX = targetMarginX - minX;
  const shiftY = targetMarginY - minY;

  // 6. GENERAR COPIA INMUTABLE DE ROOMS CON COORDENADAS ACTUALIZADAS
  return rooms.map((room) => {
    const box = placed.get(room.id);
    if (!box) return room;

    return {
      ...room,
      canvasPosition: {
        x: Math.round(box.x + shiftX),
        y: Math.round(box.y + shiftY)
      },
      updatedAt: new Date().toISOString()
    };
  });
}
