
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage, { type CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import RegulationSwitch from '../../components/RegulationSwitch';
import ComplianceAlert from '../../components/ComplianceAlert';
import { computeVolume } from '../../catalog';

const VolumeCalculator: React.FC = () => {
    const [dims, setDims] = useState({ length: '5', width: '4', height: '2.5' });
    const [volume, setVolume] = useState(0);
    
    // Compliance State
    const [isBR18Active, setIsBR18Active] = useState(false);
    const [compliance, setCompliance] = useState({ passed: false, message: '' });

    const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        const l = parseFloat(dims.length) || 0;
        const w = parseFloat(dims.width) || 0;
        const h = parseFloat(dims.height) || 0;
        const result = computeVolume({ length: l, width: w, height: h });
        setVolume(result.volume);

        // BR18 Ceiling Height Check
        // Min. 2,3 m loftshøjde for beboelsesrum (BR18 § 431)
        if (result.ceilingHeightOk) {
             setCompliance({ passed: true, message: `Loftshøjden på ${h} m overholder minimumskravet for beboelsesrum.` });
        } else if (h > 0) {
             setCompliance({ passed: false, message: `Loftshøjden på ${h} m er under minimumskravet på 2,3 m for beboelsesrum i henhold til bygningsreglementet.` });
        } else {
             setCompliance({ passed: false, message: 'Indtast højde.' });
        }

    }, [dims]);

    const reportData = useMemo<CalculatorReportData>(() => ({
        toolName: 'Volumen Beregner',
        category: 'Areal & Rumfang',
        inputs: [
            { label: 'Længde', value: dims.length, unit: 'm' },
            { label: 'Bredde', value: dims.width, unit: 'm' },
            { label: 'Højde', value: dims.height, unit: 'm' },
        ],
        results: [
            { label: 'Rumfang', value: volume.toFixed(2), unit: 'm³', highlight: true },
        ],
        formula: 'Rumfang = Længde × Bredde × Højde',
        standardsStruktureret: [
            { code: 'BR18', clause: 'Kap. 8, § 431', note: 'Minimumsloftshøjde 2,3 m for beboelsesrum' },
        ],
    }), [dims, volume]);

    return (
        <CalculatorPage title="Rumfangsberegner" reportData={reportData}>
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white p-6 rounded-card shadow-sm border space-y-4">
                    <RegulationSwitch isActive={isBR18Active} onToggle={setIsBR18Active} />

                    <h3 className="font-bold text-lg">Indtast Rummål</h3>
                    <InputField label="Længde" value={dims.length} onChange={(e) => handleDimChange(e, 'length')} unit="m" info="Rummets længde."/>
                    <InputField label="Bredde" value={dims.width} onChange={(e) => handleDimChange(e, 'width')} unit="m" info="Rummets bredde."/>
                    <InputField 
                        label="Højde" 
                        value={dims.height} 
                        onChange={(e) => handleDimChange(e, 'height')} 
                        unit="m" 
                        info="Højden fra gulv til loft. BR18 kræver typisk min. 2.30m i beboelsesrum."
                    />
                </div>
                
                <div className="space-y-6">
                    <ResultDisplay 
                        label="Rumfang" 
                        value={volume} 
                        unit={<>m<sup>3</sup></>} 
                    />

                    <ComplianceAlert 
                        isActive={isBR18Active}
                        passed={compliance.passed}
                        message={compliance.message}
                        ruleRef="BR18, Kap. 8, § 431"
                    />
                </div>
            </div>
        </CalculatorPage>
    );
};

export default VolumeCalculator;
