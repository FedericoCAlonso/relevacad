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
import { Room, ElectricalAsset, WallOrientation, WallBreak, ROOM_TYPE_CATALOG } from '@/models/RoomModel';
import {
  LogicalConnection,
  LogicalConnectionType,
  CONNECTION_TYPE_CATALOG
} from '@/models/GraphModel';
import {
  NodoElectrico,
  TramoElectrico,
  ConductorLine,
  TIPO_NODO_ELECTRICO_CATALOG
} from '@/models/ElectricalGraphModel';
import { SnapGuideLine } from './utils/snappingCalculator';

export type SurveyPhase = 'topology' | 'parametrization' | 'assembly';
export type TopologyLayerMode = 'architectural' | 'electrical' | 'unified';

export interface SurveyState {
  // Estado del Modelo Arquitectónico
  rooms: Room[];
  connections: LogicalConnection[];
  selectedRoomId: string | null;
  selectedConnectionId: string | null;
  activePhase: SurveyPhase;

  // Parámetros Constructivos
  wallThicknessMeters: number; // Espesor de muros (default 0.10m = 10cm)

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

  // Operaciones sobre Conexiones / Aberturas Arquitectónicas
  connectRooms: (
    sourceRoomId: string,
    targetRoomId: string,
    type?: LogicalConnectionType,
    label?: string,
    sourceHandle?: string,
    targetHandle?: string
  ) => LogicalConnection | null;
  updateConnection: (connectionId: string, updates: Partial<LogicalConnection>) => void;
  removeConnection: (connectionId: string) => void;

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

  // Operaciones sobre el Canvas 2D (Ensamblaje)
  updateRoomCanvasPosition: (roomId: string, position: { x: number; y: number }) => void;
  setSnapGuides: (guides: SnapGuideLine[]) => void;
  toggleSnap: (enabled?: boolean) => void;

  // Utilidades
  loadSampleData: () => void;
  resetProject: () => void;
}

// =============================================================================
// DATOS DE DEMOSTRACIÓN: DEPARTAMENTO 3 AMBIENTES (~61.6 m² CONSTRUIDO)
// Grado de Electrificación Medio (AEA 90364-771) - TSG en Cocina
// =============================================================================

const INITIAL_ROOMS: Room[] = [
  // 1. ISLA TÉCNICA: Sala de Medidores (Subsuelo)
  {
    id: 'room-island-meters',
    name: 'Sala de Medidores (Subsuelo)',
    type: 'technical_island_meters',
    isTechnicalIsland: true,
    isCommonArea: true,
    dimensions: { width: 0, length: 0, height: 0 },
    canvasPosition: { x: 20, y: 30 },
    topologyPosition: { x: 40, y: 40 },
    color: '#fef3c7',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    electricalAssets: []
  },

  // 2. PARTE COMÚN: Palier 3º Piso (Oeste del Estar)
  {
    id: 'room-palier',
    name: 'Palier 3º Piso',
    type: 'access_palier',
    isAccessPoint: true,
    isCommonArea: true,
    dimensions: { width: 0, length: 0, height: 0 },
    canvasPosition: { x: 10, y: 360 },
    topologyPosition: { x: 40, y: 260 },
    color: '#f0fdf4',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    electricalAssets: []
  },

  // 3. AMBIENTE PRINCIPAL: Estar / Comedor (4.20m x 4.80m = 20.16 m²)
  {
    id: 'room-living',
    name: 'Estar / Comedor',
    type: 'living',
    isAccessPoint: false,
    dimensions: { width: 4.2, length: 4.8, height: 2.6 },
    canvasPosition: { x: 180, y: 315 },
    topologyPosition: { x: 380, y: 240 },
    color: '#f8fafc',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    electricalAssets: [
      {
        id: 'asset-liv-sw1',
        type: 'switch_1_module',
        label: 'Llave de Luz Entrada',
        wall: 'west',
        offsetRatio: 0.2,
        offsetMeters: 0.96,
        heightFromFloor: 1.2,
        circuitCode: 'C1-IUG'
      },
      {
        id: 'asset-liv-luz1',
        type: 'ceiling_light',
        label: 'Boca Techo Centro Comedor',
        wall: 'ceiling',
        offsetRatio: 0.5,
        offsetMeters: 2.1,
        heightFromFloor: 2.6,
        circuitCode: 'C1-IUG'
      },
      {
        id: 'asset-liv-tug1',
        type: 'double_outlet_10a',
        label: 'Tomas TV / Audio (Norte)',
        wall: 'north',
        offsetRatio: 0.7,
        offsetMeters: 2.94,
        heightFromFloor: 0.35,
        circuitCode: 'C2-TUG'
      },
      {
        id: 'asset-liv-tug2',
        type: 'single_outlet_10a',
        label: 'Toma Sillón / Estar (Sur)',
        wall: 'south',
        offsetRatio: 0.5,
        offsetMeters: 2.1,
        heightFromFloor: 0.35,
        circuitCode: 'C2-TUG'
      },
      {
        id: 'asset-liv-tue1',
        type: 'outlet_20a',
        label: 'Toma Aire Acondicionado AA-1 (20A)',
        wall: 'east',
        offsetRatio: 0.8,
        offsetMeters: 3.84,
        heightFromFloor: 2.2,
        circuitCode: 'C4-TUE'
      }
    ]
  },

  // 4. BALCÓN TERRAZA: Al Este del Estar (1.20m x 4.80m = 5.76 m²)
  {
    id: 'room-balcony',
    name: 'Balcón Terraza',
    type: 'balcony',
    isAccessPoint: false,
    dimensions: { width: 1.2, length: 4.8, height: 2.6 },
    canvasPosition: { x: 390, y: 315 },
    topologyPosition: { x: 740, y: 240 },
    color: '#f7fee7',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    electricalAssets: [
      {
        id: 'asset-balc-luz',
        type: 'wall_light',
        label: 'Aplique Exterior Estanco IP65',
        wall: 'west',
        offsetRatio: 0.5,
        offsetMeters: 2.4,
        heightFromFloor: 2.0,
        circuitCode: 'C1-IUG'
      },
      {
        id: 'asset-balc-tug',
        type: 'single_outlet_10a',
        label: 'Toma Exterior con Tapa IP55',
        wall: 'west',
        offsetRatio: 0.8,
        offsetMeters: 3.84,
        heightFromFloor: 0.4,
        circuitCode: 'C2-TUG'
      }
    ]
  },

  // 5. LÍMITE EXTERIOR: Calle / Línea Municipal
  {
    id: 'room-street',
    name: 'Calle / Línea Municipal',
    type: 'access_street',
    isAccessPoint: true,
    isCommonArea: true,
    dimensions: { width: 0, length: 0, height: 0 },
    canvasPosition: { x: 480, y: 315 },
    topologyPosition: { x: 1080, y: 240 },
    color: '#ecfdf5',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    electricalAssets: []
  },

  // 6. COCINA: Al Norte del Estar (2.00m x 3.20m = 6.40 m²) - CONTIENE EL TSG
  {
    id: 'room-kitchen',
    name: 'Cocina (Ubicación TSG)',
    type: 'kitchen',
    isAccessPoint: false,
    dimensions: { width: 2.0, length: 3.2, height: 2.6 },
    canvasPosition: { x: 180, y: 155 },
    topologyPosition: { x: 380, y: -40 },
    color: '#fffbeb',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    electricalAssets: [
      {
        id: 'asset-kitch-tsg',
        type: 'sub_panel',
        label: 'Tablero Seccional General (TSG 18 DIN)',
        wall: 'south',
        offsetRatio: 0.3,
        offsetMeters: 0.6,
        heightFromFloor: 1.5,
        circuitCode: 'ALIM-GRAL',
        notes: 'ID 2x40A 30mA + PIAs C1-IUG (10A), C2-TUG (16A), C3-TUG (16A), C4-TUE (20A)'
      },
      {
        id: 'asset-kitch-luz',
        type: 'ceiling_light',
        label: 'Panel LED Techo Cocina',
        wall: 'ceiling',
        offsetRatio: 0.5,
        offsetMeters: 1.0,
        heightFromFloor: 2.6,
        circuitCode: 'C1-IUG'
      },
      {
        id: 'asset-kitch-tug1',
        type: 'double_outlet_10a',
        label: 'Tomas Mesada / Electrodomésticos',
        wall: 'east',
        offsetRatio: 0.4,
        offsetMeters: 1.28,
        heightFromFloor: 1.1,
        circuitCode: 'C3-TUG'
      },
      {
        id: 'asset-kitch-tug2',
        type: 'single_outlet_10a',
        label: 'Toma Heladera (Sur)',
        wall: 'south',
        offsetRatio: 0.8,
        offsetMeters: 1.6,
        heightFromFloor: 0.6,
        circuitCode: 'C3-TUG'
      },
      {
        id: 'asset-kitch-tue1',
        type: 'outlet_20a',
        label: 'Toma Horno Eléctrico / Anafe (20A)',
        wall: 'east',
        offsetRatio: 0.7,
        offsetMeters: 2.24,
        heightFromFloor: 0.6,
        circuitCode: 'C4-TUE'
      }
    ]
  },

  // 7. LAVADERO: Al fondo de la cocina (2.00m x 1.50m = 3.00 m²)
  {
    id: 'room-laundry',
    name: 'Lavadero',
    type: 'laundry',
    isAccessPoint: false,
    dimensions: { width: 2.0, length: 1.5, height: 2.6 },
    canvasPosition: { x: 180, y: 80 },
    topologyPosition: { x: 380, y: -240 },
    color: '#f1f5f9',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    electricalAssets: [
      {
        id: 'asset-laun-luz',
        type: 'ceiling_light',
        label: 'Boca Luz Lavadero',
        wall: 'ceiling',
        offsetRatio: 0.5,
        offsetMeters: 1.0,
        heightFromFloor: 2.6,
        circuitCode: 'C1-IUG'
      },
      {
        id: 'asset-laun-tug1',
        type: 'single_outlet_10a',
        label: 'Toma Lavarropas Automático',
        wall: 'north',
        offsetRatio: 0.5,
        offsetMeters: 1.0,
        heightFromFloor: 1.1,
        circuitCode: 'C3-TUG'
      },
      {
        id: 'asset-laun-tue1',
        type: 'outlet_20a',
        label: 'Toma Termotanque Eléctrico (20A)',
        wall: 'west',
        offsetRatio: 0.4,
        offsetMeters: 0.6,
        heightFromFloor: 1.5,
        circuitCode: 'C4-TUE'
      }
    ]
  },

  // 8. PASILLO / CIRCULACIÓN INTERNA (1.20m x 2.80m = 3.36 m²)
  {
    id: 'room-hallway',
    name: 'Circulación Interna',
    type: 'hall',
    isAccessPoint: false,
    dimensions: { width: 1.2, length: 2.8, height: 2.6 },
    canvasPosition: { x: 280, y: 175 },
    topologyPosition: { x: 380, y: 520 },
    color: '#f8fafc',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    electricalAssets: [
      {
        id: 'asset-hall-sw',
        type: 'switch_combo',
        label: 'Llave Conmutada Pasillo',
        wall: 'south',
        offsetRatio: 0.5,
        offsetMeters: 0.6,
        heightFromFloor: 1.2,
        circuitCode: 'C1-IUG'
      },
      {
        id: 'asset-hall-luz',
        type: 'ceiling_light',
        label: 'Boca Luz Pasillo',
        wall: 'ceiling',
        offsetRatio: 0.5,
        offsetMeters: 0.6,
        heightFromFloor: 2.6,
        circuitCode: 'C1-IUG'
      },
      {
        id: 'asset-hall-tug',
        type: 'single_outlet_10a',
        label: 'Toma de Servicio Pasillo',
        wall: 'east',
        offsetRatio: 0.5,
        offsetMeters: 1.4,
        heightFromFloor: 0.35,
        circuitCode: 'C2-TUG'
      }
    ]
  },

  // 9. HABITACIÓN PRINCIPAL: Al Este de la Circulación (3.20m x 3.60m = 11.52 m²)
  {
    id: 'room-bedroom-main',
    name: 'Habitación Principal',
    type: 'bedroom',
    isAccessPoint: false,
    dimensions: { width: 3.2, length: 3.6, height: 2.6 },
    canvasPosition: { x: 340, y: 135 },
    topologyPosition: { x: 740, y: 520 },
    color: '#fdf4ff',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    electricalAssets: [
      {
        id: 'asset-bedm-sw',
        type: 'switch_1_module',
        label: 'Llave de Luz Puerta',
        wall: 'west',
        offsetRatio: 0.2,
        offsetMeters: 0.72,
        heightFromFloor: 1.2,
        circuitCode: 'C1-IUG'
      },
      {
        id: 'asset-bedm-luz',
        type: 'ceiling_light',
        label: 'Boca Techo Centro Dormitorio',
        wall: 'ceiling',
        offsetRatio: 0.5,
        offsetMeters: 1.6,
        heightFromFloor: 2.6,
        circuitCode: 'C1-IUG'
      },
      {
        id: 'asset-bedm-tug1',
        type: 'double_outlet_10a',
        label: 'Tomas Mesa de Luz Izquierda',
        wall: 'north',
        offsetRatio: 0.3,
        offsetMeters: 0.96,
        heightFromFloor: 0.6,
        circuitCode: 'C2-TUG'
      },
      {
        id: 'asset-bedm-tug2',
        type: 'double_outlet_10a',
        label: 'Tomas Mesa de Luz Derecha',
        wall: 'north',
        offsetRatio: 0.7,
        offsetMeters: 2.24,
        heightFromFloor: 0.6,
        circuitCode: 'C2-TUG'
      },
      {
        id: 'asset-bedm-tue',
        type: 'outlet_20a',
        label: 'Toma Aire Acondicionado AA-2',
        wall: 'east',
        offsetRatio: 0.8,
        offsetMeters: 2.88,
        heightFromFloor: 2.2,
        circuitCode: 'C4-TUE'
      }
    ]
  },

  // 10. HABITACIÓN PEQUEÑA: Al Oeste (2.60m x 3.00m = 7.80 m²)
  {
    id: 'room-bedroom-small',
    name: 'Habitación Pequeña',
    type: 'bedroom',
    isAccessPoint: false,
    dimensions: { width: 2.6, length: 3.0, height: 2.6 },
    canvasPosition: { x: 50, y: 80 },
    topologyPosition: { x: 40, y: 520 },
    color: '#fdf4ff',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    electricalAssets: [
      {
        id: 'asset-beds-sw',
        type: 'switch_1_module',
        label: 'Llave de Luz Entrada',
        wall: 'east',
        offsetRatio: 0.2,
        offsetMeters: 0.6,
        heightFromFloor: 1.2,
        circuitCode: 'C1-IUG'
      },
      {
        id: 'asset-beds-luz',
        type: 'ceiling_light',
        label: 'Boca Techo Centro',
        wall: 'ceiling',
        offsetRatio: 0.5,
        offsetMeters: 1.3,
        heightFromFloor: 2.6,
        circuitCode: 'C1-IUG'
      },
      {
        id: 'asset-beds-tug1',
        type: 'double_outlet_10a',
        label: 'Tomas Escritorio / PC',
        wall: 'south',
        offsetRatio: 0.5,
        offsetMeters: 1.3,
        heightFromFloor: 0.75,
        circuitCode: 'C2-TUG'
      },
      {
        id: 'asset-beds-tug2',
        type: 'single_outlet_10a',
        label: 'Toma Cama',
        wall: 'north',
        offsetRatio: 0.4,
        offsetMeters: 1.04,
        heightFromFloor: 0.35,
        circuitCode: 'C2-TUG'
      }
    ]
  },

  // 11. BAÑO COMPLETO: Al Oeste (1.80m x 2.00m = 3.60 m²)
  {
    id: 'room-bathroom',
    name: 'Baño Completo',
    type: 'bathroom',
    isAccessPoint: false,
    dimensions: { width: 1.8, length: 2.0, height: 2.4 },
    canvasPosition: { x: 90, y: 230 },
    topologyPosition: { x: 40, y: 760 },
    color: '#f0fdfa',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    electricalAssets: [
      {
        id: 'asset-bath-sw',
        type: 'switch_1_module',
        label: 'Llave de Luz Exterior Baño',
        wall: 'east',
        offsetRatio: 0.2,
        offsetMeters: 0.4,
        heightFromFloor: 1.2,
        circuitCode: 'C1-IUG'
      },
      {
        id: 'asset-bath-luz1',
        type: 'ceiling_light',
        label: 'Luz Techo General Baño',
        wall: 'ceiling',
        offsetRatio: 0.5,
        offsetMeters: 0.9,
        heightFromFloor: 2.4,
        circuitCode: 'C1-IUG'
      },
      {
        id: 'asset-bath-luz2',
        type: 'wall_light',
        label: 'Aplique Espejo / Vanitory',
        wall: 'north',
        offsetRatio: 0.5,
        offsetMeters: 0.9,
        heightFromFloor: 1.8,
        circuitCode: 'C1-IUG'
      },
      {
        id: 'asset-bath-tug',
        type: 'single_outlet_10a',
        label: 'Toma Afeitadora Zona 3 (IPX4)',
        wall: 'north',
        offsetRatio: 0.8,
        offsetMeters: 1.44,
        heightFromFloor: 1.3,
        circuitCode: 'C2-TUG',
        notes: 'Ubicado fuera de zona 0, 1 y 2 de seguridad eléctrica'
      }
    ]
  },

  // 12. ÁREA COMÚN: Patio de Aire y Luz del Edificio
  {
    id: 'room-shaft-air',
    name: 'Aire y Luz (Patio Interno)',
    type: 'access_patio',
    isAccessPoint: true,
    isCommonArea: true,
    dimensions: { width: 0, length: 0, height: 0 },
    canvasPosition: { x: -80, y: 90 },
    topologyPosition: { x: -280, y: 520 },
    color: '#f0fdf4',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    electricalAssets: []
  }
];

// =============================================================================
// CONEXIONES Y ABERTURAS ARQUITECTÓNICAS ORIENTADAS (N, S, E, O)
// =============================================================================

const INITIAL_CONNECTIONS: LogicalConnection[] = [
  // 1. Palier (Pared Este) -> Estar (Pared Oeste) [Puerta Principal de Seguridad]
  {
    id: 'conn-palier-living',
    sourceRoomId: 'room-palier',
    targetRoomId: 'room-living',
    type: 'puerta_seguridad',
    label: 'Puerta Principal (0.90m)',
    sourceWall: 'east',
    targetWall: 'west',
    sourceHandle: 'source-east',
    targetHandle: 'target-west',
    opening: {
      openingType: 'puerta_seguridad',
      widthMeters: 0.90,
      heightMeters: 2.05,
      swingDirection: 'right',
      material: 'steel',
      hasAutomation: true,
      notes: 'Portero visor y cerradura de seguridad'
    }
  },

  // 2. Estar (Pared Norte) -> Cocina (Pared Sur) [Vano Libre]
  {
    id: 'conn-living-kitchen',
    sourceRoomId: 'room-living',
    targetRoomId: 'room-kitchen',
    type: 'vano_libre',
    label: 'Vano Cocina (1.40m)',
    sourceWall: 'north',
    targetWall: 'south',
    sourceHandle: 'source-north',
    targetHandle: 'target-south',
    opening: {
      openingType: 'vano_libre',
      widthMeters: 1.40,
      heightMeters: 2.20,
      swingDirection: 'fixed'
    }
  },

  // 3. Cocina (Pared Norte) -> Lavadero (Pared Sur) [Paso Libre]
  {
    id: 'conn-kitchen-laundry',
    sourceRoomId: 'room-kitchen',
    targetRoomId: 'room-laundry',
    type: 'vano_libre',
    label: 'Paso Lavadero (0.80m)',
    sourceWall: 'north',
    targetWall: 'south',
    sourceHandle: 'source-north',
    targetHandle: 'target-south',
    opening: {
      openingType: 'vano_libre',
      widthMeters: 0.80,
      heightMeters: 2.10,
      swingDirection: 'fixed'
    }
  },

  // 4. Estar (Pared Este) -> Balcón (Pared Oeste) [Puerta-Ventana Balcón]
  {
    id: 'conn-living-balcony',
    sourceRoomId: 'room-living',
    targetRoomId: 'room-balcony',
    type: 'puerta_ventana',
    label: 'Puerta-Ventana Balcón (2.00m)',
    sourceWall: 'east',
    targetWall: 'west',
    sourceHandle: 'source-east',
    targetHandle: 'target-west',
    opening: {
      openingType: 'puerta_ventana',
      widthMeters: 2.00,
      heightMeters: 2.05,
      sillHeightMeters: 0.0,
      swingDirection: 'sliding',
      material: 'aluminum'
    }
  },

  // 5. Balcón (Pared Este) -> Calle [Límite Exterior / Frente]
  {
    id: 'conn-balcony-street',
    sourceRoomId: 'room-balcony',
    targetRoomId: 'room-street',
    type: 'vano_libre',
    label: 'Baranda al Frente L.M.',
    sourceWall: 'east',
    targetWall: 'west',
    sourceHandle: 'source-east',
    targetHandle: 'target-west',
    opening: {
      openingType: 'vano_libre',
      widthMeters: 3.80,
      heightMeters: 1.10,
      swingDirection: 'fixed'
    }
  },

  // 6. Estar (Pared Norte) -> Circulación Interna (Pared Sur) [Paso Distribuidor]
  {
    id: 'conn-living-hallway',
    sourceRoomId: 'room-living',
    targetRoomId: 'room-hallway',
    type: 'vano_libre',
    label: 'Paso Pasillo (1.00m)',
    sourceWall: 'north',
    targetWall: 'south',
    sourceHandle: 'source-north',
    targetHandle: 'target-south',
    opening: {
      openingType: 'vano_libre',
      widthMeters: 1.00,
      heightMeters: 2.10,
      swingDirection: 'fixed'
    }
  },

  // 7. Circulación (Pared Este) -> Habitación Principal (Pared Oeste) [Puerta Placa]
  {
    id: 'conn-hallway-bedmain',
    sourceRoomId: 'room-hallway',
    targetRoomId: 'room-bedroom-main',
    type: 'puerta_estandar',
    label: 'Puerta Dorm. Principal (0.80m)',
    sourceWall: 'east',
    targetWall: 'west',
    sourceHandle: 'source-east',
    targetHandle: 'target-west',
    opening: {
      openingType: 'puerta_estandar',
      widthMeters: 0.80,
      heightMeters: 2.05,
      swingDirection: 'right',
      material: 'wood'
    }
  },

  // 8. Circulación (Pared Oeste) -> Habitación Pequeña (Pared Este) [Puerta Placa]
  {
    id: 'conn-hallway-bedsmall',
    sourceRoomId: 'room-hallway',
    targetRoomId: 'room-bedroom-small',
    type: 'puerta_estandar',
    label: 'Puerta Dorm. Pequeño (0.80m)',
    sourceWall: 'west',
    targetWall: 'east',
    sourceHandle: 'source-west',
    targetHandle: 'target-east',
    opening: {
      openingType: 'puerta_estandar',
      widthMeters: 0.80,
      heightMeters: 2.05,
      swingDirection: 'left',
      material: 'wood'
    }
  },

  // 9. Circulación (Pared Oeste) -> Baño (Pared Este) [Puerta Baño]
  {
    id: 'conn-hallway-bath',
    sourceRoomId: 'room-hallway',
    targetRoomId: 'room-bathroom',
    type: 'puerta_estandar',
    label: 'Puerta Baño (0.75m)',
    sourceWall: 'west',
    targetWall: 'east',
    sourceHandle: 'source-west',
    targetHandle: 'target-east',
    opening: {
      openingType: 'puerta_estandar',
      widthMeters: 0.75,
      heightMeters: 2.05,
      swingDirection: 'left',
      material: 'wood'
    }
  },

  // 10. Habitación Principal (Pared Este) -> Balcón (Pared Oeste) [Ventana al Balcón]
  {
    id: 'conn-bedmain-balcony',
    sourceRoomId: 'room-bedroom-main',
    targetRoomId: 'room-balcony',
    type: 'ventana_estandar',
    label: 'Ventana al Balcón (1.50m)',
    sourceWall: 'east',
    targetWall: 'west',
    sourceHandle: 'source-east',
    targetHandle: 'target-west',
    opening: {
      openingType: 'ventana_estandar',
      widthMeters: 1.50,
      heightMeters: 1.10,
      sillHeightMeters: 0.90,
      swingDirection: 'sliding',
      material: 'aluminum'
    }
  },

  // 11. Habitación Pequeña (Pared Oeste) -> Aire y Luz [Ventana a Patio Interno]
  {
    id: 'conn-bedsmall-airshaft',
    sourceRoomId: 'room-bedroom-small',
    targetRoomId: 'room-shaft-air',
    type: 'ventana_estandar',
    label: 'Ventana a Aire y Luz (1.20m)',
    sourceWall: 'west',
    targetWall: 'east',
    sourceHandle: 'source-west',
    targetHandle: 'target-east',
    opening: {
      openingType: 'ventana_estandar',
      widthMeters: 1.20,
      heightMeters: 1.10,
      sillHeightMeters: 0.90,
      swingDirection: 'sliding',
      material: 'aluminum'
    }
  }
];

// =============================================================================
// NODOS ELÉCTRICOS EN AMBIENTES E ISLAS TÉCNICAS
// =============================================================================

const INITIAL_ELECTRICAL_NODES: NodoElectrico[] = [
  // Medidor en Sala de Medidores (Subsuelo)
  {
    id: 'node-medidor',
    roomId: 'room-island-meters',
    tipo: 'medidor_kwh',
    etiqueta: 'Medidor Depto 3 Amb',
    codigoRef: 'MED-3A',
    circuitoCodigo: 'ALIM-GRAL',
    tensionNominalV: 220,
    notas: 'Medidor monofásico tarifa T1R 220V'
  },
  // Caja de Paso en Palier 3º Piso (Montante)
  {
    id: 'node-cp-palier',
    roomId: 'room-palier',
    tipo: 'caja_paso_comun',
    etiqueta: 'Caja de Paso Palier 3°P',
    codigoRef: 'CP-PALIER-P3',
    circuitoCodigo: 'ALIM-GRAL',
    notas: 'Caja 200x200 mm en pleno montante vertical'
  },
  // Tablero Seccional General (TSG) en la COCINA
  {
    id: 'node-tsg-cocina',
    roomId: 'room-kitchen',
    tipo: 'tablero_seccional',
    etiqueta: 'Tablero Seccional General (TSG)',
    codigoRef: 'TSG-01',
    circuitoCodigo: 'ALIM-TSG',
    tensionNominalV: 220,
    notas: 'Ubicado en Cocina según requerimiento. Cabecera ID 2x40A 30mA + 4 Circuitos'
  },
  // Bocas Terminales para los 4 Circuitos según AEA Medio
  {
    id: 'node-luz-cocina',
    roomId: 'room-kitchen',
    tipo: 'boca_iluminacion',
    etiqueta: 'Boca Techo Cocina',
    codigoRef: 'BT-KITCH',
    circuitoCodigo: 'C1-IUG'
  },
  {
    id: 'node-tomas-cocina',
    roomId: 'room-kitchen',
    tipo: 'boca_tomacorriente',
    etiqueta: 'Tomas Mesada Cocina',
    codigoRef: 'TUG-KITCH',
    circuitoCodigo: 'C3-TUG'
  },
  {
    id: 'node-tue-horno',
    roomId: 'room-kitchen',
    tipo: 'boca_tomacorriente',
    etiqueta: 'Toma Horno / TUE (20A)',
    codigoRef: 'TUE-HORNO',
    circuitoCodigo: 'C4-TUE'
  },
  {
    id: 'node-luz-living',
    roomId: 'room-living',
    tipo: 'boca_iluminacion',
    etiqueta: 'Boca Centro Estar / Comedor',
    codigoRef: 'BT-LIV',
    circuitoCodigo: 'C1-IUG'
  },
  {
    id: 'node-tomas-living',
    roomId: 'room-living',
    tipo: 'boca_tomacorriente',
    etiqueta: 'Tomas TV / Sala Estar',
    codigoRef: 'TUG-LIV',
    circuitoCodigo: 'C2-TUG'
  },
  {
    id: 'node-tue-aa-living',
    roomId: 'room-living',
    tipo: 'boca_tomacorriente',
    etiqueta: 'Toma Aire Acondicionado (AA-1)',
    codigoRef: 'TUE-AA1',
    circuitoCodigo: 'C4-TUE'
  },
  {
    id: 'node-luz-bedmain',
    roomId: 'room-bedroom-main',
    tipo: 'boca_iluminacion',
    etiqueta: 'Boca Luz Dorm. Principal',
    codigoRef: 'BT-BEDM',
    circuitoCodigo: 'C1-IUG'
  },
  {
    id: 'node-tomas-bedmain',
    roomId: 'room-bedroom-main',
    tipo: 'boca_tomacorriente',
    etiqueta: 'Tomas Dormitorio Principal',
    codigoRef: 'TUG-BEDM',
    circuitoCodigo: 'C2-TUG'
  },
  {
    id: 'node-luz-bedsmall',
    roomId: 'room-bedroom-small',
    tipo: 'boca_iluminacion',
    etiqueta: 'Boca Luz Dorm. Pequeño',
    codigoRef: 'BT-BEDS',
    circuitoCodigo: 'C1-IUG'
  },
  {
    id: 'node-luz-bath',
    roomId: 'room-bathroom',
    tipo: 'boca_iluminacion',
    etiqueta: 'Boca Luz + Espejo Baño',
    codigoRef: 'BT-BATH',
    circuitoCodigo: 'C1-IUG'
  }
];

// =============================================================================
// CAÑERÍAS Y TRAMOS MULTICIRCUITO (AEA Grado Medio con Cables y Retornos)
// =============================================================================

const INITIAL_ELECTRICAL_TRAMOS: TramoElectrico[] = [
  // 1. ALIMENTADOR PRINCIPAL: Medidor (Subsuelo) -> Caja de Paso Palier 3°P (Montante)
  {
    id: 'tramo-med-cp',
    sourceNodeId: 'node-medidor',
    targetNodeId: 'node-cp-palier',
    longitudMeters: 18.0,
    diametroCañoMm: 25,
    tipoMontaje: 'pleno_montante',
    circuitoCodigo: 'ALIM-GRAL',
    tensionV: 220,
    conductores: [
      { id: 'w-med-1', circuitoCodigo: 'ALIM-GRAL', tipoConductor: 'fase', seccionMm2: 6.0, colorAislacion: 'marrón', etiqueta: 'Fase Alimentador L1' },
      { id: 'w-med-2', circuitoCodigo: 'ALIM-GRAL', tipoConductor: 'neutro', seccionMm2: 6.0, colorAislacion: 'celeste', etiqueta: 'Neutro Alimentador N' },
      { id: 'w-med-3', circuitoCodigo: 'ALIM-GRAL', tipoConductor: 'tierra_pe', seccionMm2: 6.0, colorAislacion: 'verde_amarillo', etiqueta: 'Conductor Protección PE' }
    ],
    notas: 'Montante vertical de edificio con cables libres de halógenos IRAM 62267'
  },

  // 2. ACOMETIDA A LA UNIDAD: Caja Paso Palier 3°P -> TSG en COCINA
  {
    id: 'tramo-cp-tsg',
    sourceNodeId: 'node-cp-palier',
    targetNodeId: 'node-tsg-cocina',
    longitudMeters: 7.5,
    diametroCañoMm: 25,
    tipoMontaje: 'embutido',
    circuitoCodigo: 'ALIM-GRAL',
    tensionV: 220,
    conductores: [
      { id: 'w-tsg-1', circuitoCodigo: 'ALIM-GRAL', tipoConductor: 'fase', seccionMm2: 6.0, colorAislacion: 'marrón', etiqueta: 'Fase Acometida' },
      { id: 'w-tsg-2', circuitoCodigo: 'ALIM-GRAL', tipoConductor: 'neutro', seccionMm2: 6.0, colorAislacion: 'celeste', etiqueta: 'Neutro Acometida' },
      { id: 'w-tsg-3', circuitoCodigo: 'ALIM-GRAL', tipoConductor: 'tierra_pe', seccionMm2: 6.0, colorAislacion: 'verde_amarillo', etiqueta: 'Protección PE' }
    ],
    notas: 'Ingreso directo al TSG ubicado en la Cocina'
  },

  // 3. CIRCUITO C1 - IUG: TSG Cocina -> Boca Techo Cocina (con Retorno)
  {
    id: 'tramo-tsg-c1-kitch',
    sourceNodeId: 'node-tsg-cocina',
    targetNodeId: 'node-luz-cocina',
    longitudMeters: 3.5,
    diametroCañoMm: 19,
    tipoMontaje: 'embutido',
    circuitoCodigo: 'C1-IUG',
    tensionV: 220,
    conductores: [
      { id: 'w-c1-k1', circuitoCodigo: 'C1-IUG', tipoConductor: 'fase', seccionMm2: 1.5, colorAislacion: 'marrón', etiqueta: 'Línea de Fase C1' },
      { id: 'w-c1-k2', circuitoCodigo: 'C1-IUG', tipoConductor: 'neutro', seccionMm2: 1.5, colorAislacion: 'celeste', etiqueta: 'Neutro C1' },
      { id: 'w-c1-k3', circuitoCodigo: 'C1-IUG', tipoConductor: 'retorno', seccionMm2: 1.5, colorAislacion: 'negro', etiqueta: 'Retorno Luz Cocina' },
      { id: 'w-c1-k4', circuitoCodigo: 'C1-IUG', tipoConductor: 'tierra_pe', seccionMm2: 2.5, colorAislacion: 'verde_amarillo', etiqueta: 'Tierra PE' }
    ]
  },

  // 4. CIRCUITO C1 - IUG: TSG Cocina -> Boca Centro Estar / Comedor (con Retornos)
  {
    id: 'tramo-tsg-c1-liv',
    sourceNodeId: 'node-tsg-cocina',
    targetNodeId: 'node-luz-living',
    longitudMeters: 6.0,
    diametroCañoMm: 19,
    tipoMontaje: 'embutido',
    circuitoCodigo: 'C1-IUG',
    tensionV: 220,
    conductores: [
      { id: 'w-c1-l1', circuitoCodigo: 'C1-IUG', tipoConductor: 'fase', seccionMm2: 1.5, colorAislacion: 'marrón', etiqueta: 'Fase C1 Distribución' },
      { id: 'w-c1-l2', circuitoCodigo: 'C1-IUG', tipoConductor: 'neutro', seccionMm2: 1.5, colorAislacion: 'celeste', etiqueta: 'Neutro C1' },
      { id: 'w-c1-l3', circuitoCodigo: 'C1-IUG', tipoConductor: 'retorno', seccionMm2: 1.5, colorAislacion: 'negro', etiqueta: 'Retorno 1 Centro Comedor' },
      { id: 'w-c1-l4', circuitoCodigo: 'C1-IUG', tipoConductor: 'retorno', seccionMm2: 1.5, colorAislacion: 'blanco', etiqueta: 'Retorno 2 Apliques' },
      { id: 'w-c1-l5', circuitoCodigo: 'C1-IUG', tipoConductor: 'tierra_pe', seccionMm2: 2.5, colorAislacion: 'verde_amarillo', etiqueta: 'Tierra PE' }
    ]
  },

  // 5. CIRCUITO C1 - IUG: Boca Estar -> Boca Dormitorio Principal
  {
    id: 'tramo-liv-c1-bedm',
    sourceNodeId: 'node-luz-living',
    targetNodeId: 'node-luz-bedmain',
    longitudMeters: 7.0,
    diametroCañoMm: 19,
    tipoMontaje: 'embutido',
    circuitoCodigo: 'C1-IUG',
    tensionV: 220,
    conductores: [
      { id: 'w-c1-bm1', circuitoCodigo: 'C1-IUG', tipoConductor: 'fase', seccionMm2: 1.5, colorAislacion: 'marrón', etiqueta: 'Fase C1' },
      { id: 'w-c1-bm2', circuitoCodigo: 'C1-IUG', tipoConductor: 'neutro', seccionMm2: 1.5, colorAislacion: 'celeste', etiqueta: 'Neutro C1' },
      { id: 'w-c1-bm3', circuitoCodigo: 'C1-IUG', tipoConductor: 'retorno', seccionMm2: 1.5, colorAislacion: 'negro', etiqueta: 'Retorno Luz Techo Dorm. Principal' },
      { id: 'w-c1-bm4', circuitoCodigo: 'C1-IUG', tipoConductor: 'tierra_pe', seccionMm2: 2.5, colorAislacion: 'verde_amarillo', etiqueta: 'Tierra PE' }
    ]
  },

  // 6. CIRCUITO C2 - TUG (Tomas Estar): TSG Cocina -> Tomas Estar
  {
    id: 'tramo-tsg-c2-liv',
    sourceNodeId: 'node-tsg-cocina',
    targetNodeId: 'node-tomas-living',
    longitudMeters: 8.5,
    diametroCañoMm: 19,
    tipoMontaje: 'embutido',
    circuitoCodigo: 'C2-TUG',
    tensionV: 220,
    conductores: [
      { id: 'w-c2-l1', circuitoCodigo: 'C2-TUG', tipoConductor: 'fase', seccionMm2: 2.5, colorAislacion: 'marrón', etiqueta: 'Fase C2 (16A)' },
      { id: 'w-c2-l2', circuitoCodigo: 'C2-TUG', tipoConductor: 'neutro', seccionMm2: 2.5, colorAislacion: 'celeste', etiqueta: 'Neutro C2' },
      { id: 'w-c2-l3', circuitoCodigo: 'C2-TUG', tipoConductor: 'tierra_pe', seccionMm2: 2.5, colorAislacion: 'verde_amarillo', etiqueta: 'Tierra PE' }
    ]
  },

  // 7. CIRCUITO C2 - TUG (Tomas Dormitorio Principal): Tomas Estar -> Tomas Dorm. Principal
  {
    id: 'tramo-liv-c2-bedm',
    sourceNodeId: 'node-tomas-living',
    targetNodeId: 'node-tomas-bedmain',
    longitudMeters: 7.5,
    diametroCañoMm: 19,
    tipoMontaje: 'embutido',
    circuitoCodigo: 'C2-TUG',
    tensionV: 220,
    conductores: [
      { id: 'w-c2-bm1', circuitoCodigo: 'C2-TUG', tipoConductor: 'fase', seccionMm2: 2.5, colorAislacion: 'marrón', etiqueta: 'Fase C2' },
      { id: 'w-c2-bm2', circuitoCodigo: 'C2-TUG', tipoConductor: 'neutro', seccionMm2: 2.5, colorAislacion: 'celeste', etiqueta: 'Neutro C2' },
      { id: 'w-c2-bm3', circuitoCodigo: 'C2-TUG', tipoConductor: 'tierra_pe', seccionMm2: 2.5, colorAislacion: 'verde_amarillo', etiqueta: 'Tierra PE' }
    ]
  },

  // 8. CIRCUITO C3 - TUG (Tomas Cocina y Lavadero): TSG Cocina -> Tomas Mesada Cocina
  {
    id: 'tramo-tsg-c3-kitch',
    sourceNodeId: 'node-tsg-cocina',
    targetNodeId: 'node-tomas-cocina',
    longitudMeters: 3.0,
    diametroCañoMm: 19,
    tipoMontaje: 'embutido',
    circuitoCodigo: 'C3-TUG',
    tensionV: 220,
    conductores: [
      { id: 'w-c3-k1', circuitoCodigo: 'C3-TUG', tipoConductor: 'fase', seccionMm2: 2.5, colorAislacion: 'marrón', etiqueta: 'Fase C3 Cocina' },
      { id: 'w-c3-k2', circuitoCodigo: 'C3-TUG', tipoConductor: 'neutro', seccionMm2: 2.5, colorAislacion: 'celeste', etiqueta: 'Neutro C3' },
      { id: 'w-c3-k3', circuitoCodigo: 'C3-TUG', tipoConductor: 'tierra_pe', seccionMm2: 2.5, colorAislacion: 'verde_amarillo', etiqueta: 'Tierra PE' }
    ]
  },

  // 9. CIRCUITO C4 - TUE (Tomas Especiales 20A): TSG Cocina -> Toma Horno 20A
  {
    id: 'tramo-tsg-c4-horno',
    sourceNodeId: 'node-tsg-cocina',
    targetNodeId: 'node-tue-horno',
    longitudMeters: 4.0,
    diametroCañoMm: 25,
    tipoMontaje: 'embutido',
    circuitoCodigo: 'C4-TUE',
    tensionV: 220,
    conductores: [
      { id: 'w-c4-h1', circuitoCodigo: 'C4-TUE', tipoConductor: 'fase', seccionMm2: 4.0, colorAislacion: 'rojo', etiqueta: 'Fase C4 Horno (20A)' },
      { id: 'w-c4-h2', circuitoCodigo: 'C4-TUE', tipoConductor: 'neutro', seccionMm2: 4.0, colorAislacion: 'celeste', etiqueta: 'Neutro C4' },
      { id: 'w-c4-h3', circuitoCodigo: 'C4-TUE', tipoConductor: 'tierra_pe', seccionMm2: 4.0, colorAislacion: 'verde_amarillo', etiqueta: 'Tierra PE 4mm²' }
    ]
  },

  // 10. CIRCUITO C4 - TUE (Tomas Especiales 20A): TSG Cocina -> Toma AA Estar
  {
    id: 'tramo-tsg-c4-aa1',
    sourceNodeId: 'node-tsg-cocina',
    targetNodeId: 'node-tue-aa-living',
    longitudMeters: 10.5,
    diametroCañoMm: 25,
    tipoMontaje: 'embutido',
    circuitoCodigo: 'C4-TUE',
    tensionV: 220,
    conductores: [
      { id: 'w-c4-aa1', circuitoCodigo: 'C4-TUE', tipoConductor: 'fase', seccionMm2: 4.0, colorAislacion: 'rojo', etiqueta: 'Fase C4 AA-1' },
      { id: 'w-c4-aa2', circuitoCodigo: 'C4-TUE', tipoConductor: 'neutro', seccionMm2: 4.0, colorAislacion: 'celeste', etiqueta: 'Neutro C4' },
      { id: 'w-c4-aa3', circuitoCodigo: 'C4-TUE', tipoConductor: 'tierra_pe', seccionMm2: 4.0, colorAislacion: 'verde_amarillo', etiqueta: 'Tierra PE 4mm²' }
    ]
  }
];

export const useSurveyStore = create<SurveyState>((set, get) => ({
  rooms: INITIAL_ROOMS,
  connections: INITIAL_CONNECTIONS,
  selectedRoomId: 'room-living',
  selectedConnectionId: null,
  activePhase: 'topology',

  wallThicknessMeters: 0.10, // 10 cm por defecto

  electricalNodes: INITIAL_ELECTRICAL_NODES,
  electricalTramos: INITIAL_ELECTRICAL_TRAMOS,
  selectedElectricalNodeId: null,
  selectedTramoId: null,
  topologyLayer: 'architectural', // Default limpio: solo arquitectura

  isSnapEnabled: true,
  snapThreshold: 15,
  activeSnapGuides: [],
  zoom: 1,

  setActivePhase: (phase: SurveyPhase) => set({ activePhase: phase }),

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
    const preset = roomData.type ? ROOM_TYPE_CATALOG[roomData.type] : ROOM_TYPE_CATALOG.other;

    const count = get().rooms.length;
    const newRoom: Room = {
      id: isTechnical ? `island-${Date.now()}` : isAccess ? `entry-${Date.now()}` : `room-${Date.now()}`,
      name: roomData.name || preset.label,
      type: roomData.type || 'other',
      isTechnicalIsland: isTechnical,
      isAccessPoint: isAccess,
      isCommonArea: roomData.isCommonArea || isTechnical || isAccess,
      accessCategory: roomData.accessCategory,
      dimensions: roomData.dimensions || {
        width: isTechnical || isAccess ? 0 : preset.defaultWidth,
        length: isTechnical || isAccess ? 0 : preset.defaultLength,
        height: isTechnical || isAccess ? 0 : preset.defaultHeight
      },
      canvasPosition: roomData.canvasPosition || {
        x: 100 + (count % 4) * 50,
        y: 100 + Math.floor(count / 4) * 40
      },
      topologyPosition: roomData.topologyPosition || {
        x: isTechnical ? 40 : 100 + (count % 3) * 280,
        y: 100 + Math.floor(count / 3) * 180
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

  connectRooms: (sourceRoomId, targetRoomId, type = 'puerta_estandar', label, sourceHandle, targetHandle) => {
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

    const newConnection: LogicalConnection = {
      id: `conn-${Date.now()}`,
      sourceRoomId,
      targetRoomId,
      type,
      label: label || `${catalogMeta.emoji} ${catalogMeta.label}`,
      sourceWall,
      targetWall,
      sourceHandle: sourceHandle || `source-${sourceWall}`,
      targetHandle: targetHandle || `target-${targetWall}`,
      opening: catalogMeta.isOpening
        ? {
            openingType: type,
            widthMeters: catalogMeta.defaultWidth,
            heightMeters: catalogMeta.defaultHeight,
            sillHeightMeters: catalogMeta.defaultSillHeight,
            swingDirection: catalogMeta.defaultSwing
          }
        : undefined
    };

    set((state) => ({
      connections: [...state.connections, newConnection],
      selectedConnectionId: newConnection.id
    }));

    return newConnection;
  },

  updateConnection: (connectionId, updates) => {
    set((state) => ({
      connections: state.connections.map((c) =>
        c.id === connectionId ? { ...c, ...updates } : c
      )
    }));
  },

  removeConnection: (connectionId) => {
    set((state) => ({
      connections: state.connections.filter((c) => c.id !== connectionId),
      selectedConnectionId:
        state.selectedConnectionId === connectionId ? null : state.selectedConnectionId
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
  },

  setSnapGuides: (guides) => set({ activeSnapGuides: guides }),

  toggleSnap: (enabled) =>
    set((state) => ({
      isSnapEnabled: enabled !== undefined ? enabled : !state.isSnapEnabled
    })),

  loadSampleData: () => {
    set({
      rooms: INITIAL_ROOMS,
      connections: INITIAL_CONNECTIONS,
      electricalNodes: INITIAL_ELECTRICAL_NODES,
      electricalTramos: INITIAL_ELECTRICAL_TRAMOS,
      selectedRoomId: 'room-living',
      selectedConnectionId: null,
      selectedElectricalNodeId: null,
      selectedTramoId: null,
      wallThicknessMeters: 0.10,
      topologyLayer: 'architectural'
    });
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
      activeSnapGuides: []
    });
  }
}));
