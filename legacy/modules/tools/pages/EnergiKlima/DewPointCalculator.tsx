
import React, { useState, useMemo, useCallback } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import type { HelpContent } from '../../components/HelpDrawer';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import AnimatedNumber from '../../components/AnimatedNumber';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import { computeDewPoint, computeGlaser } from '../../catalog';
import type { GlaserLayer } from '../../catalog';
import { InfoHint } from '../../../../components/ui';
import { CheckCircleIcon, AlertTriangleIcon, PlusIcon, TrashIcon } from '../../../../components/icons';

// ── Help content ──────────────────────────────────────────────────────────────

const helpContent: HelpContent = {
  formaal:
    'Beregner dugpunktstemperaturen og vurderer risiko for overfladekondens og skimmelsvamp. ' +
    'Avanceret tilstand tilføjer ISO 13788-baseret månedlig kondensationsrisikovurdering baseret på den mindste overfladetemperatur ' +
    'samt en Glaser-analyse for indvendig (interstitiel) kondens, der fanger kondensering INDE i konstruktionen — noget en ren overfladeberegning ikke kan afsløre.',
  variabler: [
    { name: 'Lufttemperatur', symbol: 'T', unit: '°C', description: 'Rumluftens temperatur.' },
    { name: 'Relativ luftfugtighed', symbol: 'RH', unit: '%', description: 'Luftens vanddampindhold i procent af mætningsindholdet ved samme temperatur.' },
    { name: 'Dugpunktstemperatur', symbol: 'T_d', unit: '°C', description: 'Den temperatur, hvor luften er mættet med vanddamp. Kondens opstår på overflader koldere end T_d.' },
    { name: 'Overfladetemperatur', symbol: 'T_si', unit: '°C', description: 'Den indvendige overfladetemperatur, typisk et hjørne, vindue eller kold ydervæg.' },
    { name: 'Temperaturmargin', symbol: 'ΔT', unit: 'K', description: 'Forskel mellem overfladetemperatur og dugpunkt. Positiv = sikker. Negativ = kondens.' },
    { name: 'Damp­diffusionsmodstandstal', symbol: 'μ', unit: '–', description: 'Hvor meget et materiale bremser vanddamp ift. stillestående luft (μ=1). Damp­spærre μ≈50.000-100.000, beton μ≈70-150, gips μ≈8-10, mineraluld μ≈1.' },
    { name: 'Vanddamptryk', symbol: 'p', unit: 'Pa', description: 'Aktuelt vanddamptryk. Sammenlignes med mætningstrykket p_sat gennem konstruktionen (Glaser). p ≥ p_sat betyder kondens i det snit.' },
  ],
  formel:
    'Magnus-formel:\nα = a×T/(b+T) + ln(RH/100)\nT_d = (b × α) / (a − α)\n\nHvor a = 17,27 og b = 237,7\n\n' +
    'ISO 13788 overfladetemperaturfaktor:\nf_Rsi = (T_si − T_e) / (T_i − T_e)\nf_Rsi,min iht. BR18 = 0,70 (forebygger overfladekondens)\n\n' +
    'Glaser (indvendig kondens):\nSd = μ × d   [ækvivalent luftlagstykkelse]\nTemperatur falder lineært med varmemodstanden R; vanddamptrykket falder lineært med Sd.\nKondens hvor p_aktuel ≥ p_mætning i en grænseflade.',
  antagelser:
    'Magnus-formlen er gyldig i området −40°C til +60°C. ' +
    'Overfladetemperaturen er angivet direkte (basis) eller beregnet ud fra U-værdi og konstruktionstype (avanceret, forenklet). ' +
    'Månedlig analyse antager dansk referenceklima (DS 418 / EN ISO 13788 Annex A). ' +
    'Glaser-metoden er en stationær screeningsmetode (DS/EN ISO 13788) — den regner med konstante rand­betingelser og medregner ikke fugtoptag, kapillarsugning eller transient udtørring. Ved kondensrisiko bør en fuld transient hygrotermisk simulering (fx WUFI) udføres.',
  standarder:
    'DS/EN ISO 13788 – Hygrothermisk ydelse af bygningsdele og bygningselementer – Kondensationsrisiko og fugtvandring\n' +
    'BR18 – Krav til fugtteknisk korrekt byggeri\n' +
    'DS/EN ISO 6946 – Varmemodstand og varmetransmissionskoefficient',
  disclaimer: (
    <span>
      Beregningen er vejledende. Fugtteknisk risikovurdering bør foretages af en bygningsfysiker med certifikat.
    </span>
  ),
};

// ── Danish monthly climate reference (DS 418 / EN ISO 13788 Annex A) ─────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

// Monthly average outdoor temperature °C (Copenhagen)
const MONTHLY_TOUT = [-1.0, -0.5, 2.5, 7.0, 12.0, 15.5, 18.0, 17.5, 13.5, 9.0, 4.5, 0.5];
// Monthly average outdoor RH % (simplified)
const MONTHLY_RH_OUT = [88, 86, 80, 72, 68, 70, 72, 74, 78, 82, 86, 88];

// ── Risk helpers ──────────────────────────────────────────────────────────────

function classifyRisk(surfT: number, dp: number): { status: string; colorClass: string; bgClass: string; msg: string } {
  const diff = surfT - dp;
  if (diff < 0) return { status: 'Kondens!', colorClass: 'text-danger-strong dark:text-danger', bgClass: 'bg-danger-subtle dark:bg-danger-subtle-dark border-danger-border dark:border-danger/30', msg: 'Overfladen er koldere end dugpunktet. Kondens vil opstå.' };
  if (diff < 3) return { status: 'Risiko', colorClass: 'text-warning-strong dark:text-warning', bgClass: 'bg-warning-subtle dark:bg-warning-subtle-dark border-warning-border dark:border-warning/30', msg: 'Overfladen er tæt på dugpunktet. Høj risiko for skimmelsvamp ved langvarig påvirkning.' };
  return { status: 'Ingen risiko', colorClass: 'text-success-strong dark:text-success', bgClass: 'bg-success-subtle dark:bg-success-subtle-dark border-success-border dark:border-success/30', msg: 'Overfladen er varm nok til at undgå kondens.' };
}

// ── Glaser (interstitial) helpers ─────────────────────────────────────────────
// Local saturation-vapour-pressure helper (matches services/calculatorCatalog.ts)
// so the diagram can plot the inner-surface start point consistently.
function satVapourPressurePa(tempC: number): number {
  return tempC >= 0
    ? 610.5 * Math.exp((17.269 * tempC) / (237.3 + tempC))
    : 610.5 * Math.exp((21.875 * tempC) / (265.5 + tempC));
}

const clampPct = (v: number) => Math.min(Math.max(v, 1), 100);

// Editable layer row (string-backed for controlled inputs, inner → outer).
interface GlaserLayerRow {
  name: string;
  thicknessMm: string;
  lambdaWmK: string;
  mu: string;
}

// Sensible 3-layer example build-up (inner → outer).
const DEFAULT_GLASER_LAYERS: GlaserLayerRow[] = [
  { name: 'Gips', thicknessMm: '13', lambdaWmK: '0.25', mu: '10' },
  { name: 'Mineraluld', thicknessMm: '195', lambdaWmK: '0.037', mu: '1' },
  { name: 'Vindspærre', thicknessMm: '9', lambdaWmK: '0.13', mu: '10' },
];

const LAYER_INPUT_CLS =
  'w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-2 py-1.5 text-sm ' +
  'bg-bg dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary ' +
  'focus:ring-2 focus:ring-brand-primary/50 focus:outline-none';

// ── Main component ────────────────────────────────────────────────────────────

const DewPointCalculator: React.FC = () => {
  const [mode, setMode] = useState<CalcMode>('basic');
  const handleModeChange = useCallback((m: CalcMode) => setMode(m), []);

  // Basic inputs
  const [temp, setTemp] = useState('20');
  const [humidity, setHumidity] = useState('50');
  const [surfaceTemp, setSurfaceTemp] = useState('12');

  // Advanced: indoor climate + U-value for monthly analysis
  const [uValue, setUValue] = useState('0.18');
  const [indoorRH, setIndoorRH] = useState('55');

  // Advanced: Glaser interstitial-condensation inputs (design winter conditions)
  const [gIndoorTemp, setGIndoorTemp] = useState('20');
  const [gIndoorRH, setGIndoorRH] = useState('50');
  const [gOutdoorTemp, setGOutdoorTemp] = useState('-5');
  const [gOutdoorRH, setGOutdoorRH] = useState('90');
  const [gLayers, setGLayers] = useState<GlaserLayerRow[]>(DEFAULT_GLASER_LAYERS);

  const updateLayer = useCallback((index: number, field: keyof GlaserLayerRow, value: string) => {
    setGLayers(prev => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }, []);
  const addLayer = useCallback(() => {
    setGLayers(prev => [...prev, { name: 'Nyt lag', thicknessMm: '50', lambdaWmK: '0.04', mu: '1' }]);
  }, []);
  const removeLayer = useCallback((index: number) => {
    setGLayers(prev => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }, []);

  // ── Derived values ──
  const dewPoint = useMemo(() => {
    const T = parseFloat(temp) || 0;
    const RH = Math.min(Math.max(parseFloat(humidity) || 0, 1), 100);
    return computeDewPoint({ tempC: T, relativeHumidityPct: RH }).dewPointC;
  }, [temp, humidity]);

  const risk = useMemo(() => {
    const surfT = parseFloat(surfaceTemp) || 0;
    return classifyRisk(surfT, dewPoint);
  }, [dewPoint, surfaceTemp]);

  // Monthly analysis (advanced)
  const monthlyAnalysis = useMemo(() => {
    const U = parseFloat(uValue) || 0.18;
    const Ti = parseFloat(temp) || 20;
    const RHi = parseFloat(indoorRH) || 55;
    const R_si = 0.13;
    const dpIndoor = computeDewPoint({ tempC: Ti, relativeHumidityPct: RHi }).dewPointC;

    return MONTHS.map((month, i) => {
      const Te = MONTHLY_TOUT[i];
      const dT = Ti - Te;
      // Surface temperature from inside: T_si = T_i - U × R_si × ΔT
      const Tsi = Ti - U * R_si * dT;
      const dpOut = computeDewPoint({ tempC: Te, relativeHumidityPct: MONTHLY_RH_OUT[i] }).dewPointC;
      // Indoor air dewpoint already computed above
      const surfRisk = classifyRisk(Tsi, dpIndoor);
      // f_Rsi factor
      const fRsi = dT > 0 ? (Tsi - Te) / dT : 1;
      return { month, Te, Tsi: Math.round(Tsi * 10) / 10, dpIndoor: Math.round(dpIndoor * 10) / 10, fRsi: Math.round(fRsi * 100) / 100, status: surfRisk.status, colorClass: surfRisk.colorClass };
    });
  }, [temp, indoorRH, uValue]);

  // ── Glaser interstitial-condensation analysis (advanced) ──
  const glaserLayers = useMemo<GlaserLayer[]>(
    () =>
      gLayers.map(l => ({
        name: l.name.trim() || 'Lag',
        thicknessMm: parseFloat(l.thicknessMm) || 0,
        lambdaWmK: parseFloat(l.lambdaWmK) || 0,
        mu: parseFloat(l.mu) || 1,
      })),
    [gLayers]
  );

  const glaser = useMemo(
    () =>
      computeGlaser({
        layers: glaserLayers,
        indoorTempC: parseFloat(gIndoorTemp) || 0,
        indoorRhPct: clampPct(parseFloat(gIndoorRH) || 0),
        outdoorTempC: parseFloat(gOutdoorTemp) || 0,
        outdoorRhPct: clampPct(parseFloat(gOutdoorRH) || 0),
      }),
    [glaserLayers, gIndoorTemp, gIndoorRH, gOutdoorTemp, gOutdoorRH]
  );

  // Build the Glaser diagram points (inner surface + each interface), plotted on
  // the Sd axis so the actual vapour-pressure line is straight and the
  // saturation-pressure line curves — the classic "Glaser-diagram".
  const glaserChart = useMemo(() => {
    const Ti = parseFloat(gIndoorTemp) || 0;
    const RHi = clampPct(parseFloat(gIndoorRH) || 0);
    const pIn = (RHi / 100) * satVapourPressurePa(Ti);
    const layerSd = glaserLayers.map(l => l.mu * (l.thicknessMm / 1000));
    const sdTotal = layerSd.reduce((a, b) => a + b, 0);

    type Pt = { x: number; label: string; sat: number; vap: number; condensation: boolean };
    const pts: Pt[] = [
      { x: 0, label: 'Indvendig overflade', sat: satVapourPressurePa(Ti), vap: pIn, condensation: false },
    ];
    let cum = 0;
    glaser.interfaces.forEach((itf, i) => {
      cum += layerSd[i];
      pts.push({ x: cum, label: itf.name, sat: itf.saturationPa, vap: itf.vapourPa, condensation: itf.condensation });
    });
    const maxPa = Math.max(...pts.map(p => Math.max(p.sat, p.vap)), 1000);
    return { pts, sdTotal, maxPa };
  }, [glaser, glaserLayers, gIndoorTemp, gIndoorRH]);

  const reportData = useMemo<CalculatorReportData>(() => {
    const surfT = parseFloat(surfaceTemp) || 0;
    const margin = surfT - dewPoint;
    const inputs: CalculatorReportData['inputs'] = [
      { label: 'Lufttemperatur', value: temp, unit: '°C' },
      { label: 'Relativ luftfugtighed', value: humidity, unit: '%' },
    ];
    if (mode === 'basic') {
      inputs.push({ label: 'Overfladetemperatur', value: surfaceTemp, unit: '°C' });
    } else {
      inputs.push({ label: 'U-Værdi (konstruktion)', value: uValue, unit: 'W/m²K' });
      inputs.push({ label: 'Indendørs RH (årsgennemsnit)', value: indoorRH, unit: '%' });
    }
    const results: CalculatorReportData['results'] = [
      { label: 'Dugpunktstemperatur', value: dewPoint.toFixed(1), unit: '°C', highlight: true },
    ];
    if (mode === 'basic') {
      results.push({ label: 'Overfladetemperatur', value: surfT.toFixed(1), unit: '°C' });
      results.push({ label: 'Temperaturmargin', value: margin.toFixed(1), unit: 'K' });
      results.push({ label: 'Kondensrisiko', value: risk.status });
    } else {
      results.push({ label: 'Indvendig kondens (Glaser)', value: glaser.condensationRisk ? 'Kondensrisiko i konstruktionen' : 'Ingen kondensrisiko' });
      results.push({ label: 'Mindste margin (p_mæt − p_aktuel)', value: Math.round(glaser.minMarginPa).toString(), unit: 'Pa' });
    }
    return {
      toolName: 'Dugpunkt Beregner',
      category: 'Energi & Klima',
      mode,
      inputs,
      results,
      formula: 'Magnus-formel: α = a×T/(b+T) + ln(RH/100), T_d = (b × α) / (a − α), hvor a = 17,27 og b = 237,7',
      standardsStruktureret: [
        { code: 'DS/EN ISO 13788', note: 'Hygrothermisk ydelse – kondensationsrisiko og fugtvandring' },
        { code: 'BR18', note: 'Krav til fugtteknisk korrekt byggeri' },
        { code: 'DS/EN ISO 6946', note: 'Varmemodstand og varmetransmissionskoefficient' },
      ],
      safetyDisclaimer: 'Beregningen er vejledende. Fugtteknisk risikovurdering bør foretages af en bygningsfysiker med certifikat.',
    };
  }, [mode, temp, humidity, surfaceTemp, uValue, indoorRH, dewPoint, risk.status, glaser.condensationRisk, glaser.minMarginPa]);

  const modeToggle = (
    <CalculatorModeToggle toolId="dew-point" onChange={handleModeChange} className="w-56" />
  );

  return (
    <CalculatorPage
      title="Dugpunktsberegner"
      helpContent={helpContent}
      modeToggle={modeToggle}
      stickyResultLabel="Dugpunkt"
      stickyResult={<><AnimatedNumber value={dewPoint} precision={1} /> °C</>}
      reportData={reportData}
    >
      <div className="grid md:grid-cols-2 gap-6 items-start">
        {/* ── LEFT: inputs ── */}
        <div className="space-y-4">
          <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
            <h3 className="font-bold text-lg text-text-primary dark:text-text-dark-primary">Indeklima</h3>
            <InputField
              label="Lufttemperatur"
              value={temp}
              onChange={e => setTemp(e.target.value)}
              unit="°C"
              info="Rumluftens temperatur."
            />
            <InputField
              label="Relativ Luftfugtighed"
              value={humidity}
              onChange={e => setHumidity(e.target.value)}
              unit="%"
              info="Luftens fugtindhold i %. Typisk 40–60 % indendørs."
            />
            {mode === 'basic' && (
              <InputField
                label="Overfladetemperatur"
                value={surfaceTemp}
                onChange={e => setSurfaceTemp(e.target.value)}
                unit="°C"
                info="Mål den koldeste overflade i rummet, typisk et hjørne eller neden på ruden."
              />
            )}
          </div>

          {mode === 'advanced' && (
            <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
              <h3 className="font-bold text-lg text-text-primary dark:text-text-dark-primary">
                Konstruktionsparametre (ISO 13788)
              </h3>
              <InputField
                label="U-Værdi (konstruktion)"
                value={uValue}
                onChange={e => setUValue(e.target.value)}
                unit="W/m²K"
                info="U-værdien for den koldeste konstruktion, f.eks. ydervæg eller tagkonstruktion."
              />
              <InputField
                label="Indendørs RH (årsgennemsnit)"
                value={indoorRH}
                onChange={e => setIndoorRH(e.target.value)}
                unit="%"
                info="Gennemsnitlig relativ luftfugtighed indendørs over året. Brug 55–65 % for boliger."
              />
              <div className="p-3 bg-info-subtle dark:bg-info-subtle-dark rounded-lg text-xs text-info-strong dark:text-info">
                Månedlig analyse bruger dansk referenceklima (København, DS 418). Overfladetemperatur beregnes som:<br />
                <code>T_si = T_i − U × R_si × ΔT</code> (R_si = 0,13 m²K/W)
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: results ── */}
        <div className="space-y-4">
          <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
            <h3 className="font-bold text-lg text-text-primary dark:text-text-dark-primary">Resultat</h3>
            <ResultDisplay label="Dugpunktstemperatur" value={dewPoint} precision={1} unit="°C" />

            {mode === 'basic' && (
              <>
                <div className={`p-4 rounded-lg border ${risk.bgClass}`}>
                  <h4 className={`font-bold text-lg ${risk.colorClass}`}>{risk.status}</h4>
                  <p className="text-sm mt-1 opacity-90 text-text-primary dark:text-text-dark-primary">{risk.msg}</p>
                  <p className="text-xs mt-2 text-text-secondary dark:text-text-dark-secondary">
                    Overfladetemperatur: <strong>{parseFloat(surfaceTemp).toFixed(1)} °C</strong> &nbsp;|&nbsp;
                    Margin: <strong>{(parseFloat(surfaceTemp) - dewPoint).toFixed(1)} K</strong>
                  </p>
                </div>

                {/* Visual gauge */}
                <div className="bg-bg-subtle dark:bg-bg-dark-surface rounded-lg p-4 border border-border dark:border-border-dark">
                  <p className="text-xs font-bold text-text-secondary dark:text-text-dark-secondary mb-3 uppercase tracking-wide">
                    Temperaturmargin
                  </p>
                  {(() => {
                    const surf = parseFloat(surfaceTemp) || 0;
                    const margin = surf - dewPoint;
                    const maxRange = 20;
                    const clampedMargin = Math.min(Math.max(margin, -maxRange), maxRange);
                    const pct = ((clampedMargin + maxRange) / (2 * maxRange)) * 100;
                    const isOk = margin >= 3;
                    return (
                      <div>
                        <div className="relative h-5 bg-gradient-to-r from-danger via-warning to-success rounded-full overflow-hidden">
                          <div
                            className="absolute top-0 bottom-0 w-1 bg-bg shadow"
                            style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-text-secondary dark:text-text-dark-secondary mt-1">
                          <span>−{maxRange} K (kondens)</span>
                          <span className={`font-bold ${isOk ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                            {margin.toFixed(1)} K
                          </span>
                          <span>+{maxRange} K (sikkert)</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </>
            )}
          </div>

          {/* Monthly table (advanced) */}
          {mode === 'advanced' && (
            <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark">
              <h3 className="font-bold text-lg mb-3 text-text-primary dark:text-text-dark-primary">
                Månedlig Kondensationsrisiko (ISO 13788)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border dark:border-border-dark">
                      <th className="text-left py-1 pr-2 text-text-secondary dark:text-text-dark-secondary">Måned</th>
                      <th className="text-right py-1 pr-2 text-text-secondary dark:text-text-dark-secondary">T_ude (°C)</th>
                      <th className="text-right py-1 pr-2 text-text-secondary dark:text-text-dark-secondary">T_si (°C)</th>
                      <th className="text-right py-1 pr-2 text-text-secondary dark:text-text-dark-secondary">Dugpunkt (°C)</th>
                      <th className="text-right py-1 pr-2 text-text-secondary dark:text-text-dark-secondary">f_Rsi</th>
                      <th className="text-right py-1 text-text-secondary dark:text-text-dark-secondary">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyAnalysis.map(row => (
                      <tr key={row.month} className="border-b border-border dark:border-border-dark/50 hover:bg-bg-subtle dark:hover:bg-bg-dark-muted/30">
                        <td className="py-1 pr-2 font-medium text-text-primary dark:text-text-dark-primary">{row.month}</td>
                        <td className="text-right py-1 pr-2 text-text-primary dark:text-text-dark-primary">{row.Te.toFixed(1)}</td>
                        <td className="text-right py-1 pr-2 text-text-primary dark:text-text-dark-primary">{row.Tsi}</td>
                        <td className="text-right py-1 pr-2 text-text-primary dark:text-text-dark-primary">{row.dpIndoor}</td>
                        <td className={`text-right py-1 pr-2 font-bold ${row.fRsi >= 0.70 ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                          {row.fRsi}
                        </td>
                        <td className={`text-right py-1 font-bold ${row.colorClass}`}>{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-3">
                f_Rsi ≥ 0,70 iht. BR18 for at forebygge overfladekondens. Beregning baseret på dansk referenceklima (DS 418).
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Glaser interstitial-condensation section (advanced, full width) ── */}
      {mode === 'advanced' && (
        <div className="mt-6 bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-5">
          <div>
            <div className="flex items-center gap-1">
              <h3 className="font-bold text-lg text-text-primary dark:text-text-dark-primary">
                Indvendig kondens (Glaser)
              </h3>
              <InfoHint
                title="Glaser-metoden"
                description="Sammenligner det aktuelle vanddamptryk med mætningstrykket i hvert snit gennem konstruktionen (inder → yder). Hvor det aktuelle tryk når op på mætningstrykket, sker der kondens INDE i væggen — noget en ren overfladeberegning ikke kan opdage."
                calculation="Kondens hvor p_aktuel ≥ p_mætning · Sd = μ × d · DS/EN ISO 13788"
              />
            </div>
            <p className="text-sm text-text-secondary dark:text-text-dark-secondary mt-1">
              Screening for kondens inde i konstruktionen under stationære vinterforhold. Angiv indeklima, udeklima og
              lagopbygningen fra den varme (indvendige) side og udad.
            </p>
          </div>

          {/* Climate inputs */}
          <div className="grid grid-cols-2 gap-4">
            <InputField
              label="Indetemperatur"
              value={gIndoorTemp}
              onChange={e => setGIndoorTemp(e.target.value)}
              unit="°C"
              info="Dimensionerende indetemperatur, typisk 20 °C."
            />
            <InputField
              label="Inde RH"
              value={gIndoorRH}
              onChange={e => setGIndoorRH(e.target.value)}
              unit="%"
              info="Indendørs relativ luftfugtighed. 50 % er en typisk designværdi for boliger."
            />
            <InputField
              label="Udetemperatur"
              value={gOutdoorTemp}
              onChange={e => setGOutdoorTemp(e.target.value)}
              unit="°C"
              info="Dimensionerende udetemperatur om vinteren, fx −5 °C for DK."
            />
            <InputField
              label="Ude RH"
              value={gOutdoorRH}
              onChange={e => setGOutdoorRH(e.target.value)}
              unit="%"
              info="Udendørs relativ luftfugtighed om vinteren, typisk 85–90 %."
            />
          </div>

          {/* Layer editor */}
          <div>
            <div className="flex items-center justify-between mb-2 gap-2">
              <span className="flex items-center gap-1 text-sm font-semibold text-text-primary dark:text-text-dark-primary">
                Lagopbygning (inder → yder)
                <InfoHint
                  title="μ — damp­diffusionsmodstandstal"
                  description="Angiver hvor meget et materiale bremser vanddamp ift. stillestående luft (μ=1). Mineraluld μ≈1, gips μ≈8–10, beton μ≈70–150, OSB μ≈150–300, træfiber/vindspærre μ≈5–20, dampspærre (PE-folie) μ≈50.000–100.000."
                  calculation="Sd = μ × d  (ækvivalent luftlagstykkelse i m)"
                />
              </span>
              <button
                type="button"
                onClick={addLayer}
                className="inline-flex items-center gap-1 rounded-lg border border-border-strong dark:border-border-dark-strong px-2.5 py-1.5 text-xs font-semibold text-brand-primary hover:bg-brand-primary/10 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
              >
                <PlusIcon className="w-4 h-4" />
                Tilføj lag
              </button>
            </div>

            <div className="space-y-2">
              {gLayers.map((layer, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border dark:border-border-dark p-3 bg-bg-subtle dark:bg-bg-dark-muted/30 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-bold inline-flex items-center justify-center">
                      {i + 1}
                    </span>
                    <input
                      aria-label={`Lag ${i + 1} materiale`}
                      value={layer.name}
                      onChange={e => updateLayer(i, 'name', e.target.value)}
                      placeholder="Materiale"
                      className={`flex-1 ${LAYER_INPUT_CLS}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeLayer(i)}
                      disabled={gLayers.length <= 1}
                      aria-label={`Fjern lag ${i + 1}`}
                      className="shrink-0 p-1.5 rounded-lg text-text-tertiary dark:text-text-dark-tertiary hover:text-danger hover:bg-danger/10 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-danger/40"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="block">
                      <span className="block text-[11px] text-text-secondary dark:text-text-dark-secondary mb-0.5">Tykkelse (mm)</span>
                      <input
                        inputMode="decimal"
                        aria-label={`Lag ${i + 1} tykkelse i mm`}
                        value={layer.thicknessMm}
                        onChange={e => updateLayer(i, 'thicknessMm', e.target.value)}
                        className={LAYER_INPUT_CLS}
                      />
                    </label>
                    <label className="block">
                      <span className="block text-[11px] text-text-secondary dark:text-text-dark-secondary mb-0.5">λ (W/mK)</span>
                      <input
                        inputMode="decimal"
                        aria-label={`Lag ${i + 1} varmeledningsevne λ`}
                        value={layer.lambdaWmK}
                        onChange={e => updateLayer(i, 'lambdaWmK', e.target.value)}
                        className={LAYER_INPUT_CLS}
                      />
                    </label>
                    <label className="block">
                      <span className="block text-[11px] text-text-secondary dark:text-text-dark-secondary mb-0.5">μ (–)</span>
                      <input
                        inputMode="decimal"
                        aria-label={`Lag ${i + 1} dampmodstandstal μ`}
                        value={layer.mu}
                        onChange={e => updateLayer(i, 'mu', e.target.value)}
                        className={LAYER_INPUT_CLS}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <p className="flex items-start gap-1 text-xs text-text-secondary dark:text-text-dark-secondary mt-2">
              <span>
                Dampspærren (højt μ) hører til på den <strong>varme, indvendige side</strong> af isoleringen. Placeres den
                for langt ude i konstruktionen, fanges fugten på den kolde side og der opstår kondens.
              </span>
              <InfoHint
                title="Dampspærrens placering"
                description="En dampspærre skal sidde på den varme side (indvendigt) af isoleringen, så den standser fugtig indeluft, før den når de kolde lag. Sidder den på den kolde side, kondenserer vanddampen bag spærren. Tommelfingerregel: dampmodstanden skal falde udad (indre lag tættest, ydre lag mest damp­åbne)."
              />
            </p>
          </div>

          {/* Verdict card */}
          <div
            className={`p-5 rounded-card border-l-4 shadow-sm ${
              glaser.condensationRisk
                ? 'bg-danger-subtle border-danger dark:bg-danger-subtle-dark'
                : 'bg-success-subtle border-success dark:bg-success-subtle-dark'
            }`}
          >
            <div className="flex items-start gap-3">
              {glaser.condensationRisk ? (
                <AlertTriangleIcon className="w-6 h-6 text-danger flex-shrink-0" />
              ) : (
                <CheckCircleIcon className="w-6 h-6 text-success flex-shrink-0" />
              )}
              <div className="flex-1">
                <h4 className={`font-bold ${glaser.condensationRisk ? 'text-danger-strong dark:text-danger' : 'text-success-strong dark:text-success'}`}>
                  {glaser.condensationRisk ? 'Kondensrisiko i konstruktionen' : 'Ingen kondensrisiko'}
                </h4>
                <p className={`text-sm mt-0.5 ${glaser.condensationRisk ? 'text-danger-strong dark:text-danger' : 'text-success-strong dark:text-success'}`}>
                  {glaser.condensationRisk
                    ? 'Det aktuelle vanddamptryk når mætningstrykket i mindst én grænseflade. Overvej en tættere dampspærre på den varme side, en mere damp­åben yderside eller en anden lagopbygning.'
                    : `Vanddamptrykket holder sig under mætningstrykket i hele konstruktionen. Mindste margin: ${Math.round(glaser.minMarginPa)} Pa.`}
                </p>
              </div>
            </div>
          </div>

          {/* Glaser diagram (SVG) */}
          <div className="bg-bg-subtle dark:bg-bg-dark-muted/30 rounded-lg p-4 border border-border dark:border-border-dark">
            <div className="flex items-center gap-1 mb-2">
              <h4 className="text-sm font-semibold text-text-secondary dark:text-text-dark-secondary">Glaser-diagram</h4>
              <InfoHint
                title="Glaser-diagram"
                description="Kurverne viser mætningstrykket (p_mætning, følger temperaturen) og det aktuelle vanddamptryk (p_aktuel, falder lineært med dampmodstanden Sd) gennem konstruktionen fra inde (venstre) til ude (højre). Rører den aktuelle linje mætningskurven, er der kondens i det snit (rød markering)."
              />
            </div>
            {(() => {
              const { pts, sdTotal, maxPa } = glaserChart;
              const W = 320, H = 200, padL = 12, padR = 12, padT = 14, padB = 30;
              const plotW = W - padL - padR;
              const plotH = H - padT - padB;
              const denom = sdTotal > 0 ? sdTotal : 1;
              const sx = (x: number) => padL + (x / denom) * plotW;
              const sy = (pa: number) => padT + (1 - pa / maxPa) * plotH;
              const satLine = pts.map(p => `${sx(p.x).toFixed(1)},${sy(p.sat).toFixed(1)}`).join(' ');
              const vapLine = pts.map(p => `${sx(p.x).toFixed(1)},${sy(p.vap).toFixed(1)}`).join(' ');
              return (
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  className="w-full h-auto"
                  role="img"
                  aria-label="Glaser-diagram: mætningstryk mod aktuelt vanddamptryk gennem konstruktionen"
                >
                  {/* Baseline */}
                  <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} className="stroke-border dark:stroke-border-dark" strokeWidth="1" />
                  {/* Layer boundaries */}
                  {pts.slice(1, -1).map((p, i) => (
                    <line key={i} x1={sx(p.x)} y1={padT} x2={sx(p.x)} y2={padT + plotH} className="stroke-border dark:stroke-border-dark" strokeWidth="0.75" strokeDasharray="3 3" />
                  ))}
                  {/* Saturation pressure (curve) */}
                  <polyline points={satLine} fill="none" className="stroke-info" strokeWidth="2" strokeLinejoin="round" />
                  {/* Actual vapour pressure (straight in Sd) */}
                  <polyline points={vapLine} fill="none" className="stroke-brand-primary" strokeWidth="2" strokeLinejoin="round" strokeDasharray="5 3" />
                  {/* Condensation markers */}
                  {pts.map((p, i) => (p.condensation ? <circle key={i} cx={sx(p.x)} cy={sy(p.vap)} r="3.5" className="fill-danger" /> : null))}
                  {/* Axis labels */}
                  <text x={padL} y={H - 8} className="fill-text-tertiary dark:fill-text-dark-tertiary" fontSize="9">Inde (varm)</text>
                  <text x={padL + plotW} y={H - 8} textAnchor="end" className="fill-text-tertiary dark:fill-text-dark-tertiary" fontSize="9">Ude (kold)</text>
                </svg>
              );
            })()}
            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-2 text-xs text-text-secondary dark:text-text-dark-secondary">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-4 h-0.5 bg-info" /> Mætningstryk p_mætning
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-4 border-t-2 border-dashed border-brand-primary" /> Aktuelt tryk p_aktuel
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-danger" /> Kondens
              </span>
            </div>
          </div>

          {/* Interface table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border dark:border-border-dark">
                  <th className="text-left py-1 pr-2 text-text-secondary dark:text-text-dark-secondary">Grænseflade</th>
                  <th className="text-right py-1 pr-2 text-text-secondary dark:text-text-dark-secondary">T (°C)</th>
                  <th className="text-right py-1 pr-2 text-text-secondary dark:text-text-dark-secondary">p_mæt (Pa)</th>
                  <th className="text-right py-1 pr-2 text-text-secondary dark:text-text-dark-secondary">p_aktuel (Pa)</th>
                  <th className="text-right py-1 text-text-secondary dark:text-text-dark-secondary">Margin (Pa)</th>
                </tr>
              </thead>
              <tbody>
                {glaser.interfaces.map((itf, i) => {
                  const margin = itf.saturationPa - itf.vapourPa;
                  return (
                    <tr
                      key={i}
                      className={`border-b border-border dark:border-border-dark/50 ${
                        itf.condensation ? 'bg-danger-subtle dark:bg-danger-subtle-dark' : ''
                      }`}
                    >
                      <td className={`py-1 pr-2 font-medium ${itf.condensation ? 'text-danger-strong dark:text-danger' : 'text-text-primary dark:text-text-dark-primary'}`}>
                        {itf.name}
                      </td>
                      <td className="text-right py-1 pr-2 text-text-primary dark:text-text-dark-primary">{itf.tempC.toFixed(1)}</td>
                      <td className="text-right py-1 pr-2 text-text-primary dark:text-text-dark-primary">{Math.round(itf.saturationPa)}</td>
                      <td className="text-right py-1 pr-2 text-text-primary dark:text-text-dark-primary">{Math.round(itf.vapourPa)}</td>
                      <td className={`text-right py-1 font-bold ${margin <= 0 ? 'text-danger-strong dark:text-danger' : 'text-success-strong dark:text-success'}`}>
                        {Math.round(margin)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-3">
              Positiv margin (p_mæt − p_aktuel) = sikker. Margin ≤ 0 markerer kondens i grænsefladen. Glaser er en
              stationær screeningsmetode iht. DS/EN ISO 13788 — ikke en fuld transient fugtsimulering (fx WUFI).
            </p>
          </div>
        </div>
      )}
    </CalculatorPage>
  );
};

export default DewPointCalculator;
