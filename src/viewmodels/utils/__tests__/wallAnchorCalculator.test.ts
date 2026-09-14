import { describe, it, expect } from 'vitest';
import {
  calculateWallAnchor,
  getWallSymbolRotation,
  getElementLocalPlacement,
  calculateOpeningPlacement,
  projectOpeningToNeighbor
} from '../wallAnchorCalculator';
import { createElementoElectrico } from '@/models/ElectricalModel';
import { createAbertura } from '@/models/OpeningModel';

describe('wallAnchorCalculator', () => {
  const roomDimensions = { width: 5.0, length: 4.0 };

  describe('calculateWallAnchor', () => {
    it('snaps to North wall when click is close to Y=0', () => {
      const anchor = calculateWallAnchor({ xMeters: 2.5, yMeters: 0.15 }, roomDimensions, 0.35);
      expect(anchor.modo).toBe('pared');
      expect(anchor.wall).toBe('north');
      expect(anchor.distanciaMeters).toBeCloseTo(2.5, 2);
      expect(anchor.lado).toBe('interior');
      expect(anchor.localCoords.xMeters).toBeCloseTo(2.5, 2);
      expect(anchor.localCoords.yMeters).toBe(0);
    });

    it('snaps to South wall when click is close to Y=4.0', () => {
      const anchor = calculateWallAnchor({ xMeters: 2.0, yMeters: 3.9 }, roomDimensions, 0.35);
      expect(anchor.modo).toBe('pared');
      expect(anchor.wall).toBe('south');
      expect(anchor.distanciaMeters).toBeCloseTo(2.0, 2);
      expect(anchor.lado).toBe('interior');
      expect(anchor.localCoords.xMeters).toBeCloseTo(2.0, 2);
      expect(anchor.localCoords.yMeters).toBe(4.0);
    });

    it('snaps to West wall when click is close to X=0', () => {
      const anchor = calculateWallAnchor({ xMeters: 0.1, yMeters: 1.8 }, roomDimensions, 0.35);
      expect(anchor.modo).toBe('pared');
      expect(anchor.wall).toBe('west');
      expect(anchor.distanciaMeters).toBeCloseTo(1.8, 2);
      expect(anchor.lado).toBe('interior');
      expect(anchor.localCoords.xMeters).toBe(0);
      expect(anchor.localCoords.yMeters).toBeCloseTo(1.8, 2);
    });

    it('snaps to East wall when click is close to X=5.0', () => {
      const anchor = calculateWallAnchor({ xMeters: 4.9, yMeters: 2.2 }, roomDimensions, 0.35);
      expect(anchor.modo).toBe('pared');
      expect(anchor.wall).toBe('east');
      expect(anchor.distanciaMeters).toBeCloseTo(2.2, 2);
      expect(anchor.lado).toBe('interior');
      expect(anchor.localCoords.xMeters).toBe(5.0);
      expect(anchor.localCoords.yMeters).toBeCloseTo(2.2, 2);
    });

    it('detects exterior side when click is outside room boundaries', () => {
      const anchor = calculateWallAnchor({ xMeters: 2.5, yMeters: -0.2 }, roomDimensions, 0.35);
      expect(anchor.modo).toBe('pared');
      expect(anchor.wall).toBe('north');
      expect(anchor.lado).toBe('exterior');
    });

    it('falls back to spatial ceiling/floor anchor when click is in middle of room', () => {
      const anchor = calculateWallAnchor({ xMeters: 2.5, yMeters: 2.0 }, roomDimensions, 0.35);
      expect(anchor.modo).toBe('techo');
      expect(anchor.localCoords.xMeters).toBeCloseTo(2.5, 2);
      expect(anchor.localCoords.yMeters).toBeCloseTo(2.0, 2);
    });
  });

  describe('getWallSymbolRotation', () => {
    it('returns 180 deg for North interior wall', () => {
      expect(getWallSymbolRotation('north', 'interior')).toBe(180);
    });

    it('returns 0 deg for South interior wall', () => {
      expect(getWallSymbolRotation('south', 'interior')).toBe(0);
    });

    it('returns 90 deg for West interior wall', () => {
      expect(getWallSymbolRotation('west', 'interior')).toBe(90);
    });

    it('returns 270 deg for East interior wall', () => {
      expect(getWallSymbolRotation('east', 'interior')).toBe(270);
    });

    it('flips rotation by 180 deg for exterior face', () => {
      expect(getWallSymbolRotation('north', 'exterior')).toBe(0);
      expect(getWallSymbolRotation('south', 'exterior')).toBe(180);
    });
  });

  describe('getElementLocalPlacement', () => {
    it('calculates exact placement for a wall-anchored element', () => {
      const el = createElementoElectrico({
        roomId: 'room-1',
        simboloId: 'toma_doble_10a',
        referencia: 'T1',
        anclaje: {
          modo: 'pared',
          pared: { wall: 'north', distanciaMeters: 1.5, lado: 'interior' }
        }
      });

      const placement = getElementLocalPlacement(el, roomDimensions);
      expect(placement.xMeters).toBeCloseTo(1.5, 2);
      expect(placement.yMeters).toBe(0);
      expect(placement.anguloRotacion).toBe(180);
    });

    it('calculates spatial placement for a ceiling luminaire', () => {
      const el = createElementoElectrico({
        roomId: 'room-1',
        simboloId: 'boca_techo_centro',
        referencia: 'B1',
        anclaje: {
          modo: 'techo',
          espacial: { xMeters: 2.5, yMeters: 2.0 }
        }
      });

      const placement = getElementLocalPlacement(el, roomDimensions);
      expect(placement.xMeters).toBeCloseTo(2.5, 2);
      expect(placement.yMeters).toBeCloseTo(2.0, 2);
      expect(placement.anguloRotacion).toBe(0);
    });
  });

  describe('calculateOpeningPlacement', () => {
    it('clamps opening placement so it stays within wall length', () => {
      // Wall length 5.0m, opening width 0.8m -> max position is 4.2m
      const pos = calculateOpeningPlacement('north', 4.8, 0.8, roomDimensions);
      expect(pos).toBeCloseTo(4.2, 2);
    });

    it('prevents negative placement', () => {
      const pos = calculateOpeningPlacement('north', -0.5, 0.8, roomDimensions);
      expect(pos).toBe(0);
    });
  });

  describe('projectOpeningToNeighbor', () => {
    it('projects opening from North wall to opposite South wall of neighbor', () => {
      const ab = createAbertura({
        roomId: 'room-1',
        wall: 'north',
        posicionMeters: 1.2,
        tipo: 'puerta',
        anchoMeters: 0.8
      });

      const targetDim = { width: 5.0, length: 3.5 };
      const proj = projectOpeningToNeighbor(ab, roomDimensions, targetDim, 0);

      expect(proj.targetWall).toBe('south');
      expect(proj.targetPosicionMeters).toBeCloseTo(1.2, 2);
    });
  });
});
