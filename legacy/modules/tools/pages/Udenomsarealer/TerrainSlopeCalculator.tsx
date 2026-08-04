
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage, { type CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';

const TerrainSlopeCalculator: React.FC = () => {
    const [dist, setDist] = useState('3'); // m
    const [slope, setSlope] = useState('25'); // promille (mm/m)
    const [drop, setDrop] = useState(0);

    useEffect(() => {
        const d = parseFloat(dist) || 0;
        const s = parseFloat(slope) || 0;
        // Drop in cm = dist (m) * slope (mm/m) / 10
        setDrop((d * s) / 10);
    }, [dist, slope]);

    const reportData = useMemo<CalculatorReportData>(() => ({
        toolName: 'Terrainhaeldning',
        category: 'Udenomsarealer',
        inputs: [
            { label: 'Afstand fra sokkel', value: dist, unit: 'm' },
            { label: 'Ønsket fald', value: slope, unit: '‰ (mm/m)' },
        ],
        results: [
            { label: 'Højdeforskel', value: drop.toFixed(1), unit: 'cm', highlight: true },
        ],
        formula: 'Højdeforskel (cm) = Afstand (m) × Fald (‰) / 10',
    }), [dist, slope, drop]);

    return (
        <CalculatorPage title="Fald på Terræn" reportData={reportData}>
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-lg text-text-primary dark:text-text-dark-primary">Indtast Data</h3>
                    <InputField label="Afstand fra sokkel" value={dist} onChange={e => setDist(e.target.value)} unit="m" info="Afstanden fra bygningen, hvor du vil måle faldet."/>
                    <InputField 
                        label="Ønsket Fald" 
                        value={slope} 
                        onChange={e => setSlope(e.target.value)} 
                        unit="‰ (mm/m)"
                        info="Anbefalet fald væk fra bygning er min. 25‰ (2,5 cm pr. meter) de første 3 meter, jf. DS 432."
                    />
                </div>

                <div className="space-y-6">
                    <ResultDisplay label="Højdeforskel" value={drop} unit="cm" />

                    <div className="bg-info-subtle dark:bg-info-subtle-dark rounded-xl p-3 border border-info-border dark:border-info/30">
                        <p className="text-xs text-info-strong dark:text-info leading-snug">
                            Bemærk forskellen: <strong>fald væk fra bygning</strong> (dræn) skal være <strong>≥ 2,5%</strong> (DS 432),
                            mens en <strong>adgangssti/rampe</strong> (tilgængelighed) skal være <strong>≤ 5%</strong>, ideelt ≤ 2%. Brug ikke samme værdi til begge formål.
                        </p>
                    </div>

                    <div className="bg-bg dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark h-32 flex items-end pb-4">
                        <div className="w-10 h-24 bg-border-strong mr-1 relative">
                            <span className="absolute -top-4 left-0 text-xs text-text-secondary dark:text-text-dark-secondary">Hus</span>
                        </div>
                        <div className="flex-1 h-24 relative">
                            <svg width="100%" height="100%" viewBox="0 0 100 50" preserveAspectRatio="none">
                                <path d="M 0,0 L 100,20 L 100,50 L 0,50 Z" className="fill-green-100" />
                                <line x1="0" y1="0" x2="100" y2="20" stroke="green" strokeWidth="1" strokeDasharray="2" />
                            </svg>
                            <div className="absolute top-0 right-0 text-xs font-bold text-danger-strong dark:text-danger">-{drop.toFixed(1)} cm</div>
                        </div>
                    </div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default TerrainSlopeCalculator;
