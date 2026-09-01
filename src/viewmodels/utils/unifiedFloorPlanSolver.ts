/**
 * ViewModel Utility: Unified Architectural Floor Plan Solver
 * Resuelve la unificación de muros compartidos y deduplicación de aberturas arquitectónicas:
 * - Evita duplicar aberturas (puertas, ventanas, vanos) entre ambientes adyacentes.
 * - Evita duplicar muros divisorios (muro único de 10/15/20cm en lugar de doble pared solapada).
 * - Identifica irregularidades e intersecciones reales (mochetas, quiebres T, esquinas salientes).
 */

import { Room, WallOrientation } from '@/models/RoomModel';
import { LogicalConnection } from '@/models/GraphModel';
import { metersToPixels } from './geometryUtils';

export interface WallInterfaceSegment {
  wall: WallOrientation;
  startPx: number;
  endPx: number;
  lengthPx: number;
  isShared: boolean;
  adjacentRoomId?: string;
  adjacentRoomName?: string;
  opening?: LogicalConnection;
}

export interface RoomWallPlanimetry {
  roomId: string;
  north: WallInterfaceSegment[];
  south: WallInterfaceSegment[];
  east: WallInterfaceSegment[];
  west: WallInterfaceSegment[];
}

/**
 * Determina qué ambiente es el responsable exclusivo de renderizar la abertura
 * para garantizar que nunca se dibuje por duplicado.
 */
export function getResponsibleRoomForOpening(conn: LogicalConnection, allRooms: Room[]): string {
  const sourceRoom = allRooms.find((r) => r.id === conn.sourceRoomId);
  const targetRoom = allRooms.find((r) => r.id === conn.targetRoomId);

  // Si uno de los dos es un punto de acceso (Palier, Calle), manda el ambiente métrico real
  if (sourceRoom?.isAccessPoint || sourceRoom?.isTechnicalIsland) {
    return conn.targetRoomId;
  }
  if (targetRoom?.isAccessPoint || targetRoom?.isTechnicalIsland) {
    return conn.sourceRoomId;
  }

  // Entre dos ambientes métricos habitables, el sourceRoomId es el dueño de la abertura
  return conn.sourceRoomId;
}

/**
 * Calcula la planimetría de muros e interfaces para cada ambiente, deduplicando aberturas y muros.
 */
export function calculateRoomPlanimetry(
  room: Room,
  allRooms: Room[],
  connections: LogicalConnection[]
): {
  northOpenings: LogicalConnection[];
  southOpenings: LogicalConnection[];
  eastOpenings: LogicalConnection[];
  westOpenings: LogicalConnection[];
  sharedWalls: {
    north: boolean;
    south: boolean;
    east: boolean;
    west: boolean;
  };
} {
  const isNonMetric = room.isAccessPoint || room.isTechnicalIsland;
  if (isNonMetric) {
    return {
      northOpenings: [],
      southOpenings: [],
      eastOpenings: [],
      westOpenings: [],
      sharedWalls: { north: false, south: false, east: false, west: false }
    };
  }

  // Filtrar aberturas donde este ambiente es el responsable primario (DEDUPLICACIÓN)
  const getOpeningsForWall = (wall: WallOrientation) => {
    return connections.filter((conn) => {
      if (!conn.opening) return false;
      const responsibleId = getResponsibleRoomForOpening(conn, allRooms);
      if (responsibleId !== room.id) return false;

      if (conn.sourceRoomId === room.id && conn.sourceWall === wall) return true;
      if (conn.targetRoomId === room.id && conn.targetWall === wall) return true;
      return false;
    });
  };

  const northOpenings = getOpeningsForWall('north');
  const southOpenings = getOpeningsForWall('south');
  const eastOpenings = getOpeningsForWall('east');
  const westOpenings = getOpeningsForWall('west');

  // Detectar paredes compartidas (si hay un ambiente adyacente contiguo)
  const widthPx = metersToPixels(room.dimensions?.width || 3);
  const lengthPx = metersToPixels(room.dimensions?.length || 2.5);
  const rLeft = room.canvasPosition.x;
  const rRight = room.canvasPosition.x + widthPx;
  const rTop = room.canvasPosition.y;
  const rBottom = room.canvasPosition.y + lengthPx;

  let sharedNorth = false;
  let sharedSouth = false;
  let sharedEast = false;
  let sharedWest = false;

  const otherRooms = allRooms.filter(
    (r) => r.id !== room.id && !r.isAccessPoint && !r.isTechnicalIsland
  );

  for (const other of otherRooms) {
    const oW = metersToPixels(other.dimensions?.width || 3);
    const oH = metersToPixels(other.dimensions?.length || 2.5);
    const oLeft = other.canvasPosition.x;
    const oRight = other.canvasPosition.x + oW;
    const oTop = other.canvasPosition.y;
    const oBottom = other.canvasPosition.y + oH;

    const overlapX = Math.max(0, Math.min(rRight, oRight) - Math.max(rLeft, oLeft));
    const overlapY = Math.max(0, Math.min(rBottom, oBottom) - Math.max(rTop, oTop));

    // Contacto Norte de room con Sur de other
    if (Math.abs(rTop - oBottom) <= 4 && overlapX > 10) {
      sharedNorth = true;
    }
    // Contacto Sur de room con Norte de other
    if (Math.abs(rBottom - oTop) <= 4 && overlapX > 10) {
      sharedSouth = true;
    }
    // Contacto Oeste de room con Este de other
    if (Math.abs(rLeft - oRight) <= 4 && overlapY > 10) {
      sharedWest = true;
    }
    // Contacto Este de room con Oeste de other
    if (Math.abs(rRight - oLeft) <= 4 && overlapY > 10) {
      sharedEast = true;
    }
  }

  return {
    northOpenings,
    southOpenings,
    eastOpenings,
    westOpenings,
    sharedWalls: {
      north: sharedNorth,
      south: sharedSouth,
      east: sharedEast,
      west: sharedWest
    }
  };
}
