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
import { Abertura } from '@/models/OpeningModel';
import { getOppositeWall } from './wallAnchorCalculator';
import { metersToPixels, PIXELS_PER_METER } from './geometryUtils';

export interface WallOpeningInterval {
  opening: OpeningProperties;
  abertura?: Abertura;
  startPx: number;           // Coordenada local de inicio del vano en la pared
  endPx: number;             // Coordenada local de fin del vano en la pared
  widthPx: number;           // Ancho del vano en px
  centerPx: number;          // Centro del vano en px
  offsetRatio: number;       // Ratio normalizado respecto al largo total de la pared
  shouldDrawSymbol: boolean; // True si este ambiente debe dibujar el símbolo CAD (arco/vidrio/líneas)
}

export interface WallSubSegment {
  startPx: number;
  endPx: number;
  type: 'solid_exterior' | 'solid_shared' | 'virtual' | 'opening';
  thicknessMeters: number;
  opening?: OpeningProperties;
  abertura?: Abertura;
  connection?: LogicalConnection;
}

export interface WallPlanimetryInfo {
  wall: WallOrientation;
  isShared: boolean;
  isVirtualBoundary?: boolean;
  cutIntervals?: Array<{ startPx: number; endPx: number }>;
  wallThicknessMeters: number;
  openings: OpeningProperties[];
  aberturas?: Abertura[];
  intervals: WallOpeningInterval[];
  segments: WallSubSegment[];
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
 * Sustrae los intervalos de corte (superposición, invasión, nichos) de una lista de sub-tramos de pared.
 */
export function subtractCutsFromSegments(
  segments: WallSubSegment[],
  cutIntervals: Array<{ startPx: number; endPx: number }>
): WallSubSegment[] {
  if (!cutIntervals || cutIntervals.length === 0) return segments;

  let currentSegments = [...segments];

  for (const cut of cutIntervals) {
    if (cut.endPx - cut.startPx <= 1) continue;
    const nextSegments: WallSubSegment[] = [];

    for (const seg of currentSegments) {
      // 1. Sin solape
      if (cut.endPx <= seg.startPx + 1 || cut.startPx >= seg.endPx - 1) {
        nextSegments.push(seg);
        continue;
      }

      // 2. El corte cubre totalmente el segmento
      if (cut.startPx <= seg.startPx + 1 && cut.endPx >= seg.endPx - 1) {
        continue;
      }

      // 3. El corte está en el medio del segmento -> se divide en dos
      if (cut.startPx > seg.startPx + 1 && cut.endPx < seg.endPx - 1) {
        nextSegments.push({
          ...seg,
          endPx: cut.startPx
        });
        nextSegments.push({
          ...seg,
          startPx: cut.endPx
        });
        continue;
      }

      // 4. El corte recorta el inicio del segmento
      if (cut.startPx <= seg.startPx + 1 && cut.endPx < seg.endPx - 1) {
        nextSegments.push({
          ...seg,
          startPx: cut.endPx
        });
        continue;
      }

      // 5. El corte recorta el final del segmento
      if (cut.startPx > seg.startPx + 1 && cut.endPx >= seg.endPx - 1) {
        nextSegments.push({
          ...seg,
          endPx: cut.startPx
        });
        continue;
      }
    }

    currentSegments = nextSegments;
  }

  return currentSegments.filter((s) => s.endPx - s.startPx > 1);
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
  defaultWallThicknessMeters: number = 0.10,
  allAberturas: Abertura[] = []
): RoomPlanimetryResult {
  const isNonMetric = !isMetricRoom(room);
  if (isNonMetric) {
    const emptyWall = (wall: WallOrientation): WallPlanimetryInfo => ({
      wall,
      isShared: false,
      wallThicknessMeters: defaultWallThicknessMeters,
      openings: [],
      aberturas: [],
      intervals: [],
      segments: []
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

    // 1. Calcular tramos de pared de este ambiente que deben ser recortados porque se superponen o penetran en otro ambiente métrico
    const cutIntervals: Array<{ startPx: number; endPx: number }> = [];

    for (const other of allRooms) {
      if (other.id === room.id || !isMetricRoom(other)) continue;

      const oW = metersToPixels(other.dimensions?.width || 3);
      const oH = metersToPixels(other.dimensions?.length || 2.5);
      const oLeft = other.canvasPosition.x;
      const oRight = oLeft + oW;
      const oTop = other.canvasPosition.y;
      const oBottom = oTop + oH;

      const interLeft = Math.max(rLeft, oLeft);
      const interRight = Math.min(rRight, oRight);
      const interTop = Math.max(rTop, oTop);
      const interBottom = Math.min(rBottom, oBottom);

      const overlapX = interRight - interLeft;
      const overlapY = interBottom - interTop;

      if (overlapX > 4 && overlapY > 4) {
        if (wall === 'north') {
          if (rTop >= oTop - 2 && rTop < oBottom - 2) {
            const startPx = Math.max(0, interLeft - rLeft);
            const endPx = Math.min(widthPx, interRight - rLeft);
            if (endPx - startPx > 4) cutIntervals.push({ startPx, endPx });
          }
        } else if (wall === 'south') {
          if (rBottom > oTop + 2 && rBottom <= oBottom + 2) {
            const startPx = Math.max(0, interLeft - rLeft);
            const endPx = Math.min(widthPx, interRight - rLeft);
            if (endPx - startPx > 4) cutIntervals.push({ startPx, endPx });
          }
        } else if (wall === 'west') {
          if (rLeft >= oLeft - 2 && rLeft < oRight - 2) {
            const startPx = Math.max(0, interTop - rTop);
            const endPx = Math.min(lengthPx, interBottom - rTop);
            if (endPx - startPx > 4) cutIntervals.push({ startPx, endPx });
          }
        } else if (wall === 'east') {
          if (rRight > oLeft + 2 && rRight <= oRight + 2) {
            const startPx = Math.max(0, interTop - rTop);
            const endPx = Math.min(lengthPx, interBottom - rTop);
            if (endPx - startPx > 4) cutIntervals.push({ startPx, endPx });
          }
        }
      }
    }

    // Buscar conexión incidente en esta pared
    const conn = connections.find((c) => {
      if (c.sourceRoomId === room.id && c.sourceWall === wall) return true;
      if (c.targetRoomId === room.id && c.targetWall === wall) return true;
      return false;
    });

    // Identificar vecino adyacente para muros compartidos
    let otherRoom: Room | undefined;
    if (conn) {
      const otherId = conn.sourceRoomId === room.id ? conn.targetRoomId : conn.sourceRoomId;
      otherRoom = allRooms.find((r) => r.id === otherId);
    } else if (isGeoShared) {
      // Buscar el vecino geométrico en este límite
      otherRoom = otherRooms.find((o) => {
        const oW = metersToPixels(o.dimensions?.width || 3);
        const oH = metersToPixels(o.dimensions?.length || 2.5);
        if (wall === 'north') return Math.abs(rTop - (o.canvasPosition.y + oH)) <= 14;
        if (wall === 'south') return Math.abs(rBottom - o.canvasPosition.y) <= 14;
        if (wall === 'west') return Math.abs(rLeft - (o.canvasPosition.x + oW)) <= 14;
        if (wall === 'east') return Math.abs(rRight - o.canvasPosition.x) <= 14;
        return false;
      });
    }

    const isShared = isGeoShared || Boolean(conn);
    const wallThicknessMeters = getConnectionWallThickness(conn, defaultWallThicknessMeters);

    const hasInvasion = Boolean(conn?.invasion && conn.invasion.type !== 'none');
    const isVirtual = !hasInvasion && Boolean(
      conn?.isVirtualBoundary ||
      conn?.wallProperties?.isVirtualBoundary ||
      conn?.type === 'limite_virtual'
    );

    // Calcular el segmento de contacto físico compartido en coordenadas locales [contactStartPx, contactEndPx]
    let contactStartPx = 0;
    let contactEndPx = wallLengthPx;
    let hasContact = false;

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
        if (segEnd - segStart > 5) {
          contactStartPx = Math.max(0, segStart - rLeft);
          contactEndPx = Math.min(wallLengthPx, segEnd - rLeft);
          hasContact = true;
        }
      } else {
        const segStart = Math.max(rTop, oTop);
        const segEnd = Math.min(rBottom, oBottom);
        if (segEnd - segStart > 5) {
          contactStartPx = Math.max(0, segStart - rTop);
          contactEndPx = Math.min(wallLengthPx, segEnd - rTop);
          hasContact = true;
        }
      }
    }

    // 🧱 Recolectar aberturas (Abertura Model + LogicalConnection Legacy)
    const intervals: WallOpeningInterval[] = [];
    const processedIds = new Set<string>();

    // 1. Aberturas propias de este ambiente en esta pared
    const roomAberturas = allAberturas.filter((a) => a.roomId === room.id && a.wall === wall);
    roomAberturas.forEach((a) => {
      processedIds.add(a.id);
      const aWidthPx = Math.min(wallLengthPx, a.anchoMeters * PIXELS_PER_METER);
      const aStartPx = Math.max(0, Math.min(wallLengthPx - aWidthPx, a.posicionMeters * PIXELS_PER_METER));
      const aEndPx = aStartPx + aWidthPx;
      const aCenterPx = (aStartPx + aEndPx) / 2;

      intervals.push({
        opening: {
          id: a.id,
          openingType: a.tipo === 'puerta' ? (a.hojas === 2 ? 'puerta_doble' : 'puerta_estandar') : a.tipo === 'ventana' ? 'ventana_estandar' : 'vano_libre',
          widthMeters: a.anchoMeters,
          heightMeters: a.altoMeters ?? 2.05,
          swingDirection: a.sentidoGiro === 'izquierda' ? 'left' : 'right',
          offsetRatio: wallLengthPx > 0 ? aCenterPx / wallLengthPx : 0.5,
          label: a.etiqueta || ''
        },
        abertura: a,
        startPx: aStartPx,
        endPx: aEndPx,
        widthPx: aWidthPx,
        centerPx: aCenterPx,
        offsetRatio: wallLengthPx > 0 ? aCenterPx / wallLengthPx : 0.5,
        shouldDrawSymbol: true
      });
    });

    // 2. Aberturas del ambiente vecino en pared compartida (para cortar el muro sin duplicar el símbolo CAD)
    if (isShared && hasContact && otherRoom) {
      const oppWall = getOppositeWall(wall);
      const neighborAberturas = allAberturas.filter(
        (a) => a.roomId === otherRoom.id && (a.wall === oppWall || a.wallVecina === wall || a.ambienteVecinoId === room.id)
      );

      neighborAberturas.forEach((a) => {
        if (processedIds.has(a.id)) return;
        processedIds.add(a.id);

        // Alineación métrica relativa entre los orígenes de ambos ambientes
        let relativeOffsetPx = 0;
        if (isHoriz) {
          relativeOffsetPx = otherRoom.canvasPosition.x - room.canvasPosition.x;
        } else {
          relativeOffsetPx = otherRoom.canvasPosition.y - room.canvasPosition.y;
        }

        const aWidthPx = Math.min(wallLengthPx, a.anchoMeters * PIXELS_PER_METER);
        const aStartPx = Math.max(0, Math.min(wallLengthPx - aWidthPx, a.posicionMeters * PIXELS_PER_METER + relativeOffsetPx));
        const aEndPx = aStartPx + aWidthPx;
        const aCenterPx = (aStartPx + aEndPx) / 2;

        intervals.push({
          opening: {
            id: a.id,
            openingType: a.tipo === 'puerta' ? (a.hojas === 2 ? 'puerta_doble' : 'puerta_estandar') : a.tipo === 'ventana' ? 'ventana_estandar' : 'vano_libre',
            widthMeters: a.anchoMeters,
            heightMeters: a.altoMeters ?? 2.05,
            swingDirection: a.sentidoGiro === 'izquierda' ? 'left' : 'right',
            offsetRatio: wallLengthPx > 0 ? aCenterPx / wallLengthPx : 0.5,
            label: a.etiqueta || ''
          },
          abertura: a,
          startPx: aStartPx,
          endPx: aEndPx,
          widthPx: aWidthPx,
          centerPx: aCenterPx,
          offsetRatio: wallLengthPx > 0 ? aCenterPx / wallLengthPx : 0.5,
          shouldDrawSymbol: false // El vecino dibuja el símbolo CAD; este ambiente solo abre el paso
        });
      });
    }

    // 3. Aberturas legacy de LogicalConnection
    if (conn) {
      const allOps = getConnectionOpenings(conn);
      const sharedContactLength = Math.max(10, contactEndPx - contactStartPx);
      const isResponsible = getResponsibleRoomForOpening(conn, allRooms) === room.id;

      allOps.forEach((op, index) => {
        if (op.id && processedIds.has(op.id)) return;
        if (op.id) processedIds.add(op.id);

        const opWidthPx = Math.min(sharedContactLength * 0.95, (op.widthMeters || 0.8) * PIXELS_PER_METER);
        const ratioInShared = op.offsetRatio !== undefined ? op.offsetRatio : (index + 1) / (allOps.length + 1);
        const centerLocal = contactStartPx + ratioInShared * sharedContactLength;
        const startLocal = Math.max(contactStartPx, centerLocal - opWidthPx / 2);
        const endLocal = Math.min(contactEndPx, centerLocal + opWidthPx / 2);

        intervals.push({
          opening: op,
          startPx: startLocal,
          endPx: endLocal,
          widthPx: opWidthPx,
          centerPx: centerLocal,
          offsetRatio: wallLengthPx > 0 ? centerLocal / wallLengthPx : 0.5,
          shouldDrawSymbol: isResponsible
        });
      });
    }

    intervals.sort((a, b) => a.startPx - b.startPx);

    // 4. Generación de tramos de pared (Segments) cortados limpiamente por las aberturas
    const baselineSegments: WallSubSegment[] = [];

    if (!isShared || !hasContact) {
      baselineSegments.push({
        startPx: 0,
        endPx: wallLengthPx,
        type: 'solid_exterior',
        thicknessMeters: defaultWallThicknessMeters
      });
    } else {
      if (contactStartPx > 2) {
        baselineSegments.push({
          startPx: 0,
          endPx: contactStartPx,
          type: 'solid_exterior',
          thicknessMeters: defaultWallThicknessMeters
        });
      }

      if (contactEndPx - contactStartPx > 2) {
        baselineSegments.push({
          startPx: contactStartPx,
          endPx: contactEndPx,
          type: isVirtual ? 'virtual' : 'solid_shared',
          thicknessMeters: isVirtual ? 0 : wallThicknessMeters,
          connection: conn
        });
      }

      if (wallLengthPx - contactEndPx > 2) {
        baselineSegments.push({
          startPx: contactEndPx,
          endPx: wallLengthPx,
          type: 'solid_exterior',
          thicknessMeters: defaultWallThicknessMeters
        });
      }
    }

    // Cortar los vanos de las secciones sólidas
    const openingCuts = intervals.map((int) => ({ startPx: int.startPx, endPx: int.endPx }));
    const solidAfterOpenings = subtractCutsFromSegments(baselineSegments, openingCuts);

    // Insertar tramos de tipo 'opening' en las posiciones exactas
    const openingSegments: WallSubSegment[] = intervals.map((int) => ({
      startPx: int.startPx,
      endPx: int.endPx,
      type: 'opening',
      thicknessMeters: wallThicknessMeters,
      opening: int.opening,
      abertura: int.abertura,
      connection: conn
    }));

    const allSegments = [...solidAfterOpenings, ...openingSegments].sort((a, b) => a.startPx - b.startPx);

    return {
      wall,
      isShared,
      isVirtualBoundary: isVirtual,
      cutIntervals,
      wallThicknessMeters,
      openings: intervals.map((i) => i.opening),
      aberturas: intervals.map((i) => i.abertura).filter((a): a is Abertura => Boolean(a)),
      intervals,
      segments: subtractCutsFromSegments(allSegments, cutIntervals),
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
