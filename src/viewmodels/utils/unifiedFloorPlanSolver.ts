/**
 * ViewModel Utility: Unified Architectural Floor Plan Solver
 * Resuelve la unificación de muros compartidos y deduplicación de aberturas arquitectónicas:
 * - Evita duplicar aberturas (puertas, ventanas, vanos) entre ambientes adyacentes.
 * - Evita duplicar muros divisorios y garantiza la colocalización exacta del vano en ambas habitaciones.
 * - Soporta 0 (pared ciega), 1 o múltiples aberturas en la misma pared (ej. puerta + pasa-platos).
 * - Identifica irregularidades, mochetas e interfaces reales de contacto.
 */

import { Room, WallOrientation, isMetricRoom } from '@/models/RoomModel';
import {
  LogicalConnection,
  OpeningProperties,
  getConnectionOpenings,
  getConnectionWallThickness
} from '@/models/GraphModel';
import { metersToPixels, PIXELS_PER_METER } from './geometryUtils';

export interface WallOpeningInterval {
  opening: OpeningProperties;
  startPx: number;           // Coordenada local de inicio del vano en la pared
  endPx: number;             // Coordenada local de fin del vano en la pared
  widthPx: number;           // Ancho del vano en px
  centerPx: number;          // Centro del vano en px
  offsetRatio: number;       // Ratio normalizado respecto al largo total de la pared
  shouldDrawSymbol: boolean; // True si este ambiente debe dibujar el símbolo CAD (arco/vidrio/líneas)
}

export interface WallPlanimetryInfo {
  wall: WallOrientation;
  isShared: boolean;
  isVirtualBoundary?: boolean;
  wallThicknessMeters: number;
  openings: OpeningProperties[];
  intervals: WallOpeningInterval[];
  connection?: LogicalConnection;
}

export interface RoomPlanimetryResult {
  north: WallPlanimetryInfo;
  south: WallPlanimetryInfo;
  east: WallPlanimetryInfo;
  west: WallPlanimetryInfo;

  // Compatibilidad hacia atrás
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
}

/**
 * Determina qué ambiente es el responsable exclusivo de renderizar la abertura
 * para garantizar que nunca se dibuje por duplicado.
 */
export function getResponsibleRoomForOpening(conn: LogicalConnection, allRooms: Room[]): string {
  const sourceRoom = allRooms.find((r) => r.id === conn.sourceRoomId);
  const targetRoom = allRooms.find((r) => r.id === conn.targetRoomId);

  // Si uno de los dos es un punto no métrico (Palier, Calle, Medianera), manda el ambiente métrico real
  if (sourceRoom && !isMetricRoom(sourceRoom)) {
    return conn.targetRoomId;
  }
  if (targetRoom && !isMetricRoom(targetRoom)) {
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
  connections: LogicalConnection[],
  defaultWallThicknessMeters: number = 0.10
): RoomPlanimetryResult {
  const isNonMetric = !isMetricRoom(room);
  if (isNonMetric) {
    const emptyWall = (wall: WallOrientation): WallPlanimetryInfo => ({
      wall,
      isShared: false,
      wallThicknessMeters: defaultWallThicknessMeters,
      openings: [],
      intervals: []
    });
    return {
      north: emptyWall('north'),
      south: emptyWall('south'),
      east: emptyWall('east'),
      west: emptyWall('west'),
      northOpenings: [],
      southOpenings: [],
      eastOpenings: [],
      westOpenings: [],
      sharedWalls: { north: false, south: false, east: false, west: false }
    };
  }

  // Dimensiones y coordenadas del ambiente actual
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
    (r) => r.id !== room.id && isMetricRoom(r)
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

    const tPx = metersToPixels(defaultWallThicknessMeters);

    // Contacto Norte de room con Sur de other (la misma pared compartida o contacto directo)
    if ((Math.abs(rTop - (oBottom + tPx)) <= 12 || Math.abs(rTop - oBottom) <= 12) && overlapX > 10) {
      sharedNorth = true;
    }
    // Contacto Sur de room con Norte de other (la misma pared compartida o contacto directo)
    if ((Math.abs(rBottom + tPx - oTop) <= 12 || Math.abs(rBottom - oTop) <= 12) && overlapX > 10) {
      sharedSouth = true;
    }
    // Contacto Oeste de room con Este de other (la misma pared compartida o contacto directo)
    if ((Math.abs(rLeft - (oRight + tPx)) <= 12 || Math.abs(rLeft - oRight) <= 12) && overlapY > 10) {
      sharedWest = true;
    }
    // Contacto Este de room con Oeste de other (la misma pared compartida o contacto directo)
    if ((Math.abs(rRight + tPx - oLeft) <= 12 || Math.abs(rRight - oLeft) <= 12) && overlapY > 10) {
      sharedEast = true;
    }
  }

  // Helper para resolver la información e intervalos de una pared
  const resolveWallInfo = (wall: WallOrientation, isGeoShared: boolean): WallPlanimetryInfo => {
    const isHoriz = wall === 'north' || wall === 'south';
    const wallLengthPx = isHoriz ? widthPx : lengthPx;
    const roomWallOrigin = isHoriz ? rLeft : rTop;

    // Buscar conexión incidente en esta pared
    const conn = connections.find((c) => {
      if (c.sourceRoomId === room.id && c.sourceWall === wall) return true;
      if (c.targetRoomId === room.id && c.targetWall === wall) return true;
      return false;
    });

    const isShared = isGeoShared || Boolean(conn);
    const wallThicknessMeters = getConnectionWallThickness(conn, defaultWallThicknessMeters);

    if (!conn) {
      return {
        wall,
        isShared,
        wallThicknessMeters,
        openings: [],
        intervals: []
      };
    }

    const isVirtual = Boolean(
      conn.isVirtualBoundary ||
      conn.wallProperties?.isVirtualBoundary ||
      conn.type === 'limite_virtual'
    );

    if (isVirtual) {
      return {
        wall,
        isShared: true,
        isVirtualBoundary: true,
        wallThicknessMeters: 0,
        openings: [],
        intervals: [],
        connection: conn
      };
    }

    // Si es un tabique ciego / pared común sin aberturas
    if (conn.type === 'pared_comun' && getConnectionOpenings(conn).length === 0) {
      return {
        wall,
        isShared: true,
        wallThicknessMeters,
        openings: [],
        intervals: [],
        connection: conn
      };
    }

    const allOps = getConnectionOpenings(conn);
    if (allOps.length === 0) {
      return {
        wall,
        isShared: true,
        wallThicknessMeters,
        openings: [],
        intervals: [],
        connection: conn
      };
    }

    const isResponsible = getResponsibleRoomForOpening(conn, allRooms) === room.id;
    const otherId = conn.sourceRoomId === room.id ? conn.targetRoomId : conn.sourceRoomId;
    const otherRoom = allRooms.find((r) => r.id === otherId);

    // Calcular el segmento de contacto físico compartido en coordenadas globales
    let sGlobal = roomWallOrigin;
    let eGlobal = roomWallOrigin + wallLengthPx;

    if (otherRoom && isMetricRoom(otherRoom)) {
      const oW = metersToPixels(otherRoom.dimensions?.width || 3);
      const oH = metersToPixels(otherRoom.dimensions?.length || 2.5);
      const oLeft = otherRoom.canvasPosition.x;
      const oRight = otherRoom.canvasPosition.x + oW;
      const oTop = otherRoom.canvasPosition.y;
      const oBottom = otherRoom.canvasPosition.y + oH;

      if (isHoriz) {
        const segStart = Math.max(rLeft, oLeft);
        const segEnd = Math.min(rRight, oRight);
        if (segEnd > segStart) {
          sGlobal = segStart;
          eGlobal = segEnd;
        }
      } else {
        const segStart = Math.max(rTop, oTop);
        const segEnd = Math.min(rBottom, oBottom);
        if (segEnd > segStart) {
          sGlobal = segStart;
          eGlobal = segEnd;
        }
      }
    }

    const sharedContactLength = Math.max(10, eGlobal - sGlobal);
    const intervals: WallOpeningInterval[] = [];

    allOps.forEach((op, index) => {
      const opWidthPx = Math.min(
        sharedContactLength * 0.95,
        (op.widthMeters || 0.8) * PIXELS_PER_METER
      );

      let ratioInShared = 0.5;
      if (op.offsetRatio !== undefined) {
        ratioInShared = op.offsetRatio;
      } else if (allOps.length > 1) {
        ratioInShared = (index + 1) / (allOps.length + 1);
      }

      // Centro global exacto en el segmento compartido
      const centerGlobal = sGlobal + ratioInShared * sharedContactLength;
      // Posición relativa al origen de la pared del ambiente actual
      const centerLocal = centerGlobal - roomWallOrigin;
      const startLocal = Math.max(0, centerLocal - opWidthPx / 2);
      const endLocal = Math.min(wallLengthPx, centerLocal + opWidthPx / 2);

      intervals.push({
        opening: op,
        startPx: startLocal,
        endPx: endLocal,
        widthPx: opWidthPx,
        centerPx: centerLocal,
        offsetRatio: centerLocal / wallLengthPx,
        shouldDrawSymbol: isResponsible
      });
    });

    // Ordenar intervalos por coordenada local
    intervals.sort((a, b) => a.startPx - b.startPx);

    return {
      wall,
      isShared: true,
      wallThicknessMeters,
      openings: allOps,
      intervals,
      connection: conn
    };
  };

  const northInfo = resolveWallInfo('north', sharedNorth);
  const southInfo = resolveWallInfo('south', sharedSouth);
  const eastInfo = resolveWallInfo('east', sharedEast);
  const westInfo = resolveWallInfo('west', sharedWest);

  // Colecciones legacy para compatibilidad
  const getLegacyConns = (wall: WallOrientation) => {
    return connections.filter((conn) => {
      if (conn.type === 'pared_comun') return false;
      const responsibleId = getResponsibleRoomForOpening(conn, allRooms);
      if (responsibleId !== room.id) return false;
      const ops = getConnectionOpenings(conn);
      if (ops.length === 0) return false;
      if (conn.sourceRoomId === room.id && conn.sourceWall === wall) return true;
      if (conn.targetRoomId === room.id && conn.targetWall === wall) return true;
      return false;
    });
  };

  return {
    north: northInfo,
    south: southInfo,
    east: eastInfo,
    west: westInfo,
    northOpenings: getLegacyConns('north'),
    southOpenings: getLegacyConns('south'),
    eastOpenings: getLegacyConns('east'),
    westOpenings: getLegacyConns('west'),
    sharedWalls: {
      north: northInfo.isShared,
      south: southInfo.isShared,
      east: eastInfo.isShared,
      west: westInfo.isShared
    }
  };
}
