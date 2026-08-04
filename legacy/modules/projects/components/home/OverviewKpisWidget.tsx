import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Project, Task, PurchaseItem } from '../../../../types';
import { getProjects } from '../../services/projects';
import { getActiveWorkforce } from '../../services/projectResources';
import { useAuth } from '../../../../contexts/AuthProvider';
import { useModuleEnabled } from '../../../../core/entitlements/EntitlementsProvider';
import { Skeleton, StatCard } from '../../../../components/ui';
import { SectionHeader } from '../../../../components/dashboard/SectionHeader';
import { StatDetailsModal, StatDetailsItem } from '../../../../components/dashboard/StatDetailsModal';
import { fmtKr } from '../../../../components/dashboard/homeHelpers';
import {
    FolderIcon, CheckSquareIcon, AlertTriangleIcon, ShoppingCartIcon, UsersIcon, UserIcon, TrendingUpIcon,
} from '../../../../components/icons';

/**
 * "Mit overblik" — the management KPI grid (formerly HomePage section 4).
 * projects owns the aggregate view; the tasks/purchasing figures arrive via
 * dynamic import (projects is the base module — reverse edges stay dynamic)
 * and their tiles hide entirely when those modules are disabled.
 */
export const OverviewKpisWidget: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const tasksEnabled = useModuleEnabled('tasks');
    const purchasingEnabled = useModuleEnabled('purchasing');

    const [isLoading, setIsLoading] = useState(true);
    const [activeProjectsList, setActiveProjectsList] = useState<Project[]>([]);
    const [tasksTodayList, setTasksTodayList] = useState<Task[]>([]);
    const [overdueTasksList, setOverdueTasksList] = useState<Task[]>([]);
    const [pendingPurchasesList, setPendingPurchasesList] = useState<(PurchaseItem & { projectName: string; projectId: string })[]>([]);
    const [activeWorkforceList, setActiveWorkforceList] = useState<{ userId: string; userName: string; projectName: string; projectId: string }[]>([]);
    const [budgetProjectsList, setBudgetProjectsList] = useState<Project[]>([]);
    const [totalBudgetKr, setTotalBudgetKr] = useState(0);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalItems, setModalItems] = useState<StatDetailsItem[]>([]);

    useEffect(() => {
        if (!user) return;
        let alive = true;
        (async () => {
            setIsLoading(true);
            try {
                const [projects, workforce, allTasks, pendingPurchases] = await Promise.all([
                    getProjects(user.id),
                    getActiveWorkforce(user.id),
                    tasksEnabled
                        ? import('../../../tasks').then((m) => m.getAllTasksForActiveProjects(user.id))
                        : Promise.resolve([] as Task[]),
                    purchasingEnabled
                        ? import('../../../purchasing').then((m) => m.getAllPendingPurchases(user.id))
                        : Promise.resolve([]),
                ]);
                if (!alive) return;

                const active = projects.filter(p => p.status === 'I gang');
                setActiveProjectsList(active);
                setActiveWorkforceList(workforce);
                setPendingPurchasesList(pendingPurchases as (PurchaseItem & { projectName: string; projectId: string })[]);

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                setOverdueTasksList(allTasks.filter(t => new Date(t.dueDate) < today && t.status !== 'Udført'));
                setTasksTodayList(allTasks.filter(t => {
                    const dueDate = new Date(t.dueDate);
                    dueDate.setHours(0, 0, 0, 0);
                    return dueDate.getTime() === today.getTime() && t.status !== 'Udført';
                }));

                // Portfolio budget rollup — reuses project.budget.total already
                // returned by getProjects() (server-side gated per project via
                // can_view_project_budget), so no extra per-project calls.
                const projectsWithBudget = active.filter(p => (p.budget?.total ?? 0) > 0);
                setBudgetProjectsList(projectsWithBudget);
                setTotalBudgetKr(projectsWithBudget.reduce((sum, p) => sum + (p.budget?.total ?? 0), 0));
            } catch (e) {
                console.error('OverviewKpisWidget fetch failed:', e);
            } finally {
                if (alive) setIsLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [user, tasksEnabled, purchasingEnabled]);

    const openModal = (title: string, items: StatDetailsItem[]) => {
        setModalTitle(title);
        setModalItems(items);
        setIsModalOpen(true);
    };

    return (
        <>
            <SectionHeader title="Mit overblik" />
            {isLoading ? (
                <div className="grid grid-cols-2 gap-2.5" aria-hidden="true">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-[76px] rounded-card" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-2.5">
                    <StatCard
                        value={activeProjectsList.length}
                        label="Aktive projekter"
                        tone="brand"
                        icon={<FolderIcon className="w-5 h-5" />}
                        onClick={() => openModal('Aktive Projekter', activeProjectsList.map(p => ({
                            id: p.id,
                            title: p.name,
                            subtitle: `Kunde: ${p.clientName}`,
                            link: `/project-detail/${p.id}`,
                            icon: FolderIcon,
                            chip: { label: `${p.progress}%`, color: 'blue' },
                        })))}
                    />
                    {tasksEnabled && (
                        <StatCard
                            value={tasksTodayList.length}
                            label="Opgaver i dag"
                            tone="success"
                            icon={<CheckSquareIcon className="w-5 h-5" />}
                            onClick={() => openModal('Opgaver i Dag', tasksTodayList.map(t => ({
                                id: t.id,
                                title: t.title,
                                subtitle: t.projectName || 'Ukendt projekt',
                                link: `/task/${t.id}`,
                                icon: CheckSquareIcon,
                            })))}
                        />
                    )}
                    {tasksEnabled && (
                        <StatCard
                            value={overdueTasksList.length}
                            label="Overskredne"
                            tone={overdueTasksList.length > 0 ? 'danger' : 'default'}
                            icon={<AlertTriangleIcon className="w-5 h-5" />}
                            onClick={() => openModal('Overskredne Deadlines', overdueTasksList.map(t => ({
                                id: t.id,
                                title: t.title,
                                subtitle: `${t.projectName} (Forfaldt: ${new Date(t.dueDate).toLocaleDateString('da-DK')})`,
                                link: `/task/${t.id}`,
                                icon: AlertTriangleIcon,
                                chip: { label: 'Forfalden', color: 'red' },
                            })))}
                        />
                    )}
                    {purchasingEnabled && (
                        <StatCard
                            value={pendingPurchasesList.length}
                            label="Afventer indkøb"
                            tone={pendingPurchasesList.length > 0 ? 'warning' : 'default'}
                            icon={<ShoppingCartIcon className="w-5 h-5" />}
                            onClick={() => openModal('Afventer Indkøb', pendingPurchasesList.map(p => ({
                                id: p.id,
                                title: p.name,
                                subtitle: p.projectName || 'Projekt',
                                link: `/project-detail/${p.projectId}?tab=indkob`,
                                icon: ShoppingCartIcon,
                                chip: { label: p.quantity + ' stk', color: 'yellow' },
                            })))}
                        />
                    )}
                    <StatCard
                        value={activeWorkforceList.length}
                        label="Aktivt mandskab"
                        tone="info"
                        icon={<UsersIcon className="w-5 h-5" />}
                        onClick={() => openModal('Aktivt Mandskab', activeWorkforceList.map((w, idx) => ({
                            id: w.userId + idx,
                            title: w.userName,
                            subtitle: `Senest aktiv på: ${w.projectName}`,
                            link: `/project-detail/${w.projectId}`,
                            icon: UserIcon,
                        })))}
                    />
                    <StatCard
                        value={fmtKr(totalBudgetKr)}
                        label="Budget i alt"
                        tone="brand"
                        icon={<TrendingUpIcon className="w-5 h-5" />}
                        onClick={() => openModal('Budget — aktive projekter', budgetProjectsList.map(p => ({
                            id: p.id,
                            title: p.name,
                            subtitle: `Kunde: ${p.clientName}`,
                            link: `/project-detail/${p.id}?tab=budget`,
                            icon: FolderIcon,
                            chip: { label: fmtKr(p.budget?.total ?? 0), color: 'blue' },
                        })))}
                    />
                </div>
            )}
            <StatDetailsModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={modalTitle}
                items={modalItems}
            />
        </>
    );
};
