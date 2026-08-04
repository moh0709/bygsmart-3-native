import { describe, it, expect } from 'vitest';
import type { PartnerInviteStatus } from '../types';
import { PARTNER_STATUS_META, OPEN_STATUSES, isNegotiationOpen } from './partner';

const ALL: PartnerInviteStatus[] = ['invited', 'negotiating', 'accepted', 'declined', 'cancelled'];

describe('PARTNER_STATUS_META', () => {
  it('has a label + tone for every status', () => {
    for (const s of ALL) {
      expect(PARTNER_STATUS_META[s].label).toBeTruthy();
      expect(PARTNER_STATUS_META[s].tone).toBeTruthy();
    }
  });
});

describe('isNegotiationOpen', () => {
  it('open for invited/negotiating, closed otherwise', () => {
    expect(isNegotiationOpen('invited')).toBe(true);
    expect(isNegotiationOpen('negotiating')).toBe(true);
    expect(isNegotiationOpen('accepted')).toBe(false);
    expect(isNegotiationOpen('declined')).toBe(false);
    expect(isNegotiationOpen('cancelled')).toBe(false);
  });

  it('agrees with OPEN_STATUSES', () => {
    for (const s of ALL) {
      expect(isNegotiationOpen(s)).toBe(OPEN_STATUSES.includes(s));
    }
  });
});
