/**
 * View Helper: SVG Symbol Konva Renderer
 * Rasteriza dinámicamente el contenido SVG normalizado de symbols.json
 * en un HTMLImageElement optimizado y cacheado en memoria para Konva (60 FPS).
 */

import { DefinicionSimbolo } from '@/models/ElectricalSymbolsModel';

const imageCache = new Map<string, HTMLImageElement>();
const listeners = new Set<() => void>();

/**
 * Registra una función para re-renderizar cuando una imagen SVG termine de cargar en memoria.
 */
export function onSvgSymbolLoaded(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyLoaded(): void {
  listeners.forEach((fn) => fn());
}

/**
 * Obtiene o genera la imagen SVG para un símbolo y color dados.
 */
export function getSymbolImage(
  simbolo: DefinicionSimbolo,
  color: string = '#0284c7',
  pixelSize: number = 44
): HTMLImageElement | null {
  const cacheKey = `${simbolo.id}_${color}_${pixelSize}`;

  if (imageCache.has(cacheKey)) {
    const cached = imageCache.get(cacheKey)!;
    return cached.complete ? cached : null;
  }

  // Sustituir currentColor por el color del circuito/tema
  let svg = simbolo.svgContent.replace(/currentColor/g, color);

  // Si no tiene el tag contenedor <svg>, lo encapsulamos en un viewport normalizado centrado
  if (!svg.trim().startsWith('<svg')) {
    // La mayoría de los símbolos están dibujados en torno a [-1.8, 1.8] o [-0.6, 0.6]
    svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="-2.2 -2.2 4.4 4.4" width="${pixelSize}" height="${pixelSize}">
        <g stroke="${color}" fill="none">
          ${svg}
        </g>
      </svg>
    `;
  } else {
    // Si ya tiene <svg>, aseguramos width, height y xmlns
    if (!svg.includes('xmlns=')) {
      svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
  }

  const img = new window.Image();
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  img.onload = () => {
    URL.revokeObjectURL(url);
    notifyLoaded();
  };

  img.onerror = () => {
    console.warn(`Error al rasterizar SVG para símbolo ${simbolo.id}`);
  };

  img.src = url;
  imageCache.set(cacheKey, img);

  return img.complete ? img : null;
}
