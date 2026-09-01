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
  // Vínculos Técnicos
  | 'conduit_main'         // Cañería Troncal / Acometida
  | 'conduit_sec'          // Cañería Seccional
  | 'pass_through'         // Pase de Losa / Muro técnico
  // Compatibilidad
  | 'door'
  | 'open_space';

export type SwingDirection = 'left' | 'right' | 'sliding' | 'overhead' | 'double' | 'fixed';
export type OpeningMaterial = 'wood' | 'aluminum' | 'steel' | 'pvc' | 'glass';

export interface OpeningProperties {
  openingType: LogicalConnectionType;
  widthMeters: number;       // Ancho de la abertura (ej: 0.80m, 1.50m, 2.80m)
  heightMeters: number;      // Altura de la abertura (ej: 2.05m, 1.10m)
  sillHeightMeters?: number; // Cota de antepecho (distancia suelo-alfeizar en ventanas, ej: 0.90m)
  swingDirection?: SwingDirection; // Sentido / mano de apertura
  material?: OpeningMaterial;      // Material de la carpintería
  hasElectricalPass?: boolean;     // Cruce de cañería eléctrica por marco/vano
  hasAutomation?: boolean;         // Automatización (Portero visor, cerradura eléctrica, motor portón, sensor)
  notes?: string;
}

export interface LogicalConnection {
  id: string;
  sourceRoomId: string;
  targetRoomId: string;
  type: LogicalConnectionType;
  label?: string;
  opening?: OpeningProperties;

  // Orientación cardinal de anclaje (Pared donde se ubica la abertura en cada ambiente)
  sourceWall?: WallOrientation;
  targetWall?: WallOrientation;
  sourceHandle?: string; // ID del handle en React Flow (ej: 'source-north', 'source-south')
  targetHandle?: string; // ID del handle en React Flow (ej: 'target-north', 'target-south')

  ductDiameterMm?: number; // Diámetro de cañería en mm (ej: 19mm / 3/4", 25mm / 1", 32mm / 1.25")
  cableCircuits?: string[]; // IDs de circuitos que transitan por este conducto
  notes?: string;
}

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
