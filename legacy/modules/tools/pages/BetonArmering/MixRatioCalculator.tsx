
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage, { type CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import SegmentedControl from '../../components/SegmentedControl';
import AnimatedNumber from '../../components/AnimatedNumber';
import { computeMixRatio, MixRatioType, getCalculator, catalogHelpToContent } from '../../catalog';

const meta = getCalculator('blandingsforhold');

const MixRatioCalculator: React.FC = () => {
    const [mixType, setMixType] = useState('1:3:5');
    const [volume, setVolume] = useState('100'); // Liters
    const [results, setResults] = useState({ cement: 0, sand: 0, stone: 0, water: 0 });

    const ratios = [
        { label: 'Fundament (1:3:5)', value: '1:3:5' },
        { label: 'Gulv (1:2:3)', value: '1:2:3' },
        { label: 'Mørtel (1:4)', value: '1:4' } // Cement:Sand
    ];

    useEffect(() => {
        // Formula lives in services/calculatorCatalog.ts (shared with CalculatorPickerModal)
        const r = computeMixRatio(mixType as MixRatioType, parseFloat(volume) || 0);
        setResults({ cement: r.cement, sand: r.sand, stone: r.stone, water: r.water });
    }, [volume, mixType]);

    // 25kg cement bag is approx 18 Liters
    const cementBags = Math.ceil(results.cement / 18);

    const helpContent = useMemo(
        () => (meta?.help ? catalogHelpToContent(meta.help, meta.standards) : undefined),
        [],
    );

    // ── Report Data ─────────────────────────────────────────────────────────
    const reportData = useMemo<CalculatorReportData>(() => {
        const selectedRatio = ratios.find(r => r.value === mixType);
        const breakdownItems: { label: string; value: string; unit?: string }[] = [
            { label: 'Cement', value: results.cement.toFixed(0), unit: 'liter' },
            { label: 'Cement (poser á 25 kg)', value: String(cementBags), unit: 'poser' },
            { label: 'Sand/Grus', value: results.sand.toFixed(0), unit: 'liter' },
        ];
        if (results.stone > 0) {
            breakdownItems.push({ label: 'Sten', value: results.stone.toFixed(0), unit: 'liter' });
        }
        breakdownItems.push({ label: 'Vand', value: results.water.toFixed(0), unit: 'liter' });

        return {
            toolName: 'Betonblanding',
            category: 'Beton & Armering',
            mode: selectedRatio?.label ?? mixType,
            inputs: [
                { label: 'Blandingsforhold', value: selectedRatio?.label ?? mixType },
                { label: 'Ønsket mængde (færdigbeton)', value: volume, unit: 'liter' },
            ],
            results: [
                { label: 'Cement', value: results.cement.toFixed(0), unit: 'liter', highlight: true },
                { label: 'Cement (poser á 25 kg)', value: String(cementBags), unit: 'poser' },
                { label: 'Sand/Grus', value: results.sand.toFixed(0), unit: 'liter' },
                ...(results.stone > 0 ? [{ label: 'Sten', value: results.stone.toFixed(0), unit: 'liter' }] : []),
                { label: 'Vand', value: results.water.toFixed(0), unit: 'liter' },
            ],
            breakdown: breakdownItems,
            formula: 'Bestanddele beregnes ud fra volumenprocent baseret på blandingsforholdet (Cement:Sand[:Sten]). Vand ≈ 0,5 × cementvolumen.',
            standardsStruktureret: meta?.standards,
            safetyDisclaimer: 'Nominelle blandingsforhold er vejledende til mindre støbearbejder og er IKKE egnet til statisk belastede konstruktioner uden ingeniørberegning (DS/EN 206 / EC2).',
        };
    }, [mixType, volume, results, cementBags]);

    // ── Animated Pie Chart ──────────────────────────────────────────────────
    const PieChart = useMemo(() => {
        const segments = [
            { label: 'Cement', value: results.cement, color: '#6B7280' },
            { label: 'Sand/Grus', value: results.sand, color: '#F59E0B' },
            ...(results.stone > 0 ? [{ label: 'Sten', value: results.stone, color: '#374151' }] : []),
            { label: 'Vand', value: results.water, color: '#3B82F6' },
        ].filter(s => s.value > 0);

        const total = segments.reduce((sum, s) => sum + s.value, 0);
        if (total <= 0) return null;

        const cx = 70; const cy = 70; const r = 60;
        let startAngle = -Math.PI / 2; // Start at top

        const slices = segments.map(seg => {
            const fraction = seg.value / total;
            const angle = fraction * 2 * Math.PI;
            const x1 = cx + r * Math.cos(startAngle);
            const y1 = cy + r * Math.sin(startAngle);
            startAngle += angle;
            const x2 = cx + r * Math.cos(startAngle);
            const y2 = cy + r * Math.sin(startAngle);
            const large = angle > Math.PI ? 1 : 0;
            const path = `M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 ${large},1 ${x2},${y2} Z`;
            return { ...seg, path, pct: (fraction * 100) };
        });

        return (
            <div className="flex flex-col items-center gap-3">
                <svg viewBox="0 0 140 140" className="w-full max-w-[180px]">
                    {slices.map((s, i) => (
                        <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="2" />
                    ))}
                    {/* Centre hole */}
                    <circle cx={cx} cy={cy} r={28} fill="white" />
                    <text x={cx} y={cy - 4} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#374151">Mix</text>
                    <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fill="#6B7280">{parseFloat(volume) || 0}L</text>
                </svg>
                {/* Legend */}
                <div className="flex flex-wrap justify-center gap-3">
                    {slices.map((s, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                            <span className="text-xs text-text-secondary dark:text-text-dark-secondary">{s.label} <span className="font-bold text-text-primary dark:text-text-dark-primary">{s.pct.toFixed(0)}%</span></span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }, [results, volume]);

    return (
        <CalculatorPage
            title="Blandingsforhold (Beton/Mørtel)"
            helpContent={helpContent}
            stickyResultLabel="Cement"
            stickyResult={<><AnimatedNumber value={results.cement} precision={0} /> L ({cementBags} poser)</>}
            reportData={reportData}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border space-y-4">
                    <h3 className="font-bold text-lg">Vælg Blanding</h3>
                    {/* FIX: The `setMixType` state setter is not directly assignable to the `onChange` prop. It's wrapped in an arrow function to ensure type compatibility. */}
                    <SegmentedControl options={ratios} value={mixType} onChange={(value) => setMixType(value)} />
                    
                    <InputField label="Ønsket Mængde (Færdigbeton)" value={volume} onChange={e => setVolume(e.target.value)} unit="liter" info="Hvor meget færdigbeton skal du bruge? En trillebør rummer typisk 80-100 liter."/>
                </div>
                
                <div className="space-y-6">
                    <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border">
                        <h3 className="font-bold text-lg mb-4">Blandingsopskrift (Dele)</h3>
                        
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="bg-bg-muted dark:bg-bg-dark-muted p-3 rounded-lg flex flex-col items-center">
                                <div className="w-10 h-12 bg-gray-400 mb-2 rounded-sm relative">
                                    <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-xs">C</span>
                                </div>
                                <span className="font-bold text-lg"><AnimatedNumber value={results.cement} precision={0}/> L</span>
                                <span className="text-xs text-text-secondary">Cement ({cementBags} poser)</span>
                            </div>
                            
                            <div className="bg-warning-subtle dark:bg-warning-subtle-dark p-3 rounded-lg flex flex-col items-center border border-warning-border dark:border-warning/30">
                                <div className="w-12 h-10 bg-yellow-300 mb-2 rounded-full relative opacity-80"></div>
                                <span className="font-bold text-lg"><AnimatedNumber value={results.sand} precision={0}/> L</span>
                                <span className="text-xs text-text-secondary">Sand/Grus</span>
                            </div>

                            {results.stone > 0 && (
                                <div className="bg-bg-muted dark:bg-bg-dark-muted p-3 rounded-lg flex flex-col items-center border border-border dark:border-border-dark">
                                    <div className="flex gap-1 mb-2 flex-wrap justify-center w-10">
                                        <div className="w-3 h-3 bg-gray-600 rounded-full"></div>
                                        <div className="w-4 h-4 bg-gray-500 rounded-full"></div>
                                        <div className="w-3 h-3 bg-gray-700 rounded-full"></div>
                                    </div>
                                    <span className="font-bold text-lg"><AnimatedNumber value={results.stone} precision={0}/> L</span>
                                    <span className="text-xs text-text-secondary">Sten</span>
                                </div>
                            )}
                        </div>
                        
                        <div className="mt-6 p-4 bg-info-subtle dark:bg-info-subtle-dark rounded-lg border border-info-border dark:border-info/30 flex justify-between items-center">
                            <span className="font-semibold text-info-strong dark:text-info">Vand (ca.)</span>
                            <span className="font-bold text-xl text-info-strong dark:text-info"><AnimatedNumber value={results.water} precision={0}/> Liter</span>
                        </div>

                        {/* Pie Chart Visualiser */}
                        <div className="mt-5 pt-5 border-t border-border dark:border-border-dark">
                            <h4 className="font-bold text-sm text-text-secondary dark:text-text-dark-secondary uppercase tracking-wide mb-4 text-center">Miks-fordeling (Volumen)</h4>
                            {PieChart}
                        </div>
                    </div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default MixRatioCalculator;
