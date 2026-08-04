import React, { useEffect, useRef, useState } from 'react';
import { useOrg } from '../../core/org/OrgProvider';
import { useAuth } from '../../contexts/AuthProvider';
import { useToast } from '../../contexts/ToastContext';
import { authenticatedServerFetch } from '../../services/api/http';
import { Badge, Button, Card, cn } from '../ui';
import { ChevronDownIcon, ChevronUpIcon, CloudIcon } from '../icons';

const PRICE_KR_PER_GB = 25;
const BASE_GB = 5;
const GB_STEP = 5;
const GB_MIN = 5;
const GB_MAX = 500;

/** Inline GB roller: scroll or drag up/down to pick the amount (HourScrollWheel mechanics, no modal). */
const GbRoller: React.FC<{ value: number; onChange: (v: number) => void; size: 'sm' | 'md' }> = ({ value, onChange, size }) => {
    const [isDragging, setIsDragging] = useState(false);
    const startY = useRef(0);
    const startVal = useRef(0);
    const clamp = (v: number) => Math.min(GB_MAX, Math.max(GB_MIN, v));

    const handleWheel = (e: React.WheelEvent) => {
        onChange(clamp(value + Math.sign(e.deltaY) * -1 * GB_STEP));
    };
    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        startY.current = e.clientY;
        startVal.current = value;
    };
    const handleTouchStart = (e: React.TouchEvent) => {
        setIsDragging(true);
        startY.current = e.touches[0].clientY;
        startVal.current = value;
    };

    useEffect(() => {
        if (!isDragging) return;
        const handleMove = (clientY: number) => {
            const steps = Math.round((startY.current - clientY) / 24);
            const next = clamp(startVal.current + steps * GB_STEP);
            if (next !== value) onChange(next);
        };
        const onMouseMove = (e: MouseEvent) => { e.preventDefault(); handleMove(e.clientY); };
        const onTouchMove = (e: TouchEvent) => { if (e.cancelable) e.preventDefault(); handleMove(e.touches[0].clientY); };
        const onEnd = () => setIsDragging(false);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onEnd);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onEnd);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onEnd);
        };
    }, [isDragging, value, onChange]);

    return (
        <div
            role="slider"
            aria-label="Ekstra lagerplads i GB — scroll eller træk op og ned"
            aria-valuemin={GB_MIN}
            aria-valuemax={GB_MAX}
            aria-valuenow={value}
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'ArrowUp') { e.preventDefault(); onChange(clamp(value + GB_STEP)); }
                if (e.key === 'ArrowDown') { e.preventDefault(); onChange(clamp(value - GB_STEP)); }
            }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            className={cn(
                'relative flex max-w-[45%] shrink-0 flex-col items-center justify-center rounded-control border bg-bg-subtle dark:bg-bg-dark select-none cursor-ns-resize touch-none transition-colors overflow-hidden',
                size === 'sm' ? 'px-2.5 min-h-9' : 'px-4 min-h-11',
                isDragging
                    ? 'border-brand-primary ring-2 ring-brand-primary/20'
                    : 'border-border-strong dark:border-border-dark-strong'
            )}
        >
            <ChevronUpIcon className={cn('shrink-0', size === 'sm' ? 'w-3 h-3' : 'w-4 h-4', isDragging ? 'text-brand-primary' : 'text-text-tertiary dark:text-text-dark-tertiary opacity-60')} />
            <span className={cn('font-bold tabular-nums leading-none text-text-primary dark:text-text-dark-primary whitespace-nowrap', size === 'sm' ? 'text-caption' : 'text-label')}>
                +{value} GB
            </span>
            <ChevronDownIcon className={cn('shrink-0', size === 'sm' ? 'w-3 h-3' : 'w-4 h-4', isDragging ? 'text-brand-primary' : 'text-text-tertiary dark:text-text-dark-tertiary opacity-60')} />
        </div>
    );
};

/**
 * "Lagerplads" add-on: every org has 5 GB included; extra space is a
 * quantity-based Stripe subscription at 25 kr/GB/md. The webhook keeps
 * organizations.storage_allowance_gb = 5 + quantity.
 *
 * Two layouts: the full marketplace card (/moduler) and a `compact` variant
 * for the usage row at the top of Indstillinger.
 */
export const StorageAddonCard: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
    const { activeOrg, storageUsage } = useOrg();
    const { user } = useAuth();
    const { showToast } = useToast();
    const [extraGb, setExtraGb] = useState(5);
    const [isBuying, setIsBuying] = useState(false);
    const [isOpeningPortal, setIsOpeningPortal] = useState(false);

    if (!activeOrg) return null;

    const allowanceGb = activeOrg.storageAllowanceGb;
    const usedGb = storageUsage ? storageUsage.bytesTotal / (1024 * 1024 * 1024) : null;
    const percent = usedGb !== null && allowanceGb > 0 ? Math.min(100, Math.round((usedGb / allowanceGb) * 100)) : null;
    const hasAddon = allowanceGb > BASE_GB;
    const isOwner = user?.id === activeOrg.createdBy;

    const buy = async () => {
        setIsBuying(true);
        try {
            const res = await authenticatedServerFetch('/storage/checkout', {
                method: 'POST',
                body: JSON.stringify({ extraGb }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);
            window.location.assign(payload.url);
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Kunne ikke starte købet.', 'error');
            setIsBuying(false);
        }
    };

    const openPortal = async () => {
        setIsOpeningPortal(true);
        try {
            const returnUrl = `${window.location.origin}${window.location.pathname}#/moduler`;
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

    const usageBar = percent !== null && (
        <div className={compact ? 'mt-2' : 'mt-3'}>
            <div className="flex items-center justify-between text-caption text-text-secondary dark:text-text-dark-secondary mb-1">
                <span>{usedGb!.toFixed(compact ? 1 : 2)} / {allowanceGb} GB</span>
                <span>{percent} %</span>
            </div>
            <div className="h-2 rounded-full bg-border-strong/30 dark:bg-border-dark-strong/30 overflow-hidden">
                <div
                    className={cn('h-full rounded-full', percent >= 100 ? 'bg-danger' : percent >= 80 ? 'bg-warning' : 'bg-brand-primary')}
                    style={{ width: `${percent}%` }}
                />
            </div>
        </div>
    );

    const stepper = (size: 'sm' | 'md') => (
        <div className={cn('flex items-stretch gap-2', size === 'sm' ? 'mt-2.5' : 'mt-4')}>
            <GbRoller value={extraGb} onChange={setExtraGb} size={size} />
            <Button
                className={cn('flex-1 min-w-0 overflow-hidden whitespace-nowrap', size === 'sm' ? 'px-2 !text-caption' : '')}
                size={size === 'sm' ? 'sm' : 'md'}
                onClick={buy}
                disabled={isBuying}
            >
                {isBuying ? 'Åbner…' : size === 'sm' ? `Køb ${extraGb * PRICE_KR_PER_GB} kr/md.` : `Køb — ${extraGb * PRICE_KR_PER_GB} kr/md.`}
            </Button>
        </div>
    );

    if (compact) {
        return (
            <Card padding="md" aria-label="Lagerplads">
                <p className="text-caption font-semibold text-text-secondary dark:text-text-dark-secondary">Lagerplads</p>
                {usageBar}
                {hasAddon ? (
                    <Button fullWidth size="sm" variant="outline" className="mt-2.5" onClick={openPortal} disabled={isOpeningPortal}>
                        {isOpeningPortal ? 'Åbner…' : 'Administrér'}
                    </Button>
                ) : isOwner ? (
                    stepper('sm')
                ) : null}
            </Card>
        );
    }

    return (
        <section aria-label="Lagerplads">
            <h2 className="text-heading text-text-primary dark:text-text-dark-primary mb-2.5 px-1">Lagerplads</h2>
            <Card padding="md">
                <div className="flex items-start gap-3">
                    <span className="flex w-10 h-10 shrink-0 items-center justify-center rounded-control bg-brand-subtle text-brand-primary dark:bg-brand-subtle-dark dark:text-brand-light" aria-hidden="true">
                        <CloudIcon className="w-5 h-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className="text-label font-bold text-text-primary dark:text-text-dark-primary">
                                {allowanceGb} GB til organisationen
                            </p>
                            {hasAddon
                                ? <Badge variant="success">{BASE_GB} GB inkl. + {allowanceGb - BASE_GB} GB tilkøbt</Badge>
                                : <Badge variant="neutral">{BASE_GB} GB inkluderet</Badge>}
                        </div>
                        <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-0.5">
                            Alle filer — dokumenter, fotos og kvitteringer — tæller med.
                            Ekstra plads koster {PRICE_KR_PER_GB} kr/GB pr. måned og kan opsiges når som helst.
                        </p>
                        {usageBar}
                    </div>
                </div>

                {hasAddon ? (
                    <Button
                        fullWidth
                        variant="outline"
                        className="mt-4"
                        onClick={openPortal}
                        disabled={isOpeningPortal}
                    >
                        {isOpeningPortal ? 'Åbner…' : 'Administrér lagerplads-abonnement'}
                    </Button>
                ) : isOwner ? (
                    stepper('md')
                ) : (
                    <p className="mt-4 text-caption text-text-secondary dark:text-text-dark-secondary">
                        Kun organisationens ejer kan tilkøbe lagerplads.
                    </p>
                )}
            </Card>
        </section>
    );
};
