
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import AnimatedNumber from '../../components/AnimatedNumber';
import { LayersIcon } from '../../../../components/icons';
import { computeTileQuantity, getCalculator, catalogHelpToContent } from '../../catalog';

const meta = getCalculator('flisemaengde');

const TileQuantityCalculator: React.FC = () => {
    const [dims, setDims] = useState({
        areaL: '4', areaW: '3',
        tileL: '30', tileW: '60',
        grout: '3', wastage: '10'
    });
    const [results, setResults] = useState({ numTiles: 0, totalArea: 0 });

    const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };

    const helpContent = useMemo(() =>
        meta?.help ? catalogHelpToContent(meta.help, meta.standards) : undefined,
    []);

    useEffect(() => {
        // Formula lives in services/calculatorCatalog.ts (shared with CalculatorPickerModal)
        const r = computeTileQuantity({
            areaL: parseFloat(dims.areaL) || 0,
            areaW: parseFloat(dims.areaW) || 0,
            tileLcm: parseFloat(dims.tileL) || 0,
            tileWcm: parseFloat(dims.tileW) || 0,
            groutMm: parseFloat(dims.grout) || 0,
            wastagePct: parseFloat(dims.wastage) || 0,
        });
        setResults({ numTiles: r.numTiles, totalArea: r.totalArea });
    }, [dims]);

    const reportData: CalculatorReportData = useMemo(() => ({
        toolName: 'Flisemængde Beregner',
        category: meta?.category,
        inputs: [
            { label: 'Rum Længde', value: dims.areaL, unit: 'm' },
            { label: 'Rum Bredde', value: dims.areaW, unit: 'm' },
            { label: 'Fliselængde', value: dims.tileL, unit: 'cm' },
            { label: 'Flisebredde', value: dims.tileW, unit: 'cm' },
            { label: 'Fugebredde', value: dims.grout, unit: 'mm' },
            { label: 'Spild', value: dims.wastage, unit: '%' },
        ],
        results: [
            { label: 'Antal fliser', value: String(results.numTiles), unit: 'stk.', highlight: true },
            { label: 'Areal at købe', value: results.totalArea.toFixed(2), unit: 'm²' },
        ],
        formula: meta?.help?.formula,
        standardsStruktureret: meta?.standards,
    }), [dims, results]);

    const TileVisualizer = useMemo(() => {
        const tL = parseFloat(dims.tileL) || 30;
        const tW = parseFloat(dims.tileW) || 60;
        // Normalize for visualization
        const maxDim = Math.max(tL, tW);
        const scale = 80 / maxDim;
        const w = tW * scale;
        const h = tL * scale;
        
        return (
            <div className="w-full h-32 bg-bg-muted rounded-lg flex items-center justify-center overflow-hidden border border-border relative">
                 <div className="absolute inset-0 opacity-10" 
                      style={{
                          backgroundImage: `linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)`,
                          backgroundSize: `${w}px ${h}px`
                      }}>
                 </div>
                 <div className="bg-white border-2 border-brand-primary shadow-sm flex items-center justify-center" style={{ width: w, height: h }}>
                    <span className="text-[8px] text-brand-primary font-bold">{dims.tileW}x{dims.tileL}</span>
                 </div>
                 <div className="absolute bottom-2 right-2 bg-white/80 px-2 py-1 rounded text-xs text-text-secondary border">
                     Lægningsmønster (Grid)
                 </div>
            </div>
        )
    }, [dims.tileL, dims.tileW]);

    return (
        <CalculatorPage
            title="Flisemængde Beregner"
            helpContent={helpContent}
            reportData={reportData}
            shareValue={results.numTiles > 0 ? `${results.numTiles} fliser · ${results.totalArea.toFixed(2)} m²` : undefined}
            stickyResultLabel="Antal fliser"
            stickyResult={<><AnimatedNumber value={results.numTiles} precision={0} /> stk.</>}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white p-6 rounded-card shadow-sm border space-y-4">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <LayersIcon className="w-5 h-5 text-brand-primary"/>
                        Indtast Mål
                    </h3>
                    
                    <div className="p-4 bg-bg-subtle rounded-lg border border-border">
                        <h4 className="font-semibold mb-2 text-sm text-text-secondary uppercase tracking-wide">Rum Dimensioner</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <InputField label="Længde" value={dims.areaL} onChange={e => handleDimChange(e, 'areaL')} unit="m" info="Rummets indvendige længde."/>
                            <InputField label="Bredde" value={dims.areaW} onChange={e => handleDimChange(e, 'areaW')} unit="m" info="Rummets indvendige bredde."/>
                        </div>
                    </div>

                    <div className="p-4 bg-bg-subtle rounded-lg border border-border">
                        <h4 className="font-semibold mb-2 text-sm text-text-secondary uppercase tracking-wide">Flise & Fuge</h4>
                        <div className="grid grid-cols-2 gap-4">
                             <InputField label="Fliselængde" value={dims.tileL} onChange={e => handleDimChange(e, 'tileL')} unit="cm" info="Længden på én flise."/>
                             <InputField label="Flisebredde" value={dims.tileW} onChange={e => handleDimChange(e, 'tileW')} unit="cm" info="Bredden på én flise."/>
                        </div>
                        <div className="mt-4">
                            <InputField label="Fugebredde" value={dims.grout} onChange={e => handleDimChange(e, 'grout')} unit="mm" info="Bredden på fugen mellem fliserne (typisk 2-5mm)."/>
                        </div>
                    </div>

                    <InputField 
                        label="Spildfaktor" 
                        value={dims.wastage} 
                        onChange={e => handleDimChange(e, 'wastage')} 
                        unit="%"
                        info="En margin for tilskæringer og brud. 10% er standard for simple lægninger, 15-20% for mønstre eller uregelmæssige rum."
                    />
                </div>
                
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-card shadow-sm border">
                        <h3 className="font-bold text-lg mb-4">Resultat (inkl. spild)</h3>
                        
                        {TileVisualizer}

                        <div className="space-y-4 mt-6">
                            <div className="flex justify-between items-center bg-info-subtle p-4 rounded-lg border border-info-border">
                                <div>
                                    <p className="text-sm font-medium text-info-strong">Antal Fliser</p>
                                    <p className="text-xs text-info-strong">Inkl. {dims.wastage}% til skæring</p>
                                </div>
                                <div className="text-3xl font-bold text-brand-primary">
                                    <AnimatedNumber value={results.numTiles} precision={0} />
                                    <span className="text-xl ml-1 font-medium">stk.</span>
                                </div>
                            </div>
                            
                            <div className="flex justify-between items-center bg-bg-subtle p-4 rounded-lg border border-border">
                                <p className="text-sm font-medium text-text-secondary">Areal at købe</p>
                                <div className="text-2xl font-bold text-text-primary">
                                    <AnimatedNumber value={results.totalArea} precision={2} />
                                    <span className="text-lg ml-1 font-medium">m²</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="mt-4 text-xs text-warning-strong bg-warning-subtle p-3 rounded border border-warning-border">
                            <strong>Tip:</strong> Husk at tjekke pakningsstørrelsen hos leverandøren. Fliser sælges ofte i hele pakker (f.eks. 1.44 m² pr. pakke).
                        </div>
                    </div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default TileQuantityCalculator;
