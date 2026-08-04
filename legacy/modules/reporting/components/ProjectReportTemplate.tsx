import React from 'react';
import { Project, Task, PurchaseItem, Reminder, ProjectBudgetSummary } from '../../../types';
import { BuildingIcon } from '../../../components/icons';

export interface ProjectReportData {
    project: Project;
    tasks: Task[];
    purchases: PurchaseItem[];
    reminders: Reminder[];
    totalHours: number;
    budgetSummary?: ProjectBudgetSummary | null;
}

const fmtDKK = (n: number) =>
    `${n.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kr.`;

export const ProjectReportTemplate: React.FC<{ data: ProjectReportData }> = ({ data }) => {
    const { project, tasks, purchases, reminders, totalHours, budgetSummary } = data;

    const taskStats = {
        total: tasks.length,
        done: tasks.filter(t => t.status === 'Udført').length,
        inProgress: tasks.filter(t => t.status === 'Igangværende').length,
        overdue: tasks.filter(t => t.status === 'Forfalden').length,
        todo: tasks.filter(t => t.status === 'To Do').length,
    };

    const purchaseStats = {
        total: purchases.length,
        totalValue: purchases.reduce((s, p) => s + p.price * p.quantity, 0),
        received: purchases.filter(p => p.status === 'Modtaget').length,
        ordered: purchases.filter(p => p.status === 'Bestilt').length,
        pending: purchases.filter(p => p.status === 'Afventer').length,
    };

    const reminderStats = {
        total: reminders.length,
        completed: reminders.filter(r => r.isCompleted).length,
        open: reminders.filter(r => !r.isCompleted).length,
    };

    const progressPct = taskStats.total > 0
        ? Math.round((taskStats.done / taskStats.total) * 100)
        : project.progress;

    return (
        <div id="project-report-container" className="bg-white text-black p-12 max-w-[210mm] mx-auto shadow-lg min-h-[297mm] flex flex-col font-sans text-sm">
            {/* Header */}
            <div className="flex justify-between items-center border-b-4 border-brand-primary pb-6 mb-8">
                <div className="flex items-center space-x-3">
                    <div className="bg-brand-primary p-3 rounded-lg">
                        <BuildingIcon className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">PROJEKTRAPPORT</h1>
                        <p className="text-xs text-gray-500 uppercase tracking-widest mt-0.5">BYG SMART Construction</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="font-bold text-base">{project.name}</p>
                    <p className="text-xs text-gray-500">Rapport genereret: {new Date().toLocaleDateString('da-DK')}</p>
                    <p className="text-xs text-gray-500">Projektnummer: {project.projectNumber}</p>
                </div>
            </div>

            {/* Project info grid */}
            <div className="grid grid-cols-2 gap-x-12 gap-y-3 mb-8 text-xs">
                {[
                    ['Bygherre', project.clientName],
                    ['Status', project.status],
                    ['Adresse', project.address],
                    ['Fremdrift', `${progressPct}%`],
                    ['Startdato', project.startDate ? new Date(project.startDate).toLocaleDateString('da-DK') : '—'],
                    ['Slutdato', project.endDate ? new Date(project.endDate).toLocaleDateString('da-DK') : '—'],
                ].map(([label, value]) => (
                    <div key={label} className="border-b border-gray-100 pb-2">
                        <span className="text-gray-500 uppercase font-bold block mb-0.5">{label}</span>
                        <span className="text-gray-900 font-medium">{value}</span>
                    </div>
                ))}
            </div>

            {/* Progress bar */}
            <div className="mb-8">
                <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500 font-semibold uppercase">Samlet fremdrift</span>
                    <span className="font-bold text-brand-primary">{progressPct}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-brand-primary rounded-full"
                        style={{ width: `${Math.min(100, progressPct)}%` }}
                    />
                </div>
            </div>

            {/* Sections */}
            <div className="space-y-8 flex-grow">
                {/* Tasks */}
                <section>
                    <h2 className="text-base font-bold text-brand-primary mb-3 uppercase tracking-wide border-b border-gray-200 pb-1">
                        Opgaveoversigt
                    </h2>
                    <div className="grid grid-cols-4 gap-3 mb-4">
                        {[
                            { label: 'Total', value: taskStats.total, color: 'bg-gray-100 text-gray-800' },
                            { label: 'Udført', value: taskStats.done, color: 'bg-green-50 text-green-800' },
                            { label: 'I gang', value: taskStats.inProgress, color: 'bg-blue-50 text-blue-800' },
                            { label: 'Forfalden', value: taskStats.overdue, color: 'bg-red-50 text-red-800' },
                        ].map(({ label, value, color }) => (
                            <div key={label} className={`p-3 rounded-lg border text-center ${color}`}>
                                <div className="text-2xl font-bold leading-none">{value}</div>
                                <div className="text-xs mt-1 font-semibold">{label}</div>
                            </div>
                        ))}
                    </div>
                    {tasks.filter(t => t.status !== 'Udført').length > 0 && (
                        <div className="overflow-hidden rounded-lg border border-gray-200">
                            <table className="w-full text-xs">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="py-2 px-3 text-left text-gray-500 font-bold uppercase tracking-wide">Opgave</th>
                                        <th className="py-2 px-3 text-left text-gray-500 font-bold uppercase tracking-wide">Status</th>
                                        <th className="py-2 px-3 text-left text-gray-500 font-bold uppercase tracking-wide">Frist</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {tasks
                                        .filter(t => t.status !== 'Udført')
                                        .slice(0, 15)
                                        .map(t => (
                                            <tr key={t.id}>
                                                <td className="py-2 px-3 font-medium text-gray-900">{t.title}</td>
                                                <td className="py-2 px-3 text-gray-600">{t.status}</td>
                                                <td className="py-2 px-3 text-gray-600">
                                                    {t.dueDate ? new Date(t.dueDate).toLocaleDateString('da-DK') : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {/* Purchases */}
                <section>
                    <h2 className="text-base font-bold text-brand-primary mb-3 uppercase tracking-wide border-b border-gray-200 pb-1">
                        Indkøbsoversigt
                    </h2>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                        {[
                            { label: 'Afventer', value: purchaseStats.pending, color: 'bg-yellow-50 text-yellow-800' },
                            { label: 'Bestilt', value: purchaseStats.ordered, color: 'bg-blue-50 text-blue-800' },
                            { label: 'Modtaget', value: purchaseStats.received, color: 'bg-green-50 text-green-800' },
                        ].map(({ label, value, color }) => (
                            <div key={label} className={`p-3 rounded-lg border text-center ${color}`}>
                                <div className="text-2xl font-bold leading-none">{value}</div>
                                <div className="text-xs mt-1 font-semibold">{label}</div>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between py-2 border-t border-gray-100 text-xs">
                        <span className="text-gray-600 font-semibold">Samlet indkøbsværdi</span>
                        <span className="font-bold text-gray-900">{fmtDKK(purchaseStats.totalValue)}</span>
                    </div>
                    {budgetSummary?.hasBaseline ? (
                        <>
                            <div className="flex justify-between py-2 border-t border-gray-100 text-xs">
                                <span className="text-gray-600 font-semibold">Budget</span>
                                <span className="font-bold text-gray-900">{fmtDKK(budgetSummary.plannedTotalKr)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-t border-gray-100 text-xs">
                                <span className="text-gray-600 font-semibold">
                                    Forbrugt ({budgetSummary.plannedTotalKr > 0 ? Math.round((budgetSummary.actualTotalKr / budgetSummary.plannedTotalKr) * 100) : 0}%)
                                </span>
                                <span className="font-bold text-gray-900">{fmtDKK(budgetSummary.actualTotalKr)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-t border-gray-100 text-xs">
                                <span className="text-gray-600 font-semibold">Resterer</span>
                                <span className={`font-bold ${budgetSummary.remainingKr < 0 ? 'text-red-700' : 'text-gray-900'}`}>
                                    {fmtDKK(budgetSummary.remainingKr)}
                                </span>
                            </div>
                        </>
                    ) : project.budget ? (
                        <div className="flex justify-between py-2 border-t border-gray-100 text-xs">
                            <span className="text-gray-600 font-semibold">Budget total</span>
                            <span className="font-bold text-gray-900">{fmtDKK(project.budget.total)}</span>
                        </div>
                    ) : null}
                </section>

                {/* Time */}
                {totalHours > 0 && (
                    <section>
                        <h2 className="text-base font-bold text-brand-primary mb-3 uppercase tracking-wide border-b border-gray-200 pb-1">
                            Tidsregistrering
                        </h2>
                        <div className="flex items-center gap-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="text-3xl font-extrabold text-brand-primary">{totalHours.toLocaleString('da-DK')}</div>
                            <div className="text-gray-600 text-xs">
                                <span className="font-bold block">timer registreret</span>
                                <span>på dette projekt</span>
                            </div>
                        </div>
                    </section>
                )}

                {/* Reminders */}
                {reminders.length > 0 && (
                    <section>
                        <h2 className="text-base font-bold text-brand-primary mb-3 uppercase tracking-wide border-b border-gray-200 pb-1">
                            Påmindelser
                        </h2>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Åbne', value: reminderStats.open, color: 'bg-orange-50 text-orange-800' },
                                { label: 'Udført', value: reminderStats.completed, color: 'bg-green-50 text-green-800' },
                            ].map(({ label, value, color }) => (
                                <div key={label} className={`p-3 rounded-lg border text-center ${color}`}>
                                    <div className="text-2xl font-bold leading-none">{value}</div>
                                    <div className="text-xs mt-1 font-semibold">{label}</div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Team */}
                {project.team.length > 0 && (
                    <section>
                        <h2 className="text-base font-bold text-brand-primary mb-3 uppercase tracking-wide border-b border-gray-200 pb-1">
                            Projektteam
                        </h2>
                        <div className="grid grid-cols-2 gap-2">
                            {project.team.map(m => (
                                <div key={m.id} className="flex items-center gap-2 p-2 border border-gray-100 rounded-lg">
                                    <div className="w-7 h-7 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                                        {m.initials}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-xs text-gray-900">{m.name}</p>
                                        <p className="text-xs text-gray-500">{m.role}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
                Genereret af BYG SMART | {new Date().toLocaleDateString('da-DK')}
            </div>
        </div>
    );
};
