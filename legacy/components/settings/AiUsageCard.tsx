import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthProvider';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { SUBSCRIPTION_PLANS } from '../../config/subscriptionPlans';
import { Card, cn } from '../ui';

/**
 * Compact "AI-kald i dag" usage card (Indstillinger usage row). Reads the
 * caller's own daily counter (profiles.ai_requests_today, reset per date by
 * the AI gateway) against the plan's daily limit.
 */
export const AiUsageCard: React.FC = () => {
    const { user } = useAuth();
    const { tier } = useSubscription();
    const [usedToday, setUsedToday] = useState<number | null>(null);

    useEffect(() => {
        if (!user) return;
        let alive = true;
        (supabase as any)
            .from('profiles')
            .select('ai_requests_today, ai_last_reset_date')
            .eq('id', user.id)
            .maybeSingle()
            .then(({ data }: { data: { ai_requests_today: number | null; ai_last_reset_date: string | null } | null }) => {
                if (!alive) return;
                const today = new Date().toISOString().slice(0, 10);
                setUsedToday(data?.ai_last_reset_date === today ? (data?.ai_requests_today ?? 0) : 0);
            })
            .catch(() => { if (alive) setUsedToday(0); });
        return () => { alive = false; };
    }, [user]);

    const limit = SUBSCRIPTION_PLANS[tier]?.aiDailyLimit ?? 5;
    const used = usedToday ?? 0;
    const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

    return (
        <Card padding="md" aria-label="AI-kald i dag">
            <p className="text-caption font-semibold text-text-secondary dark:text-text-dark-secondary">AI-kald i dag</p>
            <div className="mt-2">
                <div className="flex items-center justify-between text-caption text-text-secondary dark:text-text-dark-secondary mb-1">
                    <span>{usedToday === null ? '…' : used} / {limit} kald</span>
                    <span>{percent} %</span>
                </div>
                <div className="h-2 rounded-full bg-border-strong/30 dark:bg-border-dark-strong/30 overflow-hidden">
                    <div
                        className={cn('h-full rounded-full', percent >= 100 ? 'bg-danger' : percent >= 80 ? 'bg-warning' : 'bg-brand-primary')}
                        style={{ width: `${percent}%` }}
                    />
                </div>
            </div>
            <p className="mt-2.5 text-caption text-text-secondary dark:text-text-dark-secondary">
                Nulstilles ved midnat · {tier}-plan
            </p>
        </Card>
    );
};
