
import React, { useState, useMemo } from 'react';
import CalculatorPage, { type CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import AnimatedNumber from '../../components/AnimatedNumber';
import CalculatorHero from '../../components/CalculatorHero';
import ResultDisplay from '../../components/ResultDisplay';

interface PitchCategory {
    label: string;
    colorClass: string;
    bgClass: string;
    dotClass: string;
    hint: string;
}

function getPitchCategory(degrees: number): PitchCategory {
    if (degrees < 5) return {
        label: 'Fladt tag (< 5°)',
        colorClass: 'text-info-strong dark:text-info',
        bgClass: 'bg-info-subtle dark:bg-info-subtle-dark',
        dotClass: 'bg-info',
        hint: 'Kræver vandtæt membran og min. 1:50 fald (1,1°). Afvandingskrav for tagflader, BR18.',
    };
    if (degrees < 20) return {
        label: 'Lavt tag (5–20°)',
        colorClass: 'text-success-strong dark:text-success',
        bgClass: 'bg-success-subtle dark:bg-success-subtle-dark',
        dotClass: 'bg-success',
        hint: 'Egnet til tagpap, metalplader og sedum-tag. Kontrollér drænkapacitet.',
    };
    if (degrees < 45) return {
        label: 'Standard tag (20–45°)',
        colorClass: 'text-success-strong dark:text-success',
        bgClass: 'bg-success-subtle dark:bg-success-subtle-dark',
        dotClass: 'bg-success',
        hint: 'Anbefalet hældning til tegl, betontagsten og fibercement.',
    };
    return {
        label: 'Stejlt tag (> 45°)',
        colorClass: 'text-warning-strong dark:text-warning',
        bgClass: 'bg-warning-subtle dark:bg-warning-subtle-dark',
        dotClass: 'bg-warning',
        hint: 'Særligt tagmateriale og ekstra sikkerhedsudstyr (stillads/sikring) påkrævet.',
    };
}

const RoofPitchCalculator: React.FC = () => {
    const [dims, setDims] = useState({ rise: '3', run: '4' });
    const [focusedInput, setFocusedInput] = useState<string | null>(null);

    const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };

    const { degrees, percentage, rafterLen } = useMemo(() => {
        const rise = parseFloat(dims.rise) || 0;
        const run = parseFloat(dims.run) || 0;
        if (run > 0 && rise >= 0) {
            const deg = Math.atan(rise / run) * (180 / Math.PI);
            const pct = (rise / run) * 100;
            const rafter = Math.sqrt(rise * rise + run * run);
            return { degrees: deg, percentage: pct, rafterLen: rafter };
        }
        return { degrees: 0, percentage: 0, rafterLen: 0 };
    }, [dims]);

    const pitchCategory = getPitchCategory(degrees);

    const reportData = useMemo<CalculatorReportData>(() => ({
        toolName: 'Taghaeldning',
        category: 'Lofter & Tag',
        inputs: [
            { label: 'Rejsning (Rise)', value: dims.rise, unit: 'm' },
            { label: 'Grund (Run)', value: dims.run, unit: 'm' },
        ],
        results: [
            { label: 'Taghældning', value: degrees.toFixed(1), unit: '°', highlight: true },
            { label: 'Hældning i procent', value: percentage.toFixed(1), unit: '%' },
            { label: 'Spær-/raftelængde', value: rafterLen.toFixed(2), unit: 'm' },
            { label: 'Kategori', value: pitchCategory.label },
        ],
        formula: 'α = atan(rejsning / grund) × (180 / π) ; spær = √(rejsning² + grund²)',
        standardsStruktureret: [
            { code: 'BR18', note: 'Afvandingskrav for tagflader — flade tage min. fald 1:50 (1,1°)' },
            { code: 'DS/EN 1991-1-3', note: 'Snelast på tage' },
        ],
    }), [dims, degrees, percentage, rafterLen, pitchCategory.label]);

    // ── Animated house cross-section diagram ────────────────────────────────
    const HouseDiagram = useMemo(() => {
        const rise = Math.max(parseFloat(dims.rise) || 0.01, 0.01);
        const run = Math.max(parseFloat(dims.run) || 0.01, 0.01);

        const maxDim = Math.max(rise, run);
        const vRise = (rise / maxDim) * 72;
        const vRun = (run / maxDim) * 72;

        const baseX = 24;
        const baseY = 128;
        const wallH = 36;

        const peakX = baseX + vRun;
        const peakY = baseY - vRise;
        const endX = peakX + vRun;
        const angleRad = Math.atan(rise / run);

        return (
            <svg viewBox="0 0 200 155" className="w-full max-h-[145px]">
                {/* Ground dashes */}
                <line x1="4" y1={baseY + 4} x2="196" y2={baseY + 4} stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="5,4" />

                {/* House walls */}
                <rect x={baseX} y={baseY - wallH} width={vRun * 2} height={wallH} fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" />

                {/* Roof slopes */}
                <polygon
                    points={`${baseX},${baseY} ${peakX},${peakY} ${peakX},${baseY}`}
                    fill="#bfdbfe"
                    stroke="#3b82f6"
                    strokeWidth="2"
                />
                <polygon
                    points={`${peakX},${peakY} ${endX},${baseY} ${peakX},${baseY}`}
                    fill="#93c5fd"
                    stroke="#3b82f6"
                    strokeWidth="2"
                />

                {/* Rise dimension arrow */}
                <line x1={peakX + 10} y1={peakY} x2={peakX + 10} y2={baseY} stroke="#ef4444" strokeWidth="1.5" />
                <polygon points={`${peakX + 10},${peakY} ${peakX + 7},${peakY + 6} ${peakX + 13},${peakY + 6}`} fill="#ef4444" />
                <polygon points={`${peakX + 10},${baseY} ${peakX + 7},${baseY - 6} ${peakX + 13},${baseY - 6}`} fill="#ef4444" />
                <text x={peakX + 18} y={(peakY + baseY) / 2 + 4} fontSize="9" fill="#ef4444" fontWeight="bold">{dims.rise}m</text>

                {/* Run dimension arrow */}
                <line x1={baseX} y1={baseY + 14} x2={peakX} y2={baseY + 14} stroke="#64748b" strokeWidth="1.5" />
                <polygon points={`${baseX},${baseY + 14} ${baseX + 6},${baseY + 11} ${baseX + 6},${baseY + 17}`} fill="#64748b" />
                <polygon points={`${peakX},${baseY + 14} ${peakX - 6},${baseY + 11} ${peakX - 6},${baseY + 17}`} fill="#64748b" />
                <text x={(baseX + peakX) / 2} y={baseY + 25} fontSize="9" fill="#64748b" textAnchor="middle">{dims.run}m</text>

                {/* Angle arc */}
                <path
                    d={`M${baseX + 16},${baseY} A16,16 0 0,0 ${baseX + 16 * Math.cos(angleRad)},${baseY - 16 * Math.sin(angleRad)}`}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="1.5"
                />

                {/* Degree label */}
                <text
                    x={baseX + (focusedInput === 'rise' ? 26 : 24)}
                    y={baseY - 10}
                    fontSize="11"
                    fill="#3b82f6"
                    fontWeight="bold"
                >
                    {degrees.toFixed(1)}°
                </text>
            </svg>
        );
    }, [dims, focusedInput, degrees]);

    return (
        <CalculatorPage
            title="Taghældning Beregner"
            stickyResultLabel="Taghældning"
            stickyResult={<><AnimatedNumber value={degrees} precision={1} />°</>}
            shareValue={degrees > 0 ? `Taghældning: ${degrees.toFixed(1)}° (${percentage.toFixed(1)}%) · Spær: ${rafterLen.toFixed(2)} m` : undefined}
            reportData={reportData}
        >
            {/* Illustrated hero */}
            <CalculatorHero
                illustration={HouseDiagram}
                hint={pitchCategory.hint}
                complianceRef="BR18 (afvandingskrav, flade tage min. 1:50), DS/EN 1991-1-3 (Snelast)"
                accentFrom="#0ea5e9"
                accentTo="#0369a1"
                className="mb-4"
            />

            <div className="grid md:grid-cols-2 gap-4 items-start">
                {/* Input card */}
                <div className="bg-white dark:bg-bg-dark-surface p-5 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-base text-text-primary dark:text-text-dark-primary">Indtast Mål</h3>
                    <p className="text-sm text-text-secondary dark:text-text-dark-secondary -mt-1">
                        Lodret stigning og vandret grund fra tagfod til kip.
                    </p>
                    <InputField
                        name="rise"
                        label="Rejsning (Rise)"
                        value={dims.rise}
                        onChange={e => handleDimChange(e, 'rise')}
                        unit="m"
                        onFocus={setFocusedInput}
                        onBlur={() => setFocusedInput(null)}
                        info="Den lodrette højde fra tagfodens niveau til kip."
                    />
                    <InputField
                        name="run"
                        label="Grund (Run)"
                        value={dims.run}
                        onChange={e => handleDimChange(e, 'run')}
                        unit="m"
                        onFocus={setFocusedInput}
                        onBlur={() => setFocusedInput(null)}
                        info="Den vandrette afstand fra tagfod til midten af huset (kip)."
                    />
                </div>

                <div className="space-y-4">
                    {/* Main results */}
                    <div className="bg-white dark:bg-bg-dark-surface p-5 rounded-card shadow-sm border border-border dark:border-border-dark">
                        <h3 className="font-bold text-base mb-4 text-text-primary dark:text-text-dark-primary">Resultat</h3>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="text-center bg-bg-subtle dark:bg-bg-dark-muted p-4 rounded-xl">
                                <p className="text-xs font-medium text-text-secondary dark:text-text-dark-secondary mb-1">Grader</p>
                                <div className="text-3xl font-extrabold text-brand-primary dark:text-brand-light">
                                    <AnimatedNumber value={degrees} precision={1} />
                                    <span className="text-xl ml-0.5">°</span>
                                </div>
                            </div>
                            <div className="text-center bg-bg-subtle dark:bg-bg-dark-muted p-4 rounded-xl">
                                <p className="text-xs font-medium text-text-secondary dark:text-text-dark-secondary mb-1">Procent</p>
                                <div className="text-3xl font-extrabold text-brand-primary dark:text-brand-light">
                                    <AnimatedNumber value={percentage} precision={1} />
                                    <span className="text-xl ml-0.5">%</span>
                                </div>
                            </div>
                        </div>

                        {/* Rafter length */}
                        <div className="flex items-center justify-between px-3 py-3 bg-bg-subtle dark:bg-bg-dark-muted rounded-xl">
                            <span className="text-sm text-text-secondary dark:text-text-dark-secondary">Spær-/raftelængde</span>
                            <span className="font-bold text-text-primary dark:text-text-dark-primary">
                                <AnimatedNumber value={rafterLen} precision={2} /> m
                            </span>
                        </div>
                    </div>

                    {/* Pitch classification badge */}
                    <div className={`${pitchCategory.bgClass} rounded-xl p-4 border border-current/10`}>
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${pitchCategory.dotClass}`} />
                            <span className={`font-bold text-sm ${pitchCategory.colorClass}`}>{pitchCategory.label}</span>
                        </div>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary leading-snug">
                            {pitchCategory.hint}
                        </p>
                    </div>

                    {/* Project hint */}
                    <div className="bg-info-subtle dark:bg-info-subtle-dark rounded-xl p-3 border border-info-border dark:border-info/30 flex items-start gap-2.5">
                        <svg className="w-4 h-4 text-info mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <p className="text-xs text-info-strong dark:text-info leading-snug">
                            Gem spærlængde som indkøb og brug det direkte i tilbud via <strong>Gem til Projekt</strong>.
                        </p>
                    </div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default RoofPitchCalculator;
