import React, { createContext, useContext, useState, useEffect } from 'react';
import { SubscriptionTier } from '../types';
import { SUBSCRIPTION_PLANS, PlanLimits } from '../config/subscriptionPlans';
import { useAuth } from './AuthProvider';
import { supabase } from '../services/supabaseClient';

export type BillingInterval = 'monthly' | 'yearly';

interface SubscriptionContextType {
  tier: SubscriptionTier;
  features: PlanLimits;
  upgradeTo: (tier: SubscriptionTier, billing?: BillingInterval, trialCode?: string) => Promise<void>;
  openPortal: () => Promise<void>;
  checkPermission: (permission: keyof PlanLimits) => boolean;
  checkNumericLimit: (permission: 'maxActiveProjects', currentValue: number) => boolean;
  isLoading: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

const getAuthHeader = async (): Promise<Record<string, string>> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
};

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [tier, setTier] = useState<SubscriptionTier>('FREE');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setTier(user.subscriptionTier ?? 'FREE');
    } else {
      setTier('FREE');
    }
    setIsLoading(false);
  }, [user]);

  const upgradeTo = async (newTier: SubscriptionTier, billing: BillingInterval = 'monthly', trialCode?: string): Promise<void> => {
    if (newTier === 'FREE') return;

    if (newTier === 'ENTERPRISE') {
      window.location.href = 'mailto:hello@bygsmart.dk?subject=BygSmart%20Enterprise';
      return;
    }

    if (!user) return;
    if (user.isDemo) {
      console.warn('[Subscription] Demo accounts cannot start checkout.');
      return;
    }

    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(await getAuthHeader()),
      };

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tier: newTier,
          billing,
          ...(trialCode ? { trialCode } : {}),
          successUrl: `${window.location.origin}/#/settings?billing=success`,
          cancelUrl: `${window.location.origin}/#/settings?billing=cancelled`,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };

      if (!response.ok || !payload.url) {
        console.error('[Subscription] checkout error:', payload.error || response.statusText);
        return;
      }

      window.location.href = payload.url;
    } catch (err) {
      console.error('[Subscription] upgradeTo exception:', err);
    }
  };

  const openPortal = async (): Promise<void> => {
    if (!user) return;
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(await getAuthHeader()),
      };
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          returnUrl: `${window.location.origin}/#/settings?billing=portal`,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !payload.url) {
        console.error('[Subscription] portal error:', payload.error || response.statusText);
        return;
      }
      window.location.href = payload.url;
    } catch (err) {
      console.error('[Subscription] openPortal exception:', err);
    }
  };

  const features = SUBSCRIPTION_PLANS[tier] ?? SUBSCRIPTION_PLANS.FREE;

  const checkPermission = (permission: keyof PlanLimits): boolean => {
    const value = features[permission];
    if (typeof value === 'boolean') return value;
    return true;
  };

  const checkNumericLimit = (permission: 'maxActiveProjects', currentValue: number): boolean => {
    return currentValue < features[permission];
  };

  return (
    <SubscriptionContext.Provider value={{ tier, features, upgradeTo, openPortal, checkPermission, checkNumericLimit, isLoading }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
