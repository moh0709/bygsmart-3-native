
import React, { useState, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { HelpContent, CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import AnimatedNumber from '../../components/AnimatedNumber';
import { ComplianceMeter } from '../../components/viz';
import { InfoHint } from '../../../../components/ui';
import { computeEarthFaultLoop } from '../../catalog';
import { CheckCircleIcon, AlertTriangleIcon } from '../../../../components/icons';

// Trip-current multiplier (× In) that guarantees disconnection within the required time.
const DEVICES = [
    { key: 'mcb-b', label: 'Automatsikring type B (Ia = 5×In)', factor: 5 },
    { key: 'mcb-c', label: 'Automatsikring type C (Ia = 10×In)', factor: 10 },
    { key: 'mcb-d', label: 'Automatsikring type D (Ia = 20×In)', factor: 20 },
    { key: 'fuse-gg', label: 'Smeltesikring gG (Ia ≈ 5×In, vejl.)', factor: 5 },
];

const helpContent: HelpContent = {
    formaal: 'Kontrollerer automatisk afbrydelse ved fejl (DS/HD 60364-4-41): fejlsløjfeimpedansen Zs skal være lav nok til at fejlstrømmen udløser beskyttelsesudstyret inden for den krævede tid (0,4 s for stikkontaktkredse). Beregner fejlstrøm, maks. tilladt Zs og pass/fail.',
    variabler: [
        { name: 'Netspænding', symbol: 'U0', unit: 'V', description: 'Fase-til-jord spænding. TN-system: 230 V.' },
        { name: 'Fejlsløjfeimpedans', symbol: 'Zs', unit: 'Ω', description: 'Målt eller beregnet sløjfeimpedans (fase + beskyttelsesleder).' },
        { name: 'Udløsestrøm', symbol: 'Ia', unit: 'A', description: 'Den strøm der udløser beskyttelsen inden for kravtiden. Ia = faktor × In.' },
        { name: 'Maks. Zs', symbol: 'Zs,max', unit: 'Ω', description: 'Zs,max = U0 / Ia. Zs skal være ≤ denne værdi.' },
    ],
    formel: 'If = U0 / Zs           (fejlstrøm)\nZs,max = U0 / Ia\nKrav: Zs ≤ Zs,max',
    antagelser: 'TN-system med automatisk afbrydelse. Udløsestrøm Ia = magnetisk udløsefaktor × mærkestrøm (type B 5×, C 10×, D 20×). gG-smeltesikringer bør aflæses på tid-strøm-kurven — 5×In er en konservativ vejledende værdi.',
    standarder: 'DS/HD 60364-4-41 §411 – Beskyttelse ved automatisk afbrydelse\nDS/HD 60364-5-54 – Jordforbindelse og beskyttelsesledere',
};

const TOOL_ID = 'el-fejlstrom-zs';

const EarthFaultLoopCalculator: React.FC = () => {
    const [voltageU0, setVoltageU0] = useState('230');
    const [zs, setZs] = useState('1.0');
    const [deviceKey, setDeviceKey] = useState('mcb-b');
    const [inA, setInA] = useState('16');

    const device = DEVICES.find(d => d.key === deviceKey) ?? DEVICES[0];
    const Ia = (parseFloat(inA) || 0) * device.factor;

    const r = useMemo(() => computeEarthFaultLoop({
        voltageU0: parseFloat(voltageU0) || 230,
        loopImpedanceOhm: parseFloat(zs) || 0,
        disconnectCurrentA: Ia,
    }), [voltageU0, zs, Ia]);

    const reportData: CalculatorReportData = {
        toolName: 'Fejlsløjfeimpedans (Zs)',
        category: 'El',
        inputs: [
            { label: 'Netspænding U0', value: voltageU0, unit: 'V' },
            { label: 'Fejlsløjfeimpedans Zs', value: zs, unit: 'Ω' },
            { label: 'Beskyttelsesudstyr', value: device.label },
            { label: 'Mærkestrøm In', value: inA, unit: 'A' },
        ],
        results: [
            { label: 'Udløsestrøm Ia', value: Ia.toFixed(0), unit: 'A', highlight: true },
            { label: 'Fejlstrøm If', value: r.faultCurrentA.toFixed(0), unit: 'A' },
            { label: 'Maks. tilladt Zs', value: r.maxZsOhm.toFixed(2), unit: 'Ω' },
            { label: 'Status', value: r.passed ? 'OK (Zs ≤ Zs,max)' : 'IKKE OK' },
        ],
        formula: 'If = U0/Zs ; Zs,max = U0/Ia ; krav Zs ≤ Zs,max',
        standardsStruktureret: [
            { code: 'DS/HD 60364-4-41', clause: '§411', note: 'Automatisk afbrydelse ved fejl' },
            { code: 'DS/HD 60364-5-54', note: 'Jordforbindelse og beskyttelsesledere' },
        ],
        safetyDisclaimer: 'El-installationer skal udføres og kontrolleres af en autoriseret elinstallatør iht. stærkstrømsbekendtgørelsen og DS/HD 60364.',
    };

    // Simple gauge: Zs vs Zs,max
    const Diagram = useMemo(() => {
        const zsVal = parseFloat(zs) || 0;
        const max = r.maxZsOhm > 0 ? r.maxZsOhm : 1;
        const pct = Math.min(100, (zsVal / (max * 1.5)) * 100);
        const limitPct = Math.min(100, (max / (max * 1.5)) * 100);
        return (
            <div className="space-y-1">
                <div className="relative h-5 rounded-full bg-bg-muted dark:bg-bg-dark-muted overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-success/70" style={{ width: `${limitPct}%` }} />
                    <div className="absolute inset-y-0 bg-danger/60" style={{ left: `${limitPct}%`, right: 0 }} />
                    <div className="absolute top-0 bottom-0 w-1 bg-text-primary dark:bg-white" style={{ left: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-text-tertiary dark:text-text-dark-tertiary">
                    <span>0 Ω</span>
                    <span>Zs,max = {r.maxZsOhm.toFixed(2)} Ω</span>
                </div>
            </div>
        );
    }, [zs, r.maxZsOhm]);

    return (
        <CalculatorPage
            title="Fejlsløjfeimpedans (Zs)"
            helpContent={helpContent}
            reportData={reportData}
            stickyResultLabel="Maks. Zs"
            stickyResult={<><AnimatedNumber value={r.maxZsOhm} precision={2} /> Ω</>}
            shareValue={`Zs ${zs} Ω / max ${r.maxZsOhm.toFixed(2)} Ω · ${r.passed ? 'OK' : 'Ikke OK'}`}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-lg">Indtast Data</h3>
                    <p className="text-sm text-text-secondary -mb-2">Automatisk afbrydelse ved fejl — TN-system.</p>

                    <InputField label="Netspænding (U0)" value={voltageU0} onChange={e => setVoltageU0(e.target.value)} unit="V" info="Fase-til-jord. TN-system: 230 V." />
                    <div className="flex items-center gap-1">
                        <div className="flex-1">
                            <InputField label="Fejlsløjfeimpedans (Zs)" value={zs} onChange={e => setZs(e.target.value)} unit="Ω" info="Målt med sløjfeimpedansmåler eller beregnet af faseleder + PE-leder." />
                        </div>
                        <InfoHint
                            title="Fejlsløjfeimpedans Zs"
                            description="Den samlede impedans i fejlsløjfen (transformer → faseleder → fejlsted → beskyttelsesleder → tilbage). Jo længere/tyndere leder, jo højere Zs og jo lavere fejlstrøm."
                            calculation="Zs = Zforsyning + (R_fase + R_PE) for kredsen"
                        />
                    </div>
                    <div>
                        <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                            Beskyttelsesudstyr
                            <InfoHint
                                title="Udløsestrøm Ia"
                                description="Den strøm der får udstyret til at afbryde inden for kravtiden (0,4 s for stikkontaktkredse ≤32 A). For automatsikringer er det den magnetiske udløsestrøm: type B = 5×In, C = 10×In, D = 20×In."
                                calculation="Ia = faktor × In → Zs,max = U0/Ia"
                            />
                        </label>
                        <select
                            aria-label="Beskyttelsesudstyr"
                            value={deviceKey}
                            onChange={e => setDeviceKey(e.target.value)}
                            className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 text-sm bg-white dark:bg-bg-dark-surface focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        >
                            {DEVICES.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                        </select>
                    </div>
                    <InputField label="Mærkestrøm (In)" value={inA} onChange={e => setInA(e.target.value)} unit="A" info="Sikringens/afbryderens mærkestrøm, fx 10, 13, 16, 20 A." />
                </div>

                <div className="space-y-4">
                    <div className={`p-5 rounded-card border-l-4 shadow-sm ${r.passed ? 'bg-success-subtle border-success dark:bg-success-subtle-dark' : 'bg-danger-subtle border-danger dark:bg-danger-subtle-dark'}`}>
                        <div className="flex items-start gap-3">
                            {r.passed ? <CheckCircleIcon className="w-6 h-6 text-success flex-shrink-0" /> : <AlertTriangleIcon className="w-6 h-6 text-danger flex-shrink-0" />}
                            <div>
                                <h4 className={`font-bold ${r.passed ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                                    {r.passed ? 'Afbrydelse sikret' : 'Zs for høj — afbrydelse ikke sikret'}
                                </h4>
                                <p className={`text-sm mt-0.5 ${r.passed ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                                    {r.passed
                                        ? `Zs = ${zs} Ω ≤ Zs,max = ${r.maxZsOhm.toFixed(2)} Ω. Fejlstrøm ${r.faultCurrentA.toFixed(0)} A udløser beskyttelsen.`
                                        : `Zs = ${zs} Ω > Zs,max = ${r.maxZsOhm.toFixed(2)} Ω. Reducér kabellængde, øg tværsnit eller vælg en type med lavere udløsestrøm (fx type B).`}
                                </p>
                            </div>
                        </div>
                    </div>

                    <ComplianceMeter label="Zs vs. Zs,max" value={parseFloat(zs) || 0} limit={r.maxZsOhm} min={0} max={Math.max(r.maxZsOhm * 1.5, 1)} unit=" Ω" decimalPlaces={2} />

                    <div className="grid grid-cols-2 gap-3">
                        <ResultDisplay label="Fejlstrøm If" value={r.faultCurrentA} precision={0} unit="A" />
                        <ResultDisplay label="Udløsestrøm Ia" value={Ia} precision={0} unit="A" />
                    </div>

                    <div className="bg-white dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark">
                        <h4 className="text-sm font-semibold mb-2 text-text-secondary dark:text-text-dark-secondary">Zs vs. grænse</h4>
                        {Diagram}
                    </div>
                </div>
            </div>

            <SafetyDisclaimer>
                El-installationer må kun udføres og kontrolleres af en autoriseret elinstallatør iht. stærkstrømsbekendtgørelsen
                og DS/HD 60364-serien. Denne beregning er vejledende — Zs skal altid måles på den færdige installation.
            </SafetyDisclaimer>
        </CalculatorPage>
    );
};

export default EarthFaultLoopCalculator;
