/**
 * View: RoomNodeComponent (React Flow Container Node)
 * Nodo contenedor arquitectónico con 4 puntos de anclaje orientados a las 4 paredes (N, S, E, O)
 * y sub-nodos eléctricos con sus respectivos terminales de conexión.
 * Soporta iluminación dinámica de sub-árboles y Modo Conexión en Cadena (Click-to-Connect).
 */

import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Stack,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ElectricBolt as BoltIcon,
  SquareFoot as DimIcon,
  DoorSliding as EntryIcon,
  LocationCity as BuildingIcon,
  Garage as GarageIcon,
  Deck as GardenIcon,
  Key as KeyIcon,
  ElectricMeter as IslandIcon,
  Add as AddIcon,
  AutoAwesome as SparkleIcon,
  Link as LinkIcon
} from '@mui/icons-material';
import { ROOM_TYPE_CATALOG } from '@/models/RoomModel';
import {
  NodoElectrico,
  TIPO_NODO_ELECTRICO_CATALOG
} from '@/models/ElectricalGraphModel';

export interface RoomNodeData {
  roomId: string;
  name: string;
  roomType: string;
  isAccessPoint?: boolean;
  isTechnicalIsland?: boolean;
  isCommonArea?: boolean;
  dimensions: {
    width: number;
    length: number;
    height: number;
  };
  assetCount: number;
  color?: string;
  isSelected?: boolean;
  topologyLayer: 'architectural' | 'electrical' | 'unified';
  electricalNodes: NodoElectrico[];
  selectedElectricalNodeId?: string | null;
  highlightedSubTreeNodeIds?: string[];
  highlightedSubTreeRoomIds?: string[];
  isAnySubTreeActive?: boolean;

  // ⚡ Modo Conexión en Cadena (Click-to-Connect)
  isChainModeActive?: boolean;
  chainLastNodeId?: string | null;
  chainNodesCount?: number;

  onAddElectricalNode?: (roomId: string) => void;
  onSelectElectricalNode?: (nodeId: string | null) => void;
  onNodeClickInChain?: (nodeId: string) => void;
}

export const RoomNodeComponent = memo(({ data }: NodeProps) => {
  const nodeData = data as unknown as RoomNodeData;
  const roomTypeMeta =
    ROOM_TYPE_CATALOG[nodeData.roomType as keyof typeof ROOM_TYPE_CATALOG] ||
    ROOM_TYPE_CATALOG.other;

  const isAccess = nodeData.isAccessPoint || roomTypeMeta.isAccess;
  const isTechnical = nodeData.isTechnicalIsland || roomTypeMeta.isTechnical;
  const isNonMetric = isAccess || isTechnical || nodeData.isCommonArea;
  const isElectricalMode = nodeData.topologyLayer === 'electrical' || nodeData.topologyLayer === 'unified';
  const showOpenings = nodeData.topologyLayer === 'architectural' || nodeData.topologyLayer === 'unified';

  const handleColor = isAccess ? '#059669' : '#00629e';

  // Verificación de estado de Subárbol Iluminado
  const isRoomInActiveSubtree =
    !nodeData.isAnySubTreeActive ||
    (nodeData.highlightedSubTreeRoomIds && nodeData.highlightedSubTreeRoomIds.includes(nodeData.roomId));

  const getHeaderIcon = () => {
    if (isTechnical) return <IslandIcon fontSize="small" sx={{ color: '#d97706' }} />;
    if (nodeData.roomType === 'access_street') return <EntryIcon fontSize="small" sx={{ color: '#059669' }} />;
    if (nodeData.roomType === 'access_palier') return <BuildingIcon fontSize="small" sx={{ color: '#059669' }} />;
    if (nodeData.roomType === 'access_garage') return <GarageIcon fontSize="small" sx={{ color: '#059669' }} />;
    if (nodeData.roomType === 'access_patio') return <GardenIcon fontSize="small" sx={{ color: '#059669' }} />;
    if (nodeData.roomType === 'access_service') return <KeyIcon fontSize="small" sx={{ color: '#059669' }} />;
    return <BoltIcon fontSize="small" sx={{ color: '#00629e' }} />;
  };

  const getBadgeLabel = () => {
    if (isTechnical) return '⚡ ISLA TÉCNICA';
    if (isAccess) return '🟢 INGRESO';
    return roomTypeMeta.label;
  };

  return (
    <Box
      sx={{
        position: 'relative',
        minWidth: 250,
        maxWidth: 310,
        cursor: nodeData.isChainModeActive ? 'pointer' : 'grab',
        opacity: isRoomInActiveSubtree ? 1 : 0.22,
        filter: isRoomInActiveSubtree ? 'none' : 'grayscale(0.7)',
        transition: 'opacity 0.25s ease, filter 0.25s ease'
      }}
    >
      {/* 🧭 HANDLES DE ABERTURAS ORIENTADOS A LAS 4 PAREDES (N, S, E, O) */}
      {showOpenings && !isTechnical && (
        <>
          {/* PARED NORTE (Top) */}
          <Handle
            type="target"
            position={Position.Top}
            id="target-north"
            style={{
              background: handleColor,
              width: 14,
              height: 14,
              border: '2px solid #ffffff',
              zIndex: 10,
              top: -7
            }}
          />
          <Handle
            type="source"
            position={Position.Top}
            id="source-north"
            style={{
              background: handleColor,
              width: 14,
              height: 14,
              border: '2px solid #ffffff',
              zIndex: 10,
              top: -7
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              top: -18,
              left: '50%',
              transform: 'translateX(-50%)',
              bgcolor: handleColor,
              color: '#ffffff',
              fontSize: '0.62rem',
              fontWeight: 800,
              px: 0.5,
              borderRadius: 1,
              lineHeight: 1.2,
              pointerEvents: 'none',
              zIndex: 5
            }}
          >
            N
          </Box>

          {/* PARED SUR (Bottom) */}
          <Handle
            type="target"
            position={Position.Bottom}
            id="target-south"
            style={{
              background: handleColor,
              width: 14,
              height: 14,
              border: '2px solid #ffffff',
              zIndex: 10,
              bottom: -7
            }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="source-south"
            style={{
              background: handleColor,
              width: 14,
              height: 14,
              border: '2px solid #ffffff',
              zIndex: 10,
              bottom: -7
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              bottom: -18,
              left: '50%',
              transform: 'translateX(-50%)',
              bgcolor: handleColor,
              color: '#ffffff',
              fontSize: '0.62rem',
              fontWeight: 800,
              px: 0.5,
              borderRadius: 1,
              lineHeight: 1.2,
              pointerEvents: 'none',
              zIndex: 5
            }}
          >
            S
          </Box>

          {/* PARED OESTE (Left) */}
          <Handle
            type="target"
            position={Position.Left}
            id="target-west"
            style={{
              background: handleColor,
              width: 14,
              height: 14,
              border: '2px solid #ffffff',
              zIndex: 10,
              left: -7
            }}
          />
          <Handle
            type="source"
            position={Position.Left}
            id="source-west"
            style={{
              background: handleColor,
              width: 14,
              height: 14,
              border: '2px solid #ffffff',
              zIndex: 10,
              left: -7
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: -20,
              transform: 'translateY(-50%)',
              bgcolor: handleColor,
              color: '#ffffff',
              fontSize: '0.62rem',
              fontWeight: 800,
              px: 0.5,
              borderRadius: 1,
              lineHeight: 1.2,
              pointerEvents: 'none',
              zIndex: 5
            }}
          >
            O
          </Box>

          {/* PARED ESTE (Right) */}
          <Handle
            type="target"
            position={Position.Right}
            id="target-east"
            style={{
              background: handleColor,
              width: 14,
              height: 14,
              border: '2px solid #ffffff',
              zIndex: 10,
              right: -7
            }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="source-east"
            style={{
              background: handleColor,
              width: 14,
              height: 14,
              border: '2px solid #ffffff',
              zIndex: 10,
              right: -7
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              right: -18,
              transform: 'translateY(-50%)',
              bgcolor: handleColor,
              color: '#ffffff',
              fontSize: '0.62rem',
              fontWeight: 800,
              px: 0.5,
              borderRadius: 1,
              lineHeight: 1.2,
              pointerEvents: 'none',
              zIndex: 5
            }}
          >
            E
          </Box>
        </>
      )}

      {/* Tarjeta Contenedora del Espacio */}
      <Card
        elevation={nodeData.isSelected ? 4 : 1}
        sx={{
          borderRadius: 3.5,
          border: nodeData.isSelected
            ? `2.5px solid ${isTechnical ? '#d97706' : isAccess ? '#059669' : '#00629e'}`
            : isTechnical
            ? '1.5px dashed #d97706'
            : isAccess
            ? '1.5px dashed #10b981'
            : '1px solid #d0d7de',
          bgcolor: isTechnical ? '#fffbeb' : isAccess ? '#f0fdf4' : '#ffffff',
          overflow: 'visible',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: nodeData.isAnySubTreeActive && isRoomInActiveSubtree
            ? '0 0 16px rgba(37, 99, 235, 0.18)'
            : undefined,
          '&:hover': {
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
          }
        }}
      >
        <CardContent sx={{ p: 1.8, '&:last-child': { pb: 1.8 } }}>
          {/* Header del Espacio */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.8}>
            <Stack direction="row" spacing={0.8} alignItems="center">
              {getHeaderIcon()}
              <Chip
                label={getBadgeLabel()}
                size="small"
                variant="filled"
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  bgcolor: isTechnical ? '#fef3c7' : isAccess ? '#d1fae5' : '#e0f2fe',
                  color: isTechnical ? '#b45309' : isAccess ? '#065f46' : '#0369a1'
                }}
              />
            </Stack>

            {!isNonMetric ? (
              <Chip
                icon={<DimIcon sx={{ fontSize: '11px !important' }} />}
                label={`${(nodeData.dimensions.width * nodeData.dimensions.length).toFixed(1)}m²`}
                size="small"
                variant="outlined"
                sx={{ height: 18, fontSize: '0.62rem', fontWeight: 600 }}
              />
            ) : (
              <Chip
                label={isTechnical ? 'Subsuelo/PB' : 'Común'}
                size="small"
                variant="outlined"
                sx={{
                  height: 18,
                  fontSize: '0.62rem',
                  fontWeight: 600,
                  borderColor: isTechnical ? '#f59e0b' : '#10b981',
                  color: isTechnical ? '#b45309' : '#047857'
                }}
              />
            )}
          </Stack>

          {/* Nombre del Espacio */}
          <Typography
            variant="subtitle2"
            fontWeight={700}
            color={isTechnical ? '#92400e' : isAccess ? '#065f46' : 'text.primary'}
            noWrap
            gutterBottom
          >
            {nodeData.name}
          </Typography>

          {/* Sub-Nodos Eléctricos Contenidos */}
          {isElectricalMode && (
            <Box sx={{ mt: 1.2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase" sx={{ fontSize: '0.65rem' }}>
                  Componentes Eléctricos ({nodeData.electricalNodes.length})
                </Typography>
                {nodeData.onAddElectricalNode && !nodeData.isChainModeActive && (
                  <Tooltip title="Agregar nodo eléctrico a este espacio">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        nodeData.onAddElectricalNode?.(nodeData.roomId);
                      }}
                      sx={{ p: 0.2, bgcolor: '#e2e8f0', '&:hover': { bgcolor: '#cbd5e1' } }}
                    >
                      <AddIcon sx={{ fontSize: 13 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>

              {nodeData.electricalNodes.length === 0 ? (
                <Typography variant="caption" color="text.disabled" fontStyle="italic" display="block">
                  Sin nodos eléctricos asignados
                </Typography>
              ) : (
                <Stack spacing={0.8}>
                  {nodeData.electricalNodes.map((elecNode) => {
                    const meta =
                      TIPO_NODO_ELECTRICO_CATALOG[elecNode.tipo] ||
                      TIPO_NODO_ELECTRICO_CATALOG.boca_tomacorriente;
                    const isSelected = nodeData.selectedElectricalNodeId === elecNode.id;

                    // Estado dentro del modo Conexión en Cadena
                    const isChainOrigin = nodeData.isChainModeActive && nodeData.chainLastNodeId === elecNode.id;

                    const isNodeInSubtree =
                      !nodeData.isAnySubTreeActive ||
                      (nodeData.highlightedSubTreeNodeIds && nodeData.highlightedSubTreeNodeIds.includes(elecNode.id));

                    return (
                      <Box
                        key={elecNode.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (nodeData.isChainModeActive) {
                            nodeData.onNodeClickInChain?.(elecNode.id);
                          } else {
                            if (isSelected) {
                              nodeData.onSelectElectricalNode?.(null);
                            } else {
                              nodeData.onSelectElectricalNode?.(elecNode.id);
                            }
                          }
                        }}
                        sx={{
                          position: 'relative',
                          p: 0.8,
                          borderRadius: 2,
                          bgcolor: isChainOrigin
                            ? '#fff7ed'
                            : isSelected
                            ? '#eff6ff'
                            : isNodeInSubtree && nodeData.isAnySubTreeActive
                            ? '#f0fdf4'
                            : '#f8fafc',
                          border: isChainOrigin
                            ? '2px solid #ea580c'
                            : isSelected
                            ? '2px solid #2563eb'
                            : isNodeInSubtree && nodeData.isAnySubTreeActive
                            ? '1.5px solid #16a34a'
                            : '1px solid #e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          boxShadow: isChainOrigin
                            ? '0 0 12px rgba(234, 88, 12, 0.4)'
                            : isSelected || (isNodeInSubtree && nodeData.isAnySubTreeActive)
                            ? '0 0 8px rgba(37, 99, 235, 0.25)'
                            : '0 1px 2px rgba(0,0,0,0.03)',
                          opacity: isNodeInSubtree ? 1 : 0.25,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: nodeData.isChainModeActive ? '#ffedd5' : '#eff6ff',
                            borderColor: nodeData.isChainModeActive ? '#ea580c' : '#2563eb'
                          }
                        }}
                      >
                        {/* Handles Eléctricos */}
                        <Handle
                          type="target"
                          position={Position.Left}
                          id={`elec-target-${elecNode.id}`}
                          style={{
                            background: meta.color,
                            width: 9,
                            height: 9,
                            border: '1.5px solid #ffffff',
                            left: -6
                          }}
                        />
                        <Handle
                          type="source"
                          position={Position.Right}
                          id={`elec-source-${elecNode.id}`}
                          style={{
                            background: meta.color,
                            width: 9,
                            height: 9,
                            border: '1.5px solid #ffffff',
                            right: -6
                          }}
                        />

                        <Box display="flex" alignItems="center" gap={0.8} overflow="hidden">
                          <Typography sx={{ fontSize: '0.85rem' }}>{meta.emoji}</Typography>
                          <Box overflow="hidden">
                            <Typography variant="caption" fontWeight={700} noWrap display="block" color="#1e293b">
                              {elecNode.etiqueta}
                            </Typography>
                            {elecNode.circuitoCodigo && (
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.62rem' }}>
                                {elecNode.circuitoCodigo}
                              </Typography>
                            )}
                          </Box>
                        </Box>

                        <Stack direction="row" spacing={0.4} alignItems="center">
                          {isChainOrigin ? (
                            <Chip
                              icon={<LinkIcon sx={{ fontSize: '11px !important' }} />}
                              label="ORIGEN"
                              size="small"
                              color="warning"
                              sx={{ height: 18, fontSize: '0.6rem', fontWeight: 800 }}
                            />
                          ) : isSelected ? (
                            <Tooltip title="Nodo Raíz del Subárbol Iluminado">
                              <SparkleIcon sx={{ fontSize: 14, color: '#2563eb' }} />
                            </Tooltip>
                          ) : null}

                          <Chip
                            label={meta.shortCode}
                            size="small"
                            sx={{
                              height: 16,
                              fontSize: '0.6rem',
                              fontWeight: 700,
                              bgcolor: `${meta.color}22`,
                              color: meta.color
                            }}
                          />
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
});
