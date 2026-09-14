/**
 * Model: ElectricalSymbolsModel
 * Gestión del Catálogo de Símbolos Eléctricos Vectoriales Normalizados (IRAM / AEA 90364 / IEC).
 * Carga síncrona desde symbols.json y persistencia de símbolos personalizados.
 */

import symbolsFileData from './symbols.json';

export interface SymbolCategory {
  id: string;
  name: string;
}

export type SymbolPinRole = 'phase' | 'neutral' | 'pe' | 'other';

export interface SymbolPin {
  id: string;
  name?: string;
  role: SymbolPinRole;
  x: number;
  y: number;
  anchor?: 'top' | 'bottom' | 'left' | 'right';
}

export type ModoAnclajeSugerido = 'pared' | 'techo' | 'piso';

export interface DefinicionSimbolo {
  id: string;
  label: string;
  escalaBase: number;
  anclaje: { x: number; y: number };
  uso?: 'planta' | 'unifilar';
  categoria?: string;
  alturaDefault?: number;
  anclajeSugerido?: ModoAnclajeSugerido;
  codigoRef?: string;
  svgContent: string;
  pins?: SymbolPin[];
  ownerId?: string;
  createdAt?: number;
}

export interface SymbolsFile {
  categories: SymbolCategory[];
  symbols: DefinicionSimbolo[];
}

const CUSTOM_SYMBOLS_STORAGE_KEY = 'relevacad_custom_symbols_v1';

/**
 * Retorna todos los símbolos estándar incorporados en el bundle.
 */
export const getDefaultSymbolsSync = (): DefinicionSimbolo[] => {
  return (symbolsFileData.symbols || []) as DefinicionSimbolo[];
};

/**
 * Retorna todas las categorías del catálogo.
 */
export const getDefaultCategoriesSync = (): SymbolCategory[] => {
  return (symbolsFileData.categories || []) as SymbolCategory[];
};

/**
 * Filtra los símbolos por ámbito de uso ('planta' o 'unifilar').
 */
export const getSymbolsByUsoSync = (uso?: 'planta' | 'unifilar'): DefinicionSimbolo[] => {
  const all = getDefaultSymbolsSync();
  if (!uso) return all;
  return all.filter((s) => s.uso === uso);
};

/**
 * Filtra los símbolos por categoría.
 */
export const getSymbolsByCategorySync = (categoria?: string): DefinicionSimbolo[] => {
  const all = getDefaultSymbolsSync();
  if (!categoria) return all;
  return all.filter((s) => s.categoria === categoria);
};

/**
 * Busca un símbolo por ID (primero en default, luego en custom).
 */
export const getSymbolById = (id: string): DefinicionSimbolo | undefined => {
  const defaults = getDefaultSymbolsSync();
  const found = defaults.find((s) => s.id === id);
  if (found) return found;

  const customs = loadCustomSymbolsFromStorage();
  return customs.find((s) => s.id === id);
};

/**
 * Carga los símbolos personalizados guardados por el usuario en localStorage.
 */
export const loadCustomSymbolsFromStorage = (): DefinicionSimbolo[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_SYMBOLS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Error al cargar símbolos personalizados de localStorage:', err);
    return [];
  }
};

/**
 * Persiste los símbolos personalizados en localStorage.
 */
export const saveCustomSymbolsToStorage = (customSymbols: DefinicionSimbolo[]): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CUSTOM_SYMBOLS_STORAGE_KEY, JSON.stringify(customSymbols));
  } catch (err) {
    console.error('Error al guardar símbolos personalizados en localStorage:', err);
  }
};

/**
 * Retorna la unión de símbolos del sistema + personalizados activos.
 */
export const getAllAvailableSymbols = (): DefinicionSimbolo[] => {
  return [...getDefaultSymbolsSync(), ...loadCustomSymbolsFromStorage()];
};

/**
 * Resuelve la altura reglamentaria de montaje por defecto de un símbolo
 * utilizando su metadata de catálogo o el techo del local si corresponde.
 */
export const getSymbolDefaultHeight = (simboloId: string, ceilingHeight: number = 2.6): number => {
  const def = getSymbolById(simboloId);
  if (!def) return 0.35; // Fallback razonable si no existe

  if (def.anclajeSugerido === 'techo' || def.id.includes('techo')) {
    return ceilingHeight;
  }
  return def.alturaDefault ?? 0.35;
};
