
import React, { useState } from 'react';
import type { Project } from '../../../types';
import { generateProjectPlan, AiProjectPlan, QuotaExceededError } from '../../ai';
import { createProjectWithPlan } from '../services/projects';
import { XIcon, PlusIcon, FileTextIcon, ImageIcon, UploadCloudIcon } from '../../../components/icons';
import FilePicker from '../../../components/FilePicker';
import { useAuth } from '../../../contexts/AuthProvider';
import { useToast } from '../../../contexts/ToastContext';
import { Badge, Button, Input, Modal, Textarea } from '../../../components/ui';
import { ModuleGate, useModuleGate } from '../../../core/entitlements/ModuleGate';

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProjectCreated: (newProject: Project) => void;
    /** Called when user clicks the "Hurtig" quick-create button */
    onQuickCreate?: () => void;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, onProjectCreated, onQuickCreate }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const aiEnabled = useModuleGate('ai');
    const [step, setStep] = useState<'input' | 'review'>('input');
    const [projectName, setProjectName] = useState('');
    const [projectDesc, setProjectDesc] = useState('');

    // New State for Dates & Files
    const [startDate, setStartDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [endDate, setEndDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA'));
    const [files, setFiles] = useState<File[]>([]);

    const [isLoading, setIsLoading] = useState(false);
    const [aiPlan, setAiPlan] = useState<AiProjectPlan | null>(null);

    const handleFileSelect = (file: File) => {
        setFiles(prev => [...prev, file]);
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleGeneratePlan = async () => {
        if (!projectName.trim() || !aiEnabled) return;
        setIsLoading(true);
        try {
            const plan = await generateProjectPlan(projectName, projectDesc, files);
            setAiPlan(plan);
            setStep('review');
        } catch (error) {
            console.error("Failed to generate plan:", error);
            if (error instanceof QuotaExceededError) {
                showToast('Du har nået din daglige AI-grænse. Opgrader for mere.', 'warning');
            } else {
                showToast("Kunne ikke generere plan. Prøv igen.", 'error');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateProject = async () => {
        if (!aiPlan) return;
        setIsLoading(true);
        try {
            const newProject = await createProjectWithPlan(
                projectName,
                projectDesc,
                aiPlan.tasks,
                aiPlan.shoppingList,
                [], // Team members
                startDate, // Pass explicit start date
                endDate,   // Pass explicit end date
                user?.id   // Pass ownerId
            );
            onProjectCreated(newProject);
        } catch (error) {
            console.error("Failed to create project:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const resetState = () => {
        setStep('input');
        setProjectName('');
        setProjectDesc('');
        setStartDate(new Date().toLocaleDateString('en-CA'));
        setEndDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA'));
        setFiles([]);
        setAiPlan(null);
        setIsLoading(false);
        onClose();
    };

    return (
        <Modal
            open={isOpen}
            onClose={resetState}
            title={step === 'input' ? 'Opret Nyt Projekt' : `Plan for: ${projectName}`}
            size="md"
            footer={step === 'input' ? (
                <div className="flex w-full flex-col gap-2">
                    <ModuleGate moduleId="ai" mode="hide">
                        <Button
                            size="lg"
                            fullWidth
                            loading={isLoading}
                            disabled={!projectName.trim()}
                            onClick={handleGeneratePlan}
                            iconLeft={<UploadCloudIcon className="w-5 h-5" />}
                        >
                            {isLoading ? 'Genererer Plan...' : 'Generér Plan med AI'}
                        </Button>
                    </ModuleGate>
                    {onQuickCreate && (
                        <Button
                            size="lg"
                            fullWidth
                            variant="outline"
                            onClick={() => { onClose(); onQuickCreate(); }}
                            iconLeft={<PlusIcon className="w-5 h-5" />}
                        >
                            Hurtig
                        </Button>
                    )}
                </div>
            ) : (
                <div className="flex w-full gap-2">
                    <Button size="lg" variant="outline" className="flex-1" disabled={isLoading} onClick={() => setStep('input')}>
                        Tilbage
                    </Button>
                    <Button
                        size="lg"
                        className="flex-[2]"
                        loading={isLoading}
                        onClick={handleCreateProject}
                        iconRight={<PlusIcon className="w-5 h-5" />}
                    >
                        {isLoading ? 'Opretter...' : 'Opret Projekt'}
                    </Button>
                </div>
            )}
        >
            {step === 'input' && (
                <div className="space-y-4 pt-1">
                    <Input
                        label="Projekttitel"
                        value={projectName}
                        onChange={e => setProjectName(e.target.value)}
                        type="text"
                        placeholder="F.eks. Renovering af badeværelse"
                    />

                    {/* Date Inputs */}
                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            label="Startdato"
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                        />
                        <Input
                            label="Deadline"
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                        />
                    </div>

                    <Textarea
                        label="Beskrivelse"
                        value={projectDesc}
                        onChange={e => setProjectDesc(e.target.value)}
                        rows={4}
                        placeholder="Tilføj detaljer om projektet, f.eks. 'Nyt badeværelse på 1. sal...'"
                        className="resize-none"
                    />

                    {/* File Upload */}
                    <div>
                        <span className="block text-sm font-medium text-text-primary dark:text-text-dark-primary mb-1.5">Filer &amp; Billeder</span>
                        <FilePicker
                            onFileSelect={handleFileSelect}
                            multiple
                            buttonStyle="dashed"
                            label="Upload Dokumenter, Tegninger eller fotos"
                        />
                        {files.length > 0 && (
                            <ul className="mt-3 space-y-2">
                                {files.map((file, idx) => (
                                    <li key={idx} className="flex items-center justify-between gap-2 p-2 rounded-control border border-border dark:border-border-dark bg-bg-subtle dark:bg-bg-dark-muted">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <span className="flex w-8 h-8 items-center justify-center rounded-control bg-brand-subtle text-brand-primary dark:bg-brand-subtle-dark dark:text-brand-light shrink-0" aria-hidden="true">
                                                {file.type.startsWith('image') ? <ImageIcon className="w-4 h-4" /> : <FileTextIcon className="w-4 h-4" />}
                                            </span>
                                            <span className="text-label font-medium text-text-primary dark:text-text-dark-primary truncate">{file.name}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeFile(idx)}
                                            aria-label={`Fjern ${file.name}`}
                                            className="p-2 rounded-control text-text-tertiary hover:text-danger hover:bg-danger-subtle dark:text-text-dark-tertiary dark:hover:bg-danger-subtle-dark transition-colors duration-150 shrink-0"
                                        >
                                            <XIcon className="w-4 h-4" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}

            {step === 'review' && aiPlan && (
                <div className="space-y-5 pt-1">
                    <section>
                        <h3 className="text-heading text-text-primary dark:text-text-dark-primary mb-2">Foreslåede Opgaver</h3>
                        <div className="space-y-2">
                            {aiPlan.tasks.map((task, index) => (
                                <div key={index} className="rounded-card border border-border dark:border-border-dark bg-bg-subtle dark:bg-bg-dark-muted p-3">
                                    <p className="text-label font-semibold text-text-primary dark:text-text-dark-primary">{task.title}</p>
                                    <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-1">{task.description}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                    <section>
                        <h3 className="text-heading text-text-primary dark:text-text-dark-primary mb-2">Indkøbsliste</h3>
                        <div className="space-y-2">
                            {aiPlan.shoppingList.map((item, index) => (
                                <div key={index} className="rounded-card border border-border dark:border-border-dark bg-bg-subtle dark:bg-bg-dark-muted p-3 flex justify-between items-center gap-3">
                                    <div className="min-w-0">
                                        <p className="text-label font-semibold text-text-primary dark:text-text-dark-primary truncate">{item.name}</p>
                                        <p className="text-caption text-text-secondary dark:text-text-dark-secondary">{item.details}</p>
                                    </div>
                                    <Badge variant="neutral" className="shrink-0">{item.quantity} stk</Badge>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            )}
        </Modal>
    );
};

export default CreateProjectModal;
