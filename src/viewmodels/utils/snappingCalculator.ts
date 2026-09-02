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
  threshold: number = 18, // Umbral de atracción magnética en píxeles
  wallThicknessMeters: number = 0.10
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

  const wallThicknessPx = metersToPixels(wallThicknessMeters);
  const wallThicknessCm = Math.round(wallThicknessMeters * 100);

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
  // Cara interna de un ambiente encastra con la cara externa del muro del otro (la misma pared compartida)
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

    const topoThreshold = threshold * 1.8;

    // Encastre Horizontal (Este-Oeste): Dragged West con Target East
    if (myWall === 'west' && targetWall === 'east') {
      const snapTargetX = targetRight + wallThicknessPx;
      const d = Math.abs(proposedPos.x - snapTargetX);
      if (d <= topoThreshold && d < minDeltaX) {
        minDeltaX = d;
        finalX = snapTargetX;
        snappedX = true;
        bestXGuide = {
          id: `snap-topo-west-east-${target.id}`,
          orientation: 'vertical',
          position: targetRight + wallThicknessPx / 2,
          start: Math.min(proposedPos.y, targetTop) - 40,
          end: Math.max(proposedPos.y + draggedH, targetBottom) + 40,
          targetRoomId: target.id,
          isTopologicalAdjacency: true,
          snapType: 'topological',
          label: `🧱 Muro Compartido (${wallThicknessCm} cm)`
        };
      }
    } else if (myWall === 'east' && targetWall === 'west') {
      const snapTargetX = targetLeft - draggedW - wallThicknessPx;
      const d = Math.abs(proposedPos.x - snapTargetX);
      if (d <= topoThreshold && d < minDeltaX) {
        minDeltaX = d;
        finalX = snapTargetX;
        snappedX = true;
        bestXGuide = {
          id: `snap-topo-east-west-${target.id}`,
          orientation: 'vertical',
          position: targetLeft - wallThicknessPx / 2,
          start: Math.min(proposedPos.y, targetTop) - 40,
          end: Math.max(proposedPos.y + draggedH, targetBottom) + 40,
          targetRoomId: target.id,
          isTopologicalAdjacency: true,
          snapType: 'topological',
          label: `🧱 Muro Compartido (${wallThicknessCm} cm)`
        };
      }
    }

    // Encastre Vertical (Norte-Sur): Dragged North con Target South
    if (myWall === 'north' && targetWall === 'south') {
      const snapTargetY = targetBottom + wallThicknessPx;
      const d = Math.abs(proposedPos.y - snapTargetY);
      if (d <= topoThreshold && d < minDeltaY) {
        minDeltaY = d;
        finalY = snapTargetY;
        snappedY = true;
        bestYGuide = {
          id: `snap-topo-north-south-${target.id}`,
          orientation: 'horizontal',
          position: targetBottom + wallThicknessPx / 2,
          start: Math.min(proposedPos.x, targetLeft) - 40,
          end: Math.max(proposedPos.x + draggedW, targetRight) + 40,
          targetRoomId: target.id,
          isTopologicalAdjacency: true,
          snapType: 'topological',
          label: `🧱 Muro Compartido (${wallThicknessCm} cm)`
        };
      }
    } else if (myWall === 'south' && targetWall === 'north') {
      const snapTargetY = targetTop - draggedH - wallThicknessPx;
      const d = Math.abs(proposedPos.y - snapTargetY);
      if (d <= topoThreshold && d < minDeltaY) {
        minDeltaY = d;
        finalY = snapTargetY;
        snappedY = true;
        bestYGuide = {
          id: `snap-topo-south-north-${target.id}`,
          orientation: 'horizontal',
          position: targetTop - wallThicknessPx / 2,
          start: Math.min(proposedPos.x, targetLeft) - 40,
          end: Math.max(proposedPos.x + draggedW, targetRight) + 40,
          targetRoomId: target.id,
          isTopologicalAdjacency: true,
          snapType: 'topological',
          label: `🧱 Muro Compartido (${wallThicknessCm} cm)`
        };
      }
    }
  }

  // 2. Atracción Geométrica General y Proyecciones en Eje X
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

    // a. Contacto Muro Compartido: Cara Oeste del arrastrado con Cara Este del objetivo
    // Cara interna del arrastrado a cara externa del objetivo (la misma pared)
    const snapSharedEastX = targetRight + wallThicknessPx;
    const dContactWestEast = Math.abs(proposedPos.x - snapSharedEastX);
    if (dContactWestEast < minDeltaX && dContactWestEast <= threshold) {
      minDeltaX = dContactWestEast;
      finalX = snapSharedEastX;
      snappedX = true;
      bestXGuide = {
        id: `snap-x-contact-we-${target.id}`,
        orientation: 'vertical',
        position: targetRight + wallThicknessPx / 2,
        start: yStart,
        end: yEnd,
        targetRoomId: target.id,
        snapType: 'contact_edge',
        label: `🧱 Muro Compartido (${wallThicknessCm} cm)`
      };
    }

    // b. Contacto Muro Compartido: Cara Este del arrastrado con Cara Oeste del objetivo
    // Cara interna del arrastrado a cara externa del objetivo (la misma pared)
    const snapSharedWestX = targetLeft - draggedW - wallThicknessPx;
    const dContactEastWest = Math.abs(proposedPos.x - snapSharedWestX);
    if (dContactEastWest < minDeltaX && dContactEastWest <= threshold) {
      minDeltaX = dContactEastWest;
      finalX = snapSharedWestX;
      snappedX = true;
      bestXGuide = {
        id: `snap-x-contact-ew-${target.id}`,
        orientation: 'vertical',
        position: targetLeft - wallThicknessPx / 2,
        start: yStart,
        end: yEnd,
        targetRoomId: target.id,
        snapType: 'contact_edge',
        label: `🧱 Muro Compartido (${wallThicknessCm} cm)`
      };
    }

    // c. Proyección Colineal: Cara Oeste con Cara Oeste (Alineación de fachada izquierda)
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

    // d. Proyección Colineal: Cara Este con Cara Este (Alineación de fachada derecha)
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

    // e. Proyección Cara Interna a Cara Externa a distancia (eje vertical de muro)
    const snapInnerWestToOuterEast = targetRight + wallThicknessPx;
    const dProjInnerOuterE = Math.abs(proposedPos.x - snapInnerWestToOuterEast);
    if (dProjInnerOuterE < minDeltaX && dProjInnerOuterE <= threshold) {
      minDeltaX = dProjInnerOuterE;
      finalX = snapInnerWestToOuterEast;
      snappedX = true;
      bestXGuide = {
        id: `snap-x-proj-inner-outer-e-${target.id}`,
        orientation: 'vertical',
        position: snapInnerWestToOuterEast,
        start: yStart,
        end: yEnd,
        targetRoomId: target.id,
        snapType: 'projection_face',
        label: 'Proyección Cara Externa E'
      };
    }

    const snapInnerEastToOuterWest = targetLeft - draggedW - wallThicknessPx;
    const dProjInnerOuterW = Math.abs(proposedPos.x - snapInnerEastToOuterWest);
    if (dProjInnerOuterW < minDeltaX && dProjInnerOuterW <= threshold) {
      minDeltaX = dProjInnerOuterW;
      finalX = snapInnerEastToOuterWest;
      snappedX = true;
      bestXGuide = {
        id: `snap-x-proj-inner-outer-w-${target.id}`,
        orientation: 'vertical',
        position: targetLeft - wallThicknessPx,
        start: yStart,
        end: yEnd,
        targetRoomId: target.id,
        snapType: 'projection_face',
        label: 'Proyección Cara Externa O'
      };
    }

    // f. Proyección de Eje Central (Centros alineados en X)
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

  // 3. Atracción Geométrica General y Proyecciones en Eje Y
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

    // a. Contacto Muro Compartido: Cara Norte del arrastrado con Cara Sur del objetivo
    // Cara interna del arrastrado a cara externa del objetivo (la misma pared)
    const snapSharedSouthY = targetBottom + wallThicknessPx;
    const dContactNorthSouth = Math.abs(proposedPos.y - snapSharedSouthY);
    if (dContactNorthSouth < minDeltaY && dContactNorthSouth <= threshold) {
      minDeltaY = dContactNorthSouth;
      finalY = snapSharedSouthY;
      snappedY = true;
      bestYGuide = {
        id: `snap-y-contact-ns-${target.id}`,
        orientation: 'horizontal',
        position: targetBottom + wallThicknessPx / 2,
        start: xStart,
        end: xEnd,
        targetRoomId: target.id,
        snapType: 'contact_edge',
        label: `🧱 Muro Compartido (${wallThicknessCm} cm)`
      };
    }

    // b. Contacto Muro Compartido: Cara Sur del arrastrado con Cara Norte del objetivo
    // Cara interna del arrastrado a cara externa del objetivo (la misma pared)
    const snapSharedNorthY = targetTop - draggedH - wallThicknessPx;
    const dContactSouthNorth = Math.abs(proposedPos.y - snapSharedNorthY);
    if (dContactSouthNorth < minDeltaY && dContactSouthNorth <= threshold) {
      minDeltaY = dContactSouthNorth;
      finalY = snapSharedNorthY;
      snappedY = true;
      bestYGuide = {
        id: `snap-y-contact-sn-${target.id}`,
        orientation: 'horizontal',
        position: targetTop - wallThicknessPx / 2,
        start: xStart,
        end: xEnd,
        targetRoomId: target.id,
        snapType: 'contact_edge',
        label: `🧱 Muro Compartido (${wallThicknessCm} cm)`
      };
    }

    // c. Proyección Colineal: Cara Norte con Cara Norte (Fachada exterior norte alineada)
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

    // d. Proyección Colineal: Cara Sur con Cara Sur (Fachada exterior sur alineada)
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

    // e. Proyección Cara Interna a Cara Externa a distancia
    const snapInnerNorthToOuterSouth = targetBottom + wallThicknessPx;
    const dProjInnerOuterS = Math.abs(proposedPos.y - snapInnerNorthToOuterSouth);
    if (dProjInnerOuterS < minDeltaY && dProjInnerOuterS <= threshold) {
      minDeltaY = dProjInnerOuterS;
      finalY = snapInnerNorthToOuterSouth;
      snappedY = true;
      bestYGuide = {
        id: `snap-y-proj-inner-outer-s-${target.id}`,
        orientation: 'horizontal',
        position: snapInnerNorthToOuterSouth,
        start: xStart,
        end: xEnd,
        targetRoomId: target.id,
        snapType: 'projection_face',
        label: 'Proyección Cara Externa S'
      };
    }

    const snapInnerSouthToOuterNorth = targetTop - draggedH - wallThicknessPx;
    const dProjInnerOuterN = Math.abs(proposedPos.y - snapInnerSouthToOuterNorth);
    if (dProjInnerOuterN < minDeltaY && dProjInnerOuterN <= threshold) {
      minDeltaY = dProjInnerOuterN;
      finalY = snapInnerSouthToOuterNorth;
      snappedY = true;
      bestYGuide = {
        id: `snap-y-proj-inner-outer-n-${target.id}`,
        orientation: 'horizontal',
        position: targetTop - wallThicknessPx,
        start: xStart,
        end: xEnd,
        targetRoomId: target.id,
        snapType: 'projection_face',
        label: 'Proyección Cara Externa N'
      };
    }

    // f. Proyección de Eje Central (Centros alineados en Y)
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
