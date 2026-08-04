
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import SegmentedControl from '../../components/SegmentedControl';
import AnimatedNumber from '../../components/AnimatedNumber';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import { InfoHint } from '../../../../components/ui';
import { CheckCircleIcon, AlertTriangleIcon } from '../../../../components/icons';
import {
    computePaving,
    computePavingSubbase,
    getCalculator,
    catalogHelpToContent,
} from '../../catalog';
import type { TrafficClass } from '../../catalog';

const meta = getCalculator('flisebelaegning');

const TOOL_ID = 'udenomsarealer-flisebelaegning';

type Pattern = 'bond' | 'grid' | 'herringbone';

// Advanced-mode traffic classes → build-up (labels come from computePavingSubbase).
const TRAFFIC_OPTIONS: { value: TrafficClass; label: string }[] = [
    { value: 'pedestrian', label: 'Fodgænger / terrasse' },
    { value: 'cycle', label: 'Cykel / let færdsel' },
    { value: 'car', label: 'Personbil / indkørsel' },
    { value: 'heavy', label: 'Tung / lastbil' },
];

const PavingCalculator: React.FC = () => {
    const [mode, setMode] = useState<CalcMode>('basic');
    const [pattern, setPattern] = useState<Pattern>('bond');
    const [dims, setDims] = useState({
        length: '5', width: '4',
        stoneL: '21', stoneW: '14',
        wastage: '5'
    });
    const [layers, setLayers] = useState({ gravel: '0.15', sand: '0.03' });

    // Advanced-mode (sub-base by traffic class) inputs.
    const [trafficClass, setTrafficClass] = useState<TrafficClass>('car');
    const [paverThickness, setPaverThickness] = useState('60');

    const [results, setResults] = useState({
        area: 0,
        gravelVol: 0,
        sandVol: 0,
        stones: 0
    });

    const helpContent = useMemo(() =>
        meta?.help ? catalogHelpToContent(meta.help, meta.standards) : undefined,
    []);

    useEffect(() => {
        // Formula lives in services/calculatorCatalog.ts (shared with CalculatorPickerModal)
        const r = computePaving({
            length: parseFloat(dims.length) || 0,
            width: parseFloat(dims.width) || 0,
            stoneLcm: parseFloat(dims.stoneL) || 0,
            stoneWcm: parseFloat(dims.stoneW) || 0,
            wastagePct: parseFloat(dims.wastage) || 0,
            gravelDepthM: parseFloat(layers.gravel) || 0,
            sandDepthM: parseFloat(layers.sand) || 0,
        });
        setResults({ area: r.area, gravelVol: r.gravelVol, sandVol: r.sandVol, stones: r.stones });
    }, [dims, layers]);

    // Advanced mode: sub-base build-up by traffic class. Reuses the paving area
    // (length × width) from Basic. Formula lives in services/calculatorCatalog.ts.
    const areaM2 = (parseFloat(dims.length) || 0) * (parseFloat(dims.width) || 0);
    const isHeavyDuty = trafficClass === 'car' || trafficClass === 'heavy';
    const subbase = useMemo(() => computePavingSubbase({
        areaM2,
        trafficClass,
        paverThicknessMm: parseFloat(paverThickness) || 0,
    }), [areaM2, trafficClass, paverThickness]);

    const reportData: CalculatorReportData = useMemo(() => {
        if (mode === 'advanced') {
            return {
                toolName: 'Flisebelægning – Bærelag efter trafikklasse',
                category: meta?.category,
                mode: 'Avanceret',
                inputs: [
                    { label: 'Længde', value: dims.length, unit: 'm' },
                    { label: 'Bredde', value: dims.width, unit: 'm' },
                    { label: 'Areal', value: areaM2.toFixed(1), unit: 'm²' },
                    { label: 'Trafikklasse', value: subbase.label },
                    { label: 'Belægningstykkelse', value: paverThickness, unit: 'mm' },
                ],
                results: [
                    { label: 'Stabilgrus (bærelag)', value: String(subbase.baseThicknessMm), unit: 'mm', highlight: true },
                    { label: 'Stabilgrus volumen', value: subbase.baseVolumeM3.toFixed(2), unit: 'm³' },
                    { label: 'Afretningssand', value: String(subbase.beddingThicknessMm), unit: 'mm' },
                    { label: 'Afretningssand volumen', value: subbase.beddingVolumeM3.toFixed(2), unit: 'm³' },
                    { label: 'Total udgravningsdybde', value: String(subbase.totalExcavationMm), unit: 'mm' },
                ],
                standardsStruktureret: meta?.standards,
            };
        }
        return {
            toolName: 'Flisebelægning & Mønster',
            category: meta?.category,
            mode: 'Basis',
            inputs: [
                { label: 'Længde', value: dims.length, unit: 'm' },
                { label: 'Bredde', value: dims.width, unit: 'm' },
                { label: 'Sten Længde', value: dims.stoneL, unit: 'cm' },
                { label: 'Sten Bredde', value: dims.stoneW, unit: 'cm' },
                { label: 'Spild', value: dims.wastage, unit: '%' },
                { label: 'Mønster', value: pattern },
            ],
            results: [
                { label: 'Antal sten', value: String(results.stones), unit: 'stk.', highlight: true },
                { label: 'Areal', value: results.area.toFixed(1), unit: 'm²' },
                { label: 'Stabilgrus', value: results.gravelVol.toFixed(2), unit: 'm³' },
                { label: 'Afretningssand', value: results.sandVol.toFixed(2), unit: 'm³' },
            ],
            formula: meta?.help?.formula,
            standardsStruktureret: meta?.standards,
        };
    }, [mode, dims, layers, pattern, results, areaM2, subbase, paverThickness]);

    const PatternVisualizer = useMemo(() => {
        const sL = parseFloat(dims.stoneL) || 21;
        const sW = parseFloat(dims.stoneW) || 14;
        
        // Visualization viewport 400x300 representing approx 2m x 1.5m patch
        const viewW = 400;
        const viewH = 300;
        const scale = 5; // pixels per cm
        
        const pL = sL * scale;
        const pW = sW * scale;
        
        const stones = [];
        
        if (pattern === 'grid') {
            const cols = Math.ceil(viewW / pW);
            const rows = Math.ceil(viewH / pL);
            for(let r=0; r<rows; r++) {
                for(let c=0; c<cols; c++) {
                    stones.push(<rect key={`${r}-${c}`} x={c*pW} y={r*pL} width={pW-1} height={pL-1} className="fill-stone-400 stroke-stone-500" />);
                }
            }
        } else if (pattern === 'bond') {
            const cols = Math.ceil(viewW / pW) + 1;
            const rows = Math.ceil(viewH / pL);
            for(let r=0; r<rows; r++) {
                for(let c=0; c<cols; c++) {
                    const offset = (r % 2 === 0) ? 0 : -pW/2;
                    stones.push(<rect key={`${r}-${c}`} x={c*pW + offset} y={r*pL} width={pW-1} height={pL-1} className="fill-stone-400 stroke-stone-500" />);
                }
            }
        } else if (pattern === 'herringbone') {
            // Simple herringbone approximation with rectangles
            const cols = Math.ceil(viewW / pW) * 2;
            const rows = Math.ceil(viewH / pL) * 2;
            // Correct 45deg herringbone is complex to loop simply, let's do a 90-degree pattern
            // L-shape unit block
            for(let r=0; r<rows; r++) {
                for(let c=0; c<cols; c++) {
                    const x = c * (pW + pL);
                    const y = r * (pW + pL);
                    // Horizontal
                    stones.push(<rect key={`h-${r}-${c}`} x={x} y={y} width={pL-1} height={pW-1} className="fill-stone-400 stroke-stone-500" />);
                    // Vertical
                    stones.push(<rect key={`v-${r}-${c}`} x={x} y={y+pW} width={pW-1} height={pL-1} className="fill-stone-400 stroke-stone-500" />);
                }
            }
        }

        return (
            <div className="w-full h-48 bg-stone-100 rounded-lg border border-stone-300 overflow-hidden relative">
                <svg width="100%" height="100%" viewBox={`-10 -10 ${viewW + 20} ${viewH + 20}`} preserveAspectRatio="xMidYMid slice">
                    {stones}
                </svg>
                <div className="absolute bottom-2 right-2 bg-bg/90 px-2 py-1 rounded text-xs font-bold text-text-secondary shadow-sm pointer-events-none">
                    Preview (Udsnit)
                </div>
            </div>
        );
    }, [dims.stoneL, dims.stoneW, pattern]);

    return (
        <CalculatorPage
            title="Flisebelægning & Mønster"
            helpContent={helpContent}
            reportData={reportData}
            modeToggle={
                <CalculatorModeToggle
                    toolId={TOOL_ID}
                    onChange={setMode}
                />
            }
            shareValue={
                mode === 'advanced'
                    ? `Bærelag ${subbase.baseThicknessMm} mm · Udgravning ${subbase.totalExcavationMm} mm · ${subbase.baseVolumeM3.toFixed(2)} m³ stabilgrus`
                    : (results.stones > 0 ? `${results.stones} sten · ${results.area.toFixed(1)} m²` : undefined)
            }
        >
            {mode === 'basic' && (
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-lg text-text-primary dark:text-text-dark-primary">Areal & Sten</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Længde" value={dims.length} onChange={e => setDims({...dims, length: e.target.value})} unit="m" info="Længden af området, der skal brolægges."/>
                        <InputField label="Bredde" value={dims.width} onChange={e => setDims({...dims, width: e.target.value})} unit="m" info="Bredden af området, der skal brolægges."/>
                    </div>
                    
                    <div className="p-4 bg-bg-subtle dark:bg-bg-dark-muted rounded-lg border border-border dark:border-border-dark">
                        <h4 className="font-semibold mb-2 text-sm text-text-primary dark:text-text-dark-primary">Sten Dimensioner</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <InputField label="Længde" value={dims.stoneL} onChange={e => setDims({...dims, stoneL: e.target.value})} unit="cm" info="Længden på én flise/sten."/>
                            <InputField label="Bredde" value={dims.stoneW} onChange={e => setDims({...dims, stoneW: e.target.value})} unit="cm" info="Bredden på én flise/sten."/>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">Mønster</label>
                        <SegmentedControl 
                            options={[
                                { label: 'Forbandt', value: 'bond' }, 
                                { label: 'Grid', value: 'grid' }, 
                                { label: 'Blok', value: 'herringbone' } // Simplified name
                            ]}
                            value={pattern}
                            onChange={(v) => setPattern(v)}
                        />
                    </div>
                    
                    <InputField label="Spild (%)" value={dims.wastage} onChange={e => setDims({...dims, wastage: e.target.value})} unit="%" info="Ved mønsterlægning (f.eks. sildeben) er spildet typisk højere (10-15%) pga. mange tilskæringer."/>
                </div>
                
                <div className="space-y-6">
                    <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark">
                        <h3 className="font-bold text-lg mb-4 text-text-primary dark:text-text-dark-primary">Resultat</h3>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <ResultDisplay label="Fliser (stk)" value={results.stones} precision={0} unit="stk"/>
                            <ResultDisplay label="Areal" value={results.area} precision={1} unit="m²"/>
                        </div>
                        
                        {PatternVisualizer}
                        
                        <div className="mt-6 space-y-2 pt-4 border-t border-border dark:border-border-dark">
                            <h4 className="font-bold text-sm text-text-secondary dark:text-text-dark-secondary">Bundopbygning</h4>
                            <div className="flex justify-between p-2 bg-bg-subtle dark:bg-bg-dark-muted rounded text-sm text-text-primary dark:text-text-dark-primary">
                                <span>Stabilgrus ({layers.gravel}m)</span>
                                <span className="font-bold"><AnimatedNumber value={results.gravelVol} precision={2}/> m³</span>
                            </div>
                            <div className="flex justify-between p-2 bg-warning-subtle dark:bg-warning-subtle-dark rounded text-sm text-text-primary dark:text-text-dark-primary">
                                <span>Afretningssand ({layers.sand}m)</span>
                                <span className="font-bold"><AnimatedNumber value={results.sandVol} precision={2}/> m³</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            )}

            {mode === 'advanced' && (
            <div className="grid md:grid-cols-2 gap-6 items-start">
                {/* ── Inputs ── */}
                <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-lg text-text-primary dark:text-text-dark-primary">Bærelag efter trafikklasse</h3>
                    <p className="text-sm text-text-secondary dark:text-text-dark-secondary -mb-1">
                        Dimensionér stabilgrus og afretningssand efter den belastning, belægningen skal bære.
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Længde" value={dims.length} onChange={e => setDims({...dims, length: e.target.value})} unit="m" info="Længden af området, der skal brolægges."/>
                        <InputField label="Bredde" value={dims.width} onChange={e => setDims({...dims, width: e.target.value})} unit="m" info="Bredden af området, der skal brolægges."/>
                    </div>

                    <div className="flex justify-between items-center p-2 bg-bg-subtle dark:bg-bg-dark-muted rounded text-sm text-text-primary dark:text-text-dark-primary">
                        <span>Belægningsareal</span>
                        <span className="font-bold"><AnimatedNumber value={areaM2} precision={1}/> m²</span>
                    </div>

                    <div>
                        <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                            Trafikklasse
                            <InfoHint
                                title="Trafikklasse & bærelag"
                                description="Bærelagets dybde skal matche belastningen. En havegang er ikke det samme som en indkørsel — jo tungere færdsel, jo tykkere og kraftigere bærelag skal der til."
                                calculation="Fodgænger 100 mm · Cykel 150 mm · Personbil 250 mm · Tung 350 mm stabilgrus"
                            />
                        </label>
                        <select
                            aria-label="Trafikklasse"
                            value={trafficClass}
                            onChange={e => setTrafficClass(e.target.value as TrafficClass)}
                            className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 bg-white dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary focus:ring-2 focus:ring-brand-primary/50 focus:outline-none"
                        >
                            {TRAFFIC_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>

                    <InputField
                        label="Belægningstykkelse"
                        value={paverThickness}
                        onChange={e => setPaverThickness(e.target.value)}
                        unit="mm"
                        info="Tykkelsen på selve belægningsstenen/flisen. Standard betonsten er 60 mm; til tung trafik anbefales 80 mm."
                    />
                </div>

                {/* ── Results ── */}
                <div className="space-y-6">
                    {/* Load-class verdict / guidance card */}
                    <div className={`p-5 rounded-card border-l-4 shadow-sm ${isHeavyDuty ? 'bg-warning-subtle border-warning dark:bg-warning-subtle-dark' : 'bg-success-subtle border-success dark:bg-success-subtle-dark'}`}>
                        <div className="flex items-start gap-3">
                            {isHeavyDuty
                                ? <AlertTriangleIcon className="w-6 h-6 text-warning flex-shrink-0" />
                                : <CheckCircleIcon className="w-6 h-6 text-success flex-shrink-0" />}
                            <div className="flex-1">
                                <h4 className={`font-bold ${isHeavyDuty ? 'text-warning-strong dark:text-warning' : 'text-success-strong dark:text-success'}`}>
                                    {subbase.label}
                                </h4>
                                <p className={`text-sm mt-0.5 ${isHeavyDuty ? 'text-warning-strong dark:text-warning' : 'text-success-strong dark:text-success'}`}>
                                    {isHeavyDuty
                                        ? 'Tungere trafik kræver et tykkere, velkomprimeret bærelag. Komprimér stabilgruset i lag af maks. 100–150 mm, ellers sætter belægningen sig.'
                                        : 'Let færdsel klarer sig med et tyndere bærelag. Stabilgruset skal stadig komprimeres i lag for at holde belægningen plan.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Material volumes */}
                    <div className="grid grid-cols-2 gap-4">
                        <ResultDisplay label="Stabilgrus (bærelag)" value={subbase.baseVolumeM3} precision={2} unit="m³" />
                        <ResultDisplay label="Afretningssand" value={subbase.beddingVolumeM3} precision={2} unit="m³" />
                    </div>

                    {/* Build-up + total excavation depth */}
                    <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark">
                        <div className="flex items-center gap-1 mb-4">
                            <h4 className="font-bold text-sm text-text-secondary dark:text-text-dark-secondary">Bundopbygning & udgravning</h4>
                            <InfoHint
                                title="Total udgravningsdybde"
                                description="Den samlede dybde, du skal grave ud, er summen af bærelaget, afretningssandet og selve belægningsstenen."
                                calculation="Udgravning = stabilgrus + afretningssand + belægningstykkelse"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center p-2 bg-bg-subtle dark:bg-bg-dark-muted rounded text-sm text-text-primary dark:text-text-dark-primary">
                                <span className="flex items-center gap-1">
                                    Stabilgrus (bærelag)
                                    <InfoHint
                                        title="Stabilgrus (bærelag)"
                                        description="Det bærende lag under belægningen. Det SKAL komprimeres i flere tynde lag (maks. 100–150 mm pr. lag) for at opnå den nødvendige bæreevne — komprimeres alt på én gang, sætter belægningen sig."
                                        calculation={`${subbase.baseThicknessMm} mm × ${areaM2.toFixed(1)} m² = ${subbase.baseVolumeM3.toFixed(2)} m³`}
                                    />
                                </span>
                                <span className="font-bold">{subbase.baseThicknessMm} mm</span>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-warning-subtle dark:bg-warning-subtle-dark rounded text-sm text-text-primary dark:text-text-dark-primary">
                                <span>Afretningssand</span>
                                <span className="font-bold">{subbase.beddingThicknessMm} mm</span>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-bg-subtle dark:bg-bg-dark-muted rounded text-sm text-text-primary dark:text-text-dark-primary">
                                <span>Belægningssten</span>
                                <span className="font-bold">{parseFloat(paverThickness) || 0} mm</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-brand-primary/10 dark:bg-brand-primary/20 rounded-lg text-sm font-semibold text-text-primary dark:text-text-dark-primary border border-brand-primary/20">
                                <span>Total udgravningsdybde</span>
                                <span className="font-bold text-brand-primary dark:text-brand-light"><AnimatedNumber value={subbase.totalExcavationMm} precision={0}/> mm</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            )}
        </CalculatorPage>
    );
};

export default PavingCalculator;
