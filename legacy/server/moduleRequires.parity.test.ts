import { describe, expect, test } from 'vitest';
// @ts-expect-error — plain ESM JS module (server-side source of truth).
import { MODULE_IDS, MODULE_REQUIRES } from './moduleCatalog.js';
import { ALL_MANIFESTS } from '../core/registry/manifests';

// The frontend registry (modules/<id>/manifest.ts `requires`) drives nav/
// route/tab-level gating; the server's MODULE_REQUIRES mirrors it to block
// checkout/trial (the backend deploys standalone and can't import frontend
// TS — see project memory deploy_backend_standalone_dir). These must never
// drift, or a purchase could bypass a dependency the UI still enforces.

describe('module requires parity (server ↔ frontend registry)', () => {
  test('every manifest requires[] matches the server MODULE_REQUIRES entry', () => {
    for (const manifest of ALL_MANIFESTS) {
      const server = ((MODULE_REQUIRES as Record<string, string[]>)[manifest.id] || []).slice().sort();
      const frontend = (manifest.requires || []).slice().sort();
      expect(server, `${manifest.id} requires[] mismatch`).toEqual(frontend);
    }
  });

  test('every id referenced by MODULE_REQUIRES is a real module id', () => {
    for (const [id, reqs] of Object.entries(MODULE_REQUIRES as Record<string, string[]>)) {
      expect(MODULE_IDS as string[], `${id} is not a known module id`).toContain(id);
      for (const reqId of reqs) {
        expect(MODULE_IDS as string[], `${id} requires unknown module ${reqId}`).toContain(reqId);
      }
    }
  });
});
