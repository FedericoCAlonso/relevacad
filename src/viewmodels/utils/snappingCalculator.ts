import { Room } from '@/models/RoomModel';
import { LogicalConnection } from '@/models/GraphModel';
import { metersToPixels } from './geometryUtils';

export interface SnapGuideLine {
  id: string;
  orientation: 'vertical' | 'horizontal';
  position: number; // Coordenada X (si es vertical) o Y (si es horizontal)
  start: number;    // Inicio del segmento de guía
  end: number;      // Fin del segmento de guía
  targetRoomId: string;
  isTopologicalAdjacency?: boolean; // Indica si la atracción responde a una arista arquitectónica
  snapType?: 'projection_face' | 'contact_edge' | 'center' | 'topological';
  label?: string;
}

export interface SnapResult {
  x: number;
  y: number;
  snappedX: boolean;
  snappedY: boolean;
  guidelines: SnapGuideLine[];
}

export function calculateMagneticSnapping(
  draggedRoomId: string,
  proposedPos: { x: number; y: number },
  allRooms: Room[],
  connections: LogicalConnection[] = [],
  threshold: number = 18 // Umbral de atracción magnética en píxeles
): SnapResult {
  const draggedRoom = allRooms.find((r) => r.id === draggedRoomId);
  if (!draggedRoom) {
    return {
      x: proposedPos.x,
      y: proposedPos.y,
      snappedX: false,
      snappedY: false,
      guidelines: []
    };
  }

  const isNonMetric = draggedRoom.isAccessPoint || draggedRoom.isTechnicalIsland;
  const draggedW = isNonMetric ? 180 : metersToPixels(draggedRoom.dimensions?.width || 3.0);
  const draggedH = isNonMetric ? 100 : metersToPixels(draggedRoom.dimensions?.length || 2.0);

  let finalX = proposedPos.x;
  let finalY = proposedPos.y;

  let minDeltaX = threshold + 1;
  let minDeltaY = threshold + 1;

  let snappedX = false;
  let snappedY = false;

  let bestXGuide: SnapGuideLine | null = null;
  let bestYGuide: SnapGuideLine | null = null;

  const otherRooms = allRooms.filter((r) => r.id !== draggedRoomId);

  // 1. PRIORIDAD MÁXIMA: Aristas Topológicas (Adyacencia Física Explícita en el Grafo)
  for (const conn of connections) {
    const isSource = conn.sourceRoomId === draggedRoomId;
    const isTarget = conn.targetRoomId === draggedRoomId;
    if (!isSource && !isTarget) continue;

    const targetId = isSource ? conn.targetRoomId : conn.sourceRoomId;
    const target = allRooms.find((r) => r.id === targetId);
    if (!target) continue;

    const myWall = isSource ? conn.sourceWall : conn.targetWall;
    const targetWall = isSource ? conn.targetWall : conn.sourceWall;
    if (!myWall || !targetWall) continue;

    const targetIsNonMetric = target.isAccessPoint || target.isTechnicalIsland;
    const targetW = targetIsNonMetric ? 180 : metersToPixels(target.dimensions?.width || 3.0);
    const targetH = targetIsNonMetric ? 100 : metersToPixels(target.dimensions?.length || 2.0);

    const targetLeft = target.canvasPosition.x;
    const targetRight = target.canvasPosition.x + targetW;
    const targetTop = target.canvasPosition.y;
    const targetBottom = target.canvasPosition.y + targetH;

    const topoThreshold = threshold * 1.8; // Atracción magnética reforzada para ambientes unidos

    // Encastre Horizontal (Este-Oeste)
    if (myWall === 'west' && targetWall === 'east') {
      const d = Math.abs(proposedPos.x - targetRight);
      if (d <= topoThreshold && d < minDeltaX) {
        minDeltaX = d;
        finalX = targetRight;
        snappedX = true;
        bestXGuide = {
          id: `snap-topo-west-east-${target.id}`,
          orientation: 'vertical',
          position: targetRight,
          start: Math.min(proposedPos.y, targetTop) - 40,
          end: Math.max(proposedPos.y + draggedH, targetBottom) + 40,
          targetRoomId: target.id,
          isTopologicalAdjacency: true,
          snapType: 'topological',
          label: '🧱 Muro Compartido (E-O)'
        };
      }
    } else if (myWall === 'east' && targetWall === 'west') {
      const d = Math.abs(proposedPos.x + draggedW - targetLeft);
      if (d <= topoThreshold && d < minDeltaX) {
        minDeltaX = d;
        finalX = targetLeft - draggedW;
        snappedX = true;
        bestXGuide = {
          id: `snap-topo-east-west-${target.id}`,
          orientation: 'vertical',
          position: targetLeft,
          start: Math.min(proposedPos.y, targetTop) - 40,
          end: Math.max(proposedPos.y + draggedH, targetBottom) + 40,
          targetRoomId: target.id,
          isTopologicalAdjacency: true,
          snapType: 'topological',
          label: '🧱 Muro Compartido (O-E)'
        };
      }
    }

    // Encastre Vertical (Norte-Sur)
    if (myWall === 'north' && targetWall === 'south') {
      const d = Math.abs(proposedPos.y - targetBottom);
      if (d <= topoThreshold && d < minDeltaY) {
        minDeltaY = d;
        finalY = targetBottom;
        snappedY = true;
        bestYGuide = {
          id: `snap-topo-north-south-${target.id}`,
          orientation: 'horizontal',
          position: targetBottom,
          start: Math.min(proposedPos.x, targetLeft) - 40,
          end: Math.max(proposedPos.x + draggedW, targetRight) + 40,
          targetRoomId: target.id,
          isTopologicalAdjacency: true,
          snapType: 'topological',
          label: '🧱 Muro Compartido (N-S)'
        };
      }
    } else if (myWall === 'south' && targetWall === 'north') {
      const d = Math.abs(proposedPos.y + draggedH - targetTop);
      if (d <= topoThreshold && d < minDeltaY) {
        minDeltaY = d;
        finalY = targetTop - draggedH;
        snappedY = true;
        bestYGuide = {
          id: `snap-topo-south-north-${target.id}`,
          orientation: 'horizontal',
          position: targetTop,
          start: Math.min(proposedPos.x, targetLeft) - 40,
          end: Math.max(proposedPos.x + draggedW, targetRight) + 40,
          targetRoomId: target.id,
          isTopologicalAdjacency: true,
          snapType: 'topological',
          label: '🧱 Muro Compartido (S-N)'
        };
      }
    }
  }

  // 2. Atracción Geométrica y Proyecciones de Caras en Eje X
  const draggedCenterX = proposedPos.x + draggedW / 2;

  for (const target of otherRooms) {
    const targetIsNonMetric = target.isAccessPoint || target.isTechnicalIsland;
    const targetW = targetIsNonMetric ? 180 : metersToPixels(target.dimensions?.width || 3.0);
    const targetH = targetIsNonMetric ? 100 : metersToPixels(target.dimensions?.length || 2.0);

    const targetLeft = target.canvasPosition.x;
    const targetRight = target.canvasPosition.x + targetW;
    const targetCenterX = targetLeft + targetW / 2;
    const yStart = Math.min(proposedPos.y, target.canvasPosition.y) - 60;
    const yEnd = Math.max(proposedPos.y + draggedH, target.canvasPosition.y + targetH) + 60;

    // a. Contacto: Cara Oeste del arrastrado con Cara Este del objetivo
    const dContactWestEast = Math.abs(proposedPos.x - targetRight);
    if (dContactWestEast < minDeltaX && dContactWestEast <= threshold) {
      minDeltaX = dContactWestEast;
      finalX = targetRight;
      snappedX = true;
      bestXGuide = {
        id: `snap-x-contact-we-${target.id}`,
        orientation: 'vertical',
        position: targetRight,
        start: yStart,
        end: yEnd,
        targetRoomId: target.id,
        snapType: 'contact_edge',
        label: 'Alineación Cara Este/Oeste'
      };
    }

    // b. Contacto: Cara Este del arrastrado con Cara Oeste del objetivo
    const dContactEastWest = Math.abs(proposedPos.x + draggedW - targetLeft);
    if (dContactEastWest < minDeltaX && dContactEastWest <= threshold) {
      minDeltaX = dContactEastWest;
      finalX = targetLeft - draggedW;
      snappedX = true;
      bestXGuide = {
        id: `snap-x-contact-ew-${target.id}`,
        orientation: 'vertical',
        position: targetLeft,
        start: yStart,
        end: yEnd,
        targetRoomId: target.id,
        snapType: 'contact_edge',
        label: 'Alineación Cara Oeste/Este'
      };
    }

    // c. Proyección Colineal: Cara Oeste con Cara Oeste (Alineación Izquierda)
    const dProjLeftLeft = Math.abs(proposedPos.x - targetLeft);
    if (dProjLeftLeft < minDeltaX && dProjLeftLeft <= threshold) {
      minDeltaX = dProjLeftLeft;
      finalX = targetLeft;
      snappedX = true;
      bestXGuide = {
        id: `snap-x-proj-left-${target.id}`,
        orientation: 'vertical',
        position: targetLeft,
        start: yStart,
        end: yEnd,
        targetRoomId: target.id,
        snapType: 'projection_face',
        label: 'Proyección Cara Oeste'
      };
    }

    // d. Proyección Colineal: Cara Este con Cara Este (Alineación Derecha)
    const dProjRightRight = Math.abs(proposedPos.x + draggedW - targetRight);
    if (dProjRightRight < minDeltaX && dProjRightRight <= threshold) {
      minDeltaX = dProjRightRight;
      finalX = targetRight - draggedW;
      snappedX = true;
      bestXGuide = {
        id: `snap-x-proj-right-${target.id}`,
        orientation: 'vertical',
        position: targetRight,
        start: yStart,
        end: yEnd,
        targetRoomId: target.id,
        snapType: 'projection_face',
        label: 'Proyección Cara Este'
      };
    }

    // e. Proyección de Eje Central (Centros alineados en X)
    const dProjCenterX = Math.abs(draggedCenterX - targetCenterX);
    if (dProjCenterX < minDeltaX && dProjCenterX <= threshold * 0.85) {
      minDeltaX = dProjCenterX;
      finalX = targetCenterX - draggedW / 2;
      snappedX = true;
      bestXGuide = {
        id: `snap-x-center-${target.id}`,
        orientation: 'vertical',
        position: targetCenterX,
        start: yStart,
        end: yEnd,
        targetRoomId: target.id,
        snapType: 'center',
        label: 'Eje Central'
      };
    }
  }

  // 3. Atracción Geométrica y Proyecciones de Caras en Eje Y
  const draggedCenterY = proposedPos.y + draggedH / 2;

  for (const target of otherRooms) {
    const targetIsNonMetric = target.isAccessPoint || target.isTechnicalIsland;
    const targetW = targetIsNonMetric ? 180 : metersToPixels(target.dimensions?.width || 3.0);
    const targetH = targetIsNonMetric ? 100 : metersToPixels(target.dimensions?.length || 2.0);

    const targetTop = target.canvasPosition.y;
    const targetBottom = target.canvasPosition.y + targetH;
    const targetCenterY = targetTop + targetH / 2;
    const xStart = Math.min(proposedPos.x, target.canvasPosition.x) - 60;
    const xEnd = Math.max(proposedPos.x + draggedW, target.canvasPosition.x + targetW) + 60;

    // a. Contacto: Cara Norte del arrastrado con Cara Sur del objetivo
    const dContactNorthSouth = Math.abs(proposedPos.y - targetBottom);
    if (dContactNorthSouth < minDeltaY && dContactNorthSouth <= threshold) {
      minDeltaY = dContactNorthSouth;
      finalY = targetBottom;
      snappedY = true;
      bestYGuide = {
        id: `snap-y-contact-ns-${target.id}`,
        orientation: 'horizontal',
        position: targetBottom,
        start: xStart,
        end: xEnd,
        targetRoomId: target.id,
        snapType: 'contact_edge',
        label: 'Alineación Cara Sur/Norte'
      };
    }

    // b. Contacto: Cara Sur del arrastrado con Cara Norte del objetivo
    const dContactSouthNorth = Math.abs(proposedPos.y + draggedH - targetTop);
    if (dContactSouthNorth < minDeltaY && dContactSouthNorth <= threshold) {
      minDeltaY = dContactSouthNorth;
      finalY = targetTop - draggedH;
      snappedY = true;
      bestYGuide = {
        id: `snap-y-contact-sn-${target.id}`,
        orientation: 'horizontal',
        position: targetTop,
        start: xStart,
        end: xEnd,
        targetRoomId: target.id,
        snapType: 'contact_edge',
        label: 'Alineación Cara Norte/Sur'
      };
    }

    // c. Proyección Colineal: Cara Norte con Cara Norte (Alineación Superior)
    const dProjTopTop = Math.abs(proposedPos.y - targetTop);
    if (dProjTopTop < minDeltaY && dProjTopTop <= threshold) {
      minDeltaY = dProjTopTop;
      finalY = targetTop;
      snappedY = true;
      bestYGuide = {
        id: `snap-y-proj-top-${target.id}`,
        orientation: 'horizontal',
        position: targetTop,
        start: xStart,
        end: xEnd,
        targetRoomId: target.id,
        snapType: 'projection_face',
        label: 'Proyección Cara Norte'
      };
    }

    // d. Proyección Colineal: Cara Sur con Cara Sur (Alineación Inferior)
    const dProjBottomBottom = Math.abs(proposedPos.y + draggedH - targetBottom);
    if (dProjBottomBottom < minDeltaY && dProjBottomBottom <= threshold) {
      minDeltaY = dProjBottomBottom;
      finalY = targetBottom - draggedH;
      snappedY = true;
      bestYGuide = {
        id: `snap-y-proj-bottom-${target.id}`,
        orientation: 'horizontal',
        position: targetBottom,
        start: xStart,
        end: xEnd,
        targetRoomId: target.id,
        snapType: 'projection_face',
        label: 'Proyección Cara Sur'
      };
    }

    // e. Proyección de Eje Central (Centros alineados en Y)
    const dProjCenterY = Math.abs(draggedCenterY - targetCenterY);
    if (dProjCenterY < minDeltaY && dProjCenterY <= threshold * 0.85) {
      minDeltaY = dProjCenterY;
      finalY = targetCenterY - draggedH / 2;
      snappedY = true;
      bestYGuide = {
        id: `snap-y-center-${target.id}`,
        orientation: 'horizontal',
        position: targetCenterY,
        start: xStart,
        end: xEnd,
        targetRoomId: target.id,
        snapType: 'center',
        label: 'Eje Central'
      };
    }
  }

  const guidelines: SnapGuideLine[] = [];
  if (bestXGuide) guidelines.push(bestXGuide);
  if (bestYGuide) guidelines.push(bestYGuide);

  return {
    x: finalX,
    y: finalY,
    snappedX,
    snappedY,
    guidelines
  };
}
