import React, { useState } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import AnimatedNumber from '../../components/AnimatedNumber';

const doorModules = [
    { value: '7x21', label: 'M7x21' },
    { value: '8x21', label: 'M8x21' },
    { value: '9x21', label: 'M9x21' },
    { value: '10x21', label: 'M10x21' },
    { value: '15x21', label: 'M15x21 (Dobbeltdør)' },
];

const DoorSizeCalculator: React.FC = () => {
    const [selectedModule, setSelectedModule] = useState('9x21');
    
    const results = React.useMemo(() => {
        const [widthModule, heightModule] = selectedModule.split('x').map(Number);
        const frameWidth = widthModule * 100 - 10; // e.g., M9 -> 890mm
        const frameHeight = heightModule * 100 - 10; // e.g., M21 -> 2090mm

        // Standard rough opening is typically frame size + 24mm width and +12mm height
        const roughOpeningWidth = frameWidth + 24;
        const roughOpeningHeight = frameHeight + 12;

        return {
            frameWidth,
            frameHeight,
            roughOpeningWidth,
            roughOpeningHeight,
        };

    }, [selectedModule]);

    const reportData: CalculatorReportData = React.useMemo(() => ({
        toolName: 'Dør- & Hulmål Reference',
        inputs: [
            { label: 'Modulstørrelse', value: selectedModule },
        ],
        results: [
            { label: 'Karmmål (B×H)', value: `${results.frameWidth} × ${results.frameHeight}`, unit: 'mm', highlight: true },
            { label: 'Murhul (B×H)', value: `${results.roughOpeningWidth} × ${results.roughOpeningHeight}`, unit: 'mm' },
        ],
    }), [selectedModule, results]);

    return (
        <CalculatorPage
            title="Dør- & Hulmål Reference"
            reportData={reportData}
            shareValue={`M${selectedModule}: Karm ${results.frameWidth}×${results.frameHeight}mm · Hul ${results.roughOpeningWidth}×${results.roughOpeningHeight}mm`}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border space-y-4">
                    <h3 className="font-bold text-lg">Vælg Dørmodul</h3>
                    <p className="text-sm text-text-secondary -mb-2">Find de korrekte karm- og hulmål for standard dørstørrelser.</p>
                    
                    <div>
                        <label className="block text-sm font-medium text-text-secondary">Standard Modulstørrelse</label>
                        <select 
                            value={selectedModule} 
                            onChange={(e) => setSelectedModule(e.target.value)} 
                            className="w-full mt-1 border-border-strong dark:border-border-dark rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-primary/50 focus:outline-none text-lg"
                        >
                            {doorModules.map(mod => (
                                <option key={mod.value} value={mod.value}>{mod.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
                
                <div className="space-y-6">
                    <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border">
                        <h3 className="font-bold text-lg mb-4">Dimensioner</h3>
                        <div className="space-y-4">
                            <div className="text-center bg-info-subtle dark:bg-info-subtle-dark p-3 rounded-lg">
                                <p className="text-sm font-medium text-info-strong dark:text-info">Udvendigt Karmmål</p>
                                <div className="text-2xl font-bold text-brand-primary mt-1">
                                    <AnimatedNumber value={results.frameWidth} precision={0} /> x <AnimatedNumber value={results.frameHeight} precision={0} /> mm
                                </div>
                            </div>
                            <div className="text-center bg-success-subtle dark:bg-success-subtle-dark p-3 rounded-lg">
                                <p className="text-sm font-medium text-success-strong dark:text-success">Anbefalet Murhul</p>
                                <div className="text-2xl font-bold text-success mt-1">
                                    <AnimatedNumber value={results.roughOpeningWidth} precision={0} /> x <AnimatedNumber value={results.roughOpeningHeight} precision={0} /> mm
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="p-4 bg-bg-subtle dark:bg-bg-dark-muted border rounded-lg text-sm text-text-secondary mt-6">
                <h4 className="font-bold text-base text-text-primary mb-2">Info</h4>
                <p>Et modul (M) er 100 mm. Et "M9x21" dørkarm har typisk et udvendigt mål på 890 x 2090 mm. Det anbefalede murhul er karmmålet plus plads til justering og fugning (ca. 12 mm på hver side og i toppen).</p>
            </div>
        </CalculatorPage>
    );
};

export default DoorSizeCalculator;