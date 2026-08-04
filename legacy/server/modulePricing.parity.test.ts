import { describe, expect, test } from 'vitest';
// @ts-expect-error — plain ESM JS module (server-side source of truth).
import { MODULE_IDS, MODULE_PRICING, DEFAULT_MIN_TIER } from './moduleCatalog.js';
import { MODULE_MARKETING } from '../core/registry/marketplaceCatalog';
import { MODULE_INFO } from '../core/registry/moduleInfo';

// The server's MODULE_PRICING drives Stripe checkout; the frontend
// marketplaceCatalog drives what the customer SEES. These must never drift.

describe('module pricing parity (server ↔ storefront)', () => {
  test('every paid module is priced identically on server and storefront', () => {
    for (const id of MODULE_IDS as string[]) {
      const marketing = MODULE_MARKETING[id as keyof typeof MODULE_MARKETING];
      const server = (MODULE_PRICING as Record<string, { name: string; priceKr: number }>)[id];
      if (marketing.priceKr === 0) {
        expect(server, `${id} is free and must NOT be purchasable`).toBeUndefined();
        expect(DEFAULT_MIN_TIER[id], `${id} shown as Inkluderet must be FREE tier`).toBe('FREE');
      } else {
        expect(server, `${id} must exist in server MODULE_PRICING`).toBeDefined();
        expect(server.priceKr, `${id} price mismatch`).toBe(marketing.priceKr);
        expect(server.name, `${id} product name mismatch`).toBe(MODULE_INFO[id as keyof typeof MODULE_INFO].name);
      }
    }
  });

  test('prices stay inside the agreed 50-149 kr/md. band', () => {
    for (const [id, p] of Object.entries(MODULE_PRICING as Record<string, { priceKr: number }>)) {
      expect(p.priceKr, `${id} out of band`).toBeGreaterThanOrEqual(50);
      expect(p.priceKr, `${id} out of band`).toBeLessThanOrEqual(149);
    }
  });
});
