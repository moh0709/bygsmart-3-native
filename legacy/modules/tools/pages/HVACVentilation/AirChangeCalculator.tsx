import React, { useState, useEffect, useCallback, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import AnimatedNumber from '../../components/AnimatedNumber';
import CalculatorHero from '../../components/CalculatorHero';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import type { HelpContent } from '../../components/HelpDrawer';
import { ComplianceMeter } from '../../components/viz';

// ── Room presets ──────────────────────────────────────────────────────────────
interface RoomPreset {
  label: string;
  ach: number;
  emoji: string;
  br18: string;
  minAch: number;   // BR18 minimum ACH for compliance check
}

const ROOM_PRESETS: RoomPreset[] = [
  { label: 'Stue',           ach: 1.5,  emoji: '🛋️', br18: 'Min. 0,5 ACH',          minAch: 0.5  },
  { label: 'Soveværelse',    ach: 2,    emoji: '🛏️', br18: 'Min. 0,5 ACH',          minAch: 0.5  },
  { label: 'Kontor',         ach: 4,    emoji: '🖥️', br18: 'Ca. 4–6 ACH',           minAch: 4    },
  { label: 'Badeværelse',    ach: 8,    emoji: '🚿', br18: '15 L/s (≈ 54 m³/h)',    minAch: 6    },
  { label: 'Køkken',         ach: 10,   emoji: '🍳', br18: '20 L/s mekanisk',        minAch: 8    },
  { label: 'Industrihal',    ach: 20,   emoji: '🏭', br18: 'Specifik vurdering',     minAch: 10   },
];

// ── Air quality classification ────────────────────────────────────────────────
interface AirQuality {
  label: string;
  colorClass: string;
  bgClass: string;
  dotClass: string;
}

function classifyAirQuality(ach: number, preset: RoomPreset | undefined): AirQuality {
  if (ach <= 0) return { label: '–', colorClass: 'text-text-tertiary dark:text-text-dark-tertiary', bgClass: 'bg-bg-muted dark:bg-bg-dark-muted', dotClass: 'bg-text-tertiary' };
  if (!preset) {
    if (ach < 0.5) return { label: 'Utilstrækkelig', colorClass: 'text-danger-strong dark:text-danger',      bgClass: 'bg-danger-subtle dark:bg-danger-subtle-dark',     dotClass: 'bg-danger'   };
    if (ach < 2)   return { label: 'Acceptabel',      colorClass: 'text-warning-strong dark:text-warning', bgClass: 'bg-warning-subtle dark:bg-warning-subtle-dark', dotClass: 'bg-warning' };
    return               { label: 'God',              colorClass: 'text-success-strong dark:text-success', bgClass: 'bg-success-subtle dark:bg-success-subtle-dark', dotClass: 'bg-success' };
  }
  const ratio = ach / preset.ach;
  if (ratio < 0.7) return { label: 'Under anbefalet', colorClass: 'text-danger-strong dark:text-danger',      bgClass: 'bg-danger-subtle dark:bg-danger-subtle-dark',     dotClass: 'bg-danger'   };
  if (ratio < 0.9) return { label: 'Marginal',         colorClass: 'text-warning-strong dark:text-warning', bgClass: 'bg-warning-subtle dark:bg-warning-subtle-dark', dotClass: 'bg-warning' };
  if (ratio <= 1.6) return { label: 'Opfylder krav',  colorClass: 'text-success-strong dark:text-success', bgClass: 'bg-success-subtle dark:bg-success-subtle-dark', dotClass: 'bg-success' };
  return { label: 'Overdimensioneret', colorClass: 'text-info-strong dark:text-info', bgClass: 'bg-info-subtle dark:bg-info-subtle-dark', dotClass: 'bg-info' };
}

// ── Help content ─────────────────────────────────────────────────────────────
const helpContent: HelpContent = {
  formaal:
    'Beregner det nødvendige luftflow for et rum baseret på rumvolumen og ønsket luftskifterate (ACH). ' +
    'Bruges til at dimensionere ventilationsanlæg for specifikke rum og verificere overensstemmelse med BR18.',
  variabler: [
    { name: 'Rumvolumen',  symbol: 'V',   unit: 'm³',     description: 'Rummets volumen (Længde × Bredde × Loftshøjde).' },
    { name: 'ACH',         symbol: 'n',   unit: 'gange/t', description: 'Air Changes per Hour – antal gange luften udskiftes i timen.' },
    { name: 'Luftflow',    symbol: 'Q',   unit: 'm³/h',   description: 'Nødvendigt luftflow = V × ACH.' },
  ],
  formel:
    'Q [m³/h] = V [m³] × ACH [gange/t]',
  antagelser:
    'Beregningen antager jævn luftfordeling i rummet og fuld luftudskiftning. I praksis anbefales ' +
    '10–20 % tillæg for ufuldstændig blanding. For vådrum og køkkener gælder BR18 absolutte minimumskrav ' +
    'i L/s som kan være dimensionerende.',
  standarder:
    'BR18 §425–§445 – Ventilationskrav for boliger og erhverv\n' +
    'DS 447 – Ventilationsanlæg og kanaldimensionering\n' +
    'BR18 – Min. 0,3 L/s pr. m² + 7 L/s pr. person (boliger)',
  disclaimer: (
    <span>
      Ventilationsberegninger er vejledende. Ventilationsanlæg skal projekteres og installeres i
      overensstemmelse med BR18 §425–§445 og DS 447. Kontakt en autoriseret ventilationsentreprenør.
    </span>
  ),
};

// ── Component ─────────────────────────────────────────────────────────────────
const AirChangeCalculator: React.FC = () => {
  const [mode, setMode] = useState<CalcMode>('basic');
  const [dims, setDims] = useState({ volume: '30', ach: '2' });
  const [airflow, setAirflow] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState<RoomPreset | null>(null);

  const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
    setDims(prev => ({ ...prev, [field]: e.target.value }));
    if (field === 'ach') setSelectedPreset(null);
  };

  const handlePreset = (preset: RoomPreset) => {
    setSelectedPreset(preset);
    setDims(prev => ({ ...prev, ach: String(preset.ach) }));
  };

  const handleModeChange = useCallback((m: CalcMode) => setMode(m), []);

  useEffect(() => {
    const volume = parseFloat(dims.volume) || 0;
    const ach = parseFloat(dims.ach) || 0;
    setAirflow(volume * ach);
  }, [dims]);

  const achValue = parseFloat(dims.ach) || 0;
  const quality = classifyAirQuality(achValue, selectedPreset ?? undefined);

  // BR18 minimum ACH for compliance meter
  const br18MinAch = selectedPreset?.minAch ?? 0.5;

  // ── Ventilation diagram (preserved + dark mode tokens) ────────────────────
  const VentDiagram = useMemo(() => {
    const arrows = Math.min(Math.max(Math.ceil(achValue / 2), 1), 5);
    return (
      <svg viewBox="0 0 200 118" className="w-full max-h-[110px]">
        <rect x="38" y="18" width="124" height="78" rx="5" fill="#f0fdf4" stroke="#86efac" strokeWidth="1.5" />
        <rect x="82" y="12" width="36" height="12" rx="3" fill="#3b82f6" />
        <text x="100" y="10" textAnchor="middle" fontSize="7" fill="#3b82f6">Tilluft</text>
        <rect x="82" y="94" width="36" height="12" rx="3" fill="#ef4444" />
        <text x="100" y="116" textAnchor="middle" fontSize="7" fill="#ef4444">Afkast</text>
        {Array.from({ length: arrows }, (_, i) => {
          const x = 52 + i * 24;
          return (
            <g key={i} opacity="0.75">
              <line x1={x} y1="28" x2={x} y2="52" stroke="#3b82f6" strokeWidth="1.5" />
              <polygon points={`${x},52 ${x - 3},46 ${x + 3},46`} fill="#3b82f6" />
              <line x1={x + 8} y1="68" x2={x + 8} y2="92" stroke="#ef4444" strokeWidth="1.5" />
              <polygon points={`${x + 8},92 ${x + 5},86 ${x + 11},86`} fill="#ef4444" />
            </g>
          );
        })}
        <text x="100" y="62" textAnchor="middle" fontSize="11" fill="#16a34a" fontWeight="bold">
          <AnimatedNumber value={airflow} precision={0} /> m³/h
        </text>
        <text x="100" y="74" textAnchor="middle" fontSize="8" fill="#64748b">{dims.ach} ACH</text>
      </svg>
    );
  }, [dims, airflow, achValue]);

  const reportData = useMemo<CalculatorReportData>(() => ({
    toolName: 'Luftskifte Beregner',
    category: 'HVAC & Ventilation',
    mode: mode,
    inputs: [
      { label: 'Rumtype', value: selectedPreset ? selectedPreset.label : 'Ikke valgt' },
      { label: 'Rumvolumen', value: dims.volume, unit: 'm³' },
      { label: 'Luftskift pr. Time (ACH)', value: dims.ach, unit: 'gange/t' },
    ],
    results: [
      { label: 'Nødvendigt Luftflow', value: airflow.toFixed(0), unit: 'm³/h', highlight: true },
      { label: 'Luftkvalitet', value: quality.label },
      { label: 'BR18 minimum ACH', value: String(br18MinAch), unit: 'ACH' },
    ],
    formula: 'Q [m³/h] = V [m³] × ACH [gange/t]',
    standardsStruktureret: [
      { code: 'BR18', clause: '§§425–445', note: 'Ventilationskrav for boliger og erhverv' },
      { code: 'DS 447', note: 'Ventilationsanlæg og kanaldimensionering' },
      { code: 'DS/EN 16798-1', note: 'Indeklima og ventilation i bygninger' },
    ],
    safetyDisclaimer:
      'Ventilationsberegninger er vejledende. Ventilationsanlæg skal projekteres og installeres i overensstemmelse med BR18 §425–§445 og DS 447. Kontakt en autoriseret ventilationsentreprenør.',
  }), [mode, selectedPreset, dims, airflow, quality.label, br18MinAch]);

  const modeToggle = (
    <CalculatorModeToggle toolId="air-change" onChange={handleModeChange} />
  );

  return (
    <CalculatorPage
      title="Luftskifte Beregner"
      helpContent={helpContent}
      modeToggle={modeToggle}
      stickyResult={<><AnimatedNumber value={airflow} precision={0} /> m³/t</>}
      reportData={reportData}
    >
      <CalculatorHero
        illustration={VentDiagram}
        hint="BR18 kræver min. 0,5 ACH helårsventilation i boliger, 15 L/s fra badeværelse og 20 L/s fra køkken. Mekanisk ventilation anbefales ved tætte klimaskærme."
        complianceRef="BR18 §425–§445 (Ventilation), DS/EN 16798-1"
        accentFrom="#10b981"
        accentTo="#047857"
        className="mb-4"
      />

      <div className="grid md:grid-cols-2 gap-4 items-start">
        {/* ── Input card ──────────────────────────────────────────────── */}
        <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
          <h3 className="font-bold text-base text-text-primary dark:text-text-dark-primary">
            Rumtype &amp; Luftskift
          </h3>

          {/* Room type quick-select (always visible, richer in advanced) */}
          <div>
            <label className="text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-2 block">
              Rumtype (hurtig valg)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ROOM_PRESETS.map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handlePreset(preset)}
                  className={`py-2.5 px-1 rounded-xl text-xs font-medium border transition-colors flex flex-col items-center gap-0.5 min-h-[64px] ${
                    selectedPreset?.label === preset.label
                      ? 'bg-success text-white border-success shadow-sm'
                      : 'bg-bg-muted dark:bg-bg-dark-muted text-text-secondary dark:text-text-dark-secondary border-border dark:border-border-dark-strong hover:border-success'
                  }`}
                >
                  <span className="text-base">{preset.emoji}</span>
                  <span className="leading-tight text-center font-semibold">{preset.label}</span>
                  <span className="opacity-70 text-caption">{preset.ach} ACH</span>
                </button>
              ))}
            </div>
            {selectedPreset && (
              <p className="text-xs text-success-strong dark:text-success mt-2 pl-1">
                BR18 for {selectedPreset.label}: {selectedPreset.br18}
              </p>
            )}
          </div>

          <InputField
            label="Rumvolumen"
            value={dims.volume}
            onChange={e => handleDimChange(e, 'volume')}
            unit="m³"
            info="Beregn som: Længde × Bredde × Loftshøjde."
          />
          <InputField
            label="Luftskift pr. Time (ACH)"
            value={dims.ach}
            onChange={e => handleDimChange(e, 'ach')}
            unit="gange/t"
            info="Antal gange luften udskiftes i timen. Badeværelse: 6–10, Kontor: 4–6, Stue: 1–2."
          />

          {/* Advanced: CO2 estimation note */}
          {mode === 'advanced' && (
            <div className="pt-2 border-t border-border dark:border-border-dark">
              <div className="p-3 bg-info-subtle dark:bg-info-subtle-dark rounded-xl border border-info-border dark:border-info/30 text-xs text-info-strong dark:text-info leading-snug">
                <strong>CO₂-koncentrationsestimering:</strong> Med {dims.ach} ACH og typisk CO₂-emission
                på 20 L/h pr. person estimeres stationær CO₂-koncentration til ca.{' '}
                <strong>
                  {Math.round(400 + (20000 / ((parseFloat(dims.volume) || 30) * (achValue || 1))))} ppm
                </strong>{' '}
                (udendørsniveau 400 ppm). DS/EN 16798-1 kategori II: ≤ 950 ppm.
              </div>
            </div>
          )}
        </div>

        {/* ── Results ──────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <ResultDisplay
            label="Nødvendigt Luftflow"
            value={airflow}
            unit={<>m<sup>3</sup>/time</>}
          />

          {/* ComplianceMeter: ACH vs BR18 minimum */}
          {achValue > 0 && (
            <div className="bg-bg dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark">
              <p className="text-xs font-medium text-text-secondary dark:text-text-dark-secondary mb-2">
                ACH vs. BR18 minimum ({br18MinAch} ACH)
              </p>
              <ComplianceMeter
                label="Luftskifte"
                value={achValue}
                limit={br18MinAch * 2}   // limit line at 2× min so green zone shows "good range"
                max={Math.max(achValue * 1.5, br18MinAch * 4, 10)}
                unit=" ACH"
                decimalPlaces={1}
              />
              <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">
                {achValue >= br18MinAch
                  ? `✓ ${achValue.toFixed(1)} ACH opfylder BR18-kravet (min. ${br18MinAch} ACH).`
                  : `⚠ ${achValue.toFixed(1)} ACH er under BR18-minimumet på ${br18MinAch} ACH.`}
              </p>
            </div>
          )}

          {/* Air quality classification */}
          {achValue > 0 && (
            <div className={`${quality.bgClass} rounded-xl p-4 border border-current/10`}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${quality.dotClass}`} />
                <span className={`font-bold text-sm ${quality.colorClass}`}>{quality.label}</span>
              </div>
              {selectedPreset ? (
                <p className="text-xs text-text-secondary dark:text-text-dark-secondary leading-snug">
                  Anbefalet for {selectedPreset.label}: {selectedPreset.ach} ACH. BR18: {selectedPreset.br18}.
                </p>
              ) : (
                <p className="text-xs text-text-secondary dark:text-text-dark-secondary leading-snug">
                  Vælg rumtype ovenfor for BR18-specifik vejledning.
                </p>
              )}
            </div>
          )}

          {/* Project hint */}
          <div className="bg-info-subtle dark:bg-info-subtle-dark rounded-xl p-3 border border-info-border dark:border-info/30 flex items-start gap-2.5">
            <svg className="w-4 h-4 text-info-strong dark:text-info mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-xs text-info-strong dark:text-info leading-snug">
              Gem luftflow som indkøb eller opgave og brug det direkte i tilbud via <strong>Gem til Projekt</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Safety disclaimer */}
      <SafetyDisclaimer
        title="Vejledende Ventilationsberegning"
        className="mt-6"
      >
        Ventilationsberegninger er vejledende. Ventilationsanlæg skal projekteres og installeres i
        overensstemmelse med BR18 §425–§445 og DS 447. Kontakt en autoriseret ventilationsentreprenør.
      </SafetyDisclaimer>
    </CalculatorPage>
  );
};

export default AirChangeCalculator;
