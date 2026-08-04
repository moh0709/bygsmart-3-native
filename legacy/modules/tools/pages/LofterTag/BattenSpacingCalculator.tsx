
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage, { type CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import AnimatedNumber from '../../components/AnimatedNumber';
import { CheckCircleIcon, AlertTriangleIcon } from '../../../../components/icons';

const BattenSpacingCalculator: React.FC = () => {
    const [rafterLength, setRafterLength] = useState('500'); // cm
    const [distEaves, setDistEaves] = useState('38'); // cm (Tagfod til forkant lægte 1)
    const [distRidge, setDistRidge] = useState('4'); // cm (Kip til overkant øverste lægte)
    const [tileMax, setTileMax] = useState('37.5'); // cm
    const [tileMin, setTileMin] = useState('31.0'); // cm

    const [results, setResults] = useState({
        spacing: 0,
        numRows: 0,
        isPossible: false,
        message: ''
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string>>) => {
        setter(e.target.value);
    };

    useEffect(() => {
        const L = parseFloat(rafterLength) || 0;
        const dE = parseFloat(distEaves) || 0;
        const dR = parseFloat(distRidge) || 0;
        const max = parseFloat(tileMax) || 0;
        const min = parseFloat(tileMin) || 0;

        if (L > 0 && max > 0 && min > 0 && L > (dE + dR)) {
            const availableLength = L - dE - dR;
            
            // Estimate rows needed based on max spacing (to use fewest rows)
            const estimatedRows = Math.ceil(availableLength / max);
            
            // Exact spacing
            const spacing = availableLength / estimatedRows;
            
            // Validate
            if (spacing >= min && spacing <= max) {
                setResults({
                    spacing,
                    numRows: estimatedRows + 1, // +1 because first batten is at eaves
                    isPossible: true,
                    message: 'OK'
                });
            } else {
                setResults({
                    spacing,
                    numRows: estimatedRows + 1,
                    isPossible: false,
                    message: spacing < min ? 'Afstanden er for lille (under min.)' : 'Afstanden er for stor (over max.)'
                });
            }
        } else {
            setResults({ spacing: 0, numRows: 0, isPossible: false, message: 'Ugyldige mål' });
        }
    }, [rafterLength, distEaves, distRidge, tileMax, tileMin]);

    const Diagram = useMemo(() => {
        const L = parseFloat(rafterLength) || 500;
        const dE = parseFloat(distEaves) || 38;
        const dR = parseFloat(distRidge) || 4;
        const { spacing, numRows, isPossible } = results;

        if (L <= 0) return null;

        const scale = 400 / L;
        const svgH = 60;
        
        const battenW = 5; // visual width of batten

        const battens = [];
        
        // Eaves batten (Tagfod)
        const xEaves = dE * scale; 
        
        // Eaves batten
        battens.push(
            <rect key="eaves" x={dE * scale} y={20} width={battenW} height={10} className="fill-orange-600" />
        );

        // Ridge batten top edge is at L - dR
        const xRidge = (L - dR) * scale;
        battens.push(
            <rect key="ridge" x={xRidge - battenW} y={20} width={battenW} height={10} className="fill-orange-600" />
        );

        // Middle battens
        if (numRows > 2) {
            // results.numRows is battens count. 
            // estimatedRows (spaces) = numRows - 1.
            const estimatedRows = numRows - 1;
            
            for (let i = 1; i <= estimatedRows - 1; i++) { // Draw intermediate
                 const cx = (dE + i * spacing) * scale;
                 battens.push(
                    <rect key={i} x={cx - battenW} y={20} width={battenW} height={10} className="fill-orange-400" />
                 );
            }
        }
        
        return (
            <div className="w-full overflow-x-auto bg-bg-subtle rounded-lg border border-border p-4 mt-4">
                <svg width={400 + 40} height={svgH + 40} viewBox={`-20 -20 ${400 + 60} ${svgH + 40}`}>
                    {/* Rafter */}
                    <rect x="0" y="30" width={400} height="4" className="fill-gray-400" />
                    
                    {/* Battens */}
                    {battens}
                    
                    {/* Labels */}
                    <text x="0" y="50" className="text-[10px] fill-gray-500">Tagfod</text>
                    <text x={400} y="50" textAnchor="end" className="text-[10px] fill-gray-500">Kip</text>
                    
                    {/* Dimension Lines */}
                    <line x1={dE*scale} y1="10" x2={(dE + spacing)*scale} y2="10" className="stroke-brand-primary" strokeWidth="1" markerStart="url(#arrow)" markerEnd="url(#arrow)"/>
                    <text x={(dE + spacing/2)*scale} y="8" textAnchor="middle" className="text-[10px] font-bold fill-brand-primary">{spacing.toFixed(1)} cm</text>
                </svg>
            </div>
        );
    }, [rafterLength, distEaves, distRidge, results]);

    const reportData = useMemo<CalculatorReportData>(() => ({
        toolName: 'Laegteafstand',
        category: 'Lofter & Tag',
        inputs: [
            { label: 'Spærlængde', value: rafterLength, unit: 'cm' },
            { label: 'Afstand Tagfod', value: distEaves, unit: 'cm' },
            { label: 'Afstand Kip', value: distRidge, unit: 'cm' },
            { label: 'Max Lægteafstand', value: tileMax, unit: 'cm' },
            { label: 'Min Lægteafstand', value: tileMin, unit: 'cm' },
        ],
        results: [
            { label: 'Lægteafstand (C/C)', value: results.spacing.toFixed(2), unit: 'cm', highlight: true },
            { label: 'Antal Lægterækker', value: String(results.numRows), unit: 'stk.' },
            { label: 'Status', value: results.isPossible ? 'OK' : results.message },
        ],
    }), [rafterLength, distEaves, distRidge, tileMax, tileMin, results]);

    return (
        <CalculatorPage title="Lægteberegner" reportData={reportData}>
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white p-6 rounded-card shadow-sm border space-y-4">
                    <h3 className="font-bold text-lg">Tagmål</h3>
                    <InputField label="Spærlængde (Tagfod til Kip)" value={rafterLength} onChange={e => handleInputChange(e, setRafterLength)} unit="cm" info="Længden af spæret fra tagfod til kip."/>
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Afstand Tagfod" value={distEaves} onChange={e => handleInputChange(e, setDistEaves)} unit="cm" info="Afstand fra spærende/stern til overkant af første lægte."/>
                        <InputField label="Afstand Kip" value={distRidge} onChange={e => handleInputChange(e, setDistRidge)} unit="cm" info="Afstand fra kip til overkant af øverste lægte."/>
                    </div>
                    
                    <div className="p-4 bg-bg-subtle rounded-lg border border-border">
                        <h4 className="font-semibold text-sm mb-2">Tagsten Data (Dækbredde)</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <InputField label="Max Lægteafstand" value={tileMax} onChange={e => handleInputChange(e, setTileMax)} unit="cm" info="Maksimal tilladt lægteafstand for tagstenen."/>
                            <InputField label="Min Lægteafstand" value={tileMin} onChange={e => handleInputChange(e, setTileMin)} unit="cm" info="Minimal tilladt lægteafstand for tagstenen."/>
                        </div>
                    </div>
                </div>
                
                <div className="space-y-6">
                    <div className={`bg-white p-6 rounded-card shadow-sm border-l-4 ${results.isPossible ? 'border-success' : 'border-danger'}`}>
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            {results.isPossible ? <CheckCircleIcon className="w-6 h-6 text-success"/> : <AlertTriangleIcon className="w-6 h-6 text-danger"/>}
                            Resultat
                        </h3>
                        
                        {results.isPossible ? (
                            <div className="space-y-4">
                                <ResultDisplay label="Lægteafstand (C/C)" value={results.spacing} precision={2} unit="cm" />
                                <div className="text-center">
                                    <p className="text-sm text-text-secondary">Antal Lægterækker</p>
                                    <p className="text-2xl font-bold text-text-primary">{results.numRows} stk.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-danger-strong font-semibold p-4 bg-danger-subtle rounded-lg">
                                {results.message || "Ugyldig konfiguration"}
                            </div>
                        )}
                        
                        {results.isPossible && Diagram}
                    </div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default BattenSpacingCalculator;
