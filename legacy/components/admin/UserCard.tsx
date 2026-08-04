import React from 'react';
import { Avatar, Badge, Card } from '../ui';
import type { BadgeVariant } from '../ui';
import type { AdminUser } from '../../types';
import { formatAbsolute, formatCountdown, formatDateWithElapsed, formatElapsed } from './userInsights';

/** One labelled metric in the insight strip. */
const Insight: React.FC<{ label: string; children: React.ReactNode; tone?: 'default' | 'warning' | 'danger' }> = ({
    label,
    children,
    tone = 'default',
}) => (
    <span className="flex flex-col gap-0.5 min-w-0">
        <span className="text-caption text-text-tertiary dark:text-text-dark-tertiary">{label}</span>
        <span
            className={[
                'text-caption font-medium tabular-nums',
                tone === 'danger'
                    ? 'text-danger-strong dark:text-danger'
                    : tone === 'warning'
                        ? 'text-warning-strong dark:text-warning'
                        : 'text-text-primary dark:text-text-dark-primary',
            ].join(' ')}
        >
            {children}
        </span>
    </span>
);

export const UserCard: React.FC<{
    user: AdminUser;
    /** Shared clock from the users tab so every card ticks in step. */
    nowMs: number;
    contactEmail: string;
    tierVariant: (tier: string) => BadgeVariant;
    onClick: () => void;
}> = ({ user, nowMs, contactEmail, tierVariant, onClick }) => {
    const countdown = user.isTrialActive ? formatCountdown(user.trialEndsAt, nowMs) : null;

    return (
        <Card padding="none" className="overflow-hidden">
            <button
                type="button"
                onClick={onClick}
                className="w-full text-left px-4 py-3 transition-colors duration-150 hover:bg-bg-subtle active:bg-bg-muted dark:hover:bg-bg-dark-muted/50 dark:active:bg-bg-dark-muted"
            >
                <div className="flex items-center gap-3">
                    <Avatar name={user.name || user.username} src={user.avatarUrl} size="md" />
                    <div className="min-w-0 grow">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-label font-semibold text-text-primary dark:text-text-dark-primary truncate">
                                {user.name || user.username}
                            </span>
                            {!user.isActive && <Badge variant="danger">Deaktiveret</Badge>}
                            {user.isDemo && <Badge variant="warning">Demo</Badge>}
                            {user.isTrialActive && <Badge variant="info">Trial</Badge>}
                            {user.emailConfirmed === false && <Badge variant="neutral">Ikke bekræftet</Badge>}
                        </div>
                        <span className="block text-caption text-text-secondary dark:text-text-dark-secondary truncate mt-0.5">
                            {[contactEmail, user.companyName].filter(Boolean).join(' · ')}
                        </span>
                    </div>
                    <span className="shrink-0 flex flex-col items-end gap-1">
                        <Badge variant={tierVariant(user.subscriptionTier)}>{user.subscriptionTier}</Badge>
                        <Badge variant={user.appRole === 'admin' ? 'brand' : 'neutral'}>
                            {user.appRole === 'admin' ? 'Admin' : 'Bruger'}
                        </Badge>
                    </span>
                </div>

                {/* Quick insights */}
                <div className="mt-3 pt-3 border-t border-border dark:border-border-dark grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
                    <Insight label="Registreret">{formatDateWithElapsed(user.createdAt, nowMs)}</Insight>
                    <Insight label="Sidst aktiv">
                        {user.lastSignInAt ? `${formatElapsed(user.lastSignInAt, nowMs)} siden` : 'Aldrig logget ind'}
                    </Insight>
                    <Insight label="Team">
                        {user.teamId ? `${user.teamCount} medlem${user.teamCount === 1 ? '' : 'mer'}` : 'Intet team'}
                    </Insight>
                    <Insight label="Fakturering">{user.hasBilling ? 'Stripe-kunde' : 'Ingen'}</Insight>

                    {countdown && (
                        <span className="col-span-2 sm:col-span-4">
                            <Insight
                                label={`Trial ${user.trialTier} udløber ${formatAbsolute(user.trialEndsAt)}`}
                                tone={countdown.urgent ? 'danger' : 'warning'}
                            >
                                {countdown.expired ? 'Udløbet' : `om ${countdown.text}`}
                            </Insight>
                        </span>
                    )}
                </div>
            </button>
        </Card>
    );
};

export default UserCard;
