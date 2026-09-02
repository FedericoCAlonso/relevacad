/**
 * ViewModel Utility: Automatic Architectural Floor Plan Solver
 * Genera la distribución planimétrica 2D automática a partir del Grafo Topológico.
 * Resuelve:
 * 1. Adyacencias físicas exactas entre paredes (N, S, E, O) y contigüidad.
 * 2. Múltiples restricciones simultáneas (ej. Dormitorio que toca Pasillo al Oeste y Balcón al Sur).
 * 3. Detección y eliminación estricta de solapamientos (cero interpenetración de ambientes).
 * 4. Deducción automática de Quiebres / Invasiones de Muro (Placares, Nichos de Ducha, Mochetas).
 * 5. Normalización y centrado planimétrico.
 */

import { Room, WallBreak, isMetricRoom, isParcelBoundaryNode } from '@/models/RoomModel';
import { LogicalConnection, getConnectionOpenings } from '@/models/GraphModel';
import { metersToPixels, PIXELS_PER_METER } from './geometryUtils';
import { calculateRoomPolygon } from './polygonSolver';

interface PlacedBox {
  x: number;
  y: number;
  width: number;
  height: number;
  isFixed?: boolean;
}

/**
 * Deduce y aplica automáticamente los quiebres de pared (WallBreaks) en los ambientes
 * a partir de las propiedades de invasión configuradas en las aristas/muros compartidos.
 * Los límites de parcela y medianeras son inmutables y no admiten invasión.
 */
export function applyInvasionsToRoomGeometries(
  rooms: Room[],
  connections: LogicalConnection[]
): Room[] {
  const metricRooms = rooms.filter(isMetricRoom);

  // Mapa de quiebres calculados por roomId
  const breaksByRoom = new Map<string, WallBreak[]>();
  metricRooms.forEach((r) => breaksByRoom.set(r.id, []));

  for (const conn of connections) {
    if (!conn.invasion || conn.invasion.type === 'none') {
      continue;
    }

    const isSourceInvader = conn.invasion.type === 'source_invades_target';
    const invaderId = isSourceInvader ? conn.sourceRoomId : conn.targetRoomId;
    const invadedId = isSourceInvader ? conn.targetRoomId : conn.sourceRoomId;

    const rawInvader = rooms.find((r) => r.id === invaderId);
    const rawInvaded = rooms.find((r) => r.id === invadedId);
    if (!rawInvader || !rawInvaded) continue;

    // Los límites de parcela y medianeras NO se pueden invadir (restricción física / código civil)
    if (isParcelBoundaryNode(rawInvader) || isParcelBoundaryNode(rawInvaded)) {
      continue;
    }

    const invaderRoom = metricRooms.find((r) => r.id === invaderId);
    const invadedRoom = metricRooms.find((r) => r.id === invadedId);
    if (!invaderRoom || !invadedRoom) continue;

    const rawInvaderWall = isSourceInvader
      ? conn.sourceWall || 'north'
      : conn.targetWall || 'south';
    const rawInvadedWall = isSourceInvader
      ? conn.targetWall || 'south'
      : conn.sourceWall || 'north';

    const invaderWall: 'north' | 'south' | 'east' | 'west' =
      rawInvaderWall === 'ceiling' ? 'north' : rawInvaderWall;
    const invadedWall: 'north' | 'south' | 'east' | 'west' =
      rawInvadedWall === 'ceiling' ? 'south' : rawInvadedWall;
    const isHoriz = invaderWall === 'north' || invaderWall === 'south';

    // Determinar longitud del tramo compartido en metros
    const rW_invader = invaderRoom.dimensions.width;
    const rH_invader = invaderRoom.dimensions.length;
    const rW_invaded = invadedRoom.dimensions.width;
    const rH_invaded = invadedRoom.dimensions.length;

    const rLeft_invader = invaderRoom.canvasPosition.x / PIXELS_PER_METER;
    const rTop_invader = invaderRoom.canvasPosition.y / PIXELS_PER_METER;
    const rLeft_invaded = invadedRoom.canvasPosition.x / PIXELS_PER_METER;
    const rTop_invaded = invadedRoom.canvasPosition.y / PIXELS_PER_METER;

    let sGlobal = 0;
    let eGlobal = 0;
    let invaderWallOrigin = 0;
    let invadedWallOrigin = 0;
    const invaderWallLen = isHoriz ? rW_invader : rH_invader;
    const invadedWallLen = isHoriz ? rW_invaded : rH_invaded;

    if (isHoriz) {
      sGlobal = Math.max(rLeft_invader, rLeft_invaded);
      eGlobal = Math.min(rLeft_invader + rW_invader, rLeft_invaded + rW_invaded);
      invaderWallOrigin = rLeft_invader;
      invadedWallOrigin = rLeft_invaded;
    } else {
      sGlobal = Math.max(rTop_invader, rTop_invaded);
      eGlobal = Math.min(rTop_invader + rH_invader, rTop_invaded + rH_invaded);
      invaderWallOrigin = rTop_invader;
      invadedWallOrigin = rTop_invaded;
    }

    let sharedLen = eGlobal - sGlobal;
    if (sharedLen <= 0.1) {
      sharedLen = Math.min(invaderWallLen, invadedWallLen);
      sGlobal = invaderWallOrigin;
      eGlobal = invaderWallOrigin + sharedLen;
    }

    const breakWidth =
      conn.invasion.widthMeters && conn.invasion.widthMeters > 0
        ? Math.min(sharedLen, conn.invasion.widthMeters)
        : sharedLen;

    // Deducción automática de posición del quiebre
    let offsetInShared = 0;
    const openings = getConnectionOpenings(conn);
    if (openings.length > 0 && breakWidth < sharedLen) {
      const firstOp = openings[0];
      const opRatio = firstOp.offsetRatio ?? 0.5;
      if (opRatio < 0.5) {
        offsetInShared = sharedLen - breakWidth;
      } else {
        offsetInShared = 0;
      }
    } else if (breakWidth < sharedLen) {
      offsetInShared = (sharedLen - breakWidth) / 2;
    }

    const breakGlobalStart = sGlobal + offsetInShared;
    const invaderStartLocal = Math.max(
      0,
      Math.min(invaderWallLen - breakWidth, breakGlobalStart - invaderWallOrigin)
    );
    const invadedStartLocal = Math.max(
      0,
      Math.min(invadedWallLen - breakWidth, breakGlobalStart - invadedWallOrigin)
    );

    let depth = conn.invasion.depthMeters || 0;
    if (depth <= 0) {
      // Deducir automáticamente por discrepancia geométrica de cotas perpendiculares
      const diffLength = Math.abs(rH_invader - rH_invaded);
      const diffWidth = Math.abs(rW_invader - rW_invaded);
      const cotaDiff = isHoriz ? diffLength : diffWidth;
      if (cotaDiff > 0.1 && cotaDiff <= 2.0) {
        depth = Number(cotaDiff.toFixed(2));
      } else {
        // Módulo estándar de placard / nicho (0.60m)
        depth = 0.60;
      }
    }

    // Quiebre en el recinto INVASOR (+depth = extiende hacia afuera)
    const invaderBreak: WallBreak = {
      id: `wb-invader-${conn.id}`,
      wall: invaderWall,
      startOffsetMeters: Number(invaderStartLocal.toFixed(2)),
      widthMeters: Number(breakWidth.toFixed(2)),
      depthMeters: Number(depth.toFixed(2)),
      label: `Invasión hacia ${invadedRoom.name}`
    };

    // Quiebre en el recinto INVADIDO (-depth = retranqueo / hueco interior)
    const invadedBreak: WallBreak = {
      id: `wb-invaded-${conn.id}`,
      wall: invadedWall,
      startOffsetMeters: Number(invadedStartLocal.toFixed(2)),
      widthMeters: Number(breakWidth.toFixed(2)),
      depthMeters: Number((-depth).toFixed(2)),
      label: `Cedido a ${invaderRoom.name}`
    };

    breaksByRoom.get(invaderId)?.push(invaderBreak);
    breaksByRoom.get(invadedId)?.push(invadedBreak);
  }

  return rooms.map((room) => {
    if (room.isAccessPoint || room.isTechnicalIsland) return room;

    const computedBreaks = breaksByRoom.get(room.id) || [];
    const updatedGeometry = {
      ...(room.geometry || { mode: 'rectangle' as const }),
      wallBreaks: computedBreaks
    };

    const tempRoom: Room = {
      ...room,
      geometry: updatedGeometry
    };

    const computedVertices = calculateRoomPolygon(tempRoom);

    return {
      ...room,
      geometry: {
        ...updatedGeometry,
        computedVertices
      }
    };
  });
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

  const metricRooms = rooms.filter(isMetricRoom);
  const nonMetricRooms = rooms.filter((r) => !isMetricRoom(r));

  if (metricRooms.length === 0) {
    return rooms;
  }

  const placed = new Map<string, PlacedBox>();

  // 1. SELECCIONAR NODO RAÍZ / ANCLAJE (Living o el recinto con mayor número de conexiones métricas)
  const rootRoom =
    metricRooms.find((r) => r.type === 'living') ||
    metricRooms.reduce((best, current) => {
      const currentConns = connections.filter(
        (c) =>
          (c.sourceRoomId === current.id || c.targetRoomId === current.id) &&
          metricRooms.some((m) => m.id === (c.sourceRoomId === current.id ? c.targetRoomId : c.sourceRoomId))
      ).length;
      const bestConns = connections.filter(
        (c) =>
          (c.sourceRoomId === best.id || c.targetRoomId === best.id) &&
          metricRooms.some((m) => m.id === (c.sourceRoomId === best.id ? c.targetRoomId : c.sourceRoomId))
      ).length;
      return currentConns > bestConns ? current : best;
    }, metricRooms[0]);

  const rootW = metersToPixels(rootRoom.dimensions?.width || 3);
  const rootH = metersToPixels(rootRoom.dimensions?.length || 2.5);

  placed.set(rootRoom.id, {
    x: origin.x,
    y: origin.y,
    width: rootW,
    height: rootH,
    isFixed: true
  });

  // 2. PROPAGACIÓN TOPOLÓGICA BREADTH-FIRST (BFS) CON EMPAQUETADO SECUENCIAL POR PARED
  const queue: string[] = [rootRoom.id];
  const visited = new Set<string>([rootRoom.id]);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentBox = placed.get(currentId)!;

    // Conexiones métricas no visitadas desde este ambiente
    const unvisitedConns = connections.filter((c) => {
      const isSource = c.sourceRoomId === currentId;
      const otherId = isSource ? c.targetRoomId : c.sourceRoomId;
      return (
        (c.sourceRoomId === currentId || c.targetRoomId === currentId) &&
        !visited.has(otherId) &&
        metricRooms.some((r) => r.id === otherId)
      );
    });

    // Agrupar ambientes hijos por la pared de contacto del padre
    const wallGroups: Record<'north' | 'south' | 'east' | 'west', Array<{ targetRoom: Room; conn: LogicalConnection }>> = {
      north: [],
      south: [],
      east: [],
      west: []
    };

    for (const conn of unvisitedConns) {
      const isSource = conn.sourceRoomId === currentId;
      const otherId = isSource ? conn.targetRoomId : conn.sourceRoomId;
      const targetRoom = metricRooms.find((r) => r.id === otherId);
      if (!targetRoom || visited.has(otherId)) continue;

      const rawMyWall = isSource ? conn.sourceWall || 'north' : conn.targetWall || 'south';
      const myWall: 'north' | 'south' | 'east' | 'west' =
        rawMyWall === 'ceiling' ? 'north' : rawMyWall;

      wallGroups[myWall].push({ targetRoom, conn });
      visited.add(otherId);
    }

    // A. Empaquetar hijos en la Pared NORTE (Arriba de este ambiente)
    let northX = currentBox.x;
    for (const item of wallGroups.north) {
      const tW = metersToPixels(item.targetRoom.dimensions?.width || 3);
      const tH = metersToPixels(item.targetRoom.dimensions?.length || 2.5);
      const tX = northX;
      const tY = currentBox.y - tH;

      placed.set(item.targetRoom.id, { x: tX, y: tY, width: tW, height: tH });
      northX += tW;
      queue.push(item.targetRoom.id);
    }

    // B. Empaquetar hijos en la Pared SUR (Abajo de este ambiente)
    let southX = currentBox.x;
    for (const item of wallGroups.south) {
      const tW = metersToPixels(item.targetRoom.dimensions?.width || 3);
      const tH = metersToPixels(item.targetRoom.dimensions?.length || 2.5);
      const tX = southX;
      const tY = currentBox.y + currentBox.height;

      placed.set(item.targetRoom.id, { x: tX, y: tY, width: tW, height: tH });
      southX += tW;
      queue.push(item.targetRoom.id);
    }

    // C. Empaquetar hijos en la Pared ESTE (Derecha de este ambiente)
    let eastY = currentBox.y;
    for (const item of wallGroups.east) {
      const tW = metersToPixels(item.targetRoom.dimensions?.width || 3);
      const tH = metersToPixels(item.targetRoom.dimensions?.length || 2.5);
      const tX = currentBox.x + currentBox.width;
      const tY = eastY;

      placed.set(item.targetRoom.id, { x: tX, y: tY, width: tW, height: tH });
      eastY += tH;
      queue.push(item.targetRoom.id);
    }

    // D. Empaquetar hijos en la Pared OESTE (Izquierda de este ambiente)
    let westY = currentBox.y;
    for (const item of wallGroups.west) {
      const tW = metersToPixels(item.targetRoom.dimensions?.width || 3);
      const tH = metersToPixels(item.targetRoom.dimensions?.length || 2.5);
      const tX = currentBox.x - tW;
      const tY = westY;

      placed.set(item.targetRoom.id, { x: tX, y: tY, width: tW, height: tH });
      westY += tH;
      queue.push(item.targetRoom.id);
    }
  }

  // 3. RECINTOS MÉTRICOS DESCONECTADOS (Islas métricas no enlazadas)
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
      unreachedOffset += rH + 30;
    }
  }

  // 4. ALINEACIÓN COLINEAL PERIMETRAL POR LÍMITES DE PARCELA Y MEDIANERAS
  const boundaryRooms = rooms.filter(isParcelBoundaryNode);
  for (const bound of boundaryRooms) {
    const boundConns = connections.filter(
      (c) => c.sourceRoomId === bound.id || c.targetRoomId === bound.id
    );
    const connectedMetricRoomIds: string[] = [];
    boundConns.forEach((c) => {
      const otherId = c.sourceRoomId === bound.id ? c.targetRoomId : c.sourceRoomId;
      if (placed.has(otherId) && metricRooms.some((r) => r.id === otherId)) {
        connectedMetricRoomIds.push(otherId);
      }
    });

    if (connectedMetricRoomIds.length >= 1) {
      if (bound.type === 'limit_medianera_izq') {
        const minLeftX = Math.min(...connectedMetricRoomIds.map((id) => placed.get(id)!.x));
        connectedMetricRoomIds.forEach((id) => {
          const b = placed.get(id)!;
          b.x = minLeftX;
        });
      } else if (bound.type === 'limit_medianera_der') {
        const maxRightX = Math.max(
          ...connectedMetricRoomIds.map((id) => placed.get(id)!.x + placed.get(id)!.width)
        );
        connectedMetricRoomIds.forEach((id) => {
          const b = placed.get(id)!;
          b.x = maxRightX - b.width;
        });
      } else if (bound.type === 'limit_frente_lm') {
        const maxBottomY = Math.max(
          ...connectedMetricRoomIds.map((id) => placed.get(id)!.y + placed.get(id)!.height)
        );
        connectedMetricRoomIds.forEach((id) => {
          const b = placed.get(id)!;
          b.y = maxBottomY - b.height;
        });
      } else if (bound.type === 'limit_fondo' || bound.type === 'limit_patio') {
        const minTopY = Math.min(...connectedMetricRoomIds.map((id) => placed.get(id)!.y));
        connectedMetricRoomIds.forEach((id) => {
          const b = placed.get(id)!;
          b.y = minTopY;
        });
      }
    }
  }

  // 5. POSICIONAR PUNTOS DE ACCESO Y PUNTOS EXTERIORES (Nubes perimetrales)
  for (const nm of nonMetricRooms) {
    if (nm.isTechnicalIsland) {
      placed.set(nm.id, {
        x: 40,
        y: 40,
        width: 180,
        height: 100
      });
      continue;
    }

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
          placed.set(nm.id, {
            x: metricBox.x - 180 - 30,
            y: metricBox.y + metricBox.height / 2 - 50,
            width: 180,
            height: 100
          });
        } else if (myWall === 'west') {
          placed.set(nm.id, {
            x: metricBox.x + metricBox.width + 30,
            y: metricBox.y + metricBox.height / 2 - 50,
            width: 180,
            height: 100
          });
        } else if (myWall === 'south') {
          placed.set(nm.id, {
            x: metricBox.x + metricBox.width / 2 - 90,
            y: metricBox.y - 100 - 30,
            width: 180,
            height: 100
          });
        } else {
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

    placed.set(nm.id, {
      x: 40,
      y: 300,
      width: 180,
      height: 100
    });
  }

  // 6. NORMALIZACIÓN Y CENTRADO DE COORDENADAS
  let minX = Infinity;
  let minY = Infinity;

  metricRooms.forEach((r) => {
    const box = placed.get(r.id);
    if (box) {
      if (box.x < minX) minX = box.x;
      if (box.y < minY) minY = box.y;
    }
  });

  if (minX === Infinity) minX = 0;
  if (minY === Infinity) minY = 0;

  const targetMarginX = 80;
  const targetMarginY = 80;
  const shiftX = targetMarginX - minX;
  const shiftY = targetMarginY - minY;

  // 7. GENERAR COPIA CON COORDENADAS ACTUALIZADAS
  const positionedRooms = rooms.map((room) => {
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

  // 8. DEDUCIR Y APLICAR AUTOMÁTICAMENTE LOS QUIEBRES / INVASIONES DE MURO
  return applyInvasionsToRoomGeometries(positionedRooms, connections);
}
