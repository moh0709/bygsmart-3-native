export type Platform = 'web' | 'ios' | 'android';

export interface PushSub {
  id: string;
  userId: string;
  platform: Platform;
  /** web (VAPID): the PushSubscription JSON. */
  subscription?: unknown;
  /** native: the Expo push token. */
  token?: string | null;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Deep link the notification opens. */
  url?: string;
  data?: Record<string, unknown>;
}

export interface PushResult {
  subscriptionId: string;
  ok: boolean;
  /** The endpoint/token is permanently gone (unsubscribed/uninstalled) → prune it. */
  dead?: boolean;
  error?: string;
}

/** One transport for one platform. web = VAPID; ios/android = Expo (APNs/FCM). */
export interface PushProvider {
  readonly platform: Platform;
  send(sub: PushSub, msg: PushMessage): Promise<PushResult>;
}

export type ProviderRegistry = Partial<Record<Platform, PushProvider>>;
