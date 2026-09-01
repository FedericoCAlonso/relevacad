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

  const guidelines: SnapGuideLine[] = [];

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
        guidelines.push({
          id: `snap-topo-west-east-${target.id}`,
          orientation: 'vertical',
          position: targetRight,
          start: Math.min(proposedPos.y, targetTop) - 20,
          end: Math.max(proposedPos.y + draggedH, targetBottom) + 20,
          targetRoomId: target.id,
          isTopologicalAdjacency: true
        });
      }
    } else if (myWall === 'east' && targetWall === 'west') {
      const d = Math.abs(proposedPos.x + draggedW - targetLeft);
      if (d <= topoThreshold && d < minDeltaX) {
        minDeltaX = d;
        finalX = targetLeft - draggedW;
        snappedX = true;
        guidelines.push({
          id: `snap-topo-east-west-${target.id}`,
          orientation: 'vertical',
          position: targetLeft,
          start: Math.min(proposedPos.y, targetTop) - 20,
          end: Math.max(proposedPos.y + draggedH, targetBottom) + 20,
          targetRoomId: target.id,
          isTopologicalAdjacency: true
        });
      }
    }

    // Encastre Vertical (Norte-Sur)
    if (myWall === 'north' && targetWall === 'south') {
      const d = Math.abs(proposedPos.y - targetBottom);
      if (d <= topoThreshold && d < minDeltaY) {
        minDeltaY = d;
        finalY = targetBottom;
        snappedY = true;
        guidelines.push({
          id: `snap-topo-north-south-${target.id}`,
          orientation: 'horizontal',
          position: targetBottom,
          start: Math.min(proposedPos.x, targetLeft) - 20,
          end: Math.max(proposedPos.x + draggedW, targetRight) + 20,
          targetRoomId: target.id,
          isTopologicalAdjacency: true
        });
      }
    } else if (myWall === 'south' && targetWall === 'north') {
      const d = Math.abs(proposedPos.y + draggedH - targetTop);
      if (d <= topoThreshold && d < minDeltaY) {
        minDeltaY = d;
        finalY = targetTop - draggedH;
        snappedY = true;
        guidelines.push({
          id: `snap-topo-south-north-${target.id}`,
          orientation: 'horizontal',
          position: targetTop,
          start: Math.min(proposedPos.x, targetLeft) - 20,
          end: Math.max(proposedPos.x + draggedW, targetRight) + 20,
          targetRoomId: target.id,
          isTopologicalAdjacency: true
        });
      }
    }
  }

  // 2. Atracción Geométrica General en eje X
  for (const target of otherRooms) {
    const targetIsNonMetric = target.isAccessPoint || target.isTechnicalIsland;
    const targetW = targetIsNonMetric ? 180 : metersToPixels(target.dimensions?.width || 3.0);
    const targetH = targetIsNonMetric ? 100 : metersToPixels(target.dimensions?.length || 2.0);

    const targetLeft = target.canvasPosition.x;
    const targetRight = target.canvasPosition.x + targetW;

    // 1. Arista Izquierda del arrastrado con Arista Derecha del objetivo
    const d1 = Math.abs(proposedPos.x - targetRight);
    if (d1 < minDeltaX && d1 <= threshold) {
      minDeltaX = d1;
      finalX = targetRight;
      snappedX = true;
      guidelines.push({
        id: `snap-x-left-to-right-${target.id}`,
        orientation: 'vertical',
        position: targetRight,
        start: Math.min(proposedPos.y, target.canvasPosition.y) - 20,
        end: Math.max(proposedPos.y + draggedH, target.canvasPosition.y + targetH) + 20,
        targetRoomId: target.id
      });
    }

    // 2. Arista Derecha del arrastrado con Arista Izquierda del objetivo
    const d2 = Math.abs(proposedPos.x + draggedW - targetLeft);
    if (d2 < minDeltaX && d2 <= threshold) {
      minDeltaX = d2;
      finalX = targetLeft - draggedW;
      snappedX = true;
      guidelines.push({
        id: `snap-x-right-to-left-${target.id}`,
        orientation: 'vertical',
        position: targetLeft,
        start: Math.min(proposedPos.y, target.canvasPosition.y) - 20,
        end: Math.max(proposedPos.y + draggedH, target.canvasPosition.y + targetH) + 20,
        targetRoomId: target.id
      });
    }

    // 3. Alineación Izquierda-Izquierda
    const d3 = Math.abs(proposedPos.x - targetLeft);
    if (d3 < minDeltaX && d3 <= threshold) {
      minDeltaX = d3;
      finalX = targetLeft;
      snappedX = true;
      guidelines.push({
        id: `snap-x-align-left-${target.id}`,
        orientation: 'vertical',
        position: targetLeft,
        start: Math.min(proposedPos.y, target.canvasPosition.y) - 20,
        end: Math.max(proposedPos.y + draggedH, target.canvasPosition.y + targetH) + 20,
        targetRoomId: target.id
      });
    }
  }

  // 3. Atracción Geométrica General en eje Y
  for (const target of otherRooms) {
    const targetIsNonMetric = target.isAccessPoint || target.isTechnicalIsland;
    const targetW = targetIsNonMetric ? 180 : metersToPixels(target.dimensions?.width || 3.0);
    const targetH = targetIsNonMetric ? 100 : metersToPixels(target.dimensions?.length || 2.0);

    const targetTop = target.canvasPosition.y;
    const targetBottom = target.canvasPosition.y + targetH;

    // 1. Arista Superior del arrastrado con Arista Inferior del objetivo
    const d1 = Math.abs(proposedPos.y - targetBottom);
    if (d1 < minDeltaY && d1 <= threshold) {
      minDeltaY = d1;
      finalY = targetBottom;
      snappedY = true;
      guidelines.push({
        id: `snap-y-top-to-bottom-${target.id}`,
        orientation: 'horizontal',
        position: targetBottom,
        start: Math.min(proposedPos.x, target.canvasPosition.x) - 20,
        end: Math.max(proposedPos.x + draggedW, target.canvasPosition.x + targetW) + 20,
        targetRoomId: target.id
      });
    }

    // 2. Arista Inferior del arrastrado con Arista Superior del objetivo
    const d2 = Math.abs(proposedPos.y + draggedH - targetTop);
    if (d2 < minDeltaY && d2 <= threshold) {
      minDeltaY = d2;
      finalY = targetTop - draggedH;
      snappedY = true;
      guidelines.push({
        id: `snap-y-bottom-to-top-${target.id}`,
        orientation: 'horizontal',
        position: targetTop,
        start: Math.min(proposedPos.x, target.canvasPosition.x) - 20,
        end: Math.max(proposedPos.x + draggedW, target.canvasPosition.x + targetW) + 20,
        targetRoomId: target.id
      });
    }

    // 3. Alineación Superior-Superior
    const d3 = Math.abs(proposedPos.y - targetTop);
    if (d3 < minDeltaY && d3 <= threshold) {
      minDeltaY = d3;
      finalY = targetTop;
      snappedY = true;
      guidelines.push({
        id: `snap-y-align-top-${target.id}`,
        orientation: 'horizontal',
        position: targetTop,
        start: Math.min(proposedPos.x, target.canvasPosition.x) - 20,
        end: Math.max(proposedPos.x + draggedW, target.canvasPosition.x + targetW) + 20,
        targetRoomId: target.id
      });
    }
  }

  return {
    x: finalX,
    y: finalY,
    snappedX,
    snappedY,
    guidelines
  };
}
