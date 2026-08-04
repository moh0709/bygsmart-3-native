import React, { useMemo } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import NotFoundPage from './NotFoundPage';
import { ALL_MANIFESTS } from '../core/registry/manifests';
import { MODULE_INFO } from '../core/registry/moduleInfo';
import { MODULE_ICONS } from '../components/marketplace/moduleIcons';
import { AppScreen, Button, Card } from '../components/ui';
import { useEntitlements } from '../core/entitlements/EntitlementsProvider';

/**
 * Catch-all route handler: when a path belongs to a module that is not active
 * for the org (deep link into a disabled/locked module, or an expired trial),
 * show a marketplace upsell instead of a dead 404 — the storefront detail
 * page carries pricing, trial and purchase. Unknown paths still render 404.
 */
const ModuleGateFallback: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { getEntitlement, hiddenModules } = useEntitlements();

    // Which module owns this path? Reaching the "*" route at all means the
    // route wasn't mounted — i.e. the owning module (or its requires-closure)
    // is inactive for this org.
    const gatedModuleId = useMemo(() => {
        for (const manifest of ALL_MANIFESTS) {
            for (const route of manifest.routes ?? []) {
                if (matchPath(route.path, location.pathname)) return manifest.id;
            }
        }
        return null;
    }, [location.pathname]);

    if (!gatedModuleId) return <NotFoundPage />;

    const info = MODULE_INFO[gatedModuleId];
    const Icon = MODULE_ICONS[gatedModuleId];

    // Entitled (billing intact) but deactivated by the org owner from /moduler —
    // this is a presentation preference, not a locked/unpurchased module, so
    // point back to Moduler to reactivate rather than upselling a purchase.
    const deactivatedByOrg = getEntitlement(gatedModuleId).enabled && hiddenModules.has(gatedModuleId);

    return (
        <AppScreen>
            <div className="flex min-h-[70vh] items-center justify-center">
                <Card padding="md" className="max-w-md w-full text-center">
                    <span className="mx-auto flex w-14 h-14 items-center justify-center rounded-card bg-brand-primary text-white shadow-card" aria-hidden="true">
                        <Icon className="w-7 h-7" />
                    </span>
                    <h1 className="text-title text-text-primary dark:text-text-dark-primary mt-4">
                        {deactivatedByOrg
                            ? `Modulet ${info.name} er deaktiveret`
                            : `Denne side kræver modulet ${info.name}`}
                    </h1>
                    <p className="text-body text-text-secondary dark:text-text-dark-secondary mt-2">
                        {deactivatedByOrg
                            ? 'Modulet er deaktiveret af din organisation. En ejer kan genaktivere det under Moduler.'
                            : `${info.description}. Modulet er ikke aktivt på din organisation — se det i butikken, prøv det gratis eller køb det.`}
                    </p>
                    <div className="mt-5 space-y-2">
                        {deactivatedByOrg ? (
                            <Button fullWidth onClick={() => navigate('/moduler')}>
                                Gå til Moduler
                            </Button>
                        ) : (
                            <Button fullWidth onClick={() => navigate(`/moduler/${gatedModuleId}`)}>
                                Se modulet i butikken
                            </Button>
                        )}
                        <Button fullWidth variant="ghost" onClick={() => navigate('/home')}>
                            Til forsiden
                        </Button>
                    </div>
                </Card>
            </div>
        </AppScreen>
    );
};

export default ModuleGateFallback;
