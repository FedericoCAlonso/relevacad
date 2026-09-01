/**
 * View: RoomSchematicPreview (Material 3)
 * Esquema paramétrico 2D del ambiente que visualiza en tiempo real
 * polígonos ortogonales o con falsa escuadra (4 paredes independientes, diagonal y ángulos).
 */

import React from 'react';
import { Card, CardContent, Typography, Box, Chip, Stack } from '@mui/material';
import { Room, TIPO_CUBIERTA_CATALOG } from '@/models/RoomModel';
import { ELECTRICAL_ASSET_CATALOG } from '@/models/ElectricalTypes';
import {
  calculateRoomPolygon,
  calculateCornerAngles,
  calculatePolygonArea,
  getWallActualLength
} from '@/viewmodels/utils/polygonSolver';

interface RoomSchematicPreviewProps {
  room: Room;
}

export const RoomSchematicPreview: React.FC<RoomSchematicPreviewProps> = ({ room }) => {
  const geom = room.geometry;
  const isParametric = geom?.mode === 'independent_walls' || geom?.mode === 'diagonal_triangulated';
  const cubiertaMeta = TIPO_CUBIERTA_CATALOG[room.tipoCubierta || 'cubierto'];

  // Dimensiones del visor SVG
  const svgWidth = 400;
  const svgHeight = 300;
  const padding = 55;

  // Calcular polígono 2D en metros mediante el solver
  const verticesMeters = calculateRoomPolygon(room);
  const angles = calculateCornerAngles(verticesMeters);
  const realArea = calculatePolygonArea(verticesMeters);

  // Bounding box en metros
  const maxX = Math.max(...verticesMeters.map((v) => v.x)) || 1;
  const maxY = Math.max(...verticesMeters.map((v) => v.y)) || 1;

  // Escalar para encajar en el visor SVG
  const availableW = svgWidth - padding * 2;
  const availableH = svgHeight - padding * 2;
  const scale = Math.min(availableW / maxX, availableH / maxY);

  const polyW = maxX * scale;
  const polyH = maxY * scale;
  const originX = (svgWidth - polyW) / 2;
  const originY = (svgHeight - polyH) / 2;

  // Vértices proyectados en píxeles de SVG: [V0 (NW), V1 (NE), V2 (SE), V3 (SW)]
  const pts = verticesMeters.map((v) => ({
    x: originX + v.x * scale,
    y: originY + v.y * scale
  }));

  const pointsString = pts.map((p) => `${p.x},${p.y}`).join(' ');

  const LN = getWallActualLength(room, 'north');
  const LS = getWallActualLength(room, 'south');
  const LE = getWallActualLength(room, 'east');
  const LO = getWallActualLength(room, 'west');

  return (
    <Card sx={{ border: '1px solid #e0e7ee', bgcolor: '#ffffff' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle2" fontWeight={700}>
            Plano Paramétrico ({realArea} m²)
          </Typography>
          <Stack direction="row" spacing={0.5}>
            <Chip
              label={`${cubiertaMeta.emoji} ${cubiertaMeta.label}`}
              size="small"
              sx={{
                fontSize: '0.68rem',
                height: 20,
                fontWeight: 700,
                bgcolor: cubiertaMeta.badgeBg,
                color: cubiertaMeta.color
              }}
            />
            {isParametric && (
              <Chip
                label="Falsa Escuadra"
                size="small"
                color="secondary"
                variant="outlined"
                sx={{ fontSize: '0.68rem', height: 20 }}
              />
            )}
            <Chip
              label={`${room.electricalAssets.length} bocas`}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ fontSize: '0.68rem', height: 20 }}
            />
          </Stack>
        </Box>

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            bgcolor: '#f8fafc',
            borderRadius: 3,
            p: { xs: 0.5, sm: 1 },
            border: '1px solid #edf2f7'
          }}
        >
          <svg width="100%" height="auto" viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ maxWidth: '100%', maxHeight: 300, display: 'block' }}>
            {/* Cuadrícula suave de fondo */}
            <defs>
              <pattern id="room-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.75" />
              </pattern>
            </defs>
            <rect width={svgWidth} height={svgHeight} fill="url(#room-grid)" rx="8" />

            {/* Diagonal de Triangulación auxiliar (SO a NE) */}
            {isParametric && pts.length >= 4 && (
              <line
                x1={pts[3].x}
                y1={pts[3].y}
                x2={pts[1].x}
                y2={pts[1].y}
                stroke="#9333ea"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
            )}

            {/* Polígono Paramétrico del Ambiente */}
            <polygon
              points={pointsString}
              fill={room.color || '#e3f2fd'}
              fillOpacity={0.45}
              stroke="#0f172a"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />

            {/* Cotas de Longitud en cada Muro */}
            {/* NORTE (V0 -> V1) */}
            {pts.length >= 4 && (
              <text
                x={(pts[0].x + pts[1].x) / 2}
                y={(pts[0].y + pts[1].y) / 2 - 12}
                textAnchor="middle"
                fill="#1e293b"
                fontSize="10"
                fontWeight="bold"
              >
                N: {LN}m
              </text>
            )}

            {/* SUR (V3 -> V2) */}
            {pts.length >= 4 && (
              <text
                x={(pts[3].x + pts[2].x) / 2}
                y={(pts[3].y + pts[2].y) / 2 + 18}
                textAnchor="middle"
                fill="#1e293b"
                fontSize="10"
                fontWeight="bold"
              >
                S: {LS}m
              </text>
            )}

            {/* OESTE (V0 -> V3) */}
            {pts.length >= 4 && (
              <text
                x={(pts[0].x + pts[3].x) / 2 - 14}
                y={(pts[0].y + pts[3].y) / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fill="#1e293b"
                fontSize="10"
                fontWeight="bold"
              >
                O: {LO}m
              </text>
            )}

            {/* ESTE (V1 -> V2) */}
            {pts.length >= 4 && (
              <text
                x={(pts[1].x + pts[2].x) / 2 + 14}
                y={(pts[1].y + pts[2].y) / 2}
                textAnchor="start"
                dominantBaseline="middle"
                fill="#1e293b"
                fontSize="10"
                fontWeight="bold"
              >
                E: {LE}m
              </text>
            )}

            {/* Ángulos de Esquinas */}
            {isParametric && pts.length >= 4 && (
              <>
                <text x={pts[0].x + 8} y={pts[0].y + 14} fontSize="8" fill="#64748b" fontWeight="bold">
                  {angles.NW}°
                </text>
                <text x={pts[1].x - 22} y={pts[1].y + 14} fontSize="8" fill="#64748b" fontWeight="bold">
                  {angles.NE}°
                </text>
                <text x={pts[2].x - 22} y={pts[2].y - 8} fontSize="8" fill="#64748b" fontWeight="bold">
                  {angles.SE}°
                </text>
                <text x={pts[3].x + 8} y={pts[3].y - 8} fontSize="8" fill="#64748b" fontWeight="bold">
                  {angles.SW}°
                </text>
              </>
            )}

            {/* Elementos Eléctricos Paramétricos */}
            {room.electricalAssets.map((asset) => {
              const meta = ELECTRICAL_ASSET_CATALOG[asset.type] || { code: 'E' };
              let posX = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
              let posY = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;

              if (pts.length >= 4) {
                if (asset.wall === 'north') {
                  posX = pts[0].x + asset.offsetRatio * (pts[1].x - pts[0].x);
                  posY = pts[0].y + asset.offsetRatio * (pts[1].y - pts[0].y);
                } else if (asset.wall === 'south') {
                  posX = pts[3].x + asset.offsetRatio * (pts[2].x - pts[3].x);
                  posY = pts[3].y + asset.offsetRatio * (pts[2].y - pts[3].y);
                } else if (asset.wall === 'west') {
                  posX = pts[0].x + asset.offsetRatio * (pts[3].x - pts[0].x);
                  posY = pts[0].y + asset.offsetRatio * (pts[3].y - pts[0].y);
                } else if (asset.wall === 'east') {
                  posX = pts[1].x + asset.offsetRatio * (pts[2].x - pts[1].x);
                  posY = pts[1].y + asset.offsetRatio * (pts[2].y - pts[1].y);
                }
              }

              const isPanel = asset.type === 'main_panel' || asset.type === 'sub_panel';
              const isLighting = asset.type === 'ceiling_light' || asset.type === 'wall_light';
              const symbolColor = isPanel ? '#dc2626' : isLighting ? '#d97706' : '#2563eb';

              return (
                <g key={asset.id} transform={`translate(${posX}, ${posY})`}>
                  <circle r="7" fill={symbolColor} stroke="#ffffff" strokeWidth="1.5" />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#ffffff"
                    fontSize="7"
                    fontWeight="bold"
                  >
                    {meta.code}
                  </text>
                </g>
              );
            })}
          </svg>
        </Box>
      </CardContent>
    </Card>
  );
};
