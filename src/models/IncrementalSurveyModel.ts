/**
 * Model: IncrementalSurveyModel
 * Estructuras de datos para el Solver de Mínimos Cuadrados y el Asistente
 * de Relevamiento Incremental para "Croquizador":
 * - Tracking de estado: 'confirmed' (medida real de usuario) vs 'estimated' (default del solver)
 * - Detección de ciclos y error de cierre topológico
 * - Preguntas interactivas priorizadas por reducción de incertidumbre geométrica
 */

import { WallOrientation } from './RoomModel';
import { LogicalConnectionType } from './GraphModel';

export type MeasurementStatus = 'confirmed' | 'estimated' | 'inferred';

export interface SurveyMetricNode {
  roomId: string;
  name: string;
  roomType: string;
  widthMeters: number;
  widthStatus: MeasurementStatus;
  lengthMeters: number;
  lengthStatus: MeasurementStatus;
  heightMeters: number;
  heightStatus: MeasurementStatus;
  degree: number;      // Cantidad de conexiones (hubs tienen mayor centralidad)
  isHub: boolean;      // Nodos con >= 3 conexiones
  isAccessPoint?: boolean;
  isTechnicalIsland?: boolean;
}

export interface SurveyMetricEdge {
  connectionId: string;
  sourceRoomId: string;
  targetRoomId: string;
  sourceWall: WallOrientation;
  targetWall: WallOrientation;
  type: LogicalConnectionType;
  label: string;
  
  // Medida del tramo compartido / abertura
  measuredLengthMeters?: number;
  status: MeasurementStatus;
  weight: number;      // Peso en el solver (ej: 50.0 para confirmed, 1.0 para estimated)
  
  // Métricas de Incertidumbre y Cierre
  residualErrorMeters: number;
  isInCycle: boolean;
  cycleIds: string[];
}

export interface SurveyCycle {
  id: string;
  roomIds: string[];
  connectionIds: string[];
  loopClosureErrorX: number; // Error residual en eje X (m)
  loopClosureErrorY: number; // Error residual en eje Y (m)
  closureMagnitudeMeters: number; // ||Error|| en metros
  hasUnconfirmedEdges: boolean;
}

export interface SurveyQuestion {
  id: string;
  targetType: 'edge_measure' | 'room_width' | 'room_length';
  targetId: string; // connectionId o roomId
  sourceRoomName: string;
  targetRoomName?: string;
  title: string;
  promptText: string;
  currentEstimatedValue: number;
  unit: string;
  quickPresets: number[];
  
  // Criterios de Priorización
  priorityScore: number;
  simulatedResidualReduction: number;
  participatesInCyclesCount: number;
  connectsToHub: boolean;
  rationale: string;
}

export interface SolverResult {
  positions: Map<string, { x: number; y: number }>;
  dimensions: Map<string, { width: number; length: number }>;
  nodeStatus: Map<string, { widthStatus: MeasurementStatus; lengthStatus: MeasurementStatus }>;
  edgeResiduals: Map<string, number>;
  cycles: SurveyCycle[];
  totalResidualError: number;     // Error residual total sum(w * r^2)
  maxCycleErrorMeters: number;    // Error máximo de cierre de ciclos (m)
  isUnderAcceptableThreshold: boolean; // True si maxCycleError <= umbral (ej: 0.05m)
  activeQuestions: SurveyQuestion[];
}
