import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppScreen, AppHeader, Alert, Badge, Button, Card, ConfirmDialog, cn } from '../components/ui';
import { CheckCircleIcon, SparklesIcon, ZapIcon } from '../components/icons';
import { useEntitlements } from '../core/entitlements/EntitlementsProvider';
import { MODULE_IDS, ModuleId } from '../core/registry/types';
import { MODULE_INFO } from '../core/registry/moduleInfo';
import { ALL_MANIFESTS } from '../core/registry/manifests';
import { MODULE_MARKETING, TRIAL_DAYS, formatModulePrice } from '../core/registry/marketplaceCatalog';
import { MODULE_SHOWCASE } from '../core/registry/moduleShowcase';
import { MODULE_ICONS } from '../components/marketplace/moduleIcons';
import { ModuleHeroArt } from '../components/marketplace/showcase/ModuleHeroArt';
import {
    BeforeAfter, FaqList, FeatureGrid, FlowDiagram, ImpactStrip, RelatedModules, ShowcaseSection,
} from '../components/marketplace/showcase/Infographics';
import { ModuleDemo } from '../components/marketplace/showcase/demos';
import { authenticatedServerFetch } from '../services/api/http';
import { cancelModule, reactivateModule } from '../services/moduleEntitlements';
import { useToast } from '../contexts/ToastContext';
import NotFoundPage from './NotFoundPage';

const formatDate = (iso: string | null): string => {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleDateString('da-DK', { dateStyle: 'medium' });
    } catch {
        return '';
    }
};

/**
 * Module storefront detail — /moduler/:moduleId (PRD §12.2).
 *
 * A full landing page per module: bespoke animated hero, impact metrics, a
 * tap-to-play interactive demo of the real feature, feature cards, an
 * infographic flow, a before/after comparison and an FAQ — on top of the
 * unchanged commerce layer (Stripe per-module checkout, self-serve 14-day
 * trial, cancel/reactivate and the billing portal).
 *
 * Presentation copy lives in core/registry/moduleShowcase.ts; the demos are
 * local simulations under components/marketplace/showcase/demos/ and never
 * touch the server.
 */
const ModuleDetailPage: React.FC = () => {
    const { moduleId } = useParams<{ moduleId: string }>();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { getEntitlement, enabledModules, meta, refresh } = useEntitlements();
    const [isStartingTrial, setIsStartingTrial] = useState(false);
    const [isBuying, setIsBuying] = useState(false);
    const [isOpeningPortal, setIsOpeningPortal] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [isReactivating, setIsReactivating] = useState(false);
    const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
    const [searchParams] = useSearchParams();
    const checkoutToastShown = useRef(false);

    // Landing back from Stripe Checkout (success_url/cancel_url carry ?checkout=).
    const checkoutResult = searchParams.get('checkout');
    useEffect(() => {
        if (!checkoutResult || checkoutToastShown.current) return;
        checkoutToastShown.current = true;
        if (checkoutResult === 'success') {
            showToast('Tak for købet! Modulet aktiveres om et øjeblik.', 'success');
            refresh();
        } else if (checkoutResult === 'cancelled') {
            showToast('Købet blev afbrudt — der er ikke trukket penge.', 'info');
        }
    }, [checkoutResult]);

    // Every landing page starts at the hero, also when arriving from a
    // "spiller godt sammen med" card further down another module's page.
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'auto' });
    }, [moduleId]);

    const id = useMemo(
        () => (MODULE_IDS.includes(moduleId as ModuleId) ? (moduleId as ModuleId) : null),
        [moduleId]
    );
    // Resolved before the NotFoundPage bail-out so the hook order stays stable
    // across an id → null transition.
    const requires = useMemo(
        () => (id ? ALL_MANIFESTS.find((m) => m.id === id)?.requires ?? [] : []),
        [id]
    );
    if (!id) return <NotFoundPage />;

    const info = MODULE_INFO[id];
    const marketing = MODULE_MARKETING[id];
    const showcase = MODULE_SHOWCASE[id];
    const Icon = MODULE_ICONS[id];
    const entry = getEntitlement(id);
    const included = marketing.priceKr === 0;
    const isTrial = entry.enabled && entry.source === 'trial';
    const isActive = entry.enabled;
    const missingRequires = requires.filter((reqId) => !enabledModules.has(reqId));
    const missingRequiresNote = missingRequires.length > 0
        ? `Kræver ${missingRequires.map((reqId) => MODULE_INFO[reqId].name).join(', ')} først.`
        : null;

    /** Accent pair consumed by the hero, feature bubbles and every demo. */
    const accentVars = {
        ['--sc-a' as string]: showcase.accent[0],
        ['--sc-b' as string]: showcase.accent[1],
    } as React.CSSProperties;

    const openPortal = async () => {
        setIsOpeningPortal(true);
        try {
            const returnUrl = `${window.location.origin}${window.location.pathname}#/moduler/${id}`;
            const res = await authenticatedServerFetch('/create-portal-session', {
                method: 'POST',
                body: JSON.stringify({ returnUrl }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);
            window.location.assign(payload.url);
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Kunne ikke åbne abonnementssiden.', 'error');
            setIsOpeningPortal(false);
        }
    };

    const startCheckout = async () => {
        setIsBuying(true);
        try {
            const res = await authenticatedServerFetch('/modules/checkout', {
                method: 'POST',
                body: JSON.stringify({ moduleId: id }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);
            if (!payload.url) throw new Error('Stripe returnerede ingen betalingsside.');
            window.location.assign(payload.url);
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Kunne ikke starte købet.', 'error');
            setIsBuying(false);
        }
    };

    const startTrial = async () => {
        setIsStartingTrial(true);
        try {
            const res = await authenticatedServerFetch('/modules/trial', {
                method: 'POST',
                body: JSON.stringify({ moduleId: id }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);
            refresh();
            showToast(`Prøveperioden er startet — ${info.name} er aktivt til ${formatDate(payload.trial?.validUntil ?? null)}.`, 'success');
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Kunne ikke starte prøveperioden.', 'error');
        } finally {
            setIsStartingTrial(false);
        }
    };

    const handleCancel = async () => {
        setIsCancelling(true);
        try {
            await cancelModule(id);
            refresh();
            showToast(`${info.name} ophører ved udgangen af den betalte periode.`, 'success');
            setConfirmCancelOpen(false);
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Kunne ikke annullere modulet.', 'error');
        } finally {
            setIsCancelling(false);
        }
    };

    const handleReactivate = async () => {
        setIsReactivating(true);
        try {
            await reactivateModule(id);
            refresh();
            showToast(`Opsigelsen af ${info.name} er fortrudt.`, 'success');
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Kunne ikke fortryde opsigelsen.', 'error');
        } finally {
            setIsReactivating(false);
        }
    };

    const statusBadge = isTrial ? (
        <Badge variant="info">Prøve til {formatDate(entry.validUntil)}</Badge>
    ) : isActive ? (
        <Badge variant="success">{included ? 'Inkluderet' : 'Aktivt'}</Badge>
    ) : (
        <Badge variant="neutral">Ikke aktivt</Badge>
    );

    /** The sticky bar only appears while there is still something to buy. */
    const showStickyCta = !included && (!isActive || isTrial);

    const related = showcase.related
        .filter((r) => r !== id)
        .map((r) => ({
            id: r,
            name: MODULE_INFO[r].name,
            tagline: MODULE_MARKETING[r].tagline,
            price: formatModulePrice(MODULE_MARKETING[r].priceKr),
            Icon: MODULE_ICONS[r],
        }));

    return (
        <AppScreen hasBottomNav={false}>
            <AppHeader title={info.name} back />

            <div style={accentVars} className="space-y-9">
                {/* ── Hero ─────────────────────────────────────────────── */}
                {/* Always animates on mount — it is above the fold, so gating it on
                    an IntersectionObserver would risk a blank frame instead of a fade. */}
                <section
                    aria-label={`Om ${info.name}`}
                    className={cn(
                        'sc-stage sc-reveal relative -mx-4 md:mx-0 rounded-none md:rounded-card',
                        'px-5 pt-6 pb-7 md:px-8 md:py-9 text-white'
                    )}
                >
                    <div className="relative grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,340px)] md:items-center">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2.5">
                                <span className="sc-glass flex w-11 h-11 shrink-0 items-center justify-center rounded-control" aria-hidden="true">
                                    <Icon className="w-5 h-5" />
                                </span>
                                <span className="sc-glass rounded-full px-3 py-1.5 text-caption font-bold">
                                    {info.name}
                                </span>
                                {isActive && (
                                    <span className="rounded-full bg-white/90 px-3 py-1.5 text-caption font-bold text-[#0B1220]">
                                        {isTrial ? `Prøve til ${formatDate(entry.validUntil)}` : included ? 'Inkluderet' : 'Aktivt'}
                                    </span>
                                )}
                            </div>

                            <h1 className="text-display md:text-[34px] md:leading-[40px] mt-4 text-balance">
                                {showcase.headline}
                            </h1>
                            <p className="text-body text-white/75 mt-3 max-w-prose">{showcase.subhead}</p>

                            <div className="flex flex-wrap items-center gap-2.5 mt-5">
                                <span className="sc-glass rounded-full px-3.5 py-2 text-label font-bold">
                                    {included ? 'Inkluderet i Gratis' : `${marketing.priceKr} kr/md.`}
                                </span>
                                {!included && (
                                    <span className="text-caption text-white/65">
                                        pr. organisation · {TRIAL_DAYS} dages gratis prøve · ingen binding
                                    </span>
                                )}
                            </div>

                            {!isActive && (
                                <div className="flex flex-wrap gap-2.5 mt-5">
                                    {/* Inline styles, not `!` utilities: Tailwind v4 dropped the
                                        leading-bang modifier, and these must beat the primary
                                        variant's gradient + brand shadow. */}
                                    <Button
                                        onClick={startCheckout}
                                        disabled={isBuying || isStartingTrial || missingRequires.length > 0}
                                        className="hover:brightness-95"
                                        style={{ backgroundImage: 'none', backgroundColor: '#fff', color: '#0B1220', boxShadow: 'var(--shadow-raised)' }}
                                    >
                                        {isBuying ? 'Åbner betaling…' : `Køb — ${formatModulePrice(marketing.priceKr)}`}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        iconLeft={<SparklesIcon className="w-4 h-4" />}
                                        onClick={startTrial}
                                        disabled={isStartingTrial || isBuying || missingRequires.length > 0}
                                        className="rich-on-hero"
                                    >
                                        {isStartingTrial ? 'Starter prøve…' : `Prøv gratis i ${TRIAL_DAYS} dage`}
                                    </Button>
                                </div>
                            )}
                            {missingRequiresNote && (
                                <p className="text-caption font-semibold text-white/80 mt-3">{missingRequiresNote}</p>
                            )}
                        </div>

                        {/* Bespoke scene — decorative, mirrors the module in action. */}
                        <div className="relative">
                            <div className="sc-glass rounded-card overflow-hidden p-2 sc-float-slow">
                                <ModuleHeroArt moduleId={id} className="w-full h-auto block rounded-[10px]" />
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── Impact metrics ───────────────────────────────────── */}
                <ImpactStrip metrics={showcase.metrics} />

                {/* ── Interactive demo ─────────────────────────────────── */}
                <ShowcaseSection eyebrow="Prøv det" title={showcase.demoTitle}>
                    <p className="text-body text-text-secondary dark:text-text-dark-secondary mb-3 px-1">
                        {showcase.demoHint}
                    </p>
                    <ModuleDemo moduleId={id} />
                    <p className="flex items-center justify-center gap-1.5 text-caption text-text-tertiary dark:text-text-dark-tertiary mt-2.5">
                        <ZapIcon className="w-3.5 h-3.5" />
                        Live demo — intet bliver gemt, og ingen data forlader din enhed.
                    </p>
                </ShowcaseSection>

                {/* ── Features ─────────────────────────────────────────── */}
                <ShowcaseSection eyebrow="Det får du" title={`${info.name} i detaljer`}>
                    <FeatureGrid features={showcase.features} />
                </ShowcaseSection>

                {/* ── Flow ─────────────────────────────────────────────── */}
                <ShowcaseSection eyebrow="Sådan virker det" title="Fire trin, fra start til slut">
                    <FlowDiagram steps={showcase.flow} />
                </ShowcaseSection>

                {/* ── Before / after ───────────────────────────────────── */}
                <ShowcaseSection eyebrow="Forskellen" title="Hverdagen før og efter">
                    <BeforeAfter without={showcase.without} withIt={showcase.withIt} moduleName={info.name} />
                </ShowcaseSection>

                {/* ── Pricing & subscription state ─────────────────────── */}
                <ShowcaseSection eyebrow="Pris" title={included ? 'Med i fundamentet' : 'Kom i gang'}>
                    <Card padding="md" className={cn(!isActive && 'border-brand-primary/40 dark:border-brand-primary/40')}>
                        <div className="flex items-end justify-between gap-3 flex-wrap">
                            <div>
                                <p className="text-caption text-text-secondary dark:text-text-dark-secondary">Pris pr. organisation</p>
                                <p className="text-display text-text-primary dark:text-text-dark-primary mt-0.5">
                                    {included ? 'Inkluderet' : (
                                        <>
                                            {marketing.priceKr} <span className="text-label font-semibold text-text-secondary dark:text-text-dark-secondary">kr/md.</span>
                                        </>
                                    )}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {statusBadge}
                            </div>
                        </div>
                        {isActive && !isTrial && (
                            <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-1.5">
                                {meta?.grandfathered ? 'Din organisation har fuld adgang.' : 'Modulet er aktivt på din organisation.'}
                            </p>
                        )}

                        {isActive && entry.source === 'purchase' && (
                            <div className="mt-4 space-y-2">
                                {entry.cancelAtPeriodEnd ? (
                                    <>
                                        <Alert variant="warning" title={`Ophører d. ${formatDate(entry.currentPeriodEnd ?? null)}`}>
                                            Modulet er aktivt indtil da. Herefter mister I adgangen, medmindre I fortryder opsigelsen.
                                        </Alert>
                                        <Button
                                            fullWidth
                                            onClick={handleReactivate}
                                            disabled={isReactivating}
                                        >
                                            {isReactivating ? 'Fortryder…' : 'Fortryd opsigelse'}
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        fullWidth
                                        variant="outline"
                                        onClick={() => setConfirmCancelOpen(true)}
                                    >
                                        Annullér modul
                                    </Button>
                                )}
                                <Button
                                    fullWidth
                                    variant="ghost"
                                    onClick={openPortal}
                                    disabled={isOpeningPortal}
                                >
                                    {isOpeningPortal ? 'Åbner…' : 'Administrér abonnement (fakturaer, betalingskort)'}
                                </Button>
                            </div>
                        )}

                        {!isActive && (
                            <div className="mt-4 space-y-2">
                                {missingRequiresNote && (
                                    <p className="text-caption text-center font-medium text-warning-strong dark:text-warning">
                                        {missingRequiresNote}
                                    </p>
                                )}
                                <Button
                                    fullWidth
                                    onClick={startCheckout}
                                    disabled={isBuying || isStartingTrial || missingRequires.length > 0}
                                >
                                    {isBuying ? 'Åbner betaling…' : `Køb — ${formatModulePrice(marketing.priceKr)}`}
                                </Button>
                                <Button
                                    fullWidth
                                    variant="outline"
                                    iconLeft={<SparklesIcon className="w-4 h-4" />}
                                    onClick={startTrial}
                                    disabled={isStartingTrial || isBuying || missingRequires.length > 0}
                                >
                                    {isStartingTrial ? 'Starter prøve…' : `Prøv gratis i ${TRIAL_DAYS} dage`}
                                </Button>
                                <p className="text-caption text-center text-text-secondary dark:text-text-dark-secondary">
                                    Ingen binding — abonnementet kan opsiges når som helst, og prøven
                                    slår automatisk fra efter {TRIAL_DAYS} dage.
                                </p>
                            </div>
                        )}
                        {isTrial && (
                            <div className="mt-4 space-y-2">
                                {missingRequiresNote && (
                                    <p className="text-caption text-center font-medium text-warning-strong dark:text-warning">
                                        {missingRequiresNote}
                                    </p>
                                )}
                                <Button fullWidth onClick={startCheckout} disabled={isBuying || missingRequires.length > 0}>
                                    {isBuying ? 'Åbner betaling…' : `Køb nu — ${formatModulePrice(marketing.priceKr)}`}
                                </Button>
                                <p className="text-caption text-center text-text-secondary dark:text-text-dark-secondary">
                                    Din prøveperiode løber til {formatDate(entry.validUntil)}. Køb modulet
                                    for at fortsætte uden afbrydelse — abonnementet kan opsiges når som helst.
                                </p>
                            </div>
                        )}
                    </Card>
                </ShowcaseSection>

                {/* ── FAQ ──────────────────────────────────────────────── */}
                <ShowcaseSection eyebrow="Spørgsmål" title="Godt at vide">
                    <FaqList items={showcase.faq} />
                </ShowcaseSection>

                {/* ── Related ──────────────────────────────────────────── */}
                {related.length > 0 && (
                    <ShowcaseSection eyebrow="Kombinationer" title="Spiller godt sammen med">
                        <RelatedModules items={related} onOpen={(rid) => navigate(`/moduler/${rid}`)} />
                    </ShowcaseSection>
                )}

                <Button variant="ghost" fullWidth onClick={() => navigate('/moduler')}>
                    ← Tilbage til alle moduler
                </Button>

                {/* ── Sticky conversion bar ────────────────────────────── */}
                {showStickyCta && (
                    <div className="sticky bottom-nav-clear md:bottom-6 z-30 pointer-events-none">
                        <div className="pointer-events-auto rounded-card border border-border dark:border-border-dark bg-bg/90 dark:bg-bg-dark-surface/90 backdrop-blur-md shadow-raised p-2.5 flex items-center gap-2.5">
                            <div className="min-w-0 flex-1 pl-1.5">
                                <p className="text-label font-bold text-text-primary dark:text-text-dark-primary truncate">
                                    {info.name}
                                </p>
                                <p className="text-caption text-text-secondary dark:text-text-dark-secondary truncate">
                                    {marketing.priceKr} kr/md. · {isTrial ? `prøve til ${formatDate(entry.validUntil)}` : `${TRIAL_DAYS} dages gratis prøve`}
                                </p>
                            </div>
                            {!isTrial && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={startTrial}
                                    disabled={isStartingTrial || isBuying || missingRequires.length > 0}
                                    className="shrink-0 hidden sm:inline-flex"
                                >
                                    {isStartingTrial ? 'Starter…' : 'Prøv gratis'}
                                </Button>
                            )}
                            <Button
                                size="sm"
                                onClick={startCheckout}
                                disabled={isBuying || isStartingTrial || missingRequires.length > 0}
                                className="shrink-0"
                            >
                                {isBuying ? 'Åbner…' : 'Køb modul'}
                            </Button>
                        </div>
                    </div>
                )}

                <p className="text-caption text-center text-text-tertiary dark:text-text-dark-tertiary px-4 flex items-center justify-center gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5" />
                    Priser er pr. organisation pr. måned ekskl. moms.
                </p>
            </div>

            <ConfirmDialog
                isOpen={confirmCancelOpen}
                title={`Annullér ${info.name}?`}
                message="Modulet forbliver aktivt resten af den betalte periode og ophører først derefter. Du kan fortryde annulleringen når som helst inden da."
                confirmLabel="Annullér modul"
                danger
                loading={isCancelling}
                onConfirm={handleCancel}
                onCancel={() => setConfirmCancelOpen(false)}
            />
        </AppScreen>
    );
};

export default ModuleDetailPage;
