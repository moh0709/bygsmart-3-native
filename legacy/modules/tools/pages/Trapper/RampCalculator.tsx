
import React, { useState, useCallback, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import SegmentedControl from '../../components/SegmentedControl';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import type { HelpContent } from '../../components/HelpDrawer';
import { ComplianceMeter } from '../../components/viz';
import { computeRampLength } from '../../catalog';
import AnimatedNumber from '../../components/AnimatedNumber';

const helpContent: HelpContent = {
  formaal:
    'Beregner rampelængden ud fra højdeforskel og hældningsforhold. Kontrollerer om rampen opfylder BR18-krav til handicaptilgængelighed.',
  variabler: [
    { name: 'Højde', symbol: 'H', unit: 'cm', description: 'Lodret højdeforskel fra start til slut af rampen.' },
    {
      name: 'Hældningsforhold',
      symbol: 'ratio',
      unit: '1:ratio',
      description: 'Forholdet mellem vandret og lodret. 1:20 = 5 % hældning (handicap), 1:12 = 8,3 %, 1:8 = 12,5 %.',
    },
    { name: 'Længde', symbol: 'L', unit: 'm', description: 'Nødvendig vandret rampelængde.' },
  ],
  formel: 'L = H × ratio / 100\nHældning = 100 / ratio  %\n\nEksempel: H = 40 cm, ratio = 20 → L = 8,0 m, hældning = 5 %',
  standarder:
    'BR18 §64–§67 – Trappers geometri: stigningsforhold, trinhøjde, trinbredde\nBR18 §79–§82 – Ramper og tilgængelighed\nDS/ISO 21542 – Tilgængelighed for bygninger\nDS/EN 14122 – Faste adgangsmidler til maskiner',
  antagelser:
    'Beregningen forudsætter en lige rampe med konstant hældning. Kurver og repos er ikke medtaget. Friktion / belægning vurderes separat.',
  disclaimer: (
    <p className="text-xs text-warning-strong dark:text-warning">
      Beregningen er vejledende. Krav til repo, rækværk og belægning skal verificeres med kommunen og en fagkyndig.
    </p>
  ),
};

const RampCalculator: React.FC = () => {
  const [mode, setMode] = useState<CalcMode>('basic');
  const [height, setHeight] = useState('40'); // cm
  const [ratio, setRatio] = useState('20'); // 1:ratio

  const h = parseFloat(height) || 0;
  const r = parseFloat(ratio) || 20;
  const { lengthM, slopePct, accessible } = computeRampLength({ heightCm: h, ratio: r });

  // BR18 §81: a horizontal repos (min. 1800×1800 mm) is required at least every 10 m of
  // ramp run. A long ramp at exactly 1:20 is only accessible IN PRACTICE if these landings
  // are provided — the raw slope check alone is not sufficient. (Vejledende — verificér mod
  // DS 3028 / kommunen; den præcise reposafstand kan afvige projektspecifikt.)
  const intermediateLandings = Math.floor(lengthM / 10);
  const needsLandings = intermediateLandings > 0;
  // Slope OK for wheelchair access AND (no landings needed OR user is informed they must add them)
  const fullyAccessible = accessible && !needsLandings;

  // Advanced: effective slope % for compliance meter
  // Limit: 5% (1:20, full accessible), warn zone up to 8.3% (1:12), danger above 12.5% (1:8)
  const slopeLimit = 5; // accessible limit

  // SVG ramp diagram values
  const svgLength = Math.max(20, Math.min(190, lengthM * 10));
  const svgHeight = Math.max(5, Math.min(38, h * 0.6));

  const reportData = useMemo<CalculatorReportData>(() => ({
    toolName: 'Rampe Beregner',
    category: 'Trapper',
    inputs: [
      { label: 'Højde (H)', value: h.toFixed(0), unit: 'cm' },
      { label: 'Hældningsforhold', value: `1:${r}` },
    ],
    results: [
      { label: 'Nødvendig Længde', value: lengthM.toFixed(2), unit: 'm', highlight: true },
      { label: 'Hældning', value: slopePct.toFixed(1), unit: '%' },
      { label: 'Krævede repos (BR18 §81)', value: `${intermediateLandings}`, unit: 'stk.' },
      { label: 'Tilgængelig (BR18 §79)', value: fullyAccessible ? 'Ja' : (accessible ? 'Kun med repos' : 'Nej') },
    ],
    formula: 'L = H × ratio / 100\nHældning = 100 / ratio  %',
    standardsStruktureret: [
      { code: 'BR18', clause: '§79–§82', note: 'Ramper og tilgængelighed' },
      { code: 'DS/ISO 21542', note: 'Tilgængelighed for bygninger' },
      { code: 'DS/EN 14122', note: 'Faste adgangsmidler til maskiner' },
    ],
    safetyDisclaimer:
      'Beregningen er vejledende. Krav til repo, rækværk og belægning skal verificeres med kommunen og en fagkyndig.',
  }), [h, r, lengthM, slopePct, accessible, fullyAccessible, intermediateLandings]);

  const ratioOptions = [
    { label: '1:20 (Handicap)', value: '20' },
    { label: '1:12 (Kørebane)', value: '12' },
    { label: '1:8 (Maks)', value: '8' },
  ];

  return (
    <CalculatorPage
      title="Rampe Beregner"
      helpContent={helpContent}
      modeToggle={<CalculatorModeToggle toolId="ramp-calculator" onChange={setMode} />}
      stickyResultLabel="Rampelængde"
      stickyResult={<><AnimatedNumber value={lengthM} precision={2} /> m</>}
      reportData={reportData}
    >
      <div className="grid md:grid-cols-2 gap-6 items-start">
        {/* LEFT: inputs */}
        <div className="space-y-4">
          <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
            <h3 className="font-bold text-lg text-text-primary dark:text-text-dark-primary">Indtast Højdeforskel</h3>
            <InputField
              label="Højde (H)"
              value={height}
              onChange={e => setHeight(e.target.value)}
              unit="cm"
              info="Den lodrette højdeforskel fra start til slut af rampen."
            />
            <div>
              <label className="text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1 block">
                Hældning (Ratio)
              </label>
              <SegmentedControl
                options={ratioOptions}
                value={ratio}
                onChange={setRatio}
              />
            </div>
            {mode === 'advanced' && (
              <div className="border-t pt-3 space-y-2 text-sm text-text-secondary dark:text-text-dark-secondary">
                <p className="font-semibold text-text-primary dark:text-text-dark-primary">BR18 Avancerede krav</p>
                <div className={`flex gap-2 items-start p-2 rounded-lg text-xs ${accessible ? 'bg-success-subtle dark:bg-success-subtle-dark text-success-strong dark:text-success' : 'bg-warning-subtle dark:bg-warning-subtle-dark text-warning-strong dark:text-warning'}`}>
                  <span className="text-base leading-none">{accessible ? '✓' : '⚠'}</span>
                  <span>
                    {accessible
                      ? 'Hældningen opfylder 1:20-kravet til kørestolsbrugere (BR18 §79).'
                      : 'Hældning overstiger 1:20. Rampen er ikke tilgængelig for kørestolsbrugere (BR18 §79).'}
                  </span>
                </div>
                <div className="bg-info-subtle dark:bg-info-subtle-dark text-info-strong dark:text-info p-2 rounded-lg text-xs">
                  <span className="font-semibold">Min. fri bredde:</span> 1 500 mm for tilgængelige ramper (BR18 §80).
                  Kontroller at rampebredden er tilstrækkelig.
                </div>
                <div className={`flex gap-2 items-start p-2 rounded-lg text-xs ${needsLandings ? 'bg-warning-subtle dark:bg-warning-subtle-dark text-warning-strong dark:text-warning' : 'bg-info-subtle dark:bg-info-subtle-dark text-info-strong dark:text-info'}`}>
                  <span className="text-base leading-none">{needsLandings ? '⚠' : 'ℹ'}</span>
                  <span>
                    <span className="font-semibold">Repos (vendeareal):</span> BR18 §81 kræver vandret repos på min.
                    1 800 × 1 800 mm ved bund og top samt for hver 10 m rampelængde.
                    {needsLandings
                      ? ` Denne rampe (${lengthM.toFixed(1)} m) kræver mindst ${intermediateLandings} mellemliggende repos — uden dem er rampen ikke tilgængelig i praksis.`
                      : ' Denne rampe er kort nok til ikke at kræve mellemliggende repos.'}
                  </span>
                </div>
                <div className="bg-bg-subtle dark:bg-bg-dark-surface p-2 rounded-lg text-xs text-text-secondary dark:text-text-dark-secondary">
                  <span className="font-semibold">Belægning:</span> DS/ISO 21542 kræver skridsikker overfladestruktur
                  (f.eks. rillet beton eller gummibelægning). Markering ved top og bund anbefales.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: results */}
        <div className="space-y-6">
          <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark">
            <h3 className="font-bold text-lg mb-4 text-text-primary dark:text-text-dark-primary">Resultat</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <ResultDisplay label="Nødvendig Længde" value={lengthM} precision={2} unit="m" />
              <ResultDisplay label="Hældning" value={slopePct} precision={1} unit="%" />
            </div>

            {/* ComplianceMeter for slope */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2 text-text-secondary dark:text-text-dark-secondary">
                Hældningskontrol (tilgængelighed)
              </h4>
              <ComplianceMeter
                label="Hældning"
                value={slopePct}
                limit={slopeLimit}
                min={0}
                max={15}
                unit="%"
                decimalPlaces={1}
              />
              <div className="flex justify-between text-xs mt-1 text-text-tertiary dark:text-text-dark-tertiary">
                <span>Grøn ≤ 5% (1:20, handicap)</span>
                <span>Gul 8,3% (1:12) · Rød &gt; 12,5% (1:8)</span>
              </div>
            </div>

            {/* SVG ramp diagram */}
            <div className="border-t pt-4">
              <h4 className="font-semibold text-sm mb-2 text-text-secondary dark:text-text-dark-secondary">
                Rampe diagram
              </h4>
              <div className="bg-bg-subtle dark:bg-bg-dark-surface p-4 rounded-lg border border-border dark:border-border-dark flex items-center justify-center">
                <svg viewBox="0 0 220 70" className="w-full h-auto max-h-32">
                  {/* Ground line */}
                  <line x1="10" y1="55" x2="210" y2="55" stroke="#9CA3AF" strokeWidth="1" />

                  {/* Ramp triangle */}
                  <polygon
                    points={`10,55 ${10 + svgLength},55 ${10 + svgLength},${55 - svgHeight}`}
                    fill={accessible ? '#d1fae5' : '#fee2e2'}
                    stroke={accessible ? '#059669' : '#dc2626'}
                    strokeWidth="2"
                  />

                  {/* Height arrow */}
                  <line
                    x1={10 + svgLength + 6}
                    y1="55"
                    x2={10 + svgLength + 6}
                    y2={55 - svgHeight}
                    stroke="#6B7280"
                    strokeWidth="1"
                    markerEnd="url(#arr)"
                    markerStart="url(#arr)"
                  />
                  <text x={10 + svgLength + 12} y={55 - svgHeight / 2} fontSize="7" fill="#374151" dominantBaseline="middle">
                    H={h}cm
                  </text>

                  {/* Length label */}
                  <text x={10 + svgLength / 2} y="63" textAnchor="middle" fontSize="8" fill="#374151">
                    L = {lengthM.toFixed(2)} m
                  </text>

                  {/* Slope label */}
                  <text x={10 + svgLength / 2} y={55 - svgHeight / 2 - 2} textAnchor="middle" fontSize="7" fill="#374151">
                    1:{ratio} ({slopePct.toFixed(1)}%)
                  </text>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CalculatorPage>
  );
};

export default RampCalculator;
