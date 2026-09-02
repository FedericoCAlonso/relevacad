/**
 * ViewModel Utility: Survey Question Priority Engine
 * Motor de priorización heurística y simulación de reducción de incertidumbre
 * para el asistente de relevamiento incremental "Croquizador".
 */

import { Room, isMetricRoom } from '@/models/RoomModel';
import { LogicalConnection, getConnectionOpenings } from '@/models/GraphModel';
import {
  SurveyQuestion,
  SolverResult,
  SurveyCycle
} from '@/models/IncrementalSurveyModel';
import { solveGeometricConstraints } from './geometricConstraintSolver';

/**
 * Genera y clasifica la lista de preguntas faltantes por orden de mayor impacto
 * en la reducción del error residual geométrico del plano de planta.
 */
export function generatePrioritizedQuestions(
  rooms: Room[],
  connections: LogicalConnection[],
  currentSolverResult: SolverResult,
  acceptableThresholdMeters: number = 0.05
): SurveyQuestion[] {
  // Si el error de cierre y residual ya están dentro del umbral aceptable (±5cm), no se necesitan más preguntas
  if (currentSolverResult.isUnderAcceptableThreshold && currentSolverResult.maxCycleErrorMeters <= acceptableThresholdMeters) {
    return [];
  }

  const metricRooms = rooms.filter(isMetricRoom);
  const metricRoomIds = new Set(metricRooms.map((r) => r.id));
  const metricConns = connections.filter(
    (c) => metricRoomIds.has(c.sourceRoomId) && metricRoomIds.has(c.targetRoomId)
  );

  const questions: SurveyQuestion[] = [];
  const currentTotalResidual = currentSolverResult.totalResidualError;

  // Mapa de participación en ciclos por arista
  const cycleCountPerEdge = new Map<string, number>();
  const cycleCountPerRoom = new Map<string, number>();

  currentSolverResult.cycles.forEach((cycle: SurveyCycle) => {
    cycle.connectionIds.forEach((connId) => {
      cycleCountPerEdge.set(connId, (cycleCountPerEdge.get(connId) || 0) + 1);
    });
    cycle.roomIds.forEach((roomId) => {
      cycleCountPerRoom.set(roomId, (cycleCountPerRoom.get(roomId) || 0) + 1);
    });
  });

  // 1. CANDIDATOS: Aristas con abertura real (NO tabiques ciegos / pared común)
  for (const conn of metricConns) {
    const sourceRoom = rooms.find((r) => r.id === conn.sourceRoomId);
    const targetRoom = rooms.find((r) => r.id === conn.targetRoomId);
    if (!sourceRoom || !targetRoom) continue;

    // Si es una pared común ciega (sin aberturas), no se le pregunta por ancho de abertura
    if (conn.type === 'pared_comun') continue;

    const openings = getConnectionOpenings(conn);
    if (openings.length === 0) continue;

    const firstOp = openings[0];
    const isConfirmed = Boolean(firstOp && firstOp.widthMeters > 0 && firstOp.widthMeters !== 0.8);
    const cyclesCount = cycleCountPerEdge.get(conn.id) || 0;
    const residualError = currentSolverResult.edgeResiduals.get(conn.id) || 0;

    // Si no está confirmada, o tiene un error residual apreciable
    if (!isConfirmed || residualError > acceptableThresholdMeters) {
      const sourceDegree = metricConns.filter((c) => c.sourceRoomId === sourceRoom.id || c.targetRoomId === sourceRoom.id).length;
      const targetDegree = metricConns.filter((c) => c.sourceRoomId === targetRoom.id || c.targetRoomId === targetRoom.id).length;
      const connectsToHub = sourceDegree >= 3 || targetDegree >= 3;

      // Simulación de reducción de error: si confirmamos esta arista
      const simulatedConns = connections.map((c) =>
        c.id === conn.id
          ? {
              ...c,
              opening: {
                openingType: c.type,
                widthMeters: c.opening?.widthMeters || 1.2,
                heightMeters: 2.05,
                sillHeightMeters: 0,
                swingDirection: 'right' as const
              }
            }
          : c
      );

      const simulatedResult = solveGeometricConstraints(rooms, simulatedConns, {
        acceptableErrorThresholdMeters: acceptableThresholdMeters
      });

      const residualReduction = Math.max(0, currentTotalResidual - simulatedResult.totalResidualError);

      // Ponderación de Score de Prioridad:
      // Ciclos (peso 40) + Reducción Residual (peso 35) + Hubs (peso 15) + Magnitud Error (peso 10)
      let score = 0;
      score += cyclesCount * 40;
      score += residualReduction * 35;
      score += (connectsToHub ? 15 : 0);
      score += residualError * 20;

      let rationale = 'Define el contacto directo entre ambientes';
      if (cyclesCount > 0) {
        rationale = `Cierra el ciclo geométrico entre ${sourceRoom.name} y ${targetRoom.name} (reduce desfasaje)`;
      } else if (connectsToHub) {
        rationale = `Nodo principal (${sourceRoom.name}) distribuye medidas a múltiples recintos`;
      }

      const defaultVal = firstOp?.widthMeters || conn.opening?.widthMeters || 0.9;

      questions.push({
        id: `q-edge-${conn.id}`,
        targetType: 'edge_measure',
        targetId: conn.id,
        sourceRoomName: sourceRoom.name,
        targetRoomName: targetRoom.name,
        title: `${sourceRoom.name} – ${targetRoom.name}`,
        promptText: `¿Cuánto mide el tramo de ${conn.label || 'contacto'} entre ambos?`,
        currentEstimatedValue: defaultVal,
        unit: 'm',
        quickPresets: [0.8, 0.9, 1.0, 1.4, 2.0, 2.5, 3.0],
        priorityScore: Math.round(score * 10) / 10,
        simulatedResidualReduction: residualReduction,
        participatesInCyclesCount: cyclesCount,
        connectsToHub,
        rationale
      });
    }
  }

  // 2. CANDIDATOS: Dimensiones de ambientes con cotas no bloqueadas / estimadas
  for (const room of metricRooms) {
    const isWConfirmed = room.dimensions.widthLocked ?? false;
    const isLConfirmed = room.dimensions.lengthLocked ?? false;
    const cyclesCount = cycleCountPerRoom.get(room.id) || 0;
    const degree = metricConns.filter((c) => c.sourceRoomId === room.id || c.targetRoomId === room.id).length;

    if (!isWConfirmed) {
      let score = 25 + cyclesCount * 30 + (degree >= 3 ? 15 : 0);
      questions.push({
        id: `q-room-w-${room.id}`,
        targetType: 'room_width',
        targetId: room.id,
        sourceRoomName: room.name,
        title: `${room.name} (Ancho Este-Oeste)`,
        promptText: `¿Cuál es el ancho real del ambiente?`,
        currentEstimatedValue: room.dimensions.width || 3.0,
        unit: 'm',
        quickPresets: [2.0, 2.5, 3.0, 3.5, 4.0, 4.5],
        priorityScore: Math.round(score * 10) / 10,
        simulatedResidualReduction: 0.1,
        participatesInCyclesCount: cyclesCount,
        connectsToHub: degree >= 3,
        rationale: `Fija el ancho estructural de ${room.name}`
      });
    }

    if (!isLConfirmed) {
      let score = 25 + cyclesCount * 30 + (degree >= 3 ? 15 : 0);
      questions.push({
        id: `q-room-l-${room.id}`,
        targetType: 'room_length',
        targetId: room.id,
        sourceRoomName: room.name,
        title: `${room.name} (Largo Norte-Sur)`,
        promptText: `¿Cuál es el largo real del ambiente?`,
        currentEstimatedValue: room.dimensions.length || 2.5,
        unit: 'm',
        quickPresets: [1.8, 2.2, 2.8, 3.2, 3.8, 4.2],
        priorityScore: Math.round(score * 10) / 10,
        simulatedResidualReduction: 0.1,
        participatesInCyclesCount: cyclesCount,
        connectsToHub: degree >= 3,
        rationale: `Fija el largo estructural de ${room.name}`
      });
    }
  }

  // Ordenar de mayor a menor impacto / score de prioridad
  return questions.sort((a, b) => b.priorityScore - a.priorityScore);
}
