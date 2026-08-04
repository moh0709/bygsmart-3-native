
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircleIcon } from '../icons';
import { useEntitlements } from '../../core/entitlements/EntitlementsProvider';
import { MODULE_IDS } from '../../core/registry/types';
import { MODULE_INFO } from '../../core/registry/moduleInfo';
import { MODULE_MARKETING } from '../../core/registry/marketplaceCatalog';
import { MODULE_ICONS } from '../marketplace/moduleIcons';
import { useSubscription, BillingInterval } from '../../contexts/SubscriptionContext';
import { PLAN_DETAILS } from '../../config/subscriptionPlans';
import { SubscriptionTier } from '../../types';
import { Alert, Badge, Button, Card, Input, Modal, SegmentedControl, cn } from '../ui';
import { validateTrialCode } from '../../services/api/promoCodes';

// Yearly prices (DKK) — shown when yearly toggle is active
const YEARLY_PRICES: Partial<Record<SubscriptionTier, string>> = {
    PRO: '1.910 kr.',
    PREMIUM: '4.790 kr.',
};

// Monthly savings label for yearly billing
const YEARLY_SAVINGS: Partial<Record<SubscriptionTier, string>> = {
    PRO: 'Spar 20%',
    PREMIUM: 'Spar 20%',
};

export const SubscriptionModal: React.FC<{ onClose: () => void; limitMessage?: string; preselectTier?: string | null }> = ({ onClose, limitMessage, preselectTier }) => {
    const { tier, upgradeTo, openPortal } = useSubscription();
    const navigate = useNavigate();
    const { getEntitlement } = useEntitlements();
    const [billing, setBilling] = useState<BillingInterval>('monthly');
    const [loadingTier, setLoadingTier] = useState<SubscriptionTier | null>(null);
    const [isPortalLoading, setIsPortalLoading] = useState(false);

    const [trialCode, setTrialCode] = useState('');
    const [trialCheck, setTrialCheck] = useState<{ valid: boolean; reason?: string; trialDays?: number | null; trialUntil?: string | null } | null>(null);
    const [checkingTrial, setCheckingTrial] = useState(false);

    const isPaidTier = tier === 'PRO' || tier === 'PREMIUM';

    const applyTrialCode = async () => {
        const code = trialCode.trim();
        if (!code) { setTrialCheck(null); return; }
        setCheckingTrial(true);
        try {
            setTrialCheck(await validateTrialCode(code));
        } catch {
            setTrialCheck({ valid: false, reason: 'Kunne ikke tjekke koden.' });
        } finally {
            setCheckingTrial(false);
        }
    };

    const handleSelect = async (key: SubscriptionTier) => {
        if (key === tier || loadingTier) return;
        setLoadingTier(key);
        await upgradeTo(key, billing, trialCheck?.valid ? trialCode.trim().toUpperCase() : undefined);
        setLoadingTier(null);
    };

    const handlePortal = async () => {
        setIsPortalLoading(true);
        await openPortal();
        setIsPortalLoading(false);
    };

    const PlanCard = ({ planKey }: { planKey: string }) => {
        const key = planKey as SubscriptionTier;
        const plan = PLAN_DETAILS[key];
        const isCurrent = tier === key;
        // A plan below the current tier is a switch/downgrade, not an upgrade —
        // e.g. an Entreprise (PREMIUM) customer looking at Mester (PRO).
        const TIER_RANK: SubscriptionTier[] = ['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE'];
        const isDowngrade = TIER_RANK.indexOf(key) < TIER_RANK.indexOf(tier);
        const isPopular = key === 'PRO';
        const isLoading = loadingTier === key;
        const isPreselected = !isCurrent && preselectTier === key;

        const displayPrice = billing === 'yearly' && YEARLY_PRICES[key]
            ? YEARLY_PRICES[key]
            : plan.price;

        const savingsLabel = billing === 'yearly' ? YEARLY_SAVINGS[key] : null;

        return (
            <Card
                padding="lg"
                /* Whole card selects the plan (parity with the old modal & e2e flow);
                   the Button below is the accessible/keyboard path. */
                onClick={() => !isCurrent && handleSelect(key)}
                interactive={!isCurrent}
                className={cn(
                    'relative flex flex-col',
                    isCurrent && 'opacity-90 cursor-default',
                    !isCurrent && isPopular && 'border-brand-primary dark:border-brand-primary shadow-card-hover',
                    isPreselected && 'ring-2 ring-brand-primary ring-offset-2 ring-offset-bg-subtle dark:ring-offset-bg-dark'
                )}
            >
                {isPopular && !isCurrent && (
                    <Badge variant="brand" className="absolute -top-3 left-1/2 -translate-x-1/2 uppercase tracking-wider shadow-card">
                        Mest Populær
                    </Badge>
                )}
                {isCurrent && (
                    <Badge variant="success" className="absolute -top-3 left-1/2 -translate-x-1/2 uppercase tracking-wider shadow-card" dot>
                        Aktiv
                    </Badge>
                )}

                <div className="text-center mb-6">
                    <h3 className="text-heading text-text-primary dark:text-text-dark-primary uppercase tracking-wide">{plan.label}</h3>
                    <div className="mt-2 flex items-baseline justify-center gap-1">
                        <span className="text-display text-text-primary dark:text-text-dark-primary">{displayPrice}</span>
                        {plan.period && (
                            <span className="text-label text-text-secondary dark:text-text-dark-secondary">
                                {billing === 'yearly' && YEARLY_PRICES[key] ? 'pr. år' : plan.period}
                            </span>
                        )}
                    </div>
                    {savingsLabel && key !== 'FREE' && (
                        <Badge variant="success" className="mt-1.5">{savingsLabel}</Badge>
                    )}
                    <p className="text-label text-text-secondary dark:text-text-dark-secondary mt-2 min-h-10">{plan.description}</p>
                </div>

                <ul className="flex-grow space-y-3 mb-6">
                    {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                            <span className="flex-shrink-0 mt-0.5" aria-hidden="true">
                                {feature.included ? (
                                    <CheckCircleIcon className="w-5 h-5 text-success" />
                                ) : (
                                    <span className="w-5 h-5 rounded-full border border-border-strong dark:border-border-dark-strong flex items-center justify-center">
                                        <span className="w-2 h-0.5 bg-border-strong dark:bg-border-dark-strong"></span>
                                    </span>
                                )}
                            </span>
                            <span
                                className={cn(
                                    'text-label',
                                    feature.included
                                        ? 'text-text-primary dark:text-text-dark-primary font-medium'
                                        : 'text-text-secondary dark:text-text-dark-secondary line-through opacity-60'
                                )}
                            >
                                {feature.text}
                            </span>
                        </li>
                    ))}
                </ul>

                <Button
                    fullWidth
                    variant={isCurrent ? 'secondary' : isPopular ? 'primary' : 'outline'}
                    disabled={isCurrent || !!loadingTier}
                    loading={isLoading}
                    onClick={(e) => { e.stopPropagation(); handleSelect(key); }}
                >
                    {isLoading ? 'Åbner checkout...' : isCurrent ? 'Nuværende Plan' : isDowngrade ? `Skift til ${plan.label}` : plan.buttonText}
                </Button>
            </Card>
        );
    };

    return (
        <Modal
            open
            onClose={onClose}
            size="full"
            title="Vælg den rigtige plan til dit firma"
            description="Fra den selvstændige håndværker til det store entreprisefirma. Skaler op, når du har brug for det."
        >
            <div className="flex justify-center mt-1 mb-6">
                <SegmentedControl
                    label="Faktureringsinterval"
                    fullWidth={false}
                    value={billing}
                    onChange={(v) => setBilling(v as BillingInterval)}
                    options={[
                        { label: 'Månedligt', value: 'monthly' },
                        {
                            label: (
                                <span className="inline-flex items-center gap-1.5">
                                    Årligt
                                    <Badge variant="success">-20%</Badge>
                                </span>
                            ),
                            value: 'yearly',
                        },
                    ]}
                />
            </div>

            {/* Free-trial / promo code entry. Discount codes are entered on Stripe's
                checkout page; free-trial codes must be validated here so we can put
                the trial on the Checkout Session. */}
            <div className="max-w-md mx-auto mb-6">
                <div className="flex items-end gap-2">
                    <div className="flex-1">
                        <Input
                            label="Har du en prøve- eller kampagnekode?"
                            value={trialCode}
                            onChange={(e) => { setTrialCode(e.target.value.toUpperCase()); setTrialCheck(null); }}
                            placeholder="TRIAL30"
                        />
                    </div>
                    <Button variant="outline" onClick={applyTrialCode} loading={checkingTrial} disabled={!trialCode.trim()}>
                        Anvend
                    </Button>
                </div>
                {trialCheck && (
                    <p className={cn('mt-2 text-caption font-semibold', trialCheck.valid ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger')}>
                        {trialCheck.valid
                            ? (trialCheck.trialDays
                                ? `✓ Gratis prøveperiode på ${trialCheck.trialDays} dage anvendes ved næste trin.`
                                : `✓ Gratis prøveperiode indtil ${trialCheck.trialUntil ? new Date(trialCheck.trialUntil).toLocaleDateString('da-DK') : ''} anvendes ved næste trin.`)
                            : (trialCheck.reason || 'Ugyldig kode.')}
                    </p>
                )}
                <p className="mt-1.5 text-caption text-text-secondary dark:text-text-dark-secondary">
                    Rabatkoder indtastes på Stripes betalingsside. Prøvekoder anvendes her.
                </p>
            </div>

            {limitMessage && (
                <Alert variant="warning" className="mb-6">{limitMessage}</Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 pt-3">
                <PlanCard planKey="FREE" />
                <PlanCard planKey="PRO" />
                <PlanCard planKey="PREMIUM" />
            </div>

            {/* Moduler — enkeltkøb oven på planen (grid 4 pr. række) */}
            <div className="mt-10">
                <h3 className="text-heading text-text-primary dark:text-text-dark-primary text-center">
                    Moduler — tilføj til dit abonnement
                </h3>
                <p className="mt-1 text-caption text-text-secondary dark:text-text-dark-secondary text-center">
                    Aktive moduler er markeret. Tryk på et modul for detaljer, gratis prøve eller køb.
                </p>
                <div className="grid grid-cols-4 gap-2 mt-4">
                    {MODULE_IDS.map((id) => {
                        const info = MODULE_INFO[id];
                        const marketing = MODULE_MARKETING[id];
                        const ModIcon = MODULE_ICONS[id];
                        const enabled = getEntitlement(id).enabled;
                        return (
                            <button
                                key={id}
                                type="button"
                                onClick={() => { onClose(); navigate(`/moduler/${id}`); }}
                                aria-label={`${info.name} — ${enabled ? 'aktivt' : 'se pris og køb'}`}
                                className={cn(
                                    'flex flex-col items-center gap-1.5 rounded-card border bg-bg dark:bg-bg-dark-surface p-2.5 text-center transition-all duration-150 hover:shadow-card-hover active:scale-[0.98]',
                                    enabled ? 'border-border dark:border-border-dark' : 'border-brand-border/70 dark:border-brand-border-dark/70'
                                )}
                            >
                                <span
                                    className={cn(
                                        'flex w-8 h-8 items-center justify-center rounded-control',
                                        enabled
                                            ? 'bg-brand-subtle text-brand-primary dark:bg-brand-subtle-dark dark:text-brand-light'
                                            : 'bg-brand-primary text-white'
                                    )}
                                    aria-hidden="true"
                                >
                                    <ModIcon className="w-4 h-4" />
                                </span>
                                <span className="text-caption font-semibold text-text-primary dark:text-text-dark-primary leading-tight line-clamp-2 min-h-8">
                                    {info.name}
                                </span>
                                {enabled ? (
                                    <Badge variant="success" dot>Aktiv</Badge>
                                ) : (
                                    <span className="text-caption font-semibold text-brand-primary">
                                        {marketing.priceKr === 0 ? 'Inkl.' : `${marketing.priceKr} kr/md.`}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {isPaidTier && (
                <div className="mt-8 text-center">
                    <Button
                        variant="outline"
                        onClick={handlePortal}
                        loading={isPortalLoading}
                        iconLeft={
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            </svg>
                        }
                    >
                        {isPortalLoading ? 'Åbner portal...' : 'Administrer abonnement'}
                    </Button>
                    <p className="mt-2 text-caption text-text-secondary dark:text-text-dark-secondary">
                        Skift kortoplysninger, download fakturaer eller annuller dit abonnement
                    </p>
                </div>
            )}

            <div className="mt-8 mb-2 text-center">
                <p className="text-label text-text-secondary dark:text-text-dark-secondary">
                    Leder du efter en Enterprise løsning til flere end 10 brugere?{' '}
                    <button
                        type="button"
                        onClick={() => upgradeTo('ENTERPRISE')}
                        className="inline-flex min-h-11 items-center align-middle text-brand-primary font-bold hover:underline"
                    >
                        Kontakt os her
                    </button>
                </p>
            </div>
        </Modal>
    );
};
