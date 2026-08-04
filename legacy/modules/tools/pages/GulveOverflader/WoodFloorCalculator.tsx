
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import AnimatedNumber from '../../components/AnimatedNumber';
import { DownloadIcon, PinIcon, PlusIcon, RefreshCwIcon, TrashIcon, XIcon, ZoomInIcon, ZoomOutIcon, EditIcon } from '../../../../components/icons';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import { computeWoodFloor } from '../../catalog';
import type { CalculatorReportData } from '../../components/CalculatorPage';


type Annotation = {
    id: number;
    x: number;
    y: number;
    text: string;
};

const InstallationDiagram: React.FC<{
    dims: { length: string; width: string; plankLength: string; plankWidth: string };
    plan: { firstRowWidth: number; lastRowWidth: number; numFullWidthRows: number; planksPerRow: number; totalRows: number; };
    annotations: Annotation[];
    onAnnotationClick: (annotation: Annotation) => void;
}> = ({ dims, plan, annotations, onAnnotationClick }) => {
    const roomLength = (parseFloat(dims.length) || 0) * 1000;
    const roomWidth = (parseFloat(dims.width) || 0) * 1000;
    const plankLength = parseFloat(dims.plankLength) || 0;
    const plankWidth = parseFloat(dims.plankWidth) || 0;

    if (!roomLength || !roomWidth || !plankLength || !plankWidth || !plan.totalRows) {
        return <div className="text-center h-full flex items-center justify-center text-sm text-text-secondary">Indtast gyldige mål for at se diagram.</div>;
    }

    const { firstRowWidth, lastRowWidth, numFullWidthRows } = plan;

    const rows = [];
    let currentY = 0;

    if (firstRowWidth > 0) { rows.push({ y: currentY, height: firstRowWidth }); currentY += firstRowWidth; }
    for (let i = 0; i < numFullWidthRows; i++) { rows.push({ y: currentY, height: plankWidth }); currentY += plankWidth; }
    if (lastRowWidth > 0) { rows.push({ y: currentY, height: lastRowWidth }); }
    
    const TEXT_SIZE = Math.max(10, Math.min(roomWidth, roomLength) * 0.04);
    const ROW_NUM_TEXT_SIZE = TEXT_SIZE * 0.8;

    return (
        <svg viewBox={`-100 -60 ${roomLength + 160} ${roomWidth + 120}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <rect x="0" y="0" width={roomLength} height={roomWidth} className="fill-white" />

            {rows.map((row, rowIndex) => (
                <g key={rowIndex}>
                    <rect x="0" y={row.y} width={roomLength} height={row.height} className={`stroke-gray-800 stroke-[2] ${rowIndex === 0 || rowIndex === rows.length - 1 ? 'fill-blue-100' : 'fill-gray-50'}`} />
                    {Array.from({ length: plan.planksPerRow + 2 }).map((_, i) => {
                        const staggerOffset = (rowIndex % 2 === 1) ? plankLength / 3 : 0;
                        const xPos = i * plankLength - staggerOffset;
                        if (xPos > 0 && xPos < roomLength) {
                            return <line key={i} x1={xPos} y1={row.y} x2={xPos} y2={row.y + row.height} className="stroke-gray-800" strokeWidth="1.5" />;
                        }
                        return null;
                    })}
                    <text x={-15} y={row.y + row.height / 2} dominantBaseline="middle" textAnchor="end" className="font-bold fill-gray-500" style={{'fontSize': `${ROW_NUM_TEXT_SIZE}px`}}>{rowIndex + 1}</text>
                </g>
            ))}
            
            <line x1="0" y1="-15" x2={roomLength} y2="-15" className="stroke-gray-800" strokeWidth="1.5" />
            <line x1="0" y1="-20" x2="0" y2="-10" className="stroke-gray-800" strokeWidth="1.5" />
            <line x1={roomLength} y1="-20" x2={roomLength} y2="-10" className="stroke-gray-800" strokeWidth="1.5" />
            <text x={roomLength / 2} y={-40} textAnchor="middle" className="font-semibold fill-gray-800" style={{'fontSize': `${TEXT_SIZE}px`}}>Total Længde: {dims.length} m</text>
            
            <line x1="-50" y1="0" x2="-50" y2={roomWidth} className="stroke-gray-800" strokeWidth="1.5" />
            <line x1="-55" y1="0" x2="-45" y2="0" className="stroke-gray-800" strokeWidth="1.5" />
            <line x1="-55" y1={roomWidth} x2="-45" y2={roomWidth} className="stroke-gray-800" strokeWidth="1.5" />
            <text x={-80} y={roomWidth / 2} textAnchor="middle" dominantBaseline="middle" transform={`rotate(-90, -70, ${roomWidth/2})`} className="font-semibold fill-gray-800" style={{'fontSize': `${TEXT_SIZE}px`}}>Total Bredde: {dims.width} m</text>
        
            {annotations.map(ann => (
                 <g key={ann.id} transform={`translate(${ann.x} ${ann.y})`} onClick={() => onAnnotationClick(ann)} className="cursor-pointer group">
                    <circle cx="0" cy="0" r="8" className="fill-red-500 stroke-white stroke-[2] group-hover:fill-red-700 transition-colors" />
                    <text y="20" className="font-semibold fill-gray-800" style={{ fontSize: '12px' }} textAnchor="middle">{ann.text.length > 15 ? `${ann.text.substring(0, 12)}...` : ann.text}</text>
                </g>
            ))}
        </svg>
    );
};

const AnnotationModal: React.FC<{
    annotation: Annotation | { x: number; y: number; };
    onSave: (id: number | null, text: string) => void;
    onDelete?: (id: number) => void;
    onClose: () => void;
}> = ({ annotation, onSave, onDelete, onClose }) => {
    const isNew = !('id' in annotation);
    const [text, setText] = useState(isNew ? '' : annotation.text);
    
    const handleSave = () => {
        if(text.trim()) {
            onSave(isNew ? null : annotation.id, text);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-modal p-6 w-full max-w-sm">
                <h2 className="font-bold text-lg mb-4">{isNew ? 'Tilføj Note' : 'Rediger Note'}</h2>
                <textarea 
                    value={text}
                    onChange={e => setText(e.target.value)}
                    rows={4}
                    className="w-full border border-border-strong rounded-lg p-2"
                    placeholder="Skriv din note her..."
                />
                <div className="flex justify-between mt-4">
                    <div>
                        {!isNew && onDelete && (
                             <button onClick={() => onDelete(annotation.id)} className="px-4 py-2 rounded-lg text-danger font-semibold hover:bg-danger-subtle flex items-center gap-2">
                                <TrashIcon className="w-5 h-5"/> Slet
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                         <button onClick={onClose} className="px-4 py-2 rounded-lg border font-semibold">Annuller</button>
                         <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-brand-primary text-white font-semibold">Gem</button>
                    </div>
                </div>
            </div>
        </div>
    )
}

const WoodFloorCalculator: React.FC = () => {
    const [dims, setDims] = useState({ length: '5', width: '2', wastage: '7', plankWidth: '130', plankLength: '500' });
    const [area, setArea] = useState(0);
    const [installationPlan, setInstallationPlan] = useState({ firstRowWidth: 0, lastRowWidth: 0, numFullWidthRows: 0, totalRows: 0, planksPerRow: 0 });

    const [transform, setTransform] = useState({ scale: 1, translateX: 0, translateY: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [mode, setMode] = useState<'pan' | 'annotate'>('pan');
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [editingAnnotation, setEditingAnnotation] = useState<Annotation | {x: number, y: number} | null>(null);

    const diagramContainerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };
    
    useEffect(() => {
        // Formula lives in services/calculatorCatalog.ts (shared with CalculatorPickerModal)
        const r = computeWoodFloor({
            length: parseFloat(dims.length) || 0,
            width: parseFloat(dims.width) || 0,
            wastagePct: parseFloat(dims.wastage) || 0,
            plankWidthMm: parseFloat(dims.plankWidth) || 0,
            plankLengthMm: parseFloat(dims.plankLength) || 0,
        });
        setArea(r.area);
        setInstallationPlan(r.plan);
    }, [dims]);
    
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const svg = svgRef.current;
        if (!svg) return;

        const scaleFactor = 1.1;
        const { deltaY } = e;
        const newScale = deltaY < 0 ? transform.scale * scaleFactor : transform.scale / scaleFactor;
        const clampedScale = Math.max(0.1, Math.min(newScale, 10));

        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgP = pt.matrixTransform(svg.getScreenCTM()!.inverse());

        const newTranslateX = svgP.x - (svgP.x - transform.translateX) * (clampedScale / transform.scale);
        const newTranslateY = svgP.y - (svgP.y - transform.translateY) * (clampedScale / transform.scale);
        
        setTransform({ scale: clampedScale, translateX: newTranslateX, translateY: newTranslateY });
    }, [transform]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (mode === 'annotate') return;
        setIsDragging(true);
        setDragStart({ x: e.clientX - transform.translateX, y: e.clientY - transform.translateY });
    }, [mode, transform]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging) return;
        setTransform(prev => ({ ...prev, translateX: e.clientX - dragStart.x, translateY: e.clientY - dragStart.y }));
    }, [isDragging, dragStart]);

    const handleMouseUp = useCallback(() => setIsDragging(false), []);

    const handleSvgClick = (e: React.MouseEvent) => {
        if (mode !== 'annotate' || !svgRef.current) return;
        
        const svg = svgRef.current;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgP = pt.matrixTransform(svg.getScreenCTM()!.inverse());
        
        setEditingAnnotation({ x: svgP.x, y: svgP.y });
        setMode('pan');
    };
    
    const handleSaveAnnotation = (id: number | null, text: string) => {
        if (id !== null) {
            setAnnotations(anns => anns.map(a => a.id === id ? { ...a, text } : a));
        } else if(editingAnnotation && !('id' in editingAnnotation)) {
            const newAnn: Annotation = { id: Date.now(), x: editingAnnotation.x, y: editingAnnotation.y, text };
            setAnnotations(anns => [...anns, newAnn]);
        }
        setEditingAnnotation(null);
    }
    
    const handleDeleteAnnotation = (id: number) => {
        setAnnotations(anns => anns.filter(a => a.id !== id));
        setEditingAnnotation(null);
    }

    const handleResetView = () => setTransform({ scale: 1, translateX: 0, translateY: 0 });

    const reportData = useMemo<CalculatorReportData>(() => ({
        toolName: 'Traegulv Beregner',
        category: 'Gulve & Overflader',
        inputs: [
            { label: 'Rum Længde', value: dims.length, unit: 'm' },
            { label: 'Rum Bredde', value: dims.width, unit: 'm' },
            { label: 'Plankebredde', value: dims.plankWidth, unit: 'mm' },
            { label: 'Plankelængde', value: dims.plankLength, unit: 'mm' },
            { label: 'Spildfaktor', value: dims.wastage, unit: '%' },
        ],
        results: [
            { label: 'Trægulv at bestille', value: area.toFixed(2), unit: 'm²', highlight: true },
            { label: 'Antal Rækker', value: String(installationPlan.totalRows) },
            { label: 'Planker pr. Række', value: String(installationPlan.planksPerRow) },
            { label: 'Første Række bredde', value: installationPlan.firstRowWidth.toFixed(1), unit: 'mm' },
            { label: 'Sidste Række bredde', value: installationPlan.lastRowWidth.toFixed(1), unit: 'mm' },
        ],
    }), [dims, area, installationPlan]);

    const handleExport = (format: 'png' | 'pdf') => {
        if (!diagramContainerRef.current) return;
        html2canvas(diagramContainerRef.current, { useCORS: true, backgroundColor: '#f9fafb' }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            if (format === 'png') {
                const link = document.createElement('a');
                link.download = 'gulvplan.png';
                link.href = imgData;
                link.click();
            } else {
                const pdf = new jsPDF({ orientation: 'l', unit: 'px', format: [canvas.width, canvas.height] });
                pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
                pdf.save('gulvplan.pdf');
            }
        });
    };
    
    return (
        <CalculatorPage title="Trægulv Mængdeberegner" reportData={reportData}>
            {editingAnnotation && <AnnotationModal annotation={editingAnnotation} onClose={() => setEditingAnnotation(null)} onSave={handleSaveAnnotation} onDelete={handleDeleteAnnotation} />}
            <div className="grid md:grid-cols-2 gap-6 items-start">
                {/* ... input and results columns ... */}
                <div className="bg-white p-6 rounded-card shadow-sm border space-y-4">
                    <h3 className="font-bold text-lg">Indtast Mål</h3>
                    <InputField label="Rum Længde" value={dims.length} onChange={e => handleDimChange(e, 'length')} unit="m" info="Rummets længde."/>
                    <InputField label="Rum Bredde" value={dims.width} onChange={e => handleDimChange(e, 'width')} unit="m" info="Rummets bredde."/>
                     <InputField label="Plankebredde" value={dims.plankWidth} onChange={e => handleDimChange(e, 'plankWidth')} unit="mm" info="Bredden på en enkelt gulvplanke."/>
                     <InputField label="Plankelængde" value={dims.plankLength} onChange={e => handleDimChange(e, 'plankLength')} unit="mm" info="Længden på en enkelt gulvplanke."/>
                    <InputField label="Spildfaktor" value={dims.wastage} onChange={e => handleDimChange(e, 'wastage')} unit="%" info="En margin for tilskæringer. 5-10% er normalt. Ved diagonallægning skal man bruge mere."/>
                </div>
                <div className="space-y-6">
                    <ResultDisplay label="Trægulv at bestille" value={area} unit={<>m<sup>2</sup></>} />
                    <div className="bg-white p-6 rounded-card shadow-sm border">
                        <h3 className="font-bold text-lg mb-4">Installationsplan</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-center bg-bg-subtle p-3 rounded-lg"><p className="text-sm font-medium text-text-secondary">Antal Rækker</p><p className="text-3xl font-bold text-brand-primary mt-1"><AnimatedNumber value={installationPlan.totalRows} precision={0} /></p></div>
                            <div className="text-center bg-bg-subtle p-3 rounded-lg"><p className="text-sm font-medium text-text-secondary">Planker pr. Række</p><p className="text-3xl font-bold text-brand-primary mt-1"><AnimatedNumber value={installationPlan.planksPerRow} precision={0} /></p></div>
                            <div className="text-center bg-bg-subtle p-3 rounded-lg"><p className="text-sm font-medium text-text-secondary">Første Række</p><div className="text-3xl font-bold text-brand-primary mt-1"><AnimatedNumber value={installationPlan.firstRowWidth} precision={1} /><span className="text-2xl ml-1">mm</span></div></div>
                            <div className="text-center bg-bg-subtle p-3 rounded-lg"><p className="text-sm font-medium text-text-secondary">Sidste Række</p><div className="text-3xl font-bold text-brand-primary mt-1"><AnimatedNumber value={installationPlan.lastRowWidth} precision={1} /><span className="text-2xl ml-1">mm</span></div></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="bg-white p-6 rounded-card shadow-sm border">
                <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
                    <h3 className="font-bold text-lg">Gulv Designer</h3>
                    <div className="flex items-center gap-2 border border-border rounded-lg p-1 bg-bg-subtle">
                        <button onClick={() => setTransform(t => ({...t, scale: Math.min(t.scale * 1.2, 10)}))} className="p-2 hover:bg-bg-muted rounded-md"><ZoomInIcon className="w-5 h-5"/></button>
                        <button onClick={() => setTransform(t => ({...t, scale: Math.max(t.scale / 1.2, 0.1)}))} className="p-2 hover:bg-bg-muted rounded-md"><ZoomOutIcon className="w-5 h-5"/></button>
                        <button onClick={handleResetView} className="p-2 hover:bg-bg-muted rounded-md"><RefreshCwIcon className="w-5 h-5"/></button>
                        <div className="w-px h-6 bg-border-strong mx-1"></div>
                        <button onClick={() => setMode('annotate')} className={`p-2 rounded-md flex items-center gap-1 text-sm font-semibold ${mode === 'annotate' ? 'bg-brand-primary text-white' : 'hover:bg-bg-muted'}`}><PinIcon className="w-5 h-5"/> Tilføj Note</button>
                        <div className="w-px h-6 bg-border-strong mx-1"></div>
                        <button onClick={() => handleExport('png')} className="p-2 hover:bg-bg-muted rounded-md text-sm font-semibold flex items-center gap-1"><DownloadIcon className="w-5 h-5"/> PNG</button>
                        <button onClick={() => handleExport('pdf')} className="p-2 hover:bg-bg-muted rounded-md text-sm font-semibold flex items-center gap-1"><DownloadIcon className="w-5 h-5"/> PDF</button>
                    </div>
                </div>

                <div ref={diagramContainerRef} onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onClick={handleSvgClick} className={`bg-bg-muted rounded-lg overflow-hidden relative min-h-[500px] ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${mode === 'annotate' ? 'cursor-crosshair' : ''}`}>
                    <svg ref={svgRef} width="100%" height="100%" className="absolute inset-0">
                        <g transform={`translate(${transform.translateX}, ${transform.translateY}) scale(${transform.scale})`}>
                            <InstallationDiagram dims={dims} plan={installationPlan} annotations={annotations} onAnnotationClick={(ann) => setEditingAnnotation(ann)} />
                        </g>
                    </svg>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default WoodFloorCalculator;
