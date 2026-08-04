
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Project, Task, PurchaseItem, PurchaseStatus } from '../../../types';
import { getPurchaseInfoForProject, createPurchaseItemForProject, updatePurchaseItem, deletePurchaseItem } from '../services/purchases';
import { PlusIcon, ClockIcon, ShoppingCartIcon, CheckCircleFilledIcon, CalendarIcon, UserIcon, LinkIcon, FileTextIcon } from '../../../components/icons';
import { PurchaseFormModal } from './PurchaseFormModal';
import { Alert, Badge, Button, Card, Chip, EmptyState, ListRow, Modal, SkeletonList, StatCard } from '../../../components/ui';
import type { BadgeVariant } from '../../../components/ui';

/** Status → semantic Badge variant (afventer→warning, bestilt→info, modtaget/leveret→success). */
const STATUS_BADGE: Record<PurchaseStatus, BadgeVariant> = {
    Afventer: 'warning',
    Bestilt: 'info',
    Modtaget: 'success',
};

const fmtKr = (n: number) =>
    `${n.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kr.`;
const fmtKr2 = (n: number) =>
    `${n.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr.`;

const InfoRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex justify-between items-center gap-3 py-2.5">
        <span className="text-label text-text-secondary dark:text-text-dark-secondary">{label}</span>
        <span className="text-label font-semibold text-text-primary dark:text-text-dark-primary text-right">{children}</span>
    </div>
);

const ViewPurchaseModal: React.FC<{ item: PurchaseItem; project: Project; tasks: Task[]; onClose: () => void; onEdit: () => void }> = ({ item, project, tasks, onClose, onEdit }) => (
    <Modal
        open
        title={item.name}
        onClose={onClose}
        data-ref-id={`purchase-view-modal-${item.id}`}
        footer={
            <>
                <Button variant="ghost" onClick={onClose}>Luk</Button>
                <Button onClick={onEdit}>Rediger</Button>
            </>
        }
    >
        <div className="space-y-4">
            {item.details && <p className="text-body text-text-secondary dark:text-text-dark-secondary whitespace-pre-line">{item.details}</p>}
            <div className="divide-y divide-border dark:divide-border-dark border-t border-border dark:border-border-dark">
                {item.supplier && <InfoRow label="Leverandør">{item.supplier}</InfoRow>}
                {item.itemNumber && <InfoRow label="Varenummer">{item.itemNumber}</InfoRow>}
                <InfoRow label="Status"><Badge variant={STATUS_BADGE[item.status]} dot>{item.status}</Badge></InfoRow>
                <InfoRow label="Pris"><span className="tabular-nums">{fmtKr2(item.price)} / stk</span></InfoRow>
                <InfoRow label="Antal"><span className="tabular-nums">{item.quantity}</span></InfoRow>
            </div>

            {(item.taskId || item.assigneeId || item.expectedDeliveryDate) && (
                <div className="rounded-card border border-border bg-bg-subtle p-3 space-y-2 dark:border-border-dark dark:bg-bg-dark-muted/40">
                    {item.expectedDeliveryDate && (
                        <div className="flex items-center gap-2 text-label text-text-primary dark:text-text-dark-primary">
                            <CalendarIcon className="w-4 h-4 text-text-tertiary dark:text-text-dark-tertiary shrink-0"/>
                            <span className="font-medium">{new Date(item.expectedDeliveryDate).toLocaleDateString('da-DK')}</span>
                        </div>
                    )}
                    {item.assigneeId && (
                        <div className="flex items-center gap-2 text-label text-text-primary dark:text-text-dark-primary">
                            <UserIcon className="w-4 h-4 text-text-tertiary dark:text-text-dark-tertiary shrink-0"/>
                            <span>{project.team.find(t => t.id === item.assigneeId)?.name || 'Ukendt'}</span>
                        </div>
                    )}
                    {item.taskId && (
                        <div className="flex items-center gap-2 text-label text-text-primary dark:text-text-dark-primary">
                            <LinkIcon className="w-4 h-4 text-text-tertiary dark:text-text-dark-tertiary shrink-0"/>
                            <span className="truncate">{tasks.find(t => t.id === item.taskId)?.title || 'Opgave ikke fundet'}</span>
                        </div>
                    )}
                </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t border-border dark:border-border-dark">
                <span className="text-label text-text-secondary dark:text-text-dark-secondary">Total</span>
                <span className="text-heading text-text-primary dark:text-text-dark-primary tabular-nums">{fmtKr2(item.price * item.quantity)}</span>
            </div>

            {item.attachment && (
                <div>
                    <h4 className="text-label font-semibold text-text-primary dark:text-text-dark-primary mb-2">Vedhæftning</h4>
                    <div className="w-full max-h-80 bg-bg-muted dark:bg-bg-dark-muted rounded-card flex items-center justify-center border border-border dark:border-border-dark overflow-hidden">
                        {item.attachment.type === 'image'
                            ? <img src={item.attachment.url} alt={item.attachment.name} className="max-w-full max-h-80 object-contain rounded-card" />
                            : item.attachment.type === 'pdf'
                                ? <iframe src={item.attachment.url} className="w-full h-80" title={item.attachment.name}></iframe>
                                : (
                                    <div className="p-8 text-center text-text-secondary dark:text-text-dark-secondary">
                                        <FileTextIcon className="w-16 h-16 mx-auto" />
                                        <span className="text-caption mt-2 block truncate">{item.attachment.name}</span>
                                    </div>
                                )}
                    </div>
                </div>
            )}
        </div>
    </Modal>
);

type StatusFilter = PurchaseStatus | 'ALLE';

export const PurchasingTabContent: React.FC<{ projectId: string; project: Project; tasks: Task[] }> = ({ projectId, project, tasks }) => {
    const [purchaseInfo, setPurchaseInfo] = useState<{ total: number; items: PurchaseItem[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALLE');
    const [modalState, setModalState] = useState<{ type: 'add' | 'view' | 'edit' | null; item?: PurchaseItem }>({ type: null });

    const fetchPurchase = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getPurchaseInfoForProject(projectId);
            setPurchaseInfo(data);
        } catch {
            setError('Indkøbene kunne ikke hentes. Tjek din forbindelse og prøv igen.');
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        fetchPurchase();
    }, [fetchPurchase]);

    const handleSavePurchase = async (payload: Omit<PurchaseItem, 'id'>, id?: string) => {
        if (id) {
            await updatePurchaseItem(projectId, { ...payload, id });
        } else {
            await createPurchaseItemForProject(projectId, payload);
        }
        await fetchPurchase();
    };

    const handleDeletePurchase = async (id: string) => {
        await deletePurchaseItem(projectId, id);
        setModalState({ type: null });
        await fetchPurchase();
    };

    // Calculate Summary Stats
    const stats = useMemo(() => {
        const items = purchaseInfo?.items || [];
        const calculateGroup = (status: PurchaseStatus) => {
            const groupItems = items.filter(i => i.status === status);
            const count = groupItems.length;
            const total = groupItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
            return { count, total };
        };
        return {
            afventer: calculateGroup('Afventer'),
            bestilt: calculateGroup('Bestilt'),
            modtaget: calculateGroup('Modtaget')
        };
    }, [purchaseInfo]);

    const items = purchaseInfo?.items ?? [];
    const filteredItems = useMemo(
        () => statusFilter === 'ALLE' ? items : items.filter(i => i.status === statusFilter),
        [items, statusFilter]
    );

    const rowSubtitle = (item: PurchaseItem) => {
        const parts = [`${item.quantity} stk`];
        if (item.supplier) parts.push(item.supplier);
        if (item.expectedDeliveryDate) {
            parts.push(new Date(item.expectedDeliveryDate).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }));
        }
        return parts.join(' · ');
    };

    return (
            <div className="p-4 space-y-4 pb-24 relative min-h-[calc(100vh-200px)]" data-ref-id="tab-content-indkob">
                {/* Header + primary action */}
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-heading text-text-primary dark:text-text-dark-primary">Indkøb</h2>
                    <Button size="sm" iconLeft={<PlusIcon className="w-4 h-4" />} onClick={() => setModalState({ type: 'add' })}>
                        Nyt indkøb
                    </Button>
                </div>

                {/* Summary — KPI tiles (count + total kr) */}
                <div className="grid grid-cols-3 gap-2.5">
                    <StatCard
                        value={stats.afventer.count}
                        label={`Afventer · ${fmtKr(stats.afventer.total)}`}
                        tone="warning"
                        icon={<ClockIcon className="w-5 h-5" />}
                        loading={loading}
                    />
                    <StatCard
                        value={stats.bestilt.count}
                        label={`Bestilt · ${fmtKr(stats.bestilt.total)}`}
                        tone="info"
                        icon={<ShoppingCartIcon className="w-5 h-5" />}
                        loading={loading}
                    />
                    <StatCard
                        value={stats.modtaget.count}
                        label={`Modtaget · ${fmtKr(stats.modtaget.total)}`}
                        tone="success"
                        icon={<CheckCircleFilledIcon className="w-5 h-5" />}
                        loading={loading}
                    />
                </div>

                {/* Status filter chips */}
                <div role="group" aria-label="Filtrer indkøb efter status" className="flex items-center gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1">
                    <Chip selected={statusFilter === 'ALLE'} count={items.length} onClick={() => setStatusFilter('ALLE')}>Alle</Chip>
                    <Chip selected={statusFilter === 'Afventer'} count={stats.afventer.count} onClick={() => setStatusFilter('Afventer')}>Afventer</Chip>
                    <Chip selected={statusFilter === 'Bestilt'} count={stats.bestilt.count} onClick={() => setStatusFilter('Bestilt')}>Bestilt</Chip>
                    <Chip selected={statusFilter === 'Modtaget'} count={stats.modtaget.count} onClick={() => setStatusFilter('Modtaget')}>Modtaget</Chip>
                </div>

                {error && (
                    <Alert
                        variant="danger"
                        title="Kunne ikke hente indkøb"
                        action={<Button size="sm" variant="outline" onClick={fetchPurchase}>Prøv igen</Button>}
                    >
                        {error}
                    </Alert>
                )}

                {loading ? (
                    <SkeletonList count={3} label="Indlæser indkøb…" />
                ) : !error && items.length === 0 ? (
                    <Card padding="none">
                        <EmptyState
                            icon={<ShoppingCartIcon className="w-8 h-8" />}
                            title="Ingen indkøb endnu"
                            description="Tilføj det første indkøb for at holde styr på materialer og leverancer."
                            action={
                                <Button size="sm" iconLeft={<PlusIcon className="w-4 h-4" />} onClick={() => setModalState({ type: 'add' })}>
                                    Nyt indkøb
                                </Button>
                            }
                        />
                    </Card>
                ) : !error && filteredItems.length === 0 ? (
                    <Card padding="none">
                        <EmptyState
                            icon={<ShoppingCartIcon className="w-8 h-8" />}
                            title="Ingen indkøb matcher filteret"
                            description="Prøv at vælge en anden status ovenfor."
                        />
                    </Card>
                ) : !error && (
                    <Card padding="none" className="divide-y divide-border dark:divide-border-dark overflow-hidden">
                        {filteredItems.map(item => (
                            <ListRow
                                key={item.id}
                                title={item.name}
                                subtitle={rowSubtitle(item)}
                                trailing={
                                    <>
                                        <span className="text-label font-semibold tabular-nums text-text-primary dark:text-text-dark-primary">
                                            {fmtKr(item.price * item.quantity)}
                                        </span>
                                        <Badge variant={STATUS_BADGE[item.status]} dot>{item.status}</Badge>
                                    </>
                                }
                                onClick={() => setModalState({ type: 'view', item })}
                            />
                        ))}
                    </Card>
                )}

                {(modalState.type === 'add' || modalState.type === 'edit') && (
                    <PurchaseFormModal
                        item={modalState.item}
                        tasks={tasks}
                        team={project.team}
                        onClose={() => setModalState({ type: null })}
                        onSave={handleSavePurchase}
                        onDelete={modalState.type === 'edit' ? handleDeletePurchase : undefined}
                    />
                )}
                {modalState.type === 'view' && modalState.item && (
                    <ViewPurchaseModal
                        item={modalState.item}
                        project={project}
                        tasks={tasks}
                        onClose={() => setModalState({ type: null })}
                        onEdit={() => setModalState({ type: 'edit', item: modalState.item })}
                    />
                )}
            </div>
    );
}
