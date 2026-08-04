// @vitest-environment node
import { describe, expect, test } from 'vitest';
import config from './vite.config';

const resolveConfig = async (mode = 'development') => {
  if (typeof config === 'function') {
    return config({ mode, command: 'serve', isSsrBuild: false, isPreview: false });
  }
  return config;
};

describe('vite dev server config', () => {
  test('uses IPv4 loopback for HMR websockets in local dev', async () => {
    process.env.VITE_PUBLIC_BASE_PATH = '/byggeapp/';

    const resolved = await resolveConfig();

    expect(resolved.server?.hmr).toMatchObject({
      host: '127.0.0.1',
      path: '/byggeapp/',
    });
  });
});
