
import React, { useState, useEffect, useMemo, useRef } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import AnimatedNumber from '../../components/AnimatedNumber';
import RegulationSwitch from '../../components/RegulationSwitch';
import ComplianceAlert from '../../components/ComplianceAlert';
import { computeWindowDaylight, getCalculator } from '../../catalog';

const meta = getCalculator('doere-vinduer-vinduesareal');

const WindowAreaCalculator: React.FC = () => {
    const [dims, setDims] = useState({
        floorArea: '20', // Added floor area for BR18 check
        wallL: '8', wallH: '2.5',
        windowL: '1.2', windowH: '1.2',
        numWindows: '2',
    });
    const [results, setResults] = useState({ windowArea: 0, wallPercentage: 0, floorPercentage: 0 });

    // Compliance State
    const [isBR18Active, setIsBR18Active] = useState(false);
    const [compliance, setCompliance] = useState({ passed: false, message: '' });
    const resultsRef = useRef<HTMLDivElement>(null);

    const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        const floorA = parseFloat(dims.floorArea) || 0;
        const wallL_m = parseFloat(dims.wallL) || 0;
        const wallH_m = parseFloat(dims.wallH) || 0;
        const windowL_m = parseFloat(dims.windowL) || 0;
        const windowH_m = parseFloat(dims.windowH) || 0;
        const num = parseInt(dims.numWindows) || 0;

        if (wallL_m > 0 && wallH_m > 0) {
            const wallArea = wallL_m * wallH_m;
            const totalWindowArea = windowL_m * windowH_m * num;
            const wallPercentage = wallArea > 0 ? (totalWindowArea / wallArea) * 100 : 0;
            const floorPercentage = floorA > 0 ? (totalWindowArea / floorA) * 100 : 0;
            
            setResults({ windowArea: totalWindowArea, wallPercentage, floorPercentage });

            const { passed, ratio } = computeWindowDaylight({ windowAreaM2: totalWindowArea, floorAreaM2: floorA });
            if (passed) {
                setCompliance({ passed: true, message: `Glasarealet udgør ${ratio.toFixed(1)}% af gulvarealet — overholder BR18 §373 tommelfingerreglen (≥ 10%).` });
            } else {
                setCompliance({ passed: false, message: `Glasarealet udgør kun ${ratio.toFixed(1)}% af gulvarealet. BR18 §373 kræver typisk ≥ 10% for tilstrækkeligt dagslys i opholdsrum.` });
            }

        } else {
            setResults({ windowArea: 0, wallPercentage: 0, floorPercentage: 0 });
            setCompliance({ passed: false, message: 'Indtast gyldige dimensioner.' });
        }
    }, [dims]);

    const reportData: CalculatorReportData = useMemo(() => ({
        toolName: 'Vinduesareal & Dagslys',
        category: meta?.category,
        inputs: [
            { label: 'Væglængde', value: dims.wallL, unit: 'm' },
            { label: 'Væghøjde', value: dims.wallH, unit: 'm' },
            { label: 'Vindueshøjde', value: dims.windowH, unit: 'm' },
            { label: 'Vinduesbredde', value: dims.windowL, unit: 'm' },
            { label: 'Antal vinduer', value: dims.numWindows, unit: 'stk' },
            ...(isBR18Active ? [{ label: 'Gulvareal', value: dims.floorArea, unit: 'm²' }] : []),
        ],
        results: [
            { label: 'Vinduesareal', value: results.windowArea.toFixed(2), unit: 'm²', highlight: true },
            { label: 'Andel af vægareal', value: results.wallPercentage.toFixed(1), unit: '%' },
            ...(isBR18Active ? [{ label: 'Andel af gulvareal (BR18)', value: results.floorPercentage.toFixed(1), unit: '%' }] : []),
        ],
        formula: meta?.help?.formula,
        standardsStruktureret: meta?.standards,
        infographicRef: resultsRef,
    }), [dims, results, isBR18Active, meta]);

    return (
        <CalculatorPage
            title="Vinduesareal & Dagslys"
            helpContent={meta?.help as import('../../components/CalculatorPage').HelpContent | undefined}
            stickyResult={<><AnimatedNumber value={results.windowArea} precision={2} /> m²</>}
            stickyResultLabel="Vinduesareal"
            reportData={reportData}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-bg dark:bg-bg-dark-surface p-5 rounded-card shadow-sm border dark:border-border-dark space-y-4">
                    <RegulationSwitch isActive={isBR18Active} onToggle={setIsBR18Active} />
                    
                    <h3 className="font-bold text-lg">Indtast Mål</h3>
                    
                    {isBR18Active && (
                        <div className="p-4 bg-info-subtle dark:bg-info-subtle-dark border border-info-border rounded-lg animate-fade-in">
                             <InputField label="Rum Gulvareal" value={dims.floorArea} onChange={e => handleDimChange(e, 'floorArea')} unit="m²" info="Nødvendig for at beregne dagslysfaktor iht. BR18 (min. 10% glasareal)."/>
                        </div>
                    )}

                    <div className="p-4 bg-bg-muted dark:bg-bg-dark-muted rounded-lg">
                        <h4 className="font-semibold mb-2">Vægareal</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <InputField label="Væglængde" value={dims.wallL} onChange={e => handleDimChange(e, 'wallL')} unit="m" info="Længden af væggen med vinduer."/>
                            <InputField label="Væghøjde" value={dims.wallH} onChange={e => handleDimChange(e, 'wallH')} unit="m" info="Højden af væggen."/>
                        </div>
                    </div>
                     <div className="p-4 bg-bg-muted dark:bg-bg-dark-muted rounded-lg">
                        <h4 className="font-semibold mb-2">Vinduesmål (Glasareal, ekskl. karm)</h4>
                        <div className="grid grid-cols-2 gap-4">
                             <InputField label="Vindueshøjde" value={dims.windowH} onChange={e => handleDimChange(e, 'windowH')} unit="m" info="Højden på det synlige glasareal (ekskl. karm) — ikke hulmålet."/>
                             <InputField label="Vinduesbredde" value={dims.windowL} onChange={e => handleDimChange(e, 'windowL')} unit="m" info="Bredden på det synlige glasareal (ekskl. karm) — ikke hulmålet."/>
                        </div>
                        <div className="mt-4">
                             <InputField label="Antal Vinduer" value={dims.numWindows} onChange={e => handleDimChange(e, 'numWindows')} unit="stk" />
                        </div>
                    </div>
                </div>
                
                <div className="space-y-6">
                    <div ref={resultsRef} className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border">
                        <h3 className="font-bold text-lg mb-4">Resultat</h3>
                        <div className="space-y-4">
                            <div className="text-center bg-bg-subtle p-3 rounded-lg">
                                <p className="text-sm font-medium text-text-secondary">Samlet Vinduesareal</p>
                                <div className="text-3xl font-bold text-brand-primary mt-1">
                                    <AnimatedNumber value={results.windowArea} precision={2} />
                                    <span className="text-2xl ml-1">m²</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="text-center bg-bg-subtle p-3 rounded-lg">
                                    <p className="text-xs font-medium text-text-secondary">Af Vægareal</p>
                                    <div className="text-xl font-bold text-text-primary mt-1">
                                        <AnimatedNumber value={results.wallPercentage} precision={1} />%
                                    </div>
                                </div>
                                {isBR18Active && (
                                     <div className="text-center bg-info-subtle dark:bg-info-subtle-dark border border-info-border p-3 rounded-lg animate-fade-in">
                                        <p className="text-xs font-medium text-info-strong dark:text-info">Af Gulvareal</p>
                                        <div className="text-xl font-bold text-brand-primary mt-1">
                                            <AnimatedNumber value={results.floorPercentage} precision={1} />%
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <ComplianceAlert 
                        isActive={isBR18Active}
                        passed={compliance.passed}
                        message={compliance.message}
                        ruleRef="BR18, Kap. 18, § 379 (Dagslys)"
                    />
                </div>
            </div>
        </CalculatorPage>
    );
};

export default WindowAreaCalculator;
