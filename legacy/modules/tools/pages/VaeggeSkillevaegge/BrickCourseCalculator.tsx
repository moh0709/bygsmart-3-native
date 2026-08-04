
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage, { type CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import { SearchIcon, ListIcon } from '../../../../components/icons';

const BrickCourseCalculator: React.FC = () => {
    const [brickHeight, setBrickHeight] = useState('54');
    const [jointThickness, setJointThickness] = useState('12');
    const [searchHeight, setSearchHeight] = useState('');
    const [closestCourse, setClosestCourse] = useState<{ num: number, height: number, diff: number } | null>(null);

    // Presets
    const setPreset = (type: 'dk_normal' | 'moler' | 'svensk') => {
        if (type === 'dk_normal') {
            setBrickHeight('54');
            setJointThickness('12.66'); // 3 courses = 200mm
        } else if (type === 'moler') {
            setBrickHeight('55');
            setJointThickness('12');
        } else if (type === 'svensk') {
            setBrickHeight('62');
            setJointThickness('13');
        }
    };

    const moduleSize = parseFloat(brickHeight) + parseFloat(jointThickness);

    useEffect(() => {
        if (searchHeight && moduleSize > 0) {
            const target = parseFloat(searchHeight);
            const rawCourses = (target + parseFloat(jointThickness)) / moduleSize;
            const roundedCourses = Math.round(rawCourses);
            const calculatedHeight = (roundedCourses * moduleSize) - parseFloat(jointThickness);
            
            setClosestCourse({
                num: roundedCourses,
                height: calculatedHeight,
                diff: calculatedHeight - target
            });
        } else {
            setClosestCourse(null);
        }
    }, [searchHeight, brickHeight, jointThickness, moduleSize]);

    const reportData = useMemo<CalculatorReportData>(() => {
        const inputs: CalculatorReportData['inputs'] = [
            { label: 'Stenhøjde', value: brickHeight, unit: 'mm' },
            { label: 'Fugetykkelse', value: jointThickness, unit: 'mm' },
        ];
        if (searchHeight) {
            inputs.push({ label: 'Ønsket højde', value: searchHeight, unit: 'mm' });
        }

        const results: CalculatorReportData['results'] = [
            { label: 'Modulstørrelse (sten + fuge)', value: moduleSize.toFixed(1), unit: 'mm', highlight: true },
        ];
        if (closestCourse) {
            results.push(
                { label: 'Nærmeste antal skifter', value: String(closestCourse.num), unit: 'skifter' },
                { label: 'Opnået højde', value: closestCourse.height.toFixed(1), unit: 'mm' },
                { label: 'Afvigelse', value: (closestCourse.diff >= 0 ? '+' : '') + closestCourse.diff.toFixed(1), unit: 'mm' },
            );
        }

        return {
            toolName: 'Murforband',
            category: 'Vaegge & Skillevaegge',
            inputs,
            results,
            formula: 'Modulstørrelse = Stenhøjde + Fugetykkelse; Skiftehøjde(n) = n × Modulstørrelse − Fugetykkelse',
        };
    }, [brickHeight, jointThickness, searchHeight, moduleSize, closestCourse]);

    const Table = useMemo(() => {
        const rows = [];
        for (let i = 1; i <= 50; i++) {
            const h = (i * moduleSize) - parseFloat(jointThickness);
            rows.push(
                <tr key={i} className="border-b border-border last:border-0 odd:bg-white even:bg-bg-subtle">
                    <td className="py-2 px-4 text-center font-medium text-text-secondary">{i}</td>
                    <td className="py-2 px-4 text-right font-bold text-text-primary">{h.toFixed(1)} mm</td>
                    <td className="py-2 px-4 text-right text-xs text-text-secondary">{(h/1000).toFixed(3)} m</td>
                </tr>
            );
        }
        return rows;
    }, [moduleSize, jointThickness]);

    return (
        <CalculatorPage title="Skiftegangsberegner" reportData={reportData}>
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white p-6 rounded-card shadow-sm border space-y-4">
                    <h3 className="font-bold text-lg">Indstillinger</h3>
                    
                    <div className="flex gap-2 mb-4">
                        <button onClick={() => setPreset('dk_normal')} className="flex-1 py-2 px-3 bg-brand-subtle text-brand-strong rounded-lg text-xs font-semibold hover:bg-brand-border/50">DK Normal (200mm/3)</button>
                        <button onClick={() => setPreset('moler')} className="flex-1 py-2 px-3 bg-bg-muted text-text-secondary rounded-lg text-xs font-semibold hover:bg-border">Moler</button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Stenhøjde" value={brickHeight} onChange={e => setBrickHeight(e.target.value)} unit="mm" info="Højden på selve murstenen (uden fuge)."/>
                        <InputField label="Fuge" value={jointThickness} onChange={e => setJointThickness(e.target.value)} unit="mm" info="Tykkelsen på mørtelfugen mellem stenene."/>
                    </div>
                    
                    <div className="pt-4 border-t">
                        <h4 className="font-bold text-sm mb-2 flex items-center gap-2"><SearchIcon className="w-4 h-4"/> Find Højde</h4>
                        <InputField label="Ønsket højde (f.eks. vindueshul)" value={searchHeight} onChange={e => setSearchHeight(e.target.value)} unit="mm" info="Højden du vil ramme med et helt antal skifter."/>
                        
                        {closestCourse && (
                            <div className={`mt-3 p-3 rounded-lg border ${Math.abs(closestCourse.diff) < 5 ? 'bg-success-subtle border-success-border' : 'bg-warning-subtle border-warning-border'}`}>
                                <p className="text-sm font-semibold">Nærmeste: <span className="text-lg">{closestCourse.num} skifter</span></p>
                                <p className="text-xs text-text-secondary mt-1">
                                    Højde: <strong>{closestCourse.height.toFixed(1)} mm</strong> 
                                    <span className={closestCourse.diff > 0 ? 'text-danger ml-2' : 'text-info ml-2'}>
                                        ({closestCourse.diff > 0 ? '+' : ''}{closestCourse.diff.toFixed(1)} mm)
                                    </span>
                                </p>
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="bg-white rounded-card shadow-sm border overflow-hidden">
                    <div className="p-4 border-b bg-bg-subtle flex justify-between items-center">
                        <h3 className="font-bold text-lg flex items-center gap-2"><ListIcon className="w-5 h-5 text-text-secondary"/> Skiftegangstabel</h3>
                        <span className="text-xs text-text-secondary font-medium">Sten + Fuge = {moduleSize.toFixed(1)} mm</span>
                    </div>
                    <div className="max-h-[500px] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-bg-muted sticky top-0">
                                <tr>
                                    <th className="py-2 px-4 text-center font-semibold text-text-secondary">Skifte #</th>
                                    <th className="py-2 px-4 text-right font-semibold text-text-secondary">Højde (mm)</th>
                                    <th className="py-2 px-4 text-right font-semibold text-text-secondary">Meter</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Table}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default BrickCourseCalculator;
