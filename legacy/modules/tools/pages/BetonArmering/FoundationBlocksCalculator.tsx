
import React, { useState, useMemo, useRef } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import { computeFoundationBlocks, getCalculator, catalogHelpToContent } from '../../catalog';

const TOOL_ID = 'beton-armering-fundablokke';
const meta = getCalculator(TOOL_ID);

const FoundationBlocksCalculator: React.FC = () => {
    const [dims, setDims] = useState({
        perimeter: '24',
        height: '0.6',
        blockL: '600',
        blockH: '250',
        joint: '12',
        wastage: '5',
    });

    const vizRef = useRef<SVGSVGElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };

    const results = useMemo(() => {
        const perimeterM = parseFloat(dims.perimeter) || 0;
        const heightM = parseFloat(dims.height) || 0;
        const blockLmm = parseFloat(dims.blockL) || 600;
        const blockHmm = parseFloat(dims.blockH) || 250;
        const jointMm = parseFloat(dims.joint) || 12;
        const wastagePct = parseFloat(dims.wastage) || 0;
        if (perimeterM <= 0 || heightM <= 0) return { total: 0, blocksPerRow: 0, rows: 0 };
        return computeFoundationBlocks({ perimeterM, heightM, blockLmm, blockHmm, jointMm, wastagePct });
    }, [dims]);

    const helpContent = useMemo(
        () => (meta?.help ? catalogHelpToContent(meta.help, meta.standards) : undefined),
        [],
    );

    const reportData: CalculatorReportData = useMemo(() => ({
        toolName: meta?.name ?? 'Fundablokke',
        category: meta?.category ?? 'Beton & Armering',
        inputs: [
            { label: 'Fundamentperimeter', value: dims.perimeter, unit: 'm' },
            { label: 'Fundamenthøjde', value: dims.height, unit: 'm' },
            { label: 'Bloklængde', value: dims.blockL, unit: 'mm' },
            { label: 'Blokhøjde', value: dims.blockH, unit: 'mm' },
            { label: 'Fugetykkelse', value: dims.joint, unit: 'mm' },
            { label: 'Spild', value: dims.wastage, unit: '%' },
        ],
        results: [
            { label: 'Antal blokke i alt', value: String(results.total), unit: 'stk.', highlight: true },
            { label: 'Blokke pr. række', value: String(results.blocksPerRow), unit: 'stk.' },
            { label: 'Antal rækker', value: String(results.rows), unit: 'rækker' },
        ],
        formula: meta?.help?.formula,
        standardsStruktureret: meta?.standards,
        safetyDisclaimer: 'BR18 §§167–168 og DS/EN 1997-1 stiller krav til fundamentering. Fundament under terræn skal dimensioneres af konstruktør.',
        infographicRef: vizRef,
    }), [dims, results]);

    // Visualization: side-elevation block grid
    const blockLmm = parseFloat(dims.blockL) || 600;
    const blockHmm = parseFloat(dims.blockH) || 250;
    const jointMm = parseFloat(dims.joint) || 12;
    const rows = results.rows;
    const blocksPerRow = results.blocksPerRow;

    const visibleCols = Math.min(blocksPerRow, 12);
    const visibleRows = Math.min(rows, 8);
    const cellW = 40;
    const cellH = 18;
    const svgW = visibleCols * cellW + 20;
    const svgH = visibleRows * cellH + 30;

    return (
        <CalculatorPage
            title={meta?.name ?? 'Fundablokke Beregner'}
            helpContent={helpContent}
            reportData={reportData}
            shareValue={results.total > 0 ? `${results.total} blokke · ${results.rows} rækker` : undefined}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border space-y-4">
                    <h3 className="font-bold text-lg">Fundament Dimensioner</h3>
                    <InputField label="Fundamentperimeter" value={dims.perimeter} onChange={e => handleChange(e, 'perimeter')} unit="m" info="Den totale udvendige perimeter af fundamentet." />
                    <InputField label="Fundamenthøjde" value={dims.height} onChange={e => handleChange(e, 'height')} unit="m" info="Fundamentets samlede højde over terræn (f.eks. 3 skifter × 0,25 m = 0,75 m)." />
                    <InputField label="Bloklængde" value={dims.blockL} onChange={e => handleChange(e, 'blockL')} unit="mm" info="Standard letbeton fundablok: 600 mm." />
                    <InputField label="Blokhøjde" value={dims.blockH} onChange={e => handleChange(e, 'blockH')} unit="mm" info="Standard letbeton fundablok: 250 mm (eller 200 mm)." />
                    <InputField label="Fugetykkelse" value={dims.joint} onChange={e => handleChange(e, 'joint')} unit="mm" info="Standard: 12 mm mørtel." />
                    <InputField label="Spild" value={dims.wastage} onChange={e => handleChange(e, 'wastage')} unit="%" info="Margin for knækkede blokke og tilpasninger — typisk 5 %." />
                </div>

                <div className="space-y-6">
                    <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border">
                        <h3 className="font-bold text-lg mb-4">Materialeliste</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <ResultDisplay label="Blokke i alt" value={results.total} precision={0} unit="stk" />
                            <ResultDisplay label="Pr. række" value={results.blocksPerRow} precision={0} unit="stk" />
                            <ResultDisplay label="Rækker" value={results.rows} precision={0} unit="stk" />
                        </div>
                    </div>

                    {results.total > 0 && (
                        <div className="bg-bg dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border">
                            <h4 className="font-bold text-sm text-text-secondary mb-3">Opstalt preview (side)</h4>
                            <div className="overflow-x-auto">
                                <svg
                                    ref={vizRef}
                                    width={svgW}
                                    height={svgH}
                                    viewBox={`0 0 ${svgW} ${svgH}`}
                                >
                                    {Array.from({ length: visibleRows }).map((_, rowIdx) => {
                                        const y = (visibleRows - 1 - rowIdx) * cellH;
                                        const offset = rowIdx % 2 === 1 ? cellW / 2 : 0;
                                        return Array.from({ length: visibleCols }).map((_, colIdx) => {
                                            const x = colIdx * cellW - offset;
                                            if (x + cellW < 0 || x > svgW) return null;
                                            return (
                                                <rect
                                                    key={`${rowIdx}-${colIdx}`}
                                                    x={Math.max(0, x) + 1}
                                                    y={y + 1}
                                                    width={Math.min(cellW - 2, svgW - Math.max(0, x) - 1)}
                                                    height={cellH - 2}
                                                    className="fill-gray-300 stroke-gray-500"
                                                    strokeWidth="0.5"
                                                />
                                            );
                                        });
                                    })}
                                    {/* Ground line */}
                                    <line x1="0" y1={visibleRows * cellH + 2} x2={svgW} y2={visibleRows * cellH + 2} stroke="#374151" strokeWidth="1" />
                                    <text x={svgW / 2} y={visibleRows * cellH + 18} textAnchor="middle" fontSize="10" fill="#374151">
                                        {blocksPerRow} blokke × {rows} rækker ({(blockLmm / 1000).toFixed(2)}m × {(blockHmm / 1000).toFixed(2)}m, fuge {jointMm}mm)
                                        {(blocksPerRow > visibleCols || rows > visibleRows) ? ' — afkortet' : ''}
                                    </text>
                                </svg>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </CalculatorPage>
    );
};

export default FoundationBlocksCalculator;
