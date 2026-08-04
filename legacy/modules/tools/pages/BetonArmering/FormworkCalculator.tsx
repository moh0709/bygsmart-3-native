
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage, { type CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import { computeFormwork, getCalculator, catalogHelpToContent } from '../../catalog';

const TOOL_ID = 'beton-armering-forskalling';
const meta = getCalculator(TOOL_ID);

const FormworkCalculator: React.FC = () => {
    const [inputs, setInputs] = useState({
        length: '10', height: '0.6', sides: '2', wastage: '12'
    });
    const [area, setArea] = useState(0);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof inputs) => {
        setInputs(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        // Shared formula lives in services/calculatorCatalog.ts (single source of truth).
        const { area: computed } = computeFormwork({
            length: parseFloat(inputs.length) || 0,
            height: parseFloat(inputs.height) || 0,
            sides: parseInt(inputs.sides) || 2,
            wastagePct: parseFloat(inputs.wastage) || 0,
        });
        setArea(computed);
    }, [inputs]);

    const helpContent = useMemo(
        () => (meta?.help ? catalogHelpToContent(meta.help, meta.standards) : undefined),
        [],
    );

    const reportData = useMemo<CalculatorReportData>(() => ({
        toolName: meta?.name ?? 'Forskalling Beregner',
        category: meta?.category ?? 'Beton & Armering',
        inputs: [
            { label: 'Længde', value: inputs.length, unit: 'm' },
            { label: 'Højde', value: inputs.height, unit: 'm' },
            { label: 'Antal Sider', value: inputs.sides, unit: 'stk' },
            { label: 'Spild', value: inputs.wastage, unit: '%' },
        ],
        results: [
            { label: 'Areal Forskalling (inkl. spild)', value: area.toFixed(2), unit: 'm²', highlight: true },
        ],
        formula: 'Areal = Længde × Højde × Antal Sider × (1 + spild%)',
        standardsStruktureret: meta?.standards,
    }), [inputs, area]);

    return (
        <CalculatorPage title="Forskalling Areal" helpContent={helpContent} reportData={reportData}>
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border space-y-4">
                    <h3 className="font-bold text-lg">Indtast Fundament/Væg Data</h3>
                    <InputField label="Længde" value={inputs.length} onChange={e => handleInputChange(e, 'length')} unit="m" info="Længden af fundamentet/væggen der skal forskalles."/>
                    <InputField label="Højde" value={inputs.height} onChange={e => handleInputChange(e, 'height')} unit="m" info="Højden af fundamentet/væggen der skal forskalles."/>
                    <InputField
                        label="Antal Sider"
                        value={inputs.sides}
                        onChange={e => handleInputChange(e, 'sides')}
                        unit="stk"
                        info="Normalt 2 sider for en fritstående væg/fundament. 1 side ved støbning mod jord/eksisterende væg."
                    />
                    <InputField
                        label="Spildfaktor"
                        value={inputs.wastage}
                        onChange={e => handleInputChange(e, 'wastage')}
                        unit="%"
                        info="Savning, overlæg og forstærkninger. Typisk 10–15%."
                    />
                </div>

                <div className="space-y-6">
                    <ResultDisplay
                        label="Areal Forskalling"
                        value={area}
                        unit={<>m<sup>2</sup></>}
                    />
                    <div className="bg-bg dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border text-sm text-text-secondary">
                        <h4 className="font-bold text-base text-text-primary mb-2">Tip</h4>
                        <p>Spild (savning/overlæg) er medregnet ovenfor. Husk at forstærkninger (lægter/reglar) og form-hardware bestilles separat.</p>
                    </div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default FormworkCalculator;
