
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import AnimatedNumber from '../../components/AnimatedNumber';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import type { HelpContent } from '../../components/HelpDrawer';
import { ComplianceMeter } from '../../components/viz';
// NB: This page is a RUN-driven trappeberegner — the user sets the tread depth (grund)
// via the interactive drag-model and the rise is derived from an ideal ~18 cm. The
// catalog's computeStairGeometry is RISE-driven (Blondel derives the run), so it models
// a different tool and is intentionally not used here.
import type { CalculatorReportData } from '../../components/CalculatorPage';
import { CheckCircleIcon, AlertTriangleIcon, RefreshCwIcon } from '../../../../components/icons';

const helpContent: HelpContent = {
  formaal:
    'Dimensionerer trapper og kontrollerer Blondels trappeformel og BR18-krav. Beregner antal trin, stigning, hældning og visualiserer trappens geometri interaktivt.',
  variabler: [
    { name: 'Etagehøjde', symbol: 'H', unit: 'm', description: 'Lodret afstand fra færdigt gulv til færdigt gulv.' },
    { name: 'Stigning', symbol: 'r', unit: 'cm', description: 'Lodret højde pr. trin (rise). BR18: 150–210 mm.' },
    { name: 'Grund', symbol: 'g', unit: 'cm', description: 'Vandret trindybde ekskl. næse (run). BR18: 230–370 mm.' },
    { name: 'Frihøjde', symbol: 'F', unit: 'm', description: 'Lodret fri passage over trinforkant. Min. 2,0 m.' },
    { name: 'Etageadskillelse', symbol: 't', unit: 'm', description: 'Tykkelse af dæk over trappen, bruges til visualisering.' },
  ],
  formel:
    'Blondels formel: 2g + r = 60–64 cm\nAntal trin: n = H / r (afrundet)\nAktuel stigning: r_akt = H / n\nHældning: α = arctan(r / g) < 45°\nTilgængelighed (1:2): g ≥ 2 × r',
  standarder:
    'BR18 §64–§67 – Trappers geometri: stigningsforhold, trinhøjde, trinbredde\nBR18 §79–§82 – Ramper og tilgængelighed\nDS/ISO 21542 – Tilgængelighed for bygninger\nDS/EN 14122 – Faste adgangsmidler til maskiner',
  antagelser:
    'Beregningen antager ensartede trin. Det øverste trin regnes som stueplan (n-1 vandreflader bruges til totallængde). Frihøjden er vejledende og afhænger af hullens placering.',
  disclaimer: (
    <p className="text-xs text-warning-strong dark:text-warning">
      Beregningen er vejledende. Endelig dimensionering skal verificeres af en fagkyndig og godkendes af kommunen.
    </p>
  ),
};

const StairCalculator: React.FC = () => {
  const [mode, setMode] = useState<CalcMode>('basic');
  const [totalHeight, setTotalHeight] = useState('2.6');
  const [desiredRun, setDesiredRun] = useState('0.25');
  const [headroom, setHeadroom] = useState('2.1');
  const [slabThickness, setSlabThickness] = useState('0.3');

  const [results, setResults] = useState({
    numSteps: 0,
    actualRise: 0,
    totalRun: 0,
    stairFormulaResult: 0,
    angle: 0,
    isCompliant: false,
    errorMsg: '',
    accessible: false,
  });

  const [interactiveRun, setInteractiveRun] = useState<number | null>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const initialRunRef = useRef(0);

  const calculate = useCallback((h: number, r: number) => {
    if (h <= 0 || r <= 0) return null;

    const idealRise = 0.18;
    const numSteps = Math.round(h / idealRise);
    const actualRise = h / numSteps;
    const numRuns = numSteps - 1;
    const totalRunLen = numRuns * r;
    const formula = 2 * actualRise * 100 + r * 100;
    const angleRad = Math.atan(actualRise / r);
    const angleDeg = angleRad * (180 / Math.PI);

    let isCompliant = true;
    let errorMsg = '';
    if (formula < 60 || formula > 64) {
      isCompliant = false;
      errorMsg = `Trappeformel (${formula.toFixed(1)} cm) er udenfor 60–64 cm.`;
    }
    if (angleDeg > 45) {
      isCompliant = false;
      errorMsg = `Trappen er for stejl (${angleDeg.toFixed(1)}°).`;
    }
    if (actualRise * 100 < 15 || actualRise * 100 > 21) {
      if (isCompliant) {
        isCompliant = false;
        errorMsg = `Stigning (${(actualRise * 100).toFixed(1)} cm) er udenfor BR18-krav 15–21 cm.`;
      }
    }

    // accessible stair has a gentle slope (~1:2)
    const isAccessibleStair = angleDeg <= 26.57;

    return {
      numSteps,
      actualRise,
      totalRun: totalRunLen,
      stairFormulaResult: formula,
      angle: angleDeg,
      isCompliant,
      errorMsg,
      accessible: isAccessibleStair,
    };
  }, []);

  useEffect(() => {
    const h = parseFloat(totalHeight) || 0;
    const r = interactiveRun !== null ? interactiveRun : parseFloat(desiredRun) || 0;
    const res = calculate(h, r);
    if (res) setResults(res);
  }, [totalHeight, desiredRun, interactiveRun, calculate]);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    isDragging.current = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    dragStartX.current = clientX;
    initialRunRef.current =
      interactiveRun !== null ? interactiveRun : parseFloat(desiredRun) || 0.25;
  };

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const deltaX = clientX - dragStartX.current;
    const sensitivity = 0.0005;
    let newRun = initialRunRef.current + deltaX * sensitivity;
    newRun = Math.max(0.15, Math.min(0.40, newRun));
    setInteractiveRun(newRun);
  }, []);

  const handleDragEnd = useCallback(() => {
    isDragging.current = false;
    if (interactiveRun !== null) {
      setDesiredRun(interactiveRun.toFixed(3));
      setInteractiveRun(null);
    }
  }, [interactiveRun]);

  useEffect(() => {
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('touchmove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchend', handleDragEnd);
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [handleDragMove, handleDragEnd]);

  const Diagram = useMemo(() => {
    const run = interactiveRun !== null ? interactiveRun : parseFloat(desiredRun) || 0.25;
    const rise = results.actualRise;
    const steps = results.numSteps;
    const slabH = parseFloat(slabThickness) || 0.3;

    if (steps <= 0 || run <= 0) return null;

    const scale = 100;
    const svgHeight = parseFloat(totalHeight) * scale + 50;
    const svgWidth = results.totalRun * scale + 100;
    const startX = 50;
    const startY = svgHeight - 50;

    let pathD = `M ${startX},${startY}`;
    for (let i = 0; i < steps; i++) {
      pathD += ` v -${rise * scale}`;
      if (i < steps) {
        pathD += ` h ${run * scale}`;
      }
    }

    const ceilingY = startY - parseFloat(totalHeight) * scale;
    const slabBottomY = ceilingY + slabH * scale;

    return (
      <div
        className="w-full overflow-x-auto bg-bg-subtle rounded-lg border border-border relative cursor-grab active:cursor-grabbing"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <svg
          height={Math.max(300, svgHeight / 3)}
          width="100%"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="xMidYMid meet"
          className="pointer-events-none"
        >
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          <line x1="0" y1={startY} x2={svgWidth} y2={startY} stroke="#374151" strokeWidth="2" />
          <line
            x1="0"
            y1={ceilingY}
            x2={startX + results.totalRun * scale}
            y2={ceilingY}
            stroke="#374151"
            strokeWidth="2"
          />
          <rect
            x={0}
            y={ceilingY}
            width={startX + results.totalRun * scale + 50}
            height={slabH * scale}
            fill="#e5e7eb"
            opacity="0.5"
          />
          <path d={pathD} fill="none" stroke="#1E5FFF" strokeWidth="3" strokeLinejoin="round" />

          <line
            x1={startX}
            y1={startY + 10}
            x2={startX + run * scale}
            y2={startY + 10}
            stroke="#9CA3AF"
            strokeWidth="1"
          />
          <text x={startX + (run * scale) / 2} y={startY + 25} textAnchor="middle" className="text-caption fill-text-secondary">
            {Math.round(run * 100)} cm
          </text>

          <circle cx={startX + results.totalRun * scale} cy={startY} r="8" fill="#FFB020" className="animate-pulse" />
          <text
            x={startX + results.totalRun * scale}
            y={startY + 20}
            textAnchor="middle"
            className="text-caption fill-warning-strong font-bold"
          >
            TRÆK HER
          </text>

          <line
            x1={startX + run * scale}
            y1={startY - rise * scale}
            x2={startX + run * scale}
            y2={slabBottomY}
            stroke="red"
            strokeDasharray="4"
            strokeWidth="1"
            opacity={0.5}
          />
        </svg>
        <div className="absolute top-2 right-2 bg-bg/80 p-2 rounded border border-border text-xs shadow-sm pointer-events-none">
          Interaktiv Model
        </div>
      </div>
    );
  }, [totalHeight, desiredRun, interactiveRun, results, slabThickness, handleDragStart]);

  // Advanced: headroom (frihøjde) check — BR18 §65 requires min. 2,0 m clear passage.
  const headroomOk = results.numSteps > 0 && parseFloat(headroom) >= 2.0;
  // The overall verdict MUST include headroom — a geometry-compliant stair with
  // insufficient frihøjde still fails BR18. (Basic mode uses the passing 2,1 m default.)
  const overallCompliant = results.isCompliant && headroomOk;
  const complianceMsg = !results.isCompliant
    ? results.errorMsg
    : !headroomOk
      ? `Frihøjde (${parseFloat(headroom).toFixed(2)} m) er under BR18-kravet på 2,0 m.`
      : '';
  // Advanced: BR18 stringer width – minimum clear width 1000mm for private, 1200mm for common stairs
  const runCm = (interactiveRun !== null ? interactiveRun : parseFloat(desiredRun) || 0) * 100;

  const reportData: CalculatorReportData = {
    toolName: 'Trappeberegner',
    category: 'Trapper & Adgang',
    mode: mode === 'advanced' ? 'Avanceret' : 'Basis',
    inputs: [
      { label: 'Etagehøjde', value: totalHeight, unit: 'm' },
      { label: 'Ønsket grund (run)', value: desiredRun, unit: 'm' },
      ...(mode === 'advanced' ? [{ label: 'Frihøjde', value: headroom, unit: 'm' }] : []),
    ],
    results: [
      { label: 'Antal trin', value: `${results.numSteps}`, unit: 'stk.', highlight: true },
      { label: 'Aktuel stigning', value: (results.actualRise * 100).toFixed(1), unit: 'cm' },
      { label: 'Total løbelængde', value: results.totalRun.toFixed(2), unit: 'm' },
      { label: 'Hældningsvinkel', value: results.angle.toFixed(1), unit: '°' },
      ...(mode === 'advanced' ? [{ label: 'Frihøjde', value: parseFloat(headroom).toFixed(2), unit: 'm' }] : []),
      { label: 'BR18 godkendt', value: overallCompliant ? 'Ja' : 'Nej' },
    ],
    formula: 'Blondels formel: 2g + r = 60–64 cm\nn = H / r (afrundet)',
    standardsStruktureret: [{ code: 'BR18', clause: '§64–§67', note: 'Trappers geometri: stigningsforhold, trinhøjde, trinbredde.' }],
    safetyDisclaimer: 'Trappeberegning er vejledende. Endelig dimensionering skal verificeres af en fagkyndig og godkendes af kommunen.',
  };

  return (
    <CalculatorPage
      title="Trappeberegner"
      helpContent={helpContent}
      reportData={reportData}
      modeToggle={
        <CalculatorModeToggle toolId="trapper-ligeloeb" onChange={setMode} />
      }
      stickyResultLabel="Antal trin"
      stickyResult={<><AnimatedNumber value={results.numSteps} precision={0} /> trin</>}
    >
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* LEFT: inputs */}
        <div className="space-y-6">
          <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
            <h3 className="font-bold text-lg text-text-primary dark:text-text-dark-primary">Indtast Mål</h3>
            <InputField
              label="Etagehøjde (færdigt gulv til gulv)"
              value={totalHeight}
              onChange={e => setTotalHeight(e.target.value)}
              unit="m"
            />
            <InputField
              label="Ønsket Grund (trindybde)"
              value={desiredRun}
              onChange={e => setDesiredRun(e.target.value)}
              unit="m"
              info="Den vandrette trædeflade minus trinnæse. Typisk 25–30 cm."
            />
            {mode === 'advanced' && (
              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="Frihøjde krav"
                  value={headroom}
                  onChange={e => setHeadroom(e.target.value)}
                  unit="m"
                  info="Lodret afstand fra trinforkant til loftkonstruktion over. Min. 2,0 m (BR18)."
                />
                <InputField
                  label="Etageadskillelse tykkelse"
                  value={slabThickness}
                  onChange={e => setSlabThickness(e.target.value)}
                  unit="m"
                  info="Tykkelsen af dækket over trappen, bruges til at visualisere trappehullet."
                />
              </div>
            )}
          </div>

          {/* Compliance status */}
          <div
            className={`p-4 rounded-lg border-l-4 shadow-sm transition-colors ${
              overallCompliant
                ? 'bg-success-subtle border-success dark:bg-success-subtle-dark'
                : 'bg-danger-subtle border-danger dark:bg-danger-subtle-dark'
            }`}
          >
            <div className="flex items-start gap-3">
              {overallCompliant ? (
                <CheckCircleIcon className="w-6 h-6 text-success flex-shrink-0" />
              ) : (
                <AlertTriangleIcon className="w-6 h-6 text-danger flex-shrink-0" />
              )}
              <div>
                <h4
                  className={`font-bold text-sm ${
                    overallCompliant
                      ? 'text-success-strong dark:text-success'
                      : 'text-danger-strong dark:text-danger'
                  }`}
                >
                  {overallCompliant ? 'Trappen overholder reglerne' : 'Regler overholdes ikke'}
                </h4>
                {!overallCompliant && complianceMsg && (
                  <p className="text-sm mt-1 text-danger-strong dark:text-danger">{complianceMsg}</p>
                )}
                <div className="mt-2 text-xs opacity-80 text-text-primary dark:text-text-dark-primary">
                  <p>Trappeformel: {results.stairFormulaResult.toFixed(1)} cm (Krav: 60–64 cm)</p>
                  <p>Hældning: {results.angle.toFixed(1)}° (Anbefalet: &lt; 45°)</p>
                </div>
              </div>
            </div>
          </div>

          {/* ComplianceMeter for Blondel formula */}
          {results.numSteps > 0 && (
            <div className="bg-bg dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark">
              <h4 className="text-sm font-semibold mb-3 text-text-secondary dark:text-text-dark-secondary">
                Blondels Formel (2g + r)
              </h4>
              <ComplianceMeter
                label="2g + r"
                value={results.stairFormulaResult}
                limit={64}
                min={55}
                max={70}
                unit=" cm"
                decimalPlaces={1}
              />
              <p className="text-xs text-text-tertiary dark:text-text-dark-tertiary mt-1">
                Grøn zone: ≤ 64 cm — acceptabelt interval er 60–64 cm
              </p>
            </div>
          )}

          {/* Advanced: extra checks */}
          {mode === 'advanced' && results.numSteps > 0 && (
            <div className="bg-bg dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark space-y-3">
              <h4 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
                Avancerede BR18-tjek
              </h4>

              {/* Headroom */}
              <div
                className={`flex items-center gap-2 text-sm p-2 rounded-lg ${
                  headroomOk
                    ? 'bg-success-subtle text-success-strong dark:bg-success-subtle-dark dark:text-success'
                    : 'bg-danger-subtle text-danger-strong dark:bg-danger-subtle-dark dark:text-danger'
                }`}
              >
                {headroomOk ? (
                  <CheckCircleIcon className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertTriangleIcon className="w-4 h-4 flex-shrink-0" />
                )}
                <span>
                  Frihøjde: {parseFloat(headroom).toFixed(2)} m{' '}
                  {headroomOk ? '≥ 2,0 m ✓' : '– skal være min. 2,0 m (BR18 §65)'}
                </span>
              </div>

              {/* Accessible stair (1:2 formula: g ≥ 2r not standard — show angle indication) */}
              <div className="text-xs text-text-secondary dark:text-text-dark-secondary bg-info-subtle dark:bg-info-subtle-dark p-2 rounded-lg">
                <span className="font-semibold">Tilgængelig trappe (1:2 formel):</span> For tilgængelighed gælder g ≥ 2 × r
                ({runCm.toFixed(0)} cm ≥ {((results.actualRise || 0) * 200).toFixed(0)} cm?{' '}
                {runCm >= (results.actualRise || 0) * 200 ? '✓ Opfyldt' : '✗ Ikke opfyldt'})
              </div>

              {/* Winder/spiral note */}
              <div className="text-xs text-text-tertiary dark:text-text-dark-tertiary bg-warning-subtle dark:bg-warning-subtle-dark p-2 rounded-lg">
                <span className="font-semibold">OBS – Vindeltrapper / spindeltrapper:</span> BR18 §66 stiller skærpede
                krav til den effektive trinbredde (min. 230 mm målt 400 mm fra det smalle trin). Kontrollér separat.
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: results + diagram */}
        <div className="space-y-6">
          <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark">
            <h3 className="font-bold text-lg mb-4 text-text-primary dark:text-text-dark-primary">Resultat</h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <ResultDisplay label="Antal Trin" value={results.numSteps} precision={0} unit="stk" />
              <ResultDisplay label="Stigning pr. trin" value={results.actualRise * 100} precision={1} unit="cm" />
              <ResultDisplay
                label="Grund pr. trin"
                value={(interactiveRun ?? parseFloat(desiredRun) ?? 0) * 100}
                precision={1}
                unit="cm"
              />
              <ResultDisplay label="Total Længde (i plan)" value={results.totalRun} precision={2} unit="m" />
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-sm text-text-secondary dark:text-text-dark-secondary">
                  Visuelt Design (Træk for at justere)
                </h4>
                <button
                  onClick={() => setDesiredRun('0.25')}
                  className="p-1 hover:bg-bg-muted rounded dark:hover:bg-bg-dark-muted"
                  title="Nulstil"
                >
                  <RefreshCwIcon className="w-4 h-4 text-text-secondary" />
                </button>
              </div>
              {Diagram}
            </div>
          </div>
        </div>
      </div>
    </CalculatorPage>
  );
};

export default StairCalculator;
