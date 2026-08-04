
import React, { useState, useMemo, useRef } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import AnimatedNumber from '../../components/AnimatedNumber';
import { getCalculator, catalogHelpToContent, computeCeilingPanel } from '../../catalog';

const TOOL_ID = 'lofter-tag-loftplader';
const meta = getCalculator(TOOL_ID);

const CeilingPanelCalculator: React.FC = () => {
    const [dims, setDims] = useState({
        areaL: '5', areaW: '4',
        panelL: '1.2', panelW: '0.6',
        wastage: '10',
    });

    const vizRef = useRef<SVGSVGElement>(null);

    const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };

    const results = useMemo(() => {
        const areaLM = parseFloat(dims.areaL) || 0;
        const areaWM = parseFloat(dims.areaW) || 0;
        const panelLM = parseFloat(dims.panelL) || 0;
        const panelWM = parseFloat(dims.panelW) || 0;
        const wastagePct = parseFloat(dims.wastage) || 0;
        if (areaLM <= 0 || areaWM <= 0 || panelLM <= 0 || panelWM <= 0) return { panels: 0, totalAreaM2: 0 };
        return computeCeilingPanel({ areaLM, areaWM, panelLM, panelWM, wastagePct });
    }, [dims]);

    const helpContent = useMemo(
        () => (meta?.help ? catalogHelpToContent(meta.help, meta.standards) : undefined),
        [],
    );

    const reportData: CalculatorReportData = useMemo(() => ({
        toolName: meta?.name ?? 'Loftplade Beregner',
        category: meta?.category ?? 'Lofter & Tag',
        inputs: [
            { label: 'Loft Længde', value: dims.areaL, unit: 'm' },
            { label: 'Loft Bredde', value: dims.areaW, unit: 'm' },
            { label: 'Plade Længde', value: dims.panelL, unit: 'm' },
            { label: 'Plade Bredde', value: dims.panelW, unit: 'm' },
            { label: 'Spild', value: dims.wastage, unit: '%' },
        ],
        results: [
            { label: 'Antal plader', value: String(results.panels), unit: 'stk.', highlight: true },
            { label: 'Areal at købe', value: results.totalAreaM2.toFixed(2), unit: 'm²' },
        ],
        formula: meta?.help?.formula,
        standardsStruktureret: meta?.standards,
        infographicRef: vizRef,
    }), [dims, results]);

    // Visualization: ceiling panel grid
    const areaL = parseFloat(dims.areaL) || 5;
    const areaW = parseFloat(dims.areaW) || 4;
    const panelL = parseFloat(dims.panelL) || 1.2;
    const panelW = parseFloat(dims.panelW) || 0.6;

    const scale = 60;
    const svgW = areaL * scale;
    const svgH = areaW * scale;
    const cellW = panelL * scale;
    const cellH = panelW * scale;

    const colLines: number[] = [];
    for (let x = 0; x <= svgW; x += cellW) colLines.push(x);
    const rowLines: number[] = [];
    for (let y = 0; y <= svgH; y += cellH) rowLines.push(y);

    return (
        <CalculatorPage
            title={meta?.name ?? 'Loftplade Beregner'}
            reportData={reportData}
            helpContent={helpContent}
            shareValue={results.panels > 0 ? `${results.panels} plader · ${results.totalAreaM2.toFixed(2)} m²` : undefined}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white p-6 rounded-card shadow-sm border space-y-4">
                    <h3 className="font-bold text-lg">Indtast Mål</h3>
                    <InputField label="Loft Længde" value={dims.areaL} onChange={e => handleDimChange(e, 'areaL')} unit="m" info="Længden af loftet." />
                    <InputField label="Loft Bredde" value={dims.areaW} onChange={e => handleDimChange(e, 'areaW')} unit="m" info="Bredden af loftet." />
                    <InputField label="Plade Længde" value={dims.panelL} onChange={e => handleDimChange(e, 'panelL')} unit="m" info="Længden på en enkelt loftplade." />
                    <InputField label="Plade Bredde" value={dims.panelW} onChange={e => handleDimChange(e, 'panelW')} unit="m" info="Bredden på en enkelt loftplade." />
                    <InputField label="Spildfaktor" value={dims.wastage} onChange={e => handleDimChange(e, 'wastage')} unit="%" info="Standard spild er 5-10%. Ved komplicerede rum eller mønstre bør der beregnes mere." />
                </div>

                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-card shadow-sm border">
                        <h3 className="font-bold text-lg mb-4">Resultat (inkl. spild)</h3>
                        <div className="space-y-4">
                            <div className="text-center bg-bg-subtle p-3 rounded-lg">
                                <p className="text-sm font-medium text-text-secondary">Antal Plader</p>
                                <div className="text-3xl font-bold text-brand-primary mt-1">
                                    <AnimatedNumber value={results.panels} precision={0} />
                                    <span className="text-2xl ml-1">stk.</span>
                                </div>
                            </div>
                            <div className="text-center bg-bg-subtle p-3 rounded-lg">
                                <p className="text-sm font-medium text-text-secondary">Samlet areal at købe</p>
                                <div className="text-3xl font-bold text-brand-primary mt-1">
                                    <AnimatedNumber value={results.totalAreaM2} precision={2} />
                                    <span className="text-2xl ml-1">m²</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {areaL > 0 && areaW > 0 && panelL > 0 && panelW > 0 && (
                <div className="mt-6 bg-white p-6 rounded-card shadow-sm border">
                    <h3 className="font-bold text-lg mb-2">Pladeopdeling (Loftplan)</h3>
                    <p className="text-sm text-text-secondary mb-4">Viser grid-opdeling baseret på platestørrelse.</p>
                    <div className="w-full overflow-x-auto bg-bg-subtle p-4 rounded-lg border border-border">
                        <svg
                            ref={vizRef}
                            width={svgW + 40}
                            height={svgH + 40}
                            viewBox={`-20 -20 ${svgW + 40} ${svgH + 40}`}
                        >
                            {/* Room background */}
                            <rect x="0" y="0" width={svgW} height={svgH} fill="#f3f4f6" stroke="#9ca3af" strokeWidth="2" />
                            {/* Panel grid columns */}
                            {colLines.map((x, i) => (
                                <line key={`col-${i}`} x1={x} y1="0" x2={x} y2={svgH} stroke="#6b7280" strokeWidth="0.5" strokeDasharray="4 2" />
                            ))}
                            {/* Panel grid rows */}
                            {rowLines.map((y, i) => (
                                <line key={`row-${i}`} x1="0" y1={y} x2={svgW} y2={y} stroke="#6b7280" strokeWidth="0.5" strokeDasharray="4 2" />
                            ))}
                            {/* Room border */}
                            <rect x="0" y="0" width={svgW} height={svgH} fill="none" stroke="#374151" strokeWidth="2" />
                            {/* Dimension labels */}
                            <text x={svgW / 2} y={svgH + 14} textAnchor="middle" fontSize="10" fill="#374151">{areaL} m</text>
                            <text x={-14} y={svgH / 2} textAnchor="middle" fontSize="10" fill="#374151" transform={`rotate(-90, -14, ${svgH / 2})`}>{areaW} m</text>
                            {/* Panel size label */}
                            {cellW > 30 && cellH > 15 && (
                                <text x={cellW / 2} y={cellH / 2 + 4} textAnchor="middle" fontSize="8" fill="#6b7280">
                                    {panelL}×{panelW}
                                </text>
                            )}
                        </svg>
                    </div>
                </div>
            )}
        </CalculatorPage>
    );
};

export default CeilingPanelCalculator;
