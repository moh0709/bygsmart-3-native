
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage, { type CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import SegmentedControl from '../../components/SegmentedControl';
import { AlertTriangleIcon, CheckCircleIcon } from '../../../../components/icons';

// Standard capacities (approximate safe values for typical slopes)
const GUTTER_CAPACITIES = {
    '10': 2.8, // Size 10 (100mm) ~ 2.8 L/s
    '11': 4.2, // Size 11 (115mm) ~ 4.2 L/s
    '12': 6.5  // Size 12 (125mm) ~ 6.5 L/s
};

const GutterCalculator: React.FC = () => {
    const [area, setArea] = useState('100'); // m2
    const [intensity, setIntensity] = useState('0.014'); // l/s/m2 (Standard DK)
    const [placement, setPlacement] = useState<'end' | 'middle'>('end');
    
    const [flow, setFlow] = useState(0);
    const [recommendation, setRecommendation] = useState<string>('');

    useEffect(() => {
        const A = parseFloat(area) || 0;
        const I = parseFloat(intensity) || 0.014;
        
        // Calculate Flow (Q)
        const Q = A * I;
        setFlow(Q);

        // Recommendation Logic
        // If placement is middle, the capacity effectively doubles relative to the area served if slope goes both ways,
        // but usually we calculate per downpipe.
        // Let's assume simple: The user inputs the AREA served by ONE downpipe.
        
        let rec = '';
        if (Q <= GUTTER_CAPACITIES['10']) {
            rec = 'Str. 10 (Lille)';
        } else if (Q <= GUTTER_CAPACITIES['11']) {
            rec = 'Str. 11 (Normal)';
        } else if (Q <= GUTTER_CAPACITIES['12']) {
            rec = 'Str. 12 (Stor)';
        } else {
            rec = 'Kræver ekstra nedløb / special';
        }
        setRecommendation(rec);

    }, [area, intensity, placement]);

    const reportData = useMemo<CalculatorReportData>(() => ({
        toolName: 'Tagrender',
        category: 'Lofter & Tag',
        inputs: [
            { label: 'Tagareal til ét nedløb', value: area, unit: 'm²' },
            { label: 'Regnintensitet', value: intensity, unit: 'l/s/m²' },
            { label: 'Nedløbsplacering', value: placement === 'end' ? 'Ende' : 'Midt' },
        ],
        results: [
            { label: 'Vandbelastning', value: flow.toFixed(2), unit: 'L/s', highlight: true },
            { label: 'Anbefalet størrelse', value: recommendation },
        ],
        breakdown: [
            { label: 'Str. 10 (100mm) kapacitet', value: String(GUTTER_CAPACITIES['10']), unit: 'L/s' },
            { label: 'Str. 11 (115mm) kapacitet', value: String(GUTTER_CAPACITIES['11']), unit: 'L/s' },
            { label: 'Str. 12 (125mm) kapacitet', value: String(GUTTER_CAPACITIES['12']), unit: 'L/s' },
        ],
        formula: 'Q = A × I',
        standardsStruktureret: [
            { code: 'DS 432', note: 'Standardværdi regnintensitet 0.014 l/s/m² for normal dimensionering' },
        ],
    }), [area, intensity, placement, flow, recommendation]);

    return (
        <CalculatorPage title="Tagrendeberegner" reportData={reportData}>
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white p-6 rounded-card shadow-sm border space-y-4">
                    <h3 className="font-bold text-lg">Tagdata (pr. nedløb)</h3>
                    <InputField 
                        label="Tagareal til ét nedløb" 
                        value={area} 
                        onChange={e => setArea(e.target.value)} 
                        unit="m²" 
                        info="Det areal af taget, som vandet løber fra ned i dette specifikke nedløbsrør."
                    />
                    <InputField 
                        label="Regnintensitet" 
                        value={intensity} 
                        onChange={e => setIntensity(e.target.value)} 
                        unit="l/s/m²" 
                        info="DS 432 standardværdi er 0.014 l/s/m² for normal dimensionering."
                    />
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Nedløbsplacering</label>
                        <SegmentedControl 
                            options={[{label: 'Ende', value: 'end'}, {label: 'Midt', value: 'middle'}]}
                            value={placement}
                            onChange={(val) => setPlacement(val as 'end' | 'middle')}
                        />
                        <p className="text-xs text-text-secondary mt-1">Påvirker strømningsforholdene i renden (informativt).</p>
                    </div>
                </div>
                
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-card shadow-sm border">
                        <h3 className="font-bold text-lg mb-4">Anbefaling</h3>
                        
                        <div className="text-center bg-info-subtle p-6 rounded-xl border-2 border-info-border mb-4">
                           <p className="text-sm text-info-strong font-medium uppercase tracking-wider mb-1">Vandbelastning</p>
                           <p className="text-4xl font-bold text-brand-primary">{flow.toFixed(2)} <span className="text-2xl font-normal">L/s</span></p>
                        </div>

                        <div className={`p-4 rounded-lg border flex items-center gap-3 ${recommendation.includes('special') ? 'bg-danger-subtle border-danger-border' : 'bg-success-subtle border-success-border'}`}>
                            {recommendation.includes('special') ? <AlertTriangleIcon className="w-8 h-8 text-danger"/> : <CheckCircleIcon className="w-8 h-8 text-success"/>}
                            <div>
                                <p className="text-sm font-medium text-text-secondary">Anbefalet Størrelse</p>
                                <p className="text-2xl font-bold text-text-primary">{recommendation}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-card shadow-sm border text-sm">
                        <h4 className="font-bold mb-2">Kapaciteter (ca.)</h4>
                        <ul className="space-y-1 text-text-secondary">
                            <li className="flex justify-between"><span>Str. 10 (100mm):</span> <span>op til {GUTTER_CAPACITIES['10']} L/s</span></li>
                            <li className="flex justify-between"><span>Str. 11 (115mm):</span> <span>op til {GUTTER_CAPACITIES['11']} L/s</span></li>
                            <li className="flex justify-between"><span>Str. 12 (125mm):</span> <span>op til {GUTTER_CAPACITIES['12']} L/s</span></li>
                        </ul>
                    </div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default GutterCalculator;
