import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppScreen, AppHeader, Badge, Button, Card, CardDescription, CardTitle, Switch, cn } from '../components/ui';
import { ChevronRightIcon, SparklesIcon } from '../components/icons';
import { authenticatedServerFetch } from '../services/api/http';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthProvider';
import { useOrg } from '../core/org/OrgProvider';
import { useEntitlements } from '../core/entitlements/EntitlementsProvider';
import { setModuleHidden, ModulePrefsUnavailableError } from '../services/orgModulePrefs';
import { MODULE_IDS, ModuleId } from '../core/registry/types';
import { MODULE_INFO } from '../core/registry/moduleInfo';
import { ALL_MANIFESTS } from '../core/registry/manifests';
import { MODULE_MARKETING, formatModulePrice, TRIAL_DAYS } from '../core/registry/marketplaceCatalog';
import { MODULE_ICONS } from '../components/marketplace/moduleIcons';
import { StorageAddonCard } from '../components/marketplace/StorageAddonCard';

/**
 * "Udvid din BygSmart" — the module storefront (PRD §12.2), route /moduler.
 * Every module is a card with tagline + pris; the detail page (/moduler/:id)
 * carries the full presentation, UI preview and the self-serve trial.
 * Per-module Stripe checkout is the Phase 8 seam.
 */

const GROUP_ORDER = ['Foundation', 'Operations', 'Commercial', 'Add-ons'] as const;

const GROUP_LABELS: Record<(typeof GROUP_ORDER)[number], string> = {
    Foundation: 'Fundament — altid med',
    Operations: 'Drift & udførelse',
    Commercial: 'Forretning',
    'Add-ons': 'Tilføjelser',
};

const formatDate = (iso: string | null): string => {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleDateString('da-DK', { dateStyle: 'medium' });
    } catch {
        return '';
    }
};

const ModuleMarketplacePage: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { user } = useAuth();
    const { activeOrg } = useOrg();
    const { getEntitlement, enabledModules, hiddenModules, meta, refresh, refreshHidden } = useEntitlements();
    const requiresOf = (moduleId: ModuleId): ModuleId[] =>
        ALL_MANIFESTS.find((m) => m.id === moduleId)?.requires ?? [];
    // Only the org owner may deactivate/reactivate modules; the foundation
    // group ("Fundament — altid med") is always included and never toggles.
    const isOwner = !!activeOrg && !!user && user.id === activeOrg.createdBy;
    const [isStartingAll, setIsStartingAll] = useState(false);
    const [searchParams] = useSearchParams();
    const storageToastShown = useRef(false);

    // Landing back from a storage-add-on Stripe checkout.
    const storageResult = searchParams.get('storage');
    useEffect(() => {
        if (!storageResult || storageToastShown.current) return;
        storageToastShown.current = true;
        if (storageResult === 'success') {
            showToast('Tak for købet! Din ekstra lagerplads aktiveres om et øjeblik.', 'success');
        } else if (storageResult === 'cancelled') {
            showToast('Købet blev afbrudt — der er ikke trukket penge.', 'info');
        }
    }, [storageResult]);

    const lockedCount = MODULE_IDS.filter((id) => !getEntitlement(id).enabled).length;

    const startAllTrials = async () => {
        setIsStartingAll(true);
        try {
            const res = await authenticatedServerFetch('/modules/trial', {
                method: 'POST',
                body: JSON.stringify({ all: true }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);
            refresh();
            const started = payload.trials?.length ?? 0;
            showToast(`${started} ${started === 1 ? 'modul' : 'moduler'} aktiveret på prøve i ${TRIAL_DAYS} dage.`, 'success');
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Kunne ikke starte prøveperioden.', 'error');
        } finally {
            setIsStartingAll(false);
        }
    };

    const stateBadge = (moduleId: ModuleId) => {
        const entry = getEntitlement(moduleId);
        const included = MODULE_MARKETING[moduleId].priceKr === 0;
        if (!entry.enabled) return <Badge variant="neutral">Prøv gratis</Badge>;
        if (entry.source === 'trial') return <Badge variant="info">Prøve til {formatDate(entry.validUntil)}</Badge>;
        if (entry.source === 'purchase' && entry.cancelAtPeriodEnd) {
            return <Badge variant="warning">Ophører {formatDate(entry.currentPeriodEnd ?? null)}</Badge>;
        }
        if (entry.source === 'purchase') return <Badge variant="success">Købt</Badge>;
        return <Badge variant="success">{included ? 'Inkluderet' : 'Aktivt'}</Badge>;
    };

    const enabledCount = MODULE_IDS.filter((id) => getEntitlement(id).enabled && !hiddenModules.has(id)).length;

    // Deactivate (hide) or reactivate (reveal) a module for the whole org.
    // Only reachable for the owner on non-foundation, entitled modules.
    const handleToggle = async (moduleId: ModuleId) => {
        if (!activeOrg) return;
        const nextHidden = !hiddenModules.has(moduleId);
        try {
            await setModuleHidden(activeOrg.id, moduleId, nextHidden);
            refreshHidden();
            if (nextHidden) {
                const entry = getEntitlement(moduleId);
                const base = 'Modulet er deaktiveret — genaktivér når som helst her.';
                showToast(
                    entry.source === 'purchase'
                        ? `${base} Dit abonnement fortsætter — opsig inde på modulet for at stoppe betalingen.`
                        : base,
                    'info'
                );
            } else {
                showToast('Modulet er aktiveret igen.', 'success');
            }
        } catch (err) {
            if (err instanceof ModulePrefsUnavailableError) {
                showToast('Funktionen kræver en databaseopdatering.', 'error');
            } else {
                showToast(err instanceof Error ? err.message : 'Kunne ikke ændre modulet.', 'error');
            }
        }
    };

    return (
        <AppScreen>
            <AppHeader
                title="Udvid din BygSmart"
                subtitle={`${enabledCount} af ${MODULE_IDS.length} moduler aktive${meta?.grandfathered ? ' · fuld adgang' : ''}`}
            />

            <div className="space-y-6 pb-24">
                <Card className="border-dashed border-brand-border dark:border-brand-border-dark bg-brand-subtle/40 dark:bg-brand-subtle-dark/20">
                    <CardTitle>Byg din egen pakke</CardTitle>
                    <CardDescription className="mt-1">
                        {meta?.grandfathered
                            ? 'Din organisation har fuld adgang til alle moduler. Kig dig omkring og se, hvad hvert modul kan.'
                            : `Fundamentet er gratis — resten aktiverer du modul for modul, når behovet opstår. Alle betalte moduler kan prøves gratis i ${TRIAL_DAYS} dage.`}
                    </CardDescription>
                    {!meta?.grandfathered && lockedCount > 0 && (
                        <Button
                            size="sm"
                            className="mt-3"
                            iconLeft={<SparklesIcon className="w-4 h-4" />}
                            onClick={startAllTrials}
                            disabled={isStartingAll}
                        >
                            {isStartingAll ? 'Aktiverer…' : `Prøv alle ${lockedCount} moduler gratis i ${TRIAL_DAYS} dage`}
                        </Button>
                    )}
                </Card>

                {GROUP_ORDER.map((group) => {
                    const groupModules = MODULE_IDS.filter((id) => MODULE_INFO[id].group === group);
                    if (groupModules.length === 0) return null;
                    return (
                        <section key={group} aria-label={GROUP_LABELS[group]}>
                            <h2 className="text-heading text-text-primary dark:text-text-dark-primary mb-2.5 px-1">
                                {GROUP_LABELS[group]}
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {groupModules.map((id) => {
                                    const info = MODULE_INFO[id];
                                    const marketing = MODULE_MARKETING[id];
                                    const Icon = MODULE_ICONS[id];
                                    const enabled = getEntitlement(id).enabled;
                                    const hidden = hiddenModules.has(id);
                                    // Foundation ("Fundament — altid med") is always included: no toggle.
                                    const showToggle = isOwner && info.group !== 'Foundation';
                                    const missingRequires = enabled ? [] : requiresOf(id).filter((reqId) => !enabledModules.has(reqId));
                                    return (
                                        <div
                                            key={id}
                                            className={cn(
                                                'rounded-card border bg-bg dark:bg-bg-dark-surface shadow-card transition-all duration-150 hover:shadow-card-hover',
                                                enabled
                                                    ? 'border-border dark:border-border-dark'
                                                    : 'border-brand-border/70 dark:border-brand-border-dark/70'
                                            )}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/moduler/${id}`)}
                                                aria-label={`${info.name} — se detaljer`}
                                                className="block w-full text-left p-4 rounded-card active:scale-[0.99] transition-transform duration-150"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <span
                                                        className={cn(
                                                            'flex w-10 h-10 shrink-0 items-center justify-center rounded-control',
                                                            enabled
                                                                ? 'bg-brand-subtle text-brand-primary dark:bg-brand-subtle-dark dark:text-brand-light'
                                                                : 'bg-brand-primary text-white'
                                                        )}
                                                        aria-hidden="true"
                                                    >
                                                        <Icon className="w-5 h-5" />
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <p className="text-label font-bold text-text-primary dark:text-text-dark-primary truncate">
                                                                {info.name}
                                                            </p>
                                                            <ChevronRightIcon className="w-4 h-4 shrink-0 text-text-tertiary dark:text-text-dark-tertiary" />
                                                        </div>
                                                        <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-0.5 line-clamp-2">
                                                            {marketing.tagline}
                                                        </p>
                                                        <div className="flex items-center justify-between gap-2 mt-2.5">
                                                            {hidden ? <Badge variant="neutral">Deaktiveret</Badge> : stateBadge(id)}
                                                            <span className="text-label font-semibold text-text-primary dark:text-text-dark-primary">
                                                                {formatModulePrice(marketing.priceKr)}
                                                            </span>
                                                        </div>
                                                        {missingRequires.length > 0 && (
                                                            <p className="text-caption text-warning-strong dark:text-warning mt-1.5">
                                                                Kræver {missingRequires.map((reqId) => MODULE_INFO[reqId].name).join(', ')}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                            {showToggle && (
                                                <div className="flex items-center justify-between gap-2 border-t border-border dark:border-border-dark px-4 py-2.5">
                                                    <span className="text-caption text-text-secondary dark:text-text-dark-secondary">
                                                        {!enabled ? 'Ikke aktivt' : hidden ? 'Deaktiveret' : 'Aktivt i appen'}
                                                    </span>
                                                    <Switch
                                                        checked={enabled && !hidden}
                                                        disabled={!enabled}
                                                        onChange={() => handleToggle(id)}
                                                        aria-label={hidden ? `Aktivér ${info.name}` : `Deaktivér ${info.name}`}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    );
                })}

                <StorageAddonCard />

                <p className="text-caption text-center text-text-secondary dark:text-text-dark-secondary px-4">
                    Priser er pr. organisation pr. måned ekskl. moms. Alle betalte moduler kan
                    prøves gratis i {TRIAL_DAYS} dage, og købte moduler kan opsiges når som helst.
                </p>
            </div>
        </AppScreen>
    );
};

export default ModuleMarketplacePage;
