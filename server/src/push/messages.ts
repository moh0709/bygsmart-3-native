import type { PushMessage, PushSub } from './types';

/** Expo push API message shape (https://exp.host/--/api/v2/push/send). */
export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

export function buildExpoMessage(sub: PushSub, msg: PushMessage): ExpoMessage {
  return {
    to: sub.token ?? '',
    title: msg.title,
    body: msg.body,
    data: { ...(msg.data ?? {}), ...(msg.url ? { url: msg.url } : {}) },
  };
}

/** Web push (VAPID) payload — the service worker reads this JSON. */
export function buildWebPayload(msg: PushMessage): string {
  return JSON.stringify({
    title: msg.title,
    body: msg.body,
    data: { ...(msg.data ?? {}), ...(msg.url ? { url: msg.url } : {}) },
  });
}

/** Web push endpoint is permanently gone. */
export function isDeadWebStatus(status: number | undefined): boolean {
  return status === 404 || status === 410;
}

/** Expo receipt/ticket says the device unsubscribed/uninstalled. */
export function isDeadExpoReceipt(ticket: { status?: string; details?: { error?: string } } | undefined): boolean {
  return ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered';
}
