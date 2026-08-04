import React, { useState, useMemo, useRef } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import CalculatorModeToggle, { type CalcMode } from '../../components/CalculatorModeToggle';
import InputField from '../../components/InputField';
import AnimatedNumber from '../../components/AnimatedNumber';
import { ResultBar } from '../../components/ResultGauge';
import BreakdownDonut from '../../components/viz/BreakdownDonut';
import { computeLoanAmortization } from '../../catalog';
import type { HelpContent, CalculatorReportData } from '../../components/CalculatorPage';
import { useToolAccess } from '../../../../contexts/ToolAccessProvider';
import { useSubscription } from '../../../../contexts/SubscriptionContext';
import ConfirmDialog from '../../../../components/ui/ConfirmDialog';

const HELP: HelpContent = {
  formaal:
    'Beregner månedlig ydelse, samlede renter og ÅOP for annuitetslån (realkreditlån og banklån). ' +
    'Avanceret tilstand inkluderer administrationsbidrag i ÅOP-beregningen.',
  variabler: [
    { name: 'Boligpris', symbol: 'P', unit: 'kr.', description: 'Den samlede købesum eller det ønskede lånebeløb.' },
    { name: 'Udbetaling', symbol: 'dp', unit: '%', description: 'Min. 5% af købesummen kræves typisk i Danmark.' },
    { name: 'Nominel rente', symbol: 'r', unit: '% p.a.', description: 'Den aftalte rentesats. Realkreditlån: 2–6%. Banklån: 4–12%.' },
    { name: 'Løbetid', symbol: 'n', unit: 'år', description: 'Typisk 20–30 år for realkreditlån.' },
    { name: 'Administrationsbidrag', symbol: 'AF', unit: 'kr./år', description: 'Årligt bidrag til realkreditinstituttet (kun avanceret). Typisk 0,4–0,8% af restgæld.' },
  ],
  formel:
    'Lånebeløb = Købesum × (1 − dp%)\n' +
    'Månedlig ydelse = L × r_md × (1+r_md)^n / ((1+r_md)^n − 1)\n' +
    'Samlede renter = Ydelse × n_måneder − Lånebeløb\n' +
    'ÅOP løses numerisk (Newton-Raphson) inkl. bidrag',
  antagelser:
    'Annuitetslån med konstant ydelse. Variabelt forrentede lån kan give anden ydelse. ' +
    'Skattefradrag for renteudgifter (ca. 33%) er ikke medregnet.',
  standarder:
    'ÅOP (Årlig Omkostning i Procent) defineret i kreditaftaleloven og realkreditloven. ' +
    'Min. 5% udbetaling iht. bekendtgørelse om god skik for boligkredit.',
};

const FinancingCalculator: React.FC = () => {
  const { advancedAllowed } = useToolAccess('finansiering');
  const { upgradeTo } = useSubscription();
  const [mode, setMode] = useState<CalcMode>('basic');
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const infographicRef = useRef<HTMLDivElement>(null);
  const [principal, setPrincipal] = useState('1500000');
  const [downPct, setDownPct] = useState('5');
  const [rate, setRate] = useState('4.5');
  const [years, setYears] = useState('25');
  const [adminFee, setAdminFee] = useState('0');

  const result = useMemo(() => computeLoanAmortization({
    principal: parseFloat(principal) || 0,
    downPaymentPct: parseFloat(downPct) || 0,
    annualRatePct: parseFloat(rate) || 0,
    termYears: parseFloat(years) || 0,
    annualAdminFeeKr: mode === 'advanced' ? (parseFloat(adminFee) || 0) : 0,
  }), [principal, downPct, rate, years, adminFee, mode]);

  const maxBar = (parseFloat(principal) || 1);

  const donutSegments = result.loan > 0 ? [
    { label: 'Udbetaling', value: result.downPayment, color: '#10b981' },
    { label: 'Lånebeløb', value: result.loan, color: '#3b82f6' },
    { label: 'Samlede renter', value: result.totalInterest, color: '#f97316' },
  ] : [];

  const reportData = useMemo<CalculatorReportData>(() => {
    const inputs: CalculatorReportData['inputs'] = [
      { label: 'Boligpris / Lånebeløb', value: principal, unit: 'kr.' },
      { label: 'Udbetaling', value: downPct, unit: '%' },
      { label: 'Nominel rente (p.a.)', value: rate, unit: '%' },
      { label: 'Løbetid', value: years, unit: 'år' },
    ];
    if (mode === 'advanced') {
      inputs.push({ label: 'Administrationsbidrag', value: adminFee, unit: 'kr./år' });
    }
    const results: CalculatorReportData['results'] = [
      { label: 'Månedlig ydelse', value: result.monthlyPayment.toFixed(0), unit: 'kr.', highlight: true },
      { label: 'Samlede renter', value: result.totalInterest.toFixed(0), unit: 'kr.' },
      { label: 'Samlet betaling', value: result.totalPaid.toFixed(0), unit: 'kr.' },
    ];
    if (mode === 'advanced' && result.aprPct > 0) {
      results.push({ label: 'ÅOP (inkl. bidrag)', value: result.aprPct.toFixed(2), unit: '%' });
    }
    const breakdown: CalculatorReportData['breakdown'] = [
      { label: 'Lånebeløb', value: result.loan.toFixed(0), unit: 'kr.' },
      { label: 'Udbetaling (beløb)', value: result.downPayment.toFixed(0), unit: 'kr.' },
      { label: 'Samlede renter', value: result.totalInterest.toFixed(0), unit: 'kr.' },
    ];
    return {
      toolName: 'Finansiering',
      category: 'Pris & Budget',
      mode,
      inputs,
      results,
      breakdown,
      formula: 'Lånebeløb = Købesum × (1 − dp%)\nMånedlig ydelse = L × r_md × (1+r_md)^n / ((1+r_md)^n − 1)\nSamlede renter = Ydelse × n_måneder − Lånebeløb\nÅOP løses numerisk (Newton-Raphson) inkl. bidrag',
      infographicRef,
    };
  }, [principal, downPct, rate, years, adminFee, mode, result]);

  const shareText = result.monthlyPayment > 0
    ? `Månedlig ydelse: ${result.monthlyPayment.toLocaleString('da-DK', { maximumFractionDigits: 0 })} kr. · Renter i alt: ${result.totalInterest.toLocaleString('da-DK', { maximumFractionDigits: 0 })} kr.`
    : undefined;

  return (
    <>
    <CalculatorPage
      title="Finansieringsberegner"
      stickyResultLabel="Månedlig ydelse"
      stickyResult={
        result.monthlyPayment > 0
          ? <><AnimatedNumber value={result.monthlyPayment} precision={0} /> kr.</>
          : <>—</>
      }
      shareValue={shareText}
      helpContent={HELP}
      reportData={reportData}
      modeToggle={
        <CalculatorModeToggle
          toolId="finansiering"
          advancedLocked={!advancedAllowed}
          onChange={setMode}
          onLockedClick={() => setShowUpgradeDialog(true)}
        />
      }
    >
      <div className="grid md:grid-cols-2 gap-6 items-start p-2">
        {/* ── Inputs ── */}
        <div className="bg-bg dark:bg-bg-dark-surface p-5 rounded-xl border border-border dark:border-border-dark space-y-4">
          <h3 className="font-bold text-base text-text-primary dark:text-text-dark-primary">Låneparametre</h3>

          <InputField
            label="Boligpris / Lånebeløb"
            value={principal}
            onChange={e => setPrincipal(e.target.value)}
            unit="kr."
            info="Den samlede købesum eller det maksimale lånebeløb."
          />
          <InputField
            label="Udbetaling"
            value={downPct}
            onChange={e => setDownPct(e.target.value)}
            unit="%"
            info="Typisk min. 5% af købesummen i Danmark."
          />
          <InputField
            label="Nominel rente (p.a.)"
            value={rate}
            onChange={e => setRate(e.target.value)}
            unit="%"
            info="Realkreditlån: 2–6%. Banklån: 4–12%."
          />
          <InputField
            label="Løbetid"
            value={years}
            onChange={e => setYears(e.target.value)}
            unit="år"
            info="Typisk 20–30 år for realkreditlån."
          />

          {mode === 'advanced' && (
            <InputField
              label="Administrationsbidrag"
              value={adminFee}
              onChange={e => setAdminFee(e.target.value)}
              unit="kr./år"
              info="Typisk 0,4–0,8% af restgæld. Bruges til ÅOP-beregning."
            />
          )}
        </div>

        {/* ── Results ── */}
        <div className="space-y-4">
          {result.monthlyPayment > 0 ? (
            <>
              {/* Key numbers */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-brand-primary/10 dark:bg-brand-primary/20 p-4 rounded-xl border border-brand-primary/20 text-center">
                  <p className="text-xs font-medium text-brand-primary dark:text-brand-light mb-1">Månedlig ydelse</p>
                  <div className="text-2xl font-extrabold text-brand-primary dark:text-brand-light">
                    <AnimatedNumber value={result.monthlyPayment} precision={0} />
                    <span className="text-sm ml-1">kr.</span>
                  </div>
                </div>
                <div className="bg-warning-subtle dark:bg-warning-subtle-dark p-4 rounded-xl border border-warning-border dark:border-warning/30 text-center">
                  <p className="text-xs font-medium text-warning-strong dark:text-warning mb-1">Samlede renter</p>
                  <div className="text-2xl font-extrabold text-warning-strong dark:text-warning">
                    <AnimatedNumber value={result.totalInterest} precision={0} />
                    <span className="text-sm ml-1">kr.</span>
                  </div>
                </div>
              </div>

              {/* ÅOP badge (advanced only) */}
              {mode === 'advanced' && result.aprPct > 0 && (
                <div className="bg-info-subtle dark:bg-info-subtle-dark p-4 rounded-xl border border-info-border dark:border-info/30 text-center">
                  <p className="text-xs font-medium text-info-strong dark:text-info mb-1">ÅOP (inkl. bidrag)</p>
                  <div className="text-2xl font-extrabold text-info-strong dark:text-info">
                    <AnimatedNumber value={result.aprPct} precision={2} />
                    <span className="text-sm ml-1">%</span>
                  </div>
                </div>
              )}

              {/* Bar breakdown */}
              <div className="bg-bg dark:bg-bg-dark-surface p-5 rounded-xl border border-border dark:border-border-dark space-y-4">
                <h3 className="font-bold text-sm uppercase tracking-wide text-text-secondary dark:text-text-dark-secondary">Fordeling</h3>
                <ResultBar value={result.downPayment} max={maxBar} label="Udbetaling" unit="kr." color="green" precision={0} showPct />
                <ResultBar value={result.loan} max={maxBar} label="Lånebeløb" unit="kr." color="blue" precision={0} showPct />
                <ResultBar value={result.totalInterest} max={result.totalPaid} label="Rentebyrde (af total)" unit="kr." color="orange" precision={0} showPct />
              </div>

              {/* Donut + Amortization (captured as infographic for PDF) */}
              <div ref={infographicRef}>
                {donutSegments.length > 0 && (
                  <div className="bg-bg dark:bg-bg-dark-surface p-5 rounded-xl border border-border dark:border-border-dark flex justify-center gap-4 items-center">
                    <BreakdownDonut
                      segments={donutSegments}
                      centerLabel={`${Math.round((result.downPayment + result.loan) / 1000)}k`}
                      centerSubLabel="kr. køb"
                      size={120}
                      className="w-28 h-28 shrink-0"
                    />
                    <div className="space-y-1">
                      {donutSegments.map(s => (
                        <div key={s.label} className="flex items-center gap-2 text-xs">
                          <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: s.color }} />
                          <span className="text-text-secondary dark:text-text-dark-secondary">{s.label}</span>
                          <span className="font-semibold text-text-primary dark:text-text-dark-primary ml-1">
                            {s.value.toLocaleString('da-DK', { maximumFractionDigits: 0 })} kr.
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.yearlyData.length > 0 && (
                  <div className="bg-bg dark:bg-bg-dark-surface p-5 rounded-xl border border-border dark:border-border-dark">
                    <h3 className="font-bold text-sm uppercase tracking-wide text-text-secondary dark:text-text-dark-secondary mb-4">Restgæld over tid</h3>
                    <AmortisationChart data={result.yearlyData} loan={result.loan} />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-xl border border-border dark:border-border-dark text-center text-text-secondary dark:text-text-dark-secondary text-sm">
              Udfyld felterne for at se beregningen.
            </div>
          )}
        </div>
      </div>
    </CalculatorPage>
    <ConfirmDialog
      isOpen={showUpgradeDialog}
      title="Pro-funktion"
      message="Avanceret tilstand kræver Pro-abonnement. Vil du opgradere nu?"
      confirmLabel="Opgrader til Pro"
      onConfirm={() => { upgradeTo('PRO'); setShowUpgradeDialog(false); }}
      onCancel={() => setShowUpgradeDialog(false)}
    />
    </>
  );
};

// ─── SVG Amortisation Chart ───────────────────────────────────────────────────

interface YearlyPoint { year: number; balance: number; cumulativeInterest: number }

const AmortisationChart: React.FC<{ data: YearlyPoint[]; loan: number }> = ({ data, loan }) => {
  if (data.length === 0) return null;

  const W = 300; const H = 120; const PAD = { l: 32, r: 10, t: 10, b: 24 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;

  const maxY = loan;
  const mapX = (i: number) => PAD.l + (i / (data.length - 1)) * iW;
  const mapY = (v: number) => PAD.t + iH - (v / maxY) * iH;

  const balanceLine = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${mapX(i)},${mapY(d.balance)}`).join(' ');
  const areaPath = `${balanceLine} L ${mapX(data.length - 1)},${PAD.t + iH} L ${PAD.l},${PAD.t + iH} Z`;

  const yLabels = [
    { val: loan, label: `${(loan / 1000).toFixed(0)}k` },
    { val: loan / 2, label: `${(loan / 2000).toFixed(0)}k` },
    { val: 0, label: '0' },
  ];

  const xTicks = data.filter(d => d.year % 5 === 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <linearGradient id="amoGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      {yLabels.map(({ val, label }) => (
        <g key={val}>
          <line x1={PAD.l} y1={mapY(val)} x2={W - PAD.r} y2={mapY(val)} stroke="#E5E7EB" strokeWidth="1" />
          <text x={PAD.l - 4} y={mapY(val) + 4} textAnchor="end" fontSize="8" fill="#9CA3AF">{label}</text>
        </g>
      ))}
      <path d={areaPath} fill="url(#amoGrad)" />
      <path d={balanceLine} fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
      {xTicks.map(d => {
        const i = data.indexOf(d);
        return (
          <g key={d.year}>
            <line x1={mapX(i)} y1={PAD.t + iH} x2={mapX(i)} y2={PAD.t + iH + 4} stroke="#9CA3AF" strokeWidth="1" />
            <text x={mapX(i)} y={H - 4} textAnchor="middle" fontSize="8" fill="#9CA3AF">År {d.year}</text>
          </g>
        );
      })}
    </svg>
  );
};

export default FinancingCalculator;
