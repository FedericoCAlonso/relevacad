/**
 * Model: GraphModel
 * Estructura de Topología de Grafo: Nodos de Ambientes, Puntos de Ingreso
 * y Aristas de Aberturas Paramétricas orientadas por Paredes (Norte, Sur, Este, Oeste).
 */

import { WallOrientation } from './RoomModel';

export type LogicalConnectionType =
  // Aberturas Arquitectónicas
  | 'puerta_estandar'      // Puerta Batiente 1 Hoja (Estándar 0.80m x 2.05m)
  | 'puerta_doble'         // Puerta Doble Hoja
  | 'puerta_corrediza'     // Puerta Corrediza / Embutida
  | 'puerta_seguridad'     // Puerta Principal / Seguridad
  | 'porton_garage'        // Portón Vehicular / Levadizo
  | 'vano_libre'           // Vano abierto / Paso libre sin carpintería
  | 'ventana_estandar'     // Ventana (con antepecho)
  | 'puerta_ventana'       // Puerta-Ventana Balcón / Galería
  // Vínculos Constructivos / Topológicos
  | 'pared_comun'          // Pared Común / Tabique Ciego Compartido
  | 'limite_virtual'       // Límite Virtual / Concepto Abierto sin Muro Físico
  // Vínculos Técnicos
  | 'conduit_main'         // Cañería Troncal / Acometida
  | 'conduit_sec'          // Cañería Seccional
  | 'pass_through'         // Pase de Losa / Muro técnico
  // Compatibilidad
  | 'door'
  | 'open_space';

export type SwingDirection = 'left' | 'right' | 'sliding' | 'overhead' | 'double' | 'fixed';
export type OpeningMaterial = 'wood' | 'aluminum' | 'steel' | 'pvc' | 'glass';

export type TabiqueMaterialType =
  | 'ladrillo_hueco_8'     // 10cm - Tabique cerámico interior (Hueco 8x18x33)
  | 'ladrillo_hueco_12'    // 15cm - Muro cerámico divisorio (Hueco 12x18x33)
  | 'ladrillo_hueco_18'    // 20cm - Muro cerámico exterior/portante (Hueco 18x18x33)
  | 'ladrillo_comun_15'    // 15cm - Muro de ladrillo macizo común
  | 'medianera_comun_30'   // 30cm - Medianera de ladrillo macizo
  | 'hormigon_armado'      // 12-20cm - Tabique/Pantalla de H°A° (Pre-embutido en encofrado)
  | 'durlock_liviano'      // 7-10cm - Tabique en seco placa de yeso / Steel Frame
  | 'retak_celular'        // 10-15cm - Hormigón celular curado en autoclave (HCCA)
  | 'bloque_cemento'       // 15-20cm - Bloque hueco de hormigón
  | 'vidriado_mampara';    // 5cm - Mampara / Tabique vidriado / Perfilería

export interface TabiqueMaterialMetadata {
  type: TabiqueMaterialType;
  label: string;
  shortLabel: string;
  defaultThicknessMeters: number;
  canChase: boolean;               // ¿Permite canaleteado posterior? (False en H°A° y vidrio)
  chasingMethod: 'liviano' | 'pesado' | 'en_seco' | 'pre_encofrado' | 'a_la_vista';
  electricalDifficultyLabel: string;
  electricalWarning?: string;
  emoji: string;
  color: string;
  description: string;
}

export const TABIQUE_MATERIAL_CATALOG: Record<TabiqueMaterialType, TabiqueMaterialMetadata> = {
  ladrillo_hueco_8: {
    type: 'ladrillo_hueco_8',
    label: 'Ladrillo Hueco 8 cm (Terminado 10 cm)',
    shortLabel: 'Hueco 10cm',
    defaultThicknessMeters: 0.10,
    canChase: true,
    chasingMethod: 'liviano',
    electricalDifficultyLabel: 'Calado liviano / Rápido',
    emoji: '🧱',
    color: '#0284c7',
    description: 'Tabique cerámico interior no portante. Fácil zanjeado para cañerías y cajas estándar.'
  },
  ladrillo_hueco_12: {
    type: 'ladrillo_hueco_12',
    label: 'Ladrillo Hueco 12 cm (Terminado 15 cm)',
    shortLabel: 'Hueco 15cm',
    defaultThicknessMeters: 0.15,
    canChase: true,
    chasingMethod: 'liviano',
    electricalDifficultyLabel: 'Calado liviano / Rápido',
    emoji: '🧱',
    color: '#0369a1',
    description: 'Muro divisorio interior estándar. Espacio holgado para cañerías paralelas y cajas embutidas.'
  },
  ladrillo_hueco_18: {
    type: 'ladrillo_hueco_18',
    label: 'Ladrillo Hueco 18 cm (Terminado 20 cm)',
    shortLabel: 'Hueco 20cm',
    defaultThicknessMeters: 0.20,
    canChase: true,
    chasingMethod: 'liviano',
    electricalDifficultyLabel: 'Calado liviano / Portante',
    emoji: '🧱',
    color: '#075985',
    description: 'Muro cerámico exterior o portante. Apto canaleteado liviano con amoladora.'
  },
  ladrillo_comun_15: {
    type: 'ladrillo_comun_15',
    label: 'Ladrillo Común Macizo (15 cm)',
    shortLabel: 'Común 15cm',
    defaultThicknessMeters: 0.15,
    canChase: true,
    chasingMethod: 'pesado',
    electricalDifficultyLabel: 'Picado pesado / Ladrillo macizo',
    electricalWarning: '⚠️ Requiere amoladora con disco diamantado y cincelado pesado. Mayor tiempo de mano de obra.',
    emoji: '🧱',
    color: '#9a3412',
    description: 'Mampostería tradicional maciza. Alta resistencia y masa; mayor tiempo de picado.'
  },
  medianera_comun_30: {
    type: 'medianera_comun_30',
    label: 'Medianera Ladrillo Común (30 cm)',
    shortLabel: 'Medianera 30cm',
    defaultThicknessMeters: 0.30,
    canChase: true,
    chasingMethod: 'pesado',
    electricalDifficultyLabel: 'Picado pesado / Medianera',
    electricalWarning: '⚠️ Muro medianero de 30cm. Picado pesado de zanjas para alimentación y cajas.',
    emoji: '🏛️',
    color: '#7c2d12',
    description: 'Muro divisorio de predio o fachada portante de 30 cm de espesor.'
  },
  hormigon_armado: {
    type: 'hormigon_armado',
    label: 'Hormigón Armado (H°A° 12-20 cm)',
    shortLabel: 'H°A° (Encofrado)',
    defaultThicknessMeters: 0.15,
    canChase: false,
    chasingMethod: 'pre_encofrado',
    electricalDifficultyLabel: '🚫 No canaleteable (Pre-embutido)',
    electricalWarning: '🚫 PROHIBIDO PICAR: Estructura portante de H°A°. Cañería pre-embutida en encofrado o tendido a la vista.',
    emoji: '🏗️',
    color: '#475569',
    description: 'Tabique, pantalla o columna estructural de H°A°. No admite canaleteado posterior.'
  },
  durlock_liviano: {
    type: 'durlock_liviano',
    label: 'Tabique en Seco (Durlock / Yeso 7-10 cm)',
    shortLabel: 'Durlock 10cm',
    defaultThicknessMeters: 0.10,
    canChase: true,
    chasingMethod: 'en_seco',
    electricalDifficultyLabel: '⚡ En seco / Pasante sin picado',
    emoji: '⚡',
    color: '#16a34a',
    description: 'Tabique liviano con estructura de perfiles de chapa. Cañería pasante por orificios troquelados sin rotura.'
  },
  retak_celular: {
    type: 'retak_celular',
    label: 'Hormigón Celular (Retak / HCCA 10-15 cm)',
    shortLabel: 'Retak 12cm',
    defaultThicknessMeters: 0.12,
    canChase: true,
    chasingMethod: 'liviano',
    electricalDifficultyLabel: 'Ranurado manual ultra liviano',
    emoji: '🧱',
    color: '#059669',
    description: 'Bloques de HCCA. Ranurado ultra rápido con herramienta manual sin impacto.'
  },
  bloque_cemento: {
    type: 'bloque_cemento',
    label: 'Bloque Hueco de Cemento (15-20 cm)',
    shortLabel: 'Bloque Cemento',
    defaultThicknessMeters: 0.15,
    canChase: true,
    chasingMethod: 'pesado',
    electricalDifficultyLabel: 'Paso por alvéolos / Dureza media',
    emoji: '🧱',
    color: '#52525b',
    description: 'Bloque de hormigón vibrado. Cañería vertical por huecos del bloque o calado con disco.'
  },
  vidriado_mampara: {
    type: 'vidriado_mampara',
    label: 'Mampara / Tabique Vidriado (3-5 cm)',
    shortLabel: 'Vidrio / Mampara',
    defaultThicknessMeters: 0.05,
    canChase: false,
    chasingMethod: 'a_la_vista',
    electricalDifficultyLabel: '🚫 Sin embutido (Perimetral)',
    electricalWarning: '⚠️ No admite embutido. Solo canalizaciones perimetrales o zócaloductos.',
    emoji: '🪟',
    color: '#0891b2',
    description: 'División liviana vidriada o de aluminio. Sin cañerías embutidas.'
  }
};

export interface SharedWallProperties {
  materialType: TabiqueMaterialType;
  thicknessMeters: number;         // Espesor real del tabique en metros (ej: 0.10, 0.15, 0.20, 0.30)
  canChase?: boolean;              // ¿Permite canaleteado in situ?
  chasingMethod?: 'liviano' | 'pesado' | 'en_seco' | 'pre_encofrado' | 'a_la_vista';
  isVirtualBoundary?: boolean;     // Límite virtual sin muro físico (Concepto abierto / integrado)
  notes?: string;
}

export interface OpeningProperties {
  id?: string;
  openingType: LogicalConnectionType;
  widthMeters: number;       // Ancho de la abertura (ej: 0.80m, 1.50m, 2.80m)
  heightMeters: number;      // Altura de la abertura (ej: 2.05m, 1.10m)
  sillHeightMeters?: number; // Cota de antepecho (distancia suelo-alfeizar en ventanas, ej: 0.90m)
  swingDirection?: SwingDirection; // Sentido / mano de apertura
  material?: OpeningMaterial;      // Material de la carpintería
  hasElectricalPass?: boolean;     // Cruce de cañería eléctrica por marco/vano
  hasAutomation?: boolean;         // Automatización (Portero visor, cerradura eléctrica, motor portón, sensor)
  offsetRatio?: number;            // Posición relativa en la pared (0.0 a 1.0, default 0.5 = centro)
  label?: string;                  // Etiqueta personalizada (ej: "Puerta Principal", "Pasa-platos")
  notes?: string;
}

export interface WallInvasionProperties {
  type: 'none' | 'source_invades_target' | 'target_invades_source';
  depthMeters?: number;   // Profundidad de la invasión en metros (undefined o 0 = auto-estimado por el solver)
  widthMeters?: number;   // Ancho del quiebre en metros (0 o undefined = todo el tramo compartido)
  notes?: string;
}

export type WallInvasion = WallInvasionProperties;

export interface LogicalConnection {
  id: string;
  sourceRoomId: string;
  targetRoomId: string;
  type: LogicalConnectionType;
  label?: string;

  // Límite Virtual sin Muro Físico (Concepto Abierto / Ambientes Espacialmente Integrados)
  isVirtualBoundary?: boolean;

  // Propiedades del Muro Físico Compartido (BIM Space Boundary)
  wallProperties?: SharedWallProperties;

  // Invasión / Quiebre de Muro (Placares embutidos, nichos de ducha, mochetas)
  invasion?: WallInvasionProperties;

  // Colección de Aberturas alojadas en este muro compartido (0, 1 o varias)
  openings?: OpeningProperties[];

  // Compatibilidad hacia atrás: abertura única directa
  opening?: OpeningProperties;

  // Orientación cardinal de anclaje (Pared donde se ubica el contacto en cada ambiente)
  sourceWall?: WallOrientation;
  targetWall?: WallOrientation;
  sourceHandle?: string; // ID del handle en React Flow (ej: 'source-north', 'source-south')
  targetHandle?: string; // ID del handle en React Flow (ej: 'target-north', 'target-south')

  // Cruces e Instalaciones Técnicas en este Muro
  hasElectricalPass?: boolean;
  electricalDuctDiameterMm?: number;
  ductDiameterMm?: number; // Diámetro de cañería en mm (ej: 19mm / 3/4", 25mm / 1", 32mm / 1.25")
  cableCircuits?: string[]; // IDs de circuitos que transitan por este conducto
  notes?: string;
}

export interface WallOrientationMetadata {
  wall: WallOrientation;
  relativeLabel: string;
  relativeFullLabel: string;
  cardinalAlias: string;
  combinedLabel: string;
  emoji: string;
}

export const WALL_ORIENTATION_CATALOG: Record<WallOrientation, WallOrientationMetadata> = {
  north: {
    wall: 'north',
    relativeLabel: 'Fondo',
    relativeFullLabel: 'Fondo / Contrafrente',
    cardinalAlias: 'Norte',
    combinedLabel: 'Fondo / Superior (Norte)',
    emoji: '⬆️'
  },
  south: {
    wall: 'south',
    relativeLabel: 'Frente',
    relativeFullLabel: 'Frente / Línea Municipal',
    cardinalAlias: 'Sur',
    combinedLabel: 'Frente / Inferior (Sur / Calle)',
    emoji: '⬇️'
  },
  west: {
    wall: 'west',
    relativeLabel: 'Lateral Izq',
    relativeFullLabel: 'Lateral Izquierdo (Medianera Izq)',
    cardinalAlias: 'Oeste',
    combinedLabel: 'Lateral Izquierdo (Oeste / Medianera)',
    emoji: '⬅️'
  },
  east: {
    wall: 'east',
    relativeLabel: 'Lateral Der',
    relativeFullLabel: 'Lateral Derecho (Medianera Der)',
    cardinalAlias: 'Este',
    combinedLabel: 'Lateral Derecho (Este / Medianera)',
    emoji: '➡️'
  },
  ceiling: {
    wall: 'ceiling',
    relativeLabel: 'Techo',
    relativeFullLabel: 'Techo / Cubierta',
    cardinalAlias: 'Cenit',
    combinedLabel: 'Techo / Cubierta (Losa/Chapa)',
    emoji: '☁️'
  }
};

export interface RoomGraphNodeData {
  roomId: string;
  name: string;
  roomType: string;
  isAccessPoint?: boolean;
  dimensions: {
    width: number;
    length: number;
    height: number;
  };
  assetCount: number;
  color?: string;
}

export interface RoomGraphNode {
  id: string;
  type: 'roomNode';
  position: { x: number; y: number };
  data: RoomGraphNodeData;
}

export interface TopologyGraph {
  nodes: RoomGraphNode[];
  edges: LogicalConnection[];
}

export interface ConnectionTypeMetadata {
  type: LogicalConnectionType;
  label: string;
  shortCode: string;
  emoji: string;
  color: string;
  strokeDasharray?: string;
  isOpening: boolean;
  defaultWidth: number;
  defaultHeight: number;
  defaultSillHeight?: number;
  defaultSwing?: SwingDirection;
}

export const CONNECTION_TYPE_CATALOG: Record<string, ConnectionTypeMetadata> = {
  puerta_seguridad: {
    type: 'puerta_seguridad',
    label: 'Puerta Principal / Seguridad',
    shortCode: 'P-ACC',
    emoji: '🚪',
    color: '#059669',
    isOpening: true,
    defaultWidth: 0.90,
    defaultHeight: 2.05,
    defaultSwing: 'right'
  },
  puerta_estandar: {
    type: 'puerta_estandar',
    label: 'Puerta Placa / Batiente (1H)',
    shortCode: 'P-1H',
    emoji: '🚪',
    color: '#0284c7',
    isOpening: true,
    defaultWidth: 0.80,
    defaultHeight: 2.05,
    defaultSwing: 'right'
  },
  door: {
    type: 'puerta_estandar',
    label: 'Puerta Placa / Batiente (1H)',
    shortCode: 'P-1H',
    emoji: '🚪',
    color: '#0284c7',
    isOpening: true,
    defaultWidth: 0.80,
    defaultHeight: 2.05,
    defaultSwing: 'right'
  },
  puerta_doble: {
    type: 'puerta_doble',
    label: 'Puerta Doble Hoja (2H)',
    shortCode: 'P-2H',
    emoji: '🚪🚪',
    color: '#0369a1',
    isOpening: true,
    defaultWidth: 1.60,
    defaultHeight: 2.05,
    defaultSwing: 'double'
  },
  puerta_corrediza: {
    type: 'puerta_corrediza',
    label: 'Puerta Corrediza / Embutida',
    shortCode: 'P-CORR',
    emoji: '🚪↔️',
    color: '#0891b2',
    isOpening: true,
    defaultWidth: 0.80,
    defaultHeight: 2.05,
    defaultSwing: 'sliding'
  },
  porton_garage: {
    type: 'porton_garage',
    label: 'Portón de Garage / Acceso Autos',
    shortCode: 'PORT',
    emoji: '🚗',
    color: '#d97706',
    isOpening: true,
    defaultWidth: 2.80,
    defaultHeight: 2.20,
    defaultSwing: 'overhead'
  },
  vano_libre: {
    type: 'vano_libre',
    label: 'Vano / Paso Libre sin Hoja',
    shortCode: 'VANO',
    emoji: '↔️',
    color: '#16a34a',
    strokeDasharray: '3,3',
    isOpening: true,
    defaultWidth: 1.20,
    defaultHeight: 2.10,
    defaultSwing: 'fixed'
  },
  open_space: {
    type: 'vano_libre',
    label: 'Espacio Integrado',
    shortCode: 'VANO',
    emoji: '↔️',
    color: '#16a34a',
    strokeDasharray: '3,3',
    isOpening: true,
    defaultWidth: 2.00,
    defaultHeight: 2.60,
    defaultSwing: 'fixed'
  },
  ventana_estandar: {
    type: 'ventana_estandar',
    label: 'Ventana',
    shortCode: 'VENT',
    emoji: '🪟',
    color: '#7c3aed',
    isOpening: true,
    defaultWidth: 1.50,
    defaultHeight: 1.10,
    defaultSillHeight: 0.90,
    defaultSwing: 'sliding'
  },
  puerta_ventana: {
    type: 'puerta_ventana',
    label: 'Puerta-Ventana Balcón/Patio',
    shortCode: 'P-VENT',
    emoji: '🪟🚪',
    color: '#6366f1',
    isOpening: true,
    defaultWidth: 2.00,
    defaultHeight: 2.05,
    defaultSillHeight: 0.0,
    defaultSwing: 'sliding'
  },
  pared_comun: {
    type: 'pared_comun',
    label: 'Pared Común / Tabique Ciego',
    shortCode: 'MURO-C',
    emoji: '🧱',
    color: '#64748b',
    strokeDasharray: '6,4',
    isOpening: false,
    defaultWidth: 0,
    defaultHeight: 0
  },
  limite_virtual: {
    type: 'limite_virtual',
    label: 'Límite Abierto / Integrado (Sin Muro)',
    shortCode: 'LIM-ABIERTO',
    emoji: '🚪',
    color: '#0284c7',
    strokeDasharray: '6,4',
    isOpening: false,
    defaultWidth: 0,
    defaultHeight: 0
  },
  conduit_main: {
    type: 'conduit_main',
    label: 'Troncal Cañería (Alimentador)',
    shortCode: 'CAÑ-TP',
    emoji: '⚡',
    color: '#dc2626',
    isOpening: false,
    defaultWidth: 0,
    defaultHeight: 0
  },
  conduit_sec: {
    type: 'conduit_sec',
    label: 'Cañería de Distribución Seccional',
    shortCode: 'CAÑ-SEC',
    emoji: '🔌',
    color: '#ea580c',
    isOpening: false,
    defaultWidth: 0,
    defaultHeight: 0
  },
  pass_through: {
    type: 'pass_through',
    label: 'Pase de Losa / Muro',
    shortCode: 'PASE',
    emoji: '🧱',
    color: '#9333ea',
    strokeDasharray: '5,5',
    isOpening: false,
    defaultWidth: 0,
    defaultHeight: 0
  }
};

/**
 * Lista canónica y única de tipos de aberturas (sin alias duplicados para Select/Menus).
 */
export const CANONICAL_OPENING_TYPES: ConnectionTypeMetadata[] = [
  CONNECTION_TYPE_CATALOG.puerta_estandar,
  CONNECTION_TYPE_CATALOG.puerta_seguridad,
  CONNECTION_TYPE_CATALOG.puerta_doble,
  CONNECTION_TYPE_CATALOG.puerta_corrediza,
  CONNECTION_TYPE_CATALOG.porton_garage,
  CONNECTION_TYPE_CATALOG.vano_libre,
  CONNECTION_TYPE_CATALOG.ventana_estandar,
  CONNECTION_TYPE_CATALOG.puerta_ventana
];

/**
 * Retorna la lista unificada de aberturas de una conexión (soporta arreglo `openings` o fallback legacy `opening`).
 */
export function getConnectionOpenings(conn: LogicalConnection): OpeningProperties[] {
  if (conn.openings && Array.isArray(conn.openings)) {
    return conn.openings;
  }
  if (conn.opening) {
    return [conn.opening];
  }
  return [];
}

/**
 * Retorna el espesor constructivo en metros de un muro compartido, con fallback al espesor global.
 */
export function getConnectionWallThickness(
  conn?: LogicalConnection,
  fallbackThicknessMeters: number = 0.10
): number {
  if (conn?.isVirtualBoundary || conn?.wallProperties?.isVirtualBoundary || conn?.type === 'limite_virtual') {
    return 0;
  }
  if (conn?.wallProperties?.thicknessMeters && conn.wallProperties.thicknessMeters > 0) {
    return conn.wallProperties.thicknessMeters;
  }
  return fallbackThicknessMeters;
}

/**
 * Retorna los metadatos del material constructivo del tabique/muro de la conexión.
 */
export function getConnectionMaterialMeta(
  conn?: LogicalConnection
): TabiqueMaterialMetadata {
  const matType = conn?.wallProperties?.materialType || 'ladrillo_hueco_8';
  return TABIQUE_MATERIAL_CATALOG[matType] || TABIQUE_MATERIAL_CATALOG.ladrillo_hueco_8;
}

