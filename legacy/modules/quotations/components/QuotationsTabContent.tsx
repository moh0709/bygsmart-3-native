import React, { useState, useEffect, useCallback } from 'react';
import {
    Project, Task, PurchaseItem, Reminder, UserRole,
    Quotation, QuotationLineItem, QuotationStatus, QuotationLineKind,
} from '../../../types';
import {
    getQuotationsForProject, getQuotationById,
    createQuotation, updateQuotation, updateQuotationStatus, deleteQuotation,
    addLineItem, updateLineItem, deleteLineItem, addLineItemFromPurchase,
} from '../services/quotations';
import { getTasksForProject } from '../../tasks';
import { getRemindersForProject } from '../../planning';
import { getTimeEntriesForProject } from '../../time';
import { getPurchaseInfoForProject } from '../../purchasing';
import { getProjectBudgetSummary } from '../../budget';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthProvider';
import {
    PlusIcon, DownloadIcon, TrashIcon, CheckIcon, FileTextIcon,
    ChevronRightIcon, XIcon, ShoppingCartIcon, ClipboardListIcon, ArrowLeftIcon,
} from '../../../components/icons';
import {
    Alert, Badge, Button, Card, ConfirmDialog, EmptyState, Input,
    Modal, Select, SkeletonList, Textarea,
} from '../../../components/ui';
import type { BadgeVariant } from '../../../components/ui';
import { QuotationPdfTemplate, ProjectReportTemplate, ProjectReportData } from '../../reporting';
import { ModuleGate, useModuleGate } from '../../../core/entitlements/ModuleGate';

/* ─────────── helpers ─────────── */

const STATUS_META: Record<QuotationStatus, { label: string; variant: BadgeVariant }> = {
    DRAFT:    { label: 'Kladde',     variant: 'neutral' },
    SENT:     { label: 'Sendt',      variant: 'info' },
    ACCEPTED: { label: 'Accepteret', variant: 'success' },
    REJECTED: { label: 'Afvist',     variant: 'danger' },
};

const KIND_META: Record<QuotationLineKind, string> = {
    MATERIAL: 'Materiale',
    LABOR: 'Arbejde',
    OTHER: 'Andet',
};

const fmtDKK = (n: number, currency = 'DKK') =>
    `${n.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

const nextStatus: Partial<Record<QuotationStatus, QuotationStatus>> = {
    DRAFT: 'SENT',
    SENT: 'ACCEPTED',
};

/* ─────────── sub-components ─────────── */

const StatusBadge: React.FC<{ status: QuotationStatus }> = ({ status }) => {
    const { label, variant } = STATUS_META[status];
    return <Badge variant={variant} dot className="shrink-0">{label}</Badge>;
};

/* ─────────── line item form ─────────── */
interface LineItemFormState {
    kind: QuotationLineKind;
    description: string;
    quantity: string;
    unit: string;
    unitPrice: string;
}

const EMPTY_LINE: LineItemFormState = { kind: 'MATERIAL', description: '', quantity: '1', unit: 'stk', unitPrice: '0' };

const LineItemFormModal: React.FC<{
    initial?: Partial<LineItemFormState>;
    onSave: (data: LineItemFormState) => Promise<void>;
    onClose: () => void;
    title: string;
}> = ({ initial, onSave, onClose, title }) => {
    const [form, setForm] = useState<LineItemFormState>({ ...EMPTY_LINE, ...initial });
    const [saving, setSaving] = useState(false);

    const preview = (parseFloat(form.quantity) || 0) * (parseFloat(form.unitPrice) || 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.description.trim()) return;
        setSaving(true);
        await onSave(form);
        setSaving(false);
        onClose();
    };

    return (
        <Modal
            open
            title={title}
            onClose={onClose}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>Annuller</Button>
                    <Button type="submit" form="line-item-form" loading={saving}>Gem linje</Button>
                </>
            }
        >
            <form id="line-item-form" onSubmit={handleSubmit} className="space-y-4">
                <Select
                    label="Type"
                    value={form.kind}
                    onChange={e => setForm(p => ({ ...p, kind: e.target.value as QuotationLineKind }))}
                >
                    {(Object.keys(KIND_META) as QuotationLineKind[]).map(k => (
                        <option key={k} value={k}>{KIND_META[k]}</option>
                    ))}
                </Select>
                <Input
                    label="Beskrivelse"
                    required
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="f.eks. Armeringsjern Ø12mm"
                />
                <div className="grid grid-cols-2 gap-3">
                    <Input
                        label="Antal"
                        type="number" min="0" step="0.01"
                        value={form.quantity}
                        onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
                    />
                    <Input
                        label="Enhed"
                        value={form.unit}
                        onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
                        placeholder="stk, m², m, t…"
                    />
                </div>
                <Input
                    label="Enhedspris (DKK)"
                    type="number" min="0" step="0.01"
                    value={form.unitPrice}
                    onChange={e => setForm(p => ({ ...p, unitPrice: e.target.value }))}
                />
                <div className="rounded-control bg-brand-subtle dark:bg-brand-subtle-dark px-4 py-2.5 flex justify-between items-center">
                    <span className="text-label text-text-secondary dark:text-text-dark-secondary">Linjetotal:</span>
                    <span className="text-label font-bold tabular-nums text-brand-primary dark:text-brand-light">{fmtDKK(preview)}</span>
                </div>
            </form>
        </Modal>
    );
};

/* ─────────── quotation form ─────────── */
interface QuotationFormState {
    title: string;
    clientName: string;
    currency: string;
    vatRate: string;
    validUntil: string;
    notes: string;
}

const QuotationFormModal: React.FC<{
    initial: QuotationFormState;
    onSave: (data: QuotationFormState) => Promise<void>;
    onClose: () => void;
    isNew: boolean;
}> = ({ initial, onSave, onClose, isNew }) => {
    const [form, setForm] = useState<QuotationFormState>(initial);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await onSave(form);
        setSaving(false);
        onClose();
    };

    return (
        <Modal
            open
            title={isNew ? 'Nyt tilbud' : 'Rediger tilbudsoplysninger'}
            onClose={onClose}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>Annuller</Button>
                    <Button type="submit" form="quot-form" loading={saving}>
                        {isNew ? 'Opret tilbud' : 'Gem ændringer'}
                    </Button>
                </>
            }
        >
            <form id="quot-form" onSubmit={handleSubmit} className="space-y-4">
                <Input
                    label="Titel"
                    required
                    value={form.title}
                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="f.eks. Tilbud på betonarbejde"
                />
                <Input
                    label="Kundenavn"
                    value={form.clientName}
                    onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-3">
                    <Select
                        label="Valuta"
                        value={form.currency}
                        onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}
                    >
                        <option value="DKK">DKK</option>
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                    </Select>
                    <Input
                        label="Momssats (%)"
                        type="number" min="0" max="100" step="0.5"
                        value={form.vatRate}
                        onChange={e => setForm(p => ({ ...p, vatRate: e.target.value }))}
                    />
                </div>
                <Input
                    label="Gyldig til"
                    type="date"
                    value={form.validUntil}
                    onChange={e => setForm(p => ({ ...p, validUntil: e.target.value }))}
                />
                <Textarea
                    label="Bemærkninger"
                    rows={3}
                    value={form.notes}
                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Evt. noter til kunden…"
                    className="resize-none"
                />
            </form>
        </Modal>
    );
};

/* ─────────── purchase picker ─────────── */
const PurchasePickerModal: React.FC<{
    purchases: PurchaseItem[];
    onPick: (purchase: PurchaseItem) => Promise<void>;
    onClose: () => void;
}> = ({ purchases, onPick, onClose }) => {
    const [adding, setAdding] = useState<string | null>(null);

    return (
        <Modal
            open
            title="Tilføj fra indkøb"
            onClose={onClose}
            footer={<Button variant="ghost" onClick={onClose}>Luk</Button>}
        >
            {purchases.length === 0 ? (
                <EmptyState
                    icon={<ShoppingCartIcon className="w-8 h-8" />}
                    title="Ingen indkøb på dette projekt"
                    description="Opret indkøb under Økonomi → Indkøb for at kunne tilføje dem her."
                />
            ) : (
                <ul className="space-y-2">
                    {purchases.map(p => (
                        <li key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-card border border-border bg-bg-subtle dark:border-border-dark dark:bg-bg-dark-muted/40">
                            <div className="min-w-0 flex-1">
                                <p className="text-label font-semibold text-text-primary dark:text-text-dark-primary truncate">{p.name}</p>
                                <p className="text-caption text-text-secondary dark:text-text-dark-secondary tabular-nums">{p.quantity} stk × {fmtDKK(p.price)} = {fmtDKK(p.price * p.quantity)}</p>
                            </div>
                            <Button
                                size="sm"
                                loading={adding === p.id}
                                onClick={async () => {
                                    setAdding(p.id);
                                    await onPick(p);
                                    setAdding(null);
                                }}
                            >
                                Tilføj
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </Modal>
    );
};

/* ─────────── quotation detail view ─────────── */
const QuotationDetailView: React.FC<{
    quotationId: string;
    project: Project;
    userRole: UserRole;
    onBack: () => void;
    onRefreshList: () => void;
}> = ({ quotationId, project, userRole, onBack, onRefreshList }) => {
    const { showToast } = useToast();
    const [quotation, setQuotation] = useState<Quotation | null>(null);
    const [loading, setLoading] = useState(true);
    const [purchases, setPurchases] = useState<PurchaseItem[]>([]);

    const canEdit = userRole === 'OWNER' || userRole === 'MANAGER';

    const [showLineModal, setShowLineModal] = useState(false);
    const [editingLine, setEditingLine] = useState<QuotationLineItem | null>(null);
    const [showPurchasePicker, setShowPurchasePicker] = useState(false);
    const [showQuotFormModal, setShowQuotFormModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showPdfPreview, setShowPdfPreview] = useState(false);

    const fetchQuotation = useCallback(async () => {
        setLoading(true);
        const q = await getQuotationById(quotationId);
        setQuotation(q ?? null);
        setLoading(false);
    }, [quotationId]);

    useEffect(() => {
        fetchQuotation();
        getPurchaseInfoForProject(project.id).then(info => setPurchases(info.items));
    }, [fetchQuotation, project.id]);

    const handleStatusAdvance = async () => {
        if (!quotation || !canEdit) return;
        const next = nextStatus[quotation.status];
        if (!next) return;
        try {
            await updateQuotationStatus(quotation.id, next);
            await fetchQuotation();
            onRefreshList();
            showToast(`Tilbud markeret som "${STATUS_META[next].label}"`, 'success');
        } catch {
            showToast('Kunne ikke opdatere status', 'error');
        }
    };

    const handleStatusReject = async () => {
        if (!quotation || !canEdit) return;
        try {
            await updateQuotationStatus(quotation.id, 'REJECTED');
            await fetchQuotation();
            onRefreshList();
            showToast('Tilbud markeret som afvist', 'success');
        } catch {
            showToast('Kunne ikke opdatere status', 'error');
        }
    };

    const handleSaveLineItem = async (form: LineItemFormState) => {
        if (!quotation) return;
        try {
            if (editingLine) {
                await updateLineItem({
                    ...editingLine,
                    kind: form.kind,
                    description: form.description,
                    quantity: parseFloat(form.quantity) || 1,
                    unit: form.unit || undefined,
                    unitPrice: parseFloat(form.unitPrice) || 0,
                    lineTotal: (parseFloat(form.quantity) || 1) * (parseFloat(form.unitPrice) || 0),
                });
                showToast('Linje opdateret', 'success');
            } else {
                await addLineItem(quotation.id, {
                    kind: form.kind,
                    description: form.description,
                    quantity: parseFloat(form.quantity) || 1,
                    unit: form.unit || undefined,
                    unitPrice: parseFloat(form.unitPrice) || 0,
                });
                showToast('Linje tilføjet', 'success');
            }
            await fetchQuotation();
        } catch {
            showToast('Kunne ikke gemme linje', 'error');
        }
    };

    const handleDeleteLine = async (item: QuotationLineItem) => {
        if (!quotation) return;
        try {
            await deleteLineItem(item.id, quotation.id);
            await fetchQuotation();
            showToast('Linje slettet', 'success');
        } catch {
            showToast('Kunne ikke slette linje', 'error');
        }
    };

    const handleAddFromPurchase = async (purchase: PurchaseItem) => {
        if (!quotation) return;
        try {
            await addLineItemFromPurchase(quotation.id, purchase);
            await fetchQuotation();
            showToast(`Indkøbslinje "${purchase.name}" tilføjet`, 'success');
        } catch {
            showToast('Kunne ikke tilføje indkøbslinje', 'error');
        }
    };

    const handleSaveQuotationInfo = async (form: { title: string; clientName: string; currency: string; vatRate: string; validUntil: string; notes: string }) => {
        if (!quotation) return;
        try {
            await updateQuotation(quotation.id, {
                title: form.title,
                clientName: form.clientName,
                currency: form.currency,
                vatRate: parseFloat(form.vatRate) || 25,
                validUntil: form.validUntil || undefined,
                notes: form.notes || undefined,
            });
            await fetchQuotation();
            onRefreshList();
            showToast('Tilbud opdateret', 'success');
        } catch {
            showToast('Kunne ikke opdatere tilbud', 'error');
        }
    };

    const handleDelete = async () => {
        if (!quotation) return;
        try {
            await deleteQuotation(quotation.id);
            onRefreshList();
            onBack();
            showToast('Tilbud slettet', 'success');
        } catch {
            showToast('Kunne ikke slette tilbud', 'error');
        }
    };

    const handleDownloadPdf = async () => {
        if (!quotation) return;
        try {
            const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
                import('html2canvas-pro'),
                import('jspdf'),
            ]);
            const element = document.getElementById('quotation-pdf-container');
            if (!element) return;
            const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgProps = pdf.getImageProperties(imgData);
            const ratio = imgProps.width / imgProps.height;
            const heightInPdf = pdfWidth / ratio;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, heightInPdf);
            let remaining = heightInPdf - pdfHeight;
            while (remaining > 0) {
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, -(heightInPdf - remaining), pdfWidth, heightInPdf);
                remaining -= pdfHeight;
            }
            pdf.save(`Tilbud_${quotation.number}.pdf`);
            setShowPdfPreview(false);
            showToast('PDF downloadet', 'success');
        } catch {
            showToast('Kunne ikke generere PDF', 'error');
        }
    };

    if (loading) return <div className="p-4"><SkeletonList count={3} label="Indlæser tilbud…" /></div>;
    if (!quotation) return <div className="p-4"><Alert variant="danger" title="Tilbud ikke fundet">Tilbuddet findes ikke længere eller kunne ikke hentes.</Alert></div>;

    const lineItems = quotation.lineItems ?? [];

    return (
        <div className="p-4 space-y-4 pb-8">
            {/* Back + title */}
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onBack}
                    aria-label="Tilbage til tilbudslisten"
                    className="inline-flex w-11 h-11 items-center justify-center rounded-full text-text-primary hover:bg-bg-muted dark:text-text-dark-primary dark:hover:bg-bg-dark-muted transition-colors duration-150 shrink-0"
                >
                    <ArrowLeftIcon className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-caption font-mono text-text-secondary dark:text-text-dark-secondary">{quotation.number}</span>
                        <StatusBadge status={quotation.status} />
                    </div>
                    <h2 className="text-heading text-text-primary dark:text-text-dark-primary truncate">{quotation.title}</h2>
                </div>
                {canEdit && (
                    <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        aria-label="Slet tilbud"
                        className="inline-flex w-11 h-11 items-center justify-center rounded-full text-danger-strong hover:bg-danger-subtle dark:text-danger dark:hover:bg-danger-subtle-dark transition-colors duration-150 shrink-0"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Info card */}
            <Card padding="md" className="space-y-2">
                <div className="flex justify-between items-center">
                    <span className="text-caption font-bold text-text-secondary dark:text-text-dark-secondary uppercase tracking-wide">Oplysninger</span>
                    {canEdit && (
                        <Button size="sm" variant="ghost" className="text-brand-primary hover:text-brand-primary dark:text-brand-light dark:hover:text-brand-light" onClick={() => setShowQuotFormModal(true)}>
                            Rediger
                        </Button>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-caption text-text-secondary dark:text-text-dark-secondary block">Kunde</span><span className="text-label font-medium text-text-primary dark:text-text-dark-primary">{quotation.clientName || '—'}</span></div>
                    <div><span className="text-caption text-text-secondary dark:text-text-dark-secondary block">Valuta</span><span className="text-label font-medium text-text-primary dark:text-text-dark-primary">{quotation.currency}</span></div>
                    <div><span className="text-caption text-text-secondary dark:text-text-dark-secondary block">Momssats</span><span className="text-label font-medium text-text-primary dark:text-text-dark-primary tabular-nums">{quotation.vatRate}%</span></div>
                    <div><span className="text-caption text-text-secondary dark:text-text-dark-secondary block">Gyldig til</span><span className="text-label font-medium text-text-primary dark:text-text-dark-primary">{quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString('da-DK') : '—'}</span></div>
                </div>
                {quotation.notes && (
                    <p className="text-caption text-text-secondary dark:text-text-dark-secondary italic border-l-2 border-brand-primary/40 pl-2 mt-1">{quotation.notes}</p>
                )}
            </Card>

            {/* Line items */}
            <Card padding="none" className="overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border dark:border-border-dark">
                    <span className="text-label font-semibold text-text-primary dark:text-text-dark-primary">Tilbudslinjer ({lineItems.length})</span>
                    {canEdit && (
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="secondary"
                                iconLeft={<ShoppingCartIcon className="w-3.5 h-3.5" />}
                                onClick={() => setShowPurchasePicker(true)}
                            >
                                Fra indkøb
                            </Button>
                            <Button
                                size="sm"
                                iconLeft={<PlusIcon className="w-3.5 h-3.5" />}
                                onClick={() => { setEditingLine(null); setShowLineModal(true); }}
                            >
                                Tilføj linje
                            </Button>
                        </div>
                    )}
                </div>

                {lineItems.length === 0 ? (
                    <EmptyState
                        icon={<FileTextIcon className="w-8 h-8" />}
                        title="Ingen linjer endnu"
                        description={canEdit ? 'Klik "Tilføj linje" for at komme i gang.' : undefined}
                    />
                ) : (
                    <ul className="divide-y divide-border dark:divide-border-dark">
                        {lineItems.map(item => (
                            <li key={item.id} className="px-4 py-3 flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge>{KIND_META[item.kind]}</Badge>
                                        <span className="text-label font-medium text-text-primary dark:text-text-dark-primary truncate">{item.description}</span>
                                    </div>
                                    <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-0.5 tabular-nums">
                                        {item.quantity} {item.unit ?? ''} × {fmtDKK(item.unitPrice, quotation.currency)}
                                    </p>
                                </div>
                                <div className="shrink-0 text-right">
                                    <p className="text-label font-semibold tabular-nums text-text-primary dark:text-text-dark-primary">{fmtDKK(item.lineTotal, quotation.currency)}</p>
                                    {canEdit && (
                                        <div className="flex gap-1 mt-1 justify-end">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-brand-primary hover:text-brand-primary dark:text-brand-light dark:hover:text-brand-light"
                                                onClick={() => { setEditingLine(item); setShowLineModal(true); }}
                                            >
                                                Ret
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-danger-strong hover:bg-danger-subtle hover:text-danger-strong dark:text-danger dark:hover:bg-danger-subtle-dark dark:hover:text-danger"
                                                onClick={() => handleDeleteLine(item)}
                                            >
                                                Slet
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                {/* Totals */}
                <div className="border-t border-border dark:border-border-dark px-4 py-3 space-y-1 bg-bg-subtle dark:bg-bg-dark-muted/40">
                    <div className="flex justify-between text-label">
                        <span className="text-text-secondary dark:text-text-dark-secondary">Subtotal</span>
                        <span className="font-semibold tabular-nums text-text-primary dark:text-text-dark-primary">{fmtDKK(quotation.subtotal, quotation.currency)}</span>
                    </div>
                    <div className="flex justify-between text-label">
                        <span className="text-text-secondary dark:text-text-dark-secondary">Moms ({quotation.vatRate}%)</span>
                        <span className="font-semibold tabular-nums text-text-primary dark:text-text-dark-primary">{fmtDKK(quotation.vatTotal, quotation.currency)}</span>
                    </div>
                    <div className="flex justify-between text-body pt-1 border-t border-border dark:border-border-dark">
                        <span className="font-bold text-text-primary dark:text-text-dark-primary">Total inkl. moms</span>
                        <span className="font-bold tabular-nums text-brand-primary dark:text-brand-light">{fmtDKK(quotation.total, quotation.currency)}</span>
                    </div>
                </div>
            </Card>

            {/* Status workflow */}
            {canEdit && (
                <Card padding="md">
                    <p className="text-caption font-bold text-text-secondary dark:text-text-dark-secondary uppercase tracking-wide mb-3">Statusworkflow</p>
                    <div className="flex gap-2 flex-wrap">
                        {nextStatus[quotation.status] && (
                            <Button iconLeft={<CheckIcon className="w-4 h-4" />} onClick={handleStatusAdvance}>
                                Marker som {STATUS_META[nextStatus[quotation.status]!].label}
                            </Button>
                        )}
                        {(quotation.status === 'SENT' || quotation.status === 'DRAFT') && (
                            <Button
                                variant="outline"
                                className="border-danger-border text-danger-strong hover:bg-danger-subtle hover:text-danger-strong dark:border-danger/30 dark:text-danger dark:hover:bg-danger-subtle-dark dark:hover:text-danger"
                                iconLeft={<XIcon className="w-4 h-4" />}
                                onClick={handleStatusReject}
                            >
                                Afvis tilbud
                            </Button>
                        )}
                        {(quotation.status === 'ACCEPTED' || quotation.status === 'REJECTED') && (
                            <p className="text-label text-text-secondary dark:text-text-dark-secondary italic">Tilbuddet er afsluttet.</p>
                        )}
                    </div>
                </Card>
            )}

            {/* Export */}
            <Button
                variant="outline"
                fullWidth
                className="border-brand-primary text-brand-primary hover:bg-brand-subtle hover:text-brand-primary dark:border-brand-light dark:text-brand-light dark:hover:bg-brand-subtle-dark dark:hover:text-brand-light"
                iconLeft={<DownloadIcon className="w-5 h-5" />}
                onClick={() => setShowPdfPreview(true)}
            >
                Eksporter til PDF
            </Button>

            {/* Modals */}
            {showLineModal && (
                <LineItemFormModal
                    title={editingLine ? 'Ret linje' : 'Tilføj linje'}
                    initial={editingLine ? {
                        kind: editingLine.kind,
                        description: editingLine.description,
                        quantity: String(editingLine.quantity),
                        unit: editingLine.unit ?? '',
                        unitPrice: String(editingLine.unitPrice),
                    } : undefined}
                    onSave={handleSaveLineItem}
                    onClose={() => { setShowLineModal(false); setEditingLine(null); }}
                />
            )}

            {showPurchasePicker && (
                <PurchasePickerModal
                    purchases={purchases}
                    onPick={handleAddFromPurchase}
                    onClose={() => setShowPurchasePicker(false)}
                />
            )}

            {showQuotFormModal && (
                <QuotationFormModal
                    isNew={false}
                    initial={{
                        title: quotation.title,
                        clientName: quotation.clientName,
                        currency: quotation.currency,
                        vatRate: String(quotation.vatRate),
                        validUntil: quotation.validUntil ?? '',
                        notes: quotation.notes ?? '',
                    }}
                    onSave={handleSaveQuotationInfo}
                    onClose={() => setShowQuotFormModal(false)}
                />
            )}

            <ConfirmDialog
                isOpen={showDeleteConfirm}
                title="Slet tilbud?"
                message={`Er du sikker på, at du vil slette tilbuddet "${quotation.title}"? Handlingen kan ikke fortrydes.`}
                confirmLabel="Slet"
                danger
                onConfirm={() => { setShowDeleteConfirm(false); handleDelete(); }}
                onCancel={() => setShowDeleteConfirm(false)}
            />

            {showPdfPreview && (
                <Modal
                    open
                    title={`PDF: ${quotation.title}`}
                    onClose={() => setShowPdfPreview(false)}
                    size="full"
                    footer={
                        <>
                            <Button variant="ghost" onClick={() => setShowPdfPreview(false)}>Luk</Button>
                            <Button iconLeft={<DownloadIcon className="w-4 h-4" />} onClick={handleDownloadPdf}>
                                Download PDF
                            </Button>
                        </>
                    }
                >
                    <div className="flex justify-center bg-bg-muted dark:bg-bg-dark-muted min-h-full py-8 -mx-5 px-5">
                        <QuotationPdfTemplate quotation={quotation} lineItems={lineItems} project={project} />
                    </div>
                </Modal>
            )}
        </div>
    );
};

/* ─────────── project report section ─────────── */
const ProjectReportSection: React.FC<{ project: Project; projectId: string }> = ({ project, projectId }) => {
    const { showToast } = useToast();
    const [generating, setGenerating] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [reportData, setReportData] = useState<ProjectReportData | null>(null);

    // Report generation itself is gated on `reporting` by the caller (it owns
    // the PDF template). Within it, each data section degrades gracefully to
    // an empty result when the org isn't entitled to that specific module.
    const tasksEnabled = useModuleGate('tasks');
    const planningEnabled = useModuleGate('planning');
    const timeEnabled = useModuleGate('time');
    const purchasingEnabled = useModuleGate('purchasing');
    const budgetEnabled = useModuleGate('budget');

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const [tasksRes, purchasesRes, remindersRes, timeRes, budgetSummary] = await Promise.all([
                tasksEnabled ? getTasksForProject(projectId) : Promise.resolve([]),
                purchasingEnabled ? getPurchaseInfoForProject(projectId) : Promise.resolve({ total: 0, items: [] }),
                planningEnabled ? getRemindersForProject(projectId) : Promise.resolve([]),
                timeEnabled ? getTimeEntriesForProject(projectId) : Promise.resolve([]),
                budgetEnabled ? getProjectBudgetSummary(projectId) : Promise.resolve(null),
            ]);
            const totalHours = timeRes.reduce((s, e) => s + e.hours, 0);
            setReportData({ project, tasks: tasksRes, purchases: purchasesRes.items, reminders: remindersRes, totalHours, budgetSummary });
            setShowPreview(true);
        } catch {
            showToast('Kunne ikke generere rapport', 'error');
        } finally {
            setGenerating(false);
        }
    };

    const handleDownloadPdf = async () => {
        if (!reportData) return;
        try {
            const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
                import('html2canvas-pro'),
                import('jspdf'),
            ]);
            const element = document.getElementById('project-report-container');
            if (!element) return;
            const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgProps = pdf.getImageProperties(imgData);
            const ratio = imgProps.width / imgProps.height;
            const heightInPdf = pdfWidth / ratio;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, heightInPdf);
            let remaining = heightInPdf - pdfHeight;
            while (remaining > 0) {
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, -(heightInPdf - remaining), pdfWidth, heightInPdf);
                remaining -= pdfHeight;
            }
            pdf.save(`Projektrapport_${project.projectNumber}.pdf`);
            setShowPreview(false);
            showToast('Projektrapport downloadet', 'success');
        } catch {
            showToast('Kunne ikke generere PDF', 'error');
        }
    };

    return (
        <Card padding="md">
            <div className="flex items-start gap-3">
                <span className="flex w-10 h-10 items-center justify-center rounded-control bg-brand-subtle text-brand-primary dark:bg-brand-subtle-dark dark:text-brand-light shrink-0" aria-hidden="true">
                    <ClipboardListIcon className="w-5 h-5" />
                </span>
                <div className="flex-1">
                    <p className="text-label font-semibold text-text-primary dark:text-text-dark-primary">Projektrapport</p>
                    <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-0.5">
                        Generer en samlet rapport med opgaver, indkøb, tid og teamoversigt.
                    </p>
                </div>
            </div>
            <Button
                fullWidth
                className="mt-4"
                loading={generating}
                iconLeft={<FileTextIcon className="w-4 h-4" />}
                onClick={handleGenerate}
            >
                {generating ? 'Genererer…' : 'Generer projektrapport'}
            </Button>

            {showPreview && reportData && (
                <Modal
                    open
                    title="Projektrapport"
                    onClose={() => setShowPreview(false)}
                    size="full"
                    footer={
                        <>
                            <Button variant="ghost" onClick={() => setShowPreview(false)}>Luk</Button>
                            <Button iconLeft={<DownloadIcon className="w-4 h-4" />} onClick={handleDownloadPdf}>
                                Download PDF
                            </Button>
                        </>
                    }
                >
                    <div className="flex justify-center bg-bg-muted dark:bg-bg-dark-muted min-h-full py-8 -mx-5 px-5">
                        <ProjectReportTemplate data={reportData} />
                    </div>
                </Modal>
            )}
        </Card>
    );
};

/* ─────────── main component ─────────── */
export const QuotationsTabContent: React.FC<{
    project: Project;
    projectId: string;
    userRole: UserRole;
}> = ({ project, projectId, userRole }) => {
    const { showToast } = useToast();
    const { user } = useAuth();
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showNewModal, setShowNewModal] = useState(false);
    const [creating, setCreating] = useState(false);

    const canEdit = userRole === 'OWNER' || userRole === 'MANAGER';

    const fetchList = useCallback(async () => {
        setLoading(true);
        const list = await getQuotationsForProject(projectId);
        setQuotations(list);
        setLoading(false);
    }, [projectId]);

    useEffect(() => { fetchList(); }, [fetchList]);

    const handleCreate = async (form: { title: string; clientName: string; currency: string; vatRate: string; validUntil: string; notes: string }) => {
        setCreating(true);
        try {
            const q = await createQuotation(projectId, {
                title: form.title,
                clientName: form.clientName || project.clientName,
                currency: form.currency,
                vatRate: parseFloat(form.vatRate) || 25,
                validUntil: form.validUntil || undefined,
                notes: form.notes || undefined,
                createdBy: user?.name ?? project.ownerId,
            });
            await fetchList();
            setSelectedId(q.id);
            showToast('Tilbud oprettet', 'success');
        } catch {
            showToast('Kunne ikke oprette tilbud', 'error');
        } finally {
            setCreating(false);
        }
    };

    if (selectedId) {
        return (
            <QuotationDetailView
                quotationId={selectedId}
                project={project}
                userRole={userRole}
                onBack={() => setSelectedId(null)}
                onRefreshList={fetchList}
            />
        );
    }

    return (
        <div className="p-4 space-y-4 pb-8">
            {/* Section header: Tilbud */}
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-heading text-text-primary dark:text-text-dark-primary">Tilbud</h2>
                {canEdit && (
                    <Button size="sm" iconLeft={<PlusIcon className="w-4 h-4" />} onClick={() => setShowNewModal(true)}>
                        Nyt tilbud
                    </Button>
                )}
            </div>

            {/* Quotation list */}
            {loading ? (
                <SkeletonList count={3} label="Indlæser tilbud…" />
            ) : quotations.length === 0 ? (
                <Card padding="none">
                    <EmptyState
                        icon={<FileTextIcon className="w-8 h-8" />}
                        title="Ingen tilbud endnu"
                        description="Opret et nyt tilbud for at komme i gang."
                        action={canEdit ? (
                            <Button size="sm" iconLeft={<PlusIcon className="w-4 h-4" />} onClick={() => setShowNewModal(true)}>
                                Nyt tilbud
                            </Button>
                        ) : undefined}
                    />
                </Card>
            ) : (
                <ul className="space-y-3">
                    {quotations.map(q => (
                        <li key={q.id}>
                            <button
                                type="button"
                                onClick={() => setSelectedId(q.id)}
                                className="w-full text-left rounded-card border border-border bg-bg shadow-card p-4 flex items-center gap-3 transition-all duration-150 hover:shadow-card-hover hover:border-border-strong active:bg-bg-subtle dark:border-border-dark dark:bg-bg-dark-surface dark:hover:border-border-dark-strong dark:active:bg-bg-dark-muted/50"
                            >
                                <span className="flex w-10 h-10 items-center justify-center rounded-control bg-brand-subtle text-brand-primary dark:bg-brand-subtle-dark dark:text-brand-light shrink-0" aria-hidden="true">
                                    <FileTextIcon className="w-5 h-5" />
                                </span>
                                <span className="flex-1 min-w-0">
                                    <span className="flex items-center gap-2 flex-wrap mb-1">
                                        <span className="text-caption font-mono text-text-secondary dark:text-text-dark-secondary">{q.number}</span>
                                        <StatusBadge status={q.status} />
                                    </span>
                                    <span className="block text-label font-semibold text-text-primary dark:text-text-dark-primary truncate">{q.title}</span>
                                    {q.clientName && <span className="block text-caption text-text-secondary dark:text-text-dark-secondary truncate">{q.clientName}</span>}
                                </span>
                                <span className="shrink-0 text-right">
                                    <span className="block text-label font-semibold tabular-nums text-text-primary dark:text-text-dark-primary">{fmtDKK(q.total, q.currency)}</span>
                                    <span className="block text-caption text-text-secondary dark:text-text-dark-secondary">inkl. moms</span>
                                </span>
                                <ChevronRightIcon className="w-4 h-4 text-text-tertiary dark:text-text-dark-tertiary shrink-0" aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {/* Divider */}
            <hr className="border-border dark:border-border-dark" />

            {/* Project report section — requires `reporting` (owns the PDF/Excel template) */}
            <h2 className="text-heading text-text-primary dark:text-text-dark-primary">Projektrapport</h2>
            <ModuleGate moduleId="reporting" mode="upsell">
                <ProjectReportSection project={project} projectId={projectId} />
            </ModuleGate>

            {/* New quotation modal */}
            {showNewModal && (
                <QuotationFormModal
                    isNew
                    initial={{
                        title: '',
                        clientName: project.clientName,
                        currency: 'DKK',
                        vatRate: '25',
                        validUntil: '',
                        notes: '',
                    }}
                    onSave={handleCreate}
                    onClose={() => setShowNewModal(false)}
                />
            )}
        </div>
    );
};
