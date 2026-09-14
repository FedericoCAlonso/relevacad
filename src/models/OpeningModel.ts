/**
 * Model: OpeningModel
 * Modelo de Aberturas Arquitectónicas CAD (Puertas, Ventanas y Vanos).
 * Adaptado de la arquitectura madura de Traza para integrarse con paredes orientadas
 * y fijación simétrica en muros compartidos.
 */

import { WallOrientation } from './RoomModel';

export type TipoAbertura = 'puerta' | 'ventana' | 'vano';
export type SubtipoPuerta = 'batiente' | 'corrediza' | 'vaiven' | 'pivotante';
export type SubtipoVentana = 'corrediza' | 'abatible' | 'guillotina' | 'pivotante' | 'fija';
export type LadoApertura = 'interior' | 'exterior';
export type SentidoGiro = 'izquierda' | 'derecha';

export interface Abertura {
  id: string;
  roomId: string;                   // ID del ambiente al que pertenece
  wall: WallOrientation;            // 'north' | 'south' | 'east' | 'west'
  posicionMeters: number;           // Distancia métrica desde el inicio de la pared (en metros)
  anchoMeters: number;              // Ancho de paso o vano (ej: 0.80 m)
  altoMeters?: number;              // Altura del vano (ej: 2.05 m para puertas)
  antepechoMeters?: number;         // Altura de antepecho para ventanas (ej: 0.90 m - 1.00 m)
  tipo: TipoAbertura;
  subtipo?: SubtipoPuerta | SubtipoVentana;
  hojas: 1 | 2;
  ladoApertura: LadoApertura;       // Hacia dónde abre/se proyecta la hoja
  sentidoGiro: SentidoGiro;         // Sentido de giro o batiente
  esPrincipal?: boolean;            // Indica si es puerta de acceso principal
  etiqueta?: string;                // Ej: "P1", "V1", "Vano"

  // 🔗 Fijación en Muro Compartido (Docking bidireccional)
  ambienteVecinoId?: string;        // ID del ambiente que comparte el tabique
  wallVecina?: WallOrientation;     // Orientación de la pared del vecino (ej: Sur ↔ Norte)
  aberturaVecinaId?: string;        // ID de la abertura reflejada en el ambiente vecino
}

/** Valores dimensionales estándar según normas de arquitectura */
export const ABERTURA_PRESETS = {
  puerta: {
    anchosEstandar: [0.60, 0.70, 0.80, 0.90, 1.20, 1.40],
    anchoDefault: 0.80,
    altoDefault: 2.05,
    subtipoDefault: 'batiente' as SubtipoPuerta
  },
  ventana: {
    anchosEstandar: [0.80, 1.00, 1.20, 1.50, 1.80, 2.00],
    anchoDefault: 1.20,
    altoDefault: 1.10,
    antepechoDefault: 0.95,
    subtipoDefault: 'corrediza' as SubtipoVentana
  },
  vano: {
    anchosEstandar: [0.80, 0.90, 1.00, 1.50, 2.00],
    anchoDefault: 0.90,
    altoDefault: 2.05
  }
};

/**
 * Fábrica para crear una abertura arquitectónica con valores válidos y sin hardcoding.
 */
export function createAbertura(params: {
  roomId: string;
  wall: WallOrientation;
  posicionMeters: number;
  tipo: TipoAbertura;
  anchoMeters?: number;
  subtipo?: SubtipoPuerta | SubtipoVentana;
  hojas?: 1 | 2;
  ladoApertura?: LadoApertura;
  sentidoGiro?: SentidoGiro;
  etiqueta?: string;
  ambienteVecinoId?: string;
  wallVecina?: WallOrientation;
}): Abertura {
  const preset = ABERTURA_PRESETS[params.tipo];
  const ancho = params.anchoMeters ?? preset.anchoDefault;
  const subtipo = params.subtipo ?? (params.tipo === 'puerta' ? 'batiente' : params.tipo === 'ventana' ? 'corrediza' : undefined);

  return {
    id: `ab-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    roomId: params.roomId,
    wall: params.wall,
    posicionMeters: Math.max(0, Number(params.posicionMeters.toFixed(2))),
    anchoMeters: ancho,
    altoMeters: params.tipo === 'puerta' || params.tipo === 'vano' ? 2.05 : 1.10,
    antepechoMeters: params.tipo === 'ventana' ? 0.95 : 0,
    tipo: params.tipo,
    subtipo,
    hojas: params.hojas ?? 1,
    ladoApertura: params.ladoApertura ?? 'interior',
    sentidoGiro: params.sentidoGiro ?? 'derecha',
    etiqueta: params.etiqueta,
    ambienteVecinoId: params.ambienteVecinoId,
    wallVecina: params.wallVecina
  };
}
