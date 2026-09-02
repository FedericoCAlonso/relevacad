/**
 * ViewModel: SurveyStore (Zustand Global State)
 * Administra el estado global del relevamiento:
 * - Departamento tipo 3 ambientes (~61.6 m²)
 * - Grado de Electrificación Medio según norma AEA 90364-771
 * - TSG ubicado en Cocina
 * - Espesor de muros perimetrales e interiores (default 10cm, editable)
 * - Dimensiones netas tomadas desde el interior de los ambientes
 * - Canalizaciones / Cañerías con soporte multicircuito, retornos y cálculo de ocupación AEA
 */

import { create } from 'zustand';
import { Room, ElectricalAsset, WallOrientation, WallBreak, ROOM_TYPE_CATALOG, isMetricRoom } from '@/models/RoomModel';
import {
  LogicalConnection,
  LogicalConnectionType,
  CONNECTION_TYPE_CATALOG,
  TabiqueMaterialType,
  SharedWallProperties,
  OpeningProperties,
  TABIQUE_MATERIAL_CATALOG,
  getConnectionOpenings,
  WallInvasion
} from '@/models/GraphModel';
import {
  NodoElectrico,
  TramoElectrico,
  ConductorLine,
  TIPO_NODO_ELECTRICO_CATALOG
} from '@/models/ElectricalGraphModel';
import { SnapGuideLine } from './utils/snappingCalculator';
import { solveAutoAssembly, applyInvasionsToRoomGeometries } from './utils/autoAssemblySolver';
import { metersToPixels, PIXELS_PER_METER } from './utils/geometryUtils';
import { SurveyQuestion } from '@/models/IncrementalSurveyModel';
import { RelevamientoProyecto, Cliente, RumboCardinal } from '@/models/ProjectModel';
import { saveProject, getProjectById, autoSaveActiveSession } from '@/db/database';
import { downloadCotizadorIebaJSON } from '@/db/exportCotizadorIeba';

export type SurveyPhase =
  | 'architecture'
  | 'electrical'
  | 'presentation'
  | 'topology'
  | 'parametrization'
  | 'assembly';
export type TopologyLayerMode = 'architectural' | 'electrical' | 'unified';

export interface SurveyState {
  // Estado del Modelo Arquitectónico
  rooms: Room[];
  connections: LogicalConnection[];
  selectedRoomId: string | null;
  selectedConnectionId: string | null;
  activePhase: SurveyPhase;

  // Parámetros Constructivos
  wallThicknessMeters: number; // Espesor de muros por defecto (default 0.10m = 10cm)

  // Asistente de Relevamiento Incremental
  acceptableErrorThresholdMeters: number; // Umbral de tolerancia de error (default: 0.05m = 5cm)
  isAssistantOpen: boolean;

  // Estado del Modelo Eléctrico (Traza)
  electricalNodes: NodoElectrico[];
  electricalTramos: TramoElectrico[];
  selectedElectricalNodeId: string | null;
  selectedTramoId: string | null;
  topologyLayer: TopologyLayerMode;

  // Estado de Visualización y Canvas 2D
  isSnapEnabled: boolean;
  snapThreshold: number;
  activeSnapGuides: SnapGuideLine[];
  zoom: number;

  // Métodos de Fases y Capas
  setActivePhase: (phase: SurveyPhase) => void;
  setTopologyLayer: (layer: TopologyLayerMode) => void;
  setWallThickness: (thickness: number) => void;
  selectRoom: (roomId: string | null) => void;
  selectConnection: (connectionId: string | null) => void;
  selectElectricalNode: (nodeId: string | null) => void;
  selectTramo: (tramoId: string | null) => void;

  // Operaciones sobre Ambientes, Ingresos e Islas Técnicas
  addRoom: (roomData: Partial<Room> & { name: string; type?: Room['type'] }) => Room;
  updateRoom: (roomId: string, updates: Partial<Omit<Room, 'id'>>) => void;
  removeRoom: (roomId: string) => void;
  updateRoomTopologyPosition: (roomId: string, position: { x: number; y: number }) => void;

  // Operaciones sobre Conexiones / Muros Compartidos y Aberturas
  connectRooms: (
    sourceRoomId: string,
    targetRoomId: string,
    type?: LogicalConnectionType,
    label?: string,
    sourceHandle?: string,
    targetHandle?: string,
    wallProperties?: Partial<SharedWallProperties>
  ) => LogicalConnection | null;
  updateConnection: (connectionId: string, updates: Partial<LogicalConnection>) => void;
  removeConnection: (connectionId: string) => void;
  addOpeningToConnection: (connectionId: string, opening: OpeningProperties) => void;
  updateOpeningInConnection: (connectionId: string, openingIndex: number, updates: Partial<OpeningProperties>) => void;
  removeOpeningFromConnection: (connectionId: string, openingIndex: number) => void;
  updateConnectionWallProperties: (connectionId: string, wallProps: Partial<SharedWallProperties>) => void;

  // Operaciones sobre Grafo Eléctrico (Nodos y Tramos)
  addNodoElectrico: (nodo: Omit<NodoElectrico, 'id'>) => NodoElectrico;
  updateNodoElectrico: (nodoId: string, updates: Partial<NodoElectrico>) => void;
  removeNodoElectrico: (nodoId: string) => void;
  connectNodosElectricos: (
    sourceNodeId: string,
    targetNodeId: string,
    tramoData?: Partial<TramoElectrico>
  ) => TramoElectrico | null;
  updateTramoElectrico: (tramoId: string, updates: Partial<TramoElectrico>) => void;
  removeTramoElectrico: (tramoId: string) => void;

  // Operaciones sobre Conductores Alojados en Cañería
  addConductorToTramo: (tramoId: string, conductor: Omit<ConductorLine, 'id'>) => ConductorLine | null;
  updateConductorInTramo: (tramoId: string, conductorId: string, updates: Partial<ConductorLine>) => void;
  removeConductorFromTramo: (tramoId: string, conductorId: string) => void;

  // Operaciones sobre Elementos Eléctricos (Parametrización de Paredes)
  addElectricalAsset: (roomId: string, asset: Omit<ElectricalAsset, 'id'>) => ElectricalAsset | null;
  updateElectricalAsset: (roomId: string, assetId: string, updates: Partial<ElectricalAsset>) => void;
  removeElectricalAsset: (roomId: string, assetId: string) => void;

  // Operaciones sobre Modificadores de Pared (Quiebres en Z, Nichos, Columnas)
  addWallBreak: (roomId: string, wallBreak: Omit<WallBreak, 'id'>) => WallBreak | null;
  updateWallBreak: (roomId: string, breakId: string, updates: Partial<WallBreak>) => void;
  removeWallBreak: (roomId: string, breakId: string) => void;
  toggleDimensionLock: (roomId: string, dimension: 'width' | 'length') => void;
  inferDimension: (roomId: string, dimension: 'width' | 'length', inferredValue: number) => void;

  // Operaciones sobre el Canvas 2D (Arquitectura / Ensamblaje)
  updateRoomCanvasPosition: (roomId: string, position: { x: number; y: number }) => void;
  syncRoomWallAdjacencies: (movedRoomId: string) => void;
  getOrCreateWallConnection: (roomId: string, wall: WallOrientation) => LogicalConnection;
  autoAssembleRooms: () => void;
  setSnapGuides: (guides: SnapGuideLine[]) => void;
  toggleSnap: (enabled?: boolean) => void;

  // Asistente de Relevamiento Incremental
  setAcceptableErrorThreshold: (thresholdMeters: number) => void;
  toggleAssistantOpen: (open?: boolean) => void;
  answerIncrementalQuestion: (question: SurveyQuestion, value: number) => void;

  // Gestión de Proyecto y Cliente (Compatibilidad 1:1 Cotizador IEBA)
  currentProjectId: string;
  currentProjectName: string;
  clienteInfo: Cliente;
  ubicacionObra: string;
  descripcionObra: string;
  rumboFrente: RumboCardinal;
  azimutGrados: number;
  isAutoSaving: boolean;
  lastSavedAt: string | null;

  setProjectMetadata: (meta: { nombre?: string; ubicacion?: string; descripcion?: string; rumboFrente?: RumboCardinal; azimutGrados?: number }) => void;
  setClienteInfo: (cliente: Partial<Cliente>) => void;
  saveCurrentProjectToDB: () => Promise<string>;
  loadProjectFromDB: (projectId: string) => Promise<void>;
  createNewProject: (nombre?: string, clienteNombre?: string) => void;
  exportProjectToCotizadorJSON: () => void;

  // Utilidades
  loadSampleData: () => void;
  resetProject: () => void;
}

/// =============================================================================
// DATOS DE DEMOSTRACIÓN: DEPARTAMENTO CON MEDIANERAS Y PATIO
// =============================================================================

const INITIAL_ROOMS: Room[] = [
  {
    id: 'entry-1788362570545',
    name: 'Palier Común (Edificio)',
    type: 'access_palier',
    nodeCategory: 'access',
    tipoCubierta: 'cubierto',
    isTechnicalIsland: false,
    isAccessPoint: true,
    isCommonArea: true,
    dimensions: {
      width: 2.5,
      length: 2.5,
      height: 0
    },
    canvasPosition: {
      x: 85,
      y: -50
    },
    topologyPosition: {
      x: 40,
      y: 300
    },
    color: '#d1fae5',
    electricalAssets: [],
    createdAt: '2026-09-02T15:22:50.545Z',
    updatedAt: '2026-09-02T15:30:43.019Z'
  },
  {
    id: 'room-1788362611903',
    name: 'Living comedor',
    type: 'living',
    nodeCategory: 'room',
    tipoCubierta: 'cubierto',
    isTechnicalIsland: false,
    isAccessPoint: false,
    dimensions: {
      width: 3.8,
      length: 10,
      height: 2.6
    },
    canvasPosition: {
      x: 80,
      y: 80
    },
    topologyPosition: {
      x: 380,
      y: 100
    },
    color: '#e3f2fd',
    electricalAssets: [],
    createdAt: '2026-09-02T15:23:31.903Z',
    updatedAt: '2026-09-02T15:30:43.019Z',
    geometry: {
      mode: 'rectangle',
      wallBreaks: [],
      computedVertices: [
        { x: 0, y: 0 },
        { x: 3.8, y: 0 },
        { x: 3.8, y: 10 },
        { x: 0, y: 10 }
      ]
    }
  },
  {
    id: 'room-1788362682624',
    name: 'Cocina',
    type: 'kitchen',
    nodeCategory: 'room',
    tipoCubierta: 'cubierto',
    isTechnicalIsland: false,
    isAccessPoint: false,
    dimensions: {
      width: 3.8,
      length: 3.8,
      height: 2.6
    },
    canvasPosition: {
      x: 275,
      y: 80
    },
    topologyPosition: {
      x: 720,
      y: 100
    },
    color: '#fff3e0',
    electricalAssets: [],
    createdAt: '2026-09-02T15:24:42.624Z',
    updatedAt: '2026-09-02T15:30:43.019Z',
    geometry: {
      mode: 'rectangle',
      wallBreaks: [
        {
          id: 'wb-invaded-conn-1788362808140',
          wall: 'south',
          startOffsetMeters: 1.8,
          widthMeters: 2,
          depthMeters: -1,
          label: 'Cedido a Baño'
        }
      ],
      computedVertices: [
        { x: 0, y: 0 },
        { x: 3.8, y: 0 },
        { x: 3.8, y: 3.8 },
        { x: 2, y: 3.8 },
        { x: 2, y: 2.8 },
        { x: 0, y: 2.8 },
        { x: 0, y: 3.8 }
      ]
    }
  },
  {
    id: 'bound-1788362731158',
    name: 'Patio de Aire y Luz',
    type: 'limit_patio',
    nodeCategory: 'parcel_boundary',
    tipoCubierta: 'descubierto',
    isTechnicalIsland: false,
    isAccessPoint: false,
    isParcelBoundary: true,
    boundaryProperties: {
      materialType: 'ladrillo_hueco_18',
      thicknessMeters: 0.2,
      boundaryCondition: 'patio_luz'
    },
    isCommonArea: true,
    dimensions: {
      width: 0,
      length: 0,
      height: 0
    },
    canvasPosition: {
      x: 275,
      y: -50
    },
    topologyPosition: {
      x: 1060,
      y: 100
    },
    color: '#f0fdf4',
    electricalAssets: [],
    createdAt: '2026-09-02T15:25:31.158Z',
    updatedAt: '2026-09-02T15:30:43.019Z',
    geometry: {
      mode: 'rectangle',
      wallBreaks: [],
      computedVertices: [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 2.5 },
        { x: 0, y: 2.5 }
      ]
    }
  },
  {
    id: 'room-1788362774104',
    name: 'Circulación / Pasillo',
    type: 'hall',
    nodeCategory: 'room',
    tipoCubierta: 'cubierto',
    isTechnicalIsland: false,
    isAccessPoint: false,
    dimensions: {
      width: 1.5,
      length: 1.5,
      height: 2.6
    },
    canvasPosition: {
      x: 275,
      y: 275
    },
    topologyPosition: {
      x: 380,
      y: 340
    },
    color: '#eceff1',
    electricalAssets: [],
    createdAt: '2026-09-02T15:26:14.104Z',
    updatedAt: '2026-09-02T15:30:43.019Z',
    geometry: {
      mode: 'rectangle',
      wallBreaks: [],
      computedVertices: [
        { x: 0, y: 0 },
        { x: 1.5, y: 0 },
        { x: 1.5, y: 1.5 },
        { x: 0, y: 1.5 }
      ]
    }
  },
  {
    id: 'room-1788362802353',
    name: 'Baño',
    type: 'bathroom',
    nodeCategory: 'room',
    tipoCubierta: 'cubierto',
    isTechnicalIsland: false,
    isAccessPoint: false,
    dimensions: {
      width: 2,
      length: 2.8,
      height: 2.4
    },
    canvasPosition: {
      x: 355,
      y: 275
    },
    topologyPosition: {
      x: 720,
      y: 340
    },
    color: '#e0f2f1',
    electricalAssets: [],
    createdAt: '2026-09-02T15:26:42.353Z',
    updatedAt: '2026-09-02T15:30:43.019Z',
    geometry: {
      mode: 'rectangle',
      wallBreaks: [
        {
          id: 'wb-invader-conn-1788362808140',
          wall: 'north',
          startOffsetMeters: 0,
          widthMeters: 2,
          depthMeters: 1,
          label: 'Invasión hacia Cocina'
        }
      ],
      computedVertices: [
        { x: 0, y: 0 },
        { x: 0, y: -1 },
        { x: 2, y: -1 },
        { x: 2, y: 0 },
        { x: 2, y: 2.8 },
        { x: 0, y: 2.8 }
      ]
    }
  },
  {
    id: 'room-1788362841555',
    name: 'Dormitorio',
    type: 'bedroom',
    nodeCategory: 'room',
    tipoCubierta: 'cubierto',
    isTechnicalIsland: false,
    isAccessPoint: false,
    dimensions: {
      width: 3.8,
      length: 4,
      height: 2.6
    },
    canvasPosition: {
      x: 275,
      y: 355
    },
    topologyPosition: {
      x: 1060,
      y: 340
    },
    color: '#f3e5f5',
    electricalAssets: [],
    createdAt: '2026-09-02T15:27:21.555Z',
    updatedAt: '2026-09-02T15:30:43.019Z',
    geometry: {
      mode: 'rectangle',
      wallBreaks: [],
      computedVertices: [
        { x: 0, y: 0 },
        { x: 3.8, y: 0 },
        { x: 3.8, y: 4 },
        { x: 0, y: 4 }
      ]
    }
  },
  {
    id: 'room-1788362876336',
    name: 'Balcón / Terraza',
    type: 'balcony',
    nodeCategory: 'room',
    tipoCubierta: 'semicubierto',
    isTechnicalIsland: false,
    isAccessPoint: false,
    dimensions: {
      width: 8,
      length: 1.5,
      height: 2.6
    },
    canvasPosition: {
      x: 80,
      y: 585
    },
    topologyPosition: {
      x: 380,
      y: 580
    },
    color: '#f1f8e9',
    electricalAssets: [],
    createdAt: '2026-09-02T15:27:56.336Z',
    updatedAt: '2026-09-02T15:30:43.019Z',
    geometry: {
      mode: 'rectangle',
      wallBreaks: [],
      computedVertices: [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 1.5 },
        { x: 0, y: 1.5 }
      ]
    }
  },
  {
    id: 'bound-1788362934649',
    name: 'Medianera Lateral Izquierda',
    type: 'limit_medianera_izq',
    nodeCategory: 'parcel_boundary',
    tipoCubierta: 'descubierto',
    isTechnicalIsland: false,
    isAccessPoint: false,
    isParcelBoundary: true,
    boundaryProperties: {
      materialType: 'medianera_comun_30',
      thicknessMeters: 0.3,
      boundaryCondition: 'muro_ciego'
    },
    isCommonArea: true,
    dimensions: {
      width: 0,
      length: 0,
      height: 0
    },
    canvasPosition: {
      x: -130,
      y: 280
    },
    topologyPosition: {
      x: 720,
      y: 580
    },
    color: '#e2e8f0',
    electricalAssets: [],
    createdAt: '2026-09-02T15:28:54.649Z',
    updatedAt: '2026-09-02T15:30:43.019Z',
    geometry: {
      mode: 'rectangle',
      wallBreaks: [],
      computedVertices: [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 2.5 },
        { x: 0, y: 2.5 }
      ]
    }
  },
  {
    id: 'bound-1788362962434',
    name: 'Medianera Lateral Derecha',
    type: 'limit_medianera_der',
    nodeCategory: 'parcel_boundary',
    tipoCubierta: 'descubierto',
    isTechnicalIsland: false,
    isAccessPoint: false,
    isParcelBoundary: true,
    boundaryProperties: {
      materialType: 'medianera_comun_30',
      thicknessMeters: 0.3,
      boundaryCondition: 'muro_ciego'
    },
    isCommonArea: true,
    dimensions: {
      width: 0,
      length: 0,
      height: 0
    },
    canvasPosition: {
      x: 485,
      y: -50
    },
    topologyPosition: {
      x: 1060,
      y: 580
    },
    color: '#e2e8f0',
    electricalAssets: [],
    createdAt: '2026-09-02T15:29:22.434Z',
    updatedAt: '2026-09-02T15:30:43.019Z',
    geometry: {
      mode: 'rectangle',
      wallBreaks: [],
      computedVertices: [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 2.5 },
        { x: 0, y: 2.5 }
      ]
    }
  }
];

const INITIAL_CONNECTIONS: LogicalConnection[] = [
  {
    id: 'conn-1788362617885',
    sourceRoomId: 'room-1788362611903',
    targetRoomId: 'entry-1788362570545',
    type: 'puerta_seguridad',
    label: '🚪 Puerta Principal / Seguridad',
    sourceWall: 'north',
    targetWall: 'south',
    sourceHandle: 'source-north',
    targetHandle: 'target-south',
    wallProperties: {
      materialType: 'ladrillo_hueco_8',
      thicknessMeters: 0.1,
      canChase: true,
      chasingMethod: 'liviano'
    },
    openings: [
      {
        id: 'open-1788362617885-1',
        openingType: 'puerta_seguridad',
        widthMeters: 0.9,
        heightMeters: 2.05,
        swingDirection: 'right',
        material: 'wood'
      }
    ],
    opening: {
      id: 'open-1788362617885-1',
      openingType: 'puerta_seguridad',
      widthMeters: 0.9,
      heightMeters: 2.05,
      swingDirection: 'right',
      material: 'wood'
    },
    hasElectricalPass: false,
    notes: ''
  },
  {
    id: 'conn-1788362688083',
    sourceRoomId: 'room-1788362682624',
    targetRoomId: 'room-1788362611903',
    type: 'vano_libre',
    label: '🚪 Puerta Placa / Batiente (1H)',
    sourceWall: 'west',
    targetWall: 'east',
    sourceHandle: 'source-west',
    targetHandle: 'target-east',
    wallProperties: {
      materialType: 'ladrillo_hueco_8',
      thicknessMeters: 0.1,
      canChase: true,
      chasingMethod: 'liviano'
    },
    openings: [
      {
        id: 'open-1788362688083-1',
        openingType: 'vano_libre',
        widthMeters: 3.8,
        heightMeters: 2.6,
        swingDirection: 'fixed',
        material: 'wood'
      }
    ],
    opening: {
      id: 'open-1788362688083-1',
      openingType: 'vano_libre',
      widthMeters: 3.8,
      heightMeters: 2.6,
      swingDirection: 'fixed',
      material: 'wood'
    },
    hasElectricalPass: false,
    notes: ''
  },
  {
    id: 'conn-1788362735925',
    sourceRoomId: 'room-1788362682624',
    targetRoomId: 'bound-1788362731158',
    type: 'pared_comun',
    label: '🚪 Puerta Placa / Batiente (1H)',
    sourceWall: 'north',
    targetWall: 'south',
    sourceHandle: 'source-north',
    targetHandle: 'target-south',
    wallProperties: {
      materialType: 'ladrillo_hueco_18',
      thicknessMeters: 0.2,
      canChase: true,
      chasingMethod: 'liviano'
    },
    openings: [],
    hasElectricalPass: false,
    notes: ''
  },
  {
    id: 'conn-1788362781709',
    sourceRoomId: 'room-1788362774104',
    targetRoomId: 'room-1788362611903',
    type: 'puerta_estandar',
    label: '🚪 Puerta Placa / Batiente (1H)',
    sourceWall: 'west',
    targetWall: 'east',
    sourceHandle: 'source-west',
    targetHandle: 'target-east',
    wallProperties: {
      materialType: 'ladrillo_hueco_8',
      thicknessMeters: 0.1,
      canChase: true,
      chasingMethod: 'liviano'
    },
    openings: [
      {
        id: 'open-1788362781708-1',
        openingType: 'puerta_estandar',
        widthMeters: 0.8,
        heightMeters: 2.05,
        swingDirection: 'right',
        material: 'wood'
      }
    ],
    opening: {
      id: 'open-1788362781708-1',
      openingType: 'puerta_estandar',
      widthMeters: 0.8,
      heightMeters: 2.05,
      swingDirection: 'right',
      material: 'wood'
    },
    hasElectricalPass: false,
    notes: ''
  },
  {
    id: 'conn-1788362787445',
    sourceRoomId: 'room-1788362774104',
    targetRoomId: 'room-1788362682624',
    type: 'pared_comun',
    label: '🚪 Puerta Placa / Batiente (1H)',
    sourceWall: 'north',
    targetWall: 'south',
    sourceHandle: 'source-north',
    targetHandle: 'target-south',
    wallProperties: {
      materialType: 'ladrillo_hueco_8',
      thicknessMeters: 0.1,
      canChase: true,
      chasingMethod: 'liviano'
    },
    openings: [],
    hasElectricalPass: false,
    notes: ''
  },
  {
    id: 'conn-1788362808140',
    sourceRoomId: 'room-1788362802353',
    targetRoomId: 'room-1788362682624',
    type: 'pared_comun',
    label: '🚪 Puerta Placa / Batiente (1H)',
    sourceWall: 'north',
    targetWall: 'south',
    sourceHandle: 'source-north',
    targetHandle: 'target-south',
    wallProperties: {
      materialType: 'ladrillo_hueco_8',
      thicknessMeters: 0.1,
      canChase: true,
      chasingMethod: 'liviano'
    },
    openings: [],
    invasion: {
      type: 'source_invades_target'
    },
    hasElectricalPass: false,
    notes: ''
  },
  {
    id: 'conn-1788362815422',
    sourceRoomId: 'room-1788362802353',
    targetRoomId: 'room-1788362774104',
    type: 'puerta_estandar',
    label: '🚪 Puerta Placa / Batiente (1H)',
    sourceWall: 'west',
    targetWall: 'east',
    sourceHandle: 'source-west',
    targetHandle: 'target-east',
    wallProperties: {
      materialType: 'ladrillo_hueco_8',
      thicknessMeters: 0.1,
      canChase: true,
      chasingMethod: 'liviano'
    },
    openings: [
      {
        id: 'open-1788362815422-1',
        openingType: 'puerta_estandar',
        widthMeters: 0.7,
        heightMeters: 2.05,
        swingDirection: 'right',
        material: 'wood'
      }
    ],
    opening: {
      id: 'open-1788362815422-1',
      openingType: 'puerta_estandar',
      widthMeters: 0.7,
      heightMeters: 2.05,
      swingDirection: 'right',
      material: 'wood'
    },
    hasElectricalPass: false,
    notes: ''
  },
  {
    id: 'conn-1788362850613',
    sourceRoomId: 'room-1788362841555',
    targetRoomId: 'room-1788362774104',
    type: 'puerta_estandar',
    label: '🚪 Puerta Placa / Batiente (1H)',
    sourceWall: 'north',
    targetWall: 'south',
    sourceHandle: 'source-north',
    targetHandle: 'target-south',
    wallProperties: {
      materialType: 'ladrillo_hueco_8',
      thicknessMeters: 0.1,
      canChase: true,
      chasingMethod: 'liviano'
    },
    openings: [
      {
        id: 'open-1788362850613-1',
        openingType: 'puerta_estandar',
        widthMeters: 0.7,
        heightMeters: 2.05,
        swingDirection: 'right',
        material: 'wood'
      }
    ],
    opening: {
      id: 'open-1788362850613-1',
      openingType: 'puerta_estandar',
      widthMeters: 0.7,
      heightMeters: 2.05,
      swingDirection: 'right',
      material: 'wood'
    },
    hasElectricalPass: false,
    notes: ''
  },
  {
    id: 'conn-1788362858213',
    sourceRoomId: 'room-1788362841555',
    targetRoomId: 'room-1788362802353',
    type: 'pared_comun',
    label: '🚪 Puerta Placa / Batiente (1H)',
    sourceWall: 'north',
    targetWall: 'south',
    sourceHandle: 'source-north',
    targetHandle: 'target-south',
    wallProperties: {
      materialType: 'ladrillo_hueco_8',
      thicknessMeters: 0.1,
      canChase: true,
      chasingMethod: 'liviano'
    },
    openings: [],
    hasElectricalPass: false,
    notes: ''
  },
  {
    id: 'conn-1788362884471',
    sourceRoomId: 'room-1788362841555',
    targetRoomId: 'room-1788362611903',
    type: 'pared_comun',
    label: '🚪 Puerta Placa / Batiente (1H)',
    sourceWall: 'west',
    targetWall: 'east',
    sourceHandle: 'source-west',
    targetHandle: 'target-east',
    wallProperties: {
      materialType: 'ladrillo_hueco_8',
      thicknessMeters: 0.1,
      canChase: true,
      chasingMethod: 'liviano'
    },
    openings: [],
    hasElectricalPass: false,
    notes: ''
  },
  {
    id: 'conn-1788362907565',
    sourceRoomId: 'room-1788362876336',
    targetRoomId: 'room-1788362611903',
    type: 'puerta_ventana',
    label: '🚪 Puerta Placa / Batiente (1H)',
    sourceWall: 'north',
    targetWall: 'south',
    sourceHandle: 'source-north',
    targetHandle: 'target-south',
    wallProperties: {
      materialType: 'ladrillo_hueco_8',
      thicknessMeters: 0.1,
      canChase: true,
      chasingMethod: 'liviano'
    },
    openings: [
      {
        id: 'open-1788362907565-1',
        openingType: 'puerta_ventana',
        widthMeters: 2,
        heightMeters: 2.05,
        sillHeightMeters: 0,
        swingDirection: 'sliding',
        material: 'wood'
      }
    ],
    opening: {
      id: 'open-1788362907565-1',
      openingType: 'puerta_ventana',
      widthMeters: 2,
      heightMeters: 2.05,
      sillHeightMeters: 0,
      swingDirection: 'sliding',
      material: 'wood'
    },
    hasElectricalPass: false,
    notes: ''
  },
  {
    id: 'conn-1788362921358',
    sourceRoomId: 'room-1788362876336',
    targetRoomId: 'room-1788362841555',
    type: 'ventana_estandar',
    label: '🚪 Puerta Placa / Batiente (1H)',
    sourceWall: 'north',
    targetWall: 'south',
    sourceHandle: 'source-north',
    targetHandle: 'target-south',
    wallProperties: {
      materialType: 'ladrillo_hueco_8',
      thicknessMeters: 0.1,
      canChase: true,
      chasingMethod: 'liviano'
    },
    openings: [
      {
        id: 'open-1788362921358-1',
        openingType: 'ventana_estandar',
        widthMeters: 1.5,
        heightMeters: 1.1,
        sillHeightMeters: 0.9,
        swingDirection: 'sliding',
        material: 'wood'
      }
    ],
    opening: {
      id: 'open-1788362921358-1',
      openingType: 'ventana_estandar',
      widthMeters: 1.5,
      heightMeters: 1.1,
      sillHeightMeters: 0.9,
      swingDirection: 'sliding',
      material: 'wood'
    },
    hasElectricalPass: false,
    notes: ''
  },
  {
    id: 'conn-1788362941861',
    sourceRoomId: 'room-1788362611903',
    targetRoomId: 'bound-1788362934649',
    type: 'pared_comun',
    label: '🚪 Puerta Placa / Batiente (1H)',
    sourceWall: 'west',
    targetWall: 'east',
    sourceHandle: 'source-west',
    targetHandle: 'target-east',
    wallProperties: {
      materialType: 'medianera_comun_30',
      thicknessMeters: 0.3,
      canChase: true,
      chasingMethod: 'pesado'
    },
    openings: [],
    hasElectricalPass: false,
    notes: ''
  },
  {
    id: 'conn-1788362972132',
    sourceRoomId: 'bound-1788362962434',
    targetRoomId: 'bound-1788362731158',
    type: 'pared_comun',
    label: '🚪 Puerta Placa / Batiente (1H)',
    sourceWall: 'west',
    targetWall: 'east',
    sourceHandle: 'source-west',
    targetHandle: 'target-east',
    wallProperties: {
      materialType: 'medianera_comun_30',
      thicknessMeters: 0.3,
      canChase: true,
      chasingMethod: 'pesado'
    },
    openings: [],
    hasElectricalPass: false,
    notes: ''
  },
  {
    id: 'conn-1788362984870',
    sourceRoomId: 'bound-1788362962434',
    targetRoomId: 'room-1788362682624',
    type: 'pared_comun',
    label: '🚪 Puerta Placa / Batiente (1H)',
    sourceWall: 'west',
    targetWall: 'east',
    sourceHandle: 'source-west',
    targetHandle: 'target-east',
    wallProperties: {
      materialType: 'medianera_comun_30',
      thicknessMeters: 0.3,
      canChase: true,
      chasingMethod: 'pesado'
    },
    openings: [],
    hasElectricalPass: false,
    notes: ''
  },
  {
    id: 'conn-1788362996532',
    sourceRoomId: 'bound-1788362962434',
    targetRoomId: 'room-1788362802353',
    type: 'pared_comun',
    label: '🚪 Puerta Placa / Batiente (1H)',
    sourceWall: 'west',
    targetWall: 'east',
    sourceHandle: 'source-west',
    targetHandle: 'target-east',
    wallProperties: {
      materialType: 'medianera_comun_30',
      thicknessMeters: 0.3,
      canChase: true,
      chasingMethod: 'pesado'
    },
    openings: [],
    hasElectricalPass: false,
    notes: ''
  },
  {
    id: 'conn-1788363006157',
    sourceRoomId: 'bound-1788362962434',
    targetRoomId: 'room-1788362841555',
    type: 'pared_comun',
    label: '🚪 Puerta Placa / Batiente (1H)',
    sourceWall: 'west',
    targetWall: 'east',
    sourceHandle: 'source-west',
    targetHandle: 'target-east',
    wallProperties: {
      materialType: 'medianera_comun_30',
      thicknessMeters: 0.3,
      canChase: true,
      chasingMethod: 'pesado'
    },
    openings: [],
    hasElectricalPass: false,
    notes: ''
  }
];

const INITIAL_ELECTRICAL_NODES: NodoElectrico[] = [
  {
    id: 'node-tsg-cocina',
    roomId: 'room-1788362682624',
    tipo: 'tablero_seccional',
    etiqueta: 'TSG Tablero Principal',
    codigoRef: 'TSG-01',
    circuitoCodigo: 'ALIM-TSG',
    tensionNominalV: 220,
    notas: 'Gabinete Din 24 bocas con IGM 2x32A + ID 2x40A 30mA'
  },
  {
    id: 'node-luz-living',
    roomId: 'room-1788362611903',
    tipo: 'boca_iluminacion',
    etiqueta: 'Boca Luz Living',
    codigoRef: 'BT-LIV',
    circuitoCodigo: 'C1-IUG'
  },
  {
    id: 'node-tomas-living',
    roomId: 'room-1788362611903',
    tipo: 'boca_tomacorriente',
    etiqueta: 'Tomas Living Comedor',
    codigoRef: 'TUG-LIV',
    circuitoCodigo: 'C2-TUG'
  },
  {
    id: 'node-luz-cocina',
    roomId: 'room-1788362682624',
    tipo: 'boca_iluminacion',
    etiqueta: 'Boca Luz Cocina',
    codigoRef: 'BT-KITCH',
    circuitoCodigo: 'C1-IUG'
  },
  {
    id: 'node-tomas-cocina',
    roomId: 'room-1788362682624',
    tipo: 'boca_tomacorriente',
    etiqueta: 'Tomas Mesada Cocina',
    codigoRef: 'TUG-KITCH',
    circuitoCodigo: 'C3-TUG'
  },
  {
    id: 'node-luz-pasillo',
    roomId: 'room-1788362774104',
    tipo: 'boca_iluminacion',
    etiqueta: 'Boca Luz Pasillo',
    codigoRef: 'BT-HALL',
    circuitoCodigo: 'C1-IUG'
  },
  {
    id: 'node-luz-bano',
    roomId: 'room-1788362802353',
    tipo: 'boca_iluminacion',
    etiqueta: 'Boca Luz Baño',
    codigoRef: 'BT-BATH',
    circuitoCodigo: 'C1-IUG'
  },
  {
    id: 'node-luz-dormitorio',
    roomId: 'room-1788362841555',
    tipo: 'boca_iluminacion',
    etiqueta: 'Boca Luz Dormitorio',
    codigoRef: 'BT-BED',
    circuitoCodigo: 'C1-IUG'
  },
  {
    id: 'node-tomas-dormitorio',
    roomId: 'room-1788362841555',
    tipo: 'boca_tomacorriente',
    etiqueta: 'Tomas Dormitorio',
    codigoRef: 'TUG-BED',
    circuitoCodigo: 'C2-TUG'
  },
  {
    id: 'node-luz-balcon',
    roomId: 'room-1788362876336',
    tipo: 'boca_iluminacion',
    etiqueta: 'Boca Luz Balcón IP65',
    codigoRef: 'BT-BALC',
    circuitoCodigo: 'C1-IUG'
  }
];

const INITIAL_ELECTRICAL_TRAMOS: TramoElectrico[] = [
  {
    id: 'tramo-tsg-c1-kitch',
    sourceNodeId: 'node-tsg-cocina',
    targetNodeId: 'node-luz-cocina',
    longitudMeters: 2.5,
    diametroCañoMm: 19,
    tipoMontaje: 'embutido',
    circuitoCodigo: 'C1-IUG',
    tensionV: 220,
    conductores: [
      { id: 'w-c1-k1', circuitoCodigo: 'C1-IUG', tipoConductor: 'fase', seccionMm2: 1.5, colorAislacion: 'marron', etiqueta: 'Fase C1' },
      { id: 'w-c1-k2', circuitoCodigo: 'C1-IUG', tipoConductor: 'neutro', seccionMm2: 1.5, colorAislacion: 'celeste', etiqueta: 'Neutro C1' },
      { id: 'w-c1-k3', circuitoCodigo: 'C1-IUG', tipoConductor: 'tierra_pe', seccionMm2: 2.5, colorAislacion: 'verde_amarillo', etiqueta: 'Tierra PE' }
    ]
  },
  {
    id: 'tramo-kitch-c1-liv',
    sourceNodeId: 'node-luz-cocina',
    targetNodeId: 'node-luz-living',
    longitudMeters: 3.5,
    diametroCañoMm: 19,
    tipoMontaje: 'embutido',
    circuitoCodigo: 'C1-IUG',
    tensionV: 220,
    conductores: [
      { id: 'w-c1-l1', circuitoCodigo: 'C1-IUG', tipoConductor: 'fase', seccionMm2: 1.5, colorAislacion: 'marron', etiqueta: 'Fase C1' },
      { id: 'w-c1-l2', circuitoCodigo: 'C1-IUG', tipoConductor: 'neutro', seccionMm2: 1.5, colorAislacion: 'celeste', etiqueta: 'Neutro C1' },
      { id: 'w-c1-l3', circuitoCodigo: 'C1-IUG', tipoConductor: 'tierra_pe', seccionMm2: 2.5, colorAislacion: 'verde_amarillo', etiqueta: 'Tierra PE' }
    ]
  },
  {
    id: 'tramo-kitch-c1-hall',
    sourceNodeId: 'node-luz-cocina',
    targetNodeId: 'node-luz-pasillo',
    longitudMeters: 2.0,
    diametroCañoMm: 19,
    tipoMontaje: 'embutido',
    circuitoCodigo: 'C1-IUG',
    tensionV: 220,
    conductores: [
      { id: 'w-c1-h1', circuitoCodigo: 'C1-IUG', tipoConductor: 'fase', seccionMm2: 1.5, colorAislacion: 'marron', etiqueta: 'Fase C1' },
      { id: 'w-c1-h2', circuitoCodigo: 'C1-IUG', tipoConductor: 'neutro', seccionMm2: 1.5, colorAislacion: 'celeste', etiqueta: 'Neutro C1' },
      { id: 'w-c1-h3', circuitoCodigo: 'C1-IUG', tipoConductor: 'tierra_pe', seccionMm2: 2.5, colorAislacion: 'verde_amarillo', etiqueta: 'Tierra PE' }
    ]
  },
  {
    id: 'tramo-hall-c1-bath',
    sourceNodeId: 'node-luz-pasillo',
    targetNodeId: 'node-luz-bano',
    longitudMeters: 1.5,
    diametroCañoMm: 19,
    tipoMontaje: 'embutido',
    circuitoCodigo: 'C1-IUG',
    tensionV: 220,
    conductores: [
      { id: 'w-c1-b1', circuitoCodigo: 'C1-IUG', tipoConductor: 'fase', seccionMm2: 1.5, colorAislacion: 'marron', etiqueta: 'Fase C1' },
      { id: 'w-c1-b2', circuitoCodigo: 'C1-IUG', tipoConductor: 'neutro', seccionMm2: 1.5, colorAislacion: 'celeste', etiqueta: 'Neutro C1' },
      { id: 'w-c1-b3', circuitoCodigo: 'C1-IUG', tipoConductor: 'tierra_pe', seccionMm2: 2.5, colorAislacion: 'verde_amarillo', etiqueta: 'Tierra PE' }
    ]
  },
  {
    id: 'tramo-hall-c1-bed',
    sourceNodeId: 'node-luz-pasillo',
    targetNodeId: 'node-luz-dormitorio',
    longitudMeters: 2.2,
    diametroCañoMm: 19,
    tipoMontaje: 'embutido',
    circuitoCodigo: 'C1-IUG',
    tensionV: 220,
    conductores: [
      { id: 'w-c1-d1', circuitoCodigo: 'C1-IUG', tipoConductor: 'fase', seccionMm2: 1.5, colorAislacion: 'marron', etiqueta: 'Fase C1' },
      { id: 'w-c1-d2', circuitoCodigo: 'C1-IUG', tipoConductor: 'neutro', seccionMm2: 1.5, colorAislacion: 'celeste', etiqueta: 'Neutro C1' },
      { id: 'w-c1-d3', circuitoCodigo: 'C1-IUG', tipoConductor: 'tierra_pe', seccionMm2: 2.5, colorAislacion: 'verde_amarillo', etiqueta: 'Tierra PE' }
    ]
  },
  {
    id: 'tramo-bed-c1-balc',
    sourceNodeId: 'node-luz-dormitorio',
    targetNodeId: 'node-luz-balcon',
    longitudMeters: 3.0,
    diametroCañoMm: 19,
    tipoMontaje: 'embutido',
    circuitoCodigo: 'C1-IUG',
    tensionV: 220,
    conductores: [
      { id: 'w-c1-bc1', circuitoCodigo: 'C1-IUG', tipoConductor: 'fase', seccionMm2: 1.5, colorAislacion: 'marron', etiqueta: 'Fase C1' },
      { id: 'w-c1-bc2', circuitoCodigo: 'C1-IUG', tipoConductor: 'neutro', seccionMm2: 1.5, colorAislacion: 'celeste', etiqueta: 'Neutro C1' },
      { id: 'w-c1-bc3', circuitoCodigo: 'C1-IUG', tipoConductor: 'tierra_pe', seccionMm2: 2.5, colorAislacion: 'verde_amarillo', etiqueta: 'Tierra PE' }
    ]
  }
];

export const useSurveyStore = create<SurveyState>((set, get) => ({
  // Gestión de Proyecto y Cliente (Cotizador IEBA)
  currentProjectId: 'proj-demo-depto-medianeras',
  currentProjectName: 'Departamento 3 Ambientes con Medianeras',
  clienteInfo: {
    id: 'cli-demo-1',
    nombre: 'Cliente Ejemplo IEBA',
    telefono: '+54 9 11 5555-1234',
    email: 'contacto@ejemplo.com',
    direccion: 'Av. Corrientes 2450, 3° B',
    cuitDni: '20-34567890-9',
    localidad: 'CABA',
    provincia: 'Buenos Aires'
  },
  ubicacionObra: 'Av. Corrientes 2450, 3° B, CABA',
  descripcionObra: 'Relevamiento integral y proyecto de instalación eléctrica en depto 3 ambientes con balcón y medianeras.',
  rumboFrente: 'Norte',
  azimutGrados: 0,
  isAutoSaving: false,
  lastSavedAt: null,

  rooms: solveAutoAssembly(INITIAL_ROOMS, INITIAL_CONNECTIONS),
  connections: INITIAL_CONNECTIONS,
  selectedRoomId: 'room-1788362611903',
  selectedConnectionId: null,
  activePhase: 'architecture',

  wallThicknessMeters: 0.10, // 10 cm por defecto

  electricalNodes: INITIAL_ELECTRICAL_NODES,
  electricalTramos: INITIAL_ELECTRICAL_TRAMOS,
  selectedElectricalNodeId: null,
  selectedTramoId: null,
  topologyLayer: 'architectural',
  acceptableErrorThresholdMeters: 0.05,
  isAssistantOpen: false,

  isSnapEnabled: true,
  snapThreshold: 15,
  activeSnapGuides: [],
  zoom: 1,

  setActivePhase: (phase: SurveyPhase) => {
    let mapped: SurveyPhase = phase;
    if (phase === 'topology' || phase === 'parametrization') mapped = 'architecture';
    if (phase === 'assembly') mapped = 'presentation';
    set({ activePhase: mapped });
  },

  setTopologyLayer: (layer: TopologyLayerMode) => set({ topologyLayer: layer }),

  setWallThickness: (thickness: number) => set({ wallThicknessMeters: thickness }),

  selectRoom: (roomId: string | null) => set({ selectedRoomId: roomId }),

  selectConnection: (connectionId: string | null) =>
    set({ selectedConnectionId: connectionId }),

  selectElectricalNode: (nodeId: string | null) =>
    set({ selectedElectricalNodeId: nodeId }),

  selectTramo: (tramoId: string | null) =>
    set({ selectedTramoId: tramoId }),

  addRoom: (roomData) => {
    const isTechnical = roomData.isTechnicalIsland || (roomData.type ? ROOM_TYPE_CATALOG[roomData.type]?.isTechnical : false);
    const isAccess = roomData.isAccessPoint || (roomData.type ? ROOM_TYPE_CATALOG[roomData.type]?.isAccess : false);
    const isBoundary = roomData.isParcelBoundary || (roomData.type ? ROOM_TYPE_CATALOG[roomData.type]?.isBoundary : false);
    const preset = roomData.type ? ROOM_TYPE_CATALOG[roomData.type] : ROOM_TYPE_CATALOG.other;

    const count = get().rooms.length;
    const newRoom: Room = {
      id: isBoundary ? `bound-${Date.now()}` : isTechnical ? `island-${Date.now()}` : isAccess ? `entry-${Date.now()}` : `room-${Date.now()}`,
      name: roomData.name || preset.label,
      type: roomData.type || 'other',
      nodeCategory: isBoundary ? 'parcel_boundary' : isTechnical ? 'technical_island' : isAccess ? 'access' : 'room',
      tipoCubierta: roomData.tipoCubierta || preset.defaultCubierta || 'cubierto',
      isTechnicalIsland: isTechnical,
      isAccessPoint: isAccess,
      isParcelBoundary: isBoundary,
      boundaryProperties: isBoundary ? roomData.boundaryProperties : undefined,
      isCommonArea: roomData.isCommonArea || isTechnical || isAccess || isBoundary,
      accessCategory: roomData.accessCategory,
      dimensions: roomData.dimensions || {
        width: isTechnical || isAccess || isBoundary ? 0 : preset.defaultWidth,
        length: isTechnical || isAccess || isBoundary ? 0 : preset.defaultLength,
        height: isTechnical || isAccess || isBoundary ? 0 : preset.defaultHeight
      },
      canvasPosition: roomData.canvasPosition || {
        x: 100 + (count % 4) * 50,
        y: 100 + Math.floor(count / 4) * 40
      },
      topologyPosition: roomData.topologyPosition || {
        x: isTechnical ? 40 : isBoundary ? 300 + (count % 3) * 260 : 100 + (count % 3) * 280,
        y: isBoundary ? 40 : 100 + Math.floor(count / 3) * 180
      },
      color: roomData.color || preset.color,
      electricalAssets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    set((state) => ({
      rooms: [...state.rooms, newRoom],
      selectedRoomId: newRoom.id
    }));

    return newRoom;
  },

  updateRoom: (roomId, updates) => {
    set((state) => ({
      rooms: state.rooms.map((room) =>
        room.id === roomId
          ? { ...room, ...updates, updatedAt: new Date().toISOString() }
          : room
      )
    }));
  },

  removeRoom: (roomId) => {
    set((state) => ({
      rooms: state.rooms.filter((r) => r.id !== roomId),
      connections: state.connections.filter(
        (c) => c.sourceRoomId !== roomId && c.targetRoomId !== roomId
      ),
      electricalNodes: state.electricalNodes.filter((n) => n.roomId !== roomId),
      selectedRoomId: state.selectedRoomId === roomId ? null : state.selectedRoomId
    }));
  },

  updateRoomTopologyPosition: (roomId, position) => {
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.id === roomId ? { ...r, topologyPosition: position } : r
      )
    }));
  },

  connectRooms: (sourceRoomId, targetRoomId, type = 'puerta_estandar', label, sourceHandle, targetHandle, wallProperties) => {
    if (sourceRoomId === targetRoomId) return null;

    const catalogMeta = CONNECTION_TYPE_CATALOG[type] || CONNECTION_TYPE_CATALOG.puerta_estandar;

    const extractWall = (handleId?: string): WallOrientation | undefined => {
      if (!handleId) return undefined;
      const clean = handleId.replace('source-', '').replace('target-', '');
      if (['north', 'south', 'east', 'west'].includes(clean)) {
        return clean as WallOrientation;
      }
      return undefined;
    };

    const sourceWall = extractWall(sourceHandle) || 'east';
    const targetWall = extractWall(targetHandle) || 'west';

    const defaultMaterial: TabiqueMaterialType = wallProperties?.materialType || 'ladrillo_hueco_8';
    const matMeta = TABIQUE_MATERIAL_CATALOG[defaultMaterial];
    const thickness = wallProperties?.thicknessMeters || matMeta.defaultThicknessMeters || get().wallThicknessMeters;

    const initialOpenings: OpeningProperties[] = catalogMeta.isOpening
      ? [
          {
            id: `open-${Date.now()}-1`,
            openingType: type,
            widthMeters: catalogMeta.defaultWidth,
            heightMeters: catalogMeta.defaultHeight,
            sillHeightMeters: catalogMeta.defaultSillHeight,
            swingDirection: catalogMeta.defaultSwing || 'right',
            material: 'wood'
          }
        ]
      : [];

    const newConnection: LogicalConnection = {
      id: `conn-${Date.now()}`,
      sourceRoomId,
      targetRoomId,
      type,
      label: label || (initialOpenings.length > 0 ? `${catalogMeta.emoji} ${catalogMeta.label}` : `🧱 Muro Compartido`),
      sourceWall,
      targetWall,
      sourceHandle: sourceHandle || `source-${sourceWall}`,
      targetHandle: targetHandle || `target-${targetWall}`,
      wallProperties: {
        materialType: defaultMaterial,
        thicknessMeters: thickness,
        canChase: matMeta.canChase,
        chasingMethod: matMeta.chasingMethod,
        ...wallProperties
      },
      openings: initialOpenings,
      opening: initialOpenings[0]
    };

    set((state) => ({
      connections: [...state.connections, newConnection],
      selectedConnectionId: newConnection.id
    }));

    return newConnection;
  },

  updateConnection: (connectionId, updates) => {
    set((state) => {
      const updatedConnections = state.connections.map((c) => {
        if (c.id !== connectionId) return c;

        const merged = { ...c, ...updates };

        // Sincronizar openings <-> opening
        if (updates.openings !== undefined) {
          merged.opening = updates.openings[0];
        } else if (updates.opening !== undefined) {
          merged.openings = updates.opening ? [updates.opening] : [];
        }

        return merged;
      });

      // Deducir y aplicar quiebres geométricos en los recintos
      const updatedRooms = applyInvasionsToRoomGeometries(state.rooms, updatedConnections);

      return {
        connections: updatedConnections,
        rooms: updatedRooms
      };
    });
  },

  removeConnection: (connectionId) => {
    set((state) => ({
      connections: state.connections.filter((c) => c.id !== connectionId),
      selectedConnectionId:
        state.selectedConnectionId === connectionId ? null : state.selectedConnectionId
    }));
  },

  addOpeningToConnection: (connectionId, opening) => {
    set((state) => ({
      connections: state.connections.map((c) => {
        if (c.id !== connectionId) return c;
        const currentOpenings = getConnectionOpenings(c);
        const newOpening: OpeningProperties = {
          ...opening,
          id: opening.id || `open-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
        };
        const updatedOpenings = [...currentOpenings, newOpening];
        return {
          ...c,
          openings: updatedOpenings,
          opening: updatedOpenings[0]
        };
      })
    }));
  },

  updateOpeningInConnection: (connectionId, openingIndex, updates) => {
    set((state) => ({
      connections: state.connections.map((c) => {
        if (c.id !== connectionId) return c;
        const currentOpenings = getConnectionOpenings(c);
        const updatedOpenings = currentOpenings.map((op, idx) =>
          idx === openingIndex ? { ...op, ...updates } : op
        );
        return {
          ...c,
          openings: updatedOpenings,
          opening: updatedOpenings[0]
        };
      })
    }));
  },

  removeOpeningFromConnection: (connectionId, openingIndex) => {
    set((state) => ({
      connections: state.connections.map((c) => {
        if (c.id !== connectionId) return c;
        const currentOpenings = getConnectionOpenings(c);
        const updatedOpenings = currentOpenings.filter((_, idx) => idx !== openingIndex);
        return {
          ...c,
          openings: updatedOpenings,
          opening: updatedOpenings[0]
        };
      })
    }));
  },

  updateConnectionWallProperties: (connectionId, wallProps) => {
    set((state) => ({
      connections: state.connections.map((c) => {
        if (c.id !== connectionId) return c;
        const currentProps = c.wallProperties || {
          materialType: 'ladrillo_hueco_8',
          thicknessMeters: 0.10,
          canChase: true,
          chasingMethod: 'liviano'
        };
        const matMeta = wallProps.materialType
          ? TABIQUE_MATERIAL_CATALOG[wallProps.materialType]
          : TABIQUE_MATERIAL_CATALOG[currentProps.materialType];

        const updatedProps: SharedWallProperties = {
          ...currentProps,
          ...wallProps,
          canChase: matMeta?.canChase ?? currentProps.canChase,
          chasingMethod: matMeta?.chasingMethod ?? currentProps.chasingMethod,
          thicknessMeters: wallProps.thicknessMeters || currentProps.thicknessMeters || matMeta?.defaultThicknessMeters || 0.10
        };

        return {
          ...c,
          wallProperties: updatedProps
        };
      })
    }));
  },

  // Operaciones de Nodos Eléctricos
  addNodoElectrico: (nodoData) => {
    const meta = TIPO_NODO_ELECTRICO_CATALOG[nodoData.tipo] || TIPO_NODO_ELECTRICO_CATALOG.boca_tomacorriente;
    const newNodo: NodoElectrico = {
      id: `node-elec-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      codigoRef: nodoData.codigoRef || meta.shortCode,
      tensionNominalV: nodoData.tensionNominalV ?? meta.defaultTension,
      ...nodoData
    };

    set((state) => ({
      electricalNodes: [...state.electricalNodes, newNodo],
      selectedElectricalNodeId: newNodo.id
    }));

    return newNodo;
  },

  updateNodoElectrico: (nodoId, updates) => {
    set((state) => ({
      electricalNodes: state.electricalNodes.map((n) =>
        n.id === nodoId ? { ...n, ...updates } : n
      )
    }));
  },

  removeNodoElectrico: (nodoId) => {
    set((state) => ({
      electricalNodes: state.electricalNodes.filter((n) => n.id !== nodoId),
      electricalTramos: state.electricalTramos.filter(
        (t) => t.sourceNodeId !== nodoId && t.targetNodeId !== nodoId
      ),
      selectedElectricalNodeId:
        state.selectedElectricalNodeId === nodoId ? null : state.selectedElectricalNodeId
    }));
  },

  // Operaciones de Tramos Eléctricos
  connectNodosElectricos: (sourceNodeId, targetNodeId, tramoData) => {
    if (sourceNodeId === targetNodeId) return null;

    const existing = get().electricalTramos.find(
      (t) =>
        (t.sourceNodeId === sourceNodeId && t.targetNodeId === targetNodeId) ||
        (t.sourceNodeId === targetNodeId && t.targetNodeId === sourceNodeId)
    );

    if (existing) return existing;

    const defaultCirc = tramoData?.circuitoCodigo || 'C1-IUG';
    let defaultConductores: ConductorLine[] = tramoData?.conductores || [];

    if (defaultConductores.length === 0) {
      if (defaultCirc.includes('IUG')) {
        defaultConductores = [
          { id: `c-${Date.now()}-1`, circuitoCodigo: defaultCirc, tipoConductor: 'fase', seccionMm2: 1.5, colorAislacion: 'marron', etiqueta: 'Fase C1' },
          { id: `c-${Date.now()}-2`, circuitoCodigo: defaultCirc, tipoConductor: 'neutro', seccionMm2: 1.5, colorAislacion: 'celeste', etiqueta: 'Neutro C1' },
          { id: `c-${Date.now()}-3`, circuitoCodigo: defaultCirc, tipoConductor: 'retorno', seccionMm2: 1.5, colorAislacion: 'negro', etiqueta: 'Retorno Luz' },
          { id: `c-${Date.now()}-4`, circuitoCodigo: defaultCirc, tipoConductor: 'tierra_pe', seccionMm2: 2.5, colorAislacion: 'verde_amarillo', etiqueta: 'Tierra PE' }
        ];
      } else if (defaultCirc.includes('TUE')) {
        defaultConductores = [
          { id: `c-${Date.now()}-1`, circuitoCodigo: defaultCirc, tipoConductor: 'fase', seccionMm2: 4.0, colorAislacion: 'rojo', etiqueta: 'Fase TUE' },
          { id: `c-${Date.now()}-2`, circuitoCodigo: defaultCirc, tipoConductor: 'neutro', seccionMm2: 4.0, colorAislacion: 'celeste', etiqueta: 'Neutro TUE' },
          { id: `c-${Date.now()}-3`, circuitoCodigo: defaultCirc, tipoConductor: 'tierra_pe', seccionMm2: 4.0, colorAislacion: 'verde_amarillo', etiqueta: 'Tierra PE 4mm²' }
        ];
      } else if (defaultCirc.includes('ALIM')) {
        defaultConductores = [
          { id: `c-${Date.now()}-1`, circuitoCodigo: defaultCirc, tipoConductor: 'fase', seccionMm2: 6.0, colorAislacion: 'marron', etiqueta: 'Fase Alimentador' },
          { id: `c-${Date.now()}-2`, circuitoCodigo: defaultCirc, tipoConductor: 'neutro', seccionMm2: 6.0, colorAislacion: 'celeste', etiqueta: 'Neutro Alimentador' },
          { id: `c-${Date.now()}-3`, circuitoCodigo: defaultCirc, tipoConductor: 'tierra_pe', seccionMm2: 6.0, colorAislacion: 'verde_amarillo', etiqueta: 'Tierra PE 6mm²' }
        ];
      } else {
        defaultConductores = [
          { id: `c-${Date.now()}-1`, circuitoCodigo: defaultCirc, tipoConductor: 'fase', seccionMm2: 2.5, colorAislacion: 'marron', etiqueta: 'Fase TUG' },
          { id: `c-${Date.now()}-2`, circuitoCodigo: defaultCirc, tipoConductor: 'neutro', seccionMm2: 2.5, colorAislacion: 'celeste', etiqueta: 'Neutro TUG' },
          { id: `c-${Date.now()}-3`, circuitoCodigo: defaultCirc, tipoConductor: 'tierra_pe', seccionMm2: 2.5, colorAislacion: 'verde_amarillo', etiqueta: 'Tierra PE' }
        ];
      }
    }

    const newTramo: TramoElectrico = {
      id: `tramo-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      sourceNodeId,
      targetNodeId,
      longitudMeters: tramoData?.longitudMeters || 5.0,
      diametroCañoMm: tramoData?.diametroCañoMm || 19,
      tipoMontaje: tramoData?.tipoMontaje || 'embutido',
      circuitoCodigo: defaultCirc,
      tensionV: tramoData?.tensionV || 220,
      conductores: defaultConductores,
      ...tramoData
    };

    set((state) => ({
      electricalTramos: [...state.electricalTramos, newTramo],
      selectedTramoId: newTramo.id
    }));

    return newTramo;
  },

  updateTramoElectrico: (tramoId, updates) => {
    set((state) => ({
      electricalTramos: state.electricalTramos.map((t) =>
        t.id === tramoId ? { ...t, ...updates } : t
      )
    }));
  },

  removeTramoElectrico: (tramoId) => {
    set((state) => ({
      electricalTramos: state.electricalTramos.filter((t) => t.id !== tramoId),
      selectedTramoId:
        state.selectedTramoId === tramoId ? null : state.selectedTramoId
    }));
  },

  // Gestión de Cables / Retornos dentro de la Cañería
  addConductorToTramo: (tramoId, conductorData) => {
    const tramo = get().electricalTramos.find((t) => t.id === tramoId);
    if (!tramo) return null;

    const newConductor: ConductorLine = {
      id: `wire-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      ...conductorData
    };

    const updatedConductores = [...(tramo.conductores || []), newConductor];
    const uniqueCircuits = Array.from(new Set(updatedConductores.map((c) => c.circuitoCodigo))).join(', ');

    set((state) => ({
      electricalTramos: state.electricalTramos.map((t) =>
        t.id === tramoId
          ? {
              ...t,
              conductores: updatedConductores,
              circuitoCodigo: uniqueCircuits
            }
          : t
      )
    }));

    return newConductor;
  },

  updateConductorInTramo: (tramoId, conductorId, updates) => {
    set((state) => ({
      electricalTramos: state.electricalTramos.map((t) => {
        if (t.id !== tramoId) return t;
        const updatedConductores = (t.conductores || []).map((c) =>
          c.id === conductorId ? { ...c, ...updates } : c
        );
        const uniqueCircuits = Array.from(new Set(updatedConductores.map((c) => c.circuitoCodigo))).join(', ');
        return {
          ...t,
          conductores: updatedConductores,
          circuitoCodigo: uniqueCircuits
        };
      })
    }));
  },

  removeConductorFromTramo: (tramoId, conductorId) => {
    set((state) => ({
      electricalTramos: state.electricalTramos.map((t) => {
        if (t.id !== tramoId) return t;
        const updatedConductores = (t.conductores || []).filter((c) => c.id !== conductorId);
        const uniqueCircuits = Array.from(new Set(updatedConductores.map((c) => c.circuitoCodigo))).join(', ');
        return {
          ...t,
          conductores: updatedConductores,
          circuitoCodigo: uniqueCircuits
        };
      })
    }));
  },

  addElectricalAsset: (roomId, assetData) => {
    const room = get().rooms.find((r) => r.id === roomId);
    if (!room) return null;

    const newAsset: ElectricalAsset = {
      id: `asset-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      ...assetData
    };

    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.id === roomId
          ? {
              ...r,
              electricalAssets: [...r.electricalAssets, newAsset],
              updatedAt: new Date().toISOString()
            }
          : r
      )
    }));

    return newAsset;
  },

  updateElectricalAsset: (roomId, assetId, updates) => {
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.id === roomId
          ? {
              ...r,
              electricalAssets: r.electricalAssets.map((asset) =>
                asset.id === assetId ? { ...asset, ...updates } : asset
              ),
              updatedAt: new Date().toISOString()
            }
          : r
      )
    }));
  },

  removeElectricalAsset: (roomId, assetId) => {
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.id === roomId
          ? {
              ...r,
              electricalAssets: r.electricalAssets.filter((asset) => asset.id !== assetId),
              updatedAt: new Date().toISOString()
            }
          : r
      )
    }));
  },

  addWallBreak: (roomId, breakData) => {
    let createdBreak: WallBreak | null = null;
    set((state) => {
      const room = state.rooms.find((r) => r.id === roomId);
      if (!room) return state;

      const newBreak: WallBreak = {
        ...breakData,
        id: `break-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
      };
      createdBreak = newBreak;

      const currentBreaks = room.geometry?.wallBreaks || [];
      const updatedGeom = {
        ...(room.geometry || { mode: 'rectangle' as const }),
        wallBreaks: [...currentBreaks, newBreak]
      };

      return {
        rooms: state.rooms.map((r) =>
          r.id === roomId
            ? {
                ...r,
                geometry: updatedGeom,
                updatedAt: new Date().toISOString()
              }
            : r
        )
      };
    });
    return createdBreak;
  },

  updateWallBreak: (roomId, breakId, updates) => {
    set((state) => ({
      rooms: state.rooms.map((r) => {
        if (r.id !== roomId) return r;
        const currentBreaks = r.geometry?.wallBreaks || [];
        const updatedBreaks = currentBreaks.map((b) => (b.id === breakId ? { ...b, ...updates } : b));
        return {
          ...r,
          geometry: {
            ...(r.geometry || { mode: 'rectangle' as const }),
            wallBreaks: updatedBreaks
          },
          updatedAt: new Date().toISOString()
        };
      })
    }));
  },

  removeWallBreak: (roomId, breakId) => {
    set((state) => ({
      rooms: state.rooms.map((r) => {
        if (r.id !== roomId) return r;
        const currentBreaks = r.geometry?.wallBreaks || [];
        return {
          ...r,
          geometry: {
            ...(r.geometry || { mode: 'rectangle' as const }),
            wallBreaks: currentBreaks.filter((b) => b.id !== breakId)
          },
          updatedAt: new Date().toISOString()
        };
      })
    }));
  },

  toggleDimensionLock: (roomId, dimension) => {
    set((state) => ({
      rooms: state.rooms.map((r) => {
        if (r.id !== roomId) return r;
        const currentDims = r.dimensions;
        const lockKey = dimension === 'width' ? 'widthLocked' : 'lengthLocked';
        return {
          ...r,
          dimensions: {
            ...currentDims,
            [lockKey]: !currentDims[lockKey]
          },
          updatedAt: new Date().toISOString()
        };
      })
    }));
  },

  inferDimension: (roomId, dimension, inferredValue) => {
    if (inferredValue <= 0) return;
    set((state) => ({
      rooms: state.rooms.map((r) => {
        if (r.id !== roomId) return r;
        const isLocked = dimension === 'width' ? r.dimensions.widthLocked : r.dimensions.lengthLocked;
        if (isLocked) return r;

        return {
          ...r,
          dimensions: {
            ...r.dimensions,
            [dimension]: Number(inferredValue.toFixed(2))
          },
          updatedAt: new Date().toISOString()
        };
      })
    }));
  },

  updateRoomCanvasPosition: (roomId, position) => {
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.id === roomId ? { ...r, canvasPosition: { ...r.canvasPosition, ...position } } : r
      )
    }));
    get().syncRoomWallAdjacencies(roomId);
  },

  syncRoomWallAdjacencies: (movedRoomId: string) => {
    const { rooms, connections, wallThicknessMeters } = get();
    const movedRoom = rooms.find((r) => r.id === movedRoomId);
    if (!movedRoom) return;

    // Las islas técnicas (jabalina PAT, etc.) no están ancladas a nada
    if (movedRoom.isTechnicalIsland || movedRoom.type.startsWith('technical_island')) {
      return;
    }

    const isNonMetric = !isMetricRoom(movedRoom);
    const mW = isNonMetric ? 180 : metersToPixels(movedRoom.dimensions?.width || 3);
    const mH = isNonMetric ? 100 : metersToPixels(movedRoom.dimensions?.length || 2.5);

    const mLeft = movedRoom.canvasPosition.x;
    const mRight = mLeft + mW;
    const mTop = movedRoom.canvasPosition.y;
    const mBottom = mTop + mH;

    const SNAP_CONTACT_TOLERANCE = 14;

    const newConnections: LogicalConnection[] = [...connections];
    let hasChanged = false;

    for (const other of rooms) {
      if (other.id === movedRoomId) continue;
      if (other.isTechnicalIsland || other.type.startsWith('technical_island')) continue;

      // Dos regiones no métricas entre sí (ej. palier y patio) se mezclan sin crear muros constructivos
      if (!isMetricRoom(movedRoom) && !isMetricRoom(other)) continue;

      const otherIsNonMetric = !isMetricRoom(other);
      const oW = otherIsNonMetric ? 180 : metersToPixels(other.dimensions?.width || 3);
      const oH = otherIsNonMetric ? 100 : metersToPixels(other.dimensions?.length || 2.5);

      const oLeft = other.canvasPosition.x;
      const oRight = oLeft + oW;
      const oTop = other.canvasPosition.y;
      const oBottom = oTop + oH;

      const overlapX = Math.min(mRight, oRight) - Math.max(mLeft, oLeft);
      const overlapY = Math.min(mBottom, oBottom) - Math.max(mTop, oTop);

      let contactFound: { sourceWall: WallOrientation; targetWall: WallOrientation } | null = null;
      let invasionDetected: WallInvasion | null = null;
      const tPx = metersToPixels(wallThicknessMeters);

      // Contacto 1: movedRoom a la derecha de other (muro compartido plano)
      if ((Math.abs(mLeft - (oRight + tPx)) <= SNAP_CONTACT_TOLERANCE || Math.abs(mLeft - oRight) <= SNAP_CONTACT_TOLERANCE) && overlapY > 10) {
        contactFound = { sourceWall: 'west', targetWall: 'east' };
      }
      // Contacto 2: movedRoom a la izquierda de other (muro compartido plano)
      else if ((Math.abs(mRight + tPx - oLeft) <= SNAP_CONTACT_TOLERANCE || Math.abs(mRight - oLeft) <= SNAP_CONTACT_TOLERANCE) && overlapY > 10) {
        contactFound = { sourceWall: 'east', targetWall: 'west' };
      }
      // Contacto 3: movedRoom abajo de other (muro compartido plano)
      else if ((Math.abs(mTop - (oBottom + tPx)) <= SNAP_CONTACT_TOLERANCE || Math.abs(mTop - oBottom) <= SNAP_CONTACT_TOLERANCE) && overlapX > 10) {
        contactFound = { sourceWall: 'north', targetWall: 'south' };
      }
      // Contacto 4: movedRoom arriba de other (muro compartido plano)
      else if ((Math.abs(mBottom + tPx - oTop) <= SNAP_CONTACT_TOLERANCE || Math.abs(mBottom - oTop) <= SNAP_CONTACT_TOLERANCE) && overlapX > 10) {
        contactFound = { sourceWall: 'south', targetWall: 'north' };
      }
      // SUPERPOSICIÓN / AVANCE EN EL PLANO (Invasión Automática de Pared Común)
      else if (isMetricRoom(movedRoom) && isMetricRoom(other) && overlapX > 10 && overlapY > 10) {
        const isContained = (overlapX >= mW * 0.95 && overlapY >= mH * 0.95) || (overlapX >= oW * 0.95 && overlapY >= oH * 0.95);
        if (!isContained) {
          if (overlapX < overlapY) {
            // Penetración horizontal (X)
            if (mLeft < oLeft) {
              contactFound = { sourceWall: 'east', targetWall: 'west' };
              const depthMeters = Number(Math.max(0.1, (overlapX / PIXELS_PER_METER)).toFixed(2));
              const widthMeters = Number((overlapY / PIXELS_PER_METER).toFixed(2));
              invasionDetected = { type: 'source_invades_target', depthMeters, widthMeters };
            } else {
              contactFound = { sourceWall: 'west', targetWall: 'east' };
              const depthMeters = Number(Math.max(0.1, (overlapX / PIXELS_PER_METER)).toFixed(2));
              const widthMeters = Number((overlapY / PIXELS_PER_METER).toFixed(2));
              invasionDetected = { type: 'source_invades_target', depthMeters, widthMeters };
            }
          } else {
            // Penetración vertical (Y)
            if (mTop < oTop) {
              contactFound = { sourceWall: 'south', targetWall: 'north' };
              const depthMeters = Number(Math.max(0.1, (overlapY / PIXELS_PER_METER)).toFixed(2));
              const widthMeters = Number((overlapX / PIXELS_PER_METER).toFixed(2));
              invasionDetected = { type: 'source_invades_target', depthMeters, widthMeters };
            } else {
              contactFound = { sourceWall: 'north', targetWall: 'south' };
              const depthMeters = Number(Math.max(0.1, (overlapY / PIXELS_PER_METER)).toFixed(2));
              const widthMeters = Number((overlapX / PIXELS_PER_METER).toFixed(2));
              invasionDetected = { type: 'source_invades_target', depthMeters, widthMeters };
            }
          }
        }
      }

      if (contactFound) {
        const existing = newConnections.find(
          (c) =>
            (c.sourceRoomId === movedRoom.id && c.targetRoomId === other.id) ||
            (c.sourceRoomId === other.id && c.targetRoomId === movedRoom.id)
        );

        if (existing) {
          const isSourceMoved = existing.sourceRoomId === movedRoom.id;
          if (isSourceMoved) {
            existing.sourceWall = contactFound.sourceWall;
            existing.targetWall = contactFound.targetWall;
          } else {
            existing.sourceWall = contactFound.targetWall;
            existing.targetWall = contactFound.sourceWall;
          }

          if (invasionDetected) {
            const invType = isSourceMoved ? 'source_invades_target' : 'target_invades_source';
            const newInv: WallInvasion = { ...invasionDetected, type: invType };
            if (
              existing.invasion?.type !== newInv.type ||
              Math.abs((existing.invasion?.depthMeters || 0) - newInv.depthMeters!) > 0.04
            ) {
              existing.invasion = newInv;
              existing.label = '🔲 Muro con Quiebre';
              hasChanged = true;
            }
          } else if (existing.invasion && existing.invasion.type !== 'none') {
            existing.invasion = { type: 'none' };
            existing.label = '🧱 Muro Compartido';
            hasChanged = true;
          }
        } else {
          newConnections.push({
            id: `conn-auto-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            sourceRoomId: movedRoom.id,
            targetRoomId: other.id,
            type: 'pared_comun',
            label: invasionDetected ? '🔲 Muro con Quiebre' : '🧱 Muro Compartido',
            sourceWall: contactFound.sourceWall,
            targetWall: contactFound.targetWall,
            sourceHandle: `source-${contactFound.sourceWall}`,
            targetHandle: `target-${contactFound.targetWall}`,
            wallProperties: {
              materialType: 'ladrillo_hueco_8',
              thicknessMeters: wallThicknessMeters,
              canChase: true,
              chasingMethod: 'liviano'
            },
            openings: [],
            hasElectricalPass: false,
            notes: invasionDetected
              ? 'Quiebre deducido automáticamente por avance en el plano'
              : 'Muro compartido fusionado automáticamente por contacto',
            invasion: invasionDetected || undefined
          });
          hasChanged = true;
        }
      }
    }

    if (hasChanged) {
      const updatedRooms = applyInvasionsToRoomGeometries(get().rooms, newConnections);
      set({ connections: newConnections, rooms: updatedRooms });
      get().saveCurrentProjectToDB();
    }
  },

  getOrCreateWallConnection: (roomId: string, wall: WallOrientation): LogicalConnection => {
    const { rooms, connections, wallThicknessMeters } = get();
    const existing = connections.find(
      (c) =>
        (c.sourceRoomId === roomId && c.sourceWall === wall) ||
        (c.targetRoomId === roomId && c.targetWall === wall)
    );
    if (existing) return existing;

    const room = rooms.find((r) => r.id === roomId);
    const rW = metersToPixels(room?.dimensions?.width || 3);
    const rH = metersToPixels(room?.dimensions?.length || 2.5);
    const rLeft = room?.canvasPosition.x || 0;
    const rTop = room?.canvasPosition.y || 0;

    let neighborId: string | undefined;
    let neighborWall: WallOrientation = 'west';

    if (wall === 'east') neighborWall = 'west';
    else if (wall === 'west') neighborWall = 'east';
    else if (wall === 'north') neighborWall = 'south';
    else if (wall === 'south') neighborWall = 'north';

    for (const other of rooms) {
      if (other.id === roomId) continue;
      const oW = metersToPixels(other.dimensions?.width || 3);
      const oH = metersToPixels(other.dimensions?.length || 2.5);
      const oLeft = other.canvasPosition.x;
      const oTop = other.canvasPosition.y;

      const tPx = metersToPixels(wallThicknessMeters);
      if (wall === 'east' && (Math.abs(rLeft + rW + tPx - oLeft) <= 18 || Math.abs(rLeft + rW - oLeft) <= 18)) neighborId = other.id;
      else if (wall === 'west' && (Math.abs(rLeft - (oLeft + oW + tPx)) <= 18 || Math.abs(rLeft - (oLeft + oW)) <= 18)) neighborId = other.id;
      else if (wall === 'south' && (Math.abs(rTop + rH + tPx - oTop) <= 18 || Math.abs(rTop + rH - oTop) <= 18)) neighborId = other.id;
      else if (wall === 'north' && (Math.abs(rTop - (oTop + oH + tPx)) <= 18 || Math.abs(rTop - (oTop + oH)) <= 18)) neighborId = other.id;
      if (neighborId) break;
    }

    const newConn: LogicalConnection = {
      id: `conn-wall-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sourceRoomId: roomId,
      targetRoomId: neighborId || roomId,
      type: 'pared_comun',
      label: neighborId ? '🧱 Muro Compartido' : '🧱 Muro Exterior',
      sourceWall: wall,
      targetWall: neighborWall,
      sourceHandle: `source-${wall}`,
      targetHandle: `target-${neighborWall}`,
      wallProperties: {
        materialType: 'ladrillo_hueco_8',
        thicknessMeters: wallThicknessMeters,
        canChase: true,
        chasingMethod: 'liviano'
      },
      openings: [],
      hasElectricalPass: false,
      notes: ''
    };

    set((state) => ({ connections: [...state.connections, newConn] }));
    get().saveCurrentProjectToDB();
    return newConn;
  },

  autoAssembleRooms: () => {
    const { rooms, connections } = get();
    const assembledRooms = solveAutoAssembly(rooms, connections);
    set({ rooms: assembledRooms });
  },

  setSnapGuides: (guides) => set({ activeSnapGuides: guides }),

  toggleSnap: (enabled) =>
    set((state) => ({
      isSnapEnabled: enabled !== undefined ? enabled : !state.isSnapEnabled
    })),

  // Asistente de Relevamiento Incremental
  setAcceptableErrorThreshold: (thresholdMeters) =>
    set({ acceptableErrorThresholdMeters: thresholdMeters }),

  toggleAssistantOpen: (open) =>
    set((state) => ({
      isAssistantOpen: open !== undefined ? open : !state.isAssistantOpen
    })),

  answerIncrementalQuestion: (question, value) => {
    if (question.targetType === 'edge_measure') {
      const conn = get().connections.find((c) => c.id === question.targetId);
      if (conn && conn.type !== 'pared_comun') {
        const currentOpenings = getConnectionOpenings(conn);
        const updatedOpenings = currentOpenings.length > 0
          ? currentOpenings.map((op, idx) =>
              idx === 0
                ? {
                    ...op,
                    widthMeters: Number(value.toFixed(2))
                  }
                : op
            )
          : [
              {
                id: `open-${Date.now()}`,
                openingType: conn.type,
                widthMeters: Number(value.toFixed(2)),
                heightMeters: 2.05,
                sillHeightMeters: 0,
                swingDirection: 'right' as const
              }
            ];

        get().updateConnection(conn.id, {
          openings: updatedOpenings,
          opening: updatedOpenings[0]
        });
      }
    } else if (question.targetType === 'room_width') {
      const room = get().rooms.find((r) => r.id === question.targetId);
      if (room) {
        get().updateRoom(room.id, {
          dimensions: {
            ...room.dimensions,
            width: Number(value.toFixed(2)),
            widthLocked: true
          }
        });
      }
    } else if (question.targetType === 'room_length') {
      const room = get().rooms.find((r) => r.id === question.targetId);
      if (room) {
        get().updateRoom(room.id, {
          dimensions: {
            ...room.dimensions,
            length: Number(value.toFixed(2)),
            lengthLocked: true
          }
        });
      }
    }

    // Auto-ensamblar inmediatamente con la nueva restricción geométrica confirmada
    get().autoAssembleRooms();
  },

  setProjectMetadata: (meta) => {
    set((state) => ({
      currentProjectName: meta.nombre !== undefined ? meta.nombre : state.currentProjectName,
      ubicacionObra: meta.ubicacion !== undefined ? meta.ubicacion : state.ubicacionObra,
      descripcionObra: meta.descripcion !== undefined ? meta.descripcion : state.descripcionObra,
      rumboFrente: meta.rumboFrente !== undefined ? meta.rumboFrente : state.rumboFrente,
      azimutGrados: meta.azimutGrados !== undefined ? meta.azimutGrados : state.azimutGrados
    }));
    get().saveCurrentProjectToDB();
  },

  setClienteInfo: (clienteUpdates) => {
    set((state) => ({
      clienteInfo: {
        ...state.clienteInfo,
        ...clienteUpdates,
        updatedAt: new Date().toISOString()
      }
    }));
    get().saveCurrentProjectToDB();
  },

  saveCurrentProjectToDB: async () => {
    const state = get();
    set({ isAutoSaving: true });
    try {
      const project: RelevamientoProyecto = {
        id: state.currentProjectId,
        nombre: state.currentProjectName,
        clienteId: state.clienteInfo.id,
        clienteNombre: state.clienteInfo.nombre,
        clienteTelefono: state.clienteInfo.telefono,
        clienteEmail: state.clienteInfo.email,
        clienteDireccion: state.clienteInfo.direccion,
        clienteCuitDni: state.clienteInfo.cuitDni,
        ubicacion: state.ubicacionObra,
        descripcion: state.descripcionObra,
        rumboFrente: state.rumboFrente,
        azimutGrados: state.azimutGrados,
        rooms: state.rooms,
        connections: state.connections,
        electricalNodes: state.electricalNodes,
        electricalTramos: state.electricalTramos,
        wallThicknessMeters: state.wallThicknessMeters,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await saveProject(project);
      await autoSaveActiveSession(project);
      set({ isAutoSaving: false, lastSavedAt: new Date().toLocaleTimeString() });
      return project.id;
    } catch (err) {
      console.warn('[RelevaCadDB] Error al guardar proyecto:', err);
      set({ isAutoSaving: false });
      return state.currentProjectId;
    }
  },

  loadProjectFromDB: async (projectId: string) => {
    const project = await getProjectById(projectId);
    if (project) {
      set({
        currentProjectId: project.id,
        currentProjectName: project.nombre,
        clienteInfo: {
          id: project.clienteId || `cli-${Date.now()}`,
          nombre: project.clienteNombre || 'Cliente sin asignar',
          telefono: project.clienteTelefono,
          email: project.clienteEmail,
          direccion: project.clienteDireccion,
          cuitDni: project.clienteCuitDni
        },
        ubicacionObra: project.ubicacion || '',
        descripcionObra: project.descripcion || '',
        rumboFrente: project.rumboFrente || 'Norte',
        azimutGrados: project.azimutGrados || 0,
        rooms: project.rooms || [],
        connections: project.connections || [],
        electricalNodes: project.electricalNodes || [],
        electricalTramos: project.electricalTramos || [],
        wallThicknessMeters: project.wallThicknessMeters || 0.10,
        selectedRoomId: project.rooms?.[0]?.id || null,
        selectedConnectionId: null,
        selectedElectricalNodeId: null,
        selectedTramoId: null,
        lastSavedAt: new Date(project.updatedAt).toLocaleTimeString()
      });
    }
  },

  createNewProject: (nombre = 'Nuevo Relevamiento', clienteNombre = 'Nuevo Cliente') => {
    const newProjId = `proj-${Date.now()}`;
    const newCliId = `cli-${Date.now()}`;
    set({
      currentProjectId: newProjId,
      currentProjectName: nombre,
      clienteInfo: {
        id: newCliId,
        nombre: clienteNombre,
        createdAt: new Date().toISOString()
      },
      ubicacionObra: '',
      descripcionObra: '',
      rumboFrente: 'Norte',
      azimutGrados: 0,
      rooms: [],
      connections: [],
      electricalNodes: [],
      electricalTramos: [],
      selectedRoomId: null,
      selectedConnectionId: null,
      selectedElectricalNodeId: null,
      selectedTramoId: null,
      lastSavedAt: null
    });
    get().saveCurrentProjectToDB();
  },

  exportProjectToCotizadorJSON: () => {
    const state = get();
    const project: RelevamientoProyecto = {
      id: state.currentProjectId,
      nombre: state.currentProjectName,
      clienteId: state.clienteInfo.id,
      clienteNombre: state.clienteInfo.nombre,
      clienteTelefono: state.clienteInfo.telefono,
      clienteEmail: state.clienteInfo.email,
      clienteDireccion: state.clienteInfo.direccion,
      clienteCuitDni: state.clienteInfo.cuitDni,
      ubicacion: state.ubicacionObra,
      descripcion: state.descripcionObra,
      rooms: state.rooms,
      connections: state.connections,
      electricalNodes: state.electricalNodes,
      electricalTramos: state.electricalTramos,
      wallThicknessMeters: state.wallThicknessMeters,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    downloadCotizadorIebaJSON(project);
  },

  loadSampleData: () => {
    const assembledRooms = solveAutoAssembly(INITIAL_ROOMS, INITIAL_CONNECTIONS);
    set({
      rooms: assembledRooms,
      connections: INITIAL_CONNECTIONS,
      electricalNodes: INITIAL_ELECTRICAL_NODES,
      electricalTramos: INITIAL_ELECTRICAL_TRAMOS,
      selectedRoomId: 'room-1788362611903',
      selectedConnectionId: null,
      selectedElectricalNodeId: null,
      selectedTramoId: null,
      wallThicknessMeters: 0.10,
      acceptableErrorThresholdMeters: 0.05,
      isAssistantOpen: false,
      topologyLayer: 'architectural'
    });
    get().saveCurrentProjectToDB();
  },

  resetProject: () => {
    set({
      rooms: [],
      connections: [],
      electricalNodes: [],
      electricalTramos: [],
      selectedRoomId: null,
      selectedConnectionId: null,
      selectedElectricalNodeId: null,
      selectedTramoId: null,
      acceptableErrorThresholdMeters: 0.05,
      isAssistantOpen: false,
      activeSnapGuides: []
    });
    get().saveCurrentProjectToDB();
  }
}));
