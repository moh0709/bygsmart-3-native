
import React, { useState, useMemo, useCallback } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { HelpContent } from '../../components/HelpDrawer';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import AnimatedNumber from '../../components/AnimatedNumber';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import { ComplianceMeter } from '../../components/viz';
import { InfoHint } from '../../../../components/ui';
import { computeUValue, computeHeatLoss, computeAnnualEnergyFrame, STANDARDS_CATALOG } from '../../catalog';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import type { ConstructionLayer } from '../../catalog';
import { PlusIcon, TrashIcon, CheckCircleIcon, AlertTriangleIcon } from '../../../../components/icons';

// ── Types ─────────────────────────────────────────────────────────────────────

type ElementType = 'ydervæg' | 'tag' | 'gulv' | 'vindue';

interface MaterialLayer {
  id: string;
  name: string;
  thicknessMm: number;
  lambdaWmK: number;
  color: string;
}

interface ConstructionElement {
  id: string;
  label: string;
  type: ElementType;
  areaM2: number;
  layers: MaterialLayer[];
  psiCorrection: number; // W/mK – thermal bridge linear transmittance (advanced)
  bridgeLengthM: number; // m  – total linear thermal bridge length
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BR18_LIMITS: Record<ElementType, number> = {
  ydervæg: 0.18,
  tag: 0.10,
  gulv: 0.10,
  vindue: 0.80,
};

/**
 * Indicative reference for the annual net heat demand of transmission + ventilation
 * [kWh/m²/år]. This is NOT the official BR18 energy frame (which via Be18 also
 * includes DHW, building-operation electricity and overheating). It is a loose
 * "lavenergi/BR18-agtig" target for the simplified transmission+ventilation model
 * only, and must be labelled as indicative.
 */
const ENERGY_FRAME_REFERENCE_KWH_M2_YR = 52;

const PRESET_MATERIALS = [
  { name: 'Beton (Tung)',          lambdaWmK: 2.0,   color: '#9ca3af' },
  { name: 'Mursten (Tegl)',        lambdaWmK: 0.6,   color: '#ef4444' },
  { name: 'Letbeton',              lambdaWmK: 0.15,  color: '#d1d5db' },
  { name: 'Mineraluld (Isolering)',lambdaWmK: 0.037, color: '#fef08a' },
  { name: 'PIR Isolering',         lambdaWmK: 0.022, color: '#fdba74' },
  { name: 'Gipsplade',             lambdaWmK: 0.25,  color: '#f3f4f6' },
  { name: 'Træ',                   lambdaWmK: 0.13,  color: '#a16207' },
  { name: 'EPS Polystyren',        lambdaWmK: 0.036, color: '#dbeafe' },
];

const ELEMENT_TYPE_LABELS: Record<ElementType, string> = {
  ydervæg: 'Ydervæg',
  tag: 'Tag',
  gulv: 'Gulv',
  vindue: 'Vindue',
};

const helpContent: HelpContent = {
  formaal:
    'Beregner U-værdien for en bygningskonstruktion lag for lag (ISO 6946) og det resulterende varmetab (DS 418). Avanceret tilstand tilføjer korrektion for kuldebroer (Ψ-værdier) og summering af flere konstruktionselementer.',
  variabler: [
    { name: 'Tykkelse', symbol: 'd', unit: 'mm', description: 'Lagets fysiske tykkelse.' },
    { name: 'Lambda', symbol: 'λ', unit: 'W/mK', description: 'Materialets varmeledningsevne. Lavere = bedre isolering.' },
    { name: 'Varmemodstand (lag)', symbol: 'R', unit: 'm²K/W', description: 'R = d / λ for hvert lag.' },
    { name: 'U-Værdi', symbol: 'U', unit: 'W/m²K', description: 'Total varmetransmissionskoefficient. Lavere = bedre.' },
    { name: 'Varmetab', symbol: 'Q', unit: 'W', description: 'Effektivt varmetab gennem konstruktionen.' },
    { name: 'Kuldebrokorrekion', symbol: 'Ψ', unit: 'W/mK', description: 'Lineær varmetransmissionskoefficient for kuldebroer (avanceret).' },
  ],
  formel:
    'R_total = R_si + Σ(d_i / λ_i) + R_se\nU = 1 / R_total\nQ = U × A × ΔT\n\nMed kuldebro (avanceret):\nU_korr = U + (Ψ × L_bro) / A',
  antagelser:
    'Overflademodstande: R_si = 0,13 m²K/W (indvendig), R_se = 0,04 m²K/W (udvendig) iht. ISO 6946. ' +
    'Beregningen antager homogene, plane lag uden gennemgående termiske broer medmindre kuldebrokorrektion aktiveres.',
  standarder:
    'DS/EN ISO 6946 – U-værdiberegning og varmemodstand\n' +
    'DS 418 – Bygningers varmetab\n' +
    'BR18 §258 – Max U-værdier: ydervæg 0,18 · tag 0,10 · gulv 0,10 · vinduer 0,80 W/m²K',
  disclaimer: (
    <span>
      Beregningen er vejledende. Konstruktive løsninger bør efterses af en bygningsfysiker og dokumenteres iht. BR18.
    </span>
  ),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const newLayerId = () => Date.now().toString() + Math.random().toString(36).slice(2);

const toConstructionLayer = (l: MaterialLayer): ConstructionLayer => ({
  name: l.name,
  lambdaWmK: l.lambdaWmK,
  thicknessMm: l.thicknessMm,
});

const defaultElement = (): ConstructionElement => ({
  id: newLayerId(),
  label: 'Ydervæg',
  type: 'ydervæg',
  areaM2: 10,
  layers: [
    { id: newLayerId(), name: 'Mursten (Tegl)',         thicknessMm: 108, lambdaWmK: 0.6,   color: '#ef4444' },
    { id: newLayerId(), name: 'Mineraluld (Isolering)', thicknessMm: 150, lambdaWmK: 0.037, color: '#fef08a' },
    { id: newLayerId(), name: 'Letbeton',               thicknessMm: 100, lambdaWmK: 0.15,  color: '#d1d5db' },
  ],
  psiCorrection: 0.05,
  bridgeLengthM: 4,
});

// ── Sub-components ────────────────────────────────────────────────────────────

const LayerEditor: React.FC<{
  layers: MaterialLayer[];
  onChange: (layers: MaterialLayer[]) => void;
}> = ({ layers, onChange }) => {
  const addLayer = () => {
    const mat = PRESET_MATERIALS[3];
    onChange([...layers, { id: newLayerId(), name: mat.name, thicknessMm: 100, lambdaWmK: mat.lambdaWmK, color: mat.color }]);
  };
  const update = (id: string, field: keyof MaterialLayer, value: unknown) =>
    onChange(layers.map(l => (l.id === id ? { ...l, [field]: value } : l)));
  const remove = (id: string) => onChange(layers.filter(l => l.id !== id));

  return (
    <div className="space-y-2">
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {layers.map((layer, idx) => (
          <div key={layer.id} className="bg-bg-subtle dark:bg-bg-dark-surface p-3 rounded-lg border border-border dark:border-border-dark">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-sm text-text-primary dark:text-text-dark-primary flex items-center gap-2">
                <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: layer.color }} />
                {idx + 1}. {layer.name}
              </span>
              <button onClick={() => remove(layer.id)} className="text-text-tertiary dark:text-text-dark-tertiary hover:text-danger">
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className="text-xs text-text-secondary dark:text-text-dark-secondary">Tykkelse (mm)</label>
                <input
                  type="number"
                  value={layer.thicknessMm}
                  onChange={e => update(layer.id, 'thicknessMm', parseFloat(e.target.value) || 0)}
                  className="w-full text-sm border rounded p-1 dark:bg-bg-dark-muted dark:border-border-dark-strong dark:text-text-dark-primary"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary dark:text-text-dark-secondary">Lambda (W/mK)</label>
                <input
                  type="number"
                  step="0.001"
                  value={layer.lambdaWmK}
                  onChange={e => update(layer.id, 'lambdaWmK', parseFloat(e.target.value) || 0)}
                  className="w-full text-sm border rounded p-1 dark:bg-bg-dark-muted dark:border-border-dark-strong dark:text-text-dark-primary"
                />
              </div>
            </div>
            <select
              className="w-full text-xs border rounded p-1 bg-bg dark:bg-bg-dark-muted dark:border-border-dark-strong dark:text-text-dark-primary"
              value={PRESET_MATERIALS.some(m => m.name === layer.name) ? layer.name : ''}
              onChange={e => {
                const mat = PRESET_MATERIALS.find(m => m.name === e.target.value);
                if (mat) {
                  update(layer.id, 'name', mat.name);
                  update(layer.id, 'lambdaWmK', mat.lambdaWmK);
                  update(layer.id, 'color', mat.color);
                }
              }}
            >
              <option value="" disabled>Vælg materiale...</option>
              {PRESET_MATERIALS.map(m => (
                <option key={m.name} value={m.name}>{m.name} (λ={m.lambdaWmK})</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <button onClick={addLayer} className="flex items-center text-brand-primary text-sm font-bold">
        <PlusIcon className="w-4 h-4 mr-1" /> Tilføj Lag
      </button>
    </div>
  );
};

// ── Temperature profile diagram ───────────────────────────────────────────────

const TempDiagram: React.FC<{
  layers: MaterialLayer[];
  temperatures: number[];
  tempIn: number;
  tempOut: number;
}> = ({ layers, temperatures, tempIn, tempOut }) => {
  if (layers.length === 0) return null;
  const totalWidthPx = 500;
  const totalThickness = layers.reduce((s, l) => s + l.thicknessMm, 0);
  const scaleX = totalWidthPx / Math.max(totalThickness, 1);
  const height = 180;

  let currentX = 0;
  const layerVisuals = layers.map(layer => {
    const width = layer.thicknessMm * scaleX;
    const el = (
      <g key={layer.id}>
        <rect x={currentX} y={0} width={width} height={height} fill={layer.color} stroke="#374151" strokeWidth="1" />
        <text x={currentX + width / 2} y={height / 2} textAnchor="middle" fontSize="9" fill="#111" opacity={0.5} style={{ writingMode: 'vertical-rl' }}>
          {layer.name}
        </text>
      </g>
    );
    currentX += width;
    return el;
  });

  const tMax = Math.max(...temperatures, tempIn) + 5;
  const tMin = Math.min(...temperatures, tempOut) - 5;
  const tRange = Math.max(tMax - tMin, 1);
  const scaleY = (v: number) => height - ((v - tMin) / tRange) * height;

  let tempX = 0;
  const points = [`0,${scaleY(temperatures[1])}`];
  layers.forEach((layer, i) => {
    tempX += layer.thicknessMm * scaleX;
    points.push(`${tempX},${scaleY(temperatures[i + 2])}`);
  });

  return (
    <div className="w-full overflow-x-auto bg-bg-subtle dark:bg-bg-dark-surface rounded-lg border border-border dark:border-border-dark p-3">
      <svg width="100%" height={height + 30} viewBox={`-50 -10 ${totalWidthPx + 100} ${height + 40}`} preserveAspectRatio="none">
        {layerVisuals}
        <polyline points={points.join(' ')} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
        {temperatures.slice(1).map((t, i) => {
          let xPos = 0;
          if (i === 0) xPos = 0;
          else {
            let acc = 0;
            for (let k = 0; k < i; k++) acc += layers[k].thicknessMm;
            xPos = acc * scaleX;
          }
          return (
            <g key={i}>
              <circle cx={xPos} cy={scaleY(t)} r="4" fill="white" stroke="#3b82f6" strokeWidth="2" />
              <text x={xPos} y={scaleY(t) - 8} textAnchor="middle" fontSize="10" fill="#2563eb" fontWeight="bold">{t.toFixed(1)}°</text>
            </g>
          );
        })}
        <text x={-40} y={height + 20} fontSize="10" fill="#6b7280">Inde</text>
        <text x={totalWidthPx} y={height + 20} fontSize="10" fill="#6b7280">Ude</text>
      </svg>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const HeatLossCalculator: React.FC = () => {
  const [mode, setMode] = useState<CalcMode>('basic');

  // Basic mode: single element (original UI)
  const [layers, setLayers] = useState<MaterialLayer[]>(defaultElement().layers);
  const [elementType, setElementType] = useState<ElementType>('ydervæg');
  const [area, setArea] = useState('10');
  const [tempIn, setTempIn] = useState('20');
  const [tempOut, setTempOut] = useState('-5');

  // Advanced mode: multiple elements + thermal bridges
  const [elements, setElements] = useState<ConstructionElement[]>([defaultElement()]);

  // Advanced mode: annual energy-frame (energiramme) inputs
  const [airChangeRate, setAirChangeRate] = useState('0.5'); // n [1/h]
  const [heatedVolume, setHeatedVolume] = useState('250');   // V [m³]
  const [heatedFloorArea, setHeatedFloorArea] = useState('100'); // A [m²]
  const [degreeDays, setDegreeDays] = useState('2906');      // graddage (DK)
  const [internalGains, setInternalGains] = useState('8');   // kWh/m²/år
  const [solarGains, setSolarGains] = useState('12');        // kWh/m²/år

  const handleModeChange = useCallback((m: CalcMode) => setMode(m), []);

  // ── Basic calculations ──
  const basicResults = useMemo(() => {
    const { Rtotal, uValue, layerResistances } = computeUValue({ layers: layers.map(toConstructionLayer) });
    const dT = (parseFloat(tempIn) || 20) - (parseFloat(tempOut) || -5);
    const { heatLossW } = computeHeatLoss({ uValue, areaM2: parseFloat(area) || 10, deltaT: dT });

    const flux = dT / Math.max(Rtotal, 0.001);
    const R_si = 0.13;
    const temperatures: number[] = [];
    let cur = parseFloat(tempIn) || 20;
    temperatures.push(cur);
    cur -= flux * R_si;
    temperatures.push(cur);
    layerResistances.forEach(r => {
      cur -= flux * r;
      temperatures.push(cur);
    });

    return { uValue, heatLossW, Rtotal, temperatures, flux, dT };
  }, [layers, area, tempIn, tempOut]);

  // ── Advanced calculations ──
  const advancedResults = useMemo(() => {
    return elements.map(el => {
      const { uValue, Rtotal } = computeUValue({ layers: el.layers.map(toConstructionLayer) });
      const dT = (parseFloat(tempIn) || 20) - (parseFloat(tempOut) || -5);
      const psiLoss = (el.psiCorrection * el.bridgeLengthM * dT);
      const { heatLossW } = computeHeatLoss({ uValue, areaM2: el.areaM2, deltaT: dT });
      const totalLossW = heatLossW + psiLoss;
      const uEff = el.areaM2 > 0 ? uValue + (el.psiCorrection * el.bridgeLengthM) / el.areaM2 : uValue;
      return { ...el, uValue, uEff, Rtotal, heatLossW, psiLoss, totalLossW, dT };
    });
  }, [elements, tempIn, tempOut]);

  const totalAdvancedLoss = advancedResults.reduce((s, r) => s + r.totalLossW, 0);

  // ── Annual energy-frame (energiramme) ──
  // Transmission heat-loss coefficient H_T [W/K] = Σ(U·A + Ψ·L) across all elements
  // (thermal bridges included) — reused directly from the multi-element results above.
  const transmissionHTWperK = useMemo(
    () => advancedResults.reduce((s, r) => s + r.uValue * r.areaM2 + r.psiCorrection * r.bridgeLengthM, 0),
    [advancedResults]
  );

  const annualFrame = useMemo(
    () => computeAnnualEnergyFrame({
      transmissionHTWperK,
      ventilationAirChangeRate: parseFloat(airChangeRate) || 0,
      heatedVolumeM3: parseFloat(heatedVolume) || 0,
      heatedFloorAreaM2: parseFloat(heatedFloorArea) || 0,
      degreeDays: parseFloat(degreeDays) || 2906,
      internalGainsKwhM2Yr: parseFloat(internalGains) || 0,
      solarGainsKwhM2Yr: parseFloat(solarGains) || 0,
    }),
    [transmissionHTWperK, airChangeRate, heatedVolume, heatedFloorArea, degreeDays, internalGains, solarGains]
  );

  const energyFramePassed = annualFrame.netHeatDemandKwhM2Yr <= ENERGY_FRAME_REFERENCE_KWH_M2_YR;

  // ── Element CRUD (advanced) ──
  const addElement = () => setElements(prev => [...prev, { ...defaultElement(), id: newLayerId() }]);
  const removeElement = (id: string) => setElements(prev => prev.filter(e => e.id !== id));
  const updateElement = (id: string, patch: Partial<ConstructionElement>) =>
    setElements(prev => prev.map(e => (e.id === id ? { ...e, ...patch } : e)));

  const br18Limit = BR18_LIMITS[elementType];

  // ── Render ────────────────────────────────────────────────────────────────

  const modeToggle = (
    <CalculatorModeToggle toolId="energi-klima-varmetab" onChange={handleModeChange} className="w-56" />
  );

  const reportData: CalculatorReportData = {
    toolName: 'Varmetabsberegner (U-værdi)',
    category: 'Energi & Klima',
    mode: mode === 'advanced' ? 'Avanceret' : 'Basis',
    inputs: [
      { label: 'Elementtype', value: elementType },
      { label: 'Areal', value: area, unit: 'm²' },
      { label: 'Indetemperatur', value: tempIn, unit: '°C' },
      { label: 'Udetemperatur', value: tempOut, unit: '°C' },
      ...(mode === 'advanced' ? [
        { label: 'Luftskifte (n)', value: airChangeRate, unit: '1/h' },
        { label: 'Opvarmet volumen', value: heatedVolume, unit: 'm³' },
        { label: 'Opvarmet etageareal', value: heatedFloorArea, unit: 'm²' },
        { label: 'Graddage', value: degreeDays, unit: 'K·døgn' },
      ] : []),
    ],
    results: [
      { label: 'U-værdi', value: basicResults.uValue.toFixed(3), unit: 'W/m²K', highlight: true },
      { label: 'Varmetab', value: (basicResults.heatLossW / 1000).toFixed(2), unit: 'kW' },
      { label: 'ΔT', value: basicResults.dT.toFixed(1), unit: 'K' },
      ...(mode === 'advanced' ? [
        { label: 'Årligt netto-varmebehov', value: annualFrame.netHeatDemandKwhM2Yr.toFixed(1), unit: 'kWh/m²/år', highlight: true },
        { label: 'Transmissionskoefficient H_T', value: transmissionHTWperK.toFixed(1), unit: 'W/K' },
        { label: 'Ventilationstab H_V', value: annualFrame.ventilationHVWperK.toFixed(1), unit: 'W/K' },
        { label: 'Netto pr. år', value: annualFrame.netHeatDemandKwhYr.toFixed(0), unit: 'kWh/år' },
      ] : []),
    ],
    formula: 'U = 1 / (Rsi + ΣRlayers + Rse)\nQ = U × A × ΔT',
    standardsStruktureret: STANDARDS_CATALOG.energy,
    safetyDisclaimer: 'Varmetabsberegninger er vejledende. BR18 stiller krav til U-værdier for nye bygninger og større renoveringer.',
  };

  return (
    <CalculatorPage
      title="Varmetabsberegner (U-værdi)"
      helpContent={helpContent}
      reportData={reportData}
      modeToggle={modeToggle}
      stickyResultLabel="U-Værdi"
      stickyResult={
        <>
          <AnimatedNumber
            value={mode === 'basic' ? basicResults.uValue : (advancedResults[0]?.uValue ?? 0)}
            precision={3}
          />{' '}
          W/m²K
        </>
      }
    >
      {/* ── Global params ── */}
      <div className="bg-bg dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark">
        <h3 className="font-bold text-sm mb-3 text-text-secondary dark:text-text-dark-secondary uppercase tracking-wide">
          Temperaturparametre
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Temp Inde (°C)" value={tempIn} onChange={e => setTempIn(e.target.value)} unit="" info="Den ønskede rumtemperatur, f.eks. 20-22°C." />
          <InputField label="Temp Ude (°C)" value={tempOut} onChange={e => setTempOut(e.target.value)} unit="" info="Den dimensionerende udetemperatur, f.eks. -12°C for vinter." />
        </div>
      </div>

      {mode === 'basic' ? (
        /* ══ BASIC MODE ══ */
        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <div className="space-y-4">
            {/* Element type + area */}
            <div className="bg-bg dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs font-medium text-text-secondary dark:text-text-dark-secondary">Konstruktionstype</label>
                  <select
                    value={elementType}
                    onChange={e => setElementType(e.target.value as ElementType)}
                    className="w-full mt-1 border-border-strong dark:border-border-dark-strong rounded-md p-2 text-sm bg-bg dark:bg-bg-dark-muted dark:text-text-dark-primary"
                  >
                    {Object.entries(ELEMENT_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <InputField label="Areal (m²)" value={area} onChange={e => setArea(e.target.value)} unit="" info="Arealet af den bygningsdel." />
              </div>
            </div>

            {/* Layers */}
            <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark">
              <h3 className="font-bold text-lg text-text-primary dark:text-text-dark-primary mb-3">
                Konstruktion (Indefra → Ud)
              </h3>
              <LayerEditor layers={layers} onChange={setLayers} />
            </div>
          </div>

          <div className="space-y-4">
            {/* Results */}
            <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark">
              <h3 className="font-bold text-lg mb-4 text-text-primary dark:text-text-dark-primary">Resultat</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <ResultDisplay label="U-Værdi" value={basicResults.uValue} precision={3} unit="W/m²K" />
                <ResultDisplay label="Varmetab" value={basicResults.heatLossW} precision={1} unit="Watt" />
              </div>
              <div className="p-3 bg-info-subtle dark:bg-info-subtle-dark rounded-lg text-sm text-info-strong dark:text-info mb-4">
                Total R-værdi: <strong>{basicResults.Rtotal.toFixed(2)} m²K/W</strong>
              </div>

              {/* ComplianceMeter */}
              <div className="mt-2">
                <p className="text-xs text-text-secondary dark:text-text-dark-secondary mb-1">
                  BR18 krav – {ELEMENT_TYPE_LABELS[elementType]} (max {br18Limit} W/m²K)
                </p>
                <ComplianceMeter
                  label={`U-Værdi – ${ELEMENT_TYPE_LABELS[elementType]}`}
                  value={Math.round(basicResults.uValue * 1000) / 1000}
                  limit={br18Limit}
                  unit=" W/m²K"
                  decimalPlaces={3}
                  max={br18Limit * 3}
                />
              </div>
            </div>

            {/* Temp profile */}
            <div className="bg-bg dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark">
              <h3 className="font-bold text-lg mb-1 text-text-primary dark:text-text-dark-primary">
                Temperaturprofil (Glaser-kurve)
              </h3>
              <p className="text-xs text-text-secondary dark:text-text-dark-secondary mb-3">
                Stejle fald indikerer god isolering.
              </p>
              <TempDiagram
                layers={layers}
                temperatures={basicResults.temperatures}
                tempIn={parseFloat(tempIn) || 20}
                tempOut={parseFloat(tempOut) || -5}
              />
            </div>
          </div>
        </div>
      ) : (
        /* ══ ADVANCED MODE ══ */
        <div className="space-y-6">
          {elements.map((el, elIdx) => {
            const res = advancedResults[elIdx];
            const limit = BR18_LIMITS[el.type];
            return (
              <div key={el.id} className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark">
                {/* Header */}
                <div className="flex justify-between items-center mb-4">
                  <input
                    value={el.label}
                    onChange={e => updateElement(el.id, { label: e.target.value })}
                    className="font-bold text-lg bg-transparent border-b border-dashed border-border-strong focus:outline-none dark:text-text-dark-primary w-48"
                  />
                  <button onClick={() => removeElement(el.id)} className="text-text-tertiary dark:text-text-dark-tertiary hover:text-danger">
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Left: config */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-text-secondary dark:text-text-dark-secondary">Type</label>
                        <select
                          value={el.type}
                          onChange={e => updateElement(el.id, { type: e.target.value as ElementType })}
                          className="w-full mt-1 border-border-strong dark:border-border-dark-strong rounded-md p-2 text-sm bg-bg dark:bg-bg-dark-muted dark:text-text-dark-primary"
                        >
                          {Object.entries(ELEMENT_TYPE_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-text-secondary dark:text-text-dark-secondary">Areal (m²)</label>
                        <input
                          type="number"
                          value={el.areaM2}
                          onChange={e => updateElement(el.id, { areaM2: parseFloat(e.target.value) || 0 })}
                          className="w-full mt-1 border-border-strong dark:border-border-dark-strong rounded-md p-2 text-sm bg-bg dark:bg-bg-dark-muted dark:text-text-dark-primary"
                        />
                      </div>
                    </div>

                    {/* Thermal bridge */}
                    <div className="bg-warning-subtle dark:bg-warning-subtle-dark rounded-lg p-3 border border-warning-border dark:border-warning/30">
                      <p className="text-xs font-bold text-warning-strong dark:text-warning mb-2">
                        Kuldebrokorrektion (avanceret)
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-text-secondary dark:text-text-dark-secondary">Ψ-værdi (W/mK)</label>
                          <input
                            type="number"
                            step="0.001"
                            value={el.psiCorrection}
                            onChange={e => updateElement(el.id, { psiCorrection: parseFloat(e.target.value) || 0 })}
                            className="w-full text-sm border rounded p-1 mt-1 dark:bg-bg-dark-muted dark:border-border-dark-strong dark:text-text-dark-primary"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-text-secondary dark:text-text-dark-secondary">Broens længde (m)</label>
                          <input
                            type="number"
                            value={el.bridgeLengthM}
                            onChange={e => updateElement(el.id, { bridgeLengthM: parseFloat(e.target.value) || 0 })}
                            className="w-full text-sm border rounded p-1 mt-1 dark:bg-bg-dark-muted dark:border-border-dark-strong dark:text-text-dark-primary"
                          />
                        </div>
                      </div>
                    </div>

                    <LayerEditor
                      layers={el.layers}
                      onChange={newLayers => updateElement(el.id, { layers: newLayers })}
                    />
                  </div>

                  {/* Right: results */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <ResultDisplay label="U-Værdi" value={res?.uValue ?? 0} precision={3} unit="W/m²K" />
                      <ResultDisplay label="U-Værdi (m. bro)" value={res?.uEff ?? 0} precision={3} unit="W/m²K" />
                      <ResultDisplay label="Varmetab (konstruktion)" value={res?.heatLossW ?? 0} precision={1} unit="W" />
                      <ResultDisplay label="Kuldebrotab" value={res?.psiLoss ?? 0} precision={1} unit="W" />
                    </div>
                    <div className="p-3 bg-info-subtle dark:bg-info-subtle-dark rounded-lg text-sm text-info-strong dark:text-info">
                      Totalt varmetab (inkl. kuldebroer): <strong>{(res?.totalLossW ?? 0).toFixed(1)} W</strong>
                    </div>
                    <ComplianceMeter
                      label={`U-Værdi – ${ELEMENT_TYPE_LABELS[el.type]}`}
                      value={Math.round((res?.uEff ?? 0) * 1000) / 1000}
                      limit={limit}
                      unit=" W/m²K"
                      decimalPlaces={3}
                      max={limit * 3}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          <button onClick={addElement} className="flex items-center text-brand-primary font-bold text-sm">
            <PlusIcon className="w-4 h-4 mr-1" /> Tilføj Konstruktionselement
          </button>

          {/* Total */}
          <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border-2 border-brand-primary">
            <h3 className="font-bold text-lg text-text-primary dark:text-text-dark-primary mb-3">
              Samlet Varmetab
            </h3>
            <ResultDisplay label="Total varmetab (alle elementer)" value={totalAdvancedLoss} precision={1} unit="W" />
            <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-2">
              Svarende til {(totalAdvancedLoss / 1000).toFixed(2)} kW · ΔT = {advancedResults[0]?.dT.toFixed(0) ?? 25}°C
            </p>
          </div>

          {/* ── Årligt energibehov (energiramme) ── */}
          <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-5">
            <div>
              <div className="flex items-center gap-1">
                <h3 className="font-bold text-lg text-text-primary dark:text-text-dark-primary">
                  Årligt energibehov (energiramme)
                </h3>
                <InfoHint
                  title="Årligt netto-varmebehov"
                  description="Omregner det øjeblikkelige transmissionstab til et årligt varmebehov via graddage og lægger ventilationstabet til. Interne og solare tilskud trækkes fra. Det er den enhed BR18's energiramme udtrykkes i (kWh/m²/år) – i modsætning til det øjeblikkelige W-tal ovenfor."
                  calculation="H_V = 0,34·n·V ; Årligt tab = (H_T+H_V)·graddage·24/1000 ; Netto = brutto − tilskud"
                />
              </div>
              <p className="text-sm text-text-secondary dark:text-text-dark-secondary mt-1">
                Transmissionskoefficienten fra elementerne ovenfor (H_T = ΣU·A inkl. kuldebroer) omregnes til et årligt behov pr. m² opvarmet etageareal.
              </p>
            </div>

            {/* Inputs */}
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Derived transmission coefficient H_T (read-only) */}
              <div className="w-full">
                <label className="flex items-center gap-1 text-sm font-medium text-text-primary dark:text-text-dark-primary mb-1.5">
                  <span>Transmissionskoefficient H_T</span>
                  <InfoHint
                    title="Transmissionskoefficient H_T"
                    description="Summen af U·A for alle konstruktionselementer plus kuldebroernes Ψ·L (W/K). Beregnes automatisk ud fra elementerne ovenfor – juster elementerne for at ændre den. Svarer til ΣU·A fra U-værdi-værktøjet."
                    calculation="H_T = Σ(U · A) + Σ(Ψ · L)   [W/K]"
                  />
                </label>
                <div className="w-full h-11 rounded-control border border-border-strong dark:border-border-dark-strong bg-bg-subtle dark:bg-bg-dark-muted px-3 flex items-center justify-between">
                  <span className="text-base tabular-nums text-text-primary dark:text-text-dark-primary">{transmissionHTWperK.toFixed(1)}</span>
                  <span className="text-label text-text-secondary dark:text-text-dark-secondary">W/K</span>
                </div>
              </div>
              <InputField label="Luftskifte (n)" value={airChangeRate} onChange={e => setAirChangeRate(e.target.value)} unit="1/h" info="Ventilationsraten. Ca. 0,5 /h for et normalt ventileret hus (BR18 min. 0,3 /h). Med varmegenvinding tælles den effektive rate." />
              <InputField label="Opvarmet volumen (V)" value={heatedVolume} onChange={e => setHeatedVolume(e.target.value)} unit="m³" info="Det opvarmede luftvolumen. Bruges i ventilationstabet H_V = 0,34·n·V." />
              <InputField label="Opvarmet etageareal (A)" value={heatedFloorArea} onChange={e => setHeatedFloorArea(e.target.value)} unit="m²" info="Opvarmet etageareal. Resultatet divideres med dette for at få kWh/m²/år." />
              <InputField label="Graddage" value={degreeDays} onChange={e => setDegreeDays(e.target.value)} unit="K·døgn" info="Årlige graddage. DK ≈ 2906 (base 17 °C)." />
              <InputField label="Interne tilskud" value={internalGains} onChange={e => setInternalGains(e.target.value)} unit="kWh/m²·år" info="Varme fra personer, apparater og belysning. Typisk 5–10 kWh/m²/år. Reducerer varmebehovet." />
              <InputField label="Solare tilskud" value={solarGains} onChange={e => setSolarGains(e.target.value)} unit="kWh/m²·år" info="Solindfald gennem vinduer. Typisk 10–20 kWh/m²/år. Reducerer varmebehovet." />
            </div>

            {/* Verdict */}
            <div className={`p-5 rounded-card border-l-4 shadow-sm ${energyFramePassed ? 'bg-success-subtle border-success dark:bg-success-subtle-dark' : 'bg-danger-subtle border-danger dark:bg-danger-subtle-dark'}`}>
              <div className="flex items-start gap-3">
                {energyFramePassed
                  ? <CheckCircleIcon className="w-6 h-6 text-success flex-shrink-0" />
                  : <AlertTriangleIcon className="w-6 h-6 text-danger flex-shrink-0" />}
                <div className="flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className={`text-3xl font-bold ${energyFramePassed ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                      {annualFrame.netHeatDemandKwhM2Yr.toFixed(1)}
                    </span>
                    <span className={`text-sm font-semibold ${energyFramePassed ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                      kWh/m²/år
                    </span>
                    <InfoHint
                      title="Simplificeret estimat – ikke den officielle energiramme"
                      description="Dette er KUN transmissions- og ventilationsvarmebehovet efter en forenklet graddagemetode. Den officielle BR18-energiramme kræver en fuld Be18-beregning, som også medregner varmt brugsvand, el til bygningsdrift og overtemperatur. Brug tallet som pejlemærke, ikke som dokumentation."
                      calculation="Reference 52 kWh/m²/år er vejledende (lavenergi/BR18-agtig) for transmission+ventilation alene."
                    />
                  </div>
                  <p className={`text-sm mt-1 ${energyFramePassed ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                    {energyFramePassed
                      ? `Under den vejledende reference på ${ENERGY_FRAME_REFERENCE_KWH_M2_YR} kWh/m²/år. Bemærk: dette er et forenklet estimat, ikke en Be18-energiramme.`
                      : `Over den vejledende reference på ${ENERGY_FRAME_REFERENCE_KWH_M2_YR} kWh/m²/år. Overvej mere isolering, bedre vinduer eller varmegenvinding. Tallet er et forenklet estimat, ikke en Be18-energiramme.`}
                  </p>
                </div>
              </div>
            </div>

            <ComplianceMeter
              label="Netto-varmebehov vs. reference (indikativ)"
              value={Math.round(annualFrame.netHeatDemandKwhM2Yr * 10) / 10}
              limit={ENERGY_FRAME_REFERENCE_KWH_M2_YR}
              min={0}
              max={Math.max(ENERGY_FRAME_REFERENCE_KWH_M2_YR * 2, Math.ceil(annualFrame.netHeatDemandKwhM2Yr * 1.2))}
              unit=" kWh/m²·år"
              decimalPlaces={0}
            />

            {/* Breakdown */}
            <div className="grid grid-cols-2 gap-3">
              <ResultDisplay label="Transmissionstab (år)" value={annualFrame.transmissionKwhYr} precision={0} unit="kWh/år" />
              <ResultDisplay label="Ventilationstab (år)" value={annualFrame.ventilationKwhYr} precision={0} unit="kWh/år" />
              <ResultDisplay label="Bruttovarmetab (år)" value={annualFrame.grossHeatLossKwhYr} precision={0} unit="kWh/år" />
              <ResultDisplay label="Tilskud (intern + sol)" value={annualFrame.gainsKwhYr} precision={0} unit="kWh/år" />
            </div>

            <div className="p-3 bg-info-subtle dark:bg-info-subtle-dark rounded-lg text-sm text-info-strong dark:text-info flex items-center gap-1 flex-wrap">
              <span>Ventilationstab H_V = <strong>{annualFrame.ventilationHVWperK.toFixed(1)} W/K</strong> · Netto pr. år = <strong>{annualFrame.netHeatDemandKwhYr.toFixed(0)} kWh/år</strong></span>
              <InfoHint
                title="Ventilationstab H_V"
                description="Varmetabet ved at opvarme den udskiftede luft. Afhænger af luftskiftet n og det opvarmede volumen V. Med varmegenvinding (VGV) reduceres det effektive luftskifte, og dermed tabet."
                calculation="H_V = 0,34 · n · V   [W/K]   (0,34 = luftens varmekapacitet i Wh/m³·K)"
              />
            </div>

            <p className="text-xs text-text-tertiary dark:text-text-dark-tertiary leading-relaxed">
              Forenklet estimat efter graddagemetoden. Den officielle BR18-energiramme kræver en fuld Be18-beregning inkl. varmt brugsvand, el til bygningsdrift og overtemperatur og bør udføres af en energikonsulent. Referencen på {ENERGY_FRAME_REFERENCE_KWH_M2_YR} kWh/m²/år er indikativ og dækker kun transmission + ventilation.
            </p>
          </div>
        </div>
      )}
    </CalculatorPage>
  );
};

export default HeatLossCalculator;
