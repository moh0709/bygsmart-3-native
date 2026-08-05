import type { Platform, PushProvider } from './types';
import { buildExpoMessage, isDeadExpoReceipt } from './messages';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Native push via Expo's push service, which fans out to APNs (iOS) and FCM
 * (Android). One provider instance per platform so per-platform subscription rows
 * route correctly (the "three providers": web VAPID + expo/APNs + expo/FCM).
 */
export function createExpoProvider(platform: Extract<Platform, 'ios' | 'android'>, accessToken?: string): PushProvider {
  return {
    platform,
    async send(sub, msg) {
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify(buildExpoMessage(sub, msg)),
        });
        const json = (await res.json()) as { data?: { status?: string; message?: string; details?: { error?: string } } };
        const ticket = json.data;
        return {
          subscriptionId: sub.id,
          ok: ticket?.status === 'ok',
          dead: isDeadExpoReceipt(ticket),
          error: ticket?.status === 'ok' ? undefined : (ticket?.message ?? `expo http ${res.status}`),
        };
      } catch (e) {
        return { subscriptionId: sub.id, ok: false, error: e instanceof Error ? e.message : 'expo push failed' };
      }
    },
  };
}
