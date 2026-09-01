/**
 * Model: ElectricalGraphModel
 * Modelo de Topología Eléctrica (Nodos Eléctricos y Canalizaciones / Cañerías Multicircuito)
 * Basado en la normativa AEA 90364-771 y arquitectura del proyecto 'Traza'.
 */

export type TipoNodoElectrico =
  | 'medidor_kwh'           // Medidor de energía de la distribuidora
  | 'tablero_principal'     // Tablero Principal (TP)
  | 'tablero_seccional'     // Tablero Seccional / Subdistribución (TS)
  | 'caja_paso_comun'       // Caja de paso en montante / palier común
  | 'caja_derivacion'       // Caja de paso/derivación interna (octogonal/cuadrada)
  | 'boca_iluminacion'      // Boca de iluminación / centro
  | 'boca_tomacorriente'    // Boca de tomacorrientes (TUG/TUE)
  | 'jabalina_pat'          // Toma de tierra / Jabalina de Puesta a Tierra
  | 'acometida_red';        // Punto de conexión a la red pública

export interface NodoElectrico {
  id: string;
  roomId: string;           // ID del contenedor arquitectónico (Espacio/Ambiente/Isla Técnica)
  tipo: TipoNodoElectrico;
  etiqueta: string;         // Ej: "Medidor M-01", "Caja de Paso Palier 2°P", "TS-01"
  codigoRef?: string;       // Código técnico (ej: "MED-01", "TSG", "CP-P2")
  circuitoCodigo?: string;  // Circuito asociado (si aplica)
  assetId?: string;         // Enlace opcional al ElectricalAsset del RoomModel
  tensionNominalV?: number; // 220V / 380V
  notas?: string;
}

export type TipoConductor =
  | 'fase'                 // Conductor de fase activo (L)
  | 'neutro'               // Conductor neutro (N)
  | 'tierra_pe'            // Conductor de protección a tierra (PE)
  | 'retorno'              // Retorno de interruptor simple a luminaria (R)
  | 'retorno_combinacion'  // Retorno de circuito de combinación / 3 vías (RC)
  | 'comando';             // Señal / portero / pulsador

export type ColorAislacion =
  | 'marron'
  | 'marrón'
  | 'negro'
  | 'rojo'
  | 'celeste'
  | 'verde_amarillo'
  | 'blanco'
  | 'gris';

export interface ConductorLine {
  id: string;
  circuitoCodigo: string;     // ej: "C1-IUG", "C2-TUG", "ALIM-GRAL"
  tipoConductor: TipoConductor;
  seccionMm2: number;          // 1.5, 2.5, 4.0, 6.0, 10.0 mm²
  colorAislacion?: ColorAislacion;
  etiqueta?: string;           // ej: "Retorno Luz Techo", "Retorno 1", "Fase L1"
}

export type TipoMontajeCañeria =
  | 'embutido'
  | 'losa'
  | 'a_la_vista'
  | 'subterraneo'
  | 'bandeja'
  | 'pleno_montante';

export type TipoMaterialCañeria =
  | 'corrugado_blanco'
  | 'corrugado_reforzado'
  | 'rigido_pvc'
  | 'acero_semipesado'
  | 'acero_pesado';

export interface TramoElectrico {
  id: string;
  sourceNodeId: string;        // NodoEléctrico origen (upstream)
  targetNodeId: string;        // NodoEléctrico destino (downstream)
  longitudMeters: number;      // Longitud física estimada en metros
  diametroCañoMm: number;      // Diámetro nominal del caño (19, 22, 25, 32, 38, 50 mm)
  tipoMaterial?: TipoMaterialCañeria;
  tipoMontaje: TipoMontajeCañeria;
  tensionV: number;            // 220 / 380 V
  conductores: ConductorLine[]; // Lista de cables alojados que pasan por esta cañería
  notas?: string;

  // Campos de compatibilidad y resumen
  circuitoCodigo?: string;     // Resumen de circuitos (ej: "C1-IUG, C2-TUG")
  seccionMm2?: number;         // Sección nominal predominante
  cantidadConductores?: number;
  seccionPeMm2?: number;
  materialConductor?: 'Cu' | 'Al';
  tipoAislacion?: 'PVC' | 'XLPE' | 'LSOH' | 'IRAM2178';
  esTrifasico?: boolean;
}

export interface TipoNodoElectricoMetadata {
  tipo: TipoNodoElectrico;
  label: string;
  shortCode: string;
  emoji: string;
  color: string;
  defaultTension: number;
}

export const TIPO_NODO_ELECTRICO_CATALOG: Record<TipoNodoElectrico, TipoNodoElectricoMetadata> = {
  medidor_kwh: {
    tipo: 'medidor_kwh',
    label: 'Medidor de Energía kWh',
    shortCode: 'MED',
    emoji: '⚡📊',
    color: '#059669',
    defaultTension: 220
  },
  tablero_principal: {
    tipo: 'tablero_principal',
    label: 'Tablero Principal (TP)',
    shortCode: 'TP',
    emoji: '⚡🛡️',
    color: '#dc2626',
    defaultTension: 220
  },
  tablero_seccional: {
    tipo: 'tablero_seccional',
    label: 'Tablero Seccional (TS)',
    shortCode: 'TS',
    emoji: '⚡🔌',
    color: '#2563eb',
    defaultTension: 220
  },
  caja_paso_comun: {
    tipo: 'caja_paso_comun',
    label: 'Caja de Paso Común / Palier',
    shortCode: 'CP-COM',
    emoji: '🔲',
    color: '#7c3aed',
    defaultTension: 220
  },
  caja_derivacion: {
    tipo: 'caja_derivacion',
    label: 'Caja de Derivación Interna',
    shortCode: 'CP-INT',
    emoji: '📦',
    color: '#6b7280',
    defaultTension: 220
  },
  boca_iluminacion: {
    tipo: 'boca_iluminacion',
    label: 'Boca de Iluminación (IUG)',
    shortCode: 'IUG',
    emoji: '💡',
    color: '#d97706',
    defaultTension: 220
  },
  boca_tomacorriente: {
    tipo: 'boca_tomacorriente',
    label: 'Boca de Tomas (TUG/TUE)',
    shortCode: 'TUG',
    emoji: '🔌',
    color: '#0284c7',
    defaultTension: 220
  },
  jabalina_pat: {
    tipo: 'jabalina_pat',
    label: 'Jabalina Puesta a Tierra (PAT)',
    shortCode: 'PAT',
    emoji: '⏚',
    color: '#16a34a',
    defaultTension: 0
  },
  acometida_red: {
    tipo: 'acometida_red',
    label: 'Acometida Red Distribuidora',
    shortCode: 'RED',
    emoji: '🗼',
    color: '#b91c1c',
    defaultTension: 380
  }
};

/**
 * Diámetro exterior estimado de cables unipolares IRAM 2183 / IRAM 62267 (aislación incluida)
 */
const CABLE_OUTER_DIAMETER_MM: Record<number, number> = {
  1.5: 3.0,
  2.5: 3.6,
  4.0: 4.2,
  6.0: 4.8,
  10.0: 6.2,
  16.0: 7.4,
  25.0: 9.0
};

/**
 * Diámetro interior útil de cañerías según IRAM 62386 / 2005 (en mm)
 */
const CONDUIT_INNER_DIAMETER_MM: Record<number, number> = {
  16: 12.0,
  19: 15.0,  // Caño 3/4"
  22: 17.5,  // Caño 7/8"
  25: 20.5,  // Caño 1"
  32: 27.0,  // Caño 1 1/4"
  38: 33.0,  // Caño 1 1/2"
  50: 44.0   // Caño 2"
};

/**
 * Calcula el Factor de Ocupación de la Cañería según AEA 90364-771 (máximo 35% para 3 o más conductores)
 */
export function calculateConduitFillRatio(tramo: TramoElectrico): {
  fillRatioPct: number;
  isCompliant: boolean;
  totalConductorAreaMm2: number;
  innerConduitAreaMm2: number;
  maxAllowedPct: number;
} {
  const conductors = tramo.conductores && tramo.conductores.length > 0
    ? tramo.conductores
    : [
        { id: 'c1', circuitoCodigo: tramo.circuitoCodigo || 'C1', tipoConductor: 'fase' as TipoConductor, seccionMm2: tramo.seccionMm2 || 2.5 },
        { id: 'c2', circuitoCodigo: tramo.circuitoCodigo || 'C1', tipoConductor: 'neutro' as TipoConductor, seccionMm2: tramo.seccionMm2 || 2.5 },
        { id: 'c3', circuitoCodigo: tramo.circuitoCodigo || 'C1', tipoConductor: 'tierra_pe' as TipoConductor, seccionMm2: tramo.seccionPeMm2 || 2.5 }
      ];

  let totalArea = 0;
  conductors.forEach((c) => {
    const extDiam = CABLE_OUTER_DIAMETER_MM[c.seccionMm2] || (Math.sqrt(c.seccionMm2) * 2.2);
    const cableArea = Math.PI * (extDiam / 2) ** 2;
    totalArea += cableArea;
  });

  const innerDiam = CONDUIT_INNER_DIAMETER_MM[tramo.diametroCañoMm] || (tramo.diametroCañoMm * 0.8);
  const conduitArea = Math.PI * (innerDiam / 2) ** 2;

  const ratio = (totalArea / conduitArea) * 100;
  const maxAllowedPct = conductors.length === 1 ? 53 : conductors.length === 2 ? 31 : 35;

  return {
    fillRatioPct: Number(ratio.toFixed(1)),
    isCompliant: ratio <= maxAllowedPct,
    totalConductorAreaMm2: Number(totalArea.toFixed(1)),
    innerConduitAreaMm2: Number(conduitArea.toFixed(1)),
    maxAllowedPct
  };
}

/**
 * Genera la notación técnica normalizada AEA para el rótulo de la cañería
 * Ej: "C1-IUG (|| o- T '') • Ø19"
 */
export function getConduitAeaNotation(tramo: TramoElectrico): string {
  if (!tramo.conductores || tramo.conductores.length === 0) {
    const defaultCode = tramo.circuitoCodigo || 'C-DIST';
    return `${defaultCode} (${tramo.seccionMm2 || 2.5}mm²) • Ø${tramo.diametroCañoMm}`;
  }

  // Agrupar por circuitos
  const circuits = Array.from(new Set(tramo.conductores.map((c) => c.circuitoCodigo)));
  const circLabel = circuits.join(' + ');

  let fasesCount = 0;
  let neutrosCount = 0;
  let tierrasCount = 0;
  let retornosCount = 0;

  tramo.conductores.forEach((c) => {
    if (c.tipoConductor === 'fase') fasesCount++;
    else if (c.tipoConductor === 'neutro') neutrosCount++;
    else if (c.tipoConductor === 'tierra_pe') tierrasCount++;
    else if (c.tipoConductor === 'retorno' || c.tipoConductor === 'retorno_combinacion') retornosCount++;
  });

  const symbols: string[] = [];
  if (fasesCount > 0) symbols.push('/'.repeat(fasesCount));
  if (neutrosCount > 0) symbols.push('o-');
  if (tierrasCount > 0) symbols.push('T');
  if (retornosCount > 0) symbols.push("'".repeat(retornosCount));

  return `${circLabel} [${symbols.join(' ')}] • Ø${tramo.diametroCañoMm} (${tramo.longitudMeters}m)`;
}
