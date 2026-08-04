import { describe, expect, test } from 'vitest';
import {
  buildSeatBillingDetails,
  chooseBillableSubscription,
  getBillableSeats,
  getTargetSeatQuantity,
} from './billingSync.js';

describe('billing seat sync helpers', () => {
  test('chooses an active Stripe subscription when the profile has no stored subscription id', () => {
    const subscription = chooseBillableSubscription([
      { id: 'sub_old', status: 'canceled' },
      { id: 'sub_active', status: 'active' },
    ]);

    expect(subscription?.id).toBe('sub_active');
  });

  test('prefers the stored active subscription id when present', () => {
    const subscription = chooseBillableSubscription(
      [
        { id: 'sub_first', status: 'active' },
        { id: 'sub_stored', status: 'active' },
      ],
      'sub_stored'
    );

    expect(subscription?.id).toBe('sub_stored');
  });

  test('bills leader plus pending and active team seats only', () => {
    const seats = [
      { status: 'active', email: 'active@example.com' },
      { status: 'pending', email: 'pending@example.com' },
      { status: 'declined', email: 'declined@example.com' },
    ];

    expect(getBillableSeats(seats).map((seat) => seat.email)).toEqual([
      'active@example.com',
      'pending@example.com',
    ]);
    expect(getTargetSeatQuantity(seats)).toBe(3);
  });

  test('builds Stripe metadata and invoice fields with seat emails and ids', () => {
    const details = buildSeatBillingDetails({
      leaderEmail: 'leader@example.com',
      teamName: 'Team One',
      seats: [
        { id: 'seat-1', profile_id: 'profile-1', status: 'active', email: 'one@example.com' },
        { id: 'seat-2', status: 'pending', email: 'two@example.com' },
      ],
    });

    expect(details.quantity).toBe(3);
    expect(details.metadata).toMatchObject({
      leader_email: 'leader@example.com',
      team_name: 'Team One',
      billable_seat_count: '2',
      active_seat_count: '1',
      pending_seat_count: '1',
      seat_emails: 'one@example.com,two@example.com',
      seat_ids: 'profile-1,seat-2',
    });
    expect(details.description).toContain('one@example.com');
    expect(details.invoiceCustomFields[0].value).toContain('3 total');
  });
});
