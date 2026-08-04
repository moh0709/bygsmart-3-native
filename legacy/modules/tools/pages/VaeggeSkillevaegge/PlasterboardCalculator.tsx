
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage, { type CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import AnimatedNumber from '../../components/AnimatedNumber';
import { computePlasterboard } from '../../catalog';

const PlasterboardCalculator: React.FC = () => {
    const [dims, setDims] = useState({
        wallL: '5', wallH: '2.5',
        boardL: '2.4', boardW: '1.2',
        layers: '2', wastage: '7',
    });
    const [numBoards, setNumBoards] = useState(0);

    const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        // Formula lives in services/calculatorCatalog.ts (shared with CalculatorPickerModal)
        const r = computePlasterboard({
            wallL: parseFloat(dims.wallL) || 0,
            wallH: parseFloat(dims.wallH) || 0,
            boardL: parseFloat(dims.boardL) || 0,
            boardW: parseFloat(dims.boardW) || 0,
            layers: parseInt(dims.layers) || 0,
            wastagePct: parseFloat(dims.wastage) || 0,
        });
        setNumBoards(r.numBoards);
    }, [dims]);

    const reportData = useMemo<CalculatorReportData>(() => ({
        toolName: 'Gipsplader',
        category: 'Vaegge & Skillevaegge',
        inputs: [
            { label: 'Væglængde', value: dims.wallL, unit: 'm' },
            { label: 'Væghøjde', value: dims.wallH, unit: 'm' },
            { label: 'Plade Længde', value: dims.boardL, unit: 'm' },
            { label: 'Plade Bredde', value: dims.boardW, unit: 'm' },
            { label: 'Antal Lag (1 side)', value: dims.layers, unit: 'stk.' },
            { label: 'Spildfaktor', value: dims.wastage, unit: '%' },
        ],
        results: [
            { label: 'Antal Gipsplader', value: String(numBoards), unit: 'stk.', highlight: true },
        ],
        formula: 'Antal plader = ⌈(Væglængde × Væghøjde × Antal lag × (1 + Spild%)) / (Pladelængde × Pladebredde)⌉',
    }), [dims, numBoards]);

    const Diagram = useMemo(() => {
        const L = parseFloat(dims.wallL) || 5;
        const H = parseFloat(dims.wallH) || 2.5;
        const bW = parseFloat(dims.boardW) || 1.2; // Width of board
        const bH = parseFloat(dims.boardL) || 2.4; // Height of board (usually vertical)

        if (L <= 0 || H <= 0 || bW <= 0 || bH <= 0) return null;

        const scale = 300 / L;
        const svgH = H * scale;
        const svgW = 300;

        const boards = [];
        const cols = Math.ceil(L / bW);
        
        for(let i=0; i<cols; i++) {
            const x = i * bW * scale;
            const w = Math.min(bW, L - i*bW) * scale;
            
            // Stagger logic: Odd columns start from bottom, Even columns might start with offset?
            // Actually for plasterboard, usually vertical joints are unbroken, horizontal joints are staggered.
            // But commonly boards are full height if H <= 2.4m. 
            // If H > 2.4m, we need stacking.
            
            let currentY = 0;
            let row = 0;
            while (currentY < H) {
                // Simple stagger: Shift start height for every second column if multi-row
                let boardHeight = bH;
                
                // If first board in even column, maybe cut it? 
                // Visualizing standard vertical installation
                
                const remainingH = H - currentY;
                const drawH = Math.min(boardHeight, remainingH) * scale;
                const y = (H * scale) - (currentY * scale) - drawH; // SVG coords from top

                boards.push(
                    <g key={`${i}-${row}`}>
                        <rect 
                            x={x} 
                            y={y} 
                            width={w} 
                            height={drawH} 
                            className="fill-gray-50 stroke-gray-400" 
                            strokeWidth="1" 
                        />
                        <text x={x + w/2} y={y + drawH/2} textAnchor="middle" dominantBaseline="middle" className="text-[8px] fill-text-secondary opacity-50">
                            {i+1}.{row+1}
                        </text>
                    </g>
                );
                currentY += boardHeight;
                row++;
            }
        }

        return (
            <div className="w-full overflow-x-auto bg-white rounded-lg border border-border p-4">
                <svg width={svgW + 20} height={svgH + 20} viewBox={`-20 -20 ${svgW + 40} ${svgH + 40}`}>
                    {boards}
                    {/* Dimensions */}
                    <line x1="0" y1={svgH + 5} x2={svgW} y2={svgH + 5} className="stroke-text-primary" strokeWidth="1" />
                    <text x={svgW/2} y={svgH + 15} textAnchor="middle" className="text-[10px]">{L}m</text>
                    
                    <line x1="-5" y1="0" x2="-5" y2={svgH} className="stroke-text-primary" strokeWidth="1" />
                    <text x="-10" y={svgH/2} textAnchor="middle" className="text-[10px]" style={{writingMode: 'vertical-rl'}}>{H}m</text>
                </svg>
            </div>
        );
    }, [dims]);

    return (
        <CalculatorPage title="Gipsplade Beregner" reportData={reportData}>
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white p-6 rounded-card shadow-sm border space-y-4">
                    <h3 className="font-bold text-lg">Indtast Mål</h3>
                    <InputField label="Væglængde" value={dims.wallL} onChange={e => handleDimChange(e, 'wallL')} unit="m" info="Længden på væggen der skal beklædes."/>
                    <InputField label="Væghøjde" value={dims.wallH} onChange={e => handleDimChange(e, 'wallH')} unit="m" info="Højden på væggen."/>
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Plade Længde" value={dims.boardL} onChange={e => handleDimChange(e, 'boardL')} unit="m" info="Længden på én gipsplade."/>
                        <InputField label="Plade Bredde" value={dims.boardW} onChange={e => handleDimChange(e, 'boardW')} unit="m" info="Bredden på én gipsplade."/>
                    </div>
                    <InputField label="Antal Lag (1 side)" value={dims.layers} onChange={e => handleDimChange(e, 'layers')} unit="stk." info="Standardvægge har typisk 2 lag gips på hver side for stabilitet og lyd." />
                    <InputField label="Spildfaktor" value={dims.wastage} onChange={e => handleDimChange(e, 'wastage')} unit="%" info="Inkluder ca. 5-10% spild til tilskæringer." />
                </div>
                
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-card shadow-sm border">
                        <h3 className="font-bold text-lg mb-4">Resultat</h3>
                        <div className="text-center bg-bg-subtle p-4 rounded-lg mb-4">
                            <p className="text-sm font-medium text-text-secondary">Antal Gipsplader</p>
                            <div className="text-4xl font-bold text-brand-primary mt-1">
                                <AnimatedNumber value={numBoards} precision={0} />
                                <span className="text-2xl ml-1">stk.</span>
                            </div>
                        </div>
                        <div className="text-xs text-text-secondary mb-4">
                            Bemærk: Resultatet er for <strong>{dims.layers}</strong> lag på <strong>én side</strong>.
                        </div>
                        
                        <h4 className="font-bold text-sm text-text-primary mb-2">Montageplan (1. lag)</h4>
                        {Diagram}
                    </div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default PlasterboardCalculator;
