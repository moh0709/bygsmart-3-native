
import React, { useState, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { HelpContent, CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import AnimatedNumber from '../../components/AnimatedNumber';
import { InfoHint } from '../../../../components/ui';
import { computeLoftArea } from '../../catalog';
import { CheckCircleIcon, AlertTriangleIcon } from '../../../../components/icons';

const helpContent: HelpContent = {
    formaal: 'Beregner det tællende gulvareal i et rum med skråt loft (fx tagetage/skunk) iht. BR18 Bilag 1. Kun gulvareal hvor loftshøjden er ≥ 1,5 m tæller med i boligarealet, og et opholdsrum kræver et areal med fuld højde (≥ 2,3 m).',
    variabler: [
        { name: 'Rumlængde', symbol: 'L', unit: 'm', description: 'Længden langs kippen (parallelt med tagryggen).' },
        { name: 'Rumbredde', symbol: 'B', unit: 'm', description: 'Bredden på tværs — fra den lave skunkvæg til den høje side.' },
        { name: 'Skunkhøjde', symbol: 'h_k', unit: 'm', description: 'Loftshøjden ved den lave (skunk-)væg.' },
        { name: 'Taghældning', symbol: 'α', unit: '°', description: 'Loftets/tagets hældningsvinkel.' },
    ],
    formel: 'Højde h(x) = h_k + x·tan(α)\nAfstand til 1,5 m: x₁,₅ = (1,5 − h_k)/tan(α)\nTællende areal = L × (B − x₁,₅)\nFuld-højde areal (≥2,3 m) = L × (B − x₂,₃)',
    antagelser: 'Ét skråt loftplan der stiger fra skunkvæggen. Ved dobbelt-skråt (symmetrisk) rum: beregn hver halvdel for sig og læg sammen. BBR-areal måles indvendigt.',
    standarder: 'BR18 Bilag 1 – Beregning af areal (tællende gulvareal ≥ 1,5 m)\nBR18 §431 – Min. 2,3 m loftshøjde i opholdsrum',
};

const LoftAreaCalculator: React.FC = () => {
    const [length, setLength] = useState('6');
    const [width, setWidth] = useState('4');
    const [knee, setKnee] = useState('0.9');
    const [pitch, setPitch] = useState('45');

    const r = useMemo(() => computeLoftArea({
        roomLengthM: parseFloat(length) || 0,
        roomWidthM: parseFloat(width) || 0,
        kneeWallHeightM: parseFloat(knee) || 0,
        pitchDeg: parseFloat(pitch) || 0,
    }), [length, width, knee, pitch]);

    const hasFullHeight = r.fullHeightAreaM2 > 0;
    const lostArea = r.totalFloorAreaM2 - r.countedAreaM2;

    const reportData: CalculatorReportData = {
        toolName: 'Skråtag / skunk — tællende areal',
        category: 'Areal & Rumfang',
        inputs: [
            { label: 'Rumlængde', value: length, unit: 'm' },
            { label: 'Rumbredde', value: width, unit: 'm' },
            { label: 'Skunkhøjde', value: knee, unit: 'm' },
            { label: 'Taghældning', value: pitch, unit: '°' },
        ],
        results: [
            { label: 'Tællende areal (≥1,5 m)', value: r.countedAreaM2.toFixed(2), unit: 'm²', highlight: true },
            { label: 'Areal med fuld højde (≥2,3 m)', value: r.fullHeightAreaM2.toFixed(2), unit: 'm²' },
            { label: 'Samlet gulvareal', value: r.totalFloorAreaM2.toFixed(2), unit: 'm²' },
            { label: 'Ikke-tællende (skunk)', value: lostArea.toFixed(2), unit: 'm²' },
        ],
        formula: 'x₁,₅ = (1,5 − h_k)/tan(α) ; Tællende = L·(B − x₁,₅)',
        standardsStruktureret: [
            { code: 'BR18', clause: 'Bilag 1', note: 'Tællende gulvareal ved skråt loft (≥ 1,5 m).' },
            { code: 'BR18', clause: '§431', note: 'Min. 2,3 m loftshøjde i opholdsrum.' },
        ],
    };

    // Cross-section: knee wall + sloped ceiling, with the 1.5m and 2.3m markers
    const Diagram = useMemo(() => {
        const B = Math.max(parseFloat(width) || 1, 0.1);
        const hk = parseFloat(knee) || 0;
        const tan = Math.tan(((parseFloat(pitch) || 0) * Math.PI) / 180);
        const hHigh = hk + B * tan;
        const maxH = Math.max(hHigh, 2.6, 0.1);
        const vw = 180, vh = 110, pad = 14;
        const sx = (vw - pad * 2) / B;
        const sy = (vh - pad * 2) / maxH;
        const x0 = pad, yBase = vh - pad;
        const px = (x: number) => x0 + x * sx;
        const py = (h: number) => yBase - h * sy;
        const xMin = r.distanceToMinM;
        const xFull = r.distanceToFullM;
        return (
            <svg viewBox={`0 0 ${vw} ${vh}`} className="w-full h-auto max-h-44">
                {/* floor */}
                <line x1={px(0)} y1={yBase} x2={px(B)} y2={yBase} className="stroke-text-secondary" strokeWidth="1" />
                {/* knee wall + sloped ceiling + high wall */}
                <path d={`M${px(0)},${yBase} L${px(0)},${py(hk)} L${px(B)},${py(hHigh)} L${px(B)},${yBase}`} fill="rgba(59,130,246,0.08)" className="stroke-brand-primary" strokeWidth="1.5" />
                {/* counted-area shading (x>=xMin) */}
                <rect x={px(xMin)} y={yBase - 3} width={px(B) - px(xMin)} height="3" className="fill-success" />
                {/* 1.5m marker */}
                {xMin > 0 && xMin < B && (
                    <>
                        <line x1={px(xMin)} y1={yBase} x2={px(xMin)} y2={py(1.5)} className="stroke-success" strokeWidth="1" strokeDasharray="3" />
                        <text x={px(xMin)} y={py(1.5) - 2} textAnchor="middle" fontSize="7" className="fill-success-strong">1,5 m</text>
                    </>
                )}
                {/* 2.3m marker */}
                {xFull > 0 && xFull < B && (
                    <>
                        <line x1={px(xFull)} y1={yBase} x2={px(xFull)} y2={py(2.3)} className="stroke-brand-primary" strokeWidth="1" strokeDasharray="3" />
                        <text x={px(xFull)} y={py(2.3) - 2} textAnchor="middle" fontSize="7" className="fill-brand-primary">2,3 m</text>
                    </>
                )}
                <text x={px(0)} y={py(hk) - 3} textAnchor="middle" fontSize="7" className="fill-text-secondary">{hk} m</text>
            </svg>
        );
    }, [width, knee, pitch, r.distanceToMinM, r.distanceToFullM]);

    return (
        <CalculatorPage
            title="Skråtag / skunk — tællende areal"
            helpContent={helpContent}
            reportData={reportData}
            stickyResultLabel="Tællende areal"
            stickyResult={<><AnimatedNumber value={r.countedAreaM2} precision={2} /> m²</>}
            shareValue={`Tællende areal: ${r.countedAreaM2.toFixed(2)} m² af ${r.totalFloorAreaM2.toFixed(2)} m² (BR18 Bilag 1)`}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-lg">Rummets mål</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Rumlængde (L)" value={length} onChange={e => setLength(e.target.value)} unit="m" info="Langs tagryggen." />
                        <InputField label="Rumbredde (B)" value={width} onChange={e => setWidth(e.target.value)} unit="m" info="Fra skunkvæg til høj side." />
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="flex-1">
                            <InputField label="Skunkhøjde (h_k)" value={knee} onChange={e => setKnee(e.target.value)} unit="m" info="Loftshøjden ved den lave væg." />
                        </div>
                        <InfoHint
                            title="BR18 Bilag 1 — tællende areal"
                            description="I rum med skråt loft tæller kun det gulvareal, hvor der er mindst 1,5 m loftshøjde, med i boligarealet (BBR). Arealet under 1,5 m (skunken) tæller ikke."
                            calculation="x₁,₅ = (1,5 − skunkhøjde)/tan(hældning) → tællende = L·(B − x₁,₅)"
                        />
                    </div>
                    <InputField label="Taghældning (α)" value={pitch} onChange={e => setPitch(e.target.value)} unit="°" info="Loftets hældning. Fx 45°." />
                </div>

                <div className="space-y-4">
                    <div className={`p-5 rounded-card border-l-4 shadow-sm ${hasFullHeight ? 'bg-success-subtle border-success dark:bg-success-subtle-dark' : 'bg-warning-subtle border-warning dark:bg-warning-subtle-dark'}`}>
                        <div className="flex items-start gap-3">
                            {hasFullHeight ? <CheckCircleIcon className="w-6 h-6 text-success flex-shrink-0" /> : <AlertTriangleIcon className="w-6 h-6 text-warning flex-shrink-0" />}
                            <div>
                                <h4 className={`font-bold ${hasFullHeight ? 'text-success-strong dark:text-success' : 'text-warning-strong dark:text-warning'}`}>
                                    Tællende areal: {r.countedAreaM2.toFixed(2)} m²
                                </h4>
                                <p className="text-sm mt-0.5 text-text-primary dark:text-text-dark-primary">
                                    {hasFullHeight
                                        ? `${r.fullHeightAreaM2.toFixed(2)} m² har fuld højde (≥ 2,3 m) og kan bruges som opholdsrum. Skunk under 1,5 m (${lostArea.toFixed(2)} m²) tæller ikke.`
                                        : `Ingen del af rummet når 2,3 m loftshøjde — det opfylder ikke BR18 §431 for opholdsrum. Skunk under 1,5 m (${lostArea.toFixed(2)} m²) tæller ikke.`}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <ResultDisplay label="Tællende (≥1,5 m)" value={r.countedAreaM2} precision={2} unit="m²" />
                        <ResultDisplay label="Fuld højde (≥2,3 m)" value={r.fullHeightAreaM2} precision={2} unit="m²" />
                    </div>

                    <div className="bg-white dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark">
                        <h4 className="text-sm font-semibold mb-2 text-text-secondary dark:text-text-dark-secondary">Tværsnit med højdegrænser</h4>
                        {Diagram}
                    </div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default LoftAreaCalculator;
