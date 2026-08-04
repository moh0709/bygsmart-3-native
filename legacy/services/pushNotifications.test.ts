import { describe, expect, test } from 'vitest';
import { urlBase64ToUint8Array } from './pushNotifications';

describe('push notification helpers', () => {
  test('converts VAPID base64url key to byte array', () => {
    const result = urlBase64ToUint8Array('AQIDBA');
    expect(Array.from(result)).toEqual([1, 2, 3, 4]);
  });
});
