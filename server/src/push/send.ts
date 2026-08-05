import type { SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../env';
import { dispatchPush } from './dispatch';
import { createWebProvider } from './webProvider';
import { createExpoProvider } from './expoProvider';
import type { Platform, ProviderRegistry, PushMessage, PushResult, PushSub } from './types';

/** Build the platform→provider registry from config. Web is enabled only when VAPID keys are set. */
export function buildProviders(env: Env): ProviderRegistry {
  const reg: ProviderRegistry = {
    ios: createExpoProvider('ios', env.expoAccessToken || undefined),
    android: createExpoProvider('android', env.expoAccessToken || undefined),
  };
  if (env.vapidPublicKey && env.vapidPrivateKey) {
    reg.web = createWebProvider({
      subject: env.vapidSubject || 'mailto:support@bygsmart.com',
      publicKey: env.vapidPublicKey,
      privateKey: env.vapidPrivateKey,
    });
  }
  return reg;
}

interface SubRow {
  id: string;
  user_id: string;
  platform: Platform;
  subscription: unknown;
  token: string | null;
}

/**
 * Deliver a push to every one of a user's subscriptions (all platforms), then prune
 * any whose endpoint/token came back dead. Uses the service role (push_subscriptions
 * is back-office). Never throws on a single dead device.
 */
export async function sendToUser(
  serviceDb: SupabaseClient,
  providers: ProviderRegistry,
  userId: string,
  msg: PushMessage,
): Promise<PushResult[]> {
  const { data } = await serviceDb
    .from('push_subscriptions')
    .select('id, user_id, platform, subscription, token')
    .eq('user_id', userId);

  const subs: PushSub[] = ((data ?? []) as SubRow[]).map((r) => ({
    id: r.id,
    userId: r.user_id,
    platform: r.platform,
    subscription: r.subscription,
    token: r.token,
  }));

  const { results, deadIds } = await dispatchPush(providers, subs, msg);
  if (deadIds.length > 0) {
    await serviceDb.from('push_subscriptions').delete().in('id', deadIds);
  }
  return results;
}
