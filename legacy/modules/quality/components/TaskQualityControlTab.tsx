import React, { useCallback, useEffect, useState } from 'react';
import type {
    Project,
    ProjectMember,
    Task,
    TaskQualityControl,
    TaskQualityControlPhoto,
    TaskQualityControlResult,
    TaskQualityControlType,
} from '../../../types';
import {
    addTaskQualityControl,
    deleteTaskQualityControl,
    listTaskQualityControls,
    updateTaskQualityControl,
    uploadSignature,
    uploadTaskFile,
} from '../services/taskQualityControl';
import { processFileForStorage, resolveFileUrl } from '../../../utils/fileUtils';
import FilePicker from '../../../components/FilePicker';
import SignatureCanvas from '../../../components/SignatureCanvas';
import { useToast } from '../../../contexts/ToastContext';
import {
    AlertTriangleIcon,
    CalendarIcon,
    CheckCircleIcon,
    PlusIcon,
    TrashIcon,
    XIcon,
} from '../../../components/icons';
import { Button, Input, Select, Textarea, cn } from '../../../components/ui';

export interface TaskQualityControlTabProps {
    taskId: string;
    projectId: string;
    task?: Task;
    project?: Project;
    projectTeam: ProjectMember[];
    currentUserId: string;
    currentUserName: string;
    isOwnerOrManager: boolean;
}

type PanelMode = 'idle' | 'create' | 'edit';

const todayIso = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('da-DK');
};

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Noget gik galt. Prøv igen.';
const isUuid = (value: string) => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);

const ControlImage: React.FC<{ photo: TaskQualityControlPhoto }> = ({ photo }) => {
    const [src, setSrc] = useState('');

    useEffect(() => {
        let active = true;
        resolveFileUrl(photo.storagePath).then(url => {
            if (active) setSrc(url);
        });
        return () => { active = false; };
    }, [photo.storagePath]);

    if (!src) {
        return <div className="h-24 w-full animate-pulse rounded-control bg-bg-muted dark:bg-bg-dark-muted" />;
    }

    return <img src={src} alt="Afvigelsesfoto" className="h-24 w-full rounded-control object-cover" />;
};

const ReadOnlyRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <span className="text-caption font-medium text-text-secondary dark:text-text-dark-secondary">{label}</span>
        <span className="text-label text-text-primary dark:text-text-dark-primary sm:text-right">{value || '—'}</span>
    </div>
);

const TaskQualityControlTab: React.FC<TaskQualityControlTabProps> = ({
    taskId,
    projectId,
    task,
    project,
    projectTeam,
    currentUserId,
    currentUserName,
    isOwnerOrManager,
}) => {
    const { showToast } = useToast();
    const [controls, setControls] = useState<TaskQualityControl[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [pendingPhotoUploads, setPendingPhotoUploads] = useState(0);
    const [mode, setMode] = useState<PanelMode>('idle');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [controlPoint, setControlPoint] = useState('');
    const [controlType, setControlType] = useState<TaskQualityControlType>('visuel');
    const [requirementRef, setRequirementRef] = useState('');
    const [result, setResult] = useState<TaskQualityControlResult>('godkendt');
    const [comments, setComments] = useState('');
    const [hasDeviation, setHasDeviation] = useState(false);
    const [deviationDescription, setDeviationDescription] = useState('');
    const [deviationPhotos, setDeviationPhotos] = useState<TaskQualityControlPhoto[]>([]);
    const [correctiveAction, setCorrectiveAction] = useState('');
    const [deviationDeadline, setDeviationDeadline] = useState('');
    const [responsibleId, setResponsibleId] = useState('');
    const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
    const responsibleMembers = projectTeam.filter(member => member.status === 'ACTIVE' && isUuid(member.id));

    const loadControls = useCallback(async () => {
        setLoading(true);
        setLoadError(false);
        try {
            setControls(await listTaskQualityControls(taskId));
        } catch (error) {
            setLoadError(true);
            showToast(errorMessage(error), 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast, taskId]);

    useEffect(() => {
        void loadControls();
    }, [loadControls]);

    const clearFields = () => {
        setEditingId(null);
        setControlPoint('');
        setControlType('visuel');
        setRequirementRef('');
        setResult('godkendt');
        setComments('');
        setHasDeviation(false);
        setDeviationDescription('');
        setDeviationPhotos([]);
        setCorrectiveAction('');
        setDeviationDeadline('');
        setResponsibleId('');
        setSignatureDataUrl(null);
    };

    const resetForm = () => {
        clearFields();
        setMode('idle');
    };

    const beginCreate = () => {
        clearFields();
        setMode('create');
    };

    const beginEdit = (control: TaskQualityControl) => {
        setEditingId(control.id);
        setControlPoint(control.controlPoint ?? '');
        setControlType(control.controlType ?? 'visuel');
        setRequirementRef(control.requirementRef ?? '');
        setResult(control.result ?? 'godkendt');
        setComments(control.comments ?? '');
        setHasDeviation(control.hasDeviation);
        setDeviationDescription(control.deviationDescription ?? '');
        setDeviationPhotos(control.deviationPhotos ?? []);
        setCorrectiveAction(control.correctiveAction ?? '');
        setDeviationDeadline(control.deviationDeadline ?? '');
        setResponsibleId(control.responsibleId ?? '');
        setSignatureDataUrl(null);
        setMode('edit');
    };

    const handleDelete = async (control: TaskQualityControl) => {
        if (!window.confirm(`Slet kontrollen "${control.controlPoint || 'Uden titel'}"?`)) return;
        try {
            await deleteTaskQualityControl(control.id);
            setControls(previous => previous.filter(item => item.id !== control.id));
            showToast('Kontrol slettet', 'success');
        } catch (error) {
            showToast(errorMessage(error), 'error');
        }
    };

    const handlePhotoSelect = async (file: File) => {
        setPendingPhotoUploads(count => count + 1);
        try {
            const processed = await processFileForStorage(file);
            const response = await fetch(processed.dataUrl);
            const blob = await response.blob();
            const storagePath = await uploadTaskFile(projectId, taskId, blob, 'image/jpeg');
            setDeviationPhotos(previous => [...previous, {
                storagePath,
                mimeType: 'image/jpeg',
                sizeBytes: blob.size,
            }]);
        } catch (error) {
            showToast(errorMessage(error), 'error');
        } finally {
            setPendingPhotoUploads(count => Math.max(0, count - 1));
        }
    };

    const handleSave = async () => {
        setSubmitting(true);
        try {
            const signaturePath = signatureDataUrl ? await uploadSignature(signatureDataUrl) : undefined;
            const responsible = responsibleMembers.find(member => member.id === responsibleId);
            const deviationFields = hasDeviation ? {
                deviationDescription: deviationDescription || undefined,
                deviationPhotos,
                correctiveAction: correctiveAction || undefined,
                deviationDeadline: deviationDeadline || undefined,
                responsibleId: responsible?.id,
                responsibleName: responsible?.name,
            } : {
                deviationDescription: undefined,
                deviationPhotos: [],
                correctiveAction: undefined,
                deviationDeadline: undefined,
                responsibleId: undefined,
                responsibleName: undefined,
            };

            if (mode === 'edit' && editingId) {
                await updateTaskQualityControl(editingId, {
                    controlPoint: controlPoint || null,
                    controlType,
                    requirementRef: requirementRef || null,
                    result,
                    comments: comments || null,
                    hasDeviation,
                    deviationDescription: deviationFields.deviationDescription ?? null,
                    deviationPhotos: deviationFields.deviationPhotos,
                    correctiveAction: deviationFields.correctiveAction ?? null,
                    deviationDeadline: deviationFields.deviationDeadline ?? null,
                    responsibleId: deviationFields.responsibleId ?? null,
                    responsibleName: deviationFields.responsibleName ?? null,
                    ...(signaturePath ? { signaturePath } : {}),
                    controlDate: todayIso(),
                });
            } else {
                await addTaskQualityControl({
                    taskId,
                    projectId,
                    authorId: currentUserId,
                    authorName: currentUserName,
                    controlPoint: controlPoint || undefined,
                    controlType,
                    requirementRef: requirementRef || undefined,
                    result,
                    comments: comments || undefined,
                    hasDeviation,
                    ...deviationFields,
                    signaturePath,
                    controlDate: todayIso(),
                });
            }

            await loadControls();
            resetForm();
            showToast('Kontrol gemt', 'success');
        } catch (error) {
            showToast(errorMessage(error), 'error');
        } finally {
            setSubmitting(false);
        }
    };

    if (mode === 'idle') {
        return (
            <div className="space-y-4">
                <Button iconLeft={<PlusIcon className="h-4 w-4" />} onClick={beginCreate}>
                    Opret ny kontrol
                </Button>

                {loading ? (
                    <div className="flex justify-center py-10" role="status" aria-label="Indlæser kontroller">
                        <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
                    </div>
                ) : loadError ? (
                    <div role="alert" className="rounded-card border border-danger/30 bg-danger-subtle p-5 text-center dark:bg-danger-subtle-dark">
                        <AlertTriangleIcon className="mx-auto mb-2 h-8 w-8 text-danger" />
                        <p className="text-label font-semibold text-danger-strong dark:text-danger">Kunne ikke hente kontroller</p>
                        <p className="mt-1 text-caption text-text-secondary dark:text-text-dark-secondary">Prøv igen om et øjeblik.</p>
                        <Button variant="outline" size="sm" className="mt-3" onClick={() => void loadControls()}>Prøv igen</Button>
                    </div>
                ) : controls.length === 0 ? (
                    <div className="rounded-card border border-dashed border-border-strong py-10 text-center dark:border-border-dark-strong">
                        <CheckCircleIcon className="mx-auto mb-3 h-9 w-9 text-text-tertiary dark:text-text-dark-tertiary" />
                        <p className="text-label font-semibold text-text-primary dark:text-text-dark-primary">Ingen kontroller endnu</p>
                        <p className="mt-1 text-caption text-text-secondary dark:text-text-dark-secondary">Opret den første kvalitetssikring for opgaven.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {controls.map(control => {
                            const approved = control.result === 'godkendt';
                            const canManage = isOwnerOrManager || control.authorId === currentUserId;
                            const title = control.controlPoint || 'Kontrol uden titel';
                            return (
                                <article key={control.id} className="rounded-card border border-border bg-bg p-4 dark:border-border-dark dark:bg-bg-dark-surface">
                                    <div className="flex items-start gap-3">
                                        <div className={cn(
                                            'mt-0.5 rounded-full p-2',
                                            approved
                                                ? 'bg-success-subtle text-success-strong dark:bg-success-subtle-dark dark:text-success'
                                                : 'bg-danger-subtle text-danger-strong dark:bg-danger-subtle-dark dark:text-danger'
                                        )}>
                                            {approved ? <CheckCircleIcon className="h-5 w-5" /> : <AlertTriangleIcon className="h-5 w-5" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h4 className="text-label font-semibold text-text-primary dark:text-text-dark-primary">{title}</h4>
                                                <span className={cn(
                                                    'rounded-full px-2 py-0.5 text-caption font-semibold',
                                                    approved
                                                        ? 'bg-success-subtle text-success-strong dark:bg-success-subtle-dark dark:text-success'
                                                        : 'bg-danger-subtle text-danger-strong dark:bg-danger-subtle-dark dark:text-danger'
                                                )}>
                                                    {approved ? 'Godkendt' : 'Ikke godkendt'}
                                                </span>
                                                {control.hasDeviation && (
                                                    <span className="rounded-full bg-warning-subtle px-2 py-0.5 text-caption font-semibold text-warning-strong dark:bg-warning-subtle-dark dark:text-warning">
                                                        Afvigelse
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-1 flex items-center gap-1.5 text-caption text-text-secondary dark:text-text-dark-secondary">
                                                <CalendarIcon className="h-3.5 w-3.5" />
                                                {control.authorName} · {formatDate(control.controlDate)}
                                            </p>
                                        </div>
                                        {canManage && (
                                            <div className="flex flex-shrink-0 gap-1">
                                                <button
                                                    type="button"
                                                    aria-label={`Rediger ${title}`}
                                                    onClick={() => beginEdit(control)}
                                                    className="rounded-control px-2.5 py-2 text-caption font-semibold text-brand-primary hover:bg-brand-subtle dark:hover:bg-brand-subtle-dark"
                                                >
                                                    Rediger
                                                </button>
                                                <button
                                                    type="button"
                                                    aria-label={`Slet ${title}`}
                                                    onClick={() => void handleDelete(control)}
                                                    className="rounded-control p-2 text-text-tertiary hover:bg-danger-subtle hover:text-danger dark:text-text-dark-tertiary dark:hover:bg-danger-subtle-dark"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    const projectLabel = [project?.name, project?.projectNumber].filter(Boolean).join(' · ');

    return (
        <div className="rounded-card border border-border bg-bg p-4 dark:border-border-dark dark:bg-bg-dark-surface sm:p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                    <h3 className="text-heading text-text-primary dark:text-text-dark-primary">
                        {mode === 'edit' ? 'Rediger kontrol' : 'Opret ny kontrol'}
                    </h3>
                    <p className="text-caption text-text-secondary dark:text-text-dark-secondary">Kvalitetssikring for den valgte opgave</p>
                </div>
                <button
                    type="button"
                    aria-label="Luk kontrol"
                    onClick={resetForm}
                    className="rounded-control p-2 text-text-secondary hover:bg-bg-muted dark:text-text-dark-secondary dark:hover:bg-bg-dark-muted"
                >
                    <XIcon className="h-5 w-5" />
                </button>
            </div>

            <div className="space-y-6">
                <section>
                    <h4 className="mb-2 text-label font-semibold text-text-primary dark:text-text-dark-primary">Oplysninger</h4>
                    <div className="divide-y divide-border rounded-control border border-border bg-bg-subtle px-3 dark:divide-border-dark dark:border-border-dark dark:bg-bg-dark-muted">
                        <ReadOnlyRow label="Opgavetitel" value={task?.title ?? ''} />
                        <ReadOnlyRow label="Opgave-ID" value={taskId} />
                        <ReadOnlyRow label="Projekt" value={projectLabel} />
                        <ReadOnlyRow label="Dato" value={new Date().toLocaleDateString('da-DK')} />
                        <ReadOnlyRow label="Udført af" value={currentUserName} />
                    </div>
                </section>

                <section className="space-y-4">
                    <h4 className="text-label font-semibold text-text-primary dark:text-text-dark-primary">Kontrol</h4>
                    <Input label="Kontrolpunkt/aktivitet" value={controlPoint} onChange={event => setControlPoint(event.target.value)} />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Select label="Kontroltype" value={controlType} onChange={event => setControlType(event.target.value as TaskQualityControlType)}>
                            <option value="visuel">Visuel</option>
                            <option value="maaling">Måling</option>
                            <option value="dokumentation">Dokumentation</option>
                        </Select>
                        <Select label="Resultat" value={result} onChange={event => setResult(event.target.value as TaskQualityControlResult)}>
                            <option value="godkendt">Godkendt</option>
                            <option value="ikke_godkendt">Ikke godkendt</option>
                        </Select>
                    </div>
                    <Input label="Krav/reference" value={requirementRef} onChange={event => setRequirementRef(event.target.value)} />
                    <Textarea label="Kommentarer" value={comments} onChange={event => setComments(event.target.value)} />
                </section>

                <section className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h4 className="text-label font-semibold text-text-primary dark:text-text-dark-primary">Afvigelser</h4>
                            <p className="text-caption text-text-secondary dark:text-text-dark-secondary">Er der registreret en afvigelse?</p>
                        </div>
                        <div className="flex rounded-control bg-bg-muted p-1 dark:bg-bg-dark-muted" role="group" aria-label="Afvigelser">
                            {([false, true] as const).map(value => (
                                <button
                                    key={String(value)}
                                    type="button"
                                    onClick={() => setHasDeviation(value)}
                                    className={cn(
                                        'min-w-14 rounded-control px-3 py-1.5 text-caption font-semibold transition-colors',
                                        hasDeviation === value
                                            ? 'bg-bg text-brand-primary shadow-sm dark:bg-bg-dark-surface dark:text-brand-light'
                                            : 'text-text-secondary dark:text-text-dark-secondary'
                                    )}
                                >
                                    {value ? 'Ja' : 'Nej'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {hasDeviation && (
                        <div className="space-y-4 rounded-control border border-warning/30 bg-warning-subtle/40 p-4 dark:bg-warning-subtle-dark/30">
                            <Textarea label="Beskrivelse" value={deviationDescription} onChange={event => setDeviationDescription(event.target.value)} />
                            <div>
                                <p className="mb-2 text-xs font-medium text-text-secondary dark:text-text-dark-secondary">Foto(s)</p>
                                <FilePicker
                                    accept="image/*"
                                    multiple
                                    buttonStyle="dashed"
                                    label={pendingPhotoUploads > 0 ? `Uploader foto… (${pendingPhotoUploads})` : 'Tilføj foto'}
                                    onFileSelect={file => void handlePhotoSelect(file)}
                                />
                                {deviationPhotos.length > 0 && (
                                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                                        {deviationPhotos.map((photo, index) => (
                                            <div key={`${photo.storagePath}-${index}`} className="relative">
                                                <ControlImage photo={photo} />
                                                <button
                                                    type="button"
                                                    aria-label={`Fjern foto ${index + 1}`}
                                                    onClick={() => setDeviationPhotos(previous => previous.filter((_, photoIndex) => photoIndex !== index))}
                                                    className="absolute right-1.5 top-1.5 rounded-full bg-black/65 p-1 text-white hover:bg-black/80"
                                                >
                                                    <XIcon className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <Textarea
                                label="Udbedring/korrigerende handling"
                                value={correctiveAction}
                                onChange={event => setCorrectiveAction(event.target.value)}
                            />
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Input type="date" label="Frist" value={deviationDeadline} onChange={event => setDeviationDeadline(event.target.value)} />
                                <Select label="Ansvarlig" value={responsibleId} onChange={event => setResponsibleId(event.target.value)}>
                                    <option value="">Vælg ansvarlig</option>
                                    {responsibleMembers.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
                                </Select>
                            </div>
                        </div>
                    )}
                </section>

                <section>
                    <h4 className="mb-2 text-label font-semibold text-text-primary dark:text-text-dark-primary">Signatur (valgfri)</h4>
                    <SignatureCanvas onSignatureChange={setSignatureDataUrl} />
                </section>

                <div className="flex justify-end gap-2 border-t border-border pt-4 dark:border-border-dark">
                    <Button variant="outline" onClick={resetForm}>Annuller</Button>
                    <Button loading={submitting} disabled={pendingPhotoUploads > 0} onClick={() => void handleSave()}>Gem kontrol</Button>
                </div>
            </div>
        </div>
    );
};

export default TaskQualityControlTab;
