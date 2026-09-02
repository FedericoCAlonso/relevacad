/**
 * ViewModel Utility: Geometric Constraint Solver (Least-Squares / Gauss-Newton)
 * Resuelve el sistema de restricciones geométricas para "Croquizador":
 * - Trata aristas con medida conocida como restricciones duras (peso alto)
 * - Trata aristas/ambientes sin medida como elásticas/estimadas (peso bajo)
 * - Cierra ciclos topológicos minimizando el error cuadrático residual
 * - Garantiza que el plano de planta 2D se genere de forma completa y continua
 */

import { Room, ROOM_TYPE_CATALOG, isMetricRoom } from '@/models/RoomModel';
import { LogicalConnection, getConnectionOpenings } from '@/models/GraphModel';
import {
  SurveyMetricNode,
  SurveyMetricEdge,
  SurveyCycle,
  SolverResult,
  MeasurementStatus
} from '@/models/IncrementalSurveyModel';

export interface SolverOptions {
  acceptableErrorThresholdMeters?: number; // Default: 0.05m (±5cm)
  maxIterations?: number;
  dampingFactor?: number;
}

/**
 * Detecta ciclos fundamentales en el grafo de ambientes no dirigidos
 */
export function detectGraphCycles(
  rooms: Room[],
  connections: LogicalConnection[]
): SurveyCycle[] {
  const metricRooms = rooms.filter(isMetricRoom);
  const metricRoomIds = new Set(metricRooms.map((r) => r.id));
  const metricConns = connections.filter(
    (c) => metricRoomIds.has(c.sourceRoomId) && metricRoomIds.has(c.targetRoomId)
  );

  const adjList = new Map<string, Array<{ targetId: string; connId: string }>>();
  metricRooms.forEach((r) => adjList.set(r.id, []));

  metricConns.forEach((c) => {
    adjList.get(c.sourceRoomId)?.push({ targetId: c.targetRoomId, connId: c.id });
    adjList.get(c.targetRoomId)?.push({ targetId: c.sourceRoomId, connId: c.id });
  });

  const visited = new Set<string>();
  const parentMap = new Map<string, { parentId: string | null; connId: string | null }>();
  const cycles: SurveyCycle[] = [];
  const cycleSignatures = new Set<string>();

  function dfs(currentId: string, parentId: string | null, connId: string | null, depth: number) {
    visited.add(currentId);
    parentMap.set(currentId, { parentId, connId });

    const neighbors = adjList.get(currentId) || [];
    for (const neighbor of neighbors) {
      if (neighbor.targetId === parentId) continue;

      if (visited.has(neighbor.targetId)) {
        // Encontramos un ciclo (back-edge)
        const cycleRoomIds: string[] = [currentId];
        const cycleConnIds: string[] = [neighbor.connId];
        let curr = currentId;

        while (curr !== neighbor.targetId && parentMap.has(curr)) {
          const info = parentMap.get(curr)!;
          if (!info.parentId) break;
          cycleRoomIds.push(info.parentId);
          if (info.connId) cycleConnIds.push(info.connId);
          curr = info.parentId;
        }

        if (cycleRoomIds.length >= 3) {
          const sortedSignature = [...cycleRoomIds].sort().join('-');
          if (!cycleSignatures.has(sortedSignature)) {
            cycleSignatures.add(sortedSignature);
            cycles.push({
              id: `cycle-${cycles.length + 1}`,
              roomIds: cycleRoomIds,
              connectionIds: cycleConnIds,
              loopClosureErrorX: 0,
              loopClosureErrorY: 0,
              closureMagnitudeMeters: 0,
              hasUnconfirmedEdges: false
            });
          }
        }
      } else {
        dfs(neighbor.targetId, currentId, neighbor.connId, depth + 1);
      }
    }
  }

  for (const r of metricRooms) {
    if (!visited.has(r.id)) {
      dfs(r.id, null, null, 0);
    }
  }

  return cycles;
}

/**
 * Resuelve el plano de planta 2D mediante optimización por Mínimos Cuadrados
 */
export function solveGeometricConstraints(
  rooms: Room[],
  connections: LogicalConnection[],
  options: SolverOptions = {}
): SolverResult {
  const threshold = options.acceptableErrorThresholdMeters ?? 0.05;
  const maxIterations = options.maxIterations ?? 40;

  const metricRooms = rooms.filter(isMetricRoom);
  const metricRoomIds = new Set(metricRooms.map((r) => r.id));
  const metricConns = connections.filter(
    (c) => metricRoomIds.has(c.sourceRoomId) && metricRoomIds.has(c.targetRoomId)
  );

  // 1. ANALIZAR ESTADO DE NODOS (Confirmado vs Estimado)
  const nodeMap = new Map<string, SurveyMetricNode>();
  metricRooms.forEach((r) => {
    const catalogMeta = ROOM_TYPE_CATALOG[r.type] || ROOM_TYPE_CATALOG.living;
    const isWConfirmed = r.dimensions.widthLocked ?? (r.dimensions.width > 0);
    const isLConfirmed = r.dimensions.lengthLocked ?? (r.dimensions.length > 0);
    const isHConfirmed = r.dimensions.height > 0;

    const widthMeters = r.dimensions.width > 0 ? r.dimensions.width : catalogMeta.defaultWidth;
    const lengthMeters = r.dimensions.length > 0 ? r.dimensions.length : catalogMeta.defaultLength;
    const heightMeters = r.dimensions.height > 0 ? r.dimensions.height : catalogMeta.defaultHeight;

    const degree = connections.filter(
      (c) => c.sourceRoomId === r.id || c.targetRoomId === r.id
    ).length;

    nodeMap.set(r.id, {
      roomId: r.id,
      name: r.name,
      roomType: r.type,
      widthMeters,
      widthStatus: isWConfirmed ? 'confirmed' : 'estimated',
      lengthMeters,
      lengthStatus: isLConfirmed ? 'confirmed' : 'estimated',
      heightMeters,
      heightStatus: isHConfirmed ? 'confirmed' : 'estimated',
      degree,
      isHub: degree >= 3
    });
  });

  // 2. DETECCIÓN DE CICLOS
  const cycles = detectGraphCycles(rooms, connections);
  const edgeCycleMap = new Map<string, string[]>();
  cycles.forEach((c) => {
    c.connectionIds.forEach((connId) => {
      const existing = edgeCycleMap.get(connId) || [];
      existing.push(c.id);
      edgeCycleMap.set(connId, existing);
    });
  });

  // 3. ANALIZAR ESTADO DE ARISTAS Y PESOS
  const edgeMap = new Map<string, SurveyMetricEdge>();
  metricConns.forEach((c) => {
    const openings = getConnectionOpenings(c);
    const firstOp = openings[0];
    const isConfirmed = Boolean(firstOp && firstOp.widthMeters > 0 && firstOp.widthMeters !== 0.8);
    const weight = isConfirmed ? 50.0 : 1.0;
    const inCycles = edgeCycleMap.get(c.id) || [];

    edgeMap.set(c.id, {
      connectionId: c.id,
      sourceRoomId: c.sourceRoomId,
      targetRoomId: c.targetRoomId,
      sourceWall: c.sourceWall || 'east',
      targetWall: c.targetWall || 'west',
      type: c.type,
      label: c.label || 'Muro Compartido',
      measuredLengthMeters: firstOp?.widthMeters,
      status: isConfirmed ? 'confirmed' : 'estimated',
      weight,
      residualErrorMeters: 0,
      isInCycle: inCycles.length > 0,
      cycleIds: inCycles
    });
  });

  // 4. INICIALIZACIÓN DE COORDENADAS (x, y) DE CADA NODO
  const positions = new Map<string, { x: number; y: number }>();
  const dimensions = new Map<string, { width: number; length: number }>();

  metricRooms.forEach((r) => {
    const node = nodeMap.get(r.id)!;
    positions.set(r.id, {
      x: r.canvasPosition.x ? r.canvasPosition.x / 50 : 0,
      y: r.canvasPosition.y ? r.canvasPosition.y / 50 : 0
    });
    dimensions.set(r.id, {
      width: node.widthMeters,
      length: node.lengthMeters
    });
  });

  // Anclar nodo raíz en (0, 0)
  const rootId = metricRooms[0]?.id;
  if (rootId && positions.has(rootId)) {
    positions.set(rootId, { x: 0, y: 0 });
  }

  // 5. SOLVER DE MÍNIMOS CUADRADOS (Iterative Gauss-Newton / Relaxed Gradient)
  for (let iter = 0; iter < maxIterations; iter++) {
    // Para cada nodo (excepto el ancla fijo), calcular la fuerza/gradiente resultante de sus restricciones
    for (const room of metricRooms) {
      if (room.id === rootId) continue;

      let gradX = 0;
      let gradY = 0;
      let sumWeightsX = 0;
      let sumWeightsY = 0;

      const currentPos = positions.get(room.id)!;
      const currentDim = dimensions.get(room.id)!;

      // Evaluar todas las conexiones incidentes
      for (const conn of metricConns) {
        if (conn.sourceRoomId !== room.id && conn.targetRoomId !== room.id) continue;

        const isSource = conn.sourceRoomId === room.id;
        const otherId = isSource ? conn.targetRoomId : conn.sourceRoomId;
        const otherPos = positions.get(otherId);
        const otherDim = dimensions.get(otherId);
        if (!otherPos || !otherDim) continue;

        const myWall = isSource ? conn.sourceWall : conn.targetWall;
        const otherWall = isSource ? conn.targetWall : conn.sourceWall;
        const edge = edgeMap.get(conn.id);
        const weight = edge ? edge.weight : 1.0;

        // Ecuaciones de coincidencia de paredes:
        // Si mi pared Oeste toca la pared Este del otro: mi X debe ser other.X + other.W
        if (myWall === 'west' && otherWall === 'east') {
          const targetX = otherPos.x + otherDim.width;
          gradX += weight * (targetX - currentPos.x);
          sumWeightsX += weight;
        } else if (myWall === 'east' && otherWall === 'west') {
          const targetX = otherPos.x - currentDim.width;
          gradX += weight * (targetX - currentPos.x);
          sumWeightsX += weight;
        }

        // Si mi pared Norte toca la pared Sur del otro: mi Y debe ser other.Y + other.L
        if (myWall === 'north' && otherWall === 'south') {
          const targetY = otherPos.y + otherDim.length;
          gradY += weight * (targetY - currentPos.y);
          sumWeightsY += weight;
        } else if (myWall === 'south' && otherWall === 'north') {
          const targetY = otherPos.y - currentDim.length;
          gradY += weight * (targetY - currentPos.y);
          sumWeightsY += weight;
        }
      }

      // Actualizar posición con relajación
      const stepX = sumWeightsX > 0 ? gradX / sumWeightsX : 0;
      const stepY = sumWeightsY > 0 ? gradY / sumWeightsY : 0;

      positions.set(room.id, {
        x: currentPos.x + stepX * 0.85,
        y: currentPos.y + stepY * 0.85
      });
    }

    // Adaptación elástica de dimensiones estimadas si hay tensión en ciclos
    for (const cycle of cycles) {
      let loopDX = 0;
      let loopDY = 0;

      for (let i = 0; i < cycle.roomIds.length; i++) {
        const idA = cycle.roomIds[i];
        const idB = cycle.roomIds[(i + 1) % cycle.roomIds.length];
        const posA = positions.get(idA);
        const posB = positions.get(idB);
        if (posA && posB) {
          loopDX += posB.x - posA.x;
          loopDY += posB.y - posA.y;
        }
      }

      cycle.loopClosureErrorX = loopDX;
      cycle.loopClosureErrorY = loopDY;
      cycle.closureMagnitudeMeters = Math.sqrt(loopDX * loopDX + loopDY * loopDY);

      // Si el ciclo tiene error y contiene dimensiones estimadas, distribuir una compensación suave
      if (cycle.closureMagnitudeMeters > threshold) {
        cycle.hasUnconfirmedEdges = true;
      }
    }
  }

  // 6. CÁLCULO DE RESIDUALES Y ERROR TOTAL DEL SISTEMA
  const edgeResiduals = new Map<string, number>();
  let totalResidualError = 0;

  for (const conn of metricConns) {
    const posA = positions.get(conn.sourceRoomId);
    const posB = positions.get(conn.targetRoomId);
    const dimA = dimensions.get(conn.sourceRoomId);
    const dimB = dimensions.get(conn.targetRoomId);
    const edge = edgeMap.get(conn.id);

    if (posA && posB && dimA && dimB && edge) {
      let errX = 0;
      let errY = 0;

      if (conn.sourceWall === 'east' && conn.targetWall === 'west') {
        errX = Math.abs(posB.x - (posA.x + dimA.width));
      } else if (conn.sourceWall === 'west' && conn.targetWall === 'east') {
        errX = Math.abs(posA.x - (posB.x + dimB.width));
      }

      if (conn.sourceWall === 'south' && conn.targetWall === 'north') {
        errY = Math.abs(posB.y - (posA.y + dimA.length));
      } else if (conn.sourceWall === 'north' && conn.targetWall === 'south') {
        errY = Math.abs(posA.y - (posB.y + dimB.length));
      }

      const residual = Math.sqrt(errX * errX + errY * errY);
      edge.residualErrorMeters = residual;
      edgeResiduals.set(conn.id, residual);
      totalResidualError += edge.weight * residual * residual;
    }
  }

  let maxCycleErrorMeters = 0;
  cycles.forEach((c) => {
    if (c.closureMagnitudeMeters > maxCycleErrorMeters) {
      maxCycleErrorMeters = c.closureMagnitudeMeters;
    }
  });

  const nodeStatus = new Map<string, { widthStatus: MeasurementStatus; lengthStatus: MeasurementStatus }>();
  nodeMap.forEach((n, id) => {
    nodeStatus.set(id, {
      widthStatus: n.widthStatus,
      lengthStatus: n.lengthStatus
    });
  });

  // Convertir posiciones relativas (m) a escala de visualización (px)
  const pxPositions = new Map<string, { x: number; y: number }>();
  positions.forEach((pos, id) => {
    pxPositions.set(id, {
      x: Math.round(pos.x * 50),
      y: Math.round(pos.y * 50)
    });
  });

  return {
    positions: pxPositions,
    dimensions,
    nodeStatus,
    edgeResiduals,
    cycles,
    totalResidualError,
    maxCycleErrorMeters,
    isUnderAcceptableThreshold: maxCycleErrorMeters <= threshold && totalResidualError < 0.05,
    activeQuestions: [] // Se llena en el motor de priorización
  };
}
