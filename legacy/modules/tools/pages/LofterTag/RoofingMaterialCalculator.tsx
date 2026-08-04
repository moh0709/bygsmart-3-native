
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage, { type CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import AnimatedNumber from '../../components/AnimatedNumber';

const RoofingMaterialCalculator: React.FC = () => {
    const [dims, setDims] = useState({
        roofL: '10', // Roof Length (e.g., gutter length)
        slopeL: '5', // Slope Length (rafter length)
        tileL: '42', // cm
        tileW: '33', // cm
        overlap: '8', // cm (Headlap)
        sideLap: '3', // cm
        wastage: '5',
    });
    const [results, setResults] = useState({ 
        rows: 0, 
        tilesPerRow: 0, 
        totalTiles: 0, 
        battenDistance: 0,
        effectiveArea: 0
    });

    const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        const rL = parseFloat(dims.roofL) * 100 || 0; // cm
        const sL = parseFloat(dims.slopeL) * 100 || 0; // cm
        const tL = parseFloat(dims.tileL) || 0;
        const tW = parseFloat(dims.tileW) || 0;
        const ol = parseFloat(dims.overlap) || 0;
        const sl = parseFloat(dims.sideLap) || 0;
        const waste = parseFloat(dims.wastage) || 0;

        if (rL > 0 && sL > 0 && tL > 0 && tW > 0) {
            const effectiveTileL = tL - ol;
            const effectiveTileW = tW - sl;

            // Rows (Vertical)
            // Usually exact calculation involves distributing the remaining space to adjust batten distance
            const rawRows = sL / effectiveTileL;
            const rows = Math.ceil(rawRows);
            const actualBattenDist = rows > 0 ? sL / rows : 0;

            // Tiles per Row (Horizontal)
            const tilesPerRow = Math.ceil(rL / effectiveTileW);

            const totalBase = rows * tilesPerRow;
            const totalWithWaste = Math.ceil(totalBase * (1 + waste / 100));

            setResults({
                rows,
                tilesPerRow,
                totalTiles: totalWithWaste,
                battenDistance: actualBattenDist,
                effectiveArea: (rL/100) * (sL/100)
            });
        } else {
            setResults({ rows: 0, tilesPerRow: 0, totalTiles: 0, battenDistance: 0, effectiveArea: 0 });
        }
    }, [dims]);

    const reportData = useMemo<CalculatorReportData>(() => ({
        toolName: 'Tagmaterialer',
        category: 'Lofter & Tag',
        inputs: [
            { label: 'Tagflade Længde (Tagfod)', value: dims.roofL, unit: 'm' },
            { label: 'Tagflade Højde (Spærlængde)', value: dims.slopeL, unit: 'm' },
            { label: 'Tagsten Længde', value: dims.tileL, unit: 'cm' },
            { label: 'Tagsten Bredde', value: dims.tileW, unit: 'cm' },
            { label: 'Overlap (Top)', value: dims.overlap, unit: 'cm' },
            { label: 'Sideoverlap', value: dims.sideLap, unit: 'cm' },
            { label: 'Spild', value: dims.wastage, unit: '%' },
        ],
        results: [
            { label: 'Antal Sten', value: results.totalTiles.toFixed(0), unit: 'stk.', highlight: true },
            { label: 'Lægteafstand (c/c)', value: results.battenDistance.toFixed(1), unit: 'cm' },
            { label: 'Antal Rækker', value: results.rows.toFixed(0) },
            { label: 'Sten pr. Række', value: results.tilesPerRow.toFixed(0) },
            { label: 'Effektivt Tagfladeareal', value: results.effectiveArea.toFixed(2), unit: 'm²' },
        ],
        formula: 'Rækker = ⌈Spærlængde / (Stenlængde − Overlap)⌉; Sten pr. række = ⌈Tagfodlængde / (Stenbredde − Sideoverlap)⌉; Total = Rækker × Sten pr. række × (1 + Spild/100)',
    }), [dims, results]);

    const LayoutDiagram = useMemo(() => {
        const { rows, tilesPerRow } = results;
        if (rows <= 0 || tilesPerRow <= 0) return null;

        // SVG Scale
        const w = 400;
        const h = (rows / tilesPerRow) * w; // Maintain aspect ratio roughly
        const clampedH = Math.min(Math.max(h, 150), 400); // Clamp visual height
        
        const tileW = w / tilesPerRow;
        const tileH = clampedH / rows;

        const visualTiles = [];
        // Only draw up to 20x20 tiles to save rendering performance visually
        const maxShow = 15;
        
        for(let r=0; r < Math.min(rows, maxShow); r++) {
            for(let c=0; c < Math.min(tilesPerRow, maxShow); c++) {
                visualTiles.push(
                    <rect 
                        key={`${r}-${c}`}
                        x={c * tileW}
                        y={r * tileH}
                        width={tileW}
                        height={tileH}
                        className="fill-orange-100 stroke-orange-400"
                        strokeWidth="0.5"
                    />
                );
            }
        }

        return (
            <div className="w-full flex flex-col items-center bg-white rounded-lg border border-border p-4">
                <svg width="100%" height={clampedH} viewBox={`-10 -10 ${w + 20} ${clampedH + 20}`} preserveAspectRatio="none">
                    {visualTiles}
                    {/* Fade out if truncated */}
                    {(rows > maxShow || tilesPerRow > maxShow) && (
                        <rect x="0" y="0" width="100%" height="100%" fill="url(#fadeGradient)" />
                    )}
                    <defs>
                        <linearGradient id="fadeGradient" x1="0" x2="1" y1="0" y2="1">
                            <stop offset="70%" stopColor="white" stopOpacity="0"/>
                            <stop offset="100%" stopColor="white" stopOpacity="0.8"/>
                        </linearGradient>
                    </defs>
                </svg>
                <div className="flex justify-between w-full mt-2 text-xs text-text-secondary">
                    <span>← {tilesPerRow} sten (Bredde) →</span>
                    <span>↕ {rows} rækker (Højde)</span>
                </div>
            </div>
        );
    }, [results]);

    return (
        <CalculatorPage title="Tagstens Layout" reportData={reportData}>
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white p-6 rounded-card shadow-sm border space-y-4">
                    <h3 className="font-bold text-lg">Tagets Dimensioner</h3>
                    <InputField label="Tagflade Længde (Tagfod)" value={dims.roofL} onChange={e => handleDimChange(e, 'roofL')} unit="m" info="Længden af taget langs tagrenden." />
                    <InputField label="Tagflade Højde (Spærlængde)" value={dims.slopeL} onChange={e => handleDimChange(e, 'slopeL')} unit="m" info="Længden fra tagfod til kip (skråt mål)." />
                    
                    <div className="p-4 bg-bg-subtle rounded-lg border border-border mt-4">
                        <h4 className="font-bold text-sm mb-2">Tagsten Data (cm)</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <InputField label="Længde" value={dims.tileL} onChange={e => handleDimChange(e, 'tileL')} unit="cm" info="Længden af en enkelt tagsten."/>
                            <InputField label="Bredde" value={dims.tileW} onChange={e => handleDimChange(e, 'tileW')} unit="cm" info="Bredden af en enkelt tagsten."/>
                            <InputField label="Overlap (Top)" value={dims.overlap} onChange={e => handleDimChange(e, 'overlap')} unit="cm" info="Hvor meget en sten dækker over den næste (headlap)."/>
                            <InputField label="Sideoverlap" value={dims.sideLap} onChange={e => handleDimChange(e, 'sideLap')} unit="cm" info="Hvor meget stenen overlapper i bredden (sidelap)."/>
                        </div>
                    </div>
                    
                    <InputField label="Spild (%)" value={dims.wastage} onChange={e => handleDimChange(e, 'wastage')} unit="%" info="Ekstra sten til skæringer og brud. 5-10% anbefales."/>
                </div>
                
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-card shadow-sm border">
                        <h3 className="font-bold text-lg mb-4">Resultat</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <ResultDisplay label="Antal Sten" value={results.totalTiles} precision={0} unit="stk." />
                            <ResultDisplay label="Lægteafstand (c/c)" value={results.battenDistance} precision={1} unit="cm" />
                        </div>
                        
                        <div className="mt-6 pt-6 border-t">
                            <h4 className="font-bold text-sm text-text-secondary mb-2">Layout Preview</h4>
                            {LayoutDiagram}
                        </div>
                        <div className="mt-4 p-3 bg-info-subtle rounded-lg text-sm text-info-strong">
                            <p>Effektivt dækmål pr. sten: <strong>{(parseFloat(dims.tileW)-parseFloat(dims.sideLap)).toFixed(1)} x {(parseFloat(dims.tileL)-parseFloat(dims.overlap)).toFixed(1)} cm</strong></p>
                        </div>
                    </div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default RoofingMaterialCalculator;
