/**
 * Model: RoomModel
 * Estructuras de datos para los Ambientes, Puntos de Ingreso, Islas Técnicas,
 * Elementos Eléctricos Paramétricos y Geometría No-Ortogonal (Falsa Escuadra / Constraints).
 */

import { ElectricalAssetType } from './ElectricalTypes';

export type WallOrientation = 'north' | 'south' | 'east' | 'west' | 'ceiling';

export type RoomType =
  // Ambientes Habitables Interiores
  | 'living'
  | 'kitchen'
  | 'bedroom'
  | 'bathroom'
  | 'hall'
  | 'main_panel_room'
  | 'laundry'
  | 'garage'
  | 'balcony'
  | 'patio'
  | 'other'
  // Puntos de Ingreso / Circulaciones
  | 'access_street'
  | 'access_palier'
  | 'access_garage'
  | 'access_patio'
  | 'access_service'
  // Islas Técnicas / Partes Comunes de Suministro
  | 'technical_island_meters'  // Sala de Medidores (Subsuelo/PB)
  | 'technical_island_pillar'  // Pilar de Medición / Acometida (L.M.)
  | 'technical_island_shaft'   // Pleno Técnico / Montante Vertical
  | 'technical_island_ground'  // Cámara de Inspección / Jabalina PAT
  // Límites de Parcela / Envolvente y Medianeras
  | 'limit_frente_lm'          // Línea Municipal / Frente (Calle)
  | 'limit_medianera_izq'      // Medianera Lateral Izquierda (Oeste relativo)
  | 'limit_medianera_der'      // Medianera Lateral Derecha (Este relativo)
  | 'limit_fondo'              // Fondo / Contrafrente (Límite posterior)
  | 'limit_patio';             // Patio de Aire y Luz / Vacío Descubierto

export interface RoomDimensions {
  width: number;   // Ancho nominal en metros (eje X)
  length: number;  // Largo / Profundidad nominal en metros (eje Y)
  height: number;  // Altura libre del local en metros (eje Z, ej: 2.60m)
  widthLocked?: boolean;  // Cota de ancho fija/medida (false = elástica/inferible)
  lengthLocked?: boolean; // Cota de largo fija/medida (false = elástica/inferible)
}

export interface WallBreak {
  id: string;
  wall: 'north' | 'south' | 'east' | 'west';
  startOffsetMeters: number; // Distancia desde el inicio de la pared (origen cardinal) en metros
  widthMeters: number;       // Ancho del tramo desplazado en metros
  depthMeters: number;       // Desplazamiento en metros (+ exterior/nicho, - interior/columna)
  label?: string;            // Etiqueta opcional (ej: "Nicho Ropero", "Columna", "Quiebre Z")
}

export interface IndependentWalls {
  north: number; // Longitud pared Norte (m)
  south: number; // Longitud pared Sur (m)
  east: number;  // Longitud pared Este (m)
  west: number;  // Longitud pared Oeste (m)
}

export interface CornerAngleConstraints {
  northWestLocked90?: boolean; // Vértice NO (Noroeste) fijado a 90°
  northEastLocked90?: boolean; // Vértice NE (Noreste) fijado a 90°
  southEastLocked90?: boolean; // Vértice SE (Sureste) fijado a 90°
  southWestLocked90?: boolean; // Vértice SO (Suroeste) fijado a 90°
}

export interface RoomGeometry {
  mode: 'rectangle' | 'independent_walls' | 'diagonal_triangulated';
  independentWalls?: IndependentWalls;
  diagonalSO_NE?: number; // Cota de diagonal desde esquina SO hacia NE (m)
  cornerConstraints?: CornerAngleConstraints;
  wallBreaks?: WallBreak[]; // Modificadores de pared (quiebres en Z, nichos, columnas, mochetas)
  computedVertices?: Array<{ x: number; y: number }>; // Vértices 2D en metros calculados por el solver
}

export interface ElectricalAsset {
  id: string;
  type: ElectricalAssetType;
  label: string;
  wall: WallOrientation;
  offsetRatio: number;
  offsetMeters: number;
  heightFromFloor: number;
  circuitCode?: string;
  boxOrientation?: 'horizontal' | 'vertical';
  notes?: string;
}

export interface RoomCanvasPosition {
  x: number;
  y: number;
  rotation?: number;
}

export type TipoCubierta = 'cubierto' | 'semicubierto' | 'descubierto';

export interface TipoCubiertaMetadata {
  tipo: TipoCubierta;
  label: string;
  emoji: string;
  shortLabel: string;
  hasRoof: boolean;
  description: string;
  color: string;
  badgeBg: string;
}

export const TIPO_CUBIERTA_CATALOG: Record<TipoCubierta, TipoCubiertaMetadata> = {
  cubierto: {
    tipo: 'cubierto',
    label: 'Cubierto',
    emoji: '🏠',
    shortLabel: 'Cubierto',
    hasRoof: true,
    description: 'Espacio cerrado con losa/techo completo y muros perimetrales',
    color: '#0284c7',
    badgeBg: '#e0f2fe'
  },
  semicubierto: {
    tipo: 'semicubierto',
    label: 'Semicubierto',
    emoji: '⛱️',
    shortLabel: 'Semicubierto',
    hasRoof: true,
    description: 'Galería, porche, alero, balcón techado o cochera semicubierta',
    color: '#d97706',
    badgeBg: '#fef3c7'
  },
  descubierto: {
    tipo: 'descubierto',
    label: 'Descubierto',
    emoji: '☀️',
    shortLabel: 'Descubierto (Sin Techo)',
    hasRoof: false,
    description: 'Patio, jardín, terraza, fondo o azotea abierta al cielo',
    color: '#16a34a',
    badgeBg: '#dcfce7'
  }
};

export type NodeCategory = 'room' | 'access' | 'technical_island' | 'parcel_boundary';

export interface BoundaryProperties {
  materialType?: string;          // Tipo de material constructivo del muro lindero
  thicknessMeters?: number;       // Espesor del muro (ej: 0.30m, 0.15m)
  boundaryCondition?: 'muro_ciego' | 'frente_calle' | 'retiro_frente' | 'patio_luz';
  notes?: string;                 // Notas sobre el lindero o catastro
}

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  nodeCategory?: NodeCategory; // Categoría formal del nodo en la topología arquitectónica
  tipoCubierta?: TipoCubierta; // Tipo de cubierta: cubierto, semicubierto o descubierto (sin techo)
  isAccessPoint?: boolean;    // Punto de acceso/ingreso
  isTechnicalIsland?: boolean;// Isla técnica de suministro (Sala de medidores, pilar, etc.)
  isParcelBoundary?: boolean; // Límite de parcela / Medianera o Frente de calle
  boundaryProperties?: BoundaryProperties; // Propiedades específicas de la medianera o límite perimetral
  isCommonArea?: boolean;     // Área común sin necesidad de dimensionamiento milimétrico
  accessCategory?: 'street' | 'palier' | 'service' | 'garden';
  dimensions: RoomDimensions;
  geometry?: RoomGeometry;    // Geometría paramétrica avanzada con medidas independientes y restricciones
  electricalAssets: ElectricalAsset[];
  canvasPosition: RoomCanvasPosition;
  topologyPosition?: { x: number; y: number }; // Coordenadas en el lienzo de React Flow
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export function getNodeCategory(room: {
  type: RoomType;
  isAccessPoint?: boolean;
  isTechnicalIsland?: boolean;
  isParcelBoundary?: boolean;
}): NodeCategory {
  if (room.isParcelBoundary || room.type.startsWith('limit_')) return 'parcel_boundary';
  if (room.isTechnicalIsland || room.type.startsWith('technical_island_')) return 'technical_island';
  if (room.isAccessPoint || room.type.startsWith('access_')) return 'access';
  return 'room';
}

export function isMetricRoom(room: {
  type: RoomType;
  isAccessPoint?: boolean;
  isTechnicalIsland?: boolean;
  isParcelBoundary?: boolean;
}): boolean {
  return getNodeCategory(room) === 'room';
}

export function isParcelBoundaryNode(room: {
  type: RoomType;
  isAccessPoint?: boolean;
  isTechnicalIsland?: boolean;
  isParcelBoundary?: boolean;
}): boolean {
  return getNodeCategory(room) === 'parcel_boundary';
}

export interface RoomTypeMetadata {
  type: RoomType;
  label: string;
  isAccess: boolean;
  isTechnical: boolean;
  isBoundary?: boolean;
  defaultCubierta: TipoCubierta;
  defaultWidth: number;
  defaultLength: number;
  defaultHeight: number;
  color: string;
  iconName: string;
  description: string;
}

export const ROOM_TYPE_CATALOG: Record<RoomType, RoomTypeMetadata> = {
  // Ambientes Habitables / Interiores
  living: {
    type: 'living',
    label: 'Estar / Comedor',
    isAccess: false,
    isTechnical: false,
    defaultCubierta: 'cubierto',
    defaultWidth: 4.5,
    defaultLength: 5.5,
    defaultHeight: 2.6,
    color: '#e3f2fd',
    iconName: 'Weekend',
    description: 'Área principal de estar y comedor'
  },
  kitchen: {
    type: 'kitchen',
    label: 'Cocina',
    isAccess: false,
    isTechnical: false,
    defaultCubierta: 'cubierto',
    defaultWidth: 3.0,
    defaultLength: 4.0,
    defaultHeight: 2.6,
    color: '#fff3e0',
    iconName: 'Kitchen',
    description: 'Cocina y área de preparación'
  },
  bedroom: {
    type: 'bedroom',
    label: 'Dormitorio',
    isAccess: false,
    isTechnical: false,
    defaultCubierta: 'cubierto',
    defaultWidth: 3.5,
    defaultLength: 4.0,
    defaultHeight: 2.6,
    color: '#f3e5f5',
    iconName: 'Bed',
    description: 'Dormitorio principal o secundario'
  },
  bathroom: {
    type: 'bathroom',
    label: 'Baño',
    isAccess: false,
    isTechnical: false,
    defaultCubierta: 'cubierto',
    defaultWidth: 2.0,
    defaultLength: 2.5,
    defaultHeight: 2.4,
    color: '#e0f2f1',
    iconName: 'Bathtub',
    description: 'Cuarto de baño y sanitarios'
  },
  hall: {
    type: 'hall',
    label: 'Circulación / Pasillo',
    isAccess: false,
    isTechnical: false,
    defaultCubierta: 'cubierto',
    defaultWidth: 1.5,
    defaultLength: 3.0,
    defaultHeight: 2.6,
    color: '#eceff1',
    iconName: 'DirectionsWalk',
    description: 'Pasillos y zonas de distribución'
  },
  main_panel_room: {
    type: 'main_panel_room',
    label: 'Gabinete / Tablero',
    isAccess: false,
    isTechnical: false,
    defaultCubierta: 'cubierto',
    defaultWidth: 1.5,
    defaultLength: 1.5,
    defaultHeight: 2.6,
    color: '#ffebee',
    iconName: 'Bolt',
    description: 'Sector técnico de tableros eléctricos'
  },
  laundry: {
    type: 'laundry',
    label: 'Lavadero',
    isAccess: false,
    isTechnical: false,
    defaultCubierta: 'cubierto',
    defaultWidth: 2.0,
    defaultLength: 2.5,
    defaultHeight: 2.6,
    color: '#e8eaf6',
    iconName: 'LocalLaundryService',
    description: 'Área de lavado y termoeléctricos'
  },
  garage: {
    type: 'garage',
    label: 'Cochera / Garaje',
    isAccess: false,
    isTechnical: false,
    defaultCubierta: 'cubierto',
    defaultWidth: 3.5,
    defaultLength: 6.0,
    defaultHeight: 2.6,
    color: '#efebe9',
    iconName: 'Garage',
    description: 'Estacionamiento y accesos vehiculares'
  },
  balcony: {
    type: 'balcony',
    label: 'Balcón / Terraza',
    isAccess: false,
    isTechnical: false,
    defaultCubierta: 'semicubierto',
    defaultWidth: 3.5,
    defaultLength: 1.5,
    defaultHeight: 2.6,
    color: '#f1f8e9',
    iconName: 'Deck',
    description: 'Balcones y expansiones semicubiertas'
  },
  patio: {
    type: 'patio',
    label: 'Patio Exterior',
    isAccess: false,
    isTechnical: false,
    defaultCubierta: 'descubierto',
    defaultWidth: 4.0,
    defaultLength: 5.0,
    defaultHeight: 3.0,
    color: '#e8f5e9',
    iconName: 'Grass',
    description: 'Patios y jardines descubiertos'
  },
  other: {
    type: 'other',
    label: 'Otro Espacio',
    isAccess: false,
    isTechnical: false,
    defaultCubierta: 'cubierto',
    defaultWidth: 3.0,
    defaultLength: 3.0,
    defaultHeight: 2.6,
    color: '#f5f5f5',
    iconName: 'MeetingRoom',
    description: 'Espacio genérico o personalizado'
  },

  // Puntos de Ingreso
  access_street: {
    type: 'access_street',
    label: 'Calle / Línea Municipal',
    isAccess: true,
    isTechnical: false,
    defaultCubierta: 'descubierto',
    defaultWidth: 4.0,
    defaultLength: 2.0,
    defaultHeight: 0,
    color: '#d1fae5',
    iconName: 'DoorSliding',
    description: 'Ingreso exterior peatonal o vehicular desde la calle'
  },
  access_palier: {
    type: 'access_palier',
    label: 'Palier Común (Edificio)',
    isAccess: true,
    isTechnical: false,
    defaultCubierta: 'cubierto',
    defaultWidth: 2.5,
    defaultLength: 2.5,
    defaultHeight: 0,
    color: '#d1fae5',
    iconName: 'LocationCity',
    description: 'Palier del piso, ascensor o escalera común'
  },
  access_garage: {
    type: 'access_garage',
    label: 'Portón de Cochera',
    isAccess: true,
    isTechnical: false,
    defaultCubierta: 'semicubierto',
    defaultWidth: 3.0,
    defaultLength: 2.0,
    defaultHeight: 0,
    color: '#d1fae5',
    iconName: 'Garage',
    description: 'Acceso vehicular desde la vía pública'
  },
  access_patio: {
    type: 'access_patio',
    label: 'Patio / Jardín Común',
    isAccess: true,
    isTechnical: false,
    defaultCubierta: 'descubierto',
    defaultWidth: 3.0,
    defaultLength: 3.0,
    defaultHeight: 0,
    color: '#d1fae5',
    iconName: 'Deck',
    description: 'Acceso desde patio interno o jardín'
  },
  access_service: {
    type: 'access_service',
    label: 'Entrada de Servicio',
    isAccess: true,
    isTechnical: false,
    defaultCubierta: 'cubierto',
    defaultWidth: 2.0,
    defaultLength: 2.0,
    defaultHeight: 0,
    color: '#d1fae5',
    iconName: 'Key',
    description: 'Puerta secundaria o acceso de servicio técnico'
  },

  // Islas Técnicas / Partes Comunes de Suministro
  technical_island_meters: {
    type: 'technical_island_meters',
    label: 'Sala de Medidores (Subsuelo)',
    isAccess: false,
    isTechnical: true,
    defaultCubierta: 'cubierto',
    defaultWidth: 0,
    defaultLength: 0,
    defaultHeight: 0,
    color: '#fef3c7',
    iconName: 'ElectricMeter',
    description: 'Gabinete o sala central de medidores de energía eléctrica'
  },
  technical_island_pillar: {
    type: 'technical_island_pillar',
    label: 'Pilar de Medición (L.M.)',
    isAccess: false,
    isTechnical: true,
    defaultCubierta: 'descubierto',
    defaultWidth: 0,
    defaultLength: 0,
    defaultHeight: 0,
    color: '#fef3c7',
    iconName: 'ElectricalServices',
    description: 'Pilar de acometida eléctrica monofásica o trifásica sobre L.M.'
  },
  technical_island_shaft: {
    type: 'technical_island_shaft',
    label: 'Pleno Técnico / Montante',
    isAccess: false,
    isTechnical: true,
    defaultCubierta: 'cubierto',
    defaultWidth: 0,
    defaultLength: 0,
    defaultHeight: 0,
    color: '#fef3c7',
    iconName: 'VerticalShades',
    description: 'Conducto técnico vertical para cables y cañerías entre pisos'
  },
  technical_island_ground: {
    type: 'technical_island_ground',
    label: 'Cámara Jabalina PAT',
    isAccess: false,
    isTechnical: true,
    defaultCubierta: 'descubierto',
    defaultWidth: 0,
    defaultLength: 0,
    defaultHeight: 0,
    color: '#fef3c7',
    iconName: 'Grounding',
    description: 'Cámara de inspección y puesta a tierra (Jabalina PAT)'
  },

  // Límites de Parcela / Envolvente y Medianeras
  limit_frente_lm: {
    type: 'limit_frente_lm',
    label: 'Frente / Línea Municipal (Calle)',
    isAccess: false,
    isTechnical: false,
    isBoundary: true,
    defaultCubierta: 'descubierto',
    defaultWidth: 0,
    defaultLength: 0,
    defaultHeight: 0,
    color: '#e0e7ff',
    iconName: 'Storefront',
    description: 'Límite frontal del terreno con la vía pública / fachada'
  },
  limit_medianera_izq: {
    type: 'limit_medianera_izq',
    label: 'Medianera Lateral Izquierda',
    isAccess: false,
    isTechnical: false,
    isBoundary: true,
    defaultCubierta: 'descubierto',
    defaultWidth: 0,
    defaultLength: 0,
    defaultHeight: 0,
    color: '#e2e8f0',
    iconName: 'BorderLeft',
    description: 'Muro divisorio lateral izquierdo con propiedad vecina'
  },
  limit_medianera_der: {
    type: 'limit_medianera_der',
    label: 'Medianera Lateral Derecha',
    isAccess: false,
    isTechnical: false,
    isBoundary: true,
    defaultCubierta: 'descubierto',
    defaultWidth: 0,
    defaultLength: 0,
    defaultHeight: 0,
    color: '#e2e8f0',
    iconName: 'BorderRight',
    description: 'Muro divisorio lateral derecho con propiedad vecina'
  },
  limit_fondo: {
    type: 'limit_fondo',
    label: 'Fondo / Contrafrente',
    isAccess: false,
    isTechnical: false,
    isBoundary: true,
    defaultCubierta: 'descubierto',
    defaultWidth: 0,
    defaultLength: 0,
    defaultHeight: 0,
    color: '#ecfdf5',
    iconName: 'BorderTop',
    description: 'Límite posterior de la parcela / pulmón de manzana'
  },
  limit_patio: {
    type: 'limit_patio',
    label: 'Patio de Aire y Luz',
    isAccess: false,
    isTechnical: false,
    isBoundary: true,
    defaultCubierta: 'descubierto',
    defaultWidth: 0,
    defaultLength: 0,
    defaultHeight: 0,
    color: '#f0fdf4',
    iconName: 'WbSunny',
    description: 'Vacío descubierto para ventilación e iluminación reglamentaria'
  }
};
