
import React, { useState, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import type { HelpContent } from '../../components/HelpDrawer';
import AnimatedNumber from '../../components/AnimatedNumber';

const helpContent: HelpContent = {
  formaal:
    'Beregner de kritiske mål til afmærkning og udskæring af trappevanger (stringers). Hypotenuse-metoden bruges til at opmærke trin-udskæringerne korrekt med en tømrervinkel.',
  variabler: [
    { name: 'Stigning (Rise)', symbol: 'r', unit: 'cm', description: 'Lodret trinhøjde pr. trin. BR18: 150–210 mm.' },
    { name: 'Grund (Run)', symbol: 'g', unit: 'cm', description: 'Vandret trindybde ekskl. næse. BR18: 230–370 mm.' },
    { name: 'Vangebredde', symbol: 'b', unit: 'cm', description: 'Total bredde (højde) af vangbrædtet. Typisk 25–30 cm.' },
    { name: 'Diagonal (Hypotenuse)', symbol: 'd', unit: 'cm', description: 'Diagonal trinklæng: √(r² + g²). Angiver skærelængden langs vangen.' },
    { name: 'Halsmål (Throat)', symbol: 'T', unit: 'cm', description: 'Mindste resterende trætykkelse efter udskæring (fra indre hjørne vinkelret på rakelinjen). Skal normalt være ≥ 8–10 cm for bæreevne.' },
    { name: 'Hældningsvinkel', symbol: 'α', unit: '°', description: 'arctan(r / g) – trappens hældningsvinkel.' },
  ],
  formel:
    'd = √(r² + g²)   [diagonal pr. trin]\nα = arctan(r / g)   [hældning]\nT ≈ b − (r × g) / d   [halsminimum, vinkelret på rakelinjen]\n\nAfmærkningsteknik (tømrervinkel):\n  Sæt r-mærke på den ene gren og g-mærke på den anden.\n  Placer vinklen langs vangkantet og opmærk trinlinjerne.\n  Gentag for hvert trin opad.',
  standarder:
    'BR18 §64–§67 – Trappers geometri: stigningsforhold, trinhøjde, trinbredde\nBR18 §79–§82 – Ramper og tilgængelighed\nDS/ISO 21542 – Tilgængelighed for bygninger\nDS/EN 14122 – Faste adgangsmidler til maskiner',
  antagelser:
    'Halsmålet (throat) er en geometrisk approksimation og erstatter ikke en statisk beregning. Faktisk bæreevne afhænger af trætræ, spænd og belastning. For store spænd bør en konstruktionsingeniør verificere dimensionerne.',
  disclaimer: (
    <p className="text-xs text-warning-strong dark:text-warning">
      Beregningen er vejledende. Kontrollér altid med producent eller statiker for bæreevne og brandkrav.
    </p>
  ),
};

const StairStringerCalculator: React.FC = () => {
  const [mode, setMode] = useState<CalcMode>('basic');
  const [rise, setRise] = useState('18'); // cm
  const [run, setRun] = useState('25'); // cm
  const [stringerWidth, setStringerWidth] = useState('28'); // cm

  const r = parseFloat(rise) || 18;
  const g = parseFloat(run) || 25;
  const b = parseFloat(stringerWidth) || 28;

  const hypotenuse = Math.sqrt(r * r + g * g);
  const angleDeg = Math.atan(r / g) * (180 / Math.PI);
  const angleRad = Math.atan(r / g);

  // Throat = remaining board width minus the perpendicular distance from the notch's
  // inner corner to the pitch (nosing) line. That distance is (r·g)/d, so T = b − (r·g)/d.
  // (The earlier form b − r·cosα − g·sinα wrongly reduced to b − 2rg/d since cosα=g/d, sinα=r/d.)
  const throatApprox = Math.max(0, b - (r * g) / hypotenuse);

  const formulaValue = 2 * r + g; // Blondel check
  const blondelOk = formulaValue >= 60 && formulaValue <= 64;

  const reportData = useMemo<CalculatorReportData>(() => ({
    toolName: 'Trappestreng',
    category: 'Trapper',
    mode,
    inputs: [
      { label: 'Stigning (Rise) pr. trin', value: r.toFixed(1), unit: 'cm' },
      { label: 'Grund (Run) pr. trin', value: g.toFixed(1), unit: 'cm' },
      ...(mode === 'advanced' ? [{ label: 'Vangebredde', value: b.toFixed(1), unit: 'cm' }] : []),
    ],
    results: [
      { label: 'Diagonal pr. trin (d)', value: hypotenuse.toFixed(1), unit: 'cm', highlight: true },
      { label: 'Hældningsvinkel (α)', value: angleDeg.toFixed(1), unit: '°' },
      { label: 'Blondel (2r+g)', value: formulaValue.toFixed(1), unit: 'cm' },
      ...(mode === 'advanced' ? [{ label: 'Halsmål (approx.)', value: throatApprox.toFixed(1), unit: 'cm' }] : []),
    ],
    formula: 'd = √(r² + g²)   [diagonal pr. trin]\nα = arctan(r / g)   [hældning]\nBlondel: 2r + g = 60–64 cm',
    standardsStruktureret: [
      { code: 'BR18', clause: '§64–§67', note: 'Trappers geometri: stigningsforhold, trinhøjde, trinbredde' },
      { code: 'DS/ISO 21542', note: 'Tilgængelighed for bygninger' },
      { code: 'DS/EN 14122', note: 'Faste adgangsmidler til maskiner' },
    ],
    safetyDisclaimer: 'Beregningen er vejledende. Kontrollér altid med producent eller statiker for bæreevne og brandkrav.',
  }), [mode, r, g, b, hypotenuse, angleDeg, formulaValue, throatApprox]);

  // SVG diagram of stringer cross-section (3 visible steps)
  const Diagram = useMemo(() => {
    const scale = 4.5;
    const steps = 3;
    const padX = 20;
    const padY = 20;
    const svgW = g * steps * scale + padX * 2 + 60;
    const svgH = (r * steps + b) * scale + padY * 2;

    // Bottom-left of stringer (before first step)
    const originX = padX;
    const originY = svgH - padY;

    // Build step profile path (sawtooth upward to the right)
    let d = `M ${originX},${originY}`;
    for (let i = 0; i < steps; i++) {
      d += ` v -${r * scale}`;
      d += ` h ${g * scale}`;
    }
    // close stringer back edge (diagonal)
    const endX = originX + g * steps * scale;
    const endY = originY - r * steps * scale;
    // close stringer back face (diagonal from top-right step corner back to bottom-left)
    d += ` L ${endX - b * Math.sin(angleRad) * scale},${endY + b * Math.cos(angleRad) * scale}`;
    d += ` Z`;

    // Throat indicator line from inner corner of step 1 perpendicular to rake
    const throatStartX = originX;
    const throatStartY = originY - r * scale;
    const throatEndX = throatStartX + throatApprox * Math.sin(angleRad) * scale;
    const throatEndY = throatStartY + throatApprox * Math.cos(angleRad) * scale;

    return (
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full h-auto border border-border dark:border-border-dark rounded-lg bg-bg dark:bg-bg-dark-surface"
      >
        {/* Grid */}
        <defs>
          <pattern id="sg" width="15" height="15" patternUnits="userSpaceOnUse">
            <path d="M 15 0 L 0 0 0 15" fill="none" stroke="#f3f4f6" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#sg)" />

        {/* Stringer body */}
        <path d={d} fill="#fef3c7" stroke="#d97706" strokeWidth="2" strokeLinejoin="round" />

        {/* Diagonal (hypotenuse) per step — first step */}
        <line
          x1={originX}
          y1={originY - r * scale}
          x2={originX + g * scale}
          y2={originY}
          stroke="#6366f1"
          strokeWidth="1.5"
          strokeDasharray="5,3"
        />
        <text
          x={originX + g * scale * 0.45}
          y={originY - r * scale * 0.45}
          fontSize="8"
          fill="#4338ca"
          textAnchor="middle"
          transform={`rotate(${-angleDeg}, ${originX + g * scale * 0.45}, ${originY - r * scale * 0.45})`}
        >
          d = {hypotenuse.toFixed(1)} cm
        </text>

        {/* Rise label */}
        <text x={originX - 14} y={originY - (r * scale) / 2} fontSize="7" fill="#374151" dominantBaseline="middle" textAnchor="middle">
          r={r}
        </text>
        <line x1={originX - 6} y1={originY} x2={originX - 6} y2={originY - r * scale} stroke="#9CA3AF" strokeWidth="1" />

        {/* Run label */}
        <text x={originX + (g * scale) / 2} y={originY + 12} fontSize="7" fill="#374151" textAnchor="middle">
          g={g}
        </text>
        <line x1={originX} y1={originY + 6} x2={originX + g * scale} y2={originY + 6} stroke="#9CA3AF" strokeWidth="1" />

        {/* Throat indicator */}
        <line
          x1={throatStartX}
          y1={throatStartY}
          x2={throatEndX}
          y2={throatEndY}
          stroke="#ef4444"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx={throatStartX} cy={throatStartY} r="3" fill="#ef4444" />
        <text x={throatEndX + 4} y={throatEndY} fontSize="7" fill="#dc2626" dominantBaseline="middle">
          T≈{throatApprox.toFixed(1)}cm
        </text>

        {/* Legend */}
        <text x={svgW - 5} y="12" fontSize="7" fill="#6B7280" textAnchor="end">
          α = {angleDeg.toFixed(1)}°
        </text>
      </svg>
    );
  }, [r, g, b, hypotenuse, angleDeg, angleRad, throatApprox]);

  return (
    <CalculatorPage
      title="Trappevanger (Snit)"
      helpContent={helpContent}
      modeToggle={<CalculatorModeToggle toolId="stair-stringer-calculator" onChange={setMode} />}
      stickyResultLabel="Diagonal pr. trin"
      stickyResult={<><AnimatedNumber value={hypotenuse} precision={1} /> cm</>}
      reportData={reportData}
    >
      <div className="grid md:grid-cols-2 gap-6 items-start">
        {/* LEFT: inputs */}
        <div className="space-y-4">
          <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
            <h3 className="font-bold text-lg text-text-primary dark:text-text-dark-primary">Dimensioner</h3>
            <InputField
              label="Stigning (Rise) pr. trin"
              value={rise}
              onChange={e => setRise(e.target.value)}
              unit="cm"
              info="Den lodrette højde fra overkant trin til overkant næste trin. BR18: 15–21 cm."
            />
            <InputField
              label="Grund (Run) pr. trin"
              value={run}
              onChange={e => setRun(e.target.value)}
              unit="cm"
              info="Den vandrette trædeflade (uden næse). BR18: 23–37 cm."
            />
            {mode === 'advanced' && (
              <InputField
                label="Vangebredde (brædtbredde)"
                value={stringerWidth}
                onChange={e => setStringerWidth(e.target.value)}
                unit="cm"
                info="Total bredde af vangbrædtet. Typisk 25–30 cm. Bruges til at beregne halsmålet (throat)."
              />
            )}
          </div>

          {/* Blondel quick check */}
          <div
            className={`p-3 rounded-lg border-l-4 text-sm ${
              blondelOk
                ? 'bg-success-subtle border-success text-success-strong dark:bg-success-subtle-dark dark:text-success'
                : 'bg-warning-subtle border-warning text-warning-strong dark:bg-warning-subtle-dark dark:text-warning'
            }`}
          >
            <span className="font-semibold">Blondels formel (2r + g): </span>
            {formulaValue.toFixed(1)} cm — {blondelOk ? 'inden for 60–64 cm ✓' : 'udenfor 60–64 cm ⚠'}
          </div>

          {/* Advanced: throat note */}
          {mode === 'advanced' && (
            <div className="bg-bg dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark space-y-2 text-sm">
              <h4 className="font-semibold text-text-primary dark:text-text-dark-primary">Halsmål (Throat)</h4>
              <p className="text-text-secondary dark:text-text-dark-secondary text-xs leading-relaxed">
                Halsmålet er den mindste resterende materialtykkelse i vangen efter udskæring — målt vinkelret på
                rakelinjen fra det indre hjørne. Et lavt halsmål reducerer bæreevnen markant.
              </p>
              <div
                className={`p-2 rounded-lg text-xs font-semibold ${
                  throatApprox >= 8
                    ? 'bg-success-subtle text-success-strong dark:bg-success-subtle-dark dark:text-success'
                    : 'bg-danger-subtle text-danger-strong dark:bg-danger-subtle-dark dark:text-danger'
                }`}
              >
                Halsmål ≈ {throatApprox.toFixed(1)} cm{' '}
                {throatApprox >= 8 ? '— tilstrækkeligt (≥ 8 cm) ✓' : '— for lille! Øg vangebredde eller reducer stigning.'}
              </div>
              <p className="text-text-tertiary dark:text-text-dark-tertiary text-xs">
                Vejledende tommelfingerregel: Halsmål ≥ 8–10 cm for standard bæreevne. Verificeres af konstruktionsingeniør ved store spænd.
              </p>
            </div>
          )}
        </div>

        {/* RIGHT: results + diagram */}
        <div className="space-y-6">
          <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark">
            <h3 className="font-bold text-lg mb-4 text-text-primary dark:text-text-dark-primary">Snit Data</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <ResultDisplay label="Diagonal (d)" value={hypotenuse} precision={1} unit="cm" />
              <ResultDisplay label="Hældningsvinkel" value={angleDeg} precision={1} unit="°" />
              {mode === 'advanced' && (
                <>
                  <ResultDisplay label="Halsmål (approx.)" value={throatApprox} precision={1} unit="cm" />
                  <ResultDisplay label="Blondel (2r+g)" value={formulaValue} precision={1} unit="cm" />
                </>
              )}
            </div>

            <div className="bg-info-subtle dark:bg-info-subtle-dark p-3 rounded-lg text-xs text-info-strong dark:text-info mb-4">
              <p className="font-semibold mb-1">Afmærkningsteknik (tømrervinkel):</p>
              <p>
                Sæt markeringer ved <strong>{r} cm</strong> på den ene gren og <strong>{g} cm</strong> på den anden
                gren af vinklen. Placer vinklen langs vangkantens oversiden og opmærk trinlinjerne. Gentag for hvert
                trin opad. Diagonalen pr. trin er <strong>{hypotenuse.toFixed(1)} cm</strong>.
              </p>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold text-sm mb-2 text-text-secondary dark:text-text-dark-secondary">
                Vangens profil (3 trin, illustrativt)
              </h4>
              {Diagram}
            </div>
          </div>
        </div>
      </div>
    </CalculatorPage>
  );
};

export default StairStringerCalculator;
