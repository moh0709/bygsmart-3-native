import webpush, { type PushSubscription } from 'web-push';
import type { PushProvider } from './types';
import { buildWebPayload, isDeadWebStatus } from './messages';

export interface VapidConfig {
  subject: string;
  publicKey: string;
  privateKey: string;
}

/** Web push over VAPID (reuses the 2.1 web-push transport). */
export function createWebProvider(vapid: VapidConfig): PushProvider {
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  return {
    platform: 'web',
    async send(sub, msg) {
      try {
        await webpush.sendNotification(sub.subscription as PushSubscription, buildWebPayload(msg));
        return { subscriptionId: sub.id, ok: true };
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        return {
          subscriptionId: sub.id,
          ok: false,
          dead: isDeadWebStatus(status),
          error: e instanceof Error ? e.message : 'web push failed',
        };
      }
    },
  };
}
