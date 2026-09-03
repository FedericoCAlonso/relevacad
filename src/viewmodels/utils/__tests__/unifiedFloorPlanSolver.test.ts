import { describe, it, expect } from 'vitest';
import { calculateRoomPlanimetry } from '../unifiedFloorPlanSolver';
import { Room } from '@/models/RoomModel';
import { LogicalConnection } from '@/models/GraphModel';
import { metersToPixels } from '../geometryUtils';

const nowIso = new Date().toISOString();

describe('calculateRoomPlanimetry', () => {
  it('preserves non-common exterior wall segments when two rooms share a virtual boundary', () => {
    const roomA: Room = {
      id: 'room-a',
      name: 'Living',
      type: 'living',
      dimensions: { width: 6.0, length: 4.0, height: 2.6 },
      canvasPosition: { x: 0, y: 0 },
      topologyPosition: { x: 0, y: 0 },
      electricalAssets: [],
      createdAt: nowIso,
      updatedAt: nowIso
    };

    const roomB: Room = {
      id: 'room-b',
      name: 'Cocina',
      type: 'kitchen',
      dimensions: { width: 3.5, length: 3.0, height: 2.6 },
      canvasPosition: { x: 0, y: metersToPixels(4.0) },
      topologyPosition: { x: 0, y: 0 },
      electricalAssets: [],
      createdAt: nowIso,
      updatedAt: nowIso
    };

    const connection: LogicalConnection = {
      id: 'conn-ab',
      sourceRoomId: 'room-a',
      targetRoomId: 'room-b',
      type: 'limite_virtual',
      sourceWall: 'south',
      targetWall: 'north',
      isVirtualBoundary: true
    };

    const planimetryA = calculateRoomPlanimetry(roomA, [roomA, roomB], [connection], 0.15);

    expect(planimetryA.south.wall).toBe('south');
    expect(planimetryA.south.isVirtualBoundary).toBe(true);
    expect(planimetryA.south.segments).toBeDefined();

    const virtualSegs = planimetryA.south.segments.filter(s => s.type === 'virtual');
    const solidSegs = planimetryA.south.segments.filter(s => s.type === 'solid_exterior');

    expect(virtualSegs.length).toBe(1);
    expect(virtualSegs[0].startPx).toBeCloseTo(0, 1);
    expect(virtualSegs[0].endPx).toBeCloseTo(metersToPixels(3.5), 1);

    expect(solidSegs.length).toBe(1);
    expect(solidSegs[0].startPx).toBeCloseTo(metersToPixels(3.5), 1);
    expect(solidSegs[0].endPx).toBeCloseTo(metersToPixels(6.0), 1);
    expect(solidSegs[0].thicknessMeters).toBeCloseTo(0.15, 2);
  });

  it('splits wall into 3 segments when a smaller room touches in the middle of a wall', () => {
    const roomA: Room = {
      id: 'room-a',
      name: 'Living',
      type: 'living',
      dimensions: { width: 6.0, length: 4.0, height: 2.6 },
      canvasPosition: { x: 0, y: 0 },
      topologyPosition: { x: 0, y: 0 },
      electricalAssets: [],
      createdAt: nowIso,
      updatedAt: nowIso
    };

    const roomB: Room = {
      id: 'room-b',
      name: 'Cocina',
      type: 'kitchen',
      dimensions: { width: 2.0, length: 3.0, height: 2.6 },
      canvasPosition: { x: metersToPixels(2.0), y: metersToPixels(4.0) },
      topologyPosition: { x: 0, y: 0 },
      electricalAssets: [],
      createdAt: nowIso,
      updatedAt: nowIso
    };

    const connection: LogicalConnection = {
      id: 'conn-ab',
      sourceRoomId: 'room-a',
      targetRoomId: 'room-b',
      type: 'limite_virtual',
      sourceWall: 'south',
      targetWall: 'north',
      isVirtualBoundary: true
    };

    const planimetryA = calculateRoomPlanimetry(roomA, [roomA, roomB], [connection], 0.15);

    const segments = planimetryA.south.segments;
    expect(segments.length).toBe(3);

    expect(segments[0].type).toBe('solid_exterior');
    expect(segments[0].startPx).toBeCloseTo(0, 1);
    expect(segments[0].endPx).toBeCloseTo(metersToPixels(2.0), 1);

    expect(segments[1].type).toBe('virtual');
    expect(segments[1].startPx).toBeCloseTo(metersToPixels(2.0), 1);
    expect(segments[1].endPx).toBeCloseTo(metersToPixels(4.0), 1);

    expect(segments[2].type).toBe('solid_exterior');
    expect(segments[2].startPx).toBeCloseTo(metersToPixels(4.0), 1);
    expect(segments[2].endPx).toBeCloseTo(metersToPixels(6.0), 1);
  });

  it('keeps isolated room with 100% solid exterior walls when has no connections', () => {
    const roomSolo: Room = {
      id: 'room-solo',
      name: 'Dormitorio',
      type: 'bedroom',
      dimensions: { width: 3.0, length: 3.0, height: 2.6 },
      canvasPosition: { x: 0, y: 0 },
      topologyPosition: { x: 0, y: 0 },
      electricalAssets: [],
      createdAt: nowIso,
      updatedAt: nowIso
    };

    const planimetry = calculateRoomPlanimetry(roomSolo, [roomSolo], [], 0.15);

    for (const wall of ['north', 'south', 'east', 'west'] as const) {
      const wallInfo = planimetry[wall];
      expect(wallInfo.segments.length).toBe(1);
      expect(wallInfo.segments[0].type).toBe('solid_exterior');
      expect(wallInfo.segments[0].startPx).toBe(0);
      expect(wallInfo.segments[0].thicknessMeters).toBe(0.15);
    }
  });
});
