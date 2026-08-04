
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DocumentItem, DocumentCategory, DocumentAccessLevel, ProjectResource } from '../../../types';
import { uploadDocument, getDocumentVisibility, setDocumentVisibility } from '../services/documents';
import { getProjectResources } from '../../projects';
import { FileTextIcon, DownloadIcon, UploadCloudIcon, EyeIcon, LockIcon, UsersIcon, ImageIcon } from '../../../components/icons';
import FilePicker from '../../../components/FilePicker';
import { useAuth } from '../../../contexts/AuthProvider';
import { useToast } from '../../../contexts/ToastContext';
import { Button, Card, Chip, EmptyState, Input, ListRow, Modal, Select, cn } from '../../../components/ui';

interface DocumentsTabContentProps {
    projectId: string;
    documents: DocumentItem[];
    onUpload: () => void;
    onFilterChange: (category?: DocumentCategory) => void;
    isManager?: boolean;
}

const ACCESS_LEVEL_LABELS: Record<DocumentAccessLevel, string> = {
    public_team: 'Hele teamet',
    managers_only: 'Kun ledelse',
    custom_users: 'Vælg personer',
};

/** Danish label + semantic icon-bubble tone per document category. */
const CATEGORY_META: Record<DocumentCategory, { label: string; bubble: string }> = {
    GENERAL:                { label: 'Generelt',        bubble: 'bg-bg-muted text-text-secondary dark:bg-bg-dark-muted dark:text-text-dark-secondary' },
    TECHNICAL_DRAWINGS:     { label: 'Tegninger',       bubble: 'bg-info-subtle text-info-strong dark:bg-info-subtle-dark dark:text-info' },
    CONTRACT_LEGAL:         { label: 'Kontrakt & jura', bubble: 'bg-warning-subtle text-warning-strong dark:bg-warning-subtle-dark dark:text-warning' },
    PLANNING_EXECUTION:     { label: 'Planlægning',     bubble: 'bg-brand-subtle text-brand-primary dark:bg-brand-subtle-dark dark:text-brand-light' },
    SAFETY_WORK:            { label: 'Sikkerhed',       bubble: 'bg-danger-subtle text-danger-strong dark:bg-danger-subtle-dark dark:text-danger' },
    ENVIRONMENT_COMPLIANCE: { label: 'Miljø',           bubble: 'bg-success-subtle text-success-strong dark:bg-success-subtle-dark dark:text-success' },
    FINANCE_ADMIN:          { label: 'Økonomi & admin', bubble: 'bg-success-subtle text-success-strong dark:bg-success-subtle-dark dark:text-success' },
    COMM_REPORTING:         { label: 'Kommunikation',   bubble: 'bg-info-subtle text-info-strong dark:bg-info-subtle-dark dark:text-info' },
    HANDOVER_COMPLETION:    { label: 'Aflevering',      bubble: 'bg-brand-subtle text-brand-primary dark:bg-brand-subtle-dark dark:text-brand-light' },
};

const fmtSize = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 KB';
    if (bytes >= 1048576) return `${(bytes / 1048576).toLocaleString('da-DK', { maximumFractionDigits: 1 })} MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} B`;
};

const AccessLevelIcon: React.FC<{ level: DocumentAccessLevel; className?: string }> = ({ level, className }) => {
    if (level === 'managers_only') return <LockIcon className={className} />;
    if (level === 'custom_users') return <UsersIcon className={className} />;
    return <EyeIcon className={className} />;
};

/* ------------------------------------------------------------------ */
/* Visibility picker modal                                              */
/* ------------------------------------------------------------------ */

interface VisibilityModalProps {
    document: DocumentItem;
    projectId: string;
    onClose: () => void;
    onSaved: (docId: string, level: DocumentAccessLevel) => void;
}

const VisibilityModal: React.FC<VisibilityModalProps> = ({ document, projectId, onClose, onSaved }) => {
    const [accessLevel, setAccessLevel] = useState<DocumentAccessLevel>(document.accessLevel);
    const [resources, setResources] = useState<ProjectResource[]>([]);
    const [selectedResourceIds, setSelectedResourceIds] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        getProjectResources(projectId).then(setResources);
        if (document.accessLevel === 'custom_users') {
            getDocumentVisibility(document.id).then(ids => setSelectedResourceIds(new Set(ids)));
        }
    }, [projectId, document.id, document.accessLevel]);

    const toggleResource = (id: string) => {
        setSelectedResourceIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const ids = accessLevel === 'custom_users' ? Array.from(selectedResourceIds) : undefined;
            await setDocumentVisibility(document.id, accessLevel, ids);
            onSaved(document.id, accessLevel);
            showToast('Synlighed opdateret', 'success');
            onClose();
        } catch {
            showToast('Kunne ikke gemme synlighed. Prøv igen.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const activeResources = resources.filter(r => r.status === 'active' || r.status === 'pending');

    return (
        <Modal
            open
            title={`Synlighed — ${document.name}`}
            onClose={onClose}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>Annuller</Button>
                    <Button
                        onClick={handleSave}
                        loading={saving}
                        disabled={accessLevel === 'custom_users' && selectedResourceIds.size === 0}
                    >
                        Gem
                    </Button>
                </>
            }
        >
            <div className="space-y-3">
                {(['public_team', 'managers_only', 'custom_users'] as DocumentAccessLevel[]).map(level => (
                    <label
                        key={level}
                        className={cn(
                            'flex items-center gap-3 p-3 min-h-11 rounded-control border cursor-pointer transition-colors duration-150',
                            accessLevel === level
                                ? 'border-brand-primary bg-brand-subtle dark:bg-brand-subtle-dark'
                                : 'border-border-strong dark:border-border-dark-strong'
                        )}
                    >
                        <input
                            type="radio"
                            name="access_level"
                            checked={accessLevel === level}
                            onChange={() => setAccessLevel(level)}
                            className="accent-brand-primary"
                        />
                        <AccessLevelIcon level={level} className="w-4 h-4 text-text-secondary dark:text-text-dark-secondary shrink-0" />
                        <span className="text-label font-medium text-text-primary dark:text-text-dark-primary">{ACCESS_LEVEL_LABELS[level]}</span>
                    </label>
                ))}

                {accessLevel === 'custom_users' && (
                    <div className="mt-2 border border-border rounded-control divide-y divide-border dark:border-border-dark dark:divide-border-dark max-h-56 overflow-y-auto">
                        {activeResources.length === 0 && (
                            <p className="p-3 text-label text-text-secondary dark:text-text-dark-secondary">Ingen teammedlemmer fundet.</p>
                        )}
                        {activeResources.map(r => (
                            <label key={r.id} className="flex items-center gap-3 px-3 py-2.5 min-h-11 cursor-pointer hover:bg-bg-subtle dark:hover:bg-bg-dark-muted/50 transition-colors duration-150">
                                <input
                                    type="checkbox"
                                    checked={selectedResourceIds.has(r.id)}
                                    onChange={() => toggleResource(r.id)}
                                    className="w-4 h-4 rounded border-border-strong accent-brand-primary shrink-0"
                                />
                                <div className="flex items-center gap-2">
                                    <span className="w-7 h-7 rounded-full bg-brand-primary text-white text-caption flex items-center justify-center font-medium shrink-0">{r.initials}</span>
                                    <div>
                                        <p className="text-label font-medium text-text-primary dark:text-text-dark-primary leading-tight">{r.name}</p>
                                        <p className="text-caption text-text-secondary dark:text-text-dark-secondary">{r.kind === 'partner' ? 'Underleverandør' : 'Medarbejder'}</p>
                                    </div>
                                </div>
                            </label>
                        ))}
                    </div>
                )}
            </div>
        </Modal>
    );
};

/* ------------------------------------------------------------------ */
/* Upload modal                                                         */
/* ------------------------------------------------------------------ */

interface UploadModalProps {
    projectId: string;
    isManager: boolean;
    onClose: () => void;
    onUploadSuccess: () => void;
}

const UploadDocumentModal: React.FC<UploadModalProps> = ({ projectId, isManager, onClose, onUploadSuccess }) => {
    const [file, setFile] = useState<File | null>(null);
    const [name, setName] = useState('');
    const [category, setCategory] = useState<DocumentCategory>('GENERAL');
    const [accessLevel, setAccessLevel] = useState<DocumentAccessLevel>('public_team');
    const [resources, setResources] = useState<ProjectResource[]>([]);
    const [selectedResourceIds, setSelectedResourceIds] = useState<Set<string>>(new Set());
    const [isUploading, setIsUploading] = useState(false);
    const { user } = useAuth();
    const { showToast } = useToast();

    useEffect(() => {
        if (isManager) {
            getProjectResources(projectId).then(res =>
                setResources(res.filter(r => r.status === 'active' || r.status === 'pending'))
            );
        }
    }, [projectId, isManager]);

    const handleFileSelect = (selectedFile: File) => { setFile(selectedFile); setName(selectedFile.name); };

    const toggleResource = (id: string) => {
        setSelectedResourceIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleUpload = async () => {
        if (!file) return;
        setIsUploading(true);
        try {
            // Phase 6: the file goes to the private task-docs bucket
            // (org-prefixed path); the row stores the storage path.
            const created = await uploadDocument(projectId, {
                name,
                sizeBytes: file.size,
                mimeType: file.type,
                category,
                accessLevel,
                passwordProtected: false,
                isDrawing: false,
                createdBy: user?.name || 'Ukendt',
            }, file);

            if (accessLevel === 'custom_users' && selectedResourceIds.size > 0) {
                await setDocumentVisibility(created.id, accessLevel, Array.from(selectedResourceIds));
            }

            onUploadSuccess();
            onClose();
        } catch {
            showToast('Kunne ikke uploade dokumentet. Prøv igen.', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Modal
            open
            title="Upload dokument"
            onClose={onClose}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>Annuller</Button>
                    <Button
                        onClick={handleUpload}
                        loading={isUploading}
                        disabled={!file || (accessLevel === 'custom_users' && selectedResourceIds.size === 0)}
                    >
                        Upload
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="w-full">
                    <FilePicker onFileSelect={handleFileSelect} buttonStyle="dashed" label={file ? `Valgt: ${file.name}` : 'Vælg fil fra enhed eller Drive'} />
                </div>
                <Input label="Dokumentnavn" value={name} onChange={e => setName(e.target.value)} />
                <Select label="Kategori" value={category} onChange={e => setCategory(e.target.value as DocumentCategory)}>
                    <option value="GENERAL">Generelt</option>
                    <option value="TECHNICAL_DRAWINGS">Tegninger</option>
                    <option value="CONTRACT_LEGAL">Kontrakt</option>
                    <option value="PLANNING_EXECUTION">Planlægning</option>
                </Select>

                {isManager && (
                    <div>
                        <span className="block text-label font-medium text-text-primary dark:text-text-dark-primary mb-1.5">Synlighed</span>
                        <div className="space-y-2">
                            {(['public_team', 'managers_only', 'custom_users'] as DocumentAccessLevel[]).map(level => (
                                <label
                                    key={level}
                                    className={cn(
                                        'flex items-center gap-3 p-2.5 min-h-11 rounded-control border cursor-pointer transition-colors duration-150',
                                        accessLevel === level
                                            ? 'border-brand-primary bg-brand-subtle dark:bg-brand-subtle-dark'
                                            : 'border-border-strong dark:border-border-dark-strong'
                                    )}
                                >
                                    <input
                                        type="radio"
                                        name="upload_access_level"
                                        checked={accessLevel === level}
                                        onChange={() => setAccessLevel(level)}
                                        className="accent-brand-primary"
                                    />
                                    <AccessLevelIcon level={level} className="w-4 h-4 text-text-secondary dark:text-text-dark-secondary shrink-0" />
                                    <span className="text-label font-medium text-text-primary dark:text-text-dark-primary">{ACCESS_LEVEL_LABELS[level]}</span>
                                </label>
                            ))}
                        </div>

                        {accessLevel === 'custom_users' && (
                            <div className="mt-2 border border-border rounded-control divide-y divide-border dark:border-border-dark dark:divide-border-dark max-h-48 overflow-y-auto">
                                {resources.length === 0 && (
                                    <p className="p-3 text-label text-text-secondary dark:text-text-dark-secondary">Ingen teammedlemmer fundet.</p>
                                )}
                                {resources.map(r => (
                                    <label key={r.id} className="flex items-center gap-3 px-3 py-2 min-h-11 cursor-pointer hover:bg-bg-subtle dark:hover:bg-bg-dark-muted/50 transition-colors duration-150">
                                        <input
                                            type="checkbox"
                                            checked={selectedResourceIds.has(r.id)}
                                            onChange={() => toggleResource(r.id)}
                                            className="w-4 h-4 rounded border-border-strong accent-brand-primary shrink-0"
                                        />
                                        <span className="w-6 h-6 rounded-full bg-brand-primary text-white text-caption flex items-center justify-center font-medium shrink-0">{r.initials}</span>
                                        <span className="text-label text-text-primary dark:text-text-dark-primary">{r.name}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
};

/* ------------------------------------------------------------------ */
/* Main tab component                                                   */
/* ------------------------------------------------------------------ */

export const DocumentsTabContent: React.FC<DocumentsTabContentProps> = ({
    projectId,
    documents,
    onUpload,
    onFilterChange,
    isManager = false,
}) => {
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [visibilityDoc, setVisibilityDoc] = useState<DocumentItem | null>(null);
    const [localDocLevels, setLocalDocLevels] = useState<Record<string, DocumentAccessLevel>>({});
    const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | undefined>(undefined);

    const handleVisibilitySaved = useCallback((docId: string, level: DocumentAccessLevel) => {
        setLocalDocLevels(prev => ({ ...prev, [docId]: level }));
    }, []);

    const handleFilter = (category?: DocumentCategory) => {
        setCategoryFilter(category);
        onFilterChange(category);
    };

    // Only offer chips for categories that actually occur in the list.
    const presentCategories = useMemo(() => {
        const seen = new Set<DocumentCategory>();
        documents.forEach(d => seen.add(d.category));
        return (Object.keys(CATEGORY_META) as DocumentCategory[]).filter(c => seen.has(c));
    }, [documents]);

    const visibleDocuments = useMemo(
        () => categoryFilter ? documents.filter(d => d.category === categoryFilter) : documents,
        [documents, categoryFilter]
    );

    const docCaption = (doc: DocumentItem) => {
        const parts = [fmtSize(doc.sizeBytes)];
        if (doc.createdAt) parts.push(new Date(doc.createdAt).toLocaleDateString('da-DK'));
        if (doc.createdBy) parts.push(doc.createdBy);
        return parts.join(' · ');
    };

    return (
        <div className="p-4 space-y-4 pb-24 relative min-h-[calc(100vh-200px)]">
            <h2 className="text-heading text-text-primary dark:text-text-dark-primary">Dokumenter</h2>

            {/* Category filter chips */}
            {presentCategories.length > 0 && (
                <div role="group" aria-label="Filtrer dokumenter efter kategori" className="flex items-center gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1">
                    <Chip selected={!categoryFilter} count={documents.length} onClick={() => handleFilter(undefined)}>Alle</Chip>
                    {presentCategories.map(cat => (
                        <Chip
                            key={cat}
                            selected={categoryFilter === cat}
                            count={documents.filter(d => d.category === cat).length}
                            onClick={() => handleFilter(cat)}
                        >
                            {CATEGORY_META[cat].label}
                        </Chip>
                    ))}
                </div>
            )}

            {/* Upload — dashed card button */}
            <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="w-full min-h-14 rounded-card border-2 border-dashed border-border-strong dark:border-border-dark-strong flex items-center justify-center gap-2 text-label font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-subtle dark:text-text-dark-secondary dark:hover:text-text-dark-primary dark:hover:bg-bg-dark-muted/50 transition-colors duration-150"
            >
                <UploadCloudIcon className="w-5 h-5" />
                Upload dokument
            </button>

            {documents.length === 0 ? (
                <Card padding="none">
                    <EmptyState
                        icon={<UploadCloudIcon className="w-8 h-8" />}
                        title="Ingen dokumenter endnu"
                        description="Upload det første dokument for at samle projektets filer ét sted."
                        action={
                            <Button size="sm" iconLeft={<UploadCloudIcon className="w-4 h-4" />} onClick={() => setIsUploadModalOpen(true)}>
                                Upload dokument
                            </Button>
                        }
                    />
                </Card>
            ) : visibleDocuments.length === 0 ? (
                <Card padding="none">
                    <EmptyState
                        icon={<FileTextIcon className="w-8 h-8" />}
                        title="Ingen dokumenter i denne kategori"
                        description="Prøv at vælge en anden kategori ovenfor."
                    />
                </Card>
            ) : (
                <Card padding="none" className="divide-y divide-border dark:divide-border-dark overflow-hidden">
                    {visibleDocuments.map(doc => {
                        const effectiveLevel = localDocLevels[doc.id] ?? doc.accessLevel;
                        const meta = CATEGORY_META[doc.category] ?? CATEGORY_META.GENERAL;
                        return (
                            <ListRow
                                key={doc.id}
                                leading={
                                    <span className={cn('flex w-10 h-10 items-center justify-center rounded-control shrink-0', meta.bubble)} aria-hidden="true">
                                        {doc.category === 'TECHNICAL_DRAWINGS'
                                            ? <ImageIcon className="w-5 h-5" />
                                            : <FileTextIcon className="w-5 h-5" />}
                                    </span>
                                }
                                title={doc.name}
                                subtitle={docCaption(doc)}
                                trailing={
                                    <>
                                        {isManager && (
                                            <button
                                                type="button"
                                                onClick={() => setVisibilityDoc(doc)}
                                                aria-label={`Synlighed for ${doc.name}: ${ACCESS_LEVEL_LABELS[effectiveLevel]}`}
                                                title={`Synlighed: ${ACCESS_LEVEL_LABELS[effectiveLevel]}`}
                                                className="inline-flex items-center gap-1.5 min-h-11 px-2.5 rounded-control text-caption font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-muted dark:text-text-dark-secondary dark:hover:text-text-dark-primary dark:hover:bg-bg-dark-muted transition-colors duration-150 shrink-0"
                                            >
                                                <AccessLevelIcon level={effectiveLevel} className="w-4 h-4" />
                                                <span className="hidden sm:inline">{ACCESS_LEVEL_LABELS[effectiveLevel]}</span>
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            aria-label={`Download ${doc.name}`}
                                            className="inline-flex w-11 h-11 items-center justify-center rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-muted dark:text-text-dark-secondary dark:hover:text-text-dark-primary dark:hover:bg-bg-dark-muted transition-colors duration-150 shrink-0"
                                        >
                                            <DownloadIcon className="w-5 h-5" />
                                        </button>
                                    </>
                                }
                            />
                        );
                    })}
                </Card>
            )}

            {isUploadModalOpen && (
                <UploadDocumentModal
                    projectId={projectId}
                    isManager={isManager}
                    onClose={() => setIsUploadModalOpen(false)}
                    onUploadSuccess={onUpload}
                />
            )}

            {visibilityDoc && (
                <VisibilityModal
                    document={visibilityDoc}
                    projectId={projectId}
                    onClose={() => setVisibilityDoc(null)}
                    onSaved={handleVisibilitySaved}
                />
            )}
        </div>
    );
};
