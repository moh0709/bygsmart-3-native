
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage, { type CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import { computeCarpetLaminate } from '../../catalog';

const CarpetLaminateCalculator: React.FC = () => {
    const [dims, setDims] = useState({ length: '5', width: '4', wastage: '10' });
    const [area, setArea] = useState(0);

    const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        // Formula lives in services/calculatorCatalog.ts (shared with CalculatorPickerModal)
        const r = computeCarpetLaminate({
            length: parseFloat(dims.length) || 0,
            width: parseFloat(dims.width) || 0,
            wastagePct: parseFloat(dims.wastage) || 0,
        });
        setArea(r.area);
    }, [dims]);

    const reportData = useMemo<CalculatorReportData>(() => ({
        toolName: 'Taeppe & Laminat',
        category: 'Gulve & Overflader',
        inputs: [
            { label: 'Rum Længde', value: dims.length, unit: 'm' },
            { label: 'Rum Bredde', value: dims.width, unit: 'm' },
            { label: 'Spildfaktor', value: dims.wastage, unit: '%' },
        ],
        results: [
            { label: 'Gulvbelægning at bestille', value: area.toFixed(2), unit: 'm²', highlight: true },
        ],
        formula: 'Areal = Længde × Bredde × (1 + Spildfaktor / 100)',
    }), [dims, area]);

    return (
        <CalculatorPage title="Tæppe/Laminat Mængdeberegner" reportData={reportData}>
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white p-6 rounded-card shadow-sm border space-y-4">
                    <h3 className="font-bold text-lg">Indtast Mål</h3>
                    <InputField label="Rum Længde" value={dims.length} onChange={e => handleDimChange(e, 'length')} unit="m" info="Rummets indvendige længde."/>
                    <InputField label="Rum Bredde" value={dims.width} onChange={e => handleDimChange(e, 'width')} unit="m" info="Rummets indvendige bredde."/>
                    <InputField 
                        label="Spildfaktor" 
                        value={dims.wastage} 
                        onChange={e => handleDimChange(e, 'wastage')} 
                        unit="%"
                        info="En margin for tilskæringer. Tjek tæpperullens bredde (fx 400cm) for at se om du får meget spild."
                    />
                </div>
                
                <div className="space-y-6">
                    <ResultDisplay 
                        label="Gulvbelægning at bestille" 
                        value={area} 
                        unit={<>m<sup>2</sup></>} 
                    />
                    <div className="bg-white p-4 rounded-card shadow-sm border text-sm text-text-secondary">
                        <h4 className="font-bold text-base text-text-primary mb-2">Tip til tæpper</h4>
                        <p>For tæpper i ruller er det ofte bedst at bestille en længde, der passer til rummets længde, og så skære til i bredden. Tjek altid rullebredden hos din leverandør for at planlægge samlinger bedst muligt.</p>
                    </div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default CarpetLaminateCalculator;
