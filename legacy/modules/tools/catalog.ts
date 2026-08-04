// ─────────────────────────────────────────────────────────────────────────────
// Programmatic bridge to the app's calculators.
//
// The most purchase-relevant calculator formulas are extracted here as pure
// functions. The calculator pages (pages/calculators/**) import and reuse the
// SAME functions, so formulas live in exactly one place. The remaining
// calculators are exposed as link-out entries (route to the calculator page).
//
// Consumers:
//   - components/calculators/CalculatorPickerModal.tsx (inline compute UI)
//   - services/onboardingIntelligence.ts (deterministic quantity checks)
//   - pages/calculators/** (the calculator pages themselves)
// ─────────────────────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────────────────

export interface CalculatorInputOption {
  label: string;
  value: string;
}

export interface CalculatorInputDef {
  id: string;
  label: string;
  unit?: string;
  type?: 'number' | 'select';
  options?: CalculatorInputOption[];
  defaultValue: string;
  info?: string;
  /** Only shown when another input has a specific value, e.g. { shape: 'column' }. */
  visibleWhen?: Record<string, string>;
  /** Which mode this input belongs to. Omit for inputs shared across both modes. */
  mode?: 'basic' | 'advanced';
}

export interface CalculatorStandard {
  /** E.g. 'DS/EN 1992-1-1', 'BR18'. */
  code: string;
  /** E.g. '§418', 'tabel NA.1'. */
  clause?: string;
  /** Plain-language Danish note. */
  note?: string;
}

export interface CalculatorHelpVariable {
  symbol: string;
  label: string;
  unit: string;
  description: string;
}

export interface CalculatorHelp {
  /** Danish: what this tool calculates and when to use it. */
  purpose: string;
  variables: CalculatorHelpVariable[];
  /** Danish formula string, e.g. 'V = L × B × t × antal × (1 + spild%)'. */
  formula: string;
  /** Danish list of simplifying assumptions (waste factors, density tables, …). */
  assumptions: string[];
  /** Optional: a concrete worked-through example in Danish. */
  workedExample?: string;
  /** Plain-language explanation of the governing standard(s). */
  standardsExplained: string;
}

/**
 * Converts a registry CalculatorHelp entry into the HelpContent shape consumed
 * by HelpDrawer / CalculatorPage, so callers never reshape data manually.
 */
export function catalogHelpToContent(
  help: CalculatorHelp,
  standards?: CalculatorStandard[],
): import('./components/HelpDrawer').HelpContent {
  return {
    formaal: help.purpose,
    variabler: help.variables.map(v => ({
      name: v.label,
      symbol: v.symbol,
      unit: v.unit,
      description: v.description,
    })),
    formel: help.formula,
    antagelser: help.assumptions,
    workedExample: help.workedExample,
    standarder: help.standardsExplained,
    standarderStruktureret: standards,
  };
}

export interface CalculatorMeta {
  id: string;
  name: string;
  category: string;
  route: string;
  /** Unit of the primary result, e.g. 'm³', 'stk.', 'liter'. Empty for link-only tools. */
  resultUnit: string;
  /** True when computeCalculator(id, inputs) is supported. */
  computable: boolean;
  inputs?: CalculatorInputDef[];
  /** Which calculation modes the tool supports. Defaults to 'basic'. */
  modes?: 'basic' | 'advanced' | 'both';
  /** Governing standards for this tool. */
  standards?: CalculatorStandard[];
  /** When true, renders an engineer/authorised-pro disclaimer. */
  safetyCritical?: boolean;
  /** Content for the help drawer. */
  help?: CalculatorHelp;
}

export interface CalculatorBreakdownLine {
  label: string;
  value: number;
  unit: string;
}

export interface CalculatorResult {
  /** Primary result value. */
  value: number;
  /** Unit of the primary result. */
  unit: string;
  /** Short Danish summary, e.g. '3.2 m³ beton (C25/30) inkl. 5% spild'. */
  summary: string;
  breakdown?: CalculatorBreakdownLine[];
}

// ── Standards catalog ────────────────────────────────────────────────────────
// Typed map from domain key → standard definitions. Used by help drawers,
// calculator pages, and PDF export. Add new entries as more formulas land.

export type StandardsDomain =
  | 'statics'
  | 'electrical'
  | 'water'
  | 'drainage'
  | 'heating'
  | 'energy'
  | 'moisture'
  | 'ventilation'
  | 'geometry'
  | 'quantities'
  | 'concrete'
  | 'timber'
  | 'excavation';

export const STANDARDS_CATALOG: Record<StandardsDomain, CalculatorStandard[]> = {
  statics: [
    { code: 'DS/EN 1990', clause: 'EC0', note: 'Grundlag for bærende konstruktioner — lastkombinationer og sikkerhed.' },
    { code: 'DS/EN 1991-1-1', clause: 'EC1', note: 'Egenlast og nyttelast på bygninger.' },
    { code: 'DS/EN 1991-1-3', clause: 'EC1 sne', note: 'Snelast — DK nationalt anneks: sk = 1,0 kN/m² (zone DK1).' },
    { code: 'DS/EN 1991-1-4', clause: 'EC1 vind', note: 'Vindlast — DK nationalt anneks: vb,0 = 24 m/s.' },
    { code: 'DS/EN 1992-1-1', clause: 'EC2', note: 'Betonkonstruktioner — dæklag, armering, revnesikring.' },
    { code: 'DS/EN 1993-1-1', clause: 'EC3', note: 'Stålkonstruktioner.' },
    { code: 'DS/EN 1995-1-1', clause: 'EC5', note: 'Trækonstruktioner — spær, bjælker.' },
  ],
  electrical: [
    { code: 'DS/HD 60364-5-52', note: 'Kabelvalg og strømbelastningsevne.' },
    { code: 'DS/HD 60364-5-54', note: 'Jordforbindelse og beskyttelsesledere.' },
    { code: 'DS/HD 60364-4-41', note: 'Beskyttelse mod elektrisk stød.' },
    { code: 'DS/HD 60364', note: 'Max. spændingsfald ≤ 4% (ΔU ≤ 4%) for boliger og kontor.' },
  ],
  water: [
    { code: 'DS 439', note: 'Norm for vandinstallationer — dimensionering af vandrør.' },
  ],
  drainage: [
    { code: 'DS 432', note: 'Norm for afløbsinstallationer — minimumsfald 1:40 (25‰) for gravitetsafløb.' },
  ],
  heating: [
    { code: 'DS 469', note: 'Norm for varme- og køleanlæg — dimensionering af radiatorer og gulvvarme.' },
  ],
  energy: [
    { code: 'BR18', clause: '§258–§272', note: 'Energiramme-krav for nye bygninger.' },
    { code: 'DS 418', note: 'Beregning af bygningers varmetab.' },
    { code: 'DS/EN ISO 6946', note: 'Varmemodstand og U-værdiberegning for konstruktioner.' },
  ],
  moisture: [
    { code: 'DS/EN ISO 13788', note: 'Hygrothermisk beregning — dugpunkt og kondensationsrisiko.' },
  ],
  ventilation: [
    { code: 'BR18', clause: '§425–§445', note: 'Ventilationskrav for boliger og erhverv.' },
    { code: 'DS 447', note: 'Ventilationsanlæg — kanaldimensionering og lufthastigheder.' },
  ],
  geometry: [
    { code: 'BR18', clause: 'Bilag A', note: 'Beregning af etageareal og BBR-areal.' },
  ],
  quantities: [
    { code: 'BR18', note: 'Vejledende spildfaktorer og materialedækningsevne fra producenter.' },
  ],
  concrete: [
    { code: 'DS/EN 1992-1-1', clause: 'EC2', note: 'Betonkonstruktioner — styrke­klasser og mørtelforhold.' },
    { code: 'BR18', clause: '§418', note: 'Krav til beton i kontakt med jord.' },
  ],
  timber: [
    { code: 'DS/EN 1995-1-1', clause: 'EC5', note: 'Trækonstruktioner — dimensionering og samlinger.' },
  ],
  excavation: [
    { code: 'AT-vejledning D.2.17', note: 'Udgravninger — skråningsanlæg/afstivning krævet ved dybde > 1,7 m. Anlæg: sand/grus 1:1, ler 1:0,5, klippe 1:0,18.' },
    { code: 'DS/EN ISO 14688', note: 'Geoteknisk klassifikation af jordarter — grundlag for jordtypevalg og komprimeringskontrol.' },
  ],
};

// ── Pure formula functions (single source of truth) ─────────────────────────
// These are imported by the calculator pages — do not duplicate the math.

export type ConcreteShape = 'slab' | 'footing' | 'column';

export interface ConcreteInput {
  shape: ConcreteShape;
  length: number;
  width: number;
  depth: number;
  diameter: number;
  quantity: number;
  wastagePct: number;
  /** kg/m³ — depends on concrete quality class (C20/25≈2300, C25/30≈2400, C30/37≈2450). */
  density: number;
}

export const computeConcreteVolume = (
  input: ConcreteInput
): { volume: number; weightKg: number } => {
  const { shape, length, width, depth, diameter, quantity, wastagePct, density } = input;
  let baseVol = 0;
  if (shape === 'slab' || shape === 'footing') {
    baseVol = length * width * depth;
  } else if (shape === 'column') {
    const r = diameter / 2;
    baseVol = Math.PI * Math.pow(r, 2) * depth;
  }
  const volume = Math.max(0, baseVol * (quantity || 1) * (1 + wastagePct / 100));
  return { volume, weightKg: volume * density };
};

export type MixRatioType = '1:3:5' | '1:2:3' | '1:4';

export const computeMixRatio = (
  mixType: MixRatioType,
  volumeLiters: number
): { cement: number; sand: number; stone: number; water: number; cementBags: number } => {
  const vol = volumeLiters || 0;
  let c = 0;
  let s = 0;
  let st = 0;

  if (mixType === '1:3:5') {
    const totalParts = 1 + 3 + 5;
    const dryVol = vol * 1.5;
    c = (1 / totalParts) * dryVol;
    s = (3 / totalParts) * dryVol;
    st = (5 / totalParts) * dryVol;
  } else if (mixType === '1:2:3') {
    const totalParts = 1 + 2 + 3;
    const dryVol = vol * 1.5;
    c = (1 / totalParts) * dryVol;
    s = (2 / totalParts) * dryVol;
    st = (3 / totalParts) * dryVol;
  } else if (mixType === '1:4') {
    const totalParts = 1 + 4;
    const dryVol = vol * 1.3; // Less shrinkage without stone
    c = (1 / totalParts) * dryVol;
    s = (4 / totalParts) * dryVol;
    st = 0;
  }

  c = Math.max(0, c);
  s = Math.max(0, s);
  st = Math.max(0, st);
  const water = c * 0.6;
  // 25kg cement bag is approx 18 liters
  const cementBags = Math.ceil(c / 18);
  return { cement: c, sand: s, stone: st, water, cementBags };
};

export const computeTileQuantity = (input: {
  areaL: number;
  areaW: number;
  tileLcm: number;
  tileWcm: number;
  groutMm: number;
  wastagePct: number;
}): { numTiles: number; totalArea: number } => {
  const { areaL, areaW, tileLcm, tileWcm, groutMm, wastagePct } = input;
  if (areaL <= 0 || areaW <= 0 || tileLcm <= 0 || tileWcm <= 0) {
    return { numTiles: 0, totalArea: 0 };
  }
  const floorArea = areaL * areaW;
  const tileL = tileLcm / 100;
  const tileW = tileWcm / 100;
  const grout = groutMm / 1000;
  const tileAreaWithGrout = (tileL + grout) * (tileW + grout);
  const rawTilesNeeded = floorArea / tileAreaWithGrout;
  const tilesWithWastage = rawTilesNeeded * (1 + wastagePct / 100);
  const numTiles = Math.ceil(tilesWithWastage);
  return { numTiles, totalArea: numTiles * tileL * tileW };
};

export const computePaintAmount = (input: {
  area: number;
  primerCoats: number;
  primerCoverage: number;
  paintCoats: number;
  paintCoverage: number;
}): { primerLiters: number; paintLiters: number } => {
  const { area, primerCoats, primerCoverage, paintCoats, paintCoverage } = input;
  const primerLiters = primerCoverage > 0 ? (area * primerCoats) / primerCoverage : 0;
  const paintLiters = paintCoverage > 0 ? (area * paintCoats) / paintCoverage : 0;
  return { primerLiters, paintLiters };
};

export const computePlasterboard = (input: {
  wallL: number;
  wallH: number;
  boardL: number;
  boardW: number;
  layers: number;
  wastagePct: number;
}): { numBoards: number } => {
  const { wallL, wallH, boardL, boardW, layers, wastagePct } = input;
  if (wallL <= 0 || wallH <= 0 || boardL <= 0 || boardW <= 0 || layers <= 0) {
    return { numBoards: 0 };
  }
  const wallArea = wallL * wallH * layers;
  const boardArea = boardL * boardW;
  const rawBoards = wallArea / boardArea;
  return { numBoards: Math.ceil(rawBoards * (1 + wastagePct / 100)) };
};

export const computePlasterAmount = (input: {
  area: number;
  thicknessMm: number;
  yieldKgPerM2PerMm: number;
}): { totalKg: number } => {
  const { area, thicknessMm, yieldKgPerM2PerMm } = input;
  if (area <= 0 || thicknessMm <= 0 || yieldKgPerM2PerMm <= 0) return { totalKg: 0 };
  return { totalKg: area * thicknessMm * yieldKgPerM2PerMm };
};

/** Shared by wall- and ceiling insulation (samme formel). */
export const computeInsulationBatts = (input: {
  areaL: number;
  areaW: number;
  battL: number;
  battW: number;
}): { numBatts: number } => {
  const { areaL, areaW, battL, battW } = input;
  if (areaL <= 0 || areaW <= 0 || battL <= 0 || battW <= 0) return { numBatts: 0 };
  return { numBatts: Math.ceil((areaL * areaW) / (battL * battW)) };
};

export const computeFloorInsulation = (input: {
  areaL: number;
  areaW: number;
  boardL: number;
  boardW: number;
}): { numBoards: number; totalArea: number } => {
  const { areaL, areaW, boardL, boardW } = input;
  if (areaL <= 0 || areaW <= 0 || boardL <= 0 || boardW <= 0) {
    return { numBoards: 0, totalArea: 0 };
  }
  const boardArea = boardL * boardW;
  const numBoards = Math.ceil((areaL * areaW) / boardArea);
  return { numBoards, totalArea: numBoards * boardArea };
};

export interface WoodFloorPlan {
  firstRowWidth: number;
  lastRowWidth: number;
  numFullWidthRows: number;
  totalRows: number;
  planksPerRow: number;
}

export const computeWoodFloor = (input: {
  length: number;
  width: number;
  wastagePct: number;
  plankWidthMm: number;
  plankLengthMm: number;
}): { area: number; plan: WoodFloorPlan } => {
  const { length, width, wastagePct, plankWidthMm, plankLengthMm } = input;
  const roomWidthMm = width * 1000;
  const roomLengthMm = length * 1000;

  const area = length * width * (1 + wastagePct / 100);

  let plan: WoodFloorPlan = {
    firstRowWidth: 0,
    lastRowWidth: 0,
    numFullWidthRows: 0,
    totalRows: 0,
    planksPerRow: 0,
  };

  if (roomWidthMm > 0 && plankWidthMm > 0 && roomLengthMm > 0 && plankLengthMm > 0) {
    const MIN_FINAL_WIDTH_MM = 50;
    const numPossible = Math.floor(roomWidthMm / plankWidthMm);
    const remainder = roomWidthMm % plankWidthMm;
    let first = 0;
    let last = 0;
    let full = 0;

    if (remainder < MIN_FINAL_WIDTH_MM && numPossible > 0) {
      // remainder === 0 also lands here (0 < 50), giving a symmetric split on both edges.
      // If splitting one plank's worth still leaves a sub-minimum edge row (narrow planks,
      // e.g. 60-90mm engineered strips), borrow whole planks from the full-width count
      // into the shared edge pool until both edges clear the minimum. Total width is
      // conserved either way.
      let sharedWidth = plankWidthMm + remainder;
      let fullRows = numPossible - 1;
      while (sharedWidth / 2 < MIN_FINAL_WIDTH_MM && fullRows > 0) {
        sharedWidth += plankWidthMm;
        fullRows -= 1;
      }
      first = sharedWidth / 2;
      last = sharedWidth / 2;
      full = fullRows;
    } else {
      first = plankWidthMm;
      last = remainder;
      full = numPossible - 1;
    }
    if (numPossible === 0) {
      first = roomWidthMm;
      last = 0;
      full = 0;
    }

    const totalRows = full + (first > 0 ? 1 : 0) + (last > 0 ? 1 : 0);
    const planksPerRow = Math.ceil(roomLengthMm / plankLengthMm);
    plan = { firstRowWidth: first, lastRowWidth: last, numFullWidthRows: full, totalRows, planksPerRow };
  }

  return { area, plan };
};

export const computeCarpetLaminate = (input: {
  length: number;
  width: number;
  wastagePct: number;
}): { area: number } => {
  const { length, width, wastagePct } = input;
  if (length <= 0 || width <= 0) return { area: 0 };
  return { area: Math.max(0, length * width * (1 + wastagePct / 100)) };
};

export const computeScreed = (input: {
  length: number;
  width: number;
  thicknessMm: number;
  wastagePct: number;
}): { volumeM3: number; bags: number } => {
  const { length, width, thicknessMm, wastagePct } = input;
  if (length <= 0 || width <= 0 || thicknessMm <= 0) return { volumeM3: 0, bags: 0 };
  const volume = length * width * (thicknessMm / 1000);
  const volumeWithWastage = Math.max(0, volume * (1 + wastagePct / 100));
  // ~2000kg dry mix per m³ finished screed → 80 bags (25kg) per m³
  return { volumeM3: volumeWithWastage, bags: Math.ceil(volumeWithWastage * 80) };
};

export const computeBrickBlock = (input: {
  wallL: number;
  wallH: number;
  brickLmm: number;
  brickHmm: number;
  jointMm: number;
  wastagePct: number;
  /** Wall/brick depth (stenbredde) — standard Danish brick is 108mm for a single-wythe (half-brick) wall. */
  brickDepthMm?: number;
}): { numBricks: number; mortarVolume: number } => {
  const { wallL, wallH, brickLmm, brickHmm, jointMm, wastagePct, brickDepthMm = 108 } = input;
  if (wallL <= 0 || wallH <= 0 || brickLmm <= 0 || brickHmm <= 0) {
    return { numBricks: 0, mortarVolume: 0 };
  }
  const wallArea = wallL * wallH;
  const moduleArea = ((brickLmm + jointMm) / 1000) * ((brickHmm + jointMm) / 1000);
  const brickFaceArea = (brickLmm / 1000) * (brickHmm / 1000);
  const rawBricks = wallArea / moduleArea;
  const numBricks = Math.ceil(rawBricks * (1 + wastagePct / 100));
  // Mortar fills the joint gaps around each brick module, through the wall's depth —
  // scales with actual brick/joint geometry instead of a flat per-m² constant.
  const mortarFraction = Math.max(0, 1 - brickFaceArea / moduleArea);
  const mortarVolume = wallArea * (brickDepthMm / 1000) * mortarFraction;
  return { numBricks, mortarVolume };
};

export const computePaving = (input: {
  length: number;
  width: number;
  stoneLcm: number;
  stoneWcm: number;
  wastagePct: number;
  gravelDepthM: number;
  sandDepthM: number;
}): { area: number; stones: number; gravelVol: number; sandVol: number } => {
  const { length, width, stoneLcm, stoneWcm, wastagePct, gravelDepthM, sandDepthM } = input;
  const sL = stoneLcm / 100 || 0.21;
  const sW = stoneWcm / 100 || 0.14;
  const stoneA = sL * sW;
  const area = length * width;
  const gravelVol = area * (gravelDepthM || 0);
  const sandVol = area * (sandDepthM || 0);
  let stones = 0;
  if (stoneA > 0) {
    stones = Math.ceil((area / stoneA) * (1 + wastagePct / 100));
  }
  return { area, stones, gravelVol, sandVol };
};

// ── New formula functions (Phase 1 rollout) ──────────────────────────────────

export const computeRoomArea = (input: {
  shape: 'rectangle' | 'l-shape';
  rectL?: number; rectW?: number;
  lA?: number; lB?: number; lC?: number; lD?: number;
  deductions?: number;
}): { area: number; grossArea: number } => {
  const { shape, rectL = 0, rectW = 0, lA = 0, lB = 0, lC = 0, lD = 0, deductions = 0 } = input;
  let grossArea = 0;
  if (shape === 'rectangle') {
    grossArea = rectL * rectW;
  } else {
    grossArea = (lA * lB) + (lC * lD);
  }
  return { grossArea, area: Math.max(0, grossArea - deductions) };
};

export const computeWallAreaWithDeductions = (input: {
  length: number; width: number; height: number;
  doors: number; doorW: number; doorH: number;
  windows: number; windowW: number; windowH: number;
}): { grossArea: number; netArea: number; deductions: number } => {
  const { length, width, height, doors, doorW, doorH, windows, windowW, windowH } = input;
  const perimeter = 2 * (length + width);
  const grossArea = perimeter * height;
  const deductions = doors * doorW * doorH + windows * windowW * windowH;
  return { grossArea, netArea: Math.max(0, grossArea - deductions), deductions };
};

export const computeVolume = (input: {
  length: number; width: number; height: number;
}): { volume: number; ceilingHeightOk: boolean } => {
  const { length, width, height } = input;
  return { volume: length * width * height, ceilingHeightOk: height >= 2.3 };
};

export type SoilType = 'sand' | 'clay' | 'gravel' | 'rock';

// Rock swell varies widely with fragmentation (30-60%+); 45% is a defensible mid-range
// default for blasted rock, but always verify against the project's geotechnical report.
const SOIL_SWELL: Record<SoilType, number> = { sand: 12, clay: 25, gravel: 10, rock: 45 };
const SOIL_SLOPE_RATIO: Record<SoilType, number> = { sand: 1.0, clay: 0.5, gravel: 1.0, rock: 0.18 };

export const computeExcavation = (input: {
  length: number; width: number; depth: number;
  soilType?: SoilType;
}): { inSitu: number; loose: number; swellPct: number } => {
  const { length, width, depth, soilType = 'clay' } = input;
  const swellPct = SOIL_SWELL[soilType];
  const inSitu = length * width * depth;
  return { inSitu, loose: inSitu * (1 + swellPct / 100), swellPct };
};

export const computeExcavationSlope = (input: {
  bottomWidth: number; depth: number; length: number;
  soilType?: SoilType;
}): { topWidth: number; volume: number; setback: number; slopeRatio: number } => {
  const { bottomWidth, depth, length, soilType = 'clay' } = input;
  const slopeRatio = SOIL_SLOPE_RATIO[soilType];
  const setback = depth * slopeRatio;
  const topWidth = bottomWidth + 2 * setback;
  const volume = ((bottomWidth + topWidth) / 2) * depth * length;
  return { topWidth, volume, setback, slopeRatio };
};

// ── Trench safety checker (Arbejdstilsynet AT-vejledning D.2.17) ───────────────
// Maps excavation depth + soil to the required worker-safety measure: vertical
// sides, battered slopes, or mandatory shoring/engineering review above 1,7 m.

export const computeTrenchSafety = (input: {
  depthM: number;
  soilType?: SoilType;
}): {
  requiresSupport: boolean;
  batterRatio: number;
  minSetbackM: number;
  batteredTopWidthPerSideM: number;
  action: 'vertical-ok' | 'batter-or-shore' | 'engineer-required';
  riskLevel: 'low' | 'medium' | 'high';
} => {
  const { depthM, soilType = 'clay' } = input;
  const batterRatio = SOIL_SLOPE_RATIO[soilType];
  const minSetbackM = depthM * batterRatio;
  // AT D.2.17: > 1,7 m requires documented battering or shoring; deep excavations
  // (> 5 m) or soft/rock ground warrant a geotechnical/engineering review.
  let action: 'vertical-ok' | 'batter-or-shore' | 'engineer-required';
  let riskLevel: 'low' | 'medium' | 'high';
  if (depthM <= 1.7) {
    action = 'vertical-ok';
    riskLevel = 'low';
  } else if (depthM <= 5) {
    action = 'batter-or-shore';
    riskLevel = 'medium';
  } else {
    action = 'engineer-required';
    riskLevel = 'high';
  }
  return {
    requiresSupport: depthM > 1.7,
    batterRatio,
    minSetbackM,
    batteredTopWidthPerSideM: minSetbackM,
    action,
    riskLevel,
  };
};

// ── Loft/skunk floor area with BR18 Bilag 1 height rule ───────────────────────
// BR18 counts floor area only where the (sloping) ceiling height ≥ 1,5 m, and a
// habitable room needs a portion at full height (≥ 2,3 m). This computes those
// qualifying areas for a room whose ceiling slopes up from a knee wall.

export const computeLoftArea = (input: {
  roomLengthM: number;
  /** Width across the slope (from the low knee wall to the high side). */
  roomWidthM: number;
  /** Knee (dwarf) wall height at the low side [m]. */
  kneeWallHeightM: number;
  /** Roof/ceiling pitch [°]. */
  pitchDeg: number;
  minHeightM?: number;
  fullHeightM?: number;
}): {
  totalFloorAreaM2: number;
  countedAreaM2: number;
  fullHeightAreaM2: number;
  distanceToMinM: number;
  distanceToFullM: number;
} => {
  const { roomLengthM: L, roomWidthM: W, kneeWallHeightM: hk, pitchDeg, minHeightM = 1.5, fullHeightM = 2.3 } = input;
  const totalFloorAreaM2 = Math.max(0, L * W);
  if (L <= 0 || W <= 0) {
    return { totalFloorAreaM2: 0, countedAreaM2: 0, fullHeightAreaM2: 0, distanceToMinM: 0, distanceToFullM: 0 };
  }
  const tan = Math.tan((pitchDeg * Math.PI) / 180);
  // Horizontal distance from the knee wall to where the ceiling reaches a target height.
  const distTo = (target: number): number => {
    if (hk >= target) return 0;               // already tall enough at the wall
    if (tan <= 0) return W;                    // flat ceiling below target → never reaches it
    return Math.min(W, (target - hk) / tan);
  };
  const distanceToMinM = distTo(minHeightM);
  const distanceToFullM = distTo(fullHeightM);
  return {
    totalFloorAreaM2,
    countedAreaM2: L * Math.max(0, W - distanceToMinM),   // area with height ≥ 1,5 m
    fullHeightAreaM2: L * Math.max(0, W - distanceToFullM), // area with height ≥ 2,3 m
    distanceToMinM,
    distanceToFullM,
  };
};

export const computeBackfill = (input: {
  excavatedVol: number; structureVol: number; compactionPct: number;
}): { netFill: number; looseNeeded: number; excess: number } => {
  const { excavatedVol, structureVol, compactionPct } = input;
  const netFill = Math.max(0, excavatedVol - structureVol);
  const looseNeeded = netFill * (1 + compactionPct / 100);
  // excavatedVol is in-situ (bank) measure; once dug up it swells loose by roughly the
  // same %, so compare like-for-like (loose vs. loose) instead of bank vs. loose.
  const excavatedLoose = excavatedVol * (1 + compactionPct / 100);
  return { netFill, looseNeeded, excess: Math.max(0, excavatedLoose - looseNeeded) };
};

export const computeEscapeWindow = (input: {
  widthCm: number; heightCm: number; heightAboveFloorCm: number;
}): { w: number; h: number; sum: number; heightCheck: boolean; widthCheck: boolean; sumCheck: boolean; floorCheck: boolean; passed: boolean } => {
  const { widthCm, heightCm, heightAboveFloorCm } = input;
  const w = widthCm / 100;
  const h = heightCm / 100;
  const sum = w + h;
  const heightCheck = h >= 0.6;
  const widthCheck = w >= 0.5;
  const sumCheck = sum >= 1.5;
  const floorCheck = heightAboveFloorCm <= 120;
  return { w, h, sum, heightCheck, widthCheck, sumCheck, floorCheck, passed: heightCheck && widthCheck && sumCheck };
};

export const computeWindowDaylight = (input: {
  windowAreaM2: number; floorAreaM2: number;
}): { ratio: number; passed: boolean } => {
  const { windowAreaM2, floorAreaM2 } = input;
  const ratio = floorAreaM2 > 0 ? (windowAreaM2 / floorAreaM2) * 100 : 0;
  return { ratio, passed: ratio >= 10 };
};

export const computePythagoras = (input: {
  a: number; b: number;
}): { c: number; isRightAngle: boolean } => {
  const { a, b } = input;
  const c = Math.sqrt(a * a + b * b);
  return { c, isRightAngle: a > 0 && b > 0 };
};

export const computeCircle = (input: {
  radius: number;
}): { area: number; circumference: number; diameter: number } => {
  const r = Math.max(0, input.radius);
  return {
    area: Math.PI * r * r,
    circumference: 2 * Math.PI * r,
    diameter: 2 * r,
  };
};

export const computeBattenSpacing = (input: {
  rafterLengthM: number; ccMm: number; battLengthM: number; quantity: number;
}): { count: number; totalLength: number; spacingMm: number } => {
  const { rafterLengthM, ccMm, battLengthM, quantity } = input;
  const cc = ccMm / 1000;
  const count = cc > 0 ? Math.ceil(rafterLengthM / cc) : 0;
  return { count, totalLength: count * battLengthM * quantity, spacingMm: ccMm };
};

export const computeRafter = (input: {
  spanM: number; pitchDeg: number; ccMm: number; buildingLengthM: number;
}): { rafterLength: number; ridgeHeight: number; count: number } => {
  const { spanM, pitchDeg, ccMm, buildingLengthM } = input;
  const halfSpan = spanM / 2;
  const pitchRad = (pitchDeg * Math.PI) / 180;
  const rafterLength = halfSpan / Math.cos(pitchRad);
  const ridgeHeight = halfSpan * Math.tan(pitchRad);
  const cc = ccMm / 1000;
  const count = cc > 0 ? Math.ceil(buildingLengthM / cc) + 1 : 0;
  return { rafterLength, ridgeHeight, count };
};

export const computeFoundationBlocks = (input: {
  perimeterM: number; heightM: number; blockLmm: number; blockHmm: number; jointMm: number; wastagePct: number;
}): { total: number; blocksPerRow: number; rows: number } => {
  const { perimeterM, heightM, blockLmm, blockHmm, jointMm, wastagePct } = input;
  const blockL = (blockLmm + jointMm) / 1000;
  const blockH = (blockHmm + jointMm) / 1000;
  const blocksPerRow = Math.ceil(perimeterM / blockL);
  const rows = Math.ceil(heightM / blockH);
  const rawTotal = blocksPerRow * rows;
  return { total: Math.ceil(rawTotal * (1 + wastagePct / 100)), blocksPerRow, rows };
};

export const computeReinforcement = (input: {
  areaL: number; areaW: number; ccMm: number; diamMm: number; layers: number; wastagePct: number;
}): { totalLengthM: number; weightKg: number } => {
  const { areaL, areaW, ccMm, diamMm, layers, wastagePct } = input;
  const cc = ccMm / 1000;
  const barsAlongL = cc > 0 ? Math.ceil(areaW / cc) + 1 : 0;
  const barsAlongW = cc > 0 ? Math.ceil(areaL / cc) + 1 : 0;
  const totalLength = (barsAlongL * areaL + barsAlongW * areaW) * layers * (1 + wastagePct / 100);
  const weightKg = (diamMm * diamMm / 162) * totalLength;
  return { totalLengthM: totalLength, weightKg };
};

export const computeFormwork = (input: {
  length: number; height: number; sides: number; wastagePct: number;
}): { area: number } => {
  const { length, height, sides, wastagePct } = input;
  return { area: length * height * sides * (1 + wastagePct / 100) };
};

export const computeFence = (input: {
  lengthM: number; postCcM: number; postWidthM: number;
}): { posts: number; panels: number; remainderM: number } => {
  const { lengthM, postCcM, postWidthM } = input;
  if (postCcM <= 0) return { posts: 0, panels: 0, remainderM: 0 };
  const posts = Math.ceil(lengthM / postCcM) + 1;
  const panelWidth = postCcM - postWidthM;
  const fullPanels = Math.floor(lengthM / postCcM);
  const remainderM = lengthM - fullPanels * postCcM;
  return { posts, panels: fullPanels, remainderM };
};

export const computeTerrainSlope = (input: {
  heightDiffM: number; horizontalDistM: number;
}): { slopePct: number; slopeRatio: string; passed: boolean } => {
  const { heightDiffM, horizontalDistM } = input;
  const slopePct = horizontalDistM > 0 ? (heightDiffM / horizontalDistM) * 100 : 0;
  const ratio = slopePct > 0 ? Math.round(100 / slopePct) : 0;
  return { slopePct, slopeRatio: `1:${ratio}`, passed: slopePct >= 2.5 };
};

// ── Phase 2 formula functions (engineering / safety-critical) ────────────────

// Statics

export const computeBeamLoad = (input: {
  span: number;
  loadType: 'point' | 'distributed';
  load: number;
  /** Distance from left support to the point load (m). Defaults to span/2 (midspan). */
  position?: number;
}): { maxMoment: number; maxShear: number } => {
  const { span, loadType, load, position } = input;
  if (loadType === 'point') {
    const a = position !== undefined ? Math.max(0, Math.min(position, span)) : span / 2;
    const b = span - a;
    return {
      maxMoment: (load * a * b) / span,
      maxShear: Math.max((load * b) / span, (load * a) / span),
    };
  }
  return { maxMoment: (load * span * span) / 8, maxShear: (load * span) / 2 };
};

// ── Beam capacity (EC5 / EC3 bending + shear utilisation) ─────────────────────
// Bridges the load side (computeBeamLoad) to a resistance side: elastic bending
// resistance Mrd = W·fm,d and shear resistance Vrd, giving utilisation ratios so
// the user learns whether a chosen section actually carries the moment/shear.

export interface BeamMaterialProfile {
  key: string;
  label: string;
  kind: 'timber' | 'steel';
  /** Bending strength: fm,k (timber) or fy (steel). [Pa] */
  fmkPa: number;
  /** Shear strength: fv,k (timber) or fy (steel; shear uses fy/√3 internally). [Pa] */
  fvkPa: number;
  /** Mean modulus of elasticity (for reference / deflection). [Pa] */
  eMeanPa: number;
  gammaM: number;
  kmod: number;
  standardNote: string;
}

export const BEAM_MATERIALS: Record<string, BeamMaterialProfile> = {
  'timber-c24': {
    key: 'timber-c24', label: 'Træ C24 (EC5)', kind: 'timber',
    fmkPa: 24e6, fvkPa: 4.0e6, eMeanPa: 11e9, gammaM: 1.3, kmod: 0.8,
    standardNote: 'DS/EN 1995-1-1 (EC5) §6.1.6 — fm,k = 24 MPa, fv,k = 4,0 MPa, γM = 1,3, kmod = 0,8. Forskydning med kcr = 0,67.',
  },
  'timber-gl28h': {
    key: 'timber-gl28h', label: 'Limtræ GL28h (EC5)', kind: 'timber',
    fmkPa: 28e6, fvkPa: 3.5e6, eMeanPa: 12.5e9, gammaM: 1.3, kmod: 0.8,
    standardNote: 'DS/EN 1995-1-1 (EC5) — fm,k = 28 MPa, fv,k = 3,5 MPa, γM = 1,3, kmod = 0,8. Forskydning med kcr = 0,67.',
  },
  'steel-s235': {
    key: 'steel-s235', label: 'Stål S235 (EC3)', kind: 'steel',
    fmkPa: 235e6, fvkPa: 235e6, eMeanPa: 210e9, gammaM: 1.1, kmod: 1.0,
    standardNote: 'DS/EN 1993-1-1 (EC3) §6.2 — fy = 235 MPa, γM0 = 1,1. Elastisk bøjning W_el; forskydning fy/√3.',
  },
  'steel-s355': {
    key: 'steel-s355', label: 'Stål S355 (EC3)', kind: 'steel',
    fmkPa: 355e6, fvkPa: 355e6, eMeanPa: 210e9, gammaM: 1.1, kmod: 1.0,
    standardNote: 'DS/EN 1993-1-1 (EC3) §6.2 — fy = 355 MPa, γM0 = 1,1. Elastisk bøjning W_el; forskydning fy/√3.',
  },
};

/** Timber shear-crack factor kcr per EC5 DK NA. */
const TIMBER_KCR = 0.67;

export const computeBeamCapacity = (input: {
  /** Rectangular section width [m]. */
  widthM: number;
  /** Rectangular section height (depth) [m]. */
  heightM: number;
  /** Design moment Med [kNm]. */
  momentKNm: number;
  /** Design shear Ved [kN]. */
  shearKN: number;
  material: BeamMaterialProfile;
}): {
  sectionModulusM3: number;
  areaM2: number;
  momentResistanceKNm: number;
  shearResistanceKN: number;
  bendingUtilization: number;
  shearUtilization: number;
  utilization: number;
  governing: 'bending' | 'shear' | 'none';
  passed: boolean;
} => {
  const { widthM: b, heightM: h, momentKNm, shearKN, material } = input;
  const empty = {
    sectionModulusM3: 0, areaM2: 0, momentResistanceKNm: 0, shearResistanceKN: 0,
    bendingUtilization: 0, shearUtilization: 0, utilization: 0, governing: 'none' as const, passed: false,
  };
  if (b <= 0 || h <= 0) return empty;

  const W = (b * h * h) / 6;         // elastic section modulus [m³]
  const A = b * h;                    // cross-section area [m²]
  const fmd = (material.kmod * material.fmkPa) / material.gammaM; // design bending strength [Pa]
  const Mrd = W * fmd;                // [N·m]

  let Vrd: number;                    // [N]
  if (material.kind === 'timber') {
    // EC5 §6.1.7: τmax = 1,5·V/(kcr·b·h) ≤ fv,d  →  Vrd = (2/3)·kcr·b·h·fv,d
    const fvd = (material.kmod * material.fvkPa) / material.gammaM;
    Vrd = (2 / 3) * TIMBER_KCR * A * fvd;
  } else {
    // EC3 §6.2.6: plastic shear Vpl,Rd = Av·(fy/√3)/γM0, Av ≈ A for a solid rectangle
    Vrd = (A * (material.fvkPa / Math.sqrt(3))) / material.gammaM;
  }

  const MedN = Math.max(0, momentKNm) * 1000;
  const VedN = Math.max(0, shearKN) * 1000;
  const bendingUtilization = Mrd > 0 ? MedN / Mrd : Infinity;
  const shearUtilization = Vrd > 0 ? VedN / Vrd : Infinity;
  const utilization = Math.max(bendingUtilization, shearUtilization);
  const governing = bendingUtilization >= shearUtilization ? 'bending' : 'shear';

  return {
    sectionModulusM3: W,
    areaM2: A,
    momentResistanceKNm: Mrd / 1000,
    shearResistanceKN: Vrd / 1000,
    bendingUtilization,
    shearUtilization,
    utilization,
    governing,
    passed: utilization <= 1,
  };
};

export const computeColumnLoad = (input: {
  widthM: number;
  depthM: number;
  heightM: number;
  /** Elastic modulus in Pa (N/m²). Timber ≈ 12e9, Steel ≈ 210e9. */
  elasticModulusPa: number;
}): { criticalLoadKN: number; momentOfInertiaM4: number } => {
  const { widthM, depthM, heightM, elasticModulusPa } = input;
  const I = (widthM * Math.pow(depthM, 3)) / 12;
  const pCritN = heightM > 0
    ? (Math.PI * Math.PI * elasticModulusPa * I) / (heightM * heightM)
    : 0;
  return { criticalLoadKN: pCritN / 1000, momentOfInertiaM4: I };
};

// ── Column capacity (EC5 / EC3 buckling + crushing utilisation) ────────────────
// A genuine design check: unlike the pure-Euler computeColumnLoad above, this
// returns a design buckling resistance N_b,Rd = kc·A·fc,d and a utilisation ratio
// Nd/N_b,Rd ≤ 1. Crucially, for a short/stocky column kc→1 so the resistance is the
// FINITE crushing capacity A·fc,d — not the infinite Euler load — so an overloaded
// stocky column is correctly flagged as failing (fixes the "always safe" defect).

export interface ColumnMaterialProfile {
  key: string;
  label: string;
  /** Modulus used for stability: EC5 uses E0,05 (5th percentile); steel uses E. [Pa] */
  eStabilityPa: number;
  /** Characteristic compressive strength: fc,0,k (timber) or fy (steel). [Pa] */
  fckPa: number;
  /** Partial material factor γM (timber ≈ 1,3; steel γM1 ≈ 1,1 DK NA). */
  gammaM: number;
  /** Load-duration/moisture modification kmod (1,0 for steel). */
  kmod: number;
  /** Imperfection factor: βc (EC5 solid timber ≈ 0,2) or α (EC3 curve c ≈ 0,49). */
  imperfection: number;
  /** Slenderness offset λ_rel,0: EC5 = 0,3; EC3 = 0,2. */
  lambda0: number;
  standardNote: string;
}

export const COLUMN_MATERIALS: Record<string, ColumnMaterialProfile> = {
  'timber-c24': {
    key: 'timber-c24', label: 'Træ C24 (EC5)',
    eStabilityPa: 7.4e9, fckPa: 21e6, gammaM: 1.3, kmod: 0.8, imperfection: 0.2, lambda0: 0.3,
    standardNote: 'DS/EN 1995-1-1 (EC5) §6.3.2 — E0,05 = 7,4 GPa, fc,0,k = 21 MPa, γM = 1,3, kmod = 0,8 (mellemtidslast, anvendelsesklasse 1–2), βc = 0,2.',
  },
  'timber-gl28h': {
    key: 'timber-gl28h', label: 'Limtræ GL28h (EC5)',
    eStabilityPa: 10.2e9, fckPa: 28e6, gammaM: 1.3, kmod: 0.8, imperfection: 0.1, lambda0: 0.3,
    standardNote: 'DS/EN 1995-1-1 (EC5) §6.3.2 — E0,05 = 10,2 GPa, fc,0,k = 28 MPa, γM = 1,3, kmod = 0,8, βc = 0,1 (limtræ).',
  },
  'steel-s235': {
    key: 'steel-s235', label: 'Stål S235 (EC3)',
    eStabilityPa: 210e9, fckPa: 235e6, gammaM: 1.1, kmod: 1.0, imperfection: 0.49, lambda0: 0.2,
    standardNote: 'DS/EN 1993-1-1 (EC3) §6.3.1 — fy = 235 MPa, γM1 = 1,1, knækkurve c (α = 0,49).',
  },
  'steel-s355': {
    key: 'steel-s355', label: 'Stål S355 (EC3)',
    eStabilityPa: 210e9, fckPa: 355e6, gammaM: 1.1, kmod: 1.0, imperfection: 0.49, lambda0: 0.2,
    standardNote: 'DS/EN 1993-1-1 (EC3) §6.3.1 — fy = 355 MPa, γM1 = 1,1, knækkurve c (α = 0,49).',
  },
};

/** Effective-length factor by end restraint (Euler cases). */
export const COLUMN_END_CONDITIONS: Record<string, { key: string; label: string; k: number }> = {
  'pinned-pinned': { key: 'pinned-pinned', label: 'Leddet–leddet (k=1,0)', k: 1.0 },
  'fixed-fixed': { key: 'fixed-fixed', label: 'Fast–fast (k=0,5)', k: 0.5 },
  'fixed-pinned': { key: 'fixed-pinned', label: 'Fast–leddet (k=0,7)', k: 0.7 },
  'fixed-free': { key: 'fixed-free', label: 'Fast–fri / kraget (k=2,0)', k: 2.0 },
};

export const computeColumnCapacity = (input: {
  widthM: number;
  depthM: number;
  heightM: number;
  appliedLoadKN: number;
  material: ColumnMaterialProfile;
  /** Effective-length factor k (pinned-pinned = 1,0). */
  effectiveLengthFactor?: number;
}): {
  areaM2: number;
  iMinM4: number;
  effectiveLengthM: number;
  eulerCritKN: number;
  squashCharKN: number;
  crushResistanceKN: number;
  relativeSlenderness: number;
  reductionFactor: number;
  bucklingResistanceKN: number;
  utilization: number;
  governing: 'buckling' | 'crushing' | 'none';
  passed: boolean;
} => {
  const { widthM: b, depthM: d, heightM: L, appliedLoadKN, material, effectiveLengthFactor = 1 } = input;
  const area = Math.max(0, b * d);
  const iY = (b * Math.pow(d, 3)) / 12;
  const iZ = (d * Math.pow(b, 3)) / 12;
  const iMin = Math.min(iY, iZ); // buckling governs about the weaker axis
  const Le = Math.max(0, L) * effectiveLengthFactor;

  const empty = {
    areaM2: area, iMinM4: iMin, effectiveLengthM: Le,
    eulerCritKN: 0, squashCharKN: 0, crushResistanceKN: 0,
    relativeSlenderness: 0, reductionFactor: 0, bucklingResistanceKN: 0,
    utilization: 0, governing: 'none' as const, passed: false,
  };
  if (area <= 0 || iMin <= 0 || Le <= 0) return empty;

  const eulerCritN = (Math.PI * Math.PI * material.eStabilityPa * iMin) / (Le * Le);
  const squashCharN = area * material.fckPa;              // A · fck (characteristic squash load)
  const fcd = (material.kmod * material.fckPa) / material.gammaM; // design compressive strength
  const crushResistanceN = area * fcd;                    // A · fc,d (pure crushing, kc = 1)

  // Relative slenderness λ_rel = √(A·fck / N_cr)
  const lambdaRel = eulerCritN > 0 ? Math.sqrt(squashCharN / eulerCritN) : Infinity;
  // Unified EC5/EC3 reduction factor kc (χ)
  const k = 0.5 * (1 + material.imperfection * (lambdaRel - material.lambda0) + lambdaRel * lambdaRel);
  const disc = k * k - lambdaRel * lambdaRel;
  const kc = Math.min(1, 1 / (k + Math.sqrt(Math.max(0, disc))));

  const bucklingResistanceN = kc * crushResistanceN;      // N_b,Rd = kc · A · fc,d
  const NdN = Math.max(0, appliedLoadKN) * 1000;
  const utilization = bucklingResistanceN > 0 ? NdN / bucklingResistanceN : Infinity;
  const governing: 'buckling' | 'crushing' = kc < 0.999 ? 'buckling' : 'crushing';

  return {
    areaM2: area,
    iMinM4: iMin,
    effectiveLengthM: Le,
    eulerCritKN: eulerCritN / 1000,
    squashCharKN: squashCharN / 1000,
    crushResistanceKN: crushResistanceN / 1000,
    relativeSlenderness: lambdaRel,
    reductionFactor: kc,
    bucklingResistanceKN: bucklingResistanceN / 1000,
    utilization,
    governing,
    passed: utilization <= 1,
  };
};

export const computeFoundationArea = (input: {
  loadKN: number;
  capacityKNm2: number;
}): { areaM2: number; sideLengthM: number } => {
  const { loadKN, capacityKNm2 } = input;
  const areaM2 = capacityKNm2 > 0 ? loadKN / capacityKNm2 : 0;
  return { areaM2, sideLengthM: Math.sqrt(areaM2) };
};

// ── Foundation bearing check (EC7, effective-width method) ─────────────────────
// Beyond simple A=N/q sizing: adds the footing's own self-weight and the Meyerhof
// effective-width reduction for eccentric (moment) loading, then checks the actual
// contact pressure against the ground's design bearing capacity → utilisation.

export const computeFoundationBearing = (input: {
  /** Axial design load from the column/wall [kN]. */
  loadKN: number;
  /** Footing plan dimensions [m]. */
  widthM: number;
  lengthM: number;
  /** Footing thickness [m] — drives self-weight. */
  thicknessM: number;
  /** Ground design bearing resistance [kN/m²]. */
  bearingCapacityKNm2: number;
  /** Optional applied moment [kNm] → eccentricity e = M/N. */
  momentKNm?: number;
  /** Reinforced-concrete unit weight [kN/m³]. */
  concreteWeightKNm3?: number;
}): {
  selfWeightKN: number;
  totalLoadKN: number;
  eccentricityM: number;
  effectiveWidthM: number;
  effectiveAreaM2: number;
  bearingPressureKNm2: number;
  utilization: number;
  passed: boolean;
  /** True when e > B/6 → tension/uplift risk at one edge (outside the middle third). */
  eccentricityWarning: boolean;
} => {
  const { loadKN, widthM: B, lengthM: L, thicknessM: t, bearingCapacityKNm2, momentKNm = 0, concreteWeightKNm3 = 24 } = input;
  const empty = {
    selfWeightKN: 0, totalLoadKN: 0, eccentricityM: 0, effectiveWidthM: 0, effectiveAreaM2: 0,
    bearingPressureKNm2: 0, utilization: 0, passed: false, eccentricityWarning: false,
  };
  if (B <= 0 || L <= 0) return empty;

  const selfWeightKN = B * L * t * concreteWeightKNm3;
  const totalLoadKN = Math.max(0, loadKN) + selfWeightKN;
  const e = totalLoadKN > 0 ? momentKNm / totalLoadKN : 0;
  // Meyerhof effective width B' = B − 2e (contact area under an eccentric load)
  const effectiveWidthM = Math.max(0, B - 2 * Math.abs(e));
  const effectiveAreaM2 = effectiveWidthM * L;
  const bearingPressureKNm2 = effectiveAreaM2 > 0 ? totalLoadKN / effectiveAreaM2 : Infinity;
  return {
    selfWeightKN,
    totalLoadKN,
    eccentricityM: e,
    effectiveWidthM,
    effectiveAreaM2,
    bearingPressureKNm2,
    utilization: bearingCapacityKNm2 > 0 ? bearingPressureKNm2 / bearingCapacityKNm2 : Infinity,
    passed: bearingPressureKNm2 <= bearingCapacityKNm2,
    eccentricityWarning: Math.abs(e) > B / 6,
  };
};

export const computeBearingWallLoad = (input: {
  heightM: number;
  thicknessM: number;
  densityKgM3: number;
  additionalLoadKNm: number;
}): { selfWeightKNm: number; totalLoadKNm: number } => {
  const { heightM, thicknessM, densityKgM3, additionalLoadKNm } = input;
  const selfWeightKNm = (heightM * thicknessM * densityKgM3 * 9.81) / 1000;
  return { selfWeightKNm, totalLoadKNm: selfWeightKNm + additionalLoadKNm };
};

// ── Masonry wall vertical resistance (EC6, Annex G simplified) ─────────────────
// Turns a bearing-wall load number into an actual pass/fail: computes the EC6
// capacity-reduction factor Φ (slenderness + eccentricity) and the design vertical
// resistance N_Rd = Φ·t·f_d per metre, then a utilisation ratio.

export interface MasonryProfile {
  key: string;
  label: string;
  /** Characteristic masonry compressive strength f_k [Pa]. */
  fkPa: number;
  /** Partial factor γM (masonry, DK ≈ 1,7). */
  gammaM: number;
  standardNote: string;
}

export const MASONRY_MATERIALS: Record<string, MasonryProfile> = {
  'tegl-normalmoertel': {
    key: 'tegl-normalmoertel', label: 'Teglsten, normalmørtel (fk≈4 MPa)',
    fkPa: 4.0e6, gammaM: 1.7,
    standardNote: 'DS/EN 1996-1-1 (EC6) — f_k ≈ 4 MPa for teglsten i normalmørtel, γM = 1,7. E ≈ 1000·f_k.',
  },
  'kalksandsten': {
    key: 'kalksandsten', label: 'Kalksandsten (fk≈3,5 MPa)',
    fkPa: 3.5e6, gammaM: 1.7,
    standardNote: 'DS/EN 1996-1-1 (EC6) — f_k ≈ 3,5 MPa for kalksandsten, γM = 1,7.',
  },
  'letklinker': {
    key: 'letklinker', label: 'Letklinkerbeton-blok (fk≈2,5 MPa)',
    fkPa: 2.5e6, gammaM: 1.7,
    standardNote: 'DS/EN 1996-1-1 (EC6) — f_k ≈ 2,5 MPa for letklinkerblokke (Leca), γM = 1,7.',
  },
  'beton-blok': {
    key: 'beton-blok', label: 'Betonblok (fk≈5 MPa)',
    fkPa: 5.0e6, gammaM: 1.7,
    standardNote: 'DS/EN 1996-1-1 (EC6) — f_k ≈ 5 MPa for massive betonblokke, γM = 1,7.',
  },
};

export const computeMasonryWallCapacity = (input: {
  heightM: number;
  thicknessM: number;
  fkPa: number;
  gammaM: number;
  /** Applied design vertical load per metre of wall [kN/m]. */
  appliedLoadKNm: number;
  /** Top/bottom restraint sets the effective-height factor ρ. */
  restraint?: 'top-bottom' | 'pinned';
  /** Additional load eccentricity at mid-height [m]. */
  loadEccentricityM?: number;
}): {
  slenderness: number;
  effectiveHeightM: number;
  eccentricityM: number;
  reductionFactor: number;
  capacityKNm: number;
  utilization: number;
  passed: boolean;
  slendernessWarning: boolean;
} => {
  const { heightM: h, thicknessM: t, fkPa, gammaM, appliedLoadKNm, restraint = 'top-bottom', loadEccentricityM = 0 } = input;
  const empty = {
    slenderness: 0, effectiveHeightM: 0, eccentricityM: 0, reductionFactor: 0,
    capacityKNm: 0, utilization: 0, passed: false, slendernessWarning: false,
  };
  if (t <= 0 || h <= 0) return empty;

  const rho = restraint === 'pinned' ? 1.0 : 0.75; // effective-height factor
  const hef = rho * h;
  const tef = t;
  const lambdaGeo = hef / tef;                       // geometric slenderness (limit ≤ 27)
  const KE = 1000;                                   // E_masonry ≈ 1000·f_k (EC6 §3.7.2)
  const lambdaMod = lambdaGeo / Math.sqrt(KE);       // λ = (h_ef/t_ef)·√(f_k/E)

  const eInit = hef / 450;                           // initial (out-of-plumb) eccentricity
  let emk = eInit + Math.abs(loadEccentricityM);
  emk = Math.max(emk, 0.05 * t);                     // EC6 minimum eccentricity 0,05·t
  const emkRatio = Math.min(emk / t, 0.45);

  // EC6 Annex G: Φ_m = A1·exp(−u²/2)
  const A1 = Math.max(0, 1 - 2 * emkRatio);
  const denom = 0.73 - 1.17 * emkRatio;
  const u = denom > 0 ? (lambdaMod - 0.063) / denom : 0;
  const phiMid = Math.min(1, Math.max(0, A1 * Math.exp(-(u * u) / 2)));
  // Top/bottom check Φ_i = 1 − 2·e_i/t
  const eiRatio = Math.min(Math.max((Math.abs(loadEccentricityM) + 0.05 * t) / t, 0.05), 0.45);
  const phiTop = Math.max(0, 1 - 2 * eiRatio);
  const phi = Math.min(phiMid, phiTop);

  const fd = fkPa / gammaM;
  const capacityNperM = phi * t * fd;                // N_Rd per metre [N/m]
  const NdN = Math.max(0, appliedLoadKNm) * 1000;

  return {
    slenderness: lambdaGeo,
    effectiveHeightM: hef,
    eccentricityM: emk,
    reductionFactor: phi,
    capacityKNm: capacityNperM / 1000,
    utilization: capacityNperM > 0 ? NdN / capacityNperM : Infinity,
    passed: NdN <= capacityNperM,
    slendernessWarning: lambdaGeo > 27,
  };
};

export const computeDeflection = (input: {
  spanM: number;
  loadKNm: number;
  elasticModulusGPa: number;
  momentOfInertiaM4: number;
  /** EC5 creep factor kdef (timber): wfin = winst·(1+kdef). 0 = instantaneous only. */
  kdef?: number;
  /** SLS limit denominator n for L/n (e.g. 300, 360, 400). Defaults to 400. */
  limitDenominator?: number;
}): {
  deflectionMm: number;
  finalDeflectionMm: number;
  limitL300mm: number;
  limitL360mm: number;
  limitL400mm: number;
  selectedLimitMm: number;
  utilization: number;
  passed: boolean;
} => {
  const { spanM, loadKNm, elasticModulusGPa, momentOfInertiaM4, kdef = 0, limitDenominator = 400 } = input;
  const E = elasticModulusGPa * 1e9;
  const q = loadKNm * 1000;
  const instMm = E > 0 && momentOfInertiaM4 > 0
    ? ((5 * q * Math.pow(spanM, 4)) / (384 * E * momentOfInertiaM4)) * 1000
    : 0;
  const finalMm = instMm * (1 + kdef); // EC5 §2.2.3 final deflection incl. creep
  const selectedLimitMm = (spanM * 1000) / limitDenominator;
  const governing = kdef > 0 ? finalMm : instMm;
  return {
    deflectionMm: instMm,
    finalDeflectionMm: finalMm,
    limitL300mm: (spanM * 1000) / 300,
    limitL360mm: (spanM * 1000) / 360,
    limitL400mm: (spanM * 1000) / 400,
    selectedLimitMm,
    utilization: selectedLimitMm > 0 ? governing / selectedLimitMm : 0,
    passed: governing <= selectedLimitMm,
  };
};

export const computeLightingLayout = (input: {
  areaM2: number;
  targetLux: number;
  lumensPerFixture: number;
  maintenanceFactor?: number;
}): { fixtureCount: number } => {
  const { areaM2, targetLux, lumensPerFixture, maintenanceFactor = 0.6 } = input;
  const fixtureCount = maintenanceFactor > 0 && lumensPerFixture > 0
    ? Math.ceil((areaM2 * targetLux) / (lumensPerFixture * maintenanceFactor))
    : 0;
  return { fixtureCount };
};

export const computeSolarPanelLayout = (input: {
  roofLengthM: number;
  roofWidthM: number;
  panelLengthM: number;
  panelWidthM: number;
  spacingM: number;
  panelPowerW: number;
}): { panelCount: number; totalPowerKw: number; rows: number; cols: number } => {
  const { roofLengthM, roofWidthM, panelLengthM, panelWidthM, spacingM, panelPowerW } = input;
  const cols = Math.max(0, Math.floor(roofWidthM / (panelWidthM + spacingM)));
  const rows = Math.max(0, Math.floor(roofLengthM / (panelLengthM + spacingM)));
  const panelCount = cols * rows;
  return { panelCount, totalPowerKw: (panelCount * panelPowerW) / 1000, rows, cols };
};

export const computeSolarRoi = (input: {
  systemCostDKK: number;
  annualProductionKwh: number;
  electricityPriceDKK: number;
  annualInflationPct: number;
  subsidyDKK?: number;
}): { paybackYears: number; lifetimeSavingsDKK: number; annualSavingsDKK: number } => {
  const { systemCostDKK, annualProductionKwh, electricityPriceDKK, annualInflationPct, subsidyDKK = 0 } = input;
  const netCost = systemCostDKK - subsidyDKK;
  const annualSavingsDKK = annualProductionKwh * electricityPriceDKK;
  let cumulative = 0;
  let paybackYears = 0;
  for (let y = 1; y <= 30; y++) {
    cumulative += annualSavingsDKK * Math.pow(1 + annualInflationPct / 100, y - 1);
    if (cumulative >= netCost && paybackYears === 0) paybackYears = y;
  }
  return { paybackYears, lifetimeSavingsDKK: cumulative - netCost, annualSavingsDKK };
};

export const computeWaterFlow = (input: {
  diameterMm: number;
  velocityMs: number;
}): { flowLps: number; flowLpm: number } => {
  const { diameterMm, velocityMs } = input;
  const flowLps = Math.PI * Math.pow(diameterMm / 2000, 2) * velocityMs * 1000;
  return { flowLps, flowLpm: flowLps * 60 };
};

// Darcy friction factor via the Swamee–Jain explicit approximation to Colebrook.
const swameeJainFriction = (reynolds: number, relRoughness: number): number => {
  if (reynolds < 2300) return reynolds > 0 ? 64 / reynolds : 0; // laminar
  const denom = Math.log10(relRoughness / 3.7 + 5.74 / Math.pow(reynolds, 0.9));
  return 0.25 / (denom * denom);
};

// ── Pipe pressure loss / pump head (Darcy–Weisbach + fittings) ─────────────────
// Extends velocity-only sizing to the actual head a circulator/pump must overcome:
// friction along the pipe plus local (fitting) losses. Basis for pump selection.

export const computePipePressureLoss = (input: {
  /** Flow [L/s]. */
  flowLps: number;
  /** Inner diameter [mm]. */
  innerDiameterMm: number;
  /** Straight pipe length [m]. */
  lengthM: number;
  /** Sum of local loss coefficients ΣK (bends, tees, valves). */
  fittingsK?: number;
  /** Absolute roughness [mm] (PEX/copper ≈ 0,007; steel ≈ 0,045). */
  roughnessMm?: number;
  /** Kinematic viscosity [m²/s] (water 20 °C ≈ 1,004e-6). */
  kinematicViscosity?: number;
  /** Fluid density [kg/m³]. */
  densityKgM3?: number;
}): {
  velocityMs: number;
  reynolds: number;
  frictionFactor: number;
  frictionHeadM: number;
  minorHeadM: number;
  totalHeadM: number;
  pressureLossKPa: number;
} => {
  const { flowLps, innerDiameterMm, lengthM, fittingsK = 0, roughnessMm = 0.007, kinematicViscosity = 1.004e-6, densityKgM3 = 998 } = input;
  const d = innerDiameterMm / 1000;
  if (d <= 0 || flowLps <= 0) {
    return { velocityMs: 0, reynolds: 0, frictionFactor: 0, frictionHeadM: 0, minorHeadM: 0, totalHeadM: 0, pressureLossKPa: 0 };
  }
  const g = 9.81;
  const area = Math.PI * (d / 2) ** 2;
  const v = (flowLps / 1000) / area;
  const Re = (v * d) / kinematicViscosity;
  const f = swameeJainFriction(Re, (roughnessMm / 1000) / d);
  const velHead = (v * v) / (2 * g);
  const frictionHeadM = f * (lengthM / d) * velHead;
  const minorHeadM = fittingsK * velHead;
  const totalHeadM = frictionHeadM + minorHeadM;
  return {
    velocityMs: v,
    reynolds: Re,
    frictionFactor: f,
    frictionHeadM,
    minorHeadM,
    totalHeadM,
    pressureLossKPa: (densityKgM3 * g * totalHeadM) / 1000,
  };
};

export const computeUnderfloorHeating = (input: {
  areaM2: number;
  spacingM: number;
  loopLengthM?: number;
}): { totalLengthM: number; loopCount: number | undefined } => {
  const { areaM2, spacingM, loopLengthM } = input;
  const totalLengthM = spacingM > 0 ? (areaM2 / spacingM) * 1.1 : 0;
  const loopCount = loopLengthM && loopLengthM > 0 ? Math.ceil(totalLengthM / loopLengthM) : undefined;
  return { totalLengthM, loopCount };
};

// ── Heat-pump sizing, running cost & savings (DK retrofit) ────────────────────
// Sizes a heat pump to the building's design heat load and converts the annual
// heat demand to electricity via the seasonal COP (SCOP), then compares running
// cost/CO₂ against the current heat source.

export const computeHeatPumpSizing = (input: {
  /** Building design heat load at the design outdoor temperature [kW]. */
  designHeatLoadKW: number;
  /** Annual space-heating (+ optionally DHW) energy demand [kWh/year]. */
  annualHeatDemandKwh: number;
  /** Seasonal coefficient of performance. Air-water ≈ 3,0–3,5; ground-source ≈ 4,0–4,5. */
  scop: number;
  /** Electricity price incl. tariffs [DKK/kWh]. */
  electricityPriceDKK: number;
  /** Current annual heating cost for comparison [DKK/year] (optional). */
  oldAnnualHeatingCostDKK?: number;
  /** Electricity CO₂ intensity [kg/kWh] (DK grid ≈ 0,10–0,15). */
  gridCo2KgPerKwh?: number;
  /** CO₂ intensity of the old heat source's delivered heat [kg/kWh] (oil ≈ 0,27, gas ≈ 0,20). */
  oldHeatCo2KgPerKwh?: number;
}): {
  recommendedCapacityKW: number;
  annualElectricityKwh: number;
  annualElectricityCostDKK: number;
  annualSavingsDKK: number | undefined;
  annualCo2ReductionKg: number | undefined;
} => {
  const { designHeatLoadKW, annualHeatDemandKwh, scop, electricityPriceDKK,
    oldAnnualHeatingCostDKK, gridCo2KgPerKwh = 0.12, oldHeatCo2KgPerKwh } = input;
  const recommendedCapacityKW = Math.max(0, designHeatLoadKW);
  const annualElectricityKwh = scop > 0 ? Math.max(0, annualHeatDemandKwh) / scop : 0;
  const annualElectricityCostDKK = annualElectricityKwh * electricityPriceDKK;
  const annualSavingsDKK = oldAnnualHeatingCostDKK !== undefined
    ? oldAnnualHeatingCostDKK - annualElectricityCostDKK
    : undefined;
  const annualCo2ReductionKg = oldHeatCo2KgPerKwh !== undefined
    ? Math.max(0, annualHeatDemandKwh) * oldHeatCo2KgPerKwh - annualElectricityKwh * gridCo2KgPerKwh
    : undefined;
  return { recommendedCapacityKW, annualElectricityKwh, annualElectricityCostDKK, annualSavingsDKK, annualCo2ReductionKg };
};

// ── Balanced ventilation with heat recovery (SFP + annual savings) ────────────
// Recovered heat = η · flow · (ρ·cp) · ΔT, plus specific fan power (SFP) checked
// against BR18 and the annual heating-energy saved by the heat exchanger.

export const computeHeatRecoveryVentilation = (input: {
  /** Supply/extract airflow [m³/h]. */
  flowM3h: number;
  /** Heat-exchanger temperature efficiency η (0–1). Modern counterflow ≈ 0,80–0,90. */
  efficiency: number;
  /** Total electric fan power (supply + extract) [W]. */
  fanPowerW: number;
  /** Mean indoor–outdoor temperature difference over the heating season [K]. */
  deltaTMeanK?: number;
  /** Annual operating hours [h]. Continuous ≈ 8760. */
  operatingHoursYr?: number;
  /** Electricity price for the fan-power running cost [DKK/kWh]. */
  electricityPriceDKK?: number;
}): {
  recoveredPowerW: number;
  sfpJperM3: number;
  sfpOk: boolean;
  annualHeatRecoveredKwh: number;
  annualFanElectricityKwh: number;
  annualFanCostDKK: number;
} => {
  const { flowM3h, efficiency, fanPowerW, deltaTMeanK = 12, operatingHoursYr = 8760, electricityPriceDKK = 2.5 } = input;
  const flowM3s = flowM3h / 3600;
  const rhoCp = 1200;                                    // J/(m³·K) air heat capacity
  const recoveredPowerW = Math.max(0, efficiency) * flowM3s * rhoCp * deltaTMeanK;
  const sfpJperM3 = flowM3s > 0 ? fanPowerW / flowM3s : 0; // J/m³ = W/(m³/s)
  const annualHeatRecoveredKwh = (recoveredPowerW * operatingHoursYr) / 1000;
  const annualFanElectricityKwh = (fanPowerW * operatingHoursYr) / 1000;
  return {
    recoveredPowerW,
    sfpJperM3,
    sfpOk: sfpJperM3 <= 1800,                            // BR18 guidance for balanced systems ≈ 1800 J/m³
    annualHeatRecoveredKwh,
    annualFanElectricityKwh,
    annualFanCostDKK: annualFanElectricityKwh * electricityPriceDKK,
  };
};

// ── DS 439 / EN 806-3 simultaneous demand (simplified loading-unit method) ─────
// Multiple fixtures are never all used at once. Sums loading units (belastnings-
// enheder) and applies a simplified simultaneity curve to a design flow qd.

export const computeFixtureUnitDemand = (input: {
  /** Fixtures with a count and a loading-unit (LU) value each. */
  fixtures: Array<{ name: string; count: number; loadingUnits: number }>;
  /** Simultaneity coefficient (simplified qd = k·√(ΣLU)). Residential ≈ 0,5. */
  coefficient?: number;
  /** Largest single-fixture flow [L/s] — qd never falls below this. */
  minSingleFlowLps?: number;
}): { totalLoadingUnits: number; designFlowLps: number; designFlowLpm: number } => {
  const { fixtures, coefficient = 0.5, minSingleFlowLps = 0.2 } = input;
  const totalLoadingUnits = fixtures.reduce((s, f) => s + Math.max(0, f.count) * Math.max(0, f.loadingUnits), 0);
  const designFlowLps = totalLoadingUnits > 0
    ? Math.max(minSingleFlowLps, coefficient * Math.sqrt(totalLoadingUnits))
    : 0;
  return { totalLoadingUnits, designFlowLps, designFlowLpm: designFlowLps * 60 };
};

// ── Screed / afretning drying-time estimate ───────────────────────────────────
// Screening estimate of days until a screed is dry enough to cover. ALWAYS verify
// with an RH/CM moisture measurement before laying the covering.

export const computeScreedDryingTime = (input: {
  thicknessMm: number;
  /** 'cement' (CT, slow) or 'anhydrite' (CA, calcium sulfate, faster). */
  binder?: 'cement' | 'anhydrite';
  /** Site-condition factor: good (20 °C/50 %RH) = 1,0; poor/cold/humid ≈ 1,5. */
  conditionFactor?: number;
}): { estimatedDays: number; estimatedWeeks: number } => {
  const { thicknessMm, binder = 'cement', conditionFactor = 1.0 } = input;
  if (thicknessMm <= 0) return { estimatedDays: 0, estimatedWeeks: 0 };
  const cm = thicknessMm / 10;
  // CT rule of thumb: ~1 week/cm for the first 4 cm, then ~2 weeks/cm.
  const baseDays = (Math.min(cm, 4) * 7 + Math.max(0, cm - 4) * 14);
  const binderFactor = binder === 'anhydrite' ? 0.6 : 1.0; // CA dries faster
  const estimatedDays = Math.ceil(baseDays * binderFactor * conditionFactor);
  return { estimatedDays, estimatedWeeks: Math.round((estimatedDays / 7) * 10) / 10 };
};

// ── Paving sub-base thickness by traffic class ────────────────────────────────
// Unbound base (stabilgrus) and bedding-sand depth scale with the load the paving
// must carry — a garden path and a car driveway are not the same build-up.

export type TrafficClass = 'pedestrian' | 'cycle' | 'car' | 'heavy';

const TRAFFIC_BUILDUP: Record<TrafficClass, { baseMm: number; beddingMm: number; label: string }> = {
  pedestrian: { baseMm: 100, beddingMm: 30, label: 'Fodgænger / terrasse' },
  cycle: { baseMm: 150, beddingMm: 30, label: 'Cykel / let færdsel' },
  car: { baseMm: 250, beddingMm: 40, label: 'Personbil / indkørsel' },
  heavy: { baseMm: 350, beddingMm: 40, label: 'Tung / lastbil' },
};

export const computePavingSubbase = (input: {
  areaM2: number;
  trafficClass: TrafficClass;
  paverThicknessMm?: number;
}): {
  baseThicknessMm: number;
  beddingThicknessMm: number;
  totalExcavationMm: number;
  baseVolumeM3: number;
  beddingVolumeM3: number;
  label: string;
} => {
  const { areaM2, trafficClass, paverThicknessMm = 60 } = input;
  const b = TRAFFIC_BUILDUP[trafficClass];
  const totalExcavationMm = b.baseMm + b.beddingMm + paverThicknessMm;
  return {
    baseThicknessMm: b.baseMm,
    beddingThicknessMm: b.beddingMm,
    totalExcavationMm,
    baseVolumeM3: Math.max(0, areaM2) * (b.baseMm / 1000),
    beddingVolumeM3: Math.max(0, areaM2) * (b.beddingMm / 1000),
    label: b.label,
  };
};

// ── Staged construction cash-flow / payment schedule ──────────────────────────
// Splits a total budget across build phases and returns per-phase amounts plus a
// cumulative draw-down schedule.

export const computeStagedCashflow = (input: {
  totalBudgetDKK: number;
  phases: Array<{ name: string; pct: number }>;
}): {
  phases: Array<{ name: string; pct: number; amountDKK: number; cumulativeDKK: number }>;
  totalPct: number;
  balanced: boolean;
} => {
  const { totalBudgetDKK, phases } = input;
  const totalPct = phases.reduce((s, p) => s + (p.pct || 0), 0);
  let cumulative = 0;
  const out = phases.map(p => {
    const amountDKK = totalBudgetDKK * ((p.pct || 0) / 100);
    cumulative += amountDKK;
    return { name: p.name, pct: p.pct || 0, amountDKK, cumulativeDKK: cumulative };
  });
  return { phases: out, totalPct, balanced: Math.abs(totalPct - 100) < 0.01 };
};

// ── EV-charger circuit dimensioning (DS/HD 60364-7-722) ───────────────────────
// EV charging is a continuous load with special protection needs. Sizes the
// design current, breaker, cable and the RCD type per the DK installation rules.

const STANDARD_BREAKERS = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63];
const BREAKER_CABLE_MM2: Record<number, number> = {
  6: 1.5, 10: 1.5, 13: 2.5, 16: 2.5, 20: 4, 25: 6, 32: 6, 40: 10, 50: 16, 63: 16,
};

export const computeEvCharger = (input: {
  /** Charger rated power [kW]. */
  chargerPowerKW: number;
  /** 1 = single-phase (230 V), 3 = three-phase (400 V). */
  phases: 1 | 3;
}): {
  designCurrentA: number;
  recommendedBreakerA: number;
  recommendedCableMm2: number;
  rcdType: string;
} => {
  const { chargerPowerKW, phases } = input;
  const P = Math.max(0, chargerPowerKW) * 1000;
  const designCurrentA = phases === 3 ? P / (Math.sqrt(3) * 400) : P / 230;
  // Continuous load: pick the smallest standard breaker ≥ design current.
  const recommendedBreakerA = STANDARD_BREAKERS.find(b => b >= designCurrentA) ?? 63;
  return {
    designCurrentA,
    recommendedBreakerA,
    recommendedCableMm2: BREAKER_CABLE_MM2[recommendedBreakerA] ?? 16,
    // DS/HD 60364-7-722: each charge point needs an RCD; type B, OR type A with a
    // 6 mA DC fault-current detection built into the charger.
    rcdType: 'Type B (eller Type A + 6 mA DC-detektion i laderen)',
  };
};

// ── Gravity retaining wall stability (EC7, Rankine) ───────────────────────────
// Simplified overturning / sliding / bearing check for a gravity/mass wall using
// Rankine active earth pressure. Screening tool — full design needs a geotechnician.

export const computeRetainingWall = (input: {
  /** Retained height H [m]. */
  heightM: number;
  /** Base width B [m]. */
  baseWidthM: number;
  /** Average wall thickness (for self-weight) [m]. */
  wallThicknessM: number;
  /** Retained soil unit weight γ [kN/m³]. */
  soilDensityKNm3?: number;
  /** Soil internal friction angle φ [°]. */
  frictionAngleDeg?: number;
  /** Wall material unit weight [kN/m³] (concrete ≈ 24). */
  wallDensityKNm3?: number;
  /** Surcharge on the retained soil [kN/m²]. */
  surchargeKPa?: number;
  /** Base friction coefficient μ. */
  baseFrictionCoeff?: number;
  /** Allowable ground bearing capacity [kN/m²]. */
  bearingCapacityKNm2?: number;
}): {
  ka: number;
  activeThrustKN: number;
  overturningMomentKNm: number;
  resistingMomentKNm: number;
  overturningFoS: number;
  slidingFoS: number;
  bearingPressureKNm2: number;
  overturningOk: boolean;
  slidingOk: boolean;
  bearingOk: boolean;
  passed: boolean;
} => {
  const {
    heightM: H, baseWidthM: B, wallThicknessM: t,
    soilDensityKNm3: gamma = 18, frictionAngleDeg: phi = 30, wallDensityKNm3: gammaW = 24,
    surchargeKPa: q = 0, baseFrictionCoeff: mu = 0.5, bearingCapacityKNm2: qAllow = 150,
  } = input;
  const empty = {
    ka: 0, activeThrustKN: 0, overturningMomentKNm: 0, resistingMomentKNm: 0,
    overturningFoS: 0, slidingFoS: 0, bearingPressureKNm2: 0,
    overturningOk: false, slidingOk: false, bearingOk: false, passed: false,
  };
  if (H <= 0 || B <= 0) return empty;

  const ka = Math.pow(Math.tan((Math.PI / 180) * (45 - phi / 2)), 2); // Rankine active
  const paSoil = 0.5 * ka * gamma * H * H;   // soil thrust, acts at H/3
  const paSurch = ka * q * H;                // surcharge thrust, acts at H/2
  const activeThrustKN = paSoil + paSurch;
  const overturningMomentKNm = paSoil * (H / 3) + paSurch * (H / 2);

  // Simplified self-weight: treat the wall as B×H mass at average thickness t (per m run),
  // acting at mid-base for resisting moment about the toe.
  const weightKN = Math.max(0, t) * H * gammaW + B * 0.3 * gammaW; // stem + a nominal base slab
  const resistingMomentKNm = weightKN * (B / 2);

  const overturningFoS = overturningMomentKNm > 0 ? resistingMomentKNm / overturningMomentKNm : Infinity;
  const slidingFoS = activeThrustKN > 0 ? (mu * weightKN) / activeThrustKN : Infinity;
  const bearingPressureKNm2 = B > 0 ? weightKN / B : Infinity;

  const overturningOk = overturningFoS >= 2.0;   // EC7 typical
  const slidingOk = slidingFoS >= 1.5;
  const bearingOk = bearingPressureKNm2 <= qAllow;
  return {
    ka, activeThrustKN, overturningMomentKNm, resistingMomentKNm,
    overturningFoS, slidingFoS, bearingPressureKNm2,
    overturningOk, slidingOk, bearingOk,
    passed: overturningOk && slidingOk && bearingOk,
  };
};

// ── Soakaway / faskine sizing (DS 432, simplified) ────────────────────────────
// Required rainwater storage volume from a catchment area for a design storm,
// crediting infiltration into the surrounding soil during the event.

export const computeSoakaway = (input: {
  /** Connected impervious catchment area (e.g. roof) [m²]. */
  catchmentAreaM2: number;
  /** Runoff coefficient (roof ≈ 0,9). */
  runoffCoefficient?: number;
  /** Design rainfall depth for the return period [mm] (DK 5–10 yr ≈ 30–45 mm). */
  designRainfallMm?: number;
  /** Soil infiltration rate k [m/s] (sand ≈ 1e-4, silt ≈ 1e-6, clay ≈ 1e-8). */
  infiltrationRateMs?: number;
  /** Infiltrating surface area of the soakaway (base + sides) [m²]. */
  infiltrationAreaM2?: number;
  /** Design storm duration [min]. */
  stormDurationMin?: number;
  /** Void ratio of the fill (gravel ≈ 0,3; plastic crates ≈ 0,95). */
  voidRatio?: number;
}): {
  inflowM3: number;
  infiltrationM3: number;
  requiredStorageM3: number;
  excavatedVolumeM3: number;
} => {
  const {
    catchmentAreaM2: A, runoffCoefficient: c = 0.9, designRainfallMm: rain = 40,
    infiltrationRateMs: k = 1e-6, infiltrationAreaM2: aInf = 0, stormDurationMin: dur = 60, voidRatio: vr = 0.3,
  } = input;
  if (A <= 0) return { inflowM3: 0, infiltrationM3: 0, requiredStorageM3: 0, excavatedVolumeM3: 0 };
  const inflowM3 = A * c * (rain / 1000);
  const infiltrationM3 = k * aInf * (dur * 60); // m/s × m² × s
  const requiredStorageM3 = Math.max(0, inflowM3 - infiltrationM3);
  const excavatedVolumeM3 = vr > 0 ? requiredStorageM3 / vr : requiredStorageM3;
  return { inflowM3, infiltrationM3, requiredStorageM3, excavatedVolumeM3 };
};

// ── Spiral staircase geometry (BR18 / SBi) ────────────────────────────────────
// A spiral stair's usable tread depth (going) is measured at the walk line, 400 mm
// from the inner (narrow) edge per BR18. Checks rise, going and the effective width.

export const computeSpiralStair = (input: {
  /** Floor-to-floor rise [m]. */
  totalRiseM: number;
  /** Outer radius of the stair [m]. */
  outerRadiusM: number;
  /** Radius of the central column/newel [m]. */
  centerColumnRadiusM: number;
  /** Number of treads per full 360° turn. */
  stepsPerTurn: number;
  /** Target rise per step [m]. */
  targetRiseM?: number;
}): {
  numSteps: number;
  actualRiseM: number;
  anglePerStepDeg: number;
  walkLineRadiusM: number;
  goingAtWalkLineM: number;
  clearWidthM: number;
  riseOk: boolean;
  goingOk: boolean;
  passed: boolean;
} => {
  const { totalRiseM: H, outerRadiusM: rOut, centerColumnRadiusM: rIn, stepsPerTurn, targetRiseM = 0.18 } = input;
  const empty = {
    numSteps: 0, actualRiseM: 0, anglePerStepDeg: 0, walkLineRadiusM: 0,
    goingAtWalkLineM: 0, clearWidthM: 0, riseOk: false, goingOk: false, passed: false,
  };
  if (H <= 0 || rOut <= rIn || stepsPerTurn <= 0 || targetRiseM <= 0) return empty;

  const numSteps = Math.max(1, Math.round(H / targetRiseM));
  const actualRiseM = H / numSteps;
  const anglePerStepDeg = 360 / stepsPerTurn;
  // BR18/SBi: effective going measured at the walk line = 400 mm from the inner edge.
  const walkLineRadiusM = Math.min(rOut, rIn + 0.4);
  const goingAtWalkLineM = (2 * Math.PI * walkLineRadiusM) / stepsPerTurn;
  const clearWidthM = rOut - rIn;
  const riseCm = actualRiseM * 100;
  const riseOk = riseCm >= 15 && riseCm <= 21;
  const goingOk = goingAtWalkLineM >= 0.20; // ≥ 200 mm effective tread at the walk line
  return {
    numSteps, actualRiseM, anglePerStepDeg, walkLineRadiusM, goingAtWalkLineM, clearWidthM,
    riseOk, goingOk, passed: riseOk && goingOk,
  };
};

// ── Window / glazing sound insulation Rw (indicative) ─────────────────────────
// Indicative airborne sound reduction for common glazing build-ups. Rw + Ctr is
// the metric used for traffic noise (Ctr ≈ −5 dB for typical windows).

export type GlazingAcousticType = 'standard-2' | 'thermal-3' | 'laminated' | 'acoustic';

const GLAZING_RW: Record<GlazingAcousticType, { rw: number; ctr: number; label: string }> = {
  'standard-2': { rw: 30, ctr: -3, label: '2-lag standard (4-16-4)' },
  'thermal-3': { rw: 33, ctr: -4, label: '3-lag energirude' },
  'laminated': { rw: 38, ctr: -5, label: 'Lamineret (asymmetrisk + PVB)' },
  'acoustic': { rw: 42, ctr: -6, label: 'Lyddæmpende rude (tyk laminering)' },
};

export const computeWindowAcoustics = (input: {
  glazingType: GlazingAcousticType;
  /** Target Rw+Ctr for the facade [dB] (from a noise assessment). */
  requiredRwCtr?: number;
}): { rw: number; rwCtr: number; label: string; passed: boolean } => {
  const { glazingType, requiredRwCtr = 33 } = input;
  const g = GLAZING_RW[glazingType];
  const rwCtr = g.rw + g.ctr;
  return { rw: g.rw, rwCtr, label: g.label, passed: rwCtr >= requiredRwCtr };
};

export const computeSlabLoad = (input: {
  thicknessM: number;
  densityKgM3: number;
  liveLoadKNm2: number;
}): { deadLoadKNm2: number; totalLoadKNm2: number } => {
  const { thicknessM, densityKgM3, liveLoadKNm2 } = input;
  const deadLoadKNm2 = (thicknessM * densityKgM3 * 9.81) / 1000;
  return { deadLoadKNm2, totalLoadKNm2: deadLoadKNm2 + liveLoadKNm2 };
};

// ── EC0 design load + EC2 slab flexure (required reinforcement) ────────────────
// Turns a slab load intensity into a design moment (γ-factored, EC0 6.10) and then
// the EC2 required tension reinforcement As per metre width — a genuine flexural
// design, not just a load number.

export const computeSlabDesignLoad = (input: {
  deadLoadKNm2: number;
  liveLoadKNm2: number;
  gammaG?: number;
  gammaQ?: number;
}): { designLoadKNm2: number } => {
  const { deadLoadKNm2, liveLoadKNm2, gammaG = 1.35, gammaQ = 1.5 } = input;
  return { designLoadKNm2: gammaG * deadLoadKNm2 + gammaQ * liveLoadKNm2 };
};

export const computeSlabFlexure = (input: {
  /** Design moment per metre width [kNm/m]. */
  momentKNmPerM: number;
  /** Effective depth d [mm]. */
  effectiveDepthMm: number;
  /** Concrete cylinder strength fck [MPa]. */
  fckMPa: number;
  /** Steel yield fyk [MPa] (Danish rebar typically 500). */
  fykMPa?: number;
}): {
  requiredAsMm2: number;
  minAsMm2: number;
  providedGoverningAsMm2: number;
  leverArmMm: number;
  kFactor: number;
  singlyReinforced: boolean;
} => {
  const { momentKNmPerM, effectiveDepthMm: d, fckMPa, fykMPa = 500 } = input;
  const empty = {
    requiredAsMm2: 0, minAsMm2: 0, providedGoverningAsMm2: 0, leverArmMm: 0, kFactor: 0, singlyReinforced: true,
  };
  if (d <= 0 || fckMPa <= 0) return empty;

  const b = 1000;                       // per metre width [mm]
  const fcd = fckMPa / 1.5;             // design concrete strength [MPa = N/mm²]
  const fyd = fykMPa / 1.15;            // design steel strength
  const MedNmm = Math.max(0, momentKNmPerM) * 1e6; // kNm/m → N·mm per m

  const K = MedNmm / (b * d * d * fcd);
  const singlyReinforced = K <= 0.167;  // EC2 balanced limit (no compression steel)
  const Klim = Math.min(K, 0.167);
  const z = Math.min(0.95 * d, d * (0.5 + Math.sqrt(Math.max(0.25 - Klim / 1.134, 0))));
  const requiredAsMm2 = z > 0 ? MedNmm / (fyd * z) : 0;

  const fctm = 0.3 * Math.pow(fckMPa, 2 / 3); // EC2 mean tensile strength
  const minAsMm2 = Math.max((0.26 * fctm / fykMPa) * b * d, 0.0013 * b * d);

  return {
    requiredAsMm2,
    minAsMm2,
    providedGoverningAsMm2: Math.max(requiredAsMm2, minAsMm2),
    leverArmMm: z,
    kFactor: K,
    singlyReinforced,
  };
};

// ── General EC2 flexural reinforcement design (rectangular beam/section) ───────
// Like computeSlabFlexure but for an arbitrary width b — input a design moment and
// section, get the required tension steel As, then check a chosen bar arrangement.

export const computeFlexuralReinforcement = (input: {
  /** Design moment Med [kNm]. */
  momentKNm: number;
  /** Section width b [mm]. */
  widthMm: number;
  /** Effective depth d [mm]. */
  effectiveDepthMm: number;
  /** Concrete strength fck [MPa]. */
  fckMPa: number;
  /** Steel yield fyk [MPa] (DK rebar 500). */
  fykMPa?: number;
  /** Optional chosen bar diameter [mm] and count → provided As, to check ≥ required. */
  barDiameterMm?: number;
  barCount?: number;
}): {
  requiredAsMm2: number;
  minAsMm2: number;
  maxAsMm2: number;
  governingAsMm2: number;
  providedAsMm2: number;
  leverArmMm: number;
  kFactor: number;
  singlyReinforced: boolean;
  provisionPasses: boolean | null;
} => {
  const { momentKNm, widthMm: b, effectiveDepthMm: d, fckMPa, fykMPa = 500, barDiameterMm, barCount } = input;
  const empty = {
    requiredAsMm2: 0, minAsMm2: 0, maxAsMm2: 0, governingAsMm2: 0, providedAsMm2: 0,
    leverArmMm: 0, kFactor: 0, singlyReinforced: true, provisionPasses: null as boolean | null,
  };
  if (b <= 0 || d <= 0 || fckMPa <= 0) return empty;

  const fcd = fckMPa / 1.5;
  const fyd = fykMPa / 1.15;
  const MedNmm = Math.max(0, momentKNm) * 1e6;
  const K = MedNmm / (b * d * d * fcd);
  const singlyReinforced = K <= 0.167;
  const Klim = Math.min(K, 0.167);
  const z = Math.min(0.95 * d, d * (0.5 + Math.sqrt(Math.max(0.25 - Klim / 1.134, 0))));
  const requiredAsMm2 = z > 0 ? MedNmm / (fyd * z) : 0;

  const fctm = 0.3 * Math.pow(fckMPa, 2 / 3);
  const minAsMm2 = Math.max((0.26 * fctm / fykMPa) * b * d, 0.0013 * b * d);
  const maxAsMm2 = 0.04 * b * (d / 0.9); // 0,04·Ac (approx Ac from d), EC2 §9.2.1.1
  const governingAsMm2 = Math.max(requiredAsMm2, minAsMm2);

  const providedAsMm2 = barDiameterMm && barCount
    ? barCount * Math.PI * (barDiameterMm / 2) ** 2
    : 0;
  const provisionPasses = barDiameterMm && barCount
    ? providedAsMm2 >= governingAsMm2 && providedAsMm2 <= maxAsMm2
    : null;

  return {
    requiredAsMm2, minAsMm2, maxAsMm2, governingAsMm2, providedAsMm2,
    leverArmMm: z, kFactor: K, singlyReinforced, provisionPasses,
  };
};

export const computeWindLoad = (input: {
  area: number;
  windSpeed: number;
  Cp?: number;
}): { pressureKPa: number; forceKN: number } => {
  const { area, windSpeed, Cp = 0.8 } = input;
  const rho = 1.25;
  const pressureKPa = (0.5 * rho * windSpeed * windSpeed * Cp) / 1000;
  return { pressureKPa, forceKN: pressureKPa * area };
};

export const computeSnowLoad = (input: {
  pitchDeg: number;
  sk?: number;
  Ce?: number;
  Ct?: number;
}): { sd: number; mu1: number } => {
  const { pitchDeg, sk = 1.0, Ce = 1.0, Ct = 1.0 } = input;
  let mu1: number;
  if (pitchDeg <= 30) mu1 = 0.8;
  else if (pitchDeg <= 60) mu1 = 0.8 * (1 - (pitchDeg - 30) / 30);
  else mu1 = 0;
  return { sd: mu1 * Ce * Ct * sk, mu1 };
};

// ── Snow drift / accumulation against an obstruction (EC1-1-3 §5.3.6 / §6) ─────
// The uniform case above often is NOT the governing one: snow drifts and piles
// against parapets, taller adjacent buildings and in valleys. This gives the local
// drift shape coefficient μ and the resulting (usually higher) snow load.

export const computeSnowDrift = (input: {
  /** Height of the obstruction the snow drifts against [m] (parapet / step in roof). */
  obstructionHeightM: number;
  /** Characteristic ground snow load sk [kN/m²] (DK zone 1 = 1,0). */
  sk?: number;
  /** Snow weight density γ [kN/m³] — EC1-1-3 recommends 2,0. */
  snowDensityKNm3?: number;
  Ce?: number;
  Ct?: number;
}): { muDrift: number; sDrift: number; driftLengthM: number } => {
  const { obstructionHeightM: h, sk = 1.0, snowDensityKNm3 = 2.0, Ce = 1.0, Ct = 1.0 } = input;
  if (h <= 0 || sk <= 0) return { muDrift: 0, sDrift: 0, driftLengthM: 0 };
  // μ = γ·h/sk, bounded 0,8 ≤ μ ≤ 2,0 (EC1-1-3 §6.2 local drift)
  const muDrift = Math.min(2.0, Math.max(0.8, (snowDensityKNm3 * h) / sk));
  // Drift length ls = 2h, bounded 5–15 m
  const driftLengthM = Math.min(15, Math.max(5, 2 * h));
  return { muDrift, sDrift: muDrift * Ce * Ct * sk, driftLengthM };
};

// Electrical

// Reference resistivity (Ω·mm²/m at 20 °C) and temperature coefficient per conductor.
const CONDUCTOR_PROPS = {
  copper: { rho20: 0.0175, alpha: 0.00393 },
  aluminium: { rho20: 0.028, alpha: 0.00403 },
} as const;

export const computeVoltageDrop = (input: {
  currentA: number;
  lengthM: number;
  crossSectionMm2: number;
  voltageV?: number;
  /** Conductor operating temperature °C. DS/HD 60364-5-52 worst case ≈ 70 °C (PVC). Default 20 °C reference. */
  conductorTempC?: number;
  /** 1 = single-phase (2·L loop), 3 = three-phase (√3·L). */
  phases?: 1 | 3;
  material?: 'copper' | 'aluminium';
}): { voltageDropV: number; voltageDropPct: number; resistivityUsed: number } => {
  const { currentA, lengthM, crossSectionMm2, voltageV = 230, conductorTempC = 20, phases = 1, material = 'copper' } = input;
  if (crossSectionMm2 <= 0) return { voltageDropV: 0, voltageDropPct: 0, resistivityUsed: 0 };
  const { rho20, alpha } = CONDUCTOR_PROPS[material];
  const rho = rho20 * (1 + alpha * (conductorTempC - 20)); // temperature-corrected resistivity
  const factor = phases === 3 ? Math.sqrt(3) : 2;           // 3-phase line-to-line vs single-phase loop
  const voltageDropV = (rho * factor * lengthM * currentA) / crossSectionMm2;
  return { voltageDropV, voltageDropPct: (voltageDropV / voltageV) * 100, resistivityUsed: rho };
};

// ── Cable ampacity with DS/HD 60364-5-52 derating ─────────────────────────────
// The base ampacity of a cable is reduced by ambient temperature, grouping and the
// installation method. The design rule is In ≤ Iz (protective device ≤ derated cable).

export const computeCableAmpacity = (input: {
  /** Tabulated (reference-condition) current-carrying capacity Iz,ref [A]. */
  baseAmpacityA: number;
  /** Ambient-temperature correction factor (Table B.52.14). */
  ambientFactor?: number;
  /** Grouping/bundling factor (Table B.52.17). */
  groupingFactor?: number;
  /** Selected protective-device rating In [A]. */
  protectiveDeviceA: number;
}): { deratedAmpacityA: number; passed: boolean; utilization: number } => {
  const { baseAmpacityA, ambientFactor = 1, groupingFactor = 1, protectiveDeviceA } = input;
  const deratedAmpacityA = baseAmpacityA * ambientFactor * groupingFactor;
  return {
    deratedAmpacityA,
    passed: protectiveDeviceA <= deratedAmpacityA,          // In ≤ Iz
    utilization: deratedAmpacityA > 0 ? protectiveDeviceA / deratedAmpacityA : Infinity,
  };
};

// ── Earth-fault loop impedance vs disconnection time (DS/HD 60364-4-41) ────────
// Automatic disconnection of supply: the loop impedance Zs must be low enough that
// the fault current Ia trips the protective device within the required time.

export const computeEarthFaultLoop = (input: {
  /** Nominal line-to-earth voltage U0 [V] (230 in a TN system). */
  voltageU0?: number;
  /** Measured/estimated earth-fault loop impedance Zs [Ω]. */
  loopImpedanceOhm: number;
  /** Protective device trip current Ia for the required disconnection time [A]
   *  (e.g. gG fuse or B/C MCB × factor). */
  disconnectCurrentA: number;
}): { faultCurrentA: number; maxZsOhm: number; passed: boolean } => {
  const { voltageU0 = 230, loopImpedanceOhm: Zs, disconnectCurrentA: Ia } = input;
  if (Zs <= 0 || Ia <= 0) return { faultCurrentA: 0, maxZsOhm: 0, passed: false };
  const faultCurrentA = voltageU0 / Zs;                    // If = U0 / Zs
  const maxZsOhm = voltageU0 / Ia;                         // Zs ≤ U0 / Ia (EC 411.4.4)
  return { faultCurrentA, maxZsOhm, passed: Zs <= maxZsOhm };
};

// VVS

export const computePipeDiameter = (input: {
  flowLps: number;
  velocityMs: number;
}): { diamMm: number; areaM2: number } => {
  const { flowLps, velocityMs } = input;
  if (velocityMs <= 0 || flowLps <= 0) return { diamMm: 0, areaM2: 0 };
  const flowM3s = flowLps / 1000;
  const areaM2 = flowM3s / velocityMs;
  return { diamMm: Math.sqrt((4 * areaM2) / Math.PI) * 1000, areaM2 };
};

export const computeDrainDrop = (input: {
  lengthM: number;
  slopePct: number;
  /** DS 432 default is 1:40 = 2,5%. Pass the pipe material's own minimum (e.g. cast-iron 1,5%) to check against that instead. */
  minSlopePct?: number;
}): { dropCm: number; slopePromille: number; compliant: boolean } => {
  const { lengthM, slopePct, minSlopePct = 2.5 } = input;
  return {
    dropCm: lengthM * (slopePct / 100) * 100,
    slopePromille: slopePct * 10,
    compliant: slopePct >= minSlopePct,
  };
};

// HVAC

export const computeVentilationFlow = (input: {
  areaM2: number;
  persons: number;
}): { flowLps: number; flowM3h: number; areaBasedLps: number; personBasedLps: number } => {
  const { areaM2, persons } = input;
  // BR18 §425/§427: area-based general ventilation and person-based ventilation are
  // alternative minimum floors, not additive — design flow is the greater of the two.
  const areaBasedLps = 0.3 * areaM2;
  const personBasedLps = 7 * persons;
  const flowLps = Math.max(areaBasedLps, personBasedLps);
  return { flowLps, flowM3h: flowLps * 3.6, areaBasedLps, personBasedLps };
};

export const computeDuctDiameter = (input: {
  flowM3h: number;
  velocityMs: number;
}): { diamMm: number; areaM2: number } => {
  const { flowM3h, velocityMs } = input;
  if (velocityMs <= 0 || flowM3h <= 0) return { diamMm: 0, areaM2: 0 };
  const flowM3s = flowM3h / 3600;
  const areaM2 = flowM3s / velocityMs;
  return { diamMm: Math.sqrt((4 * areaM2) / Math.PI) * 1000, areaM2 };
};

// ── Duct pressure loss / fan static pressure (DS 447) ─────────────────────────
// Air-side counterpart to the pipe calc: friction along the duct + fitting losses
// → the static pressure a fan must deliver. Also flags velocity against DS 447.

export const computeDuctPressureLoss = (input: {
  /** Airflow [m³/h]. */
  flowM3h: number;
  /** Duct diameter [mm]. */
  diameterMm: number;
  /** Straight duct length [m]. */
  lengthM: number;
  /** Sum of local loss coefficients ΣK (bends, branches, dampers). */
  fittingsK?: number;
  /** Absolute roughness [mm] (galvanised steel ≈ 0,09; flex ≈ 3). */
  roughnessMm?: number;
  /** Air density [kg/m³]. */
  airDensityKgM3?: number;
  /** Kinematic viscosity of air [m²/s] (20 °C ≈ 1,51e-5). */
  kinematicViscosity?: number;
}): {
  velocityMs: number;
  reynolds: number;
  frictionFactor: number;
  frictionLossPa: number;
  minorLossPa: number;
  totalLossPa: number;
  velocityOk: boolean;
} => {
  const { flowM3h, diameterMm, lengthM, fittingsK = 0, roughnessMm = 0.09, airDensityKgM3 = 1.2, kinematicViscosity = 1.51e-5 } = input;
  const d = diameterMm / 1000;
  if (d <= 0 || flowM3h <= 0) {
    return { velocityMs: 0, reynolds: 0, frictionFactor: 0, frictionLossPa: 0, minorLossPa: 0, totalLossPa: 0, velocityOk: true };
  }
  const area = Math.PI * (d / 2) ** 2;
  const v = (flowM3h / 3600) / area;
  const Re = (v * d) / kinematicViscosity;
  const f = swameeJainFriction(Re, (roughnessMm / 1000) / d);
  const dynP = 0.5 * airDensityKgM3 * v * v;         // dynamic pressure ½ρv²
  const frictionLossPa = f * (lengthM / d) * dynP;
  const minorLossPa = fittingsK * dynP;
  return {
    velocityMs: v,
    reynolds: Re,
    frictionFactor: f,
    frictionLossPa,
    minorLossPa,
    totalLossPa: frictionLossPa + minorLossPa,
    velocityOk: v <= 6,                               // DS 447 main-duct guidance ≈ 6 m/s
  };
};

// Energy & Climate

export interface ConstructionLayer {
  name: string;
  lambdaWmK: number;
  thicknessMm: number;
}

export const computeUValue = (input: {
  layers: ConstructionLayer[];
  rsi?: number;
  rse?: number;
}): { Rtotal: number; uValue: number; layerResistances: number[] } => {
  const { layers, rsi = 0.13, rse = 0.04 } = input;
  const layerResistances = layers.map(l =>
    l.lambdaWmK > 0 ? (l.thicknessMm / 1000) / l.lambdaWmK : 0
  );
  const Rtotal = rsi + layerResistances.reduce((a, b) => a + b, 0) + rse;
  return { Rtotal, uValue: Rtotal > 0 ? 1 / Rtotal : 0, layerResistances };
};

export const computeHeatLoss = (input: {
  uValue: number;
  areaM2: number;
  deltaT: number;
}): { heatLossW: number; heatLossKW: number } => {
  const { uValue, areaM2, deltaT } = input;
  const heatLossW = uValue * areaM2 * deltaT;
  return { heatLossW, heatLossKW: heatLossW / 1000 };
};

// ── Whole-window U-value Uw (EN ISO 10077-1) ──────────────────────────────────
// A true 3-term window U-value: glazing (Ug·Ag) + frame (Uf·Af) + the glass-edge
// linear thermal bridge (ψg·lg) — the edge term the simple area-weighted method drops.

export const computeWindowUValue = (input: {
  /** Window outer width & height [m]. */
  widthM: number;
  heightM: number;
  /** Frame face width [mm]. */
  frameWidthMm: number;
  /** Centre-of-glass U-value Ug [W/m²K]. */
  ugWm2K: number;
  /** Frame U-value Uf [W/m²K]. */
  ufWm2K: number;
  /** Glass-edge linear transmittance ψg [W/mK]: warm-edge ≈ 0,04; aluminium spacer ≈ 0,08. */
  psiGWmK?: number;
  /** BR18 requirement to check against [W/m²K] (new-build ≈ 1,2). */
  requirementWm2K?: number;
}): {
  windowAreaM2: number;
  glassAreaM2: number;
  frameAreaM2: number;
  glassPerimeterM: number;
  uwWm2K: number;
  passed: boolean;
} => {
  const { widthM: W, heightM: H, frameWidthMm, ugWm2K, ufWm2K, psiGWmK = 0.04, requirementWm2K = 1.2 } = input;
  const f = frameWidthMm / 1000;
  if (W <= 0 || H <= 0) {
    return { windowAreaM2: 0, glassAreaM2: 0, frameAreaM2: 0, glassPerimeterM: 0, uwWm2K: 0, passed: false };
  }
  const Aw = W * H;
  const gW = Math.max(0, W - 2 * f);
  const gH = Math.max(0, H - 2 * f);
  const Ag = gW * gH;
  const Af = Math.max(0, Aw - Ag);
  const lg = 2 * (gW + gH);
  const uwWm2K = Aw > 0 ? (Ag * ugWm2K + Af * ufWm2K + lg * psiGWmK) / Aw : 0;
  return {
    windowAreaM2: Aw,
    glassAreaM2: Ag,
    frameAreaM2: Af,
    glassPerimeterM: lg,
    uwWm2K,
    passed: uwWm2K <= requirementWm2K,
  };
};

// ── Annual energy frame (simplified, Be18-aligned) ────────────────────────────
// Extends the instantaneous U·A·ΔT loss to an annual balance: transmission +
// ventilation loss over the heating season, minus solar/internal gains → the
// net annual heat demand in kWh/m²/year that BR18's energy frame is expressed in.

export const computeAnnualEnergyFrame = (input: {
  /** Transmission heat-loss coefficient Σ(U·A) incl. thermal bridges [W/K]. */
  transmissionHTWperK: number;
  /** Ventilation air-change rate n [1/h]. */
  ventilationAirChangeRate: number;
  /** Heated volume [m³]. */
  heatedVolumeM3: number;
  /** Heated floor area [m²]. */
  heatedFloorAreaM2: number;
  /** Heating degree-days [K·days]. DK ≈ 2906 (base 17 °C). */
  degreeDays?: number;
  /** Internal gains [kWh/m²/year]. Typical ≈ 5–10. */
  internalGainsKwhM2Yr?: number;
  /** Solar gains [kWh/m²/year]. Typical ≈ 10–20. */
  solarGainsKwhM2Yr?: number;
}): {
  ventilationHVWperK: number;
  transmissionKwhYr: number;
  ventilationKwhYr: number;
  grossHeatLossKwhYr: number;
  gainsKwhYr: number;
  netHeatDemandKwhYr: number;
  netHeatDemandKwhM2Yr: number;
} => {
  const {
    transmissionHTWperK, ventilationAirChangeRate: n, heatedVolumeM3: V, heatedFloorAreaM2: A,
    degreeDays = 2906, internalGainsKwhM2Yr = 8, solarGainsKwhM2Yr = 12,
  } = input;
  const ventilationHVWperK = 0.34 * n * V;              // 0,34 Wh/(m³·K) air heat capacity
  const factor = (degreeDays * 24) / 1000;             // K·days → kWh per W/K
  const transmissionKwhYr = transmissionHTWperK * factor;
  const ventilationKwhYr = ventilationHVWperK * factor;
  const grossHeatLossKwhYr = transmissionKwhYr + ventilationKwhYr;
  const gainsKwhYr = (internalGainsKwhM2Yr + solarGainsKwhM2Yr) * Math.max(0, A);
  const netHeatDemandKwhYr = Math.max(0, grossHeatLossKwhYr - gainsKwhYr);
  return {
    ventilationHVWperK,
    transmissionKwhYr,
    ventilationKwhYr,
    grossHeatLossKwhYr,
    gainsKwhYr,
    netHeatDemandKwhYr,
    netHeatDemandKwhM2Yr: A > 0 ? netHeatDemandKwhYr / A : 0,
  };
};

export const computeDewPoint = (input: {
  tempC: number;
  relativeHumidityPct: number;
}): { dewPointC: number } => {
  const { tempC, relativeHumidityPct } = input;
  const a = 17.27;
  const b = 237.7;
  const alpha = (a * tempC) / (b + tempC) + Math.log(relativeHumidityPct / 100);
  return { dewPointC: (b * alpha) / (a - alpha) };
};

/** Saturation vapour pressure [Pa] over water/ice (Magnus). */
const saturationVapourPressure = (tempC: number): number =>
  tempC >= 0
    ? 610.5 * Math.exp((17.269 * tempC) / (237.3 + tempC))
    : 610.5 * Math.exp((21.875 * tempC) / (265.5 + tempC));

// ── Glaser method: interstitial condensation (DS/EN ISO 13788) ────────────────
// Surface dew-point alone can't catch condensation buried INSIDE a wall/roof. The
// Glaser method builds the temperature and vapour-pressure profiles through the
// layers and flags any interface where actual vapour pressure meets saturation.

export interface GlaserLayer {
  name: string;
  thicknessMm: number;
  lambdaWmK: number;
  /** Water-vapour diffusion resistance factor μ (still air = 1). */
  mu: number;
}

export const computeGlaser = (input: {
  layers: GlaserLayer[];
  indoorTempC: number;
  indoorRhPct: number;
  outdoorTempC: number;
  outdoorRhPct: number;
  rsi?: number;
  rse?: number;
}): {
  interfaces: Array<{
    name: string;
    tempC: number;
    saturationPa: number;
    vapourPa: number;
    condensation: boolean;
  }>;
  condensationRisk: boolean;
  minMarginPa: number;
} => {
  const { layers, indoorTempC, indoorRhPct, outdoorTempC, outdoorRhPct, rsi = 0.13, rse = 0.04 } = input;
  if (layers.length === 0) return { interfaces: [], condensationRisk: false, minMarginPa: 0 };

  // Thermal resistances (incl. surface films) and vapour resistances (Sd = μ·d).
  const layerR = layers.map(l => (l.lambdaWmK > 0 ? (l.thicknessMm / 1000) / l.lambdaWmK : 0));
  const Rtotal = rsi + layerR.reduce((a, b) => a + b, 0) + rse;
  const layerSd = layers.map(l => l.mu * (l.thicknessMm / 1000)); // equivalent air-layer thickness [m]
  const SdTotal = layerSd.reduce((a, b) => a + b, 0);

  const pIn = (indoorRhPct / 100) * saturationVapourPressure(indoorTempC);
  const pOut = (outdoorRhPct / 100) * saturationVapourPressure(outdoorTempC);
  const dT = indoorTempC - outdoorTempC;

  // Walk interfaces from the inner surface outward. Temperature drops by thermal
  // resistance; vapour pressure drops (linearly in Sd) by vapour resistance.
  let cumR = rsi;      // start after the inner surface film
  let cumSd = 0;
  let minMargin = Infinity;
  let anyCondensation = false;

  const interfaces = layers.map((l, i) => {
    cumR += layerR[i];
    cumSd += layerSd[i];
    const tempC = indoorTempC - (cumR / Rtotal) * dT;
    const saturationPa = saturationVapourPressure(tempC);
    const vapourPa = SdTotal > 0 ? pIn - (cumSd / SdTotal) * (pIn - pOut) : pIn;
    const margin = saturationPa - vapourPa;
    if (margin < minMargin) minMargin = margin;
    const condensation = vapourPa >= saturationPa;
    if (condensation) anyCondensation = true;
    return { name: `Efter ${l.name}`, tempC, saturationPa, vapourPa, condensation };
  });

  return { interfaces, condensationRisk: anyCondensation, minMarginPa: minMargin };
};

// Stairs & Access

export const computeStairGeometry = (input: {
  totalHeightM: number;
  riseM: number;
}): { steps: number; actualRiseM: number; runM: number; formulaValue: number; angleD: number; compliant: boolean } => {
  const { totalHeightM, riseM } = input;
  const steps = riseM > 0 ? Math.round(totalHeightM / riseM) : 0;
  const actualRiseM = steps > 0 ? totalHeightM / steps : 0;
  const runM = Math.max(0.15, Math.min(0.40, 0.63 - 2 * actualRiseM));
  const formulaValue = 2 * actualRiseM * 100 + runM * 100;
  const angleD = runM > 0 ? (Math.atan(actualRiseM / runM) * 180) / Math.PI : 0;
  return {
    steps,
    actualRiseM,
    runM,
    formulaValue,
    angleD,
    compliant: formulaValue >= 60 && formulaValue <= 64 && angleD < 45,
  };
};

export const computeRampLength = (input: {
  heightCm: number;
  ratio: number;
}): { lengthM: number; slopePct: number; accessible: boolean } => {
  const { heightCm, ratio } = input;
  return {
    lengthM: (heightCm * ratio) / 100,
    slopePct: ratio > 0 ? 100 / ratio : 0,
    accessible: ratio >= 20,
  };
};

// ── Financial / Budget ───────────────────────────────────────────────────────

export interface BudgetLineItem {
  name: string;
  amount: number;
  type: 'material' | 'labor' | 'other';
}

export const computeBudget = (input: {
  items: BudgetLineItem[];
  contingencyPct: number;
  overheadPct: number;
  includeVat: boolean;
}): {
  materialTotal: number;
  laborTotal: number;
  otherTotal: number;
  subtotal: number;
  overhead: number;
  contingency: number;
  totalExVat: number;
  vat: number;
  total: number;
} => {
  const { items, contingencyPct, overheadPct, includeVat } = input;
  const materialTotal = items.filter(i => i.type === 'material').reduce((s, i) => s + i.amount, 0);
  const laborTotal = items.filter(i => i.type === 'labor').reduce((s, i) => s + i.amount, 0);
  const otherTotal = items.filter(i => i.type === 'other').reduce((s, i) => s + i.amount, 0);
  const subtotal = materialTotal + laborTotal + otherTotal;
  const overhead = subtotal * (overheadPct / 100);
  const contingency = (subtotal + overhead) * (contingencyPct / 100);
  const totalExVat = subtotal + overhead + contingency;
  const vat = includeVat ? totalExVat * 0.25 : 0;
  const total = totalExVat + vat;
  return { materialTotal, laborTotal, otherTotal, subtotal, overhead, contingency, totalExVat, vat, total };
};

export const computeMaterialCost = (input: {
  items: { name: string; qty: number; unitPrice: number }[];
  wastagePct: number;
  includeVat: boolean;
}): { subtotal: number; wastage: number; totalExVat: number; vat: number; total: number } => {
  const { items, wastagePct, includeVat } = input;
  const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const wastage = subtotal * (wastagePct / 100);
  const totalExVat = subtotal + wastage;
  const vat = includeVat ? totalExVat * 0.25 : 0;
  return { subtotal, wastage, totalExVat, vat, total: totalExVat + vat };
};

export const computeLaborCost = (input: {
  workers: number;
  hoursPerDay: number;
  days: number;
  hourlyRate: number;
  laborBurdenPct: number;
  includeVat: boolean;
}): { totalHours: number; baseCost: number; burden: number; totalExVat: number; vat: number; total: number } => {
  const { workers, hoursPerDay, days, hourlyRate, laborBurdenPct, includeVat } = input;
  const totalHours = workers * hoursPerDay * days;
  const baseCost = totalHours * hourlyRate;
  const burden = baseCost * (laborBurdenPct / 100);
  const totalExVat = baseCost + burden;
  const vat = includeVat ? totalExVat * 0.25 : 0;
  return { totalHours, baseCost, burden, totalExVat, vat, total: totalExVat + vat };
};

export interface AmortizationYear {
  year: number;
  balance: number;
  cumulativeInterest: number;
}

export const computeLoanAmortization = (input: {
  principal: number;
  downPaymentPct: number;
  annualRatePct: number;
  termYears: number;
  annualAdminFeeKr: number;
}): {
  loan: number;
  downPayment: number;
  monthlyPayment: number;
  totalPaid: number;
  totalInterest: number;
  aprPct: number;
  yearlyData: AmortizationYear[];
} => {
  const { principal, downPaymentPct, annualRatePct, termYears, annualAdminFeeKr } = input;
  const downPayment = principal * (downPaymentPct / 100);
  const loan = Math.max(0, principal - downPayment);
  const r = annualRatePct / 100 / 12;
  const n = Math.round(termYears * 12);

  if (loan <= 0 || n <= 0) {
    return { loan, downPayment, monthlyPayment: 0, totalPaid: 0, totalInterest: 0, aprPct: 0, yearlyData: [] };
  }

  const monthlyPayment = r === 0 ? loan / n : (loan * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const totalPaid = monthlyPayment * n;
  const totalInterest = totalPaid - loan;

  // ÅOP (Danish APR) is the EFFECTIVE annual rate, not the nominal monthly rate × 12 —
  // required by kreditaftaleloven even when there are zero fees, since monthly
  // compounding alone makes the effective annual rate exceed the nominal rate.
  let rApr = r;
  if (annualAdminFeeKr > 0) {
    // Effective monthly outflow includes pro-rated admin fee
    const monthlyAdmin = annualAdminFeeKr / 12;
    const totalMonthly = monthlyPayment + monthlyAdmin;
    // Solve for r_apr: loan = ∑ totalMonthly / (1+r_apr)^t (Newton–Raphson)
    rApr = r;
    for (let iter = 0; iter < 50; iter++) {
      const pv = rApr === 0 ? totalMonthly * n
        : totalMonthly * (1 - Math.pow(1 + rApr, -n)) / rApr;
      // d/dr[(1-(1+r)^-n)/r], limit as r→0 is -n(n+1)/2
      const dpv = rApr === 0 ? -totalMonthly * n * (n + 1) / 2
        : totalMonthly * (n * Math.pow(1 + rApr, -n - 1) * rApr - (1 - Math.pow(1 + rApr, -n))) / (rApr * rApr);
      if (dpv === 0) break;
      const delta = (pv - loan) / dpv;
      rApr -= delta;
      if (Math.abs(delta) < 1e-9) break;
    }
  }
  const aprPct = Math.max(0, (Math.pow(1 + rApr, 12) - 1) * 100);

  let balance = loan;
  let cumulativeInterest = 0;
  const yearlyData: AmortizationYear[] = [];
  let monthsElapsed = 0;
  for (let y = 1; y <= Math.min(termYears, 40); y++) {
    for (let m = 0; m < 12; m++) {
      monthsElapsed += 1;
      const interestPmt = balance * r;
      const principalPmt = monthlyPayment - interestPmt;
      cumulativeInterest += interestPmt;
      balance = Math.max(0, balance - principalPmt);
      if (monthsElapsed >= n) balance = 0; // snap to zero at term end to avoid float drift
    }
    yearlyData.push({ year: y, balance: Math.max(0, balance), cumulativeInterest });
  }

  return { loan, downPayment, monthlyPayment, totalPaid, totalInterest, aprPct, yearlyData };
};

// ── PaintEstimatorPro (Malingsestimering Pro) ────────────────────────────────

export const computePaintPro = ({
  totalAreaM2,
  coats,
  coverageM2PerL,
  wastagePct,
}: {
  totalAreaM2: number;
  coats: number;
  coverageM2PerL: number;
  wastagePct: number;
}) => {
  const netLiters = (totalAreaM2 * coats) / (coverageM2PerL > 0 ? coverageM2PerL : 10);
  const totalLiters = netLiters * (1 + wastagePct / 100);
  return { netLiters, totalLiters };
};

// ── StudWall (Skeletvæg) ─────────────────────────────────────────────────────

export const computeStudWall = ({
  lengthM,
  heightM,
  spacingMm,
  layers,
}: {
  lengthM: number;
  heightM: number;
  spacingMm: number;
  layers: number;
}) => {
  const cc = spacingMm > 0 ? spacingMm : 450;
  const rawStuds = Math.ceil((lengthM * 1000) / cc) + 1;
  const studs = Math.ceil(rawStuds * 1.1);
  const trackLengthM = lengthM * 2;
  const insulationM2 = lengthM * heightM * 1.05;
  const boardAreaM2 = lengthM * heightM * 2 * layers * 1.1;
  const boards = Math.ceil(boardAreaM2 / 2.88);
  const screws = Math.ceil(lengthM * heightM * 2 * layers * 20);
  return { studs, trackLengthM, insulationM2, boards, screws };
};

// ── CeilingPanel (Loftplader) ────────────────────────────────────────────────

export const computeCeilingPanel = ({
  areaLM,
  areaWM,
  panelLM,
  panelWM,
  wastagePct,
}: {
  areaLM: number;
  areaWM: number;
  panelLM: number;
  panelWM: number;
  wastagePct: number;
}) => {
  const ceilingAreaM2 = areaLM * areaWM;
  const panelAreaM2 = panelLM * panelWM;
  const rawPanels = panelAreaM2 > 0 ? ceilingAreaM2 / panelAreaM2 : 0;
  const panels = Math.ceil(rawPanels * (1 + wastagePct / 100));
  const totalAreaM2 = ceilingAreaM2 * (1 + wastagePct / 100);
  return { panels, totalAreaM2 };
};

// ── Input parsing helper ─────────────────────────────────────────────────────

export type CalculatorInputs = Record<string, string | number>;

const num = (inputs: CalculatorInputs, id: string, fallback = 0): number => {
  const raw = inputs[id];
  const parsed = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const str = (inputs: CalculatorInputs, id: string, fallback = ''): string => {
  const raw = inputs[id];
  return raw === undefined || raw === null ? fallback : String(raw);
};

const round = (value: number, decimals: number): number => {
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
};

// ── Computable calculator definitions ────────────────────────────────────────

interface ComputableDef extends Omit<CalculatorMeta, 'computable'> {
  inputs: CalculatorInputDef[];
  compute: (inputs: CalculatorInputs) => CalculatorResult;
}

const COMPUTABLE: ComputableDef[] = [
  {
    id: 'beton-volumen',
    name: 'Betonvolumen',
    category: 'Beton & Armering',
    route: '/tools/beton-armering/betonvolumen',
    resultUnit: 'm³',
    modes: 'basic',
    safetyCritical: false,
    standards: [
      ...STANDARDS_CATALOG.concrete,
    ],
    help: {
      purpose: 'Beregner nødvendigt betonvolumen og estimeret vægt for plade, fundament eller søjle — inkl. spild.',
      variables: [
        { symbol: 'L', label: 'Længde', unit: 'm', description: 'Pladens/fundamentets længde i meter.' },
        { symbol: 'B', label: 'Bredde', unit: 'm', description: 'Pladens/fundamentets bredde i meter.' },
        { symbol: 't', label: 'Tykkelse/Højde', unit: 'm', description: 'Lagets tykkelse (plade/fundament) eller søjlens højde.' },
        { symbol: 'd', label: 'Diameter', unit: 'm', description: 'Søjlens/rørets diameter (kun ved søjle-form).' },
        { symbol: 'n', label: 'Antal', unit: 'stk.', description: 'Antal identiske elementer.' },
        { symbol: 's', label: 'Spild', unit: '%', description: 'Spildfaktor — typisk 5–10% ved støbning på stedet.' },
        { symbol: 'ρ', label: 'Densitet', unit: 'kg/m³', description: 'Betonens densitet afhænger af styrkeklassen: C20/25≈2300, C25/30≈2400, C30/37≈2450.' },
      ],
      formula: 'Plade/fundament: V = L × B × t × n × (1 + s/100)\nSøjle: V = π × (d/2)² × t × n × (1 + s/100)\nVægt: W = V × ρ',
      assumptions: [
        '5% spildfaktor for fabriksbeton leveret på stedet.',
        'Densitet varierer med styrkeklassen — vælg den korrekte klasse.',
        'Beregningen tager ikke højde for armering (stål) i volumenet.',
      ],
      workedExample: '5m × 4m plade, 150mm tyk, C25/30 (2400 kg/m³), 5% spild:\nV = 5 × 4 × 0,15 × 1 × 1,05 = 3,15 m³\nW = 3,15 × 2400 = 7 560 kg ≈ 7,56 t',
      standardsExplained: 'DS/EN 1992-1-1 (EC2) specificerer styrkeklasser og dæklagskrav for armeret beton. BR18 §418 stiller krav til beton i kontakt med jord (min. C25/30 eksponeringsklasse XC2).',
    },
    inputs: [
      {
        id: 'shape',
        label: 'Form',
        type: 'select',
        options: [
          { label: 'Plade/Gulv', value: 'slab' },
          { label: 'Fundament', value: 'footing' },
          { label: 'Søjle/Rør', value: 'column' },
        ],
        defaultValue: 'slab',
      },
      { id: 'length', label: 'Længde', unit: 'm', defaultValue: '5', visibleWhen: { shape: 'slab' } },
      { id: 'width', label: 'Bredde', unit: 'm', defaultValue: '4', visibleWhen: { shape: 'slab' } },
      { id: 'diameter', label: 'Diameter', unit: 'm', defaultValue: '0.3', visibleWhen: { shape: 'column' } },
      { id: 'depth', label: 'Tykkelse/Højde', unit: 'm', defaultValue: '0.1', info: 'Pladedæk: typisk 150–300 mm. Fundament: 300–600 mm.' },
      { id: 'quantity', label: 'Antal', unit: 'stk', defaultValue: '1' },
      { id: 'wastage', label: 'Spild', unit: '%', defaultValue: '5' },
      {
        id: 'quality',
        label: 'Betonkvalitet',
        type: 'select',
        options: [
          { label: 'C20/25', value: '2300' },
          { label: 'C25/30', value: '2400' },
          { label: 'C30/37', value: '2450' },
        ],
        defaultValue: '2400',
      },
    ],
    compute: (inputs) => {
      const shapeRaw = str(inputs, 'shape', 'slab');
      const shape: ConcreteShape = shapeRaw === 'footing' ? 'footing' : shapeRaw === 'column' ? 'column' : 'slab';
      const { volume, weightKg } = computeConcreteVolume({
        shape,
        length: num(inputs, 'length'),
        width: num(inputs, 'width'),
        depth: num(inputs, 'depth'),
        diameter: num(inputs, 'diameter'),
        quantity: num(inputs, 'quantity', 1),
        wastagePct: num(inputs, 'wastage'),
        density: num(inputs, 'quality', 2400),
      });
      return {
        value: round(volume, 3),
        unit: 'm³',
        summary: `${round(volume, 3)} m³ beton · ca. ${round(weightKg / 1000, 2)} tons`,
        breakdown: [{ label: 'Estimeret vægt', value: round(weightKg / 1000, 2), unit: 'tons' }],
      };
    },
  },
  {
    id: 'blandingsforhold',
    name: 'Blandingsforhold (Beton/Mørtel)',
    category: 'Beton & Armering',
    route: '/tools/beton-armering/blandingsforhold',
    resultUnit: 'liter cement',
    modes: 'basic',
    safetyCritical: false,
    standards: STANDARDS_CATALOG.concrete,
    help: {
      purpose: 'Beregner mængder af cement, sand, sten og vand til en given mængde beton eller mørtel — i de mest brugte blandingsforhold.',
      variables: [
        { symbol: 'V', label: 'Ønsket volumen', unit: 'liter', description: 'Det færdige (komprimerede) volumen beton eller mørtel.' },
        { symbol: 'f', label: 'Tørvolumesfaktor', unit: '–', description: '1,5 for 1:2:3 og 1:3:5 (tørstoffer fylder 50% mere end vådbeton); 1,3 for 1:4 mørtel.' },
      ],
      formula: 'TørtVolumen = V × f\nCement = (c-del / total) × TørtVolumen\nSand = (s-del / total) × TørtVolumen\nSten = (st-del / total) × TørtVolumen\nVand = Cement × 0,6',
      assumptions: [
        'Vandcement-forhold ≈ 0,6 (W/C-tal) for standard konstruktionsbeton.',
        'En 25 kg cementpose svarer til ca. 18 liter.',
        'Blanding 1:4 (mørtel) uden sten har lavere svindkoefficient (f=1,3).',
      ],
      workedExample: '100 liter beton (1:2:3):\nTørt = 100 × 1,5 = 150 L\nCement = 1/6 × 150 = 25 L → 2 poser\nSand = 2/6 × 150 = 50 L\nSten = 3/6 × 150 = 75 L\nVand = 25 × 0,6 = 15 L',
      standardsExplained: 'DS/EN 1992-1-1 (EC2) anbefaler W/C ≤ 0,5 for eksponerede konstruktioner. Blandingsforholdene her er vejledende til mindre støbearbejder og ikke egnet til statisk belastede konstruktioner uden ingeniørberegning.',
    },
    inputs: [
      {
        id: 'mixType',
        label: 'Blanding',
        type: 'select',
        options: [
          { label: 'Fundament (1:3:5)', value: '1:3:5' },
          { label: 'Gulv (1:2:3)', value: '1:2:3' },
          { label: 'Mørtel (1:4)', value: '1:4' },
        ],
        defaultValue: '1:3:5',
      },
      { id: 'volume', label: 'Ønsket mængde (færdig)', unit: 'liter', defaultValue: '100' },
    ],
    compute: (inputs) => {
      const mixRaw = str(inputs, 'mixType', '1:3:5');
      const mixType: MixRatioType = mixRaw === '1:2:3' ? '1:2:3' : mixRaw === '1:4' ? '1:4' : '1:3:5';
      const r = computeMixRatio(mixType, num(inputs, 'volume'));
      return {
        value: round(r.cement, 0),
        unit: 'liter cement',
        summary: `${round(r.cement, 0)} L cement (${r.cementBags} poser à 25 kg) · ${round(r.sand, 0)} L sand` +
          (r.stone > 0 ? ` · ${round(r.stone, 0)} L sten` : '') +
          ` · ${round(r.water, 0)} L vand`,
        breakdown: [
          { label: 'Cementposer (25 kg)', value: r.cementBags, unit: 'stk.' },
          { label: 'Sand/Grus', value: round(r.sand, 0), unit: 'liter' },
          ...(r.stone > 0 ? [{ label: 'Sten', value: round(r.stone, 0), unit: 'liter' }] : []),
          { label: 'Vand (ca.)', value: round(r.water, 0), unit: 'liter' },
        ],
      };
    },
  },
  {
    id: 'flisemaengde',
    name: 'Flisemængde',
    category: 'Gulve & Overflader',
    route: '/tools/gulve-overflader/flisemaengde',
    resultUnit: 'stk.',
    modes: 'basic',
    safetyCritical: false,
    standards: [{ code: 'BR18', note: 'Vejledende dækningsevne og spildfaktorer fra fliseproducenter.' }],
    help: {
      purpose: 'Beregner antal fliser og samlet areal inkl. fugning og spild til gulv- eller vægbelægning.',
      variables: [
        { symbol: 'L', label: 'Rum længde', unit: 'm', description: 'Rummets eller fladens længde.' },
        { symbol: 'B', label: 'Rum bredde', unit: 'm', description: 'Rummets eller fladens bredde.' },
        { symbol: 'fl', label: 'Fliselængde', unit: 'cm', description: 'Flisens nominelle længde.' },
        { symbol: 'fb', label: 'Flisebredde', unit: 'cm', description: 'Flisens nominelle bredde.' },
        { symbol: 'g', label: 'Fugebredde', unit: 'mm', description: 'Afstand mellem fliser — typisk 2–5 mm for indvendige fliser.' },
        { symbol: 's', label: 'Spild', unit: '%', description: 'Spild ved skæring og tilpasning — typisk 10% for rette vægge, 15% for diagonalt mønster.' },
      ],
      formula: 'Fladearea = L × B\nFliseareaWithFuge = (fl/100 + g/1000) × (fb/100 + g/1000)\nRåAntal = Fladearea / FliseareaWithFuge\nAntal = ⌈RåAntal × (1 + s/100)⌉',
      assumptions: [
        '10% standardspild for retlinjet lægning.',
        '15% anbefales for diagonal eller mosaikmønster.',
        'Beregningen tager ikke højde for nicher eller rørgennemføringer.',
      ],
      standardsExplained: 'Ingen lovpligtig standard for flisemængder. Spildfaktorer er producent­vejledende. Vælg fliser med samme batch-nummer for farveensartethed.',
    },
    inputs: [
      { id: 'areaL', label: 'Rum længde', unit: 'm', defaultValue: '4' },
      { id: 'areaW', label: 'Rum bredde', unit: 'm', defaultValue: '3' },
      { id: 'tileL', label: 'Fliselængde', unit: 'cm', defaultValue: '30' },
      { id: 'tileW', label: 'Flisebredde', unit: 'cm', defaultValue: '60' },
      { id: 'grout', label: 'Fugebredde', unit: 'mm', defaultValue: '3' },
      { id: 'wastage', label: 'Spildfaktor', unit: '%', defaultValue: '10' },
    ],
    compute: (inputs) => {
      const r = computeTileQuantity({
        areaL: num(inputs, 'areaL'),
        areaW: num(inputs, 'areaW'),
        tileLcm: num(inputs, 'tileL'),
        tileWcm: num(inputs, 'tileW'),
        groutMm: num(inputs, 'grout'),
        wastagePct: num(inputs, 'wastage'),
      });
      return {
        value: r.numTiles,
        unit: 'stk.',
        summary: `${r.numTiles} fliser (inkl. spild) · ${round(r.totalArea, 2)} m² at købe`,
        breakdown: [{ label: 'Areal at købe', value: round(r.totalArea, 2), unit: 'm²' }],
      };
    },
  },
  {
    id: 'maling-grunder',
    name: 'Maling & Grunder',
    category: 'Vægge & Skillevægge',
    route: '/tools/vaegge-skillevaegge/maling-grunder',
    resultUnit: 'liter',
    modes: 'basic',
    safetyCritical: false,
    standards: [{ code: 'BR18', note: 'Dækningsevner er vejledende producent­værdier — aflæs altid produktdatabladet.' }],
    help: {
      purpose: 'Beregner nødvendig mængde maling og grundmaling (grunder) for en given flade med valgfrit antal lag.',
      variables: [
        { symbol: 'A', label: 'Areal', unit: 'm²', description: 'Det samlede areal der skal males inkl. eventuelle vægge og loft.' },
        { symbol: 'lm', label: 'Antal malingslag', unit: 'stk.', description: 'Typisk 2 lag maling for fuldt dækkende finish.' },
        { symbol: 'dm', label: 'Dækkeevne maling', unit: 'm²/L', description: 'Malingens teoretiske dækning pr. liter — typisk 8–12 m²/L.' },
        { symbol: 'lg', label: 'Antal grundlag', unit: 'stk.', description: 'Typisk 1 lag grunder på sugend overflad.' },
        { symbol: 'dg', label: 'Dækkeevne grunder', unit: 'm²/L', description: 'Grunderens teoretiske dækning — typisk 6–10 m²/L.' },
      ],
      formula: 'Maling (L) = A × lm / dm\nGrunder (L) = A × lg / dg',
      assumptions: [
        'Praktisk dækning er ca. 15% lavere end teoretisk grundet ujævnheder.',
        'Tillæg 10–15% for porøse overflader (gasbeton, kalk).',
      ],
      standardsExplained: 'Ingen lovpligtig standard regulerer malingsforbrugsmængder. Producenten opgiver dækningen i m²/L på databladet — brug altid det aktuelle blad frem for tommelfingerregler.',
    },
    inputs: [
      { id: 'area', label: 'Areal der skal males', unit: 'm²', defaultValue: '50' },
      { id: 'paintCoats', label: 'Antal lag maling', unit: 'stk.', defaultValue: '2' },
      { id: 'paintCoverage', label: 'Dækkeevne maling', unit: 'm²/L', defaultValue: '10' },
      { id: 'primerCoats', label: 'Antal lag grunder', unit: 'stk.', defaultValue: '1' },
      { id: 'primerCoverage', label: 'Dækkeevne grunder', unit: 'm²/L', defaultValue: '8' },
    ],
    compute: (inputs) => {
      const r = computePaintAmount({
        area: num(inputs, 'area'),
        primerCoats: num(inputs, 'primerCoats'),
        primerCoverage: num(inputs, 'primerCoverage'),
        paintCoats: num(inputs, 'paintCoats'),
        paintCoverage: num(inputs, 'paintCoverage'),
      });
      return {
        value: round(r.paintLiters, 1),
        unit: 'liter',
        summary: `${round(r.paintLiters, 1)} L maling · ${round(r.primerLiters, 1)} L grunder`,
        breakdown: [{ label: 'Grunder', value: round(r.primerLiters, 1), unit: 'liter' }],
      };
    },
  },
  {
    id: 'gipsplader',
    name: 'Gipsplader',
    category: 'Vægge & Skillevægge',
    route: '/tools/vaegge-skillevaegge/gipsplader',
    resultUnit: 'stk.',
    modes: 'basic',
    safetyCritical: false,
    standards: [{ code: 'BR18', note: 'Brandkrav kan kræve specifikke gipspladetyper (F30/F60).' }],
    help: {
      purpose: 'Beregner antal gipsplader til væg- eller loftbeklædning med valgfrit antal lag og spildfaktor.',
      variables: [
        { symbol: 'L', label: 'Væglængde', unit: 'm', description: 'Samlet længde af den flade der skal beklædes.' },
        { symbol: 'H', label: 'Væghøjde', unit: 'm', description: 'Rummets loftshøjde.' },
        { symbol: 'pl', label: 'Pladelængde', unit: 'm', description: 'Standard gipsplade: 2,4 m eller 2,6 m.' },
        { symbol: 'pb', label: 'Pladebredde', unit: 'm', description: 'Standard gipsplade: 1,2 m.' },
        { symbol: 'n', label: 'Antal lag', unit: 'stk.', description: 'Brand­adskillelse kræver typisk 2 lag á 12,5 mm.' },
        { symbol: 's', label: 'Spild', unit: '%', description: 'Typisk 7–10% ved gennemskæringer.' },
      ],
      formula: 'VægAreal = L × H × n\nPladAreal = pl × pb\nAntal = ⌈(VægAreal / PladAreal) × (1 + s/100)⌉',
      assumptions: [
        '7% standard spildfaktor for rette vægge og loft.',
        'Dørhuller og vindueshuller trækkes normalt ikke fra — giver buffer til ekstra skæring.',
      ],
      standardsExplained: 'BR18 stiller krav om brandmodstandsevne for skillevægge mod flugtveje. To lag 12,5 mm standardgips giver typisk EI30. Kontrollér altid med den godkendte systemdokumentation fra producenten.',
    },
    inputs: [
      { id: 'wallL', label: 'Væglængde', unit: 'm', defaultValue: '5' },
      { id: 'wallH', label: 'Væghøjde', unit: 'm', defaultValue: '2.5' },
      { id: 'boardL', label: 'Plade længde', unit: 'm', defaultValue: '2.4' },
      { id: 'boardW', label: 'Plade bredde', unit: 'm', defaultValue: '1.2' },
      { id: 'layers', label: 'Antal lag (1 side)', unit: 'stk.', defaultValue: '2' },
      { id: 'wastage', label: 'Spildfaktor', unit: '%', defaultValue: '7' },
    ],
    compute: (inputs) => {
      const r = computePlasterboard({
        wallL: num(inputs, 'wallL'),
        wallH: num(inputs, 'wallH'),
        boardL: num(inputs, 'boardL'),
        boardW: num(inputs, 'boardW'),
        layers: num(inputs, 'layers'),
        wastagePct: num(inputs, 'wastage'),
      });
      return {
        value: r.numBoards,
        unit: 'stk.',
        summary: `${r.numBoards} gipsplader (${str(inputs, 'layers', '2')} lag, inkl. spild)`,
      };
    },
  },
  {
    id: 'puds-spartel',
    name: 'Puds & Spartel',
    category: 'Vægge & Skillevægge',
    route: '/tools/vaegge-skillevaegge/puds-spartel',
    resultUnit: 'kg',
    modes: 'basic',
    safetyCritical: false,
    standards: [{ code: 'BR18', note: 'Vejledende lagtykkelser for indvendig puds: 2–5 mm finish, 10–15 mm bundpuds.' }],
    help: {
      purpose: 'Beregner kg puds eller spartelmasse for en given flade, lagtykkelse og produktets dækning (kg/m²/mm).',
      variables: [
        { symbol: 'A', label: 'Areal', unit: 'm²', description: 'Fladens samlede areal der skal pudses.' },
        { symbol: 't', label: 'Lagtykkelse', unit: 'mm', description: 'Ønsket tykkelse. Finish-puds: 2 mm. Grundpuds: 10–15 mm.' },
        { symbol: 'y', label: 'Forbrug', unit: 'kg/m²/mm', description: 'Produktspecifikt forbrug — typisk 1,0–1,7 kg/m²/mm. Aflæs databladet.' },
      ],
      formula: 'Total (kg) = A × t × y',
      assumptions: [
        'Forbrug er teoretisk — tillæg 10% til ujævne overflader.',
        'Énlags-puds: typisk 2 mm for glittet finish.',
      ],
      standardsExplained: 'Der er ingen specifik dansk norm for pudsmængdeberegning. Produktdatabladet fra producenten angiver nøjagtigt forbrug og blandingsforhold.',
    },
    inputs: [
      { id: 'area', label: 'Areal', unit: 'm²', defaultValue: '50' },
      { id: 'thickness', label: 'Lagtykkelse', unit: 'mm', defaultValue: '2' },
      { id: 'yield', label: 'Forbrug pr. m² pr. mm', unit: 'kg', defaultValue: '1' },
    ],
    compute: (inputs) => {
      const r = computePlasterAmount({
        area: num(inputs, 'area'),
        thicknessMm: num(inputs, 'thickness'),
        yieldKgPerM2PerMm: num(inputs, 'yield'),
      });
      return {
        value: round(r.totalKg, 1),
        unit: 'kg',
        summary: `${round(r.totalKg, 1)} kg puds/spartelmasse`,
      };
    },
  },
  {
    id: 'vaegisolering',
    name: 'Vægisolering',
    category: 'Vægge & Skillevægge',
    route: '/tools/vaegge-skillevaegge/vaegisolering',
    resultUnit: 'stk.',
    modes: 'basic',
    safetyCritical: false,
    standards: [
      { code: 'DS 418', note: 'Varmetabsberegning — isoleringskrav afhænger af konstruktionstype og BR18-energiramme.' },
      { code: 'BR18', clause: '§258', note: 'Mindste varmeisolering for ydervægge.' },
    ],
    help: {
      purpose: 'Beregner antal isolerings­batts (ruller/plader) til vægbeklædning baseret på fladens areal og battens dimensioner.',
      variables: [
        { symbol: 'L', label: 'Væglængde', unit: 'm', description: 'Samlet vandret udstrækning af den isolerede flade.' },
        { symbol: 'H', label: 'Væghøjde', unit: 'm', description: 'Rummets loftshøjde.' },
        { symbol: 'bl', label: 'Batt-længde', unit: 'm', description: 'Battens/rulleudskæringens længde — typisk 1,2 m.' },
        { symbol: 'bb', label: 'Batt-bredde', unit: 'm', description: 'Battens bredde — vælges til at passe c/c-afstand på stolper (typisk 600 mm).' },
      ],
      formula: 'Antal = ⌈(L × H) / (bl × bb)⌉',
      assumptions: [
        'Ekskl. spild — tillæg 5–10% for gennemskæringer og kanter.',
        'Batts lægges tæt uden sprækker; to-lags lægning kræver dobbelt antal.',
      ],
      standardsExplained: 'DS 418 og DS/EN ISO 6946 danner grundlag for U-værdiberegning. BR18 §258 angiver maksimale U-værdier for ydervægge (typisk ≤ 0,18 W/m²K for nybyggeri). Isoleringens tykkelse vælges ud fra U-værdikravet.',
    },
    inputs: [
      { id: 'areaL', label: 'Væg længde', unit: 'm', defaultValue: '8' },
      { id: 'areaW', label: 'Væg højde', unit: 'm', defaultValue: '2.5' },
      { id: 'battL', label: 'Batt længde', unit: 'm', defaultValue: '1.2' },
      { id: 'battW', label: 'Batt bredde', unit: 'm', defaultValue: '0.6' },
    ],
    compute: (inputs) => {
      const r = computeInsulationBatts({
        areaL: num(inputs, 'areaL'),
        areaW: num(inputs, 'areaW'),
        battL: num(inputs, 'battL'),
        battW: num(inputs, 'battW'),
      });
      return {
        value: r.numBatts,
        unit: 'stk.',
        summary: `${r.numBatts} isoleringsbatts (ekskl. spild — tilføj 5–10%)`,
      };
    },
  },
  {
    id: 'loftisolering',
    name: 'Loftisolering',
    category: 'Lofter & Tag',
    route: '/tools/lofter-tag/loftisolering',
    resultUnit: 'stk.',
    modes: 'basic',
    safetyCritical: false,
    standards: [
      { code: 'DS 418', note: 'Varmetabsberegning — loft/tag er det vigtigste isoleringsplan.' },
      { code: 'BR18', clause: '§258', note: 'Maks. U-værdi for tagkonstruktion: typisk ≤ 0,10 W/m²K (skrå tag) / ≤ 0,12 W/m²K (flade loft).' },
    ],
    help: {
      purpose: 'Beregner antal isolerings­batts til loftisolering (vandret loftsbjælkerum) baseret på loftarealens dimensioner.',
      variables: [
        { symbol: 'L', label: 'Loftlængde', unit: 'm', description: 'Rummets længde.' },
        { symbol: 'B', label: 'Loftbredde', unit: 'm', description: 'Rummets bredde.' },
        { symbol: 'bl', label: 'Batt-længde', unit: 'm', description: 'Typisk 1,2 m — passer til standard spærafstand.' },
        { symbol: 'bb', label: 'Batt-bredde', unit: 'm', description: 'Typisk 0,6 m (600 mm c/c spær).' },
      ],
      formula: 'Antal = ⌈(L × B) / (bl × bb)⌉',
      assumptions: [
        'Ekskl. spild — tillæg 5–10%.',
        'Tolagsisolering (kryds-lægning) kræver dobbelt antal.',
        'Ventileret luftlag kræves over isolering ved tagrum (min. 50 mm iht. BR18).',
      ],
      standardsExplained: 'DS 418 fastlægger beregningsmetoden for varmetab gennem loftplanet. BR18 kræver typisk 300–400 mm mineraluld for at opfylde energirammen i nybyggeri.',
    },
    inputs: [
      { id: 'areaL', label: 'Loft længde', unit: 'm', defaultValue: '6' },
      { id: 'areaW', label: 'Loft bredde', unit: 'm', defaultValue: '5' },
      { id: 'battL', label: 'Batt længde', unit: 'm', defaultValue: '1.2' },
      { id: 'battW', label: 'Batt bredde', unit: 'm', defaultValue: '0.6' },
    ],
    compute: (inputs) => {
      const r = computeInsulationBatts({
        areaL: num(inputs, 'areaL'),
        areaW: num(inputs, 'areaW'),
        battL: num(inputs, 'battL'),
        battW: num(inputs, 'battW'),
      });
      return {
        value: r.numBatts,
        unit: 'stk.',
        summary: `${r.numBatts} isoleringsbatts (ekskl. spild — tilføj 5–10%)`,
      };
    },
  },
  {
    id: 'gulvisolering',
    name: 'Gulvisolering',
    category: 'Gulve & Overflader',
    route: '/tools/gulve-overflader/gulvisolering',
    resultUnit: 'stk.',
    modes: 'basic',
    safetyCritical: false,
    standards: [
      { code: 'DS 418', note: 'Varmetab gennem gulvplanet.' },
      { code: 'BR18', clause: '§258', note: 'Maks. U-værdi for gulv mod jord: typisk ≤ 0,10 W/m²K.' },
    ],
    help: {
      purpose: 'Beregner antal isolerings­plader (f.eks. EPS/XPS/PIR) til gulvisolering i støbt gulv eller træbjælkelag.',
      variables: [
        { symbol: 'L', label: 'Gulvlængde', unit: 'm', description: 'Rummets længde.' },
        { symbol: 'B', label: 'Gulvbredde', unit: 'm', description: 'Rummets bredde.' },
        { symbol: 'pl', label: 'Pladelængde', unit: 'm', description: 'Typisk 1,2 m.' },
        { symbol: 'pb', label: 'Pladebredde', unit: 'm', description: 'Typisk 0,6 m.' },
      ],
      formula: 'PladAreal = pl × pb\nAntal = ⌈(L × B) / PladAreal⌉\nSamletAreal = Antal × PladAreal',
      assumptions: [
        'Uden spildfaktor — plader skæres og restbidder genbruges.',
        'Tilføj 5–10% ved mange gennemskæringer (søjler, kanaler).',
      ],
      standardsExplained: 'DS 418 beregner gulvets varmetab, som bestemmer den nødvendige isoleringstykkelse. For gulv mod uopvarmet kælder eller terræn skal der typisk bruges EPS 200 eller XPS for at undgå fugt­problemer.',
    },
    inputs: [
      { id: 'areaL', label: 'Gulv længde', unit: 'm', defaultValue: '6' },
      { id: 'areaW', label: 'Gulv bredde', unit: 'm', defaultValue: '5' },
      { id: 'boardL', label: 'Plade længde', unit: 'm', defaultValue: '1.2' },
      { id: 'boardW', label: 'Plade bredde', unit: 'm', defaultValue: '0.6' },
    ],
    compute: (inputs) => {
      const r = computeFloorInsulation({
        areaL: num(inputs, 'areaL'),
        areaW: num(inputs, 'areaW'),
        boardL: num(inputs, 'boardL'),
        boardW: num(inputs, 'boardW'),
      });
      return {
        value: r.numBoards,
        unit: 'stk.',
        summary: `${r.numBoards} isoleringsplader · ${round(r.totalArea, 2)} m²`,
        breakdown: [{ label: 'Samlet areal', value: round(r.totalArea, 2), unit: 'm²' }],
      };
    },
  },
  {
    id: 'traegulv-maengde',
    name: 'Trægulv mængde',
    category: 'Gulve & Overflader',
    route: '/tools/gulve-overflader/traegulv-maengde',
    resultUnit: 'm²',
    modes: 'basic',
    safetyCritical: false,
    standards: [{ code: 'BR18', note: 'Vejledende spildfaktorer fra gulvproducenter. Min. 10 mm ekspansionsfuge mod vægge.' }],
    help: {
      purpose: 'Beregner m² trægulv der skal bestilles inkl. spild, samt en læggeplan med første/sidste rækkebredde.',
      variables: [
        { symbol: 'L', label: 'Rumlængde', unit: 'm', description: 'Rummets længde (læggeretning).' },
        { symbol: 'B', label: 'Rumbredde', unit: 'm', description: 'Rummets bredde (på tværs af planker).' },
        { symbol: 'pw', label: 'Plankebredde', unit: 'mm', description: 'Typisk 130–200 mm for massive trægulve.' },
        { symbol: 'pl', label: 'Plankelængde', unit: 'mm', description: 'Typisk 400–2400 mm.' },
        { symbol: 's', label: 'Spild', unit: '%', description: 'Typisk 7% for retlinjet lægning; 15% for diagonal.' },
      ],
      formula: 'Areal = L × B × (1 + s/100)\nAntalRækker = ⌈B×1000 / pw⌉\nPlankerPrRække = ⌈L×1000 / pl⌉\nFørsteRækkebredde beregnes for symmetrisk lægning (min. 50 mm).',
      assumptions: [
        '7% spildfaktor for retlinjet lægning.',
        'Min. første-/sidsterækkebredde = 50 mm for æstetisk resultat.',
        'Ekspansionsfuge mod vægge og faste genstande: min. 10 mm.',
      ],
      standardsExplained: 'Ingen specifik dansk norm. Producenten angiver klima­klasse og fugtindhold krav (typisk 8–12% EMC ved montering). Overhold ekspansionsfuge-krav for at undgå bukning.',
    },
    inputs: [
      { id: 'length', label: 'Rum længde', unit: 'm', defaultValue: '5' },
      { id: 'width', label: 'Rum bredde', unit: 'm', defaultValue: '2' },
      { id: 'plankWidth', label: 'Plankebredde', unit: 'mm', defaultValue: '130' },
      { id: 'plankLength', label: 'Plankelængde', unit: 'mm', defaultValue: '500' },
      { id: 'wastage', label: 'Spildfaktor', unit: '%', defaultValue: '7' },
    ],
    compute: (inputs) => {
      const r = computeWoodFloor({
        length: num(inputs, 'length'),
        width: num(inputs, 'width'),
        wastagePct: num(inputs, 'wastage'),
        plankWidthMm: num(inputs, 'plankWidth'),
        plankLengthMm: num(inputs, 'plankLength'),
      });
      return {
        value: round(r.area, 2),
        unit: 'm²',
        summary: `${round(r.area, 2)} m² trægulv (inkl. spild) · ${r.plan.totalRows} rækker`,
        breakdown: [
          { label: 'Antal rækker', value: r.plan.totalRows, unit: 'stk.' },
          { label: 'Planker pr. række', value: r.plan.planksPerRow, unit: 'stk.' },
        ],
      };
    },
  },
  {
    id: 'taeppe-laminat',
    name: 'Tæppe/Laminat',
    category: 'Gulve & Overflader',
    route: '/tools/gulve-overflader/taeppe-laminat',
    resultUnit: 'm²',
    modes: 'basic',
    safetyCritical: false,
    standards: [{ code: 'BR18', note: 'Vejledende spildfaktorer. Laminat kræver ekspansionsfuge mod vægge (min. 8 mm).' }],
    help: {
      purpose: 'Beregner m² tæppe eller laminat inkl. spildfaktor for en given rektangulær flade.',
      variables: [
        { symbol: 'L', label: 'Rumlængde', unit: 'm', description: 'Rummets længde.' },
        { symbol: 'B', label: 'Rumbredde', unit: 'm', description: 'Rummets bredde.' },
        { symbol: 's', label: 'Spild', unit: '%', description: 'Typisk 10% for tæppe (rulle-skæring); 5–8% for laminat.' },
      ],
      formula: 'Areal = L × B × (1 + s/100)',
      assumptions: [
        '10% standardspild for tæpperuller ved rektangulære rum.',
        '5–8% for laminatbrædder i retlinjet lægning.',
      ],
      standardsExplained: 'Ingen lovpligtig standard. Producenten angiver akustik­klasse (Lw) og fuge­krav. For laminat: overholdes ekspansionsfuger undgås bukling.',
    },
    inputs: [
      { id: 'length', label: 'Rum længde', unit: 'm', defaultValue: '5' },
      { id: 'width', label: 'Rum bredde', unit: 'm', defaultValue: '4' },
      { id: 'wastage', label: 'Spildfaktor', unit: '%', defaultValue: '10' },
    ],
    compute: (inputs) => {
      const r = computeCarpetLaminate({
        length: num(inputs, 'length'),
        width: num(inputs, 'width'),
        wastagePct: num(inputs, 'wastage'),
      });
      return {
        value: round(r.area, 2),
        unit: 'm²',
        summary: `${round(r.area, 2)} m² gulvbelægning (inkl. spild)`,
      };
    },
  },
  {
    id: 'gulvafretning',
    name: 'Gulvafretning',
    category: 'Gulve & Overflader',
    route: '/tools/gulve-overflader/gulvafretning',
    resultUnit: 'm³',
    modes: 'basic',
    safetyCritical: false,
    standards: [{ code: 'BR18', note: 'Min. gulvafretningstykkelse: 30–50 mm for varmekabler, 40 mm for standard afretningsmasse.' }],
    help: {
      purpose: 'Beregner volumen og antal poser (25 kg) afretningsmasse for et givent gulv.',
      variables: [
        { symbol: 'L', label: 'Rumlængde', unit: 'm', description: 'Gulvfladens længde.' },
        { symbol: 'B', label: 'Rumbredde', unit: 'm', description: 'Gulvfladens bredde.' },
        { symbol: 't', label: 'Lagtykkelse', unit: 'mm', description: 'Standard: 30–50 mm. Minimum 25 mm for selvudjævnende masse.' },
        { symbol: 's', label: 'Spild', unit: '%', description: 'Typisk 10%.' },
      ],
      formula: 'Volumen (m³) = L × B × (t/1000) × (1 + s/100)\nPoser = ⌈Volumen × 80⌉  (80 poser á 25 kg per m³)',
      assumptions: [
        '~2000 kg/m³ tørvægt ↔ 80 poser (25 kg) per m³ færdig masse.',
        'Selvudjævnende masse: min. 25 mm lag for god strømning.',
        'Cementbaseret masse: typisk 40 mm over varmekabler.',
      ],
      standardsExplained: 'Der er ingen specifik dansk norm for afretningsmasse. Producenten angiver tørheds­tid og trykstyrke (typisk C20 klasse).',
    },
    inputs: [
      { id: 'length', label: 'Rum længde', unit: 'm', defaultValue: '5' },
      { id: 'width', label: 'Rum bredde', unit: 'm', defaultValue: '4' },
      { id: 'thickness', label: 'Lagtykkelse', unit: 'mm', defaultValue: '40' },
      { id: 'wastage', label: 'Spildfaktor', unit: '%', defaultValue: '10' },
    ],
    compute: (inputs) => {
      const r = computeScreed({
        length: num(inputs, 'length'),
        width: num(inputs, 'width'),
        thicknessMm: num(inputs, 'thickness'),
        wastagePct: num(inputs, 'wastage'),
      });
      return {
        value: round(r.volumeM3, 3),
        unit: 'm³',
        summary: `${round(r.volumeM3, 3)} m³ afretningsmasse · ${r.bags} poser (25 kg)`,
        breakdown: [{ label: 'Poser (25 kg)', value: r.bags, unit: 'stk.' }],
      };
    },
  },
  {
    id: 'mursten-blokke',
    name: 'Mursten/Blokke',
    category: 'Vægge & Skillevægge',
    route: '/tools/vaegge-skillevaegge/mursten-blokke',
    resultUnit: 'stk.',
    modes: 'basic',
    safetyCritical: false,
    standards: [
      { code: 'DS/EN 1996-1-1', clause: 'EC6', note: 'Murværkskonstruktioner — dimensionering.' },
      { code: 'BR18', note: 'Mursten­modul: 228×108×54 mm med 12 mm fuge = 240×120×66 mm modul.' },
    ],
    help: {
      purpose: 'Beregner antal mursten/betonblokke og vejledende mørtelmængde for en given murhøjde og -længde.',
      variables: [
        { symbol: 'L', label: 'Murlængde', unit: 'm', description: 'Murens samlede vandrette udstrækning.' },
        { symbol: 'H', label: 'Murhøjde', unit: 'm', description: 'Murens højde fra fundament til overkant.' },
        { symbol: 'sl', label: 'Stenlængde', unit: 'mm', description: 'Standard dansk mursten: 228 mm.' },
        { symbol: 'sh', label: 'Stenhøjde', unit: 'mm', description: 'Standard dansk mursten: 54 mm.' },
        { symbol: 'j', label: 'Fugetykkelse', unit: 'mm', description: 'Standard: 12 mm.' },
        { symbol: 's', label: 'Spild', unit: '%', description: 'Typisk 5% for lige murer; 10% for mange hjørner.' },
      ],
      formula: 'StenAreal = ((sl+j)/1000) × ((sh+j)/1000)\nMurareal = L × H\nAntal = ⌈(Murareal / StenAreal) × (1 + s/100)⌉\nMørtel ≈ Murareal × 0,0175 m³',
      assumptions: [
        'Standard dansk mursten: 228×108×54 mm med 12 mm fuge.',
        'Mørtelvolumen: tommelfingerregel 17,5 L/m² for enkeltskift.',
        'Tager ikke højde for dørhuller/vindueshuller — fratrækkes manuelt.',
      ],
      workedExample: 'Mur 5m × 2,5m med standard mursten, 5% spild:\nStenAreal = (240/1000) × (66/1000) = 0,01584 m²\nRåAntal = 12,5 / 0,01584 = 789\nAntal = ⌈789 × 1,05⌉ = 829\nMørtel = 12,5 × 0,0175 = 0,219 m³',
      standardsExplained: 'DS/EN 1996-1-1 (EC6) gælder for murværks­konstruktioner under last. Til ikke-bærende skillevægge er denne mængdeberegning tilstrækkelig. For bærende mure kræves ingeniørberegning.',
    },
    inputs: [
      { id: 'wallL', label: 'Mur længde', unit: 'm', defaultValue: '5' },
      { id: 'wallH', label: 'Mur højde', unit: 'm', defaultValue: '2.5' },
      { id: 'brickL', label: 'Sten længde', unit: 'mm', defaultValue: '228' },
      { id: 'brickH', label: 'Sten højde', unit: 'mm', defaultValue: '54' },
      { id: 'joint', label: 'Fugetykkelse', unit: 'mm', defaultValue: '12' },
      { id: 'wastage', label: 'Spildfaktor', unit: '%', defaultValue: '5' },
    ],
    compute: (inputs) => {
      const r = computeBrickBlock({
        wallL: num(inputs, 'wallL'),
        wallH: num(inputs, 'wallH'),
        brickLmm: num(inputs, 'brickL'),
        brickHmm: num(inputs, 'brickH'),
        jointMm: num(inputs, 'joint'),
        wastagePct: num(inputs, 'wastage'),
      });
      return {
        value: r.numBricks,
        unit: 'stk.',
        summary: `${r.numBricks} sten/blokke · ca. ${round(r.mortarVolume, 3)} m³ mørtel`,
        breakdown: [{ label: 'Mørtel (ca.)', value: round(r.mortarVolume, 3), unit: 'm³' }],
      };
    },
  },
  // ── Areal & Rumfang ───────────────────────────────────────────────────────
  {
    id: 'rumareal',
    name: 'Rumareal',
    category: 'Areal & Rumfang',
    route: '/tools/areal-rumfang/rumareal',
    resultUnit: 'm²',
    modes: 'both',
    safetyCritical: false,
    standards: [{ code: 'BR18', clause: 'Bilag A', note: 'BBR-areal: nettoareal målt indvendigt, gulvareal ≥ 1,5 m rumhøjde.' }],
    help: {
      purpose: 'Beregner rummets nettoareal for rektangulære rum og L-formede rum med fradrag for åbninger.',
      variables: [
        { symbol: 'L', label: 'Længde', unit: 'm', description: 'Rummets indvendige længde.' },
        { symbol: 'B', label: 'Bredde', unit: 'm', description: 'Rummets indvendige bredde.' },
      ],
      formula: 'Areal = L × B\nL-form: Areal = (A × B) + (C × D)',
      assumptions: ['Mål optages indvendigt fra væg til væg.', 'BBR-areal medregner kun gulvareal med rumhøjde ≥ 1,5 m.'],
      standardsExplained: 'BR18 Bilag A definerer BBR-areal som nettoareal målt indvendigt. Skunkrum og lavloftede partier (< 1,5 m) tæller ikke med i boligarealet.',
    },
    inputs: [
      { id: 'shape', label: 'Form', type: 'select', options: [{ label: 'Rektangel', value: 'rectangle' }, { label: 'L-form', value: 'l-shape' }], defaultValue: 'rectangle' },
      { id: 'rectL', label: 'Længde', unit: 'm', defaultValue: '5', visibleWhen: { shape: 'rectangle' } },
      { id: 'rectW', label: 'Bredde', unit: 'm', defaultValue: '4', visibleWhen: { shape: 'rectangle' } },
      { id: 'lA', label: 'Segment A (længde)', unit: 'm', defaultValue: '4', visibleWhen: { shape: 'l-shape' } },
      { id: 'lB', label: 'Segment B (bredde)', unit: 'm', defaultValue: '3', visibleWhen: { shape: 'l-shape' } },
      { id: 'lC', label: 'Segment C (længde)', unit: 'm', defaultValue: '2', visibleWhen: { shape: 'l-shape' } },
      { id: 'lD', label: 'Segment D (bredde)', unit: 'm', defaultValue: '2', visibleWhen: { shape: 'l-shape' } },
    ],
    compute: (inputs) => {
      const shape = str(inputs, 'shape', 'rectangle') as 'rectangle' | 'l-shape';
      const r = computeRoomArea({
        shape,
        rectL: num(inputs, 'rectL'), rectW: num(inputs, 'rectW'),
        lA: num(inputs, 'lA'), lB: num(inputs, 'lB'), lC: num(inputs, 'lC'), lD: num(inputs, 'lD'),
      });
      return { value: round(r.area, 2), unit: 'm²', summary: `${round(r.area, 2)} m² nettoareal` };
    },
  },
  {
    id: 'vaegareal',
    name: 'Vægareal',
    category: 'Areal & Rumfang',
    route: '/tools/areal-rumfang/vaegareal',
    resultUnit: 'm²',
    modes: 'both',
    safetyCritical: false,
    standards: [{ code: 'BR18', clause: 'Bilag A', note: 'Bruttovægareal inkl. åbninger; nettoareal fratrækkes åbninger.' }],
    help: {
      purpose: 'Beregner vægareal (brutto og netto) med fradrag for døre og vinduer.',
      variables: [
        { symbol: 'L', label: 'Rumlængde', unit: 'm', description: 'Samlet indre rumlængde.' },
        { symbol: 'B', label: 'Rumbredde', unit: 'm', description: 'Samlet indre rumbredde.' },
        { symbol: 'H', label: 'Loftshøjde', unit: 'm', description: 'Rumhøjde fra gulv til loft.' },
      ],
      formula: 'Omkreds = 2 × (L + B)\nBruttoAreal = Omkreds × H\nNettoAreal = BruttoAreal − (n_d × w_d × h_d) − (n_v × w_v × h_v)',
      assumptions: ['Alle fire vægge medtages.', 'Fradrages kun fri åbning — ikke karmareal.'],
      standardsExplained: 'Intet lovkrav for vægarealsberegning. Bruges til estimering af maling, puds og tapet.',
    },
    inputs: [
      { id: 'length', label: 'Rumlængde', unit: 'm', defaultValue: '5' },
      { id: 'width', label: 'Rumbredde', unit: 'm', defaultValue: '4' },
      { id: 'height', label: 'Loftshøjde', unit: 'm', defaultValue: '2.5' },
      { id: 'doors', label: 'Antal døre', unit: 'stk.', defaultValue: '1', mode: 'advanced' },
      { id: 'doorW', label: 'Dørbredde', unit: 'm', defaultValue: '0.9', mode: 'advanced' },
      { id: 'doorH', label: 'Dørhøjde', unit: 'm', defaultValue: '2.1', mode: 'advanced' },
      { id: 'windows', label: 'Antal vinduer', unit: 'stk.', defaultValue: '2', mode: 'advanced' },
      { id: 'windowW', label: 'Vinduesbredde', unit: 'm', defaultValue: '1.2', mode: 'advanced' },
      { id: 'windowH', label: 'Vindsueshøjde', unit: 'm', defaultValue: '1.2', mode: 'advanced' },
    ],
    compute: (inputs) => {
      const r = computeWallAreaWithDeductions({
        length: num(inputs, 'length'), width: num(inputs, 'width'), height: num(inputs, 'height'),
        doors: num(inputs, 'doors'), doorW: num(inputs, 'doorW'), doorH: num(inputs, 'doorH'),
        windows: num(inputs, 'windows'), windowW: num(inputs, 'windowW'), windowH: num(inputs, 'windowH'),
      });
      return {
        value: round(r.netArea, 2), unit: 'm²',
        summary: `${round(r.netArea, 2)} m² netto · ${round(r.grossArea, 2)} m² brutto`,
        breakdown: [{ label: 'Fradrag (åbninger)', value: round(r.deductions, 2), unit: 'm²' }],
      };
    },
  },
  {
    id: 'rumfangsberegner',
    name: 'Rumfangsberegner',
    category: 'Areal & Rumfang',
    route: '/tools/areal-rumfang/rumfangsberegner',
    resultUnit: 'm³',
    modes: 'basic',
    safetyCritical: false,
    standards: [{ code: 'BR18', clause: '§431', note: 'Min. loftshøjde 2,3 m i opholdsrum.' }],
    help: {
      purpose: 'Beregner rummets luftvolumen og kontrollerer om loftshøjden opfylder BR18-krav.',
      variables: [
        { symbol: 'L', label: 'Længde', unit: 'm', description: 'Rummets indvendige længde.' },
        { symbol: 'B', label: 'Bredde', unit: 'm', description: 'Rummets indvendige bredde.' },
        { symbol: 'H', label: 'Loftshøjde', unit: 'm', description: 'Klar indvendig loftshøjde.' },
      ],
      formula: 'Rumfang = L × B × H',
      assumptions: ['Regulær rektangulær geometri.', 'BR18 §431: opholdsrum skal have min. 2,3 m fri loftshøjde.'],
      standardsExplained: 'BR18 §431 kræver minimum 2,3 m klar loftshøjde i opholdsrum. Køkken, bad og gange er undtaget.',
    },
    inputs: [
      { id: 'length', label: 'Længde', unit: 'm', defaultValue: '5' },
      { id: 'width', label: 'Bredde', unit: 'm', defaultValue: '4' },
      { id: 'height', label: 'Loftshøjde', unit: 'm', defaultValue: '2.5' },
    ],
    compute: (inputs) => {
      const r = computeVolume({ length: num(inputs, 'length'), width: num(inputs, 'width'), height: num(inputs, 'height') });
      return {
        value: round(r.volume, 2), unit: 'm³',
        summary: `${round(r.volume, 2)} m³ · loftshøjde ${r.ceilingHeightOk ? 'OK' : 'UNDER 2,3 m (BR18)'}`,
      };
    },
  },

  // ── Udgravning & Jord ─────────────────────────────────────────────────────
  {
    id: 'udgravning-jord-jordvolumen',
    name: 'Jordvolumen (Udgravning)',
    category: 'Udgravning & Jord',
    route: '/tools/udgravning-jord/jordvolumen',
    resultUnit: 'm³',
    modes: 'both',
    safetyCritical: false,
    standards: STANDARDS_CATALOG.excavation,
    help: {
      purpose: 'Beregner jordvolumen in-situ og i løs tilstand (for containertransport) for en rektangulær udgravning.',
      variables: [
        { symbol: 'L', label: 'Længde', unit: 'm', description: 'Udgravningens længde.' },
        { symbol: 'B', label: 'Bredde', unit: 'm', description: 'Udgravningens bredde.' },
        { symbol: 'D', label: 'Dybde', unit: 'm', description: 'Udgravningsdybden.' },
        { symbol: 'f', label: 'Løsningsfaktor', unit: '%', description: 'Sand/grus: ~10–15%; Muld/ler: ~20–30%.' },
      ],
      formula: 'Fast volumen = L × B × D\nLøst volumen = Fast volumen × (1 + f/100)',
      assumptions: ['Rektangulær geometri uden skrå sider.', 'Avanceret: trapezprofil med skråningsanlæg.'],
      standardsExplained: 'AT-vejledning D.2.17 kræver skråningsanlæg (hældning 1:1 til 1:0,18 afhængig af jordtype) ved udgravninger dybere end 1,7 m. Kontrollér altid med geoteknisk rapport.',
    },
    inputs: [
      { id: 'length', label: 'Længde', unit: 'm', defaultValue: '10' },
      { id: 'width', label: 'Bredde', unit: 'm', defaultValue: '5' },
      { id: 'depth', label: 'Dybde', unit: 'm', defaultValue: '0.5' },
      { id: 'soilType', label: 'Jordtype', type: 'select', options: [
        { label: 'Ler', value: 'clay' }, { label: 'Sand', value: 'sand' },
        { label: 'Grus', value: 'gravel' }, { label: 'Klippe', value: 'rock' },
      ], defaultValue: 'clay', mode: 'advanced' },
    ],
    compute: (inputs) => {
      const soilType = (str(inputs, 'soilType', 'clay') as SoilType);
      const r = computeExcavation({ length: num(inputs, 'length'), width: num(inputs, 'width'), depth: num(inputs, 'depth'), soilType });
      const trucks = Math.ceil(r.loose / 11);
      return {
        value: round(r.inSitu, 2), unit: 'm³',
        summary: `${round(r.inSitu, 2)} m³ fast · ${round(r.loose, 2)} m³ løst · ca. ${trucks} lastbiler`,
        breakdown: [
          { label: 'Løst volumen', value: round(r.loose, 2), unit: 'm³' },
          { label: 'Ca. lastbiler (11 m³)', value: trucks, unit: 'stk.' },
        ],
      };
    },
  },
  {
    id: 'udgravning-jord-skraaning',
    name: 'Udgravningsskråning',
    category: 'Udgravning & Jord',
    route: '/tools/udgravning-jord/skraaning',
    resultUnit: 'm³',
    modes: 'both',
    safetyCritical: true,
    standards: STANDARDS_CATALOG.excavation,
    help: {
      purpose: 'Beregner trapezprofil for en afskåret udgravning med skråningsanlæg — topbredde, volumen og sikkerhedsafstand.',
      variables: [
        { symbol: 'B_b', label: 'Bundbredde', unit: 'm', description: 'Udgravningens friholdte bredde i bunden.' },
        { symbol: 'D', label: 'Dybde', unit: 'm', description: 'Udgravningens dybde.' },
        { symbol: 'n', label: 'Anlægsforhold', unit: 'm/m', description: 'Vandret setback per meter dybde: sand 1:1, ler 1:0,5, klippe 1:0,18.' },
      ],
      formula: 'Setback = D × n\nTopbredde = Bundbredde + 2 × Setback\nVolumen = ((Bundbredde + Topbredde) / 2) × D × Længde',
      assumptions: ['Homogen jord uden vandtryk.', 'Kræv geoteknisk rapport ved blandede jordlag.'],
      standardsExplained: 'Arbejdstilsynets vejledning D.2.17 angiver minimumsanlæg: Sand/grus 1:1, Ler 1:0,5, Fast klippeklippe 1:0,18. Ved tvivl: anlæg 1:1 som default.',
    },
    inputs: [
      { id: 'bottomWidth', label: 'Bundbredde', unit: 'm', defaultValue: '3' },
      { id: 'depth', label: 'Dybde', unit: 'm', defaultValue: '2' },
      { id: 'length', label: 'Udgravningslængde', unit: 'm', defaultValue: '10' },
      { id: 'soilType', label: 'Jordtype', type: 'select', options: [
        { label: 'Ler (anlæg 1:0,5)', value: 'clay' }, { label: 'Sand/Grus (anlæg 1:1)', value: 'sand' },
        { label: 'Klippe (anlæg 1:0,18)', value: 'rock' },
      ], defaultValue: 'clay' },
    ],
    compute: (inputs) => {
      const soilType = (str(inputs, 'soilType', 'clay') as SoilType);
      const r = computeExcavationSlope({ bottomWidth: num(inputs, 'bottomWidth'), depth: num(inputs, 'depth'), length: num(inputs, 'length'), soilType });
      return {
        value: round(r.volume, 2), unit: 'm³',
        summary: `Topbredde: ${round(r.topWidth, 2)} m · Setback: ${round(r.setback, 2)} m pr. side · ${round(r.volume, 2)} m³`,
        breakdown: [
          { label: 'Topbredde', value: round(r.topWidth, 2), unit: 'm' },
          { label: 'Setback pr. side', value: round(r.setback, 2), unit: 'm' },
        ],
      };
    },
  },
  {
    id: 'udgravning-jord-tilbagefyldning',
    name: 'Tilbagefyldning',
    category: 'Udgravning & Jord',
    route: '/tools/udgravning-jord/tilbagefyldning',
    resultUnit: 'm³',
    modes: 'basic',
    safetyCritical: false,
    standards: STANDARDS_CATALOG.excavation,
    help: {
      purpose: 'Beregner nødvendigt volumen løst fyldmateriale til tilbagefyldning efter udgravning, idet der tages højde for komprimering.',
      variables: [
        { symbol: 'V_e', label: 'Udgravningsvolumen', unit: 'm³', description: 'Det samlede opgravede volumen (fast mål).' },
        { symbol: 'V_s', label: 'Konstruktionsvolumen', unit: 'm³', description: 'Det volumen bygningsdelen optager i hullet.' },
        { symbol: 'k', label: 'Komprimeringstillæg', unit: '%', description: 'Sand/grus: ~10%, ler: ~20%.' },
      ],
      formula: 'Nettofyld = V_e − V_s\nLøs mængde = Nettofyld × (1 + k/100)',
      assumptions: ['Overskudsjord bortskaffes separat.', 'Komprimeringstillæg varierer med jordtype og komprimeringskrav.'],
      standardsExplained: 'Ingen specifik standard for tilbagefyldningsmængder. Komprimering verificeres typisk med Proctor-test per geotek-rapport.',
    },
    inputs: [
      { id: 'excavatedVol', label: 'Udgravningsvolumen', unit: 'm³', defaultValue: '50' },
      { id: 'structureVol', label: 'Konstruktionsvolumen', unit: 'm³', defaultValue: '10' },
      { id: 'compactionPct', label: 'Komprimeringstillæg', unit: '%', defaultValue: '15' },
    ],
    compute: (inputs) => {
      const r = computeBackfill({ excavatedVol: num(inputs, 'excavatedVol'), structureVol: num(inputs, 'structureVol'), compactionPct: num(inputs, 'compactionPct') });
      return {
        value: round(r.looseNeeded, 2), unit: 'm³',
        summary: `${round(r.looseNeeded, 2)} m³ løst fyldmateriale · ${round(r.netFill, 2)} m³ netto`,
        breakdown: [{ label: 'Overskudsjord', value: round(r.excess, 2), unit: 'm³' }],
      };
    },
  },

  // ── Geometri & Opmåling ────────────────────────────────────────────────────
  {
    id: 'geometri-pythagoras',
    name: '3-4-5 Vinkelkontrol (Pythagoras)',
    category: 'Geometri & Opmåling',
    route: '/tools/geometri/pythagoras',
    resultUnit: 'm',
    modes: 'basic',
    safetyCritical: false,
    standards: [{ code: 'Geometri', note: 'Pythagoras: c² = a² + b². 3-4-5 metoden giver nøjagtig 90° hjørne.' }],
    help: {
      purpose: 'Beregner hypotenusen (diagonalen) i en retvinklet trekant — bruges til at kontrollere om et hjørne er vinkelret (90°) ved hjælp af 3-4-5-metoden.',
      variables: [
        { symbol: 'a', label: 'Katete A', unit: 'm', description: 'Den ene kortside.' },
        { symbol: 'b', label: 'Katete B', unit: 'm', description: 'Den anden kortside.' },
        { symbol: 'c', label: 'Hypotenusen', unit: 'm', description: 'Den beregnede diagonale side.' },
      ],
      formula: 'c = √(a² + b²)',
      assumptions: ['For 3-4-5: a=3, b=4 → c=5 giver eksakt 90°.', 'Mål altid fra det samme referencepunkt.'],
      workedExample: 'Murhjørne: a=3 m, b=4 m → c=5,000 m. Mål diagonalen — er den 5,000 m er hjørnet 90°.',
      standardsExplained: 'Ingen lovstandard. Pythagorisk kontrol er standard praksis i byggeriet for at sikre retvinklede hjørner inden støbning og murning.',
    },
    inputs: [
      { id: 'a', label: 'Side A', unit: 'm', defaultValue: '3' },
      { id: 'b', label: 'Side B', unit: 'm', defaultValue: '4' },
    ],
    compute: (inputs) => {
      const r = computePythagoras({ a: num(inputs, 'a'), b: num(inputs, 'b') });
      return { value: round(r.c, 4), unit: 'm', summary: `Diagonal c = ${round(r.c, 4)} m` };
    },
  },
  {
    id: 'geometri-cirkel',
    name: 'Cirkel & Bue',
    category: 'Geometri & Opmåling',
    route: '/tools/geometri/cirkel',
    resultUnit: 'm²',
    modes: 'basic',
    safetyCritical: false,
    standards: [{ code: 'Geometri', note: 'Areal = π × r², Omkreds = 2 × π × r.' }],
    help: {
      purpose: 'Beregner areal, omkreds og diameter for en cirkel — bruges til runde søjler, fundament­huller, rundbuer og cirkulære overflader.',
      variables: [
        { symbol: 'r', label: 'Radius', unit: 'm', description: 'Halvdiameter — afstanden fra centrum til kanten.' },
        { symbol: 'A', label: 'Areal', unit: 'm²', description: 'Det indesluttede areal.' },
        { symbol: 'O', label: 'Omkreds', unit: 'm', description: 'Den ydre cirkelomkreds.' },
      ],
      formula: 'Areal = π × r²\nOmkreds = 2 × π × r\nDiameter = 2 × r',
      assumptions: ['Perfekt cirkelform.'],
      standardsExplained: 'Ingen lovstandard. Bruges ved dimensionering af runde fundamentshuller, søjler og cirkulære fliser.',
    },
    inputs: [{ id: 'radius', label: 'Radius', unit: 'm', defaultValue: '1' }],
    compute: (inputs) => {
      const r = computeCircle({ radius: num(inputs, 'radius') });
      return {
        value: round(r.area, 4), unit: 'm²',
        summary: `Areal: ${round(r.area, 4)} m² · Omkreds: ${round(r.circumference, 3)} m · Diameter: ${round(r.diameter, 3)} m`,
        breakdown: [
          { label: 'Omkreds', value: round(r.circumference, 3), unit: 'm' },
          { label: 'Diameter', value: round(r.diameter, 3), unit: 'm' },
        ],
      };
    },
  },

  // ── Lofter & Tag ──────────────────────────────────────────────────────────
  {
    id: 'lofter-tag-laegter',
    name: 'Lægteberegner',
    category: 'Lofter & Tag',
    route: '/tools/lofter-tag/laegter',
    resultUnit: 'stk.',
    modes: 'both',
    safetyCritical: false,
    standards: [
      { code: 'DS/EN 1995-1-1', clause: 'EC5', note: 'Trækonstruktioner — dimensionering af lægter.' },
      { code: 'BR18', note: 'Lægteafstand afhænger af tagbelægningstype og snelastzone.' },
    ],
    help: {
      purpose: 'Beregner antal lægter (vandrette bærere til tagbelægning) ud fra spærlængde og c/c-afstand.',
      variables: [
        { symbol: 'L', label: 'Spærlængde', unit: 'm', description: 'Længde langs skråtaget fra tagfod til rygning.' },
        { symbol: 'c/c', label: 'C/C-afstand', unit: 'mm', description: 'Centrerafstand mellem lægter — afhænger af tagsten og producent.' },
        { symbol: 'l', label: 'Lægtelængde', unit: 'm', description: 'Standard lægtelængde — typisk 4,8 m.' },
        { symbol: 'n', label: 'Antal spær', unit: 'stk.', description: 'Antal spærfag der skal dækkes.' },
      ],
      formula: 'Antal pr. spær = ⌈Spærlængde / (c/c)⌉\nSamlet total = Antal pr. spær × Antal spær',
      assumptions: ['Ingen spild — lægter leveres i standard 4,8 m og kræver evt. stød.', 'C/C kontrolleres med tagsteensproducenten.'],
      standardsExplained: 'Lægteafstanden er bestemt af tagbelægningstypens bæreevne og taghældning. Typiske c/c: tegltag 310–360 mm, betontag 330–380 mm. Kontrollér altid med producenten.',
    },
    inputs: [
      { id: 'rafterLength', label: 'Spærlængde', unit: 'm', defaultValue: '6' },
      { id: 'cc', label: 'C/C-afstand', unit: 'mm', defaultValue: '330' },
      { id: 'battLength', label: 'Lægtelængde', unit: 'm', defaultValue: '4.8' },
      { id: 'quantity', label: 'Antal spærfag', unit: 'stk.', defaultValue: '10' },
    ],
    compute: (inputs) => {
      const r = computeBattenSpacing({ rafterLengthM: num(inputs, 'rafterLength'), ccMm: num(inputs, 'cc'), battLengthM: num(inputs, 'battLength'), quantity: num(inputs, 'quantity', 1) });
      return {
        value: r.count, unit: 'stk.',
        summary: `${r.count} lægter pr. spær · ${round(r.totalLength, 1)} lm total`,
        breakdown: [{ label: 'Total lm lægter', value: round(r.totalLength, 1), unit: 'm' }],
      };
    },
  },
  {
    id: 'lofter-tag-spaer-estimat',
    name: 'Spær estimat',
    category: 'Lofter & Tag',
    route: '/tools/lofter-tag/spaer-estimat',
    resultUnit: 'stk.',
    modes: 'both',
    safetyCritical: true,
    standards: [
      { code: 'DS/EN 1995-1-1', clause: 'EC5', note: 'Trækonstruktioner — dimensionering af spær.' },
      { code: 'BR18', note: 'Tagkonstruktioner skal dimensioneres af konstruktør.' },
    ],
    help: {
      purpose: 'Estimerer antal spær og spærlængde for et sadeltag ud fra bygningens bredde, taghældning og spærafstand.',
      variables: [
        { symbol: 'w', label: 'Bygningsbredde', unit: 'm', description: 'Den vandrette spændvidde for spærene.' },
        { symbol: 'α', label: 'Taghældning', unit: '°', description: 'Tagets hældningsvinkel.' },
        { symbol: 'l', label: 'Bygningslængde', unit: 'm', description: 'Husets længde — bestemmer antal spær.' },
        { symbol: 'c/c', label: 'Spærafstand', unit: 'mm', description: 'Center til center afstand — typisk 600–900 mm.' },
      ],
      formula: 'Spærlængde (halvdel) = (w/2) / cos(α)\nRidgehøjde = (w/2) × tan(α)\nAntal = ⌈Bygningslængde / (c/c)⌉ + 1',
      assumptions: ['Symmetrisk sadeltag.', 'Spærlængde er fra tagfod til rygning (ikke bjælkespænd).', 'Kræver ingeniørberegning til endelig dimensionering.'],
      standardsExplained: 'EC5 (DS/EN 1995-1-1) gælder for dimensionering af trækonstruktioner. Spærkonstruktion skal godkendes af konstruktør. Snemasse iht. DS/EN 1991-1-3 DK-anneks: sk = 1,0 kN/m² (zone 1).',
    },
    inputs: [
      { id: 'span', label: 'Bygningsbredde (spænd)', unit: 'm', defaultValue: '8' },
      { id: 'pitch', label: 'Taghældning', unit: '°', defaultValue: '30' },
      { id: 'buildingLength', label: 'Bygningslængde', unit: 'm', defaultValue: '12' },
      { id: 'cc', label: 'Spærafstand (c/c)', unit: 'mm', defaultValue: '600' },
    ],
    compute: (inputs) => {
      const r = computeRafter({ spanM: num(inputs, 'span'), pitchDeg: num(inputs, 'pitch'), ccMm: num(inputs, 'cc'), buildingLengthM: num(inputs, 'buildingLength') });
      return {
        value: r.count, unit: 'stk.',
        summary: `${r.count} spær · Spærlængde ${round(r.rafterLength, 2)} m · Ridge +${round(r.ridgeHeight, 2)} m`,
        breakdown: [
          { label: 'Spærlængde (halvdel)', value: round(r.rafterLength, 2), unit: 'm' },
          { label: 'Ridgehøjde', value: round(r.ridgeHeight, 2), unit: 'm' },
        ],
      };
    },
  },

  // ── Beton & Armering ──────────────────────────────────────────────────────
  {
    id: 'beton-armering-fundablokke',
    name: 'Fundablokke',
    category: 'Beton & Armering',
    route: '/tools/beton-armering/fundablokke',
    resultUnit: 'stk.',
    modes: 'basic',
    safetyCritical: false,
    standards: [...STANDARDS_CATALOG.concrete],
    help: {
      purpose: 'Beregner antal fundamentblokke (letbeton/beton) til et perimetersfundament.',
      variables: [
        { symbol: 'P', label: 'Perimeter', unit: 'm', description: 'Samlet udvendig perimeter af fundamentet.' },
        { symbol: 'H', label: 'Fundamenthøjde', unit: 'm', description: 'Antal skifter × blokhøjde.' },
        { symbol: 'bl', label: 'Bloklængde', unit: 'mm', description: 'Standard letbeton: 600 mm.' },
        { symbol: 'bh', label: 'Blokhøjde', unit: 'mm', description: 'Standard letbeton: 200–250 mm.' },
      ],
      formula: 'BlokkePrRække = ⌈Perimeter / (bl+fuge)⌉\nRækker = ⌈H / (bh+fuge)⌉\nTotal = BlokkePrRække × Rækker × (1 + spild%)',
      assumptions: ['Standard 12 mm fuge.', 'Hjørneblokkene medregnede i perimeter.'],
      standardsExplained: 'BR18 §§167–168 og DS/EN 1997-1 stiller krav til fundamentering. Blokke til fundament i jordkontakt skal minimum have styrkeklasse B25 (letbeton klasse 4).',
    },
    inputs: [
      { id: 'perimeter', label: 'Fundamentperimeter', unit: 'm', defaultValue: '24' },
      { id: 'height', label: 'Fundamenthøjde', unit: 'm', defaultValue: '0.6' },
      { id: 'blockL', label: 'Bloklængde', unit: 'mm', defaultValue: '600' },
      { id: 'blockH', label: 'Blokhøjde', unit: 'mm', defaultValue: '250' },
      { id: 'joint', label: 'Fugetykkelse', unit: 'mm', defaultValue: '12' },
      { id: 'wastage', label: 'Spildfaktor', unit: '%', defaultValue: '5' },
    ],
    compute: (inputs) => {
      const r = computeFoundationBlocks({ perimeterM: num(inputs, 'perimeter'), heightM: num(inputs, 'height'), blockLmm: num(inputs, 'blockL'), blockHmm: num(inputs, 'blockH'), jointMm: num(inputs, 'joint'), wastagePct: num(inputs, 'wastage') });
      return {
        value: r.total, unit: 'stk.',
        summary: `${r.total} blokke (${r.blocksPerRow} pr. række × ${r.rows} rækker, inkl. spild)`,
        breakdown: [
          { label: 'Blokke pr. række', value: r.blocksPerRow, unit: 'stk.' },
          { label: 'Antal rækker', value: r.rows, unit: 'stk.' },
        ],
      };
    },
  },
  {
    id: 'beton-armering-armeringsstaal',
    name: 'Armeringsstål',
    category: 'Beton & Armering',
    route: '/tools/beton-armering/armeringsstaal',
    resultUnit: 'kg',
    modes: 'both',
    safetyCritical: true,
    standards: [
      { code: 'DS/EN 1992-1-1', clause: 'EC2', note: 'Betonkonstruktioner — dæklag, armering, revnesikring.' },
      { code: 'BR18', clause: '§419', note: 'Armeringens dæklag og korrosionsbeskyttelse.' },
    ],
    help: {
      purpose: 'Estimerer samlet stållængde og -vægt for et armeringsnet (tovejsarmering) i en betonplade.',
      variables: [
        { symbol: 'L', label: 'Pladelivslængde', unit: 'm', description: 'Betonpladens længde.' },
        { symbol: 'B', label: 'Pladebredde', unit: 'm', description: 'Betonpladens bredde.' },
        { symbol: 'c/c', label: 'Armeringsafstand', unit: 'mm', description: 'Afstand mellem stænger — typisk 150–200 mm.' },
        { symbol: 'Ø', label: 'Stavdiameter', unit: 'mm', description: 'Typisk Ø8–Ø16 mm.' },
        { symbol: 'n', label: 'Lag', unit: 'stk.', description: '1 lag = ét sæt tovejsarmering.' },
      ],
      formula: 'Stave langs L = ⌈B / c/c⌉ + 1; Stave langs B = ⌈L / c/c⌉ + 1\nTotal lm = (stave_L × L + stave_B × B) × lag × (1 + spild%)\nVægt (kg) = (Ø² / 162) × Total lm',
      assumptions: ['Vejledende estimat — ikke til dimensionering.', 'Dæklag iht. EC2 eksponeringsklasse: XC1 = 25 mm, XC2 = 35 mm.'],
      standardsExplained: 'EC2 §4.4 fastlægger minimumsdæklag afhænig af eksponering. Armering skal dimensioneres af ingeniør for bærende konstruktioner. Vægtformlen (Ø²/162) er standard dansk tommelfingerregel for DS/EN 10080 stål.',
    },
    inputs: [
      { id: 'areaL', label: 'Pladelivslængde', unit: 'm', defaultValue: '5' },
      { id: 'areaW', label: 'Pladebredde', unit: 'm', defaultValue: '4' },
      { id: 'cc', label: 'C/C-afstand', unit: 'mm', defaultValue: '150' },
      { id: 'diam', label: 'Stavdiameter', unit: 'mm', defaultValue: '10' },
      { id: 'layers', label: 'Lag', unit: 'stk.', defaultValue: '1' },
      { id: 'wastage', label: 'Spildfaktor', unit: '%', defaultValue: '10', mode: 'advanced' },
    ],
    compute: (inputs) => {
      const r = computeReinforcement({ areaL: num(inputs, 'areaL'), areaW: num(inputs, 'areaW'), ccMm: num(inputs, 'cc'), diamMm: num(inputs, 'diam'), layers: num(inputs, 'layers', 1), wastagePct: num(inputs, 'wastage') });
      return {
        value: round(r.weightKg, 1), unit: 'kg',
        summary: `${round(r.weightKg, 1)} kg stål · ${round(r.totalLengthM, 1)} lm total`,
        breakdown: [{ label: 'Total stållængde', value: round(r.totalLengthM, 1), unit: 'm' }],
      };
    },
  },
  {
    id: 'beton-armering-forskalling',
    name: 'Forskalling',
    category: 'Beton & Armering',
    route: '/tools/beton-armering/forskalling',
    resultUnit: 'm²',
    modes: 'basic',
    safetyCritical: false,
    standards: [{ code: 'DS/EN 12812', note: 'Forskallingstryk fra frisk beton ≈ ρ × g × h — dimensionering af forskallingsarbejder (ikke EC2, som gælder hærdnet beton).' }],
    help: {
      purpose: 'Beregner forskallingsbehov (m²) for en støbt betonkonstruktion — brugt til indkøb af forskallingsplade og beregning af afstivere.',
      variables: [
        { symbol: 'L', label: 'Elementlængde', unit: 'm', description: 'Forskallingens længde.' },
        { symbol: 'H', label: 'Elementhøjde', unit: 'm', description: 'Forskallingens højde.' },
        { symbol: 'n', label: 'Antal sider', unit: 'stk.', description: '2 for vægge, 5 for firkantede søjler.' },
      ],
      formula: 'Areal = L × H × n × (1 + spild%)',
      assumptions: ['10–15% spild til savning og overlæg.', 'Genanvendelse reducerer faktisk indkøb.'],
      standardsExplained: 'Formelsiden dimensioneres for betontrykket: ρ × g × h (beton ≈ 24 kN/m³). En 2,5 m høj støbning giver trykket ≈ 60 kN/m². Kontrollér at forskallingspladerne kan klare trykket.',
    },
    inputs: [
      { id: 'length', label: 'Elementlængde', unit: 'm', defaultValue: '5' },
      { id: 'height', label: 'Elementhøjde', unit: 'm', defaultValue: '2.5' },
      { id: 'sides', label: 'Antal sider', unit: 'stk.', defaultValue: '2' },
      { id: 'wastage', label: 'Spildfaktor', unit: '%', defaultValue: '12' },
    ],
    compute: (inputs) => {
      const r = computeFormwork({ length: num(inputs, 'length'), height: num(inputs, 'height'), sides: num(inputs, 'sides', 2), wastagePct: num(inputs, 'wastage') });
      return { value: round(r.area, 2), unit: 'm²', summary: `${round(r.area, 2)} m² forskalling (inkl. spild)` };
    },
  },

  // ── Døre & Vinduer ────────────────────────────────────────────────────────
  {
    id: 'doere-vinduer-redningsaabning',
    name: 'Redningsåbning Tjek',
    category: 'Døre & Vinduer',
    route: '/tools/doere-vinduer/redningsaabning',
    resultUnit: '',
    modes: 'basic',
    safetyCritical: true,
    standards: [
      { code: 'BR18', clause: '§92–§97', note: 'Redningsåbning krævet i soverum — fri åbning ≥ 0,5 m bred og ≥ 0,6 m høj, sum ≥ 1,5 m.' },
    ],
    help: {
      purpose: 'Kontrollerer om et vindue overholder BR18-krav til redningsåbning i soverum — fri åbning ≥ 0,5 m bred, ≥ 0,6 m høj, sum ≥ 1,5 m.',
      variables: [
        { symbol: 'w', label: 'Fri bredde', unit: 'm', description: 'Vinduesåbningens fri bredde i fuldt åben tilstand.' },
        { symbol: 'h', label: 'Fri højde', unit: 'm', description: 'Vinduesåbningens fri højde i fuldt åben tilstand.' },
        { symbol: 'h_g', label: 'Højde over gulv', unit: 'cm', description: 'Underkant åbning over gulvet — bør maks. være 120 cm.' },
      ],
      formula: 'Krav 1: h ≥ 0,6 m\nKrav 2: w ≥ 0,5 m\nKrav 3: h + w ≥ 1,5 m\nAlt. 4: underkant ≤ 1,2 m over gulv',
      assumptions: ['Fri åbning måles i fuldt åben stilling.', 'Karme og sprosser fratrækkes.'],
      standardsExplained: 'BR18 §92 kræver redningsåbning i ethvert soverum og ethvert rum der bruges til at sove i. Åbningen skal kunne benyttes af redningstjenesten. Minimumsål er absolutte krav — ikke vejledende.',
    },
    inputs: [
      { id: 'width', label: 'Fri åbning bredde', unit: 'cm', defaultValue: '60' },
      { id: 'height', label: 'Fri åbning højde', unit: 'cm', defaultValue: '100' },
      { id: 'heightAboveFloor', label: 'Underkant over gulv', unit: 'cm', defaultValue: '90' },
    ],
    compute: (inputs) => {
      const r = computeEscapeWindow({ widthCm: num(inputs, 'width'), heightCm: num(inputs, 'height'), heightAboveFloorCm: num(inputs, 'heightAboveFloor') });
      return {
        value: r.passed ? 1 : 0, unit: r.passed ? 'GODKENDT' : 'IKKE GODKENDT',
        summary: `Sum H+B = ${round(r.sum, 2)} m · ${r.passed ? '✓ Godkendt' : '✗ Ikke godkendt'} (BR18 §92)`,
      };
    },
  },
  {
    id: 'doere-vinduer-vinduesareal',
    name: 'Vinduesareal & Dagslys',
    category: 'Døre & Vinduer',
    route: '/tools/doere-vinduer/vinduesareal',
    resultUnit: 'm²',
    modes: 'basic',
    safetyCritical: false,
    standards: [
      { code: 'BR18', clause: '§373', note: 'Dagslys: lysareal (vinduesglas) ≥ 10% af nettogulvareal for opholdsrum.' },
    ],
    help: {
      purpose: 'Beregner det samlede vinduesareal og kontrollerer om dagslys­kravet (≥ 10 % af gulvareal) i BR18 §373 er opfyldt.',
      variables: [
        { symbol: 'A_v', label: 'Vinduesareal', unit: 'm²', description: 'Samlet glassareal i rum (ikke karmens ydermål).' },
        { symbol: 'A_g', label: 'Gulvareal', unit: 'm²', description: 'Rummets nettogulvareal.' },
        { symbol: 'r', label: 'Lysfaktor', unit: '%', description: 'r = A_v / A_g × 100; BR18-krav: r ≥ 10%.' },
      ],
      formula: 'r = (Vinduesareal / Gulvareal) × 100',
      assumptions: ['Vinduesareal = glasareal (ekskl. karm).', 'Ovenlys tæller med fuld areal.', 'Nabobyggningers skyggevirkning er ikke medregnet.'],
      standardsExplained: 'BR18 §373: Opholdsrum skal modtage dagslys svarende til minimum 10% af gulvarealet (glasareal). Denne beregning er vejledende — det faktiske krav verificeres via en fuld dagslysfaktor-beregning (Df ≥ 2%) eller en DS/EN 17037-analyse.',
    },
    inputs: [
      { id: 'windowArea', label: 'Samlet vinduesareal', unit: 'm²', defaultValue: '3' },
      { id: 'floorArea', label: 'Gulvareal', unit: 'm²', defaultValue: '20' },
    ],
    compute: (inputs) => {
      const r = computeWindowDaylight({ windowAreaM2: num(inputs, 'windowArea'), floorAreaM2: num(inputs, 'floorArea') });
      return {
        value: round(r.ratio, 1), unit: '%',
        summary: `Lysfaktor: ${round(r.ratio, 1)}% · BR18 §373: ${r.passed ? '✓ Opfyldt (≥10%)' : '✗ Ikke opfyldt'}`,
      };
    },
  },

  // ── Udenomsarealer ────────────────────────────────────────────────────────
  {
    id: 'udenomsarealer-fald',
    name: 'Fald på Terræn',
    category: 'Udenomsarealer',
    route: '/tools/udenomsarealer/fald',
    resultUnit: '%',
    modes: 'basic',
    safetyCritical: false,
    standards: [
      { code: 'DS 432', clause: '§4.3', note: 'Min. fald fra bygning: 1:40 (2,5%) for de første 3 m.' },
      { code: 'BR18', note: 'Terræn og belægning: fald væk fra bygning for dræning.' },
    ],
    help: {
      purpose: 'Beregner hældningsprocent og faldforhold (1:n) for et terræn- eller belægningsparti og kontrollerer om BR18/DS 432-kravet på ≥ 1:40 er opfyldt.',
      variables: [
        { symbol: 'Δh', label: 'Højdeforskel', unit: 'm', description: 'Niveauforskel fra højeste til laveste punkt.' },
        { symbol: 'd', label: 'Vandret afstand', unit: 'm', description: 'Vandret afstand målt i plan.' },
        { symbol: 'p', label: 'Hældning', unit: '%', description: 'p = Δh / d × 100.' },
      ],
      formula: 'Hældning (%) = Δh / d × 100\nFaldforhold = 1:n = 1:(d/Δh)',
      assumptions: ['Lineær hældning antages.', 'DS 432 kræver min. 2,5% de første 3 m fra bygning.'],
      standardsExplained: 'DS 432 §4.3: Terræn og belægning skal have fald ≥ 1:40 (2,5%) fra bygningsfacaden ud til mindst 3 m afstand, for at sikre dræning væk fra fundamentet.',
    },
    inputs: [
      { id: 'heightDiff', label: 'Højdeforskel', unit: 'm', defaultValue: '0.075' },
      { id: 'distance', label: 'Vandret afstand', unit: 'm', defaultValue: '3' },
    ],
    compute: (inputs) => {
      const r = computeTerrainSlope({ heightDiffM: num(inputs, 'heightDiff'), horizontalDistM: num(inputs, 'distance') });
      return {
        value: round(r.slopePct, 2), unit: '%',
        summary: `Fald: ${round(r.slopePct, 2)}% (${r.slopeRatio}) · DS 432: ${r.passed ? '✓ OK (≥ 2,5%)' : '✗ For lille fald'}`,
      };
    },
  },
  {
    id: 'udenomsarealer-hegn',
    name: 'Hegn & Stolper',
    category: 'Udenomsarealer',
    route: '/tools/udenomsarealer/hegn',
    resultUnit: 'stk.',
    modes: 'basic',
    safetyCritical: false,
    standards: [{ code: 'BR18', note: 'Hegn til 1,8 m kræver ikke byggetilladelse. Vejadskillende hegn: kontrollér lokalplan.' }],
    help: {
      purpose: 'Beregner antal hegnsstolper og paneler til et hegnsprojekt ud fra samlet hegnslængde og stolpeafstand.',
      variables: [
        { symbol: 'L', label: 'Hegnslængde', unit: 'm', description: 'Samlet hegnslinje fra punkt A til B.' },
        { symbol: 'c/c', label: 'Stolpeafstand', unit: 'm', description: 'Afstand fra center til center — typisk 1,8–2,4 m.' },
        { symbol: 'sw', label: 'Stolpebredde', unit: 'm', description: 'Stolpens bredde — typisk 0,1 m.' },
      ],
      formula: 'Stolper = ⌈L / c/c⌉ + 1\nPanelbredde = c/c − sw',
      assumptions: ['Ét panel ml. hvert par stolper.', 'Restlængde kan kræve et smalt panel.'],
      standardsExplained: 'BR18: hegn op til 1,8 m kan opføres uden byggetilladelse i haver. Fortovsskel og vejadskillende hegn er underlagt lokalplankrav — tjek altid.',
    },
    inputs: [
      { id: 'length', label: 'Hegnslængde', unit: 'm', defaultValue: '20' },
      { id: 'cc', label: 'Stolpeafstand (c/c)', unit: 'm', defaultValue: '2.4' },
      { id: 'postWidth', label: 'Stolpebredde', unit: 'm', defaultValue: '0.1' },
    ],
    compute: (inputs) => {
      const r = computeFence({ lengthM: num(inputs, 'length'), postCcM: num(inputs, 'cc'), postWidthM: num(inputs, 'postWidth') });
      return {
        value: r.posts, unit: 'stk. stolper',
        summary: `${r.posts} stolper · ${r.panels} hele paneler${r.remainderM > 0.05 ? ` · 1 smal (${round(r.remainderM, 2)} m)` : ''}`,
        breakdown: [
          { label: 'Hele paneler', value: r.panels, unit: 'stk.' },
          { label: 'Restpanel', value: round(r.remainderM, 2), unit: 'm' },
        ],
      };
    },
  },

  {
    id: 'flisebelaegning',
    name: 'Flisebelægning (udendørs)',
    category: 'Udenomsarealer',
    route: '/tools/udenomsarealer/fliser',
    resultUnit: 'stk.',
    modes: 'basic',
    safetyCritical: false,
    standards: [
      { code: 'DS 432', clause: '§4.3', note: 'Fald på terræn og flisebelægning: min. 1:40 (25‰) væk fra bygning.' },
      { code: 'BR18', note: 'Vejledende spildfaktorer for udendørs belægning.' },
    ],
    help: {
      purpose: 'Beregner antal belægnings­sten, stabilgrus og afretnings­sand til udendørs flisebelægning.',
      variables: [
        { symbol: 'L', label: 'Område-længde', unit: 'm', description: 'Belægningsarealet i lengderetningen.' },
        { symbol: 'B', label: 'Område-bredde', unit: 'm', description: 'Belægningsarealet i bredderetningen.' },
        { symbol: 'sl', label: 'Stenlængde', unit: 'cm', description: 'Belægningsstenens nominelle længde.' },
        { symbol: 'sb', label: 'Stenbredde', unit: 'cm', description: 'Belægningsstenens nominelle bredde.' },
        { symbol: 's', label: 'Spild', unit: '%', description: 'Typisk 5% for rette kanter.' },
        { symbol: 'gs', label: 'Stabilus­grus lag', unit: 'm', description: 'Typisk 0,10–0,20 m (komprimeret).' },
        { symbol: 'as', label: 'Afretnings­sand lag', unit: 'm', description: 'Typisk 0,03 m (30 mm).' },
      ],
      formula: 'Areal = L × B\nStenAreal = (sl/100) × (sb/100)\nAntal = ⌈(Areal / StenAreal) × (1 + s/100)⌉\nStabilgrus (m³) = Areal × gs\nAfretningssand (m³) = Areal × as',
      assumptions: [
        '5% spildfaktor for rette belægningskanter.',
        'Stabilgrus 150 mm (komprimeret til 130 mm) som standard underbund.',
        'Afretningssand 30 mm som standardlag.',
      ],
      standardsExplained: 'DS 432 kræver minimum 1:40 fald (2,5%) på terræn- og belægningsflader for at sikre korrekt afledning af regnvand væk fra bygning. Kontrollér altid terrænets fald inden lægning.',
    },
    inputs: [
      { id: 'length', label: 'Område længde', unit: 'm', defaultValue: '5' },
      { id: 'width', label: 'Område bredde', unit: 'm', defaultValue: '4' },
      { id: 'stoneL', label: 'Sten længde', unit: 'cm', defaultValue: '21' },
      { id: 'stoneW', label: 'Sten bredde', unit: 'cm', defaultValue: '14' },
      { id: 'wastage', label: 'Spild', unit: '%', defaultValue: '5' },
      { id: 'gravel', label: 'Stabilgrus lag', unit: 'm', defaultValue: '0.15' },
      { id: 'sand', label: 'Afretningssand lag', unit: 'm', defaultValue: '0.03' },
    ],
    compute: (inputs) => {
      const r = computePaving({
        length: num(inputs, 'length'),
        width: num(inputs, 'width'),
        stoneLcm: num(inputs, 'stoneL'),
        stoneWcm: num(inputs, 'stoneW'),
        wastagePct: num(inputs, 'wastage'),
        gravelDepthM: num(inputs, 'gravel'),
        sandDepthM: num(inputs, 'sand'),
      });
      return {
        value: r.stones,
        unit: 'stk.',
        summary: `${r.stones} belægningssten · ${round(r.area, 1)} m²`,
        breakdown: [
          { label: 'Areal', value: round(r.area, 1), unit: 'm²' },
          { label: 'Stabilgrus', value: round(r.gravelVol, 2), unit: 'm³' },
          { label: 'Afretningssand', value: round(r.sandVol, 2), unit: 'm³' },
        ],
      };
    },
  },

  // ── Pris & Budget ────────────────────────────────────────────────────────────

  {
    id: 'projektbudget',
    name: 'Projektbudget',
    category: 'Pris & Budget',
    route: '/tools/pris-budget/projektbudget',
    resultUnit: 'kr.',
    modes: 'both',
    safetyCritical: false,
    standards: [{ code: 'Momsloven § 4', note: '25% moms på momspligtige varer og ydelser i Danmark.' }],
    help: {
      purpose: 'Beregner det samlede projektbudget ud fra budgetposter (materialer, arbejdsløn, øvrige). Basis-tilstand inkluderer uforudsete udgifter og moms. Avanceret tilstand tilføjer overhead-procent.',
      variables: [
        { symbol: 'Σ', label: 'Subtotal', unit: 'kr.', description: 'Sum af alle budgetposter ekskl. overhead og buffer.' },
        { symbol: 'OH', label: 'Overhead', unit: '%', description: 'Administrationsomkostninger, forsikring, profit-margen m.m. (kun avanceret).' },
        { symbol: 'B', label: 'Uforudsete udgifter (buffer)', unit: '%', description: '10–15% anbefales for renovering; 5–10% for nybyggeri.' },
        { symbol: 'moms', label: 'Moms', unit: '25%', description: 'Dansk moms er 25% på håndværksydelser og materialer (momspligtige).' },
      ],
      formula: 'Subtotal = Σ poster\nOverhead = Subtotal × OH%\nBuffer = (Subtotal + Overhead) × B%\nTotal ekskl. moms = Subtotal + Overhead + Buffer\nMoms = Total ekskl. moms × 0,25\nTotal inkl. moms = Total ekskl. moms + Moms',
      assumptions: [
        'Moms på 25% gælder for momspligtige ydelser — privateforbrugere betaler typisk moms.',
        'Buffer dækker uventede udgifter og prisstigninger.',
        'Overhead dækker ikke direkte produktionsomkostninger (disse indtastes som poster).',
      ],
      workedExample: 'Materialer 50.000 kr. + Arbejdsløn 30.000 kr., 10% overhead, 10% buffer, inkl. moms:\nSubtotal = 80.000\nOverhead = 8.000\nBuffer = 8.800\nTotal eks. moms = 96.800\nMoms = 24.200\nTotal = 121.000 kr.',
      standardsExplained: 'Momsloven § 4 fastsætter 25% moms på de fleste varer og ydelser i Danmark. Byggeri til eget brug kan i visse tilfælde være momsfritaget — konsultér skatterådgiver ved tvivl.',
    },
    inputs: [
      { id: 'material', label: 'Materialer', unit: 'kr.', defaultValue: '50000' },
      { id: 'labor', label: 'Arbejdsløn', unit: 'kr.', defaultValue: '30000' },
      { id: 'other', label: 'Øvrige omkostninger', unit: 'kr.', defaultValue: '5000' },
      { id: 'contingency', label: 'Uforudsete udgifter (buffer)', unit: '%', defaultValue: '10', info: '10–15% anbefales.' },
      { id: 'overhead', label: 'Overhead', unit: '%', defaultValue: '0', mode: 'advanced', info: 'Administration, forsikring, profit-margen.' },
      { id: 'includeVat', label: 'Inkl. 25% moms', type: 'select', options: [{ label: 'Ja', value: 'yes' }, { label: 'Nej', value: 'no' }], defaultValue: 'yes' },
    ],
    compute: (inputs) => {
      const r = computeBudget({
        items: [
          { name: 'Materialer', amount: num(inputs, 'material'), type: 'material' },
          { name: 'Arbejdsløn', amount: num(inputs, 'labor'), type: 'labor' },
          { name: 'Øvrige', amount: num(inputs, 'other'), type: 'other' },
        ],
        contingencyPct: num(inputs, 'contingency', 10),
        overheadPct: num(inputs, 'overhead', 0),
        includeVat: str(inputs, 'includeVat', 'yes') === 'yes',
      });
      return {
        value: round(r.total, 0),
        unit: 'kr.',
        summary: `Total: ${round(r.total, 0).toLocaleString('da-DK')} kr. inkl. moms`,
        breakdown: [
          { label: 'Materialer', value: round(r.materialTotal, 0), unit: 'kr.' },
          { label: 'Arbejdsløn', value: round(r.laborTotal, 0), unit: 'kr.' },
          { label: 'Øvrige', value: round(r.otherTotal, 0), unit: 'kr.' },
          { label: 'Overhead', value: round(r.overhead, 0), unit: 'kr.' },
          { label: 'Buffer', value: round(r.contingency, 0), unit: 'kr.' },
          { label: 'Moms (25%)', value: round(r.vat, 0), unit: 'kr.' },
        ],
      };
    },
  },

  {
    id: 'materialeomkostning',
    name: 'Materialeomkostning',
    category: 'Pris & Budget',
    route: '/tools/pris-budget/materialeomkostning',
    resultUnit: 'kr.',
    modes: 'both',
    safetyCritical: false,
    standards: [{ code: 'Momsloven § 4', note: '25% moms på materialer for private bygherrer.' }],
    help: {
      purpose: 'Beregner den samlede materialeomkostning for en liste af varer. Avanceret tilstand tilføjer spildfaktor og moms.',
      variables: [
        { symbol: 'Q', label: 'Antal', unit: 'stk./m/m²', description: 'Den bestilte eller forbrugte mængde.' },
        { symbol: 'P', label: 'Enhedspris', unit: 'kr.', description: 'Pris per enhed ekskl. moms.' },
        { symbol: 's', label: 'Spild', unit: '%', description: 'Typisk 5–10% for gipsplader, fliser m.m. (kun avanceret).' },
      ],
      formula: 'Subtotal = Σ (Q × P)\nSpild = Subtotal × s%\nTotal ekskl. moms = Subtotal + Spild\nMoms = Total ekskl. moms × 0,25\nTotal = Total ekskl. moms + Moms',
      assumptions: [
        'Priser er ekskl. moms — moms beregnes separat som 25%.',
        'Spildfaktor dækker kap-, klipp- og montagesvind.',
      ],
      workedExample: '20 stk. gipsplader à 89 kr., 5% spild, inkl. moms:\nSubtotal = 1.780 kr.\nSpild = 89 kr.\nTotal eks. moms = 1.869 kr.\nMoms = 467 kr.\nTotal = 2.336 kr.',
      standardsExplained: 'Moms på 25% opkræves af leverandøren og kan som regel fratrækkes for momsregistrerede virksomheder. For private bygherrer er moms en reel udgift.',
    },
    inputs: [
      { id: 'qty1', label: 'Antal (vare 1)', unit: 'stk.', defaultValue: '20' },
      { id: 'price1', label: 'Stk. pris (vare 1)', unit: 'kr.', defaultValue: '89' },
      { id: 'qty2', label: 'Antal (vare 2)', unit: 'stk.', defaultValue: '0' },
      { id: 'price2', label: 'Stk. pris (vare 2)', unit: 'kr.', defaultValue: '0' },
      { id: 'wastage', label: 'Spild', unit: '%', defaultValue: '5', mode: 'advanced', info: 'Typisk 5–10%.' },
      { id: 'includeVat', label: 'Inkl. 25% moms', type: 'select', options: [{ label: 'Ja', value: 'yes' }, { label: 'Nej', value: 'no' }], defaultValue: 'yes' },
    ],
    compute: (inputs) => {
      const r = computeMaterialCost({
        items: [
          { name: 'Vare 1', qty: num(inputs, 'qty1'), unitPrice: num(inputs, 'price1') },
          { name: 'Vare 2', qty: num(inputs, 'qty2'), unitPrice: num(inputs, 'price2') },
        ].filter(i => i.qty > 0 && i.unitPrice > 0),
        wastagePct: num(inputs, 'wastage', 0),
        includeVat: str(inputs, 'includeVat', 'yes') === 'yes',
      });
      return {
        value: round(r.total, 0),
        unit: 'kr.',
        summary: `${round(r.total, 0).toLocaleString('da-DK')} kr. total`,
        breakdown: [
          { label: 'Varekost', value: round(r.subtotal, 0), unit: 'kr.' },
          { label: 'Spild', value: round(r.wastage, 0), unit: 'kr.' },
          { label: 'Moms (25%)', value: round(r.vat, 0), unit: 'kr.' },
        ],
      };
    },
  },

  {
    id: 'arbejdsloen',
    name: 'Arbejdsløn',
    category: 'Pris & Budget',
    route: '/tools/pris-budget/arbejdsloen',
    resultUnit: 'kr.',
    modes: 'both',
    safetyCritical: false,
    standards: [{ code: 'Ferieloven § 16', note: 'Feriepenge 12,5% af lønnen. Momsloven § 4: 25% moms på håndværksydelser.' }],
    help: {
      purpose: 'Beregner den samlede lønudgift baseret på antal håndværkere, dage, timer og timepris. Avanceret tilstand tilføjer labor burden (feriepenge, pension, forsikring).',
      variables: [
        { symbol: 'W', label: 'Antal håndværkere', unit: 'pers.', description: 'Antal personer på opgaven.' },
        { symbol: 'D', label: 'Antal dage', unit: 'dage', description: 'Estimeret varighed.' },
        { symbol: 'H', label: 'Timer pr. dag', unit: 't', description: 'Standard dansk arbejdsdag er 7,4 t (overenskomst).' },
        { symbol: 'R', label: 'Timepris', unit: 'kr./t', description: 'Typisk 400–750 kr./t ekskl. moms for faglærte håndværkere.' },
        { symbol: 'LB', label: 'Labor burden', unit: '%', description: 'Feriepenge (12,5%), pension (ca. 8%), forsikring m.m. Typisk 25–35% oveni.' },
      ],
      formula: 'Timer i alt = W × D × H\nBasislønudgift = Timer × R\nLabor burden = Basis × LB%\nTotal ekskl. moms = Basis + Burden\nMoms = Total ekskl. moms × 0,25',
      assumptions: [
        '7,4 timer er normal arbejdsdag iht. overenskomst; 8 timer bruges til budgettering.',
        'Moms 25% på håndværksydelser opkræves af momsregistrerede firmaer.',
        'Labor burden dækker feriepenge, pension, ATP, arbejdsgiverforsikring m.m.',
      ],
      workedExample: '2 tømrere, 5 dage, 8 t/dag, 550 kr./t, 30% labor burden, inkl. moms:\nTimer = 80\nBasis = 44.000 kr.\nBurden = 13.200 kr.\nEkskl. moms = 57.200 kr.\nMoms = 14.300 kr.\nTotal = 71.500 kr.',
      standardsExplained: 'Feriepenge udgør 12,5% iht. Ferieloven. Pension udgør typisk 8–12% iht. overenskomst. Samlet labor burden ligger typisk på 25–40% oveni timelønnen.',
    },
    inputs: [
      { id: 'workers', label: 'Antal håndværkere', unit: 'pers.', defaultValue: '1' },
      { id: 'days', label: 'Antal dage', unit: 'dage', defaultValue: '5' },
      { id: 'hours', label: 'Timer pr. dag', unit: 't', defaultValue: '8' },
      { id: 'rate', label: 'Timepris ekskl. moms', unit: 'kr./t', defaultValue: '550' },
      { id: 'burden', label: 'Labor burden', unit: '%', defaultValue: '0', mode: 'advanced', info: 'Feriepenge + pension + forsikring. Typisk 25–35%.' },
      { id: 'includeVat', label: 'Inkl. 25% moms', type: 'select', options: [{ label: 'Ja', value: 'yes' }, { label: 'Nej', value: 'no' }], defaultValue: 'yes' },
    ],
    compute: (inputs) => {
      const r = computeLaborCost({
        workers: num(inputs, 'workers', 1),
        hoursPerDay: num(inputs, 'hours', 8),
        days: num(inputs, 'days', 1),
        hourlyRate: num(inputs, 'rate', 550),
        laborBurdenPct: num(inputs, 'burden', 0),
        includeVat: str(inputs, 'includeVat', 'yes') === 'yes',
      });
      return {
        value: round(r.total, 0),
        unit: 'kr.',
        summary: `${round(r.total, 0).toLocaleString('da-DK')} kr. · ${round(r.totalHours, 1)} timer i alt`,
        breakdown: [
          { label: 'Basislønudgift', value: round(r.baseCost, 0), unit: 'kr.' },
          { label: 'Labor burden', value: round(r.burden, 0), unit: 'kr.' },
          { label: 'Moms (25%)', value: round(r.vat, 0), unit: 'kr.' },
        ],
      };
    },
  },

  {
    id: 'finansiering',
    name: 'Finansieringsberegner',
    category: 'Pris & Budget',
    route: '/tools/pris-budget/finansiering',
    resultUnit: 'kr./md.',
    modes: 'both',
    safetyCritical: false,
    standards: [{ code: 'Kreditaftaleloven § 16a', note: 'ÅOP defineret i kreditaftaleloven og realkreditloven. Min. 5% udbetaling iht. bekendtgørelse om boligkredit.' }],
    help: {
      purpose: 'Beregner månedlig ydelse, samlede renter og ÅOP for realkreditlån og banklån. Avanceret tilstand inkluderer administrationsbidrag i ÅOP-beregningen.',
      variables: [
        { symbol: 'P', label: 'Boligpris / Lånebeløb', unit: 'kr.', description: 'Den samlede købesum eller det ønskede lånebeløb.' },
        { symbol: 'dp', label: 'Udbetaling', unit: '%', description: 'Min. 5% af købesummen kræves typisk i Danmark.' },
        { symbol: 'r', label: 'Nominel rente', unit: '% p.a.', description: 'Den aftalte rentesats.' },
        { symbol: 'n', label: 'Løbetid', unit: 'år', description: 'Typisk 20–30 år for realkreditlån.' },
        { symbol: 'AF', label: 'Administrationsbidrag', unit: 'kr./år', description: 'Årligt bidrag til realkreditinstituttet (kun avanceret).' },
      ],
      formula: 'Lånebeløb = Købesum × (1 − dp%)\nMånedlig ydelse = L × r_md × (1+r_md)^n / ((1+r_md)^n − 1)\nSamlede renter = Ydelse × n_mdr − Lånebeløb\nÅOP løses numerisk inkl. bidrag (Newton-Raphson)',
      assumptions: [
        'Annuitetslån med konstant ydelse. Variabelt forrentede lån kan give anden ydelse.',
        'ÅOP er relevant når administrationsbidrag er angivet.',
        'Skattefradrag for renteudgifter er ikke medregnet.',
      ],
      workedExample: '2.000.000 kr., 5% udbetaling, 4,5% p.a., 25 år:\nLånebeløb = 1.900.000 kr.\nYdelse ≈ 10.404 kr./md.\nRenter i alt ≈ 1.221.200 kr.',
      standardsExplained: 'ÅOP (Årlig Omkostning i Procent) er defineret i kreditaftaleloven og realkreditloven og angiver den effektive låneomkostning inkl. bidrag og gebyrer.',
    },
    inputs: [
      { id: 'principal', label: 'Boligpris / Lånebeløb', unit: 'kr.', defaultValue: '1500000' },
      { id: 'downPct', label: 'Udbetaling', unit: '%', defaultValue: '5', info: 'Min. 5% kræves typisk.' },
      { id: 'ratePct', label: 'Nominel rente (p.a.)', unit: '%', defaultValue: '4.5' },
      { id: 'years', label: 'Løbetid', unit: 'år', defaultValue: '25' },
      { id: 'adminFee', label: 'Administrationsbidrag', unit: 'kr./år', defaultValue: '0', mode: 'advanced', info: 'Typisk 0,4–0,8% af restgæld for realkreditlån.' },
    ],
    compute: (inputs) => {
      const r = computeLoanAmortization({
        principal: num(inputs, 'principal'),
        downPaymentPct: num(inputs, 'downPct', 5),
        annualRatePct: num(inputs, 'ratePct', 4.5),
        termYears: num(inputs, 'years', 25),
        annualAdminFeeKr: num(inputs, 'adminFee', 0),
      });
      return {
        value: round(r.monthlyPayment, 0),
        unit: 'kr./md.',
        summary: `Månedlig ydelse: ${round(r.monthlyPayment, 0).toLocaleString('da-DK')} kr. · Renter i alt: ${round(r.totalInterest / 1000, 0)}k kr.`,
        breakdown: [
          { label: 'Udbetaling', value: round(r.downPayment, 0), unit: 'kr.' },
          { label: 'Lånebeløb', value: round(r.loan, 0), unit: 'kr.' },
          { label: 'Samlede renter', value: round(r.totalInterest, 0), unit: 'kr.' },
          { label: 'ÅOP', value: round(r.aprPct, 2), unit: '%' },
        ],
      };
    },
  },

  // ── Phase 2 upgraded calculators ────────────────────────────────────────────

  {
    id: 'statiske-beregninger-soejlebelastning',
    name: 'Søjlebelastning (Euler)',
    category: 'Statiske Beregninger',
    route: '/tools/statiske-beregninger/soejlebelastning',
    resultUnit: 'kN',
    modes: 'both',
    safetyCritical: true,
    standards: STANDARDS_CATALOG.statics,
    help: {
      purpose: 'Beregner Eulers kritiske knækkraft for en simpelt understøttet søjle (frit oplagt i begge ender). Gyldigt for lineært elastiske søjler ved aksialtryk.',
      variables: [
        { symbol: 'b', label: 'Bredde', unit: 'm', description: 'Søjlens tværsnitsbredde.' },
        { symbol: 'd', label: 'Dybde', unit: 'm', description: 'Søjlens tværsnitsdybde.' },
        { symbol: 'L', label: 'Frihøjde', unit: 'm', description: 'Søjlens fri buckling-længde.' },
        { symbol: 'E', label: 'Elasticitetsmodul', unit: 'GPa', description: 'Materialespecifik stivhed: Træ ≈ 12 GPa, Stål ≈ 210 GPa.' },
      ],
      formula: 'I = (b × d³) / 12   [m⁴]\nPcrit = π² × E × I / L²   [kN]',
      assumptions: ['Simpelt oplagt i begge ender (knækfaktor k=1).', 'Ideal elastisk søjle uden ekscentrisk belastning.', 'Lokal udknækning af tværsnit ikke kontrolleret.'],
      standardsExplained: 'DS/EN 1995-1-1 (EC5) for træ og DS/EN 1993-1-1 (EC3) for stål specificerer knæklastberegning. Eulers formel er gyldig i det elastiske område.',
    },
    inputs: [
      { id: 'width', label: 'Bredde (b)', unit: 'm', defaultValue: '0.1' },
      { id: 'depth', label: 'Dybde (d)', unit: 'm', defaultValue: '0.1' },
      { id: 'height', label: 'Frihøjde (L)', unit: 'm', defaultValue: '3' },
      { id: 'eModulusGPa', label: 'Elasticitetsmodul (E)', unit: 'GPa', defaultValue: '12', info: 'Træ ≈ 12 GPa, Stål ≈ 210 GPa' },
    ],
    compute: (inputs) => {
      const { criticalLoadKN, momentOfInertiaM4 } = computeColumnLoad({
        widthM: num(inputs, 'width'),
        depthM: num(inputs, 'depth'),
        heightM: num(inputs, 'height'),
        elasticModulusPa: num(inputs, 'eModulusGPa') * 1e9,
      });
      return {
        value: round(criticalLoadKN, 2),
        unit: 'kN',
        summary: `Kritisk knækkraft: ${round(criticalLoadKN, 2)} kN`,
        breakdown: [{ label: 'Inertimoment I', value: round(momentOfInertiaM4 * 1e8, 4), unit: '×10⁻⁸ m⁴' }],
      };
    },
  },

  {
    id: 'statiske-beregninger-fundament',
    name: 'Fundamentstørrelse',
    category: 'Statiske Beregninger',
    route: '/tools/statiske-beregninger/fundament',
    resultUnit: 'm²',
    modes: 'basic',
    safetyCritical: true,
    standards: STANDARDS_CATALOG.statics,
    help: {
      purpose: 'Beregner det nødvendige fundamentareal for at overføre en given aksialbelastning til undergrunden uden at overskride bæreevnen.',
      variables: [
        { symbol: 'N', label: 'Søjlelast', unit: 'kN', description: 'Aksial last fra søjle eller væg til fundamentet.' },
        { symbol: 'q', label: 'Tilladelig bæreevne', unit: 'kN/m²', description: 'Grundens tilladelige bæreevne. Sand: 100–300 kN/m², Ler: 50–150 kN/m².' },
      ],
      formula: 'A = N / q   [m²]\nSidelængde = √A   [m]',
      assumptions: ['Ensartet lastfordeling over fundamentets bund.', 'Bæreevnen er karakteristisk og ikke design-bæreevne (ingen sikkerhedsfaktorer inkluderet).', 'Fundamentets egenvægt ikke medregnet.'],
      standardsExplained: 'DS/EN 1997-1 (EC7) fastlægger geotekniske undersøgelseskrav og beregningsmetoder for fundamenters bæreevne. Jordbundsundersøgelse er altid nødvendig.',
    },
    inputs: [
      { id: 'load', label: 'Søjlelast (N)', unit: 'kN', defaultValue: '500' },
      { id: 'capacity', label: 'Grundens bæreevne (q)', unit: 'kN/m²', defaultValue: '150', info: 'Sand: 100–300 kN/m², Ler: 50–150 kN/m².' },
    ],
    compute: (inputs) => {
      const { areaM2, sideLengthM } = computeFoundationArea({
        loadKN: num(inputs, 'load'),
        capacityKNm2: num(inputs, 'capacity'),
      });
      return {
        value: round(areaM2, 2),
        unit: 'm²',
        summary: `Fundament: ${round(areaM2, 2)} m² · Sidelængde: ${round(sideLengthM, 2)} m`,
        breakdown: [{ label: 'Kvadratisk sidelængde', value: round(sideLengthM, 2), unit: 'm' }],
      };
    },
  },

  {
    id: 'statiske-beregninger-baerende-vaeg',
    name: 'Bærende Vægbelastning',
    category: 'Statiske Beregninger',
    route: '/tools/statiske-beregninger/baerende-vaeg',
    resultUnit: 'kN/m',
    modes: 'basic',
    safetyCritical: true,
    standards: STANDARDS_CATALOG.statics,
    help: {
      purpose: 'Beregner egenvægt og samlet belastning pr. løbende meter for en bærende væg.',
      variables: [
        { symbol: 'h', label: 'Vægghøjde', unit: 'm', description: 'Fri vægghøjde.' },
        { symbol: 't', label: 'Tykkelse', unit: 'm', description: 'Væggens tværsnitstykkelse.' },
        { symbol: 'ρ', label: 'Densitet', unit: 'kg/m³', description: 'Mursten ≈ 1800 kg/m³, Letbeton ≈ 800 kg/m³.' },
        { symbol: 'q_add', label: 'Tillægslast', unit: 'kN/m', description: 'Ovenfor liggende last (fra dæk, tag m.m.).' },
      ],
      formula: 'Egenvægt = h × t × ρ × 9,81 / 1000   [kN/m]\nTotal = Egenvægt + q_add   [kN/m]',
      assumptions: ['Jævnt fordelt last pr. løbende meter.', 'Egenvægt af væggens eget tryk på fundamentet.'],
      standardsExplained: 'DS/EN 1991-1-1 (EC1) angiver egenlaster. Bærende vægge skal dimensioneres iht. DS/EN 1996 (EC6) for murværk eller DS/EN 1992 (EC2) for beton.',
    },
    inputs: [
      { id: 'height', label: 'Vægghøjde (h)', unit: 'm', defaultValue: '2.6' },
      { id: 'thickness', label: 'Tykkelse (t)', unit: 'm', defaultValue: '0.25' },
      { id: 'density', label: 'Densitet (ρ)', unit: 'kg/m³', defaultValue: '1800', info: 'Mursten ≈ 1800, Letbeton ≈ 800, Beton ≈ 2400 kg/m³' },
      { id: 'additionalLoad', label: 'Tillægslast (q)', unit: 'kN/m', defaultValue: '20' },
    ],
    compute: (inputs) => {
      const { selfWeightKNm, totalLoadKNm } = computeBearingWallLoad({
        heightM: num(inputs, 'height'),
        thicknessM: num(inputs, 'thickness'),
        densityKgM3: num(inputs, 'density'),
        additionalLoadKNm: num(inputs, 'additionalLoad'),
      });
      return {
        value: round(totalLoadKNm, 2),
        unit: 'kN/m',
        summary: `Total: ${round(totalLoadKNm, 2)} kN/m (egenvægt: ${round(selfWeightKNm, 2)} kN/m)`,
        breakdown: [
          { label: 'Egenvægt', value: round(selfWeightKNm, 2), unit: 'kN/m' },
          { label: 'Tillægslast', value: round(num(inputs, 'additionalLoad'), 2), unit: 'kN/m' },
        ],
      };
    },
  },

  {
    id: 'statiske-beregninger-nedboejning',
    name: 'Nedbøjningsberegner',
    category: 'Statiske Beregninger',
    route: '/tools/statiske-beregninger/nedboejning',
    resultUnit: 'mm',
    modes: 'basic',
    safetyCritical: true,
    standards: STANDARDS_CATALOG.statics,
    help: {
      purpose: 'Beregner maksimal midspans nedbøjning for en simpelt understøttet bjælke med jævnt fordelt last. Kontrollerer mod EC5/EC3 grænseværdier L/300 og L/400.',
      variables: [
        { symbol: 'L', label: 'Spændvidde', unit: 'm', description: 'Bjælkens fri spændvidde.' },
        { symbol: 'q', label: 'Fordelt last', unit: 'kN/m', description: 'Jævnt fordelt belastning inkl. egenvægt.' },
        { symbol: 'E', label: 'Elasticitetsmodul', unit: 'GPa', description: 'Træ ≈ 11 GPa, Stål ≈ 210 GPa, Beton ≈ 30 GPa.' },
        { symbol: 'I', label: 'Inertimoment', unit: 'cm⁴', description: 'Tværsnittets inertimoment om bøjningsaksen.' },
      ],
      formula: 'δ_max = (5 × q × L⁴) / (384 × E × I)\nGrænse L/300 og L/400 (EC5/EC3)',
      assumptions: ['Simpelt understøttet bjælke.', 'Jævnt fordelt last.', 'Lineær elastisk materialeopførsel.'],
      standardsExplained: 'DS/EN 1995-1-1 (EC5) angiver serviceabilitetskrav til nedbøjning: L/300 for almindelig konstruktion, L/400 for komforts krav. Tilsvarende for stål (EC3).',
    },
    inputs: [
      { id: 'span', label: 'Spændvidde (L)', unit: 'm', defaultValue: '4' },
      { id: 'load', label: 'Fordelt last (q)', unit: 'kN/m', defaultValue: '5' },
      { id: 'eGPa', label: 'Elasticitetsmodul (E)', unit: 'GPa', defaultValue: '11', info: 'Træ ≈ 11–12 GPa, Stål ≈ 210 GPa, Beton ≈ 30 GPa' },
      { id: 'iCm4', label: 'Inertimoment (I)', unit: 'cm⁴', defaultValue: '1000', info: 'Aflæs fra profilkataloget. Fx 200×50 mm rektangel: I = 5000/12 ≈ 417 cm⁴' },
    ],
    compute: (inputs) => {
      const { deflectionMm, limitL300mm, limitL400mm } = computeDeflection({
        spanM: num(inputs, 'span'),
        loadKNm: num(inputs, 'load'),
        elasticModulusGPa: num(inputs, 'eGPa'),
        momentOfInertiaM4: num(inputs, 'iCm4') * 1e-8,
      });
      return {
        value: round(deflectionMm, 2),
        unit: 'mm',
        summary: `Nedbøjning: ${round(deflectionMm, 2)} mm · L/300 = ${round(limitL300mm, 1)} mm · L/400 = ${round(limitL400mm, 1)} mm`,
        breakdown: [
          { label: 'Grænse L/300', value: round(limitL300mm, 1), unit: 'mm' },
          { label: 'Grænse L/400', value: round(limitL400mm, 1), unit: 'mm' },
        ],
      };
    },
  },

  {
    id: 'el-lyspunkter',
    name: 'Lyspunkter (Belysningsstyrke)',
    category: 'El',
    route: '/tools/el/lyspunkter',
    resultUnit: 'stk.',
    modes: 'basic',
    safetyCritical: false,
    standards: [{ code: 'DS/EN 12464-1', note: 'Belysning af arbejdspladser i indendørs omgivelser — minimale belysningsstyrker.' }],
    help: {
      purpose: 'Beregner det anbefalede antal armaturer/lyspunkter for at opnå en given belysningsstyrke i et rum baseret på Lumen-metoden.',
      variables: [
        { symbol: 'A', label: 'Rumareal', unit: 'm²', description: 'Rummets gulvareal.' },
        { symbol: 'E', label: 'Målbelysning', unit: 'lux', description: 'Ønsket belysningsstyrke. Kontor: 500 lux, Gang: 100 lux.' },
        { symbol: 'Φ', label: 'Lumen pr. armatur', unit: 'lm', description: 'Lyskildernes luminøse flux pr. armatur.' },
        { symbol: 'η', label: 'Vedligeholdelsesfaktor', unit: '–', description: 'Typisk 0,6–0,8 afhængig af rengøring og lampeafslagning.' },
      ],
      formula: 'n = ⌈(A × E) / (Φ × η)⌉',
      assumptions: ['Jævn belysningsfordeling.', 'Vedligeholdelsesfaktor η = 0,6 (standard).', 'Rumgeometri og refleksionsfaktorer ikke medregnet.'],
      standardsExplained: 'DS/EN 12464-1 specificerer minimale belysningsstyrker for arbejdspladser: kontorer 500 lux, trapper 150 lux, industri 300–500 lux.',
    },
    inputs: [
      { id: 'area', label: 'Rumareal', unit: 'm²', defaultValue: '30' },
      { id: 'lux', label: 'Målbelysning', unit: 'lux', defaultValue: '500', info: 'Kontor: 500, Gang: 100, Opholdsstue: 200 lux' },
      { id: 'lumens', label: 'Lumen pr. armatur', unit: 'lm', defaultValue: '3000', info: 'LED panel 36W ≈ 3000 lm, LED downlight 9W ≈ 700 lm' },
      { id: 'mf', label: 'Vedligeholdelsesfaktor', unit: '–', defaultValue: '0.6' },
    ],
    compute: (inputs) => {
      const { fixtureCount } = computeLightingLayout({
        areaM2: num(inputs, 'area'),
        targetLux: num(inputs, 'lux'),
        lumensPerFixture: num(inputs, 'lumens'),
        maintenanceFactor: num(inputs, 'mf', 0.6),
      });
      return {
        value: fixtureCount,
        unit: 'stk.',
        summary: `${fixtureCount} armaturer · ${num(inputs, 'lux')} lux mål`,
      };
    },
  },

  {
    id: 'el-solpanel',
    name: 'Solpanellayout',
    category: 'El',
    route: '/tools/el/solpanel',
    resultUnit: 'stk.',
    modes: 'basic',
    safetyCritical: false,
    standards: [{ code: 'BR18', clause: '§', note: 'Teknisk krav til solcelleanlæg og tilslutning til elforsyningen.' }],
    help: {
      purpose: 'Beregner det maksimale antal solpaneler der kan monteres på et givet tagfladereal og den samlede installerede effekt.',
      variables: [
        { symbol: 'Ltag', label: 'Tagets længde', unit: 'm', description: 'Tagfladens længde i montageretningen.' },
        { symbol: 'Btag', label: 'Tagets bredde', unit: 'm', description: 'Tagfladens bredde.' },
        { symbol: 'Lp', label: 'Panellængde', unit: 'm', description: 'Standardpaneler er typisk 1,7–2,0 m.' },
        { symbol: 'Bp', label: 'Panelbredde', unit: 'm', description: 'Standardpaneler er typisk 1,0–1,1 m.' },
        { symbol: 'Pp', label: 'Paneleffekt', unit: 'Wp', description: 'Nominel effekt pr. panel under standardbetingelser.' },
      ],
      formula: 'Kolonner = ⌊Btag / (Bp + mellemrum)⌋\nRækker = ⌊Ltag / (Lp + mellemrum)⌋\nAntal = Kolonner × Rækker\nTotal = Antal × Pp / 1000  [kWp]',
      assumptions: ['Ens monteringsretning for alle paneler.', 'Ensartet mellemrum.', 'Tagkant-afstand ikke medregnet.'],
      standardsExplained: 'Solcelleanlæg kræver tilslutningsgodkendelse fra netselskabet. BR18 stiller krav til installationens tekniske udformning.',
    },
    inputs: [
      { id: 'roofLength', label: 'Tagets længde', unit: 'm', defaultValue: '10' },
      { id: 'roofWidth', label: 'Tagets bredde', unit: 'm', defaultValue: '8' },
      { id: 'panelLength', label: 'Panellængde', unit: 'm', defaultValue: '1.72' },
      { id: 'panelWidth', label: 'Panelbredde', unit: 'm', defaultValue: '1.04' },
      { id: 'spacing', label: 'Mellemrum', unit: 'm', defaultValue: '0.02' },
      { id: 'panelPower', label: 'Paneleffekt', unit: 'Wp', defaultValue: '400' },
    ],
    compute: (inputs) => {
      const { panelCount, totalPowerKw, rows, cols } = computeSolarPanelLayout({
        roofLengthM: num(inputs, 'roofLength'),
        roofWidthM: num(inputs, 'roofWidth'),
        panelLengthM: num(inputs, 'panelLength'),
        panelWidthM: num(inputs, 'panelWidth'),
        spacingM: num(inputs, 'spacing'),
        panelPowerW: num(inputs, 'panelPower'),
      });
      return {
        value: panelCount,
        unit: 'stk.',
        summary: `${panelCount} paneler · ${round(totalPowerKw, 2)} kWp total`,
        breakdown: [
          { label: 'Rækker', value: rows, unit: 'stk.' },
          { label: 'Kolonner', value: cols, unit: 'stk.' },
          { label: 'Total installeret effekt', value: round(totalPowerKw, 2), unit: 'kWp' },
        ],
      };
    },
  },

  {
    id: 'el-sol-roi',
    name: 'Solcelle ROI Beregner',
    category: 'El',
    route: '/tools/el/sol-roi',
    resultUnit: 'år',
    modes: 'basic',
    safetyCritical: false,
    standards: [{ code: 'Energistyrelsen', note: 'Tilskudsordninger til solcelleanlæg. Besparelse beregnet som undgået elindkøb iht. gældende elpris.' }],
    help: {
      purpose: 'Beregner tilbagebetaling, livstidsbesparelse og ROI for et solcelleanlæg baseret på anlægsomkostning, produktion og elpris.',
      variables: [
        { symbol: 'C', label: 'Anlægsomkostning', unit: 'kr.', description: 'Samlet installationsomkostning inkl. moms.' },
        { symbol: 'P', label: 'Årlig produktion', unit: 'kWh', description: 'Anlæggets forventede årlige energiproduktion.' },
        { symbol: 'e', label: 'Elpris', unit: 'kr./kWh', description: 'Gennemsnitlig elpris inkl. afgifter.' },
        { symbol: 'i', label: 'Pristigning', unit: '%/år', description: 'Forventet årlig stigning i elpris.' },
      ],
      formula: 'Årsbesparelse = P × e\nTilbagebetaling: ΣBesparelse(1+i)^år ≥ Nettoomkostning\nLivstidsbesparelse = Σ30år − Nettoomkostning',
      assumptions: ['30-årig beregningshorisont.', 'Solcelleanlæg forudsættes stabilt i driftsperioden.', 'Vedligeholdelsesomkostninger ikke medregnet.'],
      standardsExplained: 'Besparelsen beregnes som undgået elindkøb til den aktuelle elpris med prisindeksering. Tilskud fra Energistyrelsen fratrækkes anlægsomkostningen.',
    },
    inputs: [
      { id: 'systemCost', label: 'Anlægsomkostning', unit: 'kr.', defaultValue: '80000' },
      { id: 'production', label: 'Årlig produktion', unit: 'kWh', defaultValue: '5000' },
      { id: 'price', label: 'Elpris', unit: 'kr./kWh', defaultValue: '3.0' },
      { id: 'inflation', label: 'Elpristigning', unit: '%/år', defaultValue: '3' },
      { id: 'subsidy', label: 'Tilskud', unit: 'kr.', defaultValue: '0' },
    ],
    compute: (inputs) => {
      const { paybackYears, lifetimeSavingsDKK, annualSavingsDKK } = computeSolarRoi({
        systemCostDKK: num(inputs, 'systemCost'),
        annualProductionKwh: num(inputs, 'production'),
        electricityPriceDKK: num(inputs, 'price'),
        annualInflationPct: num(inputs, 'inflation'),
        subsidyDKK: num(inputs, 'subsidy'),
      });
      return {
        value: paybackYears,
        unit: 'år',
        summary: `Tilbagebetaling: ${paybackYears} år · Livstidsbesparelse: ${round(lifetimeSavingsDKK / 1000, 0)}k kr.`,
        breakdown: [
          { label: 'Årsbesparelse år 1', value: round(annualSavingsDKK, 0), unit: 'kr.' },
          { label: 'Livstidsbesparelse (30 år)', value: round(lifetimeSavingsDKK, 0), unit: 'kr.' },
        ],
      };
    },
  },

  {
    id: 'vvs-vandflow',
    name: 'Vandflow Beregner',
    category: 'VVS',
    route: '/tools/vvs/vandflow',
    resultUnit: 'L/s',
    modes: 'basic',
    safetyCritical: false,
    standards: STANDARDS_CATALOG.water,
    help: {
      purpose: 'Beregner vandflow i et rør ud fra indvendig diameter og strømningshastighed.',
      variables: [
        { symbol: 'd', label: 'Indvendig diameter', unit: 'mm', description: 'Rørets indvendige diameter.' },
        { symbol: 'v', label: 'Vandhastighed', unit: 'm/s', description: 'Strømningshastighed. DS 439: max 2,0 m/s.' },
      ],
      formula: 'Q = π × (d/2000)² × v × 1000   [L/s]\nQ_lpm = Q × 60   [L/min]',
      assumptions: ['Cirkulært tværsnit.', 'Jævn strøm (laminær/turbulent afhænger af Reynolds-tal).'],
      standardsExplained: 'DS 439 anbefaler max. vandhastighed 2,0 m/s for at undgå støj og erosion.',
    },
    inputs: [
      { id: 'diameter', label: 'Indvendig diameter', unit: 'mm', defaultValue: '22' },
      { id: 'velocity', label: 'Vandhastighed', unit: 'm/s', defaultValue: '1.5', info: 'DS 439: max 2,0 m/s' },
    ],
    compute: (inputs) => {
      const { flowLps, flowLpm } = computeWaterFlow({
        diameterMm: num(inputs, 'diameter'),
        velocityMs: num(inputs, 'velocity'),
      });
      return {
        value: round(flowLps, 3),
        unit: 'L/s',
        summary: `Flow: ${round(flowLps, 3)} L/s · ${round(flowLpm, 1)} L/min`,
        breakdown: [{ label: 'Flow (L/min)', value: round(flowLpm, 1), unit: 'L/min' }],
      };
    },
  },

  {
    id: 'vvs-gulvvarme',
    name: 'Gulvvarme Rørlængde',
    category: 'VVS',
    route: '/tools/vvs/gulvvarme',
    resultUnit: 'm',
    modes: 'basic',
    safetyCritical: false,
    standards: STANDARDS_CATALOG.heating,
    help: {
      purpose: 'Beregner nødvendig rørlængde til et gulvvarmesystem baseret på rumareal og rørspacing.',
      variables: [
        { symbol: 'A', label: 'Areal', unit: 'm²', description: 'Gulvvarmerum, netto gulvareal.' },
        { symbol: 's', label: 'Rørspacing', unit: 'm', description: 'Afstand center-center mellem rørene. Typisk 0,15–0,30 m.' },
        { symbol: 'n', label: 'Slangelængde pr. loop', unit: 'm', description: 'Maksimal slangelængde pr. kredsløb. Typisk 100–120 m.' },
      ],
      formula: 'L_total = (A / s) × 1,1   [m, inkl. 10% tillæg]\nLoops = ⌈L_total / n⌉',
      assumptions: ['10% ekstra rørlængde som sikkerhedsmargen.', 'Ensartet rørspacing over hele arealet.'],
      standardsExplained: 'DS 469 regulerer dimensionering af varme- og køleanlæg. Gulvvarme installeres typisk med spacing 150–300 mm afhængig af rummets varmetab.',
    },
    inputs: [
      { id: 'area', label: 'Gulvareal', unit: 'm²', defaultValue: '20' },
      { id: 'spacing', label: 'Rørspacing', unit: 'm', defaultValue: '0.2', info: 'Typisk 0,15 m (højt varmetab) – 0,30 m (lavt varmetab)' },
      { id: 'loopLength', label: 'Max. slangelængde pr. loop', unit: 'm', defaultValue: '100', info: 'Typisk 80–120 m for 16 mm PEX' },
    ],
    compute: (inputs) => {
      const { totalLengthM, loopCount } = computeUnderfloorHeating({
        areaM2: num(inputs, 'area'),
        spacingM: num(inputs, 'spacing'),
        loopLengthM: num(inputs, 'loopLength'),
      });
      return {
        value: round(totalLengthM, 0),
        unit: 'm',
        summary: `Rørlængde: ${round(totalLengthM, 0)} m${loopCount !== undefined ? ` · ${loopCount} loops` : ''}`,
        breakdown: loopCount !== undefined
          ? [{ label: 'Antal kredsløb', value: loopCount, unit: 'stk.' }]
          : [],
      };
    },
  },
  // ── Vægge & Skillevægge ────────────────────────────────────────────────────
  {
    id: 'vaegge-skillevaegge-maling-pro',
    name: 'Malingsestimering Pro',
    category: 'Vægge & Skillevægge',
    route: '/tools/vaegge-skillevaegge/maling-pro',
    resultUnit: 'liter',
    modes: 'basic',
    safetyCritical: false,
    standards: [
      { code: 'BR18', note: 'Vejledende dækningsgrad fra producenter. Se DS/EN ISO 2808 for måling.' },
    ],
    help: {
      purpose: 'Estimerer samlet malingsforbrug (liter) for et eller flere rum baseret på areal, antal lag og produktets dækningsgrad.',
      variables: [
        { symbol: 'A', label: 'Samlet areal', unit: 'm²', description: 'Vægge og evt. loft. Vinduer/døre fratrækkes.' },
        { symbol: 'n', label: 'Lag', unit: 'stk.', description: 'Antal malestrøg — normalt 2.' },
        { symbol: 'c', label: 'Dækningsgrad', unit: 'm²/L', description: 'Fra produktets datablad — typisk 8–12 m²/L.' },
        { symbol: 's', label: 'Spild', unit: '%', description: 'Pensel-/rulle-/sprøjtetab — typisk 10–15 %.' },
      ],
      formula: 'Netto = (A × n) / c\nTotal = Netto × (1 + s/100) [liter]',
      assumptions: [
        'Dækningsgrad fra produktets datablad.',
        'Spild dækker pensel, rulle og sprøjtetab.',
        'Fratrækker ikke vinduer/døre automatisk — korrigér arealet manuelt.',
      ],
      workedExample: 'Rum 40 m², 2 lag, dækningsgrad 10 m²/L, 10% spild:\nNetto = (40 × 2) / 10 = 8 L\nTotal = 8 × 1,10 = 8,8 L',
      standardsExplained: 'Dækningsgrad (spreading rate) måles per DS/EN ISO 2808. Produktdatablade fra Flügger, Dyrup m.fl. angiver typisk 8–12 m²/L pr. lag. Grundmaling (primer) har lavere dækningsgrad end toplag.',
    },
    inputs: [
      { id: 'totalArea', label: 'Samlet areal', unit: 'm²', defaultValue: '50' },
      { id: 'coats', label: 'Antal lag', unit: 'lag', defaultValue: '2' },
      { id: 'coverage', label: 'Dækningsgrad', unit: 'm²/L', defaultValue: '10' },
      { id: 'wastage', label: 'Spildfaktor', unit: '%', defaultValue: '10' },
    ],
    compute: (inputs) => {
      const r = computePaintPro({
        totalAreaM2: num(inputs, 'totalArea'),
        coats: num(inputs, 'coats', 2),
        coverageM2PerL: num(inputs, 'coverage', 10),
        wastagePct: num(inputs, 'wastage'),
      });
      return {
        value: round(r.totalLiters, 1),
        unit: 'liter',
        summary: `${round(r.totalLiters, 1)} L inkl. spild (netto ${round(r.netLiters, 1)} L)`,
        breakdown: [
          { label: 'Netto (ingen spild)', value: round(r.netLiters, 1), unit: 'L' },
        ],
      };
    },
  },
  {
    id: 'vaegge-skillevaegge-skeletvaeg',
    name: 'Skeletvæg (Stål/Træ)',
    category: 'Vægge & Skillevægge',
    route: '/tools/vaegge-skillevaegge/skeletvaeg',
    resultUnit: 'stk.',
    modes: 'basic',
    safetyCritical: false,
    standards: [
      { code: 'DS/EN 520', note: 'Gipsplader – definition, krav og prøvningsmetoder.' },
      { code: 'DS/EN 14195', note: 'Metalprofiler til ikke-bærende vægge – specifikationer.' },
      { code: 'BR18', clause: '§382', note: 'Lydisolering mellem rum: krav til vægkonstruktioner.' },
      { code: 'DS 449', note: 'Indvendig beklædning – mineraluld og dampspærre.' },
    ],
    help: {
      purpose: 'Estimerer antal stolper, skinner, isolering og gipsplader til en skeletvæg (stål- eller trærammesystem) baseret på mål og c/c-afstand.',
      variables: [
        { symbol: 'L', label: 'Vægglængde', unit: 'm', description: 'Væggens samlede vandrette udstrækning.' },
        { symbol: 'H', label: 'Væghøjde', unit: 'm', description: 'Væggens højde fra gulv til loft.' },
        { symbol: 'cc', label: 'Stolpeafstand c/c', unit: 'mm', description: 'Standard: 450 mm (900 mm gips) eller 600 mm (1200 mm gips).' },
        { symbol: 'lag', label: 'Gipslag pr. side', unit: 'lag', description: '2 lag anbefales for bedre stabilitet og lydisolering.' },
      ],
      formula: 'Stolper = ⌈(L × 1000 / c/c + 1) × 1,10⌉\nSkinner = L × 2 m (top + bund)\nIsolering = L × H × 1,05 m²\nPladeareal = L × H × 2 × lag × 1,10 m²\nPlader (1,2 × 2,4 m) = ⌈Pladeareal / 2,88⌉',
      assumptions: [
        '10% tillæg på stolper for hjørner og åbninger.',
        '5% spild på isolering.',
        '10% spild på gipsplader.',
        'Standardplade 1,2 × 2,4 m = 2,88 m².',
      ],
      workedExample: 'Væg 4 m × 2,5 m, c/c 450 mm, 2 lag gips:\nStolper = ⌈(4000/450 + 1) × 1,10⌉ = ⌈10 × 1,10⌉ = 11\nSkinner = 4 × 2 = 8 m\nIsolering = 4 × 2,5 × 1,05 = 10,5 m²\nPladeareal = 4 × 2,5 × 2 × 2 × 1,10 = 44 m²\nPlader = ⌈44 / 2,88⌉ = 16 stk.',
      standardsExplained: 'DS/EN 520 specificerer gipspladekvaliteter (A, D, E, H, F). DS/EN 14195 dækker metalprofiler til ikke-bærende vægge. BR18 §382 stiller lydkrav; til adskillelse af boliger kræves Rw ≥ 55 dB.',
    },
    inputs: [
      { id: 'length', label: 'Vægglængde', unit: 'm', defaultValue: '4' },
      { id: 'height', label: 'Væghøjde', unit: 'm', defaultValue: '2.5' },
      { id: 'spacing', label: 'Stolpeafstand c/c', unit: 'mm', defaultValue: '450' },
      { id: 'layers', label: 'Gipslag pr. side', unit: 'lag', defaultValue: '2' },
    ],
    compute: (inputs) => {
      const r = computeStudWall({
        lengthM: num(inputs, 'length'),
        heightM: num(inputs, 'height'),
        spacingMm: num(inputs, 'spacing', 450),
        layers: num(inputs, 'layers', 1),
      });
      return {
        value: r.studs,
        unit: 'stk.',
        summary: `${r.studs} stolper · ${round(r.trackLengthM, 1)} m skinner · ${round(r.insulationM2, 1)} m² isolering`,
        breakdown: [
          { label: 'Skinner (top + bund)', value: round(r.trackLengthM, 1), unit: 'm' },
          { label: 'Isolering', value: round(r.insulationM2, 1), unit: 'm²' },
          { label: 'Gipsplader (ca.)', value: r.boards, unit: 'stk.' },
          { label: 'Skruer', value: r.screws, unit: 'stk.' },
        ],
      };
    },
  },
  // ── Lofter & Tag ──────────────────────────────────────────────────────────
  {
    id: 'lofter-tag-loftplader',
    name: 'Loftplade Beregner',
    category: 'Lofter & Tag',
    route: '/tools/lofter-tag/loftplader',
    resultUnit: 'stk.',
    modes: 'basic',
    safetyCritical: false,
    standards: [
      { code: 'DS/EN 13964', note: 'Nedhængte lofter – krav og prøvningsmetoder.' },
      { code: 'BR18', clause: '§382', note: 'Lydisolering: nedhængte akustiklofter kan bidrage til reduktion.' },
    ],
    help: {
      purpose: 'Beregner antal loftplader og samlet areal at indkøbe inkl. spild for et givet rum.',
      variables: [
        { symbol: 'L_loft', label: 'Loftlængde', unit: 'm', description: 'Rummets indvendige længde.' },
        { symbol: 'B_loft', label: 'Loftbredde', unit: 'm', description: 'Rummets indvendige bredde.' },
        { symbol: 'L_p', label: 'Pladelængde', unit: 'm', description: 'Enkelt plates længde, typisk 1,2 m eller 0,6 m.' },
        { symbol: 'B_p', label: 'Platebredde', unit: 'm', description: 'Enkelt plates bredde, typisk 0,6 m.' },
        { symbol: 's', label: 'Spildfaktor', unit: '%', description: 'Skær og bortfald. Typisk 5–10 %.' },
      ],
      formula: 'Loftareal = L_loft × B_loft\nPladeareal = L_p × B_p\nAntal = ⌈(Loftareal / Pladeareal) × (1 + s/100)⌉\nKøbsareal = Loftareal × (1 + s/100) m²',
      assumptions: [
        'Rektangulært rum uden søjler eller nicher.',
        'Spild dækker kantskær og bortfald.',
      ],
      workedExample: 'Rum 5 × 4 m, plader 1,2 × 0,6 m, 10% spild:\nLoftareal = 20 m²\nPladeareal = 0,72 m²\nRåAntal = 20 / 0,72 = 27,8\nAntal = ⌈27,8 × 1,10⌉ = 31 stk.\nKøbsareal = 20 × 1,10 = 22 m²',
      standardsExplained: 'DS/EN 13964 specificerer krav til nedhængte loftkonstruktioner (bæresystem, klasse, brand). For akustiske krav henvises til DS/EN ISO 11654. Til fugtige rum (bad, køkken) kræves fugtbestandige plader.',
    },
    inputs: [
      { id: 'areaL', label: 'Loftlængde', unit: 'm', defaultValue: '5' },
      { id: 'areaW', label: 'Loftbredde', unit: 'm', defaultValue: '4' },
      { id: 'panelL', label: 'Pladelængde', unit: 'm', defaultValue: '1.2' },
      { id: 'panelW', label: 'Platebredde', unit: 'm', defaultValue: '0.6' },
      { id: 'wastage', label: 'Spildfaktor', unit: '%', defaultValue: '10' },
    ],
    compute: (inputs) => {
      const r = computeCeilingPanel({
        areaLM: num(inputs, 'areaL'),
        areaWM: num(inputs, 'areaW'),
        panelLM: num(inputs, 'panelL'),
        panelWM: num(inputs, 'panelW'),
        wastagePct: num(inputs, 'wastage'),
      });
      return {
        value: r.panels,
        unit: 'stk.',
        summary: `${r.panels} plader · ${round(r.totalAreaM2, 2)} m² at købe`,
        breakdown: [
          { label: 'Købsareal', value: round(r.totalAreaM2, 2), unit: 'm²' },
        ],
      };
    },
  },
];

// ── Link-only calculators (formula not extracted — open the page) ───────────

const LINK_ONLY: Array<Pick<CalculatorMeta, 'name' | 'category' | 'route'> & { resultUnit?: string }> = [
  // Areal & Rumfang (rumareal, vaegareal, rumfangsberegner moved to COMPUTABLE)
  { name: 'Loftsareal', category: 'Areal & Rumfang', route: '/tools/areal-rumfang/loftsareal', resultUnit: 'm²' },
  { name: 'Tagareal', category: 'Areal & Rumfang', route: '/tools/areal-rumfang/tagareal', resultUnit: 'm²' },
  { name: 'Gulvareal', category: 'Areal & Rumfang', route: '/tools/areal-rumfang/gulvareal', resultUnit: 'm²' },
  { name: 'Bygningsskal areal', category: 'Areal & Rumfang', route: '/tools/areal-rumfang/bygningsskal-areal', resultUnit: 'm²' },
  { name: 'Materialevolumen', category: 'Areal & Rumfang', route: '/tools/areal-rumfang/materialevolumen', resultUnit: 'm³' },
  { name: 'Skråtag / skunk (tællende areal)', category: 'Areal & Rumfang', route: '/tools/areal-rumfang/skraatag-areal', resultUnit: 'm²' },
  // Energi & Klima
  { name: 'Varmetabsberegner (U-værdi)', category: 'Energi & Klima', route: '/tools/energi-klima/varmetab', resultUnit: 'W/m²K' },
  { name: 'CO2-aftryk (LCA Light)', category: 'Energi & Klima', route: '/tools/energi-klima/co2', resultUnit: 'kg CO₂' },
  { name: 'Dugpunktsberegner', category: 'Energi & Klima', route: '/tools/energi-klima/dugpunkt', resultUnit: '°C' },
  // Trapper & Adgang
  { name: 'Trappeberegner (Ligeløb)', category: 'Trapper & Adgang', route: '/tools/trapper/ligeloeb' },
  { name: 'Trappevanger (Snit)', category: 'Trapper & Adgang', route: '/tools/trapper/vanger' },
  { name: 'Rampe-beregner', category: 'Trapper & Adgang', route: '/tools/trapper/rampe' },
  { name: 'Vindeltrappe', category: 'Trapper & Adgang', route: '/tools/trapper/vindeltrappe' },
  // Statiske Beregninger (bjælke, søjle, fundament, bærende væg, nedbøjning moved to COMPUTABLE)
  { name: 'Bjælkebelastning (Pro)', category: 'Statiske Beregninger', route: '/tools/statiske-beregninger/bjaelkebelastning' },
  { name: 'Dækbelastning', category: 'Statiske Beregninger', route: '/tools/statiske-beregninger/daekbelastning' },
  { name: 'Taglast & snelast', category: 'Statiske Beregninger', route: '/tools/statiske-beregninger/taglast-snelast' },
  { name: 'Vindlast', category: 'Statiske Beregninger', route: '/tools/statiske-beregninger/vindlast' },
  { name: 'Støttemur-stabilitet (EC7)', category: 'Statiske Beregninger', route: '/tools/statiske-beregninger/stoettemur' },
  // Vægge & Skillevægge (skeletvaeg, maling-pro moved to COMPUTABLE)
  { name: 'Skiftegangsberegner', category: 'Vægge & Skillevægge', route: '/tools/vaegge-skillevaegge/skiftegang' },
  // Lofter & Tag (laegter, spaer-estimat, loftplader, skeletvaeg moved to COMPUTABLE)
  { name: 'Tagrendeberegner', category: 'Lofter & Tag', route: '/tools/lofter-tag/tagrender', resultUnit: 'm' },
  { name: 'Tagmateriale', category: 'Lofter & Tag', route: '/tools/lofter-tag/tagmateriale' },
  { name: 'Vandtætning', category: 'Lofter & Tag', route: '/tools/lofter-tag/vandtætning' },
  { name: 'Taghældning', category: 'Lofter & Tag', route: '/tools/lofter-tag/taghaelding', resultUnit: '°' },
  // Døre & Vinduer (redningsaabning, vinduesareal moved to COMPUTABLE)
  { name: 'U-værdi', category: 'Døre & Vinduer', route: '/tools/doere-vinduer/u-vaerdi', resultUnit: 'W/m²K' },
  { name: 'Dørstørrelse', category: 'Døre & Vinduer', route: '/tools/doere-vinduer/doerstoerrelse' },
  { name: 'Fugemasse', category: 'Døre & Vinduer', route: '/tools/doere-vinduer/fugemasse', resultUnit: 'patroner' },
  { name: 'Vinduets lydisolering (Rw)', category: 'Døre & Vinduer', route: '/tools/doere-vinduer/lyd-rude', resultUnit: 'dB' },
  // VVS (vandflow, gulvvarme moved to COMPUTABLE)
  { name: 'Rørdimension', category: 'VVS', route: '/tools/vvs/roerdimension', resultUnit: 'mm' },
  { name: 'Kedelstørrelse', category: 'VVS', route: '/tools/vvs/kedelstoerrelse', resultUnit: 'kW' },
  { name: 'Radiatorstørrelse', category: 'VVS', route: '/tools/vvs/radiatorstoerrelse', resultUnit: 'W' },
  { name: 'Afløbsfald', category: 'VVS', route: '/tools/vvs/afloebsfald', resultUnit: 'mm/m' },
  // El (lyspunkter, solpanel, sol-roi moved to COMPUTABLE)
  { name: 'Kabel', category: 'El', route: '/tools/el/kabel', resultUnit: 'mm²' },
  { name: 'Kredsløbsbelastning', category: 'El', route: '/tools/el/kredslobsbelastning', resultUnit: 'A' },
  { name: 'Sikring', category: 'El', route: '/tools/el/sikring', resultUnit: 'A' },
  { name: 'Fejlsløjfeimpedans (Zs)', category: 'El', route: '/tools/el/fejlstrom-zs', resultUnit: 'Ω' },
  { name: 'Ladestander (elbil)', category: 'El', route: '/tools/el/ladestander', resultUnit: 'A' },
  // HVAC / Ventilation
  { name: 'Ventilationsflow', category: 'HVAC / Ventilation', route: '/tools/hvac/ventilationsflow', resultUnit: 'm³/h' },
  { name: 'Kanaldimension', category: 'HVAC / Ventilation', route: '/tools/hvac/kanaldimension', resultUnit: 'mm' },
  { name: 'Luftskifte', category: 'HVAC / Ventilation', route: '/tools/hvac/luftskifte', resultUnit: 'h⁻¹' },
  { name: 'Udsugning', category: 'HVAC / Ventilation', route: '/tools/hvac/udsugning', resultUnit: 'm³/h' },
  // Beton & Armering (fundablokke, armeringsstål, forskalling moved to COMPUTABLE)
  // Udgravning & Jord (jordvolumen, skraaning, tilbagefyldning moved to COMPUTABLE)
  { name: 'Udgravning — sikkerhed (AT D.2.17)', category: 'Udgravning & Jord', route: '/tools/udgravning-jord/afstivning', resultUnit: 'm' },
  { name: 'Faskine (nedsivning)', category: 'Udenomsarealer', route: '/tools/udenomsarealer/faskine', resultUnit: 'm³' },
  // Udenomsarealer (fald, hegn moved to COMPUTABLE)
  // Geometri (pythagoras, cirkel moved to COMPUTABLE)
  { name: 'AR Opmåling', category: 'Geometri & Opmåling', route: '/tools/geometri/ar-opmåling', resultUnit: 'm' },
  // Pris & Budget — moved to COMPUTABLE
];

const slugify = (route: string): string => route.split('/').filter(Boolean).slice(1).join('-');

// ── Public API ───────────────────────────────────────────────────────────────

/** All calculators: computable ones first within each category. */
export const listCalculators = (): CalculatorMeta[] => {
  const computable: CalculatorMeta[] = COMPUTABLE.map(({ compute, ...meta }) => ({
    ...meta,
    computable: true,
  }));
  const linkOnly: CalculatorMeta[] = LINK_ONLY.map((entry) => ({
    id: slugify(entry.route),
    name: entry.name,
    category: entry.category,
    route: entry.route,
    resultUnit: entry.resultUnit ?? '',
    computable: false,
  }));
  return [...computable, ...linkOnly];
};

export const getCalculator = (id: string): CalculatorMeta | undefined =>
  listCalculators().find((c) => c.id === id);

/**
 * Compute a calculator result programmatically.
 * Throws for unknown/non-computable ids — callers should check `computable` first.
 */
export const computeCalculator = (id: string, inputs: CalculatorInputs): CalculatorResult => {
  const def = COMPUTABLE.find((c) => c.id === id);
  if (!def) {
    throw new Error(`Beregneren '${id}' kan ikke beregnes programmatisk. Åbn beregnersiden i stedet.`);
  }
  return def.compute(inputs);
};

/** Convenience: ids of all calculators with extracted formulas. */
export const computableCalculatorIds = (): string[] => COMPUTABLE.map((c) => c.id);
