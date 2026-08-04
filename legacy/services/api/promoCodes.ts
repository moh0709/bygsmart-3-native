import { authenticatedServerFetch } from './http';

// Discount codes are Stripe promotion codes (percent-off coupons).
export interface DiscountCode {
  id: string;
  code: string;
  active: boolean;
  percentOff: number | null;
  amountOff: number | null;
  currency: string | null;
  duration: 'once' | 'repeating' | 'forever' | null;
  durationInMonths: number | null;
  expiresAt: string | null;
  maxRedemptions: number | null;
  timesRedeemed: number;
}

// Trial codes are app-managed rows (grant a free trial at checkout).
export interface TrialCode {
  id: string;
  code: string;
  trial_days: number | null;
  trial_until: string | null;
  max_redemptions: number | null;
  redeemed_count: number;
  expires_at: string | null;
  active: boolean;
  note: string | null;
  created_at: string;
}

export interface CreateDiscountPayload {
  code: string;
  percentOff: number;
  duration: 'once' | 'repeating' | 'forever';
  durationInMonths?: number;
  expiresAt?: string;
  maxRedemptions?: number;
}

export interface CreateTrialPayload {
  code: string;
  trialDays?: number | null;
  trialUntil?: string | null;
  maxRedemptions?: number | null;
  expiresAt?: string | null;
  note?: string;
}

const asJson = async (res: Response) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Fejl (${res.status})`);
  return data;
};

export const listDiscountCodes = async (): Promise<DiscountCode[]> =>
  (await asJson(await authenticatedServerFetch('/admin/discount-codes'))).codes ?? [];

export const createDiscountCode = async (payload: CreateDiscountPayload): Promise<{ id: string; code: string }> =>
  asJson(await authenticatedServerFetch('/admin/discount-codes', { method: 'POST', body: JSON.stringify(payload) }));

export const deactivateDiscountCode = async (promoId: string): Promise<void> => {
  await asJson(await authenticatedServerFetch(`/admin/discount-codes/${promoId}/deactivate`, { method: 'POST' }));
};

export const listTrialCodes = async (): Promise<TrialCode[]> =>
  (await asJson(await authenticatedServerFetch('/admin/trial-codes'))).codes ?? [];

export const createTrialCode = async (payload: CreateTrialPayload): Promise<{ id: string; code: string }> =>
  asJson(await authenticatedServerFetch('/admin/trial-codes', { method: 'POST', body: JSON.stringify(payload) }));

export const deactivateTrialCode = async (id: string): Promise<void> => {
  await asJson(await authenticatedServerFetch(`/admin/trial-codes/${id}/deactivate`, { method: 'POST' }));
};

export interface TrialCodeValidation {
  valid: boolean;
  trialDays?: number | null;
  trialUntil?: string | null;
  reason?: string;
}

export const validateTrialCode = async (code: string): Promise<TrialCodeValidation> =>
  asJson(await authenticatedServerFetch('/trial-code/validate', { method: 'POST', body: JSON.stringify({ code }) }));
