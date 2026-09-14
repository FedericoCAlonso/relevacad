/**
 * Model: ElectricalModel
 * Modelo Unificado de la Instalación Eléctrica Paramétrica (Norma AEA 90364-771).
 * Soporta anclaje paramétrico a muros (con proyección métrica y rotación normal)
 * y anclaje libre espacial a techo o piso.
 */

import { WallOrientation } from './RoomModel';
import { getSymbolDefaultHeight } from './ElectricalSymbolsModel';
import {
  ConductorLine,
  TipoMontajeCañeria,
  TipoMaterialCañeria
} from './ElectricalGraphModel';

export type ModoAnclaje = 'pared' | 'techo' | 'piso';
export type LadoMuro = 'interior' | 'exterior';

export interface AnclajePared {
  wall: WallOrientation;
  distanciaMeters: number;       // Cota métrica desde el vértice origen del muro (en metros)
  lado: LadoMuro;                // Cara interna o externa del tabique
}

export interface AnclajeEspacial {
  xMeters: number;               // Coordenada X local respecto al origen del ambiente
  yMeters: number;               // Coordenada Y local respecto al origen del ambiente
}

export interface AnclajeElemento {
  modo: ModoAnclaje;
  pared?: AnclajePared;
  espacial?: AnclajeEspacial;
}

export interface ElementoElectrico {
  id: string;
  roomId: string;
  simboloId: string;             // Referencia a symbols.json (ej: 'sym-planta-toma', 'sym-planta-boca-techo')
  referencia: string;            // Identificador visual en plano (ej: 'T1', 'B1', 'TS-01')
  circuitoId?: string;           // Código o ID del circuito (ej: 'C1-IUG', 'C2-TUG')
  anclaje: AnclajeElemento;
  alturaMontajeMeters: number;   // Altura sobre NPT (ej: 0.35m, 1.15m, 2.60m)
  efectos?: string;              // Letras de efecto para interruptores/bocas (ej: "a", "b", "a,b")
  mostrarDato?: boolean;         // Si es true, muestra la referencia o efecto en el plano
  datosTecnicos?: Record<string, string>; // Metadatos libres (potencia, módulo, tensión)
  notas?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ConexionExtremo {
  roomId: string;
  elementoId: string;
}

export interface CanalizacionConexion {
  id: string;
  circuitosIds: string[];         // Multicircuito soportado
  from: ConexionExtremo;
  to: ConexionExtremo;
  conductores: ConductorLine[];
  diametroCañoMm: number;         // 19, 22, 25, 32 mm según factor de ocupación
  tipoMaterial: TipoMaterialCañeria;
  tipoMontaje: TipoMontajeCañeria;
  longitudCalculadaMeters?: number;
  longitudManualMeters?: number;
  notas?: string;
}

/**
 * Fábrica para crear un nuevo ElementoElectrico inicializado con sus valores por defecto
 * de catálogo sin requerir valores hardcodeados en los componentes de vista.
 */
export function createElementoElectrico(params: {
  roomId: string;
  simboloId: string;
  referencia: string;
  circuitoId?: string;
  anclaje: AnclajeElemento;
  alturaMontajeMeters?: number;
  ceilingHeight?: number;
  efectos?: string;
}): ElementoElectrico {
  const defHeight = params.alturaMontajeMeters ?? getSymbolDefaultHeight(params.simboloId, params.ceilingHeight);
  const now = new Date().toISOString();

  return {
    id: `elec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    roomId: params.roomId,
    simboloId: params.simboloId,
    referencia: params.referencia,
    circuitoId: params.circuitoId,
    anclaje: params.anclaje,
    alturaMontajeMeters: defHeight,
    efectos: params.efectos,
    mostrarDato: true,
    datosTecnicos: {},
    createdAt: now,
    updatedAt: now
  };
}
