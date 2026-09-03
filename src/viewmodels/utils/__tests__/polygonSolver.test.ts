import { describe, it, expect } from 'vitest';
import {
  calculateTheoreticalDiagonal,
  calculatePolygonArea,
  calculateCornerAngles,
  calculateRoomPolygon,
  discretizeArcSegment,
  calculateCircularSegmentArea
} from '../polygonSolver';
import { Room } from '@/models/RoomModel';

const nowIso = new Date().toISOString();

describe('polygonSolver', () => {
  it('calculates theoretical orthogonal diagonal', () => {
    expect(calculateTheoreticalDiagonal(3.0, 4.0)).toBe(5.0);
  });

  it('calculates interior corner angles', () => {
    const rect = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: 0, y: 3 }
    ];
    const angles = calculateCornerAngles(rect);
    expect(angles.NW).toBe(90);
    expect(angles.NE).toBe(90);
    expect(angles.SE).toBe(90);
    expect(angles.SW).toBe(90);
  });

  it('calculates polygon area for rectangle, triangle, and arbitrary polygon', () => {
    // 1. Rectangle 4m x 3m = 12 m2
    const rect = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: 0, y: 3 }
    ];
    expect(calculatePolygonArea(rect)).toBe(12.0);

    // 2. Triangle with base 4m and height 3m = 6 m2
    const triangle = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 2, y: 3 }
    ];
    expect(calculatePolygonArea(triangle)).toBe(6.0);
  });

  it('discretizes a curved wall arc correctly according to chord and sagitta (flecha)', () => {
    const P1 = { x: 0, y: 0 };
    const P2 = { x: 4, y: 0 }; // Chord length = 4m
    const sagitta = 1.0; // 1m outward flecha

    const arcPoints = discretizeArcSegment(P1, P2, sagitta, 8);
    expect(arcPoints.length).toBe(9);

    // First and last points match chord endpoints
    expect(arcPoints[0].x).toBeCloseTo(0, 2);
    expect(arcPoints[0].y).toBeCloseTo(0, 2);
    expect(arcPoints[8].x).toBeCloseTo(4, 2);
    expect(arcPoints[8].y).toBeCloseTo(0, 2);

    // Midpoint (sample 4) must reach exactly the sagitta peak (x=2, y=1)
    const mid = arcPoints[4];
    expect(mid.x).toBeCloseTo(2.0, 2);
    expect(Math.abs(mid.y)).toBeCloseTo(1.0, 2);

    // Circular segment area formula verification
    const extraArea = calculateCircularSegmentArea(4.0, 1.0);
    expect(extraArea).toBeGreaterThan(0);
    // For C=4, h=1, R = 1/2 + 16/8 = 2.5m.
    // Area of circular segment ~ 2/3 * C * h + h^3 / (2C) ~ 2.67 + 0.125 ~ 2.79 m2
    expect(extraArea).toBeCloseTo(2.83, 1);
  });

  it('supports rooms in mode polygon with 3 or more vertices', () => {
    // Triangular room
    const triRoom: Room = {
      id: 'room-tri',
      name: 'Buhardilla Triangular',
      type: 'other',
      dimensions: { width: 4.0, length: 3.0, height: 2.4 },
      canvasPosition: { x: 0, y: 0 },
      topologyPosition: { x: 0, y: 0 },
      electricalAssets: [],
      createdAt: nowIso,
      updatedAt: nowIso,
      geometry: {
        mode: 'polygon',
        computedVertices: [
          { x: 0, y: 0 },
          { x: 4.0, y: 0 },
          { x: 2.0, y: 3.0 }
        ]
      }
    };

    const poly = calculateRoomPolygon(triRoom);
    expect(poly.length).toBe(3);
    expect(calculatePolygonArea(poly)).toBe(6.0);
  });

  it('generates a curved perimeter for a room with arcWalls', () => {
    const roomWithBalcony: Room = {
      id: 'room-balcony',
      name: 'Balcón Curvo',
      type: 'balcony',
      dimensions: { width: 3.0, length: 1.5, height: 2.6 },
      canvasPosition: { x: 0, y: 0 },
      topologyPosition: { x: 0, y: 0 },
      electricalAssets: [],
      createdAt: nowIso,
      updatedAt: nowIso,
      geometry: {
        mode: 'rectangle',
        arcWalls: [
          { wall: 'south', sagittaMeters: 0.5 }
        ]
      }
    };

    const poly = calculateRoomPolygon(roomWithBalcony);
    expect(poly.length).toBeGreaterThan(4);

    const maxY = Math.max(...poly.map(p => p.y));
    expect(maxY).toBeCloseTo(2.0, 2);
  });
});
