import React, { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../../contexts/ToastContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CopyIcon, DownloadIcon, ChevronDownIcon, ChevronUpIcon, RefreshCwIcon, SparklesIcon } from '../../../components/icons';
import { Button, Card, Modal, Spinner } from '../../../components/ui';
import { Project, Task, PurchaseItem, TimeEntry } from '../../../types';
import { getProjectBudgetSummary } from '../../budget';
import { useModuleGate } from '../../../core/entitlements/ModuleGate';

interface AdvancedBriefingModalProps {
    isOpen: boolean;
    onClose: () => void;
    content: string;
    isLoading: boolean;
    title?: string;
    onRefresh?: () => void;
    /**
     * Optional project context. When project, tasks and purchases are all
     * provided, a 'Download intelligensrapport (PDF)' CTA is shown that
     * builds the Intelligence Index + AI feedback and exports a vector PDF.
     */
    project?: Project;
    tasks?: Task[];
    purchases?: PurchaseItem[];
    timeEntries?: TimeEntry[];
    /** Name shown as 'Genereret af …' on the report cover. */
    generatedBy?: string;
}

const AdvancedBriefingModal: React.FC<AdvancedBriefingModalProps> = ({ isOpen, onClose, content, isLoading, title = "Avanceret Daglig Briefing", onRefresh, project, tasks, purchases, timeEntries, generatedBy }) => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const budgetEnabled = useModuleGate('budget');
    const briefingContentRef = useRef<HTMLDivElement>(null);
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    const canGenerateIntelligenceReport = !!project && !!tasks && !!purchases;

    const handleDownloadIntelligenceReport = async () => {
        if (!project || !tasks || !purchases || isGeneratingReport) return;
        setIsGeneratingReport(true);
        try {
            const [{ computeIntelligenceIndex, generateIndexFeedback }, { generateIntelligenceReport }] =
                await Promise.all([
                    import('../services/projectIntelligence'),
                    import('../../reporting'),
                ]);

            // `budget` sub-dependency: only fetched when the budget module is entitled.
            // computeIntelligenceIndex/generateIntelligenceReport fall back gracefully
            // (legacy project.budget calc) when budgetSummary is null.
            const budgetSummary = budgetEnabled ? await getProjectBudgetSummary(project.id) : null;
            const index = computeIntelligenceIndex({ project, tasks, purchases, timeEntries, budgetSummary });
            const feedback = await generateIndexFeedback(index, { project, tasks, purchases });

            const doc = generateIntelligenceReport({ project, tasks, purchases, index, feedback, generatedBy, budgetSummary });
            const safeName = (project.name || 'projekt').replace(/[^\wæøåÆØÅ-]+/g, '_');
            doc.save(`Intelligensrapport_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
            showToast('Intelligensrapport downloadet.', 'success');
        } catch (error) {
            console.error('Failed to generate intelligence report:', error);
            showToast('Kunne ikke generere intelligensrapporten. Prøv igen.', 'error');
        } finally {
            setIsGeneratingReport(false);
        }
    };

    const sections = useMemo(() => {
        if (!content) return [];
        return content.split('\n## ').map((section, index) => {
            if (index === 0 && !section.startsWith('##')) {
                 const firstH2 = section.indexOf('## ');
                 if (firstH2 > -1) {
                     // handles cases where first section isn't split correctly
                     return { title: section.substring(0, firstH2).trim(), content: section.substring(firstH2)};
                 }
                 return { title: 'Introduktion', content: section };
            }
            const parts = section.split('\n');
            const title = parts[0].replace('## ', '').trim();
            const content = parts.slice(1).join('\n');
            return { title, content };
        }).filter(s => s.title && s.content.trim());
    }, [content]);

    const toggleSection = (title: string) => {
        setCollapsedSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(title)) {
                newSet.delete(title);
            } else {
                newSet.add(title);
            }
            return newSet;
        });
    };

    const handleCopyToClipboard = () => {
        // A more robust copy that handles markdown
        const plainText = content
            .replace(/##\s/g, '') // Remove H2
            .replace(/###\s/g, '') // Remove H3
            .replace(/\*\*/g, '') // Remove bold
            .replace(/\*/g, '') // Remove italics/bullets
            .replace(/\[(.*?)\]\(.*?\)/g, '$1'); // Convert [text](link) to text

        navigator.clipboard.writeText(plainText)
            .then(() => showToast('Briefing kopieret til udklipsholder.', 'success'))
            .catch(err => console.error('Failed to copy text: ', err));
    };

    const handleExportToPdf = async () => {
        if (!briefingContentRef.current) return;
        const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
            import('html2canvas-pro'),
            import('jspdf'),
        ]);

        const canvas = await html2canvas(briefingContentRef.current, { scale: 2, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');

        // A4 dimensions in pixels at 96 DPI are roughly 794x1123
        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'px',
            format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const canvasAspectRatio = canvas.width / canvas.height;
        const pdfAspectRatio = pdfWidth / pdfHeight;

        let finalCanvasWidth, finalCanvasHeight;

        if (canvasAspectRatio > pdfAspectRatio) {
            finalCanvasWidth = pdfWidth;
            finalCanvasHeight = pdfWidth / canvasAspectRatio;
        } else {
            finalCanvasHeight = pdfHeight;
            finalCanvasWidth = pdfHeight * canvasAspectRatio;
        }

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, canvas.height * (pdfWidth/canvas.width));

        pdf.save(`${title.replace(/\s/g, '_')}_${new Date().toLocaleDateString('da-DK')}.pdf`);
    };

    if (!isOpen) return null;

    const CustomLink: React.FC<any> = ({ href, children }) => {
        if (href?.startsWith('#/')) {
            return <a onClick={() => { navigate(href.substring(1)); onClose(); }} className="text-brand-primary font-semibold hover:underline cursor-pointer">{children}</a>;
        }
        return <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-primary hover:underline">{children}</a>;
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title={title}
            size="lg"
            className="h-[88dvh]"
            footer={
                <div className="flex w-full flex-wrap items-center justify-between gap-3">
                    <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary">
                        AI-genereret {new Date().toLocaleDateString('da-DK')}
                    </p>
                    <div className="flex items-center flex-wrap justify-end gap-2">
                        {canGenerateIntelligenceReport && (
                            <Button
                                variant="outline"
                                loading={isGeneratingReport}
                                onClick={handleDownloadIntelligenceReport}
                                iconLeft={<SparklesIcon className="w-4 h-4" />}
                            >
                                {isGeneratingReport ? 'Genererer rapport…' : 'Download intelligensrapport (PDF)'}
                            </Button>
                        )}
                        {onRefresh && (
                            <Button
                                variant="outline"
                                onClick={onRefresh}
                                disabled={isLoading}
                                iconLeft={<RefreshCwIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
                            >
                                Opdater
                            </Button>
                        )}
                        <Button variant="outline" onClick={handleCopyToClipboard} iconLeft={<CopyIcon className="w-4 h-4" />}>
                            Kopier
                        </Button>
                        <Button onClick={handleExportToPdf} iconLeft={<DownloadIcon className="w-4 h-4" />}>
                            Eksporter PDF
                        </Button>
                    </div>
                </div>
            }
        >
            {isLoading ? (
                <div className="flex h-full items-center justify-center py-16">
                    <div className="text-center">
                        <Spinner className="h-8 w-8 text-brand-primary mx-auto" />
                        <p className="mt-4 text-heading text-text-primary dark:text-text-dark-primary">Genererer avanceret briefing...</p>
                        <p className="mt-1 text-label text-text-secondary dark:text-text-dark-secondary">Dette kan tage et øjeblik.</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-3 pt-1" ref={briefingContentRef}>
                    {sections.map(({ title, content }) => {
                        const isCollapsed = collapsedSections.has(title);
                        return (
                            <Card key={title} padding="none" className="overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => toggleSection(title)}
                                    aria-expanded={!isCollapsed}
                                    className="w-full min-h-11 flex items-center justify-between gap-3 px-4 py-3 text-left bg-bg-subtle dark:bg-bg-dark-muted hover:bg-bg-muted dark:hover:bg-bg-dark-muted/70 transition-colors duration-150"
                                >
                                    <h3 className="text-heading text-text-primary dark:text-text-dark-primary">{title}</h3>
                                    {isCollapsed
                                        ? <ChevronDownIcon className="w-5 h-5 shrink-0 text-text-tertiary dark:text-text-dark-tertiary" />
                                        : <ChevronUpIcon className="w-5 h-5 shrink-0 text-text-tertiary dark:text-text-dark-tertiary" />}
                                </button>
                                {!isCollapsed && (
                                    <div className="p-4 prose prose-sm dark:prose-invert max-w-none text-body text-text-primary dark:text-text-dark-primary">
                                        <ReactMarkdown components={{ a: CustomLink }} remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}
        </Modal>
    );
};

export default AdvancedBriefingModal;
