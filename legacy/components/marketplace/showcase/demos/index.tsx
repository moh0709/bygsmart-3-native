import React, { Suspense, lazy } from 'react';
import type { ModuleId } from '../../../../core/registry/types';

// ─────────────────────────────────────────────────────────────────────────────
// Interactive demo registry — one tap-to-play demo per module.
//
// Demos are code-split by family, so a visitor to /moduler/field downloads the
// site demos only, not the commercial ones. Every demo is a pure local
// simulation: no network, no writes, no entitlement checks.
// ─────────────────────────────────────────────────────────────────────────────

const DEMOS: Record<ModuleId, React.ComponentType> = {
    projects: lazy(() => import('./workDemos').then((m) => ({ default: m.ProjectPulseDemo }))),
    tasks: lazy(() => import('./workDemos').then((m) => ({ default: m.KanbanDemo }))),
    time: lazy(() => import('./workDemos').then((m) => ({ default: m.TimerDemo }))),
    planning: lazy(() => import('./workDemos').then((m) => ({ default: m.GanttDemo }))),

    field: lazy(() => import('./fieldDemos').then((m) => ({ default: m.CheckInDemo }))),
    quality: lazy(() => import('./fieldDemos').then((m) => ({ default: m.DefectDemo }))),
    ar: lazy(() => import('./fieldDemos').then((m) => ({ default: m.ScanDemo }))),

    tools: lazy(() => import('./knowledgeDemos').then((m) => ({ default: m.CalcDemo }))),
    knowledge: lazy(() => import('./knowledgeDemos').then((m) => ({ default: m.SearchDemo }))),
    documents: lazy(() => import('./knowledgeDemos').then((m) => ({ default: m.RevisionDemo }))),
    reporting: lazy(() => import('./knowledgeDemos').then((m) => ({ default: m.ReportDemo }))),

    budget: lazy(() => import('./moneyDemos').then((m) => ({ default: m.BudgetDemo }))),
    purchasing: lazy(() => import('./moneyDemos').then((m) => ({ default: m.PurchaseDemo }))),
    quotations: lazy(() => import('./moneyDemos').then((m) => ({ default: m.QuoteDemo }))),

    team: lazy(() => import('./peopleDemos').then((m) => ({ default: m.InviteDemo }))),
    'client-portal': lazy(() => import('./peopleDemos').then((m) => ({ default: m.PortalDemo }))),
    partners: lazy(() => import('./peopleDemos').then((m) => ({ default: m.NegotiateDemo }))),
    ai: lazy(() => import('./peopleDemos').then((m) => ({ default: m.AiChatDemo }))),
    integrations: lazy(() => import('./peopleDemos').then((m) => ({ default: m.ConnectDemo }))),
};

const DemoSkeleton: React.FC = () => (
    <div className="rounded-card border border-border dark:border-border-dark bg-bg-subtle dark:bg-bg-dark-muted p-3 sm:p-4">
        <div className="rounded-card border border-border dark:border-border-dark bg-bg dark:bg-bg-dark-surface h-72 animate-pulse" />
    </div>
);

/** Renders the interactive demo for a module. */
export const ModuleDemo: React.FC<{ moduleId: ModuleId }> = ({ moduleId }) => {
    const Demo = DEMOS[moduleId];
    return (
        <Suspense fallback={<DemoSkeleton />}>
            <Demo />
        </Suspense>
    );
};
