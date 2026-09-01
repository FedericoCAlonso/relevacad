/**
 * Model: Electrical Types and Definitions
 * Tipos de elementos eléctricos utilizados en el relevamiento de obra (Normativa AEA / IEC)
 */

export type ElectricalAssetCategory =
  | 'panel'       // Tableros
  | 'outlet'      // Tomacorrientes
  | 'lighting'    // Iluminación y Bocas de techo/pared
  | 'switch'      // Interruptores / Efectos
  | 'junction'    // Cajas de paso / derivación
  | 'conduit';    // Acometidas y pases de cañería

export type ElectricalAssetType =
  | 'main_panel'          // Tablero Principal (TP)
  | 'sub_panel'           // Tablero Seccional (TS)
  | 'single_outlet_10a'   // Tomacorriente Simple 10A (TUG)
  | 'double_outlet_10a'   // Tomacorriente Doble 10A (TUG)
  | 'outlet_20a'          // Tomacorriente Especial 20A (TUE)
  | 'switch_1_module'     // Interruptor 1 Punto
  | 'switch_2_module'     // Interruptor 2 Puntos
  | 'switch_combo'        // Interruptor Combinación
  | 'ceiling_light'       // Centro / Boca de Techo (IUG)
  | 'wall_light'          // Aplique de Pared (IUG/IUE)
  | 'junction_box_oct'    // Caja de Paso Octogonal
  | 'junction_box_rect'   // Caja de Paso Rectangular (10x5)
  | 'junction_box_sqr'    // Caja de Paso Cuadrada (10x10)
  | 'floor_outlet'        // Tomacorriente de Piso
  | 'conduit_entry';      // Entrada/Pase de Cañería

export interface ElectricalAssetMetadata {
  type: ElectricalAssetType;
  label: string;
  category: ElectricalAssetCategory;
  defaultHeight: number; // Altura estándar de montaje en metros (ej. tomas 0.30m, llaves 1.10m, aplique 2.10m)
  iconName: string;
  code: string;          // Abreviatura técnica (ej: TP, TS, TUG, IUG)
}

export const ELECTRICAL_ASSET_CATALOG: Record<ElectricalAssetType, ElectricalAssetMetadata> = {
  main_panel: {
    type: 'main_panel',
    label: 'Tablero Principal (TP)',
    category: 'panel',
    defaultHeight: 1.50,
    iconName: 'ElectricBolt',
    code: 'TP'
  },
  sub_panel: {
    type: 'sub_panel',
    label: 'Tablero Seccional (TS)',
    category: 'panel',
    defaultHeight: 1.50,
    iconName: 'Power',
    code: 'TS'
  },
  single_outlet_10a: {
    type: 'single_outlet_10a',
    label: 'Toma Simple 10A (TUG)',
    category: 'outlet',
    defaultHeight: 0.35,
    iconName: 'PowerOutlined',
    code: 'TUG-1'
  },
  double_outlet_10a: {
    type: 'double_outlet_10a',
    label: 'Toma Doble 10A (TUG)',
    category: 'outlet',
    defaultHeight: 0.35,
    iconName: 'Outlet',
    code: 'TUG-2'
  },
  outlet_20a: {
    type: 'outlet_20a',
    label: 'Toma Uso Especial 20A (TUE)',
    category: 'outlet',
    defaultHeight: 0.35,
    iconName: 'ElectricalServices',
    code: 'TUE-20'
  },
  switch_1_module: {
    type: 'switch_1_module',
    label: 'Llave de 1 Punto (IUG)',
    category: 'switch',
    defaultHeight: 1.15,
    iconName: 'ToggleOn',
    code: 'SW-1'
  },
  switch_2_module: {
    type: 'switch_2_module',
    label: 'Llave de 2 Puntos (IUG)',
    category: 'switch',
    defaultHeight: 1.15,
    iconName: 'ToggleOff',
    code: 'SW-2'
  },
  switch_combo: {
    type: 'switch_combo',
    label: 'Llave de Combinación',
    category: 'switch',
    defaultHeight: 1.15,
    iconName: 'AltRoute',
    code: 'SW-C'
  },
  ceiling_light: {
    type: 'ceiling_light',
    label: 'Boca de Techo / Centro (IUG)',
    category: 'lighting',
    defaultHeight: 2.60,
    iconName: 'Lightbulb',
    code: 'BT'
  },
  wall_light: {
    type: 'wall_light',
    label: 'Aplique de Pared (Brazo)',
    category: 'lighting',
    defaultHeight: 2.10,
    iconName: 'EmojiObjects',
    code: 'AP'
  },
  junction_box_oct: {
    type: 'junction_box_oct',
    label: 'Caja Octogonal de Derivación',
    category: 'junction',
    defaultHeight: 2.30,
    iconName: 'Category',
    code: 'C-OCT'
  },
  junction_box_rect: {
    type: 'junction_box_rect',
    label: 'Caja de Paso Rectangular',
    category: 'junction',
    defaultHeight: 0.35,
    iconName: 'CropLandscape',
    code: 'C-REC'
  },
  junction_box_sqr: {
    type: 'junction_box_sqr',
    label: 'Caja Cuadrada de Inspección',
    category: 'junction',
    defaultHeight: 1.50,
    iconName: 'CropSquare',
    code: 'C-CUAD'
  },
  floor_outlet: {
    type: 'floor_outlet',
    label: 'Toma de Piso Embutido',
    category: 'outlet',
    defaultHeight: 0.0,
    iconName: 'Layers',
    code: 'TPISO'
  },
  conduit_entry: {
    type: 'conduit_entry',
    label: 'Acometida / Entrada de Cañería',
    category: 'conduit',
    defaultHeight: 2.40,
    iconName: 'CallSplit',
    code: 'ACOM'
  }
};
