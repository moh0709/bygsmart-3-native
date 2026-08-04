// ─────────────────────────────────────────────────────────────────────────────
// ROUTE_DEFS — the single hand-maintained map of calculator routes.
//
// Generated 2026-07-10 from App.tsx's ~90 hand-written <Route> entries (the
// four previously-duplicated inventories consolidate onto this file + the
// catalog meta in ./catalog.ts). Adding a calculator = add its page under
// ./pages/<Category>/ + one line here. routes.fixture.json snapshots the
// production surface at extraction time; routes.parity.test.ts guards it.
//
// `toolId` present = the route renders inside ProtectedToolRoute (server-
// authoritative Pro/campaign gating via useToolAccess).
// ─────────────────────────────────────────────────────────────────────────────

import type React from 'react';

export interface ToolRouteDef {
  /** Route path under /tools/, e.g. 'areal-rumfang/rumareal'. */
  path: string;
  /** Present = Pro-gated: wrapped in ProtectedToolRoute with this id. */
  toolId?: string;
  load: () => Promise<{ default: React.ComponentType }>;
}

export const ROUTE_DEFS: ToolRouteDef[] = [
  { path: 'areal-rumfang/rumareal', toolId: 'rumareal', load: () => import('./pages/ArealRumfang/RoomAreaCalculator') },
  { path: 'areal-rumfang/vaegareal', toolId: 'vaegareal', load: () => import('./pages/ArealRumfang/WallAreaCalculator') },
  { path: 'areal-rumfang/loftsareal', load: () => import('./pages/ArealRumfang/CeilingAreaCalculator') },
  { path: 'areal-rumfang/tagareal', load: () => import('./pages/ArealRumfang/RoofAreaCalculator') },
  { path: 'areal-rumfang/gulvareal', load: () => import('./pages/ArealRumfang/FloorAreaCalculator') },
  { path: 'areal-rumfang/bygningsskal-areal', load: () => import('./pages/ArealRumfang/BuildingShellAreaCalculator') },
  { path: 'areal-rumfang/rumfangsberegner', toolId: 'rumfangsberegner', load: () => import('./pages/ArealRumfang/VolumeCalculator') },
  { path: 'areal-rumfang/materialevolumen', load: () => import('./pages/ArealRumfang/MaterialVolumeCalculator') },
  { path: 'areal-rumfang/skraatag-areal', load: () => import('./pages/ArealRumfang/LoftAreaCalculator') },
  { path: 'statiske-beregninger/bjaelkebelastning', toolId: 'statiske-beregninger-bjaelkebelastning', load: () => import('./pages/StatiskeBeregninger/BeamLoadCalculator') },
  { path: 'statiske-beregninger/soejlebelastning', toolId: 'statiske-beregninger-soejlebelastning', load: () => import('./pages/StatiskeBeregninger/ColumnLoadCalculator') },
  { path: 'statiske-beregninger/daekbelastning', load: () => import('./pages/StatiskeBeregninger/SlabLoadCalculator') },
  { path: 'statiske-beregninger/fundament', load: () => import('./pages/StatiskeBeregninger/FoundationCalculator') },
  { path: 'statiske-beregninger/taglast-snelast', load: () => import('./pages/StatiskeBeregninger/RoofSnowLoadCalculator') },
  { path: 'statiske-beregninger/vindlast', load: () => import('./pages/StatiskeBeregninger/WindLoadCalculator') },
  { path: 'statiske-beregninger/baerende-vaeg', load: () => import('./pages/StatiskeBeregninger/BearingWallCalculator') },
  { path: 'statiske-beregninger/nedboejning', load: () => import('./pages/StatiskeBeregninger/DeflectionCalculator') },
  { path: 'statiske-beregninger/stoettemur', load: () => import('./pages/StatiskeBeregninger/RetainingWallCalculator') },
  { path: 'gulve-overflader/gulvafretning', toolId: 'gulvafretning', load: () => import('./pages/GulveOverflader/ScreedCalculator') },
  { path: 'gulve-overflader/flisemaengde', toolId: 'flisemaengde', load: () => import('./pages/GulveOverflader/TileQuantityCalculator') },
  { path: 'gulve-overflader/traegulv-maengde', toolId: 'traegulv-maengde', load: () => import('./pages/GulveOverflader/WoodFloorCalculator') },
  { path: 'gulve-overflader/taeppe-laminat', toolId: 'taeppe-laminat', load: () => import('./pages/GulveOverflader/CarpetLaminateCalculator') },
  { path: 'gulve-overflader/gulvisolering', toolId: 'gulvisolering', load: () => import('./pages/GulveOverflader/FloorInsulationCalculator') },
  { path: 'vaegge-skillevaegge/mursten-blokke', toolId: 'mursten-blokke', load: () => import('./pages/VaeggeSkillevaegge/BrickBlockCalculator') },
  { path: 'vaegge-skillevaegge/gipsplader', toolId: 'gipsplader', load: () => import('./pages/VaeggeSkillevaegge/PlasterboardCalculator') },
  { path: 'vaegge-skillevaegge/puds-spartel', toolId: 'puds-spartel', load: () => import('./pages/VaeggeSkillevaegge/PlasterCalculator') },
  { path: 'vaegge-skillevaegge/vaegisolering', toolId: 'vaegisolering', load: () => import('./pages/VaeggeSkillevaegge/WallInsulationCalculator') },
  { path: 'vaegge-skillevaegge/maling-grunder', toolId: 'maling-grunder', load: () => import('./pages/VaeggeSkillevaegge/PaintCalculator') },
  { path: 'vaegge-skillevaegge/maling-pro', toolId: 'vaegge-skillevaegge-maling-pro', load: () => import('./pages/VaeggeSkillevaegge/PaintEstimatorPro') },
  { path: 'vaegge-skillevaegge/skeletvaeg', toolId: 'vaegge-skillevaegge-skeletvaeg', load: () => import('./pages/VaeggeSkillevaegge/StudWallCalculator') },
  { path: 'vaegge-skillevaegge/skiftegang', load: () => import('./pages/VaeggeSkillevaegge/BrickCourseCalculator') },
  { path: 'lofter-tag/loftplader', toolId: 'lofter-tag-loftplader', load: () => import('./pages/LofterTag/CeilingPanelCalculator') },
  { path: 'lofter-tag/loftisolering', toolId: 'loftisolering', load: () => import('./pages/LofterTag/CeilingInsulationCalculator') },
  { path: 'lofter-tag/tagmateriale', load: () => import('./pages/LofterTag/RoofingMaterialCalculator') },
  { path: 'lofter-tag/vandtætning', load: () => import('./pages/LofterTag/WaterproofingCalculator') },
  { path: 'lofter-tag/taghaelding', load: () => import('./pages/LofterTag/RoofPitchCalculator') },
  { path: 'lofter-tag/spaer-estimat', toolId: 'lofter-tag-spaer-estimat', load: () => import('./pages/LofterTag/RafterCalculator') },
  { path: 'lofter-tag/tagrender', load: () => import('./pages/LofterTag/GutterCalculator') },
  { path: 'lofter-tag/laegter', toolId: 'lofter-tag-laegter', load: () => import('./pages/LofterTag/BattenSpacingCalculator') },
  { path: 'doere-vinduer/vinduesareal', toolId: 'doere-vinduer-vinduesareal', load: () => import('./pages/DoereVinduer/WindowAreaCalculator') },
  { path: 'doere-vinduer/u-vaerdi', load: () => import('./pages/DoereVinduer/UValueCalculator') },
  { path: 'doere-vinduer/doerstoerrelse', load: () => import('./pages/DoereVinduer/DoorSizeCalculator') },
  { path: 'doere-vinduer/fugemasse', load: () => import('./pages/DoereVinduer/SealantCalculator') },
  { path: 'doere-vinduer/redningsaabning', toolId: 'doere-vinduer-redningsaabning', load: () => import('./pages/DoereVinduer/EscapeWindowCalculator') },
  { path: 'doere-vinduer/lyd-rude', load: () => import('./pages/DoereVinduer/WindowAcousticsCalculator') },
  { path: 'vvs/roerdimension', load: () => import('./pages/VVS/PipeSizingCalculator') },
  { path: 'vvs/vandflow', load: () => import('./pages/VVS/WaterFlowCalculator') },
  { path: 'vvs/kedelstoerrelse', load: () => import('./pages/VVS/BoilerSizingCalculator') },
  { path: 'vvs/radiatorstoerrelse', load: () => import('./pages/VVS/RadiatorSizingCalculator') },
  { path: 'vvs/gulvvarme', load: () => import('./pages/VVS/UnderfloorHeatingCalculator') },
  { path: 'vvs/afloebsfald', load: () => import('./pages/VVS/DrainSlopeCalculator') },
  { path: 'el/kabel', load: () => import('./pages/El/CableSizingCalculator') },
  { path: 'el/kredslobsbelastning', load: () => import('./pages/El/CircuitLoadCalculator') },
  { path: 'el/sikring', load: () => import('./pages/El/FuseSizingCalculator') },
  { path: 'el/lyspunkter', load: () => import('./pages/El/LightingCalculator') },
  { path: 'el/solpanel', load: () => import('./pages/El/SolarPanelCalculator') },
  { path: 'el/sol-roi', load: () => import('./pages/El/SolarRoiCalculator') },
  { path: 'el/fejlstrom-zs', load: () => import('./pages/El/EarthFaultLoopCalculator') },
  { path: 'el/ladestander', load: () => import('./pages/El/EvChargerCalculator') },
  { path: 'hvac/ventilationsflow', load: () => import('./pages/HVACVentilation/VentilationFlowCalculator') },
  { path: 'hvac/kanaldimension', load: () => import('./pages/HVACVentilation/DuctSizingCalculator') },
  { path: 'hvac/luftskifte', load: () => import('./pages/HVACVentilation/AirChangeCalculator') },
  { path: 'hvac/udsugning', load: () => import('./pages/HVACVentilation/ExhaustFanCalculator') },
  { path: 'beton-armering/betonvolumen', toolId: 'beton-volumen', load: () => import('./pages/BetonArmering/ConcreteCalculator') },
  { path: 'beton-armering/armeringsstaal', toolId: 'beton-armering-armeringsstaal', load: () => import('./pages/BetonArmering/ReinforcementCalculator') },
  { path: 'beton-armering/forskalling', toolId: 'beton-armering-forskalling', load: () => import('./pages/BetonArmering/FormworkCalculator') },
  { path: 'beton-armering/blandingsforhold', toolId: 'blandingsforhold', load: () => import('./pages/BetonArmering/MixRatioCalculator') },
  { path: 'beton-armering/fundablokke', toolId: 'beton-armering-fundablokke', load: () => import('./pages/BetonArmering/FoundationBlocksCalculator') },
  { path: 'udgravning-jord/jordvolumen', toolId: 'udgravning-jord-jordvolumen', load: () => import('./pages/UdgravningJord/ExcavationCalculator') },
  { path: 'udgravning-jord/skraaning', toolId: 'udgravning-jord-skraaning', load: () => import('./pages/UdgravningJord/ExcavationSlopeCalculator') },
  { path: 'udgravning-jord/tilbagefyldning', toolId: 'udgravning-jord-tilbagefyldning', load: () => import('./pages/UdgravningJord/BackfillCalculator') },
  { path: 'udgravning-jord/afstivning', load: () => import('./pages/UdgravningJord/TrenchSafetyCalculator') },
  { path: 'pris-budget/projektbudget', load: () => import('./pages/PrisBudget/BudgetCalculator') },
  { path: 'pris-budget/materialeomkostning', load: () => import('./pages/PrisBudget/MaterialCostCalculator') },
  { path: 'pris-budget/arbejdsloen', load: () => import('./pages/PrisBudget/LaborCostCalculator') },
  { path: 'pris-budget/finansiering', load: () => import('./pages/PrisBudget/FinancingCalculator') },
  { path: 'energi-klima/varmetab', toolId: 'energi-klima-varmetab', load: () => import('./pages/EnergiKlima/HeatLossCalculator') },
  { path: 'energi-klima/co2', toolId: 'energi-klima-co2', load: () => import('./pages/EnergiKlima/Co2Calculator') },
  { path: 'energi-klima/dugpunkt', load: () => import('./pages/EnergiKlima/DewPointCalculator') },
  { path: 'trapper/ligeloeb', load: () => import('./pages/Trapper/StairCalculator') },
  { path: 'trapper/vanger', load: () => import('./pages/Trapper/StairStringerCalculator') },
  { path: 'trapper/rampe', load: () => import('./pages/Trapper/RampCalculator') },
  { path: 'trapper/vindeltrappe', load: () => import('./pages/Trapper/SpiralStairCalculator') },
  { path: 'udenomsarealer/fliser', toolId: 'flisebelaegning', load: () => import('./pages/Udenomsarealer/PavingCalculator') },
  { path: 'udenomsarealer/fald', toolId: 'udenomsarealer-fald', load: () => import('./pages/Udenomsarealer/TerrainSlopeCalculator') },
  { path: 'udenomsarealer/hegn', toolId: 'udenomsarealer-hegn', load: () => import('./pages/Udenomsarealer/FenceCalculator') },
  { path: 'udenomsarealer/faskine', load: () => import('./pages/Udenomsarealer/SoakawayCalculator') },
  { path: 'geometri/pythagoras', toolId: 'geometri-pythagoras', load: () => import('./pages/Geometri/PythagorasCalculator') },
  { path: 'geometri/cirkel', toolId: 'geometri-cirkel', load: () => import('./pages/Geometri/CircleCalculator') },
  { path: 'geometri/ar-opmåling', load: () => import('./pages/MeasurementTool') },
];
