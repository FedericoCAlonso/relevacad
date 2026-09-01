/**
 * Utility: Electrical Subtree Traversal Solver
 * Resuelve la rama o árbol eléctrico completo para cualquier nodo seleccionado:
 * - Si se selecciona una Boca o Caja (ej: B3):
 *   1. Rastrea aguas arriba (Upstream) hasta encontrar el Tablero Alimentador (TSG/TP).
 *   2. Desde dicho Tablero, recorre aguas abajo (Downstream) toda la rama completa del circuito
 *      (ej: TSG ➔ B1 ➔ B2, B3 ➔ B4 y todas sus subramas).
 * - Si se selecciona un Tablero (TSG, TP, Medidor):
 *   Ilumina su alimentador aguas arriba y la totalidad de circuitos y bocas aguas abajo.
 */

import { NodoElectrico, TramoElectrico } from '@/models/ElectricalGraphModel';

export interface ElectricalSubtreeResult {
  rootNodeId: string;
  feedingBoardId: string | null;
  subTreeNodeIds: Set<string>;
  subTreeTramoIds: Set<string>;
  subTreeRoomIds: Set<string>;
  circuitCodes: Set<string>;
  rootNodeLabel: string;
}

const BOARD_TYPES = new Set([
  'tablero_seccional',
  'tablero_principal',
  'medidor_kwh',
  'acometida_red'
]);

export function computeElectricalSubtree(
  selectedNodeId: string | null,
  electricalNodes: NodoElectrico[],
  electricalTramos: TramoElectrico[]
): ElectricalSubtreeResult | null {
  if (!selectedNodeId) return null;

  const startNode = electricalNodes.find((n) => n.id === selectedNodeId);
  if (!startNode) return null;

  const subTreeNodeIds = new Set<string>([selectedNodeId]);
  const subTreeTramoIds = new Set<string>();
  const subTreeRoomIds = new Set<string>();
  const circuitCodes = new Set<string>();

  if (startNode.roomId) subTreeRoomIds.add(startNode.roomId);
  if (startNode.circuitoCodigo) circuitCodes.add(startNode.circuitoCodigo);

  // =========================================================================
  // PASO 1: RASTREO AGUAS ARRIBA (UPSTREAM) PARA ENCONTRAR EL TABLERO ALIMENTADOR
  // =========================================================================
  let feedingBoardNode: NodoElectrico | null = BOARD_TYPES.has(startNode.tipo) ? startNode : null;
  const upstreamTramos: TramoElectrico[] = [];
  const upstreamNodes: NodoElectrico[] = [startNode];

  if (!feedingBoardNode) {
    const upstreamQueue: string[] = [selectedNodeId];
    const visitedUpstream = new Set<string>([selectedNodeId]);

    while (upstreamQueue.length > 0) {
      const currentId = upstreamQueue.shift()!;
      const currentNode = electricalNodes.find((n) => n.id === currentId);

      if (currentNode && BOARD_TYPES.has(currentNode.tipo)) {
        feedingBoardNode = currentNode;
        break; // Encontramos el tablero alimentador principal de este circuito
      }

      // Buscar cañería entrante a este nodo
      const incomingTramos = electricalTramos.filter((t) => t.targetNodeId === currentId);
      incomingTramos.forEach((tramo) => {
        upstreamTramos.push(tramo);
        if (!visitedUpstream.has(tramo.sourceNodeId)) {
          visitedUpstream.add(tramo.sourceNodeId);
          upstreamQueue.push(tramo.sourceNodeId);
          const srcNode = electricalNodes.find((n) => n.id === tramo.sourceNodeId);
          if (srcNode) upstreamNodes.push(srcNode);
        }
      });
    }
  }

  // Agregar los nodos y tramos del camino aguas arriba
  upstreamNodes.forEach((n) => {
    subTreeNodeIds.add(n.id);
    if (n.roomId) subTreeRoomIds.add(n.roomId);
    if (n.circuitoCodigo) circuitCodes.add(n.circuitoCodigo);
  });
  upstreamTramos.forEach((t) => {
    subTreeTramoIds.add(t.id);
    if (t.conductores && t.conductores.length > 0) {
      t.conductores.forEach((c) => circuitCodes.add(c.circuitoCodigo));
    } else if (t.circuitoCodigo) {
      circuitCodes.add(t.circuitoCodigo);
    }
  });

  // =========================================================================
  // PASO 2: RASTREO AGUAS ABAJO (DOWNSTREAM) DESDE EL TABLERO O NODO RAÍZ
  // =========================================================================
  // El punto de partida para iluminar la rama completa es el Tablero Alimentador (o el nodo seleccionado si es raíz)
  const downstreamRootId = feedingBoardNode ? feedingBoardNode.id : selectedNodeId;
  const downstreamQueue: string[] = [downstreamRootId];
  const visitedDownstream = new Set<string>([downstreamRootId]);

  // Si partimos de una boca específica de un circuito (ej: C1-IUG),
  // filtramos el árbol aguas abajo por los circuitos asociados a esa rama
  const filterCircuits = !BOARD_TYPES.has(startNode.tipo) && circuitCodes.size > 0 ? circuitCodes : null;

  while (downstreamQueue.length > 0) {
    const currentId = downstreamQueue.shift()!;

    // Buscar todas las cañerías salientes desde este nodo
    const outgoingTramos = electricalTramos.filter((t) => t.sourceNodeId === currentId);

    outgoingTramos.forEach((tramo) => {
      // Verificar si la cañería pertenece al circuito de la rama
      const tramoCircuits = tramo.conductores?.map((c) => c.circuitoCodigo) || [tramo.circuitoCodigo || ''];
      const matchesBranch =
        !filterCircuits ||
        tramoCircuits.some((c) => filterCircuits.has(c)) ||
        tramo.circuitoCodigo?.includes('ALIM');

      if (matchesBranch) {
        subTreeTramoIds.add(tramo.id);
        if (tramo.conductores && tramo.conductores.length > 0) {
          tramo.conductores.forEach((c) => circuitCodes.add(c.circuitoCodigo));
        } else if (tramo.circuitoCodigo) {
          circuitCodes.add(tramo.circuitoCodigo);
        }

        if (!visitedDownstream.has(tramo.targetNodeId)) {
          visitedDownstream.add(tramo.targetNodeId);
          subTreeNodeIds.add(tramo.targetNodeId);
          downstreamQueue.push(tramo.targetNodeId);

          const targetNode = electricalNodes.find((n) => n.id === tramo.targetNodeId);
          if (targetNode?.roomId) subTreeRoomIds.add(targetNode.roomId);
          if (targetNode?.circuitoCodigo) circuitCodes.add(targetNode.circuitoCodigo);
        }
      }
    });
  }

  // =========================================================================
  // PASO 3: SI EL NODO ES UN TABLERO (TSG), ILUMINAR TAMBIÉN SU ACOMETIDA
  // =========================================================================
  if (startNode.tipo === 'tablero_seccional') {
    electricalTramos.forEach((tramo) => {
      if (tramo.targetNodeId === startNode.id) {
        subTreeTramoIds.add(tramo.id);
        subTreeNodeIds.add(tramo.sourceNodeId);
        const src = electricalNodes.find((n) => n.id === tramo.sourceNodeId);
        if (src?.roomId) subTreeRoomIds.add(src.roomId);
      }
    });
  }

  return {
    rootNodeId: selectedNodeId,
    feedingBoardId: feedingBoardNode?.id || null,
    subTreeNodeIds,
    subTreeTramoIds,
    subTreeRoomIds,
    circuitCodes,
    rootNodeLabel: feedingBoardNode && feedingBoardNode.id !== startNode.id
      ? `${feedingBoardNode.etiqueta} ➔ ${startNode.etiqueta}`
      : startNode.etiqueta
  };
}
