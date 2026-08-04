import { supabase } from './supabaseClient';

export type PushStatus = 'unsupported' | 'denied' | 'enabled' | 'failed';

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

const getAuthHeader = async (): Promise<Record<string, string>> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
};

export async function getPushStatus(): Promise<PushStatus> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) return 'enabled';
    if (Notification.permission === 'denied') return 'denied';
    return 'failed';
  } catch (error) {
    console.error('[Push] getPushStatus failed:', error);
    return 'failed';
  }
}

export async function disablePushNotifications(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(await getAuthHeader()),
      },
      body: JSON.stringify({ endpoint }),
    });
  } catch (error) {
    console.error('[Push] disablePushNotifications failed:', error);
  }
}

export async function sendTestPush(): Promise<void> {
  await fetch('/api/push/test', {
    method: 'POST',
    headers: { ...(await getAuthHeader()) },
  });
}

export async function sendTimerPushAlert(payload: {
  kind: 'eight-hour-reminder' | 'auto-checkout';
  projectId: string;
  projectName: string;
  taskName: string;
}): Promise<void> {
  const response = await fetch('/api/push/timer-alert', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await getAuthHeader()),
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error('Timer notification could not be delivered.');
  }
}

export async function enablePushNotifications(): Promise<PushStatus> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'failed';

  try {
    const keyResponse = await fetch('/api/push/vapid-public-key');
    const keyPayload = (await keyResponse.json()) as { publicKey?: string };
    if (!keyResponse.ok || !keyPayload.publicKey) return 'failed';

    const registration = await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyPayload.publicKey),
      }));

    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await getAuthHeader()),
      },
      body: JSON.stringify({ subscription }),
    });

    return response.ok ? 'enabled' : 'failed';
  } catch (error) {
    console.error('[Push] enablePushNotifications failed:', error);
    return 'failed';
  }
}
