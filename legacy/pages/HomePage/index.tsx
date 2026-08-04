
import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProjects } from '../../modules/projects';
import { useAuth } from '../../contexts/AuthProvider';
import { useSlot } from '../../core/registry/hooks';
import type { HomeWidgetContribution } from '../../core/registry/types';
import { AppScreen, SegmentedControl } from '../../components/ui';
import { SectionHeader } from '../../components/dashboard/SectionHeader';
import { QuickAction } from './QuickAction';
import { FilePlusIcon, ClipboardListIcon, SearchIcon, CameraIcon } from '../../components/icons';

// ─────────────────────────────────────────────────────────────────────────────
// HomePage — dashboard HOST (Phase 7 W7d). The sections themselves are module
// homeWidgets contributions: each widget fetches its own data and skeletons
// itself, so a disabled module's sections simply never render. The host keeps
// only the kernel chrome: greeting, the management/worker toggle (role scan),
// the "Kræver handling" wrapper, quick actions and the marketplace entry.
// ─────────────────────────────────────────────────────────────────────────────

// React.lazy wrappers must be stable across renders — cache them per widget id.
const widgetCache = new Map<string, React.LazyExoticComponent<React.ComponentType>>();
const getWidgetComponent = (w: HomeWidgetContribution) => {
    let cached = widgetCache.get(w.id);
    if (!cached) {
        cached = lazy(w.load);
        widgetCache.set(w.id, cached);
    }
    return cached;
};

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [dashboardContext, setDashboardContext] = useState<'management' | 'worker'>('management');
    const [canSeeManagementView, setCanSeeManagementView] = useState(false);
    const homeWidgets = useSlot('homeWidgets');

    // Role detection drives the toggle + default context (owner/manager →
    // management view). Widgets do their own fetching; this is the host's
    // only data dependency.
    useEffect(() => {
        if (!user) return;
        let alive = true;
        getProjects(user.id)
            .then((projects) => {
                if (!alive) return;
                const isOwner = projects.some(p => p.ownerId === user.id || (!p.ownerId && user.id === 'user1'));
                const isManager = projects.some(p => p.team.some(m => m.id === user.id && m.role === 'MANAGER'));
                const canManage = isOwner || isManager;
                setCanSeeManagementView(canManage);
                if (!canManage) setDashboardContext('worker');
            })
            .catch((e) => console.error('Home role detection failed:', e));
        return () => { alive = false; };
    }, [user]);

    const inContext = (w: HomeWidgetContribution) => w.context === 'both' || w.context === dashboardContext;
    const actionWidgets = useMemo(
        () => homeWidgets.filter(w => w.section === 'action').filter(inContext),
        [homeWidgets, dashboardContext]
    );
    const mainWidgets = useMemo(
        () => homeWidgets.filter(w => (w.section ?? 'main') === 'main').filter(inContext),
        [homeWidgets, dashboardContext]
    );

    // Header: greeting + date line
    const firstName = user?.name?.split(' ')[0];
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'God morgen';
        if (hour < 18) return 'God eftermiddag';
        return 'God aften';
    }, []);
    const dateLine = useMemo(() => {
        const s = new Date().toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' });
        return s.charAt(0).toUpperCase() + s.slice(1);
    }, []);

    return (
        <AppScreen hasBottomNav={false}>
            {/* 1. Header: greeting/date. Profile, tier badge and notifications
                live in the global top bar (components/GlobalTopBar) on every page. */}
            <header className="pt-2">
                <h1 className="text-heading text-text-primary dark:text-text-dark-primary truncate">
                    {greeting}{firstName ? `, ${firstName}` : ''}
                </h1>
                <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary truncate mt-0.5">{dateLine}</p>
            </header>

            {/* 2. Mode toggle (managers only) */}
            {canSeeManagementView && (
                <div className="mt-4">
                    <SegmentedControl
                        label="Dashboard-visning"
                        options={[
                            { label: 'Projektledelse', value: 'management' },
                            { label: 'Min Arbejdsdag', value: 'worker' }
                        ]}
                        value={dashboardContext}
                        onChange={(val) => setDashboardContext(val as 'management' | 'worker')}
                    />
                </div>
            )}

            {/* 3. "Kræver handling" — module action widgets. Each fetches its own
                data and renders null when empty, so the whole section (incl.
                header) is shown via CSS only when the content wrapper has children. */}
            <section className="mt-6 hidden has-[[data-kh-content]:not(:empty)]:block" aria-label="Kræver handling">
                <div className="flex items-baseline justify-between mb-2.5 px-1">
                    <h2 className="text-heading text-text-primary dark:text-text-dark-primary flex items-center gap-2">
                        Kræver handling
                    </h2>
                </div>
                <div data-kh-content className="space-y-3">
                    {actionWidgets.map((w) => {
                        const Widget = getWidgetComponent(w);
                        return (
                            <Suspense key={w.id} fallback={null}>
                                <Widget />
                            </Suspense>
                        );
                    })}
                </div>
            </section>

            {/* 4. Module widgets for the active context (KPI'er, fokus, briefing,
                projekt puls / dagens timer, min arbejdsdag, partneropgaver …). */}
            {mainWidgets.map((w) => {
                const Widget = getWidgetComponent(w);
                return (
                    <Suspense key={w.id} fallback={null}>
                        <Widget />
                    </Suspense>
                );
            })}

            {dashboardContext === 'management' && (
                <>
                    {/* 5. "Hurtige handlinger" — kernel shortcuts into module routes. */}
                    <SectionHeader title="Hurtige handlinger" />
                    <div className="grid grid-cols-4 gap-2.5">
                        <QuickAction icon={FilePlusIcon} label="Nyt Projekt" onClick={() => navigate('/projects/new')} />
                        <QuickAction icon={ClipboardListIcon} label="Start Tjekliste" onClick={() => navigate('/tasks')} />
                        <QuickAction icon={SearchIcon} label="Søg Reglement" onClick={() => navigate('/search')} />
                        <QuickAction icon={CameraIcon} label="Nyt Punch Punkt" onClick={() => navigate('/projects?intent=punch')} />
                    </div>

                    {/* 6. "Udvid din BygSmart" — module marketplace entry (PRD §12.1) */}
                    <section className="mt-6" aria-label="Udvid din BygSmart">
                        <button
                            type="button"
                            onClick={() => navigate('/moduler')}
                            className="w-full text-left rounded-card border border-dashed border-brand-border dark:border-brand-border-dark bg-brand-subtle/40 dark:bg-brand-subtle-dark/20 p-4 transition-colors hover:bg-brand-subtle/70 dark:hover:bg-brand-subtle-dark/40"
                        >
                            <p className="text-label font-bold text-brand-primary uppercase tracking-wide">Udvid din BygSmart</p>
                            <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-1">
                                Se moduler — tid, dokumenter, økonomi og mere, når du vokser.
                            </p>
                            <span className="inline-block mt-2 text-label font-semibold text-brand-primary">Se moduler →</span>
                        </button>
                    </section>
                </>
            )}
        </AppScreen>
    );
};

export default HomePage;
