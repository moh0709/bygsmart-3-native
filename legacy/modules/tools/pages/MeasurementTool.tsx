
import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FloorPlan, Project } from '../../../types';
import CalculatorPage, { type CalculatorReportData } from '../components/CalculatorPage';
import { CameraIcon, DownloadIcon, FolderIcon, FileTextIcon, MapPinIcon, XIcon, CheckCircleIcon, AlertTriangleIcon } from '../../../components/icons';
import { useAuth } from '../../../contexts/AuthProvider';
import { useToast } from '../../../contexts/ToastContext';
import { processFileForStorage } from '../../../utils/fileUtils';
import { GenericModal } from '../../../components/ui/GenericModal';
import { useModuleGate } from '../../../core/entitlements/ModuleGate';

const RoomMapper = React.lazy(() =>
    import('../../ar').then(module => ({ default: module.RoomMapper }))
);

const MeasurementTool: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const urlProjectId = searchParams.get('projectId');
    const urlTarget = searchParams.get('target');

    const { user } = useAuth();
    const { showToast } = useToast();
    const documentsEnabled = useModuleGate('documents');
    const [isMapping, setIsMapping] = useState(false);
    const [lastPlan, setLastPlan] = useState<FloorPlan | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Modal States
    const [showDestinationModal, setShowDestinationModal] = useState(false);
    const [showProjectPicker, setShowProjectPicker] = useState(false);
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>(urlProjectId || '');

    useEffect(() => {
        if (urlProjectId) {
            setSelectedProjectId(urlProjectId);
        }
    }, [urlProjectId]);

    const handleSavePlan = async (plan: FloorPlan) => {
        setIsMapping(false);
        setLastPlan(plan);
    };

    const generatePlanSvg = (plan: FloorPlan): string => {
        if (plan.elements.length === 0) return '';

        // Calculate bounds
        let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
        plan.elements.forEach(el => {
            minX = Math.min(minX, el.start.x, el.end.x);
            minZ = Math.min(minZ, el.start.z, el.end.z);
            maxX = Math.max(maxX, el.start.x, el.end.x);
            maxZ = Math.max(maxZ, el.start.z, el.end.z);
        });

        // Add padding
        const padding = 1;
        minX -= padding; minZ -= padding;
        maxX += padding; maxZ += padding;

        const width = maxX - minX;
        const height = maxZ - minZ;

        // SVG Content
        let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minZ} ${width} ${height}" width="800" height="600" style="background-color: white;">`;

        // Grid background
        svgContent += `<rect x="${minX}" y="${minZ}" width="${width}" height="${height}" fill="#f9fafb" />`;

        // Grid lines (optional visual aid)
        svgContent += `<defs><pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M 1 0 L 0 0 0 1" fill="none" stroke="#e5e7eb" stroke-width="0.02"/></pattern></defs>`;
        svgContent += `<rect x="${minX}" y="${minZ}" width="${width}" height="${height}" fill="url(#grid)" />`;

        // Elements
        plan.elements.forEach(el => {
            let color = 'black';
            let strokeWidth = '0.1';
            let dashArray = '';

            if (el.type === 'window') { color = '#3b82f6'; strokeWidth = '0.08'; }
            if (el.type === 'door') { color = '#f97316'; strokeWidth = '0.08'; }

            svgContent += `<line x1="${el.start.x}" y1="${el.start.z}" x2="${el.end.x}" y2="${el.end.z}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" ${dashArray ? `stroke-dasharray="${dashArray}"` : ''} />`;

            // Labels for length
            const midX = (el.start.x + el.end.x) / 2;
            const midZ = (el.start.z + el.end.z) / 2;
            // Simple text label approximation (SVG text is tricky without fonts, usually works in browsers)
            svgContent += `<text x="${midX}" y="${midZ}" font-family="sans-serif" font-size="0.15" fill="#666" text-anchor="middle">${el.length.toFixed(2)}m</text>`;
        });

        svgContent += `</svg>`;
        return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgContent)));
    };

    const initiateSave = async () => {
        if (!lastPlan) return;

        // If specific target from URL (e.g. from punch list tab), skip choices
        if (urlTarget === 'punchlist' && selectedProjectId) {
            await saveToPunchList(selectedProjectId);
            return;
        }

        // If we have a project ID already, show destination choice
        if (selectedProjectId) {
            setShowDestinationModal(true);
        } else {
            // No project selected, show picker
            // Eager-chunk rule: projects barrel only via dynamic import here.
            const { getProjects } = await import('../../projects');
            const projs = await getProjects();
            setProjects(projs);
            setShowProjectPicker(true);
        }
    };

    const handleProjectSelect = (pid: string) => {
        setSelectedProjectId(pid);
        setShowProjectPicker(false);
        setShowDestinationModal(true);
    };

    const saveToPunchList = async (pid: string) => {
        if (!lastPlan) return;
        setIsSaving(true);
        try {
            const svgDataUrl = generatePlanSvg(lastPlan);
            const res = await fetch(svgDataUrl);
            const blob = await res.blob();
            const file = new File([blob], `Plan_${new Date().toLocaleDateString()}.svg`, { type: 'image/svg+xml' });

            const processed = await processFileForStorage(file);

            // Loaded on demand: a static barrel import would drag the quality
            // module's components into the eagerly-preloaded calculators chunk.
            const { createLayout } = await import('../../quality');
            await createLayout(pid, {
                title: `Opmåling ${new Date().toLocaleDateString()}`,
                reference: 'AR Scan',
                fileUrl: processed.dataUrl
            });
            navigate(`/project-detail/${pid}?tab=punch-list`);
        } catch (e) {
            console.error(e);
            showToast("Fejl ved gemning til Punch List.", 'error');
        } finally {
            setIsSaving(false);
            setShowDestinationModal(false);
        }
    };

    const saveToDocuments = async (pid: string) => {
        if (!documentsEnabled || !lastPlan) return;
        setIsSaving(true);
        try {
            // Eager-chunk rule: documents barrel only via dynamic import here — it
            // also re-exports DocumentsTabContent, and a static import formed a
            // cycle Rollup collapsed into the calculators-pages bundle in prod.
            const { uploadDocument } = await import('../../documents');
            // 1. Generate PDF Report
            const { default: jsPDF } = await import('jspdf');
            const doc = new jsPDF();

            // Header
            doc.setFontSize(20);
            doc.text("Opmålingsrapport", 14, 20);
            doc.setFontSize(10);
            doc.text(`Dato: ${new Date().toLocaleDateString('da-DK')}`, 14, 28);
            doc.text(`Projekt ID: ${pid}`, 14, 33);

            // Stats
            doc.setFillColor(240, 240, 240);
            doc.rect(14, 40, 182, 25, 'F');
            doc.setFontSize(12);
            doc.text(`Areal (Est.): ${lastPlan.estimatedArea.toFixed(2)} m²`, 20, 50);
            doc.text(`Omkreds: ${lastPlan.totalPerimeter.toFixed(2)} m`, 100, 50);
            doc.text(`Antal Elementer: ${lastPlan.elements.length}`, 20, 60);

            // Floor Plan Image
            const svgDataUrl = generatePlanSvg(lastPlan);
            // Convert SVG to PNG via canvas for jsPDF
            const img = new Image();
            img.src = svgDataUrl;
            await new Promise((resolve) => { img.onload = resolve; });

            const canvas = document.createElement('canvas');
            canvas.width = img.width * 2; // High res
            canvas.height = img.height * 2;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = "white";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const pngData = canvas.toDataURL('image/png');

                // Add to PDF
                const pdfWidth = doc.internal.pageSize.getWidth() - 28;
                const pdfHeight = (canvas.height / canvas.width) * pdfWidth;
                doc.addImage(pngData, 'PNG', 14, 75, pdfWidth, pdfHeight);

                // Measurements Table
                let yPos = 75 + pdfHeight + 15;
                doc.setFontSize(14);
                doc.text("Målinger", 14, yPos);
                yPos += 10;

                doc.setFontSize(10);
                doc.setDrawColor(200);
                doc.line(14, yPos, 196, yPos);
                yPos += 5;

                // Table Header
                doc.setFont("helvetica", "bold");
                doc.text("Type", 14, yPos);
                doc.text("Længde (m)", 150, yPos);
                yPos += 5;
                doc.line(14, yPos, 196, yPos);
                yPos += 8;

                doc.setFont("helvetica", "normal");
                lastPlan.elements.forEach(el => {
                    if (yPos > 270) { doc.addPage(); yPos = 20; }
                    const typeLabel = el.type === 'wall' ? 'Væg' : el.type === 'window' ? 'Vindue' : 'Dør';
                    doc.text(typeLabel, 14, yPos);
                    doc.text(el.length.toFixed(2), 150, yPos);
                    yPos += 7;
                });
            }

            const pdfBlob = doc.output('blob');
            const pdfFile = new File([pdfBlob], `Opmaaling_Rapport.pdf`, { type: 'application/pdf' });
            const processedPdf = await processFileForStorage(pdfFile);

            await uploadDocument(pid, {
                name: pdfFile.name,
                storagePath: processedPdf.dataUrl,
                sizeBytes: pdfFile.size,
                mimeType: 'application/pdf',
                category: 'PLANNING_EXECUTION',
                accessLevel: 'public_team',
                passwordProtected: false,
                isDrawing: false,
                createdBy: user?.name || 'System'
            });

            showToast("Rapport gemt i Dokumenter.", 'success');
            navigate(`/project-detail/${pid}?tab=dokumenter`);

        } catch (e) {
            console.error(e);
            showToast("Fejl ved generering af rapport.", 'error');
        } finally {
            setIsSaving(false);
            setShowDestinationModal(false);
        }
    };

    const exportToJson = () => {
        if (!lastPlan) return;
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(lastPlan));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "opmaaling.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const reportData = useMemo<CalculatorReportData>(() => {
        const wallCount = lastPlan ? lastPlan.elements.filter(e => e.type === 'wall').length : 0;
        const windowCount = lastPlan ? lastPlan.elements.filter(e => e.type === 'window').length : 0;
        const doorCount = lastPlan ? lastPlan.elements.filter(e => e.type === 'door').length : 0;

        return {
            toolName: 'Maalevaerktoej',
            category: 'Generelt',
            inputs: [
                { label: 'Antal elementer', value: lastPlan ? String(lastPlan.elements.length) : '0' },
                { label: 'Vægge', value: String(wallCount) },
                { label: 'Vinduer', value: String(windowCount) },
                { label: 'Døre', value: String(doorCount) },
            ],
            results: [
                {
                    label: 'Estimeret areal',
                    value: lastPlan ? lastPlan.estimatedArea.toFixed(2) : '0.00',
                    unit: 'm²',
                    highlight: true,
                },
                {
                    label: 'Omkreds',
                    value: lastPlan ? lastPlan.totalPerimeter.toFixed(2) : '0.00',
                    unit: 'm',
                },
            ],
            breakdown: lastPlan
                ? lastPlan.elements.map((el, i) => ({
                    label: `${el.type === 'wall' ? 'Væg' : el.type === 'window' ? 'Vindue' : 'Dør'} ${i + 1}`,
                    value: el.length.toFixed(2),
                    unit: 'm',
                }))
                : [],
        };
    }, [lastPlan]);

    if (isMapping) {
        return (
            <Suspense fallback={<div className="p-6 text-center">Indlæser AR-opmåling...</div>}>
                <RoomMapper onSave={handleSavePlan} onClose={() => setIsMapping(false)} />
            </Suspense>
        );
    }

    return (
        <CalculatorPage title="AR Opmåling" reportData={reportData}>
            <div className="space-y-6">
                {/* Persistent BETA notice — shown on both empty and result states */}
                <div className="bg-warning-subtle dark:bg-warning-subtle-dark border border-warning/30 rounded-card p-4 flex items-start gap-3 animate-fade-in">
                    <AlertTriangleIcon className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                    <div>
                        <span className="inline-block text-caption font-bold uppercase tracking-wider bg-warning/20 text-warning px-1.5 py-0.5 rounded mb-1">Beta</span>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary leading-relaxed">
                            Denne sektion er i BETA og er begrænset. Den fulde version bliver tilgængelig når App'en udkommer i App Store/Marketplace. Men du kan udforske siden indtil videre.
                        </p>
                    </div>
                </div>

                {!lastPlan && (
                    <div className="bg-white p-8 rounded-xl shadow-sm border text-center animate-fade-in">
                        <div className="w-20 h-20 bg-brand-subtle rounded-full flex items-center justify-center mx-auto mb-4">
                            <CameraIcon className="w-10 h-10 text-brand-primary" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Smart Opmåling</h2>
                        <p className="text-text-secondary mb-6">
                            Brug kameraet til at opmåle rum, vægge og placere vinduer/døre.
                            Fungerer bedst på mobilen med AR.
                        </p>
                        <button
                            onClick={() => setIsMapping(true)}
                            className="w-full py-3.5 bg-brand-primary text-white font-bold rounded-xl shadow-lg hover:bg-brand-strong transition-transform active:scale-95"
                        >
                            Start Opmåling
                        </button>
                    </div>
                )}

                {lastPlan && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border animate-fade-in">
                        <h3 className="font-bold text-lg mb-4 text-center">Seneste Opmåling</h3>

                        {/* Preview Stats */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-bg-subtle p-3 rounded-lg text-center border border-border">
                                <p className="text-xs text-text-secondary uppercase font-bold tracking-wider">Areal</p>
                                <p className="text-2xl font-bold text-brand-primary">{lastPlan.estimatedArea.toFixed(1)} <span className="text-sm text-text-tertiary">m²</span></p>
                            </div>
                            <div className="bg-bg-subtle p-3 rounded-lg text-center border border-border">
                                <p className="text-xs text-text-secondary uppercase font-bold tracking-wider">Omkreds</p>
                                <p className="text-2xl font-bold text-brand-primary">{lastPlan.totalPerimeter.toFixed(1)} <span className="text-sm text-text-tertiary">m</span></p>
                            </div>
                        </div>

                        {/* List Preview */}
                        <div className="space-y-2 mb-6 max-h-40 overflow-y-auto border-t border-b border-border py-2">
                            {lastPlan.elements.map((el, i) => (
                                <div key={el.id} className="flex justify-between text-sm py-1">
                                    <span className="capitalize font-medium text-text-primary">
                                        {el.type === 'wall' ? 'Væg' : el.type === 'window' ? 'Vindue' : 'Dør'} {i + 1}
                                    </span>
                                    <span className="font-mono text-text-secondary">{el.length.toFixed(2)}m</span>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={initiateSave}
                                disabled={isSaving}
                                className="w-full py-3 bg-success text-white rounded-lg flex items-center justify-center gap-2 font-bold shadow hover:bg-success-strong transition-colors disabled:opacity-50"
                            >
                                <FolderIcon className="w-5 h-5" />
                                {isSaving ? 'Gemmer...' : 'Gem til Projekt'}
                            </button>

                            <button onClick={exportToJson} className="w-full py-2 border border-border-strong rounded-lg flex items-center justify-center gap-2 font-semibold hover:bg-bg-subtle text-text-secondary">
                                <DownloadIcon className="w-4 h-4" /> Download JSON
                            </button>

                            <button onClick={() => setIsMapping(true)} className="text-sm text-brand-primary font-medium hover:underline mt-2">
                                Start ny opmåling
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Destination Modal */}
            {showDestinationModal && (
                <GenericModal title="Vælg Destination" onClose={() => setShowDestinationModal(false)}>
                    <div className="space-y-4">
                        <p className="text-sm text-text-secondary">Hvor vil du gemme opmålingen i projektet?</p>

                        <button
                            onClick={() => saveToPunchList(selectedProjectId)}
                            className="w-full p-4 rounded-xl border border-border hover:border-brand-primary hover:bg-brand-subtle transition-all flex items-center gap-4 group"
                        >
                            <div className="bg-brand-subtle p-3 rounded-full text-brand-primary group-hover:scale-110 transition-transform">
                                <MapPinIcon className="w-6 h-6" />
                            </div>
                            <div className="text-left">
                                <h4 className="font-bold text-text-primary">Punch List</h4>
                                <p className="text-xs text-text-secondary">Gem som plantegning til mangelgennemgang.</p>
                            </div>
                        </button>

                        {/* "Dokumenter" saves via the `documents` module — hidden when it isn't
                            entitled. "Punch List" above (quality module) is unaffected. */}
                        {documentsEnabled && (
                            <button
                                onClick={() => saveToDocuments(selectedProjectId)}
                                className="w-full p-4 rounded-xl border border-border hover:border-success hover:bg-success-subtle transition-all flex items-center gap-4 group"
                            >
                                <div className="bg-success-subtle p-3 rounded-full text-success group-hover:scale-110 transition-transform">
                                    <FileTextIcon className="w-6 h-6" />
                                </div>
                                <div className="text-left">
                                    <h4 className="font-bold text-text-primary">Dokumenter</h4>
                                    <p className="text-xs text-text-secondary">Gem som PDF-rapport med målskitse og tabel.</p>
                                </div>
                            </button>
                        )}
                    </div>
                </GenericModal>
            )}

            {/* Project Picker Modal */}
            {showProjectPicker && (
                <GenericModal title="Vælg Projekt" onClose={() => setShowProjectPicker(false)}>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                        {projects.length > 0 ? (
                            projects.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => handleProjectSelect(p.id)}
                                    className="w-full p-3 text-left hover:bg-bg-subtle rounded-lg flex items-center justify-between border-b border-border last:border-0"
                                >
                                    <div>
                                        <p className="font-semibold text-sm text-text-primary">{p.name}</p>
                                        <p className="text-xs text-text-secondary">#{p.projectNumber}</p>
                                    </div>
                                    <FolderIcon className="w-4 h-4 text-text-tertiary" />
                                </button>
                            ))
                        ) : (
                            <p className="text-center py-8 text-text-secondary">Ingen projekter fundet.</p>
                        )}
                    </div>
                </GenericModal>
            )}

        </CalculatorPage>
    );
};

export default MeasurementTool;
