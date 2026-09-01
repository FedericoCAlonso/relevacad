/**
 * ViewModel: useSurveyViewModel (React Hook)
 * Actúa como intermediario estricto (MVVM) entre las Vistas (Material 3, Canvas, React Flow)
 * y el Store de Dominio. Centraliza la lógica de negocio, validaciones y cálculos de ambas capas.
 */

import { useMemo, useCallback } from 'react';
import { useSurveyStore } from './surveyStore';
import {
  RoomDimensions,
  RoomType,
  TipoCubierta,
  ElectricalAsset,
  WallOrientation,
  RoomGeometry,
  CornerAngleConstraints,
  ROOM_TYPE_CATALOG
} from '@/models/RoomModel';
import { LogicalConnectionType } from '@/models/GraphModel';
import {
  TramoElectrico,
  TipoNodoElectrico
} from '@/models/ElectricalGraphModel';
import { ElectricalAssetType, ELECTRICAL_ASSET_CATALOG } from '@/models/ElectricalTypes';
import { calculateMagneticSnapping } from './utils/snappingCalculator';

export function useSurveyViewModel() {
  const rooms = useSurveyStore((state) => state.rooms);
  const connections = useSurveyStore((state) => state.connections);
  const selectedRoomId = useSurveyStore((state) => state.selectedRoomId);
  const selectedConnectionId = useSurveyStore((state) => state.selectedConnectionId);
  const activePhase = useSurveyStore((state) => state.activePhase);

  const electricalNodes = useSurveyStore((state) => state.electricalNodes);
  const electricalTramos = useSurveyStore((state) => state.electricalTramos);
  const selectedElectricalNodeId = useSurveyStore((state) => state.selectedElectricalNodeId);
  const selectedTramoId = useSurveyStore((state) => state.selectedTramoId);
  const topologyLayer = useSurveyStore((state) => state.topologyLayer);

  const wallThicknessMeters = useSurveyStore((state) => state.wallThicknessMeters);
  const setWallThicknessAction = useSurveyStore((state) => state.setWallThickness);

  const isSnapEnabled = useSurveyStore((state) => state.isSnapEnabled);
  const snapThreshold = useSurveyStore((state) => state.snapThreshold);
  const activeSnapGuides = useSurveyStore((state) => state.activeSnapGuides);

  const selectRoomAction = useSurveyStore((state) => state.selectRoom);
  const selectConnectionAction = useSurveyStore((state) => state.selectConnection);
  const selectElectricalNodeAction = useSurveyStore((state) => state.selectElectricalNode);
  const selectTramoAction = useSurveyStore((state) => state.selectTramo);
  const setActivePhaseAction = useSurveyStore((state) => state.setActivePhase);
  const setTopologyLayerAction = useSurveyStore((state) => state.setTopologyLayer);

  const addRoomAction = useSurveyStore((state) => state.addRoom);
  const updateRoomAction = useSurveyStore((state) => state.updateRoom);
  const removeRoomAction = useSurveyStore((state) => state.removeRoom);
  const updateRoomTopologyPositionAction = useSurveyStore((state) => state.updateRoomTopologyPosition);

  const connectRoomsAction = useSurveyStore((state) => state.connectRooms);
  const updateConnectionAction = useSurveyStore((state) => state.updateConnection);
  const removeConnectionAction = useSurveyStore((state) => state.removeConnection);

  const addNodoElectricoAction = useSurveyStore((state) => state.addNodoElectrico);
  const updateNodoElectricoAction = useSurveyStore((state) => state.updateNodoElectrico);
  const removeNodoElectricoAction = useSurveyStore((state) => state.removeNodoElectrico);

  const connectNodosElectricosAction = useSurveyStore((state) => state.connectNodosElectricos);
  const updateTramoElectricoAction = useSurveyStore((state) => state.updateTramoElectrico);
  const removeTramoElectricoAction = useSurveyStore((state) => state.removeTramoElectrico);
  const addConductorToTramoAction = useSurveyStore((state) => state.addConductorToTramo);
  const updateConductorInTramoAction = useSurveyStore((state) => state.updateConductorInTramo);
  const removeConductorFromTramoAction = useSurveyStore((state) => state.removeConductorFromTramo);

  const addElectricalAssetAction = useSurveyStore((state) => state.addElectricalAsset);
  const updateElectricalAssetAction = useSurveyStore((state) => state.updateElectricalAsset);
  const removeElectricalAssetAction = useSurveyStore((state) => state.removeElectricalAsset);

  const addWallBreakAction = useSurveyStore((state) => state.addWallBreak);
  const updateWallBreakAction = useSurveyStore((state) => state.updateWallBreak);
  const removeWallBreakAction = useSurveyStore((state) => state.removeWallBreak);
  const toggleDimensionLockAction = useSurveyStore((state) => state.toggleDimensionLock);
  const inferDimensionAction = useSurveyStore((state) => state.inferDimension);

  const updateRoomCanvasPositionAction = useSurveyStore((state) => state.updateRoomCanvasPosition);
  const autoAssembleRoomsAction = useSurveyStore((state) => state.autoAssembleRooms);
  const setSnapGuidesAction = useSurveyStore((state) => state.setSnapGuides);
  const toggleSnapAction = useSurveyStore((state) => state.toggleSnap);
  const loadSampleDataAction = useSurveyStore((state) => state.loadSampleData);
  const resetProjectAction = useSurveyStore((state) => state.resetProject);

  // --- COMPUTED PROPERTIES (Propiedades Derivadas) ---

  const selectedRoom = useMemo(() => {
    return rooms.find((r) => r.id === selectedRoomId) || null;
  }, [rooms, selectedRoomId]);

  const selectedConnection = useMemo(() => {
    return connections.find((c) => c.id === selectedConnectionId) || null;
  }, [connections, selectedConnectionId]);

  const selectedElectricalNode = useMemo(() => {
    return electricalNodes.find((n) => n.id === selectedElectricalNodeId) || null;
  }, [electricalNodes, selectedElectricalNodeId]);

  const selectedTramo = useMemo(() => {
    return electricalTramos.find((t) => t.id === selectedTramoId) || null;
  }, [electricalTramos, selectedTramoId]);

  const entryRooms = useMemo(() => {
    return rooms.filter((r) => r.isAccessPoint);
  }, [rooms]);

  const technicalIslands = useMemo(() => {
    return rooms.filter((r) => r.isTechnicalIsland);
  }, [rooms]);

  const interiorRooms = useMemo(() => {
    return rooms.filter((r) => !r.isAccessPoint && !r.isTechnicalIsland);
  }, [rooms]);

  const getElectricalNodesForRoom = useCallback(
    (roomId: string) => {
      return electricalNodes.filter((n) => n.roomId === roomId);
    },
    [electricalNodes]
  );

  const selectedRoomAssetsByWall = useMemo(() => {
    if (!selectedRoom) return { north: [], south: [], east: [], west: [], ceiling: [] };
    const grouped: Record<WallOrientation, ElectricalAsset[]> = {
      north: [],
      south: [],
      east: [],
      west: [],
      ceiling: []
    };
    selectedRoom.electricalAssets.forEach((asset) => {
      grouped[asset.wall]?.push(asset);
    });
    return grouped;
  }, [selectedRoom]);

  const projectStats = useMemo(() => {
    const totalAreaM2 = rooms.reduce((sum, r) => {
      if (r.isTechnicalIsland || r.isAccessPoint) return sum;
      return sum + (r.dimensions.width * r.dimensions.length);
    }, 0);

    const totalAssets = rooms.reduce(
      (sum, r) => sum + r.electricalAssets.length,
      0
    );

    const circuitsSet = new Set<string>();
    electricalTramos.forEach((t) => {
      if (t.circuitoCodigo) circuitsSet.add(t.circuitoCodigo);
    });

    const totalMetrosCanalizacion = electricalTramos.reduce(
      (sum, t) => sum + t.longitudMeters,
      0
    );

    return {
      totalRooms: rooms.length,
      totalInterior: interiorRooms.length,
      totalEntries: entryRooms.length,
      totalIslands: technicalIslands.length,
      totalConnections: connections.length,
      totalElectricalNodes: electricalNodes.length,
      totalElectricalTramos: electricalTramos.length,
      totalMetrosCanalizacion: Number(totalMetrosCanalizacion.toFixed(1)),
      totalAreaM2: Number(totalAreaM2.toFixed(2)),
      totalAssets,
      circuitsCount: circuitsSet.size,
      circuitsList: Array.from(circuitsSet)
    };
  }, [rooms, connections, electricalNodes, electricalTramos, interiorRooms.length, entryRooms.length, technicalIslands.length]);

  // --- BUSINESS LOGIC & VALIDATIONS ---

  const validateRoomDimensions = useCallback(
    (dimensions: Partial<RoomDimensions>): { isValid: boolean; error?: string } => {
      if (dimensions.width !== undefined && (isNaN(dimensions.width) || dimensions.width <= 0.5)) {
        return { isValid: false, error: 'El ancho debe ser mayor a 0.50 metros.' };
      }
      if (dimensions.length !== undefined && (isNaN(dimensions.length) || dimensions.length <= 0.5)) {
        return { isValid: false, error: 'El largo debe ser mayor a 0.50 metros.' };
      }
      if (dimensions.height !== undefined && (isNaN(dimensions.height) || dimensions.height < 0)) {
        return { isValid: false, error: 'La altura debe ser positiva.' };
      }
      return { isValid: true };
    },
    []
  );

  const calculateWallOffset = useCallback(
    (wall: WallOrientation, offsetMeters: number, dimensions: RoomDimensions) => {
      let maxWallLength = dimensions.width;
      if (wall === 'east' || wall === 'west') {
        maxWallLength = dimensions.length;
      }

      const clampedMeters = Math.max(0, Math.min(offsetMeters, maxWallLength));
      const ratio = maxWallLength > 0 ? clampedMeters / maxWallLength : 0.5;

      return {
        clampedMeters: Number(clampedMeters.toFixed(2)),
        ratio: Number(ratio.toFixed(3)),
        maxWallLength
      };
    },
    []
  );

  // --- ACTIONS WITH BUSINESS RULES (Dispatchers MVVM) ---

  const createRoom = useCallback(
    (
      name: string,
      type: RoomType,
      customDims?: Partial<RoomDimensions>,
      isAccess?: boolean,
      isTechnical?: boolean,
      tipoCubierta?: TipoCubierta
    ) => {
      const preset = ROOM_TYPE_CATALOG[type] || ROOM_TYPE_CATALOG.other;
      const initialDims: RoomDimensions = {
        width: customDims?.width || preset.defaultWidth,
        length: customDims?.length || preset.defaultLength,
        height: customDims?.height || preset.defaultHeight
      };

      const isAccessPoint = isAccess !== undefined ? isAccess : preset.isAccess;
      const isTechnicalIsland = isTechnical !== undefined ? isTechnical : preset.isTechnical;

      return addRoomAction({
        name: name.trim() || preset.label,
        type,
        tipoCubierta: tipoCubierta || preset.defaultCubierta || 'cubierto',
        isAccessPoint,
        isTechnicalIsland,
        isCommonArea: isAccessPoint || isTechnicalIsland,
        dimensions: initialDims,
        color: preset.color
      });
    },
    [addRoomAction]
  );

  const updateDimensions = useCallback(
    (roomId: string, dimensions: Partial<RoomDimensions>): boolean => {
      const validation = validateRoomDimensions(dimensions);
      if (!validation.isValid) return false;

      const room = rooms.find((r) => r.id === roomId);
      if (!room) return false;

      const newDimensions: RoomDimensions = {
        ...room.dimensions,
        ...dimensions
      };

      const updatedAssets = room.electricalAssets.map((asset) => {
        const { clampedMeters, ratio } = calculateWallOffset(
          asset.wall,
          asset.offsetMeters,
          newDimensions
        );
        return {
          ...asset,
          offsetMeters: clampedMeters,
          offsetRatio: ratio
        };
      });

      updateRoomAction(roomId, {
        dimensions: newDimensions,
        electricalAssets: updatedAssets
      });

      return true;
    },
    [rooms, validateRoomDimensions, calculateWallOffset, updateRoomAction]
  );

  const updateRoomGeometry = useCallback(
    (roomId: string, geometryUpdates: Partial<RoomGeometry>) => {
      const room = rooms.find((r) => r.id === roomId);
      if (!room) return;

      const currentGeom: RoomGeometry = room.geometry || {
        mode: 'rectangle',
        independentWalls: {
          north: room.dimensions.width,
          south: room.dimensions.width,
          east: room.dimensions.length,
          west: room.dimensions.length
        }
      };

      const newGeometry: RoomGeometry = {
        ...currentGeom,
        ...geometryUpdates
      };

      // Si se actualizan paredes independientes, mantener actualizado el ancho y largo promedio
      if (newGeometry.independentWalls) {
        const avgWidth = Number(((newGeometry.independentWalls.north + newGeometry.independentWalls.south) / 2).toFixed(2));
        const avgLength = Number(((newGeometry.independentWalls.east + newGeometry.independentWalls.west) / 2).toFixed(2));
        updateRoomAction(roomId, {
          dimensions: {
            ...room.dimensions,
            width: avgWidth || room.dimensions.width,
            length: avgLength || room.dimensions.length
          },
          geometry: newGeometry
        });
      } else {
        updateRoomAction(roomId, { geometry: newGeometry });
      }
    },
    [rooms, updateRoomAction]
  );

  const updateIndependentWall = useCallback(
    (roomId: string, wall: 'north' | 'south' | 'east' | 'west', lengthMeters: number) => {
      const room = rooms.find((r) => r.id === roomId);
      if (!room || lengthMeters <= 0) return;

      const currentGeom = room.geometry || {
        mode: 'independent_walls' as const,
        independentWalls: {
          north: room.dimensions.width,
          south: room.dimensions.width,
          east: room.dimensions.length,
          west: room.dimensions.length
        }
      };

      const newWalls = {
        north: currentGeom.independentWalls?.north ?? room.dimensions.width,
        south: currentGeom.independentWalls?.south ?? room.dimensions.width,
        east: currentGeom.independentWalls?.east ?? room.dimensions.length,
        west: currentGeom.independentWalls?.west ?? room.dimensions.length,
        [wall]: lengthMeters
      };

      updateRoomGeometry(roomId, {
        mode: 'independent_walls',
        independentWalls: newWalls
      });
    },
    [rooms, updateRoomGeometry]
  );

  const setDiagonalConstraint = useCallback(
    (roomId: string, diagonalMeters: number) => {
      updateRoomGeometry(roomId, {
        mode: 'diagonal_triangulated',
        diagonalSO_NE: diagonalMeters
      });
    },
    [updateRoomGeometry]
  );

  const toggleCornerLock = useCallback(
    (roomId: string, corner: keyof CornerAngleConstraints) => {
      const room = rooms.find((r) => r.id === roomId);
      if (!room) return;

      const currentLocks = room.geometry?.cornerConstraints || {};
      const newLocks = {
        ...currentLocks,
        [corner]: !currentLocks[corner]
      };

      updateRoomGeometry(roomId, {
        cornerConstraints: newLocks
      });
    },
    [rooms, updateRoomGeometry]
  );

  const connectRooms = useCallback(
    (
      sourceId: string,
      targetId: string,
      type: LogicalConnectionType = 'puerta_estandar',
      label?: string,
      sourceHandle?: string,
      targetHandle?: string
    ) => {
      if (!sourceId || !targetId || sourceId === targetId) return null;
      return connectRoomsAction(sourceId, targetId, type, label, sourceHandle, targetHandle);
    },
    [connectRoomsAction]
  );

  const registerElectricalNode = useCallback(
    (roomId: string, tipo: TipoNodoElectrico, etiqueta: string, circuitoCodigo?: string) => {
      return addNodoElectricoAction({
        roomId,
        tipo,
        etiqueta: etiqueta.trim(),
        circuitoCodigo: circuitoCodigo?.trim()
      });
    },
    [addNodoElectricoAction]
  );

  const connectElectricalNodes = useCallback(
    (sourceNodeId: string, targetNodeId: string, tramoData?: Partial<TramoElectrico>) => {
      return connectNodosElectricosAction(sourceNodeId, targetNodeId, tramoData);
    },
    [connectNodosElectricosAction]
  );

  const registerElectricalAsset = useCallback(
    (
      roomId: string,
      data: {
        type: ElectricalAssetType;
        label?: string;
        wall: WallOrientation;
        offsetMeters: number;
        heightFromFloor?: number;
        circuitCode?: string;
        notes?: string;
      }
    ) => {
      const room = rooms.find((r) => r.id === roomId);
      if (!room) return null;

      const meta = ELECTRICAL_ASSET_CATALOG[data.type];
      const { clampedMeters, ratio } = calculateWallOffset(
        data.wall,
        data.offsetMeters,
        room.dimensions
      );

      const height =
        data.heightFromFloor !== undefined
          ? Math.max(0, Math.min(data.heightFromFloor, room.dimensions.height || 3))
          : meta.defaultHeight;

      return addElectricalAssetAction(roomId, {
        type: data.type,
        label: data.label?.trim() || meta.label,
        wall: data.wall,
        offsetMeters: clampedMeters,
        offsetRatio: ratio,
        heightFromFloor: Number(height.toFixed(2)),
        circuitCode: data.circuitCode?.trim(),
        notes: data.notes?.trim()
      });
    },
    [rooms, calculateWallOffset, addElectricalAssetAction]
  );

  const handleRoomDrag = useCallback(
    (draggedRoomId: string, rawPosition: { x: number; y: number }): { x: number; y: number } => {
      if (!isSnapEnabled) {
        setSnapGuidesAction([]);
        return rawPosition;
      }

      const snapResult = calculateMagneticSnapping(
        draggedRoomId,
        rawPosition,
        rooms,
        connections,
        snapThreshold
      );

      setSnapGuidesAction(snapResult.guidelines);
      return { x: snapResult.x, y: snapResult.y };
    },
    [isSnapEnabled, rooms, connections, snapThreshold, setSnapGuidesAction]
  );

  const handleRoomDragEnd = useCallback(
    (draggedRoomId: string, finalPosition: { x: number; y: number }) => {
      setSnapGuidesAction([]);
      updateRoomCanvasPositionAction(draggedRoomId, finalPosition);
    },
    [setSnapGuidesAction, updateRoomCanvasPositionAction]
  );

  return {
    // Estado
    rooms,
    interiorRooms,
    entryRooms,
    technicalIslands,
    connections,
    selectedRoomId,
    selectedRoom,
    selectedConnectionId,
    selectedConnection,

    // Capa Eléctrica
    electricalNodes,
    electricalTramos,
    selectedElectricalNodeId,
    selectedElectricalNode,
    selectedTramoId,
    selectedTramo,
    topologyLayer,

    selectedRoomAssetsByWall,
    activePhase,
    isSnapEnabled,
    snapThreshold,
    activeSnapGuides,
    projectStats,

    // Acciones de Selección, Fases y Capas
    selectRoom: selectRoomAction,
    selectConnection: selectConnectionAction,
    selectElectricalNode: selectElectricalNodeAction,
    selectTramo: selectTramoAction,
    setActivePhase: setActivePhaseAction,
    setTopologyLayer: setTopologyLayerAction,
    toggleSnap: toggleSnapAction,

    // Operaciones sobre Ambientes, Ingresos e Islas
    createRoom,
    updateRoomDimensions: updateDimensions,
    updateRoomGeometry,
    updateIndependentWall,
    setDiagonalConstraint,
    toggleCornerLock,
    toggleDimensionLock: toggleDimensionLockAction,
    inferDimension: inferDimensionAction,
    addWallBreak: addWallBreakAction,
    updateWallBreak: updateWallBreakAction,
    removeWallBreak: removeWallBreakAction,
    renameRoom: (roomId: string, name: string) => updateRoomAction(roomId, { name: name.trim() }),
    updateRoomCubierta: (roomId: string, tipoCubierta: TipoCubierta) =>
      updateRoomAction(roomId, { tipoCubierta }),
    updateRoom: updateRoomAction,
    deleteRoom: removeRoomAction,
    updateRoomTopologyPosition: updateRoomTopologyPositionAction,

    // Conexiones Arquitectónicas (Aberturas)
    connectRooms,
    updateConnection: updateConnectionAction,
    deleteConnection: removeConnectionAction,

    // Grafo Eléctrico (Nodos y Tramos)
    getElectricalNodesForRoom,
    registerElectricalNode,
    updateNodoElectrico: updateNodoElectricoAction,
    deleteNodoElectrico: removeNodoElectricoAction,
    connectElectricalNodes,
    updateTramoElectrico: updateTramoElectricoAction,
    deleteTramoElectrico: removeTramoElectricoAction,
    addConductorToTramo: addConductorToTramoAction,
    updateConductorInTramo: updateConductorInTramoAction,
    removeConductorFromTramo: removeConductorFromTramoAction,

    // Elementos Eléctricos Paramétricos (Paredes)
    registerElectricalAsset,
    updateElectricalAsset: updateElectricalAssetAction,
    deleteElectricalAsset: removeElectricalAssetAction,

    // Ensamblaje 2D
    autoAssembleRooms: autoAssembleRoomsAction,
    handleRoomDrag,
    handleRoomDragEnd,

    // Espesor de Muros
    wallThicknessMeters,
    setWallThickness: setWallThicknessAction,

    // Proyecto
    loadSampleData: loadSampleDataAction,
    resetProject: resetProjectAction
  };
}
