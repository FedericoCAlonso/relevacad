/**
 * View Component: ArchitecturalOpeningShape (Konva 2D CAD Opening)
 * Renderiza aberturas arquitectónicas con estándares de dibujo técnico CAD (estilo Traza):
 * - Puertas batientes (1 y 2 hojas) con espesor constructivo físico, hoja a 90°, arco de barrido exacto y picaporte.
 * - Puertas y ventanas corredizas con solape central, guías y hojas de vidrio paralelas.
 * - Ventanas con antepecho (muro bajo en planta), tacos de marco en jambas y hojas vidriadas.
 * - Vanos libres con mochetas y dintel en proyección.
 * - Soporta tanto el modelo maduro Abertura como el modelo legacy OpeningProperties.
 */

import React from 'react';
import { Group, Line, Rect, Text, Circle } from 'react-konva';
import { WallOrientation } from '@/models/RoomModel';
import { OpeningProperties } from '@/models/GraphModel';
import { Abertura, TipoAbertura } from '@/models/OpeningModel';
import { PIXELS_PER_METER } from '@/viewmodels/utils/geometryUtils';

export interface ArchitecturalOpeningShapeProps {
  wall: WallOrientation;
  wallLengthPx: number;
  wallThicknessPx: number;
  roomWidthPx?: number;
  roomLengthPx?: number;
  opening?: OpeningProperties;
  abertura?: Abertura;
  offsetRatio?: number;
  startPx?: number;
  isSelected?: boolean;
  onSelect?: () => void;
  onClick?: (e: any) => void;
}

interface Point2D {
  x: number;
  y: number;
}

function add(p1: Point2D, p2: Point2D): Point2D {
  return { x: p1.x + p2.x, y: p1.y + p2.y };
}

function scale(p: Point2D, s: number): Point2D {
  return { x: p.x * s, y: p.y * s };
}

function sub(p1: Point2D, p2: Point2D): Point2D {
  return { x: p1.x - p2.x, y: p1.y - p2.y };
}

function polyPoints(pts: Point2D[]): number[] {
  return pts.flatMap((p) => [p.x, p.y]);
}

/**
 * Genera puntos poligonales de un arco circular de 90° entre dos ángulos
 * de forma matemáticamente consistente y libre de fallas de cuadrante.
 */
function generateArcPoints(
  center: Point2D,
  fromPt: Point2D,
  toPt: Point2D,
  radius: number,
  steps: number = 16
): number[] {
  const startAngle = Math.atan2(fromPt.y - center.y, fromPt.x - center.x);
  let endAngle = Math.atan2(toPt.y - center.y, toPt.x - center.x);

  let delta = endAngle - startAngle;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;

  const points: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + (delta * i) / steps;
    points.push(center.x + radius * Math.cos(angle), center.y + radius * Math.sin(angle));
  }
  return points;
}

export const ArchitecturalOpeningShape: React.FC<ArchitecturalOpeningShapeProps> = ({
  wall,
  wallLengthPx,
  wallThicknessPx,
  roomWidthPx,
  roomLengthPx,
  opening,
  abertura,
  offsetRatio = 0.5,
  startPx,
  isSelected = false,
  onSelect,
  onClick
}) => {
  // 1. Normalizar parámetros dimensionales y de tipo
  const widthMeters = abertura?.anchoMeters ?? opening?.widthMeters ?? 0.8;
  const openingWidthPx = Math.min(wallLengthPx * 0.96, widthMeters * PIXELS_PER_METER);

  const localStartPx =
    startPx !== undefined
      ? startPx
      : abertura?.posicionMeters !== undefined
      ? abertura.posicionMeters * PIXELS_PER_METER
      : Math.max(0, offsetRatio * wallLengthPx - openingWidthPx / 2);

  // Determinar categoría y subtipo
  let tipo: TipoAbertura = 'puerta';
  if (abertura) {
    tipo = abertura.tipo;
  } else if (opening) {
    if (opening.openingType?.includes('ventana')) tipo = 'ventana';
    else if (opening.openingType?.includes('vano') || opening.openingType?.includes('pass')) tipo = 'vano';
    else tipo = 'puerta';
  }

  const subtipo =
    abertura?.subtipo ||
    (tipo === 'puerta'
      ? opening?.openingType === 'puerta_corrediza'
        ? 'corrediza'
        : 'batiente'
      : tipo === 'ventana'
      ? 'corrediza'
      : 'batiente');

  const hojas = abertura?.hojas ?? (opening?.openingType === 'puerta_doble' ? 2 : 1);
  const lado = abertura?.ladoApertura ?? 'interior';
  const sentido = abertura?.sentidoGiro ?? (opening?.swingDirection === 'left' ? 'izquierda' : 'derecha');
  const label = abertura?.etiqueta || opening?.label || (tipo === 'puerta' ? 'P' : tipo === 'ventana' ? 'V' : '');

  // 2. Geometría Vectorial en el Marco Local del Ambiente
  // bI: inicio cara interior, bF: fin cara interior
  // eI: inicio cara exterior, eF: fin cara exterior
  // dir: vector unitario a lo largo del muro
  // v_int: vector unitario normal apuntando al interior del ambiente
  // v_ext: vector unitario normal apuntando al exterior del ambiente
  const rW = roomWidthPx ?? wallLengthPx;
  const rL = roomLengthPx ?? wallLengthPx;

  let bI: Point2D = { x: 0, y: 0 };
  let bF: Point2D = { x: 0, y: 0 };
  let eI: Point2D = { x: 0, y: 0 };
  let eF: Point2D = { x: 0, y: 0 };
  let dir: Point2D = { x: 1, y: 0 };
  let v_int: Point2D = { x: 0, y: 1 };
  let v_ext: Point2D = { x: 0, y: -1 };

  switch (wall) {
    case 'north':
      bI = { x: localStartPx, y: 0 };
      bF = { x: localStartPx + openingWidthPx, y: 0 };
      eI = { x: localStartPx, y: -wallThicknessPx };
      eF = { x: localStartPx + openingWidthPx, y: -wallThicknessPx };
      dir = { x: 1, y: 0 };
      v_int = { x: 0, y: 1 };
      v_ext = { x: 0, y: -1 };
      break;
    case 'south':
      bI = { x: localStartPx, y: rL };
      bF = { x: localStartPx + openingWidthPx, y: rL };
      eI = { x: localStartPx, y: rL + wallThicknessPx };
      eF = { x: localStartPx + openingWidthPx, y: rL + wallThicknessPx };
      dir = { x: 1, y: 0 };
      v_int = { x: 0, y: -1 };
      v_ext = { x: 0, y: 1 };
      break;
    case 'west':
      bI = { x: 0, y: localStartPx };
      bF = { x: 0, y: localStartPx + openingWidthPx };
      eI = { x: -wallThicknessPx, y: localStartPx };
      eF = { x: -wallThicknessPx, y: localStartPx + openingWidthPx };
      dir = { x: 0, y: 1 };
      v_int = { x: 1, y: 0 };
      v_ext = { x: -1, y: 0 };
      break;
    case 'east':
      bI = { x: rW, y: localStartPx };
      bF = { x: rW, y: localStartPx + openingWidthPx };
      eI = { x: rW + wallThicknessPx, y: localStartPx };
      eF = { x: rW + wallThicknessPx, y: localStartPx + openingWidthPx };
      dir = { x: 0, y: 1 };
      v_int = { x: -1, y: 0 };
      v_ext = { x: 1, y: 0 };
      break;
  }

  const vOpen = lado === 'exterior' ? v_ext : v_int;
  const tHoja = Math.max(2.5, 0.04 * PIXELS_PER_METER); // ~4 cm de espesor físico de hoja

  const doorStroke = isSelected ? '#0284c7' : '#1e293b';
  const doorArcStroke = isSelected ? '#0284c7' : '#64748b';
  const windowStroke = isSelected ? '#0284c7' : '#0284c7';
  const vanoStroke = isSelected ? '#0284c7' : '#94a3b8';

  const handleClick = (e: any) => {
    e.cancelBubble = true;
    if (onClick) onClick(e);
    if (onSelect) onSelect();
  };

  return (
    <Group onClick={handleClick} onTap={handleClick}>
      {/* 1. Mochetas de Tope de Muro (Terminación limpia del tabique en ambas jambas) */}
      <Line points={[bI.x, bI.y, eI.x, eI.y]} stroke="#0f172a" strokeWidth={1.5} />
      <Line points={[bF.x, bF.y, eF.x, eF.y]} stroke="#0f172a" strokeWidth={1.5} />

      {/* 2. RENDERIZADO DE PUERTAS */}
      {tipo === 'puerta' && (
        <Group>
          {subtipo === 'corrediza' ? (
            // PUERTA CORREDIZA (Hojas corredizas con riel)
            <Group>
              {/* Riel de deslizamiento con línea punteada */}
              <Line
                points={polyPoints([add(bI, scale(vOpen, 2)), add(bF, scale(vOpen, 2))])}
                stroke="#64748b"
                strokeWidth={1}
                dash={[4, 2]}
              />
              {hojas === 2 ? (
                // 2 hojas solapadas al centro
                (() => {
                  const solape = 6;
                  const wH = openingWidthPx / 2 + solape / 2;
                  const h1_end = add(bI, scale(dir, wH));
                  const h2_start = sub(bF, scale(dir, wH));
                  return (
                    <>
                      <Rect
                        points={polyPoints([
                          add(bI, scale(vOpen, 2)),
                          add(h1_end, scale(vOpen, 2)),
                          add(add(h1_end, scale(vOpen, 2)), scale(vOpen, tHoja)),
                          add(add(bI, scale(vOpen, 2)), scale(vOpen, tHoja))
                        ])}
                        fill="#ffffff"
                        stroke={doorStroke}
                        strokeWidth={1.2}
                      />
                      <Rect
                        points={polyPoints([
                          add(h2_start, scale(vOpen, 6)),
                          add(bF, scale(vOpen, 6)),
                          add(add(bF, scale(vOpen, 6)), scale(vOpen, tHoja)),
                          add(add(h2_start, scale(vOpen, 6)), scale(vOpen, tHoja))
                        ])}
                        fill="#ffffff"
                        stroke={doorStroke}
                        strokeWidth={1.2}
                      />
                    </>
                  );
                })()
              ) : (
                // 1 hoja corrediza
                <Line
                  points={polyPoints([
                    add(bI, scale(vOpen, 3)),
                    add(bF, scale(vOpen, 3)),
                    add(add(bF, scale(vOpen, 3)), scale(vOpen, tHoja)),
                    add(add(bI, scale(vOpen, 3)), scale(vOpen, tHoja))
                  ])}
                  closed
                  fill="#ffffff"
                  stroke={doorStroke}
                  strokeWidth={1.2}
                />
              )}
            </Group>
          ) : subtipo === 'vaiven' ? (
            // PUERTA VAIVÉN (Doble arco hacia adentro y hacia afuera)
            (() => {
              const gozne = sentido === 'derecha' ? (lado === 'exterior' ? eI : bI) : (lado === 'exterior' ? eF : bF);
              const cerr = sentido === 'derecha' ? (lado === 'exterior' ? eF : bF) : (lado === 'exterior' ? eI : bI);
              const pOpenInt = add(gozne, scale(v_int, openingWidthPx));
              const pOpenExt = add(gozne, scale(v_ext, openingWidthPx));
              const arcInt = generateArcPoints(gozne, cerr, pOpenInt, openingWidthPx);
              const arcExt = generateArcPoints(gozne, cerr, pOpenExt, openingWidthPx);

              return (
                <Group>
                  <Line points={arcInt} stroke={doorArcStroke} strokeWidth={1} dash={[3, 2]} opacity={0.6} />
                  <Line points={arcExt} stroke={doorArcStroke} strokeWidth={1} dash={[3, 2]} opacity={0.6} />
                  <Line
                    points={polyPoints([
                      gozne,
                      add(gozne, scale(dir, tHoja)),
                      add(pOpenInt, scale(dir, tHoja)),
                      pOpenInt
                    ])}
                    closed
                    fill="#ffffff"
                    stroke={doorStroke}
                    strokeWidth={1.5}
                  />
                </Group>
              );
            })()
          ) : subtipo === 'pivotante' ? (
            // PUERTA PIVOTANTE (Eje descentrado a 20%)
            (() => {
              const distPivote = openingWidthPx * 0.2;
              const lLargo = openingWidthPx * 0.8;
              const gozneBase = lado === 'exterior' ? eI : bI;
              const pivote = add(gozneBase, scale(dir, distPivote));
              const pLargo = add(pivote, scale(vOpen, lLargo));
              const pCorto = sub(pivote, scale(vOpen, distPivote));
              const cerrLargo = lado === 'exterior' ? eF : bF;
              const arcLargo = generateArcPoints(pivote, cerrLargo, pLargo, lLargo);
              const arcCorto = generateArcPoints(pivote, gozneBase, pCorto, distPivote);

              return (
                <Group>
                  <Line points={arcLargo} stroke={doorArcStroke} strokeWidth={1} dash={[3, 2]} opacity={0.6} />
                  <Line points={arcCorto} stroke={doorArcStroke} strokeWidth={1} dash={[3, 2]} opacity={0.6} />
                  <Line
                    points={polyPoints([
                      sub(pCorto, scale(dir, tHoja / 2)),
                      add(pCorto, scale(dir, tHoja / 2)),
                      add(pLargo, scale(dir, tHoja / 2)),
                      sub(pLargo, scale(dir, tHoja / 2))
                    ])}
                    closed
                    fill="#ffffff"
                    stroke={doorStroke}
                    strokeWidth={1.5}
                  />
                  <Circle x={pivote.x} y={pivote.y} radius={2} fill="#0f172a" />
                </Group>
              );
            })()
          ) : (
            // PUERTA BATIENTE ESTÁNDAR (1 o 2 hojas)
            hojas === 2 ? (
              // 2 Hojas Batientes
              (() => {
                const wH = openingWidthPx / 2;
                const g1 = lado === 'exterior' ? eI : bI;
                const g2 = lado === 'exterior' ? eF : bF;
                const pMid = add(g1, scale(dir, wH));
                const pOpen1 = add(g1, scale(vOpen, wH));
                const pOpen2 = add(g2, scale(vOpen, wH));
                const arc1 = generateArcPoints(g1, pMid, pOpen1, wH);
                const arc2 = generateArcPoints(g2, pMid, pOpen2, wH);

                return (
                  <Group>
                    <Line points={arc1} stroke={doorArcStroke} strokeWidth={1} dash={[3, 2]} opacity={0.7} />
                    <Line points={arc2} stroke={doorArcStroke} strokeWidth={1} dash={[3, 2]} opacity={0.7} />
                    {/* Hoja Izquierda */}
                    <Line
                      points={polyPoints([
                        g1,
                        add(g1, scale(dir, tHoja)),
                        add(pOpen1, scale(dir, tHoja)),
                        pOpen1
                      ])}
                      closed
                      fill="#ffffff"
                      stroke={doorStroke}
                      strokeWidth={1.5}
                    />
                    {/* Hoja Derecha */}
                    <Line
                      points={polyPoints([
                        g2,
                        sub(g2, scale(dir, tHoja)),
                        sub(pOpen2, scale(dir, tHoja)),
                        pOpen2
                      ])}
                      closed
                      fill="#ffffff"
                      stroke={doorStroke}
                      strokeWidth={1.5}
                    />
                  </Group>
                );
              })()
            ) : (
              // 1 Hoja Batiente
              (() => {
                const isRight = sentido === 'derecha';
                const gozne = isRight ? (lado === 'exterior' ? eI : bI) : (lado === 'exterior' ? eF : bF);
                const cerr = isRight ? (lado === 'exterior' ? eF : bF) : (lado === 'exterior' ? eI : bI);
                const dirH = isRight ? dir : scale(dir, -1);
                const pOpen = add(gozne, scale(vOpen, openingWidthPx));
                const arcPoints = generateArcPoints(gozne, cerr, pOpen, openingWidthPx);

                // Posición de la manija / picaporte
                const knobPos = add(sub(pOpen, scale(vOpen, 8)), scale(dirH, tHoja / 2));

                return (
                  <Group>
                    {/* Arco de barrido de 90° exacto */}
                    <Line points={arcPoints} stroke={doorArcStroke} strokeWidth={1} dash={[3, 2]} opacity={0.7} />

                    {/* Hoja de puerta sólida con espesor físico */}
                    <Line
                      points={polyPoints([
                        gozne,
                        add(gozne, scale(dirH, tHoja)),
                        add(pOpen, scale(dirH, tHoja)),
                        pOpen
                      ])}
                      closed
                      fill="#ffffff"
                      stroke={doorStroke}
                      strokeWidth={1.5}
                    />

                    {/* Picaporte / Manija metálica */}
                    <Circle x={knobPos.x} y={knobPos.y} radius={2} fill="#f59e0b" stroke="#78350f" strokeWidth={0.5} />
                  </Group>
                );
              })()
            )
          )}
        </Group>
      )}

      {/* 3. RENDERIZADO DE VENTANAS */}
      {tipo === 'ventana' && (
        <Group>
          {/* Líneas de Antepecho (Muro bajo en vista en planta) */}
          <Line points={[bI.x, bI.y, bF.x, bF.y]} stroke="#94a3b8" strokeWidth={1.2} />
          <Line points={[eI.x, eI.y, eF.x, eF.y]} stroke="#94a3b8" strokeWidth={1.2} />

          {/* Tacos de Marco en las Jambas */}
          <Line
            points={polyPoints([bI, eI, add(eI, scale(dir, 4)), add(bI, scale(dir, 4))])}
            closed
            fill="#334155"
            stroke="#0f172a"
            strokeWidth={0.8}
          />
          <Line
            points={polyPoints([bF, eF, sub(eF, scale(dir, 4)), sub(bF, scale(dir, 4))])}
            closed
            fill="#334155"
            stroke="#0f172a"
            strokeWidth={0.8}
          />

          {/* Hojas de Vidrio según Subtipo */}
          {subtipo === 'fija' ? (
            // Paño fijo centrado
            (() => {
              const midI = scale(add(bI, eI), 0.5);
              const midF = scale(add(bF, eF), 0.5);
              return (
                <Line
                  points={[midI.x + dir.x * 4, midI.y + dir.y * 4, midF.x - dir.x * 4, midF.y - dir.y * 4]}
                  stroke={windowStroke}
                  strokeWidth={2.5}
                />
              );
            })()
          ) : subtipo === 'abatible' ? (
            // Ventana batiente / abrible (hoja inclinada 30°)
            (() => {
              const pStart = add(bI, scale(dir, 4));
              const tiltDir = add(scale(dir, 0.86), scale(v_int, 0.5));
              const pEnd = add(pStart, scale(tiltDir, openingWidthPx - 8));
              return (
                <>
                  <Line
                    points={[pStart.x, pStart.y, pEnd.x, pEnd.y]}
                    stroke={windowStroke}
                    strokeWidth={2}
                  />
                  <Line
                    points={[pEnd.x, pEnd.y, bF.x - dir.x * 4, bF.y - dir.y * 4]}
                    stroke="#94a3b8"
                    strokeWidth={0.8}
                    dash={[2, 2]}
                  />
                </>
              );
            })()
          ) : (
            // Ventana Corrediza (2 Hojas Paralelas con solape al centro)
            (() => {
              const solape = 5;
              const wH = openingWidthPx / 2 + solape / 2;
              const h1_start = add(bI, add(scale(dir, 4), scale(v_int, 2)));
              const h1_end = add(bI, add(scale(dir, wH), scale(v_int, 2)));

              const h2_start = sub(bF, add(scale(dir, wH), scale(v_int, 2)));
              const h2_end = sub(bF, add(scale(dir, 4), scale(v_int, 2)));

              return (
                <>
                  <Line points={[h1_start.x, h1_start.y, h1_end.x, h1_end.y]} stroke={windowStroke} strokeWidth={2} />
                  <Line points={[h2_start.x, h2_start.y, h2_end.x, h2_end.y]} stroke={windowStroke} strokeWidth={2} />
                </>
              );
            })()
          )}
        </Group>
      )}

      {/* 4. RENDERIZADO DE VANO LIBRE */}
      {tipo === 'vano' && (
        <Group>
          {/* Dintel en proyección (línea punteada central) */}
          {(() => {
            const midI = scale(add(bI, eI), 0.5);
            const midF = scale(add(bF, eF), 0.5);
            return (
              <Line
                points={[midI.x, midI.y, midF.x, midF.y]}
                stroke={vanoStroke}
                strokeWidth={1.5}
                dash={[5, 4]}
              />
            );
          })()}
        </Group>
      )}

      {/* 5. COTA TÉCNICA Y RÓTULO CAD */}
      {(() => {
        const midPoint = scale(add(bI, bF), 0.5);
        const textPos = add(midPoint, scale(v_int, 10));
        const caption = `${label ? `${label} • ` : ''}${widthMeters.toFixed(2)}m`;

        return (
          <Text
            text={caption}
            x={textPos.x - 20}
            y={textPos.y - 4}
            fontSize={8}
            fontFamily="Outfit, Roboto, sans-serif"
            fontStyle="bold"
            fill={tipo === 'puerta' ? doorStroke : tipo === 'ventana' ? windowStroke : vanoStroke}
            align="center"
            listening={false}
          />
        );
      })()}
    </Group>
  );
};
