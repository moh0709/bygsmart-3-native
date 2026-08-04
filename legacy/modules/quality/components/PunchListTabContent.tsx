
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PunchListItem, PunchListLayout, PunchListItemStatus } from '../../../types';
import { getLayoutsForProject, createLayout, updateLayout, deleteLayout, getPunchListForProject, createPunchListItem, updatePunchListItem, deletePunchListItem } from '../services/punchList';
import { PlusIcon, CameraIcon, MapPinIcon, XIcon, UploadIcon, TrashIcon, DownloadIcon, EditIcon, MaximizeIcon } from '../../../components/icons';
import jsPDF from 'jspdf';
import { getImageType } from '../../../utils/actions';
import { processFileForStorage, resolveFileUrl, resolveStoragePathToDataUrl } from '../../../utils/fileUtils';
import { useToast } from '../../../contexts/ToastContext';
import {
    Badge,
    Button,
    Card,
    ConfirmDialog,
    EmptyState,
    FAB,
    Input,
    Modal,
    SegmentedControl,
    Select,
    SkeletonList,
    Textarea,
    cn,
} from '../../../components/ui';
import type { BadgeVariant } from '../../../components/ui';

/** Semantic status mapping — kit Badge variants for the real punch statuses. */
const STATUS_BADGE: Record<PunchListItemStatus, BadgeVariant> = {
    'Åben': 'warning',
    'I gang': 'info',
    'Løst': 'success',
    'Kræver Supervisor': 'danger',
};

/** Pin colour on the floor plan — mirrors the Badge semantics. */
const PIN_COLOR: Record<PunchListItemStatus, string> = {
    'Åben': 'text-warning',
    'I gang': 'text-info',
    'Løst': 'text-success',
    'Kræver Supervisor': 'text-danger',
};

const ImageViewModal: React.FC<{ src: string; alt: string; onClose: () => void }> = ({ src, alt, onClose }) => {
    const [resolvedSrc, setResolvedSrc] = useState('');

    useEffect(() => {
        resolveFileUrl(src).then(setResolvedSrc);
    }, [src]);

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-4 animate-fade-in" onClick={onClose}>
            <button
                type="button"
                onClick={onClose}
                aria-label="Luk billedvisning"
                className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors"
            >
                <XIcon className="w-6 h-6" />
            </button>
            {resolvedSrc ? (
                <img src={resolvedSrc} alt={alt} className="max-w-full max-h-full object-contain rounded-card" onClick={e => e.stopPropagation()} />
            ) : (
                <div className="text-white text-body">Indlæser billede...</div>
            )}
        </div>
    );
};

const ResolvedImage: React.FC<{ src: string; alt: string; className?: string; onClick?: () => void }> = ({ src, alt, className, onClick }) => {
    const [resolvedSrc, setResolvedSrc] = useState('');

    useEffect(() => {
        let active = true;
        resolveFileUrl(src).then(url => {
            if(active) setResolvedSrc(url);
        });
        return () => { active = false; };
    }, [src]);

    if (!resolvedSrc) return <div className={cn('bg-bg-muted dark:bg-bg-dark-muted animate-pulse', className)}></div>;
    return <img src={resolvedSrc} alt={alt} className={className} onClick={onClick} />;
};

/** Drawing ink colours (literal canvas stroke values — not UI palette). */
const INK_COLORS: Array<{ hex: string; label: string }> = [
    { hex: '#ef4444', label: 'Rød pen' },
    { hex: '#eab308', label: 'Gul pen' },
    { hex: '#3b82f6', label: 'Blå pen' },
];

const AnnotationCanvas: React.FC<{
    imageSrc: string;
    onSave: (dataUrl: string) => void;
    onCancel: () => void;
}> = ({ imageSrc, onSave, onCancel }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#ef4444'); // Red
    const [resolvedSrc, setResolvedSrc] = useState('');

    useEffect(() => {
        resolveFileUrl(imageSrc).then(setResolvedSrc);
    }, [imageSrc]);

    useEffect(() => {
        if (!resolvedSrc) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const img = new Image();
        img.src = resolvedSrc;
        img.onload = () => {
            // Resize canvas to match image aspect ratio but fit screen
            const maxWidth = window.innerWidth - 48;
            const maxHeight = window.innerHeight * 0.6;
            const scale = Math.min(maxWidth / img.width, maxHeight / img.height);

            canvas.width = img.width * scale;
            canvas.height = img.height * scale;

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
    }, [resolvedSrc]);

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
        const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        setIsDrawing(true);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
        const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;

        ctx.lineTo(x, y);
        ctx.stroke();
        e.preventDefault();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const handleSave = async () => {
        if (canvasRef.current) {
            // Convert to blob for storage optimization right away
            canvasRef.current.toBlob(async (blob) => {
                if (blob) {
                     // We need to process this blob into our storage system
                     // But processFileForStorage expects a File.
                     // We can reuse the logic by mocking a File or creating a specialized helper.
                     // For simplicity, let's create a File object.
                     const file = new File([blob], "annotation.jpg", { type: "image/jpeg" });
                     const processed = await processFileForStorage(file);
                     onSave(processed.dataUrl);
                }
            }, 'image/jpeg', 0.7);
        }
    };

    if (!resolvedSrc) return <div className="fixed inset-0 z-[110] bg-black/90 flex items-center justify-center text-white text-body">Indlæser...</div>;

    return (
        <div className="fixed inset-0 z-[110] bg-black/90 flex flex-col items-center justify-center p-4">
             <div className="flex justify-between items-center w-full max-w-md mb-4">
                <Button variant="secondary" onClick={onCancel}>Annuller</Button>
                <div className="flex gap-1" role="group" aria-label="Vælg pennefarve">
                    {INK_COLORS.map(ink => (
                        <button
                            key={ink.hex}
                            type="button"
                            onClick={() => setColor(ink.hex)}
                            aria-label={ink.label}
                            aria-pressed={color === ink.hex}
                            className="w-11 h-11 flex items-center justify-center rounded-full"
                        >
                            <span
                                className={cn('w-6 h-6 rounded-full border-2', color === ink.hex ? 'border-white' : 'border-transparent')}
                                style={{ backgroundColor: ink.hex }}
                                aria-hidden="true"
                            />
                        </button>
                    ))}
                </div>
                <Button onClick={handleSave}>Gem</Button>
            </div>
            <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="bg-white rounded-control touch-none"
            />
        </div>
    );
};

const AddPunchItemModal: React.FC<{
    projectId: string;
    layoutId: string;
    pin: { x: number, y: number };
    onClose: () => void;
    onItemAdded: () => void;
}> = ({ projectId, layoutId, pin, onClose, onItemAdded }) => {
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [description, setDescription] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isAnnotating, setIsAnnotating] = useState(false);
    const { showToast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const processed = await processFileForStorage(file);
            setPhotoUrl(processed.dataUrl);
        }
    };

    const handleAnnotateSave = (dataUrl: string) => {
        setPhotoUrl(dataUrl);
        setIsAnnotating(false);
    };

    const handleSave = async () => {
        if (!photoUrl || !pin || !description.trim()) {
            showToast("Vælg venligst et billede og tilføj en beskrivelse.", 'warning');
            return;
        }
        setIsSaving(true);
        const newItem: Omit<PunchListItem, 'id' | 'timestamp' | 'projectId'> & {layoutId: string} = {
            photoUrl,
            pin,
            description,
            status: 'Åben',
            layoutId: layoutId,
        };
        await createPunchListItem(projectId, newItem);
        setIsSaving(false);
        onItemAdded();
        onClose();
    };

    return (
        <>
            <Modal
                open
                onClose={onClose}
                title="Nyt punkt"
                footer={
                    <>
                        <Button variant="ghost" onClick={onClose}>Annuller</Button>
                        <Button onClick={handleSave} loading={isSaving} disabled={!photoUrl || !description.trim()}>
                            Gem punkt
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFileChange} className="hidden" aria-label="Vælg billede" tabIndex={-1} />
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            aria-label={photoUrl ? 'Udskift billede' : 'Tag billede eller vælg fil'}
                            className="w-full h-40 bg-bg-muted dark:bg-bg-dark-muted rounded-control flex flex-col items-center justify-center border-2 border-dashed border-border-strong dark:border-border-dark-strong text-label font-semibold text-text-secondary dark:text-text-dark-secondary relative overflow-hidden"
                        >
                            {photoUrl ? (
                                <ResolvedImage src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <>
                                    <CameraIcon className="w-10 h-10 mb-2"/>
                                    <span>Tag Billede / Vælg Fil</span>
                                </>
                            )}
                        </button>
                        {photoUrl && (
                            <button
                                type="button"
                                onClick={() => setIsAnnotating(true)}
                                aria-label="Tegn på billedet"
                                className="absolute bottom-2 right-2 w-11 h-11 flex items-center justify-center bg-bg dark:bg-bg-dark-surface rounded-full shadow-raised text-brand-primary"
                            >
                                <EditIcon className="w-5 h-5"/>
                            </button>
                        )}
                    </div>

                    <Textarea
                        label="Beskrivelse"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        rows={3}
                        placeholder="F.eks. 'Skramme i dørkarm' eller 'Mangler fuge her'."
                    />
                </div>
            </Modal>
            {isAnnotating && photoUrl && <AnnotationCanvas imageSrc={photoUrl} onSave={handleAnnotateSave} onCancel={() => setIsAnnotating(false)} />}
        </>
    );
};

const ViewPunchItemModal: React.FC<{
    item: PunchListItem;
    onClose: () => void;
    onItemUpdated: () => void;
    onItemDeleted: (id: string) => void;
    onImageClick: (src: string, alt: string) => void;
}> = ({ item, onClose, onItemUpdated, onItemDeleted, onImageClick }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedItem, setEditedItem] = useState(item);
    const [isSaving, setIsSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        setEditedItem(item);
    }, [item]);

    const handleUpdateField = (field: keyof PunchListItem, value: any) => {
        setEditedItem(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        await updatePunchListItem(item.projectId, editedItem);
        setIsSaving(false);
        onItemUpdated();
        onClose();
    };

    const handleDelete = () => {
        setShowDeleteConfirm(true);
    };

    return (
        <>
            <Modal
                open
                onClose={onClose}
                title={isEditing ? 'Rediger punkt' : 'Detaljer for punkt'}
                footer={
                    isEditing ? (
                        <div className="flex w-full items-center justify-between gap-2">
                            <Button variant="danger" iconLeft={<TrashIcon className="w-4 h-4"/>} onClick={handleDelete}>
                                Slet
                            </Button>
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" onClick={() => setIsEditing(false)}>Annuller</Button>
                                <Button onClick={handleSave} loading={isSaving}>Gem</Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={onClose}>Luk</Button>
                            <Button onClick={() => setIsEditing(true)}>Rediger</Button>
                        </>
                    )
                }
            >
                <div className="flex flex-col gap-4">
                    <button
                        type="button"
                        onClick={() => onImageClick(editedItem.photoUrl, editedItem.description)}
                        aria-label="Vis billede i fuld størrelse"
                        className="w-full aspect-video bg-bg-muted dark:bg-bg-dark-muted rounded-control overflow-hidden hover:opacity-90 transition-opacity"
                    >
                        <ResolvedImage src={editedItem.photoUrl} alt={editedItem.description} className="w-full h-full object-contain" />
                    </button>

                    {isEditing ? (
                        <>
                            <Textarea
                                label="Beskrivelse"
                                value={editedItem.description}
                                onChange={e => handleUpdateField('description', e.target.value)}
                                rows={3}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Select
                                    label="Status"
                                    value={editedItem.status}
                                    onChange={e => handleUpdateField('status', e.target.value as PunchListItemStatus)}
                                >
                                    <option value="Åben">Åben</option>
                                    <option value="I gang">I gang</option>
                                    <option value="Kræver Supervisor">Kræver Supervisor</option>
                                    <option value="Løst">Løst</option>
                                </Select>
                                <Input
                                    label="Frist for udbedring"
                                    type="date"
                                    value={editedItem.resolutionDueDate || ''}
                                    onChange={e => handleUpdateField('resolutionDueDate', e.target.value)}
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="text-body text-text-secondary dark:text-text-dark-secondary">{editedItem.description}</p>
                            <div className="divide-y divide-border dark:divide-border-dark border-t border-border dark:border-border-dark">
                                <div className="flex justify-between items-center py-2.5">
                                    <span className="text-label font-medium text-text-secondary dark:text-text-dark-secondary">Status</span>
                                    <Badge variant={STATUS_BADGE[editedItem.status]} dot>{editedItem.status}</Badge>
                                </div>
                                <div className="flex justify-between items-center py-2.5">
                                    <span className="text-label font-medium text-text-secondary dark:text-text-dark-secondary">Oprettet</span>
                                    <span className="text-label font-semibold text-text-primary dark:text-text-dark-primary">{editedItem.timestamp}</span>
                                </div>
                                {editedItem.resolutionDueDate && (
                                    <div className="flex justify-between items-center py-2.5">
                                        <span className="text-label font-medium text-text-secondary dark:text-text-dark-secondary">Frist</span>
                                        <span className="text-label font-semibold text-text-primary dark:text-text-dark-primary">{editedItem.resolutionDueDate}</span>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </Modal>
            <ConfirmDialog
                isOpen={showDeleteConfirm}
                title="Slet punkt"
                message="Er du sikker på, at du vil slette dette punkt? Det kan ikke fortrydes."
                confirmLabel="Slet"
                danger
                onConfirm={() => { onItemDeleted(item.id); setShowDeleteConfirm(false); }}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </>
    );
};

/** Photo-first punch card — image button opens the zoom viewer, footer action opens the detail modal. */
const PunchItemCard: React.FC<{
    item: PunchListItem;
    onOpen: () => void;
    onZoom: () => void;
}> = ({ item, onOpen, onZoom }) => (
    <Card padding="none" className="overflow-hidden flex flex-col">
        <button
            type="button"
            onClick={onZoom}
            aria-label={`Vis billede: ${item.description}`}
            className="relative block w-full aspect-video bg-bg-muted dark:bg-bg-dark-muted rounded-t-card overflow-hidden"
        >
            <ResolvedImage src={item.photoUrl} alt={item.description} className="w-full h-full object-cover" />
            <span className="absolute top-2 left-2">
                <Badge variant={STATUS_BADGE[item.status]} dot>{item.status}</Badge>
            </span>
        </button>
        <div className="p-3 flex flex-col gap-1 grow">
            <p className="text-label font-semibold text-text-primary dark:text-text-dark-primary line-clamp-2">{item.description}</p>
            <p className="text-caption text-text-secondary dark:text-text-dark-secondary">Oprettet {item.timestamp}</p>
            {item.resolutionDueDate && (
                <p className="text-caption text-text-secondary dark:text-text-dark-secondary">Frist: {item.resolutionDueDate}</p>
            )}
            <div className="mt-auto pt-2">
                <Button variant="outline" fullWidth iconLeft={<EditIcon className="w-4 h-4"/>} onClick={onOpen} aria-label={`Åbn punkt: ${item.description}`}>
                    Detaljer
                </Button>
            </div>
        </div>
    </Card>
);

const PunchListTabContent: React.FC<{ projectId: string }> = ({ projectId }) => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [layouts, setLayouts] = useState<PunchListLayout[]>([]);
    const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
    const [items, setItems] = useState<PunchListItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Modals and UI state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newPinLocation, setNewPinLocation] = useState<{x: number, y: number} | null>(null);
    const [viewingItem, setViewingItem] = useState<PunchListItem | null>(null);
    const [isAddingMode, setIsAddingMode] = useState(false);
    const [viewMode, setViewMode] = useState<'plan' | 'list'>('plan');
    const [zoomedImage, setZoomedImage] = useState<{src: string, alt: string} | null>(null);
    const [layoutToDelete, setLayoutToDelete] = useState<string | null>(null);

    // Layout metadata editing state
    const [currentTitle, setCurrentTitle] = useState('');
    const [currentRef, setCurrentRef] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const debounceTimeout = useRef<number | null>(null);

    const selectedLayout = useMemo(() => {
        return layouts.find(l => l.id === selectedLayoutId);
    }, [layouts, selectedLayoutId]);

    const filteredItems = useMemo(() => {
        return items.filter(item => item.layoutId === selectedLayoutId);
    }, [items, selectedLayoutId]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const [layoutData, punchListData] = await Promise.all([
            getLayoutsForProject(projectId),
            getPunchListForProject(projectId)
        ]);
        setLayouts(layoutData);
        setItems(punchListData);

        if (layoutData.length > 0) {
            if (!selectedLayoutId || !layoutData.some(l => l.id === selectedLayoutId)) {
                setSelectedLayoutId(layoutData[0].id);
            }
        } else {
            setSelectedLayoutId(null);
        }
        setLoading(false);
    }, [projectId, selectedLayoutId]);

    useEffect(() => {
        fetchData();
    }, [projectId]); // Initial fetch

    useEffect(() => {
        if (selectedLayout) {
            setCurrentTitle(selectedLayout.title);
            setCurrentRef(selectedLayout.reference || '');
        }
    }, [selectedLayout]);

    useEffect(() => {
        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
        debounceTimeout.current = window.setTimeout(() => {
            if (selectedLayout && (currentTitle !== selectedLayout.title || currentRef !== (selectedLayout.reference || ''))) {
                updateLayout(selectedLayout.id, { title: currentTitle, reference: currentRef });
            }
        }, 1000);

        return () => {
            if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
        };
    }, [currentTitle, currentRef, selectedLayout]);

    const handlePlanClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (!isAddingMode) return;
        const target = event.target as HTMLElement;
        if(target.closest('[data-punch-item-pin]')) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        setNewPinLocation({ x, y });
        setIsAddModalOpen(true);
        setIsAddingMode(false);
    };

    const handleItemClick = (item: PunchListItem, event: React.MouseEvent) => {
        event.stopPropagation();
        if (isAddingMode) {
            setIsAddingMode(false);
            return;
        }
        setViewingItem(item);
    };

    const handleLayoutUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const processed = await processFileForStorage(file);
            const newLayoutData = {
                title: file.name.replace(/\.[^/.]+$/, ""),
                reference: '',
                fileUrl: processed.dataUrl
            };
            const newLayout = await createLayout(projectId, newLayoutData);
            setLayouts(prev => [...prev, newLayout]);
            setSelectedLayoutId(newLayout.id);
        }
    };

    const handleScanRoom = () => {
        navigate(`/tools/geometri/ar-opmåling?projectId=${projectId}&target=punchlist`);
    };

    const handleDeleteLayout = (layoutId: string, event: React.MouseEvent) => {
        event.stopPropagation();
        setLayoutToDelete(layoutId);
    };

    const confirmDeleteLayout = async () => {
        if (!layoutToDelete) return;
        await deleteLayout(layoutToDelete);
        setLayoutToDelete(null);
        await fetchData();
    };

    const handleDeleteItem = async (itemId: string) => {
        await deletePunchListItem(itemId);
        setViewingItem(null);
        await fetchData();
    };

    const generateReport = async () => {
        if (!selectedLayout) return;

        const doc = new jsPDF();

        // Title
        doc.setFontSize(18);
        doc.text(`Kvalitetssikringsrapport: ${selectedLayout.title}`, 14, 20);
        doc.setFontSize(10);
        doc.text(`Genereret: ${new Date().toLocaleDateString('da-DK')}`, 14, 28);

        // Add Image of plan — jsPDF needs a data URL, so bucket-stored plans
        // (Phase 7 W3) are pulled down first; legacy base64 passes through.
        const resolvedPlanUrl = selectedLayout.fileUrl.startsWith('data:')
            ? selectedLayout.fileUrl
            : await resolveStoragePathToDataUrl(selectedLayout.fileUrl);
        if (!resolvedPlanUrl) {
            showToast('Kunne ikke hente tegningen til rapporten. Prøv igen.', 'error');
            return;
        }
        const planImg = new Image();
        planImg.src = resolvedPlanUrl;

        // Wait for plan image to load if needed (simplified here)
        // ... (In a real app, better async handling for image loading)

        // Assuming synchronous flow or pre-loaded for simplicity in snippet
        const imgProps = doc.getImageProperties(resolvedPlanUrl);
        const pdfWidth = doc.internal.pageSize.getWidth() - 28;
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        const type = getImageType(resolvedPlanUrl);
        doc.addImage(resolvedPlanUrl, type, 14, 35, pdfWidth, pdfHeight);

        let yPos = 35 + pdfHeight + 10;

        // Add Items
        doc.setFontSize(12);
        doc.text("Punkter", 14, yPos);
        yPos += 10;
        doc.setFontSize(10);

        // Process items sequentially to handle async image loading
        for (let index = 0; index < filteredItems.length; index++) {
            const item = filteredItems[index];
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }
            doc.setDrawColor(200);
            doc.line(14, yPos - 5, 196, yPos - 5);

            doc.text(`${index + 1}. ${item.status}`, 14, yPos);
            doc.text(item.description, 60, yPos);
            yPos += 10;

            // Add photo thumbnail (data URL required — see plan image above)
            if (item.photoUrl) {
                const resolvedPhoto = item.photoUrl.startsWith('data:')
                    ? item.photoUrl
                    : await resolveStoragePathToDataUrl(item.photoUrl);
                if (resolvedPhoto) {
                    const ratio = 1;
                    const h = 20;
                    const w = 20 * ratio;
                    const itemType = getImageType(resolvedPhoto);
                    try {
                         doc.addImage(resolvedPhoto, itemType, 170, yPos - 15, w, h);
                    } catch(e) {
                        console.warn("Could not add image to PDF", e);
                    }
                }
            }
        }

        doc.save("PunchList_Rapport.pdf");
    };

    const StatusPin: React.FC<{ item: PunchListItem, onClick: (e: React.MouseEvent) => void }> = ({ item, onClick }) => (
        <button
            type="button"
            data-punch-item-pin
            className="absolute w-11 h-11 flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${item.pin.x}%`, top: `${item.pin.y}%` }}
            title={`${item.status}: ${item.description}`}
            aria-label={`${item.status}: ${item.description}`}
            onClick={onClick}
        >
            <MapPinIcon className={cn('w-8 h-8 fill-white drop-shadow-lg cursor-pointer transition-transform hover:scale-125', PIN_COLOR[item.status])} />
        </button>
    );

    if (loading) {
        return (
            <div className="p-4">
                <SkeletonList count={3} label="Indlæser punch list…" />
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4 pb-32 relative min-h-[calc(100vh-200px)]" data-ref-id="tab-content-punch-list">

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                <div>
                    <h2 className="text-heading text-text-primary dark:text-text-dark-primary">Punch List</h2>
                    <p className="text-label text-text-secondary dark:text-text-dark-secondary">Administrer plantegninger og punkter</p>
                </div>

                <div className="flex items-center justify-end gap-2 flex-wrap flex-grow sm:flex-nowrap">
                    <input type="file" accept="image/*,application/pdf" ref={fileInputRef} onChange={handleLayoutUpload} className="hidden" aria-label="Upload plantegning" tabIndex={-1} />
                    <Button variant="secondary" iconLeft={<UploadIcon className="w-4 h-4" />} onClick={() => fileInputRef.current?.click()}>
                        Upload Ny
                    </Button>
                    <Button variant="outline" iconLeft={<MaximizeIcon className="w-4 h-4" />} onClick={handleScanRoom}>
                        Scan Rum
                    </Button>
                    <Button
                        variant="secondary"
                        iconLeft={<DownloadIcon className="w-4 h-4" />}
                        onClick={generateReport}
                        disabled={!selectedLayout || filteredItems.length === 0}
                    >
                        Rapport
                    </Button>
                    <div className="flex-grow sm:flex-grow-0 sm:w-48">
                        <Select
                            aria-label="Vælg plantegning"
                            value={selectedLayoutId || ''}
                            onChange={(e) => setSelectedLayoutId(e.target.value)}
                            disabled={layouts.length === 0}
                        >
                            {layouts.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                            {layouts.length === 0 && <option>Upload en plan først</option>}
                        </Select>
                    </div>

                    {selectedLayout && viewMode === 'plan' && (
                        <div className="flex-grow sm:flex-grow-0 sm:w-40">
                            <Input
                                id="layout-title"
                                aria-label="Plantegningens titel"
                                type="text"
                                placeholder="Titel"
                                value={currentTitle}
                                onChange={e => setCurrentTitle(e.target.value)}
                            />
                        </div>
                    )}

                    <SegmentedControl
                        label="Visning"
                        value={viewMode}
                        onChange={(v) => setViewMode(v as 'plan' | 'list')}
                        fullWidth={false}
                        options={[
                            { label: 'Plan', value: 'plan' },
                            { label: 'Liste', value: 'list' },
                        ]}
                    />
                </div>
            </div>

            {viewMode === 'plan' && (
                !selectedLayout ? (
                    <EmptyState
                        icon={<MapPinIcon className="w-8 h-8" />}
                        title="Ingen plantegning valgt"
                        description="Upload en plantegning eller scan rummet for at komme i gang."
                        action={
                            <Button iconLeft={<UploadIcon className="w-4 h-4" />} onClick={() => fileInputRef.current?.click()}>
                                Upload plantegning
                            </Button>
                        }
                    />
                ) : (
                    <div className="space-y-4">
                        <p className={cn(
                            'text-center text-label transition-colors',
                            isAddingMode
                                ? 'text-brand-primary font-semibold animate-pulse'
                                : 'text-text-secondary dark:text-text-dark-secondary'
                        )}>
                            {isAddingMode ? 'Tryk på plantegningen for at placere et nyt punkt.' : 'Tryk på + for at tilføje et nyt punkt.'}
                        </p>
                        <div
                            className={cn(
                                'relative bg-bg-muted dark:bg-bg-dark-muted border border-border dark:border-border-dark rounded-card overflow-hidden',
                                isAddingMode && 'cursor-crosshair'
                            )}
                            onClick={handlePlanClick}
                        >
                            <ResolvedImage src={selectedLayout.fileUrl} alt={selectedLayout.title} className="w-full" />
                            {filteredItems.map(item => <StatusPin key={item.id} item={item} onClick={(e) => handleItemClick(item, e)} />)}
                        </div>

                        {filteredItems.length > 0 ? (
                            <section>
                                <h3 className="text-label font-semibold text-text-secondary dark:text-text-dark-secondary mb-2">
                                    Punkter ({filteredItems.length})
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {filteredItems.map(item => (
                                        <PunchItemCard
                                            key={item.id}
                                            item={item}
                                            onOpen={() => setViewingItem(item)}
                                            onZoom={() => setZoomedImage({ src: item.photoUrl, alt: item.description })}
                                        />
                                    ))}
                                </div>
                            </section>
                        ) : (
                            <EmptyState
                                icon={<CameraIcon className="w-8 h-8" />}
                                title="Ingen punch-punkter endnu"
                                description="Tag det første punch-foto for at dokumentere kvaliteten."
                                action={
                                    <Button size="sm" iconLeft={<CameraIcon className="w-4 h-4" />} onClick={() => setIsAddingMode(true)}>
                                        Nyt punch-punkt
                                    </Button>
                                }
                            />
                        )}
                    </div>
                )
            )}

            {viewMode === 'list' && (
                 <div className="space-y-3">
                    {layouts.map(layout => (
                        <Card key={layout.id} padding="none" className="flex items-center overflow-hidden">
                            <button
                                type="button"
                                onClick={() => { setSelectedLayoutId(layout.id); setViewMode('plan'); }}
                                aria-label={`Åbn plantegning: ${layout.title}`}
                                className="flex items-center gap-3 p-3 grow min-w-0 text-left hover:bg-bg-muted dark:hover:bg-bg-dark-muted transition-colors"
                            >
                                <div className="w-20 h-20 flex-shrink-0 bg-bg-muted dark:bg-bg-dark-muted rounded-control overflow-hidden">
                                    <ResolvedImage src={layout.fileUrl} alt={layout.title} className="w-full h-full object-cover" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-label font-semibold text-text-primary dark:text-text-dark-primary truncate">{layout.title}</p>
                                    <p className="text-caption text-text-secondary dark:text-text-dark-secondary">Ref: {layout.reference || 'N/A'}</p>
                                    <p className="text-caption text-text-secondary dark:text-text-dark-secondary">{items.filter(i => i.layoutId === layout.id).length} punkter</p>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={(e) => handleDeleteLayout(layout.id, e)}
                                aria-label={`Slet plantegning: ${layout.title}`}
                                className="w-11 h-11 mr-2 flex-shrink-0 flex items-center justify-center text-danger hover:bg-danger-subtle dark:hover:bg-danger-subtle-dark rounded-full transition-colors"
                            >
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        </Card>
                    ))}
                    {layouts.length === 0 && (
                        <EmptyState
                            icon={<UploadIcon className="w-8 h-8" />}
                            title="Ingen plantegninger uploadet"
                            description="Upload en plantegning for at oprette punch-punkter."
                            action={
                                <Button size="sm" iconLeft={<UploadIcon className="w-4 h-4" />} onClick={() => fileInputRef.current?.click()}>
                                    Upload Ny
                                </Button>
                            }
                        />
                    )}
                </div>
            )}

            <FAB
                aria-label={isAddingMode ? 'Annuller placering af punkt' : 'Nyt punch-punkt'}
                icon={isAddingMode ? <XIcon className="w-6 h-6" /> : <PlusIcon className="w-6 h-6" />}
                onClick={() => {
                    if (selectedLayout) setIsAddingMode(prev => !prev);
                    else showToast("Upload og vælg en plantegning først.", 'warning');
                }}
                disabled={!selectedLayoutId}
                className={cn(
                    'disabled:opacity-60 disabled:cursor-not-allowed',
                    isAddingMode && '!bg-danger hover:!bg-danger/90'
                )}
            />

            {isAddModalOpen && newPinLocation && selectedLayoutId && (
                <AddPunchItemModal
                    projectId={projectId}
                    layoutId={selectedLayoutId}
                    pin={newPinLocation}
                    onClose={() => setIsAddModalOpen(false)}
                    onItemAdded={() => {
                        fetchData();
                        setIsAddModalOpen(false);
                    }}
                />
            )}

            {viewingItem && (
                <ViewPunchItemModal
                    item={viewingItem}
                    onClose={() => setViewingItem(null)}
                    onItemUpdated={fetchData}
                    onItemDeleted={handleDeleteItem}
                    onImageClick={(src, alt) => setZoomedImage({src, alt})}
                />
            )}

            {zoomedImage && (
                <ImageViewModal src={zoomedImage.src} alt={zoomedImage.alt} onClose={() => setZoomedImage(null)} />
            )}
            <ConfirmDialog
                isOpen={layoutToDelete !== null}
                title="Slet plantegning"
                message="Er du sikker på, at du vil slette denne plantegning og alle tilknyttede punkter? Det kan ikke fortrydes."
                confirmLabel="Slet"
                danger
                onConfirm={confirmDeleteLayout}
                onCancel={() => setLayoutToDelete(null)}
            />
        </div>
    );
};

export default PunchListTabContent;
