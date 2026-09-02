/**
 * Model: ProjectModel
 * Estructuras de datos para la Gestión de Relevamientos y Clientes en RelevaCAD,
 * diseñadas con compatibilidad directa 1:1 con el ecosistema Cotizador IEBA.
 */

import { Room } from './RoomModel';
import { LogicalConnection } from './GraphModel';
import { NodoElectrico, TramoElectrico } from './ElectricalGraphModel';

export interface Cliente {
  id: string;
  nombre: string;
  cuitDni?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  localidad?: string;
  provincia?: string;
  notas?: string;
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
}

export type RumboCardinal =
  | 'Norte'
  | 'Noreste'
  | 'Este'
  | 'Sureste'
  | 'Sur'
  | 'Suroeste'
  | 'Oeste'
  | 'Noroeste';

export interface OrientacionSolarMetadata {
  rumbo: RumboCardinal;
  azimutGrados: number; // 0° = Norte, 90° = Este, 180° = Sur, 270° = Oeste
  emoji: string;
  aprovechamientoSolarHemisferioSur: string;
}

export const RUMBOS_SOLARES_CATALOG: Record<RumboCardinal, OrientacionSolarMetadata> = {
  Norte: {
    rumbo: 'Norte',
    azimutGrados: 0,
    emoji: '🧭⬆️',
    aprovechamientoSolarHemisferioSur: 'Máxima captación solar y rendimiento óptimo para paneles fotovoltaicos y colectores solares'
  },
  Noreste: {
    rumbo: 'Noreste',
    azimutGrados: 45,
    emoji: '🧭↗️',
    aprovechamientoSolarHemisferioSur: 'Excelente sol matutino y muy buen rendimiento fotovoltaico'
  },
  Este: {
    rumbo: 'Este',
    azimutGrados: 90,
    emoji: '🧭➡️',
    aprovechamientoSolarHemisferioSur: 'Sol directo por la mañana, sombra por la tarde'
  },
  Sureste: {
    rumbo: 'Sureste',
    azimutGrados: 135,
    emoji: '🧭↘️',
    aprovechamientoSolarHemisferioSur: 'Sol suave de mañana, rendimiento solar moderado'
  },
  Sur: {
    rumbo: 'Sur',
    azimutGrados: 180,
    emoji: '🧭⬇️',
    aprovechamientoSolarHemisferioSur: 'Luz indirecta/difusa, sin sol directo en invierno en el Hemisferio Sur'
  },
  Suroeste: {
    rumbo: 'Suroeste',
    azimutGrados: 225,
    emoji: '🧭↙️',
    aprovechamientoSolarHemisferioSur: 'Sol de tarde, mayor carga térmica estival'
  },
  Oeste: {
    rumbo: 'Oeste',
    azimutGrados: 270,
    emoji: '🧭⬅️',
    aprovechamientoSolarHemisferioSur: 'Sol fuerte por la tarde / poniente'
  },
  Noroeste: {
    rumbo: 'Noroeste',
    azimutGrados: 315,
    emoji: '🧭↖️',
    aprovechamientoSolarHemisferioSur: 'Excelente captación de tarde y alto rendimiento solar'
  }
};

export interface RelevamientoProyecto {
  id: string;
  nombre: string;
  
  // Datos del Cliente (1:1 con Cotizador IEBA)
  clienteId?: string;
  clienteNombre?: string;
  clienteTelefono?: string;
  clienteEmail?: string;
  clienteDireccion?: string;
  clienteCuitDni?: string;
  
  // Datos del Inmueble y Emplazamiento Geográfico / Solar
  ubicacion?: string;
  descripcion?: string;
  rumboFrente?: RumboCardinal; // Orientación cardinal del frente de la propiedad
  azimutGrados?: number;        // Ángulo de acimut respecto al norte real (0° - 360°)
  
  // Geometría Arquitectónica y Red Eléctrica
  rooms: Room[];
  connections: LogicalConnection[];
  electricalNodes: NodoElectrico[];
  electricalTramos: TramoElectrico[];
  wallThicknessMeters: number;
  
  // Estado y Metadatos
  estado?: 'borrador' | 'en_relevamiento' | 'completado' | 'exportado';
  createdAt: string;
  updatedAt: string;
}

/**
 * Payload interoperable para exportación directa a Cotizador IEBA
 */
export interface CotizadorIebaExportPayload {
  version: string;
  generator: 'RelevaCAD';
  exportedAt: string;
  proyecto: {
    id: string;
    nombre: string;
    ubicacion?: string;
    descripcion?: string;
    rumboFrente?: RumboCardinal;
    azimutGrados?: number;
    cliente?: Cliente;
  };
  computoElectrico: {
    superficieTotalM2: number;
    cantidadAmbientes: number;
    totalBocas: number;
    bocasIUG: number;
    bocasTUG: number;
    bocasTUE: number;
    cajasDePaso: number;
    tablerosPrincipales: number;
    tablerosSeccionales: number;
    metrosCaneriaTotal: number;
    metrosCaneriaPorDiametro: Record<number, number>; // mm -> metros
    metrosConductoresPorSeccion: Record<string, number>; // '1.5', '2.5', '4.0', '6.0' -> metros
    circuitosDetectados: Array<{
      codigo: string;
      tipo: string;
      bocasCount: number;
      longitudAproxMetros: number;
    }>;
    murosPorMaterial: Array<{
      materialType: string;
      materialLabel: string;
      espesorCm: number;
      metrosLineales: number;
      metrosCuadrados: number;
      admiteCanaleteado: boolean;
      metodoCanaleteado: string;
    }>;
  };
  rawRelevamiento: RelevamientoProyecto;
}
