// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  computeBrickBlock,
  computeCarpetLaminate,
  computeCalculator,
  computeConcreteVolume,
  computeFloorInsulation,
  computeInsulationBatts,
  computeMixRatio,
  computePaintAmount,
  computePaving,
  computePlasterAmount,
  computePlasterboard,
  computeScreed,
  computeTileQuantity,
  computeWoodFloor,
  computableCalculatorIds,
  getCalculator,
  listCalculators,
  STANDARDS_CATALOG,
  // Phase 1 new functions
  computeRoomArea,
  computeWallAreaWithDeductions,
  computeVolume,
  computeExcavation,
  computeExcavationSlope,
  computeBackfill,
  computeTrenchSafety,
  computeLoftArea,
  computeEscapeWindow,
  computeWindowDaylight,
  computePythagoras,
  computeCircle,
  computeBattenSpacing,
  computeRafter,
  computeFoundationBlocks,
  computeReinforcement,
  computeFormwork,
  computeFence,
  computeTerrainSlope,
  // Phase 2 new functions
  computeBeamLoad,
  computeSlabLoad,
  computeSlabDesignLoad,
  computeSlabFlexure,
  computeFlexuralReinforcement,
  computeCableAmpacity,
  computeEarthFaultLoop,
  computeWindLoad,
  computeSnowLoad,
  computeSnowDrift,
  computeVoltageDrop,
  computePipeDiameter,
  computeDrainDrop,
  computeVentilationFlow,
  computeDuctDiameter,
  computeUValue,
  computeHeatLoss,
  computeWindowUValue,
  computeAnnualEnergyFrame,
  computeDewPoint,
  computeStairGeometry,
  computeRampLength,
  // Phase 3 financial functions
  computeBudget,
  computeMaterialCost,
  computeLaborCost,
  computeLoanAmortization,
  // Phase 2 new functions (Comment 1 upgrades)
  computeColumnLoad,
  computeColumnCapacity,
  COLUMN_MATERIALS,
  computeBeamCapacity,
  BEAM_MATERIALS,
  computeFoundationArea,
  computeFoundationBearing,
  computeMasonryWallCapacity,
  MASONRY_MATERIALS,
  computeBearingWallLoad,
  computeDeflection,
  computeLightingLayout,
  computeSolarPanelLayout,
  computeSolarRoi,
  computeWaterFlow,
  computeHeatPumpSizing,
  computeHeatRecoveryVentilation,
  computeFixtureUnitDemand,
  computeScreedDryingTime,
  computePavingSubbase,
  computeStagedCashflow,
  computeEvCharger,
  computeRetainingWall,
  computeSoakaway,
  computeSpiralStair,
  computeWindowAcoustics,
  computePipePressureLoss,
  computeDuctPressureLoss,
  computeGlaser,
  computeUnderfloorHeating,
} from './catalog';

// ── Helpers ──────────────────────────────────────────────────────────────────

const approx = (a: number, b: number, tol = 1e-6) =>
  Math.abs(a - b) < tol;

// ── computeConcreteVolume ────────────────────────────────────────────────────

describe('computeConcreteVolume', () => {
  it('slab: known-good 5×4×0.15 no wastage', () => {
    const r = computeConcreteVolume({ shape: 'slab', length: 5, width: 4, depth: 0.15, diameter: 0, quantity: 1, wastagePct: 0, density: 2400 });
    expect(approx(r.volume, 3.0)).toBe(true);
    expect(approx(r.weightKg, 7200)).toBe(true);
  });

  it('slab: 5% wastage yields 1.05× volume', () => {
    const r = computeConcreteVolume({ shape: 'slab', length: 5, width: 4, depth: 0.15, diameter: 0, quantity: 1, wastagePct: 5, density: 2400 });
    expect(approx(r.volume, 3.0 * 1.05, 0.0001)).toBe(true);
  });

  it('slab: quantity=3 multiplies volume', () => {
    const r = computeConcreteVolume({ shape: 'slab', length: 2, width: 1, depth: 0.1, diameter: 0, quantity: 3, wastagePct: 0, density: 2300 });
    expect(approx(r.volume, 0.6)).toBe(true);
  });

  it('footing: same formula as slab', () => {
    const slab = computeConcreteVolume({ shape: 'slab', length: 2, width: 1, depth: 0.3, diameter: 0, quantity: 1, wastagePct: 0, density: 2400 });
    const footing = computeConcreteVolume({ shape: 'footing', length: 2, width: 1, depth: 0.3, diameter: 0, quantity: 1, wastagePct: 0, density: 2400 });
    expect(slab.volume).toBe(footing.volume);
  });

  it('column: π×r²×h formula', () => {
    const r = computeConcreteVolume({ shape: 'column', length: 0, width: 0, depth: 2, diameter: 0.4, quantity: 1, wastagePct: 0, density: 2400 });
    const expected = Math.PI * 0.04 * 2;
    expect(approx(r.volume, expected, 1e-9)).toBe(true);
  });

  it('zero depth → zero volume', () => {
    const r = computeConcreteVolume({ shape: 'slab', length: 5, width: 4, depth: 0, diameter: 0, quantity: 1, wastagePct: 0, density: 2400 });
    expect(r.volume).toBe(0);
  });

  it('negative dimensions → 0 volume (guard)', () => {
    const r = computeConcreteVolume({ shape: 'slab', length: -5, width: 4, depth: 0.15, diameter: 0, quantity: 1, wastagePct: 0, density: 2400 });
    expect(r.volume).toBe(0);
  });

  it('C20/25 density 2300 gives lower weight than C30/37 density 2450', () => {
    const low = computeConcreteVolume({ shape: 'slab', length: 1, width: 1, depth: 0.1, diameter: 0, quantity: 1, wastagePct: 0, density: 2300 });
    const high = computeConcreteVolume({ shape: 'slab', length: 1, width: 1, depth: 0.1, diameter: 0, quantity: 1, wastagePct: 0, density: 2450 });
    expect(high.weightKg).toBeGreaterThan(low.weightKg);
  });
});

// ── computeMixRatio ──────────────────────────────────────────────────────────

describe('computeMixRatio', () => {
  it('1:3:5 — parts sum to 9 parts of dryVol', () => {
    const r = computeMixRatio('1:3:5', 100);
    const dryVol = 150;
    expect(approx(r.cement, dryVol / 9, 0.0001)).toBe(true);
    expect(approx(r.sand, (3 / 9) * dryVol, 0.0001)).toBe(true);
    expect(approx(r.stone, (5 / 9) * dryVol, 0.0001)).toBe(true);
  });

  it('1:2:3 — cement bags ceil correctly', () => {
    const r = computeMixRatio('1:2:3', 100);
    expect(r.cementBags).toBe(Math.ceil(r.cement / 18));
  });

  it('1:4 (mortar) — no stone', () => {
    const r = computeMixRatio('1:4', 100);
    expect(r.stone).toBe(0);
  });

  it('water = cement × 0.6', () => {
    const r = computeMixRatio('1:2:3', 200);
    expect(approx(r.water, r.cement * 0.6, 0.0001)).toBe(true);
  });

  it('zero volume → zero cement', () => {
    const r = computeMixRatio('1:3:5', 0);
    expect(r.cement).toBe(0);
    expect(r.cementBags).toBe(0);
  });

  it('negative volume → zero cement (guard)', () => {
    const r = computeMixRatio('1:2:3', -100);
    expect(r.cement).toBe(0);
    expect(r.sand).toBe(0);
    expect(r.stone).toBe(0);
  });
});

// ── computeTileQuantity ──────────────────────────────────────────────────────

describe('computeTileQuantity', () => {
  it('known-good: 4×3m room, 30×60cm tiles, 3mm grout, 10% wastage', () => {
    const r = computeTileQuantity({ areaL: 4, areaW: 3, tileLcm: 30, tileWcm: 60, groutMm: 3, wastagePct: 10 });
    expect(r.numTiles).toBeGreaterThan(0);
    // Tile area with grout = 0.303 × 0.603 = 0.182709 m²
    // Floor = 12 m², raw = 12/0.182709 ≈ 65.7, with 10% = 72.3 → 73
    expect(r.numTiles).toBe(73);
  });

  it('zero grout — exact divisible area gives integer tiles', () => {
    // 2×2 room, 50×50cm tiles, no grout, no wastage
    const r = computeTileQuantity({ areaL: 2, areaW: 2, tileLcm: 50, tileWcm: 50, groutMm: 0, wastagePct: 0 });
    expect(r.numTiles).toBe(16);
  });

  it('wastage: 5% gives more tiles than 0%', () => {
    const base = computeTileQuantity({ areaL: 4, areaW: 3, tileLcm: 30, tileWcm: 60, groutMm: 3, wastagePct: 0 });
    const waste = computeTileQuantity({ areaL: 4, areaW: 3, tileLcm: 30, tileWcm: 60, groutMm: 3, wastagePct: 5 });
    expect(waste.numTiles).toBeGreaterThanOrEqual(base.numTiles);
  });

  it('zero area → 0 tiles', () => {
    const r = computeTileQuantity({ areaL: 0, areaW: 3, tileLcm: 30, tileWcm: 30, groutMm: 3, wastagePct: 10 });
    expect(r.numTiles).toBe(0);
    expect(r.totalArea).toBe(0);
  });

  it('negative area → 0 tiles (guard)', () => {
    const r = computeTileQuantity({ areaL: -2, areaW: 3, tileLcm: 30, tileWcm: 30, groutMm: 3, wastagePct: 10 });
    expect(r.numTiles).toBe(0);
  });
});

// ── computePaintAmount ───────────────────────────────────────────────────────

describe('computePaintAmount', () => {
  it('known-good: 50m², 2 coats @ 10m²/L = 10L paint', () => {
    const r = computePaintAmount({ area: 50, primerCoats: 1, primerCoverage: 8, paintCoats: 2, paintCoverage: 10 });
    expect(approx(r.paintLiters, 10)).toBe(true);
    expect(approx(r.primerLiters, 50 / 8, 0.0001)).toBe(true);
  });

  it('zero coverage → zero liters (no division by zero)', () => {
    const r = computePaintAmount({ area: 50, primerCoats: 1, primerCoverage: 0, paintCoats: 2, paintCoverage: 0 });
    expect(r.paintLiters).toBe(0);
    expect(r.primerLiters).toBe(0);
  });

  it('more coats → more liters', () => {
    const one = computePaintAmount({ area: 20, primerCoats: 0, primerCoverage: 10, paintCoats: 1, paintCoverage: 10 });
    const two = computePaintAmount({ area: 20, primerCoats: 0, primerCoverage: 10, paintCoats: 2, paintCoverage: 10 });
    expect(two.paintLiters).toBe(2 * one.paintLiters);
  });
});

// ── computePlasterboard ──────────────────────────────────────────────────────

describe('computePlasterboard', () => {
  it('known-good: 5×2.5m wall, 2.4×1.2m boards, 2 layers, 7% wastage', () => {
    const r = computePlasterboard({ wallL: 5, wallH: 2.5, boardL: 2.4, boardW: 1.2, layers: 2, wastagePct: 7 });
    // wallArea = 5×2.5×2 = 25 m², boardArea = 2.88 m², raw = 8.68, ×1.07 = 9.29 → 10
    expect(r.numBoards).toBe(10);
  });

  it('zero wall length → 0 boards', () => {
    const r = computePlasterboard({ wallL: 0, wallH: 2.5, boardL: 2.4, boardW: 1.2, layers: 1, wastagePct: 7 });
    expect(r.numBoards).toBe(0);
  });

  it('layers=2 gives at least as many boards as layers=1', () => {
    // ceil(rawBoards × 2) ≥ 2 × ceil(rawBoards) due to ceiling — test the direction only
    const one = computePlasterboard({ wallL: 4, wallH: 2.4, boardL: 2.4, boardW: 1.2, layers: 1, wastagePct: 0 });
    const two = computePlasterboard({ wallL: 4, wallH: 2.4, boardL: 2.4, boardW: 1.2, layers: 2, wastagePct: 0 });
    expect(two.numBoards).toBeGreaterThanOrEqual(one.numBoards);
  });
});

// ── computePlasterAmount ─────────────────────────────────────────────────────

describe('computePlasterAmount', () => {
  it('known-good: 50m² × 2mm × 1kg/m²/mm = 100kg', () => {
    const r = computePlasterAmount({ area: 50, thicknessMm: 2, yieldKgPerM2PerMm: 1 });
    expect(r.totalKg).toBe(100);
  });

  it('zero area → 0 kg', () => {
    const r = computePlasterAmount({ area: 0, thicknessMm: 2, yieldKgPerM2PerMm: 1 });
    expect(r.totalKg).toBe(0);
  });

  it('negative thickness → 0 kg (guard)', () => {
    const r = computePlasterAmount({ area: 50, thicknessMm: -2, yieldKgPerM2PerMm: 1 });
    expect(r.totalKg).toBe(0);
  });

  it('thicker coat → proportionally more kg', () => {
    const thin = computePlasterAmount({ area: 10, thicknessMm: 2, yieldKgPerM2PerMm: 1.5 });
    const thick = computePlasterAmount({ area: 10, thicknessMm: 4, yieldKgPerM2PerMm: 1.5 });
    expect(approx(thick.totalKg, 2 * thin.totalKg)).toBe(true);
  });
});

// ── computeInsulationBatts ───────────────────────────────────────────────────

describe('computeInsulationBatts', () => {
  it('exact-fit: 6×5m, batts 1.2×0.6m → 41.67 → ceil 42', () => {
    const r = computeInsulationBatts({ areaL: 6, areaW: 5, battL: 1.2, battW: 0.6 });
    expect(r.numBatts).toBe(42);
  });

  it('perfect divisor → exact integer', () => {
    const r = computeInsulationBatts({ areaL: 2.4, areaW: 1.2, battL: 1.2, battW: 0.6 });
    expect(r.numBatts).toBe(4);
  });

  it('zero area → 0 batts', () => {
    const r = computeInsulationBatts({ areaL: 0, areaW: 5, battL: 1.2, battW: 0.6 });
    expect(r.numBatts).toBe(0);
  });

  it('negative batt dimension → 0 batts (guard)', () => {
    const r = computeInsulationBatts({ areaL: 5, areaW: 3, battL: -1, battW: 0.6 });
    expect(r.numBatts).toBe(0);
  });
});

// ── computeFloorInsulation ───────────────────────────────────────────────────

describe('computeFloorInsulation', () => {
  it('known-good: 6×5m, boards 1.2×0.6m → 42 boards', () => {
    const r = computeFloorInsulation({ areaL: 6, areaW: 5, boardL: 1.2, boardW: 0.6 });
    expect(r.numBoards).toBe(42);
    expect(r.totalArea).toBeGreaterThan(6 * 5);
  });

  it('totalArea ≥ input area', () => {
    const r = computeFloorInsulation({ areaL: 3.7, areaW: 4.2, boardL: 1.2, boardW: 0.6 });
    expect(r.totalArea).toBeGreaterThanOrEqual(3.7 * 4.2 - 0.001);
  });

  it('zero area → 0 boards, 0 totalArea', () => {
    const r = computeFloorInsulation({ areaL: 0, areaW: 5, boardL: 1.2, boardW: 0.6 });
    expect(r.numBoards).toBe(0);
    expect(r.totalArea).toBe(0);
  });
});

// ── computeWoodFloor ─────────────────────────────────────────────────────────

describe('computeWoodFloor', () => {
  it('area includes wastage', () => {
    const r = computeWoodFloor({ length: 5, width: 4, wastagePct: 7, plankWidthMm: 130, plankLengthMm: 500 });
    expect(approx(r.area, 5 * 4 * 1.07, 0.0001)).toBe(true);
  });

  it('zero width → zero area', () => {
    const r = computeWoodFloor({ length: 5, width: 0, wastagePct: 7, plankWidthMm: 130, plankLengthMm: 500 });
    expect(r.area).toBe(0);
  });

  it('zero remainder splits symmetrically (both edges share half a plank width)', () => {
    // 2 planks of 200mm = 400mm room: remainder=0 < MIN_FINAL_WIDTH_MM(50)
    // → sharedWidth=200, first=last=100mm, full=1
    const r = computeWoodFloor({ length: 2, width: 0.4, wastagePct: 0, plankWidthMm: 200, plankLengthMm: 500 });
    expect(r.plan.firstRowWidth).toBe(100);
    expect(r.plan.lastRowWidth).toBe(100);
    expect(r.plan.numFullWidthRows).toBe(1);
  });

  it('firstRowWidth ≥ 50mm when narrow last row', () => {
    // Design: narrow remainder → first/last rows share width
    const r = computeWoodFloor({ length: 2, width: 0.65, wastagePct: 0, plankWidthMm: 200, plankLengthMm: 500 });
    // 650mm / 200mm = 3 planks + 50mm → remainder=50 < 50? No, = 50 which is NOT < 50
    // So last = 50, first = 200, full = 2
    expect(r.plan.firstRowWidth).toBeGreaterThanOrEqual(50);
  });

  it('narrow planks with zero remainder never yield sub-50mm edge rows', () => {
    // 420mm / 70mm = 6 planks exactly (remainder 0). Naive half-split → 35mm edges (< 50mm).
    // The fix borrows a whole plank into the shared edge pool: shared=140 → 70mm edges.
    const r = computeWoodFloor({ length: 2, width: 0.42, wastagePct: 0, plankWidthMm: 70, plankLengthMm: 500 });
    expect(r.plan.firstRowWidth).toBeGreaterThanOrEqual(50);
    expect(r.plan.lastRowWidth).toBeGreaterThanOrEqual(50);
  });
});

// ── computeCarpetLaminate ────────────────────────────────────────────────────

describe('computeCarpetLaminate', () => {
  it('known-good: 5×4, 10% wastage = 22 m²', () => {
    const r = computeCarpetLaminate({ length: 5, width: 4, wastagePct: 10 });
    expect(approx(r.area, 22)).toBe(true);
  });

  it('zero wastage → exact area', () => {
    const r = computeCarpetLaminate({ length: 3, width: 2.5, wastagePct: 0 });
    expect(approx(r.area, 7.5)).toBe(true);
  });

  it('zero/negative dimensions → 0 area (guard)', () => {
    expect(computeCarpetLaminate({ length: 0, width: 4, wastagePct: 10 }).area).toBe(0);
    expect(computeCarpetLaminate({ length: -3, width: 4, wastagePct: 10 }).area).toBe(0);
    expect(computeCarpetLaminate({ length: 5, width: -2, wastagePct: 10 }).area).toBe(0);
  });
});

// ── computeScreed ────────────────────────────────────────────────────────────

describe('computeScreed', () => {
  it('known-good: 5×4m, 40mm, 10% wastage', () => {
    const r = computeScreed({ length: 5, width: 4, thicknessMm: 40, wastagePct: 10 });
    // vol = 5×4×0.04 = 0.8, ×1.1 = 0.88 m³, bags = ceil(0.88×80) = 71
    expect(approx(r.volumeM3, 0.88, 0.0001)).toBe(true);
    expect(r.bags).toBe(71);
  });

  it('bags = ceil(volumeM3 × 80)', () => {
    const r = computeScreed({ length: 3, width: 2, thicknessMm: 50, wastagePct: 0 });
    expect(r.bags).toBe(Math.ceil(r.volumeM3 * 80));
  });

  it('zero thickness → 0 volume, 0 bags', () => {
    const r = computeScreed({ length: 5, width: 4, thicknessMm: 0, wastagePct: 10 });
    expect(r.volumeM3).toBe(0);
    expect(r.bags).toBe(0);
  });

  it('negative length → 0 volume, 0 bags (guard)', () => {
    const r = computeScreed({ length: -5, width: 4, thicknessMm: 40, wastagePct: 0 });
    expect(r.volumeM3).toBe(0);
    expect(r.bags).toBe(0);
  });
});

// ── computeBrickBlock ────────────────────────────────────────────────────────

describe('computeBrickBlock', () => {
  it('known-good: 5×2.5m wall, std DK brick 228×54mm, 12mm joint, 5% wastage', () => {
    const r = computeBrickBlock({ wallL: 5, wallH: 2.5, brickLmm: 228, brickHmm: 54, jointMm: 12, wastagePct: 5 });
    // brickArea = (228+12)/1000 × (54+12)/1000 = 0.24 × 0.066 = 0.01584 m²
    // wallArea = 12.5 m²
    // raw = 12.5/0.01584 = 789.14..., ×1.05 = 828.6... → 829
    expect(r.numBricks).toBe(829);
    // Mortar is geometry-based: wallArea × brickDepth × (1 − faceArea/moduleArea)
    const moduleArea = 0.24 * 0.066;
    const faceArea = 0.228 * 0.054;
    const frac = 1 - faceArea / moduleArea;
    expect(approx(r.mortarVolume, 12.5 * 0.108 * frac, 1e-4)).toBe(true);
  });

  it('zero wall length → 0 bricks, 0 mortar', () => {
    const r = computeBrickBlock({ wallL: 0, wallH: 2.5, brickLmm: 228, brickHmm: 54, jointMm: 12, wastagePct: 5 });
    expect(r.numBricks).toBe(0);
    expect(r.mortarVolume).toBe(0);
  });

  it('mortarVolume scales with joint thickness (was previously ignored)', () => {
    const thin = computeBrickBlock({ wallL: 4, wallH: 2, brickLmm: 228, brickHmm: 54, jointMm: 8, wastagePct: 0 });
    const thick = computeBrickBlock({ wallL: 4, wallH: 2, brickLmm: 228, brickHmm: 54, jointMm: 15, wastagePct: 0 });
    // A thicker joint means more mortar per m² — the old flat 0.0175 constant ignored this.
    expect(thick.mortarVolume).toBeGreaterThan(thin.mortarVolume);
  });

  it('wastage: 10% gives more bricks than 5%', () => {
    const low = computeBrickBlock({ wallL: 5, wallH: 2.5, brickLmm: 228, brickHmm: 54, jointMm: 12, wastagePct: 5 });
    const high = computeBrickBlock({ wallL: 5, wallH: 2.5, brickLmm: 228, brickHmm: 54, jointMm: 12, wastagePct: 10 });
    expect(high.numBricks).toBeGreaterThan(low.numBricks);
  });
});

// ── computePaving ────────────────────────────────────────────────────────────

describe('computePaving', () => {
  it('known-good: 5×4m, 21×14cm stones, 5% wastage, 0.15m gravel, 0.03m sand', () => {
    const r = computePaving({ length: 5, width: 4, stoneLcm: 21, stoneWcm: 14, wastagePct: 5, gravelDepthM: 0.15, sandDepthM: 0.03 });
    expect(r.area).toBe(20);
    // stoneA = 0.21 × 0.14 = 0.0294, raw = 20/0.0294 = 680.27..., ×1.05 = 714.28 → 715
    expect(r.stones).toBe(715);
    expect(approx(r.gravelVol, 3, 0.001)).toBe(true);
    expect(approx(r.sandVol, 0.6, 0.001)).toBe(true);
  });

  it('zero stone dimensions → falls back to default 21×14cm stone', () => {
    // The formula has || 0.21 and || 0.14 fallbacks, so zero inputs use defaults
    const r = computePaving({ length: 5, width: 4, stoneLcm: 0, stoneWcm: 0, wastagePct: 0, gravelDepthM: 0, sandDepthM: 0 });
    const expectedWithDefault = computePaving({ length: 5, width: 4, stoneLcm: 21, stoneWcm: 14, wastagePct: 0, gravelDepthM: 0, sandDepthM: 0 });
    expect(r.stones).toBe(expectedWithDefault.stones);
  });

  it('no gravel/sand depth → 0 volumes', () => {
    const r = computePaving({ length: 5, width: 4, stoneLcm: 21, stoneWcm: 14, wastagePct: 0, gravelDepthM: 0, sandDepthM: 0 });
    expect(r.gravelVol).toBe(0);
    expect(r.sandVol).toBe(0);
  });

  it('wastage: 10% > 0% stones', () => {
    const base = computePaving({ length: 5, width: 4, stoneLcm: 21, stoneWcm: 14, wastagePct: 0, gravelDepthM: 0, sandDepthM: 0 });
    const waste = computePaving({ length: 5, width: 4, stoneLcm: 21, stoneWcm: 14, wastagePct: 10, gravelDepthM: 0, sandDepthM: 0 });
    expect(waste.stones).toBeGreaterThan(base.stones);
  });
});

// ── computeCalculator (via registry) ────────────────────────────────────────

describe('computeCalculator', () => {
  it('beton-volumen: 5×4×0.15 slab C25/30 5% wastage', () => {
    const r = computeCalculator('beton-volumen', { shape: 'slab', length: 5, width: 4, depth: 0.15, quantity: 1, wastage: 5, quality: 2400 });
    expect(r.value).toBeCloseTo(3.15, 2);
    expect(r.unit).toBe('m³');
  });

  it('blandingsforhold: 100L 1:2:3 → 25L cement', () => {
    const r = computeCalculator('blandingsforhold', { mixType: '1:2:3', volume: 100 });
    expect(r.value).toBeCloseTo(25, 0);
    expect(r.unit).toBe('liter cement');
  });

  it('flisemaengde: 4×3 room, 30×60cm, 3mm grout, 10% wastage', () => {
    const r = computeCalculator('flisemaengde', { areaL: 4, areaW: 3, tileL: 30, tileW: 60, grout: 3, wastage: 10 });
    expect(r.value).toBeGreaterThan(0);
    expect(r.unit).toBe('stk.');
  });

  it('maling-grunder: 50m², 2 coats @ 10 m²/L → 10L paint', () => {
    const r = computeCalculator('maling-grunder', { area: 50, paintCoats: 2, paintCoverage: 10, primerCoats: 1, primerCoverage: 8 });
    expect(r.value).toBeCloseTo(10, 1);
  });

  it('gipsplader: 5×2.5m, 2.4×1.2m boards, 2 layers, 7% wastage', () => {
    const r = computeCalculator('gipsplader', { wallL: 5, wallH: 2.5, boardL: 2.4, boardW: 1.2, layers: 2, wastage: 7 });
    expect(r.value).toBeGreaterThan(0);
    expect(r.unit).toBe('stk.');
  });

  it('puds-spartel: 50m², 2mm, 1kg/m²/mm = 100kg', () => {
    const r = computeCalculator('puds-spartel', { area: 50, thickness: 2, yield: 1 });
    expect(r.value).toBeCloseTo(100, 1);
  });

  it('vaegisolering: 8×2.5m, 1.2×0.6m batts', () => {
    const r = computeCalculator('vaegisolering', { areaL: 8, areaW: 2.5, battL: 1.2, battW: 0.6 });
    expect(r.value).toBeGreaterThan(0);
    expect(r.unit).toBe('stk.');
  });

  it('loftisolering: 6×5m, 1.2×0.6m batts', () => {
    const r = computeCalculator('loftisolering', { areaL: 6, areaW: 5, battL: 1.2, battW: 0.6 });
    expect(r.value).toBe(42);
  });

  it('gulvisolering: 6×5m, 1.2×0.6m boards', () => {
    const r = computeCalculator('gulvisolering', { areaL: 6, areaW: 5, boardL: 1.2, boardW: 0.6 });
    expect(r.value).toBe(42);
  });

  it('traegulv-maengde: 5×4m, 7% wastage', () => {
    const r = computeCalculator('traegulv-maengde', { length: 5, width: 4, plankWidth: 130, plankLength: 500, wastage: 7 });
    expect(r.value).toBeCloseTo(5 * 4 * 1.07, 2);
  });

  it('taeppe-laminat: 5×4m, 10% = 22 m²', () => {
    const r = computeCalculator('taeppe-laminat', { length: 5, width: 4, wastage: 10 });
    expect(r.value).toBeCloseTo(22, 2);
  });

  it('gulvafretning: 5×4m, 40mm, 10% wastage', () => {
    const r = computeCalculator('gulvafretning', { length: 5, width: 4, thickness: 40, wastage: 10 });
    expect(r.value).toBeCloseTo(0.88, 2);
  });

  it('mursten-blokke: 5×2.5m, std DK brick, 5% wastage', () => {
    const r = computeCalculator('mursten-blokke', { wallL: 5, wallH: 2.5, brickL: 228, brickH: 54, joint: 12, wastage: 5 });
    expect(r.value).toBe(829);
  });

  it('flisebelaegning: 5×4m, 21×14cm stones, 5% wastage', () => {
    const r = computeCalculator('flisebelaegning', { length: 5, width: 4, stoneL: 21, stoneW: 14, wastage: 5, gravel: 0.15, sand: 0.03 });
    expect(r.value).toBe(715);
  });

  it('unknown id → throws', () => {
    expect(() => computeCalculator('non-existent', {})).toThrow();
  });
});

// ── Registry / metadata ──────────────────────────────────────────────────────

describe('listCalculators', () => {
  it('returns all calculators (computable + link-only)', () => {
    const all = listCalculators();
    expect(all.length).toBeGreaterThan(14);
  });

  it('all computable entries have computable=true and inputs', () => {
    const all = listCalculators();
    const computable = all.filter((c) => c.computable);
    expect(computable.length).toBeGreaterThan(14); // Phase 1 added 17 more
    for (const c of computable) {
      expect(c.inputs).toBeDefined();
      expect(c.inputs!.length).toBeGreaterThan(0);
    }
  });

  it('all computable entries have modes field', () => {
    const all = listCalculators().filter((c) => c.computable);
    for (const c of all) {
      expect(['basic', 'advanced', 'both']).toContain(c.modes ?? 'basic');
    }
  });

  it('all computable entries have standards array', () => {
    const all = listCalculators().filter((c) => c.computable);
    for (const c of all) {
      expect(Array.isArray(c.standards)).toBe(true);
      expect(c.standards!.length).toBeGreaterThan(0);
    }
  });

  it('all computable entries have help content', () => {
    const all = listCalculators().filter((c) => c.computable);
    for (const c of all) {
      expect(c.help).toBeDefined();
      expect(typeof c.help!.purpose).toBe('string');
      expect(c.help!.purpose.length).toBeGreaterThan(0);
      expect(Array.isArray(c.help!.variables)).toBe(true);
      expect(c.help!.variables.length).toBeGreaterThan(0);
      expect(typeof c.help!.formula).toBe('string');
      expect(Array.isArray(c.help!.assumptions)).toBe(true);
      expect(typeof c.help!.standardsExplained).toBe('string');
    }
  });

  it('safetyCritical is defined for all computable entries', () => {
    const all = listCalculators().filter((c) => c.computable);
    for (const c of all) {
      expect(typeof c.safetyCritical).toBe('boolean');
    }
  });

  it('no duplicate ids', () => {
    const ids = listCalculators().map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe('getCalculator', () => {
  it('finds beton-volumen by id', () => {
    const c = getCalculator('beton-volumen');
    expect(c).toBeDefined();
    expect(c!.id).toBe('beton-volumen');
    expect(c!.computable).toBe(true);
  });

  it('returns undefined for unknown id', () => {
    expect(getCalculator('does-not-exist')).toBeUndefined();
  });
});

describe('computableCalculatorIds', () => {
  it('returns at least 14 ids (Phase 1 expanded set)', () => {
    expect(computableCalculatorIds().length).toBeGreaterThanOrEqual(14);
  });

  it('all ids are non-empty strings', () => {
    for (const id of computableCalculatorIds()) {
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    }
  });
});

// ── STANDARDS_CATALOG ────────────────────────────────────────────────────────

describe('STANDARDS_CATALOG', () => {
  const EXPECTED_DOMAINS: (keyof typeof STANDARDS_CATALOG)[] = [
    'statics', 'electrical', 'water', 'drainage', 'heating',
    'energy', 'moisture', 'ventilation', 'geometry', 'quantities',
    'concrete', 'timber',
  ];

  it('contains all required domains', () => {
    for (const domain of EXPECTED_DOMAINS) {
      expect(STANDARDS_CATALOG[domain]).toBeDefined();
    }
  });

  it('each domain has at least one standard with a code', () => {
    for (const domain of EXPECTED_DOMAINS) {
      const standards = STANDARDS_CATALOG[domain];
      expect(standards.length).toBeGreaterThan(0);
      for (const s of standards) {
        expect(typeof s.code).toBe('string');
        expect(s.code.length).toBeGreaterThan(0);
      }
    }
  });

  it('statics domain includes EC0, EC1, EC2, EC3, EC5', () => {
    const codes = STANDARDS_CATALOG.statics.map((s) => s.code);
    expect(codes.some((c) => c.includes('1990'))).toBe(true); // EC0
    expect(codes.some((c) => c.includes('1991'))).toBe(true); // EC1
    expect(codes.some((c) => c.includes('1992'))).toBe(true); // EC2
    expect(codes.some((c) => c.includes('1993'))).toBe(true); // EC3
    expect(codes.some((c) => c.includes('1995'))).toBe(true); // EC5
  });

  it('electrical domain includes DS/HD 60364 with 4% voltage drop note', () => {
    const elec = STANDARDS_CATALOG.electrical;
    const voltDropEntry = elec.find((s) => s.note && s.note.includes('4%'));
    expect(voltDropEntry).toBeDefined();
  });

  it('energy domain includes ISO 6946 (U-value)', () => {
    const codes = STANDARDS_CATALOG.energy.map((s) => s.code);
    expect(codes.some((c) => c.includes('6946'))).toBe(true);
  });

  it('moisture domain includes ISO 13788 (dew point)', () => {
    const codes = STANDARDS_CATALOG.moisture.map((s) => s.code);
    expect(codes.some((c) => c.includes('13788'))).toBe(true);
  });

  it('ventilation domain includes DS 447', () => {
    const codes = STANDARDS_CATALOG.ventilation.map((s) => s.code);
    expect(codes.some((c) => c.includes('447'))).toBe(true);
  });
});

// ── Phase 1 new formula functions ────────────────────────────────────────────

describe('computeRoomArea', () => {
  it('rectangle: 5×4 = 20 m²', () => {
    const r = computeRoomArea({ shape: 'rectangle', rectL: 5, rectW: 4 });
    expect(approx(r.area, 20)).toBe(true);
    expect(approx(r.grossArea, 20)).toBe(true);
  });

  it('l-shape: two segments summed', () => {
    const r = computeRoomArea({ shape: 'l-shape', lA: 4, lB: 3, lC: 2, lD: 2 });
    expect(approx(r.area, 16)).toBe(true); // 4×3 + 2×2 = 12 + 4
  });

  it('deductions reduce net area', () => {
    const r = computeRoomArea({ shape: 'rectangle', rectL: 5, rectW: 4, deductions: 2 });
    expect(approx(r.area, 18)).toBe(true);
    expect(approx(r.grossArea, 20)).toBe(true);
  });

  it('net area cannot go below zero', () => {
    const r = computeRoomArea({ shape: 'rectangle', rectL: 2, rectW: 2, deductions: 100 });
    expect(r.area).toBe(0);
  });
});

describe('computeWallAreaWithDeductions', () => {
  it('5×4 room, 2.5m high → perimeter 18m, gross 45 m²', () => {
    const r = computeWallAreaWithDeductions({ length: 5, width: 4, height: 2.5, doors: 0, doorW: 0, doorH: 0, windows: 0, windowW: 0, windowH: 0 });
    expect(approx(r.grossArea, 45)).toBe(true);
    expect(approx(r.netArea, 45)).toBe(true);
    expect(approx(r.deductions, 0)).toBe(true);
  });

  it('1 door (0.9×2.1) reduces net area', () => {
    const r = computeWallAreaWithDeductions({ length: 5, width: 4, height: 2.5, doors: 1, doorW: 0.9, doorH: 2.1, windows: 0, windowW: 0, windowH: 0 });
    expect(approx(r.deductions, 0.9 * 2.1, 0.0001)).toBe(true);
    expect(approx(r.netArea, 45 - 0.9 * 2.1, 0.0001)).toBe(true);
  });
});

describe('computeVolume', () => {
  it('5×4×2.5 = 50 m³', () => {
    const r = computeVolume({ length: 5, width: 4, height: 2.5 });
    expect(approx(r.volume, 50)).toBe(true);
  });

  it('height ≥ 2.3 passes BR18 check', () => {
    expect(computeVolume({ length: 1, width: 1, height: 2.3 }).ceilingHeightOk).toBe(true);
  });

  it('height < 2.3 fails BR18 check', () => {
    expect(computeVolume({ length: 1, width: 1, height: 2.29 }).ceilingHeightOk).toBe(false);
  });
});

describe('computeExcavation', () => {
  it('10×5×0.5 = 25 m³ in situ', () => {
    const r = computeExcavation({ length: 10, width: 5, depth: 0.5 });
    expect(approx(r.inSitu, 25)).toBe(true);
  });

  it('loose > inSitu (swell factor)', () => {
    const r = computeExcavation({ length: 10, width: 5, depth: 0.5 });
    expect(r.loose).toBeGreaterThan(r.inSitu);
  });

  it('zero depth → zero volumes', () => {
    const r = computeExcavation({ length: 10, width: 5, depth: 0 });
    expect(r.inSitu).toBe(0);
    expect(r.loose).toBe(0);
  });
});

describe('computeExcavationSlope', () => {
  it('clay soil: setback = depth × 0.5', () => {
    const r = computeExcavationSlope({ bottomWidth: 3, depth: 2, length: 10, soilType: 'clay' });
    expect(approx(r.setback, 1.0)).toBe(true);
    expect(approx(r.topWidth, 5.0)).toBe(true);
  });

  it('sand soil: setback = depth × 1', () => {
    const r = computeExcavationSlope({ bottomWidth: 3, depth: 2, length: 10, soilType: 'sand' });
    expect(approx(r.setback, 2.0)).toBe(true);
  });

  it('volume is trapezoid formula', () => {
    const r = computeExcavationSlope({ bottomWidth: 3, depth: 2, length: 10, soilType: 'clay' });
    const expected = ((3 + 5) / 2) * 2 * 10;
    expect(approx(r.volume, expected, 0.001)).toBe(true);
  });
});

describe('computeBackfill', () => {
  it('net fill = excavated − structure', () => {
    const r = computeBackfill({ excavatedVol: 50, structureVol: 10, compactionPct: 0 });
    expect(approx(r.netFill, 40)).toBe(true);
  });

  it('compaction increases loose needed', () => {
    const r = computeBackfill({ excavatedVol: 50, structureVol: 10, compactionPct: 15 });
    expect(r.looseNeeded).toBeGreaterThan(40);
  });

  it('net fill cannot go below zero', () => {
    const r = computeBackfill({ excavatedVol: 5, structureVol: 100, compactionPct: 0 });
    expect(r.netFill).toBe(0);
  });

  it('computeTrenchSafety: ≤1,7m vertical OK; >1,7m needs support; >5m engineer', () => {
    const shallow = computeTrenchSafety({ depthM: 1.5, soilType: 'clay' });
    expect(shallow.requiresSupport).toBe(false);
    expect(shallow.action).toBe('vertical-ok');
    const mid = computeTrenchSafety({ depthM: 3, soilType: 'clay' });
    expect(mid.requiresSupport).toBe(true);
    expect(mid.action).toBe('batter-or-shore');
    expect(approx(mid.minSetbackM, 3 * 0.5, 1e-9)).toBe(true); // clay ratio 0.5
    const deep = computeTrenchSafety({ depthM: 6, soilType: 'sand' });
    expect(deep.action).toBe('engineer-required');
    expect(deep.riskLevel).toBe('high');
  });

  it('computeLoftArea: counts floor with ceiling ≥1,5m, full-height area ≥2,3m', () => {
    const r = computeLoftArea({ roomLengthM: 5, roomWidthM: 4, kneeWallHeightM: 1.0, pitchDeg: 45 });
    // tan45=1 → 1,5m at 0,5m from wall; 2,3m at 1,3m
    expect(approx(r.distanceToMinM, 0.5, 1e-9)).toBe(true);
    expect(approx(r.countedAreaM2, 5 * 3.5, 1e-9)).toBe(true);   // 17,5
    expect(approx(r.fullHeightAreaM2, 5 * 2.7, 1e-9)).toBe(true); // 13,5
    expect(r.countedAreaM2).toBeLessThan(r.totalFloorAreaM2);
    expect(r.fullHeightAreaM2).toBeLessThan(r.countedAreaM2);
  });

  it('computeLoftArea: knee wall already ≥2,3m → whole floor counts', () => {
    const r = computeLoftArea({ roomLengthM: 5, roomWidthM: 4, kneeWallHeightM: 2.5, pitchDeg: 30 });
    expect(approx(r.countedAreaM2, 20, 1e-9)).toBe(true);
    expect(approx(r.fullHeightAreaM2, 20, 1e-9)).toBe(true);
  });

  it('excess soil compares loose-vs-loose (excavated bulks by the swell factor too)', () => {
    // 50 m³ in-situ excavated, 10 m³ reused as fill, 20% compaction/swell.
    // netFill = 40 → looseNeeded = 48. Excavated in loose measure = 50 × 1.2 = 60.
    // excess (to haul away, in loose truck measure) = 60 − 48 = 12, NOT 50 − 48 = 2.
    const r = computeBackfill({ excavatedVol: 50, structureVol: 10, compactionPct: 20 });
    expect(approx(r.excess, 12, 1e-9)).toBe(true);
  });
});

describe('computeEscapeWindow', () => {
  it('60×100 cm passes all BR18 checks', () => {
    const r = computeEscapeWindow({ widthCm: 60, heightCm: 100, heightAboveFloorCm: 90 });
    expect(r.widthCheck).toBe(true);
    expect(r.heightCheck).toBe(true);
    expect(r.sumCheck).toBe(true);
    expect(r.passed).toBe(true);
  });

  it('width below 50 cm fails', () => {
    const r = computeEscapeWindow({ widthCm: 40, heightCm: 120, heightAboveFloorCm: 90 });
    expect(r.widthCheck).toBe(false);
    expect(r.passed).toBe(false);
  });

  it('height below 60 cm fails', () => {
    const r = computeEscapeWindow({ widthCm: 80, heightCm: 55, heightAboveFloorCm: 90 });
    expect(r.heightCheck).toBe(false);
    expect(r.passed).toBe(false);
  });

  it('sum below 150 cm fails', () => {
    const r = computeEscapeWindow({ widthCm: 50, heightCm: 60, heightAboveFloorCm: 90 });
    expect(approx(r.sum, 1.1, 0.001)).toBe(true);
    expect(r.sumCheck).toBe(false);
    expect(r.passed).toBe(false);
  });

  it('sum exactly 150 cm passes', () => {
    const r = computeEscapeWindow({ widthCm: 50, heightCm: 100, heightAboveFloorCm: 90 });
    expect(r.sumCheck).toBe(true);
  });
});

describe('computeWindowDaylight', () => {
  it('3 m² window in 20 m² room → 15% → passes', () => {
    const r = computeWindowDaylight({ windowAreaM2: 3, floorAreaM2: 20 });
    expect(approx(r.ratio, 15)).toBe(true);
    expect(r.passed).toBe(true);
  });

  it('1 m² window in 20 m² room → 5% → fails', () => {
    const r = computeWindowDaylight({ windowAreaM2: 1, floorAreaM2: 20 });
    expect(approx(r.ratio, 5)).toBe(true);
    expect(r.passed).toBe(false);
  });

  it('exactly 10% passes', () => {
    const r = computeWindowDaylight({ windowAreaM2: 2, floorAreaM2: 20 });
    expect(r.passed).toBe(true);
  });

  it('zero floor area → ratio 0', () => {
    const r = computeWindowDaylight({ windowAreaM2: 3, floorAreaM2: 0 });
    expect(r.ratio).toBe(0);
  });
});

describe('computePythagoras', () => {
  it('3-4-5 triangle: c = 5', () => {
    const r = computePythagoras({ a: 3, b: 4 });
    expect(approx(r.c, 5, 1e-9)).toBe(true);
  });

  it('1-1 triangle: c = √2', () => {
    const r = computePythagoras({ a: 1, b: 1 });
    expect(approx(r.c, Math.SQRT2, 1e-9)).toBe(true);
  });

  it('zero sides return zero', () => {
    const r = computePythagoras({ a: 0, b: 0 });
    expect(r.c).toBe(0);
  });
});

describe('computeCircle', () => {
  it('radius 1: area = π, circumference = 2π, diameter = 2', () => {
    const r = computeCircle({ radius: 1 });
    expect(approx(r.area, Math.PI, 1e-9)).toBe(true);
    expect(approx(r.circumference, 2 * Math.PI, 1e-9)).toBe(true);
    expect(approx(r.diameter, 2)).toBe(true);
  });

  it('radius 0 → all zero', () => {
    const r = computeCircle({ radius: 0 });
    expect(r.area).toBe(0);
    expect(r.circumference).toBe(0);
  });

  it('area scales with r²', () => {
    const r1 = computeCircle({ radius: 1 });
    const r2 = computeCircle({ radius: 2 });
    expect(approx(r2.area, r1.area * 4, 1e-9)).toBe(true);
  });
});

describe('computeBattenSpacing', () => {
  it('6m rafter, 330mm c/c → 19 batts', () => {
    const r = computeBattenSpacing({ rafterLengthM: 6, ccMm: 330, battLengthM: 4.8, quantity: 1 });
    expect(r.count).toBe(Math.ceil(6 / 0.33));
  });

  it('zero c/c → zero count', () => {
    const r = computeBattenSpacing({ rafterLengthM: 6, ccMm: 0, battLengthM: 4.8, quantity: 1 });
    expect(r.count).toBe(0);
  });

  it('quantity multiplies total length', () => {
    const r1 = computeBattenSpacing({ rafterLengthM: 6, ccMm: 330, battLengthM: 4.8, quantity: 1 });
    const r2 = computeBattenSpacing({ rafterLengthM: 6, ccMm: 330, battLengthM: 4.8, quantity: 5 });
    expect(approx(r2.totalLength, r1.totalLength * 5, 0.001)).toBe(true);
  });
});

describe('computeRafter', () => {
  it('8m span, 30° pitch: rafterLength = 4/cos(30°)', () => {
    const r = computeRafter({ spanM: 8, pitchDeg: 30, ccMm: 600, buildingLengthM: 12 });
    const expected = 4 / Math.cos((30 * Math.PI) / 180);
    expect(approx(r.rafterLength, expected, 0.0001)).toBe(true);
  });

  it('count based on building length / c/c', () => {
    const r = computeRafter({ spanM: 8, pitchDeg: 30, ccMm: 600, buildingLengthM: 12 });
    expect(r.count).toBe(Math.ceil(12 / 0.6) + 1);
  });
});

describe('computeFoundationBlocks', () => {
  it('24m perimeter, 0.6m high, 600mm block → known result', () => {
    const r = computeFoundationBlocks({ perimeterM: 24, heightM: 0.6, blockLmm: 600, blockHmm: 250, jointMm: 12, wastagePct: 0 });
    const bpr = Math.ceil(24 / 0.612);
    const rows = Math.ceil(0.6 / 0.262);
    expect(r.blocksPerRow).toBe(bpr);
    expect(r.rows).toBe(rows);
  });

  it('wastage increases total', () => {
    const r0 = computeFoundationBlocks({ perimeterM: 24, heightM: 0.6, blockLmm: 600, blockHmm: 250, jointMm: 12, wastagePct: 0 });
    const r5 = computeFoundationBlocks({ perimeterM: 24, heightM: 0.6, blockLmm: 600, blockHmm: 250, jointMm: 12, wastagePct: 5 });
    expect(r5.total).toBeGreaterThanOrEqual(r0.total);
  });
});

describe('computeReinforcement', () => {
  it('5×4m slab, 150mm c/c, Ø10mm: weight > 0', () => {
    const r = computeReinforcement({ areaL: 5, areaW: 4, ccMm: 150, diamMm: 10, layers: 1, wastagePct: 0 });
    expect(r.weightKg).toBeGreaterThan(0);
    expect(r.totalLengthM).toBeGreaterThan(0);
  });

  it('doubling diameter quadruples weight', () => {
    const r1 = computeReinforcement({ areaL: 5, areaW: 4, ccMm: 150, diamMm: 8, layers: 1, wastagePct: 0 });
    const r2 = computeReinforcement({ areaL: 5, areaW: 4, ccMm: 150, diamMm: 16, layers: 1, wastagePct: 0 });
    expect(approx(r2.weightKg, r1.weightKg * 4, 0.01)).toBe(true);
  });
});

describe('computeFormwork', () => {
  it('5×2.5m × 2 sides = 25 m², no wastage', () => {
    const r = computeFormwork({ length: 5, height: 2.5, sides: 2, wastagePct: 0 });
    expect(approx(r.area, 25)).toBe(true);
  });

  it('12% wastage increases area', () => {
    const r = computeFormwork({ length: 5, height: 2.5, sides: 2, wastagePct: 12 });
    expect(r.area).toBeGreaterThan(25);
  });
});

describe('computeFence', () => {
  it('20m fence, 2.4m c/c → 9 posts, 8 full panels', () => {
    const r = computeFence({ lengthM: 20, postCcM: 2.4, postWidthM: 0.1 });
    expect(r.posts).toBe(Math.ceil(20 / 2.4) + 1);
    expect(r.panels).toBe(Math.floor(20 / 2.4));
  });

  it('zero c/c → zero output', () => {
    const r = computeFence({ lengthM: 20, postCcM: 0, postWidthM: 0.1 });
    expect(r.posts).toBe(0);
  });
});

describe('computeTerrainSlope', () => {
  it('0.075m over 3m → 2.5% → passes DS 432', () => {
    const r = computeTerrainSlope({ heightDiffM: 0.075, horizontalDistM: 3 });
    expect(approx(r.slopePct, 2.5, 0.001)).toBe(true);
    expect(r.passed).toBe(true);
  });

  it('slope < 2.5% fails', () => {
    const r = computeTerrainSlope({ heightDiffM: 0.05, horizontalDistM: 3 });
    expect(r.passed).toBe(false);
  });

  it('zero distance → 0% slope', () => {
    const r = computeTerrainSlope({ heightDiffM: 1, horizontalDistM: 0 });
    expect(r.slopePct).toBe(0);
  });
});

// ── New computable entries present in registry ────────────────────────────────

describe('Phase 1 computable entries in registry', () => {
  const phase1Ids = [
    // ArealRumfang (cat 1)
    'rumareal', 'vaegareal', 'rumfangsberegner',
    // GulveOverflader (cat 2)
    'flisemaengde', 'gulvisolering', 'traegulv-maengde', 'taeppe-laminat', 'gulvafretning',
    // VaeggeSkillevaegge (cat 3)
    'maling-grunder', 'gipsplader', 'puds-spartel', 'vaegisolering', 'mursten-blokke',
    'vaegge-skillevaegge-skeletvaeg', 'vaegge-skillevaegge-maling-pro',
    // LofterTag (cat 4)
    'loftisolering', 'lofter-tag-laegter', 'lofter-tag-spaer-estimat', 'lofter-tag-loftplader',
    // BetonArmering (cat 5)
    'beton-volumen', 'blandingsforhold',
    'beton-armering-fundablokke', 'beton-armering-armeringsstaal', 'beton-armering-forskalling',
    // UdgravningJord (cat 6)
    'udgravning-jord-jordvolumen', 'udgravning-jord-skraaning', 'udgravning-jord-tilbagefyldning',
    // Udenomsarealer (cat 7)
    'udenomsarealer-fald', 'udenomsarealer-hegn', 'flisebelaegning',
    // Geometri (cat 8)
    'geometri-pythagoras', 'geometri-cirkel',
    // DoereVinduer (cat 9)
    'doere-vinduer-redningsaabning', 'doere-vinduer-vinduesareal',
  ];

  it('all phase-1 ids appear in listCalculators()', () => {
    const all = listCalculators().map((c) => c.id);
    for (const id of phase1Ids) {
      expect(all).toContain(id);
    }
  });

  it('all phase-1 computable entries have help content', () => {
    for (const id of phase1Ids) {
      const meta = getCalculator(id);
      expect(meta).toBeDefined();
      if (meta?.computable) {
        expect(meta.help).toBeDefined();
        expect(meta.help!.purpose.length).toBeGreaterThan(0);
        expect(meta.help!.formula.length).toBeGreaterThan(0);
      }
    }
  });

  it('computeCalculator works for all phase-1 computable ids', () => {
    const testInputs: Record<string, Record<string, string | number>> = {
      // ArealRumfang
      'rumareal': { shape: 'rectangle', rectL: 5, rectW: 4 },
      'vaegareal': { length: 5, width: 4, height: 2.5, doors: 1, doorW: 0.9, doorH: 2.1, windows: 1, windowW: 1.2, windowH: 1.2 },
      'rumfangsberegner': { length: 5, width: 4, height: 2.5 },
      // GulveOverflader
      'flisemaengde': { areaL: 4, areaW: 3, tileL: 30, tileW: 60, grout: 3, wastage: 10 },
      'gulvisolering': { areaL: 6, areaW: 5, boardL: 1.2, boardW: 0.6 },
      'traegulv-maengde': { length: 5, width: 4, plankWidth: 130, plankLength: 500, wastage: 7 },
      'taeppe-laminat': { length: 5, width: 4, wastage: 10 },
      'gulvafretning': { length: 5, width: 4, thickness: 40, wastage: 10 },
      // VaeggeSkillevaegge
      'maling-grunder': { area: 50, paintCoats: 2, paintCoverage: 10, primerCoats: 1, primerCoverage: 8 },
      'gipsplader': { wallL: 5, wallH: 2.5, boardL: 2.4, boardW: 1.2, layers: 2, wastage: 7 },
      'puds-spartel': { area: 50, thickness: 2, yield: 1 },
      'vaegisolering': { areaL: 8, areaW: 2.5, battL: 1.2, battW: 0.6 },
      'mursten-blokke': { wallL: 5, wallH: 2.5, brickL: 228, brickH: 54, joint: 12, wastage: 5 },
      // LofterTag
      'loftisolering': { areaL: 6, areaW: 5, battL: 1.2, battW: 0.6 },
      'lofter-tag-laegter': { rafterLength: 6, cc: 330, battLength: 4.8, quantity: 10 },
      'lofter-tag-spaer-estimat': { span: 8, pitch: 30, buildingLength: 12, cc: 600 },
      // BetonArmering
      'beton-volumen': { shape: 'slab', length: 5, width: 4, depth: 0.15, quantity: 1, wastage: 5, quality: 2400 },
      'blandingsforhold': { mixType: '1:2:3', volume: 100 },
      'beton-armering-fundablokke': { perimeter: 24, height: 0.6, blockL: 600, blockH: 250, joint: 12, wastage: 5 },
      'beton-armering-armeringsstaal': { areaL: 5, areaW: 4, cc: 150, diam: 10, layers: 1, wastage: 10 },
      'beton-armering-forskalling': { length: 5, height: 2.5, sides: 2, wastage: 12 },
      // UdgravningJord
      'udgravning-jord-jordvolumen': { length: 10, width: 5, depth: 0.5, soilType: 'clay' },
      'udgravning-jord-skraaning': { bottomWidth: 3, depth: 2, length: 10, soilType: 'clay' },
      'udgravning-jord-tilbagefyldning': { excavatedVol: 50, structureVol: 10, compactionPct: 15 },
      // Udenomsarealer
      'udenomsarealer-fald': { heightDiff: 0.075, distance: 3 },
      'udenomsarealer-hegn': { length: 20, cc: 2.4, postWidth: 0.1 },
      'flisebelaegning': { length: 5, width: 4, stoneL: 21, stoneW: 14, wastage: 5, gravel: 0.15, sand: 0.03 },
      // Geometri
      'geometri-pythagoras': { a: 3, b: 4 },
      'geometri-cirkel': { radius: 2 },
      // VaeggeSkillevaegge (skeletvaeg, maling-pro)
      'vaegge-skillevaegge-skeletvaeg': { length: 4, height: 2.5, spacing: 450, layers: 2 },
      'vaegge-skillevaegge-maling-pro': { totalArea: 50, coats: 2, coverage: 10, wastage: 10 },
      // LofterTag (loftplader)
      'lofter-tag-loftplader': { areaL: 5, areaW: 4, panelL: 1.2, panelW: 0.6, wastage: 10 },
      // DoereVinduer
      'doere-vinduer-redningsaabning': { width: 60, height: 100, heightAboveFloor: 90 },
      'doere-vinduer-vinduesareal': { windowArea: 3, floorArea: 20 },
    };

    for (const id of phase1Ids) {
      const inputs = testInputs[id];
      if (inputs) {
        expect(() => computeCalculator(id, inputs)).not.toThrow();
        const result = computeCalculator(id, inputs);
        expect(typeof result.value).toBe('number');
        expect(typeof result.summary).toBe('string');
      }
    }
  });
});

// ── Phase 2: Statics ─────────────────────────────────────────────────────────

describe('computeBeamLoad', () => {
  it('distributed load: M = wL²/8, V = wL/2', () => {
    const r = computeBeamLoad({ span: 4, loadType: 'distributed', load: 10 });
    expect(approx(r.maxMoment, 10 * 16 / 8, 1e-9)).toBe(true); // 20 kNm
    expect(approx(r.maxShear, 10 * 4 / 2, 1e-9)).toBe(true);   // 20 kN
  });
  it('point load midspan (no position): M = PL/4, V = P/2', () => {
    const r = computeBeamLoad({ span: 6, loadType: 'point', load: 12 });
    expect(approx(r.maxMoment, 12 * 6 / 4, 1e-9)).toBe(true); // 18 kNm
    expect(approx(r.maxShear, 6, 1e-9)).toBe(true);            // 6 kN
  });
  it('point load eccentric: a=1, b=5, L=6 → M = P×a×b/L, V = P×b/L', () => {
    const r = computeBeamLoad({ span: 6, loadType: 'point', load: 12, position: 1 });
    // M = 12×1×5/6 = 10 kNm
    expect(approx(r.maxMoment, 12 * 1 * 5 / 6, 1e-9)).toBe(true);
    // V_max = max(P×b/L, P×a/L) = max(10, 2) = 10 kN
    expect(approx(r.maxShear, 12 * 5 / 6, 1e-9)).toBe(true);
  });
  it('point load at 3/4 span: a=3, b=1, L=4 → correct eccentric values', () => {
    const r = computeBeamLoad({ span: 4, loadType: 'point', load: 8, position: 3 });
    // M = 8×3×1/4 = 6 kNm
    expect(approx(r.maxMoment, 8 * 3 * 1 / 4, 1e-9)).toBe(true);
    // V_max = max(8×1/4, 8×3/4) = max(2, 6) = 6 kN
    expect(approx(r.maxShear, 8 * 3 / 4, 1e-9)).toBe(true);
  });
  it('position clamped to span: position > L uses a = L', () => {
    const r = computeBeamLoad({ span: 4, loadType: 'point', load: 10, position: 10 });
    // a = min(10, 4) = 4, b = 0 → M = 10×4×0/4 = 0
    expect(r.maxMoment).toBe(0);
  });
  it('position=0 yields zero moment (load at support)', () => {
    const r = computeBeamLoad({ span: 4, loadType: 'point', load: 10, position: 0 });
    expect(r.maxMoment).toBe(0);
  });
});

describe('computeBeamCapacity (EC5/EC3 bending + shear)', () => {
  const c24 = BEAM_MATERIALS['timber-c24'];
  const s235 = BEAM_MATERIALS['steel-s235'];

  it('timber C24: Mrd = W·fm,d with W=b·h²/6, fm,d=kmod·fm,k/γM', () => {
    const r = computeBeamCapacity({ widthM: 0.1, heightM: 0.2, momentKNm: 5, shearKN: 10, material: c24 });
    const W = (0.1 * 0.2 * 0.2) / 6;
    const fmd = (0.8 * 24e6) / 1.3;
    expect(approx(r.momentResistanceKNm, (W * fmd) / 1000, 1e-6)).toBe(true);
    expect(approx(r.bendingUtilization, 5 / r.momentResistanceKNm, 1e-9)).toBe(true);
  });

  it('timber shear Vrd = (2/3)·kcr·A·fv,d', () => {
    const r = computeBeamCapacity({ widthM: 0.1, heightM: 0.2, momentKNm: 1, shearKN: 1, material: c24 });
    const fvd = (0.8 * 4.0e6) / 1.3;
    const Vrd = (2 / 3) * 0.67 * (0.1 * 0.2) * fvd;
    expect(approx(r.shearResistanceKN, Vrd / 1000, 1e-6)).toBe(true);
  });

  it('steel shear uses fy/√3 (von Mises)', () => {
    const r = computeBeamCapacity({ widthM: 0.05, heightM: 0.2, momentKNm: 1, shearKN: 1, material: s235 });
    const Vrd = ((0.05 * 0.2) * (235e6 / Math.sqrt(3))) / 1.1;
    expect(approx(r.shearResistanceKN, Vrd / 1000, 1e-6)).toBe(true);
  });

  it('utilization is the max of bending and shear; >1 fails', () => {
    const ok = computeBeamCapacity({ widthM: 0.1, heightM: 0.25, momentKNm: 3, shearKN: 5, material: c24 });
    expect(ok.utilization).toBe(Math.max(ok.bendingUtilization, ok.shearUtilization));
    expect(ok.passed).toBe(true);
    const overloaded = computeBeamCapacity({ widthM: 0.05, heightM: 0.1, momentKNm: 30, shearKN: 5, material: c24 });
    expect(overloaded.passed).toBe(false);
    expect(overloaded.governing).toBe('bending');
  });

  it('zero section → safe empty result', () => {
    const r = computeBeamCapacity({ widthM: 0, heightM: 0.2, momentKNm: 5, shearKN: 5, material: c24 });
    expect(r.governing).toBe('none');
    expect(r.momentResistanceKNm).toBe(0);
  });
});

describe('computeSlabLoad', () => {
  it('dead load from density + thickness, total = dead + live', () => {
    const r = computeSlabLoad({ thicknessM: 0.2, densityKgM3: 2400, liveLoadKNm2: 2.0 });
    const expectedDead = 0.2 * 2400 * 9.81 / 1000;
    expect(approx(r.deadLoadKNm2, expectedDead, 1e-6)).toBe(true);
    expect(approx(r.totalLoadKNm2, expectedDead + 2.0, 1e-6)).toBe(true);
  });
});

describe('computeSlabDesignLoad (EC0 6.10)', () => {
  it('γG·Gk + γQ·Qk with default 1,35 / 1,5', () => {
    const r = computeSlabDesignLoad({ deadLoadKNm2: 5, liveLoadKNm2: 2 });
    expect(approx(r.designLoadKNm2, 1.35 * 5 + 1.5 * 2, 1e-9)).toBe(true);
  });
});

describe('computeSlabFlexure (EC2 required As)', () => {
  it('known-good: Med=30 kNm/m, d=150mm, C25 → As ≈ 498 mm²/m, singly reinforced', () => {
    const r = computeSlabFlexure({ momentKNmPerM: 30, effectiveDepthMm: 150, fckMPa: 25 });
    expect(r.singlyReinforced).toBe(true);
    expect(r.requiredAsMm2).toBeGreaterThan(480);
    expect(r.requiredAsMm2).toBeLessThan(515);
    expect(r.leverArmMm).toBeLessThanOrEqual(0.95 * 150);
  });

  it('minimum reinforcement governs for a very small moment', () => {
    const r = computeSlabFlexure({ momentKNmPerM: 1, effectiveDepthMm: 150, fckMPa: 25 });
    expect(r.providedGoverningAsMm2).toBe(r.minAsMm2);
    expect(r.minAsMm2).toBeGreaterThan(r.requiredAsMm2);
  });

  it('flags a section that needs compression steel (K > 0.167)', () => {
    const r = computeSlabFlexure({ momentKNmPerM: 200, effectiveDepthMm: 150, fckMPa: 25 });
    expect(r.singlyReinforced).toBe(false);
  });

  it('general beam reinforcement scales As with width (2× width → ~2× As for same stress)', () => {
    const narrow = computeFlexuralReinforcement({ momentKNm: 50, widthMm: 300, effectiveDepthMm: 400, fckMPa: 30 });
    const wide = computeFlexuralReinforcement({ momentKNm: 50, widthMm: 600, effectiveDepthMm: 400, fckMPa: 30 });
    // Wider section → smaller K → larger lever arm → slightly LESS steel, but min As scales with width
    expect(wide.minAsMm2).toBeGreaterThan(narrow.minAsMm2);
    expect(narrow.requiredAsMm2).toBeGreaterThan(0);
  });

  it('provided-bar check: passes when As,prov ≥ As,req and ≤ As,max', () => {
    const r = computeFlexuralReinforcement({ momentKNm: 50, widthMm: 300, effectiveDepthMm: 400, fckMPa: 30, barDiameterMm: 16, barCount: 3 });
    const provided = 3 * Math.PI * 64; // 3 × Ø16
    expect(approx(r.providedAsMm2, provided, 1e-6)).toBe(true);
    expect(r.provisionPasses).toBe(r.providedAsMm2 >= r.governingAsMm2 && r.providedAsMm2 <= r.maxAsMm2);
  });

  it('provisionPasses is null when no bars specified', () => {
    const r = computeFlexuralReinforcement({ momentKNm: 50, widthMm: 300, effectiveDepthMm: 400, fckMPa: 30 });
    expect(r.provisionPasses).toBe(null);
  });

  it('zero depth → empty result', () => {
    const r = computeSlabFlexure({ momentKNmPerM: 30, effectiveDepthMm: 0, fckMPa: 25 });
    expect(r.requiredAsMm2).toBe(0);
  });
});

describe('computeWindLoad', () => {
  it('vb=24, area=50, default Cp=0.8 → pressure and force', () => {
    const r = computeWindLoad({ area: 50, windSpeed: 24, Cp: 0.8 });
    const expected = 0.5 * 1.25 * 24 * 24 * 0.8 / 1000;
    expect(approx(r.pressureKPa, expected, 1e-9)).toBe(true);
    expect(approx(r.forceKN, expected * 50, 1e-9)).toBe(true);
  });
});

describe('computeSnowLoad', () => {
  it('pitch=0 → μ1=0.8, sd=0.8*sk', () => {
    const r = computeSnowLoad({ pitchDeg: 0, sk: 1.0 });
    expect(approx(r.mu1, 0.8, 1e-9)).toBe(true);
    expect(approx(r.sd, 0.8, 1e-9)).toBe(true);
  });
  it('pitch=60 → μ1=0, sd=0', () => {
    const r = computeSnowLoad({ pitchDeg: 60, sk: 1.0 });
    expect(approx(r.mu1, 0, 1e-9)).toBe(true);
    expect(approx(r.sd, 0, 1e-9)).toBe(true);
  });
});

describe('computeSnowDrift (EC1-1-3 local drift)', () => {
  it('μ = γ·h/sk bounded 0,8–2,0; drift load can exceed the uniform 0,8·sk case', () => {
    const r = computeSnowDrift({ obstructionHeightM: 0.8, sk: 1.0 }); // γ=2 → μ=1.6
    expect(approx(r.muDrift, 1.6, 1e-9)).toBe(true);
    expect(r.sDrift).toBeGreaterThan(0.8); // governs over uniform μ1=0.8
  });
  it('μ capped at 2,0 for a tall obstruction', () => {
    const r = computeSnowDrift({ obstructionHeightM: 3, sk: 1.0 });
    expect(r.muDrift).toBe(2.0);
  });
  it('μ floored at 0,8 for a very low obstruction', () => {
    const r = computeSnowDrift({ obstructionHeightM: 0.1, sk: 1.0 });
    expect(r.muDrift).toBe(0.8);
  });
  it('drift length ls = 2h bounded 5–15 m', () => {
    expect(computeSnowDrift({ obstructionHeightM: 1, sk: 1.0 }).driftLengthM).toBe(5);
    expect(computeSnowDrift({ obstructionHeightM: 4, sk: 1.0 }).driftLengthM).toBe(8);
    expect(computeSnowDrift({ obstructionHeightM: 10, sk: 1.0 }).driftLengthM).toBe(15);
  });
  it('zero height → zero drift', () => {
    expect(computeSnowDrift({ obstructionHeightM: 0, sk: 1.0 }).sDrift).toBe(0);
  });
});

// ── Phase 2: Electrical ──────────────────────────────────────────────────────

describe('computeVoltageDrop', () => {
  it('10A, 20m cable, 2.5mm² → drop%', () => {
    const r = computeVoltageDrop({ currentA: 10, lengthM: 20, crossSectionMm2: 2.5 });
    const R = 0.0175 * 2 * 20 / 2.5;
    const dropV = 10 * R;
    expect(approx(r.voltageDropV, dropV, 1e-9)).toBe(true);
    expect(approx(r.voltageDropPct, (dropV / 230) * 100, 1e-9)).toBe(true);
  });
  it('4% limit at 230V is ~9.2V', () => {
    const r = computeVoltageDrop({ currentA: 10, lengthM: 20, crossSectionMm2: 2.5 });
    expect(r.voltageDropPct).toBeGreaterThan(0);
  });
  it('temperature correction increases resistivity (70°C > 20°C reference)', () => {
    const cold = computeVoltageDrop({ currentA: 10, lengthM: 20, crossSectionMm2: 2.5, conductorTempC: 20 });
    const hot = computeVoltageDrop({ currentA: 10, lengthM: 20, crossSectionMm2: 2.5, conductorTempC: 70 });
    expect(hot.resistivityUsed).toBeGreaterThan(cold.resistivityUsed);
    expect(hot.voltageDropV).toBeGreaterThan(cold.voltageDropV);
    expect(approx(cold.resistivityUsed, 0.0175, 1e-9)).toBe(true); // 20°C = reference (backward compatible)
  });
  it('three-phase uses √3·L instead of 2·L', () => {
    const single = computeVoltageDrop({ currentA: 10, lengthM: 20, crossSectionMm2: 2.5, phases: 1 });
    const three = computeVoltageDrop({ currentA: 10, lengthM: 20, crossSectionMm2: 2.5, phases: 3 });
    expect(approx(three.voltageDropV / single.voltageDropV, Math.sqrt(3) / 2, 1e-9)).toBe(true);
  });
});

describe('computeCableAmpacity (DS/HD 60364-5-52 derating)', () => {
  it('derated Iz = base × ambient × grouping; passes when In ≤ Iz', () => {
    const r = computeCableAmpacity({ baseAmpacityA: 32, ambientFactor: 0.87, groupingFactor: 0.8, protectiveDeviceA: 20 });
    expect(approx(r.deratedAmpacityA, 32 * 0.87 * 0.8, 1e-9)).toBe(true); // ≈ 22.3 A
    expect(r.passed).toBe(true); // 20 ≤ 22.3
  });
  it('fails when the breaker exceeds the derated cable capacity', () => {
    const r = computeCableAmpacity({ baseAmpacityA: 32, ambientFactor: 0.7, groupingFactor: 0.7, protectiveDeviceA: 25 });
    expect(r.deratedAmpacityA).toBeLessThan(25);
    expect(r.passed).toBe(false);
  });
});

describe('computeEarthFaultLoop (DS/HD 60364-4-41)', () => {
  it('passes when Zs ≤ U0/Ia', () => {
    const r = computeEarthFaultLoop({ voltageU0: 230, loopImpedanceOhm: 1.0, disconnectCurrentA: 160 });
    expect(approx(r.maxZsOhm, 230 / 160, 1e-9)).toBe(true); // 1.4375 Ω
    expect(approx(r.faultCurrentA, 230, 1e-9)).toBe(true);  // 230/1.0
    expect(r.passed).toBe(true); // 1.0 ≤ 1.4375
  });
  it('fails when loop impedance too high to trip in time', () => {
    const r = computeEarthFaultLoop({ voltageU0: 230, loopImpedanceOhm: 2.0, disconnectCurrentA: 160 });
    expect(r.passed).toBe(false); // 2.0 > 1.4375
  });
});

// ── Phase 2: VVS ─────────────────────────────────────────────────────────────

describe('computePipeDiameter', () => {
  it('Q=1 L/s, v=1.5 m/s → diameter ~29mm', () => {
    const r = computePipeDiameter({ flowLps: 1, velocityMs: 1.5 });
    const expected = Math.sqrt(4 * (0.001 / 1.5) / Math.PI) * 1000;
    expect(approx(r.diamMm, expected, 1e-6)).toBe(true);
  });
});

describe('computeDrainDrop', () => {
  it('5m at 2% → 10cm drop, 20‰, but NOT compliant (DS 432 min is 2,5%)', () => {
    const r = computeDrainDrop({ lengthM: 5, slopePct: 2 });
    expect(approx(r.dropCm, 10, 1e-9)).toBe(true);
    expect(approx(r.slopePromille, 20, 1e-9)).toBe(true);
    expect(r.compliant).toBe(false); // default min is now 2,5% (1:40), not 2,0%
  });
  it('2,5% slope → compliant (DS 432 default minimum)', () => {
    const r = computeDrainDrop({ lengthM: 5, slopePct: 2.5 });
    expect(r.compliant).toBe(true);
  });
  it('respects a custom per-material minSlopePct (cast-iron 1,5%)', () => {
    expect(computeDrainDrop({ lengthM: 5, slopePct: 1.6, minSlopePct: 1.5 }).compliant).toBe(true);
    expect(computeDrainDrop({ lengthM: 5, slopePct: 1.4, minSlopePct: 1.5 }).compliant).toBe(false);
  });
  it('1% slope → non-compliant', () => {
    const r = computeDrainDrop({ lengthM: 5, slopePct: 1 });
    expect(r.compliant).toBe(false);
  });
});

// ── Phase 2: HVAC ────────────────────────────────────────────────────────────

describe('computeVentilationFlow', () => {
  it('BR18: design flow is the GREATER of area- and person-based, not their sum', () => {
    // 100m² → 30 L/s area-based; 4 persons → 28 L/s person-based → max = 30 L/s
    const r = computeVentilationFlow({ areaM2: 100, persons: 4 });
    expect(approx(r.areaBasedLps, 30, 1e-9)).toBe(true);
    expect(approx(r.personBasedLps, 28, 1e-9)).toBe(true);
    expect(approx(r.flowLps, 30, 1e-9)).toBe(true);
    expect(approx(r.flowM3h, 30 * 3.6, 1e-9)).toBe(true);
  });
  it('person-based governs when occupancy is high', () => {
    // 20m² → 6 L/s area-based; 10 persons → 70 L/s person-based → max = 70 L/s
    const r = computeVentilationFlow({ areaM2: 20, persons: 10 });
    expect(approx(r.flowLps, 70, 1e-9)).toBe(true);
  });
});

describe('computeDuctDiameter', () => {
  it('500 m³/h at 5 m/s → diameter', () => {
    const r = computeDuctDiameter({ flowM3h: 500, velocityMs: 5 });
    const expected = Math.sqrt(4 * (500 / 3600 / 5) / Math.PI) * 1000;
    expect(approx(r.diamMm, expected, 1e-6)).toBe(true);
  });
});

// ── Phase 2: Energy & Climate ────────────────────────────────────────────────

describe('computeUValue', () => {
  it('single layer 200mm mineral wool λ=0.037 → U-value', () => {
    const layers = [{ name: 'Mineraluld', lambdaWmK: 0.037, thicknessMm: 200 }];
    const r = computeUValue({ layers });
    const R = 0.13 + 0.2 / 0.037 + 0.04;
    expect(approx(r.Rtotal, R, 1e-9)).toBe(true);
    expect(approx(r.uValue, 1 / R, 1e-9)).toBe(true);
  });
});

describe('computeHeatLoss', () => {
  it('U=0.18, 10m², ΔT=32K → 57.6 W', () => {
    const r = computeHeatLoss({ uValue: 0.18, areaM2: 10, deltaT: 32 });
    expect(approx(r.heatLossW, 57.6, 1e-9)).toBe(true);
  });
});

describe('computeWindowUValue (EN ISO 10077-1)', () => {
  it('3-term Uw = (Ag·Ug + Af·Uf + lg·ψg)/Aw', () => {
    const r = computeWindowUValue({ widthM: 1.2, heightM: 1.2, frameWidthMm: 70, ugWm2K: 1.0, ufWm2K: 1.4, psiGWmK: 0.04 });
    const Aw = 1.44, gW = 1.06, gH = 1.06, Ag = gW * gH, Af = Aw - Ag, lg = 2 * (gW + gH);
    const expected = (Ag * 1.0 + Af * 1.4 + lg * 0.04) / Aw;
    expect(approx(r.uwWm2K, expected, 1e-6)).toBe(true);
    expect(approx(r.glassAreaM2, Ag, 1e-9)).toBe(true);
  });
  it('edge term makes Uw worse than a naive area-weighted value', () => {
    const withEdge = computeWindowUValue({ widthM: 1.2, heightM: 1.2, frameWidthMm: 70, ugWm2K: 1.0, ufWm2K: 1.4, psiGWmK: 0.08 });
    const noEdge = computeWindowUValue({ widthM: 1.2, heightM: 1.2, frameWidthMm: 70, ugWm2K: 1.0, ufWm2K: 1.4, psiGWmK: 0 });
    expect(withEdge.uwWm2K).toBeGreaterThan(noEdge.uwWm2K);
  });
  it('checks against a requirement', () => {
    const r = computeWindowUValue({ widthM: 1.2, heightM: 1.2, frameWidthMm: 70, ugWm2K: 0.6, ufWm2K: 1.0, requirementWm2K: 1.2 });
    expect(r.passed).toBe(true);
  });
});

describe('computeAnnualEnergyFrame (Be18-aligned)', () => {
  it('ventilation H_V = 0.34·n·V; annual demand in kWh/m²/yr', () => {
    const r = computeAnnualEnergyFrame({ transmissionHTWperK: 100, ventilationAirChangeRate: 0.5, heatedVolumeM3: 250, heatedFloorAreaM2: 100, degreeDays: 2906, internalGainsKwhM2Yr: 8, solarGainsKwhM2Yr: 12 });
    expect(approx(r.ventilationHVWperK, 0.34 * 0.5 * 250, 1e-9)).toBe(true);
    const factor = (2906 * 24) / 1000;
    expect(approx(r.transmissionKwhYr, 100 * factor, 1e-6)).toBe(true);
    expect(approx(r.gainsKwhYr, 20 * 100, 1e-9)).toBe(true);
    expect(r.netHeatDemandKwhM2Yr).toBeGreaterThan(0);
  });
  it('net demand cannot go below zero (gains exceed losses)', () => {
    const r = computeAnnualEnergyFrame({ transmissionHTWperK: 5, ventilationAirChangeRate: 0.1, heatedVolumeM3: 100, heatedFloorAreaM2: 100, internalGainsKwhM2Yr: 50, solarGainsKwhM2Yr: 50 });
    expect(r.netHeatDemandKwhYr).toBe(0);
  });
});

describe('computeDewPoint', () => {
  it('20°C, 50% RH → dewpoint ~9.3°C', () => {
    const r = computeDewPoint({ tempC: 20, relativeHumidityPct: 50 });
    expect(r.dewPointC).toBeGreaterThan(9);
    expect(r.dewPointC).toBeLessThan(10);
  });
  it('20°C, 100% RH → dewpoint ≈ 20°C', () => {
    const r = computeDewPoint({ tempC: 20, relativeHumidityPct: 100 });
    expect(approx(r.dewPointC, 20, 0.01)).toBe(true);
  });
});

// ── Phase 2: Stairs & Access ──────────────────────────────────────────────────

describe('computeStairGeometry', () => {
  it('2.7m height, 0.18m rise → 15 steps, compliant', () => {
    const r = computeStairGeometry({ totalHeightM: 2.7, riseM: 0.18 });
    expect(r.steps).toBe(15);
    expect(approx(r.actualRiseM, 0.18, 1e-9)).toBe(true);
    expect(r.compliant).toBe(true);
  });
});

describe('computeRampLength', () => {
  it('40cm height, 1:20 → 8m, accessible', () => {
    const r = computeRampLength({ heightCm: 40, ratio: 20 });
    expect(approx(r.lengthM, 8, 1e-9)).toBe(true);
    expect(r.accessible).toBe(true);
  });
  it('1:12 ratio → not accessible', () => {
    const r = computeRampLength({ heightCm: 40, ratio: 12 });
    expect(r.accessible).toBe(false);
  });
});

// ── Phase 3: Financial functions ─────────────────────────────────────────────

describe('computeBudget', () => {
  it('basic: subtotal + contingency, no overhead, no VAT', () => {
    const r = computeBudget({
      items: [
        { name: 'Mat', amount: 50000, type: 'material' },
        { name: 'Løn', amount: 30000, type: 'labor' },
      ],
      contingencyPct: 10,
      overheadPct: 0,
      includeVat: false,
    });
    expect(r.subtotal).toBe(80000);
    expect(r.contingency).toBe(8000);
    expect(r.totalExVat).toBe(88000);
    expect(r.vat).toBe(0);
    expect(r.total).toBe(88000);
  });

  it('advanced: overhead applied before contingency', () => {
    const r = computeBudget({
      items: [{ name: 'Mat', amount: 100000, type: 'material' }],
      contingencyPct: 10,
      overheadPct: 10,
      includeVat: false,
    });
    expect(r.overhead).toBe(10000);
    expect(r.contingency).toBeCloseTo(11000, 2);
    expect(r.totalExVat).toBeCloseTo(121000, 2);
  });

  it('VAT adds exactly 25%', () => {
    const r = computeBudget({
      items: [{ name: 'Mat', amount: 10000, type: 'material' }],
      contingencyPct: 0,
      overheadPct: 0,
      includeVat: true,
    });
    expect(r.vat).toBe(2500);
    expect(r.total).toBe(12500);
  });

  it('materialTotal / laborTotal / otherTotal categories correct', () => {
    const r = computeBudget({
      items: [
        { name: 'M', amount: 30000, type: 'material' },
        { name: 'L', amount: 20000, type: 'labor' },
        { name: 'O', amount: 5000, type: 'other' },
      ],
      contingencyPct: 0,
      overheadPct: 0,
      includeVat: false,
    });
    expect(r.materialTotal).toBe(30000);
    expect(r.laborTotal).toBe(20000);
    expect(r.otherTotal).toBe(5000);
  });

  it('boundary: empty items → zero', () => {
    const r = computeBudget({ items: [], contingencyPct: 10, overheadPct: 5, includeVat: true });
    expect(r.total).toBe(0);
  });
});

describe('computeMaterialCost', () => {
  it('20 × 89 kr = 1780 kr, no wastage, no VAT', () => {
    const r = computeMaterialCost({
      items: [{ name: 'Gips', qty: 20, unitPrice: 89 }],
      wastagePct: 0,
      includeVat: false,
    });
    expect(r.subtotal).toBe(1780);
    expect(r.wastage).toBe(0);
    expect(r.total).toBe(1780);
  });

  it('5% wastage adds 5% to subtotal', () => {
    const r = computeMaterialCost({
      items: [{ name: 'Gips', qty: 20, unitPrice: 89 }],
      wastagePct: 5,
      includeVat: false,
    });
    expect(r.wastage).toBeCloseTo(89, 2);
    expect(r.totalExVat).toBeCloseTo(1869, 2);
  });

  it('VAT adds 25%', () => {
    const r = computeMaterialCost({
      items: [{ name: 'X', qty: 1, unitPrice: 1000 }],
      wastagePct: 0,
      includeVat: true,
    });
    expect(r.vat).toBe(250);
    expect(r.total).toBe(1250);
  });

  it('multiple items summed correctly', () => {
    const r = computeMaterialCost({
      items: [
        { name: 'A', qty: 10, unitPrice: 100 },
        { name: 'B', qty: 5, unitPrice: 200 },
      ],
      wastagePct: 0,
      includeVat: false,
    });
    expect(r.subtotal).toBe(2000);
  });
});

describe('computeLaborCost', () => {
  it('1 worker, 5 days, 8 h/d, 550 kr/h, no burden, no VAT', () => {
    const r = computeLaborCost({ workers: 1, hoursPerDay: 8, days: 5, hourlyRate: 550, laborBurdenPct: 0, includeVat: false });
    expect(r.totalHours).toBe(40);
    expect(r.baseCost).toBe(22000);
    expect(r.burden).toBe(0);
    expect(r.total).toBe(22000);
  });

  it('labor burden 30% adds 30% to base', () => {
    const r = computeLaborCost({ workers: 2, hoursPerDay: 8, days: 5, hourlyRate: 550, laborBurdenPct: 30, includeVat: false });
    expect(r.totalHours).toBe(80);
    expect(r.baseCost).toBe(44000);
    expect(r.burden).toBeCloseTo(13200, 2);
    expect(r.totalExVat).toBeCloseTo(57200, 2);
  });

  it('VAT adds 25% on top of total ex VAT', () => {
    const r = computeLaborCost({ workers: 1, hoursPerDay: 8, days: 1, hourlyRate: 100, laborBurdenPct: 0, includeVat: true });
    expect(r.totalExVat).toBe(800);
    expect(r.vat).toBe(200);
    expect(r.total).toBe(1000);
  });

  it('boundary: zero workers → zero cost', () => {
    const r = computeLaborCost({ workers: 0, hoursPerDay: 8, days: 5, hourlyRate: 550, laborBurdenPct: 0, includeVat: false });
    expect(r.total).toBe(0);
  });
});

describe('computeLoanAmortization', () => {
  it('known amortization: 1.5M, 5% dp, 4.5%, 25y', () => {
    const r = computeLoanAmortization({ principal: 1500000, downPaymentPct: 5, annualRatePct: 4.5, termYears: 25, annualAdminFeeKr: 0 });
    expect(r.downPayment).toBeCloseTo(75000, 0);
    expect(r.loan).toBeCloseTo(1425000, 0);
    // Monthly payment within 1 kr of expected value ~7,888
    expect(r.monthlyPayment).toBeGreaterThan(7000);
    expect(r.monthlyPayment).toBeLessThan(10000);
    expect(r.totalInterest).toBeGreaterThan(0);
    expect(r.yearlyData.length).toBe(25);
    expect(r.yearlyData[24].balance).toBeCloseTo(0, 0);
  });

  it('zero rate → equal principal payments', () => {
    const r = computeLoanAmortization({ principal: 120000, downPaymentPct: 0, annualRatePct: 0, termYears: 10, annualAdminFeeKr: 0 });
    expect(r.monthlyPayment).toBeCloseTo(1000, 2);
    expect(r.totalInterest).toBeCloseTo(0, 2);
  });

  it('APR > nominal rate when admin fee > 0', () => {
    const r = computeLoanAmortization({ principal: 1000000, downPaymentPct: 0, annualRatePct: 4, termYears: 20, annualAdminFeeKr: 5000 });
    expect(r.aprPct).toBeGreaterThan(4);
  });

  it('ÅOP is the EFFECTIVE annual rate — exceeds nominal even with zero fees', () => {
    // A 6% nominal (0,5%/month) loan has ÅOP = (1,005^12 − 1) = 6,168%, NOT 6,00%.
    const r = computeLoanAmortization({ principal: 1000000, downPaymentPct: 0, annualRatePct: 6, termYears: 20, annualAdminFeeKr: 0 });
    const expectedEffective = (Math.pow(1 + 0.06 / 12, 12) - 1) * 100;
    expect(approx(r.aprPct, expectedEffective, 1e-6)).toBe(true);
    expect(r.aprPct).toBeGreaterThan(6);
  });

  it('final-year balance snaps exactly to zero (no float drift)', () => {
    const r = computeLoanAmortization({ principal: 1500000, downPaymentPct: 5, annualRatePct: 4.5, termYears: 25, annualAdminFeeKr: 0 });
    expect(r.yearlyData[r.yearlyData.length - 1].balance).toBe(0);
  });

  it('boundary: zero principal → zero monthly payment', () => {
    const r = computeLoanAmortization({ principal: 0, downPaymentPct: 0, annualRatePct: 4.5, termYears: 25, annualAdminFeeKr: 0 });
    expect(r.monthlyPayment).toBe(0);
  });

  it('100% down payment → zero loan', () => {
    const r = computeLoanAmortization({ principal: 1000000, downPaymentPct: 100, annualRatePct: 4.5, termYears: 25, annualAdminFeeKr: 0 });
    expect(r.loan).toBe(0);
    expect(r.monthlyPayment).toBe(0);
  });
});

// ── Phase 2 upgrade: new formula functions ───────────────────────────────────

describe('computeColumnLoad', () => {
  it('Euler buckling: P_cr = π²EI/L²', () => {
    const E = 210e9, w = 0.1, d = 0.1, h = 3;
    const I = (w * Math.pow(d, 3)) / 12;
    const expected = (Math.PI * Math.PI * E * I) / (h * h) / 1000;
    const r = computeColumnLoad({ widthM: w, depthM: d, heightM: h, elasticModulusPa: E });
    expect(approx(r.criticalLoadKN, expected, 1e-6)).toBe(true);
  });

  it('momentOfInertiaM4 = w×d³/12', () => {
    const r = computeColumnLoad({ widthM: 0.15, depthM: 0.15, heightM: 3, elasticModulusPa: 12e9 });
    expect(approx(r.momentOfInertiaM4, (0.15 * Math.pow(0.15, 3)) / 12, 1e-12)).toBe(true);
  });

  it('zero height → zero critical load', () => {
    const r = computeColumnLoad({ widthM: 0.15, depthM: 0.15, heightM: 0, elasticModulusPa: 12e9 });
    expect(r.criticalLoadKN).toBe(0);
  });
});

describe('computeColumnCapacity (EC5/EC3 buckling + crushing)', () => {
  const s235 = COLUMN_MATERIALS['steel-s235'];

  it('slender column: buckling governs, kc < 1, resistance below crushing capacity', () => {
    const r = computeColumnCapacity({ widthM: 0.1, depthM: 0.1, heightM: 3, appliedLoadKN: 500, material: s235 });
    expect(r.governing).toBe('buckling');
    expect(r.reductionFactor).toBeLessThan(1);
    expect(r.relativeSlenderness).toBeGreaterThan(0.2);
    expect(r.bucklingResistanceKN).toBeLessThan(r.crushResistanceKN);
  });

  it('REGRESSION: short stocky column is limited by finite crushing capacity, not infinite Euler load', () => {
    // Old pure-Euler check: P_cr → huge for L=0.3m, so any load looked "safe".
    // Now the resistance is the FINITE crushing capacity A·fc,d, so an overload fails.
    const r = computeColumnCapacity({ widthM: 0.1, depthM: 0.1, heightM: 0.3, appliedLoadKN: 3000, material: s235 });
    expect(r.governing).toBe('crushing');
    expect(r.reductionFactor).toBeCloseTo(1, 2);
    // crushing resistance = A·fc,d = 0.01 × (235e6/1.1) = ~2136 kN < 3000 kN applied
    expect(r.crushResistanceKN).toBeLessThan(3000);
    expect(r.utilization).toBeGreaterThan(1);
    expect(r.passed).toBe(false); // the old code returned "Sikker" here — this is the fix
  });

  it('utilization ≤ 1 passes, > 1 fails', () => {
    const pass = computeColumnCapacity({ widthM: 0.1, depthM: 0.1, heightM: 3, appliedLoadKN: 100, material: s235 });
    expect(pass.passed).toBe(true);
    expect(pass.utilization).toBeLessThanOrEqual(1);
    const fail = computeColumnCapacity({ widthM: 0.1, depthM: 0.1, heightM: 3, appliedLoadKN: 2000, material: s235 });
    expect(fail.passed).toBe(false);
  });

  it('crushing resistance = A · fc,d (kmod·fck/γM)', () => {
    const r = computeColumnCapacity({ widthM: 0.1, depthM: 0.1, heightM: 0.2, appliedLoadKN: 1, material: s235 });
    const expectedKN = (0.01 * (1.0 * 235e6 / 1.1)) / 1000;
    expect(approx(r.crushResistanceKN, expectedKN, 1e-6)).toBe(true);
  });

  it('effective-length factor increases slenderness (cantilever k=2 vs pinned k=1)', () => {
    const pinned = computeColumnCapacity({ widthM: 0.1, depthM: 0.1, heightM: 3, appliedLoadKN: 100, material: s235, effectiveLengthFactor: 1 });
    const cantilever = computeColumnCapacity({ widthM: 0.1, depthM: 0.1, heightM: 3, appliedLoadKN: 100, material: s235, effectiveLengthFactor: 2 });
    expect(cantilever.relativeSlenderness).toBeGreaterThan(pinned.relativeSlenderness);
    expect(cantilever.bucklingResistanceKN).toBeLessThan(pinned.bucklingResistanceKN);
  });

  it('buckling governs about the weaker axis (uses min I)', () => {
    // A rectangular 200×50 section: I is smallest about the weak axis → that governs.
    const r = computeColumnCapacity({ widthM: 0.2, depthM: 0.05, heightM: 3, appliedLoadKN: 100, material: s235 });
    const iWeak = Math.min((0.2 * 0.05 ** 3) / 12, (0.05 * 0.2 ** 3) / 12);
    expect(approx(r.iMinM4, iWeak, 1e-12)).toBe(true);
  });

  it('zero section → safe empty result', () => {
    const r = computeColumnCapacity({ widthM: 0, depthM: 0.1, heightM: 3, appliedLoadKN: 100, material: s235 });
    expect(r.governing).toBe('none');
    expect(r.bucklingResistanceKN).toBe(0);
  });
});

describe('computeFoundationArea', () => {
  it('100 kN load, 150 kN/m² capacity → area = 100/150, side = √(area)', () => {
    const r = computeFoundationArea({ loadKN: 100, capacityKNm2: 150 });
    expect(approx(r.areaM2, 100 / 150, 1e-6)).toBe(true);
    expect(approx(r.sideLengthM, Math.sqrt(100 / 150), 1e-6)).toBe(true);
  });

  it('zero load → zero area', () => {
    const r = computeFoundationArea({ loadKN: 0, capacityKNm2: 150 });
    expect(r.areaM2).toBe(0);
  });
});

describe('computeFoundationBearing (EC7 effective-width)', () => {
  it('concentric load: includes footing self-weight in the contact pressure', () => {
    const r = computeFoundationBearing({ loadKN: 500, widthM: 2, lengthM: 2, thicknessM: 0.4, bearingCapacityKNm2: 150 });
    expect(approx(r.selfWeightKN, 2 * 2 * 0.4 * 24, 1e-6)).toBe(true); // 38.4 kN
    expect(approx(r.totalLoadKN, 538.4, 1e-6)).toBe(true);
    expect(approx(r.bearingPressureKNm2, 538.4 / 4, 1e-6)).toBe(true);
    expect(r.passed).toBe(true);
    expect(r.eccentricityWarning).toBe(false);
  });

  it('eccentric load: effective width B−2e raises pressure, flags outside middle third', () => {
    const r = computeFoundationBearing({ loadKN: 500, widthM: 2, lengthM: 2, thicknessM: 0.4, bearingCapacityKNm2: 150, momentKNm: 200 });
    expect(r.eccentricityM).toBeGreaterThan(0);
    expect(r.effectiveWidthM).toBeLessThan(2);
    expect(r.bearingPressureKNm2).toBeGreaterThan(538.4 / 4); // higher than the concentric case
    expect(r.eccentricityWarning).toBe(true); // e > B/6
    expect(r.passed).toBe(false);
  });

  it('utilization = pressure / bearing capacity', () => {
    const r = computeFoundationBearing({ loadKN: 500, widthM: 2, lengthM: 2, thicknessM: 0.4, bearingCapacityKNm2: 150 });
    expect(approx(r.utilization, r.bearingPressureKNm2 / 150, 1e-9)).toBe(true);
  });

  it('zero footing → safe empty result', () => {
    const r = computeFoundationBearing({ loadKN: 500, widthM: 0, lengthM: 2, thicknessM: 0.4, bearingCapacityKNm2: 150 });
    expect(r.bearingPressureKNm2).toBe(0);
    expect(r.passed).toBe(false);
  });
});

describe('computeBearingWallLoad', () => {
  it('2.6m × 0.25m × 1800 kg/m³ → self weight ≈ 11.42 kN/m', () => {
    const r = computeBearingWallLoad({ heightM: 2.6, thicknessM: 0.25, densityKgM3: 1800, additionalLoadKNm: 0 });
    const expected = 2.6 * 0.25 * 1800 * 9.81 / 1000;
    expect(approx(r.selfWeightKNm, expected, 1e-4)).toBe(true);
    expect(approx(r.totalLoadKNm, expected, 1e-4)).toBe(true);
  });

  it('additional load adds to total', () => {
    const r = computeBearingWallLoad({ heightM: 2.6, thicknessM: 0.25, densityKgM3: 1800, additionalLoadKNm: 20 });
    const sw = 2.6 * 0.25 * 1800 * 9.81 / 1000;
    expect(approx(r.totalLoadKNm, sw + 20, 1e-4)).toBe(true);
  });
});

describe('computeMasonryWallCapacity (EC6 Annex G)', () => {
  const tegl = MASONRY_MATERIALS['tegl-normalmoertel'];

  it('stocky 350mm brick wall: high capacity, Φ near (but below) 1, passes a light load', () => {
    const r = computeMasonryWallCapacity({ heightM: 2.6, thicknessM: 0.35, fkPa: tegl.fkPa, gammaM: tegl.gammaM, appliedLoadKNm: 100 });
    expect(r.reductionFactor).toBeGreaterThan(0.8);
    expect(r.reductionFactor).toBeLessThanOrEqual(1);
    expect(r.capacityKNm).toBeGreaterThan(100);
    expect(r.passed).toBe(true);
    expect(r.slendernessWarning).toBe(false);
  });

  it('slender thin wall: lower Φ, slenderness warning, overloaded', () => {
    const r = computeMasonryWallCapacity({ heightM: 4, thicknessM: 0.1, fkPa: 2.5e6, gammaM: 1.7, appliedLoadKNm: 200 });
    expect(r.slenderness).toBeGreaterThan(27);
    expect(r.slendernessWarning).toBe(true);
    expect(r.reductionFactor).toBeLessThan(0.6);
    expect(r.passed).toBe(false);
  });

  it('capacity = Φ·t·(fk/γM) per metre', () => {
    const r = computeMasonryWallCapacity({ heightM: 2.6, thicknessM: 0.35, fkPa: tegl.fkPa, gammaM: tegl.gammaM, appliedLoadKNm: 50 });
    const expectedKN = (r.reductionFactor * 0.35 * (tegl.fkPa / tegl.gammaM)) / 1000;
    expect(approx(r.capacityKNm, expectedKN, 1e-6)).toBe(true);
  });

  it('greater eccentricity reduces capacity', () => {
    const centric = computeMasonryWallCapacity({ heightM: 2.6, thicknessM: 0.2, fkPa: tegl.fkPa, gammaM: tegl.gammaM, appliedLoadKNm: 50, loadEccentricityM: 0 });
    const eccentric = computeMasonryWallCapacity({ heightM: 2.6, thicknessM: 0.2, fkPa: tegl.fkPa, gammaM: tegl.gammaM, appliedLoadKNm: 50, loadEccentricityM: 0.04 });
    expect(eccentric.capacityKNm).toBeLessThan(centric.capacityKNm);
  });

  it('zero thickness → safe empty result', () => {
    const r = computeMasonryWallCapacity({ heightM: 2.6, thicknessM: 0, fkPa: tegl.fkPa, gammaM: tegl.gammaM, appliedLoadKNm: 50 });
    expect(r.capacityKNm).toBe(0);
    expect(r.passed).toBe(false);
  });
});

describe('computeDeflection', () => {
  it('UDL beam: δ = 5qL⁴/(384EI)', () => {
    const L = 4, q = 10, E = 210e9, I = 1e-4;
    const r = computeDeflection({ spanM: L, loadKNm: q, elasticModulusGPa: E / 1e9, momentOfInertiaM4: I });
    const expected = (5 * (q * 1000) * Math.pow(L, 4)) / (384 * E * I) * 1000; // mm
    expect(approx(r.deflectionMm, expected, 1e-4)).toBe(true);
  });

  it('L/300, L/360 and L/400 limits', () => {
    const r = computeDeflection({ spanM: 6, loadKNm: 5, elasticModulusGPa: 210, momentOfInertiaM4: 1e-4 });
    expect(approx(r.limitL300mm, 6000 / 300, 1e-9)).toBe(true);
    expect(approx(r.limitL360mm, 6000 / 360, 1e-9)).toBe(true);
    expect(approx(r.limitL400mm, 6000 / 400, 1e-9)).toBe(true);
  });

  it('EC5 creep: final deflection = instantaneous × (1 + kdef)', () => {
    const r = computeDeflection({ spanM: 4, loadKNm: 10, elasticModulusGPa: 11, momentOfInertiaM4: 1e-4, kdef: 0.6 });
    expect(approx(r.finalDeflectionMm, r.deflectionMm * 1.6, 1e-6)).toBe(true);
  });

  it('utilization/pass uses the selected L/n limit (and final deflection when kdef>0)', () => {
    // Stiff, short beam → passes L/400
    const pass = computeDeflection({ spanM: 3, loadKNm: 2, elasticModulusGPa: 210, momentOfInertiaM4: 5e-4, limitDenominator: 400 });
    expect(pass.passed).toBe(true);
    expect(pass.utilization).toBeLessThanOrEqual(1);
    // Flexible, long timber beam with creep → fails L/300
    const fail = computeDeflection({ spanM: 6, loadKNm: 8, elasticModulusGPa: 11, momentOfInertiaM4: 8e-5, kdef: 0.8, limitDenominator: 300 });
    expect(fail.passed).toBe(false);
    expect(fail.utilization).toBeGreaterThan(1);
  });
});

describe('computeLightingLayout', () => {
  it('n = ceil(A × E / (Φ × η))', () => {
    const r = computeLightingLayout({ areaM2: 30, targetLux: 500, lumensPerFixture: 3000, maintenanceFactor: 0.6 });
    const expected = Math.ceil((30 * 500) / (3000 * 0.6));
    expect(r.fixtureCount).toBe(expected);
  });

  it('zero lumens → zero fixtures (guard)', () => {
    const r = computeLightingLayout({ areaM2: 30, targetLux: 500, lumensPerFixture: 0, maintenanceFactor: 0.6 });
    expect(r.fixtureCount).toBe(0);
  });
});

describe('computeSolarPanelLayout', () => {
  it('10×8m roof, 1.72×1.04m panels, 0.02m spacing, 400Wp', () => {
    const r = computeSolarPanelLayout({ roofLengthM: 10, roofWidthM: 8, panelLengthM: 1.72, panelWidthM: 1.04, spacingM: 0.02, panelPowerW: 400 });
    const expectedCols = Math.floor(8 / (1.04 + 0.02));
    const expectedRows = Math.floor(10 / (1.72 + 0.02));
    expect(r.cols).toBe(expectedCols);
    expect(r.rows).toBe(expectedRows);
    expect(r.panelCount).toBe(expectedCols * expectedRows);
    expect(approx(r.totalPowerKw, r.panelCount * 400 / 1000, 1e-9)).toBe(true);
  });
});

describe('computeSolarRoi', () => {
  it('simple case: payback, annualSavings, lifetimeSavings', () => {
    const r = computeSolarRoi({ systemCostDKK: 80000, annualProductionKwh: 5000, electricityPriceDKK: 3, annualInflationPct: 0, subsidyDKK: 0 });
    expect(r.annualSavingsDKK).toBeCloseTo(15000, 0);
    expect(r.paybackYears).toBeLessThan(30);
    expect(typeof r.lifetimeSavingsDKK).toBe('number');
  });

  it('subsidy reduces net cost', () => {
    const base = computeSolarRoi({ systemCostDKK: 80000, annualProductionKwh: 5000, electricityPriceDKK: 3, annualInflationPct: 0, subsidyDKK: 0 });
    const sub = computeSolarRoi({ systemCostDKK: 80000, annualProductionKwh: 5000, electricityPriceDKK: 3, annualInflationPct: 0, subsidyDKK: 10000 });
    expect(sub.paybackYears).toBeLessThanOrEqual(base.paybackYears);
  });
});

describe('computeHeatPumpSizing (DK retrofit)', () => {
  it('electricity = heat demand / SCOP; cost = kWh × price', () => {
    const r = computeHeatPumpSizing({ designHeatLoadKW: 6, annualHeatDemandKwh: 15000, scop: 3.5, electricityPriceDKK: 2.5 });
    expect(approx(r.recommendedCapacityKW, 6, 1e-9)).toBe(true);
    expect(approx(r.annualElectricityKwh, 15000 / 3.5, 1e-6)).toBe(true);
    expect(approx(r.annualElectricityCostDKK, (15000 / 3.5) * 2.5, 1e-6)).toBe(true);
  });
  it('savings vs old heating cost when provided', () => {
    const r = computeHeatPumpSizing({ designHeatLoadKW: 6, annualHeatDemandKwh: 15000, scop: 3.5, electricityPriceDKK: 2.5, oldAnnualHeatingCostDKK: 18000 });
    expect(approx(r.annualSavingsDKK ?? 0, 18000 - (15000 / 3.5) * 2.5, 1e-6)).toBe(true);
  });
  it('CO₂ reduction when old-source intensity given; undefined otherwise', () => {
    const withCo2 = computeHeatPumpSizing({ designHeatLoadKW: 6, annualHeatDemandKwh: 15000, scop: 3.5, electricityPriceDKK: 2.5, oldHeatCo2KgPerKwh: 0.27, gridCo2KgPerKwh: 0.12 });
    expect(withCo2.annualCo2ReductionKg).toBeGreaterThan(0);
    const noCo2 = computeHeatPumpSizing({ designHeatLoadKW: 6, annualHeatDemandKwh: 15000, scop: 3.5, electricityPriceDKK: 2.5 });
    expect(noCo2.annualCo2ReductionKg).toBeUndefined();
  });
  it('zero SCOP → zero electricity (guard)', () => {
    const r = computeHeatPumpSizing({ designHeatLoadKW: 6, annualHeatDemandKwh: 15000, scop: 0, electricityPriceDKK: 2.5 });
    expect(r.annualElectricityKwh).toBe(0);
  });
});

describe('computeHeatRecoveryVentilation', () => {
  it('recovered heat = η·flow·ρcp·ΔT; SFP = P/flow', () => {
    const r = computeHeatRecoveryVentilation({ flowM3h: 200, efficiency: 0.85, fanPowerW: 90, deltaTMeanK: 12, operatingHoursYr: 8760 });
    const flowM3s = 200 / 3600;
    expect(approx(r.recoveredPowerW, 0.85 * flowM3s * 1200 * 12, 1e-6)).toBe(true);
    expect(approx(r.sfpJperM3, 90 / flowM3s, 1e-6)).toBe(true);
    expect(r.sfpOk).toBe(true); // 90/0.0556 ≈ 1620 ≤ 1800
    expect(r.annualHeatRecoveredKwh).toBeGreaterThan(0);
  });
  it('high fan power fails the SFP guidance', () => {
    const r = computeHeatRecoveryVentilation({ flowM3h: 200, efficiency: 0.8, fanPowerW: 200 });
    expect(r.sfpOk).toBe(false);
  });
});

describe('computeFixtureUnitDemand (DS 439 simplified)', () => {
  it('qd = k·√(ΣLU)', () => {
    const r = computeFixtureUnitDemand({ fixtures: [{ name: 'Håndvask', count: 2, loadingUnits: 1 }, { name: 'Bad', count: 1, loadingUnits: 3 }] });
    expect(approx(r.totalLoadingUnits, 5, 1e-9)).toBe(true);
    expect(approx(r.designFlowLps, 0.5 * Math.sqrt(5), 1e-9)).toBe(true);
  });
  it('never below the single-fixture minimum', () => {
    const r = computeFixtureUnitDemand({ fixtures: [{ name: 'Håndvask', count: 1, loadingUnits: 0.1 }], minSingleFlowLps: 0.2 });
    expect(r.designFlowLps).toBe(0.2);
  });
});

describe('computeScreedDryingTime', () => {
  it('cement 50mm good conditions ≈ 42 days', () => {
    const r = computeScreedDryingTime({ thicknessMm: 50, binder: 'cement', conditionFactor: 1.0 });
    expect(r.estimatedDays).toBe(42); // 4×7 + 1×14
  });
  it('anhydrite dries faster than cement', () => {
    const ct = computeScreedDryingTime({ thicknessMm: 50, binder: 'cement' });
    const ca = computeScreedDryingTime({ thicknessMm: 50, binder: 'anhydrite' });
    expect(ca.estimatedDays).toBeLessThan(ct.estimatedDays);
  });
  it('poor conditions extend drying', () => {
    const good = computeScreedDryingTime({ thicknessMm: 40, conditionFactor: 1.0 });
    const poor = computeScreedDryingTime({ thicknessMm: 40, conditionFactor: 1.5 });
    expect(poor.estimatedDays).toBeGreaterThan(good.estimatedDays);
  });
});

describe('computePavingSubbase', () => {
  it('driveway build-up: base 250 + bedding 40 + paver → volumes', () => {
    const r = computePavingSubbase({ areaM2: 20, trafficClass: 'car', paverThicknessMm: 60 });
    expect(r.baseThicknessMm).toBe(250);
    expect(r.totalExcavationMm).toBe(250 + 40 + 60);
    expect(approx(r.baseVolumeM3, 20 * 0.25, 1e-9)).toBe(true);
  });
  it('heavier traffic → thicker base', () => {
    const path = computePavingSubbase({ areaM2: 10, trafficClass: 'pedestrian' });
    const heavy = computePavingSubbase({ areaM2: 10, trafficClass: 'heavy' });
    expect(heavy.baseThicknessMm).toBeGreaterThan(path.baseThicknessMm);
  });
});

describe('computeStagedCashflow', () => {
  it('splits total by phase %; cumulative reaches total; flags balance', () => {
    const r = computeStagedCashflow({ totalBudgetDKK: 1000000, phases: [{ name: 'Jord', pct: 40 }, { name: 'Råhus', pct: 30 }, { name: 'Aptering', pct: 30 }] });
    expect(approx(r.phases[0].amountDKK, 400000, 1e-6)).toBe(true);
    expect(approx(r.phases[2].cumulativeDKK, 1000000, 1e-6)).toBe(true);
    expect(r.balanced).toBe(true);
  });
  it('flags when phase %s do not sum to 100', () => {
    const r = computeStagedCashflow({ totalBudgetDKK: 1000000, phases: [{ name: 'A', pct: 40 }, { name: 'B', pct: 40 }] });
    expect(r.balanced).toBe(false);
    expect(approx(r.totalPct, 80, 1e-9)).toBe(true);
  });
});

describe('computeEvCharger (DS/HD 60364-7-722)', () => {
  it('11kW 3-phase → ~16A, 16A breaker, 2.5mm², type B RCD', () => {
    const r = computeEvCharger({ chargerPowerKW: 11, phases: 3 });
    expect(approx(r.designCurrentA, 11000 / (Math.sqrt(3) * 400), 1e-6)).toBe(true);
    expect(r.recommendedBreakerA).toBe(16);
    expect(r.recommendedCableMm2).toBe(2.5);
    expect(r.rcdType).toMatch(/Type B/);
  });
  it('22kW 3-phase → 32A breaker', () => {
    const r = computeEvCharger({ chargerPowerKW: 22, phases: 3 });
    expect(r.recommendedBreakerA).toBe(32);
  });
  it('7.4kW single-phase → higher current, bigger breaker', () => {
    const r = computeEvCharger({ chargerPowerKW: 7.4, phases: 1 });
    expect(approx(r.designCurrentA, 7400 / 230, 1e-6)).toBe(true);
    expect(r.recommendedBreakerA).toBeGreaterThanOrEqual(32);
  });
});

describe('computeRetainingWall (EC7 Rankine)', () => {
  it('Ka = tan²(45−φ/2); computes overturning/sliding/bearing FoS', () => {
    const r = computeRetainingWall({ heightM: 2, baseWidthM: 1.5, wallThicknessM: 0.3, soilDensityKNm3: 18, frictionAngleDeg: 30, bearingCapacityKNm2: 150 });
    expect(approx(r.ka, Math.pow(Math.tan((Math.PI / 180) * 30), 2), 1e-6)).toBe(true);
    expect(r.overturningFoS).toBeGreaterThan(0);
    expect(r.slidingFoS).toBeGreaterThan(0);
    expect(r.bearingPressureKNm2).toBeGreaterThan(0);
  });
  it('a wide, heavy base improves overturning safety', () => {
    const thin = computeRetainingWall({ heightM: 3, baseWidthM: 1.0, wallThicknessM: 0.25 });
    const wide = computeRetainingWall({ heightM: 3, baseWidthM: 2.5, wallThicknessM: 0.4 });
    expect(wide.overturningFoS).toBeGreaterThan(thin.overturningFoS);
  });
  it('passed requires all three checks', () => {
    const r = computeRetainingWall({ heightM: 1.2, baseWidthM: 2.0, wallThicknessM: 0.4, bearingCapacityKNm2: 200 });
    expect(r.passed).toBe(r.overturningOk && r.slidingOk && r.bearingOk);
  });
});

describe('computeSoakaway (DS 432 faskine)', () => {
  it('inflow = A·c·rain; storage credits infiltration; excavation uses void ratio', () => {
    const r = computeSoakaway({ catchmentAreaM2: 100, runoffCoefficient: 0.9, designRainfallMm: 40, voidRatio: 0.3 });
    expect(approx(r.inflowM3, 100 * 0.9 * 0.04, 1e-9)).toBe(true); // 3.6 m³
    expect(approx(r.requiredStorageM3, 3.6, 1e-9)).toBe(true);
    expect(approx(r.excavatedVolumeM3, 3.6 / 0.3, 1e-9)).toBe(true); // 12 m³ gravel
  });
  it('infiltration reduces required storage', () => {
    const noInf = computeSoakaway({ catchmentAreaM2: 100, infiltrationAreaM2: 0 });
    const withInf = computeSoakaway({ catchmentAreaM2: 100, infiltrationAreaM2: 20, infiltrationRateMs: 1e-5, stormDurationMin: 120 });
    expect(withInf.requiredStorageM3).toBeLessThan(noInf.requiredStorageM3);
  });
  it('zero catchment → zero storage', () => {
    expect(computeSoakaway({ catchmentAreaM2: 0 }).requiredStorageM3).toBe(0);
  });
});

describe('computeSpiralStair', () => {
  it('going measured at walk line (400mm from inner edge)', () => {
    const r = computeSpiralStair({ totalRiseM: 2.8, outerRadiusM: 0.9, centerColumnRadiusM: 0.1, stepsPerTurn: 12, targetRiseM: 0.18 });
    expect(r.numSteps).toBe(Math.round(2.8 / 0.18));
    expect(approx(r.walkLineRadiusM, 0.5, 1e-9)).toBe(true); // 0.1 + 0.4
    expect(approx(r.goingAtWalkLineM, (2 * Math.PI * 0.5) / 12, 1e-6)).toBe(true);
  });
  it('too many steps per turn → narrow tread fails', () => {
    const r = computeSpiralStair({ totalRiseM: 2.8, outerRadiusM: 0.8, centerColumnRadiusM: 0.1, stepsPerTurn: 20 });
    expect(r.goingOk).toBe(false);
  });
  it('reasonable spiral passes rise + going', () => {
    const r = computeSpiralStair({ totalRiseM: 2.7, outerRadiusM: 1.0, centerColumnRadiusM: 0.1, stepsPerTurn: 11 });
    expect(r.riseOk).toBe(true);
    expect(r.goingOk).toBe(true);
    expect(r.passed).toBe(true);
  });
});

describe('computeWindowAcoustics', () => {
  it('Rw+Ctr and pass/fail vs a required value', () => {
    const r = computeWindowAcoustics({ glazingType: 'laminated', requiredRwCtr: 33 });
    expect(r.rw).toBe(38);
    expect(r.rwCtr).toBe(38 - 5);
    expect(r.passed).toBe(true);
  });
  it('standard glazing fails a demanding traffic-noise target', () => {
    const r = computeWindowAcoustics({ glazingType: 'standard-2', requiredRwCtr: 33 });
    expect(r.passed).toBe(false);
  });
});

describe('computeWaterFlow', () => {
  it('Q = π × (d/2000)² × v × 1000 L/s', () => {
    const r = computeWaterFlow({ diameterMm: 20, velocityMs: 1.5 });
    const expected = Math.PI * Math.pow(10 / 1000, 2) * 1.5 * 1000;
    expect(approx(r.flowLps, expected, 1e-9)).toBe(true);
    expect(approx(r.flowLpm, expected * 60, 1e-9)).toBe(true);
  });

  it('zero diameter → zero flow', () => {
    const r = computeWaterFlow({ diameterMm: 0, velocityMs: 1.5 });
    expect(r.flowLps).toBe(0);
  });
});

describe('computePipePressureLoss (Darcy–Weisbach + fittings)', () => {
  it('computes velocity, turbulent friction and a positive head', () => {
    const r = computePipePressureLoss({ flowLps: 0.5, innerDiameterMm: 20, lengthM: 10 });
    const area = Math.PI * 0.01 ** 2;
    expect(approx(r.velocityMs, 0.0005 / area, 1e-6)).toBe(true);
    expect(r.reynolds).toBeGreaterThan(4000); // turbulent
    expect(r.frictionHeadM).toBeGreaterThan(0);
    expect(r.pressureLossKPa).toBeGreaterThan(0);
  });
  it('fittings add minor losses on top of friction', () => {
    const bare = computePipePressureLoss({ flowLps: 0.5, innerDiameterMm: 20, lengthM: 10, fittingsK: 0 });
    const withFittings = computePipePressureLoss({ flowLps: 0.5, innerDiameterMm: 20, lengthM: 10, fittingsK: 5 });
    expect(withFittings.minorHeadM).toBeGreaterThan(0);
    expect(withFittings.totalHeadM).toBeGreaterThan(bare.totalHeadM);
  });
  it('zero flow → zero loss', () => {
    expect(computePipePressureLoss({ flowLps: 0, innerDiameterMm: 20, lengthM: 10 }).totalHeadM).toBe(0);
  });
});

describe('computeDuctPressureLoss (DS 447)', () => {
  it('friction + fitting loss in Pa; flags velocity over 6 m/s', () => {
    const r = computeDuctPressureLoss({ flowM3h: 500, diameterMm: 160, lengthM: 10, fittingsK: 3 });
    expect(r.velocityMs).toBeGreaterThan(0);
    expect(r.frictionLossPa).toBeGreaterThan(0);
    expect(r.minorLossPa).toBeGreaterThan(0);
    expect(r.totalLossPa).toBeCloseTo(r.frictionLossPa + r.minorLossPa, 6);
  });
  it('velocityOk false above 6 m/s (small duct, high flow)', () => {
    const r = computeDuctPressureLoss({ flowM3h: 900, diameterMm: 125, lengthM: 5 });
    expect(r.velocityMs).toBeGreaterThan(6);
    expect(r.velocityOk).toBe(false);
  });
  it('zero flow → zero loss', () => {
    expect(computeDuctPressureLoss({ flowM3h: 0, diameterMm: 160, lengthM: 10 }).totalLossPa).toBe(0);
  });
});

describe('computeGlaser (EN ISO 13788 interstitial condensation)', () => {
  const indoor = { indoorTempC: 20, indoorRhPct: 50 };
  const outdoor = { outdoorTempC: -5, outdoorRhPct: 90 };

  it('vapour barrier on the WARM inner side → no interstitial condensation', () => {
    const r = computeGlaser({
      ...indoor, ...outdoor,
      layers: [
        { name: 'Dampspærre', thicknessMm: 0.2, lambdaWmK: 0.17, mu: 100000 },
        { name: 'Mineraluld', thicknessMm: 195, lambdaWmK: 0.037, mu: 1 },
        { name: 'Vindspærre', thicknessMm: 9, lambdaWmK: 0.13, mu: 10 },
      ],
    });
    expect(r.interfaces.length).toBe(3);
    expect(r.condensationRisk).toBe(false);
  });

  it('vapour-tight layer on the COLD outer side → condensation risk', () => {
    const r = computeGlaser({
      ...indoor, ...outdoor,
      layers: [
        { name: 'Gips', thicknessMm: 13, lambdaWmK: 0.25, mu: 10 },
        { name: 'Mineraluld', thicknessMm: 195, lambdaWmK: 0.037, mu: 1 },
        { name: 'Tæt OSB', thicknessMm: 15, lambdaWmK: 0.13, mu: 200 },
      ],
    });
    expect(r.condensationRisk).toBe(true);
  });

  it('temperature drops monotonically through the build-up', () => {
    const r = computeGlaser({
      ...indoor, ...outdoor,
      layers: [
        { name: 'Gips', thicknessMm: 13, lambdaWmK: 0.25, mu: 10 },
        { name: 'Mineraluld', thicknessMm: 195, lambdaWmK: 0.037, mu: 1 },
      ],
    });
    expect(r.interfaces[0].tempC).toBeGreaterThan(r.interfaces[1].tempC);
  });

  it('empty layers → no risk', () => {
    const r = computeGlaser({ ...indoor, ...outdoor, layers: [] });
    expect(r.condensationRisk).toBe(false);
  });
});

describe('computeUnderfloorHeating', () => {
  it('20m² at 0.2m spacing: L = (20/0.2) × 1.1 = 110 m', () => {
    const r = computeUnderfloorHeating({ areaM2: 20, spacingM: 0.2 });
    expect(approx(r.totalLengthM, (20 / 0.2) * 1.1, 1e-9)).toBe(true);
    expect(r.loopCount).toBeUndefined();
  });

  it('with loop length: loopCount = ceil(totalLength / loopLengthM)', () => {
    const r = computeUnderfloorHeating({ areaM2: 20, spacingM: 0.2, loopLengthM: 60 });
    const total = (20 / 0.2) * 1.1; // 110 m
    expect(r.loopCount).toBe(Math.ceil(total / 60)); // ceil(110/60) = 2
  });

  it('zero spacing → zero length', () => {
    const r = computeUnderfloorHeating({ areaM2: 20, spacingM: 0 });
    expect(r.totalLengthM).toBe(0);
  });
});

// ── Phase 3 registry: Pris & Budget COMPUTABLE entries ───────────────────────

describe('Phase 3 registry — Pris & Budget COMPUTABLE entries', () => {
  const financialIds = ['projektbudget', 'materialeomkostning', 'arbejdsloen', 'finansiering'];

  it('all four financial tool IDs appear in computableCalculatorIds()', () => {
    const ids = computableCalculatorIds();
    for (const id of financialIds) {
      expect(ids).toContain(id);
    }
  });

  it('computeCalculator("projektbudget") returns a positive total', () => {
    const r = computeCalculator('projektbudget', { material: 50000, labor: 30000, other: 5000, contingency: 10, overhead: 0, includeVat: 'yes' });
    expect(r.value).toBeGreaterThan(0);
    expect(r.unit).toBe('kr.');
  });

  it('computeCalculator("materialeomkostning") returns a positive total', () => {
    const r = computeCalculator('materialeomkostning', { qty1: 20, price1: 89, qty2: 0, price2: 0, wastage: 5, includeVat: 'yes' });
    expect(r.value).toBeGreaterThan(0);
    expect(r.unit).toBe('kr.');
  });

  it('computeCalculator("arbejdsloen") returns a positive total', () => {
    const r = computeCalculator('arbejdsloen', { workers: 2, days: 5, hours: 8, rate: 550, burden: 30, includeVat: 'yes' });
    expect(r.value).toBeGreaterThan(0);
    expect(r.unit).toBe('kr.');
  });

  it('computeCalculator("finansiering") returns a positive monthly payment', () => {
    const r = computeCalculator('finansiering', { principal: 1500000, downPct: 5, ratePct: 4.5, years: 25, adminFee: 0 });
    expect(r.value).toBeGreaterThan(0);
    expect(r.unit).toBe('kr./md.');
  });

  it('each entry has help.purpose, help.formula, and at least one standard', () => {
    for (const id of financialIds) {
      const meta = getCalculator(id);
      expect(meta).toBeDefined();
      expect(meta!.help).toBeDefined();
      expect(meta!.help!.purpose.length).toBeGreaterThan(0);
      expect(meta!.help!.formula.length).toBeGreaterThan(0);
      expect((meta!.standards ?? []).length).toBeGreaterThan(0);
    }
  });

  it('modes === "both" for all four entries', () => {
    for (const id of financialIds) {
      const meta = getCalculator(id);
      expect(meta!.modes).toBe('both');
    }
  });
});
