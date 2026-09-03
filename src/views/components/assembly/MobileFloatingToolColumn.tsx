/**
 * View Component: MobileFloatingToolColumn
 * Columna flotante, compacta y movible (draggable) optimizada para smartphones:
 * - Ocupa menos del 5% de la pantalla (46px de ancho)
 * - Se puede arrastrar y reubicar en cualquier parte de la pantalla táctil
 * - Acceso a 1-toque: Snap magnético, Integrar ambientes (Concepto Abierto), Fusión en L
 * - Sin telones ni modales bloqueantes que congelen el lienzo 2D
 */

import React, { useState, useRef } from 'react';
import {
  Paper,
  IconButton,
  Tooltip,
  Badge,
  Box,
  Divider
} from '@mui/material';
import {
  DragIndicator as DragIcon,
  MergeType as MergeIcon,
  MeetingRoom as DoorIcon,
  CropSquare as WallIcon,
  Straighten as MeasureIcon,
  Close as CloseIcon,
  AddBox as AddOpeningIcon,
  Grain as SnapIcon
} from '@mui/icons-material';
import { Room } from '@/models/RoomModel';
import { LogicalConnection } from '@/models/GraphModel';

interface MobileFloatingToolColumnProps {
  selectedRoom: Room;
  adjacentNeighbor?: Room | null;
  adjacentConn?: LogicalConnection | null;
  snapSuggestions: Array<{ id: string; label: string; action: () => void }>;
  canMergeWithNeighbor?: boolean;
  onToggleVirtualBoundary: () => void;
  onMergeRooms: () => void;
  onOpenWallOpenings: () => void;
  onOpenDimensions?: () => void;
  onDeselect: () => void;
}

export const MobileFloatingToolColumn: React.FC<MobileFloatingToolColumnProps> = ({
  selectedRoom,
  adjacentNeighbor,
  adjacentConn,
  snapSuggestions,
  canMergeWithNeighbor,
  onToggleVirtualBoundary,
  onMergeRooms,
  onOpenWallOpenings,
  onOpenDimensions,
  onDeselect
}) => {
  // Posición inicial: esquina superior derecha, bajo el pulgar
  const [position, setPosition] = useState<{ x: number; y: number }>(() => ({
    x: typeof window !== 'undefined' ? Math.max(10, window.innerWidth - 58) : 320,
    y: 80
  }));

  const draggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    draggingRef.current = true;
    dragOffsetRef.current = {
      x: touch.clientX - position.x,
      y: touch.clientY - position.y
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!draggingRef.current) return;
    const touch = e.touches[0];
    const maxX = window.innerWidth - 50;
    const maxY = window.innerHeight - 100;

    setPosition({
      x: Math.min(maxX, Math.max(10, touch.clientX - dragOffsetRef.current.x)),
      y: Math.min(maxY, Math.max(50, touch.clientY - dragOffsetRef.current.y))
    });
  };

  const handleTouchEnd = () => {
    draggingRef.current = false;
  };

  const isVirtual = Boolean(
    adjacentConn?.isVirtualBoundary ||
    adjacentConn?.wallProperties?.isVirtualBoundary ||
    adjacentConn?.type === 'limite_virtual'
  );

  return (
    <Paper
      elevation={6}
      sx={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 1200,
        width: 48,
        borderRadius: 6,
        py: 0.6,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.8,
        bgcolor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(16px)',
        border: '1.5px solid rgba(226, 232, 240, 0.95)',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.18)',
        touchAction: 'none',
        userSelect: 'none'
      }}
    >
      {/* ✋ Grip de Arrastre Táctil */}
      <Box
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        sx={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          py: 0.4,
          cursor: 'grab',
          color: '#94a3b8'
        }}
      >
        <DragIcon sx={{ fontSize: 18 }} />
      </Box>

      {/* 🏠 Indicador del Ambiente Seleccionado */}
      <Tooltip title={selectedRoom.name} placement="left">
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            bgcolor: selectedRoom.color || '#0284c7',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
          }}
        >
          {selectedRoom.name.charAt(0).toUpperCase()}
        </Box>
      </Tooltip>

      <Divider sx={{ width: '80%', my: 0.2 }} />

      {/* 🧲 Botón Snap Magnético Instantáneo */}
      {snapSuggestions.length > 0 && (
        <Tooltip title={snapSuggestions[0].label} placement="left">
          <Badge badgeContent={snapSuggestions.length} color="primary" overlap="circular">
            <IconButton
              size="small"
              onClick={snapSuggestions[0].action}
              sx={{
                bgcolor: '#0284c7',
                color: '#ffffff',
                width: 34,
                height: 34,
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)',
                '&:hover': { bgcolor: '#0369a1' }
              }}
            >
              <SnapIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Badge>
        </Tooltip>
      )}

      {/* 🚪 / 🧱 Botón Integrar Espacio vs Muro */}
      {adjacentConn && (
        <Tooltip
          title={isVirtual ? 'Poner Muro (Restablecer tabique sólido)' : 'Integrar Espacio (Concepto Abierto)'}
          placement="left"
        >
          <IconButton
            size="small"
            onClick={onToggleVirtualBoundary}
            sx={{
              bgcolor: isVirtual ? '#0284c7' : 'rgba(2, 132, 199, 0.1)',
              color: isVirtual ? '#ffffff' : '#0284c7',
              border: isVirtual ? 'none' : '1px solid #0284c7',
              width: 34,
              height: 34,
              '&:hover': { bgcolor: isVirtual ? '#0369a1' : 'rgba(2, 132, 199, 0.2)' }
            }}
          >
            {isVirtual ? <WallIcon sx={{ fontSize: 18 }} /> : <DoorIcon sx={{ fontSize: 18 }} />}
          </IconButton>
        </Tooltip>
      )}

      {/* 🔗 Botón Fusión en 'L' */}
      {adjacentNeighbor && canMergeWithNeighbor && (
        <Tooltip title={`Fusionar con ${adjacentNeighbor.name} en 'L'`} placement="left">
          <IconButton
            size="small"
            onClick={onMergeRooms}
            sx={{
              bgcolor: 'rgba(147, 51, 234, 0.12)',
              color: '#9333ea',
              border: '1.5px solid #9333ea',
              width: 34,
              height: 34,
              '&:hover': { bgcolor: 'rgba(147, 51, 234, 0.25)' }
            }}
          >
            <MergeIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      )}

      {/* 🚪➕ Agregar Abertura */}
      <Tooltip title="Agregar Abertura (Puerta / Ventana)" placement="left">
        <IconButton
          size="small"
          onClick={onOpenWallOpenings}
          sx={{
            color: '#475569',
            width: 34,
            height: 34,
            '&:hover': { bgcolor: '#f1f5f9' }
          }}
        >
          <AddOpeningIcon sx={{ fontSize: 19 }} />
        </IconButton>
      </Tooltip>

      {/* 📏 Ajustar Medidas / Cotas */}
      {onOpenDimensions && (
        <Tooltip title="Ajustar Medidas y Cotas" placement="left">
          <IconButton
            size="small"
            onClick={onOpenDimensions}
            sx={{
              color: '#475569',
              width: 34,
              height: 34,
              '&:hover': { bgcolor: '#f1f5f9' }
            }}
          >
            <MeasureIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      )}

      <Divider sx={{ width: '80%', my: 0.2 }} />

      {/* ✖ Deseleccionar Ambiente */}
      <Tooltip title="Deseleccionar" placement="left">
        <IconButton
          size="small"
          onClick={onDeselect}
          sx={{
            color: '#94a3b8',
            width: 30,
            height: 30,
            '&:hover': { color: '#ef4444', bgcolor: '#fee2e2' }
          }}
        >
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
    </Paper>
  );
};
