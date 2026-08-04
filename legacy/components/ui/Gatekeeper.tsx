
import React from 'react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { PlanLimits, getPlanName } from '../../config/subscriptionPlans';
import { SparklesIcon, LockIcon } from '../icons';

interface GatekeeperProps {
    permission?: keyof PlanLimits; // Boolean permission to check
    minTier?: 'PRO' | 'PREMIUM'; // Explicit minimum tier required
    children: React.ReactNode;
    fallback?: React.ReactNode; // What to show if locked (default is lock overlay)
    blur?: boolean; // Blur the children content?
}

export const Gatekeeper: React.FC<GatekeeperProps> = ({ permission, minTier, children, fallback, blur = false }) => {
    const { features, tier, upgradeTo } = useSubscription();

    let hasAccess = true;

    if (permission) {
        if (!features[permission]) hasAccess = false;
    }

    if (minTier) {
        const tiers = ['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE'];
        if (tiers.indexOf(tier) < tiers.indexOf(minTier)) hasAccess = false;
    }

    if (hasAccess) return <>{children}</>;

    if (fallback) return <>{fallback}</>;

    return (
        <div className="relative overflow-hidden rounded-card border border-border dark:border-border-dark bg-bg-subtle dark:bg-bg-dark-surface">
            <div className={`${blur ? 'filter blur-sm opacity-50 pointer-events-none select-none' : ''}`}>
                {children}
            </div>
            
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-white/60 dark:bg-black/60 backdrop-blur-sm">
                <div className="bg-brand-primary p-3 rounded-full text-white mb-3 shadow-lg">
                    <LockIcon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-text-primary dark:text-text-dark-primary mb-1">
                    Lås op for {minTier ? getPlanName(minTier) : 'Pro'} Features
                </h3>
                <p className="text-sm text-text-secondary dark:text-text-dark-secondary mb-4 max-w-xs">
                    Opgrader dit abonnement for at få adgang til denne funktion og meget mere.
                </p>
                <button
                    onClick={() => upgradeTo(minTier || 'PRO')}
                    className="bg-gradient-to-r from-brand-primary to-brand-strong text-white font-bold py-2 px-6 min-h-11 rounded-full shadow-md hover:scale-105 transition-transform flex items-center gap-2"
                >
                    <SparklesIcon className="w-4 h-4 text-brand-accent" />
                    Opgrader til {minTier || 'Pro'}
                </button>
            </div>
        </div>
    );
};
