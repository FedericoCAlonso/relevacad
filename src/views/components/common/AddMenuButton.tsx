/**
 * View: AddMenuButton (Material 3)
 * Botón único "+ Agregar" con menú desplegable para incorporar cualquier elemento al proyecto:
 * Ambientes interiores, Puntos de ingreso, Islas técnicas y Nodos eléctricos.
 */

import React, { useState } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  ButtonProps
} from '@mui/material';
import {
  Add as AddIcon,
  KeyboardArrowDown as ArrowDownIcon,
  MeetingRoom as RoomIcon,
  DoorSliding as EntryIcon,
  ElectricMeter as IslandIcon,
  ElectricBolt as BoltIcon
} from '@mui/icons-material';

interface AddMenuButtonProps extends Omit<ButtonProps, 'onClick'> {
  onAddRoom: (tab: 'interior' | 'access' | 'technical') => void;
  onAddElectricalNode?: () => void;
  label?: string;
}

export const AddMenuButton: React.FC<AddMenuButtonProps> = ({
  onAddRoom,
  onAddElectricalNode,
  label = 'Agregar',
  variant = 'contained',
  size = 'small',
  color = 'primary',
  ...props
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelectTab = (tab: 'interior' | 'access' | 'technical') => {
    handleClose();
    onAddRoom(tab);
  };

  const handleSelectElecNode = () => {
    handleClose();
    onAddElectricalNode?.();
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        color={color}
        startIcon={<AddIcon />}
        endIcon={<ArrowDownIcon />}
        onClick={handleClick}
        sx={{ textTransform: 'none', fontWeight: 600, ...props.sx }}
        {...props}
      >
        {label}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        transformOrigin={{ horizontal: 'left', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
        PaperProps={{
          sx: {
            minWidth: 260,
            borderRadius: 3,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            p: 0.5
          }
        }}
      >
        {/* 1. Ambiente Interior */}
        <MenuItem onClick={() => handleSelectTab('interior')} sx={{ borderRadius: 2, py: 1 }}>
          <ListItemIcon sx={{ color: 'primary.main', minWidth: 36 }}>
            <RoomIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Ambiente Interior"
            secondary="Estar, Cocina, Dormitorio, Baño..."
            primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
            secondaryTypographyProps={{ variant: 'caption' }}
          />
        </MenuItem>

        {/* 2. Punto de Ingreso */}
        <MenuItem onClick={() => handleSelectTab('access')} sx={{ borderRadius: 2, py: 1 }}>
          <ListItemIcon sx={{ color: 'success.main', minWidth: 36 }}>
            <EntryIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Punto de Ingreso"
            secondary="Calle L.M., Palier, Cochera, Patio..."
            primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
            secondaryTypographyProps={{ variant: 'caption' }}
          />
        </MenuItem>

        {/* 3. Isla Técnica de Suministro */}
        <MenuItem onClick={() => handleSelectTab('technical')} sx={{ borderRadius: 2, py: 1 }}>
          <ListItemIcon sx={{ color: 'warning.main', minWidth: 36 }}>
            <IslandIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Isla de Suministro"
            secondary="Sala Medidores, Pilar L.M., Montante..."
            primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
            secondaryTypographyProps={{ variant: 'caption' }}
          />
        </MenuItem>

        {onAddElectricalNode && <Divider sx={{ my: 0.5 }} />}

        {/* 4. Nodo Eléctrico */}
        {onAddElectricalNode && (
          <MenuItem onClick={handleSelectElecNode} sx={{ borderRadius: 2, py: 1 }}>
            <ListItemIcon sx={{ color: '#2563eb', minWidth: 36 }}>
              <BoltIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Nodo Eléctrico"
              secondary="Medidor, Tablero, Caja de Paso, Boca..."
              primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
              secondaryTypographyProps={{ variant: 'caption' }}
            />
          </MenuItem>
        )}
      </Menu>
    </>
  );
};
